// Fixture data + a full 5-beat show log implementing PROTOCOL section 4, for the stage lab and the tests.
// Pure data: importable in Node. The datasets/*.json files do not need to exist for the lab to run.

import { hash01 } from './rng.js';

export const PERFORMERS = [
  { id: 'mabel', name: 'Mabel Tuckett', kind: 'marionette', blurb: 'Method actor. One string is too short, so she leans left.',
    palette: { body: '#c0566e', accent: '#f2c14e', hair: '#3b2a3a' }, build: { head: 'round', height: 1.0, arms: 'long', costume: 'gown', strings: 5 },
    roles: ['lead'], flaws: ['leans_left', 'cries_by_watering_can'] },
  { id: 'reginald', name: 'Sir Reginald Blort', kind: 'hand', blurb: 'A gentle villain who apologises.',
    palette: { body: '#3d405b', accent: '#e07a5f', hair: '#1d1d1d' }, build: { head: 'long', height: 1.08, arms: 'long', costume: 'coat', strings: 4 },
    roles: ['villain'], flaws: ['apologises_mid_villainy'] },
  { id: 'gus', name: 'Gus the Understudy', kind: 'marionette', blurb: 'Knows every part. Has never been on stage.',
    palette: { body: '#5c677d', accent: '#cbd5e1', hair: '#111118' }, build: { head: 'shadow', height: 0.95, arms: 'short', costume: 'robe', strings: 3 },
    roles: [], flaws: ['never_been_on_stage'] },
  { id: 'goose', name: 'The Goose', kind: 'marionette', blurb: 'A goose in a wig. The most convincing woman you have ever met.',
    palette: { body: '#f4f1de', accent: '#e9a23b', hair: '#d9c9e8' }, build: { head: 'beak', height: 0.92, arms: 'short', costume: 'wig', strings: 4 },
    roles: ['fool'], flaws: ['eats_the_props'] },
  { id: 'hortensia', name: 'Hortensia Sock', kind: 'hand', blurb: 'Sock-puppet diva.',
    palette: { body: '#9b5de5', accent: '#f15bb5', hair: '#ffd166' }, build: { head: 'sock', height: 1.05, arms: 'long', costume: 'frock', strings: 6 },
    roles: ['lead', 'villain'], flaws: ['upstages_the_moon'] },
  { id: 'bartleby', name: 'Captain Bartleby Nutt', kind: 'marionette', blurb: 'Nutcracker soldier.',
    palette: { body: '#bb3e03', accent: '#e9d8a6', hair: '#001219' }, build: { head: 'nutcracker', height: 1.15, arms: 'short', costume: 'uniform', strings: 7 },
    roles: ['villain'], flaws: ['corpses'] },
  { id: 'poppet', name: 'Poppet', kind: 'marionette', blurb: 'Rag-doll child prodigy.',
    palette: { body: '#a8dadc', accent: '#e63946', hair: '#6d4c41' }, build: { head: 'square', height: 0.72, arms: 'long', costume: 'rags', strings: 5 },
    roles: ['fool', 'lead'], flaws: ['speaks_in_rhyme'] },
  { id: 'tock', name: 'Mr. Tock', kind: 'marionette', blurb: 'Clockwork man.',
    palette: { body: '#8d99ae', accent: '#ffd166', hair: '#2b2d42' }, build: { head: 'tin', height: 1.2, arms: 'long', costume: 'armour', strings: 6 },
    roles: ['villain', 'fool'], flaws: ['afraid_of_the_chandelier'] },
];

