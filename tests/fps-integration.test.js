// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function game(opts = {}) {
  const nodes = new Map();
  const drawing = [];
  const stored = new Map(Object.entries(opts.stored || {}));
  const localStorage = {
    getItem(key) { return stored.has(key) ? stored.get(key) : null; },
    setItem(key, value) { stored.set(key, String(value)); },
    removeItem(key) { stored.delete(key); }
  };
  const canvas = {
    save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() { drawing.push({kind:'beginPath'}); },
    closePath() { drawing.push({kind:'closePath'}); },
    moveTo(...args) { drawing.push({kind:'moveTo',args}); },
    lineTo(...args) { drawing.push({kind:'lineTo',args}); },
    fill() {}, stroke() {},
    arc(...args) { drawing.push({kind:'arc',color:this.fillStyle,args}); },
    fillRect(...args) { drawing.push({kind:'fillRect',color:this.fillStyle,args}); },
    strokeRect(...args) { drawing.push({kind:'strokeRect',color:this.strokeStyle,args}); },
    fillText(text,...args) { drawing.push({kind:'text',text:String(text),args}); },
    measureText(text) { return {width:text.length*10}; },
    createLinearGradient() { return {addColorStop() {}}; }
  };
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      classList: { add() {}, remove() {} }, style: {},
      innerHTML: '', textContent: '', onclick: null,
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); }, addEventListener() {}, insertAdjacentHTML() {},
      focus() {}, click() {},
      querySelector() { return node('nub'); },
      getContext() { return canvas; }
    });
    return nodes.get(id);
  }
  const events = {};
  let approach;
  const context = vm.createContext({
    document: { getElementById: node, ...(opts.iso ? { createElement: () => ({}) } : {}) },
    window: { localStorage, confirm() { return true; }, addEventListener(name, handler) { events[name] = handler; }, ...(opts.search ? { location: { search: opts.search } } : {}) },
    ...(opts.iso ? { THREE: {}, HailThreeView: { ...require('../engine/three-view.js'), createIso: () => ({ aimAt: () => null, project: () => ({ x: 0, y: 0 }) }) } } : {}),
    HailGameplayData: require('../engine/gameplay-data.js'),
    TacticalUI: { start(card, mission, jack, callback) { approach = { mission, jack, callback }; } },
    performance: { now() { return 1000; } },
    requestAnimationFrame() {},
    VessellEngine: require('../engine/core.js'),
    HailSoloExpansion: require('../engine/solo-expansion.js'),
    HailCombat: require('../engine/combat-assist.js'),
    HailCity: require('../engine/city.js'),
    ...(opts.progression ? { HailProgression: require('../engine/progression.js'), HailLoadout: require('../engine/loadout.js') } : {}),
    console
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/i)[1];
  const hooks = `
    globalThis.fps = {
      briefing, startTactics, loadLevel, finishLevel, die,
      state: () => state, player: () => player,
      enemies: () => enemies, keys: () => keys
      , update, fire, use, moveEntity, hasLOS, solid, engineClock, drawDoorStrip, drawEntrances, render, drawMap,
      levels: () => levels, pickups: () => pickups,
      telemetry: gameplayData,
      checkpoint: () => window.HailCampaignState(), restore: v => window.HailRestoreCampaign(v), mission: () => missionMachine,
      metros: () => metros, trip: () => metroTrip, hint: () => hintPath, damage, killEnemy, surround: () => surroundInfo, hero: () => hero, saveHero, maxHp,
      isoOn, enterCity, cityCard, city: () => ({ cleared: cityCleared, run: cityRun, back: cityReturn, index: CITY_INDEX, campaign: CAMPAIGN_N }), practice: () => practice
    };
  `;
  const at=source.lastIndexOf('title();');
  vm.runInContext(source.slice(0,at)+hooks+source.slice(at), context);
  return { fps: context.fps, nodes, events, drawing, stored, approach: () => approach };
}

