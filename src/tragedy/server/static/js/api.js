// api.js: the ONLY module that knows endpoint paths.
//
//   (a) the game's custom routes under /api/*            (docs/PROTOCOL.md section 3)
//   (b) the built-in LangGraph Agent Server API          (/threads, /assistants, /store ...)
//
// `?api=http://host:port` points the SPA at another origin (remembered in localStorage; `?api=` clears it).
// `?mock=1` (everything simulated) / `?mock=fallback` (real server first, simulation when it answers 404 or is down)
// swap the transport for js/mock/. Nothing from js/mock/ is loaded unless one of those is on.

import { lsGet, lsSet } from './core/store.js';
import { openStream } from './core/stream.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
if (qs.has('api')) lsSet('api_base', (qs.get('api') || '').replace(/\/$/, ''));
export const API_BASE = lsGet('api_base', '') || '';

// ---------------------------------------------------------------------------------------------------------------
// mock switch

/** '' | 'force' | 'fallback' */
export function mockMode() {
  if (typeof window !== 'undefined' && window.__MOCK__) return window.__MOCK__ === 'fallback' ? 'fallback' : 'force';
  const m = qs.get('mock');
  if (m === null) return '';
  if (m === 'fallback') return 'fallback';
  if (m === '0' || m === 'false' || m === 'off') return '';
  return 'force';
}

let mockReady = null;
/** Installs the simulated transport when the page asked for it. Safe to call many times. */
export function ensureMock() {
  const mode = mockMode();
  if (!mode) return Promise.resolve(false);
  if (!mockReady) {
    mockReady = import('./mock/index.js').then((m) => {
      m.installMock({ fallback: mode === 'fallback' });
      return true;
    });
  }
  return mockReady;
}

// ---------------------------------------------------------------------------------------------------------------
// paths

const enc = (s) => encodeURIComponent(String(s));

export const paths = {
  // --- the game (PROTOCOL section 3) ---
  boot: '/api/boot',
  datasets: '/api/datasets',
  dataset: (name) => `/api/datasets/${enc(name)}`,
  tours: '/api/tour',
  tour: (id) => `/api/tour/${enc(id)}`,
  tourThread: (id) => `/api/tour/${enc(id)}/thread`,
  tourRewind: (id) => `/api/tour/${enc(id)}/rewind`,
  tourCandle: (id) => `/api/tour/${enc(id)}/candle`,
  links: '/api/links',
  graphs: '/api/graphs',
  healthz: '/healthz',

  // --- built-in Agent Server ---
  lgOk: '/ok',
  lgInfo: '/info',
  lgAssistantGraph: (id) => `/assistants/${enc(id)}/graph`,
  lgAssistantSchemas: (id) => `/assistants/${enc(id)}/schemas`,
  lgThreads: '/threads',
  lgThreadsSearch: '/threads/search',
  lgThread: (id) => `/threads/${enc(id)}`,
  lgThreadState: (id) => `/threads/${enc(id)}/state`,
  lgThreadHistory: (id) => `/threads/${enc(id)}/history`,
  lgThreadRuns: (id) => `/threads/${enc(id)}/runs`,
  lgThreadRunStream: (id) => `/threads/${enc(id)}/runs/stream`,
  lgRun: (tid, rid) => `/threads/${enc(tid)}/runs/${enc(rid)}`,
  lgRunJoinStream: (tid, rid) => `/threads/${enc(tid)}/runs/${enc(rid)}/stream`,
  lgRunCancel: (tid, rid) => `/threads/${enc(tid)}/runs/${enc(rid)}/cancel`,
  lgStoreItems: '/store/items',
  lgStoreSearch: '/store/items/search',
};

export class ApiError extends Error {
  constructor(status, code, message, details, url) {
    super(message || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || `http_${status}`;
    this.details = details || null;
    this.url = url;
  }
}

export function buildUrl(path, query) {
  let url = API_BASE + path;
  if (query) {
    const parts = [];
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) for (const x of v) parts.push(`${enc(k)}=${enc(x)}`);
      else parts.push(`${enc(k)}=${enc(v)}`);
    }
    if (parts.length) url += (url.includes('?') ? '&' : '?') + parts.join('&');
  }
  return url;
}

