// REHEARSAL (graph: rehearsal -> next: writers (back) | show)
// Spend a candle; twelve tiny stages light up as rehearsal.sample events arrive (dot colour = stars), then the star histogram
// stacks up, the mean and Madame's verdict appear, and the likeliest disasters are ranked by risk. No interrupt.
import { h, clear } from '../core/dom.js';
import { scaffold, createLife, skipControl, vbtn, tag, play, flash, burst, countTo, typewrite, tourInput, carry, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { puppetMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

const N_STAGES = 12;
const CANDLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 190" class="rh-candle-svg" aria-hidden="true">
  <defs><radialGradient id="rhglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2b0" stop-opacity=".95"/><stop offset=".45" stop-color="#e9b949" stop-opacity=".35"/><stop offset="1" stop-color="#e9b949" stop-opacity="0"/></radialGradient>
  <linearGradient id="rhwax" x1="0" x2="1"><stop offset="0" stop-color="#e8d9b4"/><stop offset=".45" stop-color="#fff6e0"/><stop offset="1" stop-color="#cdb98e"/></linearGradient></defs>
  <circle class="rh-halo" cx="60" cy="38" r="60" fill="url(#rhglow)"/>
  <ellipse cx="60" cy="176" rx="46" ry="9" fill="#a97c1f" stroke="#241a26" stroke-width="2.4"/><ellipse cx="60" cy="172" rx="40" ry="7" fill="#e9b949" stroke="#241a26" stroke-width="2"/>
  <path d="M40,172 L42,78 Q60,70 78,78 L80,172Z" fill="url(#rhwax)" stroke="#241a26" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M42,84 Q60,92 78,84 M50,88 q2,14 5,0 M66,90 q3,22 6,0" fill="none" stroke="#cdb98e" stroke-width="2"/>
  <path d="M60,78 V64" stroke="#241a26" stroke-width="3" stroke-linecap="round"/>
  <g class="rh-flame"><path d="M60,62 C42,44 56,30 60,6 C70,26 80,44 60,62Z" fill="#e9b949" stroke="#241a26" stroke-width="2.2" stroke-linejoin="round"/><path d="M60,60 C52,50 58,42 60,32 C66,44 70,52 60,60Z" fill="#fff6c8"/></g>
</svg>`;

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'rehearsal',
    title: 'The Rehearsal Room',
    sub: 'Twelve imaginary nights, performed by imaginary puppets, for one very real candle.',
  });
  const D = S.D;
  const performerName = (id) => D.performers[id]?.name ?? P.humanize(id);
  const samples = [];
  let summaryDone = false;

  /* ---------------------------------------------------------------- gate: light the candle */
  const candles = () => ctx.tour?.candles ?? 0;
  const gateTitle = h('h2', { class: 'display rh-gate-title' }, 'Light a candle, see the future');
  const gateText = h('p', { class: 'hand rh-gate-text' });
  const lightBtn = vbtn('Light the candle', { variant: 'gold', size: 'lg', icon: 'candle', onclick: () => light() });
  const backBtn = vbtn("Back to the writers' room", { variant: 'ghost', icon: 'back', onclick: () => ctx.nav('writers', carry(ctx, { cast: ctx.params.cast })) });
  const skipShowBtn = vbtn('Skip it: start the show', { variant: 'paper', icon: 'curtain', onclick: () => ctx.nav('show', carry(ctx, { cast: ctx.params.cast, script: ctx.params.script })) });
  const gate = h('section', { class: 'rh-gate v-paper' },
    h('div', { class: 'rh-candle' }, h('div', { class: 'rh-candle-wrap' }, candleEl())),
    h('div', { class: 'rh-gate-body' }, h('div', { class: 'kicker' }, 'Dress rehearsal'), gateTitle, gateText,
      h('div', { class: 'rh-gate-btns' }, lightBtn),
      h('div', { class: 'rh-gate-alt' }, backBtn, skipShowBtn)));
  function candleEl() { const d = h('div'); d.innerHTML = CANDLE_SVG; return d.firstElementChild; }
  function paintGate() {
    const n = candles();
    gateText.textContent = n > 0
      ? `Twelve rehearsals of ${ctx.params.script?.title ? `"${ctx.params.script.title}"` : 'your script'}, with your cast, in no time at all. It costs one candle. You have ${n}.`
      : 'You have no candles left. Rehearsing in the dark has been tried, and it went the way you think it did.';
    lightBtn.disabled = n <= 0;
    gate.classList.toggle('dark', n <= 0);
  }
  paintGate();

  /* ---------------------------------------------------------------- the twelve stages */
  const grid = h('div', { class: 'rh-grid', role: 'list', 'aria-label': 'Twelve rehearsals' });
  const tiles = [];
  for (let i = 0; i < N_STAGES; i++) {
    const dot = h('div', { class: 'rh-dot' }, h('b', null, ''));
    const cap = h('div', { class: 'rh-cap' });
    const fig = h('div', { class: 'rh-figs', 'aria-hidden': 'true' }, miniPuppet(0), miniPuppet(1));
    const el = h('div', { class: 'rh-stage', role: 'listitem', 'aria-label': `Rehearsal ${i + 1}: not yet`, style: { '--i': i } },
      h('div', { class: 'rh-frame' },
        h('div', { class: 'rh-wall' }), h('div', { class: 'rh-floor' }), fig,
        h('div', { class: 'rh-cur rh-cur-l' }), h('div', { class: 'rh-cur rh-cur-r' }), h('div', { class: 'rh-valance' }), dot,
        h('span', { class: 'rh-num' }, String(i + 1))),
      cap);
    tiles.push({ el, dot, cap, fig });
    grid.appendChild(el);
  }
  function miniPuppet(k) {
    const d = h('div', { class: 'rh-fig' });
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 40"><circle cx="12" cy="9" r="6" fill="${k ? '#f1dcc0' : '#f4dfc2'}" stroke="#241a26" stroke-width="1.6"/><path d="M${k ? 4 : 5},38 L${k ? 8 : 8},18 L16,18 L${k ? 20 : 19},38Z" fill="${k ? '#4d3a6b' : '#c0566e'}" stroke="#241a26" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    return d;
  }
  const meterText = h('div', { class: 'rh-progress hand' }, 'Waiting for the first night...');
  const stagesWrap = h('section', { class: 'rh-stages', hidden: true }, h('div', { class: 'rh-stages-head' }, h('h2', { class: 'display' }, 'Twelve stages'), meterText), grid);

  function lightTile(d) {
    const i = Number.isInteger(d.i) ? d.i : samples.length;
    const t = tiles[i];
    samples[i] = d;
    const done = samples.filter(Boolean).length;
    const running = P.meanStars(samples.filter(Boolean).map((s) => s.stars));
    meterText.textContent = `${done} of ${N_STAGES} rehearsed. Running average: ${running.toFixed(1)} stars.`;
    if (!t) return;
    const b = P.bucketStar(d.stars);
    t.el.classList.add('lit');
    t.el.dataset.stars = String(b);
    t.el.style.setProperty('--dot', P.starColour(d.stars));
    t.dot.firstChild.textContent = Number.isInteger(d.stars) ? String(d.stars) : d.stars.toFixed(1);
    t.cap.textContent = d.top_mishap ? (/[ ]/.test(d.top_mishap) ? d.top_mishap : P.humanize(d.top_mishap)) : 'A suspiciously clean night';
    t.el.setAttribute('aria-label', `Rehearsal ${i + 1}: ${d.stars} stars. ${d.top_mishap || ''}`);
    t.fig.classList.toggle('tumble', d.stars <= 2.5);
    t.fig.classList.toggle('cheer', d.stars >= 4);
    play(t.dot, [{ transform: 'scale(.2) translateY(-20px)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: .6 }, { transform: 'none' }], { duration: 480 }, life);
    flash(t.el, 'rh-flash', 600);
  }

  /* ---------------------------------------------------------------- the results */
  const results = h('section', { class: 'rh-results', hidden: true });

  function showSummary(d) {
    if (summaryDone) return;
    summaryDone = true;
    const known = samples.filter(Boolean);
    const hist = Array.isArray(d.histogram) && d.histogram.length === 5 ? d.histogram : P.histogram(known);
    const mean = Number.isFinite(d.mean) ? d.mean : P.meanStars(known.map((s) => s.stars));
    const total = hist.reduce((a, b) => a + b, 0) || known.length || 1;
    const max = P.histogramMax(hist);
    const risks = P.normalizeRisk(d.risk, N_STAGES);

    // histogram: columns of stacked dots
    const cols = h('div', { class: 'rh-hist-cols' });
    hist.forEach((n, k) => {
      const stack = h('div', { class: 'rh-stack' });
      for (let j = 0; j < n; j++) stack.appendChild(h('i', { class: 'rh-pip', style: { '--c': P.STAR_COLOURS[k + 1], '--d': `${(k * 3 + j) * 70}ms` } }));
      cols.appendChild(h('div', { class: 'rh-col', 'data-k': k + 1 }, h('div', { class: 'rh-count' }, String(n)), stack, h('div', { class: 'rh-axis' }, `${k + 1}`, h('span', null, k ? 'stars' : 'star'))));
    });
    const plot = h('div', { class: 'rh-plot' }, cols, h('div', { class: 'rh-mean-flag', style: { '--x': `${((Math.min(5, Math.max(1, mean)) - 1) / 4) * 80 + 10}%` } }, h('span', null, `mean ${mean.toFixed(1)}`)));
    const hist_ = h('div', { class: 'rh-hist v-paper' }, h('div', { class: 'kicker' }, 'The star distribution'), h('h3', { class: 'display' }, 'How the twelve nights went'), plot);
    const meanEl = h('div', { class: 'rh-mean-n display' }, '0.0');
    const mood = P.rehearsalVerdictMood(mean);
    const madame = D.staff.madame || { id: 'madame', kind: 'hand', palette: { body: '#7d1527', accent: '#e9b949', hair: '#2a1630' } };
    const verdictText = h('p', { class: 'hand rh-verdict-text' }, '');
    const meanBox = h('div', { class: 'rh-mean v-paper', 'data-mood': mood },
      h('div', { class: 'kicker' }, 'Average'), h('div', { class: 'rh-mean-row' }, meanEl, ctx.ui.starRating(mean, { size: 'lg', label: `${mean.toFixed(1)} stars on average` })),
      h('div', { class: 'rh-verdict' }, h('div', { class: 'rh-madame' }, svgEl(puppetMarkup(madame, { view: 'bust', mood: mood === 'glowing' ? 'joy' : mood === 'hopeful' ? 'smug' : mood === 'wobbly' ? 'fear' : 'grief', hat: 'top' }), { class: 'pp pp-bust' })), verdictText));
    const riskList = h('ol', { class: 'rh-risks' });
    risks.forEach((r, i) => {
      riskList.appendChild(h('li', { class: 'rh-risk', style: { '--i': i } },
        h('div', { class: 'rh-risk-t' }, h('span', null, r.title), h('b', null, `${Math.round(r.pct * 100)}%`)),
        h('div', { class: 'rh-risk-track' }, h('i', { style: { '--w': `${Math.max(4, r.pct * 100)}%` }, 'data-heat': r.pct > 0.5 ? 'hot' : r.pct > 0.25 ? 'warm' : 'cool' }))));
    });
    if (!risks.length) riskList.appendChild(h('li', { class: 'hand rh-norisk' }, 'No disasters predicted. This is the most suspicious result of all.'));
    const riskBox = h('div', { class: 'rh-riskbox v-paper' }, h('div', { class: 'kicker' }, 'Likeliest disasters'), h('h3', { class: 'display' }, 'What will probably go wrong'), riskList);

    clear(results);
    results.append(h('div', { class: 'rh-res-top' }, hist_, meanBox), riskBox);
    results.hidden = false;
    play(results, [{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520 }, life);
    countTo(meanEl, mean, { digits: 1, ms: 900, life });
    typewrite(verdictText, d.verdict || 'Darling, it is a show. Bring a bucket.', { cps: 60, life });
    // the pips drop in (CSS), the risk bars slide (CSS transition on --w after a frame)
    requestAnimationFrame(() => requestAnimationFrame(() => results.classList.add('go')));
    results.scrollIntoView?.({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    if (mean >= 4) ctx.ui.confetti?.({ count: 60, origin: { x: 0.5, y: 0.5 } });
  }

  /* ---------------------------------------------------------------- footer */
  const startBtn = vbtn('Start the show', { variant: 'primary', size: 'lg', icon: 'curtain', onclick: () => ctx.nav('show', carry(ctx, { cast: ctx.params.cast, script: ctx.params.script })) });
  const writersBtn = vbtn("Back to the writers' room", { variant: 'paper', icon: 'back', onclick: () => ctx.nav('writers', carry(ctx, { cast: ctx.params.cast })) });

  S.main.append(gate, stagesWrap, results);
  const skip = skipControl(life, S.slot);
  skip.hide();

  /* ---------------------------------------------------------------- run */
  const seen = new Set();
  const ingest = (ev) => {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    if (ev.kind === 'rehearsal.sample') lightTile(ev.data);
    else if (ev.kind === 'rehearsal.summary') showSummary(ev.data);
  };

  let started = false;
  async function light() {
    if (started) return;
    started = true;
    lightBtn.disabled = true;
    try {
      await spendCandle();
    } catch (err) {
      started = false;
      paintGate();
      ctx.toast?.({ title: 'No candle lit', body: err?.message || 'The wick would not take.', tone: 'danger' });
      return;
    }
    gate.classList.add('lit');
    gateTitle.textContent = 'The candle burns while twelve nights unfold';
    ctx.refreshTour?.();
    paintGate();
    await life.wait(650);
    if (life.dead) return;
    gate.classList.add('burnt');
    stagesWrap.hidden = false;
    play(stagesWrap, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 480 }, life);
    skip.show();
    try {
      const out = await ctx.runFlow({
        graph: 'rehearsal',
        input: tourInput(ctx, { cast: ctx.params.cast, script: ctx.params.script, samples: N_STAGES }),
        signal: life.signal,
        pace: life.paceFor(ingest),
        onEvent: () => {},
        onToken: () => {},
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      if (!summaryDone) showSummary(out.values?.summary || {});
      skip.hide();
      S.actions(writersBtn, startBtn);
      S.foot.classList.add('v-foot-sticky');
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      skip.hide();
      results.hidden = false;
      clear(results);
      results.appendChild(errorCard(err, { title: 'The rehearsal fell over', retry: () => ctx.nav('rehearsal', carry(ctx)) }));
      S.actions(writersBtn, startBtn);
    }
  }

  async function spendCandle() {
    const id = ctx.tour?.id;
    if (typeof ctx.api?.candle === 'function') await ctx.api.candle(id);
    else if (typeof ctx.api?.post === 'function') await ctx.api.post(`/api/tour/${encodeURIComponent(id)}/candle`, {});
    else throw new Error('No way to light a candle from here.');
  }

  return { unmount() { life.dispose(); clear(root); } };
}