test('all seven solo missions enter first-person play directly and victory follows the final map', () => {
  const g = game();
  g.nodes.get('muteBtn').onclick();
  g.fps.briefing(0);
  assert.ok(g.nodes.get('card').innerHTML.includes('ENTER MISSION'));
  g.nodes.get('primary').onclick();
  assert.equal(g.fps.state(), 'play');
  assert.equal(g.approach(), undefined);
  g.fps.player().armor = 20;
  g.fps.finishLevel(); g.nodes.get('primary').onclick(); g.nodes.get('primary').onclick();
  assert.equal(g.fps.state(), 'play');
  assert.equal(g.approach(), undefined);
  assert.equal(g.fps.player().armor, 20);
  assert.ok(g.fps.enemies().some(e => e.type === 'FABRICATOR'));
  for (let i=2;i<7;i++) {
    g.fps.finishLevel();
    assert.equal(g.fps.state(), 'brief');
    g.nodes.get('primary').onclick();
    assert.ok(g.nodes.get('card').innerHTML.includes(`MISSION ${i+1} OF 7`));
    g.nodes.get('primary').onclick();
    assert.equal(g.fps.state(), 'play');
    assert.equal(g.fps.checkpoint().missionIndex, i);
  }
  g.fps.finishLevel(); assert.equal(g.fps.state(), 'victory');
});
test('visible privacy controls default off and consented telemetry follows real mission starts, deaths and completions', () => {
  const g = game();
  assert.equal(g.fps.telemetry.hasConsent(), false);
  assert.ok(g.nodes.get('card').innerHTML.includes('Gameplay data is off unless you opt in'));
  assert.ok(g.nodes.get('gameDataOpen'));
  g.nodes.get('gameDataOpen').onclick();
  assert.equal(g.nodes.get('gameDataPanel').hidden, false);
  assert.equal(g.nodes.get('gameDataConsent').checked, false);
  g.fps.loadLevel(0);
  g.fps.finishLevel();
  assert.deepEqual(g.fps.telemetry.events(), []);

  g.nodes.get('gameDataConsent').checked = true;
  g.nodes.get('gameDataSaveConsent').onclick();
  assert.equal(g.fps.telemetry.hasConsent(), true);
  g.fps.loadLevel(0);
  g.fps.finishLevel();
  g.fps.loadLevel(0);
  Object.assign(g.fps.player(), { x: 6.9, y: 10.2 });
  g.fps.die();
  let report = g.fps.telemetry.report();
  assert.equal(report.counts.attemptsStarted, 2);
  assert.equal(report.counts.terminalOutcomes, 2);
  assert.equal(report.missions[0].completed, 1);
  assert.equal(report.missions[0].deaths, 1);
  assert.deepEqual([g.fps.telemetry.events()[3].deathX, g.fps.telemetry.events()[3].deathY], [6, 10]);

  g.fps.loadLevel(0);
  g.nodes.get('gameDataRevoke').onclick();
  g.fps.finishLevel();
  report = g.fps.telemetry.report();
  assert.equal(report.counts.attemptsStarted, 3);
  assert.equal(report.counts.terminalOutcomes, 2);
  assert.equal(report.counts.censoredAttempts, 1);
  assert.equal(g.fps.telemetry.hasConsent(), false);
});
test('legacy tactical checkpoint handoff retains its breach result without stacking on retry', () => {
  const g = game();
  const clean = game();
  clean.fps.loadLevel(0);
  const originalEnemies = clean.fps.enemies().length;
  g.fps.briefing(0);
  g.fps.startTactics(0);
  assert.equal(g.fps.state(), 'tactical');
  assert.equal(g.approach().mission, 0);
  assert.equal(g.approach().jack, null);
  const jack = { level: 3, xp: 900 };
  g.approach().callback({ armor: 20, bullets: 12, shells: 2, extraEnemies: 1 }, jack);
  assert.equal(g.fps.state(), 'play');
  assert.equal(g.fps.player().armor, 20);
  assert.equal(g.fps.player().bullets, 57);
  assert.equal(g.fps.enemies().length, originalEnemies + 1);
  const locations = g.fps.enemies().map(e => `${e.x},${e.y}`);
  assert.equal(new Set(locations).size, locations.length);
  g.fps.player().armor = 1;
  g.fps.player().bullets = 0;
  g.fps.loadLevel(0);
  assert.equal(g.fps.player().armor, 20);
  assert.equal(g.fps.player().bullets, 57);
  assert.equal(g.fps.enemies().length, originalEnemies + 1);

  // Exercise the existing mission-completion screen, not a direct second-map load.
  g.nodes.get('muteBtn').onclick();
  g.fps.finishLevel();
  g.nodes.get('primary').onclick();
  assert.equal(g.fps.state(), 'brief');
  g.fps.startTactics(1);
  assert.equal(g.approach().mission, 1);
  assert.equal(g.approach().jack, jack);
  g.approach().callback({ armor: 30, bullets: 18, shells: 3, extraEnemies: 0 }, jack);
  assert.equal(g.fps.player().armor, 50);
  assert.equal(g.fps.player().bullets, 75);
  assert.equal(g.fps.player().shells, 13);
  assert.ok(g.fps.enemies().some(e => e.type === 'FABRICATOR'));
  g.fps.loadLevel(1);
  assert.equal(g.fps.player().armor, 50);
  assert.equal(g.fps.player().bullets, 75);
  g.fps.finishLevel();
  assert.equal(g.fps.state(), 'brief');
  g.nodes.get('primary').onclick();
  assert.ok(g.nodes.get('card').innerHTML.includes('FROST YARD'));
});

