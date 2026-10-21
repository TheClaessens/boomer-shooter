import * as THREE from 'three';
import { createBuilder, walkStairs } from './level.js';
import { LEVELS } from './levels/index.js';
import { moveBody, raycast, rayBox, boxDist, RAY_NORMAL } from './physics.js';
import { createPlayer, movePlayer, EYE } from './player.js';
import { updateWeapons, selectWeapon, WEAPONS, AMMO_MAX } from './weapons.js';
import { spawnEnemy, updateEnemy, wake } from './enemies/index.js';
import { FX } from './fx.js';
import { PROJ, registerProjectiles } from './projectiles.js';
import { createStyle, styleKill, styleDecay, styleHurt, rankOf, RANKS, MANAGER, VP } from './style.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
const cube = new THREE.BoxGeometry(1, 1, 1);
const STAGGER_T = 2.0, DASH_KILL_WINDOW = 0.4;

// levelId: key of LEVELS. loadout: what the player carries in (see player.js loadoutOf), defaulting to the level's own.
export function createWorld(audio, hud, levelId, loadout) {
  const level = LEVELS[levelId];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050404);
  scene.fog = new THREE.Fog(0x050404, 30, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const B = createBuilder(scene);
  const { spawn } = level.build(B);
  B.finish();
  const L = B.L;
  const muzzle = new THREE.PointLight(0xffc070, 0, 16, 1);
  const boom = new THREE.PointLight(0xff8030, 0, 18, 1);
  scene.add(muzzle, boom);
  const g = {
    scene, audio, hud, level, levelId, time: 0,
    solids: [...L.solids, ...L.doors.map((d) => d.box), ...L.lifts.map((l) => l.box)],
    doors: L.doors, lifts: L.lifts, stairs: L.stairs, triggers: L.triggers, arenas: L.arenas, flicker: L.flicker,
    enemies: [], pickups: [], projectiles: [], fx: new FX(scene),
    style: createStyle(), rank: 0, score: 0, hitstop: 0,
    stats: { kills: 0, total: 0, secrets: 0, secretsTotal: L.secrets, time: 0 },
    player: createPlayer(spawn, loadout ?? level.loadout ?? { owned: ['axe', 'shotgun'], ammo: { shells: 24 } }),
    muzzle, boom, shake: 0, exited: false, sightCD: 0, lockedT: 0, boss: null,
  };
  g.fx.movers = new Set(g.solids.slice(L.solids.length)); // door and lift boxes: no decals on things that move
  for (const [type, x, y, z, group] of L.enemies) addEnemy(g, type, x, y, z, group);
  for (const [kind, x, y, z] of L.pickups) addPickup(g, kind, x, y, z);
  level.start?.(g);
  audio.setRank(0);
  return g;
}

// Also used by level scripts (waves) and the boss (summons). Returns the enemy.
export function addEnemy(g, type, x, y, z, group = null) {
  const e = spawnEnemy(g, type, x, y, z, group);
  g.enemies.push(e);
  if (!e.def.prop) g.stats.total++;
  if (e.def.boss) g.boss = e;
  return e;
}

export function updateWorld(g, input, dt) {
  const p = g.player;
  // Hit-stop: the world freezes for a few frames to sell a big hit.
  if (g.hitstop > 0) {
    g.hitstop -= dt;
    return;
  }
  g.time += dt;
  g.stats.time += dt;
  g.sightCD -= dt;
  g.lockedT -= dt;
  updateDoors(g, dt);
  for (const l of g.lifts) updateLift(g, l, dt);
  movePlayer(g, input, dt);
  updateWeapons(g, input, dt);
  for (const e of g.enemies) updateEnemy(g, e, dt);
  separate(g);
  walkStairs(g, g.stairs);
  updateProjectiles(g, dt);
  updatePickups(g, dt);
  updateTriggers(g);
  updateArenas(g);
  g.level.update?.(g, dt);

  styleDecay(g.style, dt);
  const r = rankOf(g.style);
  if (r !== g.rank) {
    if (r > g.rank) {
      g.audio.play('rankup');
      g.hud.rankUp(RANKS[r]);
    } else g.audio.play('rankdown');
    g.rank = r;
    g.audio.setRank(r);
  }

  g.fx.update(dt, g.solids);
  g.muzzle.position.set(p.pos.x, p.pos.y + EYE, p.pos.z);
  g.muzzle.intensity = p.flash > 0 ? 25 : 0;
  g.boom.intensity = Math.max(0, g.boom.intensity - dt * 80);
  for (const f of g.flicker) f.light.intensity = Math.random() < 0.05 ? f.base * 0.1 : f.base;
  g.shake = Math.max(0, g.shake - dt * 2);
}

