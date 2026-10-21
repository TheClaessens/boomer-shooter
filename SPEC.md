> **Superseded by [DESIGN.md](DESIGN.md) (v0.2).** Kept as the v0.1 history.

# OVERTIME — v0.1 Game Design Spec

A boomer shooter set in a 1990s office tower where demons came in through the server room.
Built in HTML5 (Three.js / WebGL). Source research: [Boomer Shooters: What Made Them Fun](https://claude.ai/artifact/8QYkbxAjq89RP8FL2oEM9L).

## Pillars

1. **Speed is the core verb.** No reloads, no aim-down-sights, fast enough to dodge projectiles on foot.
2. **Every weapon has one job. Every enemy teaches one skill.**
3. **The level is a puzzle you run through.** It loops, has a key that hints at its door, and hides secrets.
4. **Health comes from pickups and style, never regeneration.**
5. **Feedback sells every hit.**
6. **One hook: the style meter.** Aggression keeps you alive; camping starves you.

**Done when:** a playtester replays the level unprompted.

## Scope (v0.1)

| Area | Target |
| --- | --- |
| Level | 1 looping level, about 5 minutes |
| Weapons | 3: fire axe, pump shotgun, toner launcher |
| Enemies | 4 types, monster infighting on, no boss |
| Secrets | 3 |
| Difficulty | 1 setting |
| Out of scope | Story, cutscenes, progression, saves, menus beyond start/pause/score |

## Player and movement (Quake-lite)

- Very fast run (about 2.5× a modern shooter's walk), jump, strong air control, full mouselook.
- No fall damage. Diagonal strafing and bunny-hopping work but are never explained.
- Rocket jumping off the toner launcher costs health and opens shortcuts and a secret.
- 100 health, 0–100 armor. Armor absorbs a third of incoming damage.
- Doors open on touch. No use key.

## Controls

| Action | Input |
| --- | --- |
| Move | WASD |
| Look | Mouse |
| Jump | Space |
| Fire | Left mouse |
| Weapons | 1 axe, 2 shotgun, 3 launcher, mouse wheel to cycle |
| Restart level | R (instantly, also on death) |
| Pixel filter toggle | P |
| Pause | Esc |

## Weapons

| # | Weapon | Job | Behaviour | Ammo |
| --- | --- | --- | --- | --- |
| 1 | **Fire axe** (from the glass emergency box) | Finisher / style | Short-range swing, one-shots Interns, big style bonus on a kill | None |
| 2 | **Pump shotgun** (security desk) | The heart | 7 hitscan pellets, slow pump, heavy *ka-chunk*, one-shots Managers up close | Shells, start 24, max 50 |
| 3 | **Toner launcher** (server room) | Crowds, rocket jumps | Lobbed exploding cartridges with splash that also hurts you | Toner, max 20 |

You start with the axe and shotgun. The launcher is held back until mid-level.

## Enemies

| Enemy | Doom role | Behaviour | Forces you to |
| --- | --- | --- | --- |
| **Possessed Intern** | Zombieman | Weak, hitscan pistol with a short tell | Never stand still |
| **Middle Manager** | Imp | Throws slow flaming staplers | Strafe |
| **Mailroom Brute** | Pinky | Tanky, charges you, melee only | Back off or funnel them |
| **Floating Printer** | Cacodemon | Flies, spits ink blobs that splash | Look up |

- **Infighting:** an enemy damaged by another enemy turns on it until one of them dies.
- Enemies sleep until they see or hear you (gunfire wakes nearby rooms).
- Roughly 40 enemies in the level.

## Style meter (the hook)

- **Ranks (corporate ladder):** Intern → Associate → Manager → Director → VP → **C-SUITE**.
- **Gains:** every kill, plus bonuses for:
  - a different weapon than the last kill
  - a kill while airborne
  - a multi-kill (2+ within 1 second)
  - a kill by infighting
  - an axe kill
- **Losses:** constant decay, a big drop when you take damage, and diminishing points for repeating the same weapon.
- **The twist:** from **Manager** up, kills drop small health pickups. From **VP** up, they also drop armor shards.
- The rank shows on the HUD with a fill bar. Rank-up gets a flash and a sting.

## Level: the tower

```
             [CEO FLOOR — final arena + exit]
                        ▲ (red-badge elevator)
 [LOBBY ATRIUM — hub, CEO glass office visible above] ◄──── red-badge door (loop back)
        │                                                  ▲
        ▼                                                  │
 [OPEN-PLAN CUBICLE FLOOR] ──────────► [SERVER ROOM: launcher + red keycard]
```

1. **Lobby atrium (hub):** tall, bright. The CEO's glass office hangs high above from the first second. Security desk with the shotgun, emergency box with the axe.
2. **Cubicle floor:** cramped, dim maze. Interns and Managers ambush you from the partitions.
3. **Server room:** cold blue light and racks. Pick up the toner launcher, then the **red keycard**, which sets off an ambush (Brutes and Printers).
4. **Red-badge door** leads back into the lobby by a new route (the loop), then up to the **CEO floor**.
5. **CEO floor:** an open arena that mixes all four enemy types. Exit door behind the CEO's desk.

The red door is visible from the start and is painted with a red stripe, so the keycard hints at its door.

**Secrets (3):**
1. An air vent behind a vending machine in the lobby.
2. A ledge high in the atrium, reachable only by rocket jump.
3. A supply closet behind a cubicle wall that looks slightly different.

Secrets hold armor, ammo, or a health mega-pickup ("Espresso").

**Lighting rules:** light/dark and cramped/open contrast at every transition, plus a landmark per area (atrium column, server racks, CEO desk).

## Pickups

| Pickup | Effect |
| --- | --- |
| Coffee cup | +10 health (max 100) |
| Donut box | +25 health (max 100) |
| Espresso (secret) | +100 health, up to 200 |
| Kevlar vest | +50 armor |
| Armor shard (style drop) | +5 armor |
| Shell box | +8 shells |
| Toner pack | +4 toner |

## Feedback and juice

- Hits: blood/ink particles, a hit flash on the enemy, a short screen shake on big hits.
- Overkill or explosion: gibs.
- Taking damage: red screen flash plus a directional tint.
- HUD: health, armor, ammo, style rank, and an **ID-badge photo** that gets bloodier as health drops (the Doom face).
- Weapons: punchy synthesized sound, muzzle flash that briefly lights the room, viewmodel kick.

## Audio

- **Adaptive music:** calm elevator muzak at Intern, layering in distortion and drums with each rank, full industrial metal at C-SUITE.
- Each enemy has a distinct sight sound and attack tell.

## Death and restart

- On death: brief freeze, then press R (or click) to restart the whole level instantly. No checkpoints, no saves.

## Score screen: "Performance Review"

Shown at the exit:

- Kills: x / total (%)
- Secrets: x / 3
- Time vs. par (par 4:00)
- Peak style rank
- **Final letter grade** (F to S) combining all four

Press R to replay.

## Visual style

- Low-poly, chunky geometry with flat or low-detail colours.
- A low-resolution pixel filter (about 320×200 internal resolution, limited palette), toggled with P.
- Office palette: beige, grey carpet, fluorescent white. Hell bleeds in as red light and fleshy growths, getting stronger near the server room and the CEO floor.
