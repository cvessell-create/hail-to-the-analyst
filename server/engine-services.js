// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const { createHash } = require('node:crypto');

function invalid(message) {
  throw Object.assign(new Error(message), { status: 422 });
}
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) invalid('Unsupported fields.');
}
function text(value, name, max = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\u0000-\u001f]/.test(value)) invalid(`Invalid ${name}.`);
  return value;
}
function artifactPreview(input) {
  fields(input, ['run_id', 'build_sha256', 'mission', 'seed', 'outcome', 'ticks', 'title']);
  const run = text(input.run_id, 'run id', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(run)) invalid('Invalid run id.');
  if (typeof input.build_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.build_sha256)) invalid('Invalid build SHA-256.');
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) invalid('Invalid seed.');
  if (!Number.isSafeInteger(input.ticks) || input.ticks < 0 || input.ticks > 21600000) invalid('Invalid tick count.');
  if (!['complete', 'dead', 'aborted'].includes(input.outcome)) invalid('Invalid outcome.');
  const record = {
    schema: 'hail-run-artifact/v1', run_id: run, build_sha256: input.build_sha256,
    mission: text(input.mission, 'mission', 80), seed: input.seed,
    outcome: input.outcome, ticks: input.ticks, tick_hz: 60
  };
  const metadata = { name: text(input.title, 'title', 80),
    description: 'Player-supplied Hail run record. Not independently verified; no copyright transfer or financial entitlement.',
    properties: record };
  const bytes = JSON.stringify(metadata);
  return { schema: 'hail-artifact-preview/v1', state: 'LOCAL_PREVIEW',
    metadata, metadata_json: bytes, sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: Buffer.byteLength(bytes), wallet_preference: 'coinbase',
    published: false, minted: false,
    next_step: 'Review public fields; storage, contract and wallet signing are not configured.' };
}

function createEngineServices({ siUrl, fetchImpl = globalThis.fetch }) {
  const base = new URL(siUrl);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw Error('Engine SI service requires a loopback HTTP origin without credentials or a path.');
  }
  async function request(path, body) {
    try {
      const response = await fetchImpl(new URL(path, base).href, {
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(body ? 30000 : 5000), redirect: 'error'
      });
      if (response.status !== 200) throw Error(`SI HTTP ${response.status}`);
      const result = await response.json();
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Invalid SI response.');
      return result;
    } catch (error) {
      throw Object.assign(new Error(`Engine SI request failed: ${error.message}`, { cause: error }), { status: 502 });
    }
  }
  return {
    artifactPreview,
    async formula() {
      const result = await request('/formula');
      if (result.schema !== 'vessell-formula/v1' || !['UP', 'DOWN'].includes(result.state) ||
          typeof result.phase1 !== 'string' || result.anchored !== false) {
        throw Object.assign(new Error('Unsupported local formula/receipt contract.'), { status: 502 });
      }
      return { schema: result.schema, state: result.state, phase1: result.phase1, anchored: false,
        run_id: result.run_id, receipt_id: result.receipt_id, at: result.at,
        problems: result.problems, source: 'framework formula endpoint; not independently reverified by game' };
    },
    async status() {
      const status = await request('/status');
      if (status.schema !== 'vessell-si-chat/v1' || typeof status.model_ready !== 'boolean') {
        throw Object.assign(new Error('Unsupported SI status contract.'), { status: 502 });
      }
      return { schema: 'hail-engine-services/v1', chat: { state: status.model_ready ? 'MODEL_READY' : 'MODEL_OFFLINE',
        backend: status.backend }, levels: ['Chatbot', 'Reasoner', 'Agent', 'Innovator', 'Organization'].map((name, i) =>
        ({ level: i + 1, name, state: 'NOT_EVALUATED_BY_SERVICE_STATUS' })),
      blockchain: { wallet_preference: 'coinbase', state: 'NOT_CONNECTED', spending_enabled: false,
        publication_enabled: false, minting_enabled: false } };
    },
    async chat(input) {
      fields(input, ['message']);
      const message = text(input.message, 'message', 500);
      const reply = await request('/chat', { message, view: 'game' });
      if (reply.schema !== 'vessell-si-chat/v1' || !['generated', 'owner', 'telemetry'].includes(reply.kind) ||
          typeof reply.text !== 'string' || !reply.text.trim() || !Array.isArray(reply.sources) ||
          typeof reply.route !== 'string') {
        throw Object.assign(new Error('Unsupported SI reply contract.'), { status: 502 });
      }
      return { schema: reply.schema, kind: reply.kind, label: reply.label, text: reply.text,
        model: reply.model, route: reply.route, sources: reply.sources, error: reply.error ?? null };
    }
  };
}
module.exports = { createEngineServices, artifactPreview };
