import * as THREE from 'three';
import { boxDist, raycast } from '../physics.js';
import { hurtPlayer, damageEnemy, spawnProjectile, hitscan, losClear, blast } from '../world.js';
import { registerProjectiles } from '../projectiles.js';
import { registerSounds } from '../audio.js';
import { center, revive } from './index.js';
import { FACES, imageTexture } from '../textures.js';

// The tower's staff. Each enemy teaches one skill. keep: preferred distance; cd: seconds between attacks; tell: wind-up.
// Generic-AI extras (turn, retreat, weave, jitter, stride, floats, death, lie) are documented in index.js.

const cube = new THREE.BoxGeometry(1, 1, 1), facePlane = new THREE.PlaneGeometry(1, 1);
let faceN = 0; // round-robin over src/faces so every colleague shows up
const v = new THREE.Vector3(), dir = new THREE.Vector3(), muzzle = new THREE.Vector3(), eye = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), ZERO = new THREE.Vector3();
const lerp = (a, b, k) => a + (b - a) * k;

// Low-poly bodies from boxes, facing +z, origin at the feet. One material per colour per enemy (they flash together).
function kit() {
  registerOnce();
  const root = new THREE.Group(), mats = [], cache = new Map();
  const mat = (color, glow = false) => {
    const key = glow ? -color - 1 : color;
    let m = cache.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, emissive: glow ? color : 0 });
      cache.set(key, m);
      if (!glow) mats.push(m);
    }
    return m;
  };
  const part = (parent, w, h, d, color, x, y, z, glow = false) => {
    const mesh = new THREE.Mesh(cube, mat(color, glow));
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x, y, z, parent = root) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  return { root, mats, mat, part, pivot, legs: [], arms: [], swing: [] };
}

// Shared biped: legs (hip pivots), torso pivot at the hip (hunch), head pivot at the neck, arm pivots at the shoulders.
function humanoid(o) {
  const k = kit(), { part, pivot } = k;
  const hip = o.hip, [tw, th, td] = o.torso, [hw, hh, hd] = o.head;
  for (const s of [-1, 1]) {
    const l = pivot(s * o.legX, hip, 0);
    part(l, o.legW, hip - 0.1, o.legD, o.pants, 0, -(hip - 0.1) / 2, 0);
    part(l, o.legW + 0.04, 0.1, o.legD + 0.14, o.shoe, 0, -hip + 0.05, 0.06);
    k.legs.push(l);
  }
  const t = (k.torso = pivot(0, hip, 0));
  t.rotation.x = o.hunch ?? 0;
  part(t, tw, th, td, o.shirt, 0, th / 2, 0);
  const h = (k.head = pivot(0, th, o.headZ ?? 0, t));
  part(h, hw, hh, hd, o.skin, 0, hh / 2 + 0.02, 0);
  if (FACES.length) {
    // A colleague's photo on the front of the head; it flashes with the body (in k.mats).
    // emissiveMap: the rest glow and hit flash light the photo itself instead of greying it out.
    const tex = imageTexture(FACES[faceN++ % FACES.length], 128);
    const m = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex });
    k.mats.push(m);
    const f = new THREE.Mesh(facePlane, m);
    f.scale.set(hw, hh, 1);
    f.position.set(0, hh / 2 + 0.02, hd / 2 + 0.025); // in front of the painted-on mouths and glasses
    h.add(f);
  } else for (const s of [-1, 1]) part(h, 0.07, 0.05, 0.02, o.eye ?? 0xff2010, s * hw * 0.26, hh * 0.6, hd / 2 + 0.01, true);
  k.hands = [];
  const [fw, fh] = o.fist ?? [o.armW * 0.9, 0.11];
  for (const s of [-1, 1]) {
    const a = pivot(s * (tw / 2 + o.armW / 2 + 0.01), th - 0.06, 0, t);
    a.userData.side = s;
    part(a, o.armW, o.armL, o.armW, o.sleeve ?? o.shirt, 0, -o.armL / 2, 0);
    k.hands.push(part(a, fw, fh, fw, o.hand ?? o.skin, 0, -o.armL - fh / 2 + 0.05, 0, !!o.handGlow));
    if (s < 0) k.armL = a;
    else k.armR = a;
  }
  return k;
}

function aimFrom(e, tgt) {
  center(tgt, v);
  muzzle.set(e.pos.x + Math.sin(e.yaw) * 0.5, e.pos.y + e.h * 0.72, e.pos.z + Math.cos(e.yaw) * 0.5);
  dir.subVectors(v, muzzle);
  const dist = dir.length();
  dir.divideScalar(dist);
  return dist;
}

function pistol(g, e, tgt, dmg = [5, 9]) {
  const p = g.player, dist = aimFrom(e, tgt);
  g.audio.play('pistol', e.pos);
  g.fx.burst(muzzle, 0xffe080, 3, 2, 0.06, 0.12);
  if (tgt === p) {
    // A monster in the line of fire takes the bullet (and gets angry).
    const h = hitscan(g, muzzle, dir, dist, e);
    if (h.enemy) return void damageEnemy(g, h.enemy, 6, e, null, { from: e.pos });
    if (!losClear(g, muzzle, v)) return;
    // Never stand still: moving fast makes interns miss.
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const chance = Math.max(0.08, Math.min(0.9, 0.85 - speed * 0.06 - dist * 0.02));
    if (Math.random() < chance) {
      hurtPlayer(g, dmg[0] + Math.floor(Math.random() * (dmg[1] - dmg[0])), e.pos);
      g.fx.tracer(muzzle, v);
    } else g.fx.tracer(muzzle, v.clone().addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 1.5));
  } else {
    const h = hitscan(g, muzzle, dir, dist + 1, e);
    if (h.enemy) damageEnemy(g, h.enemy, 6, e, null, { from: e.pos });
    g.fx.tracer(muzzle, v);
  }
}

function shove(g, e, dmg, speed, up) {
  const p = g.player;
  hurtPlayer(g, dmg, e.pos);
  v.set(p.pos.x - e.pos.x, 0, p.pos.z - e.pos.z).normalize();
  p.vel.x += v.x * speed;
  p.vel.z += v.z * speed;
  p.vel.y = up;
  g.shake += 0.4;
}

function bruteHit(g, e, tgt) {
  g.audio.play('punch', e.pos);
  e.chargeT = 0;
  e.cd = 1.5;
  if (tgt === g.player) shove(g, e, 25, 12, 5);
  else damageEnemy(g, tgt, 25, e, null, { from: e.pos });
}

// ── projectiles & hazards (registered on first build) ──

