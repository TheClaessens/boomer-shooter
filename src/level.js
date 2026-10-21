import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { surface, imageTexture } from './textures.js';
import LOGO from './brand/faktion-logo.svg';
import { updateBox } from './physics.js';

// Level builder. Units are metres, y up. Level modules (src/levels/*.js) get a builder `B` and describe geometry with it;
// static boxes are merged per material at the end, so draw calls stay low however much a level dresses up.

export const T = 0.5; // wall thickness

// Area palettes: [texture key, tint]. A bare number as a colour means a lightly grained flat colour.
export const PAL = {
  LOBBY: { floor: ['tile', 0x9a8e78], wall: ['wallpaper', 0xe4dabe], ceil: ['ceiling', 0xeee8da] },
  CUBES: { floor: ['carpet', 0x4a4e52], wall: ['wallpaper', 0xbcb094], ceil: ['ceiling', 0x9c988c] },
  SERVER: { floor: ['metal', 0x2a3038], wall: ['metal', 0x4a5664], ceil: ['metal', 0x20262c] },
  HELL: { floor: ['flesh', 0x582c2a], wall: ['flesh', 0x7a3632], ceil: ['flesh', 0x44201e] },
  CEO: { floor: ['carpet', 0x5a1c1c], wall: ['wood', 0x4a3830], ceil: ['ceiling', 0x2a1a18] },
  VENT: { floor: ['metal', 0x5a5a5a], wall: ['metal', 0x7a7a78], ceil: ['metal', 0x6a6a68] },
  ARCHIVE: { floor: ['concrete', 0x5a5650], wall: ['concrete', 0x7a746a], ceil: ['concrete', 0x45423e] },
  GARAGE: { floor: ['concrete', 0x4a4a4a], wall: ['concrete', 0x6a6a66], ceil: ['concrete', 0x3a3a3a] },
  ROOF: { floor: ['concrete', 0x5a5a5e], wall: ['concrete', 0x6a6a70], ceil: ['concrete', 0x3a3a40] },
};

