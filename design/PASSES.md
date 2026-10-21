# OVERTIME — design passes (v0.1 → v0.2)

## Pass 0 — Audit (v0.1, played + read)

| Area | Verdict |
|---|---|
| Core loop | Movement is good (Quake air control, bhop). Shooting feels OK; shotgun carries the whole game. |
| Structure / pacing | One 5-minute level, then nothing. No reason to play a second time except grade. |
| Player verbs | Run, jump, shoot, rocket-jump. No defensive verb besides strafing. |
| Weapons | 3. Axe is a novelty, launcher is late. No sustained-fire, no precision, no "big" gun. |
| Enemies | 4 Doom archetypes, all "walk at you and fire". No priority targets, no area denial, no counters that force a weapon choice. |
| Bosses | None. |
| Risk/reward | Style meter → health drops is a good hook, but nothing pulls you *close*; safest play is backpedal + shotgun. |
| World | Static boxes. Nothing to shoot except monsters. |
| Visuals | Strong pixel filter + dither, but every surface is a flat colour: rooms read as untextured prototypes. FX are tiny cubes; no decals; hits are hard to read. |
| Audio | Adaptive music is great. Few weapon/enemy sounds. |
| Meta | Grade only, no score, no persistence. |

**Diagnosis:** good engine and a great hook, but a one-room demo: too few toys, too few threats, nothing to replay.

## Pass 1 — Fantasy & tone
**Critique.** The office-demon joke lands in names (Intern, Middle Manager) but stops there.
**Decisions.** Every new thing is named in corporate-speak: weapons ("Severance Package"), enemies ("Compliance Officer"), mechanics ("Termination"). Story arc in three floors: Lobby → Archives (basement) → Rooftop board meeting with the CEO.
**Cut.** Cutscenes, dialogue, lore pickups.

## Pass 2 — Structure & pacing
**Critique.** One level, no ending.
**Decisions.** Campaign of 3 levels (≈4–5 min each, par per level) + **OVERTIME** endless wave mode on a dedicated arena (the replay loop). Weapons/ammo/health carry to the next level; R restarts the level from its start snapshot. Levels unlock on reach (saved). Lock-in **arena encounters** (doors seal, waves, "AREA CLEAR") give each level 1–2 set-piece peaks.
**Overrules v0.1:** "1 level, out of scope: progression/saves" — minimal save (unlocks + best scores) is in.
**Cut.** Difficulty settings, checkpoints, hub.

## Pass 3 — Player verbs
**Critique.** No defensive verb; damage avoidance is only strafing.
**Decisions.** **Dash** (Shift): 2 charges, 1.1 s recharge each, short i-frames. **Termination**: enemies dropped low become *staggered* (orange flicker, 2 s); an axe kill on a staggered enemy heals, refunds ammo, grants i-frames and hit-stop. This makes the axe the risk/reward core rather than a novelty.
**Cut.** Grapple, slide, wall-run.

## Pass 4 — Weapon roster (one job each)
**Critique.** 3 weapons, overlapping jobs.
**Decisions.** 6 slots: Axe (finisher/ammo), Pump Shotgun (all-rounder), Severance Package (point-blank burst), Heavy-Duty Stapler (sustained DPS/stunlock), Toner Launcher (crowds/rocket jump), Presentation Laser (charged piercing precision). Ammo: shells, staples, toner, cells.
**Cut.** BFG, alt-fires, upgrades.

## Pass 5 — Risk/reward systems
**Decisions.** Rank damage multiplier (+6% per rank). Point-blank shotgun bonus. Axe kills drop ammo; Terminations drop health. Burnouts explode on death (shoot them inside crowds, not inside your face). Gibbed corpses can't be re-hired by Recruiters (overkill matters). Explosive toner drums in levels. Score = style gains × rank multiplier; personal bests saved.
**Cut.** Shops, currencies, perks.

## Pass 6 — Enemies & boss
**Critique.** Every enemy is a variant of "approach and fire".
**Decisions.** Four new types, each forcing a different answer: Burnout (kamikaze → kill at range/use as bomb), Compliance Officer (frontal shield → flank, splash, laser, axe), Sysadmin (sniper with visible laser tell → break line of sight), Recruiter (revives corpses → target priority, gib). Boss: The CEO, 3 phases, every attack telegraphed. All enemies stagger.
**Cut.** Elite variants, more flyers.

## Pass 7 — World interactivity
**Decisions.** Explosive toner drums (chain), arena lockdowns, secrets per level (3/3/2), elevator/lift reuse.
**Cut.** Destructible walls, switches/puzzles.

## Pass 8 — Visuals, juice, audio (keep the style)
**Critique.** Flat colours make rooms read as greybox; hits lack weight.
**Decisions.** Procedural pixel textures (canvas, nearest, 32 px/m, world-space UVs) on every surface — same palette, now with carpet, ceiling tiles, wallpaper, server racks, concrete, flesh. Static geometry merged per material (fewer draw calls). Decals (bullet holes, blood, scorch). Sparks, smoke, better explosions, gib variety. Hit-stop on big hits, hit markers, kill flash. Pixel filter + dither stay. Boss music and per-weapon sounds.
**Cut.** Dynamic shadows, normal maps, post bloom.

## Pass 9 — Meta & balance targets
**Decisions.** Grade stays (per-level secrets total). Score + best per level/mode. Balance targets: a first-time player dies 0–2× on Lobby, reaches Archives; an experienced player S-ranks Lobby in < 3:30. Endless wave 10 is hard.
**Cut.** Leaderboards, achievements.

## Post-build integration log (v0.2)

**Iteration 1 (parallel build).** Six implementers (weapons, enemies, boss+rooftop, levels, art/FX, HUD/audio) on a core written first (builder, registries, stagger/termination, arenas, harness). Integration fixes: projectile table moved to `projectiles.js` (import cycle TDZ), stairs helper promoted to `B.stairs` + world settle, `clip` walls for the rooftop parapet (misses burst mid-air), enemy rest self-light (sank into dark rooms), HUD state reset per level, endless intro/banner overlap, door decals.
Perf (tower, all 67 bodies awake, this machine): update 0.6 ms, render 4.8 ms.

**Iteration 2 (playtest-driven).** Bot sims (`overtime.runSim`, n ≥ 8–40) showed burnouts/sysadmins dominating damage and Compliance Officers stalling waves (out-turned a strafing player). Tuned: burnout 0.45 s tell / 50 dmg, sysadmin 25 dmg, recruiter 100 hp, compliance turn 1.6 rad/s, wave budget +⌊n²/10⌋, restock on clear, straggler re-entry. Boss 3000 → 4500 hp with fairer summons; 11/12 bot runs reach P3, 4/12 win. Root-caused "gunfire wakes the floor above": `wakeNear` now needs line of sight (or < 6 m). Textures calmed (concrete, flesh, wallpaper), lobby palette brightened.

**Not verified:** nothing was played by a human with mouse + speakers; audio is verified by code reading and offline level checks only. Bots don't walk levels except the balance agent's scripted waypoint walker.
