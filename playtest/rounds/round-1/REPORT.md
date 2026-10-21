# OVERTIME (endless mode) — Simulated Playtest, Round 1 · Synthesis
**Build:** working tree, 2026-10-21 (not a git repo, so no tag; the only game change is a one-line dev hook `g.onHurt?.(dmg, from)` in `src/world.js` `hurtPlayer`) · **Method:** `.claude/skills/game-playtest` · **Panel:** [`playtest/PERSONAS.md`](../../PERSONAS.md) · **Brief:** [`playtest/BRIEF.md`](../../BRIEF.md)
**Testers:** 7 AI personas (5 on Sonnet, 2 on Haiku). About 25 hand-steered runs, ~110 batch runs from personas and ~70 calibration/verification runs from the orchestrator, and about 50 screenshots. The top claims were verified in-engine. Harness: `playtest/adapter.js` runs a first-person combat bot ("hands") at casual/average/expert skill, and the persona steers it through `PT.tactics` (stance, preferred weapon, target priority, pickup policy).

## 1. Executive summary
1. **Burnouts are the game's single biggest problem: 35% of all damage taken and 36% of killing blows across 72 analyst runs.** All 7 personas raised them. Three different problems combine:
   - Their **death blast hurts the player who kills them** at close range. I measured this: ~74% of Burnout-blast damage comes from Burnouts the player killed, or that chain-detonated, within 3.5 m. Only ~26% comes from their own suicide attack.
   - They arrive in **packs that chain** (pairs by design, plus Toner Drums).
   - On a dark carpet they are **small, low and dark**, with a hiss tell that only the 1.8 m suicide uses.
2. **Wave 2 is a coin flip for a new player.** Burnouts unlock there: 4 of 8 casual runs died on wave 2, and Mila died there 3 times out of 4. The step from wave 1 (a 12 s warm-up) to wave 2 is the steepest in the curve.
3. **Waves can stall forever, in any stance (real design flaw, verified).** Enemies have no stair or ramp awareness. They pin themselves against the deck wall or a staircase side, and the straggler rescue never fires because it requires **≤ 3 alive AND out of sight**. On deck stance, 5 of 8 analyst runs stalled for 25 game-minutes. Viktor's "freeze" is the same issue. A tested fix removes all stalls (§3).
4. **Late waves lose fairness through stacked blasts and clutter, not through any one enemy.** From wave ~17, drum + Burnout chains take 60–100 hp in 1–3 s. Blast whiteouts and big opaque FX cover 20–55% of the frame and hide the good tells.
5. **The death screen doesn't say what killed you.** "YOU'RE FIRED — Not a culture fit" is funny, but newcomers can't learn from their deaths. Rank, score and the ammo abbreviations are opaque to them.
6. **What's great:** the pixel/dither office-horror look and the satirical text. The **Sysadmin red laser** is "the best tell in the game". Weapons have clear jobs. Wave 1 is fun in 12 s, and beating your own best score feels good. Performance headroom is huge (~4 ms per render, sim cost flat until ~25 enemies).

## 2. Scorecard
| Persona | Model | Hands | Runs | Fun | Again tomorrow? | Domain score | One-line verdict |
|---|---|---|---|---|---|---|---|
| 01 Mila (cozy casual) | Sonnet | casual | 4 + 1 jumped | 5 | maybe | 5 (feel) | Looks great and wave 1 feels good; wave 2 Burnouts kill unreadably fast |
| 02 Noor (newcomer) | Sonnet | casual | 3 | 6 | maybe | 4 (onboarding) | The humour lands, the rules never get explained; deaths are unlearnable |
| 03 Rhea (challenge) | Sonnet | expert | 3 + 1 jumped | 7 | yes | 6 (fairness) | Fair and well telegraphed to ~W16; explosion chains make late waves unfair |
| 04 Ilse (readability) | Sonnet | average | jumped W6–15 | 7 | maybe | 5.5 (readability) | Cohesive palette; peak density turns to mush, red-on-red telegraphs |
| 05 Viktor (tactician) | Sonnet | expert | 4 + 3 batches | 6 | maybe | 5 (depth) | Clear weapon jobs, but one safe plan and a run-ending "freeze" |
| 06 Dex (analyst) | Haiku | all | 72 batch + 1 | 6 | maybe | 7 (data) | One enemy does a third of the work; score is a survival-time chart |
| 07 Theo (short session) | Haiku | casual→avg | 4 | 6 | yes | 7 (loop) | First minute is fun and the best-score chase works; early deaths feel unfair |
| **Mean** | | | | **6.1** | 2 yes / 5 maybe | **5.6** | |

