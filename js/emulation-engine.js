// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// Original mission-control program executed by JSNES's licensed 2A03 emulator.
(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('../vendor/jsnes/jsnes.cjs'):root.jsnes);if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionMachine=api;})(typeof globalThis==='object'?globalThis:this,function(JSNES){
 'use strict';
 var settings={instructionBudget:64,readyMask:15};
 // Assemble only the handful of operations used by our original program.
 // Labels are resolved into real 6502 branch/jump operands; no commercial ROM.
 function program(){var bytes=[],labels={},fixes=[];function label(n){labels[n]=bytes.length;}function emit(){bytes.push.apply(bytes,arguments);}function branch(op,n){emit(op,0);fixes.push({at:bytes.length-1,label:n,relative:true});}function jump(n){emit(0x4c,0,0);fixes.push({at:bytes.length-2,label:n,relative:false});}
  label('poll');emit(0xa5,0x10);branch(0xf0,'poll');emit(0xc9,1);branch(0xf0,'clearance');emit(0xc9,2);branch(0xf0,'plan');jump('ack');
  label('clearance');emit(0xa5,0x14);branch(0xd0,'ack');emit(0xe6,0x11,0xa9,1,0x85,0x14,0xa9,0,0x85,0x15);jump('ack');
  label('plan');emit(0xa9,0,0x85,0x15,0xa5,0x12,0xc9,settings.readyMask);branch(0xd0,'ack');emit(0xa9,1,0x85,0x15);
  label('ack');emit(0xa9,0,0x85,0x10);jump('poll');
  fixes.forEach(function(f){var address=labels[f.label];if(f.relative){var offset=address-(f.at+1);if(offset<-128||offset>127)throw Error('Branch out of range.');bytes[f.at]=offset&255;}else{address+=0x8000;bytes[f.at]=address&255;bytes[f.at+1]=address>>8;}});return bytes;
 }
 function rom(){var data=new Uint8Array(16+16384+8192);data.set([0x4e,0x45,0x53,0x1a,1,1,0,0]);data.set(program(),16);for(var i=0;i<3;i++){data[16+0x3ffa+i*2]=0;data[16+0x3ffb+i*2]=0x80;}return data;}
 function create(mission,saved){if(!JSNES||!JSNES.NES)throw Error('Licensed JSNES runtime missing.');var nes=new JSNES.NES({emulateSound:false});nes.loadROM(rom());var mem=nes.cpu.mem;for(var i=0x10;i<=0x15;i++)mem[i]=0;mem[0x11]=1;var events=[],lastMask=null;
  function command(code,input){mem[0x10]=code;mem[0x12]=input||0;var instructions=0,cycles=0;while(mem[0x10]!==0&&instructions<settings.instructionBudget){cycles+=nes.cpu.emulate();instructions++;}if(mem[0x10]!==0)throw Error('Mission VM instruction budget exceeded; fail closed.');var event={seq:events.length+1,command:code,input:input||0,instructions:instructions,cycles:cycles,version:mem[0x11],changed:mem[0x14]===1,approved:mem[0x15]===1};events.push(event);return event;}
  if(saved){if(saved.mission!==mission||!Array.isArray(saved.events))throw Error('Invalid mission restore.');saved.events.forEach(function(e){if(e.command===1){lastMask=null;command(1,0);}else if(e.command===2){lastMask=e.input;command(2,e.input);}else throw Error('Invalid restored command.');});}
  return {clearance:function(){lastMask=null;return command(1,0).version;},plan:function(mask){if(!Number.isInteger(mask)||mask<0||mask>settings.readyMask)throw Error('Invalid readiness mask.');if(mask!==lastMask){command(2,mask);lastMask=mask;}return mem[0x15]===1;},exportLog:function(){return {schema:'hail-emulation-engine/v1',runtime:'JSNES 2.1.0',processor:'NES 2A03 / 6502',mission:mission,programBytes:program(),settings:settings,state:{version:mem[0x11],changed:mem[0x14]===1,approved:mem[0x15]===1},events:JSON.parse(JSON.stringify(events)),limits:['Original homebrew mission program; no third-party ROM or BIOS.','CPU instruction execution only; FPS graphics/physics remain original browser code.','Local adapter is not an authenticated multiplayer authority.']};}};
 }
 return {settings:settings,program:program,rom:rom,create:create};
});