test('tactical keyboard input stays native and cannot fire FPS weapon handlers', () => {
  const g = game();
  assert.doesNotThrow(() => g.events.keydown({ code: 'Digit1', preventDefault() {} }));
  g.fps.startTactics(0);
  let prevented = false;
  g.events.keydown({ code: 'Space', preventDefault() { prevented = true; } });
  g.events.keydown({ code: 'Digit3', preventDefault() {} });
  assert.equal(prevented, false);
  assert.equal(Object.keys(g.fps.keys()).length, 0);
});

test('entry point uses local classic scripts and styles that work without a build or fetch', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('data:')) continue;
    assert.ok(!/^(https?:)?\/\//.test(target), target);
    assert.ok(fs.existsSync(path.join(root, target)), target);
  }
  assert.ok(!html.includes('type="module"'));
  assert.ok(html.includes('canvas[hidden]{display:none}'));
  assert.ok(html.includes('.card{max-height:100%;overflow-y:auto}'));
});
test('campaign uses shared collision/LOS, bounded clock and live mission emulator', () => {
  const g = game(); g.fps.loadLevel(0);
  g.nodes.get('muteBtn').onclick();
  const player = g.fps.player(), x = player.x;
  g.fps.moveEntity(player, 100, 0, 0.18);
  assert.ok(player.x > x && player.x < 6);
  assert.equal(g.fps.hasLOS(player, { x: -1, y: player.y }), false);
  assert.equal(g.fps.mission().plan(7), false); assert.equal(g.fps.mission().plan(15), true);
  assert.equal(g.fps.engineClock.advance(1).steps, 8);
  assert.doesNotThrow(() => g.events.blur());
});

test('campaign checkpoint restores RNG, mission CPU, controls and the same next gameplay transitions',()=>{
 const a=game(),b=game();for(const g of [a,b]){g.fps.loadLevel(0);g.fps.keys().KeyW=true;}
 for(let k=0;k<10;k++){a.fps.update(1/60);b.fps.update(1/60);}assert.equal(JSON.stringify(a.fps.checkpoint()),JSON.stringify(b.fps.checkpoint()));
 a.fps.mission().clearance();a.fps.mission().plan(15);a.fps.fire();a.fps.engineClock.advance(.025);const saved=a.fps.checkpoint();b.fps.restore(saved);assert.equal(JSON.stringify(a.fps.checkpoint()),JSON.stringify(b.fps.checkpoint()));
 for(let k=0;k<80;k++){a.fps.engineClock.advance(1/60);b.fps.engineClock.advance(1/60);if(k%20===0){a.fps.fire();b.fps.fire();}}
 assert.equal(JSON.stringify(a.fps.checkpoint()),JSON.stringify(b.fps.checkpoint()));
});

test('jetpack and fuel pickups drive flight, ground avoidance and bounded landing without wall bypass', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(2);
  const p=g.fps.player(),pig=g.fps.enemies().find(e=>e.type==='ICE_PIG');
  assert.ok(pig);assert.equal(pig.hp,84);
  p.x=2.5;p.y=1.5;g.fps.update(1/60);
  assert.equal(p.jetpack,true);assert.equal(p.fuel,60);
  pig.x=2.9;pig.y=1.5;pig.cool=0;
  g.fps.keys().KeyJ=true;
  for(let i=0;i<60;i++)g.fps.update(1/60);
  assert.ok(p.height>.8);assert.ok(Math.abs(p.fuel-44)<1e-9);
  const health=p.hp;
  for(let i=0;i<45;i++)g.fps.update(1/60);
  assert.equal(p.hp,health);
  g.fps.moveEntity(p,0,-100,.18);assert.ok(p.y>=1.18);
  g.fps.keys().KeyJ=false;
  for(let i=0;i<70;i++)g.fps.update(1/60);
  assert.equal(p.height,0);assert.ok(p.hp<health);
  const fuel=p.fuel;g.fps.update(1/60);assert.equal(p.fuel,fuel);
  p.x=4.5;p.y=2.5;g.fps.update(1/60);assert.ok(Math.abs(p.fuel-fuel-35)<1e-8);
});

