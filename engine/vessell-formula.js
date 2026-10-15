// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailVessellFormula = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'vessell-formula/v1';
  function caseState(character) {
    if (typeof character !== 'string' || character.length !== 1 || character.charCodeAt(0) > 127) {
      throw new TypeError('Expected one ASCII character.');
    }
    if (character >= 'A' && character <= 'Z') return 1;
    if (character >= 'a' && character <= 'z') return 0;
    return null;
  }
  function validateCasePolicy(text, mask) {
    if (typeof text !== 'string' || /[^\x00-\x7f]/.test(text)) {
      throw new TypeError('Case-policy text must be an ASCII string.');
    }
    if (!(mask instanceof Map)) throw new TypeError('Case-policy mask must be a Map of one-based positions to 0 or 1.');
    for (const [position, required] of mask) {
      if (!Number.isInteger(position) || position < 1 || position > text.length) {
        throw new RangeError('Masked positions must be one-based integers within the string.');
      }
      if (required !== 0 && required !== 1) throw new TypeError('Required case must be the integer 0 or 1.');
      if (caseState(text[position - 1]) === null) throw new TypeError('A case-policy mask may target only ASCII letters.');
    }
  }
  function caseGate(text, mask) {
    validateCasePolicy(text, mask);
    return Number([...mask].every(([position, required]) => caseState(text[position - 1]) === required));
  }
  function transformCase(text, mask) {
    validateCasePolicy(text, mask);
    const characters = [...text];
    for (const [position, required] of mask) {
      characters[position - 1] = required ? characters[position - 1].toUpperCase() : characters[position - 1].toLowerCase();
    }
    return characters.join('');
  }
  function correctCase(text, mask) {
    const before = caseGate(text, mask);
    const mismatches = [...mask].filter(([position, required]) => caseState(text[position - 1]) !== required).length;
    const output = before ? text : transformCase(text, mask);
    const product = caseGate(output, mask);
    if (product !== 1) throw new Error('Case-policy correction failed verification.');
    return { text: output, initial_product: before, product, state: 'PASS',
      mismatches_before: mismatches, correction_passes: 1 - before };
  }
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
  return { SCHEMA, caseState, caseGate, transformCase, correctCase, evaluate, describe };
});
