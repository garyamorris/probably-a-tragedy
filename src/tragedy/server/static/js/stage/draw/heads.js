// The eight puppet heads. Each painter draws around the head centre (0,0); r = head radius.
// `f` is the live face state: {mouth 0..1, smile -1..1, eye 0..1.4, lid 0..1, browL, browR, tilt, raiseL, raiseR,
//  blush 0..1, happy 0..1, lookX, lookY, blink 0..1, back, t, talk}

import { c, shade, mix, rgba } from '../color.js';
import { clamp } from '../layout.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vfill, hfill, vgrad, hgrad, INK } from './shapes.js';

const DARK = '#2a1530';
const MOUTH = '#4a1226';
const CREAM = '#fffaf0';

// ---- shared face pieces ------------------------------------------------------------------------------------------------
function eye(ctx, x, y, rx, ry, f, skin, side) {
  if (f.happy > 0.55) {
    ctx.beginPath(); ctx.arc(x, y + ry * 0.35, rx * 0.95, Math.PI * 1.1, Math.PI * 1.9);
    strokeOnly(ctx, INK, Math.max(2, rx * 0.5));
    return;
  }
  const open = clamp(f.eye * f.blink, 0.06, 1.45);
  const h = ry * open;
  ell(ctx, x, y, rx, h); paper(ctx, CREAM, 1.6, DARK);
  ctx.save();
  ell(ctx, x, y, rx, h); ctx.clip();
  const pr = rx * 0.58;
  ell(ctx, x + f.lookX * rx * 0.42, y + f.lookY * ry * 0.3, pr, pr * 1.05); fillOnly(ctx, INK);
  ell(ctx, x + f.lookX * rx * 0.42 + pr * 0.35, y + f.lookY * ry * 0.3 - pr * 0.35, pr * 0.28, pr * 0.28); fillOnly(ctx, '#ffffff');
  if (f.lid > 0.02) {
    ctx.fillStyle = c(shade(skin, -0.05));
    ctx.fillRect(x - rx - 1, y - h - 1, rx * 2 + 2, (h * 2 + 2) * f.lid);
    ctx.beginPath(); ctx.moveTo(x - rx, y - h + h * 2 * f.lid); ctx.lineTo(x + rx, y - h + h * 2 * f.lid); strokeOnly(ctx, DARK, 1.8);
  }
  ctx.restore();
}

function brow(ctx, x, y, w, tilt, raise, col, lw, side) {
  const ix = x - side * w * 0.5, ox = x + side * w * 0.5;
  const iy = y + tilt * w * 0.45 - raise, oy = y - tilt * w * 0.35 - raise;
  ctx.beginPath(); ctx.moveTo(ix, iy); ctx.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - w * 0.1, ox, oy);
  strokeOnly(ctx, col, lw);
}

function blush(ctx, r, x, y, a) {
  if (a < 0.03) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, a) * 0.55;
  ell(ctx, -x, y, r * 0.2, r * 0.13); fillOnly(ctx, '#ff6f86');
  ell(ctx, x, y, r * 0.2, r * 0.13); fillOnly(ctx, '#ff6f86');
  ctx.restore();
}

/** A mouth at (cx,cy), half-width w. `jawDrop` lets heads with a physical jaw move it separately. */
function mouth(ctx, cx, cy, w, f, r) {
  const m = f.mouth;
  if (m < 0.07) {
    const s = f.smile;
    ctx.beginPath(); ctx.moveTo(cx - w, cy - s * r * 0.04);
    ctx.quadraticCurveTo(cx, cy + s * r * 0.34, cx + w, cy - s * r * 0.04);
    strokeOnly(ctx, DARK, Math.max(2, r * 0.07));
    if (s > 0.7) { ctx.beginPath(); ctx.arc(cx - w, cy - r * 0.02, r * 0.03, 0, 6.3); fillOnly(ctx, DARK); ctx.beginPath(); ctx.arc(cx + w, cy - r * 0.02, r * 0.03, 0, 6.3); fillOnly(ctx, DARK); }
    return;
  }
  const hh = r * (0.1 + 0.5 * m), ww = w * (0.72 + 0.28 * m);
  ctx.beginPath();
  ctx.moveTo(cx - ww, cy - hh * 0.2);
  ctx.quadraticCurveTo(cx, cy - hh * 0.55 - f.smile * r * 0.06, cx + ww, cy - hh * 0.2);
  ctx.quadraticCurveTo(cx + ww * 0.7, cy + hh * 1.15, cx, cy + hh * 1.2);
  ctx.quadraticCurveTo(cx - ww * 0.7, cy + hh * 1.15, cx - ww, cy - hh * 0.2);
  ctx.closePath();
  paper(ctx, MOUTH, 1.8, DARK);
  if (m > 0.35) { ctx.save(); ctx.clip(); ell(ctx, cx, cy + hh * 1.1, ww * 0.55, hh * 0.5); fillOnly(ctx, '#ee7b8b'); ctx.restore(); }
}

