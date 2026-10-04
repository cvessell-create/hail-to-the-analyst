// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function () {
  'use strict';

  window.TacticalUI = {
    start: function (card, mission, jack, onBreach) {
      var battle = Tactics.createBattle(mission, jack);
      var selected = battle.jack;
      var weapon = 'sidearm';
      var notice = 'Select an Analyst, then a highlighted hex to move or an adjacent enemy to attack.';
      card.classList.add('tactical-card');

      function element(tag, text, className) {
        var node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
      }

      function button(text, action) {
        var node = element('button', text, 'chip');
        node.type = 'button';
        node.onclick = action;
        return node;
      }

      function render(focusHex) {
        card.replaceChildren();
        card.appendChild(element('h2', (mission ? 'PLANT' : 'ARCHIVE') + ' // TACTICAL APPROACH', 'kicker'));
        var sheet = battle.jack;
        var scores = Object.entries(sheet.abilityScores).map(function (entry) {
          return entry[0].slice(0, 3).toUpperCase() + ' ' + entry[1];
        }).join(' · ');
        card.appendChild(element('p', 'Jack Slade · Level ' + sheet.level + ' · XP ' + sheet.xp +
          ' · Proficiency +' + sheet.proficiency + ' · ' + scores, 'tactical-sheet'));
        card.appendChild(element('p', 'Round ' + battle.turn +
          ' · Reach the gold objective with Jack or defeat every Fabricator. Jack uses d20 vs AC; other units use terrain hit chance.', 'tactical-help'));

        var board = element('div', undefined, 'hex-board');
        board.setAttribute('role', 'group');
        board.setAttribute('aria-label', 'Tactical hex map');
        var reachable = battle.phase === 'player' && selected.hp > 0 ? Tactics.reachable(battle, selected) : [];
        var boardWidth = (battle.width - 1) * 45 + 60;
        var boardHeight = battle.height * 52 + 26;
        board.style.aspectRatio = boardWidth + '/' + boardHeight;
        for (var x = 0; x < battle.width; x++) {
          for (var y = 0; y < battle.height; y++) {
            (function (x, y) {
              var terrain = Tactics.terrainAt(battle, x, y);
              var unit = battle.units.find(function (u) { return u.hp > 0 && u.x === x && u.y === y; });
              var objective = battle.objective.x === x && battle.objective.y === y;
              var canMove = reachable.some(function (p) { return p.x === x && p.y === y; });
              var hex = button(unit ? unit.type === 'jack' ? 'J' : unit.side === 'analyst' ? 'A' : unit.name.split(' ').map(function (s) { return s[0]; }).join('') : objective ? '★' : '·', function () {
                if (battle.phase !== 'player') return;
                if (unit && unit.side === 'analyst') {
                  selected = unit;
                  notice = unit.name + ' selected.';
                } else if (unit) {
                  notice = Tactics.attack(battle, selected, unit, selected.type === 'jack' ? weapon : undefined) ?
                    'Combat resolved. Check the field log.' : 'Attack unavailable: approach an adjacent enemy, or end your turn.';
                } else {
                  notice = Tactics.move(battle, selected, x, y) ? 'Position updated.' : 'Hex unavailable: check movement, terrain, fear and zones of control.';
                }
                render([x, y]);
              });
              hex.className = 'hex' + (unit ? ' ' + unit.side : '') +
                (unit === selected ? ' selected' : '') + (canMove ? ' reachable' : '') + (objective ? ' objective' : '');
              hex.style.left = x * 45 / boardWidth * 100 + '%';
              hex.style.top = (y * 52 + (x % 2) * 26) / boardHeight * 100 + '%';
              hex.style.width = 60 / boardWidth * 100 + '%';
              hex.style.height = 52 / boardHeight * 100 + '%';
              hex.style.backgroundColor = terrain.color;
              hex.dataset.hex = x + ',' + y;
              var label = 'Hex ' + x + ',' + y + ': ' + terrain.name + ', defence ' + terrain.defense +
                '%, movement ' + terrain.cost + (objective ? ', breach objective' : '') +
                (unit ? ', ' + unit.name + ', HP ' + unit.hp + '/' + unit.maxHp : '') + (canMove ? ', reachable' : '');
              hex.setAttribute('aria-label', label);
              hex.title = label;
              board.appendChild(hex);
            })(x, y);
          }
        }
        card.appendChild(board);
        var hud = element('p', selected.name + ' · HP ' + selected.hp + '/' + selected.maxHp +
          ' · Level ' + selected.level + ' · Move ' + selected.moveRemaining + ' · ' +
          (selected.attacked ? 'Attack used' : 'Attack ready') + ' · Conditions: ' +
          (Object.keys(selected.conditions).join(', ') || 'none'), 'tactical-hud');
        hud.setAttribute('aria-live', 'polite');
        card.appendChild(hud);
        var controls = element('div', undefined, 'tactical-controls');
        if (battle.phase === 'player') {
          var label = element('label', 'Jack weapon: ');
          var select = element('select');
          ['sidearm', 'breacher', 'redactor'].forEach(function (name) {
            var option = element('option', name.toUpperCase());
            option.value = name;
            option.selected = name === weapon;
            select.appendChild(option);
          });
          select.onchange = function () { weapon = select.value; };
          label.appendChild(select);
          controls.appendChild(label);
          controls.appendChild(button('STAND UP', function () {
            notice = Tactics.stand(battle, selected) ? 'Standing.' : 'Cannot stand: not prone or insufficient movement.';
            render();
          }));
          controls.appendChild(button('END TURN', function () {
            Tactics.endTurn(battle);
            if (selected.hp <= 0) selected = battle.jack;
            notice = 'Fabricator turn resolved.';
            render();
          }));
        } else if (battle.phase === 'won') {
          var result = Tactics.handoff(battle);
          notice = 'Breach secured: +' + result.armor + ' armour, +' + result.bullets +
            ' bullets, +' + result.shells + ' shells; ' + result.extraEnemies + ' extra enemies from squad losses.';
          controls.appendChild(button('BREACH // LAUNCH FPS', function () {
            card.classList.remove('tactical-card');
            onBreach(result, battle.jack);
          }));
        } else {
          notice = 'Jack fell. Regroup and retry this tactical approach.';
          controls.appendChild(button('RETRY TACTICS', function () {
            window.TacticalUI.start(card, mission, jack, onBreach);
          }));
        }
        card.appendChild(controls);
        var status = element('p', notice, 'tactical-help');
        status.setAttribute('role', 'status');
        card.appendChild(status);
        var log = element('ol', undefined, 'tactical-log');
        log.setAttribute('aria-label', 'Combat log');
        battle.log.slice(-5).forEach(function (line) { log.appendChild(element('li', line)); });
        card.appendChild(log);
        if (focusHex) {
          var focused = board.querySelector('[data-hex="' + focusHex.join(',') + '"]');
          if (focused) focused.focus();
        }
      }
      render();
    }
  };
})();
