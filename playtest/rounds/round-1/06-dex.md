# Dex — numbers analyst · playtest round 1

**Verdict (in character, 2–3 sentences).** The curve is readable and the numbers hold together, but the spreadsheet says the early game is one enemy deep: Burnouts from wave 2 do a third of all damage and kill a third of the runs that end. Score is not a difficulty measure, it grows roughly 30% per wave, so the leaderboard is a survival-time chart. Our expert bot survives about 6 waves longer than the design doc's "smarter bot", so either the tuning used a weaker opponent or our expert is not representative. n = 8 per cell; I would not ship a balance decision on any single cell.

Fun: 6/10 · Would play again tomorrow: maybe · Domain score: 7/10 (the data is sound, the sample is small)

## Session log

Batches: 72 bot runs, `PT.batch`, n = 8 per cell, `maxSeconds` 1500 game-s. Raw rows: `playtest/rounds/round-1/06-dex-data.json`. Plus 1 manual probe run.

| Run | Skill / tactics | Result (wave, time, score) — median [min–max] over all 8 runs | Killed by (lost runs) | Note |
|---|---|---|---|---|
| A1 | casual, default | wave 2.5 [2–7] · time 55 s [32–248] · score 9.8k [4k–64k] | Burnout 4, Compliance 2, Sysadmin 1, Drum 1 | 4 of 8 died on wave 2 |
| A2 | average, default | wave 9 [2–18] (8 incl. 1 capped) · time 237 s [26–1289] · score 176k [3k–1.60M] | Burnout 5, Sysadmin 1, Printer 1 | 1 run capped: stuck on wave 2 for 1500 s |
| A3 | expert, default | wave 16.5 [5–26] · time 552 s [138–1315] · score 1.54M [58k–4.48M] | Recruiter 2, Sysadmin 2, Intern 1, Brute 1, Compliance 1, Burnout 1 | no capped runs |
| B1 | expert, stance floor | wave 15 [4–30] · time 496 s [86–1437] · score 1.08M [53k–7.03M] | Manager 2, Brute 1, Burnout 1, Printer 1, Compliance 1 | 2 capped alive at w30–31 |
| B2 | expert, stance deck | wave 15 [7–21] · time 484 s [227–858] · score 1.01M [136k–2.32M] | Sysadmin 1, Compliance 1, Burnout 1 | **5 of 8 capped** (w5–14, 1500 s, low damage) |
| B3 | expert, stance island | wave 16 [6–31] · time 455 s [160–1418] · score 1.16M [120k–6.40M] | Burnout 3, Recruiter 2, Brute 1, Sysadmin 1 | 1 capped at w30 |
| B4 | expert, stance mobile | wave 19.5 [8–31] · time 642 s [147–1247] · score 2.01M [196k–6.03M] | Recruiter 2, Sysadmin 1, Compliance 1, Printer 1, Burnout 1 | 2 capped alive at w31 |
| C1 | expert, target nearest | wave 20 [9–31] · time 746 s [225–1462] · score 2.43M [140k–7.49M] | Sysadmin 3, Compliance 1, Burnout 1, Recruiter 1 | 2 capped (w6, w31) |
| C2 | expert, target threats-first | wave 16.5 [14–32] · time 542 s [358–1382] · score 1.34M [770k–7.51M] | Burnout 4, Sysadmin 2, Drum 1, Compliance 1 | no capped runs |
| P | average, default, manual probe | died wave 8 · 3:49 (229 s) · score 200,745 | Manager fireball (hp 3 at wave 8 end) | see probe below; this run set the persona best |

Totals: 72 batch runs, 59 died, 13 capped (hit the 1500 s cap while alive, or stalled). Capped runs are censored: their "wave" is a lower bound, not a death wave.

