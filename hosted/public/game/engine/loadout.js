// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Analyst loadout: five equipment slots (weapon mod, armor, tech, augmentation,
// cyberdeck), in-game credits, purchases and upgrades. Original names and
// numbers; pure rules plus a canvas panel — index.html owns state and play.
// Credits are in-game only: no real money, wallets or accounts.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailLoadout = api;
})(this, function () {
  'use strict';
  var MAX_UPGRADE = 3, START_CREDITS = 100, MISSION_CREDITS = 120;
  var KILL_CREDITS = { MOLE: 15, DRONE: 20, ICE_PIG: 28, TROLL: 35, FABRICATOR: 200 };
  // Upper bounds keep stacked modifiers readable and fair.
  var CLAMP = { resist: [0, 0.5], firewall: [0, 0.6], spread: [-0.5, 0], delay: [-0.4, 0], roll: [-0.5, 0], hackCd: [-0.5, 0], augCost: [-0.4, 0], speed: [-0.2, 0.2] };
  var SLOTS = [
    { id: 'weapon', name: 'WEAPON MOD' },
    { id: 'armor', name: 'ARMOR' },
    { id: 'tech', name: 'TECH' },
    { id: 'augment', name: 'AUGMENTATION' },
    { id: 'deck', name: 'CYBERDECK' }
  ];
  function item(id, name, cost, info, base, per) { return { id: id, name: name, cost: cost, info: info, base: base || {}, per: per || {} }; }
  var ITEMS = {
    weapon: [
      item('stock', 'FIELD-ISSUE RIG', 0, 'Standard sights. No modifiers.'),
      item('hardline', 'HARDLINE BARREL', 120, '+12% weapon damage (+4% per upgrade)', { damage: 0.12 }, { damage: 0.04 }),
      item('gyro', 'GYRO STOCK', 100, '-20% spread (-5% per upgrade)', { spread: -0.2 }, { spread: -0.05 }),
      item('feed', 'RAPID FEED', 140, '-12% fire delay (-4% per upgrade)', { delay: -0.12 }, { delay: -0.04 })
    ],
    armor: [
      item('jacket', 'CIVILIAN JACKET', 0, 'No protection beyond armor pickups.'),
      item('weave', 'WEAVE VEST', 110, '10% damage resist (+4% per upgrade)', { resist: 0.1 }, { resist: 0.04 }),
      item('plate', 'CERAMIC PLATE', 180, '18% resist, -6% move speed (+3% resist per upgrade)', { resist: 0.18, speed: -0.06 }, { resist: 0.03 }),
      item('shell', 'REACTIVE SHELL', 160, '+20 max HP, 6% resist (+10 HP per upgrade)', { hp: 20, resist: 0.06 }, { hp: 10 })
    ],
    tech: [
      item('belt', 'EMPTY BELT', 0, 'No tactical tech fitted.'),
      item('frag', 'FRAG HARNESS', 100, '+25% grenade blast radius (+10% per upgrade)', { blast: 0.25 }, { blast: 0.1 }),
      item('capacitor', 'CHARGE CAPACITOR', 120, '+25% tactical charge gain (+10% per upgrade)', { charge: 0.25 }, { charge: 0.1 }),
      item('medpatch', 'AUTO-MEDPATCH', 150, 'Regenerate 0.6 HP/s (+0.3 per upgrade)', { regen: 0.6 }, { regen: 0.3 })
    ],
    augment: [
      item('none', 'NO IMPLANT', 0, 'Baseline physiology.'),
      item('sync', 'NEURAL SYNC', 140, '+15% augment power (+5% per upgrade)', { augPower: 0.15 }, { augPower: 0.05 }),
      item('spine', 'CAPACITOR SPINE', 120, '+25 max energy, -10% augment cost (+10 energy per upgrade)', { energy: 25, augCost: -0.1 }, { energy: 10 }),
      item('reflex', 'REFLEX WIRING', 130, '-20% roll cooldown, +5% move speed (-5% cooldown per upgrade)', { roll: -0.2, speed: 0.05 }, { roll: -0.05 })
    ],
    deck: [
      item('pocket', 'POCKET DECK', 0, 'ICE tier 1. Hack radius 3; stuns drones and droids.', { tier: 1 }),
      item('ghost', 'GHOSTLINE DECK', 160, 'ICE tier 2: +1 radius, -20% cooldown, siphon 15 CR/system, 20% firewall', { tier: 2, hackRadius: 1, hackCd: -0.2, siphon: 15, firewall: 0.2 }, { siphon: 5, firewall: 0.05 }),
      item('lattice', 'BLACK LATTICE DECK', 260, 'ICE tier 3: +2 radius, +50% hack dmg, stuns THE FABRICATOR, 35% firewall', { tier: 3, hackRadius: 2, hackDamage: 0.5, siphon: 25, firewall: 0.35 }, { hackDamage: 0.15, firewall: 0.05 })
    ]
  };

  function find(slot, id) { return (ITEMS[slot] || []).filter(function (i) { return i.id === id; })[0] || null; }
  function attach(hero) {
    if (hero.gear) return hero.gear;
    var owned = {}, equipped = {}, cursor = {};
    SLOTS.forEach(function (s) { var free = ITEMS[s.id][0]; owned[s.id] = {}; owned[s.id][free.id] = 0; equipped[s.id] = free.id; cursor[s.id] = 0; });
    hero.gear = { credits: START_CREDITS, owned: owned, equipped: equipped, ui: { slot: 0, cursor: cursor } };
    return hero.gear;
  }
  // Replace hero.gear with a validated copy: unknown items dropped, free items always owned.
  function sanitize(hero) {
    var raw = hero.gear; hero.gear = null;
    var g = attach(hero);
    if (!raw || typeof raw !== 'object') return g;
    if (Number.isFinite(raw.credits)) g.credits = Math.max(0, Math.min(1e7, Math.floor(raw.credits)));
    SLOTS.forEach(function (s) {
      var own = raw.owned && raw.owned[s.id];
      if (own && typeof own === 'object') Object.keys(own).forEach(function (id) {
        if (find(s.id, id)) g.owned[s.id][id] = Number.isFinite(own[id]) ? Math.max(0, Math.min(MAX_UPGRADE, Math.floor(own[id]))) : 0;
      });
      var eq = raw.equipped && raw.equipped[s.id];
      if (typeof eq === 'string' && eq in g.owned[s.id]) g.equipped[s.id] = eq;
    });
    return g;
  }
  function snapshot(hero) { var g = attach(hero); return { credits: g.credits, owned: JSON.parse(JSON.stringify(g.owned)), equipped: JSON.parse(JSON.stringify(g.equipped)) }; }
  function stat(hero, key) {
    if (!hero) return 0;
    var g = attach(hero), total = 0;
    SLOTS.forEach(function (s) {
      var it = find(s.id, g.equipped[s.id]), lvl = g.owned[s.id][it.id] || 0;
      total += (it.base[key] || 0) + (it.per[key] || 0) * lvl;
    });
    var c = CLAMP[key];
    return c ? Math.max(c[0], Math.min(c[1], total)) : total;
  }
  function earn(hero, amount) { var g = attach(hero); g.credits += Math.max(0, Math.round(amount)); return g.credits; }
  function upgradeCost(it, level) { return Math.round(it.cost * 0.5 * (level + 1)); }
  function canUpgrade(it) { return it.cost > 0 && Object.keys(it.per).length > 0; }

  function buy(hero, slot, id) {
    var g = attach(hero), it = find(slot, id);
    if (!it) return { ok: false, reason: 'UNKNOWN ITEM' };
    if (id in g.owned[slot]) return { ok: false, reason: 'ALREADY OWNED' };
    if (g.credits < it.cost) return { ok: false, reason: 'NEEDS ' + it.cost + ' CR' };
    g.credits -= it.cost; g.owned[slot][id] = 0; g.equipped[slot] = id;
    return { ok: true, action: 'bought', item: it };
  }
  function equip(hero, slot, id) {
    var g = attach(hero), it = find(slot, id);
    if (!it || !(id in g.owned[slot])) return { ok: false, reason: 'NOT OWNED' };
    g.equipped[slot] = id; return { ok: true, action: 'equipped', item: it };
  }
  function upgrade(hero, slot) {
    var g = attach(hero), it = find(slot, g.equipped[slot]), lvl = g.owned[slot][it.id];
    if (!canUpgrade(it)) return { ok: false, reason: 'NOT UPGRADABLE' };
    if (lvl >= MAX_UPGRADE) return { ok: false, reason: 'MAX UPGRADE' };
    var cost = upgradeCost(it, lvl);
    if (g.credits < cost) return { ok: false, reason: 'NEEDS ' + cost + ' CR' };
    g.credits -= cost; g.owned[slot][it.id] = lvl + 1;
    return { ok: true, action: 'upgraded', item: it, level: lvl + 1 };
  }
  // Buy if not owned, otherwise equip: one action for the highlighted item.
  function activate(hero, slot, id) {
    var g = attach(hero);
    return id in g.owned[slot] ? equip(hero, slot, id) : buy(hero, slot, id);
  }

  // Keyboard control while the panel is open. Returns null if the key is not handled.
  function key(hero, code) {
    var g = attach(hero), ui = g.ui, slot = SLOTS[ui.slot].id, list = ITEMS[slot];
    var digit = /^Digit([1-5])$/.exec(code);
    if (digit) { ui.slot = +digit[1] - 1; return { ok: true, action: 'select' }; }
    if (code === 'ArrowUp' || code === 'KeyW') { ui.slot = (ui.slot + SLOTS.length - 1) % SLOTS.length; return { ok: true, action: 'select' }; }
    if (code === 'ArrowDown' || code === 'KeyS') { ui.slot = (ui.slot + 1) % SLOTS.length; return { ok: true, action: 'select' }; }
    if (code === 'ArrowLeft' || code === 'KeyA') { ui.cursor[slot] = (ui.cursor[slot] + list.length - 1) % list.length; return { ok: true, action: 'browse' }; }
    if (code === 'ArrowRight' || code === 'KeyD') { ui.cursor[slot] = (ui.cursor[slot] + 1) % list.length; return { ok: true, action: 'browse' }; }
    if (code === 'Enter' || code === 'Space') return activate(hero, slot, list[ui.cursor[slot]].id);
    if (code === 'KeyU') return upgrade(hero, slot);
    return null;
  }

  // Panel geometry shared by drawing and pointer hit-testing.
  function layout(W, H) {
    var w = Math.min(640, W - 20), x = (W - w) / 2, y = Math.max(10, H / 2 - 220), rows = [];
    SLOTS.forEach(function (s, i) {
      var ry = y + 50 + i * 70, cells = [], cw = (w - 150) / ITEMS[s.id].length;
      ITEMS[s.id].forEach(function (it, k) { cells.push({ slot: s.id, index: k, x: x + 140 + k * cw, y: ry, w: cw - 6, h: 40 }); });
      rows.push({ slot: s.id, index: i, x: x, y: ry, w: w, h: 62, cells: cells });
    });
    return { x: x, y: y, w: w, h: 440, rows: rows, upgrade: { x: x + w - 150, y: y + 404, w: 136, h: 26 } };
  }
  function inside(r, px, py) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
  function click(hero, px, py, W, H) {
    var g = attach(hero), L = layout(W, H);
    if (inside(L.upgrade, px, py)) return upgrade(hero, SLOTS[g.ui.slot].id);
    for (var i = 0; i < L.rows.length; i++) {
      var row = L.rows[i];
      for (var k = 0; k < row.cells.length; k++) {
        var c = row.cells[k];
        if (inside(c, px, py)) {
          var same = g.ui.slot === i && g.ui.cursor[c.slot] === k;
          g.ui.slot = i; g.ui.cursor[c.slot] = k;
          return same ? activate(hero, c.slot, ITEMS[c.slot][k].id) : { ok: true, action: 'browse' };
        }
      }
      if (inside(row, px, py)) { g.ui.slot = i; return { ok: true, action: 'select' }; }
    }
    return inside(L, px, py) ? { ok: true, action: 'none' } : null;
  }

  function panel(ctx, hero, W, H) {
    var g = attach(hero), L = layout(W, H), ui = g.ui;
    ctx.save();
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#05070a'; ctx.fillRect(L.x, L.y, L.w, L.h);
    ctx.globalAlpha = 1; ctx.strokeStyle = '#3aa0ff'; ctx.strokeRect(L.x, L.y, L.w, L.h);
    ctx.textAlign = 'left'; ctx.font = '900 18px Courier New'; ctx.fillStyle = '#3aa0ff';
    ctx.fillText('LOADOUT // CREDITS ' + g.credits + ' CR', L.x + 14, L.y + 28);
    L.rows.forEach(function (row, i) {
      var s = SLOTS[i], active = ui.slot === i, eq = g.equipped[s.id];
      ctx.font = '900 13px Courier New'; ctx.fillStyle = active ? '#ffce2e' : '#8aa';
      ctx.fillText('[' + (i + 1) + '] ' + s.name, L.x + 10, row.y + 16);
      var eqIt = find(s.id, eq), lvl = g.owned[s.id][eq];
      ctx.font = '11px Courier New'; ctx.fillStyle = '#7dffb0';
      ctx.fillText(canUpgrade(eqIt) ? 'MK ' + (lvl + 1) + '/' + (MAX_UPGRADE + 1) : 'BASE', L.x + 10, row.y + 32);
      row.cells.forEach(function (c, k) {
        var it = ITEMS[s.id][k], own = it.id in g.owned[s.id], on = eq === it.id, cur = active && ui.cursor[s.id] === k;
        ctx.fillStyle = on ? '#0f2a1b' : '#10141a'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = cur ? '#ffce2e' : on ? '#7dffb0' : '#223'; ctx.lineWidth = cur ? 2 : 1; ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.font = '900 11px Courier New'; ctx.fillStyle = own ? '#e6f0ff' : '#778';
        ctx.fillText(it.name.length > 18 ? it.name.slice(0, 17) + '…' : it.name, c.x + 4, c.y + 15);
        ctx.font = '10px Courier New'; ctx.fillStyle = on ? '#7dffb0' : own ? '#9cf' : g.credits >= it.cost ? '#ffce2e' : '#a55';
        ctx.fillText(on ? 'EQUIPPED' : own ? 'OWNED' : it.cost + ' CR', c.x + 4, c.y + 31);
      });
      if (active) {
        var sel = ITEMS[s.id][ui.cursor[s.id]];
        ctx.font = '11px Courier New'; ctx.fillStyle = '#ccd'; ctx.fillText(sel.info, L.x + 140, row.y + 54);
      }
    });
    var slot = SLOTS[ui.slot].id, cur = find(slot, g.equipped[slot]), lv = g.owned[slot][cur.id];
    var up = !canUpgrade(cur) ? 'NOT UPGRADABLE' : lv >= MAX_UPGRADE ? 'MAX MK' : 'UPGRADE ' + upgradeCost(cur, lv) + ' CR';
    ctx.fillStyle = '#10141a'; ctx.fillRect(L.upgrade.x, L.upgrade.y, L.upgrade.w, L.upgrade.h);
    ctx.strokeStyle = '#3aa0ff'; ctx.lineWidth = 1; ctx.strokeRect(L.upgrade.x, L.upgrade.y, L.upgrade.w, L.upgrade.h);
    ctx.font = '900 11px Courier New'; ctx.fillStyle = '#3aa0ff'; ctx.fillText('[U] ' + up, L.upgrade.x + 6, L.upgrade.y + 17);
    ctx.font = '11px Courier New'; ctx.fillStyle = '#8aa';
    ctx.fillText('1–5/↑↓ SLOT · ←→ BROWSE · ENTER BUY/EQUIP · I CLOSE', L.x + 14, L.y + 421);
    ctx.restore();
  }

  return {
    MAX_UPGRADE: MAX_UPGRADE, START_CREDITS: START_CREDITS, MISSION_CREDITS: MISSION_CREDITS, KILL_CREDITS: KILL_CREDITS,
    SLOTS: SLOTS, ITEMS: ITEMS, CLAMP: CLAMP,
    find: find, attach: attach, sanitize: sanitize, snapshot: snapshot, stat: stat, earn: earn, upgradeCost: upgradeCost, canUpgrade: canUpgrade,
    buy: buy, equip: equip, upgrade: upgrade, activate: activate, key: key, layout: layout, click: click, panel: panel
  };
});
