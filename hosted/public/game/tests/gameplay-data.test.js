'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const GameplayData = require('../engine/gameplay-data.js');

function storage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
function instance(target, sessionNumber, now = () => 1000000) {
  return GameplayData.create(target, {
    now,
    randomBytes() { return new Uint8Array(16).fill(sessionNumber); }
  });
}
function completedAttempt(data, mission = 0, outcome = 'completed', time = 8000) {
  data.beginAttempt(mission, false);
  data.endAttempt(outcome, { durationMs: time, kills: 2, shots: 5, hits: 3, x: 4.8, y: 7.2 });
}

test('consent is off by default and no gameplay is stored until explicit opt-in', () => {
  const target = storage(), data = instance(target, 1);
  assert.equal(data.hasConsent(), false);
  assert.equal(data.beginAttempt(0, false), false);
  assert.equal(data.feedback('controls'), false);
  assert.deepEqual(data.events(), []);
  assert.equal(data.report().status, 'no-data');
  assert.deepEqual(Array.from(target.values.keys()), []);
  data.setConsent(true);
  data.beginAttempt(0, false);
  data.endAttempt('completed', { durationMs: 1000, kills: 0, shots: 0, hits: 0 });
  assert.equal(data.events().length, 2);
});

test('event allowlist records gameplay summaries, bounded frame metrics and no input or device data', () => {
  const data = instance(storage(), 2);
  data.setConsent(true);
  data.beginAttempt(3, true);
  for (let i = 0; i < 400; i++) data.sampleFrameTime(i % 2 ? 16.2 : 35.7);
  data.endAttempt('death', { durationMs: 12345, kills: 1, shots: 12, hits: 4, x: 5.9, y: 9.1 });
  const [start, end] = data.events();
  assert.equal(start.kind, 'attempt-start');
  assert.equal(start.practice, true);
  assert.equal(end.kind, 'attempt-end');
  assert.equal(end.outcome, 'death');
  assert.deepEqual([end.deathX, end.deathY], [5, 9]);
  assert.equal(end.frameCount, 400);
  assert.equal(end.frameMedianMs, 16.2);
  assert.equal(end.frameP95Ms, 35.7);
  for (const event of data.events()) {
    assert.deepEqual(Object.keys(event).sort(), ({
      'attempt-start': ['attempt', 'createdAt', 'id', 'kind', 'mission', 'practice', 'schema', 'sessionId'],
      'attempt-end': ['attempt', 'createdAt', 'deathX', 'deathY', 'durationMs', 'frameCount', 'frameMedianMs', 'frameP95Ms', 'hits', 'id', 'kills', 'kind', 'mission', 'outcome', 'practice', 'schema', 'sessionId', 'shots']
    })[event.kind].sort());
  }
  assert.equal(JSON.stringify(data.events()).includes('KeyW'), false);
  assert.equal(JSON.stringify(data.events()).includes('userAgent'), false);
  assert.equal(JSON.stringify(data.events()).includes('ipAddress'), false);
});

test('unfinished attempts are censored and excluded from known-outcome rates', () => {
  const data = instance(storage(), 3);
  data.setConsent(true);
  completedAttempt(data, 1, 'death');
  data.beginAttempt(1, false);
  const [mission] = data.report().missions;
  assert.deepEqual(
    { started: mission.started, terminal: mission.terminal, completed: mission.completed, deaths: mission.deaths, censored: mission.censored },
    { started: 2, terminal: 1, completed: 0, deaths: 1, censored: 1 }
  );
  assert.equal(mission.completionRate.estimate, 0);
  assert.equal(mission.deathRate.estimate, 1);
  assert.equal(data.report().status, 'insufficient-data');
  assert.equal(data.report().suggestions.length, 0);
});

test('Wilson score intervals remain bounded and report exact denominators', () => {
  const none = GameplayData.wilson(0, 5), all = GameplayData.wilson(5, 5);
  assert.ok(none.lower >= 0 && none.upper < 0.5);
  assert.ok(all.lower > 0.5 && all.upper <= 1);
  assert.equal(none.estimate, 0);
  assert.equal(all.estimate, 1);
  assert.equal(GameplayData.wilson(0, 0), null);
});

test('low completion suggestion requires twenty known outcomes and links the observed events', () => {
  const oneSession = instance(storage(), 30);
  oneSession.setConsent(true);
  for (let attempt = 0; attempt < 20; attempt++) completedAttempt(oneSession, 2, 'death');
  assert.equal(oneSession.report().suggestions.some(item => item.type === 'completion-review'), false);

  const target = storage();
  for (let session = 1; session <= 5; session++) {
    const data = instance(target, session + 3);
    data.setConsent(true);
    for (let attempt = 0; attempt < 4; attempt++) completedAttempt(data, 2, session === 1 && attempt === 0 ? 'completed' : 'death');
  }
  const report = instance(target, 20).report(), suggestion = report.suggestions.find(item => item.type === 'completion-review');
  assert.equal(report.status, 'ready');
  assert.equal(report.counts.terminalOutcomes, 20);
  assert.equal(report.missions[0].terminalSessions, 5);
  assert.equal(suggestion.sourceEventIds.length, 20);
  assert.match(suggestion.evidence, /1 of 20 completed/);
  assert.match(suggestion.evidence, /Wilson interval/);
  assert.equal(suggestion.action, 'human-review');
});

