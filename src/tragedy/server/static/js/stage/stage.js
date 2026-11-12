// The Stage: PROTOCOL 7.2. A canvas theatre that renders custom stream events.
//
//   const stage = new Stage(canvas, { data:{performers,staff,tastes,cues,props}, seed, reducedMotion });
//   await stage.apply(ev);   stage.token(actorId, text);   stage.speed = 1;   stage.reset();   stage.log;
//   await stage.seek(k);     stage.setGhost(events|null);  stage.getMetrics();   stage.on('actor'|'seat', cb);
//   stage.resize();          stage.destroy();
//
// The scene MODEL is the pure reducer in reduce.js; Scene (scene.js) owns every spring, string and particle.
// Extra, for the lab and golden screenshots: stage.manual (no rAF), stage.advance(ms), stage.renderNow(), stage.simTime.

import { initialState, reduce, reduceAll, isStageKind, metricsOf } from './reduce.js';
import { eventDuration } from './timing.js';
import { beatOffsets, ghostStateAt, ghostDiff, alignCursor } from './ghost.js';
import { fitStage, toStage } from './layout.js';
import { Scene, STEP } from './scene.js';
import { Sfx } from './audio.js';

const STEP_MS = STEP * 1000;

export class Stage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = opts.data || {};
    this.seed = opts.seed | 0;
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reducedMotion = opts.reducedMotion != null ? !!opts.reducedMotion : !!(mq && mq.matches);
    this._speed = 1;
    this._log = [];
    this._cursor = 0;
    this.state = initialState();
    this.waiters = [];
    this.listeners = { actor: [], seat: [] };
    this.simTime = 0;           // ms of simulated time
    this._acc = 0;
    this.manual = !!opts.manual;
    this._needSnap = false;
    this._sound = false;
    this.sfx = null;
    this._ghost = null;
    this.perf = { frames: 0, avg: 0, max: 0, last: 0, samples: [] };
    this.cw = 960; this.ch = 540; this.dpr = 1;
    this.destroyed = false;

    this.scene = new Scene({ data: this.data, seed: this.seed, reducedMotion: this.reducedMotion });
    this.scene.snap(this.state);
    this.resize();

    this._onMove = (e) => this._pointer(e, false);
    this._onDown = (e) => { if (e.pointerType !== 'mouse') this._pointer(e, false); };
    this._onLeave = () => { this.scene.hover = null; this.canvas.style.cursor = ''; };
    this._onClick = (e) => this._pointer(e, true);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointerleave', this._onLeave);
    canvas.addEventListener('click', this._onClick);
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas); }
    if (typeof document !== 'undefined') {
      this._hiddenTimer = setInterval(() => { if (document.hidden && !this.manual && !this.destroyed) this._advance(100); }, 100);
    }
    this._raf = 0;
    if (!this.manual) this._start();
    else this.renderNow();
  }

  // ---- public API ---------------------------------------------------------------------------------------------------------------
  get log() { return this._log; }
  get speed() { return this._speed; }
  set speed(v) {
    v = Number(v);
    this._speed = Number.isFinite(v) && v >= 0 ? v : 1;
    this.scene.ts = this._speed || 1;
    if (this._ghost) this._ghost.scene.ts = this._speed || 1;
    if (this._speed > 0 && this._needSnap) this._doSnap();
  }
  get cursor() { return this._cursor; }
  get sound() { return this._sound; }
  set sound(v) {
    this._sound = !!v;
    if (this._sound) {
      if (!this.sfx) this.sfx = new Sfx();
      this.sfx.ensure();
      this.scene.sfx = (n, a) => this.sfx.play(n, a);
    } else this.scene.sfx = null;
  }

  /** Apply ONE custom event envelope; resolves when its visuals have finished (immediately at speed 0). */
  apply(ev) {
    if (this.destroyed || !ev || !isStageKind(ev.kind)) return Promise.resolve();
    if (this._cursor < this._log.length) this._log.length = this._cursor; // applying after a seek forks the timeline
    if (ev.key != null && this.state.seen[ev.key]) return Promise.resolve();
    const prev = this.state;
    const next = reduce(prev, ev);
    this.state = next;
    this._log.push(ev);
    this._cursor = this._log.length;
    if (this._speed === 0) {
      this._needSnap = true;
      this._ghostRefresh(true);
      return Promise.resolve();
    }
    if (this._needSnap) this._doSnap(prev);   // fast-forwarded events are already on stage; animate only this one
    this.scene.ts = this._speed;
    this.scene.onEvent(ev, prev, next);
    this._ghostRefresh(false);
    return this.wait(eventDuration(ev) / this._speed);
  }

  /** A streamed LLM token: flap that speaker's jaw. */
  token(actorId, text) {
    this.scene.token(actorId, text);
    if (this._sound && this.sfx) { let h = 0; const s = String(actorId); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; this.sfx.blip(Math.abs(h), 0.6); }
  }

  reset() {
    this._flushWaiters();
    this._log = [];
    this._cursor = 0;
    this.state = initialState();
    this.scene.snap(this.state);
    this._needSnap = false;
    this._ghostRefresh(true);
    this.renderNow();
  }

  /** Rebuild the scene from log.slice(0,k) instantly, with no animation (scrubbing the film strip). */
  seek(k) {
    this._flushWaiters();
    k = Math.max(0, Math.min(this._log.length, k | 0));
    this.state = reduceAll(this._log.slice(0, k));
    this._cursor = k;
    this.scene.snap(this.state);
    this._needSnap = false;
    this._ghostRefresh(true);
    this.renderNow();
    return Promise.resolve();
  }

  /** Render an alternate timeline translucently behind the live one (null to clear). */
  setGhost(events) {
    if (!events || !events.length) {
      this._ghost = null; this.scene.ghostScene = null; this.scene.diff = null;
      return;
    }
    const scene = new Scene({ data: this.data, seed: this.seed + 17, reducedMotion: this.reducedMotion, ghost: true });
    scene.ts = this._speed || 1;
    this._ghost = { events: events.slice(), offsets: beatOffsets(events), scene, cursor: -1 };
    this.scene.ghostScene = scene;
    this._ghostRefresh(true);
  }

  getMetrics() { return metricsOf(this.state); }

  on(name, cb) {
    const L = this.listeners[name];
    if (!L) return () => {};
    L.push(cb);
    return () => { const i = L.indexOf(cb); if (i >= 0) L.splice(i, 1); };
  }
  off(name, cb) { const L = this.listeners[name]; if (L) { const i = L.indexOf(cb); if (i >= 0) L.splice(i, 1); } }

  resize() {
    if (this.destroyed) return;
    const cv = this.canvas;
    let w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) { w = this.cw || 960; h = this.ch || 540; }
    const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    this.cw = w; this.ch = h; this.dpr = dpr;
    this.scene.scale = fitStage(w, h).scale;
    if (this._ghost) this._ghost.scene.scale = this.scene.scale;
    this.renderNow();
  }

  destroy() {
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._hiddenTimer) clearInterval(this._hiddenTimer);
    if (this._ro) this._ro.disconnect();
    const cv = this.canvas;
    cv.removeEventListener('pointermove', this._onMove);
    cv.removeEventListener('pointerdown', this._onDown);
    cv.removeEventListener('pointerleave', this._onLeave);
    cv.removeEventListener('click', this._onClick);
    this._flushWaiters();
    this.listeners = { actor: [], seat: [] };
  }

  // ---- lab / testing hooks ------------------------------------------------------------------------------------------------------------
  /** Step the simulation by `ms` (fixed 60 Hz steps). Used by the lab for deterministic ?t= screenshots. */
  advance(ms) { this._advance(ms); }
  renderNow() {
    if (this.destroyed) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    if (this._needSnap && this._speed > 0) this._doSnap();
    try {
      this.scene.draw(this.ctx, this.cw, this.ch, this.dpr);
    } catch (err) {
      if (!this._drawWarned) { this._drawWarned = true; console.error('[stage] draw failed (continuing):', err); }
    }
    if (t0) this._sample(performance.now() - t0);
  }
  setReducedMotion(v) {
    this.reducedMotion = !!v;
    this.scene.setReducedMotion(this.reducedMotion);
    if (this._ghost) this._ghost.scene.setReducedMotion(this.reducedMotion);
    this.renderNow();
  }
  /** Wait `ms` of simulated time. */
  wait(ms) {
    if (!(ms > 0) || this.destroyed) return Promise.resolve();
    return new Promise((resolve) => { this.waiters.push({ due: this.simTime + ms, resolve }); });
  }

  // ---- internals ----------------------------------------------------------------------------------------------------------------------------
  _start() {
    let last = performance.now();
    const loop = (now) => {
      if (this.destroyed) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(100, now - last);
      last = now;
      const a0 = performance.now();
      this._advance(dt);
      if (this._needSnap && this._speed > 0) this._doSnap();
      try {
        this.scene.draw(this.ctx, this.cw, this.ch, this.dpr);
      } catch (err) {
        if (!this._drawWarned) { this._drawWarned = true; console.error('[stage] draw failed (continuing):', err); }
      }
      this._sample(performance.now() - a0);
    };
    this._raf = requestAnimationFrame((t) => { last = t; loop(t); });
  }

  _sample(ms) {
    const p = this.perf;
    p.frames++; p.last = ms;
    p.avg = p.avg ? p.avg * 0.95 + ms * 0.05 : ms;
    p.samples.push(ms); if (p.samples.length > 240) p.samples.shift();
    if (ms > p.max) p.max = ms;
  }

  _advance(ms) {
    this._acc += ms;
    let n = 0;
    while (this._acc >= STEP_MS && n < 12) {
      this._acc -= STEP_MS; n++;
      if (this._needSnap && this._speed > 0) this._doSnap();
      this.scene.update(STEP);
      if (this._ghost) this._ghost.scene.update(STEP);
      this.simTime += STEP_MS;
      if (this.waiters.length) {
        const due = [], keep = [];
        for (const w of this.waiters) (w.due <= this.simTime + 1e-6 ? due : keep).push(w);
        if (due.length) { this.waiters = keep; for (const w of due) w.resolve(); }
      }
    }
    if (n >= 12) this._acc = 0;
  }

  _flushWaiters() {
    const w = this.waiters; this.waiters = [];
    for (const x of w) x.resolve();
  }

  _doSnap(state) {
    this._needSnap = false;
    this.scene.ts = this._speed || 1;
    this.scene.snap(state || this.state);
    if (this._ghost) this._ghostRefresh(true);
  }

  _ghostRefresh(snap) {
    const g = this._ghost;
    if (!g) return;
    const cur = alignCursor(g.events, this.state, g.offsets);
    const gs = ghostStateAt(g.events, this.state, g.offsets);
    const back = g.cursor >= 0 && cur < g.cursor;
    g.scene.state = gs;
    if (snap || back || g.cursor < 0) g.scene.snap(gs);
    else if (cur !== g.cursor) { g.scene.ts = this._speed || 1; g.scene.syncActors(gs, true); g.scene.syncProps(gs, true); g.scene.syncClips(gs); }
    g.cursor = cur;
    this.scene.diff = ghostDiff(this.state, gs);
  }

  _pointer(e, click) {
    const r = this.canvas.getBoundingClientRect();
    const fit = fitStage(r.width, r.height);
    const p = toStage(fit, e.clientX - r.left, e.clientY - r.top);
    const hit = this.scene.pick(p.x, p.y);
    this.scene.hover = hit;
    if (e.type !== 'click') this.canvas.style.cursor = hit ? 'pointer' : '';
    if (click && hit) {
      const L = this.listeners[hit.type];
      if (L) for (const cb of L.slice()) { try { cb(hit.id, e); } catch (err) { console.error(err); } }
    }
  }
}

export { reduce, reduceAll, initialState } from './reduce.js';
