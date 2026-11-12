// Studio on tonight's finished performance thread: graph (nodes visited) + steps. Page URL carries threadId.
const rightScroller = () => qa('*').find(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 200 && e.getBoundingClientRect().left > 400; });
await waitFor(() => q('.react-flow__node'), 40000, 'graph nodes');
await sleep(2500);
rec.mark('studio_loaded');
await sleep(2000);
await click('css:button[aria-label="Collapse input editor"]', { timeout: 8000 });
rec.mark('input_collapsed');
await sleep(1200);
await click('css:button[aria-label="Fit graph to view"]', { timeout: 8000 });
rec.mark('graph_fit');
await sleep(3000);
const sc = rightScroller();
if (sc) {
  sc.scrollTop = 0; await sleep(1500);
  rec.mark('steps_top');
  await sleep(2200);
  await smoothScrollBy(sc, 600, 2600); await sleep(1500);
  await safe('expand perform', async () => {
    const el = byText('perform', { root: sc, exact: true }) || byText('direct', { root: sc, exact: true });
    if (el) { await click(el); rec.mark('step_expanded'); await sleep(3500); }
  });
  await smoothScrollBy(sc, 700, 3000); await sleep(1500);
  await safe('expand react', async () => {
    const el = byText('react', { root: sc, exact: true });
    if (el) { await click(el); await sleep(3000); }
  });
  await smoothScrollBy(sc, 2000, 5000); await sleep(1200);
  rec.mark('steps_bottom');
  await sleep(2500);
}
await safe('zoom', async () => { await click('css:button[aria-label="Zoom in"]', { timeout: 4000 }); await sleep(600); await click('css:button[aria-label="Zoom in"]', { timeout: 4000 }); await sleep(2500); rec.mark('graph_zoomed'); });
await sleep(1500);
