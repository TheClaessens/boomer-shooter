import * as THREE from 'three';
import { moveBody, updateBox, boxDist } from './physics.js';
import { hurtPlayer, damageEnemy, spawnProjectile, hitscan, losClear } from './world.js';

const G = 28;
// Each enemy teaches one skill. keep: preferred distance; cd: seconds between attacks; tell: wind-up before the attack.
export const TYPES = {
  intern: { hp: 20, speed: 4.5, r: 0.35, h: 1.8, range: 30, keep: 7, cd: [1.4, 2.6], tell: 0.45, pain: 0.8, blood: 0x9a0a0a, body: 0xe8e8e0 },
  manager: { hp: 50, speed: 3.8, r: 0.4, h: 1.95, range: 35, keep: 9, cd: [1.6, 2.8], tell: 0.55, pain: 0.5, blood: 0x9a0a0a, body: 0x4a4a55 },
  brute: { hp: 160, speed: 4.2, r: 0.75, h: 2.3, range: 18, keep: 0, cd: [1.0, 1.8], tell: 0.5, pain: 0.15, blood: 0x7a1010, body: 0x6b4a2a },
  printer: { hp: 110, speed: 3.2, r: 0.65, h: 1.1, range: 30, keep: 8, cd: [1.8, 3.0], tell: 0.6, pain: 0.3, blood: 0x201040, body: 0xc8c0a8, fly: true },
};

const cube = new THREE.BoxGeometry(1, 1, 1);
const rand = ([a, b]) => a + Math.random() * (b - a);
const v = new THREE.Vector3(), dir = new THREE.Vector3(), muzzle = new THREE.Vector3();

