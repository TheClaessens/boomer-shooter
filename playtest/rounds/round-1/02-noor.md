# Noor — genre newcomer · playtest round 1
**Verdict (in character).** It looked cool and I got a high score number on run 1, but I could not tell you why my score went up or down, what "SYNERGY" or "SHL/STP/TNR" mean, or why I died the second and third time. The game gives lots of feedback text but almost none of it explains the rules (burnouts blow up *me*, rank is a fading meter, health comes from pickups only). The death screen says "Not a culture fit" and nothing about what killed me. Fun: 6/10 · Would play again tomorrow: maybe · Domain score (onboarding/clarity): 4/10

## Session log
| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |
|---|---|---|---|---|
| 1 | casual, defaults (floor), later prefer launcher then ssg | W5, 2:31, 73683 (best) | Compliance Officer clipboard (last hit); biggest damage Burnout explosion 114 | Played in 5-15 s chunks; ran dry of shells (SHL 0) and toner (TNR 0); entered W4 at 27 hp |
| 2 | casual, island, prefer shotgun, pickups always | W3, 1:04, 3110 | Burnout explosion | Entered W3 with 20 hp; score ~25x lower than run 1 (almost no style bonuses) |
| 3 | casual, mobile, threats-first, healAt 60, pickups always | W3, 0:56, 12053 | Middle Manager staple fireball | Arrived at wave 3 at 26 hp from wave 2 Burnout blasts (75 dmg) |

## Highlights (what worked — keep these)
- The funny office flavour (memo on the title, "Not a culture fit", PROMOTED, OVERTIME PAY) is charming and makes sense without genre knowledge. [read]
- Weapons are unmistakably different on screen; wave banner, "WAVE n CLEAR" + "NEW EQUIPMENT ON THE RECEPTION DESK" teaches where new weapons are. [read] (shot: `noor-r1a.png`)
- Pickup messages (COFFEE +10, KEVLAR VEST, TONER LAUNCHER! [5]) tell you the key to press. [read]
- Wave breaks restock health/ammo as promised: wave 4 clear took me 27 -> 77 hp. [data]
- Score pops (+800, +894) feel rewarding. [read]

## Pain points (ranked, worst first)
1. **Burnout explosions hurt the player and nothing says so** — in all 3 runs Burnout blasts were the top damage source (114, 93, 75 dmg), often 3 hits within 1 s (34/28/24 at 1:04 in run 1). As a newcomer I assumed "kill them = good"; no on-screen text warned that killing them close is what hurts. Also surprising: "dead enemy hurts me". [data][read] · Severity: major
2. **Death screen does not explain the death** — "YOU'RE FIRED / Reason: Not a culture fit / Kills / Wave / Score". Funny but I get zero info on the cause; I could only reconstruct it from the harness. [read] · Severity: major
3. **Rank / score system is opaque** — rank jumps INTERN -> C-SUITE in seconds and falls back to INTERN; "PROMOTED: ASSOCIATE" can show while the rank label says INTERN; no hint it multiplies score or why it drops. Score went 4764 -> 25384 in one wave with unexplained "+6575". Run 2 scored 3110 vs 73683 with the same wave count. [read][data] · Severity: major
4. **Abbreviations and stray labels** — SHL / STP / TNR, "ARMS", "CELLS" and "SEVERANCE PAY" pop-ups, "TERMINATED" sitting permanently on the HUD (looks like a status), SYNERGY, VARIETY, AIRBORNE, MULTI-KILL with no explanation. Ammo "24 /50" does not say max. [read] · Severity: minor
5. **Low health is not obvious in time** — I repeatedly started waves at 20-27 hp (when-hurt pickups did not fetch the health during the break in run 1). A newcomer would not know health never regenerates. [data] · Severity: minor
6. **Out-of-ammo is silent in the HUD text** — in run 1 died with SHL 0 and TNR 0 on a weapon I had chosen; I would not have known to axe things for ammo. [read] · Severity: minor
7. **Title screen jargon** — "PAR 4:00", "CLASSIFIED LOCKED", "∞ NO CAP", "endless". Controls list is good and clear. [read] · Severity: polish

## Bugs & oddities
- `PT.ui()` shows "CLOCKING IN…" all session and the old wave text lingers (harness artefact per brief).
- Event "PROMOTED: MANAGER" fired at 0:16 while ui rank read ASSOCIATE; time in HUD lagged at wave clear (0:49 shown at 0:52). [data]
- Run 1 death shot (`noor-r1death.png`) shows an upside-down/tilted camera looking at the ceiling: I could not see the killer at all. [seen]
- Run 1: killsBy lists 22 Burnout, but "kills" in windows disagree with counts at points (stale HUD). minor.

## Recommendations (max 6, most impactful first)
| # | Change | Why | Expected effect | Effort |
|---|---|---|---|---|
| 1 | Death screen: show "Killed by: <source>" and top damage sources | PP2 | Players can learn from each death | S |
| 2 | First-time hint / enemy-intro line when Burnouts first appear ("BURNOUT: explodes. Shoot from range") and a visible blast radius/hiss ring | PP1 | Biggest damage cause becomes avoidable | S |
| 3 | Explain rank on HUD: show a meter and "SCORE x3" next to the rank, and a bonus list tooltip on first use | PP3 | Score becomes understandable | M |
| 4 | Spell out ammo labels (SHELLS/STAPLES/TONER) and show max; remove or label "TERMINATED" | PP4 | Less decoding | S |
| 5 | Low-health warning (red vignette/"LOW HEALTH") plus message "no regen, grab COFFEE" | PP5 | Fewer blind deaths | S |
| 6 | Short "SHOTGUN EMPTY - hit things with the axe for ammo" message | PP6 | Ammo economy taught | S |

