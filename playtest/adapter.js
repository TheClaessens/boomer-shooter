// =====================================================================================
//  OVERTIME (endless mode) playtest adapter.
//    const PT = (await import('/playtest/adapter.js?v=' + Date.now())).default;
//    PT.init({ persona: 'mila', skill: 'casual', fresh: true });
//  The game has no in-run choice screens, so the "brain" steers the bot through PT.tactics({...})
//  (stance, weapon preference, target priority, pickup policy) and reconsiders at wave breaks.
// =====================================================================================
import * as THREE from 'three';
import { createPlaytest, fmtTime } from './kit/playtest-core.js';
import { updateWorld, losClear } from '/src/world.js';
import { EYE } from '/src/player.js';
import { WEAPONS, AMMO_MAX } from '/src/weapons.js';
import { LEVELS, CAMPAIGN } from '/src/levels/index.js';
import { RANKS } from '/src/style.js';

const O = () => window.overtime;          // dev harness from main.js
const G = () => O()?.game;
const SAVE_KEY = 'overtime.save';
const NAME = {
  intern: 'Possessed Intern', manager: 'Middle Manager', brute: 'Mailroom Brute', printer: 'Floating Printer',
  burnout: 'Burnout', compliance: 'Compliance Officer', sysadmin: 'Sysadmin', recruiter: 'Recruiter', drum: 'Toner Drum', ceo: 'The CEO',
};
const PROJ_NAME = { stapler: 'Middle Manager staple fireball', ink: 'Floating Printer ink blob', clipboard: 'Compliance Officer clipboard', mark: 'Recruiter fire pillar', toner: 'your own Toner Launcher splash' };
const ATTACK_NAME = { intern: 'Possessed Intern pistol', brute: 'Mailroom Brute charge/punch', compliance: 'Compliance Officer shield bash', sysadmin: 'Sysadmin sniper shot', burnout: 'Burnout explosion', drum: 'Toner Drum explosion' };
const GIFTS = { 3: 'launcher', 5: 'ssg', 7: 'laser' };
const DEFAULT_TACTICS = { stance: 'floor', prefer: null, target: 'nearest', pickups: 'when-hurt', healAt: 50, terminate: true };
const STANCES = ['floor', 'deck', 'island', 'mobile'];
const TARGETS = ['nearest', 'threats-first', 'weakest', 'biggest'];
const PICKUPS = ['never', 'when-hurt', 'always'];

