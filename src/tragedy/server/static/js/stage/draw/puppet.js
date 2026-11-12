// A procedural marionette: spec from performers.json `build` + `palette`, pose maths, string attachment points,
// and the drawing orchestration (contact shadow, drop shadow, hover glow, body, overlays).

import { c, shade, mix, rgba, setTint, getTint } from '../color.js';
import { hashInt, hash01, pick } from '../rng.js';
import { clamp } from '../layout.js';
import { drawHead, HEAD_TOP } from './heads.js';
import { drawLower, drawTorso, drawArm, armPoints } from './costumes.js';
import { paper, rr, ell, circle, rgrad, strokeOnly, fillOnly, vgrad } from './shapes.js';

export const BASE_H = 240;
const HEAD_R = { round: 0.145, long: 0.125, square: 0.135, beak: 0.135, sock: 0.118, nutcracker: 0.104, tin: 0.125, shadow: 0.135 };
const HEAD_BOT = { round: 1.03, long: 1.34, square: 0.86, beak: 1.0, sock: 0.95, nutcracker: 1.12, tin: 0.81, shadow: 1.02 };
const HEADS = Object.keys(HEAD_R);
const COSTUMES = ['gown', 'coat', 'frock', 'uniform', 'rags', 'armour', 'robe', 'wig'];
const SKINS = ['#f3d9b8', '#ecc9a0', '#e8bf94', '#f6dfc4', '#e3b48a'];
const PALETTES = [['#c0566e', '#f2c14e', '#3b2a3a'], ['#3d405b', '#e07a5f', '#1d1d1d'], ['#4fb3a5', '#e9b949', '#2a1630'], ['#b8a1e3', '#f6ecd6', '#4d2e58'], ['#e0a82e', '#7d1527', '#241a26']];

const SKIN_FOR = { sock: null, tin: null, shadow: null, beak: null, nutcracker: '#efd2b0' };

const armMul = (a) => (a === 'long' ? 1.22 : a === 'short' ? 0.8 : a === 'stubby' ? 0.7 : a === 'noodle' ? 1.35 : 1);

/** Turn a performers.json / staff.json record (or just an id) into a drawable spec. Unknown ids get a deterministic look. */
export function buildSpec(rec) {
  const id = (rec && rec.id) || 'extra';
  const b = (rec && rec.build) || {};
  const pal0 = (rec && rec.palette) || {};
  const pp = PALETTES[hashInt(PALETTES.length, 'pal', id)];
  const pal = { body: pal0.body || pp[0], accent: pal0.accent || pp[1], hair: pal0.hair || pp[2] };
  const head = HEAD_R[b.head] ? b.head : pick(HEADS, 'head', id);
  const costume = COSTUMES.includes(b.costume) ? b.costume : pick(COSTUMES, 'costume', id);
  const height = clamp(typeof b.height === 'number' ? b.height : 0.9 + hash01('h', id) * 0.3, 0.55, 1.4);
  const strings = clamp(b.strings | 0 || 5, 3, 7);
  const skin = SKIN_FOR[head] || pick(SKINS, 'skin', id);
  const H = BASE_H * height;
  const hr = H * HEAD_R[head];
  const shoulderY = -0.6 * H;
  const am = armMul(b.arms);
  const headY = shoulderY - 0.015 * H - hr * HEAD_BOT[head];
  const geo = {
    H, headR: hr, shoulderY, hipY: -0.34 * H, shoulderX: 0.15 * H, headY,
    armL1: 0.155 * H * am, armL2: 0.15 * H * am, armW: 0.062 * H,
    topY: headY - hr * HEAD_TOP[head],
  };
  return {
    id, name: (rec && rec.name) || id, head, costume, height, strings, pal, skin,
    handColor: head === 'sock' ? pal.body : head === 'tin' || costume === 'armour' ? '#cdd6de' : head === 'shadow' ? '#2a2036' : skin,
    kind: (rec && rec.kind) || 'marionette',
    geo,
  };
}

// ---- string attachment ---------------------------------------------------------------------------------------------------
const ATTACH = {
  3: ['head', 'handL', 'handR'],
  4: ['head', 'handL', 'handR', 'back'],
  5: ['head', 'handL', 'handR', 'kneeL', 'kneeR'],
  6: ['head', 'shoulderL', 'shoulderR', 'handL', 'handR', 'back'],
  7: ['head', 'shoulderL', 'shoulderR', 'handL', 'handR', 'kneeL', 'kneeR'],
};
/** Where each string ties to the control bar: [fraction of half-bar width, y offset (second, lower bar)]. */
const BAR_TIE = { head: [0, 0], shoulderL: [-0.32, 0], shoulderR: [0.32, 0], handL: [-1, 0], handR: [1, 0], kneeL: [-0.55, 9], kneeR: [0.55, 9], back: [0.14, 9] };
export const BAR_HALF = 64;

