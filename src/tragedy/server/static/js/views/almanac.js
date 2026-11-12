// THE ALMANAC (graph: almanac -> next: playbill)
// Every calamity is dropped into a jar on the shelf (almanac.noted); repeats glow as candidate Traditions (almanac.candidate);
// the curate_traditions interrupt lets you click up to `max` jars to enshrine (resume {enshrine:[calamity,...]}); each grants an
// Encore token (almanac.tradition: wax seal + ledger ink + "+1 Encore"). Then memory.recalled pins the next town's legends.
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, burst, countTo, typewrite, tourInput, carry, nextTownId, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { jarMarkup, sealMarkup, encoreMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'almanac',
    title: 'The Almanac of Calamities',
    sub: 'Everything that goes wrong is written down. What goes wrong twice is a tradition.',
  });
  const D = S.D;
  const nextId = nextTownId(ctx);
  const nextTown = nextId ? D.towns[nextId] || { id: nextId, name: P.humanize(nextId) } : null;

  let jars = [];
  const cells = {}; // calamity -> {el, count, ...}
  let phase = 'noting';
  let selected = [];
  let maxPick = 2;
  let resolvePick = null;
  const enshrined = [];
  let encore = ctx.tour?.encore ?? 0;

  /* ---------------------------------------------------------------- shelf */
  const shelf = h('div', { class: 'al-shelf', role: 'list', 'aria-label': 'Jars of calamity' });
  const emptyNote = h('p', { class: 'hand al-empty' }, 'The shelf is bare. Nothing has gone wrong yet, which is itself suspicious.');
  const shelfWrap = h('section', { class: 'al-shelfwrap' }, h('div', { class: 'al-shelfhead' }, h('h2', { class: 'display' }, 'The shelf'), h('span', { class: 'hand al-shelfhint' }, 'Tonight\'s calamities, bottled.')), shelf, emptyNote);

  function buildJar(j) {
    const count = h('b', { class: 'al-count' }, String(j.count));
    const ribbon = h('span', { class: 'al-ribbon', hidden: true }, 'Tradition?');
    const sealEl = h('span', { class: 'al-seal', hidden: true, 'aria-hidden': 'true' }, svgEl(sealMarkup({ seed: j.calamity }), { class: 'vseal' }));
    const pickMark = h('span', { class: 'al-pick', hidden: true, 'aria-hidden': 'true' }, icon('check'));
    const el = h('div', {
      class: 'al-jar', role: 'listitem', 'data-calamity': j.calamity, tabindex: '-1',
      onclick: () => toggle(j.calamity),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(j.calamity); } },
    },
    h('div', { class: 'al-halo', 'aria-hidden': 'true' }),
    h('div', { class: 'al-glass' }, svgEl(jarMarkup(j.calamity), { class: 'vjar' }), count, ribbon, sealEl, pickMark),
    h('div', { class: 'al-label' }, h('b', { class: 'display' }, j.title)),
    h('p', { class: 'al-text hand' }, j.text || ''));
    return { el, count, ribbon, sealEl, pickMark, j };
  }

  async function noteJar(d) {
    const { jars: next, isNew, jar } = P.foldJars(jars, d);
    jars = next;
    emptyNote.hidden = true;
    if (isNew) {
      const c = buildJar(jar);
      cells[jar.calamity] = c;
      shelf.appendChild(c.el);
      play(c.el, [{ transform: 'translateY(-340px) rotate(-14deg)', opacity: 0 }, { transform: 'translateY(0) rotate(3deg)', opacity: 1, offset: .55 }, { transform: 'translateY(-16px) rotate(-1deg)', offset: .72 }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(.4,0,.6,1)' }, life);
      life.later(() => flash(shelfWrap, 'al-thunk', 360), 440 / (life.speed || 1));
    } else {
      const c = cells[jar.calamity];
      c.count.textContent = String(jar.count);
      c.j = jar;
      flash(c.el, 'al-bump', 700);
      const t = c.el.querySelector('.al-text');
      if (t) t.textContent = jar.text || t.textContent;
    }
  }

  function candidate(d) {
    let c = cells[d.calamity];
    if (!c) { noteJar({ calamity: d.calamity, count: d.count, text: d.text }); c = cells[d.calamity]; }
    c.cand = d;
    c.el.classList.add('candidate');
    c.ribbon.hidden = false;
    c.el.querySelector('.al-label b').textContent = d.title || c.j.title;
    if (Number.isFinite(d.count)) c.count.textContent = String(d.count);
    play(c.ribbon, [{ transform: 'translateY(-14px) scale(.4) rotate(-12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480 }, life);
  }

  /* ---------------------------------------------------------------- the ledger */
  const encoreN = h('b', { class: 'al-encore-n display' }, String(encore));
  const encoreBox = h('div', { class: 'al-encore', title: 'Encore tokens: each one buys a rewind' }, svgEl(encoreMarkup(), { class: 'encore-ticket' }), h('div', null, h('div', { class: 'kicker' }, 'Encore tokens'), encoreN));
  const entries = h('ol', { class: 'al-entries' });
  for (const t of ctx.tour?.traditions || []) entries.appendChild(h('li', { class: 'al-entry old' }, h('span', { class: 'al-ink' }, t.title ?? P.humanize(t.calamity)), h('small', null, `x${t.count ?? 2}`)));
  const slotsLeft = h('p', { class: 'hand al-ledger-hint' }, 'Two more lines are free tonight.');
  const ledger = h('aside', { class: 'al-ledger v-paper', 'aria-label': 'The Book of Traditions' },
    h('div', { class: 'al-ledger-top' }, h('div', null, h('div', { class: 'kicker' }, 'The Book of'), h('h3', { class: 'display' }, 'Traditions')), encoreBox),
    entries, slotsLeft);

  async function inkEntry(d) {
    const li = h('li', { class: 'al-entry new' }, h('span', { class: 'al-ink' }, d.title || P.humanize(d.calamity)), h('small', null, 'tonight'));
    entries.appendChild(li);
    const ink = li.firstChild;
    await play(ink, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, easing: 'steps(22)', fill: 'backwards' }, life);
  }

  function setSlotsHint() {
    const left = Math.max(0, maxPick - enshrined.length);
    slotsLeft.textContent = phase === 'choosing'
      ? `${selected.length} of ${maxPick} chosen. Click a glowing jar to pick it, click again to put it back.`
      : enshrined.length ? 'Written in ink. It cannot be unwritten (the ink is permanent, the goose is not).' : left ? `${left} line${left === 1 ? '' : 's'} free tonight.` : '';
  }

  async function tradition(d) {
    const c = cells[d.calamity];
    enshrined.push(d.calamity);
    if (c) {
      c.el.classList.remove('picked');
      c.el.classList.add('enshrined');
      c.sealEl.hidden = false;
      c.pickMark.hidden = true;
      play(c.sealEl, [{ transform: 'translateY(-90px) scale(3) rotate(-30deg)', opacity: 0 }, { transform: 'scale(.9) rotate(4deg)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.5,0,.8,.6)' }, life);
      life.later(() => { flash(c.el, 'al-bump', 600); burst(c.sealEl, { n: 9, spread: 60, life }); }, 420 / (life.speed || 1));
    }
    await inkEntry(d);
    // +1 Encore: a ticket flies from the jar to the counter
    await flyTicket(c?.el || shelf, encoreBox);
    encore += 1;
    encoreN.textContent = String(encore);
    flash(encoreBox, 'al-bump', 700);
    const plus = h('span', { class: 'al-plus' }, '+1 Encore');
    encoreBox.appendChild(plus);
    play(plus, [{ transform: 'translateY(8px) scale(.6)', opacity: 0 }, { transform: 'translateY(-26px) scale(1.1)', opacity: 1, offset: .5 }, { transform: 'translateY(-40px)', opacity: 0 }], { duration: 1200, easing: 'ease-out', fill: 'forwards' }, life).then(() => plus.remove());
    life.later(() => plus.remove(), 1500);
    setSlotsHint();
  }

  function flyTicket(fromEl, toEl) {
    if (reduced() || life.fast || !fromEl || !toEl) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const t = h('div', { class: 'al-fly', 'aria-hidden': 'true' });
    t.appendChild(svgEl(encoreMarkup(), { class: 'encore-ticket' }));
    t.style.cssText = `position:fixed;left:${a.left + a.width / 2 - 30}px;top:${a.top + 20}px;width:60px;z-index:80;pointer-events:none`;
    document.body.appendChild(t);
    const dx = b.left + 30 - (a.left + a.width / 2);
    const dy = b.top + 14 - (a.top + 20);
    const anim = t.animate([{ transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'translate(0,-50px) scale(1.2) rotate(8deg)', opacity: 1, offset: .3 }, { transform: `translate(${dx}px, ${dy}px) scale(.8) rotate(0)`, opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.4,.1,.3,1)' });
    return anim.finished.catch(() => {}).then(() => t.remove());
  }

  /* ---------------------------------------------------------------- choosing */
  const hintBar = h('div', { class: 'al-choose v-paper', hidden: true },
    h('div', null, h('div', { class: 'kicker' }, 'The curator speaks'), h('p', { class: 'hand' }, 'These calamities happened more than once. Pick up to two to enshrine as Traditions: the towns will expect them, and each one earns an Encore token.')));

  function toggle(calamity) {
    if (phase !== 'choosing') return;
    const c = cells[calamity];
    if (!c?.cand) { flash(c.el, 'shake', 400); return; }
    const r = P.toggleSelection(selected, calamity, maxPick);
    if (r.rejected) { flash(shelfWrap, 'shake', 450); ctx.toast?.(`Only ${maxPick} Traditions a night. The ledger is a small book.`); return; }
    selected = r.selected;
    syncPicks();
  }

  function syncPicks() {
    for (const [k, c] of Object.entries(cells)) {
      const on = selected.includes(k);
      c.el.classList.toggle('picked', on);
      c.pickMark.hidden = !on;
      c.el.setAttribute('aria-pressed', String(on));
    }
    enshrineBtn.disabled = false;
    enshrineLabel.textContent = selected.length ? `Enshrine ${selected.length} Tradition${selected.length === 1 ? '' : 's'}` : 'Enshrine none';
    enshrineBtn.classList.toggle('btn-primary', selected.length > 0);
    enshrineBtn.classList.toggle('v-btn-primary', selected.length > 0);
    enshrineBtn.classList.toggle('btn-paper', selected.length === 0);
    setSlotsHint();
  }

  const enshrineLabel = h('span', { class: 'btn-label' }, 'Enshrine none');
  const enshrineBtn = h('button', { class: 'btn btn-paper btn-lg v-btn v-btn-paper', type: 'button', onclick: () => confirmPick() }, icon('quill'), enshrineLabel);

  function chooseTraditions(payload) {
    phase = 'choosing';
    skip.hide();
    maxPick = payload.max ?? 2;
    for (const c of payload.candidates || []) { if (!cells[c.calamity]) { noteJar({ calamity: c.calamity, count: c.count, text: c.text }); } candidate(c); }
    hintBar.hidden = false;
    for (const c of Object.values(cells)) c.el.tabIndex = c.cand ? 0 : -1;
    S.view.classList.add('choosing');
    S.actions(enshrineBtn);
    S.foot.classList.add('v-foot-sticky');
    S.foot.hidden = false;
    syncPicks();
    play(hintBar, [{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420 }, life);
    return new Promise((resolve) => { resolvePick = resolve; });
  }

  function confirmPick() {
    if (phase !== 'choosing') return;
    phase = 'enshrining';
    S.view.classList.remove('choosing');
    hintBar.hidden = true;
    S.foot.hidden = true;
    for (const c of Object.values(cells)) c.el.tabIndex = -1;
    const r = resolvePick;
    resolvePick = null;
    r?.({ enshrine: [...selected] });
    skip.show();
    life.unskip();
  }

  /* ---------------------------------------------------------------- the corkboard */
  const cork = h('section', { class: 'al-cork', hidden: true },
    h('div', { class: 'al-cork-head' }, h('h2', { class: 'display' }, 'The Almanac remembers...'), h('p', { class: 'hand' }, nextTown ? `Pinned up for tomorrow's audience in ${nextTown.name}: its own legends first, then older lore from the road.` : 'Legends from the road ahead.')),
    h('div', { class: 'al-notes' }));
  const notes = cork.querySelector('.al-notes');
  let noteN = 0;
  function recall(d) {
    cork.hidden = false;
    const k = noteN++;
    const rot = ((P.hash(d.text || String(k)) % 7) - 3) * 0.9;
    const score = Number.isFinite(d.score) ? Math.max(0, Math.min(1, d.score)) : 0.5;
    const el = h('article', { class: ['al-note', k % 2 ? 'tape-r' : 'tape-l'], style: { '--rot': `${rot}deg`, '--ink': String(0.62 + score * 0.38) } },
      h('i', { class: 'al-tape' }),
      h('p', { class: 'al-note-t' }, d.text),
      h('div', { class: 'al-note-meta' }, d.calamity ? tag(P.humanize(d.calamity), { tone: 'plain' }) : null, d.town && nextId && d.town !== nextId ? tag(`from ${D.towns[d.town]?.name || P.humanize(d.town)}`, { tone: 'plain' }) : null, h('span', { class: 'al-rel', title: `Relevance ${(score * 100).toFixed(0)}%` }, h('i', { style: { width: `${Math.round(score * 100)}%` } }))));
    notes.appendChild(el);
    play(el, [{ transform: `translateY(-80px) rotate(${rot - 12}deg) scale(1.2)`, opacity: 0 }, { transform: `rotate(${rot}deg) scale(1)`, opacity: 1 }], { duration: 560 }, life);
  }

  S.main.append(h('div', { class: 'al-grid' }, h('div', { class: 'al-left' }, hintBar, shelfWrap), ledger), cork);
  const skip = skipControl(life, S.slot);

  /* ---------------------------------------------------------------- run */
  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    const d = ev.data || {};
    if (ev.kind === 'almanac.noted') noteJar(d);
    else if (ev.kind === 'almanac.candidate') candidate(d);
    else if (ev.kind === 'almanac.tradition') return tradition(d);
    else if (ev.kind === 'memory.recalled') recall(d);
  };

  async function run() {
    try {
      const out = await ctx.runFlow({
        graph: 'almanac',
        input: tourInput(ctx, { result: ctx.params.result, next_town: nextId }),
        signal: life.signal,
        pace: async (ev) => {
          if (life.dead) return;
          const p = ingest(ev);
          if (p && typeof p.then === 'function') await p;
          await life.wait(P.paceMs(ev.kind, 1));
        },
        onEvent: () => {},
        onToken: () => {},
        onInterrupt: chooseTraditions,
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      phase = 'done';
      skip.hide();
      if (!jars.length) emptyNote.hidden = false;
      if (!Object.values(cells).some((c) => c.cand)) {
        shelfWrap.appendChild(h('p', { class: 'hand al-nothing' }, 'Nothing happened twice, so nothing is a tradition yet. The Almanac nods politely and goes back to its crossword.'));
      }
      setSlotsHint();
      const traditions = out.values?.traditions ?? enshrined.map((c) => ({ calamity: c, title: P.humanize(c), count: cells[c]?.j.count ?? 2 }));
      const recalled = out.values?.recalled ?? [];
      try { await ctx.refreshTour?.(); } catch { /* ignore */ }
      S.view.classList.remove('choosing');
      S.foot.hidden = false;
      S.actions(vbtn('To the printing press', { variant: 'primary', size: 'lg', icon: 'chevron-right', onclick: () => ctx.nav('playbill', carry(ctx, { traditions, recalled, next_town: nextId })) }));
      S.foot.classList.add('v-foot-sticky');
      cork.hidden = cork.hidden && !recalled.length;
      if (!cork.hidden) cork.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      clear(S.main);
      S.main.appendChild(errorCard(err, { title: 'The Almanac has lost its place', retry: () => ctx.nav('almanac', carry(ctx)) }));
    }
  }
  run();
  return { unmount() { life.dispose(); clear(root); } };
}
