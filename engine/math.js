// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./systems.js') : root.EngineSystems);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EngineMath = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Systems) {
  'use strict';
  function round(value, method = 'hill') {
    if (!Number.isFinite(value) || value < 0 || value > 1000000 || !['dean', 'hill'].includes(method)) throw Error('Invalid apportionment rounding.');
    if (value === 0) return 0;
    const lower = Math.floor(value);
    const threshold = method === 'dean' ? 2 * lower * (lower + 1) / (2 * lower + 1) : Math.sqrt(lower * (lower + 1));
    return value >= threshold ? lower + 1 : lower;
  }
  function apportion(weights, total, method = 'hill') {
    if (!Array.isArray(weights) || weights.length < 1 || weights.length > 128 ||
        weights.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000) ||
        !Number.isInteger(total) || total < 0 || total > 10000 || !['dean', 'hill'].includes(method)) {
      throw Error('Invalid resource apportionment.');
    }
    const positive = weights.filter(value => value > 0).length;
    if ((positive === 0 && total !== 0) || total < positive) throw Error('Insufficient resources for one unit per positive participant.');
    const allocations = weights.map(value => value > 0 ? 1 : 0);
    function priority(i) {
      const w = BigInt(weights[i]), k = BigInt(allocations[i]);
      return method === 'hill' ? [w * w, k * (k + 1n)] : [w * (2n * k + 1n), 2n * k * (k + 1n)];
    }
    for (let seat = positive; seat < total; seat++) {
      let winner = -1;
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] === 0) continue;
        if (winner === -1) { winner = i; continue; }
        const [a, b] = priority(i), [c, d] = priority(winner);
        if (a * d > c * b) winner = i;
      }
      allocations[winner]++;
    }
    return { method, total, weights: weights.slice(), allocations, tieBreak: 'lower index',
      minimum: 'one unit per positive participant; zero weights excluded' };
  }
  function npcLevels(weights, budget) {
    const result = apportion(weights, budget, 'hill');
    if (result.allocations.some(value => value > 5)) throw Error('NPC level budget exceeds the level-five limit.');
    return result;
  }
  function skillCheck(roll, rawBonus, npcRawLevel) {
    if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw Error('Skill roll must be a d20 result.');
    const bonus = round(rawBonus, 'hill'), npcLevel = round(npcRawLevel, 'hill');
    if (bonus > 5 || npcLevel < 1 || npcLevel > 5) throw Error('Skill/NPC tier must be 1-5.');
    const target = 10 + npcLevel, total = roll + bonus;
    return { roll, bonus, npcLevel, target, total, success: roll !== 1 && (roll === 20 || total >= target) };
  }
  function environment(scene, weights = [1, 2, 3, 4], total = 12) {
    const valid = Systems.validateScene(scene), allocation = apportion(weights, total, 'dean');
    if (weights.length !== 4) throw Error('Environment has four horizontal sectors.');
    if (!valid.assets.some(asset => asset.id === 'beacon')) throw Error('Environment requires the beacon asset.');
    const positions = weights.map(() => []);
    for (let y = 1; y < valid.grid.length - 1; y++) {
      for (let x = 1; x < valid.grid[0].length - 1; x++) {
        if (valid.grid[y][x] !== '.' || valid.objects.some(object => Math.floor(object.x) === x && Math.floor(object.y) === y)) continue;
        const sector = Math.min(3, Math.floor((x - 1) * 4 / (valid.grid[0].length - 2)));
        positions[sector].push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    allocation.allocations.forEach((count, sector) => {
      if (positions[sector].length < count) throw Error(`Sector ${sector + 1} lacks placement capacity.`);
      for (let i = 0; i < count; i++) valid.objects.push({ id: `resource-${sector}-${i}`, type: 'sprite',
        label: `Sector ${sector + 1} resource`, ...positions[sector][i], asset: 'beacon', scale: 0.35 });
    });
    return { scene: Systems.validateScene(valid), allocation };
  }
  function backwardInduction(root, rules, { horizon = 16, maxNodes = 10000 } = {}) {
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 64 ||
        !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 100000) throw Error('Invalid planning budget.');
    let nodes = 0;
    const memo = new Map(), active = new Set();
    function visit(state, depth) {
      if (++nodes > maxNodes) throw Error('Planning node budget exceeded.');
      const key = JSON.stringify(state);
      if (active.has(key)) throw Error('Backward induction requires an acyclic finite game.');
      const cacheKey = depth + ':' + key;
      if (memo.has(cacheKey)) return memo.get(cacheKey);
      const terminal = rules.terminal(state);
      if (terminal !== null) {
        if (!Number.isFinite(terminal)) throw Error('Invalid terminal payoff.');
        return { value: terminal, actions: [], exact: true };
      }
      if (depth === 0) throw Error('Nonterminal planning horizon: no exact backward-induction result.');
      const actions = rules.actions(state), player = rules.player(state);
      if (!Array.isArray(actions) || !actions.length || actions.length > 128 || !['max', 'min', 'chance'].includes(player)) throw Error('Invalid game node.');
      if (player === 'chance' && (actions.some(action => !Number.isFinite(action.probability) || action.probability < 0) ||
          Math.abs(actions.reduce((sum, action) => sum + action.probability, 0) - 1) > 1e-10)) throw Error('Invalid chance probabilities.');
      active.add(key);
      let best = null, expected = 0;
      const branches = [];
      for (const action of actions) {
        const child = visit(rules.next(state, action), depth - 1);
        const candidate = { value: child.value, actions: [action, ...child.actions], exact: child.exact };
        if (player === 'chance') { expected += action.probability * child.value; branches.push({ action, ...child }); }
        if (!best || (player === 'max' ? candidate.value > best.value : candidate.value < best.value)) best = candidate;
      }
      if (player === 'chance') best = { value: expected, actions: [], branches, exact: true };
      active.delete(key); memo.set(cacheKey, best); return best;
    }
    return { ...visit(root, horizon), nodes };
  }
  return { round, apportion, npcLevels, skillCheck, environment, backwardInduction };
});