// ── combat ────────────────────────────────────────────────────────────────────────────

// ignore: an enemy the ray starts inside. Returns { t, enemy, normal } (normal is the wall's, when no enemy was hit).
export function hitscan(g, o, d, maxT, ignore = null) {
  let t = raycast(g.solids, o, d, maxT), enemy = null;
  const normal = { ...RAY_NORMAL };
  for (const e of g.enemies) {
    if (e.dead || !e.active || e === ignore) continue;
    const te = rayBox(o, d, e.box, t);
    if (te < t) { t = te; enemy = e; }
  }
  return { t, enemy, normal };
}

export function losClear(g, a, b) {
  const d = v2.subVectors(b, a), len = d.length();
  if (len < 0.01) return true;
  d.divideScalar(len);
  return raycast(g.solids, a, d, len) >= len - 0.05;
}

// Noise (gunfire, explosions) wakes sleepers that could hear it: in sight of the source, or very close through a wall.
// Without the sight test, shots in the lobby woke rooms behind walls and the floor above.
const HEAR_THROUGH_WALLS = 6, ear = new THREE.Vector3();
export function wakeNear(g, pos, radius) {
  for (const e of g.enemies) {
    if (!e.active || e.dead || e.state !== 'sleep') continue;
    const d = e.pos.distanceTo(pos);
    if (d < HEAR_THROUGH_WALLS || (d < radius && losClear(g, pos, ear.set(e.pos.x, e.pos.y + e.h * 0.8, e.pos.z)))) wake(g, e);
  }
}

export function hurtPlayer(g, dmg, from) {
  const p = g.player;
  if (p.dead || p.iframes > 0 || g.god) return;
  g.onHurt?.(dmg, from); // dev/playtest hook: from is the attacker's pos, a projectile's pos or a blast centre
  const absorbed = Math.min(p.armor, dmg / 3); // armor soaks a third
  p.armor -= absorbed;
  p.health -= dmg - absorbed;
  styleHurt(g.style, dmg);
  g.shake += Math.min(0.5, dmg * 0.015);
  const dx = from.x - p.pos.x, dz = from.z - p.pos.z;
  const fwd = -dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw), right = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
  g.hud.hurt(Math.atan2(right, fwd), dmg);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    g.audio.play('death');
  } else g.audio.play('hurt');
}

// src: 'player' or the enemy/prop that did it (an enemy source sets off infighting).
// opts: { from: Vector3 the attack came from, explosive, pierce (ignores shields), painMul, knock (m/s) }.
export function damageEnemy(g, e, dmg, src, weapon = null, opts = {}) {
  if (e.dead || !e.active) return;
  if (src === 'player') dmg *= 1 + 0.06 * rankOf(g.style);
  if (e.def.onDamage) dmg = e.def.onDamage(g, e, dmg, src, weapon, opts);
  if (dmg <= 0) return;
  e.hp -= dmg;
  e.flash = 0.08;
  if (src === 'player') g.hud.hitMarker?.(e.hp <= 0);
  const at = v1.set(e.pos.x, e.pos.y + e.h * 0.6, e.pos.z);
  g.fx.burst(at, e.def.blood, Math.min(24, 4 + dmg / 4), 4);
  if (!e.def.prop && Math.random() < 0.5) g.fx.splat?.(at, e.def.blood, g.solids);
  if (opts.knock && !e.def.boss) {
    const from = opts.from ?? g.player.pos;
    v2.set(e.pos.x - from.x, 0, e.pos.z - from.z).normalize();
    moveBody(e, v2.x * opts.knock * 0.05, 0, v2.z * opts.knock * 0.05, g.solids);
  }
  if (src !== 'player' && src !== e && !src.dead && !src.def.prop) e.target = src;
  else if (src === 'player') e.target = null;
  if (e.state === 'sleep') wake(g, e);
  if (e.hp <= 0) return killEnemy(g, e, src, weapon, opts);
  // Stagger: dropped low but alive → frozen and flickering, ripe for a Termination.
  if (!e.staggered && !e.def.boss && !e.def.prop && e.hp <= e.def.hp * 0.25 && e.hp <= 60) {
    e.staggered = true;
    e.staggerT = STAGGER_T;
    g.audio.play('stagger', e.pos);
    return;
  }
  if (Math.random() < e.def.pain * (opts.painMul ?? 1) && e.chargeT <= 0) {
    e.painT = 0.25;
    e.tellT = 0;
    g.audio.play('pain_' + e.type, e.pos);
  }
}

