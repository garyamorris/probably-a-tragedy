// Ghost timeline helpers (pure). A "ghost" is the alternate timeline reduced by the same reducer; we align it to the
// live show by (beat index, events since that beat began) so the two stay comparable while their logs diverge.

import { reduceAll } from './reduce.js';

/** For each event: [beatIndex, offsetWithinBeat]. Events before the first stage.beat have beatIndex -1. */
export function beatOffsets(events) {
  const out = [];
  let b = -1, o = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev && ev.kind === 'stage.beat') { b = (ev.data && ev.data.index) | 0; o = 0; } else o++;
    out.push([b, o]);
  }
  return out;
}

/** How many ghost events to replay so the ghost sits at the same dramatic moment as `live`. */
export function alignCursor(ghostEvents, live, offsets) {
  const offs = offsets || beatOffsets(ghostEvents);
  const lb = live.beat.index, lo = live.sb;
  let cur = 0;
  for (let i = 0; i < offs.length; i++) {
    const [b, o] = offs[i];
    if (b < lb || (b === lb && o <= lo)) cur = i + 1;
    else if (b > lb) break;
  }
  return cur;
}

/** Ghost state aligned to the live state. */
export function ghostStateAt(ghostEvents, live, offsets) {
  return reduceAll(ghostEvents.slice(0, alignCursor(ghostEvents, live, offsets)));
}

/** Where do the two timelines disagree? Used to pulse diverging puppets/props coral on the ghost. */
export function ghostDiff(live, ghost) {
  const actors = [];
  const ids = new Set([...Object.keys(live.actors), ...Object.keys(ghost.actors)]);
  for (const id of ids) {
    const a = live.actors[id], g = ghost.actors[id];
    const ap = !!(a && a.present), gp = !!(g && g.present);
    if (ap !== gp) { actors.push(id); continue; }
    if (!ap) continue;
    const aa = a.anim ? a.anim.name : null, ga = g.anim ? g.anim.name : null;
    if (a.slot !== g.slot || a.emotion !== g.emotion || aa !== ga) actors.push(id);
  }
  const props = [];
  const lp = new Map(live.propsOn.map((p) => [p.id, p]));
  const gp2 = new Map(ghost.propsOn.map((p) => [p.id, p]));
  for (const id of new Set([...lp.keys(), ...gp2.keys()])) {
    const a = lp.get(id), g = gp2.get(id);
    if (!a || !g || a.status !== g.status) props.push(id);
  }
  const seats = [];
  for (let i = 0; i < live.seats.length; i++) {
    const a = live.seats[i] && live.seats[i].react, g = ghost.seats[i] && ghost.seats[i].react;
    if ((a ? a.reaction : null) !== (g ? g.reaction : null)) seats.push(i);
  }
  return {
    actors,
    props,
    seats,
    warmth: ghost.meters.warmth - live.meters.warmth,
    chaos: ghost.meters.chaos - live.meters.chaos,
    diverged: actors.length > 0 || props.length > 0 || Math.abs(ghost.meters.warmth - live.meters.warmth) > 0.5,
  };
}