## 3. Verified by the orchestrator
| Claim | Verdict | Evidence |
|---|---|---|
| Waves stall / Viktor's "sim freeze" | **Design flaw** (real, game-side) + bot limitation | Reproduced several times (my calibration, my deck batches, Viktor, Dex). Example 1: 4 enemies pinned at the north stair foot (x −4…4, z −12) while the player was on the deck, `hideT` 1120 s, wave never ending. Example 2: a Brute pinned against the side of the north staircase (x 3.75 = stair edge + its radius) 21 m from the player, outside its 18 m range, so it never attacks; it keeps line of sight, so `hideT` stays 0. Cause: the generic chase walks straight at the target with a ±side-step probe (`src/enemies/index.js` ~L300–310), and the rescue is gated on `e.los` false **and** `alive <= 3` (`src/levels/overtime.js:135-136`). Not a hit-stop: `g.hitstop` ≈ 0 during stalls. Termination is not involved; the correlation was n = 2. |
| Candidate fix for the stall | **Measured A/B** (patched at runtime, then reverted) | Rescue on "no progress": `idleT` resets on `tellT > 0` or `flash > 0`; teleport when `idleT > 12 s` regardless of alive count, and prefer re-entry points at the player's height. Deck/expert n = 8: **0/8 stalled**, median wave **26** (baseline 5/8 stalled at W5–14, median 15). Average/default n = 8: median 8.5 (baseline 9), no stalls, so normal play is unchanged. |
| Burnouts dominate damage | **Design flaw** | Dex: 35% of damage, 21/59 kills. My split (4 average runs, 2,233 Burnout dmg): **74% from Burnouts killed or chained within 3.5 m**, 26% from suicides. The blast is `blast(g, center, 3.5, 50, e)` in `onDeath` (`src/enemies/staff.js:442`), so it hurts the player whoever killed it. |
| Wave-2 spike for casuals | **Design flaw** | Calibration casual median W4 (n = 6) and Dex casual median W2.5 (4/8 die on W2), Mila 3/4. Burnouts unlock on W2 and come in pairs (`composeWave`, `src/levels/overtime.js`), alongside 4 drums placed 6–7 m from spawn. |
| "TERMINATED" / "CLOCKING IN…" stuck on the HUD (Noor, Viktor) | **Harness artefact** | Both elements are at `opacity: 0` (CSS animation finished); `PT.ui()` reads `innerText`, which includes transparent text. |
| "PROMOTED" disagrees with the rank label (Noor) | **Harness artefact (likely)** | The adapter refreshes the HUD every 6 ticks, so the label lags the message. The rank swinging INTERN↔C-SUITE is real: style decays at 4 + 3·rank points/s (`src/style.js:62`). |
| Damage source "unknown" (Rhea, Dex, Viktor) | **Harness artefact — fixed** | Blast centres sat > 2.5 m from the dead body; the adapter now searches 4 m for dead Burnouts/Drums. 6 re-run batch rows: 0 unknown in their top sources. |
| "Bot ignores `prefer`" (Viktor) | **Bot limitation** | `prefer` applies only while the weapon has ammo (launcher/laser ammo is scarce); the Termination axe-swap and the launcher's < 5 m safety rule override it. |
| Deck/island/axe plans "non-viable" (Viktor) | **Mostly bot limitation** | Deck results were contaminated by the stall. With the stall fix, deck/expert reaches median W26, better than floor. Island and axe-only results reflect a bot with no jump or rocket-jump and crude laser charging. |

