// Stage lab: a standalone dev page for the theatre. Plays the fixture show, scrubs it, ghosts it, and pokes every effect.
//   ?seed=7&t=4200   deterministic freeze at t ms (manual fixed-step clock) for golden screenshots
//   &ghost=1 &rm=1 &speed=2 &bare=1 &autoplay=0

import { Stage } from './stage.js';
import { fixtureData, showLog, PERFORMERS, TASTES } from './fixtures.js';
import { ANIMS, EMOTIONS, REACTIONS, CUES } from './reduce.js';
import { alignCursor } from './ghost.js';

const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const seed = q.has('seed') ? Number(q.get('seed')) | 0 : 7;
const frozenAt = q.has('t') ? Number(q.get('t')) : null;
const manual = frozenAt != null;

if (q.get('bare') === '1') document.body.classList.add('bare');

const canvas = $('stage');
const data = fixtureData();
const stage = new Stage(canvas, { data, seed, reducedMotion: q.get('rm') === '1' ? true : undefined, manual });
window.stage = stage; // handy in the console

const live = showLog({ ending: 'warm' });
const ghostLog = showLog({ ending: 'knot' });
const fixtureKeys = new Set(live.map((e) => e.key));
let idx = 0, playing = false, token = 0, labN = 0;

const E = (kind, data, agent = 'lab') => ({ v: 1, kind, key: `lab-${++labN}`, agent, data });
const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1400); };

// ---- transport --------------------------------------------------------------------------------------------------------------
async function play() {
  const my = ++token;
  playing = true; syncButtons();
  while (playing && my === token && idx < live.length) {
    const ev = live[idx++];
    await stage.apply(ev);
    refresh();
  }
  if (my === token) { playing = false; syncButtons(); }
}
function pause() { playing = false; token++; syncButtons(); }
async function step() { pause(); if (idx < live.length) { const ev = live[idx++]; await stage.apply(ev); refresh(); } }
function restart() { pause(); idx = 0; stage.reset(); refresh(); }

function syncButtons() { $('play').textContent = playing ? 'Pause' : 'Play'; $('play').classList.toggle('on', playing); }

$('play').onclick = () => (playing ? pause() : play());
$('step').onclick = step;
$('restart').onclick = () => { restart(); play(); };
$('speed').onchange = (e) => { stage.speed = Number(e.target.value); };
$('ghost').onchange = (e) => stage.setGhost(e.target.checked ? ghostLog : null);
$('rm').onchange = (e) => stage.setReducedMotion(e.target.checked);
$('snd').onchange = (e) => { stage.sound = e.target.checked; if (e.target.checked) stage.apply(E('meter', { warmth: stage.getMetrics().warmth, chaos: stage.getMetrics().chaos, beat: stage.getMetrics().beat })); };

const seek = $('seek');
seek.oninput = async () => {
  pause();
  const k = Number(seek.value);
  await stage.seek(k);
  idx = stage.log.slice(0, k).filter((e) => fixtureKeys.has(e.key)).length;
  refresh(true);
};

