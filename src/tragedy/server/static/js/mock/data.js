// Small embedded fixtures for the mock server (shapes follow docs/DATA.md; far fewer rows than the real datasets).
// Everything here is plain JSON-able data. The engine (engine.js) turns it into graph runs.

export const BEATS = ['setup', 'complication', 'reversal', 'twist', 'finale'];
export const BEAT_NAMES = { setup: 'Setup', complication: 'Complication', reversal: 'Reversal', twist: 'Twist', finale: 'Finale' };
export const BEAT_WEIGHTS = [0.15, 0.2, 0.2, 0.2, 0.25];

const pal = (body, accent, hair) => ({ body, accent, hair });

export const PERFORMERS = [
  { id: 'mabel', name: 'Mabel Tuckett', kind: 'marionette', blurb: 'Method actor. One string is too short, so she leans left.', palette: pal('#c0566e', '#f2c14e', '#3b2a3a'), build: { head: 'round', height: 1.0, arms: 'long', costume: 'gown', strings: 5 }, skills: { drama: 78, comedy: 40, menace: 22, romance: 74, physical: 35, improv: 52 }, stage_fright: 35, roles: ['lead'], flaws: ['leans_left', 'cries_by_watering_can'], voice: { tone: 'breathless, theatrical', catchphrases: ['I feel it in my left side.'], tics: ['sighs at the wrong moment'] }, bio_seed: 'trained at the Royal Academy of Looking Out Windows' },
  { id: 'reginald', name: 'Sir Reginald Blort', kind: 'hand puppet', blurb: 'A gentle villain who apologises mid-menace.', palette: pal('#4a3b6d', '#e0a82e', '#d8d2c4'), build: { head: 'long', height: 1.1, arms: 'short', costume: 'coat', strings: 3 }, skills: { drama: 55, comedy: 48, menace: 70, romance: 30, physical: 40, improv: 44 }, stage_fright: 45, roles: ['villain'], flaws: ['apologises_mid_villainy', 'allergic_to_feathers'], voice: { tone: 'courtly, mortified', catchphrases: ['So terribly sorry. Doom.'], tics: ['bows before stabbing'] }, bio_seed: 'once menaced a vicar, then brought him tea' },
  { id: 'gus', name: 'Gus the Understudy', kind: 'sock puppet', blurb: 'Knows every part. Has never been on stage.', palette: pal('#7a8f5c', '#f2c14e', '#6b4a2b'), build: { head: 'sock', height: 0.8, arms: 'short', costume: 'rags', strings: 3 }, skills: { drama: 50, comedy: 55, menace: 45, romance: 45, physical: 50, improv: 60 }, stage_fright: 85, roles: [], flaws: ['never_been_on_stage'], voice: { tone: 'wide-eyed, whispering', catchphrases: ['Is it me? It is me.'], tics: ['mouths everyone else\'s lines'] }, bio_seed: 'has watched four thousand rehearsals through a keyhole' },
  { id: 'goose', name: 'The Goose (in a wig)', kind: 'goose', blurb: '"The most convincing woman I\'ve ever met."', palette: pal('#f4efe2', '#f2a03d', '#8a5a2b'), build: { head: 'beak', height: 0.9, arms: 'wings', costume: 'wig', strings: 4 }, skills: { drama: 35, comedy: 72, menace: 60, romance: 25, physical: 66, improv: 70 }, stage_fright: 20, roles: ['fool', 'villain'], flaws: ['eats_the_props', 'upstages_the_moon'], voice: { tone: 'honk', catchphrases: ['HONK.'], tics: ['hisses at the front row'] }, bio_seed: 'signed a contract in bread' },
  { id: 'hortensia', name: 'Hortensia Vane', kind: 'sock puppet', blurb: 'A sock-puppet diva who has outlived four theatres.', palette: pal('#a8326b', '#f7dc8c', '#2b1b2e'), build: { head: 'sock', height: 1.15, arms: 'long', costume: 'gown', strings: 6 }, skills: { drama: 70, comedy: 35, menace: 60, romance: 55, physical: 30, improv: 28 }, stage_fright: 15, roles: ['lead', 'villain'], flaws: ['upstages_the_moon', 'speaks_in_rhyme'], voice: { tone: 'operatic, wounded', catchphrases: ['I was NEVER better than tonight.'], tics: ['hums her own entrance'] }, bio_seed: 'was a glove, once, in a better class of play' },
  { id: 'bartleby', name: 'Captain Bartleby Nutt', kind: 'nutcracker', blurb: 'A nutcracker soldier. Cannot say the word "Macbeth".', palette: pal('#2f5aa8', '#e9b949', '#f0e6d2'), build: { head: 'nutcracker', height: 1.2, arms: 'stiff', costume: 'uniform', strings: 5 }, skills: { drama: 48, comedy: 30, menace: 66, romance: 20, physical: 72, improv: 25 }, stage_fright: 40, roles: ['villain', 'fool'], flaws: ['exits_through_the_wrong_door', 'cannot_say_the_word_macbeth'], voice: { tone: 'clipped, regimental', catchphrases: ['Forward! Wait. Which way?'], tics: ['salutes the scenery'] }, bio_seed: 'guarded a toy box for thirty years' },
  { id: 'poppet', name: 'Poppet', kind: 'rag doll', blurb: 'Child prodigy. Twelve. Several hundred years old.', palette: pal('#e07a5f', '#81b29a', '#c0392b'), build: { head: 'round', height: 0.7, arms: 'floppy', costume: 'frock', strings: 4 }, skills: { drama: 62, comedy: 66, menace: 28, romance: 58, physical: 45, improv: 74 }, stage_fright: 25, roles: ['lead', 'fool'], flaws: ['corpses', 'over_commits_to_death'], voice: { tone: 'sweet, unnerving', catchphrases: ['Again, again!'], tics: ['stares directly at the audience'] }, bio_seed: 'was found in an attic and immediately hired' },
  { id: 'tock', name: 'Mr. Tock', kind: 'clockwork', blurb: 'A clockwork man. Runs down in act two.', palette: pal('#8d99a6', '#e9b949', '#3b3b3b'), build: { head: 'tin', height: 1.25, arms: 'stiff', costume: 'robe', strings: 7 }, skills: { drama: 40, comedy: 28, menace: 68, romance: 18, physical: 55, improv: 20 }, stage_fright: 30, roles: ['villain', 'fool'], flaws: ['afraid_of_the_chandelier', 'only_knows_act_two'], voice: { tone: 'measured, ticking', catchphrases: ['Tick. Regrettably.'], tics: ['winds himself during speeches'] }, bio_seed: 'built to announce trains, repurposed to announce doom' },
];

