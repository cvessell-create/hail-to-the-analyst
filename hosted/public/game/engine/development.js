// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
(() => {
  const get = id => document.getElementById(id);
  let preview = null;
  let artifactRevision = 0;
  async function call(path, body, target) {
    target.className = '';
    target.textContent = 'Waiting...';
    try {
      const response = await fetch('/api/engine/' + path, {
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(35000)
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || `HTTP ${response.status}`);
      target.textContent = JSON.stringify(result, null, 2);
      return result;
    } catch (error) {
      target.className = 'error';
      target.textContent = error.message;
      return null;
    }
  }
  get('status').onclick = () => call('status', null, get('service'));
  get('formula').onclick = () => call('formula', null, get('formulaStatus'));
  get('chat').onsubmit = async event => {
    event.preventDefault();
    const button = get('chat').querySelector('button');
    button.disabled = true;
    try { await call('chat', { message: get('message').value }, get('reply')); }
    finally { button.disabled = false; }
  };
  get('artifact').addEventListener('input', () => {
    artifactRevision++;
    preview = null;
    get('download').disabled = true;
    get('preview').textContent = 'Fields changed. Generate a new preview.';
  });
  get('artifact').onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(get('artifact')));
    data.seed = Number(data.seed);
    data.ticks = Number(data.ticks);
    preview = null;
    get('download').disabled = true;
    const revision = ++artifactRevision;
    const result = await call('artifact', data, get('preview'));
    if (revision !== artifactRevision) {
      get('preview').textContent = 'Fields changed. Generate a new preview.';
      return;
    }
    preview = result;
    get('download').disabled = !preview;
  };
  get('download').onclick = () => {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview.metadata_json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'hail-run-metadata.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
