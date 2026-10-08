// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.VessellEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EngineSystems = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Engine) {
  'use strict';
  const types = Object.freeze({ spawn: 'spawn', sprite: 'sprite', marker: 'marker' });
  const clone = value => JSON.parse(JSON.stringify(value));
  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function keys(value, allowed) {
    if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unknown record fields.');
  }
  function id(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw Error('Invalid object/asset ID.');
    return value;
  }
  function label(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 120) throw Error('Invalid label.');
    return value;
  }
  function validateAsset(asset) {
    keys(asset, ['id', 'label', 'width', 'height', 'pixels', 'palette']);
    id(asset.id); label(asset.label);
    if (!Number.isInteger(asset.width) || !Number.isInteger(asset.height) ||
        asset.width < 1 || asset.height < 1 || asset.width > 64 || asset.height > 64 ||
        !Array.isArray(asset.palette) || asset.palette.length < 1 || asset.palette.length > 16 ||
        asset.palette.some(color => color !== null && (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))) ||
        !Array.isArray(asset.pixels) || asset.pixels.length !== asset.width * asset.height ||
        asset.pixels.some(pixel => !Number.isInteger(pixel) || pixel < 0 || pixel >= asset.palette.length)) {
      throw Error('Invalid pixel asset.');
    }
    return clone(asset);
  }
  class AssetRegistry {
    constructor(assets = []) {
      if (!Array.isArray(assets) || assets.length > 128) throw Error('Asset budget exceeded.');
      this.items = new Map();
      assets.forEach(asset => this.register(asset));
    }
    register(asset) {
      const value = validateAsset(asset);
      if (this.items.has(value.id) || this.items.size >= 128) throw Error('Duplicate asset or asset budget exceeded.');
      this.items.set(value.id, value);
      return this.get(value.id);
    }
    get(name) {
      if (!this.items.has(name)) throw Error(`Unknown asset: ${name}`);
      return clone(this.items.get(name));
    }
    export() { return Array.from(this.items.values(), clone); }
  }
  function validateObject(object, grid, assets) {
    keys(object, ['id', 'type', 'x', 'y', 'angle', 'asset', 'label', 'scale']);
    id(object.id); label(object.label);
    if (!Object.hasOwn(types, object.type) || !Number.isFinite(object.x) || !Number.isFinite(object.y) ||
        object.x < 0 || object.y < 0 || object.x >= grid[0].length || object.y >= grid.length ||
        Engine.solid(grid, object.x, object.y)) throw Error('Invalid object position/type.');
    if (object.type === 'spawn') {
      if (!Number.isFinite(object.angle) || Engine.blocked((x, y) => Engine.solid(grid, x, y),
        object.x, object.y, Engine.defaults.collisionRadius)) throw Error('Invalid spawn.');
      if (object.asset !== undefined || object.scale !== undefined) throw Error('Spawn cannot have sprite fields.');
    } else if (object.type === 'sprite') {
      assets.get(object.asset);
      if (!Number.isFinite(object.scale) || object.scale < 0.1 || object.scale > 4) throw Error('Invalid sprite scale.');
      if (object.angle !== undefined) throw Error('Sprite angle unsupported.');
    } else if (object.asset !== undefined || object.angle !== undefined || object.scale !== undefined) {
      throw Error('Marker cannot have sprite/spawn fields.');
    }
    return clone(object);
  }
  function validateScene(scene) {
    keys(scene, ['schema', 'version', 'name', 'grid', 'objects', 'assets']);
    if (scene.schema !== 'vessell-scene' || scene.version !== 2) throw Error('Unsupported scene version.');
    label(scene.name);
    const grid = Engine.validateGrid(scene.grid);
    if (grid.some(row => row.some(tile => tile !== '#' && tile !== '.')) ||
        grid[0].some(tile => tile !== '#') || grid.at(-1).some(tile => tile !== '#') ||
        grid.some(row => row[0] !== '#' || row.at(-1) !== '#')) throw Error('Scene must have sealed # boundaries.');
    if (!Array.isArray(scene.assets)) throw Error('Scene needs an asset list.');
    const assets = new AssetRegistry(scene.assets);
    if (!Array.isArray(scene.objects) || scene.objects.length > 512) throw Error('Object budget exceeded.');
    const seen = new Set();
    const objects = scene.objects.map(object => {
      const value = validateObject(object, grid, assets);
      if (seen.has(value.id)) throw Error('Duplicate object ID.');
      seen.add(value.id); return value;
    });
    if (objects.filter(object => object.type === 'spawn').length !== 1) throw Error('Scene needs exactly one spawn.');
    return { schema: 'vessell-scene', version: 2, name: scene.name,
      grid: grid.map(row => row.join('')), objects, assets: assets.export() };
  }
  class SceneRegistry {
    constructor(scene) { this.scene = validateScene(scene); }
    get(name) {
      const object = this.scene.objects.find(item => item.id === name);
      if (!object) throw Error(`Unknown scene object: ${name}`);
      return clone(object);
    }
    export() { return clone(this.scene); }
    replace(scene) { this.scene = validateScene(scene); }
    upsert(object) {
      const draft = this.export(), index = draft.objects.findIndex(item => item.id === object.id);
      if (index < 0) draft.objects.push(object); else draft.objects[index] = object;
      this.replace(draft);
    }
    remove(name) {
      this.get(name);
      const draft = this.export();
      draft.objects = draft.objects.filter(item => item.id !== name);
      this.replace(draft);
    }
    paint(x, y, tile) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x <= 0 || y <= 0 ||
          x >= this.scene.grid[0].length - 1 || y >= this.scene.grid.length - 1 ||
          !['#', '.'].includes(tile)) throw Error('Invalid edit or sealed boundary.');
      const draft = this.export(), row = Array.from(draft.grid[y]);
      row[x] = tile; draft.grid[y] = row.join('');
      this.replace(draft);
    }
  }
  function migrateScene(input) {
    if (!record(input)) throw Error('Invalid scene.');
    const draft = clone(input);
    if (draft.schema === 'vessell-scene' && draft.version === 1) {
      keys(draft, ['schema', 'version', 'name', 'grid', 'spawn']);
      keys(draft.spawn, ['x', 'y', 'angle']);
      draft.objects = [{ id: 'spawn', type: 'spawn', label: 'Player spawn', ...draft.spawn }];
      draft.assets = []; delete draft.spawn; draft.version = 2;
    }
    return validateScene(draft);
  }
  function encodeSave(scene, player) {
    const valid = validateScene(scene);
    validatePlayer(player, valid.grid);
    return JSON.stringify({ schema: 'vessell-save', version: 2, scene: valid, player: clone(player) }, null, 2);
  }
  function validatePlayer(player, grid) {
    keys(player, ['x', 'y', 'angle']);
    if (![player.x, player.y, player.angle].every(Number.isFinite) ||
        Engine.blocked((x, y) => Engine.solid(grid, x, y), player.x, player.y, Engine.defaults.collisionRadius)) {
      throw Error('Invalid saved player.');
    }
  }
  function parseJSON(text) {
    if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw Error('Save/scene size limit exceeded.');
    return JSON.parse(text);
  }
  function decodeSave(text) {
    const save = parseJSON(text);
    keys(save, ['schema', 'version', 'scene', 'player']);
    if (save.schema !== 'vessell-save' || ![1, 2].includes(save.version)) throw Error('Unsupported save version.');
    const scene = migrateScene(save.scene);
    validatePlayer(save.player, scene.grid);
    return { schema: 'vessell-save', version: 2, scene, player: clone(save.player) };
  }
  function defaultScene() {
    return validateScene({ schema: 'vessell-scene', version: 2, name: 'Engine arena',
      grid: ['##########', '#........#', '#..##....#', '#........#', '#....#...#', '#........#', '##########'],
      assets: [{ id: 'beacon', label: 'Signal beacon', width: 3, height: 4,
        palette: [null, '#77eeaa', '#203a38'], pixels: [0, 1, 0, 1, 2, 1, 0, 1, 0, 1, 1, 1] }],
      objects: [{ id: 'spawn', type: 'spawn', label: 'Player spawn', x: 1.5, y: 1.5, angle: 0 },
        { id: 'beacon-1', type: 'sprite', label: 'Signal beacon', x: 5.5, y: 3.5, asset: 'beacon', scale: 0.8 }] });
  }
  function renderSprites(ctx, scene, player, width, height, depths, fov = Engine.defaults.fovRadians) {
    const assets = new AssetRegistry(scene.assets), columns = depths.length;
    const sprites = scene.objects.filter(item => item.type === 'sprite').map(object => {
      const dx = object.x - player.x, dy = object.y - player.y;
      return { object, depth: dx * Math.cos(player.angle) + dy * Math.sin(player.angle),
        lateral: -dx * Math.sin(player.angle) + dy * Math.cos(player.angle) };
    }).filter(item => item.depth > 0.04).sort((a, b) => b.depth - a.depth);
    for (const { object, depth, lateral } of sprites) {
      const asset = assets.get(object.asset), size = height * object.scale / depth;
      const left = width / 2 + lateral / depth / Math.tan(fov / 2) * width / 2 - size / 2;
      const top = height / 2 - size / 2, first = Math.max(0, Math.floor(left / width * columns));
      const end = Math.min(columns, Math.ceil((left + size) / width * columns));
      for (let column = first; column < end; column++) {
        if (depth >= depths[column]) continue;
        const px = Math.min(asset.width - 1, Math.max(0, Math.floor(((column + 0.5) * width / columns - left) / size * asset.width)));
        for (let py = 0; py < asset.height; py++) {
          const color = asset.palette[asset.pixels[py * asset.width + px]];
          if (color === null) continue;
          ctx.fillStyle = color;
          ctx.fillRect(column * width / columns, top + py * size / asset.height,
            Math.ceil(width / columns), size / asset.height + 0.5);
        }
      }
    }
  }
  function profiler(now = () => performance.now()) {
    const samples = new Map(), counters = new Map();
    return { measure(name, operation) {
      const start = now();
      try { return operation(); }
      finally {
        const list = samples.get(name) || [];
        list.push(Math.max(0, now() - start));
        if (list.length > 240) list.shift();
        samples.set(name, list);
      }
    }, count(name, amount = 1) {
      if (!Number.isFinite(amount)) throw Error('Invalid profile count.');
      counters.set(name, (counters.get(name) || 0) + amount);
    }, snapshot() {
      const timings = {};
      for (const [name, list] of samples) {
        const sorted = list.slice().sort((a, b) => a - b);
        timings[name] = { samples: list.length, meanMs: list.reduce((a, b) => a + b, 0) / list.length,
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
      }
      return { timings, counters: Object.fromEntries(counters) };
    } };
  }
  return { types, AssetRegistry, SceneRegistry, validateScene, migrateScene, encodeSave, decodeSave,
    parseJSON, defaultScene, renderSprites, profiler };
});