function genericFace(ctx, r, f, o) {
  if (f.back) return;
  const ex = r * o.eyeX, ey = r * o.eyeY, rx = r * o.eyeR, ry = r * o.eyeR * 1.18;
  blush(ctx, r, r * 0.55, r * 0.3, f.blush);
  eye(ctx, -ex, ey, rx, ry, f, o.skin, -1);
  eye(ctx, ex, ey, rx, ry, f, o.skin, 1);
  const bw = rx * 2.1, by = ey - ry * 1.55;
  brow(ctx, -ex, by, bw, f.browL, f.raiseL * r * 0.18, o.hair, Math.max(2.4, r * 0.085), -1);
  brow(ctx, ex, by, bw, f.browR, f.raiseR * r * 0.18, o.hair, Math.max(2.4, r * 0.085), 1);
  if (o.nose) { ell(ctx, 0, ey + r * 0.3, r * 0.1, r * 0.08); fillOnly(ctx, shade(o.skin, -0.14)); }
  mouth(ctx, 0, r * o.mouthY, r * o.mouthW, f, r);
}

// ---- headwear from the costume ----------------------------------------------------------------------------------------
function headwear(ctx, r, sp, f, topY) {
  const P = sp.pal;
  if (sp.costume === 'wig') {
    const wig = mix('#f4efe6', P.hair, 0.12);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { circle(ctx, s * r * (1.06 - i * 0.02), topY * 0.45 + r * (0.2 + i * 0.5), r * 0.3); paper(ctx, wig, 1.6); }
    ell(ctx, 0, topY * 0.98, r * 1.1, r * 0.55); paper(ctx, wig, 1.8);
    for (let i = -2; i <= 2; i++) { circle(ctx, i * r * 0.36, topY * 0.98 - r * 0.28 + Math.abs(i) * r * 0.1, r * 0.26); paper(ctx, wig, 1.5); }
    circle(ctx, 0, topY * 0.98 - r * 0.6, r * 0.25); paper(ctx, wig, 1.5);
    // ribbon bow
    for (const s of [-1, 1]) { poly(ctx, [s * r * 0.08, topY - r * 0.25, s * r * 0.5, topY - r * 0.55, s * r * 0.5, topY + r * 0.02]); paper(ctx, P.accent, 1.5); }
    circle(ctx, 0, topY - r * 0.25, r * 0.1); paper(ctx, shade(P.accent, -0.2), 1.5);
  } else if (sp.costume === 'armour') {
    // plume + helm band
    ctx.beginPath(); ctx.moveTo(-r * 0.06, topY + r * 0.05); ctx.bezierCurveTo(-r * 0.7, topY - r * 0.9, r * 0.6, topY - r * 1.4, r * 0.9, topY - r * 0.55); ctx.bezierCurveTo(r * 0.5, topY - r * 0.5, r * 0.3, topY - r * 0.1, r * 0.06, topY + r * 0.05); ctx.closePath();
    paper(ctx, P.accent, 1.8);
    rr(ctx, -r * 0.2, topY - r * 0.05, r * 0.4, r * 0.18, 3); paper(ctx, '#c9d4dc', 1.6);
  } else if (sp.costume === 'uniform' && sp.head !== 'nutcracker') {
    rr(ctx, -r * 0.82, topY - r * 0.12, r * 1.64, r * 0.5, r * 0.14); paper(ctx, P.body, 1.8);
    rr(ctx, -r * 0.82, topY + r * 0.2, r * 1.64, r * 0.16, 2); paper(ctx, P.accent, 1.4);
    ell(ctx, 0, topY + r * 0.42, r * 0.9, r * 0.14); paper(ctx, shade(P.body, -0.3), 1.4);
    circle(ctx, 0, topY + r * 0.12, r * 0.1); paper(ctx, P.accent, 1.2);
  }
}

