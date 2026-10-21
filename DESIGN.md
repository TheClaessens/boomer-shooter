# OVERTIME — Design v0.2 (LOCKED)

Supersedes `SPEC.md` (v0.1, kept for history). Reasoning in `design/PASSES.md`. Tune numbers later with the sim harness; implement as written.

## Pillars (unchanged)
Speed is the core verb · every weapon one job, every enemy one lesson · levels loop and hide secrets · health from pickups and style, never regen · feedback sells every hit · aggression keeps you alive.

## Modes
| Mode | Content |
|---|---|
| Campaign | 3 levels: `tower` (Floor 1: Lobby) → `archives` (Sub-basement) → `rooftop` (Board Meeting, boss). Carry weapons/ammo/health/armor to the next level. R restarts the current level from its start snapshot. |
| OVERTIME (endless) | `overtime` arena. Waves escalate forever; score is the goal. Starts with axe + shotgun + stapler; launcher at wave 3, double barrel at wave 5, laser at wave 7 (dropped as pickups). Health/ammo pickups respawn between waves. |

Title screen: pick any unlocked level or OVERTIME. Unlocks + best scores in `localStorage['overtime.save']` (`{unlocked: ['tower',…], best: {tower: 12345, …}}`).

## Player
| Stat | Value |
|---|---|
| Run / accel / air | unchanged (12 m/s, Quake air control) |
| Health / armor | 100 (Espresso to 200) / 0–100, armor absorbs ⅓ |
| **Dash** (Shift) | 2 charges, 1.1 s recharge each (sequential), 22 m/s horizontal impulse in wish dir (forward if none), vertical vel clamped ≥ 0, 0.15 s i-frames |
| Rank damage mult | ×(1 + 0.06·rank) on all player damage |

## Weapons
| Slot | Id | Name | Job | Numbers | Ammo (start/max/pickup) |
|---|---|---|---|---|---|
| 1 | axe | Fire Axe | Finisher, ammo | 60 dmg, 0.5 s, 2.4 m reach. Any axe kill drops an ammo pack. Kill on a staggered enemy = **Termination** | — |
| 2 | shotgun | Pump Shotgun | All-rounder | 7 × 12, 0.95 s, spread 0.14×0.09; pellets within 3 m deal ×1.5 | shells 24/50/8 |
| 3 | ssg | Severance Package | Point-blank burst | 16 × 11, 2 shells, 1.5 s, spread 0.24×0.12, knockback enemies 6 m/s | shells |
| 4 | stapler | Heavy-Duty Stapler | Sustained DPS, stunlock | 11/s, 9 dmg hitscan, spread 0.035, pain chance ×1.5 | staples 0/200/40 |
| 5 | launcher | Toner Launcher | Crowds, rocket jump | unchanged (100 dmg, 4 m splash, self ×0.35) | toner 0/20/4 |
| 6 | laser | Presentation Laser | Charged piercing precision | hold to charge 0.8 s; release: 35 + 115·charge dmg, pierces all enemies and shields, 1 cell, 0.5 s | cells 0/30/5 |

Keys 1–6, wheel cycles owned weapons. Empty weapon → auto-switch to best owned with ammo.

**Where found:** tower: axe+shotgun at start, stapler in the cubicle floor, launcher in the server room. archives: ssg early, laser mid (behind arena). rooftop: all carried (default loadout if started from title: everything, half ammo).

## Risk / reward
| Mechanic | Rule |
|---|---|
| Stagger | Non-boss enemy left at ≤ 25 % hp by a non-lethal hit (and hp ≤ 60) staggers for 2.0 s: freezes, orange flicker. Once per enemy. |
| **Termination** | Axe kill on a staggered enemy: +20 health (cap 100, or keep if above), ammo pack, 0.5 s i-frames, 0.12 s hit-stop, style bonus TERMINATED (+60). |
| Axe ammo pack | Any axe kill: +4 shells, +20 staples (if owned), +1 toner (if owned), +2 cells (if owned). |
| Burnout blast | Burnouts always explode on death: 50 dmg, 3.5 m, hurts everything (player too). |
| Gib denies revive | Gibbed corpses can't be revived by Recruiters. |
| Toner drums | Explosive props: 30 hp, 90 dmg 4 m blast, chain-react. Kills by drum count as infight style (SYNERGY). |
| Style drops | unchanged (MANAGER+: mint, VP+: armor shard) |
| Score | each kill: style gain × 10 × (1 + rank). Shown live; best per level saved. |

Style meter additions: bonus `TERMINATED` +60 (replaces HANDS-ON when it applies), `DASH KILL` +15 if killed within 0.4 s of a dash.

