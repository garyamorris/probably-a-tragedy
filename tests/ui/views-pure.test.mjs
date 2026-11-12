import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../src/tragedy/server/static/js/views/_kit/pure.js';

const IDS = ['mabel', 'reginald', 'gus', 'goose', 'hortensia', 'bartleby', 'poppet', 'tock'];

/* ---------------------------------------------------------------- casting */

test('validateCast: distinct, complete casts pass', () => {
  const v = P.validateCast({ lead: 'mabel', villain: 'reginald', fool: 'gus' }, IDS);
  assert.equal(v.ok, true);
  assert.deepEqual(v.errors, []);
});

test('validateCast: names missing roles, duplicates and strangers', () => {
  const v = P.validateCast({ lead: 'mabel', villain: 'mabel', fool: null }, IDS);
  assert.equal(v.ok, false);
  assert.deepEqual(v.missing, ['fool']);
  assert.deepEqual(v.dupes, ['mabel']);
  assert.ok(v.errors.some((e) => e.role === 'villain' && e.code === 'duplicate'));
  const s = P.validateCast({ lead: 'nobody', villain: 'reginald', fool: 'gus' }, IDS);
  assert.ok(s.errors.some((e) => e.code === 'unknown'));
  assert.equal(P.validateCast({}).ok, false);
});

test('placeInSlot swaps when the actor already holds another slot', () => {
  const c = { lead: 'mabel', villain: 'reginald', fool: 'gus' };
  const swapped = P.placeInSlot(c, 'villain', 'mabel');
  assert.deepEqual(swapped, { lead: 'reginald', villain: 'mabel', fool: 'gus' });
  assert.deepEqual(c, { lead: 'mabel', villain: 'reginald', fool: 'gus' }, 'input is not mutated');
  const replaced = P.placeInSlot(c, 'fool', 'goose');
  assert.deepEqual(replaced, { lead: 'mabel', villain: 'reginald', fool: 'goose' });
});

test('placeInSlot into an empty slot leaves the vacated slot empty', () => {
  const c = { lead: 'mabel', villain: null, fool: null };
  assert.deepEqual(P.placeInSlot(c, 'fool', 'mabel'), { lead: null, villain: null, fool: 'mabel' });
});

test('removeFromSlot / slotOf', () => {
  const c = { lead: 'mabel', villain: 'reginald', fool: 'gus' };
  assert.equal(P.removeFromSlot(c, 'villain').villain, null);
  assert.equal(P.slotOf(c, 'gus'), 'fool');
  assert.equal(P.slotOf(c, 'tock'), null);
});

const SCORES = {
  lead: { mabel: 90, reginald: 40, gus: 75, goose: 60 },
  villain: { mabel: 30, reginald: 88, gus: 75, goose: 70 },
  fool: { mabel: 35, reginald: 45, gus: 75, goose: 80 },
};

test('slotScore / castTotal', () => {
  assert.equal(P.slotScore(SCORES, 'lead', 'mabel'), 90);
  assert.equal(P.slotScore(SCORES, 'lead', 'tock'), null);
  assert.equal(P.castTotal({ lead: 'mabel', villain: 'reginald', fool: 'goose' }, SCORES), 90 + 88 + 80);
  assert.equal(P.castTotal({ lead: 'mabel', villain: null, fool: null }, SCORES), 90);
});

test('bestCast finds the optimal distinct assignment', () => {
  const best = P.bestCast(SCORES);
  assert.deepEqual(best.cast, { lead: 'mabel', villain: 'reginald', fool: 'goose' });
  assert.equal(best.total, 258);
  // a greedy pick would give the goose to the villain; the optimum keeps distinct actors
  assert.equal(new Set(Object.values(best.cast)).size, 3);
});

test('auditionBoard folds cast.audition envelopes (later wins)', () => {
  const evs = [
    { kind: 'cast.audition', data: { role: 'lead', actor: 'mabel', score: 50, line: 'a' } },
    { kind: 'cast.audition', data: { role: 'lead', actor: 'mabel', score: 91, line: 'b' } },
    { kind: 'cast.audition', data: { role: 'fool', actor: 'gus', score: 75, line: 'c' } },
  ];
  const b = P.auditionBoard(evs);
  assert.equal(b.lead.mabel, 91);
  assert.equal(b.fool.gus, 75);
});

