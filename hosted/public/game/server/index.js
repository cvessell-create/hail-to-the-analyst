// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createArena } = require('./arena.js');
const { createHuggingFaceClient } = require('./huggingface.js');
const Engine = require('../engine/core.js');
const root = path.resolve(__dirname, '..');
const PUBLIC_HOST = /^[a-z0-9-]+\.trycloudflare\.com$/;
// Public mode (HAIL_PUBLIC=1) serves a Cloudflare quick tunnel: Hugging Face routes are closed and
// the host's SI is reachable only through the rate-limited /si/chat and /si/status proxy.
function createServer({ manual = false, hfClient = null, publicMode = process.env.HAIL_PUBLIC === '1',
  siUrl = process.env.HAIL_SI_URL || 'http://127.0.0.1:8790', fetchImpl = globalThis.fetch } = {}) {
  const arena = createArena(), rates = new Map(), siRates = new Map();
  const hf = hfClient || createHuggingFaceClient();
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body));
    };
    try {
      const host = req.headers.host, remote = publicMode && PUBLIC_HOST.test(host || '');
      if (!remote && !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host || '')) return json(403, { error: 'Local host required.' });
      if (req.headers.origin && req.headers.origin !== `${remote ? 'https' : 'http'}://${host}`) return json(403, { error: 'Same-origin requests required.' });
      const url = new URL(req.url, `http://${host}`);
      const address = remote ? String(req.headers['cf-connecting-ip'] || 'tunnel') : req.socket.remoteAddress;
      if (remote && url.pathname.startsWith('/api/hf/')) return json(403, { error: 'Hugging Face routes are local only.' });
      const rate = rates.get(address) || { start: Date.now(), count: 0 };
      if (Date.now() - rate.start > 1000) { rate.start = Date.now(); rate.count = 0; }
      rates.set(address, rate);
      if (++rate.count > 300) return json(429, { error: 'Local request budget exceeded.' });
      if (url.pathname === '/si/status' || url.pathname === '/si/chat') {
        const post = url.pathname === '/si/chat';
        if (req.method !== (post ? 'POST' : 'GET')) return json(405, { error: 'Unsupported SI method.' });
        let body;
        if (post) {
          const si = siRates.get(address) || { start: Date.now(), count: 0 };
          if (Date.now() - si.start > 60000) { si.start = Date.now(); si.count = 0; }
          siRates.set(address, si);
          if (++si.count > 20) return json(429, { error: 'SI budget is 20 messages per minute.' });
          if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required.' });
          body = '';
          for await (const chunk of req) { body += chunk.toString('utf8'); if (body.length > 4096) return json(413, { error: 'Body exceeds 4096 bytes.' }); }
          if (remote) {
            // Remote testers' gameplay events stay out of the host's SI memory; only the chat text is forwarded.
            let data; try { data = JSON.parse(body); } catch { return json(400, { error: 'Malformed JSON.' }); }
            if (!data || typeof data.message !== 'string' || !data.message.trim()) return json(422, { error: 'A message is required.' });
            body = JSON.stringify({ message: data.message.slice(0, 500), view: 'game' });
          }
        }
        try {
          const upstream = await fetchImpl(siUrl + (post ? '/chat' : '/status'), post ?
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30000) } :
            { signal: AbortSignal.timeout(5000) });
          return json(upstream.status, await upstream.json());
        } catch { return json(502, { error: 'SI service unavailable.' }); }
      }
      if (url.pathname.startsWith('/api/')) {
        const token = (req.headers.authorization || '').replace(/^Bearer /, '');
        if (req.method === 'GET' && url.pathname === '/api/state') return json(200, arena.snapshot(token));
        if (req.method === 'GET' && url.pathname === '/api/hf/status') return json(200, await hf.status());
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
        if (url.pathname === '/api/hf/spaces') return json(200, await hf.listSpaces(data));
        if (url.pathname === '/api/hf/models') return json(200, await hf.listModels(data));
        if (url.pathname === '/api/hf/generate') {
          if (!data.model || !data.prompt) return json(422, { error: 'Both model and prompt are required.' });
          try {
            return json(200, await hf.generateText(data));
          } catch (err) {
            return json(502, { error: err.message });
          }
        }
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
      // Playtesters on the public link land straight in the game; the workbench stays local-only.
      const home = remote ? '/index.html' : '/engine/workbench.html';
      try { name = decodeURIComponent(url.pathname === '/' ? home : url.pathname); }
      catch { return json(400, { error: 'Invalid URL encoding.' }); }
      if (!/^\/(index\.html|README\.md|LICENSE|COPYING-GPL-3|ATTRIBUTION\.md|engine\/[\w.-]+|js\/[\w.-]+|css\/[\w.-]+|vendor\/(jsnes|twgl|tsparticles|three|nova|augmented-ui)\/[\w.-]+|vendor\/fonts\/share-tech-mono\/[\w.-]+)$/.test(name)) {
        return json(404, { error: 'Unknown static file.' });
      }
      const file = path.join(root, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(404, { error: 'Static file not found.' });
      const extensions = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css' };
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': ext === '.woff2' ? 'font/woff2' : `${extensions[ext] || 'text/plain'}; charset=utf-8`,
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
  return { server, arena, hf };
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be 1024-65535.');
  const { server } = createServer();
  server.listen(port, '127.0.0.1', () => console.log(`Engine: http://127.0.0.1:${port}/engine/workbench.html`));
}
module.exports = { createServer };
