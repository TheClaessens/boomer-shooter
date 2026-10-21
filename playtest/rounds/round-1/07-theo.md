# Theo — short-session / score chaser · playtest round 1

**Verdict (in character, 2–3 sentences).** The first minute is fun: wave 1 is cleared in about 12 s and the score climbs fast. The casual runs were short and sharp, with one death I could not see coming. The average runs were the good ones: beating my own best felt great and the death screen made the comparison obvious. I would play again tonight, but the early Burnout and clipboard damage made the early runs feel unfair.

Fun: 6/10 · Would play again tomorrow: yes · Domain score: 7/10

## Session log

| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |
|---|---|---|---|---|
| 1 | casual · floor, nearest, when-hurt, then threats-first/always at wave 2 | wave 4, 1:56, 19,721 (new best) | Compliance Officer clipboard | Wave 2 left me at 14 hp (Burnout explosions). Launcher on the desk was never picked up. |
| 2 | casual · island, prefer shotgun, threats-first, always | wave 2, 0:24, 8,020 (best stays 19,721) | Burnout explosion | Three explosions (31, 30, 31) landed in one second, 81 hp to 0. |
| 3 | average · deck, then island + prefer launcher at wave 2 | wave 7, 3:30, 65,891 (new best) | Possessed Intern pistol (last hit; clipboard did 147 dmg in total) | Launcher picked up 1.6 s after switching to island. Score passed 19,721 at wave 3. |
| 4 | average · mobile, then island + prefer launcher; laser + floor at wave 8 | wave 9, 4:08, 189,725 (new best) | Middle Manager staple fireball | Score passed 65,891 around wave 5. Laser picked up at wave 6. Hp was 15 after wave 8 and I still lived to wave 9. |

Break between waves: wave clear at 0:25, next "WAVE 2" banner at 0:31 (6 s). Consistent across runs.

## Highlights (what worked — keep these)
- **Score race is legible in the moment.** Wave clears show "OVERTIME PAY +100/+200/+300" and rank ups show "PROMOTED: ASSOCIATE → MANAGER → DIRECTOR → C-SUITE" [read]. Score climbs visibly every few seconds [data: run 4, 11k at wave 2 to 58k at wave 4].
- **Death screen is a good hook.** "YOU'RE FIRED / NOTICE OF TERMINATION / REASON: Missed the all-hands (was eaten)" plus "SCORE: 8020 best 19721" on a losing run and "SCORE: 189725 NEW BEST!" on a winning one [read]. It is clear at a glance whether I beat my best.
- **Style bonuses show on screen as text** ("+AIRBORNE +MULTI-KILL", "+VARIETY") [read] and add to the score. They make the score feel earned.
- **Launcher splash crowds (run 3, wave 2–3).** The Toner Launcher took out groups of Burnouts and Interns and was the moment I felt powerful. [data: 10 kills in the 15 s wave-3 call, run total 16 to 26]
- **Pickup flow works when the weapon is targeted.** Stance island + prefer launcher + pickups always grabbed the desk weapon within 1.5–1.7 s, twice in a row (runs 3 and 4) [data].
- **Wave pace.** Wave 1 cleared at 11–12 s in every run; wave 2 cleared 12–25 s later. Nothing feels like dead time.

## Pain points (ranked, worst first)
1. **Burnout explosions can kill from full health with no readable warning.** Run 2 died at 81 hp: three explosions (31, 30, 31) in the same second, wave 2 [data: events log 0:24]. Run 1 also dropped to 14 hp on wave 2 from Burnout explosions (64 dmg total). It is the early-game killer and I could not react to it. Severity: major. [data]
2. **Compliance Officer clipboard is the long-run chip damage.** Run 3 took 147 dmg from clipboards alone; run 4 took 40 in wave 6 and 27 in wave 8. It adds up quietly and never has a clear tell in the text. Severity: major. [data]
3. **The new weapon is easy to miss.** Wave clear says "NEW EQUIPMENT ON THE RECEPTION DESK" [read], but in run 1 (pickups always, stance floor, no weapon preference) I never reached the Toner Launcher and kept the stapler/shotgun for the whole run. Once I aimed the bot at it, it worked. A player who does not know to walk to the desk will miss the best weapon. Severity: minor. [data]
4. **Enemy readability at distance.** In the enemy shot (`playtest/out/theo-avg-run4-enemy.png`) the nearest threat is a bright white blob mid-screen; the enemy silhouettes are hard to pick out [seen]. The Burnout and Interns are hard to tell apart from the fire and explosion effects. Severity: minor. [seen, inferred]
5. **Score does not say why it went up, beyond the bonus text.** Kill score and style bonuses both feed the number, and the death screen shows only the total. I cannot tell from the screen whether a run scored more because of kills or of bonuses. Severity: minor. [inferred]

