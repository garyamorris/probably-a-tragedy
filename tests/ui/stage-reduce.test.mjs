import test from 'node:test';
import assert from 'node:assert/strict';

import { initialState, reduce, reduceAll, metricsOf, normIntensity, actorsOnStage, SEATS } from '../../src/tragedy/server/static/js/stage/reduce.js';
import { showLog } from '../../src/tragedy/server/static/js/stage/fixtures.js';
import { eventDuration, lineDuration } from '../../src/tragedy/server/static/js/stage/timing.js';
import { beatOffsets, alignCursor, ghostStateAt, ghostDiff } from '../../src/tragedy/server/static/js/stage/ghost.js';

const ev = (kind, data, key) => ({ v: 1, kind, key, agent: 'x', data });

test('initial state is an empty, closed stage', () => {
  const s = initialState();
  assert.equal(s.curtain, 'closed');
  assert.equal(s.seats.length, SEATS);
  assert.deepEqual(s.order, []);
  assert.equal(metricsOf(s).speaker, null);
});

test('reduce never mutates its input', () => {
  const log = showLog();
  let s = initialState();
  for (const e of log.slice(0, 60)) {
    const before = JSON.stringify(s);
    const next = reduce(s, e);
    assert.equal(JSON.stringify(s), before, 'input mutated by ' + e.kind);
    s = next;
  }
});

test('stage.beat opens the curtain; stage.curtain closes it and records knotted', () => {
  let s = reduce(initialState(), ev('stage.beat', { index: 0, beat: 'setup', name: 'Setup', logline: 'x', tags: ['door'] }, 'a'));
  assert.equal(s.curtain, 'open');
  assert.equal(s.beat.index, 0);
  s = reduce(s, ev('stage.curtain', { warmth: 70, chaos: 95, quality_avg: 50, tradition_hits: 0, knotted: true }, 'b'));
  assert.equal(s.curtain, 'closed');
  assert.equal(s.knotted, true);
  assert.equal(s.meters.chaos, 95);
});

test('enter assigns role slots and exit marks the actor absent', () => {
  let s = initialState();
  s = reduce(s, ev('stage.enter', { actor: 'mabel', role: 'lead', from: 'left' }, '1'));
  s = reduce(s, ev('stage.enter', { actor: 'reginald', role: 'villain', from: 'right' }, '2'));
  s = reduce(s, ev('stage.enter', { actor: 'gus', role: 'fool', from: 'trapdoor' }, '3'));
  assert.equal(s.actors.mabel.slot, 0);
  assert.equal(s.actors.reginald.slot, 1);
  assert.equal(s.actors.gus.slot, 2);
  assert.equal(actorsOnStage(s).length, 3);
  s = reduce(s, ev('stage.exit', { actor: 'reginald', role: 'villain', from: 'trapdoor' }, '4'));
  assert.equal(s.actors.reginald.present, false);
  assert.equal(s.actors.reginald.exitTo, 'trapdoor');
  assert.equal(actorsOnStage(s).length, 2);
});

test('a second actor in the same role gets a free slot', () => {
  let s = reduce(initialState(), ev('stage.enter', { actor: 'a', role: 'lead' }, '1'));
  s = reduce(s, ev('stage.enter', { actor: 'b', role: 'lead' }, '2'));
  assert.notEqual(s.actors.a.slot, s.actors.b.slot);
});

test('lines set the speaker, banner and emotion; a line from an unseen actor puts them on stage', () => {
  const s = reduce(initialState(), ev('stage.line', { actor: 'gus', role: 'fool', text: 'Hello', emotion: 'fear' }, 'l'));
  assert.equal(s.speaker, 'gus');
  assert.equal(s.banner.text, 'Hello');
  assert.equal(s.actors.gus.emotion, 'fear');
  assert.equal(s.actors.gus.present, true);
  assert.equal(s.actors.gus.from, 'above');
});

test('unknown emotion falls back to neutral', () => {
  const s = reduce(initialState(), ev('stage.line', { actor: 'gus', role: 'fool', text: 'x', emotion: 'zany' }, 'l'));
  assert.equal(s.actors.gus.emotion, 'neutral');
});

