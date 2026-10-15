// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// SI Level 1 (chatbot) for the learning loop. Dialogue is selected from the
// owner-authored corpus exported by VessellFramework; it is never generated or
// rewritten here. The loop only contributes measured telemetry.
(function (root, factory) {
  const formula = typeof module === 'object' && module.exports ? require('./vessell-formula.js') : root.HailVessellFormula;
  const api = factory(formula);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailSIDialogue = api;
})(typeof globalThis === 'object' ? globalThis : this, function (formula) {
  'use strict';

  const STOP = new Set('a an and are as at be by for from has have how i in is it its of on or that the this to was what when where which who why with you your me my do does did can'.split(' '));

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
    return o;
  }
  function display(text) { return text.replace(/\*\*|`/g, '').replace(/(^|[\s(])\*([^*]+)\*/g, '$1$2'); }
  function tokens(s) { return (s.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).filter(t => !STOP.has(t)); }

  // Ordered milestones measured from the learner's episode history.
  const MILESTONES = Object.freeze({
    intake: h => h.length >= 1,
    corroboration: h => h.filter(e => e.kills > 0).length >= 2,
    gate: h => h.some(e => e.outcome === 'complete'),
    status: h => h.filter(e => e.improved).length >= 3,
    dependents: h => new Set(h.filter(e => e.outcome === 'complete').map(e => e.mission)).size >= 2,
    correction: h => h.some((e, i) => e.improved && h.slice(0, i).some(p => p.died))
  });

  function progress(corpus, history, floor) {
    const met = corpus.stages.map(s => Boolean(MILESTONES[s.id] && MILESTONES[s.id](history)));
    let stage = 0;
    while (stage < met.length && met[stage]) stage++;
    stage = Math.max(stage, floor || 0); // milestones are monotonic even after history is trimmed
    return { stage, total: met.length, met, complete: stage >= met.length,
      current: corpus.stages[Math.min(stage, met.length - 1)] };
  }

  function createDialogue(corpus) {
    if (!corpus || corpus.schema !== 'vessell-si-story-corpus/v1') throw Error('Unsupported story corpus.');
    deepFreeze(corpus);
    const byStage = new Map();
    for (const line of corpus.lines) {
      if (!byStage.has(line.stage)) byStage.set(line.stage, []);
      byStage.get(line.stage).push(line);
    }
    const df = new Map(), lineTokens = corpus.lines.map(l => new Set(tokens(l.text)));
    lineTokens.forEach(set => set.forEach(t => df.set(t, (df.get(t) || 0) + 1)));
    const quote = line => ({ id: line.id, text: display(line.text), cite: line.source + ':' + line.line_start, stage: line.stage, sha256: line.sha256 });

    return {
      corpus,
      quote,
      say(stageId, seed) {
        const pool = byStage.get(stageId) || byStage.get('general') || corpus.lines;
        return quote(pool[Math.abs(seed | 0) % pool.length]);
      },
      // Retrieval chatbot: best IDF-weighted overlap with the question; no text synthesis.
      respond(question, preferStage) {
        const q = new Set(tokens(question));
        if (!q.size) return null;
        let best = null, bestScore = 0;
        corpus.lines.forEach((line, i) => {
          let score = 0;
          q.forEach(t => { if (lineTokens[i].has(t)) score += Math.log(1 + corpus.lines.length / df.get(t)); });
          if (score > 0 && line.stage === preferStage) score *= 1.15;
          if (score > bestScore) { bestScore = score; best = line; }
        });
        return best ? quote(best) : null;
      }
    };
  }

  function mount(win, corpus, options) {
    // Served by the game server (local or tunnelled): use its same-origin /si proxy so remote players reach the host's SI.
    const loc = win.location || {}, viaServer = /^https?:$/.test(loc.protocol || '') && !/github\.io$/.test(loc.hostname || '');
    const opts = { storageKey: 'hail-si-level1/v1', chatUrl: viaServer ? '/si' : 'http://127.0.0.1:8790', hideSources: true, ...options };
    const doc = win.document, dlg = createDialogue(corpus);
    // Provenance for every line shown in game; citations stay out of game play when hideSources is set.
    const records = [], episodes = [], controllers = new Set();
    let linkReady = false, enabled = false, destroyed = false, revision = 0, pending = false, chatCalls = 0;
    async function remote(path, body) {
      if (!enabled || destroyed || !opts.chatUrl || typeof win.fetch !== 'function') return null;
      const requestedRevision = revision;
      const ctl = typeof win.AbortController === 'function' ? new win.AbortController() : null;
      if (ctl) controllers.add(ctl);
      const timer = ctl ? win.setTimeout(() => ctl.abort(), 30000) : 0;
      try {
        const res = await win.fetch(opts.chatUrl + path, body === undefined ? { signal: ctl && ctl.signal } :
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal });
        if (!res.ok) throw Error('HTTP ' + res.status);
        const data = await res.json();
        return !destroyed && enabled && requestedRevision === revision ? data : null;
      } catch (e) {
        if (!destroyed && enabled && requestedRevision === revision) {
          post('LOOP', 'Framework request failed: ' + e.message + '. Local owner-text chat remains available.');
          disconnect();
        }
        return null;
      } finally { if (timer) win.clearTimeout(timer); if (ctl) controllers.delete(ctl); }
    }
    function postReply(r) {
      if (destroyed) return;
      const sources = Array.isArray(r.sources) ? r.sources : [];
      records.push({ at: Date.now(), kind: r.kind, label: r.label, model: r.model, text: r.text, sources });
      if (records.length > 200) records.shift();
      post(r.kind === 'generated' ? 'SI' : r.kind === 'telemetry' ? 'LOOP' : 'AUTHOR', r.text, opts.hideSources ? null : (sources[0] || {}).cite);
    }
    let floor = 0;
    try { floor = JSON.parse(win.localStorage.getItem(opts.storageKey)).stage | 0; } catch (e) { floor = 0; }

    // One channel per page: a later mount (e.g. autopilot) replaces the earlier panel.
    const prior = doc.getElementById ? doc.getElementById('siChannel') : null;
    if (prior && prior.destroyChannel) prior.destroyChannel();
    if (prior && prior.parentNode) prior.parentNode.removeChild(prior);
    const panel = doc.createElement('div');
    panel.id = 'siChannel';
    // Docked under the game view when the page provides #dock; otherwise a floating panel.
    const dock = doc.getElementById ? doc.getElementById('dock') : null;
    if (dock) {
      panel.innerHTML = '<div id="siHead" title="click to collapse / expand">SI LEVEL 1 // CHATBOT CHANNEL</div>' +
        '<div id="siLog"></div><input id="siAsk" placeholder="ask the channel (Enter)">';
      dock.insertBefore(panel, doc.getElementById('dockTools'));
    } else {
      panel.style.cssText = 'position:fixed;left:8px;bottom:8px;width:min(440px,46vw);max-height:42vh;z-index:99;display:flex;flex-direction:column;background:#000d;border:1px solid #3a3;font:12px/1.35 Courier New,monospace;color:#cfc';
      panel.innerHTML = '<div id="siHead" style="padding:4px 6px;background:#132;color:#9f9">SI LEVEL 1 // CHATBOT CHANNEL</div>' +
        '<div id="siLog" style="overflow-y:auto;padding:4px 6px;flex:1"></div>' +
        '<input id="siAsk" placeholder="ask the channel (Enter)" style="background:#010;color:#cfc;border:0;border-top:1px solid #3a3;padding:5px;font:inherit">';
      doc.body.appendChild(panel);
    }
    const log = panel.querySelector('#siLog'), head = panel.querySelector('#siHead'), ask = panel.querySelector('#siAsk');
    ask.maxLength = 500;
    const connection = doc.createElement('button');
    connection.id = 'siConnect';
    connection.textContent = 'CONNECT FRAMEWORK (OPTIONAL)';
    panel.appendChild(connection);
    const formulaView = doc.createElement('div');
    formulaView.id = 'siFormula';
    formulaView.textContent = formula.describe(null);
    panel.appendChild(formulaView);
    let formulaStatus = null;
    async function readFormula() {
      if (!enabled || destroyed) return formulaStatus;
      const requestedRevision = revision, response = await remote('/formula');
      if (enabled && !destroyed && requestedRevision === revision) {
        formulaStatus = response;
        formulaView.textContent = formula.describe(formulaStatus);
      }
      return formulaStatus;
    }
    async function refreshFormula() {
      if (pending) return formulaStatus;
      pending = true;
      try { return await readFormula(); } finally { pending = false; }
    }
    function disconnect() {
      enabled = false; linkReady = false; revision++;
      controllers.forEach(ctl => ctl.abort()); controllers.clear();
      formulaStatus = null;
      formulaView.textContent = 'LOCAL ONLY: no automatic framework requests.';
      connection.textContent = 'CONNECT FRAMEWORK (OPTIONAL)';
    }
    async function connect() {
      if (destroyed || pending || enabled) return;
      if (!opts.chatUrl || typeof win.fetch !== 'function') {
        post('LOOP', 'Framework connection unavailable; local owner-text chat remains available.');
        return;
      }
      enabled = true; pending = true;
      connection.textContent = 'DISCONNECT FRAMEWORK';
      try {
        const st = await remote('/status');
        if (!enabled || destroyed) return;
        linkReady = Boolean(st && st.model_ready);
        post('LOOP', st ? 'Framework connected: ' + st.backend + (linkReady ? ' online.' : ' model unavailable; local replies.') :
          'Framework status unavailable; local replies.');
        await readFormula();
      } finally { pending = false; }
    }
    connection.onclick = () => { if (enabled) disconnect(); else return connect(); };
    function destroy() {
      destroyed = true;
      disconnect();
    }
    panel.destroyChannel = destroy;
    disconnect();
    if (dock && head.addEventListener) head.addEventListener('click', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      const narrow = win.matchMedia && win.matchMedia('(pointer:coarse),(max-width:760px),(max-aspect-ratio:1/1)').matches;
      panel.classList.toggle(narrow ? 'expanded' : 'collapsed');
    });

    function post(who, text, cite) {
      if (destroyed) return;
      const row = doc.createElement('div');
      row.style.margin = '3px 0';
      const color = who === 'AUTHOR' ? '#ffd27a' : who === 'YOU' ? '#9cf' : who === 'SI' ? '#7ff' : '#9f9';
      row.innerHTML = '<b style="color:' + color + '"></b> <span></span>' + (cite ? ' <i style="color:#7a7"></i>' : '');
      row.querySelector('b').textContent = who + ':';
      row.querySelector('span').textContent = text;
      if (cite) row.querySelector('i').textContent = '[' + cite + ']';
      log.appendChild(row);
      while (log.children.length > 60) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    }
    function status(learner) {
      const p = progress(corpus, learner.history, floor);
      head.textContent = 'SI LEVEL 1 // CHATBOT  ' + p.stage + '/' + p.total + ' stages' +
        (p.complete ? ' COMPLETE' : ' · next: ' + p.current.name.toUpperCase());
      return p;
    }

    // Keep typing in the channel from reaching the game's window key handlers.
    ['keydown', 'keyup'].forEach(type => ask.addEventListener(type, e => {
      e.stopPropagation();
      if (type === 'keydown' && e.key === 'Enter' && ask.value.trim()) {
        if (pending) { post('LOOP', 'One request is already pending. Wait or disconnect to cancel.'); return; }
        if (ask.value.trim().length > 500) { post('LOOP', 'Message limit: 500 characters.'); return; }
        const q = ask.value.trim(); ask.value = '';
        post('YOU', q);
        const learner = opts.learner && opts.learner();
        if (learner && /\b(status|progress|stage|level)\b/i.test(q)) {
          const p = progress(corpus, learner.history, floor);
          post('LOOP', 'gen ' + learner.generation + ' · best ' + Math.round(learner.bestFitness) + ' · milestones ' +
            corpus.stages.map((s, i) => (i < p.stage ? '✓' : '·') + s.name).join(' '));
        }
        const stageId = learner ? progress(corpus, learner.history, floor).current.id : null;
        const localReply = () => {
          const r = dlg.respond(q, stageId);
          if (r) postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: r.text, sources: [r] });
          else post('LOOP', 'No matching line in the owner corpus.');
        };
        if (!enabled) { localReply(); return; }
        if (chatCalls >= 20) { post('LOOP', 'Session limit: 20 framework chat requests. Local chat is still available.'); disconnect(); localReply(); return; }
        pending = true; chatCalls++;
        remote('/chat', { message: q, view: 'game', game: opts.facts ? opts.facts() : null }).then(rr => {
          if (rr && rr.text) postReply(rr); else localReply();
        }).finally(() => { pending = false; });
      }
    }));

    post('LOOP', 'Corpus loaded: ' + corpus.lines.length + ' owner lines from ' + corpus.sources.length + ' sources. Text is selected, never rewritten.');
    const intro = dlg.say('intake', 0);
    postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: intro.text, sources: [intro] });
    post('LOOP', 'Local owner-text chat. No model calls or polling. Connect only if you want framework access; each submitted message may use the configured model.');

    return {
      dialogue: dlg,
      onEpisode(learner, episode, result) {
        if (destroyed) return;
        const before = floor, p = status(learner);
        post('LOOP', 'gen ' + (learner.generation - 1) + ' · mission ' + (episode.mission + 1) + ' · ' + episode.outcome +
          ' · kills ' + episode.kills + ' · fitness ' + Math.round(result.score) + (result.improved ? ' · NEW CHAMPION' : ''));
        if (p.stage > before) {
          floor = p.stage;
          try { win.localStorage.setItem(opts.storageKey, JSON.stringify({ stage: floor })); }
          catch (e) { post('LOOP', 'Milestone save failed: ' + e.message); }
          for (let s = before; s < p.stage; s++) {
            const st = corpus.stages[s];
            post('LOOP', 'STAGE ' + (s + 1) + '/' + p.total + ' ' + st.name.toUpperCase() + ' reached: ' + st.milestone + '.');
            const q = dlg.say(st.id, learner.generation);
            postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: q.text, sources: [q] });
          }
          if (p.complete) post('LOOP', 'SI LEVEL 1 milestones complete for this browser profile.');
        }
        const event = { generation: learner.generation - 1, mission: episode.mission, outcome: episode.outcome,
          kills: episode.kills, fitness: Math.round(result.score), improved: result.improved, died: episode.died,
          seconds: episode.seconds, stage: p.complete ? 'correction' : p.current.id };
        if (Array.isArray(episode.footprints)) {
          event.footprints = episode.footprints.map(({ id, category, severity, difficulty, t }) => ({ id, category, severity, difficulty, t }));
          event.footprints_total = episode.footprints_total;
        }
        episodes.push(event);
        if (episodes.length > 200) episodes.shift();
        if (p.stage === before && (result.improved || episode.died)) {
          const q = dlg.say(p.current.id, learner.generation * 7 + (episode.died ? 3 : 0));
          postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: q.text, sources: [q] });
        }
      },
      status,
      post,
      records,
      episodes,
      connect,
      disconnect,
      destroy,
      refreshFormula,
      formulaStatus: () => formulaStatus,
      linkReady: () => linkReady
    };
  }

  return { MILESTONES, progress, createDialogue, mount, display };
});
