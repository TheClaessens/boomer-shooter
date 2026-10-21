// =====================================================================================
//  Playtest kit — bot "hands" for real-time, top-down / isometric action games
//  (survivors-likes, twin-stick shooters, ARPGs, MOBA-likes, bullet hells).
//
//  The hands only do motor work: steer away from threats, sidestep projectiles, leave
//  telegraphed danger zones, dash through unavoidable hits, pick things up when calm, aim
//  and fire. Every *decision* stays with the LLM playtester.
//
//  Coordinates: one ground plane {x, z}. For a 2D game pass {x: pos.x, z: pos.y}, and set
//  unit = game units per metre (e.g. 20 for pixels) so dodge margins are sized sensibly.
//
//    import { createTopdownHands } from './kit/hands-topdown.js';
//    const hands = createTopdownHands({
//      player:      () => ({ x, z, radius }),
//      threats:     (p) => [{ x, z, radius, weight }],         // enemies near p (weight: boss 6, normal 1)
//      projectiles: () => [{ x, z, dx, dz, speed, radius }],   // hostile shots (dx,dz unit vector)
//      hazards:     () => [{ x, z, radius }],                  // lingering harmful areas (no telegraph)
//      goals:       (p) => [{ x, z, weight, calmOnly }],       // pickups, shrines, objectives
//      target:      (p, lvl) => ({ x, z } | null),             // what to aim at this tick
//      arena:       { x: 0, z: 0, radius: 30 },                // soft leash toward the centre (optional)
//      keepAt:      () => ({ x, z, near: 7, far: 11 } | null), // orbit a boss at casting range (optional)
//      apply:       ({ move:{x,z}, aim:{x,z}|null, fire, dash }) => {...},  // write into the game's input
//    });
//    // telegraphs: call hands.zone(...) from your hook on the game's telegraph function
//    hands.zone({ kind: 'circle', x, z, r, life, done: () => handle.done });
//    hands.zone({ kind: 'line', x, z, dx, dz, len, w, life, done });
//    adapter.hands = hands;   // the core calls hands.tick(ctx, level) before every step
// =====================================================================================

// look = seconds of projectile look-ahead; aware = chance to notice a given threat at all;
// react = seconds before a new telegraph is noticed; dash = chance to dash out of a sure hit;
// focus = chance to aim at the priority target, and how hard to shove away from touching foes.
export const HAND_LEVELS = {
  casual:  { look: 0.30, aware: 0.55, react: 0.45, dash: 0.35, focus: 0.5 },
  average: { look: 0.55, aware: 0.80, react: 0.25, dash: 0.70, focus: 0.8 },
  expert:  { look: 0.85, aware: 0.97, react: 0.10, dash: 0.95, focus: 1.0 },
};

