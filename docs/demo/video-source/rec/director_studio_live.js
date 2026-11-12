// LIVE run of casting_call in Studio: Input form -> Submit -> nodes light up -> interrupt (confirm_cast).
const right = () => qa('*').filter(e => e.children.length === 0 && e.getBoundingClientRect().left > 700 && isVisible(e)).map(e => norm(e.textContent)).join(' / ');
await waitFor(() => q('.react-flow__node'), 40000, 'graph nodes');
await sleep(2500);
rec.mark('studio_loaded');
await sleep(2500);                                   // the Input form (all fields optional) is on screen
rec.mark('input_form');
await sleep(1500);
await click('css:button[aria-label="Submit"]', { timeout: 10000 });
rec.mark('run_submitted');
await sleep(900);
await safe('collapse input', async () => { await click('css:button[aria-label="Collapse input editor"]', { timeout: 5000 }); });
const interrupted = await waitFor(() => /interrupt/i.test(right()), 120000, 'interrupt shown');
rec.mark('interrupt_shown');
await sleep(1500);
await safe('scroll to interrupt', async () => {
  const sc = qa('*').find(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 100 && e.getBoundingClientRect().left > 400; });
  if (sc) await smoothScrollBy(sc, 3000, 1800);
});
await sleep(4500);
rec.mark('interrupt_held');
await sleep(500);