## Bugs & oddities
- Run 1 at wave 2 break: I set pickups to 'always' and the Toner Launcher still was not picked up (owned stayed axe/shotgun/stapler). Repro: stance floor, pickups always, target threats-first. Shot: none. [data]
- Post-death HUD text from `PT.ui()` can lag: after run 2 it showed "006320" as the score next to "+1700" while the death screen said 8020. Likely a harness artefact (HUD lag), not a game bug. [read]
- A "CLOCKING IN…" label stays on screen in `PT.ui()` after every death. Harness artefact per brief.
- Wave 1 spawns 5 kills by 11–12 s every run, so the first kill comes very early. I did not log it exactly (see caveats).

## Recommendations (max 6, most impactful first)
| # | Change | Why (which pain point) | Expected effect | Effort guess S/M/L |
|---|---|---|---|---|
| 1 | Give Burnout explosions a short tell (flash or shake before detonation) or lower early-wave burst damage | Pain 1: three explosions in one second took 81 hp | Early deaths feel earned, not random; casual runs last longer | M |
| 2 | Make the Compliance Officer clipboard hit more readable (sound or screen flash, or a small chip-damage tell) | Pain 2: 147 dmg from clipboards in one run | Chip damage stops feeling invisible | S |
| 3 | Point to the desk weapon on wave clear (marker or a banner pointing at the desk) | Pain 3: launcher missed in run 1 | More players reach the launcher and wave 3+ feels stronger | S |
| 4 | Show the score breakdown on the death screen (kills vs style bonuses) | Pain 5: no reason given for a higher score | Stronger "one more run" pull: I know what to chase | S |
| 5 | Increase contrast for enemy silhouettes against fire and explosion effects | Pain 4 | Easier to read threats at range | M |
| 6 | Keep the 6 s break as it is | No dead time seen; the break is short but readable | Keep the pace | S (no change) |

## Domain deep-dive

**Is the first minute fun?** Yes. Wave 1 is cleared in about 12 s and the score is already at 2–5k. The first Burnout death in run 2 came at 24 s, which is fast. [data]

**Where is dead time?** Not really. The 6 s break after each wave is short and always followed by a banner. I did not see a real dead stretch in the logs; the longest wave was 37 s (run 4, wave 5). [data]

**Does the score loop pull me back?** Yes, mostly through the "NEW BEST!" tag and the best score shown on the death screen. Beating 19,721 with a 65k run on the second average attempt felt good. The casual runs (8k and 19k) did not feel close.

**Can I stop cleanly?** Yes. Death leads to the "YOU'RE FIRED" screen and "REAPPLY [R]" or "MENU". I did not find a way to quit mid-run in the harness; a real player would need a clear exit. [inferred, harness]

**What would make me start one more run?** The death screen with "best X" is the strongest hook. A visible reason for the score (kills versus bonuses) and a clearer early tell for Burnouts would make me try again straight away.

## Harness caveats
- The bot does the aiming and dodging. The casual deaths (runs 1 and 2) are partly bot quality, not only design. Run 2 died to three explosions in one second; a human might dodge that. The average runs use the bot's better dodge.
- I did not log exact time to first kill. Wave 1 reached 5 kills in 11–12 s in every run, so first kill is under about 10 s. [inferred]
- The `deck` stance alternates hold and hunt, so run 3's early waves took longer than a human's would.
- The jump crutch (`wave: N`) was not used; no `[jumped]` findings.
- Shots carry no HUD. Only 2 screenshots taken; the enemy shot does not show the Burnouts clearly.
- `PT.ui()` after death can lag the HUD by a few frames (see Bugs).
- Audio and real-time pacing not evaluated.