// ---- the heads ---------------------------------------------------------------------------------------------------------
function round(ctx, r, sp, f) {
  const P = sp.pal, skin = sp.skin;
  if (f.back) { ell(ctx, 0, 0, r, r * 1.03); paper(ctx, P.hair, 2); headwear(ctx, r, sp, f, -r); return; }
  circle(ctx, 0, -r * 1.08, r * 0.3); paper(ctx, P.hair, 1.8); // bun
  for (const s of [-1, 1]) { circle(ctx, s * r * 0.98, r * 0.1, r * 0.21); paper(ctx, skin, 1.6); }
  ell(ctx, 0, 0, r, r * 1.03); paper(ctx, vfill(ctx, -r, r, skin, 0.07), 2, shade(skin, -0.4));
  ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.05);
  ctx.bezierCurveTo(-r * 1.12, -r * 1.25, r * 1.12, -r * 1.25, r * 1.0, -r * 0.05);
  ctx.quadraticCurveTo(r * 0.62, -r * 0.62, r * 0.1, -r * 0.5); ctx.quadraticCurveTo(-r * 0.55, -r * 0.62, -r * 1.0, -r * 0.05); ctx.closePath();
  paper(ctx, P.hair, 1.8);
  headwear(ctx, r, sp, f, -r * 1.05);
  genericFace(ctx, r, f, { eyeX: 0.42, eyeY: 0.0, eyeR: 0.2, mouthY: 0.5, mouthW: 0.3, skin, hair: P.hair, nose: true });
}

function long(ctx, r, sp, f) {
  const P = sp.pal, skin = sp.skin, rx = r * 0.8, ry = r * 1.34;
  if (f.back) { ell(ctx, 0, 0, rx, ry); paper(ctx, P.hair, 2); headwear(ctx, r, sp, f, -ry); return; }
  for (const s of [-1, 1]) { ell(ctx, s * rx * 0.99, r * 0.1, r * 0.14, r * 0.26); paper(ctx, skin, 1.6); }
  ell(ctx, 0, 0, rx, ry); paper(ctx, vfill(ctx, -ry, ry, skin, 0.07), 2, shade(skin, -0.4));
  // swept hair
  ctx.beginPath(); ctx.moveTo(-rx * 1.0, -r * 0.2);
  ctx.bezierCurveTo(-rx * 1.1, -ry * 1.18, rx * 1.2, -ry * 1.15, rx * 1.0, -r * 0.35);
  ctx.quadraticCurveTo(rx * 0.3, -r * 0.95, -rx * 0.55, -r * 0.7); ctx.quadraticCurveTo(-rx * 0.9, -r * 0.5, -rx * 1.0, -r * 0.2); ctx.closePath();
  paper(ctx, P.hair, 1.8);
  headwear(ctx, r, sp, f, -ry * 1.0);
  // droopy moustache for the gentle villain
  genericFace(ctx, r, f, { eyeX: 0.34, eyeY: -0.22, eyeR: 0.17, mouthY: 0.72, mouthW: 0.26, skin, hair: P.hair, nose: false });
  if (!f.back) {
    ctx.beginPath(); ctx.moveTo(0, r * 0.12); ctx.quadraticCurveTo(r * 0.16, r * 0.46, 0, r * 0.52); ctx.quadraticCurveTo(-r * 0.16, r * 0.46, 0, r * 0.12);
    fillOnly(ctx, shade(skin, -0.16));
    ctx.beginPath(); ctx.moveTo(-r * 0.04, r * 0.5); ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.46, r * 0.66); ctx.quadraticCurveTo(-r * 0.2, r * 0.58, 0, r * 0.56);
    ctx.quadraticCurveTo(r * 0.2, r * 0.58, r * 0.46, r * 0.66); ctx.quadraticCurveTo(r * 0.4, r * 0.5, r * 0.04, r * 0.5); ctx.closePath(); paper(ctx, P.hair, 1.4);
  }
}

