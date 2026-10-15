// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawnSync, execFileSync} = require('node:child_process');
const root = __dirname;
const binary = path.join(root, '.deps/flycast-build-arm64/Flycast.app/Contents/MacOS/Flycast');
const guest = path.join(root, 'build/hail-slice.elf');
const source = path.join(root, '.deps/flycast');
const patch = path.join(root, 'runtime/flycast-automation-macos.patch');
const git = args => execFileSync('git', ['-C', source, ...args], {encoding: 'utf8'});
const revision = git(['rev-parse', 'HEAD']).trim();
assert.equal(revision, '80471d57b02606f53828daa916de6ecc94ca1877');
assert.equal(git(['remote', 'get-url', 'origin']).trim(), 'https://github.com/flyinghead/flycast.git');
assert.equal(git(['diff', 'HEAD', '--']), fs.readFileSync(patch, 'utf8'),
  'Runtime source must match the declared revision plus compatibility patch');
assert.ok(fs.existsSync(binary), 'Build the native Flycast automation runtime first');
assert.ok(fs.existsSync(guest), 'Build the original KOS guest first');
execFileSync('make', ['-C', root, 'host-worker'], {stdio: 'inherit'});
const actions = [[-1, 0], ...Array.from({length: 5}, () => [1, 0]),
  ...Array.from({length: 5}, () => [0, 1]), ...Array.from({length: 5}, () => [-1, 0]),
  ...Array.from({length: 5}, () => [1, 0])];
const native = execFileSync(path.join(root, 'build/hail-worker'), [], {
  input: actions.map(([x, y]) => `step ${x} ${y}\n`).join(''), encoding: 'utf8'
}).trim().split('\n').map(line => JSON.parse(line));
const directory = fs.mkdtempSync(path.join(root, 'build/flycast-smoke-'));
fs.mkdirSync(path.join(directory, 'scripts'));
const home = path.join(directory, 'home');
fs.mkdirSync(path.join(home, '.flycast/data'), {recursive: true});
const events = ['1 button 0 ffff'];
let clock = 200000000;
for (const [x, y] of actions) {
  const button = x < 0 ? 0x40 : x > 0 ? 0x80 : y < 0 ? 0x10 : 0x20;
  events.push(`${clock} button 0 ${(0xffff ^ button).toString(16)}`);
  clock += 20000000;
  events.push(`${clock} button 0 ffff`);
  clock += 20000000;
}
fs.writeFileSync(path.join(directory, 'scripts/hail-slice.input'), events.join('\n') + '\n');
const execution = spawnSync(binary, [
  '-config', 'config:UseReios=yes',
  '-config', 'config:Debug.SerialConsoleEnabled=yes',
  '-config', 'config:UploadCrashLogs=no',
  '-config', 'config:DiscordPresence=no',
  '-config', 'network:Enable=no',
  '-config', 'network:EnableUPnP=no',
  '-config', 'achievements:Enabled=no',
  '-config', 'log:Verbosity=3',
  '-config', 'record:replay_input=yes',
  guest
], {cwd: directory, env: {...process.env, HOME: home}, encoding: 'utf8',
  timeout: 90000, maxBuffer: 8 * 1024 * 1024, killSignal: 'SIGTERM'});
fs.writeFileSync(path.join(directory, 'stdout.log'), execution.stdout || '');
fs.writeFileSync(path.join(directory, 'stderr.log'), execution.stderr || '');
console.log(`Native guest evidence: ${directory}`);
assert.ifError(execution.error);
assert.equal(execution.status, 0, `Runtime failed (${execution.signal}); inspect the saved logs`);
assert.ok(!execution.stderr.includes('Invalid -config option'), 'Runtime rejected a smoke-test setting');
const stdout = execution.stdout.replace(/\r/g, '');
assert.equal((stdout.match(/HAIL_READY camera=ISOMETRIC_THIRD_PERSON/g) || []).length, 1);
const actual = [...stdout.matchAll(/HAIL_STATE x=(\d+) y=(\d+) collected=(\d+) complete=(\d+)/g)]
  .map(match => ({x: Number(match[1]), y: Number(match[2]),
    collected: Number(match[3]), complete: match[4] === '1'}));
const expected = native.map(({x, y, collected, complete}) => ({x, y, collected, complete}));
assert.deepEqual(actual, expected, 'SH4 controller replay differs from the host C state machine');
assert.deepEqual(actual[0], {x: 256, y: 256, collected: 0, complete: false});
assert.deepEqual(actual.at(-1), {x: 1536, y: 1536, collected: 3, complete: true});
const screenshot = path.join(directory, 'screenshot.png');
const image = fs.readFileSync(screenshot);
assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(image.readUInt32BE(16), 640);
assert.equal(image.readUInt32BE(20), 480);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence = {scope: 'ACTUAL_SH4_GUEST_NATIVE_FLYCAST', actions: actual.length,
  source_revision: revision,
  compatibility_patch: 'homebrew/runtime/flycast-automation-macos.patch',
  patch_sha256: hash(patch),
  guest_sha256: hash(guest), runtime_sha256: hash(binary), screenshot_sha256: hash(screenshot),
  replay_sha256: hash(path.join(directory, 'scripts/hail-slice.input')),
  stdout_sha256: hash(path.join(directory, 'stdout.log')),
  framebuffer: {width: image.readUInt32BE(16), height: image.readUInt32BE(20)},
  compared_fields: ['x', 'y', 'collected', 'complete'],
  controller_trace_matches_host: true, states: actual, final_state: actual.at(-1),
  boot_configuration: 'REIOS; fresh isolated HOME; no supplied BIOS',
  browser_runtime: 'NOT_RUN', owner_visual_review: 'PENDING'};
fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
