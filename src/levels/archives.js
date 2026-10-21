import * as THREE from 'three';
import { ambush } from '../world.js';

// SUB-BASEMENT: ARCHIVES. The elevator lets you out on a landing whose glass wall overlooks the parking garage
// (exit elevator glowing green at its far end: the landmark you reach last).
//
//   records ◄─corridor─┐                       GARAGE (y -6, arena, 3 waves) ── exit lift
//     │                │                             ▲ ramp
//   passage        STACKS maze ◄── west hall ── LANDING (spawn) ── red door
//     │                                              ▲ one-way drop (with the key)
//   BOILER (y -4, flooded) ── stairs up ── maintenance corridor (y 2)

// ── dressing helpers ─────────────────────────────────────────────────────────────────
const NS = { solid: false };
function paper(B, x0, z0, x1, z1, y, n) {
  for (let i = 0; i < n; i++) {
    const x = x0 + B.rnd() * (x1 - x0), z = z0 + B.rnd() * (z1 - z0), w = B.rnd() < 0.5;
    B.box(x - (w ? 0.17 : 0.12), y, z - (w ? 0.12 : 0.17), x + (w ? 0.17 : 0.12), y + 0.012, z + (w ? 0.12 : 0.17), 0xe6e0cc, NS);
  }
}
const crate = (B, x, y, z, s = 0.5) => B.box(x - s / 2, y, z - s / 2, x + s / 2, y + s * 0.8, z + s / 2, ['grain', 0x9a7a50]);
function cabinet(B, x0, z0, x1, z1) {
  B.box(x0, 0, z0, x1, 1.35, z1, ['metal', 0x8a8a7c]);
  for (const y of [0.45, 0.9]) B.box(x0, y, z0 - 0.02, x1, y + 0.03, z1 + 0.02, 0x2e2e2a, NS);
}
function car(B, x, y, z, alongX, color) {
  const [hx, hz] = alongX ? [2.1, 0.95] : [0.95, 2.1], [cx, cz] = alongX ? [1.1, 0.8] : [0.8, 1.1];
  B.box(x - hx, y + 0.25, z - hz, x + hx, y + 1.0, z + hz, ['metal', color]);
  B.box(x - cx, y + 1.0, z - cz, x + cx, y + 1.55, z + cz, 0x1a222a);
  for (const s of [-1, 1]) {
    const lx = alongX ? x + s * hx : x - 0.6, lz = alongX ? z - 0.6 : z + s * hz;
    B.box(lx - 0.05, y + 0.6, lz - 0.05, lx + 0.05 + (alongX ? 0 : 1.2), y + 0.8, lz + 0.05 + (alongX ? 1.2 : 0), s > 0 ? 0xfff0c0 : 0xa01010, { solid: false, glow: true });
  }
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(x + ox * hx * 0.7 - 0.2, y, z + oz * hz * 0.9 - 0.2, x + ox * hx * 0.7 + 0.2, y + 0.45, z + oz * hz * 0.9 + 0.2, 0x151515, NS);
}

let booth = null, garage = null;