// ── bot hands: an FPS combat bot (aim, strafe, dodge tells, grab pickups). The persona sets its tactics. ──
const LEVEL = {
  //        turn rad/s, aim noise rad, reaction s, dodge tells %, dash timing, burnout spacing, sidestep projectiles
  casual: { turn: 4, noise: 0.06, react: 0.45, dodge: 0.25, dashSnipe: 0.15, spacing: 0, sidestep: 0 },
  average: { turn: 9, noise: 0.03, react: 0.25, dodge: 0.65, dashSnipe: 0.55, spacing: 4, sidestep: 0.4 },
  expert: { turn: 20, noise: 0.012, react: 0.12, dodge: 0.95, dashSnipe: 0.9, spacing: 6, sidestep: 0.85 },
};
const STAIRS = { north: [[0, -7, 0, -15], [-17.5, -7, -17.5, -15]], south: [[0, 7, 0, 15], [17.5, 7, 17.5, 15]] };
const v = new THREE.Vector3(), w = new THREE.Vector3();
const eye = (p) => v.set(p.pos.x, p.pos.y + EYE, p.pos.z);
const has = (p, id) => p.owned[id] && (!WEAPONS[id].ammo || p.ammo[WEAPONS[id].ammo] >= WEAPONS[id].use);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function createHands() {
  let H = null;
  const reset = () => { H = { inp: { keys: {}, fire: false, switchTo: null, cycle: 0, dash: false }, target: null, seenT: 0, strafe: 1, strafeT: 0, last: null, stuckT: 0, dodged: new WeakSet(), noticed: new WeakMap(), laserHold: false, circle: 0 }; };
  reset();

  function pickTarget(g, p, T, L) {
    const ep = eye(p).clone();
    let best = null, bs = Infinity;
    for (const e of g.enemies) {
      if (e.dead || !e.active || e.def.prop) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d > 50 || !losClear(g, ep, w.set(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z))) continue;
      let s = d;
      if (T.target === 'threats-first') s -= ({ sysadmin: 40, recruiter: 30, burnout: d < 10 ? 25 : 0 }[e.type] ?? 0);
      else if (T.target === 'weakest') s = e.hp + d * 0.5;
      else if (T.target === 'biggest') s = -e.hp + d * 0.5;
      if (T.terminate && e.staggerT > 0 && d < 10) s -= 50;
      if (s < bs) { bs = s; best = e; }
    }
    // reaction time: a newly chosen target is only acted on after `react` seconds
    if (best !== H.target) { H.target = best; H.seenT = 0; }
    return best;
  }

  function weaponFor(p, e, d, T) {
    if (T.terminate && e?.staggerT > 0 && d < 3) return 'axe';
    if (T.prefer && has(p, T.prefer) && !(T.prefer === 'launcher' && d < 5)) return T.prefer;
    if (!e) return null;
    if (e.type === 'compliance' && has(p, 'laser')) return 'laser';
    if (d < 7 && has(p, 'ssg')) return 'ssg';
    if (d < 7 && has(p, 'shotgun')) return 'shotgun';
    if (d > 8 && e.type !== 'burnout' && has(p, 'launcher')) return 'launcher';
    if (d > 15 && has(p, 'laser')) return 'laser';
    return ['stapler', 'shotgun', 'ssg', 'launcher', 'laser'].find((x) => has(p, x)) ?? 'axe';
  }

  // where the stance wants the player to stand (null = no preference)
  function home(g, p, T, t) {
    if (T.stance === 'deck') return { x: 0, y: 3, z: p.pos.z > 0 ? 16 : -16 };
    if (T.stance === 'island') return { x: 0, y: 1.1, z: 0 };
    if (T.stance === 'mobile') { const a = t * 0.35; return { x: Math.cos(a) * 9, y: 0, z: Math.sin(a) * 5 }; }
    return null;
  }

  // a straight line can't climb onto the decks (y 3): route via the nearest staircase
  function route(p, goal) {
    if (goal.y > 2 && p.pos.y < 2) {
      const side = goal.z < 0 ? STAIRS.north : STAIRS.south;
      const [bx, bz] = side.reduce((a, s) => (Math.hypot(s[0] - p.pos.x, s[1] - p.pos.z) < Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z) ? s : a));
      if (Math.abs(p.pos.x - bx) > 1.5 || Math.abs(p.pos.z - bz) > 2.5) return { x: bx, z: bz };
      return { x: bx, z: goal.z };
    }
    return goal;
  }

  function wantPickup(g, p, T, calm) {
    const hurt = p.health < T.healAt, lowAmmo = (k) => p.ammo[k] < AMMO_MAX[k] * 0.3;
    let best = null, bd = calm ? 60 : 18;
    for (const pu of g.pickups) {
      const k = pu.kind, isWeapon = !!WEAPONS[k];
      const useful = isWeapon ? !p.owned[k]
        : ['coffee', 'donut', 'mint', 'espresso'].includes(k) ? (k === 'espresso' || p.health < 100) && (T.pickups === 'always' || hurt)
        : ['kevlar', 'shard'].includes(k) ? p.armor < 100 && T.pickups !== 'never'
        : k === 'pack' ? T.pickups !== 'never'
        : p.owned && AMMO_MAX[k] ? (T.pickups === 'always' ? p.ammo[k] < AMMO_MAX[k] : lowAmmo(k)) && T.pickups !== 'never' : false;
      if (!useful) continue;
      const d = Math.hypot(pu.x - p.pos.x, pu.z - p.pos.z) + Math.abs(pu.y - p.pos.y) * 4;
      if (d < bd) { bd = d; best = pu; }
    }
    return best;
  }

  function moveKeys(p, k, dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    dx /= len; dz /= len;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const f = -dx * sin - dz * cos, s = dx * cos - dz * sin;
    if (f > 0.38) k.KeyW = true; else if (f < -0.38) k.KeyS = true;
    if (s > 0.38) k.KeyD = true; else if (s < -0.38) k.KeyA = true;
  }

  function tick(ctx, level) {
    const g = G(), p = g?.player;
    if (!p || p.dead) return;
    const L = LEVEL[level] ?? LEVEL.average, T = ctx.run.tactics, dt = ctx.dt, inp = H.inp, k = (inp.keys = {});
    inp.fire = false;
    const e = pickTarget(g, p, T, L);
    H.seenT += dt;
    const d = e ? e.pos.distanceTo(p.pos) : Infinity;
    const calm = g.director?.state === 'break' || !e;
    let mx = 0, mz = 0;

    // threats a player could see coming
    for (const x of g.enemies) {
      if (x.dead || !x.active) continue;
      const xd = flat(x.pos, p.pos);
      if (x.type === 'sysadmin' && x.tellT > 0 && x.staggerT <= 0) {
        // red laser on you: dash sideways right before the shot (i-frames) or keep moving
        if (!H.noticed.has(x)) H.noticed.set(x, Math.random() < L.dashSnipe);
        if (H.noticed.get(x) && x.tellT < 0.14 && p.dashCharges > 0) { inp.dash = true; H.strafe *= -1; }
      } else H.noticed.delete(x);
      if (x.type === 'burnout' && xd < L.spacing) { mx += (p.pos.x - x.pos.x) / xd * 2; mz += (p.pos.z - x.pos.z) / xd * 2; }
      if (x.type === 'brute' && x.chargeT > 0 && xd < 12 && Math.random() < L.dodge * dt * 8) { inp.dash = true; H.strafe *= -1; }
    }
    for (const pr of g.projectiles) {
      if (pr.owner === 'player') continue;
      if (pr.kind === 'mark') {
        const rd = flat(pr.pos, p.pos);
        if (rd < 2.2 && Math.abs(pr.pos.y - p.pos.y) < 2) {
          if (!H.dodged.has(pr)) { H.dodged.add(pr); pr._dodge = Math.random() < L.dodge; }
          if (pr._dodge) { mx += (p.pos.x - pr.pos.x) / (rd || 1) * 4; mz += (p.pos.z - pr.pos.z) / (rd || 1) * 4; }
        }
        continue;
      }
      if (!L.sidestep) continue;
      const rel = w.subVectors(p.pos, pr.pos), vel = pr.vel, sp = vel.length();
      const along = (rel.x * vel.x + rel.z * vel.z) / (sp || 1);
      if (along > 0 && along < 10 && Math.random() < L.sidestep) {
        const px = -vel.z / sp, pz = vel.x / sp, side = (rel.x * px + rel.z * pz) > 0 ? 1 : -1;
        const miss = Math.abs(rel.x * px + rel.z * pz);
        if (miss < 1.2) { mx += px * side * 3; mz += pz * side * 3; }
      }
    }

    // aim (turn-rate limited, noisy, after reaction time)
    if (e && H.seenT > L.react) {
      const dx = e.pos.x - p.pos.x, dy = e.pos.y + e.h * 0.5 - (p.pos.y + EYE), dz = e.pos.z - p.pos.z;
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      let dyaw = ((ty - p.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      const step = L.turn * dt;
      p.yaw += Math.max(-step, Math.min(step, dyaw)) + (Math.random() - 0.5) * L.noise;
      p.pitch += Math.max(-step, Math.min(step, tp - p.pitch)) + (Math.random() - 0.5) * L.noise * 0.5;
      dyaw = ((ty - p.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      const aimed = Math.abs(dyaw) < Math.max(0.06, 0.9 / Math.max(d, 1)) + (WEAPONS[p.weapon].ammo === 'shells' ? 0.05 : 0);
      inp.switchTo = weaponFor(p, e, d, T);
      if (p.weapon === 'laser') { inp.fire = !(p.charge >= 1 && aimed); }
      else inp.fire = aimed && !(p.weapon === 'launcher' && d < 4.5);
    } else if (!e) {
      p.yaw += 1.2 * dt; // look around for the next one
      p.pitch *= 0.95;
    }

    // movement: pickups when calm or hurt, else stance + spacing + strafe
    const pu = wantPickup(g, p, T, calm);
    const homeAt = home(g, p, T, g.time);
    let goal = null;
    if (pu && (calm || p.health < T.healAt || WEAPONS[pu.kind])) goal = { x: pu.x, y: pu.y, z: pu.z };
    else if (e && T.terminate && e.staggerT > 0 && d < 10) goal = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
    else if (homeAt && Math.hypot(homeAt.x - p.pos.x, homeAt.z - p.pos.z) > 3.5) goal = homeAt;
    // nobody in sight mid-wave for a while: go find them (a player would walk over and look)
    H.blindT = e || calm ? 0 : (H.blindT ?? 0) + dt;
    if (calm || g.stats.kills !== H.kills) { H.kills = g.stats.kills; H.noKillT = 0; } else H.noKillT = (H.noKillT ?? 0) + dt;
    if ((!goal || goal === homeAt) && (H.blindT > 2.5 || H.noKillT > 8)) {
      let n = null, nd = 1e9;
      for (const x of g.enemies) if (!x.dead && x.active && !x.def.prop) { const xd = x.pos.distanceTo(p.pos); if (xd < nd) { nd = xd; n = x; } }
      if (n) goal = { x: n.pos.x, y: n.pos.y, z: n.pos.z };
      if (H.noKillT > 14) H.noKillT = 0; // give the stance another go
    }
    if (goal) {
      const r = route(p, goal);
      mx += (r.x - p.pos.x); mz += (r.z - p.pos.z);
      const l = Math.hypot(mx, mz) || 1; mx = mx / l * 3; mz = mz / l * 3;
    }
    if (e && !goal) {
      const want = p.weapon === 'ssg' || p.weapon === 'shotgun' ? 5 : p.weapon === 'axe' ? 1.5 : p.weapon === 'launcher' ? 12 : 10;
      const tx = (e.pos.x - p.pos.x) / (d || 1), tz = (e.pos.z - p.pos.z) / (d || 1);
      const push = d > want + 3 ? 1 : d < want - 2 ? -1 : 0;
      mx += tx * push * 1.5; mz += tz * push * 1.5;
      if ((H.strafeT -= dt) <= 0) { H.strafe *= -1; H.strafeT = 0.8 + Math.random() * 1.2; }
      mx += -tz * H.strafe; mz += tx * H.strafe;
    }
    moveKeys(p, k, mx, mz);
    // unstick: jump if we wanted to move but didn't
    if (H.last && (k.KeyW || k.KeyA || k.KeyS || k.KeyD) && flat(H.last, p.pos) < 0.02) { if ((H.stuckT += dt) > 0.3) { k.Space = true; H.strafe *= -1; H.stuckT = 0; } } else H.stuckT = 0;
    H.last = { x: p.pos.x, z: p.pos.z };
    if (level === 'expert' && e && d < 6 && !calm && Math.random() < dt * 0.6) inp.dash = true;
  }
  return { tick, reset, levels: LEVEL, get input() { return H.inp; } };
}
const hands = createHands();

// ── damage attribution (world.js hurtPlayer calls g.onHurt(dmg, from) in dev builds) ──
let projSnap = new Map();
function attribute(g, from) {
  const pr = projSnap.get(from) ?? g.projectiles.find((x) => x.pos === from);
  if (pr) return pr.owner === 'player' ? PROJ_NAME.toner : (PROJ_NAME[pr.kind] ?? `${NAME[pr.owner?.type] ?? '?'} projectile`);
  const e = g.enemies.find((x) => x.pos === from);
  if (e) return ATTACK_NAME[e.type] ?? `${NAME[e.type] ?? e.type} attack`;
  let best = null, bd = 4; // blast centres sit at the body's centre (or a chained neighbour's)
  for (const x of g.enemies) { const d = x.pos.distanceTo(from); if (d < bd && x.dead && (x.type === 'burnout' || x.type === 'drum')) { bd = d; best = x; } }
  if (best) return ATTACK_NAME[best.type] ?? `${NAME[best.type]} explosion`;
  return 'unknown';
}

function loadSaveInto(save) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
  if (!(s?.unlocked && s?.best)) s = { unlocked: ['tower'], best: {} };
  save.unlocked = s.unlocked; save.best = s.best;
}
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(O().save)); } catch {} };
let hudRef = null;
const hudObj = () => G()?.hud ?? hudRef;

