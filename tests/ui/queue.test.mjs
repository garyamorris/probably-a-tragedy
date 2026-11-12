import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackQueue, defer, RunAborted, RunFailed } from '../../src/tragedy/server/static/js/run-pure.js';

const ev = (kind, key) => ({ type: 'event', ev: { v: 1, kind, key, agent: null, data: {} } });
const tick = () => new Promise((r) => setImmediate(r));

test('items are released strictly in order and pace is awaited for each custom event', async () => {
  const log = [];
  const q = new PlaybackQueue({
    onEvent: (e) => log.push(`event:${e.key}`),
    pace: async (e) => {
      log.push(`pace-start:${e.key}`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`pace-end:${e.key}`);
    },
    onToken: (t) => log.push(`tok:${t.text}`),
    onNode: (n) => log.push(`node:${n.node}:${n.phase}`),
    onCheckpoint: (c) => log.push(`cp:${c.checkpoint_id}`),
    sleep: async () => {},
  });
  const done = q.run();
  q.push({ type: 'node', node: 'direct', phase: 'start' });
  q.push(ev('stage.beat', 'a'));
  q.push({ type: 'token', text: 'Hel', gap: 0 });
  q.push({ type: 'token', text: 'lo', gap: 10 });
  q.push({ type: 'checkpoint', checkpoint_id: 'cp1' });
  q.push(ev('stage.line', 'b'));
  q.close();
  await done;
  assert.deepEqual(log, ['node:direct:start', 'event:a', 'pace-start:a', 'pace-end:a', 'tok:Hel', 'tok:lo', 'cp:cp1', 'event:b', 'pace-start:b', 'pace-end:b']);
});

test('an interrupt in the middle waits for all earlier events to be paced, then asks, then resolves the resume body', async () => {
  const log = [];
  let paced = 0;
  const q = new PlaybackQueue({
    pace: async (e) => {
      await new Promise((r) => setTimeout(r, 4));
      paced++;
      log.push(`paced:${e.key}`);
    },
    onInterrupt: async (payload, { id, index, total }) => {
      log.push(`ask:${id}:${payload.kind}:${index}/${total}:after=${paced}`);
      return { option: 'lean_in', cue: null, text: null };
    },
    sleep: async () => {},
  });
  const done = q.run();
  const deferred = defer();
  q.push(ev('x', 'e1'));
  q.push(ev('x', 'e2'));
  q.push(ev('x', 'e3'));
  q.push({ type: 'interrupt', list: [{ id: 'int-1', value: { kind: 'prompters_box' } }], deferred });
  // the second stream's events join the same queue, behind the interrupt
  const body = await deferred.promise;
  q.push(ev('x', 'e4'));
  q.close();
  await done;
  assert.deepEqual(body, { command: { resume: { 'int-1': { option: 'lean_in', cue: null, text: null } } } });
  assert.deepEqual(log, ['paced:e1', 'paced:e2', 'paced:e3', 'ask:int-1:prompters_box:0/1:after=3', 'paced:e4']);
});

test('several interrupts in one batch are asked in order and resumed with one id map', async () => {
  const asked = [];
  const q = new PlaybackQueue({
    onInterrupt: async (p, { id }) => {
      asked.push(id);
      return `v-${id}`;
    },
  });
  const done = q.run();
  const d = defer();
  q.push({ type: 'interrupt', list: [{ id: 'a', value: {} }, { id: 'b', value: {} }], deferred: d });
  assert.deepEqual((await d.promise).command.resume, { a: 'v-a', b: 'v-b' });
  q.close();
  await done;
  assert.deepEqual(asked, ['a', 'b']);
});

test('the queue idles until items arrive and finishes only after close() and drain', async () => {
  const seen = [];
  const q = new PlaybackQueue({ onEvent: (e) => seen.push(e.key) });
  let finished = false;
  const done = q.run().then(() => (finished = true));
  await tick();
  assert.equal(finished, false);
  q.push(ev('x', '1'));
  await tick();
  assert.deepEqual(seen, ['1']);
  assert.equal(finished, false);
  q.push(ev('x', '2'));
  q.close();
  await done;
  assert.deepEqual(seen, ['1', '2']);
});

test('an error item is surfaced after earlier items were released', async () => {
  const seen = [];
  const q = new PlaybackQueue({ onEvent: (e) => seen.push(e.key) });
  const done = q.run();
  q.push(ev('x', 'ok'));
  q.push({ type: 'error', message: 'the goose escaped' });
  q.push(ev('x', 'never'));
  q.close();
  await assert.rejects(done, (e) => e instanceof RunFailed && /goose/.test(e.message));
  assert.deepEqual(seen, ['ok']);
});

test('abort rejects run() and any pending interrupt deferred, even mid-pace', async () => {
  const q = new PlaybackQueue({ pace: () => new Promise(() => {}) }); // never finishes
  const done = q.run();
  const d = defer();
  q.push(ev('x', 'stuck'));
  q.push({ type: 'interrupt', list: [{ id: 'z', value: {} }], deferred: d });
  await tick();
  q.abort();
  await assert.rejects(done, (e) => e instanceof RunAborted || e.name === 'AbortError');
  await assert.rejects(d.promise);
});

test('a failing onInterrupt rejects the deferred and the run', async () => {
  const q = new PlaybackQueue({
    onInterrupt: async () => {
      throw new Error('player walked out');
    },
  });
  const done = q.run();
  const d = defer();
  q.push({ type: 'interrupt', list: [{ id: 'z', value: {} }], deferred: d });
  await assert.rejects(done, /walked out/);
  await assert.rejects(d.promise, /walked out/);
});

test('interrupt without a listener fails loudly', async () => {
  const q = new PlaybackQueue({});
  const done = q.run();
  const d = defer();
  q.push({ type: 'interrupt', list: [{ id: 'z', value: {} }], deferred: d });
  await assert.rejects(done, /nobody was listening/);
});

test('token gaps are capped and can be overridden', async () => {
  const slept = [];
  const q = new PlaybackQueue({ sleep: async (ms) => slept.push(ms), onToken: () => {} });
  const done = q.run();
  q.push({ type: 'token', text: 'a', gap: 0 });
  q.push({ type: 'token', text: 'b', gap: 12 });
  q.push({ type: 'token', text: 'c', gap: 5000 });
  q.close();
  await done;
  assert.deepEqual(slept, [12, 80]);
  const slept2 = [];
  const q2 = new PlaybackQueue({ sleep: async (ms) => slept2.push(ms), tokenGap: () => 0 });
  const d2 = q2.run();
  q2.push({ type: 'token', text: 'a', gap: 50 });
  q2.close();
  await d2;
  assert.deepEqual(slept2, []);
});
