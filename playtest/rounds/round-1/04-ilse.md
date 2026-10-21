# Ilse — comfort & readability · playtest round 1
**Verdict (in character).** The look is cohesive and the saturated orange/pink/violet projectiles genuinely pop against the murky palette, but at density the screen turns to mush: far enemies are 20-30 px specks, big opaque FX blobs (purple ink, black smoke/dark slab, orange blast column) can fill a third of the frame, and the only distinguishing "red" cues (sysadmin tell, red rings) are tiny and dither-eaten. Performance is a non-issue. Fun: 7/10 · Would play again tomorrow: maybe · Domain score: 5.5/10

## Session log
| Run | Skill / tactics | Result | Killed by | Note |
|---|---|---|---|---|
| 1 | average, default (floor) | wave 2 @0:20, 6988 pts (stopped by me) | - | early sim cost sample |
| 2 | average [jumped] w15, 20 s | hp 100 -> 4 in 20 s | Sysadmin snipe 50, printer ink 25, Burnout blast 17 | peak density, 25 enemies alive |
| 3 | average [jumped] w15, 1.5 s chunks | hp 100 at catch | - | Sysadmin + 2 Recruiters + Burnout alive, tells shot |
| 4 | average [jumped] w10, 20 s + chunks | wave 11, hp 100, armor 100, 82k pts | - | deck + explosion shots |
No natural-progression runs; difficulty not my domain.

## Highlights (keep)
- Enemy projectiles are the most readable thing on screen: saturated orange ball/column, yellow orbs, magenta rim stay distinct from the olive/navy/brown scene even through dither. [seen] (shots: `ilse-w10-decknorth.png`, `ilse-w15-b.png`)
- Silhouettes/head details (red eyes, pink horns, white coat) read on near enemies; hazard-stripe deck edge gives great spatial anchoring when looking at decks. [seen]
- Window/night-sky strip and light fixtures give landmarks; palette feels intentional. [seen] (`ilse-w15-tells.png`)
- Performance headroom huge. [data]

## Pain points (ranked)
1. **Opaque FX/projectile blobs occlude the view** — in `ilse-w15-b.png` a flat purple mass covers ~35% of the frame (ink blob close to camera), in `ilse-w10-decknorth.png` an orange column covers ~20% (fully opaque, no alpha/dither), in `ilse-w10-boom.png` a flat near-black slab fills ~55% of the screen (smoke/debris or pillar-adjacent FX; unclear what it is). At wave 10-15 this is exactly when you must find the next threat. [seen] · major
2. **Distant threats are specks** — Sysadmin on the far deck is ~25 px tall in a 1500 px frame; its tell (a couple of red/white pixels) is ~5 px. I could not find it in under a second without knowing where to look. [seen] (`ilse-w15-tells.png`) · major
3. **Sniper damage with no legible warning** — wave 15 chunk: Sysadmin shots dealt 50 of ~95 damage taken in 20 s while hp went 100 -> 4. At peak density the tell competes with ink, fire and bodies. [data]+[seen] · major
4. **Red-dependence for colour-blind players** — red telegraph rings, sysadmin red line tell, red eyes, red rank bars and blood decals (dark red blobs on floor, `ilse-w15-b.png`) share a hue family; red-green deuteranopes lose ring vs blood vs brown-olive floor separation. Floor/wall are olive/brown, so red-on-olive is near-isoluminant. [inferred] · major
5. **Dark-on-dark enemies** — dark-clothed enemies (Sysadmin in dark suit) against shadowed deck backs/pillars nearly vanish; dither at 200 px adds noise to small silhouettes. [seen] · minor
6. **Hit-stop/shake/flash unverifiable** — frozen frames; the huge flat colour fills (orange, purple, black) suggest full-frame luminance jumps when they cover the lens; flash-comfort risk. [inferred] · minor

## Bugs & oddities
- `PT.look('enemy')` repeatedly lands on a pillar/wall or at the floor (shots `w10-boom`, `w15-b`), so the nearest-threat pointing may be to a target behind cover; may also be harness. [seen]
- Weapon viewmodel shows previous weapon (known harness caveat).
- `PT.ui()` shows "CLOCKING IN…" and "TERMINATED" lines alongside live HUD (harness artefact).