export const STAFF = [
  { id: 'madame', name: 'Madame Odalys Prunt', job: 'director (supervisor agent)', kind: 'hand', palette: pal('#5b2a5e', '#e9b949', '#1b0f1f'), voice: { tone: 'imperious, wounded', catchphrases: ['Darling, no.'] }, emoji: '🎩' },
  { id: 'quill_pompous', name: 'Bartholomew Quill (Pompous)', job: 'playwright', kind: 'heron', palette: pal('#7a8aa0', '#e9b949', '#d6dbe3'), style: 'grand speeches, crowns, doom', voice: { tone: 'florid', catchphrases: ['Behold!'] }, emoji: '🪶' },
  { id: 'quill_frantic', name: 'Bartholomew Quill (Frantic)', job: 'playwright', kind: 'heron', palette: pal('#a07a7a', '#ee6c4d', '#e3d6d6'), style: 'chases, slapstick, doors', voice: { tone: 'breathless', catchphrases: ['No time! Next scene!'] }, emoji: '🪶' },
  { id: 'quill_tender', name: 'Bartholomew Quill (Tender)', job: 'playwright', kind: 'heron', palette: pal('#7aa08f', '#b8a1e3', '#d6e3dc'), style: 'songs, reunions, tears', voice: { tone: 'wistful', catchphrases: ['And then, softly...'] }, emoji: '🪶' },
  { id: 'clipboard', name: 'Clipboard', job: 'stage manager (tortoise)', kind: 'tortoise', palette: pal('#6b8f5c', '#e9b949', '#3d5a30'), voice: { tone: 'cue numbers only', catchphrases: ['Cue 14.'] }, emoji: '🐢' },
  { id: 'gasket', name: 'Mrs. Gasket', job: 'props (clockwork spider)', kind: 'spider', palette: pal('#5a5a6b', '#e0a82e', '#222'), voice: { tone: 'eight hands, always the wrong one', catchphrases: ['Here, take the... no.'] }, emoji: '🕷' },
  { id: 'narrator', name: 'The Paper Moon', job: 'narrator', kind: 'moon', palette: pal('#f7e7a5', '#e9b949', '#fff'), voice: { tone: 'sleepy omniscience', catchphrases: ['As it was written.'] }, emoji: '🌙' },
];

export const FLAWS = [
  { id: 'leans_left', name: 'Leans left', text: 'One string is too short.', triggers: ['romance', 'kiss', 'stairs', 'dance'], intensity: 0.45, kinds: ['collapse', 'upstage'] },
  { id: 'cries_by_watering_can', name: 'Cries by watering can', text: 'Tears arrive in a tin can. Often early.', triggers: ['mourning', 'reunion', 'letter', 'death'], intensity: 0.4, kinds: ['cry', 'prop'] },
  { id: 'apologises_mid_villainy', name: 'Apologises mid-villainy', text: 'Cannot threaten without a note of regret.', triggers: ['murder', 'betrayal', 'poison', 'trial'], intensity: 0.5, kinds: ['apology'] },
  { id: 'speaks_in_rhyme', name: 'Speaks in rhyme', text: 'Once started, cannot stop. Is that the time?', triggers: ['rhyme', 'song', 'speech', 'pun'], intensity: 0.45, kinds: ['rhyme'] },
  { id: 'exits_through_the_wrong_door', name: 'Exits through the wrong door', text: 'There are four doors. He chooses the painted one.', triggers: ['door', 'chase', 'secret', 'mistaken_identity'], intensity: 0.5, kinds: ['exit'] },
  { id: 'corpses', name: 'Corpses', text: 'Dies beautifully. Then giggles.', triggers: ['death', 'murder', 'poison', 'mourning'], intensity: 0.5, kinds: ['corpse'] },
  { id: 'upstages_the_moon', name: 'Upstages the moon', text: 'Will not share a spotlight with a paper moon.', triggers: ['song', 'speech', 'dance', 'crown'], intensity: 0.4, kinds: ['upstage'] },
  { id: 'afraid_of_the_chandelier', name: 'Afraid of the chandelier', text: 'Looks up. Always looks up.', triggers: ['chandelier', 'stairs', 'ghost', 'fire'], intensity: 0.55, kinds: ['freeze'] },
  { id: 'allergic_to_feathers', name: 'Allergic to feathers', text: 'Three herons, one goose: it is a lot.', triggers: ['goose', 'mask', 'letter', 'feast'], intensity: 0.45, kinds: ['freeze', 'prop'] },
  { id: 'eats_the_props', name: 'Eats the props', text: 'Everything is a snack until proven a sword.', triggers: ['feast', 'treasure', 'poison', 'sword'], intensity: 0.5, kinds: ['feast', 'prop'] },
  { id: 'never_been_on_stage', name: 'Never been on stage', text: 'Knows every line. Cannot find the stage.', triggers: ['speech', 'door', 'trial', 'song'], intensity: 0.6, kinds: ['freeze', 'exit'] },
  { id: 'over_commits_to_death', name: 'Over-commits to death', text: 'Takes four minutes to die. Gets better each time.', triggers: ['death', 'sword', 'poison', 'murder'], intensity: 0.5, kinds: ['corpse', 'collapse'] },
  { id: 'cannot_say_the_word_macbeth', name: 'Cannot say the word', text: 'Refers to the Scottish Play. Loudly.', triggers: ['ghost', 'murder', 'crown', 'storm'], intensity: 0.35, kinds: ['wrong_play'] },
  { id: 'only_knows_act_two', name: 'Only knows act two', text: 'Starts every play in the middle.', triggers: ['reunion', 'secret', 'letter', 'lie'], intensity: 0.45, kinds: ['wrong_play'] },
];

