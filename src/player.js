import * as THREE from 'three';
import { moveBody, updateBox } from './physics.js';

// Quake-lite: 12 m/s run (~2.5x a modern walk), Quake air acceleration so strafe-jumping and bunny-hopping just work.
const MAX_SPEED = 12, ACCEL = 10, AIR_ACCEL = 12, AIR_CAP = 1.2, FRICTION = 5, STOP_SPEED = 3.5, JUMP = 9, G = 28;
// Dash: 2 charges recharging one at a time; a short burst with no gravity/friction, then momentum carries.
const DASH_SPEED = 22, DASH_TIME = 0.16, DASH_RECHARGE = 1.1, DASH_IFRAMES = 0.15;
export const EYE = 1.55, DASH_CHARGES = 2;

const wish = new THREE.Vector3();

// loadout: { owned: [ids], ammo: {…}, health, armor } carried from the previous level (or a level's default).
export function createPlayer(spawn, loadout) {
  const p = {
    pos: spawn.pos.clone(), vel: new THREE.Vector3(), r: 0.4, h: 1.7, box: {}, yaw: spawn.yaw, pitch: 0, onGround: false,
    health: loadout.health ?? 100, armor: loadout.armor ?? 0, dead: false, hasKey: false,
    owned: Object.fromEntries(loadout.owned.map((w) => [w, true])),
    ammo: { shells: 0, staples: 0, toner: 0, cells: 0, ...loadout.ammo },
    weapon: loadout.weapon ?? (loadout.owned.includes('shotgun') ? 'shotgun' : loadout.owned[0]),
    cooldown: 0, switchT: 0, kick: 0, flash: 0, swing: 0, pumpT: 0, charge: 0,
    dashCharges: DASH_CHARGES, dashRecharge: 0, dashT: 0, lastDash: -9, iframes: 0,
  };
  updateBox(p);
  return p;
}

// What a player carries into the next level.
export const loadoutOf = (p) => ({
  owned: Object.keys(p.owned).filter((w) => p.owned[w]), ammo: { ...p.ammo }, health: Math.max(p.health, 50), armor: p.armor, weapon: p.weapon,
});

export const aim = (yaw, pitch, out) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

function accelerate(vel, wishSpeed, accel, dt, cap = wishSpeed) {
  const add = cap - (vel.x * wish.x + vel.z * wish.z);
  if (add <= 0) return;
  const a = Math.min(accel * dt * wishSpeed, add);
  vel.x += a * wish.x;
  vel.z += a * wish.z;
}

export function movePlayer(g, input, dt) {
  const p = g.player, k = input.keys;
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  wish.set(-sin * f + cos * s, 0, -cos * f - sin * s);
  if (wish.lengthSq() > 0) wish.normalize();
  p.iframes -= dt;

  if (p.dashCharges < DASH_CHARGES && (p.dashRecharge -= dt) <= 0) {
    p.dashCharges++;
    p.dashRecharge = DASH_RECHARGE;
  }
  if (input.dash && p.dashCharges > 0) {
    if (p.dashCharges === DASH_CHARGES) p.dashRecharge = DASH_RECHARGE;
    p.dashCharges--;
    const dx = wish.lengthSq() > 0 ? wish.x : -sin, dz = wish.lengthSq() > 0 ? wish.z : -cos;
    const keep = Math.max(DASH_SPEED, p.vel.x * dx + p.vel.z * dz);
    p.vel.set(dx * keep, Math.max(0, p.vel.y), dz * keep);
    p.dashT = DASH_TIME;
    p.lastDash = g.time;
    p.iframes = Math.max(p.iframes, DASH_IFRAMES);
    g.audio.play('dash');
    g.fx.dash?.(p);
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
  } else {
    // Jumping before friction is what makes holding space bunny-hop.
    if (p.onGround && k.Space) {
      p.vel.y = JUMP;
      p.onGround = false;
    }
    if (p.onGround) {
      const speed = Math.hypot(p.vel.x, p.vel.z);
      if (speed > 0) {
        const scale = Math.max(0, speed - Math.max(speed, STOP_SPEED) * FRICTION * dt) / speed;
        p.vel.x *= scale;
        p.vel.z *= scale;
      }
      accelerate(p.vel, MAX_SPEED, ACCEL, dt);
    } else accelerate(p.vel, MAX_SPEED, AIR_ACCEL, dt, AIR_CAP);
    p.vel.y -= G * dt;
  }
  const hit = moveBody(p, p.vel.x * dt, p.vel.y * dt, p.vel.z * dt, g.solids);
  if (hit.x) p.vel.x = 0;
  if (hit.z) p.vel.z = 0;
  p.onGround = hit.y && p.vel.y < 0;
  if (hit.y) p.vel.y = 0;
}
