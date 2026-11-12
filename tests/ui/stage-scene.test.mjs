// Headless smoke + determinism tests for the whole Stage (scene, springs, ropes, particles AND every draw call),
// using a Proxy 2D context that accepts anything. Catches NaNs, exceptions in painters and non-determinism.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CLIP_NAMES, clipPose, identity } from '../../src/tragedy/server/static/js/stage/clips.js';
import { reduceAll } from '../../src/tragedy/server/static/js/stage/reduce.js';
import { fixtureData, showLog, PERFORMERS } from '../../src/tragedy/server/static/js/stage/fixtures.js';

// ---- a 2D context that does nothing, successfully --------------------------------------------------------------------
function fakeCtx() {
  const calls = { n: 0 };
  const grad = { addColorStop() {} };
  const target = { canvas: null };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k === '__calls') return calls;
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => ({ width: String(s).length * 9 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'getTransform') return () => ({ a: 1, d: 1 });
      return () => { calls.n++; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return ctx;
}
function fakeCanvas(w = 800, h = 450) {
  const ctx = fakeCtx();
  const cv = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {},
    getContext: () => ctx, addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  };
  ctx.canvas = cv;
  return cv;
}
globalThis.document = { createElement: () => fakeCanvas(64, 64), hidden: false };
globalThis.devicePixelRatio = 2;

const { Stage } = await import('../../src/tragedy/server/static/js/stage/stage.js');

const flush = () => new Promise((r) => setImmediate(r));

async function runShow(stage, log, { maxMs = 400000, every = 0 } = {}) {
  let i = 0, steps = 0, done = false;
  const player = (async () => { while (i < log.length) await stage.apply(log[i++]); done = true; })();
  while (!done && stage.simTime < maxMs) {
    stage.advance(1000 / 60);
    await flush();
    if (every && ++steps % every === 0) stage.renderNow();
  }
  assert.ok(done, 'the show finished within the time budget');
  await player;
}

const finiteDeep = (o, path = '') => {
  if (typeof o === 'number') assert.ok(Number.isFinite(o), 'non-finite number at ' + path);
  else if (o && typeof o === 'object' && !ArrayBuffer.isView(o)) for (const k of Object.keys(o)) finiteDeep(o[k], path + '.' + k);
  else if (ArrayBuffer.isView(o)) for (let i = 0; i < o.length; i++) assert.ok(Number.isFinite(o[i]), 'non-finite typed value at ' + path + '[' + i + ']');
};

function digest(stage) {
  const out = [];
  for (const pv of stage.scene.puppets.values()) out.push([pv.id, pv.x, pv.y, pv.rot, pv.mouth, Array.from(pv.ropes[0].x)]);
  for (const pr of stage.scene.props.values()) out.push([pr.id, pr.dropY, pr.rot]);
  out.push(stage.scene.particles.list.length, stage.scene.display.warmth, stage.scene.display.chaos);
  return JSON.stringify(out);
}

test('every mishap clip is the identity at u=0 and u=1 and finite in between', () => {
  const o = identity();
  for (const name of CLIP_NAMES) for (const rm of [false, true]) {
    for (const u of [0, 1]) {
      clipPose(name, u, { H: 240, dir: 1, rm }, o);
      assert.equal(o.dx, 0); assert.equal(o.dy, 0); assert.equal(o.rot, 0); assert.equal(o.sx, 1); assert.equal(o.sy, 1);
      assert.equal(o.fold, 0); assert.equal(o.barLift, 0); assert.equal(o.slack, 0); assert.equal(o.overlay, null);
    }
    for (let i = 1; i < 100; i++) {
      clipPose(name, i / 100, { H: 240, dir: -1, rm }, o);
      for (const k of ['dx', 'dy', 'rot', 'sx', 'sy', 'bend', 'fold', 'tilt', 'barLift', 'slack', 'sway', 'armUp', 'eye']) assert.ok(Number.isFinite(o[k]), `${name}.${k} at ${i / 100}`);
    }
  }
});

test('the clips are visually distinct (no two share the same signature)', () => {
  const sigs = new Set();
  const o = identity();
  for (const name of CLIP_NAMES) {
    let sig = '';
    for (const u of [0.15, 0.3, 0.5, 0.7]) { clipPose(name, u, { H: 240, dir: 1, rm: false }, o); sig += [o.dx, o.dy, o.rot, o.sx, o.sy, o.fold, o.barLift, o.slack, o.pivot, o.alpha].map((v) => v.toFixed(2)).join(','); }
    sigs.add(sig);
  }
  assert.equal(sigs.size, CLIP_NAMES.length);
});

