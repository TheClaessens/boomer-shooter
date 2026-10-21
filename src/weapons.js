import * as THREE from 'three';
import { raycast, rayBox, boxDist, RAY_NORMAL } from './physics.js';
import { damageEnemy, spawnProjectile, hitscan, losClear, wakeNear } from './world.js';
import { aim, EYE } from './player.js';
import { registerSounds } from './audio.js';

// One job per weapon (DESIGN.md "Weapons"). ammo: pool name or null; use: ammo per shot; cd: seconds between shots.
export const WEAPONS = {
  axe: { slot: 1, name: 'FIRE AXE', ammo: null, use: 0, cd: 0.5 },
  shotgun: { slot: 2, name: 'PUMP SHOTGUN', ammo: 'shells', use: 1, cd: 0.95 },
  ssg: { slot: 3, name: 'SEVERANCE PACKAGE', ammo: 'shells', use: 2, cd: 1.5 },
  stapler: { slot: 4, name: 'HEAVY-DUTY STAPLER', ammo: 'staples', use: 1, cd: 1 / 11 },
  launcher: { slot: 5, name: 'TONER LAUNCHER', ammo: 'toner', use: 1, cd: 0.8 },
  laser: { slot: 6, name: 'PRESENTATION LASER', ammo: 'cells', use: 1, cd: 0.5 },
};
export const ORDER = Object.keys(WEAPONS);
export const AMMO_MAX = { shells: 50, staples: 200, toner: 20, cells: 30 };
const LASER_CHARGE = 0.8;
const SWITCH = 0.25; // lower the old weapon for the first half, raise the new one for the second

// Feel per weapon: shake (g.shake), punch (view pitch kick, rad, recovers), flash (s), muzzle light colour.
const FEEL = {
  axe: { shake: 0, punch: 0, flash: 0, light: 0 },
  shotgun: { shake: 0.2, punch: 0.035, flash: 0.07, light: 0xffb050 },
  ssg: { shake: 0.42, punch: 0.075, flash: 0.09, light: 0xffa040 },
  stapler: { shake: 0.022, punch: 0.006, flash: 0.04, light: 0xc0d0ff },
  launcher: { shake: 0.16, punch: 0.045, flash: 0.08, light: 0xff60c0 },
  laser: { shake: 0.12, punch: 0.02, flash: 0.1, light: 0xff3030 },
};

const eye = new THREE.Vector3(), dir = new THREE.Vector3(), pd = new THREE.Vector3(), v = new THREE.Vector3(), mz = new THREE.Vector3(), tip = new THREE.Vector3();

const hasAmmo = (p, w) => !WEAPONS[w].ammo || p.ammo[WEAPONS[w].ammo] >= WEAPONS[w].use;
function bestWeapon(p) {
  for (const w of ['shotgun', 'stapler', 'ssg', 'laser', 'launcher']) if (p.owned[w] && hasAmmo(p, w)) return w;
  return 'axe';
}

export function selectWeapon(p, w) {
  if (!p.owned[w] || p.weapon === w) return;
  p.prevWeapon = p.weapon;
  p.weapon = w;
  p.switchT = SWITCH;
  p.charge = 0;
  p.fireT = 9; // new weapon comes up idle, not mid-reload
}

// World-space muzzle point: a bit right of and below the eye, along the aim.
function muzzlePoint(p, out, fwd = 0.6) {
  return out.set(Math.cos(p.yaw) * 0.16, -0.17, -Math.sin(p.yaw) * 0.16).add(eye).addScaledVector(dir, fwd);
}

export function updateWeapons(g, input, dt) {
  const p = g.player;
  if (input.switchTo) selectWeapon(p, input.switchTo);
  if (input.cycle) {
    const owned = ORDER.filter((w) => p.owned[w]);
    selectWeapon(p, owned[(owned.indexOf(p.weapon) + input.cycle + owned.length) % owned.length]);
  }
  p.cooldown -= dt;
  p.switchT = Math.max(0, p.switchT - dt);
  p.kick = Math.max(0, p.kick - dt * 5);
  p.flash -= dt;
  p.swing = Math.max(0, p.swing - dt / 0.35);
  p.pumpT -= dt;
  p.fireT = (p.fireT ?? 9) + dt;
  // View punch: fire() nudges the pitch up, this hands it back smoothly (mouse aim stays yours).
  if (p.punch) {
    const back = p.punch * Math.min(1, dt * 9);
    p.punch -= back;
    p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - back));
  }
  const ready = p.cooldown <= 0 && p.switchT <= 0;

  // Laser: hold to charge, release to fire. The whine climbs in 8 steps so letting go cuts it dead.
  if (p.weapon === 'laser') {
    if (input.fire && ready && hasAmmo(p, 'laser')) {
      const before = p.charge;
      p.charge = Math.min(1, p.charge + dt / LASER_CHARGE) || 1e-3;
      if (before === 0) p.chargeStep = -1;
      const step = Math.min(7, Math.floor(p.charge * 8));
      if (p.charge < 1 && step > p.chargeStep) g.audio.play('laser_c' + (p.chargeStep = step));
      if (p.charge >= 1 && before < 1) { g.audio.play('laser_ready'); p.holdT = 0; }
      if (p.charge >= 1 && (p.holdT += dt) > 0.32) { p.holdT = 0; g.audio.play('laser_hold'); }
    } else if (p.charge > 0) fire(g);
    else if (input.fire && ready) fire(g); // dry
    return;
  }
  if (input.fire && ready) fire(g);
}

function feel(g, p, w, scale = 1) {
  const F = FEEL[w];
  g.shake += F.shake * scale;
  const k = F.punch * scale;
  p.pitch = Math.min(1.55, p.pitch + k);
  p.punch = (p.punch || 0) + k;
  if (F.flash) {
    p.flash = F.flash;
    g.muzzle.color.setHex(F.light);
  }
}

