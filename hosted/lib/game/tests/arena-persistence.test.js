const {test}=require('node:test'),assert=require('node:assert/strict'),{createArena}=require('../server/arena');
test('persisted arena retains sessions, sealed valuations and one-use settlement across independent requests',()=>{
 let now=1000,arena=createArena(()=>now);const a=arena.join('A'),b=arena.join('B');
 const round=arena.startRound(a.token,'vickrey');arena.bid(a.token,{roundId:round.id,values:[100]});
 arena=createArena(()=>now,{saved:JSON.parse(JSON.stringify(arena.exportState()))});
 assert.deepEqual(arena.snapshot(b.token).round.submitted,[a.you]);arena.bid(b.token,{roundId:round.id,values:[50]});
 arena=createArena(()=>now,{saved:JSON.parse(JSON.stringify(arena.exportState()))});
 const view=arena.snapshot(a.token);assert.equal(view.players[0].credits.value,950);assert.equal(view.economy.treasury.value,50);assert.equal(view.economy.receipts.length,1);
 assert.throws(()=>arena.bid(b.token,{roundId:round.id,values:[50]}),/unavailable/);
});
test('rehydration preserves position, sequence and combat lock without accepting client position',()=>{
 let now=1000,arena=createArena(()=>now);const a=arena.join('A');arena.input(a.token,{sequence:1,forward:1,strafe:0,turn:0,fire:true});arena.step(.1);
 const before=arena.snapshot(a.token);arena=createArena(()=>now,{saved:JSON.parse(JSON.stringify(arena.exportState()))});assert.deepEqual(arena.snapshot(a.token),before);
 assert.throws(()=>arena.join('late'),/locked/);assert.throws(()=>arena.input(a.token,{sequence:1,forward:1,strafe:0,turn:0,fire:false}),/replayed/);
});
test('custom enemy roster restores without inventing default enemies', () => {
 const first=createArena(()=>1000,{enemySpawns:[{x:8.5,y:1.5}]});
 const player=first.join('Custom roster');
 const saved=JSON.parse(JSON.stringify(first.exportState()));
 const restored=createArena(()=>1000,{saved});
 assert.equal(restored.snapshot(player.token).combat.enemies.length,1);
 assert.deepEqual(restored.snapshot(player.token),first.snapshot(player.token));
});
