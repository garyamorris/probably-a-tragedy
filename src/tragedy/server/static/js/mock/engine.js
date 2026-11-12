// Mock graph engine: one generator per graph (docs/PROTOCOL.md sections 2 and 4). A generator yields frames
// ({event, data, dt?}) in exactly the shape the Agent Server streams them, and `yield f.interrupt(payload)` to pause for
// the player (the transport sends the interrupt frames, ends the stream, and later resumes the generator with the answer).
// Everything is deterministic in (seed, night, ...labels), like the real engine.

import * as D from './data.js';

// ---------------------------------------------------------------------------------------------------------------
// deterministic helpers

export function hash(...parts) {
  let x = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 13;
  return x >>> 0;
}
export const roll = (...p) => (hash(...p) % 100000) / 100000;
export const chance = (prob, ...p) => roll(...p) < prob;
export const pick = (arr, ...p) => arr[hash(...p) % arr.length];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;
export const humanize = (slug) => String(slug ?? '').replace(/[_-]+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const clone = (x) => JSON.parse(JSON.stringify(x));
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const P = byId(D.PERFORMERS);
const STAFF = byId(D.STAFF);
const GEN = byId(D.GENRES);
const TOWN = byId(D.TOWNS);
const MISH = byId(D.MISHAPS);
const CUE = byId(D.CUES);
const TASTE = byId(D.TASTES);
const first = (name) => String(name).replace(/^(Sir|Mr\.|Mrs\.|Captain|The)\s+/, '').split(' ')[0];

export function deriveStatus(tour) {
  if ((tour.history || []).length < 5) return 'active';
  const total = tour.history.reduce((a, n) => a + n.stars, 0);
  return total >= 15 ? 'triumph' : total >= 11 ? 'respectable' : 'tragedy';
}

// ---------------------------------------------------------------------------------------------------------------
// frame builder

export class Frames {
  constructor(env) {
    this.env = env;
    this.ns = '';
    this.stack = [];
    this.n = 0;
    this.open = new Map();
    this.msg = 0;
  }
  _ev(mode, data, dt = 2) {
    return { event: this.ns ? `${mode}|${this.ns}` : mode, data, dt };
  }
  custom(kind, key, data, agent = null, dt = 2) {
    return this._ev('custom', { v: 1, kind, key, agent, data }, dt);
  }
  progress(label, pct, key) {
    return this.custom('progress', key || `progress:${label}`, { label, pct }, null, 3);
  }
  start(name) {
    const id = `${this.env.thread.id.slice(0, 8)}-${++this.n}-${name}`;
    this.open.set(name + this.ns, id);
    return this._ev('tasks', { id, name, input: {}, triggers: ['branch:to:' + name] }, 2);
  }
  end(name, result = null, interrupts = []) {
    const id = this.open.get(name + this.ns) || `x-${name}`;
    return this._ev('tasks', { id, name, error: null, result, interrupts }, 2);
  }
  values(patch = {}, dt = 2) {
    Object.assign(this.env.thread.values, patch);
    return { event: 'values', data: clone(this.env.thread.values), dt };
  }
  enter(sub) {
    this.stack.push(this.ns);
    this.ns = `${sub}:${hash(this.env.thread.id, sub, ++this.n).toString(16).padStart(8, '0')}${hash(sub, this.n).toString(16).padStart(4, '0')}`.slice(0, sub.length + 14);
    return this.ns;
  }
  leave() {
    this.ns = this.stack.pop() || '';
  }
  /** Token frames for a speech, as `messages` (messages-tuple) events. */
  *say(text, { node = 'model', actor = null, dt = 7 } = {}) {
    const id = `run-${this.env.thread.id.slice(0, 6)}-${++this.msg}`;
    const meta = { langgraph_node: node, langgraph_step: this.n, langgraph_checkpoint_ns: this.ns, ...(actor ? { actor } : {}) };
    for (const w of String(text).match(/\S+\s*/g) || []) yield this._ev('messages', [{ type: 'AIMessageChunk', id, content: w }, meta], dt);
  }
  checkpoint(values, next, snapshot) {
    const id = `1f0${hash(this.env.thread.id, ++this.env.thread.cpN).toString(16).padStart(8, '0')}-${String(this.env.thread.cpN).padStart(4, '0')}`;
    const parent = this.env.thread.lastCp || null;
    this.env.thread.lastCp = id;
    const step = this.env.thread.step++;
    const rec = { values: clone(values), next, checkpoint: { checkpoint_id: id, checkpoint_ns: '' }, parent_checkpoint: parent ? { checkpoint_id: parent } : null, metadata: { source: 'loop', step }, created_at: new Date().toISOString(), tasks: [] };
    this.env.thread.history.unshift(rec);
    if (snapshot) this.env.thread.snapshots[id] = clone(snapshot);
    return {
      event: 'checkpoints',
      data: { config: { configurable: { thread_id: this.env.thread.id, checkpoint_ns: '', checkpoint_id: id } }, parent_config: parent ? { configurable: { thread_id: this.env.thread.id, checkpoint_ns: '', checkpoint_id: parent } } : null, values: rec.values, metadata: rec.metadata, next, tasks: [], created_at: rec.created_at },
      dt: 2,
    };
  }
  interrupt(payload) {
    const id = hash(this.env.thread.id, 'interrupt', ++this.env.thread.intN).toString(16).padStart(8, '0').repeat(4);
    return { interrupt: { id, value: payload } };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// shared pieces

const ROLES = ['lead', 'villain', 'fool'];
const castNames = (cast) => ({ lead: first(P[cast.lead]?.name), villain: first(P[cast.villain]?.name), fool: first(P[cast.fool]?.name) });

function fillText(text, cast, extra = {}) {
  const n = castNames(cast);
  return String(text)
    .replaceAll('{lead}', n.lead)
    .replaceAll('{villain}', n.villain)
    .replaceAll('{fool}', n.fool)
    .replaceAll('{place}', extra.place || 'the stage')
    .replaceAll('{town}', extra.town || 'town')
    .replaceAll('{object}', extra.object || 'prop');
}

function roleScore(p, role, genre, seedLabel) {
  const s = p.skills;
  const sb = genre.skill_by_beat;
  const base = role === 'lead' ? (s[sb.setup] + s[sb.reversal] + s.romance) / 3 : role === 'villain' ? (s.menace * 1.2 + s[sb.finale] + s.drama) / 3.2 : (s.comedy + s.improv + s.physical) / 3;
  const fit = p.roles.includes(role) ? 12 : p.id === 'gus' ? 6 : -6;
  const jitter = (roll(seedLabel, p.id, role) - 0.5) * 8;
  return clamp(Math.round(base + fit - p.stage_fright / 20 + jitter), 5, 99);
}

function recommendCast(scores, candidates) {
  const used = new Set();
  const cast = {};
  for (const role of ROLES) {
    const best = candidates.filter((id) => !used.has(id)).sort((a, b) => scores[role][b] - scores[role][a])[0];
    cast[role] = best;
    used.add(best);
  }
  return cast;
}

function validCast(c, candidates) {
  return c && ROLES.every((r) => candidates.includes(c[r])) && new Set(ROLES.map((r) => c[r])).size === 3;
}

// ---------------------------------------------------------------------------------------------------------------
// casting_call

function* castingCall(env) {
  const { input, f } = env;
  const genre = GEN[input.genre] || D.GENRES[0];
  const candidates = input.candidates || D.PERFORMERS.map((p) => p.id);
  const key = `${input.seed}:${input.night}`;
  yield f.values({ tour_id: input.tour_id, night: input.night, seed: input.seed, genre: genre.id, town: input.town, candidates });
  yield f.start('load');
  yield f.progress('Pinning up the audition notice', 0.05);
  yield f.end('load');
  yield f.start('audition');
  const scores = { lead: {}, villain: {}, fool: {} };
  let n = 0;
  for (const role of ROLES) {
    for (const id of candidates) {
      const p = P[id];
      const score = roleScore(p, role, genre, key);
      scores[role][id] = score;
      const line = pick(p.voice.catchphrases, key, id, role);
      yield f.custom('cast.audition', `aud:n${input.night}:${role}:${id}`, { role, actor: id, score, line: `${first(p.name)} auditions as ${genre.roles[role]}: "${line}"` }, id, 3);
      if (++n % 6 === 0) yield f.progress('Auditions', n / (candidates.length * 3), `progress:aud:${n}`);
    }
  }
  yield f.end('audition');
  yield f.start('rank');
  const proposed = recommendCast(scores, candidates);
  yield f.end('rank', { proposed });
  yield f.start('recommend');
  const note = `Darling, no, wait, yes. ${first(P[proposed.lead].name)} as ${genre.roles.lead}, ${first(P[proposed.villain].name)} as ${genre.roles.villain}, and ${first(P[proposed.fool].name)} as ${genre.roles.fool}. It is the least terrible arrangement.`;
  yield* f.say(note, { node: 'recommend', actor: 'madame' });
  yield f.custom('cast.recommend', `rec:n${input.night}`, { cast: proposed, note, scores }, 'madame', 4);
  yield f.end('recommend');
  yield f.start('confirm_cast');
  const resume = yield f.interrupt({ kind: 'confirm_cast', proposed, scores, note, genre: genre.id });
  const cast = validCast(resume?.cast, candidates) ? resume.cast : proposed;
  yield f.end('confirm_cast');
  yield f.start('done');
  yield f.end('done');
  yield f.values({ cast });
}

// ---------------------------------------------------------------------------------------------------------------
// writers_room

const QUILL_STYLE = {
  quill_pompous: { extra: ['speech', 'crown'], titles: ['The Tragedy of {town}', 'A Crown for the Unworthy', 'Doom, With Footnotes'], tag: 'A grand and sorrowful thing.', suffix: ' Trumpets, preferably.' },
  quill_frantic: { extra: ['chase', 'slapstick'], titles: ['Run, {lead}, Run!', 'Seventeen Doors and a Goose', 'Quick, the Other Door'], tag: 'No time to explain; there are doors.', suffix: ' At a run.' },
  quill_tender: { extra: ['song', 'reunion'], titles: ['The Quiet Hours of {town}', 'And Then, Softly', 'A Small Song for the Lost'], tag: 'It will hurt, but gently.', suffix: ' With a small, sad song.' },
};

function townFavour(town, tags) {
  let s = 0;
  for (const t of tags) {
    if (town.temperament.likes.includes(t)) s += 2.5;
    if (town.temperament.hates.includes(t)) s -= 3;
  }
  return s;
}

function* writersRoom(env) {
  const { input, f } = env;
  const genre = GEN[input.genre] || D.GENRES[0];
  const town = TOWN[input.town] || D.TOWNS[0];
  const cast = input.cast;
  const trad = input.traditions || [];
  yield f.values({ tour_id: input.tour_id, night: input.night, seed: input.seed, genre: genre.id, town: town.id, cast, traditions: trad });
  yield f.start('brief');
  yield f.progress('Briefing the herons', 0.1);
  yield f.end('brief');
  yield f.start('quills');
  const drafts = [];
  const scoreById = {};
  for (const quillId of ['quill_pompous', 'quill_frantic', 'quill_tender']) {
    const q = QUILL_STYLE[quillId];
    const title = fillText(pick(q.titles, input.seed, input.night, quillId), cast, { town: town.name });
    const beats = D.BEATS.map((b, i) => {
      const v = genre.beats[b][hash(input.seed, input.night, quillId, b) % genre.beats[b].length];
      const extraTag = i % 2 === 1 ? q.extra[0] : q.extra[1];
      return { beat: b, variant: v.id, logline: fillText(v.logline, cast, { town: town.name }) + q.suffix, tags: [...v.tags, extraTag] };
    });
    const allTags = [...new Set(beats.flatMap((b) => b.tags))];
    const trueScore = clamp(0.5 + townFavour(town, allTags) / 20 + (roll(input.seed, input.night, quillId) - 0.5) * 0.3, 0.05, 0.98);
    const draft_id = `draft_${quillId.replace('quill_', '')}`;
    const confidence = clamp(Math.round(trueScore * 3 + (roll(draft_id, input.night) - 0.5) * 1.6), 0, 3);
    scoreById[draft_id] = trueScore;
    const draft = { draft_id, quill: quillId, title, tagline: q.tag, beats: beats.map(({ beat, logline, tags }) => ({ beat, logline, tags })), confidence };
    drafts.push({ ...draft, _beats: beats });
    yield f.custom('script.draft', `draft:n${input.night}:${draft_id}`, draft, quillId, 10);
  }
  yield f.end('quills');
  yield f.start('judge');
  yield f.progress('Madame reads the drafts with a pencil', 0.7);
  yield f.end('judge', { best: Object.entries(scoreById).sort((a, b) => b[1] - a[1])[0][0] });
  yield f.start('pick_draft');
  const publicDrafts = drafts.map(({ _beats, ...d }) => d);
  const resume = yield f.interrupt({ kind: 'pick_draft', drafts: publicDrafts });
  const chosen = drafts.find((d) => d.draft_id === resume?.draft_id) || drafts[0];
  yield f.custom('script.chosen', `chosen:n${input.night}`, { draft_id: chosen.draft_id }, 'madame');
  yield f.end('pick_draft');
  yield f.start('finalize');
  const scriptBeats = chosen._beats.map((b) => {
    const v = genre.beats[b.beat].find((x) => x.id === b.variant);
    return { beat: b.beat, variant: v.id, logline: b.logline, tags: b.tags, lines: v.lines.map((l) => ({ role: l.role, text: fillText(l.text, cast, { town: town.name }) })), props: v.props, slots: { object: first(v.props[0] || 'prop'), place: genre.sets[b.beat] } };
  });
  const script = { title: chosen.title, tagline: chosen.tagline, quill: chosen.quill, genre: genre.id, beats: scriptBeats, tags: [...new Set(scriptBeats.flatMap((b) => b.tags))] };
  yield f.end('finalize');
  yield f.values({ script });
}

// ---------------------------------------------------------------------------------------------------------------
// performance (the show)

const EMOTIONS = { lead: ['joy', 'love', 'fear', 'grief', 'joy'], villain: ['smug', 'rage', 'smug', 'rage', 'neutral'], fool: ['neutral', 'fear', 'joy', 'fear', 'joy'] };

function classifyWhisper(text, options) {
  const t = String(text || '').toLowerCase();
  const rules = [
    ['lean_in', /(yes|and|lean|commit|embrace|more|louder|continue|improvise|play along|part of)/],
    ['cover_up', /(cover|hide|ignore|pretend|nothing|quiet|sorry|smile|carry on|move on)/],
    ['blame', /(blame|goose|fault|lie|accuse|not me|someone else)/],
  ];
  for (const [id, re] of rules) if (re.test(t) && options.some((o) => o.id === id)) return id;
  return options[hash(t) % options.length].id;
}

function* performance(env) {
  const { input, tour, f, thread } = env;
  const { seed, night } = input;
  const genre = GEN[input.genre] || D.GENRES[0];
  const town = TOWN[input.town] || D.TOWNS[0];
  const cast = input.cast;
  const script = input.script;
  const trad = (tour?.traditions || []).map((t) => t.calamity);
  const rapport = tour?.rapport || {};
  const onstage = ROLES.map((r) => ({ role: r, id: cast[r], p: P[cast[r]] }));
  const fresh = () => ({ beat: 0, warmth: Math.round(40 + 20 * town.temperament.openness), chaos: 10, quality: [], mishaps: [], calamities: [], decisions: [], cues_left: Object.fromEntries(D.CUES.map((c) => [c.id, c.uses])), cues_used: [], yes_and: 0, tradition_hits: 0, beats: [], expected_paid: false });
  const S = env.from ? clone(env.from) : fresh();
  const seats = Array.from({ length: 12 }, (_, i) => {
    const mixed = town.audience.mix;
    return TASTES_POOL(i < 3 ? mixed[i] : pick(D.TASTES, seed, night, 'seat', i).id);
  });
  const stateValues = () => ({ tour_id: input.tour_id, night, seed, genre: genre.id, town: town.id, cast, script, beat: S.beat, warmth: S.warmth, chaos: S.chaos, quality: S.quality, mishaps: S.mishaps, calamities: S.calamities, decisions: S.decisions, cues_left: S.cues_left, yes_and: S.yes_and, tradition_hits: S.tradition_hits });
  yield f.values(stateValues());

  if (!env.from) {
    yield f.start('curtain_up');
    yield f.progress('The house lights dim', 0.05, 'progress:curtain_up');
    for (let i = 0; i < 12; i++) {
      const t = seats[i];
      yield f.custom('audience.seat', `seat:n${night}:${i}`, { seat: i, taste: t.id, hat: t.hat, palette: t.palette }, null, 2);
    }
    yield f.custom('meter', `meter:n${night}:start`, { warmth: S.warmth, chaos: S.chaos, beat: 0 }, null, 3);
    yield f.end('curtain_up');
  }

  for (let b = S.beat; b < 5; b++) {
    S.beat = b;
    const beatName = D.BEATS[b];
    const sb = script.beats[b];
    const k = `n${night}:b${b}`;
    yield f.checkpoint(stateValues(), ['direct'], S);
    f.enter('beat');

    // --- direct
    yield f.start('direct');
    yield f.custom('stage.beat', `${k}:beat`, { index: b, beat: beatName, name: D.BEAT_NAMES[beatName], logline: sb.logline, tags: sb.tags }, 'madame', 4);
    yield f.custom('stage.set', `${k}:set`, { beat: beatName, set: genre.sets[beatName], sky: town.sky, props: sb.props, palette: genre.palette }, null, 3);
    for (const [i, a] of onstage.entries()) {
      if (b === 0 || (b === 3 && i === 2)) yield f.custom('stage.enter', `${k}:enter:${a.id}`, { actor: a.id, role: a.role, from: i === 1 ? 'right' : i === 2 && b === 3 ? 'trapdoor' : 'left' }, a.id, 5);
    }
    const note = pick([`Places, darlings. ${D.BEAT_NAMES[beatName]}. Try to look as though you meant it.`, `${D.BEAT_NAMES[beatName]}, please. Nobody improvise. Gus, that means you.`, `Darling, no. Yes. ${D.BEAT_NAMES[beatName]}. Go.`], seed, night, b);
    yield* f.say(note, { node: 'direct', actor: 'madame' });
    yield f.custom('stage.direct', `${k}:direct`, { text: note, speaker: 'madame' }, 'madame', 5);
    yield f.end('direct');

    // --- perform
    yield f.start('perform');
    const q = [];
    for (const [i, l] of sb.lines.entries()) {
      const actor = cast[l.role];
      yield f.custom('stage.line', `${k}:line:${i}`, { actor, role: l.role, text: l.text, emotion: EMOTIONS[l.role][(b + i) % 5] }, actor, 4);
      yield* f.say(l.text, { node: 'perform', actor });
    }
    // quality of the beat
    const skill = genre.skill_by_beat[beatName];
    for (const a of onstage) {
      const roleFit = a.p.roles.includes(a.role) ? 100 : a.id === 'gus' ? 75 : 60;
      q.push(clamp(0.5 * a.p.skills[skill] + 0.3 * roleFit + 0.2 * (100 - a.p.stage_fright) - 0.15 * S.chaos, 0, 100));
    }
    const Q = q.reduce((a, x) => a + x, 0) / q.length;
    S.quality.push(Math.round(Q));
    // mishaps: flaw meets beat
    const beatTags = new Set([...sb.tags, ...sb.props]);
    const found = [];
    for (const a of onstage) {
      for (const fl of a.p.flaws.map((id) => D.FLAWS.find((x) => x.id === id)).filter(Boolean)) {
        if (!fl.triggers.some((t) => beatTags.has(t))) continue;
        const prob = clamp(fl.intensity + S.chaos / 250 + a.p.stage_fright / 300 - 0.08 * (rapport[a.id] || 0), 0.05, 0.9);
        if (!chance(prob, seed, night, b, a.id, fl.id)) continue;
        const rows = D.MISHAPS.filter((m) => m.flaw === fl.id);
        if (rows.length) found.push({ a, row: pick(rows, seed, night, b, a.id, fl.id, 'row') });
      }
    }
    // at most two per beat; the Twist forces one (and a major one), and the show needs at least one
    let list = found.slice(0, 2);
    if (b === 3 || (b === 4 && !S.mishaps.length && !list.length)) {
      if (!list.some((m) => m.row.severity === 'major')) {
        const majors = onstage.flatMap((a) => D.MISHAPS.filter((m) => m.severity === 'major' && a.p.flaws.includes(m.flaw)).map((row) => ({ a, row })));
        const forced = majors.length ? pick(majors, seed, night, 'forced') : { a: onstage[1], row: MISH.chandelier_freeze };
        list = [forced, ...list.filter((m) => m.a.id !== forced.a.id)].slice(0, 2);
      }
    }
    if (b === 2 && !list.length && chance(0.4, seed, night, 'rev')) {
      const a = pick(onstage, seed, night, 'rev-actor');
      const rows = D.MISHAPS.filter((m) => a.p.flaws.includes(m.flaw));
      if (rows.length) list = [{ a, row: pick(rows, seed, night, 'rev-row') }];
    }
    const mishapEvents = [];
    for (const m of list) {
      const others = onstage.filter((x) => x.id !== m.a.id);
      const ot = pick(others, seed, night, b, m.row.id, 'other');
      const text = fillText(m.row.text.replaceAll('{actor}', first(m.a.p.name)).replaceAll('{other}', first(ot.p.name)), cast, { object: first(sb.props[0] || 'prop'), place: genre.sets[beatName], town: town.name });
      const ev = { id: m.row.id, actor: m.a.id, other: ot.id, kind: m.row.kind, severity: m.row.severity, title: m.row.title, text, anim: m.row.anim, tags: m.row.tags, calamity: m.row.calamity, effects: m.row.effects };
      mishapEvents.push({ ev, row: m.row, a: m.a });
      yield f.custom('stage.mishap', `${k}:mishap:${m.row.id}`, ev, m.a.id, 6);
    }
    yield f.end('perform');

    // --- decisions
    let dWarm = (Q - 55) / 6;
    let dChaos = 0;
    const tagSet = new Set(beatTags);
    for (const mi of mishapEvents) {
      dWarm += mi.row.effects.warmth;
      dChaos += mi.row.effects.chaos;
      for (const t of mi.row.tags) tagSet.add(t);
      S.calamities.push(mi.row.calamity);
    }
    const decisions = [];
    for (const mi of mishapEvents) {
      const wh = D.WHISPERS.find((w) => w.kind === mi.row.kind) || D.WHISPERS.find((w) => w.kind === 'generic');
      let choice;
      let by = 'madame';
      if (mi.row.severity === 'major') {
        by = 'prompter';
        yield f.start('prompters_box');
        const payload = {
          kind: 'prompters_box',
          beat: beatName,
          beat_index: b,
          mishap: { id: mi.row.id, title: mi.row.title, text: mi.ev.text, actor: mi.a.id, kind: mi.row.kind, severity: mi.row.severity, tags: mi.row.tags },
          options: wh.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint })),
          cues: D.CUES.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, uses_left: S.cues_left[c.id] ?? 0 })),
          free_text: true,
        };
        const resume = yield f.interrupt(payload);
        // a node containing interrupt() re-runs from its first line on resume: the earlier emit is repeated (same key)
        yield f.custom('stage.mishap', `${k}:mishap:${mi.row.id}`, mi.ev, mi.a.id, 2);
        let optionId = resume?.option && wh.options.some((o) => o.id === resume.option) ? resume.option : null;
        let personal = 0;
        if (!optionId && resume?.text) optionId = classifyWhisper(resume.text, wh.options);
        if (resume?.text && String(resume.text).trim()) personal = 2;
        if (!optionId) optionId = wh.options[0].id;
        choice = { opt: wh.options.find((o) => o.id === optionId), cue: resume?.cue && (S.cues_left[resume.cue] ?? 0) > 0 ? CUE[resume.cue] : null, text: resume?.text || null, personal };
        yield f.end('prompters_box');
      } else {
        choice = { opt: wh.options[hash(seed, night, b, mi.row.id, 'madame') % 2], cue: null, text: null, personal: 0 };
      }
      decisions.push({ mi, choice, by });
    }
    yield f.start('resolve');
    for (const { mi, choice, by } of decisions) {
      const opt = choice.opt;
      dWarm += opt.effects.warmth + choice.personal;
      dChaos += opt.effects.chaos;
      if (opt.adds_tag) tagSet.add(opt.adds_tag);
      S.decisions.push({ beat: b, mishap: mi.row.id, option: opt.id, by });
      yield f.custom('stage.decision', `${k}:decision:${mi.row.id}`, { mishap_id: mi.row.id, option: opt.id, label: opt.label, cue: choice.cue?.id || null, text: choice.text, line: opt.line, effects: { warmth: opt.effects.warmth + choice.personal, chaos: opt.effects.chaos }, by }, by === 'prompter' ? 'madame' : 'madame', 5);
      if (choice.cue) {
        const fits = choice.cue.fits.some((t) => tagSet.has(t));
        S.cues_left[choice.cue.id]--;
        S.cues_used.push(choice.cue.id);
        const eff = fits ? choice.cue.effects : choice.cue.misfire;
        dWarm += eff.warmth;
        dChaos += eff.chaos;
        yield f.custom('stage.cue', `${k}:cue:${choice.cue.id}`, { cue: choice.cue.id, fits, outcome: fits ? 'miracle' : 'misfire', text: fits ? `${choice.cue.label}: exactly right.` : choice.cue.misfire_text, anim: choice.cue.anim }, 'clipboard', 5);
      }
      if (opt.chain) {
        const helpers = onstage.filter((x) => x.id !== mi.a.id && chance(x.p.skills.improv / 100 + 0.2, seed, night, b, x.id, 'chain'));
        if (helpers.length) {
          const bonus = 1.5 * helpers.length;
          dWarm += bonus;
          S.yes_and += helpers.length;
          yield f.custom('stage.chain', `${k}:chain`, { actors: helpers.map((x) => x.id), lines: helpers.map((x) => pick(x.p.voice.catchphrases, seed, x.id)), bonus }, helpers[0].id, 6);
        }
      }
      if (trad.includes(mi.row.calamity) && opt.id === 'lean_in') {
        dWarm += 6;
        S.tradition_hits++;
      }
      if (mi.row.calamity === town.temperament.expects && !S.expected_paid) {
        dWarm += 8;
        S.expected_paid = true;
      }
    }
    yield f.end('resolve');

    // --- audience (Send x12)
    yield f.start('audience');
    const counts = { laugh: 0, gasp: 0, cry: 0, boo: 0, yawn: 0, applaud: 0 };
    let aud = 0;
    for (let i = 0; i < 12; i++) {
      const t = seats[i];
      let s = 0;
      let why = 'the show';
      for (const tag of tagSet) {
        if (t.likes.includes(tag)) {
          s += 1;
          why = `likes ${tag.replace(/_/g, ' ')}`;
        }
        if (t.hates.includes(tag)) {
          s -= 1.4;
          why = `hates ${tag.replace(/_/g, ' ')}`;
        }
        if (town.temperament.hates.includes(tag)) s -= 0.2;
      }
      let reaction;
      const r = roll(seed, night, b, i, 'react');
      if (mishapEvents.length && r < t.laugh * 0.8 && s > -1.2) {
        reaction = 'laugh';
        why = mishapEvents[0].row.title.toLowerCase();
      } else if (mishapEvents.length && r < 0.75) reaction = s < -1 ? 'boo' : 'gasp';
      else if (s <= -1.2) reaction = r < t.boo + 0.35 ? 'boo' : 'yawn';
      else if (s >= 1) reaction = r < t.cry && b >= 3 ? 'cry' : r < 0.55 ? 'applaud' : 'laugh';
      else reaction = r < 0.35 ? 'yawn' : r < 0.6 ? 'laugh' : r < 0.8 ? 'applaud' : 'gasp';
      counts[reaction]++;
      aud += { laugh: 1, applaud: 1, cry: 0.8, gasp: 0.5, yawn: -0.4, boo: -1 }[reaction];
      yield f.custom('audience.react', `${k}:react:${i}`, { seat: i, reaction, intensity: round1(0.4 + roll(seed, night, b, i, 'int') * 0.6), why }, null, 2);
    }
    yield f.end('audience');
    const audDelta = round1(((aud - 12 * 0.25) / 12) * 9);
    yield f.start('tally');
    yield f.custom('audience.tally', `${k}:tally`, { beat: b, delta: audDelta, counts }, null, 4);
    S.warmth = clamp(Math.round(S.warmth + dWarm * 0.5 + audDelta * 0.7), 0, 100);
    S.chaos = clamp(Math.round(S.chaos + dChaos - 3), 0, 100);
    S.beats.push({ beat: beatName, warmth: S.warmth, chaos: S.chaos });
    yield f.custom('meter', `${k}:meter`, { warmth: S.warmth, chaos: S.chaos, beat: b }, null, 4);
    yield f.end('tally');
    S.mishaps.push(...mishapEvents.map((m) => ({ beat: b, id: m.row.id, title: m.row.title, actor: m.a.id, calamity: m.row.calamity, decision: decisions.find((d) => d.mi === m)?.choice.opt.id || null })));
    f.leave();
    yield f.start('next_beat');
    yield f.values(stateValues(), 3);
    yield f.end('next_beat');
  }

  yield f.start('curtain_call');
  const avg = Math.round(S.quality.reduce((a, x) => a + x, 0) / S.quality.length);
  yield f.custom('stage.curtain', `n${night}:curtain`, { warmth: S.warmth, chaos: S.chaos, quality_avg: avg, tradition_hits: S.tradition_hits, knotted: S.chaos >= 60 }, 'narrator', 8);
  yield f.end('curtain_call');
  const leadQ = S.quality.length ? Math.round(S.quality.reduce((a, x) => a + x, 0) / S.quality.length + (P[cast.lead].skills.drama - 50) / 10) : 0;
  const result = { warmth: S.warmth, chaos: S.chaos, quality_avg: avg, quality_lead: clamp(leadQ, 0, 100), quality: S.quality, mishaps: S.mishaps, calamities: [...new Set(S.calamities)], tradition_hits: S.tradition_hits, yes_and: S.yes_and, cues_used: S.cues_used, beats: S.beats };
  yield f.values({ ...stateValues(), result });
}