test('roleFit and scoreTier', () => {
  assert.equal(P.roleFit({ roles: ['lead'] }, 'lead'), 'natural');
  assert.equal(P.roleFit({ roles: ['lead'] }, 'fool'), 'off-type');
  assert.equal(P.roleFit({ roles: [] }, 'fool'), 'understudy');
  assert.equal(P.scoreTier(80), 'great');
  assert.equal(P.scoreTier(62), 'good');
  assert.equal(P.scoreTier(50), 'meh');
  assert.equal(P.scoreTier(10), 'poor');
  assert.equal(P.scoreTier(null), 'none');
});

test('castVerdict scales with how far you wander from Madame', () => {
  assert.equal(P.castVerdict(280, 250).mood, 'delighted');
  assert.equal(P.castVerdict(249, 250).mood, 'pleased');
  assert.equal(P.castVerdict(235, 250).mood, 'doubtful');
  assert.equal(P.castVerdict(150, 250).mood, 'appalled');
});

/* ---------------------------------------------------------------- stars */

test('starSlots handles halves and clamps', () => {
  assert.deepEqual(P.starSlots(3.5), ['full', 'full', 'full', 'half', 'empty']);
  assert.deepEqual(P.starSlots(0), ['empty', 'empty', 'empty', 'empty', 'empty']);
  assert.deepEqual(P.starSlots(7), ['full', 'full', 'full', 'full', 'full']);
  assert.deepEqual(P.starSlots(2.2, 3), ['full', 'full', 'empty']);
  assert.deepEqual(P.starSlots(2.3), ['full', 'full', 'half', 'empty', 'empty'], '2.3 rounds to the nearest half');
});

test('faithStars is 0-3 in halves', () => {
  assert.equal(P.faithStars(2), 2);
  assert.equal(P.faithStars(5), 3);
  assert.equal(P.faithStars(-1), 0);
  assert.equal(P.faithStars(1.4), 1.5);
});

test('meanStars ignores junk', () => {
  assert.equal(P.meanStars([4, 2, 3]), 3);
  assert.equal(P.meanStars([]), 0);
  assert.equal(P.meanStars([3, 'x', null]), 3);
});

test('tourTally: sums history, never double-counts tonight', () => {
  const hist = [{ night: 0, stars: 3.5 }, { night: 1, stars: 4 }, { night: 2, stars: 2.5 }];
  const t = P.tourTally(hist, 3, { night: 2 });
  assert.equal(t.previous, 7.5);
  assert.equal(t.total, 10.5);
  assert.equal(t.played, 3);
  assert.equal(t.remainingNights, 2);
  assert.equal(t.needed, 4.5);
  assert.equal(t.perNight, 2.3);
  assert.equal(t.status, 'on-track');
  assert.ok(Math.abs(t.pct - 0.7) < 1e-9);
});

test('tourTally: statuses', () => {
  assert.equal(P.tourTally([], 5, { night: 0 }).status, 'on-track');
  assert.equal(P.tourTally([{ night: 0, stars: 5 }, { night: 1, stars: 5 }, { night: 2, stars: 5 }], 0, { night: 3 }).reached, true);
  const hopeless = P.tourTally([{ night: 0, stars: 0.5 }, { night: 1, stars: 0.5 }, { night: 2, stars: 0.5 }, { night: 3, stars: 0.5 }], 0.5, { night: 4 });
  assert.equal(hopeless.status, 'tragedy');
  const steep = P.tourTally([{ night: 0, stars: 1 }, { night: 1, stars: 1 }], 1, { night: 2 });
  assert.equal(steep.status, 'hopeless'); // 12 stars over 2 nights
  assert.match(P.tallyQuip(steep), /maths/);
});

/* ---------------------------------------------------------------- rehearsal */

test('histogram buckets stars 1..5 and rounds halves', () => {
  const h = P.histogram([{ stars: 1 }, { stars: 2.5 }, { stars: 3 }, { stars: 3 }, { stars: 4.4 }, { stars: 5 }, 5, { stars: 0.2 }, { nope: 1 }]);
  assert.deepEqual(h, [2, 0, 3, 1, 2]); // 0.2 -> 1; 2.5 -> 3 (Math.round); 4.4 -> 4
});

