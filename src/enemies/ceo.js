import * as THREE from 'three';
import { moveBody } from '../physics.js';
import { hurtPlayer, damageEnemy, spawnProjectile, blast, addEnemy } from '../world.js';
import { registerProjectiles } from '../projectiles.js';
import { registerSounds } from '../audio.js';
import { wake } from './index.js';

// THE CEO. A 4 m demonic executive who runs the whole fight from think(): a small state machine per phase.
//   P1 "Quarterly Results" (100–66 %): 5-fireball fan (0.6 s raise) · ground slam (0.9 s, red ring) → jumpable shockwave (20)
//   P2 "Restructuring"     (66–33 %): + hiring spree (at 66 % and 50 %) · + bull charge (1 s tell, stuns on walls)
//   P3 "Golden Parachute"  (33–0 %):  cooldowns ×0.7 · 9-fireball fan · sometimes a double slam · 2 burnouts every 10 s
// Phase thresholds clamp damage, so every phase is seen. Dying is a 2.6 s sequence, then the real kill.
// Level hooks (optional): g.level.bossBounds {x0,x1,z0,z1}, g.level.bossStart(g), g.level.bossDefeated(g).

const cube = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.CylinderGeometry(1, 1, 0.6, 28, 1, true);
const flatRing = new THREE.RingGeometry(0.8, 1, 28);
const v = new THREE.Vector3(), o = new THREE.Vector3();
const G = 28, TAU = Math.PI * 2;
const PH_NAME = ['', 'QUARTERLY RESULTS', 'RESTRUCTURING', 'GOLDEN PARACHUTE'];

registerProjectiles({
  memo: { dmg: 14, splash: 0, gravity: 0, radius: 0.35, trail: 0xffa030, parts: [[0.5, 0.5, 0.5, 0xff7a10, true], [0.28, 0.28, 0.8, 0xffe070, true]] },
});

registerSounds({
  sight_ceo(a, t, o) { SND.roar(a, t, o); },
  ceo_roar(a, t, o) { SND.roar(a, t, o); },
  ceo_laugh(a, t, o) { for (let i = 0; i < 4; i++) { a.osc('sawtooth', 170 - i * 8, 120 - i * 6, t + i * 0.2, 0.16, 0.5, o); a.noise(t + i * 0.2, 0.12, 0.25, o, 'bandpass', 700, 500, 3); } },
  ceo_fan(a, t, o) { a.osc('sawtooth', 140, 620, t, 0.6, 0.35, o); a.noise(t, 0.6, 0.35, o, 'bandpass', 400, 3000, 3); },
  ceo_fire(a, t, o) { a.noise(t, 0.35, 0.8, o, 'bandpass', 600, 2400, 1.5); a.osc('sine', 260, 70, t, 0.3, 0.7, o); },
  ceo_slamtell(a, t, o) { a.osc('sine', 45, 120, t, 0.9, 0.6, o); a.noise(t, 0.9, 0.35, o, 'lowpass', 200, 900); a.osc('square', 220, 440, t + 0.5, 0.4, 0.12, o); },
  ceo_slam(a, t, o) { a.osc('sine', 95, 25, t, 0.9, 1.2, o); a.noise(t, 1.3, 1.3, o, 'lowpass', 2200, 50); a.osc('square', 60, 28, t, 0.5, 0.4, o); },
  ceo_charge(a, t, o) {
    a.noise(t, 0.18, 0.7, o, 'bandpass', 500, 300, 2); a.noise(t + 0.35, 0.18, 0.7, o, 'bandpass', 500, 300, 2);
    a.osc('sawtooth', 60, 160, t + 0.2, 0.8, 0.5, o);
  },
  ceo_stomp(a, t, o) { a.osc('sine', 80, 30, t, 0.25, 0.8, o); a.noise(t, 0.15, 0.4, o, 'lowpass', 600, 100); },
  ceo_crash(a, t, o) { a.noise(t, 0.8, 1.2, o, 'lowpass', 3000, 80); a.osc('square', 110, 40, t, 0.4, 0.6, o); [880, 660].forEach((f, i) => a.osc('square', f, f, t + 0.3 + i * 0.15, 0.1, 0.15, o)); },
  ceo_summon(a, t, o) { [0, 3, 7, 10, 12].forEach((n, i) => a.osc('square', 220 * 2 ** (n / 12), 220 * 2 ** (n / 12), t + i * 0.09, 0.2, 0.18, o)); a.noise(t, 1, 0.4, o, 'bandpass', 300, 2500, 2); },
  ceo_phase(a, t, o) { SND.roar(a, t, o); [55, 82.5, 110].forEach((f) => a.osc('sawtooth', f, f * 0.97, t, 2.2, 0.3, o)); a.noise(t, 2, 0.5, o, 'highpass', 4000, 1500); },
  ceo_ping(a, t, o) { a.osc('square', 1900, 1500, t, 0.08, 0.2, o); },
  ceo_death(a, t, o) {
    a.osc('sawtooth', 320, 25, t, 3.2, 0.7, o); a.osc('sawtooth', 330, 27, t, 3.2, 0.5, o);
    a.noise(t, 3, 0.8, o, 'lowpass', 2500, 80);
    [523, 415, 330, 262].forEach((f, i) => a.osc('square', f, f, t + 0.5 + i * 0.35, 0.3, 0.15, o));
  },
});
const SND = {
  roar(a, t, o) {
    a.osc('sawtooth', 95, 50, t, 1.5, 0.7, o); a.osc('sawtooth', 101, 47, t, 1.5, 0.5, o);
    a.osc('square', 190, 80, t, 1.1, 0.25, o); a.noise(t, 1.4, 0.7, o, 'lowpass', 900, 150);
  },
};

