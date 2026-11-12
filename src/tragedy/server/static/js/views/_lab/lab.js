// views-lab.html driver: a fake `ctx` + a fake `runFlow` that replays canned runs, so any view can be opened standalone
// (views-lab.html#casting) and driven end-to-end, hopping between views through ctx.nav exactly like the real shell does.
import * as realUi from '../../ui.js';
import { data, makeTour, SAMPLE_CAST, SAMPLE_SCRIPT, SAMPLE_RESULT, towns, roadEvents, performers } from './fixtures.js';
import { FLOWS } from './flows.js';
import { h, clear } from '../../core/dom.js';

const VIEWS = ['casting', 'writers', 'rehearsal', 'reviews', 'almanac', 'playbill', 'road', 'greenroom'];
const ORDER = ['casting', 'writers', 'rehearsal', 'show', 'reviews', 'almanac', 'playbill', 'road', 'tour'];

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  const [path, qs = ''] = raw.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs));
  return { view: path || 'casting', q };
}
function setHash(view, q) {
  const qs = new URLSearchParams(q).toString();
  history.replaceState(null, '', `#${view}${qs ? '?' + qs : ''}`);
}

/* ------------------------------------------------------------------------------------------ the fake world */

const world = { rapport: { mabel: 2, goose: 1, gus: 0.5 }, roadEvents, revise: false, threads: new Map(), tour: makeTour(1) };
let counter = 0;
const tickLog = [];

export async function runFlow(opts) {
  const { graph, pace, onEvent, onToken, onInterrupt, signal } = opts;
  let input = opts.input;
  const tid = opts.threadId || (opts.attempt != null ? `lab-${graph}-${opts.attempt}` : `lab-${graph}-${++counter}`);
  const thread = world.threads.get(tid) || {};
  world.threads.set(tid, thread);
  if (input == null && thread.crashed) input = { ...thread.input, __resume: true };
  else if (input) thread.input = input;
  if (input?.crash && graph === 'the_road') thread.crashed = true;
  if (input?.__resume) thread.crashed = false;
  const flow = FLOWS[graph];
  if (!flow) throw new Error(`lab: no canned run for graph "${graph}"`);
  const gen = flow(input || {}, world, thread);
  const events = [];
  const interrupts = [];
  let values = {};
  let sendVal;
  let intN = 0;
  const abortCheck = () => { if (signal?.aborted) { const e = new Error('Cancelled'); e.name = 'AbortError'; throw e; } };
  for (;;) {
    // 1) run the generator until it interrupts / finishes / throws, buffering (like the real server finishing in ms)
    const batch = [];
    let stop = null;
    let thrown = null;
    for (;;) {
      let r;
      try { r = gen.next(sendVal); } catch (err) { thrown = err; break; }
      sendVal = undefined;
      if (r.done) { values = r.value || {}; stop = 'done'; break; }
      if (r.value.interrupt) { stop = r.value.interrupt; break; }
      batch.push(r.value);
    }
    // 2) release in server order, like the real PlaybackQueue: onEvent then pace for custom events, onToken (+tiny gap) for tokens
    for (const b of batch) {
      abortCheck();
      if (b.token) { await onToken?.(b.token); await new Promise((r) => setTimeout(r, 25)); continue; }
      events.push(b.event);
      await onEvent?.(b.event);
      await pace?.(b.event);
    }
    abortCheck();
    if (thrown) { thrown.threadId = tid; throw thrown; }
    if (stop === 'done') break;
    interrupts.push(stop);
    sendVal = await onInterrupt?.(stop, { id: `int-${++intN}` });
    abortCheck();
  }
  return { threadId: tid, runId: `run-${counter}`, values, events, interrupts };
}

/* ------------------------------------------------------------------------------------------ ctx */

