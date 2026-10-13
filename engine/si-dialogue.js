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
    const opts = { storageKey: 'hail-si-level1/v1', ...options };
    const doc = win.document, dlg = createDialogue(corpus);
    let floor = 0;
    try { floor = JSON.parse(win.localStorage.getItem(opts.storageKey)).stage | 0; } catch (e) { floor = 0; }

    const panel = doc.createElement('div');
    panel.id = 'siChannel';
    panel.style.cssText = 'position:fixed;left:8px;bottom:8px;width:min(440px,46vw);max-height:42vh;z-index:99;display:flex;flex-direction:column;background:#000d;border:1px solid #3a3;font:12px/1.35 Courier New,monospace;color:#cfc';
    panel.innerHTML = '<div id="siHead" style="padding:4px 6px;background:#132;color:#9f9">SI LEVEL 1 // CHATBOT CHANNEL</div>' +
      '<div id="siLog" style="overflow-y:auto;padding:4px 6px;flex:1"></div>' +
      '<input id="siAsk" placeholder="ask the channel (Enter)" style="background:#010;color:#cfc;border:0;border-top:1px solid #3a3;padding:5px;font:inherit">';
    doc.body.appendChild(panel);
    const log = panel.querySelector('#siLog'), head = panel.querySelector('#siHead'), ask = panel.querySelector('#siAsk');

    function post(who, text, cite) {
      const row = doc.createElement('div');
      row.style.margin = '3px 0';
      const color = who === 'AUTHOR' ? '#ffd27a' : who === 'YOU' ? '#9cf' : '#9f9';
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
        const r = dlg.respond(q, learner ? progress(corpus, learner.history, floor).current.id : null);
        if (r) post('AUTHOR', r.text, r.cite); else post('LOOP', 'No matching line in the owner corpus.');
      }
    }));

    post('LOOP', 'Corpus loaded: ' + corpus.lines.length + ' owner lines from ' + corpus.sources.length + ' sources. Text is selected, never rewritten.');
    const intro = dlg.say('intake', 0);
    post('AUTHOR', intro.text, intro.cite);

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
            post('AUTHOR', q.text, q.cite);
          }
          if (p.complete) post('LOOP', 'SI LEVEL 1 milestones complete for this browser profile.');
        } else if (result.improved || episode.died) {
          const q = dlg.say(p.current.id, learner.generation * 7 + (episode.died ? 3 : 0));
          post('AUTHOR', q.text, q.cite);
        }
      },
      status,
      post
    };
  }

  return { MILESTONES, progress, createDialogue, mount, display };
});
