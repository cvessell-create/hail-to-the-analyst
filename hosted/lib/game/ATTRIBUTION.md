# Attribution and licence records

## Owner-supplied hosted continuation

The hosted source export and final branch bundle were supplied by Christopher
R. Vessell on October 7, 2026. The export retains its starter/UI/build-tool
notices, dependency lockfiles, game GPL grants, Apache engine notices, JSNES
license and preferred source. The parent game remains the canonical source;
hosted server/browser copies are generated mirrors.

The new NES visual program, pattern tiles and palette arrangement are original
project code/assets, executed by the included JSNES runtime. No commercial ROM,
Capcom assets or purported CC0 third-party textures were imported in this repair. and licence records

## Engine integration, October 7, 2026

The owner supplied `Vessell-engine-source.zip`, containing original Apache-2.0
engine code and JSNES 2.1.0. Original engine extensions remain Apache-2.0 in
`engine/`, `server/`, `scripts/`, `js/power-index.js`, and their marked tests.
The imported engine notice/license remain in `engine/NOTICE` and `engine/LICENSE`.
JSNES compiled runtime, source map, matching preferred JavaScript source,
upstream README/package metadata and license are retained in `vendor/jsnes/`.
No commercial ROM or BIOS is included; mission bytecode is original homebrew.

The combined distribution selects GPL-3.0-or-later from the existing campaign
GPL-2.0-or-later permission: Apache-2.0 is not GPLv2-only compatible.
See `COPYING-GPL-3`; the original `LICENSE` and file notices are not erased.
SRD material keeps the exact CC BY 4.0 attribution below.
Procedural assets and mathematical algorithms do not import commercial
game code/art. Mathematical references and access limits are in `engine/README.md`.

## Original game

Copyright 2026 Christopher R. Vessell. Original contributions are licensed
under **GPL-2.0-or-later**, following the sole author's approval to relicense
the game from Apache-2.0. See [LICENSE](LICENSE) for the grant and full GPL text.
Source code is distributed directly with this offline, no-build game.

`index.html` retains the original FPS, procedural graphics and synthesized
WebAudio. `js/tactical-ui.js`, `css/tactics.css` and the tests are original
integration/UI/test code. All tactical unit and weapon statistics, faction names,
hex layouts, colours and letter glyphs are original. No upstream art, music,
sprites, unit-stat files, WML maps or campaigns are imported. No Games Workshop
content is used.

## Battle for Wesnoth code adaptations

