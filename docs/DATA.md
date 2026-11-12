# Datasets

All datasets live in `datasets/` as `.json` (one object/array) or `.jsonl` (one object per line), are **generated
deterministically** by `python -m tragedy.data build` (content tables are authored in `src/tragedy/data/content/*.py`, and
procedural tables are derived from them and from seeds), are listed with sha256 in `datasets/MANIFEST.json`, and are
validated by `python -m tragedy.data check` (schemas below + tag vocabulary + referential integrity). Access them with
`tragedy.data.loader.load("name")`.

**Shared vocabulary** (`tragedy/data/tags.py`; using anything else fails `check`):

* `TAGS` (36): romance kiss wedding reunion betrayal secret mistaken_identity letter mask mirror death murder poison sword
  ghost mourning trial chase fire storm door stairs chair feast treasure crown goose song dance rhyme pun slapstick speech
  disguise lie chandelier
* `SKILLS` (6): drama comedy menace romance physical improv
* `ROLES` (3): lead villain fool
* `BEATS` (5): setup complication reversal twist finale
* `GENRES` (5): melodrama farce whodunit gothic_romance pantomime

Writing guidance: **deadpan, tender, calamitous** (Wes Anderson x Goose Game x Muppets). Specific beats generic. Every
string is shown to a player, so it must be funny or charming or both, and short (lines <= 140 chars unless noted).
Placeholders are `{curly}` and must be from the allowed set listed per dataset.

---

## 1. `performers.json` - array of 8 (the playable puppets)

```json
{"id":"mabel","name":"Mabel Tuckett","kind":"marionette","blurb":"Method actor. One string is too short, so she leans left.",
 "palette":{"body":"#c0566e","accent":"#f2c14e","hair":"#3b2a3a"},
 "build":{"head":"round","height":1.0,"arms":"long","costume":"gown","strings":5},
 "skills":{"drama":78,"comedy":40,"menace":22,"romance":74,"physical":35,"improv":52},
 "stage_fright":35,"roles":["lead"],"flaws":["leans_left","cries_by_watering_can"],
 "voice":{"tone":"breathless, theatrical","catchphrases":["I feel it in my left side."],"tics":["sighs at the wrong moment"]},
 "bio_seed":"trained at the Royal Academy of Looking Out Windows"}
```
`head` in {round, long, square, beak, sock, nutcracker, tin, shadow}; `costume` in {gown, coat, frock, uniform, rags, armour,
robe, wig}; `strings` 3-7. Required cast (ids): `mabel` (marionette, drama/romance lead), `reginald` (Sir Reginald Blort, hand
puppet, gentle villain who apologises), `gus` (the understudy: knows every part, never been on stage; roles `[]`, treated as 75
roleFit everywhere; flaw `never_been_on_stage`), `goose` (a goose in a wig, "the most convincing woman I've ever met"),
`hortensia` (sock-puppet diva), `bartleby` (Captain Bartleby Nutt, nutcracker soldier), `poppet` (rag-doll child prodigy),
`tock` (Mr. Tock, clockwork man). Each has 1-2 flaws from `flaws.json`, a spread of strengths (no puppet is best at everything),
and at least one `roles` entry for all but `gus`; across the roster every role must have >= 3 natural candidates.

## 2. `staff.json` - array (non-playable agents; they speak, they do not perform)

