// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../engine/footprint-ops.js');
const core=require('../engine/core.js');
const collect=(state,id,t)=>ops.scrub({...state,time:t},id);

test('footprint catalogue contains only declared fictional services and reserved domains',()=>{
  assert.equal(ops.catalogue.length,8);
  assert.deepEqual(ops.catalogue.map(n=>n.name),['BROKERLINE PEOPLE-INDEX','SHADOWMART PASTE','OLDPLAY ACCOUNT','LEAKY MIRROR','DUSTVAULT INDEX','GLOOMCACHE DUMP','QUIETPIXEL ACCOUNT','ECHOCRATE MIRROR']);
  assert.equal(new Set(ops.catalogue.map(n=>n.id)).size,8);
  assert.equal(new Set(ops.catalogue.map(n=>n.category)).size,4);
  assert.equal(new Set(ops.catalogue.map(n=>n.severity)).size,4);
  for(const node of ops.catalogue)assert.match(node.domain,/^[a-z-]+\.example$/);
  assert.ok(ops.catalogue.filter(n=>n.severity==='critical').length>=2);
  assert.ok(Object.isFrozen(ops.catalogue));
});
test('footprint map is enclosed and all exposures and exit are reachable on foot',()=>{
  const level=ops.level();assert.doesNotThrow(()=>core.validateGrid(level.map));
  assert.equal(level.name,'FOOTPRINT PURGE');assert.equal(level.requires,'footprints');
  assert.match(level.brief,/fictional/);assert.match(level.brief,/\.example/);
  assert.equal(level.map.join('').split(ops.TILE).length-1,ops.catalogue.length);
  const seen=new Set(['1,1']),queue=[[1,1]];
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=queue[i][0]+dx,y=queue[i][1]+dy,key=`${x},${y}`;
    if(level.map[y]?.[x]&&level.map[y][x]!=='#'&&!seen.has(key)){seen.add(key);queue.push([x,y]);}
  }
  for(const node of ops.catalogue){assert.equal(level.map[node.y][node.x],ops.TILE);assert.ok(seen.has(`${node.x},${node.y}`));}
  assert.ok(seen.has('14,9'));
  assert.ok(level.map.every(r=>r[0]==='#'&&r.at(-1)==='#'));
  assert.equal(level.map[0],'#'.repeat(16));assert.equal(level.map.at(-1),'#'.repeat(16));
});
test('only all critical exposures open exit; optional scrubs and duplicate scrubs do not bypass it',()=>{
  let s=ops.createState();assert.equal(ops.exitOpen(s),false);
  for(const node of ops.catalogue.filter(n=>n.severity!=='critical'))s=collect(s,node.id,1);
  assert.equal(ops.criticalRemaining(s),2);
  s=collect(s,'F2',2);assert.equal(ops.exitOpen(s),false);
  assert.strictEqual(ops.scrub(s,'F2'),s);
  s=collect(s,'F1',3);assert.equal(ops.exitOpen(s),true);
});
test('episode lists only scrubbed nodes in scrub order with exact typed telemetry and simulation seconds',()=>{
  const empty=ops.createState();assert.deepEqual(ops.episode(empty),[]);
  let s=collect(empty,'F8',.25);s=collect(s,'F1',2.5);s=collect(s,'F2',2.5);
  assert.deepEqual(ops.episode(s),[
    {id:'F8',category:'leaked_domain',severity:'low',difficulty:'medium',t:.25},
    {id:'F1',category:'data_broker',severity:'critical',difficulty:'hard',t:2.5},
    {id:'F2',category:'dark_web',severity:'critical',difficulty:'impossible',t:2.5}
  ]);
  assert.deepEqual(empty,ops.createState());
  const event=ops.episode(s);event[0].id='changed';assert.equal(ops.episode(s)[0].id,'F8');
});
test('severity weights accumulate once per node; scrub rejects invalid IDs and times',()=>{
  let s=ops.createState();
  for(const [id,score]of [['F1',1000],['F3',750],['F5',500],['F7',250]]){
    const before=s.intel;s=collect(s,id,1);assert.equal(s.intel-before,score);
    assert.strictEqual(ops.scrub(s,id),s);
  }
  assert.equal(s.intel,2500);assert.throws(()=>ops.score('unknown'));
  assert.throws(()=>ops.scrub(s,'unknown'));
  for(const t of [-1,NaN,Infinity,.5])assert.throws(()=>collect(s,'F2',t));
  assert.equal(new Set(Object.values(ops.COLORS)).size,4);
});

test('every exposure has a valid difficulty and non-empty generic fix also shown in the briefing',()=>{
  const allowed=['easy','medium','hard','impossible'];
  assert.equal(new Set(ops.catalogue.map(n=>n.difficulty)).size,4);
  for(const node of ops.catalogue){
    assert.ok(allowed.includes(node.difficulty));assert.ok(node.fix.trim().length>0);
    assert.equal(node.fix,ops.FIXES[node.category]);assert.ok(ops.level().brief.includes(node.fix));
    assert.doesNotMatch(node.fix,/https?:|www\.|\.com|\.org|\.net/i);
    const event=ops.episode(collect(ops.createState(),node.id,0))[0];
    assert.equal(event.difficulty,node.difficulty);
    assert.deepEqual(Object.keys(event),['id','category','severity','difficulty','t']);
  }
});