const M = (id, flaw, kind, severity, title, text, tags, effects, calamity, anim) => ({ id, flaw, kind, severity, title, text, tags, effects, calamity, anim });
export const MISHAPS = [
  M('lean_collapse', 'leans_left', 'collapse', 'major', 'Mabel leans too far left', '{actor} leans into the kiss and keeps leaning. {other} is now holding a diagonal heroine.', ['slapstick', 'romance'], { warmth: -2, chaos: 9 }, 'the_lean', 'lean_left'),
  M('lean_minor', 'leans_left', 'upstage', 'minor', 'A gentle list to port', '{actor} drifts leftward through the whole scene. The scenery politely follows.', ['romance'], { warmth: 0, chaos: 3 }, 'the_lean', 'wobble'),
  M('can_cry', 'cries_by_watering_can', 'cry', 'major', 'The watering can arrives early', '{actor} weeps into a tin watering can. It is the wrong act. It is a lot of water.', ['mourning', 'slapstick'], { warmth: -1, chaos: 7 }, 'the_watering_can', 'shake'),
  M('can_minor', 'cries_by_watering_can', 'prop', 'minor', 'A small damp moment', '{actor} produces a tiny watering can for no stated reason.', ['mourning'], { warmth: 1, chaos: 2 }, 'the_watering_can', 'drop_prop'),
  M('sorry_stab', 'apologises_mid_villainy', 'apology', 'major', 'Reginald apologises to the victim', '{actor} pauses mid-menace to ask whether {other} is comfortable.', ['betrayal', 'pun'], { warmth: -3, chaos: 6 }, 'the_apology', 'bow'),
  M('sorry_minor', 'apologises_mid_villainy', 'apology', 'minor', 'A courteous threat', '{actor} threatens {other} and then holds the door.', ['betrayal'], { warmth: 1, chaos: 2 }, 'the_apology', 'bow'),
  M('rhyme_run', 'speaks_in_rhyme', 'rhyme', 'major', 'The couplets will not stop', '{actor} has begun to rhyme and cannot be stopped. {other} is trying to answer in prose.', ['rhyme', 'speech'], { warmth: 0, chaos: 8 }, 'the_couplet', 'spin'),
  M('rhyme_minor', 'speaks_in_rhyme', 'rhyme', 'minor', 'An accidental couplet', '{actor} says "nigh" and "sky" in the same breath.', ['rhyme'], { warmth: 2, chaos: 1 }, 'the_couplet', 'wobble'),
  M('door_wrong', 'exits_through_the_wrong_door', 'exit', 'major', 'Exit, pursued by a painted door', '{actor} exits through the door that is only a painting. It holds. For a moment.', ['door', 'slapstick'], { warmth: -1, chaos: 10 }, 'the_wrong_door', 'slide'),
  M('door_minor', 'exits_through_the_wrong_door', 'exit', 'minor', 'A confident wrong turn', '{actor} marches off into the prop cupboard.', ['door'], { warmth: 1, chaos: 3 }, 'the_wrong_door', 'slide'),
  M('corpse_giggle', 'corpses', 'corpse', 'major', 'The corpse is laughing', '{actor} dies tragically and then, quite clearly, snorts.', ['death', 'slapstick'], { warmth: -2, chaos: 8 }, 'the_corpse', 'shake'),
  M('corpse_minor', 'corpses', 'corpse', 'minor', 'A lively departed', '{actor} lies very still and winks at the front row.', ['death'], { warmth: 1, chaos: 2 }, 'the_corpse', 'flip'),
  M('moon_upstage', 'upstages_the_moon', 'upstage', 'major', 'Diva versus paper moon', '{actor} steps in front of the moon for the third time. The moon says nothing, loudly.', ['song', 'crown'], { warmth: -2, chaos: 7 }, 'the_moon_dispute', 'spin'),
  M('moon_minor', 'upstages_the_moon', 'upstage', 'minor', 'A little too much light', '{actor} takes the spotlight. The moon dims in protest.', ['song'], { warmth: 0, chaos: 2 }, 'the_moon_dispute', 'wobble'),
  M('chandelier_freeze', 'afraid_of_the_chandelier', 'freeze', 'major', 'Everyone is looking up', '{actor} sees the chandelier, and so, one by one, does everybody else.', ['chandelier', 'stairs'], { warmth: -3, chaos: 8 }, 'the_chandelier', 'freeze'),
  M('chandelier_minor', 'afraid_of_the_chandelier', 'freeze', 'minor', 'A nervous glance', '{actor} edges around the chandelier like it owes him money.', ['chandelier'], { warmth: 0, chaos: 2 }, 'the_chandelier', 'hide'),
  M('feather_sneeze', 'allergic_to_feathers', 'freeze', 'major', 'The sneeze heard in Wibbling', '{actor} sneezes. {other} sheds a wig. A feather was involved.', ['goose', 'mask'], { warmth: -1, chaos: 9 }, 'the_sneeze', 'shake'),
  M('snack_prop', 'eats_the_props', 'feast', 'major', 'The sword was a baguette', '{actor} takes a bite of the {object}. It was Act Three\'s sword.', ['feast', 'sword'], { warmth: 1, chaos: 7 }, 'the_eaten_prop', 'drop_prop'),
  M('snack_minor', 'eats_the_props', 'feast', 'minor', 'A nibble of scenery', '{actor} appears to be chewing the {object}.', ['feast'], { warmth: 1, chaos: 2 }, 'the_eaten_prop', 'drop_prop'),
  M('stage_lost', 'never_been_on_stage', 'freeze', 'major', 'Gus finds the stage', '{actor} steps on stage for the first time and stares at the lights as if they might answer.', ['speech', 'song'], { warmth: -2, chaos: 7 }, 'the_first_time', 'freeze'),
  M('death_long', 'over_commits_to_death', 'corpse', 'major', 'The four-minute death', '{actor} is dying. Is still dying. Has begun to take requests.', ['death', 'murder'], { warmth: -1, chaos: 8 }, 'the_long_death', 'collapse'),
  M('death_minor', 'over_commits_to_death', 'corpse', 'minor', 'An extended farewell', '{actor} dies once, then again for those at the back.', ['death'], { warmth: 1, chaos: 2 }, 'the_long_death', 'collapse'),
  M('scottish_play', 'cannot_say_the_word_macbeth', 'wrong_play', 'major', 'The Scottish Play, announced', '{actor} says the word. Somewhere, a bell tolls. {other} checks the candles.', ['ghost', 'crown'], { warmth: -2, chaos: 9 }, 'the_scottish_play', 'shake'),
  M('act_two', 'only_knows_act_two', 'wrong_play', 'major', 'We are, apparently, in act two', '{actor} delivers a reunion speech in the middle of the first scene. It is moving. It is wrong.', ['reunion', 'secret'], { warmth: -1, chaos: 8 }, 'the_wrong_act', 'flip'),
];

const opt = (id, label, hint, warmth, chaos, adds_tag, chain, line) => ({ id, label, hint, effects: { warmth, chaos }, adds_tag, chain, line });
const std = (a, b, c) => ({ options: [opt('lean_in', 'Yes, and...', 'Make it part of the play.', 4, 6, a, true, '(whispering) It is a tragedy of the angle, darling. Commit.'), opt('cover_up', 'Cover it up', 'Pretend nothing happened.', -1, -8, null, false, '(whispering) Nothing is happening. Smile.'), opt('blame', b, c, 2, 2, 'goose', false, '(whispering) Blame the goose. It will not mind.')] });
export const WHISPERS = [
  { kind: 'collapse', ...std('slapstick', 'Blame the goose', 'A classic.') },
  { kind: 'apology', ...std('pun', 'Blame the nerves', 'He is terribly sorry.') },
  { kind: 'prop', ...std('slapstick', 'Blame the props table', 'Mrs. Gasket will not mind.') },
  { kind: 'upstage', ...std('speech', 'Blame the moon', 'It has been looking smug.') },
  { kind: 'rhyme', ...std('rhyme', 'Blame the muse', 'She is out of the room.') },
  { kind: 'exit', ...std('door', 'Blame the architect', 'There was never a fourth door.') },
  { kind: 'freeze', ...std('chandelier', 'Blame the draught', 'There is always a draught.') },
  { kind: 'cry', ...std('mourning', 'Blame the onions', 'There are onions in act two.') },
  { kind: 'corpse', ...std('death', 'Blame the rigor', 'It is not mortis. It is giggling.') },
  { kind: 'feast', ...std('feast', 'Blame the interval', 'It was almost time for biscuits.') },
  { kind: 'wrong_play', ...std('lie', 'Blame the script', 'It was handed over in a hurry.') },
  { kind: 'flirt', ...std('romance', 'Blame the lighting', 'It is very flattering.') },
  { kind: 'generic', ...std('slapstick', 'Blame the goose', 'A classic.') },
];

export const CUES = [
  { id: 'lights', label: 'Lights up', emoji: '💡', uses: 2, fits: ['romance', 'reunion', 'song', 'dance'], effects: { warmth: 4, chaos: -3 }, misfire: { warmth: -2, chaos: 3 }, misfire_text: 'The lights go up on a scene change. Everybody sees the ladder.', anim: 'spot' },
  { id: 'thunder', label: 'Thunder sheet', emoji: '⛈', uses: 2, fits: ['storm', 'death', 'murder', 'ghost', 'betrayal'], effects: { warmth: 5, chaos: -4 }, misfire: { warmth: -3, chaos: 4 }, misfire_text: 'Thunder, at a wedding. Someone\'s aunt faints.', anim: 'lightning' },
  { id: 'trapdoor', label: 'Trapdoor', emoji: '🕳', uses: 1, fits: ['door', 'secret', 'chase', 'slapstick', 'disguise'], effects: { warmth: 5, chaos: -2 }, misfire: { warmth: -3, chaos: 6 }, misfire_text: 'The trapdoor opens under the wrong puppet. He is thrilled.', anim: 'drop' },
  { id: 'fog', label: 'Fog machine', emoji: '🌫', uses: 2, fits: ['ghost', 'mask', 'mirror', 'mourning', 'secret'], effects: { warmth: 3, chaos: -6 }, misfire: { warmth: -2, chaos: 2 }, misfire_text: 'Fog fills the stage. Nobody can find the exit. Several never do.', anim: 'fog' },
  { id: 'spotlight', label: 'Spotlight', emoji: '🎯', uses: 2, fits: ['speech', 'song', 'trial', 'crown', 'rhyme'], effects: { warmth: 4, chaos: -4 }, misfire: { warmth: -2, chaos: 4 }, misfire_text: 'The spotlight finds the prompter. The prompter waves.', anim: 'spot' },
  { id: 'curtain', label: 'Half curtain', emoji: '🎭', uses: 1, fits: ['fire', 'feast', 'kiss', 'death'], effects: { warmth: 2, chaos: -9 }, misfire: { warmth: -4, chaos: 1 }, misfire_text: 'The curtain falls on the best bit. Boos. Gentle ones.', anim: 'curtain' },
];