function square(ctx, r, sp, f) {
  const P = sp.pal, skin = sp.skin, w = r * 1.78, h = r * 1.72;
  if (f.back) { rr(ctx, -w / 2, -h / 2, w, h, r * 0.35); paper(ctx, P.hair, 2); headwear(ctx, r, sp, f, -h / 2); return; }
  for (const s of [-1, 1]) { ell(ctx, s * w * 0.5, r * 0.05, r * 0.15, r * 0.24); paper(ctx, skin, 1.6); }
  rr(ctx, -w / 2, -h / 2, w, h, r * 0.4); paper(ctx, vfill(ctx, -h / 2, h / 2, skin, 0.07), 2, shade(skin, -0.4));
  // ragdoll yarn hair
  rr(ctx, -w / 2 - 2, -h / 2 - r * 0.2, w + 4, r * 0.62, r * 0.28); paper(ctx, P.hair, 1.8);
  for (let i = -3; i <= 3; i++) { ell(ctx, i * r * 0.28, -h / 2 - r * 0.22, r * 0.14, r * 0.28, i * 0.2); paper(ctx, P.hair, 1.4); }
  for (const s of [-1, 1]) { ell(ctx, s * (w / 2 - r * 0.05), -h / 2 + r * 0.55, r * 0.12, r * 0.4); paper(ctx, P.hair, 1.4); }
  headwear(ctx, r, sp, f, -h / 2 - r * 0.3);
  // stitched cheeks
  ctx.strokeStyle = c(rgba('#2a1530', 0.5)); ctx.lineWidth = 2;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s * (r * 0.62 + i * 7), r * 0.28); ctx.lineTo(s * (r * 0.62 + i * 7 + 4), r * 0.38); ctx.stroke(); }
  genericFace(ctx, r, f, { eyeX: 0.45, eyeY: -0.05, eyeR: 0.2, mouthY: 0.5, mouthW: 0.36, skin, hair: P.hair, nose: true });
}

function beak(ctx, r, sp, f) {
  const P = sp.pal, body = P.body, orange = P.accent;
  if (f.back) { ell(ctx, 0, 0, r * 0.95, r); paper(ctx, body, 2); headwear(ctx, r, sp, f, -r); return; }
  // tuft
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.18, -r * 0.85); ctx.quadraticCurveTo(i * r * 0.5, -r * 1.5 - Math.abs(i) * -r * 0.1, i * r * 0.12 + r * 0.18, -r * 1.25); ctx.quadraticCurveTo(i * r * 0.2, -r * 1.0, i * r * 0.18, -r * 0.85); paper(ctx, body, 1.5); }
  ell(ctx, 0, 0, r * 0.97, r * 1.0); paper(ctx, vfill(ctx, -r, r, body, 0.05), 2, shade(body, -0.4));
  headwear(ctx, r, sp, f, -r * 0.98);
  blush(ctx, r, r * 0.7, r * 0.34, Math.max(f.blush, 0.35));
  // eyes on the sides
  const ey = -r * 0.2;
  eye(ctx, -r * 0.5, ey, r * 0.2, r * 0.23, f, body, -1);
  eye(ctx, r * 0.5, ey, r * 0.2, r * 0.23, f, body, 1);
  brow(ctx, -r * 0.5, ey - r * 0.38, r * 0.4, f.browL, f.raiseL * r * 0.15, shade(body, -0.5), 3, -1);
  brow(ctx, r * 0.5, ey - r * 0.38, r * 0.4, f.browR, f.raiseR * r * 0.15, shade(body, -0.5), 3, 1);
  // bill: upper + lower mandible, the lower one drops with the jaw
  const drop = f.mouth * r * 0.42;
  ell(ctx, 0, r * 0.38 + drop * 0.9, r * 0.5, r * 0.19); paper(ctx, shade(orange, -0.1), 1.8);
  if (f.mouth > 0.1) { ell(ctx, 0, r * 0.38 + drop * 0.5, r * 0.42, drop * 0.5 + 1); fillOnly(ctx, MOUTH); }
  ell(ctx, 0, r * 0.3, r * 0.56, r * 0.22); paper(ctx, orange, 1.8);
  for (const s of [-1, 1]) { ell(ctx, s * r * 0.14, r * 0.25, r * 0.05, r * 0.03); fillOnly(ctx, shade(orange, -0.5)); }
  if (f.smile > 0.5 && f.mouth < 0.1) { ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.5, 0.25, Math.PI - 0.25); strokeOnly(ctx, shade(orange, -0.5), 2); }
}