export function createBuilder(scene) {
  let seed = 1; // seeded so a level dresses identically on every restart
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const L = { solids: [], doors: [], lifts: [], stairs: [], triggers: [], pickups: [], enemies: [], arenas: [], flicker: [], secrets: 0 };
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const glowMats = new Map(), statics = [];
  const glowMat = (color) => {
    if (!glowMats.has(color)) glowMats.set(color, new THREE.MeshBasicMaterial({ color }));
    return glowMats.get(color);
  };
  const matFor = (color, glow) => {
    if (glow) return glowMat(Array.isArray(color) ? color[1] : color);
    return Array.isArray(color) ? surface(color[0], color[1]) : surface('grain', color);
  };

  const B = {
    scene, L, T, PAL, rnd,

    // dynamic: keep as its own mesh (doors, lifts, anything a level moves). Otherwise merged at finish().
    // clip: an invisible wall that only stops bodies; shots, sight lines and projectiles pass through. Returns nothing.
    box(x0, y0, z0, x1, y1, z1, color, { solid = true, glow = false, material, dynamic = false, clip = false } = {}) {
      if (clip) return void L.solids.push({ x0, y0, z0, x1, y1, z1, clip: true });
      const mesh = new THREE.Mesh(geo, material ?? matFor(color, glow));
      mesh.scale.set(x1 - x0, y1 - y0, z1 - z0);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      scene.add(mesh);
      if (!dynamic) statics.push(mesh);
      if (solid) L.solids.push({ x0, y0, z0, x1, y1, z1 });
      return mesh;
    },

    // A wall slab spanning a0..a1 along x (alongX) or z, with door gaps [g0, g1, height].
    wallRun(alongX, c0, c1, a0, a1, y0, y1, gaps = [], color) {
      const seg = (s0, s1, ya, yb) => (alongX ? B.box(s0, ya, c0, s1, yb, c1, color) : B.box(c0, ya, s0, c1, yb, s1, color));
      let cur = a0;
      for (const [g0, g1, h] of [...gaps].sort((a, b) => a[0] - b[0])) {
        if (g0 > cur) seg(cur, g0, y0, y1);
        if (y0 + h < y1) seg(g0, g1, y0 + h, y1);
        cur = g1;
      }
      if (cur < a1) seg(cur, a1, y0, y1);
    },

    // Interior x0..x1, z0..z1, y0..y1; walls sit outside the interior. gaps per side n/s/w/e: [[from, to, height]].
    room(x0, z0, x1, z1, y0, y1, c, gaps = {}) {
      B.box(x0 - T, y0 - T, z0 - T, x1 + T, y0, z1 + T, c.floor);
      B.box(x0 - T, y1, z0 - T, x1 + T, y1 + T, z1 + T, c.ceil);
      B.wallRun(true, z0 - T, z0, x0 - T, x1 + T, y0, y1, gaps.n, c.wall);
      B.wallRun(true, z1, z1 + T, x0 - T, x1 + T, y0, y1, gaps.s, c.wall);
      B.wallRun(false, x0 - T, x0, z0, z1, y0, y1, gaps.w, c.wall);
      B.wallRun(false, x1, x1 + T, z0, z1, y0, y1, gaps.e, c.wall);
    },

    // Open-ended passage; its ends butt against room wall gaps.
    hall(x0, z0, x1, z1, y0, h, c, alongX) {
      B.box(x0, y0 - T, z0, x1, y0, z1, c.floor);
      B.box(x0, y0 + h, z0, x1, y0 + h + T, z1, c.ceil);
      if (alongX) {
        B.box(x0, y0, z0 - T, x1, y0 + h, z0, c.wall);
        B.box(x0, y0, z1, x1, y0 + h, z1 + T, c.wall);
      } else {
        B.box(x0 - T, y0, z0, x0, y0 + h, z1, c.wall);
        B.box(x1, y0, z0, x1 + T, y0 + h, z1, c.wall);
      }
    },

    // Doors slide up on touch. key: needs the red keycard and wears its stripe. secret: opens only when bumped.
    // Returns the door; pass it to arena() to lock it during a fight.
    door(x0, y0, z0, x1, y1, z1, color, { key = false, secret = false } = {}) {
      const meshes = [B.box(x0, y0, z0, x1, y1, z1, color, { solid: false, dynamic: true })];
      if (key) {
        const h = y1 - y0, thinX = x1 - x0 < z1 - z0;
        meshes.push(thinX
          ? B.box(x0 - 0.03, y0 + h * 0.42, z0, x1 + 0.03, y0 + h * 0.58, z1, 0xd01010, { solid: false, glow: true, dynamic: true })
          : B.box(x0, y0 + h * 0.42, z0 - 0.03, x1, y0 + h * 0.58, z1 + 0.03, 0xd01010, { solid: false, glow: true, dynamic: true }));
      }
      for (const m of meshes) m.userData.baseY = m.position.y;
      const d = { box: { x0, y0, z0, x1, y1, z1 }, base: { x0, y0, z0, x1, y1, z1 }, h: y1 - y0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, meshes, open: 0, hold: 0, key, secret, locked: false };
      L.doors.push(d);
      return d;
    },

    // A platform that rises from its box to targetY once the player stands on it.
    lift(x0, y0, z0, x1, y1, z1, color, targetY) {
      const mesh = B.box(x0, y0, z0, x1, y1, z1, color, { solid: false, dynamic: true });
      const lift = { box: { x0, y0, z0, x1, y1, z1 }, mesh, target: targetY, moving: false };
      L.lifts.push(lift);
      return lift;
    },

    light(x, y, z, color, intensity, dist, flickers = false) {
      const l = new THREE.PointLight(color, intensity, dist, 1);
      l.position.set(x, y, z);
      scene.add(l);
      if (flickers) L.flicker.push({ light: l, base: intensity });
      return l;
    },

    // Flat unlit sign (centre x,y,z) facing 'n' (-z), 's', 'w' or 'e', w metres wide: the Faktion logo on a dark plate.
    // Not solid; hang it a hair off a wall.
    decal(x, y, z, face, w, url = LOGO, aspect = 0.4) {
      const mat = new THREE.MeshBasicMaterial({ map: imageTexture(url, 1024, Math.round(1024 * aspect), { bg: '#1a1a1a', pad: 90 }) });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.scale.set(w, w * aspect, 1);
      mesh.position.set(x, y, z);
      mesh.rotation.y = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
      scene.add(mesh);
      return mesh;
    },

    flesh(x, y, z, s = 1) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(blob, fleshMat());
        m.scale.setScalar(s * (0.3 + rnd() * 0.4));
        m.position.set(x + (rnd() - 0.5) * s, y + (rnd() - 0.5) * s, z + (rnd() - 0.5) * s);
        m.rotation.set(rnd() * 3, rnd() * 3, 0);
        scene.add(m);
        statics.push(m);
      }
    },

    // kind: 'ambush' (arg = group; opts.needKey), 'exit', 'secret' (use B.secret), 'script' (arg = name, read by level.update).
    trig(x0, y0, z0, x1, y1, z1, kind, arg, opts = {}) {
      L.triggers.push({ box: { x0, y0, z0, x1, y1, z1 }, kind, arg, fired: false, ...opts });
    },
    secret(x0, y0, z0, x1, y1, z1) {
      L.secrets++;
      B.trig(x0, y0, z0, x1, y1, z1, 'secret');
    },
    exit(x0, y0, z0, x1, y1, z1) { B.trig(x0, y0, z0, x1, y1, z1, 'exit'); },
    pick(kind, x, y, z) { L.pickups.push([kind, x, y, z]); },
    // group: enemies in a group start inactive and appear when an ambush trigger or an arena wave calls the group.
    mob(type, x, y, z, group = null) { L.enemies.push([type, x, y, z, group]); },
    // Walkable staircase from y0 to y1 inside the footprint, climbing toward side up ('n' -z, 's' +z, 'w' -x, 'e' +x).
    stairs(x0, z0, x1, z1, y0, y1, up, color) { stairs(B, L.stairs, x0, z0, x1, z1, y0, y1, up, color); },
    // Explosive toner drum (an inert 'drum' enemy: shootable, chain-reacts, not counted as a kill).
    barrel(x, y, z) { L.enemies.push(['drum', x, y, z, null]); },
    // Lockdown: entering the box seals `doors` and calls `waves` (group names) one after another as each is wiped out.
    arena(x0, y0, z0, x1, y1, z1, waves, doors = []) {
      L.arenas.push({ box: { x0, y0, z0, x1, y1, z1 }, waves, doors, state: 'idle', wave: -1 });
    },

    // Merge every static mesh into one mesh per material.
    finish() {
      const byMat = new Map();
      for (const m of statics) {
        m.updateMatrixWorld(true);
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (!byMat.has(m.material)) byMat.set(m.material, []);
        byMat.get(m.material).push(g.index ? g.toNonIndexed() : g);
        scene.remove(m);
      }
      for (const [mat, list] of byMat) {
        const merged = new THREE.Mesh(mergeGeometries(list), mat);
        merged.matrixAutoUpdate = false;
        scene.add(merged);
        for (const g of list) g.dispose();
      }
      statics.length = 0;
    },
  };
  return B;
}

