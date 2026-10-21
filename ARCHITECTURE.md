# OVERTIME — Architecture & contracts (v0.2)

Three.js 0.186 + Vite 5, no assets (all geometry, textures and sound are procedural). `npm run dev` → http://localhost:5173. `npm test` runs the style-meter tests.

## File map (owner per file)
| File | Owner | What |
|---|---|---|
| `src/main.js` | core | renderer, pixel post-pass, input, state machine, save, dev harness |
| `src/world.js` | core | the game object, update loop, combat (`damageEnemy`, `blast`, `hurtPlayer`), stagger/termination, projectiles, pickups, doors, lifts, triggers, arenas |
| `src/level.js` | core | level builder `B` + area palettes `PAL`; merges static geometry per material |
| `src/physics.js` | core | AABB movement, raycasts (`RAY_NORMAL` = normal of last `raycast` hit; `clip` solids are skipped by raycasts) |
| `src/projectiles.js` | core | projectile kind table + `registerProjectiles` (no imports, so type modules can register at load time) |
| `src/player.js` | core | player object, movement, dash, `loadoutOf` |
| `src/style.js` (+test) | core | style meter, grading |
| `src/weapons.js` | weapons | weapon table, firing, viewmodels, weapon sounds |
| `src/enemies/index.js` | enemies | registry, generic AI, `spawnEnemy/updateEnemy/wake/revive` |
| `src/enemies/staff.js` | enemies | all regular enemy types + the `drum` prop |
| `src/enemies/ceo.js` | boss | the CEO boss type |
| `src/levels/index.js` | core | level registry |
| `src/levels/tower.js`, `archives.js` | levels | Floor 1, Sub-basement |
| `src/levels/overtime.js` | levels | endless arena + wave director |
| `src/levels/rooftop.js` | boss | boss level |
| `src/textures.js` | art | procedural textures, world-space surface material |
| `src/fx.js` | art | particles, gibs, decals, beams |
| `src/hud.js`, `src/hud.css`, `index.html` | hud | HUD, screens, menus |
| `src/audio.js` | hud | synth engine, music, shared SFX |

Shared-file changes go through the orchestrator: report them, don't make them.

## Conventions
Metres, y up, player eye 1.55 m, run 12 m/s. Enemy models face +z with origin at the feet; `yaw = atan2(dx, dz)`. Bodies `{pos (feet), r, h, box}`. Colours: hostile projectiles glow warm orange or violet; **red lines are reserved for Sysadmin tells**; telegraph rings are red; the player's laser is red-white. No per-frame allocations in hot loops where avoidable.

## The game object `g` (world.js `createWorld`)
`scene, audio, hud, level (module), levelId, time, solids[], doors[], lifts[], triggers[], arenas[], enemies[], pickups[], projectiles[], fx, style, rank, score, hitstop, stats {kills,total,secrets,secretsTotal,time}, player, shake, exited, boss (enemy|null), god`.

Player `p`: `pos, vel, yaw, pitch, onGround, health, armor, dead, hasKey, owned{id:bool}, ammo{shells,staples,toner,cells}, weapon, cooldown, switchT, kick, flash, swing, pumpT, charge (laser 0..1), dashCharges, dashRecharge, dashT, lastDash, iframes`.

## world.js exports
- `hitscan(g, o, d, maxT, ignore?) → {t, enemy, normal}`; `losClear(g, a, b)`; `wakeNear(g, pos, r)`
- `damageEnemy(g, e, dmg, src, weapon?, opts?)` — src `'player'` or an enemy/prop. opts `{from, explosive, pierce, painMul, knock}`. Applies rank multiplier, `def.onDamage`, stagger, pain, kill.
- `hurtPlayer(g, dmg, fromPos)` (respects i-frames and `g.god`)
- `blast(g, pos, radius, dmg, owner, {color, selfScale, knock, weapon, noStyle})` — explosion FX + damage + shove; `noStyle` kills earn no style/score (burnout suicides)
- `spawnProjectile(g, kind, pos, vel, owner) → pr`; `registerProjectiles` (import it from `projectiles.js`) `({kind: {dmg, splash, gravity, radius, parts:[[w,h,d,color,glow]], trail?, update?(g,pr,dt), onHit?(g,pr,body) → true to consume}})`
- `addEnemy(g, type, x, y, z, group?) → e` (counts toward kill total unless a prop; sets `g.boss`)
- `addPickup(g, kind, x, y, z)`; `ambush(g, group) → count`
Pickup kinds: `coffee donut espresso mint kevlar shard pack shells staples toner cells key` + any weapon id (`ssg stapler launcher laser`).

