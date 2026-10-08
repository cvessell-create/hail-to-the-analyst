// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engine/core.js'), S = require('../engine/systems.js'), C = require('../engine/controls.js');
test('scene validation rejects malformed records, blocked spawns, unknown and duplicate assets', () => {
  const scene = S.defaultScene();
  assert.deepEqual(S.validateScene(scene), scene);
  for (const mutate of [
    s => { s.grid[0] = '..'; }, s => { s.grid[0] = '..........'; },
    s => { s.objects[0].x = 0.1; }, s => { s.objects.push(s.objects[0]); },
    s => { s.objects[1].asset = 'missing'; }, s => { s.assets[0].pixels[0] = -1; },
    s => { s.assets.push(s.assets[0]); }, s => { s.extra = 1; }, s => { delete s.assets; }
  ]) { const bad = S.defaultScene(); mutate(bad); assert.throws(() => S.validateScene(bad)); }
});
test('scene editing is atomic and registry reads do not expose mutable state', () => {
  const registry = new S.SceneRegistry(S.defaultScene()), before = registry.export();
  assert.throws(() => registry.paint(1, 1, '#'));
  assert.deepEqual(registry.export(), before);
  assert.throws(() => registry.remove('spawn'));
  registry.paint(2, 1, '#'); assert.equal(registry.export().grid[1][2], '#');
  const copy = registry.get('spawn'); copy.x = 100;
  assert.equal(registry.get('spawn').x, 1.5);
  registry.upsert({ id: 'marker', type: 'marker', x: 2.5, y: 3.5, label: 'Marker' });
  registry.remove('marker'); assert.throws(() => registry.get('marker'));
});
test('save round trip and version one migration preserve player state without accepting future versions', () => {
  const scene = S.defaultScene(), player = { x: 2.5, y: 1.5, angle: 0.2 };
  assert.deepEqual(S.decodeSave(S.encodeSave(scene, player)).player, player);
  const legacy = { schema: 'vessell-save', version: 1,
    scene: { schema: 'vessell-scene', version: 1, name: 'Old', grid: scene.grid, spawn: player }, player };
  const updated = S.decodeSave(JSON.stringify(legacy)); assert.equal(updated.version, 2);
  assert.equal(updated.scene.objects[0].type, 'spawn');
  assert.throws(() => S.decodeSave(JSON.stringify({ ...legacy, version: 3 })));
  assert.throws(() => S.encodeSave(scene, { ...player, x: -1 }));
  assert.throws(() => S.parseJSON('x'.repeat(2 * 1024 * 1024 + 1)));
});
test('DDA distinguishes misses from walls beyond range and blocks corner leaks', () => {
  const grid = ['#####', '#...#', '#.#.#', '#...#', '#####'];
  assert.equal(E.castRay(grid, 1.5, 1.5, 0, 0.2).tile, null);
  assert.equal(E.castRay(grid, 1.5, 1.5, 0, 2.5).tile, '#');
  assert.equal(E.lineOfSight(grid, { x: 1.5, y: 1.5 }, { x: 3.5, y: 3.5 }), false);
  assert.equal(E.lineOfSight(grid, { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }), true);
  assert.equal(E.lineOfSight(['####', '#.##', '##.#', '####'],
    { x: 1.5, y: 1.5 }, { x: 2.5, y: 2.5 }), false);
  assert.throws(() => E.createWorld({ grid, x: 1.01, y: 1.5 }), /Spawn/);
});
test('clock accounts for all dropped time and normalizes diagonal movement', () => {
  let ticks = 0; const c = E.clock(() => ticks++);
  const result = c.advance(2); assert.equal(result.steps, 8); assert.equal(result.droppedTicks, 112);
  assert.equal(c.advance(1 / 120).steps, 0); assert.equal(c.advance(1 / 120).steps, 1);
  const world = E.createWorld({ grid: ['#######', '#.....#', '#.....#', '#.....#', '#######'], x: 2.5, y: 2.5 });
  world.move(1, 1, 0.1);
  assert.ok(Math.abs(Math.hypot(world.position().x - 2.5, world.position().y - 2.5) - 0.1) < 1e-10);
});
test('sprite strips respect the wall depth buffer and profiler retains bounded samples', () => {
  const scene = S.defaultScene(), calls = [], ctx = { fillRect(...args) { calls.push(args); } };
  const player = { x: 4.5, y: 3.5, angle: 0 };
  S.renderSprites(ctx, scene, player, 320, 180, new Float64Array(80).fill(0.1));
  assert.equal(calls.length, 0);
  S.renderSprites(ctx, scene, player, 320, 180, new Float64Array(80).fill(20));
  assert.ok(calls.length > 0);
  let time = 0; const p = S.profiler(() => ++time);
  for (let i = 0; i < 300; i++) p.measure('render', () => {});
  p.count('tone'); assert.equal(p.snapshot().timings.render.samples, 240);
  assert.equal(p.snapshot().counters.tone, 1);
});
test('touch/keyboard input handles cancel, native editing and disposal', () => {
  class Target {
    constructor() { this.handlers = new Map(); this.dataset = { action: 'forward' }; }
    addEventListener(name, fn) { this.handlers.set(name, fn); }
    removeEventListener(name) { this.handlers.delete(name); }
    setPointerCapture() {}
    fire(name, event = {}) { this.handlers.get(name)?.({ preventDefault() {}, ...event }); }
  }
  const target = new Target(), button = new Target(), controls = C.bind(target, [button]);
  target.fire('keydown', { code: 'KeyW', target: { tagName: 'TEXTAREA' } }); assert.equal(controls.sample().forward, 0);
  button.fire('pointerdown', { pointerId: 1 }); assert.equal(controls.sample().forward, 1);
  button.fire('pointercancel', { pointerId: 1 }); assert.equal(controls.sample().forward, 0);
  target.fire('keydown', { code: 'Space' }); assert.equal(controls.sample().fire, true);
  target.fire('blur'); assert.equal(controls.sample().fire, false);
  target.fire('keydown', { code: 'Space' }); target.fire('keyup', { code: 'Space' });
  assert.equal(controls.sample().fire, true); assert.equal(controls.sample().fire, false);
  controls.dispose(); assert.equal(target.handlers.size, 0); assert.equal(button.handlers.size, 0);
});
test('audio helper disposes nodes and rejects invalid durations', () => {
  let disconnected = 0, oscillator;
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const audio = { currentTime: 0, destination: {}, createOscillator() {
    oscillator = { frequency: param, connect() {}, disconnect() { disconnected++; }, start() {}, stop() {} }; return oscillator;
  }, createGain() { return { gain: param, connect() {}, disconnect() { disconnected++; } }; } };
  E.tone(audio, 440, 0.1); oscillator.onended(); assert.equal(disconnected, 2);
  assert.throws(() => E.tone(audio, 440, 20));
});
