# Hail to the Analyst

Original game and simulation research by Christopher R. Vessell.

**[PLAY THE GAME](https://cvessell-create.github.io/hail-to-the-analyst/)**
| [Engine and research guide](engine/README.md)
| [Framework research](https://github.com/cvessell-create/VessellFramework_Local_Rebuild)
| [Attribution](ATTRIBUTION.md)

## For reviewers

The playable browser campaign is the current implementation. The planned
native desktop engine rebuild is a separate workstream, not a finished product.
This repository is public for academic review. Original research, source
history and upstream licence notices are preserved.

| Component | Current state |
| --- | --- |
| Browser game | Seven solo missions, third-person/isometric camera, combat, flight, progression, inventory, city hubs and optional Footprint Purge |
| Mathematics | Allocation, game theory, tactical methods, Vessell formula and traceable weight calculations |
| AI/SI | Owner-source dialogue, optional framework chatbot and local formula/receipt status; requires separately running services for generated replies |
| Development console | Local AI/SI service checks, chat and run-collectible metadata preview/download |
| Native experiment | Original C engine slice; KallistiOS build and native Flycast replay tested |
| Replacement engine | Modified Flycast direct-game engine, upgraded stylized 3D art/maps/UI: selected direction, not yet implemented |
| Coinbase / NFTs | Planned mainnet integration; local metadata preview only. No wallet, payment, upload or mint implementation |

The original game is the blueprint, not the ceiling. The full rebuild covers
maps, levels, art, algorithms, formulas, inventory and supporting services.
AI/SI, repository communication and blockchain are supporting systems, not a
replacement for rebuilding the game. Native desktop first, browser afterward.
See the [selected architecture](engine/README.md#selected-rebuild-direct-game-flycast-fork).

## Play

Use the Play link above in a modern WebGL-capable browser. GitHub Pages runs
the solo game and offline tools; it does not run the multiplayer or AI backend.
If a deployment is still updating, download the source and open `index.html`
with its neighbouring folders intact, or run the local server:

```sh
# Node.js 24 or newer; no npm dependencies required for the canonical server.
npm start
```

Open `http://127.0.0.1:8787/index.html` for the game,
`/engine/workbench.html` for the map/math tools, or
`/engine/development.html` for the local service console.
The separate hosted application has its own
[setup and deployment guide](hosted/GAME_REPAIR.md).

The camera stays third-person/isometric, including autopilot. `V` and legacy
first-person URL options cannot change it. Renderer errors appear explicitly,
not as a first-person fallback. Desktop uses WASD/arrows, mouse aiming and the
displayed action controls; mobile provides touch controls. **M / HEX MAP**
shows the current mission's tactical minimap while gameplay continues.

The story, enemies and operations are fictional. Gateway Sprawl and Vessell
City are free-roam settings; Footprint Purge is an optional simulated exposure
side quest, not an account-removal tool. Game credits have gameplay purchasing
effects but are not money, cryptocurrency or redeemable assets.

## AI, data and backend boundaries

The framework chatbot is optional and separately operated. The game's local
Node server proxies chat to `HAIL_SI_URL` (default loopback port 8790).
Model availability does not establish that any SI evaluation level passed.
Generated text, owner-source selections and telemetry retain distinct labels.

Gameplay-data collection defaults off. Consent, revoke/delete and local export
controls remain in the game. Chat submitted to the optional framework service
is subject to that service's local memory policy; it is not part of the
browser-only gameplay-data store. No wallet keys belong in this repository.

The development console prepares allowlisted, caller-supplied run metadata.
It neither attests a run nor publishes or mints it. Coinbase Wallet is the
preferred future integration; signing, spending and public data release remain
separate explicit actions. No blockchain earnings are claimed.

## Tests and source

```sh
npm test
npm run test:homebrew
```

The October 14 local game suite passed **207 tests** before this documentation
and Pages repair; subsequent validation is reported in the commit/CI output.
[Homebrew documentation](homebrew/README.md) records the bounded native
experiment. The black-screen WASM guest experiment was stopped and is not the
selected rebuild route. Ignored SDKs, binaries and private runtime captures are
not part of this source publication.

Canonical source changes are synchronized with
`node scripts/sync-hosted-game.js`; tests enforce byte-identical hosted mirrors.
The source-package CI uploads a downloadable source ZIP. Source packages do
not substitute for deploying the playable Pages site.

## Licence and source preservation

The combined game is GPL-3.0-or-later, with file-specific notices and third-party
terms retained in [ATTRIBUTION.md](ATTRIBUTION.md), [LICENSE](LICENSE) and
[COPYING-GPL-3](COPYING-GPL-3). Making the repository public does not relicense
upstream components. No new licence is selected for the separate public shell.
