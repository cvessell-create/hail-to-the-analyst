// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
// The Stalker is a fictional vault guardian; this module contains only game rules/art.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailStalker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var TYPE = 'STALKER', HEALTH = 640, VOLLEY_COOLDOWN = 1.05, AIM_TELL = 0.5;

  function volley(enemy, player) {
    var angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    return [-0.34, 0, 0.34].map(function (offset) {
      var a = angle + offset;
      return {
        x: enemy.x, y: enemy.y, height: player.height || 0,
        vx: Math.cos(a) * 2.7, vy: Math.sin(a) * 2.7,
        t: 3.2, src: TYPE, damage: 13
      };
    });
  }

  function draw(ctx, size) {
    var s = size;
    ctx.fillStyle = '#121820';
    ctx.fillRect(-s * .25, s * .1, s * .5, s * .78);
    ctx.fillStyle = '#91a7ad';
    ctx.fillRect(-s * .34, s * .2, s * .68, s * .42);
    ctx.fillStyle = '#d1d8d2';
    ctx.fillRect(-s * .2, -s * .08, s * .4, s * .31);
    ctx.fillStyle = '#ff342d';
    ctx.fillRect(-s * .14, s * .03, s * .08, s * .055);
    ctx.fillRect(s * .06, s * .03, s * .08, s * .055);
    ctx.fillStyle = '#465b63';
    ctx.fillRect(-s * .5, s * .29, s * .2, s * .5);
    ctx.fillRect(s * .3, s * .29, s * .2, s * .5);
    ctx.fillRect(-s * .23, s * .76, s * .13, s * .25);
    ctx.fillRect(s * .1, s * .76, s * .13, s * .25);
    ctx.fillStyle = '#e5a34b';
    ctx.fillRect(-s * .4, s * .6, s * .8, s * .055);
  }

  return {
    TYPE: TYPE,
    HEALTH: HEALTH,
    VOLLEY_COOLDOWN: VOLLEY_COOLDOWN,
    AIM_TELL: AIM_TELL,
    volley: volley,
    draw: draw
  };
});
