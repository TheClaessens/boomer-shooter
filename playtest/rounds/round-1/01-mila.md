# Mila — cozy casual · playtest round 1
**Verdict (in character).** It looks great (the dithered pixel office, red-banded pillars, a starfield out the windows), and the first wave felt good: I was blasting managers and getting little popups like MULTI-KILL. Then wave 2 killed me three times in four runs, in seconds, to little exploding guys I could barely see, and the fourth time I killed myself with a toner drum. I wanted to unwind and instead got fired by a mystery explosion.
Fun: 5/10 · Would play again tomorrow: maybe · Domain score (feel/look/readability for a casual): 5/10

## Session log
| Run | Skill / tactics | Result (wave, time, score) | Killed by | Note |
|---|---|---|---|---|
| 1 | casual / deck, shotgun, pickups when-hurt | wave 2, 0:29, 1785 | Burnout explosion (103 in ~2 s: 27+34+31+...) | wave 1 clean (hp 88). 5 Burnouts alive at death |
| 2 | casual / island, stapler, pickups always | wave 2, 0:26, 5685 (best) | Burnout explosion (123 dmg, 36+33+26 in one second) | stapler racked up score fast; 6 Burnouts killed, still died |
| 3 | casual / floor, shotgun, threats-first | wave 2, 0:50, ~1810+ | Burnout explosion (102) | reached wave 2 at 100 hp, dead in ~5 s of Burnout contact |
| 4 | casual / mobile, axe, terminate | wave 1, 0:33, 3557 | Toner Drum explosion (73 in one hit, from hp ~73) | died on wave 1 to a barrel, not an enemy |
| J | [jumped] wave 8, deck, ssg | survived 32 s, hp 92 -> 18, no death | n/a | ~14 enemies alive at start |

## Highlights (what worked — keep these)
- The look: dither filter, red-ringed pillars, window onto a starfield, muzzle flash, blood decals all read as cool retro horror. [seen] (shots: `mila-r1-start.png`, `mila-r1-enemy.png`)
- Wave 1 is a gentle on-ramp: 5 enemies, 12 s, shotgun feels strong; style popups (MULTI-KILL, AIRBORNE, PROMOTED: ASSOCIATE, "SEVERANCE PAY") make me feel good with zero reading. [read][data]
- Office theme lands in the text and enemy names: "YOU'RE FIRED / Did not leverage core competencies", rank titles INTERN -> ASSOCIATE -> MANAGER, "Overtime pay +100". [read]
- The Middle Manager (suit, tie, purple eyes) is a readable, characterful silhouette. [seen] (shot: `mila-j-enemy2.png`)
- Death screen is clear and has a one-key retry. [read]

## Pain points (ranked, worst first)
1. **Burnouts delete you at wave 2 and you can't see them coming.** Every one of 3 normal-play deaths on wave 2 was Burnout explosions, 100+ damage in 1-3 s across 3-4 hits of ~30. In the screenshot a Burnout is a tiny dark figure with a small orange head in a dim room; nothing says "this thing will blow up, back away". For someone who plays to relax this feels like a trap, not a challenge. [data][seen] (shot: `mila-r3-burnouts.png`) · Severity: blocker
2. **Wave-2 difficulty spike.** Wave 1 (5 enemies) then wave 2 with 5-6 Burnouts plus interns: steepest jump in the game for the player who most needs a gentle ramp. [data] · major
3. **Toner Drum explosion hit for 73 in one hit and killed me on wave 1.** Nothing communicated barrels are that deadly to me; the death felt unfair. [data] · major
4. **Dark, murky arena.** Floor is near-black navy, enemies in shadow blend in; I mostly noticed things by their muzzle fire. [seen] · major
5. **Death-moment camera is unreadable.** Final shot is a wall of orange/beige dither with no sign of what killed me. [seen] (shot: `mila-r1-death.png`) · minor
6. **Late waves are visually noisy.** At wave 8 the huge red fire-pillar ring (Recruiter) fills the screen; fun to look at but I couldn't tell where safe ground was. [jumped][seen] (shot: `mila-j-enemy0.png`) · minor

