// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <string.h>
#include "slice.h"

int main(void) {
    HailSlice state, restored, unchanged;
    unsigned char bytes[HAIL_SAVE_BYTES];
    hail_reset(&state);
    assert(hail_step(&state, -1, 0) == 0 && state.x == HAIL_UNIT);
    assert(hail_step(&state, 1, 1) == -1 && state.ticks == 1);
    assert(hail_step(&state, 2, 0) == -1);
    assert(hail_screen_x(HAIL_UNIT, 0) > hail_screen_x(0, 0));
    assert(hail_screen_x(0, HAIL_UNIT) < hail_screen_x(0, 0));
    for (int i = 0; i < 5; ++i) assert(hail_step(&state, 1, 0) == 1);
    assert(state.collected == 1);
    hail_save(&state, bytes);
    assert(hail_load(&restored, bytes) == 0);
    assert(restored.x == state.x && restored.collected == state.collected &&
           restored.ticks == state.ticks);
    unchanged = restored;
    bytes[0] = 0;
    assert(hail_load(&restored, bytes) == -1);
    assert(restored.x == unchanged.x && restored.ticks == unchanged.ticks);
    for (int i = 0; i < 5; ++i) hail_step(&state, -1, 0);
    for (int i = 0; i < 5; ++i) hail_step(&state, 0, 1);
    assert(state.collected == 3 && !state.complete);
    for (int i = 0; i < 5; ++i) hail_step(&state, 1, 0);
    assert(state.complete);
    unchanged = state;
    assert(hail_step(&state, -1, 0) == 0 && state.ticks == unchanged.ticks);
    hail_save(&state, bytes);
    assert(hail_load(&restored, bytes) == 0 && restored.complete);
    bytes[16] = 0;
    assert(hail_load(&restored, bytes) == -1);
    assert(hail_wall(-1, 0) && hail_wall(HAIL_GRID, 0));
    return 0;
}
