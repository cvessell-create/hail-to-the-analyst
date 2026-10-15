// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const interop = require('../archive/scripts/autonomous-interop.js');

// Preserve the development orchestrator's original CLI and CommonJS contract.
if (require.main === module) {
  const stepsArg = process.argv.slice(2).find(arg => arg.startsWith('--steps='));
  const steps = stepsArg ? parseInt(stepsArg.split('=')[1], 10) : 15;
  interop.runAutonomousSession({ steps })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Autonomous session error:', error);
      process.exit(1);
    });
}

module.exports = interop;
