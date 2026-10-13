// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAutonomousAgent } = require('../server/autonomous-agent.js');
const { createServer } = require('../server/index.js');

test('AutonomousAgent initializes with default properties', () => {
  const agent = createAutonomousAgent({ name: 'Test-Agent' });
  assert.equal(agent.name, 'Test-Agent');
  assert.equal(agent.token, null);
  assert.equal(agent.sequence, 0);
  assert.equal(agent.isActive, false);
});

test('AutonomousAgent computes tactical action towards enemy', () => {
  const agent = createAutonomousAgent();
  const mockState = {
    player: {
      id: 'p1',
      hp: 100,
      position: { x: 5, y: 5, angle: 0 },
    },
    enemies: [
      { id: 'e1', hp: 50, position: { x: 10, y: 5 } },
    ],
  };

  const action = agent.computeTacticalAction(mockState);
  assert.ok(typeof action.forward === 'number');
  assert.ok(typeof action.turn === 'number');
  assert.ok(typeof action.fire === 'boolean');
  assert.equal(action.fire, true);
  assert.ok(action.forward > 0);
});

test('AutonomousAgent computes fair division bids for all methods', () => {
  const agent = createAutonomousAgent();

  // Adjusted Winner (must sum to 100)
  const awRound = { id: 1, method: 'adjusted-winner', goods: ['item1', 'item2'] };
  const awBid = agent.computeFairDivisionBid(awRound, 1000);
  assert.equal(awBid.length, 2);
  assert.equal(awBid.reduce((a, b) => a + b, 0), 100);

  // Vickrey auction
  const vickreyRound = { id: 2, method: 'vickrey', goods: ['power-cell'] };
  const vickreyBid = agent.computeFairDivisionBid(vickreyRound, 500);
  assert.equal(vickreyBid.length, 1);
  assert.ok(vickreyBid[0] <= 500);

  // Knaster auction
  const knasterRound = { id: 3, method: 'knaster', goods: ['good1', 'good2', 'good3'] };
  const knasterBid = agent.computeFairDivisionBid(knasterRound, 600);
  assert.equal(knasterBid.length, 3);
  assert.ok(knasterBid.reduce((a, b) => a + b, 0) <= 600);
});

test('AutonomousAgent joins arena, steps tactics, and handles bidding', async () => {
  const { server } = createServer({ manual: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const arenaUrl = `http://127.0.0.1:${port}`;

  try {
    const agent = createAutonomousAgent({ name: 'Slade-Bot', arenaUrl });
    const joinResult = await agent.join();
    assert.ok(joinResult.token);
    assert.equal(agent.isActive, true);

    const state = await agent.getState();
    assert.ok(state.scene);

    const stepResult = await agent.stepTactics(state);
    assert.equal(stepResult.sequence, 1);
    assert.equal(agent.sequence, 1);

    // Join a second player to satisfy round requirements
    const agent2 = createAutonomousAgent({ name: 'Partner-Bot', arenaUrl });
    await agent2.join();

    // Start vickrey pre-combat round
    const vickreyStartRes = await fetch(`${arenaUrl}/api/round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agent.token}`,
      },
      body: JSON.stringify({ method: 'vickrey' }),
    });
    assert.equal(vickreyStartRes.status, 201);
    const roundData = await vickreyStartRes.json();

    const bid1 = await agent.handleRoundBidding(roundData, 1000);
    assert.ok(bid1);

    agent.stop();
    assert.equal(agent.isActive, false);
  } finally {
    server.close();
  }
});