function sock(ctx, r, sp, f) {
  const P = sp.pal, body = P.body;
  // sock tube with a floppy, drooping toe
  const wag = Math.sin(f.t * 1.3 + 1) * 0.05 * r;
  ctx.beginPath(); ctx.moveTo(-r * 0.78, r * 0.95);
  ctx.lineTo(-r * 0.7, -r * 0.75);
  ctx.bezierCurveTo(-r * 0.68, -r * 1.55, r * 0.2, -r * 1.95 + wag, r * 0.85, -r * 1.55 + wag);
  ctx.bezierCurveTo(r * 1.32, -r * 1.2 + wag, r * 1.3, -r * 0.45 + wag * 2, r * 1.02, -r * 0.42 + wag * 2);
  ctx.bezierCurveTo(r * 0.86, -r * 0.4, r * 0.76, -r * 0.7, r * 0.7, -r * 0.7);
  ctx.lineTo(r * 0.8, r * 0.95); ctx.closePath();
  paper(ctx, hfill(ctx, -r, r, body, 0.1), 2, shade(body, -0.4));
  // stripes
  ctx.save(); ctx.clip();
  ctx.fillStyle = c(P.accent);
  for (const yy of [-r * 0.65, r * 0.05]) ctx.fillRect(-r * 1.2, yy, r * 2.4, r * 0.14);
  ctx.restore();
  // hair yarn tuft on the floppy end
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(r * 1.12 + wag * 0.5 + (i % 2) * 3, -r * 0.5 + i * r * 0.17 + wag * 2, r * 0.17, 0, 6.3); paper(ctx, P.hair, 1.4); }
  if (f.back) return;
  // button eyes with white halo
  for (const s of [-1, 1]) {
    const x = s * r * 0.38, y = -r * 0.46;
    circle(ctx, x, y, r * 0.3); paper(ctx, CREAM, 1.8, DARK);
    circle(ctx, x + f.lookX * r * 0.06, y + f.lookY * r * 0.05, r * 0.19 * clamp(f.eye, 0.55, 1.2)); fillOnly(ctx, INK);
    circle(ctx, x - r * 0.04, y - r * 0.06, r * 0.05); fillOnly(ctx, '#fff');
    // x-stitch cross
    ctx.strokeStyle = c(rgba('#ffffff', 0.7)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x + 4, y + 3); ctx.moveTo(x + 4, y - 3); ctx.lineTo(x - 4, y + 3); ctx.stroke();
    brow(ctx, x, y - r * 0.4, r * 0.5, s < 0 ? f.browL : f.browR, (s < 0 ? f.raiseL : f.raiseR) * r * 0.16, P.hair, 3.2, s);
  }
  blush(ctx, r, r * 0.62, r * 0.12, f.blush);
  // the big flappy mouth: the toe of the sock
  const m = f.mouth, mh = r * (0.18 + 0.62 * m);
  ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.18);
  ctx.quadraticCurveTo(0, r * 0.18 - r * 0.2 + f.smile * -r * 0.0, r * 0.7, r * 0.18);
  ctx.quadraticCurveTo(r * 0.64, r * 0.18 + mh * 1.5, 0, r * 0.18 + mh * 1.6);
  ctx.quadraticCurveTo(-r * 0.64, r * 0.18 + mh * 1.5, -r * 0.7, r * 0.18); ctx.closePath();
  paper(ctx, '#c1304f', 2, DARK);
  ctx.save(); ctx.clip(); ell(ctx, 0, r * 0.18 + mh * 1.6, r * 0.38, mh * 0.55); fillOnly(ctx, '#f08a9c'); ctx.restore();
  // lip line
  ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.18); ctx.quadraticCurveTo(0, r * 0.0 + (1 - f.smile) * r * 0.06, r * 0.7, r * 0.18); strokeOnly(ctx, shade(P.accent, -0.3), 3);
}

