// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const expansion=require('../engine/solo-expansion.js');
const core=require('../engine/core.js');

test('new arenas are larger, rectangular, enclosed and have reachable objectives and supplies',()=>{
  const levels=expansion.levels();
  assert.equal(levels.length,3);
  assert.deepEqual(levels.map(l=>[l.map[0].length,l.map.length]),[[32,26],[40,30],[36,28]]);
  for(const level of levels){
    assert.doesNotThrow(()=>core.validateGrid(level.map));
    const width=level.map[0].length,height=level.map.length;
    assert.equal(level.map[0],'#'.repeat(width));assert.equal(level.map[height-1],'#'.repeat(width));
    assert.ok(level.map.every(r=>r[0]==='#'&&r[width-1]==='#'));
    const start=[1,1],q=[start],seen=new Set(['1,1']);
    for(let i=0;i<q.length;i++){
      const [x,y]=q[i];
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const X=x+dx,Y=y+dy,c=level.map[Y]?.[X],key=`${X},${Y}`;
        if(c&&'.PjvbsharqipmdtFXDRB'.includes(c)&&!seen.has(key)){seen.add(key);q.push([X,Y]);}
      }
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if('PjvbharsqXpF'.includes(level.map[y][x]))assert.ok(seen.has(`${x},${y}`),`${level.name}: unreachable ${level.map[y][x]} at ${x},${y}`);
    }
    for(const c of ['P','X'])assert.equal(level.map.join('').split(c).length-1,1);
    assert.ok(level.map.join('').includes('p'));assert.ok(level.map.join('').includes('j'));assert.ok(level.map.join('').includes('v'));
    // Clearance must be obtainable without first opening its locked gate.
    const plain=level.map.map(r=>r.replace(/[jvbsharqipmdtFXP]/g,'.'));
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