## Highlights (what worked — keep these)
- **Score is honest about survival.** Every death has a clear killer and a readable damage ledger (`damageTakenBy` sums to the hp lost). [data] (`06-dex-data.json`)
- **Expert runs reach waves 20–31 at all.** The skill ladder is wide: casual 2.5, average 9, expert 16.5 medians; expert is not a wall of instant deaths. [data]
- **Stance choice matters less than the harness suggests in the middle, but mobile and island keep the bot alive longest among finished runs.** Floor and island give the same kind of death spread. [data]
- **Wave 2 spike is consistent.** Every casual run that died on wave 2 died to the same first-threat cluster (Burnouts and the drums they chain). That makes the wave-2 gate a clean, repeatable test. [data]

## Pain points (ranked, worst first)
1. **Wave 2 is a coin flip for a casual player.** Casual median wave 2.5; 4 of 8 died on wave 2, three to a Burnout blast and one to a Toner Drum. Burnouts unlock at wave 2 with a cost of 1 point and a 50 dmg, 3.5 m blast on death. The player gets one wave of exposure before a new rule. [data] · Severity: major
2. **Burnout is the dominant damage source across every cell.** 35% of all damage taken (72 runs), 36% of killing blows (21 of 59 deaths). It is the top killer for average and threats-first, and second for expert. The design doc gives no target share for it, so I cannot say whether this is intended; it looks like one enemy is doing the work of the whole roster. [data] [inferred] · Severity: major
3. **The score curve is geometric, so the leaderboard rewards survival time, not play.** Median score per wave: w8 ~0.20M, w14 ~0.89M, w21 ~2.3M, w26 ~4.4M, w31 ~7.3M. Fitted slope across average and expert default: log10 score +0.118 per wave, about ×1.31 per wave. A survivor at wave 31 scores about 35× a death at wave 8. [data] · Severity: major (for score-chasing, see Theo)
4. **There is no single hard wall in expert runs, but wave 8 bites hard for a mid-skill player.** Probe: hp 100 → 3 inside wave 8, after 100 → 69 on wave 6 and 100 → 75 on wave 2. Wave 8 is also where Recruiters unlock (design: w8). I did not isolate the cause (Recruiter pillar vs. the mix of Burnout and Manager fireballs). [data] [inferred] · Severity: major
5. **Sysadmin is the second damage source and the late-game killer.** 33% of all damage, 12 of 59 killing blows, and it dominates the expert runs that reach waves 24–31 (sniper damage 700–1500 per run). The design caps sysadmins at 1 + n/6, so at wave 26 that is 5 snipers. [data] · Severity: minor (it is a late-game problem only)
6. **Stalled runs look like a survival problem but are not one.** 5 of 8 expert "deck" runs were still alive at the 1500 s cap, stuck on waves 5–14 with almost no damage taken (for example wave 5, 45 kills, 9 damage taken in 1500 s). Those 13 capped runs (18% of all runs) make the stance comparison unreadable. [data] · Severity: minor for players, major for analysts

## Bugs & oddities
- **Stall on wave 2 (average, cell A2 run 5):** 1500 s of game time at wave 2 with 11 kills, 37 damage taken, no death. Repro: `PT.batch({n:8, skill:'average'})`, row 5. Likely the bot not closing the last enemies; not verified.
- **Deck stance stalls:** 5 of 8 runs capped at waves 5–14 (`stance: 'deck'`). The brief mentions deck hunting alternation; the data says it is worse than "slower": the run does not end. Rows in `06-dex-data.json` under `stance_deck` with result `unfinished`.
- **Probe run set a real best score (200,745).** The brief says batches do not touch best; the manual probe did. Noted so the persona record is not read as a batch result.
- **`topDmg` contains "unknown" (12–47 dmg) in 3 rows** (average wave 2, expert threats-first). Some damage has no source label. Small, but it will break a damage-share table.