test('histogram of nothing and histogramMax floor', () => {
  assert.deepEqual(P.histogram([]), [0, 0, 0, 0, 0]);
  assert.equal(P.histogramMax([0, 0, 0, 0, 0]), 1);
  assert.equal(P.histogramMax([1, 4, 2, 0, 1]), 4);
});

test('bucketStar clamps', () => {
  assert.equal(P.bucketStar(0), 1);
  assert.equal(P.bucketStar(9), 5);
  assert.equal(P.bucketStar(3.4), 3);
  assert.equal(P.starColour(5), 'var(--gold)');
});

test('normalizeRisk accepts fractions or counts, sorts by likelihood', () => {
  const r = P.normalizeRisk([{ title: 'a', freq: 0.25 }, { title: 'b', freq: 9 }, { title: 'c', freq: 3 }], 12);
  assert.deepEqual(r.map((x) => x.title), ['b', 'a', 'c']);
  assert.equal(r[0].pct, 0.75);
  assert.equal(r[1].pct, 0.25);
  assert.equal(r[2].pct, 0.25);
  assert.deepEqual(P.normalizeRisk(null), []);
});

test('rehearsalVerdictMood', () => {
  assert.equal(P.rehearsalVerdictMood(4.2), 'glowing');
  assert.equal(P.rehearsalVerdictMood(3.1), 'hopeful');
  assert.equal(P.rehearsalVerdictMood(2.0), 'wobbly');
  assert.equal(P.rehearsalVerdictMood(1.2), 'grim');
});

/* ---------------------------------------------------------------- writers, almanac */

test('upsertDraft replaces by quill and reports the crumpled one', () => {
  const a = { draft_id: 'd1', quill: 'quill_pompous', title: 'A' };
  const b = { draft_id: 'd2', quill: 'quill_frantic', title: 'B' };
  let r = P.upsertDraft([], a);
  assert.equal(r.replaced, null);
  r = P.upsertDraft(r.drafts, b);
  const a2 = { draft_id: 'd1b', quill: 'quill_pompous', title: 'A2' };
  r = P.upsertDraft(r.drafts, a2);
  assert.equal(r.replaced.draft_id, 'd1');
  assert.deepEqual(r.drafts.map((d) => d.draft_id), ['d1b', 'd2']);
});

test('sortDrafts puts the quills in desk order; quillMood strips the prefix', () => {
  const s = P.sortDrafts([{ quill: 'quill_tender' }, { quill: 'quill_pompous' }, { quill: 'quill_frantic' }]);
  assert.deepEqual(s.map((d) => P.quillMood(d.quill)), ['pompous', 'frantic', 'tender']);
});

test('toggleSelection honours max and deselect', () => {
  let r = P.toggleSelection([], 'a', 2);
  r = P.toggleSelection(r.selected, 'b', 2);
  assert.deepEqual(r.selected, ['a', 'b']);
  r = P.toggleSelection(r.selected, 'c', 2);
  assert.equal(r.rejected, true);
  assert.deepEqual(r.selected, ['a', 'b']);
  r = P.toggleSelection(r.selected, 'a', 2);
  assert.deepEqual(r.selected, ['b']);
});

test('foldJars: first sight makes a jar, repeats bump the counter', () => {
  let r = P.foldJars([], { calamity: 'the_lean', count: 1, text: 'x' });
  assert.equal(r.isNew, true);
  assert.equal(r.jars[0].title, 'The Lean');
  r = P.foldJars(r.jars, { calamity: 'the_lean', count: 2, text: 'y' });
  assert.equal(r.isNew, false);
  assert.equal(r.jars.length, 1);
  assert.equal(r.jars[0].count, 2);
  assert.equal(r.jars[0].text, 'y');
  r = P.foldJars(r.jars, { calamity: 'the_chair' });
  assert.equal(r.jars.length, 2);
  assert.equal(r.jars[1].count, 1);
});

/* ---------------------------------------------------------------- road, greenroom */

