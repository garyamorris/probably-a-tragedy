// THE ROAD (graph: the_road -> refreshTour() then nav('tour'))
// A parallax scene of the wagon, pulled by a tireless ostrich, trundles from town A to town B as road.step events arrive.
// road.event shows the crossroads card; the crossroads interrupt resumes {choice}. The graph's `crash` option is REAL durable
// execution: road.crash {recovered:false} then the run ERRORS; we wobble the wagon, toast, and resume the same thread from its
// last checkpoint with input:null (the resumed run emits road.crash {recovered:true} then road.arrive).
import { h, clear } from '../core/dom.js';
import { scaffold, dataOf, createLife, skipControl, vbtn, tag, play, flash, burst, typewrite, tourInput, carry, nextTownId, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { RoadScene, landmarkImage } from './_kit/road-scene.js';
import * as P from './_kit/pure.js';

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'road',
    title: 'The Road',
    sub: 'One wagon, one ostrich with no sense of its own limits, and a long way to the next town.',
  });
  try { await ctx.loadData?.(['road_events']); } catch { /* the event card falls back to the labels */ }
  const D = dataOf(ctx);
  const fromId = ctx.params.town ?? ctx.tour?.wagon?.at;
  const toId = nextTownId(ctx);
  const from = D.towns[fromId] || { id: fromId, name: P.humanize(fromId || 'Somewhere'), sky: 'dusk', landmark: 'windmill' };
  const to = toId ? D.towns[toId] || { id: toId, name: P.humanize(toId), sky: 'dawn', landmark: 'bridge' } : null;
  const SK = ctx.ui.SKIES || {};
  const castColours = P.ROLES.map((r) => D.performers[ctx.params.cast?.[r]]?.palette?.body).filter(Boolean);

  /* ---------------------------------------------------------------- route strip */
  const pctFill = h('i', { class: 'rd-fill' });
  const wagonMark = h('span', { class: 'rd-mark' }, icon('wagon'));
  const stepLabel = h('p', { class: 'hand rd-step', 'aria-live': 'polite' }, to ? `Waiting to leave ${from.name}.` : '');
  const route = h('div', { class: 'rd-route v-paper' },
    h('div', { class: 'rd-town' }, ctx.ui.townSticker ? ctx.ui.townSticker(from, { size: 58 }) : null, h('div', null, h('div', { class: 'kicker' }, 'From'), h('b', { class: 'display' }, from.name))),
    h('div', { class: 'rd-track-wrap' }, h('div', { class: 'rd-track' }, pctFill, wagonMark), stepLabel),
    h('div', { class: 'rd-town rd-town-to' }, h('div', { class: 'rd-town-t' }, h('div', { class: 'kicker' }, 'To'), h('b', { class: 'display' }, to ? to.name : 'The end of the tour')), to && ctx.ui.townSticker ? ctx.ui.townSticker(to, { size: 58 }) : null));

  /* ---------------------------------------------------------------- the scene */
  const canvas = h('canvas', { class: 'rd-canvas', role: 'img', 'aria-label': 'The wagon, pulled by an ostrich, travelling along the road' });
  const banner = h('div', { class: 'rd-banner', hidden: true, role: 'status' });
  const eventBox = h('div', { class: 'rd-event v-paper', hidden: true });
  const arriveBox = h('div', { class: 'rd-arrive', hidden: true });
  const crashToggle = h('input', { type: 'checkbox', id: 'rd-crash' });
  const departBtn = vbtn(to ? `Depart for ${to.name}` : 'Nowhere left to go', { variant: 'gold', size: 'lg', icon: 'wagon', disabled: !to, onclick: () => depart() });
  const gate = h('div', { class: 'rd-gate' }, departBtn,
    h('label', { class: 'rd-crash', for: 'rd-crash', title: 'The the_road graph crashes once, then resumes from its last checkpoint' }, crashToggle, h('span', { class: 'rd-lever' }, h('i')), h('span', { class: 'rd-crash-t' }, h('b', null, 'Loosen a wheel nut'), h('small', null, 'a durable-execution demo: the run will crash, then resume from its checkpoint'))));
  const stage = h('div', { class: 'rd-stage' }, canvas, banner, eventBox, arriveBox, to ? gate : null);

  const scene = new RoadScene(canvas, {
    skyFrom: SK[from.sky] || SK.dusk, skyTo: SK[(to || from).sky] || SK.dawn, townFrom: from.name, townTo: to?.name, puppets: castColours, reduced: reduced(), seed: ctx.tour?.seed ?? 7,
  });
  life.onDispose(() => scene.destroy());
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scene.resize()) : null;
  ro?.observe(canvas);
  life.onDispose(() => ro?.disconnect());
  // landmarks load async; the scene paints without them until they arrive
  (async () => {
    try {
      const glyphA = ctx.ui.landmarkGlyph?.(from.landmark);
      const glyphB = to ? ctx.ui.landmarkGlyph?.(to.landmark) : null;
      const [a, b] = await Promise.all([landmarkImage(glyphA, '#2a1630'), landmarkImage(glyphB, '#2a1630')]);
      scene.o.landmarks = { from: a, to: b };
      scene.draw();
    } catch { /* the hills are enough */ }
  })();
  scene.start();

  S.main.append(route, stage);
  const skip = skipControl(life, S.slot);
  skip.hide();
  life.onskip = () => scene.jump();

  /* ---------------------------------------------------------------- events */
  let crashSeen = false;
  let choiceEffects = {};
  let resolveChoice = null;

  function chipsEl(effects) {
    const chips = P.effectChips(effects, D.performers);
    if (!chips.length) return null;
    return h('div', { class: 'rd-chips' }, chips.map((c) => h('span', { class: ['rd-chip', c.amount > 0 ? 'good' : 'bad', `k-${c.kind}`] }, icon(c.kind === 'funds' ? 'coin' : c.kind === 'encore' ? 'ticket' : c.kind === 'rapport' ? 'heart' : 'sparkle', 'sm'), c.label)));
  }

  function showStep(d) {
    const pct = P.roadPct(d.pct);
    pctFill.style.width = `${pct}%`;
    wagonMark.style.left = `${pct}%`;
    stepLabel.textContent = d.label || '';
    scene.setProgress(pct);
    const w = /rain|drizzle|storm|wet|damp|downpour/i.test(d.label || '') ? 'rain' : /fog|mist|haze/i.test(d.label || '') ? 'fog' : null;
    if (w !== null || /sun|clear|bright/i.test(d.label || '')) scene.setWeather(w);
  }

  function showEvent(d) {
    for (const c of d.choices || []) if (c.effects) choiceEffects[c.id] = c.effects;
    const ref = D.roadEvents[d.id];
    for (const c of ref?.choices || []) if (!choiceEffects[c.id] && c.effects) choiceEffects[c.id] = c.effects;
    scene.setMoving(false);
    clear(eventBox);
    eventBox.append(h('div', { class: 'kicker' }, 'The road offers a choice'), h('h3', { class: 'display rd-ev-title' }, d.title), h('p', { class: 'hand rd-ev-text' }, d.text), h('div', { class: 'rd-choices', 'aria-busy': 'true' }, h('span', { class: 'hand muted' }, 'The wagon has stopped, mostly of its own accord...')));
    eventBox.hidden = false;
    play(eventBox, [{ transform: 'translateY(40px) rotate(-1.5deg) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520 }, life);
    stepLabel.textContent = d.title;
  }

  function showCrash(d) {
    if (d.recovered) {
      scene.recover();
      banner.hidden = false;
      banner.dataset.tone = 'ok';
      banner.textContent = 'Resumed from the last checkpoint. Nothing was lost but a little dignity.';
      stepLabel.textContent = 'Back on the road.';
      ctx.toast?.({ title: 'Wagon patched up', body: 'The run resumed from its last checkpoint.', tone: 'ok', ttl: 3600 });
      life.later(() => { banner.hidden = true; scene.setMoving(true); }, 2400 / (life.speed || 1));
      return;
    }
    crashSeen = true;
    scene.crash();
    banner.hidden = false;
    banner.dataset.tone = 'bad';
    banner.textContent = `The wagon lost power (${d.node || 'apply'}). Resuming from the last checkpoint...`;
    flash(stage, 'shake', 600);
    ctx.toast?.({ title: 'The wagon lost power', body: 'Resuming from the last checkpoint...', tone: 'info', ttl: 4200 });
    stepLabel.textContent = 'The wagon lost power.';
  }

  function showArrive(d) {
    scene.arrive();
    pctFill.style.width = '100%';
    wagonMark.style.left = '100%';
    stepLabel.textContent = 'Arrived.';
    const t = D.towns[d.town] || to;
    scene.settle(life, 6000).then(() => life.later(() => {
      if (!t) return;
      clear(arriveBox);
      arriveBox.append(h('div', { class: 'rd-signpost', 'aria-hidden': 'true' }),
        h('div', { class: 'rd-sign' }, h('div', { class: 'rd-sign-art' }, ctx.ui.townSticker ? ctx.ui.townSticker(t, { size: 96 }) : null), h('div', { class: 'rd-sign-text' }, h('div', { class: 'kicker' }, 'Welcome to'), h('h3', { class: 'display' }, t.name), t.blurb ? h('p', { class: 'hand' }, t.blurb) : null, t.gossip ? h('p', { class: 'rd-gossip' }, t.gossip) : null)));
      arriveBox.hidden = false;
      play(arriveBox, [{ transform: 'translateX(60px) rotate(6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 650 }, life);
      burst(arriveBox, { n: 10, spread: 90, life });
    }, 500 / (life.speed || 1)));
  }

  function askCrossroads(payload) {
    skip.hide();
    const ev = payload.event || {};
    if (eventBox.hidden) showEvent({ id: ev.id, title: ev.title, text: ev.text, choices: [] });
    const box = eventBox.querySelector('.rd-choices');
    clear(box);
    box.removeAttribute('aria-busy');
    const frag = [];
    (payload.choices || []).forEach((c, i) => {
      const effects = choiceEffects[c.id] || D.roadEvents[ev.id]?.choices?.find((x) => x.id === c.id)?.effects || P.parseEffectLabel(c.label);
      const chips = chipsEl(effects);
      const label = chips ? String(c.label).replace(/\s*\([^)]*\)\s*$/, '') : c.label;
      frag.push(h('button', { class: 'rd-choice', type: 'button', style: { '--i': i }, onclick: () => pick(c, label, effects) },
        h('span', { class: 'rd-choice-post', 'aria-hidden': 'true' }), h('span', { class: 'rd-choice-label display' }, label), chips));
    });
    box.append(...frag);
    play(box, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380 }, life);
    stage.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    return new Promise((resolve) => { resolveChoice = resolve; });
  }

  function pick(c, label, effects) {
    if (!resolveChoice) return;
    const r = resolveChoice;
    resolveChoice = null;
    const box = eventBox.querySelector('.rd-choices');
    clear(box);
    box.append(h('div', { class: 'rd-chosen' }, h('span', { class: 'hand' }, `You chose: ${label}`), chipsEl(effects)));
    eventBox.classList.add('answered');
    life.later(() => { eventBox.hidden = true; scene.setMoving(true); }, 1700 / (life.speed || 1));
    skip.show();
    life.unskip();
    r({ choice: c.id });
  }

  /* ---------------------------------------------------------------- the journey */
  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    const d = ev.data || {};
    if (ev.kind === 'road.step') showStep(d);
    else if (ev.kind === 'road.event') showEvent(d);
    else if (ev.kind === 'road.crash') showCrash(d);
    else if (ev.kind === 'road.arrive') { seen.add('__arrived'); showArrive(d); }
  };

  async function threadFor() {
    const tid = ctx.tour?.id;
    if (!tid || typeof ctx.api?.tourThread !== 'function') return undefined; // runFlow will pick one; err.threadId covers the resume
    const t = await ctx.api.tourThread(tid, { graph: 'the_road' });
    await ctx.api.createThread?.({ thread_id: t.thread_id, if_exists: 'do_nothing', metadata: { tour_id: tid, night: ctx.tour?.night ?? null, graph: 'the_road' } });
    return t.thread_id;
  }

  let started = false;
  async function depart() {
    if (started || !to) return;
    started = true;
    departBtn.disabled = true;
    const wantCrash = crashToggle.checked;
    gate.hidden = true;
    stepLabel.textContent = `Leaving ${from.name}...`;
    skip.show();
    scene.setMoving(true);
    scene.setProgress(2);
    try {
      let threadId = await threadFor();
      const base = tourInput(ctx, { from_town: from.id, to_town: to.id, crash: wantCrash });
      let input = base;
      let out = null;
      for (let attempt = 0; ; attempt++) {
        try {
          out = await ctx.runFlow({
            graph: 'the_road',
            threadId,
            input,
            signal: life.signal,
            pace: async (ev) => {
              if (life.dead) return;
              ingest(ev);
              // the show waits for the trundle: the wagon has to actually get there
              if (ev.kind === 'road.step' || ev.kind === 'road.arrive') await scene.settle(life);
              else await life.wait(P.paceMs(ev.kind, 1));
            },
            onEvent: () => {},
            onToken: () => {},
            onInterrupt: askCrossroads,
          });
          break;
        } catch (err) {
          if (life.dead || isAbort(err)) return;
          // a real crash: everything before it is checkpointed, so resume the same thread with no new input
          if (crashSeen && attempt < 2) {
            threadId = err?.threadId || threadId;
            if (!threadId) throw err;
            crashSeen = false;
            await life.wait(2200);
            if (life.dead) return;
            input = null;
            continue;
          }
          throw err;
        }
      }
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      if (arriveBox.hidden && out.values?.arrived && !seen.has('__arrived')) showArrive({ town: out.values.arrived });
      skip.hide();
      scene.setMoving(false);
      await life.wait(1800);
      if (life.dead) return;
      showSummary(out.values || {});
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      scene.setMoving(false);
      clear(S.main);
      S.main.appendChild(errorCard(err, { title: 'The wagon has broken down for good', retry: () => ctx.nav('road', carry(ctx)) }));
    }
  }

  function showSummary(v) {
    const effects = v.effects;
    const chips = chipsEl(effects);
    if (chips && !arriveBox.hidden) arriveBox.querySelector('.rd-sign-text')?.append(h('div', { class: 'kicker rd-eff-k' }, 'The road left you with'), chips);
    const go = vbtn('Unpack the wagon', { variant: 'primary', size: 'lg', icon: 'chevron-right', onclick: async () => { go.disabled = true; try { await ctx.refreshTour?.(); } catch { /* the HUD can catch up later */ } ctx.nav('tour', {}); } });
    S.actions(go);
    S.foot.classList.add('v-foot-sticky');
  }

  if (!to) {
    // the last night: there is no next town; the tour page shows the verdict
    const end = vbtn('To the final curtain', { variant: 'primary', size: 'lg', icon: 'trophy', onclick: async () => { try { await ctx.refreshTour?.(); } catch { /* ok */ } ctx.nav('tour', {}); } });
    stepLabel.textContent = 'There is no next town. This was the last night.';
    S.actions(end);
    S.foot.classList.add('v-foot-sticky');
  }

  return { unmount() { life.dispose(); clear(root); } };
}