## Recommendations (max 6, most impactful first)
| # | Change | Why (which pain point) | Expected effect | Effort guess S/M/L |
|---|---|---|---|---|
| 1 | Make the first Burnout arrival gentler (fewer on wave 2, or delay the first explosion chain) | Pain 1: 4/8 casual deaths on wave 2 | Casual median wave moves off 2; fewer day-one quits | S |
| 2 | Check Burnout's share of damage against an intended target (design doc has none) and set one | Pain 2: 35% of damage, 36% of kills | Makes the enemy budget a decision, not an accident | S |
| 3 | Bend the score curve (e.g. cap the rank multiplier or make kill score sublinear in wave) if the leaderboard should reward play, not survival | Pain 3: ~×1.31 per wave | Scores stay comparable across skill levels | M |
| 4 | Playtest wave 8 specifically (Recruiter unlock) with a mid-skill player and log which source does the hp drop | Pain 4: 100 → 3 in one wave | Identifies whether it is a spike or a design wall | S |
| 5 | Fix the stall: runs that sit at a low wave for minutes with no damage | Pain 6, oddity 1 and 2: 13 of 72 runs capped | Cleaner batches; stance and target comparisons become readable | M |
| 6 | Give damage `unknown` a source label | Oddity 4 | Damage share tables add up | S |

## Domain deep-dive

**Where do runs die?** Casual: wave 2–7, half on wave 2 (Burnouts). Average: wave 2–18, killers mostly Burnout (5 of 7 finished deaths). Expert: wave 5–26 in the default cell; killers spread across Sysadmin, Recruiter, Brute, Compliance. Expert runs that survive the stance and target cells mostly die on 14–31 to a sniper or a Burnout blast. [data]

**Which enemy dominates damage, and is it intended?** Burnout (35%) then Sysadmin (33%), Brute (14%), Printer (8%), Compliance (4%) over all 72 runs. Expert-only (56 runs): Burnout 34%, Sysadmin 33%. The design doc says Burnout is a "bomb" for the player to use at range; the damage numbers say most of the time it is the player taking the blast, not the other way round. I cannot tell from the numbers whether the designers intended that split. [data] [inferred]

**Is the curve smooth or does it have a wall?** Median death wave by skill: 2.5 → 9 → 16.5. Within expert, the spread is wide (5–26) with no obvious cluster, so no single wall in the bot data. The wave-8 hp drop in the probe is the clearest single spike. The budget formula (6 + 3n + n²/10) is quadratic, but the survival curve for expert looks closer to linear. [data] [inferred]

**Is there a dominant tactic?** No. Expert finished-run medians by stance: floor 15 (n=6), deck 15 (n=3 finished, 5 capped), island 16 (n=7), mobile 19.5 (n=6). By target: nearest 20 (n=6 finished), threats-first 16.5 (n=8). All ranges overlap, n is too small to call. The deck stance is the only one with a clear harness problem (5/8 capped). [data]

**How does score scale with wave?** Roughly geometric, about ×1.31 per wave (log10 slope 0.118 over average and expert default runs). Median score by wave: w2 4k, w8 0.20M, w14 0.89M, w21 2.3M, w26 4.4M, w31 7.3M. Scores grow faster than the enemy budget, which is quadratic in wave number, so score is not a clean function of difficulty. Inferred cause: per-kill score × rank multiplier, and rank climbs with kill streaks. I did not read the score code. [data] [inferred]

**Comparison with DESIGN.md tuning note.** The doc says "median wave 7 (stock bot) / 10 (smarter bot)", tuned on n ≥ 30 runs. Our average bot: median 8 incl. one stall, 9 finished-only, which sits between those two numbers. Our expert bot: median 16.5 default, 15–20 across stance and target cells, which is about 6 waves above the design's "smarter bot". Two readings: the design tuning used a weaker expert than ours, or our expert is not representative of a human. The doc does not say which bot the 10 refers to, so I cannot tell which. [data]

## Harness caveats
- **n = 8 per cell.** Medians on 8 runs with a spread of 5–26 are not stable. Any difference under about 4 waves between cells is noise. Stance and target conclusions are weak.
- **Capped runs are censored.** 13 of 72 hit 1500 s alive or stalled. Their wave is a lower bound and their score is still growing. Medians including them are biased low for the good stances (deck) and high for others (mobile, which kept runs alive to wave 31). I reported both with and without them where it matters.
- **Stalls are a bot artefact, not a difficulty signal.** The deck and average-wave-2 stalls take damage almost never; a human would not sit there for 25 minutes. I did not diagnose the cause (no source reading allowed).
- **Bot, not human.** The bot aims and dodges by rule; burnout avoidance and sniper dodge are scripted. Burnout's share of damage may be inflated by the bot standing in blast range, and the sniper share by the bot's inability to break LOS well on high ground. Treat both as the bot's pattern, not a player's.
- **Score is one run's shape.** Score scales with survival time, so a 1500 s cap changes the top score. Cross-cell score comparison is confounded by the cap.
- **Probe is one run.** One average run, hp curve read from `PT.ledger().waves`. It tells us where this run bit, not where the design bites.
- **Not evaluated:** feel, audio, real timing, real player skill. Nothing here is a difficulty verdict for humans without a human sample.