test('effectChips turns choice effects into chips', () => {
  const chips = P.effectChips({ funds: -1, rapport: { goose: 1 }, morale: -2, encore: 1, junk: 5 }, { goose: { name: 'Goose in a Wig' } });
  assert.deepEqual(chips.map((c) => c.kind), ['funds', 'morale', 'encore', 'rapport']);
  assert.equal(chips[0].label, '-1 fund');
  assert.equal(chips[3].label, '+1 rapport with Goose');
  const chips2 = P.effectChips({ rapport: { tock: 1 } }, { tock: { name: 'Mr. Tock' } });
  assert.equal(chips2[0].label, '+1 rapport with Tock');
  assert.deepEqual(P.effectChips({ funds: 0 }), []);
  assert.deepEqual(P.effectChips(null), []);
});

test('shortName drops titles, articles and parentheticals', () => {
  assert.equal(P.shortName('Mabel Tuckett'), 'Mabel');
  assert.equal(P.shortName('Sir Reginald Blort'), 'Reginald');
  assert.equal(P.shortName('The Goose (in a wig)'), 'Goose');
  assert.equal(P.shortName('Mr. Tock'), 'Tock');
  assert.equal(P.shortName('Captain Bartleby Nutt'), 'Bartleby');
  assert.equal(P.shortName('Gus the Understudy'), 'Gus');
  assert.equal(P.shortName('Madame'), 'Madame');
  assert.equal(P.shortName(null), '');
});

test('parseEffectLabel reads the parenthetical at the end of a choice label', () => {
  assert.deepEqual(P.parseEffectLabel('Offer bread (-1 fund)'), { funds: -1 });
  assert.deepEqual(P.parseEffectLabel('Pay the toll (-2 funds, +1 morale)'), { funds: -2, morale: 1 });
  assert.deepEqual(P.parseEffectLabel('Hand over the ticket (+1 Encore)'), { encore: 1 });
  assert.equal(P.parseEffectLabel('Take the long way'), null);
  assert.equal(P.parseEffectLabel('Sing (loudly)'), null);
  assert.equal(P.parseEffectLabel(null), null);
});

test('roadPct clamps', () => {
  assert.equal(P.roadPct(-5), 0);
  assert.equal(P.roadPct(120), 100);
  assert.equal(P.roadPct('40'), 40);
});

test('hearts', () => {
  assert.deepEqual(P.hearts(2.5), ['full', 'full', 'half', 'empty', 'empty']);
  assert.deepEqual(P.hearts(9), ['full', 'full', 'full', 'full', 'full']);
  assert.deepEqual(P.hearts(-1, 3), ['empty', 'empty', 'empty']);
});

const HITL = {
  action_requests: [{ name: 'fetch_prop', args: { prop: 'umbrella', cost: 2 }, description: 'Fetch a prop' }],
  review_configs: [{ action_name: 'fetch_prop', allowed_decisions: ['approve', 'reject'] }],
};

test('hitlRequests reads the langchain HITL payload', () => {
  const r = P.hitlRequests(HITL);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'fetch_prop');
  assert.deepEqual(r[0].allowed, ['approve', 'reject']);
  assert.equal(P.propCost(r[0]), 2);
  assert.equal(P.propCost({ args: {} }), 1);
  assert.deepEqual(P.hitlRequests({}), []);
});

test('hitlDecisions builds approve / edit / reject resume dicts', () => {
  const reqs = P.hitlRequests({
    action_requests: [{ name: 'fetch_prop', args: { prop: 'a' } }, { name: 'fetch_prop', args: { prop: 'b' } }, { name: 'calm_nerves', args: {} }],
  });
  const d = P.hitlDecisions(reqs, [{ type: 'edit', args: { prop: 'sword' } }, { type: 'reject', message: 'too dear' }]);
  assert.deepEqual(d, {
    decisions: [
      { type: 'edit', edited_action: { name: 'fetch_prop', args: { prop: 'sword' } } },
      { type: 'reject', message: 'too dear' },
      { type: 'approve' },
    ],
  });
  assert.deepEqual(P.hitlDecisions(reqs.slice(0, 1), [{ type: 'reject' }]), { decisions: [{ type: 'reject' }] });
});

test('chatKey is stable per tour and actor', () => {
  assert.equal(P.chatKey('t1', 'mabel'), P.chatKey('t1', 'mabel'));
  assert.notEqual(P.chatKey('t1', 'mabel'), P.chatKey('t1', 'gus'));
});