function TASTES_POOL(id) {
  return TASTE[id] || D.TASTES[0];
}

// ---------------------------------------------------------------------------------------------------------------
// reviews

function* reviews(env) {
  const { input, tour, f } = env;
  const { result, cast, script } = input;
  const town = TOWN[input.town] || D.TOWNS[0];
  yield f.values({ ...input });
  yield f.start('gather');
  yield f.progress('The pigeons arrive in a flurry', 0.1);
  yield f.end('gather');
  yield f.start('critics');
  const topMishap = (result.mishaps || [])[0];
  const snack = pick(['custard', 'gingernut', 'shortbread', 'jam tart', 'half a pie'], input.seed, input.night);
  const metrics = {
    quality: result.quality_avg / 100,
    lead: result.quality_lead / 100,
    warmth: result.warmth / 100,
    charm_chaos: clamp(1 - Math.abs(result.chaos - 45) / 45, 0, 1),
    tradition: clamp(result.tradition_hits / 2, 0, 1),
    snacks: script.tags.includes('feast') ? 0.85 : 0.4,
  };
  const revs = [];
  for (const c of D.CRITICS) {
    const wsum = Object.values(c.weights).reduce((a, x) => a + x, 0) || 1;
    const raw = Object.entries(c.weights).reduce((a, [k, w]) => a + w * (metrics[k] ?? 0), 0) / wsum;
    const stars = clamp(Math.round((1 + 4.3 * raw + c.bias + (roll(input.seed, input.night, c.id) - 0.5) * c.noise * 1.4) * 2) / 2, 1, 5);
    const tpl = c.templates[String(Math.min(5, Math.floor(stars)))][0];
    const quote = tpl
      .replaceAll('{show}', script.title)
      .replaceAll('{lead}', first(P[cast.lead].name))
      .replaceAll('{villain}', first(P[cast.villain].name))
      .replaceAll('{fool}', first(P[cast.fool].name))
      .replaceAll('{town}', town.name)
      .replaceAll('{mishap}', topMishap?.title || 'the lull')
      .replaceAll('{calamity}', humanize(topMishap?.calamity || 'the quiet'))
      .replaceAll('{tradition}', humanize((tour?.traditions || [])[0]?.calamity || 'the goose'))
      .replaceAll('{snack}', snack);
    const r = { critic: c.id, name: c.name, outlet: c.outlet, stars, quote };
    revs.push(r);
    yield f.custom('review.pigeon', `rev:n${input.night}:${c.id}`, r, c.id, 12);
  }
  yield f.end('critics');
  yield f.start('reduce');
  const stars = clamp(Math.round((revs.reduce((a, r) => a + r.stars, 0) / revs.length) * 2) / 2, 1, 5);
  yield f.end('reduce', { stars });
  yield f.start('headline');
  const headlines = { 5: `${script.title}: ${town.name} Has Never Been Happier`, 4: `${script.title} Delights, Mostly On Purpose`, 3: `${script.title}: A Decent Evening, All Things Considered`, 2: `${script.title}: Some Of It Happened As Intended`, 1: `${script.title}: Please Be Kind To The Goose` };
  const headline = headlines[Math.min(5, Math.floor(stars))];
  const funds_delta = Math.round((stars * result.warmth) / 25);
  yield* f.say(headline, { node: 'headline', actor: 'narrator' });
  yield f.custom('review.headline', `headline:n${input.night}`, { text: headline, stars, funds_delta }, 'narrator', 6);
  yield f.end('headline');
  yield f.start('file_review');
  if (tour) {
    tour.history = (tour.history || []).filter((h) => h.night !== input.night);
    tour.history.push({ night: input.night, town: town.id, genre: input.genre, title: script.title, stars, headline, funds_delta });
    tour.funds = Math.max(0, tour.funds + funds_delta);
    tour.status = deriveStatus(tour);
  }
  yield f.end('file_review');
  yield f.values({ stars, funds_delta, headline, reviews: revs });
}

