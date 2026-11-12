// run.js: runFlow(), the one way the SPA runs a graph. Contract: docs/PROTOCOL.md section 7.1.
//
//   const out = await runFlow({
//     graph: 'casting_call', input: {tour_id, night, seed, genre, town},
//     threadId?, checkpoint?, command?, attempt?, signal?,
//     pace(ev), onEvent(ev), onToken({node,text,actor}), onNode({node,id,phase}), onCheckpoint({checkpoint_id,beat,step,...}),
//     onInterrupt(payload, {id}) -> resume dict,
//     tokenGap(item)?, known?: Set<actor id>
//   });  // -> {threadId, runId, values, events, interrupts}
//
// Everything user-visible is released through a PlaybackQueue in server order (see run-pure.js). Besides the callbacks,
// runFlow publishes a tiny bus (`runEvents`) so the Prompt Book can follow any run without the caller doing anything:
//   'start' {graph, threadId}  'node' {graph, threadId, node, id, phase, ns}  'checkpoint'  'interrupt' {graph, threadId, payload}
//   'resume' {graph, threadId}  'end' {graph, threadId, ok, error?}

import { api, streamRun, ensureMock } from './api.js';
import { createEmitter } from './core/store.js';
import { FrameRouter, PlaybackQueue, createDeduper, defer, readableError, RunAborted } from './run-pure.js';

export const runEvents = createEmitter();

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The thread to use for a run: PROTOCOL 7.1 (server picks the deterministic id, then the Agent Server gets told about it). */
export async function ensureThread({ graph, input, tourId, night, attempt, signal } = {}) {
  const tid = tourId || input?.tour_id;
  const n = night ?? input?.night;
  if (tid) {
    const body = attempt !== undefined && attempt !== null ? { graph, attempt } : { graph };
    const t = await api.tourThread(tid, body, { signal });
    await api.createThread({ thread_id: t.thread_id, if_exists: 'do_nothing', metadata: { tour_id: tid, night: n ?? null, graph } }, { signal });
    return t.thread_id;
  }
  const t = await api.createThread({ metadata: { graph } }, { signal });
  return t.thread_id;
}

export async function runFlow(opts = {}) {
  const { graph, input, command, checkpoint, signal, pace, onEvent, onToken, onNode, onCheckpoint, onInterrupt } = opts;
  if (!graph) throw new Error('runFlow: graph is required');
  await ensureMock();
  if (signal?.aborted) throw new RunAborted();

  let threadId = opts.threadId || null;
  try {
    if (!threadId) threadId = await ensureThread({ graph, input, tourId: opts.tourId, night: opts.night, attempt: opts.attempt, signal });
  } catch (e) {
    throw readableError(e);
  }

  const events = [];
  const interrupts = [];
  let values = null;
  let runId = null;
  const dedupe = createDeduper();
  const info = { graph, threadId };
  runEvents.emit('start', { ...info, checkpoint: checkpoint || null });

  const guard = (fn, tag) => async (arg) => {
    try {
      return await fn?.(arg);
    } catch (e) {
      if (tag === 'interrupt') throw e; // a view that cannot answer should fail the run loudly
      console.error(`runFlow ${tag} callback failed`, e);
      return undefined;
    }
  };

  const queue = new PlaybackQueue({
    onEvent: guard((ev) => {
      events.push(ev);
      return onEvent?.(ev);
    }, 'onEvent'),
    pace: pace ? guard(pace, 'pace') : undefined,
    onToken: guard(onToken, 'onToken'),
    onNode: guard((n) => {
      runEvents.emit('node', { ...info, ...n });
      return onNode?.(n);
    }, 'onNode'),
    onCheckpoint: guard((c) => {
      runEvents.emit('checkpoint', { ...info, ...c });
      return onCheckpoint?.(c);
    }, 'onCheckpoint'),
    onInterrupt: async (payload, meta) => {
      interrupts.push(payload);
      runEvents.emit('interrupt', { ...info, payload, id: meta.id });
      if (!onInterrupt) throw new Error('This moment needs the Prompter, but nobody was listening.');
      const v = await onInterrupt(payload, meta);
      runEvents.emit('resume', info);
      return v;
    },
    tokenGap: opts.tokenGap,
    sleep: opts.sleep || realSleep,
  });
  const consumer = queue.run();
  consumer.catch(() => {});

  let current = null; // the open stream handle
  const onAbort = () => {
    queue.abort(new RunAborted());
    try {
      current?.close();
    } catch {
      /* closed */
    }
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const streamOnce = (body) =>
    new Promise((resolve, reject) => {
      const router = new FrameRouter({ dedupe, known: opts.known });
      let fatal = null;
      const handle = streamRun({
        threadId,
        assistantId: graph,
        ...body,
        // run context (e.g. greenroom_chat's {tour_id, actor_id}) must travel with EVERY request, including resumes
        ...(opts.context ? { context: opts.context } : {}),
        onEvent: (ev) => {
          for (const item of router.feed(ev)) queue.push(item);
        },
        onState: (state, st) => {
          if (state === 'error' && st?.fatal) fatal = st.error;
        },
        onRunId: (id) => {
          runId = id;
        },
      });
      current = handle;
      handle.done.then(
        () => {
          if (fatal) reject(fatal);
          else resolve(router);
        },
        reject,
      );
    });

  let body = checkpoint ? { input: input ?? null, checkpoint } : command ? { command } : { input };
  try {
    for (;;) {
      if (signal?.aborted) throw new RunAborted();
      const router = await streamOnce(body);
      if (router.values) values = router.values;
      if (router.runId) runId = router.runId;
      const pending = router.takeInterrupts();
      if (!pending.length) break;
      const deferred = defer();
      queue.push({ type: 'interrupt', list: pending, deferred });
      // wait until the theatre has performed everything before the interrupt and the player has answered it
      body = await Promise.race([deferred.promise, consumer.then(() => Promise.reject(new Error('The show ended before the Prompter answered.')))]);
    }
    queue.close();
    await consumer;
  } catch (e) {
    const err = readableError(e);
    if (!queue.failure) {
      // let everything already queued be performed, then surface the error
      queue.push({ type: 'error', message: err.message });
      queue.close();
      try {
        await consumer;
      } catch {
        /* the error item above (or an earlier failure) */
      }
    } else queue.abort(queue.failure);
    runEvents.emit('end', { ...info, ok: false, error: err.message });
    try {
      current?.close();
    } catch {
      /* closed */
    }
    throw err;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  runEvents.emit('end', { ...info, ok: true });
  return { threadId, runId, values, events, interrupts };
}