test('rooftops block walkers, carry hovering players, stop low shots and render as a low wall', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(5);
  const p=g.fps.player(),map=g.fps.levels()[5].map,y=5,x=map[y].indexOf('L');
  assert.ok(x>0);
  Object.assign(p,{x:x-1.5,y:y+.5,a:0,height:0,jetpack:true,fuel:100});
  g.fps.moveEntity(p,3,0,.18);assert.ok(p.x<x,'ground player must not walk into a roof');
  assert.equal(g.fps.solid(x+.5,y+.5),true,'enemies and the autopilot still see roofs as walls');
  g.fps.keys().KeyJ=true;for(let i=0;i<40;i++)g.fps.update(1/60);g.fps.keys().KeyJ=false;
  assert.ok(p.height>=.9);
  g.fps.moveEntity(p,2,0,.18);assert.ok(p.x>x+.5,'airborne player flies over the roof edge');
  for(let i=0;i<120;i++)g.fps.update(1/60);
  assert.equal(p.height,.9,'player lands on the roof, not the street');
  g.drawing.length=0;p.a=0;p.x=x-1.5;p.height=0;g.fps.render();
  assert.ok(g.drawing.some(d=>d.color==='rgba(255,170,220,0.89)'||String(d.color).startsWith('rgba(255,170,220')),'roof cap line drawn');
});
test('jet fuel carries to the next mission and retries do not stack it; old checkpoints remain playable', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(0);
  Object.assign(g.fps.player(),{jetpack:true,fuel:22,height:1.2});
  g.fps.finishLevel();g.nodes.get('primary').onclick();g.nodes.get('primary').onclick();
  assert.equal(g.fps.player().jetpack,true);assert.equal(g.fps.player().fuel,22);assert.equal(g.fps.player().height,0);
  g.fps.player().fuel=2;g.fps.loadLevel(1);assert.equal(g.fps.player().fuel,22);
  const saved=g.fps.checkpoint();delete saved.player.jetpack;delete saved.player.fuel;delete saved.player.height;delete saved.controls.touch.jet;
  g.fps.restore(saved);assert.doesNotThrow(()=>g.fps.update(1/60));assert.equal(g.fps.player().height,0);
});

test('final exit requires both clearance and a defeated controller through the real use handler', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(6);
  const p=g.fps.player(),map=g.fps.levels()[6].map,y=map.findIndex(row=>row.includes('X')),x=map[y].indexOf('X');
  Object.assign(p,{x:x-.5,y:y+.5,a:0});
  g.fps.use();assert.equal(g.fps.state(),'play');
  p.blue=true;g.fps.use();assert.equal(g.fps.state(),'play');
  const saved=g.fps.checkpoint();saved.bossDead=true;g.fps.restore(saved);
  g.fps.use();assert.equal(g.fps.state(),'victory');assert.equal(g.fps.mission().exportLog().state.approved,true);
});

test('doors have luminous frames, handles and labels, including an open entrance marker', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(0);
  g.fps.drawDoorStrip('D',.05,1,10,100);
  assert.ok(g.drawing.some(d=>d.color==='#7bffe0'&&d.args[3]===100));
  g.fps.drawDoorStrip('R',.75,1,10,100);
  assert.ok(g.drawing.some(d=>d.color==='#fff1ba'));
  Object.assign(g.fps.player(),{x:3.5,y:5.5,a:Math.PI/2});
  g.drawing.length=0;g.fps.drawEntrances();
  assert.ok(g.drawing.some(d=>d.text==='DOOR'));
  assert.ok(g.drawing.some(d=>d.text==='E: OPEN DOOR'));
  g.fps.use();assert.equal(g.fps.solid(3.5,6.5),false);
  g.drawing.length=0;g.fps.drawEntrances();assert.ok(g.drawing.some(d=>d.text==='OPEN'));
  g.drawing.length=0;g.fps.render();assert.ok(g.drawing.some(d=>d.kind==='text'&&d.text.startsWith('JET')));
});

test('hex minimap toggles in FPS play without a separate stage, ignores held M and restores its button state', () => {
  const g=game(),button=g.nodes.get('mapBtn');
  g.events.keydown({code:'KeyM'});
  assert.equal(g.fps.checkpoint().presentation.mapVisible,false);
  g.fps.loadLevel(0);
  button.onclick();
  assert.equal(g.fps.state(),'play');
  assert.equal(g.approach(),undefined);
  assert.equal(button.attributes['aria-pressed'],'true');
  g.events.keydown({code:'KeyM',repeat:true});
  assert.equal(g.fps.checkpoint().presentation.mapVisible,true);
  const saved=g.fps.checkpoint();
  g.events.keydown({code:'KeyM',repeat:false});
  assert.equal(button.attributes['aria-pressed'],'false');
  g.fps.restore(saved);
  assert.equal(button.attributes['aria-pressed'],'true');
  g.drawing.length=0;g.fps.render();
  assert.ok(g.drawing.some(d=>d.text==='LIVE HEX // THE ARCHIVE'));
  button.onclick();g.drawing.length=0;g.fps.render();
  assert.ok(!g.drawing.some(d=>d.text?.startsWith('LIVE HEX')));
});

