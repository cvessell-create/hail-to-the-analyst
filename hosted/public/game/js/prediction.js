// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailPrediction = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_FRAME_SECONDS = 0.05;

  function advance(world, input, seconds) {
    if (!world || typeof world.move !== 'function' || typeof world.turn !== 'function') {
      throw Error('A movement world is required.');
    }
    if (!input || ![input.forward, input.strafe, input.turn].every(value =>
      Number.isFinite(value) && Math.abs(value) <= 1)) {
      throw Error('Movement input must be finite and normalized.');
    }
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_FRAME_SECONDS) {
      throw Error('Prediction step must be between zero and 50 milliseconds.');
    }

    world.turn(input.turn * 2 * seconds);
    return world.move(input.forward, input.strafe, 2.25 * seconds);
  }

  return { advance, MAX_FRAME_SECONDS };
});
