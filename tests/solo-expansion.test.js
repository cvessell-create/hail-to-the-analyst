// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const expansion=require('../engine/solo-expansion.js');
const core=require('../engine/core.js');

test('new arenas are larger, rectangular, enclosed and have reachable objectives and supplies',()=>{
  const levels=expansion.levels();
  assert.equal(levels.length,5);
  assert.deepEqual(levels.map(l=>[l.map[0].length,l.map.length]),[[32,26],[40,30],[36,28],[44,36],[40,32]]);
  for(const level of levels){
    assert.doesNotThrow(()=>core.validateGrid(level.map));
    const width=level.map[0].length,height=level.map.length;
    assert.equal(level.map[0],'#'.repeat(width));assert.equal(level.map[height-1],'#'.repeat(width));
    assert.ok(level.map.every(r=>r[0]==='#'&&r[width-1]==='#'));
    const flood=open=>{const seen=new Set(['1,1']),q=[[1,1]];
      for(let i=0;i<q.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const X=q[i][0]+dx,Y=q[i][1]+dy,c=level.map[Y]?.[X],key=`${X},${Y}`;
        if(c&&open.includes(c)&&!seen.has(key)){seen.add(key);q.push([X,Y]);}
      }
      return seen;};
    // Ground: objectives must stay walkable (the autopilot cannot fly). Air: rooftop
    // courtyard caches may need the jetpack, but everything must be reachable somehow.
    const ground=flood('.PjvbsharqipmdtFXDRBU'),air=flood('.PjvbsharqipmdtFXDRBLU');
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const c=level.map[y][x];
      if('PqrXF'.includes(c))assert.ok(ground.has(`${x},${y}`),`${level.name}: objective ${c} not walkable at ${x},${y}`);
      if('PjvbharsqXpFi'.includes(c))assert.ok(air.has(`${x},${y}`),`${level.name}: unreachable ${c} at ${x},${y}`);
    }
    for(const c of ['P','X'])assert.equal(level.map.join('').split(c).length-1,1);
    assert.ok(level.map.join('').includes('p'));assert.ok(level.map.join('').includes('j'));assert.ok(level.map.join('').includes('v'));
    // Clearance must be obtainable without first opening its locked gate.
    const plain=level.map.map(r=>r.replace(/[jvbsharqipmdtFXPU]/g,'.'));
    const lock=level.requires==='blue-boss'?'q':'r';
    const row=level.map.findIndex(r=>r.includes(lock)),col=level.map[row].indexOf(lock);
    const reachable=new Set(['1,1']),todo=[[1,1]];
    for(let i=0;i<todo.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=todo[i][0]+dx,y=todo[i][1]+dy,key=`${x},${y}`;
      if(['.','D'].includes(plain[y]?.[x])&&!reachable.has(key)){reachable.add(key);todo.push([x,y]);}
    }
    assert.ok(reachable.has(`${col},${row}`),`${level.name}: locked-out clearance`);
  }
  assert.ok(levels[1].map.join('').includes('N'));assert.ok(levels[1].map.join('').includes('T'));
  assert.equal(levels[1].map[10][12],'D');assert.equal(levels[1].map[10][13],'.');assert.equal(levels[1].map[10][14],'h');
  assert.equal(levels[1].map[17][26],'D');assert.equal(levels[1].map[17][27],'.');assert.equal(levels[1].map[17][29],'a');
});

test('jetpack consumes exactly sixteen fuel per second and never regenerates or exceeds bounds',()=>{
  let p={jetpack:true,fuel:100,height:0};
  for(let i=0;i<60;i++)p={...p,...expansion.flight(p,true,1/60)};
  assert.ok(Math.abs(p.fuel-84)<1e-9);assert.equal(p.height,1.5);
  const fuel=p.fuel;
  for(let i=0;i<60;i++)p={...p,...expansion.flight(p,false,1/60)};
  assert.equal(p.height,0);assert.equal(p.fuel,fuel);
  p={jetpack:true,fuel:.8,height:1};
  p={...p,...expansion.flight(p,true,.1)};
  assert.equal(p.fuel,0);assert.ok(Math.abs(p.height-.99)<1e-9);
  p={...p,...expansion.flight(p,true,1)};assert.equal(p.height,0);
  assert.equal(expansion.flight({fuel:30,height:0,jetpack:false},true,1).height,0);
  assert.throws(()=>expansion.flight(p,true,Infinity),/step/);
  assert.throws(()=>expansion.flight({...p,fuel:-1},true,.01),/state/);
});

