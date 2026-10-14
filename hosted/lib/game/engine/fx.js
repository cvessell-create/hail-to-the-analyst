/* Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
 * Optional visual FX layer: a twgl.js WebGL2/1 post-process pass over the 2D
 * raycaster canvas plus a tsParticles weather overlay themed per mission.
 * Pure presentation: it never reads input or changes game state, and falls back
 * to the untouched 2D canvas when WebGL, the libraries or `?fx=0` say so.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailFX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Levels may declare `fx: '<theme name>'`. Snow/blizzard only on ice levels; the
  // index fallback (for levels without a declaration) never returns snow.
  const THEMES = [
    { name: 'archive-dust', tint: [1.0, 0.97, 0.88], bloom: 0.25, particle: 'dust' },
    { name: 'forge-embers', tint: [1.08, 0.94, 0.84], bloom: 0.55, particle: 'embers' },
    { name: 'frost-snow', tint: [0.88, 0.97, 1.1], bloom: 0.35, particle: 'snow' },
    { name: 'neon-city', tint: [1.0, 0.94, 1.1], bloom: 0.65, particle: 'neon' },
    { name: 'glacier-blizzard', tint: [0.84, 0.95, 1.14], bloom: 0.4, particle: 'blizzard' }
  ];
  const byName = Object.fromEntries(THEMES.map((t) => [t.name, t]));

  function themeFor(missionIndex, levels) {
    const i = Number.isInteger(missionIndex) ? missionIndex : 0;
    const declared = levels && levels[i] && levels[i].fx;
    if (declared && byName[declared]) return byName[declared];
    return i === 1 ? byName['forge-embers'] : byName['archive-dust'];
  }

  function particleOptions(kind) {
    const base = { fullScreen: { enable: false }, detectRetina: true, fpsLimit: 45, background: { opacity: 0 },
      interactivity: { events: { onClick: { enable: false }, onHover: { enable: false } } } };
    const p = {
      dust: { number: { value: 35 }, color: { value: '#c8c0a0' }, opacity: { value: { min: 0.05, max: 0.25 } },
        size: { value: { min: 0.5, max: 1.5 } }, move: { enable: true, speed: 0.3, direction: 'none', random: true } },
      embers: { number: { value: 60 }, color: { value: ['#ff7a1a', '#ffb347', '#ff3d00'] },
        opacity: { value: { min: 0.3, max: 0.9 } }, size: { value: { min: 0.8, max: 2.4 } },
        move: { enable: true, speed: 1.6, direction: 'top', random: true, outModes: { default: 'out' } } },
      snow: { number: { value: 110 }, color: { value: '#eef6ff' }, opacity: { value: { min: 0.35, max: 0.85 } },
        size: { value: { min: 0.8, max: 2.6 } },
        move: { enable: true, speed: 1.2, direction: 'bottom', random: true, outModes: { default: 'out' } } },
      neon: { number: { value: 28 }, color: { value: ['#ff55c4', '#43e8ff', '#ffd36b'] },
        opacity: { value: { min: 0.05, max: 0.7 }, animation: { enable: true, speed: 0.6 } },
        size: { value: { min: 0.6, max: 1.8 } }, move: { enable: false } },
      blizzard: { number: { value: 190 }, color: { value: '#f4fbff' }, opacity: { value: { min: 0.3, max: 0.9 } },
        size: { value: { min: 0.6, max: 2.2 } },
        move: { enable: true, speed: 3.2, direction: 'bottom-left', random: true, outModes: { default: 'out' } } }
    }[kind] || {};
    return Object.assign(base, { particles: Object.assign({ shape: { type: 'circle' } }, p) });
  }

  const VERT = 'attribute vec2 position;varying vec2 uv;void main(){uv=position*0.5+0.5;uv.y=1.0-uv.y;gl_Position=vec4(position,0.0,1.0);}';
  const FRAG = [
    'precision mediump float;varying vec2 uv;uniform sampler2D frame;uniform vec2 res;uniform vec3 tint;',
    'uniform float bloom;uniform float time;',
    'vec2 curve(vec2 p){p=p*2.0-1.0;p*=1.0+0.035*dot(p.yx,p.yx);return p*0.5+0.5;}',
    'void main(){vec2 q=curve(uv);if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}',
    'vec2 px=1.0/res;float ca=0.0012;',
    'vec3 c=vec3(texture2D(frame,q+vec2(ca,0.0)).r,texture2D(frame,q).g,texture2D(frame,q-vec2(ca,0.0)).b);',
    'vec3 glow=vec3(0.0);for(int i=-2;i<=2;i++){for(int j=-2;j<=2;j++){vec3 s=texture2D(frame,q+vec2(float(i),float(j))*px*2.0).rgb;',
    'glow+=max(s-0.6,0.0);}}c+=glow/25.0*bloom*2.5;',
    'c*=tint;float scan=0.88+0.12*sin(q.y*res.y*3.14159);c*=scan;',
    'float vig=smoothstep(0.95,0.35,length(q-0.5));c*=mix(0.7,1.0,vig);',
    'c+=(fract(sin(dot(q*time,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.025;',
    'gl_FragColor=vec4(c,1.0);}'
  ].join('');

  function enabled(win) {
    try { return new win.URLSearchParams(win.location.search).get('fx') !== '0'; } catch (e) { return true; }
  }

  function mount(win, opts) {
    const doc = win.document, src = doc.getElementById('game');
    const state = { gl: false, particles: false, theme: null };
    if (!src || !enabled(win)) return state;
    const getState = (opts && opts.state) || (() => { try { return win.HailCampaignState(); } catch (e) { return null; } });
    const layer = (tag, id, z) => {
      const el = doc.createElement(tag);
      el.id = id;
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + z;
      src.insertAdjacentElement('afterend', el);
      return el;
    };

    let gl = null, programInfo = null, bufferInfo = null, tex = null;
    if (win.twgl) {
      const out = layer('canvas', 'fxGL', 1);
      out.width = src.width; out.height = src.height;
      out.style.imageRendering = 'auto';
      out.style.visibility = 'hidden';
      gl = out.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
      if (gl) {
        try {
          programInfo = win.twgl.createProgramInfo(gl, [VERT, FRAG]);
          bufferInfo = win.twgl.createBufferInfoFromArrays(gl, { position: { numComponents: 2, data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1] } });
          tex = win.twgl.createTexture(gl, { src: src, min: gl.LINEAR, mag: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE });
          state.gl = true;
        } catch (e) { gl = null; }
      }
      if (!gl) out.remove();
    }

    let container = null, ready = null;
    const loadParticles = (theme) => {
      if (!win.tsParticles || !container) return;
      ready = ready || Promise.resolve(win.loadSlim ? win.loadSlim(win.tsParticles) : null);
      ready.then(() => win.tsParticles.load({ id: 'fxParticles', element: container, options: particleOptions(theme.particle) }))
        .then(() => { state.particles = true; }, (e) => { state.particles = false; state.error = String(e && e.message || e); });
    };
    if (win.tsParticles) {
      container = layer('div', 'fxParticles', 2);
      const css = doc.createElement('style');
      css.textContent = '#fxParticles canvas{background:transparent!important}';
      doc.head.appendChild(css);
    }
    { const s0 = getState(); state.theme = themeFor(s0 ? s0.missionIndex : 0, win.HailLevels); loadParticles(state.theme); }

    const frame = (t) => {
      const s = getState();
      const theme = themeFor(s ? s.missionIndex : 0, win.HailLevels);
      if (theme !== state.theme) { state.theme = theme; loadParticles(theme); }
      if (gl) try {
        if (src.width && (gl.canvas.width !== src.width || gl.canvas.height !== src.height)) {
          gl.canvas.width = src.width; gl.canvas.height = src.height;
        }
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.useProgram(programInfo.program);
        win.twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        win.twgl.setUniforms(programInfo, { frame: tex, res: [gl.canvas.width, gl.canvas.height],
          tint: theme.tint, bloom: theme.bloom, time: (t || 0) / 1000 % 100 });
        win.twgl.drawBufferInfo(gl, bufferInfo);
        if (gl.canvas.style.visibility === 'hidden') gl.canvas.style.visibility = 'visible';
      } catch (e) { gl.canvas.remove(); gl = null; state.gl = false; state.error = String(e && e.message || e); }
      win.requestAnimationFrame(frame);
    };
    win.requestAnimationFrame(frame);
    win.HailFXState = state;
    return state;
  }

  return { THEMES, themeFor, particleOptions, mount, VERT, FRAG };
});
