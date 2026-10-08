// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createArena } = require('./arena.js');
const Engine = require('../engine/core.js');
const root = path.resolve(__dirname, '..');
function createServer({ manual = false } = {}) {
  const arena = createArena(), rates = new Map();
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body));
    };
    try {
      const host = req.headers.host;
      if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host || '')) return json(403, { error: 'Local host required.' });
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return json(403, { error: 'Same-origin requests required.' });
      const url = new URL(req.url, `http://${host}`), address = req.socket.remoteAddress;
      const rate = rates.get(address) || { start: Date.now(), count: 0 };
      if (Date.now() - rate.start > 1000) { rate.start = Date.now(); rate.count = 0; }
      rates.set(address, rate);
      if (++rate.count > 300) return json(429, { error: 'Local request budget exceeded.' });
      if (url.pathname.startsWith('/api/')) {
        const token = (req.headers.authorization || '').replace(/^Bearer /, '');
        if (req.method === 'GET' && url.pathname === '/api/state') return json(200, arena.snapshot(token));
        if (req.method !== 'POST') return json(405, { error: 'Unsupported API method.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required.' });
        let body = '', size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) { json(413, { error: 'Body exceeds 4096 bytes.' }); return; }
          body += chunk.toString('utf8');
        }
        let data;
        try { data = JSON.parse(body); } catch { return json(400, { error: 'Malformed JSON.' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json(422, { error: 'Expected a JSON object.' });
        if (url.pathname === '/api/join') {
          if (Object.keys(data).join(',') !== 'name') return json(422, { error: 'Only a name is accepted.' });
          return json(201, arena.join(data.name));
        }
        if (url.pathname === '/api/input') return json(200, arena.input(token, data));
        if (url.pathname === '/api/round') {
          if (Object.keys(data).join(',') !== 'method') return json(422, { error: 'Only a division method is accepted.' });
          return json(201, arena.startRound(token, data.method));
        }
        if (url.pathname === '/api/harvest') {if(Object.keys(data).join(',')!=='amount')return json(422,{error:'Only a harvest amount is accepted.'});return json(200,arena.harvest(token,data.amount));}
        if (url.pathname === '/api/bid') return json(200, arena.bid(token, data));
        return json(404, { error: 'Unknown API route.' });
      }
      if (req.method !== 'GET') return json(405, { error: 'GET required.' });
      let name;
      try { name = decodeURIComponent(url.pathname === '/' ? '/engine/workbench.html' : url.pathname); }
      catch { return json(400, { error: 'Invalid URL encoding.' }); }
      if (!/^\/(index\.html|README\.md|LICENSE|COPYING-GPL-3|ATTRIBUTION\.md|engine\/[\w.-]+|js\/[\w.-]+|css\/[\w.-]+|vendor\/jsnes\/[\w.-]+)$/.test(name)) {
        return json(404, { error: 'Unknown static file.' });
      }
      const file = path.join(root, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(404, { error: 'Static file not found.' });
      const extensions = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': `${extensions[path.extname(file)] || 'text/plain'}; charset=utf-8`,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      const stream = fs.createReadStream(file);
      stream.on('error', error => { console.error('Static read failed:', error); res.destroy(); });
      stream.pipe(res);
    } catch (error) {
      if (!error.status) console.error('Arena request failed:', error);
      if (!res.headersSent) json(error.status || 500, { error: error.status ? error.message : 'Internal arena error.' });
      else res.destroy();
    }
  });
  let last = performance.now();
  const clock = Engine.clock(dt => arena.step(dt));
  const timer = manual ? null : setInterval(() => {
    const now = performance.now(); clock.advance((now - last) / 1000); last = now;
  }, 1000 / 60);
  server.on('close', () => { if (timer) clearInterval(timer); });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  return { server, arena };
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be 1024-65535.');
  const { server } = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`Engine: http://127.0.0.1:${port}/engine/workbench.html`));
}
module.exports = { createServer };