const RING_R = 1.4, FUSE = 0.9;
const basic = (color) => new THREE.MeshBasicMaterial({ color });
const HAZ = { ring: basic(0xff1a10), core: basic(0xfff0b0), fire: basic(0xff6010), hot: basic(0xffb030) };
let registered = false;
function registerOnce() {
  if (registered) return;
  registered = true;
  registerProjectiles({
    // Compliance Officer: a glowing clipboard thrown like a frisbee.
    clipboard: {
      dmg: 10, splash: 0, gravity: 2, radius: 0.25, trail: 0xffa040,
      parts: [[0.38, 0.05, 0.46, 0xffb040, true], [0.16, 0.08, 0.1, 0xff5010, true]],
      update(g, pr, dt) {
        const [board, clip] = pr.mesh.children;
        if (!pr.spun) { pr.spun = true; clip.position.z = 0.2; }
        board.rotation.y += dt * 28;
        clip.position.set(Math.sin(board.rotation.y) * 0.2, 0, Math.cos(board.rotation.y) * 0.2);
        clip.rotation.y = board.rotation.y;
      },
    },
    // Recruiter: red ring on the floor (shrinks as the fuse burns), then a fire pillar. Never moves; lives FUSE + 0.5 s.
    mark: {
      dmg: 25, splash: 0, gravity: 0, radius: 0, parts: [],
      update(g, pr, dt) {
        if (!pr.ring) {
          pr.t = 0;
          pr.ring = new THREE.Group();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4, m = new THREE.Mesh(cube, HAZ.ring);
            m.scale.set(2 * RING_R * 0.4142, 0.05, 0.14);
            m.position.set(Math.sin(a) * RING_R, 0.03, Math.cos(a) * RING_R);
            m.rotation.y = a;
            pr.ring.add(m);
          }
          const dot = new THREE.Mesh(cube, HAZ.ring);
          dot.scale.set(0.3, 0.05, 0.3);
          pr.ring.add(dot);
          pr.pillar = new THREE.Group();
          // Stacked, twisted flame blocks around a white-hot core.
          for (const [s, h, y, m, r] of [[0.8, 5.2, 2.6, HAZ.core, 0], [1.9, 1.8, 0.9, HAZ.fire, 0], [1.5, 1.7, 2.5, HAZ.fire, 0.8], [1.0, 1.6, 4.0, HAZ.fire, 0.3], [1.3, 1.2, 0.6, HAZ.hot, 0.4]]) {
            const c = new THREE.Mesh(cube, m);
            c.scale.set(s, h, s);
            c.position.y = y;
            c.rotation.y = r;
            pr.pillar.add(c);
          }
          pr.pillar.visible = false;
          pr.mesh.add(pr.ring, pr.pillar);
        }
        pr.t += dt;
        pr.life = 1;
        if (pr.t < FUSE) {
          const s = 1 + 0.35 * (1 - pr.t / FUSE);
          pr.ring.scale.set(s, 1, s);
          pr.ring.rotation.y += dt * 3;
          pr.ring.visible = pr.t < FUSE - 0.25 || Math.sin(pr.t * 60) > 0;
          return;
        }
        if (!pr.fired) erupt(g, pr);
        const k = (pr.t - FUSE) / 0.5;
        pr.ring.visible = false;
        pr.pillar.visible = true;
        pr.pillar.scale.set(1 - k * 0.7, Math.min(1, k * 8) * (1 + Math.random() * 0.15), 1 - k * 0.7);
        pr.pillar.rotation.y += dt * 9;
        if (Math.random() < 0.5) g.fx.burst(v.set(pr.pos.x, pr.pos.y + 1 + Math.random() * 3, pr.pos.z), 0xffa030, 1, 4, 0.1, 0.4);
        if (k >= 1) pr.life = 0;
      },
      onHit: () => true,
    },
  });
}

function erupt(g, pr) {
  pr.fired = true;
  const p = g.player, o = pr.pos;
  g.audio.play('pillar', o);
  g.fx.burst(v.set(o.x, o.y + 0.5, o.z), 0xff8020, 18, 8, 0.14, 0.8);
  g.fx.burst(v.set(o.x, o.y + 2, o.z), 0xffd040, 10, 5, 0.1, 0.6);
  g.fx.decal?.(o.clone(), { x: 0, y: 1, z: 0 }, 'scorch', RING_R);
  g.shake += Math.max(0, 0.25 - o.distanceTo(p.pos) * 0.02);
  const inside = (b, r) => Math.hypot(b.pos.x - o.x, b.pos.z - o.z) < RING_R + r && b.pos.y < o.y + 4 && b.pos.y + b.h > o.y - 0.3;
  if (!p.dead && inside(p, p.r ?? 0.3)) hurtPlayer(g, 25, o);
  for (const b of g.enemies) if (!b.dead && b.active && b !== pr.owner && inside(b, b.r)) damageEnemy(g, b, 25, pr.owner, null, { from: o, pierce: true });
}

