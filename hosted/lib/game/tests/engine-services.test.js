// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const http = require('node:http');
const { artifactPreview, createEngineServices } = require('../server/engine-services.js');
const { createServer } = require('../server/index.js');
const run = { title: 'Archive run', run_id: 'run-1', build_sha256: 'a'.repeat(64),
  mission: 'THE ARCHIVE', seed: 42, outcome: 'complete', ticks: 3600 };
test('run collectible preview binds exact metadata bytes, without mint or publication', () => {
  const result = artifactPreview(run);
  assert.deepEqual(result, artifactPreview({ ...run }));
  assert.equal(result.sha256, createHash('sha256').update(result.metadata_json).digest('hex'));
  assert.deepEqual(JSON.parse(result.metadata_json), result.metadata);
  assert.equal(result.minted, false);
  assert.equal(result.published, false);
  assert.equal(result.metadata.properties.tick_hz, 60);
  assert.notEqual(artifactPreview({ ...run, seed: 43 }).sha256, result.sha256);
});
test('artifact inputs reject private extra fields, bad hashes, outcomes and noninteger counters', () => {
  for (const bad of [null, [], { ...run, chat: 'private' }, { ...run, wallet_key: 'private' },
    { ...run, seed: -1 }, { ...run, seed: 2 ** 32 }, { ...run, ticks: 0.5 },
    { ...run, ticks: Infinity }, { ...run, outcome: 'won' }, { ...run, build_sha256: 'x' },
    { ...run, title: '' }, { ...run, mission: 'line\nbreak' }]) {
    assert.throws(() => artifactPreview(bad), error => error.status === 422);
  }
});
test('AI service preserves reply identity and does not promote levels from readiness', async () => {
  const calls = [];
  const services = createEngineServices({ siUrl: 'http://127.0.0.1:8790',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { status: 200, json: async () => url.endsWith('/status')
        ? { schema: 'vessell-si-chat/v1', model_ready: true, backend: 'fixture' }
        : { schema: 'vessell-si-chat/v1', kind: 'owner', route: 'owner', text: 'Owner text.',
          sources: [{ id: 'source-1' }], error: null } };
    } });
  const status = await services.status();
  assert.equal(status.chat.state, 'MODEL_READY');
  assert.equal(status.levels.length, 5);
  assert.ok(status.levels.every(level => level.state === 'NOT_EVALUATED_BY_SERVICE_STATUS'));
  assert.equal(status.blockchain.spending_enabled, false);
  const reply = await services.chat({ message: 'Explain the gate.' });
  assert.equal(reply.kind, 'owner');
  assert.equal(reply.sources[0].id, 'source-1');
  assert.deepEqual(JSON.parse(calls[1].init.body), { message: 'Explain the gate.', view: 'game' });
  assert.equal(calls[1].init.redirect, 'error');
  await assert.rejects(services.chat({ message: 'test', execute: true }), error => error.status === 422);
});
test('offline, malformed and non-200 AI replies surface failure rather than fake completion', async () => {
  for (const fetchImpl of [
    async () => { throw Error('offline'); },
    async () => ({ status: 500 }),
    async () => ({ status: 200, json: async () => ({ text: 'not a contract' }) })
  ]) {
    const services = createEngineServices({ siUrl: 'http://localhost:8790', fetchImpl });
    await assert.rejects(services.chat({ message: 'hello' }), error => error.status === 502);
    await assert.rejects(services.status(), error => error.status === 502);
  }
  for (const siUrl of ['https://example.com', 'http://localhost:8790/path', 'http://user@localhost:8790']) {
    assert.throws(() => createEngineServices({ siUrl }), /loopback/);
  }
});
test('formula bridge retains DOWN and local receipt scope without interpreting it as a mint', async () => {
  const services = createEngineServices({ siUrl: 'http://127.0.0.1:8790',
    fetchImpl: async () => ({ status: 200, json: async () => ({
      schema: 'vessell-formula/v1', state: 'DOWN', phase1: 'LOCAL_RECEIPT_VERIFIED',
      anchored: false, receipt_id: 'local-id', problems: ['one check failed'], private_path: '/not/exported'
    }) }) });
  const result = await services.formula();
  assert.equal(result.state, 'DOWN');
  assert.equal(result.anchored, false);
  assert.equal(result.receipt_id, 'local-id');
  assert.equal(Object.hasOwn(result, 'private_path'), false);
});
test('concurrent chat is bounded, failures release the slot and wrong-origin calls are blocked', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const { server } = createServer({ manual: true, fetchImpl: async () => {
    calls++;
    await pending;
    throw Error('offline fixture');
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/engine/chat`;
  const post = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"message":"hello"}' };
  try {
    const first = fetch(base, post);
    while (!calls) await new Promise(resolve => setImmediate(resolve));
    assert.equal((await fetch(base, post)).status, 429);
    release();
    assert.equal((await first).status, 502);
    assert.equal((await fetch(base, post)).status, 502);
    assert.equal((await fetch(base, { ...post, headers: { ...post.headers, Origin: 'https://example.com' } })).status, 403);
    assert.equal(calls, 2);
  } finally { release(); await new Promise(resolve => server.close(resolve)); }
});
test('engine API serves console, validates methods and blocks tunnel access before upstream calls', async () => {
  let calls = 0;
  const { server } = createServer({ manual: true, publicMode: true, fetchImpl: async () => {
    calls++;
    return { status: 200, json: async () => ({ schema: 'vessell-si-chat/v1', model_ready: false, backend: 'fixture' }) };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, base = `http://127.0.0.1:${port}`;
  const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/engine/development.html')).status, 200);
    assert.equal((await fetch(base + '/api/engine/status')).status, 200);
    assert.equal((await fetch(base + '/api/engine/artifact', post(run))).status, 200);
    assert.equal((await fetch(base + '/api/engine/artifact', post({ ...run, chat: 'private' }))).status, 422);
    assert.equal((await fetch(base + '/api/engine/artifact')).status, 405);
    assert.equal((await fetch(base + '/api/engine/mint', post(run))).status, 404);
    assert.equal((await fetch(base + '/api/engine/artifact', post({ title: 'x'.repeat(4096) }))).status, 413);
    assert.equal((await fetch(base + '/api/engine/chat', { ...post({}), body: '{' })).status, 400);
    const remote = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/api/engine/status',
        headers: { Host: 'fixture.trycloudflare.com' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    assert.equal(remote, 403);
    assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