export function attachNames(sp) { return ATTACH[sp.strings] || ATTACH[5]; }
export function barTie(name) { return BAR_TIE[name]; }

function upper(pv, g, lx, ly) {
  let dx = lx, dy = (ly - g.hipY) * (1 - 0.42 * pv.fold);
  const cb = Math.cos(pv.bend), sb = Math.sin(pv.bend);
  return [dx * cb - dy * sb, dx * sb + dy * cb + g.hipY];
}

/** Local (feet-origin) position of a named string attachment, after bend / bow. */
export function attachLocal(sp, pv, name) {
  const g = sp.geo;
  switch (name) {
    case 'head': {
      const ty = g.shoulderY, c1 = Math.cos(pv.tilt), s1 = Math.sin(pv.tilt);
      const dy = g.topY + g.headR * 0.12 - ty;
      return upper(pv, g, -dy * s1, ty + dy * c1);
    }
    case 'shoulderL': return upper(pv, g, -g.shoulderX * 0.9, g.shoulderY);
    case 'shoulderR': return upper(pv, g, g.shoulderX * 0.9, g.shoulderY);
    case 'handL': { const h = armPoints(sp, -1, pv.armA[0], pv.armE[0]); return upper(pv, g, h.hx, h.hy); }
    case 'handR': { const h = armPoints(sp, 1, pv.armA[1], pv.armE[1]); return upper(pv, g, h.hx, h.hy); }
    case 'kneeL': return [-g.H * 0.07 + Math.sin(pv.walk) * 4 * pv.walkAmp, -g.H * 0.17];
    case 'kneeR': return [g.H * 0.07 - Math.sin(pv.walk) * 4 * pv.walkAmp, -g.H * 0.17];
    case 'back': return upper(pv, g, 0, g.hipY - g.H * 0.12);
    default: return [0, g.shoulderY];
  }
}

/** puppet-local -> world, matching translate(x,y) translate(0,-pivot) rotate(rot) translate(0,pivot) scale(sx,sy). */
export function toWorld(pv, lx, ly, out) {
  const x = lx * pv.sx, y = ly * pv.sy + pv.pivot;
  const cr = Math.cos(pv.rot), sr = Math.sin(pv.rot);
  out = out || [0, 0];
  out[0] = pv.x + x * cr - y * sr;
  out[1] = pv.y + x * sr + y * cr - pv.pivot;
  return out;
}

/** World position of the head centre (for particles, hit tests, the whisper). */
export function headWorld(sp, pv, out) {
  const g = sp.geo, p = upper(pv, g, 0, g.headY);
  return toWorld(pv, p[0], p[1], out);
}

// ---- drawing ---------------------------------------------------------------------------------------------------------------
export function drawBody(ctx, pv, sp, t, shadow, back) {
  const g = sp.geo;
  ctx.save();
  ctx.translate(pv.x, pv.y);
  ctx.translate(0, -pv.pivot);
  ctx.rotate(pv.rot);
  ctx.translate(0, pv.pivot);
  ctx.scale(pv.sx, pv.sy);
  drawLower(ctx, sp, pv);
  // upper group: bend sideways / fold forward about the hips
  ctx.save();
  ctx.translate(0, g.hipY);
  ctx.rotate(pv.bend);
  ctx.scale(1, 1 - 0.42 * pv.fold);
  ctx.translate(0, -g.hipY);
  drawTorso(ctx, sp, pv);
  const handsToFace = pv.armE[0] > 1.9 || pv.armE[1] > 1.9;
  if (!handsToFace) { drawArm(ctx, sp, -1, pv.armA[0], pv.armE[0]); drawArm(ctx, sp, 1, pv.armA[1], pv.armE[1]); }
  // head, with its own tilt about the neck
  ctx.save();
  ctx.translate(0, g.shoulderY);
  ctx.rotate(pv.tilt);
  ctx.translate(0, -g.shoulderY + pv.nod);
  ctx.translate(0, g.headY);
  const f = pv.face;
  f.back = back;
  drawHead(ctx, sp, f);
  ctx.restore();
  if (handsToFace) { drawArm(ctx, sp, -1, pv.armA[0], pv.armE[0]); drawArm(ctx, sp, 1, pv.armA[1], pv.armE[1]); }
  ctx.restore();
  ctx.restore();
}

/**
 * o: { hover 0..1, overlay: [color, alpha] | null, ghostPulse 0..1, alpha }
 */
