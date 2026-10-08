/*
 * Copyright 2026 Christopher R. Vessell
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Modified/adapted for this JavaScript game on 2026-10-04 from Battle for
 * Wesnoth, https://github.com/wesnoth/wesnoth (GPL-2.0-or-later):
 * src/map/location.cpp: get_adjacent_tiles, distance_between;
 *   Copyright (C) 2003-2025 David White <dave@whitevine.net>.
 * src/pathfind/pathfind.cpp: enemy_zoc, find_routes (single-turn adaptation);
 *   Copyright (C) 2005-2025 Guillaume Melquiond <guillaume.melquiond@gmail.com>,
 *   Copyright (C) 2003 David White <dave@whitevine.net>.
 * src/actions/attack.cpp: battle_context_unit_stats, attack::perform,
 *   attack::perform_hit, attack::unit_killed (terrain, resistance, alternating
 *   strikes, retaliation and combat/kill XP; simplified without WML events);
 *   Copyright (C) 2003-2025 David White <dave@whitevine.net>.
 * src/units/unit.cpp: new_turn, new_scenario, defense_modifier,
 *   resistance_against, advance_to (simplified unit lifecycle/stat model);
 *   Copyright (C) 2003-2025 David White <dave@whitevine.net>.
 * src/ai/default/ca_move_to_targets.cpp: rate_target, choose_move
 *   (simplified distance/terrain target scoring, not the upstream full AI);
 *   Copyright (C) 2009-2025 Yurii Chernyi <terraninfo@terraninfo.net>.
 * Upstream source headers and routines were read before these adaptations.
 * No upstream units, artwork, maps or other assets are included.
 * All unit/weapon stats, mission layouts, names, glyphs and colors are original.
 *
 * Jack's ability modifiers, proficiency, XP thresholds, d20 attacks,
 * advantage/disadvantage and conditions adapt SRD 5.1; see ATTRIBUTION.md
 * for the required Wizards of the Coast / CC BY 4.0 attribution.
 *
 * API: terrain[y][x] is a character in a row string, using odd-column-down
 * offset hexes. RNG functions return numbers in [0,1), like Math.random.
 * conditions[name] = {remaining, sourceId?}; duration counts the affected
 * side's completed turns, not individual strikes. A duration of one applied
 * by an enemy therefore lasts through the victim's next turn.
 * Jack ALWAYS rolls d20 against AC (including retaliation); every other
 * unit rolls a terrain-based percentage, even when its target is Jack.
 */
