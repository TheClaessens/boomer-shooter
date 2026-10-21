# Viktor — hardcore tactician · playtest round 1
**Verdict.** The sim is solid and the weapon roster has readable jobs, but I found a run-ending freeze that only shows up when Termination is on, and the "mobile + stapler, no Termination" plan is so safe that it makes the risk/reward layer optional. Stance matters a lot (floor/mobile >> island/deck), but I found no reason to pick the axe-rush plan the design pushes. Fun: 6/10 · Would play again tomorrow: maybe · Domain score: 5/10

## Session log
| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |
|---|---|---|---|---|
| 1 | expert, deck + prefer launcher, threats-first, terminate | w18, 13:12 (froze), 1,500,751 | no death: sim froze | Bot swapped weapons constantly (launcher held only part of the time). One Compliance Officer took ~60 s to kill at wave 6. Froze at 13:12, abandoned. |
| 2 | expert, floor + ssg, pickups always, terminate | w13, ~6:30 (froze), 682,893 | no death: sim froze | Fastest clears of all plans (w9 at 3:10; run 1 reached w9 at 5:04). Froze mid-wave 13. |
| 3 | expert, mobile + stapler, weakest, terminate **off** | w24+, 17:03, 3.8M, still alive at 17 min | alive (abandoned) | hp never under 55. No freeze. Brutes stacked up (8 alive at w17) but were not a threat. |
| 4 | expert, island + laser (off-meta), biggest, terminate off | w5, 1:55, 59,144 | Floating Printer ink blob (after burnouts/clipboards) | All ammo at 0 and holding the axe when I died. |
| B1 | 4x floor+ssg terminate ON | w10 / w13* / w11* / w21 (*=1500 s cap) | Burnout x2, 2 frozen | 2 of 4 hit the 1500 s cap |
| B2 | 4x floor+ssg terminate OFF | w14 / w9 / w21 / w15, 0 capped | Drum, Clipboard, Sysadmin x2 | |
| B3 | 3x each stance, terminate off | deck: w2*, w20*, w9* (3 of 3 capped); mobile+stapler: w15, w13, w22; island+laser: w8, w9, w6; mobile+axe: w2, w1, w2 | see below | |

## Highlights (what worked — keep these)
- Waves 1-5 are paced well: clears in 9-30 s, hp stays near full, weapon drops arrive on schedule (launcher after w2, SSG after w4, laser after w6). [data]
- Floor brawler with SSG is the most satisfying power curve: rank sat at C-SUITE, hp never under 58 until w11. [data]
- Burnout, Sysadmin and Recruiter are the real teachers: they dominate the damage tables in every plan, so the "one lesson per enemy" pillar holds. [data]
- Score scale is generous and rank-multiplied: millions by w20, so there is a lot of headroom to chase. [data]

## Pain points (ranked, worst first)
1. **Sim freeze after a Termination (possible hit-stop stuck).** Runs 1 and 2 both froze for good: the clock kept ticking but nothing else changed (same hp, score, kills, enemies alive and not attacking, ammo frozen) for 60+ s, and I could not unstick it by changing stance or turning terminate off. The HUD text still showed "TERMINATED" last. Batch with terminate ON: 2 of 4 runs hit the 1500 s cap at w11/w13; terminate OFF: 0 of 4. Hand runs: terminate ON 2/2 froze, terminate OFF 0/2. I could not tell whether it is the game or the fast-forward harness (hit-stop on real time vs sim time). [data] · Severity: blocker if real, otherwise harness only
2. **Burnout blast is the top damage source for every plan.** Burnout explosion was the top damage source in nearly every batch row and the killer in 5 of 12 rows with a recorded killer. It is the one enemy you can't out-position at expert level. [data] · Severity: major
3. **Dominant strategy exists: mobile + stapler, no Termination.** hp never below 55 for 17 minutes, w24 and still climbing. The risk/reward layer (Termination, aggression) adds nothing for this player. Floor+ssg with terminate ON actually did worse than OFF (two freezes aside, 342k and 450k scores vs 296k-2.2M, noisy). [data] · Severity: major
4. **Stances are not equal.** Island+laser dies w6-9 (3/3), mobile+axe dies w1-2, deck stalls (3/3 batch runs hit the 1500 s cap, one at wave 2). The plan choice is not a choice. [data] · Severity: major
5. **Compliance Officer stalls the wave.** On the deck, one Officer survived about 60 game seconds and rank decayed to INTERN while hp sat at 52. A shield that eats a minute of a run is boring, not hard. [data] · Severity: minor
6. **Ammo starvation outside the axe loop.** Run 4 died at 0 shells, 0 staples, 0 toner holding the axe. Weapons with no refill (laser, launcher) cannot be a plan. [data] · Severity: minor
7. **Bot ignored "prefer".** `prefer: launcher` / `laser` still swapped weapons constantly, so I couldn't honestly test "launcher deck camper" or "laser late". [data] · Severity: harness

