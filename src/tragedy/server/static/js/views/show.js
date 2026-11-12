// show: THE page that hosts the Stage. Runs the `performance` graph through runFlow, performs every custom event on the
// canvas theatre (js/stage/stage.js, or the DOM fallback in core/textstage.js), opens the Prompter's Box when a major mishap
// freezes the stage, keeps a film strip of per-beat checkpoints ("Take it from the top" forks the show with an Encore token),
// and ends with the curtain call, the paper audience's vote between timelines, and the way on to the reviews.
import { h, svg, stickToBottom } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { puppetAvatar } from '../core/glyphs.js';
import { lsGet, lsSet } from '../core/store.js';
import * as ui from '../ui.js';

const BEATS = ui.BEATS;
const CUE_KEYS = 'qwerty';
const first = (n) => String(n || '').replace(/^(Sir|Mr\.|Mrs\.|Captain|The)\s+/, '').split(' ')[0];

/** Index of a beat given as 0-4 or by name. Pure. */
export function beatIndex(b) {
  if (typeof b === 'number') return b;
  const i = BEATS.indexOf(String(b));
  return i >= 0 ? i : Number.isFinite(Number(b)) ? Number(b) : -1;
}

/** Deterministic paper-audience vote between timelines (12 seats). Pure. warmths: [n]. Returns {votes:[n], seats:[idx], winner}. */
export function audienceVote(warmths, seed = 0) {
  const w = warmths.map((x) => Math.exp((Number(x) || 0) / 9));
  const total = w.reduce((a, x) => a + x, 0);
  const seats = [];
  const votes = warmths.map(() => 0);
  for (let s = 0; s < 12; s++) {
    const r = (ui.hash32(`${seed}:vote:${s}`) % 10000) / 10000;
    let acc = 0;
    let pick = w.length - 1;
    for (let i = 0; i < w.length; i++) {
      acc += w[i] / total;
      if (r <= acc) {
        pick = i;
        break;
      }
    }
    seats.push(pick);
    votes[pick]++;
  }
  let winner = 0;
  for (let i = 1; i < votes.length; i++) if (votes[i] > votes[winner] || (votes[i] === votes[winner] && warmths[i] > warmths[winner])) winner = i;
  return { votes, seats, winner };
}

function paperFigure(i, letter, color) {
  const s = svg('svg', { class: 'pf', viewBox: '0 0 40 64', width: 40, height: 64, 'aria-hidden': 'true', style: { '--i': i } });
  s.append(svg('rect', { x: 4, y: 0, width: 32, height: 22, rx: 3, class: 'pf-card', fill: color }), svg('text', { x: 20, y: 16, 'text-anchor': 'middle', class: 'pf-letter' }, letter), svg('circle', { cx: 20, cy: 33, r: 7, class: 'pf-head' }), svg('path', { d: 'M6 64 C6 46 12 41 20 41 C28 41 34 46 34 64Z', class: 'pf-body', fill: color }), svg('path', { d: 'M12 24 L14 41 M28 24 L26 41', class: 'pf-arm' }));
  return s;
}

