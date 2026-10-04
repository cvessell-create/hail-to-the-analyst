/*
 * Copyright 2026 Christopher R. Vessell
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('../js/tactics.js');

function rng(values) {
  let index = 0;
  return function () { return values[Math.min(index++, values.length - 1)]; };
}
function duel(attackerType) {
  const battle = T.createBattle(0);
  const attacker = battle.units.find(function (unit) { return unit.type === (attackerType || 'jack'); });
  const target = battle.units.find(function (unit) { return unit.type === 'drone'; });
  battle.units = [battle.jack, attacker, target].filter(function (unit, index, units) { return units.indexOf(unit) === index; });
  battle.terrain = Array(5).fill('.......');
  attacker.x = 2; attacker.y = 2;
  target.x = 3; target.y = 2;
  target.hp = target.maxHp = 100;
  target.weapon = 'sidearm';
  return { battle: battle, attacker: attacker, target: target };
}

test('classic file script and CommonJS expose the same dependency-free API', function () {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../js/tactics.js'), 'utf8'), context);
  assert.equal(typeof context.Tactics.createBattle, 'function');
  assert.equal(globalThis.Tactics, T);
  assert.equal(context.Tactics.createBattle(0).width, 7);
});

test('hex adjacency and distance reproduce odd-column-down geometry', function () {
  for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) {
    const start = { x: x, y: y };
    assert.equal(T.neighbors(start).length, 6);
    for (const next of T.neighbors(start)) {
      assert.equal(T.hexDistance(start, next), 1);
      assert.equal(T.hexDistance(next, start), 1);
      assert.ok(T.neighbors(next).some(function (p) { return p.x === x && p.y === y; }));
    }
    const queue = [{ x: x, y: y, steps: 0 }], seen = new Set([x + ',' + y]);
    while (queue.length) {
      const p = queue.shift();
      assert.equal(T.hexDistance(start, p), p.steps);
      if (p.steps === 3) continue;
      for (const next of T.neighbors(p)) {
        const key = next.x + ',' + next.y;
        if (!seen.has(key)) { seen.add(key); queue.push(Object.assign(next, { steps: p.steps + 1 })); }
      }
    }
  }
});

test('mission layouts and original Fabricators are distinct; Jack copies safely', function () {
  const old = T.createBattle(0).jack;
  old.xp = 900; old.level = 3; old.hp = 1; old.attacked = true;
  old.abilityScores.wisdom = 18;
  T.applyCondition(old, 'stunned', 3);
  const snapshot = JSON.parse(JSON.stringify(old));
  const next = T.createBattle(1, old);
  assert.deepEqual(old, snapshot);
  assert.equal(next.jack.level, 3);
  assert.equal(next.jack.xp, 900);
  assert.equal(next.jack.hp, next.jack.maxHp);
  assert.equal(next.jack.attacked, false);
  assert.deepEqual(next.jack.conditions, {});
  next.jack.abilityScores.wisdom = 12;
  assert.equal(old.abilityScores.wisdom, 18);
  assert.equal(old.hp, 1);
  assert.equal(T.createBattle(Infinity, { xp: Infinity, level: Infinity }).jack.level, 1);
  assert.equal(new Set(Array.from({ length: 5 }, function (_, i) { return T.createBattle(i).terrain.join(''); })).size, 5);
  const originals = { 'null-warden': 'Null Warden', 'ash-auditor': 'Ash Auditor', 'signal-reaver': 'Signal Reaver' };
  for (const [type, name] of Object.entries(originals)) {
    assert.ok(T.types[type].glyph);
    assert.equal(T.types[type].name, name);
  }
});

test('terrain has avoidance and movement costs, including impassable bounds', function () {
  const battle = T.createBattle(0);
  assert.equal(T.hitChance(60), 40);
  assert.equal(T.hitChance(120), 0);
  assert.equal(T.hitChance(-10), 100);
  assert.equal(T.terrainAt(battle, 2, 0).defense, 50);
  assert.equal(T.terrainAt(battle, -1, 0).cost, Infinity);
  assert.equal(T.terrainAt(battle, 0.5, 0).cost, Infinity);
});

test('movement enforces costs, occupancy, walls, action side and ZoC stopping', function () {
  const { battle, attacker, target } = duel();
  attacker.x = 0; attacker.y = 2; attacker.moveRemaining = 4;
  target.x = 2; target.y = 2;
  battle.terrain[1] = '#c#####';
  battle.terrain[2] = '....###';
  battle.terrain[3] = '#######';
  assert.equal(T.move(battle, attacker, 2, 2), false);
  assert.equal(T.move(battle, attacker, '1', 2), false);
  assert.equal(T.move(battle, target, 3, 2), false);
  assert.ok(T.reachable(battle, attacker).some(function (p) { return p.x === 1 && p.y === 2; }));
  assert.equal(T.move(battle, attacker, 1, 2), true);
  assert.equal(attacker.moveRemaining, 0);
  assert.equal(T.move(battle, attacker, 1, 1), false);
  assert.equal(T.move(battle, attacker, -1, 0), false);
  const fresh = duel();
  fresh.target.x = 6; fresh.target.y = 4;
  fresh.battle.terrain[1] = '..c....';
  assert.equal(T.move(fresh.battle, fresh.attacker, 2, 1), true);
  assert.equal(fresh.attacker.moveRemaining, 2);
});

test('reader skirmishes past ZoC and traverses ash cheaply', function () {
  const { battle, attacker, target } = duel('reader');
  attacker.x = 0; attacker.y = 2;
  target.x = 2; target.y = 2;
  battle.terrain[2] = '.a.....';
  assert.equal(T.move(battle, attacker, 1, 2), true);
  assert.equal(attacker.moveRemaining, 4);
});

test('d20 natural one misses, natural twenty crits, modifiers and proficiency apply', function () {
  const { attacker, target } = duel();
  target.ac = 100;
  const crit = T.d20Attack(attacker, target, 'sidearm', rng([0.999, 0, 0.999]));
  assert.equal(crit.hit, true);
  assert.equal(crit.critical, true);
  assert.equal(crit.damage, 10); // 1 + 6 + Dexterity modifier 3, not doubled modifier.
  target.ac = 1;
  assert.equal(T.d20Attack(attacker, target, 'sidearm', function () { return 0; }).hit, false);
  target.ac = 15;
  const normal = T.d20Attack(attacker, target, 'sidearm', rng([0.45, 0]));
  assert.equal(normal.roll, 10);
  assert.equal(normal.total, 15);
  assert.equal(normal.hit, true);
  attacker.level = 5; attacker.proficiency = 3;
  assert.equal(T.d20Attack(attacker, target, 'sidearm', rng([0.45, 0])).total, 16);
});

test('advantage/disadvantage choose high/low and multiple sources cancel', function () {
  const { attacker, target } = duel();
  let result = T.d20Attack(attacker, target, 'sidearm', rng([0, 0.999, 0, 0]), { advantage: true });
  assert.equal(result.roll, 20);
  result = T.d20Attack(attacker, target, 'sidearm', rng([0.999, 0]), { disadvantage: true });
  assert.equal(result.roll, 1);
  T.applyCondition(attacker, 'blinded', 2);
  T.applyCondition(target, 'stunned', 2);
  T.applyCondition(target, 'blinded', 2);
  result = T.d20Attack(attacker, target, 'sidearm', rng([0.45, 0.999]));
  assert.equal(result.roll, 10);
  assert.equal(result.advantage, false);
  assert.equal(result.disadvantage, false);
});

test('stun blocks movement, attacks, standing and retaliation; conditions expire/remove', function () {
  const { battle, attacker, target } = duel();
  T.applyCondition(attacker, 'stunned', 2);
  assert.deepEqual(T.reachable(battle, attacker), []);
  assert.equal(T.attack(battle, attacker, target), false);
  T.applyCondition(attacker, 'prone', 2);
  assert.equal(T.stand(battle, attacker), false);
  T.tickConditions(attacker);
  assert.equal(attacker.conditions.stunned.remaining, 1);
  T.tickConditions(attacker);
  assert.deepEqual(attacker.conditions, {});
  assert.equal(T.applyCondition(attacker, 'invalid', 1), false);
  assert.equal(T.applyCondition(attacker, 'blinded', Infinity), false);
  T.applyCondition(target, 'stunned', 1);
  const hp = attacker.hp;
  T.attack(battle, attacker, target, 'sidearm', function () { return 0.99; });
  assert.equal(attacker.hp, hp);
  assert.equal(T.removeCondition(target, 'stunned'), true);
  assert.equal(T.removeCondition(target, 'stunned'), false);
});

test('frightened units cannot approach their living source, even by a detour', function () {
  const { battle, attacker, target } = duel();
  attacker.x = 1; attacker.y = 2; target.x = 5; target.y = 2;
  T.applyCondition(attacker, 'frightened', 2, target);
  const distance = T.hexDistance(attacker, target);
  assert.ok(T.reachable(battle, attacker).every(function (p) { return T.hexDistance(p, target) >= distance; }));
  assert.equal(T.move(battle, attacker, 2, 2), false);
  assert.equal(T.d20Attack(attacker, target, 'sidearm', rng([0.999, 0]), { battle: battle }).roll, 1);
  target.hp = 0;
  assert.ok(T.reachable(battle, attacker).some(function (p) { return p.x === 2 && p.y === 2; }));
});

test('prone changes close/distant targeting, crawling and half-movement standing', function () {
  const { battle, attacker, target } = duel();
  T.applyCondition(target, 'prone', 2);
  assert.equal(T.d20Attack(attacker, target, 'sidearm', rng([0, 0.999, 0, 0])).roll, 20);
  target.x = 4;
  assert.equal(T.d20Attack(attacker, target, 'sidearm', rng([0.999, 0])).roll, 1);
  T.removeCondition(target, 'prone');
  target.x = 6; target.y = 4;
  T.applyCondition(attacker, 'prone', 2);
  assert.equal(T.move(battle, attacker, 2, 1), true);
  assert.equal(attacker.moveRemaining, 2);
  assert.equal(T.stand(battle, attacker), true);
  assert.equal(attacker.moveRemaining, 0);
  assert.equal(attacker.conditions.prone, undefined);
  T.applyCondition(attacker, 'prone', 1);
  assert.equal(T.stand(battle, attacker), false);
});

test('Jack ignores terrain avoidance while analysts retain percentage strikes and resistance', function () {
  const a = duel();
  a.battle.terrain[2] = '...r...';
  a.target.ac = 12;
  assert.ok(T.attack(a.battle, a.attacker, a.target, 'sidearm', rng([0.5, 0, 0.99, 0.99])));
  assert.equal(a.target.hp, 96);
  const b = duel('reader');
  b.battle.terrain[2] = '...r...';
  assert.ok(T.attack(b.battle, b.attacker, b.target, undefined, function () { return 0.5; }));
  assert.equal(b.target.hp, 100);
  const c = duel('reader');
  c.target.resistances.kinetic = 40;
  T.applyCondition(c.target, 'stunned', 1);
  T.attack(c.battle, c.attacker, c.target, undefined, function () { return 0; });
  assert.equal(c.target.hp, 94); // two strikes of 5 reduced to 3.
});

test('retaliation alternates matching weapon bands; Jack retaliates using d20', function () {
  const a = duel('reader');
  const result = T.attack(a.battle, a.attacker, a.target, undefined, function () { return 0; });
  assert.equal(result.strikes.length, 4);
  assert.equal(a.attacker.hp, a.attacker.maxHp - 10);
  const b = duel();
  b.target.weapon = 'breacher';
  const hp = b.attacker.hp;
  assert.equal(T.attack(b.battle, b.attacker, b.target, 'sidearm', function () { return 0.99; }).strikes.length, 1);
  assert.equal(b.attacker.hp, hp);
  const c = duel();
  c.attacker.ac = 100; c.attacker.hp = c.attacker.maxHp = 100;
  c.battle.activeSide = 'fabricator';
  const retaliation = T.attack(c.battle, c.target, c.attacker, undefined, rng([0.99, 0.999, 0, 0, 0.99]));
  assert.ok(retaliation.strikes.some(function (strike) { return strike.roll === 20 && strike.critical; }));
  assert.equal(c.target.hp, 95);
});

test('combat legality, one attack per turn and attack consumes movement', function () {
  const { battle, attacker, target } = duel();
  assert.equal(T.attack(battle, attacker, target, 'unknown'), false);
  assert.equal(T.attack(battle, attacker, attacker), false);
  target.x = 6;
  assert.equal(T.attack(battle, attacker, target), false);
  target.x = 3;
  assert.ok(T.attack(battle, attacker, target, 'sidearm', function () { return 0.99; }));
  assert.equal(attacker.moveRemaining, 0);
  assert.equal(attacker.attacked, true);
  assert.equal(T.attack(battle, attacker, target), false);
});

test('level-five Jack gains a second d20 strike; blinded allies suffer percentage penalties', function () {
  const a = duel();
  a.attacker.level = 5;
  a.attacker.proficiency = 3;
  T.applyCondition(a.target, 'stunned', 1);
  const result = T.attack(a.battle, a.attacker, a.target, 'sidearm', function () { return 0.5; });
  assert.equal(result.strikes.filter(function (strike) { return strike.roll !== undefined; }).length, 2);
  assert.equal(a.target.hp, 86);
  const b = duel('reader');
  T.applyCondition(b.attacker, 'blinded', 1);
  b.target.weapon = 'breacher';
  const blinded = T.attack(b.battle, b.attacker, b.target, undefined, function () { return 0.7; });
  assert.equal(blinded.strikes[0].chance, 60);
  assert.equal(b.target.hp, 100);
  T.removeCondition(b.attacker, 'blinded');
  b.attacker.attacked = false;
  T.attack(b.battle, b.attacker, b.target, undefined, function () { return 0.7; });
  assert.equal(b.target.hp, 90);
});

test('Jack kill XP and SRD thresholds level to five; allies level independently', function () {
  const a = duel();
  a.attacker.xp = 6500 - 300;
  a.target.hp = 1;
  // Keep a second live enemy so objective XP does not affect the assertion.
  const other = Object.assign({}, a.target, { id: 'other', x: 6, y: 4, hp: 100, conditions: {} });
  a.battle.units.push(other);
  T.attack(a.battle, a.attacker, a.target, 'sidearm', function () { return 0.99; });
  assert.equal(a.attacker.xp, 6500);
  assert.equal(a.attacker.level, 5);
  assert.equal(a.attacker.proficiency, 3);
  assert.equal(a.attacker.hp, a.attacker.maxHp);
  assert.deepEqual(T.jackThresholds, [0, 300, 900, 2700, 6500]);
  const b = duel('reader');
  b.attacker.xp = 15;
  b.target.hp = 1;
  T.attack(b.battle, b.attacker, b.target, undefined, function () { return 0; });
  assert.equal(b.attacker.level, 2);
  assert.equal(b.attacker.xp, 7);
  const c = duel('reader');
  c.target.level = 2;
  c.target.hp = 1;
  T.attack(c.battle, c.attacker, c.target, undefined, function () { return 0; });
  assert.equal(c.attacker.level, 2);
  assert.equal(c.attacker.xp, 0); // Level-up rollover must not also award combat XP.
});

test('enemy AI advances/attacks, durations cover victim turn, refresh and medic heal work', function () {
  const battle = T.createBattle(0);
  battle.terrain = Array(5).fill('.......');
  const enemy = battle.units.find(function (unit) { return unit.type === 'drone'; });
  const medic = battle.units.find(function (unit) { return unit.type === 'medic'; });
  battle.units = [battle.jack, medic, enemy];
  battle.jack.x = 0; battle.jack.y = 1;
  medic.x = 0; medic.y = 2;
  battle.jack.hp -= 8;
  battle.jack.moveRemaining = 0; battle.jack.attacked = true;
  T.applyCondition(battle.jack, 'stunned', 1);
  const oldX = enemy.x;
  T.endTurn(battle, function () { return 0.99; });
  assert.ok(enemy.x < oldX);
  assert.equal(battle.turn, 2);
  assert.equal(battle.phase, 'player');
  assert.equal(battle.jack.moveRemaining, battle.jack.movement);
  assert.equal(battle.jack.attacked, false);
  assert.equal(battle.jack.hp, battle.jack.maxHp - 4);
  assert.equal(battle.jack.conditions.stunned, undefined);
  const warden = Object.assign({}, enemy, T.types['null-warden'], { type: 'null-warden', x: 1, y: 1, hp: 100, maxHp: 100, conditions: {}, resistances: {} });
  battle.units = [battle.jack, warden];
  T.endTurn(battle, function () { return 0; });
  assert.equal(battle.jack.conditions.stunned.remaining, 1);
  assert.equal(T.attack(battle, battle.jack, warden), false);
  T.endTurn(battle, function () { return 0.99; });
  assert.equal(battle.jack.conditions.stunned, undefined);
});

test('signal lead relay boosts adjacent squad strikes', function () {
  const { battle, attacker, target } = duel('reader');
  const lead = T.createBattle(0).units.find(function (unit) { return unit.type === 'lead'; });
  lead.x = 2; lead.y = 1;
  battle.units.push(lead);
  T.applyCondition(target, 'stunned', 1);
  T.attack(battle, attacker, target, undefined, function () { return 0; });
  assert.equal(target.hp, 86);
});

test('objective and elimination win, Jack death loses even if enemies are dead', function () {
  const a = duel();
  a.attacker.x = 5; a.attacker.y = 2;
  a.target.x = 4; a.target.y = 4;
  assert.equal(T.move(a.battle, a.attacker, 6, 2), true);
  assert.equal(a.battle.phase, 'won');
  assert.equal(T.move(a.battle, a.attacker, 6, 1), false);
  const b = duel();
  b.target.hp = 1;
  T.attack(b.battle, b.attacker, b.target, 'sidearm', function () { return 0.99; });
  assert.equal(b.battle.phase, 'won');
  const c = duel();
  c.attacker.hp = 0; c.target.hp = 0;
  T.endTurn(c.battle);
  assert.equal(c.battle.phase, 'lost');
});

test('handoff counts only the original three squad survivors; loss adds enemies', function () {
  const battle = T.createBattle(0);
  assert.deepEqual(T.handoff(battle), { armor: 30, bullets: 36, shells: 6, extraEnemies: 0 });
  battle.units.find(function (unit) { return unit.type === 'reader'; }).hp = 0;
  assert.deepEqual(T.handoff(battle), { armor: 20, bullets: 24, shells: 4, extraEnemies: 1 });
  battle.phase = 'lost';
  assert.equal(T.handoff(battle).extraEnemies, 3);
  battle.units = [battle.jack];
  assert.deepEqual(T.handoff(battle), { armor: 0, bullets: 0, shells: 0, extraEnemies: 5 });
});
