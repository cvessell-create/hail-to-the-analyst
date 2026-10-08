// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('../js/emulation-engine.js') : root.MissionMachine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VessellEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Machine) {
  'use strict';
  const defaults = Object.freeze({ tickHz: 60, maxCatchUpSteps: 8,
    collisionRadius: 0.18, fovRadians: Math.PI / 3, rayColumns: 320, maxRayDistance: 32 });
  function finite(...values) {
    if (!values.every(Number.isFinite)) throw Error('Expected finite numbers.');
  }
  function validateGrid(grid) {
    if (!Array.isArray(grid) || grid.length < 3 || grid.length > 256 ||
        !(typeof grid[0] === 'string' || Array.isArray(grid[0]))) throw Error('Invalid grid.');
    const width = grid[0].length;
    if (width < 3 || width > 256 || grid.some(row =>
      !(typeof row === 'string' || Array.isArray(row)) || row.length !== width ||
      Array.from(row).some(tile => typeof tile !== 'string' || tile.length !== 1))) {
      throw Error('Grid must contain rectangular single-character rows.');
    }
    return grid.map(row => Array.from(row));
  }
  function solid(grid, x, y) { return grid[Math.floor(y)]?.[Math.floor(x)] !== '.'; }
  function blocked(isSolid, x, y, radius) {
    return [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]
      .some(([dx, dy]) => isSolid(x + dx, y + dy));
  }
  function move(position, dx, dy, radius, isSolid) {
    finite(position.x, position.y, dx, dy, radius);
    if (radius <= 0 || radius >= 0.5 || typeof isSolid !== 'function') throw Error('Invalid collision body.');
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / radius));
    if (steps > 4096) throw Error('Motion budget exceeded.');
    for (let i = 0; i < steps; i++) {
      if (!blocked(isSolid, position.x + dx / steps, position.y, radius)) position.x += dx / steps;
      if (!blocked(isSolid, position.x, position.y + dy / steps, radius)) position.y += dy / steps;
    }
    return position;
  }
  function castRay(grid, x, y, angle, maxDistance = defaults.maxRayDistance, isSolid) {
    finite(x, y, angle, maxDistance);
    if (maxDistance <= 0 || maxDistance > 512) throw Error('Invalid ray range.');
    isSolid = isSolid || ((px, py) => solid(grid, px, py));
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let gx = Math.floor(x), gy = Math.floor(y), distance = 0, side = 0;
    const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let nextX = dx === 0 ? Infinity : (dx < 0 ? x - gx : gx + 1 - x) * deltaX;
    let nextY = dy === 0 ? Infinity : (dy < 0 ? y - gy : gy + 1 - y) * deltaY;
    function hit() {
      return { distance, side, tile: grid[gy]?.[gx] || '#', x: gx, y: gy };
    }
    if (isSolid(x, y)) return hit();
    for (let count = 0; count < 2048; count++) {
      if (Math.min(nextX, nextY) > maxDistance) {
        return { distance: maxDistance, side, tile: null, x: gx, y: gy };
      }
      // Supercover corner crossings: visibility must not pass between touching walls.
      if (Math.abs(nextX - nextY) < 1e-10) {
        distance = nextX;
        if (isSolid(gx + stepX + 0.5, gy + 0.5)) { gx += stepX; side = 0; return hit(); }
        if (isSolid(gx + 0.5, gy + stepY + 0.5)) { gy += stepY; side = 1; return hit(); }
        gx += stepX; gy += stepY; nextX += deltaX; nextY += deltaY; side = 0;
      } else if (nextX < nextY) {
        distance = nextX; nextX += deltaX; gx += stepX; side = 0;
      } else {
        distance = nextY; nextY += deltaY; gy += stepY; side = 1;
      }
      if (isSolid(gx + 0.5, gy + 0.5)) return hit();
    }
    throw Error('Ray budget exceeded.');
  }
  function lineOfSight(grid, a, b, isSolid) {
    finite(a.x, a.y, b.x, b.y);
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance === 0) return !(isSolid || ((x, y) => solid(grid, x, y)))(a.x, a.y);
    return castRay(grid, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x),
      distance, isSolid).tile === null;
  }
  function createWorld(options = {}) {
    const grid = validateGrid(options.grid), radius = options.radius ?? defaults.collisionRadius;
    const p = { x: options.x ?? 1.5, y: options.y ?? 1.5, angle: options.angle ?? 0 };
    finite(p.x, p.y, p.angle, radius);
    const isSolid = (x, y) => solid(grid, x, y);
    if (radius <= 0 || radius >= 0.5 || blocked(isSolid, p.x, p.y, radius)) throw Error('Spawn blocked or invalid.');
    return { grid, position: () => ({ ...p }),
      turn(delta) { finite(delta); p.angle = Math.atan2(Math.sin(p.angle + delta), Math.cos(p.angle + delta)); },
      move(forward, strafe, distance) {
        finite(forward, strafe, distance);
        if (distance < 0) throw Error('Invalid motion.');
        const length = Math.max(1, Math.hypot(forward, strafe));
        move(p, (Math.cos(p.angle) * forward - Math.sin(p.angle) * strafe) * distance / length,
          (Math.sin(p.angle) * forward + Math.cos(p.angle) * strafe) * distance / length, radius, isSolid);
        return this.position();
      },
      ray: (angle, distance) => castRay(grid, p.x, p.y, angle, distance),
      lineOfSight: (target) => lineOfSight(grid, p, target) };
  }
  function render(ctx, world, width, height, options = {}) {
    const fov = options.fov ?? defaults.fovRadians, columns = options.columns ?? defaults.rayColumns;
    finite(width, height, fov);
    if (width <= 0 || height <= 0 || width > 8192 || height > 8192 ||
        fov <= 0 || fov >= Math.PI || !Number.isInteger(columns) || columns < 1 || columns > 4096) {
      throw Error('Invalid renderer budget.');
    }
    ctx.fillStyle = '#11181b'; ctx.fillRect(0, 0, width, height / 2);
    ctx.fillStyle = '#232922'; ctx.fillRect(0, height / 2, width, height / 2);
    const p = world.position(), depths = new Float64Array(columns);
    for (let i = 0; i < columns; i++) {
      const offset = Math.atan((2 * (i + 0.5) / columns - 1) * Math.tan(fov / 2));
      const hit = world.ray(p.angle + offset);
      const depth = Math.max(0.04, hit.distance * Math.cos(offset));
      depths[i] = depth;
      if (hit.tile === null) continue;
      const h = height / depth, shade = Math.max(0.12, 1 - depth / defaults.maxRayDistance) * (hit.side ? 0.72 : 1);
      ctx.fillStyle = `rgb(${Math.round(102 * shade)},${Math.round(129 * shade)},${Math.round(108 * shade)})`;
      ctx.fillRect(i * width / columns, (height - h) / 2, Math.ceil(width / columns), h);
    }
    return depths;
  }
  function clock(update, options = {}) {
    const hz = options.tickHz ?? defaults.tickHz, budget = options.maxCatchUpSteps ?? defaults.maxCatchUpSteps;
    finite(hz);
    if (typeof update !== 'function' || hz <= 0 || hz > 240 ||
        !Number.isInteger(budget) || budget < 1 || budget > 120) throw Error('Invalid clock.');
    let pending = 0, ticks = 0, dropped = 0;
    return { advance(dt) {
      if (!Number.isFinite(dt) || dt < 0 || dt > 3600) throw Error('Invalid elapsed time.');
      pending += dt;
      const available = Math.floor((pending + 1e-12) * hz), steps = Math.min(available, budget);
      for (let i = 0; i < steps; i++) { update(1 / hz); ticks++; pending -= 1 / hz; }
      const lost = available - steps;
      dropped += lost; pending = Math.max(0, pending - lost / hz);
      return { ticks, droppedTicks: dropped, steps, alpha: pending * hz };
    }, reset() { pending = 0; ticks = 0; dropped = 0; } };
  }
  function bindInput(target) {
    const held = new Set();
    const down = e => held.add(e.code), up = e => held.delete(e.code), clear = () => held.clear();
    target.addEventListener('keydown', down); target.addEventListener('keyup', up); target.addEventListener('blur', clear);
    return { held: code => held.has(code), clear, dispose() {
      clear(); target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', clear);
    } };
  }
  function tone(audioContext, frequency, seconds, options = {}) {
    finite(frequency, seconds);
    if (frequency <= 0 || frequency > 20000 || seconds <= 0 || seconds > 10) throw Error('Invalid tone.');
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    if (options.endFrequency !== undefined) {
      finite(options.endFrequency);
      if (options.endFrequency <= 0 || options.endFrequency > 20000) throw Error('Invalid tone ramp.');
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, audioContext.currentTime + seconds);
    }
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + seconds);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(); oscillator.stop(audioContext.currentTime + seconds);
  }
  return { version: '0.2.0', defaults, validateGrid, solid, blocked, move, castRay, lineOfSight,
    createWorld, render, clock, bindInput, tone, createMission: Machine?.create };
});
