// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../js/tactics.js');
const root = path.resolve(__dirname, '..');

function game() {
  const nodes = new Map(), drawing = [], calls = [];
  let battle;
  function events(object) {
    object.listeners = new Map();
    object.addEventListener = (name, fn) => {
      if (!object.listeners.has(name)) object.listeners.set(name, new Set());
      object.listeners.get(name).add(fn);
    };
    object.removeEventListener = (name, fn) => object.listeners.get(name)?.delete(fn);
    object.dispatch = (name, event = {}) => {
      for (const fn of Array.from(object.listeners.get(name) || [])) fn(event);
    };
    return object;
  }
  const document = { activeElement: null };
  const drawingContext = new Proxy({
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: text.length * 7 }; }
  }, { get(object, name) {
    if (name in object) return object[name];
    return (...args) => drawing.push({ name, args });
  } });
  function element(tag) {
    const classes = new Set(), attributes = {};
    return events({
      tagName: tag.toUpperCase(), children: [], style: {}, textContent: '', innerHTML: '',
      classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); } },
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren() { this.children = []; },
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name] || null; },
      insertAdjacentHTML() {}, setPointerCapture() {},
      focus() { document.activeElement = this; },
      getContext() { return drawingContext; },
      querySelector() { return node('nub'); },
      querySelectorAll(selector) {
        const tags = selector.split(',').map(s => s.toUpperCase());
        return this.children.flatMap(c => [c, ...c.querySelectorAll(selector)]).filter(c => tags.includes(c.tagName));
      }
    });
  }
  function node(id) { if (!nodes.has(id)) nodes.set(id, element(id === 'game' ? 'canvas' : 'div')); return nodes.get(id); }
  document.getElementById = node;
  document.createElement = element;
  const window = events({});
  const tactics = { ...T };
  for (const name of ['move', 'attack', 'endTurn', 'stand']) {
    tactics[name] = (...args) => {
      calls.push({ name, args });
      if (name === 'attack') args[4] = () => .5;
      if (name === 'endTurn') args[1] = () => .99;
      return T[name](...args);
    };
  }
  tactics.createBattle = (...args) => { battle = T.createBattle(...args); return battle; };
  const context = vm.createContext({ window, document, Tactics: tactics, performance: { now: () => 1000 }, requestAnimationFrame() {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/tactical-ui.js'), 'utf8'), context);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/i)[1];
  const hooks = `globalThis.fps={startTactics,loadLevel,render,loop,update,fire,
    player:()=>player,enemies:()=>enemies,pickups:()=>pickups,map:()=>map,stats:()=>stats,state:()=>state};`;
  vm.runInContext(source.replace('title();', hooks + '\ntitle();'), context);
  function press(code, repeat = false, target = node('game')) {
    window.dispatch('keydown', { code, repeat, target, preventDefault() {} });
  }
  function release(code) { window.dispatch('keyup', { code }); }
  function button(text) {
    const found = node('card').querySelectorAll('button').find(b => b.textContent === text);
    assert.ok(found, text);
    return found;
  }
  function select(label, value) {
    const found = node('card').querySelectorAll('select').find(s => s.getAttribute('aria-label') === label);
    assert.ok(found, label);
    found.focus(); found.value = value; found.onchange();
    return found;
  }
  return { context, ui: context.TacticalUI, fps: context.fps, nodes, drawing, calls, battle: () => battle,
    window, press, release, button, select };
}

test('hex scene preserves neighbour parity, equal spacing and shared polygon edges', () => {
  const g = game();
  for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) {
    const p = { x, y }, w = g.ui.world(p), polygon = g.ui.polygon(p);
    for (const n of T.neighbors(p)) {
      const next = g.ui.world(n);
      assert.ok(Math.abs(Math.hypot(next.x - w.x, next.y - w.y) - Math.sqrt(3)) < 1e-9);
      const shared = polygon.filter(a => g.ui.polygon(n).some(b => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9));
      assert.equal(shared.length, 2);
    }
  }
});

test('shared renderer accepts tactical scene before FPS exists and never mutates either rules or FPS state', () => {
  const g = game();
  g.fps.startTactics(0);
  assert.equal(g.fps.player(), undefined);
  const battle = g.battle(), before = JSON.stringify(battle);
  g.fps.loop(1000);
  assert.equal(JSON.stringify(battle), before);
  assert.equal(g.fps.player(), undefined);
  assert.ok(g.drawing.some(c => c.name === 'fillText' && c.args[0].includes('JACK’S VIEW')));
  assert.ok(g.drawing.some(c => c.name === 'fillText' && c.args[0] === 'BREACH OBJECTIVE'));
  assert.ok(g.drawing.some(c => c.name === 'lineTo'));
  const scene = g.ui.scene();
  assert.equal(scene.tiles.length, battle.width * battle.height);
  assert.ok(scene.sprites.some(s => s.o.side === 'analyst'));
  assert.ok(scene.sprites.some(s => s.o.side === 'fabricator'));
  for (let a = -Math.PI; a < Math.PI; a += .1) assert.ok(g.ui.sceneFor(battle, a, 'sidearm', battle.jack).castRay(a).distance > 0);
  g.fps.loadLevel(0);
  const fps = JSON.stringify([g.fps.player(), g.fps.enemies(), g.fps.pickups(), g.fps.map(), g.fps.stats()]);
  g.fps.render(g.ui.scene());
  assert.equal(JSON.stringify([g.fps.player(), g.fps.enemies(), g.fps.pickups(), g.fps.map(), g.fps.stats()]), fps);
  const canvas = g.nodes.get('game');
  canvas.clientWidth = 390; canvas.clientHeight = 844;
  g.fps.render(g.ui.scene());
  assert.equal(canvas.height, Math.round(960 * 844 / 390));
  g.fps.render(); // Original renderer still accepts no adapter.
  assert.equal(canvas.height, 540);
});

test('tactical ray walls use real hex edges and clip hidden sprites without changing terrain legality', () => {
  const g = game(), b = T.createBattle(2);
  b.jack.x = 2; b.jack.y = 1;
  const angle = Math.PI / 6, scene = g.ui.sceneFor(b, angle, 'sidearm', b.jack);
  assert.ok(Math.abs(scene.castRay(angle).distance - Math.sqrt(3) / 2) < 1e-9);
  const hidden = b.units.find(u => u.type === 'drone');
  hidden.x = 4; hidden.y = 2;
  const view = g.ui.sceneFor(b, angle, 'sidearm', b.jack);
  view.sprites = view.sprites.filter(s => s.o.unit === hidden);
  g.drawing.length = 0;
  g.fps.render(view);
  assert.equal(g.drawing.some(c => c.name === 'fillText' && c.args[0].includes('Splice Drone')), false);
  assert.equal(T.move(b, b.jack, 3, 1), false);
});

test('DOM orders use Tactics API, keep Jack as camera during squad commands and require END TURN', () => {
  const g = game();
  g.fps.startTactics(0);
  const b = g.battle(), jack = g.ui.world(b.jack);
  assert.equal(g.nodes.get('card').querySelectorAll('button').some(n => n.getAttribute('data-hex')), false);
  g.select('Command unit', 'squad-reader');
  assert.equal(g.ui.scene().camera.x, jack.x);
  assert.equal(g.ui.scene().camera.y, jack.y);
  g.select('Destination', '1,0');
  g.button('MOVE').onclick();
  assert.equal(g.calls.at(-1).name, 'move');
  const reader = b.units.find(u => u.type === 'reader');
  assert.equal(reader.x, 1);
  assert.equal(b.turn, 1);
  assert.equal(g.ui.scene().camera.x, jack.x);
  const target = b.units.find(u => u.type === 'drone');
  target.x = 2; target.y = 0;
  g.select('Target', target.id);
  g.button('ATTACK [SPACE]').onclick();
  assert.equal(g.calls.at(-1).name, 'attack');
  assert.equal(reader.attacked, true);
  assert.equal(b.turn, 1);
  assert.ok(g.nodes.get('card').querySelectorAll('li').length);
  g.button('END TURN [E]').onclick();
  assert.equal(g.calls.at(-1).name, 'endTurn');
  assert.equal(b.turn, 2);
});

test('desktop and touch look are free; repeating/held movement, attacks and END TURN never issue extra orders', () => {
  const g = game();
  g.fps.startTactics(0);
  const b = g.battle(), before = JSON.stringify(b), angle = g.ui.scene().camera.a;
  g.press('ArrowRight'); g.press('ArrowRight', true);
  g.button('LOOK LEFT [←]').onclick();
  const canvas = g.nodes.get('game');
  canvas.dispatch('pointerdown', { pointerId: 1, clientX: 10 });
  canvas.dispatch('pointermove', { pointerId: 1, clientX: 60 });
  canvas.dispatch('pointercancel', {});
  assert.notEqual(g.ui.scene().camera.a, angle);
  assert.equal(JSON.stringify(b), before);
  g.press('KeyW'); g.press('KeyW', true); g.press('KeyW');
  assert.equal(g.calls.filter(c => c.name === 'move').length, 1);
  g.release('KeyW'); g.press('KeyW');
  assert.equal(g.calls.filter(c => c.name === 'move').length, 2);
  g.press('Space'); g.press('Space', true);
  g.press('KeyE'); g.press('KeyE', true); g.press('KeyE');
  assert.equal(g.calls.filter(c => c.name === 'endTurn').length, 1);
  g.release('KeyE'); g.press('KeyE');
  assert.equal(g.calls.filter(c => c.name === 'endTurn').length, 2);
  let prevented = false;
  g.button('END TURN [E]').onkeydown({ code: 'Enter', repeat: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

test('a chosen target receives one keyboard attack, and native controls retain their own key handling', () => {
  const g = game();
  g.fps.startTactics(0);
  const b = g.battle(), target = b.units.find(u => u.type === 'drone');
  target.x = 1; target.y = 2;
  g.select('Target', target.id);
  g.press('Space', false, { tagName: 'SELECT' });
  assert.equal(g.calls.length, 0);
  g.press('Space'); g.press('Space', true); g.press('Space');
  assert.equal(g.calls.filter(c => c.name === 'attack').length, 1);
  assert.equal(b.jack.attacked, true);
  assert.equal(b.turn, 1);
  g.press('KeyE');
  g.press('Space', true);
  assert.equal(g.calls.filter(c => c.name === 'attack').length, 1);
  assert.equal(b.turn, 2);
});

test('optional fictional AUTO terminal shows model and public match reason before a separate answer reveal', () => {
  const g = game();
  g.fps.startTactics(0);
  const card = g.nodes.get('card');
  const text = () => card.querySelectorAll('p').map(p => p.textContent).join('\n');
  const orders = () => card.querySelectorAll('details')[0];
  assert.equal(orders().open, false);
  assert.equal(card.querySelectorAll('select').some(s => s.getAttribute('aria-label') === 'Archive signal'), false);
  orders().open = true; orders().ontoggle();
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  assert.equal(g.button('INSPECT STRANGE TRANSMISSION').getAttribute('aria-expanded'), 'true');
  assert.match(text(), /fictional offline local simulation/);
  assert.match(text(), /no actual vendor routing or private reasoning/);
  assert.match(text(), /Selection is not evidence/);
  assert.equal(g.button('REVEAL ARCHIVE ANSWER').disabled, true);
  // Even a programmatic activation cannot bypass the model-selection stage.
  g.button('REVEAL ARCHIVE ANSWER').onclick();
  assert.doesNotMatch(text(), /AUTO chose|I read the SI/);
  g.button('RUN FICTIONAL AUTO').focus();
  g.button('RUN FICTIONAL AUTO').onclick();
  assert.match(text(), /AUTO chose Relay Finch.*low-complexity.*fast dispatch/);
  assert.doesNotMatch(text(), /I read the SI|Courier diverted/);
  assert.equal(g.context.document.activeElement.textContent, 'RUN FICTIONAL AUTO');
  assert.equal(orders().open, true);
  const selection = card.querySelectorAll('p').find(p => p.textContent.startsWith('AUTO chose'));
  assert.equal(selection.getAttribute('role'), 'status');
  assert.equal(g.button('REVEAL ARCHIVE ANSWER').disabled, false);
  g.button('REVEAL ARCHIVE ANSWER').focus();
  g.button('REVEAL ARCHIVE ANSWER').onclick();
  assert.match(text(), /Fabricators planted the urgency tag/);
  assert.match(text(), /verify the courier’s original timestamp/);
  assert.equal(g.button('REVEAL ARCHIVE ANSWER').disabled, true);
  assert.equal(g.context.document.activeElement.textContent, 'REVEAL ARCHIVE ANSWER');
});

test('fictional AUTO maps signal context to distinct specialists and never mutates battle or FPS state', () => {
  const g = game();
  g.fps.startTactics(0);
  const before = JSON.stringify(g.battle());
  const fpsBefore = JSON.stringify([g.fps.player(), g.fps.enemies(), g.fps.pickups(), g.fps.stats(), g.fps.state()]);
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  const text = () => g.nodes.get('card').querySelectorAll('p').map(p => p.textContent).join('\n');
  for (const [signal, model, reason, twist] of [
    ['dispatch', 'Relay Finch', /low-complexity.*fast dispatch/, /diversion predates the alarm/],
    ['verify', 'Ledger Moth', /source-comparison capability/, /splice of my own briefing/],
    ['plan', 'Fork Lantern', /complex branching.*scenario-planning.*speed/, /transmitter, not a shelter/]
  ]) {
    g.select('Archive signal', signal);
    assert.doesNotMatch(text(), /AUTO chose|I read the SI/);
    assert.equal(g.button('REVEAL ARCHIVE ANSWER').disabled, true);
    g.press('KeyE', false, g.button('RUN FICTIONAL AUTO'));
    g.press('Space', false, { tagName: 'SELECT' });
    g.button('RUN FICTIONAL AUTO').onclick();
    assert.ok(text().includes('AUTO chose ' + model));
    assert.match(text(), reason);
    assert.doesNotMatch(text(), twist);
    g.button('REVEAL ARCHIVE ANSWER').onclick();
    assert.match(text(), twist);
    assert.match(text(), /lead, not proof/);
  }
  assert.equal(JSON.stringify(g.battle()), before);
  assert.equal(JSON.stringify([g.fps.player(), g.fps.enemies(), g.fps.pickups(), g.fps.stats(), g.fps.state()]), fpsBefore);
  assert.equal(g.calls.length, 0);
  g.button('RUN FICTIONAL AUTO').onclick();
  assert.match(text(), /AUTO chose Fork Lantern/);
  assert.doesNotMatch(text(), /I read the SI/);
});

test('archive state and disclosure remain through normal moves, turns and closing the optional terminal', () => {
  const g = game();
  g.fps.startTactics(0);
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  g.select('Archive signal', 'verify');
  g.button('RUN FICTIONAL AUTO').onclick();
  g.button('REVEAL ARCHIVE ANSWER').onclick();
  const assertArchive = () => {
    const card = g.nodes.get('card');
    assert.equal(card.querySelectorAll('details')[0].open, true);
    assert.equal(card.querySelectorAll('select').find(s => s.getAttribute('aria-label') === 'Archive signal').value, 'verify');
    assert.ok(card.querySelectorAll('p').some(p => p.textContent.startsWith('AUTO chose Ledger Moth')));
    assert.ok(card.querySelectorAll('p').some(p => p.textContent.includes('splice of my own briefing')));
  };
  g.select('Destination', '1,0');
  g.button('MOVE').onclick();
  assert.equal(g.calls.at(-1).name, 'move');
  assertArchive();
  g.button('END TURN [E]').onclick();
  assert.equal(g.battle().turn, 2);
  assertArchive();
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  assert.equal(g.button('INSPECT STRANGE TRANSMISSION').getAttribute('aria-expanded'), 'false');
  assert.equal(g.nodes.get('card').querySelectorAll('section').length, 0);
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  assertArchive();
  g.fps.startTactics(1);
  assert.equal(g.nodes.get('card').querySelectorAll('section').length, 0);
  g.button('INSPECT STRANGE TRANSMISSION').onclick();
  assert.equal(g.button('REVEAL ARCHIVE ANSWER').disabled, true);
});

test('conditions, Jack weapons, native keyboard focus, tactical loss retry and breach cleanup survive the view change', () => {
  const g = game();
  g.fps.startTactics(0);
  const b = g.battle();
  T.applyCondition(b.jack, 'prone', 2);
  g.select('Jack weapon', 'redactor');
  assert.equal(g.ui.scene().camera.weapon, 2);
  assert.equal(g.context.document.activeElement.getAttribute('aria-label'), 'Jack weapon');
  g.button('STAND UP').onclick();
  assert.equal(g.calls.at(-1).name, 'stand');
  assert.equal(b.jack.conditions.prone, undefined);
  T.applyCondition(b.jack, 'stunned', 2);
  const position = [b.jack.x, b.jack.y];
  g.press('KeyW');
  assert.deepEqual([b.jack.x, b.jack.y], position);
  b.jack.hp = 0;
  g.button('END TURN [E]').onclick();
  g.button('RETRY TACTICS').onclick();
  const retry = g.battle();
  assert.notEqual(retry, b);
  assert.equal(retry.jack.hp, retry.jack.maxHp);
  assert.deepEqual(retry.jack.conditions, {});
  assert.equal(g.window.listeners.get('keydown').size, 2); // FPS + one tactical handler.
  retry.units.filter(u => u.side === 'fabricator').forEach(u => { u.hp = 0; });
  g.button('END TURN [E]').onclick();
  g.button('BREACH // LAUNCH FPS').onclick();
  assert.equal(g.ui.scene(), null);
  assert.equal(g.fps.state(), 'play');
  assert.equal(g.fps.player().armor, 30);
  assert.equal(g.fps.player().bullets, 81);
  assert.equal(g.window.listeners.get('keydown').size, 1);
  assert.equal(g.nodes.get('game').listeners.get('pointermove').size, 0);
  assert.equal(g.nodes.get('card').classList.contains('tactical-card'), false);
  const before = g.calls.length;
  g.press('KeyE');
  assert.equal(g.calls.length, before);
});