function nutcracker(ctx, r, sp, f) {
  const P = sp.pal, skin = '#efd2b0', w = r * 1.7, h = r * 1.35;
  const drop = f.mouth * r * 0.5;
  // tall shako hat
  rr(ctx, -r * 0.82, -h / 2 - r * 1.25, r * 1.64, r * 1.3, 6); paper(ctx, '#1d2a35', 2);
  rr(ctx, -r * 0.82, -h / 2 - r * 0.28, r * 1.64, r * 0.22, 3); paper(ctx, P.accent, 1.6);
  star(ctx, 0, -h / 2 - r * 0.78, 5, r * 0.22, r * 0.1, -1.57); paper(ctx, P.accent, 1.4);
  ctx.beginPath(); ctx.moveTo(r * 0.35, -h / 2 - r * 1.25); ctx.quadraticCurveTo(r * 1.0, -h / 2 - r * 1.9, r * 0.7, -h / 2 - r * 2.0); ctx.quadraticCurveTo(r * 0.75, -h / 2 - r * 1.5, r * 0.5, -h / 2 - r * 1.25); paper(ctx, '#d8546b', 1.4);
  if (f.back) { rr(ctx, -w / 2, -h / 2, w, h + r * 0.4, r * 0.2); paper(ctx, P.hair, 2); return; }
  // head box
  rr(ctx, -w / 2, -h / 2, w, h, r * 0.18); paper(ctx, vfill(ctx, -h / 2, h / 2, skin, 0.05), 2, shade(skin, -0.45));
  // cheeks
  for (const s of [-1, 1]) { circle(ctx, s * w * 0.34, r * 0.28, r * 0.2); fillOnly(ctx, '#f08a8a'); }
  // eyes: big bulging whites
  for (const s of [-1, 1]) {
    eye(ctx, s * r * 0.45, -r * 0.1, r * 0.26, r * 0.3, f, skin, s);
    brow(ctx, s * r * 0.45, -r * 0.55, r * 0.6, s < 0 ? f.browL : f.browR, (s < 0 ? f.raiseL : f.raiseR) * r * 0.16, '#1d1d1d', 4.4, s);
  }
  ell(ctx, 0, r * 0.18, r * 0.12, r * 0.14); fillOnly(ctx, shade(skin, -0.12));
  // moustache
  ctx.beginPath(); ctx.moveTo(0, r * 0.36); ctx.quadraticCurveTo(-r * 0.6, r * 0.26, -r * 0.82, r * 0.56); ctx.quadraticCurveTo(-r * 0.4, r * 0.5, 0, r * 0.46); ctx.quadraticCurveTo(r * 0.4, r * 0.5, r * 0.82, r * 0.56); ctx.quadraticCurveTo(r * 0.6, r * 0.26, 0, r * 0.36); ctx.closePath(); paper(ctx, '#f6f1e6', 1.5);
  // the hinged jaw: a separate block that drops, with teeth
  const jy = h / 2 - r * 0.05;
  if (f.mouth > 0.05) { rr(ctx, -w * 0.36, jy - r * 0.1, w * 0.72, drop + r * 0.2, 3); fillOnly(ctx, MOUTH); }
  rr(ctx, -w / 2 + r * 0.1, jy + drop, w - r * 0.2, r * 0.46, r * 0.12); paper(ctx, shade(skin, -0.05), 1.8, shade(skin, -0.45));
  ctx.fillStyle = c('#fffaf0');
  for (let i = -3; i <= 3; i++) { ctx.fillRect(i * r * 0.2 - r * 0.08, jy + drop - r * 0.02, r * 0.16, r * 0.2); }
  if (f.mouth > 0.05) for (let i = -3; i <= 3; i++) ctx.fillRect(i * r * 0.2 - r * 0.08, jy - r * 0.06, r * 0.16, r * 0.16);
  if (f.smile < -0.5 && f.mouth < 0.1) { ctx.beginPath(); ctx.moveTo(-r * 0.5, jy + r * 0.18); ctx.quadraticCurveTo(0, jy - r * 0.06, r * 0.5, jy + r * 0.18); strokeOnly(ctx, DARK, 2); }
}

