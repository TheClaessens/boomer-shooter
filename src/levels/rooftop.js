import * as THREE from 'three';
import { addPickup } from '../world.js';

// Rooftop: Board Meeting. The player rides the service lift up (south, +z) and pushes north (-z):
//
//   service lift (z 58..62, rises from y -8) → service corridor → STAIRWELL (secret 1: crate climb to a vent)
//   → BOARDROOM (lockdown ambush, 2 waves; secret 2 behind the portrait) → ROOFTOP HELIPAD: THE CEO
//   → executive elevator (north, barred until the boss dies) = exit.

// Refs into the current build (build runs once per level start).
let R = {};

// Arena pickups that come back during the fight (kind, x, z).
const RESTOCK = [
  ['donut', -11, -7.5], ['donut', 11, -36.5], ['coffee', 11, -7.5], ['coffee', -11, -36.5],
  ['shells', -21, -3], ['shells', 21, -41], ['staples', 21, -3], ['staples', -21, -41],
  ['toner', -19, -19.5], ['toner', 19, -24.5], ['cells', 0, -3], ['cells', 0, -41],
];
// Ammo comes back faster than health: running dry mid-boss is not fun, free healing would be.
const RESTOCK_T = { donut: 20, coffee: 20 }, AMMO_T = 12;
const restockT = (kind) => RESTOCK_T[kind] ?? AMMO_T;

