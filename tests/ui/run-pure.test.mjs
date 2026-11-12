import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSSE } from '../../src/tragedy/server/static/js/core/sse.js';
import {
  routeFrame,
  extractInterrupts,
  normalizeInterrupt,
  normalizeEnvelope,
  createDeduper,
  deriveActor,
  chunkText,
  FrameRouter,
  buildResumeBody,
  taskFromRoute,
  checkpointFromRoute,
  readableError,
} from '../../src/tragedy/server/static/js/run-pure.js';

const frame = (event, data) => ({ event, data: JSON.stringify(data) });
const env = (kind, key, data = {}, agent = null) => ({ v: 1, kind, key, agent, data });

test('routeFrame splits the mode from the namespace and decodes JSON', () => {
  const r = routeFrame(frame('custom|perform:3f2a|inner:99', env('stage.line', 'k1')));
  assert.equal(r.mode, 'custom');
  assert.deepEqual(r.ns.map((n) => n.node), ['perform', 'inner']);
  assert.equal(r.data.kind, 'stage.line');
  assert.equal(routeFrame(frame('messages/partial', [])).mode, 'messages');
  assert.equal(routeFrame({ event: 'end', data: '' }).data, null);
});

test('real SSE framing (\\r\\n\\r\\n) round-trips through the router', () => {
  const wire = encodeSSE({ event: 'custom', data: env('meter', 'm1', { warmth: 40, chaos: 10, beat: 0 }), id: '1-1' });
  assert.ok(wire.endsWith('\r\n\r\n'));
  const r = new FrameRouter();
  const items = r.feed({ event: 'custom', data: wire.split('data: ')[1].split('\r\n')[0], id: '1-1' });
  assert.equal(items.length, 1);
  assert.equal(items[0].ev.kind, 'meter');
});

test('custom events are de-duplicated by envelope key, across routers sharing a deduper', () => {
  const dedupe = createDeduper();
  const a = new FrameRouter({ dedupe });
  const first = a.feed(frame('custom', env('stage.line', 'line:n0:b0:1', { text: 'hi' })));
  const again = a.feed(frame('custom', env('stage.line', 'line:n0:b0:1', { text: 'hi' })));
  assert.equal(first.length, 1);
  assert.equal(again.length, 0);
  assert.equal(a.counts.dropped, 1);
  // a resumed run (new request) re-emits the same keys: still dropped
  const b = new FrameRouter({ dedupe });
  assert.equal(b.feed(frame('custom', env('stage.line', 'line:n0:b0:1'))).length, 0);
  assert.equal(b.feed(frame('custom', env('stage.line', 'line:n0:b0:2'))).length, 1);
  // keyless events always pass
  assert.equal(b.feed(frame('custom', { kind: 'note', data: { text: 'x' } })).length, 1);
  assert.equal(b.feed(frame('custom', { kind: 'note', data: { text: 'x' } })).length, 1);
});

test('normalizeEnvelope wraps junk and keeps real envelopes', () => {
  assert.equal(normalizeEnvelope(null), null);
  assert.equal(normalizeEnvelope('str'), null);
  const w = normalizeEnvelope({ hello: 1 });
  assert.equal(w.kind, 'raw');
  assert.match(w.key, /^raw:/);
  assert.deepEqual(normalizeEnvelope(env('progress', 'p', { pct: 0.5 })), env('progress', 'p', { pct: 0.5 }));
});

