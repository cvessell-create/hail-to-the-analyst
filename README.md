# Hail to the Analyst

Original game and simulation research by Christopher R. Vessell.

**[PLAY THE GAME](https://cvessell-create.github.io/hail-to-the-analyst/)**
| [Engine and research guide](engine/README.md)
| [Framework research](https://github.com/cvessell-create/VessellFramework_Local_Rebuild)
| [Attribution](ATTRIBUTION.md)

## For reviewers

The browser campaign is playable. The native desktop rebuild is planned.
This repository is public for academic review.

| Component | Current state |
| --- | --- |
| Browser game | Seven solo missions, third-person/isometric camera, combat, flight, progression, inventory, city hubs and optional Footprint Purge |
| Mathematics | Allocation, game theory, tactical methods, Vessell formula and traceable weight calculations |
| Development tools | AI/SI experiments and automation tests are separate from the playable campaign |
| Development console | Local AI/SI service checks, chat and run-collectible metadata preview/download |
| Replacement engine | Modified Flycast direct-game engine, upgraded stylized 3D art/maps/UI: selected direction, not yet implemented |
| Coinbase / NFTs | Planned mainnet integration; local metadata preview only. No wallet, payment, upload or mint implementation |

The full rebuild covers maps, art, gameplay, algorithms, formulas and inventory,
with AI/SI and backend services built in. Native desktop first, browser afterward.
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

The camera stays third-person/isometric. `V` and legacy
first-person URL options cannot change it. Renderer errors appear explicitly,
not as a first-person fallback. Desktop uses WASD/arrows, mouse aiming and the
displayed action controls; mobile provides touch controls. **M / HEX MAP**
shows the current mission's tactical minimap while gameplay continues.
The game has no autopilot or framework chatbot. **G / ROUTE** briefly marks
a suggested path; you still move, fight and interact yourself. The mission
objective stays on screen. Approach a door or exit and press **E / USE** when
its prompt appears; clearance cards and boss requirements still apply.
**ACTIONS** provides touch/click access to rolls, grenades, augments, hacking,
skills and inventory. Skills and inventory show readable buttons and prices.
On touch screens, hold **RUN** to sprint or **RAISE** to aim over low cover.
Menus suspend combat. Losing page focus pauses the game; use
**RESUME** to return. Held movement, fire and flight do not carry across menus.
**MAIN MENU** leaves the current run from gameplay, pause or a story screen.
Hero progression stays saved; deploying again starts a fresh run, not a resume.

The story, enemies and operations are fictional. Gateway Sprawl and Vessell
City are free-roam settings; Footprint Purge is an optional simulated exposure
side quest, not an account-removal tool. Game credits have gameplay purchasing
effects but are not money, cryptocurrency or redeemable assets.

## AI, data and backend boundaries

The playable campaign loads no automation driver, framework dialogue, owner
corpus or formula service. Legacy `?autopilot=1` links do not activate anything.
Route hints only draw a path; they never move, fight or spend skill points.
Development modules and their tests remain separate from gameplay.

The development console uses separately operated services. The local
Node server proxies its chat to `HAIL_SI_URL` (default loopback port 8790).
Generated text, owner-source selections and telemetry have separate labels.
SI levels use their own tests.

Gameplay-data collection defaults off. Consent, revoke/delete and local export
controls remain in the game. Chat submitted through the development console
is subject to that service's local memory policy; it is not part of the
browser-only gameplay-data store. No wallet keys belong in this repository.

The development console previews run metadata entered by the user.
Coinbase connection and NFT minting are planned. No uploads or transactions
are performed.

## Tests and source

```sh
npm test
npm run test:homebrew
```

Run the suite above for current results. CI records published runs.

Canonical source changes are synchronized with
`node scripts/sync-hosted-game.js`; tests enforce byte-identical hosted mirrors.
CI also produces a source ZIP.

## Archive

Earlier experiments remain in the repository for reference, outside the
current setup path:

- [KallistiOS C slice and native Flycast replay](homebrew/README.md):
  movement, collection and extraction test.
- Source-built WASM guest: linked locally, but stopped after a black canvas
  and no guest telemetry. Cached sources and binaries are excluded.
- [NES companion module](engine/nes-visual.js): legacy display module, removed
  from the campaign UI.
- Legacy tactical checkpoints: retained for saved-game compatibility.

These are not the replacement engine. Original source and research history
remain available.

## Licence and source preservation

The combined game is GPL-3.0-or-later, with file-specific notices and third-party
terms retained in [ATTRIBUTION.md](ATTRIBUTION.md), [LICENSE](LICENSE) and
[COPYING-GPL-3](COPYING-GPL-3). Making the repository public does not relicense
upstream components. No new licence is selected for the separate public shell.
