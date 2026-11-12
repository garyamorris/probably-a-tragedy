// Shared runtime for the eight flow views: the playback pacer, animation helpers, drag helper, view scaffold.
// DOM helpers come from core/dom.js (strings are text nodes); motion honours prefers-reduced-motion everywhere.
import { h, clear } from '../../core/dom.js';
import { icon, registerIcons } from '../../core/icons.js';
import { paceMs, humanize, nightLabel, indexById, TOUR_NIGHTS } from './pure.js';

registerIcons({ back: 'M20 12H5M11 6l-6 6 6 6', scroll: 'M7 4h11a2 2 0 0 1 2 2v1H9v11a2 2 0 0 1-2 2 2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 7h11v10a2 2 0 0 1-2 2H7', mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4' });

export { h, clear, icon };

/* ------------------------------------------------------------------------------------------ environment */

export function reduced() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  } catch {
    return false;
  }
}

/** Speed multiplier for the playback queue: ?pace=0 (instant) / 0.25 / 2 in the URL, or window.__VIEWS_SPEED. Default 1. */
export function globalSpeed() {
  try {
    const q = new URLSearchParams(location.search).get('pace') ?? new URLSearchParams(location.hash.split('?')[1] || '').get('pace');
    if (q != null && q !== '' && Number.isFinite(Number(q))) return Number(q);
  } catch { /* no location in node */ }
  const g = globalThis.__VIEWS_SPEED;
  return Number.isFinite(g) ? g : 1;
}

let cssDone = false;
/** Make sure css/views.css is loaded even if the shell forgot to link it. */
export function ensureStyles() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const already = [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => /views\.css(\?|$)/.test(l.getAttribute('href') || ''));
  if (already) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../../css/views.css', import.meta.url).href;
  document.head.appendChild(link);
}

/* ------------------------------------------------------------------------------------------ the life of a mounted view */

/**
 * One per mounted view: owns the AbortController handed to runFlow, the playback pacer, and cleanup callbacks.
 * `pace(ev)` is what you pass to runFlow; `fast` says "skip the flourish" (skip button / pace 0).
 */
export function createLife(ctx) {
  const ac = new AbortController();
  let instant = false;
  let dead = false;
  const speed0 = globalSpeed();
  let speed = speed0;
  const sleepers = new Set();
  const disposers = [];
  const life = {
    signal: ac.signal,
    get dead() { return dead; },
    get instant() { return instant || speed === 0; },
    get fast() { return life.instant || dead; },
    get speed() { return speed; },
    set speed(v) { speed = v; },
    /** Wait `ms` (scaled by speed); resolves at once when skipped or unmounted. */
    wait(ms) {
      if (life.fast || !(ms > 0)) return Promise.resolve();
      return new Promise((resolve) => {
        const rec = { resolve };
        rec.t = setTimeout(() => { sleepers.delete(rec); resolve(); }, ms / (speed || 1));
        sleepers.add(rec);
      });
    },
    /** Pass to runFlow({ pace }). The per-kind delay is scaled by the speed; call `render` first so the event shows immediately. */
    paceFor(render) {
      return async (ev) => {
        if (dead) return;
        try { render?.(ev); } catch (err) { console.error('[views] render failed for', ev?.kind, err); }
        await life.wait(paceMs(ev?.kind, 1));
      };
    },
    /** Skip button: finish waiting now and play everything else instantly. */
    skip() {
      instant = true;
      for (const s of sleepers) { clearTimeout(s.t); s.resolve(); }
      sleepers.clear();
      life.onskip?.();
    },
    /** Slow back down (e.g. after an interrupt, so the next phase plays at show speed again). */
    unskip() { instant = false; },
    onDispose(fn) { disposers.push(fn); return fn; },
    dispose() {
      if (dead) return;
      dead = true;
      ac.abort();
      for (const s of sleepers) { clearTimeout(s.t); s.resolve(); }
      sleepers.clear();
      for (const d of disposers.splice(0)) { try { d(); } catch (e) { console.error(e); } }
    },
    /** setTimeout that dies with the view. */
    later(fn, ms) {
      const t = setTimeout(() => { if (!dead) fn(); }, ms);
      disposers.push(() => clearTimeout(t));
      return t;
    },
  };
  // the shell aborts ctx.signal when this view unmounts: honour it even if unmount() is never called
  if (ctx?.signal) {
    if (ctx.signal.aborted) queueMicrotask(() => life.dispose());
    else ctx.signal.addEventListener('abort', () => life.dispose(), { once: true });
  }
  return life;
}

