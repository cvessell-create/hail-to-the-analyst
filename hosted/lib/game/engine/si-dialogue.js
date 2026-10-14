// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
// SI Level 1 (chatbot) for the learning loop. Dialogue is selected from the
// owner-authored corpus exported by VessellFramework; it is never generated or
// rewritten here. The loop only contributes measured telemetry.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailSIDialogue = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
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
    const records = [];
    let linkReady = false;
    async function remote(path, body) {
      if (!opts.chatUrl || typeof win.fetch !== 'function') return null;
      const ctl = typeof win.AbortController === 'function' ? new win.AbortController() : null;
      const timer = ctl ? win.setTimeout(() => ctl.abort(), 30000) : 0;
      try {
        const res = await win.fetch(opts.chatUrl + path, body === undefined ? { signal: ctl && ctl.signal } :
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal });
        return res.ok ? await res.json() : null;
      } catch (e) { return null; } finally { if (timer) win.clearTimeout(timer); }
    }
    function postReply(r) {
      records.push({ at: Date.now(), kind: r.kind, label: r.label, model: r.model, text: r.text, sources: r.sources });
      if (records.length > 200) records.shift();
      post(r.kind === 'generated' ? 'SI' : r.kind === 'telemetry' ? 'LOOP' : 'AUTHOR', r.text, opts.hideSources ? null : (r.sources[0] || {}).cite);
    }
    let floor = 0;
    try { floor = JSON.parse(win.localStorage.getItem(opts.storageKey)).stage | 0; } catch (e) { floor = 0; }

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
    if (dock && head.addEventListener) head.addEventListener('click', () => {
      const narrow = win.matchMedia && win.matchMedia('(max-aspect-ratio:1/1)').matches;
      panel.classList.toggle(narrow ? 'expanded' : 'collapsed');
    });

    function post(who, text, cite) {
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
        const q = ask.value.trim(); ask.value = '';
        post('YOU', q);
        const learner = opts.learner && opts.learner();
        if (learner && /\b(status|progress|stage|level)\b/i.test(q)) {
          const p = progress(corpus, learner.history, floor);
          post('LOOP', 'gen ' + learner.generation + ' · best ' + Math.round(learner.bestFitness) + ' · milestones ' +
            corpus.stages.map((s, i) => (i < p.stage ? '✓' : '·') + s.name).join(' '));
        }
        const stageId = learner ? progress(corpus, learner.history, floor).current.id : null;
        remote('/chat', { message: q, view: 'game', game: opts.facts ? opts.facts() : null }).then(rr => {
          if (rr && rr.text) return postReply(rr);
          const r = dlg.respond(q, stageId);
          if (r) postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: r.text, sources: [r] });
          else post('LOOP', 'No matching line in the owner corpus.');
        });
      }
    }));

    post('LOOP', 'Corpus loaded: ' + corpus.lines.length + ' owner lines from ' + corpus.sources.length + ' sources. Text is selected, never rewritten.');
    const intro = dlg.say('intake', 0);
    postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: intro.text, sources: [intro] });
    remote('/status').then(st => {
      linkReady = Boolean(st && st.model_ready);
      post('LOOP', st ? 'Framework link up: ' + st.backend + (linkReady ? ' online' : ' offline, owner-text fallback') +
        ' · loop memory ' + st.loop.episodes + ' episodes.' : 'Framework link down; local Level 1 chatbot only.');
    });

    return {
      dialogue: dlg,
      onEpisode(learner, episode, result) {
        const before = floor, p = status(learner);
        post('LOOP', 'gen ' + (learner.generation - 1) + ' · mission ' + (episode.mission + 1) + ' · ' + episode.outcome +
          ' · kills ' + episode.kills + ' · fitness ' + Math.round(result.score) + (result.improved ? ' · NEW CHAMPION' : ''));
        if (p.stage > before) {
          floor = p.stage;
          try { win.localStorage.setItem(opts.storageKey, JSON.stringify({ stage: floor })); } catch (e) { /* ignore */ }
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
        remote('/chat', { message: '', view: 'game', event, game: opts.facts ? opts.facts() : null }).then(rr => {
          if (rr && rr.text) return postReply(rr);
          if (p.stage === before && (result.improved || episode.died)) {
            const q = dlg.say(p.current.id, learner.generation * 7 + (episode.died ? 3 : 0));
            postReply({ kind: 'owner', label: 'owner text, verbatim', model: null, text: q.text, sources: [q] });
          }
        });
      },
      status,
      post,
      records,
      linkReady: () => linkReady
    };
  }

  return { MILESTONES, progress, createDialogue, mount, display };
});