export default {
  id: 'rooftop',
  name: 'ROOFTOP: BOARD MEETING',
  par: 240,
  next: null,
  loadout: { owned: ['axe', 'shotgun', 'ssg', 'stapler', 'launcher', 'laser'], ammo: { shells: 25, staples: 100, toner: 10, cells: 15 } },
  bossBounds: { x0: -21.5, x1: 21.5, z0: -41.5, z1: -3 },

  build(B) {
    const { PAL, rnd } = B;
    R = {};
    // Night sky. Fog only bites far away, so the city glows through it.
    B.scene.background = new THREE.Color(0x0c0614);
    B.scene.fog = new THREE.Fog(0x140a1c, 45, 330);

    // ── SERVICE LIFT: spawn at the bottom of the shaft, it rises on its own ───────────────────
    const SHAFT = ['metal', 0x4a4448];
    B.box(-2.5, -9.5, 57.5, -2, 4, 62.5, SHAFT);
    B.box(2, -9.5, 57.5, 2.5, 4, 62.5, SHAFT);
    B.box(-2.5, -9.5, 62, 2.5, 4, 62.5, SHAFT);
    B.box(-2, -9.5, 57.5, 2, -0.5, 58, SHAFT);
    B.box(-2, 3.5, 58, 2, 4, 62, SHAFT);
    B.box(-2, -9.5, 58, 2, -8.9, 62, SHAFT);
    B.lift(-2, -8.9, 58, 2, -8.4, 62, ['plate', 0x707070], 0);
    for (const y of [-6.5, -3.5]) B.box(-1, y, 57.99, 1, y + 0.4, 58, 0xff3020, { solid: false, glow: true });
    B.box(-1.2, 2.6, 58.05, 1.2, 3.2, 58.1, 0x20ff40, { solid: false, glow: true }); // "R" floor light
    B.light(0, 2.5, 60, 0xffb070, 6, 12);

    // ── SERVICE CORRIDOR ──────────────────────────────────────────────────────────────────
    B.hall(-2, 46.5, 2, 58, 0, 3.5, PAL.VENT, false);
    for (const z of [49, 53]) B.box(-1.9, 0, z, -1.4, 2.6, z + 1.2, ['metal', 0x6a5a48]); // pipes
    B.box(1.5, 3, 46.5, 1.9, 3.4, 58, ['metal', 0x8a3a20], { solid: false });
    B.light(0, 3, 51, 0xff4020, 5, 12, true);
    B.pick('shells', 1, 0.4, 55);
    B.mob('intern', 1, 0, 48);

    // ── STAIRWELL: tall, steps up the east wall to a sniper landing ─────────────────────────
    B.room(-8, 32, 8, 46, 0, 9, PAL.ARCHIVE, { n: [[-2, 2, 3.5]], s: [[-2, 2, 3.5]], w: [[33, 37, 9]] });
    B.box(-8.5, 0, 33, -8, 3, 37, PAL.ARCHIVE.wall);
    B.box(-8.5, 5, 33, -8, 9, 37, PAL.ARCHIVE.wall);
    for (let i = 0; i < 12; i++) B.box(5, 0, 44 - i, 8, 0.5 * (i + 1), 45 - i, ['concrete', 0x8a8478]);
    B.box(5, 0, 32, 8, 6, 33, ['concrete', 0x8a8478]);
    B.box(4.9, 6, 32, 5, 7, 34, 0xc0a020, { solid: false }); // landing railing
    // Secret 1: crates up to the west landing, then the vent.
    B.box(-7.5, 0, 41, -5.5, 1, 43, ['planks', 0x8a6a40]);
    B.box(-7.5, 0, 38.5, -5.5, 2, 40.5, ['planks', 0x8a6a40]);
    B.box(-8, 2.6, 32, -4.5, 3, 38, ['metal', 0x5a5a5a]);
    B.box(-8.6, 3, 33.2, -8.4, 5, 36.8, 0x302a26, { solid: false }); // vent grille hint
    B.box(-12, 2.5, 33, -8.5, 3, 37, PAL.VENT.floor);
    B.box(-12, 5.5, 33, -8.5, 6, 37, PAL.VENT.ceil);
    B.box(-12.5, 2.5, 32.5, -8.5, 6, 33, PAL.VENT.wall);
    B.box(-12.5, 2.5, 37, -8.5, 6, 37.5, PAL.VENT.wall);
    B.box(-12.5, 2.5, 33, -12, 6, 37, PAL.VENT.wall);
    B.secret(-12, 3, 33, -8.5, 5.5, 37);
    B.pick('espresso', -11, 3.5, 35);
    B.pick('shells', -10, 3.4, 34);
    B.pick('cells', -10, 3.4, 36);
    B.light(-10.5, 5, 35, 0xffd080, 3, 6);
    // Dressing: hazard stripes, a flesh-eaten corner, emergency light.
    B.box(-2, 0, 45.9, 2, 0.15, 46, ['hazard', 0xd0a020], { solid: false });
    B.flesh(7.5, 8.5, 45.5, 1.4);
    B.flesh(-7.8, 0.5, 45, 1);
    B.box(-1, 8.7, 39, 1, 8.95, 40, 0xff2010, { solid: false, glow: true });
    B.light(0, 8, 39.5, 0xff3020, 9, 20, true);
    B.light(0, 4, 34, 0xc0d0ff, 5, 14);
    B.pick('staples', -4, 0.4, 44);
    B.pick('coffee', 4, 0.4, 44);
    B.pick('coffee', 6.5, 6.4, 32.6);
    B.mob('burnout', -3, 0, 35);
    B.mob('burnout', 3, 0, 37);
    B.mob('manager', 0, 0, 34);
    B.mob('compliance', -2, 0, 41);
    B.mob('sysadmin', 6.5, 6, 32.6);
    B.mob('intern', -6, 3, 35);

    // ── BOARDROOM: long table, the board in session ─────────────────────────────────────────
    B.hall(-2, 28.5, 2, 31.5, 0, 3.5, PAL.CEO, false);
    const doorS = B.door(-2, 0, 28, 2, 3.5, 28.5, ['wood', 0x5a3a28]);
    B.room(-12, 4, 12, 28, 0, 5, PAL.CEO, { n: [[-2, 2, 4]], s: [[-2, 2, 3.5]], e: [[14, 18, 3]] });
    const doorN = B.door(-2, 0, 3.5, 2, 4, 4, ['metal', 0x3a3a40]);
    R.doorN = doorN;
    // Table, chairs, the empty throne at its head.
    B.box(-1.6, 0, 9.5, 1.6, 0.9, 22.5, 0x2a1810);
    B.box(-2.2, 0.9, 8.8, 2.2, 1.05, 23.2, ['wood', 0x6a4028]);
    for (let z = 10; z <= 22; z += 2.4) {
      for (const s of [-1, 1]) {
        B.box(s * 2.9 - 0.35, 0, z - 0.35, s * 2.9 + 0.35, 0.55, z + 0.35, 0x3a1010, { solid: false });
        B.box(s * 3.25 - 0.06, 0.55, z - 0.35, s * 3.25 + 0.06, 1.7, z + 0.35, 0x3a1010, { solid: false });
      }
      B.box(-0.3, 1.05, z - 0.08, -0.12, 1.25, z + 0.08, 0xffc060, { solid: false, glow: true }); // candles
    }
    B.box(-1, 0, 6.2, 1, 0.8, 7.4, 0x501010);
    B.box(-1, 0.8, 6.2, 1, 3.6, 6.6, 0x501010);
    for (const s of [-1, 1]) B.box(s * 0.9 - 0.1, 3.6, 6.2, s * 0.9 + 0.1, 4.3, 6.4, 0xd8c8a0, { solid: false }); // horned throne
    // Quarterly results: a giant screen, every bar red and falling.
    B.box(-5.5, 1.4, 4, 5.5, 4.4, 4.1, 0x101014, { solid: false });
    [2.6, 2.1, 1.7, 1.1, 0.6, 0.25].forEach((h, i) => B.box(-4.5 + i * 1.6, 1.7, 4.1, -3.7 + i * 1.6, 1.7 + h, 4.12, 0xff3018, { solid: false, glow: true }));
    // Night windows down the west wall.
    for (let z = 7; z < 26; z += 4) B.box(-11.95, 1.2, z, -11.9, 4.2, z + 2.6, 0x101838, { solid: false, glow: true });
    // Secret 2: the portrait's eyes watch a slightly newer stretch of panelling.
    B.box(11.85, 3.3, 14.3, 11.95, 4.8, 17.7, 0xb08820, { solid: false });
    B.box(11.8, 3.45, 14.6, 11.85, 4.65, 17.4, 0x701410, { solid: false });
    for (const z of [15.7, 16.3]) B.box(11.75, 4.05, z - 0.12, 11.8, 4.15, z + 0.12, 0xffd040, { solid: false, glow: true });
    B.door(12, 0, 14, 12.5, 3, 18, ['wood', 0x5a4436], { secret: true });
    B.box(12.5, -0.5, 12.5, 17.5, 0, 19.5, PAL.CEO.floor);
    B.box(12.5, 3, 12.5, 17.5, 3.5, 19.5, PAL.CEO.ceil);
    B.box(12.5, 0, 12.5, 17.5, 3, 13, PAL.CEO.wall);
    B.box(12.5, 0, 19, 17.5, 3, 19.5, PAL.CEO.wall);
    B.box(17, 0, 13, 17.5, 3, 19, PAL.CEO.wall);
    B.box(15.5, 0, 14.5, 16.8, 1.1, 17.5, ['wood', 0x6a4028]); // the private bar
    B.secret(12.5, 0, 13, 17, 3, 19);
    B.pick('kevlar', 14, 0.5, 16);
    B.pick('toner', 16, 1.5, 15);
    B.pick('toner', 16, 1.5, 17);
    B.pick('cells', 14, 0.4, 14);
    B.light(14.5, 2.6, 16, 0xffc060, 4, 7);
    B.flesh(-11.8, 4.6, 6, 1.4);
    B.flesh(11.8, 4.5, 25, 1.6);
    B.flesh(0, 5, 16, 2);
    B.flesh(-8, 0.2, 27.6, 1.2);
    B.light(0, 4.4, 10, 0xff4020, 10, 16, true);
    B.light(0, 4.4, 21, 0xff4020, 10, 16);
    B.light(0, 3, 5.5, 0xff2010, 5, 9);
    B.light(-9, 3.5, 16, 0x6070ff, 4, 12);
    for (const [k, x, z] of [['shells', -10, 26], ['shells', 10, 6], ['staples', 10, 26], ['toner', -10, 6], ['donut', -10, 16], ['coffee', 10, 12], ['coffee', 10, 20], ['cells', 0, 26]]) B.pick(k, x, 0.4, z);
    // Lockdown: the board, then their enforcers.
    for (const [t, x, z] of [['manager', -4.5, 10], ['manager', 4.5, 15], ['manager', -4.5, 20], ['compliance', 0, 5.5], ['intern', 4.5, 22], ['intern', -4.5, 14]]) B.mob(t, x, 0, z, 'board1');
    for (const [t, x, y, z] of [['brute', 0, 0, 6], ['burnout', -9, 0, 7], ['burnout', 9, 0, 7], ['burnout', -9, 0, 25], ['burnout', 9, 0, 25], ['printer', -7, 3.2, 16], ['printer', 7, 3.2, 16]]) B.mob(t, x, y, z, 'board2');
    B.arena(-12, 0, 4.5, 12, 5, 27, ['board1', 'board2'], [doorS, doorN]);

    // ── ROOFTOP: the helipad at night ───────────────────────────────────────────────────────
    B.box(-24.5, -0.5, -44.5, 24.5, 0, 3.5, PAL.ROOF.floor);
    const PARA = ['concrete', 0x7a7480];
    B.box(-24.5, 0, 3.5, -12.5, 1.2, 4, PARA);
    B.box(12.5, 0, 3.5, 24.5, 1.2, 4, PARA);
    B.box(-24.5, 0, -44.5, -24, 1.2, 3.5, PARA);
    B.box(24, 0, -44.5, 24.5, 1.2, 3.5, PARA);
    B.box(-24.5, 0, -44.5, -3, 1.2, -44, PARA);
    B.box(3, 0, -44.5, 24.5, 1.2, -44, PARA);
    for (const [x0, z0, x1, z1] of [[-24.5, 3.5, -12.5, 4], [12.5, 3.5, 24.5, 4], [-24.5, -44.5, -24, 3.5], [24, -44.5, 24.5, 3.5], [-24.5, -44.5, -3, -44], [3, -44.5, 24.5, -44]]) {
      B.box(x0, 1.2, z0, x1, 40, z1, 0, { clip: true });
      B.box(x0 - 0.05, 1.2, z0 - 0.05, x1 + 0.05, 1.3, z1 + 0.05, 0x9a96a0, { solid: false }); // coping
    }
    // The building below, its windows lit by people still on overtime.
    B.box(-24.5, -90, -44.5, 24.5, -0.5, 28.5, ['concrete', 0x2a2830], { solid: false });
    for (let y = -4; y > -60; y -= 4) {
      for (let a = -22; a < 22; a += 3) {
        if (rnd() < 0.3) B.box(a, y, -44.6, a + 1.6, y + 2, -44.5, rnd() < 0.8 ? 0xffd890 : 0xff5030, { solid: false, glow: true });
        if (rnd() < 0.3) B.box(-24.6, y, a - 20, -24.5, y + 2, a - 18.4, 0xffd890, { solid: false, glow: true });
        if (rnd() < 0.3) B.box(24.5, y, a - 20, 24.6, y + 2, a - 18.4, rnd() < 0.7 ? 0xffd890 : 0x90b8ff, { solid: false, glow: true });
      }
    }
    // The city: dark towers with lit windows facing us, red beacons on the tall ones.
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2, d = 60 + rnd() * 90, cx = Math.sin(a) * d, cz = -20 + Math.cos(a) * d;
      const w = 8 + rnd() * 12, dd = 8 + rnd() * 12, top = -45 + rnd() * 70;
      B.box(cx - w / 2, -120, cz - dd / 2, cx + w / 2, top, cz + dd / 2, rnd() < 0.5 ? 0x181822 : 0x221c26, { solid: false });
      const fx = cx > 0 ? cx - w / 2 - 0.05 : cx + w / 2, fz = cz > -20 ? cz - dd / 2 - 0.05 : cz + dd / 2;
      const lit = rnd() < 0.15 ? 0x90b8ff : rnd() < 0.2 ? 0xff6a30 : 0xffd080;
      for (let y = top - 3; y > top - 45; y -= 3.5) {
        for (let k = -w / 2 + 1; k < w / 2 - 1; k += 2.5) if (rnd() < 0.35) B.box(cx + k, y, fz, cx + k + 1.2, y + 1.6, fz + 0.05, lit, { solid: false, glow: true });
        for (let k = -dd / 2 + 1; k < dd / 2 - 1; k += 2.5) if (rnd() < 0.35) B.box(fx, y, cz + k, fx + 0.05, y + 1.6, cz + k + 1.2, lit, { solid: false, glow: true });
      }
      if (top > 5) {
        B.box(cx - 0.2, top, cz - 0.2, cx + 0.2, top + 8, cz + 0.2, 0x303038, { solid: false });
        B.box(cx - 0.5, top + 8, cz - 0.5, cx + 0.5, top + 9, cz + 0.5, 0xff1010, { solid: false, glow: true });
      }
    }
    // Blood moon (pixel disc) and hell-lit clouds.
    for (const [hw, y0, y1] of [[5, -9, 9], [9, -7, 7], [11, -5, 5], [12, -2.5, 2.5]]) B.box(-70 - hw, 75 + y0, -230, -70 + hw, 75 + y1, -229, 0xc83a20, { solid: false, glow: true });
    for (let i = 0; i < 14; i++) {
      const x = -180 + rnd() * 360, z = -220 + rnd() * 300, y = 70 + rnd() * 40, w = 20 + rnd() * 40;
      B.box(x, y, z, x + w, y + 2 + rnd() * 3, z + w * 0.4, rnd() < 0.5 ? 0x3a1018 : 0x281020, { solid: false, glow: true });
    }

    // Helipad: painted H in a ring, amber edge lights, ember cracks in the roof.
    B.box(-8, 0, -30, 8, 0.02, -14, ['asphalt', 0x2a2a30], { solid: false });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, x = Math.sin(a) * 6.5, z = -22 + Math.cos(a) * 6.5;
      const m = B.box(x - 1.05, 0.02, z - 0.2, x + 1.05, 0.04, z + 0.2, 0xb8b4a8, { solid: false });
      m.rotation.y = a;
    }
    B.box(-2.4, 0.02, -25, -1.6, 0.04, -19, 0xb8b4a8, { solid: false });
    B.box(1.6, 0.02, -25, 2.4, 0.04, -19, 0xb8b4a8, { solid: false });
    B.box(-1.6, 0.02, -22.4, 1.6, 0.04, -21.6, 0xb8b4a8, { solid: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.box(Math.sin(a) * 8.3 - 0.2, 0, -22 + Math.cos(a) * 8.3 - 0.2, Math.sin(a) * 8.3 + 0.2, 0.12, -22 + Math.cos(a) * 8.3 + 0.2, 0xffa020, { solid: false, glow: true });
    }
    for (let i = 0; i < 9; i++) {
      let x = -20 + rnd() * 40, z = -40 + rnd() * 34;
      for (let k = 0; k < 6; k++) {
        // Jagged crack: alternate short x and z runs.
        const nx = k % 2 ? x : x + (rnd() - 0.5) * 3, nz = k % 2 ? z + (rnd() - 0.5) * 3 : z;
        B.box(Math.min(x, nx), 0, Math.min(z, nz), Math.max(x, nx) + 0.12, 0.03, Math.max(z, nz) + 0.12, 0xd05a10, { solid: false, glow: true });
        x = nx; z = nz;
      }
    }
    // Cover: AC units (jump on them to dodge a shockwave), brick vent stacks, a water tower.
    for (const [x, z] of [[-11, -10], [11, -10], [-11, -34], [11, -34]]) {
      B.box(x - 1.6, 0, z - 1.1, x + 1.6, 1.0, z + 1.1, ['metal', 0x8a8e94]);
      B.box(x - 1.2, 1.0, z - 0.8, x + 0.2, 1.05, z + 0.8, 0x202428, { solid: false });
      B.box(x + 0.5, 1.0, z - 0.3, x + 1.3, 1.6, z + 0.3, ['metal', 0x6a6e74]);
    }
    for (const x of [-19, 19]) {
      B.box(x - 0.9, 0, -22.9, x + 0.9, 4.5, -21.1, ['brick', 0x7a3a2a]);
      B.box(x - 1.05, 4.5, -23.05, x + 1.05, 4.8, -20.95, 0x4a4040);
      B.flesh(x, 4.8, -22, 1.2);
    }
    for (const [x, z] of [[15.5, -39.5], [19.5, -39.5], [15.5, -43], [19.5, -43]]) B.box(x - 0.15, 0, z - 0.15, x + 0.15, 4, z + 0.15, 0x3a3236);
    B.box(15, 4, -43.5, 20, 7.5, -39, ['planks', 0x5a3a2a]);
    B.box(14.8, 7.5, -43.7, 20.2, 8, -38.8, 0x2a2224);
    B.box(-20.15, 0, -41.15, -19.85, 14, -40.85, 0x5a5a60); // antenna
    B.box(-20.4, 14, -41.4, -19.6, 14.8, -40.6, 0xff1010, { solid: false, glow: true });
    for (const [x, z] of [[-14, -5], [15, -15], [-15, -29], [6, -40], [-5, -15], [16, -5]]) B.barrel(x, 0, z);
    // Floodlight poles in the corners, red hell glow from the vent stacks.
    for (const [x, z] of [[-22.5, -42.5], [22.5, -42.5], [-22.5, 2], [22.5, 2]]) {
      B.box(x - 0.15, 0, z - 0.15, x + 0.15, 7, z + 0.15, 0x3a3a40);
      B.box(x - 0.6, 7, z - 0.4, x + 0.6, 7.5, z + 0.4, 0xe8f0ff, { solid: false, glow: true });
      B.light(x * 0.85, 6.5, -20 + (z + 20) * 0.85, 0xc8d4ff, 20, 42);
    }
    B.light(0, 10, -22, 0xffe0c0, 14, 24); // the spotlight on the helipad
    B.light(-17, 1.5, -22, 0xff2a10, 8, 16, true);
    B.light(17, 1.5, -22, 0xff2a10, 8, 16);
    // Penthouse facade over the door we came through.
    B.box(-3, 4.2, 3.4, 3, 4.8, 3.5, 0xff2010, { solid: false, glow: true });
    B.pick('kevlar', -6, 0.5, -2); // suit up before the meeting
    B.pick('kevlar', 6, 5.9, 12); // rocket-jump treat on the boardroom roof
    B.pick('cells', -6, 5.9, 12);
    // Billboard behind the executive elevator: the chart only goes up.
    B.box(-14, 5, -48.5, 14, 13, -48, ['metal', 0x2a2a30], { solid: false });
    for (const x of [-10, 10]) B.box(x - 0.3, -2, -48.6, x + 0.3, 5, -48.1, 0x3a3a40, { solid: false });
    [1.2, 2, 2.8, 3.9, 5.2, 6.8].forEach((h, i) => B.box(-11 + i * 3.6, 5.6, -47.95, -9 + i * 3.6, 5.6 + h, -47.9, i === 5 ? 0xffc020 : 0xff5020, { solid: false, glow: true }));
    B.box(-14, 12.6, -47.95, 14, 13, -47.9, 0xffc020, { solid: false, glow: true });
    B.light(0, 7, -45, 0xffa040, 8, 18);

    // ── EXECUTIVE ELEVATOR: barred until the board is dissolved ────────────────────────────
    B.room(-2.5, -50, 2.5, -44.5, 0, 3.5, PAL.CEO, { s: [[-2, 2, 3.2]] });
    R.exitDoor = B.door(-2, 0, -44.5, 2, 3.2, -44, ['metal', 0xb08820]);
    for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) R.exitDoor.meshes.push(B.box(x - 0.08, 0, -44.05, x + 0.08, 3.2, -43.95, 0x202020, { solid: false, dynamic: true }));
    for (const m of R.exitDoor.meshes) m.userData.baseY = m.position.y;
    R.signMat = new THREE.MeshBasicMaterial({ color: 0xff1010 });
    B.box(-2.5, 4, -44.4, 2.5, 4.7, -44.2, 0, { solid: false, material: R.signMat });
    R.boothLight = B.light(0, 2.8, -47, 0xff2010, 5, 9);
    B.box(-2.5, 0, -50, 2.5, 0.02, -46, 0xffc020, { solid: false, glow: true });
    B.exit(-2.5, 0, -50, 2.5, 3, -46);

    // ── THE CEO ──────────────────────────────────────────────────────────────────────────────
    B.mob('ceo', 0, 0, -26);
    B.trig(-24, 0, -41, 24, 6, -4, 'script', 'boss');
    R.thunderLight = B.light(0, 45, -60, 0xb0a0ff, 0, 220);
    R.bolt = new THREE.Group();
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xe8d8ff, fog: false });
    let bx = 0, by = 100;
    for (let i = 0; i < 9; i++) {
      const nx = bx + (rnd() - 0.5) * 10, ny = by - 11;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 1.2), boltMat);
      m.position.set((bx + nx) / 2, (by + ny) / 2, 0);
      m.rotation.z = Math.atan2(nx - bx, 11);
      R.bolt.add(m);
      bx = nx; by = ny;
    }
    R.bolt.visible = false;
    B.scene.add(R.bolt);

    return { spawn: { pos: new THREE.Vector3(0, -8.4, 60), yaw: 0 } };
  },

  start(g) {
    R.exitDoor.locked = true;
    R.ceo = g.enemies.find((e) => e.type === 'ceo');
    R.ceo.state = 'dormant';
    R.ceo.yaw = Math.PI; // gazing over his city, back to the door
    g.boss = null; // the bar appears when the meeting starts
    R.stock = RESTOCK.map(([kind, x, z]) => ({ pu: addPickup(g, kind, x, 0.4, z), t: restockT(kind) }));
    R.thunderT = 6;
    R.msgT = 0;
  },

  onTrigger(g, name) {
    if (name === 'boss' && R.ceo.state === 'dormant') R.ceo.state = 'chase';
  },

  // Called by the CEO when the intro starts / when he dies.
  bossStart(g) {
    R.doorN.locked = true;
    R.fight = true;
  },
  bossDefeated(g) {
    R.fight = false;
    R.doorN.locked = false;
    R.exitDoor.locked = false;
    R.signMat.color.setHex(0x20ff40);
    R.boothLight.color.setHex(0x40ff60);
    R.boothLight.intensity = 10;
    R.msgT = 4.5;
  },

  update(g, dt) {
    // Arena restock while the fight is on: each spot refills restockT(kind) s after it's taken.
    if (R.fight) {
      RESTOCK.forEach(([kind, x, z], i) => {
        const s = R.stock[i];
        if (s.pu && g.pickups.includes(s.pu)) return;
        if ((s.t -= dt) > 0) return;
        s.pu = addPickup(g, kind, x, 0.4, z);
        s.t = restockT(kind);
        g.fx.burst(new THREE.Vector3(x, 0.6, z), 0xffe080, 8, 3, 0.08, 0.5);
      });
    }
    if (R.msgT > 0 && (R.msgT -= dt) <= 0) {
      g.hud.msg('EXECUTIVE ELEVATOR UNLOCKED', 4);
      g.audio.play('clear');
    }
    // Lightning over the city.
    R.thunderT -= dt;
    if (R.thunderT <= 0) {
      R.thunderT = 7 + Math.random() * 9;
      R.flashT = 0.35;
      R.bolt.position.set((Math.random() - 0.5) * 240, 0, -150 - Math.random() * 60);
      R.bolt.rotation.y = Math.random() * Math.PI;
      g.audio.play('thunder');
    }
    R.flashT = (R.flashT ?? 0) - dt;
    const on = R.flashT > 0 && (R.flashT > 0.25 || R.flashT < 0.12);
    R.bolt.visible = on;
    R.thunderLight.intensity = on ? 18 : 0;
  },
};

// Thunder for the storm (registered here: the level owns the weather).
import { registerSounds } from '../audio.js';
registerSounds({
  thunder(a, t, o) { a.noise(t, 0.25, 0.9, o, 'highpass', 2000, 600); a.noise(t + 0.1, 2.6, 1.0, o, 'lowpass', 500, 50); a.osc('sine', 50, 28, t + 0.1, 2, 0.5, o); },
});
