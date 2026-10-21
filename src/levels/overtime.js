import * as THREE from 'three';
import { addEnemy, addPickup, wakeNear } from '../world.js';
import { updateBox } from '../physics.js'; // (not enemies/index.js: importing it here breaks the module init order)

// OVERTIME: the bullpen at 11:59 PM. A 40×40 m floor with a raised deck along the north and south walls
// (y 3, two staircases each), four pillars, low partitions and a jumpable reception island in the middle
// where weapon drops land. Waves never end; score is the goal.

// DESIGN.md "Waves (OVERTIME)".
const COST = { intern: 1, burnout: 1, manager: 2, sysadmin: 2, printer: 3, compliance: 3, brute: 4, recruiter: 4 };
const UNLOCK = { intern: 1, manager: 1, burnout: 2, printer: 3, compliance: 4, brute: 5, sysadmin: 6, recruiter: 8 };
const GIFTS = { 3: 'launcher', 5: 'ssg', 7: 'laser' };
const BREAK = 6; // restock lands at the clear, so the break is a grab-what-you-need window
const DROPS = new Set(['mint', 'shard', 'pack']);

// Wave n's roster: spend 6 + 3n + n²/10 points on unlocked types. A type unlocked this wave always shows up (first);
// burnouts come in packs; recruiters and sysadmins are capped so a wave never becomes a pure sniper/revive slog.
export function composeWave(n, rnd = Math.random) {
  const types = Object.keys(COST).filter((t) => UNLOCK[t] <= n);
  const out = types.filter((t) => UNLOCK[t] === n && n > 1);
  let budget = 6 + 3 * n + Math.floor(n * n / 10) - out.reduce((s, t) => s + COST[t], 0); // gentle early, bites from ~w7
  const count = (t) => out.filter((x) => x === t).length;
  // Snipers stack badly in an open arena (three red lines from three directions can't all be dodged): keep them few.
  const cap = { recruiter: 1 + Math.floor(n / 8), sysadmin: 1 + Math.floor(n / 6) };
  while (budget > 0) {
    const ok = types.filter((t) => COST[t] <= budget && !(count(t) >= (cap[t] ?? 99)));
    const t = ok[Math.floor(rnd() * ok.length)];
    out.push(t);
    budget -= COST[t];
    if (t === 'burnout' && budget > 0) out.push('burnout'), budget--; // pairs: a pack of 3 chain-blasts for 150+
  }
  return out;
}

const SPAWNS = [
  [-12, 0, -10], [17, 0, -10], [-17, 0, 10], [12, 0, 10], [-7, 0, -10], [7, 0, 10], [-18, 0, -6], [18, 0, 6],
  [-17, 3, -17], [0, 3, -17.5], [17, 3, -17], [-17, 3, 17], [0, 3, 17.5], [17, 3, 17],
];
// [kind, x, y, z]: refilled at every wave start if taken.
const RESTOCK = [
  ['shells', -18.5, 0.4, -3], ['shells', 18.5, 0.4, 3], ['staples', -9, 3.4, -17], ['staples', 9, 3.4, 17],
  ['toner', -17.5, 3.4, -18], ['toner', 17.5, 3.4, 18], ['cells', 17.5, 3.4, -18], ['cells', -17.5, 3.4, 18],
  ['coffee', -12, 0.4, -6], ['coffee', 12, 0.4, 6], ['coffee', -12, 0.4, 6], ['coffee', 12, 0.4, -6],
  ['donut', -18.5, 0.4, -11], ['donut', 18.5, 0.4, 11],
];
const DRUMS = [[-6, 0, -7], [6, 0, 7], [15, 3, -16], [-15, 3, 16]];

const v = new THREE.Vector3();

