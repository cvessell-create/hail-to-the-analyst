// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';

/**
 * Autonomous arena runner and inter-repo interop orchestrator.
 * Connects the Hail-to-the-Analyst arena with autonomous agent controllers
 * and reports structured receipts for VessellFramework coordination.
 */

const { createServer } = require('../../server/index.js');
const { createAutonomousAgent } = require('../../server/autonomous-agent.js');

async function runAutonomousSession(options = {}) {
  const steps = options.steps || 15;
  const port = options.port || 0; // 0 for random free port
  const host = '127.0.0.1';

  const { server, arena } = createServer({ manual: true });
  await new Promise(resolve => server.listen(port, host, resolve));
  const assignedPort = server.address().port;
  const arenaUrl = `http://${host}:${assignedPort}`;

  const receipts = [];
  try {
    // 1. Initialize Autonomous Slade Agent
    const slade = createAutonomousAgent({ name: 'Jack-Slade-Autonomous', arenaUrl });
    await slade.join();
    receipts.push({ step: 'join_primary', player: 'Slade', token: slade.token ? 'ok' : 'missing' });

    // 2. Initialize Partner Agent to allow multi-agent rounds
    const partner = createAutonomousAgent({ name: 'Echo-Analyst-Autonomous', arenaUrl });
    await partner.join();
    receipts.push({ step: 'join_secondary', player: 'Partner', token: partner.token ? 'ok' : 'missing' });

    // 3. Step simulation ticks and tactical decisions
    const tacticalSteps = [];
    for (let i = 0; i < steps; i++) {
      arena.step(1 / 60);
      const state = await slade.getState();
      const action = await slade.stepTactics(state);
      tacticalSteps.push({ tick: i + 1, sequence: action.sequence, fire: action.input.fire });
    }
    receipts.push({ step: 'tactics', stepsExecuted: tacticalSteps.length });

    // 4. Autonomous Game Theory Round (Vickrey pre-combat auction)
    const roundRes = await fetch(`${arenaUrl}/api/round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${slade.token}`,
      },
      body: JSON.stringify({ method: 'vickrey' }),
    });

    let roundSettlement = null;
    if (roundRes.ok) {
      const roundData = await roundRes.json();
      receipts.push({ step: 'round_opened', roundId: roundData.id, method: roundData.method });

      // Both agents submit sealed bids
      await slade.handleRoundBidding(roundData, 800);
      const partnerBidRes = await partner.handleRoundBidding(roundData, 600);
      roundSettlement = partnerBidRes;
      receipts.push({ step: 'round_settled', result: roundSettlement });
    }

    // 5. Final state capture
    const finalState = await slade.getState();

    slade.stop();
    partner.stop();

    return {
      success: true,
      arenaUrl,
      port: assignedPort,
      stepsRequested: steps,
      tacticalStepsCount: tacticalSteps.length,
      roundSettled: Boolean(roundSettlement),
      phase: finalState.phase,
      locked: finalState.locked,
      receipts,
      timestamp: Date.now(),
    };
  } finally {
    server.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const stepsArg = args.find(a => a.startsWith('--steps='));
  const steps = stepsArg ? parseInt(stepsArg.split('=')[1], 10) : 15;

  runAutonomousSession({ steps })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Autonomous session error:', err);
      process.exit(1);
    });
}

module.exports = { runAutonomousSession };
