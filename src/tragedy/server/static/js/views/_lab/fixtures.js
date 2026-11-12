// Small embedded fixtures of the datasets (shapes per docs/DATA.md) for views-lab.html. Not the real data: just enough to drive the views.

export const performers = [
  { id: 'mabel', name: 'Mabel Tuckett', kind: 'marionette', blurb: 'Method actor. One string is too short, so she leans left.',
    palette: { body: '#c0566e', accent: '#f2c14e', hair: '#3b2a3a' }, build: { head: 'round', height: 1.0, arms: 'long', costume: 'gown', strings: 5 },
    skills: { drama: 78, comedy: 40, menace: 22, romance: 74, physical: 35, improv: 52 }, stage_fright: 35, roles: ['lead'], flaws: ['leans_left', 'cries_by_watering_can'] },
  { id: 'reginald', name: 'Sir Reginald Blort', kind: 'hand', blurb: 'A gentle villain. Apologises before every murder.',
    palette: { body: '#4d3a6b', accent: '#e9b949', hair: '#8a8a8a' }, build: { head: 'long', height: 1.1, arms: 'normal', costume: 'coat', strings: 4 },
    skills: { drama: 66, comedy: 35, menace: 70, romance: 30, physical: 40, improv: 44 }, stage_fright: 50, roles: ['villain'], flaws: ['apologises_mid_villainy', 'allergic_to_feathers'] },
  { id: 'gus', name: 'Gus the Understudy', kind: 'marionette', blurb: 'Knows every part. Has never been on stage. Is terrified of stage.',
    palette: { body: '#6c8a7b', accent: '#f6ecd6', hair: '#5a4632' }, build: { head: 'square', height: 0.92, arms: 'normal', costume: 'rags', strings: 6 },
    skills: { drama: 55, comedy: 55, menace: 45, romance: 45, physical: 50, improv: 70 }, stage_fright: 90, roles: [], flaws: ['never_been_on_stage'] },
  { id: 'goose', name: 'The Goose (in a wig)', kind: 'marionette', blurb: 'The most convincing woman I have ever met, says everyone.',
    palette: { body: '#9bb7d4', accent: '#f2a03d', hair: '#e8e0f0' }, build: { head: 'beak', height: 1.0, arms: 'short', costume: 'wig', strings: 4 },
    skills: { drama: 40, comedy: 82, menace: 55, romance: 35, physical: 70, improv: 60 }, stage_fright: 20, roles: ['fool', 'villain'], flaws: ['eats_the_props', 'upstages_the_moon'] },
  { id: 'hortensia', name: 'Hortensia Sock', kind: 'hand', blurb: 'Diva. A sock. Insists it is a hosiery of destiny.',
    palette: { body: '#d8546b', accent: '#e9b949', hair: '#7d1527' }, build: { head: 'sock', height: 1.0, arms: 'long', costume: 'robe', strings: 3 },
    skills: { drama: 85, comedy: 50, menace: 60, romance: 62, physical: 25, improv: 38 }, stage_fright: 15, roles: ['lead', 'villain'], flaws: ['stage_whispers_everything', 'over_commits_to_death'] },
  { id: 'bartleby', name: 'Captain Bartleby Nutt', kind: 'marionette', blurb: 'Nutcracker soldier. Cannot be talked out of a salute.',
    palette: { body: '#b3263d', accent: '#e9b949', hair: '#f6ecd6' }, build: { head: 'nutcracker', height: 1.15, arms: 'short', costume: 'uniform', strings: 5 },
    skills: { drama: 48, comedy: 30, menace: 80, romance: 20, physical: 72, improv: 25 }, stage_fright: 40, roles: ['villain'], flaws: ['exits_through_the_wrong_door', 'cannot_say_the_word_macbeth'] },
  { id: 'poppet', name: 'Poppet', kind: 'marionette', blurb: 'Rag-doll child prodigy. Has only ever learned Act Two.',
    palette: { body: '#e0a82e', accent: '#d8546b', hair: '#c0566e' }, build: { head: 'round', height: 0.8, arms: 'stubby', costume: 'frock', strings: 7 },
    skills: { drama: 62, comedy: 68, menace: 15, romance: 58, physical: 60, improv: 78 }, stage_fright: 30, roles: ['lead', 'fool'], flaws: ['only_knows_act_two', 'speaks_in_rhyme'] },
  { id: 'tock', name: 'Mr. Tock', kind: 'marionette', blurb: 'Clockwork man. Ticks audibly through the tender scenes.',
    palette: { body: '#6a8fa0', accent: '#e9b949', hair: '#444444' }, build: { head: 'tin', height: 1.1, arms: 'normal', costume: 'armour', strings: 4 },
    skills: { drama: 38, comedy: 48, menace: 66, romance: 18, physical: 64, improv: 20 }, stage_fright: 55, roles: ['fool', 'villain'], flaws: ['afraid_of_the_chandelier', 'forgets_which_play'] },
];

