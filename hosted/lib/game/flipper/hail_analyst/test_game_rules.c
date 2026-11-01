// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include "game_rules.h"

int main(void) {
    HailSlice state;
    hail_reset(&state);
    assert(hail_apply_action(&state, HailActionLeft) == HailFeedbackWall);
    assert(state.x == HAIL_UNIT && state.ticks == 1);
    assert(hail_apply_action(&state, HailActionOk) == HailFeedbackExplore);
    assert(state.ticks == 1);
    for(int i = 0; i < 4; ++i) hail_apply_action(&state, HailActionRight);
    assert(hail_apply_action(&state, HailActionRight) == HailFeedbackCollected);
    assert(state.collected == 1);
    for(int i = 0; i < 5; ++i) hail_apply_action(&state, HailActionLeft);
    for(int i = 0; i < 4; ++i) hail_apply_action(&state, HailActionDown);
    assert(hail_apply_action(&state, HailActionDown) == HailFeedbackExtract);
    assert(state.collected == 3 && !state.complete);
    for(int i = 0; i < 4; ++i) hail_apply_action(&state, HailActionRight);
    assert(hail_apply_action(&state, HailActionRight) == HailFeedbackComplete);
    assert(state.complete && state.ticks == 21);
    assert(hail_apply_action(&state, HailActionLeft) == HailFeedbackComplete);
    assert(state.ticks == 21);
    assert(hail_apply_action(&state, HailActionOk) == HailFeedbackExplore);
    assert(state.collected == 0 && state.ticks == 0 && !state.complete);
    for(int i = 0; i < 2; ++i) hail_apply_action(&state, HailActionDown);
    hail_apply_action(&state, HailActionRight);
    assert(hail_apply_action(&state, HailActionRight) == HailFeedbackWall);
    assert(state.x == 2 * HAIL_UNIT && state.y == 3 * HAIL_UNIT);
    puts("Flipper game rules: walls, collection, extraction, freeze and restart passed");
    return 0;
}
