// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <furi.h>
#include <gui/gui.h>
#include <gui/view_port.h>
#include <input/input.h>
#include <stdio.h>
#include "campaign.h"

typedef struct {
    FuriMutex* mutex;
    FuriMessageQueue* keys;
    HailCampaign state;
} HailGame;

static void draw_marker(Canvas* canvas, int x, int y, const uint8_t pixels[5]) {
    for(int row = 0; row < 5; ++row) {
        for(int column = 0; column < 5; ++column) {
            if(pixels[row] & (1u << (4 - column))) {
                canvas_draw_dot(canvas, x * 6 + column + 1, y * 6 + row + 13);
            }
        }
    }
}

static void draw(Canvas* canvas, void* context) {
    HailGame* game = context;
    furi_mutex_acquire(game->mutex, FuriWaitForever);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontSecondary);
    char line[40];
    snprintf(line, sizeof(line), "%u/3 %s", game->state.mission + 1,
             hail_missions[game->state.mission].name);
    canvas_draw_str(canvas, 0, 9, line);
    for(int y = 0; y < HAIL_GRID; ++y) {
        for(int x = 0; x < HAIL_GRID; ++x) {
            int px = x * 6, py = 12 + y * 6;
            if(hail_campaign_wall(game->state.mission, x, y)) canvas_draw_box(canvas, px, py, 6, 6);
        }
    }
    if(!game->state.clearance) canvas_draw_frame(canvas, 37, 19, 4, 4);
    static const uint8_t medkit[5] = {4, 4, 31, 4, 4};
    static const uint8_t exit[5] = {31, 16, 30, 16, 31};
    static const uint8_t drone[5] = {30, 17, 17, 17, 30};
    static const uint8_t mole[5] = {17, 27, 21, 17, 17};
    static const uint8_t fabricator[5] = {31, 16, 30, 16, 16};
    if(!game->state.medkit_taken) draw_marker(canvas, 1, 6, medkit);
    draw_marker(canvas, 6, 6, exit);
    bool volley = false;
    for(size_t i = 0; i < HAIL_ENEMIES; ++i) {
        const HailEnemy* enemy = &game->state.enemies[i];
        if(enemy->hp <= 0) continue;
        const uint8_t* glyph = enemy->type == HailDrone ? drone : enemy->type == HailMole ? mole : fabricator;
        draw_marker(canvas, enemy->x, enemy->y, glyph);
        if(enemy->type == HailFabricator && enemy->ready) volley = true;
    }
    int px = game->state.x * 6 + 1;
    int py = game->state.y * 6 + 13;
    canvas_draw_box(canvas, px, py, 4, 4);
    canvas_set_color(canvas, ColorWhite);
    canvas_draw_dot(canvas, px + 1, py + 1);
    canvas_set_color(canvas, ColorBlack);
    snprintf(line, sizeof(line), "HP %d/%d", game->state.hp, HAIL_HP);
    canvas_draw_str(canvas, 52, 21, line);
    snprintf(line, sizeof(line), "%s %u left",
             game->state.weapon == HailSidearm ? "S" : "B", hail_campaign_enemies_alive(&game->state));
    canvas_draw_str(canvas, 52, 32, line);
    static const char* notices[] = {
        "Find card", "Wall blocked", "Enemy blocks", "No target",
        "Hit!", "Enemy down", "HP restored", "Card found",
        "Exit locked", "Extracted!", "Defeated",
    };
    canvas_draw_str(canvas, 52, 43, volley ? "F: VOLLEY!" : notices[game->state.notice]);
    if(game->state.phase == HailDead) canvas_draw_str(canvas, 52, 54, "OK: retry");
    else if(game->state.phase == HailMissionComplete) canvas_draw_str(canvas, 52, 54, "OK: next");
    else if(game->state.phase == HailCampaignComplete) canvas_draw_str(canvas, 52, 54, "OK: new run");
    else canvas_draw_str(canvas, 52, 54, game->state.clearance ? "Card: yes" : "Card: no");
    if(game->state.phase == HailPlaying) {
        canvas_draw_str(canvas, 52, 64, "Hold OK: gun");
    }
    furi_mutex_release(game->mutex);
}

static void input(InputEvent* event, void* context) {
    HailGame* game = context;
    if((event->type == InputTypeShort || event->type == InputTypeLong) &&
       furi_message_queue_put(game->keys, event, 0) != FuriStatusOk) {
        FURI_LOG_W("HailFlipper", "Input queue full; press again");
    }
}

int32_t hail_analyst_app(void* context) {
    UNUSED(context);
    HailGame* game = malloc(sizeof(HailGame));
    furi_check(game);
    memset(game, 0, sizeof(HailGame));
    game->mutex = furi_mutex_alloc(FuriMutexTypeNormal);
    game->keys = furi_message_queue_alloc(8, sizeof(InputEvent));
    hail_campaign_reset(&game->state);
    Gui* gui = furi_record_open(RECORD_GUI);
    ViewPort* view = view_port_alloc();
    view_port_draw_callback_set(view, draw, game);
    view_port_input_callback_set(view, input, game);
    gui_add_view_port(gui, view, GuiLayerFullscreen);
    FURI_LOG_I("HailFlipper", "Standalone three-mission campaign started");
    while(true) {
        InputEvent event;
        if(furi_message_queue_get(game->keys, &event, FuriWaitForever) != FuriStatusOk) {
            FURI_LOG_E("HailFlipper", "Input read failed");
            break;
        }
        if(event.key == InputKeyBack && event.type == InputTypeShort) break;
        if(event.type == InputTypeLong) {
            if(event.key == InputKeyOk) {
                furi_mutex_acquire(game->mutex, FuriWaitForever);
                hail_campaign_switch_weapon(&game->state);
                furi_mutex_release(game->mutex);
                view_port_update(view);
            }
            continue;
        }
        HailAction action;
        switch(event.key) {
        case InputKeyUp: action = HailActionUp; break;
        case InputKeyDown: action = HailActionDown; break;
        case InputKeyLeft: action = HailActionLeft; break;
        case InputKeyRight: action = HailActionRight; break;
        case InputKeyOk: action = HailActionOk; break;
        default: continue;
        }
        furi_mutex_acquire(game->mutex, FuriWaitForever);
        hail_campaign_action(&game->state, action);
        furi_mutex_release(game->mutex);
        view_port_update(view);
    }
    gui_remove_view_port(gui, view);
    view_port_free(view);
    furi_record_close(RECORD_GUI);
    furi_message_queue_free(game->keys);
    furi_mutex_free(game->mutex);
    free(game);
    FURI_LOG_I("HailFlipper", "Standalone campaign stopped");
    return 0;
}
