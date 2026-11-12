// THE GREENROOM (graph: greenroom_chat; reachable from the tour at any time)
// A backstage chat with a chosen performer. Each message is a run on a stable per-tour/per-performer thread (runFlow `attempt` =
// the performer's index: the server derives the same thread id every time, so the chat has memory). Tokens (`messages`) stream into
// the bubble; the tool-call review interrupt (langchain HITL middleware: approve / edit / reject) is an invoice card from Mrs. Gasket.
import { h, clear, stickToBottom } from '../core/dom.js';
import { scaffold, createLife, vbtn, tag, play, flash, burst, typewrite, isAbort, errorCard, icon, reduced } from './_kit/fx.js';
import { puppetMarkup, heartsRowMarkup, el as svgEl } from './_kit/art.js';
import * as P from './_kit/pure.js';

const TOOL_BLURB = {
  calm_nerves: 'Calm your nerves',
  fetch_prop: 'Fetch a prop',
  recall_gossip: 'Overhear gossip',
};

export async function mount(root, ctx) {
  const life = createLife(ctx);
  const S = scaffold(root, ctx, {
    name: 'greenroom',
    title: 'The Greenroom',
    sub: 'Backstage, between the acts. Nobody here is professional. Everybody here has opinions.',
    kicker: `Night ${(ctx.tour?.night ?? 0) + 1} of ${P.TOUR_NIGHTS}  ·  between the acts`,
  });
  const D = S.D;
  const performers = D.performerList;
  const pid = (i) => performers[i]?.id;
  const chats = {}; // actor -> [{role:'user'|'ai'|'tool'|'note', text, ...}]
  const rapport = { ...(ctx.tour?.rapport || {}) };
  const startActor = ctx.params?.actor && D.performers[ctx.params.actor] ? ctx.params.actor : performers[0]?.id;
  let actorId = startActor;
  let busy = false;

  /* ---------------------------------------------------------------- the row of portraits */
  const row = h('div', { class: 'gr-row', role: 'tablist', 'aria-label': 'Who is in the greenroom' });
  const tabs = {};
  for (const p of performers) {
    const hearts = h('div', { class: 'gr-mini-hearts' });
    const face = h('div', { class: 'gr-face' }, svgEl(puppetMarkup(p, { view: 'head' }), { class: 'pp pp-head' }));
    const el = h('button', { class: 'gr-tab', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-actor': p.id, onclick: () => selectActor(p.id), title: `${p.name}: ${p.blurb || ''}` },
      h('span', { class: 'gr-oval', style: { '--pal': p.palette?.body || '#6a4575' } }, face), h('span', { class: 'gr-tab-name' }, P.shortName(p.name)), hearts);
    tabs[p.id] = { el, hearts, face };
    row.appendChild(el);
  }
  function paintHearts(id, popLast = false) {
    const t = tabs[id];
    if (!t) return;
    t.hearts.innerHTML = heartsRowMarkup(rapport[id] ?? 0, { max: 5, size: 11 });
    if (popLast) flash(t.hearts, 'al-bump', 700);
  }
  performers.forEach((p) => paintHearts(p.id));

  /* ---------------------------------------------------------------- the dressing-room mirror: chat */
  const list = h('div', { class: 'gr-msgs', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  const sticky = stickToBottom(list);
  const input = h('input', { class: 'gr-input', type: 'text', placeholder: 'Say something to the mirror...', autocomplete: 'off', maxlength: 400, 'aria-label': 'Your message' });
  const sendBtn = h('button', { class: 'gr-send btn btn-gold v-btn v-btn-gold', type: 'submit', title: 'Send' }, icon('send'), h('span', { class: 'btn-label' }, 'Send'));
  const form = h('form', { class: 'gr-form', onsubmit: (e) => { e.preventDefault(); send(input.value); } }, input, sendBtn);
  const chips = h('div', { class: 'gr-chips', 'aria-label': 'Things you could say' }, P.QUICK_PROMPTS.map((q) => h('button', { class: 'gr-chip', type: 'button', onclick: () => send(q) }, q)));
  const mirror = h('section', { class: 'gr-mirror' }, h('div', { class: 'gr-glass' }, list, chips, form));

  /* ---------------------------------------------------------------- the dressing table */
  const bigFace = h('div', { class: 'gr-big' });
  const nameEl = h('h2', { class: 'display gr-name' });
  const blurbEl = h('p', { class: 'hand gr-blurb' });
  const flawsEl = h('div', { class: 'gr-flaws' });
  const heartsBig = h('div', { class: 'gr-hearts', role: 'img' });
  const rapportN = h('b', { class: 'gr-rap-n display' });
  const funds = h('b', { class: 'gr-funds-n display' });
  const table = h('aside', { class: 'gr-table v-paper' },
    bigFace, nameEl, blurbEl, flawsEl,
    h('div', { class: 'gr-rap' }, h('div', { class: 'kicker' }, 'Rapport'), h('div', { class: 'gr-rap-row' }, heartsBig, rapportN),
      h('p', { class: 'tiny muted' }, 'Rapport makes them readier to say "Yes, and..." with you on stage: each point makes them likelier to pile into your whispers.')),
    h('div', { class: 'gr-can' }, h('div', { class: 'kicker' }, 'You could ask them to'),
      h('ul', null,
        h('li', null, h('b', null, 'Calm their nerves'), ' (rapport goes up)'),
        h('li', null, h('b', null, 'Fetch a prop'), ' (costs funds; a real prop warms the house whenever a scene needs it)'),
        h('li', null, h('b', null, 'Share gossip'), ' (from the Almanac)'))),
    h('div', { class: 'gr-wallet' }, icon('coin'), h('span', null, 'Funds'), funds));

  function paintTable(mood = 'neutral', talking = false) {
    const p = D.performers[actorId];
    if (!p) return;
    clear(bigFace);
    bigFace.appendChild(svgEl(puppetMarkup(p, { view: 'bust', mood, cls: talking ? 'pp-talk' : '' }), { class: `pp pp-bust${talking ? ' pp-talk' : ''}` }));
    bigFace.style.setProperty('--pal', p.palette?.body || '#6a4575');
    nameEl.textContent = p.name;
    blurbEl.textContent = p.blurb || '';
    clear(flawsEl);
    for (const f of p.flaws || []) flawsEl.appendChild(tag(P.phrase(D.flaws[f]?.name ?? f).replace(/^./, (c) => c.toUpperCase()), { tone: 'warn', ic: 'alert' }));
    paintRapportBig();
    funds.textContent = String(ctx.tour?.funds ?? '?');
  }
  function paintRapportBig() {
    heartsBig.innerHTML = heartsRowMarkup(rapport[actorId] ?? 0, { max: 5, size: 30 });
    const r = rapport[actorId] ?? 0;
    rapportN.textContent = `${Number.isInteger(r) ? r : r.toFixed(1)} / 5`;
    heartsBig.setAttribute('aria-label', `Rapport ${r} of 5`);
  }

  /* ---------------------------------------------------------------- messages */
  const actorFirst = () => P.shortName(D.performers[actorId]?.name);
  function bubble(m) {
    if (m.role === 'user') return h('div', { class: 'gr-msg me' }, h('div', { class: 'gr-bub' }, m.text));
    if (m.role === 'note') return h('div', { class: 'gr-note hand' }, m.text);
    if (m.role === 'tool') return h('div', { class: ['gr-tool', `st-${m.status}`] }, icon('tool', 'sm'), h('span', { class: 'gr-tool-n' }, m.name), m.args ? h('code', null, Object.entries(m.args).map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : v}`).join(', ')) : null, h('b', null, m.status));
    const p = D.performers[m.actor || actorId];
    return h('div', { class: 'gr-msg them', style: { '--pal': p?.palette?.body || '#6a4575' } },
      h('div', { class: 'gr-av' }, p ? svgEl(puppetMarkup(p, { view: 'head' }), { class: 'pp pp-head' }) : null),
      h('div', { class: 'gr-bub', 'data-live': m.live ? '1' : null }, m.text));
  }
  function renderChat() {
    clear(list);
    const log = chats[actorId] || [];
    const p = D.performers[actorId];
    if (!log.length) {
      const line = p?.voice?.catchphrases?.[0];
      list.appendChild(h('div', { class: 'gr-empty' }, h('p', { class: 'hand' }, `${actorFirst()} looks up from the mirror${line ? ': "' + line + '"' : '.'}`), h('p', { class: 'hand muted' }, 'Say something, or pick a prompt below. The dressing room has very thin walls.')));
    }
    for (const m of log) list.appendChild(bubble(m));
    sticky.pin();
  }
  function push(m) {
    (chats[actorId] ||= []).push(m);
    const el = bubble(m);
    list.querySelector('.gr-empty')?.remove();
    list.appendChild(el);
    play(el, [{ transform: 'translateY(12px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320 }, life);
    sticky.follow();
    return el;
  }

  function selectActor(id) {
    if (busy || !D.performers[id]) { if (busy) flash(row, 'shake', 400); return; }
    actorId = id;
    for (const [k, t] of Object.entries(tabs)) { t.el.classList.toggle('on', k === id); t.el.setAttribute('aria-selected', String(k === id)); }
    paintTable();
    renderChat();
    input.placeholder = `Say something to ${actorFirst()}...`;
    tabs[id]?.el.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------------- the invoice card (tool-call review interrupt) */
  function reviewToolCall(payload) {
    const reqs = P.hitlRequests(payload);
    return new Promise((resolve) => {
      const choices = reqs.map(() => ({ type: 'approve' }));
      const mode = reqs.map(() => 'view'); // view | edit | reject
      const card = h('div', { class: 'gr-invoice v-paper' });
      const funds_ = ctx.tour?.funds;
      const paint = () => {
        clear(card);
        card.append(h('div', { class: 'gr-inv-head' }, h('div', null, h('div', { class: 'kicker' }, 'Mrs. Gasket needs a signature'), h('h3', { class: 'display' }, reqs.length > 1 ? `${reqs.length} requests await your approval` : 'A request awaits your approval')), h('div', { class: 'gr-stamp' }, 'Invoice')));
        reqs.forEach((r, i) => {
          const cost = P.propCost(r, 1);
          const ed = mode[i] === 'edit';
          const rej = mode[i] === 'reject';
          // editing the prop changes its price (set by the name, server-side), so don't show a stale number for the new one
          const repriced = ed || (choices[i].type === 'edit' && choices[i].args && choices[i].args.prop !== r.args?.prop); // while editing, any number shown would be stale
          const argEntries = Object.entries(choices[i].type === 'edit' && choices[i].args ? choices[i].args : r.args);
          const fields = h('div', { class: 'gr-inv-args' }, argEntries.filter(([k]) => !['cost', 'price', 'funds'].includes(k)).map(([k, v]) => {
            if (!ed || typeof v === 'object') return h('div', { class: 'gr-arg' }, h('span', null, P.humanize(k)), h('b', null, typeof v === 'string' ? v : JSON.stringify(v)));
            const inp = h('input', { class: 'gr-arg-input', type: 'text', value: String(v), 'aria-label': P.humanize(k), oninput: () => { choices[i] = { type: 'edit', args: { ...(choices[i].args || r.args), [k]: inp.value } }; } });
            return h('label', { class: 'gr-arg' }, h('span', null, P.humanize(k)), inp);
          }));
          const reason = rej ? h('input', { class: 'gr-arg-input', type: 'text', placeholder: 'Reason (optional): "Too dear"', 'aria-label': 'Reason for rejecting', oninput: (e) => { choices[i] = { type: 'reject', message: e.target.value.trim() || undefined }; } }) : null;
          const allowed = (a) => r.allowed.includes(a);
          card.append(h('div', { class: ['gr-inv-line', ed && 'editing', rej && 'rejecting'] },
            h('div', { class: 'gr-inv-t' }, icon('tool'), h('b', { class: 'display' }, TOOL_BLURB[r.name] || P.humanize(r.name)), h('code', null, r.name)),
            r.description ? h('p', { class: 'hand gr-inv-d' }, r.description) : null,
            fields, reason,
            r.name === 'fetch_prop' ? h('div', { class: 'gr-inv-cost' }, tag(repriced ? 'Mrs. Gasket prices the new prop when you sign' : `Costs ${cost} fund${cost === 1 ? '' : 's'}`, { tone: 'crimson', ic: 'coin' }), funds_ != null ? h('span', { class: 'tiny muted' }, repriced ? `You have ${funds_}.` : `You have ${funds_}. ${funds_ - cost < 0 ? 'Mrs. Gasket accepts IOUs.' : ''}`) : null) : null,
            h('div', { class: 'gr-inv-btns' },
              vbtn(ed ? 'Approve with changes' : 'Approve', { variant: 'gold', icon: 'check', disabled: !allowed('approve'), onclick: () => { if (!ed) choices[i] = { type: 'approve' }; decide(i); } }),
              allowed('edit') ? vbtn(ed ? 'Stop editing' : 'Edit', { variant: 'paper', icon: 'edit', onclick: () => { mode[i] = ed ? 'view' : 'edit'; choices[i] = ed ? { type: 'approve' } : { type: 'edit', args: { ...r.args } }; paint(); } }) : null,
              allowed('reject') ? vbtn(rej ? 'Confirm rejection' : 'Reject', { variant: 'danger', icon: 'x', onclick: () => { if (!rej) { mode[i] = 'reject'; choices[i] = { type: 'reject' }; paint(); } else decide(i); } }) : null)));
        });
      };
      const done = new Set();
      const decide = (i) => {
        done.add(i);
        if (done.size < reqs.length) { card.querySelectorAll('.gr-inv-line')[i]?.classList.add('signed'); return; }
        card.classList.add('signed');
        const out = P.hitlDecisions(reqs, choices);
        life.later(() => card.remove(), 1200);
        const sum = out.decisions.map((d) => d.type).join(', ');
        (chats[actorId] ||= []).push({ role: 'note', text: `You signed: ${sum}.` });
        list.appendChild(h('div', { class: 'gr-note hand' }, `You signed: ${sum}.`));
        resolve(out);
      };
      paint();
      list.appendChild(card);
      play(card, [{ transform: 'translateY(18px) rotate(-1.5deg) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480 }, life);
      sticky.pin();
    });
  }

  /* ---------------------------------------------------------------- sending a message = one run */
  let liveEl = null;
  let liveText = '';
  function onToken(t) {
    if (!liveEl || /tool/i.test(String(t?.node || ''))) return;
    liveText += t.text ?? '';
    liveEl.textContent = liveText;
    sticky.follow();
    paintTalking(true);
  }
  let talkTimer = null;
  function paintTalking(on) {
    const f = bigFace.firstElementChild;
    if (!f) return;
    f.classList.toggle('pp-talk', on);
    clearTimeout(talkTimer);
    if (on) talkTimer = setTimeout(() => f.classList.remove('pp-talk'), 260);
  }
  life.onDispose(() => clearTimeout(talkTimer));

  const seen = new Set();
  function ingest(ev) {
    if (!ev || seen.has(ev.key)) return;
    seen.add(ev.key);
    const d = ev.data || {};
    if (ev.kind === 'greenroom.rapport') {
      const id = d.actor || actorId;
      const prev = rapport[id] ?? 0;
      rapport[id] = d.rapport;
      paintHearts(id, true);
      if (id === actorId) {
        paintRapportBig();
        flash(heartsBig, 'al-bump', 800);
        if (d.rapport > prev) { paintTable('love'); burst(heartsBig, { n: 8, spread: 60, text: '', life }); life.later(() => paintTable(), 1600); }
      }
      if (ctx.tour?.rapport) ctx.tour.rapport[id] = d.rapport;
    } else if (ev.kind === 'greenroom.tool') {
      const log = (chats[actorId] ||= []);
      // a tool call moves pending -> approved / edited / rejected / done: update its line instead of adding another
      const line = [...log].reverse().find((m) => m.role === 'tool' && m.name === d.tool && m.status === 'pending');
      if (line) { line.status = d.status; line.args = d.args ?? line.args; const fresh = bubble(line); line.el.replaceWith(fresh); line.el = fresh; }
      else { const rec = { role: 'tool', name: d.tool, args: d.args, status: d.status }; log.push(rec); rec.el = bubble(rec); list.appendChild(rec.el); play(rec.el, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 280 }, life); }
      sticky.follow();
    }
  }

  async function send(raw) {
    const text = String(raw ?? '').trim();
    if (!text || busy || life.dead) return;
    busy = true;
    form.classList.add('busy');
    sendBtn.disabled = true; input.disabled = true;
    chips.classList.add('busy');
    input.value = '';
    push({ role: 'user', text });
    const who = actorId;
    liveText = '';
    const rec = { role: 'ai', actor: who, text: '', live: true };
    (chats[who] ||= []).push(rec);
    const thinking = bubble({ ...rec, text: '' });
    thinking.querySelector('.gr-bub').classList.add('thinking');
    thinking.querySelector('.gr-bub').textContent = '';
    thinking.querySelector('.gr-bub').append(h('i'), h('i'), h('i'));
    list.appendChild(thinking);
    liveEl = thinking.querySelector('.gr-bub');
    sticky.pin();
    paintTable('neutral', true);
    try {
      const out = await ctx.runFlow({
        graph: 'greenroom_chat',
        attempt: performers.findIndex((p) => p.id === who) + 1, // a stable thread per tour + performer: the chat has memory
        input: { messages: [{ role: 'user', content: text }], tour_id: ctx.tour?.id, actor_id: who, night: ctx.tour?.night ?? 0, seed: ctx.tour?.seed ?? 0 },
        context: { tour_id: ctx.tour?.id, actor_id: who },
        signal: life.signal,
        pace: async (ev) => { if (!life.dead) { ingest(ev); await life.wait(P.paceMs(ev.kind, 1) / 2); } },
        onEvent: () => {},
        onToken,
        onInterrupt: reviewToolCall,
      });
      if (life.dead) return;
      for (const ev of out.events || []) ingest(ev);
      // the final AI message is authoritative when nothing streamed (non-streaming providers)
      if (!liveText) liveText = lastAiText(out.values?.messages) || '...';
      liveEl.classList.remove('thinking');
      liveEl.removeAttribute('data-live');
      liveEl.textContent = liveText;
      rec.text = liveText;
      rec.live = false;
      try { await ctx.refreshTour?.(); funds.textContent = String(ctx.tour?.funds ?? funds.textContent); } catch { /* ignore */ }
    } catch (err) {
      if (life.dead || isAbort(err)) return;
      console.error(err);
      liveEl.classList.remove('thinking');
      liveEl.removeAttribute('data-live');
      liveEl.textContent = '(the mirror fogs up: ' + (err?.message || 'something went wrong') + ')';
      liveEl.classList.add('err');
      rec.text = liveEl.textContent;
      rec.live = false;
    } finally {
      busy = false;
      liveEl = null;
      form.classList.remove('busy');
      chips.classList.remove('busy');
      sendBtn.disabled = false; input.disabled = false;
      paintTable();
      if (!life.dead) input.focus({ preventScroll: true });
      sticky.follow();
    }
  }

  function lastAiText(msgs) {
    if (!Array.isArray(msgs)) return '';
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m && (m.type === 'ai' || m.role === 'assistant')) {
        const c = m.content;
        if (typeof c === 'string' && c.trim()) return c;
        if (Array.isArray(c)) return c.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('').trim();
      }
    }
    return '';
  }

  S.main.append(row, h('div', { class: 'gr-grid' }, mirror, table));
  S.actions(vbtn('Back to the tour', { variant: 'ghost', icon: 'back', onclick: () => ctx.nav('tour', {}) }));
  selectActor(startActor);

  return { unmount() { life.dispose(); clear(root); } };
}
