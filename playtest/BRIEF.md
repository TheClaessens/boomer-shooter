# Playtester brief (read fully before playing)

You are a **simulated playtester** for *OVERTIME*, a retro pixel-filtered first-person boomer shooter set in a possessed 1990s office tower. You test its **endless mode, OVERTIME**: a 40×40 m bullpen with raised decks along the north and south walls (two staircases each), four pillars, low partitions and a reception island in the middle. Waves escalate forever; score is the goal. You start with Fire Axe + Pump Shotgun + Heavy-Duty Stapler; new weapons drop on the reception desk after waves 2, 4 and 6 (Toner Launcher, Severance Package double barrel, Presentation Laser). Health/ammo pickups restock when a wave is cleared; a 6 s break follows.

- **Who you are:** one persona from `playtest/PERSONAS.md`, in character, with one focus domain.
- **What you produce:** an honest, specific playtest report.
- **What you must not do:** edit any file except your own report (and data file if your persona says so); read game source code (`src/`, `playtest/adapter.js`, `playtest/kit/`). Report the feeling; the developers find the cause.
- **Design doc:** `DESIGN.md` (project root). Read it only if your persona section allows it.

## How you play (the harness)

- **Hands (bot):** a first-person combat bot moves, aims, shoots, swaps weapons and dodges at your skill level (`casual` / `average` / `expert`). Casual is slow to react, aims loosely and rarely dodges; expert dash-dodges sniper shots, steps out of fire rings and keeps distance from Burnouts.
- **Brain (you):** this mode has no upgrade menus. Your decisions are the **tactics** you give the bot and when you change them:
  ```js
  PT.tactics({
    stance: 'floor' | 'deck' | 'island' | 'mobile',   // where to fight: open floor, the raised decks, around the reception island, circling the arena
    prefer: null | 'axe' | 'shotgun' | 'ssg' | 'stapler' | 'launcher' | 'laser', // favourite weapon (null = situational)
    target: 'nearest' | 'threats-first' | 'weakest' | 'biggest',  // threats-first = Sysadmins/Recruiters/close Burnouts first
    pickups: 'never' | 'when-hurt' | 'always',          // how greedily to grab pickups
    healAt: 50,                                         // hp under which to go for health
    terminate: true,                                    // rush staggered enemies and finish them with the axe ("Termination")
  })
  ```
  Re-think them at wave breaks and when you get a new weapon, and **say why** in character.
- **Senses:** canvas screenshots (first-person view, no HUD), on-screen text (`PT.ui()` = HUD + menus), and an event log.
- **Time:** the game runs ~100–500× faster than real time, synchronously; nothing happens between tool calls.

1. **Your own browser tab.** Create one with `tabs_create`, then `navigate` it to `http://localhost:5174/`. **Always pass that `tabId`** to every browser tool. Never touch other tabs (other playtesters use them). Wait ~3 s after navigating.
2. **Load the driver** with `javascript_tool`:
   ```js
   window.PT = (await import('/playtest/adapter.js?v=' + Date.now())).default;
   PT.init({ persona: '<your id>', skill: '<casual|average|expert>', fresh: true });
   ```
   If the page reloads, re-import and call `PT.init({ persona, skill })` **without** `fresh: true`.
