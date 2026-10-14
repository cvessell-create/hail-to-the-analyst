'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Stalker = require('../engine/stalker.js');

test('Stalker has a distinct, telegraphed volley with a dodgeable fan', () => {
  const shots = Stalker.volley({ x: 1, y: 2 }, { x: 5, y: 2, height: 0.4 });
  assert.equal(Stalker.TYPE, 'STALKER');
  assert.equal(Stalker.HEALTH, 640);
  assert.equal(Stalker.AIM_TELL, 0.5);
  assert.equal(Stalker.VOLLEY_COOLDOWN, 1.05);
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map(s => s.src), ['STALKER', 'STALKER', 'STALKER']);
  assert.deepEqual(shots.map(s => s.damage), [13, 13, 13]);
  assert.ok(shots[0].vy < 0 && Math.abs(shots[1].vy) < 1e-9 && shots[2].vy > 0);
  assert.ok(shots.every(s => s.height === 0.4));
});

test('Stalker has original mechanical artwork', () => {
  const fills = [];
  const ctx = { fillStyle: '', fillRect(...rect) { fills.push([this.fillStyle, ...rect]); } };
  Stalker.draw(ctx, 100);
  assert.ok(fills.some(([color]) => color === '#d1d8d2'));
  assert.ok(fills.some(([color]) => color === '#ff342d'));
  assert.ok(fills.some(([color]) => color === '#e5a34b'));
});
