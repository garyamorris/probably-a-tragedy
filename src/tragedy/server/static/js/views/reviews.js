// THE REVIEWS (graph: reviews -> next: almanac)
// Five pigeon critics land on a telegraph wire one after another, each with a paper pull-quote and stars filling in;
// then the newspaper front page spins in, the headline streams in token by token, and the 15-star tally ticks up. No interrupt.
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, burst, countTo, typewrite, tourInput, carry, nextTownId, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { pigeonMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

// wire geometry (viewBox 0 0 1000 120): quadratic from (0,30) via (500,110) to (1000,30)
const wireY = (t) => 30 + 160 * t * (1 - t);
const SLOT_T = [0.1, 0.3, 0.5, 0.7, 0.9];
const MASTHEAD = 'THE WIBBLING GAZETTE';

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'reviews',
    title: 'The Morning Papers',
    sub: 'Five pigeons, one telegraph wire, no mercy. They have already read the programme.',
  });
  const D = S.D;
  const critics = Object.values(D.critics).length ? Object.values(D.critics) : [];
  const order = critics.length ? critics.map((c) => c.id) : ['pompous', 'wounded_parent', 'snacks', 'chaos_gourmand', 'sentimentalist'];
  const sky = ctx.ui.SKIES?.[S.town?.sky] || ctx.ui.SKIES?.dusk;

  const slots = {};
  const landed = [];
  let headlineText = '';
  let headlineDone = false;
  let paper = null;
  let paperParts = null;
  const tonightStars = () => P.meanStars(landed.map((x) => x.stars));

  /* ---------------------------------------------------------------- the wire */
  const wireSvg = svgEl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 120" preserveAspectRatio="none" class="rv-wire-svg" aria-hidden="true" fill="none">
    <path d="M0,30 Q500,110 1000,30" stroke="#241a26" stroke-width="7" opacity=".55" transform="translate(0 4)"/>
    <path d="M0,30 Q500,110 1000,30" stroke="#6b5b73" stroke-width="3.5"/><path d="M0,29 Q500,109 1000,29" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>`, { class: 'rv-wire-svg' });
  const scene = h('div', { class: 'rv-scene', style: sky ? { '--sky-top': sky.top, '--sky-bot': sky.bottom } : null },
    h('div', { class: 'rv-sun' }), h('div', { class: 'rv-pole rv-pole-l' }, h('i'), h('i')), h('div', { class: 'rv-pole rv-pole-r' }, h('i'), h('i')), wireSvg);
  const slotRow = h('div', { class: 'rv-slots' });
  order.forEach((id, i) => {
    const c = D.critics[id] || { id, name: P.humanize(id), outlet: 'The Gazette' };
    const wy = Math.round(wireY(SLOT_T[i] ?? 0.5));
    const bird = h('div', { class: 'rv-bird', 'aria-hidden': 'true' }, svgEl(pigeonMarkup(c), { class: `pg pg-${c.id}` }));
    const card = h('figure', { class: 'rv-card v-paper', hidden: true },
      h('i', { class: 'rv-pin' }),
      h('figcaption', { class: 'rv-who' }, h('b', { class: 'display' }, c.name), h('span', null, c.outlet)),
      h('blockquote', { class: 'rv-quote' }),
      h('div', { class: 'rv-stars' }));
    const el = h('div', { class: 'rv-slot', 'data-critic': id, style: { '--wy': `${wy}px` } }, h('i', { class: 'rv-string' }), bird, card);
    slots[id] = { el, bird, card, c };
    slotRow.appendChild(el);
  });
  const wire = h('div', { class: 'rv-wire' }, scene, slotRow);
  const perched = h('p', { class: 'hand rv-perch' }, 'The pigeons are settling. Do not make eye contact.');

  async function landPigeon(d) {
    const id = d.critic;
    let slot = slots[id];
    if (!slot) { // an unknown critic id: take the first empty slot
      slot = Object.values(slots).find((s) => !s.landed);
    }
    if (!slot || slot.landed) return;
    slot.landed = true;
    landed.push(d);
    const { bird, card, c } = slot;
    slot.el.classList.add('landed');
    perched.textContent = landed.length < 5 ? `${landed.length} of 5 pigeons have landed. They are reading.` : 'All five are in. Somebody is clearing their throat.';
    // flight: in from off-screen, flapping, then a bounce on the wire
    bird.classList.add('flying');
    const fromLeft = SLOT_T[order.indexOf(id)] < 0.5 || Object.keys(slots).indexOf(id) % 2 === 0;
    await play(bird, [
      { transform: `translate(${fromLeft ? -520 : 520}px, -260px) rotate(${fromLeft ? 14 : -14}deg) scale(.8)`, opacity: 0 },
      { transform: `translate(${fromLeft ? -120 : 120}px, -70px) rotate(${fromLeft ? 8 : -8}deg)`, opacity: 1, offset: 0.55 },
      { transform: 'translate(0, -14px)', offset: 0.8 },
      { transform: 'translate(0, 3px)', offset: 0.9 },
      { transform: 'none' },
    ], { duration: 950, easing: 'cubic-bezier(.3,.7,.4,1)' }, life);
    bird.classList.remove('flying');
    bird.classList.add('perched');
    // the pull-quote drops down on its string
    const q = card.querySelector('.rv-quote');
    q.textContent = `“${d.quote}”`;
    card.querySelector('.rv-who b').textContent = d.name || c.name;
    card.querySelector('.rv-who span').textContent = d.outlet || c.outlet;
    const starsBox = card.querySelector('.rv-stars');
    clear(starsBox);
    starsBox.append(ctx.ui.starRating(d.stars, { size: 'sm', label: `${d.stars} stars from ${d.name || c.name}` }), h('b', { class: 'rv-num' }, String(d.stars)));
    card.dataset.tone = d.stars >= 4 ? 'love' : d.stars >= 3 ? 'meh' : 'ouch';
    card.hidden = false;
    play(card, [{ transform: 'translateY(-60px) rotate(-6deg) scaleY(.3)', opacity: 0, transformOrigin: '50% 0' }, { transform: 'translateY(6px) rotate(2deg)', opacity: 1, offset: 0.65 }, { transform: 'none' }], { duration: 640 }, life);
    life.later(() => card.classList.add('swing'), 700);
  }

  /* ---------------------------------------------------------------- the newspaper */
  const front = h('section', { class: 'rv-front', hidden: true });

  function buildPaper() {
    if (paper) return;
    const town = S.town?.name || P.humanize(ctx.params.town || '');
    const headEl = h('h2', { class: 'rv-headline display' });
    const caret = h('i', { class: 'rv-caret' });
    headEl.append(h('span', { class: 'rv-ht' }), caret);
    const starsBox = h('div', { class: 'rv-total-stars' });
    const totalN = h('div', { class: 'rv-total-n display' }, '0.0');
    const coins = h('div', { class: 'rv-coins' });
    const fundsN = h('b', { class: 'rv-funds-n display' }, '+0');
    const tallyBox = h('div', { class: 'rv-tally' });
    paper = h('article', { class: 'rv-paper' },
      h('header', { class: 'rv-mast' },
        h('div', { class: 'rv-mast-top' }, h('span', null, `Vol. ${(ctx.tour?.night ?? 0) + 1}`), h('span', null, 'Price: one fund'), h('span', null, 'Weather: damp')),
        h('div', { class: 'rv-mast-name' }, MASTHEAD),
        h('div', { class: 'rv-mast-rule' }),
        h('div', { class: 'rv-dateline' }, `${P.nightLabel(ctx.tour?.night ?? 0)}  ·  ${town}  ·  late edition`)),
      headEl,
      h('p', { class: 'rv-byline hand' }, 'Compiled by our five pigeons, who have been told not to peck the typesetter.'),
      h('div', { class: 'rv-cols' },
        h('div', { class: 'rv-col rv-verdict' }, h('div', { class: 'rv-kick' }, 'Critical consensus'), starsBox, h('div', { class: 'rv-total-row' }, totalN, h('span', null, 'stars')),
          h('div', { class: 'rv-funds' }, h('div', { class: 'rv-kick' }, 'Box office'), h('div', { class: 'rv-funds-row' }, coins, fundsN, h('span', null, 'funds')))),
        h('div', { class: 'rv-col' }, h('div', { class: 'rv-kick' }, 'The 15-star target'), tallyBox)));
    paperParts = { headEl, ht: headEl.firstChild, caret, starsBox, totalN, coins, fundsN, tallyBox };
    front.append(paper);
    front.hidden = false;
    play(paper, [{ transform: 'scale(.05) rotate(-900deg)', opacity: 0 }, { transform: 'scale(1.06) rotate(6deg)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 1000, easing: 'cubic-bezier(.2,.8,.3,1)' }, life);
    life.later(() => front.scrollIntoView?.({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }), 120);
  }

  function onToken(t) {
    if (headlineDone) return;
    const node = String(t?.node || '');
    const ok = /headline/i.test(node) || (landed.length >= 5 && !/pigeon|critic|review/i.test(node));
    if (!ok) return;
    buildPaper();
    headlineText += t.text;
    paperParts.ht.textContent = headlineText.toUpperCase();
  }

  async function showHeadline(d) {
    buildPaper();
    headlineDone = true;
    const text = String(d.text ?? headlineText);
    const { ht, caret, starsBox, totalN, coins, fundsN, tallyBox } = paperParts;
    if (text.toUpperCase() !== ht.textContent) {
      ht.textContent = '';
      await typewrite(ht, text.toUpperCase(), { cps: 48, life });
    }
    caret.remove();
    const stars = Number.isFinite(d.stars) ? d.stars : tonightStars();
    const funds = Number.isFinite(d.funds_delta) ? d.funds_delta : 0;
    starsBox.append(ctx.ui.starRating(stars, { size: 'lg', label: `${stars} stars` }));
    countTo(totalN, stars, { digits: 1, ms: 900, life });
    // coins pop in one by one
    clear(coins);
    for (let i = 0; i < Math.min(8, Math.max(0, funds)); i++) coins.appendChild(h('i', { class: 'rv-coin', style: { '--i': i } }));
    fundsN.textContent = `${funds >= 0 ? '+' : ''}${funds}`;
    play(fundsN, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.3)', offset: .6 }, { transform: 'none' }], { duration: 600, delay: 500 }, life);
    // tally against the target
    const t = P.tourTally(ctx.tour?.history, stars, { night: ctx.tour?.night ?? 0 });
    renderTally(tallyBox, t, stars);
    result.stars = stars; result.funds_delta = funds; result.headline = text;
    if (t.reached) ctx.ui.confetti?.({ count: 160, origin: { x: 0.5, y: 0.45 } });
    else if (stars >= 4) ctx.ui.confetti?.({ count: 70, origin: { x: 0.5, y: 0.5 }, spread: 0.7 });
  }

  function renderTally(box, t, stars) {
    clear(box);
    const rows = (ctx.tour?.history || []).filter((x) => x.night !== (ctx.tour?.night ?? 0)).sort((a, b) => a.night - b.night);
    const bar = h('div', { class: 'rv-ladder', role: 'img', 'aria-label': `${t.total.toFixed(1)} of ${t.target} stars` });
    const track = h('div', { class: 'rv-ladder-track' });
    let acc = 0;
    for (const r of rows) {
      const w = (r.stars / t.target) * 100;
      track.appendChild(h('i', { class: 'rv-seg', style: { left: `${(acc / t.target) * 100}%`, '--w': `${Math.min(w, 100 - (acc / t.target) * 100)}%` }, title: `Night ${r.night + 1}: ${r.stars} stars` }, h('span', null, String(r.night + 1))));
      acc += r.stars;
    }
    const tn = h('i', { class: 'rv-seg rv-seg-now', style: { left: `${Math.min(100, (acc / t.target) * 100)}%`, '--w': `${Math.max(0, Math.min(stars / t.target, 1 - acc / t.target) * 100)}%` }, title: `Tonight: ${stars} stars` }, h('span', null, String((ctx.tour?.night ?? 0) + 1)));
    track.appendChild(tn);
    bar.append(track, h('div', { class: 'rv-flag', style: { left: '100%' } }, h('span', null, `${t.target}`)));
    const total = h('div', { class: 'rv-ladder-n display' }, h('b', null, '0'), h('span', null, ` of ${t.target} stars`));
    const quip = h('p', { class: 'hand rv-quip' }, P.tallyQuip(t));
    box.append(total, bar, h('div', { class: 'rv-need' }, t.reached ? tag('Target reached', { tone: 'gold' }) : tag(`${t.needed.toFixed(1)} to go`, { tone: 'crimson' }), t.remainingNights > 0 ? tag(`${t.remainingNights} night${t.remainingNights === 1 ? '' : 's'} left`, { tone: 'plain' }) : tag('Last night', { tone: 'plain' })), quip);
    countTo(total.firstChild, t.total, { digits: 1, ms: 1100, life });
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('go')));
  }

  /* ---------------------------------------------------------------- footer + run */
  const result = { stars: null, funds_delta: null, headline: null };
  const nextBtn = vbtn('To the Almanac', { variant: 'primary', size: 'lg', icon: 'chevron-right', onclick: () => goNext() });
  let reviewsList = [];
  function goNext() {
    ctx.nav('almanac', carry(ctx, { stars: result.stars, headline: result.headline, funds_delta: result.funds_delta, reviews: reviewsList, next_town: nextTownId(ctx) }));
  }

  S.main.append(wire, perched, front);
  const skip = skipControl(life, S.slot);

  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    if (ev.kind === 'review.pigeon') landPigeon(ev.data);
    else if (ev.kind === 'review.headline') return showHeadline(ev.data);
  };

  async function run() {
    try {
      const out = await ctx.runFlow({
        graph: 'reviews',
        input: tourInput(ctx, { cast: ctx.params.cast, script: ctx.params.script, result: ctx.params.result }),
        signal: life.signal,
        pace: async (ev) => {
          if (life.dead) return;
          const p = ingest(ev);
          if (p && typeof p.then === 'function') await p; // the headline plays out in full
          await life.wait(ev.kind === 'review.pigeon' ? 1050 : 700);
        },
        onEvent: () => {},
        onToken,
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      reviewsList = out.values?.reviews || landed;
      if (out.values) {
        if (result.stars == null && Number.isFinite(out.values.stars)) result.stars = out.values.stars;
        if (result.funds_delta == null && Number.isFinite(out.values.funds_delta)) result.funds_delta = out.values.funds_delta;
        if (!result.headline && out.values.headline) result.headline = out.values.headline;
      }
      if (!headlineDone) await showHeadline({ text: result.headline ?? headlineText ?? 'NO REVIEWS, SOME PIGEONS', stars: result.stars ?? tonightStars(), funds_delta: result.funds_delta ?? 0 });
      skip.hide();
      perched.hidden = true;
      try { await ctx.refreshTour?.(); } catch { /* the HUD can catch up later */ }
      S.actions(nextBtn);
      S.foot.classList.add('v-foot-sticky');
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      clear(S.main);
      S.main.appendChild(errorCard(err, { title: 'The pigeons have gone to lunch', retry: () => ctx.nav('reviews', carry(ctx)) }));
    }
  }
  run();
  return { unmount() { life.dispose(); clear(root); } };
}
