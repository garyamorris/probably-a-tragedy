// The Scene: everything that *moves*. It reads the pure reducer state (what is true) and keeps the view-only things
// (springs, verlet strings, particles, tweens, caches). One fixed 60 Hz step, deterministic given a seed.
// A Scene with {ghost:true} is the lightweight alternate-timeline layer (puppets + props only).

import {
  W, H, OPEN, LIP_Y, HORIZON_Y, FLOOR_Y, BAR_Y, PIT_Y, PROMPT, SLOT_FRAC,
  slotPos, propPos, seatPos, fitStage, clamp, lerp, hitTest,
} from './layout.js';
import { initialState, actorsOnStage } from './reduce.js';
import { mulberry32, hash01, hashInt, pick, noise1, flicker } from './rng.js';
import { spring, snapSpring, Particles, smooth, easeOutCubic, easeInCubic, easeOutBack, easeOutBounce, easeInOut, hump, clamp01 } from './anim.js';
import { Rope, knotTogether, tangleFor } from './verlet.js';
import { clipPose, identity } from './clips.js';
import { CLIP, lineDuration } from './timing.js';
import { setTint } from './color.js';
import { buildSpec, attachNames, attachLocal, toWorld, headWorld, drawPuppet, drawBody, drawBar, drawKnot, barAnchor } from './draw/puppet.js';
import { drawProp, PROP_H, HANGING, FLOATING } from './draw/props.js';
import { paintFlat, flatSize, FLAT_PAD, FLAT_W, FLAT_H, WING_H } from './draw/flats.js';
import { paintBack, paintFront, drawCurtains, drawFootlights, drawWarmGlow, drawPrompter, drawTassels } from './draw/frame.js';
import { drawSpectator, reactPose, REACT_DUR } from './draw/audience.js';
import { drawPips, drawBeatTag, drawWarmth, drawTangle, drawBanner, drawTicket, drawNameTag } from './draw/hud.js';
import { drawParticle, drawWash, drawSpot, drawFog, drawFlash, drawBolt, drawHatch, IMPACT, IMPACT_COLOR } from './draw/fx.js';
import { paper, rr, ell, circle, glow, rgrad, vgrad, hgrad, strokeOnly, fillOnly, FONT_UI } from './draw/shapes.js';
import { shade, mix, rgba, c } from './color.js';

export const STEP = 1 / 60;

const EMO_T = {
  neutral: { smile: 0.2, eye: 1, lid: 0, bl: 0, br: 0, rl: 0, rr: 0, blush: 0, happy: 0, aA: 0.14, aE: 0.2, tilt: 0, fold: 0, nod: 0, bounce: 0, trem: 0 },
  joy: { smile: 1, eye: 1, lid: 0, bl: 0, br: 0, rl: 0.5, rr: 0.5, blush: 0.45, happy: 1, aA: 1.75, aE: 0.35, tilt: 0.07, fold: -0.05, nod: -3, bounce: 1, trem: 0 },
  fear: { smile: -0.55, eye: 1.38, lid: 0, bl: -0.8, br: -0.8, rl: 0.9, rr: 0.9, blush: 0, happy: 0, aA: 0.95, aE: 1.75, tilt: 0, fold: 0.14, nod: 4, bounce: 0, trem: 1 },
  rage: { smile: -0.95, eye: 0.85, lid: 0, bl: 0.95, br: 0.95, rl: -0.2, rr: -0.2, blush: 0.55, happy: 0, aA: 0.5, aE: 1.45, tilt: 0, fold: 0.1, nod: 3, bounce: 0.3, trem: 0.5 },
  love: { smile: 0.95, eye: 1.08, lid: 0, bl: -0.15, br: -0.15, rl: 0.6, rr: 0.6, blush: 0.85, happy: 0.62, aA: 0.55, aE: 1.85, tilt: 0.13, fold: -0.02, nod: -2, bounce: 0.25, trem: 0 },
  grief: { smile: -1, eye: 0.72, lid: 0.25, bl: -0.9, br: -0.9, rl: 0.5, rr: 0.5, blush: 0, happy: 0, aA: 0.5, aE: 2.45, tilt: -0.1, fold: 0.1, nod: 7, bounce: 0, trem: 0.2 },
  smug: { smile: 0.65, eye: 0.72, lid: 0.38, bl: 0.25, br: -0.15, rl: 0, rr: 0.9, blush: 0, happy: 0, aA: 0.34, aE: 1.25, tilt: -0.07, fold: -0.04, nod: -3, bounce: 0, trem: 0 },
};
const EMO_KEYS = Object.keys(EMO_T.neutral);

const PROP_SCALE = { tree: 0.92, ladder: 0.95, clock: 0.9, harp: 0.92, door: 0.95, bed: 1.1, mirror: 0.95 };
const MOON_COL = { night: '#f7dc8c', dusk: '#f7e2a8', dawn: '#fbeccc', noon: '#f6efe6', storm: '#cdd0e0' };

const sgn = (v) => (v < 0 ? -1 : 1);

function indexData(data) {
  const m = (arr) => new Map((arr || []).map((x) => [x.id, x]));
  const d = data || {};
  return { performers: m(d.performers), staff: m(d.staff), tastes: m(d.tastes), cues: m(d.cues), props: m(d.props) };
}

function newPuppet(spec) {
  const names = attachNames(spec);
  return {
    id: spec.id, spec, phase: hash01('ph', spec.id) * 6.283,
    hx: 800, hxV: 0, xs: 800, xsV: 0, bx: 800, bxV: 0, x: 800, y: FLOOR_Y, footY: FLOOR_Y, lift: 0,
    rotS: 0, rotSV: 0, rot: 0, sx: 1, sy: 1, bend: 0, bendS: 0, bendSV: 0, fold: 0, foldS: 0, foldSV: 0, tilt: 0, tiltS: 0, tiltSV: 0, nod: 0, pivot: 0,
    armA: [0.14, 0.14], armE: [0.2, 0.2], walk: 0, walkAmp: 0, walkAmpS: 0,
    mouth: 0, mouthV: 0, flap: 0, talkUntil: -1,
    face: { mouth: 0, smile: 0.2, eye: 1, lid: 0, browL: 0, browR: 0, raiseL: 0, raiseR: 0, blush: 0, happy: 0, lookX: 0, lookY: 0, blink: 1, back: false, t: 0, talk: 0 },
    emo: { ...EMO_T.neutral }, emoName: 'neutral', lookX: 0, lookY: 0, blinkT: 2 + hash01('bl', spec.id) * 3, blinkV: 0,
    enter: null, exit: null, enterN: 0, exitN: 0, visible: false, presentNow: false,
    bar: { x: 800, y: BAR_Y, rot: 0, rotV: 0 },
    ropes: names.map(() => new Rope(9)), names, ropeInit: false, knots: [],
    clip: null, clipOut: identity(), animN: 0, knotAtt: 0, hover: 0, flash: 0, hop: 0, hopV: 0, dazed: false, dazedT: 0,
    pt: { love: 0.3, fear: 0.2, rage: 0.1, grief: 0, joy: 0.2, smug: 0.5, zz: 0 },
    hit: { id: spec.id, x: 0, y: 0, rx: 1, ry: 1 }, clipBelow: -1, alpha: 1,
  };
}

function newProp(id, i) {
  return { id, i, x: 800, y: FLOOR_Y, s: 1, dropY: -560, dropV: 0, delay: 0, rot: 0, rotV: 0, status: 'up', hang: HANGING.has(id), float: FLOATING.has(id), alpha: 1, leaving: false, lv: 0 };
}

function newSeat(i) {
  const pose = reactPose(null, -1, 0, { pop: 0, look: 0 });
  return { i, pop: 0, popV: 0, look: 0, lookV: 0, react: null, rn: 0, hover: 0, pose, zzT: 0, tearT: 0, hit: { id: i, x: 0, y: 0, rx: 1, ry: 1 } };
}

export class Scene {
  constructor(opts = {}) {
    this.data = opts.data || {};
    this.index = indexData(this.data);
    this.seed = opts.seed | 0;
    this.rm = !!opts.reducedMotion;
    this.ghost = !!opts.ghost;
    this.scale = 0.6;          // screen px per virtual unit (set by the Stage on resize)
    this.dpr = 1;
    this.specs = new Map();
    this.cache = { res: 0, back: null, front: null, flats: new Map() };
    this.sfx = null;
    this.ghostScene = null; this.diff = null; this.ghostMeters = null;
    this.reset();
  }

  setReducedMotion(v) { this.rm = !!v; }

  reset() {
    this.rnd = mulberry32(this.seed ^ 0x9e3779b9);
    this.t = 0; this.ts = 1;
    this.state = initialState();
    this.puppets = new Map(); this.props = new Map(); this.leaving = [];
    this.seats = Array.from({ length: 12 }, (_, i) => newSeat(i));
    this.particles = new Particles(900);
    this.effects = [];
    this.shake = 0; this.flash = 0; this.bolt = null; this.boltA = 0;
    this.curtain = { open: 0, openV: 0, delay: 0, gag: -1, speed: 0 };
    this.layers = [0, 1, 2].map(() => ({ cur: null, prev: null }));
    this.slide = { u: 1, el: 0, dur: 1.3 };
    this.setSeen = 0;
    this.display = { warmth: 40, warmthV: 0, chaos: 10, chaosV: 0, boost: 0, shakeBoost: 0 };
    this.mood = { wash: 0, washKind: 'gold', spot: 0, spotX: 800, spotY: 380, fog: 0 };
    this.beatAge = 99; this.bnN = 0; this.bn = null; this.tk = null; this.tkN = 0;
    this.hover = null; this.lantern = 0; this.freezeDim = 0; this.moonLook = 0; this.moonWince = 0;
    this.stageMoon = { bob: 0 };
  }

  specFor(id) {
    let s = this.specs.get(id);
    if (!s) {
      const rec = this.index.performers.get(id) || this.index.staff.get(id) || { id };
      s = buildSpec(rec); this.specs.set(id, s);
    }
    return s;
  }

  nameOf(id) {
    if (id === 'narrator') return 'The Moon';
    if (id === 'prompter') return 'The Prompter';
    const rec = this.index.performers.get(id) || this.index.staff.get(id);
    if (!rec) return id || '';
    const n = rec.name || id;
    if (n.length <= 16) return n;
    const parts = n.split(/\s+/);
    if (/^(Sir|Mr\.?|Mrs\.?|Dr\.?|Captain|Madame|Lady|Lord)$/i.test(parts[0]) && parts.length > 1) return parts[0] + ' ' + parts[parts.length - 1];
    return parts[0];
  }

  colorOf(id) {
    if (id === 'narrator') return '#e9b949';
    if (id === 'prompter') return '#e9b949';
    const rec = this.index.performers.get(id) || this.index.staff.get(id);
    return (rec && rec.palette && rec.palette.body) || '#6a4575';
  }