function fire(g) {
  const p = g.player, w = p.weapon, W = WEAPONS[w];
  eye.set(p.pos.x, p.pos.y + EYE, p.pos.z);
  aim(p.yaw, p.pitch, dir);
  if (!hasAmmo(p, w)) {
    g.audio.play('dry');
    p.cooldown = 0.3;
    selectWeapon(p, bestWeapon(p));
    return;
  }
  p.cooldown = W.cd;
  p.fireT = 0;
  if (W.ammo) p.ammo[W.ammo] -= W.use;

  if (w === 'axe') {
    p.swing = 1;
    g.audio.play('axe');
    let best = null, bestD = 2.4;
    for (const e of g.enemies) {
      if (e.dead || !e.active) continue;
      const d = boxDist(eye, e.box);
      if (d >= bestD) continue;
      v.set(e.pos.x - eye.x, e.pos.y + e.h / 2 - eye.y, e.pos.z - eye.z).normalize();
      if ((v.dot(dir) < 0.5 && d > 0.3) || !losClear(g, eye, v.set(e.pos.x, e.pos.y + e.h / 2, e.pos.z))) continue;
      best = e;
      bestD = d;
    }
    if (best) {
      g.audio.play('axehit', null, 0.06);
      damageEnemy(g, best, 60, 'player', 'axe', { from: eye });
      g.shake += 0.22;
      p.punch = (p.punch || 0) - 0.03; // the blade bites: view dips with the blow
      p.pitch -= 0.03;
    } else {
      // Whiffed into a wall? Clang it.
      const t = raycast(g.solids, eye, dir, 2.2);
      if (t < 2.2) {
        g.audio.play('axewall', null, 0.07);
        g.fx.burst(v.copy(eye).addScaledVector(dir, t - 0.05), 0xfff0c0, 5, 3, 0.04, 0.25);
        g.shake += 0.08;
      }
    }
    return;
  }

  p.kick = w === 'stapler' ? 0.35 : 1;
  let kick = 1;
  wakeNear(g, eye, 30); // gunfire wakes nearby rooms
  if (w === 'shotgun') {
    p.pumpT = 0.6;
    g.audio.play('shotgun');
    g.audio.play('pump', null, 0.36);
    pellets(g, 7, 12, 0.14, 0.09, 'shotgun');
    g.fx.burst(muzzlePoint(p, mz, 0.9), 0x707070, 4, 1.5, 0.09, 0.5); // smoke puff
  } else if (w === 'ssg') {
    p.pumpT = 1.0;
    g.audio.play('ssg');
    g.audio.play('ssg_open', null, 0.3);
    g.audio.play('ssg_load', null, 0.82);
    g.audio.play('ssg_close', null, 1.12);
    pellets(g, 16, 11, 0.24, 0.12, 'ssg', 6);
    p.vel.addScaledVector(dir, -3); // recoil shove
    g.fx.burst(muzzlePoint(p, mz, 0.9), 0x686868, 7, 2, 0.12, 0.6);
  } else if (w === 'stapler') {
    g.audio.play('staple');
    aim(p.yaw + (Math.random() - 0.5) * 0.035, p.pitch + (Math.random() - 0.5) * 0.035, pd);
    const h = hitscan(g, eye, pd, 90);
    if (h.enemy) damageEnemy(g, h.enemy, 9, 'player', 'stapler', { from: eye, painMul: 1.5 });
    else impact(g, eye, pd, h, 0xd0d0d8, 2);
    g.fx.tracer(muzzlePoint(p, mz, 0.7), v.copy(eye).addScaledVector(pd, h.t), 0xe8e8ff);
  } else if (w === 'launcher') {
    g.audio.play('launcher');
    g.audio.play('toner_cycle', null, 0.28);
    const t = raycast(g.solids, eye, dir, 0.6);
    v.copy(eye).addScaledVector(dir, Math.max(0, t - 0.1));
    spawnProjectile(g, 'toner', v, dir.clone().multiplyScalar(26).add(new THREE.Vector3(0, 2.5, 0)), 'player');
    g.fx.burst(muzzlePoint(p, mz, 0.7), 0x605860, 6, 1.5, 0.12, 0.7);
  } else if (w === 'laser') {
    const c = p.charge;
    p.charge = 0;
    kick = 0.6 + 1.6 * c; // a full charge kicks like a shotgun
    g.audio.play(c >= 1 ? 'laser_full' : 'laser');
    const wallT = raycast(g.solids, eye, dir, 120);
    // Pierces every enemy and shield along the beam.
    for (const e of g.enemies) {
      if (e.dead || !e.active) continue;
      if (rayBox(eye, dir, e.box, wallT) < wallT) damageEnemy(g, e, 35 + 115 * c, 'player', 'laser', { from: eye, pierce: true });
    }
    tip.copy(eye).addScaledVector(dir, wallT);
    if (g.fx.beam) g.fx.beam(muzzlePoint(p, new THREE.Vector3(), 0.7), tip.clone(), c);
    else g.fx.tracer(muzzlePoint(p, mz, 0.7), tip, 0xff4040);
    if (wallT < 120) {
      g.fx.decal?.(tip.clone(), { ...RAY_NORMAL }, 'scorch');
      g.fx.burst(tip, 0xff4040, 4 + Math.round(8 * c), 3 + 4 * c, 0.06, 0.4);
    }
  }
  // After the shots, so the view punch doesn't lift this shot's aim.
  feel(g, p, w, kick);
}

