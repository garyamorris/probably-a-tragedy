// Pure helpers for the eight flow views. No DOM, no network: everything here is unit-tested in tests/ui/views*.test.mjs.
// (Shell-Views owns this file. It lives beside the views as `_kit/` so the views can share it without touching Shell-Core's ui.js.)

export const ROLES = ['lead', 'villain', 'fool'];
export const BEATS = ['setup', 'complication', 'reversal', 'twist', 'finale'];
export const BEAT_NAMES = { setup: 'Setup', complication: 'Complication', reversal: 'Reversal', twist: 'Twist', finale: 'Finale' };
export const STAR_TARGET = 15;
export const TOUR_NIGHTS = 5;

/* ------------------------------------------------------------------------------------------ small utils */

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** "the_lean" -> "The Lean"; tolerant of null. */
export function humanize(slug) {
  return String(slug ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** "leans_left" -> "leans left" (flaw tags read as phrases). */
export function phrase(slug) {
  return String(slug ?? '').replace(/[_-]+/g, ' ').trim();
}

/** Accept an array of {id}, an {id: item} object, or nothing; return {id: item}. */
export function indexById(list) {
  if (!list) return {};
  if (Array.isArray(list)) {
    const out = {};
    for (const it of list) if (it && it.id != null) out[it.id] = it;
    return out;
  }
  return { ...list };
}

/** Tiny deterministic string hash (for stable per-id decoration choices). */
export function hash(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const pickBy = (arr, key) => arr[hash(key) % arr.length];

const TITLES = new Set(['the', 'sir', 'mr.', 'mr', 'mrs.', 'mrs', 'captain', 'madame', 'dr.', 'dr', 'miss', 'lady', 'lord']);
/** "Sir Reginald Blort" -> "Reginald"; "The Goose (in a wig)" -> "Goose"; "Mr. Tock" -> "Tock". */
export function shortName(name) {
  const words = String(name ?? '').replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && TITLES.has(words[0].toLowerCase())) words.shift();
  return words[0] ?? '';
}

export function ordinal(n) {
  const v = Number(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

/** Night index (0-4) as the label the player sees: "Night 3 of 5". */
export const nightLabel = (night, nights = TOUR_NIGHTS) => `Night ${Number(night || 0) + 1} of ${nights}`;

/* ------------------------------------------------------------------------------------------ pacing */

/** Base delay (ms) the playback queue waits after each custom event kind, at speed 1. */
export const PACE_MS = {
  progress: 120,
  note: 300,
  'cast.audition': 330,
  'cast.recommend': 1100,
  'script.draft': 900,
  'script.chosen': 500,
  'rehearsal.sample': 300,
  'rehearsal.summary': 1000,
  'review.pigeon': 900,
  'review.headline': 1400,
  'almanac.noted': 520,
  'almanac.candidate': 760,
  'almanac.tradition': 900,
  'memory.recalled': 800,
  'memory.written': 120,
  'road.step': 520,
  'road.event': 1000,
  'road.crash': 1700,
  'road.arrive': 900,
  'playbill.section': 760,
  'greenroom.rapport': 400,
  'greenroom.tool': 450,
};
export const DEFAULT_PACE_MS = 320;

export function paceMs(kind, speed = 1) {
  if (!(speed > 0)) return 0;
  const base = PACE_MS[kind] ?? DEFAULT_PACE_MS;
  return Math.round(base / speed);
}

/* ------------------------------------------------------------------------------------------ casting */

export const emptyCast = () => ({ lead: null, villain: null, fool: null });

/** Is `cast` three distinct, known performers? errors name the role slots at fault. */
export function validateCast(cast, knownIds = null) {
  const errors = [];
  const missing = [];
  const seen = {};
  const dupes = [];
  for (const role of ROLES) {
    const id = cast?.[role];
    if (!id) {
      missing.push(role);
      errors.push({ role, code: 'missing', message: `Nobody is playing the ${role}.` });
      continue;
    }
    if (knownIds && !knownIds.includes(id)) errors.push({ role, code: 'unknown', message: `${id} is not in the troupe.` });
    if (seen[id]) {
      dupes.push(id);
      errors.push({ role, code: 'duplicate', message: `${id} cannot play ${seen[id]} and ${role} at once (the costumes will not fit).` });
    } else seen[id] = role;
  }
  return { ok: errors.length === 0, errors, missing, dupes };
}

/** Put `actor` in `role`. If the actor already holds another slot, the two swap (the old occupant moves across). */
export function placeInSlot(cast, role, actor) {
  const next = { ...emptyCast(), ...cast };
  const prev = next[role] ?? null;
  for (const r of ROLES) {
    if (r !== role && next[r] === actor) next[r] = prev; // swap (null if the slot was empty)
  }
  next[role] = actor;
  return next;
}

export function removeFromSlot(cast, role) {
  return { ...emptyCast(), ...cast, [role]: null };
}

export function slotOf(cast, actor) {
  return ROLES.find((r) => cast?.[r] === actor) ?? null;
}

/** scores = {role: {actor: score}} (the `cast.recommend` / `confirm_cast` shape). */
export function slotScore(scores, role, actor) {
  const v = scores?.[role]?.[actor];
  return Number.isFinite(v) ? v : null;
}

export function castTotal(cast, scores) {
  let t = 0;
  for (const r of ROLES) t += slotScore(scores, r, cast?.[r]) ?? 0;
  return Math.round(t * 10) / 10; // 77.6 + 73.7 + 66.8 is 218.10000000000002 in floating point; players see one decimal
}

/** Fold `cast.audition` events into {role: {actor: score}} (later events for the same pair win). */
export function auditionBoard(events) {
  const board = { lead: {}, villain: {}, fool: {} };
  for (const e of events || []) {
    const d = e?.data ?? e;
    if (d && d.role && d.actor && Number.isFinite(d.score)) (board[d.role] ??= {})[d.actor] = d.score;
  }
  return board;
}

/** Best distinct assignment by brute force (8 actors, 3 roles: trivial). Used for tests and the "Madame disagrees" nudge. */
export function bestCast(scores, actors) {
  const ids = actors || [...new Set(ROLES.flatMap((r) => Object.keys(scores?.[r] || {})))];
  let best = null;
  let bestTotal = -Infinity;
  for (const a of ids) for (const b of ids) for (const c of ids) {
    if (a === b || b === c || a === c) continue;
    const cast = { lead: a, villain: b, fool: c };
    const t = castTotal(cast, scores);
    if (t > bestTotal) { bestTotal = t; best = cast; }
  }
  return best ? { cast: best, total: bestTotal } : { cast: emptyCast(), total: 0 };
}

export function scoreTier(score) {
  if (score == null) return 'none';
  if (score >= 75) return 'great';
  if (score >= 60) return 'good';
  if (score >= 45) return 'meh';
  return 'poor';
}

/** How a performer sits in a role: natural / understudy (Gus, 75 everywhere) / off-type. */
export function roleFit(performer, role) {
  if (!performer) return 'off-type';
  if ((performer.roles || []).includes(role)) return 'natural';
  if (!performer.roles || performer.roles.length === 0) return 'understudy';
  return 'off-type';
}

/** Madame's reaction to the player's cast versus her own proposal. */
export function castVerdict(total, proposedTotal) {
  const d = total - proposedTotal;
  if (d >= 6) return { mood: 'delighted', text: 'Darling, you have out-cast me. I shall be unbearable about it.' };
  if (d >= -2) return { mood: 'pleased', text: 'Acceptable. Nobody will be weeping, except where scripted.' };
  if (d >= -25) return { mood: 'doubtful', text: 'Well. A choice. I have made a note of it, in the margin, in red.' };
  return { mood: 'appalled', text: 'Darling, no. Darling, absolutely, structurally no.' };
}

/* ------------------------------------------------------------------------------------------ stars, tallies */

export const roundHalf = (x) => Math.round(clamp(Number(x) || 0, 0, 5) * 2) / 2;

/** 'full' | 'half' | 'empty' for each of `max` stars. */
export function starSlots(stars, max = 5) {
  const v = roundHalf(stars);
  const out = [];
  for (let i = 0; i < max; i++) out.push(v >= i + 1 ? 'full' : v >= i + 0.5 ? 'half' : 'empty');
  return out;
}

/** Madame's "stars of faith": 0-3 (accepts halves). */
export const faithStars = (c) => Math.round(clamp(Number(c) || 0, 0, 3) * 2) / 2;

export function meanStars(list) {
  const xs = (list || []).filter((x) => x !== null && x !== '' && x !== undefined).map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Tour star progress against the 15-star target. `history` = tour.history rows; `nightStars` = tonight's. */
export function tourTally(history, nightStars, { target = STAR_TARGET, nights = TOUR_NIGHTS, night = null } = {}) {
  const rows = (history || []).filter((h) => night == null || h.night !== night); // never double-count tonight
  const previous = rows.reduce((a, h) => a + (Number(h.stars) || 0), 0);
  const tonight = Number(nightStars) || 0;
  const total = previous + tonight;
  const played = rows.length + 1;
  const remainingNights = Math.max(0, nights - played);
  const needed = Math.max(0, target - total);
  const perNight = remainingNights > 0 ? needed / remainingNights : needed;
  return {
    previous,
    tonight,
    total,
    target,
    needed,
    pct: clamp(total / target, 0, 1),
    played,
    remainingNights,
    perNight: Math.round(perNight * 10) / 10,
    reached: total >= target,
    status: total >= target ? 'triumph' : needed === 0 ? 'triumph' : remainingNights === 0 ? 'tragedy' : perNight > 5 ? 'hopeless' : perNight > 4 ? 'steep' : 'on-track',
  };
}

export function tallyQuip(t) {
  switch (t.status) {
    case 'triumph': return 'A critical triumph. The pigeons are insufferable.';
    case 'tragedy': return t.total >= 11 ? 'Respectable. The wagon sighs, but forgivingly.' : 'A tragedy. Probably. Possibly on purpose.';
    case 'hopeless': return 'The maths has left the building.';
    case 'steep': return `Steep: ${t.perNight} stars a night from here. Possible, in the way that flight is possible for a goose.`;
    default: return `${t.perNight} stars a night will do it. Keep the goose away from the candles.`;
  }
}

/* ------------------------------------------------------------------------------------------ rehearsal */

export const bucketStar = (s) => clamp(Math.round(Number(s) || 1), 1, 5);

/** Star histogram [n1..n5] from rehearsal samples (or plain star numbers). */
export function histogram(samples) {
  const h = [0, 0, 0, 0, 0];
  for (const s of samples || []) {
    const v = typeof s === 'number' ? s : s?.stars;
    if (!Number.isFinite(v)) continue;
    h[bucketStar(v) - 1]++;
  }
  return h;
}

export function histogramMax(h) {
  return Math.max(1, ...(h || [0]));
}

/** Risk rows -> [{title, freq, pct}] sorted by likelihood; `freq` may be a 0-1 share or a count out of `samples`. */
export function normalizeRisk(risk, samples = 12) {
  const rows = (risk || []).map((r) => {
    const f = Number(r.freq) || 0;
    const pct = f > 1 ? f / Math.max(1, samples) : f;
    return { title: r.title ?? humanize(r.id ?? '?'), freq: f, pct: clamp(pct, 0, 1) };
  });
  rows.sort((a, b) => b.pct - a.pct);
  return rows;
}

export const STAR_COLOURS = { 1: 'var(--coral)', 2: 'var(--mustard)', 3: 'var(--lilac)', 4: 'var(--teal)', 5: 'var(--gold)' };
export const starColour = (s) => STAR_COLOURS[bucketStar(s)];

export function rehearsalVerdictMood(mean) {
  if (mean >= 4) return 'glowing';
  if (mean >= 3) return 'hopeful';
  if (mean >= 2) return 'wobbly';
  return 'grim';
}

/* ------------------------------------------------------------------------------------------ writers */

/** Insert or replace a draft by quill. Returns {drafts, replaced} so the view can crumple the old card. */
export function upsertDraft(drafts, draft) {
  const list = [...(drafts || [])];
  const i = list.findIndex((d) => d.quill === draft.quill);
  if (i >= 0) {
    const replaced = list[i];
    list[i] = draft;
    return { drafts: list, replaced };
  }
  list.push(draft);
  return { drafts: list, replaced: null };
}

export const QUILL_ORDER = ['quill_pompous', 'quill_frantic', 'quill_tender'];
export function quillMood(id) {
  return String(id || '').replace(/^quill_/, '') || 'pompous';
}
export function sortDrafts(drafts) {
  return [...drafts].sort((a, b) => QUILL_ORDER.indexOf(a.quill) - QUILL_ORDER.indexOf(b.quill));
}

/* ------------------------------------------------------------------------------------------ almanac */

/** Select or deselect a calamity, honouring `max`. Returns {selected, rejected}. */
export function toggleSelection(selected, id, max = 2) {
  const cur = [...(selected || [])];
  const i = cur.indexOf(id);
  if (i >= 0) { cur.splice(i, 1); return { selected: cur, rejected: false }; }
  if (cur.length >= max) return { selected: cur, rejected: true };
  cur.push(id);
  return { selected: cur, rejected: false };
}

/** Fold `almanac.noted` events into jars: [{calamity, count, text}] in first-seen order. */
export function foldJars(jars, d) {
  const list = jars.map((j) => ({ ...j }));
  const j = list.find((x) => x.calamity === d.calamity);
  if (j) { j.count = Math.max(j.count, d.count ?? j.count + 1); j.text = d.text ?? j.text; return { jars: list, isNew: false, jar: j }; }
  const nj = { calamity: d.calamity, count: d.count ?? 1, text: d.text ?? '', title: humanize(d.calamity) };
  list.push(nj);
  return { jars: list, isNew: true, jar: nj };
}

/* ------------------------------------------------------------------------------------------ the road */

/** Effect objects (road_events choices) -> display chips. */
export function effectChips(effects, performersById = {}) {
  const chips = [];
  if (!effects) return chips;
  if (Number.isFinite(effects.funds) && effects.funds !== 0) chips.push({ kind: 'funds', amount: effects.funds, label: `${signed(effects.funds)} fund${Math.abs(effects.funds) === 1 ? '' : 's'}` });
  if (Number.isFinite(effects.morale) && effects.morale !== 0) chips.push({ kind: 'morale', amount: effects.morale, label: `${signed(effects.morale)} morale` });
  if (Number.isFinite(effects.encore) && effects.encore !== 0) chips.push({ kind: 'encore', amount: effects.encore, label: `${signed(effects.encore)} Encore` });
  for (const [who, n] of Object.entries(effects.rapport || {})) {
    if (!n) continue;
    const name = shortName(performersById[who]?.name) || humanize(who);
    chips.push({ kind: 'rapport', amount: n, who, label: `${signed(n)} rapport with ${name}` });
  }
  return chips;
}
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/** Last-resort effects from a choice label such as "Offer bread (-1 fund)" or "Pay the toll (-2 funds, +1 morale)". */
export function parseEffectLabel(label) {
  const out = {};
  const m = String(label ?? '').match(/\(([^)]*)\)\s*$/);
  if (!m) return null;
  for (const part of m[1].split(/[,;]/)) {
    const k = /([+\-\u2212]?\s*\d+)\s*(funds?|morale|encore)/i.exec(part);
    if (!k) continue;
    const n = parseInt(k[1].replace(/\s|\u2212/g, (c) => (c === '\u2212' ? '-' : '')), 10);
    const key = k[2].toLowerCase().startsWith('fund') ? 'funds' : k[2].toLowerCase();
    if (Number.isFinite(n)) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}

export const roadPct = (p) => clamp(Number(p) || 0, 0, 100);

/* ------------------------------------------------------------------------------------------ greenroom */

/** Hearts for a rapport value (0..max). Rapport may be fractional: halves are shown. */
export function hearts(rapport, max = 5) {
  const v = Math.round(clamp(Number(rapport) || 0, 0, max) * 2) / 2;
  const out = [];
  for (let i = 0; i < max; i++) out.push(v >= i + 1 ? 'full' : v >= i + 0.5 ? 'half' : 'empty');
  return out;
}

export const QUICK_PROMPTS = [
  'Calm your nerves?',
  'Do you need a prop?',
  'Any gossip?',
  'What is your worst flaw, honestly?',
];

/** langchain HITL middleware payload -> [{index, name, args, description, allowed}]. */
export function hitlRequests(payload) {
  const reqs = payload?.action_requests || [];
  const cfgs = payload?.review_configs || [];
  return reqs.map((r, index) => {
    const cfg = cfgs.find((c) => c.action_name === r.name || c.name === r.name) || cfgs[index] || {};
    const allowed = cfg.allowed_decisions || ['approve', 'edit', 'reject'];
    return { index, name: r.name ?? r.action ?? 'tool', args: r.args ?? r.arguments ?? {}, description: r.description ?? '', allowed };
  });
}

/** choices[i] = {type:'approve'} | {type:'edit', args} | {type:'reject', message?}  ->  resume dict (PROTOCOL 2.8). */
export function hitlDecisions(requests, choices) {
  const decisions = requests.map((r, i) => {
    const c = choices[i] || { type: 'approve' };
    if (c.type === 'edit') return { type: 'edit', edited_action: { name: r.name, args: c.args ?? r.args } };
    if (c.type === 'reject') return c.message ? { type: 'reject', message: c.message } : { type: 'reject' };
    return { type: 'approve' };
  });
  return { decisions };
}

/**
 * A fetch_prop costs funds. The model's tool call carries only {prop}; the price (1-3, a pure function of the prop's name) is in
 * the server's description ("... It costs 2 funds. ..."), so read args first, then that sentence, else the fallback.
 */
export function propCost(req, fallback = 1) {
  const a = req?.args || {};
  const n = Number(a.cost ?? a.price ?? a.funds);
  if (a.cost != null || a.price != null || a.funds != null) { if (Number.isFinite(n)) return n; }
  const m = /costs\s+(\d+)\s+funds?\b/i.exec(String(req?.description || ''));
  return m ? Number(m[1]) : fallback;
}

/** Stable per-tour, per-performer key for chat memory. */
export const chatKey = (tourId, actorId) => `tragedy.greenroom.${tourId || 'tour'}.${actorId || 'actor'}`;

/* ------------------------------------------------------------------------------------------ playbill */

export const PLAYBILL_ORDER = ['masthead', 'cast', 'tonight', 'traditions', 'quote', 'back_page', 'previously'];

const SECTION_ALIASES = {
  masthead: 'masthead', title: 'masthead', header: 'masthead', town: 'masthead', poster: 'masthead',
  cast: 'cast', bios: 'cast', bio: 'cast', players: 'cast',
  tonight: 'tonight', tonight_in: 'tonight', programme: 'tonight', program: 'tonight',
  traditions: 'traditions', traditions_page: 'traditions', tradition: 'traditions',
  quote: 'quote', review: 'quote', review_wall: 'quote', reviews: 'quote', headline: 'quote',
  back_page: 'back_page', backpage: 'back_page', notices: 'back_page', back: 'back_page',
  previously: 'previously', history: 'previously', layout: 'previously',
};

/** Map a `playbill.section` name onto a canonical poster section; unknown names take the next unrevealed one. */
export function sectionFor(name, revealed = []) {
  const key = SECTION_ALIASES[String(name || '').toLowerCase().replace(/[\s-]+/g, '_')];
  if (key) return key;
  return PLAYBILL_ORDER.find((s) => !revealed.includes(s)) ?? null;
}

const asList = (x) => (Array.isArray(x) ? x : x == null || x === '' ? [] : [x]);
const strOf = (x) => (typeof x === 'string' ? x : x?.title ?? x?.text ?? x?.name ?? String(x ?? ''));

/** Normalise whatever `playbill_press` returned into the shape the poster and the PNG share. */
export function normalizePlaybill(pb, { towns = {}, genres = {}, performers = {}, params = {} } = {}) {
  const p = pb || {};
  const townId = p.town ?? params.town;
  const town = towns[townId]?.name ?? (typeof townId === 'string' ? humanize(townId) : townId?.name ?? 'Somewhere Damp');
  const genreId = p.genre ?? params.genre;
  const genre = genres[genreId]?.name ?? humanize(genreId ?? 'melodrama');
  const night = Number.isFinite(p.night) ? p.night : params.night ?? 0;
  const cast = asList(p.cast).map((c, i) => {
    const perf = performers[c.id] || {};
    return {
      id: c.id ?? `p${i}`,
      name: c.name ?? perf.name ?? humanize(c.id),
      role: c.role_label ?? (genres[genreId]?.roles?.[c.role]) ?? c.role ?? '',
      roleKey: c.role,
      bio: c.bio ?? '',
    };
  });
  return {
    title: p.title ?? params.script?.title ?? 'An Untitled Calamity',
    tagline: p.tagline ?? params.script?.tagline ?? '',
    town,
    townId: typeof townId === 'string' ? townId : null,
    night,
    nightLabel: `Night ${night + 1}`,
    genre,
    genreId,
    cast,
    tonight: asList(p.tonight).map(strOf),
    traditions: asList(p.traditions).map(strOf),
    quote: strOf(p.quote ?? params.headline ?? ''),
    stars: p.stars ?? params.stars ?? null,
    back_page: asList(p.back_page).map(strOf),
    previously: asList(p.previously).map((x) => (typeof x === 'string' ? { text: x } : { text: x.title ?? x.text ?? '', stars: x.stars, town: x.town, night: x.night })),
  };
}

/** Greedy word wrap. `measure(text)` -> pixel width. Very long words are hard-split. */
export function wrapText(text, maxWidth, measure) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const push = () => { if (cur) lines.push(cur); cur = ''; };
  for (let w of words) {
    while (measure(w) > maxWidth && w.length > 1) { // hard split a monster word
      let k = w.length - 1;
      while (k > 1 && measure(w.slice(0, k) + '-') > maxWidth) k--;
      if (cur) push();
      lines.push(w.slice(0, k) + '-');
      w = w.slice(k);
    }
    const trial = cur ? `${cur} ${w}` : w;
    if (measure(trial) <= maxWidth) cur = trial;
    else { push(); cur = w; }
  }
  push();
  return lines;
}

/**
 * Typeset a playbill into draw ops (a poster layout shared by the PNG export and tested without a canvas).
 * measure(text, font) -> width.  Returns {ops, height, scale, overflow}.
 */
export function layoutPlaybill(pb, measure, { width = 1080, height = 1440, margin = 78, portraits = true } = {}) {
  const FONT = {
    display: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    hand: '"Bradley Hand", "Segoe Script", "Marker Felt", "Comic Sans MS", cursive',
  };
  for (const scale of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
    const L = typeset(pb, measure, { width, margin, scale, FONT, portraits });
    const frame = L.ops.find((o) => o.t === 'frame');
    if (frame) frame.h = height - 56;
    if (L.y <= height - margin * 0.8) return { ops: L.ops, height, contentHeight: L.y, scale, overflow: false };
    if (scale === 0.6) return { ops: L.ops, height, contentHeight: L.y, scale, overflow: true };
  }
  return { ops: [], height, contentHeight: 0, scale: 1, overflow: true };
}

function typeset(pb, measure, { width, margin, scale, FONT, portraits }) {
  const ops = [];
  const innerW = width - margin * 2;
  let y = margin + 18 * scale;
  const px = (n) => Math.round(n * scale);
  const font = (size, style = '', fam = FONT.display) => `${style ? style + ' ' : ''}${px(size)}px ${fam}`;
  const text = (t, x, size, { style = '', fam = FONT.display, fill = '#241a26', align = 'center', lh = 1.2, maxW = innerW, spacing = 0 } = {}) => {
    const f = font(size, style, fam);
    const lines = wrapText(t, maxW, (s) => measure(s, f));
    for (const ln of lines) {
      y += px(size) * lh * 0.82;
      ops.push({ t: 'text', text: ln, x, y, font: f, fill, align, spacing });
      y += px(size) * lh * 0.18;
    }
    return lines.length;
  };
  const cx = width / 2;
  const gap = (n) => { y += px(n); };
  const rule = (ornament = true) => {
    ops.push({ t: 'rule', x1: margin + 40, x2: width - margin - 40, y, ornament });
    gap(ornament ? 26 : 12);
  };

  ops.push({ t: 'frame', x: 28, y: 28, w: width - 56, h: 0 }); // h set by layoutPlaybill (full page)
  text('THE WIBBLING PLAYERS PRESENT', cx, 26, { fill: '#7d1527', spacing: 6 });
  gap(10);
  text(pb.title, cx, 84, { style: 'bold', fill: '#b3263d', lh: 1.05 });
  if (pb.tagline) { gap(6); text(pb.tagline, cx, 34, { style: 'italic', fam: FONT.hand, fill: '#4a3b4d' }); }
  gap(14);
  text(`${pb.genre} in ${pb.town}`, cx, 36, { style: 'bold', fill: '#241a26' });
  text(`${pb.nightLabel}  /  doors at dusk, curtain at about dusk`, cx, 24, { fill: '#4a3b4d' });
  gap(10);
  if (portraits && pb.cast.length) {
    const size = px(150);
    ops.push({ t: 'portraits', y, size, ids: pb.cast.slice(0, 3).map((c) => c.id), labels: pb.cast.slice(0, 3).map((c) => c.roleKey || '') });
    y += size + px(10);
  }
  gap(4);
  rule();

  if (pb.cast.length) {
    text('WITH', cx, 22, { fill: '#a97c1f', spacing: 8 });
    gap(6);
    for (const c of pb.cast) {
      text(`${c.name}${c.role ? '  as  ' + c.role : ''}`, cx, 32, { style: 'bold' });
      if (c.bio) text(c.bio, cx, 23, { style: 'italic', fill: '#4a3b4d', maxW: innerW - 60, lh: 1.18 });
      gap(10);
    }
    rule(false);
  }
  if (pb.tonight.length) {
    text('TONIGHT', cx, 22, { fill: '#a97c1f', spacing: 8 });
    gap(4);
    for (const t of pb.tonight.slice(0, 5)) text(t, cx, 25, { maxW: innerW - 80 });
    gap(10);
  }
  if (pb.traditions.length) {
    text('BY LONG TRADITION', cx, 22, { fill: '#a97c1f', spacing: 8 });
    gap(4);
    text(pb.traditions.join('   *   '), cx, 27, { style: 'italic', fill: '#7d1527', maxW: innerW - 40 });
    gap(10);
  }
  if (pb.quote) {
    rule();
    text(`“${pb.quote}”`, cx, 40, { style: 'italic', fill: '#241a26', maxW: innerW - 60, lh: 1.15 });
    if (pb.stars != null) { gap(4); text(`${'★'.repeat(Math.round(pb.stars))}${'☆'.repeat(Math.max(0, 5 - Math.round(pb.stars)))}   ${pb.stars} stars`, cx, 30, { fill: '#a97c1f' }); }
    gap(12);
  }
  let boxTop = null;
  if (pb.back_page.length) {
    boxTop = y;
    gap(10);
    text('NOTICES', cx, 20, { fill: '#7d1527', spacing: 8 });
    for (const n of pb.back_page.slice(0, 4)) text(n, cx, 22, { style: 'italic', maxW: innerW - 120, lh: 1.15 });
    gap(10);
    ops.push({ t: 'box', x: margin + 30, y: boxTop, w: innerW - 60, h: y - boxTop });
    gap(12);
  }
  if (pb.previously.length) {
    text('PREVIOUSLY ON TOUR', cx, 18, { fill: '#a97c1f', spacing: 7 });
    gap(2);
    const prev = pb.previously.slice(-4);
    const col = innerW / prev.length;
    const startY = y;
    let maxLines = 0;
    prev.forEach((p, i) => {
      y = startY;
      const f = font(18, 'italic');
      const lines = wrapText(p.text, col - 16, (s) => measure(s, f)).slice(0, 3);
      lines.forEach((ln) => { y += px(18) * 1.1; ops.push({ t: 'text', text: ln, x: margin + col * i + col / 2, y, font: f, fill: '#4a3b4d', align: 'center', spacing: 0 }); });
      maxLines = Math.max(maxLines, lines.length);
    });
    y = startY + maxLines * px(18) * 1.1 + px(8);
  }
  return { ops, y };
}

/* ------------------------------------------------------------------------------------------ colours */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Only ever let a real hex colour into an SVG string. */
export function safeColour(c, fallback = '#888888') {
  return typeof c === 'string' && HEX.test(c.trim()) ? c.trim() : fallback;
}
function toRgb(hex) {
  let h = safeColour(hex).slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (rgb) => '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
/** amt in -1..1: negative darkens, positive lightens. */
export function shade(hex, amt) {
  const rgb = toRgb(hex);
  return toHex(rgb.map((v) => (amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
}
export function mix(a, b, t) {
  const x = toRgb(a), y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/**
 * A town's name as it reads in a short badge ("... loves this"). The old code took the first word, which turned
 * "The Royal Opera House of Wibbling" into "The" and "Twelve Bridges" into "Twelve" (a playtest saw "Twelve loves this").
 */
export function townShort(name) {
  const n = String(name || '').replace(/^The\s+/i, '').split(/-|\s+(?:of|under|upon|on)\s+/i)[0].trim();
  return n || 'This town';
}

/**
 * The title screen's one-line truth about who is speaking. It used to say "offline and deterministic" for anything that was not
 * Claude, which was wrong the moment OpenAI voiced the puppets. `boot` is GET /api/boot (or null before it loads).
 */
export function puppetLabel(boot) {
  if (!boot) return 'Puppets: offline';
  const model = boot.model ? ` (${boot.model})` : '';
  if (boot.provider === 'anthropic') return `Puppets: voiced by Claude${model}`;
  if (boot.provider === 'openai') return `Puppets: voiced by OpenAI${model}`;
  return 'Puppets: offline and deterministic';
}

/**
 * A gentle line for the tour screen when money is just sitting in the wagon. A full bot-played tour ended with 28 unspent funds because
 * nothing ever told the player the Greenroom is where funds go. Returns null when there is nothing worth saying.
 */
export function greenroomHint(tour) {
  if (!tour || tour.status !== 'active') return null;
  const funds = Number.isFinite(tour.funds) ? tour.funds : 0;
  const owned = Array.isArray(tour.props) ? tour.props.length : 0;
  if (funds < 3) return null;
  if (owned === 0) return `${funds} funds in the wagon and no real props. Mrs. Gasket in the Greenroom can fetch one a play will ask for: it warms the house.`;
  if (funds >= 12) return `${funds} funds are just sitting in the wagon. The Greenroom has more props to fetch.`;
  return null;
}

/**
 * Does this town love or scorn this genre? (`temperament.favours` / `scorns`, from the towns dataset.)
 * A fun audit found one genre best in every town; each town now has a favourite and a genre it scorns, and the genre cards say so.
 */
export function genreTaste(town, genreId) {
  const t = town?.temperament;
  if (!t || !genreId) return null;
  if (t.favours === genreId) return 'loved';
  if (t.scorns === genreId) return 'scorned';
  return null;
}

/**
 * Which genre is pre-selected on the tour screen: one the town neither loves nor scorns, so pressing "Begin" without reading the cards
 * plays an ordinary night (and reading them is what earns the bonus). `pick` is a stable number so the choice does not flicker.
 */
export function defaultGenreId(genres, town, pick = 0) {
  const all = Array.isArray(genres) ? genres : [];
  if (!all.length) return undefined;
  const neutral = all.filter((g) => genreTaste(town, g.id) === null);
  const pool = neutral.length ? neutral : all;
  return pool[Math.abs(pick) % pool.length].id;
}