function build() {
  const root = new THREE.Group(), mats = [], cache = new Map();
  const mat = (color) => {
    if (!cache.has(color)) { const m = new THREE.MeshLambertMaterial({ color }); cache.set(color, m); mats.push(m); }
    return cache.get(color);
  };
  const part = (parent, w, h, d, color, x, y, z, m = mat(color)) => {
    const mesh = new THREE.Mesh(cube, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  const SUIT = 0x2e2a44, STRIPE = 0x5a5a7a, SKIN = 0x8a1c14, SHIRT = 0xe8e4d8, HORN = 0xd8c8a0, GOLD = glow(0xffc020);

  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(root, s * 0.55, 1.8, 0);
    part(l, 0.62, 1.8, 0.66, SUIT, 0, -0.9, 0);
    part(l, 0.04, 1.6, 0.04, STRIPE, 0.15, -0.9, 0.34);
    part(l, 0.72, 0.3, 1.05, 0x0c0c0e, 0, -1.65, 0.15);
    legs.push(l);
  }
  const body = pivot(root, 0, 1.8, 0);
  part(body, 1.7, 0.4, 0.95, SUIT, 0, 0.1, 0);
  part(body, 0.34, 0.24, 0.05, 0, 0, 0.1, 0.49, GOLD);
  part(body, 2.1, 1.55, 1.15, SUIT, 0, 1.0, 0);
  for (const x of [-0.85, -0.6, 0.6, 0.85]) part(body, 0.04, 1.4, 0.02, STRIPE, x, 1.0, 0.58);
  part(body, 0.6, 1.1, 0.02, SHIRT, 0, 1.2, 0.585);
  for (const s of [-1, 1]) part(body, 0.32, 1.0, 0.03, 0x111118, s * 0.42, 1.25, 0.59).rotation.z = s * 0.28;
  part(body, 0.24, 0.95, 0.05, 0, 0, 1.15, 0.61, GOLD); // the golden tie
  part(body, 0.34, 0.2, 0.07, 0, 0, 1.66, 0.61, GOLD);
  part(body, 0.26, 0.14, 0.03, 0xc01818, 0.72, 1.45, 0.59);
  part(body, 2.55, 0.38, 1.25, SUIT, 0, 1.65, 0);
  part(body, 0.55, 0.3, 0.55, SKIN, 0, 1.9, 0);

  const head = pivot(body, 0, 2.4, 0.05);
  part(head, 0.95, 0.95, 0.9, SKIN, 0, 0, 0);
  part(head, 1.05, 0.38, 0.98, 0x701410, 0, -0.33, 0.02);
  part(head, 1.02, 0.24, 0.96, 0x0a0a0c, 0, 0.5, -0.02);
  const eyeMat = glow(0xffd040);
  for (const s of [-1, 1]) {
    part(head, 0.24, 0.11, 0.05, 0, s * 0.22, 0.08, 0.46, eyeMat);
    part(head, 0.32, 0.08, 0.06, 0x200808, s * 0.22, 0.2, 0.46).rotation.z = s * 0.35; // angry brows
    // Horns: three segments curling up and out.
    part(head, 0.24, 0.6, 0.24, HORN, s * 0.55, 0.55, 0).rotation.z = -s * 0.55;
    part(head, 0.18, 0.55, 0.18, 0xb09870, s * 0.82, 1.0, 0).rotation.z = -s * 0.2;
    part(head, 0.11, 0.4, 0.11, 0x2a1a10, s * 0.88, 1.42, 0).rotation.z = s * 0.25;
  }
  part(head, 0.62, 0.12, 0.04, 0x080404, 0, -0.3, 0.5);
  for (const x of [-0.22, -0.07, 0.07, 0.22]) part(head, 0.07, 0.08, 0.04, 0xf0f0e0, x, -0.26, 0.52);
  const stars = pivot(head, 0, 0.95, 0);
  for (let i = 0; i < 3; i++) part(stars, 0.16, 0.16, 0.16, 0, Math.cos(i * 2.1) * 0.75, 0, Math.sin(i * 2.1) * 0.75, glow(0xffee40));
  stars.visible = false;

  const arms = [], palms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, s * 1.35, 1.55, 0);
    part(a, 0.52, 1.6, 0.56, SUIT, 0, -0.8, 0);
    part(a, 0.58, 0.16, 0.62, SHIRT, 0, -1.56, 0);
    part(a, 0.1, 0.1, 0.1, 0, s * 0.3, -1.56, 0.1, GOLD);
    part(a, 0.52, 0.5, 0.52, SKIN, 0, -1.85, 0);
    for (const x of [-0.16, 0, 0.16]) part(a, 0.08, 0.22, 0.08, 0x1a0a08, x, -2.15, 0.12);
    const palm = part(a, 0.7, 0.7, 0.7, 0, 0, -1.9, 0, new THREE.MeshBasicMaterial({ color: 0xff8020, transparent: true, opacity: 0.6 }));
    palm.visible = false;
    palms.push(palm);
    arms.push(a);
  }
  // The briefcase (left hand). Its lid opens for the hiring spree.
  const caseG = pivot(arms[0], 0, -2.3, 0.15);
  part(caseG, 0.25, 0.75, 1.0, 0x2a160c, 0, -0.3, 0);
  part(caseG, 0.27, 0.12, 0.25, 0, 0, -0.05, 0, GOLD);
  const lid = pivot(caseG, 0.13, -0.68, 0);
  part(lid, 0.06, 0.1, 1.0, 0x3a2010, 0, 0.05, 0);
  const papers = part(caseG, 0.02, 0.6, 0.9, 0, 0.14, -0.3, 0, glow(0xff3020));
  papers.visible = false;

  // Fireball forming in front of the chest during the fan tell.
  const orb = part(body, 1, 1, 1, 0, 0, 1.2, 1.5, new THREE.MeshBasicMaterial({ color: 0xffa020 }));
  orb.scale.setScalar(0.01);
  orb.visible = false;
  // Phase 3 golden parachute: canopy + lines, hidden until it pops.
  const chute = pivot(body, 0, 4.4, -0.6);
  for (let i = -2; i <= 2; i++) {
    const seg = part(chute, 1.25, 0.25, 2.2, i % 2 ? 0xc01818 : 0xffc020, i * 1.15, -Math.abs(i) * Math.abs(i) * 0.18, 0);
    seg.rotation.z = -i * 0.22;
  }
  for (const s of [-1, 1]) part(chute, 0.05, 2.9, 0.05, 0xd0d0d0, s * 1.55, -1.5, 0).rotation.z = s * 0.38;
  chute.visible = false;
  chute.scale.setScalar(0.01);

  // Telegraphs on the floor: red slam ring (the close-blast zone) and the orange charge lane.
  const slamRing = new THREE.Mesh(flatRing, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  slamRing.rotation.x = -Math.PI / 2;
  slamRing.position.y = 0.06;
  slamRing.visible = false;
  root.add(slamRing);
  const lane = part(root, 2.6, 0.03, 24, 0, 0, 0.09, 13, new THREE.MeshBasicMaterial({ color: 0xff7018, transparent: true, opacity: 0.6, depthWrite: false }));
  lane.visible = false;
  const light = new THREE.PointLight(0xff5020, 6, 14, 1);
  light.position.set(0, 1.4, 1.6);
  body.add(light);

  return { root, mats, legs, arms: [], limbs: arms, body, head, palms, lid, papers, orb, chute, stars, slamRing, lane, eyeMat, light };
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (cur, to, k) => cur + (to - cur) * Math.min(1, k);
const rand = (a, b) => a + Math.random() * (b - a);
const cdMul = (e) => (e.ph >= 3 ? 0.7 : 1);

function setAct(e, act, t) { e.act = act; e.actT = t; e.actMax = t; e.fired = false; }

function toIdle(e, cd) { setAct(e, 'idle', 0); e.cd = cd * cdMul(e); }

function boundsOf(g) { return g.level.bossBounds ?? { x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9 }; }

function free(g, x, z, r) {
  for (const s of g.solids) if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1 && s.y1 > 0.1 && s.y0 < 2) return false;
  return true;
}

