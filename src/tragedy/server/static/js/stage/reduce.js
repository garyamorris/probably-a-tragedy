// The scene MODEL: a pure reducer from custom stream events (PROTOCOL section 4) to plain-JSON state.
// No DOM, no canvas, no clocks: importable in Node. The renderer draws `state` plus short-lived tweens.
//
//   reduce(state, ev) -> state      (never mutates `state`; unchanged subtrees are shared)
//   reduceAll(events) -> state      (== what seek(k) rebuilds from log.slice(0,k))
//
// Events are deduped by `ev.key`: re-applying an event whose key was already seen returns the same state object.

import { ROLE_SLOT, SLOT_FRAC, OPEN, propPos, clamp } from './layout.js';
import { hash01 } from './rng.js';

export const SEATS = 12;
export const EMOTIONS = ['neutral', 'joy', 'fear', 'rage', 'love', 'grief', 'smug'];
export const ANIMS = ['lean_left', 'collapse', 'spin', 'wobble', 'hide', 'fly', 'freeze', 'shake', 'flip', 'slide', 'bow', 'drop_prop'];
export const REACTIONS = ['laugh', 'gasp', 'cry', 'boo', 'yawn', 'applaud'];
export const SETS = ['parlour', 'corridor', 'bedroom', 'cellar', 'moor', 'ballroom', 'graveyard', 'castle', 'garden', 'library', 'attic', 'harbour', 'stage'];
export const SKIES = ['dawn', 'noon', 'dusk', 'night', 'storm'];
export const CUES = ['lights', 'thunder', 'trapdoor', 'fog', 'spotlight', 'curtain'];

/** Anims that bump into the nearest standing prop. */
const KNOCKS = new Set(['collapse', 'slide', 'flip', 'fly', 'spin', 'lean_left', 'drop_prop']);
const ANIM_EMOTION = {
  lean_left: 'love', collapse: 'grief', spin: 'joy', wobble: 'fear', hide: 'fear', fly: 'fear',
  freeze: 'fear', shake: 'fear', flip: 'joy', slide: 'joy', bow: 'smug', drop_prop: 'fear',
};

export function isStageKind(kind) {
  return typeof kind === 'string' && (kind.startsWith('stage.') || kind.startsWith('audience.') || kind === 'meter');
}

export function initialState() {
  return {
    v: 1,
    n: 0,
    sb: 0,                // events since the last stage.beat (used to align a ghost timeline)
    seen: {},
    c: { beat: 0, set: 0, direct: 0, banner: 0, mishap: 0, decision: 0, cue: 0, chain: 0, react: 0, tally: 0, curtain: 0, line: 0 },
    curtain: 'closed',
    knotted: false,
    knotVictim: null,
    finale: null,
    beat: { index: -1, beat: '', name: '', logline: '', tags: [] },
    set: { id: null, sky: 'dusk', palette: null, beat: null, n: 0 },
    propsOn: [],          // [{id, slot, status:'up'|'down'}]
    actors: {},           // id -> actor record
    order: [],
    speaker: null,
    banner: null,         // {kind,who,text,emotion,label,n}
    direct: null,         // {text,n}
    mishap: null,
    pending: null,        // id of an unresolved MAJOR mishap (the stage is frozen, waiting for the Prompter)
    decision: null,
    cue: null,
    mood: { fog: false, wash: null, spot: null },
    chain: null,
    meters: { warmth: 40, chaos: 10, beat: 0 },
    tally: null,
    seats: new Array(SEATS).fill(null),
    lastReact: null,
  };
}

// ---- small immutable helpers ------------------------------------------------------------------------
function bump(n, name) {
  const v = (n.c[name] || 0) + 1;
  n.c = { ...n.c, [name]: v };
  return v;
}

function freeSlot(actors, role, self) {
  const taken = new Set();
  for (const id in actors) if (id !== self && actors[id].present) taken.add(actors[id].slot);
  const want = ROLE_SLOT[role];
  if (want != null && !taken.has(want)) return want;
  for (let i = 0; i < SLOT_FRAC.length; i++) if (!taken.has(i)) return i;
  return SLOT_FRAC.length - 1;
}

