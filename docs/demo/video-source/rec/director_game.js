// Director: one continuous film of a real night of "Probably a Tragedy" (seed 7, Farce, middle draft, rehearsal, option 2 at the Prompter's box).
// Body of an async function (see README). Never hangs: every wait has a timeout, failures are logged and the film carries on.
const HOLD_FROZEN_MS = 2200;      // staging: keep the Prompter's box faded out this long so the frozen stage itself is on screen (the real stage waits for you anyway)
const READ_BOX_MS = 2600;         // time the box stays open before the cursor chooses
const TOTAL_BUDGET_MS = 1500 * 1000;

const T0 = performance.now();
const since = () => ((performance.now() - T0) / 1000).toFixed(1);
const hb = setInterval(() => {
  const h1 = q('h1, h2');
  rec.log('hb ' + location.hash + ' | ' + (h1 ? norm(h1.textContent).slice(0, 50) : '') + ' | cap: ' + norm((q('.show-caption') || {}).textContent || '').slice(0, 70));
}, 10000);

const route = (frag, timeout) => waitFor(() => (location.hash || '').indexOf(frag) >= 0, timeout == null ? 30000 : timeout, 'route ' + frag);
const btn = (label, extra) => byText(label, Object.assign({ tag: 'button' }, extra || {})) || byText(label, Object.assign({ tag: 'a' }, extra || {}));
const onRoute = (frag) => (location.hash || '').indexOf(frag) >= 0;
// click something that should change the route; retry a few times (never hang)
async function clickToRoute(target, frag, tries) {
  for (let i = 0; i < (tries || 3); i++) {
    if (onRoute(frag)) return true;
    await click(target, { timeout: 15000 });
    if (await waitFor(() => onRoute(frag), 6000, 'route ' + frag + ' after click (try ' + (i + 1) + ')')) return true;
  }
  return false;
}
const waitBtnEnabled = (label, timeout) => waitFor(() => { const b = btn(label); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null; }, timeout, 'enabled button ' + label);

// ------------------------------------------------------------------ A. title
await waitFor(() => hasText('New Tour'), 20000, 'title');
await sleep(900);
rec.mark('title');
await sleep(3300);                                  // curtains rise, bulbs chase
await safe('seed', async () => { await typeInto('Seed (optional)', '7', { perChar: true, delay: 140 }); });
await sleep(900);

// ------------------------------------------------------------------ B. tour map
await safe('new tour', async () => {
  await click('New Tour', { after: 200 });
  if (await waitFor(() => hasText('Abandon the current tour?'), 1500, 'abandon dialog')) {
    const dlg = q('[role=dialog]') || document.body;
    const b = byText('New tour', { root: dlg, tag: 'button', exact: true });
    if (b) await click(b);
  }
});
await waitText("Begin tonight's show", 30000);
await sleep(500);
rec.mark('tour_map');
await sleep(3200);                                   // the map of five towns
await safe('genre', async () => {
  await click('Farce', { timeout: 10000 });
  rec.mark('genre_pick');
  await sleep(2200);
});
await safe('begin', async () => { await clickToRoute("Begin tonight's show", 'casting'); });

// ------------------------------------------------------------------ C. casting
await route('casting', 30000);
rec.mark('casting_start');
await sleep(1500);
const accept = await waitBtnEnabled("Accept Madame's pick", 300000);
if (!accept) { rec.log('WARN casting: Accept never enabled; trying Skip'); const s = btn('Skip'); if (s) await click(s); await sleep(2000); }
rec.mark('cast_ready');
await sleep(2400);
await safe('accept', async () => { await click(btn("Accept Madame's pick") || "Accept Madame's pick", { timeout: 8000 }); });
rec.mark('cast_confirmed');                        // Accept Madame's pick also confirms the cast
await sleep(1500);
await safe('confirm', async () => {                // only if the game still wants an explicit confirm
  const c = byText('Confirm this cast', { tag: 'button' });
  if (c && !c.disabled && isVisible(c) && (location.hash || '').indexOf('casting') >= 0) await click(c);
});

