// The paper-silhouette audience: twelve spectators in the stalls. Hats, coats, bobbing/swivelling heads and six
// reactions (laugh, gasp, cry, boo, yawn, applaud) as pure functions of the reaction's age.

import { c, shade, mix, rgba } from '../color.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vfill, hfill, vgrad, INK } from './shapes.js';
import { clamp } from '../layout.js';

export const REACT_DUR = { laugh: 1.9, gasp: 1.7, cry: 2.5, boo: 2.1, yawn: 2.7, applaud: 2.5 };
const DARK = '#0e0713';
const CREAM = '#fff4de';
const HEAD_R = 33;

const bump = (a, up, hold, down) => (a < 0 ? 0 : a < up ? a / up : a < up + hold ? 1 : Math.max(0, 1 - (a - up - hold) / down));

/** Fill `o` with the pose for reaction `type` at age `a` seconds, intensity `k` (0.2..1). */
export function reactPose(type, a, k, o) {
  o.dy = 0; o.tilt = 0; o.sy = 1; o.mouth = 0; o.round = 0; o.eye = 1; o.happy = 0; o.flush = 0; o.brow = 0; o.hands = 0; o.clap = 0;
  o.tears = 0; o.shake = 0; o.lean = 0; o.sad = 0; o.zz = 0;
  if (!type || a < 0) return o;
  switch (type) {
    case 'laugh': {
      const d = Math.exp(-a * 1.1), ab = Math.abs(Math.sin(a * 13));
      o.dy = -ab * 14 * k * d; o.mouth = (0.55 + 0.45 * ab) * Math.min(1, d * 2.4); o.happy = d > 0.12 ? 1 : 0;
      o.sy = 1 + 0.07 * Math.sin(a * 26) * k * d; o.tilt = Math.sin(a * 6) * 0.08 * k * d; break;
    }
    case 'gasp': {
      const e = bump(a, 0.12, 1.0, 0.5);
      o.lean = e * k; o.tilt = -0.11 * k * e; o.sy = 1 + 0.09 * e * k; o.mouth = 0.62 * e; o.round = e; o.eye = 1 + 0.4 * e; o.dy = -6 * e * k; o.brow = -e; break;
    }
    case 'cry': {
      const e = bump(a, 0.5, 1.2, 0.6);
      o.dy = 8 * e; o.tilt = 0.09 * Math.sin(a * 3) * e; o.sad = e; o.eye = 1 - 0.55 * e; o.tears = e; o.shake = Math.sin(a * 24) * 1.6 * e * k; o.mouth = 0.18 * e; o.brow = -e; break;
    }
    case 'boo': {
      const e = bump(a, 0.25, 1.1, 0.6);
      o.flush = e; o.brow = e; o.mouth = (0.45 + 0.3 * Math.sin(a * 9)) * e; o.dy = -5 * e; o.tilt = Math.sin(a * 8) * 0.06 * e * k; o.hands = -e; o.shake = Math.sin(a * 30) * 1.2 * e; break;
    }
    case 'yawn': {
      const e = bump(a, 0.6, 1.1, 0.7);
      o.tilt = -0.2 * e; o.mouth = 1.0 * e; o.round = 0.8 * e; o.eye = 1 - 0.9 * e; o.dy = 6 * e; o.sy = 1 + 0.06 * e; o.zz = e; break;
    }
    case 'applaud': {
      const e = bump(a, 0.2, 1.7, 0.6);
      o.hands = e; o.clap = Math.abs(Math.sin(a * 17)); o.dy = -Math.abs(Math.sin(a * 8.5)) * 7 * k * e; o.happy = e > 0.2 ? 1 : 0; o.mouth = 0.25 * e; break;
    }
  }
  return o;
}