export const STAFF = [
  { id: 'madame', name: 'Madame Odalys Prunt', job: 'director', kind: 'hand', palette: { body: '#7d1527', accent: '#e9b949', hair: '#241a26' }, emoji: '\u{1F3A9}' },
  { id: 'quill_pompous', name: 'Bartholomew Quill (pompous)', kind: 'heron', palette: { body: '#6a4575', accent: '#e9b949', hair: '#241a26' }, emoji: '\u{1FAB6}' },
  { id: 'quill_frantic', name: 'Bartholomew Quill (frantic)', kind: 'heron', palette: { body: '#ee6c4d', accent: '#f6ecd6', hair: '#241a26' }, emoji: '\u{1FAB6}' },
  { id: 'quill_tender', name: 'Bartholomew Quill (tender)', kind: 'heron', palette: { body: '#b8a1e3', accent: '#f6ecd6', hair: '#241a26' }, emoji: '\u{1FAB6}' },
  { id: 'clipboard', name: 'Clipboard', job: 'stage manager', kind: 'tortoise', palette: { body: '#7bb661', accent: '#efe0c2', hair: '#241a26' }, emoji: '\u{1F422}' },
  { id: 'gasket', name: 'Mrs. Gasket', job: 'props', kind: 'spider', palette: { body: '#a97c1f', accent: '#f7dc8c', hair: '#241a26' }, emoji: '\u{1F577}' },
  { id: 'narrator', name: 'The Paper Moon', job: 'narrator', kind: 'moon', palette: { body: '#f7dc8c', accent: '#e9b949', hair: '#a97c1f' }, emoji: '\u{1F319}' },
];

const T = (id, name, hat, coat, skin, likes, hates) => ({ id, name, hat, palette: { coat, skin }, likes, hates, laugh: 0.5, cry: 0.3, gasp: 0.4, boo: 0.1 });
export const TASTES = [
  T('man_who_hates_death', 'The Man Who Hates Death', 'top', '#4a4e69', '#e8c9a0', ['pun'], ['death']),
  T('tearful_aunt', 'The Tearful Aunt', 'bonnet', '#9a6b8f', '#f0d3b0', ['wedding'], ['murder']),
  T('pun_lover', 'The Pun Enthusiast', 'bow', '#6d597a', '#e8c9a0', ['pun', 'rhyme'], ['death']),
  T('child_in_the_front', 'The Child in the Front', 'none', '#e07a5f', '#f6d8b8', ['slapstick'], ['speech']),
  T('retired_actor', 'The Retired Actor', 'feather', '#2d6a6a', '#e0b890', ['speech'], ['pun']),
  T('critic_in_disguise', 'The Critic in Disguise', 'fez', '#7d1527', '#d9b48a', ['mask'], ['goose']),
  T('sleepy_farmer', 'The Sleepy Farmer', 'flat', '#6b705c', '#e2b98f', ['feast'], ['song']),
  T('goose_fancier', 'The Goose Fancier', 'feather', '#b08968', '#f0d3b0', ['goose'], ['fire']),
  T('romantic', 'The Romantic', 'bow', '#b5445e', '#f2d4c0', ['romance', 'kiss'], ['betrayal']),
  T('skeptic', 'The Skeptic', 'top', '#34495e', '#d8b995', [], ['ghost']),
  T('snack_vendor', 'The Snack Vendor', 'flat', '#d4a373', '#e8c9a0', ['feast'], ['poison']),
  T('mayor', 'The Mayor', 'crown', '#3a5a40', '#e3b995', ['speech'], ['slapstick']),
];

const PN = {
  sword: 'Rubber Sword', chair: 'Wobbly Chair', candle: 'Candle', door: 'Door', umbrella_stand: 'Umbrella Stand', letter: 'Letter', mask: 'Mask',
  mirror: 'Mirror', crown: 'Crown', chandelier: 'Chandelier', goose: 'Paper Goose', cake: 'Cake', ghost_sheet: 'Ghost Sheet', trunk: 'Trunk',
  skull: 'Skull', bouquet: 'Bouquet', ladder: 'Ladder', teapot: 'Teapot', lantern: 'Lantern', tree: 'Tree', bed: 'Bed', clock: 'Grandfather Clock',
  harp: 'Harp', trophy: 'Trophy', bottle: 'Bottle', book: 'Book', rope: 'Rope', banner: 'Banner', fish: 'Fish', moon: 'Moon',
};
export const PROPS = Object.keys(PN).map((id) => ({ id, name: PN[id], tags: [id], draw: id }));