/** Put an actor on stage if the log refers to them before an enter event (e.g. after a rewind). */
function ensureActor(n, id, role, from) {
  if (!id) return null;
  const cur = n.actors[id];
  if (cur && cur.present) return cur;
  const slot = cur ? cur.slot : freeSlot(n.actors, role, id);
  const rec = {
    id, role: role || (cur && cur.role) || 'extra', slot, from: from || 'above', present: true,
    enterN: (cur ? cur.enterN : 0) + 1, exitN: cur ? cur.exitN : 0, exitTo: null,
    emotion: 'neutral', anim: cur ? cur.anim : null,
  };
  n.actors = { ...n.actors, [id]: rec };
  if (!n.order.includes(id)) n.order = [...n.order, id];
  return rec;
}

function patchActor(n, id, patch) {
  const cur = n.actors[id];
  if (!cur) return;
  n.actors = { ...n.actors, [id]: { ...cur, ...patch } };
}

function applyEffects(n, fx) {
  if (!fx || typeof fx !== 'object') return;
  const m = n.meters;
  const w = typeof fx.warmth === 'number' ? clamp(m.warmth + fx.warmth, 0, 100) : m.warmth;
  const ch = typeof fx.chaos === 'number' ? clamp(m.chaos + fx.chaos, 0, 100) : m.chaos;
  if (w !== m.warmth || ch !== m.chaos) n.meters = { ...m, warmth: w, chaos: ch };
}

function setProp(n, idx, status) {
  n.propsOn = n.propsOn.map((p, i) => (i === idx ? { ...p, status } : p));
}

function knockProp(n, actor, anim, key) {
  const ups = [];
  n.propsOn.forEach((p, i) => { if (p.status === 'up') ups.push(i); });
  if (!ups.length) return;
  if (anim === 'drop_prop') {
    setProp(n, ups[Math.floor(hash01('drop', key, n.n) * ups.length)], 'down');
    return;
  }
  const a = n.actors[actor];
  if (!a) return;
  const ax = OPEN.x0 + OPEN.w * SLOT_FRAC[a.slot];
  let best = -1, bd = 1e9;
  for (const i of ups) {
    const d = Math.abs(propPos(i).x - ax);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0 && bd < OPEN.w * 0.2) setProp(n, best, 'down');
}

/** Normalise the (unspecified) reaction intensity to 0.2..1: accepts 0..1, 1..3 or 0..100. */
export function normIntensity(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0.6;
  let x = v;
  if (x > 3) x = x / 100;
  else if (x > 1) x = x / 3;
  return clamp(x, 0.2, 1);
}