/** Core request. Returns parsed JSON (null for 204 / empty body). Throws ApiError. */
export async function request(method, path, { query, body, signal, timeoutMs = 20000, headers } = {}) {
  if (mockMode()) await ensureMock();
  const url = buildUrl(path, query);
  const ctrl = new AbortController();
  const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiError(0, signal?.aborted ? 'aborted' : 'timeout', signal?.aborted ? 'Cancelled' : 'The theatre took too long to answer', null, url);
    throw new ApiError(0, 'network', 'Cannot reach the theatre. Is the server running? (try ?mock=1 for the offline demo)', null, url);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    let message = typeof data === 'string' ? data.slice(0, 300) : null;
    let code = null;
    if (data && typeof data === 'object') {
      const err = data.error && typeof data.error === 'object' ? data.error : data;
      code = err.code || null;
      message = err.message || (typeof err.detail === 'string' ? err.detail : Array.isArray(err.detail) ? err.detail.map((d) => d.msg || JSON.stringify(d)).join('; ') : null) || message;
    }
    throw new ApiError(res.status, code, message || res.statusText, data, url);
  }
  return data;
}

export const get = (path, opts) => request('GET', path, opts);
export const post = (path, body, opts) => request('POST', path, { ...(opts || {}), body: body ?? {} });
export const put = (path, body, opts) => request('PUT', path, { ...(opts || {}), body });

// ---------------------------------------------------------------------------------------------------------------
// normalisers (the server is allowed to be a little loose about list envelopes)

function listOf(res, keys = ['items', 'datasets', 'graphs', 'rows', 'data']) {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') for (const k of keys) if (Array.isArray(res[k])) return res[k];
  return [];
}

export function normalizeDatasetList(res) {
  return listOf(res).map((d) => ({
    name: d.name || d.id,
    rows: d.rows ?? d.records ?? d.count ?? d.total ?? null,
    desc: d.desc ?? d.description ?? '',
    kind: d.kind ?? null,
    ...d,
  }));
}

/**
 * -> {name, rows:[...], total, offset, limit, object?:any}.
 * The server answers {name, rows:<total count>, offset, items:[...]} (single-object datasets such as playbill.json put the
 * object in `items`); older/looser envelopes with an array in `rows` are accepted too.
 */
