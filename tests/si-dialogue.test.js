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

function fakeWindow(fetchImpl) {
  class El {
    constructor() { this.children = []; this.style = {}; this.textContent = ''; this.listeners = {}; this.kids = {}; this.value = ''; }
    set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
    get firstChild() { return this.children[0]; }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    querySelector(sel) { return this.kids[sel] || (this.kids[sel] = new El()); }
    addEventListener(t, f) { this.listeners[t] = f; }
  }
  const store = new Map();
  return {
    document: { body: new El(), createElement: () => new El() },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    fetch: fetchImpl, setTimeout, clearTimeout
  };
}
const rows = win => win.document.body.children[0].querySelector('#siLog').children.map(r => ({
  who: r.querySelector('b').textContent, text: r.querySelector('span').textContent, cite: r.querySelector('i').textContent }));
const tick = () => new Promise(r => setTimeout(r, 5));

test('game displays the local formula status without changing milestone progression', async () => {
  const win = fakeWindow(async url => ({ ok: true, json: async () => url.endsWith('/formula')
    ? { schema: 'vessell-formula/v1', state: 'UP', phase1: 'LOCAL_RECEIPT_VERIFIED' }
    : { backend: 'test', model_ready: true, loop: { episodes: 0 } } }));
  const ch = SI.mount(win, corpus, {});
  await tick();
  assert.equal(ch.formulaStatus().state, 'UP');
  const panel = win.document.body.children[0];
  assert.match(panel.children.find(el => el.id === 'siFormula').textContent, /UP.*LOCAL_RECEIPT_VERIFIED/);
  assert.equal(SI.progress(corpus, []).stage, 0);
});

test('framework LLM replies show in game with sources hidden but recorded', async () => {
  const calls = [];
  const win = fakeWindow(async (url, init) => {
    calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    const body = url.endsWith('/status') ? { backend: 'ollama:test', model_ready: true, loop: { episodes: 3 } }
      : { kind: 'generated', label: 'SI generated (derivative of owner sources)', model: 'ollama:test', text: 'Hold the corridor, Analyst.',
        sources: [{ id: corpus.lines[0].id, cite: 'SKILL.md:1', sha256: corpus.lines[0].sha256 }] };
    return { ok: true, json: async () => body };
  });
  const learner = { generation: 2, bestFitness: 10, history: [{ mission: 0, outcome: 'dead', kills: 1, died: true }] };
  const ch = SI.mount(win, corpus, { learner: () => learner });
  await tick();
  ch.onEpisode(learner, learner.history[0], { score: -50, improved: false });
  await tick();
  const si = rows(win).find(r => r.who === 'SI:');
  assert.equal(si.text, 'Hold the corridor, Analyst.');
  assert.equal(si.cite, '', 'citation hidden in game play');
  assert.equal(ch.records.at(-1).sources[0].cite, 'SKILL.md:1');
  const ev = calls.find(c => c.body && c.body.event).body.event;
  assert.equal(ev.outcome, 'dead');
  assert.equal(ch.linkReady(), true);
});

test('game falls back to verbatim owner lines when the framework link is down', async () => {
  const win = fakeWindow(async () => { throw new Error('offline'); });
  const ch = SI.mount(win, corpus, {});
  await tick();
  const author = rows(win).filter(r => r.who === 'AUTHOR:');
  assert.ok(author.length >= 1);
  assert.ok(corpus.lines.some(l => SI.display(l.text) === author[0].text));
  assert.ok(rows(win).some(r => /link down/.test(r.text)));
  assert.equal(ch.records[0].kind, 'owner');
});

test('SI footprint episode payload adds only structured scrub records and leaves other missions unchanged', async () => {
  const calls = [], ops = require('../engine/footprint-ops.js');
  const win = fakeWindow(async (url, init) => {
    if (init && init.body) calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ text: '', loop: { episodes: 0 } }) };
  });
  const ch = SI.mount(win, corpus, {});
  let state = ops.scrub({ ...ops.createState(), time: 1.75 }, 'F2');
  state = ops.scrub({ ...state, time: 3 }, 'F1');
  const learner = { generation: 2, history: [] }, result = { score: 100, improved: false };
  ch.onEpisode(learner, { mission: 7, outcome: 'complete', kills: 0, died: false, seconds: 4,
    footprints: ops.episode(state).map(n => ({ ...n, name: 'never transmit', domain: 'never.example' })), footprints_total: 8 }, result);
  ch.onEpisode(learner, { mission: 0, outcome: 'dead', kills: 0, died: true, seconds: 2 }, result);
  await tick();
  const events = calls.filter(c => c.event).map(c => c.event);
  assert.deepEqual(events[0].footprints, ops.episode(state));
  assert.equal(events[0].footprints_total, 8);
  assert.equal(Object.hasOwn(events[1], 'footprints'), false);
  assert.equal(Object.hasOwn(events[1], 'footprints_total'), false);
});