## Findings (machine-readable)
```json
[
 {"area":"balance","type":"issue","severity":"major","finding":"Casual players die on wave 2 half the time (4/8), all to Burnout blast or its drum chain; wave 2 is the first Burnout wave.","evidence":"06-dex-data.json batches.default_casual rows 3,5,6,8 (median wave 2.5)","recommendation":"Soften wave-2 Burnout count or the first explosion chain; re-run casual cell n>=8."},
 {"area":"enemies","type":"issue","severity":"major","finding":"Burnout is 35% of all damage and 36% of killing blows across 72 bot runs; no target share exists in DESIGN.md.","evidence":"pooled topDmg and killedBy over all batch cells (Burnout 21 of 59 lost runs)","recommendation":"Decide an intended damage share for Burnout and check whether the bot stands in blast range."},
 {"area":"scoring","type":"issue","severity":"major","finding":"Score grows about x1.31 per wave (median w8 0.20M, w14 0.89M, w21 2.3M, w31 7.3M); a survivor at w31 scores about 35x a death at w8.","evidence":"per-wave median score over 72 runs; log10 slope 0.118 per wave","recommendation":"If score should reward play not survival, sub-linear kill score or cap rank multiplier; else accept and document."},
 {"area":"balance","type":"issue","severity":"major","finding":"Wave 8 is the clearest hp spike in the probe: 100 to 3 hp inside one wave (wave 6 100 to 69, wave 2 100 to 75). Wave 8 is the Recruiter unlock.","evidence":"PT.ledger().waves, probe run, 2026-10-21 round 1","recommendation":"Playtest wave 8 with a mid-skill player; log which source does the hp drop before tuning."},
 {"area":"enemies","type":"issue","severity":"minor","finding":"Sysadmin is 33% of damage and 12 of 59 killing blows, mostly in late expert runs (sniper damage 700-1500 per run at waves 24-31).","evidence":"stance_island, stance_mobile, target_nearest rows","recommendation":"Check sysadmin cap (1+n/6) and LOS-break behaviour; late game only."},
 {"area":"bug","type":"bug","severity":"major","finding":"Runs stall at a low wave for the full 1500 s with almost no damage taken: 5 of 8 expert deck runs (waves 5-14) and one average run at wave 2.","evidence":"stance_deck rows 1,4,5,7,8; default_average row 5 (11 kills, 37 damage in 1500 s)","recommendation":"Find why the bot stops clearing the last enemies; this drowns the stance comparison."},
 {"area":"bug","type":"bug","severity":"minor","finding":"topDmg has an 'unknown' source (12-47 dmg) in 3 runs.","evidence":"default_average row 4; target_threats-first row 6 (unknown 47)","recommendation":"Give the unlabelled damage a source name so damage-share tables sum to total."},
 {"area":"balance","type":"praise","severity":"minor","finding":"Ability spread is wide enough to separate skill: casual median 2.5, average 9, expert 16.5 waves.","evidence":"default cells, n=8 each","recommendation":"Keep the spread; confirm with n>=30 before quoting."},
 {"area":"balance","type":"idea","severity":"minor","finding":"Our expert bot survives about 6 waves longer than the DESIGN.md 'smarter bot' tuning note (median 10).","evidence":"default_expert median 16.5; design note median 10 (smarter bot, n>=30)","recommendation":"Confirm which bot the design tuning used; re-tune against the expert bot or document the gap."}
]
```
