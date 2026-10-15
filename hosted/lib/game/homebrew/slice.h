// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#ifndef HAIL_SLICE_H
#define HAIL_SLICE_H
#include <stdint.h>

#define HAIL_GRID 8
#define HAIL_UNIT 256
#define HAIL_SAVE_BYTES 24
typedef struct {
    int x, y;
    uint32_t ticks;
    unsigned int collected;
    int complete;
} HailSlice;

void hail_reset(HailSlice *state);
int hail_step(HailSlice *state, int dx, int dy);
int hail_wall(int x, int y);
int hail_screen_x(int x, int y);
int hail_screen_y(int x, int y);
void hail_save(const HailSlice *state, unsigned char output[HAIL_SAVE_BYTES]);
int hail_load(HailSlice *state, const unsigned char input[HAIL_SAVE_BYTES]);
#endif