const V = (id, logline, tags, props, lines) => ({ id, logline, tags, props, lines: lines.map(([role, text]) => ({ role, text })) });
export const GENRES = [
  {
    id: 'melodrama', name: 'Melodrama', blurb: 'Moustaches, wills, and a train nobody expected.', palette: { sky: '#e9b0a0', flat: '#8a2a3e', floor: '#2a1630', accent: '#e9b949' },
    roles: { lead: 'The Wronged Heroine', villain: 'The Moustachioed Landlord', fool: 'The Faithful Servant' },
    skill_by_beat: { setup: 'drama', complication: 'menace', reversal: 'drama', twist: 'menace', finale: 'drama' },
    sets: { setup: 'parlour', complication: 'moor', reversal: 'castle', twist: 'stairs', finale: 'ballroom' },
    beats: {
      setup: [V('melo_setup_1', 'The heroine learns the mortgage is due, and the landlord is very, very polite.', ['letter', 'betrayal'], ['letter'], [['lead', 'This letter says I must pay by midnight, {villain}.'], ['villain', 'Dreadful news. I am only the messenger. And the landlord. And the moustache.'], ['fool', 'I am {fool}. I carry the messages. I am also on fire, slightly.']])],
      complication: [V('melo_comp_1', 'A storm, a railway line, and a will that has been moved.', ['storm', 'chase', 'secret'], ['trunk'], [['lead', 'The train! It stops for no one, {villain}!'], ['villain', 'I stop for tea. Briefly. Then I stop for no one.'], ['fool', 'The will is in the trunk. The trunk is on the train. The train is leaving.']])],
      reversal: [V('melo_rev_1', 'The villain\'s mother arrives and takes the heroine\'s side.', ['reunion', 'mask', 'lie'], ['mask'], [['villain', 'Mother! You were meant to be in the Alps.'], ['lead', 'She brought the deeds. And a casserole.'], ['fool', 'I knew it. I always knew it. I did not know it.']])],
      twist: [V('melo_twist_1', 'The will is read: the theatre belongs to whoever is holding the goose.', ['goose', 'death', 'trial'], ['goose'], [['fool', 'I am holding the goose.'], ['villain', 'Surely not the whole goose.'], ['lead', 'Honk, said the will. Honk, said the law.']])],
      finale: [V('melo_final_1', 'A grand reconciliation on a staircase that does not go anywhere.', ['stairs', 'reunion', 'song', 'speech'], ['ladder'], [['lead', 'Forgiveness is a staircase, {villain}.'], ['villain', 'It is also a ladder. I am sorry about the ladder.'], ['fool', 'Everyone sing. Nobody knows the words. Sing anyway.']])],
    },
  },
  {
    id: 'farce', name: 'Farce', blurb: 'Doors. So many doors.', palette: { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' },
    roles: { lead: 'The Flustered Hero', villain: 'The Scheming Landlord', fool: 'The Wrong Man' },
    skill_by_beat: { setup: 'comedy', complication: 'physical', reversal: 'improv', twist: 'comedy', finale: 'physical' },
    sets: { setup: 'parlour', complication: 'corridor', reversal: 'bedroom', twist: 'cellar', finale: 'parlour' },
    beats: {
      setup: [V('farce_setup_1', 'Everyone arrives at the same house for different, incompatible reasons.', ['door', 'mistaken_identity'], ['door'], [['lead', 'I\'m only here to return this umbrella to {villain}!'], ['villain', 'Nobody returns an umbrella. Who sent you? Was it {fool}?'], ['fool', 'I am {fool}. I am also, I think, the umbrella.']])],
      complication: [V('farce_comp_1', 'Three bedrooms, one key, and a chase that will not end politely.', ['chase', 'door', 'slapstick'], ['door', 'ladder'], [['lead', 'In here! No, not there! Is that a cupboard?'], ['villain', 'That is my wife\'s cupboard. And my wife.'], ['fool', 'I have the key. Which one. It\'s a lot of keys.']])],
      reversal: [V('farce_rev_1', 'The wrong man turns out to be the right man in the wrong wig.', ['disguise', 'mistaken_identity', 'mask'], ['mask'], [['fool', 'I am not who I am. I am who you think I am.'], ['lead', 'That is exactly who I thought you were not.'], ['villain', 'Everybody stop being each other.']])],
      twist: [V('farce_twist_1', 'The cellar door opens and the whole cast falls into the same scene.', ['door', 'slapstick', 'secret'], ['trunk', 'door'], [['villain', 'This is a private cellar.'], ['lead', 'This is a very public cellar.'], ['fool', 'Hello. I live here. Since Tuesday.']])],
      finale: [V('farce_final_1', 'Every door opens at once and everyone is exactly where they should not be.', ['door', 'chase', 'wedding'], ['door'], [['lead', 'Marry me, whoever you are!'], ['villain', 'I am already married to the cupboard.'], ['fool', 'Fine. Everybody marry the nearest door.']])],
    },
  },
  {
    id: 'whodunit', name: 'Whodunit', blurb: 'The butler did it. The goose saw everything.', palette: { sky: '#9aa9c4', flat: '#3f4a63', floor: '#1d1b26', accent: '#e0a82e' },
    roles: { lead: 'The Detective', villain: 'The Suspicious Host', fool: 'The Butler (Obviously)' },
    skill_by_beat: { setup: 'drama', complication: 'improv', reversal: 'menace', twist: 'drama', finale: 'improv' },
    sets: { setup: 'library', complication: 'garden', reversal: 'attic', twist: 'library', finale: 'ballroom' },
    beats: {
      setup: [V('who_setup_1', 'A dinner party, a toast, and a host who has not been seen since the soup.', ['feast', 'death', 'goose'], ['cake', 'teapot'], [['lead', 'Nobody leave. The soup was suspicious.'], ['villain', 'I am the host. I am extremely alive. Please do not check.'], ['fool', 'I did not do it. Nobody asked. That is suspicious.']])],
      complication: [V('who_comp_1', 'A footprint in the garden leads to a second, larger footprint.', ['secret', 'chase', 'letter'], ['lantern'], [['lead', 'Two footprints. One owner. Unless the owner is two.'], ['villain', 'The garden is private. Also, haunted.'], ['fool', 'I only dig at night. For the roses.']])],
      reversal: [V('who_rev_1', 'The detective turns out to be the person the detective was looking for.', ['mirror', 'mistaken_identity', 'lie'], ['mirror'], [['lead', 'The culprit is in this room. And it is... I need a mirror.'], ['villain', 'Do not look in the mirror.'], ['fool', 'Madam, you are the culprit. Sir, you are the madam.']])],
      twist: [V('who_twist_1', 'The goose finally speaks, and it is entirely in rhyme.', ['goose', 'rhyme', 'speech'], ['goose'], [['fool', 'The goose has something to say.'], ['lead', 'Then let the goose indict.'], ['villain', 'Honk. That was a confession. That was mine.']])],
      finale: [V('who_final_1', 'Everyone is revealed as the culprit, one by one, politely.', ['trial', 'speech', 'betrayal'], ['book'], [['lead', 'You, you, and you. And, of course, the butler.'], ['fool', 'I would like to say I am innocent. I would like to.'], ['villain', 'Case closed. Tea?']])],
    },
  },
  {
    id: 'gothic_romance', name: 'Gothic Romance', blurb: 'Moors, candles, brooding.', palette: { sky: '#6a5a86', flat: '#3b2748', floor: '#14101c', accent: '#b8a1e3' },
    roles: { lead: 'The Brooding Heir', villain: 'The Governess Who Knows Too Much', fool: 'The Ghost Who Is Very Lost' },
    skill_by_beat: { setup: 'romance', complication: 'menace', reversal: 'romance', twist: 'drama', finale: 'romance' },
    sets: { setup: 'moor', complication: 'castle', reversal: 'graveyard', twist: 'attic', finale: 'castle' },
    beats: {
      setup: [V('goth_setup_1', 'A carriage, a moor, and a window with a light that should not be there.', ['storm', 'romance', 'door'], ['lantern'], [['lead', 'There is a light in the tower window, {villain}.'], ['villain', 'There is always a light. It is just very committed.'], ['fool', 'Ooooo. Sorry. Wrong house. Ooooo.']])],
      complication: [V('goth_comp_1', 'Candles go out, in order, in a draught that has opinions.', ['ghost', 'fire', 'secret'], ['candle'], [['villain', 'The candles are going out. I am only watching.'], ['lead', 'I feel a presence. It is wearing my cravat.'], ['fool', 'It is me. I am the presence. I am sorry about the cravat.']])],
      reversal: [V('goth_rev_1', 'The portrait on the stairs winks, then confesses.', ['mirror', 'letter', 'betrayal'], ['book'], [['lead', 'The portrait spoke!'], ['villain', 'The portrait speaks frequently. It is mostly complaints.'], ['fool', 'It says the heir is not the heir. I am the heir. Probably.']])],
      twist: [V('goth_twist_1', 'A grave, a hidden letter, and a proposal from a ghost.', ['death', 'romance', 'ghost'], ['skull', 'bouquet'], [['fool', 'Will you marry me, in the sense of eternity?'], ['lead', 'I will consider it. After the funeral.'], ['villain', 'I object. I am the governess. I object to everything.']])],
      finale: [V('goth_final_1', 'Dawn comes, the moor clears, and the house has been, all along, a hat.', ['reunion', 'wedding', 'song'], ['moon'], [['lead', 'The sun! I had forgotten it was a hat.'], ['villain', 'I always said so. Quietly.'], ['fool', 'Wooo. Hurrah. I mean: boo. Hurrah.']])],
    },
  },
  {
    id: 'pantomime', name: 'Pantomime', blurb: '"He\'s behind you!" Dames, audience participation, custard.', palette: { sky: '#f7c8d8', flat: '#c0566e', floor: '#4a2b3a', accent: '#81b29a' },
    roles: { lead: 'The Principal Boy', villain: 'The Wicked Baron', fool: 'The Dame' },
    skill_by_beat: { setup: 'comedy', complication: 'physical', reversal: 'improv', twist: 'comedy', finale: 'physical' },
    sets: { setup: 'garden', complication: 'castle', reversal: 'stage', twist: 'harbour', finale: 'ballroom' },
    beats: {
      setup: [V('panto_setup_1', 'The Dame sells custard in the village square, and everybody boos the Baron.', ['pun', 'feast', 'song'], ['cake'], [['fool', 'Custard! Fresh custard! Slightly warm!'], ['villain', 'I am the Baron. You may boo.'], ['lead', 'Do not boo! Well. A little. Go on, then.']])],
      complication: [V('panto_comp_1', 'The Baron chases the Principal Boy through a castle made of cardboard.', ['chase', 'slapstick', 'door'], ['door', 'ladder'], [['villain', 'Come back, boy! I only want to ruin you!'], ['lead', 'He\'s behind me, isn\'t he?'], ['fool', 'HE\'S BEHIND YOU! No, the other behind.']])],
      reversal: [V('panto_rev_1', 'The audience is asked to choose a side and chooses both.', ['song', 'pun', 'dance'], ['banner'], [['fool', 'Who wants the Baron to win? Anyone? Mrs Brown?'], ['lead', 'Mrs Brown has said yes.'], ['villain', 'Mrs Brown, I am deeply moved. Do sit down.']])],
      twist: [V('panto_twist_1', 'The giant custard pie arrives, as promised, as threatened.', ['slapstick', 'feast', 'pun'], ['cake'], [['villain', 'Not the custard. Anything but the custard.'], ['fool', 'Oh yes. Oh yes it is.'], ['lead', 'Oh no it isn\'t. Oh, it is.']])],
      finale: [V('panto_final_1', 'A grand sing-along and a wedding for everybody, including the Baron.', ['wedding', 'song', 'dance', 'rhyme'], ['bouquet'], [['lead', 'Everybody sing! The words are on the banner!'], ['fool', 'The banner says: hello. Sing hello.'], ['villain', 'Fine. Hello. Happily ever. Hello.']])],
    },
  },
];

export const TOWNS = [
  { id: 'marshwick', name: 'Marshwick-on-Mire', blurb: 'Damp. Proud of it.', sky: 'dusk', landmark: 'windmill', temperament: { likes: ['pun', 'goose'], hates: ['death', 'fire'], expects: 'the_wrong_door', openness: 0.4 }, audience: { mix: ['pun_lover', 'tearful_aunt', 'man_who_hates_death'], hat_bias: 'bonnet' }, gossip: 'They still talk about the time a swan was cast as the vicar.' },
  { id: 'tickleton', name: 'Tickleton Magna', blurb: 'Laughs first, asks questions never.', sky: 'noon', landmark: 'clocktower', temperament: { likes: ['slapstick', 'chase'], hates: ['mourning', 'ghost'], expects: 'the_eaten_prop', openness: 0.7 }, audience: { mix: ['child_in_the_front', 'snack_vendor', 'goose_fancier'], hat_bias: 'fez' }, gossip: 'The clock has been four minutes slow since the great custard riot.' },
  { id: 'dimmock', name: 'Dimmock Lighthouse', blurb: 'One lamp, many opinions.', sky: 'night', landmark: 'lighthouse', temperament: { likes: ['storm', 'romance'], hates: ['slapstick', 'goose'], expects: 'the_lean', openness: 0.3 }, audience: { mix: ['romantic', 'skeptic', 'retired_actor'], hat_bias: 'top' }, gossip: 'The keeper reviews everything from memory, in rhyme, to the gulls.' },
  { id: 'gloomhold', name: 'Gloomhold Castle', blurb: 'Draughty. Dignified. Damp in places.', sky: 'storm', landmark: 'castle', temperament: { likes: ['crown', 'speech'], hates: ['pun', 'dance'], expects: 'the_chandelier', openness: 0.25 }, audience: { mix: ['mayor', 'skeptic', 'critic_in_disguise'], hat_bias: 'crown' }, gossip: 'The mayor has attended every opening since 1911 and enjoyed none.' },
  { id: 'cobbleford', name: 'Cobbleford Bridge', blurb: 'A town you cross rather than visit.', sky: 'dawn', landmark: 'bridge', temperament: { likes: ['reunion', 'song'], hates: ['betrayal', 'murder'], expects: 'the_couplet', openness: 0.6 }, audience: { mix: ['tearful_aunt', 'romantic', 'sleepy_farmer'], hat_bias: 'flat' }, gossip: 'Every wedding here has been interrupted by the same goose, politely.' },
  { id: 'soot_end', name: 'Soot End', blurb: 'Eight chimneys, one opinion.', sky: 'dusk', landmark: 'chimneys', temperament: { likes: ['chase', 'treasure'], hates: ['romance', 'wedding'], expects: 'the_corpse', openness: 0.45 }, audience: { mix: ['snack_vendor', 'skeptic', 'man_who_hates_death'], hat_bias: 'flat' }, gossip: 'They applaud with their boots. Be ready.' },
  { id: 'spire_on_hill', name: 'Spire-on-the-Hill', blurb: 'Pious, punctual, and fond of a good ghost.', sky: 'noon', landmark: 'spire', temperament: { likes: ['ghost', 'mourning'], hates: ['feast', 'poison'], expects: 'the_watering_can', openness: 0.5 }, audience: { mix: ['tearful_aunt', 'sleepy_farmer', 'mayor'], hat_bias: 'bonnet' }, gossip: 'The bell rings whenever someone says the Scottish Play. It is rung often.' },
  { id: 'dockside', name: 'Dockside Quay', blurb: 'Gulls, rope, and an unreasonable amount of fish.', sky: 'storm', landmark: 'crane', temperament: { likes: ['sword', 'treasure'], hates: ['mask', 'letter'], expects: 'the_moon_dispute', openness: 0.55 }, audience: { mix: ['goose_fancier', 'snack_vendor', 'child_in_the_front'], hat_bias: 'none' }, gossip: 'Sailors here boo like they mean it, then cry in the car park.' },
  { id: 'pier_pressure', name: 'Pier Pressure', blurb: 'The sea is a great deal closer than it looks.', sky: 'dawn', landmark: 'pier', temperament: { likes: ['dance', 'rhyme'], hates: ['death', 'trial'], expects: 'the_sneeze', openness: 0.65 }, audience: { mix: ['pun_lover', 'romantic', 'retired_actor'], hat_bias: 'feather' }, gossip: 'The third plank from the end is a trapdoor. Nobody knows who put it there.' },
  { id: 'silo_vale', name: 'Silo Vale', blurb: 'Grain, gossip, and an echo that edits.', sky: 'noon', landmark: 'silo', temperament: { likes: ['feast', 'song'], hates: ['storm', 'sword'], expects: 'the_first_time', openness: 0.5 }, audience: { mix: ['sleepy_farmer', 'child_in_the_front', 'mayor'], hat_bias: 'flat' }, gossip: 'The echo repeats the second half of every line. It improves some.' },
  { id: 'wibbling_opera', name: 'The Royal Opera House of Wibbling', blurb: 'Plush. Gilt. Faintly terrified of geese.', sky: 'night', landmark: 'spire', temperament: { likes: ['song', 'crown', 'speech'], hates: ['goose', 'slapstick'], expects: 'the_chandelier', openness: 0.2 }, audience: { mix: ['critic_in_disguise', 'mayor', 'retired_actor'], hat_bias: 'top' }, gossip: 'A critic sits in the royal box every night. Nobody has seen their face. The pigeons know.' },
];

const T = (id, name, hat, coat, likes, hates, laugh, cry, gasp, boo) => ({ id, name, hat, palette: { coat, skin: '#e8c9a0' }, likes, hates, laugh, cry, gasp, boo });
export const TASTES = [
  T('pun_lover', 'The Pun Enthusiast', 'bonnet', '#6d597a', ['pun', 'rhyme'], ['death'], 0.8, 0.2, 0.4, 0.1),
  T('tearful_aunt', 'The Tearful Aunt', 'bonnet', '#b56576', ['reunion', 'mourning', 'wedding'], ['slapstick'], 0.3, 0.9, 0.5, 0.1),
  T('man_who_hates_death', 'The Man Who Hates Death', 'top', '#355070', ['feast', 'dance'], ['death', 'murder', 'poison'], 0.4, 0.1, 0.3, 0.7),
  T('child_in_the_front', 'The Child in the Front', 'none', '#e56b6f', ['goose', 'slapstick', 'chase'], ['speech'], 0.95, 0.1, 0.8, 0.1),
  T('retired_actor', 'The Retired Actor', 'feather', '#6d6875', ['speech', 'crown', 'song'], ['slapstick', 'pun'], 0.3, 0.4, 0.3, 0.6),
  T('critic_in_disguise', 'The Critic in Disguise', 'fez', '#3d405b', ['trial', 'speech'], ['goose', 'slapstick'], 0.2, 0.2, 0.3, 0.7),
  T('sleepy_farmer', 'The Sleepy Farmer', 'flat', '#81b29a', ['feast', 'song'], ['storm'], 0.5, 0.3, 0.2, 0.2),
  T('goose_fancier', 'The Goose Fancier', 'bow', '#f2cc8f', ['goose', 'feast'], ['sword'], 0.7, 0.2, 0.5, 0.2),
  T('romantic', 'The Romantic', 'bonnet', '#e07a5f', ['romance', 'kiss', 'reunion'], ['betrayal'], 0.4, 0.8, 0.5, 0.2),
  T('skeptic', 'The Skeptic', 'top', '#4a4e69', ['trial', 'mirror'], ['mask', 'ghost'], 0.2, 0.1, 0.2, 0.8),
  T('snack_vendor', 'The Snack Vendor', 'flat', '#d4a373', ['feast', 'treasure'], ['fire'], 0.6, 0.2, 0.4, 0.3),
  T('mayor', 'The Mayor', 'crown', '#7b2d26', ['crown', 'speech'], ['pun', 'goose'], 0.3, 0.2, 0.4, 0.5),
];

export const CRITICS = [
  { id: 'pompous', name: 'Sir Coo-Lambert Pidgeon', outlet: 'The Wibbling Gazette', style: 'pompous', weights: { quality: 0.6, lead: 0.1, warmth: 0.1, charm_chaos: 0, tradition: 0.1, snacks: 0 }, bias: -0.3, noise: 0.4, templates: { 5: ['A technical marvel. I wept, discreetly, into my ledger.'], 4: ['{lead} was almost correct. I am almost pleased.'], 3: ['Competent, in the way a clock is competent.'], 2: ['{mishap} was, I trust, not meant. I trust nothing.'], 1: ['I have seen better acting from a coat stand.'] } },
  { id: 'wounded_parent', name: 'Mrs. Dove-Tailor', outlet: 'The Parish Pigeon', style: 'proud', weights: { quality: 0.1, lead: 0.6, warmth: 0.2, charm_chaos: 0.05, tradition: 0.05, snacks: 0 }, bias: 0.4, noise: 0.3, templates: { 5: ['{lead} was radiant. I am telling everyone. I am telling you.'], 4: ['{lead} was lovely. {villain} could have smiled more.'], 3: ['{lead} did their best, and that is a kind of review.'], 2: ['I looked away during {mishap}. Please tell {lead} I clapped.'], 1: ['I am not speaking to the director.'] } },
  { id: 'snacks', name: 'Biscuit Crumbworth', outlet: 'The Interval Crumb', style: 'peckish', weights: { quality: 0.1, lead: 0, warmth: 0.2, charm_chaos: 0.2, tradition: 0, snacks: 0.5 }, bias: 0, noise: 0.5, templates: { 5: ['The {snack} was transcendent. The play was around it.'], 4: ['A fine {snack} and a decent show. In that order.'], 3: ['The {snack} was adequate. So was everything.'], 2: ['The {snack} arrived cold. So did the second act.'], 1: ['There was no {snack}. I stayed for the principle.'] } },
  { id: 'chaos_gourmand', name: 'Cleo Peckham-Rye', outlet: 'The Mayhem Monthly', style: 'gleeful', weights: { quality: 0.1, lead: 0.1, warmth: 0.1, charm_chaos: 0.6, tradition: 0.1, snacks: 0 }, bias: 0.1, noise: 0.35, templates: { 5: ['{mishap}! Glorious! I have not stopped cackling.'], 4: ['Delightfully close to ruin. {mishap} was a gift.'], 3: ['Nearly chaotic. Nearly. Try harder.'], 2: ['Too tidy by half. Where was the doom?'], 1: ['Nothing went wrong. Nothing. Unforgivable.'] } },
  { id: 'sentimentalist', name: 'Dolores Sniffle', outlet: 'The Tear-Stained Times', style: 'weepy', weights: { quality: 0.1, lead: 0.1, warmth: 0.4, charm_chaos: 0, tradition: 0.4, snacks: 0 }, bias: 0.2, noise: 0.3, templates: { 5: ['I wept. I wept again. {tradition} undid me entirely.'], 4: ['Tender, and only slightly damp. Bravo, {lead}.'], 3: ['A few tears. Mostly mine. Mostly sniffle.'], 2: ['I wanted to love it. {mishap} had other plans.'], 1: ['Cold, cold, cold. I wore my scarf indoors.'] } },
];

export const PROPS = ['sword', 'chair', 'candle', 'door', 'umbrella_stand', 'letter', 'mask', 'mirror', 'crown', 'chandelier', 'goose', 'cake', 'ghost_sheet', 'trunk', 'skull', 'bouquet', 'ladder', 'teapot', 'lantern', 'tree', 'bed', 'clock', 'harp', 'trophy', 'bottle', 'book', 'rope', 'banner', 'fish', 'moon'].map((d) => ({ id: d, name: d.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), tags: [], draw: d }));