```json
{"id":"madame","name":"Madame Odalys Prunt","job":"director (supervisor agent)","kind":"hand","palette":{...},
 "voice":{"tone":"imperious, wounded","catchphrases":["Darling, no."]},"emoji":"🎩"}
```
Required ids: `madame` (director: "Darling, no."; lives off one good review from 1987), `quill_pompous`, `quill_frantic`,
`quill_tender` (the playwright heron Bartholomew Quill in three moods; `kind: "heron"`, plus `style`: a one-line writing
style used to rank drafts by the town's taste), `clipboard` (tortoise stage manager, speaks only in cue numbers),
`gasket` (Mrs. Gasket, clockwork spider, props; eight hands, always the wrong prop), `narrator` (the paper moon).

## 3. `flaws.json` - array of 24-30

```json
{"id":"leans_left","name":"Leans left","text":"One string is too short.","triggers":["romance","kiss","stairs","dance"],
 "intensity":0.45,"kinds":["collapse","upstage"]}
```
`triggers` are TAGS (2-5), `intensity` 0.2-0.7, `kinds` are mishap kinds (below). Examples to include: leans_left,
cries_by_watering_can, apologises_mid_villainy, only_knows_act_two, speaks_in_rhyme, exits_through_the_wrong_door, corpses,
upstages_the_moon, afraid_of_the_chandelier, allergic_to_feathers, forgets_which_play, falls_in_love_with_props,
cannot_say_the_word_macbeth, over_commits_to_death, stage_whispers_everything, eats_the_props, never_been_on_stage (gus).

## 4. `mishaps.json` - array of 80-110 (every flaw has >= 2, at least one minor and one major overall per flaw)

```json
{"id":"lean_collapse","flaw":"leans_left","kind":"collapse","severity":"major",
 "title":"Mabel leans too far left",
 "text":"{actor} leans into the kiss and keeps leaning. {other} is now holding a diagonal heroine.",
 "tags":["slapstick","romance"],"effects":{"warmth":-2,"chaos":9},"calamity":"the_lean","anim":"lean_left"}
```
Placeholders: `{actor}` (the offender), `{other}` (another on-stage actor), `{object}` (a prop), `{place}`, `{town}`.
`kind` in {collapse, apology, prop, upstage, rhyme, exit, freeze, cry, wrong_play, corpse, flirt, feast}. `calamity` is a
slug (20-30 distinct across the file) naming a recurring gag ("the_lean", "the_chair", "the_goose_incident"); the Almanac
tracks these. `anim` in {lean_left, collapse, spin, wobble, hide, fly, freeze, shake, flip, slide, bow, drop_prop}.
`effects.warmth` -6..+4, `effects.chaos` -3..+15 (before the Prompter's decision).

## 5. `whispers.json` - array (one entry per mishap `kind`, plus `generic`)

```json
{"kind":"collapse","options":[
 {"id":"lean_in","label":"Yes, and...","hint":"Make it part of the play.","effects":{"warmth":4,"chaos":6},"adds_tag":"slapstick","chain":true,
  "line":"(whispering) It is a tragedy of the angle, darling. Commit."},
 {"id":"cover_up","label":"Cover it up","hint":"Pretend nothing happened.","effects":{"warmth":-1,"chaos":-8},"adds_tag":null,"chain":false,"line":"..."},
 {"id":"blame","label":"Blame the goose","hint":"A classic.","effects":{"warmth":2,"chaos":2},"adds_tag":"goose","chain":false,"line":"..."}]}
```
Always exactly 3 options per kind; ids may repeat across kinds but each kind must contain one `chain: true` option and one
chaos-reducing (<= -5) option. `keywords` (optional, list of lowercase words) on an option map free text onto it; the engine
adds the fixed +2 "personal touch" itself.

## 6. `cues.json` - array of 6

```json
{"id":"thunder","label":"Thunder sheet","emoji":"⛈","uses":2,"fits":["storm","death","murder","ghost","betrayal"],
 "effects":{"warmth":5,"chaos":-4},"misfire":{"warmth":-3,"chaos":4},"misfire_text":"Thunder, at a wedding. Someone's aunt faints.","anim":"lightning"}
```
ids: lights, thunder, trapdoor, fog, spotlight, curtain.

## 7. `genres.json` - array of 5 (ids = GENRES)

```json
{"id":"farce","name":"Farce","blurb":"Doors. So many doors.","palette":{"sky":"#f6d28b","flat":"#e07a5f","floor":"#3d2c2e","accent":"#81b29a"},
 "roles":{"lead":"The Flustered Hero","villain":"The Scheming Landlord","fool":"The Wrong Man"},
 "skill_by_beat":{"setup":"comedy","complication":"physical","reversal":"improv","twist":"comedy","finale":"physical"},
 "sets":{"setup":"parlour","complication":"corridor","reversal":"bedroom","twist":"cellar","finale":"parlour"},
 "beats":{"setup":[ <variant>, ... ], "complication":[...], "reversal":[...], "twist":[...], "finale":[...]}}
```
Each beat has **5-6 variants**:
```json
{"id":"farce_setup_1","logline":"Everyone arrives at the same house for different, incompatible reasons.","tags":["door","mistaken_identity"],
 "props":["door","umbrella_stand"],
 "lines":[{"role":"lead","text":"I'm only here to return this umbrella to {villain}!"},
          {"role":"villain","text":"Nobody returns an umbrella. Who sent you? Was it {fool}?"},
          {"role":"fool","text":"I am {fool}. I am also, I think, the umbrella."}]}
```
Exactly 3-4 `lines` per variant; the speaker roles are `lead|villain|fool`; placeholders `{lead} {villain} {fool}` (performer
names), `{place}`, `{town}`, `{object}`. Tags per variant 2-3 (beat identity). `sets` values in {parlour, corridor, bedroom,
cellar, moor, ballroom, graveyard, castle, garden, library, attic, harbour, stage}. Variants within a beat must have different
tag sets. Genre flavour: melodrama (moustaches, wills, trains), farce (doors, wrong men), whodunit (the butler, a dead
host, the goose saw everything), gothic_romance (moors, candles, brooding), pantomime ("He's behind you!", dames, audience
participation).

## 8. `towns.json` - array of 30

```json
{"id":"marshwick","name":"Marshwick-on-Mire","blurb":"Damp. Proud of it.","sky":"dusk","landmark":"windmill",
 "temperament":{"likes":["pun","goose"],"hates":["death","fire"],"expects":"the_chair","openness":0.4,"favours":"pantomime","scorns":"melodrama"},
 "audience":{"mix":["pun_lover","tearful_aunt","man_who_hates_death"],"hat_bias":"bonnet"},
 "gossip":"They still talk about the time a swan was cast as the vicar."}
```
`sky` in {dawn, noon, dusk, night, storm}; `landmark` in {windmill, clocktower, lighthouse, castle, bridge, chimneys, spire, crane,
pier, silo}; likes/hates 1-3 TAGS each (disjoint); `expects` is a `calamity` slug from mishaps.json or `null`; `openness`
0-1. `favours` / `scorns` are genre ids (different): the town's loved genre warms the house +2 a beat, the scorned one cools it -2, and the genre cards say so. Each genre
must be favoured by 3 to 8 towns and scorned by 3 to 8 (enforced by `check`): a fun audit found one genre best in all 30 towns. The builder derives them from the town's likes and
hates (never a genre whose tags it hates), then balances them. At least 8 towns hate something that appears in popular beats so the choice of genre matters. The last town of a tour is
always the special id `wibbling_opera` ("The Royal Opera House of Wibbling"): likes `[song, crown, speech]`, hates `[goose, slapstick]`,
expects `the_chandelier`, openness 0.2.

## 9. `tastes.json` - array of 12 audience archetypes

```json
{"id":"pun_lover","name":"The Pun Enthusiast","hat":"bonnet","palette":{"coat":"#6d597a","skin":"#e8c9a0"},
 "likes":["pun","rhyme"],"hates":["death"],"laugh":0.8,"cry":0.2,"gasp":0.4,"boo":0.1}
```
`hat` in {top, bonnet, crown, flat, none, feather, fez, bow}. Include `man_who_hates_death`, `tearful_aunt`, `pun_lover`,
`child_in_the_front`, `retired_actor`, `critic_in_disguise`, `sleepy_farmer`, `goose_fancier`, `romantic`, `skeptic`,
`snack_vendor`, `mayor`.

## 10. `critics.json` - array of 5 pigeon critics

```json
{"id":"pompous","name":"Sir Coo-Lambert Pidgeon","outlet":"The Wibbling Gazette","style":"pompous",
 "weights":{"quality":0.6,"lead":0.1,"warmth":0.1,"charm_chaos":0.0,"tradition":0.1,"snacks":0.0},"bias":-0.3,"noise":0.4,
 "templates":{"5":["..."],"4":["..."],"3":["..."],"2":["..."],"1":["..."]}}
```
Templates (>= 4 per star level, `"1".."5"`, half-stars use the lower bucket) may use `{show}`, `{lead}`, `{villain}`,
`{fool}`, `{town}`, `{mishap}` (title of the show's most notable mishap), `{calamity}`, `{tradition}`, `{snack}`.
Critics: `pompous` (technical, never satisfied), `wounded_parent` (adores the lead), `snacks` (only reviews the snacks and
feast scenes), `chaos_gourmand` (loves a disaster; sweet spot), `sentimentalist` (traditions, tears). Each ~8-20 words.

## 11. `playbill.json` - object

`{"bio": {"openers":[...],"trained_at":[...],"credits":[...],"quirks":[...]}, "headings":[...], "back_page":[...], "tonight_in":[...],
"previously":[...]}`; bios are assembled as `"{name}, {opener} {trained_at}. {credits} {quirk}"` (>= 10 each so bios don't repeat
across a tour). Absurd: "trained at the Royal Academy of Looking Out Windows".

## 12. `road_events.json` - array of 20

```json
{"id":"goose_on_the_bridge","title":"A goose holds the bridge","text":"...","weight":2,
 "choices":[{"id":"bribe","label":"Offer bread (-1 fund)","effects":{"funds":-1,"rapport":{"goose":1}}},
            {"id":"detour","label":"Take the long way","effects":{"funds":0,"morale":-1}}]}
```
2-3 choices; `effects` keys: `funds` (int), `morale` (int), `rapport` (map performer id -> int), `encore` (int).

**Every choice must be a real trade-off** (enforced by `check`): no choice may be at least as bad as a sibling on every axis (funds, morale,
Encore, and one axis per performer's rapport) and worse on one. An option whose only effect is a cost ("Sit out the storm: -1 morale") is not
a decision, it is a trap with a label; a playtest found 11 of the first 20 events like that. Give the cheap option its own upside (a different
performer's rapport, a few funds) or give its rival a cost. A label that announces `(+N funds)` or `(+N Encore)` must match the effect.

## 13. `almanac_seeds.jsonl` - 60 lines

`{"id":"legend_001","text":"In Marshwick, the chair has fallen at every performance since 1904.","calamity":"the_chair","town":"marshwick"}`
(`text` is the semantic-search field; these seed the Store namespace `("almanac","legends")` so the Almanac has lore from night 1.)

## 14. `props.json` - array of ~30

`{"id":"sword","name":"Rubber Sword","tags":["sword"],"draw":"sword"}`; props referenced by variants must exist; `draw` is a stage
sprite id: sword, chair, candle, door, umbrella_stand, letter, mask, mirror, crown, chandelier, goose, cake, ghost_sheet, trunk, skull, bouquet, ladder,
teapot, lantern, tree, bed, clock, harp, trophy, bottle, book, rope, banner, fish, moon.

## 15. `shows_gold.jsonl` - generated by the engine (regression/eval ground truth)

`{"id":"gold_001","seed":7,"night":0,"genre":"farce","town":"marshwick","cast":{"lead":"mabel","villain":"reginald","fool":"gus"},
"autopilot":"lean_in","expect":{"mishaps_min":1,"stars_min":2.0,"stars_max":4.5,"calamities":["the_lean"]}}`; ~40 rows,
rebuilt by `build` using the engine's autopilot with a +/-0.75 star band, plus 6 hand-labelled "known disasters" (bad cast for the
genre; `stars_max` <= 2.5) and 6 "known triumphs" (`stars_min` >= 3.5). Used by `rehearsal` and `tests/evals`.

## Referential integrity (enforced by `check`)

flaw ids in performers exist; every flaw has >= 2 mishaps; mishap.kind has a whisper entry; mishap.calamity slugs form the
closed set used by towns.expects; variants' props exist in props.json; roles in genres match ROLES; every TAG used exists;
all `{placeholders}` are in the allowed set; strings non-empty; no duplicate ids; counts meet the minimums above.