// ---------------------------------------------------------------------------------------------------------------
// almanac

function* almanac(env) {
  const { input, tour, f } = env;
  const result = input.result || { calamities: [] };
  yield f.values({ ...input });
  yield f.start('ingest');
  const cal = (tour._cal ||= {});
  const seen = [];
  for (const c of [...new Set(result.calamities || [])]) {
    cal[c] = (cal[c] || 0) + 1;
    const legend = D.ALMANAC_SEEDS.find((s) => s.calamity === c);
    const count = cal[c] + (legend ? 1 : 0);
    const text = `${humanize(c)} in ${(TOWN[input.town] || D.TOWNS[0]).name}, night ${input.night + 1}: ${legend ? legend.text : 'a first, and therefore remarkable.'}`;
    seen.push({ calamity: c, count, text });
    yield f.custom('almanac.noted', `noted:n${input.night}:${c}`, { calamity: c, count, text }, 'narrator', 8);
    yield f.custom('memory.written', `mem:n${input.night}:${c}`, { ns: `almanac/${tour.id}`, key: `${c}:${input.night}` }, null, 3);
  }
  yield f.end('ingest');
  yield f.start('detect');
  const already = new Set((tour.traditions || []).map((t) => t.calamity));
  const candidates = seen.filter((s) => s.count >= 2 && !already.has(s.calamity)).map((s) => ({ calamity: s.calamity, title: humanize(s.calamity), count: s.count, text: s.text }));
  for (const c of candidates) yield f.custom('almanac.candidate', `cand:n${input.night}:${c.calamity}`, c, 'narrator', 6);
  yield f.end('detect', { candidates: candidates.length });
  let enshrined = [];
  if (candidates.length) {
    yield f.start('curate');
    const resume = yield f.interrupt({ kind: 'curate_traditions', candidates, max: 2 });
    const want = (resume?.enshrine || []).filter((c) => candidates.some((x) => x.calamity === c)).slice(0, 2);
    enshrined = candidates.filter((c) => want.includes(c.calamity));
    yield f.end('curate');
    yield f.start('enshrine');
    for (const t of enshrined) {
      yield f.custom('almanac.tradition', `trad:n${input.night}:${t.calamity}`, { calamity: t.calamity, title: t.title }, 'narrator', 10);
      tour.traditions.push({ calamity: t.calamity, title: t.title, count: t.count });
      tour.encore += 1;
    }
    yield f.end('enshrine');
  }
  yield f.start('recall');
  const next = TOWN[input.next_town];
  const recalled = [];
  if (next) {
    const pool = D.ALMANAC_SEEDS.filter((s) => s.town === next.id);
    const extra = [...D.ALMANAC_SEEDS].sort((a, b) => hash(a.id, next.id) - hash(b.id, next.id)).slice(0, 2);
    for (const s of [...pool, ...extra].slice(0, 3)) {
      const r = { text: s.text, calamity: s.calamity, town: s.town, score: round1(0.5 + roll(s.id, next.id) * 0.45) };
      recalled.push(r);
      yield f.custom('memory.recalled', `recall:n${input.night}:${s.id}`, r, 'narrator', 10);
    }
  }
  yield f.end('recall');
  yield f.values({ traditions: tour.traditions.map((t) => ({ calamity: t.calamity, title: t.title, count: t.count })), recalled });
}

