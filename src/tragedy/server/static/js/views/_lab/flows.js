// Canned graph runs for views-lab.html. Each flow is a generator that yields {event}, {token}, or {interrupt} and receives
// the resume value back from `yield {interrupt}`. Shapes follow docs/PROTOCOL.md sections 2 and 4. NOT the real engine.
import { performers, staff, genres, towns, critics, SAMPLE_SCRIPT } from './fixtures.js';
import { bestCast, ROLES, hash, humanize } from '../_kit/pure.js';

const ev = (kind, key, data, agent = null) => ({ v: 1, kind, key, agent, data });
const E = (kind, key, data, agent) => ({ event: ev(kind, key, data, agent) });
const T = (text, node = 'voice', actor = null) => ({ token: { node, text, actor } });
const I = (payload) => ({ interrupt: payload });

const byId = Object.fromEntries(performers.map((p) => [p.id, p]));
const SKILL_FOR = { lead: ['drama', 'romance'], villain: ['menace', 'drama'], fool: ['comedy', 'physical'] };

/** Deterministic audition score 0-100, in the spirit of the engine's quality formula. */
export function auditionScore(p, role, seed = 7) {
  const sk = SKILL_FOR[role].reduce((a, s) => a + p.skills[s], 0) / SKILL_FOR[role].length;
  const fit = p.roles.includes(role) ? 100 : p.roles.length === 0 ? 75 : 60;
  const wob = (hash(`${seed}:${p.id}:${role}`) % 13) - 6;
  return Math.max(5, Math.min(99, Math.round(0.5 * sk + 0.3 * fit + 0.2 * (100 - p.stage_fright) + wob)));
}

const AUDITION_LINES = {
  lead: ['I am only here to return this umbrella!', 'My heart! It leans! Towards you!', 'Unhand me, sir, I am mid-soliloquy.', 'Is that a letter? It is always a letter.'],
  villain: ['Nobody returns an umbrella. Who sent you?', 'I shall ruin you. Pardon me. I shall ruin you, sorry.', 'The will! Where is the will?', 'You have walked into my web. Mind the rug.'],
  fool: ['I am also, I think, the umbrella.', 'Is it a door? It is a door. I love it.', 'Honk. I mean, good evening.', 'I only know the second act. It begins here.'],
};