  // ---- state hookup -------------------------------------------------------------------------------------------------------
  /** Jump the whole view to match `state` (seek / reset / ghost refresh). No animation. */
  snap(state) {
    const keepGhost = this.ghostScene;
    this.reset();
    this.ghostScene = keepGhost;
    this.state = state;
    this.syncActors(state, false);
    this.syncProps(state, false);
    this.syncFlats(state, false);
    this.curtain.open = state.curtain === 'open' ? 1 : 0;
    this.display.warmth = state.meters.warmth; this.display.chaos = state.meters.chaos;
    this.mood.wash = state.mood.wash ? 1 : 0; this.mood.washKind = state.mood.wash || 'gold';
    this.mood.fog = state.mood.fog ? 1 : 0;
    if (state.mood.spot) { this.mood.spot = 1; const pv = this.puppets.get(state.mood.spot); if (pv) { this.mood.spotX = pv.x; this.mood.spotY = pv.y - pv.spec.geo.H * 0.5; } }
    for (let i = 0; i < 12; i++) this.seats[i].pop = state.seats[i] ? 1 : 0;
    this.syncBanner(state, false);
    this.syncDirect(state, false);
    if (state.beat.index >= 0) this.beatAge = 99;
    for (const pv of this.puppets.values()) {
      if (state.knotted && state.knotVictim === pv.id) pv.knotAtt = 1;
      const aa = state.actors[pv.id];
      pv.animN = aa && aa.anim ? aa.anim.n : 0;
      this.settlePuppet(pv);
    }
    for (const pr of this.props.values()) { pr.dropY = 0; pr.rot = pr.status === 'down' ? this.fallRot(pr) : 0; pr.delay = 0; }
    if (this.ghostScene) this.ghostScene.snap(this.ghostScene.state);
  }

  settlePuppet(pv) {
    const a = this.state.actors[pv.id];
    const sp = slotPos(a ? a.slot : 0);
    pv.hx = pv.xs = pv.bx = sp.x; pv.hxV = pv.xsV = pv.bxV = 0;
    pv.visible = !!(a && a.present);
    pv.presentNow = pv.visible;
    const e = EMO_T[(a && a.emotion) || 'neutral'] || EMO_T.neutral;
    for (const k of EMO_KEYS) pv.emo[k] = e[k];
    pv.emoName = (a && a.emotion) || 'neutral';
    pv.armA = [e.aA, e.aA]; pv.armE = [e.aE, e.aE];
    pv.ropeInit = false;
    this.updatePuppet(pv, a, STEP, true);
  }

  setState(state) { this.state = state; }

  /** React to one applied event: reconcile views with the new state and spawn the event's transients. */
  onEvent(ev, prev, next) {
    this.state = next;
    this.syncActors(next, true);
    this.syncProps(next, true);
    this.syncFlats(next, true);
    this.syncBanner(next, true);
    this.syncDirect(next, true);
    const d = ev.data || {};
    const ts = this.ts;
    switch (ev.kind) {
      case 'stage.beat': {
        this.beatAge = 0;
        this.moonWince = 0;
        for (let i = 0; i < 6; i++) this.particles.spawn('spark', 800 + (this.rnd() - 0.5) * 240, 62, { vy: -20 - this.rnd() * 30, vx: (this.rnd() - 0.5) * 80, life: 1.1 / ts, size: 9 + this.rnd() * 6, color: '#f7dc8c', rot: this.rnd() * 6 });
        this.sfx && this.sfx('chime', d.index);
        break;
      }
      case 'stage.set': this.sfx && this.sfx('slide'); break;
      case 'stage.mishap': this.onMishap(d, next, ev); break;
      case 'stage.decision': this.onDecision(d, next); break;
      case 'stage.cue': this.onCue(d, next); break;
      case 'stage.chain': this.onChain(d, next); break;
      case 'stage.curtain': this.onCurtain(d, next); break;
      case 'audience.seat': {
        const sv = this.seats[d.seat | 0];
        if (sv) { sv.pop = 0; sv.popV = 4; }
        break;
      }
      case 'audience.react': this.onReact(d, next); break;
      case 'audience.tally': {
        const dl = d.delta || 0;
        if (dl !== 0) {
          const big = this.u(24);
          this.particles.spawn('float', 65, 300, { vy: -46, life: 2.2 / ts, size: Math.max(34, big), text: (dl > 0 ? '+' : '') + (Math.round(dl * 10) / 10), color: dl > 0 ? '#f7dc8c' : '#ee6c4d' });
          this.display.boost = 1;
        }
        break;
      }
      case 'meter': break;
      case 'stage.line': {
        const pv = this.puppets.get(d.actor);
        if (pv) pv.talkUntil = this.t + lineDuration(d.text) / 1000 / ts;
        break;
      }
      default: break;
    }
  }

  u(px) { return px / Math.max(0.12, this.scale); }

  // ---- reconciliation -------------------------------------------------------------------------------------------------------
  syncActors(st, animate) {
    for (const id of st.order) {
      const a = st.actors[id];
      let pv = this.puppets.get(id);
      if (!pv) {
        pv = newPuppet(this.specFor(id));
        this.puppets.set(id, pv);
        if (!animate) { pv.enterN = a.enterN; pv.exitN = a.exitN; }
        const sp = slotPos(a.slot);
        pv.hx = pv.xs = pv.bx = sp.x; pv.x = sp.x;
      }
      if (animate) {
        if (a.enterN !== pv.enterN) { pv.enterN = a.enterN; if (a.present) this.startEnter(pv, a); }
        if (a.exitN !== pv.exitN) { pv.exitN = a.exitN; this.startExit(pv, a); }
      } else { pv.enterN = a.enterN; pv.exitN = a.exitN; pv.enter = pv.exit = null; }
    }
  }

  startEnter(pv, a) {
    const from = a.from === 'right' || a.from === 'trapdoor' || a.from === 'above' ? a.from : 'left';
    pv.enter = { el: 0, dur: (from === 'above' ? 1.1 : 0.95) / this.ts, from };
    pv.exit = null; pv.visible = true;
    const sp = slotPos(a.slot);
    if (from === 'trapdoor' && !this.ghost) {
      this.effects.push({ type: 'hatch', x: sp.x, y: sp.y - 4, age: 0, dur: pv.enter.dur + 0.7 / this.ts });
      for (let i = 0; i < 6; i++) this.particles.spawn('dust', sp.x + (this.rnd() - 0.5) * 80, sp.y + 4, { vx: (this.rnd() - 0.5) * 120, vy: -30 - this.rnd() * 40, life: 0.9 / this.ts, size: 14 + this.rnd() * 10, color: '#cdb8e8', layer: 1 });
    }
  }

  startExit(pv, a) {
    const to = a.exitTo === 'right' || a.exitTo === 'trapdoor' ? a.exitTo : 'left';
    pv.exit = { el: 0, dur: 0.85 / this.ts, to };
    pv.enter = null;
    const sp = slotPos(a.slot);
    if (to === 'trapdoor' && !this.ghost) this.effects.push({ type: 'hatch', x: sp.x, y: sp.y - 4, age: 0, dur: pv.exit.dur + 0.8 / this.ts });
  }

  syncProps(st, animate) {
    const ids = new Set();
    st.propsOn.forEach((p, i) => {
      ids.add(p.id);
      let pr = this.props.get(p.id);
      const pos = propPos(i);
      if (!pr) {
        pr = newProp(p.id, i);
        this.props.set(p.id, pr);
        if (animate) { pr.dropY = -560; pr.delay = (0.25 + i * 0.16) / this.ts; } else pr.dropY = 0;
      }
      pr.x = pos.x; pr.y = pos.y; pr.s = pos.s * (PROP_SCALE[p.id] || 1); pr.i = i;
      if (pr.status !== p.status) {
        const wasUp = pr.status === 'up';
        pr.status = p.status;
        if (animate && !this.ghost && p.status === 'down' && wasUp) this.knockFx(pr);
      }
    });
    for (const [id, pr] of this.props) {
      if (!ids.has(id)) {
        this.props.delete(id);
        if (animate && !this.ghost) { pr.leaving = true; pr.lv = 0; this.leaving.push(pr); }
      }
    }
  }

  knockFx(pr) {
    const h = (PROP_H[pr.id] || 80) * pr.s;
    const y = pr.hang ? OPEN.y0 + 30 + h : pr.y;
    for (let i = 0; i < 8; i++) this.particles.spawn(i % 2 ? 'dust' : 'bit', pr.x + (this.rnd() - 0.5) * 60, y - 6, { vx: (this.rnd() - 0.5) * 220, vy: -80 - this.rnd() * 140, ay: 520, life: 0.8 / this.ts, size: 6 + this.rnd() * 9, rot: this.rnd() * 6, vr: (this.rnd() - 0.5) * 10, color: i % 2 ? '#e6d6bd' : '#a06f48', layer: 1 });
    this.sfx && this.sfx('thud', 0.6);
  }

  fallRot(pr) { return pr.hang ? (pr.x < 800 ? 0.55 : -0.55) : (pr.x < 800 ? -1.5 : 1.5); }

  syncFlats(st, animate) {
    const s = st.set;
    const key = `${s.id}|${s.sky}|${JSON.stringify(s.palette || '')}`;
    if (this.ghost) return;
    if (this.layers[1].cur && this.layers[1].cur.key === key) return;
    if (s.id == null && !this.layers[1].cur) {
      // pre-show: a painted-night "stage" backdrop so the first frame is never empty
      for (let L = 0; L < 3; L++) this.layers[L].cur = { key: 'default', set: 'stage', sky: 'night', palette: null };
      return;
    }
    if (s.id == null) return;
    for (let L = 0; L < 3; L++) {
      const l = this.layers[L];
      l.prev = animate ? l.cur : null;
      l.cur = { key, set: s.id, sky: s.sky, palette: s.palette };
    }
    if (animate) { this.slide.u = 0; this.slide.el = 0; this.slide.dur = 1.35 / this.ts; this.slideDir = 1; } else this.slide.u = 1;
  }

  syncBanner(st, animate) {
    const b = st.banner;
    if (!b || b.n === this.bnN) return;
    this.bnN = b.n;
    this.setBanner(b.kind, b.who, b.text, b.label, animate);
  }

  setBanner(kind, who, text, label, animate = true) {
    const dur = kind === 'line' ? Math.max(0.6, lineDuration(text) / 1000 * 0.8) : Math.max(0.5, Math.min(2.6, text.length * 0.032));
    this.bn = {
      kind, who, text, label: label || '', name: this.nameOf(who), color: this.colorOf(who),
      el: animate ? 0 : 99, dur: dur / this.ts, progress: animate ? 0 : 1, slide: animate ? 0 : 1,
    };
  }

  syncDirect(st, animate) {
    const d = st.direct;
    if (d && d.n !== this.tkN) {
      this.tkN = d.n;
      this.tk = { text: d.text, el: animate ? 0 : 99, dur: Math.max(0.5, d.text.length * 0.026) / this.ts, progress: animate ? 0 : 1, slide: animate ? 0 : 1, leaving: false };
    } else if (!d && this.tk && !this.tk.leaving) { this.tk.leaving = true; this.tk.out = 0; if (!animate) this.tk = null; }
  }

  // ---- event transients -------------------------------------------------------------------------------------------------------------
  headOf(id, off = 0) {
    const pv = this.puppets.get(id);
    if (!pv) return [800, 300];
    const p = headWorld(pv.spec, pv, [0, 0]);
    p[1] -= off;
    return p;
  }

  /** Start clips for any actor whose mishap counter moved (used by the ghost layer, which has no onEvent). */
  syncClips(st) {
    for (const id of st.order) {
      const a = st.actors[id], pv = this.puppets.get(id);
      if (!pv || !a || !a.anim) continue;
      if (a.anim.n !== pv.animN) { pv.animN = a.anim.n; this.startClip(pv, a.anim.name); }
    }
  }

