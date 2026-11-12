// The lab's canned runs are the contract fixtures the views are built against: keep them honest to PROTOCOL sections 2 and 4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOWS, auditionScore } from '../../src/tragedy/server/static/js/views/_lab/flows.js';
import { performers, roadEvents, SAMPLE_CAST, SAMPLE_SCRIPT, SAMPLE_RESULT } from '../../src/tragedy/server/static/js/views/_lab/fixtures.js';
import * as P from '../../src/tragedy/server/static/js/views/_kit/pure.js';

// the data keys PROTOCOL section 4 promises for each kind (a subset: only the kinds the views consume)
const REQUIRED = {
  'cast.audition': ['role', 'actor', 'score', 'line'],
  'cast.recommend': ['cast', 'note', 'scores'],
  'script.draft': ['draft_id', 'quill', 'title', 'tagline', 'beats', 'confidence'],
  'script.chosen': ['draft_id'],
  'rehearsal.sample': ['i', 'stars', 'warmth', 'chaos', 'top_mishap'],
  'rehearsal.summary': ['histogram', 'mean', 'risk', 'verdict'],
  'review.pigeon': ['critic', 'name', 'outlet', 'stars', 'quote'],
  'review.headline': ['text', 'stars', 'funds_delta'],
  'almanac.noted': ['calamity', 'count', 'text'],
  'almanac.candidate': ['calamity', 'title', 'count', 'text'],
  'almanac.tradition': ['calamity', 'title'],
  'memory.recalled': ['text', 'calamity', 'town', 'score'],
  'road.step': ['pct', 'label'],
  'road.event': ['id', 'title', 'text', 'choices'],
  'road.crash': ['node', 'recovered'],
  'road.arrive': ['town'],
  'playbill.section': ['name'],
  'greenroom.rapport': ['actor', 'rapport'],
  'greenroom.tool': ['tool', 'args', 'status'],
};

/** Drive a generator flow with canned resume values; returns {events, interrupts, values}. */
function drive(graph, input, resumes = [], world = {}) {
  const thread = {};
  const gen = FLOWS[graph](input, { rapport: {}, roadEvents, revise: false, ...world }, thread);
  const events = [];
  const interrupts = [];
  let send;
  let i = 0;
  for (;;) {
    const r = gen.next(send);
    send = undefined;
    if (r.done) return { events, interrupts, values: r.value };
    if (r.value.event) events.push(r.value.event);
    else if (r.value.interrupt) { interrupts.push(r.value.interrupt); send = resumes[i++]; }
  }
}

function check(events) {
  const keys = new Set();
  for (const ev of events) {
    assert.equal(ev.v, 1);
    assert.ok(typeof ev.key === 'string' && ev.key, 'has a key');
    assert.ok(!keys.has(ev.key), `unique key ${ev.key}`);
    keys.add(ev.key);
    for (const k of REQUIRED[ev.kind] || []) assert.ok(k in ev.data, `${ev.kind} carries ${k}`);
  }
}

test('casting_call: 24 auditions, a recommendation, a confirm_cast interrupt, resume {cast}', () => {
  const r = drive('casting_call', { genre: 'farce', seed: 7 }, [{ cast: SAMPLE_CAST }]);
  check(r.events);
  assert.equal(r.events.filter((e) => e.kind === 'cast.audition').length, 24);
  assert.equal(r.events.at(-1).kind, 'cast.recommend');
  const p = r.interrupts[0];
  assert.equal(p.kind, 'confirm_cast');
  assert.deepEqual(Object.keys(p.proposed).sort(), ['fool', 'lead', 'villain']);
  assert.ok(P.validateCast(p.proposed, performers.map((x) => x.id)).ok);
  assert.deepEqual(r.values.cast, SAMPLE_CAST);
});

test('audition scores follow the engine-ish formula: naturals beat strangers, 5..99', () => {
  const mabel = performers.find((p) => p.id === 'mabel');
  const tock = performers.find((p) => p.id === 'tock');
  assert.ok(auditionScore(mabel, 'lead') > auditionScore(tock, 'lead'));
  for (const p of performers) for (const role of P.ROLES) { const s = auditionScore(p, role); assert.ok(s >= 5 && s <= 99); }
});

test('writers_room: three quills draft, interrupt pick_draft, resume {draft_id} -> script', () => {
  const r = drive('writers_room', { genre: 'farce' }, [{ draft_id: 'draft-1' }]);
  check(r.events);
  assert.equal(r.events.filter((e) => e.kind === 'script.draft').length, 3);
  const p = r.interrupts[0];
  assert.equal(p.kind, 'pick_draft');
  assert.equal(p.drafts.length, 3);
  for (const d of p.drafts) { assert.equal(d.beats.length, 5); assert.ok(d.confidence >= 0 && d.confidence <= 3); }
  assert.equal(r.events.at(-1).kind, 'script.chosen');
  assert.equal(r.values.script.beats.length, 5);
});

test('writers_room with a draft sent back: the same quill drafts twice, the payload is authoritative', () => {
  const r = drive('writers_room', { genre: 'farce' }, [{ draft_id: 'draft-0' }], { revise: true });
  const drafts = r.events.filter((e) => e.kind === 'script.draft');
  assert.equal(drafts.length, 4);
  assert.equal(drafts.filter((e) => e.data.quill === 'quill_pompous').length, 2);
  const folded = drafts.reduce((acc, e) => P.upsertDraft(acc, e.data).drafts, []);
  assert.equal(folded.length, 3);
  assert.deepEqual(folded.map((d) => d.draft_id).sort(), r.interrupts[0].drafts.map((d) => d.draft_id).sort());
});

