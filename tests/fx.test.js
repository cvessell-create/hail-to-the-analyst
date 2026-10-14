'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FX = require('../engine/fx.js');

test('levels declare FX; snow only falls on ice levels', () => {
  const levels = [{}, {}].concat(require('../engine/solo-expansion.js').levels());
  assert.equal(FX.themeFor(0, levels).particle, 'dust');
  assert.equal(FX.themeFor(1, levels).particle, 'embers');
  assert.equal(FX.themeFor(2, levels).particle, 'snow');
  assert.equal(FX.themeFor(3, levels).particle, 'neon');
  assert.equal(FX.themeFor(4, levels).particle, 'blizzard');
  assert.equal(FX.themeFor(5, levels).particle, 'neon');
  for (let i = 0; i < levels.length; i++) {
    const p = FX.themeFor(i, levels).particle;
    const ice = /FROST|GLACIER/.test(levels[i].name || '');
    assert.equal(p === 'snow' || p === 'blizzard', ice, levels[i].name || i);
  }
  for (const i of [undefined, 2, 4, 99]) assert.ok(!['snow', 'blizzard'].includes(FX.themeFor(i).particle));
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
