// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Input-only autopilot: reads the public campaign snapshot, acts through keyboard
// events, and mutates its own policy parameters after every episode.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./core.js') : root.VessellEngine);
  if (node) module.exports = api;
  else root.HailAutopilot = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Engine) {
  'use strict';

  const PARAM_SPACE = Object.freeze({
    healThreshold: [20, 80],
    ammoThreshold: [4, 30],
    shotgunRange: [0.8, 3.0],
    aimTolerance: [0.03, 0.3],
    engageRange: [3, 12],
    jetRange: [0.6, 2.5],
    intelDetour: [0, 30],
    retreatRange: [0, 1.4]
  });
  const DEFAULT_PARAMS = Object.freeze({
    healThreshold: 45, ammoThreshold: 10, shotgunRange: 2.3, aimTolerance: 0.12,
    engageRange: 8, jetRange: 1.4, intelDetour: 12, retreatRange: 0.7
  });
  const MELEE = new Set(['MOLE', 'ICE_PIG']);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function tileOf(p) { return { x: Math.floor(p.x), y: Math.floor(p.y) }; }
  function key(x, y) { return x + ',' + y; }

  // Mirrors the game's solid(): '.' and 'X' walkable, doors walkable once open >= 0.88.
  function isSolidTile(state, x, y) {
    const row = state.map[y];
    if (!row || x < 0 || x >= row.length) return true;
    const c = row[x];
    if (c === '.' || c === 'X') return false;
    if ('DRB'.includes(c)) { const d = state.doors[key(x, y)]; return !d || d.open < 0.88; }
    return true;
  }
  function passableForPlan(state, x, y) {
    const row = state.map[y];
    if (!row || x < 0 || x >= row.length) return false;
    const c = row[x];
    if (c === '.' || c === 'X' || c === 'D') return true;
    if (c === 'R') return Boolean(state.player.red);
    if (c === 'B') return Boolean(state.player.blue);
    return !isSolidTile(state, x, y);
  }

  // Same DDA ray the game uses for hit checks, so the agent never fires at what it cannot hit.
  function lineOfSight(state, a, b) {
    return Engine.lineOfSight(state.map, a, b, (x, y) => isSolidTile(state, Math.floor(x), Math.floor(y)));
  }

  // 4-connected BFS so routes stay on tile centres and never clip wall corners.
  function bfs(state, from) {
    const dist = new Map([[key(from.x, from.y), 0]]), prev = new Map(), queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i], d = dist.get(key(cur.x, cur.y));
      for (const [ox, oy] of DIRS) {
        const nx = cur.x + ox, ny = cur.y + oy, k = key(nx, ny);
        if (dist.has(k) || !passableForPlan(state, nx, ny)) continue;
        dist.set(k, d + 1); prev.set(k, cur); queue.push({ x: nx, y: ny });
      }
    }
    return { dist, prev };
  }
  function pathTo(search, from, to) {
    if (!search.dist.has(key(to.x, to.y))) return null;
    const path = [];
    for (let cur = to; cur && !(cur.x === from.x && cur.y === from.y); cur = search.prev.get(key(cur.x, cur.y))) path.unshift(cur);
    return path;
  }
  function planPath(state, to) {
    const from = tileOf(state.player);
    return pathTo(bfs(state, from), from, to);
  }

  function findExit(state) {
    for (let y = 0; y < state.map.length; y++) {
      const x = state.map[y].indexOf('X');
      if (x >= 0) return { x, y };
    }
    return null;
  }
  function ammoOf(p) { return (p.bullets || 0) + (p.shells || 0) * 3; }

  // Ordered objectives: survive, then clearance, controller and exit (covers red, boss, blue-boss).
  function chooseGoal(state, params) {
    const p = state.player, from = tileOf(p), search = bfs(state, from);
    const reach = (x, y) => search.dist.get(key(Math.floor(x), Math.floor(y)));
    const pick = (types) => {
      let best = null;
      for (const q of state.pickups) {
        if (!q.alive || !types.includes(q.type)) continue;
        const d = reach(q.x, q.y);
        if (d !== undefined && (!best || d < best.d)) best = { d, q };
      }
      return best;
    };
    const go = (kind, t, d) => ({ kind, tile: { x: Math.floor(t.x), y: Math.floor(t.y) }, path: pathTo(search, from, { x: Math.floor(t.x), y: Math.floor(t.y) }), distance: d });
    let c;
    if (p.hp < params.healThreshold && (c = pick(['h', 'a']))) return go('heal', c.q, c.d);
    if (ammoOf(p) < params.ammoThreshold && (c = pick(['b', 's']))) return go('ammo', c.q, c.d);
    if ((c = pick(['r', 'q']))) return go('clearance', c.q, c.d);
    if (!p.jetpack && (c = pick(['j']))) return go('jetpack', c.q, c.d);
    if ((c = pick(['i'])) && c.d <= params.intelDetour) return go('intel', c.q, c.d);
    const boss = state.enemies.find(e => e.alive && e.type === 'FABRICATOR');
    if (boss) { const d = reach(boss.x, boss.y); if (d !== undefined) return go('controller', boss, d); }
    const exit = findExit(state);
    if (exit) { const d = reach(exit.x + 0.5, exit.y + 0.5); if (d !== undefined) return go('exit', { x: exit.x + 0.5, y: exit.y + 0.5 }, d); }
    if ((c = pick(['h', 'a', 'b', 's', 'v', 'i']))) return go('explore', c.q, c.d);
    return { kind: 'idle', tile: from, path: [], distance: 0 };
  }

  function visibleThreats(state, params) {
    return state.enemies
      .filter(e => e.alive)
      .map(e => ({ e, dist: Math.hypot(e.x - state.player.x, e.y - state.player.y) }))
      .filter(t => t.dist <= params.engageRange && lineOfSight(state, state.player, t.e))
      .sort((a, b) => a.dist - b.dist);
  }

  function steerTo(p, tx, ty, keys, precise) {
    const want = Math.atan2(ty - p.y, tx - p.x), diff = wrap(want - p.a);
    const deadband = precise ? 0.04 : 0.09;
    if (diff > deadband) keys.add('ArrowRight'); else if (diff < -deadband) keys.add('ArrowLeft');
    return diff;
  }

  // One control decision. Returns held keys plus at most one tap (KeyE / weapon digits).
  function act(state, memory, params) {
    const p = state.player, keys = new Set(), taps = [];
    memory.t = (memory.t || 0) + 1;
    const threats = visibleThreats(state, params);
    const armed = (p.bullets || 0) > 0 || (p.shells || 0) > 0;
    const target = armed ? threats[0] : null;

    const meleeNear = threats.find(t => MELEE.has(t.e.type) && t.dist < params.jetRange);
    if (meleeNear && p.jetpack && p.fuel > 2) keys.add('KeyJ');

    if (target) {
      const wantShotgun = target.dist <= params.shotgunRange && p.shells > 0;
      const weapon = wantShotgun ? 1 : (p.bullets > 0 ? 0 : (p.shells > 0 ? 1 : 0));
      if (p.weapon !== weapon) taps.push('Digit' + (weapon + 1));
      const diff = steerTo(p, target.e.x, target.e.y, keys, true);
      const size = (target.e.type === 'FABRICATOR' ? 0.8 : 0.35) / Math.max(target.dist, 0.1);
      if (Math.abs(diff) < Math.min(params.aimTolerance, size * 0.8)) keys.add('Space');
      if (MELEE.has(target.e.type) && target.dist < params.retreatRange && !keys.has('KeyJ')) keys.add('KeyS');
      memory.mode = 'combat:' + target.e.type;
      return { keys, taps, mode: memory.mode };
    }

    const goal = chooseGoal(state, params);
    memory.goal = goal.kind;
    const here = tileOf(p), cx = here.x + 0.5, cy = here.y + 0.5;
    const next = goal.path && goal.path[0];
    if (!next) { memory.mode = 'hold:' + goal.kind; return { keys, taps, mode: memory.mode }; }

    // Doors and the exit are used, not walked into: centre, face square-on, press E.
    const nc = state.map[next.y][next.x];
    const closedDoor = 'DRB'.includes(nc) && isSolidTile(state, next.x, next.y);
    if (closedDoor || (nc === 'X' && goal.path.length === 1)) {
      if (Math.hypot(p.x - cx, p.y - cy) > 0.12) { steerTo(p, cx, cy, keys, false); if (Math.abs(wrap(Math.atan2(cy - p.y, cx - p.x) - p.a)) < 0.35) keys.add('KeyW'); memory.mode = 'centre'; return { keys, taps, mode: memory.mode }; }
      const diff = steerTo(p, next.x + 0.5, next.y + 0.5, keys, true);
      if (Math.abs(diff) < 0.06 && (memory.lastUse === undefined || memory.t - memory.lastUse > 8)) { taps.push('KeyE'); memory.lastUse = memory.t; }
      memory.mode = nc === 'X' ? 'use-exit' : 'use-door';
      return { keys, taps, mode: memory.mode };
    }

    // Re-centre laterally before committing to a new tile to avoid corner snags.
    const lateral = next.x !== here.x ? Math.abs(p.y - cy) : Math.abs(p.x - cx);
    const tx = lateral > 0.14 ? cx : next.x + 0.5, ty = lateral > 0.14 ? cy : next.y + 0.5;
    const diff = steerTo(p, tx, ty, keys, false);
    if (Math.abs(diff) < 0.4) keys.add('KeyW');
    if (stuck(memory, p)) { keys.clear(); keys.add('KeyS'); keys.add(memory.t % 2 ? 'ArrowLeft' : 'ArrowRight'); memory.mode = 'unstick'; return { keys, taps, mode: memory.mode }; }
    memory.mode = 'nav:' + goal.kind;
    return { keys, taps, mode: memory.mode };
  }

  function stuck(memory, p) {
    const hist = memory.hist || (memory.hist = []);
    hist.push([p.x, p.y]);
    if (hist.length > 30) hist.shift();
    if (memory.unstick > 0) { memory.unstick--; return true; }
    if (hist.length < 30) return false;
    const [x0, y0] = hist[0];
    if (Math.hypot(p.x - x0, p.y - y0) < 0.08) { memory.unstick = 8; hist.length = 0; memory.stuckCount = (memory.stuckCount || 0) + 1; return true; }
    return false;
  }

  function fitness(ep) {
    return (ep.levelsCompleted || 0) * 1000 + (ep.kills || 0) * 50 + (ep.intel || 0) / 10 +
      (ep.hp || 0) * 2 - (ep.seconds || 0) - (ep.died ? 300 : 0) - (ep.stuck || 0) * 5;
  }

  // Seeded RNG so mutation is reproducible from the persisted generation number.
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function gaussian(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function mutate(params, seed, scale) {
    const r = rng(seed), out = {};
    for (const [k, [lo, hi]] of Object.entries(PARAM_SPACE)) {
      const v = (params[k] ?? DEFAULT_PARAMS[k]) + gaussian(r) * (hi - lo) * (scale ?? 0.12);
      out[k] = Math.min(hi, Math.max(lo, v));
    }
    return out;
  }

  // (1+1) hill-climber: each episode tests a mutated candidate; the champion is kept.
  function createLearner(saved) {
    const s = saved && saved.schema === 'hail-autopilot/v1' ? saved : null;
    const learner = {
      schema: 'hail-autopilot/v1',
      generation: s ? s.generation : 0,
      best: s ? s.best : { ...DEFAULT_PARAMS },
      bestFitness: s ? s.bestFitness : -Infinity,
      candidate: null,
      history: s ? s.history.slice(-200) : []
    };
    learner.candidate = learner.generation === 0 ? { ...learner.best } : mutate(learner.best, learner.generation * 2654435761);
    return learner;
  }
  function recordEpisode(learner, episode) {
    const score = fitness(episode), improved = score > learner.bestFitness;
    if (improved) { learner.best = { ...learner.candidate }; learner.bestFitness = score; }
    learner.history.push({ generation: learner.generation, fitness: Math.round(score * 10) / 10, improved, ...episode });
    if (learner.history.length > 200) learner.history.shift();
    learner.generation += 1;
    learner.candidate = mutate(learner.best, learner.generation * 2654435761);
    return { score, improved };
  }
  function serialize(learner) {
    return JSON.stringify({ schema: learner.schema, generation: learner.generation, best: learner.best,
      bestFitness: Number.isFinite(learner.bestFitness) ? learner.bestFitness : -1e9, history: learner.history });
  }

  // Browser driver: keyboard events and on-screen buttons only; never writes game state.
  function start(win, options) {
    const opts = { tickMs: 50, levelTimeout: 240, storageKey: 'hail-autopilot/v1', ...options };
    const doc = win.document, store = win.localStorage;
    let saved = null;
    try { saved = JSON.parse(store.getItem(opts.storageKey)); } catch (e) { saved = null; }
    const learner = createLearner(saved);
    let held = new Set(), memory = {}, episode = null, lastMode = null, lastMission = null;
    const hud = doc.createElement('div');
    hud.id = 'autopilotHud';
    hud.style.cssText = 'position:fixed;right:8px;top:8px;z-index:99;background:#000c;color:#9f9;font:12px/1.35 Courier New,monospace;padding:6px 8px;border:1px solid #3a3;pointer-events:none;white-space:pre';
    doc.body.appendChild(hud);
    const nes = doc.querySelector('[aria-label*="NES"]');
    if (nes) nes.style.display = 'none';

    const si = win.HailSIDialogue && win.HailStoryCorpus
      ? win.HailSIDialogue.mount(win, win.HailStoryCorpus, { learner: () => learner }) : null;
    if (si) si.status(learner);

    const send = (type, code) => win.dispatchEvent(new win.KeyboardEvent(type, { code, key: code, bubbles: true }));
    const release = () => { held.forEach(c => send('keyup', c)); held = new Set(); };
    const begin = (s) => {
      memory = {};
      episode = { mission: s.missionIndex, startKills: s.stats.kills, startIntel: s.stats.intel, startTime: s.stats.elapsed || 0, levelsCompleted: 0 };
    };
    const finish = (s, how) => {
      if (!episode) return;
      const ep = {
        mission: episode.mission, outcome: how, levelsCompleted: how === 'complete' ? 1 : 0,
        died: how === 'dead', kills: s.stats.kills - episode.startKills, intel: s.stats.intel - episode.startIntel,
        hp: how === 'dead' ? 0 : s.player ? s.player.hp : 0, seconds: Math.round(((s.stats.elapsed || 0) - episode.startTime) * 10) / 10,
        stuck: memory.stuckCount || 0
      };
      const result = recordEpisode(learner, ep);
      if (si) si.onEpisode(learner, ep, result);
      try { store.setItem(opts.storageKey, serialize(learner)); } catch (e) { /* storage full */ }
      episode = null;
    };
    const clickPrimary = () => {
      const b = doc.getElementById('primary') ||
        Array.from(doc.querySelectorAll('button')).find(x => x.offsetParent && /DEPLOY|CONTINUE|RESTART|AGAIN|LAUNCH|BREACH|START/i.test(x.textContent));
      if (b) b.click();
    };

    const timer = win.setInterval(() => {
      let s;
      try { s = win.HailCampaignState(); } catch (e) { return; }
      if (s.mode !== 'play') {
        release();
        if (lastMode === 'play') finish(s, s.mode === 'dead' ? 'dead' : 'complete');
        if (s.mode !== 'pause') clickPrimary(); else send('keydown', 'Escape');
      } else {
        if (!episode || lastMission !== s.missionIndex) { if (episode) finish(s, 'complete'); begin(s); }
        if (((s.stats.elapsed || 0) - episode.startTime) > opts.levelTimeout) { finish(s, 'timeout'); begin(s); }
        const out = act(s, memory, learner.candidate);
        for (const c of held) if (!out.keys.has(c)) send('keyup', c);
        for (const c of out.keys) send('keydown', c); // re-sent each tick: the game clears keys on load/blur
        held = out.keys;
        for (const c of out.taps) { send('keydown', c); send('keyup', c); }
        hud.textContent = 'AUTOPILOT GEN ' + learner.generation + '\nbest ' + (Number.isFinite(learner.bestFitness) ? learner.bestFitness.toFixed(0) : '-') +
          '\nmission ' + (s.missionIndex + 1) + '  hp ' + Math.round(s.player.hp) + '\n' + out.mode;
      }
      lastMode = s.mode; lastMission = s.missionIndex;
    }, opts.tickMs);

    const handle = {
      learner,
      stop() { win.clearInterval(timer); release(); hud.remove(); const p = doc.getElementById('siChannel'); if (p) p.remove(); },
      export() { return JSON.parse(serialize(learner)); },
      reset() { store.removeItem(opts.storageKey); }
    };
    win.HailAutopilotRun = handle;
    return handle;
  }

  return { PARAM_SPACE, DEFAULT_PARAMS, isSolidTile, lineOfSight, planPath, chooseGoal, act, fitness,
    mutate, createLearner, recordEpisode, serialize, start };
});
