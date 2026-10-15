'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../engine/autopilot.js');

const ARCHIVE = ['##################', '#Pj...#....S....X#', '#.##..#..###.##R#', '#..m..#...i#....#',
  '#.##..M....#....#', '#.....M.d..#..s.#', '###D####.###....#', '#....m.#....d...#', '#..h...#..##....#',
  '#....v.#..#.....#', '#.####.#..#.....#', '#..b...#..#.m...#', '#......D..#.....#', '#..m...#..r..t..#',
  '#......#........#', '##################'];

function makeState(overrides = {}) {
  const map = ARCHIVE.map(r => r.replace(/[PjmMdSistvbhrt]/g, '.').split(''));
  return {
    map, doors: { '15,2': { open: 0, type: 'R' }, '3,6': { open: 0, type: 'D' }, '7,12': { open: 0, type: 'D' } },
    player: { x: 1.5, y: 1.5, a: 0, hp: 100, bullets: 45, shells: 8, weapon: 0, red: false, blue: false, jetpack: false, fuel: 0, height: 0 },
    enemies: [], pickups: [], stats: { kills: 0, intel: 0, elapsed: 0 }, missionIndex: 0, ...overrides
  };
}

test('locked red door blocks planning until clearance is held', () => {
  const s = makeState();
  assert.equal(A.planPath(s, { x: 15, y: 2 }), null, 'red door tile is impassable without red clearance');
  s.player.red = true;
  const path = A.planPath(s, { x: 15, y: 2 });
  assert.ok(path && path.at(-1).x === 15 && path.at(-1).y === 2);
});

test('plain doors are planned through and paths are 4-connected', () => {
  const s = makeState();
  const path = A.planPath(s, { x: 3, y: 8 });
  assert.ok(path.some(t => t.x === 3 && t.y === 6));
  let prev = { x: 1, y: 1 };
  for (const t of path) { assert.equal(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y), 1); prev = t; }
});

test('goal ordering favours clearance, then exit once clearance is held', () => {
  const s = makeState({ pickups: [{ type: 'r', x: 10.5, y: 13.5, alive: true }] });
  assert.equal(A.chooseGoal(s, A.DEFAULT_PARAMS).kind, 'clearance');
  s.pickups[0].alive = false; s.player.red = true;
  assert.equal(A.chooseGoal(s, A.DEFAULT_PARAMS).kind, 'exit');
  s.player.hp = 10; s.pickups.push({ type: 'h', x: 3.5, y: 8.5, alive: true });
  assert.equal(A.chooseGoal(s, A.DEFAULT_PARAMS).kind, 'heal');
});

test('agent faces a closed door square-on and taps E instead of walking into it', () => {
  const s = makeState();
  s.player.x = 3.5; s.player.y = 5.5; s.player.a = Math.PI / 2;
  s.pickups = [{ type: 'h', x: 3.5, y: 8.5, alive: true }]; s.player.hp = 10;
  const out = A.act(s, {}, A.DEFAULT_PARAMS);
  assert.deepEqual(out.taps, ['KeyE']);
  assert.ok(!out.keys.has('KeyW'));
});

test('combat fires only inside the hit cone and never through walls', () => {
  const s = makeState();
  s.player.x = 8.5; s.player.y = 4.5; s.player.a = 0;
  s.enemies = [{ type: 'DRONE', x: 10.5, y: 4.5, alive: true }];
  assert.ok(A.act(s, {}, A.DEFAULT_PARAMS).keys.has('Space'));
  s.player.a = 0.6;
  assert.ok(!A.act(s, {}, A.DEFAULT_PARAMS).keys.has('Space'));
  s.player.a = 0; s.enemies = [{ type: 'DRONE', x: 12.5, y: 3.5, alive: true }];
  assert.ok(!A.act(s, {}, A.DEFAULT_PARAMS).mode.startsWith('combat'), 'enemy behind wall is not engaged');
});

test('melee threat inside jet range triggers lift above 0.8 strike height', () => {
  const s = makeState();
  s.player.x = 4.5; s.player.y = 5.5; s.player.jetpack = true; s.player.fuel = 50;
  s.enemies = [{ type: 'MOLE', x: 5.3, y: 5.5, alive: true }];
  assert.ok(A.act(s, {}, A.DEFAULT_PARAMS).keys.has('KeyJ'));
});

test('learner keeps the champion and persists generations', () => {
  const l = A.createLearner(null);
  assert.equal(l.generation, 0);
  assert.equal(A.recordEpisode(l, { levelsCompleted: 1, kills: 3, hp: 50, seconds: 60 }).improved, true);
  const champion = { ...l.best };
  assert.equal(A.recordEpisode(l, { died: true, seconds: 10 }).improved, false);
  assert.deepEqual(l.best, champion);
  const restored = A.createLearner(JSON.parse(A.serialize(l)));
  assert.equal(restored.generation, 2);
  assert.deepEqual(restored.best, champion);
  for (const [k, [lo, hi]] of Object.entries(A.PARAM_SPACE)) assert.ok(restored.candidate[k] >= lo && restored.candidate[k] <= hi);
});