  startClip(pv, name, delay = 0, dirOverride) {
    const def = CLIP[name];
    if (!def) return;
    const dir = dirOverride || (name === 'lean_left' ? -1 : pv.hx < 800 ? 1 : -1);
    pv.clip = { name, el: -delay, dur: def.dur / 1000 / this.ts, hold: def.hold, dir };
  }

  onMishap(d, st, ev) {
    const pv = this.puppets.get(d.actor);
    const anim = st.mishap ? st.mishap.anim : d.anim;
    const ts = this.ts;
    if (pv) {
      const aa = st.actors[pv.id];
      if (aa && aa.anim) pv.animN = aa.anim.n;
      this.startClip(pv, anim);
      const hp = headWorld(pv.spec, pv, [0, 0]);
      const words = IMPACT[anim] || ['WHOOPS!'];
      const word = pick(words, 'word', ev.key || d.id, anim);
      const size = clamp(Math.max(48, this.u(14)), 48, 110);
      this.particles.spawn('word', clamp(hp[0], 330, 1270), clamp(hp[1] - pv.spec.geo.H * 0.28, 230, 400), { text: word, size, color: '#fff6e2', color2: IMPACT_COLOR[anim] || '#b3263d', life: 1.6 / ts, rot: (hash01('rot', ev.key || d.id) - 0.5) * 0.5, layer: 0 });
      this.shakeAmp(st.mishap && st.mishap.severity === 'major' ? 16 : 7);
      // per-anim particles
      const foot = [pv.x, pv.footY];
      if (anim === 'collapse' || anim === 'drop_prop' || anim === 'flip' || anim === 'slide') {
        for (let i = 0; i < 9; i++) this.particles.spawn('dust', foot[0] + (this.rnd() - 0.5) * 110, foot[1], { vx: (this.rnd() - 0.5) * 240, vy: -20 - this.rnd() * 60, life: 0.9 / ts, size: 12 + this.rnd() * 12, color: '#e6d6bd', delay: anim === 'collapse' ? 0.25 / ts : 0.4 / ts, layer: 1 });
      }
      if (anim === 'shake' || anim === 'wobble') for (let i = 0; i < 5; i++) this.particles.spawn('sweat', hp[0] + (i % 2 ? 36 : -36), hp[1] - 20, { vx: (i % 2 ? 1 : -1) * (60 + this.rnd() * 60), vy: -90 - this.rnd() * 60, ay: 420, life: 0.9 / ts, size: 9, delay: i * 0.07 / ts });
      if (anim === 'freeze') for (let i = 0; i < 10; i++) this.particles.spawn('spark', pv.x + (this.rnd() - 0.5) * 120, pv.y - this.rnd() * 220, { life: 1.2 / ts, size: 12, color: '#bfe8ff', rot: this.rnd() * 6, delay: this.rnd() * 0.3 / ts });
      if (anim === 'fly') for (let i = 0; i < 5; i++) this.particles.spawn('steam', pv.x + (this.rnd() - 0.5) * 60, pv.y - 30, { vy: 140 + this.rnd() * 80, vx: (this.rnd() - 0.5) * 60, life: 0.8 / ts, size: 16, color: '#e6d6bd', layer: 1 });
      if (anim === 'hide') this.particles.spawn('exclaim', hp[0], hp[1] - 70, { life: 1.2 / ts, size: 20 });
      if (anim === 'spin' || anim === 'slide') for (let i = 0; i < 6; i++) this.particles.spawn('spark', pv.x + (this.rnd() - 0.5) * 140, pv.y - 20 - this.rnd() * 160, { life: 0.8 / ts, size: 10, color: '#f7dc8c', delay: this.rnd() * 0.4 / ts, rot: this.rnd() * 6 });
    }
    // the person beside them gawps; the moon winces
    const other = this.puppets.get(d.other);
    if (other) { other.hop = 0; other.hopV = 90; }
    this.moonWince = 1;
    this.sfx && this.sfx(anim === 'collapse' || anim === 'drop_prop' ? 'thud' : 'boing', 1);
  }

  onDecision(d, st) {
    const ts = this.ts;
    const by = d.by || 'prompter';
    const target = st.decision && st.decision.target ? st.decision.target : (st.mishap && st.mishap.actor) || null;
    const col = by === 'madame' ? '#d8546b' : by === 'gus' ? '#bcd0ee' : '#f7dc8c';
    const from = by === 'madame' ? [OPEN.x0 + 70, OPEN.y0 + 40] : [PROMPT.x + 36, PROMPT.y - 30];
    this.lantern = 1;
    const to = target ? this.headOf(target) : [800, 300];
    this.effects.push({ type: 'whisper', from, to: [to[0], to[1] - 10], x: from[0], y: from[1], col, age: 0, dur: 0.95 / ts, target, trail: [], label: d.label || '', by });
    if (by === 'prompter') for (let k = 0; k < 2; k++) this.particles.spawn('ring', PROMPT.x, PROMPT.y - 26, { life: 0.9 / ts, size: 90, color: col, delay: k * 0.18 / ts });
    if (d.label) this.particles.spawn('float', PROMPT.x, PROMPT.y - 96, { vy: -34, life: 1.9 / ts, size: Math.max(34, this.u(14)), text: d.label, color: col });
    this.sfx && this.sfx('whisper', 1);
  }

  onCue(d, st) {
    const ts = this.ts;
    const cue = d.cue;
    const t = st.cue && st.cue.target ? this.puppets.get(st.cue.target) : null;
    const ok = (d.outcome || 'miracle') === 'miracle';
    const word = ok ? 'MIRACLE!' : 'MISFIRE!';
    this.particles.spawn('word', 800, 262, { text: word, size: clamp(Math.max(54, this.u(15)), 54, 112), color: '#fff6e2', color2: ok ? '#e0a82e' : '#ee6c4d', life: 1.5 / ts, rot: ok ? -0.1 : 0.12, layer: 0 });
    switch (cue) {
      case 'thunder':
        this.effects.push({ type: 'thunder', age: 0, dur: 2.8 / ts });
        this.shakeAmp(ok ? 14 : 8);
        this.sfx && this.sfx('thunder', 1);
        break;
      case 'trapdoor': {
        const sp = t ? { x: t.x, y: t.footY } : { x: 800, y: FLOOR_Y };
        this.effects.push({ type: 'hatch', x: sp.x, y: sp.y - 4, age: 0, dur: 2.1 / ts });
        if (t) { t.hop = 0; t.hopV = 240; if (!ok) this.startClip(t, 'wobble'); }
        for (let i = 0; i < 10; i++) this.particles.spawn(ok ? 'spark' : 'steam', sp.x + (this.rnd() - 0.5) * 80, sp.y, { vx: (this.rnd() - 0.5) * 120, vy: -90 - this.rnd() * 120, life: 1.1 / ts, size: 12 + this.rnd() * 8, color: ok ? '#f7dc8c' : '#8a7aa8', delay: 0.2 / ts + this.rnd() * 0.3 / ts, layer: 1 });
        this.sfx && this.sfx('trap', 1);
        break;
      }
      case 'curtain': this.curtain.gag = 0; this.sfx && this.sfx('slide'); break;
      case 'lights':
        for (let i = 0; i < 8; i++) this.particles.spawn('glint', OPEN.x0 + 120 + this.rnd() * (OPEN.w - 240), OPEN.y0 + 40 + this.rnd() * 220, { life: 0.9 / ts, size: 14, color: ok ? '#fff1b0' : '#d0ff80', rot: this.rnd() * 3, delay: this.rnd() * 0.5 / ts });
        this.sfx && this.sfx('click', 1);
        break;
      case 'spotlight': this.sfx && this.sfx('click', 1); break;
      case 'fog': this.sfx && this.sfx('whoosh', 1); break;
      default: break;
    }
  }

  onChain(d, st) {
    const ts = this.ts;
    const actors = d.actors || [];
    this.bnN = st.banner ? st.banner.n : this.bnN; // the chain drives the scroll itself, hop by hop
    this.effects.push({ type: 'chain', actors, lines: d.lines || [], bonus: d.bonus || 0, age: 0, hopDur: 0.9 / ts, hop: -1, ball: [PROMPT.x, PROMPT.y - 60], last: [PROMPT.x + 36, PROMPT.y - 40], dur: (0.9 * Math.max(1, actors.length) + 0.5) / ts });
  }

  onCurtain(d, st) {
    const ts = this.ts;
    const knot = !!d.knotted;
    const present = actorsOnStage(st);
    present.forEach((a, i) => { const pv = this.puppets.get(a.id); if (pv && !(knot && st.knotVictim === a.id)) this.startClip(pv, 'bow', i * 0.16); });
    this.curtain.delay = this.t + (knot ? 4.4 : 1.9) / ts;
    const warm = typeof d.warmth === 'number' ? d.warmth : st.meters.warmth;
    if (knot) this.shakeAmp(10);
    if (warm >= 60 && !knot) {
      for (let i = 0; i < 44; i++) this.particles.spawn('confetti', OPEN.x0 + this.rnd() * OPEN.w, OPEN.y0 + 20 + this.rnd() * 40, { vx: (this.rnd() - 0.5) * 120, vy: 60 + this.rnd() * 160, ay: 40, life: (2.4 + this.rnd()) / ts, size: 14 + this.rnd() * 10, rot: this.rnd() * 6, vr: (this.rnd() - 0.5) * 8, color: pick(['#e9b949', '#d8546b', '#4fb3a5', '#b8a1e3', '#f6ecd6'], 'cf', i), delay: this.rnd() * 0.8 / ts });
      for (let i = 0; i < 8; i++) this.particles.spawn('heart', 400 + i * 110, LIP_Y - 20, { vy: -90 - this.rnd() * 60, life: 2.2 / ts, size: 34, color: '#ee6c4d', rot: this.rnd() * 6, delay: this.rnd() * 0.6 / ts });
      this.sfx && this.sfx('applause', 1);
    }
    this.sfx && this.sfx('close', 1);
  }

