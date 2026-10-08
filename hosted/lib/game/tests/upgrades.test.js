'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createArena } = require('../server/arena');
const Fair = require('../engine/fair-division');
test('victory allocation equips real combat effects on replay without minting XP', () => {
  const initial = createArena(() => 1000);
  const a = initial.join('A'), b = initial.join('B');
  const saved = JSON.parse(JSON.stringify(initial.exportState()));
  saved.phase = 'won'; saved.locked = true;
  const arena = createArena(() => 1000, { saved });
  const round = arena.startRound(a.token, 'knaster');
  arena.bid(a.token, { roundId: round.id, values: [100, 100, 100] });
  arena.bid(b.token, { roundId: round.id, values: [10, 10, 10] });
  const next = arena.replay(a.token);
  const player = next.snapshot(a.token).players[0];
  assert.equal(player.upgrades.shotDamage, 30);
  assert.ok(Math.abs(player.upgrades.shotCooldown - 0.2) < 1e-12);
  assert.equal(player.upgrades.armour, 30);
  assert.equal(player.xp, 0);
  next.input(a.token, { sequence: 1, forward: 0, strafe: 0, turn: 0, fire: true });
  for (let i = 0; i < 120; i++) next.step(1 / 60);
  const injured = next.snapshot(a.token).players[0];
  assert.equal(injured.hp, 100);
  assert.ok(injured.upgrades.armour < 30);
});
test('fractional AW shares equip proportional effects and power cell persists', () => {
  const initial = createArena(() => 1000);
  const a = initial.join('A');
  const saved = JSON.parse(JSON.stringify(initial.exportState()));
  saved.phase = 'won';
  saved.sessions[0][1].inventory = [
    { item: 'Ammo reserve', share: Fair.fraction(1, 2) },
    { item: 'Power cell', share: Fair.fraction(1) },
  ];
  const next = createArena(() => 1000, { saved }).replay(a.token);
  assert.equal(next.snapshot(a.token).players[0].upgrades.shotDamage, 32.5);
  assert.equal(next.snapshot(a.token).players[0].xp, 0);
});
