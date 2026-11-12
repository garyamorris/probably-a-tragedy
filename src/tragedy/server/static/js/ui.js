// ui.js: shared UI helpers for every view of "Probably a Tragedy". OWNER: Shell-Core. Names here are STABLE.
//
// Import:  import * as ui from './ui.js'   (views get the same namespace as `ctx.ui`)
//
// ── DOM builders (strings are always TEXT NODES, never innerHTML) ───────────────────────────────────────────
//   el(tag, props?, ...kids)  alias of h()      h / svg / frag / clear / mount(el, ...kids) / text / $ / $$
//   props: class (string|array), style (string|object, '--x' ok), dataset, on<event>, ref(fn), text, value, disabled...
//   debounce(fn, ms), rafThrottle(fn)
//
// ── Components (all return DOM nodes) ───────────────────────────────────────────────────────────────────────
//   card({title?, kicker?, tone?, tilt?, class?, onclick?}, ...kids)   paper card. tone: 'paper'(default)|'plum'|'gold'|'crimson'|'flat'
//                                                                      tilt: 'l'|'r' (a degree or two, hand-pinned look)
//   button(label, {variant?, size?, icon?, kbd?, href?, onclick?, disabled?, title?, class?, pressed?}) -> <button>/<a>
//        variant: 'primary'(crimson)|'gold'|'ghost'|'paper'|'danger'; size: 'sm'|'lg'
//   iconButton(iconName, title, onclick, opts?)     round icon-only button
//   asyncClick(btn, fn, onError?)                   run async handler with a busy state, returns btn
//   copyButton(textOrFn, label?)                    copies to clipboard, flashes a check
//   badge(label, tone?, {icon?, title?})            tone: 'info'|'ok'|'warn'|'bad'|'gold'|'plum'|'crimson'
//   chip(label, {title?, tone?}) / kbd(key)         small label / keycap
//   starRating(n, {max=5, size='md'|'sm'|'lg', animate=true, label?}) -> el with .set(n) ; half stars ok; animated fill
//   meter({label, value, max=100, tone?, icon?, showValue=true}) -> el with .set(v); tone 'warmth'|'chaos'|'gold'|'ok'|'bad'
//   progressPips(total, current, {labels?}) -> el with .set(current)       (beat pips / night pips)
//   stamp(label, tone?)                             rotated hand-stamped label ("MAJOR MISHAP")
//   pageHead({kicker?, title, sub?, actions?})      consistent header for flow views
//   emptyState({icon?, title, text?, action?})      spinner(label?) / curtainLoader(label?)
//   field(label, input, hint?)  /  input({...})  /  textarea({...})       form bits
//   modal({title?, body, actions?, dismissible=true, size?, class?}) -> {el, close(v), closed:Promise}   focus-managed dialog
//   confirmDialog({title, body, confirm='OK', cancel='Cancel', tone?}) -> Promise<boolean>
//   toast(msgOrOpts, opts?)                         toast('Saved') | toast({title, body, tone:'ok'|'accent'|'info'|'danger', ttl})
//   puppetAvatar(performerOrStaff, {size?, strings?})   SVG portrait with strings       (core/glyphs.js)
//   townSticker(town, {size?}) / landmarkGlyph(name) / SKIES / LANDMARKS                (core/glyphs.js)
//   icon(name, cls?)                                inline SVG icon (see core/icons.js; star, coin, ticket, candle, mask, wagon ...)
//
// ── Motion helpers (all honour prefers-reduced-motion) ──────────────────────────────────────────────────────
//   prefersReducedMotion() -> bool
//   speak(el, text, {cps=55, onChar?, signal?}) -> Promise<void> with .skip()     typewriter into el.textContent
//   tween(from, to, {ms=600, ease?, onUpdate}) -> Promise ; tweenText(el, to, {ms, from?, digits?, format?})
//   confetti({count=140, colors?, origin?:{x,y}, duration=2600}) -> Promise      DOM-free canvas burst
//   sleep(ms, signal?) ; nextFrame() ; spring: the CSS easing token var(--ease-spring)
//
// ── Misc ────────────────────────────────────────────────────────────────────────────────────────────────────
//   fmt   namespace of core/format.js (formatNumber, truncate, titleCase, relativeTime, ...)
//   hash32(str) / rng(seed) deterministic helpers ; humanize('the_lean') -> 'The Lean' ; plural(n, one, many?)
//   starsLabel(n) -> '3.5 stars' ; shareString(tour, towns?) -> multi-line emoji share text
//   BEATS / BEAT_NAMES / ROLES / TARGET_STARS / NIGHTS constants
//
// ── CSS class names you can use in your own markup (defined in css/base.css + css/components.css) ───────────
//   Surfaces:  .paper (cream paper with fibre texture, ink text)  .paper-dk  .velvet (plum velvet panel)  .brass (gold-edged plate)
//              .card (+ .card-plum .card-gold .card-crimson .card-flat)   .torn (zig-zag bottom edge)   .tilt-l .tilt-r
//   Type:      .display (serif display)  .hand (handwriting accent)  .kicker (small caps label)  .muted  .small  .tiny  .mono
//   Layout:    .row .col .grow .gap-1..5 .wrap .center .stack .grid-auto  .view (page container)  .view-narrow  .hide-sm
//   Motion:    .pop-in (spring entrance)  .float  .wobble  .glow  .pulse-gold   (.reveal for staggered children: style="--i:3")
//   Page frame: every view is mounted in <main class="stage-main"> > <div class="view">.

