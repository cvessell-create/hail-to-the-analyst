// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HailSoloExpansion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
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
  function levels(){
    return [
      {name:'FROST YARD',outdoor:true,requires:'red',objective:'Recover red clearance and cross the ice-droid yard.',
        brief:'A larger, open-air training yard is guarded by <b>ICE PIG DROIDS</b>: original robotic opponents with armored snouts and icy plating. Collect a <b>JETPACK</b>, hold <b>J / JET</b> to hover, and search for fuel canisters. Fuel never regenerates. Hovering avoids ground melee, not walls or aimed projectiles. Recover red clearance and reach extraction.',
        map:arena(32,26,false)},
      {name:'STARLIGHT BOULEVARD',outdoor:true,theme:'city',requires:'red',objective:'Recover theater clearance and extract through the city district.',
        brief:'An original Hollywood-inspired district: neon theaters, palm-lined streets, star-patterned sidewalks and a <b>STARLIGHT</b> hillside sign. Ice pig droids patrol the boulevard. Search the side streets for red clearance, ammunition and jet fuel before reaching extraction. All scenery is original; no movie characters, celebrity likenesses or studio logos are used.',
        map:city()},
      {name:'GLACIER DOCK',outdoor:true,requires:'blue-boss',objective:'Recover blue clearance, disable the dock controller and extract.',
        brief:'The final 36-by-28 dock has wider patrol lanes, fuel caches and another automated controller. Ice pig droids rush on the ground; drones and controllers can aim at your flight altitude. Recover <b>BLUE CLEARANCE</b>, disable the controller and use the marked exit. These machines are fictional training opponents, not real people or institutions.',
        map:arena(36,28,true)}
    ];
  }
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
  return {levels:levels,flight:flight,ready:ready,pig:pig,backdrop:backdrop,scenery:scenery};
});
