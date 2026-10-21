import * as THREE from 'three';
import { raycast, RAY_NORMAL } from './physics.js';

// Particles, gibs, decals, beams, tracers. Every visual is a pooled mesh: meshes are created lazily up to the caps,
// stay in the scene and are hidden when free, so steady-state frames allocate nothing.

const cube = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(0.5, 0); // chunky low-poly puff (diameter 1, like the cube)
const quad = new THREE.PlaneGeometry(1, 1);
const MAX = 500, MAX_DECALS = 160, DECAL_SOFT = 140, MAX_TRACERS = 24, BEAMS = 4;
const BONE = 0xe8dcc8, SPARK = [0xffffe0, 0xffe070, 0xff9a20, 0xc04010];
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const R = Math.random, rs = () => R() - 0.5;

// Point the mesh's +z along dir (Object3D.lookAt reads last frame's matrixWorld, wrong for freshly moved meshes).
function aim(mesh, dir) {
  const l = dir.length();
  if (l > 1e-6) mesh.quaternion.setFromUnitVectors(Z, dir.multiplyScalar(1 / l));
}

// Box bound along axis a (0 x, 1 y, 2 z), hi = 1 for the max side.
const lim = (s, a, hi) => (a === 0 ? (hi ? s.x1 : s.x0) : a === 1 ? (hi ? s.y1 : s.y0) : hi ? s.z1 : s.z0);

function inside(solids, x, y, z) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1 && z > s.z0 && z < s.z1) return true;
  }
  return false;
}

