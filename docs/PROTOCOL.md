# Protocol: how the theatre talks to the graphs

Everything the player does is a **real LangGraph run on a real thread** (so it is all visible in Studio). The browser
drives the Agent Server's *built-in* endpoints for runs; the custom FastAPI app (`langgraph.json` -> `http.app`) only
holds game rules that are not graph runs: the tour/economy, datasets, links.

* Server: `langgraph dev --port 2027` (Makefile `make dev`). SPA at `/app/`. Custom API at `/api/*`. Health `/healthz`.
* No auth (local game). All custom routes are `async def` (blockbuster flags blocking calls on the server loop).

## 1. Conventions (all graphs)

* **State is plain JSON** (dicts, lists, str, int, float, bool, None). No pydantic/dataclass instances in state: tuples become
  lists after a checkpoint round-trip and custom classes need a serde allowlist.
* **Determinism**: every random-looking choice is `tragedy.common.rng` (`stable_int/roll/chance/pick`) of
  `(seed, night, ...labels)`. No `random`, no `time`, no `uuid4` in nodes.
* **Common input keys** (every graph): `tour_id: str`, `night: int (0-4)`, `seed: int`. Most also take `genre`, `town` (id), `cast`.
* **Partial inputs (LangGraph Studio's form).** The game always sends every key; Studio sends one or two. `performance`, `almanac` and
  `the_road` therefore begin with a `defaults` node (`flows/defaults.py::complete`) that fills in *only* missing keys: `tour_id`
  (`studio-demo`), `night` (0), `seed` (the stored tour's, else 7), `genre` (`farce`), `town` (the tour's town for that night), then
  per graph a recommended `cast`, a drafted `script`, and (almanac) a headless `result` and `next_town`. A value the caller gave is never
  replaced (a trimmed `result` without beats counts as given), the step itself writes nothing to the Store, and a `note` event
  ("Filled in what was left blank: ...") appears only when something was actually filled. Pinned by `tests/graphs/test_studio_defaults.py`
  and, over real HTTP for all nine graphs, `tests/e2e/test_studio_inputs.py`.
* **`cast`** = `{"lead": "<performer id>", "villain": "<id>", "fool": "<id>"}` (distinct ids from `performers.json`).
* **`script`** = `{"title","tagline","quill","genre","beats":[{"beat":"setup","variant":"<variant id>","logline":str,"tags":[..],
  "lines":[{"role","text"}], "props":[..], "slots":{"object","place"}} x5], "tags":[union]}`.
* **Interrupts**: payload is a dict with `kind`. Resume value is a dict. **Always resume with an id map**
  `{"command": {"resume": {"<interrupt.id>": value}}}` (a bare resume value can be consumed by the *next* interrupt).
  Nodes containing `interrupt()` re-run from line 1 on resume: keep everything before it pure/idempotent, put effects after it,
  and give every `emit` a deterministic `key` so the client can drop duplicates.
* **Command nodes** (`Command(goto=...)`) declare `destinations=(...)` so Studio draws their edges.
* **Node concurrency**: nodes are `async def`; no blocking IO. Heavy CPU (rehearsal) is small enough to run inline.
* **Models**: only through `tragedy.models.factory.voice(...)` (flavour text) or `get_chat_model` (the agent). Outcomes never
  depend on model text.
* **Store** (configured with `store.index` on field `text`): namespaces below. Use `runtime.store` / `get_store()`.

### Store namespaces

| namespace | key | value |
|---|---|---|
| `("tour", tour_id)` | `state` | the **tour state** (section 3) |
| `("almanac", "legends")` | `legend_###` | `{text, calamity, town}` seeded from `almanac_seeds.jsonl` |
| `("almanac", tour_id)` | `<calamity>:<night>` | `{text, calamity, town, night, genre}` one per calamity occurrence (semantic recall) |

## 2. Graph catalogue (inputs, interrupts, outputs)

Every graph also emits `progress` events (`{label, pct}`) and node lifecycle comes for free from the `tasks` stream.
"Out" = keys of the final state the client reads from the last `values` event.

### 2.1 `casting_call`
* In: `{tour_id, night, seed, genre, town}`. Optional `candidates: [ids]` (default all 8 performers).
* Flow: `load -> audition (Send: one per candidate x role, 24 sends) -> rank [defer] -> recommend (Madame voice) -> confirm_cast (interrupt) -> done`.
* Events: `cast.audition {role, actor, score, line}` (24), `cast.recommend {cast, note, scores}`.
* Interrupt: `{kind:"confirm_cast", proposed:{lead,villain,fool}, scores:{role:{actor:score}}, note, genre}`;
  resume `{"cast": {"lead","villain","fool"}}` (the client sends the proposed cast to accept; invalid casts re-ask once then fall back to proposed).
* Out: `{cast}`.

### 2.2 `writers_room`
* In: `{tour_id, night, seed, genre, town, cast, traditions: [calamity slugs]}`.
* Flow: `brief -> quills (Send x3: quill_pompous, quill_frantic, quill_tender) -> judge [defer] ->
  (score < 0.45 and revisions < 1) ? revise -> quills : pick_draft (interrupt) -> finalize`.
* Events: `script.draft {draft_id, quill, title, tagline, beats:[{beat,logline,tags}], confidence}` (3, `confidence` is Madame's
  0-3 "stars of faith", NOT the true score), `script.chosen {draft_id}`.
* Interrupt: `{kind:"pick_draft", drafts:[{draft_id, quill, title, tagline, beats:[{beat,logline,tags}], confidence}]}`; resume `{"draft_id"}`.
* Out: `{script}`.

### 2.3 `performance` (the show)
* In: `{tour_id, night, seed, genre, town, cast, script}`; reads the tour state from the Store for `rapport`, `traditions`.
* Flow: `curtain_up -> direct -> perform -> (major mishap ? prompters_box [interrupt] : -) -> resolve -> audience [Send x12] -> tally -> next_beat router -> (direct | curtain_call)`.
  `direct`/`next_beat` use `Command(goto=..., destinations=...)`. `perform` has `RetryPolicy`; if it still fails the
  `understudy` fallback (Gus) completes the beat (visible as an error-handler node).
* State keys: `beat, warmth, chaos, quality[], mishaps[], calamities[], decisions[], cues_left{}, yes_and, tradition_hits, log[]`.
* Events (per beat, in order): `stage.beat`, `stage.set`, `stage.enter`*, `stage.direct`, `stage.line`* (3-4), `stage.mishap`*,
  [interrupt], `stage.decision`, `stage.cue`?, `stage.chain`?, `audience.react`* (12), `audience.tally`, `meter`, `stage.why`?; finally `stage.curtain`.
* Interrupt: `{kind:"prompters_box", beat, mishap:{id,title,text,actor,kind,severity,tags}, options:[{id,label,hint}],
  cues:[{id,label,emoji,uses_left}], free_text:true}`; resume `{"option": "lean_in", "cue": null|"thunder", "text": null|"..."}`.
* Out: `{result:{warmth, chaos, quality_avg, quality_lead, quality[], mishaps:[{beat,id,title,actor,calamity,decision}], calamities:[..],
  tradition_hits, yes_and, cues_used:[..], beats:[{beat, warmth, chaos}]}}`.
* **Time travel**: a checkpoint exists at the start of every beat. "Take it from the top" = `POST /threads/{id}/runs/stream`
  with `{"checkpoint": {"checkpoint_id": ...}, "input": null, "stream_mode": [...]}`; the graph re-runs from there and asks again.
  `GET`/`POST /threads/{id}/history` lists checkpoints; the client labels each by `values.beat`.

### 2.4 `reviews`
* In: `{tour_id, night, seed, genre, town, cast, script, result}` (`result` from `performance`).
* Flow: `gather -> critics (Send x5) -> reduce [defer] -> headline (voice, streams) -> file_review (Store: tour history, funds)`.
* Events: `review.pigeon {critic, name, outlet, stars, quote}` (5), `review.headline {text, stars, funds_delta}`.
* Out: `{stars, funds_delta, headline, reviews:[{critic,name,outlet,stars,quote}]}`.

### 2.5 `almanac`
* In: `{tour_id, night, seed, genre, town, result, next_town}`.
* Flow: `ingest (Store write per calamity) -> detect (counts >= 2 => candidates) -> curate (interrupt, only if candidates) -> enshrine (Store write, +1 encore each) -> recall (semantic search for next_town)`.
* Events: `almanac.noted {calamity, count, text}`, `almanac.candidate {calamity, title, count, text}`, `almanac.tradition {calamity, title}`,
  `memory.recalled {text, calamity, town, score}`, `memory.written {ns, key}`.
* Interrupt: `{kind:"curate_traditions", candidates:[{calamity,title,count,text}], max:2}`; resume `{"enshrine":[calamity,...]}`.
* Out: `{traditions:[{calamity,title,count}], recalled:[{text,calamity,town,score}]}`.

### 2.6 `the_road`
* In: `{tour_id, night, seed, from_town, to_town, crash: bool=false}`.
* Flow: `depart -> weather -> roll_event -> (event has choices ? crossroads [interrupt] : -) -> apply -> power_cut? -> arrive`.
  Uses `durability="sync"`; `crash=true` makes `apply` raise once (first attempt only, detected via state) so the run is
  retried from the last checkpoint: the "crash recovery" demo.
* Events: `road.step {pct,label}`, `road.event {id,title,text,choices}`, `road.crash {node}`, `road.arrive {town}`.
* Interrupt: `{kind:"crossroads", event:{id,title,text}, choices:[{id,label}]}`; resume `{"choice"}`.
* Out: `{event, choice, effects, arrived}`; writes funds/rapport/encore to the Store tour state and advances `night` and `wagon.at`.

### 2.7 `playbill_press` (Functional API)
* `@entrypoint(checkpointer)` with `previous`; tasks `bios`, `traditions_page`, `review_wall`, `layout`.
* In: `{tour_id, night, seed, genre, town, cast, script, stars, headline, traditions}`.
* Events: `playbill.section {name, ...}`.
* Out: `{playbill:{title, town, night, genre, cast:[{id,name,role,bio}], tonight:[..], traditions:[..], quote, back_page, previously:[..]}}`
  (`previously` comes from `previous`, so it accumulates across nights on the same thread `playbill-<tour>`).

### 2.8 `greenroom_chat`
* `create_agent` with middleware; `messages` state; run context `{tour_id, actor_id}`. The agent speaks as the chosen performer.
* Tools: `calm_nerves()` (rapport: they join your yes-and chain more often; writes rapport), `fetch_prop(prop)` (costs funds; **tool-call review
  interrupt**: approve/edit/reject), `recall_gossip(query)` (Store semantic search).
* Events: `greenroom.rapport {actor, rapport}`, `greenroom.tool {tool, args, status}`. Tokens stream in `messages`.
* Interrupt (middleware): `{action_requests:[...], review_configs:[...]}` per langchain HITL middleware; client resumes `{"decisions":[{"type":"approve"|"edit"|"reject", ...}]}`.

### 2.9 `rehearsal`
* In: `{tour_id, night, seed, genre, town, cast, script?, samples: int=12}`.
* Flow: `plan -> simulate (Send x12) -> summarize [defer]`.
* Events: `rehearsal.sample {i, stars, warmth, chaos, top_mishap}`, `rehearsal.summary {histogram:[n(1..5)], mean, risk:[{title,freq}], verdict}`.
* Out: `{summary}`.

## 3. Tour state (Store `("tour", tour_id)/state`) and the custom REST API

```json
{"id":"tour-ab12","seed":7,"night":0,"towns":["marshwick","...","wibbling_opera"],"funds":8,"encore":2,"candles":2,"morale":0,"props":["chandelier"],
 "rapport":{"mabel":0},"traditions":[{"calamity":"the_lean","title":"The Lean","count":2}],
 "history":[{"night":0,"town":"marshwick","genre":"farce","title":"...","stars":3.5,"headline":"...","funds_delta":3}],
 "wagon":{"at":"marshwick"},"status":"active"}
```
`props` are real props bought in the Greenroom (+2 warmth when a scene needs one). `morale` (-3..+3, moved by road events) shifts every puppet's stage fright by 5 points per step. `status` is derived: `active`, or after night 5 `triumph` (sum of stars >= 15), `respectable` (>= 11) or `tragedy`.

| route | purpose |
|---|---|
| `GET /api/boot` | `{version, provider, tracing:{enabled, project}, studio:{url, base_link}, graphs:[{id,title,blurb,features[]}], datasets:[{name,rows,desc}], public_base_url}` |
| `GET /api/datasets` / `GET /api/datasets/{name}?offset=&limit=` | dataset browser |
| `POST /api/tour {seed?}` -> tour state | new tour (seeds the Almanac legends into the Store on first use) |
| `GET /api/tour/{id}` -> tour state | HUD |
| `POST /api/tour/{id}/thread {graph, attempt?}` -> `{thread_id}` | deterministic `uuid5(NS, tour/graph/night/attempt)` (client then `POST /threads {thread_id, if_exists:"do_nothing", metadata}`) |
| `POST /api/tour/{id}/rewind` -> `{encore}` | spend an Encore token (409 if none). The client calls this before forking |
| `POST /api/tour/{id}/candle` -> `{candles}` | spend a rehearsal candle (409 if none) |
| `GET /api/links?graph=&thread_id=` | `{studio_graph, studio_thread, trace, trace_status}`; `trace` is a LangSmith URL when tracing is on and a run is found |
| `GET /go` | HTML Studio launcher: every graph and its newest threads, each linking to Studio with `assistantId` + `threadId` |
| `GET /go/graph/{graph}` | 302 to Studio on that graph (404 for an unknown graph) |
| `GET /go/thread/{thread_id}` | 302 to Studio on that thread **with the thread's own graph selected** (404 for an unknown thread) |
| `GET /api/graphs` | catalogue + sample inputs |

## 4. Custom stream events (`stream_mode="custom"`)

Envelope `{"v":1,"kind","key","agent","data"}` from `tragedy.common.stream.emit`. `key` is deterministic and unique within a run.

| kind | data |
|---|---|
| `progress` | `{label, pct}` |
| `note` | `{text}` |
| `meter` | `{warmth, chaos, beat}` (0-100) |
| `cast.audition` | `{role, actor, score, line}` |
| `cast.recommend` | `{cast:{lead,villain,fool}, note, scores}` |
| `script.draft` | `{draft_id, quill, title, tagline, beats:[{beat,logline,tags}], confidence}` |
| `script.chosen` | `{draft_id}` |
| `stage.set` | `{beat, set, sky, props:[prop ids], palette}` |
| `stage.beat` | `{index, beat, name, logline, tags}` |
| `stage.enter` / `stage.exit` | `{actor, role, from?: "left"\|"right"\|"trapdoor"}` |
| `stage.direct` | `{text, speaker:"madame"}` (director's note; `voice`d) |
| `stage.line` | `{actor, role, text, emotion}` (`emotion` in neutral/joy/fear/rage/love/grief/smug) |
| `stage.mishap` | `{id, actor, other, kind, severity, title, text, anim, tags, calamity, effects}` |
| `stage.decision` | `{mishap_id, option, label, cue, text, line, effects, by:"prompter"\|"madame"\|"gus"}` |
| `stage.cue` | `{cue, fits, outcome:"miracle"\|"misfire", text, anim}` |
| `stage.chain` | `{actors:[ids], lines:[str], bonus}` (the yes-and chain) |
| `stage.why` | `{beat, chips: [{label, value}] (biggest first), text, delta}`: why the house moved this beat (town taste, genre love/scorn, real props, tangle). Omitted when nothing moved by 0.5 or more. |
| `stage.curtain` | `{warmth, chaos, quality_avg, tradition_hits, knotted: bool}` |
| `audience.seat` | `{seat, taste, hat, palette}` (12 at curtain-up) |
| `audience.react` | `{seat, reaction:"laugh"\|"gasp"\|"cry"\|"boo"\|"yawn"\|"applaud", intensity, why}` |
| `audience.tally` | `{beat, delta, counts:{laugh,gasp,cry,boo,yawn,applaud}}` |
| `review.pigeon` | `{critic, name, outlet, stars, quote}` |
| `review.headline` | `{text, stars, funds_delta}` |
| `almanac.noted` | `{calamity, count, text}` |
| `almanac.candidate` | `{calamity, title, count, text}` |
| `almanac.tradition` | `{calamity, title}` |
| `memory.recalled` | `{text, calamity, town, score}` |
| `memory.written` | `{ns, key}` |
| `road.step` | `{pct, label}` |
| `road.event` | `{id, title, text, choices}` |
| `road.crash` | `{node, recovered}` |
| `road.arrive` | `{town}` |
| `playbill.section` | `{name, text?}` |
| `rehearsal.sample` | `{i, stars, warmth, chaos, top_mishap}` |
| `rehearsal.summary` | `{histogram:[5 ints], mean, risk:[{title, freq}], verdict}` |
| `greenroom.rapport` | `{actor, rapport}` |
| `greenroom.tool` | `{tool, args, status}` |

## 5. Stream plumbing the SPA uses

`POST /threads/{id}/runs/stream` with `stream_mode: ["values","updates","messages-tuple","custom","tasks","checkpoints"]`,
`stream_subgraphs: true`, `stream_resumable: true`, `on_disconnect: "continue"`. The SPA's `core/stream.js` + `core/sse.js`
(from Foghorn) parse frames; a **playback queue** paces custom events for the stage (the server finishes a beat in
milliseconds; the theatre performs it at human speed and pauses at an `__interrupt__`); `messages` tokens drive jaw flaps;
`tasks` events light the active node in the Prompt Book's mini-graph; `checkpoints` build the film strip.

## 6. Links (the "light" Studio/trace integration)

* `studio.base_link = https://smith.langchain.com/studio/?baseUrl=<public_base_url>`: the one link Studio documents (open Studio on this server).
* Graph and thread deep links use **Studio's own route** (verified against the real Studio; Studio itself redirects to it):
  `https://smith.langchain.com/studio/thread?baseUrl=<server>&render=interact&mode=graph&assistantId=<assistant uuid>[&threadId=<thread id>]`.
  `assistantId` is the server's assistant UUID for the graph (`POST /assistants/search`; `GET /api/boot` exposes `graphs[].assistant_id`;
  `GET /api/links` returns `assistant_id`). Without it only the documented base link is offered. An earlier path-style guess
  (`studio/thread/<id>`) and a `&graph=` parameter do not work and must not come back.
* Tracing is off unless `make dev TRACE=1` (needs `LANGSMITH_API_KEY`); then `/api/links` looks up the thread's root run in the
  `LANGSMITH_PROJECT` project (run metadata `thread_id`, verified live) and returns a trace URL, otherwise `trace_status` explains why.

## 7. SPA contracts (vanilla ES modules, no build, no CDN, no external assets)

Static root: `src/tragedy/server/static/` (served at `/app/`). Palette/tokens: `css/tokens.css` (owned by the lead; read it first).
**Strict file ownership** (parallel workers must not edit each other's files):

| owner | files |
|---|---|
| **Shell-Core** | `index.html`, `css/base.css`, `css/components.css`, `js/main.js`, `js/api.js`, `js/run.js`, `js/ui.js`, `js/mock/**`, `js/views/{title,tour,show,promptbook,datasets}.js`, `js/core/**` (shared helpers already copied from Foghorn; extend, don't break), `tests/ui/{run,api,queue}*.test.mjs` |
| **Shell-Views** | `js/views/{casting,writers,rehearsal,reviews,almanac,playbill,road,greenroom}.js`, `css/views.css`, `tests/ui/views*.test.mjs` |
| **Stage** | `js/stage/**`, `stage-lab.html`, `css/stage.css`, `tests/ui/stage*.test.mjs` |

### 7.1 `js/run.js` (Shell-Core) - the one way to run a graph

```js
import { runFlow } from './run.js';
const out = await runFlow({
  graph: 'casting_call',               // assistant id
  input: { tour_id, night, seed, genre, town },   // OR `command: {resume}` / `checkpoint` for forks
  threadId,                            // optional; default: POST /api/tour/{id}/thread then POST /threads
  checkpoint: null,                    // {checkpoint_id} to fork from (Take it from the top)
  pace: async (ev) => {},              // awaited for every CUSTOM event, in order (the playback queue)
  onEvent: (ev) => {},                 // custom envelopes {v,kind,key,agent,data}; deduped by key
  onToken: ({ node, text, actor }) => {},    // `messages` chunks (jaw flaps / typewriter)
  onNode: ({ node, phase }) => {},     // from `tasks` (phase: 'start'|'end'); drives the Prompt Book
  onCheckpoint: ({ checkpoint_id, beat, step }) => {},
  onInterrupt: async (payload, { id }) => resumeValue,   // MUST return the resume dict; runFlow then resumes with {id: value}
  signal,                              // AbortSignal
});
// out = { threadId, runId, values /* last values event, e.g. {cast: {...}} */, events /* every custom envelope */, interrupts /* seen payloads */ }
```
Behaviour: events are *buffered while the run streams* (the server finishes a beat in milliseconds) and *released through
`pace`* in order; when the next item to release is the interrupt, `onInterrupt` is awaited **after all earlier events have been
paced**, then the run resumes and its events join the same queue. Reconnects use Last-Event-ID. Errors reject with a
readable `Error`. `?mock=1` (or `window.__MOCK__`) swaps the transport for `js/mock/` (canned runs implementing sections 2 and 4
of this document, including interrupts), so views and the stage can be built and tested with no server.

### 7.2 `js/stage/stage.js` (Stage) - the theatre

```js
import { Stage } from './stage/stage.js';
const stage = new Stage(canvas, { data: { performers, staff, tastes, cues, props }, seed, reducedMotion });
await stage.apply(ev);        // apply ONE custom event envelope (kinds: stage.*, audience.*, meter, cast.*? no); resolves when its visuals finish
stage.token(actorId, text);   // a streamed token: flaps that speaker's jaw (call per `messages` chunk)
stage.speed = 1;              // 0.5 | 1 | 2 | 4 ; 0 = skip (resolve immediately)
stage.reset();                // clear to an empty stage
stage.log;                    // array of every applied envelope (the scene is a pure reduce of it)
await stage.seek(k);          // rebuild the scene from log.slice(0,k) instantly (scrubbing the film strip)
stage.setGhost(eventsOrNull); // render an alternate timeline translucently behind the live one
stage.getMetrics();           // {warmth, chaos, beat, speaker}
stage.on('actor', (id)=>{}); stage.on('seat', (i)=>{});   // clicks on puppets / audience seats
stage.resize(); stage.destroy();
```
The stage also needs a standalone `stage-lab.html` (fixture event log + controls) for development and screenshots, and
`?seed=&t=` style determinism for golden screenshots.

### 7.3 Views (Shell-Views) - `js/views/<name>.js`

```js
export async function mount(root, ctx) { /* build DOM into root */ return { unmount() {} }; }
// ctx = { api, runFlow, tour /* current tour state */, refreshTour(), nav(view, params), toast(msg), ui /* js/ui.js helpers */,
//         data /* {performers, staff, genres, towns, ...} cached datasets */, links /* studio/trace link helpers */ , night, params }
// A flow view ends by calling ctx.nav('<next view>', { ...outputsToCarry }).
```
Flow order the shell enforces: `title -> tour -> casting -> writers -> (rehearsal) -> show -> reviews -> almanac -> playbill -> road -> tour ...`
(`show` is Shell-Core's page hosting the Stage). `greenroom` and `datasets` are reachable from `tour` any time.