export default {
  id: 'archives',
  name: 'SUB-BASEMENT: ARCHIVES',
  par: 300,
  next: 'rooftop',
  keyAmbush: 'bkey',
  loadout: { owned: ['axe', 'shotgun', 'stapler', 'launcher'], ammo: { shells: 30, staples: 80, toner: 6 } },
  build(B) {
    const { PAL } = B;
    const glass = new THREE.MeshLambertMaterial({ color: 0x9ac0d0, transparent: true, opacity: 0.08, depthWrite: false });
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const water = new THREE.MeshLambertMaterial({ color: 0x1c3a30, transparent: true, opacity: 0.62, depthWrite: false });
    const CAB = { floor: ['plate', 0x5a5a58], wall: ['metal', 0x6a655c], ceil: ['metal', 0x4a4844] };
    const LAND = { floor: ['tile', 0x6a6458], wall: ['concrete', 0x77716a], ceil: ['ceiling', 0x6e6a62] };
    const STACK = { floor: ['slab', 0x4e4a44], wall: ['concrete', 0x5e5a52], ceil: ['concrete', 0x34322e] };
    const REC = { floor: ['carpet', 0x3a4438], wall: ['wallpaper', 0x8e8a70], ceil: ['ceiling', 0x7a776a] };
    const BOIL = { floor: ['slab', 0x3a3430], wall: ['brick', 0x6a3c30], ceil: ['concrete', 0x2c2826] };
    const GAR = { floor: ['asphalt', 0x50504c], wall: ['concrete', 0x6a6a64], ceil: ['slab', 0x3c3c3a] };
    const MAINT = PAL.VENT, PLATE = ['plate', 0x6a6a64], GRATE = ['grate', 0x707068], RAIL = 0x4a4a4c, HAZ = ['hazard', 0xffffff];

    // ── ELEVATOR CAB (spawn): you rode it down; the doors part onto the landing ─────────────────
    B.box(-2.5, -0.5, -23.5, 2.5, 0, -19, CAB.floor);
    B.box(-2.5, 3.2, -23.5, 2.5, 3.7, -19, CAB.ceil);
    B.box(-2.5, 0, -23.5, -2, 3.2, -19, CAB.wall);
    B.box(2, 0, -23.5, 2.5, 3.2, -19, CAB.wall);
    B.box(-2, 0, -19.5, 2, 3.2, -19, CAB.wall);
    for (const x of [-2, 1.92]) B.box(x, 0.95, -23, x + 0.08, 1.02, -19.6, 0x9a9a90, NS);
    B.box(-0.6, 2.7, -19.56, 0.6, 3.05, -19.5, 0x101010, NS);
    B.box(-0.3, 2.78, -19.58, 0.3, 2.97, -19.56, 0xff5020, { solid: false, glow: true }); // "B3"
    B.light(0, 3, -21.5, 0xfff0c0, 3, 6);
    B.door(-2, 0, -24, 2, 3.2, -23.5, ['metal', 0x8a8a84]);

    // ── LANDING (hub): glass wall over the garage, west to the stacks, red door east ───────────
    B.box(-10.5, -0.5, -40.5, 10.5, 0, -23.5, LAND.floor);
    B.box(-10.5, 5, -40.5, 10.5, 5.5, -23.5, LAND.ceil);
    B.wallRun(false, -10.5, -10, -40, -24, 0, 5, [[-36, -32, 3.5]], LAND.wall);
    B.wallRun(false, 10, 10.5, -40, -24, 0, 5, [[-34, -30, 3.5]], LAND.wall);
    B.wallRun(true, -24, -23.5, -10.5, 10.5, 0, 2, [[-2, 2, 2]], LAND.wall);
    B.wallRun(true, -24, -23.5, -10.5, 10.5, 2, 5, [[-9, -5, 3], [-2, 2, 1.2]], LAND.wall);
    B.box(-10, 0, -40.5, 10, 1, -40.05, LAND.wall); // parapet
    B.box(-10, 1, -40.35, 10, 4, -40.25, 0, { material: glass }); // armoured glass: see the garage, can't shoot or drop in
    B.box(-10.5, 4, -40.5, 10.5, 5, -40, LAND.wall);
    B.box(-10, 0.95, -40.55, 10, 1.08, -40, 0x5a5a5c, NS);
    for (let x = -9.5; x <= 9.5; x += 1.9) B.box(x - 0.04, 1, -40.4, x + 0.04, 4, -40.2, 0x2a2a2c, NS);
    // One-way ledge: the maintenance corridor drops you back in here (2 m: too tall to climb back).
    B.box(-9, 0, -26, -5, 2, -24, LAND.wall);
    B.box(-9, 1.82, -26.03, -5, 2, -25.98, HAZ, NS);
    // Signs: ARCHIVES (green, west), P2 PARKING (red, over the keycard door).
    B.box(-9.97, 3.6, -36.2, -9.92, 4.25, -31.8, 0x18301c, NS);
    B.box(-9.95, 3.8, -35.6, -9.9, 4.05, -32.4, 0xc8e8c0, { solid: false, glow: true });
    B.box(9.92, 3.6, -34.2, 9.97, 4.25, -29.8, 0x301010, NS);
    B.box(9.9, 3.8, -33.4, 9.95, 4.05, -30.6, 0xff4020, { solid: false, glow: true });
    B.box(8.6, 0, -34, 10, 0.012, -30, HAZ, NS);
    B.box(4, 0, -28, 8, 1.05, -26.8, ['wood', 0x5a4636]); // security desk
    B.box(5, 1.05, -27.6, 5.6, 1.45, -27.2, 0x202428, NS);
    B.box(5.05, 1.1, -27.62, 5.55, 1.4, -27.6, 0x40c060, { solid: false, glow: true });
    B.box(-8.5, 0, -38, -5.5, 0.45, -37.2, ['wood', 0x5a4636]);
    B.box(6, 0, -38.5, 7.5, 1, -37.5, ['metal', 0x5a6a7a]); // mail cart
    B.box(-2, 4.97, -35, 2, 5, -31, 0xf0f4e8, { solid: false, glow: true });
    B.light(0, 4.6, -33, 0xdce4cc, 8, 22);
    paper(B, -9.5, -39.5, 9.5, -26.5, 0, 22);
    B.mob('intern', -6, 0, -36);
    B.mob('intern', 6, 0, -36.5);
    B.pick('shells', -7, 0.85, -37.6);
    B.pick('coffee', 7, 0.4, -25.5);
    // Repopulated when you drop back in with the keycard.
    B.trig(-10, 0, -30, 10, 3, -24, 'ambush', 'landing', { needKey: true });
    B.mob('manager', -6, 0, -38, 'landing');
    B.mob('manager', 7, 0, -36, 'landing');
    B.mob('printer', 0, 3, -33, 'landing');
    B.mob('burnout', -13, 0, -34, 'landing');
    B.pick('donut', -7, 0.4, -28.5);

    // ── STACKS: dark concrete maze of 4.6 m shelving, flickering lights, paper everywhere ──────
    B.hall(-15.5, -36, -10.5, -32, 0, 3.5, STACK, true);
    B.room(-56, -56, -16, -12, 0, 7, STACK, { e: [[-36, -32, 3.5]], n: [[-44, -40, 3.5]], w: [[-30, -27, 3]] });
    const SHELF = [['shelf', 0xffffff], ['shelf', 0xdcdcd4], ['shelf', 0xf0e2cc]];
    const shelf = (c, z0, z1, k) => {
      B.box(c - 0.6, 0, z0, c + 0.6, 4.6, z1, SHELF[k % 3]);
      for (const z of [z0, z1 - 0.06]) B.box(c - 0.66, 0, z, c + 0.66, 4.7, z + 0.06, 0x2e2e30, NS);
      if (B.rnd() < 0.6) crate(B, c - 0.2 + B.rnd() * 0.4, 4.6, z0 + 0.5 + B.rnd() * (z1 - z0 - 1), 0.6);
    };
    const COLS = [
      [-20, [[-37, -31], [-23, -20]]], [-24, [[-48, -45], [-30, -27]]], [-28, [[-41, -38], [-21, -18]]],
      [-32, [[-50, -47], [-38, -28]]], [-36, [[-38, -28], [-22, -19]]], [-40, [[-45, -42], [-27, -24]]],
      [-44, [[-36, -33], [-21, -18]]], [-48, [[-48, -45], [-30, -26]]], [-52, [[-41, -38], [-24, -21]]],
    ];
    let k = 0;
    for (const [c, gaps] of COLS) {
      let z = -53;
      for (const [g0, g1] of [...gaps, [-15, -15]]) {
        if (g0 > z) shelf(c, z, g0, k++);
        z = g1;
      }
    }
    // Shelves line the west wall; one of them, a warmer colour with a paper trail, is a door (secret 1).
    B.box(-56, 0, -53, -55.4, 4.6, -30, SHELF[1]);
    B.box(-56, 0, -27, -55.4, 4.6, -15, SHELF[1]);
    B.door(-56.5, 0, -30, -55.4, 3, -27, ['shelf', 0xffc890], { secret: true });
    B.box(-56, 3, -30, -55.4, 4.6, -27, SHELF[1]);
    for (let i = 0; i < 9; i++) B.box(-55.2 + i * 0.05, 0, -28.9 + B.rnd() * 0.8 - 0.4 + i * 0.02, -54.9 + i * 0.05, 0.012, -28.6 + B.rnd() * 0.8 - 0.4, 0xf0ead8, NS);
    B.room(-62, -32, -56.5, -25, 0, 3, MAINT, { e: [[-30, -27, 3]] });
    B.secret(-62, 0, -32, -56.5, 3, -25);
    B.box(-61.8, 0, -31.8, -60, 0.5, -29.6, ['grain', 0x5a6a4a]); // the archivist's cot
    B.light(-59, 2.6, -28.5, 0xffd080, 3, 7);
    B.pick('kevlar', -59, 0.5, -30.5);
    B.pick('toner', -61, 0.4, -26);
    B.pick('shells', -58, 0.4, -26);
    // Sysadmin perch: a maintenance catwalk riding on the shelf tops, out of reach (rocket-jump it).
    B.box(-55, 4.75, -51.5, -21, 5, -49.5, GRATE);
    B.box(-55, 5, -51.62, -21, 5.45, -51.5, RAIL);
    B.box(-55, 5, -49.5, -21, 5.45, -49.38, RAIL);
    B.box(-55.12, 5, -51.5, -55, 5.45, -49.5, RAIL);
    B.box(-21, 5, -51.5, -20.88, 5.45, -49.5, RAIL);
    for (const x of [-50, -38, -26]) for (const z of [-51.6, -49.4]) B.box(x - 0.03, 5.45, z - 0.03, x + 0.03, 7, z + 0.03, 0x2a2a2a, NS);
    B.mob('sysadmin', -30, 5, -50.5);
    // Reading clearing: a warm pool of light in the dark, the Severance Package on the desk.
    B.box(-36, 0, -34, -32, 0.85, -32.4, ['wood', 0x5a4030]);
    B.box(-35.2, 0.85, -33.4, -35.05, 1.25, -33.25, 0x2a2a2a, NS);
    B.box(-35.4, 1.2, -33.6, -34.85, 1.33, -33.05, 0x30a050, { solid: false, glow: true });
    B.box(-35, 0, -31.7, -34.4, 0.5, -31.1, 0x3a2a20);
    B.box(-33.6, 0, -35.3, -33, 0.5, -34.7, 0x3a2a20);
    B.box(-38.8, 0, -29, -37.4, 1.4, -28.4, ['wood', 0x6a4a30]); // card catalogue
    B.pick('ssg', -32.6, 1.15, -33.2);
    B.light(-34, 5.6, -33, 0xffd8a0, 9, 16);
    B.box(-35, 6.95, -34, -33, 7, -32, 0xfff0d0, { solid: false, glow: true });
    // Grab it and burnouts skitter in from the dark aisles, north and south: kill them before they arrive.
    B.trig(-35.5, 0, -35, -31.5, 3, -31.5, 'ambush', 'burnA');
    for (const [x, z] of [[-38, -52], [-38, -50.5], [-34, -16], [-34, -14]]) B.mob('burnout', x, 0, z, 'burnA');
    B.barrel(-38, 0, -45.6);
    B.mob('intern', -30, 0, -30);
    B.mob('intern', -37.5, 0, -36.5);
    B.mob('manager', -31, 0, -36.5);
    B.mob('intern', -18, 0, -26);
    B.mob('manager', -46, 0, -38);
    // Heading for the north exit: a pack runs at you down the north wall aisle.
    B.trig(-45, 0, -56, -39, 3, -52, 'ambush', 'burnB');
    for (const [x, z] of [[-19, -54.5], [-21, -55], [-23, -54]]) B.mob('burnout', x, 0, z, 'burnB');
    B.barrel(-26, 0, -54.6);
    B.barrel(-18, 0, -14);
    for (const [x, z, f] of [[-26, -42, true], [-46, -20, true], [-48, -46, false]]) {
      B.light(x, 6.4, z, 0xb0c0a0, f ? 5 : 3, 14, f);
      B.box(x - 0.8, 6.95, z - 0.25, x + 0.8, 7, z + 0.25, 0xe0f0e0, { solid: false, glow: true });
    }
    B.light(-18, 3, -34, 0xc8c0a0, 4, 10);
    B.pick('shells', -17.5, 0.4, -14.5);
    B.pick('staples', -54, 0.4, -40);
    B.pick('coffee', -30, 0.4, -54.5);
    B.pick('coffee', -46, 0.4, -14);
    B.pick('donut', -30.5, 0.4, -29);
    B.pick('toner', -26, 0.4, -24.5);
    paper(B, -55, -55.5, -17, -12.5, 0, 150);
    for (const [x, z] of [[-54.5, -14], [-17, -50], [-42, -13.5], [-54, -55], [-30, -15]]) crate(B, x, 0, z, 0.7);

    // ── RECORDS: corridor with a Compliance Officer (no room to flank: splash it, or the drum) ──
    B.hall(-44, -66, -40, -56.5, 0, 3.5, REC, false);
    B.mob('compliance', -42, 0, -62);
    B.barrel(-43.2, 0, -64.6);
    B.room(-56, -80, -28, -66.5, 0, 4, REC, { s: [[-44, -40, 3.5]], w: [[-76, -72, 3.5]] });
    for (const z of [-70, -73.5, -77]) for (const [a, b] of [[-52, -46], [-38, -32]]) cabinet(B, a, z - 0.35, b, z + 0.35);
    B.box(-31, 0, -80, -30.2, 1.1, -71, ['wood', 0x5a4636]); // records counter
    B.box(-30.65, 1.1, -80, -30.55, 2.4, -71, 0, { solid: false, material: glass });
    for (const z of [-78, -74]) {
      B.box(-29.5, 0, z - 0.6, -28.2, 0.8, z + 0.6, ['wood', 0x5a4636]);
      B.box(-29.2, 0.8, z - 0.25, -28.7, 1.25, z + 0.25, 0x202428, NS);
      B.box(-29.22, 0.85, z - 0.2, -29.2, 1.2, z + 0.2, 0x40c060, { solid: false, glow: true });
    }
    B.box(-55, 0, -69, -53.8, 0.8, -67, ['wood', 0x5a4636]); // microfiche readers
    for (const z of [-68.6, -67.6]) {
      B.box(-54.9, 0.8, z - 0.3, -54.3, 1.4, z + 0.3, 0x2a2a2a, NS);
      B.box(-54.3, 0.9, z - 0.22, -54.28, 1.3, z + 0.22, 0x80b0ff, { solid: false, glow: true });
    }
    B.box(-44, 3.3, -66.55, -40, 3.85, -66.5, 0x18301c, NS);
    B.box(-43.5, 3.45, -66.58, -40.5, 3.7, -66.55, 0xc8e8c0, { solid: false, glow: true });
    for (const [x, z, f] of [[-48, -73, true], [-35, -75, false]]) {
      B.light(x, 3.7, z, 0xe0f0d8, 6, 16, f);
      B.box(x - 1, 3.97, z - 0.3, x + 1, 4, z + 0.3, 0xf0f8ff, { solid: false, glow: true });
    }
    B.mob('intern', -50, 0, -68);
    B.mob('intern', -36, 0, -79);
    B.mob('manager', -48, 0, -78.8);
    B.mob('brute', -42, 0, -75);
    B.barrel(-51.5, 0, -67.5);
    B.pick('shells', -54.5, 0.4, -79);
    B.pick('staples', -30.6, 1.5, -76);
    B.pick('coffee', -29, 0.4, -79.2);
    B.pick('donut', -55, 0.4, -73);
    paper(B, -55, -79.5, -31.5, -67, 0, 50);

    // ── PASSAGE to the boiler room: a long corridor and a second officer ───────────────────
    B.hall(-71.5, -76, -56.5, -72, 0, 3.5, STACK, true);
    B.room(-76, -76, -72, -72, 0, 3.5, STACK, { e: [[-76, -72, 3.5]], s: [[-76, -72, 3.5]] });
    B.hall(-76, -71.5, -72, -50.5, 0, 3.5, STACK, false);
    B.mob('compliance', -74, 0, -56);
    B.light(-74, 3, -64, 0xc8c0a0, 3, 10);
    paper(B, -75.5, -75.5, -57, -51, 0, 20);

    // ── BOILER ROOM: flooded, hell bleeding through the south wall, snipers on a gantry ─────────
    B.box(-88.5, -4.5, -50.5, -63.5, -4, -5.5, BOIL.floor);
    B.box(-88.5, 5, -50.5, -63.5, 5.5, -5.5, BOIL.ceil);
    B.wallRun(true, -50.5, -50, -88.5, -63.5, -4, 0, [[-80, -77, 2]], BOIL.wall);
    B.wallRun(true, -50.5, -50, -88.5, -63.5, 0, 5, [[-76, -72, 3.5]], BOIL.wall);
    B.wallRun(true, -6, -5.5, -88.5, -63.5, -4, 5, [], BOIL.wall);
    B.wallRun(false, -88.5, -88, -50, -6, -4, 5, [], BOIL.wall);
    B.wallRun(false, -64, -63.5, -50, -6, -4, 2, [], BOIL.wall);
    B.wallRun(false, -64, -63.5, -50, -6, 2, 5, [[-11, -7.5, 3]], BOIL.wall);
    B.box(-88, -3.42, -50, -64, -3.4, -6, 0, { solid: false, material: water });
    // North catwalk (entry, y 0) and the stairs down into the water.
    B.box(-88, -0.3, -50, -64, 0, -46, GRATE);
    // Railing: thin bars you can see the water through, an invisible collider keeps you on the walkway.
    for (const [x0, x1] of [[-82, -64], [-88, -86]]) {
      B.box(x0, 0, -46.12, x1, 1, -45.96, 0, { material: hidden });
      for (const y of [0.45, 0.95]) B.box(x0, y, -46.1, x1, y + 0.06, -45.98, RAIL, NS);
      for (let x = x0; x <= x1; x += 2) B.box(x, 0, -46.1, x + 0.06, 1, -45.98, RAIL, NS);
    }
    for (const x of [-80, -72, -66]) B.box(x - 0.15, -4, -46.3, x + 0.15, -0.3, -46, 0x3a3a3c);
    B.stairs(-86, -46, -82, -38, -4, 0, 'n', PLATE);
    // Gantry across the room: a sysadmin, unreachable. Its red line sweeps the water.
    B.box(-88, 3, -29, -64, 3.25, -27, GRATE);
    B.box(-88, 3.25, -29.12, -64, 3.75, -29, RAIL);
    B.box(-88, 3.25, -27, -64, 3.75, -26.88, RAIL);
    for (const x of [-84, -76, -68]) for (const z of [-29.1, -26.9]) B.box(x - 0.03, 3.75, z - 0.03, x + 0.03, 5, z + 0.03, 0x2a2a2a, NS);
    B.mob('sysadmin', -76, 3.25, -28); // one: two crossing red lines over open water was a death trap
    // Boilers, fireboxes glowing.
    const boiler = (x0, z0, x1, z1, doorX) => {
      B.box(x0, -4, z0, x1, 1.5, z1, ['metal', 0x5a3a30]);
      B.box(x0 + 0.5, 1.5, z0 + 0.5, x1 - 0.5, 2.3, z1 - 0.5, ['metal', 0x4a3028]);
      B.box((x0 + x1) / 2 - 0.4, 2.3, (z0 + z1) / 2 - 0.4, (x0 + x1) / 2 + 0.4, 5, (z0 + z1) / 2 + 0.4, 0x3a3a3a);
      for (const y of [-2.5, -0.5, 1]) B.box(x0 - 0.05, y, z0 - 0.05, x1 + 0.05, y + 0.12, z1 + 0.05, 0x2a2420, NS);
      B.box(doorX - 0.06, -3, (z0 + z1) / 2 - 1, doorX + 0.06, -1.6, (z0 + z1) / 2 + 1, 0xff6018, { solid: false, glow: true });
    };
    boiler(-86, -35, -80, -29, -80);
    boiler(-73, -40, -67, -34, -73);
    boiler(-85, -22, -80, -16, -80);
    B.box(-88, 1.4, -50, -87.4, 1.8, -6, 0x5a4a3a, NS);
    B.box(-64.6, 3.8, -50, -64, 4.2, -6, 0x5a4a3a, NS);
    B.light(-76.5, -1.5, -35, 0xff5020, 6, 14);
    B.light(-79, -1, -19, 0xff5020, 4, 10);
    B.light(-76, 4.5, -47, 0xc8d0b8, 5, 16, true);
    // The keycard on a dais in the hell bleed at the south end.
    B.box(-80, -4, -14, -72, -2.8, -8, ['concrete', 0x5a3a34]);
    B.box(-78, -3, -5.6, -74, 1, -5.5, 0xff2010, { solid: false, glow: true });
    B.flesh(-80, -2.8, -14, 1.6);
    B.flesh(-72.5, -2.6, -8.5, 1.4);
    B.flesh(-76, 1.5, -5.8, 2.2);
    B.flesh(-82, -1, -5.8, 1.6);
    B.flesh(-88, 0, -20, 1.8);
    B.flesh(-64, 3.6, -36, 1.4);
    B.pick('key', -76, -1.6, -11);
    B.light(-76, 0, -11, 0xff2010, 9, 16);
    // Water level: the Recruiter turns up once there are bodies to re-hire (see update).
    B.trig(-88, -4, -46, -64, -2, -6, 'script', 'boiler');
    B.mob('intern', -77, -4, -44);
    B.mob('intern', -76, -4, -20);
    B.mob('manager', -78, -4, -30);
    B.mob('manager', -84, -4, -26);
    B.mob('recruiter', -76, -4, -17, 'recruit');
    // Keycard ambush: a brute out of the hell bleed, burnouts from under the catwalk, a printer.
    B.mob('brute', -86, -4, -9, 'bkey');
    for (const x of [-80, -74, -68]) B.mob('burnout', x, -4, -48, 'bkey');
    B.mob('printer', -76, 0, -24, 'bkey');
    B.barrel(-71, -4, -46.8);
    B.barrel(-84, -4, -12.5);
    B.pick('shells', -66, 0.4, -48);
    B.pick('coffee', -87, -3.6, -30);
    B.pick('donut', -65, -3.6, -42);
    B.pick('staples', -82, -3.6, -11);
    B.pick('toner', -65, -3.6, -34);
    // Secret 2: a glow under the north catwalk, a crawl into a flooded alcove.
    B.room(-81, -56, -76, -50.5, -4, -2, BOIL, { s: [[-80, -77, 2]] });
    B.secret(-81, -4, -56, -76, -2, -50.5);
    B.pick('espresso', -78.5, -3.6, -54.5);
    B.light(-78.5, -2.4, -53.5, 0xffc060, 2.5, 6);
    // Out: stairs up to a platform and the maintenance corridor.
    B.stairs(-70, -30, -66, -14, -4, 2, 's', PLATE);
    B.box(-72, -4, -14, -64, 2, -6, ['concrete', 0x5a5650]);
    B.box(-72, 1.82, -14.03, -64, 2, -13.98, HAZ, NS);
    B.pick('shells', -66, 2.4, -8);
    B.pick('coffee', -70, 2.4, -7);

    // ── MAINTENANCE CORRIDOR (y 2) back to the landing ───────────────────────────────────
    B.hall(-63.5, -11, -9, -7.5, 2, 3, MAINT, true);
    B.box(-9, 1.5, -23.5, -5, 2, -7.5, MAINT.floor);
    B.box(-9.5, 5, -23.5, -4.5, 5.5, -7, MAINT.ceil);
    B.box(-5, 2, -23.5, -4.5, 5, -7, MAINT.wall);
    B.box(-9, 2, -7.5, -4.5, 5, -7, MAINT.wall);
    B.box(-9.5, 2, -23.5, -9, 5, -11, MAINT.wall);
    B.box(-63.5, 4.4, -10.8, -9, 4.7, -10.5, 0x6a5040, NS);
    B.box(-63.5, 4.4, -10.3, -9, 4.6, -10.1, 0x3a5a6a, NS);
    B.mob('compliance', -30, 2, -9.25);
    B.barrel(-27.5, 2, -10.4);
    B.mob('intern', -14, 2, -9.3);
    B.light(-36, 4.6, -9.25, 0xd0d8c0, 4, 12, true);
    B.light(-7, 4.6, -16, 0xff3020, 3, 9);
    B.pick('shells', -50, 2.4, -9.25);
    B.pick('coffee', -7, 2.4, -20);

    // ── RAMP down to P2 behind the red door ────────────────────────────────────────────
    B.door(10, 0, -34, 10.5, 3.5, -30, ['metal', 0x5a5a60], { key: true });
    B.box(10.5, -0.5, -34, 12, 0, -30, GAR.floor);
    B.stairs(12, -34, 28, -30, -6, 0, 'w', GAR.floor);
    B.box(28, -6.5, -40.5, 36, -6, -30, GAR.floor);
    B.box(10.5, -6, -34.5, 29.5, 4, -34, GAR.wall);
    B.box(10.5, -6, -30, 36.5, 4, -29.5, GAR.wall);
    B.box(36, -6, -40, 36.5, 4, -29.5, GAR.wall);
    B.box(29.5, -6, -40, 30, 4, -34, GAR.wall);
    B.box(10.5, 4, -40.5, 36.5, 4.5, -29.5, GAR.ceil);
    B.box(12, 2.2, -34.03, 28, 2.5, -33.98, HAZ, NS);
    B.light(20, 2, -32, 0xffb060, 4, 14);
    B.pick('shells', 32, -5.6, -32);
    B.pick('toner', 34, -5.6, -36);
    B.pick('coffee', 31.5, -5.6, -37);
    const gDoor = B.door(30, -6, -40.5, 36, -2, -40, ['metal', 0x6a6a60]);

    // ── GARAGE (P2): lockdown, 3 waves; laser booth and exit lift open when it's clear ─────────
    B.box(-24.5, -6.5, -80.5, 36.5, -6, -40, GAR.floor);
    B.box(-24.5, 4, -80.5, 36.5, 4.5, -40.5, GAR.ceil);
    B.wallRun(true, -40.5, -40, -24.5, 36.5, -6, 0, [[30, 36, 4]], GAR.wall);
    B.wallRun(true, -40.5, -40, -24.5, 36.5, 0, 4, [[-10, 10, 4]], GAR.wall);
    B.wallRun(true, -80.5, -80, -24.5, 36.5, -6, -2, [], GAR.wall);
    B.wallRun(true, -80.5, -80, -24.5, 36.5, -2, 4, [[0, 6, 3.5]], GAR.wall);
    for (const [y0, y1, gaps] of [[-6, -4.5, [[-62, -60, 1.5]]], [-4.5, -3, [[-63.5, -58.5, 1.5]]], [-3, 0.2, []], [0.2, 2.2, [[-79, -76, 2]]], [2.2, 4, []]]) {
      B.wallRun(false, -24.5, -24, -80, -40.5, y0, y1, gaps, GAR.wall);
    }
    B.wallRun(false, 36, 36.5, -80, -40.5, -6, 4, [], GAR.wall);
    // Upper deck along the north wall, stairs at both ends.
    B.box(-24, -6, -80, 36, -2, -72, ['concrete', 0x625e58]);
    B.box(-24, -2.3, -72.03, 36, -2, -71.99, HAZ, NS);
    B.box(-19, -2, -72.2, 31, -1.1, -72, 0x6a6a64);
    B.stairs(-24, -72, -19, -62, -6, -2, 'n', ['concrete', 0x625e58]);
    B.stairs(31, -72, 36, -62, -6, -2, 'n', ['concrete', 0x625e58]);
    // Exit freight lift: the green light you saw from the landing.
    B.box(-0.5, -6, -86.5, 0, 12, -80.5, GAR.wall);
    B.box(6, -6, -86.5, 6.5, 12, -80.5, GAR.wall);
    B.box(-0.5, -6, -86.5, 6.5, 12, -86, GAR.wall);
    B.box(-0.5, 12, -86.5, 6.5, 12.5, -80.5, GAR.wall);
    B.box(0, -6, -86, 6, -2.5, -80.5, GAR.wall);
    B.box(-0.5, 4, -80.5, 6.5, 12, -80, GAR.wall);
    B.lift(0, -2.5, -86, 6, -2, -80.5, ['plate', 0x6a6a60], 6);
    const exitDoor = B.door(0, -2, -80.5, 6, 1.5, -80, ['metal', 0x2a6a3a]);
    B.box(1.5, 2.1, -79.98, 4.5, 3, -79.9, 0x20ff40, { solid: false, glow: true });
    for (const x of [-0.3, 6.1]) B.box(x, -2, -79.98, x + 0.2, 1.7, -79.9, 0x20ff40, { solid: false, glow: true });
    B.light(3, 1, -83, 0x40ff60, 6, 12);
    B.exit(0, 6, -86, 6, 9, -80.5);
    // Laser booth: a red-lit security booth behind glass, locked until the garage is clear.
    B.room(-30, -64, -24.5, -58, -6, -3, { floor: ['tile', 0x5a5a58], wall: ['concrete', 0x5a5650], ceil: ['metal', 0x3a3a3a] }, { e: [[-64.5, -57.5, 3]] });
    booth = B.door(-24.5, -6, -62, -24, -3, -60, ['metal', 0x6a2a2a]);
    for (const [a, b] of [[-63.5, -62], [-60, -58.5]]) B.box(-24.4, -4.5, a, -24.1, -3, b, 0, { material: glass });
    B.box(-28, -6, -62, -26, -5.1, -60, ['metal', 0x4a4a4c]);
    B.pick('laser', -26.5, -4.7, -61);
    B.pick('cells', -29, -5.6, -59);
    B.pick('cells', -29, -5.6, -63);
    B.light(-27.5, -3.6, -61, 0xff3030, 4, 7);
    // Secret 3: van + crate on the deck, a lit duct high in the west wall.
    B.box(-23.6, -2, -79.6, -21.2, -0.8, -75, ['metal', 0x8a8a90]);
    B.box(-23.65, -1.5, -78.8, -21.15, -1.0, -77.6, 0x203040, NS);
    crate(B, -20.8, -2, -74.6, 0.75);
    B.room(-30, -79, -24.5, -76, 0.2, 2.2, MAINT, { e: [[-79, -76, 2]] });
    B.secret(-30, 0.2, -79, -24.5, 2.2, -76);
    B.pick('cells', -28, 0.6, -78);
    B.pick('cells', -26.5, 0.6, -78);
    B.pick('toner', -29, 0.6, -77);
    B.pick('donut', -27.5, 0.6, -77);
    B.light(-27, 1.9, -77.5, 0xffd060, 2.5, 6);
    // Pillars, parking lines, cars; the burning wreck is the room's landmark.
    for (const x of [-12, 0, 12, 24]) for (const z of [-66, -54]) {
      B.box(x - 0.6, -6, z - 0.6, x + 0.6, 4, z + 0.6, ['concrete', 0x7a766e]);
      B.box(x - 0.62, -6, z - 0.62, x + 0.62, -5, z + 0.62, HAZ, NS);
    }
    for (let x = -22; x <= 28; x += 2.8) B.box(x - 0.06, -6, -47.5, x + 0.06, -5.99, -41, 0xd8d8c8, NS);
    for (let z = -70; z <= -44; z += 2.8) B.box(27, -6, z - 0.06, 35.8, -5.99, z + 0.06, 0xd8d8c8, NS);
    car(B, -18, -6, -45, false, 0x6a2020);
    car(B, -14, -6, -45, false, 0x204a6a);
    car(B, 18, -6, -45.5, false, 0x4a4a40);
    car(B, 24, -6, -46, false, 0x5a5a6a);
    car(B, 31, -6, -58, true, 0x2a5a3a);
    car(B, 6, -6, -60, true, 0x1a1a1a);
    B.flesh(6, -4.4, -60, 1.8);
    B.flesh(-24, 2, -50, 2);
    B.flesh(36, 0, -70, 2);
    B.flesh(10, 4, -64, 1.6);
    for (const [x, z] of [[-6, -50], [14, -62], [-16, -58]]) B.box(x - 1, -6, z - 0.7, x + 1, -5.99, z + 0.7, 0x141414, NS); // oil stains
    B.light(6, -3.5, -60, 0xff6020, 12, 18, true);
    for (const [x, z] of [[5, -60.5], [7, -59.6], [6.4, -60.2]]) B.box(x - 0.3, -4.5, z - 0.3, x + 0.3, -3.6 + B.rnd() * 0.6, z + 0.3, 0xff8020, { solid: false, glow: true });
    B.light(-12, 3.4, -50, 0xffb060, 11, 26);
    B.light(18, 3.4, -56, 0xffb060, 11, 26);
    B.light(6, 3.4, -75, 0xffb060, 9, 22);
    for (const [x, z] of [[-12, -50], [18, -56], [6, -75]]) B.box(x - 1, 3.97, z - 0.2, x + 1, 4, z + 0.2, 0xffe0a0, { solid: false, glow: true });
    B.arena(-24, -6, -80, 36, 2, -41, ['g1', 'g2', 'g3'], [gDoor, exitDoor, booth]);
    garage = B.L.arenas[B.L.arenas.length - 1];
    // Wave 1: the floor staff. Wave 2: shields on the floor, snipers on the deck. Wave 3: the Recruiter and its re-hires.
    // Burnouts spawn under the deck, far from the entry side where you tend to stand, so their portal is the tell.
    for (const [t, x, y, z] of [['intern', -18, -6, -56], ['intern', 14, -6, -68], ['intern', 0, -6, -48], ['manager', -6, -6, -69], ['burnout', 22, -6, -62], ['burnout', -16, -6, -66]]) B.mob(t, x, y, z, 'g1');
    for (const [t, x, y, z] of [['sysadmin', -10, -2, -77], ['sysadmin', 22, -2, -77], ['compliance', -18, -6, -50], ['compliance', 10, -6, -50], ['brute', -4, -6, -70]]) B.mob(t, x, y, z, 'g2');
    for (const [t, x, y, z] of [['recruiter', -2, -2, -76], ['brute', 26, -6, -70], ['printer', -10, 0, -52], ['printer', 16, 0, -60], ['intern', -20, -6, -44], ['burnout', 18, -6, -70], ['burnout', -8, -6, -70]]) B.mob(t, x, y, z, 'g3');
    B.barrel(-16, -6, -48.5);
    B.barrel(26, -6, -60);
    B.barrel(2, -6, -64.5);
    B.barrel(-6, -2, -75);
    B.pick('shells', -22, -5.6, -42);
    B.pick('shells', 34, -1.6, -78);
    B.pick('staples', -22, -5.6, -60);
    B.pick('toner', 12, -5.6, -62);
    B.pick('toner', -6, -1.6, -78);
    B.pick('coffee', -12, -5.6, -60);
    B.pick('coffee', 24, -5.6, -52);
    B.pick('donut', 34, -5.6, -50);
    B.pick('kevlar', 14, -1.5, -77);
    paper(B, -23, -79, 35, -41, -6, 30);

    return { spawn: { pos: new THREE.Vector3(0, 0, -21.3), yaw: 0 } };
  },

  start(g) {
    const res = g.enemies.filter((e) => !e.group && !e.def.prop && e.pos.y < -2 && e.pos.x < -63 && e.pos.z > -50);
    g.arch = { booth, garage, res, t: 0, inBoiler: false, recruited: false };
  },

  update(g, dt) {
    const s = g.arch;
    if (s.garage.state !== 'done') s.booth.locked = true;
    if (s.inBoiler && !s.recruited) {
      s.t += dt;
      if (s.res.filter((e) => e.dead).length >= 2 || s.t > 14) {
        s.recruited = true;
        ambush(g, 'recruit');
        g.hud.msg('A RECRUITER! IT RE-HIRES THE DEAD. KILL IT FIRST, OR GIB THE BODIES', 4);
      }
    }
  },

  onTrigger(g, name) {
    if (name === 'boiler') g.arch.inBoiler = true;
  },
};