// Low-poly bodies from boxes, facing +z, origin at the feet.
function buildMesh(type) {
  const root = new THREE.Group(), mats = [];
  const part = (parent, w, h, d, color, x, y, z, glow = false) => {
    const m = new THREE.MeshLambertMaterial({ color, emissive: glow ? color : 0 });
    if (!glow) mats.push(m);
    const mesh = new THREE.Mesh(cube, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    root.add(g);
    return g;
  };
  const legs = [], arms = [];
  if (type === 'printer') {
    part(root, 1.2, 0.8, 1.0, 0xc8c0a8, 0, 0.55, 0);
    part(root, 1.25, 0.12, 1.05, 0x8a8478, 0, 0.2, 0);
    part(root, 0.9, 0.08, 0.02, 0x101010, 0, 0.6, 0.51);
    part(root, 0.3, 0.18, 0.05, 0xff2010, 0, 0.82, 0.5, true);
    const tongue = pivot(0, 0.55, 0.5);
    part(tongue, 0.7, 0.02, 0.6, 0xf4f0e8, 0, 0, 0.3);
    part(tongue, 0.2, 0.03, 0.2, 0x201040, 0.1, 0.01, 0.4);
    arms.push(tongue);
  } else {
    const big = type === 'brute', mgr = type === 'manager';
    const hip = big ? 1.0 : 0.85, w = big ? 1.2 : mgr ? 0.6 : 0.5;
    const pants = big ? 0x4a3020 : mgr ? 0x3a3a44 : 0x2b2b33;
    for (const s of [-1, 1]) {
      const l = pivot(s * w * 0.25, hip, 0);
      part(l, big ? 0.35 : 0.16, hip, big ? 0.35 : 0.18, pants, 0, -hip / 2, 0);
      legs.push(l);
    }
    const torsoH = big ? 1.0 : 0.6;
    part(root, w, torsoH, big ? 0.7 : 0.28, TYPES[type].body, 0, hip + torsoH / 2, 0);
    const headY = hip + torsoH + (big ? 0.2 : 0.17);
    part(root, big ? 0.4 : 0.32, 0.34, 0.3, big ? 0xb08060 : mgr ? 0xc8b8a0 : 0x9fb08a, 0, headY, 0);
    for (const s of [-1, 1]) part(root, 0.07, 0.05, 0.02, 0xff2010, s * 0.08, headY + 0.04, 0.16, true);
    if (type === 'intern') part(root, 0.08, 0.4, 0.02, 0xa01010, 0, hip + 0.35, 0.15);
    if (mgr) for (const s of [-1, 1]) part(root, 0.06, 0.14, 0.06, 0x801010, s * 0.12, headY + 0.22, 0);
    if (big) { part(root, 0.5, 0.12, 0.42, 0x3060a0, 0, headY + 0.2, 0.02); part(root, 0.5, 0.4, 0.1, 0xa02838, -0.2, hip + 0.6, 0.36); }
    const armW = big ? 0.35 : 0.12, armL = big ? 1.0 : 0.55, sh = hip + torsoH - 0.05;
    for (const s of big ? [-1, 1] : [1]) {
      const a = pivot(s * (w / 2 + armW / 2 + 0.02), sh, 0);
      part(a, armW, armL, armW, TYPES[type].body, 0, -armL / 2, 0);
      if (!big) part(a, 0.09, 0.1, 0.26, mgr ? 0xd04010 : 0x181818, 0, -armL, 0.08);
      arms.push(a);
    }
    if (!big) part(root, 0.12, 0.55, 0.14, TYPES[type].body, -(w / 2 + 0.08), sh - 0.27, 0);
  }
  return { root, mats, legs, arms };
}

export function spawnEnemy(g, type, x, y, z, group) {
  const def = TYPES[type];
  const m = buildMesh(type);
  g.scene.add(m.root);
  const e = {
    type, def, pos: new THREE.Vector3(x, y, z), vy: 0, r: def.r, h: def.h, box: {}, hp: def.hp,
    state: 'sleep', target: null, yaw: Math.random() * Math.PI * 2, cd: rand(def.cd), tellT: 0, painT: 0, chargeT: 0, melee: false,
    chargeDir: new THREE.Vector3(), strafeT: 0, strafeDir: 1, losT: Math.random() * 0.3, los: false, flash: 0,
    walk: Math.random() * 10, active: !group, group, dead: false, deadT: 0, ...m,
  };
  m.root.visible = e.active;
  updateBox(e);
  sync(e);
  return e;
}

export function wake(g, e) {
  if (e.state !== 'sleep') return;
  e.state = 'chase';
  e.cd = rand(e.def.cd) * 0.6;
  if (g.sightCD <= 0) {
    g.audio.play('sight_' + e.type, e.pos);
    g.sightCD = 0.15;
  }
}

function sync(e) {
  e.root.position.copy(e.pos);
  e.root.rotation.y = e.yaw;
  const hot = e.flash > 0;
  for (const m of e.mats) m.emissive.setHex(hot ? 0xffffff : 0);
}

const center = (b, out) => out.set(b.pos.x, b.pos.y + b.h * 0.5, b.pos.z);

function attack(g, e, tgt) {
  const p = g.player;
  center(tgt, v);
  muzzle.set(e.pos.x + Math.sin(e.yaw) * 0.5, e.pos.y + e.h * 0.72, e.pos.z + Math.cos(e.yaw) * 0.5);
  dir.subVectors(v, muzzle);
  const dist = dir.length();
  dir.divideScalar(dist);
  e.cd = rand(e.def.cd);
  if (e.type === 'intern') {
    g.audio.play('pistol', e.pos);
    if (tgt === p) {
      // A monster in the line of fire takes the bullet (and gets angry).
      const h = hitscan(g, muzzle, dir, dist, e);
      if (h.enemy) return void damageEnemy(g, h.enemy, 6, e);
      if (!losClear(g, muzzle, v)) return;
      // Never stand still: moving fast makes interns miss.
      const speed = Math.hypot(p.vel.x, p.vel.z);
      const chance = Math.max(0.08, Math.min(0.9, 0.85 - speed * 0.06 - dist * 0.02));
      if (Math.random() < chance) {
        hurtPlayer(g, 5 + Math.floor(Math.random() * 4), e.pos);
        g.fx.tracer(muzzle, v);
      } else g.fx.tracer(muzzle, v.clone().addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 1.5));
    } else {
      const h = hitscan(g, muzzle, dir, dist + 1, e);
      if (h.enemy) damageEnemy(g, h.enemy, 6, e);
      g.fx.tracer(muzzle, v);
    }
  } else if (e.type === 'manager') {
    g.audio.play('stapler', e.pos);
    spawnProjectile(g, 'stapler', muzzle, dir.clone().multiplyScalar(13), e);
  } else if (e.type === 'printer') {
    g.audio.play('ink', e.pos);
    spawnProjectile(g, 'ink', muzzle, dir.clone().multiplyScalar(9), e);
  } else if (e.melee) {
    if (boxDist(center(e, v), tgt.box) < e.r + 1.2) bruteHit(g, e, tgt);
  } else {
    e.chargeT = 1.2;
    e.chargeDir.set(dir.x, 0, dir.z).normalize();
  }
}

function bruteHit(g, e, tgt) {
  g.audio.play('punch', e.pos);
  e.chargeT = 0;
  e.cd = 1.5;
  if (tgt === g.player) {
    hurtPlayer(g, 25, e.pos);
    const p = g.player;
    v.set(p.pos.x - e.pos.x, 0, p.pos.z - e.pos.z).normalize();
    p.vel.x += v.x * 12;
    p.vel.z += v.z * 12;
    p.vel.y = 5;
    g.shake += 0.4;
  } else damageEnemy(g, tgt, 25, e);
}

