import * as THREE from 'three';
import { moveBody, updateBox, boxDist, raycast } from '../physics.js';
import { losClear } from '../world.js';
import { STAFF } from './staff.js';
import { CEO } from './ceo.js';

// Enemy registry + the generic AI every type shares (sleep → wake → chase/keep distance/strafe → tell → attack).
// Type modules supply numbers, a model and the attack; see ARCHITECTURE.md "Enemy types".
// Extra optional type fields used here: turn (rad/s yaw limit), retreat (back off inside keep), weave (zig-zag 0..1),
// jitter (strafe frequency multiplier), stride (walk-cycle speed), floats (hovers like fly, but crashes instead of gibbing),
// death ('back'|'crumple'|'topple'|'spin'|'crash'|'melt'), lie (corpse lift so it rests on the floor).
// Model extras read here: torso, head (pivots), swing (arms that only swing while walking; `arms` also raise on the tell).
export const TYPES = { ...STAFF, ...CEO };

const G = 28, RISE = 0.7;
export const rand = ([a, b]) => a + Math.random() * (b - a);
const v = new THREE.Vector3(), eyeV = new THREE.Vector3(), rayO = new THREE.Vector3(), rayD = new THREE.Vector3();
export const center = (b, out) => out.set(b.pos.x, b.pos.y + b.h * 0.5, b.pos.z);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, m) => Math.max(-m, Math.min(m, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (k) => 1 - (1 - k) * (1 - k);

export function spawnEnemy(g, type, x, y, z, group) {
  const def = TYPES[type];
  const m = def.build();
  g.scene.add(m.root);
  const e = {
    type, def, pos: new THREE.Vector3(x, y, z), vy: 0, r: def.r, h: def.h, box: {}, hp: def.hp,
    state: 'sleep', target: null, yaw: Math.random() * Math.PI * 2, cd: rand(def.cd ?? [1, 2]), tellT: 0, painT: 0, chargeT: 0, staggerT: 0, staggered: false,
    chargeDir: new THREE.Vector3(), strafeT: 0, strafeDir: 1, losT: Math.random() * 0.3, los: false, flash: 0,
    walk: Math.random() * 10, active: !group, group, dead: false, gibbed: false, deadT: 0,
    // Personality so a crowd doesn't move in lockstep.
    seed: Math.random() * 100, jit: 0.6 + Math.random() * 0.8, keepMul: 0.8 + Math.random() * 0.4,
    tilt: 0, riseT: 0, probeT: 0, ceil: Infinity, landed: false, swing: [], ...m,
  };
  m.root.visible = e.active;
  updateBox(e);
  sync(e, 0);
  return e;
}

export function wake(g, e) {
  if (e.state !== 'sleep' || e.def.prop) return;
  e.state = 'chase';
  e.cd = rand(e.def.cd) * 0.6;
  if (g.sightCD <= 0) {
    g.audio.play('sight_' + e.type, e.pos);
    g.sightCD = 0.15;
  }
}

// Bring a corpse back (Recruiter). Undoes the kill count so kill % stays honest. The body climbs back up over RISE s.
export function revive(g, e) {
  if (!e.dead || e.gibbed || e.def.prop) return false;
  const R = e.root;
  Object.assign(e, {
    dead: false, deadT: 0, hp: e.def.hp * 0.6, state: 'chase', staggered: false, staggerT: 0, tellT: 0, chargeT: 0, painT: 0, target: null,
    riseT: RISE, rx0: R.rotation.x, rz0: R.rotation.z, sy0: R.scale.y, sxz0: R.scale.x, landed: false, vy: 0, flash: 0,
  });
  for (const l of e.legs) l.rotation.x = 0;
  R.visible = true;
  R.position.copy(e.pos);
  g.stats.kills--;
  return true;
}

const REST = 0.2;
function sync(e, time) {
  e.root.position.copy(e.pos);
  e.root.rotation.x = e.tilt;
  e.root.rotation.y = e.yaw;
  // White hit flash; staggered enemies flicker orange so you know to go in with the axe.
  const hex = e.flash > 0 ? 0xffffff : e.staggerT > 0 && Math.sin(time * 30) > 0 ? 0xff6a00 : 0;
  if (e._emissive !== hex) {
    e._emissive = hex;
    // At rest a living enemy keeps a faint self-light (REST × its colour) so it never sinks into a dark room;
    // corpses go fully unlit (world.js), which also tells dead from alive at a glance.
    for (const m of e.mats) hex ? m.emissive.setHex(hex) : m.emissive.copy(m.color).multiplyScalar(REST);
  }
}

// Death animations: run while deadT < 3 (never for gibbed bodies).
const DEATH = {
  // Thrown flat on the back.
  back(g, e) {
    const k = ease(Math.min(1, e.deadT * 3.5));
    e.root.rotation.x = -k * Math.PI / 2;
    e.root.position.y = e.pos.y + k * (e.def.lie ?? 0.18);
  },
  // Knees buckle, then folds forward onto the face.
  crumple(g, e) {
    const a = Math.min(1, e.deadT * 5), b = Math.min(1, Math.max(0, e.deadT - 0.25) * 3.5);
    for (const l of e.legs) l.rotation.x = -a * 1.4 * (1 - b);
    e.root.rotation.x = b * b * Math.PI / 2;
    e.root.position.y = e.pos.y - a * 0.3 * (1 - b) + b * (e.def.lie ?? 0.18);
  },
  // Slow, heavy forward fall that lands with a thud.
  topple(g, e) {
    const k = Math.min(1, (e.deadT / 0.75) ** 2);
    e.root.rotation.x = k * Math.PI / 2;
    e.root.position.y = e.pos.y + k * (e.def.lie ?? 0.3);
    if (k === 1 && !e.landed) {
      e.landed = true;
      g.shake += Math.max(0, 0.3 - e.pos.distanceTo(g.player.pos) * 0.015);
      g.audio.play('punch', e.pos);
      g.fx.burst(v.set(e.pos.x + Math.sin(e.yaw) * 1.4, e.pos.y + 0.2, e.pos.z + Math.cos(e.yaw) * 1.4), 0x6a6050, 12, 3, 0.15, 0.6);
    }
  },
  // Spun round by the hit, drops on its side.
  spin(g, e) {
    const k = ease(Math.min(1, e.deadT * 2.2));
    e.root.rotation.y = e.yaw + k * 2.6;
    e.root.rotation.z = k * Math.PI / 2;
    e.root.position.y = e.pos.y + k * (e.def.lie ?? 0.16);
  },
  // Hovering machine: falls out of the air, slams down, sparks for a while.
  crash(g, e, dt) {
    if (!e.landed) {
      e.vy -= G * dt;
      const hit = moveBody(e, 0, e.vy * dt, 0, g.solids);
      if (hit.y || e.vy < -40) {
        e.landed = true;
        e.vy = 0;
        g.shake += Math.max(0, 0.35 - e.pos.distanceTo(g.player.pos) * 0.015);
        g.audio.play('punch', e.pos);
        g.fx.burst(v.set(e.pos.x, e.pos.y + 0.4, e.pos.z), 0xfff0a0, 16, 6, 0.08, 0.5);
        g.fx.burst(v, 0x2a2a2a, 8, 2, 0.22, 1.0);
      }
    }
    const k = Math.min(1, e.deadT * 2);
    e.root.position.copy(e.pos);
    e.root.rotation.x = k * 0.25;
    e.root.rotation.z = k * 0.35;
    if (e.landed && Math.random() < dt * 9) {
      v.set(e.pos.x + (Math.random() - 0.5) * 0.9, e.pos.y + 0.9, e.pos.z + (Math.random() - 0.5) * 0.9);
      g.fx.burst(v, Math.random() < 0.7 ? 0xfff0a0 : 0x60a0ff, 3, 3, 0.05, 0.35);
    }
  },
  // Sinks into a puddle of itself.
  melt(g, e, dt) {
    const k = Math.min(1, e.deadT * 1.6);
    e.root.scale.set(1 + k * 0.5, 1 - k * 0.85, 1 + k * 0.5);
    if (k < 1 && Math.random() < dt * 25) g.fx.burst(v.set(e.pos.x, e.pos.y + e.h * (1 - k) * 0.8, e.pos.z), 0xb050ff, 2, 2.5, 0.08, 0.5);
  },
};

// How far a body can walk sideways (x,z) before hitting something.
function probe(g, e, x, z) {
  rayO.set(e.pos.x, e.pos.y + 0.4, e.pos.z);
  rayD.set(x, 0, z);
  return raycast(g.solids, rayO, rayD, 3);
}

const swingOf = (e, a) => Math.sin(e.walk + (a.userData.side < 0 ? Math.PI : 0)) * 0.5;

export function updateEnemy(g, e, dt) {
  if (!e.active) return;
  const def = e.def;
  if (e.dead) {
    if (e.deadT < 3 && !e.gibbed && !def.prop) {
      e.deadT += dt;
      (DEATH[def.death] ?? DEATH.back)(g, e, dt);
    }
    return;
  }
  e.flash -= dt;
  if (def.prop) return void sync(e, g.time);
  const flies = def.fly || def.floats;

  // Revived: climb back up out of the death pose before doing anything.
  if (e.riseT > 0) {
    e.riseT -= dt;
    const k = Math.max(0, e.riseT / RISE);
    e.tilt = e.rx0 * k;
    e.root.rotation.z = e.rz0 * k;
    e.root.scale.set(lerp(1, e.sxz0, k), lerp(1, e.sy0, k), lerp(1, e.sxz0, k));
    if (flies) moveBody(e, 0, 2 * dt, 0, g.solids);
    return void sync(e, g.time);
  }

  const p = g.player;
  if (e.target?.dead) e.target = null;
  const tgt = e.target ?? p;
  const dx = tgt.pos.x - e.pos.x, dz = tgt.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.01;
  const ux = dx / dist, uz = dz / dist;

  e.losT -= dt;
  if (e.losT <= 0) {
    e.losT = 0.2 + Math.random() * 0.1;
    eyeV.set(e.pos.x, e.pos.y + e.h * 0.8, e.pos.z);
    e.los = !tgt.dead && losClear(g, eyeV, center(tgt, v));
    if (flies) {
      // Flyers hover under the ceiling, not in it.
      rayO.set(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z);
      rayD.set(0, 1, 0);
      e.ceil = e.pos.y + e.h * 0.5 + raycast(g.solids, rayO, rayD, 12) - e.h - 0.3;
    }
  }

  if (e.state === 'sleep') {
    const facing = Math.sin(e.yaw) * ux + Math.cos(e.yaw) * uz;
    if (e.los && dist < 35 && (dist < 10 || facing > 0.2)) wake(g, e);
    def.animate?.(g, e, dt);
    sync(e, g.time);
    return;
  }

  if (e.staggerT > 0) {
    // Frozen, slumped and flickering: free Termination.
    e.staggerT -= dt;
    e.tellT = e.chargeT = 0;
    e.vy -= flies ? 0 : G * dt;
    const hit = moveBody(e, 0, flies ? -0.5 * dt : e.vy * dt, 0, g.solids);
    if (hit.y) e.vy = 0;
    const k = Math.min(1, dt * 8);
    e.tilt = lerp(e.tilt, 0.28 + Math.sin(g.time * 7 + e.seed) * 0.06, k);
    for (const a of e.arms) a.rotation.x = lerp(a.rotation.x, 0.15, k);
    for (const a of e.swing) a.rotation.x = lerp(a.rotation.x, 0.15, k);
    if (e.head) e.head.rotation.x = lerp(e.head.rotation.x, 0.55, k);
    def.animate?.(g, e, dt);
    sync(e, g.time);
    return;
  }

  if (def.think?.(g, e, dt, tgt, dist)) {
    def.animate?.(g, e, dt);
    return void sync(e, g.time);
  }

  let mx = 0, mz = 0;
  e.cd -= dt;
  e.painT -= dt;
  e.strafeT -= dt;
  e.probeT -= dt;
  if (!tgt.dead) {
    const want = e.chargeT > 0 ? Math.atan2(e.chargeDir.x, e.chargeDir.z) : Math.atan2(dx, dz);
    // turn: slow turners (shields) can be flanked.
    e.yaw = def.turn && e.chargeT <= 0 ? wrap(e.yaw + clamp(wrap(want - e.yaw), def.turn * dt)) : want;
  }

  if (tgt.dead || e.painT > 0) {
    // stand
  } else if (e.tellT > 0) {
    e.tellT -= dt;
    if (e.tellT <= 0) {
      e.cd = rand(def.cd);
      def.attack(g, e, tgt, dist);
    }
  } else if (e.chargeT > 0) {
    e.chargeT -= dt;
    mx = e.chargeDir.x * (def.chargeSpeed ?? 13);
    mz = e.chargeDir.z * (def.chargeSpeed ?? 13);
    if (boxDist(center(e, v), tgt.box) < e.r + 0.5) {
      e.chargeT = 0;
      def.onChargeHit?.(g, e, tgt);
    }
  } else {
    if (e.cd <= 0 && e.los && dist < def.range) {
      // startTell: a type can pick its own wind-up (or 0 to hold off); default is its tell time.
      e.tellT = def.startTell ? def.startTell(g, e, tgt, dist) : def.tell;
      if (e.tellT > 0) g.audio.play('tell_' + e.type, e.pos);
    }
    if (e.tellT <= 0) {
      let fx = ux, fz = uz;
      const keep = def.keep * e.keepMul;
      if (dist < keep && e.los) {
        if (def.retreat && dist < keep * 0.8) { fx = -ux; fz = -uz; } else fx = fz = 0;
        if (e.strafeT <= 0) { e.strafeT = (0.5 + Math.random()) * e.jit; e.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      }
      if (def.weave) {
        const w = Math.sin(g.time * 7 + e.seed) * def.weave;
        fx -= uz * w;
        fz += ux * w;
      }
      if (e.strafeT > 0) {
        fx = fx * 0.3 - uz * e.strafeDir;
        fz = fz * 0.3 + ux * e.strafeDir;
      } else if (def.strafes !== false && Math.random() < dt * 0.3 * e.jit * (def.jitter ?? 1)) {
        e.strafeT = 0.3 + 0.4 * e.jit;
        e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      const l = Math.hypot(fx, fz);
      if (l > 0.01) {
        mx = (fx / l) * def.speed;
        mz = (fz / l) * def.speed;
      }
    }
  }

  if (flies) e.vy = Math.max(-3, Math.min(3, (Math.min(tgt.pos.y + (def.hover ?? 3.2), e.ceil) - e.pos.y) * 1.5));
  else e.vy -= G * dt;
  const hit = moveBody(e, mx * dt, e.vy * dt, mz * dt, g.solids);
  if (hit.y && !flies) e.vy = 0;
  if (hit.x || hit.z) {
    if (e.chargeT > 0) {
      e.chargeT = 0;
      e.painT = 0.6; // ran into a wall: stunned
      g.audio.play('punch', e.pos);
    } else if (e.probeT <= 0 && (mx || mz)) {
      // Blocked: sidestep towards whichever side has more room.
      e.probeT = 0.4;
      const left = probe(g, e, -uz, ux), right = probe(g, e, uz, -ux);
      e.strafeDir = left > right + 0.2 ? 1 : right > left + 0.2 ? -1 : -e.strafeDir;
      e.strafeT = 0.5 + Math.random() * 0.4;
    }
  }

  // Walk cycle, arm swing, wind-up raise, flinch.
  const moving = mx !== 0 || mz !== 0, k = Math.min(1, dt * 12);
  if (moving) e.walk += dt * (def.stride ?? 10) * (e.chargeT > 0 ? 1.8 : 1);
  for (let i = 0; i < e.legs.length; i++) {
    const l = e.legs[i];
    l.rotation.x = moving ? Math.sin(e.walk + i * Math.PI) * 0.6 : lerp(l.rotation.x, 0, k);
  }
  const raise = e.tellT > 0 || e.chargeT > 0;
  for (const a of e.arms) a.rotation.x = lerp(a.rotation.x, raise ? -Math.PI / 2 : moving ? swingOf(e, a) : 0, k);
  for (const a of e.swing) a.rotation.x = lerp(a.rotation.x, moving ? swingOf(e, a) : 0, k);
  if (e.head) e.head.rotation.x = lerp(e.head.rotation.x, 0, k);
  e.tilt = lerp(e.tilt, e.painT > 0 ? -0.35 : e.chargeT > 0 ? 0.22 : 0, Math.min(1, dt * 14));
  def.animate?.(g, e, dt);
  sync(e, g.time);
}