Not verified, worth a quick check: Rhea saw 3–5 overlapping Sysadmin lasers at W26–32. That follows the design cap `1 + n/6`, so whether it's intended at that wave is a design question. The death camera looks at the ceiling (Noor): `render()` uses roll 0.5 and eye 0.3 m on death; check whether the killer can be framed.

## 4. Top issues (ranked by severity × reach × pillar impact)
| # | Issue | Sev. | Raised by | Evidence | Recommended change | Effort |
|---|---|---|---|---|---|---|
| 1 | **Burnout blast punishes the kill**, and packs chain into instant deaths | major | all 7 | §3; Dex 35%/36%; Rhea W17+ chains; Mila, Noor, Theo deaths | Pick one: (a) a Burnout killed by the player detonates at ½ damage to the player (keep full damage to enemies, so it stays a "use as a bomb" tool); (b) show the 3.5 m radius as a red floor ring once it's within ~6 m; (c) cap Burnouts alive at ~4 and stop the auto-pairing before W5. Re-run Dex's cells to target a share of ≤ 20%. | S–M |
| 2 | **Wave stalls / soft-locks** (enemies pinned on stairs and the deck lip) | major (blocker for whoever hits it) | Viktor, Dex, orchestrator | §3, A/B tested | Rescue on "no progress for 12 s" instead of "out of sight and ≤ 3 alive", and re-enter at the player's height (patch in §3). Longer term: give stairs a waypoint in the chase AI. | S |
| 3 | **Wave-2 difficulty spike** | major | Mila, Noor, Dex, Theo | 4/8 casual W2 deaths | W2: 2 Burnouts max (no pairing) and a "BURNOUTS EXPLODE — KILL THEM AT RANGE" banner; full packs from W4. Move drums farther than 9 m from spawn or delay them to W3. | S |
| 4 | **Death screen teaches nothing** | major | Noor, Mila, Theo | [read] death screen | Add a "CAUSE OF TERMINATION: Burnout explosion" line plus the top 2 damage sources (data the adapter already gathers; mirror it in-game). Keep the joke line. | S |
| 5 | **Peak-density clutter hides tells** | major | Ilse, Rhea, Mila | Ilse shots: FX cover 20–55% of the frame; Recruiter ring lost in crowds | Cap near-camera FX opacity/size (dither-fade within 2 m), shorten whiteout flashes, desaturate blood/gore decals so warm/red stays reserved for threats. | M |
| 6 | **Red overload and colour-blind risk** | minor–major | Ilse, Rhea | ring, laser, eyes, pillar bands, blood and rank bars all red | Reserve red for telegraphs only: recolour the pillar bands and rank bars; give rings and lasers a shape/brightness pulse, not just hue. | S–M |
| 7 | **Far Sysadmin hard to find** | minor | Ilse, Rhea | 25 px body / 5 px tell at deck range; 50 of 95 dmg in one W15 chunk | Add an off-screen sniper indicator while a tell is aimed at you; scale the laser emitter flare with distance. | S |
| 8 | **Compliance clipboard chip damage** reads as unfair early | minor | Rhea, Theo | 102 + 147 clipboard dmg in single runs | A brief arm-raise tell, or 10 → 7 dmg before W8. | S |
| 9 | **Score is a survival-time chart** (×1.31 per wave) | design | Dex, Noor | median W8 0.20M → W31 7.3M | Decide intent. If style should matter, show a per-wave breakdown on the death screen (kills, style, wave pay) so players see *why* a run scored more. | S |
| 10 | **New weapon on the reception desk is easy to miss** | minor | Theo, Mila | run never picked up the launcher | Beam of light, plus an arrow on the wave-clear message. | S |

Smaller polish: spell out the ammo pools (SHL/STP/TNR/CEL) on first pickup. Add a low-health pulse. Rank swings feel random to newcomers, so show the decay. A lone Compliance Officer can eat ~60 s of a wave (Viktor).