function tin(ctx, r, sp, f) {
  const P = sp.pal, metal = mix(P.body, '#cdd6de', 0.35), w = r * 1.62, h = r * 1.62;
  // winding key
  const spin = f.t * 1.2;
  ctx.strokeStyle = c('#7b8794'); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - r * 0.45); ctx.stroke();
  ctx.save(); ctx.translate(0, -h / 2 - r * 0.52); ctx.scale(Math.cos(spin), 1);
  for (const s of [-1, 1]) { ell(ctx, s * r * 0.3, 0, r * 0.3, r * 0.17); paper(ctx, P.accent, 1.6); }
  ctx.restore();
  for (const s of [-1, 1]) { star(ctx, s * (w / 2 + r * 0.05), r * 0.05, 8, r * 0.26, r * 0.19, f.t * 0.9 * s); paper(ctx, shade(P.accent, -0.1), 1.5); circle(ctx, s * (w / 2 + r * 0.05), r * 0.05, r * 0.08); fillOnly(ctx, DARK); }
  rr(ctx, -w / 2, -h / 2, w, h, r * 0.34);
  paper(ctx, f.back ? shade(metal, -0.2) : hfill(ctx, -w / 2, w / 2, metal, 0.2), 2.2, shade(metal, -0.5));
  if (f.back) return;
  ctx.fillStyle = c(rgba('#ffffff', 0.35)); ctx.fillRect(-w / 2 + r * 0.12, -h / 2 + r * 0.1, r * 0.1, h - r * 0.4);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(ctx, sx * (w / 2 - r * 0.16), sy * (h / 2 - r * 0.16), r * 0.05); fillOnly(ctx, shade(metal, -0.5)); }
  // lens eyes
  for (const s of [-1, 1]) {
    const x = s * r * 0.42, y = -r * 0.22, er = r * 0.28;
    circle(ctx, x, y, er); paper(ctx, '#223', 2, DARK);
    const open = clamp(f.eye * f.blink, 0.1, 1.3);
    ctx.save(); circle(ctx, x, y, er * 0.84); ctx.clip();
    circle(ctx, x + f.lookX * er * 0.3, y + f.lookY * er * 0.3, er * 0.7 * Math.min(1, open)); fillOnly(ctx, P.accent);
    star(ctx, x + f.lookX * er * 0.3, y + f.lookY * er * 0.3, 6, er * 0.55 * Math.min(1, open), er * 0.3, f.t * 2 * s); fillOnly(ctx, shade(P.accent, -0.35));
    ctx.fillStyle = c(rgba('#ffffff', 0.55)); ctx.fillRect(x - er, y - er, er * 2, er * 2 * (1 - Math.min(1, open)) * 0.5);
    ctx.restore();
    ell(ctx, x - er * 0.35, y - er * 0.4, er * 0.2, er * 0.12, -0.5); fillOnly(ctx, '#ffffffcc');
    brow(ctx, x, y - er - r * 0.1, r * 0.6, s < 0 ? f.browL : f.browR, (s < 0 ? f.raiseL : f.raiseR) * r * 0.16, '#334', 4.4, s);
  }
  // speaker-grille mouth: the lower slats drop with the jaw
  const my = r * 0.4, mh = r * 0.22 + f.mouth * r * 0.42;
  rr(ctx, -r * 0.62, my, r * 1.24, mh, 4); paper(ctx, f.mouth > 0.1 ? MOUTH : '#445', 1.8, DARK);
  ctx.fillStyle = c('#c8d2da');
  const slats = 5;
  for (let i = 0; i < slats; i++) ctx.fillRect(-r * 0.54 + i * (r * 1.08 / slats), my + 2, r * 0.1, Math.min(mh - 4, r * 0.18 + f.mouth * r * 0.1));
  if (f.smile > 0.4 && f.mouth < 0.1) { ctx.beginPath(); ctx.moveTo(-r * 0.55, my - r * 0.05); ctx.lineTo(-r * 0.4, my + r * 0.05); ctx.lineTo(r * 0.4, my + r * 0.05); ctx.lineTo(r * 0.55, my - r * 0.05); strokeOnly(ctx, DARK, 2); }
}

