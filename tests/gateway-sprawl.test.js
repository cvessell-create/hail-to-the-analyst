'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../engine/gateway-sprawl.js');
const C = require('../engine/city.js');

const VALID = new Set('#.KGWMNTHLCDJEUYQPmdphbaivjS'.split(''));
const PASS = c => c === '.' || c === 'D' || c === 'U' || c === 'P' || /[a-z]/.test(c);
const find = (m, c) => { const out = []; m.forEach((r, y) => [...r].forEach((t, x) => { if (t === c) out.push([x, y]); })); return out; };
function reach(m) {
  const [s] = find(m, 'P'), seen = new Set([s.join()]), q = [s];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (!seen.has(k) && m[ny] && PASS(m[ny][nx])) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return seen;
}
const nextTo = (seen, [x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));

test('Gateway Sprawl map is 44x32, enclosed and uses only known tiles', () => {
  const L = G.level(), m = L.map;
  assert.equal(m.length, G.H); assert.ok(m.every(r => r.length === G.W));
  assert.ok(/^#+$/.test(m[0]) && /^#+$/.test(m[m.length - 1]));
  m.forEach((r, y) => { assert.equal(r[0], '#', 'west wall row ' + y); assert.ok(r[G.W - 1] === '#' || r[G.W - 1] === 'Q', 'east wall row ' + y); });
  for (const c of m.join('')) assert.ok(VALID.has(c), 'unknown tile ' + c);
  assert.equal(find(m, 'P').length, 1); assert.equal(find(m, 'Q').length, 1); assert.equal(find(m, 'Y').length, 1);
  assert.ok(!m.join('').includes('X'), 'a sandbox has no extraction exit');
  assert.equal(find(m, 'U').length, L.stops.length, 'one light-rail stop per name');
  assert.equal(L.city, true); assert.equal(L.sandbox, true); assert.equal(L.theme, 'gateway');
});

test('every stop, gate, safehouse and pickup is reachable on foot from the spawn', () => {
  const m = G.level().map, seen = reach(m);
  for (const u of find(m, 'U')) assert.ok(seen.has(u.join()), 'stop ' + u);
  for (const c of 'QY') assert.ok(nextTo(seen, find(m, c)[0]), c + ' can be faced');
  assert.ok(nextTo(seen, find(m, 'S')[0]), 'optional footprint side quest can be faced');
  for (const c of 'hbaivj') for (const p of find(m, c)) assert.ok(seen.has(p.join()), c + ' at ' + p);
  for (const c of 'mdp') for (const p of find(m, c)) assert.ok(seen.has(p.join()), 'enemy ' + c + ' at ' + p);
});

test('St. Louis landmarks appear in stylised form', () => {
  const m = G.level().map;
  assert.equal(find(m, 'J').length, 2, 'two arch legs on the riverfront');
  assert.ok(find(m, 'J').every(([x]) => x > 33), 'arch stands east of the flood wall');
  assert.ok(m.slice(1, -1).every(r => r[33] === 'C' || r[33] === 'D' || r[33] === '.'), 'continuous flood wall with gates');
  assert.ok(find(m, 'E').length > 100, 'the river runs the length of the east edge');
  assert.ok(/M{6}/.test(m[3]) && /M{6}/.test(m[5]) && !/E/.test(m[4]), 'bridge deck crosses the river');
  for (const n of ['FOREST PARK', 'SOULARD', 'EADS BRIDGE', 'UNION STATION', 'DELMAR LOOP']) assert.ok(G.ZONES.some(z => z.name === n), n);
});

test('zones give flavour text and the memorial field has no patrols', () => {
  const L = G.level(), m = L.map;
  assert.equal(G.zoneAt(L, 40.5, 4.5).name, 'EADS BRIDGE');
  assert.equal(G.zoneAt(L, 25.5, 27.5).name, 'SOULARD');
  assert.equal(G.zoneAt(L, 0, 0), null);
  assert.ok(G.ZONES.every(z => z.text && z.text.length < 160));
  const mem = G.ZONES.find(z => z.quiet);
  for (let y = mem.y0; y <= mem.y1; y++) for (let x = mem.x0; x <= mem.x1; x++) assert.ok(!/[mdtFp]/.test(m[y][x]), 'no enemy at ' + x + ',' + y);
});

test('city gates link Vessell City and Gateway Sprawl both ways', () => {
  assert.equal(C.access('O', []).entrance.target, G.NAME);
  assert.equal(C.access('Q', []).entrance.target, C.NAME);
  const city = C.level().map;
  assert.equal(city[11][0], 'O'); assert.equal(city[11][1], '.');
  assert.equal(C.signs(G.level().map, []).filter(s => s.tile === 'Q').length, 1);
});
