# HAIL TO THE ANALYST

A Duke Nukem 3D-style retro FPS homage starring **Jack Slade**, a Strategic Intelligence operative, against the disinformation syndicate **The Fabricators**.

> "It's time to kick ass and verify sources."

## Play

**No build, no dependencies.** The entire game is a single self-contained `index.html` — no external assets, no network calls, no real LLM API. Open it in any modern browser:

```bash
# Just open it
open index.html

# or serve it (recommended on mobile)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on desktop and iPhone. For the best experience on mobile, use the touch controls.

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

Two missions, four enemy types, three weapons:

- **Missions** — `THE ARCHIVE`: infiltrate, collect red/blue keycards and intel caches; `FABRICATION PLANT`: fight through to **THE FABRICATOR** boss.
- **Weapons** — Sidearm, Breacher shotgun (pellet spread), Redactor (rapid-fire).
- **Enemies** — Mole, Disinfo Drone, Troll, and **THE FABRICATOR** boss with multi-phase attacks.
- **Pickups** — health, armor, ammunition, Intel Caches, red/blue keycards.

## Tech

- Canvas raycaster: ASCII grid maps, DDA wall casting, procedural textures and sprites, billboard enemies/pickups, z-buffering, fixed-timestep updates.
- **Chatter Engine**: deterministic, template-based "LLM element" — context-aware enemy taunts (idle, aggro, damaged, dying) and intel-style mission briefings generated from mission state. All local, no API calls.
- Enemy AI: state machines (idle → patrol → chase → attack → die) with line-of-sight via the same DDA raycast the renderer uses — enemies can't see through walls either.
- Synthesized WebAudio: all sound effects generated in code.
- HUD, minimap, title/briefing/pause/death/victory screens, score and accuracy tracking.

## Publish as a playable site

This repo is GitHub Pages-ready: enable Pages on the `main` branch in repo settings, and play the game at [cvessell-create.github.io/hail-to-the-analyst](https://cvessell-create.github.io/hail-to-the-analyst/).

## License

Apache-2.0 — see [LICENSE](LICENSE).