function muzzle(e) {
  return o.set(e.pos.x + Math.sin(e.yaw) * 1.6, e.pos.y + 3.0, e.pos.z + Math.cos(e.yaw) * 1.6);
}

function fireFan(g, e) {
  const p = g.player, n = e.ph >= 3 ? 9 : 5, spread = e.ph >= 3 ? 0.13 : 0.17, speed = e.ph >= 3 ? 17 : 15;
  const from = muzzle(e).clone();
  v.set(p.pos.x, p.pos.y + 1.0, p.pos.z).sub(from);
  const flat = Math.hypot(v.x, v.z), base = Math.atan2(v.x, v.z), pitch = Math.atan2(v.y, flat);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(pitch), Math.sin(pitch), Math.cos(a) * Math.cos(pitch));
    spawnProjectile(g, 'memo', from, dir.multiplyScalar(speed), e);
  }
  g.fx.burst(from, 0xffa020, 20, 6, 0.15, 0.4);
  g.audio.play('ceo_fire', e.pos);
  g.shake += 0.15;
}

// Ground slam: close blast + an expanding shockwave ring 0.6 m tall. Jump it (or dash through it).
function slam(g, e) {
  const at = new THREE.Vector3(e.pos.x + Math.sin(e.yaw) * 1.2, e.pos.y + 0.3, e.pos.z + Math.cos(e.yaw) * 1.2);
  blast(g, at, 4.2, 30, e, { color: 0xff6020, knock: 16 });
  g.audio.play('ceo_slam', e.pos);
  g.fx.burst(at, 0x8a8078, 30, 9, 0.25, 1.0);
  g.fx.decal?.(at.clone(), { x: 0, y: 1, z: 0 }, 'scorch', 3);
  g.shake += 0.7;
  const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  const top = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff0a0, side: THREE.DoubleSide }));
  top.scale.set(1.02, 0.2, 1.02);
  top.position.y = 0.3;
  mesh.add(top);
  mesh.position.set(at.x, e.pos.y + 0.3, at.z);
  g.scene.add(mesh);
  e.rings.push({ mesh, x: at.x, z: at.z, y: e.pos.y, R: 1.5, hit: false });
}

