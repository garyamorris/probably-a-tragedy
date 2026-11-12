// TextStage: a DOM "paper theatre" used when js/stage/stage.js is missing or throws. Same interface as the canvas Stage
// (docs/PROTOCOL.md 7.2): apply(ev), token(actor, text), speed, reset(), log, seek(k), setGhost(), getMetrics(), on(), resize(), destroy().
// Three paper puppets on a row, a speech bubble, a house of twelve emoji seats and a mishap banner: enough to follow the show.

import { h } from './dom.js';
import { puppetAvatar } from './glyphs.js';

const REACT = { laugh: '😄', gasp: '😮', cry: '😢', boo: '😠', yawn: '🥱', applaud: '👏' };
const first = (n) => String(n || '').replace(/^(Sir|Mr\.|Mrs\.|Captain|The)\s+/, '').split(' ')[0];

export class TextStage {
  constructor(container, { data = {}, seed = 0, reducedMotion = false } = {}) {
    this.data = data;
    this.seed = seed;
    this.reducedMotion = reducedMotion;
    this.speed = 1;
    this.log = [];
    this.metrics = { warmth: 50, chaos: 10, beat: 0, speaker: null };
    this.handlers = { actor: [], seat: [] };
    this.ghost = null;
    this.people = new Map([...(data.performers || []), ...(data.staff || [])].map((p) => [p.id, p]));
    this.seats = Array.from({ length: 12 }, () => h('span', { class: 'ts-seat' }, '😐'));
    this.slots = { lead: h('div', { class: 'ts-slot' }), villain: h('div', { class: 'ts-slot' }), fool: h('div', { class: 'ts-slot' }) };
    this.bubble = h('div', { class: 'ts-bubble', 'aria-hidden': 'true' });
    this.banner = h('div', { class: 'ts-banner', hidden: true });
    this.scene = h('div', { class: 'ts-scene hand' }, 'The house lights are down.');
    this.cast = h('div', { class: 'ts-cast' }, this.slots.lead, this.slots.villain, this.slots.fool);
    this.house = h('div', { class: 'ts-house', 'aria-hidden': 'true' }, ...this.seats);
    this.root = h('div', { class: 'ts', 'data-kind': 'text' }, this.scene, this.bubble, this.cast, this.banner, this.house);
    container.append(this.root);
    this.slotOf = {};
  }

  on(name, fn) {
    (this.handlers[name] ||= []).push(fn);
    return () => (this.handlers[name] = this.handlers[name].filter((f) => f !== fn));
  }

  async _wait(ms) {
    if (this.speed === 0 || this.reducedMotion) return;
    await new Promise((r) => setTimeout(r, ms / this.speed));
  }

  _place(actor, role) {
    const slot = this.slots[role] || this.slots.lead;
    const p = this.people.get(actor) || { id: actor, name: actor };
    slot.replaceChildren(puppetAvatar(p, { size: 72 }), h('div', { class: 'ts-name small' }, first(p.name)));
    slot.dataset.actor = actor;
    slot.onclick = () => this.handlers.actor.forEach((f) => f(actor));
    this.slotOf[actor] = slot;
  }

  _speaker(actor) {
    this.metrics.speaker = actor;
    for (const s of Object.values(this.slots)) s.classList.toggle('speaking', s.dataset.actor === actor);
  }

  async apply(ev) {
    this.log.push(ev);
    return this._apply(ev);
  }

