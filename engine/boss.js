// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../js/power-index.js') : root.PowerIndex,
    typeof module === 'object' && module.exports ? require('./math.js') : root.EngineMath);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UltraBoss = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Power, MathEngine) {
  'use strict';
  function create() {
    let stage = 'shielded', extra = 0, formation = null;
    const collected = new Set();
    const weights = () => [stage === 'shielded' ? 12 : 4, extra, 2, 2];
    const quota = () => stage === 'shielded' ? 10 : extra + 4;
    const veto = () => stage === 'shielded' ? [0] : [];
    function snapshot() {
      const w = weights(), model = Power.analyze(w, quota(), veto());
      return { stage, extra, formation: formation && formation.slice(), ids: ['ultra', 'jack', 'reader', 'medic'],
        ...model, teams: Power.minimalWinning([extra, 2, 2], 6).map(team => team.map(i => i + 1)) };
    }
    return {
      snapshot() {
        if (extra + 4 < 6) {
          const model = Power.analyze(weights(), quota(), veto());
          return { stage, extra, formation, ids: ['ultra', 'jack', 'reader', 'medic'], ...model, teams: [] };
        }
        return snapshot();
      },
      strategy() {
        if (stage === 'defeated') return { feasible: false, reason: 'Challenge already completed.' };
        if (stage === 'exposed') return { feasible: true, boosts: [],
          challenge: Power.bottomUp(weights().slice(1), quota(), [0]),
          steps: [{ action: 'check', team: [1, 2, 3] }] };
        const available = ['boost-1', 'boost-2', 'boost-3'].filter(token => !collected.has(token));
        for (let count = 0; count <= available.length; count++) {
          const futureExtra = extra + 2 * count;
          if (futureExtra + 4 < 6 || futureExtra > 4) continue;
          const shield = Power.bottomUp([futureExtra, 2, 2], 6, [0]);
          if (!shield.feasible || shield.coalition.length < 2) continue;
          const challenge = Power.bottomUp([futureExtra, 2, 2], futureExtra + 4, [0]);
          return { feasible: true, boosts: available.slice(0, count), shield, challenge,
            steps: [...available.slice(0, count).map(token => ({ action: 'collect', token })),
              ...shield.steps.map(step => ({ action: 'recruit', player: step.add + 1, weight: step.weight })),
              { action: 'reform', team: shield.coalition.map(i => i + 1) },
              { action: 'check', team: challenge.coalition.map(i => i + 1) }] };
        }
        return { feasible: false, reason: 'No valid two-member shield team; reset the challenge rather than inventing votes.' };
      },
      backwardPlan() {
        if (stage === 'defeated') return { value: 0, actions: [], exact: true, nodes: 1 };
        if (extra === 6 && stage === 'shielded') return { value: 0, actions: [], exact: true, nodes: 1,
          reason: 'No two-member inclusion-minimal shield team remains; reset challenge.' };
        const current = { stage, extra, tokens: Array.from(collected).sort(), cost: 0 };
        function restore(state) {
          const game = create();
          state.tokens.forEach(token => game.collect(token));
          if (state.stage !== 'shielded') {
            const strategy = game.strategy();
            game.reform(strategy.steps.find(step => step.action === 'reform').team);
          }
          return game;
        }
        return MathEngine.backwardInduction(current, {
          terminal: state => state.stage === 'defeated' ? 500 - state.cost :
            state.stage === 'failed' ? -state.cost : null,
          player: () => 'max',
          actions(state) {
            if (state.stage === 'exposed') return [{ action: 'check', team: [1, 2, 3] }];
            const game = restore(state), view = game.snapshot();
            const actions = ['boost-1', 'boost-2', 'boost-3'].filter(token => state.extra < 4 && !state.tokens.includes(token))
              .map(token => ({ action: 'collect', token }));
            view.teams.filter(team => team.includes(1) && team.length >= 2).forEach(team => actions.push({ action: 'reform', team }));
            return actions.length ? actions : [{ action: 'stop' }];
          },
          next(state, action) {
            const game = restore(state);
            if (action.action === 'stop') return { ...state, stage: 'failed' };
            if (action.action === 'collect') {
              game.collect(action.token);
              return { stage: 'shielded', extra: state.extra + 2, tokens: [...state.tokens, action.token].sort(), cost: state.cost + 10 };
            }
            if (action.action === 'reform') { game.reform(action.team); return { ...state, stage: 'exposed' }; }
            return { ...state, stage: game.check(action.team).success ? 'defeated' : 'failed' };
          }
        }, { horizon: 6 });
      },
      collect(token) {
        if (stage !== 'shielded' || !['boost-1', 'boost-2', 'boost-3'].includes(token)) throw Error('Boost unavailable.');
        if (collected.has(token)) return false;
        if (extra >= 4) throw Error('Boost cap reached: preserve a team-based shield challenge.');
        collected.add(token); extra += 2; return true;
      },
      reform(team) {
        if (stage !== 'shielded' || extra + 4 < 6 || !Array.isArray(team) || team.length < 2 ||
            new Set(team).size !== team.length || !team.includes(1) ||
            team.some(i => ![1, 2, 3].includes(i)) ||
            !Power.minimalWinning([extra, 2, 2], 6).some(candidate =>
              candidate.length === team.length && candidate.every(i => team.includes(i + 1)))) {
          throw Error('Shield break requires Jack and an inclusion-minimal winning team of at least two.');
        }
        formation = team.slice(); stage = 'exposed'; return this.snapshot();
      },
      check(team) {
        if (stage !== 'exposed') throw Error('Boss veto must be removed first.');
        if (!Array.isArray(team) || !team.includes(1) || team.some(i => ![1, 2, 3].includes(i))) throw Error('Invalid boss team.');
        const w = weights(), model = Power.analyze(w, quota());
        const success = Power.critical(w, quota(), team, 1);
        if (success) stage = 'defeated';
        return { success, critical: success, ...model.players[1], xp: success ? 500 : 0 };
      }
    };
  }
  return { create };
});