export const staff = [
  { id: 'madame', name: 'Madame Odalys Prunt', job: 'director (supervisor agent)', kind: 'hand', palette: { body: '#7d1527', accent: '#e9b949', hair: '#2a1630' }, voice: { tone: 'imperious, wounded', catchphrases: ['Darling, no.'] }, emoji: '' },
  { id: 'quill_pompous', name: 'Bartholomew Quill (pompous)', job: 'playwright', kind: 'heron', style: 'grand, long, many adjectives', palette: { body: '#6a4575', accent: '#e9b949', hair: '#2a1630' } },
  { id: 'quill_frantic', name: 'Bartholomew Quill (frantic)', job: 'playwright', kind: 'heron', style: 'short, panicked, three subplots', palette: { body: '#c8574a', accent: '#f7dc8c', hair: '#2a1630' } },
  { id: 'quill_tender', name: 'Bartholomew Quill (tender)', job: 'playwright', kind: 'heron', style: 'soft, sad, a lot of weather', palette: { body: '#5c8fb0', accent: '#f6ecd6', hair: '#2a1630' } },
  { id: 'clipboard', name: 'Clipboard', job: 'stage manager (tortoise)', kind: 'tortoise', palette: { body: '#7bb661', accent: '#f6ecd6', hair: '#2a1630' } },
  { id: 'gasket', name: 'Mrs. Gasket', job: 'props (clockwork spider)', kind: 'spider', palette: { body: '#a97c1f', accent: '#e9b949', hair: '#2a1630' } },
];

export const flaws = [
  ['leans_left', 'Leans left'], ['cries_by_watering_can', 'Cries by watering can'], ['apologises_mid_villainy', 'Apologises mid-villainy'],
  ['allergic_to_feathers', 'Allergic to feathers'], ['never_been_on_stage', 'Has never been on stage'], ['eats_the_props', 'Eats the props'],
  ['upstages_the_moon', 'Upstages the moon'], ['stage_whispers_everything', 'Stage-whispers everything'], ['over_commits_to_death', 'Over-commits to death'],
  ['exits_through_the_wrong_door', 'Exits through the wrong door'], ['cannot_say_the_word_macbeth', 'Cannot say the word Macbeth'], ['only_knows_act_two', 'Only knows Act Two'],
  ['speaks_in_rhyme', 'Speaks in rhyme'], ['afraid_of_the_chandelier', 'Afraid of the chandelier'], ['forgets_which_play', 'Forgets which play'],
].map(([id, name]) => ({ id, name, text: name, triggers: [], intensity: 0.4, kinds: [] }));

export const genres = [
  { id: 'melodrama', name: 'Melodrama', blurb: 'Moustaches, wills, trains.', roles: { lead: 'The Wronged Heroine', villain: 'The Moustachioed Landlord', fool: 'The Comic Servant' } },
  { id: 'farce', name: 'Farce', blurb: 'Doors. So many doors.', roles: { lead: 'The Flustered Hero', villain: 'The Scheming Landlord', fool: 'The Wrong Man' } },
  { id: 'whodunit', name: 'Whodunit', blurb: 'The butler did it. The goose saw everything.', roles: { lead: 'The Detective', villain: 'The Butler (Obviously)', fool: 'The Goose Who Saw Everything' } },
  { id: 'gothic_romance', name: 'Gothic Romance', blurb: 'Moors, candles, brooding.', roles: { lead: 'The Brooding Heir', villain: 'The Spectral Aunt', fool: 'The Faithful Hound' } },
  { id: 'pantomime', name: 'Pantomime', blurb: "He's behind you!", roles: { lead: 'The Principal Boy', villain: 'The Wicked Baron', fool: 'The Dame' } },
];