function pellets(g, n, dmg, sx, sy, weapon, knock = 0) {
  const p = g.player, hits = new Map();
  for (let i = 0; i < n; i++) {
    aim(p.yaw + (Math.random() - 0.5) * sx, p.pitch + (Math.random() - 0.5) * sy, pd);
    const h = hitscan(g, eye, pd, 80);
    if (h.enemy) hits.set(h.enemy, (hits.get(h.enemy) || 0) + dmg * (h.t < 3 ? 1.5 : 1)); // point-blank bonus
    else impact(g, eye, pd, h, 0x8a8a80);
  }
  for (const [e, d] of hits) damageEnemy(g, e, d, 'player', weapon, { from: eye, knock });
}

function impact(g, o, d, h, color, n = 3) {
  const at = v.copy(o).addScaledVector(d, h.t - 0.05);
  g.fx.burst(at, color, n, 2, 0.05, 0.3);
  if (h.t < 80) {
    g.fx.sparks?.(at, h.normal, 3);
    g.fx.decal?.(at.clone(), h.normal, 'hole');
  }
}

// ── sounds: chunky, distinct, all synthesized (these override audio.js defaults of the same name) ──
const rnd = (a, b) => a + Math.random() * (b - a);
const LASER_STEPS = {};
for (let i = 0; i < 8; i++) {
  const f0 = 180 * 2 ** (i * 0.36), f1 = 180 * 2 ** ((i + 1) * 0.36), vol = 0.07 + i * 0.012;
  LASER_STEPS['laser_c' + i] = (a, t, o) => {
    a.osc('sawtooth', f0, f1, t, 0.13, vol, o);
    a.osc('square', f0 / 2, f1 / 2, t, 0.13, vol * 0.6, o);
    a.noise(t, 0.12, 0.05 + i * 0.01, o, 'bandpass', f0 * 4, f1 * 4, 6);
  };
}
registerSounds({
  ...LASER_STEPS,
  shotgun(a, t, o) {
    a.noise(t, 0.03, 0.6, o, 'highpass', 3000, 2000); // crack
    a.noise(t, 0.45, 0.8, o, 'lowpass', 5000, 160); // blast
    a.osc('sine', 150, 38, t, 0.3, 0.8, o); // thump
    a.osc('square', 90, 35, t, 0.12, 0.35, o);
    a.noise(t + 0.05, 0.6, 0.18, o, 'bandpass', 900, 300, 1); // room tail
  },
  pump(a, t, o) {
    a.noise(t, 0.05, 0.6, o, 'bandpass', 2400, 1600, 4); // rack back
    a.osc('square', 340, 180, t, 0.04, 0.18, o);
    a.noise(t + 0.15, 0.06, 0.7, o, 'bandpass', 1300, 900, 4); // slam forward
    a.osc('square', 120, 60, t + 0.15, 0.06, 0.3, o);
  },
  ssg(a, t, o) {
    for (const d of [0, 0.014]) {
      a.noise(t + d, 0.04, 1, o, 'highpass', 2500, 1500);
      a.noise(t + d, 0.7, 1.2, o, 'lowpass', 4000, 90);
    }
    a.osc('sine', 110, 25, t, 0.5, 1.2, o);
    a.osc('sawtooth', 70, 30, t, 0.25, 0.4, o);
    a.noise(t + 0.08, 0.9, 0.25, o, 'bandpass', 700, 200, 1);
  },
  ssg_open(a, t, o) { a.noise(t, 0.04, 0.6, o, 'bandpass', 3200, 2600, 6); a.osc('square', 520, 380, t, 0.03, 0.15, o); a.noise(t + 0.06, 0.12, 0.25, o, 'bandpass', 1500, 800, 3); },
  ssg_load(a, t, o) { for (const d of [0, 0.07]) { a.noise(t + d, 0.04, 0.5, o, 'bandpass', 1800, 1400, 5); a.osc('triangle', 260, 200, t + d, 0.04, 0.2, o); } },
  ssg_close(a, t, o) { a.noise(t, 0.07, 0.9, o, 'bandpass', 1500, 700, 3); a.osc('square', 150, 70, t, 0.07, 0.4, o); a.osc('sine', 90, 50, t, 0.1, 0.5, o); },
  staple(a, t, o) {
    const p = rnd(0.9, 1.12);
    a.noise(t, 0.035, 0.35, o, 'highpass', 4000, 2000);
    a.osc('square', 700 * p, 160 * p, t, 0.035, 0.14, o); // ka-
    a.osc('sine', 170 * p, 60, t, 0.06, 0.3, o); // -chunk
    a.noise(t + 0.02, 0.03, 0.3, o, 'bandpass', 1200, 1200, 4);
  },
  launcher(a, t, o) {
    a.osc('sine', 180, 32, t, 0.42, 1.1, o); // thoomp
    a.noise(t, 0.35, 0.8, o, 'lowpass', 1800, 120);
    a.noise(t, 0.5, 0.35, o, 'bandpass', 2400, 400, 1.5); // whoosh out
    a.osc('square', 60, 40, t, 0.12, 0.3, o);
  },
  toner_cycle(a, t, o) {
    a.noise(t, 0.05, 0.5, o, 'bandpass', 1600, 1200, 5); // pop out
    a.osc('sawtooth', 300, 700, t + 0.05, 0.18, 0.08, o); // motor whirr
    a.noise(t + 0.24, 0.07, 0.7, o, 'bandpass', 900, 600, 4); // seat
    a.osc('square', 110, 70, t + 0.24, 0.06, 0.3, o);
  },
  laser_ready(a, t, o) { a.osc('square', 1320, 1320, t, 0.06, 0.22, o); a.osc('square', 1760, 1760, t + 0.07, 0.12, 0.22, o); a.osc('sine', 880, 880, t, 0.25, 0.15, o); },
  laser_hold(a, t, o) { a.osc('sawtooth', 1150, 1250, t, 0.3, 0.05, o); a.osc('square', 575, 600, t, 0.3, 0.04, o); },
  laser(a, t, o) {
    a.osc('sawtooth', 1800, 180, t, 0.3, 0.32, o);
    a.osc('square', 900, 90, t, 0.25, 0.18, o);
    a.noise(t, 0.18, 0.4, o, 'highpass', 5000, 1200);
  },
  laser_full(a, t, o) {
    a.osc('sawtooth', 2600, 120, t, 0.5, 0.3, o);
    a.osc('square', 1300, 60, t, 0.45, 0.25, o);
    a.osc('sine', 140, 30, t, 0.45, 0.7, o); // big low hit under the zap
    a.noise(t, 0.3, 0.6, o, 'highpass', 6000, 900);
    a.noise(t + 0.05, 0.6, 0.2, o, 'bandpass', 1500, 300, 2);
  },
  axe(a, t, o) { a.noise(t, 0.22, 1.4, o, 'bandpass', 300, 2600, 2.5); a.noise(t + 0.03, 0.12, 0.6, o, 'bandpass', 2000, 900, 3); },
  axehit(a, t, o) {
    a.osc('sine', 130, 38, t, 0.22, 1.2, o); // meat
    a.osc('square', 220, 60, t, 0.08, 0.4, o);
    a.noise(t, 0.16, 1, o, 'lowpass', 2600, 180);
    a.noise(t + 0.04, 0.2, 0.35, o, 'bandpass', 500, 250, 2); // squelch
  },
  axewall(a, t, o) { a.osc('square', 1400, 1100, t, 0.12, 0.15, o); a.osc('triangle', 2100, 1900, t, 0.25, 0.12, o); a.noise(t, 0.06, 0.5, o, 'highpass', 3000, 2000); },
  dash(a, t, o) { a.noise(t, 0.22, 0.45, o, 'bandpass', 600, 2800, 1.8); a.osc('sine', 120, 60, t, 0.12, 0.35, o); },
  dry(a, t, o) { a.noise(t, 0.025, 1.1, o, 'bandpass', 3000, 3000, 6); a.noise(t + 0.06, 0.025, 0.9, o, 'bandpass', 2200, 2200, 6); },
});

