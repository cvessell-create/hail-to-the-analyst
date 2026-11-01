// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "../../homebrew/slice.h"

typedef enum {
    HailActionUp,
    HailActionDown,
    HailActionLeft,
    HailActionRight,
    HailActionOk,
} HailAction;

typedef enum {
    HailFeedbackExplore,
    HailFeedbackWall,
    HailFeedbackCollected,
    HailFeedbackExtract,
    HailFeedbackComplete,
} HailFeedback;

HailFeedback hail_apply_action(HailSlice* state, HailAction action);
