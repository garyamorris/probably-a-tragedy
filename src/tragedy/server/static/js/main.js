// main.js: app bootstrap. Hash router, lazy views, the shared `ctx`, the persistent HUD and the Prompt Book button.
//
// ── ctx (what every view's mount(root, ctx) receives; ONE shared object, read fields at use time) ───────────────
//   ctx.api            js/api.js `api` wrappers (api.tour, api.datasets, api.graph, ...) ; ctx.paths = endpoint table
//   ctx.runFlow(opts)  js/run.js runFlow (PROTOCOL 7.1)            ; ctx.runEvents = bus ('start','node','interrupt','end', ...)
//   ctx.signal         AbortSignal aborted when THIS view unmounts: pass it to runFlow({signal}) so leaving cancels the stream
//   ctx.tour           current tour state (Store `("tour", id)/state`) or null.      ctx.refreshTour() -> Promise<tour> (also updates the HUD)
//   ctx.night          tour.night (0-4)                                              ctx.town  current town row (or null)
//   ctx.nav(view, carry?)  go to #/view ; `carry` (plain JSON) is merged into ctx.params for the rest of the night
//   ctx.params         {...carried outputs (cast, script, result, stars, headline, ...), genre, town, ...hash query, sub}
//   ctx.carry(obj)     merge into the carry without navigating                       ctx.clearCarry()
//   ctx.require(keys, fallbackView) -> bool   true when ctx.params has all keys; otherwise toasts and navigates to fallbackView
//   ctx.inputBase(extra?) -> {tour_id, night, seed, genre, town, ...extra}   the common graph input keys
//   ctx.toast(msg|opts)  ctx.ui (js/ui.js namespace)  ctx.links {studioBase(), studioGraph(g), studioThread(tid, g), resolve({graph, threadId})}
//   ctx.data           cached datasets {performers, staff, flaws, cues, genres, towns, tastes, critics, props, whispers} (arrays)
//                      + helpers ctx.data.performer(id) .staffer(id) .person(id) .town(id) .genre(id) .cue(id) .critic(id) .byId[name][id]
//   ctx.loadData(names?) -> Promise<ctx.data>  (already awaited before any non-title view mounts)
//   ctx.boot           GET /api/boot payload (graph catalogue, provider, tracing, studio) or null
//   ctx.startTour(seed?) -> tour   ctx.continueTour() -> tour|null   ctx.forgetTour()
//   ctx.book           Prompt Book state {graph, threadId, status:'idle'|'running'|'paused'|'done', activeNode, visited:Set, recent:[]}
//                      with ctx.book.subscribe(fn) ; ctx.openPromptBook()
//   ctx.mock           '' | 'force' | 'fallback'
//   ctx.hud            {pulse(kind)}  flash a HUD counter ('funds'|'encore'|'candles'|'stars')
//
// View contract (PROTOCOL 7.3): js/views/<name>.js exports `async function mount(root, ctx)` -> {unmount(){}}.

import { h, mount as mountEl, clear } from './core/dom.js';
import { icon, logo } from './core/icons.js';
import { parseHash, matchRoute, buildHash } from './core/router.js';
import { lsGet, lsSet, lsRemove, createEmitter } from './core/store.js';
import * as ui from './ui.js';
import { api, paths, makeLinks, mockMode, ensureMock } from './api.js';
import { runFlow, runEvents } from './run.js';
import { autopilotStep, AUTOPILOT_VIEWS } from './autopilot.js';
import { defaultGenreId } from './views/_kit/pure.js';

const qs = new URLSearchParams(location.search);

export const VIEWS = ['title', 'tour', 'casting', 'writers', 'rehearsal', 'show', 'reviews', 'almanac', 'playbill', 'road', 'greenroom', 'datasets'];
const VIEW_TITLES = {
  title: 'Probably a Tragedy', tour: 'The Tour', casting: 'Casting Call', writers: "The Writers' Room", rehearsal: 'Rehearsal', show: 'The Show', reviews: 'The Reviews',
  almanac: 'The Almanac', playbill: 'The Playbill', road: 'The Road', greenroom: 'The Greenroom', datasets: 'The Props Cupboard',
};
/** The graph each view is about (the Prompt Book follows it when nothing is running). */
export const VIEW_GRAPH = { casting: 'casting_call', writers: 'writers_room', rehearsal: 'rehearsal', show: 'performance', reviews: 'reviews', almanac: 'almanac', playbill: 'playbill_press', road: 'the_road', greenroom: 'greenroom_chat' };
const NO_TOUR_OK = new Set(['title', 'datasets']);
const DATA_NAMES = ['performers', 'staff', 'flaws', 'cues', 'genres', 'towns', 'tastes', 'critics', 'props', 'whispers'];
const ROUTES = [
  { pattern: '/', view: 'title' },
  { pattern: '/:view', view: null },
  { pattern: '/:view/:sub', view: null },
];