test('exit conditions cannot substitute a controller kill for final clearance',()=>{
  const [yard,city,dock]=expansion.levels();
  for(const l of [yard,city]){assert.equal(expansion.ready(l,{red:false},true),false);assert.equal(expansion.ready(l,{red:true},false),true);}
  assert.equal(expansion.ready(dock,{blue:false},true),false);
  assert.equal(expansion.ready(dock,{blue:true},false),false);
  assert.equal(expansion.ready(dock,{blue:true},true),true);
});

test('original icy pig and city scenery render distinct features without imported art',()=>{
  const draws=[],ctx={fillRect(...a){draws.push([this.fillStyle,...a]);},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},fillText(t){draws.push(t);}};
  expansion.pig(ctx,100,0);
  assert.ok(draws.some(d=>d[0]==='#c3f4ff'));assert.ok(draws.some(d=>d[0]==='#ff6587'));
  expansion.backdrop(ctx,960,540,0,'city');assert.ok(draws.includes('STARLIGHT'));
  expansion.scenery(ctx,120,'N',0);assert.ok(draws.includes('NEON THEATER'));
  expansion.scenery(ctx,120,'C',0);assert.ok(draws.includes('STAR CINEMA'));
  assert.doesNotThrow(()=>expansion.scenery(ctx,120,'T',0));
});

test('airspace layer: rooftops block the ground and carry a hovering player',()=>{
  assert.equal(expansion.roofBlocks('L',0),true);
  assert.equal(expansion.roofBlocks('L',expansion.ROOF),false);
  assert.equal(expansion.roofBlocks('.',0),false);
  assert.equal(expansion.standing('L',0.2),expansion.ROOF);
  assert.equal(expansion.standing('L',1.3),1.3);
  assert.equal(expansion.standing('.',0.2),0.2);
  assert.ok(expansion.ROOF<1.5,'roof must be under the jetpack ceiling');
  for(const level of expansion.levels())assert.ok(level.map.join('').includes('L'),level.name);
});

test('skyline district is the data-tuned urban final level with enterable buildings',()=>{
  const levels=expansion.levels(),sky=levels.find(l=>l.name==='SKYLINE DISTRICT'),tuning=require('../engine/level-tuning.js');
  assert.equal(sky.name,'SKYLINE DISTRICT');assert.equal(sky.requires,'blue-boss');assert.equal(sky.fx,'neon-city');
  const all=sky.map.join('');
  assert.ok(all.split('D').length-1>=6,'buildings need street doors');
  assert.equal(all.split('F').length-1,1);assert.equal(all.split('q').length-1,1);
  assert.equal(all.replace(/[^pdmt]/g,'').length,tuning.enemies);
  assert.equal(sky.tuning.source.sha256,tuning.source.sha256);
  assert.match(tuning.source.sha256,/^[0-9a-f]{64}$/);
  const {tune}=require('../scripts/build-level-tuning.js');
  const t=tune({probability:{p_outcome_given_mission:{0:{complete:.9,timeout:.6,dead:.5}}}},{});
  assert.deepEqual([t.enemies,t.fuelCaches,t.healthKits],[21,6,6]);
});

test('skyline metro stations are reachable and cycle to the next stop', () => {
  const sky = expansion.levels().find(l => l.name === 'SKYLINE DISTRICT'), all = expansion.stations(sky.map);
  assert.equal(all.length, 4);
  all.forEach((s, i) => assert.deepEqual(expansion.nextStation(sky.map, s.x + .5, s.y + .5), all[(i + 1) % all.length]));
  assert.equal(expansion.nextStation(sky.map, 1.5, 1.5), null);
  assert.ok(expansion.METRO_WAIT > 0);
});

test('shadow dossier level is fictional, gated and teaches evidence rules without personal data',()=>{
  const d=expansion.levels().find(l=>l.name==='SHADOW DOSSIER');
  assert.ok(d&&d.dossier);assert.equal(d.requires,'blue-boss');
  const all=d.map.join('');
  for(const c of ['F','q','P','X'])assert.equal(all.split(c).length-1,1,c);
  assert.ok(all.split('i').length-1>=4,'evidence files');assert.ok(all.split('d').length-1>=5,'watcher drones');
  assert.match(d.brief,/No real accounts, people or agencies/);
  assert.equal(expansion.DOSSIER_FILES.length,6);
  assert.match(expansion.dossierFile(0),/^FILE 1\/6: SEARCH SNIPPETS ARE LEADS/);
  assert.match(expansion.dossierFile(7),/^FILE 2\/6/);
  for(const f of expansion.DOSSIER_FILES)assert.doesNotMatch(f,/@|\d{3}[-.]\d{3}|password|address/i);
});
