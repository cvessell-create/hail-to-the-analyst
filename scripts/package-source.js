// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'hail-to-the-analyst-0.2.0.zip'));
if (fs.existsSync(output)) throw Error('Output already exists; choose a new ZIP name.');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
for (const file of files) {
  if (file.startsWith('dist/') || file.includes('node_modules/') || file.startsWith('.env') ||
      !fs.lstatSync(path.join(root, file)).isFile()) throw Error(`Invalid distribution entry: ${file}`);
  if (execFileSync('git', ['diff', '--name-only', 'HEAD', '--', file], { cwd: root, encoding: 'utf8' }).trim()) {
    throw Error(`Commit source before packaging: ${file}`);
  }
}
fs.mkdirSync(path.dirname(output), { recursive: true });
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'hail-source-'));
try {
  const entries = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, file)), target = path.join(temp, file);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    entries.push({ path: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  fs.writeFileSync(path.join(temp, 'package-manifest.json'), JSON.stringify({
    schema: 'hail-source/v1', commit: sha, files: entries
  }, null, 2) + '\n');
  execFileSync('zip', ['-q', output, ...files, 'package-manifest.json'], { cwd: temp });
  console.log(JSON.stringify({ output, commit: sha, files: files.length,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') }, null, 2));
} finally {
  for (const file of [...files, 'package-manifest.json']) {
    const target = path.join(temp, file);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  function emptyDirectories(directory) {
    for (const name of fs.readdirSync(directory)) emptyDirectories(path.join(directory, name));
    fs.rmdirSync(directory);
  }
  emptyDirectories(temp);
}