## Domain deep-dive
**Words/numbers I did not understand (run 1 UI reads):** INTERN/ASSOCIATE/MANAGER/DIRECTOR/VP/C-SUITE (rank ladder, but what does it do?), 000000 big number (score), "+894" (last bonus? score gain?), "KILLS 6  0:21" (kills and time), "TERMINATED" static label, +VARIETY, +MULTI-KILL, +AIRBORNE, +SYNERGY, SHL/STP/TNR, "/50" /"/200" caps, ARMS 1-6, COFFEE +10, KEVLAR VEST, "CELLS", "SEVERANCE PAY", OVERTIME PAY +100 (is it money or score?), "PAR 4:00", "CLASSIFIED".

**What did the game teach me?** Move/fire controls (title), that new guns appear on the reception desk after a wave, that pickups give HP/armor, that waves come in numbered rounds. **What not:** that Burnouts explode and hurt me, how rank/score work, that health never regenerates, that the axe gives ammo, dash/stagger/termination.

**Can I explain my deaths?** Run 1: low on hp (21), no shells, one Compliance Officer left; its clipboard finished me. Harness: clipboard 27 was the last hit but Burnout explosions (114) and Middle Manager fireballs (52) did most of the damage. I got the proximate cause right and the underlying cause (Burnout blasts + low hp going in) wrong. Run 2: I saw hp 20 and a Burnout; harness: Burnout explosion 41 killed me, matches. Run 3: Middle Manager fireball 24 last hit, but 75 of 140 damage was Burnout blasts earlier that I would not have linked. **Death screen clear?** Looks great, informative: no.

**Did anything teach me something wrong?** "PROMOTED" messages made me think I was levelling up permanently; rank then falls. "TERMINATED" on the HUD looked like it meant me. "OVERTIME PAY" sounds like a currency I can spend.

**My understanding of the systems after run 3 (before DESIGN.md):** Waves of office demons; kill them for score; a rank meter multiplies score and fades if I stop killing; bonuses like multi-kill add points; Burnouts are fast and blow up (probably also me); shotgun/stapler are my starters, others appear on the desk; health/ammo restock between waves; I think the axe may matter (I never used it deliberately); no idea what dash/stagger/termination do.

**After reading DESIGN.md (read after run 3):** it confirms rank multiplies score (x(1+rank)), Burnouts hurt player (50 dmg, 3.5 m), axe kills drop ammo, Termination on staggered enemies, dash exists. I got ~5/10 of it right and got the key things (Burnout, axe ammo, dash, stagger, no regen) missing. Self-score: **4/10**.

## Harness caveats
Bot decides all aiming/movement, so my deaths reflect casual-bot play; I never saw the HUD visually (text only, may lag). Time in `PT.ui()` was stale at times. I did not judge audio. Stance changes between runs confound score comparisons.

## Findings (machine-readable)
```json
[
{"area":"ui","type":"issue","severity":"major","finding":"Death screen only says 'Not a culture fit' with kills/wave/score; no cause of death or damage sources","evidence":"PT.ui() after run 2 death","recommendation":"Add killed-by and top damage sources lines"},
{"area":"onboarding","type":"issue","severity":"major","finding":"Burnout self-damaging explosion is top damage source in all 3 runs and never explained","evidence":"damageTakenBy: 114/93/75 Burnout explosion","recommendation":"Intro hint, blast radius telegraph, a visible hiss tell"},
{"area":"scoring","type":"issue","severity":"major","finding":"Rank rises and falls rapidly and multiplies score with no explanation; run scores varied 73683 vs 3110","evidence":"rank INTERN->C-SUITE within 30s; PROMOTED events vs HUD rank mismatch","recommendation":"Show rank meter and multiplier, explain on first promotion"},
{"area":"ui","type":"issue","severity":"minor","finding":"Cryptic labels SHL/STP/TNR, static TERMINATED, CELLS, SEVERANCE PAY, SYNERGY","evidence":"PT.ui() reads","recommendation":"Full names, remove/label TERMINATED, tooltip bonuses"},
{"area":"readability","type":"issue","severity":"minor","finding":"Low health and empty ammo are not signalled in text; I entered waves at 20-27 hp","evidence":"waves hpStart/hpEnd, SHL 0 at death","recommendation":"Low-health warning and out-of-ammo message"},
{"area":"onboarding","type":"praise","severity":"polish","finding":"Funny office-memo flavour and clear controls list on title; new-equipment banner works","evidence":"title ui, WAVE 2 CLEAR banner","recommendation":"Keep"},
{"area":"visuals","type":"bug","severity":"polish","finding":"Death-moment camera looks at ceiling/tilted so killer not visible","evidence":"noor-r1death.png","recommendation":"Keep camera on killer or add kill-cam text"}
]
```