## Bugs & oddities
- `PT.ui()` death screen still lists "CLOCKING IN…" (harness artefact per brief).
- Run 2 held the stapler on "stapler" preference yet scored 5685 by wave 2 vs 1785 with shotgun: stapler scoring seems much stronger early (one run, weak evidence). [data]
- [jumped] wave 8: HP dropped 92 -> 33 in 8 s to Recruiter fire pillar (33) + Burnout (21); never dropped to death in 32 s even at casual.

## Recommendations (max 6, most impactful first)
| # | Change | Why | Expected effect | Effort |
|---|---|---|---|---|
| 1 | Telegraph Burnouts: brighter/larger glow, a hiss or fuse flash, a visible blast-radius ring when armed | #1 | Casual players learn "run from the glowing guy" | S-M |
| 2 | Cap Burnouts on wave 2 (2-3), introduce them alone on wave 2 and add more from wave 4 | #2 | Gentler ramp, first loss feels earned | S |
| 3 | Lower per-hit Burnout damage or add a short i-frame/armor drop after a blast so 3 hits cannot take 100 in 1 s | #1 | Survives one mistake | S |
| 4 | Make barrels visibly red/flashing and cut self-damage (or warn before player-fire detonates one at close range) | #3 | No cheap early death | S |
| 5 | Lift floor/ambient light a little, rim-light enemies | #4 | Readable fights | M |
| 6 | Death cam: lock view on killer or show "KILLED BY: Burnout" prominently | #5 | Learning from death | S |

## Domain deep-dive
- **Would I come back tomorrow?** Maybe. The look and wave 1 hook me; the wave-2 wall makes me bounce unless I can read it.
- **Best moment:** wave 1 shotgun multi-kill with "MULTI-KILL" and "AIRBORNE" popups, then promoted to ASSOCIATE. [read]
- **Bored or annoyed:** annoyed on wave 2 (three times) and at the barrel death. Not bored.
- **Unfair death?** Yes: the barrel (run 4) and the Burnout chain (runs 1-3) because I got no readable warning. [inferred]
- **Theme land?** Yes: memo intro, rank titles, "Mandatory overtime", FIRED screen, enemy names (Middle Manager, Intern, Printer). Strong. [read]

## Harness caveats
Casual bot has loose aim and slow reactions, so wave-2 deaths may overstate difficulty for a human; Burnout deaths came from the bot staying in close range. Island/floor/deck stances differ in how the bot holds position, not in my choices. The jump run is [jumped] only and no difficulty claims are made. I did not see new-weapon drops or the island (died before wave 2 cleared); shots lack HUD.

## Findings (machine-readable)
```json
[
{"area":"enemies","type":"issue","severity":"blocker","finding":"Burnout explosions kill casual players on wave 2 in 1-3 s (3 of 3 normal wave-2 deaths) with no readable warning","evidence":"dmgBy Burnout explosion 103/123/102; shot mila-r3-burnouts.png shows tiny dark figure","recommendation":"Telegraph blast (glow, fuse sound, radius ring); lower burst damage; fewer on wave 2"},
{"area":"balance","type":"issue","severity":"major","finding":"Wave 1 to 2 difficulty spike","evidence":"wave 1 cleared at hp 88-100 in 12-17 s; wave 2 killed in 26-50 s","recommendation":"Gradual Burnout introduction"},
{"area":"combat","type":"issue","severity":"major","finding":"Toner Drum explosion deals 73 in one hit and killed a wave-1 run","evidence":"run 4: 'hit for 73 by Toner Drum explosion (hp 0)'","recommendation":"Make barrels clearly dangerous or reduce damage on early waves"},
{"area":"readability","type":"issue","severity":"major","finding":"Arena floor and shadowed enemies are hard to see","evidence":"mila-r3-burnouts.png, mila-r1-enemy.png","recommendation":"Brighten ambient light / rim-light enemies"},
{"area":"readability","type":"issue","severity":"minor","finding":"Death view shows nothing about the killer","evidence":"mila-r1-death.png","recommendation":"Killcam or killer name on the fired screen"},
{"area":"visuals","type":"praise","severity":"polish","finding":"Dithered pixel look, starfield windows, red-banded pillars, muzzle flash are cool","evidence":"mila-r1-start.png, mila-r1-enemy.png","recommendation":"Keep"},
{"area":"scoring","type":"praise","severity":"polish","finding":"Style popups and rank promotions feel rewarding with no reading","evidence":"MULTI-KILL, AIRBORNE, PROMOTED: ASSOCIATE","recommendation":"Keep"}
]
```
