// run-pure.js: the pure heart of runFlow (no DOM, no network, no timers except the injectable `sleep`). Unit-tested in
// tests/ui/run-pure.test.mjs and tests/ui/queue.test.mjs.
//
// Pipeline:   SSE frame --routeFrame--> {mode, ns, data} --FrameRouter.feed--> queue items --PlaybackQueue--> callbacks
//
//   * `values` (top level) is bookkeeping only: remembered, never queued.
//   * custom envelopes are de-duplicated by `key` (an interrupt() node re-runs from line 1 on resume and re-emits).
//   * every user-visible thing (custom events, tokens, task start/end, checkpoints, interrupts, errors) goes through the
//     queue IN SERVER ORDER, so the theatre performs at human speed while the server finishes in milliseconds, and an
//     interrupt is only offered to the player after everything before it has been performed.

import { splitEventName, decodeData } from './core/sse.js';

export const BEAT_ORDER = ['setup', 'complication', 'reversal', 'twist', 'finale'];

// ---------------------------------------------------------------------------------------------------------------
// frames

/** SSE event ({event, data:string, id?}) -> {mode, ns:[{node,taskId}], nsRaw, data, id, event}. */
export function routeFrame(ev) {
  const { mode: rawMode, ns, nsRaw } = splitEventName(ev.event);
  const mode = String(rawMode).split('/')[0]; // "messages/partial" (legacy) -> "messages"
  return { mode, sub: String(rawMode).split('/')[1] || '', ns, nsRaw, data: decodeData(ev), id: ev.id, event: ev.event };
}

/** Normalise one interrupt entry. Servers send {id, value}; very old ones sent bare values. */
export function normalizeInterrupt(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) return { id: raw.id ?? raw.interrupt_id ?? null, value: raw.value };
  return { id: null, value: raw };
}

/** All interrupts mentioned by a routed frame ([] when none). values/updates carry `__interrupt__`, tasks carry `interrupts`. */
export function extractInterrupts(route) {
  const d = route.data;
  if (!d || typeof d !== 'object') return [];
  if (route.mode === 'values' || route.mode === 'updates') {
    const list = d.__interrupt__;
    return Array.isArray(list) ? list.map(normalizeInterrupt) : [];
  }
  if (route.mode === 'tasks') return Array.isArray(d.interrupts) ? d.interrupts.map(normalizeInterrupt) : [];
  return [];
}

/** Turn a custom payload into the canonical envelope {v, kind, key, agent, data}. Returns null for junk. */
export function normalizeEnvelope(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (typeof d.kind === 'string') return { v: d.v ?? 1, kind: d.kind, key: d.key ?? null, agent: d.agent ?? null, data: d.data ?? {} };
  return { v: 1, kind: 'raw', key: `raw:${shortHash(JSON.stringify(d))}`, agent: null, data: d };
}

function shortHash(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0).toString(16);
}

export function createDeduper() {
  const seen = new Set();
  return {
    /** true the first time a key is seen (or when there is no key). */
    take(key) {
      if (key === null || key === undefined || key === '') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    get size() {
      return seen.size;
    },
  };
}

/** Text of a streamed message chunk (string or content blocks). */
export function chunkText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    let s = '';
    for (const b of content) {
      if (typeof b === 'string') s += b;
      else if (b && (b.type === 'text' || b.type === 'text_delta') && typeof b.text === 'string') s += b.text;
    }
    return s;
  }
  if (typeof content === 'object' && typeof content.text === 'string') return content.text;
  return '';
}

const GENERIC_NODES = new Set(['model', 'agent', 'tools', 'call_model', 'llm', 'perform', 'direct', 'voice']);

/**
 * Who is speaking? Looks at message metadata first (actor/speaker/persona/tags), then the node / subgraph names.
 * `known` (Set of performer + staff ids) makes the guess strict; without it the first candidate wins.
 */
