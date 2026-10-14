// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HailFootprintOps=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var TILE='e';
  var WEIGHTS=Object.freeze({critical:1000,high:750,medium:500,low:250});
  var COLORS=Object.freeze({critical:'#ff3b30',high:'#ff922b',medium:'#ffe14a',low:'#999999'});
  var FIXES=Object.freeze({
    data_broker:"Submit the broker's opt-out or deletion request; re-check after it processes",
    dark_web:'Change the leaked password everywhere it was reused and enable two-factor authentication where available',
    account:'Sign in, export what you need, then request deletion via account settings or support',
    leaked_domain:"Report it to the host's abuse contact or your removal service; rotate exposed credentials"
  });
  var catalogue=Object.freeze([
    {id:'F1',name:'BROKERLINE PEOPLE-INDEX',domain:'brokerline-index.example',category:'data_broker',severity:'critical',x:4,y:2},
    {id:'F2',name:'SHADOWMART PASTE',domain:'shadowmart-paste.example',category:'dark_web',severity:'critical',x:11,y:2},
    {id:'F3',name:'OLDPLAY ACCOUNT',domain:'oldplay-account.example',category:'account',severity:'high',x:2,y:4},
    {id:'F4',name:'LEAKY MIRROR',domain:'leaky-mirror.example',category:'leaked_domain',severity:'high',x:13,y:4},
    {id:'F5',name:'DUSTVAULT INDEX',domain:'dustvault-index.example',category:'data_broker',severity:'medium',x:5,y:6},
    {id:'F6',name:'GLOOMCACHE DUMP',domain:'gloomcache-dump.example',category:'dark_web',severity:'medium',x:10,y:6},
    {id:'F7',name:'QUIETPIXEL ACCOUNT',domain:'quietpixel-account.example',category:'account',severity:'low',x:3,y:8},
    {id:'F8',name:'ECHOCRATE MIRROR',domain:'echocrate-mirror.example',category:'leaked_domain',severity:'low',x:12,y:8}
  ].map(function(node,i){return Object.freeze(Object.assign({},node,{difficulty:['hard','impossible','easy','hard','medium','impossible','easy','medium'][i],fix:FIXES[node.category]}));}));
  function level(){
    var map=Array.from({length:11},function(_,y){return Array.from({length:16},function(_,x){return x===0||y===0||x===15||y===10?'#':'.';});});
    map[1][1]='P';map[9][14]='X';map[5][2]='h';map[5][13]='b';
    catalogue.forEach(function(node){map[node.y][node.x]=TILE;});
    return {name:'FOOTPRINT PURGE',requires:'footprints',sideQuest:true,objective:'Scrub every critical exposure. Then return to the signal exchange.',
      brief:'A training simulation with entirely fictional digital-footprint exposures, invented services and .example domains. Walk into easy or medium nodes to scrub them. Stand still on hard nodes for 1.5 seconds. Impossible nodes cannot be deleted: LOCKED DOWN means credential containment, not erasure, and counts as handled in this simulation. Red means CRITICAL, orange HIGH, yellow MEDIUM and grey LOW. Scrub every critical node before using the exit; optional scrubs earn extra intel. No real accounts, people or services are contacted or changed. These generic methods are real-world guidance, not promises: availability and legal retention vary; removal is not guaranteed.<br><br>'+Object.keys(FIXES).map(function(category){return '<b>'+category.replace(/_/g,' ').toUpperCase()+'</b>: '+FIXES[category];}).join('<br>'),
      map:map.map(function(row){return row.join('');})};
  }
  function createState(){return {time:0,scrubbed:[],intel:0};}
  function exposure(id){return catalogue.find(function(node){return node.id===id;});}
  function score(severity){if(!Object.prototype.hasOwnProperty.call(WEIGHTS,severity))throw Error('Unknown footprint severity.');return WEIGHTS[severity];}
  function scrub(state,id){
    var node=exposure(id);if(!node)throw Error('Unknown fictional exposure.');
    if(state.scrubbed.some(function(row){return row.id===id;}))return state;
    if(!Number.isFinite(state.time)||state.time<0||(state.scrubbed.length&&state.time<state.scrubbed[state.scrubbed.length-1].t))throw Error('Invalid footprint simulation time.');
    return {time:state.time,scrubbed:state.scrubbed.concat([{id:id,t:state.time}]),intel:state.intel+score(node.severity)};
  }
  function criticalRemaining(state){return catalogue.filter(function(node){return node.severity==='critical'&&!state.scrubbed.some(function(row){return row.id===node.id;});}).length;}
  function exitOpen(state){return criticalRemaining(state)===0;}
  function episode(state){return state.scrubbed.map(function(row){var node=exposure(row.id);return {id:node.id,category:node.category,severity:node.severity,difficulty:node.difficulty,t:row.t};});}
  return {FIXES:FIXES,TILE:TILE,WEIGHTS:WEIGHTS,COLORS:COLORS,catalogue:catalogue,level:level,createState:createState,exposure:exposure,score:score,scrub:scrub,criticalRemaining:criticalRemaining,exitOpen:exitOpen,episode:episode};
});