function killEnemy(g, e, src, weapon, opts) {
  const p = g.player;
  e.dead = true;
  const pos = v1.set(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z).clone();
  if (e.def.prop) {
    e.root.visible = false;
    e.def.onDeath?.(g, e, src, opts);
    return;
  }
  g.stats.kills++;
  if (e.def.fly || e.def.boss || e.hp < -15 - e.def.hp * 0.4 || (opts.explosive && e.hp < -10)) {
    e.gibbed = true;
    e.root.visible = false;
    g.fx.gibs(pos, [e.def.blood, e.def.body, 0xa02838]);
    g.audio.play('gib', e.pos);
    g.shake += 0.1;
    g.hitstop = Math.max(g.hitstop, 0.04);
  } else g.audio.play('die_' + e.type, e.pos);
  for (const m of e.mats) m.emissive.setHex(0);
  e._emissive = 0;
  e.def.onDeath?.(g, e, src, opts);
  if (src === e || opts.noStyle) return; // blew itself up (or was caught in that blast): no style for you

  const byPlayer = src === 'player', floor = pos.y - raycast(g.solids, pos, down, 40);
  const terminated = byPlayer && weapon === 'axe' && e.staggerT > 0;
  const dash = byPlayer && g.time - p.lastDash < DASH_KILL_WINDOW;
  const w = byPlayer ? weapon : 'infight';
  const rankBefore = rankOf(g.style);
  g.hud.bonus(styleKill(g.style, w, !p.onGround, g.time, { terminated, dash }));
  g.score += Math.round(g.style.lastGain * 10 * (1 + rankBefore));
  g.hud.grin();
  if (terminated) {
    // Termination: the axe finisher. Heal, i-frames, freeze-frame.
    if (p.health < 100) p.health = Math.min(100, p.health + 20);
    p.iframes = Math.max(p.iframes, 0.5);
    g.hitstop = Math.max(g.hitstop, 0.12);
    g.shake += 0.3;
    g.audio.play('terminate');
    g.hud.terminate?.();
  }
  if (byPlayer && weapon === 'axe') addPickup(g, 'pack', pos.x, floor + 0.35, pos.z);
  // The twist: style rank keeps you alive.
  const rank = rankOf(g.style);
  if (rank >= MANAGER) addPickup(g, 'mint', pos.x - 0.3, floor + 0.35, pos.z);
  if (rank >= VP) addPickup(g, 'shard', pos.x + 0.3, floor + 0.35, pos.z);
}

// Explosion damage + shove. owner: 'player' or the enemy/prop responsible (owner itself is spared unless it's a prop).
// opts: { color, selfScale (player's own blast damage multiplier), knock (player shove), weapon, noStyle (kills earn nothing) }.
export function blast(g, pos, R, dmg, owner, { color = 0xff8a20, selfScale = 1, knock = 22, weapon = 'launcher', noStyle = false } = {}) {
  const p = g.player;
  g.fx.explosion(pos, R * 0.8, color);
  g.fx.decal?.(pos.clone(), { x: 0, y: 1, z: 0 }, 'scorch', R * 0.5);
  g.audio.play('explode', pos);
  g.boom.position.copy(pos);
  g.boom.intensity = 40;
  g.shake += Math.max(0, 0.6 - pos.distanceTo(p.pos) * 0.03);
  wakeNear(g, pos, 25);
  for (const b of [p, ...g.enemies]) {
    if (b.dead || b.active === false || b === owner) continue;
    const dist = boxDist(pos, b.box);
    if (dist >= R || !losClear(g, pos, v1.set(b.pos.x, b.pos.y + b.h * 0.5, b.pos.z))) continue;
    const k = 1 - dist / R;
    if (b === p) {
      // Rocket jump: shove away from the blast.
      p.vel.add(v1.set(p.pos.x, p.pos.y + p.h * 0.5, p.pos.z).sub(pos).normalize().multiplyScalar(knock * k));
      hurtPlayer(g, dmg * k * selfScale, pos);
    } else damageEnemy(g, b, dmg * k, owner, weapon, { explosive: true, from: pos, pierce: true, noStyle });
  }
}