function hookGame(ctx) {
  const g = G();
  if (!g || g._ptHooked) return;
  g._ptHooked = true;
  hudRef = g.hud;
  g.onHurt = (dmg, from) => {
    const src = attribute(g, from), p = g.player, taken = dmg - Math.min(p.armor, dmg / 3);
    ctx.tally('dmgTaken', taken); ctx.tally('dmgBy', taken, src);
    const R = ctx.run; if (R) { R.dmgBy[src] = (R.dmgBy[src] ?? 0) + taken; R.lastHit = src; }
    if (dmg >= 20) ctx.event(`hit for ${Math.round(dmg)} by ${src} (hp ${Math.max(0, Math.round(p.health - taken))})`);
  };
  const h = g.hud;
  if (!h._ptWrapped) {
    h._ptWrapped = true;
    const msg = h.msg.bind(h), banner = h.banner.bind(h), bonus = h.bonus.bind(h);
    h.msg = (text, dur) => { if (!/^(COFFEE|DONUT|BREATH|ARMOR|SHELLS|STAPLES|TONER|CELLS|\+)/.test(text)) ctx.event(`on screen: "${text}"`); return msg(text, dur); };
    h.banner = (text) => { ctx.event(`banner: ${text}`); return banner(text); };
    h.bonus = (list) => { for (const b of list) ctx.tally('styleBonuses', 1, b); return bonus(list); };
  }
}