## Findings (machine-readable)
```json
[
  {"area": "combat", "type": "issue", "severity": "major", "finding": "Burnout explosions can take a player from 81 hp to 0 in one second (three 30+ hits in the same second) with no readable warning.", "evidence": "Run 2 casual, wave 2, 0:24: hits 31, 30, 31 by Burnout explosion; died with 110 dmg from Burnouts. Run 1 also fell to 14 hp from Burnout explosions on wave 2.", "recommendation": "Add a short tell before Burnout detonation or lower early-wave burst damage."},
  {"area": "enemies", "type": "issue", "severity": "major", "finding": "Compliance Officer clipboard chip damage adds up over a run and has no clear tell.", "evidence": "Run 3 average: 147 dmg from clipboard, 40 from shield bash. Run 4 wave 6: 40 clipboard dmg, wave 8: 27.", "recommendation": "Give the clipboard hit a sound or screen flash so the damage reads clearly."},
  {"area": "weapons", "type": "issue", "severity": "minor", "finding": "New weapon on the reception desk is easy to miss; a run without a targeted pickup never got the Toner Launcher.", "evidence": "Run 1: pickups always, stance floor, Toner Launcher never picked up (owned stayed axe/shotgun/stapler). Runs 3-4: stance island + prefer launcher picked it up in 1.5-1.7 s.", "recommendation": "Point to the desk weapon on wave clear."},
  {"area": "readability", "type": "issue", "severity": "minor", "finding": "Enemies are hard to pick out at range against fire and explosion effects.", "evidence": "playtest/out/theo-avg-run4-enemy.png shows a bright white blob mid-screen; enemy silhouettes unclear.", "recommendation": "Raise contrast for enemy silhouettes against effects."},
  {"area": "scoring", "type": "issue", "severity": "minor", "finding": "Death screen shows only the total score, not what made up the score (kills vs style bonuses).", "evidence": "Run 4 death screen: SCORE 189725 NEW BEST!, no breakdown. Style text appears only during play (+AIRBORNE, +MULTI-KILL, +VARIETY).", "recommendation": "Show a score breakdown on the death screen."},
  {"area": "feel", "type": "praise", "severity": "minor", "finding": "Wave clear and promotion messages make the score race feel visible; the rank ladder (ASSOCIATE to C-SUITE) gives a clear progression.", "evidence": "On-screen text: OVERTIME PAY +100/+200/+300; PROMOTED messages at each rank step.", "recommendation": "Keep."},
  {"area": "ui", "type": "praise", "severity": "minor", "finding": "Death screen is a strong hook: funny termination reason, score vs best, NEW BEST tag.", "evidence": "Run 2: REASON Missed the all-hands (was eaten), SCORE 8020 best 19721. Run 4: NEW BEST! 189725.", "recommendation": "Keep."},
  {"area": "combat", "type": "praise", "severity": "major", "finding": "Toner Launcher splash groups kills and feels powerful in the mid waves.", "evidence": "Run 3 wave 3: 10 kills in a 15 s call with the launcher (run total 16 to 26).", "recommendation": "Keep."},
  {"area": "feel", "type": "praise", "severity": "minor", "finding": "Wave pace is fast: wave 1 clears in about 12 s, 6 s break between waves, no dead time seen.", "evidence": "Wave clear at 0:25 then WAVE 2 banner at 0:31 in run 1; similar in all runs.", "recommendation": "Keep the break length."},
  {"area": "bug", "type": "bug", "severity": "polish", "finding": "Harness-only: PT.ui() after death can show a stale HUD score and a CLOCKING IN label.", "evidence": "After run 2, PT.ui() showed 006320 / +1700 while the death screen said 8020.", "recommendation": "Not a game bug; check the harness HUD refresh before the death screen read."}
]
```
