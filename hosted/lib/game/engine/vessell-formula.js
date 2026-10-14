// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailVessellFormula = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'vessell-formula/v1';
  function evaluate(required, observations, runId) {
    const problems = [];
    if (!runId) problems.push('missing run id');
    if (!required.length || new Set(required).size !== required.length) problems.push('required ids must be nonempty and unique');
    const ids = observations.map(row => row.id);
    if (new Set(ids).size !== ids.length) problems.push('duplicate observation id');
    if (new Set(ids).size !== new Set(required).size || ids.some(id => !required.includes(id))) problems.push('observation ids do not match required ids');
    observations.forEach(row => {
      if (row.run_id !== runId) problems.push(row.id + ': wrong run');
      if (row.passed !== true) problems.push(row.id + ': not confirmed UP');
    });
    return { schema: SCHEMA, run_id: runId, required, checks: observations, problems,
      product: Number(!problems.length), state: problems.length ? 'DOWN' : 'UP',
      scope: 'current-run check compliance, not evidence truth or authorization' };
  }
  function describe(status) {
    if (!status || status.schema !== SCHEMA) return 'Vessell formula DOWN: status unavailable';
    return 'Vessell formula ' + (status.state === 'UP' ? 'UP' : 'DOWN') +
      ' | Phase 1 ' + (status.phase1 || 'NOT_AVAILABLE') + ' | local only, unanchored';
  }
  return { SCHEMA, evaluate, describe };
});
