// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function (root) {
  'use strict';
  var active = null;
  var height = Math.sqrt(3);

  // Flat-top, odd-column-down hexes: all six neighbours are sqrt(3) apart.
  function world(hex) {
    return { x: hex.x * 1.5, y: height * (hex.y + (hex.x & 1) / 2) };
  }
  function polygon(hex) {
    var center = world(hex);
    return Array.from({ length: 6 }, function (_, i) {
      return { x: center.x + Math.cos(i * Math.PI / 3), y: center.y + Math.sin(i * Math.PI / 3) };
    });
  }
  function edges(points) {
    return points.map(function (p, i) { return [p, points[(i + 1) % points.length]]; });
  }
  function sceneFor(battle, angle, weapon, selected, destination) {
    var camera = Object.assign(world(battle.jack), { a: angle, weapon: ['sidearm', 'breacher', 'redactor'].indexOf(weapon), bob: 0, kick: 0 });
    var tiles = [], walls = [];
    for (var y = 0; y < battle.height; y++) for (var x = 0; x < battle.width; x++) {
      var terrain = Tactics.terrainAt(battle, x, y), points = polygon({ x: x, y: y });
      tiles.push({ points: points, color: terrain.color });
      if (terrain.cost === Infinity) walls = walls.concat(edges(points));
    }
    walls = walls.concat(edges([
      { x: -1.1, y: -height / 2 - .1 }, { x: battle.width * 1.5, y: -height / 2 - .1 },
      { x: battle.width * 1.5, y: battle.height * height },
      { x: -1.1, y: battle.height * height }
    ]));
    var reachable = battle.phase === 'player' ? Tactics.reachable(battle, selected) : [];
    var sprites = battle.units.filter(function (u) { return u !== battle.jack && u.hp > 0; }).map(function (u) {
      return { o: Object.assign(world(u), { type: u.type === 'troll' ? 'TROLL' : u.type === 'drone' ? 'DRONE' : 'MOLE',
        alive: true, side: u.side, color: u.color, label: (u === selected ? 'COMMAND: ' : '') + u.name + ' HP ' + u.hp, unit: u }), kind: 'enemy' };
    });
    sprites.push({ o: Object.assign(world(battle.objective), { type: 'i', bob: 0, label: 'BREACH OBJECTIVE' }), kind: 'pick' });
    reachable.forEach(function (p) {
      sprites.push({ o: Object.assign(world(p), {
        label: destination && destination.x === p.x && destination.y === p.y ? 'MOVE ' + p.x + ',' + p.y : '', hex: p
      }), kind: 'move' });
    });
    return {
      camera: camera, tiles: tiles, sprites: sprites,
      castRay: function (a) {
        var dx = Math.cos(a), dy = Math.sin(a), nearest = 100, texture = 0;
        walls.forEach(function (edge) {
          var p = edge[0], ex = edge[1].x - p.x, ey = edge[1].y - p.y;
          var denominator = dx * ey - dy * ex;
          if (Math.abs(denominator) < 1e-9) return;
          var px = p.x - camera.x, py = p.y - camera.y;
          var t = (px * ey - py * ex) / denominator, u = (px * dy - py * dx) / denominator;
          if (t > 0 && u >= 0 && u <= 1 && t < nearest) { nearest = t; texture = u; }
        });
        return { distance: nearest * Math.cos(a - camera.a), cell: 'M', side: 0, texture: texture };
      }
    };
  }

  root.TacticalUI = {
    world: world, polygon: polygon, sceneFor: sceneFor,
    scene: function () { return active && active.scene(); },
    start: function (card, mission, jack, onBreach, canvas) {
      if (active) active.dispose();
      var battle = Tactics.createBattle(mission, jack), selected = battle.jack, weapon = 'sidearm';
      var angle = 0, destination = null, target = null, held = {}, drag = null;
      var notice = 'Plan through Jack’s eyes. Choose a move or target; enemies act only on END TURN.';
      card.classList.add('tactical-card');
      function element(tag, text, className) {
        var node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
      }
      function button(text, action, disabled) {
        var node = element('button', text, 'chip');
        node.type = 'button'; node.onclick = action; node.disabled = !!disabled;
        node.onkeydown = function (e) { if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) e.preventDefault(); };
        return node;
      }
      function choice(parent, text, entries, current, change) {
        var label = element('label', text), select = element('select');
        select.setAttribute('aria-label', text);
        entries.forEach(function (entry) {
          var option = element('option', entry.text);
          option.value = entry.value; option.selected = entry.value === current;
          select.appendChild(option);
        });
        select.value = current;
        select.onchange = function () { change(select.value); render(); };
        label.appendChild(select); parent.appendChild(label);
      }
      function move(p) {
        notice = p && Tactics.move(battle, selected, p.x, p.y) ? 'Position updated.' : 'Move unavailable: terrain, occupancy, conditions or movement budget.';
        destination = null; render();
      }
      function attack() {
        notice = target && Tactics.attack(battle, selected, target, selected === battle.jack ? weapon : undefined) ?
          'Combat resolved. Check the field log.' : 'Attack unavailable: check range, conditions and attack budget.';
        render();
      }
      function endTurn() {
        Tactics.endTurn(battle);
        if (selected.hp <= 0) selected = battle.jack;
        destination = null; notice = 'Fabricator turn resolved.'; render();
      }
      function face(p) {
        var position = world(p), origin = world(battle.jack);
        angle = Math.atan2(position.y - origin.y, position.x - origin.x);
      }
      function render() {
        var focused = document.activeElement;
        var focusLabel = focused && focused.getAttribute('aria-label');
        var focusText = focused && focused.tagName === 'BUTTON' ? focused.textContent : null;
        card.replaceChildren();
        card.appendChild(element('h2', (mission ? 'PLANT' : 'ARCHIVE') + ' // JACK’S EYES // ROUND ' + battle.turn, 'kicker'));
        var sheet = battle.jack;
        card.appendChild(element('p', 'Jack Slade · Level ' + sheet.level + ' · XP ' + sheet.xp + ' · Proficiency +' + sheet.proficiency +
          ' · ' + Object.entries(sheet.abilityScores).map(function (e) { return e[0].slice(0, 3).toUpperCase() + ' ' + e[1]; }).join(' · '), 'tactical-sheet'));
        var hud = element('p', 'Command: ' + selected.name + ' · HP ' + selected.hp + '/' + selected.maxHp + ' · Move ' +
          selected.moveRemaining + ' · ' + (selected.attacked ? 'Attack used' : 'Attack ready') + ' · Conditions: ' +
          (Object.keys(selected.conditions).join(', ') || 'none') + ' · Terrain: ' + Tactics.terrainAt(battle, selected.x, selected.y).name +
          (selected.ability ? ' · ' + selected.ability : ''), 'tactical-hud');
        hud.setAttribute('aria-live', 'polite'); card.appendChild(hud);
        var controls = element('div', undefined, 'tactical-controls');
        controls.appendChild(button('LOOK LEFT [←]', function () { angle -= Math.PI / 6; }));
        controls.appendChild(button('LOOK RIGHT [→]', function () { angle += Math.PI / 6; }));
        if (battle.phase === 'player') {
          choice(controls, 'Command unit', battle.units.filter(function (u) { return u.side === 'analyst' && u.hp > 0; }).map(function (u) {
            return { text: u.name, value: u.id };
          }), selected.id, function (id) { selected = battle.units.find(function (u) { return u.id === id; }); destination = null; });
          choice(controls, 'Jack weapon', Object.keys(Tactics.weapons).map(function (w) { return { text: w.toUpperCase(), value: w }; }),
            weapon, function (w) { weapon = w; });
          var moves = Tactics.reachable(battle, selected);
          if (!moves.some(function (p) { return destination && p.x === destination.x && p.y === destination.y; })) destination = null;
          choice(controls, 'Destination', [{ text: 'Choose terrain…', value: '' }].concat(moves.map(function (p) {
            var tile = Tactics.terrainAt(battle, p.x, p.y);
            return { text: p.x + ',' + p.y + ' ' + tile.name + ' · defence ' + tile.defense + '% · cost ' + tile.cost, value: p.x + ',' + p.y };
          })), destination ? destination.x + ',' + destination.y : '', function (v) {
            destination = moves.find(function (p) { return p.x + ',' + p.y === v; });
            if (destination) face(destination);
          });
          controls.appendChild(button('MOVE', function () { move(destination); }, !destination));
          var enemies = battle.units.filter(function (u) { return u.side === 'fabricator' && u.hp > 0; });
          if (!enemies.includes(target)) target = null;
          choice(controls, 'Target', [{ text: 'Choose hostile…', value: '' }].concat(enemies.map(function (u) {
            return { text: u.name + ' · HP ' + u.hp + ' · range ' + Tactics.hexDistance(selected, u), value: u.id };
          })), target ? target.id : '', function (id) { target = enemies.find(function (u) { return u.id === id; }); if (target) face(target); });
          controls.appendChild(button('ATTACK [SPACE]', attack, !target || selected.attacked));
          controls.appendChild(button('STAND UP', function () {
            notice = Tactics.stand(battle, selected) ? 'Standing.' : 'Cannot stand: not prone or insufficient movement.'; render();
          }));
          controls.appendChild(button('END TURN [E]', endTurn));
        } else if (battle.phase === 'won') {
          var result = Tactics.handoff(battle);
          notice = 'Breach secured: +' + result.armor + ' armour, +' + result.bullets + ' bullets, +' + result.shells + ' shells; ' +
            result.extraEnemies + ' extra enemies from squad losses.';
          controls.appendChild(button('BREACH // LAUNCH FPS', function () {
            active.dispose(); active = null; card.classList.remove('tactical-card'); onBreach(result, battle.jack);
          }));
        } else {
          notice = 'Jack fell. Regroup and retry this tactical approach.';
          controls.appendChild(button('RETRY TACTICS', function () { root.TacticalUI.start(card, mission, jack, onBreach, canvas); }));
        }
        card.appendChild(controls);
        var status = element('p', notice, 'tactical-help');
        status.setAttribute('role', 'status'); card.appendChild(status);
        var details = element('details'), summary = element('summary', 'Orders & combat log');
        details.appendChild(summary);
        details.appendChild(element('p', 'Drag the view or use arrows to look freely. WASD: one adjacent move per press for the commanded unit. Space: chosen target. E: END TURN. Tab/Enter: controls. Reach the objective with Jack or defeat every hostile. Jack rolls d20 vs AC; others use terrain hit chance.', 'tactical-help'));
        var log = element('ol', undefined, 'tactical-log');
        log.setAttribute('aria-label', 'Combat log');
        battle.log.slice(-5).forEach(function (line) { log.appendChild(element('li', line)); });
        details.appendChild(log); card.appendChild(details);
        if (focusLabel || focusText) {
          Array.from(card.querySelectorAll('select,button')).some(function (node) {
            if ((focusLabel && node.getAttribute('aria-label') === focusLabel) || (focusText && node.textContent === focusText)) {
              node.focus(); return true;
            }
            return false;
          });
        }
      }
      function keydown(e) {
        if (/^(INPUT|SELECT|BUTTON|SUMMARY)$/.test((e.target || {}).tagName)) return;
        if (!['ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE'].includes(e.code)) return;
        e.preventDefault();
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { angle += (e.code === 'ArrowLeft' ? -1 : 1) * Math.PI / 18; return; }
        if (e.repeat || held[e.code]) return;
        held[e.code] = true;
        if (battle.phase !== 'player') return;
        if (e.code === 'Space') attack();
        else if (e.code === 'KeyE') endTurn();
        else {
          var a = angle + ({ KeyW: 0, KeyS: Math.PI, KeyA: -Math.PI / 2, KeyD: Math.PI / 2 })[e.code];
          var origin = world(selected);
          var adjacent = Tactics.neighbors(selected).sort(function (p, q) {
            function alignment(h) { var w = world(h); return (w.x - origin.x) * Math.cos(a) + (w.y - origin.y) * Math.sin(a); }
            return alignment(q) - alignment(p);
          });
          move(adjacent[0]);
        }
      }
      function keyup(e) { delete held[e.code]; }
      function blur() { held = {}; drag = null; }
      function pointerdown(e) { canvas.focus(); drag = { id: e.pointerId, x: e.clientX }; canvas.setPointerCapture(e.pointerId); }
      function pointermove(e) { if (drag && drag.id === e.pointerId) { angle += (e.clientX - drag.x) * .006; drag.x = e.clientX; } }
      function pointerup() { drag = null; }
      window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
      if (canvas) {
        canvas.addEventListener('pointerdown', pointerdown); canvas.addEventListener('pointermove', pointermove);
        canvas.addEventListener('pointerup', pointerup); canvas.addEventListener('pointercancel', pointerup);
      }
      active = {
        scene: function () { return sceneFor(battle, angle, weapon, selected, destination); },
        dispose: function () {
          window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
          if (canvas) {
            canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove);
            canvas.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointerup);
          }
        }
      };
      render();
    }
  };
})(globalThis);