test('rehearsal: 12 samples then a summary whose histogram matches the samples', () => {
  const r = drive('rehearsal', { cast: SAMPLE_CAST, script: SAMPLE_SCRIPT, samples: 12, seed: 7 });
  check(r.events);
  const samples = r.events.filter((e) => e.kind === 'rehearsal.sample').map((e) => e.data);
  assert.equal(samples.length, 12);
  const sum = r.events.at(-1).data;
  assert.deepEqual(sum.histogram, P.histogram(samples));
  assert.ok(Math.abs(sum.mean - P.meanStars(samples.map((s) => s.stars))) < 0.01);
  assert.ok(P.normalizeRisk(sum.risk).length > 0);
});

test('reviews: five pigeons then a headline', () => {
  const r = drive('reviews', { result: SAMPLE_RESULT });
  check(r.events);
  assert.equal(r.events.filter((e) => e.kind === 'review.pigeon').length, 5);
  assert.equal(r.events.at(-1).kind, 'review.headline');
  assert.ok(r.values.stars >= 0 && r.values.stars <= 5);
});

test('almanac: noted jars, candidates, an interrupt curate_traditions, resume {enshrine}', () => {
  const r = drive('almanac', { result: SAMPLE_RESULT, next_town: 'grimsdyke' }, [{ enshrine: ['the_lean', 'the_goose_incident'] }]);
  check(r.events);
  const p = r.interrupts[0];
  assert.equal(p.kind, 'curate_traditions');
  assert.equal(p.max, 2);
  assert.ok(p.candidates.every((c) => c.count >= 2));
  assert.equal(r.events.filter((e) => e.kind === 'almanac.tradition').length, 2);
  assert.equal(r.values.traditions.length, 2);
  assert.ok(r.events.filter((e) => e.kind === 'memory.recalled').length >= 1);
});

test('almanac without repeats skips the interrupt', () => {
  const r = drive('almanac', { result: { calamities: ['the_chair'] }, next_town: 'grimsdyke' });
  assert.equal(r.interrupts.length, 0);
  assert.equal(r.values.traditions.length, 0);
});

test('playbill_press: section events then a playbill with cast bios', () => {
  const r = drive('playbill_press', { cast: SAMPLE_CAST, script: SAMPLE_SCRIPT, town: 'marshwick', night: 1, genre: 'farce', traditions: [], stars: 3.5, headline: 'H' });
  check(r.events);
  assert.ok(r.events.every((e) => e.kind === 'playbill.section'));
  const pb = r.values.playbill;
  assert.equal(pb.cast.length, 3);
  assert.ok(pb.cast.every((c) => c.bio && c.name));
  assert.ok(P.normalizePlaybill(pb, {}).cast.length === 3);
});

test('the_road: steps, an event, a crossroads interrupt, then arrival', () => {
  const r = drive('the_road', { from_town: 'marshwick', to_town: 'pudding_lane' }, [{ choice: 'bribe' }]);
  check(r.events);
  assert.equal(r.interrupts[0].kind, 'crossroads');
  assert.ok(r.interrupts[0].choices.length >= 2);
  assert.equal(r.events.at(-1).kind, 'road.arrive');
  assert.equal(r.values.choice, 'bribe');
});

test('the_road with crash=true emits road.crash then THROWS; the resume emits recovered then arrives', () => {
  const thread = {};
  const world = { rapport: {}, roadEvents };
  const first = FLOWS.the_road({ from_town: 'marshwick', to_town: 'pudding_lane', crash: true }, world, thread);
  const seen = [];
  let step;
  let thrown = null;
  try {
    for (;;) {
      step = first.next(step?.value?.interrupt ? { choice: 'bribe' } : undefined);
      if (step.done) break;
      if (step.value.event) seen.push(step.value.event);
    }
  } catch (e) { thrown = e; }
  assert.ok(thrown, 'the first run errors');
  assert.deepEqual(seen.at(-1).data, { node: 'apply', recovered: false });
  const second = FLOWS.the_road({ from_town: 'marshwick', to_town: 'pudding_lane', __resume: true }, world, thread);
  const resumed = [];
  for (let r = second.next(); !r.done; r = second.next()) if (r.value.event) resumed.push(r.value.event);
  assert.deepEqual(resumed.map((e) => e.kind), ['road.crash', 'road.step', 'road.arrive']);
  assert.equal(resumed[0].data.recovered, true);
});

test('greenroom_chat: a prop request interrupts with the HITL payload and honours approve / reject', () => {
  const ask = { messages: [{ role: 'user', content: 'Do you need a prop?' }], actor_id: 'mabel' };
  const approved = drive('greenroom_chat', ask, [{ decisions: [{ type: 'approve' }] }]);
  const req = P.hitlRequests(approved.interrupts[0]);
  assert.equal(req[0].name, 'fetch_prop');
  assert.deepEqual(req[0].allowed, ['approve', 'edit', 'reject']);
  assert.ok(approved.events.some((e) => e.kind === 'greenroom.tool' && e.data.status === 'approved'));
  const rejected = drive('greenroom_chat', ask, [P.hitlDecisions(req, [{ type: 'reject', message: 'too dear' }])]);
  assert.ok(rejected.events.some((e) => e.kind === 'greenroom.tool' && e.data.status === 'rejected'));
  const calm = drive('greenroom_chat', { messages: [{ role: 'user', content: 'Calm your nerves?' }], actor_id: 'mabel' });
  assert.ok(calm.events.some((e) => e.kind === 'greenroom.rapport'));
});
