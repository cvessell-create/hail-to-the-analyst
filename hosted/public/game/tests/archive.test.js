'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');

test('superseded standalone entries are archived, not active entry points', () => {
  for (const name of ['engine/demo.html', 'scripts/build-agent.js',
    'docs/build-agent-report.json'])
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  for (const name of ['archive/README.md', 'archive/demos/raycaster.html',
    'archive/docs/build-agent-report.json', 'archive/docs/homebrew-guest.md',
    'archive/docs/hosted-starter.md', 'archive/docs/hosted-repair-handoff.md'])
    assert.ok(fs.existsSync(path.join(root, name)), name);
});

test('archived tools import canonical dependencies without running a session', () => {
  const build = require('../archive/scripts/build-agent.js');
  const interop = require('../archive/scripts/autonomous-interop.js');
  assert.equal(typeof build.profileRaycaster, 'function');
  assert.equal(typeof interop.runAutonomousSession, 'function');
  assert.equal(require('../scripts/autonomous-interop.js'), interop);
  const source = fs.readFileSync(path.join(root, 'archive/scripts/build-agent.js'), 'utf8');
  assert.match(source, /outputs\/archive-build-agent-report\.json/);
  assert.doesNotMatch(source, /path\.join\([^;\n]*['"]docs\/build-agent-report\.json/);
});

test('original development interop CLI executes a bounded loopback session', () => {
  const { execFileSync } = require('node:child_process');
  const result = JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'scripts/autonomous-interop.js'), '--steps=3'],
    { cwd: root, encoding: 'utf8', timeout: 20000 }));
  assert.equal(result.success, true);
  assert.equal(result.stepsRequested, 3);
  assert.equal(result.tacticalStepsCount, 3);
  assert.match(result.arenaUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.ok(result.receipts.some(receipt => receipt.step === 'join_primary'));
});

test('archived demo resolves its scripts and guide to existing canonical files', () => {
  const file = path.join(root, 'archive/demos/raycaster.html');
  const html = fs.readFileSync(file, 'utf8');
  const base = path.resolve(path.dirname(file), html.match(/<base href="([^"]+)"/)[1]);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1] === '../../engine/') continue;
    assert.ok(fs.statSync(path.resolve(base, match[1])).isFile(), match[1]);
  }
});

test('compatibility and development modules remain separate from the campaign', () => {
  for (const name of ['engine/nes-visual.js', 'js/emulation-engine.js',
    'engine/autopilot.js', 'engine/si-dialogue.js', 'engine/si-story-corpus.js',
    'engine/vessell-formula.js', 'homebrew/slice.c', 'homebrew/Makefile',
    'homebrew/runtime/NOTICE', 'server/engine-services.js', 'engine/development.html'])
    assert.ok(fs.existsSync(path.join(root, name)), name);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)="[^"]*(?:archive\/|autopilot|si-dialogue|si-story-corpus|vessell-formula|nes-visual)/);
});

test('mirror retirement removes only unchanged registered files and rejects unsafe history', () => {
  const crypto = require('node:crypto'), vm = require('node:vm');
  const source = fs.readFileSync(path.join(root, 'scripts/sync-hosted-game.js'), 'utf8');
  const bytes = Buffer.from('retired demo');
  const row = { path: 'engine/retired.html',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  function simulate(history, edited = false) {
    const mirrors = new Map();
    for (const target of ['hosted/lib/game', 'hosted/public/game']) {
      mirrors.set(path.join(root, target, row.path), edited ? Buffer.from('local edit') : bytes);
      mirrors.set(path.join(root, target, 'hosted-only.txt'), Buffer.from('keep'));
    }
    const isMirror = file => ['hosted/lib/game', 'hosted/public/game']
      .some(target => file.startsWith(path.join(root, target) + path.sep));
    const mock = { ...fs,
      existsSync: file => isMirror(file) ? mirrors.has(file) : fs.existsSync(file),
      readFileSync: (file, encoding) => file === path.join(root, 'hosted/game-source-hashes.json')
        ? JSON.stringify({ files: history }) : isMirror(file) ? mirrors.get(file) : fs.readFileSync(file, encoding),
      mkdirSync() {},
      copyFileSync: (from, to) => mirrors.set(to, fs.readFileSync(from)),
      unlinkSync: file => mirrors.delete(file),
      writeFileSync() {},
    };
    vm.runInNewContext(source, { __dirname: path.join(root, 'scripts'),
      require: name => name === 'node:fs' ? mock : require(name), console: { log() {} } });
    return mirrors;
  }
  const mirrors = simulate([row]);
  for (const target of ['hosted/lib/game', 'hosted/public/game']) {
    assert.equal(mirrors.has(path.join(root, target, row.path)), false);
    assert.equal(mirrors.get(path.join(root, target, 'hosted-only.txt')).toString(), 'keep');
  }
  assert.throws(() => simulate([row], true), /Retired mirror was edited/);
  assert.throws(() => simulate([{ ...row, path: '../outside' }]), /Invalid retired mirror path/);
});