export const isAbort = (err) => err?.name === 'AbortError' || /cancel|abort/i.test(err?.message || '');

/* ------------------------------------------------------------------------------------------ animation helpers */

/**
 * Web Animations wrapper. The element's *natural CSS state is the final state*; we only animate FROM keyframes.
 * Resolves immediately (no animation) when reduced-motion or `life.fast`.
 */
export function play(el, frames, opts = {}, life = null) {
  if (!el || reduced() || life?.fast || typeof el.animate !== 'function') return Promise.resolve();
  const { duration = 450, easing = 'cubic-bezier(.34,1.56,.64,1)', delay = 0, fill = 'backwards' } = opts;
  try {
    const a = el.animate(frames, { duration, easing, delay, fill });
    return a.finished.catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/** Add a class for `ms` then remove it (CSS keyframe flourishes). */
export function flash(el, cls, ms = 700) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/** Typewriter that honours skip/reduced motion. Resolves when done; text ends complete either way. */
export function typewrite(target, str, { cps = 60, life, onChar } = {}) {
  const full = String(str ?? '');
  if (reduced() || life?.fast || !full || cps <= 0) { target.textContent = full; return Promise.resolve(); }
  return new Promise((resolve) => {
    target.textContent = '';
    const t0 = performance.now();
    let shown = 0;
    const tick = () => {
      if (life?.fast || life?.dead) { target.textContent = full; return resolve(); }
      const n = Math.min(full.length, Math.floor(((performance.now() - t0) / 1000) * cps * (life?.speed || 1)));
      if (n !== shown) { shown = n; target.textContent = full.slice(0, n); onChar?.(full[n - 1], n); }
      if (n >= full.length) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Count a number up inside an element. */
export function countTo(target, to, { from = 0, ms = 700, digits = 0, prefix = '', suffix = '', life, format } = {}) {
  const fmtv = format || ((v) => v.toFixed(digits));
  const done = () => { target.textContent = prefix + fmtv(to) + suffix; };
  if (reduced() || life?.fast || from === to || ms <= 0) { done(); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      if (life?.fast || life?.dead) { done(); return resolve(); }
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      target.textContent = prefix + fmtv(from + (to - from) * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
      else { done(); resolve(); }
    };
    requestAnimationFrame(step);
  });
}

/** Spawn short-lived particles (coins, ink drops, sparkles) from an element. Pure DOM + WAAPI. */
export function burst(origin, { n = 8, cls = 'v-spark', spread = 46, rise = 30, life: lf, text } = {}) {
  if (!origin || reduced() || lf?.fast) return;
  const r = origin.getBoundingClientRect();
  const host = document.querySelector('.v-view') || document.body;
  const hr = host.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const p = h('span', { class: cls, 'aria-hidden': 'true' }, text || '');
    p.style.cssText = `position:absolute;left:${r.left - hr.left + r.width / 2}px;top:${r.top - hr.top + r.height / 2}px;pointer-events:none;z-index:30`;
    host.appendChild(p);
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const d = spread * (0.5 + Math.random() * 0.7);
    const anim = p.animate?.([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - rise}px)) scale(1)`, opacity: 0 }], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' });
    if (anim) anim.finished.then(() => p.remove()).catch(() => p.remove());
    else p.remove();
  }
}

/* ------------------------------------------------------------------------------------------ pointer drag (mouse/pen only; touch uses tap-select) */

/**
 * Make `node` draggable onto elements matching `[data-drop]`. onDrop(dropEl) is called on release over a target.
 * A click that ends a drag is swallowed. `hover(dropEl|null)` lets the caller highlight targets.
 */
export function makeDraggable(node, { onDrop, hover, onStart, onEnd, ghostFrom = node, disabled } = {}) {
  let st = null;
  const down = (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' || disabled?.()) return;
    st = { x: e.clientX, y: e.clientY, active: false, ghost: null, over: null, pid: e.pointerId };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const dropAt = (x, y) => {
    const t = document.elementFromPoint(x, y)?.closest?.('[data-drop]') || null;
    return t;
  };
  const move = (e) => {
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.active && Math.hypot(dx, dy) > 7) {
      st.active = true;
      const r = ghostFrom.getBoundingClientRect();
      st.off = { x: st.x - r.left, y: st.y - r.top };
      st.ghost = ghostFrom.cloneNode(true);
      st.ghost.classList.add('v-ghost-drag');
      st.ghost.style.cssText += `;position:fixed;left:0;top:0;width:${r.width}px;margin:0;z-index:9000;pointer-events:none;`;
      document.body.appendChild(st.ghost);
      node.classList.add('v-dragging');
      document.body.classList.add('v-is-dragging');
      onStart?.();
    }
    if (st.active) {
      st.ghost.style.transform = `translate(${e.clientX - st.off.x}px, ${e.clientY - st.off.y}px) rotate(${Math.max(-8, Math.min(8, dx / 20))}deg) scale(1.04)`;
      const t = dropAt(e.clientX, e.clientY);
      if (t !== st.over) { hover?.(t); st.over = t; }
    }
  };
  const up = (e) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!st) return;
    const s = st;
    st = null;
    if (!s.active) return;
    s.ghost.remove();
    node.classList.remove('v-dragging');
    document.body.classList.remove('v-is-dragging');
    hover?.(null);
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    node.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => node.removeEventListener('click', swallow, { capture: true }), 60);
    const t = dropAt(e.clientX, e.clientY);
    onEnd?.(t);
    if (t) onDrop?.(t);
  };
  node.addEventListener('pointerdown', down);
  return () => node.removeEventListener('pointerdown', down);
}

/* ------------------------------------------------------------------------------------------ components */

/** Button wearing both Shell-Core's .btn classes (when its CSS is loaded) and our low-specificity .v-btn fallback. */
export function vbtn(label, { variant = 'paper', size, icon: ic, onclick, disabled, title, class: cls, type = 'button', id } = {}) {
  return h(
    'button',
    { class: ['btn', `btn-${variant}`, size && `btn-${size}`, 'v-btn', `v-btn-${variant}`, size && `v-btn-${size}`, cls], type, onclick, disabled, title, id },
    ic && icon(ic, size === 'sm' ? 'sm' : ''),
    h('span', { class: 'btn-label' }, label),
  );
}

export const kicker = (txt) => h('div', { class: 'kicker v-kicker' }, txt);

/** A small paper tag (flaw warnings, tag chips...). */
export function tag(txt, { tone = 'paper', ic, title, cls } = {}) {
  return h('span', { class: ['v-tag', `v-tag-${tone}`, cls], title }, ic && icon(ic, 'sm'), txt);
}

/** Paper card shell. */
export function paper(cls, ...kids) {
  return h('div', { class: ['v-paper', cls] }, ...kids);
}

/* ------------------------------------------------------------------------------------------ scaffold */

export function dataOf(ctx) {
  const d = ctx.data || {};
  return {
    performers: indexById(d.performers),
    performerList: Array.isArray(d.performers) ? d.performers : Object.values(indexById(d.performers)),
    staff: indexById(d.staff),
    genres: indexById(d.genres),
    towns: indexById(d.towns),
    flaws: indexById(d.flaws),
    critics: indexById(d.critics),
    cues: indexById(d.cues),
    roadEvents: indexById(d.road_events || d.roadEvents),
  };
}

/** The common input keys for a graph run. */
export function tourInput(ctx, extra = {}) {
  const t = ctx.tour || {};
  const p = ctx.params || {};
  return { tour_id: t.id, night: t.night ?? ctx.night ?? 0, seed: t.seed ?? 0, genre: p.genre, town: p.town, ...extra };
}

/**
 * What to hand to `ctx.nav(next, carry)`. The shell MERGES the carry into ctx.params for the rest of the night, so we pass only
 * the new outputs, plus genre and town re-asserted so any later view (and a lab that does not merge) still has them.
 */
export function carry(ctx, extra = {}) {
  const base = {};
  if (ctx.params?.genre) base.genre = ctx.params.genre;
  if (ctx.params?.town) base.town = ctx.params.town;
  return { ...base, ...extra };
}

/** The town after tonight, or null on the last night. */
export function nextTownId(ctx) {
  const t = ctx.tour || {};
  if (ctx.params?.next_town) return ctx.params.next_town;
  const towns = t.towns || [];
  return towns[(t.night ?? 0) + 1] ?? null;
}

/**
 * Standard page frame: header (kicker, title, hand-written sub, right-hand slot), a main area, and an action bar.
 * Returns the nodes plus `setKicker/setTitle/setSub` and `actions(...nodes)`.
 */
export function scaffold(root, ctx, { name, title, sub, kicker: k, extraKicker } = {}) {
  ensureStyles();
  const D = dataOf(ctx);
  const genre = D.genres[ctx.params?.genre];
  const town = D.towns[ctx.params?.town];
  const kickText = k ?? [nightLabel(ctx.tour?.night ?? ctx.night ?? 0, TOUR_NIGHTS), [genre?.name ?? (ctx.params?.genre && humanize(ctx.params.genre)), town?.name ?? (ctx.params?.town && humanize(ctx.params.town))].filter(Boolean).join(' in '), extraKicker].filter(Boolean).join('  ·  ');
  const kickEl = h('div', { class: 'kicker v-kicker' }, kickText);
  const titleEl = h('h1', { class: 'display v-title page-title' }, title);
  const subEl = h('p', { class: 'hand v-sub page-sub' }, sub || '');
  const slot = h('div', { class: 'v-head-slot' });
  const head = h('header', { class: 'v-head page-head' }, h('div', { class: 'v-head-text grow' }, kickEl, titleEl, subEl), slot);
  const main = h('div', { class: 'v-main' });
  const foot = h('footer', { class: 'v-foot' });
  const view = h('section', { class: ['v-view', `v-${name}`] }, head, main, foot);
  clear(root);
  root.appendChild(view);
  return {
    view, head, main, foot, slot, D, genre, town,
    setKicker: (t) => { kickEl.textContent = t; },
    setTitle: (t) => { titleEl.textContent = t; },
    setSub: (t) => { subEl.textContent = t; subEl.hidden = !t; },
    actions: (...nodes) => { clear(foot); for (const n of nodes) if (n) foot.appendChild(n); foot.classList.toggle('empty', !nodes.filter(Boolean).length); },
  };
}

/** The skip button that lives in the header slot while a run is being played. */
export function skipControl(life, slot) {
  const btn = vbtn('Skip', { variant: 'ghost', size: 'sm', icon: 'forward', title: 'Skip the flourishes: play the rest at once', class: 'v-skip', onclick: () => { life.skip(); btn.disabled = true; } });
  slot.appendChild(btn);
  return {
    el: btn,
    show() { btn.hidden = false; btn.disabled = life.instant; },
    hide() { btn.hidden = true; },
  };
}

/** Friendly error card with a retry. */
export function errorCard(err, { retry, title = 'The stagehands have dropped something' } = {}) {
  return h('div', { class: 'v-error v-paper' }, h('h3', { class: 'display' }, title), h('p', { class: 'hand' }, String(err?.message || err || 'Something went wrong behind the curtain.')), retry && vbtn('Try again', { variant: 'primary', onclick: retry }));
}
