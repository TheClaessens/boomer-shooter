import * as THREE from 'three';

// Procedural pixel textures, mapped in world space so scaled unit boxes (and merged level geometry) never stretch.
// Each painter draws a 64-px-wide canvas (height `h`, default 64) of mostly light, near-neutral detail; the surface
// colour tints it and `gain` re-normalises the average brightness to 1. A painter may use real colour where the detail
// itself is coloured (server LEDs, hazard stripes, file boxes).
// Painter options: scale (repeats per metre, default 0.5 → 32 px/m), h (canvas height, px), top (key used on
// up/down-facing faces instead), band (metres: the bottom `band` of the canvas is drawn once per storey at floor level,
// the rest repeats above it: skirting + wainscot + chair rail), pulse (brightness wobble amplitude, for flesh).
// Canvas rows are painted top-down; row H-1 is the bottom of the wall (floor level) — use `B(yFromBottom)`.

const SIZE = 64;
const DEFAULT_SCALE = 0.5;
const CONTRAST = 1.6; // per-painter `contrast` overrides
const STOREY = 24; // ponytail: bands/contact shadow repeat every 24 m of height (tower floors sit at y=0 and y=24); a per-level floor list if levels stack differently

let seed = 1, C = null, H = SIZE;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const gray = (v) => `rgb(${clamp(v)},${clamp(v)},${clamp(v)})`;
const rgb = (r, g, b) => `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
const wrap = (v, n) => ((v % n) + n) % n;
const B = (yb) => H - 1 - yb; // canvas row of a pixel `yb` up from the bottom edge
function rect(x, y, w, h, v) {
  C.fillStyle = typeof v === 'number' ? gray(v) : v;
  C.fillRect(x, y, w, h);
}
function px(x, y, v) { rect(wrap(x, SIZE), wrap(y, H), 1, 1, v); }
function speckle(n, lo, hi, s = 1, y0 = 0, y1 = H) {
  for (let i = 0; i < n; i++) rect(Math.floor(rnd() * SIZE), y0 + Math.floor(rnd() * (y1 - y0)), s, s, lo + rnd() * (hi - lo));
}
// Tileable value noise (period = canvas size), 0..1, lattice every `cell` px.
function noise(cell) {
  const nx = SIZE / cell, ny = Math.max(1, Math.round(H / cell)), lat = Array.from({ length: nx * ny }, rnd);
  const at = (i, j) => lat[wrap(j, ny) * nx + wrap(i, nx)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
}
// Per-pixel fill from f(x, y) → grey value, css colour, or null to leave the pixel.
function each(f, y0 = 0, y1 = H) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < SIZE; x++) { const v = f(x, y); if (v != null) px(x, y, v); }
}
// Random-walk crack / fissure / vein, wrapping at the edges.
function walk(x, y, steps, v, { dir = rnd() * 6.28, wobble = 0.8, shade } = {}) {
  for (let i = 0; i < steps; i++) {
    px(Math.round(x), Math.round(y), v);
    if (shade !== undefined) px(Math.round(x) + 1, Math.round(y) + 1, shade);
    dir += (rnd() - 0.5) * wobble;
    x += Math.cos(dir);
    y += Math.sin(dir);
  }
}
// Raised 2-px bevel around a rectangle: light top/left, dark bottom/right.
function bevel(x, y, w, h, hi, lo) {
  rect(x, y, w, 1, hi); rect(x, y, 1, h, hi);
  rect(x, y + h - 1, w, 1, lo); rect(x + w - 1, y, 1, h, lo);
}

// Board-formed concrete (walls) or a troweled slab (floors/ceilings): big quiet forms, not speckle. Walls get 25 cm
// board imprints with a faint per-board tone, two form-tie holes with a soft water stain, one hairline crack.
function concrete({ ties }) {
  const n1 = noise(32), n2 = noise(8);
  if (ties) {
    const tone = Array.from({ length: 8 }, () => ri(-5, 5));
    each((x, y) => {
      const ly = y & 7, v = 206 + tone[y >> 3] + (n1(x, y) - 0.5) * 22 + (n2(x, y) - 0.5) * 6;
      return ly === 0 ? v - 14 : ly === 1 ? v + 5 : v;
    });
    for (const [x, y] of [[15, 21], [47, 53]]) {
      each((xx, yy) => { const dx = Math.abs(xx - x - 0.5), dy = yy - y; return dx < 3 - dy * 0.12 && dy > 1 && dy < 18 ? 194 - (18 - dy) * 0.5 : null; }, y, Math.min(H, y + 18));
      rect(x, y, 2, 2, 120);
    }
  } else {
    each((x, y) => 204 + (n1(x, y) - 0.5) * 18 + (n2(x, y) - 0.5) * 5);
    rect(0, 0, SIZE, 1, 176); rect(0, 0, 1, H, 176); // saw-cut joints every 2 m
    const ns = noise(8);
    each((x, y) => { const d = Math.hypot(x - 42, y - 38); return d < 10 && ns(x, y) > 0.4 ? 190 : null; });
  }
  speckle(30, 186, 196, 1);
  walk(ri(0, 63), ri(0, H - 1), 22, 168, { wobble: 0.7 });
}

// Wet meat: wavy muscle fibre running sideways, pale fat marbling, a branching network of dark veins with a glossy
// edge. No closed cells (reads as cobblestone).
function veins(x, y, d, len, depth) {
  for (let s = 0; s < len; s++) {
    const X = Math.round(x), Y = Math.round(y);
    px(X, Y, 108); if (depth === 0) px(X, Y + 1, 124); px(X, Y - 1 - (depth === 0), 238);
    if (depth < 2 && rnd() < 0.05) veins(x, y, d + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.5 - s * 0.3, depth + 1);
    d += (rnd() - 0.5) * 0.5; x += Math.cos(d); y += Math.sin(d);
  }
}

// key → { paint(), scale?, h?, top?, band?, pulse? }. Unknown keys fall back to 'grain'.
export const PAINTERS = {
  // Plain props (desks, crates, pillars): soft mottling, nothing that fights the silhouette.
  grain: {
    paint() {
      const n = noise(16);
      each((x, y) => 226 + (n(x, y) - 0.5) * 22);
      speckle(70, 200, 214, 2); speckle(50, 238, 250, 2);
    },
  },
  // Loop-pile office carpet tiles (50 cm), pile direction alternating per tile, small diamond motif, traffic wear.
  carpet: {
    paint() {
      const wear = noise(16), fine = noise(2);
      each((x, y) => {
        const tx = x >> 4, ty = y >> 4, lx = x & 15, ly = y & 15, dir = (tx + ty) & 1;
        let v = 214 + (wear(x, y) - 0.5) * 34 + (fine(x, y) - 0.5) * 22;
        if ((dir ? lx : ly) % 3 === 0) v -= 24;
        if (lx === 0 || ly === 0) v -= 14;
        if (Math.abs(lx - 8) + Math.abs(ly - 8) === 3) v -= 34;
        if (lx === 8 && ly === 8) v += 26;
        return v;
      });
      speckle(40, 120, 150, 1);
    },
  },
  // Lobby terrazzo: 1 m tiles in a soft checker, stone chips, bevelled grout, one cracked tile.
  tile: {
    paint() {
      const n = noise(8);
      each((x, y) => (((x >> 5) + (y >> 5)) & 1 ? 214 : 232) + (n(x, y) - 0.5) * 16);
      speckle(110, 192, 208, 1); speckle(110, 238, 250, 1); speckle(8, 180, 192, 2);
      for (let k = 0; k < SIZE; k += 32) {
        rect(k, 0, 1, H, 112); rect(0, k, SIZE, 1, 112);
        rect(k + 1, 0, 1, H, 250); rect(0, k + 1, SIZE, 1, 250);
        rect(k + 31, 0, 1, H, 186); rect(0, k + 31, SIZE, 1, 186);
      }
      walk(36, 40, 22, 135, { dir: 0.6, wobble: 0.9 });
    },
  },
  // Drop ceiling: 1 m fissured mineral-fibre tiles in a bright T-bar grid; one tile has a coffee-coloured water stain.
  ceiling: {
    paint() {
      each(() => 212 + ri(-6, 6));
      for (let i = 0; i < 160; i++) walk(ri(0, 63), ri(0, 63), ri(2, 5), ri(160, 180), { wobble: 1.6 });
      speckle(140, 185, 195, 1);
      const n = noise(4);
      each((x, y) => {
        const d = Math.hypot(x - 46, y - 18) + (n(x, y) - 0.5) * 5;
        return d > 7 && d < 9 ? rgb(196, 186, 160) : d <= 7 ? rgb(210, 204, 190) : null;
      }, 3, 31);
      for (let k = 0; k < SIZE; k += 32) {
        rect(k, 0, 2, H, 252); rect(0, k, SIZE, 2, 252);
        rect(k + 2, 0, 1, H, 150); rect(0, k + 2, SIZE, 1, 150);
      }
    },
  },
  // 90s office wall: dark skirting, beadboard wainscot, chair rail at ~0.9 m, pinstripe wallpaper with a diamond motif.
  wallpaper: {
    h: 128, band: 1, top: 'grain', contrast: 1.5,
    paint() {
      const n = noise(16);
      // wallpaper (rows above the band repeat every 3 m → pattern period 32 px)
      each((x, y) => {
        const yb = H - 1 - y, sx = x & 15, sy = yb & 31;
        let v = 230 + (n(x, y) - 0.5) * 4;
        if (sx === 0) v = 220; // faint pinstripe (dark 2-px stripes read as grime streaks)
        const mx = sx - 8, my = (sy & 15) - 8, alt = (sy >> 4) & 1;
        if (alt && Math.abs(mx) + Math.abs(my) === 2) v = 214;
        if (!alt && mx === 0 && my === 0) v = 216;
        return v;
      }, 0, B(32) + 1);
      rect(0, B(32), SIZE, 1, 200); // shadow under the rail lip
      // chair rail
      rect(0, B(31), SIZE, 1, 252); rect(0, B(30), SIZE, 1, 228); rect(0, B(29), SIZE, 1, 196); rect(0, B(28), SIZE, 1, 112);
      // beadboard wainscot with scuffs toward the floor
      each((x, y) => {
        const yb = H - 1 - y, sx = x & 7;
        const v = sx === 0 ? 150 : sx === 1 ? 238 : 208 + (n(x, y) - 0.5) * 12;
        return v - (yb < 10 ? (10 - yb) * 2 : 0) - (yb === 27 ? 30 : 0);
      }, B(27), B(4) + 1);
      // skirting
      rect(0, B(3), SIZE, 1, 170); rect(0, B(2), SIZE, 3, 92);
      speckle(10, 120, 150, 1, B(26), B(5));
    },
  },
    concrete: { top: 'slab', contrast: 1.3, paint: () => concrete({ ties: true }) },
  slab: { contrast: 1.2, paint: () => concrete({ ties: false }) },
  // Server-room / vent wall panels: 1 m × 2 m panels, bevelled seams, rivet rows, a louvred vent, brushed streaks.
  metal: {
    top: 'plate',
    paint() {
      const n = noise(32);
      each((x, y) => 196 + (n(x, y) - 0.5) * 20 + ((y * 7 + (x >> 3)) % 5 === 0 ? -8 : 0));
      for (const x0 of [0, 32]) {
        rect(x0, 0, 1, H, 96); rect(x0 + 1, 0, 1, H, 236); rect(x0 + 31, 0, 1, H, 150);
        for (let y = 4; y < H; y += 8) for (const rx of [x0 + 4, x0 + 27]) { px(rx, y, 250); px(rx + 1, y + 1, 120); }
      }
      rect(0, 0, SIZE, 1, 96); rect(0, 1, SIZE, 1, 236); rect(0, 63, SIZE, 1, 150);
      for (let y = 44; y < 58; y += 3) { rect(38, y, 20, 1, 70); rect(38, y + 1, 20, 1, 232); }
      bevel(37, 43, 22, 16, 150, 236);
    },
  },
  // Diamond tread plate (top faces of 'metal'): staggered raised lozenges.
  plate: {
    paint() {
      const n = noise(16);
      each((x, y) => 184 + (n(x, y) - 0.5) * 30);
      for (let y = 0; y < SIZE; y += 8) for (let x = (y & 8) ? 4 : 0; x < SIZE; x += 8) {
        px(x, y, 245); px(x + 1, y + 1, 238); px(x + 2, y + 2, 130); px(x + 1, y + 2, 150);
      }
      speckle(30, 140, 160, 1);
    },
  },
  // Floor grating: dark gaps between bright bars (catwalks, vents).
  grate: {
    paint() {
      each((x, y) => {
        const bx = x & 3, by = y & 15;
        if (by === 0) return 236; if (by === 1) return 120;
        return bx === 0 ? 228 : bx === 1 ? 180 : 40;
      });
    },
  },
  // Hell-spread flesh (see veins()). Pulses in the shader.
  flesh: {
    pulse: 0.16, contrast: 1.5,
    paint() {
      const n = noise(16), w = noise(8), fat = noise(16);
      each((x, y) => {
        const fibre = Math.sin(y * 1.3 + w(x, y) * 9 + Math.sin(x * 0.2) * 2);
        const f = fat(x, y);
        return f > 0.68 ? 236 + (f - 0.68) * 60 : 196 + (n(x, y) - 0.5) * 34 + fibre * 16 - (f > 0.62 ? 10 : 0);
      });
      veins(4, 20, -0.3, 70, 0);
      veins(30, 52, 0.2, 60, 0);
      speckle(18, 250, 255, 1);
    },
  },
  // CEO panelling: skirting, raised-panel wainscot, rail, then vertical boards with flowing grain.
  wood: {
    h: 128, band: 1, top: 'planks',
    paint() {
      const n = noise(8);
      each((x, y) => {
        const sx = x & 15, g = Math.sin(x * 1.7 + n(x, y) * 7 + (x >> 4) * 2.1);
        return sx === 0 ? 120 : sx === 1 ? 232 : 205 + g * 18;
      }, 0, B(32) + 1);
      rect(0, B(32), SIZE, 1, 160);
      rect(0, B(31), SIZE, 1, 248); rect(0, B(30), SIZE, 1, 220); rect(0, B(29), SIZE, 1, 190); rect(0, B(28), SIZE, 1, 104);
      each((x, y) => 192 + Math.sin(y * 0.9 + n(x, y) * 6) * 14, B(27), B(4) + 1);
      for (const x0 of [0, 32]) { bevel(x0 + 4, B(23), 24, 17, 236, 120); rect(x0 + 6, B(21), 20, 13, 214); }
      rect(0, B(3), SIZE, 1, 168); rect(0, B(2), SIZE, 3, 88);
    },
  },
  // Floorboards (wood tops, or any floor): 16 px boards, staggered butt joints, grain, knots.
  planks: {
    paint() {
      const n = noise(8);
      each((x, y) => {
        const board = y >> 3, ly = y & 7, joint = wrap(x - board * 23, SIZE);
        if (ly === 0) return 118;
        if (joint === 0) return 128;
        return 208 + Math.sin(x * 0.35 + n(x, y) * 6 + board * 1.3) * 16 + (ly === 1 ? 18 : 0) + (board % 3) * 6;
      });
      for (let i = 0; i < 4; i++) { const x = ri(0, 60), y = ri(0, 7) * 8 + 4; px(x, y, 120); px(x + 1, y, 150); }
    },
  },
  // Red brick, running bond, 0.5 × 0.25 m bricks, recessed mortar, per-brick tone, chips.
  brick: {
    paint() {
      const n = noise(4), tone = Array.from({ length: 32 }, () => ri(-16, 16));
      each((x, y) => {
        const row = y >> 3, ly = y & 7, lx = wrap(x + (row & 1) * 8, 16), id = (row * 4 + (wrap(x + (row & 1) * 8, SIZE) >> 4)) & 31;
        if (ly === 7 || lx === 15) return 140;
        if (ly === 0 || lx === 0) return 232 + tone[id] * 0.5;
        if (ly === 6) return 178 + tone[id];
        return 206 + tone[id] + (n(x, y) - 0.5) * 18;
      });
      speckle(26, 150, 170, 1);
    },
  },
  // Asphalt (garage, roof): fine aggregate, sealed cracks, an oil patch.
  asphalt: {
    paint() {
      const n = noise(16);
      each((x, y) => 196 + (n(x, y) - 0.5) * 36 + ri(-14, 14));
      speckle(160, 232, 250, 1);
      for (let i = 0; i < 2; i++) walk(ri(0, 63), ri(0, 63), 40, 120, { wobble: 0.9 });
      const o = noise(4);
      each((x, y) => (Math.hypot(x - 20, y - 46) < 9 + (o(x, y) - 0.5) * 6 ? 158 + ri(-6, 6) : null));
    },
  },
  // Cubicle partition fabric: chunky 2-px weave, heather streaks, a few pin holes.
  cubicle: {
    paint() {
      const n = noise(8);
      each((x, y) => 214 + (((x >> 1) + (y >> 1)) & 1 ? 12 : -12) + (n(x, y) - 0.5) * 20 + ((x * 13) % 9 === 0 ? -8 : 0));
      speckle(16, 140, 160, 1);
    },
  },
  // Server rack fronts: rails, 1U/2U units, perforated bezels, drive bays, coloured LEDs (tint near-white to keep them).
  server: {
    contrast: 1.1,
    paint() {
      rect(0, 0, SIZE, H, 52);
      let y = 0;
      while (y < SIZE) {
        const u = rnd() < 0.35 ? 8 : 4, kind = ri(0, 2);
        rect(4, y, 56, u - 1, kind === 2 ? 150 : 118);
        rect(4, y, 56, 1, 186);
        if (kind === 0) for (let x = 8; x < 44; x += 2) for (let k = 1; k < u - 1; k += 2) px(x, y + k, 62);
        if (kind === 1) for (let x = 8; x < 50; x += 5) { rect(x, y + 1, 4, u - 3, 82); px(x + 3, y + 1, rgb(60, 255, 90)); }
        if (kind === 2) rect(8, y + 1, 30, u - 3, 96);
        const leds = [rgb(60, 255, 90), rgb(255, 180, 40), rgb(70, 160, 255), rgb(60, 255, 90)];
        for (let k = 0; k < 3; k++) px(48 + k * 3, y + 1, rnd() < 0.8 ? leds[ri(0, 3)] : 40);
        y += u;
      }
      for (const x0 of [0, 60]) {
        rect(x0, 0, 4, H, 160); rect(x0 + (x0 ? 3 : 0), 0, 1, H, 96);
        for (let k = 1; k < H; k += 4) px(x0 + 1, k, 40);
      }
    },
  },
  // Filing shelves (archives): two 1 m shelves of box files in muted colours with white labels.
  shelf: {
    contrast: 1.1,
    paint() {
      const cols = [[204, 188, 150], [176, 176, 170], [146, 156, 178], [160, 126, 92], [190, 170, 120]];
      rect(0, 0, SIZE, H, 46);
      for (const y0 of [0, 32]) {
        let x = 1;
        while (x < SIZE - 1) {
          const w = Math.min(ri(4, 8), SIZE - 1 - x), h = ri(20, 27), [r, g, b] = cols[ri(0, cols.length - 1)], t = ri(-16, 10);
          rect(x, y0 + 29 - h, w - 1, h, rgb(r + t, g + t, b + t));
          rect(x, y0 + 29 - h, 1, h, rgb(r + t + 24, g + t + 24, b + t + 24));
          if (w > 4) rect(x + 1, y0 + 33 - h, w - 3, 4, 240);
          px(x + (w >> 1), y0 + 22, 60);
          x += w;
        }
        rect(0, y0 + 29, SIZE, 1, 236); rect(0, y0 + 30, SIZE, 2, 150);
      }
      rect(0, 0, 1, H, 120); rect(63, 0, 1, H, 120);
    },
  },
  // Yellow/black hazard stripes (real colour: tint white or pale).
  hazard: {
    contrast: 1.1,
    paint() {
      const n = noise(4);
      each((x, y) => {
        const s = ((x + y) >> 4) & 1, worn = n(x, y) > 0.78;
        return s && !worn ? rgb(250, 196, 30) : s ? rgb(150, 130, 70) : rgb(44, 42, 40);
      });
      speckle(30, 90, 120, 1);
    },
  },
};

const textures = new Map();
function texture(key) {
  if (!PAINTERS[key]) key = 'grain';
  if (textures.has(key)) return textures.get(key);
  const P = PAINTERS[key], cv = document.createElement('canvas');
  H = P.h ?? SIZE;
  cv.width = SIZE;
  cv.height = H;
  seed = 1 + key.length * 977 + key.charCodeAt(0) * 131;
  C = cv.getContext('2d', { willReadFrequently: true });
  P.paint(C, SIZE, H);
  // Stretch contrast around the mean so detail survives the 6-level crush + dither (painters stay readable at k=1).
  const img = C.getImageData(0, 0, SIZE, H), px = img.data, k = P.contrast ?? CONTRAST;
  let mean = 0;
  for (let i = 0; i < px.length; i += 4) mean += px[i] + px[i + 1] + px[i + 2];
  mean /= px.length * 0.75;
  for (let i = 0; i < px.length; i++) if ((i & 3) !== 3) px[i] = clamp(mean + (px[i] - mean) * k);
  C.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  // Normalise so the texture averages 1.0 in linear light: detail without darkening the area palette.
  const lin = (c) => (c / 255) ** 2.2;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
  t.userData.gain = Math.min(3, (SIZE * H) / Math.max(1e-3, sum));
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  textures.set(key, t);
  return t;
}

// Shared clock for animated surfaces (flesh pulse); ticked by any surface material that renders.
const TIME = { value: 0 };
const tick = () => { TIME.value = performance.now() / 1000; };

// Lambert material (cached, userData.shared: never dispose with a scene) whose map is sampled by world position,
// projected on the box face the normal points along. Up/down faces may use the painter's `top` texture.
const materials = new Map();
export function surface(key, color, { transparent = false, opacity = 1 } = {}) {
  const id = `${key}|${color}|${opacity}`;
  if (materials.has(id)) return materials.get(id);
  if (!PAINTERS[key]) key = 'grain';
  const P = PAINTERS[key], topKey = P.top ?? key, T = PAINTERS[topKey];
  const tex = texture(key), top = texture(topKey);
  const scale = P.scale ?? DEFAULT_SCALE, topScale = T.scale ?? DEFAULT_SCALE;
  const m = new THREE.MeshLambertMaterial({ color, transparent, opacity, depthWrite: !transparent });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      wTex: { value: tex }, wTop: { value: top },
      wScale: { value: new THREE.Vector3(scale, scale * SIZE / (P.h ?? SIZE), topScale) },
      wGain: { value: new THREE.Vector2(tex.userData.gain, top.userData.gain) },
      wBand: { value: new THREE.Vector2(P.band ?? 0, (P.h ?? SIZE) / SIZE / scale) },
      wPulse: { value: P.pulse ?? 0 }, wTime: TIME,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D wTex, wTop; uniform vec3 wScale; uniform vec2 wGain, wBand; uniform float wPulse, wTime;
        varying vec3 vWPos; varying vec3 vWNrm;`)
      .replace('#include <map_fragment>', `
        vec3 an = abs(vWNrm), wt;
        if (an.y > an.x && an.y > an.z) {
          wt = texture2D(wTop, vWPos.xz * wScale.z, -1.0).rgb * wGain.y; // -1 LOD bias: keep detail crisp at 200 px
        } else {
          float ly = mod(vWPos.y, ${STOREY.toFixed(1)}), v = vWPos.y;
          // banded walls: the bottom wBand.x metres once per storey, the rest of the canvas repeats above it
          if (wBand.x > 0.0) v = ly < wBand.x ? ly : wBand.x + mod(ly - wBand.x, wBand.y - wBand.x);
          vec2 wuv = vec2(an.x > an.z ? vWPos.z : vWPos.x, v) * wScale.xy;
          vec2 guv = vec2(an.x > an.z ? vWPos.z : vWPos.x, vWPos.y) * wScale.xy; // continuous coords pick the mip
          wt = textureGrad(wTex, wuv, dFdx(guv) * 0.5, dFdy(guv) * 0.5).rgb * wGain.x;
          wt *= mix(0.62, 1.0, smoothstep(0.0, 0.45, ly)); // contact shadow where walls meet the floor
        }
        if (wPulse > 0.0) wt *= 1.0 + wPulse * sin(wTime * 2.6 + dot(vWPos, vec3(0.9, 0.6, 0.7)));
        diffuseColor.rgb *= wt;`);
  };
  m.customProgramCacheKey = () => 'wuv2';
  m.onBeforeRender = tick;
  m.userData.shared = true;
  materials.set(id, m);
  return m;
}

// An image (SVG or photo URL) drawn cover-cropped into a w×h canvas, so SVGs rasterise sharp and photos come out
// square. bg + pad: a solid plate with the image fitted inside it (signs). Cached; the canvas fills in once it loads.
const images = new Map();
export function imageTexture(url, w, h = w, { bg, pad = 0 } = {}) {
  const id = `${url}|${w}|${h}|${bg}|${pad}`;
  if (images.has(id)) return images.get(id);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const t = new THREE.CanvasTexture(cv), img = new Image();
  img.onload = () => {
    const c = cv.getContext('2d'), iw = img.naturalWidth || w, ih = img.naturalHeight || h;
    const s = pad ? Math.min((w - 2 * pad) / iw, (h - 2 * pad) / ih) : Math.max(w / iw, h / ih);
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
    c.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
    t.needsUpdate = true;
  };
  img.src = url;
  t.colorSpace = THREE.SRGBColorSpace;
  images.set(id, t);
  return t;
}

// Colleague photos for enemy faces (src/faces/*), inlined as data URLs at build time (vite.config.js).
export const FACES = Object.values(import.meta.glob('./faces/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', { eager: true, import: 'default' }));