export const ROAD_EVENTS = [
  { id: 'goose_on_the_bridge', title: 'A goose holds the bridge', text: 'A goose stands in the middle of the road. It has the air of a toll collector.', weight: 2, choices: [{ id: 'bribe', label: 'Offer bread (-1 fund)', effects: { funds: -1, rapport: { goose: 1 } } }, { id: 'detour', label: 'Take the long way', effects: { funds: 0, morale: -1 } }] },
  { id: 'lost_wheel', title: 'The wagon loses a wheel', text: 'The wheel rolls on ahead. It has somewhere to be.', weight: 2, choices: [{ id: 'repair', label: 'Repair it (-2 funds)', effects: { funds: -2, morale: 1 } }, { id: 'sing', label: 'Sing until it comes back', effects: { funds: 0, rapport: { mabel: 1 } } }] },
  { id: 'rainbow', title: 'A suspicious rainbow', text: 'It ends in a ditch. In the ditch, a coin purse. In the purse, a note: "Sorry."', weight: 1, choices: [{ id: 'take', label: 'Take the purse (+2 funds)', effects: { funds: 2 } }, { id: 'leave', label: 'Leave it. Rainbows have teeth.', effects: { encore: 1 } }] },
  { id: 'fan', title: 'A fan waits at the crossroads', text: 'He has brought a hat for every puppet. None fit. All are appreciated.', weight: 2, choices: [{ id: 'sign', label: 'Sign the hats', effects: { rapport: { hortensia: 1 } } }, { id: 'sell', label: 'Sell the hats (+1 fund)', effects: { funds: 1 } }] },
  { id: 'quiet', title: 'A perfectly quiet night', text: 'Nothing happens. The puppets sit in a row and watch the stars. It is deeply suspicious.', weight: 1, choices: [{ id: 'rest', label: 'Rest', effects: { funds: 0, rapport: { gus: 1 } } }, { id: 'rehearse', label: 'Rehearse by lantern', effects: { candles: 1 } }] },
];

