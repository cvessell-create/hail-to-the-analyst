# Hail to the Analyst: Flipper Edition

Standalone, human-controlled C companion game for the Flipper Zero. Version 0.2
adds three compact 8x8 turn-based missions, two weapons, enemies and a boss on
the 128x64 monochrome display. The full browser campaign, original native slice
and native-engine roadmap remain untouched.

## Play

Open **Apps -> Games -> Hail: Flipper Edition**.

- Short arrow presses move one cell. Hold/repeat is intentionally not enabled.
- Your marker is the small filled square with a white dot.
- Collect the outlined clearance card, eliminate enemies, then reach **E**.
- **D** is a Splice Drone, **M** a Data Mole, **F** the Fabricator.
- **+** is a single-use medkit restoring HP to 32. Walls are solid blocks.
- **Short OK** attacks the nearest enemy within weapon range and unobstructed
  sight; equal distances use enemy slot order. You do not need to aim.
- **Hold OK** switches weapon without using a turn. HUD **S** means Sidearm,
  **B** means Breacher. It also shows HP, remaining enemies and clearance.
- Each arrow attempt (including walls/enemy blocks) or attack (including a miss)
  uses one turn; surviving enemies then act. Holding arrows does not repeat.
- After extraction **OK** advances; after defeat it retries the current mission.
  After the third mission **OK** starts a new campaign.
- **BACK** exits. Closing/reopening starts a fresh run; no save data is written.

The game runs entirely on-device and continues without the Mac or USB.
There are no radios, Bluetooth, network access, credentials, AI automation or
report-release functions. Weapons have unlimited ammunition; no persistent
saves, inventory menu, skill tree or XP system is implemented.

## Missions and combat

1. **THE ARCHIVE**: corridors, clearance card, one Drone and one Mole.
2. **FROST YARD**: compact lanes, another card, one Drone and one Mole.
3. **FABRICATION PLANT** (displayed as **FAB PLANT**): pillar cover, a card,
   Drone, Mole and Fabricator controller.

This deliberately reorders the original campaign's second/third identities
to place the boss at the end. Clearance and all enemy kills gate every exit.
Missions start at full health and retain the equipped weapon. Defeat retry
respawns the current mission; in-memory turn/kill counters include failed
attempts. Terminal screens freeze gameplay until OK.

| Combatant / weapon | HP | Damage | Manhattan range |
| --- | --- | --- | --- |
| Jack / Sidearm | 32 | 5 | 2 |
| Jack / Breacher | 32 | 8 | 1 |
| Data Mole | 20 | 4 | 1 |
| Splice Drone | 18 | 3 | 2 |
| Fabricator | 40 | 6 | 3 |

Basic enemies attack when in range with clear sight, otherwise step toward Jack
when visible within four cells. They cannot pass walls or occupied cells and
can stall behind cover; this is not pathfinding or learning. The stationary
Fabricator alternates charging (**F: VOLLEY!**) and firing. Leaving its range or
breaking sight before the next enemy turn avoids that shot.

This is a deterministic adaptation, not JavaScript gameplay parity: original
tactical weapon damage/range and Jack/Mole/Drone HP are retained, but enemy
damage is reduced, squares replace hexes, and there are no dice, resistances,
conditions, pellet spread, fuel/ice mechanics or coalition-planning checks.
The Fabricator's HP/charge rules and these maps are new compact-game tuning,
not a port of the separate `engine/boss.js` UltraBoss encounter.

## Build

Use official uFBT in an isolated environment with `requirements-build.txt` and
select the SDK matching your firmware. For the tested firmware 1.5.1:

```sh
export UFBT_HOME=/absolute/private/sdk-state
/absolute/build-env/bin/ufbt update --branch=1.5.1
/absolute/build-env/bin/ufbt
```

Run in this folder. Output: `dist/hail_analyst.fap`, target 7 / API 88.2.
Copy the reviewed artifact to `/ext/apps/Games/hail_analyst.fap`; no firmware
flashing is required. Building alone does not establish on-device behavior.

Portable gameplay tests, run from this folder:

```sh
cc -std=c99 -Wall -Wextra -Werror -pedantic \
  game_slice.c game_rules.c test_game_rules.c -o /tmp/hail-flipper-test
/tmp/hail-flipper-test
cc -std=c99 -Wall -Wextra -Werror -pedantic \
  campaign.c test_campaign.c -o /tmp/hail-flipper-campaign-test
/tmp/hail-flipper-campaign-test
```

Both portable programs also run through `node --test tests/flipper-game.test.js`
from the repository root and the full `npm test` suite; a C compiler is required.
Campaign tests cover weapons, sight/corner blocking, enemies, boss telegraph,
healing, exit gates, retries and legal input traces through all three untouched
mission spawns. The trace clears all seven enemies in 75 turns, finishing each
mission at 8 HP. Host tests do not verify physical button timing or screen layout.
The canonical native slice tests remain available via `npm run test:homebrew`;
the SDK manifest excludes both portable test programs from the app build.

## Provenance and licensing

Copyright Christopher R. Vessell, GPL-3.0-or-later; preserve file notices and
the repository's `COPYING-GPL-3`. `game_slice.c` compiles the original
`../../homebrew/slice.c` directly rather than copying or modifying it.
This folder belongs to the game repository, not the Apache framework package.
No external artwork or third-party C implementation was copied.

Canonical game identity was verified through GitHub metadata:
`cvessell-create/hail-to-the-analyst`. Original slice/header/tests and
`engine/README.md` were inspected at local revision
`f41e7061f556cec3dcccfc473400802ac6a06dde`.
Version 0.2 source reads at that local revision: `js/tactics.js` (original
weapon/unit constants), `engine/campaign-story.js` (mission identities),
`index.html` (Archive/Plant layout themes and controller objective), and
`engine/boss.js` (separate coalition boss, not imported). Original campaign
sources and their mixed notices remain intact; no Wesnoth/SRD combat routines
or third-party assets were copied into the new C campaign implementation.

Flipper GUI/input and application manifest APIs were checked against the
official firmware 1.5.1 SDK. Prior primary sources are documented in
`../../homebrew/flipper/README.md`; the external-app build contract is in
https://github.com/flipperdevices/flipperzero-firmware/blob/dev/documentation/AppsOnSDCard.md.

SEARCH RECORD: canonical repository/native slice/SDK app APIs / GitHub CLI and
direct local source/SDK reads / local revision above and firmware SDK 1.5.1 /
one canonical game repository plus named original files / no limit hit /
primary sources opened: yes / SOURCE-ESTABLISHED for inspected mechanics /
not checked: full campaign portability, JavaScript-to-C parity or radio functions.

SEARCH RECORD: weapon/unit constants and mission/controller identity /
bounded direct local source reads / four named primary game files above /
one local game revision, four files / no search limit hit; long HTML reads
narrowed to the relevant lines / primary sources opened: yes /
SOURCE-ESTABLISHED for named constants/identities; new C rules are adaptations /
not checked: parity with the FPS, full Frost mechanics, external radio behavior.
