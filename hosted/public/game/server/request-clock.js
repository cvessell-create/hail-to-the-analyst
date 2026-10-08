// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const { createArena } = require('./arena');
function restoreAndAdvance(saved, updated, current) {
  if (![updated, current].every(Number.isFinite) || current < updated) {
    throw Error('Invalid persisted room clock.');
  }
  let time = Math.max(updated, current - 2000);
  const arena = createArena(() => time, { saved });
  while (time < current) {
    const next = Math.min(current, time + 1000 / 60);
    const dt = (next - time) / 1000;
    time = next;
    arena.step(dt);
  }
  return arena;
}
module.exports = { restoreAndAdvance };