// ---------------------------------------------------------------------------------------------------------------
// the_road

function* theRoad(env) {
  const { input, tour, f } = env;
  const to = TOWN[input.to_town];
  const from = TOWN[input.from_town];
  yield f.values({ ...input });
  yield f.start('depart');
  yield f.custom('road.step', `road:n${input.night}:0`, { pct: 0.05, label: `The wagon leaves ${from?.name || 'town'}` }, 'clipboard', 40);
  yield f.end('depart');
  yield f.start('weather');
  const weather = pick(['a brisk wind', 'a smug drizzle', 'fog with opinions', 'sun, surprisingly'], input.seed, input.night, 'wx');
  yield f.custom('road.step', `road:n${input.night}:1`, { pct: 0.3, label: `The wagon trundles through ${weather}` }, 'narrator', 40);
  yield f.end('weather');
  yield f.start('roll_event');
  const ev = pick(D.ROAD_EVENTS, input.seed, input.night, 'road');
  yield f.custom('road.event', `roadev:n${input.night}:${ev.id}`, { id: ev.id, title: ev.title, text: ev.text, choices: ev.choices.map((c) => ({ id: c.id, label: c.label })) }, 'narrator', 40);
  yield f.end('roll_event');
  yield f.start('crossroads');
  const resume = yield f.interrupt({ kind: 'crossroads', event: { id: ev.id, title: ev.title, text: ev.text }, choices: ev.choices.map((c) => ({ id: c.id, label: c.label })) });
  const choice = ev.choices.find((c) => c.id === resume?.choice) || ev.choices[0];
  yield f.end('crossroads');
  yield f.start('apply');
  if (input.crash && !tour._crashed) {
    tour._crashed = true;
    yield f.custom('road.crash', `crash:n${input.night}`, { node: 'apply', recovered: false }, null, 60);
    yield f.custom('road.crash', `crash:n${input.night}:r`, { node: 'apply', recovered: true }, null, 120);
  }
  const eff = choice.effects || {};
  tour.funds = Math.max(0, tour.funds + (eff.funds || 0));
  tour.encore += eff.encore || 0;
  tour.candles += eff.candles || 0;
  for (const [id, v] of Object.entries(eff.rapport || {})) tour.rapport[id] = (tour.rapport[id] || 0) + v;
  yield f.custom('road.step', `road:n${input.night}:2`, { pct: 0.8, label: choice.label }, 'clipboard', 40);
  yield f.end('apply');
  yield f.start('arrive');
  if (to) {
    tour.night = Math.min(4, input.night + 1);
    tour.wagon = { at: to.id };
    tour.candles += 1;
  }
  yield f.custom('road.arrive', `arrive:n${input.night}`, { town: to?.id || null }, 'narrator', 40);
  yield f.end('arrive');
  yield f.values({ event: { id: ev.id, title: ev.title }, choice: choice.id, effects: eff, arrived: to?.id || null });
}

