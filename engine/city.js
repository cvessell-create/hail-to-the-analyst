// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Vessell City: an original free-roam hub that links campaign missions through
// in-world entrances. Data and rules only; index.html owns gameplay and drawing.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailCity = api;
})(this, function () {
  'use strict';
  var NAME = 'VESSELL CITY', W = 30, H = 22;
  // Tile letters unused by the mission maps. Entrances are solid; face one and press E.
  var ENTRANCES = {
    Y: { kind: 'safehouse', label: 'SAFEHOUSE' },
    A: { kind: 'mission', target: 'THE ARCHIVE', label: 'THE ARCHIVE' },
    Z: { kind: 'mission', target: 'FABRICATION PLANT', label: 'FABRICATION PLANT', needs: 'THE ARCHIVE' },
    V: { kind: 'mission', target: 'SKYLINE DISTRICT', label: 'SKYLINE DISTRICT', needs: 'FABRICATION PLANT' },
    // District gates are free-roam links between sandbox maps; they never count as cleared missions.
    O: { kind: 'district', target: 'GATEWAY SPRAWL', label: 'GATEWAY SPRAWL' },
    Q: { kind: 'district', target: NAME, label: NAME, home: 'GATEWAY SPRAWL' }
  };
  var PALETTE = { K: '#8A4B3A', G: '#9AA0A6', W: '#E8E0C8', M: '#5A6B7A', Y: '#FFC76A', A: '#35D0D0', Z: '#5A6B7A', V: '#101826', U: '#F5A623', O: '#E0794F', Q: '#35D0D0' };
  var STOPS = ['CENTRAL', 'ARCHIVE'];

  function build() {
    var g = [];
    for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.'); }
    function rect(x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) g[y][x] = c; }
    function put(list) { list.forEach(function (p) { g[p[1]][p[0]] = p[2]; }); }
    rect(1, 1, 6, 5, 'K');            // Safehouse (Downtown brick)
    rect(9, 1, 12, 4, 'K');           // Downtown shops
    rect(20, 1, 28, 6, 'G');          // Skyline towers
    rect(2, 14, 11, 20, 'W');         // The Archive
    rect(18, 14, 28, 20, 'M');        // Fabrication Plant
    put([[4, 5, 'Y'], [24, 6, 'V'], [6, 14, 'A'], [23, 14, 'Z'], [0, 11, 'O']]); // O: west gate to Gateway Sprawl
    put([[8, 7, 'U'], [13, 16, 'U']]); // Metro Central -> Archive stop (row-major order matches STOPS)
    put([[4, 7, 'P']]);
    put([[11, 9, 'L'], [16, 9, 'L'], [19, 11, 'L'], [9, 12, 'L'], [26, 10, 'L']]); // planters / parked cars
    put([[15, 10, 'm'], [22, 11, 'm'], [16, 18, 'd'], [27, 8, 'm']]);             // roaming patrols
    put([[14, 8, 'h'], [17, 12, 'b'], [14, 20, 'i'], [2, 9, 's']]);
    return g.map(function (r) { return r.join(''); });
  }

  function level() {
    return {
      name: NAME, district: 'DOWNTOWN GRID', city: true, outdoor: true, theme: 'gateway', fx: 'neon-city', stops: STOPS.slice(),
      objective: 'Free roam. Walk to a district entrance and press E to enter.',
      brief: 'Vessell City links the operations through one walkable hub. The <b>SAFEHOUSE</b> door restores health and saves your hero. ' +
        '<b>METRO CENTRAL</b> rides to the Archive stop for free. Face a district entrance and press <b>E</b>: The Archive is open; ' +
        'clearing it opens the Fabrication Plant, and clearing the Plant opens the Skyline District. The west-edge <b>GATEWAY SPRAWL</b> gate leads to the riverfront sandbox and its optional footprint side quest. City runs are free roam: they never complete the campaign.',
      map: build()
    };
  }

  function entrance(tile) { return ENTRANCES[tile] || null; }

  // Returns {ok, reason}. `cleared` is a list of mission names.
  function access(tile, cleared) {
    var e = entrance(tile);
    if (!e) return { ok: false, reason: 'NOT AN ENTRANCE.' };
    if (e.needs && (cleared || []).indexOf(e.needs) < 0) return { ok: false, reason: e.label + ' LOCKED: CLEAR ' + e.needs + ' FIRST.' };
    return { ok: true, entrance: e };
  }

  function sanitizeCleared(raw) {
    var known = Object.keys(ENTRANCES).filter(function (k) { return ENTRANCES[k].kind === 'mission'; }).map(function (k) { return ENTRANCES[k].target; }), out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (n) { if (known.indexOf(n) >= 0 && out.indexOf(n) < 0) out.push(n); });
    return out;
  }

  // World-space entrance signs (tile centers). Metro signs come from the parsed stations.
  function signs(map, cleared) {
    var out = [];
    for (var y = 0; y < map.length; y++) for (var x = 0; x < map[y].length; x++) {
      var c = map[y][x], e = ENTRANCES[c];
      if (e) { var a = access(c, cleared); out.push({ x: x + 0.5, y: y + 0.5, tile: c, label: e.label, locked: !a.ok, color: PALETTE[c] }); }
    }
    return out;
  }
  function stopName(level, i) { return level && level.stops && level.stops[i] ? level.stops[i] : 'M' + (i + 1); }

  return { NAME: NAME, ENTRANCES: ENTRANCES, PALETTE: PALETTE, STOPS: STOPS, level: level, entrance: entrance,
    access: access, sanitizeCleared: sanitizeCleared, signs: signs, stopName: stopName,
    scope: 'Original fictional city. Free roam never completes the campaign; in-game credits only.' };
});
