// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <stdio.h>
#include <string.h>
#include "slice.h"

int main(void) {
    char line[128], extra;
    int dx, dy;
    HailSlice state;
    hail_reset(&state);
    while (fgets(line, sizeof(line), stdin)) {
        if (strcmp(line, "reset\n") == 0) hail_reset(&state);
        else if (sscanf(line, "step %d %d %c", &dx, &dy, &extra) == 2) {
            if (hail_step(&state, dx, dy) < 0) {
                puts("{\"error\":\"Invalid cardinal action\"}");
                fflush(stdout);
                continue;
            }
        } else {
            puts("{\"error\":\"Unknown homebrew operation\"}");
            fflush(stdout);
            continue;
        }
        printf("{\"engine\":\"hail-homebrew-slice/v1\",\"camera\":\"third-person-iso\","
               "\"x\":%d,\"y\":%d,\"ticks\":%u,\"collected\":%u,\"complete\":%s}\n",
               state.x, state.y, state.ticks, state.collected,
               state.complete ? "true" : "false");
        fflush(stdout);
    }
    return ferror(stdin) ? 2 : 0;
}