// ---------------------------------------------------------------------------------------------------------------
// playbill_press (Functional API)

function* playbillPress(env) {
  const { input, tour, thread, f } = env;
  const cast = input.cast;
  const town = TOWN[input.town] || D.TOWNS[0];
  yield f.values({ ...input });
  yield f.start('bios');
  const cb = D.PLAYBILL.bio;
  const bios = ROLES.map((r) => {
    const p = P[cast[r]];
    return { id: p.id, name: p.name, role: r, bio: `${p.name}, ${pick(cb.openers, p.id, input.night)} ${pick(cb.trained_at, p.id, input.seed)}. ${pick(cb.credits, p.id)} ${pick(cb.quirks, p.id, input.night)}` };
  });
  yield f.custom('playbill.section', `pb:n${input.night}:bios`, { name: 'bios', text: `${bios.length} biographies, lightly exaggerated` }, null, 20);
  yield f.end('bios');
  yield f.start('traditions_page');
  const traditions = (input.traditions || []).map((t) => t.title || humanize(t.calamity));
  yield f.custom('playbill.section', `pb:n${input.night}:traditions`, { name: 'traditions', text: traditions.length ? `Traditions of the house: ${traditions.join(', ')}.` : 'No Traditions yet. They are being considered.' }, null, 20);
  yield f.end('traditions_page');
  yield f.start('review_wall');
  yield f.custom('playbill.section', `pb:n${input.night}:wall`, { name: 'review_wall', text: input.headline || 'Reviews pending' }, null, 20);
  yield f.end('review_wall');
  yield f.start('layout');
  thread.previously = thread.previously || [];
  const playbill = {
    title: input.script?.title || 'Untitled',
    town: town.id,
    night: input.night,
    genre: input.genre,
    cast: bios,
    tonight: [`${town.name}, night ${input.night + 1}.`, input.script?.tagline || ''],
    traditions,
    quote: input.headline || '',
    back_page: pick(D.PLAYBILL.back_page, input.seed, input.night),
    previously: [...thread.previously],
  };
  thread.previously.push(`${input.script?.title || 'A play'} at ${town.name}: ${input.stars ?? '?'} stars.`);
  yield f.custom('playbill.section', `pb:n${input.night}:layout`, { name: 'layout', text: 'Printed on paper of dubious provenance' }, null, 20);
  yield f.end('layout');
  void tour;
  yield f.values({ playbill });
}

