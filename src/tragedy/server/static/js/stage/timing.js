// How long (ms at speed 1) each event's visuals take. Pure: shared by the Stage and the tests.

import { clamp } from './layout.js';

const len = (s) => (typeof s === 'string' ? s.length : 0);

export function lineDuration(text) { return clamp(700 + len(text) * 42, 1500, 6500); }

export function eventDuration(ev) {
  if (!ev || typeof ev.kind !== 'string') return 0;
  const d = ev.data || {};
  switch (ev.kind) {
    case 'stage.beat': return d.index === 0 ? 2600 : 1600;
    case 'stage.set': return 1500;
    case 'stage.enter': return 950;
    case 'stage.exit': return 800;
    case 'stage.direct': return clamp(1300 + len(d.text) * 26, 1900, 4600);
    case 'stage.line': return lineDuration(d.text);
    case 'stage.mishap': return clamp(1800 + len(d.text) * 14, 2400, 4200);
    case 'stage.decision': return clamp(1700 + len(d.line || d.text) * 16, 2000, 4400);
    case 'stage.cue': return 2100;
    case 'stage.chain': return 600 + 900 * Math.max(1, (d.actors || []).length);
    case 'stage.curtain': return d.knotted ? 5200 : 3200;
    case 'audience.seat': return 90;
    case 'audience.react': return 160;
    case 'audience.tally': return 800;
    case 'meter': return 600;
    default: return 0;
  }
}

/** Duration of one mishap clip (ms at speed 1) and the fraction at which it may "hold" for the Prompter. */
export const CLIP = {
  lean_left: { dur: 2300, hold: 0.42 },
  collapse: { dur: 2300, hold: 0.4 },
  spin: { dur: 1700 },
  wobble: { dur: 2000 },
  hide: { dur: 2500, hold: 0.45 },
  fly: { dur: 2200 },
  freeze: { dur: 2400, hold: 0.35 },
  shake: { dur: 1800 },
  flip: { dur: 1600 },
  slide: { dur: 1800 },
  bow: { dur: 2200, hold: 0.45 },
  drop_prop: { dur: 1900 },
};
