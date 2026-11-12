// Paper-cut glyphs: town landmarks, skies, puppet avatars. Pure SVG builders (no network, no assets).
// Used by the tour map (Shell-Core) and available to every view through `ui.townSticker / ui.puppetAvatar`.

import { svg } from './dom.js';

export const SKIES = {
  dawn: { top: '#f7b6a0', bottom: '#fde3b8', body: '#fff3c4', ink: '#5d3a52', stars: false, label: 'dawn' },
  noon: { top: '#7fb7e6', bottom: '#d9efff', body: '#fff0a8', ink: '#2d3f63', stars: false, label: 'noon' },
  dusk: { top: '#6a4575', bottom: '#f09a6b', body: '#ffd9a0', ink: '#2a1630', stars: false, label: 'dusk' },
  night: { top: '#0f1233', bottom: '#33356b', body: '#f4efd0', ink: '#0a0a22', stars: true, label: 'night' },
  storm: { top: '#3d4558', bottom: '#8b94a6', body: null, ink: '#1c2030', stars: false, label: 'storm' },
};

export const LANDMARKS = ['windmill', 'clocktower', 'lighthouse', 'castle', 'bridge', 'chimneys', 'spire', 'crane', 'pier', 'silo'];

const P = (d, extra = {}) => svg('path', { d, ...extra });
const R = (x, y, w, h, extra = {}) => svg('rect', { x, y, width: w, height: h, ...extra });
const C = (cx, cy, r, extra = {}) => svg('circle', { cx, cy, r, ...extra });
const LIGHT = 'var(--gold-lt, #f7dc8c)';