import { h, svg, frag, clear, mount, text, $, $$, debounce, rafThrottle } from './core/dom.js';
import { icon } from './core/icons.js';
import { toast as coreToast, initToasts } from './core/toast.js';
import * as fmt from './core/format.js';
import { puppetAvatar, townSticker, townDisc, landmarkGlyph, SKIES, LANDMARKS } from './core/glyphs.js';

export { h, svg, frag, clear, mount, text, $, $$, debounce, rafThrottle, icon, fmt, puppetAvatar, townSticker, townDisc, landmarkGlyph, SKIES, LANDMARKS, initToasts };
export const el = h;

// ---------------------------------------------------------------------------------------------------------------
// constants

export const BEATS = ['setup', 'complication', 'reversal', 'twist', 'finale'];
export const BEAT_NAMES = { setup: 'Setup', complication: 'Complication', reversal: 'Reversal', twist: 'Twist', finale: 'Finale' };
export const ROLES = ['lead', 'villain', 'fool'];
export const TARGET_STARS = 15;
export const RESPECTABLE_STARS = 11;
export const NIGHTS = 5;

// ---------------------------------------------------------------------------------------------------------------
// tiny utils

export function prefersReducedMotion() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  } catch {
    return false;
  }
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError() {
  const e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
}

export const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));