## Bugs & oddities
- Freeze: see pain point 1. Repro: expert bot with `terminate: true`, endless mode, play 60 s chunks past ~6 min; `PT.state().time` advances but everything else is constant. Run 1 froze at 13:12 (w18), run 2 at about 6:30 (w13).
- Damage source "unknown" appears in event logs (about 7 to 45 hp per chunk in runs 3 and 4). Probably a missing label on one source.
- `PT.ui()` shows "TERMINATED" and "CLOCKING IN…" permanently (harness artefact, noted in brief).
- Wave 9 to 10 clears at identical timestamps in run 1 (5:04) while the wave counter went up: very short breaks may swallow the "WAVE n CLEAR" stop.

## Recommendations (max 6, most impactful first)
| # | Change | Why | Expected effect | Effort |
|---|---|---|---|---|
| 1 | Check Termination hit-stop / state for a stuck path (test with real time vs fast-forward) | Pain 1 | Removes a possible run-ending hang | S-M |
| 2 | Give Burnouts a longer hiss tell, or a fixed first-death radius shown on the floor | Pain 2 | Fewer unreadable deaths; skill matters | S |
| 3 | Make Termination worth it (heal or ammo bigger, or rank decay slowed) and make non-axe play pay less | Pain 3 | Aggression becomes the optimal plan | M |
| 4 | Add reasons to use island, deck and laser (e.g. high-ground bonus, laser ammo drops) | Pain 4, 6 | More plans viable | M |
| 5 | After about 30 s on a lone shielded enemy, let it turn or flinch more | Pain 5 | Shorter stalls | S |
| 6 | Label "unknown" damage | Oddities | Better data | S |

## Domain deep-dive
- **Does each weapon have one clear job?** Axe (finisher/ammo) and SSG (close burst) read clearly. Shotgun vs SSG overlaps a lot; stapler (sustained) is used as a default by the bot. Launcher and laser were swapped in situationally, I could not isolate them (harness). [inferred]
- **Do stance/target choices change the outcome?** Yes, strongly, but in only one direction: floor/mobile good, deck/island bad. [data]
- **Dominant strategy?** Mobile + stapler (no terminate) is safest; floor + SSG is faster for score. [data]
- **Do risk/reward systems pull me to aggression?** Not in this harness: terminate ON did not beat OFF, and the freeze makes it worse. Dash kills and style bonuses (AIRBORNE, MULTI-KILL) appeared early but I could not tell their value. [data/inferred]
- **20 hours?** Rank-multiplied score (millions) and varied waves would keep me; what's missing is a reason to try other plans and a clear payoff for the axe.

## Harness caveats
- Freeze may be harness-only (fast-forward vs hit-stop). Bot hands ignore `prefer`. Deck stance stalls look like bot behaviour. Hand runs are n=1 each; the batches are n=3-4 per plan and noisy (w6-w22 spread). Island/laser and mobile/axe are off-meta so the bot's crude laser use may be the cause. No jump runs.

## Findings (machine-readable)
```json
[{"area":"bug","type":"bug","severity":"blocker","finding":"Sim freezes (clock runs, everything else frozen) in runs with terminate ON","evidence":"hand runs 2/2 froze at 13:12 and ~6:30; batch terminate ON 2/4 capped at 1500 s vs OFF 0/4","recommendation":"Check Termination hit-stop and state path for a stuck timer"},
{"area":"balance","type":"issue","severity":"major","finding":"Burnout explosion is top damage source for most plans","evidence":"batch rows topDmg, ledger run 1: 149 and killer in 5 of 12 rows","recommendation":"Longer or clearer tell, or telegraph radius"},
{"area":"balance","type":"issue","severity":"major","finding":"Mobile + stapler without Termination is dominant and safe","evidence":"run 3: w24 at 17 min, hp never < 55","recommendation":"Make aggression and Termination pay more"},
{"area":"balance","type":"issue","severity":"major","finding":"Island, deck and axe-only stances are non-viable","evidence":"batch: island+laser w6-9, mobile+axe w1-2, deck 3/3 capped","recommendation":"Add stance-specific upsides"},
{"area":"enemies","type":"issue","severity":"minor","finding":"A lone Compliance Officer stalled a wave about 60 s","evidence":"run 1, w6 2:26-3:35","recommendation":"Make the shield turn or flinch more"},
{"area":"bug","type":"bug","severity":"polish","finding":"Damage source 'unknown' appears in logs","evidence":"runs 3 and 4 event windows","recommendation":"Label the source"}]
```