  onReact(d, st) {
    const sv = this.seats[d.seat | 0];
    if (!sv) return;
    const seat = st.seats[d.seat | 0];
    if (!seat || !seat.react) return;
    const r = seat.react;
    const ts = this.ts;
    sv.react = { type: r.reaction, k: r.intensity, age: 0 };
    sv.rn = r.n;
    const pos = seatPos(sv.i);
    const k = r.intensity;
    switch (r.reaction) {
      case 'laugh':
        this.particles.spawn('puff', pos.x + 8, pos.y - 74 * pos.s, { text: pick(['HA!', 'HAHA!', 'HEE!', 'HO!'], 'laugh', sv.i, r.n), size: clamp(Math.max(30, this.u(14)), 30, 54) * (0.8 + k * 0.4), color: '#b3263d', life: 1.5 / ts, rot: (this.rnd() - 0.5) });
        this.sfx && this.sfx('laugh', k);
        break;
      case 'gasp':
        this.particles.spawn('puff', pos.x + 8, pos.y - 74 * pos.s, { text: pick(['OH!', 'GASP!', 'OOH!'], 'gasp', sv.i, r.n), size: clamp(Math.max(30, this.u(14)), 30, 54), color: '#2f5aa0', life: 1.3 / ts, rot: (this.rnd() - 0.5) });
        this.sfx && this.sfx('gasp', k);
        break;
      case 'boo': {
        const tx = clamp(pos.x + (this.rnd() - 0.5) * 260, 300, 1300), T = 0.95 / ts, ay = 1500;
        const x0 = pos.x, y0 = pos.y - 50 * pos.s;
        this.particles.spawn('tomato', x0, y0, { vx: (tx - x0) / T, vy: (LIP_Y - 10 - y0 - 0.5 * ay * T * T) / T, ay, vr: 9, life: T, size: 17 + k * 7, layer: 0 });
        this.effects.push({ type: 'splat', at: T, age: 0, x: tx, y: LIP_Y - 10 });
        this.particles.spawn('puff', pos.x + 10, pos.y - 78 * pos.s, { text: 'BOO!', size: clamp(Math.max(30, this.u(14)), 30, 54), color: '#fff6e2', color2: '#d6361f', life: 1.4 / ts });
        this.sfx && this.sfx('boo', k);
        break;
      }
      case 'applaud':
        for (let i = 0; i < 6; i++) this.particles.spawn('spark', pos.x + (this.rnd() - 0.5) * 100, pos.y - 20 - this.rnd() * 90, { life: 1.1 / ts, size: 13, color: '#f7dc8c', rot: this.rnd() * 6, delay: this.rnd() * 0.5 / ts });
        this.sfx && this.sfx('clap', k);
        break;
      case 'cry': this.sfx && this.sfx('sniff', k); break;
      case 'yawn': this.sfx && this.sfx('yawn', k); break;
      default: break;
    }
  }

  shakeAmp(a) { if (!this.rm) this.shake = Math.max(this.shake, a); }

  /** A streamed LLM token: flap that speaker's jaw. */
  token(actorId, text) {
    const pv = this.puppets.get(actorId);
    if (!pv) return;
    const s = String(text || '');
    pv.flap = 0.55 + 0.45 * hash01('tok', s, Math.floor(this.t * 20));
    pv.talkUntil = Math.max(pv.talkUntil, this.t + 0.28);
    if (!this.ghost && s.length > 2 && this.rnd() < 0.35) this.particles.spawn('note', pv.x + (this.rnd() - 0.5) * 50, pv.y - pv.spec.geo.H * 1.05, { vy: -50, life: 0.7, size: 14, color: '#b8a1e3' });
  }

  // ---- the fixed-step update ------------------------------------------------------------------------------------------------------
  update(dt) {
    const sc = this;
    sc.t += dt;
    const ts = sc.ts;
    const st = sc.state;
    sc.beatAge += dt;
    sc.shake *= Math.exp(-dt * 3.2);
    sc.flash *= Math.exp(-dt * 9);
    sc.boltA *= Math.exp(-dt * 7);
    sc.lantern *= Math.exp(-dt * 1.6);
    sc.display.boost *= Math.exp(-dt * 2.5);
    sc.moonWince *= Math.exp(-dt * 1.2);

    // meters
    spring(sc.display, 'warmth', st.meters.warmth, 5 * Math.min(ts, 2), 0.9, dt);
    spring(sc.display, 'chaos', st.meters.chaos, 5 * Math.min(ts, 2), 0.9, dt);

    // curtain
    const cu = sc.curtain;
    let tgt = st.curtain === 'open' && sc.t >= cu.delay ? 1 : 0;
    if (cu.gag >= 0) { cu.gag += dt; const g = cu.gag * ts; if (g > 0.15 && g < 1.05) tgt = 0; if (g > 1.9) cu.gag = -1; }
    if (st.curtain === 'closed' && sc.t < cu.delay) tgt = 1;
    spring(cu, 'open', tgt, (sc.rm ? 18 : 5.2) * Math.min(ts, 2), sc.rm ? 1 : 0.85, dt);
    cu.open = clamp(cu.open, 0, 1);
    cu.speed = Math.abs(cu.openV);

    // mood
    const m = sc.mood, ms = st.mood;
    m.wash += ((ms.wash ? 1 : 0) - m.wash) * (1 - Math.exp(-dt * 3));
    if (ms.wash) m.washKind = ms.wash;
    m.fog += ((ms.fog ? 1 : 0) - m.fog) * (1 - Math.exp(-dt * 1.2));
    m.spot += ((ms.spot ? 1 : 0) - m.spot) * (1 - Math.exp(-dt * 3));
    if (ms.spot) {
      const pv = sc.puppets.get(ms.spot);
      if (pv) { m.spotX += (pv.x - m.spotX) * (1 - Math.exp(-dt * 5)); m.spotY += (pv.y - pv.spec.geo.H * 0.5 - m.spotY) * (1 - Math.exp(-dt * 5)); }
    }
    sc.freezeDim += ((st.pending ? 1 : 0) - sc.freezeDim) * (1 - Math.exp(-dt * 3));

    // flats groove slide
    if (sc.slide.u < 1) { sc.slide.el += dt; sc.slide.u = clamp01(sc.slide.el / sc.slide.dur); if (sc.slide.u >= 1) for (const l of sc.layers) l.prev = null; }

    // puppets
    if (!sc.ghost) sc.stageMoon.bob = Math.sin(sc.t * 0.9) * 5;
    for (const pv of sc.puppets.values()) sc.updatePuppet(pv, st.actors[pv.id], dt, false);
    // props
    for (const pr of sc.props.values()) sc.updateProp(pr, dt);
    for (let i = sc.leaving.length - 1; i >= 0; i--) { const pr = sc.leaving[i]; pr.lv += dt * ts; pr.dropY -= 900 * dt * ts * (0.3 + pr.lv); pr.alpha = 1 - clamp01(pr.lv / 0.8); if (pr.lv > 0.8) sc.leaving.splice(i, 1); }

    if (sc.ghost) return;

    // seats
    for (const sv of sc.seats) sc.updateSeat(sv, dt);
    // banner + ticket
    const bn = sc.bn;
    if (bn) { bn.el += dt; bn.progress = clamp01(bn.el / bn.dur); bn.slide = clamp01(bn.el / 0.28); }
    const tk = sc.tk;
    if (tk) {
      if (!tk.leaving) { tk.el += dt; tk.progress = clamp01(tk.el / tk.dur); tk.slide = clamp01(tk.el / 0.45); }
      else { tk.out += dt; tk.slide = 1 - clamp01(tk.out / 0.4); if (tk.out >= 0.4) sc.tk = null; }
    }
    sc.updateEffects(dt);
    sc.particles.update(dt);
  }

  updatePuppet(pv, a, dt, snapping) {
    const sc = this;
    const sp = pv.spec, g = sp.geo, H = g.H, t = sc.t, ts = sc.ts;
    const present = !!(a && a.present);
    const slot = slotPos(a ? a.slot : 0);
    const st = sc.state;
    const rm = sc.rm;

    // ---- scripted entrance / exit
    let offX = 0, offY = 0, lift = 0, walkAmp = 0, clipBelow = -1;
    if (pv.enter) {
      const e = pv.enter; e.el += dt; const u = clamp01(e.el / e.dur);
      if (e.from === 'left' || e.from === 'right') {
        const sx0 = e.from === 'left' ? OPEN.x0 - 170 : OPEN.x1 + 170;
        offX = (sx0 - slot.x) * (1 - easeOutCubic(u)); walkAmp = u < 1 ? 1 : 0;
      } else if (e.from === 'trapdoor') { offY = (H + 60) * (1 - easeOutBack(u)); clipBelow = u < 1 ? slot.y + 4 : -1; }
      else { lift = -480 * (1 - easeOutBounce(u)); }
      if (rm) { offX *= 0; offY *= 0; lift *= 0; pv.alpha = smooth(u); } else pv.alpha = 1;
      if (u >= 1) { pv.enter = null; pv.alpha = 1; }
    } else if (pv.exit) {
      const e = pv.exit; e.el += dt; const u = clamp01(e.el / e.dur);
      if (e.to === 'left' || e.to === 'right') {
        const x1 = e.to === 'left' ? OPEN.x0 - 190 : OPEN.x1 + 190;
        offX = (x1 - slot.x) * easeInCubic(u); walkAmp = 1;
      } else { offY = (H + 80) * smooth(u); clipBelow = slot.y + 4; }
      pv.alpha = rm ? 1 - smooth(u) : 1;
      if (u >= 1) { pv.exit = null; pv.visible = false; pv.alpha = 1; }
    }
    pv.presentNow = present;
    if (!present && !pv.exit && !pv.enter) pv.visible = false;
    if (present && !pv.enter && !pv.exit) pv.visible = true;
    pv.clipBelow = clipBelow;
    if (!pv.visible && !snapping) { pv.hover *= 0.9; return; }

    // ---- emotion smoothing (+ a dazed look while the stage waits on the Prompter)
    const emoName = (a && a.emotion) || 'neutral';
    const et = EMO_T[emoName] || EMO_T.neutral;
    const k = 1 - Math.exp(-dt * 7);
    for (const key of EMO_KEYS) pv.emo[key] += (et[key] - pv.emo[key]) * (snapping ? 1 : k);
    pv.emoName = emoName;
    const emo = pv.emo;

    // ---- the mishap clip (holds its peak pose while the Prompter decides)
    let co = pv.clipOut;
    if (pv.clip) {
      const cl = pv.clip;
      const pending = st.pending && st.mishap && st.mishap.actor === pv.id && !st.mishap.resolved;
      let adv = dt;
      if (cl.hold != null && cl.el / cl.dur >= cl.hold && pending) adv = 0;
      cl.el += adv;
      const u = cl.el / cl.dur;
      if (u >= 1) { pv.clip = null; identity(co); }
      else if (u < 0) identity(co);
      else clipPose(cl.name, u, { H, dir: cl.dir, rm }, co);
    } else identity(co);

    // dazed: the clip is over but the Prompter has not answered yet
    const pendingMine = !!(st.pending && st.mishap && st.mishap.actor === pv.id && !st.mishap.resolved);
    const dazed = pendingMine && !pv.clip && !snapping;
    if (dazed && !pv.dazed && !sc.ghost) sc.particles.spawn('exclaim', pv.x, pv.y - H * 1.12, { life: 1.6 / ts, size: 22, text: '?' });
    pv.dazed = dazed;
    if (dazed && !sc.ghost) {
      pv.dazedT += dt;
      if (pv.dazedT > 0.55) { pv.dazedT = 0; const hp = headWorld(sp, pv, [0, 0]); sc.particles.spawn('stars_orbit', hp[0], hp[1] - g.headR * 1.3, { life: 0.9, size: 17 }); }
    }

    // ---- sway, positions
    const sway = (rm ? 0.15 : 1) * co.sway * (pv.knotAtt > 0.2 ? 0.4 : 1);
    const tremble = emo.trem * (rm ? 0 : 1) + (co.shake || 0);
    const swayX = Math.sin(t * 0.83 + pv.phase) * 6 * sway + Math.sin(t * 2.1 + pv.phase * 2) * 1.6 * sway;
    if (snapping || !pv.ropeInit) { pv.hx = slot.x; pv.hxV = 0; }
    spring(pv, 'hx', slot.x, 9 * Math.min(ts, 3), 0.85, dt);
    const barTargetX = pv.hx + offX + swayX + co.dx * 0.35;
    if (snapping || !pv.ropeInit || pv.enter || pv.exit) { pv.bx = barTargetX; pv.xs = barTargetX; pv.bxV = pv.xsV = 0; }
    else {
      spring(pv, 'bx', barTargetX, 12 * Math.min(ts, 3), 0.9, dt);
      spring(pv, 'xs', pv.bx, 8 * Math.min(ts, 3), 0.5, dt);
    }
    pv.x = pv.xs + co.dx * 0.65 + (tremble > 0.02 ? Math.sin(t * 61 + pv.phase) * 1.8 * tremble : 0);
    const bounce = emo.bounce * (rm ? 0 : 1) * Math.abs(Math.sin(t * 5.2 + pv.phase)) * 5;
    spring(pv, 'hop', 0, 14, 0.4, dt);
    const hopY = -Math.max(0, pv.hop);
    pv.lift = lift;
    pv.footY = slot.y + (offY > 0 ? 0 : 0);
    pv.y = slot.y + offY + lift + co.dy - bounce + hopY + Math.sin(t * 1.5 + pv.phase) * 1.4 * sway;
    pv.pivot = co.pivot;

    // knot lift (the finale)
    const victim = st.knotted && st.knotVictim === pv.id;
    pv.knotAtt += ((victim ? 1 : 0) - pv.knotAtt) * Math.min(1, dt / ((victim ? 2.6 : 0.5) / ts));
    const ka = smooth(pv.knotAtt);
    pv.y -= 96 * ka;

    // rotation
    spring(pv, 'rotS', Math.sin(t * 1.1 + pv.phase) * 0.022 * sway - pv.xsV * 0.0011 + (pv.dazed ? Math.sin(t * 3) * 0.05 : 0), 11, 0.55, dt);
    pv.rot = pv.rotS + co.rot + Math.PI * easeOutBack(ka) * (rm ? 0 : 1) + (walkAmp > 0 ? Math.sin(pv.walk * 0.5) * 0.04 : 0);
    if (ka > 0.01) pv.pivot = H * 0.5;
    const baseS = slot.s;
    pv.sx = baseS * co.sx * (1 + Math.sin(t * 1.6 + pv.phase) * 0.006);
    pv.sy = baseS * co.sy * (1 + Math.sin(t * 1.6 + pv.phase + 1) * 0.008);
    spring(pv, 'bendS', emo.tilt * 0.12, 12, 0.7, dt);
    pv.bend = pv.bendS + co.bend;
    spring(pv, 'foldS', emo.fold, 10, 0.75, dt);
    pv.fold = clamp(pv.foldS + co.fold, -0.2, 1);
    const talk = pv.talkUntil > t ? 1 : 0;
    spring(pv, 'tiltS', emo.tilt + (talk ? Math.sin(t * 4.1 + pv.phase) * 0.035 : 0), 10, 0.7, dt);
    pv.tilt = pv.tiltS + co.tilt;
    pv.nod = emo.nod + (talk ? Math.sin(t * 8.2) * 1.5 : 0);

    // walk cycle
    pv.walkAmpS += ((Math.max(walkAmp, co.walk > 0 ? Math.min(1.6, co.walk) : 0)) - pv.walkAmpS) * (1 - Math.exp(-dt * 12));
    pv.walkAmp = pv.walkAmpS;
    pv.walk += dt * (9 + pv.walkAmp * 3) * (pv.walkAmp > 0.05 ? 1 : 0);
    if (pv.walkAmp > 0.05) pv.y -= Math.abs(Math.sin(pv.walk)) * 6 * pv.walkAmp * (rm ? 0 : 1);

    // arms
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      let aA = emo.aA + co.armUp + (talk ? 0.22 + Math.sin(t * 4.4 + i * 2 + pv.phase) * 0.28 : 0) - pv.xsV * 0.0016 * side;
      let aE = emo.aE;
      if (co.flail) { aA += Math.sin(t * 15 + i * 2.2) * 0.9 * co.flail; aE += Math.sin(t * 13 + i) * 0.5 * co.flail; }
      if (ka > 0.05) { aA = lerp(aA, 2.6 + Math.sin(t * 3 + i) * 0.25, ka); aE = lerp(aE, 0.3, ka); }
      if (pv.walkAmp > 0.05) aA += Math.sin(pv.walk + i * Math.PI) * 0.35 * pv.walkAmp;
      const kk = snapping ? 1 : 1 - Math.exp(-dt * 11);
      pv.armA[i] += (aA - pv.armA[i]) * kk;
      pv.armE[i] += (aE - pv.armE[i]) * kk;
    }

