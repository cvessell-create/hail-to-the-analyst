// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include "slice.h"

static const char layout[HAIL_GRID][HAIL_GRID + 1] = {
    "########",
    "#......#",
    "#..#...#",
    "#..#...#",
    "#......#",
    "#.##...#",
    "#......#",
    "########"
};

int hail_wall(int x, int y) {
    return x < 0 || y < 0 || x >= HAIL_GRID || y >= HAIL_GRID || layout[y][x] == '#';
}

void hail_reset(HailSlice *state) {
    *state = (HailSlice){HAIL_UNIT, HAIL_UNIT, 0, 0, 0};
}

int hail_step(HailSlice *state, int dx, int dy) {
    int x, y;
    if (dx < -1 || dx > 1 || dy < -1 || dy > 1 || (dx != 0 && dy != 0))
        return -1;
    if (state->complete)
        return 0;
    ++state->ticks;
    x = state->x + dx * HAIL_UNIT;
    y = state->y + dy * HAIL_UNIT;
    if (hail_wall(x / HAIL_UNIT, y / HAIL_UNIT))
        return 0;
    state->x = x;
    state->y = y;
    if (x == 6 * HAIL_UNIT && y == HAIL_UNIT) state->collected |= 1;
    if (x == HAIL_UNIT && y == 6 * HAIL_UNIT) state->collected |= 2;
    if (x == 6 * HAIL_UNIT && y == 6 * HAIL_UNIT && state->collected == 3)
        state->complete = 1;
    return dx != 0 || dy != 0;
}

int hail_screen_x(int x, int y) { return 320 + (x - y) * 24 / HAIL_UNIT; }
int hail_screen_y(int x, int y) { return 80 + (x + y) * 12 / HAIL_UNIT; }

static void put32(unsigned char *out, uint32_t value) {
    unsigned int i;
    for (i = 0; i < 4; ++i) out[i] = (unsigned char)(value >> (i * 8));
}
static uint32_t get32(const unsigned char *in) {
    return (uint32_t)in[0] | ((uint32_t)in[1] << 8) |
           ((uint32_t)in[2] << 16) | ((uint32_t)in[3] << 24);
}

void hail_save(const HailSlice *state, unsigned char output[HAIL_SAVE_BYTES]) {
    put32(output, 0x48414931);
    put32(output + 4, (uint32_t)state->x);
    put32(output + 8, (uint32_t)state->y);
    put32(output + 12, state->ticks);
    put32(output + 16, state->collected);
    put32(output + 20, (uint32_t)state->complete);
}

int hail_load(HailSlice *state, const unsigned char input[HAIL_SAVE_BYTES]) {
    uint32_t x = get32(input + 4), y = get32(input + 8);
    uint32_t collected = get32(input + 16), complete = get32(input + 20);
    if (get32(input) != 0x48414931 || x >= HAIL_GRID * HAIL_UNIT ||
        y >= HAIL_GRID * HAIL_UNIT || x % HAIL_UNIT || y % HAIL_UNIT ||
        hail_wall((int)x / HAIL_UNIT, (int)y / HAIL_UNIT) ||
        collected > 3 || complete > 1 ||
        (complete && (collected != 3 || x != 6 * HAIL_UNIT || y != 6 * HAIL_UNIT)))
        return -1;
    *state = (HailSlice){(int)x, (int)y, get32(input + 12), collected, (int)complete};
    return 0;
}
