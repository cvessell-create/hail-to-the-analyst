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

The pnpm lock holder accepts only the configured runtime root's `install.lock`
and `/workspace/.sites-runtime/pnpm-store.seed.lock`. Runtime configuration
(`SITES_RUNTIME_ROOT`, defaulting to `.sites-runtime` in the project) is trusted
operator input, not a way for CLI lock arguments to select arbitrary files.
Relative paths, `..` segments, other filenames and symlinked parent directories
are rejected before opening a lock; final-entry symlinks remain blocked by
`O_NOFOLLOW`. Lock directories must already exist and must not be concurrently
renamed or replaced by an untrusted process.
Run the isolated path/CLI regressions from the repository root with
`node --test hosted/scripts/pnpm-install.test.mjs`. Actual Linux `flock`
contention and deployment are separate checks, not established by these tests.

Both package-manager policies pin all transitive Sharp dependencies to `0.35.5`
for [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
including the Next.js image optimizer and Miniflare dependency routes. Both
lockfiles include the patched prebuilt binaries (`sharp-libvips` `1.3.4`).
Globally installed libvips/librsvg is a separate operator responsibility: the
advisory requires librsvg `2.63.2` or newer there.
Run `node --test hosted/scripts/dependency-security.test.mjs` from the repository
root to check these pins and lockfile entries when changing dependencies.

See [the current handoff](GAME_REPAIR.md) for service and release boundaries.
The [old starter guide](../archive/docs/hosted-starter.md) and
[earlier repair snapshot](../archive/docs/hosted-repair-handoff.md) are historical.
Deployment is a separate owner-authorized action; this cleanup does not deploy.
