// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const view=require('../engine/three-view.js');
const prog=require('../engine/progression.js');

test('isometric input is screen-relative and unit length',()=>{
  const up=view.isoMove(1,0),right=view.isoMove(0,1);
  assert.ok(Math.abs(Math.hypot(up.x,up.y)-1)<1e-9);
  assert.ok(Math.abs(up.x-up.y)<1e-9&&up.x>0,'W moves away from the camera along +x+y');
  assert.ok(Math.abs(right.x+right.y)<1e-9&&right.y>0,'D moves screen-right');
  assert.ok(Math.abs(up.x*right.x+up.y*right.y)<1e-9,'axes are orthogonal');
  assert.equal(view.ISO_HEADING,Math.PI/4);
  assert.deepEqual(view.ISO_OFFSET,[-10,15,-10]);
});

test('barrier augment blocks shots only inside its dome',()=>{
  assert.equal(prog.AUGMENTS.barrier.key,'KeyB');
  assert.ok(prog.AIM_TELL>0&&prog.AIM_TELL<1);
  const dome={x:5,y:5,r:2.2,t:1};
  assert.equal(prog.insideDome(dome,5.5,6),true);
  assert.equal(prog.insideDome(dome,8,5),false);
  assert.equal(prog.insideDome(null,5,5),false);
});
