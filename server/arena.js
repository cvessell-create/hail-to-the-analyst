// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const crypto = require('node:crypto');
const Engine = require('../engine/core.js');
const Systems = require('../engine/systems.js');
const Fair = require('../engine/fair-division.js');
const MathEngine = require('../engine/math.js');
const Power = require('../js/power-index.js');
const Reserve = require('../engine/static-reserve.js');
function createArena(now = () => Date.now(), options = {}) {
  const scene = Systems.validateScene(options.scene || options.saved?.scene || MathEngine.environment(Systems.defaultScene()).scene), sessions = new Map();
  let tick = 0, round = null, roundId = 0, phase = 'playing', locked = false, influenceModel = null;
  let powerCellConsumed = false, rewardCacheConsumed = false, treasury = Fair.fraction(0);
  const receipts = [], events = []; let droppedEvents=0;
  function event(type,data) { events.push({tick,time:now(),type,...data});if(events.length>1000){events.shift();droppedEvents++;} }
  const spawns = options.enemySpawns || [{ x: 8.5, y: 1.5 }, { x: 8.5, y: 5.5 }, { x: 1.5, y: 5.5 }];
  const levels = MathEngine.npcLevels(spawns.map(() => 40), spawns.length + 2).allocations;
  const enemies = spawns.map((spawn, i) => ({ id: `counter-${i}`, level: levels[i], hp: 30 + 10 * levels[i],
    maxHp: 30 + 10 * levels[i], cooldown: 1, world: Engine.createWorld({ grid: scene.grid, ...spawn }) }));
  if (options.saved) {
    const v=options.saved; events.push(...(v.events||[]));droppedEvents=v.droppedEvents||0;tick=v.tick; roundId=v.roundId; phase=v.phase; locked=v.locked; influenceModel=v.influenceModel; powerCellConsumed=v.powerCellConsumed; rewardCacheConsumed=v.rewardCacheConsumed; treasury=v.treasury; receipts.push(...v.receipts);
    for (const [token,p] of v.sessions) sessions.set(token,{...p,world:Engine.createWorld({grid:scene.grid,...p.position})});
    v.enemies.forEach((e,i)=>Object.assign(enemies[i],e,{world:Engine.createWorld({grid:scene.grid,...e.position})}));
    if(v.round) round={...v.round,players:v.round.playerTokens.map(token=>sessions.get(token)),bids:new Map(v.round.bids)};
  }
  function allies() { return Array.from(sessions.values()); }
  function damage(player, amount) { const before=player.hp;player.hp = Math.max(0, player.hp - amount);event("health_changed",{player:player.id,before,after:player.hp,reserveRecomputed:false}); }
  function settleCombat() {
    if (phase !== 'playing' || !locked) return;
    const players = allies();
    if (players.every(player => player.hp <= 0)) { phase = 'lost';event("encounter_lost",{reserve:Reserve.fromModel(influenceModel)}); return; }
    if (enemies.every(enemy => enemy.hp <= 0)) {
      phase = 'won';event('encounter_won',{});
      for (const player of players) {
        const power = Power.reward(influenceModel, player.id, players.filter(p => p.hp > 0).map(p => p.id));
        player.xp += power.xp; player.influence = power;
        player.level = Math.max(player.level, Math.min(5, 1 + Math.floor(player.xp / 300)));
        event("xp_realized",{player:player.id,reserve:Reserve.fromModel(influenceModel).players.find(p=>p.id===player.id),survived:player.hp>0,critical:power.critical,awardedXp:power.xp,cumulativeXp:player.xp,nextLevel:player.level,formula:"alive?min(cap,floor(baseReserve)+25*critical):0"});
      }
    }
  }
  function session(token) {
    const player = sessions.get(token);
    if (!player || now() - player.seen > 120000) throw Object.assign(Error('Unknown or expired session.'), { status: 401 });
    player.seen = now(); return player;
  }
  function snapshot(token) {
    const viewer = session(token);
    return { tick, you: viewer.id, scene, strategy:influenceModel&&Reserve.fromModel(influenceModel),audit:{events,droppedEvents,retentionLimit:1000}, players: Array.from(sessions.values(), player => ({
      id: player.id, name: player.name, ...player.world.position(), sequence: player.sequence,
      credits: player.credits, inventory: player.inventory, hp: player.hp, level: player.level,
      xp: player.xp, damage: player.damage, influence: player.influence, power: player.power })),
    economy: { treasury, receipts, powerCellConsumed, rewardCacheConsumed },
    combat: { phase, locked, enemies: enemies.map(enemy => ({ id: enemy.id, hp: enemy.hp,
      maxHp: enemy.maxHp, level: enemy.level, ...enemy.world.position() })),
    payoff: phase === 'playing' ? null : { team: phase === 'won' ? 1 : -1, npc: phase === 'won' ? -1 : 1,
      individuals: allies().map(player => ({ id: player.id, utility: (phase === 'won' ? 100 : 0) +
        player.damage / 10 - (100 - player.hp) / 10 })) } },
    round: round && { id: round.id, method: round.method, players: round.players.map(player => ({ id: player.id, name: player.name })),
      goods: round.goods, state: round.state, submitted: Array.from(round.bids.keys()), deadline: round.deadline,
      result: round.result, reason: round.reason } };
  }
  return {
    exportState() {
      const encode=p=>{const {world,...rest}=p;return {...rest,position:world.position()};};
      return {events,droppedEvents,tick,roundId,phase,locked,influenceModel,powerCellConsumed,rewardCacheConsumed,treasury,receipts,scene,sessions:Array.from(sessions,([token,p])=>[token,encode(p)]),enemies:enemies.map(encode),round:round&&{...round,players:undefined,playerTokens:round.players.map(p=>Array.from(sessions).find(([token,q])=>q===p)[0]),bids:Array.from(round.bids)}};
    },
    join(name) {
      if (typeof name !== 'string' || !name.trim() || name.length > 32) throw Object.assign(Error('Name must be 1-32 characters.'), { status: 422 });
      if (sessions.size >= 8) throw Object.assign(Error('Arena full.'), { status: 409 });
      if (locked) throw Object.assign(Error('Combat roster locked after the first shot. Join before combat starts.'), { status: 409 });
      const index = sessions.size, spawn = scene.objects.find(item => item.type === 'spawn');
      const token = crypto.randomBytes(24).toString('hex'), player = {
        id: crypto.randomUUID(), name: name.trim(), seen: now(), sequence: 0,
        input: { forward: 0, strafe: 0, turn: 0, fire: false }, inputTime: 0, credits: Fair.fraction(1000), inventory: [],
        hp: 100, maxHp: 100, level: 1, xp: 0, damage: 0, cooldown: 0, influence: null, power: 0,
        world: Engine.createWorld({ grid: scene.grid, x: spawn.x + index * 0.6, y: spawn.y, angle: 0 })
      };
      sessions.set(token, player);event("joined",{player:player.id,name:player.name,maxHp:player.maxHp,level:player.level});
      return { token, ...snapshot(token) };
    },
    snapshot,
    input(token, input) {
      const player = session(token);
      if (!input || Object.keys(input).sort().join(',') !== 'fire,forward,sequence,strafe,turn' ||
          !Number.isSafeInteger(input.sequence) || input.sequence <= player.sequence ||
          typeof input.fire !== 'boolean' ||
          ![input.forward, input.strafe, input.turn].every(value => Number.isFinite(value) && Math.abs(value) <= 1)) {
        throw Object.assign(Error('Invalid or replayed input.'), { status: 422 });
      }
      event("input_accepted",{player:player.id,sequence:input.sequence,forward:input.forward,strafe:input.strafe,turn:input.turn,fire:input.fire});
      player.sequence = input.sequence; player.input = input; player.inputTime = now();
      return { sequence: player.sequence };
    },
    step(dt = 1 / 60) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw Error('Invalid authoritative tick.');
      tick++;
      for (const [token, player] of sessions) {
        if (now() - player.seen > 120000) {
          if (round?.state === 'bidding' && round.players.includes(player)) { round.state = 'cancelled'; round.reason = 'Participant disconnected.'; }
          if (locked) { player.hp = 0; player.input = { forward: 0, strafe: 0, turn: 0, fire: false }; }
          else { sessions.delete(token); continue; }
        }
        if (phase !== 'playing' || player.hp <= 0) continue;
        const input = now() - player.inputTime > 250 ? { forward: 0, strafe: 0, turn: 0, fire: false } : player.input;
        player.world.turn(input.turn * 2 * dt); player.world.move(input.forward, input.strafe, 2.25 * dt);
        player.cooldown = Math.max(0, player.cooldown - dt);
        if (input.fire && player.cooldown <= 0) {
          if (round?.state === 'bidding') { round.state = 'cancelled'; round.reason = 'Combat interrupted bidding; no transfers.'; }
          if (!locked) {
            locked = true;
            influenceModel = Power.encounter(allies(), enemies);event("reserve_locked",{reserve:Reserve.fromModel(influenceModel),inputs:allies().map(p=>({id:p.id,maxHp:p.maxHp,level:p.level})),enemyMaxHp:enemies.reduce((s,e)=>s+e.maxHp,0),weightFormula:"ceil(maxHp/4)+2*level",quotaFormula:"ceil(sumWeights*(0.5+min(0.4,enemyMaxHp/2000)))"});
          }
          player.cooldown = 0.3;
          const p = player.world.position();
          const target = enemies.filter(enemy => enemy.hp > 0).map(enemy => {
            const e = enemy.world.position(), angle = Math.atan2(e.y - p.y, e.x - p.x) - p.angle;
            return { enemy, distance: Math.hypot(e.x - p.x, e.y - p.y), angle: Math.atan2(Math.sin(angle), Math.cos(angle)) };
          }).filter(item => Math.abs(item.angle) < 0.1 && item.distance < 12 &&
            Engine.lineOfSight(scene.grid, p, item.enemy.world.position())).sort((a, b) => a.distance - b.distance)[0];
          if (target) {
            const dealt = Math.min(25 + player.power * 5, target.enemy.hp);
            target.enemy.hp -= dealt; player.damage += dealt;event("shot_hit",{player:player.id,target:target.enemy.id,damage:dealt,targetHp:target.enemy.hp,reserveRecomputed:false});
          }
        }
      }
      if (locked && phase === 'playing') {
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          enemy.cooldown = Math.max(0, enemy.cooldown - dt);
          const e = enemy.world.position();
          const target = allies().filter(player => player.hp > 0 && Engine.lineOfSight(scene.grid, e, player.world.position()))
            .sort((a, b) => Math.hypot(a.world.position().x - e.x, a.world.position().y - e.y) -
              Math.hypot(b.world.position().x - e.x, b.world.position().y - e.y))[0];
          if (!target) continue;
          const p = target.world.position(), distance = Math.hypot(p.x - e.x, p.y - e.y);
          enemy.world.turn(Math.atan2(p.y - e.y, p.x - e.x) - e.angle);
          if (distance > 4) enemy.world.move(1, 0, dt * 0.5);
          if (distance < 12 && enemy.cooldown <= 0) { damage(target, 5 + enemy.level); enemy.cooldown = 1.2; }
        }
      }
      settleCombat();
      if (round?.state === 'bidding' && now() > round.deadline) { round.state = 'cancelled'; round.reason = 'Bid deadline expired; no assets or credits transferred.'; }
    },
    startRound(token, method) {
      session(token);
      const players = Array.from(sessions.values());
      if (!['knaster', 'adjusted-winner', 'vickrey'].includes(method) || players.length < 2 ||
          (method === 'adjusted-winner' && players.length !== 2)) {
        throw Object.assign(Error('Knaster/Vickrey need 2-8 players; Adjusted Winner needs exactly two.'), { status: 422 });
      }
      if (round?.state === 'bidding') throw Object.assign(Error('A sealed round is already open.'), { status: 409 });
      if (method === 'vickrey' ? locked || powerCellConsumed : phase !== 'won' || rewardCacheConsumed) {
        throw Object.assign(Error('Power auction is pre-combat and one-use; reward cache is one-use after victory.'), { status: 409 });
      }
      round = { id: ++roundId, method, players, goods: method === 'vickrey' ? ['Power cell'] : ['Relay charge', 'Armour reserve', 'Ammo reserve'],
        bids: new Map(), state: 'bidding', deadline: now() + 60000, result: null };
      return snapshot(token).round;
    },
    bid(token, request) {
      const player = session(token);
      if (round?.state === 'bidding' && now() > round.deadline) { round.state = 'cancelled'; round.reason = 'Bid deadline expired; no transfers.'; }
      if (!round || round.state !== 'bidding' || request?.roundId !== round.id ||
          !round.players.includes(player) || round.bids.has(player.id)) {
        throw Object.assign(Error('Round unavailable, stale, or bid already sealed.'), { status: 409 });
      }
      const values = request.values;
      if (Object.keys(request).sort().join(',') !== 'roundId,values' || !Array.isArray(values) ||
          values.length !== round.goods.length || values.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000)) {
        throw Object.assign(Error('Invalid sealed valuations.'), { status: 422 });
      }
      const total = values.reduce((a, b) => a + b, 0);
      if ((round.method === 'adjusted-winner' && total !== 100) ||
          (round.method !== 'adjusted-winner' && Fair.compare(Fair.fraction(total), player.credits) > 0)) {
        throw Object.assign(Error('Use 100 AW points, or Knaster bids within available game-credit liquidity.'), { status: 422 });
      }
      round.bids.set(player.id, values.slice());event("bid_sealed",{roundId:round.id,player:player.id});
      if (round.bids.size === round.players.length) {
        const bids = round.players.map(participant => round.bids.get(participant.id));
        const result = round.method === 'knaster' ? Fair.knaster(bids) :
          round.method === 'vickrey' ? Fair.vickrey(bids.map(row => row[0])) : Fair.adjustedWinner(bids);
        if (round.method === 'vickrey') {
          const winner = round.players[result.winner];
          winner.credits = Fair.add(winner.credits, Fair.fraction(-BigInt(result.price.numerator), result.price.denominator));
          treasury = Fair.add(treasury, result.price); winner.power = 1; winner.level = Math.min(5, winner.level + 1);
          winner.inventory.push({ round: round.id, item: 'Power cell', share: Fair.fraction(1) });
          powerCellConsumed = true;
        } else if (round.method === 'knaster') {
          const credits = round.players.map((participant, i) => Fair.add(participant.credits, result.players[i].cash));
          if (credits.some(value => Fair.compare(value, Fair.fraction(0)) < 0)) throw Error('Credit liquidity invariant failed.');
          round.players.forEach((participant, i) => { participant.credits = credits[i]; });
          result.owners.forEach((owner, item) => round.players[owner].inventory.push({ round: round.id, item: round.goods[item], share: Fair.fraction(1) }));
        } else {
          result.allocations.forEach((shares, item) => shares.forEach((share, i) => {
            if (share.numerator !== '0') round.players[i].inventory.push({ round: round.id, item: round.goods[item], share });
          }));
        }
        if (round.method !== 'vickrey') rewardCacheConsumed = true;
        round.result = { ...result, bids }; round.state = 'settled';
        receipts.push({ id: round.id, method: round.method, result: round.result });event('economy_settled',{roundId:round.id,method:round.method,result:round.result});
      }
      return snapshot(token).round;
    }
  };
}
module.exports = { createArena };
