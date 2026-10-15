# Archived homebrew experiment

The KallistiOS guest/native Flycast replay and stopped WASM guest experiment
are superseded. Read the [archived experiment guide](../archive/docs/homebrew-guest.md).
Source, toolchain records, native helpers and notices remain here for existing
build/test paths and provenance. Ignored SDKs and build artifacts are untouched.

From the repository root, `npm run test:homebrew` runs the host C tests and
builds the worker. It does not boot Flycast or validate a browser port.

The selected future rebuild is a
[direct-game Flycast fork](../engine/README.md#selected-rebuild-direct-game-flycast-fork),
native first, not yet implemented. The current browser campaign remains canonical.