// ── viewmodels ───────────────────────────────────────────────────────────────────────
// Every animation is a pure function of the player's state (fireT, charge, switchT, cooldown, ammo), so it
// freezes with hit-stop and renders right in dev snapshots. Sway/bob/landing are the only dt-driven bits.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a)); // 0..1 progress of t through [a, b]
const ease = (x) => x * x * (3 - 2 * x);
const out = (x) => 1 - (1 - x) * (1 - x);
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI); // 0→1→0 over [a, b]
const kickCurve = (t, up, down) => (t < up ? t / up : Math.max(0, 1 - (t - up) / down) ** 2); // snap back, ease home

const SKIN = 0xd89a68, SLEEVE = 0xd8d4c8, CUFF = 0xa8a498, STEEL = 0x3c3c46, DARK = 0x24242a, WOOD = 0x7a4622, WOOD2 = 0x5a3216, BRASS = 0xc8a040, RED = 0xb01818;

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x403028, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);
    this.light = new THREE.PointLight(0xffc060, 0, 4, 1);
    this.light.position.set(0.3, -0.1, -0.9);
    this.scene.add(this.light);

    const cube = new THREE.BoxGeometry(1, 1, 1), mats = new Map();
    const mat = (color) => mats.get(color) ?? mats.set(color, new THREE.MeshLambertMaterial({ color })).get(color);
    // glow: own emissive material (animated); basic: unlit (muzzle flash).
    const part = (parent, w, h, d, color, x, y, z, { glow, basic, rx = 0, ry = 0, rz = 0 } = {}) => {
      const material = basic ? new THREE.MeshBasicMaterial({ color }) : glow ? new THREE.MeshLambertMaterial({ color, emissive: color }) : mat(color);
      const m = new THREE.Mesh(cube, material);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      parent.add(m);
      return m;
    };
    const group = (parent, x = 0, y = 0, z = 0) => {
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      parent.add(grp);
      return grp;
    };
    // A fist with a shirt sleeve trailing back toward the camera (office worker's arms).
    const arm = (parent, x, y, z, ry = 0, rx = 0.35) => {
      const a = group(parent, x, y, z);
      a.rotation.set(rx, ry, 0);
      part(a, 0.1, 0.1, 0.13, SKIN, 0, 0, 0);
      part(a, 0.035, 0.05, 0.1, SKIN, -0.06, 0.02, -0.01); // thumb
      part(a, 0.12, 0.12, 0.05, CUFF, 0, 0, 0.09);
      part(a, 0.13, 0.13, 0.6, SLEEVE, 0, 0, 0.4);
      return a;
    };
    // Muzzle flash: hot core + crossed spikes, unlit.
    const flash = (parent, z, size, color, core = 0xffffe0) => {
      const f = group(parent, 0, 0, z);
      for (let i = 0; i < 4; i++) part(f, size * (i % 2 ? 0.7 : 1), size * 0.3, size * 0.1, color, 0, 0, 0.01, { basic: true, rz: (i * Math.PI) / 4 });
      part(f, size * 0.5, size * 0.5, size * 0.3, core, 0, 0, 0, { basic: true, rz: 0.4 });
      part(f, size * 0.25, size * 0.25, size * 1.1, color, 0, 0, -size * 0.45, { basic: true });
      for (const m of f.children) { m.material.depthTest = false; m.renderOrder = 10; } // never hidden by the gun itself
      f.children[4].renderOrder = 11; // hot core on top
      f.visible = false;
      return f;
    };
    const shell = (parent, x, y, z) => {
      const s = group(parent, x, y, z);
      s.scale.setScalar(0.75);
      part(s, 0.045, 0.045, 0.09, 0xc02020, 0, 0, 0);
      part(s, 0.05, 0.05, 0.025, BRASS, 0, 0, 0.05);
      return s;
    };
    const gun = (x, y, z) => {
      const grp = group(this.scene, x, y, z);
      grp.userData.base = new THREE.Vector3(x, y, z);
      return grp;
    };
    const P = (this.parts = {});

    // Axe: origin at the grip so the swing pivots on the fist.
    const axe = gun(0.38, -0.42, -0.58);
    {
      const h = (P.axeHead = group(axe));
      part(h, 0.055, 0.8, 0.055, WOOD, 0, 0.32, 0); // haft
      part(h, 0.065, 0.16, 0.065, DARK, 0, 0.0, 0); // grip tape
      part(h, 0.07, 0.05, 0.07, DARK, 0, -0.08, 0); // knob
      part(h, 0.08, 0.2, 0.26, RED, 0, 0.66, -0.12); // head
      part(h, 0.082, 0.04, 0.27, 0x801010, 0, 0.58, -0.12); // head bevel
      part(h, 0.05, 0.26, 0.05, 0xe0e0e8, 0, 0.66, -0.28); // edge
      part(h, 0.06, 0.07, 0.16, 0x601010, 0, 0.68, 0.08); // back spike
      part(h, 0.04, 0.04, 0.05, 0xe0e0e8, 0, 0.68, 0.17); // spike tip
      arm(h, 0, 0.04, 0.02, 0, 1.0);
    }
    axe.rotation.order = 'YXZ';

    // Pump shotgun.
    const shotgun = gun(0.22, -0.27, -0.46);
    {
      part(shotgun, 0.1, 0.13, 0.34, DARK, 0, 0, 0.04); // receiver
      part(shotgun, 0.102, 0.03, 0.12, 0x40404a, 0, 0.035, 0.02); // ejection port trim
      part(shotgun, 0.06, 0.06, 0.86, STEEL, 0, 0.035, -0.52); // barrel
      part(shotgun, 0.075, 0.075, 0.04, 0x3a3a42, 0, 0.035, -0.94); // muzzle ring
      part(shotgun, 0.02, 0.03, 0.02, 0xe0c040, 0, 0.075, -0.92); // bead
      part(shotgun, 0.05, 0.05, 0.7, 0x202026, 0, -0.03, -0.46); // mag tube
      part(shotgun, 0.025, 0.07, 0.12, DARK, 0, -0.1, 0.09); // trigger guard
      part(shotgun, 0.09, 0.15, 0.42, WOOD2, 0, -0.08, 0.38, { rx: -0.18 }); // stock
      const pump = (P.pump = group(shotgun, 0, -0.035, -0.44));
      part(pump, 0.11, 0.09, 0.3, WOOD, 0, 0, 0);
      for (const z of [-0.09, -0.03, 0.03, 0.09]) part(pump, 0.115, 0.095, 0.015, WOOD2, 0, 0, z);
      arm(pump, -0.04, -0.06, 0.02, -0.55, 0.25);
      arm(shotgun, 0.01, -0.12, 0.17, 0.15, 0.6);
      P.sgShell = shell(shotgun, 0.06, 0.04, -0.02);
      P.sgFlash = flash(shotgun, -1.02, 0.36, 0xffa030);
    }

    // Severance Package: double barrel with a hinge you can watch break open.
    const ssg = gun(0.2, -0.31, -0.52);
    {
      part(ssg, 0.17, 0.1, 0.2, 0x7a7a86, 0, -0.02, 0.06); // engraved silver receiver
      part(ssg, 0.175, 0.03, 0.14, 0x5a5a66, 0, -0.03, 0.06);
      part(ssg, 0.03, 0.025, 0.09, 0x6a6a74, 0, 0.04, 0.12); // top lever
      part(ssg, 0.12, 0.16, 0.42, 0x6a2c12, 0, -0.08, 0.36, { rx: -0.2 }); // stock
      part(ssg, 0.025, 0.07, 0.1, DARK, 0, -0.1, 0.12);
      // Hinge pin below and ahead of the breech: muzzles drop, breech face rises into view.
      const brk = (P.ssgBreak = group(ssg, 0, -0.06, -0.08));
      for (const s of [-1, 1]) {
        part(brk, 0.075, 0.075, 0.8, 0x30303a, s * 0.04, 0.08, -0.34);
        part(brk, 0.05, 0.05, 0.01, 0x050505, s * 0.04, 0.08, -0.745); // bores
      }
      part(brk, 0.02, 0.02, 0.78, 0x50505a, 0, 0.125, -0.34); // rib
      part(brk, 0.16, 0.07, 0.32, 0x7a3a18, 0, 0.015, -0.22); // forend
      P.ssgChamber = [-1, 1].map((s) => part(brk, 0.05, 0.05, 0.012, BRASS, s * 0.04, 0.08, 0.062));
      arm(brk, -0.03, -0.03, -0.22, -0.55, 0.25);
      P.ssgOut = [-1, 1].map((s) => shell(ssg, s * 0.04, 0.06, -0.06));
      const loader = (P.ssgLoader = group(ssg));
      arm(loader, 0, -0.02, 0.1, 0.1, 1.1);
      for (const s of [-1, 1]) shell(loader, s * 0.04, 0.02, 0.0);
      P.ssgFlash = flash(brk, -0.82, 0.48, 0xffa030);
    }

    // Heavy-Duty Stapler: industrial stapler body, a hammer arm that slams every shot, and a spinning
    // 4-barrel cluster up front.
    const stapler = gun(0.22, -0.31, -0.56);
    {
      part(stapler, 0.15, 0.07, 0.72, 0x34343c, 0, -0.08, -0.2); // base plate
      part(stapler, 0.13, 0.03, 0.56, 0x50505a, 0, -0.04, -0.2); // anvil
      const ham = (P.stHammer = group(stapler, 0, 0.0, 0.12)); // hinge at the back
      part(ham, 0.15, 0.11, 0.56, RED, 0, 0.04, -0.26); // top arm
      part(ham, 0.155, 0.03, 0.44, 0xe03030, 0, 0.1, -0.26); // highlight
      part(ham, 0.09, 0.05, 0.32, 0xc8c8d0, 0, 0.12, -0.26); // staple magazine
      part(ham, 0.06, 0.06, 0.06, 0x202024, 0, 0.04, 0.04); // hinge
      const sp = (P.stSpin = group(stapler, 0, 0.0, -0.7));
      part(sp, 0.13, 0.13, 0.06, 0x50505a, 0, 0, 0.14); // hub
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        part(sp, 0.04, 0.04, 0.3, i ? 0xb8b8c4 : 0xffd040, Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0);
      }
      part(sp, 0.13, 0.13, 0.035, 0x50505a, 0, 0, -0.1);
      part(stapler, 0.07, 0.2, 0.1, DARK, 0, -0.18, 0.07, { rx: 0.25 }); // grip
      arm(stapler, 0.01, -0.22, 0.1, 0.15, 0.7);
      arm(stapler, -0.06, -0.12, -0.38, -0.6, 0.3);
      P.stFlash = flash(stapler, -0.88, 0.22, 0xb0c8ff, 0xffffff);
    }

    // Toner Launcher: beige printer-plastic tube with a toner cartridge that cycles on top.
    const launcher = gun(0.26, -0.34, -0.6);
    {
      part(launcher, 0.24, 0.22, 0.56, 0xd8d0b8, 0, 0, -0.08); // body
      part(launcher, 0.245, 0.04, 0.4, 0xb8b098, 0, -0.09, -0.08); // seam
      part(launcher, 0.19, 0.19, 0.32, 0x1a1a1a, 0, 0.0, -0.48); // barrel
      part(launcher, 0.21, 0.21, 0.05, 0xc01880, 0, 0.0, -0.6); // magenta ring
      part(launcher, 0.12, 0.12, 0.01, 0x050505, 0, 0.0, -0.64); // bore
      part(launcher, 0.16, 0.14, 0.1, 0x2a2a2a, 0, 0.0, 0.24); // exhaust
      P.lnLed = part(launcher, 0.04, 0.03, 0.04, 0x40ff60, -0.11, 0.08, 0.12, { glow: true });
      part(launcher, 0.07, 0.18, 0.1, 0x303030, 0, -0.18, 0.06, { rx: 0.2 }); // grip
      const cart = (P.lnCart = group(launcher, 0, 0.13, 0.04));
      part(cart, 0.14, 0.08, 0.36, 0x151515, 0, 0, 0);
      P.lnStripe = part(cart, 0.145, 0.025, 0.37, 0xc01880, 0, 0.01, 0, { glow: true });
      const spent = (P.lnSpent = group(launcher));
      part(spent, 0.14, 0.08, 0.36, 0x151515, 0, 0, 0);
      part(spent, 0.145, 0.025, 0.37, 0x601040, 0, 0.01, 0);
      arm(launcher, 0.01, -0.22, 0.09, 0.15, 0.7);
      arm(launcher, -0.14, -0.06, -0.24, -0.5, 0.2);
      P.lnFlash = flash(launcher, -0.75, 0.42, 0xff50c0);
    }

    // Presentation Laser: silver pointer with focusing coils that heat up red while charging.
    const laser = gun(0.22, -0.28, -0.52);
    {
      part(laser, 0.09, 0.09, 0.66, 0xb8b8c0, 0, 0.02, -0.26); // body
      part(laser, 0.095, 0.02, 0.5, 0x808088, 0, 0.065, -0.24); // top rail
      part(laser, 0.13, 0.16, 0.26, 0x30303a, 0, -0.04, 0.06); // housing
      part(laser, 0.06, 0.03, 0.06, 0x40404a, 0, 0.055, 0.06); // clicker button
      part(laser, 0.07, 0.17, 0.1, 0x202028, 0, -0.17, 0.1, { rx: 0.2 }); // grip
      P.lzCoils = [-0.36, -0.44, -0.52].map((z) => part(laser, 0.13, 0.13, 0.04, 0x8a8a94, 0, 0.02, z, { glow: true }));
      for (const m of P.lzCoils) m.material.emissive.setHex(0);
      P.lzGauge = part(laser, 0.02, 0.025, 0.2, 0xff2020, -0.05, 0.03, -0.12, { glow: true }); // side charge bar
      P.lzTip = part(laser, 0.05, 0.05, 0.05, 0xff2020, 0, 0.02, -0.61, { glow: true });
      P.lzHalo = part(laser, 0.12, 0.12, 0.02, 0xff6060, 0, 0.02, -0.63, { basic: true });
      P.lzHalo.material.transparent = true;
      arm(laser, 0.01, -0.21, 0.13, 0.15, 0.7);
      P.lzFlash = flash(laser, -0.68, 0.2, 0xff3030, 0xffe0e0);
    }

    this.guns = { axe, shotgun, ssg, stapler, launcher, laser };
    this.flashes = { shotgun: P.sgFlash, ssg: P.ssgFlash, stapler: P.stFlash, launcher: P.lnFlash, laser: P.lzFlash };
    // Sway / bob state (dt-driven).
    this.bob = 0;
    this.time = 0;
    this.sway = { x: 0, y: 0, roll: 0, vy: 0 };
    this.land = 0;
    this.landV = 0;
    this.prev = null;
    this.spin = 0;
    this.spinV = 0;
  }

  update(p, dt) {
    const P = this.parts, sw = this.sway;
    // ── movement feel ──
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const side = p.vel.x * cos - p.vel.z * sin, speed = Math.hypot(p.vel.x, p.vel.z);
    if (dt > 0) {
      this.time += dt;
      if (this.prev) {
        let dy = p.yaw - this.prev.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const dp = p.pitch - this.prev.pitch - ((p.punch ?? 0) - this.prev.punch); // ignore our own view punch
        const k = Math.min(1, dt * 12);
        sw.x += (Math.max(-0.07, Math.min(0.07, (dy / dt) * 0.012 - side * 0.0035)) - sw.x) * k;
        sw.y += (Math.max(-0.06, Math.min(0.06, -(dp / dt) * 0.01 - p.vel.y * 0.0035)) - sw.y) * k;
        sw.roll += (Math.max(-0.15, Math.min(0.15, (dy / dt) * 0.02 - side * 0.006)) - sw.roll) * k;
        if (p.onGround && !this.prev.onGround) this.landV -= Math.min(3.5, Math.max(0, -this.prev.vy) * 0.2);
      }
      // Landing dip: damped spring.
      this.landV += (-180 * this.land - 16 * this.landV) * dt;
      this.land += this.landV * dt;
      if (p.onGround) this.bob += dt * speed * 0.85;
      this.prev = { yaw: p.yaw, pitch: p.pitch, punch: p.punch ?? 0, onGround: p.onGround, vy: p.vel.y };
    }
    const amp = p.onGround ? Math.min(1, speed / 12) * 0.03 : 0;
    const bobX = Math.cos(this.bob) * amp, bobY = -Math.abs(Math.sin(this.bob)) * amp + Math.sin(this.time * 1.7) * 0.004;
    const dash = p.dashT > 0 ? 1 : 0;

    // ── switch: old weapon drops for the first half, new one rises for the second ──
    const u = 1 - p.switchT / SWITCH;
    const showing = p.switchT > SWITCH / 2 && p.prevWeapon ? p.prevWeapon : p.weapon;
    const drop = p.switchT > 0 ? (showing === p.weapon ? 1 - ease(seg(u, 0.5, 1)) : ease(seg(u, 0, 0.5))) : 0;

    const t = showing === p.weapon ? p.fireT ?? 9 : 9;
    for (const [name, grp] of Object.entries(this.guns)) {
      grp.visible = name === showing && !p.dead;
      if (!grp.visible) continue;
      const b = grp.userData.base;
      // pose = [x, y, z, rx, ry, rz] offsets on top of sway; each weapon writes its animation into it.
      const pose = [0, 0, 0, 0, 0, 0];
      ANIM[name](P, pose, t, p, this);
      grp.position.set(
        b.x + bobX + sw.x + pose[0],
        b.y + bobY + sw.y + this.land * 0.6 - drop * 0.55 + pose[1] - (p.dead ? 1 : 0),
        b.z + dash * 0.06 + pose[2],
      );
      grp.rotation.set(pose[3] - drop * 0.6 - dash * 0.08 + this.land * 0.5, pose[4], pose[5] + sw.roll + drop * 0.3);
    }
    const f = this.flashes[showing], on = p.flash > 0 && f && showing === p.weapon;
    for (const k in this.flashes) this.flashes[k].visible = false;
    if (on) {
      f.visible = true;
      f.rotation.z = Math.random() * Math.PI;
      f.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    this.light.color.setHex(FEEL[p.weapon].light || 0xffc060);
    this.light.intensity = on ? 10 : p.weapon === 'laser' ? p.charge * 3 : 0;
  }
}

