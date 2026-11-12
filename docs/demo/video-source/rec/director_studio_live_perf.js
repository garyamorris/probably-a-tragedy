// LIVE run of the performance graph in Studio with empty (sparse) input: loop direct -> perform -> resolve -> react ... lights up, then the Prompter's-box interrupt.
const right = () => qa('*').filter(e => e.children.length === 0 && e.getBoundingClientRect().left > 700 && isVisible(e)).map(e => norm(e.textContent)).join(' / ');
await waitFor(() => q('.react-flow__node'), 40000, 'graph nodes');
await sleep(2500);
rec.mark('studio_loaded');
await sleep(2000);
await click('css:button[aria-label="Collapse input editor"]', { timeout: 8000 });
await sleep(800);
await click('css:button[aria-label="Fit graph to view"]', { timeout: 8000 });
await sleep(1500);
rec.mark('graph_fit');
await click('css:button[aria-label="Submit"]', { timeout: 10000 });
rec.mark('run_submitted');
const t0 = performance.now();
let interrupted = false;
while (performance.now() - t0 < 200000) {
  const r = right();
  if (/interrupt/i.test(r)) { interrupted = true; break; }
  if (/curtain_call/.test(r) && !qa('button').some(b => /cancel/i.test(b.getAttribute('aria-label') || b.textContent) && isVisible(b))) break;
  await sleep(500);
}
rec.mark(interrupted ? 'interrupt_shown' : 'run_finished');
await sleep(2500);
await safe('scroll steps', async () => {
  const sc = qa('*').find(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 100 && e.getBoundingClientRect().left > 400; });
  if (sc) await smoothScrollBy(sc, 5000, 2000);
});
await sleep(4500);
rec.mark('held');
await sleep(500);