export async function mount(root, ctx) {
  if (!ctx.require(['cast', 'script'], 'casting')) return {};
  const { tour, signal } = ctx;
  const cast = ctx.params.cast;
  const script = ctx.params.script;
  const genre = ctx.data.genre(script.genre || ctx.params.genre) || ctx.data.genres[0] || { name: 'Play', roles: {} };
  const town = ctx.town || ctx.data.town(ctx.params.town) || { name: 'town' };
  const person = (id) => ctx.data.person(id) || { id, name: id };
  const input = ctx.inputBase({ genre: script.genre || ctx.params.genre, cast, script });
  const roleName = (r) => genre.roles?.[r] || r;

  // ---- state ------------------------------------------------------------------------------------------------------
  let stage = null;
  // 0 skip | 1 | 2. A player who picked double speed keeps it on later nights (skip is per-beat, never remembered).
  // "1x" runs a quarter faster than the stage's authored timings: a played-through audit found a beat took ~35 s and the first decision came
  // 2 min 38 s in. The engine now guarantees a decision by the second beat; this trims the dead air between them. 2x is still twice "1x".
  const BASE_PACE = 1.25;
  const paceOf = (v) => (v === 0 ? 0 : v * BASE_PACE);
  let speedMode = lsGet('show_speed', 1) === 2 ? 2 : 1;
  let threadId = null;
  let phase = 'loading'; // loading | running | boxed | done | error
  let runAbort = null;
  let gen = 0;
  const timelines = []; // {label, result, log, warmth}
  const cells = new Array(5).fill(null); // film strip: {checkpoint_id, beat, logIndex, values, gen}
  let boxState = null; // {close()}
  const disposers = [];
  let lastSpeaker = null;

  // ---- layout -------------------------------------------------------------------------------------------------------
  const pips = ui.progressPips(5, 0, { label: 'Beats', labels: BEATS.map((b) => ui.BEAT_NAMES[b]) });
  const warmth = ui.meter({ label: 'Warmth', tone: 'warmth', icon: 'heart', value: 0 });
  const chaos = ui.meter({ label: 'Chaos', tone: 'chaos', icon: 'tangle', value: 0 });
  const caption = h('div', { class: 'show-caption', 'aria-live': 'polite' }, h('span', { class: 'cap-who' }), h('span', { class: 'cap-text' }));
  const frame = h('div', { class: 'show-frame' });
  const stageHost = h('div', { class: 'show-stage-host' });
  const toast = h('div', { class: 'show-banner', hidden: true, role: 'status' });
  const logList = h('ol', { class: 'show-log-list', 'aria-label': 'Stage log' });
  const logFollow = stickToBottom(logList);
  const film = h('div', { class: 'film', role: 'list' });
  const encoreEl = h('b', null, String(tour.encore ?? 0));
  const below = h('div', { class: 'show-below' });
  const callHost = h('div', { class: 'call-host' });
  const speedBtns = [
    ['skip', 0, 'Skip: perform everything instantly until the next decision', 'skip'],
    ['1x', 1, 'Normal speed', 'play'],
    ['2x', 2, 'Double speed', 'fast'],
  ].map(([label, v, title, ic]) => h('button', { type: 'button', title, 'aria-pressed': String(v === speedMode), 'data-v': v, onclick: () => setSpeed(v) }, icon(ic, 'sm'), h('span', null, label)));

  function setSpeed(v) {
    speedMode = v;
    if (v === 1 || v === 2) lsSet('show_speed', v);
    if (stage) stage.speed = paceOf(v);
    speedBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === v)));
  }

  const castRow = h(
    'div',
    { class: 'show-cast' },
    ...['lead', 'villain', 'fool'].map((r) => {
      const p = person(cast[r]);
      return h('div', { class: 'cast-chip' }, puppetAvatar(p, { size: 38, strings: false }), h('div', null, h('div', { class: 'sc-name' }, first(p.name)), h('div', { class: 'tiny muted' }, roleName(r))));
    }),
  );

  frame.append(stageHost, toast);
  const bar = h('div', { class: 'show-bar' }, pips, h('div', { class: 'show-meters' }, warmth, chaos));

  const head = h(
    'header',
    { class: 'show-head' },
    h('div', { class: 'grow' }, h('div', { class: 'kicker' }, `Night ${(tour.night ?? 0) + 1} of 5 · ${town.name} · ${genre.name}`), h('h1', { class: 'display show-title' }, script.title), h('p', { class: 'hand show-tag' }, script.tagline || '')),
    h('div', { class: 'show-controls' }, h('div', { class: 'tabs speed', role: 'group', 'aria-label': 'Speed' }, ...speedBtns), castRow),
  );

  const filmCard = ui.card(
    { tone: 'plum', class: 'film-card' },
    h('div', { class: 'row between wrap' }, h('div', null, h('div', { class: 'kicker' }, 'The film strip'), h('h3', { class: 'display' }, 'Take it from the top')), h('div', { class: 'film-encore' }, icon('ticket'), h('span', null, encoreEl, ' Encore ', h('span', { class: 'muted small' }, 'to spend')))),
    film,
    h('p', { class: 'small muted film-hint' }, 'Once the curtain falls (or while the stage is frozen) pick a beat and replay from there. The first timeline stays on stage as a ghost, and the paper audience votes on the warmer ending.'),
  );
  const logCard = ui.card({ tone: 'paper', class: 'log-card' }, h('div', { class: 'kicker' }, 'Stage log'), logList);
  below.append(filmCard, logCard);
  const view = h('div', { class: 'show-view' }, head, bar, frame, caption, callHost, below);
  root.append(view);

  function paintFilm() {
    const canRewind = (phase === 'done' || phase === 'boxed') && (ctx.tour?.encore ?? 0) > 0;
    encoreEl.textContent = String(ctx.tour?.encore ?? 0);
    film.replaceChildren(
      ...BEATS.map((b, i) => {
        const c = cells[i];
        const v = c?.meters || {};
        return h(
          'div',
          { class: ['film-cell', c && 'has', c && i === currentBeat && phase === 'running' && 'now'], role: 'listitem' },
          h('div', { class: 'fc-top' }, h('span', { class: 'fc-num display' }, i + 1), h('span', { class: 'fc-name' }, ui.BEAT_NAMES[b])),
          c
            ? h('div', { class: 'fc-thumb', title: 'Where the beat starts' }, h('span', { class: 'fc-bar w', style: { '--v': `${v.warmth ?? 50}%` } }), h('span', { class: 'fc-bar c', style: { '--v': `${v.chaos ?? 10}%` } }), h('span', { class: 'fc-nums tiny' }, `♥ ${v.warmth == null ? '-' : Math.round(v.warmth)}  ≈ ${v.chaos == null ? '-' : Math.round(v.chaos)}`))
            : h('div', { class: 'fc-thumb empty' }, h('span', { class: 'tiny muted' }, 'not yet')),
          c && ui.button('From here', { size: 'sm', variant: 'gold', icon: 'rewind', disabled: !canRewind, title: canRewind ? 'Spend an Encore token and replay from this beat' : (ctx.tour?.encore ?? 0) > 0 ? 'Available once the curtain falls' : 'No Encore tokens left', onclick: () => rewindFrom(i) }),
        );
      }),
    );
  }
  let currentBeat = 0;

  // ---- stage ---------------------------------------------------------------------------------------------------
  const stageData = { performers: ctx.data.performers, staff: ctx.data.staff, tastes: ctx.data.tastes, cues: ctx.data.cues, props: ctx.data.props };
  const reducedMotion = ui.prefersReducedMotion();
  async function makeStage() {
    try {
      const mod = await import('../stage/stage.js');
      const canvas = h('canvas', { class: 'show-canvas stage-canvas', width: 1280, height: 720, role: 'img', 'aria-label': 'The puppet theatre. The captions below tell the story in text.' });
      stageHost.replaceChildren(canvas);
      const s = new mod.Stage(canvas, { data: stageData, seed: tour.seed, reducedMotion });
      s.kind = 'canvas';
      return s;
    } catch (e) {
      console.info('canvas stage unavailable, using the paper fallback:', e?.message || e);
      stageHost.replaceChildren();
      const mod = await import('../core/textstage.js');
      const s = new mod.TextStage(stageHost, { data: stageData, seed: tour.seed, reducedMotion });
      s.kind = 'text';
      return s;
    }
  }
  stage = await makeStage();
  if (signal.aborted) {
    stage.destroy?.();
    return {};
  }
  stage.speed = paceOf(speedMode);
  frame.dataset.stage = stage.kind;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => stage.resize?.()) : null;
  ro?.observe(frame);
  disposers.push(() => ro?.disconnect());
  stage.on?.('actor', (id) => {
    const p = person(id);
    flash(`${p.name}: ${p.blurb || ''}`);
  });

  let flashT = null;
  function flash(text, ms = 3200) {
    toast.hidden = false;
    toast.textContent = text;
    clearTimeout(flashT);
    flashT = setTimeout(() => (toast.hidden = true), ms);
  }

  // ---- event handling ----------------------------------------------------------------------------------------------
  const nameOf = (id) => first(person(id).name);
  function say(who, text) {
    caption.querySelector('.cap-who').textContent = who ? `${who}: ` : '';
    caption.querySelector('.cap-text').textContent = text || '';
  }
  function logLine(cls, text) {
    if (!text) return;
    logList.append(h('li', { class: cls }, text));
    while (logList.children.length > 240) logList.firstChild.remove();
    // Scroll the log's OWN box, never the page: scrollIntoView() also scrolls the window, and the log card sits below the stage,
    // so every spoken line used to drag the viewport down to the log and away from the show. Stays put if the player scrolled up.
    logFollow.follow();
  }

  function onEvent(ev) {
    const d = ev.data || {};
    switch (ev.kind) {
      case 'stage.beat':
        currentBeat = d.index;
        pips.set(d.index);
        logLine('lg-beat', `${d.index + 1}. ${d.name}: ${d.logline}`);
        paintFilm();
        break;
      case 'stage.direct':
        say('Madame', d.text);
        logLine('lg-direct', `Madame: ${d.text}`);
        break;
      case 'stage.line':
        lastSpeaker = d.actor;
        say(nameOf(d.actor), d.text);
        logLine('lg-line', `${nameOf(d.actor)}: ${d.text}`);
        break;
      case 'stage.mishap':
        flash(`${d.title}`, 4200);
        say('', d.text);
        logLine(`lg-mishap ${d.severity}`, `${d.severity === 'major' ? 'MAJOR' : 'minor'}: ${d.title}. ${d.text}`);
        break;
      case 'stage.decision':
        logLine('lg-decision', `${d.by === 'prompter' ? 'You whispered' : 'Madame handled it'}: ${d.label}${d.cue ? ` + ${d.cue} cue` : ''}${d.text ? ` ("${d.text}")` : ''}`);
        if (d.line) say('Madame', d.line);
        break;
      case 'stage.cue':
        flash(d.text, 3600);
        logLine(`lg-cue ${d.outcome}`, `${d.outcome === 'miracle' ? 'Miracle' : 'Misfire'}: ${d.text}`);
        break;
      case 'stage.chain':
        logLine('lg-chain', `Yes, and... ${d.actors.map(nameOf).join(' and ')}: "${(d.lines || [])[0] || ''}" (+${d.bonus})`);
        break;
      case 'audience.tally': {
        const parts = Object.entries(d.counts || {}).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
        logLine('lg-house', `The house: ${parts.join(', ')} (${d.delta >= 0 ? '+' : ''}${d.delta})`);
        break;
      }
      case 'meter':
        warmth.set(d.warmth);
        chaos.set(d.chaos);
        break;
      case 'stage.why': {
        // why the house moved this beat: the town's taste, a real prop, the tangle... (a playtest could not tell why a night scored what it did)
        const top = (d.chips || []).slice(0, 3).map((c) => `${c.label} ${c.value > 0 ? '+' : ''}${c.value}`);
        if (top.length) flash(`The house ${d.delta >= 0 ? 'warmed' : 'cooled'} ${d.delta > 0 ? '+' : ''}${d.delta}: ${top.join(' · ')}`, 5200);
        logLine('lg-why', `Why: ${d.text}`);
        break;
      }
      case 'stage.curtain':
        warmth.set(d.warmth);
        chaos.set(d.chaos);
        logLine('lg-beat', `Curtain. ${d.knotted ? 'The strings are knotted.' : 'The strings held.'}`);
        break;
      default:
        break;
    }
  }

  const pace = async (ev) => {
    try {
      await stage.apply(ev);
    } catch (e) {
      console.warn('stage.apply failed for', ev.kind, e);
    }
  };

  function onCheckpoint(c) {
    const b = beatIndex(c.beat);
    if (b < 0 || b > 4) return;
    const cur = cells[b];
    const prefer = (c.next || []).some((n) => /direct/.test(n));
    if (cur && cur.gen === gen && !(prefer && !cur.prefer)) return;
    cells[b] = { checkpoint_id: c.checkpoint_id, beat: b, logIndex: stage.log?.length ?? 0, values: c.values, meters: c.meters || {}, gen, prefer };
    paintFilm();
  }

  // ---- the Prompter's Box ------------------------------------------------------------------------------------------------
  function promptersBox(payload) {
    return new Promise((resolve) => {
      const wasSkip = speedMode === 0;
      if (wasSkip) setSpeed(1);
      phase = 'boxed';
      frame.classList.add('boxed');
      paintFilm();
      const m = payload.mishap || {};
      const actor = person(m.actor);
      const beatName = typeof payload.beat === 'string' ? payload.beat : BEATS[payload.beat] || BEATS[payload.beat_index] || '';
      let selectedCue = null;
      const input = payload.free_text === false ? null : ui.input({ placeholder: 'Or whisper something of your own...', 'aria-label': 'Whisper something of your own', maxlength: 140 });
      const cueInfo = h('div', { class: 'box-cue-info small hand' }, 'A cue that fits the moment is a miracle; one that does not is a (funny) misfire.');
      const cueBtns = (payload.cues || []).map((c, i) => {
        const def = ctx.data.cue(c.id) || {};
        const b = h(
          'button',
          {
            class: 'box-cue',
            type: 'button',
            disabled: !(c.uses_left > 0),
            'aria-pressed': 'false',
            title: def.fits ? `Fits: ${def.fits.join(', ')}` : c.label,
            onclick: () => toggleCue(c.id, b, def),
          },
          h('span', { class: 'bc-emoji', 'aria-hidden': 'true' }, c.emoji),
          h('span', { class: 'bc-label' }, c.label),
          h('span', { class: 'bc-left tiny' }, c.uses_left > 0 ? `${c.uses_left} left` : 'used up'),
          ui.kbd(CUE_KEYS[i]?.toUpperCase() || ''),
        );
        b.dataset.id = c.id;
        return b;
      });
      function toggleCue(id, btn, def) {
        selectedCue = selectedCue === id ? null : id;
        cueBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === selectedCue)));
        cueInfo.textContent = selectedCue ? `${def.label || id}: fits ${(def.fits || []).join(', ') || 'who knows'}. This moment is tagged ${(m.tags || []).join(', ') || '...'}.` : 'A cue that fits the moment is a miracle; one that does not is a (funny) misfire.';
        void btn;
      }
      const optBtns = (payload.options || []).map((o, i) =>
        h('button', { class: 'box-opt', type: 'button', onclick: () => commit(o.id), 'data-id': o.id }, h('span', { class: 'bo-key' }, String(i + 1)), h('span', { class: 'bo-text' }, h('span', { class: 'display bo-label' }, o.label), h('span', { class: 'hand bo-hint' }, o.hint || ''))),
      );
      const whisperBtn = ui.button('Whisper it', { variant: 'primary', icon: 'ear', disabled: true, onclick: () => commit(null) });
      input?.addEventListener('input', () => (whisperBtn.disabled = !input.value.trim()));
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          e.preventDefault();
          commit(null);
        }
        e.stopPropagation();
      });

      const overlay = h(
        'div',
        { class: 'box-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': "The Prompter's Box" },
        h(
          'div',
          { class: 'box-card paper' },
          h('div', { class: 'box-top' }, ui.stamp(m.severity === 'major' ? 'Major mishap' : 'Mishap', 'crimson'), h('span', { class: 'kicker' }, `The Prompter's Box · ${ui.BEAT_NAMES[beatName] || beatName}`)),
          h('div', { class: 'box-mishap' }, h('div', { class: 'box-avatar' }, puppetAvatar(actor, { size: 76 })), h('div', { class: 'grow' }, h('h2', { class: 'display box-title' }, m.title), h('p', { class: 'box-text' }, m.text), h('div', { class: 'row gap-1 wrap' }, ...(m.tags || []).map((t) => ui.chip(t.replace(/_/g, ' ')))))),
          h('div', { class: 'box-section' }, h('div', { class: 'kicker' }, 'Whisper'), h('div', { class: 'box-opts' }, ...optBtns)),
          payload.cues?.length && h('div', { class: 'box-section' }, h('div', { class: 'kicker' }, 'And perhaps a cue'), h('div', { class: 'box-cues' }, ...cueBtns), cueInfo),
          input && h('div', { class: 'box-section' }, h('div', { class: 'kicker' }, 'Or in your own words'), h('div', { class: 'row gap-2' }, h('div', { class: 'grow' }, input), whisperBtn)),
          h('div', { class: 'box-foot tiny muted' }, 'Press 1, 2 or 3 to whisper · ', payload.cues?.length ? 'Q W E R T Y toggle a cue · ' : '', 'Nobody is counting down. The stage will wait.'),
        ),
      );
      document.body.append(overlay);
      requestAnimationFrame(() => {
        overlay.classList.add('on');
        optBtns[0]?.focus({ preventScroll: true });
      });

      const onKey = (e) => {
        if (e.target === input || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        const oi = '123456789'.indexOf(k);
        if (oi >= 0 && optBtns[oi]) return (e.preventDefault(), commit(payload.options[oi].id));
        const ci = CUE_KEYS.indexOf(k);
        if (ci >= 0 && cueBtns[ci] && !cueBtns[ci].disabled) return (e.preventDefault(), cueBtns[ci].click());
      };
      document.addEventListener('keydown', onKey);

      function close() {
        document.removeEventListener('keydown', onKey);
        overlay.classList.remove('on');
        setTimeout(() => overlay.remove(), ui.prefersReducedMotion() ? 0 : 260);
        frame.classList.remove('boxed');
        boxState = null;
      }
      function commit(optionId) {
        const text = input?.value.trim() || null;
        if (!optionId && !text) return;
        close();
        phase = 'running';
        paintFilm();
        resolve({ option: optionId, cue: selectedCue, text });
      }
      boxState = { close, wasSkip };
    });
  }

  async function onInterrupt(payload) {
    if (payload?.kind === 'prompters_box') return promptersBox(payload);
    // anything else the server asks of us during a show: show it, answer with an empty dict
    const m = ui.modal({ title: 'The stage has frozen', body: h('pre', { class: 'codeblock' }, JSON.stringify(payload, null, 2)), actions: [ui.button('Carry on', { variant: 'primary', onclick: () => m.close(true) })] });
    await m.closed;
    return {};
  }

  // ---- running -------------------------------------------------------------------------------------------------------
  function showError(err) {
    phase = 'error';
    frame.classList.remove('boxed');
    callHost.replaceChildren(
      ui.card(
        { tone: 'paper', class: 'call-card error-card' },
        h('div', { class: 'row gap-3' }, icon('alert', 'xl'), h('div', null, h('h2', { class: 'display' }, 'The show has stopped'), h('p', null, err.message || String(err)))),
        h('div', { class: 'row gap-2 wrap' }, ui.button('Try the scene again', { variant: 'primary', icon: 'refresh', onclick: () => startShow() }), ui.button('Back to the tour', { variant: 'ghost', onclick: () => ctx.nav('tour') })),
      ),
    );
  }

  async function play({ checkpoint = null } = {}) {
    runAbort = new AbortController();
    const ac = runAbort;
    const relay = () => ac.abort();
    signal.addEventListener('abort', relay, { once: true });
    phase = 'running';
    callHost.replaceChildren();
    paintFilm();
    const known = new Set([...ctx.data.performers, ...ctx.data.staff].map((p) => p.id));
    try {
      const out = await ctx.runFlow({
        graph: 'performance',
        input: checkpoint ? null : input,
        threadId,
        checkpoint,
        signal: ac.signal,
        known,
        pace,
        onEvent,
        onToken: ({ actor, text }) => stage.token?.(actor || lastSpeaker, text),
        onCheckpoint,
        onInterrupt,
        tokenGap: (it) => (stage.speed === 0 ? 0 : Math.min(80, it.gap || 0) / (stage.speed || 1)),
      });
      threadId = out.threadId;
      const result = out.values?.result || out.values;
      if (!result || result.warmth === undefined) throw new Error('The performance ended without a result.');
      finish(result);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      showError(e);
    } finally {
      signal.removeEventListener('abort', relay);
    }
  }

  function startShow() {
    stage.reset?.();
    timelines.length = 0;
    cells.fill(null);
    logList.replaceChildren();
    logFollow.pin();
    warmth.set(0);
    chaos.set(0);
    pips.set(0);
    gen = 0;
    stage.setGhost?.(null);
    return play();
  }

  function finish(result) {
    phase = 'done';
    const label = String.fromCharCode(65 + timelines.length);
    timelines.push({ label, result, log: (stage.log || []).slice(), warmth: result.warmth });
    pips.set(5);
    paintFilm();
    drawCurtainCall();
  }

  async function rewindFrom(i) {
    const c = cells[i];
    if (!c) return;
    if ((ctx.tour?.encore ?? 0) < 1) return ui.toast({ title: 'No Encore tokens left', body: 'Enshrine a Tradition in the Almanac to earn one.', tone: 'accent' });
    const ok = await ui.confirmDialog({ title: 'Take it from the top?', body: h('div', null, h('p', null, `Replay from beat ${i + 1}, ${ui.BEAT_NAMES[BEATS[i]]}. This spends one Encore token.`), h('p', { class: 'small muted' }, 'The Store remembers the token; the thread does not. Your first timeline stays on stage as a ghost.')), confirm: 'Spend a token', cancel: 'Not yet', tone: 'gold' });
    if (!ok) return;
    try {
      await ctx.api.rewind(ctx.tour.id);
    } catch (e) {
      return ui.toast({ title: 'The Encore was refused', body: e.message, tone: 'danger' });
    }
    ctx.refreshTour().then(paintFilm);
    // stop the current run (if the Box is open) and clear its overlay
    if (phase === 'boxed') {
      boxState?.close();
      runAbort?.abort();
    }
    if (!timelines.length) timelines.push({ label: 'A', result: null, log: (stage.log || []).slice(), warmth: 0 });
    const ghost = timelines[0].log;
    const prefix = (stage.log || []).slice(0, c.logIndex);
    callHost.replaceChildren();
    const sp = stage.speed;
    stage.reset?.();
    stage.speed = 0;
    for (const ev of prefix) await pace(ev);
    stage.speed = sp;
    stage.setGhost?.(ghost);
    // later beats get new checkpoints; this one stays forkable
    for (let k = i + 1; k < 5; k++) cells[k] = null;
    gen++;
    currentBeat = i;
    pips.set(i);
    warmth.set(c.meters?.warmth ?? 0);
    chaos.set(c.meters?.chaos ?? 0);
    logLine('lg-beat', `-- Taking it from the top: beat ${i + 1} --`);
    view.scrollIntoView?.({ behavior: ui.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    play({ checkpoint: { checkpoint_id: c.checkpoint_id } });
  }

  // ---- curtain call ---------------------------------------------------------------------------------------------------
  function drawCurtainCall() {
    const last = timelines[timelines.length - 1];
    const r = last.result;
    const multi = timelines.length > 1;
    let chosen = timelines.length - 1;
    const mishaps = r.mishaps || [];
    const card = ui.card(
      { tone: 'gold', class: 'call-card pop-in' },
      h('div', { class: 'call-top' }, ui.stamp('Curtain call', 'crimson'), h('h2', { class: 'display' }, multi ? `Ending ${last.label}` : 'The curtain falls'), h('p', { class: 'hand' }, r.chaos >= 60 ? 'The strings are in a magnificent knot.' : r.warmth >= 70 ? 'They are on their feet. Some of them.' : 'It happened, at least. Everybody was there.')),
      h('div', { class: 'call-metrics' }, ui.meter({ label: 'Warmth', tone: 'warmth', icon: 'heart', value: r.warmth }), ui.meter({ label: 'Chaos', tone: 'chaos', icon: 'tangle', value: r.chaos }), ui.meter({ label: 'Craft', tone: 'gold', icon: 'quill', value: r.quality_avg ?? 0 })),
      h('div', { class: 'call-stats small' }, ui.chip(`${mishaps.length} mishap${mishaps.length === 1 ? '' : 's'}`), ui.chip(`${r.yes_and ?? 0} yes-and`), ui.chip(`${r.tradition_hits ?? 0} tradition${r.tradition_hits === 1 ? '' : 's'} honoured`), ui.chip(`${(r.cues_used || []).length} cue${(r.cues_used || []).length === 1 ? '' : 's'}`)),
      mishaps.length > 0 && h('ul', { class: 'call-mishaps' }, ...mishaps.slice(0, 6).map((m) => h('li', null, h('b', null, m.title), h('span', { class: 'muted' }, ` · ${nameOf(m.actor)}${m.decision ? ` · ${String(m.decision).replace(/_/g, ' ')}` : ''}`)))),
    );
    const parts = [card];
    let voteCard = null;
    if (multi) {
      const vote = audienceVote(timelines.map((t) => t.warmth), tour.seed);
      chosen = vote.winner;
      const colors = ['#b3263d', '#2f7a8c', '#7a5aa8', '#c97a1e'];
      voteCard = ui.card(
        { tone: 'paper', class: 'vote-card pop-in' },
        h('div', { class: 'kicker' }, 'The paper audience votes'),
        h('h3', { class: 'display' }, 'Which ending was warmer?'),
        h('div', { class: 'vote-row' }, ...vote.seats.map((idx, s) => paperFigure(s, timelines[idx].label, colors[idx % colors.length]))),
        h('div', { class: 'vote-tally' }, ...timelines.map((t, i) => h('div', { class: ['vt', i === vote.winner && 'win'] }, h('span', { class: 'vt-l display', style: { color: colors[i % colors.length] } }, t.label), h('span', null, `${vote.votes[i]} votes`), h('span', { class: 'muted small' }, `warmth ${t.warmth}`)))),
        h('p', { class: 'hand' }, `Ending ${timelines[vote.winner].label} wins${vote.votes[vote.winner] === vote.votes.reduce((a, b) => Math.max(a, b), 0) && vote.votes.filter((v) => v === vote.votes[vote.winner]).length > 1 ? ' on warmth' : ''}. But you choose which one goes to the critics.`),
        h(
          'div',
          { class: 'row gap-2 wrap' },
          ...timelines.map((t, i) =>
            ui.button(`Keep ending ${t.label}`, {
              size: 'sm',
              variant: i === vote.winner ? 'gold' : 'paper',
              onclick: (e) => {
                chosen = i;
                e.currentTarget.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('picked'));
                e.currentTarget.classList.add('picked');
                go.querySelector('.btn-label').textContent = `To the reviews (ending ${t.label})`;
              },
            }),
          ),
        ),
      );
      parts.push(voteCard);
    }
    const go = ui.button(multi ? `To the reviews (ending ${timelines[chosen].label})` : 'To the reviews', { variant: 'primary', size: 'lg', icon: 'quill', onclick: () => ctx.nav('reviews', { result: timelines[chosen].result, rewound: multi, threadId }) });
    parts.push(h('div', { class: 'call-go' }, go, (ctx.tour?.encore ?? 0) > 0 && h('span', { class: 'small muted' }, 'or pick a beat in the film strip below and take it from the top')));
    callHost.replaceChildren(...parts);
    setTimeout(() => callHost.scrollIntoView?.({ behavior: ui.prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' }), 300);
    if (r.warmth >= 75) ui.confetti({ count: 90, origin: { x: 0.5, y: 0.25 }, duration: 2200 });
  }

  // go
  paintFilm();
  say('', 'The house lights are down. Madame clears her throat.');
  startShow();

  return {
    unmount() {
      boxState?.close();
      runAbort?.abort();
      clearTimeout(flashT);
      disposers.forEach((f) => f());
      try {
        stage?.destroy?.();
      } catch (e) {
        console.warn('stage.destroy failed', e);
      }
    },
  };
}