// ---------------------------------------------------------------------------------------------------------------
// state + ctx

const bookEmitter = createEmitter();
const book = {
  graph: null,
  threadId: null,
  status: 'idle',
  activeNode: null,
  visited: new Set(),
  recent: [],
  viewGraph: null,
  subscribe: (fn) => bookEmitter.on('change', fn),
  _emit: () => bookEmitter.emit('change', book),
};

const ctx = {
  api,
  paths,
  runFlow,
  runEvents,
  ui,
  toast: (m, o) => ui.toast(m, o),
  links: makeLinks(() => ctx.boot),
  boot: null,
  tour: null,
  night: 0,
  town: null,
  params: {},
  route: { view: 'title', segments: [], query: {} },
  data: emptyData(),
  signal: null,
  book,
  mock: mockMode(),
  hud: { pulse: () => {} },
  async refreshTour() {
    if (!ctx.tour?.id) return null;
    try {
      setTour(await api.tour(ctx.tour.id));
    } catch (e) {
      ui.toast({ title: 'Could not refresh the tour', body: e.message, tone: 'danger' });
    }
    return ctx.tour;
  },
  nav,
  carry(obj) {
    Object.assign(flow, obj || {});
    saveFlow();
    ctx.params = computeParams();
  },
  clearCarry() {
    for (const k of Object.keys(flow)) delete flow[k];
    saveFlow();
    ctx.params = computeParams();
  },
  require(keys, fallback = 'tour') {
    const missing = keys.filter((k) => ctx.params[k] === undefined || ctx.params[k] === null);
    if (!missing.length) return true;
    ui.toast({ title: 'One step at a time', body: `We still need: ${missing.join(', ')}.`, tone: 'accent' });
    queueMicrotask(() => nav(fallback));
    return false;
  },
  inputBase(extra = {}) {
    const t = ctx.tour || {};
    return { tour_id: t.id, night: t.night ?? 0, seed: t.seed, genre: ctx.params.genre, town: ctx.params.town || t.towns?.[t.night ?? 0], ...extra };
  },
  loadData,
  startTour,
  continueTour,
  forgetTour,
  openPromptBook: () => openBook(true),
};
export { ctx };
window.tragedy = ctx; // debugging handle

