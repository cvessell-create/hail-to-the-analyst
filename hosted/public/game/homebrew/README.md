# Archive: original Hail homebrew engine slice

## Archived experiment

The selected rebuild is now a source-level reconstruction of Hail inside a
modified Flycast game engine, not a guest boot. See the
[direct-game rebuild direction](../engine/README.md#selected-rebuild-direct-game-flycast-fork).
This directory preserves the earlier KallistiOS slice and native guest test.
It is outside the current game setup.

This original GPL-3.0-or-later C engine is separate from the current playable
JavaScript campaign. It is a bounded migration slice, not the complete campaign.
The same `slice.c` runs in a native test/worker and in a KallistiOS guest.

Implemented: fixed integer movement, walls, two collectibles, extraction,
immutable third-person/isometric projection and versioned save/load validation.
The KOS frontend uses procedural framebuffer tiles and a visible player avatar.
D-pad moves one tile per press; A saves in RAM, B restores, X resets, Start exits.
There are no first-person modes or imported game art, BIOS or ROMs.

```sh
make -C homebrew host-test host-worker
make -C homebrew dreamcast
bash homebrew/native-build.sh
```

Dreamcast building requires an activated KOS SH4 environment with `KOS_BASE`
and `kos-cc`. `Makefile.kos` compiles the original guest to
`build/hail-slice.elf`. A host build is not a Dreamcast boot result.

`native-build.sh` prepares the pinned SDK and C-only SH4 toolchain under the
ignored `.deps/` directory, builds KOS and then the original ELF.
The cross-compiler stays in this checkout. Compiler components follow the
pinned SDK's stable profile; transitive source checks are incomplete.

Source/API review: KallistiOS
`568c3404c292a941bcf550465bd968f4fa249aa2`, `dc/video.h`,
`dc/maple/controller.h` and the hello example Makefile. No example code was
copied. API declarations were opened through canonical GitHub contents.
The SDK's core KOS licence and component licensing guide were opened; preserve
the KOS licence and AUTHORS when distributing a linked guest.

Flycast WASM candidate: `nasomers/flycast-wasm`
`16e9c7b4b7065a4bd42e7490e8aab3e9283d5415`. Its selected build relies on
a precompiled `flycast_stubs.o` whose source/build path has not been found in
the reviewed tree. Its README requires supplied BIOS; an upstream REIOS ELF
branch does not establish that this particular WASM build boots BIOS-free.
The later local source build bypassed that stub entirely and linked with an
original separate frontend. It still produced a black browser canvas and no
guest telemetry, so browser boot was not accepted. That stopped experiment
and its cached binaries are not included here. Do not distribute the opaque
stub without completing its review.

## Native guest boot experiment

The original ELF now links and boots through upstream Flycast REIOS without
supplying a Sega BIOS. A bounded 21-action SH4 controller replay matches the
native C worker at every step, including the blocked wall move, both
collectibles and completed extraction. The runtime captured a 640x480 PNG;
inspection showed the isometric board and white avatar on the green exit.
This is native guest execution, not a WASM-port boot or a completed campaign.

Reproduce the archived native test:

```sh
bash homebrew/native-flycast.sh build
bash homebrew/native-flycast.sh smoke
```

The native build requires CMake, Git and Apple's command-line tools on arm64
macOS. Its exact upstream revision, initialized submodule revisions and local
compatibility patch are retained. The patch fixes macOS automation integer
types and bounds an input token; no guest/game logic is replaced in the
emulator. A CMake parent-scope language hook and an actual SDK zlib path allow
the Unix Makefiles build without Xcode.

The smoke test uses a fresh isolated HOME, disables configured networking,
UPnP, achievements and crash uploads, and terminates within 90 seconds.
It saves logs, replay input, hashes, a screenshot and the exact state comparison
under ignored `build/flycast-smoke-*/`. These settings are not an OS network
sandbox. A failed boot or mismatch raises an error rather than reporting success.
Save/load is tested in the host engine; the current SH4 replay tests movement
and extraction, not save/load button behavior.

Native emulator helpers and `runtime/` notices/patch are private-development
files, deliberately excluded from the curated original guest-source exports.
They neither change the public shell's pending licence nor publish a runtime.
The existing campaign remains canonical while the direct-game engine fork
is developed. The source-built browser guest experiment linked locally but
showed a black canvas without guest telemetry; that experiment was stopped
when the owner corrected the rebuild target.