    // ---- face
    const f = pv.face;
    f.t = t;
    // blink
    pv.blinkT -= dt;
    if (pv.blinkT <= 0) { pv.blinkV = 0.13; pv.blinkT = 2.4 + hash01('blink', pv.id, Math.floor(t)) * 3.4; }
    if (pv.blinkV > 0) pv.blinkV -= dt;
    f.blink = pv.blinkV > 0 ? 0.1 : 1;
    f.eye = clamp(emo.eye + co.eye, 0.05, 1.5);
    f.lid = emo.lid; f.smile = emo.smile; f.blush = emo.blush; f.happy = emo.happy > 0.55 && co.eye <= 0.05 ? emo.happy : 0;
    f.browL = emo.bl; f.browR = emo.br; f.raiseL = emo.rl + co.eye * 0.8; f.raiseR = emo.rr + co.eye * 0.8;
    // look
    let lx = 0, ly = 0;
    const spk = st.speaker;
    const sv = spk && spk !== pv.id ? sc.puppets.get(spk) : null;
    if (sv) lx = clamp((sv.x - pv.x) / 280, -1, 1);
    else if (st.mishap && st.mishap.other === pv.id && !st.mishap.resolved) { const o = sc.puppets.get(st.mishap.actor); if (o) lx = clamp((o.x - pv.x) / 280, -1, 1); }
    else { lx = noise1(t * 0.35 + pv.phase, 5) * 0.45; ly = 0.3 + noise1(t * 0.3 + pv.phase, 9) * 0.2; }
    if (co.peek > 0.3) { lx = Math.sin(t * 7) * 0.9; ly = -0.2; }
    pv.lookX += (lx - pv.lookX) * (1 - Math.exp(-dt * 6)); pv.lookY += (ly - pv.lookY) * (1 - Math.exp(-dt * 6));
    f.lookX = pv.lookX; f.lookY = pv.lookY;

    // mouth: typewriter-driven jaw flaps, streamed tokens, mishap gasps
    let mt = 0;
    const bn = sc.bn;
    if (bn && bn.kind === 'line' && bn.who === pv.id && bn.progress < 1) {
      const idx = Math.max(0, Math.ceil(bn.text.length * bn.progress) - 1);
      mt = jawFor(bn.text[idx], idx);
    } else if (bn && (bn.kind === 'chain' || bn.kind === 'decision') && bn.who === pv.id && bn.progress < 1) {
      const idx = Math.max(0, Math.ceil(bn.text.length * bn.progress) - 1);
      mt = jawFor(bn.text[idx], idx);
    }
    pv.flap *= Math.exp(-dt * 11);
    mt = Math.max(mt, pv.flap);
    if (co.mouth >= 0) mt = Math.max(mt, co.mouth);
    if (pv.dazed) mt = Math.max(mt, 0.22);
    spring(pv, 'mouth', mt, 42, 0.75, dt);
    f.mouth = clamp(pv.mouth, 0, 1);
    f.talk = talk;

    // hover
    const hv = sc.hover && sc.hover.type === 'actor' && sc.hover.id === pv.id ? 1 : 0;
    pv.hover += (hv - pv.hover) * (1 - Math.exp(-dt * 12));
    pv.flash *= Math.exp(-dt * 3);

    // ---- strings (verlet) + knots
    sc.updateRopes(pv, dt, co, ka, snapping);

    // ---- particles from feelings
    if (!sc.ghost && !snapping && pv.visible && !pv.enter) sc.emote(pv, emoName, dt);