function emptyData() {
  const d = { byId: {} };
  for (const n of DATA_NAMES) {
    d[n] = [];
    d.byId[n] = {};
  }
  const by = (name) => (id) => d.byId[name]?.[id] ?? null;
  d.performer = by('performers');
  d.staffer = by('staff');
  d.town = by('towns');
  d.genre = by('genres');
  d.cue = by('cues');
  d.critic = by('critics');
  d.person = (id) => d.byId.performers[id] ?? d.byId.staff[id] ?? null;
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// carry (outputs flowing from step to step within a night)

const flow = {};
const flowKey = () => `flow:${ctx.tour?.id || 'none'}`;
function loadFlow() {
  for (const k of Object.keys(flow)) delete flow[k];
  const saved = lsGet(flowKey(), null);
  if (saved && saved.night === (ctx.tour?.night ?? 0)) Object.assign(flow, saved.data || {});
}
function saveFlow() {
  lsSet(flowKey(), { night: ctx.tour?.night ?? 0, data: flow });
}

function defaultGenre() {
  const t = ctx.tour || {};
  const town = ctx.data.town?.(t.towns?.[t.night ?? 0]);
  return defaultGenreId(ctx.data.genres, town, ui.hash32(`${t.seed}:${t.night}`));
}

function computeParams() {
  const t = ctx.tour || {};
  const q = ctx.route?.query || {};
  return {
    ...flow,
    genre: flow.genre || defaultGenre(),
    town: flow.town || t.towns?.[t.night ?? 0],
    ...q,
    sub: ctx.route?.segments?.[1],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// tour

function setTour(tour) {
  const prev = ctx.tour;
  ctx.tour = tour;
  ctx.night = tour?.night ?? 0;
  ctx.town = tour ? ctx.data.town(tour.towns?.[ctx.night]) : null;
  if (tour?.id) lsSet('tour_id', tour.id);
  if (!prev || prev.id !== tour?.id || prev.night !== tour?.night) loadFlow();
  ctx.params = computeParams();
  renderHud(prev);
}

async function startTour(seed) {
  const t = await api.createTour(seed);
  ctx.clearCarry();
  lsRemove(`flow:${t.id}`);
  await loadData();
  setTour(t);
  loadFlow();
  return t;
}

async function continueTour() {
  const id = lsGet('tour_id', null);
  if (!id) return null;
  try {
    const t = await api.tour(id);
    await loadData();
    setTour(t);
    return t;
  } catch {
    lsRemove('tour_id');
    return null;
  }
}

function forgetTour() {
  lsRemove('tour_id');
  ctx.tour = null;
  ctx.town = null;
  ctx.night = 0;
  ctx.clearCarry();
  renderHud();
}

// ---------------------------------------------------------------------------------------------------------------
// datasets

let dataPromise = null;
const failedData = new Set();
async function loadData(names = DATA_NAMES) {
  const todo = names.filter((n) => !failedData.has(n) && (!ctx.data.byId[n] || !ctx.data[n].length));
  if (!todo.length && dataPromise) return dataPromise;
  dataPromise = (async () => {
    await Promise.all(
      todo.map(async (name) => {
        try {
          const page = await api.dataset(name, { offset: 0, limit: 500 });
          const rows = page.rows.length ? page.rows : [];
          ctx.data[name] = rows;
          ctx.data.byId[name] = Object.fromEntries(rows.filter((r) => r && r.id !== undefined).map((r) => [r.id, r]));
          if (name === 'whispers') ctx.data.byId.whispers = Object.fromEntries(rows.map((r) => [r.kind, r]));
        } catch (e) {
          console.warn(`dataset ${name} unavailable`, e.message);
          failedData.add(name);
          ctx.data[name] = ctx.data[name] || [];
          ctx.data.byId[name] = ctx.data.byId[name] || {};
        }
      }),
    );
    if (ctx.tour) {
      ctx.town = ctx.data.town(ctx.tour.towns?.[ctx.night]);
      ctx.params = computeParams();
    }
    return ctx.data;
  })();
  return dataPromise;
}

// ---------------------------------------------------------------------------------------------------------------
// HUD

const hudEls = {};
function buildShell() {
  const app = document.getElementById('app');
  hudEls.funds = h('span', { class: 'v' }, '0');
  hudEls.encore = h('span', { class: 'v' }, '0');
  hudEls.candles = h('span', { class: 'v' }, '0');
  hudEls.starsV = h('span', { class: 'v' }, '0');
  hudEls.starsBar = h('i');
  hudEls.pips = ui.progressPips(5, 0, { label: 'Night' });
  hudEls.tourName = h('span', { class: 'hud-tour-name' }, '');
  const stat = (kind, ic, title, ...kids) => (hudEls[kind + 'Box'] = h('span', { class: ['hud-stat', kind], title }, icon(ic, 'fill'), ...kids));
  hudEls.tour = h('div', { class: 'hud-tour', hidden: true }, hudEls.tourName, hudEls.pips);
  hudEls.stats = h(
    'div',
    { class: 'hud-stats', hidden: true, 'aria-label': 'Tour status' },
    ctx.mock && h('span', { class: 'hud-mock', title: 'Simulated puppets: no server needed' }, ctx.mock === 'fallback' ? 'MOCK FALLBACK' : 'MOCK'),
    stat('coin', 'coin', 'Funds: buy props and pay the wagon', hudEls.funds),
    stat('ticket', 'ticket', 'Encore tokens: each one buys a "Take it from the top" rewind', hudEls.encore),
    stat('candle', 'candle', 'Candles: each one buys a dress rehearsal', hudEls.candles),
    (hudEls.starsBox = h('span', { class: 'hud-stat stars', title: 'Stars earned this tour. 15 is a critical triumph.' }, icon('star', 'fill'), hudEls.starsV, h('span', { class: 'hud-goal' }, '/ 15'), h('span', { class: 'hud-meter' }, hudEls.starsBar))),
  );
  const bar = h('header', { class: 'hud', role: 'banner' }, h('a', { class: 'hud-brand', href: '#/', 'aria-label': 'Probably a Tragedy: title screen' }, logo(), h('span', { class: 'hud-brand-name' }, 'Probably a Tragedy')), hudEls.tour, h('div', { class: 'hud-spacer' }), hudEls.stats);
  const mainEl = h('main', { class: 'stage-main', id: 'main', tabindex: '-1' });
  hudEls.bookBtn = h(
    'button',
    { class: 'bk-button', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'The Prompt Book: what the theatre is doing, and the way into LangGraph Studio', onclick: () => openBook() },
    icon('book'),
    h('span', { class: 'bk-label' }, 'Prompt Book'),
    h('span', { class: 'bk-live' }),
  );
  hudEls.bookHost = h('div', { id: 'prompt-book-host' });
  mountEl(app, bar, mainEl, hudEls.bookBtn, hudEls.bookHost);
  app.removeAttribute('aria-busy');
  ui.initToasts();
  ctx.hud.pulse = (kind) => {
    const box = hudEls[kind + 'Box'] || hudEls[{ funds: 'coinBox', encore: 'ticketBox', candles: 'candleBox', stars: 'starsBox' }[kind]];
    if (!box) return;
    box.classList.remove('bump');
    void box.offsetWidth;
    box.classList.add('bump');
  };
  return mainEl;
}

const starTotal = (t) => (t?.history || []).reduce((a, n) => a + (Number(n.stars) || 0), 0);

function renderHud(prev) {
  if (!hudEls.tour) return;
  const t = ctx.tour;
  hudEls.tour.hidden = !t;
  hudEls.stats.hidden = !t;
  if (!t) return;
  const first = ctx.data.town(t.towns?.[0]);
  const word = (first?.name || 'Wibbling').split(/[-\s]/)[0];
  hudEls.tourName.textContent = `The ${word} Tour · seed ${t.seed}`;
  const done = t.status && t.status !== 'active' ? 5 : Math.min(4, t.night ?? 0);
  hudEls.pips.set(t.status && t.status !== 'active' ? 5 : done);
  hudEls.pips.setAttribute('aria-label', `Night ${Math.min(5, done + 1)} of 5`);
  [...hudEls.pips.children].forEach((p, i) => (p.title = `Night ${i + 1}: ${ctx.data.town(t.towns?.[i])?.name || t.towns?.[i] || ''}`));
  const total = starTotal(t);
  const set = (el, value, kind, digits = 0) => {
    const before = prev ? { funds: prev.funds, encore: prev.encore, candles: prev.candles, stars: starTotal(prev) }[kind] : null;
    if (before !== null && before !== undefined && before !== value) {
      ui.tweenText(el, value, { from: before, ms: 700, digits });
      ctx.hud.pulse(kind);
    } else el.textContent = ui.fmt.formatNumber(value, digits);
  };
  set(hudEls.funds, t.funds ?? 0, 'funds');
  set(hudEls.encore, t.encore ?? 0, 'encore');
  set(hudEls.candles, t.candles ?? 0, 'candles');
  set(hudEls.starsV, total, 'stars', total % 1 ? 1 : 0);
  hudEls.starsBar.style.width = `${Math.min(100, (total / ui.TARGET_STARS) * 100)}%`;
}

// ---------------------------------------------------------------------------------------------------------------
// Prompt Book (state is tracked here from the first run on; the drawer module is loaded on first open)

runEvents.on('start', ({ graph, threadId }) => {
  book.graph = graph;
  book.threadId = threadId;
  book.status = 'running';
  book.activeNode = null;
  book.visited = new Set();
  book.recent = [];
  paintBookBtn();
  book._emit();
});
runEvents.on('node', ({ id, node, phase, ns, interrupted }) => {
  if (phase === 'start') {
    book.activeNode = id;
    book.visited.add(id);
    for (let i = 1; i <= ns.length; i++) book.visited.add(ns.slice(0, i).join(':'));
    book.recent.push({ id, node, at: Date.now() });
    if (book.recent.length > 14) book.recent.shift();
  } else if (book.activeNode === id && !interrupted) book.activeNode = null;
  paintBookBtn();
  book._emit();
});
runEvents.on('interrupt', () => {
  book.status = 'paused';
  paintBookBtn();
  book._emit();
});
runEvents.on('resume', () => {
  book.status = 'running';
  paintBookBtn();
  book._emit();
});
const REFRESH_AFTER = new Set(['reviews', 'almanac', 'greenroom_chat']);
runEvents.on('end', ({ ok, graph }) => {
  if (ok && REFRESH_AFTER.has(graph) && ctx.tour?.id) ctx.refreshTour();
  book.status = ok ? 'done' : 'idle';
  book.activeNode = null;
  paintBookBtn();
  book._emit();
});
function paintBookBtn() {
  hudEls.bookBtn?.classList.toggle('running', book.status === 'running');
  hudEls.bookBtn?.classList.toggle('paused', book.status === 'paused');
}

let bookCtl = null;
let bookLoading = null;
async function openBook(forceOpen) {
  if (!bookCtl) {
    bookLoading ||= import('./views/promptbook.js').then((m) => m.mount(hudEls.bookHost, ctx));
    try {
      bookCtl = await bookLoading;
    } catch (e) {
      bookLoading = null;
      console.error(e);
      ui.toast({ title: 'The Prompt Book is stuck shut', body: e.message, tone: 'danger' });
      return;
    }
    bookCtl.onToggle?.((open) => hudEls.bookBtn.setAttribute('aria-expanded', String(open)));
  }
  if (forceOpen) bookCtl.open();
  else bookCtl.toggle();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && bookCtl?.isOpen?.() && !document.querySelector('.modal-scrim')) bookCtl.close();
});

// ---------------------------------------------------------------------------------------------------------------
// router

let current = null; // {view, unmount, abort}
let routeSeq = 0;
const moduleCache = new Map();

export function nav(view, carry) {
  if (carry && typeof carry === 'object') {
    if (view === 'tour' || view === 'title') ctx.clearCarry();
    ctx.carry(carry);
  } else if (view === 'tour' || view === 'title') ctx.clearCarry();
  const target = buildHash(`/${view}`);
  if (location.hash === target) renderRoute();
  else location.hash = target;
}

function loadViewModule(name) {
  if (!moduleCache.has(name)) moduleCache.set(name, import(`./views/${name}.js`));
  return moduleCache.get(name);
}

async function viewFileExists(name) {
  try {
    const res = await fetch(new URL(`./views/${name}.js`, import.meta.url), { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function renderRoute() {
  const parsed = parseHash(location.hash);
  const m = matchRoute(ROUTES, parsed);
  const seq = ++routeSeq;
  const mainEl = document.getElementById('main');
  if (current) {
    try {
      current.abort.abort();
      await current.unmount?.();
    } catch (e) {
      console.error('unmount failed', e);
    }
    current = null;
  }
  ui.closeAllModals();
  const view = m?.route.view || m?.params.view || 'title';
  ctx.route = { view, segments: parsed.segments, query: parsed.query, path: parsed.path };
  ctx.params = computeParams();
  book.viewGraph = VIEW_GRAPH[view] || null;
  book._emit();

  const root = h('div', { class: ['view', view === 'show' && 'view-wide', view === 'title' && 'view-title'] });
  mountEl(mainEl, root);
  window.scrollTo({ top: 0 });
  document.title = `${VIEW_TITLES[view] || 'Probably a Tragedy'} · Probably a Tragedy`;
  document.body.dataset.view = view;

  if (!VIEWS.includes(view)) {
    root.classList.add('view-narrow');
    mountEl(root, ui.emptyState({ icon: 'door', title: 'No such door backstage', text: `There is nothing at "${parsed.path}".`, action: ui.button('Back to the tour', { variant: 'primary', onclick: () => nav(ctx.tour ? 'tour' : 'title') }) }));
    return;
  }
  if (!NO_TOUR_OK.has(view) && !ctx.tour) {
    const t = await continueTour();
    if (seq !== routeSeq) return;
    if (!t) {
      ui.toast({ title: 'No tour yet', body: 'Start a new tour first.', tone: 'accent' });
      nav('title');
      return;
    }
    ctx.params = computeParams();
  }
  if (view !== 'title') {
    root.classList.add('view-narrow');
    mountEl(root, ui.curtainLoader('Setting the stage...'));
    await loadData();
    if (seq !== routeSeq) return;
    if (view === 'tour' && ctx.tour) await ctx.refreshTour(); // the map must show what the road and the critics just did
    if (seq !== routeSeq) return;
    ctx.town = ctx.tour ? ctx.data.town(ctx.tour.towns?.[ctx.night]) : null;
    ctx.params = computeParams();
    renderHud(null);
  }

  const abort = new AbortController();
  current = { view, abort, unmount: null };
  ctx.signal = abort.signal;
  clear(root);
  root.classList.remove('view-narrow');
  let handle;
  try {
    const mod = await loadViewModule(view);
    if (seq !== routeSeq) return;
    handle = await mod.mount(root, ctx);
  } catch (err) {
    moduleCache.delete(view);
    if (seq !== routeSeq) return;
    const missing = err instanceof TypeError && /dynamically imported|Failed to fetch|import/i.test(String(err.message)) && !(await viewFileExists(view));
    clear(root);
    if (missing) renderPlaceholder(root, view);
    else {
      console.error(`view "${view}" failed`, err);
      root.classList.add('view-narrow');
      mountEl(root, ui.emptyState({ icon: 'alert', title: 'A prop fell off the stage', text: `${view}: ${err?.message || err}`, action: ui.button('Try again', { variant: 'primary', onclick: () => renderRoute() }) }));
    }
    handle = null;
  }
  if (seq !== routeSeq) {
    try {
      await handle?.unmount?.();
    } catch {
      /* gone */
    }
    return;
  }
  current.unmount = handle?.unmount ? () => handle.unmount() : null;
  if (view !== 'title') mainEl.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------------------------------------------
// placeholder for a view that has not been written yet

const PLACEHOLDER_BLURB = {
  casting: 'The auditions are still being held in a very small cupboard.',
  writers: 'The three herons are arguing about who gets the first line.',
  rehearsal: 'The puppets are rehearsing in the dark. Quietly.',
  reviews: 'The pigeons have not yet decided what to think.',
  almanac: 'The Almanac of Calamities is at the binders.',
  playbill: 'The press is warming up. It smells of ink and goose.',
  road: 'The wagon is waiting for a wheel.',
  greenroom: 'Backstage, someone has locked the door and lost the key.',
};

function renderPlaceholder(root, view) {
  const status = h('div', { class: 'ph-status hand', 'aria-live': 'polite' }, '');
  const log = h('ul', { class: 'ph-log small' });
  const playable = AUTOPILOT_VIEWS.includes(view);
  const btn = ui.button(playable ? 'Let the stagehands do this step' : 'Back to the tour', {
    variant: playable ? 'gold' : 'primary',
    size: 'lg',
    icon: playable ? 'sparkle' : 'map',
    onclick: async () => {
      if (!playable) return nav('tour');
      btn.disabled = true;
      status.textContent = 'The stagehands roll up their sleeves...';
      try {
        const { next, carry } = await autopilotStep(view, ctx, {
          signal: ctx.signal,
          onEvent: (ev) => {
            status.textContent = ev.kind;
            if (log.children.length > 6) log.firstChild.remove();
            log.append(h('li', null, `${ev.kind}${ev.data?.text ? ': ' + ui.fmt.truncate(ev.data.text, 70) : ''}`));
          },
        });
        nav(next, carry);
      } catch (e) {
        if (e.name === 'AbortError') return;
        status.textContent = '';
        btn.disabled = false;
        ui.toast({ title: 'The stagehands tripped', body: e.message, tone: 'danger' });
      }
    },
  });
  root.classList.add('view-narrow');
  mountEl(
    root,
    h(
      'div',
      { class: 'ph-wrap' },
      ui.card(
        { tone: 'paper', tilt: 'l', class: 'ph-card pinned' },
        h('div', { class: 'ph-easel' }, icon('curtain', 'xl')),
        h('div', { class: 'kicker' }, VIEW_TITLES[view] || view),
        h('h2', { class: 'display ph-title' }, 'This curtain is still being painted'),
        h('p', { class: 'hand ph-blurb' }, PLACEHOLDER_BLURB[view] || 'The scenery department has asked for a little more time.'),
        h('p', { class: 'small muted' }, `The "${view}" scene has not been delivered yet. The show can go on anyway: the stagehands can play this step with sensible choices, using the real graph.`),
        h('div', { class: 'row gap-3 wrap' }, btn, playable && ui.button('Back to the tour', { variant: 'ghost', onclick: () => nav('tour') })),
        status,
        log,
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// boot

async function boot() {
  if (ctx.mock) await ensureMock();
  buildShell();
  renderHud();
  try {
    ctx.boot = await api.boot();
  } catch (e) {
    ctx.boot = null;
    console.warn('boot failed', e.message);
    setTimeout(() => ui.toast({ title: 'The theatre is dark', body: ctx.mock ? e.message : 'Cannot reach the server. Add ?mock=1 to the address to play with the offline puppets.', tone: 'danger', ttl: 9000 }), 400);
  }
  if (lsGet('tour_id', null)) {
    await continueTour();
  }
  window.addEventListener('hashchange', renderRoute);
  await renderRoute();
}

boot();
