# Rhea — challenge seeker · playtest round 1
**Verdict (in character).** Most deaths I can trace to a visible tell (laser line, hiss, ring), which is what I want. But at wave 18+ the same cheap damage sources stack: Burnout chains plus Toner Drum explosions delete 60–90 hp in one second, and the blast whiteout means I can't read anything. The Sysadmin laser is the best-telegraphed attack in the game and still the number-one killer, purely on count. Fun 7/10 · Would play again tomorrow: yes · Domain score 6/10

## Session log
| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |
|---|---|---|---|---|
| 1 | expert, mobile, nearest, when-hurt, terminate | W32, 25:02, 7,176,259 | Sysadmin sniper (3 hits in 2 s while at 36 hp) | Far above the calibration median (~21). Taken: Sysadmin 1400, Burnout 1310, Brute 741. Chain: toner drum 55 + Burnouts 24/23/44 within 10 s. |
| 2 | expert, mobile, **threats-first** | W20, 10:40, 1,769,491 | Burnout explosion | Taken: Burnout 328, Printer ink 184, Brute 133, Compliance 220. Recruiter pillars 25+25 then Burnout 29, then Burnout 40. |
| 3 | expert, deck, nearest, pickups always | W4, 2:43, 22,345 | Compliance clipboard | Chip-killed on wave 4 (clipboard 102 + bash 40). Re-run of same tactics reached W9+ (abandoned), so high variance. |
| 4 [jumped] | wave 18 start, threats-first | W20, 1:45, 432,420 | Burnout explosion | At 0:10 already hp 70 -> 47 -> 17 (Brute 25, "unknown" 35, Toner Drum 44). Content view only. |

## Highlights (what worked — keep these)
- Sysadmin laser tell is a thin saturated red line that tracks you and is the only red line on screen; very legible against the room. [seen] (shot: `rhea-r1-lowhp-w18.png`)
- Sysadmin 25 dmg per shot is a fair, learnable cost; on expert it was ~17 dmg average per 15 s chunk even with 3–5 on the field. [data]
- Burnout hiss + 50 dmg blast is a fine "kill at range" puzzle in isolation; early waves (2–10) felt fair. [data]
- Style/rank stacking gives strong score feedback (C-SUITE, millions). [data]
- Armor and health restock between waves keep a mistake survivable, so each death is mostly attributable to a decision. [data]

## Pain points (ranked, worst first)
1. **Explosion chains (Burnout + Toner Drum) are the real killer and unreadable late.** Runs 1, 2, 4 all ended or collapsed via 3–4 blasts in 1–3 s (e.g. 24:51 drum 55, then Burnout 24+23+44). The jumped shot is a full-screen cream/pink whiteout; I can't see the next hiss. Drums are placed by the level and look like harmless props to me, and a Burnout dying next to a drum is invisible chaining. [data][seen] · Severity: major
2. **Burnout packs scale up faster than the counter.** 5–6 Burnouts alive simultaneously from ~W17; they cost 1 point each so the budget fills with them. Killing one at range still blasts everything within 3.5 m including other Burnouts, so a pack becomes one big chain I can't dodge once it starts. [data] · Severity: major
3. **Visual noise in late waves hides tells.** Pickups, gore, red pillar bands (similar red to the laser/ring colour), fire/muzzle flash and 20+ enemies on screen; in `rhea-r2-low1.png` I could not find the Recruiter ring or any laser at hp 22. The "only red lines are Sysadmin tells" rule is weakened by red pillar stripes and a red weapon model. [seen] · Severity: major
4. **Sysadmin stacking at 3–5 with overlapping lasers.** Three shots 25 each inside 2 s killed run 1 from 36. Cap of 1 + n/6 gives 6 by W30; two or three lasers tracking at once cannot all be broken from LOS. [data] · Severity: major (fair-feeling in isolation, unfair when stacked)
5. **Wave-4 Compliance Officer chip damage.** Clipboards are 10 dmg thrown and fast; run 3 lost 102 hp to them at 2:43 on wave 4 on deck stance. The shield blocks the bullets I'd use to kill it; it reads as a damage sponge that hits at range. [data] · Severity: minor/major (early, new player)
6. **Mailroom Brute charge.** 25 dmg charge/punch was a repeated mid-size hit (741 in run 1) and often landed in the same second as another source (9:50: Brute 25, Burnout 28, drum 64). The tell was not visible in any shot I got. [data][inferred] · Severity: minor
7. **Recruiter pillar tell is hard to read when surrounded.** Pillar hits (25) landed back to back at 10:31 and 10:34 in run 2; the ring is red on a red-grey floor. [data][inferred] · Severity: minor
8. **Jumped W18 opening has no grace.** A burst of 5 Burnouts, 4 Brutes and 3 Recruiters at time 0:10 took 53 hp in a second. Not a difficulty claim, but there is no ramp in the first 10 s. [jumped] · Severity: polish

## Bugs & oddities
- Damage source "unknown" (35 dmg at W18 jumped start; 6.7/29 elsewhere). Source attribution gap, probably a mid-chain explosion.
- Run variance: same deck/always tactics died on wave 4 once and survived to W9+ a second time. Tactical stance is a strong factor but also luck.
- The harness bot sat at ~100 hp at every wave start in run 1 (hpEnd 100 for W20–31), so restock appears generous.