function updateRings(g, e, dt) {
  const p = g.player;
  for (let i = e.rings.length - 1; i >= 0; i--) {
    const r = e.rings[i], R0 = r.R;
    r.R += 14 * dt;
    r.mesh.scale.set(r.R, 1, r.R);
    r.mesh.material.opacity = 0.95 * Math.max(0.35, 1 - r.R / 45);
    if (Math.random() < 0.7) {
      const a = Math.random() * TAU;
      g.fx.burst(v.set(r.x + Math.sin(a) * r.R, r.y + 0.5, r.z + Math.cos(a) * r.R), 0xffa040, 1, 3, 0.12, 0.35);
    }
    const d = Math.hypot(p.pos.x - r.x, p.pos.z - r.z);
    if (!r.hit && !p.dead && R0 <= d + p.r && r.R >= d - p.r && p.pos.y < r.y + 0.6) {
      r.hit = true;
      if (p.iframes <= 0) {
        hurtPlayer(g, 20, v.set(r.x, p.pos.y, r.z));
        p.vel.x += (p.pos.x - r.x) / (d || 1) * 7;
        p.vel.z += (p.pos.z - r.z) / (d || 1) * 7;
        p.vel.y = Math.max(p.vel.y, 6);
      }
    }
    if (r.R > 40) { g.scene.remove(r.mesh); r.mesh.material.dispose(); r.mesh.children[0].material.dispose(); e.rings.splice(i, 1); }
  }
}

