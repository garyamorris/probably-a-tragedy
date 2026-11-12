// THE PRINTING PRESS (graph: playbill_press -> next: road)
// The programme card is typeset in CSS (poster layout, container-query sized) and revealed section by section as the
// playbill.section events arrive; the final playbill replaces the greeked placeholders. "Download PNG" paints the same layout
// onto a <canvas> (no libraries). No interrupt.
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, burst, tourInput, carry, nextTownId, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { puppetMarkup, sealMarkup, el as svgEl } from './_kit/art.js';
import { renderPlaybillCanvas, downloadCanvas } from './_kit/playbill-canvas.js';
import * as P from './_kit/pure.js';

const TASKS = [
  { key: 'cast', label: 'Setting the cast in type' },
  { key: 'traditions', label: 'Inking the Traditions' },
  { key: 'quote', label: 'Pasting up the review wall' },
  { key: 'previously', label: 'Laying out the back page' },
];

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'playbill',
    title: 'The Printing Press',
    sub: 'Tonight\'s programme, set in lead type by a clockwork spider with eight hands and no proofreader.',
  });
  const D = S.D;
  const normCtx = { towns: D.towns, genres: D.genres, performers: D.performers, params: { ...ctx.params, night: ctx.tour?.night ?? 0 } };

  /* ---------------------------------------------------------------- provisional + final playbill */
  const history = (ctx.tour?.history || []).filter((x) => x.night !== (ctx.tour?.night ?? 0)).sort((a, b) => a.night - b.night);
  const provisional = () => ({
    title: ctx.params.script?.title,
    tagline: ctx.params.script?.tagline,
    town: ctx.params.town,
    night: ctx.tour?.night ?? 0,
    genre: ctx.params.genre,
    cast: P.ROLES.map((role) => ({ id: ctx.params.cast?.[role], role })).filter((c) => c.id),
    tonight: [],
    traditions: ctx.params.traditions || [],
    quote: ctx.params.headline,
    stars: ctx.params.stars,
    back_page: [],
    previously: history.map((x) => ({ text: `Night ${x.night + 1}: ${x.title || P.humanize(x.town)}`, stars: x.stars })),
  });
  let raw = provisional();
  let pb = P.normalizePlaybill(raw, normCtx);
  let final = false;
  const revealed = new Set();

  /* ---------------------------------------------------------------- the poster (CSS-typeset) */
  const poster = h('article', { class: 'pb-poster', 'aria-label': 'The programme' });
  const posterWrap = h('div', { class: 'pb-posterwrap' }, h('div', { class: 'pb-shadow' }), poster);

  const greek = (n, seed) => h('div', { class: 'pb-greek', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { style: { width: `${58 + (P.hash(`${seed}${i}`) % 38)}%` } })));

  function build() {
    clear(poster);
    const sec = (key, cls, ...kids) => {
      const on = revealed.has(key);
      return h('section', { class: ['pb-sec', `pb-${key}`, cls, on && 'on'], 'data-sec': key }, ...kids);
    };
    // masthead
    const bustRow = h('div', { class: 'pb-busts' }, pb.cast.slice(0, 3).map((c) => {
      const p = D.performers[c.id];
      return h('figure', { class: 'pb-bust' }, h('div', { class: 'pb-oval', style: { '--pal': p?.palette?.body || '#6a4575' } }, p ? svgEl(puppetMarkup(p, { view: 'bust' }), { class: 'pp pp-bust' }) : null), h('figcaption', null, c.role || ''));
    }));
    const inner = h('div', { class: 'pb-inner' });
    poster.append(h('div', { class: 'pb-frame', 'aria-hidden': 'true' }), inner);
    inner.append(
      sec('masthead', '',
        h('div', { class: 'pb-kicker' }, 'The Wibbling Players present'),
        h('h2', { class: 'pb-title' }, pb.title),
        pb.tagline ? h('p', { class: 'pb-tagline' }, pb.tagline) : null,
        h('div', { class: 'pb-where' }, h('b', null, `${pb.genre} in ${pb.town}`), h('span', null, `${pb.nightLabel}  ·  doors at dusk`)),
        bustRow),
      h('div', { class: 'pb-orn', 'aria-hidden': 'true' }),
      sec('cast', '',
        h('div', { class: 'pb-label' }, 'With'),
        pb.cast.map((c) => h('div', { class: 'pb-castrow' }, h('div', { class: 'pb-castname' }, h('b', null, c.name), c.role ? h('span', null, ` as ${c.role}`) : null), c.bio ? h('p', { class: 'pb-bio' }, c.bio) : greek(2, c.id)))),
      sec('tonight', '',
        h('div', { class: 'pb-label' }, 'Tonight'),
        pb.tonight.length ? pb.tonight.slice(0, 4).map((t) => h('p', { class: 'pb-tonight' }, t)) : greek(1, 'tonight')),
      sec('traditions', '',
        h('div', { class: 'pb-label' }, 'By long tradition'),
        pb.traditions.length ? h('div', { class: 'pb-trads' }, pb.traditions.map((t) => h('span', { class: 'pb-trad' }, t))) : h('p', { class: 'pb-nothing' }, final ? 'No Traditions yet. The town has no expectations, which is its own kind of pressure.' : ''), ),
      sec('quote', '',
        pb.quote ? h('blockquote', { class: 'pb-quote' }, h('span', null, pb.quote), pb.stars != null ? h('div', { class: 'pb-qstars' }, ctx.ui.starRating(pb.stars, { size: 'sm', animate: false, label: `${pb.stars} stars` }), h('small', null, `${pb.stars} stars`)) : null) : greek(2, 'quote')),
      sec('back_page', '',
        h('div', { class: 'pb-notices' }, h('div', { class: 'pb-label' }, 'Notices'), pb.back_page.length ? h('ul', null, pb.back_page.slice(0, 4).map((n) => h('li', null, n))) : greek(2, 'back'))),
      sec('previously', '',
        h('div', { class: 'pb-label' }, 'Previously on tour'),
        pb.previously.length
          ? h('div', { class: 'pb-strip' }, pb.previously.slice(-4).map((x) => h('div', { class: 'pb-frame-cell' }, h('p', null, x.text), x.stars != null ? h('small', null, `${x.stars} ★`) : null)))
          : h('p', { class: 'pb-nothing' }, final ? 'Night one. Nothing has happened yet, which is the best a tour ever looks.' : '')),
      h('div', { class: 'pb-seal', 'aria-hidden': 'true' }, svgEl(sealMarkup({ seed: pb.title, mark: 'star' }), { class: 'vseal' })),
      h('div', { class: 'pb-printed', 'aria-hidden': 'true' }, 'Printed'));
  }
  build();

  function reveal(key) {
    if (!key || revealed.has(key)) return;
    revealed.add(key);
    const el = poster.querySelector(`[data-sec="${key}"]`);
    if (!el) return;
    el.classList.add('on');
    if (!life.fast && !reduced()) {
      el.classList.add('stamping');
      life.later(() => el.classList.remove('stamping'), 800);
    }
  }
  life.later(() => reveal('masthead'), 250);

  /* ---------------------------------------------------------------- the press room (checklist) */
  const checklist = h('ol', { class: 'pb-tasks' }, TASKS.map((t) => h('li', { 'data-task': t.key }, h('span', { class: 'pb-tick' }, icon('check', 'sm')), h('span', null, t.label))));
  const pressStatus = h('p', { class: 'hand pb-status' }, 'The rollers are warming up...');
  const press = h('aside', { class: 'pb-press v-paper' },
    h('div', { class: 'pb-rollers', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('div', { class: 'pb-sheet' })),
    h('div', { class: 'kicker' }, 'The press room'), checklist, pressStatus);

  const dlBtn = vbtn('Download PNG', { variant: 'gold', icon: 'download', disabled: true, onclick: () => download() });
  const onward = vbtn('Onward to the road', { variant: 'primary', size: 'lg', icon: 'wagon', disabled: true, onclick: () => ctx.nav('road', carry(ctx, { playbill: raw })) });
  const dlNote = h('p', { class: 'tiny muted pb-dlnote' }, 'The PNG is painted from the same layout onto a canvas in your browser. Nothing is sent anywhere.');

  S.main.append(h('div', { class: 'pb-grid' }, posterWrap, h('div', { class: 'pb-side' }, press, dlNote)));
  S.actions(dlBtn, onward);
  S.foot.classList.add('v-foot-sticky');
  const skip = skipControl(life, S.slot);

  /* ---------------------------------------------------------------- download */
  async function download() {
    dlBtn.disabled = true;
    try {
      const canvas = await renderPlaybillCanvas(pb, { performers: D.performers });
      const name = `playbill-night${(ctx.tour?.night ?? 0) + 1}-${String(pb.townId || pb.town).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      await downloadCanvas(canvas, name);
      ctx.toast?.({ title: 'Programme printed', body: name, tone: 'ok', ttl: 3200 });
      flash(posterWrap, 'flash-ok', 800);
    } catch (err) {
      console.error(err);
      ctx.toast?.({ title: 'The press jammed', body: err?.message || String(err), tone: 'danger' });
    } finally {
      dlBtn.disabled = false;
    }
  }

  /* ---------------------------------------------------------------- run */
  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    if (ev.kind !== 'playbill.section') return;
    const key = P.sectionFor(ev.data?.name, [...revealed]);
    const task = checklist.querySelector(`[data-task="${key}"]`);
    if (task) task.classList.add('done');
    if (ev.data?.text) pressStatus.textContent = ev.data.text;
    else pressStatus.textContent = `${P.humanize(ev.data?.name || key)} is dry. Moving on.`;
    reveal(key);
    // the layout task closes the issue: whatever has not been shown yet comes out of the press together
    if (/layout/i.test(ev.data?.name || '')) for (const k of P.PLAYBILL_ORDER) reveal(k);
  };

  async function run() {
    try {
      const out = await ctx.runFlow({
        graph: 'playbill_press',
        input: tourInput(ctx, { cast: ctx.params.cast, script: ctx.params.script, stars: ctx.params.stars, headline: ctx.params.headline, traditions: ctx.params.traditions || [] }),
        signal: life.signal,
        pace: life.paceFor(ingest),
        onEvent: () => {},
        onToken: () => {},
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      const result = out.values?.playbill;
      if (result) { raw = result; pb = P.normalizePlaybill({ ...result, stars: result.stars ?? ctx.params.stars }, normCtx); }
      final = true;
      for (const k of P.PLAYBILL_ORDER) revealed.add(k);
      build();
      for (const li of checklist.children) li.classList.add('done');
      poster.classList.add('printed');
      press.classList.add('done');
      pressStatus.textContent = 'Hot off the press, and only slightly on fire.';
      skip.hide();
      dlBtn.disabled = false;
      onward.disabled = false;
      play(poster, [{ transform: 'rotate(-1deg) scale(.985)' }, { transform: 'rotate(.4deg) scale(1.01)', offset: .5 }, { transform: 'none' }], { duration: 700 }, life);
      burst(posterWrap, { n: 10, spread: 120, life });
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      clear(S.main);
      S.main.appendChild(errorCard(err, { title: 'The press jammed', retry: () => ctx.nav('playbill', carry(ctx)) }));
    }
  }
  run();
  return { unmount() { life.dispose(); clear(root); } };
}