function refresh(fromSeek) {
  const n = stage.log.length;
  seek.max = String(Math.max(1, n));
  if (!fromSeek) seek.value = String(stage.cursor);
  $('seekLbl').textContent = `${stage.cursor} / ${n}`;
  const m = stage.getMetrics();
  $('warm').value = String(Math.round(m.warmth)); $('chaos').value = String(Math.round(m.chaos));
  const who = $('who');
  const present = Object.values(stage.state.actors).filter((a) => a.present).map((a) => a.id);
  const cur = who.value;
  who.innerHTML = '';
  for (const id of (present.length ? present : ['mabel', 'reginald', 'gus'])) { const o = document.createElement('option'); o.value = id; o.textContent = id; who.appendChild(o); }
  if (present.includes(cur)) who.value = cur;
  const last = stage.log.slice(-9).map((e) => `<span class="k">${e.kind}</span> ${briefOf(e)}`).join('\n');
  $('elog').innerHTML = last;
  $('elog').scrollTop = 9999;
}
const briefOf = (e) => { const d = e.data || {}; return esc(d.actor || d.anim || d.cue || d.reaction || d.name || (d.text ? String(d.text).slice(0, 34) : '') || (d.seat != null ? '#' + d.seat : '') || ''); };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- poke buttons --------------------------------------------------------------------------------------------------------------------
function ensureStage() {
  const st = stage.state;
  const evs = [];
  if (st.curtain !== 'open') {
    evs.push(E('stage.beat', { index: Math.max(0, st.beat.index), beat: 'setup', name: 'Lab', logline: 'Poking the stage.', tags: [] }));
    if (!st.set.id) evs.push(E('stage.set', { beat: 0, set: 'parlour', sky: 'dusk', props: ['door', 'chair', 'umbrella_stand'], palette: { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' } }));
  }
  const need = [['mabel', 'lead'], ['reginald', 'villain'], ['gus', 'fool']];
  for (const [id, role] of need) if (!(st.actors[id] && st.actors[id].present)) evs.push(E('stage.enter', { actor: id, role, from: id === 'gus' ? 'trapdoor' : id === 'mabel' ? 'left' : 'right' }));
  if (!st.seats.some(Boolean)) TASTES.forEach((t, i) => evs.push(E('audience.seat', { seat: i, taste: t.id, hat: t.hat, palette: t.palette })));
  return evs;
}
async function poke(...evs) {
  pause();
  for (const e of ensureStage()) stage.apply(e);
  for (const e of evs) stage.apply(e);
  refresh();
}
const who = () => $('who').value || 'mabel';
const other = (id) => (['mabel', 'reginald', 'gus'].filter((x) => x !== id)[0]);

function mk(containerId, items, fn, cls = '') {
  const c = $(containerId);
  for (const it of items) { const b = document.createElement('button'); b.className = 'mini ' + cls; b.textContent = it; b.onclick = () => fn(it); c.appendChild(b); }
}
mk('mishaps', ANIMS, (anim) => poke(E('stage.mishap', { id: 'lab_' + anim, actor: who(), other: other(who()), kind: 'collapse', severity: 'minor', title: `${who()}: ${anim}`, text: `${who()} does the ${anim.replace('_', ' ')}. Nobody is surprised.`, anim, tags: ['slapstick'], calamity: 'the_lab', effects: { warmth: 0, chaos: 3 } })));
mk('emotions', EMOTIONS, (emotion) => poke(E('stage.line', { actor: who(), role: roleOf(who()), text: `Feeling ${emotion} is a perfectly valid way to deliver this line.`, emotion })));
mk('cues', CUES, (cue) => poke(E('stage.cue', { cue, fits: true, outcome: 'miracle', text: `The ${cue} cue lands. Madame pretends it was her idea.`, anim: cue })));
mk('reacts', REACTIONS, (reaction) => {
  const inten = Number($('inten').value);
  const evs = [];
  for (let s = 0; s < 12; s++) if (s % 2 === (reaction.length % 2)) evs.push(E('audience.react', { seat: s, reaction, intensity: inten, why: 'lab' }));
  poke(...evs);
});
const roleOf = (id) => (id === 'mabel' ? 'lead' : id === 'reginald' ? 'villain' : 'fool');

$('decision').onclick = () => poke(E('stage.decision', { mishap_id: 'x', option: 'lean_in', label: 'Yes, and...', cue: null, text: '', line: '(whispering) It is a tragedy of the angle, darling. Commit.', effects: { warmth: 3, chaos: 2 }, by: 'prompter' }));
$('chain').onclick = () => poke(E('stage.chain', { actors: ['gus', 'reginald', 'mabel'], lines: ['Gus: "The angle IS the play."', 'Reginald: "I apologise for the geometry."', 'Mabel: "I feel it in my left side."'], bonus: 4.5 }));
$('direct').onclick = () => poke(E('stage.direct', { text: 'Darling, no. Fewer arms. Much, much fewer arms.', speaker: 'madame' }));
$('beat').onclick = () => { const i = (stage.state.beat.index + 1) % 5; poke(E('stage.beat', { index: i, beat: 'x', name: ['Setup', 'Complication', 'Reversal', 'Twist', 'Finale'][i], logline: '', tags: [] }), E('stage.set', { beat: i, set: ['parlour', 'corridor', 'bedroom', 'cellar', 'moor', 'ballroom', 'graveyard', 'castle', 'garden', 'library', 'attic', 'harbour', 'stage'][(stage.state.set.n) % 13], sky: ['dusk', 'night', 'noon', 'storm', 'dawn'][(stage.state.set.n) % 5], props: ['candle', 'trunk', 'mirror'].slice(0, 2 + (stage.state.set.n % 2)), palette: { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' } })); };
$('exit').onclick = () => { const id = who(); const a = stage.state.actors[id]; if (a && a.present) poke(E('stage.exit', { actor: id, role: roleOf(id), from: 'trapdoor' })); else poke(E('stage.enter', { actor: id, role: roleOf(id), from: 'above' })); };
$('finale').onclick = () => poke(E('stage.curtain', { warmth: 74, chaos: 38, quality_avg: 66, tradition_hits: 1, knotted: false }));
$('knot').onclick = () => poke(E('meter', { warmth: 30, chaos: 95, beat: 4 }), E('stage.curtain', { warmth: 30, chaos: 95, quality_avg: 40, tradition_hits: 0, knotted: true }));
$('warm').oninput = () => { const m = stage.getMetrics(); poke(E('meter', { warmth: Number($('warm').value), chaos: m.chaos, beat: m.beat })); };
$('chaos').oninput = () => { const m = stage.getMetrics(); poke(E('meter', { warmth: m.warmth, chaos: Number($('chaos').value), beat: m.beat })); };

// cast gallery
const CASTS = {
  'A: Mabel Reginald Gus Goose Hortensia': ['mabel', 'reginald', 'gus', 'goose', 'hortensia'],
  'B: Bartleby Poppet Tock Mabel Gus': ['bartleby', 'poppet', 'tock', 'mabel', 'gus'],
  'C: Hortensia Tock Goose Poppet Reginald': ['hortensia', 'tock', 'goose', 'poppet', 'reginald'],
};
mk('casts', Object.keys(CASTS), async (k) => {
  pause(); stage.reset(); idx = 0;
  const ids = CASTS[k];
  const roles = ['lead', 'villain', 'fool', 'understudy', 'extra'];
  const evs = [E('stage.beat', { index: 0, beat: 'setup', name: 'Cast', logline: '', tags: [] }), E('stage.set', { beat: 0, set: 'ballroom', sky: 'night', props: ['harp', 'cake'], palette: { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' } })];
  ids.forEach((id, i) => evs.push(E('stage.enter', { actor: id, role: roles[i], from: i % 2 ? 'right' : 'left' })));
  TASTES.forEach((t, i) => evs.push(E('audience.seat', { seat: i, taste: t.id, hat: t.hat, palette: t.palette })));
  const sp = stage.speed; stage.speed = 0; for (const e of evs) await stage.apply(e); stage.speed = sp;
  refresh();
});

stage.on('actor', (id) => toast('clicked puppet: ' + id));
stage.on('seat', (i) => toast('clicked seat #' + i + ' (' + (TASTES[i] ? TASTES[i].name : '') + ')'));

// ---- stats ----------------------------------------------------------------------------------------------------------------------------------
function p95(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)]; }
setInterval(() => {
  const p = stage.perf;
  $('stats').innerHTML = `frame <b>${p.avg.toFixed(2)}</b> ms avg &middot; p95 <b>${p95(p.samples).toFixed(2)}</b> &middot; max <b>${p.max.toFixed(1)}</b> &middot; t <b>${(stage.simTime / 1000).toFixed(1)}</b> s &middot; dpr ${stage.dpr} &middot; ${stage.cw}x${stage.ch}`;
}, 400);

// ---- boot ------------------------------------------------------------------------------------------------------------------------------------------
if (q.has('speed')) { stage.speed = Number(q.get('speed')); $('speed').value = q.get('speed'); }
if (q.get('ghost') === '1') { $('ghost').checked = true; stage.setGhost(ghostLog); }
if (q.get('rm') === '1') $('rm').checked = true;
if (q.get('sound') === '1') $('snd').checked = true;

const flush = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

async function runFrozen(T) {
  idx = 0;
  const player = q.has('empty') ? null : (async () => { while (idx < live.length) await stage.apply(live[idx++]); })();
  while (stage.simTime < T) { stage.advance(1000 / 60); await flush(); }
  stage.renderNow();
  refresh();
  window.__stageReady = true;
  document.title += ` [frozen @${Math.round(stage.simTime)}ms seed=${seed}]`;
  void player;
}

// console / automation helpers: drive the deterministic clock by hand
window.lab = {
  E, ensureStage, poke, live, ghostLog,
  go: async (ms) => { for (let t = 0; t < ms; t += 1000 / 60) { stage.advance(1000 / 60); await flush(); } stage.renderNow(); refresh(); },
};

refresh();
if (manual) runFrozen(frozenAt);
else if (q.get('autoplay') !== '0') setTimeout(play, 350);
