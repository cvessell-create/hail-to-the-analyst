// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Combat assists: dodge roll, raised weapon over low cover, surround pressure,
// healing drops, objective route hint and radar mini-map. Pure helpers; the
// game in index.html owns state and calls these each tick.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailCombat = api;
})(this, function () {
  'use strict';
  var ROLL = { time: 0.3, distance: 2.4, cooldown: 1.1 };
  var RAISE = { height: 0.95, speed: 0.6 };
  var SURROUND = { radius: 5, count: 3, still: 1.5, fireRate: 1.35 };
  var VIAL = { heal: 12, base: 0.18, lowHpBonus: 0.3 };
  var HINT_SECONDS = 8;

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  // Surrounded = enough close enemies and no open arc of half a circle to back into.
  function surround(player, enemies, radius) {
    radius = radius || SURROUND.radius;
    var angles = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) <= radius) angles.push(Math.atan2(e.y - player.y, e.x - player.x));
    }
    angles.sort(function (a, b) { return a - b; });
    var gap = angles.length ? 2 * Math.PI : 0;
    if (angles.length > 1) {
      gap = angles[0] + 2 * Math.PI - angles[angles.length - 1];
      for (var k = 1; k < angles.length; k++) gap = Math.max(gap, angles[k] - angles[k - 1]);
    }
    var escape = null;
    if (angles.length) {
      var start = angles.length > 1 ? angles[angles.length - 1] : angles[0];
      for (var j = 0; j < angles.length; j++) {
        var prev = j ? angles[j - 1] : angles[angles.length - 1] - 2 * Math.PI, g = angles[j] - prev;
        if (g >= gap - 1e-9) { start = prev; break; }
      }
      escape = wrap(start + gap / 2);
    }
    return { count: angles.length, gap: gap, escape: escape,
      surrounded: angles.length >= SURROUND.count && gap < Math.PI };
  }

  function canRoll(player) { return !(player.rollCd > 0) && !(player.rollT > 0); }
  function startRoll(player, dirAngle) {
    if (!canRoll(player)) return false;
    player.rollT = ROLL.time; player.rollCd = ROLL.cooldown; player.rollA = dirAngle;
    return true;
  }
  // Advances the roll; move(dx, dy) must apply collision. Returns true while invulnerable.
  function stepRoll(player, dt, move) {
    player.rollCd = Math.max(0, (player.rollCd || 0) - dt);
    if (!(player.rollT > 0)) return false;
    var t = Math.min(dt, player.rollT), d = ROLL.distance * t / ROLL.time;
    move(Math.cos(player.rollA) * d, Math.sin(player.rollA) * d);
    player.rollT -= t;
    return true;
  }
  function invulnerable(player) { return player.rollT > 0; }

  // Height the player's weapon and body are exposed at: raised clears low roofs/cover.
  function aimHeight(player) { return Math.max(player.height || 0, player.raised ? RAISE.height : 0); }

  // Standing still near enemies is punished: they reload faster.
  function enemyCooldownScale(player) { return (player.still || 0) > SURROUND.still ? 1 / SURROUND.fireRate : 1; }

  function vialChance(player) { return VIAL.base + VIAL.lowHpBonus * (1 - Math.max(0, Math.min(100, player.hp)) / 100); }

  function hint(snapshot, autopilot) {
    if (!snapshot || !autopilot || !autopilot.chooseGoal) return null;
    var goal = autopilot.chooseGoal(snapshot, autopilot.DEFAULT_PARAMS);
    if (!goal || !goal.path || goal.kind === 'idle') return null;
    return { kind: goal.kind, path: goal.path.map(function (p) { return { x: p.x + 0.5, y: p.y + 0.5 }; }), t: HINT_SECONDS };
  }

  var PICK_COLORS = { h: '#ff4a4a', k: '#ff4a4a', a: '#5e9bd0', b: '#d6a33c', s: '#cf3b2f', i: '#64ff58', r: '#ff3b30', q: '#3489f0', j: '#8ae7ff', v: '#ffc963' };
  // Radar centred on the player, rotated so facing is up.
  function radar(ctx, o) {
    var size = o.size || 132, range = o.range || 9, cx = o.x + size / 2, cy = o.y + size / 2, s = size / 2 / range;
    var p = o.player, head = o.heading == null ? p.a : o.heading, ca = Math.cos(-head - Math.PI / 2), sa = Math.sin(-head - Math.PI / 2);
    function at(x, y) { var dx = x - p.x, dy = y - p.y; return [cx + (dx * ca - dy * sa) * s, cy + (dx * sa + dy * ca) * s, Math.hypot(dx, dy)]; }
    ctx.save();
    if (o.round) {
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, 6.29);
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#0a3a1c'; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#3dff7a'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; ctx.clip();
      ctx.strokeStyle = 'rgba(61,255,122,.25)';
      [0.33, 0.66].forEach(function (k) { ctx.beginPath(); ctx.arc(cx, cy, size / 2 * k, 0, 6.29); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(cx - size / 2, cy); ctx.lineTo(cx + size / 2, cy); ctx.moveTo(cx, cy - size / 2); ctx.lineTo(cx, cy + size / 2); ctx.stroke();
    } else {
      ctx.globalAlpha = 0.88; ctx.fillStyle = '#050a08'; ctx.fillRect(o.x, o.y, size, size);
      ctx.globalAlpha = 1; ctx.strokeStyle = '#3d6a4c'; ctx.strokeRect(o.x, o.y, size, size);
    }
    var cell = Math.max(2, s);
    for (var y = Math.floor(p.y - range); y <= p.y + range; y++) for (var x = Math.floor(p.x - range); x <= p.x + range; x++) {
      var row = o.map[y], c = row && row[x];
      if (!c || c === '.') continue;
      var q = at(x + 0.5, y + 0.5);
      if (q[2] > range) continue;
      ctx.fillStyle = c === 'X' ? '#3dff6a' : c === 'R' ? '#a72a23' : c === 'B' ? '#2859a9' : c === 'D' ? '#2e8f80' : c === 'L' ? '#5a4252' : '#4a4d3f';
      ctx.fillRect(q[0] - cell / 2, q[1] - cell / 2, cell, cell);
    }
    if (o.hint) {
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.beginPath();
      var h0 = at(p.x, p.y); ctx.moveTo(h0[0], h0[1]);
      o.hint.path.forEach(function (pt) { var hp = at(pt.x, pt.y); ctx.lineTo(hp[0], hp[1]); });
      ctx.stroke(); ctx.lineWidth = 1;
    }
    (o.metros || []).forEach(function (m) {
      var q = at(m.x, m.y); if (q[2] > range) return;
      ctx.fillStyle = '#1a6dff'; ctx.fillRect(q[0] - 6, q[1] - 6, 12, 12);
      ctx.fillStyle = '#fff'; ctx.font = '900 10px Courier New'; ctx.textAlign = 'center'; ctx.fillText('M', q[0], q[1] + 4);
    });
    (o.pickups || []).forEach(function (k) {
      if (!k.alive) return; var q = at(k.x, k.y); if (q[2] > range) return;
      ctx.fillStyle = PICK_COLORS[k.type] || '#fff'; ctx.fillRect(q[0] - 2, q[1] - 2, 4, 4);
    });
    (o.enemies || []).forEach(function (e) {
      if (!e.alive) return; var q = at(e.x, e.y); if (q[2] > range) return;
      ctx.fillStyle = e.type === 'FABRICATOR' || e.type === 'STALKER' ? '#ffb020' : '#ff2d2d';
      ctx.beginPath(); ctx.arc(q[0], q[1], e.type === 'FABRICATOR' || e.type === 'STALKER' ? 4 : 2.5, 0, 6.29); ctx.fill();
    });
    if (o.round) {
      ctx.fillStyle = '#7dffb0'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx - 5, cy); ctx.fill();
    } else { ctx.fillStyle = '#ffce2e'; ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.fill(); }
    ctx.restore();
    if (o.label) {
      ctx.save(); ctx.font = '700 12px Courier New'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(5,12,8,.75)';
      ctx.fillRect(o.x - 6, o.y + size + 8, size + 12, 18); ctx.fillStyle = '#8affb0'; ctx.fillText(o.label, o.x, o.y + size + 21); ctx.restore();
    }
  }

  return { ROLL: ROLL, RAISE: RAISE, SURROUND: SURROUND, VIAL: VIAL, HINT_SECONDS: HINT_SECONDS,
    surround: surround, canRoll: canRoll, startRoll: startRoll, stepRoll: stepRoll, invulnerable: invulnerable,
    aimHeight: aimHeight, enemyCooldownScale: enemyCooldownScale, vialChance: vialChance, hint: hint, radar: radar };
});