function startRun(opts, ctx) {
  const o = O();
  o.startLevel('overtime');
  const g = G();
  hookGame(ctx);
  projSnap = new Map();
  ctx.run.tactics = { ...DEFAULT_TACTICS, ...(ctx.run.tactics ?? {}), ...(opts.tactics ?? {}) };
  ctx.run.dmgBy = {}; ctx.run.killsBy = {}; ctx.run.seenDead = new WeakSet(); ctx.run.wave = 0; ctx.run.waveLog = [];
  ctx.run.hpAtWave = 100;
  if (opts.wave > 1) { // [jumped] content-review crutch: start at wave N with the gifts a player would have by then
    const p = g.player;
    g.director.n = opts.wave - 1; g.wave = opts.wave - 1; g.director.t = 2;
    for (const [n, id] of Object.entries(GIFTS)) if (+n <= opts.wave) p.owned[id] = true;
    for (const k of Object.keys(AMMO_MAX)) if (Object.values(GIFTS).some((id) => p.owned[id] && WEAPONS[id].ammo === k) || k === 'shells' || k === 'staples') p.ammo[k] = Math.max(p.ammo[k], AMMO_MAX[k] * 0.6);
    p.armor = 50;
    ctx.event(`[jumped] starting at wave ${opts.wave}`);
  }
  document.getElementById('screen').hidden = true;
  return { mode: 'OVERTIME (endless)', wave: opts.wave > 1 ? `jumped to ${opts.wave}` : 1, tactics: ctx.run.tactics };
}

