// title: the animated curtain-rise title card. New Tour (optional seed, daily seed) / Continue Tour.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as ui from '../ui.js';
import { puppetLabel } from './_kit/pure.js';

const LETTERS = (word, start) => [...word].map((ch, i) => h('span', { class: 'tl', style: { '--i': start + i, '--r': `${((ui.hash32(word + i) % 9) - 4) * 0.9}deg` } }, ch));

/** YYYYMMDD in UTC as an integer: everyone gets the same "daily" tour. */
export function dailySeed(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export async function mount(root, ctx) {
  const seedInput = ui.input({ type: 'text', inputmode: 'numeric', pattern: '[0-9]*', placeholder: 'Seed (optional)', 'aria-label': 'Tour seed', maxlength: 12 });
  const today = dailySeed();
  const dailyBtn = ui.button('Daily seed', { size: 'sm', variant: 'paper', icon: 'sun', title: `Today's seed is ${today}: everyone playing today gets the same tour`, onclick: () => (seedInput.value = String(today)) });
  const tour = ctx.tour;
  const active = tour && tour.status === 'active';

  const begin = async () => {
    const raw = seedInput.value.trim();
    if (raw && !/^\d{1,12}$/.test(raw)) return ui.toast({ title: 'Seeds are whole numbers', body: 'Try 7, or press Daily seed.', tone: 'accent' });
    if (tour && active) {
      const ok = await ui.confirmDialog({ title: 'Abandon the current tour?', body: `The ${ctx.data.town?.(tour.towns?.[0])?.name?.split(/[-\s]/)[0] || 'current'} tour is on night ${(tour.night ?? 0) + 1}. A new tour leaves it behind in the wagon.`, confirm: 'New tour', cancel: 'Keep going', tone: 'primary' });
      if (!ok) return;
    }
    newBtn.disabled = true;
    newBtn.classList.add('busy');
    try {
      await ctx.startTour(raw || undefined);
      ctx.nav('tour');
    } catch (e) {
      ui.toast({ title: 'The curtain stuck', body: e.message, tone: 'danger' });
    } finally {
      newBtn.disabled = false;
      newBtn.classList.remove('busy');
    }
  };
  const newBtn = ui.button('New Tour', { variant: 'primary', size: 'lg', icon: 'sparkle', onclick: begin });

  const stats = tour
    ? h(
        'div',
        { class: 'continue-card' },
        h('div', { class: 'kicker' }, active ? 'Your tour is waiting' : 'Your tour is over'),
        h('div', { class: 'display continue-name' }, `The ${(ctx.data.town?.(tour.towns?.[0])?.name || 'Wibbling').split(/[-\s]/)[0]} Tour`),
        h('div', { class: 'small muted' }, active ? `Night ${Math.min(5, (tour.night ?? 0) + 1)} of 5 · seed ${tour.seed} · ` : `Seed ${tour.seed} · `, h('span', { class: 'mono' }, `${ui.fmt.formatNumber((tour.history || []).reduce((a, n) => a + n.stars, 0), 1)} / 15 stars`)),
      )
    : null;
  const contBtn = tour ? ui.button(active ? 'Continue Tour' : 'See how it ended', { variant: 'gold', size: 'lg', icon: 'wagon', onclick: () => ctx.nav('tour') }) : null;

  const steps = [
    ['users', 'Cast the Players', 'Auditions, and Madame\'s opinions.'],
    ['quill', 'Choose a play', 'Three herons, three drafts, one pick.'],
    ['ear', 'Whisper from the box', 'When the stage freezes, you speak.'],
    ['star', 'Chase fifteen stars', 'Five towns. Five nights. Pigeon critics.'],
  ];

  const offline = !ctx.boot;
  const view = h(
    'div',
    { class: 'title-view' },
    h(
      'section',
      { class: 'title-stage', 'aria-label': 'Probably a Tragedy' },
      h('div', { class: 'curtain curtain-l', 'aria-hidden': 'true' }),
      h('div', { class: 'curtain curtain-r', 'aria-hidden': 'true' }),
      h('div', { class: 'valance', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'marquee' },
        h('span', { class: 'bulbs bulbs-t', 'aria-hidden': 'true' }),
        h('span', { class: 'bulbs bulbs-b', 'aria-hidden': 'true' }),
        h('span', { class: 'bulbs bulbs-l', 'aria-hidden': 'true' }),
        h('span', { class: 'bulbs bulbs-r', 'aria-hidden': 'true' }),
        h('h1', { class: 'marquee-title', 'aria-label': 'Probably a Tragedy' }, h('span', { class: 'mt-line mt-1', 'aria-hidden': 'true' }, ...LETTERS('PROBABLY', 0)), h('span', { class: 'mt-a hand', 'aria-hidden': 'true' }, 'a'), h('span', { class: 'mt-line mt-2', 'aria-hidden': 'true' }, ...LETTERS('TRAGEDY', 9))),
      ),
      h('p', { class: 'title-sub hand' }, 'You are the Prompter, hidden in the box at the foot of a toy theatre. The Wibbling Players cannot be trusted.'),
      h(
        'div',
        { class: 'title-actions' },
        stats && h('div', { class: 'continue-wrap' }, stats, contBtn),
        h(
          'div',
          { class: ['new-wrap', 'paper', tour && 'has-continue'] },
          h('div', { class: 'kicker' }, tour ? 'Or begin again' : 'Begin'),
          h('div', { class: 'row gap-2 wrap new-seed' }, h('div', { class: 'grow seed-box' }, seedInput), dailyBtn),
          newBtn,
          h('p', { class: 'small muted seed-note' }, 'The same seed gives the same towns. Share it, and compare your disasters.'),
        ),
      ),
      offline &&
        h(
          'div',
          { class: 'title-offline paper tilt-r' },
          icon('alert', 'lg'),
          h('div', null, h('strong', null, 'The theatre is dark.'), h('div', { class: 'small' }, 'No server answered. You can still play with the offline puppets (nothing leaves this page).')),
          ui.button('Open the demo', { href: `${location.pathname}?mock=1`, variant: 'gold', size: 'sm', icon: 'play' }),
        ),
    ),
    h(
      'section',
      { class: 'title-steps reveal', 'aria-label': 'How a night goes' },
      ...steps.map(([ic, t, s], i) => h('div', { class: 'step-card paper', style: { '--i': i, '--tilt': `${(i % 2 ? 1 : -1) * (0.6 + i * 0.25)}deg` } }, h('span', { class: 'step-num' }, i + 1), icon(ic, 'lg'), h('div', { class: 'display step-t' }, t), h('div', { class: 'small muted' }, s))),
    ),
    h(
      'footer',
      { class: 'title-foot small muted' },
      h('span', null, puppetLabel(ctx.boot)),
      h('span', { 'aria-hidden': 'true' }, '·'),
      h('a', { href: '#/datasets' }, 'The Props Cupboard'),
    ),
  );
  root.append(view);

  // curtains rise on the next frames (instantly under reduced motion)
  const stage = view.querySelector('.title-stage');
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('open')));
  const t = setTimeout(() => (contBtn || newBtn).focus({ preventScroll: true }), ui.prefersReducedMotion() ? 0 : 1600);
  return {
    unmount() {
      clearTimeout(t);
    },
  };
}