test('interrupts are found in values, updates and task results, ids preserved', () => {
  const payload = { kind: 'prompters_box', beat: 3 };
  const v = routeFrame(frame('values', { beat: 3, __interrupt__: [{ id: 'abc', value: payload }] }));
  assert.deepEqual(extractInterrupts(v), [{ id: 'abc', value: payload }]);
  const u = routeFrame(frame('updates', { __interrupt__: [{ id: 'abc', value: payload }] }));
  assert.deepEqual(extractInterrupts(u), [{ id: 'abc', value: payload }]);
  const t = routeFrame(frame('tasks', { id: 't1', name: 'prompters_box', error: null, result: null, interrupts: [{ id: 'abc', value: payload }] }));
  assert.deepEqual(extractInterrupts(t), [{ id: 'abc', value: payload }]);
  assert.deepEqual(extractInterrupts(routeFrame(frame('values', { a: 1 }))), []);
  assert.deepEqual(normalizeInterrupt({ value: 5, interrupt_id: 'z' }), { id: 'z', value: 5 });
  assert.deepEqual(normalizeInterrupt('bare'), { id: null, value: 'bare' });
});

test('router de-duplicates the same interrupt seen in values, updates and tasks', () => {
  const r = new FrameRouter();
  const it = { id: 'i1', value: { kind: 'confirm_cast' } };
  r.feed(frame('updates', { __interrupt__: [it] }));
  r.feed(frame('tasks|casting:1', { id: 't', name: 'confirm_cast', error: null, result: null, interrupts: [it] }));
  r.feed(frame('values', { cast: null, __interrupt__: [it] }));
  const got = r.takeInterrupts();
  assert.equal(got.length, 1);
  assert.equal(got[0].id, 'i1');
  assert.deepEqual(r.takeInterrupts(), []);
  assert.deepEqual(r.values, { cast: null }, '__interrupt__ is stripped from values');
});

test('only top-level values are kept', () => {
  const r = new FrameRouter();
  r.feed(frame('values', { a: 1 }));
  r.feed(frame('values|perform:abc', { inner: true }));
  assert.deepEqual(r.values, { a: 1 });
  r.feed(frame('values', { a: 2 }));
  assert.deepEqual(r.values, { a: 2 });
});

test('resume body is always an id map', () => {
  const list = [{ id: 'i1', value: {} }];
  assert.deepEqual(buildResumeBody(list, [{ option: 'lean_in', cue: null, text: null }]), { command: { resume: { i1: { option: 'lean_in', cue: null, text: null } } } });
  const two = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
  assert.deepEqual(buildResumeBody(two, ['x', 'y']).command.resume, { a: 'x', b: 'y' });
  // no ids (ancient server): bare value for a single interrupt only
  assert.deepEqual(buildResumeBody([{ id: null, value: 1 }], ['ok']), { command: { resume: 'ok' } });
  assert.throws(() => buildResumeBody([{ id: null }, { id: null }], [1, 2]));
  assert.throws(() => buildResumeBody([], []));
});

test('frame routing: messages become tokens with actor, tool/human messages are ignored', () => {
  const r = new FrameRouter({ now: (() => { let t = 1000; return () => (t += 12); })() });
  const known = new Set(['mabel', 'madame']);
  const rk = new FrameRouter({ known });
  const [t1] = rk.feed(frame('messages|perform:xyz', [{ type: 'AIMessageChunk', id: 'm1', content: 'Darling, ' }, { langgraph_node: 'speak', actor: 'madame' }]));
  assert.equal(t1.type, 'token');
  assert.equal(t1.text, 'Darling, ');
  assert.equal(t1.actor, 'madame');
  assert.equal(t1.node, 'speak');
  assert.deepEqual(rk.feed(frame('messages', [{ type: 'tool', content: 'result' }, {}])), []);
  assert.deepEqual(rk.feed(frame('messages', [{ type: 'human', content: 'hi' }, {}])), []);
  assert.deepEqual(rk.feed(frame('messages', [{ type: 'AIMessageChunk', content: '' }, {}])), []);
  const [a, b] = [r.feed(frame('messages', [{ type: 'AIMessageChunk', content: 'a' }, { langgraph_node: 'recommend' }]))[0], r.feed(frame('messages', [{ type: 'AIMessageChunk', content: 'b' }, { langgraph_node: 'recommend' }]))[0]];
  assert.equal(a.gap, 0);
  assert.equal(b.gap, 12);
});

