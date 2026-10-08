'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const Visual = require('../engine/nes-visual');
const crypto = require('node:crypto');
test('original NES ROM drives CPU/PPU frames that change with first-person viewpoint', () => {
  const grid = ['########', '#......#', '#..#...#', '#......#', '########'];
  const visual = Visual.create();
  const a = visual.update(grid, { x: 1.5, y: 1.5, angle: 0 });
  const b = visual.update(grid, { x: 1.5, y: 1.5, angle: 1.5 });
  assert.equal(a.uploaded, true); assert.equal(b.uploaded, true);
  assert.equal(a.pixels.length, 256 * 240); assert.equal(b.frames, 4);
  assert.ok(new Set(a.pixels).size >= 3);
  const hash = values => crypto.createHash('sha256').update(Buffer.from(values.buffer)).digest('hex');
  assert.notEqual(hash(a.pixels), hash(b.pixels));
  assert.throws(() => visual.update(grid, { x: NaN, y: 1, angle: 0 }), /finite/);
});