## Recommendations (max 6, most impactful first)
| # | Change | Why (which pain point) | Expected effect | Effort |
|---|---|---|---|---|
| 1 | Make Burnout blasts not chain onto other Burnouts / Toner Drums (or reduce chained damage to 50%); mark drums visibly | 1, 2 | Late deaths come from a mistake, not a domino | S |
| 2 | Cap Burnouts alive (e.g. 3) and give them a spawn cue before they close in | 2 | Packs stay a puzzle | S |
| 3 | Reduce late-wave visual noise: shorter gore/pickup lifetime, dim pillar red bands, brighter/pulsing red tells | 3 | Tells stay readable at W20+ | M |
| 4 | Stagger Sysadmin shots (global cooldown across Sysadmins, e.g. only one lasering at a time) | 4 | Stacked snipers feel fair | S |
| 5 | Soften Compliance clipboard (damage or rate) for W4–6 or give a clearer windup | 5 | Early deaths feel fair | S |
| 6 | Spawn ramp for first 5 s of a wave (Brute/Recruiter delayed) | 8 | No instant burst | S |

## Domain deep-dive
- **Which deaths were fair?** Run 1 death: three Sysadmin shots in 2 s at 36 hp after a chain; the shots were fair (laser visible), the chain before them wasn't. Run 3 (Compliance clipboard, W4): fair in principle, chip damage I could have dodged. Run 2 and jumped: Burnout chains, borderline unfair.
- **Unreadable/undodgeable:** Burnout chain explosions (none of the three blasts had a separate tell I could use in a 1 s window); toner drum explosion (34–64 dmg, no tell); Recruiter ring when surrounded.
- **Telegraphs I judged:** Sysadmin laser: excellent. Burnout hiss: good in isolation, not in packs. Recruiter ring: readable in a quiet room, not in a crowd. Brute charge: no usable tell in my shots. Compliance shield: spark/ping per DESIGN; the shield bash is the 20 dmg hit, clipboard is chip.
- **Where scaling turns unfair:** around W17–20, where Burnouts 5–6 + 3 Sysadmins + 4–5 Brutes coexist. Before W15 harder; after W20 the damage per second from chains outpaces restock. Run 1 still reached W32, so skilled play survives, but the end is always chains.
- **Does skill matter?** Yes: threats-first vs nearest was not conclusive (n=1 each), but expert reached W32 vs a novice-style deck run at W4. Dash timing wasn't directly testable. Target priority (Sysadmin first) shows in damage tables: Sysadmin share fell from 1400 (nearest) to 83 (threats-first), though Burnout damage rose (328 in 10 min).

## Harness caveats
- I could only screenshot at the lowHp stop, which is after the hit chain started; I never saw a pre-hit frame of a Brute charge. One Compliance death was not reproduced, so there's no screenshot for it.
- Bot cannot jump-dodge or rocket-jump; the extreme end ([jumped] W18) says nothing about difficulty.
- Run 1 ran to death without lowHp stops after W18 (I overshot), so wave 18–32 per-hit judgments come from the event log, not screenshots.

## Findings (machine-readable)
```json
[
{"area":"balance","type":"issue","severity":"major","finding":"Burnout explosions and Toner Drum blasts chain, killing from 60-100 hp in 1-3 s in late waves","evidence":"Run 1 24:51-24:59: drum 55 + Burnouts 24/23/44; run 4 0:10 Brute 25 + unknown 35 + drum 44","recommendation":"Stop blasts chaining or halve chained damage; make drums read as hazards"},
{"area":"enemies","type":"issue","severity":"major","finding":"5-6 Burnouts alive at once from ~W17 turn a kill-at-range puzzle into a chain you cannot dodge","evidence":"alive counts at W17 and W18; Burnout damage 1310 in run 1, killer in runs 2 and 4","recommendation":"Cap concurrent Burnouts and cue their spawn"},
{"area":"readability","type":"issue","severity":"major","finding":"Late-wave screen noise and blast whiteout hide tells; red pillar bands dilute the red-is-danger rule","evidence":"shots rhea-r2-low1.png, rhea-r4-j18.png","recommendation":"Reduce pickup/gore clutter, retint pillar bands, shorten blast flash"},
{"area":"enemies","type":"issue","severity":"major","finding":"Several Sysadmins overlap lasers; 3 shots in 2 s killed run 1 from 36 hp","evidence":"25:01-25:02 events","recommendation":"Global Sysadmin shot cooldown"},
{"area":"enemies","type":"praise","severity":"polish","finding":"Sysadmin red laser tell is clear, tracks, and is the only red line; fair at 25 dmg","evidence":"rhea-r1-lowhp-w18.png","recommendation":"Keep as is"},
{"area":"balance","type":"issue","severity":"minor","finding":"Compliance clipboard chip damage killed a wave-4 run (102 clipboard + 40 bash)","evidence":"Run 3 death at 2:43","recommendation":"Soften clipboard rate/damage early"},
{"area":"bug","type":"bug","severity":"polish","finding":"Some damage is attributed to 'unknown'","evidence":"35 dmg at jumped W18 0:10; 6.7 at W6","recommendation":"Attribute chained explosions to their source"}
]
```