const blob = new THREE.IcosahedronGeometry(1, 0);
const plane = new THREE.PlaneGeometry(1, 1);
let _flesh;
const fleshMat = () => (_flesh ??= surface('flesh', 0xa02838));

// ── stairs ───────────────────────────────────────────────────────────────────────────
// Physics has no step-up, so a staircase is a solid core one step below its treads plus a zone; walkStairs()
// (called by the world every frame) lifts any walker on the zone onto a smooth slope.
const LOOK = 0.4; // lookahead so a body never catches the next step or the landing edge

// up: the side the stairs climb toward: 'n' (-z), 's' (+z), 'w' (-x), 'e' (+x).
function stairs(B, zones, x0, z0, x1, z1, y0, y1, up, color) {
  const ax = up === 'e' || up === 'w', len = ax ? x1 - x0 : z1 - z0;
  const n = Math.max(2, Math.round(len / 0.5)), run = len / n, rise = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = up === 'e' || up === 's' ? (ax ? x0 : z0) + i * run : (ax ? x1 : z1) - (i + 1) * run, b = a + run;
    const box = (ya, yb, solid) => (ax ? B.box(a, ya, z0, b, yb, z1, color, { solid }) : B.box(x0, ya, a, x1, yb, b, color, { solid }));
    if (i > 0) box(y0, y0 + rise * i, true);
    box(y0 + rise * i, y0 + rise * (i + 1), false);
  }
  zones.push({ x0, z0, x1, z1, y0, up, len, slope: (y1 - y0) / len });
}

function surfaceAt(s, b) {
  const { x, z } = b.pos, r = b.r;
  if (x + r <= s.x0 || x - r >= s.x1 || z + r <= s.z0 || z - r >= s.z1) return -Infinity;
  const c = s.up === 'e' ? x - s.x0 : s.up === 'w' ? s.x1 - x : s.up === 's' ? z - s.z0 : s.z1 - z;
  return s.y0 + s.slope * Math.min(s.len, Math.max(0, c + r + LOOK));
}

function settle(b, zones, isPlayer) {
  let H = -Infinity;
  for (const s of zones) H = Math.max(H, surfaceAt(s, b));
  if (H === -Infinity) return;
  const y = b.pos.y, vy = isPlayer ? b.vel.y : b.vy;
  if (y < H) { if (H - y > 0.9) return; } // a step side too tall to climb: physics blocks it
  else if (vy > 0.01 || y - H > 0.6) return; // jumping, or well above: let it fly
  b.pos.y = H += 0.02; // a hair above: gravity sinks a body ~8 mm before it moves sideways, which would catch the landing edge
  if (vy <= 0) {
    if (isPlayer) { b.vel.y = 0; b.onGround = true; } else b.vy = 0;
  }
  updateBox(b);
  if (!isPlayer) b.root.position.y = H;
}

export function walkStairs(g, zones) {
  if (!zones?.length || g.player.dead) return;
  settle(g.player, zones, true);
  for (const e of g.enemies) if (e.active && !e.dead && !e.def.fly && !e.def.prop) settle(e, zones, false);
}