test('live hex minimap renders all five current arenas and tracks units, loot, doors and exits without mutating gameplay', () => {
  const g=game();g.nodes.get('muteBtn').onclick();
  for(let mission=0;mission<5;mission++){
    g.fps.loadLevel(mission);
    const saved=JSON.stringify(g.fps.checkpoint());
    g.drawing.length=0;g.fps.drawMap();
    assert.equal(JSON.stringify(g.fps.checkpoint()),saved);
    const map=g.fps.checkpoint().map;
    assert.equal(g.drawing.filter(d=>d.kind==='closePath').length,map.length*map[0].length);
    const first=g.drawing.findIndex(d=>d.kind==='closePath');
    assert.equal(g.drawing.slice(first-6,first).filter(d=>d.kind==='moveTo'||d.kind==='lineTo').length,6);
    assert.equal(g.drawing.filter(d=>d.kind==='arc'&&d.color==='#ff4738').length,g.fps.enemies().filter(e=>e.alive).length);
    assert.equal(g.drawing.filter(d=>d.kind==='arc'&&['#8ae7ff','#ff3b30','#3489f0'].includes(d.color)).length,g.fps.pickups().filter(p=>p.alive).length);
    const bounds=g.drawing.find(d=>d.kind==='strokeRect'&&d.color==='#79a579').args;
    for(const d of g.drawing.filter(d=>d.kind==='arc')){
      assert.ok(d.args[0]>=bounds[0]&&d.args[0]<=bounds[0]+bounds[2]);
      assert.ok(d.args[1]>=bounds[1]&&d.args[1]<=bounds[1]+bounds[3]);
    }
    assert.ok(g.drawing.some(d=>d.text==='EXIT'));
  }
  g.fps.loadLevel(0);g.drawing.length=0;g.fps.drawMap();
  const before=g.drawing.find(d=>d.kind==='arc'&&d.color==='#ffce2e').args;
  g.fps.player().x+=.1;g.fps.enemies()[0].alive=false;g.fps.pickups()[0].alive=false;
  g.drawing.length=0;g.fps.drawMap();
  const after=g.drawing.find(d=>d.kind==='arc'&&d.color==='#ffce2e').args;
  assert.ok(after[0]>before[0]);
  assert.equal(g.drawing.filter(d=>d.kind==='arc'&&d.color==='#ff4738').length,g.fps.enemies().length-1);
  assert.equal(g.drawing.filter(d=>d.kind==='arc'&&['#8ae7ff','#ff3b30','#3489f0'].includes(d.color)).length,g.fps.pickups().length-1);
  Object.assign(g.fps.player(),{x:3.5,y:5.5,a:Math.PI/2});g.fps.use();
  g.drawing.length=0;g.fps.drawMap();
  assert.ok(g.drawing.some(d=>d.kind==='strokeRect'&&d.color==='#7bffe0'));
});