export function updateEnemy(g, e, dt) {
  if (!e.active) return;
  if (e.dead) {
    if (e.deadT < 1) {
      e.deadT += dt;
      e.root.rotation.x = -Math.min(1, e.deadT * 4) * Math.PI / 2;
      e.root.position.y = e.pos.y + Math.min(1, e.deadT * 4) * 0.2;
    }
    return;
  }
  e.flash -= dt;
  const p = g.player;
  if (e.target?.dead) e.target = null;
  const tgt = e.target ?? p;
  const dx = tgt.pos.x - e.pos.x, dz = tgt.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.01;
  const ux = dx / dist, uz = dz / dist;

  e.losT -= dt;
  if (e.losT <= 0) {
    e.losT = 0.2 + Math.random() * 0.1;
    muzzle.set(e.pos.x, e.pos.y + e.h * 0.8, e.pos.z);
    e.los = !tgt.dead && losClear(g, muzzle, center(tgt, v));
  }

  if (e.state === 'sleep') {
    const facing = Math.sin(e.yaw) * ux + Math.cos(e.yaw) * uz;
    if (e.los && dist < 35 && (dist < 10 || facing > 0.2)) wake(g, e);
    sync(e);
    return;
  }

  let mx = 0, mz = 0;
  e.cd -= dt;
  e.painT -= dt;
  e.strafeT -= dt;
  if (!tgt.dead) e.yaw = e.chargeT > 0 ? Math.atan2(e.chargeDir.x, e.chargeDir.z) : Math.atan2(dx, dz);
  const raise = e.tellT > 0 || e.chargeT > 0;
  for (const a of e.arms) a.rotation.x += ((raise ? -Math.PI / 2 : 0) - a.rotation.x) * Math.min(1, dt * 12);

  if (tgt.dead || e.painT > 0) {
    // stand
  } else if (e.tellT > 0) {
    e.tellT -= dt;
    if (e.tellT <= 0) attack(g, e, tgt);
  } else if (e.chargeT > 0) {
    e.chargeT -= dt;
    mx = e.chargeDir.x * 13;
    mz = e.chargeDir.z * 13;
    if (boxDist(center(e, v), tgt.box) < e.r + 0.5) bruteHit(g, e, tgt);
  } else {
    if (e.cd <= 0 && e.los && dist < e.def.range) {
      if (e.type === 'brute') {
        e.melee = dist < 2.6;
        if (e.melee || dist > 3.5) e.tellT = e.melee ? 0.3 : e.def.tell;
        else e.cd = 0.3;
      } else e.tellT = e.def.tell;
      if (e.tellT > 0) g.audio.play('tell_' + e.type, e.pos);
    }
    if (e.tellT <= 0) {
      let fx = ux, fz = uz;
      if (dist < e.def.keep && e.los) {
        fx = fz = 0;
        if (e.strafeT <= 0) { e.strafeT = 0.8 + Math.random(); e.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      }
      if (e.strafeT > 0) {
        fx = fx * 0.3 - uz * e.strafeDir;
        fz = fz * 0.3 + ux * e.strafeDir;
        const l = Math.hypot(fx, fz);
        fx /= l; fz /= l;
      } else if (e.type !== 'brute' && Math.random() < dt * 0.3) {
        e.strafeT = 0.6;
        e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      mx = fx * e.def.speed;
      mz = fz * e.def.speed;
    }
  }

  if (e.def.fly) e.vy = Math.max(-3, Math.min(3, (tgt.pos.y + 3.2 - e.pos.y) * 1.5));
  else e.vy -= G * dt;
  const hit = moveBody(e, mx * dt, e.vy * dt, mz * dt, g.solids);
  if (hit.y && !e.def.fly) e.vy = 0;
  if (hit.x || hit.z) {
    if (e.chargeT > 0) {
      e.chargeT = 0;
      e.painT = 0.6; // ran into a wall: stunned
      g.audio.play('punch', e.pos);
    } else if (e.strafeT <= 0) {
      e.strafeT = 0.5 + Math.random() * 0.6;
      e.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
  }
  if (mx || mz) {
    e.walk += dt * (e.chargeT > 0 ? 18 : 10);
    for (let i = 0; i < e.legs.length; i++) e.legs[i].rotation.x = Math.sin(e.walk + i * Math.PI) * 0.6;
  }
  if (e.def.fly) e.arms[0].rotation.z = Math.sin(g.time * 8) * 0.2;
  sync(e);
}