export { registerProjectiles }; // re-exported for type modules; the table lives in projectiles.js (no imports, so no cycle)

export function spawnProjectile(g, kind, pos, vel, owner) {
  const P = PROJ[kind], mesh = new THREE.Group();
  for (const [w, h, d, color, glow] of P.parts) {
    const m = new THREE.Mesh(cube, new THREE.MeshLambertMaterial({ color, emissive: glow ? color : 0, transparent: kind === 'stapler' && w > 0.2, opacity: 0.5 }));
    m.scale.set(w, h, d);
    mesh.add(m);
  }
  mesh.position.copy(pos);
  g.scene.add(mesh);
  const pr = { kind, ...P, pos: pos.clone(), vel, owner, life: 6, mesh };
  g.projectiles.push(pr);
  return pr;
}

function updateProjectiles(g, dt) {
  const p = g.player;
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i];
    pr.vel.y -= pr.gravity * dt;
    pr.life -= dt;
    pr.update?.(g, pr, dt);
    const len = pr.vel.length() * dt;
    const d = v2.copy(pr.vel).normalize();
    let t = raycast(g.solids, pr.pos, d, len), body = null;
    const normal = { ...RAY_NORMAL };
    const bodies = pr.owner === 'player' ? g.enemies : [p, ...g.enemies];
    for (const b of bodies) {
      if (b === pr.owner || b.dead || b.active === false) continue;
      const bx = b.box, r = pr.radius;
      const tb = rayBox(pr.pos, d, { x0: bx.x0 - r, y0: bx.y0 - r, z0: bx.z0 - r, x1: bx.x1 + r, y1: bx.y1 + r, z1: bx.z1 + r }, t);
      if (tb < t) { t = tb; body = b; }
    }
    pr.mesh.lookAt(v1.copy(pr.pos).add(d));
    if (t >= len && pr.life > 0) {
      pr.pos.addScaledVector(d, len);
      pr.mesh.position.copy(pr.pos);
      if (pr.trail && Math.random() < 0.5) g.fx.burst(pr.pos, pr.trail, 1, 0.5, 0.06, 0.2);
      else if (pr.kind === 'stapler' && Math.random() < 0.5) g.fx.burst(pr.pos, 0xff8020, 1, 0.5, 0.06, 0.2);
      continue;
    }
    pr.pos.addScaledVector(d, Math.max(0, t - 0.1));
    g.scene.remove(pr.mesh);
    g.projectiles.splice(i, 1);
    if (pr.onHit?.(g, pr, body)) continue;
    if (pr.splash) explode(g, pr);
    else if (body === p) hurtPlayer(g, pr.dmg, pr.pos);
    else if (body) damageEnemy(g, body, pr.dmg, pr.owner, null, { from: pr.pos });
    else {
      g.fx.burst(pr.pos, 0xff8020, 6, 3, 0.06, 0.3);
      g.fx.decal?.(pr.pos.clone(), normal, 'scorch', 0.4);
      g.audio.play('splat', pr.pos);
    }
  }
}

function explode(g, pr) {
  if (pr.kind === 'toner') return blast(g, pr.pos, pr.splash, pr.dmg, pr.owner, { selfScale: pr.owner === 'player' ? 0.35 : 1 });
  // Ink: a smaller, violet, non-shoving splash. Printers shrug off their own ink.
  g.fx.explosion(pr.pos, pr.splash * 0.8, 0x401870);
  g.audio.play('ink', pr.pos);
  const p = g.player;
  for (const b of [p, ...g.enemies]) {
    if (b.dead || b.active === false || b === pr.owner) continue;
    const dist = boxDist(pr.pos, b.box);
    if (dist >= pr.splash || !losClear(g, pr.pos, v1.set(b.pos.x, b.pos.y + b.h * 0.5, b.pos.z))) continue;
    const k = 1 - dist / pr.splash;
    if (b === p) {
      p.vel.add(v1.set(p.pos.x, p.pos.y + p.h * 0.5, p.pos.z).sub(pr.pos).normalize().multiplyScalar(6 * k));
      hurtPlayer(g, pr.dmg * k, pr.pos);
    } else damageEnemy(g, b, pr.dmg * k, pr.owner, null, { from: pr.pos });
  }
}

