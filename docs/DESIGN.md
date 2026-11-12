# Probably a Tragedy: design

> You are the **Prompter**, hidden in the box at the foot of a toy theatre. The Wibbling Players, a troupe of puppets that
> cannot be trusted, improvise a new play in a new town every night. Whisper the right line, pull the right cue, and
> save the show. Or lean into the disaster: sometimes the audience loves that more.

A fun, visual, graphical game built as **nine LangGraph workflows**, **twelve datasets** and a cast of **agents**,
playable with no API keys (a deterministic offline "fake LLM" gives the puppets their voices; real Claude is opt-in).
Studio and tracing are one small, in-world affordance: the **Prompt Book** in the Prompter's box.

Expert panel (round 1) chose this concept over seven others (Groundhog Manor, Golem Guild, While You Were Out,
Tidewright, Grainfall, Nodehold, Graphlings). Borrowed ideas: Groundhog Manor's **ghost timeline** when you fork;
Nodehold's **"the Store survives a rewind"** economy; the graphics engineer's **pure `reduce(eventLog)` scene** so
scrubbing/rewinding is trivial; the architect's **client-side playback queue** (the server finishes a beat in ms; the
theatre performs it at human speed) and **deterministic hashing instead of RNG state**.

## 1. The loop

A **Tour** is 5 nights in 5 towns (seeded). Each **night**:

```
 CASTING CALL -> WRITERS' ROOM -> (REHEARSAL) -> THE SHOW (5 beats) -> REVIEWS -> ALMANAC -> PLAYBILL -> THE ROAD
   casting_call   writers_room      rehearsal      performance         reviews    almanac   playbill_press  the_road
```
and between nights, any time, a chat in **THE GREENROOM** (`greenroom_chat`).

* **Every ~10 s** (during a show): watch the puppets, pull a cue, whisper a line, warm the house.
* **Every ~2 min**: one beat (Setup, Complication, Reversal, Twist, Finale); ~1-2 Prompter decisions per show.
* **Every session (~15 min)**: a 5-night tour. Goal: **15 stars** across the tour ("a critical triumph"); every
  Tradition you enshrine makes the next town's audience love you more; funds buy props; Encore tokens buy rewinds.
* **Replay hooks**: daily/seeded tours, shareable seed string, playbill PNG export, an Almanac that remembers.

## 2. The show engine (pure, deterministic; `tragedy.engine`)

Everything random is `stable_int(seed, night, beat, actor, ...)`. No RNG object is ever in state, so a forked/rewound
timeline replays exactly and tests have ground truth. **Graphs orchestrate; the engine decides; models only add voice.**

**Meters** (0-100): `warmth` (audience mood; starts `40 + 20*town.openness`) and `chaos` (string tangle; starts 10, decays 2
per beat). **Beats** carry weights `[.15,.2,.2,.2,.25]`.

**Beat quality** for an on-stage actor `a` in `role` of `genre`:
`q = .5*skill(a, genre.skill_by_beat[beat]) + .3*roleFit + .2*(100 - stage_fright) - .15*chaos` (clamped 0-100); `roleFit` is 100 if
the role is in `a.roles`, 60 otherwise, 75 for the understudy. `Q_beat = mean(q)`; warmth moves by `(Q_beat - 55)/6`.