// ── decal textures: tiny pixel-art canvases, alpha-tested (crisp edges, no sorting) ──────────────────────────────────
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function decalTexture(n, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d'), img = c.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [v, a] = paint(x - n / 2 + 0.5, y - n / 2 + 0.5, BAYER[(x & 3) + (y & 3) * 4] / 16);
    const i = (y * n + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = a ? 255 : 0;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Lumpy radius from a few random harmonics (per variant).
function lumps(k) {
  const h = Array.from({ length: k }, () => [1 + Math.floor(R() * 5), R() * 6.28, 0.1 + R() * 0.25]);
  return (a) => 1 + h.reduce((s, [f, p, m]) => s + Math.sin(a * f + p) * m, 0);
}
const PAINT = {
  // Bullet hole: black core, cracked light rim, a few chips.
  hole: () => {
    const L = lumps(3);
    return [16, (x, y, b) => {
      const r = Math.hypot(x, y) / L(Math.atan2(y, x));
      if (r < 1.8) return [12, 1];
      if (r < 3.2) return [r < 2.4 ? 70 : 150, 1];
      if (r < 5.5 && b < 0.25 * (5.5 - r)) return [120, 1];
      return [0, 0];
    }];
  },
  // Blood: lumpy pool, darker core, droplets and a couple of streaks (white = tint colour).
  blood: () => {
    const L = lumps(4), drops = Array.from({ length: 7 }, () => [rs() * 26, rs() * 26, 0.8 + R() * 1.8]);
    const sa = R() * 6.28, sb = sa + 2 + R() * 2;
    return [32, (x, y, b) => {
      const a = Math.atan2(y, x), d = Math.hypot(x, y), r = d / (7 * L(a));
      const streak = [sa, sb].some((s) => Math.abs(Math.sin(a - s)) * d < 1.3 && Math.cos(a - s) > 0 && d < 15);
      if (r < 0.55) return [150, 1];
      if (r < 1 || streak) return [r < 0.8 && b > 0.3 ? 205 : 255, 1];
      if (r < 1.25 && b < (1.25 - r) * 3) return [255, 1];
      for (const [dx, dy, s] of drops) if (Math.hypot(x - dx, y - dy) < s) return [230, 1];
      return [0, 0];
    }];
  },
  // Scorch: sooty blast mark, dithered ragged edge, charred streaks.
  scorch: () => {
    const L = lumps(5);
    return [32, (x, y, b) => {
      const a = Math.atan2(y, x), r = Math.hypot(x, y) / (13 * L(a)), ray = Math.abs(Math.sin(a * 7 + 1)) > 0.85;
      if (r < 0.45) return [8 + b * 20, 1];
      if (r < 0.8) return [30 + b * 30, b > (r - 0.45) * 1.6];
      if (r < 1.15 && ray) return [40, b > 0.4];
      return [0, 0];
    }];
  },
};
const VARIANTS = 3, decalTex = {};
function decalTextures(kind) {
  if (!decalTex[kind]) {
    decalTex[kind] = [];
    for (let i = 0; i < VARIANTS; i++) {
      const [n, f] = PAINT[kind]();
      decalTex[kind].push(decalTexture(n, f));
    }
  }
  return decalTex[kind];
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.solids = [];
    this.movers = null; // optional Set of solids that move (door/lift boxes): no decals stick to them
    this.mats = new Map();
    this.ramps = new Map();
    this.live = []; this.free = [];
    this.decals = []; this.decalNext = 0; this.decalOrder = 0;
    this.tracers = []; this.tracerNext = 0;
    this.beams = []; this.beamNext = 0;
    this.decalMats = new Map();
  }

  // opacity < 1 uses hashed (screen-door) alpha: reads as dithered see-through under the pixel filter, no sorting.
  mat(color, opacity = 1) {
    const id = opacity < 1 ? `${color}|${opacity}` : color;
    let m = this.mats.get(id);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, opacity, alphaHash: opacity < 1 });
      m.userData.shared = true;
      this.mats.set(id, m);
    }
    return m;
  }

  // White-hot → colour → dark → smoke, as materials (cached per colour).
  ramp(color) {
    let r = this.ramps.get(color);
    if (!r) {
      const c = new THREE.Color(color), w = new THREE.Color(0xfff4c0), k = new THREE.Color(0x2a2420), out = [];
      for (const [base, to, t, o] of [[w, w, 0, 1], [w, c, 0.5, 1], [c, c, 0, 1], [c, k, 0.45, 0.85], [c, k, 0.75, 0.6], [k, k, 0, 0.4]])
        out.push(this.mat(base.clone().lerp(to, t).getHex(), o));
      r = out;
      this.ramps.set(color, r);
    }
    return r;
  }

  // ── core particle pool ──────────────────────────────────────────────────────────────────────────────────────────
  // Returns a particle reset to defaults (no gravity, no ramp, shrinks over the last half of its life), or null if the
  // pool is full of longer-lived particles.
  spawn(geo, material, pos, life) {
    let p = this.free.pop();
    if (!p) {
      if (this.live.length < MAX) {
        const mesh = new THREE.Mesh(cube, material);
        this.scene.add(mesh);
        p = { mesh, vel: new THREE.Vector3() };
      } else {
        // Full: recycle whichever live particle has the least life left (only when it ends sooner than this one).
        let j = 0;
        for (let i = 1; i < this.live.length; i++) if (this.live[i].life < this.live[j].life) j = i;
        if (this.live[j].life > life) return null;
        p = this.live[j];
        this.live[j] = this.live[this.live.length - 1];
        this.live.pop();
      }
    }
    const m = p.mesh;
    m.geometry = geo;
    m.material = material;
    m.visible = true;
    m.position.copy(pos);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    p.vel.set(0, 0, 0);
    Object.assign(p, { life, max: life, grav: 0, drag: 0, bounce: 0, rest: false, ramp: null, grow: 0, tail: 0.5, spin: 0, stretch: false, trail: null, trailT: 0, landDecal: 0, sx: 1, sy: 1, sz: 1 });
    this.live.push(p);
    return p;
  }

  size(p, x, y = x, z = x) {
    p.sx = x; p.sy = y; p.sz = z;
    p.mesh.scale.set(x, y, z);
    return p;
  }

  // n cubes of one colour flying out (hits, trails, splashes). Signature is a public contract.
  burst(pos, color, n, speed = 4, size = 0.08, life = 0.5) {
    const mat = this.mat(color);
    for (let i = 0; i < n; i++) {
      const p = this.spawn(cube, mat, pos, life * (0.6 + R() * 0.8));
      if (!p) return;
      this.size(p, size * (0.6 + R() * 0.8));
      p.vel.set(rs(), R() * 0.8, rs()).normalize().multiplyScalar(speed * (0.3 + R()));
      p.grav = 14;
      p.spin = 6;
    }
  }

  // Hot streaks off a hard surface (metal, shields, laser impacts): fast, stretched along their velocity, cooling.
  sparks(pos, normal, n = 8, speed = 9) {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(cube, this.mat(SPARK[0]), pos, 0.15 + R() * 0.3);
      if (!p) return;
      this.size(p, 0.025, 0.025, 0.1 + R() * 0.12);
      p.vel.set(normal.x + rs() * 1.6, normal.y + rs() * 1.6 + 0.3, normal.z + rs() * 1.6).normalize().multiplyScalar(speed * (0.4 + R() * 0.8));
      p.grav = 16;
      p.ramp = SPARK.map((c) => this.mat(c));
      p.stretch = true;
      p.tail = 0.3;
    }
  }

  // Varied meat: slabs, chunks, a bone or two; they spin, bleed while flying, bounce, and splat blood where they land.
  gibs(pos, colors, n = 14) {
    for (let i = 0; i < n; i++) {
      const bone = i % 7 === 6, col = bone ? BONE : colors[i % colors.length];
      const p = this.spawn(i % 3 === 2 ? ball : cube, this.mat(col), v1.set(pos.x + rs() * 0.8, pos.y + rs() * 0.8, pos.z + rs() * 0.8), 6 + R() * 3);
      if (!p) break;
      const s = 0.1 + R() * 0.22;
      if (bone) this.size(p, 0.06, 0.06, 0.3 + R() * 0.15);
      else if (i % 4 === 1) this.size(p, s * 1.4, s * 0.45, s * 1.1); // flat slab
      else this.size(p, s, s * (0.7 + R() * 0.6), s * (0.7 + R() * 0.6));
      p.vel.set(rs(), R() * 0.9 + 0.35, rs()).normalize().multiplyScalar(4 + R() * 8);
      p.grav = 20;
      p.bounce = 0.35 + R() * 0.25;
      p.spin = 4 + R() * 10;
      p.tail = 0.08;
      p.trail = this.mat(colors[0]);
      p.landDecal = bone ? 0 : 0.25 + s * 1.5;
    }
    this.burst(pos, colors[0], 20, 7, 0.12, 0.8);
    const c = colors[0];
    this.puffs(pos, c, 5, 2, 0.35, 0.5, 0, [this.mat(c, 0.75), this.mat(c, 0.5), this.mat(c, 0.3)]);
  }

  // Slow expanding blobs (blood mist, dust, smoke). rise: upward drift in m/s².
  puffs(pos, color, n, speed, size, life, rise = 0, ramp = null) {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(ball, this.mat(color), v1.set(pos.x + rs() * size, pos.y + rs() * size, pos.z + rs() * size), life * (0.7 + R() * 0.6));
      if (!p) return;
      this.size(p, size * (0.6 + R() * 0.6));
      p.mesh.rotation.set(R() * 3, R() * 3, 0);
      p.vel.set(rs(), rs() + 0.2, rs()).normalize().multiplyScalar(speed * (0.3 + R()));
      p.grav = -rise;
      p.drag = 2.5;
      p.grow = 1.2;
      p.tail = 0.35;
      p.spin = rs() * 2;
      p.ramp = ramp;
    }
  }

  // Layered blast: flash, fireball (white→colour→char), rising smoke, sparks, bouncing debris. The light is world.js's.
  explosion(pos, radius, color = 0xff8a20) {
    const ramp = this.ramp(color), r = Math.max(0.6, radius);
    let p = this.spawn(ball, this.mat(0xfffff0, 0.7), pos, 0.08);
    if (p) { this.size(p, r * 0.7); p.grow = 0.8; p.tail = 0.01; }
    for (let i = 0; i < 12; i++) {
      p = this.spawn(ball, ramp[0], v1.set(pos.x + rs() * r * 0.4, pos.y + rs() * r * 0.4, pos.z + rs() * r * 0.4), 0.3 + R() * 0.35);
      if (!p) break;
      this.size(p, r * (0.16 + R() * 0.16));
      p.mesh.rotation.set(R() * 3, R() * 3, 0);
      p.vel.set(rs(), rs() + 0.25, rs()).normalize().multiplyScalar(r * (2 + R() * 3));
      p.drag = 5; p.grav = -2; p.grow = 1.1; p.tail = 0.3; p.spin = rs() * 4;
      p.ramp = ramp;
    }
    this.puffs(pos, 0x2a2420, 8, r * 1.2, r * 0.22, 1.2 + r * 0.2, 2.5, [this.mat(0x5a5048, 0.7), this.mat(0x403830, 0.6), this.mat(0x2a2420, 0.45), this.mat(0x1a1614, 0.3)]);
    this.sparks(pos, UP, 14, 12);
    for (let i = 0; i < 8; i++) {
      p = this.spawn(cube, this.mat(i & 1 ? 0x262220 : 0x4a4038), pos, 1.5 + R() * 1.5);
      if (!p) break;
      this.size(p, 0.05 + R() * 0.1);
      p.vel.set(rs(), R() * 0.8 + 0.2, rs()).normalize().multiplyScalar(6 + R() * 8);
      p.grav = 20; p.bounce = 0.3; p.spin = 10; p.tail = 0.15;
    }
  }

  // ── tracers: pooled 1-px lines, life-based ─────────────────────────────────────────────────────────────────────
  tracer(a, b, color = 0xffe080) {
    let t = this.tracers[this.tracerNext];
    if (!t) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      t = { line: new THREE.Line(geo), life: 0 };
      t.line.frustumCulled = false;
      this.scene.add(t.line);
      this.tracers[this.tracerNext] = t;
    }
    this.tracerNext = (this.tracerNext + 1) % MAX_TRACERS;
    let m = this.mats.get('line' + color);
    if (!m) { m = new THREE.LineBasicMaterial({ color }); m.userData.shared = true; this.mats.set('line' + color, m); }
    t.line.material = m;
    // Start a little way down the path so it reads as a streak leaving the muzzle, not a stick glued to the gun.
    const pa = t.line.geometry.attributes.position;
    pa.setXYZ(0, a.x + (b.x - a.x) * 0.08, a.y + (b.y - a.y) * 0.08, a.z + (b.z - a.z) * 0.08);
    pa.setXYZ(1, b.x, b.y, b.z);
    pa.needsUpdate = true;
    t.line.visible = true;
    t.life = 0.06;
  }

  // ── laser beam: red glow + white-hot core, thicker with charge, fades out over ~0.25 s, sparks at the end ────────
  beam(a, b, charge = 0) {
    let s = this.beams[this.beamNext];
    if (!s) {
      const mk = (color) => {
        const m = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.frustumCulled = false;
        m.visible = false;
        this.scene.add(m);
        return m;
      };
      s = { glow: mk(0xff2010), core: mk(0xfff0f0), life: 0, max: 0, w: 0 };
      this.beams[this.beamNext] = s;
    }
    this.beamNext = (this.beamNext + 1) % BEAMS;
    // The glow starts a little way out so it doesn't fill the screen next to the gun.
    const len = a.distanceTo(b), skip = Math.min(0.8, len * 0.5);
    for (const m of [s.glow, s.core]) {
      const from = m === s.glow ? skip : 0;
      m.position.copy(a).lerp(b, (from + len) / 2 / len);
      aim(m, v2.copy(b).sub(a));
      m.visible = true;
      m.scale.z = len - from;
    }
    s.w = 0.05 + 0.1 * charge;
    s.life = s.max = 0.22 + 0.12 * charge;
    this.updateBeam(s);
    v2.copy(a).sub(b).normalize();
    this.sparks(b, v2, 6 + Math.round(10 * charge), 7 + 6 * charge);
    this.puffs(b, 0xff3018, 2 + Math.round(2 * charge), 1, 0.12 + 0.15 * charge, 0.3, 0, [this.mat(0xffe0d0, 0.8), this.mat(0xff3018, 0.6), this.mat(0x801008, 0.4)]);
    // embers shed along the beam (not right at the gun, where they'd be screen-filling blobs)
    const near = Math.min(0.9, 1.5 / Math.max(len, 1e-3));
    for (let i = 0, n = 4 + Math.round(8 * charge); i < n; i++) {
      const p = this.spawn(cube, this.mat(0xff4030), v1.copy(a).lerp(b, near + R() * (1 - near)), 0.2 + R() * 0.3);
      if (!p) break;
      this.size(p, 0.03 + 0.03 * charge);
      p.vel.set(rs(), rs() + 0.5, rs()).multiplyScalar(1.5);
    }
  }

  updateBeam(s) {
    const k = s.life / s.max; // 1 → 0
    s.glow.material.opacity = 0.75 * k;
    s.core.material.opacity = Math.min(1, 1.6 * k);
    const wg = s.w * (0.6 + 0.4 * k), wc = s.w * 0.35 * k;
    s.glow.scale.x = s.glow.scale.y = wg;
    s.core.scale.x = s.core.scale.y = Math.max(0.012, wc);
  }

  // ── dash: speed lines hanging in the air for the player to rush past, plus a kick of floor dust ──────────────────
  dash(player) {
    const v = player.vel, sp = Math.hypot(v.x, v.z) || 1, dx = v.x / sp, dz = v.z / sp;
    for (let i = 0; i < 16; i++) {
      const ang = R() * 6.28, rad = 0.5 + R() * 0.7, ahead = 1 + R() * 3;
      v1.set(player.pos.x + dx * ahead - dz * Math.cos(ang) * rad, player.pos.y + 1.4 + Math.sin(ang) * rad * 0.8, player.pos.z + dz * ahead + dx * Math.cos(ang) * rad);
      const p = this.spawn(cube, this.mat(i & 1 ? 0xf0f0ff : 0xa0b0d0), v1, 0.18 + R() * 0.12);
      if (!p) return;
      this.size(p, 0.02, 0.02, 0.5 + R() * 0.6);
      aim(p.mesh, v2.set(dx, 0, dz));
      p.tail = 1;
    }
    this.puffs(v1.set(player.pos.x, player.pos.y + 0.1, player.pos.z), 0x8a8478, 4, 2, 0.25, 0.4);
  }

  // ── decals ───────────────────────────────────────────────────────────────────────────────────────────────────
  decalMat(kind, variant, color) {
    const id = `${kind}${variant}|${color}`;
    let m = this.decalMats.get(id);
    if (!m) {
      m = new THREE.MeshLambertMaterial({
        map: decalTextures(kind)[variant], color, alphaTest: 0.5, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      });
      m.userData.shared = true;
      this.decalMats.set(id, m);
    }
    return m;
  }

  // Sticks a decal to the solid surface just behind pos (along -normal). No surface within reach → nothing.
  decal(pos, normal, kind = 'hole', size, color) {
    if (!PAINT[kind]) return;
    size ??= kind === 'hole' ? 0.2 + R() * 0.06 : kind === 'scorch' ? 0.35 : 0.5;
    const nx = normal.x, ny = normal.y, nz = normal.z, nl = Math.hypot(nx, ny, nz);
    if (nl < 0.5) return;
    v2.set(-nx / nl, -ny / nl, -nz / nl);
    v1.set(pos.x - v2.x * 0.05, pos.y - v2.y * 0.05, pos.z - v2.z * 0.05);
    const reach = Math.max(0.5, size * 1.5), t = raycast(this.solids, v1, v2, reach);
    if (t >= reach) return;
    const hx = RAY_NORMAL.x, hy = RAY_NORMAL.y, hz = RAY_NORMAL.z;
    if (!hx && !hy && !hz) return;
    v1.addScaledVector(v2, t).add(v2.set(hx * 0.01, hy * 0.01, hz * 0.01));
    // Fit the decal to the face it hit: of the solids whose face holds the point, take the one with the most room
    // (coplanar neighbours meet at seams), shrink to that room so it never overhangs an edge, and skip moving boxes.
    const a = hx ? 0 : hy ? 1 : 2, side = (hx || hy || hz) > 0 ? 1 : 0;
    let room = -1, mover = false;
    for (const s of this.solids) {
      if (s.clip || Math.abs(v1.getComponent(a) - lim(s, a, side)) > 0.03) continue;
      let e = 1e9;
      for (let b = 0; b < 3; b++) if (b !== a) e = Math.min(e, v1.getComponent(b) - lim(s, b, 0), lim(s, b, 1) - v1.getComponent(b));
      if (e > room) { room = e; mover = !!this.movers?.has(s); }
    }
    if (mover) return;
    if (room >= 0) size = Math.min(size, room * 2);
    if (size < 0.06) return;

    // Soft cap: the oldest decals shrink away before the pool has to snap one out of existence.
    // The ring buffer is in age order from decalNext, so the slot (MAX - SOFT) ahead is the oldest one still kept.
    let d = this.decals[this.decalNext];
    if (!d) {
      d = { mesh: new THREE.Mesh(quad), size: 0, dying: false };
      d.mesh.matrixAutoUpdate = false;
      this.scene.add(d.mesh);
      this.decals[this.decalNext] = d;
    }
    const old = this.decals[(this.decalNext + MAX_DECALS - DECAL_SOFT) % MAX_DECALS];
    if (old?.mesh.visible) old.dying = true;
    this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    const m = d.mesh;
    m.material = this.decalMat(kind, Math.floor(R() * VARIANTS), color ?? (kind === 'blood' ? 0x9a0a0a : 0xffffff));
    m.position.copy(v1);
    aim(m, v2.set(hx, hy, hz));
    m.rotateZ(R() * 6.28);
    m.scale.setScalar(size);
    m.updateMatrix();
    m.visible = true;
    // Later decals draw on top of earlier ones.
    m.renderOrder = ++this.decalOrder;
    d.size = size;
    d.dying = false;
  }

  // Blood thrown from a wound onto the nearest floor or wall around pos.
  splat(pos, color, solids) {
    if (solids) this.solids = solids;
    const down = R() < 0.6;
    const a = R() * 6.28;
    v1.set(pos.x, pos.y, pos.z);
    const dir = down ? v2.set(rs() * 0.4, -1, rs() * 0.4).normalize() : v2.set(Math.cos(a), -0.3 - R() * 0.3, Math.sin(a)).normalize();
    const t = raycast(this.solids, v1, dir, down ? 3 : 2.5);
    if (t >= (down ? 3 : 2.5)) return;
    const n = { x: RAY_NORMAL.x, y: RAY_NORMAL.y, z: RAY_NORMAL.z };
    v1.addScaledVector(dir, t);
    this.decal(v1.addScaledVector(v2.set(n.x, n.y, n.z), 0.02), n, 'blood', 0.35 + R() * 0.5, color);
  }

  // ── per-frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  update(dt, solids) {
    this.solids = solids;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i], m = p.mesh;
      p.life -= dt;
      if (p.life <= 0) {
        m.visible = false;
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.free.push(p);
        continue;
      }
      const left = p.life / p.max;
      if (p.ramp) m.material = p.ramp[Math.min(p.ramp.length - 1, Math.floor((1 - left) * p.ramp.length))];
      const s = (1 + p.grow * (1 - left)) * Math.min(1, left / p.tail);
      m.scale.set(p.sx * s, p.sy * s, p.sz * s);
      if (p.rest) continue;
      const vel = p.vel;
      vel.y -= p.grav * dt;
      if (p.drag) vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      const pos = m.position, ox = pos.x, oy = pos.y, oz = pos.z;
      pos.addScaledVector(vel, dt);
      if (p.spin) { m.rotation.x += p.spin * dt; m.rotation.y += p.spin * 0.7 * dt; }
      if (p.stretch) aim(m, v1.copy(vel));
      if (p.trail && (p.trailT -= dt) <= 0 && vel.lengthSq() > 4) {
        p.trailT = 0.04;
        const d = this.spawn(cube, p.trail, pos, 0.3 + R() * 0.3);
        if (d) { this.size(d, 0.04 + R() * 0.04); d.grav = 10; }
      }
      if (!p.bounce || !inside(solids, pos.x, pos.y, pos.z)) continue;
      // Find which axis we came through and reflect only that one.
      if (inside(solids, ox, pos.y, oz)) {
        pos.y = oy;
        if (vel.y < 0 && p.landDecal) { this.decal(pos, UP, 'blood', p.landDecal, p.trail.color.getHex()); p.landDecal = 0; p.trail = null; }
        vel.y *= -p.bounce;
        vel.x *= 0.6; vel.z *= 0.6;
        p.spin *= 0.5;
      } else {
        if (inside(solids, pos.x, oy, oz)) { pos.x = ox; vel.x *= -p.bounce; }
        if (inside(solids, ox, oy, pos.z)) { pos.z = oz; vel.z *= -p.bounce; }
        if (inside(solids, pos.x, pos.y, pos.z)) pos.set(ox, oy, oz);
      }
      if (vel.lengthSq() < 0.6 && vel.y <= 0.1) { p.rest = true; p.spin = 0; }
    }
    for (const t of this.tracers) if (t.line.visible && (t.life -= dt) <= 0) t.line.visible = false;
    for (const s of this.beams) {
      if (!s?.core.visible) continue;
      if ((s.life -= dt) <= 0) { s.core.visible = s.glow.visible = false; continue; }
      this.updateBeam(s);
    }
    for (const d of this.decals) {
      if (!d.dying) continue;
      d.size -= dt * 0.6;
      if (d.size <= 0.02) { d.mesh.visible = d.dying = false; continue; }
      d.mesh.scale.setScalar(d.size);
      d.mesh.updateMatrix();
    }
  }
}