function shadow(ctx, r, sp, f) {
  const P = sp.pal, ink = '#1a1222';
  // smoky tendrils behind
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * r * 0.4, r * 0.4);
    ctx.quadraticCurveTo(i * r * 0.7 + Math.sin(f.t * 2 + i) * r * 0.2, r * 1.1, i * r * 0.55 + Math.sin(f.t * 1.6 + i * 2) * r * 0.25, r * 1.5);
    ctx.quadraticCurveTo(i * r * 0.3, r * 1.0, i * r * 0.2, r * 0.4); ctx.closePath();
    fillOnly(ctx, mix(ink, P.body, 0.3));
  }
  // cat-ear pointed silhouette head
  ctx.beginPath(); ctx.moveTo(-r * 0.92, r * 0.1);
  ctx.quadraticCurveTo(-r * 1.0, -r * 0.7, -r * 0.8, -r * 1.35); ctx.lineTo(-r * 0.3, -r * 0.85); ctx.quadraticCurveTo(0, -r * 0.95, r * 0.3, -r * 0.85); ctx.lineTo(r * 0.8, -r * 1.35);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.7, r * 0.92, r * 0.1); ctx.quadraticCurveTo(r * 0.6, r * 1.02, 0, r * 1.02); ctx.quadraticCurveTo(-r * 0.6, r * 1.02, -r * 0.92, r * 0.1); ctx.closePath();
  paper(ctx, hfill(ctx, -r, r, ink, 0.06), 2.2, mix(ink, P.accent, 0.45));
  if (f.back) return;
  // glowing slit eyes
  for (const s of [-1, 1]) {
    const open = clamp(f.eye * f.blink, 0.08, 1.35), x = s * r * 0.42, y = -r * 0.1;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ell(ctx, x, y, r * 0.24, r * 0.2 * open + 1.5, s * -0.25); fillOnly(ctx, '#fffbe6');
    ell(ctx, x + f.lookX * r * 0.07, y + f.lookY * r * 0.04, r * 0.07, r * 0.17 * Math.min(1, open) + 1); fillOnly(ctx, ink);
    ctx.restore();
    brow(ctx, x, y - r * 0.38, r * 0.5, s < 0 ? f.browL : f.browR, (s < 0 ? f.raiseL : f.raiseR) * r * 0.16, mix(P.accent, '#ffffff', 0.4), 3.4, s);
  }
  blush(ctx, r, r * 0.6, r * 0.3, f.blush * 0.5);
  // no mouth until it speaks: a white crescent
  if (f.mouth > 0.07 || f.smile > 0.3 || f.smile < -0.3) {
    const mh = r * (0.08 + 0.48 * f.mouth);
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.5); ctx.quadraticCurveTo(0, r * 0.5 + mh * 1.8 + f.smile * r * 0.25, r * 0.4, r * 0.5);
    ctx.quadraticCurveTo(0, r * 0.5 - mh * 0.2 - f.smile * r * 0.1, -r * 0.4, r * 0.5); ctx.closePath(); fillOnly(ctx, '#fffbe6');
  }
}

export const HEADS = { round, long, square, beak, sock, nutcracker, tin, shadow };
/** Approximate head-top offset (in r) per head, used for string attachment. */
export const HEAD_TOP = { round: 1.3, long: 1.45, square: 1.35, beak: 1.4, sock: 1.9, nutcracker: 2.9, tin: 1.55, shadow: 1.35 };

export function drawHead(ctx, sp, f) {
  const r = sp.geo.headR;
  (HEADS[sp.head] || round)(ctx, r, sp, f);
}
