// promptbook: the Prompt Book drawer, bottom-right. The ONLY place in the game that talks about LangGraph.
// A mini live graph (active node lit from `tasks`), the thread id, and three light links: Studio (graph), Studio (this
// thread), and the LangSmith trace. Context-aware: it follows whichever graph is running (ctx.book), or the current view's graph.
import { h, svg } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { layoutGraph, groupsIn } from '../core/graphlayout.js';

const THREAD_LINK_TITLE = 'Open this thread in LangGraph Studio (the graph and the thread are selected for you)';
import * as ui from '../ui.js';

const STATUS = {
  idle: ['Waiting in the wings', 'info'],
  running: ['Running', 'ok'],
  paused: ['Paused for the Prompter', 'bad'],
  done: ['Finished', 'gold'],
};

export async function mount(root, ctx) {
  const book = ctx.book;
  const cache = new Map(); // graph id -> raw xray json | 'error'
  let chosen = null; // graph picked by hand in the select (cleared when a run starts)
  let lastRunGraph = null;
  let expanded = false;
  let open = false;
  let layout = null;
  let layoutKey = '';
  const nodeEls = new Map();
  const toggles = new Set();
  let linkSeq = 0;

  const graphSel = h('select', { class: 'input bk-select', 'aria-label': 'Graph', onchange: (e) => ((chosen = e.target.value), render(true)) });
  const statusEl = h('span');
  const nodeLine = h('div', { class: 'bk-nodeline small' });
  const graphBox = h('div', { class: 'bk-graph', tabindex: '0', 'aria-label': 'Live graph' });
  const recent = h('ol', { class: 'bk-recent small' });
  const threadEl = h('code', { class: 'bk-thread mono' }, '-');
  const copyHost = h('span');
  const linksHost = h('div', { class: 'bk-links' });
  const hint = h('p', { class: 'small bk-hint hand' });
  const blurb = h('p', { class: 'small bk-blurb muted' });
  const feats = h('div', { class: 'row gap-1 wrap' });
  const expandBtn = ui.button('Open subgraphs', { size: 'sm', variant: 'paper', icon: 'layers', onclick: () => ((expanded = !expanded), (expandBtn.querySelector('.btn-label').textContent = expanded ? 'Fold subgraphs' : 'Open subgraphs'), render(true)) });

  const drawer = h(
    'aside',
    { class: 'bk-drawer', role: 'dialog', 'aria-label': 'The Prompt Book', 'aria-modal': 'false', hidden: true },
    h('div', { class: 'bk-cover' }, h('div', { class: 'bk-title display' }, icon('book', 'lg'), h('span', null, 'The Prompt Book')), h('button', { class: 'bk-close', type: 'button', 'aria-label': 'Close the Prompt Book', onclick: () => api.close() }, icon('x'))),
    h(
      'div',
      { class: 'bk-pages' },
      h('p', { class: 'hand bk-lede' }, 'Everything the players do is a real LangGraph run. This is the page where you can watch it, and open it in Studio.'),
      h('div', { class: 'bk-row' }, h('label', { class: 'bk-label kicker', for: 'bk-graph-select' }, 'Graph'), graphSel),
      h('div', { class: 'bk-row between' }, statusEl, nodeLine),
      blurb,
      feats,
      h('div', { class: 'bk-graph-wrap' }, graphBox, h('div', { class: 'bk-graph-tools' }, expandBtn)),
      h('div', { class: 'bk-sec' }, h('div', { class: 'kicker' }, 'Recent steps'), recent),
      h('div', { class: 'bk-sec' }, h('div', { class: 'kicker' }, 'This thread'), h('div', { class: 'row gap-2' }, threadEl, copyHost)),
      h('div', { class: 'bk-sec' }, h('div', { class: 'kicker' }, 'Open it elsewhere'), linksHost, hint),
    ),
  );
  graphSel.id = 'bk-graph-select';
  root.append(drawer);

  const knownGraphs = () => (ctx.boot?.graphs?.length ? ctx.boot.graphs : Object.keys({ casting_call: 1, writers_room: 1, performance: 1, reviews: 1, almanac: 1, the_road: 1, playbill_press: 1, greenroom_chat: 1, rehearsal: 1 }).map((id) => ({ id, title: id })));
  const currentGraph = () => chosen || book.graph || book.viewGraph || 'performance';

  async function loadGraph(id) {
    if (cache.has(id)) return cache.get(id);
    try {
      const raw = await ctx.api.graph(id, true, { timeoutMs: 8000 });
      cache.set(id, raw);
    } catch {
      cache.set(id, 'error');
    }
    return cache.get(id);
  }

  function drawGraph(raw, graphId) {
    nodeEls.clear();
    if (!raw || raw === 'error') {
      graphBox.replaceChildren(h('div', { class: 'bk-empty small muted' }, raw === 'error' ? 'The graph could not be fetched. Is the server running?' : 'Loading the graph...'));
      expandBtn.hidden = true;
      return;
    }
    const groups = groupsIn(raw);
    expandBtn.hidden = !groups.length;
    layout = layoutGraph(raw, { collapsed: expanded ? [] : groups, direction: 'TB', charW: 6.4, nodeH: 28, gapX: 14, gapY: 28, margin: 14 });
    const W = layout.width;
    const H = layout.height;
    const root = svg('svg', { class: 'bk-svg', viewBox: `0 0 ${Math.max(W, 120)} ${H}`, width: Math.min(Math.max(W, 120), 380), role: 'img', 'aria-label': `${graphId} graph` });
    const defs = svg('defs', null, svg('marker', { id: 'bk-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', class: 'bk-arrowhead' })));
    root.append(defs);
    const g = svg('g', { transform: `translate(${layout.offsetX || 0},0)` });
    for (const grp of layout.groups) {
      g.append(svg('g', { class: 'bk-group' }, svg('rect', { x: grp.x, y: grp.y, width: grp.w, height: grp.h, rx: 8 }), svg('text', { x: grp.x + 8, y: grp.y + 11 }, grp.label)));
    }
    for (const e of layout.edges) g.append(svg('path', { d: e.path, class: ['bk-edge', e.conditional && 'cond', e.back && 'back'], 'marker-end': 'url(#bk-arrow)' }));
    for (const n of layout.nodes) {
      const ng = svg('g', { class: ['bk-node', `k-${n.kind}`], transform: `translate(${n.x},${n.y})`, 'data-id': n.id });
      ng.append(svg('rect', { width: n.w, height: n.h, rx: n.kind === 'start' || n.kind === 'end' ? n.h / 2 : 6 }), svg('text', { x: n.w / 2, y: n.h / 2 + 4, 'text-anchor': 'middle' }, n.label));
      if (n.count) ng.append(svg('text', { x: n.w - 6, y: 10, 'text-anchor': 'end', class: 'bk-count' }, `+${n.count}`));
      g.append(ng);
      nodeEls.set(n.id, { el: ng, node: n });
    }
    root.append(g);
    graphBox.replaceChildren(root);
    lightNodes();
  }

  /** A collapsed group is lit when any node inside it is. */
  function lightNodes() {
    const active = book.status === 'idle' || book.graph !== currentGraph() ? null : book.activeNode;
    const seen = book.graph === currentGraph() ? book.visited : new Set();
    for (const [id, { el, node }] of nodeEls) {
      const isGroup = node.kind === 'subgraph';
      const lit = active && (id === active || (isGroup && String(active).startsWith(`${id}:`)));
      const visited = [...seen].some((v) => v === id || (isGroup && String(v).startsWith(`${id}:`)));
      el.classList.toggle('lit', !!lit);
      el.classList.toggle('paused', !!lit && book.status === 'paused');
      el.classList.toggle('seen', visited && !lit);
    }
  }

  function paintStatus() {
    const viewing = book.graph === currentGraph();
    const st = viewing ? book.status : 'idle';
    const [label, tone] = STATUS[st] || STATUS.idle;
    statusEl.replaceChildren(ui.badge(label, tone, { icon: st === 'running' ? 'activity' : st === 'paused' ? 'ear' : st === 'done' ? 'check' : 'clock' }));
    nodeLine.textContent = viewing && book.activeNode ? `at ${book.activeNode.replace(/:/g, ' › ')}` : viewing && book.status === 'done' ? 'curtain call' : '';
    recent.replaceChildren(...(viewing ? [...book.recent].reverse().slice(0, 8) : []).map((r, i) => h('li', { class: i === 0 ? 'now' : '' }, h('span', { class: 'mono' }, r.id.replace(/:/g, ' › ')))));
    if (!recent.children.length) recent.append(h('li', { class: 'muted' }, 'Nothing yet. Start a scene and the steps will appear here.'));
    lightNodes();
  }

  function paintMeta() {
    const g = currentGraph();
    const meta = knownGraphs().find((x) => x.id === g);
    blurb.textContent = meta ? `${meta.title}: ${meta.blurb || ''}` : g;
    feats.replaceChildren(...(meta?.features || []).slice(0, 7).map((f) => ui.chip(f, { mono: false })));
    const tid = book.graph === g ? book.threadId : null;
    threadEl.textContent = tid || 'no thread yet';
    copyHost.replaceChildren(tid ? ui.copyButton(tid, 'Copy', { variant: 'paper' }) : h('span'));
    paintLinks(g, tid);
  }

  async function paintLinks(graph, tid) {
    const my = ++linkSeq;
    const studioG = ctx.links.studioGraph(graph);
    const studioT = tid ? ctx.links.studioThread(tid, graph) : null;
    const mk = (label, href, ic, enabled = true, title) => (enabled && href ? ui.button(label, { href, external: true, icon: ic, size: 'sm', variant: 'gold', title }) : ui.button(label, { icon: ic, size: 'sm', variant: 'paper', disabled: true, title }));
    linksHost.replaceChildren(mk('Open in LangGraph Studio', studioG, 'external'), mk('This thread in Studio', studioT, 'branch', !!tid, tid ? THREAD_LINK_TITLE : 'Run a scene first'), mk('View trace', null, 'activity', false, 'Looking...'));
    hint.textContent = '';
    const r = await ctx.links.resolve({ graph, threadId: tid });
    if (my !== linkSeq) return;
    linksHost.replaceChildren(mk('Open in LangGraph Studio', r.studio_graph || studioG, 'external'), mk('This thread in Studio', r.studio_thread || studioT, 'branch', !!tid, tid ? THREAD_LINK_TITLE : 'Run a scene first'), mk('View trace', r.trace, 'activity', !!r.trace, r.trace ? 'Open the LangSmith trace of this thread' : 'Tracing is off'));
    const traceHint = r.trace ? '' : /off|disabled|not enabled/i.test(r.trace_status || 'off') || r.trace_status === 'unavailable' || r.trace_status === 'unknown' ? 'Tracing is off. Start the server with `make dev TRACE=1` to get a trace link.' : r.trace_status;
    hint.textContent = traceHint;
  }

  async function render(force) {
    const g = currentGraph();
    graphSel.replaceChildren(...knownGraphs().map((x) => h('option', { value: x.id, selected: x.id === g }, `${x.title || x.id}  (${x.id})`)));
    graphSel.value = g;
    paintMeta();
    const key = `${g}|${expanded}`;
    if (force || key !== layoutKey) {
      layoutKey = key;
      drawGraph(null, g);
      const raw = await loadGraph(g);
      if (currentGraph() === g && layoutKey === key) drawGraph(raw, g);
    }
    paintStatus();
  }

  const unsub = book.subscribe(() => {
    if (book.graph && book.graph !== lastRunGraph) {
      lastRunGraph = book.graph;
      chosen = null; // a new run takes the book back to following the action
    }
    if (!open) return;
    if (`${currentGraph()}|${expanded}` !== layoutKey) render();
    else {
      paintStatus();
      if (book.status === 'running' || book.status === 'done') paintMeta();
    }
  });

  const api = {
    isOpen: () => open,
    onToggle: (fn) => (toggles.add(fn), () => toggles.delete(fn)),
    open() {
      if (open) return;
      open = true;
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('on'));
      render(true);
      toggles.forEach((f) => f(true));
    },
    close() {
      if (!open) return;
      open = false;
      drawer.classList.remove('on');
      const done = () => (drawer.hidden = !open);
      if (ui.prefersReducedMotion()) done();
      else setTimeout(done, 260);
      toggles.forEach((f) => f(false));
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    unmount() {
      unsub?.();
      drawer.remove();
    },
  };
  return api;
}
