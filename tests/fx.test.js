'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FX = require('../engine/fx.js');

test('each mission maps to a clamped FX theme', () => {
  assert.equal(FX.themeFor(0).particle, 'dust');
  assert.equal(FX.themeFor(2).particle, 'snow');
  assert.equal(FX.themeFor(4).particle, 'blizzard');
  assert.equal(FX.themeFor(99).particle, 'blizzard');
  assert.equal(FX.themeFor(undefined).particle, 'dust');
});

test('particle overlay never captures input or goes full screen', () => {
  for (const t of FX.THEMES) {
    const o = FX.particleOptions(t.particle);
    assert.equal(o.fullScreen.enable, false);
    assert.equal(o.interactivity.events.onClick.enable, false);
    assert.ok(o.particles.number.value > 0);
  }
});

test('mount is a no-op without a game canvas', () => {
  const win = { document: { getElementById: () => null }, location: { search: '' }, URLSearchParams };
  assert.deepEqual(FX.mount(win), { gl: false, particles: false, theme: null });
});
