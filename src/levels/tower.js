import * as THREE from 'three';

// Floor 1: Lobby. The player starts in the lobby facing north (-z) at the red door.
//
//   server room (-52..-24, -44..-21) ──red corridor──► red door ─► LOBBY (-16..16) ─► elevator ─► CEO floor (y 24)
//        ▲                                                            │
//   cubicle floor (-52..-20, -16..24) ◄───────────────────────────────┘
//
// v0.2 encounters: stapler in the cubicle corner office (burnouts answer the pickup), a Compliance Officer guards
// the keycard, the keycard locks the server room down for 3 waves, a Sysadmin takes the CEO's balcony when you
// loop back, and the CEO floor mixes everything.

export default {
  id: 'tower',
  name: 'FLOOR 1: LOBBY',
  par: 240,
  next: 'archives',
  keyAmbush: 'server', // picking up the red keycard calls this group
  build(B) {
    const { PAL } = B;
    // ── PAL.LOBBY ATRIUM (hub): tall, bright, PAL.CEO's glass office hanging overhead ──────────────
    B.room(-16, -16, 16, 16, 0, 22, PAL.LOBBY, { n: [[-2, 2, 4]], w: [[8, 12, 3.5]], e: [[-2, 2, 4]], s: [[10.5, 12, 2]] });
    B.box(-3, 0, -16, 3, 0.02, 16, 0x6a2020, { solid: false }); // red carpet runner to the red door
    B.box(-1.5, 0, -1.5, 1.5, 22, 1.5, 0xb8ae98); // atrium column landmark
    for (const y of [4, 10, 16]) B.box(-1.8, y, -1.8, 1.8, y + 0.4, 1.8, 0x8a7a5a);
    // Red door frame, visible from the spawn so the keycard hints at it.
    for (const [a, b] of [[-2.4, -2], [2, 2.4]]) B.box(a, 0, -15.95, b, 4.4, -15.9, 0xd01010, { solid: false, glow: true });
    B.box(-2.4, 4, -15.95, 2.4, 4.4, -15.9, 0xd01010, { solid: false, glow: true });
    B.door(-2, 0, -16.5, 2, 4, -16, 0x4a4a50, { key: true });
    // Security desk + emergency axe box by the spawn.
    B.box(-8, 0, 4, -2, 1.1, 6, 0x6a5038);
    B.box(-8.2, 1.1, 3.8, -1.8, 1.2, 6.2, 0x3a2a20);
    B.box(-7, 1.2, 4.2, -6.2, 1.7, 4.5, 0x20ff80, { glow: true, solid: false });
    B.box(-1, 1.2, 15.75, 1, 2.4, 16, 0xb01010, { solid: false });
    B.box(-0.8, 1.35, 15.7, 0.8, 2.25, 15.75, 0x101010, { solid: false });
    // Vending machine hiding the air vent (secret 1).
    B.box(9.5, 0, 13.6, 13, 2.6, 15, 0x2050a0);
    B.box(9.8, 0.9, 13.55, 12.7, 2.3, 13.6, 0x80c0ff, { solid: false, glow: true });
    B.hall(10.5, 16.5, 12, 20.5, 0, 2, PAL.VENT, false);
    B.room(9, 21, 13.5, 25, 0, 2.5, PAL.VENT, { n: [[10.5, 12, 2]] });
    B.light(11.25, 2, 23, 0xffaa55, 3, 6);
    B.secret(9, 0, 21, 13.5, 2.5, 25);
    B.pick('espresso', 11.25, 0.5, 23.5);
    // Rocket-jump ledge high on the east wall (secret 2).
    B.box(13, 5.5, 6, 16, 6, 14, 0x9a9080);
    B.secret(13, 6, 6, 16, 9, 14);
    B.pick('kevlar', 14.5, 6.6, 10);
    B.pick('toner', 14.5, 6.5, 8);
    B.pick('toner', 14.5, 6.5, 12);
    // The PAL.CEO's glass office: a promise, hung high from the first second.
    const glass = new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.3, depthWrite: false });
    B.box(-8, 15, -15, 8, 20, -7, 0, { solid: false, material: glass });
    B.box(-8, 14.7, -15, 8, 15, -7, 0x3a2a26);
    // Balcony in front of the glass: the Sysadmin's perch once you loop back (red line from above).
    B.box(-6, 14.7, -7, 6, 15, -5, 0x3a2a26);
    B.box(-6, 15, -5.12, 6, 15.45, -5, 0x303030);
    for (const x of [-6.12, 6]) B.box(x, 15, -7, x + 0.12, 15.45, -5, 0x303030);
    B.box(-8.12, 15, -15, -8, 15.45, -7, 0x303030);
    B.box(8, 15, -15, 8.12, 15.45, -7, 0x303030);
    B.box(-8, 15, -15.12, 8, 15.45, -15, 0x303030);
    for (const x of [-5.5, 5.5]) B.box(x - 0.1, 15, -5.4, x + 0.1, 22, -5.2, 0x303030, { solid: false });
    B.box(-2, 15, -12, 2, 15.9, -11, 0x4a2a18, { solid: false });
    for (const [x, z] of [[-7.8, -14.8], [7.6, -14.8], [-7.8, -7.2], [7.6, -7.2]]) B.box(x, 20, z, x + 0.2, 22, z + 0.2, 0x303030, { solid: false });
    B.light(0, 18, -11, 0xff3020, 8, 12);
    // Plants and benches.
    for (const [x, z] of [[-14, -14], [14, -14], [-14, 14]]) {
      B.box(x - 0.5, 0, z - 0.5, x + 0.5, 0.8, z + 0.5, 0x6a4a30);
      B.box(x - 0.7, 0.8, z - 0.7, x + 0.7, 2.2, z + 0.7, 0x2a6a2a, { solid: false });
    }
    B.box(-14, 0, -4, -12.5, 0.5, 4, 0x5a4030);
    // Corporate dressing: a maroon stripe round the walls, logo over the elevator, directory, water cooler, chairs.
    const STRIPE = 0x7a1a1a, NS = { solid: false };
    for (const [a, b] of [[-16, -2.6], [2.6, 16]]) B.box(a, 3.1, -15.98, b, 3.4, -15.92, STRIPE, NS);
    for (const [a, b] of [[-16, 10.5], [12, 16]]) B.box(a, 3.1, 15.92, b, 3.4, 15.98, STRIPE, NS);
    for (const [a, b] of [[-16, 8], [12, 16]]) B.box(-15.98, 3.1, a, -15.92, 3.4, b, STRIPE, NS);
    for (const [a, b] of [[-16, -2.6], [2.6, 16]]) B.box(15.92, 3.1, a, 15.98, 3.4, b, STRIPE, NS);
    B.box(15.9, 5.6, -4, 15.98, 7.6, 4, ['wood', 0x4a3428], NS);
    B.decal(15.85, 6.6, 0, 'w', 5);
    B.decal(0, 9, -15.9, 's', 12); // big Faktion logo over the red door, the first thing you see
    B.box(15.88, 1.2, 2.6, 15.95, 1.6, 2.9, 0xff3020, { solid: false, glow: true }); // call button
    B.box(-15.98, 1.2, 1.5, -15.9, 2.8, 6, 0x1a1a1a, NS);
    for (let y = 1.45; y < 2.6; y += 0.22) B.box(-15.9, y, 1.8, -15.86, y + 0.06, 5.7 - (y * 7 % 1.5), 0xd8d8c8, { solid: false, glow: true });
    B.box(-15.2, 0, 5.8, -14.7, 1, 6.3, 0xd0d0d0);
    B.box(-15.15, 1, 5.85, -14.75, 1.45, 6.25, 0x4a90d0, NS);
    for (const z of [5.5, 7.2]) {
      B.box(9.4, 0, z - 0.45, 10.4, 0.45, z + 0.45, ['carpet', 0x6a2a2a]);
      B.box(10.2, 0.45, z - 0.45, 10.4, 1.05, z + 0.45, ['carpet', 0x6a2a2a]);
    }
    B.box(-4, 0, 10.5, 4, 0.015, 14, ['carpet', 0x3a3a44], NS);
    B.barrel(8.5, 0, -10.5);
    B.barrel(-11, 0, -9);
    for (const [x, z] of [[-8, -8], [8, 8], [-8, 8], [8, -8]]) {
      B.box(x - 2, 21.9, z - 2, x + 2, 22, z + 2, 0xffffff, { solid: false, glow: true });
      B.light(x, 18, z, 0xfff4e0, 16, 40);
    }
    B.light(0, 5, 11, 0xfff0d0, 8, 20);
    B.pick('shells', -6, 1.5, 5.7);
    B.pick('shells', -3.5, 1.5, 5.7);
    B.pick('coffee', 12, 0.4, 10);
    B.pick('coffee', -12, 0.4, -12);
    B.pick('kevlar', 13, 0.5, -4);
    B.pick('shells', -12, 0.4, 0);
    B.mob('intern', 6, 0, -8);
    B.mob('intern', -8, 0, -10);
    B.mob('intern', 10, 0, 0);
    // Repopulates when you loop back in through the red door.
    B.mob('manager', 8, 0, -12, 'lobby');
    B.mob('manager', -10, 0, 8, 'lobby');
    B.mob('printer', 5, 8, 5, 'lobby');
    B.mob('printer', -6, 10, -6, 'lobby');
    B.mob('sysadmin', 0, 15, -6, 'lobby');
    B.mob('burnout', -18, 0, 9.2, 'lobby'); // burst out of the cubicle hall door
    B.mob('burnout', -18.5, 0, 10.8, 'lobby');
    B.trig(-3, 0, -16, 3, 4, -12, 'ambush', 'lobby', { needKey: true });

    // ── ELEVATOR (red badge) up to the PAL.CEO floor ──────────────────────────────────────────
    const SHAFT = 0x3a3436;
    B.box(15.9, 4.3, -1, 16, 5, 1, 0xff2020, { solid: false, glow: true });
    B.door(16, 0, -2, 16.5, 4, 2, 0x5a5a60, { key: true });
    B.box(16, 0, -2.5, 21, 28.5, -2, SHAFT);
    B.box(16, 0, 2, 21, 28.5, 2.5, SHAFT);
    B.box(20.5, 0, -2, 21, 28.5, 2, SHAFT);
    B.box(16, 28, -2, 20.5, 28.5, 2, SHAFT);
    B.box(16.5, -1, -2, 20.5, -0.4, 2, SHAFT);
    B.box(16, 22, -2, 16.5, 24, 2, SHAFT);
    B.lift(16.5, -0.4, -2, 20.5, 0, 2, ['metal', 0x707070], 24);
    B.light(18.5, 14, 0, 0xff4020, 6, 14);

    // ── CUBICLE FLOOR: cramped, dim maze ──────────────────────────────────────────────────
    B.hall(-19.5, 8, -16.5, 12, 0, 3.5, PAL.CUBES, true);
    B.door(-18.25, 0, 8, -17.75, 3.5, 12, 0x7a6a50);
    B.room(-52, -16, -20, 24, 0, 3.5, PAL.CUBES, { e: [[8, 12, 3.5]], n: [[-40, -36, 3]], w: [[0, 3, 3.5]] });
    B.decal(-51.9, 2.4, 12, 'e', 3.6);
    const PART = ['cubicle', 0x5d6b78];
    for (const z of [-10, -4, 2, 8, 14, 20]) {
      for (const [a, b] of [[z === 20 ? -44.8 : -48, -38], [-35, -24]]) B.box(a, 0, z - 0.08, b, 1.9, z + 0.08, PART);
      for (const x of [-45, -41, -31, -27]) if (!(x === -45 && z === 20)) B.box(x - 0.08, 0, z - 1.4, x + 0.08, 1.9, z + 1.4, PART);
      for (const x of [-43, -29]) {
        const dz = z % 4 === 0 ? 0.55 : -0.55;
        B.box(x - 0.6, 0, z + dz - 0.35, x + 0.6, 0.75, z + dz + 0.35, ['wood', 0x8b6f4e]);
        B.box(x - 0.25, 0.75, z + dz - 0.08, x + 0.25, 1.15, z + dz + 0.08, 0x202428, NS);
        B.box(x - 0.21, 0.8, z + dz + (dz > 0 ? 0.08 : -0.09), x + 0.21, 1.1, z + dz + (dz > 0 ? 0.09 : -0.08), 0x30a0c0, { solid: false, glow: true });
        B.box(x - 0.25, 0, z + dz * 2.3 - 0.25, x + 0.25, 0.5, z + dz * 2.3 + 0.25, 0x2a2a30); // chair
      }
    }
    for (const [x, z, f] of [[-26, 0, false], [-36, 10, true], [-36, -12, false], [-44, 18, true]]) B.light(x, 3.2, z, 0xe0ffe8, 5, 11, f);
    for (const x of [-46, -36, -26]) for (const z of [-12, -2, 8, 18]) B.box(x - 1, 3.45, z - 0.3, x + 1, 3.5, z + 0.3, 0xf0f8ff, { solid: false, glow: true });
    // Office furniture along the walls: filing cabinets, a copier, a water cooler, a whiteboard, posters.
    for (const x of [-40, -38.8, -30, -28.8]) {
      B.box(x, 0, 23.3, x + 1, 1.3, 24, ['metal', 0x8a8a7c]);
      for (const y of [0.42, 0.86]) B.box(x, y, 23.28, x + 1, y + 0.03, 24, 0x2e2e2a, NS);
    }
    B.box(-30, 0, -15.8, -28.6, 1.15, -14.8, ['metal', 0xb0aca0]); // copier
    B.box(-29.9, 1.15, -15.7, -28.7, 1.2, -14.9, 0x30ff60, { solid: false, glow: true });
    B.box(-21.3, 0, 22.6, -20.8, 1, 23.1, 0xd0d0d0);
    B.box(-21.25, 1, 22.65, -20.85, 1.45, 23.05, 0x4a90d0, NS);
    B.box(-20.08, 1, 14, -20.02, 2.2, 18, 0xf0f0f0, NS);
    for (const [y, c] of [[1.9, 0x2040c0], [1.6, 0xc02020], [1.35, 0x208040]]) B.box(-20.1, y, 14.4 + (y * 3 % 1), -20.07, y + 0.05, 16.5 + (y * 5 % 1), c, NS);
    for (const [z, c] of [[-6, 0x2a4a8a], [4, 0x8a5a1a], [-12, 0x5a1a6a]]) B.box(-51.98, 1.4, z, -51.92, 2.6, z + 1.6, c, NS);
    // Corner office (south-west): the Heavy-Duty Stapler on the manager's desk. Taking it calls a burnout pack
    // out of the dark north-west corner; they come straight down the west aisle at you.
    B.box(-45.2, 0, 17, -45, 1.1, 24, ['wood', 0x5a4030]);
    B.box(-45.2, 1.1, 17, -45, 2.6, 24, 0, { material: glass });
    B.box(-45.2, 2.6, 17, -45, 3.5, 24, PAL.CUBES.wall);
    B.box(-48, 0, 16.8, -45, 1.1, 17, ['wood', 0x5a4030]);
    B.box(-48, 1.1, 16.8, -45, 2.6, 17, 0, { material: glass });
    B.box(-52, 2.6, 16.8, -45, 3.5, 17, PAL.CUBES.wall);
    B.box(-50.5, 0, 21, -47.5, 0.8, 22.2, ['wood', 0x6a4a30]);
    B.box(-49.5, 0, 22.6, -48.5, 1.1, 23.5, 0x1a1a20); // executive chair
    B.box(-51.8, 0, 17.3, -51.1, 1.35, 18.3, ['metal', 0x8a8a7c]);
    B.box(-46, 0, 23, -45.4, 0.7, 23.6, 0x6a4a30);
    B.box(-46.2, 0.7, 22.8, -45.2, 1.9, 23.8, 0x2a6a2a, NS);
    B.box(-51.98, 1.3, 19.5, -51.92, 2.4, 21.5, 0x8a6a30, NS); // framed "TEAMWORK" print
    B.box(-51.96, 1.4, 19.6, -51.9, 2.3, 21.4, 0x3a6a8a, NS);
    B.box(-48.5, 0.8, 21.2, -48.35, 1.2, 21.35, 0x2a2a2a, NS);
    B.box(-48.65, 1.15, 21.05, -48.2, 1.3, 21.5, 0xffe0a0, { solid: false, glow: true });
    B.light(-48.5, 2.4, 20.5, 0xffd890, 4, 9);
    B.pick('stapler', -49, 1.2, 21.25);
    B.pick('staples', -50.8, 0.4, 18);
    B.trig(-51, 0, 19.5, -46, 3, 23.5, 'ambush', 'burnA');
    for (const [x, z] of [[-50.5, -15], [-49.5, -14.3], [-50.8, -13.4], [-49.6, -12.5]]) B.mob('burnout', x, 0, z, 'burnA');
    B.barrel(-50.6, 0, 4);
    B.barrel(-31.5, 0, -6.5);
    // The supply closet's wall is a slightly different beige (secret 3).
    B.door(-52.5, 0, 0, -52, 3.5, 3, 0xcdbf9a, { secret: true });
    B.room(-56, -0.5, -52.5, 3.5, 0, 3.5, PAL.VENT, { e: [[-0.5, 3.5, 3.5]] });
    B.secret(-56, 0, -0.5, -52.5, 3.5, 3.5);
    B.pick('shells', -54.5, 0.4, 0.5);
    B.pick('shells', -54.5, 0.4, 2.5);
    B.pick('donut', -55.3, 0.4, 1.5);
    B.light(-54, 3, 1.5, 0xffe0a0, 2, 5);
    B.pick('shells', -22, 0.4, -14);
    B.pick('shells', -50, 0.4, 22);
    B.pick('shells', -36.5, 0.4, 0);
    B.pick('coffee', -29, 0.4, 17);
    B.pick('coffee', -43, 0.4, -6);
    B.pick('coffee', -50, 0.4, -14);
    B.pick('donut', -36.5, 0.4, 11);
    for (const [x, z] of [[-26, 16], [-30, 11], [-47, 5], [-33, 5], [-44, -7], [-36, -13]]) B.mob('intern', x, 0, z);
    for (const [x, z] of [[-36.5, 18], [-46, 11], [-41, -1]]) B.mob('manager', x, 0, z);
    // A sleeping burnout pack in the dark north-east corner, by the copier.
    for (const [x, z] of [[-21, -15], [-23, -15.2], [-21.5, -13.2]]) B.mob('burnout', x, 0, z);
    B.pick('staples', -36.5, 0.4, -14.5);
    B.pick('staples', -24, 0.4, 22);

    // ── PAL.SERVER ROOM: cold blue light, racks, hell bleeding in ─────────────────────────────
    B.hall(-40, -20.5, -36, -16.5, 0, 3, PAL.SERVER, false);
    const southDoor = B.door(-40, 0, -18.75, -36, 3, -18.25, 0x50606a);
    const eastDoor = B.door(-24, 0, -38, -23.5, 4, -34, 0x50606a);
    B.room(-52, -44, -24, -21, 0, 6, PAL.SERVER, { s: [[-40, -36, 3]], e: [[-38, -34, 4]] });
    for (const x of [-48, -44, -32, -28]) {
      B.box(x - 0.5, 0, -40, x + 0.5, 2.6, -25, ['server', 0xc0c8d0]);
      B.box(x - 0.55, 2.6, -40, x + 0.55, 2.7, -25, 0x16191e);
      for (let y = 0.5; y < 2.4; y += 0.9) B.box(x - 0.52, y, -39.5, x + 0.52, y + 0.04, -25.5, y < 1 ? 0x20ff60 : 0x2080ff, { solid: false, glow: true });
      B.box(x - 0.3, 5.4, -44, x + 0.3, 5.55, -21, 0x2a2e34, { solid: false }); // cable tray
    }
    for (const [x0, z0, x1, z1] of [[-40, -21.2, -36, -20.5], [-24.7, -38, -24, -34]]) B.box(x0, 0, z0, x1, 0.012, z1, ['hazard', 0xffffff], { solid: false });
    for (const z of [-30, -36]) B.box(-51.95, 3.4, z - 1, -51.4, 4.4, z + 1, ['metal', 0x8a9098]); // AC units
    B.box(-47, 0, -23.5, -45, 0.9, -22.5, 0x30363e); // launcher table
    B.box(-38.4, 0, -43, -37.6, 0.9, -42, 0x30363e); // keycard pedestal
    for (const [x, z] of [[-46, -32], [-30, -32], [-38, -30]]) B.light(x, 5, z, 0x3070ff, 10, 18);
    B.light(-38, 2, -42, 0xff2020, 4, 6);
    B.flesh(-38, 4, -43.8, 1.6);
    B.flesh(-51.8, 2, -42, 1.2);
    B.flesh(-24.2, 4.5, -36, 1.2);
    B.flesh(-30, 5.8, -40, 1);
    B.pick('launcher', -46, 1.3, -23);
    B.pick('key', -38, 1.3, -42.5);
    B.pick('toner', -30, 0.4, -42);
    B.pick('toner', -50, 0.4, -35);
    B.pick('shells', -36, 0.4, -24);
    B.pick('donut', -26, 0.4, -30);
    B.mob('intern', -46, 0, -30);
    B.mob('intern', -30, 0, -33);
    B.mob('compliance', -38, 0, -37); // guards the keycard: flank down the rack aisles, or use the launcher
    B.mob('manager', -26, 0, -41);
    // Lockdown: taking the keycard seals both doors and runs three waves (the first is the keycard ambush).
    B.arena(-40, 0, -44, -36, 3, -40.6, ['server', 'server2', 'server3'], [southDoor, eastDoor]);
    B.mob('brute', -50, 0, -42, 'server');
    B.mob('brute', -26, 0, -23, 'server');
    B.mob('burnout', -50, 0, -24, 'server');
    B.mob('burnout', -25, 0, -43, 'server');
    B.mob('printer', -44, 4, -42, 'server2');
    B.mob('printer', -32, 4, -42, 'server2');
    B.mob('compliance', -38, 0, -24, 'server2');
    B.mob('intern', -50, 0, -30, 'server2');
    B.mob('brute', -38, 0, -26, 'server3');
    B.mob('manager', -50, 0, -40, 'server3');
    B.mob('manager', -26, 0, -38, 'server3');
    B.mob('burnout', -46, 0, -24, 'server3');
    B.barrel(-50.5, 0, -37);
    B.barrel(-25.5, 0, -27);
    B.light(-38, 5.5, -32, 0xff2020, 4, 20, true);
    B.pick('staples', -42, 0.4, -24);
    B.pick('coffee', -30, 0.4, -43.5);
    B.pick('coffee', -46, 0.4, -43.5);

    // ── RED CORRIDOR back to the lobby (the loop) ─────────────────────────────────────────
    B.box(-23.5, -0.5, -38, 2, 0, -34, PAL.HELL.floor);
    B.box(-23.5, 4, -38, 2, 4.5, -34, PAL.HELL.ceil);
    B.box(-23.5, 0, -38.5, 2.5, 4, -38, PAL.HELL.wall);
    B.box(-23.5, 0, -34, -2, 4, -33.5, PAL.HELL.wall);
    B.box(2, 0, -38, 2.5, 4, -16.5, PAL.HELL.wall);
    B.box(-2, -0.5, -34, 2, 0, -16.5, PAL.HELL.floor);
    B.box(-2, 4, -34, 2, 4.5, -16.5, PAL.HELL.ceil);
    B.box(-2.5, 0, -33.5, -2, 4, -16.5, PAL.HELL.wall);
    B.light(-12, 3.5, -36, 0xff3020, 5, 14);
    B.light(0, 3.5, -26, 0xff3020, 5, 14);
    B.flesh(-16, 3.8, -37.8, 1.2);
    B.flesh(1.8, 2, -30, 1);
    B.flesh(-6, 0.2, -34.2, 1);
    B.pick('shells', -20, 0.4, -36);
    B.pick('toner', -6, 0.4, -36);
    B.pick('coffee', 0, 0.4, -25);
    B.pick('coffee', 0, 0.4, -22);
    B.mob('intern', -15, 0, -36);
    B.mob('intern', 0, 0, -30);
    B.mob('brute', -8, 0, -36);
    B.mob('burnout', -1, 0, -37);
    B.mob('burnout', 1, 0, -36);
    B.barrel(1.4, 0, -37.5);
    B.pick('staples', -10, 0.4, -36);

    // ── PAL.CEO FLOOR: open arena, everything at once, exit behind the desk ──────────────────
    B.room(-16, -16, 16, 16, 24, 32, PAL.CEO, { e: [[-2, 2, 4]], n: [[-2, 2, 4]] });
    B.box(-5, 24, -11, 5, 25.1, -9, 0x4a2a18); // PAL.CEO desk landmark
    B.box(-0.6, 24, -13, 0.6, 25.8, -12.2, 0x1a1010);
    for (const [x, z] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) B.box(x - 1, 24, z - 1, x + 1, 32, z + 1, 0x8a7a6a);
    B.box(-13, 24, 3, -11, 25.2, 5, 0x5a4030);
    B.box(11, 24, -4, 13, 25.2, -2, 0x5a4030);
    B.box(3, 24, 11, 5, 25.2, 13, 0x5a4030);
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) B.light(x, 30, z, 0xff5030, 18, 30);
    B.light(0, 29, -12, 0xffd0a0, 10, 16);
    B.flesh(-15.8, 28, -10, 2);
    B.flesh(15.8, 29, 9, 2);
    B.flesh(0, 31.8, 0, 2.5);
    B.flesh(-9, 31.5, 7, 1.5);
    B.flesh(-6, 24, -15.6, 1.5);
    B.door(-2, 24, -16.5, 2, 28, -16, 0x30a040);
    B.hall(-2, -20, 2, -16.5, 24, 4, PAL.CEO, false);
    B.box(-2.5, 24, -20.5, 2.5, 28, -20, PAL.CEO.wall);
    B.box(-1.2, 28.3, -15.95, 1.2, 28.9, -15.9, 0x20ff40, { solid: false, glow: true });
    B.light(0, 27, -18, 0x40ff60, 4, 6);
    B.exit(-2, 24, -20, 2, 28, -17.5);
    B.pick('shells', -14, 24.4, -14);
    B.pick('shells', 14, 24.4, 14);
    B.pick('toner', -14, 24.4, 14);
    B.pick('toner', 14, 24.4, -14);
    B.pick('donut', -12, 24.4, 0);
    B.pick('donut', 12, 24.4, 6);
    // Dais wings either side of the exit: the Sysadmin's post, a step up (jumpable) and an open middle.
    for (const [a, b] of [[-10, -4], [4, 10]]) {
      B.box(a, 24, -16, b, 25.2, -13, ['wood', 0x4a3830]);
      B.box(a, 25.05, -13.04, b, 25.2, -12.98, 0xc09030, { solid: false, glow: true });
    }
    B.mob('sysadmin', -7, 25.2, -14.5);
    // Dressing: bookcases, the CEO's portrait, a night skyline, a bar cart.
    for (const z of [-6, 2]) {
      B.box(-16, 24, z, -15.4, 27, z + 3, ['wood', 0x3a2a20]);
      for (let y = 24.6; y < 27; y += 0.6) B.box(-15.42, y, z + 0.1, -15.38, y + 0.35, z + 2.9, [0x6a2020, 0x204a2a, 0x2a2a5a][Math.round(y * 10) % 3], { solid: false });
    }
    B.box(-7, 26, -15.98, -3.5, 29.5, -15.9, 0xa08030, { solid: false });
    B.box(-6.7, 26.3, -15.9, -3.8, 29.2, -15.86, 0x2a1a18, { solid: false });
    B.box(-5.7, 27.6, -15.86, -4.8, 28.6, -15.84, 0xc8a080, { solid: false });
    B.box(-5.6, 26.4, -15.86, -4.9, 27.6, -15.84, 0x101010, { solid: false });
    B.box(-5.35, 26.6, -15.86, -5.15, 27.5, -15.82, 0xffc020, { solid: false, glow: true }); // golden tie
    B.box(15.94, 25.5, 4, 15.98, 30.5, 14, 0x0a1020, { solid: false });
    for (let i = 0; i < 18; i++) B.box(15.9, 25.8 + B.rnd() * 4.4, 4.2 + B.rnd() * 9.4, 15.94, 26 + B.rnd() * 4.4, 4.4 + B.rnd() * 9.4, 0xffd070, { solid: false, glow: true });
    B.box(11, 24, 6, 12, 25, 7, ['metal', 0xb0a080]);
    for (const [x, z] of [[-12, -12], [12, -12]]) B.mob('intern', x, 24, z);
    for (const [x, z] of [[-6, 10], [6, 10]]) B.mob('manager', x, 24, z);
    B.mob('compliance', 0, 24, -6.5);
    for (const [x, z] of [[-12, 12], [-13, 10], [-11, 13.5]]) B.mob('burnout', x, 24, z);
    B.barrel(-10.5, 24, 9);
    B.barrel(11, 24, -10.5);
    B.pick('staples', -14, 24.4, 0);
    B.pick('staples', 14, 24.4, -2);
    B.mob('brute', -10, 24, 0);
    B.mob('brute', 12, 24, 10);
    B.mob('printer', 0, 28, 4);
    B.mob('printer', -4, 29, -4);


    return { spawn: { pos: new THREE.Vector3(-7, 0, 13), yaw: Math.atan2(-7, 29) } };
  },
};

