// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HailTacticalRenderer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function draw(ctx,canvas,scene,width,height,fov,columns,zbuf,art){
    var camera=scene.camera,h=height*.54,focal=width/2/Math.tan(fov/2);
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,h);ctx.clip();
    ctx.fillStyle='#18241f';ctx.fillRect(0,0,width,h/2);
    ctx.fillStyle='#20271f';ctx.fillRect(0,h/2,width,h/2);
    scene.tiles.forEach(function(tile){
      var points=tile.points.map(function(p){
        var dx=p.x-camera.x,dy=p.y-camera.y;
        return {depth:dx*Math.cos(camera.a)+dy*Math.sin(camera.a),side:-dx*Math.sin(camera.a)+dy*Math.cos(camera.a)};
      }),clipped=[];
      for(var i=0;i<points.length;i++){
        var p=points[i],q=points[(i+1)%points.length];
        if(p.depth>=.08)clipped.push(p);
        if((p.depth>=.08)!==(q.depth>=.08)){
          var t=(.08-p.depth)/(q.depth-p.depth);
          clipped.push({depth:.08,side:p.side+(q.side-p.side)*t});
        }
      }
      if(clipped.length<3)return;
      ctx.beginPath();
      clipped.forEach(function(p,i){
        var x=width/2+p.side*focal/p.depth,y=h/2+focal*.5/p.depth;
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      });
      ctx.closePath();ctx.fillStyle=tile.color;ctx.fill();
      ctx.strokeStyle='#93a59c';ctx.lineWidth=1;ctx.stroke();
    });
    for(var col=0;col<columns;col++){
      var a=camera.a+Math.atan((2*col/columns-1)*Math.tan(fov/2)),hit=scene.castRay(a);
      var dist=Math.max(.03,hit.distance),line=Math.min(h*4,focal/dist);
      zbuf[col]=dist;ctx.fillStyle=art.wallColor(hit.cell,hit.side,hit.texture,(h-line)/2,dist);
      ctx.fillRect(col*2,(h-line)/2,2,line);
    }
    var labels=[];
    scene.sprites.slice().sort(function(a,b){
      return Math.hypot(b.o.x-camera.x,b.o.y-camera.y)-Math.hypot(a.o.x-camera.x,a.o.y-camera.y);
    }).forEach(function(it){
      var o=it.o,dx=o.x-camera.x,dy=o.y-camera.y,dist=Math.hypot(dx,dy);
      var angle=Math.atan2(Math.sin(Math.atan2(dy,dx)-camera.a),Math.cos(Math.atan2(dy,dx)-camera.a));
      if(dist<.05||Math.abs(angle)>fov*.75)return;
      var depth=dist*Math.cos(angle),x=width/2+Math.tan(angle)*focal;
      var size=(it.kind==='enemy'?(o.type==='TROLL'?1:.75):it.kind==='pick'?.42:.08)*focal/depth;
      var top=h/2+focal*.5/depth-size;
      if(it.kind==='pick')top+=Math.sin(o.bob)*7;
      var l=Math.max(0,Math.floor((x-size/2)/2)),r=Math.min(columns,Math.ceil((x+size/2)/2)),visible=false;
      ctx.save();ctx.beginPath();
      for(var c=l;c<r;c++)if(depth<zbuf[c]){ctx.rect(c*2,0,2,h);visible=true;}
      if(!visible){ctx.restore();return;}
      ctx.clip();ctx.translate(x,top);
      if(it.kind==='enemy')art.drawEnemy(o,size);
      else if(it.kind==='pick')art.drawPickup(o,size);
      else{ctx.fillStyle='#79ff4d';ctx.fillRect(-size/2,size*.8,size,size*.2);}
      ctx.restore();
      if(o.label)labels.push({text:o.label,x:x,y:Math.max(42,Math.min(h-18,top-8)),
        color:o.side==='fabricator'?'#ffb6ad':o.side==='analyst'?'#84e5c4':it.kind==='move'?'#79ff4d':'#ffd020'});
    });
    var font=Math.max(13,13*width/(canvas.clientWidth||width)),spacing=font+7,minY=font*3,placed=[];
    labels.forEach(function(label){
      ctx.font='bold '+font+'px Courier New';ctx.textAlign='center';
      var w=ctx.measureText(label.text).width+8,x=Math.max(w/2+4,Math.min(width-w/2-4,label.x)),y=Math.max(minY,label.y);
      for(var tries=0;tries<12&&placed.some(function(p){return Math.abs(p.x-x)<(p.width+w)/2+4&&Math.abs(p.y-y)<spacing;});tries++){
        y=minY+(y-minY+spacing)%Math.max(spacing,h-minY-spacing);
      }
      placed.push({x:x,y:y,width:w});
      ctx.fillStyle='rgba(0,0,0,.9)';ctx.fillRect(x-w/2,y-font-1,w,spacing-2);
      ctx.fillStyle=label.color;ctx.fillText(label.text,x,y);
    });
    art.drawWeapon(camera,h);
    ctx.fillStyle='#fff2b8';ctx.font='bold 15px Courier New';ctx.textAlign='left';
    ctx.fillText('JACK’S VIEW // TURN-BASED ORDERS',18,24);
    ctx.restore();
  }
  return {draw:draw};
});
