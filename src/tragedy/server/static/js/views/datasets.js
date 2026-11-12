// datasets: "The Props Cupboard". Every dataset the game uses, as a drawer you can open, search and read.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { safeJson, truncate, formatNumber } from '../core/format.js';
import * as ui from '../ui.js';

const DRAWER_ICON = { performers: 'users', staff: 'mask', flaws: 'alert', mishaps: 'zap', whispers: 'ear', cues: 'bolt', genres: 'curtain', towns: 'map', tastes: 'heart', critics: 'quill', props: 'drawer', road_events: 'wagon', almanac_seeds: 'book', playbill: 'film', shows_gold: 'trophy' };
const PAGE = 200;

/** Columns for a table: scalar keys that most rows share, "id"/"name" first. Pure. */
export function columnsFor(rows, max = 6) {
  const counts = new Map();
  for (const r of rows.slice(0, 40)) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    for (const [k, v] of Object.entries(r)) if (v === null || typeof v !== 'object') counts.set(k, (counts.get(k) || 0) + 1);
  }
  const pri = ['id', 'name', 'title', 'kind', 'severity', 'text', 'blurb'];
  return [...counts.keys()].sort((a, b) => (pri.indexOf(a) < 0 ? 99 : pri.indexOf(a)) - (pri.indexOf(b) < 0 ? 99 : pri.indexOf(b)) || counts.get(b) - counts.get(a)).slice(0, max);
}

function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return truncate(JSON.stringify(v), 60);
  return truncate(String(v), 90);
}

/** Does a row match every word of the query anywhere in its JSON? Pure. */
export function rowMatches(row, query) {
  const q = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return true;
  const hay = (typeof row === 'string' ? row : JSON.stringify(row)).toLowerCase();
  return q.every((w) => hay.includes(w));
}