export function makeCtx({ view, params, onNav }) {
  const tour = world.tour;
  const api = {
    async candle() {
      await new Promise((r) => setTimeout(r, 120));
      if (tour.candles <= 0) throw new Error('409: no candles left');
      tour.candles -= 1;
      return { candles: tour.candles };
    },
    async tourThread(_id, body) { return { thread_id: `lab-${body.graph}-${body.attempt ?? 0}` }; },
    async createThread(body) { return { thread_id: body.thread_id }; },
    async tour() { return tour; },
  };
  const ctx = {
    api,
    runFlow,
    tour,
    async refreshTour() { return tour; },
    nav: (v, p) => onNav(v, p),
    toast: (m, o) => realUi.toast(m, o),
    ui: realUi,
    data,
    links: {},
    night: tour.night,
    params,
    view,
  };
  return ctx;
}

/* ------------------------------------------------------------------------------------------ stubs for Shell-Core's own pages */

function stubPage(name, root, ctx) {
  const p = ctx.params;
  const go = (v, extra = {}) => ctx.nav(v, { ...p, ...extra });
  const body = {
    show: () => [
      h('h1', { class: 'display' }, 'The Show (stub)'),
      h('p', { class: 'hand' }, 'Shell-Core hosts the Stage here. In the lab the curtain falls instantly.'),
      h('button', { class: 'btn v-btn v-btn-gold', onclick: () => go('reviews', { result: SAMPLE_RESULT }) }, 'Curtain falls: to the reviews'),
    ],
    tour: () => [
      h('h1', { class: 'display' }, 'The Tour (stub)'),
      h('p', { class: 'hand' }, `Night ${world.tour.night + 1}. Funds ${world.tour.funds}, Encore ${world.tour.encore}, candles ${world.tour.candles}.`),
      h('div', { class: 'row gap-2 wrap', style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px' },
        h('button', { class: 'btn v-btn v-btn-gold', onclick: () => ctx.nav('casting', { genre: p.genre || 'farce', town: p.town || towns[world.tour.night]?.id || 'marshwick' }) }, 'Begin tonight (casting)'),
        h('button', { class: 'btn v-btn v-btn-paper', onclick: () => ctx.nav('greenroom', { genre: p.genre, town: p.town }) }, 'To the greenroom')),
    ],
  }[name];
  clear(root);
  root.appendChild(h('section', { class: 'v-view v-stub' }, h('div', { class: 'v-paper', style: 'padding:24px;max-width:560px;margin:24px auto' }, body())));
  return { unmount() {} };
}

/* ------------------------------------------------------------------------------------------ the lab shell */

async function addShellCss() {
  const q = new URLSearchParams(location.search);
  if (q.get('shell') === '0') return false;
  let any = false;
  for (const n of ['base', 'components']) {
    try {
      const r = await fetch(`./css/${n}.css`, { method: 'HEAD' });
      if (r.ok) { document.head.appendChild(h('link', { rel: 'stylesheet', href: `./css/${n}.css` })); any = true; }
    } catch { /* offline file */ }
  }
  return any;
}

let current = null;
let seq = 0;

function defaultParams(view, q) {
  const night = Number(q.night ?? world.tour.night);
  const genre = q.genre || 'farce';
  const town = q.town || towns[Math.min(night, towns.length - 1)].id;
  const idx = ORDER.indexOf(view);
  const p = { genre, town };
  if (idx > ORDER.indexOf('casting') || view === 'writers') p.cast = SAMPLE_CAST;
  if (idx > ORDER.indexOf('writers') || ['rehearsal', 'reviews', 'almanac', 'playbill', 'road'].includes(view)) p.script = { ...SAMPLE_SCRIPT, genre };
  if (['reviews', 'almanac', 'playbill', 'road'].includes(view)) p.result = SAMPLE_RESULT;
  if (['almanac', 'playbill', 'road'].includes(view)) Object.assign(p, { stars: 3.5, headline: 'GOOSE EATS PROP, CRITICS EAT THEIR WORDS', funds_delta: 3 });
  if (['almanac', 'playbill', 'road'].includes(view)) p.next_town = towns[Math.min(night + 1, towns.length - 1)].id;
  if (['playbill', 'road'].includes(view)) p.traditions = [{ calamity: 'the_goose_incident', title: 'The Goose Incident', count: 3 }];
  return p;
}

async function show(view, params, q) {
  const my = ++seq;
  const root = document.getElementById('lab-root');
  if (current) { try { current.unmount?.(); } catch (e) { console.error(e); } current = null; }
  clear(root);
  document.querySelectorAll('.lab-nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  window.scrollTo(0, 0);
  const night = Number(q.night ?? world.tour.night);
  world.tour = { ...world.tour, ...makeTour(night), candles: world.tour.candles, funds: world.tour.funds, encore: world.tour.encore };
  world.revise = q.revise === '1';
  const ctx = makeCtx({
    view, params,
    onNav: (v, p) => {
      logNav(v, p);
      const nq = { ...q };
      setHash(v, nq);
      // like the shell: the carry is MERGED into the params that flow through the night; going to the tour clears it
      show(v, v === 'tour' ? { genre: params.genre, town: params.town } : { ...params, ...(p || {}) }, nq);
    },
  });
  setHash(view, q);
  if (view === 'show' || view === 'tour') { current = stubPage(view, root, ctx); return; }
  try {
    const mod = await import(`../${view}.js?v=${Date.now()}`);
    if (my !== seq) return;
    current = await mod.mount(root, ctx);
  } catch (err) {
    console.error(err);
    root.appendChild(h('div', { class: 'v-paper', style: 'padding:24px;margin:24px auto;max-width:640px' }, h('h2', { class: 'display' }, `Could not mount "${view}"`), h('pre', { style: 'white-space:pre-wrap;font-size:12px' }, String(err?.stack || err))));
  }
}

function logNav(v, p) {
  const box = document.getElementById('lab-log');
  const keys = Object.keys(p || {}).join(', ');
  tickLog.unshift(`nav -> ${v}  {${keys}}`);
  tickLog.length = Math.min(tickLog.length, 6);
  box.textContent = tickLog.join('\n');
  window.__LAB_NAV = { view: v, params: p };
  (window.__LAB_NAVS ||= []).push({ view: v, params: p });
}

export async function boot() {
  await addShellCss();
  const bar = document.getElementById('lab-bar');
  const { view, q } = parseHash();
  const nav = h('nav', { class: 'lab-nav' },
    ...VIEWS.map((v) => h('button', { 'data-view': v, onclick: () => { const nq = readOpts(); setHash(v, nq); show(v, defaultParams(v, nq), nq); } }, v)));
  const opt = (id, label, kids) => h('label', null, label, h('select', { id, onchange: () => { const nq = readOpts(); const cur = parseHash().view; setHash(cur, nq); show(cur, defaultParams(cur, nq), nq); } }, ...kids));
  const sel = (arr, cur) => arr.map(([v, l]) => h('option', { value: v, selected: v === cur }, l));
  const opts = h('div', { class: 'lab-opts' },
    opt('o-genre', 'genre', sel([['melodrama', 'melodrama'], ['farce', 'farce'], ['whodunit', 'whodunit'], ['gothic_romance', 'gothic'], ['pantomime', 'panto']], q.genre || 'farce')),
    opt('o-night', 'night', sel([0, 1, 2, 3, 4].map((n) => [String(n), String(n + 1)]), q.night ?? '1')),
    opt('o-pace', 'pace', sel([['1', 'show'], ['4', 'fast'], ['0', 'instant']], q.pace ?? '1')),
    h('label', null, 'draft sent back', h('input', { type: 'checkbox', id: 'o-revise', checked: q.revise === '1', onchange: () => { const nq = readOpts(); const cur = parseHash().view; setHash(cur, nq); show(cur, defaultParams(cur, nq), nq); } })),
    h('button', { onclick: () => { const nq = readOpts(); const cur = parseHash().view; show(cur, defaultParams(cur, nq), nq); } }, 'restart'));
  bar.append(h('strong', null, 'views-lab'), nav, opts, h('pre', { id: 'lab-log' }, ''));
  function readOpts() {
    return {
      genre: document.getElementById('o-genre').value,
      night: document.getElementById('o-night').value,
      pace: document.getElementById('o-pace').value,
      revise: document.getElementById('o-revise').checked ? '1' : '0',
    };
  }
  window.addEventListener('hashchange', () => { const x = parseHash(); show(x.view, defaultParams(x.view, x.q), x.q); });
  show(view, defaultParams(view, q), q);
}

// expose for scripted checks from the browser tools
window.__lab = { world, runFlow, performers };
