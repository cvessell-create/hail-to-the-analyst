'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createArena } = require('../server/arena');
const { restoreAndAdvance } = require('../server/request-clock');
test('request-driven room advances retained input at simulation time, not request-end time', () => {
  const time = 1000;
  const initial = createArena(() => time);
  const player = initial.join('Clock test');
  initial.input(player.token, { sequence: 1, forward: 1, strafe: 0, turn: 0, fire: true });
  const saved = JSON.parse(JSON.stringify(initial.exportState()));
  const arena = restoreAndAdvance(saved, time, time + 400);
  const view = arena.snapshot(player.token);
  assert.ok(view.players[0].x > 1.8);
  assert.equal(view.combat.locked, true);
  assert.ok(view.players[0].x < 2.1, 'input still expires after 250ms');
  assert.throws(() => restoreAndAdvance(saved, time, time - 1), /clock/);
});