test('LOS matches the engine ray at a wall corner observed in a live run', () => {
  const s = makeState();
  s.player.x = 6.504; s.player.y = 10.469;
  assert.equal(A.lineOfSight(s, s.player, { x: 3.5, y: 13.5 }), false);
});

test('an unarmed agent stops engaging and routes to ammo', () => {
  const s = makeState({ pickups: [{ type: 'b', x: 3.5, y: 11.5, alive: true }] });
  s.player.x = 3.5; s.player.y = 9.5; s.player.bullets = 0; s.player.shells = 0;
  s.enemies = [{ type: 'DRONE', x: 3.5, y: 12.5, alive: true }];
  const out = A.act(s, {}, A.DEFAULT_PARAMS);
  assert.ok(!out.keys.has('Space'));
  assert.equal(out.mode, 'nav:ammo');
});

test('fitness rewards completion over survival-only play', () => {
  assert.ok(A.fitness({ levelsCompleted: 1, seconds: 120 }) > A.fitness({ hp: 100, seconds: 30 }));
  assert.ok(A.fitness({ died: true }) < A.fitness({}));
});

test('a target too far to hit inside engage range is approached instead of held at range', () => {
  const s = makeState();
  s.map = Array.from({ length: 14 }, (_, y) => Array.from({ length: 14 }, (_, x) => (x === 0 || y === 0 || x === 13 || y === 13 ? '#' : '.')));
  s.doors = {}; s.player.x = 1.5; s.player.y = 1.5; s.player.a = 0;
  s.enemies = [{ type: 'ICE_PIG', x: 8.5, y: 1.5, alive: true }];
  const far = A.act(s, {}, A.DEFAULT_PARAMS);
  assert.ok(far.mode.startsWith('combat') && far.keys.has('KeyW'), 'closes distance on a 7-tile target');
  s.enemies[0].x = 4.5;
  const near = A.act(s, {}, A.DEFAULT_PARAMS);
  assert.ok(near.keys.has('Space') && !near.keys.has('KeyW'), 'stops and fires once the hit window is alignable');
});

test('exitOutcome scores only real level clears as complete', () => {
  assert.equal(A.exitOutcome('dead'), 'dead');
  assert.equal(A.exitOutcome('brief'), 'complete');
  assert.equal(A.exitOutcome('victory'), 'complete');
  assert.equal(A.exitOutcome('title'), 'interrupted');
  assert.equal(A.exitOutcome('tactical'), 'interrupted');
});

test('autopilot seeks footprint nodes before the mission exit', () => {
  const ops = require('../engine/footprint-ops.js'), level = ops.level();
  const s = makeState({ map: level.map.map(r => r.replace(/[Pehb]/g, '.').split('')), doors: {},
    pickups: ops.catalogue.map(q => ({ type: ops.TILE, id: q.id, x: q.x + .5, y: q.y + .5, alive: true })) });
  assert.equal(A.chooseGoal(s, A.DEFAULT_PARAMS).kind, 'footprint');
  s.pickups.forEach(q => { q.alive = false; });
  assert.equal(A.chooseGoal(s, A.DEFAULT_PARAMS).kind, 'exit');
});

