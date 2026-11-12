import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, paths, studioBase, studioGraphUrl, studioThreadUrl, studioRouteUrl, assistantIdOf, makeLinks, normalizeDatasetList, normalizeDatasetPage, mockMode, RUN_STREAM_MODES } from '../../src/tragedy/server/static/js/api.js';

const boot = { public_base_url: 'http://127.0.0.1:2027', studio: { url: 'https://smith.langchain.com/studio/', base_link: 'https://smith.langchain.com/studio/?baseUrl=http%3A%2F%2F127.0.0.1%3A2027' } };

test('custom API paths (PROTOCOL section 3)', () => {
  assert.equal(paths.boot, '/api/boot');
  assert.equal(paths.dataset('towns'), '/api/datasets/towns');
  assert.equal(paths.tour('tour-ab12'), '/api/tour/tour-ab12');
  assert.equal(paths.tourThread('tour-ab12'), '/api/tour/tour-ab12/thread');
  assert.equal(paths.tourRewind('t'), '/api/tour/t/rewind');
  assert.equal(paths.tourCandle('t'), '/api/tour/t/candle');
  assert.equal(paths.links, '/api/links');
});

test('built-in Agent Server paths encode ids', () => {
  assert.equal(paths.lgThreadRunStream('a b/c'), '/threads/a%20b%2Fc/runs/stream');
  assert.equal(paths.lgRunJoinStream('t', 'r'), '/threads/t/runs/r/stream');
  assert.equal(paths.lgAssistantGraph('performance'), '/assistants/performance/graph');
  assert.equal(paths.lgThreadHistory('t'), '/threads/t/history');
});

test('buildUrl skips empty values and encodes', () => {
  assert.equal(buildUrl('/api/links', { graph: 'performance', thread_id: 'x y', skip: '', nope: undefined }), '/api/links?graph=performance&thread_id=x%20y');
  assert.equal(buildUrl('/api/datasets/towns', { offset: 0, limit: 50 }), '/api/datasets/towns?offset=0&limit=50');
  assert.equal(buildUrl('/x'), '/x');
});

test('Studio link builders follow PROTOCOL section 6', () => {
  assert.equal(studioBase(boot), 'https://smith.langchain.com/studio/?baseUrl=http%3A%2F%2F127.0.0.1%3A2027');
  // without an assistant id the only honest link is the documented one
  assert.equal(studioGraphUrl(boot, 'performance'), studioBase(boot));
  const withIds = { ...boot, graphs: [{ id: 'performance', assistant_id: 'A-1' }, { id: 'reviews', assistant_id: 'A-2' }] };
  assert.equal(assistantIdOf(withIds, 'reviews'), 'A-2');
  assert.equal(studioGraphUrl(withIds, 'performance'), 'https://smith.langchain.com/studio/thread?baseUrl=http%3A%2F%2F127.0.0.1%3A2027&render=interact&mode=graph&assistantId=A-1');
  // the shape verified against the real Studio: /thread?baseUrl&render=interact&mode=graph&assistantId&threadId
  assert.equal(studioThreadUrl(withIds, 'abc-123', 'performance'), 'https://smith.langchain.com/studio/thread?baseUrl=http%3A%2F%2F127.0.0.1%3A2027&render=interact&mode=graph&assistantId=A-1&threadId=abc-123');
  assert.equal(studioRouteUrl(boot, { threadId: 't' }), 'https://smith.langchain.com/studio/thread?baseUrl=http%3A%2F%2F127.0.0.1%3A2027&render=interact&mode=graph&threadId=t');
});

test('link builders fall back sensibly without a boot payload', () => {
  assert.match(studioBase(null), /^https:\/\/smith\.langchain\.com\/studio\/\?baseUrl=/);
  assert.match(studioThreadUrl({ public_base_url: 'http://h:1' }, 't1'), /\/studio\/thread\?baseUrl=http%3A%2F%2Fh%3A1&render=interact&mode=graph&threadId=t1$/);
  assert.equal(studioGraphUrl(boot, ''), studioBase(boot));
});

test('thread url template wins when the server provides one', () => {
  const b = { ...boot, studio: { ...boot.studio, thread_url_template: '{studio}/t/{thread_id}?b={base}&g={graph_id}' } };
  assert.equal(studioThreadUrl(b, 'T', 'performance'), 'https://smith.langchain.com/studio/t/T?b=http%3A%2F%2F127.0.0.1%3A2027&g=performance');
});

test('makeLinks reads the live boot payload', () => {
  let b = boot;
  const links = makeLinks(() => b);
  assert.match(links.studioThread('t9', 'reviews'), /thread\?baseUrl=.*&threadId=t9$/);
  b = { public_base_url: 'http://other:9', studio: { url: 'https://studio.example/' } };
  assert.match(links.studioBase(), /^https:\/\/studio\.example\/\?baseUrl=http%3A%2F%2Fother%3A9/);
});

test('dataset normalisers accept the server shape and looser ones', () => {
  assert.deepEqual(normalizeDatasetList([{ name: 'towns', rows: 30, desc: 'x' }]).map((d) => [d.name, d.rows]), [['towns', 30]]);
  assert.deepEqual(normalizeDatasetList({ items: [{ name: 'a', count: 3 }] }).map((d) => [d.name, d.rows]), [['a', 3]]);
  // the real server: {name, rows: <total>, offset, items: [...]}
  const real = normalizeDatasetPage({ name: 'towns', rows: 30, offset: 0, items: [{ id: 1 }, { id: 2 }] }, { offset: 0, limit: 2 });
  assert.equal(real.total, 30);
  assert.equal(real.rows.length, 2);
  // looser: array under `rows` plus a total
  const page = normalizeDatasetPage({ name: 'towns', rows: [{ id: 1 }, { id: 2 }], total: 30, offset: 0, limit: 2 });
  assert.equal(page.total, 30);
  assert.equal(page.rows.length, 2);
  assert.equal(normalizeDatasetPage([{ a: 1 }]).total, 1);
  // single-object dataset (playbill.json)
  const obj = normalizeDatasetPage({ name: 'playbill', rows: 1, offset: 0, items: { bio: {} } });
  assert.deepEqual(obj.rows, []);
  assert.deepEqual(obj.object, { bio: {} });
  assert.equal(normalizeDatasetPage(null).total, 0);
});

test('stream modes are the six the protocol lists', () => {
  assert.deepEqual(RUN_STREAM_MODES, ['values', 'updates', 'messages-tuple', 'custom', 'tasks', 'checkpoints']);
});

test('mock mode is off in a plain Node context', () => {
  assert.equal(mockMode(), '');
});
