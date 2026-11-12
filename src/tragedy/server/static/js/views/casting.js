// CASTING CALL (graph: casting_call -> next: writers)
// Eight paper puppets on a bench audition in turn; Madame recommends; the confirm_cast interrupt is three role slots you fill
// by clicking or dragging puppets. Resume value: {cast:{lead,villain,fool}} (PROTOCOL 2.1).
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, typewrite, countTo, makeDraggable, tourInput, carry, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { puppetMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

const ROLE_SHORT = { lead: 'Lead', villain: 'Villain', fool: 'Fool' };
const moodFor = (score) => (score >= 80 ? 'joy' : score >= 65 ? 'smug' : score >= 50 ? 'neutral' : score >= 35 ? 'fear' : 'grief');

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'casting',
    title: 'The Casting Call',
    sub: 'Eight puppets, three parts, and a director who has already decided.',
  });
  const D = S.D;
  const performers = D.performerList;
  const roleLabel = (r) => S.genre?.roles?.[r] ?? P.humanize(r);
  const flawName = (id) => D.flaws[id]?.name ?? P.humanize(id);

  const scores = { lead: {}, villain: {}, fool: {} };
  let proposed = null; // Madame's pick
  let cast = P.emptyCast();
  let held = null; // actor id lifted off the bench
  let activeRole = null; // slot waiting for a puppet
  let phase = 'auditions'; // auditions -> choose -> locked
  let resolveCast = null;

  /* ---------------------------------------------------------------- podium: spotlight, then Madame's scroll */
  const spotPuppet = h('div', { class: 'cc-spot-puppet' });
  const spotRole = h('div', { class: 'cc-spot-role' });
  const spotLine = h('p', { class: 'hand cc-spot-line' });
  const spotScore = h('div', { class: 'cc-spot-score' });
  const spot = h('div', { class: 'cc-spot v-paper' },
    h('div', { class: 'cc-spot-light' }), spotPuppet,
    h('div', { class: 'cc-spot-talk' }, spotRole, spotLine), spotScore);
  const madamePortrait = h('div', { class: 'cc-madame-pic' });
  const scrollText = h('p', { class: 'hand cc-scroll-text' });
  const scrollPicks = h('div', { class: 'cc-scroll-picks' });
  const scroll = h('div', { class: 'cc-scroll', hidden: true },
    madamePortrait,
    h('div', { class: 'cc-scroll-paper' }, h('div', { class: 'cc-scroll-head display' }, 'Madame Prunt recommends...'), scrollText, scrollPicks));
  const hint = h('p', { class: 'cc-state hand' }, 'The auditions have begun. Please do not feed the goose.');
  const podium = h('div', { class: 'cc-podium' }, spot, scroll);

  /* ---------------------------------------------------------------- the three slots */
  const slots = {};
  const slotRow = h('div', { class: 'cc-slots', role: 'group', 'aria-label': 'The cast' });
  for (const role of P.ROLES) {
    const empty = h('div', { class: 'cc-slot-empty' }, icon('plus'), h('span', null, 'Choose a puppet'));
    const occ = h('div', { class: 'cc-slot-occ' });
    const x = h('button', { class: 'cc-slot-x', type: 'button', 'aria-label': `Remove the ${ROLE_SHORT[role].toLowerCase()}`, title: 'Send back to the bench', onclick: (e) => { e.stopPropagation(); setSlot(role, null); } }, icon('x', 'sm'));
    const slotHint = h('div', { class: 'cc-slot-hint', 'aria-hidden': 'true' });
    const el = h('div', {
      class: 'cc-slot', 'data-drop': role, 'data-role': role, role: 'button', tabindex: '0', 'aria-label': `${roleLabel(role)}: empty`,
      onclick: () => clickSlot(role),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickSlot(role); } },
    },
    h('div', { class: 'cc-slot-arch' }, empty, occ, x, slotHint),
    h('div', { class: 'cc-slot-ribbon' }, h('span', { class: 'cc-slot-short' }, ROLE_SHORT[role]), h('span', { class: 'cc-slot-label display' }, roleLabel(role))));
    slots[role] = { el, empty, occ, x, hint: slotHint };
    slotRow.appendChild(el);
  }
  const ensemble = h('div', { class: 'cc-ensemble' },
    h('span', { class: 'kicker' }, 'Ensemble'), h('b', { class: 'cc-ens-n' }, '0'),
    h('span', { class: 'cc-ens-vs muted' }, ''));
  const verdict = h('p', { class: 'cc-verdict hand' });
  const actionRow = h('div', { class: 'cc-actions' });
  const slotsWrap = h('div', { class: 'cc-slots-wrap is-idle' }, slotRow, h('div', { class: 'cc-slots-foot' }, ensemble, verdict, actionRow));

  /* ---------------------------------------------------------------- the bench */
  const cards = {};
  const bench = h('div', { class: 'cc-bench', role: 'group', 'aria-label': 'The troupe' });
  for (const p of performers) {
    const face = h('div', { class: 'cc-face' });
    const seat = h('div', { class: 'cc-seat', hidden: true });
    const ribbon = h('div', { class: 'cc-ribbon', hidden: true });
    const bars = {};
    const barBox = h('div', { class: 'cc-bars' });
    for (const role of P.ROLES) {
      const fill = h('i');
      const num = h('span', { class: 'cc-bn' }, '--');
      const row = h('div', { class: 'cc-bar', 'data-role': role, title: `${roleLabel(role)}` }, h('span', { class: 'cc-bl' }, ROLE_SHORT[role]), h('div', { class: 'cc-track' }, fill), num);
      bars[role] = { fill, num, row };
      barBox.appendChild(row);
    }
    const flaws = h('div', { class: 'cc-flaws' }, (p.flaws || []).map((f) => tag(P.phrase(flawName(f)).replace(/^./, (c) => c.toUpperCase()), { tone: 'warn', ic: 'alert', title: 'A flaw: it will come up' })));
    const fits = (p.roles || []).length
      ? h('div', { class: 'cc-fits' }, 'Natural: ', (p.roles || []).map((r) => h('b', null, ROLE_SHORT[r])))
      : h('div', { class: 'cc-fits' }, 'Understudy: ', h('b', null, 'any role'), ' (steady everywhere)');
    const el = h('div', {
      class: 'cc-card v-paper', role: 'button', tabindex: '0', 'data-actor': p.id, 'aria-label': `${p.name}`, 'aria-pressed': 'false',
      onclick: () => clickPuppet(p.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickPuppet(p.id); } },
    }, ribbon, h('div', { class: 'cc-portrait' }, face, seat),
    h('h3', { class: 'display cc-name' }, p.name),
    h('p', { class: 'hand cc-blurb' }, p.blurb || ''),
    fits, flaws, barBox);
    cards[p.id] = { el, face, seat, ribbon, bars, p, mood: 'neutral' };
    paintFace(p.id, 'neutral');
    makeDraggable(el, {
      disabled: () => phase !== 'choose',
      onStart: () => { held = p.id; syncHeld(); },
      hover: (t) => slotRow.querySelectorAll('.cc-slot').forEach((s) => s.classList.toggle('drop-over', s === t)),
      onDrop: (t) => placeActor(t.dataset.drop, p.id),
      onEnd: () => { if (phase === 'choose') { held = null; syncHeld(); } },
    });
    bench.appendChild(el);
  }

  const benchWrap = h('div', { class: 'cc-benchwrap' }, h('div', { class: 'cc-bench-top' }, h('h2', { class: 'display' }, 'The Wibbling Players'), hint), bench, h('div', { class: 'cc-plank', 'aria-hidden': 'true' }));

  S.main.append(podium, slotsWrap, benchWrap);

  const skip = skipControl(life, S.slot);
  const acceptBtn = vbtn("Accept Madame's pick", { variant: 'gold', icon: 'check', disabled: true, onclick: () => acceptMadame() });
  const resetBtn = vbtn("Reset to Madame's", { variant: 'ghost', size: 'sm', icon: 'refresh', hidden: true, onclick: () => { cast = { ...proposed }; held = null; activeRole = null; renderSlots(true); syncHeld(); } });
  resetBtn.hidden = true;
  const confirmBtn = vbtn('Confirm this cast', { variant: 'primary', icon: 'chevron-right', disabled: true, onclick: () => confirm() });
  actionRow.append(resetBtn, acceptBtn, confirmBtn);

  /* ---------------------------------------------------------------- painting */
  function paintFace(id, mood, talking = false) {
    const c = cards[id];
    c.mood = mood;
    clear(c.face);
    const svg = svgEl(puppetMarkup(c.p, { view: 'bust', mood, cls: talking ? 'pp-talk' : '' }), { class: `pp pp-bust${talking ? ' pp-talk' : ''}` });
    c.face.appendChild(svg);
  }

  function setBar(actor, role, score, animate = true) {
    const b = cards[actor]?.bars[role];
    if (!b) return;
    b.fill.className = `t-${P.scoreTier(score)}`;
    b.fill.style.width = `${Math.max(3, score)}%`;
    b.row.dataset.tier = P.scoreTier(score);
    if (animate && !life.fast) countTo(b.num, score, { ms: 500, life });
    else b.num.textContent = String(score);
    markBest();
  }

  function markBest() {
    for (const role of P.ROLES) {
      const entries = Object.entries(scores[role]);
      if (!entries.length) continue;
      const top = Math.max(...entries.map(([, s]) => s));
      for (const [id, c] of Object.entries(cards)) c.bars[role].row.classList.toggle('best', scores[role][id] === top && entries.length >= performers.length * 0.5);
    }
  }

  function showAudition(d) {
    const p = D.performers[d.actor];
    if (!p) return;
    const c = cards[d.actor];
    scores[d.role][d.actor] = d.score;
    // the puppet steps forward
    for (const k of Object.values(cards)) k.el.classList.remove('performing');
    c.el.classList.add('performing');
    paintFace(d.actor, moodFor(d.score), true);
    life.later(() => { if (cards[d.actor].mood !== 'neutral') paintFace(d.actor, 'neutral'); c.el.classList.remove('performing'); }, 520 / (life.speed || 1));
    setBar(d.actor, d.role, d.score, true);
    // spotlight
    clear(spotPuppet);
    spotPuppet.appendChild(svgEl(puppetMarkup(p, { view: 'bust', mood: moodFor(d.score), cls: 'pp-talk' }), { class: 'pp pp-bust pp-talk' }));
    spotRole.textContent = `${p.name} auditions as ${roleLabel(d.role)}`;
    spotLine.textContent = `"${d.line}"`;
    spotScore.textContent = String(d.score);
    spotScore.dataset.tier = P.scoreTier(d.score);
    play(spotPuppet, [{ transform: 'translateX(-30px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260 }, life);
    play(spotLine, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260 }, life);
    play(spotScore, [{ transform: 'scale(.3) rotate(-18deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380 }, life);
  }

  function showRecommend(d) {
    proposed = { ...d.cast };
    Object.assign(scores, d.scores || {});
    for (const role of P.ROLES) for (const [a, s] of Object.entries(scores[role] || {})) setBar(a, role, s, false);
    for (const k of Object.values(cards)) k.el.classList.remove('performing');
    // Madame's scroll replaces the spotlight
    spot.hidden = true;
    scroll.hidden = false;
    clear(madamePortrait);
    madamePortrait.appendChild(svgEl(puppetMarkup(D.staff.madame || { id: 'madame', palette: { body: '#7d1527', accent: '#e9b949', hair: '#2a1630' }, kind: 'hand' }, { view: 'bust', mood: 'smug', hat: 'top' }), { class: 'pp pp-bust' }));
    typewrite(scrollText, d.note || 'Darling, no.', { cps: 80, life });
    clear(scrollPicks);
    for (const role of P.ROLES) {
      const p = D.performers[proposed[role]];
      scrollPicks.appendChild(h('span', { class: 'cc-pick' }, h('small', null, ROLE_SHORT[role]), ' ', p?.name ?? proposed[role]));
    }
    play(scroll, [{ transform: 'scaleY(.2) translateY(-30px)', opacity: 0, transformOrigin: 'top' }, { transform: 'none', opacity: 1, transformOrigin: 'top' }], { duration: 520 }, life);
    for (const role of P.ROLES) {
      const c = cards[proposed[role]];
      if (!c) continue;
      c.ribbon.hidden = false;
      c.ribbon.textContent = `Madame: ${ROLE_SHORT[role]}`;
      play(c.ribbon, [{ transform: 'translateY(-14px) scale(.6) rotate(-10deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 120 }, life);
    }
    hint.textContent = 'Madame has spoken. You may, of course, ignore her.';
  }

  /* ---------------------------------------------------------------- slots + selection */
  function renderSlots(animate = false) {
    for (const role of P.ROLES) {
      const s = slots[role];
      const id = cast[role];
      const p = id ? D.performers[id] : null;
      s.el.classList.toggle('filled', !!p);
      s.el.classList.toggle('active', activeRole === role);
      s.el.setAttribute('aria-label', `${roleLabel(role)}: ${p ? p.name : 'empty'}`);
      clear(s.occ);
      if (p) {
        const sc = P.slotScore(scores, role, id);
        const fit = P.roleFit(p, role);
        s.occ.append(
          h('div', { class: 'cc-occ-face' }, svgEl(puppetMarkup(p, { view: 'bust', mood: sc != null ? moodFor(sc) : 'neutral' }), { class: 'pp pp-bust' })),
          h('div', { class: 'cc-occ-name display' }, p.name),
          h('div', { class: 'cc-occ-fit' }, fit === 'natural' ? tag('Natural fit', { tone: 'ok' }) : fit === 'understudy' ? tag('Understudy', { tone: 'plain' }) : tag('Off-type (60)', { tone: 'warn', ic: 'alert' })),
          h('div', { class: 'cc-occ-score', 'data-tier': P.scoreTier(sc) }, h('b', null, sc ?? '--'), h('small', null, 'for this part')));
        if (animate) play(s.occ, [{ transform: 'translateY(16px) scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: P.ROLES.indexOf(role) * 110 }, life);
      }
    }
    // seat badges on cards
    for (const [id, c] of Object.entries(cards)) {
      const r = P.slotOf(cast, id);
      c.el.classList.toggle('seated', !!r);
      c.seat.hidden = !r;
      if (r) c.seat.textContent = ROLE_SHORT[r];
    }
    renderTotals();
  }

  function renderTotals() {
    const total = P.castTotal(cast, scores);
    const nEl = ensemble.querySelector('.cc-ens-n');
    nEl.textContent = String(total);
    const full = P.validateCast(cast, performers.map((p) => p.id));
    const pt = proposed ? P.castTotal(proposed, scores) : null;
    ensemble.querySelector('.cc-ens-vs').textContent = pt != null ? `Madame's pick: ${pt}` : '';
    if (phase === 'choose') {
      verdict.textContent = full.ok && pt != null ? P.castVerdict(total, pt).text : full.missing.length ? `Still empty: ${full.missing.map(roleLabel).join(', ')}.` : '';
      verdict.dataset.mood = full.ok && pt != null ? P.castVerdict(total, pt).mood : 'none';
      confirmBtn.disabled = !full.ok;
      const same = proposed && P.ROLES.every((r) => cast[r] === proposed[r]);
      resetBtn.hidden = !!same;
      acceptBtn.disabled = !proposed;
    }
  }

  function syncHeld() {
    for (const [id, c] of Object.entries(cards)) {
      c.el.classList.toggle('held', held === id);
      c.el.setAttribute('aria-pressed', String(held === id));
    }
    slotsWrap.classList.toggle('holding', !!held);
    for (const role of P.ROLES) {
      const s = slots[role];
      if (!held) { s.hint.textContent = ''; s.hint.dataset.show = '0'; continue; }
      const now = P.slotScore(scores, role, cast[role]) ?? 0;
      const would = P.slotScore(scores, role, held);
      const d = would != null ? would - now : null;
      s.hint.dataset.show = '1';
      s.hint.dataset.tier = P.scoreTier(would);
      s.hint.textContent = would == null ? '?' : `${would}${d && cast[role] !== held ? `  (${d > 0 ? '+' : ''}${d})` : ''}`;
    }
  }

  function setSlot(role, actor) {
    if (phase !== 'choose') return;
    cast = actor ? P.placeInSlot(cast, role, actor) : P.removeFromSlot(cast, role);
    renderSlots();
    if (actor) { const o = slots[role].occ; play(o, [{ transform: 'translateY(-14px) scale(1.1)' }, { transform: 'none' }], { duration: 380 }, life); }
  }

  function placeActor(role, id) {
    if (phase !== 'choose') return;
    cast = P.placeInSlot(cast, role, id);
    held = null;
    activeRole = null;
    syncHeld();
    renderSlots();
    flash(slots[role].el, 'flash-ok', 600);
  }

  function clickPuppet(id) {
    if (phase !== 'choose') {
      if (phase === 'auditions') hint.textContent = 'Patience. The puppets are still auditioning.';
      return;
    }
    if (activeRole) return placeActor(activeRole, id);
    held = held === id ? null : id;
    syncHeld();
  }

  function clickSlot(role) {
    if (phase !== 'choose') return;
    if (held) return placeActor(role, held);
    activeRole = activeRole === role ? null : role;
    for (const r of P.ROLES) slots[r].el.classList.toggle('active', activeRole === r);
    hint.textContent = activeRole ? `Who shall play ${roleLabel(role)}? Pick a puppet from the bench.` : 'Pick a puppet, then a part. Or drag.';
  }

  document.addEventListener('keydown', onEsc);
  life.onDispose(() => document.removeEventListener('keydown', onEsc));
  function onEsc(e) {
    if (e.key === 'Escape' && (held || activeRole)) { held = null; activeRole = null; syncHeld(); renderSlots(); }
  }

  /* ---------------------------------------------------------------- the interrupt */
  function chooseCast(payload, again) {
    phase = 'choose';
    skip.hide();
    proposed = { ...(payload.proposed || proposed || P.emptyCast()) };
    if (payload.scores) for (const r of P.ROLES) Object.assign(scores[r], payload.scores[r] || {});
    for (const role of P.ROLES) for (const [a, s] of Object.entries(scores[role])) setBar(a, role, s, false);
    cast = again ? P.emptyCast() : { ...proposed };
    slotsWrap.classList.remove('is-idle');
    S.view.classList.add('choosing');
    hint.textContent = again ? 'Madame did not like that cast. Choose again.' : 'Pick a puppet, then a part. Or drag one onto a doorway. Madame has pre-seated her favourites.';
    renderSlots(true);
    syncHeld();
    acceptBtn.disabled = false;
    slotsWrap.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    return new Promise((resolve) => { resolveCast = resolve; });
  }

  function acceptMadame() {
    cast = { ...proposed };
    renderSlots();
    confirm();
  }

  function confirm() {
    const v = P.validateCast(cast, performers.map((p) => p.id));
    if (!v.ok) { hint.textContent = v.errors[0].message; flash(slotsWrap, 'shake', 500); return; }
    phase = 'locked';
    slotsWrap.classList.add('locked');
    S.view.classList.remove('choosing');
    held = null; activeRole = null; syncHeld();
    acceptBtn.disabled = true; confirmBtn.disabled = true; resetBtn.hidden = true;
    verdict.textContent = 'Cast! The costumes are already being let out.';
    for (const r of P.ROLES) flash(slots[r].el, 'flash-ok', 800);
    const r = resolveCast;
    resolveCast = null;
    r?.({ cast: { lead: cast.lead, villain: cast.villain, fool: cast.fool } });
  }

  /* ---------------------------------------------------------------- run the graph */
  const seen = new Set();
  let asked = 0;
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    if (ev.kind === 'cast.audition') showAudition(ev.data);
    else if (ev.kind === 'cast.recommend') showRecommend(ev.data);
  };

  async function run() {
    try {
      const out = await ctx.runFlow({
        graph: 'casting_call',
        input: tourInput(ctx),
        signal: life.signal,
        pace: life.paceFor(ingest),
        onEvent: () => {},
        onToken: () => {},
        onInterrupt: (payload) => chooseCast(payload, asked++ > 0), // a second ask means Madame rejected the first cast
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev); // anything the queue skipped
      const final = out.values?.cast || cast;
      if (!P.validateCast(final).ok) throw new Error('The graph returned no cast.');
      await life.wait(900);
      if (life.dead) return;
      ctx.nav('writers', carry(ctx, { cast: final }));
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      clear(S.main);
      S.main.appendChild(errorCard(err, { retry: () => ctx.nav('casting', carry(ctx)) }));
    }
  }
  run();
  return { unmount() { life.dispose(); clear(root); } };
}
