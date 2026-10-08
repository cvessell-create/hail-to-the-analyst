const {test}=require('node:test'),assert=require('node:assert/strict'),{createArena}=require('../server/arena'),P=require('../js/power-index');
test('static reserve: encounter model freezes on first shot despite later injury',()=>{
 let now=1000;const arena=createArena(()=>now),a=arena.join('A'),b=arena.join('B');
 arena.input(a.token,{sequence:1,forward:0,strafe:0,turn:0,fire:true});arena.step(1/60);
 const reserve=JSON.parse(JSON.stringify(arena.exportState().influenceModel));assert.deepEqual(reserve.weights,[27,27]);assert.equal(reserve.quota,31);
 for(let i=0;i<120;i++){now+=1000/60;arena.step(1/60);}
 const view=arena.snapshot(a.token);assert.ok(view.players.some(p=>p.hp<100),'enemy attack must actually change health');assert.deepEqual(arena.exportState().influenceModel,reserve);
 const resumed=createArena(()=>now,{saved:JSON.parse(JSON.stringify(arena.exportState()))});assert.deepEqual(resumed.exportState().influenceModel,reserve);
});
test('fixed normalized power is not conserved XP: survival and criticality alter realized rewards',()=>{
 const model=P.encounter([{id:'A',maxHp:100,level:1},{id:'B',maxHp:100,level:1}],[{maxHp:100}]);
 const together=P.reward(model,'A',['A','B']),alone=P.reward(model,'A',['A']),dead=P.reward(model,'B',['A']);
 assert.equal(together.banzhafNormalized,.5);assert.equal(alone.banzhafNormalized,.5);assert.equal(together.xp,175);assert.equal(alone.xp,150);assert.equal(dead.xp,0);
 assert.equal(alone.critical,false);assert.equal(model.players.reduce((s,p)=>s+p.banzhafNormalized,0),1);
});