export const ALMANAC_SEEDS = [
  { id: 'legend_001', text: 'In Marshwick, the chair has fallen at every performance since 1904.', calamity: 'the_wrong_door', town: 'marshwick' },
  { id: 'legend_002', text: 'In Tickleton, a goose once ate the ending. The town has never been so happy.', calamity: 'the_eaten_prop', town: 'tickleton' },
  { id: 'legend_003', text: 'At Dimmock, the lean is considered a local dance, and has a name.', calamity: 'the_lean', town: 'dimmock' },
  { id: 'legend_004', text: 'The Gloomhold chandelier has dropped on three kings and one very apologetic tenor.', calamity: 'the_chandelier', town: 'gloomhold' },
  { id: 'legend_005', text: 'Cobbleford keeps a collection of every couplet the actors could not stop.', calamity: 'the_couplet', town: 'cobbleford' },
  { id: 'legend_006', text: 'Soot End is quite sure the corpse is still laughing.', calamity: 'the_corpse', town: 'soot_end' },
  { id: 'legend_007', text: 'Spire-on-the-Hill rings the bell whenever the Scottish Play is named.', calamity: 'the_scottish_play', town: 'spire_on_hill' },
  { id: 'legend_008', text: 'On Pier Pressure, a sneeze once tipped the lantern and everyone else into the sea.', calamity: 'the_sneeze', town: 'pier_pressure' },
  { id: 'legend_009', text: 'Silo Vale remembers the night Gus found the stage and refused to leave.', calamity: 'the_first_time', town: 'silo_vale' },
  { id: 'legend_010', text: 'Dockside swears the moon was upstaged twice and has sulked since.', calamity: 'the_moon_dispute', town: 'dockside' },
  { id: 'legend_011', text: 'A watering can in Spire-on-the-Hill has been quietly weeping since the Reformation.', calamity: 'the_watering_can', town: 'spire_on_hill' },
  { id: 'legend_012', text: 'The long death of Wibbling is now in the school curriculum.', calamity: 'the_long_death', town: 'wibbling_opera' },
  { id: 'legend_013', text: 'Reginald\'s apology at Gloomhold was accepted. It took nine years.', calamity: 'the_apology', town: 'gloomhold' },
  { id: 'legend_014', text: 'The wrong act has been performed in Tickleton so often it is now the right act.', calamity: 'the_wrong_act', town: 'tickleton' },
];