export async function mount(root, ctx) {
  let index = [];
  let current = ctx.params.sub || null;
  let page = null;
  let query = '';
  let mode = 'table';
  let selectedRow = null;
  const drawers = h('div', { class: 'cupboard-grid reveal' });
  const detail = h('div', { class: 'cupboard-detail' });
  const view = h('div', { class: 'cupboard' }, ui.pageHead({ kicker: 'Backstage', title: 'The Props Cupboard', sub: 'Everything the game is made of, in drawers. Open one.', actions: [ui.button('Back to the tour', { variant: 'ghost', icon: 'map', onclick: () => ctx.nav(ctx.tour ? 'tour' : 'title') })] }), drawers, detail);
  root.append(view);

  try {
    index = await ctx.api.datasets();
  } catch (e) {
    drawers.replaceChildren(ui.emptyState({ icon: 'drawer', title: 'The cupboard is locked', text: e.message }));
    return {};
  }

  function drawDrawers() {
    drawers.replaceChildren(
      ...index.map((d, i) => {
        const on = d.name === current;
        return h(
          'button',
          { class: ['drawer-card', on && 'on'], type: 'button', style: { '--i': i, '--tilt': `${((ui.hash32(d.name) % 7) - 3) * 0.35}deg` }, 'aria-pressed': String(on), onclick: () => open(d.name) },
          h('span', { class: 'drawer-front' }, h('span', { class: 'drawer-plate' }, h('span', { class: 'drawer-name display' }, d.name.replace(/_/g, ' ')), d.rows !== null && d.rows !== undefined && h('span', { class: 'drawer-count mono' }, formatNumber(d.rows))), h('span', { class: 'drawer-handle', 'aria-hidden': 'true' })),
          h('span', { class: 'drawer-body' }, icon(DRAWER_ICON[d.name] || 'drawer', 'lg'), h('span', { class: 'small hand' }, d.desc || '')),
        );
      }),
    );
  }

  async function open(name) {
    current = name;
    query = '';
    selectedRow = null;
    history.replaceState(null, '', `#/datasets/${encodeURIComponent(name)}`);
    drawDrawers();
    detail.replaceChildren(ui.card({ tone: 'paper', class: 'cd-card' }, h('div', { class: 'center' }, ui.spinner('Opening the drawer'))));
    try {
      page = await ctx.api.dataset(name, { offset: 0, limit: PAGE });
    } catch (e) {
      detail.replaceChildren(ui.card({ tone: 'paper' }, ui.emptyState({ icon: 'alert', title: 'The drawer is stuck', text: e.message })));
      return;
    }
    mode = page.object ? 'json' : 'table';
    drawDetail();
    detail.scrollIntoView?.({ behavior: ui.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function drawDetail() {
    const meta = index.find((d) => d.name === current) || {};
    const rows = page.rows || [];
    const filtered = rows.filter((r) => rowMatches(r, query));
    const search = ui.input({ type: 'search', placeholder: `Search ${current} ...`, value: query, 'aria-label': `Search ${current}`, oninput: (e) => ((query = e.target.value), refresh()) });
    const modeTabs = page.object
      ? null
      : h('div', { class: 'tabs', role: 'group', 'aria-label': 'View as' }, ...['table', 'json'].map((m) => h('button', { type: 'button', 'aria-pressed': String(mode === m), onclick: () => ((mode = m), drawDetail()) }, m === 'table' ? 'Table' : 'JSON')));
    const out = h('div', { class: 'cd-out' });
    const side = h('div', { class: 'cd-side' });

    function refresh() {
      const f = rows.filter((r) => rowMatches(r, query));
      count.textContent = page.object ? 'one document' : `${formatNumber(f.length)}${f.length !== rows.length ? ` of ${formatNumber(rows.length)}` : ''} rows${page.total > rows.length ? ` (first ${rows.length} of ${formatNumber(page.total)})` : ''}`;
      paintOut(f);
    }
    function paintOut(list) {
      if (page.object) {
        out.replaceChildren(h('pre', { class: 'codeblock' }, safeJson(page.object)));
        return;
      }
      if (!list.length) {
        out.replaceChildren(ui.emptyState({ icon: 'search', title: 'Nothing in this drawer matches', text: 'Try fewer words.' }));
        return;
      }
      if (mode === 'json') {
        out.replaceChildren(h('pre', { class: 'codeblock' }, safeJson(list)));
        return;
      }
      const cols = columnsFor(list);
      out.replaceChildren(
        h(
          'div',
          { class: 'table-wrap' },
          h('table', { class: 'table' }, h('thead', null, h('tr', null, ...(cols.length ? cols : ['value']).map((c) => h('th', null, c)))), h('tbody', null, ...list.slice(0, 400).map((r, i) => h('tr', { class: selectedRow === r ? 'sel' : '', tabindex: 0, onclick: () => pick(r), onkeydown: (e) => e.key === 'Enter' && pick(r), 'data-i': i }, ...(cols.length ? cols : ['value']).map((c) => h('td', { title: typeof r?.[c] === 'string' ? r[c] : undefined }, cols.length ? cell(r?.[c]) : cell(r))))))),
        ),
      );
    }
    function pick(r) {
      selectedRow = selectedRow === r ? null : r;
      side.replaceChildren(...(selectedRow ? [h('div', { class: 'row between' }, h('div', { class: 'kicker' }, 'Row'), ui.copyButton(() => safeJson(selectedRow), 'Copy JSON', { variant: 'paper' })), h('pre', { class: 'codeblock' }, safeJson(selectedRow))] : []));
      out.querySelectorAll('tbody tr').forEach((tr) => tr.classList.toggle('sel', false));
      if (selectedRow) {
        const i = filtered.indexOf(selectedRow);
        void i;
      }
      side.classList.toggle('on', !!selectedRow);
      paintOut(rows.filter((x) => rowMatches(x, query)));
    }
    const count = h('span', { class: 'small muted' });

    detail.replaceChildren(
      ui.card(
        { tone: 'paper', class: 'cd-card' },
        h('div', { class: 'cd-head' }, h('div', { class: 'grow' }, h('div', { class: 'kicker' }, 'Drawer'), h('h2', { class: 'display' }, current.replace(/_/g, ' ')), h('p', { class: 'hand muted' }, meta.desc || '')), h('div', { class: 'row gap-2 wrap' }, modeTabs, ui.copyButton(() => safeJson(page.object ?? rows), 'Copy all', { variant: 'paper' }))),
        h('div', { class: 'cd-bar row gap-3 wrap' }, !page.object && h('div', { class: 'grow cd-search' }, search), count),
        h('div', { class: 'cd-split' }, out, side),
      ),
    );
    refresh();
    void filtered;
  }

  drawDrawers();
  if (current && index.some((d) => d.name === current)) await open(current);
  return {};
}
