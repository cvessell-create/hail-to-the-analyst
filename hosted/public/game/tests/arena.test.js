// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createArena } = require('../server/arena.js'), { createServer } = require('../server/index.js');
const S = require('../engine/systems.js'), F = require('../engine/fair-division.js');
function fixture() {
  let time = 1000;
  const arena = createArena(() => time, { scene: S.defaultScene(),
    enemySpawns: [{ x: 6.5, y: 1.5 }, { x: 7.5, y: 1.5 }, { x: 8.5, y: 1.5 }] });
  const a = arena.join('A'), b = arena.join('B');
  return { arena, a, b, advance() { time += 100; arena.step(0.1); }, expire() { time += 120001; arena.step(0.1); } };
}
function win(f) {
  let sequence = 0;
  for (let i = 0; i < 100 && f.arena.snapshot(f.a.token).combat.phase === 'playing'; i++) {
    f.arena.input(f.a.token, { sequence: ++sequence, forward: 0, strafe: 0, turn: 0, fire: true });
    f.advance();
  }
  assert.equal(f.arena.snapshot(f.a.token).combat.phase, 'won');
}
test('authoritative inputs cannot set position/damage, replay or exceed speed; stale input stops', () => {
  const f = fixture(), before = f.arena.snapshot(f.a.token).players[0];
  assert.throws(() => f.arena.input(f.a.token, { sequence: 1, forward: 9, strafe: 0, turn: 0, fire: false }));
  assert.throws(() => f.arena.input(f.a.token, { sequence: 1, forward: 0, strafe: 0, turn: 0, fire: false, x: 90 }));
  f.arena.input(f.a.token, { sequence: 1, forward: 1, strafe: 0, turn: 0, fire: false });
  assert.throws(() => f.arena.input(f.a.token, { sequence: 1, forward: 1, strafe: 0, turn: 0, fire: false }));
  f.advance(); const after = f.arena.snapshot(f.a.token).players[0]; assert.ok(after.x - before.x <= 0.225001);
  f.advance(); f.advance(); const stopped = f.arena.snapshot(f.a.token).players[0].x;
  f.advance(); assert.equal(f.arena.snapshot(f.a.token).players[0].x, stopped);
  assert.throws(() => f.arena.snapshot('fake'), /session/);
});
test('NPC co-op victory locks roster, awards once and conserves shared fictional loot credits', () => {
  const f = fixture(); assert.throws(() => f.arena.startRound(f.a.token, 'knaster'), /victory/);
  win(f); const snapshot = f.arena.snapshot(f.a.token), xp = snapshot.players[0].xp;
  assert.ok(xp > 0); f.advance(); assert.equal(f.arena.snapshot(f.a.token).players[0].xp, xp);
  assert.throws(() => f.arena.join('Late'), /locked/);
  assert.equal(snapshot.combat.payoff.team + snapshot.combat.payoff.npc, 0);
  const round = f.arena.startRound(f.a.token, 'knaster');
  f.arena.bid(f.a.token, { roundId: round.id, values: [100, 80, 60] });
  const hidden = f.arena.snapshot(f.b.token).round;
  assert.equal(hidden.result, null); assert.ok(!JSON.stringify(hidden).includes('"values"'));
  assert.throws(() => f.arena.bid(f.a.token, { roundId: round.id, values: [1, 1, 1] }));
  f.arena.bid(f.b.token, { roundId: round.id, values: [70, 90, 40] });
  const settled = f.arena.snapshot(f.a.token);
  assert.equal(settled.round.state, 'settled');
  assert.equal(settled.players.reduce((sum, p) => F.add(sum, p.credits), F.fraction(0)).value, 2000);
  assert.equal(settled.players.reduce((sum, p) => sum + p.inventory.length, 0), 3);
  assert.throws(() => f.arena.startRound(f.a.token, 'knaster'), /one-use/);
});
test('AW cache settles fractional goods once and auction treasury conserves currency', () => {
  const f = fixture(), auction = f.arena.startRound(f.a.token, 'vickrey');
  f.arena.bid(f.a.token, { roundId: auction.id, values: [100] });
  assert.equal(f.arena.snapshot(f.b.token).round.result, null);
  f.arena.bid(f.b.token, { roundId: auction.id, values: [60] });
  let state = f.arena.snapshot(f.a.token);
  assert.equal(state.players[0].power, 1); assert.equal(state.economy.treasury.value, 60);
  assert.equal(state.players.reduce((sum, p) => F.add(sum, p.credits), state.economy.treasury).value, 2000);
  assert.throws(() => f.arena.startRound(f.a.token, 'vickrey'));
  win(f);
  const round = f.arena.startRound(f.a.token, 'adjusted-winner');
  assert.throws(() => f.arena.bid(f.a.token, { roundId: round.id, values: [10, 10, 10] }), /100/);
  f.arena.bid(f.a.token, { roundId: round.id, values: [40, 35, 25] });
  f.arena.bid(f.b.token, { roundId: round.id, values: [30, 20, 50] });
  state = f.arena.snapshot(f.a.token);
  assert.equal(state.round.state, 'settled');
  assert.equal(F.compare(state.round.result.utilities[0], state.round.result.utilities[1]), 0);
});
test('sealed round deadline and combat cancellation perform no transfers', () => {
  const f = fixture(), round = f.arena.startRound(f.a.token, 'vickrey');
  f.arena.bid(f.a.token, { roundId: round.id, values: [100] });
  f.arena.input(f.a.token, { sequence: 1, forward: 0, strafe: 0, turn: 0, fire: true }); f.advance();
  assert.equal(f.arena.snapshot(f.a.token).round.state, 'cancelled');
  assert.equal(f.arena.snapshot(f.a.token).players[0].credits.value, 1000);
  const expired = fixture(); expired.arena.startRound(expired.a.token, 'vickrey'); expired.expire();
  assert.throws(() => expired.arena.bid(expired.a.token, { roundId: 1, values: [100] }));
});
test('HTTP service serves only local assets and rejects unauthenticated, cross-origin, malformed and oversized input', async t => {
  const { server } = createServer({ manual: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/api/state')).status, 401);
  assert.equal((await fetch(base + '/package.json')).status, 404);
  const post = (url, data, headers = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: data });
  assert.equal((await post('/api/join', '{}', { Origin: 'https://invalid.example' })).status, 403);
  assert.equal((await post('/api/join', '{')).status, 400);
  assert.equal((await post('/api/join', JSON.stringify({ name: 'x'.repeat(5000) }))).status, 413);
  const response = await post('/api/join', '{"name":"HTTP analyst"}'); assert.equal(response.status, 201);
  const player = await response.json();
  const state = await fetch(base + '/api/state', { headers: { Authorization: 'Bearer ' + player.token } });
  assert.equal(state.status, 200);
  assert.equal(JSON.stringify(await state.json()).includes(player.token), false);
});
test('public tunnel mode admits trycloudflare hosts, closes Hugging Face routes and proxies SI with a budget', async t => {
  const http = require('node:http'), sent = [];
  const fetchImpl = async (url, init = {}) => { sent.push([url, init.body]); return { status: 200, json: async () => ({ text: 'ok', url }) }; };
  const { server } = createServer({ manual: true, publicMode: true, siUrl: 'http://si.test', fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = (path, { method = 'GET', host = 'beta-run.trycloudflare.com', body, origin, ip = '1.2.3.4' } = {}) => new Promise((resolve, reject) => {
    const headers = { Host: host, 'cf-connecting-ip': ip };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (origin) headers.Origin = origin;
    const req = http.request({ port: server.address().port, path, method, headers }, res => {
      let data = ''; res.on('data', c => { data += c; }); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); if (body !== undefined) req.write(body); req.end();
  });
  assert.equal((await call('/index.html')).status, 200);
  const home = await call('/');
  assert.equal(home.status, 200); assert.match(home.data, /<title>Hail to the Analyst<\/title>/);
  assert.equal((await call('/index.html', { host: 'evil.example.com' })).status, 403);
  assert.equal((await call('/api/hf/status')).status, 403);
  assert.equal((await call('/api/join', { method: 'POST', body: '{"name":"x"}', origin: 'https://evil.example.com' })).status, 403);
  assert.equal((await call('/api/join', { method: 'POST', body: '{"name":"Remote analyst"}', origin: 'https://beta-run.trycloudflare.com' })).status, 201);
  const status = await call('/si/status'); assert.equal(status.status, 200); assert.equal(JSON.parse(status.data).url, 'http://si.test/status');
  for (let i = 0; i < 20; i++) assert.equal((await call('/si/chat', { method: 'POST', body: '{"message":"hi"}' })).status, 200);
  assert.equal((await call('/si/chat', { method: 'POST', body: '{"message":"hi"}' })).status, 429);
  assert.equal((await call('/si/chat', { method: 'POST', body: '{"message":"hi"}', ip: '5.6.7.8' })).status, 200);
  assert.equal(sent.filter(([url]) => url === 'http://si.test/chat').length, 21);
  assert.equal((await call('/si/chat', { method: 'POST', body: '{"event":{"kills":1}}', ip: '9.9.9.9' })).status, 422);
  assert.equal((await call('/si/chat', { method: 'POST', body: '{"message":"yo","event":{"kills":1},"game":{"hp":1}}', ip: '9.9.9.9' })).status, 200);
  assert.deepEqual(JSON.parse(sent.at(-1)[1]), { message: 'yo', view: 'game' });
  const { server: local } = createServer({ manual: true });
  await new Promise(resolve => local.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => local.close(resolve)));
  const blocked = await new Promise(resolve => http.get({ port: local.address().port, path: '/', headers: { Host: 'beta-run.trycloudflare.com' } }, res => { res.resume(); resolve(res.statusCode); }));
  assert.equal(blocked, 403);
});