// ---------------------------------------------------------------------------------------------------------------
// rehearsal

function* rehearsal(env) {
  const { input, f } = env;
  const genre = GEN[input.genre] || D.GENRES[0];
  const cast = input.cast;
  const n = input.samples || 12;
  yield f.values({ ...input });
  yield f.start('plan');
  yield f.progress('Chalking the marks', 0.1);
  yield f.end('plan');
  yield f.start('simulate');
  const base = ROLES.reduce((a, r) => a + roleScore(P[cast[r]], r, genre, 'rehearsal'), 0) / 3;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const stars = clamp(Math.round((base / 22 + (roll(input.seed, input.night, 'rh', i) - 0.5) * 3) * 2) / 2, 1, 5);
    const warmth = clamp(Math.round(30 + stars * 11 + (roll(input.seed, 'w', i) - 0.5) * 14), 5, 98);
    const chaos = clamp(Math.round(20 + (5 - stars) * 7 + roll(input.seed, 'c', i) * 20), 5, 95);
    const flaw = D.FLAWS.find((x) => x.id === pick(ROLES.map((r) => pick(P[cast[r]].flaws, i, r)), input.seed, 'tm', i));
    const top = D.MISHAPS.find((m) => m.flaw === flaw?.id) || D.MISHAPS[0];
    samples.push({ i, stars, warmth, chaos, top_mishap: top.title });
    yield f.custom('rehearsal.sample', `rh:${i}`, { i, stars, warmth, chaos, top_mishap: top.title }, null, 60);
  }
  yield f.end('simulate');
  yield f.start('summarize');
  const histogram = [1, 2, 3, 4, 5].map((s) => samples.filter((x) => Math.round(x.stars) === s).length);
  const mean = round1(samples.reduce((a, x) => a + x.stars, 0) / samples.length);
  const freq = {};
  for (const s of samples) freq[s.top_mishap] = (freq[s.top_mishap] || 0) + 1;
  const risk = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, c]) => ({ title, freq: round1(c / samples.length) }));
  const verdict = mean >= 3.8 ? 'A triumph, if the goose behaves.' : mean >= 2.8 ? 'Respectable, in a damp sort of way.' : 'A tragedy. Probably. Possibly on purpose.';
  const summary = { histogram, mean, risk, verdict };
  yield f.custom('rehearsal.summary', 'rh:summary', summary, 'madame', 10);
  yield f.end('summarize');
  yield f.values({ summary });
}

