// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../js/emulation-engine.js');
test('real console CPU executes one clearance transition and rejects incomplete plan masks',()=>{
 const e=E.create(0);assert.equal(e.clearance(),2);assert.equal(e.clearance(),2);for(let mask=0;mask<15;mask++)assert.equal(e.plan(mask),false);assert.equal(e.plan(15),true);assert.equal(e.plan(7),false);assert.throws(()=>e.plan(16),/Invalid/);const log=e.exportLog();assert.equal(log.runtime,'JSNES 2.1.0');assert.ok(log.events.every(x=>x.cycles>0&&x.instructions<=E.settings.instructionBudget));assert.equal(log.state.version,2);
});
test('original mission ROM and identical command sequence replay deterministically',()=>{
 const a=E.create(0),b=E.create(0);for(const e of [a,b]){e.plan(0);e.clearance();e.plan(3);e.plan(15);}assert.deepEqual(a.exportLog(),b.exportLog());assert.deepEqual([...E.rom().slice(0,6)],[78,69,83,26,1,1]);
});
