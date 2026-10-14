// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Optional Three.js world renderer. Gameplay, collision, sprites and HUD stay in
// index.html; this only draws walls, roofs, doors, floor and exits, using a
// camera whose projection matches the raycaster so 2D sprites still line up.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailThreeView = api;
})(this, function () {
  'use strict';
  var EYE = 0.5, LIFT = 0.25, ROOF_FRAC = 0.7, DOORS = 'DRB';
  var COLORS = { '#': [90, 93, 76], I: [135, 195, 230], N: [115, 36, 127], C: [188, 145, 101], T: [65, 114, 72],
    M: [77, 91, 93], S: [18, 29, 28], H: [235, 170, 20], R: [190, 35, 30], B: [30, 100, 210], D: [42, 110, 100],
    X: [35, 150, 48], L: [104, 78, 96],
    // Vessell City tiles: brick, concrete/glass towers, archive paper, safehouse, archive, plant, skyline entrances.
    K: [138, 75, 58], G: [154, 160, 166], W: [232, 224, 200], Y: [255, 199, 106], A: [53, 208, 208], Z: [90, 107, 122], V: [16, 24, 38] };
  var GLOW = { N: 0.35, S: 0.25, R: 0.2, B: 0.2, D: 0.15, X: 0.6, Y: 0.35, A: 0.45, Z: 0.25, V: 0.3 };
  // Isometric-only block heights so the city skyline reads; the first-person view stays uniform.
  var ISO_HEIGHT = { L: 0.5, G: 2.2, W: 1.3, M: 1.2, K: 1.1 };

  function layout(map) {
    var walls = {}, doors = [], exits = [];
    for (var y = 0; y < map.length; y++) for (var x = 0; x < map[y].length; x++) {
      var c = map[y][x];
      if (c === '.') continue;
      if (c === 'X') { exits.push([x, y]); continue; }
      if (DOORS.indexOf(c) >= 0) { doors.push({ x: x, y: y, tile: c }); continue; }
      var key = COLORS[c] ? c : '#';
      (walls[key] = walls[key] || []).push([x, y]);
    }
    return { walls: walls, doors: doors, exits: exits, w: map[0].length, h: map.length };
  }
  function heightOf(tile) { return tile === 'L' ? ROOF_FRAC : 1; }

  // Raycaster: screen x = W/2 + tan(a)/tan(FOV/2)*W/2 and a unit wall at depth d
  // spans H/d pixels, so focal lengths differ per axis; aspect absorbs that.
  function camera(player, W, H, FOV) {
    var tanH = Math.tan(FOV / 2), tanV = (H / 2) / H;
    return { x: player.x, y: EYE + LIFT * (player.height || 0), z: player.y, yaw: player.a,
      fov: 2 * Math.atan(tanV) * 180 / Math.PI, aspect: tanH / tanV };
  }

  function theme(level) {
    var city = level && level.theme === 'city', outdoor = Boolean(level && level.outdoor);
    return { outdoor: outdoor, fog: outdoor ? (city ? 0xc78391 : 0xb9d8ed) : 0x0b1210,
      floor: outdoor ? (city ? 0x4a3a4c : 0x5b7387) : 0x2b2c24, ceiling: 0x141a17,
      sky: city ? 0x8d7cff : outdoor ? 0xcfe6ff : 0x6e7d6a, ground: outdoor ? 0x3a3140 : 0x1a1c16 };
  }

  function texture(THREE, doc, tile) {
    if (!doc || !doc.createElement) return null;
    var cv = doc.createElement('canvas'), g = cv.getContext && cv.getContext('2d');
    if (!g) return null;
    cv.width = cv.height = 32;
    var rgb = COLORS[tile] || COLORS['#'], css = function (k) {
      return 'rgb(' + Math.min(255, rgb[0] * k | 0) + ',' + Math.min(255, rgb[1] * k | 0) + ',' + Math.min(255, rgb[2] * k | 0) + ')';
    };
    g.fillStyle = css(1); g.fillRect(0, 0, 32, 32);
    g.fillStyle = css(0.7); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
    if (tile === 'H') { g.fillStyle = '#242218'; for (var i = -32; i < 32; i += 8) { g.beginPath(); g.moveTo(i, 32); g.lineTo(i + 4, 32); g.lineTo(i + 36, 0); g.lineTo(i + 32, 0); g.fill(); } }
    else if (tile === 'M') { g.fillStyle = css(1.9); g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32); g.fillRect(0, 15, 32, 2); }
    else if (tile === 'C') { g.fillStyle = css(0.75); for (var r = 0; r < 32; r += 8) { g.fillRect(0, r, 32, 1); g.fillRect((r / 8) % 2 ? 8 : 24, r, 1, 8); } }
    else if (tile === 'S') { g.fillStyle = '#30d246'; for (var k = 0; k < 6; k++) g.fillRect((k * 11) % 30, (k * 7) % 30, 2, 2); }
    else if (tile === 'N') { g.fillStyle = '#ff55c4'; g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32); }
    else if (tile === 'I') { g.fillStyle = '#dcf4ff'; g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32); }
    else if (tile === 'L') { g.fillStyle = css(1.45); g.fillRect(0, 0, 32, 2); g.fillRect(0, 16, 32, 1); }
    else if (tile === 'K') { g.fillStyle = css(0.7); for (var br = 0; br < 32; br += 6) { g.fillRect(0, br, 32, 1); g.fillRect((br / 6) % 2 ? 6 : 20, br, 1, 6); } }
    else if (tile === 'G' || tile === 'V') { g.fillStyle = '#ffc76a'; for (var wy = 4; wy < 30; wy += 8) for (var wx = 4; wx < 30; wx += 8) if ((wx * 3 + wy) % 5) g.fillRect(wx, wy, 4, 4); }
    else if (tile === 'W') { g.fillStyle = '#35d0d0'; g.fillRect(0, 12, 32, 3); g.fillStyle = css(0.8); g.fillRect(4, 18, 4, 10); g.fillRect(14, 18, 4, 10); g.fillRect(24, 18, 4, 10); }
    else if (tile === 'Y' || tile === 'A' || tile === 'Z') { g.fillStyle = css(0.45); g.fillRect(8, 6, 16, 26); g.fillStyle = css(1.6); g.fillRect(8, 2, 16, 3); }
    else if (DOORS.indexOf(tile) >= 0) { g.fillStyle = tile === 'R' ? '#ff7666' : tile === 'B' ? '#66baff' : '#7bffe0'; g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32); g.fillRect(0, 2, 32, 2); g.fillRect(22, 14, 4, 5); }
    var t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function material(THREE, doc, tile) {
    var rgb = COLORS[tile] || COLORS['#'], color = new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    var map = texture(THREE, doc, tile);
    var m = new THREE.MeshLambertMaterial({ color: map ? 0xffffff : color, map: map || null });
    if (GLOW[tile]) { m.emissive = color.clone(); m.emissiveIntensity = GLOW[tile]; }
    return m;
  }

  function create(THREE, options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    var W = options.W || 960, H = options.H || 540, FOV = options.fov || Math.PI / 3;
    var renderer = options.renderer || new THREE.WebGLRenderer({ canvas: options.canvas || undefined, antialias: false, alpha: true });
    if (renderer.setPixelRatio) renderer.setPixelRatio(1);
    if (renderer.setSize) renderer.setSize(options.width || W / 2, options.height || H / 2, false);
    if (renderer.setClearColor) renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, 0.02, 80);
    var world = null, lastMap = null, doorMeshes = [], exitMats = [], counts = {};
    var hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.4), torch = new THREE.PointLight(0xfff1d0, 2.2, 9, 1);
    scene.add(hemi); scene.add(new THREE.AmbientLight(0xffffff, 0.45)); scene.add(torch);

    function dispose(obj) {
      obj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
    }
    function build(map, level) {
      if (world) { scene.remove(world); dispose(world); }
      world = new THREE.Group(); doorMeshes = []; exitMats = []; counts = {};
      var plan = layout(map), th = theme(level), m4 = new THREE.Matrix4();
      Object.keys(plan.walls).forEach(function (tile) {
        var cells = plan.walls[tile], h = heightOf(tile), geo = new THREE.BoxGeometry(1, h, 1);
        var mesh = new THREE.InstancedMesh(geo, material(THREE, doc, tile), cells.length);
        cells.forEach(function (c, i) { mesh.setMatrixAt(i, m4.makeTranslation(c[0] + 0.5, h / 2, c[1] + 0.5)); });
        mesh.instanceMatrix.needsUpdate = true; counts[tile] = cells.length; world.add(mesh);
      });
      plan.doors.forEach(function (d) {
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material(THREE, doc, d.tile));
        mesh.position.set(d.x + 0.5, 0.5, d.y + 0.5); mesh.userData = d; doorMeshes.push(mesh); world.add(mesh);
      });
      plan.exits.forEach(function (e) {
        var mat = new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.75 });
        var pad = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
        pad.rotation.x = -Math.PI / 2; pad.position.set(e[0] + 0.5, 0.01, e[1] + 0.5); exitMats.push(mat); world.add(pad);
      });
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(plan.w, plan.h), new THREE.MeshLambertMaterial({ color: th.floor }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(plan.w / 2, 0, plan.h / 2); world.add(floor);
      if (!th.outdoor) {
        var ceil = new THREE.Mesh(new THREE.PlaneGeometry(plan.w, plan.h), new THREE.MeshLambertMaterial({ color: th.ceiling }));
        ceil.rotation.x = Math.PI / 2; ceil.position.set(plan.w / 2, 1, plan.h / 2); world.add(ceil);
      }
      scene.fog = new THREE.Fog(th.fog, 3, 19);
      hemi.color.setHex(th.sky); hemi.groundColor.setHex(th.ground);
      scene.add(world); lastMap = map;
    }
    function sync(state) {
      if (state.map !== lastMap) build(state.map, state.level);
      doorMeshes.forEach(function (m) {
        var d = m.userData, row = state.map[d.y];
        m.visible = Boolean(row) && DOORS.indexOf(row[d.x]) >= 0;
      });
      var pulse = 0.55 + 0.3 * Math.sin((state.time || 0) * 4);
      exitMats.forEach(function (m) { m.opacity = pulse; });
      var c = camera(state.player, W, H, FOV);
      cam.fov = c.fov; cam.aspect = c.aspect; cam.updateProjectionMatrix();
      cam.position.set(c.x, c.y, c.z);
      cam.lookAt(c.x + Math.cos(c.yaw), c.y, c.z + Math.sin(c.yaw));
      torch.position.set(c.x, c.y, c.z);
      return c;
    }
    function render(state) {
      sync(state);
      renderer.render(scene, cam);
      return renderer.domElement;
    }
    return { render: render, sync: sync, scene: scene, camera: cam, renderer: renderer,
      stats: function () { return { walls: Object.assign({}, counts), doors: doorMeshes.filter(function (m) { return m.visible; }).length, exits: exitMats.length }; },
      dispose: function () { if (world) dispose(world); if (renderer.dispose) renderer.dispose(); } };
  }


  // Isometric top-down mode: fixed orthographic camera offset, neon point lights
  // pooled near the player, floor rings, enemy aim lasers and a shield dome.
  var ISO_OFFSET = [-10, 15, -10], ISO_VIEW = 6.2, SQ = Math.SQRT1_2;
  var RING = { player: 0x3dff7a, ally: 0x3d9bff, enemy: 0xff3030, boss: 0xffb020 };
  var NEON = { N: 0xff3cc8, S: 0x30ff9a, R: 0xff3020, B: 0x3080ff, D: 0x30ffd8, X: 0x5dff7a, I: 0x9fe8ff, Y: 0xffc76a, A: 0x35d0d0, Z: 0x6fa8ff, V: 0xffc76a };
  var BODY = { DRONE: 0x8fa6b8, TROLL: 0xb04a3a, MOLE: 0x7a5a3a, ICE_PIG: 0xbfe6ff, FABRICATOR: 0xd08a20 };
  var PICK = { h: 0xff3a3a, k: 0xff4a4a, a: 0x6fb8ff, b: 0xffd27a, s: 0xffb04a, y: 0xffe030, n: 0x30a0ff, u: 0x40ff90,
    i: 0x71ff4e, r: 0xff3b30, q: 0x3489f0, j: 0xc0c0c0, v: 0xffa040 };
  // Screen-relative movement: up = +x+y, right = -x+y in game coordinates.
  function isoMove(f, s) { return { x: (f - s) * SQ, y: (f + s) * SQ }; }
  function isoAngle(px, py, tx, ty) { return Math.atan2(ty - py, tx - px); }
  var ISO_HEADING = Math.PI / 4;

  function floorTexture(THREE, doc, tint) {
    if (!doc || !doc.createElement) return null;
    var cv = doc.createElement('canvas'), g = cv.getContext && cv.getContext('2d');
    if (!g) return null;
    cv.width = cv.height = 64;
    g.fillStyle = tint; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(31, 0, 1, 64); g.fillRect(0, 31, 64, 1);
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (var i = 4; i < 28; i += 4) { g.fillRect(36, i + 32, 24, 1); g.fillRect(4, i, 24, 1); }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function createIso(THREE, options) {
    options = options || {};
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    var W = options.W || 960, H = options.H || 540, aspect = W / H;
    var renderer = options.renderer || new THREE.WebGLRenderer({ canvas: options.canvas || undefined, antialias: true, preserveDrawingBuffer: true });
    if (renderer.setPixelRatio) renderer.setPixelRatio(1);
    if (renderer.setSize) renderer.setSize(W, H, false);
    var scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-ISO_VIEW * aspect, ISO_VIEW * aspect, ISO_VIEW, -ISO_VIEW, 0.1, 80);
    scene.background = new THREE.Color(0x05070a);
    var ambient = new THREE.AmbientLight(0x6a4858, 1.6), hemi = new THREE.HemisphereLight(0x7ab0c8, 0x501828, 1.6);
    var key = new THREE.PointLight(0xdfffee, 14, 9, 1.2), lamps = [];
    scene.add(ambient); scene.add(hemi); scene.add(key);
    for (var l = 0; l < 6; l++) { var pl = new THREE.PointLight(0xff3060, 0, 7, 1.3); lamps.push(pl); scene.add(pl); }
    var world = null, lastMap = null, doorMeshes = [], neon = [], ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var follow = null, pools = {}, used = {};

    function dispose(obj) { obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    function build(map, level) {
      if (world) { scene.remove(world); dispose(world); }
      world = new THREE.Group(); doorMeshes = []; neon = [];
      var plan = layout(map), th = theme(level), m4 = new THREE.Matrix4();
      Object.keys(plan.walls).forEach(function (tile) {
        var cells = plan.walls[tile], h = ISO_HEIGHT[tile] || 1, geo = new THREE.BoxGeometry(1, h, 1);
        var mat = material(THREE, doc, tile);
        var mesh = new THREE.InstancedMesh(geo, mat, cells.length);
        cells.forEach(function (c, i) { mesh.setMatrixAt(i, m4.makeTranslation(c[0] + 0.5, h / 2, c[1] + 0.5)); if (NEON[tile]) neon.push({ x: c[0] + 0.5, y: c[1] + 0.5, color: NEON[tile] }); });
        mesh.instanceMatrix.needsUpdate = true; world.add(mesh);
      });
      plan.doors.forEach(function (d) {
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.98), material(THREE, doc, d.tile));
        mesh.position.set(d.x + 0.5, 0.5, d.y + 0.5); mesh.userData = d; doorMeshes.push(mesh); world.add(mesh);
        neon.push({ x: d.x + 0.5, y: d.y + 0.5, color: NEON[d.tile] });
      });
      plan.exits.forEach(function (e) {
        var pad = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.85 }));
        pad.rotation.x = -Math.PI / 2; pad.position.set(e[0] + 0.5, 0.02, e[1] + 0.5); world.add(pad);
        neon.push({ x: e[0] + 0.5, y: e[1] + 0.5, color: NEON.X });
      });
      var tint = th.outdoor ? (level && level.theme === 'city' ? '#2a1c2c' : '#1e2a34') : '#2a1416';
      var ftex = floorTexture(THREE, doc, tint);
      if (ftex) ftex.repeat.set(plan.w / 2, plan.h / 2);
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(plan.w, plan.h), new THREE.MeshStandardMaterial({ color: ftex ? 0xffffff : 0x2a1416, map: ftex, roughness: 0.55, metalness: 0.3 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(plan.w / 2, 0, plan.h / 2); world.add(floor);
      scene.fog = new THREE.Fog(0x05070a, 18, 34);
      scene.add(world); lastMap = map;
    }

    function basic(color, opacity, additive) {
      return new THREE.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
    }
    var factories = {
      ring: function () { var m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32), basic(0xffffff, 0.9, true)); m.rotation.x = -Math.PI / 2; return m; },
      unit: function () {
        var g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.4, emissive: 0x000000 });
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10), mat); body.position.y = 0.3;
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat); head.position.y = 0.6;
        var gun = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x30ffd0, emissiveIntensity: 0.4 }));
        gun.position.set(0.2, 0.38, 0.08); g.add(body); g.add(head); g.add(gun); g.userData = { mat: mat, gun: gun }; return g;
      },
      laser: function () { var m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.015, 0.015), basic(0xff2020, 0.85, true)); return m; },
      tracer: function () { var m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.03), basic(0x60c8ff, 0.95, true)); return m; },
      orb: function () { return new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(0xff6040, 1, true)); },
      pick: function () { var m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7 })); return m; },
      disc: function () { var m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), basic(0xff2020, 0.35, true)); m.rotation.x = -Math.PI / 2; return m; },
      dome: function () {
        var g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), basic(0x40c8ff, 0.18, true)));
        g.add(new THREE.Mesh(new THREE.SphereGeometry(1.002, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x80e8ff, wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
        var rim = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), basic(0x80f0ff, 0.8, true)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.02; g.add(rim);
        return g;
      },
      line: function () { return new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.8 })); },
      metro: function () { var m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), basic(0x1a6dff, 0.8, true)); return m; }
    };
    function take(kind) {
      var list = pools[kind] || (pools[kind] = []), i = used[kind] || 0;
      if (!list[i]) { list[i] = factories[kind](); scene.add(list[i]); }
      used[kind] = i + 1; list[i].visible = true; return list[i];
    }
    function beam(mesh, x0, y0, x1, y1, h) {
      var len = Math.hypot(x1 - x0, y1 - y0) || 0.001;
      mesh.position.set((x0 + x1) / 2, h, (y0 + y1) / 2); mesh.scale.set(len, 1, 1); mesh.rotation.set(0, -Math.atan2(y1 - y0, x1 - x0), 0);
    }
    function unit(o, color, ring, a, scale) {
      var u = take('unit'); u.position.set(o.x, o.z || 0, o.y); u.rotation.y = -(a || 0); u.scale.setScalar(scale || 1);
      u.userData.mat.color.setHex(color); u.userData.mat.emissive.setHex(color); u.userData.mat.emissiveIntensity = o.pain > 0 ? 0.9 : 0.12;
      var r = take('ring'); r.material.color.setHex(ring); r.position.set(o.x, 0.03 + (o.z || 0), o.y); r.scale.setScalar(scale || 1);
    }

    function sync(state) {
      if (state.map !== lastMap) build(state.map, state.level);
      used = {};
      var p = state.player, t = state.time || 0;
      doorMeshes.forEach(function (m) { var d = m.userData, row = state.map[d.y]; m.visible = Boolean(row) && DOORS.indexOf(row[d.x]) >= 0; });
      if (!follow) follow = { x: p.x, y: p.y };
      var k = state.snap ? 1 : Math.min(1, (state.dt || 0.016) * 6);
      follow.x += (p.x - follow.x) * k; follow.y += (p.y - follow.y) * k;
      cam.position.set(follow.x + ISO_OFFSET[0], ISO_OFFSET[1], follow.y + ISO_OFFSET[2]);
      cam.lookAt(follow.x, 0, follow.y); cam.updateProjectionMatrix();
      key.position.set(p.x, 1.6, p.y);
      neon.map(function (n) { return { n: n, d: Math.hypot(n.x - p.x, n.y - p.y) }; }).sort(function (a, b) { return a.d - b.d; })
        .slice(0, lamps.length).forEach(function (q, i) { lamps[i].color.setHex(q.n.color); lamps[i].intensity = 10 + Math.sin(t * 3 + i) * 1.5; lamps[i].position.set(q.n.x, 1.2, q.n.y); });
      unit({ x: p.x, y: p.y, z: (p.height || 0) * 0.6 }, 0x2ecf6a, RING.player, p.a, 1);
      (state.enemies || []).forEach(function (e) {
        if (!e.alive) return;
        var boss = e.type === 'FABRICATOR';
        unit(e, BODY[e.type] || 0x999999, boss ? RING.boss : RING.enemy, Math.atan2(p.y - e.y, p.x - e.x), boss ? 1.8 : e.type === 'TROLL' ? 1.3 : 1);
        if (e.aiming) { var lz = take('laser'); beam(lz, e.x, e.y, p.x, p.y, 0.38); lz.material.opacity = 0.5 + 0.4 * Math.sin(t * 30); }
      });
      (state.allies || []).forEach(function (a) { unit({ x: a.x, y: a.y, z: 0.35 + Math.sin(t * 5) * 0.05 }, 0x5aa8ff, RING.ally, t * 2, 0.6); });
      (state.pickups || []).forEach(function (q) {
        if (!q.alive) return; var m = take('pick'); m.position.set(q.x, 0.18 + Math.sin(q.bob || 0) * 0.05, q.y); m.rotation.y = t * 1.5;
        var c = PICK[q.type] || 0xffffff; m.material.color.setHex(c); m.material.emissive.setHex(c);
      });
      (state.shots || []).forEach(function (s) { var o = take('orb'); o.position.set(s.x, 0.38 + (s.height || 0) * 0.6, s.y); });
      (state.tracers || []).forEach(function (r) { var tr = take('tracer'); beam(tr, r.x0, r.y0, r.x1, r.y1, 0.38); tr.material.opacity = Math.max(0, r.t / 0.12); });
      (state.grenades || []).forEach(function (g) { var o = take('orb'); o.position.set(g.x, 0.15, g.y); });
      (state.strikes || []).forEach(function (st) { var d = take('disc'); d.position.set(st.x, 0.025, st.y); d.scale.setScalar(st.r || 1.1); d.material.opacity = 0.25 + 0.25 * Math.abs(Math.sin(t * 8)); });
      if (state.barrier) { var dm = take('dome'); dm.position.set(state.barrier.x, 0, state.barrier.y); dm.scale.setScalar(state.barrier.r); dm.rotation.y = t * 0.4; }
      (state.metros || []).forEach(function (m) { var mm = take('metro'); mm.position.set(m.x, 0.02, m.y); });
      if (state.hint && state.hint.path) {
        var ln = take('line'), pts = [new THREE.Vector3(p.x, 0.05, p.y)];
        state.hint.path.forEach(function (q) { pts.push(new THREE.Vector3(q.x, 0.05, q.y)); });
        ln.geometry.setFromPoints(pts);
      }
      Object.keys(pools).forEach(function (kind) { for (var i = used[kind] || 0; i < pools[kind].length; i++) pools[kind][i].visible = false; });
      return { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    }
    function render(state) { sync(state); renderer.render(scene, cam); return renderer.domElement; }
    // ndc: x,y in -1..1 (y up). Returns the game-floor point under the cursor.
    function aimAt(ndcX, ndcY) {
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
      var hit = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.z } : null;
    }
    function project(x, y, h) { var v = new THREE.Vector3(x, h || 0, y).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
    return { render: render, sync: sync, aimAt: aimAt, project: project, scene: scene, camera: cam, renderer: renderer, canvas: renderer.domElement,
      stats: function () { var c = {}; Object.keys(pools).forEach(function (k) { c[k] = used[k] || 0; }); return c; },
      dispose: function () { if (world) dispose(world); if (renderer.dispose) renderer.dispose(); } };
  }

  return { create: create, layout: layout, camera: camera, theme: theme, heightOf: heightOf,
    EYE: EYE, LIFT: LIFT, ROOF_FRAC: ROOF_FRAC, createIso: createIso, isoMove: isoMove, isoAngle: isoAngle,
    ISO_OFFSET: ISO_OFFSET, ISO_HEADING: ISO_HEADING, ISO_HEIGHT: ISO_HEIGHT, scope: 'Presentation only; gameplay authority stays in index.html' };
});