// ---------------------------------------------------------------------------------------------------------------
// greenroom_chat

function* greenroom(env) {
  const { input, tour, f, thread } = env;
  const actorId = input.actor_id || input.context?.actor_id || 'mabel';
  const p = P[actorId] || P.mabel;
  const msgs = (input.messages || []).map((m) => ({ type: m.type || (m.role === 'user' || m.role === 'human' ? 'human' : m.role === 'assistant' ? 'ai' : m.role || 'human'), content: m.content, id: m.id || `m-${hash(m.content)}` }));
  thread.chat = thread.chat || [];
  const history = [...thread.chat, ...msgs];
  const last = String(msgs.filter((m) => m.type === 'human').pop()?.content || '').toLowerCase();
  yield f.values({ messages: history, actor_id: actorId });
  yield f.start('model');
  let reply;
  let tool = null;
  if (/calm|nerv|worr|scared|fright|anxious/.test(last)) {
    tool = { name: 'calm_nerves', args: {} };
    reply = `${first(p.name)} takes a long breath. "${p.voice.catchphrases[0]}" It helps, a little.`;
  } else if (/prop|fetch|get me|bring|teapot|sword|hat|goose/.test(last)) {
    const m = last.match(/(?:fetch|bring|get me|get)\s+(?:me\s+)?(?:a|an|the|some)?\s*([a-z ]{3,24})/);
    tool = { name: 'fetch_prop', args: { prop: (m?.[1] || 'a teapot').trim() } };
    reply = `${first(p.name)} raises an eyebrow. "A prop? I shall ask Mrs. Gasket, who has eight hands and no clue."`;
  } else if (/gossip|rumou?r|heard|legend|story|town/.test(last)) {
    const s = pick(D.ALMANAC_SEEDS, last, input.seed || 0);
    tool = { name: 'recall_gossip', args: { query: last.slice(0, 40) } };
    reply = `${first(p.name)} leans in. "${s.text}"`;
  } else {
    reply = pick([`"${p.voice.catchphrases[0]}" says ${first(p.name)}, and then forgets the question.`, `${first(p.name)} considers this, ${p.voice.tics[0] || 'sighing'}. "Ask me again after the interval."`, `"${p.blurb}" ${first(p.name)} adds, helpfully.`], last, actorId);
  }
  yield* f.say(reply, { node: 'model', actor: actorId });
  yield f.end('model');
  const out = [...history, { type: 'ai', content: reply, id: `ai-${hash(reply)}`, name: actorId }];
  if (tool) {
    yield f.start('tools');
    if (tool.name === 'fetch_prop') {
      const resume = yield f.interrupt({ action_requests: [{ name: 'fetch_prop', args: tool.args, description: `Fetch "${tool.args.prop}" (costs 1 fund)` }], review_configs: [{ action_name: 'fetch_prop', allowed_decisions: ['approve', 'edit', 'reject'] }] });
      const d = resume?.decisions?.[0] || { type: 'approve' };
      const status = d.type === 'reject' ? 'rejected' : 'fetched';
      if (status === 'fetched' && tour) tour.funds = Math.max(0, tour.funds - 1);
      yield f.custom('greenroom.tool', `gr:${hash(last)}:fetch`, { tool: 'fetch_prop', args: d.type === 'edit' && d.edited_action?.args ? d.edited_action.args : tool.args, status }, actorId, 10);
    } else if (tool.name === 'calm_nerves') {
      if (tour) tour.rapport[actorId] = (tour.rapport[actorId] || 0) + 1;
      yield f.custom('greenroom.tool', `gr:${hash(last)}:calm`, { tool: 'calm_nerves', args: {}, status: 'done' }, actorId, 10);
      yield f.custom('greenroom.rapport', `gr:${hash(last)}:rapport`, { actor: actorId, rapport: tour?.rapport?.[actorId] ?? 1 }, actorId, 10);
    } else yield f.custom('greenroom.tool', `gr:${hash(last)}:gossip`, { tool: 'recall_gossip', args: tool.args, status: 'done' }, actorId, 10);
    yield f.end('tools');
  }
  thread.chat = out;
  yield f.values({ messages: out });
}

export const GENERATORS = {
  casting_call: castingCall,
  writers_room: writersRoom,
  performance,
  reviews,
  almanac,
  the_road: theRoad,
  playbill_press: playbillPress,
  greenroom_chat: greenroom,
  rehearsal,
};