// Per-weapon animation: writes into pose [x, y, z, rx, ry, rz] and moves its own parts. t = seconds since the shot.
const ANIM = {
  axe(P, pose, t) {
    // Rest: blade up and leaning in. Wind-up back, fast diagonal chop down-left, heavy recovery.
    const wind = ease(seg(t, 0, 0.05)), slash = out(seg(t, 0.05, 0.16)), back = ease(seg(t, 0.2, 0.5));
    const k = slash * (1 - back), w = wind * (1 - slash);
    pose[0] = 0.05 * w - 0.38 * k;
    pose[1] = 0.06 * w - 0.08 * k;
    pose[2] = 0.04 * w - 0.12 * k;
    pose[3] = -0.35 + 0.4 * w - 1.25 * k; // haft tips forward and down through the chop
    pose[4] = 0.15 * w - 0.2 * k;
    pose[5] = 0.3 - 0.25 * w + 0.75 * k; // roll across the screen
  },
  shotgun(P, pose, t, p) {
    const k = kickCurve(t, 0.03, 0.22);
    pose[2] = 0.14 * k;
    pose[3] = 0.32 * k;
    pose[1] = 0.03 * k;
    // Pump: rack back 0.36-0.47, slam forward 0.47-0.58, gun cants toward you while racking.
    const back = out(seg(t, 0.36, 0.47)), fwd = ease(seg(t, 0.47, 0.58)), rack = back * (1 - fwd);
    P.pump.position.z = -0.44 + 0.17 * rack;
    pose[5] += 0.18 * bump(t, 0.33, 0.66);
    pose[3] -= 0.06 * bump(t, 0.33, 0.66);
    // Spent shell kicks out the port as the pump comes back.
    const s = seg(t, 0.42, 0.85);
    P.sgShell.visible = s > 0 && s < 1;
    if (P.sgShell.visible) {
      const tt = s * 0.43;
      P.sgShell.position.set(0.06 + 0.7 * tt, 0.04 + 1.5 * tt - 6 * tt * tt, -0.02 - 0.1 * tt);
      P.sgShell.rotation.set(tt * 18, tt * 9, 0);
    }
  },
  ssg(P, pose, t) {
    const k = kickCurve(t, 0.03, 0.3);
    pose[2] = 0.2 * k;
    pose[3] = 0.5 * k;
    pose[1] = 0.05 * k;
    // Break open, eject, load, snap shut.
    const open = ease(seg(t, 0.3, 0.42)) * (1 - ease(seg(t, 1.1, 1.2)));
    P.ssgBreak.rotation.x = -0.75 * open;
    pose[3] += 0.35 * open; // bring the breech up to the eye
    pose[5] += 0.25 * open;
    pose[0] -= 0.05 * open;
    pose[1] += 0.04 * open;
    pose[3] -= 0.12 * bump(t, 1.1, 1.3); // close-snap jolt
    const loaded = t < 0.42 || t > 0.98;
    for (const m of P.ssgChamber) m.material.color.setHex(loaded ? BRASS : 0x101010);
    const e = seg(t, 0.42, 0.75);
    P.ssgOut.forEach((s, i) => {
      s.visible = e > 0 && e < 1;
      if (!s.visible) return;
      const tt = e * 0.33, d = i ? 1 : -1;
      s.position.set(d * 0.04 + 0.5 * tt, 0.08 + 1.6 * tt - 7 * tt * tt, -0.06 + 0.15 * tt);
      s.rotation.set(-tt * 14, d * tt * 6, 0);
    });
    // Loader hand comes up from below with two fresh shells, pushes them in, leaves.
    const inn = ease(seg(t, 0.6, 0.88)), outT = ease(seg(t, 0.98, 1.12));
    P.ssgLoader.visible = t > 0.6 && t < 1.12;
    P.ssgLoader.position.set(0.08 * (1 - inn) + 0.12 * outT, 0.12 - 0.45 * (1 - inn) - 0.45 * outT, 0.12 - 0.1 * inn + 0.1 * outT);
  },
  stapler(P, pose, t, p, vm) {
    // Hammer slams down each shot; slight random kick so sustained fire chatters.
    const ham = Math.max(0, 1 - t / 0.07);
    P.stHammer.rotation.x = -0.09 * ham;
    P.stHammer.position.y = -0.015 * ham;
    const r = Math.sin(p.ammo.staples * 12.9898) * 0.5;
    pose[2] = 0.05 * ham;
    pose[3] = 0.05 * ham;
    pose[5] = r * 0.04 * ham;
    pose[0] = r * 0.01 * ham;
    spinStep(vm, t);
  },
  launcher(P, pose, t, p) {
    const k = kickCurve(t, 0.04, 0.35);
    pose[2] = 0.14 * k;
    pose[3] = 0.16 * k;
    pose[1] = 0.04 * k;
    // Cartridge pops up and out 0.25-0.4, a fresh one drops in 0.4-0.62.
    const pop = ease(seg(t, 0.25, 0.4)), seat = ease(seg(t, 0.42, 0.62)), cyc = t < 0.62 && t > 0.25;
    P.lnCart.position.set(0, 0.13 + (cyc ? (t < 0.41 ? 0.12 * pop : 0.2 * (1 - seat)) : 0), 0.04);
    P.lnCart.rotation.x = t < 0.41 ? -0.3 * pop : 0;
    pose[5] -= 0.15 * bump(t, 0.22, 0.7);
    const s = seg(t, 0.38, 0.8);
    P.lnSpent.visible = s > 0 && s < 1;
    if (P.lnSpent.visible) {
      const tt = s * 0.42;
      P.lnSpent.position.set(0.8 * tt, 0.26 + 1.3 * tt - 5 * tt * tt, 0.04 - 0.1 * tt);
      P.lnSpent.rotation.set(tt * 5, 0, -tt * 10);
    }
    const ready = p.cooldown <= 0;
    P.lnLed.material.color.setHex(ready ? 0x40ff60 : 0xff3020);
    P.lnLed.material.emissive.setHex(ready ? 0x40ff60 : 0xff3020);
    P.lnStripe.material.emissiveIntensity = 0.6 + 0.4 * Math.sin((p.fireT ?? 0) * 6);
  },
  laser(P, pose, t, p) {
    const c = p.charge, full = c >= 1;
    // Charging: gun draws back and trembles harder as it fills; full charge pulses.
    const j = c * c * 0.012 + (full ? 0.004 : 0);
    pose[0] = (Math.random() - 0.5) * j;
    pose[1] = (Math.random() - 0.5) * j - 0.015 * c;
    pose[2] = 0.05 * c;
    pose[5] = -0.12 * c;
    // Firing: recoil scaled by the shot, coils cool off over 0.5 s.
    const k = kickCurve(t, 0.03, 0.3), heat = c > 0 ? c : Math.max(0, 1 - t / 0.5) * 0.9;
    pose[2] += 0.16 * k;
    pose[3] += 0.3 * k;
    const pulse = full ? 0.75 + 0.25 * Math.sin(performance.now() * 0.03) : 1;
    P.lzCoils.forEach((m, i) => m.material.emissive.setRGB(heat * pulse * (c > 0 ? clamp01(c * 3 - i) : 1), heat * 0.15 * pulse, heat * 0.1));
    P.lzGauge.scale.z = 0.01 + 0.2 * c;
    P.lzGauge.position.z = -0.22 + 0.1 * c;
    P.lzTip.scale.setScalar(0.05 + 0.05 * c * pulse);
    P.lzHalo.visible = c > 0.05;
    P.lzHalo.scale.set(0.1 + 0.2 * c * pulse, 0.1 + 0.2 * c * pulse, 0.02);
    P.lzHalo.material.opacity = 0.3 + 0.5 * c;
    P.lzHalo.material.color.setHex(full ? 0xffe8e8 : 0xff5050);
  },
};

// Stapler barrel spin: velocity jumps while firing, coasts to a stop; advanced by the time since the shot.
function spinStep(vm, t) {
  const now = vm.time;
  const dt = now - (vm.spinAt ?? now);
  vm.spinAt = now;
  vm.spinV = t < 0.15 ? 30 : vm.spinV * Math.exp(-dt * 3);
  vm.spin += vm.spinV * dt;
  vm.parts.stSpin.rotation.z = -vm.spin;
}