// ---- hats -----------------------------------------------------------------------------------------------------------------
function hat(ctx, kind, col, r) {
  const hc = shade(mix(col, '#c9a47a', 0.2), -0.12);
  switch (kind) {
    case 'top':
      ell(ctx, 0, -r * 0.92, r * 1.12, r * 0.2); paper(ctx, '#1d1822', 1.6, '#4a3a5a');
      rr(ctx, -r * 0.66, -r * 2.15, r * 1.32, r * 1.3, 4); paper(ctx, '#1d1822', 1.6, '#4a3a5a');
      rr(ctx, -r * 0.66, -r * 1.2, r * 1.32, r * 0.2, 2); paper(ctx, '#b3263d', 1.2);
      break;
    case 'bonnet':
      ctx.beginPath(); ctx.moveTo(-r * 1.05, r * 0.1); ctx.bezierCurveTo(-r * 1.3, -r * 1.7, r * 1.3, -r * 1.7, r * 1.05, r * 0.1); ctx.quadraticCurveTo(0, -r * 0.5, -r * 1.05, r * 0.1); ctx.closePath(); paper(ctx, hc, 1.6);
      ctx.beginPath(); ctx.moveTo(-r * 0.9, r * 0.35); ctx.quadraticCurveTo(-r * 0.4, r * 1.2, 0, r * 1.15); strokeOnly(ctx, '#d8546b', 3);
      ctx.beginPath(); ctx.moveTo(r * 0.9, r * 0.35); ctx.quadraticCurveTo(r * 0.4, r * 1.2, 0, r * 1.15); strokeOnly(ctx, '#d8546b', 3);
      circle(ctx, r * 0.45, -r * 1.15, r * 0.2); paper(ctx, '#f2c14e', 1.2);
      break;
    case 'crown':
      poly(ctx, [-r * 0.7, -r * 0.8, -r * 0.8, -r * 1.55, -r * 0.4, -r * 1.2, 0, -r * 1.75, r * 0.4, -r * 1.2, r * 0.8, -r * 1.55, r * 0.7, -r * 0.8]); paper(ctx, '#e9b949', 1.6, '#a97c1f');
      for (const x of [-0.8, 0, 0.8]) { circle(ctx, x * r, x === 0 ? -r * 1.75 : -r * 1.55, r * 0.11); fillOnly(ctx, '#d8546b'); }
      break;
    case 'flat':
      ell(ctx, 0, -r * 0.85, r * 1.0, r * 0.45); paper(ctx, hc, 1.6);
      ell(ctx, r * 0.35, -r * 0.62, r * 0.9, r * 0.14); paper(ctx, shade(hc, -0.25), 1.4);
      circle(ctx, 0, -r * 1.22, r * 0.1); fillOnly(ctx, shade(hc, -0.3));
      break;
    case 'feather':
      ell(ctx, 0, -r * 0.88, r * 0.95, r * 0.34); paper(ctx, hc, 1.6);
      ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 1.6); ctx.lineTo(-r * 0.3, -r * 0.82); ctx.lineTo(r * 0.3, -r * 0.82); ctx.lineTo(r * 0.75, -r * 1.6); ctx.quadraticCurveTo(0, -r * 1.1, -r * 0.75, -r * 1.6); ctx.closePath(); paper(ctx, hc, 1.6);
      ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 1.15); ctx.bezierCurveTo(r * 1.4, -r * 2.5, r * 1.9, -r * 1.2, r * 1.3, -r * 0.7); ctx.bezierCurveTo(r * 1.6, -r * 1.5, r * 1.2, -r * 2.0, r * 0.35, -r * 1.15); paper(ctx, '#4fb3a5', 1.4);
      break;
    case 'fez':
      poly(ctx, [-r * 0.8, -r * 0.85, -r * 0.55, -r * 1.65, r * 0.55, -r * 1.65, r * 0.8, -r * 0.85]); paper(ctx, '#a8262e', 1.6, '#5a0f18');
      ctx.beginPath(); ctx.moveTo(0, -r * 1.65); ctx.quadraticCurveTo(r * 0.9, -r * 1.7, r * 0.8, -r * 1.0); strokeOnly(ctx, '#1d1822', 2.4);
      circle(ctx, r * 0.8, -r * 0.95, r * 0.12); fillOnly(ctx, '#1d1822');
      break;
    case 'bow':
      poly(ctx, [0, -r * 1.1, -r * 0.9, -r * 1.6, -r * 0.9, -r * 0.6]); paper(ctx, '#d8546b', 1.6);
      poly(ctx, [0, -r * 1.1, r * 0.9, -r * 1.6, r * 0.9, -r * 0.6]); paper(ctx, '#d8546b', 1.6);
      circle(ctx, 0, -r * 1.1, r * 0.2); paper(ctx, shade('#d8546b', -0.2), 1.4);
      break;
    default: // none: a single cowlick
      ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.98); ctx.quadraticCurveTo(r * 0.3, -r * 1.5, r * 0.55, -r * 1.2); strokeOnly(ctx, shade(col, -0.4), 3);
  }
}

