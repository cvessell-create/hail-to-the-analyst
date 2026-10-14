// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HailGameplayData = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  const DATA_KEY = 'hail.gameplay-data.v1';
  const CONSENT_KEY = 'hail.gameplay-consent.v1';
  const SCHEMA = 'hail-gameplay-data/v1';
  const REPORT_SCHEMA = 'hail-gameplay-report/v1';
  const MAX_EVENTS = 500;
  const MAX_IMPORT_BYTES = 256 * 1024;
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_AGE_MS = 72 * 60 * 60 * 1000;
  const MIN_OUTCOMES = 20;
  const MIN_SESSIONS = 5;
  const FRAME_SAMPLE_MIN = 300;
  const Z_95 = 1.959963984540054;
  const CATEGORIES = ['difficulty', 'controls', 'performance', 'bug', 'other'];
  const KINDS = ['attempt-start', 'attempt-end', 'feedback'];
  const COMMON_KEYS = ['schema', 'id', 'sessionId', 'attempt', 'kind', 'createdAt'];
  const keysByKind = {
    'attempt-start': COMMON_KEYS.concat(['mission', 'practice']),
    'attempt-end': COMMON_KEYS.concat([
      'mission', 'practice', 'outcome', 'durationMs', 'kills', 'shots', 'hits',
      'frameCount', 'frameMedianMs', 'frameP95Ms', 'deathX', 'deathY'
    ]),
    feedback: COMMON_KEYS.concat(['mission', 'category'])
  };

  function fail(message) { throw new Error(message); }
  function finiteInteger(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  }
  function sortedQuantile(values, proportion) {
    const ordered = values.slice().sort((a, b) => a - b);
    return ordered.length ? ordered[Math.ceil(proportion * ordered.length) - 1] : null;
  }
  function wilson(successes, total) {
    if (!finiteInteger(successes, 0, total) || !finiteInteger(total, 1, Number.MAX_SAFE_INTEGER)) return null;
    const p = successes / total, z2 = Z_95 * Z_95, denominator = 1 + z2 / total;
    const center = (p + z2 / (2 * total)) / denominator;
    const margin = Z_95 * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
    return { estimate: p, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), confidence: 0.95, method: 'Wilson score' };
  }
  function validateEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event) || !KINDS.includes(event.kind)) fail('Unknown gameplay event.');
    const requiredKeys = event.kind === 'attempt-end' ?
      keysByKind[event.kind].filter(key => key !== 'deathX' && key !== 'deathY') : keysByKind[event.kind];
    if (Object.keys(event).some(key => !keysByKind[event.kind].includes(key)) ||
        requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(event, key))) fail('Gameplay event fields do not match the allowlist.');
    if (event.schema !== SCHEMA || typeof event.sessionId !== 'string' || !/^[a-f0-9]{32}$/.test(event.sessionId) ||
        typeof event.id !== 'string' || !event.id.startsWith(event.sessionId + ':') ||
        !/^[a-f0-9]{32}:[a-z0-9-]{1,24}$/.test(event.id) ||
        !finiteInteger(event.attempt, event.kind === 'feedback' ? 0 : 1, 1000000) ||
        !finiteInteger(event.createdAt, 0, Number.MAX_SAFE_INTEGER)) fail('Invalid gameplay event identity or timestamp.');
    if (event.kind === 'attempt-start') {
      if (!finiteInteger(event.mission, 0, 4) || typeof event.practice !== 'boolean') fail('Invalid attempt-start event.');
    } else if (event.kind === 'attempt-end') {
      if (!finiteInteger(event.mission, 0, 4) || typeof event.practice !== 'boolean' ||
          !['completed', 'death'].includes(event.outcome) ||
          !finiteInteger(event.durationMs, 0, MAX_AGE_MS) ||
          !finiteInteger(event.kills, 0, 1000) ||
          !finiteInteger(event.shots, 0, 100000) ||
          !finiteInteger(event.hits, 0, event.shots) ||
          !finiteInteger(event.frameCount, 0, 10000000)) fail('Invalid attempt-end event.');
      if (event.frameCount === 0) {
        if (event.frameMedianMs !== null || event.frameP95Ms !== null) fail('Invalid empty frame-time summary.');
      } else if (typeof event.frameMedianMs !== 'number' || !Number.isFinite(event.frameMedianMs) ||
          event.frameMedianMs < 0 || event.frameMedianMs > 250 ||
          typeof event.frameP95Ms !== 'number' || !Number.isFinite(event.frameP95Ms) ||
          event.frameP95Ms < event.frameMedianMs || event.frameP95Ms > 250) fail('Invalid frame-time summary.');
      if (event.outcome === 'death') {
        if (!finiteInteger(event.deathX, 0, 63) || !finiteInteger(event.deathY, 0, 63)) fail('Death location is required and bounded.');
      } else if (event.deathX !== undefined || event.deathY !== undefined) fail('Only deaths may include a location.');
    } else if ((event.mission !== null && !finiteInteger(event.mission, 0, 4)) || !CATEGORIES.includes(event.category)) {
      fail('Invalid feedback event.');
    }
    return event;
  }
  function validateEnvelope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== SCHEMA ||
        Object.keys(value).some(key => key !== 'schema' && key !== 'events') ||
        !Array.isArray(value.events) || value.events.length > MAX_EVENTS) fail('Invalid gameplay data export.');
    const seen = new Set(), attemptEvents = new Set();
    value.events.forEach(event => {
      validateEvent(event);
      if (seen.has(event.id)) fail('Duplicate gameplay event ID.');
      seen.add(event.id);
      if (event.kind !== 'feedback') {
        const attemptEvent = event.sessionId + ':' + event.attempt + ':' + event.kind;
        if (attemptEvents.has(attemptEvent)) fail('Duplicate gameplay attempt event.');
        attemptEvents.add(attemptEvent);
      }
    });
    return value.events;
  }
  function safeRandomBytes() {
    if (!root || !root.crypto || typeof root.crypto.getRandomValues !== 'function') {
      fail('This browser does not provide secure random values; gameplay telemetry is unavailable.');
    }
    const bytes = new Uint8Array(16);
    root.crypto.getRandomValues(bytes);
    return bytes;
  }
  function idFromBytes(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 16) fail('Secure session ID generation failed.');
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function create(storage, options) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' ||
        typeof storage.removeItem !== 'function') fail('Browser local storage is unavailable.');
    options = options || {};
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const randomBytes = typeof options.randomBytes === 'function' ? options.randomBytes : safeRandomBytes;
    let sessionId = null, attemptNumber = 0, feedbackNumber = 0, activeAttempt = null;

    function consented() { return storage.getItem(CONSENT_KEY) === 'yes'; }
    function readEvents() {
      const raw = storage.getItem(DATA_KEY);
      if (raw === null) return [];
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { fail('Stored gameplay data is invalid JSON; export or delete it before continuing.'); }
      const currentTime = now();
      const events = validateEnvelope(parsed).filter(event => {
        if (event.createdAt > currentTime + 300000) fail('Stored gameplay event has an invalid future timestamp.');
        return event.createdAt >= currentTime - RETENTION_MS;
      });
      if (events.length !== parsed.events.length) writeEvents(events);
      return events;
    }
    function writeEvents(events) {
      const cutoff = now() - RETENTION_MS;
      const unique = new Map();
      events.forEach(event => {
        validateEvent(event);
        const previous = unique.get(event.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(event)) fail('Conflicting gameplay event ID.');
        if (event.createdAt >= cutoff) unique.set(event.id, event);
      });
      const retained = Array.from(unique.values()).sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_EVENTS);
      storage.setItem(DATA_KEY, JSON.stringify({ schema: SCHEMA, events: retained }));
      return retained;
    }
    function session() {
      if (!sessionId) sessionId = idFromBytes(randomBytes());
      return sessionId;
    }
    function append(kind, fields, idSuffix) {
      const timestamp = now();
      const event = Object.assign({
        schema: SCHEMA,
        id: session() + ':' + idSuffix,
        sessionId,
        attempt: kind === 'feedback' ? attemptNumber : Math.max(1, attemptNumber),
        kind,
        createdAt: timestamp
      }, fields);
      validateEvent(event);
      const events = readEvents();
      events.push(event);
      writeEvents(events);
      return event;
    }
    function beginAttempt(mission, practice) {
      attemptNumber++;
      activeAttempt = null;
      if (!consented()) return false;
      if (!finiteInteger(mission, 0, 4) || typeof practice !== 'boolean') fail('Invalid gameplay attempt.');
      activeAttempt = {
        mission, practice, startedAt: now(), frames: Array(2501).fill(0), frameCount: 0,
        kills: 0, shots: 0, hits: 0
      };
      append('attempt-start', { mission, practice }, 'a' + attemptNumber + 's');
      return true;
    }
    function sampleFrameTime(milliseconds) {
      if (!activeAttempt || !Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 250) return false;
      activeAttempt.frames[Math.round(milliseconds * 10)]++;
      activeAttempt.frameCount++;
      return true;
    }
    function percentileFrameTime(percentile) {
      if (!activeAttempt || !activeAttempt.frameCount) return null;
      const target = Math.ceil(activeAttempt.frameCount * percentile);
      let count = 0;
      for (let frame = 0; frame < activeAttempt.frames.length; frame++) {
        count += activeAttempt.frames[frame];
        if (count >= target) return frame / 10;
      }
      return null;
    }
    function endAttempt(outcome, values) {
      if (!activeAttempt || !consented()) { activeAttempt = null; return false; }
      if (!['completed', 'death'].includes(outcome)) fail('Invalid gameplay attempt outcome.');
      values = values || {};
      const duration = Math.min(MAX_AGE_MS, Math.max(0, Math.round(values.durationMs)));
      const common = {
        mission: activeAttempt.mission, practice: activeAttempt.practice, outcome,
        durationMs: duration,
        kills: Math.min(1000, Math.max(0, Math.floor(values.kills || 0))),
        shots: Math.min(100000, Math.max(0, Math.floor(values.shots || 0))),
        hits: Math.min(100000, Math.max(0, Math.floor(values.hits || 0))),
        frameCount: activeAttempt.frameCount,
        frameMedianMs: percentileFrameTime(0.5),
        frameP95Ms: percentileFrameTime(0.95)
      };
      if (outcome === 'death') {
        common.deathX = Math.floor(values.x);
        common.deathY = Math.floor(values.y);
      }
      append('attempt-end', common, 'a' + attemptNumber + 'e');
      activeAttempt = null;
      return true;
    }
    function feedback(category, mission) {
      if (!consented()) return false;
      mission = mission === undefined ? null : mission;
      if (!CATEGORIES.includes(category) || (mission !== null && !finiteInteger(mission, 0, 4))) fail('Invalid gameplay feedback.');
      feedbackNumber++;
      append('feedback', { mission, category }, 'f' + feedbackNumber);
      return true;
    }
    function report() {
      const events = readEvents(), starts = new Map(), ends = new Map(), feedbackRows = [], terminalEvents = [];
      events.forEach(event => {
        if (event.kind === 'attempt-start') starts.set(event.sessionId + ':' + event.attempt, event);
      });
      events.forEach(event => {
        if (event.kind === 'attempt-end') {
          const key = event.sessionId + ':' + event.attempt;
          const start = starts.get(key);
          if (start && start.mission === event.mission && start.practice === event.practice && !ends.has(key)) {
            ends.set(key, event);
            terminalEvents.push(event);
          }
        } else if (event.kind === 'feedback') feedbackRows.push(event);
      });
      const groups = new Map();
      starts.forEach((start, key) => {
        const groupKey = start.mission + ':' + start.practice;
        if (!groups.has(groupKey)) groups.set(groupKey, { mission: start.mission, practice: start.practice, starts: [], terminals: [] });
        const group = groups.get(groupKey);
        group.starts.push(start);
        if (ends.has(key)) group.terminals.push(ends.get(key));
      });
      const missions = Array.from(groups.values()).sort((a, b) => a.mission - b.mission || Number(a.practice) - Number(b.practice));
      const suggestions = [];
      missions.forEach(group => {
        const completed = group.terminals.filter(event => event.outcome === 'completed');
        const deaths = group.terminals.filter(event => event.outcome === 'death');
        const total = group.terminals.length, interval = wilson(completed.length, total);
        const terminalSessions = new Set(group.terminals.map(event => event.sessionId)).size;
        const durations = group.terminals.map(event => event.durationMs);
        const row = Object.assign(group, {
          started: group.starts.length, terminal: total, completed: completed.length, deaths: deaths.length,
          terminalSessions, censored: group.starts.length - total, completionRate: interval,
          deathRate: wilson(deaths.length, total),
          medianDurationMs: sortedQuantile(durations, 0.5),
          p95DurationMs: sortedQuantile(durations, 0.95)
        });
        if (total >= MIN_OUTCOMES && terminalSessions >= MIN_SESSIONS && interval.upper < 0.6) {
          suggestions.push({
            id: 'completion-review-' + group.mission + '-' + Number(group.practice),
            type: 'completion-review',
            title: 'Review completion blockers in mission ' + (group.mission + 1),
            evidence: completed.length + ' of ' + total + ' completed (' + (100 * interval.estimate).toFixed(1) +
              '%; 95% Wilson interval ' + (100 * interval.lower).toFixed(1) + '–' + (100 * interval.upper).toFixed(1) +
              '% across ' + terminalSessions + ' separate session(s). ' + row.censored + ' started attempt(s) have no recorded outcome and are excluded.',
            sourceEventIds: group.terminals.slice(0, 100).map(event => event.id),
            action: 'human-review'
          });
        }
      });
      const deathGroups = new Map();
      terminalEvents.filter(event => event.outcome === 'death').forEach(event => {
        const key = event.mission + ':' + event.practice + ':' + event.deathX + ':' + event.deathY;
        if (!deathGroups.has(key)) deathGroups.set(key, { mission: event.mission, practice: event.practice, x: event.deathX, y: event.deathY, sessions: new Set(), sources: [] });
        const group = deathGroups.get(key);
        group.sessions.add(event.sessionId);
        group.sources.push(event.id);
      });
      deathGroups.forEach(group => {
        if (group.sessions.size >= MIN_SESSIONS) suggestions.push({
          id: 'death-cluster-' + group.mission + '-' + Number(group.practice) + '-' + group.x + '-' + group.y,
          type: 'recurring-death-location',
          title: 'Inspect recurring deaths in mission ' + (group.mission + 1),
          evidence: group.sessions.size + ' separate gameplay sessions recorded a death at grid cell (' + group.x + ', ' + group.y + '). This is a count of observed deaths, not a difficulty rate.',
          sourceEventIds: group.sources.slice(0, 100),
          action: 'human-review'
        });
      });
      const feedbackGroups = new Map();
      feedbackRows.forEach(event => {
        const key = event.category + ':' + (event.mission === null ? 'general' : event.mission);
        if (!feedbackGroups.has(key)) feedbackGroups.set(key, { category: event.category, mission: event.mission, sessions: new Set(), sources: [] });
        const group = feedbackGroups.get(key);
        group.sessions.add(event.sessionId);
        group.sources.push(event.id);
      });
      feedbackGroups.forEach(group => {
        if (group.sessions.size >= MIN_SESSIONS) suggestions.push({
          id: 'feedback-review-' + group.category + '-' + (group.mission === null ? 'general' : group.mission),
          type: 'player-feedback',
          title: 'Review player feedback about ' + group.category + (group.mission === null ? '' : ' in mission ' + (group.mission + 1)),
          evidence: group.sessions.size + ' separate gameplay sessions explicitly selected "' + group.category + '". Feedback contains category only; no free-text or identity is collected.',
          sourceEventIds: group.sources.slice(0, 100),
          action: 'human-review'
        });
      });
      const perfGroups = new Map();
      terminalEvents.filter(event => event.frameCount >= FRAME_SAMPLE_MIN).forEach(event => {
        const key = event.mission + ':' + event.practice;
        if (!perfGroups.has(key)) perfGroups.set(key, new Map());
        const sessions = perfGroups.get(key);
        const previous = sessions.get(event.sessionId);
        if (!previous || event.frameP95Ms > previous.frameP95Ms) sessions.set(event.sessionId, event);
      });
      perfGroups.forEach((sessions, key) => {
        const measured = Array.from(sessions.values()), slow = measured.filter(event => event.frameP95Ms > 33.3);
        const interval = wilson(slow.length, measured.length);
        if (measured.length >= MIN_SESSIONS && slow.length >= Math.ceil(measured.length * 0.8) && interval.lower > 0.3) {
          const [mission, practice] = key.split(':').map(Number);
          suggestions.push({
            id: 'frame-pacing-' + mission + '-' + practice,
            type: 'frame-pacing',
            title: 'Inspect frame pacing in mission ' + (mission + 1),
            evidence: slow.length + ' of ' + measured.length + ' separate sessions had a frame-time p95 above 33.3 ms; each summary used at least ' + FRAME_SAMPLE_MIN + ' measured frames.',
            sourceEventIds: slow.slice(0, 100).map(event => event.id),
            action: 'human-review'
          });
        }
      });
      const totalTerminal = missions.reduce((sum, group) => sum + group.terminal, 0);
      const hasOutcomeSample = missions.some(group => group.terminal >= MIN_OUTCOMES);
      const status = events.length === 0 ? 'no-data' :
        (hasOutcomeSample || suggestions.length ? 'ready' : 'insufficient-data');
      return {
        schema: REPORT_SCHEMA,
        status,
        counts: { events: events.length, attemptsStarted: missions.reduce((sum, group) => sum + group.started, 0),
          terminalOutcomes: totalTerminal, censoredAttempts: missions.reduce((sum, group) => sum + group.censored, 0) },
        thresholds: { outcomesPerMission: MIN_OUTCOMES, independentSessions: MIN_SESSIONS, frameSamplesPerAttempt: FRAME_SAMPLE_MIN },
        missions: missions.map(group => ({
          mission: group.mission, mode: group.practice ? 'practice' : 'campaign',
          started: group.started, terminal: group.terminal, completed: group.completed, deaths: group.deaths,
          terminalSessions: group.terminalSessions, censored: group.censored, completionRate: group.completionRate, deathRate: group.deathRate,
          medianDurationMs: group.medianDurationMs, p95DurationMs: group.p95DurationMs
        })),
        suggestions
      };
    }
    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('storage', event => {
        if ((event.key === CONSENT_KEY || event.key === null) && event.newValue !== 'yes') activeAttempt = null;
      });
    }

    return {
      schema: SCHEMA,
      constants: { maxEvents: MAX_EVENTS, retentionDays: 30, minOutcomes: MIN_OUTCOMES, minSessions: MIN_SESSIONS },
      hasConsent: consented,
      setConsent(enabled) {
        if (enabled) storage.setItem(CONSENT_KEY, 'yes');
        else {
          storage.removeItem(CONSENT_KEY);
          activeAttempt = null;
        }
        return consented();
      },
      revoke() {
        storage.removeItem(CONSENT_KEY);
        activeAttempt = null;
        return true;
      },
      deleteData() {
        storage.removeItem(CONSENT_KEY);
        storage.removeItem(DATA_KEY);
        activeAttempt = null;
        return true;
      },
      beginAttempt,
      sampleFrameTime,
      endAttempt,
      feedback,
      events() { return readEvents().map(event => Object.assign({}, event)); },
      report,
      exportData() { return JSON.stringify({ schema: SCHEMA, events: readEvents() }, null, 2); },
      importData(source) {
        if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_IMPORT_BYTES) fail('Gameplay data import exceeds the 256 KB limit.');
        let parsed;
        try { parsed = JSON.parse(source); } catch (_) { fail('Gameplay data import is not valid JSON.'); }
        const imported = validateEnvelope(parsed);
        if (imported.some(event => event.createdAt > now() + 300000)) fail('Gameplay data import contains an invalid future timestamp.');
        const merged = writeEvents(readEvents().concat(imported));
        return merged.length;
      }
    };
  }

  return { create, wilson, schemas: { data: SCHEMA, report: REPORT_SCHEMA }, limits: { maxEvents: MAX_EVENTS, maxImportBytes: MAX_IMPORT_BYTES, retentionMs: RETENTION_MS } };
});