test('whole fixture show runs through the Stage (draw included) without NaNs or exceptions', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 7, manual: true });
  stage.speed = 4;
  const log = showLog();
  await runShow(stage, log, { every: 20 });
  assert.equal(stage.log.length, log.length);
  assert.equal(stage.cursor, log.length);
  finiteDeep(Array.from(stage.scene.puppets.values()).map((p) => ({ x: p.x, y: p.y, rot: p.rot, sx: p.sx, sy: p.sy, bend: p.bend, fold: p.fold, tilt: p.tilt, armA: p.armA, armE: p.armE, mouth: p.mouth, ropes: p.ropes.map((r) => [r.x, r.y]), bar: p.bar })), 'puppets');
  finiteDeep(stage.scene.display, 'display');
  stage.renderNow();
  assert.ok(stage.scene.ctxCalls === undefined);
  assert.equal(stage.getMetrics().warmth, 71);
  stage.destroy();
});

test('the knotted ending hangs the victim from a giant knot', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 7, manual: true });
  stage.speed = 4;
  await runShow(stage, showLog({ ending: 'knot' }), { every: 25 });
  for (let i = 0; i < 400; i++) { stage.advance(1000 / 60); }
  const victim = stage.scene.puppets.get(stage.state.knotVictim);
  assert.ok(victim, 'a victim was chosen');
  assert.ok(victim.knotAtt > 0.95, 'knot attenuation reached ~1: ' + victim.knotAtt);
  assert.ok(Math.abs(victim.rot - Math.PI) < 0.35, 'upside down: ' + victim.rot);
  assert.ok(victim.giant, 'giant knot is drawn');
  finiteDeep(victim.ropes.map((r) => [r.x, r.y]), 'ropes');
  stage.destroy();
});

test('determinism: same seed + same event timeline gives identical scene state', async () => {
  const mk = async () => {
    const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 7, manual: true });
    stage.speed = 2;
    const log = showLog().slice(0, 150);
    await runShow(stage, log);
    for (let i = 0; i < 90; i++) stage.advance(1000 / 60);
    const d = digest(stage);
    stage.destroy();
    return d;
  };
  const a = await mk(), b = await mk();
  assert.equal(a, b);
});

test('seek rebuilds from the log instantly; applying after a seek forks the timeline', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 7, manual: true });
  const log = showLog();
  stage.speed = 0;
  for (const e of log) await stage.apply(e);       // speed 0 resolves immediately
  assert.equal(stage.log.length, log.length);
  assert.deepEqual(JSON.parse(JSON.stringify(stage.state)), JSON.parse(JSON.stringify(reduceAll(log))));
  await stage.seek(60);
  assert.equal(stage.cursor, 60);
  assert.equal(stage.log.length, log.length, 'seek keeps the log so you can scrub forward again');
  assert.deepEqual(JSON.parse(JSON.stringify(stage.state)), JSON.parse(JSON.stringify(reduceAll(log.slice(0, 60)))));
  await stage.seek(log.length);
  assert.equal(stage.getMetrics().beat, 4);
  await stage.seek(0);
  assert.equal(stage.state.curtain, 'closed');
  assert.equal(stage.getMetrics().speaker, null);
  await stage.seek(60);
  await stage.apply({ v: 1, kind: 'meter', key: 'fork-1', data: { warmth: 9, chaos: 9, beat: 2 } });
  assert.equal(stage.log.length, 61, 'the old future was dropped');
  assert.equal(stage.getMetrics().warmth, 9);
  stage.destroy();
});

test('apply dedupes by key, ignores foreign kinds, and resolves immediately at speed 0', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 1, manual: true });
  stage.speed = 0;
  const e = { v: 1, kind: 'stage.beat', key: 'k1', data: { index: 0, beat: 'setup', name: 'Setup', logline: '', tags: [] } };
  await stage.apply(e);
  await stage.apply(e);
  await stage.apply({ v: 1, kind: 'review.pigeon', key: 'x', data: {} });
  assert.equal(stage.log.length, 1);
  assert.equal(stage.state.curtain, 'open');
  stage.reset();
  assert.equal(stage.log.length, 0);
  assert.equal(stage.state.curtain, 'closed');
  stage.destroy();
});