/* ---------------------------------------------------------------- pacing, text */

test('paceMs scales and instant-skips', () => {
  assert.ok(P.paceMs('cast.audition') >= 250 && P.paceMs('cast.audition') <= 700);
  assert.ok(P.paceMs('review.pigeon') >= 300 && P.paceMs('review.pigeon') <= 1200);
  assert.equal(P.paceMs('anything.unknown'), P.DEFAULT_PACE_MS);
  assert.equal(P.paceMs('review.pigeon', 0), 0);
  assert.equal(P.paceMs('review.pigeon', 2), Math.round(P.PACE_MS['review.pigeon'] / 2));
});

test('humanize / phrase / ordinal / nightLabel / hash', () => {
  assert.equal(P.humanize('the_lean'), 'The Lean');
  assert.equal(P.humanize('goose-incident'), 'Goose Incident');
  assert.equal(P.humanize(null), '');
  assert.equal(P.phrase('leans_left'), 'leans left');
  assert.equal(P.ordinal(1), '1st');
  assert.equal(P.ordinal(12), '12th');
  assert.equal(P.ordinal(23), '23rd');
  assert.equal(P.nightLabel(2), 'Night 3 of 5');
  assert.equal(P.hash('a'), P.hash('a'));
  assert.notEqual(P.hash('a'), P.hash('b'));
});

test('indexById takes arrays or objects', () => {
  assert.deepEqual(P.indexById([{ id: 'a', n: 1 }, { id: 'b' }]).a, { id: 'a', n: 1 });
  assert.deepEqual(P.indexById({ a: 1 }), { a: 1 });
  assert.deepEqual(P.indexById(null), {});
});

test('colour helpers refuse non-hex input and shade stays in range', () => {
  assert.equal(P.safeColour('url(javascript:x)', '#123456'), '#123456');
  assert.equal(P.safeColour('#C0566E'), '#C0566E');
  assert.equal(P.shade('#808080', 1), '#ffffff');
  assert.equal(P.shade('#808080', -1), '#000000');
  assert.equal(P.shade('#fff', -0.5), '#808080');
  assert.equal(P.mix('#000000', '#ffffff', 0.5), '#808080');
});

/* ---------------------------------------------------------------- playbill */

// a deterministic fake font metric: 0.5em per character
const measure = (text, font) => text.length * (parseInt(/(\d+)px/.exec(font || '20px')[1], 10) || 20) * 0.5;

test('wrapText wraps greedily and hard-splits monster words', () => {
  const m = (s) => s.length * 10;
  assert.deepEqual(P.wrapText('the quick brown fox', 100, m), ['the quick', 'brown fox']);
  assert.deepEqual(P.wrapText('', 100, m), []);
  const long = P.wrapText('abcdefghijklmnopqrstuvwxyz', 100, m);
  assert.ok(long.length > 1);
  assert.ok(long.every((l) => m(l) <= 100));
  assert.equal(long.join('').replace(/-/g, ''), 'abcdefghijklmnopqrstuvwxyz');
});

test('sectionFor maps task names and falls back to the next unrevealed section', () => {
  assert.equal(P.sectionFor('bios'), 'cast');
  assert.equal(P.sectionFor('traditions_page'), 'traditions');
  assert.equal(P.sectionFor('review_wall'), 'quote');
  assert.equal(P.sectionFor('Back Page'), 'back_page');
  assert.equal(P.sectionFor('mystery', ['masthead', 'cast']), 'tonight');
  assert.equal(P.sectionFor('mystery', P.PLAYBILL_ORDER), null);
});

const PB = {
  title: 'The Umbrella Who Loved Me', town: 'marshwick', night: 1, genre: 'farce',
  cast: [
    { id: 'mabel', name: 'Mabel Tuckett', role: 'lead', bio: 'Mabel Tuckett, trained at the Royal Academy of Looking Out Windows. Leans left.' },
    { id: 'reginald', name: 'Sir Reginald Blort', role: 'villain', bio: 'Sir Reginald apologises first, then villains.' },
    { id: 'gus', name: 'Gus', role: 'fool', bio: 'Has never been on stage. Knows every part.' },
  ],
  tonight: ['Tonight in Marshwick: umbrellas will be returned.'],
  traditions: [{ title: 'The Lean' }, 'The Chair'],
  quote: 'A tragedy of the angle.',
  stars: 3.5,
  back_page: ['Please do not feed the goose.', 'Exits are for the wrong door.'],
  previously: ['Night 1: a swan was cast as the vicar.', { title: 'Night 2: the chair fell.' }],
};
const ctxNorm = {
  towns: { marshwick: { name: 'Marshwick-on-Mire' } },
  genres: { farce: { name: 'Farce', roles: { lead: 'The Flustered Hero', villain: 'The Scheming Landlord', fool: 'The Wrong Man' } } },
  performers: { mabel: { name: 'Mabel Tuckett' } },
};