// Bodies push each other apart so crowds don't stack. Props (drums) never move.
function separate(g) {
  const list = [g.player, ...g.enemies.filter((e) => e.active && !e.dead)];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.dead || a.box.y1 <= b.box.y0 || b.box.y1 <= a.box.y0) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, min = a.r + b.r, d = Math.hypot(dx, dz);
      if (d >= min) continue;
      const pa = a.def?.prop, pb = b.def?.prop;
      if (pa && pb) continue;
      const push = (min - d) / (pa || pb ? 1 : 2), nx = d > 0.01 ? dx / d : 1, nz = d > 0.01 ? dz / d : 0;
      if (!pa) moveBody(a, -nx * push, 0, -nz * push, g.solids);
      if (!pb) moveBody(b, nx * push, 0, nz * push, g.solids);
    }
  }
}

// ── pickups ───────────────────────────────────────────────────────────────────────────

const LOOK = {
  coffee: [[0.22, 0.3, 0.22, 0xf0ece0], [0.24, 0.05, 0.24, 0x5a3010, 0, 0.17]],
  donut: [[0.6, 0.15, 0.45, 0xf080b0], [0.5, 0.02, 0.35, 0xffffff, 0, 0.08]],
  espresso: [[0.3, 0.3, 0.3, 0xffd040], [0.36, 0.06, 0.36, 0x3a1a08, 0, 0.18]],
  kevlar: [[0.6, 0.7, 0.25, 0x2050c0], [0.62, 0.1, 0.27, 0x101830, 0, 0.1]],
  shard: [[0.18, 0.3, 0.18, 0x40a0ff]],
  mint: [[0.2, 0.2, 0.2, 0x40ff80]],
  pack: [[0.3, 0.2, 0.3, 0xffd030], [0.32, 0.05, 0.32, 0xb01818, 0, 0.05]],
  shells: [[0.45, 0.25, 0.28, 0xb01818], [0.46, 0.06, 0.29, 0xd0a020, 0, -0.08]],
  staples: [[0.4, 0.2, 0.25, 0x8a8a96], [0.41, 0.06, 0.26, 0x8a1a1a, 0, 0.06]],
  toner: [[0.45, 0.25, 0.25, 0x151515], [0.46, 0.08, 0.26, 0xc01880]],
  cells: [[0.25, 0.35, 0.25, 0x30303a], [0.26, 0.1, 0.26, 0xff3030, 0, 0.1]],
  ssg: [[0.18, 0.14, 0.8, 0x222226], [0.12, 0.16, 0.35, 0x6a3418, 0, -0.02]],
  stapler: [[0.18, 0.2, 0.75, 0x8a1a1a], [0.16, 0.08, 0.8, 0x3a3a44, 0, 0.12]],
  launcher: [[0.25, 0.22, 0.7, 0xd8d0b8], [0.26, 0.05, 0.3, 0xc01880, 0, 0.1]],
  laser: [[0.12, 0.12, 0.7, 0xb0b0b8], [0.08, 0.08, 0.08, 0xff2020, 0, 0.08]],
  key: [[0.4, 0.26, 0.04, 0xff1010], [0.15, 0.15, 0.05, 0xffffff, -0.08, 0]],
};
const PICKUP_SOUND = { coffee: 'pickup_health', donut: 'pickup_health', espresso: 'pickup_health', mint: 'pickup_health', kevlar: 'pickup_armor', shard: 'pickup_armor', shells: 'pickup_ammo', staples: 'pickup_ammo', toner: 'pickup_ammo', cells: 'pickup_ammo', pack: 'pickup_ammo' };
const AMMO_PICK = { shells: 8, staples: 40, toner: 4, cells: 5 };
// Ammo that comes with a weapon pickup.
const WEAPON_AMMO = { ssg: 8, stapler: 60, launcher: 10, laser: 10 };