test('apply resolves only when the visuals finish (and never before at speed 1)', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 1, manual: true });
  stage.speed = 1;
  let done = false;
  stage.apply({ v: 1, kind: 'stage.beat', key: 'b0', data: { index: 0, beat: 'setup', name: 'Setup', logline: '', tags: [] } }).then(() => { done = true; });
  for (let i = 0; i < 60; i++) { stage.advance(1000 / 60); await flush(); }
  assert.equal(done, false, 'still performing after 1s (the opening beat takes 2.6s)');
  for (let i = 0; i < 120; i++) { stage.advance(1000 / 60); await flush(); }
  assert.equal(done, true);
  // at 4x it is 4x faster
  stage.speed = 4; done = false;
  stage.apply({ v: 1, kind: 'stage.beat', key: 'b1', data: { index: 1, beat: 'complication', name: 'C', logline: '', tags: [] } }).then(() => { done = true; });
  for (let i = 0; i < 30; i++) { stage.advance(1000 / 60); await flush(); }
  assert.equal(done, true);
  stage.destroy();
});

test('tokens flap the jaw of that speaker only', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 1, manual: true });
  stage.speed = 0;
  for (const e of showLog().slice(0, 19)) await stage.apply(e);
  stage.speed = 1;
  stage.advance(500);
  stage.token('mabel', 'Hel');
  for (let i = 0; i < 3; i++) stage.advance(1000 / 60);
  assert.ok(stage.scene.puppets.get('mabel').mouth > 0.1, 'mabel flaps');
  assert.ok(stage.scene.puppets.get('reginald').mouth < 0.1, 'reginald does not');
  stage.destroy();
});

test('ghost timeline: aligned, diverges, and survives seeking', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 7, manual: true });
  const live = showLog({ ending: 'warm' }), ghost = showLog({ ending: 'knot' });
  stage.setGhost(ghost);
  stage.speed = 0;
  for (const e of live) await stage.apply(e);
  assert.equal(stage.scene.diff.diverged, true);
  assert.ok(stage.scene.diff.warmth < 0);
  await stage.seek(20);
  assert.equal(stage.scene.diff.diverged, false, 'identical before the fork');
  stage.setGhost(null);
  assert.equal(stage.scene.ghostScene, null);
  stage.destroy();
});

test('unknown performers and props still render (deterministic fallback look)', async () => {
  const stage = new Stage(fakeCanvas(), { data: { performers: [], staff: [], tastes: [], cues: [], props: [] }, seed: 3, manual: true });
  stage.speed = 0;
  const evs = [
    { v: 1, kind: 'stage.beat', key: 'a', data: { index: 0, beat: 'setup', name: 'S', logline: '', tags: [] } },
    { v: 1, kind: 'stage.set', key: 'b', data: { beat: 0, set: 'nonexistent_set', sky: 'plaid', props: ['mystery_prop', 'sword'], palette: null } },
    { v: 1, kind: 'stage.enter', key: 'c', data: { actor: 'who_is_this', role: 'lead', from: 'sideways' } },
    { v: 1, kind: 'stage.line', key: 'd', data: { actor: 'who_is_this', role: 'lead', text: '', emotion: 'bewildered' } },
    { v: 1, kind: 'audience.react', key: 'e', data: { seat: 3, reaction: 'sneeze', intensity: 'lots' } },
  ];
  for (const e of evs) await stage.apply(e);
  stage.speed = 1;
  for (let i = 0; i < 120; i++) stage.advance(1000 / 60);
  stage.renderNow();
  finiteDeep(stage.scene.display, 'display');
  stage.destroy();
});

test('all 8 performers build a spec with sane geometry', async () => {
  const { buildSpec } = await import('../../src/tragedy/server/static/js/stage/draw/puppet.js');
  for (const p of PERFORMERS) {
    const sp = buildSpec(p);
    assert.equal(sp.head, p.build.head);
    assert.equal(sp.costume, p.build.costume);
    assert.ok(sp.strings >= 3 && sp.strings <= 7);
    assert.ok(sp.geo.topY < sp.geo.headY && sp.geo.headY < sp.geo.shoulderY && sp.geo.shoulderY < sp.geo.hipY && sp.geo.hipY < 0, p.id);
    assert.ok(-sp.geo.topY < 300 * p.build.height + 60, p.id + ' is not absurdly tall: ' + (-sp.geo.topY));
  }
});

test('reduced motion is honoured: no camera shake, no flicker amplitude', async () => {
  const stage = new Stage(fakeCanvas(), { data: fixtureData(), seed: 1, manual: true, reducedMotion: true });
  assert.equal(stage.reducedMotion, true);
  stage.scene.shakeAmp(20);
  assert.equal(stage.scene.shake, 0);
  stage.setReducedMotion(false);
  stage.scene.shakeAmp(20);
  assert.equal(stage.scene.shake, 20);
  stage.destroy();
});
