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

Recharts is pinned to `3.10.1`, with package-manager overrides for Immer
`11.1.9` (AIKIDO-2026-445255) and es-toolkit `1.51.0`
(AIKIDO-2026-523264) in both npm and pnpm. The exact Immer pin is intentional:
the `11.1.9` prototype-access protection was reverted upstream in `11.1.12`.
Re-evaluate that protection before changing the pin.
See the [Immer advisory](https://intel.aikido.dev/cve/AIKIDO-2026-445255),
[upstream revert](https://github.com/immerjs/immer/releases/tag/v11.1.12) and
[es-toolkit advisory](https://intel.aikido.dev/cve/AIKIDO-2026-523264).
The engine CI workflow disables checkout credential persistence and retains
read-only contents permissions. Its two embedded copies are generated from
the canonical workflow by the mirror synchronizer.

The separate autonomous arena agent compares session bearer tokens using
`timingSafeEqual` on fixed-size SHA-256 digests, rejecting empty/non-string
candidates. This protects the token equality operation, not the timing of the
entire session search, and does not add automation to the human-only campaign.

The canonical audit and tuning CLIs confine file paths to the game repository
and reject symlink components. Relative CLI paths retain their working-directory
meaning. Stage external loop-model JSON inside the repository before running
`node scripts/build-level-tuning.js <repository-report.json> [repository-out.js]`;
the default output remains `engine/level-tuning.js`, and provenance records the
actual input's repository-relative path and SHA-256. Audit output defaults to
`audit/`; custom output directories must also stay inside the repository.
The mirror synchronizer validates recursive source and destination paths too.
These checks assume the local checkout is not concurrently modified by an
adversary; they are not an OS-level filesystem sandbox.

The pnpm lock holder derives the configured runtime root's `install.lock`
and the fixed `/workspace/.sites-runtime/pnpm-store.seed.lock` internally.
`--hold-install-locks` accepts no additional CLI arguments; its shell caller
uses the same path-free interface. Runtime configuration
(`SITES_RUNTIME_ROOT`, defaulting to `.sites-runtime` in the project) is trusted
operator input and must be absolute with no `..` segments. Symlinked parent directories
are rejected before opening a lock; final-entry symlinks remain blocked by
`O_NOFOLLOW`. Lock directories must already exist and must not be concurrently
renamed or replaced by an untrusted process.
The dedicated holder anchors its working directory before opening only literal
lock basenames; package-progress reporting uses the installer's working directory
and does not resolve a caller-supplied path.
Run the isolated path/CLI regressions from the repository root with
`node --test hosted/scripts/pnpm-install.test.mjs`. Actual Linux `flock`
contention and deployment are separate checks, not established by these tests.
`SITES_PNPM_STORE_LOCK_TIMEOUT` defaults to 30 seconds and must be a nonnegative
finite decimal number; invalid values fail before any lock is opened.

Both package-manager policies pin all transitive Sharp dependencies to `0.35.5`
for [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
including the Next.js image optimizer and Miniflare dependency routes. Both
lockfiles include the patched prebuilt binaries (`sharp-libvips` `1.3.4`).
Globally installed libvips/librsvg is a separate operator responsibility: the
advisory requires librsvg `2.63.2` or newer there.
Run `node --test hosted/scripts/dependency-security.test.mjs` from the repository
root to check these pins and lockfile entries when changing dependencies.
Next.js and its ESLint configuration are pinned to `16.4.1`, which fixes
[GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) and
[GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).

See [the current handoff](GAME_REPAIR.md) for service and release boundaries.
The [old starter guide](../archive/docs/hosted-starter.md) and
[earlier repair snapshot](../archive/docs/hosted-repair-handoff.md) are historical.
Deployment is a separate owner-authorized action; this cleanup does not deploy.
