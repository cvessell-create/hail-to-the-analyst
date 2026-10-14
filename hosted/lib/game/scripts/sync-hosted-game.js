// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const directories = ['engine', 'js', 'server', 'tests', 'css', 'vendor', 'audit', 'scripts'];
const files = ['index.html', 'README.md', 'play-button.svg', 'LICENSE', 'COPYING-GPL-3', 'ATTRIBUTION.md'];
function collect(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(relative);
    else if (entry.isFile()) files.push(relative);
    else throw Error(`Unsupported source: ${relative}`);
  }
}
directories.forEach(collect);
for (const target of ['hosted/lib/game', 'hosted/public/game']) {
  if (!fs.statSync(path.join(root, target)).isDirectory()) throw Error(`Missing hosted copy: ${target}`);
  for (const name of files) {
    const source = path.join(root, name), destination = path.join(root, target, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    if (!fs.readFileSync(source).equals(fs.readFileSync(destination))) throw Error(`Copy mismatch: ${name}`);
  }
}
const manifest = files.sort().map(name => ({ path: name,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') }));
fs.writeFileSync(path.join(root, 'hosted/game-source-hashes.json'), JSON.stringify({
  schema: 'hail-hosted-mirror/v1', source: 'parent repository canonical game source', files: manifest,
}, null, 2) + '\n');
console.log(`Verified ${files.length} canonical files in both hosted game copies.`);
