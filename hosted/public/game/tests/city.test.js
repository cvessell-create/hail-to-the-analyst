'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../engine/city.js');

test('city map is rectangular, enclosed and uses original city tiles', () => {
  const L = C.level(), m = L.map;
  assert.ok(m.every(r => r.length === m[0].length));
  assert.ok(/^#+$/.test(m[0]) && /^#+$/.test(m[m.length - 1]));
  assert.equal(m.join('').split('P').length - 1, 1, 'one spawn');
  assert.equal(m.join('').split('U').length - 1, C.STOPS.length, 'one metro stop per name');
  for (const t of Object.keys(C.ENTRANCES).filter(k => !C.ENTRANCES[k].home)) assert.equal(m.join('').split(t).length - 1, 1, t + ' entrance appears once');
  assert.equal(L.city, true); assert.ok(!m.join('').includes('X'), 'the hub has no extraction exit');
});

test('entrances gate in order: Archive, then Plant, then Skyline', () => {
  assert.equal(C.access('A', []).ok, true);
  assert.equal(C.access('Z', []).ok, false);
  assert.equal(C.access('Z', ['THE ARCHIVE']).ok, true);
  assert.equal(C.access('V', ['THE ARCHIVE']).ok, false);
  assert.equal(C.access('V', ['THE ARCHIVE', 'FABRICATION PLANT']).ok, true);
  assert.equal(C.access('Y', []).entrance.kind, 'safehouse');
  assert.equal(C.access('#', []).ok, false);
});

test('cleared list is sanitized and signs report locks', () => {
  assert.deepEqual(C.sanitizeCleared(['THE ARCHIVE', 'THE ARCHIVE', 'X', 3, null]), ['THE ARCHIVE']);
  assert.deepEqual(C.sanitizeCleared('nope'), []);
  assert.deepEqual(C.sanitizeCleared(['GATEWAY SPRAWL', 'VESSELL CITY']), [], 'district gates never count as cleared missions');
  const signs = C.signs(C.level().map, []);
  assert.equal(signs.length, 5);
  assert.equal(signs.find(s => s.tile === 'O').locked, false, 'the Gateway Sprawl gate is always open');
  assert.equal(signs.find(s => s.tile === 'Z').locked, true);
  assert.equal(signs.find(s => s.tile === 'A').locked, false);
  assert.equal(C.stopName(C.level(), 0), 'CENTRAL'); assert.equal(C.stopName({}, 2), 'M3');
});