test('normalizePlaybill resolves names, role labels and mixed list shapes', () => {
  const n = P.normalizePlaybill(PB, ctxNorm);
  assert.equal(n.town, 'Marshwick-on-Mire');
  assert.equal(n.genre, 'Farce');
  assert.equal(n.nightLabel, 'Night 2');
  assert.equal(n.cast[0].role, 'The Flustered Hero');
  assert.deepEqual(n.traditions, ['The Lean', 'The Chair']);
  assert.deepEqual(n.previously.map((p) => p.text), ['Night 1: a swan was cast as the vicar.', 'Night 2: the chair fell.']);
  assert.equal(n.quote, 'A tragedy of the angle.');
});

test('normalizePlaybill survives an empty playbill', () => {
  const n = P.normalizePlaybill(null, { params: { town: 'x_y', genre: 'farce' } });
  assert.equal(n.town, 'X Y');
  assert.ok(n.title);
  assert.deepEqual(n.cast, []);
});

test('layoutPlaybill fits the poster, in order, inside the frame', () => {
  const n = P.normalizePlaybill(PB, ctxNorm);
  const L = P.layoutPlaybill(n, measure, { width: 1080, height: 1440 });
  assert.equal(L.overflow, false);
  const texts = L.ops.filter((o) => o.t === 'text');
  assert.ok(texts.length > 10);
  assert.ok(texts.every((o) => Number.isFinite(o.x) && Number.isFinite(o.y)), 'no NaN coordinates');
  assert.ok(texts.every((o) => o.y < 1440 && o.y > 0));
  // reading order: y never goes backwards within the vertical flow except the side-by-side "previously" columns
  const titleIdx = texts.findIndex((o) => o.text.includes('Umbrella'));
  const castIdx = texts.findIndex((o) => o.text.includes('Mabel Tuckett'));
  assert.ok(titleIdx >= 0 && castIdx > titleIdx);
  assert.ok(texts[castIdx].y > texts[titleIdx].y);
  const frame = L.ops.find((o) => o.t === 'frame');
  assert.equal(frame.h, 1440 - 56);
  assert.ok(L.ops.some((o) => o.t === 'box'), 'back page notices are boxed');
});

test('layoutPlaybill shrinks (scale < 1) for a crowded bill and flags true overflow', () => {
  const crowded = P.normalizePlaybill({ ...PB, cast: Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, name: 'Performer ' + i, role: 'lead', bio: 'word '.repeat(60) })) }, ctxNorm);
  const L = P.layoutPlaybill(crowded, measure, { width: 1080, height: 1440 });
  assert.ok(L.scale < 1);
  const absurd = P.normalizePlaybill({ ...PB, cast: Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, name: 'N' + i, role: 'lead', bio: 'word '.repeat(900) })) }, ctxNorm);
  const A = P.layoutPlaybill(absurd, measure, { width: 1080, height: 1440 });
  assert.equal(A.overflow, true);
});

test('layoutPlaybill with an empty bill still returns a poster', () => {
  const n = P.normalizePlaybill({}, { params: { town: 'marshwick' } });
  const L = P.layoutPlaybill(n, measure);
  assert.equal(L.overflow, false);
  assert.ok(L.ops.some((o) => o.t === 'text'));
});