(function (root) {
  'use strict';
  const Power = typeof module === 'object' && module.exports ? require('./power-index.js') : root.PowerIndex;
  const MathEngine = typeof module === 'object' && module.exports ? require('../engine/math.js') : root.EngineMath;

  const terrain = Object.freeze({
    '.': Object.freeze({ name: 'Open floor', defense: 20, cost: 1, color: '#293c43' }),
    c: Object.freeze({ name: 'Archive cover', defense: 50, cost: 2, color: '#416861' }),
    a: Object.freeze({ name: 'Ash spill', defense: 30, cost: 2, color: '#755749' }),
    r: Object.freeze({ name: 'Signal ridge', defense: 60, cost: 3, color: '#58557c' }),
    '~': Object.freeze({ name: 'Coolant', defense: 10, cost: 3, color: '#285e78' }),
    '#': Object.freeze({ name: 'Sealed wall', defense: 0, cost: Infinity, color: '#111c25' })
  });
  const weapons = Object.freeze({
    sidearm: Object.freeze({ name: 'Sidearm', damage: 5, die: 6, strikes: 2, range: 2, band: 'ranged', damageType: 'kinetic', ability: 'dexterity' }),
    breacher: Object.freeze({ name: 'Breacher', damage: 8, die: 8, strikes: 1, range: 1, band: 'melee', damageType: 'thermal', ability: 'strength', condition: 'prone' }),
    redactor: Object.freeze({ name: 'Redactor', damage: 4, die: 4, strikes: 2, range: 2, band: 'ranged', damageType: 'signal', ability: 'intelligence', condition: 'blinded' })
  });
  const types = {
    jack: { name: 'Jack', maxHp: 32, movement: 4, ac: 14, weapon: 'sidearm', glyph: 'J', color: '#f3d86a' },
    reader: { name: 'Field Reader', maxHp: 25, movement: 5, ac: 12, weapon: 'sidearm', skirmisher: true, glyph: 'R', color: '#84e5c4', ability: 'Skirmisher: ignores ZoC and crosses ash for one movement.' },
    medic: { name: 'Patch Analyst', maxHp: 28, movement: 4, ac: 13, weapon: 'redactor', glyph: '+', color: '#7be1ef', ability: 'Patch: restores 4 HP to adjacent allies after the enemy turn.' },
    lead: { name: 'Signal Lead', maxHp: 30, movement: 4, ac: 13, weapon: 'breacher', glyph: 'L', color: '#bcb8ff', ability: 'Relay: adjacent allies deal +2 damage per strike.' },
    mole: { name: 'Data Mole', maxHp: 20, movement: 4, ac: 11, weapon: 'breacher', resistances: { kinetic: 20, thermal: -20 }, glyph: 'm', color: '#c1a68a' },
    drone: { name: 'Splice Drone', maxHp: 18, movement: 5, ac: 13, weapon: 'sidearm', resistances: { signal: -30 }, glyph: 'd', color: '#e8ab6d' },
    troll: { name: 'Comment Troll', maxHp: 36, movement: 3, ac: 12, weapon: 'breacher', resistances: { kinetic: 25 }, glyph: 't', color: '#be8473' },
    'null-warden': { name: 'Null Warden', maxHp: 34, movement: 3, ac: 15, weapon: 'redactor', inflicts: 'stunned', resistances: { signal: 50, thermal: -25 }, glyph: 'N', color: '#c594e6', ability: 'Null seal: a hit stuns for one turn.' },
    'ash-auditor': { name: 'Ash Auditor', maxHp: 27, movement: 4, ac: 13, weapon: 'breacher', resistances: { thermal: 50, kinetic: -20 }, glyph: 'A', color: '#fa8f65', ability: 'Cinder ledger: thermal-resistant melee enforcer.' },
    'signal-reaver': { name: 'Signal Reaver', maxHp: 24, movement: 5, ac: 14, weapon: 'redactor', inflicts: 'frightened', resistances: { signal: 25 }, glyph: 'S', color: '#e977c7', ability: 'Dread broadcast: a hit prevents approaching its source for one turn.' }
  };
  Object.values(types).forEach(function (type) {
    if (type.resistances) Object.freeze(type.resistances);
    Object.freeze(type);
  });
  Object.freeze(types);
  const layouts = [
    ['..c..r.', '.c..a..', '..~....', '.a.c.r.', '..c....'],
    ['.r..c..', '..~.a..', '.c...r.', '..a~...', '.c..c..'],
    ['..a.r..', '.c.#...', '...~.c.', '.r...a.', '..c.r..'],
    ['.c..~..', '...ra..', '.a.#...', '..c..r.', '.r.a...'],
    ['..r.c..', '.a..~..', '..c....', '.~.r.a.', '...c...']
  ];
  const jackThresholds = [0, 300, 900, 2700, 6500];
  const conditionNames = ['stunned', 'blinded', 'frightened', 'prone'];
  const squadIds = ['squad-reader', 'squad-medic', 'squad-lead'];

  // Port of get_adjacent_tiles; the parity convention also matches the UI.
  function neighbors(x, y) {
    if (typeof x === 'object') { y = x.y; x = x.x; }
    const up = (x & 1) === 0 ? 1 : 0;
    const down = (x & 1) === 1 ? 1 : 0;
    return [{ x: x, y: y - 1 }, { x: x + 1, y: y - up },
      { x: x + 1, y: y + down }, { x: x, y: y + 1 },
      { x: x - 1, y: y + down }, { x: x - 1, y: y - up }];
  }

  // Port of distance_between; integer division is explicit in JavaScript.
  function hexDistance(a, b) {
    const horizontal = Math.abs(a.x - b.x);
    const penalty = (((a.x & 1) === 0 && (b.x & 1) === 1 && a.y < b.y) ||
      ((b.x & 1) === 0 && (a.x & 1) === 1 && b.y < a.y)) ? 1 : 0;
    return Math.max(horizontal, Math.abs(a.y - b.y) + penalty + Math.floor(horizontal / 2));
  }

  function hitChance(defense) { return Math.max(0, Math.min(100, 100 - defense)); }
  function modifier(score) { return Math.floor((score - 10) / 2); }
  function has(unit, name) { return !!(unit.conditions && unit.conditions[name] && unit.conditions[name].remaining > 0); }
  function alive(unit) { return !!unit && unit.hp > 0; }
  function roll(sides, rng) { return 1 + Math.floor(Math.max(0, Math.min(0.999999999, rng())) * sides); }

  function applyCondition(unit, name, duration, source) {
    if (!conditionNames.includes(name) || !Number.isFinite(duration) || duration <= 0) return false;
    if (!unit.conditions) unit.conditions = {};
    unit.conditions[name] = { remaining: Math.max(Math.ceil(duration), (unit.conditions[name] || {}).remaining || 0) };
    if (source) unit.conditions[name].sourceId = typeof source === 'string' ? source : source.id;
    return true;
  }
  function removeCondition(unit, name) {
    if (!unit.conditions || !unit.conditions[name]) return false;
    delete unit.conditions[name];
    return true;
  }
  function tickConditions(unit) {
    Object.keys(unit.conditions || {}).forEach(function (name) {
      if (--unit.conditions[name].remaining <= 0) removeCondition(unit, name);
    });
    return unit.conditions;
  }
  function terrainAt(battle, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
        x >= battle.width || y >= battle.height) return terrain['#'];
    return terrain[battle.terrain[y][x]] || terrain['#'];
  }
  function sourceOf(battle, unit) {
    const condition = unit.conditions && unit.conditions.frightened;
    return condition && battle && battle.units.find(function (other) { return other.id === condition.sourceId && alive(other); });
  }
  function fearActive(battle, unit) { return has(unit, 'frightened') && (!battle || !!sourceOf(battle, unit)); }

  /**
   * Pure d20 resolution: d20Attack(attacker, defender, weaponNameOrObject,
   * rng?, {battle?, advantage?, disadvantage?}?). Does not mutate HP.
   * Advantage and disadvantage cancel regardless of the number of sources.
   */
  function d20Attack(attacker, defender, weapon, rng, options) {
    weapon = typeof weapon === 'string' ? weapons[weapon] : (weapon || weapons.sidearm);
    rng = rng || Math.random;
    options = options || {};
    if (has(attacker, 'stunned')) return { hit: false, critical: false, roll: null, total: 0, damage: 0, blocked: true };
    const near = hexDistance(attacker, defender) <= 1;
    const advantage = !!options.advantage || has(defender, 'blinded') ||
      has(defender, 'stunned') || (has(defender, 'prone') && near);
    const disadvantage = !!options.disadvantage || has(attacker, 'blinded') ||
      has(attacker, 'prone') || fearActive(options.battle, attacker) ||
      (has(defender, 'prone') && !near);
    const first = roll(20, rng);
    const second = advantage !== disadvantage ? roll(20, rng) : first;
    const natural = advantage === disadvantage ? first : (advantage ? Math.max(first, second) : Math.min(first, second));
    const bonus = modifier((attacker.abilityScores || {})[weapon.ability] || 10);
    const proficiency = attacker.proficiency || (attacker.level >= 5 ? 3 : 2);
    const critical = natural === 20;
    const hit = natural !== 1 && (critical || natural + bonus + proficiency >= (defender.ac || 12));
    let damage = 0;
    if (hit) {
      damage = roll(weapon.die || 6, rng);
      if (critical) damage += roll(weapon.die || 6, rng);
      damage = Math.max(0, damage + bonus);
    }
    return { hit: hit, critical: critical, roll: natural, total: natural + bonus + proficiency,
      damage: damage, advantage: advantage && !disadvantage, disadvantage: disadvantage && !advantage };
  }

  function makeUnit(type, id, side, x, y) {
    const stats = types[type];
    return Object.assign({}, stats, { id: id, type: type, side: side, x: x, y: y,
      hp: stats.maxHp, level: 1, xp: 0, moveRemaining: stats.movement,
      attacked: false, conditions: {}, resistances: Object.assign({}, stats.resistances || {}) });
  }
  function jackLevel(xp) {
    let level = 1;
    while (level < 5 && xp >= jackThresholds[level]) level++;
    return level;
  }
  function createBattle(missionIndex, optionalJack, options = {}) {
    missionIndex = Number(missionIndex);
    missionIndex = Number.isFinite(missionIndex) ? Math.max(0, Math.floor(missionIndex)) : 0;
    const jack = makeUnit('jack', 'jack', 'analyst', 0, 2);
    jack.abilityScores = { strength: 14, dexterity: 16, constitution: 14, intelligence: 14, wisdom: 12, charisma: 10 };
    if (optionalJack) {
      Object.keys(jack.abilityScores).forEach(function (ability) {
        const value = optionalJack.abilityScores && optionalJack.abilityScores[ability];
        if (Number.isFinite(value)) jack.abilityScores[ability] = Math.max(1, Math.min(30, Math.floor(value)));
      });
      const xp = Number(optionalJack.xp), level = Number(optionalJack.level);
      jack.xp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
      jack.level = Math.max(jackLevel(jack.xp), Number.isFinite(level) ? Math.max(1, Math.min(5, Math.floor(level))) : 1);
    }
    jack.influence = optionalJack && optionalJack.influence ?
      JSON.parse(JSON.stringify(optionalJack.influence)) : { xp: 0, awards: {} };
    jack.proficiency = jack.level >= 5 ? 3 : 2;
    jack.maxHp = 32 + (jack.level - 1) * 6;
    jack.hp = jack.maxHp;
    const units = [jack, makeUnit('reader', squadIds[0], 'analyst', 0, 0),
      makeUnit('medic', squadIds[1], 'analyst', 0, 3), makeUnit('lead', squadIds[2], 'analyst', 1, 4),
      makeUnit('mole', 'enemy-mole', 'fabricator', 5, 0),
      makeUnit('drone', 'enemy-drone', 'fabricator', 5, 2),
      makeUnit('troll', 'enemy-troll', 'fabricator', 5, 4)];
    const originals = ['null-warden', 'ash-auditor', 'signal-reaver'];
    units.push(makeUnit(originals[missionIndex % 3], 'enemy-original-1', 'fabricator', 6, 1));
    units.push(makeUnit(originals[(missionIndex + 1) % 3], 'enemy-original-2', 'fabricator', 6, 3));
    if (options.engineScaling) {
      const npcs = units.filter(unit => unit.side === 'fabricator');
      const allocation = MathEngine.npcLevels(npcs.map(unit => unit.maxHp), npcs.length + Math.min(4, missionIndex * 2));
      npcs.forEach((unit, i) => {
        unit.level = allocation.allocations[i];
        unit.maxHp += (unit.level - 1) * 6; unit.hp = unit.maxHp;
      });
    }
    return { width: 7, height: 5, terrain: layouts[missionIndex % layouts.length].slice(),
      units: units, jack: jack, turn: 1, phase: 'player', activeSide: 'analyst',
      missionIndex: missionIndex, objective: { x: 6, y: 2 },
      influenceModel: Power.encounter(units.filter(unit => unit.side === 'analyst'),
        units.filter(unit => unit.side === 'fabricator'), missionIndex === 1),
      log: ['Reach the exit with Jack or defeat every Fabricator. Jack rolls d20 vs AC; squad and enemies use terrain hit percentages.'] };
  }
  function member(battle, unit) { return battle.units.includes(unit) && alive(unit); }
  function canAct(battle, unit) {
    return battle.phase === 'player' && member(battle, unit) &&
      unit.side === (battle.activeSide || 'analyst') && !has(unit, 'stunned');
  }
  function enemyZoc(battle, unit, position) {
    return !unit.skirmisher && battle.units.some(function (enemy) {
      return alive(enemy) && enemy.side !== unit.side && !has(enemy, 'stunned') && hexDistance(enemy, position) === 1;
    });
  }
  function routes(battle, unit) {
    const destinations = new Map();
    if (!canAct(battle, unit)) return destinations;
    const source = sourceOf(battle, unit);
    const originKey = unit.x + ',' + unit.y;
    destinations.set(originKey, { x: unit.x, y: unit.y, remaining: unit.moveRemaining });
    const pending = [destinations.get(originKey)];
    while (pending.length) {
      pending.sort(function (a, b) { return b.remaining - a.remaining; });
      const current = pending.shift();
      if (current.remaining <= 0) continue;
      neighbors(current).forEach(function (next) {
        const tile = terrainAt(battle, next.x, next.y);
        if (battle.units.some(function (other) { return other !== unit && alive(other) && other.x === next.x && other.y === next.y; })) return;
        if (source && hexDistance(next, source) < hexDistance(current, source)) return;
        let cost = unit.type === 'reader' && tile === terrain.a ? 1 : tile.cost;
        if (has(unit, 'prone')) cost *= 2;
        let remaining = current.remaining - cost;
        if (remaining < 0) return;
        if (enemyZoc(battle, unit, next)) remaining = 0;
        const key = next.x + ',' + next.y;
        if (!destinations.has(key) || destinations.get(key).remaining < remaining) {
          const node = { x: next.x, y: next.y, remaining: remaining };
          destinations.set(key, node);
          pending.push(node);
        }
      });
    }
    destinations.delete(originKey);
    return destinations;
  }
  function reachable(battle, unit) {
    return Array.from(routes(battle, unit).values(), function (node) { return { x: node.x, y: node.y }; });
  }
  function outcome(battle) {
    if (battle.phase !== 'player') return battle.phase;
    if (!alive(battle.jack)) {
      battle.phase = 'lost';
      battle.log.push('Jack fell. Surviving analysts regroup for the firefight.');
    } else if ((battle.jack.x === battle.objective.x && battle.jack.y === battle.objective.y) ||
      !battle.units.some(function (unit) { return alive(unit) && unit.side === 'fabricator'; })) {
      battle.phase = 'won';
      grantXp(battle, battle.jack, 300);
      awardInfluence(battle, 'tactics-' + battle.missionIndex);
      battle.log.push('Tactical objective secured. Squad survivors carry supplies forward.');
    }
    return battle.phase;
  }
  function move(battle, unit, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const route = routes(battle, unit).get(x + ',' + y);
    if (!route) return false;
    unit.x = x; unit.y = y; unit.moveRemaining = route.remaining;
    battle.log.push(unit.name + ' moved to ' + x + ',' + y + '.');
    outcome(battle);
    return true;
  }
  function stand(battle, unit) {
    const cost = Math.ceil(unit.movement / 2);
    if (!canAct(battle, unit) || !has(unit, 'prone') || unit.moveRemaining < cost) return false;
    unit.moveRemaining -= cost;
    removeCondition(unit, 'prone');
    battle.log.push(unit.name + ' stood up (half movement).');
    return true;
  }
  function grantXp(battle, unit, amount) {
    if (!alive(unit)) return;
    unit.xp += amount;
    const previous = unit.level;
    if (unit.type === 'jack') {
      unit.level = Math.max(unit.level, jackLevel(unit.xp));
      unit.proficiency = unit.level >= 5 ? 3 : 2;
    } else {
      while (unit.level < 3 && unit.xp >= unit.level * 16) {
        unit.xp -= unit.level * 16;
        unit.level++;
      }
    }
    if (unit.level > previous) {
      unit.maxHp += (unit.level - previous) * 6;
      unit.hp = unit.maxHp;
      battle.log.push(unit.name + ' reached level ' + unit.level + '.');
    }
  }
  function awardInfluence(battle, receiptId, survivingIds) {
    const ledger = battle.jack.influence;
    if (Object.hasOwn(ledger.awards, receiptId)) return ledger.awards[receiptId];
    const result = Power.reward(battle.influenceModel, 'jack', survivingIds ||
      battle.units.filter(unit => alive(unit) && unit.side === 'analyst').map(unit => unit.id));
    ledger.awards[receiptId] = result;
    ledger.xp += result.xp;
    grantXp(battle, battle.jack, result.xp);
    battle.log.push('Influence +' + result.xp + ' XP; Shapley-Shubik ' +
      (100 * result.shapleyShubik).toFixed(1) + '%, Banzhaf ' +
      (100 * result.banzhafNormalized).toFixed(1) + '%' + (result.critical ? '; Jack was critical.' : '.'));
    return result;
  }
  function weaponFor(unit, name) {
    if (unit.type !== 'jack' && name && name !== unit.weapon) return null;
    return weapons[name || unit.weapon] || null;
  }
  function strike(battle, attacker, defender, weapon, rng) {
    if (!alive(attacker) || !alive(defender) || has(attacker, 'stunned')) return null;
    let result;
    if (attacker.type === 'jack') {
      result = d20Attack(attacker, defender, weapon, rng, { battle: battle });
    } else {
      const near = hexDistance(attacker, defender) === 1;
      const advantage = has(defender, 'blinded') || has(defender, 'stunned') || (has(defender, 'prone') && near);
      const disadvantage = has(attacker, 'blinded') || has(attacker, 'prone') ||
        fearActive(battle, attacker) || (has(defender, 'prone') && !near);
      const chance = Math.max(0, Math.min(100, hitChance(terrainAt(battle, defender.x, defender.y).defense) +
        (advantage === disadvantage ? 0 : (advantage ? 20 : -20))));
      result = { hit: rng() * 100 < chance, critical: false, chance: chance, damage: weapon.damage + attacker.level - 1 };
    }
    if (!result.hit) {
      result.damage = 0;
      battle.log.push(attacker.name + ' missed' + (result.roll ? ' (d20 ' + result.roll + ')' : '') + '.');
      return result;
    }
    const relay = battle.units.some(function (unit) {
      return unit !== attacker && unit.type === 'lead' && alive(unit) && unit.side === attacker.side &&
        !has(unit, 'stunned') && hexDistance(unit, attacker) === 1;
    });
    const resistance = (defender.resistances || {})[weapon.damageType] || 0;
    result.damage = Math.max(0, Math.round((result.damage + (relay ? 2 : 0)) * (100 - resistance) / 100));
    defender.hp = Math.max(0, defender.hp - result.damage);
    battle.log.push(attacker.name + (result.critical ? ' critically hit ' : ' hit ') + defender.name +
      ' for ' + result.damage + ' ' + weapon.damageType + (result.roll ? ' (d20 ' + result.roll + ')' : '') + '.');
    if (!alive(defender)) {
      battle.log.push(defender.name + ' was defeated.');
      grantXp(battle, attacker, attacker.type === 'jack' ? 300 : 8 * defender.level);
    } else {
      const condition = attacker.inflicts || weapon.condition;
      if (condition) {
        applyCondition(defender, condition, 1, attacker);
        battle.log.push(defender.name + ' is ' + condition + ' for one turn.');
      }
    }
    return result;
  }
  function attack(battle, unit, target, weaponName, rng) {
    if (typeof weaponName === 'function') { rng = weaponName; weaponName = undefined; }
    rng = rng || Math.random;
    const weapon = weaponFor(unit, weaponName);
    if (!canAct(battle, unit) || unit.attacked || !member(battle, target) ||
        unit.side === target.side || !weapon || hexDistance(unit, target) > weapon.range) return false;
    unit.attacked = true;
    unit.moveRemaining = 0;
    const counter = weaponFor(target);
    const retaliation = counter && counter.band === weapon.band && hexDistance(unit, target) <= counter.range ? counter : null;
    const count = unit.type === 'jack' ? (unit.level >= 5 ? 2 : 1) : weapon.strikes;
    const counterCount = retaliation ? (target.type === 'jack' ? (target.level >= 5 ? 2 : 1) : retaliation.strikes) : 0;
    const results = [];
    const unitLevel = unit.level, targetLevel = target.level;
    for (let i = 0; i < Math.max(count, counterCount) && alive(unit) && alive(target); i++) {
      if (i < count) results.push(strike(battle, unit, target, weapon, rng));
      if (alive(unit) && alive(target) && i < counterCount) results.push(strike(battle, target, unit, retaliation, rng));
    }
    if (alive(unit) && alive(target)) {
      grantXp(battle, unit, unit.type === 'jack' ? 25 : targetLevel);
      grantXp(battle, target, target.type === 'jack' ? 25 : unitLevel);
    }
    outcome(battle);
    return { strikes: results.filter(Boolean), phase: battle.phase };
  }
  function refresh(unit) {
    unit.moveRemaining = unit.movement;
    unit.attacked = false;
  }
  function endTurn(battle, rng) {
    if (battle.phase !== 'player' || battle.activeSide !== 'analyst') return battle;
    rng = rng || Math.random;
    if (outcome(battle) !== 'player') return battle;
    battle.units.filter(function (unit) { return alive(unit) && unit.side === 'analyst'; }).forEach(tickConditions);
    battle.activeSide = 'fabricator';
    const enemies = battle.units.filter(function (unit) { return alive(unit) && unit.side === 'fabricator'; });
    enemies.forEach(function (enemy) {
      refresh(enemy);
      if (battle.phase !== 'player' || has(enemy, 'stunned')) return;
      if (has(enemy, 'prone')) stand(battle, enemy);
      const targets = battle.units.filter(function (unit) { return alive(unit) && unit.side === 'analyst'; });
      targets.sort(function (a, b) { return hexDistance(enemy, a) - hexDistance(enemy, b) || a.hp - b.hp; });
      const target = targets[0];
      if (!target) return;
      const weapon = weaponFor(enemy);
      if (hexDistance(enemy, target) > weapon.range) {
        const choices = reachable(battle, enemy);
        choices.sort(function (a, b) {
          return (hexDistance(a, target) * 10 - terrainAt(battle, a.x, a.y).defense / 10) -
            (hexDistance(b, target) * 10 - terrainAt(battle, b.x, b.y).defense / 10);
        });
        if (choices.length && hexDistance(choices[0], target) < hexDistance(enemy, target)) {
          move(battle, enemy, choices[0].x, choices[0].y);
        }
      }
      const inRange = targets.filter(function (unit) { return alive(unit) && hexDistance(enemy, unit) <= weapon.range; });
      if (inRange.length) attack(battle, enemy, inRange[0], undefined, rng);
    });
    enemies.filter(alive).forEach(tickConditions);
    battle.activeSide = 'analyst';
    if (battle.phase === 'player') {
      battle.turn++;
      battle.units.filter(function (unit) { return alive(unit) && unit.side === 'analyst'; }).forEach(function (unit) {
        const medic = battle.units.find(function (other) {
          return alive(other) && other.type === 'medic' && other.side === unit.side && other !== unit &&
            !has(other, 'stunned') && hexDistance(other, unit) === 1;
        });
        if (medic && unit.hp < unit.maxHp) {
          unit.hp = Math.min(unit.maxHp, unit.hp + 4);
          battle.log.push(medic.name + ' patched ' + unit.name + ' (+4 HP).');
        }
        refresh(unit);
      });
      battle.log.push('Analyst turn ' + battle.turn + '.');
    }
    outcome(battle);
    return battle;
  }
  function handoff(battle) {
    const survivors = squadIds.filter(function (id) {
      return battle.units.some(function (unit) { return unit.id === id && unit.side === 'analyst' && alive(unit); });
    }).length;
    return { armor: survivors * 10, bullets: survivors * 12, shells: survivors * 2,
      extraEnemies: 3 - survivors + (battle.phase === 'lost' ? 2 : 0) };
  }

  const Tactics = { createBattle: createBattle, move: move, attack: attack, endTurn: endTurn,
    handoff: handoff, terrainAt: terrainAt, reachable: reachable, stand: stand,
    weapons: weapons, types: types, terrain: terrain, hexDistance: hexDistance,
    neighbors: neighbors, hitChance: hitChance, d20Attack: d20Attack,
    applyCondition: applyCondition, removeCondition: removeCondition, tickConditions: tickConditions,
    conditions: Object.freeze({ apply: applyCondition, remove: removeCondition, tick: tickConditions }),
    jackThresholds: Object.freeze(jackThresholds), modifier: modifier,
    awardInfluence: awardInfluence, grantXp: grantXp };
  root.Tactics = Tactics;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tactics;
})(globalThis);
