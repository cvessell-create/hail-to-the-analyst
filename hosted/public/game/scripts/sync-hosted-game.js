// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { confinedPath, readFile, writeFile } = require('./repository-paths');
const root = path.resolve(__dirname, '..');
const directories = ['engine', 'js', 'server', 'tests', 'css', 'vendor', 'audit', 'scripts', 'archive'];
const files = ['index.html', 'README.md', 'play-button.svg', 'LICENSE', 'COPYING-GPL-3', 'ATTRIBUTION.md'];
files.push('.github/workflows/engine.yml');
for (const name of ['.gitignore', 'README.md', 'Makefile', 'Makefile.kos', 'slice.h',
  'slice.c', 'main.c', 'worker.c', 'test_slice.c', 'native-build.sh', 'toolchain.json']) {
  files.push(`homebrew/${name}`);
}
function collect(directory) {
  for (const entry of fs.readdirSync(confinedPath(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    confinedPath(root, relative);
    if (entry.isDirectory()) collect(relative);
    else if (entry.isFile()) files.push(relative);
    else throw Error(`Unsupported source: ${relative}`);
  }
}
directories.forEach(collect);
const register = confinedPath(root, 'hosted/game-source-hashes.json');
const previous = fs.existsSync(register) ? JSON.parse(readFile(root, register)).files : [];
const current = new Set(files);
const retired = previous.filter(row => !current.has(row.path));
for (const row of retired) {
  if (path.isAbsolute(row.path) || row.path.split(/[\\/]/).some(part => part === '..'))
    throw Error(`Invalid retired mirror path: ${row.path}`);
}
// Only retire previously registered files; hosted-only assets are not ours to remove.
for (const target of ['hosted/lib/game', 'hosted/public/game']) {
  for (const row of retired) {
    const destination = confinedPath(root, path.join(target, row.path));
    if (fs.existsSync(destination) &&
        crypto.createHash('sha256').update(readFile(root, destination)).digest('hex') !== row.sha256)
      throw Error(`Retired mirror was edited: ${target}/${row.path}`);
  }
}
for (const target of ['hosted/lib/game', 'hosted/public/game']) {
  if (!fs.statSync(confinedPath(root, target)).isDirectory()) throw Error(`Missing hosted copy: ${target}`);
  for (const row of retired) {
    const destination = confinedPath(root, path.join(target, row.path));
    if (fs.existsSync(destination)) fs.unlinkSync(destination);
  }
  for (const name of files) {
    const source = confinedPath(root, name), destination = confinedPath(root, path.join(target, name));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    writeFile(root, destination, readFile(root, source));
    if (!readFile(root, source).equals(readFile(root, destination))) throw Error(`Copy mismatch: ${name}`);
  }
}
const manifest = files.sort().map(name => ({ path: name,
  sha256: crypto.createHash('sha256').update(readFile(root, name)).digest('hex') }));
writeFile(root, register, JSON.stringify({
  schema: 'hail-hosted-mirror/v1', source: 'parent repository canonical game source', files: manifest,
}, null, 2) + '\n');
console.log(`Verified ${files.length} canonical files in both hosted game copies.`);