export default {
  id: 'overtime',
  name: 'OVERTIME',
  par: 0,
  next: null,
  loadout: { owned: ['axe', 'shotgun', 'stapler'], ammo: { shells: 30, staples: 100 } },
  build(B) {
    const NS = { solid: false };
    const PEN = { floor: ['carpet', 0x3a3e52], wall: ['wallpaper', 0x9a9078], ceil: ['ceiling', 0x6a665e] };
    const DECK = ['concrete', 0x6a6660], HAZ = ['hazard', 0xffffff];
    B.room(-20, -20, 20, 20, 0, 9, PEN);
    // Decks along the north and south walls, a hazard lip on the edge.
    for (const s of [-1, 1]) {
      const z0 = s < 0 ? -20 : 13, z1 = s < 0 ? -13 : 20, edge = s < 0 ? -13 : 13;
      B.box(-20, 0, z0, 20, 3, z1, DECK);
      B.box(-20, 2.75, edge - 0.03, 20, 3, edge + 0.03, HAZ, NS);
      // Desks on the deck: cover for whoever holds the high ground.
      for (const x of [-10, 10]) {
        B.box(x - 1.2, 3, s * 17 - 0.5, x + 1.2, 3.85, s * 17 + 0.5, ['wood', 0x6a5038]);
        B.box(x - 0.3, 3.85, s * 17 - 0.1, x + 0.3, 4.3, s * 17 + 0.05, 0x202428, NS);
        B.box(x - 0.26, 3.9, s * 17 + s * 0.06, x + 0.26, 4.25, s * 17 + s * 0.065, 0x40c060, { solid: false, glow: true });
      }
    }
    B.stairs(-3, -13, 3, -6, 0, 3, 'n', DECK);
    B.stairs(-20, -13, -15, -6, 0, 3, 'n', DECK);
    B.stairs(-3, 6, 3, 13, 0, 3, 's', DECK);
    B.stairs(15, 6, 20, 13, 0, 3, 's', DECK);
    // Pillars, banded like the tower's atrium column.
    for (const x of [-10, 10]) for (const z of [-3.5, 3.5]) {
      B.box(x - 1, 0, z - 1, x + 1, 9, z + 1, ['concrete', 0x8a8070]);
      for (const y of [2.5, 6]) B.box(x - 1.1, y, z - 1.1, x + 1.1, y + 0.3, z + 1.1, 0x7a1a1a, NS);
    }
    // Reception island (1.1 m: jump on it). Weapon drops land on top.
    B.box(-1.6, 0, -1.6, 1.6, 1.1, 1.6, ['wood', 0x5a4030]);
    B.box(-1.7, 1.1, -1.7, 1.7, 1.2, 1.7, 0x3a2a20);
    B.box(-0.3, 1.2, -1.2, 0.3, 1.6, -1.1, 0x202428, NS);
    // Partition crosses east and west: low cover that still lets you see over when you jump.
    for (const x of [-15, 15]) {
      B.box(x - 2.5, 0, -0.08, x + 2.5, 1.4, 0.08, ['cubicle', 0x5d6b78]);
      B.box(x - 0.08, 0, -2.5, x + 0.08, 1.4, 2.5, ['cubicle', 0x5d6b78]);
    }
    // Dressing: night windows, a clock stuck at 11:59, a water cooler, hell creeping in at the corners.
    for (const s of [-1, 1]) {
      B.box(-18, 4.5, s * 19.96 - 0.02, 18, 8, s * 19.96 + 0.02, 0x0a1020, NS);
      for (let i = 0; i < 26; i++) {
        const x = -17.5 + B.rnd() * 35, y = 4.8 + B.rnd() * 2.9;
        B.box(x - 0.12, y - 0.08, s * 19.9 - 0.03, x + 0.12, y + 0.08, s * 19.9 + 0.03, B.rnd() < 0.8 ? 0xffd070 : 0xa0c0ff, { solid: false, glow: true });
      }
    }
    B.box(-19.96, 5.5, -1.2, -19.9, 7.2, 1.2, 0x101010, NS);
    for (const [y0, z0, z1] of [[6.1, -0.9, -0.15], [6.1, 0.15, 0.9]]) B.box(-19.95, y0, z0, -19.88, y0 + 0.5, z1, 0xff2020, { solid: false, glow: true });
    B.decal(19.9, 6.5, 0, 'w', 10);
    B.box(18.8, 0, -1.4, 19.4, 1.1, -0.8, 0xd0d0d0);
    B.box(18.85, 1.1, -1.35, 19.35, 1.6, -0.85, 0x4a90d0, NS);
    for (const [x, y, z] of [[-20, 1, -6], [20, 2, 6], [-20, 8.5, 20], [20, 8.5, -20], [0, 9, 0], [-14, 9, -14], [14, 9, 14]]) B.flesh(x, y, z, 2);
    for (const x of [-10, 10]) for (const z of [-8, 8]) {
      B.box(x - 2, 8.97, z - 0.3, x + 2, 9, z + 0.3, 0xf0f4ff, { solid: false, glow: true });
      B.light(x, 8, z, 0xfff0d8, 12, 26);
    }
    B.light(0, 7, -17, 0xff3020, 8, 18);
    B.light(0, 7, 17, 0xff3020, 8, 18);
    B.light(-19, 6, 0, 0xff2020, 4, 10, true);
    for (const [x, y, z] of DRUMS) B.barrel(x, y, z);
    for (const [k, x, y, z] of RESTOCK) B.pick(k, x, y, z);
    return { spawn: { pos: new THREE.Vector3(0, 0, 4), yaw: 0 } };
  },

  start(g) {
    g.wave = 0;
    g.director = { state: 'break', t: 4, queue: [], n: 0 }; // first wave after the intro card
  },

  update(g, dt) {
    const d = g.director;
    if (g.player.dead) return;
    d.t -= dt;
    if (d.state === 'break') {
      if (d.t <= 0) startWave(g, d);
      return;
    }
    let alive = 0;
    for (const e of g.enemies) if (e.active && !e.dead && !e.def.prop) alive++;
    // Stragglers wedged out of sight (behind a stair stringer, inside a partition cross) re-enter through a portal
    // instead of making the player hunt for the last one.
    for (const e of g.enemies) {
      if (!e.active || e.dead || e.def.prop) continue;
      e.hideT = e.los ? 0 : (e.hideT ?? 0) + dt;
      if (e.hideT > 8 && !d.queue.length && alive <= 3) {
        e.hideT = 0;
        const p = g.player.pos, ok = SPAWNS.filter(([x, , z]) => { const r = Math.hypot(x - p.x, z - p.z); return r > 10 && r < 24; });
        const [x, y, z] = ok[Math.floor(Math.random() * ok.length)] ?? SPAWNS[0];
        e.pos.set(x, y + (e.def.floats ? 3 : 0), z);
        updateBox(e);
        g.fx.burst(v.set(x, y + e.h / 2, z), 0xff2040, 24, 6, 0.12, 0.7);
        g.audio.play('spawn', e.pos);
      }
    }
    if (d.queue.length && d.t <= 0 && alive < 10 + d.n) {
      spawn(g, d.queue.shift());
      d.t = Math.max(0.25, 0.75 - d.n * 0.04);
    }
    if (!d.queue.length && alive === 0) {
      const pay = 100 * d.n;
      g.score += pay;
      d.state = 'break';
      d.t = BREAK;
      g.audio.play('clear');
      const gift = restock(g, d.n + 1);
      g.hud.msg(`WAVE ${d.n} CLEAR. OVERTIME PAY +${pay}` + (gift ? '. NEW EQUIPMENT ON THE RECEPTION DESK' : ''), 4);
    }
  },
};

