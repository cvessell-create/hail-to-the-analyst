'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../engine/deception-ops.js');

test('every doctrine card is a valid constant-sum game', () => {
  assert.equal(D.CARDS.length, 5);
  for (const card of D.CARDS) {
    const s = D.solve(card);
    assert.ok(Number.isFinite(s.value), card.id);
    assert.ok(s.pure || s.mix, card.id);
    assert.match(s.evidence, /not historical calibration/);
  }
});

test('Fortitude South needs a mixed strategy, Norway feint has a saddle point', () => {
  const fort = D.solve(D.CARDS[0]);
  assert.equal(fort.pure, null);
  assert.ok(Math.abs(fort.value - 46 / 11) < 1e-9);
  assert.ok(Math.abs(fort.mix[0].p - 5 / 11) < 1e-9);
  const norway = D.solve(D.CARDS[1]);
  assert.deepEqual(norway.pure, { row: 'commit the main front', col: 'release reserves' });
  assert.deepEqual(norway.dominant, ['commit the main front']);
});

test('briefing cycles cards by mission and clamps bad input', () => {
  assert.match(D.briefing(0), /Fortitude South/);
  assert.match(D.briefing(2), /Maskirovka/);
  assert.match(D.briefing(-3), /Fortitude South/);
  assert.match(D.briefing(1), /Best play: commit the main front/);
});
