// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <kos.h>
#include <dc/video.h>
#include <dc/maple/controller.h>
#include "slice.h"

KOS_INIT_FLAGS(INIT_DEFAULT);

static void pixel(int x, int y, uint16_t colour) {
    if (x >= 0 && x < 640 && y >= 0 && y < 480) vram_s[y * 640 + x] = colour;
}
static void tile(int x, int y, uint16_t colour) {
    int row, col;
    for (row = -11; row <= 11; ++row) {
        int half = 22 - (row < 0 ? -row : row) * 2;
        for (col = -half; col <= half; ++col) pixel(x + col, y + row, colour);
    }
}
static void render(const HailSlice *state) {
    int x, y;
    vid_clear(12, 18, 24);
    for (y = 0; y < HAIL_GRID; ++y) for (x = 0; x < HAIL_GRID; ++x) {
        uint16_t colour = hail_wall(x, y) ? 0x39e7 : 0x1269;
        if ((x == 6 && y == 1 && !(state->collected & 1)) ||
            (x == 1 && y == 6 && !(state->collected & 2))) colour = 0xffe0;
        if (x == 6 && y == 6) colour = state->complete ? 0x07e0 : 0xf800;
        tile(hail_screen_x(x * HAIL_UNIT, y * HAIL_UNIT),
             hail_screen_y(x * HAIL_UNIT, y * HAIL_UNIT), colour);
    }
    x = hail_screen_x(state->x, state->y);
    y = hail_screen_y(state->x, state->y);
    for (int row = -20; row < -3; ++row)
        for (int col = -4; col <= 4; ++col) pixel(x + col, y + row, 0xffff);
}

int main(void) {
    HailSlice state;
    uint32_t previous = 0;
    unsigned char saved[HAIL_SAVE_BYTES];
    int has_save = 0;
    hail_reset(&state);
    vid_init(DM_640x480, PM_RGB565);
    render(&state);
    printf("HAIL_READY camera=ISOMETRIC_THIRD_PERSON\n");
    for (;;) {
        maple_device_t *device = maple_enum_type(0, MAPLE_FUNC_CONTROLLER);
        cont_state_t *controller = device ? maple_dev_status(device) : NULL;
        uint32_t buttons = controller ? controller->buttons : 0;
        uint32_t pressed = buttons & ~previous;
        if (pressed & CONT_START) break;
        if (pressed & CONT_A) { hail_save(&state, saved); has_save = 1; }
        if ((pressed & CONT_B) && has_save && hail_load(&state, saved) != 0)
            return 2;
        if (pressed & CONT_X) hail_reset(&state);
        if (pressed & CONT_DPAD_UP) hail_step(&state, 0, -1);
        else if (pressed & CONT_DPAD_DOWN) hail_step(&state, 0, 1);
        else if (pressed & CONT_DPAD_LEFT) hail_step(&state, -1, 0);
        else if (pressed & CONT_DPAD_RIGHT) hail_step(&state, 1, 0);
        vid_waitvbl();
        render(&state);
        if (pressed)
            printf("HAIL_STATE x=%d y=%d collected=%u complete=%d\n",
                   state.x, state.y, state.collected, state.complete);
        previous = buttons;
    }
    return 0;
}