export function addPickup(g, kind, x, y, z) {
  const mesh = new THREE.Group();
  for (const [w, h, d, color, ox = 0, oy = 0] of LOOK[kind]) {
    const m = new THREE.Mesh(cube, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
    m.scale.set(w, h, d);
    m.position.set(ox, oy, 0);
    mesh.add(m);
  }
  mesh.position.set(x, y, z);
  g.scene.add(mesh);
  const pu = { kind, x, y, z, mesh, phase: Math.random() * 6 };
  g.pickups.push(pu);
  return pu;
}

const heal = (p, n, max) => p.health < max && (p.health = Math.min(max, p.health + n), true);
const armor = (p, n) => p.armor < 100 && (p.armor = Math.min(100, p.armor + n), true);
const ammo = (p, type, n) => p.ammo[type] < AMMO_MAX[type] && (p.ammo[type] = Math.min(AMMO_MAX[type], p.ammo[type] + n), true);

function take(g, kind) {
  const p = g.player;
  switch (kind) {
    case 'coffee': return heal(p, 10, 100) && 'COFFEE +10';
    case 'donut': return heal(p, 25, 100) && 'DONUT BOX +25';
    case 'espresso': return heal(p, 100, 200) && 'ESPRESSO! +100';
    case 'mint': return heal(p, 5, 100) && 'BREATH MINT +5';
    case 'kevlar': return armor(p, 50) && 'KEVLAR VEST';
    case 'shard': return armor(p, 5) && 'ARMOR SHARD';
    case 'pack': {
      // Axe-kill ammo pack: a bit of everything you own.
      const got = [ammo(p, 'shells', 4), p.owned.stapler && ammo(p, 'staples', 20), p.owned.launcher && ammo(p, 'toner', 1), p.owned.laser && ammo(p, 'cells', 2)];
      return got.some(Boolean) && 'SEVERANCE PAY';
    }
    case 'key':
      p.hasKey = true;
      if (g.level.keyAmbush) ambush(g, g.level.keyAmbush);
      return 'RED KEYCARD';
  }
  if (AMMO_PICK[kind]) return ammo(p, kind, AMMO_PICK[kind]) && kind.toUpperCase();
  if (WEAPONS[kind]) {
    const W = WEAPONS[kind], had = p.owned[kind];
    p.owned[kind] = true;
    const got = ammo(p, W.ammo, WEAPON_AMMO[kind] ?? 0);
    if (had && !got) return false;
    if (!had) selectWeapon(p, kind);
    return had ? W.ammo.toUpperCase() : `${W.name}! [${W.slot}]`;
  }
}

function updatePickups(g, dt) {
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pu = g.pickups[i];
    pu.phase += dt * 3;
    pu.mesh.rotation.y = pu.phase * 0.7;
    pu.mesh.position.y = pu.y + Math.sin(pu.phase) * 0.08;
    if (p.dead || Math.hypot(p.pos.x - pu.x, p.pos.z - pu.z) > 1.2 || pu.y < p.pos.y - 0.5 || pu.y > p.pos.y + p.h + 0.5) continue;
    const label = take(g, pu.kind);
    if (!label) continue;
    g.scene.remove(pu.mesh);
    g.pickups.splice(i, 1);
    g.audio.play(WEAPONS[pu.kind] && label.includes('!') ? 'weapon' : pu.kind === 'key' ? 'key' : PICKUP_SOUND[pu.kind] ?? 'pickup');
    g.hud.msg(label, 1.5);
    g.hud.pickupFlash();
  }
}

// ── doors, lifts, triggers, arenas ────────────────────────────────────────────────────

