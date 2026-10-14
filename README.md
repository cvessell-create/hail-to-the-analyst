# HAIL TO THE ANALYST

[![PLAY](play-button.svg)](https://cvessell-create.github.io/hail-to-the-analyst/)

## Hosted continuation and first-person

All seven solo campaign missions enter play directly. Desktop browsers default to an
isometric Three.js view (`V` toggles first person; `?view=fp` forces it); the
autopilot always uses first person. The original hex-grid
prototype remains only for legacy checkpoint compatibility and optional tools.
The story is a civilian training simulation, not a political attribution.
Both renderers are presentation only; gameplay stays in `index.html`; the NES companion
display was removed from the UI (`engine/nes-visual.js` remains as a tested module).

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

**FOOTPRINT PURGE** is an optional side quest in Gateway Sprawl (also available in practice select), separate from the seven-mission campaign. Its eight fictional exposure nodes (`e`) represent simulated records. Hard nodes require standing still for 1.5 seconds; impossible nodes are LOCKED DOWN (containment, not deletion) and count as handled. Each node and category carries generic fix guidance, shown in the briefing and scrub message. Availability varies and real-world removal is not guaranteed. Two critical nodes gate the exit; optional scrubs also earn intel (critical/high/medium/low: 1000/750/500/250). Red/orange/yellow/grey nodes and the FOOTPRINTS HUD show progress. All invented service domains end in `.example`; no real accounts or services are modified. Existing SI autopilot episode events add only `footprints: [{id, category, severity, difficulty, t}]` in scrub order and `footprints_total: 8` for this mission; `difficulty` is `easy|medium|hard|impossible`; `t` is simulation seconds since level start. Other mission events are unchanged.

Gateway Sprawl is a free-roam hub and side-quest setting; the seven-mission campaign runs through **THE ARCHIVE**, **FABRICATION PLANT**,
**FROST YARD** (32 × 26), **STARLIGHT BOULEVARD** (40 × 30), and
**GLACIER DOCK** (36 × 28). New outdoor maps have more than twice the original
plant's grid area. Starlight is an original neon city district. The final
mission, **SHADOW DOSSIER**, features the fictional mechanical Stalker boss and
dormant ODNI artifact; defeating the guardian does not activate the system.

The campaign adapts the publicly described intelligence workflow into fiction.
The archived ODNI explainer lists direction, collection, processing,
exploitation and dissemination; the game makes analysis visible alongside
exploitation and treats evaluation/oversight as a continuing review layer.
Briefings show how each mission touches the apparatus. Jack learns to question
tasking, preserve source lineage, compare alternatives and disclose
uncertainty. The fictional network advises settlement councils; it does not
decide policy. The real IC, ODNI and their personnel are not characters or
participants in this story.

This adaptation is grounded in the public [ODNI explainer on intelligence and
the intelligence cycle](https://archive.dni.gov/index.php/what-we-do/what-is-intelligence)
and [ODNI's archived analytic-objectivity page](https://archive.dni.gov/index.php/how-we-work/objectivity),
which describes the IC as a federation, ICD 203's analytic/tradecraft
standards and the Analytic Ombuds role. These are archived public sources, not
evidence about current classified operations or the effectiveness of any real
institution; the game organization and events are fictional and do not imply
real-world IC involvement.

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
  victory. The normal campaign requires all seven sequential mission objectives.

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
The eight-mission first-person campaign remains this page's game.

With Node.js 24+, run `npm test`, then `npm start` and visit
`http://127.0.0.1:8787/engine/workbench.html`. Two local tabs can join the
authoritative co-op arena before firing. Auction a power cell before combat;
defeat NPCs together to unlock sealed-bid Knaster or Adjusted Winner loot.
All currency is game-only and has no real-money value; no wallets, purchases or blockchain activity.
GitHub Pages runs offline tools, not the Node multiplayer server.
See the [engine contracts, math and limitations](engine/README.md).

### Online beta (host's Mac, temporary link)

Invited testers can play and join co-op through a Cloudflare quick tunnel to
the host's machine. Run `HAIL_PUBLIC=1 npm start`, the SI chat service
(`python -m vessell.si_chat serve` in VessellFramework) and Ollama, then
`cloudflared tunnel --url http://127.0.0.1:8787` and share the printed
`*.trycloudflare.com` link. Anyone with the link can connect; it stops when
any of these processes stops. Public mode closes Hugging Face routes, limits
SI chat to 20 messages per minute per visitor and forwards only chat text, so
remote gameplay events stay out of the host's SI memory. Chat text itself is
still logged locally by the SI service. Arena state is in memory and resets
when the server restarts.

**No build, no dependencies.** `index.html` is the entry point; keep its local `js/` and `css/` folders beside it. No network calls, remote assets or real LLM API. Open it in any modern browser:

```bash
# Just open it
open index.html

# or serve it (recommended on mobile)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on desktop and iPhone. For the best experience on mobile, use the touch controls.

### Optional gameplay data and improvement suggestions

Gameplay telemetry is **off by default**. Use **GAME DATA & FEEDBACK** at the
bottom-left of the page, or **REVIEW PRIVACY & DATA** on the title screen, to
review and change consent. If enabled, only this first-person campaign's
allowlisted attempt summaries, coarse death-map cells, frame-time summaries,
and explicitly selected feedback categories are stored in this browser's
local storage. No telemetry is sent to a server. There are no accounts or
stable player/device identifiers, and the feature does not collect IP
addresses, chat, free text, raw keystrokes, or device fingerprints.

The same panel provides **REVOKE**, **DELETE DATA & REVOKE**, and JSON export
and validated import. Revoking stops new collection but keeps prior data;
deletion removes local data and consent. Local browser data is not encrypted
or secret from someone with access to that browser profile. It is not tracked
by Git or uploaded by the game. The UI displays aggregate summaries and evidence-linked improvement
suggestions only when minimum sample thresholds are met. Completion prompts
require at least 20 terminal attempts across five sessions; other prompts have
their own session/frame thresholds. Wilson intervals are nominal attempt-level
uncertainty estimates, not guarantees that sessions represent different
people. Suggestions are review prompts for a human; they never change a map,
difficulty, or game code. Attempts with no recorded ending are censored, not
counted as deaths or failures. See the [gameplay-data module](engine/gameplay-data.js)
for event bounds and thresholds.

### Tactical controls

The optional legacy tactical practice arenas are separate from all seven normal
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
| Mouse | Look (first person) / aim at cursor (isometric) |
| Left / Right arrows | Turn |
| Click / Space (hold) | Fire |
| E | Use (doors, pickups, metro: call train / press again to change stop) |
| Q | Dodge roll (brief invulnerability, 1.1 s cooldown) |
| R (hold) | Raise weapon over low cover (slower movement, exposed) |
| G | Mark the route to the current objective on the radar (8 s) |
| J (hold) | Jetpack lift/hover, after collecting JET equipment |
| 1 / 2 / 3 | Sidearm / Breacher / Redactor |
| T | Throw grenade (spends tactical charge) |
| F / C / B | Augments: shockwave / drone / barrier dome (spend energy) |
| H | Hack nearby terminals, turrets and machines |
| K | Skills panel (spend skill points) |
| I | Loadout panel: buy, equip and upgrade weapon mods, armor, tech, augmentations and cyberdecks with in-game credits (1–5 slot, ←→ browse, Enter buy/equip, U upgrade, or click) |
| V | Toggle isometric / first-person view |
| M | Minimap |
| P / Esc | Pause |

Your hero (level, XP, skills, credits and gear) is saved in this browser only, under the
localStorage key `hail-analyst-profile/v1`. It is a game save, not telemetry: it has no
player ID and is never sent anywhere. Campaign checkpoints carry the same hero snapshot.
Autopilot runs never write it. To start fresh, clear that key from your browser's site data.

### Vessell City (free roam, slice 1)

**VESSELL CITY // FREE ROAM** on the title screen opens a walkable hub (`engine/city.js`).
It works best in the isometric view (V). Face a district entrance and press **E**:

- **Safehouse**: restores health and saves your hero.
- **The Archive**: always open.
- **Fabrication Plant**: opens once the Archive is cleared.
- **Skyline District**: opens once the Plant is cleared.

Metro Central rides to the Archive stop. Clearing a district from the city returns you to
where you left. Dying in the city respawns you at the Safehouse.

City runs are practice: they never complete the campaign. Free roam starts no gameplay
attempt. Cleared districts are saved with the hero profile.

### Gateway Sprawl (St. Louis sector sandbox)

The orange **GATEWAY SPRAWL** gate on Vessell City's west edge opens a 44×32 free-roam
sector (`engine/gateway-sprawl.js`). It is an original cyberpunk sector inspired by public facts
about St. Louis, Missouri, not a street-accurate map. It contains:

- a stainless catenary arch on the riverfront;
- a flood wall with gates;
- a walkable Eads Bridge deck over the river;
- Laclede's Landing warehouses and the safehouse;
- a numbered downtown grid;
- I-70, I-64 and I-44 viaducts with underpasses;
- North City brick ruins;
- a quiet Pruitt-Igoe memorial field with no patrols;
- Delmar Loop, Forest Park, Union Station, City Museum and an old brewhouse;
- The Hill, Cherokee Street, and Soulard rowhouses around a market hall.

Five light-rail stops link the sector. Entering a district shows short flavour text. The cyan
gate at the bridge end returns you to Vessell City. Sandbox travel never clears missions. The
search record and sources are listed in the module header:

- gatewayarch.com fact sheet
- lacledeslanding.com history
- STLPR (2010) on brick theft
- Wikipedia: Eads Bridge, Numbered Streets, Union Station, City Museum, Soulard Farmers
  Market, The Hill, Cherokee Street, Delmar Loop, Forest Park, MetroLink, Pruitt–Igoe,
  Anheuser-Busch Brewery, and I-64/I-70/I-44

Flood-wall statistics were not verified and are not used.

### Vessell formula and local SI receipts

`engine/vessell-formula.js` implements strict current-run conjunction over
nonempty required check IDs: missing, duplicate, unknown, failed or mixed-run
observations are DOWN. It is a check-compliance rule, not a truth or authority
claim. The SI channel displays local Phase 0/1 status through `/si/formula`,
refreshing every 30 seconds and after episodes. The framework supplies a
sanitized status, checks freshness (one hour) and verifies local HMAC receipts.
Unavailable service status is shown as DOWN; offline owner dialogue remains
available. No mission rules, autopilot promotion or progression changes.
Private formula status is not exposed to tunnel players. The hosted source
mirrors include the same module; a deployment without the local SI service
shows unavailable status rather than claiming a successful run.

### FPS mobile controls

Left-side virtual joystick to move, drag right side of screen to look. Dedicated **FIRE**, **WEAPON**, **USE**, and hold-to-fly **JET** buttons.

## The game

Seven campaign missions, an optional Footprint Purge side quest, an optional
legacy Analyst squad, and three weapons:

- **Missions** — seven connected districts in the fictional Municipal Darwinism campaign, from Laclede's Landing and North City to the Mississippi freight yards and downtown grid. The final **SHADOW DOSSIER** has the mechanical Stalker boss and dormant fictional ODNI artifact. Gateway Sprawl is an optional St. Louis-inspired free-roam district with the separate Footprint Purge side quest; neither the game nor its training records contact real accounts, people or agencies.
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
modifiers, live minimap markers and all seven solo campaign missions. The offline game
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