export const CUES = [
  { id: 'lights', label: 'Lights', emoji: '\u{1F4A1}', uses: 2, anim: 'wash' },
  { id: 'thunder', label: 'Thunder sheet', emoji: '⛈', uses: 2, anim: 'lightning' },
  { id: 'trapdoor', label: 'Trapdoor', emoji: '\u{1F6AA}', uses: 1, anim: 'hatch' },
  { id: 'fog', label: 'Fog machine', emoji: '\u{1F32B}', uses: 1, anim: 'fog' },
  { id: 'spotlight', label: 'Spotlight', emoji: '\u{1F526}', uses: 2, anim: 'spot' },
  { id: 'curtain', label: 'Curtain', emoji: '\u{1F3AD}', uses: 1, anim: 'curtain' },
];

export const GENRE = { id: 'farce', name: 'Farce', palette: { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' } };

export function fixtureData() {
  return { performers: PERFORMERS, staff: STAFF, tastes: TASTES, cues: CUES, props: PROPS };
}

// ---- the show -------------------------------------------------------------------------------------------------------
const BEAT_NAMES = ['Setup', 'Complication', 'Reversal', 'Twist', 'Finale'];

const MOODS = {
  funny: { laugh: 0.55, applaud: 0.1, gasp: 0.1, yawn: 0.08, cry: 0.05, boo: 0.12 },
  tense: { gasp: 0.4, laugh: 0.1, boo: 0.15, cry: 0.1, yawn: 0.2, applaud: 0.05 },
  sweet: { cry: 0.3, applaud: 0.3, laugh: 0.2, gasp: 0.1, yawn: 0.1, boo: 0 },
  bad: { boo: 0.4, yawn: 0.3, gasp: 0.15, laugh: 0.05, cry: 0.1, applaud: 0 },
  triumph: { applaud: 0.5, laugh: 0.3, cry: 0.2, gasp: 0, yawn: 0, boo: 0 },
};

function reactionFor(mood, beat, seat, tag) {
  const w = MOODS[mood];
  let r = hash01('react', tag, beat, seat), acc = 0;
  for (const k in w) { acc += w[k]; if (r < acc) return k; }
  return 'laugh';
}

/**
 * Build a complete show log. `ending`: 'warm' (live fixture) or 'knot' (the ghost timeline: the Prompter covers up,
 * chaos snowballs, the finale ends in a giant knot).
 */
export function showLog({ ending = 'warm' } = {}) {
  const ev = [];
  const pre = ending === 'warm' ? 'f' : 'g';
  let k = 0;
  const push = (kind, agent, data) => { ev.push({ v: 1, kind, key: `${pre}-${String(++k).padStart(4, '0')}`, agent, data }); };
  const palette = GENRE.palette;
  const knot = ending === 'knot';

  const setBeat = (i, set, sky, props, logline, tags) => {
    push('stage.beat', 'performance', { index: i, beat: ['setup', 'complication', 'reversal', 'twist', 'finale'][i], name: BEAT_NAMES[i], logline, tags });
    push('stage.set', 'performance', { beat: i, set, sky, props, palette });
  };
  const line = (actor, role, text, emotion) => push('stage.line', actor, { actor, role, text, emotion });
  const audience = (beat, mood, delta, counts) => {
    const cnt = { laugh: 0, gasp: 0, cry: 0, boo: 0, yawn: 0, applaud: 0 };
    for (let s = 0; s < 12; s++) {
      const reaction = reactionFor(mood, beat, s, ending);
      cnt[reaction]++;
      push('audience.react', 'audience', { seat: s, reaction, intensity: Math.round((0.4 + 0.6 * hash01('int', beat, s, ending)) * 100) / 100, why: 'fixture' });
    }
    push('audience.tally', 'performance', { beat, delta, counts: counts || cnt });
  };

  // curtain-up: seat the house
  TASTES.forEach((t, i) => push('audience.seat', 'audience', { seat: i, taste: t.id, hat: t.hat, palette: t.palette }));

  // ---- beat 0: setup ----
  setBeat(0, 'parlour', 'dusk', ['door', 'umbrella_stand', 'chair'], 'Everyone arrives at the same house for different, incompatible reasons.', ['door', 'mistaken_identity']);
  push('stage.enter', 'performance', { actor: 'mabel', role: 'lead', from: 'left' });
  push('stage.enter', 'performance', { actor: 'reginald', role: 'villain', from: 'right' });
  push('stage.enter', 'performance', { actor: 'gus', role: 'fool', from: 'trapdoor' });
  push('stage.direct', 'madame', { text: 'Darling, no. Enter like you mean it. Mabel, the umbrella is a metaphor.', speaker: 'madame' });
  line('mabel', 'lead', "I'm only here to return this umbrella to Sir Reginald!", 'joy');
  line('reginald', 'villain', 'Nobody returns an umbrella. Who sent you? Was it Gus?', 'smug');
  line('gus', 'fool', 'I am Gus. I am also, I think, the umbrella.', 'fear');
  push('stage.mishap', 'performance', { id: 'umbrella_lean', actor: 'gus', other: 'mabel', kind: 'prop', severity: 'minor', title: 'Gus leans on the umbrella stand',
    text: 'Gus leans on the umbrella stand, which is not a wall.', anim: 'wobble', tags: ['slapstick', 'door'], calamity: 'the_umbrella', effects: { warmth: -1, chaos: 4 } });
  push('stage.decision', 'madame', { mishap_id: 'umbrella_lean', option: 'cover_up', label: 'Madame handles it', cue: null, text: 'Madame handles it.', line: '(sotto voce) Darling, no. Lean on the line, not the furniture.', effects: { warmth: 0, chaos: -3 }, by: 'madame' });
  audience(0, 'funny', 4);
  push('meter', 'performance', { warmth: 44, chaos: 14, beat: 0 });

  // ---- beat 1: complication ----
  setBeat(1, 'corridor', 'night', ['door', 'candle', 'ladder'], 'Every door is the wrong door.', ['door', 'chase']);
  push('stage.direct', 'madame', { text: 'Corridor. Doors. Commit to the doors, all of them, at once.', speaker: 'madame' });
  line('reginald', 'villain', 'Every door in this corridor is the wrong door. I apologise in advance.', 'rage');
  line('mabel', 'lead', 'I feel it in my left side. Something is coming.', 'fear');
  line('gus', 'fool', 'Is it the umbrella?', 'joy');
  push('stage.mishap', 'performance', { id: 'wrong_door', actor: 'reginald', other: 'gus', kind: 'exit', severity: 'minor', title: 'Reginald exits through the wrong door',
    text: 'Reginald exits through the wrong door, the painted one, at speed.', anim: 'slide', tags: ['door', 'slapstick'], calamity: 'the_wrong_door', effects: { warmth: 2, chaos: 6 } });
  push('stage.decision', 'madame', { mishap_id: 'wrong_door', option: 'lean_in', label: 'Madame leans in', cue: null, text: '', line: '(sotto voce) A painted door is still a door, Reginald.', effects: { warmth: 1, chaos: 0 }, by: 'madame' });
  audience(1, 'tense', 2);
  push('meter', 'performance', { warmth: 48, chaos: 22, beat: 1 });

  // ---- beat 2: reversal (major mishap; the Prompter decides) ----
  setBeat(2, 'bedroom', 'night', ['bed', 'mirror', 'teapot'], 'The heroine is, it turns out, the villain. Also leaning.', ['romance', 'mirror']);
  push('stage.direct', 'madame', { text: 'The kiss, darlings. One degree of passion. Perhaps two.', speaker: 'madame' });
  line('mabel', 'lead', 'Reginald! I have loved you since the umbrella!', 'love');
  line('reginald', 'villain', 'I am so sorry. I was supposed to be menacing.', 'grief');
  push('stage.mishap', 'performance', { id: 'lean_collapse', actor: 'mabel', other: 'gus', kind: 'collapse', severity: 'major', title: 'Mabel leans too far left',
    text: 'Mabel leans into the kiss and keeps leaning. Gus is now holding a diagonal heroine.', anim: 'lean_left', tags: ['slapstick', 'romance'], calamity: 'the_lean', effects: { warmth: -2, chaos: 9 } });
  if (!knot) {
    push('stage.decision', 'prompter', { mishap_id: 'lean_collapse', option: 'lean_in', label: 'Yes, and...', cue: 'lights', text: '', line: '(whispering) It is a tragedy of the angle, darling. Commit.', effects: { warmth: 4, chaos: 6 }, by: 'prompter' });
    push('stage.cue', 'performance', { cue: 'lights', fits: true, outcome: 'miracle', text: 'A gold wash finds the angle. It looks intentional.', anim: 'wash' });
    push('stage.chain', 'performance', { actors: ['gus', 'reginald'], lines: ['Gus: "The angle IS the play."', 'Reginald: "I apologise for the geometry."'], bonus: 3 });
    audience(2, 'funny', 9);
    push('meter', 'performance', { warmth: 61, chaos: 31, beat: 2 });
  } else {
    push('stage.decision', 'prompter', { mishap_id: 'lean_collapse', option: 'cover_up', label: 'Cover it up', cue: 'thunder', text: '', line: '(whispering) Nothing happened. Stand up, Mabel. STAND UP.', effects: { warmth: -1, chaos: -2 }, by: 'prompter' });
    push('stage.cue', 'performance', { cue: 'thunder', fits: false, outcome: 'misfire', text: 'Thunder, at a wedding. Someone’s aunt faints.', anim: 'lightning' });
    audience(2, 'bad', -4);
    push('meter', 'performance', { warmth: 55, chaos: 52, beat: 2 });
  }

  // ---- beat 3: twist ----
  setBeat(3, 'cellar', 'storm', ['trunk', 'skull', 'lantern', 'bottle'], 'The trunk contains a second, angrier trunk.', ['storm', 'secret']);
  push('stage.direct', 'madame', { text: 'The cellar. Something is in the trunk. It is not what we rehearsed.', speaker: 'madame' });
  line('gus', 'fool', 'The trunk has a trunk. This is the twist, I think.', 'fear');
  line('reginald', 'villain', 'I wish to reveal that I am Mabel’s long-lost umbrella.', 'smug');
  line('mabel', 'lead', 'Reginald! The skull! You have dropped the skull!', 'rage');
  if (!knot) {
    push('stage.mishap', 'performance', { id: 'drop_skull', actor: 'reginald', other: 'mabel', kind: 'prop', severity: 'minor', title: 'Reginald drops the skull',
      text: 'Reginald drops the skull. It rolls, politely, under the bed that is not here.', anim: 'drop_prop', tags: ['skull', 'slapstick'], calamity: 'the_skull', effects: { warmth: 1, chaos: 5 } });
    push('stage.decision', 'gus', { mishap_id: 'drop_skull', option: 'ask_gus', label: 'Ask Gus', cue: 'thunder', text: '', line: '(Gus, in a very small voice) Alas, poor Yorick. He fell.', effects: { warmth: 3, chaos: -2 }, by: 'gus' });
    push('stage.cue', 'performance', { cue: 'thunder', fits: true, outcome: 'miracle', text: 'Thunder rolls in on the skull. The aunt in row two cheers.', anim: 'lightning' });
    audience(3, 'tense', 5);
    push('meter', 'performance', { warmth: 66, chaos: 24, beat: 3 });
  } else {
    push('stage.mishap', 'performance', { id: 'flip_trunk', actor: 'gus', other: 'reginald', kind: 'collapse', severity: 'major', title: 'Gus is eaten by the trunk',
      text: 'Gus opens the trunk and the trunk opens Gus. A somersault occurs.', anim: 'flip', tags: ['slapstick', 'storm'], calamity: 'the_trunk', effects: { warmth: -3, chaos: 12 } });
    push('stage.decision', 'madame', { mishap_id: 'flip_trunk', option: 'cover_up', label: 'Madame despairs', cue: null, text: '', line: '(sotto voce) Darling, no. Darling, NO.', effects: { warmth: -1, chaos: 4 }, by: 'madame' });
    push('stage.cue', 'performance', { cue: 'fog', fits: false, outcome: 'misfire', text: 'Fog, indoors. The cellar has a cellar.', anim: 'fog' });
    audience(3, 'bad', -6);
    push('meter', 'performance', { warmth: 50, chaos: 74, beat: 3 });
  }

  // ---- beat 4: finale ----
  setBeat(4, 'ballroom', 'night', ['chandelier', 'cake', 'harp', 'banner'], 'Everyone is revealed to be someone slightly else. A cake is involved.', ['chandelier', 'feast']);
  push('stage.direct', 'madame', { text: 'The finale! The chandelier is NOT a character. Mind the cake.', speaker: 'madame' });
  line('mabel', 'lead', 'I forgive you, Reginald, and also the umbrella.', 'love');
  line('reginald', 'villain', 'I accept, and apologise for accepting.', 'joy');
  line('gus', 'fool', 'Is this the end? I was only just getting good.', 'smug');
  if (!knot) {
    push('stage.mishap', 'performance', { id: 'cake_bow', actor: 'gus', other: 'mabel', kind: 'feast', severity: 'minor', title: 'Gus takes the first bow',
      text: 'Gus takes a bow a full beat early and meets the cake halfway.', anim: 'bow', tags: ['feast', 'slapstick'], calamity: 'the_cake', effects: { warmth: 3, chaos: 3 } });
    push('stage.decision', 'madame', { mishap_id: 'cake_bow', option: 'lean_in', label: 'Madame leans in', cue: null, text: '', line: '(sotto voce) Bravo, Gus. Now do it again, on time.', effects: { warmth: 2, chaos: 0 }, by: 'madame' });
    audience(4, 'triumph', 5);
    push('meter', 'performance', { warmth: 71, chaos: 38, beat: 4 });
    push('stage.exit', 'performance', { actor: 'reginald', role: 'villain', from: 'trapdoor' });
    push('stage.curtain', 'performance', { warmth: 71, chaos: 38, quality_avg: 64, tradition_hits: 1, knotted: false });
  } else {
    push('stage.mishap', 'performance', { id: 'knot_lift', actor: 'mabel', other: 'gus', kind: 'collapse', severity: 'major', title: 'The strings take over',
      text: 'The strings, long since in charge, tie themselves into one enormous opinion.', anim: 'fly', tags: ['slapstick'], calamity: 'the_knot', effects: { warmth: -4, chaos: 15 } });
    push('stage.decision', 'madame', { mishap_id: 'knot_lift', option: 'cover_up', label: 'Pull the curtain', cue: 'curtain', text: '', line: '(sotto voce) Curtain. CURTAIN.', effects: { warmth: -1, chaos: 2 }, by: 'madame' });
    audience(4, 'bad', -8);
    push('meter', 'performance', { warmth: 33, chaos: 93, beat: 4 });
    push('stage.curtain', 'performance', { warmth: 33, chaos: 93, quality_avg: 41, tradition_hits: 0, knotted: true });
  }
  return ev;
}
