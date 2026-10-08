// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../js/power-index.js'), M = require('../engine/math.js'), B = require('../engine/boss.js');
const G = require('../engine/game-theory.js'), F = require('../engine/fair-division.js'), S = require('../engine/systems.js');
test('power indices match textbook swing counts and exact permutation enumeration', () => {
  const model = P.analyze([4, 3, 2, 1], 6);
  assert.deepEqual(model.players.map(p => p.swingCount), [5, 3, 3, 1]);
  assert.deepEqual(model.players.map(p => p.banzhafAbsolute), [5 / 8, 3 / 8, 3 / 8, 1 / 8]);
  const pivots = [0, 0, 0, 0];
  function permute(prefix, remaining) {
    if (!remaining.length) {
      let sum = 0;
      for (const i of prefix) { sum += model.weights[i]; if (sum >= 6) { pivots[i]++; break; } }
    } else remaining.forEach(i => permute([...prefix, i], remaining.filter(j => j !== i)));
  }
  permute([], [0, 1, 2, 3]);
  assert.deepEqual(model.players.map(p => Number(p.pivotalPermutations)), pivots);
  assert.equal(model.players.reduce((sum, p) => sum + Number(p.pivotalPermutations), 0), 24);
});
test('dictator, dummy, unanimity, veto and bounded invalid models', () => {
  assert.deepEqual(P.analyze([10, 0, 1], 10).players.map(p => p.shapleyShubik), [1, 0, 0]);
  assert.deepEqual(P.analyze([1, 1, 1], 3).players.map(p => p.banzhafNormalized), [1 / 3, 1 / 3, 1 / 3]);
  assert.equal(P.analyze([12, 0, 2, 2], 10, [0]).players[0].shapleyShubik, 1);
  assert.equal(P.critical([2, 2, 2], 6, [0, 1, 2], 0), true);
  assert.throws(() => P.analyze([1], 0)); assert.throws(() => P.analyze([1], 2));
  assert.throws(() => P.analyze(Array(17).fill(1), 1)); assert.throws(() => P.analyze([1], 1, [9]));
  assert.throws(() => P.critical([1, 1], 1, [0, 0], 0));
});
test('bottom-up strategy chooses minimum-cost inclusion-minimal team without granting power', () => {
  const result = P.bottomUp([2, 2, 2], 6, [0], [0, 10, 5]);
  assert.deepEqual(result.coalition, [0, 1, 2]); assert.equal(result.cost, 15);
  assert.equal(result.critical.every(item => item.critical), true);
  assert.equal(P.bottomUp([0, 2, 2], 3, [0]).feasible, false);
});
test('ultra-boss shield transitions, exact backward payoff and award replay rejection', () => {
  const boss = B.create(); assert.equal(boss.snapshot().players[1].shapleyShubik, 0);
  assert.throws(() => boss.check([1, 2, 3]), /veto/);
  const plan = boss.backwardPlan(); assert.equal(plan.value, 490);
  assert.deepEqual(plan.actions.map(a => a.action), ['collect', 'reform', 'check']);
  assert.equal(boss.collect('boost-1'), true); assert.equal(boss.collect('boost-1'), false);
  assert.throws(() => boss.reform([1, 2]));
  boss.reform([1, 2, 3]);
  assert.equal(boss.snapshot().players[1].shapleyShubik, 1 / 6);
  const result = boss.check([1, 2, 3]); assert.equal(result.xp, 500);
  assert.throws(() => boss.check([1, 2, 3])); assert.equal(boss.backwardPlan().value, 0);
  const boosted = B.create();
  boosted.collect('boost-1'); boosted.collect('boost-2');
  assert.throws(() => boosted.collect('boost-3'), /cap/);
  assert.ok(boosted.backwardPlan().actions.length > 0);
  boosted.reform([1, 2]); assert.equal(boosted.check([1, 2, 3]).success, true);
});
test('Dean/Hill conserve resources, handle zero weights and use deterministic ties', () => {
  assert.equal(M.round(2.42, 'dean'), 3); assert.equal(M.round(2.42, 'hill'), 2);
  assert.equal(M.round(2, 'hill'), 2); assert.equal(M.round(0, 'hill'), 0);
  for (const method of ['dean', 'hill']) {
    assert.deepEqual(M.apportion([1, 1, 0], 3, method).allocations, [2, 1, 0]);
    for (let total = 4; total < 30; total++) {
      const a = M.apportion([1, 2, 3, 4], total, method).allocations;
      assert.equal(a.reduce((x, y) => x + y, 0), total); assert.ok(a.every(x => x >= 1));
    }
  }
  assert.throws(() => M.apportion([1, 1], 1)); assert.throws(() => M.npcLevels([1], 6));
  assert.equal(M.skillCheck(1, 4, 3).success, false); assert.equal(M.skillCheck(20, 1, 5).success, true);
  const environment = M.environment(S.defaultScene());
  assert.equal(environment.scene.objects.length, 14);
});
test('backward induction handles adversarial/chance nodes and rejects cycles and truncated claims', () => {
  const rules = { terminal: s => s.done ? s.value : null, player: () => 'chance',
    actions: () => [{ probability: 0.25, value: 10 }, { probability: 0.75, value: -2 }],
    next: (_, action) => ({ done: true, value: action.value }) };
  assert.equal(M.backwardInduction({}, rules).value, 1);
  assert.equal(M.backwardInduction({}, { ...rules, player: () => 'min' }).value, -2);
  assert.throws(() => M.backwardInduction({}, { ...rules, next: () => ({}) }), /acyclic/);
  assert.throws(() => M.backwardInduction({}, { ...rules, next: () => ({ other: 1 }) }, { horizon: 1 }), /horizon/);
});
test('Chicken mixed equilibrium equalizes expected utilities without falsely claiming constant sum or dominance', () => {
  const game = G.examples().chicken, result = G.analyze(game.matrix);
  assert.equal(result.constantSum, false);
  assert.deepEqual(result.pureNash, [[0, 1], [1, 0]]);
  assert.equal(result.dominance[0].strictlyDominant.length, 0);
  assert.ok(Math.abs(result.interiorMixed.row[0] - 0.9) < 1e-12);
  const q = result.interiorMixed.column;
  assert.ok(Math.abs(G.expected(game.matrix, [1, 0], q)[0] - G.expected(game.matrix, [0, 1], q)[0]) < 1e-12);
  assert.deepEqual(G.solveTree(G.matrixTree(game.matrix, game.actions)).payoff, [1, -1]);
});
test('constant-sum saddle/dominance and general-sum actor utilities are kept separate', () => {
  assert.equal(G.analyze(G.examples().constantSum.matrix).saddle.points.length, 0);
  const dominance = G.analyze(G.examples().dominance.matrix);
  assert.deepEqual(dominance.dominance[0].strictlyDominant, [0]);
  assert.deepEqual(dominance.saddle.points, [[0, 1]]);
  const tree = { actor: 1, choices: [{ label: 'A', next: { payoff: [100, 0] } }, { label: 'B', next: { payoff: [1, 2] } }] };
  assert.deepEqual(G.solveTree(tree).payoff, [1, 2]);
  const chance = { actor: 'chance', choices: [{ label: 'A', probability: 0.5, next: { payoff: [4, 0] } },
    { label: 'B', probability: 0.5, next: { payoff: [0, 4] } }] };
  assert.deepEqual(G.solveTree(chance).payoff, [2, 2]);
  assert.throws(() => G.expected(G.examples().chicken.matrix, [1, 1], [0.5, 0.5]));
  tree.choices[0].next = tree; assert.throws(() => G.solveTree(tree), /acyclic/);
});
test('Knaster reproduces the verified car example and exact zero-sum transfers', () => {
  const result = F.knaster([[9000], [8100], [7200]]);
  assert.deepEqual(result.owners, [0]); assert.equal(result.surplus.value, 900);
  assert.deepEqual(result.players.map(p => p.cash.value), [-5700, 3000, 2700]);
  assert.equal(result.players.reduce((sum, p) => F.add(sum, p.cash), F.fraction(0)).numerator, '0');
});
test('Adjusted Winner preserves shares, equity and reported envy-freedom including zero and tied valuations', () => {
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const result = F.adjustedWinner([[a, 10 - a], [b, 10 - b]]);
    assert.equal(F.compare(result.utilities[0], result.utilities[1]), 0);
    assert.ok(result.splitItems.length <= 1);
    result.allocations.forEach(shares => assert.equal(F.add(shares[0], shares[1]).value, 1));
    result.utilities.forEach((value, i) => assert.ok(F.compare(value, result.otherBundle[i]) >= 0));
  }
  assert.throws(() => F.adjustedWinner([[1], [2]])); assert.throws(() => F.adjustedWinner([[0], [0]]));
  assert.throws(() => F.knaster([[1], [-1]]));
});
test('Vickrey charges second bid with explicit tie and zero-price rules', () => {
  assert.equal(F.vickrey([100, 60, 20]).price.value, 60);
  assert.equal(F.vickrey([50, 50]).winner, 0);
  assert.equal(F.vickrey([0, 0]).price.value, 0);
  assert.throws(() => F.vickrey([1]));
});
