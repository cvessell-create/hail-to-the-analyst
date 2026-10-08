// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
(() => {
  const E = VessellEngine, S = EngineSystems, M = EngineMath, Games = EncounterGames;
  const element = id => document.getElementById(id), canvas = element('view'), ctx = canvas.getContext('2d');
  const controls = EngineControls.bind(window, document.querySelectorAll('[data-action]'));
  const profile = S.profiler(), registry = new S.SceneRegistry(S.defaultScene());
  let world, boss = UltraBoss.create(), bossXp = 0, audio = null, last = null, lastProfile = 0;
  let online = null, sequence = 0, networkBusy = false, generation = 0, networkSnapshot = null;
  function error(cause) { element('error').textContent = cause.message; console.error(cause); }
  function action(id, operation) {
    element(id).onclick = async () => {
      element('error').textContent = '';
      try { await operation(); } catch (cause) { error(cause); }
    };
  }
  function createWorld(player) {
    const scene = registry.export(), spawn = scene.objects.find(object => object.type === 'spawn');
    world = E.createWorld({ grid: scene.grid, ...(player || spawn) });
  }
  function editMap(focus) {
    const scene = registry.export(), map = element('map');
    map.replaceChildren(); map.style.gridTemplateColumns = `repeat(${scene.grid[0].length}, 32px)`;
    scene.grid.forEach((row, y) => Array.from(row).forEach((tile, x) => {
      const button = document.createElement('button'), object = scene.objects.find(item => Math.floor(item.x) === x && Math.floor(item.y) === y);
      button.type = 'button'; button.textContent = object ? object.type === 'spawn' ? 'P' : '*' : tile;
      button.className = (tile === '#' ? 'wall' : 'floor') + (object ? ' occupied' : '');
      button.setAttribute('aria-label', `Cell ${x},${y}: ${tile === '#' ? 'wall' : 'floor'}${object ? ', ' + object.label : ''}`);
      button.disabled = x === 0 || y === 0 || x === row.length - 1 || y === scene.grid.length - 1 || Boolean(online);
      button.onclick = () => {
        try { registry.paint(x, y, element('paint').value); createWorld(); editMap([x, y]); }
        catch (cause) { error(cause); }
      };
      map.appendChild(button);
      if (focus && focus[0] === x && focus[1] === y) button.focus();
    }));
    element('scene-json').value = JSON.stringify(scene, null, 2);
  }
  function offlineOnly() { if (online) throw Error('Disconnect before editing or loading offline state.'); }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const clock = E.clock(dt => {
    if (online) return;
    const input = controls.sample(); world.turn(input.turn * dt * 2);
    world.move(input.forward, input.strafe, dt * 2.25);
  });
  function frame(now) {
    try {
      const elapsed = last === null ? 0 : Math.min(3600, (now - last) / 1000);
      const result = clock.advance(elapsed); last = now;
      profile.count('droppedTicks', result.droppedTicks - (frame.dropped || 0)); frame.dropped = result.droppedTicks;
      profile.measure('render', () => {
        const depths = E.render(ctx, world, canvas.width, canvas.height);
        const scene = online && networkSnapshot ? networkSnapshot.scene : registry.export();
        S.renderSprites(ctx, scene, world.position(), canvas.width, canvas.height, depths);
        if (online && networkSnapshot) {
          const actors = [...networkSnapshot.players.filter(player => player.id !== networkSnapshot.you && player.hp > 0),
            ...networkSnapshot.combat.enemies.filter(enemy => enemy.hp > 0)];
          const remote = { ...scene, objects: actors.map(player => ({ id: player.id, type: 'sprite', x: player.x, y: player.y,
            label: player.name || player.id, scale: 0.8, asset: 'beacon' })) };
          S.renderSprites(ctx, remote, world.position(), canvas.width, canvas.height, depths);
        }
      });
      if (now - lastProfile > 500) {
        lastProfile = now; element('profile').textContent = JSON.stringify(profile.snapshot(), null, 2);
        const p = world.position();
        element('position').textContent = `Position ${p.x.toFixed(2)}, ${p.y.toFixed(2)}; ${online ? 'server authoritative' : 'offline'}`;
      }
      requestAnimationFrame(frame);
    } catch (cause) { error(cause); }
  }
  function showBoss() {
    const view = boss.snapshot(), jack = view.players[1];
    element('boss-summary').textContent = `State: ${view.stage}; earned boosts ${view.extra}; Jack pivotal ${(100 * jack.shapleyShubik).toFixed(1)}%, critical share ${(100 * jack.banzhafNormalized).toFixed(1)}%; challenge XP ${bossXp}.`;
    element('boosts').replaceChildren();
    for (const token of ['boost-1', 'boost-2', 'boost-3']) {
      const button = document.createElement('button'); button.textContent = `Earn ${token} (+2)`;
      button.disabled = view.stage !== 'shielded' || view.extra >= 4;
      button.onclick = () => {
        try { if (!boss.collect(token)) throw Error('Boost already earned.'); showBoss(); }
        catch (cause) { error(cause); }
      };
      element('boosts').appendChild(button);
    }
  }
  const team = () => [1, ...(element('ally-reader').checked ? [2] : []), ...(element('ally-medic').checked ? [3] : [])];
  action('strategy', () => { element('boss-plan').textContent = JSON.stringify({ bottomUp: boss.strategy(), backward: boss.backwardPlan() }, null, 2); });
  action('reform', () => { boss.reform(team()); showBoss(); });
  action('boss-check', () => {
    const view = boss.snapshot();
    if (view.stage !== 'exposed') throw Error('Remove the veto shield first.');
    const roll = 1 + Math.floor(Math.random() * 20);
    const check = M.skillCheck(roll, 1 + 4 * view.players[1].shapleyShubik, 3.4);
    element('boss-plan').textContent = JSON.stringify(check, null, 2);
    if (!check.success) { element('boss-summary').textContent = 'Skill roll failed; no XP awarded. Try again.'; return; }
    const result = boss.check(team());
    if (result.success) bossXp += result.xp;
    else throw Error('Selected team does not meet the post-shield critical-contribution check.');
    element('boss-plan').textContent = JSON.stringify({ check, result }, null, 2); showBoss();
  });
  action('boss-reset', () => { boss = UltraBoss.create(); bossXp = 0; showBoss(); element('boss-plan').textContent = ''; });
  action('resources', () => {
    offlineOnly();
    const generated = M.environment(registry.export());
    registry.replace(generated.scene); createWorld(); editMap();
    element('profile').textContent = JSON.stringify(generated.allocation, null, 2);
  });
  action('apply-scene', () => { offlineOnly(); registry.replace(S.migrateScene(S.parseJSON(element('scene-json').value))); createWorld(); editMap(); });
  action('export-scene', () => download('vessell-scene.json', JSON.stringify(registry.export(), null, 2)));
  action('save', () => { offlineOnly(); localStorage.setItem('vessell-engine-save-v2', S.encodeSave(registry.export(), world.position())); });
  action('load', () => {
    offlineOnly(); const text = localStorage.getItem('vessell-engine-save-v2');
    if (text === null) throw Error('No saved arena exists.');
    const save = S.decodeSave(text); registry.replace(save.scene); createWorld(save.player); editMap();
  });
  action('download', () => { offlineOnly(); download('vessell-save.json', S.encodeSave(registry.export(), world.position())); });
  element('save-file').onchange = async event => {
    try {
      offlineOnly(); const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) throw Error('Save too large.');
      const save = S.decodeSave(await file.text()); registry.replace(save.scene); createWorld(save.player); editMap();
    } catch (cause) { error(cause); }
  };
  action('sound', async () => {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    await audio.resume(); profile.measure('audioSchedule', () => E.tone(audio, 660, 0.2)); profile.count('tones');
  });
  function gameValues() {
    const preset = Games.examples()[element('encounter').value];
    const matrix = S.parseJSON(element('payoff-matrix').value);
    Games.analyze(matrix);
    if (matrix.length !== 2 || matrix[0].length !== 2) throw Error('Playable encounter needs a 2x2 matrix.');
    const game = { actions: preset.actions, matrix };
    const p = Number(element('player-prob').value), q = Number(element('npc-prob').value);
    return { game, p, q, analysis: Games.analyze(game.matrix), expected: Games.expected(game.matrix, [p, 1 - p], [q, 1 - q]) };
  }
  element('encounter').onchange = () => { element('payoff-matrix').value = JSON.stringify(Games.examples()[element('encounter').value].matrix, null, 2); };
  action('analyze-game', () => { element('game-output').textContent = JSON.stringify(gameValues(), null, 2); });
  action('play-game', () => {
    const { game, p, q, expected } = gameValues(), a = Math.random() < p ? 0 : 1, b = Math.random() < q ? 0 : 1;
    element('game-result').textContent = `You: ${game.actions[a]}; NPC: ${game.actions[b]}; payoff ${game.matrix[a][b].join(', ')}. Expected ${expected.map(value => value.toFixed(2)).join(', ')}.`;
  });
  action('tree-from-matrix', () => {
    const { game } = gameValues();
    element('decision-tree').value = JSON.stringify(Games.matrixTree(game.matrix, game.actions), null, 2);
  });
  action('solve-tree', () => {
    element('tree-output').textContent = JSON.stringify(Games.solveTree(S.parseJSON(element('decision-tree').value)), null, 2);
  });
  async function api(route, body, token = online?.token) {
    const response = await fetch(`/api/${route}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || `Server status ${response.status}`);
    return result;
  }
  action('join', async () => {
    if (online) throw Error('Already connected.');
    const current = ++generation, result = await api('join', { name: element('name').value }, null);
    if (current !== generation) return;
    online = { token: result.token }; sequence = 0; networkSnapshot = result; controls.clear(); editMap();
    const self = result.players.find(player => player.id === result.you);
    world = E.createWorld({ grid: result.scene.grid, x: self.x, y: self.y, angle: self.angle });
  });
  action('disconnect', () => { generation++; online = null; networkSnapshot = null; controls.clear(); createWorld(); editMap(); element('network').textContent = 'Offline. Server session expires after inactivity.'; });
  action('start-round', async () => { if (!online) throw Error('Join first.'); await api('round', { method: element('division').value }); });
  action('bid', async () => {
    if (!online || !networkSnapshot?.round) throw Error('Join an open reward cache first.');
    const indices = networkSnapshot.round.method === 'vickrey' ? [0] : [0, 1, 2];
    await api('bid', { roundId: networkSnapshot.round.id, values: indices.map(i => Number(element(`bid-${i}`).value)) });
  });
  const timer = setInterval(async () => {
    if (!online || networkBusy) return;
    const current = generation; networkBusy = true;
    try {
      await api('input', { ...controls.sample(), sequence: ++sequence });
      const result = await api('state');
      if (current !== generation) return;
      networkSnapshot = result;
      const self = result.players.find(player => player.id === result.you);
      world = E.createWorld({ grid: result.scene.grid, x: self.x, y: self.y, angle: self.angle });
      element('network').textContent = JSON.stringify(result, null, 2);
    } catch (cause) {
      if (current === generation) { generation++; online = null; networkSnapshot = null; createWorld(); editMap(); error(cause); }
    } finally { networkBusy = false; }
  }, 100);
  window.addEventListener('blur', () => { controls.clear(); last = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { controls.clear(); last = null; } });
  window.addEventListener('pagehide', () => { controls.dispose(); clearInterval(timer); if (audio) audio.close(); });
  createWorld(); editMap(); showBoss();
  element('decision-tree').value = JSON.stringify(Games.matrixTree(Games.examples().chicken.matrix, ['Yield', 'Charge']), null, 2);
  requestAnimationFrame(frame);
})();
