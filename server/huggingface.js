// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';

/**
 * Hugging Face client for hail-to-the-analyst using native Node fetch.
 */
function createHuggingFaceClient(options = {}) {
  const token = options.token || process.env.HF_TOKEN || process.env.HUGGINGFACE_HUB_TOKEN || null;
  const endpoint = options.endpoint || process.env.HF_ENDPOINT || 'https://api-inference.huggingface.co';
  const hubEndpoint = options.hubEndpoint || 'https://huggingface.co';
  const fetchImpl = options.fetch || globalThis.fetch;

  return {
    get token() {
      return token;
    },
    async status() {
      const res = {
        installed: true,
        tokenConfigured: Boolean(token),
        authenticated: false,
        user: null,
        error: null,
      };
      if (!token) {
        res.error = 'No HF_TOKEN or HUGGINGFACE_HUB_TOKEN configured.';
        return res;
      }
      try {
        const response = await fetchImpl(`${hubEndpoint}/api/whoami-v2`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          res.error = `Authentication failed: HTTP ${response.status}`;
          return res;
        }
        const data = await response.json();
        res.authenticated = true;
        res.user = {
          name: data.name,
          fullname: data.fullname,
          email: data.email,
          type: data.type,
          orgs: Array.isArray(data.orgs) ? data.orgs.map(o => o.name) : [],
        };
      } catch (err) {
        res.error = err.message;
      }
      return res;
    },
    async listSpaces({ search = '', limit = 10, author = '' } = {}) {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (author) params.set('author', author);
      if (limit) params.set('limit', String(limit));
      try {
        const query = params.toString();
        const url = `${hubEndpoint}/api/spaces${query ? '?' + query : ''}`;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to list spaces: HTTP ${response.status}`);
        }
        const spaces = await response.json();
        return spaces.map(sp => ({
          id: sp.id || sp._id,
          author: sp.author || (sp.id ? sp.id.split('/')[0] : null),
          likes: sp.likes || 0,
          sdk: sp.sdk || null,
          private: Boolean(sp.private),
        }));
      } catch (err) {
        return { error: err.message };
      }
    },
    async listModels({ search = '', limit = 10, author = '' } = {}) {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (author) params.set('author', author);
      if (limit) params.set('limit', String(limit));
      try {
        const query = params.toString();
        const url = `${hubEndpoint}/api/models${query ? '?' + query : ''}`;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to list models: HTTP ${response.status}`);
        }
        const models = await response.json();
        return models.map(m => ({
          id: m.id || m._id,
          author: m.author || (m.id ? m.id.split('/')[0] : null),
          downloads: m.downloads || 0,
          likes: m.likes || 0,
          pipeline_tag: m.pipeline_tag || null,
        }));
      } catch (err) {
        return { error: err.message };
      }
    },
    async generateText({ model, prompt, parameters = {} } = {}) {
      if (!model || !prompt) throw new Error('model and prompt are required');
      const url = `${endpoint}/models/${model}`;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const body = JSON.stringify({ inputs: prompt, parameters });
      const response = await fetchImpl(url, { method: 'POST', headers, body });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Inference error HTTP ${response.status}: ${errText}`);
      }
      return await response.json();
    },
  };
}

module.exports = { createHuggingFaceClient };