/** FNV-1a 32-bit hash of a string (stable decoration choices). */
export function hash32(str) {
  let x = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

/** mulberry32 PRNG: rng(seed)() -> [0,1). */
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hash32(seed)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function humanize(slug) {
  return String(slug ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export const plural = fmt.plural;

export function starsLabel(n) {
  const v = Number(n) || 0;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${v === 1 ? 'star' : 'stars'}`;
}

/** Emoji share text for a finished (or in-progress) tour. */
export function shareString(tour, towns = {}) {
  const hist = tour?.history || [];
  const total = hist.reduce((a, n) => a + (Number(n.stars) || 0), 0);
  const row = (stars) => {
    const full = Math.floor(stars);
    return '⭐'.repeat(full) + (stars - full >= 0.5 ? '½' : '') || '▫️';
  };
  const verdict = { triumph: 'A Critical Triumph', respectable: 'A Respectable Run', tragedy: 'A Tragedy (Probably)' }[tour?.status] || 'On tour';
  const lines = hist.map((n, i) => `${i + 1}. ${row(Number(n.stars) || 0)}  ${towns[n.town]?.name || humanize(n.town)}`);
  return [`🎭 Probably a Tragedy  ·  seed ${tour?.seed ?? '?'}`, ...lines, `${fmt.formatNumber(total, total % 1 ? 1 : 0)}/${TARGET_STARS} stars  ·  ${verdict}`].join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// components

export function card(opts = {}, ...kids) {
  const { title, kicker, tone = 'paper', tilt, onclick, class: cls, id, role, tabindex } = opts;
  return h(
    'div',
    { class: ['card', tone !== 'paper' && `card-${tone}`, tilt && `tilt-${tilt}`, onclick && 'card-click', cls], id, role, tabindex: onclick ? tabindex ?? 0 : tabindex, onclick, onkeydown: onclick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onclick(e)) : undefined },
    (title || kicker) && h('div', { class: 'card-head' }, kicker && h('div', { class: 'kicker' }, kicker), title && h('h3', { class: 'card-title display' }, title)),
    ...kids,
  );
}

export function button(label, opts = {}) {
  const { variant, size, icon: ic, kbd: key, href, onclick, disabled, title, class: cls, pressed, type, external, id } = opts;
  return h(
    href ? 'a' : 'button',
    {
      class: ['btn', variant && `btn-${variant}`, size && `btn-${size}`, !label && 'btn-icon', cls],
      type: href ? undefined : type || 'button',
      href,
      id,
      target: external ? '_blank' : undefined,
      rel: external ? 'noopener noreferrer' : undefined,
      title,
      'aria-label': !label ? title : undefined,
      'aria-pressed': pressed === undefined ? undefined : String(!!pressed),
      disabled,
      onclick,
    },
    ic && icon(ic, size === 'sm' ? 'sm' : ''),
    label && h('span', { class: 'btn-label' }, label),
    key && h('kbd', { class: 'kbd' }, key),
  );
}

export const iconButton = (name, title, onclick, opts = {}) => button('', { icon: name, title, onclick, variant: 'ghost', ...opts });

export function asyncClick(btn, fn, onError) {
  btn.addEventListener('click', async (e) => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('busy');
    try {
      await fn(e);
    } catch (err) {
      if (onError) onError(err);
      else toast({ title: 'That did not work', body: err?.message || String(err), tone: 'danger' });
    } finally {
      btn.disabled = false;
      btn.classList.remove('busy');
    }
  });
  return btn;
}

export function copyButton(textOrFn, label = 'Copy', opts = {}) {
  const b = button(label, { size: 'sm', icon: 'copy', title: 'Copy to clipboard', variant: opts.variant || 'paper', ...opts });
  b.addEventListener('click', async () => {
    const t = typeof textOrFn === 'function' ? textOrFn() : textOrFn;
    try {
      await navigator.clipboard.writeText(String(t));
      toast({ title: 'Copied', tone: 'ok', ttl: 1600 });
    } catch {
      window.prompt('Copy:', String(t));
    }
    const first = b.querySelector('.icon');
    if (first) {
      first.replaceWith(icon('check', 'sm'));
      setTimeout(() => b.querySelector('.icon')?.replaceWith(icon('copy', 'sm')), 1200);
    }
  });
  return b;
}

export function badge(label, tone = 'info', opts = {}) {
  return h('span', { class: ['badge', `t-${tone}`], title: opts.title }, opts.icon && icon(opts.icon, 'sm'), label);
}
export function chip(label, opts = {}) {
  return h('span', { class: ['chip', opts.tone && `t-${opts.tone}`, opts.mono && 'mono'], title: opts.title }, opts.icon && icon(opts.icon, 'sm'), label);
}
export const kbd = (key) => h('kbd', { class: 'kbd' }, key);

export function stamp(label, tone = 'crimson') {
  return h('span', { class: ['stamp', `stamp-${tone}`] }, label);
}

/** Half-star aware rating. el.set(n) animates to a new value. */
export function starRating(n = 0, opts = {}) {
  const max = opts.max ?? 5;
  const animate = opts.animate !== false && !prefersReducedMotion();
  const root = h('span', { class: ['stars', opts.size && `stars-${opts.size}`], role: 'img', 'aria-label': opts.label || `${fmt.formatNumber(n, n % 1 ? 1 : 0)} out of ${max} stars` });
  const fills = [];
  for (let i = 0; i < max; i++) {
    const base = icon('star', 'star-base');
    const fill = icon('star', 'star-fill fill');
    fill.style.clipPath = 'inset(0 100% 0 0)';
    fill.style.transitionDelay = `${i * 90}ms`;
    fills.push(fill);
    root.append(h('span', { class: 'star' }, base, fill));
  }
  const paint = (v, instant) => {
    fills.forEach((f, i) => {
      const part = Math.max(0, Math.min(1, v - i));
      const q = part >= 0.75 ? 1 : part >= 0.25 ? 0.5 : 0; // snap to halves
      if (instant) f.style.transition = 'none';
      f.style.clipPath = `inset(0 ${100 - q * 100}% 0 0)`;
      f.classList.toggle('lit', q > 0);
      if (instant) requestAnimationFrame?.(() => (f.style.transition = ''));
    });
    root.setAttribute('aria-label', opts.label || `${fmt.formatNumber(v, v % 1 ? 1 : 0)} out of ${max} stars`);
  };
  root.set = (v) => paint(Number(v) || 0, !animate);
  if (animate) {
    // first paint after insertion so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => paint(Number(n) || 0, false)));
  } else paint(Number(n) || 0, true);
  return root;
}

/** Horizontal meter. el.set(v) tweens; tone: warmth|chaos|gold|ok|bad. */
export function meter(opts = {}) {
  const max = opts.max ?? 100;
  const valueEl = h('span', { class: 'meter-value' }, '');
  const fill = h('div', { class: 'meter-fill' });
  const root = h(
    'div',
    { class: ['meter', opts.tone && `meter-${opts.tone}`, opts.class], role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-label': opts.label },
    (opts.label || opts.icon) && h('div', { class: 'meter-head' }, opts.icon && icon(opts.icon, 'sm'), opts.label && h('span', { class: 'meter-label' }, opts.label), opts.showValue !== false && valueEl),
    h('div', { class: 'meter-track' }, fill),
  );
  let shown = null;
  root.set = (v) => {
    const val = Math.max(0, Math.min(max, Number(v) || 0));
    fill.style.width = `${(val / max) * 100}%`;
    root.setAttribute('aria-valuenow', Math.round(val));
    if (opts.showValue !== false) {
      if (shown === null || prefersReducedMotion()) valueEl.textContent = String(Math.round(val));
      else tweenText(valueEl, val, { from: shown, ms: 450, digits: 0 });
    }
    shown = val;
  };
  root.set(opts.value ?? 0);
  return root;
}

/** Row of N pips with one current (beats / nights). */
export function progressPips(total, current = 0, opts = {}) {
  const pips = Array.from({ length: total }, (_, i) => h('li', { class: 'pip', 'data-i': i, title: opts.labels?.[i] }, h('span', { class: 'pip-dot' }), opts.labels && h('span', { class: 'pip-label' }, opts.labels[i])));
  const root = h('ol', { class: ['pips', opts.class], 'aria-label': opts.label || 'Progress' }, ...pips);
  root.set = (cur) => {
    pips.forEach((p, i) => {
      p.classList.toggle('done', i < cur);
      p.classList.toggle('now', i === cur);
      if (i === cur) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
    });
  };
  root.set(current);
  return root;
}

export function pageHead({ kicker, title, sub, actions, class: cls } = {}) {
  return h('header', { class: ['page-head', cls] }, h('div', { class: 'grow' }, kicker && h('div', { class: 'kicker' }, kicker), h('h1', { class: 'display page-title' }, title), sub && h('p', { class: 'page-sub hand' }, sub)), actions && h('div', { class: 'row gap-2 wrap' }, actions));
}

export function emptyState({ icon: ic = 'mask', title, text: body, action } = {}) {
  return h('div', { class: 'empty' }, icon(ic, 'xl'), h('h3', { class: 'display' }, title), body && h('p', { class: 'muted' }, body), action);
}

export function spinner(label = 'Loading') {
  return h('span', { class: 'spinner', role: 'status', 'aria-label': label }, h('span', { class: 'spinner-dot' }), h('span', { class: 'spinner-dot' }), h('span', { class: 'spinner-dot' }));
}
export function curtainLoader(label = 'The curtain is rising...') {
  return h('div', { class: 'curtain-loader', role: 'status' }, h('div', { class: 'cl-panel cl-l' }), h('div', { class: 'cl-panel cl-r' }), h('div', { class: 'hand cl-label' }, label));
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint && h('span', { class: 'field-hint small muted' }, hint));
}
export function input(props = {}) {
  return h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', ...props, class: ['input', props.class] });
}
export function textarea(props = {}) {
  return h('textarea', { rows: 3, ...props, class: ['input', props.class] });
}

// ---------------------------------------------------------------------------------------------------------------
// modal

let modalDepth = 0;
export function modal({ title, body, actions, dismissible = true, size, class: cls, onClose } = {}) {
  const prevFocus = document.activeElement;
  const labelId = `m${Math.random().toString(36).slice(2, 8)}`;
  let resolve;
  const closed = new Promise((r) => (resolve = r));
  const scrim = h('div', { class: 'modal-scrim' });
  const dlg = h(
    'div',
    { class: ['modal', size && `modal-${size}`, 'paper', cls], role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? labelId : undefined, tabindex: '-1' },
    title && h('h2', { class: 'modal-title display', id: labelId }, title),
    h('div', { class: 'modal-body' }, body),
    actions && h('div', { class: 'modal-actions row gap-2' }, actions),
    dismissible && h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Close', onclick: () => api.close(undefined) }, icon('x')),
  );
  scrim.append(dlg);
  let done = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      api.close(undefined);
    } else if (e.key === 'Tab') {
      const f = $$('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])', dlg).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    }
  };
  const api = {
    el: dlg,
    scrim,
    closed,
    close(value) {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      scrim.classList.add('leaving');
      const finish = () => {
        scrim.remove();
        if (--modalDepth <= 0) document.body.classList.remove('modal-open');
        try {
          prevFocus?.focus?.({ preventScroll: true });
        } catch {
          /* gone */
        }
        onClose?.(value);
        resolve(value);
      };
      if (prefersReducedMotion()) finish();
      else setTimeout(finish, 160);
    },
  };
  if (dismissible) scrim.addEventListener('mousedown', (e) => e.target === scrim && api.close(undefined));
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  modalDepth++;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    const focusTarget = $('[autofocus], .btn-primary, .btn-gold', dlg) || $('button, input, textarea', dlg) || dlg;
    focusTarget.focus({ preventScroll: true });
  });
  return api;
}

export function confirmDialog({ title = 'Are you sure?', body, confirm = 'OK', cancel = 'Cancel', tone = 'primary' } = {}) {
  let m;
  const actions = [button(cancel, { variant: 'ghost', onclick: () => m.close(false) }), button(confirm, { variant: tone, onclick: () => m.close(true) })];
  m = modal({ title, body: typeof body === 'string' ? h('p', null, body) : body, actions, size: 'sm' });
  return m.closed.then((v) => v === true);
}

/** Close any open modal (route changes). */
export function closeAllModals() {
  $$('.modal-scrim').forEach((s) => s.remove());
  document.body.classList.remove('modal-open');
  modalDepth = 0;
}

// ---------------------------------------------------------------------------------------------------------------
// toast

export function toast(msg, opts = {}) {
  if (typeof msg === 'string') return coreToast({ title: msg, tone: 'accent', ttl: 4200, ...opts });
  return coreToast({ tone: 'accent', ttl: 5200, ...msg });
}

// ---------------------------------------------------------------------------------------------------------------
// motion

/** Typewriter into el.textContent. Returns a promise with .skip(). */
export function speak(target, str, { cps = 55, onChar, signal } = {}) {
  const full = String(str ?? '');
  let skipped = false;
  let resolveFn;
  const p = new Promise((resolve) => (resolveFn = resolve));
  const finish = () => {
    target.textContent = full;
    resolveFn();
  };
  if (prefersReducedMotion() || !full || cps <= 0) {
    finish();
    p.skip = () => {};
    return p;
  }
  target.textContent = '';
  const t0 = performance.now();
  let shown = 0;
  const tick = () => {
    if (skipped || signal?.aborted) return finish();
    const n = Math.min(full.length, Math.floor(((performance.now() - t0) / 1000) * cps));
    if (n !== shown) {
      shown = n;
      target.textContent = full.slice(0, n);
      onChar?.(full[n - 1], n);
    }
    if (n >= full.length) return resolveFn();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  p.skip = () => {
    skipped = true;
  };
  return p;
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function tween(from, to, { ms = 600, ease = easeOutCubic, onUpdate } = {}) {
  return new Promise((resolve) => {
    if (prefersReducedMotion() || ms <= 0 || from === to) {
      onUpdate?.(to);
      return resolve(to);
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      onUpdate?.(from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve(to);
    };
    requestAnimationFrame(step);
  });
}

/** Tween the number shown in an element. */
export function tweenText(target, to, { from, ms = 600, digits = 0, format, prefix = '', suffix = '' } = {}) {
  const start = from ?? (Number(String(target.textContent).replace(/[^0-9.-]/g, '')) || 0);
  const fmtv = format || ((v) => fmt.formatNumber(v, digits));
  target.dataset.tween = String(to);
  return tween(start, to, {
    ms,
    onUpdate: (v) => {
      if (target.dataset.tween === String(to)) target.textContent = prefix + fmtv(v) + suffix;
    },
  });
}

/** Paper confetti burst on a full-screen canvas that cleans up after itself. */
export function confetti({ count = 140, colors, origin = { x: 0.5, y: 0.35 }, duration = 2600, gravity = 900, spread = 1 } = {}) {
  if (prefersReducedMotion()) return Promise.resolve();
  const palette = colors || ['#b3263d', '#e9b949', '#f7dc8c', '#4fb3a5', '#b8a1e3', '#ee6c4d', '#f6ecd6'];
  const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const rand = rng(Date.now() & 0xffff);
  const bits = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.1 * spread;
    const v = 380 + rand() * 620;
    return { x: origin.x * W, y: origin.y * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + rand() * 8, h: 4 + rand() * 7, r: rand() * 6.28, vr: (rand() - 0.5) * 14, c: palette[Math.floor(rand() * palette.length)], tw: rand() * 6.28 };
  });
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = t0;
    const frame = (now) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const age = now - t0;
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += gravity * dt;
        b.vx *= 0.992;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        const flip = Math.cos(b.tw + age / 120);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.scale(1, flip);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - duration * 0.6) / (duration * 0.4));
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      if (age < duration) requestAnimationFrame(frame);
      else {
        canvas.remove();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}
