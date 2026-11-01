// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "game_rules.h"

#define HAIL_MISSIONS 3
#define HAIL_ENEMIES 3
#define HAIL_HP 32

typedef enum { HailSidearm, HailBreacher } HailWeapon;
typedef enum { HailMole, HailDrone, HailFabricator } HailEnemyType;
typedef enum { HailPlaying, HailMissionComplete, HailCampaignComplete, HailDead } HailPhase;
typedef enum {
    HailNoticeExplore, HailNoticeWall, HailNoticeBlocked, HailNoticeMiss,
    HailNoticeHit, HailNoticeKill, HailNoticeHeal, HailNoticeClearance,
    HailNoticeExitLocked, HailNoticeComplete, HailNoticeDead,
} HailNotice;

typedef struct {
    int x, y, hp;
    HailEnemyType type;
    bool ready;
} HailEnemy;

typedef struct {
    unsigned int mission, turns, kills, clearance;
    int x, y, hp;
    HailWeapon weapon;
    HailPhase phase;
    HailNotice notice;
    bool medkit_taken;
    HailEnemy enemies[HAIL_ENEMIES];
} HailCampaign;

typedef struct {
    const char* name;
    const char* rows[8];
    int clearance_x, clearance_y, medkit_x, medkit_y;
    HailEnemy enemies[HAIL_ENEMIES];
} HailMission;

extern const HailMission hail_missions[HAIL_MISSIONS];
void hail_campaign_reset(HailCampaign* game);
void hail_campaign_action(HailCampaign* game, HailAction action);
void hail_campaign_switch_weapon(HailCampaign* game);
bool hail_campaign_wall(unsigned int mission, int x, int y);
bool hail_campaign_visible(unsigned int mission, int ax, int ay, int bx, int by);
unsigned int hail_campaign_enemies_alive(const HailCampaign* game);