// ── sounds: sight / tell / pain / die per new type, plus custom ones ──
registerSounds({
  sight_burnout(a, t, o) { a.noise(t, 0.5, 0.5, o, 'bandpass', 1200, 4500, 4); [900, 1300, 1000, 1700].forEach((f, i) => a.osc('square', f, f * 1.4, t + i * 0.07, 0.06, 0.12, o)); },
  tell_burnout(a, t, o) { a.noise(t, 0.4, 1, o, 'highpass', 2000, 8000, 1); a.osc('sawtooth', 300, 1400, t, 0.36, 0.25, o); },
  pain_burnout(a, t, o) { a.osc('square', 1500, 900, t, 0.1, 0.2, o); },
  die_burnout(a, t, o) { a.osc('square', 1600, 200, t, 0.15, 0.3, o); },
  sight_compliance(a, t, o) { a.osc('square', 880, 880, t, 0.1, 0.2, o); a.osc('square', 660, 660, t + 0.13, 0.16, 0.2, o); a.osc('sawtooth', 120, 90, t + 0.3, 0.4, 0.4, o); },
  tell_compliance(a, t, o) { a.noise(t, 0.4, 0.45, o, 'bandpass', 600, 2400, 2); a.osc('sawtooth', 110, 150, t, 0.3, 0.25, o); },
  pain_compliance(a, t, o) { a.osc('sawtooth', 170, 110, t, 0.15, 0.35, o); },
  die_compliance(a, t, o) { a.osc('sawtooth', 140, 40, t, 0.6, 0.4, o); a.noise(t + 0.15, 0.25, 0.6, o, 'bandpass', 3000, 1500, 3); a.noise(t + 0.4, 0.2, 0.5, o, 'bandpass', 2200, 1200, 3); },
  ping(a, t, o) { a.osc('sine', 2400, 2250, t, 0.28, 0.35, o); a.osc('triangle', 3700, 3500, t, 0.12, 0.2, o); a.noise(t, 0.03, 0.4, o, 'highpass', 5000); },
  shield_drop(a, t, o) { a.osc('square', 230, 80, t, 0.25, 0.4, o); a.noise(t, 0.35, 0.6, o, 'bandpass', 1500, 600, 2); },
  throw(a, t, o) { a.noise(t, 0.2, 0.5, o, 'bandpass', 900, 3000, 3); },
  bash(a, t, o) { a.osc('sine', 110, 40, t, 0.25, 1, o); a.noise(t, 0.2, 0.8, o, 'bandpass', 1800, 500, 2); },
  sight_sysadmin(a, t, o) { [1200, 2100, 1200, 2400, 1800, 2900].forEach((f, i) => a.osc('square', f, f, t + i * 0.05, 0.045, 0.12, o)); a.noise(t + 0.3, 0.25, 0.2, o, 'bandpass', 2500, 2500, 2); },
  tell_sysadmin(a, t, o) { a.osc('sine', 300, 1800, t, 1.0, 0.25, o); [0, 0.35, 0.6, 0.78, 0.9].forEach((d) => a.osc('square', 1500, 1500, t + d, 0.04, 0.15, o)); },
  snipe(a, t, o) { a.noise(t, 0.45, 1.2, o, 'highpass', 1200, 300); a.osc('sine', 180, 40, t, 0.3, 0.9, o); a.osc('square', 1600, 200, t, 0.08, 0.3, o); },
  cancel_sysadmin(a, t, o) { a.osc('square', 900, 250, t, 0.14, 0.18, o); },
  pain_sysadmin(a, t, o) { a.osc('square', 700, 480, t, 0.1, 0.25, o); },
  die_sysadmin(a, t, o) { a.osc('sawtooth', 800, 50, t, 0.9, 0.3, o); [1200, 900, 600].forEach((f, i) => a.osc('square', f, f, t + 0.1 + i * 0.12, 0.05, 0.12, o)); },
  sight_recruiter(a, t, o) { [300, 250, 300, 230].forEach((f, i) => a.osc('sawtooth', f, f * 0.9, t + i * 0.11, 0.09, 0.25, o)); },
  tell_recruiter(a, t, o) { a.noise(t, 0.45, 0.45, o, 'bandpass', 400, 2600, 3); a.osc('sine', 200, 700, t, 0.45, 0.3, o); },
  pain_recruiter(a, t, o) { a.osc('sawtooth', 400, 260, t, 0.15, 0.3, o); },
  die_recruiter(a, t, o) { [440, 554, 659].forEach((f) => a.osc('sine', f, f / 4, t, 1.1, 0.2, o)); a.noise(t, 0.8, 0.4, o, 'lowpass', 2000, 200); },
  revive_recruiter(a, t, o) { [220, 277, 330].forEach((f) => a.osc('sine', f, f * 1.5, t, 0.85, 0.2, o)); a.noise(t, 0.8, 0.25, o, 'bandpass', 5000, 8000, 4); },
  revived(a, t, o) { a.osc('triangle', 880, 880, t, 0.25, 0.25, o); a.osc('triangle', 1320, 1320, t + 0.08, 0.3, 0.2, o); a.osc('sawtooth', 110, 220, t, 0.4, 0.3, o); },
  mark(a, t, o) { a.osc('square', 1200, 1200, t, 0.06, 0.2, o); a.osc('square', 1200, 1200, t + 0.1, 0.06, 0.2, o); },
  pillar(a, t, o) { a.noise(t, 0.8, 1.1, o, 'lowpass', 2600, 100); a.osc('sine', 90, 35, t, 0.5, 0.9, o); a.osc('sawtooth', 220, 60, t, 0.4, 0.3, o); },
});

// Toner-drum hazard stripes: one shared canvas texture.
let hazardTex = null;
function hazard() {
  if (!hazardTex) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#ffd020';
    x.fillRect(0, 0, 32, 8);
    x.fillStyle = '#111';
    for (let i = -8; i < 32; i += 8) for (let y = 0; y < 8; y++) x.fillRect(i + y, y, 4, 1);
    hazardTex = new THREE.CanvasTexture(c);
    hazardTex.magFilter = hazardTex.minFilter = THREE.NearestFilter;
    hazardTex.colorSpace = THREE.SRGBColorSpace;
  }
  return hazardTex;
}

