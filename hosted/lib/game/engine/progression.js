// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Analyst progression: experience, levels, eight skills under four attributes,
// tactical charge, augment energy, damage types and boss strike telegraphs.
// Original names and numbers; pure rules — index.html owns state and drawing.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailProgression = api;
})(this, function () {
  'use strict';
  var POINTS_PER_LEVEL = 3, SKILL_CAP = 10, MAX_LEVEL = 30;
  // Order is the in-panel order and the 1–8 key binding.
  var SKILLS = [
    { id: 'insight', attr: 'COGNITION', name: 'FIELD INSIGHT', info: 'More tactical charge per damage dealt' },
    { id: 'precision', attr: 'COGNITION', name: 'PRECISION', info: 'Critical hit chance' },
    { id: 'handling', attr: 'REFLEX', name: 'HANDLING', info: 'Faster firing and weapon swaps' },
    { id: 'aim', attr: 'REFLEX', name: 'STEADY AIM', info: 'Tighter weapon spread' },
    { id: 'balance', attr: 'FRAME', name: 'BALANCE', info: 'Move faster while raised/firing; resist stagger' },
    { id: 'evasion', attr: 'FRAME', name: 'EVASION', info: 'Shorter dodge-roll cooldown' },
    { id: 'endurance', attr: 'VITALS', name: 'ENDURANCE', info: 'Maximum health' },
    { id: 'reserve', attr: 'VITALS', name: 'RESERVE', info: 'Maximum augment energy' }
  ];
  // Beginner order: survive first, then damage, then reload and accuracy.
  var RECOMMENDED = ['endurance', 'precision', 'endurance', 'handling', 'aim', 'precision'];
  var KILL_XP = { MOLE: 30, DRONE: 40, ICE_PIG: 55, TROLL: 70, FABRICATOR: 400 };
  var MISSION_XP = 150;

  // Damage types; multiplier < .9 reads grey (ineffective), > 1.2 reads red (very effective).
  var TYPES = ['ballistic', 'energy', 'digital', 'fire'];
  var WEAK = {
    MOLE: { ballistic: 1.4, energy: 0.8, digital: 0.6, fire: 1.2 },
    DRONE: { ballistic: 0.7, energy: 1.5, digital: 1.4, fire: 0.8 },
    ICE_PIG: { ballistic: 0.8, energy: 1.3, digital: 1.0, fire: 1.6 },
    TROLL: { ballistic: 1.0, energy: 1.0, digital: 0.5, fire: 1.3 },
    FABRICATOR: { ballistic: 0.9, energy: 1.3, digital: 0.7, fire: 1.0 }
  };
  var ROBOTS = { DRONE: true, ICE_PIG: true, FABRICATOR: true };

  var TACTICAL = { max: 100, grenadeCost: 100, perDamage: 0.35, vial: 35 };
  var GRENADE = { range: 4.2, fuse: 0.6, radius: 2.1, damage: 75, type: 'fire' };
  var AUGMENTS = {
    shockwave: { key: 'KeyF', name: 'SHOCKWAVE', cost: 35, cooldown: 6, radius: 2.6, damage: 45, attr: 'REFLEX', type: 'ballistic' },
    drone: { key: 'KeyC', name: 'ESCORT DRONE', cost: 50, cooldown: 14, life: 8, damage: 9, rate: 0.45, attr: 'COGNITION', type: 'energy' },
    barrier: { key: 'KeyB', name: 'BARRIER DOME', cost: 40, cooldown: 12, life: 5, radius: 2.2, attr: 'VITALS', type: 'energy' }
  };
  var ENERGY_VIAL = 30;
  var HACK = { key: 'KeyH', radius: 3, cooldown: 8, stun: 3, damage: 20, type: 'digital' };
  // Seconds before a ranged enemy fires during which its aim laser is shown.
  var AIM_TELL = 0.5;
  function insideDome(dome, x, y) { return Boolean(dome) && Math.hypot(x - dome.x, y - dome.y) < dome.r; }
  var STRIKE = { every: 5.5, delay: 1.3, radius: 1.1, damage: 22, count: 3, spread: 2.2 };

  function create() {
    var skills = {};
    SKILLS.forEach(function (s) { skills[s.id] = 0; });
    return { level: 1, xp: 0, points: 0, skills: skills, tactical: 0, energy: 100, augCd: { shockwave: 0, drone: 0, barrier: 0 }, hackCd: 0, caches: 0 };
  }
  function xpToNext(level) { return 100 * level; }
  function gainXp(hero, amount) {
    var ups = 0;
    hero.xp += Math.max(0, amount);
    while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
      hero.xp -= xpToNext(hero.level); hero.level++; hero.points += POINTS_PER_LEVEL; ups++;
    }
    return ups;
  }
  function spend(hero, id) {
    if (!(id in hero.skills) || hero.points < 1 || hero.skills[id] >= SKILL_CAP) return false;
    hero.skills[id]++; hero.points--; return true;
  }
  function autoSpend(hero) {
    var guard = 0;
    while (hero.points > 0 && guard++ < 100) {
      var pick = null;
      for (var i = 0; i < RECOMMENDED.length * SKILL_CAP && !pick; i++) {
        var id = RECOMMENDED[i % RECOMMENDED.length];
        if (hero.skills[id] < SKILL_CAP) pick = id;
      }
      if (!pick) pick = SKILLS.map(function (s) { return s.id; }).filter(function (id) { return hero.skills[id] < SKILL_CAP; })[0];
      if (!pick || !spend(hero, pick)) break;
    }
  }
  function attribute(hero, attr) {
    return SKILLS.reduce(function (n, s) { return n + (s.attr === attr ? hero.skills[s.id] : 0); }, 0);
  }
  function maxHp(hero) { return 100 + 8 * hero.skills.endurance; }
  function maxEnergy(hero) { return 100 + 10 * hero.skills.reserve; }
  function critChance(hero) { return 0.05 + 0.025 * hero.skills.precision; }
  function delayScale(hero) { return 1 / (1 + 0.06 * hero.skills.handling); }
  function spreadScale(hero) { return Math.max(0.4, 1 - 0.06 * hero.skills.aim); }
  function burdenSpeed(hero) { return Math.min(1, 0.6 + 0.04 * hero.skills.balance); }
  function rollCooldownScale(hero) { return Math.max(0.4, 1 - 0.06 * hero.skills.evasion); }
  function chargeGain(hero, damage) { return damage * TACTICAL.perDamage * (1 + 0.15 * hero.skills.insight); }

  function multiplier(enemyType, damageType) { var w = WEAK[enemyType]; return (w && w[damageType]) || 1; }
  function effectiveness(m) { return m < 0.9 ? 'weak' : m > 1.2 ? 'strong' : 'normal'; }
  // rng() in [0,1) decides criticals so the game can keep its seeded RNG.
  function hit(hero, enemyType, damageType, base, rng) {
    var m = multiplier(enemyType, damageType), crit = rng() < critChance(hero);
    return { damage: base * m * (crit ? 2 : 1), mult: m, crit: crit, rating: effectiveness(m) };
  }
  function addCharge(hero, damage) { hero.tactical = Math.min(TACTICAL.max, hero.tactical + chargeGain(hero, damage)); }
  function canGrenade(hero) { return hero.tactical >= TACTICAL.grenadeCost; }

  function augmentPower(hero, id) { return 1 + 0.08 * attribute(hero, AUGMENTS[id].attr); }
  function canAugment(hero, id) { var a = AUGMENTS[id]; return !!a && hero.augCd[id] <= 0 && hero.energy >= a.cost; }
  function useAugment(hero, id) {
    if (!canAugment(hero, id)) return false;
    hero.energy -= AUGMENTS[id].cost; hero.augCd[id] = AUGMENTS[id].cooldown; return true;
  }
  function tick(hero, dt) {
    Object.keys(hero.augCd).forEach(function (k) { hero.augCd[k] = Math.max(0, hero.augCd[k] - dt); });
    hero.hackCd = Math.max(0, hero.hackCd - dt);
  }

  // Ground strike targets around a point; the centre is always on the target.
  function strikeTargets(target, rng) {
    var out = [{ x: target.x, y: target.y, t: STRIKE.delay }];
    for (var i = 1; i < STRIKE.count; i++) {
      var a = rng() * Math.PI * 2, r = STRIKE.spread * (0.5 + rng() * 0.5);
      out.push({ x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r, t: STRIKE.delay });
    }
    return out;
  }
  function inStrike(s, p) { return Math.hypot(s.x - p.x, s.y - p.y) <= STRIKE.radius; }

  function drops(rng) {
    var out = [];
    if (rng() < 0.22) out.push('y');
    if (rng() < 0.22) out.push('n');
    return out;
  }

  // Skill panel drawn on the game canvas.
  function panel(ctx, hero, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.94; ctx.fillStyle = '#05070a'; ctx.fillRect(W / 2 - 300, 70, 600, 380);
    ctx.globalAlpha = 1; ctx.strokeStyle = '#7dffb0'; ctx.strokeRect(W / 2 - 300, 70, 600, 380);
    ctx.textAlign = 'left'; ctx.font = '900 18px Courier New'; ctx.fillStyle = '#7dffb0';
    ctx.fillText('ANALYST LEVEL ' + hero.level + '   XP ' + Math.floor(hero.xp) + '/' + xpToNext(hero.level) + '   POINTS ' + hero.points, W / 2 - 284, 98);
    ctx.font = '900 14px Courier New';
    SKILLS.forEach(function (s, i) {
      var y = 132 + i * 36;
      ctx.fillStyle = '#ffce2e'; ctx.fillText('[' + (i + 1) + '] ' + s.name, W / 2 - 284, y);
      ctx.fillStyle = '#8aa'; ctx.fillText(s.attr, W / 2 - 60, y);
      for (var k = 0; k < SKILL_CAP; k++) { ctx.fillStyle = k < hero.skills[s.id] ? '#7dffb0' : '#223'; ctx.fillRect(W / 2 + 60 + k * 22, y - 12, 18, 12); }
      ctx.fillStyle = '#ccd'; ctx.font = '12px Courier New'; ctx.fillText(s.info, W / 2 - 262, y + 14); ctx.font = '900 14px Courier New';
    });
    ctx.fillStyle = '#8aa'; ctx.fillText('1–8 SPEND · K CLOSE · BEGINNERS: ENDURANCE, PRECISION, THEN HANDLING/AIM', W / 2 - 284, 440);
    ctx.restore();
  }

  return {
    POINTS_PER_LEVEL: POINTS_PER_LEVEL, SKILL_CAP: SKILL_CAP, SKILLS: SKILLS, RECOMMENDED: RECOMMENDED, KILL_XP: KILL_XP, MISSION_XP: MISSION_XP,
    TYPES: TYPES, WEAK: WEAK, ROBOTS: ROBOTS, TACTICAL: TACTICAL, GRENADE: GRENADE, AUGMENTS: AUGMENTS, AIM_TELL: AIM_TELL, insideDome: insideDome, ENERGY_VIAL: ENERGY_VIAL, HACK: HACK, STRIKE: STRIKE,
    create: create, xpToNext: xpToNext, gainXp: gainXp, spend: spend, autoSpend: autoSpend, attribute: attribute,
    maxHp: maxHp, maxEnergy: maxEnergy, critChance: critChance, delayScale: delayScale, spreadScale: spreadScale,
    burdenSpeed: burdenSpeed, rollCooldownScale: rollCooldownScale, chargeGain: chargeGain,
    multiplier: multiplier, effectiveness: effectiveness, hit: hit, addCharge: addCharge, canGrenade: canGrenade,
    augmentPower: augmentPower, canAugment: canAugment, useAugment: useAugment, tick: tick,
    strikeTargets: strikeTargets, inStrike: inStrike, drops: drops, panel: panel
  };
});