test('propCost reads the price from the server description when the tool args carry none', async () => {
  const { propCost } = await import(new URL('../../src/tragedy/server/static/js/views/_kit/pure.js', import.meta.url));
  assert.equal(propCost({ name: 'fetch_prop', args: { prop: 'chandelier' }, description: 'Mrs. Gasket will fetch: chandelier. It costs 3 funds. Approve?' }, 1), 3);
  assert.equal(propCost({ args: { prop: 'x' }, description: 'It costs 1 fund.' }, 9), 1);
  assert.equal(propCost({ args: { prop: 'x', cost: 2 }, description: 'It costs 3 funds.' }, 9), 2, 'explicit args win');
  assert.equal(propCost({ args: { prop: 'x' } }, 7), 7, 'fallback when nothing says');
});

test('puppetLabel: tells the truth about who voices the puppets', () => {
  assert.equal(P.puppetLabel(null), 'Puppets: offline');
  assert.equal(P.puppetLabel({ provider: 'offline', model: 'offline' }), 'Puppets: offline and deterministic');
  assert.equal(P.puppetLabel({ provider: 'openai', model: 'gpt-5.4-mini' }), 'Puppets: voiced by OpenAI (gpt-5.4-mini)');
  assert.equal(P.puppetLabel({ provider: 'anthropic', model: 'claude-haiku-5-5' }), 'Puppets: voiced by Claude (claude-haiku-5-5)');
  assert.equal(P.puppetLabel({ provider: 'anthropic' }), 'Puppets: voiced by Claude');
});

test('castTotal: no floating-point noise on screen (a playtest saw 218.10000000000002)', () => {
  const scores = { lead: { a: 77.6 }, villain: { b: 73.7 }, fool: { c: 66.8 } };
  const total = P.castTotal({ lead: 'a', villain: 'b', fool: 'c' }, scores);
  assert.equal(total, 218.1);
  assert.equal(String(total), '218.1');
});

test('greenroomHint: nudges a player sitting on money, and only then', () => {
  assert.equal(P.greenroomHint(null), null);
  assert.equal(P.greenroomHint({ status: 'active', funds: 2, props: [] }), null, 'too poor to shop');
  assert.match(P.greenroomHint({ status: 'active', funds: 8, props: [] }), /8 funds .* no real props/);
  assert.equal(P.greenroomHint({ status: 'active', funds: 8, props: ['chair'] }), null, 'already shopping, modest funds');
  assert.match(P.greenroomHint({ status: 'active', funds: 28, props: ['chair'] }), /28 funds are just sitting/);
  assert.equal(P.greenroomHint({ status: 'triumph', funds: 28, props: [] }), null, 'the tour is over');
});

test('genreTaste: a town loves one genre and scorns another, and the cards can say so', () => {
  const town = { temperament: { favours: 'whodunit', scorns: 'farce' } };
  assert.equal(P.genreTaste(town, 'whodunit'), 'loved');
  assert.equal(P.genreTaste(town, 'farce'), 'scorned');
  assert.equal(P.genreTaste(town, 'pantomime'), null);
  assert.equal(P.genreTaste(null, 'farce'), null);
  assert.equal(P.genreTaste({ temperament: {} }, 'farce'), null, 'old datasets without the fields still render');
});

test('defaultGenreId: never pre-selects a genre the town loves or scorns', () => {
  const genres = ['melodrama', 'farce', 'whodunit', 'gothic_romance', 'pantomime'].map((id) => ({ id }));
  const town = { temperament: { favours: 'farce', scorns: 'melodrama' } };
  for (let pick = 0; pick < 30; pick++) assert.ok(['whodunit', 'gothic_romance', 'pantomime'].includes(P.defaultGenreId(genres, town, pick)), String(pick));
  assert.equal(P.defaultGenreId(genres, town, 3), P.defaultGenreId(genres, town, 3), 'stable');
  assert.ok(genres.map((g) => g.id).includes(P.defaultGenreId(genres, null, 7)), 'no town data: any genre');
  assert.equal(P.defaultGenreId([], town, 1), undefined);
});

test('townShort: a badge names the town, not its first word', () => {
  assert.equal(P.townShort('Twelve Bridges'), 'Twelve Bridges');
  assert.equal(P.townShort('The Royal Opera House of Wibbling'), 'Royal Opera House');
  assert.equal(P.townShort('Puddlecombe-under-Cloud'), 'Puddlecombe');
  assert.equal(P.townShort('Candlewick Down'), 'Candlewick Down');
  assert.equal(P.townShort(''), 'This town');
  assert.equal(P.townShort(null), 'This town');
});