const PT = createPlaytest({
  dt: 1 / 60,
  ready: () => !!O(),
  storageKeys: [SAVE_KEY],
  outDir: 'playtest/out',
  maxEvents: 40,
  install(ctx) {},
  onInit(opts, ctx) {
    loadSaveInto(O().save);
    if (!G()) { document.getElementById('screen').hidden = false; }
    else hudObj()?.screen('title', null, { save: O().save, levels: LEVELS, campaign: CAMPAIGN });
    return { best: O().save.best.overtime ?? 0 };
  },
  start: startRun,
  step(dt, ctx) {
    const g = G();
    projSnap.clear();
    for (const pr of g.projectiles) projSnap.set(pr.pos, pr);
    const inp = hands.input;
    updateWorld(g, inp, dt);
    inp.switchTo = null; inp.cycle = 0; inp.dash = false;
  },
  afterStep(ctx) {
    const g = G(), p = g.player, R = ctx.run;
    ctx.min('hpMin', p.health);
    ctx.every(6, 'hud', () => g.hud.update(g, ctx.dt * 6));
    for (const e of g.enemies) {
      if (!e.dead || e.def.prop || R.seenDead.has(e)) continue;
      R.seenDead.add(e);
      const n = NAME[e.type] ?? e.type;
      ctx.tally('kills', 1, n); R.killsBy[n] = (R.killsBy[n] ?? 0) + 1;
    }
    for (const e of g.enemies) if (!e.dead && R.seenDead.has(e)) { R.seenDead.delete(e); ctx.tally('revived', 1, NAME[e.type]); }
    const wave = g.wave ?? 0, st = g.director?.state;
    if (st !== R.dirState) {
      if (st === 'break' && R.dirState === 'fight') {
        R.waveLog.push({ wave, time: Math.round(g.stats.time), hpEnd: Math.round(p.health), hpStart: R.hpAtWave });
        ctx.event(`wave ${wave} cleared (hp ${Math.round(p.health)}, armor ${Math.round(p.armor)}, score ${g.score})`);
      }
      if (st === 'fight') { R.hpAtWave = Math.round(p.health); }
      R.dirState = st;
    }
    const owned = Object.keys(p.owned).filter((x) => p.owned[x]).length;
    if (R.owned !== undefined && owned > R.owned) ctx.event(`picked up ${WEAPONS[Object.keys(p.owned).filter((x) => p.owned[x]).at(-1)]?.name ?? 'a weapon'}`);
    R.owned = owned;
    if (p.dead && !R.deathLogged) { R.deathLogged = true; ctx.event(`DIED on wave ${wave} — last hit: ${R.lastHit ?? '?'}`); }
  },
  afterPlay() { const g = G(); if (g) g.hud.update(g, 0); },
  time: () => G()?.stats.time ?? 0,
  status: () => (!G() ? 'menu' : G().player.dead ? 'lost' : 'playing'),
  lowHp: (frac = 0.3) => { const p = G()?.player; return !!p && p.health < 100 * frac; },
  state(ctx) {
    const g = G(); if (!g) return { screen: 'title' };
    const p = g.player, alive = g.enemies.filter((e) => e.active && !e.dead && !e.def.prop);
    const by = {}; for (const e of alive) by[NAME[e.type]] = (by[NAME[e.type]] ?? 0) + 1;
    const own = Object.keys(p.owned).filter((x) => p.owned[x]);
    return {
      time: fmtTime(g.stats.time), wave: g.wave ?? 0, phase: g.director?.state === 'break' ? 'break' : 'fighting',
      queued: g.director?.queue?.length ?? 0, alive: by,
      hp: Math.round(p.health), armor: Math.round(p.armor), weapon: WEAPONS[p.weapon].name,
      ammo: Object.fromEntries(Object.entries(p.ammo).filter(([k]) => own.some((x) => WEAPONS[x].ammo === k)).map(([k, n]) => [k, Math.round(n)])),
      owned: own, dash: p.dashCharges, rank: RANKS[g.rank], score: g.score, kills: g.stats.kills,
      ...(p.dead ? { dead: true } : {}),
      tactics: ctx?.run?.tactics,
    };
  },
  stops: {
    waveClear: () => { let s = G()?.director?.state; return () => { const was = s; s = G().director.state; return was === 'fight' && s === 'break'; }; },
    newWeapon: () => { const p = G()?.player, n = p ? Object.values(p.owned).filter(Boolean).length : 0; return () => Object.values(G().player.owned).filter(Boolean).length > n; },
  },
  end(ctx) {
    const g = G(), o = O(), R = ctx.run, prev = o.save.best.overtime ?? 0, isNew = g.score > prev;
    if (!ctx.run?.opts?.batch && !(ctx.run?.opts?.wave > 1)) { if (isNew) o.save.best.overtime = g.score; writeSave(); }
    document.getElementById('screen').hidden = false;
    g.hud.screen('dead', g, { best: Math.max(prev, g.score), isNew });
    const top = Object.entries(R.dmgBy).sort((a, b) => b[1] - a[1]);
    return {
      result: 'lost', wave: g.wave, time: fmtTime(g.stats.time), score: g.score, best: o.save.best.overtime ?? 0, newBest: isNew,
      kills: g.stats.kills, killsBy: R.killsBy, peakRank: RANKS[g.style.peak], killedBy: R.lastHit,
      damageTakenBy: Object.fromEntries(top.map(([k, n]) => [k, Math.round(n)])), waves: R.waveLog.slice(-12),
      ...(ctx.run?.opts?.wave > 1 ? { note: '[jumped] run: best score not saved' } : {}),
    };
  },
  abandon(ctx) { const g = G(); if (g) g.player.dead = true; document.getElementById('screen').hidden = false; hudObj()?.screen('title', null, { save: O().save, levels: LEVELS, campaign: CAMPAIGN }); return { wave: g?.wave, score: g?.score }; },

  canvas: () => document.getElementById('game'),
  render: () => { document.getElementById('screen').hidden = true; O().render(); },
  project: null,
  uiRoot: () => document.body,

  meta: () => ({ bestScore: O().save.best.overtime ?? 0, unlockedLevels: O().save.unlocked }),
  actions: {
    // The brain's lever: how the bot plays. Any subset; persists for the run.
    tactics(ctx, t = {}) {
      if (!ctx.run) return { error: 'start a run first' };
      const bad = [];
      if (t.stance && !STANCES.includes(t.stance)) bad.push(`stance ∈ ${STANCES}`);
      if (t.target && !TARGETS.includes(t.target)) bad.push(`target ∈ ${TARGETS}`);
      if (t.pickups && !PICKUPS.includes(t.pickups)) bad.push(`pickups ∈ ${PICKUPS}`);
      if (t.prefer && !WEAPONS[t.prefer]) bad.push(`prefer ∈ ${Object.keys(WEAPONS)} or null`);
      if (bad.length) return { error: bad.join('; ') };
      Object.assign(ctx.run.tactics, t);
      return { tactics: ctx.run.tactics };
    },
    // Look in a direction before a screenshot: 'enemy' (nearest), 'deck-north', 'deck-south', 'island', or a yaw in radians.
    look(ctx, at = 'enemy') {
      const g = G(), p = g.player;
      let pt = null;
      if (at === 'enemy') { let bd = 1e9; for (const e of g.enemies) if (!e.dead && e.active && !e.def.prop) { const d = e.pos.distanceTo(p.pos); if (d < bd) { bd = d; pt = e.pos; } } }
      else pt = { 'deck-north': { x: 0, y: 3, z: -17 }, 'deck-south': { x: 0, y: 3, z: 17 }, island: { x: 0, y: 1, z: 0 } }[at];
      if (typeof at === 'number') { p.yaw = at; p.pitch = 0; return { yaw: at }; }
      if (!pt) return { error: 'nothing to look at' };
      p.yaw = Math.atan2(-(pt.x - p.pos.x), -(pt.z - p.pos.z));
      p.pitch = Math.atan2(pt.y + 1 - (p.pos.y + EYE), Math.hypot(pt.x - p.pos.x, pt.z - p.pos.z));
      return { looking: at };
    },
    // Full per-run damage/kill ledger so far.
    ledger(ctx) { const R = ctx.run; return R ? { dmgBy: R.dmgBy, killsBy: R.killsBy, waves: R.waveLog } : { error: 'no run' }; },
  },

  batchPlan: (opts) => (opts.tacticsList ?? [opts.tactics ?? {}]).map((tactics) => ({ tactics })),
  batchRow(ctx, runOpts) {
    const g = G(), R = ctx.run, top = Object.entries(R.dmgBy).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { tactics: JSON.stringify(runOpts.tactics), wave: g.wave, time: Math.round(g.stats.time), score: g.score, kills: g.stats.kills, killedBy: R.lastHit, topDmg: Object.fromEntries(top.map(([k, n]) => [k, Math.round(n)])) };
  },
  batchMaxSeconds: 1500,
  batchEnd() { loadSaveInto(O().save); },
  hands,
});

window.PT = PT;
export default PT;