export function createTopdownHands(cfg) {
  const levels = cfg.levels ?? HAND_LEVELS;
  // unit = game units per metre (1 for 3D games in metres, ~20-40 for 2D games in pixels). The hands
  // work in metres internally; positions from callbacks are scaled on the way in, aim passes through.
  const U = cfg.unit ?? 1;
  const S = (o) => o && { ...o, x: o.x / U, z: o.z / U, radius: o.radius === undefined ? undefined : o.radius / U };
  const zones = [];
  let noticed = new WeakMap();
  const sees = (obj, lv) => {
    let v = noticed.get(obj);
    if (v === undefined) { v = Math.random() < lv.aware; noticed.set(obj, v); }
    return v;
  };

  function tick(ctx, levelName) {
    const lv = levels[levelName] ?? levels.average;
    const dt = ctx.dt;
    const raw = cfg.player();
    if (!raw) return;
    const p = S(raw);

    const pr = p.radius ?? 0.5;
    let ax = 0, az = 0, threat = 0, danger = 0, mustDash = false;

    // 1. threats: inverse-square push; big ones get a wider berth, touching ones a hard shove
    for (const e of cfg.threats(raw).map(S)) {
      const dx = p.x - e.x, dz = p.z - e.z;
      const d2 = Math.max(0.5, dx * dx + dz * dz);
      const reach = (e.radius ?? 0.5) + pr + 1.2;
      const w = (e.weight ?? 1) * (0.6 + (e.radius ?? 0.5)) / d2 * (d2 < reach * reach ? 3 * lv.focus : 1);
      ax += dx * w; az += dz * w; threat += w;
    }
    const ex = ax, ez = az;   // "away from the crowd": picks dodge sides

    // 2. projectiles on a collision course within the look-ahead: sidestep (away from the crowd)
    for (const b of (cfg.projectiles?.() ?? []).map((o) => ({ ...S(o), speed: (o.speed ?? 0) / U }))) {
      if (!sees(b.ref ?? b, lv)) continue;
      const rx = p.x - b.x, rz = p.z - b.z;
      const along = rx * b.dx + rz * b.dz;
      if (along < -0.3) continue;
      const t = along / (b.speed || 1);
      if (t > lv.look) continue;
      const px = rx - b.dx * along, pz = rz - b.dz * along;
      const dist = Math.hypot(px, pz), hr = (b.radius ?? 0.35) + pr + 0.35;
      if (dist > hr) continue;
      let sx = dist > 0.01 ? px / dist : -b.dz, sz = dist > 0.01 ? pz / dist : b.dx;
      if (dist < hr * 0.6 && sx * ex + sz * ez < 0) { sx = -sx; sz = -sz; }
      const w = Math.min(10, 4 / (t + 0.15));
      ax += sx * w; az += sz * w; danger += w;
      if (t < 0.12 && dist < hr - 0.3) mustDash = true;
    }

    // 3. lingering hazards without a telegraph
    for (const h of (cfg.hazards?.() ?? []).map(S)) {
      const dx = p.x - h.x, dz = p.z - h.z, d2 = dx * dx + dz * dz, rr = (h.radius ?? 1.5) + 1;
      if (d2 < rr * rr) { const w = 3 / Math.max(0.3, d2); ax += dx * w; az += dz * w; threat += 1; }
    }

    // 4. telegraphed zones: get out of / stay out of every noticed one
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.age += dt;
      if (z.done?.() || z.age > z.life + 0.2) { zones.splice(i, 1); continue; }
      if (z.age < lv.react || !sees(z, lv)) continue;
      const left = z.life - z.age;
      let ox = 0, oz = 0, inside = false;
      if (z.kind === 'circle') {
        const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz);
        if (d < z.r + 1.0) { inside = d < z.r + pr; const k = d > 0.01 ? 1 / d : 0; ox = dx * k || 1; oz = dz * k; }
      } else {
        const rx = p.x - z.x, rz = p.z - z.z;
        const along = rx * z.dx + rz * z.dz, side = rx * -z.dz + rz * z.dx;
        if (along > -1 && along < z.len + 1 && Math.abs(side) < z.w / 2 + 1.0) {
          inside = Math.abs(side) < z.w / 2 + pr;
          let s = side >= 0 ? 1 : -1;
          if (Math.abs(side) < z.w * 0.2 && (-z.dz * s * ex + z.dx * s * ez) < 0) s = -s;
          ox = -z.dz * s; oz = z.dx * s;
        }
      }
      if (!ox && !oz) continue;
      const w = 12 / (Math.max(0, left) + 0.25);
      ax += ox * w; az += oz * w; danger += w;
      if (inside && left < 0.25) mustDash = true;
    }

    // 5. compose: circle-strafe when safe, leash to the arena, orbit the priority target, collect when calm
    let mx = ax + (danger > 0 ? 0 : -az * 0.6), mz = az + (danger > 0 ? 0 : ax * 0.6);
    const ar = cfg.arena && S(cfg.arena);
    if (ar) {
      const dx = p.x - (ar.x ?? 0), dz = p.z - (ar.z ?? 0), r = Math.hypot(dx, dz);
      if (r > ar.radius) { mx -= dx / r * (r - ar.radius) * 0.6; mz -= dz / r * (r - ar.radius) * 0.6; }
    }
    const kr = danger === 0 ? cfg.keepAt?.() : null;
    const keep = kr && { x: kr.x / U, z: kr.z / U, near: (kr.near ?? 7 * U) / U, far: (kr.far ?? 11 * U) / U };
    if (keep) {
      const dx = keep.x - p.x, dz = keep.z - p.z, d = Math.hypot(dx, dz) || 1;
      const pull = d > (keep.far ?? 11) ? 1.5 : d < (keep.near ?? 7) ? -1.5 : 0;
      mx += dx / d * pull; mz += dz / d * pull;
    }
    if (danger === 0) {
      for (const g of (cfg.goals?.(raw) ?? []).map(S)) {
        if (g.calmOnly !== false && threat > (g.maxThreat ?? 0.4)) continue;
        const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
        mx += dx / d * (g.weight ?? 1); mz += dz / d * (g.weight ?? 1);
      }
    }
    const l = Math.hypot(mx, mz);
    const move = l > 0.01 ? { x: mx / l, z: mz / l } : { x: 0, z: 0 };
    const aim = cfg.target(raw, lv) ?? null;   // aim stays in game units
    let dash = false;
    if (mustDash && Math.random() < lv.dash) dash = true;
    else if (threat > 1.2 && Math.random() < 0.04) dash = true;
    cfg.apply({ move, aim, fire: !!aim, dash, threat, danger });
  }

  return {
    levels,
    tick,
    zone(z) { zones.push({ age: 0, ...z, x: z.x / U, z: z.z / U, r: (z.r ?? 0) / U, len: (z.len ?? 0) / U, w: (z.w ?? 0) / U }); },
    reset() { zones.length = 0; noticed = new WeakMap(); },
  };
}
