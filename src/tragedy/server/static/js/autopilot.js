// autopilot.js: lets the stagehands play a flow step for you with sensible defaults. Used by the "this curtain is
// still being painted" placeholder (so the flow stays navigable while views are being written) and handy in demos.
//
//   const {next, carry} = await autopilotStep('casting', ctx, {signal, onEvent})
//
// Each step runs the real graph through runFlow (so the Prompt Book, mock and server all behave normally) and answers
// every interrupt with the obvious choice.

import { runFlow } from './run.js';
import { api } from './api.js';

export const AUTOPILOT_VIEWS = ['casting', 'writers', 'rehearsal', 'reviews', 'almanac', 'playbill', 'road'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function nextTownId(tour, night = tour?.night ?? 0) {
  return tour?.towns?.[night + 1] ?? null;
}

/** Pure: which graph + input + interrupt answers + outputs does this view use? */
export function stepPlan(view, ctx) {
  const tour = ctx.tour;
  const p = ctx.params || {};
  const base = ctx.inputBase();
  switch (view) {
    case 'casting':
      return {
        graph: 'casting_call',
        input: base,
        answer: (pl) => (pl.kind === 'confirm_cast' ? { cast: pl.proposed } : {}),
        carry: (out) => ({ cast: out.values?.cast ?? out.interrupts.find((i) => i.kind === 'confirm_cast')?.proposed }),
        next: 'writers',
      };
    case 'writers':
      return {
        graph: 'writers_room',
        input: { ...base, cast: p.cast, traditions: (tour?.traditions || []).map((t) => t.calamity) },
        answer: (pl) => {
          if (pl.kind !== 'pick_draft') return {};
          const best = [...(pl.drafts || [])].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
          return { draft_id: best?.draft_id };
        },
        carry: (out) => ({ script: out.values?.script }),
        next: 'show',
      };
    case 'rehearsal':
      return {
        graph: 'rehearsal',
        pre: async () => {
          try {
            await api.candle(tour.id);
          } catch {
            /* no candle left: rehearse anyway if the server allows it */
          }
        },
        input: { ...base, cast: p.cast, script: p.script, samples: 12 },
        answer: () => ({}),
        carry: (out) => ({ rehearsal: out.values?.summary }),
        next: 'show',
      };
    case 'reviews':
      return {
        graph: 'reviews',
        input: { ...base, cast: p.cast, script: p.script, result: p.result },
        answer: () => ({}),
        carry: (out) => ({ stars: out.values?.stars, funds_delta: out.values?.funds_delta, headline: out.values?.headline, reviews: out.values?.reviews }),
        next: 'almanac',
      };
    case 'almanac':
      return {
        graph: 'almanac',
        input: { ...base, result: p.result, next_town: nextTownId(tour) },
        answer: (pl) => (pl.kind === 'curate_traditions' ? { enshrine: (pl.candidates || []).slice(0, pl.max ?? 2).map((c) => c.calamity) } : {}),
        carry: (out) => ({ traditions: out.values?.traditions, recalled: out.values?.recalled }),
        next: 'playbill',
      };
    case 'playbill':
      return {
        graph: 'playbill_press',
        input: { ...base, cast: p.cast, script: p.script, stars: p.stars, headline: p.headline, traditions: p.traditions || tour?.traditions || [] },
        answer: () => ({}),
        carry: (out) => ({ playbill: out.values?.playbill }),
        next: 'road',
      };
    case 'road':
      return {
        graph: 'the_road',
        input: { tour_id: tour?.id, night: tour?.night ?? 0, seed: tour?.seed, from_town: tour?.towns?.[tour?.night ?? 0], to_town: nextTownId(tour) },
        answer: (pl) => (pl.kind === 'crossroads' ? { choice: pl.choices?.[0]?.id } : {}),
        carry: () => ({}),
        next: 'tour',
        after: async () => {
          await ctx.refreshTour();
        },
      };
    default:
      return null;
  }
}

export async function autopilotStep(view, ctx, { signal, onEvent, onNote } = {}) {
  const plan = stepPlan(view, ctx);
  if (!plan) throw new Error(`The stagehands do not know how to do "${view}" yet.`);
  if (plan.pre) await plan.pre();
  const out = await runFlow({
    graph: plan.graph,
    input: plan.input,
    signal,
    pace: async (ev) => {
      onEvent?.(ev);
      await sleep(70);
    },
    onToken: ({ text }) => onNote?.(text),
    onInterrupt: async (payload) => {
      await sleep(350);
      return plan.answer(payload);
    },
  });
  const carry = plan.carry(out);
  if (plan.after) await plan.after();
  return { next: plan.next, carry, out };
}