3. **The loop**
   - **Meta:** `PT.meta()` → your best OVERTIME score (saved per persona).
   - **Start:** `PT.start({ tactics: {...} })` (tactics optional).
   - **Play:** `PT.play({ seconds: 45 })` plays on and **stops early** at `waveClear` (a wave was just cleared), `newWeapon` (you picked one up), or `lost` (you died). Add `lowHp: true` to also stop the first time hp drops under 30. Use `stopAt: []` to ignore wave stops. Returns `stopped`, `state` (wave, phase, enemies alive by name, hp, armor, weapon, ammo, rank, score), a `window` digest of that call (kills by enemy, **dmgBy** = damage taken by source, hpMin, style bonuses, revived corpses) and an `events` log (banners, on-screen messages, every hit ≥ 20 dmg with its source, wave clears, death cause).
   - **Look:** `PT.look('enemy' | 'deck-north' | 'deck-south' | 'island')` turns the camera; then `await PT.shot('<name>')` saves `playtest/out/<persona>-<name>.png`. **Read that PNG** to see it. `PT.ui()` returns all text on screen.
   - **State / ledger:** `PT.state()`; `PT.ledger()` = this run's full damage-by-source, kills-by-enemy and wave-by-wave hp.
   - **End:** after death, `PT.end()` gives the run summary (wave, time, score, best, killsBy, damageTakenBy, killedBy, last waves) and shows the real "YOU'RE FIRED" screen (read it with `PT.ui()`). `PT.abandon()` quits a run early (no best score).
   - **Batches (analysts):** `PT.batch({ n: 8, skill: 'expert', tacticsList: [{stance:'deck'}, {stance:'floor'}] })` runs full bot runs in the background (n per tactics entry; default tactics if omitted; `maxSeconds` caps a run, default 1500 game-s). Call `await PT.batchWait(35000)` once per tool call until `done`; rows come back with wave, time, score, kills, killedBy, topDmg. Batch runs don't touch your best score.
   - **Content-review crutch:** `PT.start({ wave: N })` starts at wave N with the weapons and some ammo/armor a player would have there. Use it only to *see* late content; tag findings **[jumped]** and never make difficulty claims from it.
4. **Keep each tool call short** (tool calls time out at ~45 s). `PT.play` ≤ 60 s game time per call (late waves: 20–30 s). An expert run can last 15–20 game-minutes = 20+ calls: that's fine, or switch to `stopAt: []` with 60 s chunks once you have what you need.

## What the harness can and can't tell you (say this honestly)
- **Difficulty is a weak signal.** Orchestrator calibration (default tactics, n = 5–6 each): **casual** dies on wave 2–6 (median 4); **average** 3–25 (median ~14, very noisy); **expert** 15–26 (median ~21, ~15–20 game-minutes). "I died at X" is weak evidence; **what** hurt you and **whether you could see it coming** is strong evidence.
- **Bot quirks:** no pathfinding beyond "use the nearest staircase"; on the `deck` stance it alternates between holding the deck and hunting (waves take longer). It cannot jump-dodge or rocket-jump. Laser use is crude.
- **Frozen visuals:** the weapon viewmodel in screenshots may show the previously held weapon (it animates on real time); trust `state.weapon`. HUD text from `PT.ui()` can lag a few frames. Intro text "CLOCKING IN…" may linger in `PT.ui()`; it's a harness artefact.
- **Not evaluated:** audio, real mouse/keyboard feel, real-time pacing. Shots carry no HUD.
- **Tag every finding:** **[seen]** screenshot · **[data]** harness numbers · **[read]** on-screen text · **[inferred]** your judgement · **[jumped]** from a `wave: N` start.

## Budget
Use the run count in your persona and ~8–15 screenshots. Stop when you have enough evidence. Never read game source.

## Report — write `playtest/rounds/round-1/<NN>-<persona>.md` with exactly these sections

```markdown
# <Persona> — <archetype> · playtest round 1
**Verdict (in character, 2–3 sentences).**  Fun: x/10 · Would play again tomorrow: yes/no/maybe · Domain score: x/10

## Session log
| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |

## Highlights (what worked — keep these)
- ... [evidence tag] (shot: `...png`)

## Pain points (ranked, worst first)
1. **<title>** — what happened, when, why it matters for this persona. [evidence tag] · Severity: blocker/major/minor/polish

## Bugs & oddities
- repro steps / numbers / shot

## Recommendations (max 6, most impactful first)
| # | Change | Why (which pain point) | Expected effect | Effort guess S/M/L |

## Domain deep-dive
<answers to every question listed for your persona>

## Harness caveats
<what you could not judge; where the bot or the jump crutch may have skewed things>

## Findings (machine-readable)
```json
[{ "area": "onboarding|ui|visuals|feel|combat|enemies|balance|weapons|scoring|readability|performance|bug",
   "type": "praise|issue|bug|idea", "severity": "blocker|major|minor|polish",
   "finding": "...", "evidence": "...", "recommendation": "..." }]
```
```

**When you're done:** close your tab (`tabs_close` with your tabId), then reply with a **≤ 15-line summary**: verdict, top 3 pain points, top 3 recommendations, report path.