## Level modules (`src/levels/*.js`)
```js
export default {
  id, name, par /*s*/, next /*level id|null*/, keyAmbush? /*group called on keycard pickup*/,
  loadout? /*{owned:[ids], ammo:{…}} used when started from the title*/,
  build(B) { …; return { spawn: { pos: Vector3, yaw } }; },
  start?(g), update?(g, dt), onTrigger?(g, name) /*for B.trig(…,'script',name)*/,
};
```
Builder `B`: `box(x0,y0,z0,x1,y1,z1, color | [texKey, color], {solid, glow, material, dynamic, clip})` (`clip`: invisible movement-only wall), `stairs(x0,z0,x1,z1,y0,y1, up 'n'|'s'|'w'|'e', color)` (solid steps + a smooth walk slope; physics has no step-up), `wallRun`, `room(x0,z0,x1,z1,y0,y1, palette, {n,s,w,e: [[from,to,height]]})`, `hall`, `door(...) → door` (`{key, secret}`), `lift(x0,y0,z0,x1,y1,z1,color,targetY)`, `light(x,y,z,color,intensity,dist,flickers)` (keep ≤ ~30 lights/level), `flesh(x,y,z,s)`, `trig(..., kind, arg, {needKey})` kinds `ambush|exit|script`, `secret(box)`, `exit(box)`, `pick(kind,x,y,z)`, `mob(type,x,y,z,group?)`, `barrel(x,y,z)`, `arena(box, [groups…], [doors…])`, `rnd()` (seeded), `PAL`, `T`.
Palettes: `PAL.LOBBY CUBES SERVER HELL CEO VENT ARCHIVE GARAGE ROOF` each `{floor, wall, ceil}`.
Texture keys: `grain carpet tile ceiling wallpaper wood planks concrete slab metal plate grate flesh brick asphalt cubicle` (tinted by the colour) and `server shelf hazard` (real colour: tint white/pale). Some keys swap to a different texture on top faces (concrete→slab, metal→plate, wood→planks).

## Enemy types (`TYPES[type]`)
```js
{ hp, speed, r, h, range, keep, cd:[min,max], tell, pain, blood, body,
  fly?, hover?, prop?, boss?, name? (boss bar), strafes? (false = never strafes), chargeSpeed?,
  build() → { root: Group, mats: [materials that flash], legs: [pivots], arms: [pivots], ...extras },
  attack(g, e, tgt, dist),                 // called when the tell ends (e.cd already re-rolled)
  startTell?(g, e, tgt, dist) → seconds,   // pick the wind-up; 0 = don't attack now
  think?(g, e, dt, tgt, dist) → true,      // take over the whole AI this frame (sync is still done)
  onDamage?(g, e, dmg, src, weapon, opts) → dmg, // shields, armor
  onDeath?(g, e, src, opts), onChargeHit?(g, e, tgt), animate?(g, e, dt) }
```
Enemy fields: `pos, yaw, vy, hp, state ('sleep'|'chase'), target, cd, tellT, painT, chargeT, chargeDir, staggerT, staggered, flash, los, dead, gibbed, active, group, deadT` + model extras. Sound names played by the core: `sight_<type> tell_<type> pain_<type> die_<type>`; register custom ones with `registerSounds`.
Stagger is core: when `staggerT > 0` the generic AI freezes the enemy and flickers it orange; type code must not override that.

## FX (`g.fx`, fx.js) — calls used by other modules
`burst(pos, color, n, speed, size, life)`, `gibs(pos, colors)`, `explosion(pos, radius, color)`, `tracer(a, b, color)`, `decal(pos, normal{x,y,z}, kind 'hole'|'blood'|'scorch', size?)`, `splat(pos, color, solids)` (blood on nearby floor/wall), `beam(a, b, charge)` (laser), `dash(player)`. Callers use `?.` for the last four.

## HUD (`g.hud`, hud.js) — calls used by other modules
`msg(text, dur)`, `bonus(labels)`, `hurt(angle, dmg)`, `grin()`, `pickupFlash()`, `rankUp(name)`, `update(g, dt)`, `screen(kind, g, info)`, optional `hitMarker(kill)`, `terminate()`, `banner(text)`, `intro(levelName)`. `onAction(action, arg)` is set by main.js. HUD reads `g.boss` for the boss bar and `p.dashCharges` for dash pips.

## Audio
`audio.play(name, pos?, delay?)`; `registerSounds({name(a, t, out) {…}})` with `a.osc(type, f0, f1, t, dur, vol, out)` and `a.noise(t, dur, vol, out, filterType, f0, f1, q)`. `audio.setRank(r)`; boss music hook: `audio.setBoss(on)` (hud/audio owner implements; boss calls it).

## Dev harness (dev server only)
- `http://localhost:5173/?level=<id>&god=1` skips the title.
- `window.overtime.snap({level, x, y, z, yaw, pitch, seconds, god=true, hud=false, wake, weapon, fresh, freeze=true})` starts/reuses a level, places the player, simulates synchronously, renders one frame and (by default) freezes the loop; `overtime.unfreeze()` resumes. `window.overtime.game` is the live `g`.
- `window.overtime.runSim({level='overtime', maxT})` runs a combat bot (aim nearest visible enemy, strafe, dash, swap weapons, axe staggered enemies) synchronously → `{wave, time, score, kills, dead, peak}`. Not a level walker. Use n ≥ 8 per comparison.
- The Browser pane only composites the fronted tab: `tabs_select` your tab before screenshots; background tabs don't advance `requestAnimationFrame`.
- Save data lives in `localStorage['overtime.save']`; remove it after testing.
