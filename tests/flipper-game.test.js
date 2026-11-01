// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');

test('Flipper portable slice and campaign rules pass, including three playable missions', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hail-flipper-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cwd = path.resolve(__dirname, '../flipper/hail_analyst');
  for (const [name, sources] of [
    ['slice', ['game_slice.c', 'game_rules.c', 'test_game_rules.c']],
    ['campaign', ['campaign.c', 'test_campaign.c']],
  ]) {
    const executable = path.join(directory, name);
    execFileSync(process.env.CC || 'cc',
      ['-std=c99', '-Wall', '-Wextra', '-Werror', '-pedantic', ...sources, '-o', executable],
      { cwd, encoding: 'utf8' });
    assert.match(execFileSync(executable, [], { encoding: 'utf8' }), /passed/i);
  }
});