export const FLOWS = {
  /* -------------------------------------------------------------------------------------------- casting_call */
  *casting_call(input) {
    const seed = input.seed ?? 7;
    const scores = { lead: {}, villain: {}, fool: {} };
    const order = [];
    for (const role of ROLES) for (const p of performers) order.push([role, p]);
    // interleave so the audition floor feels shuffled
    order.sort((a, b) => (hash(`${seed}${a[0]}${a[1].id}`) % 97) - (hash(`${seed}${b[0]}${b[1].id}`) % 97));
    let n = 0;
    for (const [role, p] of order) {
      const score = auditionScore(p, role, seed);
      scores[role][p.id] = score;
      const lines = AUDITION_LINES[role];
      yield E('cast.audition', `aud:${n++}`, { role, actor: p.id, score, line: lines[hash(p.id + role) % lines.length] }, p.id);
    }
    const best = bestCast(scores);
    const note = 'Darling. I have seen the auditions and I have lived. Mabel for the heroine, because someone must; the rest I cast with my eyes closed, which is also how they audition.';
    for (const w of note.split(' ')) yield T(w + ' ', 'recommend', 'madame');
    yield E('cast.recommend', 'rec', { cast: best.cast, note, scores }, 'madame');
    const resume = yield I({ kind: 'confirm_cast', proposed: best.cast, scores, note, genre: input.genre });
    return { cast: resume?.cast ?? best.cast };
  },

  /* -------------------------------------------------------------------------------------------- writers_room */
  *writers_room(input, world) {
    const genre = input.genre || 'farce';
    const TITLES = {
      quill_pompous: ['The Tragedy of the Umbrella, in Five Magnificent and Unnecessary Acts', 'A magnificent thing, performed in a damp room'],
      quill_frantic: ['Doors! Doors! (A Wrong Man)', 'There are four plots and none of them are finished'],
      quill_tender: ['What the Rain Said to the Umbrella', 'A small, sad comedy about leaving the house'],
    };
    const BEAT_LOG = {
      quill_pompous: ['Everyone arrives, for reasons of immense gravitas.', 'A will is read. Two are produced.', 'The butler is not the butler.', 'The chandelier makes a speech.', 'Reconciliation, at length.'],
      quill_frantic: ['Everyone arrives at the same house at once!', 'Wrong door. Wrong man. Wrong play!', 'Nobody is who they said, including me', 'The cellar has a cellar', 'It all ends. Probably.'],
      quill_tender: ['A grey morning, and one umbrella.', 'It rains inside as well.', 'A letter, long unopened, is opened.', 'The goose forgives everyone.', 'They share the umbrella. It is enough.'],
    };
    const TAGS = [['door', 'mistaken_identity'], ['chase', 'slapstick'], ['letter', 'secret'], ['chandelier', 'song'], ['feast', 'reunion']];
    const faith = { quill_pompous: 1.5, quill_frantic: 2, quill_tender: 3 };
    const beats = ['setup', 'complication', 'reversal', 'twist', 'finale'];
    const mk = (quill, id) => ({
      draft_id: id, quill, title: TITLES[quill][0], tagline: TITLES[quill][1],
      beats: beats.map((b, i) => ({ beat: b, logline: BEAT_LOG[quill][i], tags: TAGS[(i + hash(quill)) % 5].slice(0, 2 + (i % 2)) })),
      confidence: faith[quill],
    });
    const drafts = [];
    let n = 0;
    for (const q of ['quill_pompous', 'quill_frantic', 'quill_tender']) {
      for (const w of TITLES[q][0].split(' ').slice(0, 5)) yield T(w + ' ', q, q);
      const d = mk(q, `draft-${n++}`);
      drafts.push(d);
      if (q === 'quill_pompous' && world.revise) {
        // Madame sends the first draft back; the pompous quill rewrites it
        yield E('script.draft', 'draft:0', d, q);
        yield E('note', 'note:revise', { text: 'Madame sends a draft back: "Too many adjectives, darling."' }, 'madame');
        const d2 = { ...mk(q, `draft-${n++}`), title: 'The Umbrella: A Tragedy (Shorter)', confidence: 2.5 };
        drafts[0] = d2;
        yield E('script.draft', 'draft:0b', d2, q);
      } else {
        yield E('script.draft', `draft:${d.draft_id}`, d, q);
      }
    }
    const resume = yield I({ kind: 'pick_draft', drafts });
    const chosen = drafts.find((d) => d.draft_id === resume?.draft_id) || drafts[0];
    yield E('script.chosen', 'chosen', { draft_id: chosen.draft_id }, 'madame');
    const script = { ...SAMPLE_SCRIPT, title: chosen.title, tagline: chosen.tagline, quill: chosen.quill, genre, beats: chosen.beats.map((b) => ({ ...SAMPLE_SCRIPT.beats[0], ...b, variant: `${genre}_${b.beat}_1`, lines: [], props: [], slots: {} })), tags: [...new Set(chosen.beats.flatMap((b) => b.tags))] };
    return { script };
  },

  /* -------------------------------------------------------------------------------------------- rehearsal */
  *rehearsal(input) {
    const n = input.samples ?? 12;
    const seed = input.seed ?? 7;
    const MISHAPS = ['Mabel leans too far left', 'The goose eats the prop', 'Reginald apologises mid-murder', 'The chandelier is feared', 'Gus freezes entirely'];
    const stars = [];
    for (let i = 0; i < n; i++) {
      const base = 2.5 + ((hash(`${seed}:rh:${i}`) % 100) / 100) * 2.4 - (i % 5 === 3 ? 1.2 : 0.2);
      const s = Math.max(1, Math.min(5, Math.round(base * 2) / 2));
      stars.push(s);
      yield E('rehearsal.sample', `rh:${i}`, { i, stars: s, warmth: 40 + (i * 7) % 40, chaos: 20 + (i * 11) % 50, top_mishap: MISHAPS[i % MISHAPS.length] });
    }
    const hist = [0, 0, 0, 0, 0];
    stars.forEach((s) => { hist[Math.max(1, Math.min(5, Math.round(s))) - 1]++; });
    const mean = Math.round((stars.reduce((a, b) => a + b, 0) / n) * 100) / 100;
    yield E('rehearsal.summary', 'rh:sum', {
      histogram: hist, mean,
      risk: [{ title: 'Mabel leans too far left', freq: 0.58 }, { title: 'The goose eats the prop', freq: 0.42 }, { title: 'Reginald apologises mid-murder', freq: 0.25 }, { title: 'Gus freezes entirely', freq: 0.08 }],
      verdict: 'Darling, it is a show. There will be incidents. Bring a bucket.',
    }, 'madame');
    return { summary: { mean } };
  },

  /* -------------------------------------------------------------------------------------------- reviews */
  *reviews(input) {
    const stars = { pompous: 3, wounded_parent: 4.5, snacks: 3.5, chaos_gourmand: 5, sentimentalist: 4 };
    const QUOTES = {
      pompous: 'Technically a play. The lean, however, was in no sense a choice.',
      wounded_parent: 'My Mabel was RADIANT, whatever they say about the left side.',
      snacks: 'Two stars for the plot, three for the pie. The goose ate the second pie.',
      chaos_gourmand: 'A glorious pile-up! I have not been so alarmed since 1987. Marvellous.',
      sentimentalist: 'They wept. I wept. The umbrella, one felt, wept also.',
    };
    for (const c of critics) {
      yield E('review.pigeon', `pg:${c.id}`, { critic: c.id, name: c.name, outlet: c.outlet, stars: stars[c.id], quote: QUOTES[c.id] }, c.id);
    }
    const total = Math.round((Object.values(stars).reduce((a, b) => a + b, 0) / 5) * 2) / 2;
    const text = 'GOOSE EATS PROP, CRITICS EAT THEIR WORDS: "A glorious tragedy of the angle"';
    for (const w of text.split(' ')) yield T(w + ' ', 'headline', 'narrator');
    yield E('review.headline', 'hl', { text, stars: total, funds_delta: Math.round((total * 61) / 25) }, 'narrator');
    return { stars: total, funds_delta: Math.round((total * 61) / 25), headline: text, reviews: [] };
  },

  /* -------------------------------------------------------------------------------------------- almanac */
  *almanac(input) {
    const cal = [['the_lean', 2, 'Mabel leaned again. The Almanac leans with her.'], ['the_chair', 1, 'A chair fell in Marshwick, on schedule.'], ['the_goose_incident', 3, 'The goose, again, was involved.'], ['the_chandelier', 2, 'Tock looked up and froze.']];
    const seen = input.result?.calamities?.length ? input.result.calamities : cal.map((c) => c[0]);
    const list = cal.filter((c) => seen.includes(c[0]));
    for (const [calamity, count, text] of list) yield E('almanac.noted', `noted:${calamity}`, { calamity, count, text });
    const cands = list.filter((c) => c[1] >= 2).map(([calamity, count, text]) => ({ calamity, title: humanize(calamity), count, text }));
    for (const c of cands) yield E('almanac.candidate', `cand:${c.calamity}`, c);
    let enshrined = [];
    if (cands.length) {
      const r = yield I({ kind: 'curate_traditions', candidates: cands, max: 2 });
      enshrined = (r?.enshrine || []).slice(0, 2);
      for (const c of enshrined) yield E('almanac.tradition', `trad:${c}`, { calamity: c, title: humanize(c) });
    }
    const nt = towns.find((t) => t.id === input.next_town) || towns[2];
    const recalled = [
      { text: `In ${nt.name}, a goose has been banned from the box office since 1904.`, calamity: 'the_goose_incident', town: nt.id, score: 0.82 },
      { text: `${nt.name} still talks about the night the chandelier made a speech.`, calamity: 'the_chandelier', town: nt.id, score: 0.64 },
      { text: `A chair falls at every performance in ${nt.name}. It is the Mayor's chair.`, calamity: 'the_chair', town: nt.id, score: 0.41 },
    ];
    for (const [i, r] of recalled.entries()) yield E('memory.recalled', `rec:${i}`, r);
    return { traditions: enshrined.map((c) => ({ calamity: c, title: humanize(c), count: (cands.find((x) => x.calamity === c) || {}).count || 2 })), recalled };
  },

  /* -------------------------------------------------------------------------------------------- playbill_press */
  *playbill_press(input) {
    for (const name of ['bios', 'traditions_page', 'review_wall', 'layout']) yield E('playbill.section', `sec:${name}`, { name });
    const cast = ROLES.map((role) => {
      const p = byId[input.cast?.[role]] || performers[0];
      return { id: p.id, name: p.name, role, bio: `${p.name}, trained at the Royal Academy of Looking Out Windows. Credits include a chair (uncredited) and the 1987 Wibbling Pantomime, in which a goose was involved. ${p.flaws[0] ? humanize(p.flaws[0]) + '.' : ''}` };
    });
    return {
      playbill: {
        title: input.script?.title || 'The Umbrella Who Loved Me', town: input.town, night: input.night ?? 0, genre: input.genre, cast,
        tonight: ['Tonight in Marshwick-on-Mire: umbrellas will be returned, mostly to the wrong people.'],
        traditions: (input.traditions || []).map((t) => t.title || humanize(t.calamity || t)),
        quote: input.headline || 'A glorious tragedy of the angle', stars: input.stars ?? 3.5,
        back_page: ['Please do not feed the goose. The goose has been fed.', 'Exits are marked. Some of them are even exits.', 'Programmes may be eaten in an emergency.'],
        previously: ['Night 1: a swan was cast as the vicar.', 'Night 2: the chair fell, on cue, to applause.'].slice(0, Math.max(0, input.night ?? 0)),
      },
    };
  },

  /* -------------------------------------------------------------------------------------------- the_road */
  *the_road(input, world, thread) {
    const from = towns.find((t) => t.id === input.from_town) || towns[0];
    const to = towns.find((t) => t.id === input.to_town) || towns[1];
    if (input.__resume) {
      yield E('road.crash', 'crash:2', { node: 'apply', recovered: true });
      yield E('road.step', 'step:resume', { pct: 85, label: 'Back on the road, wagon patched with string' });
      yield E('road.arrive', 'arrive', { town: to.id });
      return { event: thread.event, choice: thread.choice, effects: thread.effects, arrived: to.id };
    }
    yield E('road.step', 'step:0', { pct: 8, label: `Leaving ${from.name}` });
    yield E('road.step', 'step:1', { pct: 30, label: 'Weather: drizzle, with opinions' });
    const evt = world.roadEvents[0];
    yield E('road.event', 'evt', { id: evt.id, title: evt.title, text: evt.text, choices: evt.choices });
    const r = yield I({ kind: 'crossroads', event: { id: evt.id, title: evt.title, text: evt.text }, choices: evt.choices.map((c) => ({ id: c.id, label: c.label })) });
    const choice = evt.choices.find((c) => c.id === r?.choice) || evt.choices[0];
    thread.event = { id: evt.id, title: evt.title };
    thread.choice = choice.id;
    thread.effects = choice.effects;
    yield E('road.step', 'step:2', { pct: 62, label: 'Over the bridge, arguing' });
    if (input.crash) {
      yield E('road.crash', 'crash:1', { node: 'apply', recovered: false });
      const err = new Error('apply: the axle gave up (simulated crash)');
      err.crash = true;
      throw err;
    }
    yield E('road.step', 'step:3', { pct: 90, label: `Nearly in ${to.name}` });
    yield E('road.arrive', 'arrive', { town: to.id });
    return { event: thread.event, choice: choice.id, effects: choice.effects, arrived: to.id };
  },

  /* -------------------------------------------------------------------------------------------- greenroom_chat */
  *greenroom_chat(input, world) {
    const msgs = input.messages || [];
    const last = String(msgs[msgs.length - 1]?.content ?? '').toLowerCase();
    const actor = byId[input.actor_id] || performers[0];
    const say = function* (text) { for (const w of text.split(/(?<= )/)) yield T(w, 'agent', actor.id); };
    if (/prop|need/.test(last)) {
      yield* say(`Oh, would you? I would kill for a rubber umbrella. Not literally. I am a gentle ${actor.kind}. `);
      const args = { prop: 'rubber umbrella', cost: 2 };
      yield E('greenroom.tool', 'tool:1', { tool: 'fetch_prop', args, status: 'pending' });
      const r = yield I({ action_requests: [{ name: 'fetch_prop', args, description: 'Mrs. Gasket fetches a prop (costs funds).' }], review_configs: [{ action_name: 'fetch_prop', allowed_decisions: ['approve', 'edit', 'reject'] }] });
      const d = r?.decisions?.[0] || { type: 'approve' };
      const status = d.type === 'reject' ? 'rejected' : d.type === 'edit' ? 'edited' : 'approved';
      yield E('greenroom.tool', 'tool:2', { tool: 'fetch_prop', args: d.edited_action?.args || args, status });
      if (d.type === 'reject') yield* say('No? Fine. I shall emote at an umbrella-shaped absence.');
      else yield* say(`Mrs. Gasket returns with ${(d.edited_action?.args?.prop) || args.prop}, and also eleven spoons. It is perfect. `);
      return { messages: [] };
    }
    if (/calm|nerve/.test(last)) {
      yield* say(`Breathing... in... and out. ${actor.name.split(' ')[0]} is calm. ${actor.name.split(' ')[0]} is a pond. A pond with a stage fright of ${actor.stage_fright}. `);
      yield E('greenroom.tool', 'tool:c', { tool: 'calm_nerves', args: {}, status: 'done' });
      yield E('greenroom.rapport', 'rap:1', { actor: actor.id, rapport: Math.min(5, (world.rapport[actor.id] || 0) + 1) });
      world.rapport[actor.id] = Math.min(5, (world.rapport[actor.id] || 0) + 1);
      return { messages: [] };
    }
    if (/gossip/.test(last)) {
      yield* say('Between us? The Mayor of Marshwick is a pie. Have I said too much? I have said exactly enough. ');
      yield E('greenroom.rapport', 'rap:g', { actor: actor.id, rapport: (world.rapport[actor.id] || 0) + 0.5 });
      world.rapport[actor.id] = (world.rapport[actor.id] || 0) + 0.5;
      return { messages: [] };
    }
    yield* say(`${actor.name.split(' ')[0]} considers this. "${actor.blurb}" That is all I can tell you, darling. `);
    return { messages: [] };
  },
};
