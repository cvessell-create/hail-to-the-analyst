# HAIL TO THE ANALYST

A retro FPS and turn-based hex tactics game starring **Jack Slade**, a Strategic Intelligence operative, against the disinformation syndicate **The Fabricators**.

> "It's time to kick ass and verify sources."

## Play

### Engine workbench and local co-op

Open [the engine workbench](engine/workbench.html) for the map/asset editor,
versioned save/load, ultra-boss control puzzle, editable payoff matrices,
mixed strategies and backward-induction decision trees.
The original two-mission FPS/tactics campaign remains this page's game.

With Node.js 24+, run `npm test`, then `npm start` and visit
`http://127.0.0.1:8787/engine/workbench.html`. Two local tabs can join the
authoritative co-op arena before firing. Auction a power cell before combat;
defeat NPCs together to unlock sealed-bid Knaster or Adjusted Winner loot.
All currency is fictional; no wallets, purchases or blockchain activity.
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

Before **each** mission, choose **TACTICAL APPROACH**. Click or tap an Analyst hex
to select that unit, then a highlighted empty hex to move or an adjacent hostile
hex to attack. Keyboard users can Tab through hexes and buttons and activate them
with Enter or Space. Hex labels/tooltips show terrain defence and movement costs.

- Move the squad, attack once per unit per turn, then choose **END TURN** for the Fabricator AI.
- Entering an enemy zone of control ends movement, except for the skirmishing
  Field Reader. Occupied hexes block movement.
- Jack can select **SIDEARM**, **BREACHER** (prone), or **REDACTOR** (blinded).
  **STAND UP** removes prone at a movement cost. The selected-unit HUD shows conditions.
- Reach the gold objective **with Jack**, or defeat all Fabricators, to unlock **BREACH // LAUNCH FPS**.
  If Jack falls, retry the tactical map.
- Surviving squad members supply armour and ammo; squad losses add FPS enemies.
  Restarting an FPS mission preserves its original breach result without stacking bonuses.

### Desktop controls

| Key | Action |
|-----|--------|
| W A S D / Arrows | Move / strafe |
| Mouse | Look |
| Click | Fire |
| E | Use (doors, pickups) |
| 1 / 2 / 3 | Sidearm / Breacher / Redactor |
| M | Minimap |
| P / Esc | Pause |

### Mobile controls

Left-side virtual joystick to move, drag right side of screen to look. Dedicated **FIRE**, **WEAPON**, and **USE** buttons.

## The game

Two combined missions, a small Analyst squad, and three weapons:

- **Missions** — `THE ARCHIVE`: infiltrate, collect red/blue keycards and intel caches; `FABRICATION PLANT`: fight through to **THE FABRICATOR** boss.
- **Weapons** — Sidearm, Breacher shotgun (pellet spread), Redactor (rapid-fire).
- **Enemies** — Mole, Disinfo Drone, Troll, and **THE FABRICATOR** boss with multi-phase attacks.
- **Tactical faction** — original grimdark sci-fi Fabricators expand with Null Wardens, Ash Auditors and Signal Reavers; no Games Workshop content.
- **Pickups** — health, armor, ammunition, Intel Caches, red/blue keycards.

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

- Canvas raycaster: ASCII grid maps, DDA wall casting, procedural textures and sprites, billboard enemies/pickups, z-buffering, fixed-timestep updates.
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
as hex geometry, terrain hit chance, d20 versus AC, conditions,
tactical combat/movement and breach modifiers, plus both FPS mission handoffs,
retries and keyboard isolation. There is no build or lint step.

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