## Enemies
| Type | Name | hp | Speed | Role / behaviour | Forces you to |
|---|---|---|---|---|---|
| intern | Possessed Intern | 20 | 4.5 | unchanged hitscan pistol | keep moving |
| manager | Middle Manager | 50 | 3.8 | unchanged stapler fireball | strafe |
| brute | Mailroom Brute | 160 | 4.2 | unchanged charge + punch | back off / funnel |
| printer | Floating Printer | 110 | 3.2 | unchanged ink blob | look up |
| burnout | Burnout | 15 | 9.0 | low skittering kamikaze; within 1.8 m: 0.45 s hiss tell then explodes (50 dmg, 3.5 m); always explodes on death; a suicide blast earns no style | kill at range / use as a bomb |
| compliance | Compliance Officer | 90 | 3.4 | turns ≤ 1.6 rad/s; frontal shield (120° cone) blocks bullets and projectiles (sparks + ping); splash, laser and flanks hurt; an axe hit on the shield drops it for 1.5 s. Attacks: thrown clipboard (fast, 10 dmg) at range, shield bash (20 dmg + knockback) close | flank, splash, laser, axe |
| sysadmin | Sysadmin | 40 | 3.0 | sniper, keeps 18–25 m, prefers high ground; 1.0 s visible red laser tell that tracks you, then 25 dmg hitscan (cd 2.7–3.7 s); breaking line of sight cancels the shot | break LOS, watch for red lines |
| recruiter | Recruiter | 100 | 5.5 | evasive; every 4 s revives the nearest non-gibbed corpse within 14 m (0.8 s glowing tell, interruptible by pain); attack: marks your position (red ring), 0.9 s later a fire pillar there (25 dmg) | prioritise, gib corpses |
| ceo | The CEO (boss) | 4500 | — | see Boss | everything |

Roughly 45–60 enemies per campaign level.

### Boss — The CEO (rooftop)
4 m tall, suit, horns, golden tie. Never staggers. Health bar on HUD.
| Phase | hp | Attacks (each with a tell) |
|---|---|---|
| 1 "Quarterly Results" | 100–66 % | fan of 5 fireballs (0.6 s raise); ground-slam shockwave ring (expands 14 m/s, 0.6 m tall — jump it; 20 dmg) |
| 2 "Restructuring" | 66–33 % | + "Hiring spree": 3 interns + 1 burnout at 66 %, manager + 2 interns + 1 burnout at 50 % (burnouts ≥ 13 m away); + charge across arena (1 s tell) |
| 3 "Golden Parachute" | 33–0 % | faster cooldowns (×0.7); fireball fan becomes 9; double slam half the time; 2 burnouts every 10 s with 1 s floor-ring warning (max 2 burnouts / 6 helpers alive) |
Phase thresholds clamp damage (no phase skipped). Death: 2.6 s death sequence, big gib + "BOARD DISSOLVED", exit opens. Tuned (iteration 2, n = 12 bot runs): 11/12 reach phase 3, 4/12 win; ~80 % of damage from telegraphed attacks.

## Levels
| Id | Name | Par | Secrets | New threats introduced | Set pieces |
|---|---|---|---|---|---|
| tower | Floor 1: Lobby | 4:00 | 3 | burnout (cubicles), compliance (server room), sysadmin (atrium ledge, late) | keycard ambush, server-room lockdown |
| archives | Sub-basement: Archives | 5:00 | 3 | recruiter | archive-stacks maze, parking-garage arena lockdown (3 waves), laser reward |
| rooftop | Rooftop: Board Meeting | 4:00 | 2 | boss | short approach (stairwell + boardroom), boss on helipad |
| overtime | OVERTIME | — | 0 | all | endless waves |

Waves (OVERTIME): wave n budget = 6 + 3n + ⌊n²/10⌋ points; costs intern 1, burnout 1, manager 2, sysadmin 2, printer 3, compliance 3, brute 4, recruiter 4. Types unlock: burnout w2, printer w3, compliance w4, brute w5, sysadmin w6, recruiter w8. 6 s break between waves, "WAVE n" banner; pickups, drums and weapon gifts restock when a wave is cleared; sysadmins capped at 1 + n/6; stragglers out of sight > 8 s re-enter near the player. Tuned (n ≥ 30 bot runs): median wave 7 (stock bot) / 10 (smarter bot).

## Visual direction (keep the style)
- Pixel filter (≈200 px tall internal res) + Bayer dither + 6-level palette stay. P toggles.
- Every surface gets a procedural pixel texture (64×64 canvas, nearest, 32 px/m, world-space mapping), tinted by the area palette colour. Office → hell gradient per area as before.
- Decals: bullet holes, blood splats (floor + walls), scorch marks; pooled, max 160.
- FX: sparks on wall hits / shield hits, smoke puffs, layered explosion (flash + fireball + smoke + debris), varied gibs.
- Hit-stop 0.04–0.12 s on gibs/terminations; crosshair hit marker; kill flash on HUD.
- Readability: enemy projectiles glow (emissive) and are saturated warm or violet; the only red lines on screen are sysadmin tells; telegraph rings are red.

## Audio
Per-weapon sounds for the 3 new weapons; sight/tell/pain/death per new enemy; boss music variant (rank layers forced high + boss drone); arena lockdown sting; wave banner sting.