// ------------------------------------------------------------------ D. writers
await route('writers', 40000);
rec.mark('writers_start');
const cardsReady = await waitFor(() => { const c = qa('article[role=button]').filter(isVisible); return c.length >= 3 && c.every((e) => norm(e.textContent).length > 40) ? c : null; }, 420000, 'three drafts');
await sleep(900);
await safe('scroll drafts', async () => { const hd = byText(/^The drafts/i, { tag: 'h2' }) || byText(/^The drafts/i); if (hd) await scrollToEl(hd, { block: 'start', margin: 72, force: true }); });
rec.mark('drafts_ready');
await sleep(3000);
await safe('pick middle', async () => {
  const cards = qa('article[role=button]').filter(isVisible);
  rec.log('drafts: ' + cards.map((c) => norm((c.querySelector('h3,h2,.display') || c).textContent).slice(0, 40)).join(' | '));
  await click(cards[1] || cards[0], { timeout: 5000 });
  await sleep(1400);
  const seal = await waitFor(() => { const b = q('.wr-sealbtn'); return b && !b.disabled ? b : null; }, 15000, 'seal enabled');
  if (seal) await click(seal);
  rec.mark('draft_sealed', { label: seal ? norm(seal.textContent) : null });
});
await waitText('Rehearse first, or straight to the stage?', 30000);
await sleep(2200);

// ------------------------------------------------------------------ E. rehearsal (spend the candle)
await safe('rehearse', async () => { await clickToRoute(/Rehearse first/, 'rehearsal'); });
await route('rehearsal', 30000);
rec.mark('rehearsal_start');
await sleep(1800);
await safe('light', async () => { await click('Light the candle', { timeout: 20000 }); });
await sleep(1200);
await safe('scroll grid', async () => { const g = q('.rh-grid'); if (g) await scrollToEl(g, { block: 'center', margin: 40, force: true }); });
const rehDone = await waitFor(() => { const b = btn('Start the show', { exact: true }); return b && isVisible(b) && !b.disabled ? b : null; }, 400000, 'rehearsal results');
await sleep(2200);                                  // let the last of the twelve stages play out
await safe('scroll results', async () => { const k = byText(/likeliest disasters/i); if (k) await scrollToEl(k, { block: 'center', margin: 60, force: true }); });
rec.mark('rehearsal_done');
await sleep(3400);
await safe('start show', async () => { await clickToRoute(btn('Start the show', { exact: true }) || btn('Start the show'), 'show'); });

// ------------------------------------------------------------------ F. the show (1x, real time)
await route('show', 30000);
rec.mark('show_start');
await sleep(1200);
await safe('focus stage', async () => { const f = q('.show-frame'); if (f) await scrollToEl(f, { block: 'center', margin: 40 }); });
const speed1 = qa('.speed button').find((b) => /1x/.test(b.textContent)); if (speed1 && speed1.getAttribute('aria-pressed') !== 'true') await click(speed1);

let boxes = 0, curtain = false;
const handled = new Set();
const showStart = performance.now();
while (performance.now() - showStart < 1000 * 1000 && performance.now() - T0 < TOTAL_BUDGET_MS) {
  const ov = q('.box-overlay');
  if (ov && !handled.has(ov)) {
    handled.add(ov);
    boxes++;
    const sfx = boxes === 1 ? '' : '_' + boxes;
    let style = null;
    if (HOLD_FROZEN_MS > 0) {
      style = document.createElement('style');
      style.textContent = '.box-overlay{opacity:0!important;pointer-events:none!important;}';
      document.head.append(style);
    }
    rec.mark('mishap_frozen' + sfx);
    await sleep(HOLD_FROZEN_MS);
    if (style) style.remove();
    const title = norm((q('.box-title') || {}).textContent || '');
    const opts = qa('.box-opt').map((o) => norm(o.querySelector('.bo-label') ? o.querySelector('.bo-label').textContent : o.textContent));
    rec.mark('prompter_open' + sfx, { mishap: title, options: opts });
    await sleep(READ_BOX_MS);
    const o2 = qa('.box-opt')[1] || qa('.box-opt')[0];
    if (o2) await click(o2, { timeout: 5000 });
    else { rec.log('WARN no .box-opt; pressing 2'); await pressKey('2'); }
    rec.mark('whisper_sent' + sfx, { chose: opts[1] || opts[0] || null });
    await waitFor(() => !q('.box-overlay'), 15000, 'box closes');
    await sleep(400);
    rec.mark('resumed' + sfx);
    continue;
  }
  if (!curtain && ((q('.call-host') && /Curtain call/.test(q('.call-host').textContent)) || byText(/^To the reviews/, { tag: 'button' }))) { curtain = true; rec.mark('curtain_call'); break; }
  const err = hasText('The curtain stuck') || hasText('Try the scene again');
  if (err) { rec.log('WARN show error banner: ' + norm(bodyText()).slice(0, 200)); rec.mark('show_error'); break; }
  await sleep(150);
}
rec.log('show loop ended; mishap boxes: ' + boxes + '; curtain=' + curtain);
await sleep(2500);
await safe('call card', async () => { const c = q('.call-host') || q('.show-call'); if (c) await scrollToEl(c, { block: 'center', margin: 30 }); });
await sleep(3000);
const toReviews = await waitFor(() => { const b = byText(/^To the reviews/, { tag: 'button' }); return b && isVisible(b) ? b : null; }, 60000, 'To the reviews');
if (toReviews) await click(toReviews);