export const PLAYBILL = {
  bio: { openers: ['trained at', 'once understudied for', 'rose to fame beside', 'was discovered inside'], trained_at: ['the Royal Academy of Looking Out Windows', 'a very small tent', 'the Society for Dramatic Sighing', 'a cupboard of some distinction'], credits: ['Credits include a vicar, a bridge, and a minor storm.', 'Credits include several walls.'], quirks: ['Dislikes drafts.', 'Will not share a spotlight.', 'Carries a spare string, just in case.'] },
  headings: ['Tonight', 'The Players', 'Previously', 'The Traditions'],
  back_page: ['Please do not feed the puppets. They will remember.', 'Refreshments available. Cake has been withdrawn. We know why.'],
  tonight_in: ['Tonight in {town}:'],
  previously: ['Previously: a goose, an altar, and an apology.'],
};

export const GRAPH_META = [
  { id: 'casting_call', title: 'Casting Call', blurb: 'Auditions in parallel; Madame recommends; you confirm the cast.', features: ['Send map-reduce', 'reducers', 'defer', 'supervisor', 'interrupt'] },
  { id: 'writers_room', title: "The Writers' Room", blurb: 'Three heron playwrights draft the night\'s play; you pick.', features: ['Send x3', 'evaluator loop', 'defer', 'interrupt'] },
  { id: 'performance', title: 'The Show', blurb: 'Madame directs, puppets act, you prompt from the box.', features: ['Command(goto)', 'subgraph per beat', 'interrupt', 'Send x12', 'RetryPolicy', 'custom + messages streaming', 'time travel'] },
  { id: 'reviews', title: 'The Reviews', blurb: 'Five pigeon critics weigh the evening.', features: ['Send x5', 'custom reducer', 'defer', 'token streaming', 'Store'] },
  { id: 'almanac', title: 'The Almanac', blurb: 'Every calamity is remembered. Enshrine a Tradition.', features: ['Store', 'semantic search', 'interrupt'] },
  { id: 'the_road', title: 'The Road', blurb: 'The wagon trundles to the next town.', features: ['durable execution', 'durability=sync', 'crash recovery', 'interrupt'] },
  { id: 'playbill_press', title: 'The Playbill Press', blurb: 'Prints the programme.', features: ['Functional API', '@entrypoint', '@task', 'previous'] },
  { id: 'greenroom_chat', title: 'The Greenroom', blurb: 'Chat with a puppet backstage.', features: ['create_agent', 'middleware', 'tool-call review', 'Store'] },
  { id: 'rehearsal', title: 'Rehearsal', blurb: 'Twelve imaginary nights.', features: ['Send x12', 'eval vs gold'] },
];

