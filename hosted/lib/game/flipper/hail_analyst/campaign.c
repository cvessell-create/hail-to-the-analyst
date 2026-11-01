// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <stdlib.h>
#include <string.h>
#include "campaign.h"

// Compact original layouts inspired by archive corridors, frost lanes and plant pillars.
const HailMission hail_missions[HAIL_MISSIONS] = {
    {
        "THE ARCHIVE",
        {"########", "#......#", "#..#...#", "#..#...#", "#......#", "#.##...#", "#......#", "########"},
        6, 1, 1, 6,
        {{5, 2, 18, HailDrone, false}, {4, 5, 20, HailMole, false}, {0}},
    },
    {
        "FROST YARD",
        {"########", "#......#", "#.#.#..#", "#.#....#", "#...#..#", "#.#....#", "#......#", "########"},
        6, 1, 1, 6,
        {{5, 3, 18, HailDrone, false}, {4, 6, 20, HailMole, false}, {0}},
    },
    {
        "FAB PLANT",
        {"########", "#......#", "#.#.#..#", "#......#", "#.#.#..#", "#......#", "#......#", "########"},
        6, 1, 1, 6,
        {{5, 2, 18, HailDrone, false}, {3, 5, 20, HailMole, false},
         {6, 5, 40, HailFabricator, false}},
    },
};

bool hail_campaign_wall(unsigned int mission, int x, int y) {
    return mission >= HAIL_MISSIONS || x < 0 || y < 0 || x >= 8 || y >= 8 ||
           hail_missions[mission].rows[y][x] == '#';
}

bool hail_campaign_visible(unsigned int mission, int ax, int ay, int bx, int by) {
    if(hail_campaign_wall(mission, ax, ay) || hail_campaign_wall(mission, bx, by)) return false;
    int dx = abs(bx - ax), dy = abs(by - ay), sx = bx > ax ? 1 : -1, sy = by > ay ? 1 : -1;
    int ix = 0, iy = 0;
    // Supercover traversal: touching wall corners cannot be shot through.
    while(ix < dx || iy < dy) {
        int decision = (1 + 2 * ix) * dy - (1 + 2 * iy) * dx;
        if(decision == 0) {
            if(hail_campaign_wall(mission, ax + sx, ay) ||
               hail_campaign_wall(mission, ax, ay + sy)) return false;
            ax += sx; ay += sy; ++ix; ++iy;
        } else if(decision < 0) {
            ax += sx; ++ix;
        } else {
            ay += sy; ++iy;
        }
        if(hail_campaign_wall(mission, ax, ay)) return false;
    }
    return true;
}

unsigned int hail_campaign_enemies_alive(const HailCampaign* game) {
    unsigned int count = 0;
    for(size_t i = 0; i < HAIL_ENEMIES; ++i) if(game->enemies[i].hp > 0) ++count;
    return count;
}

static void start_mission(HailCampaign* game, unsigned int mission) {
    unsigned int turns = game->turns, kills = game->kills;
    HailWeapon weapon = game->weapon;
    memset(game, 0, sizeof(*game));
    game->turns = turns;
    game->kills = kills;
    game->weapon = weapon;
    game->mission = mission;
    game->x = game->y = 1;
    game->hp = HAIL_HP;
    memcpy(game->enemies, hail_missions[mission].enemies, sizeof(game->enemies));
}

void hail_campaign_reset(HailCampaign* game) {
    memset(game, 0, sizeof(*game));
    start_mission(game, 0);
}

void hail_campaign_switch_weapon(HailCampaign* game) {
    if(game->phase == HailPlaying) {
        game->weapon = game->weapon == HailSidearm ? HailBreacher : HailSidearm;
    }
}

static bool occupied(const HailCampaign* game, int x, int y, int except) {
    for(int i = 0; i < HAIL_ENEMIES; ++i) {
        if(i != except && game->enemies[i].hp > 0 &&
           game->enemies[i].x == x && game->enemies[i].y == y) return true;
    }
    return false;
}

static int distance(int ax, int ay, int bx, int by) {
    return abs(ax - bx) + abs(ay - by);
}