test('spatial and category suggestions require independent sessions and feedback is category-only', () => {
  const target = storage();
  for (let i = 1; i <= 5; i++) {
    const data = instance(target, i);
    data.setConsent(true);
    completedAttempt(data, 4, 'death');
    assert.equal(data.feedback('controls', 4), true);
  }
  const report = instance(target, 6).report();
  assert.ok(report.suggestions.some(item => item.type === 'recurring-death-location' && item.sourceEventIds.length === 5));
  assert.ok(report.suggestions.some(item => item.type === 'player-feedback' && item.evidence.includes('5 separate gameplay sessions')));
  const feedback = instance(target, 7).events().filter(event => event.kind === 'feedback');
  assert.equal(feedback.length, 5);
  assert.deepEqual(Object.keys(feedback[0]).sort(), ['attempt', 'category', 'createdAt', 'id', 'kind', 'mission', 'schema', 'sessionId'].sort());
});

test('feedback before play has no fabricated attempt number and unmatched imported outcomes are ignored', () => {
  const target = storage(), first = instance(target, 12);
  first.setConsent(true);
  first.feedback('other');
  assert.equal(first.events()[0].attempt, 0);
  assert.equal(first.report().missions.length, 0);
  const unmatchedDeaths = Array.from({ length: 5 }, (_, index) => {
    const sessionId = (index + 10).toString(16).padStart(2, '0').repeat(16);
    return {
      schema: GameplayData.schemas.data, id: sessionId + ':a1e', sessionId,
      attempt: 1, kind: 'attempt-end', createdAt: 1000000, mission: 0, practice: false,
      outcome: 'death', durationMs: 1000, kills: 0, shots: 0, hits: 0, frameCount: 0,
      frameMedianMs: null, frameP95Ms: null, deathX: 4, deathY: 7
    };
  });
  first.importData(JSON.stringify({ schema: GameplayData.schemas.data, events: unmatchedDeaths }));
  assert.equal(first.report().counts.terminalOutcomes, 0);
  assert.equal(first.report().suggestions.some(item => item.type === 'recurring-death-location'), false);
});

test('frame-pacing suggestion requires 300 frame samples in five independent sessions', () => {
  const target = storage();
  for (let session = 1; session <= 5; session++) {
    const data = instance(target, session + 20);
    data.setConsent(true);
    data.beginAttempt(3, false);
    for (let frame = 0; frame < (session === 5 ? 299 : 300); frame++) data.sampleFrameTime(40);
    data.endAttempt('completed', { durationMs: 1000, kills: 1, shots: 1, hits: 1 });
  }
  assert.equal(instance(target, 30).report().suggestions.some(item => item.type === 'frame-pacing'), false);

  const sixth = instance(target, 26);
  sixth.setConsent(true);
  sixth.beginAttempt(3, false);
  for (let frame = 0; frame < 300; frame++) sixth.sampleFrameTime(40);
  sixth.endAttempt('completed', { durationMs: 1000, kills: 1, shots: 1, hits: 1 });
  const suggestion = instance(target, 31).report().suggestions.find(item => item.type === 'frame-pacing');
  assert.ok(suggestion);
  assert.match(suggestion.evidence, /5 of 5 separate sessions/);
  assert.equal(suggestion.sourceEventIds.length, 5);
});

test('revoke stops collection but retains history; delete removes data and consent', () => {
  const target = storage(), data = instance(target, 8);
  data.setConsent(true);
  completedAttempt(data);
  data.beginAttempt(0, false);
  const before = data.events();
  data.revoke();
  assert.equal(data.hasConsent(), false);
  assert.equal(data.endAttempt('death', { durationMs: 100, x: 1, y: 1 }), false);
  assert.deepEqual(data.events(), before);
  data.deleteData();
  assert.equal(data.hasConsent(), false);
  assert.deepEqual(data.events(), []);
  assert.equal(target.values.size, 0);
});

test('export/import is local, validated, bounded and idempotent', () => {
  const firstStorage = storage(), first = instance(firstStorage, 9);
  first.setConsent(true);
  completedAttempt(first);
  const secondStorage = storage(), second = instance(secondStorage, 10);
  assert.equal(second.importData(first.exportData()), 2);
  assert.equal(second.importData(first.exportData()), 2);
  assert.equal(second.hasConsent(), false);
  assert.deepEqual(second.report().counts, { events: 2, attemptsStarted: 1, terminalOutcomes: 1, censoredAttempts: 0 });
  const invalid = JSON.parse(first.exportData());
  invalid.events[0].rawKeystrokes = 'forbidden';
  assert.throws(() => second.importData(JSON.stringify(invalid)), /allowlist/);
  assert.throws(() => second.importData('x'.repeat(GameplayData.limits.maxImportBytes + 1)), /256 KB/);
  assert.throws(() => second.importData(JSON.stringify({ schema: 'future', events: [] })), /Invalid gameplay data export/);
  const future = JSON.parse(first.exportData());
  future.events[0].createdAt = 2000000;
  assert.throws(() => second.importData(JSON.stringify(future)), /future timestamp/);
});

test('retention prunes records older than thirty days', () => {
  let current = 2_000_000_000;
  const target = storage(), data = instance(target, 11, () => current);
  data.setConsent(true);
  completedAttempt(data);
  current += GameplayData.limits.retentionMs + 1;
  assert.deepEqual(data.events(), []);
  assert.equal(data.report().status, 'no-data');
});

test('storage retains no more than the bounded 500 events', () => {
  const data = instance(storage(), 40);
  data.setConsent(true);
  for (let attempt = 0; attempt < 260; attempt++) completedAttempt(data, 0);
  assert.equal(data.events().length, 500);
});