## 5. What to keep (consensus praise)
- **Look and tone:** the pixel filter + dither + office-to-hell palette, and the satire ("YOU'RE FIRED", rank titles, OVERTIME PAY, PROMOTED). Praised by Mila, Noor, Ilse and Theo.
- **The Sysadmin laser tell:** tracks, flashes and is cancelled by breaking line of sight. Rhea and Ilse both use it as the model for every other tell.
- **The first minute:** wave 1 clears in ~12 s with rank-ups and style pops (Theo, Mila).
- **The best-score chase:** beating your best on the death screen "felt great" (Theo).
- **Weapon roles read clearly** (Viktor). Projectile colours (warm orange/violet) read well (Ilse).
- **Performance:** 20 s of sim costs 120–225 ms and a render ~4 ms at wave 15 (Ilse), so there's room for clarity FX.

## 6. Design tensions
| Tension | Side A | Side B | Suggested resolution |
|---|---|---|---|
| Burnout lethality | Mila, Noor, Theo: unfair, unreadable | Rhea: "good in isolation", wants them kept dangerous late | Keep their late-game threat; fix *readability* (radius ring) and *self-damage on kill*, and soften only W2–4 numbers. |
| Aggression pillar vs the safe plan | Design: "aggression keeps you alive", Termination rewards | Viktor: mobile + stapler + no Termination is the safest plan | Retest after the stall fix and with a better axe bot before tuning. If it holds, make Termination pay ammo or armor that the stapler plan can't get. |
| Score meaning | Theo: chasing best is the hook | Dex: score ≈ survival time, so style barely matters | Keep geometric growth, but surface its parts so style play is visible and rewarded. |

## 7. Recommended backlog
**Now** (bugs/blockers, small)
- Stall rescue: "no progress 12 s" teleport at the player's height (§3 patch; A/B verified).
- Death screen: cause of death + top 2 damage sources.
- W2: no Burnout pairing, max 2, plus a one-line Burnout warning.

**Next** (core clarity & balance)
- Burnout: half self-damage on player kills, or a visible radius ring; cap the pack size. Target ≤ 20% of damage share.
- Reserve red for telegraphs; add a CVD-safe shape pulse on rings and lasers.
- FX clutter caps near the camera; shorter whiteouts.
- Sysadmin off-screen indicator.
- Re-run the analyst batches (n ≥ 8) to re-baseline.

**Later** (retention, larger)
- Stair-aware enemy navigation (a waypoint graph for the arena).
- Score breakdown and per-wave stats; make Termination pay off for non-axe plans.
- Weapon-drop beacon; ammo-name onboarding.

## 8. Harness caveats & next-round improvements
- **Bot ceiling (calibration):**
  - Default tactics: casual dies on W2–6 (median ~3), average W2–25 (median ~9), expert W5–26 (median ~17–21).
  - Our expert is about 6 waves above DESIGN.md's "smarter bot" note (median 10), so absolute wave numbers aren't comparable to that note.
  - The bot has no pathfinding beyond "nearest staircase", no jump or rocket-jump, and crude laser use. That makes it unfair to island/axe/laser plans.
- **Crutches:** Ilse and parts of Mila's and Rhea's play used `wave: N` jumps, tagged [jumped]. None of their difficulty claims rely on them.
- **Not evaluated:** audio, real mouse feel, motion/flash comfort over time (single frames only), and the HUD in screenshots (canvas only).
- **Harness fixes made this round:**
  - The `waveClear` stop; hunt-when-blind in the bot.
  - "unknown" damage attribution.
  - A Vite config (`playtest/vite.config.js`, port 5174) that accepts screenshot PUTs, and the `overtime-playtest` launch entry.
- **For next round:**
  - Make `PT.ui()` skip `opacity: 0` elements.
  - Refresh the viewmodel before `PT.shot` (screenshots show the previous weapon).
  - Add an axe-capable melee mode to the bot.
  - Add a "self-damage" tag to blast attribution.
- **Cost:** ~780k subagent tokens across 7 personas (98k–129k each), 1.5–6.5 min wall time each, run in parallel.

## Appendix — persona reports
[01 Mila](01-mila.md) · [02 Noor](02-noor.md) · [03 Rhea](03-rhea.md) · [04 Ilse](04-ilse.md) · [05 Viktor](05-viktor.md) · [06 Dex](06-dex.md) + [data](06-dex-data.json) · [07 Theo](07-theo.md)