static void damage_enemy(HailCampaign* game, HailEnemy* enemy, int amount) {
    enemy->hp = enemy->hp > amount ? enemy->hp - amount : 0;
    game->notice = HailNoticeHit;
    if(!enemy->hp) {
        ++game->kills;
        game->notice = HailNoticeKill;
    }
}

static void attack(HailCampaign* game) {
    int range = game->weapon == HailSidearm ? 2 : 1;
    int target = -1, nearest = range + 1;
    for(int i = 0; i < HAIL_ENEMIES; ++i) {
        HailEnemy* enemy = &game->enemies[i];
        int d = distance(game->x, game->y, enemy->x, enemy->y);
        if(enemy->hp > 0 && d <= range && d < nearest &&
           hail_campaign_visible(game->mission, game->x, game->y, enemy->x, enemy->y)) {
            target = i;
            nearest = d;
        }
    }
    game->notice = HailNoticeMiss;
    if(target >= 0) damage_enemy(game, &game->enemies[target], game->weapon == HailSidearm ? 5 : 8);
}

static void enemy_turn(HailCampaign* game) {
    for(int i = 0; i < HAIL_ENEMIES && game->hp > 0; ++i) {
        HailEnemy* enemy = &game->enemies[i];
        if(enemy->hp <= 0) continue;
        int d = distance(game->x, game->y, enemy->x, enemy->y);
        bool visible = hail_campaign_visible(game->mission, enemy->x, enemy->y, game->x, game->y);
        if(enemy->type == HailFabricator) {
            if(enemy->ready) {
                if(visible && d <= 3) game->hp -= 6;
                enemy->ready = false;
            } else if(visible && d <= 3) {
                enemy->ready = true;
            }
            continue;
        }
        int range = enemy->type == HailDrone ? 2 : 1;
        if(visible && d <= range) {
            game->hp -= enemy->type == HailDrone ? 3 : 4;
        } else if(visible && d <= 4) {
            const int directions[4][2] = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};
            int nx = enemy->x, ny = enemy->y, best = d;
            for(int j = 0; j < 4; ++j) {
                int x = enemy->x + directions[j][0], y = enemy->y + directions[j][1];
                int candidate = distance(x, y, game->x, game->y);
                if(candidate < best && !hail_campaign_wall(game->mission, x, y) &&
                   !(x == game->x && y == game->y) && !occupied(game, x, y, i)) {
                    nx = x; ny = y; best = candidate;
                }
            }
            enemy->x = nx; enemy->y = ny;
        }
    }
    if(game->hp <= 0) {
        game->hp = 0;
        game->phase = HailDead;
        game->notice = HailNoticeDead;
    }
}

void hail_campaign_action(HailCampaign* game, HailAction action) {
    if((unsigned int)action > HailActionOk) return;
    if(game->phase != HailPlaying) {
        if(action != HailActionOk) return;
        if(game->phase == HailMissionComplete) start_mission(game, game->mission + 1);
        else if(game->phase == HailDead) start_mission(game, game->mission);
        else hail_campaign_reset(game);
        return;
    }
    ++game->turns;
    game->notice = HailNoticeExplore;
    if(action == HailActionOk) {
        attack(game);
    } else {
        const int directions[4][2] = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};
        int x = game->x + directions[action][0], y = game->y + directions[action][1];
        if(hail_campaign_wall(game->mission, x, y)) game->notice = HailNoticeWall;
        else if(occupied(game, x, y, -1)) game->notice = HailNoticeBlocked;
        else { game->x = x; game->y = y; }
    }
    const HailMission* mission = &hail_missions[game->mission];
    if(game->x == mission->clearance_x && game->y == mission->clearance_y && !game->clearance) {
        game->clearance = 1;
        game->notice = HailNoticeClearance;
    }
    if(game->x == mission->medkit_x && game->y == mission->medkit_y && !game->medkit_taken) {
        game->medkit_taken = true;
        game->hp = HAIL_HP;
        game->notice = HailNoticeHeal;
    }
    if(game->x == 6 && game->y == 6) {
        if(game->clearance && hail_campaign_enemies_alive(game) == 0) {
            game->phase = game->mission + 1 == HAIL_MISSIONS ? HailCampaignComplete : HailMissionComplete;
            game->notice = HailNoticeComplete;
            return;
        }
        game->notice = HailNoticeExitLocked;
    }
    enemy_turn(game);
}
