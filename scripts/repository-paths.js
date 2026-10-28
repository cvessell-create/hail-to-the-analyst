// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';
const fs = require('node:fs'), path = require('node:path');

function confinedPath(root, requested) {
  const base = path.resolve(root);
  if (typeof requested !== 'string' || !requested || requested.includes('\0'))
    throw Error('A nonempty filesystem path is required');
  const target = path.resolve(base, requested);
  const relative = path.relative(base, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw Error(`Path must stay within ${base}: ${requested}`);
  let current = base;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw Error(`Symbolic links are not allowed: ${current}`);
  }
  return target;
}

function readFile(root, requested) {
  const filename = confinedPath(root, requested);
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    if (!fs.fstatSync(fd).isFile()) throw Error(`Expected regular file: ${filename}`);
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

function writeFile(root, requested, bytes) {
  const filename = confinedPath(root, requested);
  const fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT |
    fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) throw Error(`Expected singly linked regular output file: ${filename}`);
    fs.ftruncateSync(fd);
    fs.writeFileSync(fd, bytes);
  } finally { fs.closeSync(fd); }
}

module.exports = { confinedPath, readFile, writeFile };
