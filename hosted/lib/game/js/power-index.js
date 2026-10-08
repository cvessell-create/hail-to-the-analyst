// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PowerIndex = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function analyze(weights, quota, veto = []) {
    if (!Array.isArray(weights) || weights.length < 1 || weights.length > 16 ||
        weights.some(weight => !Number.isSafeInteger(weight) || weight < 0 || weight > 1000000) ||
        !Number.isSafeInteger(quota) || quota < 1 || quota > weights.reduce((a, b) => a + b, 0)) {
      throw Error('Voting model needs 1-16 nonnegative integer weights and an attainable positive quota.');
    }
    if (!Array.isArray(veto) || new Set(veto).size !== veto.length ||
        veto.some(i => !Number.isInteger(i) || i < 0 || i >= weights.length)) throw Error('Invalid veto holders.');
    const n = weights.length, size = 1 << n, sums = new Float64Array(size), counts = new Uint8Array(size);
    const factorial = [1n], pivots = weights.map(() => 0n), swings = weights.map(() => 0);
    for (let k = 1; k <= n; k++) factorial[k] = factorial[k - 1] * BigInt(k);
    for (let mask = 1; mask < size; mask++) {
      const bit = mask & -mask, index = 31 - Math.clz32(bit), previous = mask ^ bit;
      sums[mask] = sums[previous] + weights[index]; counts[mask] = counts[previous] + 1;
    }
    for (let mask = 0; mask < size; mask++) {
      const winning = candidate => sums[candidate] >= quota && veto.every(i => candidate & (1 << i));
      if (winning(mask)) continue;
      for (let i = 0; i < n; i++) {
        if (!(mask & (1 << i)) && winning(mask | (1 << i))) {
          swings[i]++;
          pivots[i] += factorial[counts[mask]] * factorial[n - counts[mask] - 1];
        }
      }
    }
    const totalSwings = swings.reduce((a, b) => a + b, 0);
    return { weights: weights.slice(), quota, veto: veto.slice(), permutationCount: factorial[n].toString(), totalSwings,
      players: weights.map((weight, i) => ({ weight, swingCount: swings[i],
        pivotalPermutations: pivots[i].toString(), shapleyShubik: Number(pivots[i]) / Number(factorial[n]),
        banzhafAbsolute: swings[i] / (2 ** (n - 1)), banzhafNormalized: swings[i] / totalSwings })) };
  }
  function critical(weights, quota, coalition, player, veto = []) {
    analyze(weights, quota, veto);
    if (!Array.isArray(coalition) || new Set(coalition).size !== coalition.length ||
        coalition.some(i => !Number.isInteger(i) || i < 0 || i >= weights.length) ||
        !Number.isInteger(player) || player < 0 || player >= weights.length) throw Error('Invalid coalition.');
    const wins = team => team.reduce((total, i) => total + weights[i], 0) >= quota &&
      veto.every(i => team.includes(i));
    return coalition.includes(player) && wins(coalition) && !wins(coalition.filter(i => i !== player));
  }
  function minimalWinning(weights, quota, veto = []) {
    analyze(weights, quota, veto);
    const wins = team => team.reduce((sum, i) => sum + weights[i], 0) >= quota &&
      veto.every(i => team.includes(i));
    const winners = [];
    for (let mask = 1; mask < (1 << weights.length); mask++) {
      const team = weights.map((_, i) => i).filter(i => mask & (1 << i));
      if (wins(team) && team.every(i => !wins(team.filter(j => j !== i)))) winners.push(team);
    }
    return winners;
  }
  function bottomUp(weights, quota, seed, costs = weights.map(() => 1)) {
      analyze(weights, quota);
      if (!Array.isArray(seed) || new Set(seed).size !== seed.length ||
          seed.some(i => !Number.isInteger(i) || i < 0 || i >= weights.length) ||
          !Array.isArray(costs) || costs.length !== weights.length ||
          costs.some(cost => !Number.isSafeInteger(cost) || cost < 0 || cost > 1000000)) throw Error('Invalid strategy inputs.');
      const candidates = minimalWinning(weights, quota).filter(team => seed.every(i => team.includes(i)))
        .map(team => ({ team, added: team.filter(i => !seed.includes(i)),
          cost: team.filter(i => !seed.includes(i)).reduce((sum, i) => sum + costs[i], 0) }))
        .sort((a, b) => a.cost - b.cost || a.added.length - b.added.length ||
          a.team.reduce((sum, i) => sum + weights[i], 0) - b.team.reduce((sum, i) => sum + weights[i], 0) ||
          a.team.join(',').localeCompare(b.team.join(',')));
      if (!candidates.length) return { feasible: false, reason: 'No inclusion-minimal winning team contains the required seed.' };
      const choice = candidates[0], team = seed.slice(), steps = [];
      choice.added.sort((a, b) => weights[a] - weights[b] || costs[a] - costs[b] || a - b).forEach(i => {
        team.push(i); steps.push({ add: i, team: team.slice(), weight: team.reduce((sum, j) => sum + weights[j], 0) });
      });
      return { feasible: true, coalition: choice.team, cost: choice.cost, steps,
        critical: choice.team.map(i => ({ player: i, critical: critical(weights, quota, choice.team, i) })) };
    }
  function encounter(participants, opponents, boss = false) {
    if (!Array.isArray(participants) || participants.length < 1 || participants.length > 16 ||
        new Set(participants.map(item => item.id)).size !== participants.length ||
        participants.some(item => typeof item.id !== 'string' || !Number.isFinite(item.maxHp) ||
          item.maxHp <= 0 || !Number.isInteger(item.level) || item.level < 1 || item.level > 5) ||
        !Array.isArray(opponents) || opponents.length > 512 ||
        opponents.some(item => !Number.isFinite(item.maxHp) || item.maxHp <= 0)) throw Error('Invalid encounter.');
    // Original balance model: enemies set the quota, never become allied coalition voters.
    const weights = participants.map(item => Math.min(1000000, Math.ceil(item.maxHp / 4) + 2 * item.level));
    const threat = opponents.reduce((sum, item) => sum + item.maxHp, 0);
    const quota = Math.ceil(weights.reduce((a, b) => a + b, 0) * (0.5 + Math.min(0.4, threat / 2000)));
    return { schema: 'hail-influence/v1', ids: participants.map(item => item.id),
      boss: Boolean(boss), cap: boss ? 500 : 300, threatHp: threat, ...analyze(weights, quota) };
  }
  function reward(model, playerId, survivingIds) {
    const index = model.ids.indexOf(playerId);
    if (index < 0 || !Array.isArray(survivingIds) ||
        new Set(survivingIds).size !== survivingIds.length || survivingIds.some(id => !model.ids.includes(id))) {
      throw Error('Invalid encounter participants.');
    }
    const player = model.players[index], coalition = survivingIds.map(id => model.ids.indexOf(id));
    const isCritical = critical(model.weights, model.quota, coalition, index);
    const alive = survivingIds.includes(playerId);
    const xp = alive ? Math.min(model.cap, Math.floor(model.cap *
      (player.shapleyShubik + player.banzhafNormalized) / 2) + (isCritical ? 25 : 0)) : 0;
    return { xp, critical: isCritical, shapleyShubik: player.shapleyShubik,
      banzhafNormalized: player.banzhafNormalized, banzhafAbsolute: player.banzhafAbsolute,
      swingCount: player.swingCount, quota: model.quota, weights: model.weights.slice(), cap: model.cap };
  }
  return { analyze, critical, minimalWinning, bottomUp, encounter, reward };
});
