// Projectile kinds. Its own module with no imports, so enemy/boss modules can register kinds at load time
// without tripping over the world.js ↔ enemies import cycle.
export const PROJ = {
  toner: { dmg: 100, splash: 4, gravity: 14, radius: 0.15, parts: [[0.18, 0.18, 0.4, 0x151515], [0.2, 0.06, 0.2, 0xc01880]] },
  stapler: { dmg: 12, splash: 0, gravity: 0, radius: 0.25, parts: [[0.15, 0.12, 0.35, 0xff6010, true], [0.3, 0.3, 0.3, 0xff3000, true]] },
  ink: { dmg: 14, splash: 2.3, gravity: 3, radius: 0.3, parts: [[0.45, 0.45, 0.45, 0x281048, true]] },
};
// Enemy type modules can add projectile kinds (same shape as above, plus optional onHit(g, pr, body)).
export const registerProjectiles = (table) => Object.assign(PROJ, table);