test('major mishap freezes the stage (pending) until the decision arrives', () => {
  let s = initialState();
  s = reduce(s, ev('stage.enter', { actor: 'mabel', role: 'lead' }, '1'));
  s = reduce(s, ev('stage.mishap', { id: 'm1', actor: 'mabel', other: null, severity: 'major', anim: 'collapse', title: 'T', text: 'x', effects: { warmth: -2, chaos: 9 } }, '2'));
  assert.equal(s.pending, 'm1');
  assert.equal(s.actors.mabel.anim.name, 'collapse');
  assert.equal(s.meters.chaos, 19);
  assert.equal(s.meters.warmth, 38);
  s = reduce(s, ev('stage.decision', { mishap_id: 'm1', option: 'lean_in', label: 'Yes, and...', line: 'psst', effects: { warmth: 4, chaos: -1 }, by: 'prompter' }, '3'));
  assert.equal(s.pending, null);
  assert.equal(s.decision.target, 'mabel');
  assert.equal(s.mishap.resolved, true);
  assert.equal(s.meters.warmth, 42);
});

test('mishap anims knock over the nearest prop (deterministically)', () => {
  let s = initialState();
  s = reduce(s, ev('stage.set', { beat: 0, set: 'parlour', sky: 'dusk', props: ['chair', 'door', 'trunk'], palette: null }, 's'));
  s = reduce(s, ev('stage.enter', { actor: 'mabel', role: 'lead' }, 'e'));
  const a = reduce(s, ev('stage.mishap', { id: 'x', actor: 'mabel', severity: 'minor', anim: 'drop_prop', title: '', text: '' }, 'k'));
  const b = reduce(s, ev('stage.mishap', { id: 'x', actor: 'mabel', severity: 'minor', anim: 'drop_prop', title: '', text: '' }, 'k'));
  assert.deepEqual(a.propsOn, b.propsOn);
  assert.equal(a.propsOn.filter((p) => p.status === 'down').length, 1);
  const w = reduce(s, ev('stage.mishap', { id: 'x', actor: 'mabel', severity: 'minor', anim: 'wobble', title: '', text: '' }, 'k2'));
  assert.equal(w.propsOn.filter((p) => p.status === 'down').length, 0);
});

test('cue effects persist as mood until the next beat', () => {
  let s = reduce(initialState(), ev('stage.enter', { actor: 'mabel', role: 'lead' }, '1'));
  s = reduce(s, ev('stage.cue', { cue: 'fog', fits: true, outcome: 'miracle', text: 'fog' }, 'c1'));
  s = reduce(s, ev('stage.cue', { cue: 'lights', fits: false, outcome: 'misfire', text: '' }, 'c2'));
  s = reduce(s, ev('stage.cue', { cue: 'spotlight', fits: true, outcome: 'miracle', text: '' }, 'c3'));
  assert.deepEqual(s.mood, { fog: true, wash: 'sick', spot: 'mabel' });
  s = reduce(s, ev('stage.beat', { index: 1, beat: 'complication', name: 'C', logline: '', tags: [] }, 'b'));
  assert.deepEqual(s.mood, { fog: false, wash: null, spot: null });
});

test('audience seats and reactions', () => {
  let s = reduce(initialState(), ev('audience.seat', { seat: 3, taste: 'mayor', hat: 'crown', palette: { coat: '#123456', skin: '#e8c9a0' } }, 'a'));
  assert.equal(s.seats[3].hat, 'crown');
  s = reduce(s, ev('audience.react', { seat: 3, reaction: 'boo', intensity: 0.8, why: 'x' }, 'b'));
  assert.equal(s.seats[3].react.reaction, 'boo');
  assert.equal(s.seats[3].hat, 'crown');
  s = reduce(s, ev('audience.react', { seat: 99, reaction: 'laugh', intensity: 1 }, 'c')); // out of range: ignored
  assert.equal(s.seats.length, SEATS);
  s = reduce(s, ev('audience.tally', { beat: 0, delta: 4, counts: { laugh: 3 } }, 't'));
  assert.equal(s.tally.delta, 4);
});

test('intensity normalisation accepts 0..1, 1..3 and 0..100', () => {
  assert.equal(normIntensity(0.5), 0.5);
  assert.ok(Math.abs(normIntensity(2) - 2 / 3) < 1e-9);
  assert.equal(normIntensity(80), 0.8);
  assert.equal(normIntensity(0), 0.2);
  assert.equal(normIntensity('x'), 0.6);
});

test('meter clamps and sets beat', () => {
  const s = reduce(initialState(), ev('meter', { warmth: 140, chaos: -9, beat: 3 }, 'm'));
  assert.deepEqual(s.meters, { warmth: 100, chaos: 0, beat: 3 });
});

test('dedupe by key: replaying an event is a no-op (same object)', () => {
  const e = ev('stage.line', { actor: 'gus', role: 'fool', text: 'a', emotion: 'joy' }, 'same');
  const s1 = reduce(initialState(), e);
  const s2 = reduce(s1, e);
  assert.equal(s2, s1);
  const s3 = reduce(s1, { ...e, data: { ...e.data, text: 'b' } });
  assert.equal(s3, s1, 'same key, different payload is still a duplicate');
  const s4 = reduce(s1, ev('stage.line', { actor: 'gus', role: 'fool', text: 'b' }, 'other'));
  assert.notEqual(s4, s1);
});

