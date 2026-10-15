# Hosted Hail application

This is the separate hosted control/application surface, not the canonical
game source. The live campaign is human-only, third-person/isometric.
The native-first direct-game Flycast replacement is selected but unimplemented.

From the repository root, run `node scripts/sync-hosted-game.js` after canonical
edits. It updates `lib/game/`, `public/game/` and `game-source-hashes.json`,
including the archive index, and removes retired manifest-owned mirror files.
Do not edit mirrored source directly.

From `hosted/`, use the existing `npm run install:ci` when restoring dependencies,
then `npm run dev`, or `npm run build` followed by `npm start` for the local built
Worker. Keep local previews on loopback. These commands do not publish a site.
Preserve the runtime/profile scripts, CommonJS game boundary, vendor notices,
D1 schema/migrations and hosting configuration.

See [the current handoff](GAME_REPAIR.md) for service and release boundaries.
The [old starter guide](../archive/docs/hosted-starter.md) and
[earlier repair snapshot](../archive/docs/hosted-repair-handoff.md) are historical.
Deployment is a separate owner-authorized action; this cleanup does not deploy.