export function drawPuppet(ctx, pv, sp, t, o = {}) {
  const tint = getTint();
  const alpha = o.alpha == null ? 1 : o.alpha;
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = sp.geo;
  const back = pv.sx < 0;
  // contact shadow on the floor (not part of the body, never tinted)
  if (!tint) {
    const w = g.H * 0.3 * Math.abs(pv.sx);
    ctx.save();
    ctx.translate(pv.x, pv.footY == null ? pv.y : pv.footY);
    ctx.scale(1, 0.22);
    ctx.fillStyle = rgrad(ctx, 0, 0, 0, w, [[0, 'rgba(8,2,10,.5)'], [1, 'rgba(8,2,10,0)']]);
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
  }
  // paper drop-shadow (offset silhouette)
  if (!tint) {
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.translate(7, 9);
    setTint('shadow');
    drawBody(ctx, pv, sp, t, true, back);
    setTint(null);
    ctx.restore();
  }
  // hover halo
  if (o.hover > 0.02 && !tint) {
    ctx.save();
    ctx.globalAlpha *= 0.75 * o.hover;
    const cx = pv.x, cy = pv.y - g.H * 0.5;
    ctx.translate(cx, cy); ctx.scale(1.07, 1.05); ctx.translate(-cx, -cy);
    setTint('flat', '#f7dc8c');
    drawBody(ctx, pv, sp, t, true, back);
    setTint(null);
    ctx.restore();
  }
  drawBody(ctx, pv, sp, t, false, back);
  if (back && !tint) { ctx.save(); ctx.globalAlpha *= 0.25; setTint('shadow'); drawBody(ctx, pv, sp, t, true, true); setTint(null); ctx.restore(); }
  if (o.overlay && !tint) {
    ctx.save();
    ctx.globalAlpha *= o.overlay[1];
    setTint('flat', o.overlay[0]);
    drawBody(ctx, pv, sp, t, true, back);
    setTint(prevTint(tint));
    ctx.restore();
  }
  ctx.restore();
}
const prevTint = (t) => t || null;

// ---- the control bar ---------------------------------------------------------------------------------------------------------
export function drawBar(ctx, bar, sp, t) {
  ctx.save();
  ctx.translate(bar.x, bar.y);
  ctx.rotate(bar.rot);
  // handle rod up into the flies
  ctx.fillStyle = c('#3a2a2e'); ctx.fillRect(-3, -420, 6, 420);
  ctx.fillStyle = c('rgba(255,255,255,.12)'); ctx.fillRect(-3, -420, 2, 420);
  // main bar
  rr(ctx, -BAR_HALF - 8, -5, (BAR_HALF + 8) * 2, 10, 5); paper(ctx, '#8a5a3c', 1.8);
  rr(ctx, -14, -16, 28, 22, 5); paper(ctx, '#9b6a46', 1.8);
  for (const s of [-1, 1]) { circle(ctx, s * (BAR_HALF + 8), 0, 6.5); paper(ctx, sp.pal.accent, 1.6); }
  // second (leg) bar
  ctx.fillStyle = c('#4a3030'); ctx.fillRect(-2, 4, 4, 8);
  rr(ctx, -34, 10, 68, 7, 3.5); paper(ctx, '#7a4e34', 1.6);
  ctx.restore();
}

/** Tie point of a string on the bar, in world coordinates. */
export function barAnchor(bar, name, out) {
  const [fx, dy] = BAR_TIE[name] || [0, 0];
  const lx = fx * BAR_HALF, ly = dy ? 13 : 0;
  const cr = Math.cos(bar.rot), sr = Math.sin(bar.rot);
  out = out || [0, 0];
  out[0] = bar.x + lx * cr - ly * sr;
  out[1] = bar.y + lx * sr + ly * cr;
  return out;
}

/** A visible knot where strings have tangled. */
export function drawKnot(ctx, x, y, size, t) {
  const r = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.3 + x) * 0.2);
  circle(ctx, 0, 0, r); paper(ctx, '#8a6a4a', 1.6, '#3a2a1c');
  circle(ctx, -r * 0.3, -r * 0.3, r * 0.45); fillOnly(ctx, '#b89468');
  ctx.strokeStyle = c('#3a2a1c'); ctx.lineWidth = Math.max(1.4, r * 0.18);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0.3, 4.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 0.1, r * 0.1, r * 0.36, 3.5, 7.2); ctx.stroke();
  // loose ends
  ctx.strokeStyle = c('#e9dfc9'); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.2); ctx.quadraticCurveTo(r * 1.5, -r * 0.7, r * 1.7, -r * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.4); ctx.quadraticCurveTo(-r * 1.4, r * 0.9, -r * 1.2, r * 1.5); ctx.stroke();
  ctx.restore();
}