    // hit area
    pv.hit.x = pv.x; pv.hit.y = pv.y - H * 0.5 * pv.sy; pv.hit.rx = H * 0.27 * Math.abs(pv.sx); pv.hit.ry = H * 0.56 * pv.sy;
    if (ka > 0.5) pv.hit.y = pv.y - H * 0.35;
  }

  updateRopes(pv, dt, co, ka, snapping) {
    const sp = pv.spec, t = this.t;
    const chaos = this.display.chaos;
    const tg = tangleFor(chaos + (this.state.knotted ? 30 : 0));
    const names = ka > 0.2 ? KNOT_ATTACH.slice(0, pv.names.length) : pv.names;
    const n = pv.ropes.length;
    // control bar follows the puppet, tilting with its lean and lifting with the clip
    const bar = pv.bar;
    bar.x = pv.bx;
    bar.y = BAR_Y + co.barLift - 26 * smooth(ka);
    spring(bar, 'rot', Math.sin(t * 0.9 + pv.phase) * 0.04 * co.sway + (pv.rot + pv.bend) * 0.22 + (pv.tilt) * 0.1, 10, 0.6, dt);
    const ak = [0, 0], bk = [0, 0];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const name = names[i];
      barAnchor(bar, name, ak);
      const lp = attachLocal(sp, pv, name);
      toWorld(pv, lp[0], lp[1], bk);
      const dist = Math.hypot(bk[0] - ak[0], bk[1] - ak[1]);
      const rope = pv.ropes[i];
      if (!pv.ropeInit || snapping) rope.reset(ak[0], ak[1], bk[0], bk[1]);
      const breathe = 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.7 + pv.phase));
      const jitter = tg.t * 0.1 * (0.5 + 0.5 * Math.sin(t * 1.9 + i * 2.3));
      let slack = breathe + jitter + co.slack * 0.7 - ka * 0.04;
      if (this.rm) slack = 0.05 + co.slack * 0.5;
      const rest = dist * (1 + slack) + 2;
      rope.step(STEP, ak[0], ak[1], bk[0], bk[1], rest, { g: 1500, wind: this.rm ? 0 : Math.sin(t * 0.6 + i) * 260 * tg.t, iters: 5 });
      pts.push(ak[0]);
    }
    pv.ropeInit = true;
    pv.knots.length = 0;
    // tangle: pull neighbouring strings together at mid-height so knots visibly form
    if (n >= 2 && (tg.knots > 0 || ka > 0.02)) {
      const pairs = [[0, 1, 4], [n - 2, n - 1, 3], [1, 2, 5], [0, n - 1, 2]];
      const kn = Math.min(pairs.length, tg.knots + (ka > 0.3 ? 1 : 0));
      for (let q = 0; q < kn; q++) {
        const [a, b, idx] = pairs[q];
        if (a >= n || b >= n || a === b) continue;
        const c1 = knotTogether(pv.ropes[a], pv.ropes[b], idx, 0.5 * tg.strength + 0.1);
        if (tg.strength > 0.35) pv.knots.push([c1.x, c1.y, 5 + tg.strength * 6]);
      }
    }
    // giant knot
    pv.giant = null;
    if (ka > 0.02) {
      const kx = bar.x + Math.sin(t * 1.4) * 8 * (1 - ka * 0.5), ky = bar.y + 26;
      const wts = [0, 0.35, 0.8, 0.95, 0.9, 0.6, 0.3, 0.1, 0];
      for (const rope of pv.ropes) for (let j = 1; j < rope.n - 1; j++) rope.pull(j, kx + (rope.x[j] - kx) * 0.05, ky + (j - 3) * 6, wts[j] * ka * 0.85);
      pv.giant = [kx, ky + 6, 10 + 22 * ka];
    }
  }

  emote(pv, emoName, dt) {
    const sp = pv.spec, g = sp.geo, ts = this.ts, pt = pv.pt, rnd = this.rnd;
    const hp = headWorld(sp, pv, [0, 0]);
    const r = g.headR * Math.abs(pv.sx);
    pt.love -= dt; pt.fear -= dt; pt.rage -= dt; pt.grief -= dt; pt.joy -= dt; pt.smug -= dt;
    const rm = this.rm;
    if (emoName === 'love' && pt.love <= 0) { pt.love = (0.55 + rnd() * 0.3) / ts; this.particles.spawn('heart', hp[0] + (rnd() - 0.3) * r, hp[1] - r * 1.3, { vy: -70 - rnd() * 30, vx: (rnd() - 0.5) * 20, life: 1.7 / ts, size: 22 + rnd() * 10, color: pick(['#ee6c4d', '#d8546b', '#f08aa0'], 'h', Math.floor(this.t * 10)), rot: rnd() * 6 }); }
    else if (emoName === 'fear' && pt.fear <= 0) { pt.fear = (0.45 + rnd() * 0.3) / ts; const s = rnd() < 0.5 ? -1 : 1; this.particles.spawn('sweat', hp[0] + s * r * 1.05, hp[1] - r * 0.5, { vx: s * 50, vy: -80, ay: 380, life: 0.8 / ts, size: 9 }); }
    else if (emoName === 'rage' && pt.rage <= 0) { pt.rage = (0.34 + rnd() * 0.2) / ts; for (const s of [-1, 1]) this.particles.spawn('steam', hp[0] + s * r * 0.95, hp[1] - r * 0.9, { vx: s * 22, vy: -60 - rnd() * 30, life: 0.85 / ts, size: 12 + rnd() * 5, color: '#f6ecd6' }); }
    else if (emoName === 'grief' && pt.grief <= 0) { pt.grief = (0.22 + rnd() * 0.18) / ts; const s = rnd() < 0.5 ? -1 : 1; this.particles.spawn('tear', hp[0] + s * r * 0.42, hp[1] + r * 0.05, { vx: s * 14, vy: 30, ay: 330, life: 0.9 / ts, size: 6.5 }); }
    else if (emoName === 'joy' && pt.joy <= 0 && !rm) { pt.joy = (0.6 + rnd() * 0.5) / ts; this.particles.spawn('spark', hp[0] + (rnd() - 0.5) * r * 3, hp[1] - r * (0.5 + rnd() * 1.6), { life: 0.9 / ts, size: 11, color: '#f7dc8c', rot: rnd() * 6 }); }
    else if (emoName === 'smug' && pt.smug <= 0 && !rm) { pt.smug = (2.3 + rnd() * 1.5) / ts; this.particles.spawn('glint', hp[0] + r * 0.5, hp[1] - r * 0.3, { life: 0.7 / ts, size: 12, color: '#fff6d8', rot: 0.4 }); }
  }

  updateProp(pr, dt) {
    const ts = this.ts;
    if (pr.delay > 0) { pr.delay -= dt; if (pr.delay > 0) return; }
    const wasAir = pr.dropY < -6;
    spring(pr, 'dropY', 0, 10 * Math.min(ts, 2.5), 0.42, dt);
    const hitV = pr.dropYV || 0;
    if (pr.dropY > 0) { pr.dropY = 0; pr.dropYV = -hitV * 0.3; }
    if (wasAir && pr.dropY >= -6 && hitV > 500 && !this.ghost) { for (let i = 0; i < 4; i++) this.particles.spawn('dust', pr.x + (this.rnd() - 0.5) * 60, pr.y, { vx: (this.rnd() - 0.5) * 140, vy: -20, life: 0.6 / ts, size: 10, layer: 1 }); }
    const tgt = pr.status === 'down' ? this.fallRot(pr) : 0;
    spring(pr, 'rot', tgt, pr.status === 'down' ? 8 : 6, pr.hang ? 0.18 : 0.38, dt);
  }

  updateSeat(sv, dt) {
    const st = this.state, ts = this.ts;
    const present = !!st.seats[sv.i];
    spring(sv, 'pop', present ? 1 : 0, 12, 0.5, dt);
    sv.pop = clamp(sv.pop, 0, 1.15);
    const pos = seatPos(sv.i);
    // who are they watching? the speaker, or whatever just happened
    const sp = st.speaker ? this.puppets.get(st.speaker) : null;
    let tgt = sp ? clamp((sp.x - pos.x) / 650, -1, 1) : noise1(this.t * 0.25 + sv.i * 3.1, sv.i) * 0.7;
    tgt += noise1(this.t * 0.7 + sv.i * 7.7, 3) * 0.25;
    spring(sv, 'look', clamp(tgt, -1, 1), 4, 0.8, dt);
    const pose = sv.pose;
    if (sv.react) {
      sv.react.age += dt;
      const a = sv.react.age * ts;
      if (a > REACT_DUR[sv.react.type]) { sv.react = null; reactPose(null, -1, 0, pose); }
      else {
        reactPose(sv.react.type, a, sv.react.k, pose);
        if (sv.react.type === 'yawn') { sv.zzT -= dt; if (sv.zzT <= 0 && pose.zz > 0.5) { sv.zzT = 0.55 / ts; this.particles.spawn('zzz', pos.x + 36, pos.y - 70 * pos.s, { vx: 12, vy: -34, life: 1.5 / ts, size: 24 }); } }
        if (sv.react.type === 'cry') { sv.tearT -= dt; if (sv.tearT <= 0 && pose.tears > 0.5) { sv.tearT = 0.3 / ts; const s = this.rnd() < 0.5 ? -1 : 1; this.particles.spawn('tear', pos.x + s * 14 * pos.s, pos.y + 6, { vx: s * 10, vy: 20, ay: 260, life: 0.9 / ts, size: 6 }); } }
      }
    } else reactPose(null, -1, 0, pose);
    pose.pop = sv.pop; pose.look = sv.look;
    pose.dy += Math.sin(this.t * 1.9 + sv.i * 1.3) * 2.2 * (this.rm ? 0 : 1);
    const hv = this.hover && this.hover.type === 'seat' && this.hover.id === sv.i ? 1 : 0;
    sv.hover += (hv - sv.hover) * (1 - Math.exp(-dt * 12));
    sv.hit.x = pos.x; sv.hit.y = pos.y + 8; sv.hit.rx = 56 * pos.s; sv.hit.ry = 72 * pos.s;
  }

  updateEffects(dt) {
    const L = this.effects, ts = this.ts;
    for (let i = L.length - 1; i >= 0; i--) {
      const e = L[i];
      e.age += dt;
      let done = false;
      switch (e.type) {
        case 'splat':
          if (e.age >= e.at) {
            this.particles.spawn('splat', e.x, e.y, { life: 1.6 / ts, size: 28, rot: this.rnd() * 6, layer: 0 });
            for (let k = 0; k < 5; k++) this.particles.spawn('steam', e.x, e.y, { vx: (this.rnd() - 0.5) * 160, vy: -40 - this.rnd() * 80, ay: 300, life: 0.5 / ts, size: 6, color: '#c42d18' });
            done = true;
          }
          break;
        case 'thunder': {
          const a = e.age * ts;
          this.flash = Math.max(this.flash, (a < 0.06 ? 1 : 0) + (a > 0.2 && a < 0.26 ? 0.8 : 0) + (a > 0.55 && a < 0.6 ? 0.5 : 0)) * (this.rm ? 0.25 : 1);
          if (a > 0.02 && a < 0.1 && !e.bolt) { e.bolt = makeBolt(hash01('bolt', this.seed, Math.floor(this.t * 5))); this.bolt = e.bolt; this.boltA = this.rm ? 0.3 : 1; }
          if (a < 2.2 && !this.rm) for (let k = 0; k < 3; k++) this.particles.spawn('rain', OPEN.x0 + this.rnd() * (OPEN.w + 200) - 60, OPEN.y0 - 10, { vx: -170, vy: 1100 + this.rnd() * 300, life: 0.52, size: 1, layer: 1 });
          if (e.age >= e.dur) done = true;
          break;
        }
        case 'hatch': if (e.age >= e.dur) done = true; break;
        case 'whisper': {
          const u = clamp01(e.age / e.dur);
          const [x0, y0] = e.from, [x1, y1] = e.to;
          const cx = (x0 + x1) / 2 + (x1 < x0 ? -60 : 60), cy = Math.min(y0, y1) - 150;
          const k = easeInOut(u), ik = 1 - k;
          e.x = ik * ik * x0 + 2 * ik * k * cx + k * k * x1; e.y = ik * ik * y0 + 2 * ik * k * cy + k * k * y1;
          e.trail.push([e.x, e.y]); if (e.trail.length > 16) e.trail.shift();
          if (!this.rm && this.rnd() < 0.7) this.particles.spawn('spark', e.x, e.y, { vx: (this.rnd() - 0.5) * 50, vy: (this.rnd() - 0.5) * 50, life: 0.5 / ts, size: 7, color: e.col, rot: this.rnd() * 6 });
          if (u >= 1) {
            for (let q = 0; q < 12; q++) this.particles.spawn('spark', e.to[0], e.to[1], { vx: Math.cos(q * 0.52) * (90 + this.rnd() * 70), vy: Math.sin(q * 0.52) * (90 + this.rnd() * 70), drag: 2.2, life: 0.9 / ts, size: 12, color: e.col, rot: q });
            for (let q = 0; q < 2; q++) this.particles.spawn('ring', e.to[0], e.to[1] + 30, { life: 0.8 / ts, size: 110, color: e.col, delay: q * 0.12 / ts });
            const pv = e.target ? this.puppets.get(e.target) : null;
            if (pv) { pv.flash = 1; pv.hop = 0; pv.hopV = 150; }
            this.sfx && this.sfx('ding', 1);
            done = true;
          }
          break;
        }
        case 'chain': {
          const hop = Math.min(e.actors.length - 1, Math.floor(e.age / e.hopDur));
          if (hop !== e.hop && e.hop < e.actors.length - 1) {
            // landed on the previous actor / take off for the next
            if (e.hop >= 0) this.chainLand(e, e.hop);
            e.hop = hop;
            e.from = e.hop === 0 ? [PROMPT.x + 36, PROMPT.y - 50] : this.headOf(e.actors[e.hop - 1], 60);
            const line = e.lines[e.hop];
            if (line != null) this.setBanner('chain', e.actors[e.hop], stripSpeaker(line), 'Yes, and...', true);
            const pv = this.puppets.get(e.actors[e.hop]);
            if (pv) pv.talkUntil = this.t + e.hopDur;
          }
          if (e.actors.length) {
            const u = clamp01((e.age - e.hop * e.hopDur) / e.hopDur);
            const to = this.headOf(e.actors[e.hop], 62);
            const from = e.from || e.last;
            const x = lerp(from[0], to[0], easeInOut(u));
            const apex = 120 + Math.abs(to[0] - from[0]) * 0.18;
            const y = lerp(from[1], to[1], easeInOut(u)) - Math.sin(Math.PI * u) * apex;
            e.ball = [x, y]; e.u = u; e.squash = u < 0.12 ? 1 - u / 0.12 * 0.3 : u > 0.92 ? 0.7 + (1 - u) / 0.08 * 0.3 : 1;
          }
          if (e.age >= e.dur) {
            if (e.actors.length) this.chainLand(e, e.actors.length - 1, true);
            done = true;
          }
          break;
        }
        default: done = true;
      }
      if (done) { L[i] = L[L.length - 1]; L.pop(); }
    }
    // bolt fades
    if (this.boltA < 0.02) this.bolt = null;
  }

  chainLand(e, idx, last) {
    const pv = this.puppets.get(e.actors[idx]);
    if (pv) { pv.hop = 0; pv.hopV = 210; const hp = headWorld(pv.spec, pv, [0, 0]); for (let q = 0; q < 5; q++) this.particles.spawn('spark', hp[0], hp[1] - pv.spec.geo.headR * 1.6, { vx: (this.rnd() - 0.5) * 200, vy: -60 - this.rnd() * 80, ay: 200, life: 0.7 / this.ts, size: 11, color: '#f7dc8c', rot: q }); }
    if (last && e.bonus) {
      const hp = pv ? headWorld(pv.spec, pv, [0, 0]) : [800, 300];
      this.particles.spawn('float', hp[0], hp[1] - 100, { vy: -50, life: 1.8 / this.ts, size: Math.max(40, this.u(18)), text: '+' + e.bonus, color: '#f7dc8c' });
      this.display.boost = 1;
    }
    this.sfx && this.sfx('hop', 1);
  }

  // ---- hit testing ----------------------------------------------------------------------------------------------------------------------
  /** Pointer in virtual stage coordinates -> {type:'actor'|'seat', id} or null. */
  pick(x, y) {
    const seats = [];
    for (const sv of this.seats) if (sv.pop > 0.3) seats.push(sv.hit);
    const hs = hitTest(x, y, seats);
    if (hs && y > PIT_Y - 10) return { type: 'seat', id: hs.id };
    const shapes = [];
    for (const pv of this.drawOrder()) if (pv.visible && pv.alpha > 0.5) shapes.push(pv.hit);
    const hp = hitTest(x, y, shapes);
    if (hp) return { type: 'actor', id: hp.id };
    return hs ? { type: 'seat', id: hs.id } : null;
  }

  drawOrder() {
    const L = Array.from(this.puppets.values());
    L.sort((a, b) => a.footY - b.footY || a.hx - b.hx);
    return L;
  }

  // ---- drawing ----------------------------------------------------------------------------------------------------------------------------
  cached(name, res, w, h, paint) {
    const ca = this.cache;
    if (ca.res !== res) { ca.back = null; ca.front = null; ca.flats.clear(); ca.res = res; }
    if (!ca[name]) {
      const cv = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
      if (!cv) return null;
      const cx = cv.getContext('2d');
      cx.scale(res, res);
      paint(cx);
      ca[name] = cv;
    }
    return ca[name];
  }

  flatCanvas(layer, f, res) {
    const key = `${layer}|${f.key}|${res}`;
    let cv = this.cache.flats.get(key);
    if (!cv) {
      const { w, h } = flatSize(layer);
      cv = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
      if (!cv) return null;
      const cx = cv.getContext('2d');
      cx.scale(res, res);
      paintFlat(cx, layer, f.set, f.sky, f.palette);
      if (this.cache.flats.size > 9) this.cache.flats.clear();
      this.cache.flats.set(key, cv);
    }
    return cv;
  }

  drawFlatLayer(ctx, layer, res) {
    const l = this.layers[layer];
    const { w, h } = flatSize(layer);
    const dist = [900, 1250, 1700][layer];
    const u = easeInOut(this.slide.u);
    const sway = this.rm ? 0 : Math.sin(this.t * 0.25 + layer) * [1.5, 3, 5][layer];
    const draw = (f, off) => {
      if (!f) return;
      const cv = this.flatCanvas(layer, f, res);
      if (cv) ctx.drawImage(cv, OPEN.x0 - FLAT_PAD + off + sway, OPEN.y0, w, h);
    };
    if (l.prev && this.slide.u < 1) { draw(l.prev, -dist * u); draw(l.cur, dist * (1 - u)); }
    else draw(l.cur, 0);
  }

  drawFloor(ctx) {
    const st = this.state;
    const floor = (st.set.palette && st.set.palette.floor) || '#3d2c2e';
    const base = mix(floor, '#8a5a3c', 0.5);
    const x0 = OPEN.x0, x1 = OPEN.x1;
    ctx.beginPath(); ctx.moveTo(x0 + 70, HORIZON_Y); ctx.lineTo(x1 - 70, HORIZON_Y); ctx.lineTo(x1 + 90, LIP_Y); ctx.lineTo(x0 - 90, LIP_Y); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, HORIZON_Y, LIP_Y, [[0, shade(base, -0.38)], [0.5, shade(base, -0.12)], [1, shade(base, 0.1)]]);
    ctx.fill();
    ctx.save(); ctx.clip();
    // planks converge toward the vanishing point
    ctx.strokeStyle = rgba('#000000', 0.22); ctx.lineWidth = 2;
    for (let i = -9; i <= 9; i++) {
      const bx = 800 + i * 150;
      ctx.beginPath(); ctx.moveTo(800 + i * 66, HORIZON_Y); ctx.lineTo(bx, LIP_Y); ctx.stroke();
    }
    ctx.strokeStyle = rgba('#ffffff', 0.05);
    for (let r = 1; r < 6; r++) { const y = HORIZON_Y + Math.pow(r / 6, 1.7) * (LIP_Y - HORIZON_Y); ctx.beginPath(); ctx.moveTo(x0 - 90, y); ctx.lineTo(x1 + 90, y); ctx.stroke(); }
    // wall shadow + footlight sheen
    ctx.fillStyle = vgrad(ctx, HORIZON_Y, HORIZON_Y + 34, [[0, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(x0 - 90, HORIZON_Y, x1 - x0 + 180, 34);
    ctx.fillStyle = rgrad(ctx, 800, LIP_Y + 40, 10, 520, [[0, 'rgba(255,190,110,.4)'], [1, 'rgba(255,190,110,0)']]);
    ctx.fillRect(x0 - 90, HORIZON_Y, x1 - x0 + 180, LIP_Y - HORIZON_Y);
    ctx.restore();
  }

  drawMoon(ctx) {
    const st = this.state;
    const sky = st.set.sky || 'night';
    const x = 1296 + Math.sin(this.t * 0.4) * 5, y = 268 + this.stageMoon.bob;
    const col = MOON_COL[sky] || MOON_COL.night;
    const r = 46;
    const bn = this.bn;
    const talking = bn && bn.who === 'narrator' && bn.progress < 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.t * 0.7) * 0.06);
    // the stick, running down behind the scenery
    ctx.fillStyle = c('#4a3030'); ctx.fillRect(-3.5, r - 6, 7, 330);
    ctx.fillStyle = c('rgba(255,255,255,.12)'); ctx.fillRect(-3.5, r - 6, 2, 330);
    glow(ctx, 0, 0, 120, col, sky === 'night' ? 0.4 : 0.18);
    circle(ctx, 0, 0, r); ctx.fillStyle = vgrad(ctx, -r, r, [[0, shade(col, 0.1)], [1, shade(col, -0.1)]]); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = c('#a97c1f'); ctx.stroke();
    // crescent shading
    ctx.save(); circle(ctx, 0, 0, r - 1); ctx.clip(); circle(ctx, r * 0.5, -r * 0.2, r * 0.95); ctx.fillStyle = rgba(shade(col, -0.25), 0.28); ctx.fill(); ctx.restore();
    // craters
    for (const [cx, cy, cr] of [[-18, 18, 5], [6, 24, 3.2], [-4, -26, 3.6]]) { circle(ctx, cx, cy, cr); fillOnly(ctx, rgba(shade(col, -0.3), 0.35)); }
    // face: follows the action, winces at disasters
    const w = this.moonWince;
    const lookTo = st.speaker ? this.puppets.get(st.speaker) : null;
    const lx = lookTo ? clamp((lookTo.x - x) / 500, -1, 1) * 2.5 : 0;
    for (const s of [-1, 1]) {
      const ex = s * 15 + lx;
      if (w > 0.15) { ctx.beginPath(); ctx.moveTo(ex - 6, -8 - s * 2); ctx.lineTo(ex + 6, -6 + s * 2); strokeOnly(ctx, '#4a3030', 3); ctx.beginPath(); ctx.arc(ex, 0, 4, 0, 6.3); fillOnly(ctx, '#4a3030'); }
      else { ell(ctx, ex, -5, 6, 7 * (this.rm ? 1 : (this.t % 5 > 4.85 ? 0.15 : 1))); fillOnly(ctx, '#fffaf0'); circle(ctx, ex + lx * 0.6, -4, 3); fillOnly(ctx, '#3a2a2e'); }
    }
    ctx.beginPath();
    if (talking || w > 0.2) { ell(ctx, lx * 0.4, 20, 8, 5 + Math.abs(Math.sin(this.t * 15)) * (talking ? 6 : 1) + w * 4); fillOnly(ctx, '#7a2a30'); }
    else { ctx.arc(lx * 0.4, 14, 11, 0.3, Math.PI - 0.3); strokeOnly(ctx, '#4a3030', 3); }
    ell(ctx, -26, 12, 7, 4); fillOnly(ctx, 'rgba(238,108,77,.5)'); ell(ctx, 26, 12, 7, 4); fillOnly(ctx, 'rgba(238,108,77,.5)');
    ctx.restore();
  }

  drawPropAt(ctx, pr, tint) {
    const id = pr.id;
    const h = (PROP_H[id] || 80);
    ctx.save();
    ctx.globalAlpha *= pr.alpha;
    if (pr.hang) { ctx.translate(pr.x, OPEN.y0 + 22 + pr.dropY); ctx.rotate(pr.rot * (pr.status === 'down' ? 0.8 : 1)); ctx.scale(pr.s, pr.s); }
    else {
      // contact shadow
      if (!tint) { ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(1, 0.2); const w = Math.max(30, h * 0.34) * pr.s; ctx.fillStyle = rgrad(ctx, 0, 0, 0, w, [[0, 'rgba(8,2,10,.5)'], [1, 'rgba(8,2,10,0)']]); ctx.fillRect(-w, -w, w * 2, w * 2); ctx.restore(); }
      ctx.translate(pr.x, pr.y + pr.dropY - (pr.float ? 26 : 0));
      ctx.rotate(pr.rot); ctx.scale(pr.s, pr.s);
    }
    drawProp(ctx, id, this.t + pr.i * 1.3);
    ctx.restore();
  }

  drawPuppetFull(ctx, pv, tint, opts) {
    const sp = pv.spec;
    ctx.save();
    if (pv.clipBelow > 0) { ctx.beginPath(); ctx.rect(0, 0, W, pv.clipBelow); ctx.clip(); }
    // strings behind the body
    this.drawStrings(ctx, pv, tint);
    drawPuppet(ctx, pv, sp, this.t, { hover: pv.hover, alpha: pv.alpha, overlay: opts && opts.overlay ? opts.overlay : (pv.clipOut.overlay || (pv.flash > 0.05 ? ['#fff0b0', pv.flash * 0.55] : null)) });
    if (pv.giant && !tint) drawKnot(ctx, pv.giant[0], pv.giant[1], pv.giant[2], this.t);
    ctx.restore();
  }

  drawStrings(ctx, pv, tint) {
    ctx.save();
    drawBar(ctx, pv.bar, pv.spec, this.t);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const chaos = this.display.chaos / 100;
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? 'rgba(20,6,24,.38)' : tint ? 'rgba(200,220,255,.8)' : 'rgba(246,236,214,.92)';
      ctx.lineWidth = pass === 0 ? 3.2 : 1.7;
      for (const rope of pv.ropes) {
        ctx.beginPath(); ctx.moveTo(rope.x[0], rope.y[0]);
        for (let j = 1; j < rope.n - 1; j++) ctx.quadraticCurveTo(rope.x[j], rope.y[j], (rope.x[j] + rope.x[j + 1]) / 2, (rope.y[j] + rope.y[j + 1]) / 2);
        ctx.lineTo(rope.x[rope.n - 1], rope.y[rope.n - 1]);
        ctx.stroke();
      }
    }
    if (!tint) {
      for (const k of pv.knots) drawKnot(ctx, k[0], k[1], k[2], this.t);
    }
    ctx.restore();
  }

  /** Draw the whole frame. (cw,ch) = canvas CSS size. The context must already have dpr*identity set by the caller. */
  draw(ctx, cw, ch, dpr) {
    const fit = fitStage(cw, ch);
    this.fit = fit; this.scale = fit.scale; this.dpr = dpr;
    const res = Math.max(0.3, Math.min(1.6, fit.scale * dpr));
    const st = this.state;
    const t = this.t;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b050e'; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.x, dpr * fit.y);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const sh = this.shake;
    if (sh > 0.05) ctx.translate(Math.sin(t * 71) * sh * 0.7, Math.cos(t * 83) * sh * 0.5);

    // 1. room + pit
    const back = this.cached('back', res, W, H, paintBack);
    if (back) ctx.drawImage(back, 0, 0, W, H);

    // 2. stage interior
    ctx.save();
    ctx.beginPath(); ctx.rect(OPEN.x0, OPEN.y0 - 10, OPEN.w, LIP_Y - OPEN.y0 + 10); ctx.clip();
    ctx.fillStyle = '#0d070f'; ctx.fillRect(OPEN.x0, OPEN.y0, OPEN.w, OPEN.h);
    this.drawFlatLayer(ctx, 0, res);
    this.drawFlatLayer(ctx, 1, res);
    this.drawMoon(ctx);
    this.drawFloor(ctx);
    for (const e of this.effects) if (e.type === 'hatch') drawHatch(ctx, e.x, e.y, hatchOpen(e));
    // ghost timeline, translucent and cool, behind the live show
    if (this.ghostScene) this.drawGhost(ctx);
    // props + puppets, back to front
    const items = [];
    for (const pr of this.props.values()) items.push({ y: pr.hang ? OPEN.y0 + 10 : pr.y, pr });
    for (const pr of this.leaving) items.push({ y: pr.y, pr });
    for (const pv of this.puppets.values()) if (pv.visible) items.push({ y: pv.footY + (pv.pivot ? 0 : 0), pv });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) { if (it.pr) this.drawPropAt(ctx, it.pr, false); else this.drawPuppetFull(ctx, it.pv, false); }
    this.drawFlatLayer(ctx, 2, res);
    // stage-layer particles (dust, rain...)
    for (const p of this.particles.list) if (p.layer === 1) drawParticle(ctx, p);
    // atmosphere
    if (this.mood.fog > 0.01) drawFog(ctx, this.mood.fog, t, this.rm);
    drawWarmGlow(ctx, 1 + this.lantern * 0.15);
    if (this.mood.wash > 0.01) drawWash(ctx, this.mood.washKind, this.mood.wash, t);
    if (this.mood.spot > 0.01) drawSpot(ctx, this.mood.spotX, this.mood.spotY, this.mood.spot, t);
    if (this.freezeDim > 0.01) { ctx.fillStyle = `rgba(10,3,18,${0.2 * this.freezeDim})`; ctx.fillRect(OPEN.x0, OPEN.y0, OPEN.w, OPEN.h); }
    drawBolt(ctx, this.bolt, this.boltA);
    drawFlash(ctx, this.flash);
    ctx.restore();

    // 3. curtains
    ctx.save();
    ctx.beginPath(); ctx.rect(OPEN.x0 - 2, OPEN.y0 - 8, OPEN.w + 4, LIP_Y - OPEN.y0 + 8); ctx.clip();
    drawCurtains(ctx, this.curtain.open, t, this.rm ? 0 : Math.min(1, this.curtain.speed * 0.12));
    ctx.restore();

    // 4. lip: footlights + the Prompter's box
    drawFootlights(ctx, t, this.rm, this.lantern * 0.8);
    drawPrompter(ctx, t, this.rm, this.lantern, st.pending ? this.freezeDim : 0);

    // 5. proscenium
    const front = this.cached('front', res, W, H, paintFront);
    if (front) ctx.drawImage(front, 0, 0, W, H);
    drawTassels(ctx, t, this.rm);

    // 6. instruments
    drawPips(ctx, st.beat.index, this.beatAge, this.rm);
    const gw = this.ghostScene ? this.ghostScene.state.meters.warmth : null, gc = this.ghostScene ? this.ghostScene.state.meters.chaos : null;
    drawWarmth(ctx, this.display.warmth, gw, t, this.rm, this.display.boost);
    drawTangle(ctx, this.display.chaos, gc, t, this.rm, 0);
    drawBeatTag(ctx, st.beat.name, st.beat.index, this.beatAge, this.scale);

    // 7. the house
    for (const sv of this.seats) {
      const pos = seatPos(sv.i);
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(pos.s, pos.s);
      const seat = st.seats[sv.i];
      const taste = seat ? this.index.tastes.get(seat.taste) : null;
      drawSpectator(ctx, sv.pose, seat, taste, t, sv.hover);
      ctx.restore();
    }
    // whisper orb + chain ball (over the footlights)
    for (const e of this.effects) {
      if (e.type === 'whisper' && Number.isFinite(e.x) && Number.isFinite(e.y)) drawParticle(ctx, { kind: 'orb', x: e.x, y: e.y, age: 0, life: 1, size: 10, color: e.col, data: { trail: e.trail } });
      else if (e.type === 'chain' && e.ball && e.actors.length) drawChainBall(ctx, e, this);
    }
    for (const p of this.particles.list) if (p.layer === 0) drawParticle(ctx, p);

    // 8. captions
    if (this.tk) drawTicket(ctx, this.tk, this.scale, t, this.rm);
    const hideBanner = st.curtain === 'closed' && t > this.curtain.delay && this.curtain.open < 0.15;
    if (this.bn && !hideBanner) drawBanner(ctx, this.bn, this.scale);
    // hover name tag
    if (this.hover) {
      if (this.hover.type === 'actor') { const pv = this.puppets.get(this.hover.id); if (pv && pv.visible) { const hp = headWorld(pv.spec, pv, [0, 0]); drawNameTag(ctx, this.nameOf(pv.id), hp[0], hp[1] - pv.spec.geo.headR * 1.7 - 12, this.scale, pv.spec.pal.body); } }
      else if (this.hover.type === 'seat') { const seat = st.seats[this.hover.id]; const pos = seatPos(this.hover.id); const taste = seat ? this.index.tastes.get(seat.taste) : null; if (seat) drawNameTag(ctx, (taste && taste.name) || 'Audience', pos.x, pos.y - 58 * pos.s - 14, this.scale, '#e9b949'); }
    }
    // 9. vignette
    ctx.fillStyle = rgrad(ctx, 800, 440, 420, 1050, [[0, 'rgba(8,2,12,0)'], [1, 'rgba(8,2,12,.5)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawGhost(ctx) {
    const g = this.ghostScene;
    ctx.save();
    ctx.translate(-26, 12);
    ctx.globalAlpha = 0.34;
    setTint('ghost');
    const diff = this.diff;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    const items = [];
    for (const pr of g.props.values()) items.push({ y: pr.hang ? OPEN.y0 + 10 : pr.y, pr });
    for (const pv of g.puppets.values()) if (pv.visible) items.push({ y: pv.footY, pv });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.pr) {
        g.drawPropAt(ctx, it.pr, true);
        if (diff && diff.props.includes(it.pr.id)) { setTint('flat', '#ee6c4d'); ctx.save(); ctx.globalAlpha *= 0.6 * pulse; g.drawPropAt(ctx, it.pr, true); ctx.restore(); setTint('ghost'); }
      } else {
        const pv = it.pv;
        ctx.save();
        if (pv.clipBelow > 0) { ctx.beginPath(); ctx.rect(0, 0, W, pv.clipBelow); ctx.clip(); }
        g.drawStrings(ctx, pv, true);
        drawBody(ctx, pv, pv.spec, this.t, false, pv.sx < 0);
        if (diff && diff.actors.includes(pv.id)) { setTint('flat', '#ee6c4d'); ctx.save(); ctx.globalAlpha *= 0.65 * pulse; drawBody(ctx, pv, pv.spec, this.t, true, pv.sx < 0); ctx.restore(); setTint('ghost'); }
        ctx.restore();
      }
    }
    setTint(null);
    ctx.restore();
  }
}

