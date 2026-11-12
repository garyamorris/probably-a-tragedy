// runFlow must send `context` to the Agent Server on every request (greenroom_chat reads {tour_id, actor_id} from it).
// It was silently dropped once: the tool then ran against a non-existent tour and the chip said FAILED.
import test from 'node:test';
import assert from 'node:assert/strict';

test('runFlow forwards opts.context in the runs/stream request body', async () => {
  const bodies = [];
  globalThis.location = globalThis.location || { origin: 'http://127.0.0.1:2027', search: '', hash: '' };
  globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.window = globalThis.window || globalThis;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/runs/stream')) bodies.push(JSON.parse(init.body));
    const enc = new TextEncoder();
    const sse = 'event: metadata\r\ndata: {"run_id":"r1"}\r\n\r\nevent: values\r\ndata: {"messages":[]}\r\n\r\nevent: end\r\ndata: null\r\n\r\n';
    return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(sse)); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  const { runFlow } = await import(new URL('../../src/tragedy/server/static/js/run.js', import.meta.url));
  const context = { tour_id: 'tour-abc', actor_id: 'mabel' };
  await runFlow({ graph: 'greenroom_chat', threadId: 'thread-1', input: { messages: [{ role: 'human', content: 'hi' }] }, context, pace: async () => {} });
  assert.ok(bodies.length >= 1, 'a runs/stream request was made');
  assert.deepEqual(bodies[0].context, context);
  assert.equal(bodies[0].assistant_id, 'greenroom_chat');
});