test('fractional player positions stay inside the hex for their actual FPS tile', () => {
  const g=game();g.fps.loadLevel(0);
  for(const x of [1.01,1.1,1.5,1.9,1.99,2.01,2.9]){
    for(const y of [1.01,1.2,1.5,1.8,1.99]){
      Object.assign(g.fps.player(),{x,y});
      g.drawing.length=0;g.fps.drawMap();
      const vertices=[],polygons=[];
      for(const d of g.drawing){
        if(d.kind==='beginPath')vertices.length=0;
        if(d.kind==='moveTo'||d.kind==='lineTo')vertices.push(d.args);
        if(d.kind==='closePath')polygons.push(vertices.slice());
      }
      const map=g.fps.checkpoint().map,polygon=polygons[Math.floor(y)*map[0].length+Math.floor(x)];
      const p=g.drawing.find(d=>d.kind==='arc'&&d.color==='#ffce2e').args;
      for(let i=0;i<6;i++){
        const a=polygon[i],b=polygon[(i+1)%6];
        assert.ok((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-9,`${x},${y}`);
      }
    }
  }
});

test('ranged enemies target flight altitude and matching projectiles can still damage hovering players', () => {
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(2);
  Object.assign(g.fps.player(),{height:1.2,jetpack:true,fuel:100,x:25.5,y:10.5});
  g.fps.keys().KeyJ=true;
  const drone=g.fps.enemies().find(e=>e.type==='DRONE');
  Object.assign(drone,{x:27.5,y:10.5,cool:0});g.fps.update(1/60);
  const saved=g.fps.checkpoint();
  assert.ok(saved.shots.some(s=>s.height>1));
  const hp=g.fps.player().hp;
  saved.shots=[{x:saved.player.x,y:saved.player.y,vx:0,vy:0,t:2,damage:9,height:saved.player.height}];
  g.fps.restore(saved);g.fps.update(1/60);assert.equal(g.fps.player().hp,hp-9);
});

test('mission selection is explicitly practice and cannot award campaign victory',()=>{
  const g=game();g.nodes.get('muteBtn').onclick();
  g.nodes.get('practiceBtn').onclick();
  assert.ok(g.nodes.get('card').innerHTML.includes('PRACTICE ONLY'));
  g.nodes.get('mission-3').onclick();g.nodes.get('primary').onclick();
  assert.equal(g.fps.checkpoint().missionIndex,3);assert.equal(g.fps.checkpoint().practice,true);
  g.fps.restore(g.fps.checkpoint());assert.equal(g.fps.checkpoint().practice,true);
  g.fps.finishLevel();assert.equal(g.fps.state(),'brief');
  assert.ok(g.nodes.get('card').innerHTML.includes('not a completed campaign'));
});

test('metro stations fast-travel for free, combat assists roll, raise and heal', () => {
  const g = game(), sky = g.fps.levels().findIndex(l => l.name === 'SKYLINE DISTRICT'), down = code => g.events.keydown({ code, preventDefault() {} });
  g.fps.loadLevel(sky);
  const m = g.fps.metros();
  assert.equal(m.length, 4);
  const p = g.fps.player(), credits = g.fps.player().bullets;
  p.x = m[0].x; p.y = m[0].y; g.fps.enemies().forEach(e => { e.alive = false; });
  down('KeyE');
  assert.equal(g.fps.trip().to, 1);
  down('KeyE');
  assert.equal(g.fps.trip().to, 2, 'E while waiting changes the destination');
  for (let i = 0; i < 90; i++) g.fps.update(1 / 60);
  assert.equal(g.fps.trip(), null);
  assert.deepEqual([p.x, p.y], [m[2].x, m[2].y]);
  assert.equal(p.bullets, credits, 'fast travel is free');
  down('KeyE'); p.x -= 2; g.fps.update(1 / 60);
  assert.equal(g.fps.trip(), null, 'leaving the platform cancels the train');
  // Roll grants invulnerability and moves the player.
  p.x = 13.5; p.y = 26.5; p.a = 0;
  const hp = p.hp, x0 = p.x, y0 = p.y;
  down('KeyQ');
  g.fps.damage(30);
  assert.equal(p.hp, hp);
  for (let i = 0; i < 30; i++) g.fps.update(1 / 60);
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 1, 'roll moved the player');
  g.fps.damage(10); assert.ok(p.hp < hp);
  // Raised weapon exposes the player above low cover.
  g.fps.keys().KeyR = true; g.fps.update(1 / 60);
  assert.equal(p.raised, true);
  g.fps.keys().KeyR = false; g.fps.update(1 / 60);
  assert.equal(p.raised, false);
  // Healing vial pickup.
  p.hp = 50; g.fps.pickups().push({ type: 'k', x: p.x, y: p.y, alive: true, bob: 0 });
  g.fps.update(1 / 60);
  assert.equal(p.hp, 62);
  g.fps.render();
  assert.ok(g.drawing.some(d => d.kind === 'text' && d.text === 'M'), 'radar marks metro stations');
});
test('player fire stops at walls: no hits behind them and tracers end at the wall',()=>{
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(0);
  const p=g.fps.player(),e=g.fps.enemies().find(x=>x.alive);
  Object.assign(p,{x:5.5,y:1.5,a:0,cool:0,bullets:50,weapon:0});
  Object.assign(e,{x:8.5,y:1.5,hp:1000,max:1000});
  g.fps.fire();assert.equal(e.hp,1000,'wall at x=6 must block the shot');
  Object.assign(p,{x:1.5,cool:0});Object.assign(e,{x:4.5});
  g.fps.fire();assert.ok(e.hp<1000,'clear line still hits');
});

