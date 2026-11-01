// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include "game_rules.h"

HailFeedback hail_apply_action(HailSlice* state, HailAction action) {
    if(state->complete) {
        if(action == HailActionOk) {
            hail_reset(state);
            return HailFeedbackExplore;
        }
        return HailFeedbackComplete;
    }
    int dx = 0, dy = 0;
    switch(action) {
    case HailActionUp: dy = -1; break;
    case HailActionDown: dy = 1; break;
    case HailActionLeft: dx = -1; break;
    case HailActionRight: dx = 1; break;
    case HailActionOk:
        return state->collected == 3 ? HailFeedbackExtract : HailFeedbackExplore;
    default: return HailFeedbackExplore;
    }
    unsigned int previous = state->collected;
    int moved = hail_step(state, dx, dy);
    if(state->complete) return HailFeedbackComplete;
    if(!moved) return HailFeedbackWall;
    if(state->collected == 3) return HailFeedbackExtract;
    if(state->collected != previous) return HailFeedbackCollected;
    return HailFeedbackExplore;
}