export const towns = [
  { id: 'marshwick', name: 'Marshwick-on-Mire', blurb: 'Damp. Proud of it.', sky: 'dusk', landmark: 'windmill', temperament: { likes: ['pun', 'goose'], hates: ['death', 'fire'], expects: 'the_chair', openness: 0.4 }, gossip: 'They still talk about the time a swan was cast as the vicar.' },
  { id: 'pudding_lane', name: 'Pudding-under-Lyne', blurb: 'Everything is a pie, eventually.', sky: 'noon', landmark: 'chimneys', temperament: { likes: ['feast', 'song'], hates: ['storm'], expects: 'the_goose_incident', openness: 0.7 }, gossip: 'The mayor has been a pie since 1998.' },
  { id: 'grimsdyke', name: 'Grimsdyke', blurb: 'Fog with a postcode.', sky: 'night', landmark: 'castle', temperament: { likes: ['ghost', 'mourning'], hates: ['pun'], expects: 'the_chandelier', openness: 0.3 }, gossip: 'Nobody has seen the other side of the high street.' },
  { id: 'little_wibble', name: 'Little Wibble', blurb: 'Smaller than it sounds.', sky: 'dawn', landmark: 'clocktower', temperament: { likes: ['rhyme'], hates: ['goose'], expects: null, openness: 0.6 }, gossip: 'The clock has been right twice, both times by accident.' },
  { id: 'wibbling_opera', name: 'The Royal Opera House of Wibbling', blurb: 'Gilded, haughty, mildly damp.', sky: 'night', landmark: 'spire', temperament: { likes: ['song', 'crown', 'speech'], hates: ['goose', 'slapstick'], expects: 'the_chandelier', openness: 0.2 }, gossip: 'The chandelier has opinions.' },
];

export const critics = [
  { id: 'pompous', name: 'Sir Coo-Lambert Pidgeon', outlet: 'The Wibbling Gazette', style: 'pompous' },
  { id: 'wounded_parent', name: 'Mrs. Pidge-Wenlock', outlet: "The Parent's Friend", style: 'wounded' },
  { id: 'snacks', name: 'Crumbs McFlap', outlet: 'The Daily Nibble', style: 'snacks' },
  { id: 'chaos_gourmand', name: 'Ruffles Von Dread', outlet: 'Chaos Weekly', style: 'gourmand' },
  { id: 'sentimentalist', name: 'Dove Tearly', outlet: 'The Sentimental Herald', style: 'sentimental' },
];

export const roadEvents = [
  { id: 'goose_on_the_bridge', title: 'A goose holds the bridge', text: 'A goose, unmistakably in charge, stands in the middle of the only bridge and will not discuss it.',
    choices: [{ id: 'bribe', label: 'Offer bread (-1 fund)', effects: { funds: -1, rapport: { goose: 1 } } }, { id: 'detour', label: 'Take the long way', effects: { funds: 0, morale: -1 } }] },
];

export const data = { performers, staff, flaws, genres, towns, critics, road_events: roadEvents };

/** A tour mid-flight, for the lab. */
export function makeTour(night = 1) {
  return {
    id: 'tour-lab1', seed: 7, night, towns: towns.map((t) => t.id), funds: 8, encore: 2, candles: 2,
    rapport: { mabel: 2, goose: 1, gus: 0.5 },
    traditions: [{ calamity: 'the_lean', title: 'The Lean', count: 2 }],
    history: [
      { night: 0, town: 'marshwick', genre: 'farce', title: 'The Umbrella Affair', stars: 3.5, headline: 'A TRAGEDY OF THE ANGLE', funds_delta: 3 },
    ].slice(0, night),
    wagon: { at: towns[Math.min(night, towns.length - 1)].id }, status: 'active',
  };
}

export const SAMPLE_CAST = { lead: 'mabel', villain: 'reginald', fool: 'goose' };

export const SAMPLE_SCRIPT = {
  title: 'The Umbrella Who Loved Me', tagline: 'A romance of weather and poor decisions', quill: 'quill_frantic', genre: 'farce',
  beats: ['setup', 'complication', 'reversal', 'twist', 'finale'].map((b, i) => ({ beat: b, variant: `farce_${b}_1`, logline: `Beat ${i + 1}: a thing happens, loudly.`, tags: ['door', 'pun'], lines: [], props: [], slots: {} })),
  tags: ['door', 'pun', 'goose'],
};

export const SAMPLE_RESULT = {
  warmth: 61, chaos: 38, quality_avg: 64, quality_lead: 70, quality: [60, 64, 66, 62, 70],
  mishaps: [{ beat: 'complication', id: 'lean_collapse', title: 'Mabel leans too far left', actor: 'mabel', calamity: 'the_lean', decision: 'lean_in' }],
  calamities: ['the_lean', 'the_goose_incident', 'the_chandelier', 'the_chair'], tradition_hits: 1, yes_and: 2, cues_used: ['thunder'],
  beats: [],
};
