// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// GATEWAY SPRAWL: an original, stylised free-roam district inspired by public
// facts about St. Louis, Missouri urban form. Data and rules only; index.html
// owns gameplay and drawing. No maps, photos or text were copied; the layout is
// a schematic reinterpretation, not a street-accurate plan.
//
// SEARCH RECORD (2026-10-13; query / tool / results / primary opened / status)
// 1 Gateway Arch height, steel, catenary, riverfront, flood wall / web_search / 15 citations /
//   y: gatewayarch.com fact sheet (630 ft, 142 stainless sections, catenary) / VERIFIED
// 2 Eads Bridge, MetroLink, Laclede's Landing / web_search / 4 / y: Wikipedia Eads Bridge
//   (1867-1874, road+rail, between Laclede's Landing and Arch grounds) / VERIFIED
// 3 Numbered streets, Union Station, City Museum / web_search / 4 / y: Wikipedia Numbered
//   streets (N-S, 1st St at river), Union Station (1894, train shed), City Museum (former
//   International Shoe building, 1997) / VERIFIED
// 4 Soulard, The Hill, Cherokee St, Delmar Loop, Forest Park / web_search / 3 / y: Wikipedia
//   Soulard Farmers Market (1779), The Hill (Little Italy), Cherokee Street, Delmar Loop,
//   Forest Park (1,326 acres, 1904 Exposition) / VERIFIED
// 5 Brick city, brick theft, Pruitt-Igoe, brewery, MetroLink, I-70/I-64/I-44 / web_search / 8 /
//   y: STLPR 2010 brick theft, Wikipedia Pruitt-Igoe (occupied 1954, demolition from 1972),
//   Anheuser-Busch Brewery (1852, NHL district), MetroLink (2 lines), I-64/I-70/I-44 / VERIFIED
// 6 Flood wall length/gates, Hill hydrants / web_search / 6 / n (USACE 403) / WORKING
//   HYPOTHESIS: not used in game text.
// NOT checked: street-level accuracy, current business details, live transit status.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailGatewaySprawl = api;
})(this, function () {
  'use strict';
  var NAME = 'GATEWAY SPRAWL', W = 44, H = 32;
  // New wall tiles: J = stainless arch leg, E = river water. O/Q are city link gates (engine/city.js).
  var PALETTE = { J: '#D8E2EA', E: '#123A5A', O: '#E0794F', Q: '#35D0D0', S: '#FFB85C' };
  // Ordered most-specific first; the first zone containing the player wins.
  var ZONES = [
    { id: 'eads', name: 'EADS BRIDGE', x0: 37, y0: 3, x1: 42, y1: 5, text: 'Three steel arches from 1874. The light-rail deck still hums underneath.' },
    { id: 'memorial', name: 'PRUITT-IGOE SITE', x0: 12, y0: 1, x1: 19, y1: 7, quiet: true,
      text: 'Public housing first occupied in 1954; demolition began in 1972. Now an overgrown field. No patrols here. Remember the families who lived here.' },
    { id: 'riverfront', name: 'RIVERFRONT', x0: 34, y0: 1, x1: 36, y1: 30, text: 'The levee and flood wall hold the Mississippi back. The steel catenary arch towers overhead.' },
    { id: 'signal-exchange', name: 'SOUTHERN SIGNAL EXCHANGE', x0: 27, y0: 9, x1: 29, y1: 11,
      text: 'An optional kiosk holds fictional footprint records. This side exercise is training data, not a live scan.' },
    { id: 'landing', name: "LACLEDE'S LANDING", x0: 30, y0: 1, x1: 32, y1: 8, text: 'Cobblestone lanes and old brick warehouses, rewired with neon.' },
    { id: 'downtown', name: 'DOWNTOWN GRID', x0: 21, y0: 1, x1: 29, y1: 11, text: 'Numbered streets run north-south, counting up from the river.' },
    { id: 'north', name: 'NORTH CITY', x0: 11, y0: 1, x1: 20, y1: 11, text: 'Vacant lots and half-standing brick. Brick rustlers strip what the city left behind.' },
    { id: 'loop', name: 'DELMAR LOOP', x0: 1, y0: 1, x1: 9, y1: 9, text: 'Music clubs and neon storefronts along the Loop.' },
    { id: 'park', name: 'FOREST PARK', x0: 1, y0: 10, x1: 9, y1: 20, text: "A huge green park; the 1904 World's Fair pavilions glow in the trees." },
    { id: 'union', name: 'UNION STATION', x0: 11, y0: 14, x1: 20, y1: 20, text: 'An 1894 rail terminal. Its great train shed now shelters supply caches.' },
    { id: 'museum', name: 'CITY MUSEUM', x0: 21, y0: 14, x1: 25, y1: 20, text: 'An old shoe factory turned climbable art. Jet over the rooftop walls or use the side door.' },
    { id: 'brewery', name: 'OLD BREWHOUSE', x0: 26, y0: 14, x1: 32, y1: 20, text: 'Red-brick brewery blocks hiss with steam pipes.' },
    { id: 'hill', name: 'THE HILL', x0: 1, y0: 22, x1: 9, y1: 30, text: 'Tidy brick homes and family bakeries on high ground.' },
    { id: 'cherokee', name: 'CHEROKEE STREET', x0: 10, y0: 22, x1: 19, y1: 30, text: 'Murals, taquerias and antique shops under flickering signs.' },
    { id: 'soulard', name: 'SOULARD', x0: 20, y0: 22, x1: 32, y1: 30, text: "Dense red-brick rowhouses around the city's old market hall." }
  ];
  var CROSSINGS = [3, 12, 21, 29];   // underpasses through the rail fence and elevated highways
  var STATIONS = [[8, 4, 'DELMAR LOOP'], [38, 4, 'EADS BRIDGE'], [6, 11, 'FOREST PARK'], [17, 11, 'UNION STATION'], [26, 11, '8TH & PINE']];

  function build() {
    var g = [];
    for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.'); }
    function rect(x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) g[y][x] = c; }
    function box(x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (y === y0 || y === y1 || x === x0 || x === x1) g[y][x] = c; }
    function put(list) { list.forEach(function (p) { g[p[1]][p[0]] = p[2]; }); }

    // Mississippi, levee and flood wall with floodgates; the arch stands on the riverfront.
    rect(37, 1, 42, 30, 'E');
    rect(33, 1, 33, 30, 'C');
    put([[33, 4, '.'], [33, 9, 'D'], [33, 24, 'D']]);
    put([[35, 10, 'J'], [35, 18, 'J']]);
    // Eads Bridge: girder rails over the river, walkable deck, light-rail stop, city link at the east end.
    rect(37, 3, 42, 3, 'M'); rect(37, 5, 42, 5, 'M'); rect(37, 4, 42, 4, '.');
    put([[W - 1, 4, 'Q']]);

    // Laclede's Landing: brick warehouses on cobblestone lanes (rows 1, 4, 7 open).
    rect(30, 2, 32, 3, 'K'); rect(30, 5, 32, 6, 'K');
    put([[31, 3, 'Y']]);
    // Downtown grid: N-S numbered streets at x = 21, 25, 29; glass and brick blocks.
    [[22, 24], [26, 28]].forEach(function (cols, i) {
      [[2, 3], [5, 7]].forEach(function (rows, j) { rect(cols[0], rows[0], cols[1], rows[1], (i + j) % 2 ? 'K' : 'G'); });
    });
    // Elevated I-70 along the north-west edge of downtown, open at two underpasses.
    rect(10, 1, 10, 11, 'L'); put([[10, 4, '.'], [10, 9, '.']]);
    // North City: broken brick fragments around vacant lots.
    put([[12, 9, 'K'], [13, 9, 'K'], [12, 10, 'K'], [16, 9, 'K'], [19, 8, 'K'], [19, 9, 'K'], [20, 3, 'K'], [20, 4, 'K']]);
    // Pruitt-Igoe site: a quiet, overgrown field ringed by trees. No enemies are placed here.
    [[13, 2], [16, 2], [18, 2], [13, 5], [18, 5], [15, 6]].forEach(function (p) { g[p[1]][p[0]] = 'T'; });
    // Delmar Loop: neon storefront rows along an east-west boulevard (row 4).
    rect(2, 2, 4, 3, 'N'); rect(6, 2, 8, 3, 'N'); rect(2, 5, 4, 6, 'N'); rect(6, 5, 8, 6, 'N');

    // MetroLink: platform row 11, fenced rail right-of-way row 12, elevated I-64 row 13.
    rect(1, 12, 32, 12, 'H'); rect(1, 13, 32, 13, 'L');
    put([[28, 10, 'S']]);
    // Elevated I-44 along row 21.
    rect(1, 21, 32, 21, 'L');
    CROSSINGS.forEach(function (x) { g[12][x] = '.'; g[13][x] = '.'; g[21][x] = '.'; });

    // Forest Park: tree groves and a World's Fair pavilion.
    [[2, 15], [7, 15], [2, 19], [7, 19], [5, 17], [8, 10], [1, 10]].forEach(function (p) { g[p[1]][p[0]] = 'T'; });
    rect(4, 15, 5, 15, 'W');
    // Union Station: head house with a great train shed (walled courtyard, doors north and south).
    box(12, 15, 20, 19, 'W'); put([[16, 15, 'D'], [16, 19, 'D']]);
    // City Museum: low rooftop walls to jet over, plus a ground door so fuel never softlocks the player.
    box(22, 15, 25, 18, 'L'); put([[23, 18, 'D']]);
    // Old brewhouse: industrial block with a single door.
    box(27, 15, 31, 19, 'M'); put([[29, 19, 'D']]);

    // The Hill: brick homes with tree-lined streets.
    [[2, 23], [6, 23], [2, 27], [6, 27]].forEach(function (p) { rect(p[0], p[1], p[0] + 2, p[1] + 1, 'K'); });
    put([[5, 25, 'T'], [1, 25, 'T'], [9, 25, 'T']]);
    // Cherokee Street: neon storefronts lining an east-west street (row 26).
    rect(11, 24, 13, 25, 'N'); rect(15, 24, 18, 25, 'N'); rect(11, 27, 13, 28, 'N'); rect(15, 27, 18, 28, 'N');
    // Soulard: tight rowhouse strips and the market hall (doors west and north).
    [[21, 23], [25, 23], [21, 26], [21, 29]].forEach(function (p) { rect(p[0], p[1], p[0] + 2, p[1], 'K'); });
    rect(29, 23, 31, 23, 'K');
    box(25, 25, 31, 29, 'K'); put([[25, 27, 'D'], [28, 25, 'D']]);

    // Stations, spawn, supplies and patrols.
    STATIONS.forEach(function (s) { g[s[1]][s[0]] = 'U'; });
    put([[41, 4, 'P'], [40, 4, 'j'], [35, 6, 'v'], [31, 8, 'b'], [23, 9, 'h'], [14, 4, 'a'], [5, 4, 'v'],
      [4, 17, 'h'], [14, 17, 'b'], [18, 17, 'v'], [23, 16, 'i'], [24, 17, 'h'], [29, 17, 'a'],
      [6, 25, 'b'], [16, 26, 'h'], [27, 27, 'h'], [29, 28, 'v'], [36, 26, 'b']]);
    put([[27, 1, 'm'], [22, 10, 'd'], [35, 14, 'p'], [8, 8, 'm'], [18, 10, 'm'], [3, 18, 'p'],
      [11, 20, 'd'], [26, 20, 'm'], [8, 29, 'm'], [14, 29, 'p'], [24, 30, 'd'], [35, 28, 'm']]);
    return g.map(function (r) { return r.join(''); });
  }

  function level() {
    return {
      name: NAME, district: 'RIVERFRONT', city: true, sandbox: true, outdoor: true, theme: 'gateway', fx: 'neon-city',
      sky: ['#1a1838', '#e0794f'], floor: ['#5a4038', '#1d1414'],
      stops: STATIONS.slice().sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; }).map(function (s) { return s[2]; }),
      zones: ZONES.map(function (z) { return Object.assign({}, z); }),
      objective: 'Free roam. Explore the districts, enter the optional signal-exchange side quest, or return across the bridge.',
      brief: 'A river city of red brick under a steel arch. Cross the <b>EADS BRIDGE</b> deck, pass the <b>FLOOD WALL</b> gates to the riverfront, ' +
        'walk the numbered downtown grid and ride the <b>LIGHT RAIL</b> west to Forest Park and the Loop. The safehouse is in Laclede\'s Landing. ' +
        'An original stylised sector inspired by public facts about St. Louis; free roam never completes the campaign.',
      map: build()
    };
  }

  function zoneAt(lvl, x, y) {
    var list = (lvl && lvl.zones) || [], X = Math.floor(x), Y = Math.floor(y);
    for (var i = 0; i < list.length; i++) { var z = list[i]; if (X >= z.x0 && X <= z.x1 && Y >= z.y0 && Y <= z.y1) return z; }
    return null;
  }
  function sideQuestEntrance(tile) {
    return tile === 'S' ? { kind: 'sidequest', target: 'FOOTPRINT PURGE', label: 'FOOTPRINT PURGE' } : null;
  }

  // Sky silhouette: a stainless catenary arch over a low brick skyline, scrolling with view angle.
  function backdrop(ctx, w, h, angle, theme) {
    if (theme !== 'gateway') return;
    var offset = angle * 110, period = w * 2, base = h * 0.5;
    ctx.fillStyle = '#2b1a24';
    for (var n = -1; n < 16; n++) { var bx = ((n * 80 - offset * 0.6) % period + period) % period - 80; ctx.fillRect(bx, base - 18 - (n * 7 % 4) * 9, 58, h * 0.1); }
    var cx = ((w * 0.6 - offset) % period + period) % period - w * 0.5, half = w * 0.16, top = h * 0.1, k = 2, ck = Math.cosh(k);
    ctx.strokeStyle = '#d8e2ea'; ctx.lineWidth = 5; ctx.beginPath();
    for (var i = 0; i <= 40; i++) {
      var dx = -half + 2 * half * i / 40, y = base - (base - top) * (ck - Math.cosh(k * dx / half)) / (ck - 1);
      if (i === 0) ctx.moveTo(cx + dx, y); else ctx.lineTo(cx + dx, y);
    }
    ctx.stroke(); ctx.strokeStyle = 'rgba(127,216,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  return { NAME: NAME, W: W, H: H, PALETTE: PALETTE, ZONES: ZONES, STATIONS: STATIONS, CROSSINGS: CROSSINGS,
    level: level, build: build, zoneAt: zoneAt, backdrop: backdrop, sideQuestEntrance: sideQuestEntrance,
    scope: 'Original stylised sector inspired by public facts about St. Louis. Not a street-accurate map; free roam only.' };
});