test('deriveActor checks metadata, tags, node name, then namespace', () => {
  assert.equal(deriveActor({ actor: 'mabel' }, []), 'mabel');
  assert.equal(deriveActor({ tags: ['seq:step:1', 'actor:goose'] }, []), 'goose');
  assert.equal(deriveActor({ langgraph_node: 'speak_reginald' }, []), 'reginald');
  assert.equal(deriveActor({ langgraph_node: 'actor_tock' }, []), 'tock');
  assert.equal(deriveActor({ langgraph_node: 'model' }, [{ node: 'mabel', taskId: '1' }]), 'mabel');
  assert.equal(deriveActor({ langgraph_node: 'model' }, []), null);
  assert.equal(deriveActor({ langgraph_node: 'speak', actor: 'zzz' }, [], new Set(['mabel'])), null);
  assert.equal(chunkText([{ type: 'text', text: 'ab' }, 'cd', { type: 'tool_use' }]), 'abcd');
});

test('tasks become node start/end with a full xray id for subgraphs', () => {
  const s = taskFromRoute(routeFrame(frame('tasks|perform:9a', { id: 't1', name: 'resolve', input: {}, triggers: [] })));
  assert.deepEqual({ node: s.node, id: s.id, phase: s.phase, ns: s.ns }, { node: 'resolve', id: 'perform:resolve', phase: 'start', ns: ['perform'] });
  const e = taskFromRoute(routeFrame(frame('tasks', { id: 't1', name: 'direct', error: null, result: {}, interrupts: [] })));
  assert.equal(e.phase, 'end');
  assert.equal(e.id, 'direct');
  assert.equal(taskFromRoute(routeFrame(frame('tasks', { id: 'x', name: '__start__' }))), null);
});

test('checkpoints: top-level only, labelled with values.beat', () => {
  const cp = checkpointFromRoute(routeFrame(frame('checkpoints', { config: { configurable: { thread_id: 't', checkpoint_ns: '', checkpoint_id: 'cp-7' } }, parent_config: { configurable: { checkpoint_id: 'cp-6' } }, values: { beat: 2, warmth: 61 }, metadata: { step: 9, source: 'loop' }, next: ['direct'], created_at: 'now' })));
  assert.equal(cp.checkpoint_id, 'cp-7');
  assert.equal(cp.beat, 2);
  assert.equal(cp.step, 9);
  assert.equal(cp.parent_id, 'cp-6');
  assert.deepEqual(cp.next, ['direct']);
  assert.equal(cp.values.warmth, 61);
  assert.equal(checkpointFromRoute(routeFrame(frame('checkpoints|perform:1', { config: { configurable: { checkpoint_id: 'x', checkpoint_ns: 'perform:1' } }, values: {} }))), null);
  assert.equal(checkpointFromRoute(routeFrame(frame('checkpoints', { values: {} }))), null);
});

test('error frames and end frames', () => {
  const r = new FrameRouter();
  assert.deepEqual(r.feed({ event: 'end', data: '' }), []);
  assert.equal(r.ended, true);
  const items = r.feed(frame('error', { error: 'ValueError', message: 'the goose escaped' }));
  assert.equal(items[0].type, 'error');
  assert.equal(items[0].message, 'the goose escaped');
  assert.equal(r.feed(frame('metadata', { run_id: 'run-1', attempt: 1 })).length, 0);
  assert.equal(r.runId, 'run-1');
});

test('readableError maps HTTP and network failures', () => {
  const http = Object.assign(new Error('HTTP 409'), { name: 'HttpError', status: 409, body: '{"detail":"no Encore tokens left"}' });
  assert.match(readableError(http).message, /no Encore tokens left/);
  assert.match(readableError(new TypeError('Failed to fetch')).message, /Cannot reach/);
  assert.equal(readableError(Object.assign(new Error('x'), { name: 'AbortError' })).name, 'AbortError');
});
