'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../engine/core.js');
const Prediction = require('../js/prediction.js');

test('visual prediction applies movement and turn through the collision world', () => {
  const world = Engine.createWorld({
    grid: ['########', '#......#', '#......#', '#......#', '########'],
    x: 1.5, y: 2.5, angle: 0
  });
  const moved = Prediction.advance(world, { forward: 1, strafe: 0, turn: 1 }, 0.05);
  assert.ok(moved.x > 1.5);
  assert.ok(moved.angle > 0);
  assert.ok(moved.x < 1.7, 'prediction is bounded to one render frame');
});

test('visual prediction rejects invalid or oversized steps', () => {
  const world = Engine.createWorld({ grid: ['#####', '#...#', '#...#', '#####'] });
  assert.throws(() => Prediction.advance(world, { forward: 2, strafe: 0, turn: 0 }, 0.01), /normalized/);
  assert.throws(() => Prediction.advance(world, { forward: 1, strafe: 0, turn: 0 }, 0.051), /50 milliseconds/);
});
