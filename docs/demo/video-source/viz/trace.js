// trace.js: animated waterfall of REAL LangSmith run data (trace_data.json, written by make_trace_data.py).
const Q = new URLSearchParams(location.search);
const SPEED = Math.max(0.3, parseFloat(Q.get('speed')) || 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
window.__done = false; window.__captions = [];
const T0 = performance.now();
const mark = (name, data) => { try { if (window.rec && window.rec.mark) window.rec.mark(name, data); } catch (e) { /* not recording */ } };
const step = (text) => { const rec = { t: +((performance.now() - T0) / 1000).toFixed(2), text }; window.__captions.push(rec); mark('step', rec); };

const ROW_H = 25, BAR_L = 332, BAR_W = 346;

function fmtMs(ms) { return ms <= 0 ? '<1 ms' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`; }

/** Flatten a trace into display rows: indentation by depth, parallel siblings of one name collapsed into one "xN" row. */
function build(trace) {
  const rows = trace.rows, byId = new Map(rows.map((r) => [r.id, r]));
  const depth = (r) => { let d = 0, p = r.parent; while (p && byId.has(p)) { d++; p = byId.get(p).parent; } return d; };
  rows.forEach((r) => { r.d = depth(r); });
  const sorted = [...rows].sort((a, b) => a.off - b.off || a.d - b.d);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.parent === r.parent && last.name === r.name && r.type === last.type && r.off - last.lastStart <= 80) {
      last.n++; last.end = Math.max(last.end, r.off + r.ms); last.lastStart = r.off; last.tokens += r.tokens;
      last.ptok += r.ptok; last.ctok += r.ctok; last.ids.push(r.id); last.interrupted = last.interrupted || r.interrupted;
    } else out.push({ name: r.name, type: r.type, parent: r.parent, d: r.d, n: 1, off: r.off, end: r.off + r.ms, lastStart: r.off, tokens: r.tokens, ptok: r.ptok, ctok: r.ctok, ids: [r.id], interrupted: r.interrupted, status: r.status, parent_name: r.parent_name });
  }
  out.forEach((r) => { r.ms = r.end - r.off; });
  return out;
}

(async function main() {
  const D = await (await fetch('trace_data.json', { cache: 'no-store' })).json();
  $('tid').textContent = D.thread_id;
  const traces = D.traces.map((t, i) => ({ ...t, ti: i, disp: build(t) }));
  const total = (t) => Math.max(1, ...t.disp.map((r) => r.end));

  // ---- tabs
  const tabs = $('tabs');
  const tabHtml = (t, i) => `<div class="tab" id="tab${i}"><b>RUN ${i + 1}</b><span class="id">${esc(t.short)}</span><span>${t.n_runs} runs · ${fmtMs(t.ms)}</span>${i === 0 ? '<span class="badge amber">⏸ INTERRUPT</span>' : '<span class="badge green">▶ RESUMED</span>'}</div>`;
  tabs.innerHTML = traces.map(tabHtml).join('');

  // ---- waterfall
  const rowsEl = $('rows'), axisEl = $('axis');
  function drawAxis(t) {
    const tot = total(t);
    const stepMs = tot > 1600 ? 500 : tot > 800 ? 250 : 100;
    let h = '<span class="nm">RUN</span><span style="left:' + (BAR_L - 30) + 'px;transform:none;left:' + (BAR_L - 46) + 'px;font-family:var(--sans);font-weight:700;letter-spacing:.05em;color:var(--dim)"></span>';
    let g = '';
    for (let ms = 0; ms <= tot + 1; ms += stepMs) {
      const x = BAR_L + (ms / tot) * BAR_W;
      h += `<span style="left:${x}px">${ms === 0 ? '0' : ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s'}</span>`;
      g += `<div class="grid" style="left:${x}px"></div>`;
    }
    axisEl.innerHTML = h;
    rowsEl.innerHTML = g;
  }
  function addRow(t, i) {
    const r = t.disp[i], tot = total(t);
    const kind = r.d === 0 ? 'root' : r.interrupted ? 'int' : r.type === 'llm' ? 'llm' : 'chain';
    const div = document.createElement('div');
    div.className = `row ${kind === 'llm' ? 'llm' : kind === 'int' ? 'int' : ''}`;
    div.style.top = `${i * ROW_H}px`;
    const left = (r.off / tot) * BAR_W, width = Math.max(5, ((r.end - r.off) / tot) * BAR_W);
    const resumed = t.ti === 1 && r.name === 'prompters_box';
    div.innerHTML = `<div class="nm" style="padding-left:${r.d * 22 + 12}px"><span class="dot ${kind === 'chain' ? '' : kind}"></span>${esc(r.name)}${r.n > 1 ? `<span class="x">×${r.n}</span>` : ''}${r.type === 'llm' ? `<span class="tk">${r.tokens} tok</span>` : ''}${r.interrupted ? '<span class="ib">⏸ interrupt</span>' : ''}${resumed ? '<span class="rb">▶ resumed</span>' : ''}</div>` +
      `<div class="bar"><i class="${kind === 'chain' ? '' : kind}" style="left:${left}px"></i></div><div class="ms">${fmtMs(r.ms)}</div>`;
    rowsEl.appendChild(div);
    requestAnimationFrame(() => requestAnimationFrame(() => { div.classList.add('in'); div.querySelector('i').style.width = width + 'px'; }));
    r.el = div;
    return div;
  }
  const focus = (t, i) => { t.disp.forEach((r) => r.el && r.el.classList.remove('focus')); if (t.disp[i].el) t.disp[i].el.classList.add('focus'); };

  // ---- detail card
  const card = $('card');
  const fact = (k, v, cls = '', wide = false) => `<div class="fact${wide ? ' wide' : ''}"><div class="k">${esc(k)}</div><div class="v ${cls}">${v}</div></div>`;
  function setCard(kind, html) { card.className = kind; card.innerHTML = `<div class="in-anim">${html}</div>`; }
  const head = (chip, name, kind, sub) => `<div class="ct"><span class="chipT ${kind}">${chip}</span></div><div class="cn">${esc(name)}</div>${sub ? `<div class="cs">${sub}</div>` : ''}`;
  function cardRoot(t) {
    const resumed = t.ti === 1;
    setCard('root', head('ROOT RUN · THE GRAPH', 'performance', 'root', resumed ? 'run 2 of the same thread' : 'run 1 of the thread: curtain up') +
      `<div class="facts">${fact('status', esc(t.status), 'ok')}${fact('latency', fmtMs(t.ms), 'g')}${fact('tokens', t.tokens)}${fact('runs in trace', t.n_runs)}${fact('thread_id', esc(D.thread_id), 'mono', true)}</div>` +
      (resumed ? '<div class="note ok">Started with Command(resume=…) on the same thread_id: the checkpoint is loaded, not rebuilt.</div>' : '<div class="note" style="color:#cfe0ff;background:#0f1d33;border-color:#2a4a77">Every node below is a child run. One LangSmith trace per graph run.</div>'));
  }
  function cardNode(t, r) {
    const nd = D.nodes[r.name] || {};
    const cmd = (nd.out_keys || []).includes('goto');
    const kids = t.disp.filter((x) => x.parent_name === r.name && x.d > r.d && x.off >= r.off && x.end <= r.end + 2);
    setCard('', head('NODE RUN', r.name, '', r.name === 'direct' ? 'Madame decides what happens in this beat' : '') +
      `<div class="facts">${fact('status', esc(r.status || 'success'), 'ok')}${fact('latency', fmtMs(r.ms), 'g')}${fact('start offset', fmtMs(r.off))}${fact('child runs', kids.length ? kids.map((k) => k.type === 'llm' ? '1 LLM call' : k.name).join(', ') : 'none')}</div>` +
      (cmd ? '<div class="note" style="color:#cfe0ff;background:#0f1d33;border-color:#2a4a77">This node returns a Command: a state update plus where to go next.</div>' : ''));
  }
  function cardLLM(l) {
    setCard('llm', head('LLM CALL', 'ChatOpenAI', 'llm', esc((l.model || '') + ' · ' + l.tokens + ' tokens')) +
      `<div class="facts f3">${fact('latency', fmtMs(l.ms), 'g')}${fact('prompt tokens', l.ptok, 'g')}${fact('completion tokens', l.ctok, 'g')}</div>` +
      `<div class="blk"><div class="k">PROMPT · SYSTEM</div><div class="t c2"><div class="in">${esc(l.system)}</div></div></div>` +
      `<div class="blk"><div class="k">PROMPT · HUMAN</div><div class="t c3"><div class="in">${esc(l.human)}</div></div></div>` +
      `<div class="blk reply"><div class="k">REPLY</div><div class="t c3"><div class="in">${esc(l.reply)}</div></div></div>`);
  }
  function cardInterrupt(t, r) {
    setCard('int', head('INTERRUPT', r.name, 'int', 'the last node of run 1') +
      `<div class="facts">${fact('status', 'interrupted', 'am')}${fact('latency', fmtMs(r.ms))}${fact('trace', esc(t.short), 'mono')}${fact('thread_id', esc(D.thread_id.slice(0, 8)) + '…', 'mono')}</div>` +
      '<div class="note"><b>interrupt()</b> stops the run here. The state is checkpointed under the thread_id; nothing runs until a resume.</div>');
  }
  function cardResumed(t, r) {
    setCard('', head('NODE RUN', r.name, '', 'the first node of run 2') +
      `<div class="facts">${fact('status', esc(r.status || 'success'), 'ok')}${fact('latency', fmtMs(r.ms))}${fact('trace', esc(t.short), 'mono')}${fact('thread_id', esc(D.thread_id.slice(0, 8)) + '…', 'mono')}</div>` +
      '<div class="note ok">The node re-runs from its first line; <b>interrupt()</b> now returns the whisper. Then the run carries on to curtain_call.</div>');
  }
  function cardThread() {
    const [a, b] = traces;
    const blk = (t, label, cls, text) => `<div class="fact wide" style="border-color:${cls}"><div class="k">${label} · trace ${esc(t.short)}</div><div class="v" style="font-size:21px">${text}</div></div>`;
    setCard('root', head('ONE THREAD', 'thread_id', 'root', 'the same id ties both traces together') +
      `<div class="facts">${fact('thread_id', esc(D.thread_id), 'mono', true)}${blk(a, 'RUN 1', '#7a5a14', `${a.n_runs} runs · ${fmtMs(a.ms)}<br><span style="color:var(--amber)">⏸ stopped at prompters_box</span>`)}${blk(b, 'RUN 2', '#1f6a52', `${b.n_runs} runs · ${fmtMs(b.ms)}<br><span style="color:var(--green)">▶ resumed, ended at curtain_call</span>`)}</div>` +
      `<div class="cs" style="margin-top:6px">LangSmith project <b style="color:var(--text)">${esc(D.project)}</b>: ${D.llm.length} LLM calls, ${traces.reduce((s, t) => s + t.tokens, 0)} tokens across both runs.</div>`);
  }

  // ---- the show
  async function playTrace(t, plan) {
    drawAxis(t);
    const idx = (pred) => t.disp.findIndex(pred);
    for (let i = 0; i < t.disp.length; i++) {
      addRow(t, i); focus(t, i);
      const r = t.disp[i];
      const act = plan(i, r);
      if (act) { await act(); }
      else await sleep(t.ti === 0 ? 270 : 190);
    }
  }
  $('tab0').classList.add('on');
  step('Run 1: root run (the graph)');
  mark('trace-start', { thread: D.thread_id });
  await sleep(900);
  const t0 = traces[0], t1 = traces[1];
  const llmFor = (t, r) => D.llm.find((l) => l.ti === t.ti && l.off >= r.off - 3 && l.off <= r.end && l.ms === r.ms) || D.llm.find((l) => l.ti === t.ti && Math.abs(l.off - r.off) < 8);
  let shownNode = false, shownLLM = false;
  await playTrace(t0, (i, r) => {
    if (i === 0) return async () => { cardRoot(t0); await sleep(2300); };
    if (r.name === 'direct' && !shownNode) { shownNode = true; return async () => { step('A node run: direct'); cardNode(t0, r); await sleep(1900); }; }
    if (r.type === 'llm' && !shownLLM) { shownLLM = true; return async () => { step('An LLM call: prompt, reply, tokens, latency'); const l = llmFor(t0, r); if (l) cardLLM(l); await sleep(4600); }; }
    if (r.interrupted) return async () => { step('Run 1 stops at the Prompter\'s box (interrupt)'); cardInterrupt(t0, r); await sleep(2800); };
    return null;
  });
  await sleep(500);
  // ---- run 2
  $('tab0').classList.remove('on'); $('tab1').classList.add('on');
  step('Run 2: resumed after the whisper');
  await sleep(500);
  let shownResume = false;
  await playTrace(t1, (i, r) => {
    if (i === 0) return async () => { cardRoot(t1); await sleep(2000); };
    if (r.name === 'prompters_box' && !shownResume) { shownResume = true; return async () => { cardResumed(t1, r); await sleep(2400); }; }
    return null;
  });
  await sleep(600);
  // ---- both traces, one thread
  step('Two traces, one thread_id');
  $('tab0').classList.add('hot', 'on'); $('tab1').classList.add('hot', 'on');
  $('thr').classList.add('hot');
  $('banner').classList.add('in');
  cardThread();
  await sleep(4600);
  mark('trace-end', {});
  window.__done = true;
})().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div style="position:absolute;left:30px;top:300px;color:#ff9aa6;font-size:24px">${esc(e.message)}</div>`); window.__error = String(e); window.__done = true; });
