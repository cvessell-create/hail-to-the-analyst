// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHuggingFaceClient } = require('../server/huggingface.js');
const { createServer } = require('../server/index.js');

test('HuggingFace client status with no token configured', async () => {
  const client = createHuggingFaceClient({ token: null });
  const status = await client.status();
  assert.equal(status.installed, true);
  assert.equal(status.tokenConfigured, false);
  assert.equal(status.authenticated, false);
  assert.ok(status.error && status.error.includes('No HF_TOKEN'));
});

test('HuggingFace client status with authenticated mock response', async () => {
  const mockFetch = async (url, opts) => {
    assert.ok(opts.headers.Authorization.includes('mock_token'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: 'test-user',
        fullname: 'Test User',
        email: 'test@example.com',
        type: 'user',
        orgs: [{ name: 'analyst-team' }],
      }),
    };
  };

  const client = createHuggingFaceClient({ token: 'mock_token', fetch: mockFetch });
  const status = await client.status();
  assert.equal(status.authenticated, true);
  assert.equal(status.user.name, 'test-user');
  assert.deepEqual(status.user.orgs, ['analyst-team']);
});

test('HuggingFace client listSpaces and listModels format responses', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/api/spaces')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: 'org/space-one', author: 'org', likes: 12, sdk: 'gradio', private: false },
        ],
      };
    }
    if (url.includes('/api/models')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: 'meta/llama-3', author: 'meta', downloads: 500, likes: 200, pipeline_tag: 'text-generation' },
        ],
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = createHuggingFaceClient({ token: 'mock_token', fetch: mockFetch });
  const spaces = await client.listSpaces({ search: 'space-one' });
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0].id, 'org/space-one');
  assert.equal(spaces[0].sdk, 'gradio');

  const models = await client.listModels({ search: 'llama' });
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'meta/llama-3');
  assert.equal(models[0].pipeline_tag, 'text-generation');
});

test('HuggingFace client generateText executes inference call', async () => {
  const mockFetch = async (url, opts) => {
    assert.ok(url.includes('/models/meta-llama/Llama-3-8B'));
    const body = JSON.parse(opts.body);
    assert.equal(body.inputs, 'Analyze optimal move');
    return {
      ok: true,
      status: 200,
      json: async () => [{ generated_text: 'Defend position and counter' }],
    };
  };

  const client = createHuggingFaceClient({ token: 'mock_token', fetch: mockFetch });
  const result = await client.generateText({
    model: 'meta-llama/Llama-3-8B',
    prompt: 'Analyze optimal move',
  });
  assert.deepEqual(result, [{ generated_text: 'Defend position and counter' }]);
});

test('Server endpoints for Hugging Face integration operate correctly', async t => {
  const mockHf = {
    async status() {
      return { installed: true, tokenConfigured: true, authenticated: true };
    },
    async listSpaces(params) {
      return [{ id: 'app/analyst-ui', sdk: 'docker' }];
    },
    async listModels(params) {
      return [{ id: 'model/analyst-weights', pipeline_tag: 'feature-extraction' }];
    },
    async generateText({ model, prompt }) {
      return { model, response: 'Strategic consensus reached.' };
    },
  };

  const { server } = createServer({ manual: true, hfClient: mockHf });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}`;

  // GET /api/hf/status
  const statusRes = await fetch(base + '/api/hf/status');
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.authenticated, true);

  // POST /api/hf/spaces
  const spacesRes = await fetch(base + '/api/hf/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: 'analyst' }),
  });
  assert.equal(spacesRes.status, 200);
  const spacesData = await spacesRes.json();
  assert.equal(spacesData[0].id, 'app/analyst-ui');

  // POST /api/hf/models
  const modelsRes = await fetch(base + '/api/hf/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: 'weights' }),
  });
  assert.equal(modelsRes.status, 200);
  const modelsData = await modelsRes.json();
  assert.equal(modelsData[0].id, 'model/analyst-weights');

  // POST /api/hf/generate missing fields -> 422
  const invalidGenRes = await fetch(base + '/api/hf/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });
  assert.equal(invalidGenRes.status, 422);

  // POST /api/hf/generate valid
  const genRes = await fetch(base + '/api/hf/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'demo-model', prompt: 'test prompt' }),
  });
  assert.equal(genRes.status, 200);
  const genData = await genRes.json();
  assert.equal(genData.response, 'Strategic consensus reached.');
});
