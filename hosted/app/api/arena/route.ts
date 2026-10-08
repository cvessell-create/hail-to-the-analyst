import {roomDb} from '../../../lib/room-store';
import Arena from '../../../lib/game/server/arena.js';
import Clock from '../../../lib/game/server/request-clock.js';
export async function POST(request:Request){
try {
 const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Same-origin required'},{status:403});
 const raw=await request.text();if(raw.length>4096)return Response.json({error:'Request too large'},{status:413});
 const data=JSON.parse(raw);const db=roomDb();const now=Date.now();
 if(data.action==='create'){
  const arena=Arena.createArena(()=>now);const result=arena.join(data.name);
  for(let attempt=0;attempt<4;attempt++){
   const code=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
   const saved=await db.prepare('INSERT OR IGNORE INTO rooms (code,state,version,updated) VALUES (?, ?, 0, ?)').bind(code,JSON.stringify(arena.exportState()),now).run();
   if(saved.meta.changes)return Response.json({...result,code,dynamicState:arena.dynamicState()});
  }throw Error('Room creation failed. Please retry.');
 }
 const code=String(data.code||'').toUpperCase();if(!/^[A-F0-9]{8}$/.test(code))return Response.json({error:'Enter an eight-character room code.'},{status:422});
 for(let retry=0;retry<8;retry++){
  const row=await db.prepare('SELECT state,version,updated FROM rooms WHERE code=?').bind(code).first<any>();
  if(!row || now-row.updated>86400000)return Response.json({error:'Room expired or not found. Create a new room.'},{status:404});
  let arena=Clock.restoreAndAdvance(JSON.parse(row.state),row.updated,now);
  let result;
  switch(data.action){
   case 'join':result=arena.join(data.name);break;
   case 'sync':arena.input(data.token,data.input);result=arena.snapshot(data.token);break;
   case 'harvest':result=arena.harvest(data.token,data.amount);break;
   case 'round':result=arena.startRound(data.token,data.method);break;
   case 'bid':result=arena.bid(data.token,data.bid);break;
   case 'replay':arena=arena.replay(data.token);result={token:data.token,...arena.snapshot(data.token)};break;
   default:return Response.json({error:'Unknown action'},{status:422});
  }
  const saved=await db.prepare('UPDATE rooms SET state=?,version=version+1,updated=? WHERE code=? AND version=?').bind(JSON.stringify(arena.exportState()),now,code,row.version).run();
  if(saved.meta.changes)return Response.json({...result,code,dynamicState:arena.dynamicState()});
 }
 return Response.json({error:'Room busy; retry shortly.'},{status:409});
}catch(error:any){console.error(error);return Response.json({error:error.status?error.message:'Unable to update room. Please retry.'},{status:error.status||503});}
}
