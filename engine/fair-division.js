// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FairDivision = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a < 0n ? -a : a; }
  function fraction(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d <= 0n) throw Error('Invalid denominator.');
    const divisor = gcd(n, d);
    return { numerator: (n / divisor).toString(), denominator: (d / divisor).toString(),
      value: Number(n) / Number(d) };
  }
  function add(a, b) {
    return fraction(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator),
      BigInt(a.denominator) * BigInt(b.denominator));
  }
  function compare(a, b) {
    const delta = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  }
  function validate(bids, minimum = 2, maximum = 8) {
    if (!Array.isArray(bids) || bids.length < minimum || bids.length > maximum ||
        !Array.isArray(bids[0]) || bids[0].length < 1 || bids[0].length > 128 ||
        bids.some(row => !Array.isArray(row) || row.length !== bids[0].length ||
          row.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000))) {
      throw Error('Expected a bounded rectangular matrix of nonnegative integer valuations.');
    }
  }
  function adjustedWinner(bids) {
    validate(bids, 2, 2);
    const [a, b] = bids, budget = a.reduce((sum, value) => sum + value, 0);
    if (budget <= 0 || budget !== b.reduce((sum, value) => sum + value, 0)) throw Error('Adjusted Winner requires equal positive point budgets.');
    const owners = a.map((value, i) => value >= b[i] ? 0 : 1);
    const totals = [0, 0];
    owners.forEach((owner, i) => { totals[owner] += bids[owner][i]; });
    const rich = totals[0] >= totals[1] ? 0 : 1, poor = 1 - rich;
    const order = owners.map((_, i) => i).filter(i => owners[i] === rich).sort((i, j) => {
      const left = BigInt(bids[rich][i]) * BigInt(bids[poor][j]);
      const right = BigInt(bids[rich][j]) * BigInt(bids[poor][i]);
      return left < right ? -1 : left > right ? 1 : i - j;
    });
    const allocations = owners.map(owner => [fraction(owner === 0 ? 1 : 0), fraction(owner === 1 ? 1 : 0)]);
    const transfers = [];
    for (const i of order) {
      const gap = totals[rich] - totals[poor];
      if (!gap) break;
      const combined = bids[rich][i] + bids[poor][i];
      if (gap >= combined) {
        allocations[i][rich] = fraction(0); allocations[i][poor] = fraction(1);
        totals[rich] -= bids[rich][i]; totals[poor] += bids[poor][i];
        transfers.push({ item: i, from: rich, to: poor, share: fraction(1) });
      } else {
        const share = fraction(gap, combined);
        allocations[i][poor] = share; allocations[i][rich] = fraction(combined - gap, combined);
        transfers.push({ item: i, from: rich, to: poor, share });
        break;
      }
    }
    const utilities = [fraction(0), fraction(0)], otherBundle = [fraction(0), fraction(0)];
    allocations.forEach((shares, i) => {
      for (let player = 0; player < 2; player++) {
        utilities[player] = add(utilities[player], fraction(BigInt(bids[player][i]) * BigInt(shares[player].numerator),
          shares[player].denominator));
        otherBundle[player] = add(otherBundle[player], fraction(BigInt(bids[player][i]) * BigInt(shares[1 - player].numerator),
          shares[1 - player].denominator));
      }
    });
    if (compare(utilities[0], utilities[1]) !== 0 || utilities.some((utility, i) => compare(utility, otherBundle[i]) < 0)) {
      throw Error('Adjusted Winner invariant failed.');
    }
    return { method: 'adjusted-winner/v1', tieBreak: 'lower player index', budget, allocations, utilities,
      otherBundle, transfers, splitItems: allocations.map((shares, i) => i).filter(i => {
        const share = allocations[i][0]; return share.numerator !== '0' && share.numerator !== share.denominator;
      }) };
  }
  function knaster(bids) {
    validate(bids);
    const n = BigInt(bids.length), totals = bids.map(row => row.reduce((sum, value) => sum + BigInt(value), 0n));
    const owners = bids[0].map((_, item) => bids.reduce((best, row, player) =>
      row[item] > bids[best][item] ? player : best, 0));
    const won = bids.map(() => 0n);
    owners.forEach((owner, item) => { won[owner] += BigInt(bids[owner][item]); });
    const surplusNumerator = n * won.reduce((a, b) => a + b, 0n) - totals.reduce((a, b) => a + b, 0n);
    const surplusShare = fraction(surplusNumerator, n * n);
    const players = bids.map((_, i) => ({
      ownGoodsValue: fraction(won[i]), fairShare: fraction(totals[i], n), surplusShare,
      cash: fraction(n * totals[i] + surplusNumerator - n * n * won[i], n * n),
      utility: fraction(n * totals[i] + surplusNumerator, n * n)
    }));
    if (players.reduce((total, player) => add(total, player.cash), fraction(0)).numerator !== '0' ||
        surplusNumerator < 0n) throw Error('Knaster budget invariant failed.');
    return { method: 'knaster/v1', tieBreak: 'lower player index', owners,
      surplus: fraction(surplusNumerator, n), players };
  }
  function vickrey(bids) {
    if (!Array.isArray(bids) || bids.length < 2 || bids.length > 8 ||
        bids.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)) throw Error('Auction needs 2-8 nonnegative integer bids.');
    const ranked = bids.map((bid, player) => ({ bid, player })).sort((a, b) => b.bid - a.bid || a.player - b.player);
    return { method: 'vickrey/v1', winner: ranked[0].player, price: fraction(ranked[1].bid),
      topBid: ranked[0].bid, tieBreak: 'lower player index', reserve: 0 };
  }
  return { fraction, add, compare, adjustedWinner, knaster, vickrey };
});
