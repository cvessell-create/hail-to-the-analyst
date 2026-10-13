// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Deception doctrine cards for the intel layer. Payoffs are declared design
// values in game units (row = player intel score, constant-sum 10), not
// historical calibration. Each card is solved with EncounterGames.analyze.
(function (root, factory) {
  const api = factory(root.EncounterGames || (typeof require === 'function' ? require('./game-theory.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeceptionOps = api;
})(typeof globalThis === 'object' ? globalThis : this, function (G) {
  'use strict';
  const pair = rows => rows.map(row => row.map(v => [v, 10 - v]));
  const CARDS = [
    { id: 'fortitude_south', title: 'Operation Fortitude South', doctrine: 'phantom army',
      brief: 'A paper army of inflatable tanks and fake radio traffic points at the wrong coast.',
      rows: ['land at the real beach', 'land at the decoy coast'], cols: ['guard the real beach', 'guard the decoy coast'],
      payoff: pair([[2, 8], [6, 1]]) },
    { id: 'norway_feint', title: 'The Norway Feint', doctrine: 'strategic diversion',
      brief: 'Threaten the north so the defender keeps reserves pinned far from the main front.',
      rows: ['threaten the north', 'commit the main front'], cols: ['garrison the north', 'release reserves'],
      payoff: pair([[3, 1], [7, 2]]) },
    { id: 'maskirovka_air', title: 'Maskirovka: Jet Decoys', doctrine: 'maskirovka',
      brief: 'Decoy emitters and dummy airfields soak up air-defense attention before the jets go in.',
      rows: ['launch decoy emitters', 'direct jet strike'], cols: ['engage the decoys', 'hold fire'],
      payoff: pair([[6, 2], [3, 5]]) },
    { id: 'unintentional_mistake', title: 'The Unintentional Mistake', doctrine: 'noise and misread signals',
      brief: 'A courier drops the wrong map. Was it a slip or a plant? The defender must decide whether to trust it.',
      rows: ['act on the dropped map', 'ignore the dropped map'], cols: ['map was genuine', 'map was planted'],
      payoff: pair([[8, 2], [4, 6]]) },
    { id: 'info_warfare', title: 'Signals and Static', doctrine: 'information warfare',
      brief: 'Jam their radio or spoof it? Spoofing pays big if they listen, jamming is the safer play.',
      rows: ['jam the channel', 'spoof the channel'], cols: ['trust the channel', 'switch to couriers'],
      payoff: pair([[5, 5], [9, 2]]) }
  ];
  function solve(card) {
    const a = G.analyze(card.payoff);
    const dominant = a.dominance[0].strictlyDominant.map(i => card.rows[i]);
    const saddle = a.saddle.points && a.saddle.points.length ? a.saddle.points[0] : null;
    return {
      id: card.id, title: card.title, doctrine: card.doctrine,
      value: saddle ? a.saddle.value : a.interiorMixed ? a.interiorMixed.expected[0] : null,
      pure: saddle ? { row: card.rows[saddle[0]], col: card.cols[saddle[1]] } : null,
      mix: !saddle && a.interiorMixed ? a.interiorMixed.row.map((p, i) => ({ move: card.rows[i], p })) : null,
      dominant, evidence: 'design values in game units; not historical calibration'
    };
  }
  function cardFor(mission) {
    const m = Number.isInteger(mission) && mission >= 0 ? mission : 0;
    return CARDS[m % CARDS.length];
  }
  function briefing(mission) {
    const card = cardFor(mission), s = solve(card);
    const play = s.pure ? `Best play: ${s.pure.row}.` :
      s.mix ? `No safe pure play. Mix: ${s.mix.map(x => `${Math.round(x.p * 100)}% ${x.move}`).join(', ')}.` : '';
    return `${card.title} — ${card.brief} ${play}`;
  }
  return { CARDS, solve, cardFor, briefing };
});