test('data and feedback dialog suspends gameplay and ignores gameplay shortcuts until closed',()=>{
  const g=game();g.nodes.get('muteBtn').onclick();g.fps.loadLevel(0);
  g.fps.keys().KeyW=true;
  g.nodes.get('gameDataOpen').onclick();
  const before=JSON.stringify(g.fps.checkpoint());
  g.events.keydown({code:'KeyE',preventDefault(){}});
  g.fps.update(1/60);
  assert.equal(JSON.stringify(g.fps.checkpoint()),before);
  g.nodes.get('gameDataClose').onclick();
  g.fps.update(1/60);
  assert.notEqual(JSON.stringify(g.fps.checkpoint()),before);
});

test('hero XP, skills and loadout persist locally and travel with campaign checkpoints',()=>{
  const g=game({progression:true}),h=g.fps.hero();
  h.level=4;h.skills.endurance=3;h.gear.credits=900;
  const L=require('../engine/loadout.js');assert.ok(L.buy(h,'armor','shell').ok);assert.ok(L.upgrade(h,'armor').ok);
  g.fps.saveHero();
  const saved=g.stored.get('hail-analyst-profile/v1');assert.ok(saved);
  const g2=game({progression:true,stored:{'hail-analyst-profile/v1':saved}}),h2=g2.fps.hero();
  assert.equal(h2.level,4);assert.equal(h2.skills.endurance,3);assert.equal(h2.gear.equipped.armor,'shell');assert.equal(h2.gear.owned.armor.shell,1);
  assert.equal(g2.fps.maxHp(),100+8*3+30);
  g2.fps.loadLevel(0);const cp=g2.fps.checkpoint();assert.equal(cp.hero.gear.equipped.armor,'shell');
  const g3=game({progression:true});g3.fps.restore(cp);assert.equal(g3.fps.hero().gear.equipped.armor,'shell');assert.equal(g3.fps.hero().level,4);
});

test('tampered profiles are clamped and unknown gear is dropped',()=>{
  const bad=JSON.stringify({level:999,xp:-5,skills:{endurance:99,bogus:5},gear:{credits:-50,owned:{armor:{weave:42,fake:1}},equipped:{armor:'fake',deck:'lattice'}}});
  const h=game({progression:true,stored:{'hail-analyst-profile/v1':bad}}).fps.hero();
  assert.equal(h.level,30);assert.equal(h.xp,0);assert.equal(h.skills.endurance,10);assert.equal(h.skills.bogus,undefined);
  assert.equal(h.gear.credits,0);assert.equal(h.gear.owned.armor.weave,3);assert.equal(h.gear.owned.armor.fake,undefined);
  assert.equal(h.gear.equipped.armor,'jacket');assert.equal(h.gear.equipped.deck,'pocket');
});

test('a corrupt saved profile falls back to a fresh hero',()=>{
  const h=game({progression:true,stored:{'hail-analyst-profile/v1':'{not json'}}).fps.hero();
  assert.equal(h.level,1);assert.equal(h.gear.credits,100);
});

