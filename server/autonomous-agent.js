// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';

/**
 * Autonomous tactical agent for hail-to-the-analyst arena.
 * Evaluates arena state, computes tactical actions, and engages
 * in game-theoretic fair division auctions and harvest rounds.
 */
function createAutonomousAgent(options = {}) {
  const name = options.name || 'Autonomous-Slade-Agent';
  const arenaUrl = options.arenaUrl || 'http://127.0.0.1:8787';
  const fetchImpl = options.fetch || globalThis.fetch;
  const advisorUrl = options.advisorUrl || null; // e.g. VessellFramework bridge

  let token = null;
  let playerId = null;
  let sequence = 0;
  let active = false;
  let lastAction = null;
  const history = [];

  return {
    get name() { return name; },
    get token() { return token; },
    get playerId() { return playerId; },
    get sequence() { return sequence; },
    get isActive() { return active; },
    get lastAction() { return lastAction; },
    get history() { return history.slice(); },

    async join() {
      const res = await fetchImpl(`${arenaUrl}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`Failed to join arena: ${err.error || res.status}`);
      }
      const data = await res.json();
      token = data.token;
      playerId = data.id || (data.player && data.player.id) || null;
      active = true;
      history.push({ type: 'joined', time: Date.now(), token, playerId });
      return data;
    },

    async getState() {
      if (!token) throw new Error('Agent must join arena before querying state.');
      const res = await fetchImpl(`${arenaUrl}/api/state`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to get state: HTTP ${res.status}`);
      }
      return await res.json();
    },

    computeTacticalAction(state) {
      if (!state) return { forward: 0, strafe: 0, turn: 0, fire: false };
      const me = state.player || (state.sessions && state.sessions.find(([t]) => {
        if (!t || !token) return false;
        const actual = crypto.createHash('sha256').update(t).digest();
        const expected = crypto.createHash('sha256').update(token).digest();
        return crypto.timingSafeEqual(actual, expected);
      })?.[1]);
      const enemies = (state.enemies || []).filter(e => e.hp > 0);

      if (!me || me.hp <= 0) {
        return { forward: 0, strafe: 0, turn: 0, fire: false };
      }

      // If enemies present, locate closest enemy and orient
      if (enemies.length > 0) {
        const myPos = me.position || { x: 0, y: 0, angle: 0 };
        let nearest = enemies[0];
        let minDist = Infinity;

        for (const enemy of enemies) {
          const ep = enemy.position || { x: 0, y: 0 };
          const dist = Math.hypot(ep.x - myPos.x, ep.y - myPos.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = enemy;
          }
        }

        const np = nearest.position || { x: 0, y: 0 };
        const targetAngle = Math.atan2(np.y - myPos.y, np.x - myPos.x);
        let angleDiff = targetAngle - (myPos.angle || 0);
        // Normalize angle diff to [-pi, pi]
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        const turn = Math.max(-1, Math.min(1, angleDiff * 2));
        const fire = Math.abs(angleDiff) < 0.25 && minDist < 12;
        const forward = minDist > 4 ? 0.75 : minDist < 2 ? -0.5 : 0;

        return { forward, strafe: 0, turn, fire };
      }

      return { forward: 0.5, strafe: 0, turn: 0.1, fire: false };
    },

    async stepTactics(stateOverride = null) {
      if (!token) throw new Error('Agent not joined.');
      const state = stateOverride || await this.getState();
      const action = this.computeTacticalAction(state);

      sequence += 1;
      const inputPayload = {
        sequence,
        forward: action.forward,
        strafe: action.strafe,
        turn: action.turn,
        fire: action.fire,
      };

      const res = await fetchImpl(`${arenaUrl}/api/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inputPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`Failed to send input: ${err.error || res.status}`);
      }

      lastAction = { type: 'input', sequence, input: inputPayload, timestamp: Date.now() };
      history.push(lastAction);
      return lastAction;
    },

    computeFairDivisionBid(round, playerCredits = 1000) {
      if (!round || !round.goods) return [];
      const goodsCount = round.goods.length;
      if (round.method === 'adjusted-winner') {
        // Must sum to exactly 100
        if (goodsCount === 3) return [40, 35, 25];
        const base = Math.floor(100 / goodsCount);
        const remainder = 100 - base * goodsCount;
        const bids = new Array(goodsCount).fill(base);
        bids[0] += remainder;
        return bids;
      }
      if (round.method === 'vickrey') {
        // True valuation bidding
        return [Math.min(250, Number(playerCredits) || 250)];
      }
      // Knaster: balanced valuations within credit liquidity
      const budget = Math.min(600, Number(playerCredits) || 600);
      const perItem = Math.floor(budget / goodsCount);
      return new Array(goodsCount).fill(perItem);
    },

    async handleRoundBidding(round, credits = 1000) {
      if (!token || !round || round.state !== 'bidding') return null;
      const values = this.computeFairDivisionBid(round, credits);

      const res = await fetchImpl(`${arenaUrl}/api/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roundId: round.id, values }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`Bid failed: ${err.error || res.status}`);
      }

      const result = await res.json();
      const bidRecord = { type: 'bid', roundId: round.id, values, timestamp: Date.now() };
      history.push(bidRecord);
      return result;
    },

    async harvestReward(amount = 25) {
      if (!token) throw new Error('Agent not joined.');
      const res = await fetchImpl(`${arenaUrl}/api/harvest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`Harvest failed: ${err.error || res.status}`);
      }
      const record = { type: 'harvest', amount, timestamp: Date.now() };
      history.push(record);
      return await res.json();
    },

    stop() {
      active = false;
      history.push({ type: 'stopped', timestamp: Date.now() });
    },
  };
}

module.exports = { createAutonomousAgent };
