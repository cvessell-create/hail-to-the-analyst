'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const corpus = require('../engine/si-story-corpus.js');
const SI = require('../engine/si-dialogue.js');

const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

test('every corpus line carries a valid hash of its verbatim owner text', () => {
  assert.equal(corpus.schema, 'vessell-si-story-corpus/v1');
  assert.ok(corpus.lines.length > 100);
  for (const line of corpus.lines) assert.equal(sha(line.text), line.sha256, line.id);
});

test('progression stages advance only in milestone order', () => {
  const ep = (o) => ({ mission: 0, outcome: 'dead', kills: 0, died: true, improved: false, ...o });
  assert.equal(SI.progress(corpus, []).stage, 0);
  assert.equal(SI.progress(corpus, [ep()]).stage, 1);
  // A mission exit without two kill episodes cannot skip the corroboration stage.
  assert.equal(SI.progress(corpus, [ep({ outcome: 'complete', died: false })]).stage, 1);
  const h = [ep({ kills: 2 }), ep({ kills: 1, improved: true }), ep({ outcome: 'complete', died: false, improved: true })];
  assert.equal(SI.progress(corpus, h).stage, 3);
  h.push(ep({ mission: 1, outcome: 'complete', died: false, improved: true }));
  const p = SI.progress(corpus, h);
  assert.equal(p.stage, 6);
  assert.equal(p.complete, true);
  assert.equal(SI.progress(corpus, [], 4).stage, 4, 'persisted floor survives history trimming');
});

test('dialogue selects owner lines deterministically and never alters their words', () => {
  const d = SI.createDialogue(corpus);
  const a = d.say('gate', 5), b = d.say('gate', 5);
  assert.deepEqual(a, b);
  const src = corpus.lines.find(l => l.id === a.id);
  assert.equal(src.stage, 'gate');
  assert.equal(a.text, SI.display(src.text));
  assert.match(a.cite, /\.md:\d+$/);
  assert.throws(() => { corpus.lines[0].text = 'changed'; });
});

test('chatbot reply retrieves a cited owner line, or nothing', () => {
  const d = SI.createDialogue(corpus);
  const r = d.respond('how does a correction reach dependents?');
  assert.ok(r && r.cite);
  assert.ok(corpus.lines.some(l => l.id === r.id && SI.display(l.text) === r.text));
  assert.equal(d.respond('the and of'), null);
});
