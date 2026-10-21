// Everything collides as axis-aligned boxes {x0,y0,z0,x1,y1,z1}.
// Bodies are {pos: Vector3 at the feet, r: half width, h: height, box}.

const EPS = 1e-3;

function axisMove(b, axis, d, solids) {
  if (!d) return false;
  const p = b.pos, r = b.r, h = b.h;
  const ox = p.x, oy = p.y, oz = p.z;
  p[axis] += d;
  let blocked = false;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (p.x + r <= s.x0 || p.x - r >= s.x1 || p.y + h <= s.y0 || p.y >= s.y1 || p.z + r <= s.z0 || p.z - r >= s.z1) continue;
    // Already overlapping before this step: let the body walk out instead of teleporting it.
    if (!(ox + r <= s.x0 || ox - r >= s.x1 || oy + h <= s.y0 || oy >= s.y1 || oz + r <= s.z0 || oz - r >= s.z1)) continue;
    blocked = true;
    if (axis === 'y') p.y = d > 0 ? s.y0 - h - EPS : s.y1 + EPS;
    else if (axis === 'x') p.x = d > 0 ? s.x0 - r - EPS : s.x1 + r + EPS;
    else p.z = d > 0 ? s.z0 - r - EPS : s.z1 + r + EPS;
  }
  return blocked;
}

// Substepped so fast bodies (rocket jumps) can't tunnel through 0.5m walls.
export function moveBody(b, dx, dy, dz, solids) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.2));
  const hit = { x: false, y: false, z: false };
  for (let i = 0; i < n; i++) {
    hit.y = axisMove(b, 'y', dy / n, solids) || hit.y;
    hit.x = axisMove(b, 'x', dx / n, solids) || hit.x;
    hit.z = axisMove(b, 'z', dz / n, solids) || hit.z;
  }
  updateBox(b);
  return hit;
}

export function updateBox(b) {
  const p = b.pos, x = b.box;
  x.x0 = p.x - b.r; x.x1 = p.x + b.r;
  x.y0 = p.y; x.y1 = p.y + b.h;
  x.z0 = p.z - b.r; x.z1 = p.z + b.r;
}

const R = { t0: 0, t1: 0, axis: -1 };
function slab(o, d, lo, hi, axis) {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / d, b = (hi - o) / d;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > R.t0) { R.t0 = a; R.axis = axis; }
  if (b < R.t1) R.t1 = b;
  return R.t0 <= R.t1;
}

// Distance along normalized d to box s, or Infinity if missed within tMax. Inside the box = 0.
export function rayBox(o, d, s, tMax) {
  R.t0 = 0; R.t1 = tMax; R.axis = -1;
  return slab(o.x, d.x, s.x0, s.x1, 0) && slab(o.y, d.y, s.y0, s.y1, 1) && slab(o.z, d.z, s.z0, s.z1, 2) ? R.t0 : Infinity;
}

// Surface normal of the last raycast() hit (zero if it hit nothing or started inside a box).
export const RAY_NORMAL = { x: 0, y: 0, z: 0 };

export function raycast(solids, o, d, tMax) {
  let t = tMax, axis = -1;
  for (let i = 0; i < solids.length; i++) {
    if (solids[i].clip) continue; // movement-only walls don't stop shots or sight
    const h = rayBox(o, d, solids[i], t);
    if (h < t) { t = h; axis = R.axis; }
  }
  RAY_NORMAL.x = axis === 0 ? -Math.sign(d.x) : 0;
  RAY_NORMAL.y = axis === 1 ? -Math.sign(d.y) : 0;
  RAY_NORMAL.z = axis === 2 ? -Math.sign(d.z) : 0;
  return t;
}

// Distance from point p to the closest point of box s.
export function boxDist(p, s) {
  const dx = Math.max(s.x0 - p.x, 0, p.x - s.x1);
  const dy = Math.max(s.y0 - p.y, 0, p.y - s.y1);
  const dz = Math.max(s.z0 - p.z, 0, p.z - s.z1);
  return Math.hypot(dx, dy, dz);
}
