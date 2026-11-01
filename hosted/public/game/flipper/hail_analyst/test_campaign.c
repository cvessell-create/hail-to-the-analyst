// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "campaign.h"

static void remove_enemies(HailCampaign* game) {
    memset(game->enemies, 0, sizeof(game->enemies));
}

int main(void) {
    for(unsigned int m = 0; m < HAIL_MISSIONS; ++m) {
        assert(!hail_campaign_wall(m, 1, 1));
        assert(!hail_campaign_wall(m, 6, 6));
        const HailMission* mission = &hail_missions[m];
        assert(!hail_campaign_wall(m, mission->clearance_x, mission->clearance_y));
        assert(!hail_campaign_wall(m, mission->medkit_x, mission->medkit_y));
        for(int i = 0; i < HAIL_ENEMIES; ++i) {
            const HailEnemy* e = &mission->enemies[i];
            if(!e->hp) continue;
            assert(!hail_campaign_wall(m, e->x, e->y));
            assert(!(e->x == 1 && e->y == 1));
            for(int j = i + 1; j < HAIL_ENEMIES; ++j) {
                const HailEnemy* other = &mission->enemies[j];
                assert(!other->hp || other->x != e->x || other->y != e->y);
            }
        }
    }
    HailCampaign game;
    hail_campaign_reset(&game);
    assert(game.hp == 32 && game.mission == 0 && game.weapon == HailSidearm);
    assert(hail_campaign_enemies_alive(&game) == 2);
    assert(!hail_campaign_visible(0, 2, 2, 4, 2));
    assert(!hail_campaign_visible(0, 2, 2, 3, 1));
    assert(hail_campaign_visible(0, 1, 1, 6, 1));
    HailCampaign before = game;
    hail_campaign_action(&game, (HailAction)99);
    assert(memcmp(&game, &before, sizeof(game)) == 0);
    hail_campaign_switch_weapon(&game);
    assert(game.weapon == HailBreacher && game.turns == 0);
    hail_campaign_switch_weapon(&game);
    remove_enemies(&game);
    game.enemies[0] = (HailEnemy){3, 1, 18, HailDrone, false};
    hail_campaign_action(&game, HailActionOk);
    assert(game.enemies[0].hp == 13 && game.hp == 29 && game.turns == 1);
    hail_campaign_switch_weapon(&game);
    hail_campaign_action(&game, HailActionOk);
    assert(game.enemies[0].hp == 13 && game.notice == HailNoticeMiss);
    game.enemies[0].x = 2;
    game.enemies[0].hp = 8;
    hail_campaign_action(&game, HailActionOk);
    assert(game.kills == 1 && game.notice == HailNoticeKill);
    assert(game.enemies[0].hp == 0 && game.hp == 26);
    game.enemies[0] = (HailEnemy){2, 1, 20, HailMole, false};
    hail_campaign_action(&game, HailActionRight);
    assert(game.x == 1 && game.notice == HailNoticeBlocked && game.hp == 22);
    game.hp = 1;
    hail_campaign_action(&game, HailActionUp);
    assert(game.phase == HailDead && game.hp == 0);
    before = game;
    hail_campaign_action(&game, HailActionRight);
    assert(memcmp(&game, &before, sizeof(game)) == 0);
    hail_campaign_action(&game, HailActionOk);
    assert(game.phase == HailPlaying && game.hp == 32 && game.mission == 0);
    remove_enemies(&game);
    game.enemies[0] = (HailEnemy){3, 1, 40, HailFabricator, false};
    hail_campaign_action(&game, HailActionUp);
    assert(game.enemies[0].ready && game.hp == 32);
    hail_campaign_action(&game, HailActionDown);
    assert(!game.enemies[0].ready && game.hp == 26);
    game.enemies[0].ready = true;
    game.x = 1; game.y = 6;
    hail_campaign_action(&game, HailActionOk);
    assert(game.hp == 32 && game.medkit_taken && !game.enemies[0].ready);
    game.hp = 12;
    hail_campaign_action(&game, HailActionOk);
    assert(game.hp == 12);
    for(unsigned int mission = 0; mission < HAIL_MISSIONS; ++mission) {
        assert(game.mission == mission);
        remove_enemies(&game);
        game.x = 5; game.y = 6; game.clearance = 0;
        hail_campaign_action(&game, HailActionRight);
        assert(game.phase == HailPlaying && game.notice == HailNoticeExitLocked);
        game.x = 5; game.y = 1;
        hail_campaign_action(&game, HailActionRight);
        assert(game.clearance == 1);
        game.x = 5; game.y = 6;
        hail_campaign_action(&game, HailActionRight);
        assert(game.phase == (mission == 2 ? HailCampaignComplete : HailMissionComplete));
        hail_campaign_action(&game, HailActionOk);
    }
    assert(game.mission == 0 && game.turns == 0 && game.kills == 0 && game.hp == 32);
    remove_enemies(&game);
    game.enemies[0] = (HailEnemy){2, 1, 1, HailDrone, false};
    game.enemies[1] = (HailEnemy){1, 2, 18, HailDrone, false};
    hail_campaign_action(&game, HailActionOk);
    assert(game.enemies[0].hp == 0 && game.enemies[1].hp == 18 && game.hp == 29);
    game.x = 5; game.y = 6; game.clearance = 1;
    hail_campaign_action(&game, HailActionRight);
    assert(game.phase == HailPlaying && game.notice == HailNoticeExitLocked);

    // End-to-end legal input traces from untouched mission spawns, not fixture combat.
    const char* routes[HAIL_MISSIONS] = {
        "RROOROOOROOORDDDDD",
        "RRRROOOORDDDDODOOO",
        "RRRROOOOLLOSOORRRDDSOOLLLDDDLLRRRRROOOOOO",
    };
    hail_campaign_reset(&game);
    for(unsigned int mission = 0; mission < HAIL_MISSIONS; ++mission) {
        for(const char* cursor = routes[mission]; *cursor; ++cursor) {
            if(*cursor == 'S') hail_campaign_switch_weapon(&game);
            else {
                HailAction action;
                switch(*cursor) {
                case 'U': action = HailActionUp; break;
                case 'D': action = HailActionDown; break;
                case 'L': action = HailActionLeft; break;
                case 'R': action = HailActionRight; break;
                case 'O': action = HailActionOk; break;
                default: assert(!"Invalid route action"); return 1;
                }
                hail_campaign_action(&game, action);
            }
            assert(game.phase != HailDead);
        }
        assert(game.mission == mission && game.clearance == 1 && game.hp == 8);
        assert(hail_campaign_enemies_alive(&game) == 0);
        assert(game.phase == (mission == 2 ? HailCampaignComplete : HailMissionComplete));
        before = game;
        hail_campaign_action(&game, HailActionUp);
        hail_campaign_switch_weapon(&game);
        assert(memcmp(&game, &before, sizeof(game)) == 0);
        if(mission < 2) hail_campaign_action(&game, HailActionOk);
    }
    assert(game.turns == 75 && game.kills == 7);
    hail_campaign_action(&game, HailActionOk);
    assert(game.mission == 0 && game.turns == 0 && game.kills == 0);
    puts("Campaign checks passed: combat, LOS, enemies, boss, health, healing and three exits");
    return 0;
}