## Recommendations
| # | Change | Why | Expected effect | Effort |
|---|---|---|---|---|
| 1 | Make large near-camera FX/projectiles translucent (dither-fade by distance to camera, cap screen coverage) | PP1 | no more blind frames at peak | S-M |
| 2 | Bigger, shape-coded sysadmin tell (glow billboard/ground laser with min screen size, plus a directional HUD edge-indicator for off-screen/distant snipers) | PP2, PP3 | find sniper in <1 s | M |
| 3 | Shape/brightness-coded telegraphs (ring pattern: dashed/pulsing + lighter value, not hue only); add a colour-blind option swapping red for cyan/white | PP4 | accessible telegraphs | S |
| 4 | Min-size/outline or rim-light on enemies beyond ~15 m, especially dark ones | PP5 | distant targets pop | M |
| 5 | Cap explosion flash/shake and offer a "reduce flash/shake" toggle | PP6 | comfort | S |
| 6 | Make decals (blood) lower contrast/darker so red threats are the only bright red | PP4 | cleaner signal | S |

## Domain deep-dive
- **Threats in under a second?** Close and mid-range: yes (white coats, red eyes, bright projectiles). Far deck, tell, snipers: no (specks). Peak density wave 15: only if the sightline is clear; three of my four peak shots were mostly occluded by FX. [seen]
- **Projectiles/telegraphs vs dark palette + dither?** Projectiles: strong. Telegraph rings/red tells: weak; I could not make out a ring in any shot, and the Recruiter ring was never clearly visible (looked at 2 Recruiters alive, not distinguishable). [seen]
- **Red-green colour-blind loss?** Red rings, red tell line, red rank bars and red blood decals collapse into brown/olive; projectile hues (orange, magenta, yellow, violet) survive via luminance and saturation. Rank bars/ring need non-hue cues. [inferred]
- **HUD legibility?** Only `PT.ui()` text checked (no HUD pixels in shots): the style-bonus stack (+VARIETY +MULTI-KILL ...) stacks 5+ lines at once; I can't judge size/contrast. [read]
- **Flash/shake risk?** Cannot measure motion; large flat-colour screen fills (orange/purple/black) and hit-stop on gib suggest risk; offer a toggle. [inferred]
- **Performance headroom?** Sim: 20 s of play = 123 ms early (wave 2, few enemies), 225 ms at wave 15 with ~25 enemies (121 ms at wave 10): ~0.6-1.1 % of real time, headroom ample. Render: 10x `overtime.render()` = 39.8 ms total, ~4 ms/frame at wave 15 (headless tab, so GPU-bound cost may differ), well within 16.7 ms. [data]

## Harness caveats
Screenshots are single frames, no HUD, no motion: shake/flash/hit-stop unjudged. The bot's `look('enemy')` often points at cover. Jumped waves give ammo/armor/weapons not earned; density findings are valid, difficulty ones are not. Render timing in a possibly backgrounded tab.

## Findings (machine-readable)
```json
[
{"area":"readability","type":"issue","severity":"major","finding":"Large opaque FX/projectile masses cover 20-55% of the screen at wave 10-15","evidence":"ilse-w15-b.png, ilse-w10-decknorth.png, ilse-w10-boom.png","recommendation":"Dither-fade or cap screen coverage of near-camera FX"},
{"area":"readability","type":"issue","severity":"major","finding":"Distant Sysadmin and its tell are a few pixels; hard to locate at peak density","evidence":"ilse-w15-tells.png; wave 15 sysadmin snipes dealt 50 of ~95 damage in 20 s","recommendation":"Larger tell, min screen size, directional off-screen indicator"},
{"area":"ui","type":"issue","severity":"major","finding":"Red telegraphs, red tell, red rank bars and red blood share a hue family on olive/brown floors; poor for red-green colour blindness","evidence":"ilse-w15-b.png (blood decals)","recommendation":"Shape/value coding, colour-blind mode, lower decal contrast"},
{"area":"visuals","type":"praise","severity":"polish","finding":"Saturated emissive enemy projectiles read well against the dark dithered palette","evidence":"ilse-w10-decknorth.png","recommendation":"Keep"},
{"area":"visuals","type":"issue","severity":"minor","finding":"Dark enemies on shadowed decks/pillars nearly vanish at distance","evidence":"ilse-w15-tells.png","recommendation":"Rim light or outline beyond ~15 m"},
{"area":"feel","type":"idea","severity":"minor","finding":"Full-screen flat colour fills and hit-stop imply flash/shake comfort risk with no visible toggle","evidence":"inferred from screenshots","recommendation":"Add reduce flash/shake option"},
{"area":"performance","type":"praise","severity":"polish","finding":"Sim 123 ms/20 s early, 225 ms/20 s at wave 15; render ~4 ms/frame","evidence":"performance.now around PT.play and overtime.render x10","recommendation":"No action"}
]
```