/** A landmark drawn in a 100x100 box as a dark paper silhouette (`fill="currentColor"`) with a few lit windows. */
export function landmarkGlyph(name) {
  const g = svg('g', { class: `landmark lm-${name}`, fill: 'currentColor' });
  switch (name) {
    case 'windmill':
      g.append(P('M41 84 L46 44 H54 L59 84Z'), P('M44 44 L50 35 L56 44Z'), R(47, 62, 6, 12, { fill: LIGHT }));
      g.append(
        svg('g', { transform: 'rotate(18 50 40)', class: 'lm-spin' }, R(48.5, 8, 3, 64), R(18, 38.5, 64, 3), R(52, 9, 9, 15), R(39, 56, 9, 15), R(20, 42, 15, 9), R(65, 29, 15, 9)),
        C(50, 40, 3.2, { fill: LIGHT }),
      );
      break;
    case 'clocktower':
      g.append(P('M38 84 V34 L50 14 L62 34 V84Z'), R(34, 82, 32, 4), C(50, 44, 9.5, { fill: LIGHT }), R(49.2, 37, 1.8, 7.5, { fill: 'currentColor' }), R(49.2, 43.4, 6, 1.8, { fill: 'currentColor' }), R(46, 62, 8, 12, { fill: LIGHT }));
      break;
    case 'lighthouse':
      g.append(P('M58 30 L98 18 V42Z', { fill: LIGHT, opacity: 0.55 }), P('M39 84 L44 38 H56 L61 84Z'), R(43, 28, 14, 10), P('M41 28 L50 17 L59 28Z'), R(46, 30, 8, 6, { fill: LIGHT }), R(41, 50, 18, 5, { fill: LIGHT, opacity: 0.8 }), R(41, 66, 18, 5, { fill: LIGHT, opacity: 0.8 }), R(34, 83, 32, 4));
      break;
    case 'castle':
      g.append(
        R(32, 40, 36, 44),
        R(16, 28, 16, 56),
        R(68, 28, 16, 56),
        P('M14 28 L24 10 L34 28Z'),
        P('M66 28 L76 10 L86 28Z'),
        R(32, 34, 5, 6),
        R(41, 34, 5, 6),
        R(50, 34, 5, 6),
        R(59, 34, 5, 6),
        P('M44 84 V66 A6 6 0 0 1 56 66 V84Z', { fill: LIGHT }),
        R(21, 40, 6, 9, { fill: LIGHT }),
        R(73, 40, 6, 9, { fill: LIGHT }),
        R(21, 60, 6, 9, { fill: LIGHT }),
        R(73, 60, 6, 9, { fill: LIGHT }),
      );
      break;
    case 'bridge':
      g.append(
        P('M4 54 H96 V84 H4Z M14 84 V72 A12 12 0 0 1 38 72 V84Z M40 84 V70 A10 14 0 0 1 60 70 V84Z M62 84 V72 A12 12 0 0 1 86 72 V84Z', { 'fill-rule': 'evenodd' }),
        R(4, 44, 92, 3),
        ...[10, 24, 38, 52, 66, 80, 92].map((x) => R(x, 44, 2, 10)),
        P('M0 90 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V100 H0Z', { opacity: 0.8 }),
        R(46, 30, 3, 14),
        P('M44 30 H52 L48 22Z', { fill: LIGHT }),
      );
      break;
    case 'chimneys':
      g.append(
        R(10, 58, 80, 26),
        R(20, 30, 10, 28),
        R(44, 18, 10, 40),
        R(68, 34, 10, 24),
        R(18, 28, 14, 4),
        R(42, 16, 14, 4),
        R(66, 32, 14, 4),
        C(26, 20, 5, { fill: 'currentColor', opacity: 0.45 }),
        C(33, 12, 6, { fill: 'currentColor', opacity: 0.3 }),
        C(52, 8, 5, { fill: 'currentColor', opacity: 0.4 }),
        ...[16, 30, 44, 58, 72].map((x) => R(x, 66, 7, 8, { fill: LIGHT })),
      );
      break;
    case 'spire':
      g.append(R(14, 56, 40, 28), P('M12 56 L34 40 L56 56Z'), R(56, 44, 18, 40), P('M54 44 L65 10 L76 44Z'), R(64.2, 2, 1.6, 10), R(61, 5, 8, 1.6), P('M30 84 V72 A5 5 0 0 1 40 72 V84Z', { fill: LIGHT }), P('M61 66 V58 A4 4 0 0 1 69 58 V66Z', { fill: LIGHT }), R(20, 62, 5, 8, { fill: LIGHT }), R(44, 62, 5, 8, { fill: LIGHT }));
      break;
    case 'crane':
      g.append(
        R(26, 30, 5, 54),
        R(14, 82, 30, 4),
        R(10, 26, 80, 4),
        P('M28 12 L16 26 H40Z'),
        R(78, 22, 4, 8),
        R(68, 30, 1.6, 22),
        R(60, 52, 18, 12, { fill: LIGHT }),
        R(60, 52, 18, 3),
        R(52, 76, 36, 8),
        R(58, 68, 24, 8),
        P('M30 14 L68 28', { stroke: 'currentColor', 'stroke-width': 1.6, fill: 'none' }),
        P('M30 14 L16 26', { stroke: 'currentColor', 'stroke-width': 1.6, fill: 'none' }),
      );
      break;
    case 'pier':
      g.append(
        R(4, 62, 92, 4),
        ...[10, 26, 42, 58, 74, 88].map((x) => R(x, 66, 3, 22)),
        R(78, 40, 2.6, 22),
        C(79.3, 38, 4.2, { fill: LIGHT }),
        R(20, 52, 22, 10),
        P('M18 52 L31 42 L44 52Z'),
        R(26, 55, 5, 7, { fill: LIGHT }),
        P('M0 86 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V100 H0Z', { opacity: 0.85 }),
      );
      break;
    case 'silo':
      g.append(
        P('M18 84 V38 A14 9 0 0 1 46 38 V84Z'),
        P('M50 84 V50 A12 8 0 0 1 74 50 V84Z'),
        R(16, 46, 32, 2.2, { fill: LIGHT, opacity: 0.8 }),
        R(16, 62, 32, 2.2, { fill: LIGHT, opacity: 0.8 }),
        R(48, 60, 28, 2.2, { fill: LIGHT, opacity: 0.8 }),
        R(76, 66, 18, 18),
        P('M74 66 L85 56 L96 66Z'),
        R(82, 72, 5, 12, { fill: LIGHT }),
        R(46, 40, 8, 2),
      );
      break;
    default:
      g.append(R(30, 40, 40, 44), P('M26 40 L50 18 L74 40Z'), R(44, 62, 12, 22, { fill: LIGHT }));
  }
  // ground line
  g.append(R(0, 84, 100, 16, { opacity: name === 'pier' || name === 'bridge' ? 0 : 1 }));
  return g;
}