// ---- helpers ------------------------------------------------------------------------------------------------------------------
const KNOT_ATTACH = ['kneeL', 'kneeR', 'back', 'kneeL', 'kneeR', 'back', 'kneeL'];

function jawFor(ch, idx) {
  if (ch == null) return 0;
  if (ch === ' ') return 0.12;
  if (/[aeiouAEIOU]/.test(ch)) return 0.55 + 0.4 * hash01('jaw', idx);
  if (/[bmpBMP]/.test(ch)) return 0;
  if (/[.,!?;:]/.test(ch)) return 0.05;
  return 0.25 + 0.2 * hash01('jaw', idx);
}

const stripSpeaker = (s) => String(s).replace(/^[^:"]{1,24}:\s*/, '').replace(/^["“]|["”]$/g, '');

function hatchOpen(e) {
  const u = clamp01(e.age / e.dur);
  return u < 0.18 ? smooth(u / 0.18) : u < 0.8 ? 1 : 1 - smooth((u - 0.8) / 0.2);
}

function makeBolt(seed) {
  const pts = [];
  let x = 700 + seed * 400, y = OPEN.y0 - 10;
  pts.push([x, y]);
  let i = 0;
  while (y < 430) { i++; y += 38 + hash01('by', seed, i) * 34; x += (hash01('bx', seed, i) - 0.5) * 100; pts.push([x, y]); }
  return pts;
}

function drawChainBall(ctx, e, sc) {
  const [x, y] = e.ball;
  const sq = e.squash || 1;
  // shadow on the floor below
  ctx.save();
  ctx.translate(x, FLOOR_Y + 20); ctx.scale(1, 0.25);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.3); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y); ctx.scale(1 / sq, sq);
  glow(ctx, 0, 0, 60, '#f7dc8c', 0.65);
  circle(ctx, 0, 0, 17); paper(ctx, '#f2c14e', 2.4, '#7a5a10');
  circle(ctx, -5, -6, 5.5); fillOnly(ctx, 'rgba(255,255,255,.7)');
  ctx.restore();
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h); return cv; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  return null;
}
