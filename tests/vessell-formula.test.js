'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const formula = require('../engine/vessell-formula.js');
const { createServer } = require('../server/index.js');
const http = require('node:http');

test('case-policy checks required lowercase as PASS and corrects at most once', () => {
  assert.deepEqual([...'Az0$'].map(formula.caseState), [1, 0, null, null]);
  const mask = new Map([[1, 0]]);
  assert.equal(formula.caseGate('Review', mask), 0);
  assert.deepEqual(formula.correctCase('Review', mask), {
    text: 'review', initial_product: 0, product: 1, state: 'PASS',
    mismatches_before: 1, correction_passes: 1
  });
  assert.equal(formula.correctCase('review', mask).correction_passes, 0);
  assert.equal(formula.caseGate('review', mask), 1);
  assert.equal(formula.transformCase('A0$b!Z', new Map([[1, 0], [4, 1]])), 'a0$B!Z');
});
test('empty case masks pass while empty runtime evidence still fails', () => {
  for (const text of ['', 'Ab0!']) {
    assert.equal(formula.caseGate(text, new Map()), 1);
    assert.equal(formula.transformCase(text, new Map()), text);
    assert.equal(formula.correctCase(text, new Map()).correction_passes, 0);
  }
  assert.equal(formula.evaluate([], [], 'r').state, 'DOWN');
});
test('invalid masks, neutral targets and non-ASCII input raise explicit errors', () => {
  for (const [text, pairs] of [
    ['Ab', [[0, 1]]], ['Ab', [[3, 1]]], ['Ab', [[true, 1]]], ['Ab', [[1.5, 1]]],
    ['Ab', [[1, true]]], ['Ab', [[1, 2]]], ['Ab', [[1, '0']]], ['Ab', [['1', 0]]],
    ['A0', [[2, 0]]], ['A!', [[2, 1]]], ['é', []], ['ß', [[1, 1]]],
    ['', [[1, 1]]], ['İ', []], ['😀', []], [null, []]
  ]) {
    for (const operation of [formula.caseGate, formula.transformCase, formula.correctCase]) {
      assert.throws(() => operation(text, new Map(pairs)));
    }
  }
  for (const operation of [formula.caseGate, formula.transformCase, formula.correctCase]) {
    assert.throws(() => operation('Ab', null));
    assert.throws(() => operation('Ab', { 1: 0 }));
  }
  for (const character of ['', 'AB', 'é', 'ß', 'İ', '😀', null]) {
    assert.throws(() => formula.caseState(character));
  }
});
test('all 9330 case policies satisfy compliance, fixed points and minimum changes', () => {
  let count = 0;
  for (let n = 1; n <= 5; n++) {
    for (let bits = 0; bits < 2 ** n; bits++) {
      const text = Array.from({ length: n }, (_, i) => bits & (1 << i) ? 'A' : 'a').join('');
      for (let policy = 0; policy < 3 ** n; policy++) {
        const mask = new Map();
        let digits = policy;
        for (let i = 1; i <= n; i++, digits = Math.floor(digits / 3)) {
          const choice = digits % 3;
          if (choice) mask.set(i, choice - 1);
        }
        const original = [...mask], output = formula.transformCase(text, mask);
        const mismatches = [...mask].filter(([i, required]) => formula.caseState(text[i - 1]) !== required).length;
        const result = formula.correctCase(text, mask);
        assert.equal(formula.caseGate(output, mask), 1);
        assert.equal(formula.transformCase(output, mask), output);
        assert.equal(formula.caseGate(text, mask) === 1, output === text);
        assert.equal(result.mismatches_before, mismatches);
        assert.equal(result.correction_passes, Number(mismatches > 0));
        assert.equal(result.text, output);
        assert.equal([...text].filter((c, i) => c !== output[i]).length, mismatches);
        for (let i = 1; i <= n; i++) if (!mask.has(i)) assert.equal(output[i - 1], text[i - 1]);
        assert.deepEqual([...mask], original);
        count++;
      }
    }
  }
  assert.equal(count, 9330);
});
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
