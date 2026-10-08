'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
test('hosted server and browser copies match canonical source hashes', () => {
  const root = path.resolve(__dirname, '..');
  const register = path.join(root, 'hosted/game-source-hashes.json');
  if (!fs.existsSync(register)) throw Error('Run node scripts/sync-hosted-game.js before tests.');
  const manifest = JSON.parse(fs.readFileSync(register, 'utf8'));
  for (const row of manifest.files) {
    const source = fs.readFileSync(path.join(root, row.path));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), row.sha256, row.path);
    for (const target of ['hosted/lib/game', 'hosted/public/game']) {
      assert.deepEqual(fs.readFileSync(path.join(root, target, row.path)), source, `${target}/${row.path}`);
    }
  }
});