test('Vessell City is a free-roam hub after the campaign: entrances, gating, metro and return trips', () => {
  const g = game(), f = g.fps, down = code => g.events.keydown({ code, preventDefault() {} });
  const c = f.city();
  assert.equal(c.campaign, 7); assert.equal(c.index, 7); assert.equal(f.levels()[7].name, 'VESSELL CITY');
  assert.ok(g.nodes.get('card').innerHTML.includes('VESSELL CITY // FREE ROAM'), 'title offers the city without replacing DEPLOY');
  f.telemetry.setConsent(true);
  f.cityCard(); assert.ok(g.nodes.get('card').innerHTML.includes('— VESSELL CITY —'));
  g.nodes.get('primary').onclick();
  assert.equal(f.state(), 'play'); assert.equal(f.checkpoint().missionIndex, 7); assert.equal(f.practice(), true);
  assert.equal(f.telemetry.events().filter(e => e.kind === 'attempt-start').length, 0, 'free roam starts no gameplay attempt');
  f.enemies().forEach(e => { e.alive = false; });
  const p = f.player();
  // Metro Central -> Archive stop.
  const m = f.metros(); assert.equal(m.length, 2);
  p.x = m[0].x; p.y = m[0].y; down('KeyE'); assert.equal(f.trip().to, 1);
  for (let i = 0; i < 90; i++) f.update(1 / 60);
  assert.deepEqual([p.x, p.y], [m[1].x, m[1].y]);
  // Plant is locked until the Archive is cleared.
  Object.assign(p, { x: 23.5, y: 13.5, a: Math.PI / 2 }); f.use();
  assert.equal(f.state(), 'play');
  // Safehouse heals and saves.
  Object.assign(p, { x: 4.5, y: 6.5, a: -Math.PI / 2, hp: 10 }); f.use();
  assert.equal(p.hp, f.maxHp());
  // Archive entrance opens the real mission briefing, then the mission.
  Object.assign(p, { x: 6.5, y: 13.5, a: Math.PI / 2 }); f.use();
  assert.equal(f.state(), 'brief'); assert.ok(g.nodes.get('card').innerHTML.includes('THE ARCHIVE'));
  assert.ok(g.nodes.get('card').innerHTML.includes('BACK TO VESSELL CITY'));
  g.nodes.get('primary').onclick(); assert.equal(f.state(), 'play'); assert.equal(f.checkpoint().missionIndex, 0);
  assert.equal(f.telemetry.events().filter(e => e.kind === 'attempt-start').length, 1, 'district missions are normal practice attempts');
  f.finishLevel();
  assert.notEqual(f.state(), 'victory'); assert.deepEqual([...f.city().cleared], ['THE ARCHIVE']);
  assert.ok(g.nodes.get('card').innerHTML.includes('RETURN TO VESSELL CITY'));
  g.nodes.get('primary').onclick();
  assert.equal(f.checkpoint().missionIndex, 7);
  assert.deepEqual([f.player().x, f.player().y], [6.5, 13.5], 'returns to the entrance it left from');
  // Plant now opens.
  f.enemies().forEach(e => { e.alive = false; });
  Object.assign(f.player(), { x: 23.5, y: 13.5, a: Math.PI / 2 }); f.use();
  assert.equal(f.state(), 'brief'); assert.ok(g.nodes.get('card').innerHTML.includes('FABRICATION PLANT'));
});

test('city progress persists in the local hero profile and is sanitized', () => {
  const g = game({ progression: true }), f = g.fps;
  f.enterCity(); f.enemies().forEach(e => { e.alive = false; });
  Object.assign(f.player(), { x: 6.5, y: 13.5, a: Math.PI / 2 }); f.use(); g.nodes.get('primary').onclick(); f.finishLevel();
  const saved = JSON.parse(g.stored.get('hail-analyst-profile/v1'));
  assert.deepEqual(saved.city, ['THE ARCHIVE']);
  saved.city.push('NOWHERE', 'THE ARCHIVE', 7);
  const g2 = game({ progression: true, stored: { 'hail-analyst-profile/v1': JSON.stringify(saved) } });
  assert.deepEqual(g2.fps.city().cleared, ['THE ARCHIVE']);
});

test('dying in the city respawns at the safehouse; dying in a city mission offers the way back', () => {
  const g = game(), f = g.fps;
  f.enterCity(); f.die();
  assert.ok(g.nodes.get('card').innerHTML.includes('RESPAWN AT SAFEHOUSE'));
  g.nodes.get('primary').onclick(); assert.equal(f.checkpoint().missionIndex, 7);
  f.enemies().forEach(e => { e.alive = false; });
  Object.assign(f.player(), { x: 6.5, y: 13.5, a: Math.PI / 2 }); f.use(); g.nodes.get('primary').onclick();
  f.die(); assert.ok(g.nodes.get('card').innerHTML.includes('RETURN TO VESSELL CITY'));
  g.nodes.get('cityBack').onclick(); assert.equal(f.checkpoint().missionIndex, 7);
});

test('autopilot runs in the isometric view with the same tank steering it uses in first person', () => {
  const step = (opts) => {
    const g = game(opts), f = g.fps; f.loadLevel(0);
    Object.assign(f.player(), { a: 0 }); const x0 = f.player().x, y0 = f.player().y;
    f.keys().KeyW = true; f.update(0.1);
    return { iso: f.isoOn(), dx: f.player().x - x0, dy: f.player().y - y0, a: f.player().a };
  };
  const fp = step({ search: '?autopilot=1&view=fp' }), auto = step({ search: '?autopilot=1', iso: true }), human = step({ search: '?', iso: true });
  assert.equal(fp.iso, false); assert.equal(auto.iso, true, 'autopilot no longer forces first person');
  assert.ok(fp.dx > 0 && Math.abs(fp.dy) < 1e-9);
  assert.deepEqual([auto.dx, auto.dy, auto.a], [fp.dx, fp.dy, fp.a], 'W walks along the facing in both views');
  assert.ok(human.iso && Math.abs(human.dy) > 1e-6, 'a human in isometric still moves screen-relative');
});