function updateDoors(g, dt) {
  const p = g.player;
  for (const d of g.doors) {
    const near = Math.hypot(p.pos.x - d.cx, p.pos.z - d.cz) < (d.secret ? 1.4 : 3.5) && p.pos.y > d.base.y0 - 1 && p.pos.y < d.base.y1;
    let want = near && (!d.key || p.hasKey) && !d.locked;
    if (near && d.key && !p.hasKey && g.lockedT <= 0) {
      g.hud.msg('RED KEYCARD REQUIRED', 2);
      g.audio.play('locked');
      g.lockedT = 2;
    }
    if (!want && !d.key && !d.secret && !d.locked) want = g.enemies.some((e) => e.active && !e.dead && e.state !== 'sleep' && !e.def.prop && Math.hypot(e.pos.x - d.cx, e.pos.z - d.cz) < 2.5);
    const blocked = [p, ...g.enemies].some((b) => !b.dead && b.box.x1 > d.base.x0 && b.box.x0 < d.base.x1 && b.box.z1 > d.base.z0 && b.box.z0 < d.base.z1 && b.box.y1 > d.base.y0 && b.box.y0 < d.base.y1);
    if (want || blocked) d.hold = d.locked ? 0.01 : 2;
    else d.hold -= dt;
    const target = d.hold > 0 ? 1 : 0;
    if (target && d.open === 0) g.audio.play('door', v1.set(d.cx, d.base.y0 + 1, d.cz));
    d.open = target ? Math.min(1, d.open + dt * 4) : Math.max(0, d.open - dt * (d.locked ? 4 : 1.5));
    const off = d.open * d.h * 0.95;
    d.box.y0 = d.base.y0 + off;
    d.box.y1 = d.base.y1 + off;
    for (const m of d.meshes) m.position.y = m.userData.baseY + off;
  }
}

function updateLift(g, L, dt) {
  const p = g.player, b = L.box;
  const riding = p.onGround && Math.abs(p.pos.y - b.y1) < 0.05 && p.pos.x > b.x0 && p.pos.x < b.x1 && p.pos.z > b.z0 && p.pos.z < b.z1;
  if (riding && !L.moving && b.y1 < L.target) {
    L.moving = true;
    g.audio.play('lift');
  }
  if (!L.moving || b.y1 >= L.target) return;
  const dy = Math.min(4 * dt, L.target - b.y1);
  b.y0 += dy;
  b.y1 += dy;
  L.mesh.position.y += dy;
  if (riding || (p.pos.y < b.y1 && p.pos.y > b.y0 - p.h && p.pos.x > b.x0 && p.pos.x < b.x1 && p.pos.z > b.z0 && p.pos.z < b.z1)) p.pos.y = b.y1 + 0.001;
}

// Wake a group of inactive enemies with a burst of hellfire. Returns how many appeared.
export function ambush(g, group) {
  let n = 0;
  for (const e of g.enemies) {
    if (e.group !== group || e.active) continue;
    e.active = true;
    e.root.visible = true;
    wake(g, e);
    g.fx.burst(v1.set(e.pos.x, e.pos.y + e.h / 2, e.pos.z), 0xff2040, 20, 6, 0.12, 0.7);
    g.audio.play('spawn', e.pos);
    n++;
  }
  return n;
}

const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1;

function updateTriggers(g) {
  const p = g.player, x = p.pos.x, y = p.pos.y + 0.5, z = p.pos.z;
  for (const t of g.triggers) {
    if (t.fired || !inBox(t.box, x, y, z)) continue;
    if (t.needKey && !p.hasKey) continue;
    t.fired = true;
    if (t.kind === 'secret') {
      g.stats.secrets++;
      g.audio.play('secret');
      g.hud.msg(`SECRET FOUND! ${g.stats.secrets}/${g.stats.secretsTotal}`, 3);
    } else if (t.kind === 'ambush') ambush(g, t.arg);
    else if (t.kind === 'exit') g.exited = true;
    else if (t.kind === 'script') g.level.onTrigger?.(g, t.arg);
  }
}

function updateArenas(g) {
  const p = g.player;
  for (const a of g.arenas) {
    if (a.state === 'idle' && inBox(a.box, p.pos.x, p.pos.y + 0.5, p.pos.z)) {
      a.state = 'active';
      for (const d of a.doors) d.locked = true;
      g.audio.play('lockdown');
      g.hud.banner?.('LOCKDOWN');
      a.wave = -1;
    }
    if (a.state !== 'active') continue;
    const cur = a.waves[a.wave];
    if (a.wave >= 0 && g.enemies.some((e) => e.group === cur && !e.dead)) continue;
    if (++a.wave < a.waves.length) ambush(g, a.waves[a.wave]);
    else {
      a.state = 'done';
      for (const d of a.doors) d.locked = false;
      g.audio.play('clear');
      g.hud.banner?.('AREA CLEAR');
    }
  }
}
