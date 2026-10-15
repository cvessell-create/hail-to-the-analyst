# Current hosted source handoff

Canonical source lives at the repository root. Run
`node scripts/sync-hosted-game.js` there after edits; both `hosted/lib/game`
(server imports) and `hosted/public/game` (browser assets) are generated mirrors.
The library's CommonJS boundary and hosted app's ESM boundary remain separate.
`game-source-hashes.json` registers current source; audit manifests are historical.

The solo campaign has seven missions and a locked third-person/isometric camera.
Legacy first-person/autopilot URL options do not enable those modes. There is
no campaign framework chat or automation driver. Tactical checkpoint compatibility
remains, with first-person presentation disabled. Development services and
the development console are separate from player entry.

Keep authoritative arena services, persistence, prediction, request-clock
handling, loot/economy effects and consent/export/delete controls intact.
The D1 binding and supplied rooms migration support the hosted arena.
Game credits are not money. Local artifact previews do not upload or mint NFTs.

Use [README.md](README.md) for hosted commands and [the root guide](../README.md)
for current gameplay. The [earlier repair handoff](../archive/docs/hosted-repair-handoff.md)
is preserved byte-identically as history, not current behavior.
No deployment, native engine integration or browser guest boot is verified by
source synchronization or Node tests.
