// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { confinedPath, readFile, writeFile } = require('../scripts/repository-paths');
const repository = path.resolve(__dirname, '..');

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hail-script-paths-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo');
  for (const dir of ['engine', 'js', 'server', 'tests', 'css', 'vendor', 'audit',
    'scripts', 'archive', 'homebrew', 'hosted/lib/game', 'hosted/public/game'])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const name of ['repository-paths.js', 'audit-math.js', 'build-level-tuning.js', 'sync-hosted-game.js'])
    fs.copyFileSync(path.join(repository, 'scripts', name), path.join(root, 'scripts', name));
  for (const name of ['index.html', 'README.md', 'play-button.svg', 'LICENSE', 'COPYING-GPL-3', 'ATTRIBUTION.md'])
    fs.writeFileSync(path.join(root, name), 'fixture\n');
  for (const name of ['.gitignore', 'README.md', 'Makefile', 'Makefile.kos', 'slice.h',
    'slice.c', 'main.c', 'worker.c', 'test_slice.c', 'native-build.sh', 'toolchain.json'])
    fs.writeFileSync(path.join(root, 'homebrew', name), 'fixture\n');
  const run = (script, ...args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args],
    { cwd: root, encoding: 'utf8' });
  return { temporary, root, run };
}

test('repository paths reject escapes, symlinks and hard-linked outputs', t => {
  const { root, temporary } = fixture(t);
  const outside = path.join(temporary, 'outside.json');
  fs.writeFileSync(outside, 'unchanged');
  assert.equal(confinedPath(root, path.join(root, 'allowed.json')), path.join(root, 'allowed.json'));
  for (const requested of ['../outside.json', outside, `${root}-sibling/file`, '', '\0'])
    assert.throws(() => confinedPath(root, requested));
  fs.symlinkSync(temporary, path.join(root, 'escape'));
  fs.symlinkSync(outside, path.join(root, 'link.json'));
  assert.throws(() => readFile(root, 'link.json'), /Symbolic links/);
  assert.throws(() => writeFile(root, 'escape/outside.json', 'changed'), /Symbolic links/);
  fs.linkSync(outside, path.join(root, 'hard.json'));
  assert.throws(() => writeFile(root, 'hard.json', 'changed'), /singly linked/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'unchanged');
  writeFile(root, 'good.json', 'long original');
  writeFile(root, 'good.json', 'short');
  assert.equal(readFile(root, 'good.json').toString(), 'short');
  assert.throws(() => readFile(root, 'engine'), /regular file/);
});

test('tuning CLI confines input and output and preserves generated tuning', t => {
  const { root, temporary, run } = fixture(t);
  const report = { probability: { p_outcome_given_mission: { 1: { complete: 0.6, timeout: 0.2, dead: 0.1 } } } };
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report));
  fs.writeFileSync(path.join(temporary, 'outside.json'), JSON.stringify(report));
  for (const args of [['../outside.json'], ['report.json', '../outside.js']]) {
    const result = run('build-level-tuning.js', ...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Path must stay within/);
  }
  assert.equal(fs.existsSync(path.join(temporary, 'outside.js')), false);
  const result = run('build-level-tuning.js', 'report.json');
  assert.equal(result.status, 0, result.stderr);
  const tuning = require(path.join(root, 'engine/level-tuning.js'));
  assert.equal(tuning.enemies, 14);
  assert.equal(tuning.source.file, 'report.json');
  assert.equal(tuning.source.sha256.length, 64);
});

test('audit CLI confines outputs and rejects symlinked inventory sources', t => {
  const { root, temporary, run } = fixture(t);
  for (const dir of ['engine', 'js', 'vendor'])
    fs.cpSync(path.join(repository, dir), path.join(root, dir), { recursive: true });
  const escaped = run('audit-math.js', '../escaped');
  assert.notEqual(escaped.status, 0);
  assert.match(escaped.stderr, /Path must stay within/);
  assert.equal(fs.existsSync(path.join(temporary, 'escaped')), false);
  const result = run('audit-math.js', 'audit/new');
  assert.equal(result.status, 0, result.stderr);
  const model = JSON.parse(fs.readFileSync(path.join(root, 'audit/new/executed-math-log.json')));
  assert.equal(model.schema, 'hail-backward-audit/v1');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'audit/new/source-inventory.json')));
  assert.ok(inventory.some(row => row.path === 'engine/math.js'));
  fs.symlinkSync(path.join(temporary, 'secret.json'), path.join(root, 'secret.json'));
  const linked = run('audit-math.js');
  assert.notEqual(linked.status, 0);
  assert.match(linked.stderr, /Symbolic links/);
});

test('mirror sync copies valid sources and rejects symlinked source and destination directories', t => {
  const { root, temporary, run } = fixture(t);
  const result = run('sync-hosted-game.js');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'hosted/public/game/README.md'), 'utf8'), 'fixture\n');
  fs.symlinkSync(temporary, path.join(root, 'engine/escape'));
  const source = run('sync-hosted-game.js');
  assert.notEqual(source.status, 0);
  assert.match(source.stderr, /Symbolic links/);
  fs.unlinkSync(path.join(root, 'engine/escape'));
  fs.symlinkSync(temporary, path.join(root, 'hosted/public/game/engine'));
  fs.writeFileSync(path.join(root, 'engine/example.js'), 'fixture');
  const destination = run('sync-hosted-game.js');
  assert.notEqual(destination.status, 0);
  assert.match(destination.stderr, /Symbolic links/);
  assert.equal(fs.existsSync(path.join(temporary, 'example.js')), false);
});

test('mirror sync rejects traversal in retired manifest paths', t => {
  const { root, run } = fixture(t);
  fs.writeFileSync(path.join(root, 'hosted/game-source-hashes.json'),
    JSON.stringify({ files: [{ path: '../outside.json', sha256: 'invalid' }] }));
  const result = run('sync-hosted-game.js');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid retired mirror path/);
});

test('mirror retirement removes only unchanged registered files and preserves hosted-only assets', t => {
  const { root, run } = fixture(t);
  const bytes = 'retired demo';
  const row = { path: 'engine/retired.html',
    sha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex') };
  const register = path.join(root, 'hosted/game-source-hashes.json');
  for (const target of ['hosted/lib/game', 'hosted/public/game']) {
    fs.mkdirSync(path.join(root, target, 'engine'), { recursive: true });
    fs.writeFileSync(path.join(root, target, row.path), bytes);
    fs.writeFileSync(path.join(root, target, 'hosted-only.txt'), 'keep');
  }
  fs.writeFileSync(register, JSON.stringify({ files: [row] }));
  fs.writeFileSync(path.join(root, 'hosted/public/game', row.path), 'local edit');
  const edited = run('sync-hosted-game.js');
  assert.notEqual(edited.status, 0);
  assert.match(edited.stderr, /Retired mirror was edited/);
  assert.equal(fs.readFileSync(path.join(root, 'hosted/lib/game', row.path), 'utf8'), bytes);
  assert.equal(fs.readFileSync(path.join(root, 'hosted/public/game', row.path), 'utf8'), 'local edit');
  fs.writeFileSync(path.join(root, 'hosted/public/game', row.path), bytes);
  const result = run('sync-hosted-game.js');
  assert.equal(result.status, 0, result.stderr);
  for (const target of ['hosted/lib/game', 'hosted/public/game']) {
    assert.equal(fs.existsSync(path.join(root, target, row.path)), false);
    assert.equal(fs.readFileSync(path.join(root, target, 'hosted-only.txt'), 'utf8'), 'keep');
  }
});
