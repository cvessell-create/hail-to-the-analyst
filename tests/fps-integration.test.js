// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function game() {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      classList: { add() {}, remove() {} }, style: {},
      innerHTML: '', textContent: '', onclick: null,
      setAttribute() {}, addEventListener() {}, insertAdjacentHTML() {},
      querySelector() { return node('nub'); },
      getContext() { return {}; }
    });
    return nodes.get(id);
  }
  const events = {};
  let approach;
  const context = vm.createContext({
    document: { getElementById: node },
    window: { addEventListener(name, handler) { events[name] = handler; } },
    TacticalUI: { start(card, mission, jack, callback) { approach = { mission, jack, callback }; } },
    performance: { now() { return 1000; } },
    requestAnimationFrame() {},
    console
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hooks = `
    globalThis.fps = {
      briefing, startTactics, loadLevel, finishLevel,
      state: () => state, player: () => player,
      enemies: () => enemies, keys: () => keys
    };
  `;
  vm.runInContext(source.replace('title();', hooks + '\ntitle();'), context);
  return { fps: context.fps, nodes, events, approach: () => approach };
}

test('each mission requires tactics and applies its breach result without stacking on retry', () => {
  const g = game();
  const clean = game();
  clean.fps.loadLevel(0);
  const originalEnemies = clean.fps.enemies().length;
  g.fps.briefing(0);
  g.nodes.get('primary').onclick();
  assert.equal(g.fps.state(), 'tactical');
  assert.equal(g.approach().mission, 0);
  assert.equal(g.approach().jack, null);
  const jack = { level: 3, xp: 900 };
  g.approach().callback({ armor: 20, bullets: 12, shells: 2, extraEnemies: 1 }, jack);
  assert.equal(g.fps.state(), 'play');
  assert.equal(g.fps.player().armor, 20);
  assert.equal(g.fps.player().bullets, 57);
  assert.equal(g.fps.enemies().length, originalEnemies + 1);
  const locations = g.fps.enemies().map(e => `${e.x},${e.y}`);
  assert.equal(new Set(locations).size, locations.length);
  g.fps.player().armor = 1;
  g.fps.player().bullets = 0;
  g.fps.loadLevel(0);
  assert.equal(g.fps.player().armor, 20);
  assert.equal(g.fps.player().bullets, 57);
  assert.equal(g.fps.enemies().length, originalEnemies + 1);

  // Exercise the existing mission-completion screen, not a direct second-map load.
  g.nodes.get('muteBtn').onclick();
  g.fps.finishLevel();
  g.nodes.get('primary').onclick();
  assert.equal(g.fps.state(), 'brief');
  g.nodes.get('primary').onclick();
  assert.equal(g.approach().mission, 1);
  assert.equal(g.approach().jack, jack);
  g.approach().callback({ armor: 30, bullets: 18, shells: 3, extraEnemies: 0 }, jack);
  assert.equal(g.fps.player().armor, 50);
  assert.equal(g.fps.player().bullets, 75);
  assert.equal(g.fps.player().shells, 13);
  assert.ok(g.fps.enemies().some(e => e.type === 'FABRICATOR'));
  g.fps.loadLevel(1);
  assert.equal(g.fps.player().armor, 50);
  assert.equal(g.fps.player().bullets, 75);
  g.fps.finishLevel();
  assert.equal(g.fps.state(), 'victory');
});

test('tactical keyboard input stays native and cannot fire FPS weapon handlers', () => {
  const g = game();
  assert.doesNotThrow(() => g.events.keydown({ code: 'Digit1', preventDefault() {} }));
  g.fps.startTactics(0);
  let prevented = false;
  g.events.keydown({ code: 'Space', preventDefault() { prevented = true; } });
  g.events.keydown({ code: 'Digit3', preventDefault() {} });
  assert.equal(prevented, false);
  assert.equal(Object.keys(g.fps.keys()).length, 0);
});

test('entry point uses local classic scripts and styles that work without a build or fetch', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('data:')) continue;
    assert.ok(!/^(https?:)?\/\//.test(target), target);
    assert.ok(fs.existsSync(path.join(root, target)), target);
  }
  assert.ok(!html.includes('type="module"'));
});
