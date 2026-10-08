// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EncounterGames = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function validate(matrix) {
    if (!Array.isArray(matrix) || matrix.length < 2 || matrix.length > 16 ||
        !Array.isArray(matrix[0]) || matrix[0].length < 2 || matrix[0].length > 16 ||
        matrix.some(row => !Array.isArray(row) || row.length !== matrix[0].length ||
          row.some(payoff => !Array.isArray(payoff) || payoff.length !== 2 ||
            payoff.some(value => !Number.isFinite(value) || Math.abs(value) > 1000000)))) throw Error('Invalid two-player payoff matrix.');
  }
  function distribution(values, count) {
    if (!Array.isArray(values) || values.length !== count || values.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
        Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 1e-10) throw Error('Invalid probability distribution.');
  }
  function expected(matrix, rowProbabilities, columnProbabilities) {
    validate(matrix); distribution(rowProbabilities, matrix.length); distribution(columnProbabilities, matrix[0].length);
    const utilities = [0, 0];
    matrix.forEach((row, i) => row.forEach((payoff, j) => payoff.forEach((value, player) => {
      utilities[player] += rowProbabilities[i] * columnProbabilities[j] * value;
    })));
    return utilities;
  }
  function analyze(matrix) {
    validate(matrix);
    const constant = matrix[0][0][0] + matrix[0][0][1];
    const constantSum = matrix.every(row => row.every(payoff => Math.abs(payoff[0] + payoff[1] - constant) < 1e-10));
    const dominance = [0, 1].map(player => {
      const count = player === 0 ? matrix.length : matrix[0].length;
      const opponent = player === 0 ? matrix[0].length : matrix.length;
      const payoff = (choice, other) => player === 0 ? matrix[choice][other][0] : matrix[other][choice][1];
      const comparisons = [];
      for (let a = 0; a < count; a++) for (let b = 0; b < count; b++) {
        if (a === b) continue;
        const deltas = Array.from({ length: opponent }, (_, other) => payoff(a, other) - payoff(b, other));
        if (deltas.every(value => value >= 0) && deltas.some(value => value > 0)) {
          comparisons.push({ strategy: a, dominates: b, kind: deltas.every(value => value > 0) ? 'strict' : 'weak' });
        }
      }
      return { comparisons, strictlyDominant: Array.from({ length: count }, (_, i) => i)
        .filter(i => comparisons.filter(item => item.strategy === i && item.kind === 'strict').length === count - 1) };
    });
    const pureNash = [];
    matrix.forEach((row, i) => row.forEach((payoff, j) => {
      if (matrix.every(other => other[j][0] <= payoff[0]) && row.every(other => other[1] <= payoff[1])) pureNash.push([i, j]);
    }));
    let interiorMixed = null;
    if (matrix.length === 2 && matrix[0].length === 2) {
      const u = matrix.map(row => row.map(cell => cell[0])), v = matrix.map(row => row.map(cell => cell[1]));
      const du = u[0][0] - u[0][1] - u[1][0] + u[1][1], dv = v[0][0] - v[0][1] - v[1][0] + v[1][1];
      if (du !== 0 && dv !== 0) {
        const q = (u[1][1] - u[0][1]) / du, p = (v[1][1] - v[1][0]) / dv;
        if (p > 0 && p < 1 && q > 0 && q < 1) interiorMixed = {
          row: [p, 1 - p], column: [q, 1 - q], expected: expected(matrix, [p, 1 - p], [q, 1 - q]) };
      }
    }
    const rowMinimums = matrix.map(row => Math.min(...row.map(cell => cell[0])));
    const columnMaximums = matrix[0].map((_, j) => Math.max(...matrix.map(row => row[j][0])));
    const lower = Math.max(...rowMinimums), upper = Math.min(...columnMaximums);
    const saddlePoints = [];
    if (constantSum && lower === upper) matrix.forEach((row, i) => row.forEach((cell, j) => {
      if (cell[0] === lower && rowMinimums[i] === lower && columnMaximums[j] === upper) saddlePoints.push([i, j]);
    }));
    return { constantSum, sum: constantSum ? constant : null, dominance, pureNash, interiorMixed,
      saddle: constantSum ? { lower, upper, points: saddlePoints, value: saddlePoints.length ? lower : null } :
        { applicable: false, reason: 'Minimax saddle test requires zero-sum or constant-sum payoffs.' } };
  }
  function solveTree(root) {
    let nodes = 0;
    const active = new Set();
    function visit(node, depth) {
      if (++nodes > 10000 || depth > 32 || active.has(node)) throw Error('Decision tree exceeds finite acyclic budget.');
      if (!node || typeof node !== 'object' || Array.isArray(node)) throw Error('Invalid decision node.');
      if (node.payoff !== undefined) {
        if (Object.keys(node).some(key => !['label', 'payoff'].includes(key)) || !Array.isArray(node.payoff) ||
            node.payoff.length !== 2 || node.payoff.some(value => !Number.isFinite(value) || Math.abs(value) > 1000000)) throw Error('Invalid terminal payoff.');
        return { payoff: node.payoff.slice(), path: [], policy: null };
      }
      if (![0, 1, 'chance'].includes(node.actor) || !Array.isArray(node.choices) || node.choices.length < 1 ||
          node.choices.length > 128 || Object.keys(node).some(key => !['label', 'actor', 'choices'].includes(key))) throw Error('Invalid rational-choice node.');
      active.add(node);
      const outcomes = node.choices.map(choice => {
        if (!choice || typeof choice.label !== 'string' || choice.label.length > 120 ||
            Object.keys(choice).some(key => !['label', 'next', 'probability'].includes(key))) throw Error('Invalid decision choice.');
        return { label: choice.label, probability: choice.probability, ...visit(choice.next, depth + 1) };
      });
      active.delete(node);
      if (node.actor === 'chance') {
        distribution(outcomes.map(choice => choice.probability), outcomes.length);
        return { payoff: [0, 1].map(player => outcomes.reduce((sum, choice) => sum + choice.probability * choice.payoff[player], 0)),
          path: [], policy: { actor: 'chance', outcomes } };
      }
      const best = outcomes.reduce((winner, candidate) => candidate.payoff[node.actor] > winner.payoff[node.actor] ? candidate : winner);
      return { payoff: best.payoff, path: [best.label, ...best.path],
        policy: { actor: node.actor, choice: best.label, outcomes } };
    }
    return { ...visit(root, 0), nodes, assumptions: 'Finite perfect-information tree; declared additive utilities; deterministic first-choice tie-break; rationality means maximizing the acting player utility.' };
  }
  function matrixTree(matrix, actions) {
    validate(matrix);
    return { actor: 0, choices: matrix.map((row, i) => ({ label: actions[i] || `Player ${i}`,
      next: { actor: 1, choices: row.map((payoff, j) => ({ label: actions[j] || `NPC ${j}`, next: { payoff } })) } })) };
  }
  function examples() {
    return { chicken: { actions: ['Yield', 'Charge'], matrix: [[[0, 0], [-1, 1]], [[1, -1], [-10, -10]]] },
      constantSum: { actions: ['Left', 'Right'], matrix: [[[3, 0], [0, 3]], [[0, 3], [3, 0]]] },
      dominance: { actions: ['Shield', 'Expose'], matrix: [[[3, 0], [2, 1]], [[1, 2], [0, 3]]] } };
  }
  return { expected, analyze, solveTree, matrixTree, examples };
});
