# HAIL TO THE ANALYST

[![PLAY](play-button.svg)](https://cvessell-create.github.io/hail-to-the-analyst/)

## Hosted continuation and first-person

All five solo missions enter first-person play directly. The original hex-grid
prototype remains only for legacy checkpoint compatibility and optional tools.
Press **M** or tap **HEX MAP** during play for the live hex tactical minimap
of your current mission—not a separate level. It shows your position and facing,
living enemies, remaining loot, clearance doors, open entrances and the exit.
Movement and combat continue in real time while the map is visible.



### Expanded solo campaign

Version **0.3.1**. Extract the complete source ZIP and open `index.html` for
offline solo play. Keep the extracted folders together. The hosted backend
source is also included, but is not needed to run the offline campaign.

The consolidated update includes the prominent Play button, collision-aware
hosted movement prediction, live hex minimap fixes, and optional first-person
tactical practice with a clearly fictional archive-routing Easter egg. All
branch histories are retained; normal solo missions still enter FPS directly.

The campaign continues through **THE ARCHIVE**, **FABRICATION PLANT**,
**FROST YARD** (32 × 26), **STARLIGHT BOULEVARD** (40 × 30), and
**GLACIER DOCK** (36 × 28). New outdoor maps have more than twice the original
plant's grid area. Starlight is an original Hollywood-inspired city with neon
theaters, palm-lined streets, sidewalk stars and a hillside sign, not licensed
movie art or a recreation of a particular studio property.

- Doors have bright frames, handles, clearance labels and nearby use prompts.
  Open entrances remain marked; exits have their own green signage.
- **Ice pig droids** are icy-blue, four-legged robotic enemies with armored
  snouts, tusks and pink optical sensors. They rush and deal 14 ground-melee
  damage; their 84 health is not just a visual reskin.
- Collect **JET** caches to equip a jetpack and add 60 fuel, capped at 100.
  Hold **J** or the mobile **JET** button to lift/hover, up to 1.5 altitude.
  Thrust consumes 16 fuel per second; **FUEL** canisters add 35.
  There is **no automatic fuel recharge**. Release or empty fuel to land.
- Flight changes camera elevation and evades ground melee above 0.8 altitude.
  Walls still block flight. Ranged enemies aim at your altitude; hovering is
  not invulnerability. Land below 0.55 to collect ground supplies.
  This remains a 2.5D raycaster, not a freely navigable 3D flight simulator.
- Jetpack equipment and remaining fuel carry between campaign missions.
  Restart restores the mission's starting equipment rather than stacking it.
- **MISSION SELECT // PRACTICE** lets you play any arena from its normal spawn.
  Practice is labeled on-screen and in state logs and never awards campaign
  victory. The normal campaign still requires the five sequential objectives.

These additions affect solo play; the multiplayer arena retains its separate
authoritative rules and map.

The supplied hosted app is in [hosted](hosted/). Read its
[repair/deployment handoff](hosted/GAME_REPAIR.md).
Run `node scripts/sync-hosted-game.js` after canonical engine changes to keep
server and browser copies identical. 

Allocated relay/armour/ammo loot equips proportional, capped combat effects
on the next host replay. In-game credits have purchasing effects through the
power-cell auction but no real-money value. Influence savings remain exactly
the owner's conserved ledger: no interest, extra XP or credit conversion.

A retro FPS and turn-based hex tactics game starring **Jack Slade**, a Strategic Intelligence operative, against the disinformation syndicate **The Fabricators**.

> "It's time to kick ass and verify sources."

## Play

### Engine workbench and local co-op

Open [the engine workbench](engine/workbench.html) for the map/asset editor,
versioned save/load, ultra-boss control puzzle, editable payoff matrices,
mixed strategies and backward-induction decision trees.
The five-mission first-person campaign remains this page's game.

With Node.js 24+, run `npm test`, then `npm start` and visit
`http://127.0.0.1:8787/engine/workbench.html`. Two local tabs can join the
authoritative co-op arena before firing. Auction a power cell before combat;
defeat NPCs together to unlock sealed-bid Knaster or Adjusted Winner loot.
All currency is game-only and has no real-money value; no wallets, purchases or blockchain activity.
GitHub Pages runs offline tools, not the Node multiplayer server.
See the [engine contracts, math and limitations](engine/README.md).

**No build, no dependencies.** `index.html` is the entry point; keep its local `js/` and `css/` folders beside it. No network calls, remote assets or real LLM API. Open it in any modern browser:

```bash
# Just open it
open index.html

# or serve it (recommended on mobile)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on desktop and iPhone. For the best experience on mobile, use the touch controls.

### Tactical controls

The optional legacy tactical practice arenas are separate from all five normal
solo starts. Choose **MISSION SELECT // PRACTICE**, then **TACTICAL ARCHIVE**
or **TACTICAL PLANT**. The view stays with Jack while you command the squad;
terrain, units and reachable destinations are shown in first person.

- Drag the view, use arrows or **LOOK LEFT / RIGHT** to turn without spending
  movement or advancing turns.
- Choose **Command unit**, **Destination / MOVE**, or **Target / ATTACK**.
  With the view focused, WASD issues one adjacent hex move per key press,
  Space attacks the selected target, and E ends the turn. Held keys do not
  repeatedly issue orders. Native buttons/selects retain keyboard navigation.
- **Orders & combat log** contains an optional **INSPECT STRANGE TRANSMISSION**
  Easter egg. **RUN FICTIONAL AUTO** displays an invented specialist and public
  task-matching reason; separately reveal its story answer. This offline fiction
  is not vendor routing or private reasoning, grants no combat bonus and advances
  no turns. Its state is preserved in tactical checkpoints.

- Move the squad, attack once per unit per turn, then choose **END TURN** for the Fabricator AI.
- Entering an enemy zone of control ends movement, except for the skirmishing
  Field Reader. Occupied hexes block movement.
- Jack can select **SIDEARM**, **BREACHER** (prone), or **REDACTOR** (blinded).
  **STAND UP** removes prone at a movement cost. The selected-unit HUD shows conditions.
- Reach the gold objective **with Jack**, or defeat all Fabricators, to unlock **BREACH // LAUNCH FPS**.
  If Jack falls, retry the tactical map.
- Surviving squad members supply armour and ammo; squad losses add FPS enemies.
  Restarting an FPS mission preserves its original breach result without stacking bonuses.

### FPS desktop controls

| Key | Action |
|-----|--------|
| W A S D / Arrows | Move / strafe |
| Left / Right arrows | Turn |
| Click / Space (hold) | Fire |
| E | Use (doors, pickups) |
| J (hold) | Jetpack lift/hover, after collecting JET equipment |
| 1 / 2 / 3 | Sidearm / Breacher / Redactor |
| M | Minimap |
| P / Esc | Pause |

### FPS mobile controls

Left-side virtual joystick to move, drag right side of screen to look. Dedicated **FIRE**, **WEAPON**, **USE**, and hold-to-fly **JET** buttons.

## The game

Five first-person missions, an optional legacy Analyst squad, and three weapons:

- **Missions** — archive clearance, the plant controller, the frost yard, the Starlight city district and a final glacier dock requiring both blue clearance and its controller defeat.
- **Weapons** — Sidearm, Breacher shotgun (pellet spread), Redactor (rapid-fire).
- **Enemies** — Mole, Disinfo Drone, Troll, Ice Pig Droid, and **THE FABRICATOR** controller.
- **Tactical faction** — original grimdark sci-fi Fabricators expand with Null Wardens, Ash Auditors and Signal Reavers; no Games Workshop content.
- **Pickups** — health, armor, ammunition, Intel Caches, red/blue keycards, jetpacks and collectible jet fuel.

The tactical layer adapts Wesnoth hex neighbours/distance, terrain movement and
defence, alternating strikes with resistance and retaliation, zones of control,
experience/advancement and a small AI. It is a focused JavaScript adaptation,
not the full Wesnoth engine: no recruitment, multiplayer, time-of-day system or
campaign data is imported. All visuals and WebAudio remain original/procedural.

Jack has the six SRD 5.1 ability scores, levels 1–5 and proficiency bonus.
His tactical attacks (including retaliation) use d20 rolls against AC, with
natural 1 misses, natural 20 critical hits and advantage/disadvantage. Other
units use the Wesnoth-style terrain percentage roll instead—these are **alternative
hit systems**, not two successive hit checks. Stunned, blinded, frightened and
prone affect tactical actions, attacks or movement. Weapon effects and their
turn durations are original game adaptations, not SRD weapon statistics.
Character advancement carries between missions; a new run resets it.
The FPS retains its original real-time rules.

## Tech

- Shared original Canvas raycaster: FPS ASCII/DDA walls or a tactical scene adapter
  with segment-cast hex walls, near-plane-clipped hex floors, procedural sprites,
  labels and depth clipping. Tactical rendering never swaps or mutates FPS state.
- **Chatter Engine**: deterministic, template-based "LLM element" — context-aware enemy taunts (idle, aggro, damaged, dying) and intel-style mission briefings generated from mission state. All local, no API calls.
- Enemy AI: state machines (idle → patrol → chase → attack → die) with line-of-sight via the same DDA raycast the renderer uses — enemies can't see through walls either.
- Synthesized WebAudio: all sound effects generated in code.
- HUD, minimap, title/briefing/pause/death/victory screens, score and accuracy tracking.
- Isolated rules in `js/tactics.js`, tactical DOM controls in `js/tactical-ui.js`
  and `css/tactics.css`; the existing FPS stays in `index.html`.

## Tests

With Node.js (no packages to install), run from the repository root:

```bash
node --test tests/*.test.js
```

Tests cover engine algorithms, scenes/saves, collision/LOS, payoff/tree solvers,
power indices, exact fair division, local HTTP and authoritative co-op, as well
as hex geometry, first-person tactical rendering and native controls, terrain
hit chance, d20 versus AC, conditions, tactical checkpoint replay, breach
modifiers, live minimap markers and all five solo missions. The offline game
needs no build; the separate hosted app has TypeScript and production builds.

## Publish as a playable site

This repo is GitHub Pages-ready: enable Pages on the `main` branch in repo settings, and play the game at [cvessell-create.github.io/hail-to-the-analyst](https://cvessell-create.github.io/hail-to-the-analyst/).

## License

The combined 0.2 engine/game distribution uses **GPL-3.0-or-later**, exercising
the campaign's existing "or later" permission so it can combine with Apache-2.0
engine/JSNES code. See [COPYING-GPL-3](COPYING-GPL-3). File-level licenses and
SRD attribution are retained; the following describes the prior campaign grant.

Copyright 2026 Christopher R. Vessell. The sole author approved changing this
game from **Apache-2.0 to GPL-2.0-or-later** so Battle for Wesnoth code can be
ported and reused. You may redistribute and modify the game under GPL version 2
or (at your option) any later version. There is no warranty. See [LICENSE](LICENSE).

SRD 5.1 rules remain credited under **CC BY 4.0**; see [ATTRIBUTION.md](ATTRIBUTION.md)
for the exact Wizards of the Coast attribution, ported routines, source credits
and primary-source licence search record. No Wesnoth art, music, unit-stat files
or other assets are imported. Contrary to a blanket CC BY-SA assumption,
Wesnoth's own notes say most existing art/music is GPLv2+ and new contributions
are CC BY-SA 4.0; individual assets require individual licence checks.
