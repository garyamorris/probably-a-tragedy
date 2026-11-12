// A whisper effect must be drawable the instant it is pushed (before the first update fills in x/y), and the draw
// helpers must tolerate non-finite numbers: a NaN once threw out of stage.apply() and froze the whole show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../src/tragedy/server/static/js/stage/', import.meta.url);
const scene = readFileSync(new URL('scene.js', root), 'utf8');
const shapes = readFileSync(new URL('draw/shapes.js', root), 'utf8');
const stage = readFileSync(new URL('stage.js', root), 'utf8');

test('the whisper effect is seeded with x/y when it is pushed', () => {
  const push = scene.match(/this\.effects\.push\(\{ type: 'whisper'[^}]*\}\)/)[0];
  assert.match(push, /x: from\[0\], y: from\[1\]/);
});

test('glow ignores non-finite input instead of throwing', async () => {
  const calls = [];
  const ctx = { createRadialGradient: () => { throw new Error('should not be reached'); }, fillRect: (...a) => calls.push(a) };
  const { glow } = await import(new URL('draw/shapes.js', root));
  for (const bad of [[NaN, 0, 5], [0, undefined, 5], [0, 0, Infinity], [0, 0, NaN], [0, 0, 0]]) {
    assert.doesNotThrow(() => glow(ctx, ...bad, '#fff', 1), `glow(${bad})`);
  }
  assert.equal(calls.length, 0);
  assert.match(shapes, /Number\.isFinite\(x\)/);
});

test('both draw paths are guarded so a rendering bug cannot stall event pacing', () => {
  assert.equal((stage.match(/draw failed \(continuing\)/g) || []).length, 2, 'loop() and renderNow() each catch draw errors');
});