let uid = 0;

/**
 * A round town "sticker": sky disc + landmark. Returns an <svg viewBox="0 0 100 100">.
 * `sky`: dawn|noon|dusk|night|storm; `landmark`: see LANDMARKS.
 */
export function townSticker(town = {}, { size = 96, label } = {}) {
  const sky = SKIES[town.sky] || SKIES.noon;
  const id = `sk${++uid}`;
  const root = svg('svg', { class: 'town-sticker', viewBox: '0 0 100 100', width: size, height: size, role: 'img', 'aria-label': label || `${town.name || 'Town'} at ${sky.label}` });
  const defs = svg('defs');
  const grad = svg('linearGradient', { id: `${id}-g`, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svg('stop', { offset: '0%', 'stop-color': sky.top }), svg('stop', { offset: '100%', 'stop-color': sky.bottom }));
  const clip = svg('clipPath', { id: `${id}-c` }, C(50, 50, 46));
  defs.append(grad, clip);
  root.append(defs);
  const disc = svg('g', { 'clip-path': `url(#${id}-c)` });
  disc.append(R(0, 0, 100, 100, { fill: `url(#${id}-g)` }));
  if (sky.stars) for (const [x, y, r] of [[14, 20, 1.4], [30, 12, 1], [64, 16, 1.5], [82, 28, 1], [22, 38, 0.9], [74, 10, 1]]) disc.append(C(x, y, r, { fill: '#fff8d6' }));
  if (sky.body) disc.append(C(town.sky === 'night' ? 76 : town.sky === 'dusk' ? 24 : town.sky === 'dawn' ? 22 : 74, town.sky === 'noon' ? 20 : town.sky === 'dusk' ? 54 : 30, town.sky === 'night' ? 8 : 10, { fill: sky.body, opacity: 0.95 }));
  if (town.sky === 'storm') {
    disc.append(svg('g', { fill: '#2b3144', opacity: 0.8 }, C(30, 22, 12), C(46, 18, 14), C(64, 24, 11), R(22, 22, 52, 12)));
    disc.append(P('M52 34 L44 52 H52 L46 68 L62 46 H53 L58 34Z', { fill: '#ffe27a' }));
  }
  const lm = svg('g', { style: { color: sky.ink } });
  lm.append(landmarkGlyph(town.landmark));
  disc.append(lm);
  root.append(disc, C(50, 50, 46, { fill: 'none', stroke: 'var(--paper, #efe0c2)', 'stroke-width': 3.2 }), C(50, 50, 48.6, { fill: 'none', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.8 }));
  return root;
}

/** Same sticker as a bare <g> centred on (0,0) with the given radius (for the tour map). */
export function townDisc(town, r = 34) {
  const s = townSticker(town, { size: r * 2 });
  const g = svg('g', { transform: `translate(${-r},${-r}) scale(${(r * 2) / 100})` });
  while (s.firstChild) g.appendChild(s.firstChild);
  return g;
}

// ---------------------------------------------------------------------------------------------------------
// puppet avatars

const SKIN = '#f2dcb5';

/** Little puppet portrait with visible strings. `p` is a performer/staff row ({id,palette,build?,kind?}). */
export function puppetAvatar(p = {}, { size = 48, strings = true, title } = {}) {
  const pal = p.palette || {};
  const body = pal.body || '#c0566e';
  const accent = pal.accent || '#f2c14e';
  const hair = pal.hair || '#3b2a3a';
  const head = p.build?.head || (p.kind === 'heron' ? 'beak' : p.kind === 'hand' ? 'round' : 'round');
  const root = svg('svg', { class: 'puppet-avatar', viewBox: '0 0 48 48', width: size, height: size, role: 'img', 'aria-label': title || p.name || p.id || 'puppet' });
  root.append(svg('title', null, title || p.name || p.id || 'puppet'));
  if (strings) {
    for (const x of [14, 24, 34]) root.append(P(`M${x} 0 L${x === 24 ? 24 : x < 24 ? 19 : 29} ${x === 24 ? 14 : 32}`, { stroke: 'rgba(246,236,214,.5)', 'stroke-width': 0.7, fill: 'none' }));
  }
  // shoulders
  root.append(P('M7 48 C7 36 14 32 24 32 C34 32 41 36 41 48Z', { fill: body }), P('M17 33 L24 40 L31 33 Q24 31 17 33Z', { fill: accent }));
  const faceFill = head === 'shadow' ? '#1b1220' : head === 'tin' ? '#b9c1c8' : head === 'sock' ? '#d9a679' : head === 'beak' && p.id === 'goose' ? '#f7f3ea' : p.kind === 'heron' ? '#b5c6d6' : SKIN;
  const h = svg('g');
  switch (head) {
    case 'long':
      h.append(svg('ellipse', { cx: 24, cy: 19, rx: 9, ry: 13, fill: faceFill }));
      break;
    case 'square':
    case 'nutcracker':
      h.append(R(14, 8, 20, 22, { rx: 3, fill: faceFill }));
      if (head === 'nutcracker') h.append(R(17, 26, 14, 5, { fill: '#f7f0e0', stroke: '#3b2a3a', 'stroke-width': 0.6 }));
      break;
    case 'tin':
      h.append(R(14, 8, 20, 22, { rx: 2, fill: faceFill }), C(16.5, 10.5, 1, { fill: '#6c757d' }), C(31.5, 10.5, 1, { fill: '#6c757d' }), C(16.5, 27.5, 1, { fill: '#6c757d' }), C(31.5, 27.5, 1, { fill: '#6c757d' }));
      break;
    case 'sock':
      h.append(P('M15 30 V14 C15 6 33 6 33 14 V30Z', { fill: faceFill }), R(15, 17, 18, 2.5, { fill: accent }), R(15, 23, 18, 2.5, { fill: accent }));
      break;
    case 'beak':
      h.append(C(23, 18, 10, { fill: faceFill }), P('M31 17 L45 21 L31 24Z', { fill: p.id === 'goose' ? '#f2a03d' : '#e7b04a' }));
      break;
    case 'shadow':
      h.append(C(24, 19, 10.5, { fill: faceFill }));
      break;
    default:
      h.append(C(24, 19, 10.5, { fill: faceFill }));
  }
  root.append(h);
  // hair / hat cap
  if (head !== 'shadow' && head !== 'tin' && head !== 'sock') root.append(P(head === 'long' ? 'M15 15 C15 3 33 3 33 15 C30 10 18 10 15 15Z' : 'M13.5 17 C12 4 36 4 34.5 17 C31 11 17 11 13.5 17Z', { fill: hair }));
  if (head === 'nutcracker') root.append(R(14, 3, 20, 7, { rx: 1.5, fill: body }), R(14, 8, 20, 1.8, { fill: accent }));
  // eyes + mouth
  const eyeY = head === 'long' ? 18 : 19;
  const eyeCol = head === 'shadow' ? '#f2dcb5' : '#241a26';
  if (head === 'beak') root.append(C(26, 16, 1.4, { fill: eyeCol }));
  else root.append(C(20.5, eyeY, 1.4, { fill: eyeCol }), C(27.5, eyeY, 1.4, { fill: eyeCol }));
  if (head !== 'beak') root.append(P('M20.5 25 Q24 27.4 27.5 25', { stroke: eyeCol, 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }));
  return root;
}