export function normalizeDatasetPage(res, { offset = 0, limit = 50 } = {}) {
  if (Array.isArray(res)) return { rows: res, total: res.length, offset, limit };
  if (res && typeof res === 'object') {
    const count = [res.total, res.count, res.total_rows, typeof res.rows === 'number' ? res.rows : undefined].find((x) => typeof x === 'number');
    for (const k of ['items', 'rows', 'records', 'data', 'lines', 'entries']) {
      if (Array.isArray(res[k])) return { name: res.name, rows: res[k], total: count ?? res[k].length, offset: res.offset ?? offset, limit: res.limit ?? limit };
    }
    const obj = res.object ?? [res.items, res.rows, res.data].find((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (obj) return { name: res.name, rows: [], total: 1, offset, limit, object: obj };
  }
  return { rows: [], total: 0, offset, limit };
}

// ---------------------------------------------------------------------------------------------------------------
// typed wrappers

export const RUN_STREAM_MODES = ['values', 'updates', 'messages-tuple', 'custom', 'tasks', 'checkpoints'];

export const api = {
  // the game
  boot: (o) => get(paths.boot, o),
  healthz: (o) => get(paths.healthz, o),
  datasets: async (o) => normalizeDatasetList(await get(paths.datasets, o)),
  dataset: async (name, { offset = 0, limit = 50 } = {}, o) => normalizeDatasetPage(await get(paths.dataset(name), { ...o, query: { offset, limit } }), { offset, limit }),
  createTour: (seed, o) => post(paths.tours, seed === undefined || seed === null || seed === '' ? {} : { seed: Number(seed) }, o),
  tour: (id, o) => get(paths.tour(id), o),
  tourThread: (id, body, o) => post(paths.tourThread(id), body, o),
  rewind: (id, o) => post(paths.tourRewind(id), {}, o),
  candle: (id, o) => post(paths.tourCandle(id), {}, o),
  links: ({ graph, threadId } = {}, o) => get(paths.links, { ...o, query: { graph, thread_id: threadId } }),
  graphs: async (o) => listOf(await get(paths.graphs, o)),

  // Agent Server
  createThread: (body, o) => post(paths.lgThreads, body || {}, o),
  thread: (id, o) => get(paths.lgThread(id), o),
  threadState: (id, query, o) => get(paths.lgThreadState(id), { ...o, query }),
  history: (id, body, o) => post(paths.lgThreadHistory(id), body || { limit: 50 }, o),
  graph: (id, xray = true, o) => get(paths.lgAssistantGraph(id), { ...o, query: { xray: xray ? 'true' : undefined } }),
  run: (tid, rid, o) => get(paths.lgRun(tid, rid), o),
  cancelRun: (tid, rid, o) => post(paths.lgRunCancel(tid, rid), {}, { ...o, query: { action: 'interrupt', wait: 'false' } }),
  storeSearch: (body, o) => post(paths.lgStoreSearch, body, o),
};

// ---------------------------------------------------------------------------------------------------------------
// run streaming

/**
 * Start a run and stream it: `POST /threads/{id}/runs/stream`. If the connection drops mid-run we rejoin with
 * `GET /threads/{id}/runs/{run_id}/stream` + Last-Event-ID (the run was created with stream_resumable and
 * on_disconnect:continue, so it keeps going on the server).
 * Returns the openStream handle ({close, done, state, lastEventId, stats}).
 */
export function streamRun({ threadId, assistantId, input, command, checkpoint, metadata, config, context, modes = RUN_STREAM_MODES, multitask = 'enqueue', onEvent, onState, onRunId }) {
  let runId = null;
  const body = {
    assistant_id: assistantId,
    stream_mode: modes,
    stream_subgraphs: true,
    stream_resumable: true,
    on_disconnect: 'continue',
    ...(multitask ? { multitask_strategy: multitask } : {}),
    ...(input !== undefined ? { input } : {}),
    ...(command ? { command } : {}),
    ...(checkpoint ? { checkpoint } : {}),
    ...(metadata ? { metadata } : {}),
    ...(config ? { config } : {}),
    ...(context ? { context } : {}),
  };
  return openStream({
    url: buildUrl(paths.lgThreadRunStream(threadId)),
    method: 'POST',
    body,
    reconnect: true,
    isTerminal: (ev) => ev.event === 'end' || ev.event === 'error',
    onEvent: (ev) => {
      if (ev.event === 'metadata' && !runId) {
        try {
          runId = JSON.parse(ev.data).run_id || null;
          if (runId && onRunId) onRunId(runId);
        } catch {
          /* ignore */
        }
      }
      onEvent(ev);
    },
    onOpen: (res) => {
      const loc = res.headers.get('content-location');
      const m = loc && loc.match(/runs\/([^/?]+)/);
      if (m && !runId) {
        runId = m[1];
        if (onRunId) onRunId(runId);
      }
    },
    onState,
    buildRequest: (lastId) => {
      if (!runId) return {};
      return { url: buildUrl(paths.lgRunJoinStream(threadId, runId)), method: 'GET', body: undefined, headers: { 'Last-Event-ID': lastId || '-1' } };
    },
    shouldReconnect: async () => {
      if (!runId) return false;
      try {
        const run = await api.run(threadId, runId);
        return !!run && (run.status === 'running' || run.status === 'pending');
      } catch {
        return false;
      }
    },
    backoff: { base: 500, cap: 6000 },
    maxRetries: 10,
  });
}

/** Join a run already in flight (resumable streams replay what they captured). A join must NOT send stream_mode. */
export function joinRun({ threadId, runId, onEvent, onState, replay = true }) {
  return openStream({
    url: buildUrl(paths.lgRunJoinStream(threadId, runId)),
    method: 'GET',
    headers: replay ? { 'Last-Event-ID': '-1' } : {},
    reconnect: true,
    isTerminal: (ev) => ev.event === 'end',
    onEvent,
    onState,
    shouldReconnect: async () => {
      try {
        const run = await api.run(threadId, runId);
        return !!run && (run.status === 'running' || run.status === 'pending');
      } catch {
        return false;
      }
    },
    backoff: { base: 500, cap: 6000 },
    maxRetries: 10,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Studio / trace links (PROTOCOL section 6)
//
//   base   https://smith.langchain.com/studio/?baseUrl=<public_base_url>
//   graph  <base>&graph=<id>                       (best effort)
//   thread https://smith.langchain.com/studio/thread/<thread_id>?baseUrl=<public_base_url>

const DEFAULT_STUDIO = 'https://smith.langchain.com/studio/';

function studioRoot(boot) {
  return (boot?.studio?.url || DEFAULT_STUDIO).replace(/\/+$/, '');
}
function publicBase(boot) {
  return boot?.public_base_url || (typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:2027');
}

export function studioBase(boot) {
  return boot?.studio?.base_link || `${studioRoot(boot)}/?baseUrl=${enc(publicBase(boot))}`;
}

/** The server's assistant UUID for a graph (Studio addresses graphs by assistant): from GET /api/boot `graphs[].assistant_id`. */
export function assistantIdOf(boot, graphId) {
  return (boot?.graphs || []).find((g) => g.id === graphId)?.assistant_id || null;
}

/**
 * Studio's own thread route, as Studio redirects to it (verified against the real Studio):
 *   <studio>/thread?baseUrl=<server>&render=interact&mode=graph&assistantId=<assistant uuid>&threadId=<thread id>
 */
export function studioRouteUrl(boot, { assistantId, threadId } = {}) {
  let q = `baseUrl=${enc(publicBase(boot))}&render=interact&mode=graph`;
  if (assistantId) q += `&assistantId=${enc(assistantId)}`;
  if (threadId) q += `&threadId=${enc(threadId)}`;
  return `${studioRoot(boot)}/thread?${q}`;
}

/** Without the graph's assistant id we can only offer the one link Studio documents (open Studio on this server). */
export function studioGraphUrl(boot, graphId) {
  const aid = graphId ? assistantIdOf(boot, graphId) : null;
  return aid ? studioRouteUrl(boot, { assistantId: aid }) : studioBase(boot);
}

export function studioThreadUrl(boot, threadId, graphId) {
  const tpl = boot?.studio?.thread_url_template;
  if (tpl) {
    return String(tpl)
      .replaceAll('{thread_id}', threadId)
      .replaceAll('{studio}', studioRoot(boot))
      .replaceAll('{base}', enc(publicBase(boot)))
      .replaceAll('{graph_id}', graphId || '');
  }
  return studioRouteUrl(boot, { assistantId: graphId ? assistantIdOf(boot, graphId) : null, threadId });
}

/** The three light links the Prompt Book offers. `boot` is the GET /api/boot payload (may be null). */
export function makeLinks(getBoot) {
  const b = () => (typeof getBoot === 'function' ? getBoot() : getBoot);
  return {
    studioBase: () => studioBase(b()),
    studioGraph: (graph) => studioGraphUrl(b(), graph),
    studioThread: (threadId, graph) => studioThreadUrl(b(), threadId, graph),
    /** GET /api/links -> {studio_graph, studio_thread, trace, trace_status}; never throws (returns {trace:null, trace_status}). */
    async resolve({ graph, threadId } = {}) {
      try {
        const r = await api.links({ graph, threadId });
        return { studio_graph: r?.studio_graph || studioGraphUrl(b(), graph), studio_thread: r?.studio_thread || (threadId ? studioThreadUrl(b(), threadId, graph) : null), trace: r?.trace || null, trace_status: r?.trace_status || (r?.trace ? 'ok' : 'unknown') };
      } catch (e) {
        return { studio_graph: studioGraphUrl(b(), graph), studio_thread: threadId ? studioThreadUrl(b(), threadId, graph) : null, trace: null, trace_status: 'unavailable', error: e?.message };
      }
    },
  };
}