// ---- the seat -----------------------------------------------------------------------------------------------------------------
/**
 * sv: {pop 0..1, look -1..1, bob, ...pose}; taste: {palette:{coat,skin}}; hatKind; t seconds
 * Drawn at the origin; the caller translates/scales.
 */
export function drawSpectator(ctx, sv, seat, tasteRec, t, hover) {
  const r = HEAD_R;
  const pal = (seat && seat.palette) || (tasteRec && tasteRec.palette) || { coat: '#6d597a', skin: '#e8c9a0' };
  const dark = mix(pal.coat, DARK, 0.42), skin = mix(pal.skin, '#3a2442', 0.38);
  const coat = dark;
  // velvet seat back (always there)
  rr(ctx, -66, -26, 132, 190, 22); paper(ctx, '#3a1226', 1.8, '#1a0710');
  rr(ctx, -56, -16, 112, 24, 12); ctx.fillStyle = c(rgba('#d8546b', 0.12)); ctx.fill();
  if (sv.pop <= 0.01) return;
  const pop = sv.pop;
  ctx.save();
  ctx.translate(sv.shake || 0, (1 - pop) * 80 + sv.dy);
  ctx.scale(1, 1 + (sv.sy - 1) * 0.5);
  const bodyLean = sv.lean * 10;
  // body
  ctx.save();
  ctx.rotate(sv.tilt * 0.35);
  ctx.beginPath(); ctx.moveTo(-26, r * 0.95); ctx.quadraticCurveTo(-62, r * 1.3, -66, r * 3.2); ctx.lineTo(66, r * 3.2); ctx.quadraticCurveTo(62, r * 1.3, 26, r * 0.95); ctx.closePath();
  paper(ctx, vfill(ctx, r, r * 3.2, coat, 0.1), 2, shade(coat, -0.5));
  poly(ctx, [-14, r * 0.96, 0, r * 1.7, 14, r * 0.96]); paper(ctx, '#d9c9a8', 1.2);
  // hands (clap / fists)
  if (Math.abs(sv.hands) > 0.02) {
    const e = Math.abs(sv.hands);
    if (sv.hands > 0) {
      const gap = 6 + sv.clap * 22;
      for (const s of [-1, 1]) { circle(ctx, s * gap * 0.5, r * 1.9 - e * 10, 12); paper(ctx, skin, 1.6); }
    } else {
      for (const s of [-1, 1]) { circle(ctx, s * 54, r * 1.0 - e * 22 + Math.sin(t * 18 + s) * 4, 12); paper(ctx, skin, 1.6); ctx.beginPath(); ctx.moveTo(s * 54, r * 1.0 + 8); ctx.lineTo(s * 58, r * 2.4); strokeOnly(ctx, coat, 12); }
    }
  }
  ctx.restore();
  // head (swivels with `look`)
  ctx.save();
  ctx.translate(bodyLean * -0.6 + sv.look * 5, 0);
  ctx.rotate(sv.tilt + sv.look * 0.05);
  const hx = sv.look * 5;
  circle(ctx, 0, 0, r); paper(ctx, vfill(ctx, -r, r, skin, 0.06), 2, shade(skin, -0.5));
  for (const s of [-1, 1]) { ell(ctx, s * r * 0.98, r * 0.1, r * 0.16, r * 0.24); paper(ctx, skin, 1.4); }
  if (sv.flush > 0.02) { ctx.save(); ctx.globalAlpha = sv.flush * 0.8; circle(ctx, 0, 0, r - 1); fillOnly(ctx, '#e0402e'); ctx.restore(); }
  // face
  const open = clamp(sv.eye, 0.05, 1.5), ex = r * 0.4, ey = -r * 0.08;
  for (const s of [-1, 1]) {
    if (sv.happy) { ctx.beginPath(); ctx.arc(s * ex + hx, ey + 3, r * 0.17, Math.PI * 1.1, Math.PI * 1.9); strokeOnly(ctx, CREAM, 3); }
    else if (open < 0.2) { ctx.beginPath(); ctx.moveTo(s * ex - r * 0.17 + hx, ey + 2); ctx.lineTo(s * ex + r * 0.17 + hx, ey + 2); strokeOnly(ctx, CREAM, 3); }
    else {
      ell(ctx, s * ex + hx, ey, r * 0.17, r * 0.2 * open); fillOnly(ctx, CREAM);
      circle(ctx, s * ex + hx + sv.look * r * 0.07, ey - r * 0.04, r * 0.085); fillOnly(ctx, DARK);
    }
    // brows
    const bt = sv.brow * 0.55;
    ctx.beginPath(); ctx.moveTo(s * ex - r * 0.2 + hx, ey - r * 0.32 + (s < 0 ? bt : -bt) * r * 0.3 * -1); ctx.lineTo(s * ex + r * 0.2 + hx, ey - r * 0.32 + (s < 0 ? -bt : bt) * r * 0.3 * -1); strokeOnly(ctx, shade(skin, -0.5), 3);
  }
  // mouth
  const my = r * 0.5;
  if (sv.mouth > 0.06) {
    if (sv.round > 0.1) { ell(ctx, hx, my, r * (0.16 + 0.12 * sv.round), r * (0.2 + 0.28 * sv.mouth)); fillOnly(ctx, '#2a0a16'); }
    else { ctx.beginPath(); ctx.moveTo(-r * 0.4 + hx, my - 2); ctx.quadraticCurveTo(hx, my + r * (0.2 + 0.9 * sv.mouth), r * 0.4 + hx, my - 2); ctx.closePath(); fillOnly(ctx, '#2a0a16'); ctx.save(); ctx.clip(); ell(ctx, hx, my + r * 0.7 * sv.mouth + 2, r * 0.22, r * 0.14); fillOnly(ctx, '#d65a74'); ctx.restore(); }
  } else if (sv.sad > 0.1) { ctx.beginPath(); ctx.arc(hx, my + 8, r * 0.26, Math.PI * 1.15, Math.PI * 1.85); strokeOnly(ctx, shade(skin, -0.6), 3); }
  else { ctx.beginPath(); ctx.moveTo(-r * 0.2 + hx, my); ctx.quadraticCurveTo(hx, my + 4, r * 0.2 + hx, my); strokeOnly(ctx, shade(skin, -0.6), 2.6); }
  // tears
  if (sv.tears > 0.1) for (const s of [-1, 1]) { const f = (t * 1.8 + (s > 0 ? 0.5 : 0)) % 1; ctx.beginPath(); ctx.moveTo(s * ex + hx, ey + r * 0.2); ctx.lineTo(s * ex + hx + s * 2, ey + r * 0.2 + 8 + f * 26); strokeOnly(ctx, '#9fd4ff', 3.2); }
  hat(ctx, seat ? seat.hat : (tasteRec ? tasteRec.hat : 'none'), pal.coat, r);
  ctx.restore();
  ctx.restore();
  if (hover > 0.02) {
    ctx.save(); ctx.globalAlpha = hover * 0.9; circle(ctx, 0, 0, r + 12); ctx.lineWidth = 4; ctx.strokeStyle = c('#f7dc8c'); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.restore();
  }
}
