#!/bin/bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
set -eo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
revision=568c3404c292a941bcf550465bd968f4fa249aa2
kos="$root/.deps/kos"
prefix="$root/.deps/sh-elf"
export PATH="/opt/homebrew/opt/texinfo/bin:/opt/homebrew/opt/gettext/bin:$PATH"
for tool in git curl make cc makeinfo; do
    command -v "$tool" >/dev/null || { echo "Required build tool missing: $tool" >&2; exit 2; }
done
if test ! -d "$kos"; then
    mkdir -p "$root/.deps"
    git clone --filter=blob:none --no-checkout https://github.com/KallistiOS/KallistiOS.git "$kos"
    git -C "$kos" checkout --detach "$revision"
fi
test "$(git -C "$kos" rev-parse HEAD)" = "$revision" || {
    echo "KOS checkout differs from reviewed revision; refusing to replace it." >&2; exit 2;
}
test "$(git -C "$kos" remote get-url origin)" = "https://github.com/KallistiOS/KallistiOS.git" || {
    echo "Unexpected KOS source origin." >&2; exit 2;
}
git -C "$kos" diff --quiet "$revision" -- || {
    echo "Tracked KOS sources differ from the reviewed checkout." >&2; exit 2;
}
for helper in config.guess config.sub; do
    if test ! -s "$kos/utils/kos-chain/$helper"; then
        curl --fail --location --max-time 60 \
            "https://raw.githubusercontent.com/gcc-mirror/gcc/releases/gcc-15.2.0/$helper" \
            -o "$kos/utils/kos-chain/$helper"
    fi
done
chmod +x "$kos/utils/kos-chain/config.guess"
make -C "$kos/utils/kos-chain" config_file=Makefile.dreamcast.cfg platform=dreamcast toolchain_profile=stable \
    toolchain_path="$prefix" force_downloader=curl download_protocol=https \
    gnu_mirror=ftp.gnu.org makejobs=2 verbose=0 erase=0 enable_cpp=0 enable_objc=0 enable_objcpp=0
export KOS_ARCH=dreamcast
export KOS_BASE="$kos"
export KOS_CC_BASE="$prefix"
export KOS_CC_PREFIX=sh-elf
export KOS_PORTS="$root/.deps/kos-ports"
export DC_ARM_BASE="$root/.deps/arm-eabi"
export DC_ARM_PREFIX=arm-eabi
export DC_TOOLS_BASE="$root/.deps/bin"
export KOS_MAKE=make
export KOS_CFLAGS="-O2 -fno-PIC -fno-PIE"
export KOS_CPPFLAGS="" KOS_LDFLAGS="" KOS_AFLAGS="" KOS_INC_PATHS=""
. "$KOS_BASE/environ_base.sh"
brew_root="$(brew --prefix)"
CPATH="$brew_root/include:$brew_root/opt/jpeg-turbo/include" \
LIBRARY_PATH="$brew_root/lib:$brew_root/opt/jpeg-turbo/lib" \
    make -C "$KOS_BASE/utils" -j2
make -C "$KOS_BASE/kernel" -j2
make -C "$KOS_BASE/addons" -j2
make -C "$root" dreamcast
file "$root/build/hail-slice.elf"
shasum -a 256 "$root/build/hail-slice.elf"