// ------------------------------------------------------------------ G. reviews + gazette + almanac
await route('reviews', 40000);
rec.mark('reviews_start');
await sleep(2000);
const toAlm = await waitFor(() => { const b = btn('To the Almanac'); return b && !b.disabled ? b : null; }, 300000, 'reviews finished');
await sleep(1200);
await safe('gazette', async () => {
  const mast = byText(/WIBBLING GAZETTE/i) || byText(/Gazette/i);
  if (mast) await scrollToEl(mast, { block: 'start', margin: 70 });
  rec.mark('gazette', { headline: norm((q('.rv-headline, .rv-gazette h2, .rv-gazette h3') || {}).textContent || '') });
  await sleep(3200);
});
await safe('to almanac', async () => { await click(btn('To the Almanac') || 'To the Almanac'); });
await route('almanac', 40000);
rec.mark('almanac');
await waitFor(() => btn('To the printing press'), 240000, 'almanac finished');
await sleep(2500);
await safe('almanac scroll', async () => {
  const sp = scrollParent(q('.al-shelfwrap') || document.body);
  const max = sp.scrollHeight - sp.clientHeight;
  if (max > 40) { await smoothScrollBy(sp, Math.min(max, 560), 1600); await sleep(2200); await smoothScrollBy(sp, Math.min(max, 560), 1600); await sleep(1800); }
});

// ------------------------------------------------------------------ Prompt Book
await safe('promptbook', async () => {
  await click('css:.bk-button', { timeout: 10000 });
  await waitFor(() => { const d = q('.bk-drawer'); return d && !d.hidden && isVisible(d) ? d : null; }, 10000, 'drawer');
  rec.mark('promptbook_open');
  await sleep(3200);
  // wait for the links to resolve (View trace becomes a real link)
  await waitFor(() => { const a = byText('View trace', { tag: 'a' }); return a ? a : null; }, 20000, 'trace link');
  const drawer = q('.bk-drawer');
  const link = byText('Open in LangGraph Studio', { root: drawer }) || byText('This thread in Studio', { root: drawer });
  if (link) await scrollToEl(link, { block: 'center', margin: 40 });
  await sleep(500);
  rec.mark('promptbook_links', {
    studio: (byText('Open in LangGraph Studio', { tag: 'a' }) || {}).href || null,
    thread: (byText('This thread in Studio', { tag: 'a' }) || {}).href || null,
    trace: (byText('View trace', { tag: 'a' }) || {}).href || null,
    thread_id: norm((q('.bk-thread') || {}).textContent || '').slice(0, 80),
  });
  await sleep(4200);
});

// tour id (for thread lookup)
let tourId = null;
try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/tour_id$/.test(k)) tourId = localStorage.getItem(k); } } catch (e) {}
try { tourId = JSON.parse(tourId); } catch (e) {}
rec.mark('end', { tour_id: tourId, boxes });
clearInterval(hb);
await sleep(300);