function startWave(g, d) {
  const n = ++d.n;
  g.wave = n;
  d.state = 'fight';
  d.t = 0.8;
  d.queue = composeWave(n);
  g.hud.banner?.('WAVE ' + n);
  g.audio.play('wave');
  // Corpses last one extra wave (Recruiter fodder), then go.
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (!e.dead) continue;
    if (e.def.prop || e.stale) {
      g.scene.remove(e.root);
      g.enemies.splice(i, 1);
    } else e.stale = true;
  }
  // Uncollected style/axe drops expire the same way, so a long run doesn't pile up hundreds of them.
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pu = g.pickups[i];
    if (!DROPS.has(pu.kind)) continue;
    if (pu.stale) {
      g.scene.remove(pu.mesh);
      g.pickups.splice(i, 1);
    } else pu.stale = true;
  }
}

// Refill taken pickups (and the drums) the moment a wave is cleared, so the break is for collecting. next: the coming wave.
function restock(g, next) {
  const near = (list, x, y, z, r, kind) => list.some((o) => (kind ? o.kind === kind : !o.dead) && Math.abs((o.pos?.x ?? o.x) - x) < r && Math.abs((o.pos?.z ?? o.z) - z) < r && Math.abs((o.pos?.y ?? o.y) - y) < 1.5);
  for (const [x, y, z] of DRUMS) if (!near(g.enemies, x, y, z, 0.5)) addEnemy(g, 'drum', x, y, z);
  for (const [k, x, y, z] of RESTOCK) if (!near(g.pickups, x, y, z, 0.5, k)) addPickup(g, k, x, y, z);
  if (next % 3 === 0 && !near(g.pickups, 0, 3.5, -18.5, 0.5, 'kevlar')) addPickup(g, 'kevlar', 0, 3.5, -18.5);
  const gift = GIFTS[next];
  if (gift) {
    addPickup(g, gift, 0, 1.7, 0);
    g.fx.burst(v.set(0, 1.7, 0), 0xffd040, 30, 5, 0.1, 0.8);
  }
  return gift;
}

function spawn(g, type) {
  const p = g.player.pos;
  const far = SPAWNS.filter(([x, , z]) => Math.hypot(x - p.x, z - p.z) > 14);
  const [x, y, z] = (far.length ? far : SPAWNS)[Math.floor(Math.random() * (far.length || SPAWNS.length))];
  const jx = (Math.random() - 0.5) * 2, jz = (Math.random() - 0.5) * 2;
  const e = addEnemy(g, type, x + jx, y + (type === 'printer' ? 3 : 0), z + jz);
  wakeNear(g, e.pos, 0.1);
  g.fx.burst(v.set(e.pos.x, e.pos.y + e.h / 2, e.pos.z), 0xff2040, 24, 6, 0.12, 0.7);
  g.audio.play('spawn', e.pos);
}
