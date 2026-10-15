#!/bin/bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
set -eo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
case "${1:-build}" in
    smoke) exec node "$root/flycast-smoke.js" ;;
    build) ;;
    *) echo "Usage: bash homebrew/native-flycast.sh [build|smoke]" >&2; exit 2 ;;
esac
test "$(uname -s)" = Darwin && test "$(uname -m)" = arm64 || {
    echo "This native runtime build is scoped to macOS arm64." >&2; exit 2;
}
for tool in git cmake xcrun; do
    command -v "$tool" >/dev/null || { echo "Required build tool missing: $tool" >&2; exit 2; }
done
source="$root/.deps/flycast"
revision=80471d57b02606f53828daa916de6ecc94ca1877
patch="$root/runtime/flycast-automation-macos.patch"
if test ! -d "$source"; then
    mkdir -p "$root/.deps"
    git init "$source"
    git -C "$source" remote add origin https://github.com/flyinghead/flycast.git
    git -C "$source" fetch --depth 1 origin "$revision"
    git -C "$source" checkout --detach FETCH_HEAD
fi
test "$(git -C "$source" rev-parse HEAD)" = "$revision" &&
test "$(git -C "$source" remote get-url origin)" = https://github.com/flyinghead/flycast.git || {
    echo "Unexpected native Flycast revision or origin." >&2; exit 2;
}
git -C "$source" diff --cached --quiet || {
    echo "Unexpected staged runtime source changes." >&2; exit 2;
}
if git -C "$source" diff --quiet HEAD --; then
    git -C "$source" apply --check "$patch"
    git -C "$source" apply "$patch"
else
    git -C "$source" diff HEAD -- | cmp -s "$patch" - || {
        echo "Runtime differs from the pinned source plus the declared compatibility patch." >&2; exit 2;
    }
fi
git -C "$source" submodule update --init --recursive --depth 1 \
    core/deps/SDL core/deps/libchdr core/deps/asio core/deps/libjuice \
    core/deps/websocketpp core/deps/rcheevos core/deps/tinygettext \
    core/deps/freetype core/deps/Syphon core/deps/DreamPicoPort-API
build="$root/.deps/flycast-build-arm64"
cmake -S "$source" -B "$build" -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES=arm64 \
    -DCMAKE_PROJECT_flycast_INCLUDE="$root/flycast-macos.cmake" \
    -DZLIB_LIBRARY="$(xcrun --show-sdk-path)/usr/lib/libz.tbd" \
    -DUSE_VULKAN=OFF -DUSE_BREAKPAD=OFF -DUSE_LUA=OFF -DUSE_DISCORD=OFF \
    -DUSE_OPENMP=OFF -DUSE_HOST_LIBZIP=OFF -DTEST_AUTOMATION=ON -DENABLE_LOG=ON
cmake --build "$build" --parallel 2
git -C "$source" submodule status --recursive > "$build/dependency-revisions.txt"
file "$build/Flycast.app/Contents/MacOS/Flycast"
shasum -a 256 "$build/Flycast.app/Contents/MacOS/Flycast"
