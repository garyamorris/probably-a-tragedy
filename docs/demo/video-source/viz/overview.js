// overview.js: a grid of all nine REAL graphs (structure from GET /assistants/{id}/graph?xray=true).
import { loadAssistants, buildGraph, createView } from './lg.js';
const ORDER = ['casting_call', 'writers_room', 'rehearsal', 'performance', 'reviews', 'almanac', 'playbill_press', 'the_road', 'greenroom_chat'];
// thumbnail tweaks for the two busiest graphs (structure is unchanged, only spacing)
const OV = { performance: { font: 10.5, padX: 4, rows: [6, 5], minGap: 8, minGapSingle: 8, minW: 20 }, writers_room: { nodeH: 22, vgap: 6, rows: [5, 4], order: ['revise', 'pick_draft'] } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__done = false; window.__captions = [];
const mark = (n, d) => { try { if (window.rec && window.rec.mark) window.rec.mark(n, d); } catch (e) { /* */ } };
const t0 = performance.now();
const NSV = 'http://www.w3.org/2000/svg';
// real node names can be very long (middleware): shorten for the thumbnail only
const shorten = (s) => s.replace(/Middleware/g, '').replace('ModelCallLimit', 'ModelLimit').replace('ToolCallLimit', 'ToolLimit').replace('PropReview', 'PropReview');

(async function () {
  const A = await loadAssistants();
  const grid = document.getElementById('grid');
  const cards = [];
  for (const gid of ORDER) {
    const a = A[gid];
    if (!a) continue;
    const card = document.createElement('div');
    card.className = 'gc';
    const full = a.description || '';
    const m = /^(?:[A-Z ]+: )?(.*?)(?:\s*\(([^)]*)\))?\s*$/.exec(full) || [];
    const desc = (m[1] || full).replace(/^THE SHOW: /, '');
    const feat = m[2] || '';
    card.innerHTML = `<div class="t"><span class="id">${gid}</span><span class="aid">${a.id.slice(0, 8)}…</span></div><div class="d">${desc}</div><svg class="pre"></svg>`;
    grid.appendChild(card);
    const svg = card.querySelector('svg');
    const G = await buildGraph(gid, A, {
      hints: false, W: 372, H: 120, marginX: 4, font: 13, nodeH: 24, padX: 7, minW: 34, termDot: 12, vgap: 8, minGap: 16, maxGap: 34, minGapSingle: 22, twoLine: 16,
      aboveMin: 4, groupTop: 14, groupBottom: 7, groupPadX: 8, tabH: 15, k: 0.42, rowGapMin: 10, nodeStroke: 2,
      ...(OV[gid] || {}),
    }, { shorten });
    G.opt.arrow = 10;
    const V = createView(svg, G, { groupFont: 11.5, edgeW: 1.8, arrow: 9 });
    card._V = V; card._G = G;
    cards.push(card);
  }
  window.__graphs = cards.map((c) => ({ id: c._G.id, nodes: c._G.nodes.size, edges: c._G.edges.length, rows: c._G.rowsSpec, overflow: c._G.size.overflow, dropped: c._G.dropped }));
  await sleep(500);
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    c.classList.add('in', 'lit');
    mark('card', { id: c._G.id });
    window.__captions.push({ t: +((performance.now() - t0) / 1000).toFixed(2), at: 'card', text: c._G.id });
    await sleep(160);
    const svg = c.querySelector('svg');
    // nodes pop in by layer, then the edges
    const nodes = [...svg.querySelectorAll('.node')];
    svg.classList.remove('pre');
    nodes.forEach((n) => (n.style.opacity = 0));
    svg.querySelectorAll('.edge, .group-box').forEach((n) => (n.style.opacity = 0));
    nodes.forEach((n, k) => setTimeout(() => (n.style.opacity = 1), k * 55));
    setTimeout(() => svg.querySelectorAll('.edge, .group-box').forEach((n) => (n.style.opacity = 1)), nodes.length * 55 + 120);
    // light the nodes green in flow order for a moment (structure only, no data)
    await sleep(860);
  }
  await sleep(1800);
  window.__done = true;
})();
