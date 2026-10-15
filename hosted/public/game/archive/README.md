# Superseded experiments

Reference material, not the active setup or campaign. The live game remains
human-only. The selected future direction is a direct-game Flycast fork,
native first; it is not implemented. Nothing here activates that rebuild.

| Former path | Archived path | Reason |
| --- | --- | --- |
| `engine/demo.html` | [demos/raycaster.html](demos/raycaster.html) | Early first-person raycaster demo; replaced by the current campaign/workbench |
| `scripts/build-agent.js` | [scripts/build-agent.js](scripts/build-agent.js) | Unused optimization/report experiment |
| `scripts/autonomous-interop.js` | [scripts/autonomous-interop.js](scripts/autonomous-interop.js) | Development implementation archived; original CLI/import path retained as a compatibility wrapper |
| `docs/build-agent-report.json` | [docs/build-agent-report.json](docs/build-agent-report.json) | Historical snapshot, byte-identical; not current verification |
| `homebrew/README.md` | [docs/homebrew-guest.md](docs/homebrew-guest.md) | Superseded KOS/native guest and stopped WASM experiment |
| `hosted/README.md` | [docs/hosted-starter.md](docs/hosted-starter.md) | Generic starter guide; retained as historical reference |
| `hosted/GAME_REPAIR.md` | [docs/hosted-repair-handoff.md](docs/hosted-repair-handoff.md) | Earlier FPS-era repair handoff; not current camera/setup instructions |

Run historical commands only deliberately, from the repository root. The demo
resolves assets against `engine/`; archived tools still import canonical modules.
The build tool's old `OPTIMAL`/test-count strings are historical assertions, not
test results; it now writes to ignored `outputs/`, not the preserved snapshot.
The starter and repair documents retain their original text, including obsolete
paths and behavior. Use the current [README](../README.md) and
[hosted guide](../hosted/README.md) instead.

## Retained dependencies, not relocation candidates

- `homebrew/` code, Makefiles, toolchain records, native helpers, notices and
  patches stay at their original paths: `test:homebrew`, relative build roots,
  provenance paths and ignored SDK/build caches depend on them. No SDK/cache
  or binary was moved or added to exports.
- `engine/nes-visual.js` stays for its direct test/import contract.
  `js/emulation-engine.js` and `vendor/jsnes/` remain dependencies of
  `engine/core.js`, the workbench and legacy mission behavior. The companion
  display is not mounted in the campaign.
- Autopilot, dialogue, corpus and formula development modules retain their
  tested import paths. Active development services/console and arena services
  remain in place; none is reintroduced into the campaign.
- `scripts/autonomous-interop.js` remains the cross-repository development
  CLI/CommonJS entry, delegating to the archived implementation. Framework
  callers may continue using `node scripts/autonomous-interop.js --steps=15`;
  it runs a separate bounded loopback arena session, not the human campaign.
- Tactical save compatibility, original `audit/` sources (including slides),
  licenses, preferred vendor source and package history remain unchanged.
  Audit copies are evidence records, not superseded documentation to rewrite.

Local reference review covered tracked docs, scripts, package/CI commands,
engine/player entry points, server imports and tests, excluding generated
mirrors from consumer searches. No external lookup, native/WASM boot, hosted
deployment or wallet/network onboarding was performed for this cleanup.