export function deriveActor(meta = {}, ns = [], known) {
  const cand = [];
  for (const k of ['actor', 'speaker', 'persona', 'actor_id', 'lc_agent_name']) if (typeof meta[k] === 'string' && meta[k]) cand.push(meta[k]);
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  for (const t of tags) {
    const m = typeof t === 'string' && t.match(/^(?:actor|speaker|persona)[:=](.+)$/);
    if (m) cand.push(m[1]);
  }
  const node = meta.langgraph_node;
  if (typeof node === 'string') {
    const m = node.match(/^(?:actor|speak|voice|line)[_:](.+)$/);
    if (m) cand.push(m[1]);
    cand.push(node);
  }
  for (const n of ns) cand.push(n.node);
  if (known && known.size) return cand.find((c) => known.has(c)) ?? null;
  return cand.find((c) => !GENERIC_NODES.has(c)) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// FrameRouter

/**
 * Stateful per-stream-request router. `feed(sseEvent)` returns the queue items that frame produced.
 * After the stream ends call `takeInterrupts()` to get the (de-duplicated) interrupts seen in this request.
 */
export class FrameRouter {
  constructor({ dedupe = createDeduper(), known, now = () => Date.now() } = {}) {
    this.dedupe = dedupe;
    this.known = known;
    this.now = now;
    this.values = null;
    this.runId = null;
    this.error = null;
    this.ended = false;
    this.counts = { frames: 0, custom: 0, dropped: 0, tokens: 0, tasks: 0, checkpoints: 0 };
    this._interrupts = [];
    this._seenInterrupts = new Set();
    this._lastTokenAt = null;
  }

  _addInterrupts(list) {
    for (const it of list) {
      const key = it.id ?? JSON.stringify(it.value);
      if (this._seenInterrupts.has(key)) continue;
      this._seenInterrupts.add(key);
      this._interrupts.push(it);
    }
  }

  takeInterrupts() {
    const out = this._interrupts;
    this._interrupts = [];
    return out;
  }

  /** @returns {object[]} queue items */
  feed(ev) {
    this.counts.frames++;
    const route = routeFrame(ev);
    const out = [];
    switch (route.mode) {
      case 'metadata':
        if (route.data && route.data.run_id) this.runId = route.data.run_id;
        break;
      case 'values':
        if (route.ns.length === 0 && route.data && typeof route.data === 'object') {
          const { __interrupt__, ...rest } = route.data;
          this.values = rest;
          void __interrupt__;
        }
        this._addInterrupts(extractInterrupts(route));
        break;
      case 'updates':
        this._addInterrupts(extractInterrupts(route));
        break;
      case 'custom': {
        const env = normalizeEnvelope(route.data);
        if (!env) break;
        this.counts.custom++;
        if (!this.dedupe.take(env.key)) {
          this.counts.dropped++;
          break;
        }
        out.push({ type: 'event', ev: env, ns: route.ns.map((n) => n.node) });
        break;
      }
      case 'messages': {
        const tok = this._token(route);
        if (tok) out.push(tok);
        break;
      }
      case 'tasks': {
        const t = taskFromRoute(route);
        if (t) {
          this.counts.tasks++;
          out.push(t);
          this._addInterrupts(extractInterrupts(route));
        }
        break;
      }
      case 'checkpoints': {
        const c = checkpointFromRoute(route);
        if (c) {
          this.counts.checkpoints++;
          out.push(c);
        }
        break;
      }
      case 'error': {
        const d = route.data;
        const message = typeof d === 'string' ? d : d?.message || d?.error || JSON.stringify(d);
        this.error = message;
        out.push({ type: 'error', message: String(message) });
        break;
      }
      case 'end':
        this.ended = true;
        break;
      default:
        break; // debug / events / unknown
    }
    return out;
  }

  _token(route) {
    const d = route.data;
    if (!Array.isArray(d) || d.length < 1) return null;
    const [chunk, meta] = d;
    if (!chunk || typeof chunk !== 'object') return null;
    const kind = String(chunk.type || '').toLowerCase();
    if (kind && !/ai|assistant/.test(kind)) return null; // tool / human messages are not speech
    const text = chunkText(chunk.content);
    if (!text) return null;
    const t = this.now();
    const gap = this._lastTokenAt === null ? 0 : Math.max(0, t - this._lastTokenAt);
    this._lastTokenAt = t;
    this.counts.tokens++;
    const m = meta && typeof meta === 'object' ? meta : {};
    return { type: 'token', node: m.langgraph_node ?? null, text, actor: deriveActor(m, route.ns, this.known), ns: route.ns.map((n) => n.node), gap, messageId: chunk.id ?? null };
  }
}

/** tasks frame -> {type:'node', node, id, phase:'start'|'end', ns, taskId, error?} */
export function taskFromRoute(route) {
  const d = route.data;
  if (!d || typeof d !== 'object' || !d.name) return null;
  if (d.name === '__start__' || d.name === '__end__' || d.name === '__interrupt__') return null;
  const nsNodes = route.ns.map((n) => n.node);
  const isEnd = 'result' in d || 'error' in d;
  const interrupted = Array.isArray(d.interrupts) && d.interrupts.length > 0;
  return {
    type: 'node',
    node: d.name,
    id: [...nsNodes, d.name].join(':'),
    phase: isEnd ? 'end' : 'start',
    ns: nsNodes,
    taskId: d.id ?? null,
    error: d.error ? (typeof d.error === 'string' ? d.error : d.error.message || JSON.stringify(d.error)) : undefined,
    interrupted,
  };
}

/** checkpoints frame -> {type:'checkpoint', checkpoint_id, beat, meters:{warmth,chaos}, step, parent_id, next, values, created_at}; sub-graph checkpoints are ignored. */
export function checkpointFromRoute(route) {
  if (route.ns.length) return null;
  const d = route.data;
  if (!d || typeof d !== 'object') return null;
  const cfg = d.config?.configurable || d.configurable || {};
  const id = cfg.checkpoint_id || d.checkpoint_id || d.id;
  if (!id) return null;
  const ns = cfg.checkpoint_ns ?? d.checkpoint_ns ?? '';
  if (ns) return null;
  const values = d.values && typeof d.values === 'object' ? d.values : {};
  // the performance state keeps its meters either at the top level or nested under `show`
  const live = values.show && typeof values.show === 'object' ? values.show : values;
  return {
    type: 'checkpoint',
    checkpoint_id: id,
    beat: values.beat ?? live.beat ?? null,
    meters: { warmth: values.warmth ?? live.warmth ?? null, chaos: values.chaos ?? live.chaos ?? null },
    step: d.metadata?.step ?? null,
    source: d.metadata?.source ?? null,
    parent_id: d.parent_config?.configurable?.checkpoint_id ?? d.parent_checkpoint?.checkpoint_id ?? null,
    next: Array.isArray(d.next) ? d.next : [],
    values,
    created_at: d.created_at ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// resume plumbing

/**
 * Build the request body that resumes a paused run. ALWAYS an id map ({id: value}); a bare resume value can be
 * consumed by the next interrupt. Falls back to a bare value only when the server never gave us an id.
 * @param {{id:string|null, value:any}[]} list   interrupts, in the order they were offered
 * @param {any[]} answers                         one resume value per interrupt
 */
export function buildResumeBody(list, answers) {
  if (!list.length) throw new Error('nothing to resume');
  if (list.some((it) => !it.id)) {
    if (list.length === 1) return { command: { resume: answers[0] } };
    throw new Error('cannot resume several interrupts without ids');
  }
  const map = {};
  list.forEach((it, i) => {
    map[it.id] = answers[i];
  });
  return { command: { resume: map } };
}

// ---------------------------------------------------------------------------------------------------------------
// PlaybackQueue

export class RunAborted extends Error {
  constructor(msg = 'Cancelled') {
    super(msg);
    this.name = 'AbortError';
  }
}

export class RunFailed extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'RunFailed';
  }
}

export function defer() {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  promise.catch(() => {}); // a deferred nobody awaits must not raise "unhandled rejection"
  return { promise, resolve, reject };
}

/**
 * Releases items strictly in order. Handlers (all optional, all may be async):
 *   pace(ev), onEvent(ev), onToken(tok), onNode(n), onCheckpoint(c), onInterrupt(payload, {id,index,total}) -> resume value
 *   sleep(ms) used for token gaps ; tokenGap(tok) -> ms (default min(80, tok.gap))
 *
 * An 'interrupt' item is {type:'interrupt', list:[{id,value}], deferred}: after every earlier item has been released,
 * `onInterrupt` is awaited once per interrupt, and `deferred` resolves with the resume body ({command:{resume:{id:value}}}).
 */
export class PlaybackQueue {
  constructor(handlers = {}) {
    this.h = handlers;
    this.items = [];
    this.closed = false;
    this.failure = null;
    this._wake = null;
    this.released = 0;
    this.current = null;
    this._abort = defer();
  }

  get length() {
    return this.items.length;
  }

  push(item) {
    if (this.closed || this.failure) return;
    this.items.push(item);
    this._poke();
  }

  /** No more items will come: run() resolves once the queue has drained. */
  close() {
    this.closed = true;
    this._poke();
  }

  /** Stop now: run() rejects. Pending interrupt deferreds are rejected too. */
  abort(err = new RunAborted()) {
    if (!this.failure) this.failure = err;
    this._abort.reject(err);
    this._poke();
  }

  _poke() {
    if (this._wake) {
      const w = this._wake;
      this._wake = null;
      w();
    }
  }

  async run() {
    try {
      for (;;) {
        if (this.failure) throw this.failure;
        if (!this.items.length) {
          if (this.closed) return;
          await new Promise((r) => (this._wake = r));
          continue;
        }
        const item = this.items.shift();
        this.current = item;
        await Promise.race([this._dispatch(item), this._abort.promise]);
        this.current = null;
        this.released++;
      }
    } catch (e) {
      this.failure = this.failure || e;
      if (this.current?.deferred) this.current.deferred.reject(this.failure);
      for (const it of this.items) if (it.deferred) it.deferred.reject(this.failure);
      this.items = [];
      throw this.failure;
    }
  }

  async _dispatch(item) {
    const h = this.h;
    switch (item.type) {
      case 'event':
        if (h.onEvent) await h.onEvent(item.ev);
        if (h.pace) await h.pace(item.ev);
        break;
      case 'token': {
        if (h.onToken) await h.onToken({ node: item.node, text: item.text, actor: item.actor, ns: item.ns });
        const gap = h.tokenGap ? h.tokenGap(item) : Math.min(80, item.gap || 0);
        if (gap > 0 && h.sleep) await h.sleep(gap);
        break;
      }
      case 'node':
        if (h.onNode) await h.onNode({ node: item.node, phase: item.phase, id: item.id, ns: item.ns, taskId: item.taskId, error: item.error, interrupted: item.interrupted });
        break;
      case 'checkpoint':
        if (h.onCheckpoint) await h.onCheckpoint(item);
        break;
      case 'interrupt': {
        try {
          const answers = [];
          for (let i = 0; i < item.list.length; i++) {
            const it = item.list[i];
            if (!h.onInterrupt) throw new RunFailed('This step needs the Prompter, but nobody was listening.');
            answers.push(await h.onInterrupt(it.value, { id: it.id, index: i, total: item.list.length }));
          }
          item.deferred?.resolve(buildResumeBody(item.list, answers));
        } catch (e) {
          item.deferred?.reject(e);
          throw e;
        }
        break;
      }
      case 'error':
        throw new RunFailed(item.message);
      default:
        break;
    }
  }
}

/** Readable message for fetch / HTTP failures. */
export function readableError(e) {
  if (!e) return new Error('Something went wrong backstage.');
  if (e.name === 'AbortError' || e instanceof RunAborted) return e;
  if (e.name === 'HttpError') {
    let detail = '';
    try {
      const j = JSON.parse(e.body);
      detail = typeof j.detail === 'string' ? j.detail : typeof j.message === 'string' ? j.message : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join('; ') : '';
    } catch {
      detail = String(e.body || '').slice(0, 160);
    }
    const out = new Error(detail ? `The theatre said no (${e.status}): ${detail}` : `The theatre said no (HTTP ${e.status}).`);
    out.status = e.status;
    return out;
  }
  if (e instanceof TypeError) return new Error('Cannot reach the theatre. Is the server running?');
  return e instanceof Error ? e : new Error(String(e));
}
