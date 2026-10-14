// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function(root,factory){
  'use strict';
  var tuning=root.HailLevelTuning||(typeof require==='function'?require('./level-tuning.js'):null);
  var api=factory(tuning);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HailSoloExpansion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(tuning){
  'use strict';
  // Airspace layer: 'L' is a low rooftop. It blocks ground movement and low shots;
  // a jetpack at ROOF altitude flies over it and can stand on it.
  var ROOF=0.9,ROOF_FRAC=0.7;
  function rooftop(grid,x0,y0,w,h,courtyard,loot){
    for(var y=y0;y<y0+h;y++)for(var x=x0;x<x0+w;x++){
      var edge=y===y0||y===y0+h-1||x===x0||x===x0+w-1;
      grid[y][x]=courtyard&&!edge?'.':'L';
    }
    (loot||[]).forEach(function(item,i){grid[y0+1+Math.floor(i/(w-2))][x0+1+i%(w-2)]=item;});
  }
  function roofBlocks(tile,height){return tile==='L'&&!((height||0)>=ROOF-1e-9);}
  function standing(tile,height){return tile==='L'?Math.max(ROOF,height||0):height;}
  function arena(width,height,final){
    var grid=Array.from({length:height},function(_,y){
      return Array.from({length:width},function(_,x){return x===0||y===0||x===width-1||y===height-1?'#':'.';});
    });
    [10,22].forEach(function(x){
      for(var y=2;y<height-2;y++)grid[y][x]='I';
      grid[6][x]='D';grid[height-7][x]=x===22?(final?'B':'R'):'D';
    });
    for(var y=9;y<height-5;y+=5)for(var x=3;x<width-3;x+=6){
      if(grid[y][x]==='.')grid[y][x]='I';
    }
    rooftop(grid,13,18,5,5,true,['v','a','i']);
    rooftop(grid,25,11,3,2,false);
    var items=[
      [1,1,'P'],[2,1,'j'],[4,2,'v'],[6,3,'b'],[7,5,'h'],
      [8,6,'p'],[6,11,'p'],[4,15,'a'],[8,height-4,'v'],
      [13,6,'p'],[16,9,'b'],[18,12,'p'],[14,16,'h'],
      [20,height-8,final?'q':'r'],[18,height-4,'v'],
      [25,6,'p'],[width-5,10,'d'],[26,16,'s'],
      [width-4,height-5,final?'F':'p'],[width-3,height-3,'X'],
      [width-6,height-4,'h'],[25,height-4,'v']
    ];
    items.forEach(function(item){grid[item[1]][item[0]]=item[2];});
    return grid.map(function(row){return row.join('');});
  }
  // Evidence-status rules adapted from the VessellFramework Evidence Dossier method
  // (Vessel_Evidence_Assurance_Validation_Orchestrator_SKILL_v0.1.md). Method only; no personal data.
  var DOSSIER_FILES=[
    'SEARCH SNIPPETS ARE LEADS, NOT EVIDENCE.',
    'COPIES OF ONE SOURCE ARE ONE LINEAGE.',
    'PRESTIGE DOES NOT PROVE RELEVANCE.',
    'CURRENT CLAIMS NEED CURRENT EVIDENCE.',
    'WORKING HYPOTHESIS IS NOT ESTABLISHED.',
    'RECORD THE CONTRARY EVIDENCE.'];
  function dossierFile(n){return 'FILE '+(n%DOSSIER_FILES.length+1)+'/'+DOSSIER_FILES.length+': '+DOSSIER_FILES[n%DOSSIER_FILES.length];}
  function dossier(){
    var W=40,H=32,grid=Array.from({length:H},function(_,y){
      return Array.from({length:W},function(_,x){return x===0||y===0||x===W-1||y===H-1?'#':'.';});
    });
    var xs=[3,12,21,30],ys=[3,13,23];
    var fill=[['i','d','m','i'],['a','F','v','q'],['h','i','d','s']];
    ys.forEach(function(y0,r){xs.forEach(function(x0,c){
      var wall=(r+c)%2?'N':'I';
      for(var i=0;i<7;i++){grid[y0][x0+i]=wall;grid[y0+6][x0+i]=wall;grid[y0+i][x0]=wall;grid[y0+i][x0+6]=wall;}
      grid[y0][x0+3]='D';grid[y0+6][x0+3]='D';grid[y0+3][x0]='D';grid[y0+3][x0+6]='D';
      grid[y0+3][x0+3]=fill[r][c];
    });});
    [[2,2,'P'],[3,1,'j'],[10,10,'d'],[28,10,'d'],[19,20,'d'],[37,20,'m'],[10,20,'t'],[28,1,'i'],
     [19,11,'h'],[37,11,'a'],[2,20,'b'],[19,30,'v'],[37,30,'X'],[35,30,'h'],[11,30,'d'],[29,21,'m'],[24,11,'p'],[6,21,'p'],
     [24,1,'L'],[15,11,'L'],[33,21,'L'],[6,11,'L']]
      .forEach(function(it){grid[it[1]][it[0]]=it[2];});
    return grid.map(function(row){return row.join('');});
  }
  function levels(){
    return [
      {name:'FROST YARD',outdoor:true,fx:'frost-snow',requires:'red',objective:'Recover red clearance and cross the ice-droid yard.',
        brief:'A larger, open-air training yard is guarded by <b>ICE PIG DROIDS</b>: original robotic opponents with armored snouts and icy plating. Collect a <b>JETPACK</b>, hold <b>J / JET</b> to hover, and search for fuel canisters. Fuel never regenerates. Hovering avoids ground melee, not walls or aimed projectiles. Recover red clearance and reach extraction.',
        map:arena(32,26,false)},
      {name:'STARLIGHT BOULEVARD',outdoor:true,theme:'city',fx:'neon-city',requires:'red',objective:'Recover theater clearance and extract through the city district.',
        brief:'An original Hollywood-inspired district: neon theaters, palm-lined streets, star-patterned sidewalks and a <b>STARLIGHT</b> hillside sign. Ice pig droids patrol the boulevard. Search the side streets for red clearance, ammunition and jet fuel before reaching extraction. All scenery is original; no movie characters, celebrity likenesses or studio logos are used.',
        map:city()},
      {name:'GLACIER DOCK',outdoor:true,fx:'glacier-blizzard',requires:'blue-boss',objective:'Recover blue clearance, disable the dock controller and extract.',
        brief:'The final 36-by-28 dock has wider patrol lanes, fuel caches and another automated controller. Ice pig droids rush on the ground; drones and controllers can aim at your flight altitude. Recover <b>BLUE CLEARANCE</b>, disable the controller and use the marked exit. These machines are fictional training opponents, not real people or institutions.',
        map:arena(36,28,true)},
      {name:'SKYLINE DISTRICT',outdoor:true,theme:'city',fx:'neon-city',requires:'blue-boss',
        objective:'Search the buildings for blue clearance, disable the plaza controller and extract.',
        brief:'An original night cityscape built from the training loop data. Streets run between <b>enterable buildings</b> (use the doors) and flat <b>ROOFTOPS</b>. Climb to altitude 0.9 on the <b>JETPACK</b> to fly over a roof, land on it, and shoot down into the streets; walled rooftop courtyards hide supplies that can only be reached from the air. Recover <b>BLUE CLEARANCE</b>, disable the plaza controller and extract at the far corner.',
        tuning:tuning?{enemies:tuning.enemies,fuelCaches:tuning.fuelCaches,healthKits:tuning.healthKits,source:tuning.source}:null,
        map:skyline(tuning)},
      {name:'SHADOW DOSSIER',theme:'dossier',fx:'neon-city',requires:'blue-boss',dossier:true,
        objective:'Recover blue clearance, shut down the aggregator and extract.',
        brief:'A fictional surveillance vault where an automated <b>AGGREGATOR</b> stitches scraps into dossiers. Glass cells hold <b>EVIDENCE FILES</b>; each one teaches a sourcing rule. Watcher drones patrol the halls. Recover <b>BLUE CLEARANCE</b>, shut down the aggregator in the central vault and extract. No real accounts, people or agencies are depicted.',
        map:dossier()}
    ];
  }
  function skyline(t){
    var W=44,H=36,grid=Array.from({length:H},function(_,y){
      return Array.from({length:W},function(_,x){return x===0||y===0||x===W-1||y===H-1?'#':'.';});
    });
    var xs=[3,13,23,33],ys=[3,11,19,27];
    var plan=[['building','rooftop','building','courtyard'],['rooftop','plaza','building','rooftop'],
      ['building','courtyard','rooftop','building'],['courtyard','building','plaza','rooftop']];
    var special={'1,2':'q','2,3':'a','0,0':'i','3,1':'h'},n=0;
    plan.forEach(function(row,r){row.forEach(function(kind,c){
      var x0=xs[c],y0=ys[r];
      if(kind==='rooftop')rooftop(grid,x0,y0,8,6,false);
      else if(kind==='courtyard')rooftop(grid,x0,y0,8,6,true,['v','i','a']);
      else if(kind==='plaza'){[[0,0],[7,0],[0,5],[7,5]].forEach(function(o){grid[y0+o[1]][x0+o[0]]='T';});
        if(r===1)grid[y0+3][x0+4]='F';}
      else{
        var wall=(n++)%2?'N':'C';
        for(var y=y0;y<y0+6;y++)for(var x=x0;x<x0+8;x++)
          grid[y][x]=y===y0||y===y0+5||x===x0||x===x0+7?wall:'.';
        grid[y0+5][x0+3]='D';grid[y0+1][x0+4]=wall;grid[y0+2][x0+4]=wall;
        grid[y0+1][x0+2]=special[r+','+c]||'b';grid[y0+3][x0+6]='h';
      }
    });});
    var streets=[];
    [1,9,17,25,33].forEach(function(y,i){[6,16,26,36].forEach(function(x,j){streets.push([x,y+(i+j)%2]);});});
    [1,11,21,31,41].forEach(function(x,i){[6,14,22,30].forEach(function(y,j){streets.push([x+(i+j)%2,y]);});});
    streets=streets.filter(function(p){return Math.hypot(p[0]-1,p[1]-1)>8;});
    var order=streets.map(function(_,i){return (i*7)%streets.length;});
    var count=t?t.enemies:12,fuel=t?t.fuelCaches:3,health=t?t.healthKits:3,types='pdmpdt',k=0;
    for(var e=0;e<count;e++)grid[streets[order[k]][1]][streets[order[k++]][0]]=types[e%types.length];
    for(var f=0;f<fuel;f++)grid[streets[order[k]][1]][streets[order[k++]][0]]='v';
    for(var h=0;h<health;h++)grid[streets[order[k]][1]][streets[order[k++]][0]]='h';
    [[11,2],[32,9],[11,26],[41,25]].forEach(function(p){if(grid[p[1]][p[0]]==='.')grid[p[1]][p[0]]='U';});
    grid[1][1]='P';grid[1][2]='j';grid[2][1]='v';grid[H-2][W-2]='X';
    return grid.map(function(row){return row.join('');});
  }
  // Metro: walkable 'U' tiles; E on a station calls a train to the next one (free).
  var METRO_WAIT=1.2;
  function stations(map){var out=[];for(var y=0;y<map.length;y++)for(var x=0;x<map[y].length;x++)if(map[y][x]==='U')out.push({x:x,y:y});return out;}
  function nextStation(map,x,y){var all=stations(map),i=all.findIndex(function(s){return s.x===Math.floor(x)&&s.y===Math.floor(y);});return i<0||all.length<2?null:all[(i+1)%all.length];}
  function city(){
    var grid=arena(40,30,false).map(function(row){return row.replace(/I/g,'C').split('');});
    for(var y=3;y<20;y++)grid[y][10]='.';
    for(var y=5;y<20;y++)grid[y][22]='.';
    for(var y=8;y<=12;y++)for(var x=12;x<=16;x++)grid[y][x]=y===8||y===12||x===12||x===16?'N':'.';
    grid[10][12]='D';
    grid[10][14]='h';
    for(var y=15;y<=19;y++)for(var x=26;x<=31;x++)grid[y][x]=y===15||y===19||x===26||x===31?'C':'.';
    grid[17][26]='D';
    grid[17][29]='a';grid[18][28]='b';
    for(var y=5;y<25;y+=6){grid[y][3]='T';grid[y][7]='T';grid[y][34]='T';}
    grid[10][17]='b';grid[14][24]='v';grid[18][24]='h';
    return grid.map(function(row){return row.join('');});
  }
  function flight(player,held,dt){
    if(!Number.isFinite(dt)||dt<0||dt>1)throw Error('Invalid jetpack step.');
    if(player.jetpack!==undefined&&typeof player.jetpack!=='boolean')throw Error('Invalid jetpack equipment.');
    var height=player.height===undefined?0:player.height,fuel=player.fuel===undefined?0:player.fuel;
    if(!Number.isFinite(height)||height<0||height>1.5||!Number.isFinite(fuel)||fuel<0||fuel>100)throw Error('Invalid jetpack state.');
    var powered=Boolean(player.jetpack&&held&&fuel>0),burn=powered?Math.min(dt,fuel/16):0;
    return {height:Math.max(0,Math.min(1.5,height+burn*1.6-(dt-burn)*1.8)),fuel:Math.max(0,fuel-burn*16),powered:powered};
  }
  function ready(level,player,bossDead){
    if(level.requires==='red')return Boolean(player.red);
    if(level.requires==='blue-boss')return Boolean(player.blue&&bossDead);
    if(level.requires==='boss')return Boolean(bossDead);
    throw Error('Unknown solo exit requirement.');
  }
  function pig(ctx,s,phase){
    ctx.fillStyle='#193e59';ctx.fillRect(-s*.48,s*.3,s*.96,s*.43);
    ctx.fillStyle='#a7eaff';ctx.fillRect(-s*.4,s*.21,s*.8,s*.36);
    ctx.fillStyle='#5ba4cb';ctx.fillRect(-s*.29,s*.04,s*.58,s*.38);
    ctx.fillStyle='#d9f8ff';ctx.fillRect(-s*.28,0,s*.15,s*.17);ctx.fillRect(s*.13,0,s*.15,s*.17);
    ctx.fillStyle='#c3f4ff';ctx.fillRect(-s*.28,s*.32,s*.56,s*.2);
    ctx.fillStyle='#244a66';ctx.fillRect(-s*.17,s*.37,s*.09,s*.08);ctx.fillRect(s*.08,s*.37,s*.09,s*.08);
    ctx.fillStyle='#ff6587';ctx.fillRect(-s*.22,s*.2,s*.12,s*.055);ctx.fillRect(s*.1,s*.2,s*.12,s*.055);
    ctx.fillStyle='#effcff';ctx.fillRect(-s*.36,s*.35,s*.09,s*.21);ctx.fillRect(s*.27,s*.35,s*.09,s*.21);
    ctx.fillStyle='#2e5b78';
    [-.35,-.12,.12,.35].forEach(function(x,i){ctx.fillRect(x*s,s*(.67+Math.sin(phase*8+i)*.025),s*.11,s*.2);});
    ctx.fillStyle='#ffffff';ctx.fillRect(-s*.3,s*.27,s*.18,s*.035);ctx.fillRect(s*.12,s*.27,s*.18,s*.035);
  }
  function backdrop(ctx,w,h,angle,theme){
    if(theme!=='city')return;
    var offset=angle*110,period=w*2;
    ctx.fillStyle='#574066';
    for(var i=-1;i<4;i++){
      var x=((i*w-offset)%period+period)%period-w;
      ctx.beginPath();ctx.moveTo(x,h*.5);ctx.lineTo(x+w*.25,h*.18);ctx.lineTo(x+w*.65,h*.3);ctx.lineTo(x+w,h*.5);ctx.fill();
    }
    var sign=((w*.7-offset)%period+period)%period-w*.5;
    ctx.fillStyle='#fff2cb';ctx.font='900 28px Courier New';ctx.textAlign='center';ctx.fillText('STARLIGHT',sign,h*.24);
    ctx.fillStyle='#151b35';
    for(var n=-1;n<14;n++){var bx=((n*95-offset*.6)%period+period)%period-95;ctx.fillRect(bx,h*.42-(n%4+4)%4*13,66,h*.13);}
  }
  function scenery(ctx,s,tile,phase){
    if(tile==='T'){
      ctx.fillStyle='#94653e';ctx.fillRect(-s*.045,s*.3,s*.09,s*.7);
      ctx.strokeStyle='#60a977';ctx.lineWidth=Math.max(2,s*.045);
      for(var i=0;i<7;i++){var a=i*Math.PI/3.5+Math.sin(phase)*.015;ctx.beginPath();ctx.moveTo(0,s*.32);ctx.lineTo(Math.cos(a)*s*.35,s*.3+Math.sin(a)*s*.2);ctx.stroke();}
    }else{
      var label=tile==='N'?'NEON THEATER':'STAR CINEMA';
      ctx.fillStyle='#180f29';ctx.fillRect(-s*.5,s*.25,s,s*.22);
      ctx.strokeStyle=tile==='N'?'#ff66c4':'#ffd27b';ctx.lineWidth=2;ctx.strokeRect(-s*.5,s*.25,s,s*.22);
      ctx.fillStyle='#fff2da';ctx.font='900 '+Math.max(9,s*.07)+'px Courier New';ctx.textAlign='center';ctx.fillText(label,0,s*.4);
    }
  }
  return {METRO_WAIT:METRO_WAIT,stations:stations,nextStation:nextStation,ROOF:ROOF,ROOF_FRAC:ROOF_FRAC,roofBlocks:roofBlocks,standing:standing,skyline:skyline,levels:levels,dossier:dossier,dossierFile:dossierFile,DOSSIER_FILES:DOSSIER_FILES,flight:flight,ready:ready,pig:pig,backdrop:backdrop,scenery:scenery};
});
