// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EngineControls = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const codes = Object.freeze({ KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward',
    ArrowDown: 'backward', KeyA: 'left', KeyD: 'right', ArrowLeft: 'turnLeft', ArrowRight: 'turnRight', Space: 'fire' });
  function bind(target, buttons) {
    const held = new Set(), touches = new Map(), listeners = [];
    function listen(node, event, handler) {
      node.addEventListener(event, handler); listeners.push(() => node.removeEventListener(event, handler));
    }
    function clear() { held.clear(); touches.clear(); }
    listen(target, 'keydown', event => {
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target?.tagName || '') || event.target?.isContentEditable) return;
      if (codes[event.code]) { held.add(event.code); event.preventDefault(); }
    });
    listen(target, 'keyup', event => held.delete(event.code));
    listen(target, 'blur', clear);
    for (const button of buttons) {
      const action = button.dataset.action;
      if (!Object.values(codes).includes(action)) throw Error('Unknown control action.');
      listen(button, 'pointerdown', event => {
        event.preventDefault(); button.setPointerCapture(event.pointerId);
        touches.set(event.pointerId, action);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        listen(button, event, e => touches.delete(e.pointerId));
      }
      listen(button, 'keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); held.add(`button:${action}`); }
      });
      listen(button, 'keyup', e => {
        if (e.code === 'Space' || e.code === 'Enter') held.delete(`button:${action}`);
      });
      listen(button, 'blur', () => held.delete(`button:${action}`));
    }
    const active = action => Array.from(held).some(code => codes[code] === action || code === `button:${action}`) ||
      Array.from(touches.values()).includes(action);
    return { sample: () => ({ forward: Number(active('forward')) - Number(active('backward')),
      strafe: Number(active('right')) - Number(active('left')),
      turn: Number(active('turnRight')) - Number(active('turnLeft')), fire: active('fire') }),
    clear, dispose() { clear(); listeners.forEach(remove => remove()); } };
  }
  return { bind };
});