// Summon markers: red rings on the floor for the tell, then a hire appears in a burst of hellfire.
function markSpots(g, e, types) {
  const p = g.player, b = boundsOf(g);
  for (const type of types) {
    let x = e.pos.x, z = e.pos.z;
    for (let k = 0; k < 30; k++) {
      const tx = rand(b.x0 + 2, b.x1 - 2), tz = rand(b.z0 + 2, b.z1 - 2), dp = Math.hypot(tx - p.pos.x, tz - p.pos.z);
      const near = type === 'burnout' ? 13 : 7; // kamikazes start far enough away to be shot
      if (dp > near && dp < 24 && free(g, tx, tz, 0.8)) { x = tx; z = tz; break; }
    }
    const mesh = new THREE.Mesh(flatRing, new THREE.MeshBasicMaterial({ color: 0xff1010, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, e.pos.y + 0.06, z);
    g.scene.add(mesh);
    e.marks.push({ mesh, type, x, z, t: 0 });
  }
}

function hire(g, e, type, x, z) {
  const m = addEnemy(g, type, x, e.pos.y, z);
  wake(g, m);
  m.cd = 1 + Math.random();
  e.minions.push(m);
  g.fx.burst(v.set(x, e.pos.y + 1, z), 0xff2040, 24, 7, 0.14, 0.8);
  g.fx.burst(v, 0xf0f0e8, 10, 5, 0.1, 1.0); // paperwork
  g.audio.play('spawn', v);
}

function updateMarks(g, e, dt) {
  for (const m of e.marks) {
    m.t += dt;
    const s = 1.4 - Math.min(1, m.t) * 0.6 + Math.sin(m.t * 20) * 0.08;
    m.mesh.scale.setScalar(s);
    if (Math.random() < 0.3) g.fx.burst(v.set(m.x + rand(-0.6, 0.6), e.pos.y + 0.1, m.z + rand(-0.6, 0.6)), 0xff3020, 1, 3, 0.08, 0.4);
  }
}

function flushMarks(g, e, spawn) {
  for (const m of e.marks) {
    g.scene.remove(m.mesh);
    m.mesh.material.dispose();
    if (spawn) hire(g, e, m.type, m.x, m.z);
  }
  e.marks.length = 0;
}

const alive = (e) => e.minions.filter((m) => !m.dead).length;

function choose(g, e, dist) {
  if (e.pendingSummon > 0) {
    e.pendingSummon--;
    setAct(e, 'summon', 1.1);
    markSpots(g, e, e.summonN === 0 ? ['intern', 'intern', 'intern', 'burnout'] : ['manager', 'intern', 'burnout', 'intern']);
    e.summonN++;
    g.audio.play('ceo_summon', e.pos);
    g.hud.msg('HIRING SPREE!', 1.5);
    return;
  }
  const high = g.player.pos.y > e.pos.y + 2;
  const w = {
    fan: e.los ? 1 : 0.1,
    slam: high ? 0.15 : (dist < 10 ? 1.6 : 0.7) + (e.los ? 0 : 1.2),
    charge: e.ph >= 2 && e.los && dist > 7 && !high ? 1.0 : 0,
  };
  if (e.last) w[e.last] *= e.repeat >= 1 ? 0.2 : 0.6;
  let r = Math.random() * (w.fan + w.slam + w.charge), pick = 'fan';
  for (const k in w) if ((r -= w[k]) < 0) { pick = k; break; }
  e.repeat = pick === e.last ? e.repeat + 1 : 0;
  e.last = pick;
  if (pick === 'fan') { setAct(e, 'fan', 0.6); g.audio.play('ceo_fan', e.pos); }
  else if (pick === 'slam') { setAct(e, 'slam', 0.9); g.audio.play('ceo_slamtell', e.pos); }
  else { setAct(e, 'chargeTell', 1.0); g.audio.play('ceo_charge', e.pos); }
}

function enterPhase(g, e, ph) {
  e.ph = ph;
  flushMarks(g, e, false);
  setAct(e, 'phase', 1.8);
  e.lane.visible = e.slamRing.visible = false;
  g.audio.play('ceo_phase', e.pos);
  g.shake += 1.0;
  g.hud.banner?.(`PHASE ${ph}: ${PH_NAME[ph]}`);
  g.hud.msg(`PHASE ${ph}: ${PH_NAME[ph]}`, 2.5);
  // Shove the player back a little: breathing room to read the new phase.
  const p = g.player, d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) || 1;
  if (d < 9) { p.vel.x += (p.pos.x - e.pos.x) / d * 14; p.vel.z += (p.pos.z - e.pos.z) / d * 14; p.vel.y = 5; }
  g.fx.burst(v.set(e.pos.x, e.pos.y + 2.5, e.pos.z), 0xffc020, 40, 10, 0.18, 1.0);
  if (ph === 2) e.pendingSummon++;
  if (ph === 3) { e.chute.visible = true; e.eyeMat.color.setHex(0xff4010); e.burnT = 4; }
}

function startDying(g, e) {
  flushMarks(g, e, false);
  setAct(e, 'dying', 2.6);
  e.lane.visible = e.slamRing.visible = e.orb.visible = false;
  e.hp = 0.01;
  g.audio.play('ceo_death', e.pos);
  g.hud.msg('NOOO! MY STOCK OPTIONS!', 2.5);
  g.shake += 0.6;
}

// ── the type ──────────────────────────────────────────────────────────────────────────────
export const CEO = {
  ceo: {
    hp: 4500, speed: 3.2, r: 1.2, h: 4.2, range: 60, keep: 10, cd: [2, 3], tell: 0.8, pain: 0, blood: 0x7a1010, body: 0x1c1c28, boss: true, name: 'THE CEO', strafes: false,
    build() {
      const m = build();
      return { ...m, ph: 1, act: null, actT: 0, actMax: 1, rings: [], marks: [], minions: [], summonN: 0, pendingSummon: 0, anim: 0, last: null, repeat: 0, burnT: 0, lastWeapon: null };
    },
    attack() {},

    onDamage(g, e, dmg, src, weapon) {
      if (e.state === 'dormant') e.state = 'chase'; // shooting him starts the meeting
      if (e.finalBlow) return dmg;
      if (e.act === 'dying' || e.pendingPhase || e.pendingDeath) return 0;
      if (e.act === 'phase') {
        g.fx.burst(v.set(e.pos.x, e.pos.y + 2.5, e.pos.z), 0xffd040, 4, 5, 0.08, 0.3);
        g.audio.play('ceo_ping', e.pos);
        return 0;
      }
      if (src === 'player') e.lastWeapon = weapon;
      // Phase gates: damage clamps at each threshold so no phase is skipped.
      for (const [ph, f] of [[1, 0.66], [2, 0.33]]) {
        const gate = e.def.hp * f;
        if (e.ph === ph && e.hp - dmg <= gate) { e.pendingPhase = ph + 1; return Math.max(0.01, e.hp - gate); }
      }
      if (e.hp - dmg <= 0) { e.pendingDeath = true; e.flash = 0.1; return Math.max(0, e.hp - 0.01); }
      if (e.ph >= 2 && e.hp - dmg <= e.def.hp * 0.5 && !e.summon50) { e.summon50 = true; e.pendingSummon++; }
      return dmg;
    },

    think(g, e, dt) {
      const p = g.player;
      e.target = null; // never infights
      e.anim += dt;
      updateRings(g, e, dt);
      updateMarks(g, e, dt);
      let mx = 0, mz = 0, armR = 0.12, armL = 0.12, lean = 0, crouch = 0;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.01, face = Math.atan2(dx, dz);
      const turn = (rate) => { e.yaw += wrap(face - e.yaw) * Math.min(1, dt * rate); };

      if (e.state === 'dormant') {
        // Looking out over his city, back to the door. Breathing.
        lean = Math.sin(e.anim * 1.5) * 0.03;
      } else {
        if (!e.act) {
          setAct(e, 'intro', 2.4);
          g.boss = e;
          g.audio.setBoss?.(true);
          g.level.bossStart?.(g);
          g.hud.banner?.('BOARD MEETING');
          g.hud.msg('THE CEO WILL SEE YOU NOW', 3);
          g.audio.play('ceo_laugh', e.pos);
        }
        if (e.pendingDeath && e.act !== 'dying') { e.pendingDeath = false; e.pendingPhase = 0; startDying(g, e); }
        if (e.pendingPhase && e.act !== 'dying') { const ph = e.pendingPhase; e.pendingPhase = 0; enterPhase(g, e, ph); }
        e.actT -= dt;
        const k = 1 - Math.max(0, e.actT) / e.actMax; // tell progress 0..1

        // Phase 3: two burnouts every 10 s, marked by red rings 1 s ahead, far from the player (≤ 2 alive).
        if (e.ph >= 3 && e.act !== 'dying' && e.act !== 'phase' && e.act !== 'summon') {
          if ((e.burnT -= dt) <= 0) {
            e.burnT = 10;
            const burning = e.minions.filter((m) => !m.dead && m.type === 'burnout').length;
            const n = alive(e) < 6 ? Math.max(0, 2 - burning) : 0;
            if (n) { markSpots(g, e, n === 2 ? ['burnout', 'burnout'] : ['burnout']); e.markT = 1.0; g.audio.play('ceo_summon', e.pos); }
          }
          if (e.markT > 0 && (e.markT -= dt) <= 0) flushMarks(g, e, true);
        }

        switch (e.act) {
          case 'intro':
            if (e.actT > 1.4) { e.yaw += wrap(face - e.yaw) * Math.min(1, dt * 3); armL = -0.6; }
            else {
              turn(6);
              if (!e.fired) { e.fired = true; g.audio.play('ceo_roar', e.pos); g.shake += 0.8; }
              armR = armL = -2.6; lean = -0.25;
            }
            if (e.actT <= 0) toIdle(e, 0.8);
            break;
          case 'idle': {
            turn(5);
            e.cd -= dt;
            const speed = e.def.speed * (e.ph >= 3 ? 1.35 : 1);
            const want = dist > 13 ? 1 : dist < 7 ? -0.6 : 0;
            e.strafeT -= dt;
            if (e.strafeT <= 0) { e.strafeT = rand(1.2, 2.5); e.strafeDir = Math.random() < 0.5 ? -1 : 1; }
            const ux = dx / dist, uz = dz / dist;
            mx = (ux * want - uz * e.strafeDir * 0.5) * speed;
            mz = (uz * want + ux * e.strafeDir * 0.5) * speed;
            armR = Math.sin(e.walk) * 0.4; armL = -Math.sin(e.walk) * 0.4;
            if (e.cd <= 0 && !p.dead) choose(g, e, dist);
            break;
          }
          case 'fan':
            turn(8);
            armR = armL = -1.4 - k * 0.6;
            e.orb.visible = true;
            e.orb.scale.setScalar(0.2 + k * 1.1);
            e.orb.rotation.set(e.anim * 7, e.anim * 5, 0);
            if (Math.random() < 0.5) g.fx.burst(muzzle(e), 0xffc040, 1, 3, 0.1, 0.3);
            if (e.actT <= 0) { e.orb.visible = false; fireFan(g, e); setAct(e, 'recover', 0.45); e.pose = 'throw'; }
            break;
          case 'slam':
            turn(3);
            armR = armL = -3.0; lean = -0.2; crouch = -0.15 * k;
            e.slamRing.visible = true;
            e.slamRing.scale.setScalar(4.2 * (0.4 + 0.6 * k));
            e.slamRing.material.opacity = 0.5 + 0.4 * Math.sin(e.anim * 30);
            if (e.actT <= 0) {
              e.slamRing.visible = false;
              slam(g, e);
              e.slams = (e.slams ?? 0) + 1;
              if (e.ph >= 3 && Math.random() < 0.5) setAct(e, 'slam2', 0.5); else setAct(e, 'recover', 0.7);
              e.pose = 'slammed';
            }
            break;
          case 'slam2':
            armR = armL = k < 0.6 ? -3.0 * (k / 0.6) : -3.0; lean = -0.1;
            if (e.actT <= 0) { slam(g, e); e.slams++; setAct(e, 'recover', 0.8); e.pose = 'slammed'; }
            break;
          case 'chargeTell':
            if (e.actT > 0.25) turn(8);
            else if (!e.fired) { e.fired = true; e.chargeDir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)); }
            lean = 0.55 * Math.min(1, k * 2); crouch = -0.35 * Math.min(1, k * 2);
            armR = armL = 0.5;
            e.lane.visible = true;
            e.lane.material.opacity = 0.3 + 0.4 * (Math.sin(e.anim * 25) * 0.5 + 0.5);
            e.walk += dt * 14; // stomping in place
            if (Math.random() < 0.4) g.fx.burst(v.set(e.pos.x + rand(-1, 1), e.pos.y + 0.1, e.pos.z + rand(-1, 1)), 0x6a6058, 2, 3, 0.15, 0.5);
            if (e.actT <= 0) {
              e.lane.visible = false;
              setAct(e, 'charge', 1.6);
              g.audio.play('ceo_roar', e.pos);
              if (!e.fired) e.chargeDir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
            }
            break;
          case 'charge': {
            e.yaw = Math.atan2(e.chargeDir.x, e.chargeDir.z);
            mx = e.chargeDir.x * 21; mz = e.chargeDir.z * 21;
            lean = 0.6; crouch = -0.3; armR = armL = 0.7;
            e.walk += dt * 10;
            if (Math.random() < 0.6) g.fx.burst(v.set(e.pos.x, e.pos.y + 0.2, e.pos.z), 0x6a6058, 2, 4, 0.18, 0.5);
            if (!p.dead && dist < e.r + p.r + 0.5 && p.pos.y < e.pos.y + e.h) {
              if (p.iframes <= 0) {
                hurtPlayer(g, 30, e.pos);
                p.vel.x += dx / dist * 16 + e.chargeDir.x * 8; p.vel.z += dz / dist * 16 + e.chargeDir.z * 8; p.vel.y = 7;
                g.shake += 0.6;
                g.audio.play('punch', e.pos);
                setAct(e, 'recover', 0.8);
              }
            }
            // Tramples his own staff and sets off drums in the way.
            for (const m of g.enemies) {
              if (m === e || m.dead || !m.active) continue;
              if (Math.hypot(m.pos.x - e.pos.x, m.pos.z - e.pos.z) < e.r + m.r + 0.3) damageEnemy(g, m, 500, e);
            }
            if (e.actT <= 0) setAct(e, 'recover', 0.6);
            break;
          }
          case 'stun':
            e.stars.visible = true;
            e.stars.rotation.y += dt * 8;
            lean = -0.3 + Math.sin(e.anim * 6) * 0.15; armR = armL = 0.4;
            e.yaw += Math.sin(e.anim * 5) * dt;
            if (e.actT <= 0) { e.stars.visible = false; toIdle(e, 0.6); }
            break;
          case 'summon':
            turn(4);
            armL = -2.2; armR = -0.8 + Math.sin(e.anim * 10) * 0.3;
            e.lid.rotation.z = -1.4 * Math.min(1, k * 3);
            e.papers.visible = true;
            if (Math.random() < 0.6) g.fx.burst(v.set(e.pos.x + Math.sin(e.yaw) * 2, e.pos.y + 3.2, e.pos.z + Math.cos(e.yaw) * 2), 0xf0f0e8, 2, 6, 0.12, 0.8);
            if (e.actT <= 0) { flushMarks(g, e, true); e.lid.rotation.z = 0; e.papers.visible = false; setAct(e, 'recover', 0.5); }
            break;
          case 'phase':
            // Invulnerable roar: flickering gold-white.
            e.flash = Math.sin(e.anim * 40) > 0 ? 0.02 : -1;
            armR = armL = -2.8; lean = -0.35;
            if (e.ph >= 3) e.chute.scale.setScalar(Math.min(1, k * 2.5));
            if (Math.random() < 0.5) g.fx.burst(v.set(e.pos.x + rand(-1.5, 1.5), e.pos.y + rand(1, 4), e.pos.z + rand(-1.5, 1.5)), 0xffc020, 2, 5, 0.12, 0.6);
            if (e.actT <= 0) { e.flash = 0; toIdle(e, 0.6); }
            break;
          case 'dying':
            e.flash = Math.random() < 0.3 ? 0.02 : -1;
            lean = -0.4 + Math.sin(e.anim * 23) * 0.12; crouch = -1.0 * k;
            armR = -2.4 + Math.sin(e.anim * 17) * 0.8; armL = -1.0 + Math.sin(e.anim * 13) * 0.8;
            e.yaw += Math.sin(e.anim * 9) * dt * 1.5;
            if ((e.popT = (e.popT ?? 0) - dt) <= 0) {
              e.popT = 0.18;
              const at = v.set(e.pos.x + rand(-1.2, 1.2), e.pos.y + rand(1, 4), e.pos.z + rand(-1.2, 1.2));
              g.fx.explosion(at, 1.2, Math.random() < 0.5 ? 0xff8a20 : 0xffc020);
              g.fx.burst(at, e.def.blood, 10, 6, 0.12, 0.6);
              g.audio.play('explode', at);
              g.shake += 0.15;
            }
            if (e.actT <= 0) { e.finalBlow = true; damageEnemy(g, e, 1e6, 'player', e.lastWeapon ?? 'shotgun'); return true; }
            break;
          case 'recover':
            if (e.pose === 'throw') { armR = armL = -1.2; }
            else if (e.pose === 'slammed') { armR = armL = 0.35; lean = 0.35; crouch = -0.4 * Math.max(0, e.actT / e.actMax); }
            if (e.actT <= 0) { e.pose = null; toIdle(e, rand(...(e.ph >= 2 ? [1.0, 1.7] : [1.3, 2.1]))); }
            break;
        }
      }

      // Movement + gravity, kept inside the arena.
      e.vy -= G * dt;
      const hit = moveBody(e, mx * dt, e.vy * dt, mz * dt, g.solids);
      if (hit.y) e.vy = 0;
      const b = boundsOf(g);
      const cx = Math.min(b.x1, Math.max(b.x0, e.pos.x)), cz = Math.min(b.z1, Math.max(b.z0, e.pos.z));
      const clamped = cx !== e.pos.x || cz !== e.pos.z;
      if (clamped) { e.pos.x = cx; e.pos.z = cz; moveBody(e, 0, 0, 0, g.solids); }
      if (e.act === 'charge' && (hit.x || hit.z || clamped)) {
        setAct(e, 'stun', 1.5);
        e.chargeT = 0;
        g.audio.play('ceo_crash', e.pos);
        g.shake += 0.8;
        g.fx.burst(v.set(e.pos.x + e.chargeDir.x * 1.5, e.pos.y + 2, e.pos.z + e.chargeDir.z * 1.5), 0x8a8078, 30, 8, 0.2, 0.8);
        g.hud.msg('STUNNED! GO GO GO', 1.2);
      }
      if (mx || mz) {
        const was = Math.sin(e.walk);
        e.walk += dt * (e.act === 'charge' ? 3 : 6);
        if (Math.sign(Math.sin(e.walk)) !== Math.sign(was)) g.audio.play('ceo_stomp', e.pos);
      }

      // Pose: lerp limbs toward this frame's targets.
      const s = Math.min(1, dt * 12);
      e.limbs[1].rotation.x = approach(e.limbs[1].rotation.x, armR, s);
      e.limbs[0].rotation.x = approach(e.limbs[0].rotation.x, armL, s);
      e.body.rotation.x = approach(e.body.rotation.x, lean, s);
      e.body.position.y = approach(e.body.position.y, 1.8 + crouch + Math.sin(e.anim * 2) * 0.04, s);
      const stride = mx || mz || e.act === 'chargeTell' ? 0.5 : 0;
      for (let i = 0; i < 2; i++) e.legs[i].rotation.x = approach(e.legs[i].rotation.x, Math.sin(e.walk + i * Math.PI) * stride, s);
      const telling = e.act === 'fan' || e.act === 'slam' || e.act === 'chargeTell' || e.act === 'summon';
      for (const pm of e.palms) {
        pm.visible = e.act === 'fan' || e.act === 'slam';
        pm.material.color.setHex(e.act === 'slam' ? 0xff3010 : 0xff9020);
        pm.scale.setScalar(0.9 + Math.sin(e.anim * 30) * 0.15);
      }
      e.eyeMat.color.setHex(telling ? 0xffffff : e.ph >= 3 ? 0xff4010 : 0xffd040);
      e.light.intensity = telling ? 14 + Math.sin(e.anim * 30) * 4 : e.act === 'dying' ? 20 : 6;
      e.light.color.setHex(e.act === 'chargeTell' ? 0xff2010 : 0xff6020);
      if (e.chute.visible && e.act !== 'phase') e.chute.rotation.z = Math.sin(e.anim * 1.7) * 0.12;
      return true;
    },

    onDeath(g, e) {
      for (const r of e.rings) g.scene.remove(r.mesh);
      e.rings.length = 0;
      flushMarks(g, e, false);
      // Big multi-burst: suit, skin, gold.
      for (let i = 0; i < 4; i++) {
        const at = new THREE.Vector3(e.pos.x + rand(-1, 1), e.pos.y + 0.8 + i * 0.9, e.pos.z + rand(-1, 1));
        g.fx.gibs(at, [e.def.blood, 0x1c1c28, 0x8a1c14, 0xffc020, 0xe8e4d8], 16);
        g.fx.explosion(at, 2.5, i % 2 ? 0xffc020 : 0xff6020);
      }
      g.fx.burst(v.set(e.pos.x, e.pos.y + 3, e.pos.z), 0xffd040, 60, 12, 0.12, 1.6); // golden parachute payout
      g.hitstop = Math.max(g.hitstop, 0.25);
      g.shake += 1.5;
      g.audio.play('ceo_roar', e.pos);
      g.audio.play('explode', e.pos);
      g.audio.setBoss?.(false);
      g.hud.banner?.('BOARD DISSOLVED');
      g.hud.msg('BOARD DISSOLVED', 4);
      // Everyone else is fired too.
      for (const m of g.enemies) {
        if (m === e || m.dead || !m.active || m.def.prop) continue;
        m.dead = m.gibbed = true;
        m.root.visible = false;
        g.stats.kills++;
        g.fx.gibs(v.set(m.pos.x, m.pos.y + m.h / 2, m.pos.z), [m.def.blood, m.def.body]);
      }
      g.level.bossDefeated?.(g, e);
    },
  },
};