  async _apply(ev) {
    const d = ev.data || {};
    switch (ev.kind) {
      case 'audience.seat':
        break;
      case 'stage.beat':
        this.metrics.beat = d.index;
        this.scene.textContent = `${d.name || d.beat}: ${d.logline || ''}`;
        await this._wait(700);
        break;
      case 'stage.set':
        this.root.dataset.set = d.set || '';
        this.root.style.setProperty('--ts-sky', d.palette?.sky || '#6a4575');
        this.root.style.setProperty('--ts-flat', d.palette?.flat || '#3a2142');
        break;
      case 'stage.enter':
        this._place(d.actor, d.role);
        await this._wait(250);
        break;
      case 'stage.direct':
        this._speaker('madame');
        this.bubble.textContent = `Madame: ${d.text}`;
        await this._wait(Math.min(2400, 600 + String(d.text || '').length * 24));
        break;
      case 'stage.line':
        if (!this.slotOf[d.actor]) this._place(d.actor, d.role);
        this._speaker(d.actor);
        this.bubble.textContent = `${first(this.people.get(d.actor)?.name || d.actor)}: ${d.text}`;
        await this._wait(Math.min(3200, 700 + String(d.text || '').length * 32));
        break;
      case 'stage.mishap':
        this.banner.hidden = false;
        this.banner.className = `ts-banner ${d.severity}`;
        this.banner.textContent = `${d.title}. ${d.text}`;
        this.root.classList.toggle('knotted', d.severity === 'major');
        await this._wait(1500);
        break;
      case 'stage.decision':
        this._speaker('madame');
        this.bubble.textContent = d.line ? d.line : `(${d.label})`;
        this.banner.className = 'ts-banner ok';
        this.banner.textContent = `${d.by === 'prompter' ? 'You whispered' : 'Madame handled it'}: ${d.label}`;
        await this._wait(1300);
        break;
      case 'stage.cue':
        this.banner.className = `ts-banner ${d.outcome === 'miracle' ? 'ok' : 'minor'}`;
        this.banner.textContent = d.text;
        await this._wait(1200);
        break;
      case 'stage.chain':
        this.banner.className = 'ts-banner ok';
        this.banner.textContent = `Yes, and... ${d.actors.map((a) => first(this.people.get(a)?.name || a)).join(' and ')} join in (+${d.bonus})`;
        await this._wait(1100);
        break;
      case 'audience.react': {
        const s = this.seats[d.seat];
        if (s) {
          s.textContent = REACT[d.reaction] || '😐';
          s.classList.remove('pop');
          void s.offsetWidth;
          s.classList.add('pop');
        }
        await this._wait(60);
        break;
      }
      case 'audience.tally':
        await this._wait(500);
        this.banner.hidden = true;
        break;
      case 'meter':
        this.metrics.warmth = d.warmth;
        this.metrics.chaos = d.chaos;
        break;
      case 'stage.curtain':
        this.metrics.warmth = d.warmth;
        this.metrics.chaos = d.chaos;
        this.bubble.textContent = 'The curtain falls.';
        this.banner.hidden = false;
        this.banner.className = 'ts-banner ok';
        this.banner.textContent = d.knotted ? 'The strings are in a knot. Bows anyway.' : 'The strings held. Mostly.';
        await this._wait(900);
        break;
      default:
        break;
    }
  }

  token(actor) {
    if (!actor) return;
    const s = this.slotOf[actor];
    if (!s) return;
    s.classList.remove('flap');
    void s.offsetWidth;
    s.classList.add('flap');
  }

  reset() {
    this.log = [];
    this.metrics = { warmth: 50, chaos: 10, beat: 0, speaker: null };
    this.slotOf = {};
    for (const s of Object.values(this.slots)) {
      s.replaceChildren();
      delete s.dataset.actor;
    }
    this.seats.forEach((s) => (s.textContent = '😐'));
    this.bubble.textContent = '';
    this.banner.hidden = true;
    this.root.classList.remove('knotted');
  }

  async seek(k) {
    const events = this.log.slice(0, k);
    const sp = this.speed;
    this.reset();
    this.speed = 0;
    for (const ev of events) await this.apply(ev);
    this.speed = sp;
  }

  setGhost(events) {
    this.ghost = events;
    this.root.classList.toggle('has-ghost', !!events);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resize() {}

  destroy() {
    this.root.remove();
  }
}
