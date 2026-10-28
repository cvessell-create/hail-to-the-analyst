// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

test('engine workflow and generated copies disable checkout credential persistence', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, '.github/workflows/engine.yml'), 'utf8');
  assert.match(source, /uses: actions\/checkout@v4\n\s+with:\n\s+persist-credentials: false\n/);
  assert.match(source, /permissions:\n  contents: read\n/);
  for (const target of ['hosted/lib/game', 'hosted/public/game'])
    assert.equal(fs.readFileSync(path.join(root, target, '.github/workflows/engine.yml'), 'utf8'), source);
});