/** xray-style graph JSON per graph: [nodeIds], [edges], conditional marked with a third element. Inner ids use "parent:child". */
export const GRAPH_SHAPES = {
  casting_call: { nodes: ['load', 'audition', 'rank', 'recommend', 'confirm_cast', 'done'], edges: [['__start__', 'load'], ['load', 'audition', 'c'], ['audition', 'rank'], ['rank', 'recommend'], ['recommend', 'confirm_cast'], ['confirm_cast', 'done'], ['done', '__end__']] },
  writers_room: { nodes: ['brief', 'quills', 'judge', 'revise', 'pick_draft', 'finalize'], edges: [['__start__', 'brief'], ['brief', 'quills', 'c'], ['quills', 'judge'], ['judge', 'revise', 'c'], ['judge', 'pick_draft', 'c'], ['revise', 'quills'], ['pick_draft', 'finalize'], ['finalize', '__end__']] },
  performance: {
    nodes: ['curtain_up', 'beat:direct', 'beat:perform', 'beat:prompters_box', 'beat:resolve', 'beat:audience', 'beat:tally', 'next_beat', 'curtain_call'],
    edges: [['__start__', 'curtain_up'], ['curtain_up', 'beat:direct'], ['beat:direct', 'beat:perform'], ['beat:perform', 'beat:prompters_box', 'c'], ['beat:perform', 'beat:resolve', 'c'], ['beat:prompters_box', 'beat:resolve'], ['beat:resolve', 'beat:audience', 'c'], ['beat:audience', 'beat:tally'], ['beat:tally', 'next_beat'], ['next_beat', 'beat:direct', 'c'], ['next_beat', 'curtain_call', 'c'], ['curtain_call', '__end__']],
  },
  reviews: { nodes: ['gather', 'critics', 'reduce', 'headline', 'file_review'], edges: [['__start__', 'gather'], ['gather', 'critics', 'c'], ['critics', 'reduce'], ['reduce', 'headline'], ['headline', 'file_review'], ['file_review', '__end__']] },
  almanac: { nodes: ['ingest', 'detect', 'curate', 'enshrine', 'recall'], edges: [['__start__', 'ingest'], ['ingest', 'detect'], ['detect', 'curate', 'c'], ['detect', 'recall', 'c'], ['curate', 'enshrine'], ['enshrine', 'recall'], ['recall', '__end__']] },
  the_road: { nodes: ['depart', 'weather', 'roll_event', 'crossroads', 'apply', 'power_cut', 'arrive'], edges: [['__start__', 'depart'], ['depart', 'weather'], ['weather', 'roll_event'], ['roll_event', 'crossroads', 'c'], ['roll_event', 'apply', 'c'], ['crossroads', 'apply'], ['apply', 'power_cut', 'c'], ['apply', 'arrive', 'c'], ['power_cut', 'arrive'], ['arrive', '__end__']] },
  playbill_press: { nodes: ['bios', 'traditions_page', 'review_wall', 'layout'], edges: [['__start__', 'bios'], ['__start__', 'traditions_page'], ['__start__', 'review_wall'], ['bios', 'layout'], ['traditions_page', 'layout'], ['review_wall', 'layout'], ['layout', '__end__']] },
  greenroom_chat: { nodes: ['model', 'tools'], edges: [['__start__', 'model'], ['model', 'tools', 'c'], ['model', '__end__', 'c'], ['tools', 'model']] },
  rehearsal: { nodes: ['plan', 'simulate', 'summarize'], edges: [['__start__', 'plan'], ['plan', 'simulate', 'c'], ['simulate', 'summarize'], ['summarize', '__end__']] },
};

export function xrayGraph(graphId) {
  const shape = GRAPH_SHAPES[graphId];
  if (!shape) return null;
  const ids = ['__start__', ...shape.nodes, '__end__'];
  return {
    nodes: ids.map((id) => ({ id, name: id.includes(':') ? id.split(':').pop() : id, type: 'runnable', data: { name: id } })),
    edges: shape.edges.map(([source, target, c]) => ({ source, target, conditional: c === 'c' || undefined })),
  };
}

/** Dataset catalogue + bodies (rows are the fixtures above). */
export function datasetTable() {
  const T = (name, rows, desc, object) => ({ name, rows: object ? 1 : rows.length, desc, data: rows, object: !!object });
  return [
    T('performers', PERFORMERS, 'The eight playable puppets: skills, stage fright, flaws and voices.'),
    T('staff', STAFF, 'Madame, three heron-playwrights, a tortoise, a spider and the moon.'),
    T('flaws', FLAWS, 'What goes wrong when a puppet meets a beat.'),
    T('mishaps', MISHAPS, 'Specific disasters, tagged and priced.'),
    T('whispers', WHISPERS, 'Three things to whisper for each kind of mishap.'),
    T('cues', CUES, 'Thunder sheets, trapdoors and other levers.'),
    T('genres', GENRES, 'Five genres and the story beats that make them.'),
    T('towns', TOWNS, 'Where the wagon goes, and what each town likes and hates.'),
    T('tastes', TASTES, 'Twelve kinds of audience member.'),
    T('critics', CRITICS, 'Five pigeon critics and their prejudices.'),
    T('props', PROPS, 'Everything in the cupboard.'),
    T('road_events', ROAD_EVENTS, 'Things that happen on the road between towns.'),
    T('almanac_seeds', ALMANAC_SEEDS, 'Local legends that seed the Almanac.'),
    T('playbill', PLAYBILL, 'Phrases the Playbill Press assembles into a programme.', true),
  ];
}
