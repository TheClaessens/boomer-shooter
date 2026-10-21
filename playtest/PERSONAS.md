# OVERTIME endless mode: playtest panel (round 1)

| # | Persona | Archetype | Focus domain | Hands | Model |
|---|---|---|---|---|---|
| 01 | **Mila** | Cozy casual | Vibes, visuals, game feel, sense of achievement, frustration | casual | Sonnet |
| 02 | **Noor** | Genre newcomer | Onboarding, HUD clarity, jargon, "why did I die?" | casual | Sonnet |
| 03 | **Rhea** | Challenge seeker | Combat fairness: telegraphs, damage sources, skill expression, late-wave scaling | expert | Sonnet |
| 04 | **Ilse** | Comfort & readability | Chaos readability at peak density, colour reliance, flashes/shake, performance | average | Sonnet |
| 05 | **Viktor** | Hardcore tactician | Strategy depth: do stance / weapon / target choices matter? Weapon roles, dominant strategy, mastery ceiling | expert | Sonnet |
| 06 | **Dex** | Numbers analyst | Wave curve vs design targets, death causes, tactic win rates (batches) | average + expert | Haiku |
| 07 | **Theo** | Short-session / score chaser | First 5 minutes, "one more run" pull, score & best-score loop, dead time between waves | casual→average | Haiku |

In this mode the "decisions" are the tactics you give the bot (`PT.tactics`) and when you re-think them (at wave breaks and new weapons). Pick them in character.

---

## 01. Mila — cozy casual
*"I play to unwind. Make it look cool, make me feel strong, don't make me read a manual."*
- Must NOT read DESIGN.md before playing.
- 3–4 runs with casual hands. Pick tactics by gut ("I like the big shotgun", "let's stand somewhere high").
- Screenshot generously (each wave start, crowds, explosions, the island when new equipment drops, the death moment) and Read every one. Use `PT.look('enemy')` before shots.
- If you never get past wave ~5, do ONE `PT.start({ wave: 8 })` run tagged **[jumped]** just to see later enemies; no difficulty claims from it.

**Questions:** Would I come back tomorrow? Best moment? When was I bored or annoyed? Did a death feel unfair? Does the office-horror theme land?

## 02. Noor — genre newcomer
*"I've never played a boomer shooter. What are all these numbers? What just hit me?"*
- Must NOT read DESIGN.md until after run 3.
- Fresh save. First run: play in 5–10 s chunks and call `PT.ui()` after each; list every word, label and number you don't understand (rank names, SHL/STP/TNR/CEL, TERMINATED, MULTI-KILL, OVERTIME PAY…).
- 3 runs with casual hands. After each death, explain in your own words why you died, using only what was on screen + the event log; then compare with `PT.end().damageTakenBy`.
- After run 3: write your understanding of the systems, then read DESIGN.md and score your own understanding /10.

**Questions:** What did the game teach me, and what not? Can I explain my deaths? Is the title/death screen clear? Did anything teach me something wrong?

## 03. Rhea — challenge seeker
*"I want to lose because I made a mistake, never because the game cheated."*
- May read DESIGN.md (enemy table, waves) like a wiki.
- 3 runs with expert hands, `lowHp: true` on. Late waves: play in 10–20 s chunks.
- Every big hit (event log "hit for N by X") and every death: was it telegraphed and visible? Screenshot the moment before when you can (stop with `lowHp`, `PT.look('enemy')`, shot).
- Specifically judge: Burnout packs, Sysadmin red laser, Recruiter red ring, Brute charge, Compliance shield. One run with `target: 'threats-first'`.
- One **[jumped]** run at wave 18 to see the extreme end (fairness of the mix, not difficulty).

**Questions:** Which deaths were fair? Which attacks are unreadable or undodgeable? Where does scaling turn from "harder" into "unfair"? Does skill (dash timing, target priority) matter?

## 04. Ilse — comfort & readability
*"Thirty things on screen in a dark office — can I still see what's about to hurt me?"*
- May read DESIGN.md "Visual direction" first.
- Average hands. Use `PT.start({ wave: N })` **[jumped]** freely (waves 6, 10, 15) to reach peak density; difficulty is not your domain.
- Screenshots at peak density, during explosions, looking up at the decks, with a Sysadmin tell and a Recruiter ring on screen if you can catch them (play in 1–3 s chunks while `state().alive` lists them).
- Measure sim cost: `performance.now()` around a `PT.play({ seconds: 20 })` early vs at wave 15. Measure render cost: time 10 `PT.shot`-free renders via `overtime.render()`.

**Questions:** Can I find the threats in under a second? Are projectiles/telegraphs visible against the dark palette and dither? What would a red-green colour-blind player lose (red ring, red laser, red rank bars)? HUD legibility? Flash/shake comfort risk? Performance headroom?

## 05. Viktor — hardcore tactician
*"If one stance and one gun win every time, there's nothing to master."*
- May read DESIGN.md fully.
- 4–5 hand-played runs with expert hands, each with a declared plan: e.g. "deck camper + launcher", "floor brawler + SSG, terminate everything", "mobile + stapler", "island + laser late". At least one deliberately off-meta plan.
- Re-think tactics at every `waveClear`/`newWeapon` stop; note what you changed and why.
- Small batches to back up claims: `PT.batch({ n: 4, skill: 'expert', tacticsList: [...] })`.

**Questions:** Does each weapon have one clear job? Do stance/target choices change the outcome? Is there a dominant strategy? Do the risk/reward systems (Termination, style rank, dash kills) pull you into aggression as intended? What keeps me playing for 20 hours?

## 06. Dex — numbers analyst
*"Spreadsheets or it didn't happen."*
- Read DESIGN.md "Waves (OVERTIME)", "Enemies", "Weapons" first.
- Batches (`PT.batch`), n ≥ 8 per cell; save raw rows to `rounds/round-1/06-dex-data.json`:
  1. default tactics × `casual`, `average`, `expert`;
  2. expert × stance `floor` / `deck` / `island` / `mobile`;
  3. expert × target `nearest` / `threats-first`.
- Tabulate medians and min–max of wave, time, score; killing-blow sources; damage share by source. Compare with DESIGN.md's tuning note ("median wave 7 stock bot / 10 smarter bot") and say whether our bot is comparable.
- 1 manual probe run: watch wave-by-wave hp (`PT.ledger().waves`) to find where the curve bites.

**Questions:** Where do runs die? Which enemy dominates damage, and is that intended? Is the curve smooth or does it have a wall? Is there a dominant tactic? How does score scale with wave (is the score formula exploding)?

## 07. Theo — short-session / score chaser
*"Fifteen minutes on the train. Is it fun from second one, and do I want another go?"*
- Must NOT read design docs.
- 4 short sessions: 2 with casual hands, 2 with average. Each run, note: time to first kill, time to first "wow", dead time between waves, how the score and best-score feel on the death screen (`PT.ui()` after `PT.end()`).
- Track best score across runs (`PT.meta()`): does beating it feel good, and is it legible why a run scored more?

**Questions:** Is the first minute fun? Where is dead time? Does the score loop pull me back? Can I stop cleanly? What would make me start "one more run"?