**Mishaps** happen when a **flaw** meets a **beat**: a flaw fires only if `flaw.triggers` intersects the beat's tags
(beat + script variant + props). `p = clamp(P_SCALE*flaw.intensity + chaos/300 + stage_fright/450, .05, .9)`; rapport used to subtract here and was a trap (see section 8);
`chance(p, seed, night, beat, actor, flaw)` rolls it. At most 2 per beat; at least 1 per show, and the guaranteed one is always **major**, so every show gives the Prompter something to do.
A mishap row has `severity`: **minor** (Madame handles it, half effects) or **major** (the stage freezes: **Prompter's Box**).
Some nights a puppet also has a **bad day** (35% each): one of the 8 "spare" flaws nobody carries permanently
(takes bows early, sleepwalks into the audience...) is added for the night. **Morale** (-3..+3, from the road) shifts
every puppet's stage fright by 5 points per step. A nervous performer can **freeze** on the Reversal: `perform` raises,
`RetryPolicy` retries once, then the node's `error_handler` sends in **Gus**, the understudy who has never been on stage.
Pure **luck** (+/-6 warmth a beat, hash-derived) is why it is *probably* a tragedy and not certainly one.

**Prompter's Box** (an `interrupt()`): three **whispers** for the mishap's `kind` (e.g. *Yes, and...* / *Cover it up* /
*Blame the goose*), plus optional **cues** (lights, thunder, trapdoor, fog, spotlight; limited uses per night; a cue that
fits the beat/mishap tags is a miracle, one that doesn't is a (funny) misfire), plus **free text** (keyword-classified
onto the nearest whisper, +2 "personal touch"). The three options appear in an order that changes per mishap (the same on every replay), so there is no
"press 1". Roughly: *Yes, and...* is the loud gamble (a little less warm, much more chaos), *Cover it up* calms the strings (warm enough, chaos -7)
and the third way is the middle path; which is right depends on the tangle, the town's tags and any recurring calamity (a Tradition pays +6/+10 for leaning in).
After a *Yes, and...* the other on-stage actors may extend it: the **yes-and chain** (`+1 warmth` per link; chance from their `improv` skill and,
now, **their rapport with you**: +7 points per rapport point).

**Town & audience.** Every event tag (beat, mishap, whisper, cue) is judged by the town: `+2.5` if liked, `-3` if hated;
repeating the **calamity the town expects** is `+8`. Every town also **loves one genre and scorns another** (`temperament.favours` / `scorns`,
shown on the genre cards): +2 warmth a beat for the loved one, -2 for the scorned one. Each beat then says why the house moved (`stage.why`). Twelve **seats** each have a taste (hat, likes, hates, laughs/cries/
gasps) and react independently (`audience_house`: a `Send` x12 map-reduce inside `performance`): laugh, gasp, cry, boo,
yawn, applaud. The reduce gives the audience delta.

**Reviews.** Five **pigeon critics** (`reviews`, `Send` x5) each weigh the same metrics differently (technical quality, the
lead's moment, warmth, "charming chaos" with a sweet spot near chaos 45, Traditions, snacks) and write a pull-quote.
`stars = mean`, in half-star steps. `funds = round(stars * warmth/45)` (about 6-8 a night: scarce on purpose).

**Almanac & Traditions** (`almanac`, the Store): every calamity is remembered. When one recurs it becomes a candidate
**Tradition**; you (an interrupt) enshrine up to 2. Traditions are quoted in the next playbill, expected by later towns
(+6 for honouring one on purpose, a standing ovation +10 the third time) and each enshrined one grants an **Encore token**.

**Time travel: "Take it from the top".** The film strip under the stage is the thread's checkpoint history. Click a
beat, spend an **Encore token** (Store, so it *survives* the rewind), and the show forks from that checkpoint. The first
timeline stays on stage as a translucent **ghost**; at the end the paper audience votes which ending was warmer.
(Thread state rewinds; the Store does not. That line is the game's economy.)

**Rehearsal** (`rehearsal`): spend a candle to simulate 12 headless dress rehearsals of your cast+script
(`Send` x12) and see the star histogram and the likeliest disasters. It is also the engine's eval harness
(`datasets/shows_gold.jsonl`).

## 3. The nine graphs

| graph | in-world | LangGraph features |
|---|---|---|
| `casting_call` | auditions; Madame recommends; you confirm the cast | `Send` map-reduce, reducers, `defer`, supervisor recommendation, `interrupt` (approve/edit) |
| `writers_room` | three heron-playwright quills draft the night's play | `Send` x3 into a **compiled subgraph** (`quill`: draft -> self_check loop), evaluate -> revise loop (conditional edges), `defer` gate, `interrupt` (pick) |
| `performance` | **the show**; Madame directs, actors act, you prompt | supervisor `Command(goto)` with `destinations`, dynamic `interrupt` (looping per mishap), `Send` x12 audience + `defer` tally, `RetryPolicy` + `error_handler` (Gus), custom + messages streaming, checkpoint per beat (time travel/fork) |
| `reviews` | five pigeons review the show | `Send` x5, custom reducer, `defer`, token streaming, Store write |
| `almanac` | the Almanac of Calamities | Store + semantic search, `memory_write` `interrupt`, cross-thread memory |
| `the_road` | the wagon trundles to the next town | durable execution, `durability="sync"`, crash recovery, `interrupt` (crossroads), cron-able |
| `playbill_press` | prints the programme | **Functional API** (`@entrypoint` / `@task`), `previous` |
| `greenroom_chat` | chat with a puppet backstage | `create_agent` + middleware, tool-call review (`interrupt`), `messages` streaming, Store |
| `rehearsal` | twelve imaginary nights | `Send` x12, eval against gold, histogram |

## 4. Visual language

A **toy proscenium** in crimson and gold on a deep-plum room: candle-flame footlights (flickering ellipses), painted
paper flats on three parallax grooves (changing per genre/beat), a paper moon on a stick, a row of paper-silhouette
audience whose heads bob and swivel, marionettes whose **strings are visible** (verlet ropes that tangle as `chaos`
rises), and speech as **jaw flaps** (each streamed token flaps the speaker's mouth) with a scroll banner below.
Everything on screen is a pure function of `reduce(eventLog, k)`, so scrubbing the film strip rewinds the theatre.
The **Prompt Book** (bottom-right) is the only place that talks about LangGraph: a mini live graph with the active node
lit, the thread id, and links to Studio and the LangSmith trace.

## 5. Offline-first

`TRAGEDY_PROVIDER=offline` (default): every graph runs with a deterministic model (`OfflineChatModel`, scripts echo the
engine's draft token by token). `auto`/`anthropic` + `ANTHROPIC_API_KEY`: the same drafts are rephrased by Claude in each
persona's voice. **Scores never depend on model text.**

## 6. Balance (measured, not guessed)

`uv run python -m tragedy.engine.balance` simulates 150 nights per play style (knobs: `PERF_CENTER`, `EFFECT_SCALE`, `P_SCALE`, `LUCK_GAIN`,
`GENRE_CENTER`, `GENRE_FAVOUR`, `CHAOS_DECAY` in `engine/show.py`; `STAR_CENTER/STAR_WIDTH/NOISE_GAIN` in `engine/review.py`):

| style | mean stars / night | meaning |
|---|---|---|
| skilled (the town's **favourite** genre, best of 3 drafts, Madame's cast, look-ahead whispers + cues) | ~2.98 | 5 nights ~ 14.9: the 15-star target is *earned* |
| autopilot (genre by whim, Madame's cast, always *Yes, and...*) | ~2.34 | 5 nights ~ 11.7: a respectable tour, no triumph |
| **always gothic romance** (the old no-skill recipe) | ~2.37 | the same as autopilot: it no longer wins |
| cover-up (never lean in) | ~2.29 | within a third of a star of leaning in: neither whisper is a fixed answer |
| random cast | ~1.72 | |
| worst cast + cover-up | ~1.11 | |

Whole tours (the audit's harness, 200 tours per policy, props, rapport, Traditions and road events modelled): careless ~11.9 (2% triumph),
always-gothic ~12.2 (3%), **reads the town** ~15.2 (64% triumph), plus Traditions, props and good roads ~17.9 (97%).
`tests/unit/test_engine.py::test_play_styles_are_ordered_and_no_cheap_recipe_wins` and `tests/unit/test_fun_audit.py` pin all of this, and
`datasets/shows_gold.jsonl` pins 40 concrete nights (including known disasters and triumphs) so any engine change that shifts the game is visible.

## 7. What money buys

Funds (start 8, ~7 a night) are spent in the **Greenroom**: Mrs. Gasket fetches a prop (1-3 funds, you sign the invoice). A prop the plays
actually ask for (the 30 in `props.json`: chair, chandelier, cake, sword...) becomes a **real prop** the troupe owns for the rest of the tour:
whenever a scene's set includes it, the house warms by `PROP_BONUS` (+2, max 2 a beat): the real thing, not a rubber one. A made-up prop is
just lovely. Buying the same prop twice costs nothing. This is why scripts, genres and shopping interact: you buy the props the plays you
expect to write will call for. (An earlier version let funds pile up to 70 with nothing to spend them on; the full-tour test pins the fix.)

## 8. The fun audit (what an independent read found, and what is still open)

A fresh game-design agent, given only the finished game and the engine, measured with paired simulations (300 to 600 nights per cell) whether the
player's choices matter. It found the **strategy space was solved**: always gothic romance + Madame's cast + press "1" averaged **15.9 stars a tour with no
skill** (80% triumph), a careless bot got 13.6, and the intended skill (reading the town) lost to the dumb rule. Findings and what was done:

| finding (measured) | fix | result |
|---|---|---|
| "Yes, and..." was best in 100% of 1,252 decisions (96% with look-ahead); cover-up never | whispers retuned (lean warmer-less, chaos x1.7; cover-up +2 warmth), `CHAOS_DECAY` 3 -> 2, options shuffled per mishap | look-ahead now picks lean ~60%, cover-up ~27%, third ~12%; lean vs cover-up within a third of a star |
| gothic romance best in **30 of 30** towns (genre alone = 69% of the variance, town x genre 10%) | per-genre quality normalised (`GENRE_CENTER`); each town loves one genre and scorns another (`GENRE_FAVOUR`), shown on the cards | genre alone 14%, **town x genre 60%**; best genre varies by town; always-gothic 15.9 -> 12.2 |
| rapport cut mishaps, and mishaps are where warmth and decisions come from: **-3.6 stars a tour at rapport 5** | rapport now makes a puppet likelier to join your *Yes, and...* | friendship no longer a trap |
| 12% of shows had no major decision | the guaranteed disaster is major | every show has one |
| the player could not learn *why* a night scored what it did (the breakdown was computed and dropped) | `stage.why` event, toast + log line per beat; the tour screen's cards name the town's taste | named reasons in play |

**Still open, said plainly.** The third way is the best *fixed* whisper (about +0.2 a night over always-lean), so whispers are a real but modest lever (up to
~0.2 stars a night); raising the stakes did not fix it, because a warm, low-chaos option is simply efficient. Traditions are a free +2 stars a tour, and
*which* one you enshrine barely matters. Road choices move a tour by about 0.01 stars. A show is about 185 s of watching for about 2 decisions at 1x. There is no
progression between tours (only a seed and a daily seed). Funds still end a tour largely unspent (a Greenroom nudge was added). Farce is the hard genre (more mishaps).
None of this says whether the game is fun; it says the choices are no longer fake.


## 9. Played through by the assistant (what it felt like, what was fixed)

Not a substitute for a human playtest: the assistant played about two nights in the real game (OpenAI voices, seed 21, reading each screen
and choosing on purpose), then traced what it hit. It could judge clarity, pacing and reward moments, not whether it is *fun for you*.

**Worked well:** the voice (audition lines, programme bios, pigeon reviews), the *Why:* chips after every beat, the rehearsal forecast paying off
(it predicted "Mabel loses the staircase", which then happened), drafts chosen by matching their tags to the town's tastes, a cue that fits
the mishap announcing "Miracle", the film strip replay ending in the paper audience's vote (my gamble scored 93.2 warmth vs 89.2 for the replay,
8 votes to 4), and a repeated calamity (the String Knot) becoming a Tradition worth an Encore token.

**Fixed:**
* Two drafts could share a title ("Trousers of Twelve Bridges" twice, ~44% of nights): quills now take distinct title patterns (`flavour.make_title`).
* "Twelve loves this" / "The loves this": the town badge used the town's first word; now `townShort` (tests/ui).
* The understudy card said "(75 everywhere)" while his audition scores were ~55: now "(steady everywhere)".
* The 2x speed choice is remembered for later nights.
* **Pacing.** The engine now guarantees a real decision (a major mishap; Madame handles minor ones herself) by the second beat
  (`show.FIRST_DECISION_BY`): in 400 simulated shows 0 are left without one (8% were), and the first now lands on beat 0 or 1 instead of as late as
  the finale. Average warmth is unchanged (72.0 to 71.9); there are a few more major mishaps (2.4 to 2.9 a show) and chaos is higher (59 to 65). The
  per-genre quality centres were re-measured. And "1x" runs 25% faster than the stage's authored timings (`BASE_PACE` in views/show.js; 2x is still
  twice 1x). Measured on the live game: the first decision came at **49 s** at the default speed (Complication), down from 2 min 38 s.

**Still open (design calls, not bugs):**
* The first night still has passive stretches between decisions (a beat is ~28 s at 1x). Madame's minor-mishap handling is automatic by design.
* Madame's cast is the numeric optimum (221.9 = 79.6 + 72.7 + 69.6), so casting is "accept" unless you read quirks; the town's loved genre is
  printed on its card, so the genre pick is a lookup. Both are fine for a first tour, thin for a fifth.
* Cues fit about a third of mishaps on the mishap's tags alone (more with the beat's tags) and the UI never says what a cue fits, so they
  are guess-and-learn; three of three guesses were "miracles".
* The rehearsal star histogram is often one bar (11 of 12 nights at 3 stars); the disaster list is the useful part.
* Only one real whisper decision in a night when Madame handles the minor mishaps herself.