test('events without a key are never deduped', () => {
  const e = ev('meter', { warmth: 10, chaos: 10, beat: 0 });
  let s = reduce(initialState(), e);
  const n = s.n;
  s = reduce(s, e);
  assert.equal(s.n, n + 1);
});

test('non-stage kinds are ignored (same state object)', () => {
  const s = initialState();
  assert.equal(reduce(s, ev('cast.audition', { role: 'lead' }, 'x')), s);
  assert.equal(reduce(s, ev('review.pigeon', {}, 'y')), s);
  assert.equal(reduce(s, null), s);
});

test('fixture log: reduceAll == step-by-step, and seek equivalence for every prefix', () => {
  const log = showLog();
  assert.ok(log.length > 120, 'fixture should be a full show (' + log.length + ')');
  let s = initialState();
  const snaps = [];
  for (let i = 0; i < log.length; i++) { s = reduce(s, log[i]); snaps.push(JSON.stringify(s)); }
  for (let k = 0; k <= log.length; k += 7) {
    const rebuilt = reduceAll(log.slice(0, k));
    const want = k === 0 ? JSON.stringify(initialState()) : snaps[k - 1];
    assert.equal(JSON.stringify(rebuilt), want, 'prefix ' + k);
  }
});

test('fixture log is deduped even if the whole log is applied twice', () => {
  const log = showLog();
  const once = reduceAll(log);
  const twice = reduceAll(log, once);
  assert.equal(twice, once);
});

test('fixture log keys are unique and every kind is a known protocol kind', () => {
  const log = showLog();
  const keys = new Set(log.map((e) => e.key));
  assert.equal(keys.size, log.length);
  const kinds = new Set(log.map((e) => e.kind));
  for (const k of ['stage.beat', 'stage.set', 'stage.enter', 'stage.direct', 'stage.line', 'stage.mishap', 'stage.decision', 'stage.cue', 'stage.chain', 'stage.curtain', 'audience.seat', 'audience.react', 'audience.tally', 'meter']) assert.ok(kinds.has(k), 'fixture lacks ' + k);
});

test('fixture ends: warm curtain vs knotted curtain', () => {
  const warm = reduceAll(showLog({ ending: 'warm' }));
  const knot = reduceAll(showLog({ ending: 'knot' }));
  assert.equal(warm.curtain, 'closed');
  assert.equal(warm.knotted, false);
  assert.equal(knot.knotted, true);
  assert.ok(knot.meters.chaos >= 90);
  assert.ok(knot.knotVictim);
  assert.ok(warm.meters.warmth > knot.meters.warmth);
});

test('timing: durations are positive for stage events and scale with line length', () => {
  const log = showLog();
  for (const e of log) assert.ok(eventDuration(e) > 0, e.kind);
  assert.ok(lineDuration('x'.repeat(140)) > lineDuration('hi'));
  assert.equal(eventDuration({ kind: 'review.pigeon' }), 0);
});

test('ghost: beat offsets, alignment and diff', () => {
  const live = showLog({ ending: 'warm' });
  const ghost = showLog({ ending: 'knot' });
  const offs = beatOffsets(ghost);
  assert.equal(offs.length, ghost.length);
  // before beat 2's mishap the two timelines are identical
  const idx = live.findIndex((e) => e.kind === 'stage.beat' && e.data.index === 2);
  const liveAtBeat2 = reduceAll(live.slice(0, idx + 3));
  const g = ghostStateAt(ghost, liveAtBeat2, offs);
  assert.equal(g.beat.index, 2);
  assert.equal(alignCursor(ghost, liveAtBeat2, offs), idx + 3);
  const d0 = ghostDiff(liveAtBeat2, g);
  assert.deepEqual(d0.actors, []);
  assert.equal(d0.diverged, false);
  // at the end they diverge hard
  const liveEnd = reduceAll(live);
  const gEnd = ghostStateAt(ghost, liveEnd, offs);
  const d1 = ghostDiff(liveEnd, gEnd);
  assert.equal(d1.diverged, true);
  assert.ok(d1.warmth < 0 && d1.chaos > 0);
  assert.ok(d1.actors.includes('reginald'), 'reginald exits only in the warm ending');
});

test('ghost alignment is clamped when the ghost log is shorter', () => {
  const ghost = showLog({ ending: 'knot' }).slice(0, 30);
  const liveEnd = reduceAll(showLog());
  assert.equal(alignCursor(ghost, liveEnd), 30);
});
