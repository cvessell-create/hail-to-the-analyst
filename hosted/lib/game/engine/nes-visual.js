// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('../vendor/jsnes/jsnes.cjs') : root.jsnes,
    typeof module === 'object' && module.exports ? require('./core') : root.VessellEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HailNESVisual = api;
})(globalThis, function (JSNES, Engine) {
  'use strict';
  function rom() {
    const bytes = [], labels = {}, fixes = [];
    const emit = (...values) => bytes.push(...values);
    const label = name => { labels[name] = bytes.length; };
    const branch = (opcode, name) => { emit(opcode, 0); fixes.push({ at: bytes.length - 1, name, relative: true }); };
    const jump = name => { emit(0x4c, 0, 0); fixes.push({ at: bytes.length - 2, name }); };
    emit(0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xa9, 0, 0x8d, 0, 0x20, 0x8d, 1, 0x20);
    label('vblank'); emit(0x2c, 2, 0x20); branch(0x10, 'vblank');
    emit(0xa9, 0x3f, 0x8d, 6, 0x20, 0xa9, 0, 0x8d, 6, 0x20, 0xa2, 0);
    label('palette'); emit(0xbd, 0, 0x81, 0x8d, 7, 0x20, 0xe8, 0xe0, 32); branch(0xd0, 'palette');
    label('poll'); emit(0xa5, 0); branch(0xf0, 'poll');
    emit(0xa9, 0, 0x8d, 1, 0x20, 0x2c, 2, 0x20, 0xa9, 0x20, 0x8d, 6, 0x20,
      0xa9, 0, 0x8d, 6, 0x20);
    for (let page = 3; page <= 6; page++) {
      emit(0xa2, 0); label(`copy${page}`);
      emit(0xbd, 0, page, 0x8d, 7, 0x20, 0xe8); branch(0xd0, `copy${page}`);
    }
    emit(0xa9, 0, 0x8d, 5, 0x20, 0x8d, 5, 0x20, 0x85, 0,
      0xa9, 0x0a, 0x8d, 1, 0x20); jump('poll');
    for (const fix of fixes) {
      if (fix.relative) {
        const offset = labels[fix.name] - fix.at - 1;
        if (offset < -128 || offset > 127) throw Error('Original visual ROM branch overflow.');
        bytes[fix.at] = offset & 255;
      } else {
        const address = 0x8000 + labels[fix.name];
        bytes[fix.at] = address & 255; bytes[fix.at + 1] = address >> 8;
      }
    }
    const data = new Uint8Array(16 + 16384 + 8192);
    data.set([0x4e, 0x45, 0x53, 0x1a, 1, 1, 0, 0]); data.set(bytes, 16);
    const palette = [0x0f, 0x11, 0x21, 0x30];
    for (let i = 0; i < 32; i++) data[16 + 0x100 + i] = palette[i % 4];
    for (let vector = 0; vector < 3; vector++) {
      data[16 + 0x3ffa + vector * 2] = 0;
      data[16 + 0x3ffb + vector * 2] = 0x80;
    }
    const chr = 16 + 16384;
    for (let tile = 1; tile <= 5; tile++) {
      for (let row = 0; row < 8; row++) {
        const shade = tile === 1 ? 1 : tile === 2 ? 2 : tile === 3 ? 3 : 0;
        data[chr + tile * 16 + row] = shade & 1 ? 255 : 0;
        data[chr + tile * 16 + row + 8] = shade & 2 ? 255 : 0;
        if (tile === 4) data[chr + tile * 16 + row] = row % 2 ? 0x55 : 0xaa;
        if (tile === 5) data[chr + tile * 16 + row + 8] = row === 3 ? 255 : 0x18;
      }
    }
    return data;
  }
  function tiles(grid, position, isSolid) {
    if (!position || ![position.x, position.y, position.angle].every(Number.isFinite)) {
      throw Error('NES view requires finite game position.');
    }
    const result = new Uint8Array(1024);
    for (let x = 0; x < 32; x++) {
      const angle = position.angle + (x / 31 - 0.5) * Math.PI / 3;
      const ray = Engine.castRay(grid, position.x, position.y, angle, 32, isSolid);
      const height = ray.tile === null ? 0 : Math.min(26, Math.round(24 / Math.max(0.2,
        ray.distance * Math.cos(angle - position.angle))));
      for (let y = 0; y < 30; y++) {
        result[y * 32 + x] = Math.abs(y - 14) <= height / 2 ? (ray.side ? 2 : 3) : y < 14 ? 1 : 4;
      }
    }
    result[14 * 32 + 16] = 5;
    return result;
  }
  function create() {
    if (!JSNES?.NES) throw Error('JSNES is required for the emulated visual mode.');
    let frames = 0, buffer = new Uint32Array(256 * 240);
    const nes = new JSNES.NES({ emulateSound: false, onFrame(pixels) {
      buffer = Uint32Array.from(pixels); frames++;
    } });
    nes.loadROM(rom());
    return {
      update(grid, position, isSolid) {
        const screen = tiles(grid, position, isSolid);
        for (let i = 0; i < screen.length; i++) nes.cpu.mem[0x300 + i] = screen[i];
        nes.cpu.mem[0] = 1;
        // Finish the upload frame, then capture a frame with rendering enabled.
        nes.frame(); nes.frame();
        return { frames, pixels: buffer.slice(), uploaded: nes.cpu.mem[0] === 0 };
      },
      draw(context, grid, position, isSolid) {
        const output = this.update(grid, position, isSolid), image = context.createImageData(256, 240);
        for (let i = 0; i < output.pixels.length; i++) {
          const color = output.pixels[i], at = i * 4;
          image.data[at] = color & 255; image.data[at + 1] = (color >> 8) & 255;
          image.data[at + 2] = (color >> 16) & 255; image.data[at + 3] = 255;
        }
        context.putImageData(image, 0, 0);
      },
      provenance: { runtime: 'JSNES 2.1.0', rom: 'Original Hail NROM CPU/PPU display program',
        scope: 'Emulated tile-based first-person companion view; not gameplay authority or commercial assets' }
    };
  }
  return { rom, tiles, create };
});