export const STAFF = {
  intern: {
    hp: 20, speed: 4.5, r: 0.35, h: 1.8, range: 30, keep: 7, cd: [1.4, 2.6], tell: 0.45, pain: 0.8, blood: 0x9a0a0a, body: 0xe8e8e0, death: 'back', lie: 0.15,
    build() {
      const k = humanoid({ hip: 0.85, legX: 0.13, legW: 0.16, legD: 0.18, pants: 0x2b2b33, shoe: 0x141414, torso: [0.5, 0.6, 0.28], shirt: 0xe8e8e0, hunch: 0.12, head: [0.3, 0.32, 0.3], skin: 0x9fb08a, armW: 0.12, armL: 0.55 });
      const { part, torso: t, head: h } = k;
      part(t, 0.08, 0.4, 0.02, 0xa01010, 0, 0.36, 0.15); // tie
      part(t, 0.1, 0.13, 0.02, 0xe0c020, -0.15, 0.42, 0.15); // ID badge
      part(t, 0.22, 0.16, 0.02, 0x7a0e0e, 0.1, 0.12, 0.15); // blood
      part(h, 0.33, 0.09, 0.33, 0x2a1a10, 0, 0.36, -0.01); // hair
      part(h, 0.14, 0.07, 0.02, 0x300404, 0, 0.1, 0.16); // gaping mouth
      part(k.armR, 0.08, 0.26, 0.1, 0x181818, 0, -0.7, 0.03); // pistol (along the arm: points forward when raised)
      k.arms.push(k.armR);
      k.swing.push(k.armL);
      return k;
    },
    attack: (g, e, tgt) => pistol(g, e, tgt),
    animate(g, e) {
      // Possessed: the head twitches now and then.
      e.head.rotation.z = Math.sin(g.time * 2.3 + e.seed) > 0.8 && e.staggerT <= 0 ? Math.sin(g.time * 45) * 0.3 : 0;
    },
  },
  manager: {
    hp: 50, speed: 3.8, r: 0.4, h: 1.95, range: 35, keep: 9, cd: [1.6, 2.8], tell: 0.55, pain: 0.5, blood: 0x9a0a0a, body: 0x4a4a55, death: 'crumple', lie: 0.2,
    build() {
      const k = humanoid({ hip: 0.88, legX: 0.15, legW: 0.18, legD: 0.2, pants: 0x34343e, shoe: 0x0e0e0e, torso: [0.62, 0.66, 0.34], shirt: 0x4a4a55, hunch: 0.05, head: [0.34, 0.34, 0.32], skin: 0xc8b8a0, armW: 0.14, armL: 0.6 });
      const { part, pivot, torso: t, head: h } = k;
      part(t, 0.5, 0.3, 0.12, 0x4a4a55, 0, 0.18, 0.2); // gut
      part(t, 0.26, 0.1, 0.04, 0xf0f0e8, 0, 0.6, 0.17); // collar
      part(t, 0.09, 0.3, 0.03, 0xb01818, 0, 0.45, 0.185); // tie
      for (const s of [-1, 1]) part(t, 0.1, 0.36, 0.03, 0x32323a, s * 0.16, 0.46, 0.175); // lapels
      part(t, 0.64, 0.06, 0.36, 0x111111, 0, 0.03, 0); // belt
      part(h, 0.3, 0.04, 0.26, 0x1a1a1a, 0.02, 0.37, 0); // comb-over
      part(h, 0.16, 0.04, 0.02, 0x200000, 0, 0.1, 0.165); // grimace
      for (const s of [-1, 1]) {
        part(h, 0.08, 0.16, 0.08, 0x6a0c0c, s * 0.14, 0.42, 0).rotation.z = -s * 0.4; // horns
        part(h, 0.05, 0.13, 0.05, 0xd02010, s * 0.2, 0.52, 0, true).rotation.z = -s * 0.8;
      }
      // Giant red stapler; the jaw opens on the tell and glows.
      part(k.armR, 0.12, 0.42, 0.1, 0x8a1010, 0, -0.78, 0.03);
      k.jaw = pivot(0, -0.6, 0.09, k.armR);
      part(k.jaw, 0.1, 0.42, 0.06, 0xc02020, 0, -0.18, 0);
      k.maw = part(k.armR, 0.08, 0.34, 0.04, 0xff6010, 0, -0.8, 0.09, true);
      k.arms.push(k.armR);
      k.swing.push(k.armL);
      return k;
    },
    attack(g, e, tgt) {
      aimFrom(e, tgt);
      g.audio.play('stapler', e.pos);
      spawnProjectile(g, 'stapler', muzzle, dir.clone().multiplyScalar(13), e);
    },
    animate(g, e, dt) {
      const tell = e.tellT > 0;
      e.jaw.rotation.x = lerp(e.jaw.rotation.x, tell ? 0.7 : 0, Math.min(1, dt * 12));
      e.maw.visible = tell;
    },
  },
  brute: {
    hp: 160, speed: 4.2, r: 0.75, h: 2.3, range: 18, keep: 0, cd: [1.0, 1.8], tell: 0.5, pain: 0.15, blood: 0x7a1010, body: 0x6b4a2a, strafes: false, death: 'topple', lie: 0.38, stride: 8,
    build() {
      const k = humanoid({ hip: 0.95, legX: 0.3, legW: 0.34, legD: 0.36, pants: 0x4a3020, shoe: 0x1a1008, torso: [1.15, 0.95, 0.7], shirt: 0x6b4a2a, hunch: 0.3, head: [0.42, 0.36, 0.38], headZ: 0.14, skin: 0xb08060, armW: 0.34, armL: 1.0, fist: [0.44, 0.4], hand: 0xa07050 });
      const { part, torso: t, head: h } = k;
      h.position.y = 0.85; // head sunk between the shoulders
      part(t, 0.85, 0.62, 0.06, 0x3060a0, 0, 0.42, 0.36); // mailroom apron
      part(h, 0.46, 0.12, 0.42, 0x2a5090, 0, 0.42, 0); // cap
      part(h, 0.4, 0.04, 0.2, 0x1a3060, 0, 0.38, 0.27); // brim
      for (const s of [-1, 1]) {
        part(h, 0.1, 0.26, 0.1, 0x2a0c0c, s * 0.28, 0.44, 0).rotation.z = -s * 0.9; // horns through the cap
        part(h, 0.07, 0.2, 0.07, 0xe0d0b0, s * 0.42, 0.56, 0).rotation.z = -s * 0.3;
        part(h, 0.05, 0.1, 0.04, 0xe8e0c0, s * 0.1, 0.06, 0.2); // tusks
      }
      for (const a of [k.armL, k.armR]) {
        part(a, 0.38, 0.12, 0.38, 0x5a3a1a, 0, -0.42, 0); // rolled sleeve
        part(a, 0.3, 0.32, 0.06, 0xa02020, 0, -0.72, 0.16); // flesh splitting open
      }
      part(t, 0.8, 0.6, 0.42, 0x9a7040, 0, 0.55, -0.56); // parcel strapped to his back
      part(t, 0.82, 0.08, 0.44, 0xd8c890, 0, 0.6, -0.56);
      k.swing.push(k.armL, k.armR);
      return k;
    },
    startTell(g, e, tgt, dist) {
      e.melee = dist < 2.6;
      if (e.melee || dist > 3.5) return e.melee ? 0.3 : this.tell;
      e.cd = 0.3;
      return 0;
    },
    attack(g, e, tgt) {
      const dist = aimFrom(e, tgt);
      if (e.melee) {
        if (boxDist(center(e, v), tgt.box) < e.r + 1.2) bruteHit(g, e, tgt);
      } else if (dist > 0) {
        e.chargeT = 1.2;
        e.chargeDir.set(dir.x, 0, dir.z).normalize();
      }
    },
    onChargeHit: bruteHit,
    animate(g, e, dt) {
      // Haymaker: fists overhead. Charge wind-up: crouch, arms back like a sprinter. Charging: arms swept back.
      const k = Math.min(1, dt * 16), windup = e.tellT > 0 && !e.melee;
      const arm = e.tellT > 0 ? (e.melee ? -2.7 : 0.8) : e.chargeT > 0 ? 1.0 : null;
      if (arm !== null) for (const a of e.swing) a.rotation.x = lerp(a.rotation.x, arm, k);
      e.torso.rotation.x = lerp(e.torso.rotation.x, 0.3 + (windup ? 0.35 : e.chargeT > 0 ? 0.25 : 0), k);
    },
  },
  printer: {
    hp: 110, speed: 3.2, r: 0.65, h: 1.1, range: 30, keep: 8, cd: [1.8, 3.0], tell: 0.6, pain: 0.3, blood: 0x201040, body: 0xc8c0a8, floats: true, death: 'crash',
    build() {
      const k = kit(), { part, pivot } = k;
      const b = (k.chassis = pivot(0, 0, 0));
      part(b, 1.2, 0.72, 1.0, 0xc8c0a8, 0, 0.56, 0);
      part(b, 1.26, 0.14, 1.06, 0x8a8478, 0, 0.17, 0);
      part(b, 1.16, 0.07, 0.96, 0xa8a090, 0, 0.95, -0.02); // scanner lid
      part(b, 0.8, 0.02, 0.45, 0xf4f0e8, 0, 1.08, -0.42).rotation.x = -0.5; // paper tray
      part(b, 0.95, 0.12, 0.03, 0x0c0808, 0, 0.5, 0.51); // mouth slot
      for (let i = 0; i < 5; i++) part(b, 0.1, 0.1, 0.05, 0xf0ece0, -0.36 + i * 0.18, 0.6, 0.51).rotation.z = Math.PI / 4; // teeth
      for (const s of [-1, 1]) part(b, 0.18, 0.08, 0.03, 0xff2010, s * 0.22, 0.8, 0.51, true); // LED eyes
      for (const s of [-1, 1]) part(b, 0.03, 0.3, 0.5, 0x7020c0, s * 0.61, 0.56, 0, true); // ink windows
      k.maw = part(b, 0.85, 0.08, 0.02, 0x9040ff, 0, 0.5, 0.525, true);
      k.tongue = pivot(0, 0.46, 0.5, b);
      part(k.tongue, 0.75, 0.03, 0.6, 0xf4f0e8, 0, 0, 0.3);
      part(k.tongue, 0.25, 0.04, 0.22, 0x401070, 0.12, 0.01, 0.38);
      k.cables = [];
      for (const [x, z] of [[-0.38, 0.2], [0.32, -0.2], [0.05, 0.32]]) {
        const c = pivot(x, 0.12, z, b);
        part(c, 0.06, 0.45, 0.06, 0x1a1a1a, 0, -0.22, 0);
        part(c, 0.12, 0.1, 0.08, 0xa0a0a0, 0, -0.47, 0); // plug
        k.cables.push(c);
      }
      return k;
    },
    attack(g, e, tgt) {
      aimFrom(e, tgt);
      g.audio.play('ink', e.pos);
      spawnProjectile(g, 'ink', muzzle, dir.clone().multiplyScalar(9), e);
    },
    animate(g, e, dt) {
      const tell = e.tellT > 0, still = e.staggerT > 0, t = g.time + e.seed;
      e.chassis.position.y = still ? 0 : Math.sin(t * 2) * 0.08 + (tell ? Math.sin(t * 50) * 0.03 : 0);
      e.tongue.rotation.x = lerp(e.tongue.rotation.x, tell ? 0.9 : 0.15 + Math.sin(t * 8) * 0.12, Math.min(1, dt * 10));
      e.maw.visible = tell || Math.sin(t * 3) > 0.7;
      for (let i = 0; i < e.cables.length; i++) {
        const c = e.cables[i];
        c.rotation.x = Math.sin(t * 3 + i * 2) * 0.35 - (e.chargeT > 0 ? 0.4 : 0);
        c.rotation.z = Math.cos(t * 2.3 + i) * 0.3;
      }
    },
  },

  // Kamikaze crawler: low, fast, weaving, burning. Within 1.8 m it hisses (0.45 s) and goes off (50 dmg, 3.5 m). Always explodes on death.
  burnout: {
    hp: 15, speed: 9, r: 0.35, h: 0.9, range: 1.8, keep: 0, cd: [0.3, 0.5], tell: 0.45, pain: 0, blood: 0x3a1a10, body: 0x3a3028, strafes: false, weave: 0.55, stride: 24,
    build() {
      const k = kit(), { part, pivot } = k;
      const t = (k.torso = pivot(0, 0.5, 0));
      part(t, 0.42, 0.3, 0.78, 0x3a3028, 0, 0.05, 0); // charred back
      part(t, 0.08, 0.3, 0.03, 0x801010, 0, -0.18, 0.3); // tie dangling under the chest
      for (const z of [-0.24, 0, 0.24]) part(t, 0.14, 0.04, 0.12, 0xff6a10, z * 0.4, 0.21, z, true); // glowing cracks
      const h = (k.head = pivot(0, 0.12, 0.42, t));
      part(h, 0.28, 0.26, 0.28, 0x5a3a28, 0, 0, 0.08);
      for (const s of [-1, 1]) part(h, 0.07, 0.05, 0.02, 0xffd040, s * 0.07, 0.04, 0.23, true);
      part(h, 0.16, 0.08, 0.02, 0xff8020, 0, -0.07, 0.23, true); // burning mouth
      k.flames = [part(h, 0.16, 0.22, 0.16, 0xffa020, -0.03, 0.22, 0.05, true), part(h, 0.1, 0.18, 0.1, 0xff4010, 0.07, 0.25, 0.0, true)];
      for (const f of k.flames) f.userData.h = f.scale.y;
      const limb = (x, z, color, foot) => {
        const l = pivot(x, 0.52, z);
        part(l, 0.1, 0.5, 0.11, color, 0, -0.25, 0);
        part(l, 0.13, 0.06, 0.18, foot, 0, -0.49, 0.05);
        return l;
      };
      // Order gives a diagonal trot (hind L with front R).
      k.legs.push(limb(-0.17, -0.3, 0x2b2b33, 0x111111), limb(0.17, -0.3, 0x2b2b33, 0x111111), limb(0.22, 0.3, 0x8a8478, 0x5a3a28), limb(-0.22, 0.3, 0x8a8478, 0x5a3a28));
      k.glow = k.mat(0xff6a10, true);
      return k;
    },
    attack(g, e) { damageEnemy(g, e, 999, e); },
    onDeath(g, e, src) {
      // Always goes off. The body is spent, so no Recruiter can rehire it.
      if (!e.gibbed) g.fx.gibs(center(e, v), [0x3a3028, 0xff6a10, 0x2b2b33], 8);
      e.gibbed = true;
      e.root.visible = false;
      blast(g, center(e, v).clone(), 3.5, 50, e, { color: 0xff6020, noStyle: src === e }); // a suicide earns the player nothing
    },
    animate(g, e, dt) {
      const hiss = e.tellT > 0, t = g.time + e.seed;
      const s = hiss ? 1 + (1 - e.tellT / 0.45) * 0.45 : 1;
      e.torso.scale.set(s, s, s);
      e.torso.rotation.z = hiss ? Math.sin(t * 80) * 0.14 : 0;
      for (const f of e.flames) f.scale.y = f.userData.h * (0.6 + Math.random() * 0.8) * (hiss ? 1.6 : 1);
      e.glow.emissiveIntensity = hiss ? 2.5 + Math.sin(t * 60) : 1 + Math.sin(t * 6) * 0.3;
      e.emberT = (e.emberT ?? 0) - dt;
      if (e.emberT <= 0 && e.state !== 'sleep') {
        e.emberT = hiss ? 0.03 : 0.12;
        v.set(e.pos.x + Math.sin(e.yaw) * 0.45, e.pos.y + 0.9, e.pos.z + Math.cos(e.yaw) * 0.45);
        if (Math.random() < 0.5 && g.fx.puffs) g.fx.puffs(v, 0x2a2420, 1, 0.5, 0.12, 0.6, 1.5);
        else g.fx.burst(v, 0xff7020, 1, 1.5, 0.07, 0.5);
      }
    },
  },

  // Riot shield (filing-cabinet door) blocks bullets + projectiles from the front 120°. Flank it, splash it, laser it, or axe it.
  compliance: {
    hp: 90, speed: 3.4, r: 0.45, h: 1.95, range: 25, keep: 6, cd: [1.6, 2.6], tell: 0.5, pain: 0.3, blood: 0x9a0a0a, body: 0x284060, turn: 1.6, chargeSpeed: 11, death: 'back', lie: 0.2,
    build() {
      const k = humanoid({ hip: 0.88, legX: 0.14, legW: 0.18, legD: 0.2, pants: 0x1c2a40, shoe: 0x0c0c0c, torso: [0.56, 0.66, 0.34], shirt: 0x284060, hunch: 0.05, head: [0.32, 0.32, 0.3], skin: 0xc0a890, armW: 0.14, armL: 0.58 });
      const { part, pivot, torso: t, head: h } = k;
      part(t, 0.58, 0.07, 0.36, 0x101010, 0, 0.04, 0); // belt
      part(t, 0.1, 0.07, 0.02, 0xd0a020, 0, 0.04, 0.185); // buckle
      for (const s of [-1, 1]) part(t, 0.2, 0.08, 0.36, 0x1a2638, s * 0.3, 0.64, 0); // shoulder pads
      part(h, 0.36, 0.11, 0.34, 0x1c2a40, 0, 0.37, 0); // peaked cap
      part(h, 0.34, 0.03, 0.14, 0x080808, 0, 0.33, 0.21);
      part(h, 0.08, 0.07, 0.02, 0xe0b020, 0, 0.38, 0.175); // badge
      // The shield: a filing-cabinet front with two drawers and a DENIED stamp.
      const sh = (k.shield = pivot(-0.05, 0.3, 0.4, t));
      part(sh, 0.92, 1.12, 0.08, 0xa8a490, 0, 0, 0);
      part(sh, 0.88, 0.03, 0.02, 0x3a3a34, 0, 0.02, 0.05);
      for (const y of [0.28, -0.28]) {
        part(sh, 0.26, 0.05, 0.06, 0x5a5a52, 0, y, 0.07);
        part(sh, 0.16, 0.08, 0.02, 0xece4cc, 0, y + 0.12, 0.05);
      }
      part(sh, 0.34, 0.12, 0.02, 0xc01818, 0.14, -0.44, 0.05).rotation.z = 0.25;
      k.plate = part(sh, 0.96, 1.16, 0.02, 0xfff0c0, 0, 0, 0.08, true); // block flash
      k.plate.visible = false;
      k.armL.rotation.x = -1.1;
      // Clipboard in the throwing hand.
      k.board = pivot(0, -0.68, 0.06, k.armR);
      part(k.board, 0.04, 0.34, 0.28, 0x8a6a3a, 0, 0, 0);
      part(k.board, 0.02, 0.26, 0.22, 0xf0ece0, 0.025, -0.02, 0);
      part(k.board, 0.06, 0.05, 0.1, 0xb0b0b8, 0.01, 0.16, 0);
      k.swing.push(k.armR);
      return k;
    },
    onDamage(g, e, dmg, src, weapon, opts) {
      if (opts.pierce || e.shieldT > 0) return dmg;
      const from = opts.from ?? (src === 'player' ? g.player.pos : src.pos);
      const fx = from.x - e.pos.x, fz = from.z - e.pos.z, l = Math.hypot(fx, fz) || 1;
      if ((fx * Math.sin(e.yaw) + fz * Math.cos(e.yaw)) / l < 0.5) return dmg; // flank/back: 120° frontal cone only
      if (weapon === 'axe') {
        // Axe knocks the shield aside: 1.5 s window, and he's dazed.
        e.shieldT = 1.5;
        e.painT = 0.6;
        e.tellT = e.chargeT = 0;
        g.audio.play('shield_drop', e.pos);
        return dmg;
      }
      if (g.time - (e.pingAt ?? -1) > 0.05) {
        e.pingAt = g.time;
        g.audio.play('ping', e.pos);
        v.set(e.pos.x + (fx / l) * 0.6, e.pos.y + 1.25, e.pos.z + (fz / l) * 0.6);
        if (g.fx.sparks) g.fx.sparks(v, { x: fx / l, y: 0.2, z: fz / l }, 10, 8);
        else g.fx.burst(v, 0xfff0a0, 7, 5, 0.06, 0.3);
      }
      return 0;
    },
    startTell(g, e, tgt, dist) {
      if (e.shieldT > 0) return 0;
      e.bash = dist < 3.6;
      return e.bash ? 0.45 : 0.55;
    },
    attack(g, e, tgt) {
      aimFrom(e, tgt);
      if (e.bash) {
        e.chargeT = 0.4;
        e.chargeDir.set(dir.x, 0, dir.z).normalize();
        return;
      }
      muzzle.set(e.pos.x + Math.cos(e.yaw) * 0.3 + Math.sin(e.yaw) * 0.4, e.pos.y + 1.7, e.pos.z - Math.sin(e.yaw) * 0.3 + Math.cos(e.yaw) * 0.4);
      dir.subVectors(v, muzzle).normalize();
      g.audio.play('throw', e.pos);
      spawnProjectile(g, 'clipboard', muzzle, dir.clone().multiplyScalar(24), e);
      e.throwT = 0.6;
    },
    onChargeHit(g, e, tgt) {
      e.chargeT = 0;
      e.cd = 1.2;
      g.audio.play('bash', e.pos);
      if (tgt === g.player) shove(g, e, 20, 11, 3.5);
      else damageEnemy(g, tgt, 20, e, null, { from: e.pos });
    },
    animate(g, e, dt) {
      e.shieldT = (e.shieldT ?? 0) - dt;
      e.throwT = (e.throwT ?? 0) - dt;
      const down = e.shieldT > 0, k = Math.min(1, dt * 10), sh = e.shield;
      e.plate.visible = g.time - (e.pingAt ?? -1) < 0.07;
      sh.rotation.x = lerp(sh.rotation.x, down ? 1.2 : 0, k);
      sh.rotation.z = lerp(sh.rotation.z, down ? 0.5 : 0, k);
      sh.position.y = lerp(sh.position.y, down ? 0.0 : 0.3, k);
      sh.position.z = lerp(sh.position.z, e.chargeT > 0 ? 0.62 : e.tellT > 0 && e.bash ? 0.22 : 0.4, k);
      e.armL.rotation.x = lerp(e.armL.rotation.x, down ? -0.2 : -1.1, k);
      // Throw: cock the clipboard back over the shoulder, then snap through (it's in the air for a moment).
      if (e.tellT > 0 && !e.bash) e.armR.rotation.x = lerp(e.armR.rotation.x, -2.8, k);
      else if (e.throwT > 0.4) e.armR.rotation.x = lerp(e.armR.rotation.x, -0.9, Math.min(1, dt * 25));
      e.board.visible = e.throwT <= 0.1;
    },
  },

  // Sniper: keeps 18–25 m, 1.0 s red laser tell that tracks you, then 25 dmg. Break line of sight to cancel.
  sysadmin: {
    hp: 40, speed: 3.0, r: 0.35, h: 1.85, range: 40, keep: 21, cd: [2.7, 3.7], tell: 1.0, pain: 0.6, blood: 0x9a0a0a, body: 0x3a4a3a, retreat: true, death: 'spin', lie: 0.15,
    build() {
      const k = humanoid({ hip: 0.92, legX: 0.11, legW: 0.14, legD: 0.16, pants: 0x2a3040, shoe: 0xd0d0c8, torso: [0.46, 0.6, 0.28], shirt: 0x3a4a3a, hunch: 0.1, head: [0.3, 0.3, 0.28], skin: 0xa8b0a0, eye: 0x60ff60, armW: 0.12, armL: 0.58 });
      const { part, pivot, torso: t, head: h } = k;
      part(h, 0.38, 0.38, 0.3, 0x2e3c2e, 0, 0.18, -0.05); // hood up
      part(h, 0.3, 0.08, 0.02, 0x0a0a0a, 0, 0.18, 0.145); // glasses frame (lenses = the green eyes)
      part(h, 0.42, 0.05, 0.08, 0x151515, 0, 0.39, 0); // headset
      for (const s of [-1, 1]) part(h, 0.07, 0.13, 0.13, 0x151515, s * 0.21, 0.18, 0);
      part(h, 0.03, 0.03, 0.2, 0x151515, 0.17, 0.08, 0.1); // mic boom
      part(t, 0.38, 0.5, 0.2, 0x2a2a2e, 0, 0.32, -0.24); // server backpack
      part(t, 0.04, 0.3, 0.02, 0x40ff60, -0.1, 0.34, -0.345, true);
      part(t, 0.04, 0.2, 0.02, 0xffa020, 0.02, 0.3, -0.345, true);
      part(t, 0.03, 0.7, 0.03, 0x202020, 0.14, 0.85, -0.26); // antenna
      k.tip = part(t, 0.08, 0.08, 0.08, 0xffa020, 0.14, 1.22, -0.26, true);
      k.gun = pivot(0.08, 0.42, 0.16, t);
      part(k.gun, 0.07, 0.07, 1.05, 0x1a1a1a, 0, 0, 0.36); // barrel
      part(k.gun, 0.09, 0.16, 0.3, 0x3a3020, 0, -0.05, -0.18); // stock
      part(k.gun, 0.08, 0.08, 0.3, 0x2a2a2a, 0, 0.08, 0.18); // scope
      k.glint = part(k.gun, 0.06, 0.06, 0.06, 0xff2020, 0, 0.08, 0.35, true); // laser emitter: flares up on the tell
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      k.laser = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff1010 }));
      k.laser.frustumCulled = false;
      k.laser.visible = false;
      return k;
    },
    attack(g, e, tgt) {
      e.laser.visible = false;
      eye.set(e.pos.x, e.pos.y + 1.45, e.pos.z);
      center(tgt, v);
      if (!losClear(g, eye, v)) return;
      dir.subVectors(v, eye);
      const dist = dir.length();
      dir.divideScalar(dist);
      laserFrom(e, muzzle);
      e.recoil = 0.35;
      g.audio.play('snipe', e.pos);
      g.fx.burst(muzzle, 0xffe0a0, 6, 3, 0.07, 0.2);
      const h = hitscan(g, eye, dir, dist, e);
      if (h.enemy) {
        g.fx.tracer(muzzle, eye.clone().addScaledVector(dir, h.t), 0xfff4d0);
        return void damageEnemy(g, h.enemy, 25, e, null, { from: e.pos });
      }
      g.fx.tracer(muzzle, v, 0xfff4d0);
      if (tgt === g.player) hurtPlayer(g, 25, e.pos);
      else damageEnemy(g, tgt, 25, e, null, { from: e.pos });
    },
    animate(g, e, dt) {
      e.recoil = (e.recoil ?? 0) - dt;
      const tgt = e.target ?? g.player, aiming = e.tellT > 0 || e.recoil > 0, k = Math.min(1, dt * 10);
      const pitch = Math.atan2(tgt.pos.y + tgt.h * 0.5 - e.pos.y - 1.45, Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z));
      e.gun.rotation.x = lerp(e.gun.rotation.x, aiming ? -pitch - 0.1 : 0.7, k);
      e.gun.position.z = 0.16 - Math.max(0, e.recoil - 0.2) * 0.8;
      e.armR.rotation.x = lerp(e.armR.rotation.x, aiming ? -1.35 : -0.55, k);
      e.armL.rotation.x = lerp(e.armL.rotation.x, aiming ? -1.55 : -0.8, k);
      e.armL.rotation.z = lerp(e.armL.rotation.z, aiming ? -0.35 : 0, k);
      if (aiming && e.staggerT <= 0) e.head.rotation.x = 0.12; // cheek on the stock
      e.tip.visible = Math.sin(g.time * 4 + e.seed) > 0;
      e.glint.scale.setScalar(e.tellT > 0 && e.staggerT <= 0 ? 0.14 + Math.sin(g.time * 40) * 0.04 : 0.06);
      const L = e.laser;
      if (e.tellT <= 0 || e.staggerT > 0) return void (L.visible = false);
      eye.set(e.pos.x, e.pos.y + 1.45, e.pos.z);
      center(tgt, v);
      if (!losClear(g, eye, v)) {
        // Lost you: the shot is cancelled.
        e.tellT = 0;
        e.cd = 0.7;
        L.visible = false;
        g.audio.play('cancel_sysadmin', e.pos);
        return;
      }
      if (L.parent !== g.scene) g.scene.add(L);
      laserFrom(e, muzzle);
      const a = L.geometry.attributes.position;
      a.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
      a.setXYZ(1, v.x, v.y, v.z);
      a.needsUpdate = true;
      // Last 0.3 s: the beam strobes and whitens. Move or hide NOW.
      L.visible = e.tellT > 0.3 || Math.sin(g.time * 70) > 0;
      L.material.color.setHex(e.tellT > 0.3 ? 0xff1010 : 0xff7070);
    },
    onDeath(g, e) {
      e.laser.visible = false;
      g.scene.remove(e.laser);
    },
  },

  // Evasive necromancer-HR: every ~4 s rehires the nearest intact corpse (0.8 s channel, pain interrupts).
  // Attack: red ring at your feet, fire pillar 0.9 s later.
  recruiter: {
    hp: 100, speed: 5.5, r: 0.4, h: 2.0, range: 30, keep: 12, cd: [2.2, 3.2], tell: 0.5, pain: 0.4, blood: 0x6a0a2a, body: 0x3a2448, retreat: true, jitter: 2.5, death: 'melt',
    build() {
      const k = humanoid({ hip: 0.95, legX: 0.12, legW: 0.15, legD: 0.18, pants: 0x241828, shoe: 0x080808, torso: [0.5, 0.7, 0.3], shirt: 0x3a2448, hunch: -0.05, head: [0.3, 0.36, 0.3], skin: 0xd8c0b0, eye: 0xc040ff, armW: 0.12, armL: 0.7, hand: 0xa040ff, handGlow: true });
      const { part, pivot, torso: t, head: h } = k;
      for (const s of [-1, 1]) part(t, 0.22, 0.42, 0.04, 0x3a2448, s * 0.12, -0.14, -0.15); // coat tails
      part(t, 0.2, 0.14, 0.03, 0xf0e8e0, 0, 0.62, 0.155); // collar
      part(t, 0.08, 0.4, 0.03, 0xd02070, 0, 0.42, 0.165); // tie
      part(h, 0.32, 0.08, 0.32, 0x0a0a0a, 0, 0.38, -0.02); // slick hair
      part(h, 0.22, 0.05, 0.02, 0xfff0d0, 0, 0.1, 0.155, true); // the grin
      for (const s of [-1, 1]) {
        part(h, 0.1, 0.28, 0.1, 0x1a1010, s * 0.18, 0.48, -0.04).rotation.set(-0.3, 0, -s * 0.7); // ram horns:
        part(h, 0.08, 0.26, 0.08, 0x2a1414, s * 0.32, 0.6, -0.14).rotation.set(-0.9, 0, -s * 0.2); // out, up, back,
        part(h, 0.06, 0.18, 0.06, 0xd8d0b0, s * 0.36, 0.62, -0.3).rotation.x = -2.2; // ivory tips curling down
      }
      part(k.armL, 0.06, 0.06, 0.32, 0xe8d8a0, 0, -0.78, 0.12); // the contract
      k.halo = pivot(0, 0.72, 0, h); // orbiting business cards
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        part(k.halo, 0.16, 0.02, 0.1, 0xf8f8f0, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, true).rotation.y = -a;
      }
      k.palm = k.mat(0xa040ff, true);
      k.card = k.mat(0xf8f8f0, true);
      for (const hnd of k.hands) hnd.userData.s = hnd.scale.clone();
      k.arms.push(k.armR);
      k.swing.push(k.armL);
      return k;
    },
    think(g, e, dt) {
      e.reviveCD = (e.reviveCD ?? 1.5) - dt;
      if (e.reviveT > 0) {
        const c = e.reviveTarget;
        if (e.painT > 0 || !c.dead || c.gibbed) {
          stopRevive(g, e, 2); // interrupted
          return false;
        }
        e.painT -= dt;
        e.reviveT -= dt;
        e.yaw = Math.atan2(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
        c.root.position.x = c.pos.x + Math.sin(g.time * 60) * 0.04; // the corpse twitches
        if (Math.random() < dt * 30) g.fx.burst(v.set(c.pos.x + Math.random() - 0.5, c.pos.y + 0.2, c.pos.z + Math.random() - 0.5), 0xb050ff, 2, 3, 0.08, 0.6);
        if (e.reviveT <= 0) {
          stopRevive(g, e, 4);
          if (revive(g, c)) {
            g.audio.play('revived', c.pos);
            g.fx.burst(center(c, v), 0xc060ff, 24, 6, 0.12, 0.7);
          }
          e.cd = Math.max(e.cd, 0.8);
        }
        return true;
      }
      if (e.reviveCD > 0 || e.tellT > 0 || e.painT > 0) return false;
      e.reviveCD = 0.5;
      let best = null, bd = 14;
      for (const c of g.enemies) {
        if (!c.dead || c.gibbed || !c.active || c.def.prop || c.def.boss || c.deadT < 0.8) continue;
        const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) return false;
      e.reviveT = 0.8;
      e.reviveTarget = best;
      e.reviveCD = 4;
      e.painT = 0;
      g.audio.play('revive_recruiter', e.pos);
      return true;
    },
    attack(g, e, tgt) {
      v.set(tgt.pos.x, tgt.pos.y + 0.3, tgt.pos.z);
      const t = raycast(g.solids, v, DOWN, 30);
      v.y -= Math.min(t, 30) - 0.02;
      spawnProjectile(g, 'mark', v, ZERO.clone(), e);
      g.audio.play('mark', v);
    },
    animate(g, e, dt) {
      if (e.staggerT > 0 && e.reviveT > 0) stopRevive(g, e, 2);
      const ch = e.reviveT > 0, k = Math.min(1, dt * 10), t = g.time + e.seed;
      e.halo.rotation.y += dt * (ch ? 14 : 2);
      e.halo.position.y = 0.72 + Math.sin(t * 2) * 0.04;
      const f = ch ? 1.7 + Math.sin(t * 30) * 0.3 : e.tellT > 0 ? 1.4 : 1;
      for (const hnd of e.hands) hnd.scale.copy(hnd.userData.s).multiplyScalar(f);
      e.palm.emissiveIntensity = ch ? 2.5 : 1;
      e.card.emissiveIntensity = ch ? 2 : 0.6;
      if (ch) {
        for (const a of [e.armL, e.armR]) a.rotation.x = lerp(a.rotation.x, -2.7, k);
        e.head.rotation.x = lerp(e.head.rotation.x, -0.35, k);
      }
    },
    onDeath(g, e) { if (e.reviveT > 0) stopRevive(g, e, 4); },
  },

  // Explosive toner drum: a prop, not a monster. Shootable, chain-reacts, never counted as a kill.
  drum: {
    hp: 30, r: 0.45, h: 1.1, pain: 0, blood: 0x202020, body: 0x151515, prop: true,
    build() {
      const k = kit(), { part, root } = k;
      const oct = (w, h, y, color) => { for (const r of [0, Math.PI / 4]) part(root, w, h, w, color, 0, y, 0).rotation.y = r; };
      oct(0.8, 1.04, 0.52, 0x1a1a1e); // eight-sided drum
      oct(0.86, 0.06, 0.08, 0x2a2a30); // rolling hoops
      oct(0.86, 0.06, 0.98, 0x2a2a30);
      const stripe = new THREE.MeshLambertMaterial({ map: hazard(), emissive: 0 });
      k.mats.push(stripe);
      for (const r of [0, Math.PI / 4]) {
        const m = new THREE.Mesh(cube, stripe);
        m.scale.set(0.84, 0.2, 0.84);
        m.position.y = 0.68;
        m.rotation.y = r;
        root.add(m);
      }
      oct(0.84, 0.08, 0.4, 0xc01880); // toner-magenta band
      part(root, 0.5, 0.05, 0.5, 0x333338, 0, 1.06, 0); // lid
      part(root, 0.12, 0.07, 0.12, 0x9a9aa0, 0.17, 1.1, 0.12); // bung
      part(root, 0.22, 0.2, 0.02, 0xffd020, 0, 0.32, 0.405, true); // warning label
      part(root, 0.06, 0.1, 0.01, 0x101010, 0, 0.32, 0.418);
      return k;
    },
    onDeath(g, e) { blast(g, center(e, v).clone(), 4, 90, e, { color: 0xff8a20 }); },
  },
};

// Scope tip in world space (yaw-rotated local offset; close enough for a 1-px beam).
function laserFrom(e, out) {
  const s = Math.sin(e.yaw), c = Math.cos(e.yaw), x = 0.08, z = 0.75;
  return out.set(e.pos.x + x * c + z * s, e.pos.y + 1.42, e.pos.z - x * s + z * c);
}

function stopRevive(g, e, cooldown) {
  const c = e.reviveTarget;
  if (c?.dead) c.root.position.x = c.pos.x;
  e.reviveT = 0;
  e.reviveTarget = null;
  e.reviveCD = cooldown;
}