Upstream: [wesnoth/wesnoth](https://github.com/wesnoth/wesnoth), inspected
2026-10-04 at commit
[`218aa6362f7eabf1cf816a71ef1a1ef1328d2da1`](https://github.com/wesnoth/wesnoth/commit/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1).
All routines below are simplified JavaScript adaptations in `js/tactics.js`,
modified on 2026-10-04, not a full C++/WML engine port.
Their source headers permit **GPL version 2 or any later version** and disclaim
warranty. Original copyright notices are retained in that JavaScript file.

| Upstream source and routines | Credit stated in source | Licence | Changes in this game |
| --- | --- | --- | --- |
| [`src/map/location.cpp`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/src/map/location.cpp): `get_adjacent_tiles`, `distance_between` | Copyright (C) 2003–2025 David White | GPL-2.0-or-later | Ported odd-column-down neighbour offsets and parity-aware distance to JavaScript objects. |
| [`src/pathfind/pathfind.cpp`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/src/pathfind/pathfind.cpp): `enemy_zoc`, `find_routes` | Copyright (C) 2005–2025 Guillaume Melquiond; Copyright (C) 2003 David White | GPL-2.0-or-later | Single-turn weighted route search, occupied-hex blocking and enemy zones of control, with the Field Reader's skirmishing exemption; no multi-turn search, alliances or teleportation. SRD fear/prone/stun movement added. |
| [`src/actions/attack.cpp`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/src/actions/attack.cpp): `battle_context_unit_stats`, `attack::perform`, `attack::perform_hit`, `attack::unit_killed` | Copyright (C) 2003–2025 David White | GPL-2.0-or-later | Terrain hit percentage, resistance-scaled damage, alternating strikes, same-range retaliation and combat/kill XP adapted without WML/events/specials. Jack uses an alternative SRD d20 hit system; other units use terrain probability. |
| [`src/units/unit.cpp`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/src/units/unit.cpp): `new_turn`, `new_scenario`, `defense_modifier`, `resistance_against`, `advance_to` | Copyright (C) 2003–2025 David White | GPL-2.0-or-later | Plain-object turn resets, original terrain defence/movement tables and damage-type resistance tables, overflow XP, simplified advancement/healing. Jack uses SRD level thresholds instead. |
| [`src/ai/default/ca_move_to_targets.cpp`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/src/ai/default/ca_move_to_targets.cpp): `rate_target`, `choose_move` | Copyright (C) 2009–2025 Yurii Chernyi | GPL-2.0-or-later | Small distance/terrain target-scoring AI and adjacent attacks; no full candidate-action engine, recruitment, villages or strategic planner. |

Terrain numbers are **original game data**, not imported Wesnoth movement-type
configuration. This game's `defense` is displayed avoidance, so hit chance is
`100 - defense`; upstream's defence value ordinarily represents chance to be hit.

## SRD 5.1

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

This attribution is reproduced without alteration. Adapted SRD material retains
**CC BY 4.0**; the GPL grant for original code does not remove its attribution
or licence. No SRD 5.2, non-SRD books, third-party character API or monster database
is included.

| SRD 5.1 section | Where used | Adaptation |
| --- | --- | --- |
| Using Ability Scores → Ability Scores and Modifiers | `js/tactics.js`: ability modifier and Jack's character sheet | Six ability names and modifier calculation; scores chosen for this original character. |
| Beyond 1st Level → Character Advancement; Proficiency Bonus | `js/tactics.js`: Jack advancement and attack bonus | XP thresholds 0/300/900/2,700/6,500, levels capped at 5; proficiency +2 at levels 1–4 and +3 at level 5. XP awards, HP growth and mission healing are original adaptations; no full SRD class progression. |
| Advantage and Disadvantage | `js/tactics.js`: attack modifiers | Roll two d20, select higher/lower; opposing advantage/disadvantage cancel. |
| Combat → Making an Attack → Attack Rolls, Modifiers to the Roll, Rolling 1 or 20 | `js/tactics.js`: Jack attack/retaliation | d20 plus ability modifier and proficiency against AC; natural 1 misses and natural 20 hits critically. Original sci-fi weapons and adjacent-hex engagements, not a complete tabletop ranged-combat system. |
| Combat → Damage and Healing → Critical Hits | `js/tactics.js`: Jack damage | Double damage dice on a critical hit, not the ability modifier. |
| Combat → Movement and Position → Being Prone | `js/tactics.js`: crawl/stand | Additional crawl cost and half-speed standing cost on weighted hex terrain. |
| Appendix A: Conditions → Blinded, Frightened, Prone, Stunned; Incapacitated | `js/tactics.js`: conditions and `js/tactical-ui.js`: condition HUD | Attack advantage/disadvantage, blocked stunned actions/reactions/movement, fear-source approach restriction, crawling/standing. Fixed durations and weapon/enemy applications are original; no ability checks, speech or saving throws are simulated. All tactical units are visible on the small map; no fog-of-war system. |

SRD mechanics are implemented as JavaScript, not imported textual rule files.
The mirror used to cross-check the release's legal notice and rules is
[`vitusventure/5thSRD`](https://github.com/vitusventure/5thSRD).
No implementation code or site assets were copied from it.

## Assets and licence boundaries

There is no imported CC BY-SA asset folder because there are **no imported
assets**. If assets are added later, verify each file's licence and credits
first; keep CC BY-SA assets in their own marked folder under that licence.
Wesnoth assets must not be assumed uniformly CC BY-SA.

## SEARCH RECORD — 2026-10-04

| Source opened or attempted | What it said / result | Limits |
| --- | --- | --- |
| Wesnoth [`COPYING`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/COPYING) | Full GNU GPL version 2, June 1991. | The “or later” selection is established by the README and source headers, not by the licence title alone. |
| Wesnoth [`README.md`, License](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/README.md) | All source code GPLv2+; most art/music also GPLv2+; new contributions CC BY-SA v4.0. | **Differs from the proposed blanket “art/music/data CC BY-SA 4.0” claim.** |
| Wesnoth [`data/COPYING.txt`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/data/COPYING.txt) | Full GPL version 2 text, not a blanket CC licence for data. | No unit data imported. Individual exceptions require their own checks. |
| Wesnoth [`copyrights.csv`](https://github.com/wesnoth/wesnoth/blob/218aa6362f7eabf1cf816a71ef1a1ef1328d2da1/copyrights.csv) | Per-file artwork/music credits and GPL/CC BY-SA licence entries. | No assets selected or imported; individual asset permissions were not audited. |
| Five code sources in the port table above | Opened actual implementations and headers; each permits GPL v2 or later; credits retained above/in source. | Simplified adaptations only. |
| `/usr/share/common-licenses/GPL-2` | Complete standard GPLv2 text used for the local licence copy. | Project grant explicitly selects GPL-2.0-or-later. |
| Official SRD [PDF](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf), [alternate PDF](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf) and official resource page linked above | Requests failed DNS resolution in the sandbox. | **Official PDF was not directly opened or extracted.** No claim of primary-verified PDF pagination. |
| [`5thSRD/docs/license.md`](https://github.com/vitusventure/5thSRD/blob/master/docs/license.md) | Opened SRD 5.1 legal notice: exact attribution above and CC BY 4.0 link. Corroborated with search of the published SRD 5.1 legal page. | Accessible mirror, **not** a newly issued licence or a direct fetch from the official PDF host. |
| `5thSRD/docs/rules/abilities/ability_scores.md`, `rules/leveling_up.md`, `rules/proficiency_bonus.md`, `rules/advantage_and_disadvantage.md`, `rules/conditions.md`, `combat/making_an_attack.md` | Opened version-specific SRD rule transcriptions to cross-check the implemented subset, advancement table and conditions. | No mirror code/assets imported; no SRD 5.2 content used. |
| CC BY 4.0 legal-code page linked above | Direct fetch failed DNS in research session. | Attribution retains the canonical licence link; no local CC licence document imported. |

**Merge order:** the parallel accessibility/links/security review PR should
merge first. This expansion keeps the FPS in `index.html` and isolates tactical
logic/UI to make reconciliation easier.