test('browser driver carries ordered footprint telemetry through completion and resets on other missions', () => {
  const ops = require('../engine/footprint-ops.js'), events = [];
  let interval, s = makeState({ mode: 'play', missionIndex: 7 }), footprint = ops.createState();
  const el = () => ({ style: {}, remove() {}, appendChild() {} });
  const win = {
    document: { createElement: el, body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    HailCampaignState: () => s,
    HailFootprintEpisode: () => s.missionIndex === 7 ? { footprints: ops.episode(footprint), footprints_total: 8 } : null,
    HailStoryCorpus: {}, HailSIDialogue: { mount: () => ({ status() {}, onEpisode(_learner, episode) { events.push(episode); } }) },
    setInterval(fn) { interval = fn; return 1; }, clearInterval() {},
    dispatchEvent() {}, KeyboardEvent: class { constructor(type, fields) { Object.assign(this, { type }, fields); } }
  };
  const run = A.start(win);
  interval();
  footprint = ops.scrub({ ...footprint, time: 1.5 }, 'F2'); interval();
  footprint = ops.scrub({ ...footprint, time: 3 }, 'F1'); s.mode = 'victory'; interval();
  assert.deepEqual(events[0].footprints, ops.episode(footprint));
  assert.equal(events[0].footprints_total, 8);
  assert.equal(run.status().running, false);
  A.start(win);
  s = makeState({ mode: 'play', missionIndex: 0 }); interval();
  s.mode = 'dead'; interval();
  assert.equal(Object.hasOwn(events[1], 'footprints'), false);
  assert.equal(Object.hasOwn(events[1], 'footprints_total'), false);
  run.stop();
});

function driver(options = {}) {
  let interval, time = 0, s = makeState({ mode: 'play' }), clicks = 0, clears = 0;
  const events = [], listeners = new Map(), nodes = new Map();
  const el = () => ({ style: {}, children: [], remove() {}, appendChild(child) { this.children.push(child); } });
  const win = {
    document: { createElement: el, body: el(), getElementById(id) { return nodes.get(id) || null; }, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance: { now: () => time },
    HailCampaignState: () => s, HailSetAutopilotActive(value) { this.autoActive = value; },
    setInterval(fn) { interval = fn; return 1; }, clearInterval() { clears++; },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(event) { events.push(event); },
    KeyboardEvent: class { constructor(type, fields) { Object.assign(this, { type }, fields); } }
  };
  nodes.set('primary', { click() { clicks++; } });
  const run = A.start(win, options);
  return { win, run, events, nodes, listeners, tick: () => interval(), state: () => s,
    setState(value) { s = value; }, advance(value) { time += value; }, clicks: () => clicks, clears: () => clears };
}

test('autopilot stops at pause, death and victory instead of resuming or restarting', () => {
  for (const mode of ['pause', 'dead', 'victory']) {
    const d = driver(); d.tick(); d.state().mode = mode; d.tick(); d.tick();
    assert.equal(d.run.status().running, false, mode);
    assert.equal(d.clicks(), 0, mode);
    assert.equal(d.win.autoActive, false);
    assert.equal(d.clears(), 1);
    assert.ok(d.events.every(e => !(e.type === 'keydown' && e.code === 'Escape')));
  }
});

test('autopilot episode and wall-clock limits end runs rather than starting more episodes', () => {
  const timeout = driver({ levelTimeout: 1 }); timeout.tick();
  timeout.state().stats.elapsed = 1; timeout.tick(); timeout.tick();
  assert.equal(timeout.run.status().running, false);
  assert.match(timeout.run.status().stopReason, /Episode time limit/);
  assert.equal(timeout.run.learner.generation, 1);
  assert.equal(timeout.run.learner.history[0].outcome, 'timeout');
  const wall = driver({ maxDurationMs: 100 }); wall.tick(); wall.advance(100); wall.tick();
  assert.match(wall.run.status().stopReason, /Session time limit/);
  const complete = driver(); complete.tick(); complete.state().mode = 'brief'; complete.tick();
  assert.match(complete.run.status().stopReason, /Episode limit/);
  assert.equal(complete.clicks(), 0);
});

test('autopilot stops on human input, lost focus, hidden page and data review; duplicate start cleans up', () => {
  for (const event of ['keydown', 'pointerdown', 'blur', 'pagehide']) {
    const d = driver(); d.tick(); d.listeners.get(event)({ isTrusted: true }); d.tick();
    assert.equal(d.run.status().running, false, event);
    assert.equal(d.listeners.size, 0);
  }
  const hidden = driver(); hidden.tick(); hidden.win.document.hidden = true; hidden.tick();
  assert.equal(hidden.run.status().running, false);
  const modal = driver(); modal.nodes.set('gameDataPanel', { hidden: false }); modal.tick();
  assert.equal(modal.run.status().running, false);
  const duplicate = driver(); const first = duplicate.run; A.start(duplicate.win);
  assert.equal(first.status().running, false);
  assert.equal(duplicate.clears(), 1);
  assert.equal(duplicate.win.HailAutopilotRun.status().running, true);
  duplicate.win.HailAutopilotRun.stop();
});

test('autopilot visible stop button releases keys and rejects unbounded configuration', () => {
  const d = driver(); d.tick();
  const hud = d.win.document.body.children[0];
  d.listeners.get('blur')({ type: 'blur', target: hud.children[1] });
  d.listeners.get('pointerdown')({ type: 'pointerdown', isTrusted: true, target: hud.children[1] });
  assert.equal(d.run.status().running, true);
  hud.children[1].onclick();
  assert.equal(d.run.status().running, false);
  assert.equal(d.run.status().stopReason, 'Stopped by player.');
  assert.equal(hud.children[1].disabled, true);
  assert.ok(d.events.some(e => e.type === 'keyup'));
  for (const options of [{ maxEpisodes: Infinity }, { maxDurationMs: Infinity }, { tickMs: 0 }, { levelTimeout: NaN }]) {
    assert.throws(() => driver(options), /finite/);
  }
});