// ---- the reducer --------------------------------------------------------------------------------------
export function reduce(s, ev) {
  if (!ev || !isStageKind(ev.kind)) return s;
  if (ev.key != null && s.seen[ev.key]) return s;
  const d = ev.data || {};
  const n = {
    ...s,
    n: s.n + 1,
    sb: ev.kind === 'stage.beat' ? 0 : s.sb + 1,
    seen: ev.key != null ? { ...s.seen, [ev.key]: 1 } : s.seen,
  };

  switch (ev.kind) {
    case 'stage.beat': {
      n.beat = { index: d.index | 0, beat: d.beat || '', name: d.name || '', logline: d.logline || '', tags: d.tags || [] };
      bump(n, 'beat');
      n.curtain = 'open';
      n.knotted = false;
      n.knotVictim = null;
      n.finale = null;
      n.mood = { fog: false, wash: null, spot: null };
      n.mishap = null; n.pending = null; n.decision = null; n.cue = null; n.chain = null; n.direct = null;
      n.speaker = null;
      n.tally = null;
      n.meters = { ...s.meters, beat: d.index | 0 };
      const actors = {};
      for (const id in s.actors) actors[id] = { ...s.actors[id], emotion: 'neutral' };
      n.actors = actors;
      break;
    }
    case 'stage.set': {
      const prev = new Map(s.propsOn.map((p) => [p.id, p]));
      n.set = { id: d.set || null, sky: d.sky || 'dusk', palette: d.palette || null, beat: d.beat == null ? null : d.beat, n: s.set.n + 1 };
      n.propsOn = (d.props || []).map((id, i) => ({ id, slot: i, status: 'up', fresh: !prev.has(id) }));
      bump(n, 'set');
      break;
    }
    case 'stage.enter': {
      if (!d.actor) break;
      const cur = s.actors[d.actor];
      const slot = freeSlot(s.actors, d.role, d.actor);
      const rec = {
        id: d.actor, role: d.role || (cur && cur.role) || 'extra', slot, from: d.from || 'left', present: true,
        enterN: (cur ? cur.enterN : 0) + 1, exitN: cur ? cur.exitN : 0, exitTo: null,
        emotion: 'neutral', anim: cur ? cur.anim : null,
      };
      n.actors = { ...s.actors, [d.actor]: rec };
      n.order = s.order.includes(d.actor) ? s.order : [...s.order, d.actor];
      break;
    }
    case 'stage.exit': {
      const cur = s.actors[d.actor];
      if (!cur) break;
      const side = d.from || (SLOT_FRAC[cur.slot] < 0.5 ? 'left' : 'right');
      n.actors = { ...s.actors, [d.actor]: { ...cur, present: false, exitN: cur.exitN + 1, exitTo: side } };
      if (n.speaker === d.actor) n.speaker = null;
      break;
    }
    case 'stage.direct': {
      n.direct = { text: d.text || '', n: bump(n, 'direct') };
      break;
    }
    case 'stage.line': {
      ensureActor(n, d.actor, d.role);
      const emo = EMOTIONS.includes(d.emotion) ? d.emotion : 'neutral';
      patchActor(n, d.actor, { emotion: emo });
      n.speaker = d.actor || null;
      n.banner = { kind: 'line', who: d.actor || 'narrator', text: String(d.text || ''), emotion: emo, n: bump(n, 'banner') };
      bump(n, 'line');
      n.direct = null;
      break;
    }
    case 'stage.mishap': {
      ensureActor(n, d.actor, null);
      if (d.other) ensureActor(n, d.other, null);
      const anim = ANIMS.includes(d.anim) ? d.anim : 'wobble';
      const prev = n.actors[d.actor];
      patchActor(n, d.actor, { anim: { name: anim, n: (prev && prev.anim ? prev.anim.n : 0) + 1 }, emotion: ANIM_EMOTION[anim] || 'fear' });
      if (d.other && n.actors[d.other] && n.actors[d.other].emotion === 'neutral') patchActor(n, d.other, { emotion: 'fear' });
      const mn = bump(n, 'mishap');
      n.mishap = {
        id: d.id || 'mishap', actor: d.actor || null, other: d.other || null, kind: d.kind || '', severity: d.severity || 'minor',
        title: d.title || '', text: d.text || '', anim, tags: d.tags || [], calamity: d.calamity || '', n: mn, resolved: false,
      };
      n.pending = d.severity === 'major' ? (d.id || 'mishap') : null;
      n.speaker = null;
      n.banner = { kind: 'mishap', who: 'narrator', text: String(d.text || d.title || ''), label: d.title || '', emotion: 'neutral', n: bump(n, 'banner') };
      applyEffects(n, d.effects);
      if (KNOCKS.has(anim)) knockProp(n, d.actor, anim, ev.key || d.id);
      break;
    }
    case 'stage.decision': {
      const by = d.by || 'prompter';
      n.decision = {
        mishap_id: d.mishap_id || null, option: d.option || '', label: d.label || '', cue: d.cue || null,
        text: d.text || '', line: d.line || '', by, target: (s.mishap && (!d.mishap_id || s.mishap.id === d.mishap_id) ? s.mishap.actor : null),
        n: bump(n, 'decision'),
      };
      n.pending = null;
      if (s.mishap) n.mishap = { ...s.mishap, resolved: true };
      n.speaker = null;
      n.banner = { kind: 'decision', who: by, text: String(d.line || d.text || d.label || ''), label: d.label || '', emotion: 'neutral', n: bump(n, 'banner') };
      applyEffects(n, d.effects);
      break;
    }
    case 'stage.cue': {
      const cue = d.cue || 'lights';
      const target = (s.mishap && s.mishap.actor) || s.speaker || Object.keys(s.actors).find((k) => s.actors[k].present) || null;
      n.cue = { cue, outcome: d.outcome || 'miracle', fits: !!d.fits, text: d.text || '', target, n: bump(n, 'cue') };
      const mood = { ...s.mood };
      if (cue === 'fog') mood.fog = true;
      else if (cue === 'lights') mood.wash = d.outcome === 'misfire' ? 'sick' : 'gold';
      else if (cue === 'spotlight') mood.spot = target;
      n.mood = mood;
      if (d.text) n.banner = { kind: 'cue', who: 'narrator', text: String(d.text), label: cue, emotion: 'neutral', n: bump(n, 'banner') };
      break;
    }
    case 'stage.chain': {
      const actors = (d.actors || []).slice();
      for (const a of actors) ensureActor(n, a, null);
      n.chain = { actors, lines: (d.lines || []).slice(), bonus: d.bonus || 0, n: bump(n, 'chain') };
      const li = (d.lines || []).length - 1;
      if (li >= 0) n.banner = { kind: 'chain', who: actors[Math.min(li, actors.length - 1)] || 'narrator', text: String(d.lines[li]), label: 'Yes, and...', emotion: 'joy', n: bump(n, 'banner') };
      break;
    }
    case 'stage.curtain': {
      n.curtain = 'closed';
      n.knotted = !!d.knotted;
      n.finale = { warmth: d.warmth, chaos: d.chaos, quality_avg: d.quality_avg, tradition_hits: d.tradition_hits, n: bump(n, 'curtain') };
      if (d.knotted) {
        const m = s.mishap && s.actors[s.mishap.actor] ? s.mishap.actor : null;
        n.knotVictim = m || Object.keys(s.actors).find((k) => s.actors[k].present && s.actors[k].role === 'lead') || Object.keys(s.actors).find((k) => s.actors[k].present) || null;
      }
      n.meters = {
        warmth: typeof d.warmth === 'number' ? clamp(d.warmth, 0, 100) : s.meters.warmth,
        chaos: typeof d.chaos === 'number' ? clamp(d.chaos, 0, 100) : s.meters.chaos,
        beat: s.meters.beat,
      };
      n.mood = { fog: false, wash: null, spot: null };
      n.speaker = null; n.pending = null; n.direct = null;
      break;
    }
    case 'audience.seat': {
      const i = d.seat | 0;
      if (i < 0 || i >= SEATS) break;
      const seats = s.seats.slice();
      seats[i] = { seat: i, taste: d.taste || '', hat: d.hat || 'none', palette: d.palette || null, react: seats[i] ? seats[i].react : null };
      n.seats = seats;
      break;
    }
    case 'audience.react': {
      const i = d.seat | 0;
      if (i < 0 || i >= SEATS) break;
      const seats = s.seats.slice();
      const base = seats[i] || { seat: i, taste: '', hat: 'none', palette: null, react: null };
      const react = { reaction: REACTIONS.includes(d.reaction) ? d.reaction : 'laugh', intensity: normIntensity(d.intensity), why: d.why || '', n: bump(n, 'react') };
      seats[i] = { ...base, react };
      n.seats = seats;
      n.lastReact = { seat: i, reaction: react.reaction };
      break;
    }
    case 'audience.tally': {
      n.tally = { beat: d.beat | 0, delta: typeof d.delta === 'number' ? d.delta : 0, counts: d.counts || {}, n: bump(n, 'tally') };
      break;
    }
    case 'meter': {
      n.meters = {
        warmth: typeof d.warmth === 'number' ? clamp(d.warmth, 0, 100) : s.meters.warmth,
        chaos: typeof d.chaos === 'number' ? clamp(d.chaos, 0, 100) : s.meters.chaos,
        beat: typeof d.beat === 'number' ? d.beat : s.meters.beat,
      };
      break;
    }
    default:
      return s;
  }
  return n;
}

export function reduceAll(events, from) {
  let s = from || initialState();
  for (let i = 0; i < events.length; i++) s = reduce(s, events[i]);
  return s;
}

/** The numbers the shell reads (PROTOCOL 7.2 getMetrics). */
export function metricsOf(s) {
  return {
    warmth: s.meters.warmth,
    chaos: s.meters.chaos,
    beat: s.beat.index >= 0 ? s.beat.index : s.meters.beat,
    speaker: s.speaker,
  };
}

/** Actors currently on stage, in draw order (back to front). */
export function actorsOnStage(s) {
  return s.order.map((id) => s.actors[id]).filter((a) => a && a.present);
}
