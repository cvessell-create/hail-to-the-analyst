'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
test('hosted server and browser copies match canonical source hashes', () => {
  const root = path.resolve(__dirname, '..');
  const register = path.join(root, 'hosted/game-source-hashes.json');
  if (!fs.existsSync(register)) throw Error('Run node scripts/sync-hosted-game.js before tests.');
  const manifest = JSON.parse(fs.readFileSync(register, 'utf8'));
  assert.ok(manifest.files.some(row => row.path === 'homebrew/slice.c'));
  assert.ok(manifest.files.every(row => !row.path.startsWith('homebrew/.deps/') &&
    !row.path.startsWith('homebrew/build/') && !row.path.startsWith('homebrew/runtime/')));
  for (const helper of ['flycast-macos.cmake', 'native-flycast.sh', 'flycast-smoke.js'])
    assert.ok(!manifest.files.some(row => row.path === `homebrew/${helper}`));
  assert.ok(manifest.files.some(row => row.path === 'archive/README.md'));
  assert.ok(manifest.files.some(row => row.path === 'archive/demos/raycaster.html'));
  assert.ok(manifest.files.some(row => row.path === 'scripts/autonomous-interop.js'));
  for (const retired of ['engine/demo.html', 'scripts/build-agent.js',
    'docs/build-agent-report.json']) {
    assert.ok(!manifest.files.some(row => row.path === retired));
    for (const target of ['hosted/lib/game', 'hosted/public/game'])
      assert.equal(fs.existsSync(path.join(root, target, retired)), false, `${target}/${retired}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'hosted/lib/game/package.json')));
  assert.ok(fs.existsSync(path.join(root, 'hosted/public/game/multiplayer.html')));
  for (const row of manifest.files) {
    const source = fs.readFileSync(path.join(root, row.path));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), row.sha256, row.path);
    for (const target of ['hosted/lib/game', 'hosted/public/game']) {
      assert.deepEqual(fs.readFileSync(path.join(root, target, row.path)), source, `${target}/${row.path}`);
    }
  }
});
