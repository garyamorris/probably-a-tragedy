// THE WRITERS' ROOM (graph: writers_room -> next: rehearsal | show)
// Three heron quills (pompous / frantic / tender) scribble at desks; each script.draft lands as a parchment card.
// The pick_draft interrupt: lift a card, press the seal. Resume {draft_id}. Then fork: rehearse first (costs a candle) or start the show.
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, burst, tourInput, carry, isAbort, errorCard, icon, reduced, typewrite } from './_kit/fx.js';
import { heronMarkup, sealMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

const MOOD_CAPTIONS = {
  pompous: ['adding adjectives', 'clearing throat, loudly', 'quoting himself, approvingly', 'underlining "magnificent"', 'declining to explain'],
  frantic: ['adding a fourth subplot', 'crossing out the ending', 'more ink! MORE INK', 'forgetting what a door is', 'writing on the wall (also paper)'],
  tender: ['describing the weather', 'tearing up at a comma', 'writing in the margin', 'making tea for the characters', 'pausing to look out of a window'],
};
const DONE_CAPTIONS = { pompous: 'Finished. It is, of course, magnificent.', frantic: 'DONE! Probably! Please take it before I change it!', tender: 'Done. It is small and it is kind.' };
const MOOD_TONE = { pompous: 'plum', frantic: 'crimson', tender: 'sky' };

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'writers',
    title: "The Writers' Room",
    sub: 'Three herons, one plot, and a shared inkwell. Madame has opinions, and stars of faith.',
  });
  const D = S.D;
  const quills = P.QUILL_ORDER;
  const staffOf = (id) => D.staff[id] || { id, name: `Bartholomew Quill (${P.quillMood(id)})`, palette: {} };

  let drafts = []; // current drafts, by quill
  let selected = null; // draft_id lifted
  let phase = 'writing'; // writing -> choosing -> sealed -> done
  let resolvePick = null;
  let script = null;
  const cards = {}; // draft_id -> {el, draft}
  const desks = {};

  /* ---------------------------------------------------------------- desks */
  const deskRow = h('div', { class: 'wr-desks' });
  for (const q of quills) {
    const st = staffOf(q);
    const mood = P.quillMood(q);
    const caption = h('div', { class: 'wr-caption hand' }, 'Sharpening a quill...');
    const words = h('span', { class: 'wr-words' }, '0 words');
    const sheet = h('div', { class: 'wr-sheet' }, h('div', { class: 'wr-lines' }), h('div', { class: 'wr-blot' }));
    const quillEl = h('div', { class: 'wr-quill' }, svgEl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 70"><path d="M34,2 C40,18 30,40 8,62 L4,66 L7,58 C16,40 22,24 34,2Z" fill="#f6ecd6" stroke="#241a26" stroke-width="1.6"/><path d="M33,6 C26,24 16,44 6,63" stroke="#241a26" stroke-width="1.1"/></svg>`, { class: 'wr-quill-svg' }));
    const heron = h('div', { class: 'wr-heron' }, svgEl(heronMarkup(st, { mood }), { class: `hh hh-${mood}` }));
    const el = h('div', { class: ['wr-desk', `wr-${mood}`, 'scribbling'], 'data-quill': q },
      h('div', { class: 'wr-lamp', 'aria-hidden': 'true' }, h('i')),
      heron,
      h('div', { class: 'wr-top' }, sheet, quillEl, h('div', { class: 'wr-ink', 'aria-hidden': 'true' }, h('i'))),
      h('div', { class: 'wr-plate' }, h('div', { class: 'wr-name display' }, 'Bartholomew Quill'), h('div', { class: 'wr-mood' }, tag(mood, { tone: MOOD_TONE[mood] }), words)),
      caption);
    desks[q] = { el, caption, words, sheet, count: 0, mood, ticker: null };
    deskRow.appendChild(el);
  }
  const cycleCaptions = () => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      for (const q of quills) if (desks[q].el.classList.contains('scribbling')) desks[q].caption.textContent = MOOD_CAPTIONS[desks[q].mood][(i + quills.indexOf(q) * 2) % MOOD_CAPTIONS[desks[q].mood].length];
    }, 1900);
    life.onDispose(() => clearInterval(t));
    for (const q of quills) desks[q].caption.textContent = MOOD_CAPTIONS[desks[q].mood][quills.indexOf(q) % MOOD_CAPTIONS[desks[q].mood].length];
  };
  cycleCaptions();

  const noteBox = h('div', { class: 'wr-note hand', hidden: true, role: 'status' });

  /* ---------------------------------------------------------------- cards */
  const cardRow = h('div', { class: 'wr-cards', 'aria-label': 'The drafts' });
  const cardsHead = h('div', { class: 'wr-cards-head', hidden: true }, h('h2', { class: 'display' }, 'The drafts'), h('p', { class: 'hand wr-pickhint' }, 'Read them, then lift one. Madame stars the ones she has faith in; she has been wrong.'));

  function buildCard(d) {
    const mood = P.quillMood(d.quill);
    const faith = P.faithStars(d.confidence);
    const faithEl = h('div', { class: 'wr-faith', title: "Madame's faith in this draft (0-3 stars). It is not evidence." }, h('span', { class: 'wr-faith-l' }, "Madame's faith"), ctx.ui.starRating(faith, { max: 3, size: 'sm', label: `Madame's faith: ${faith} of 3 stars` }));
    const beats = h('ol', { class: 'wr-beats' });
    (d.beats || []).forEach((b, i) => {
      beats.appendChild(h('li', { class: 'wr-beat', style: { '--i': i } },
        h('span', { class: 'wr-beat-n' }, h('b', null, ['I', 'II', 'III', 'IV', 'V'][i] || i + 1), h('i', null, P.BEAT_NAMES[b.beat] ?? P.humanize(b.beat))),
        h('div', { class: 'wr-beat-t' }, h('p', { class: 'wr-logline' }, b.logline), (b.tags || []).length ? h('div', { class: 'wr-chips' }, (b.tags || []).map((t) => h('span', { class: 'wr-chip' }, '#' + t))) : null)));
    });
    const seal = h('div', { class: 'wr-seal', 'aria-hidden': 'true', hidden: true }, svgEl(sealMarkup({ seed: d.draft_id, mark: 'quill' }), { class: 'vseal' }));
    const el = h('article', {
      class: ['wr-card', 'v-paper', `wr-${mood}`], tabindex: '0', role: 'button', 'aria-pressed': 'false', 'data-draft': d.draft_id, 'data-quill': d.quill,
      'aria-label': `${d.title}. Draft by the ${mood} quill.`,
      onclick: () => selectCard(d.draft_id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(d.draft_id); } },
    },
    h('div', { class: 'wr-card-top' }, tag(`${mood} quill`, { tone: MOOD_TONE[mood] }), faithEl),
    h('h3', { class: 'wr-title display' }, d.title),
    h('p', { class: 'hand wr-tagline' }, d.tagline),
    beats, seal);
    return { el, draft: d, seal };
  }

  async function landDraft(d) {
    const { drafts: next, replaced } = P.upsertDraft(drafts, d);
    drafts = next;
    cardsHead.hidden = false;
    const desk = desks[d.quill];
    // old card from this quill gets crumpled
    if (replaced && cards[replaced.draft_id]) {
      const old = cards[replaced.draft_id];
      delete cards[replaced.draft_id];
      await play(old.el, [{}, { transform: 'scale(.15) rotate(40deg)', opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' }, life);
      old.el.remove();
    }
    const card = buildCard(d);
    cards[d.draft_id] = card;
    // keep desk order in the row
    const ordered = P.sortDrafts(drafts);
    const idx = ordered.findIndex((x) => x.draft_id === d.draft_id);
    cardRow.insertBefore(card.el, cardRow.children[idx] || null);
    // FLIP from the desk's paper to the card's slot
    if (desk && !life.fast && !reduced()) {
      const a = desk.sheet.getBoundingClientRect();
      const b = card.el.getBoundingClientRect();
      if (a.width && b.width) {
        const sx = a.width / b.width;
        play(card.el, [
          { transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${sx}) rotate(-8deg)`, opacity: 0.2 },
          { transform: 'translate(0,0) scale(1.03) rotate(1deg)', opacity: 1, offset: 0.8 },
          { transform: 'none', opacity: 1 },
        ], { duration: 780, easing: 'cubic-bezier(.3,.9,.3,1)' }, life);
        burst(desk.sheet, { n: 6, cls: 'v-spark wr-ink-drop', spread: 40, life });
      }
    }
    finishDesk(d.quill);
    if (phase === 'choosing') syncSelection();
  }

  function finishDesk(q) {
    const desk = desks[q];
    if (!desk) return;
    desk.el.classList.remove('scribbling');
    desk.el.classList.add('done');
    desk.caption.textContent = DONE_CAPTIONS[desk.mood];
  }

  function syncSelection() {
    for (const [id, c] of Object.entries(cards)) {
      const on = selected === id;
      c.el.classList.toggle('lifted', on);
      c.el.classList.toggle('dim', selected != null && !on);
      c.el.setAttribute('aria-pressed', String(on));
    }
    sealBtn.disabled = !selected;
    const d = drafts.find((x) => x.draft_id === selected);
    sealLabel.textContent = d ? `Seal "${shorten(d.title, 34)}"` : 'Lift a draft to seal it';
  }
  const shorten = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

  function selectCard(id) {
    if (phase !== 'choosing') return;
    selected = selected === id ? null : id;
    syncSelection();
  }

  /* ---------------------------------------------------------------- footer + forks */
  const sealLabel = h('span', { class: 'btn-label' }, 'Lift a draft to seal it');
  const sealBtn = h('button', { class: 'btn btn-primary btn-lg v-btn v-btn-primary wr-sealbtn', type: 'button', disabled: true, onclick: () => seal() }, icon('quill'), sealLabel);
  const forkBox = h('section', { class: 'wr-fork v-paper', hidden: true, 'aria-label': 'What next?' });

  function seal() {
    if (phase !== 'choosing' || !selected) return;
    phase = 'sealed';
    const id = selected;
    const c = cards[id];
    sealBtn.disabled = true;
    S.foot.classList.add('hide');
    c.seal.hidden = false;
    c.el.classList.add('sealed');
    c.el.setAttribute('aria-pressed', 'true');
    // wax thud
    play(c.seal, [{ transform: 'translate(0, -280px) scale(3) rotate(-30deg)', opacity: 0 }, { transform: 'translate(0, 0) scale(.88) rotate(4deg)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.5,0,.8,.6)' }, life);
    life.later(() => flash(c.el, 'shake', 450), 420);
    life.later(() => burst(c.seal, { n: 10, spread: 70, life }), 440);
    for (const [k, other] of Object.entries(cards)) if (k !== id) other.el.classList.add('discarded');
    const r = resolvePick;
    resolvePick = null;
    r?.({ draft_id: id });
  }

  function showFork() {
    const candles = ctx.tour?.candles ?? 0;
    const rehearse = vbtn(`Rehearse first (costs a candle)`, { variant: 'paper', size: 'lg', icon: 'candle', disabled: candles <= 0, title: candles <= 0 ? 'No candles left. The wax is all in the Prompter\'s ears.' : 'Twelve imaginary nights, to see what might go wrong', onclick: () => ctx.nav('rehearsal', carry(ctx, { cast: ctx.params.cast, script })) });
    const start = vbtn('Start the show', { variant: 'primary', size: 'lg', icon: 'curtain', onclick: () => ctx.nav('show', carry(ctx, { cast: ctx.params.cast, script })) });
    clear(forkBox);
    forkBox.append(
      h('div', { class: 'wr-fork-text' }, h('div', { class: 'kicker' }, 'The script is sealed'), h('h3', { class: 'display' }, 'Rehearse first, or straight to the stage?'), h('p', { class: 'hand' }, candles > 0 ? `A rehearsal burns one of your ${candles} candle${candles === 1 ? '' : 's'}. The house does not wait, but it does tend to forgive.` : 'No candles left, so no rehearsal. Bravery will have to do.')),
      h('div', { class: 'wr-fork-btns' }, rehearse, start));
    forkBox.hidden = false;
    play(forkBox, [{ transform: 'translateY(30px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520 }, life);
    forkBox.scrollIntoView?.({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  }

  S.main.append(deskRow, noteBox, cardsHead, cardRow, forkBox);
  S.actions(sealBtn);
  S.foot.classList.add('v-foot-sticky');
  S.foot.hidden = true;
  const skip = skipControl(life, S.slot);

  /* ---------------------------------------------------------------- run */
  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    if (ev.kind === 'script.draft') landDraft(ev.data);
    else if (ev.kind === 'script.chosen') { /* the seal already stamped; nothing more to draw */ }
    else if (ev.kind === 'note' && ev.data?.text) {
      noteBox.hidden = false;
      typewrite(noteBox, ev.data.text, { cps: 70, life });
      play(noteBox, [{ transform: 'rotate(-3deg) scale(.8)', opacity: 0 }, { transform: 'rotate(-1deg)', opacity: 1 }], { duration: 400 }, life);
      life.later(() => { noteBox.hidden = true; }, 3200 / (life.speed || 1));
    }
  };

  function onToken(t) {
    const q = t?.actor && String(t.actor).startsWith('quill_') ? t.actor : quills.find((id) => String(t?.node || '').includes(id) || String(t?.node || '').includes(P.quillMood(id) + '_quill'));
    const desk = q && desks[q];
    if (!desk || !desk.el.classList.contains('scribbling')) return;
    desk.count += (String(t.text).match(/\S+/g) || []).length;
    desk.words.textContent = `${desk.count} word${desk.count === 1 ? '' : 's'}`;
  }

  function pickDraft(payload) {
    phase = 'choosing';
    skip.hide();
    // make sure every draft in the payload is on the table (authoritative list)
    const incoming = payload.drafts || [];
    const missing = incoming.filter((d) => !cards[d.draft_id]);
    for (const q of quills) if (!incoming.some((d) => d.quill === q)) finishDesk(q);
    return (async () => {
      for (const d of missing) { await landDraft(d); }
      for (const q of quills) finishDesk(q);
      cardsHead.hidden = false;
      S.foot.hidden = false;
      syncSelection();
      cardRow.scrollIntoView?.({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      return new Promise((resolve) => { resolvePick = resolve; });
    })();
  }

  async function run() {
    try {
      const out = await ctx.runFlow({
        graph: 'writers_room',
        input: tourInput(ctx, { cast: ctx.params.cast, traditions: (ctx.tour?.traditions || []).map((t) => t.calamity ?? t) }),
        signal: life.signal,
        pace: life.paceFor(ingest),
        onEvent: () => {},
        onToken,
        onInterrupt: pickDraft,
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      script = out.values?.script;
      if (!script) throw new Error('The herons produced no script. (They say it was the ink.)');
      phase = 'done';
      S.foot.hidden = true;
      await life.wait(500);
      if (life.dead) return;
      showFork();
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      clear(S.main);
      S.main.appendChild(errorCard(err, { retry: () => ctx.nav('writers', carry(ctx)) }));
    }
  }
  run();
  return { unmount() { life.dispose(); clear(root); } };
}
