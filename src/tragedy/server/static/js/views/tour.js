// tour: the painted map of five towns, the star-progress meter, tonight's genre, and the end-of-tour verdict.
import { h, svg } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { lsGet, lsSet } from '../core/store.js';
import * as ui from '../ui.js';
import { townDisc, SKIES } from '../core/glyphs.js';
import * as P from './_kit/pure.js';

const GOAL = ui.TARGET_STARS;

/** Positions of the five towns for a landscape or portrait map. Pure. */
export function mapLayout(portrait) {
  if (portrait) {
    return { w: 420, h: 900, pts: [{ x: 120, y: 120 }, { x: 300, y: 290 }, { x: 120, y: 460 }, { x: 300, y: 630 }, { x: 150, y: 790 }] };
  }
  return { w: 1000, h: 440, pts: [{ x: 110, y: 290 }, { x: 300, y: 150 }, { x: 500, y: 290 }, { x: 700, y: 150 }, { x: 890, y: 280 }] };
}

/** Smooth Catmull-Rom path through points (as cubic Beziers). */
export function smoothThrough(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x} ${p2.y}`;
  }
  return d;
}

const VERDICTS = {
  triumph: { title: 'A Critical Triumph', sub: 'The pigeons are weeping. The goose has been given a small chair.', tone: 'gold', stamp: 'TRIUMPH' },
  respectable: { title: 'A Respectable Run', sub: 'Nobody was hurt. Mostly the scenery. The wagon rolls on.', tone: 'paper', stamp: 'RESPECTABLE' },
  tragedy: { title: 'A Tragedy (Probably)', sub: 'It was, technically, what the name promised. The audience has sent flowers. And a bill.', tone: 'plum', stamp: 'TRAGEDY' },
};

function starsRow(stars, x, y, size = 15) {
  const g = svg('g', { transform: `translate(${x},${y})`, class: 'map-stars' });
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  const total = 5;
  const w = size + 2;
  for (let i = 0; i < total; i++) {
    const s = svg('path', { d: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.1 6.6 20l1.1-6.1L3.2 9.7l6.1-.8z', transform: `translate(${(i - total / 2) * w},0) scale(${size / 24})`, class: i < full ? 'ms on' : i === full && half ? 'ms half' : 'ms off' });
    g.append(s);
  }
  return g;
}

export async function mount(root, ctx) {
  const tour = ctx.tour;
  const towns = (tour.towns || []).map((id) => ctx.data.town(id) || { id, name: id, sky: 'noon', landmark: 'windmill', blurb: '', gossip: '', temperament: { likes: [], hates: [] } });
  const history = tour.history || [];
  const active = tour.status === 'active';
  const total = history.reduce((a, n) => a + (Number(n.stars) || 0), 0);
  const nightIdx = active ? Math.min(4, tour.night ?? 0) : -1;
  let selected = Math.max(0, nightIdx >= 0 ? nightIdx : towns.length - 1);
  let genre = ctx.params.genre;

  // ---- header --------------------------------------------------------------------------------------------------
  const firstWord = (towns[0]?.name || 'Wibbling').split(/[-\s]/)[0];
  const head = ui.pageHead({
    kicker: active ? `Night ${nightIdx + 1} of 5` : 'The tour is over',
    title: `The ${firstWord} Tour`,
    sub: active ? `Tonight: ${towns[nightIdx]?.name}. ${towns[nightIdx]?.blurb || ''}` : 'Five towns. Fifteen stars to beat. Here is how it went.',
  });

  // ---- progress meter ------------------------------------------------------------------------------------------
  const prog = h(
    'div',
    { class: 'star-meter paper', role: 'group', 'aria-label': `${ui.fmt.formatNumber(total, total % 1 ? 1 : 0)} of ${GOAL} stars` },
    h('div', { class: 'sm-top' }, h('span', { class: 'kicker' }, 'Stars this tour'), h('span', { class: 'sm-count display' }, h('b', { class: 'sm-val' }, ui.fmt.formatNumber(0, 1)), h('span', { class: 'muted' }, ` / ${GOAL}`))),
    h('div', { class: 'sm-track' }, h('i', { class: 'sm-fill' }), h('span', { class: 'sm-mark', style: { left: `${(ui.RESPECTABLE_STARS / 25) * 100}%` }, title: 'Respectable: 11 stars' }, h('em', null, '11')), h('span', { class: 'sm-mark gold', style: { left: `${(GOAL / 25) * 100}%` }, title: 'Critical triumph: 15 stars' }, h('em', null, '15 ★'))),
    h('div', { class: 'sm-nights' }, ...Array.from({ length: 5 }, (_, i) => h('div', { class: ['sm-night', history[i] && 'done', i === nightIdx && 'now'] }, h('span', { class: 'tiny muted' }, `Night ${i + 1}`), history[i] ? ui.starRating(history[i].stars, { size: 'sm', animate: true }) : h('span', { class: 'sm-dash' }, i === nightIdx ? 'tonight' : '—')))),
  );
  requestAnimationFrame(() => {
    prog.querySelector('.sm-fill').style.width = `${Math.min(100, (total / 25) * 100)}%`;
    ui.tweenText(prog.querySelector('.sm-val'), total, { from: 0, digits: 1, ms: 900 });
  });

  // ---- map -----------------------------------------------------------------------------------------------------
  const mapHost = h('div', { class: 'map-host' });
  const info = h('div', { class: 'town-info' });
  const mq = globalThis.matchMedia?.('(max-width: 700px)');
  let portrait = !!mq?.matches;
  let wagonEl = null;
  let roadPath = null;
  let pts = [];

  function drawMap() {
    const L = mapLayout(portrait);
    pts = L.pts;
    const root = svg('svg', { class: 'tour-map', viewBox: `0 0 ${L.w} ${L.h}`, role: 'group', 'aria-label': 'Map of the tour' });
    const defs = svg('defs', null,
      svg('filter', { id: 'paper-shadow', x: '-20%', y: '-20%', width: '140%', height: '150%' }, svg('feDropShadow', { dx: 0, dy: 3, stdDeviation: 2.5, 'flood-color': '#000', 'flood-opacity': 0.35 })),
      svg('radialGradient', { id: 'map-glow' }, svg('stop', { offset: '0%', 'stop-color': '#f7dc8c', 'stop-opacity': 0.95 }), svg('stop', { offset: '100%', 'stop-color': '#f7dc8c', 'stop-opacity': 0 })),
    );
    root.append(defs);
    // parchment + hills
    root.append(svg('rect', { class: 'map-paper', x: 6, y: 6, width: L.w - 12, height: L.h - 12, rx: 22 }));
    const hills = portrait
      ? [['M0 140 Q80 90 170 130 T300 120', 0.5], ['M120 420 Q220 380 330 420 T420 410', 0.45], ['M0 640 Q90 590 180 640 T330 630', 0.5], ['M200 850 Q300 800 420 850', 0.4]]
      : [['M20 360 Q140 290 260 350 T480 340', 0.5], ['M520 380 Q640 300 760 370 T990 350', 0.45], ['M40 120 Q150 70 260 110 T440 100', 0.35], ['M580 70 Q700 30 820 80 T980 70', 0.3]];
    for (const [d, o] of hills) root.append(svg('path', { d: `${d} V${L.h} H0Z`, class: 'map-hill', opacity: o }));
    // compass
    root.append(svg('g', { class: 'map-compass', transform: `translate(${L.w - 70},${portrait ? 60 : 62})` }, svg('circle', { r: 26, class: 'mc-ring' }), svg('path', { d: 'M0 -34 L6 0 L0 34 L-6 0Z', class: 'mc-n' }), svg('path', { d: 'M-34 0 L0 -6 L34 0 L0 6Z', class: 'mc-e' }), svg('text', { y: -38, 'text-anchor': 'middle', class: 'mc-t' }, 'N')));
    // the road
    const d = smoothThrough(pts);
    root.append(svg('path', { d, class: 'map-road-bed' }));
    roadPath = svg('path', { d, class: 'map-road' });
    root.append(roadPath);
    // done portion of the road (gold)
    const doneTo = Math.min(history.length, pts.length - 1);
    if (doneTo > 0) root.append(svg('path', { d: smoothThrough(pts.slice(0, doneTo + 1)), class: 'map-road-done' }));

    towns.forEach((t, i) => {
      const p = pts[i];
      const done = !!history[i];
      const now = i === nightIdx;
      const sky = SKIES[t.sky] || SKIES.noon;
      const g = svg('g', { class: ['map-town', done && 'done', now && 'now', i > Math.max(nightIdx, history.length - 1) && 'future', i === selected && 'sel'], transform: `translate(${p.x},${p.y})`, tabindex: '0', role: 'button', 'aria-label': `${t.name}${done ? `, ${history[i].stars} stars` : now ? ', tonight' : ''}`, 'data-i': i });
      if (now) g.append(svg('circle', { r: 78, fill: 'url(#map-glow)', class: 'map-halo' }));
      g.append(svg('ellipse', { cx: 0, cy: 46, rx: 54, ry: 11, class: 'map-mound' }));
      const disc = svg('g', { class: 'map-disc', filter: 'url(#paper-shadow)' }, townDisc(t, 44));
      g.append(disc);
      if (done) g.append(svg('g', { class: 'map-check', transform: 'translate(34,-34)' }, svg('circle', { r: 13 }), svg('path', { d: 'M-6 0l4.5 4.5L7 -4.5' })));
      if (now) g.append(svg('circle', { r: 50, class: 'map-ring' }));
      const label = t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name;
      const tagW = Math.max(96, label.length * 7.4 + 20);
      g.append(svg('g', { class: 'map-tag', transform: `translate(0,${done ? 76 : 64})` }, svg('rect', { x: -tagW / 2, y: -13, width: tagW, height: 26, rx: 5 }), svg('text', { y: 5, 'text-anchor': 'middle' }, label)));
      if (done) g.append(starsRow(history[i].stars, 0, 102, 19));
      else g.append(svg('text', { class: 'map-night', y: -58, 'text-anchor': 'middle' }, `Night ${i + 1}`));
      g.addEventListener('click', () => select(i));
      g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(i)));
      root.append(g);
      void sky;
    });

    // the wagon
    const at = Math.max(0, tour.towns.indexOf(tour.wagon?.at));
    const prevAt = lsGet('wagon_prev', null);
    const from = prevAt && prevAt.tour === tour.id && prevAt.idx !== at ? prevAt.idx : at;
    wagonEl = svg('g', { class: 'map-wagon-pos' }, svg('g', { class: 'map-wagon' }, svg('g', { transform: 'translate(-20,-64) scale(1.7)' }, wagonGlyph())));
    root.append(wagonEl);
    placeWagon(from);
    if (from !== at) animateWagon(from, at);
    lsSet('wagon_prev', { tour: tour.id, idx: at });
    mapHost.replaceChildren(root);
  }

  function wagonGlyph() {
    const g = svg('g', { class: 'wagon-art' });
    for (const d of ['M3 14V8h12v6', 'M15 10h4l2 3v1', 'M3 14h18']) g.append(svg('path', { d }));
    g.append(svg('circle', { cx: 7, cy: 16.8, r: 2.3 }), svg('circle', { cx: 17, cy: 16.8, r: 2.3 }));
    return g;
  }
  function placeWagon(i) {
    const p = pts[i] || pts[0];
    wagonEl.setAttribute('transform', `translate(${p.x},${p.y})`);
  }
  function animateWagon(from, to) {
    if (ui.prefersReducedMotion() || !roadPath || !roadPath.getTotalLength) return placeWagon(to);
    const total = roadPath.getTotalLength();
    const seg = total / (pts.length - 1);
    const t0 = performance.now();
    const dur = 1700;
    const a = from * seg;
    const b = to * seg;
    const step = (now) => {
      const k = ui.easeOutCubic(Math.min(1, (now - t0) / dur));
      const pt = roadPath.getPointAtLength(a + (b - a) * k);
      wagonEl.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      if (k < 1 && wagonEl.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function select(i) {
    selected = i;
    mapHost.querySelectorAll('.map-town').forEach((g, k) => g.classList.toggle('sel', k === i));
    drawInfo();
  }

  function chips(list, tone) {
    return list.length ? list.map((t) => ui.chip(String(t).replace(/_/g, ' '), { tone })) : [h('span', { class: 'muted small' }, 'nothing in particular')];
  }

  function drawInfo() {
    const t = towns[selected];
    if (!t) return;
    const done = history[selected];
    const now = selected === nightIdx;
    const temp = t.temperament || { likes: [], hates: [] };
    info.replaceChildren(
      ui.card(
        { tone: 'paper', class: 'town-card', tilt: selected % 2 ? 'r' : 'l' },
        h('div', { class: 'tc-top' }, h('div', { class: 'tc-sticker' }, townStickerSvg(t)), h('div', { class: 'grow' }, h('div', { class: 'kicker' }, `Night ${selected + 1} · ${SKIES[t.sky]?.label || t.sky} sky`), h('h3', { class: 'display tc-name' }, t.name), h('p', { class: 'tc-blurb' }, t.blurb))),
        t.gossip && h('blockquote', { class: 'tc-gossip hand' }, '“', t.gossip, '”', h('span', { class: 'tiny muted' }, ' overheard at the stage door')),
        (now || (!done && selected > nightIdx)) && h('div', { class: 'tc-taste' }, h('div', { class: 'tiny muted' }, 'The locals tend to'), h('div', { class: 'row gap-1 wrap' }, icon('heart', 'sm'), ...chips(temp.likes, 'ok')), h('div', { class: 'row gap-1 wrap' }, icon('ghost', 'sm'), ...chips(temp.hates, 'bad'))),
        done && h('div', { class: 'tc-done' }, h('div', { class: 'row gap-3' }, ui.starRating(done.stars), h('span', { class: 'display' }, `${done.stars} stars`)), h('div', { class: 'small' }, done.title && h('strong', null, done.title)), h('p', { class: 'hand tc-head' }, done.headline), h('div', { class: 'tiny muted' }, `${done.funds_delta >= 0 ? '+' : ''}${done.funds_delta} funds`)),
      ),
    );
  }

  function townStickerSvg(t) {
    return ui.townSticker(t, { size: 84 });
  }

  // ---- genre picker + actions ---------------------------------------------------------------------------------
  const genreHost = h('div', { class: 'genre-picker', role: 'radiogroup', 'aria-label': "Tonight's genre" });
  function drawGenres() {
    genreHost.replaceChildren(
      ...ctx.data.genres.map((g) => {
        const on = g.id === genre;
        const taste = P.genreTaste(towns[nightIdx], g.id); // 'loved' | 'scorned' | null: this town's feelings about the genre
        return h(
          'button',
          {
            class: ['genre-card', on && 'on'],
            type: 'button',
            role: 'radio',
            'aria-checked': String(on),
            style: { '--g-sky': g.palette?.sky, '--g-flat': g.palette?.flat, '--g-acc': g.palette?.accent },
            title: `${g.roles.lead} / ${g.roles.villain} / ${g.roles.fool}`,
            onclick: () => {
              genre = g.id;
              ctx.carry({ genre });
              drawGenres();
            },
          },
          h('span', { class: 'gc-swatch' }, h('i'), h('i'), h('i')),
          h('span', { class: 'display gc-name' }, g.name),
          taste && h('span', { class: ['gc-taste', `gc-${taste}`] }, taste === 'loved' ? `${P.townShort(towns[nightIdx].name)} loves this` : `${P.townShort(towns[nightIdx].name)} scorns this`),
          h('span', { class: 'small gc-blurb' }, g.blurb),
        );
      }),
    );
  }

  const share = ui.shareString(tour, Object.fromEntries(towns.map((t) => [t.id, t])));
  let body;
  if (active) {
    drawGenres();
    body = [
      h('section', { class: 'tour-tonight' }, h('div', { class: 'row between wrap' }, h('div', null, h('div', { class: 'kicker' }, "Tonight's play"), h('h2', { class: 'display' }, 'Which kind of evening?')), h('p', { class: 'hand muted small tonight-hint' }, "Every town loves one kind of evening and scorns another. It is on the cards.")), genreHost),
      h(
        'div',
        { class: 'tour-actions' },
        ui.button("Begin tonight's show", { variant: 'primary', size: 'lg', icon: 'curtain', onclick: () => ctx.nav('casting', { genre: genre || ctx.params.genre }) }),
        ui.button('Greenroom', { variant: 'gold', icon: 'chat', onclick: () => ctx.nav('greenroom'), title: 'A word backstage with a puppet' }),
        ui.button('Props cupboard', { variant: 'ghost', icon: 'drawer', onclick: () => ctx.nav('datasets'), title: 'Browse every table the game uses' }),
      ),
      P.greenroomHint(tour) && h('p', { class: 'hand small muted greenroom-hint', role: 'note' }, P.greenroomHint(tour)),
    ];
  } else {
    const v = VERDICTS[tour.status] || VERDICTS.tragedy;
    const rows = history.map((n, i) => h('li', { class: 'verdict-night' }, h('span', { class: 'vn-num display' }, i + 1), h('div', { class: 'grow' }, h('div', { class: 'vn-town' }, towns[i]?.name || n.town, h('span', { class: 'muted small' }, n.title ? ` · ${n.title}` : '')), h('div', { class: 'hand vn-head' }, n.headline)), ui.starRating(n.stars, { size: 'sm' })));
    const shareBox = h('pre', { class: 'share-box mono' }, share);
    body = [
      ui.card(
        { tone: v.tone === 'plum' ? 'plum' : v.tone === 'gold' ? 'gold' : 'paper', class: ['verdict', `verdict-${tour.status}`] },
        h('div', { class: 'verdict-top' }, ui.stamp(v.stamp, tour.status === 'triumph' ? 'gold' : tour.status === 'respectable' ? 'ok' : 'crimson'), h('h2', { class: 'display verdict-title' }, v.title), h('p', { class: 'hand verdict-sub' }, v.sub), h('div', { class: 'verdict-total' }, h('span', { class: 'display vt-n' }, ui.fmt.formatNumber(total, total % 1 ? 1 : 0)), h('span', { class: 'muted' }, ` of ${GOAL} stars`))),
        h('ol', { class: 'verdict-nights' }, ...rows),
        h('div', { class: 'share' }, h('div', { class: 'kicker' }, 'Share it'), shareBox, h('div', { class: 'row gap-2 wrap' }, ui.copyButton(share, 'Copy result', { variant: 'gold' }), navigator.share && ui.button('Share', { size: 'sm', icon: 'share', variant: 'paper', onclick: () => navigator.share({ text: share }).catch(() => {}) }))),
      ),
      h('div', { class: 'tour-actions' }, ui.button('New tour', { variant: 'primary', size: 'lg', icon: 'sparkle', onclick: () => ctx.nav('title') }), ui.button('Props cupboard', { variant: 'ghost', icon: 'drawer', onclick: () => ctx.nav('datasets') })),
    ];
  }

  const lastNight = history[history.length - 1];
  const view = h('div', { class: 'tour-view' }, head, active && lastNight && h('div', { class: 'last-night paper tilt-l' }, icon('quill'), h('span', null, h('b', null, 'Last night: '), h('em', { class: 'hand' }, lastNight.headline), ' ', ui.starRating(lastNight.stars, { size: 'sm' }))), prog, h('div', { class: 'tour-grid' }, h('div', { class: 'map-wrap' }, mapHost), info), ...body);
  root.append(view);
  drawMap();
  drawInfo();
  const onChange = () => {
    if (mq.matches !== portrait) {
      portrait = mq.matches;
      drawMap();
    }
  };
  mq?.addEventListener?.('change', onChange);

  if (!active && tour.status === 'triumph') setTimeout(() => ui.confetti({ count: 200, origin: { x: 0.5, y: 0.3 } }), 500);

  return {
    unmount() {
      mq?.removeEventListener?.('change', onChange);
    },
  };
}
