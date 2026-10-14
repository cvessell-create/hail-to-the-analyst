'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const formula = require('../engine/vessell-formula.js');
const { createServer } = require('../server/index.js');
const http = require('node:http');

test('all 510 binary vectors implement strict conjunction', () => {
  for (let n = 1; n <= 8; n++) {
    const ids = Array.from({ length: n }, (_, i) => String(i));
    for (let bits = 0; bits < 2 ** n; bits++) {
      const checks = ids.map((id, i) => ({ id, run_id: 'r', passed: Boolean(bits & (1 << i)) }));
      assert.equal(formula.evaluate(ids, checks, 'r').state, checks.every(c => c.passed) ? 'UP' : 'DOWN');
    }
  }
});
test('empty, missing, duplicate, unknown and mixed-run checks fail closed', () => {
  const good = { id: 'a', run_id: 'r', passed: true };
  for (const [ids, rows, run] of [
    [[], [], 'r'], [['a'], [], 'r'], [['a'], [good, good], 'r'],
    [['a'], [good], 'other'], [['a'], [{ ...good, passed: null }], 'r'],
    [['a'], [{ ...good, passed: 1 }], 'r'], [['a'], [good], '']
  ]) assert.equal(formula.evaluate(ids, rows, run).state, 'DOWN');
});
test('unavailable status never displays UP', () => {
  assert.match(formula.describe(null), /DOWN/);
  assert.match(formula.describe({ schema: formula.SCHEMA, state: 'UP', phase1: 'LOCAL_RECEIPT_VERIFIED' }), /UP.*LOCAL_RECEIPT_VERIFIED/);
});
test('local game proxy forwards formula status but never exposes it to tunnel players', async () => {
  let calls = 0;
  const { server } = createServer({ manual: true, publicMode: true, fetchImpl: async url => {
    calls++;
    assert.ok(url.endsWith('/formula'));
    return { status: 200, json: async () => ({ schema: formula.SCHEMA, state: 'UP', phase1: 'NOT_REQUESTED' }) };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/si/formula`;
  try {
    const local = await fetch(url);
    assert.equal(local.status, 200);
    assert.equal((await local.json()).state, 'UP');
    const remoteStatus = await new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: server.address().port,
        path: '/si/formula', headers: { Host: 'test.trycloudflare.com' } },
      res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(remoteStatus, 403);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
