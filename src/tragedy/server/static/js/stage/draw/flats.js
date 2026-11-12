// Painted paper flats: 12 sets x 3 parallax layers (backdrop, mid flat, near wings). Each (set, sky, palette, layer) is
// painted once into an offscreen canvas and then slid around in its groove. Region size is FLAT_W x FLAT_H (layers 0/1)
// or FLAT_W x WING_H (layer 2); x is relative to OPEN.x0 - FLAT_PAD, y to OPEN.y0.

import { OPEN, HORIZON_Y } from '../layout.js';
import { mix, shade, rgba, c } from '../color.js';
import { mulberry32, hashStr } from '../rng.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vgrad, hgrad, rgrad, glow, vfill, hfill } from './shapes.js';

export const FLAT_PAD = 80;
export const FLAT_W = OPEN.w + FLAT_PAD * 2;
export const FLAT_H = HORIZON_Y - OPEN.y0 + 16;     // 312
export const WING_H = OPEN.h;                       // 464

const SKY = { dawn: ['#f4b7a6', '#ffe5b4'], noon: ['#7fb7e6', '#e3f3fb'], dusk: ['#4b3a7a', '#f29e6b'], night: ['#120f2c', '#3a2f66'], storm: ['#2e2e44', '#6c6f86'] };
const DEFAULT_PAL = { sky: '#f6d28b', flat: '#e07a5f', floor: '#3d2c2e', accent: '#81b29a' };

function skyColors(skyName, pal) {
  const base = SKY[skyName] || SKY.dusk;
  return [mix(base[0], pal.sky, 0.22), mix(base[1], pal.sky, 0.3)];
}

function paintSky(ctx, x, y, w, h, skyName, pal, rnd, detail = true) {
  const [a, b] = skyColors(skyName, pal);
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, a], [1, b]]);
  ctx.fillRect(x, y, w, h);
  if (!detail) return;
  if (skyName === 'night') {
    for (let i = 0; i < 60; i++) { const sx = x + rnd() * w, sy = y + rnd() * h * 0.8, r = 1 + rnd() * 2; circle(ctx, sx, sy, r); fillOnly(ctx, `rgba(255,248,210,${0.4 + rnd() * 0.5})`); }
  } else if (skyName === 'storm') {
    for (let i = 0; i < 9; i++) cloud(ctx, x + rnd() * w, y + rnd() * h * 0.55, 90 + rnd() * 110, mix('#3a3a52', '#8a8aa0', rnd() * 0.5));
  } else {
    const n = skyName === 'noon' ? 6 : 4;
    for (let i = 0; i < n; i++) cloud(ctx, x + rnd() * w, y + 20 + rnd() * h * 0.5, 70 + rnd() * 90, skyName === 'dusk' ? '#e8a4a0' : '#ffffff');
    if (skyName === 'dawn' || skyName === 'dusk') { glow(ctx, x + w * 0.7, y + h * 0.95, 220, '#ffd08a', 0.55); }
  }
}

function cloud(ctx, cx, cy, w, col) {
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.75;
  for (const [dx, dy, r] of [[-0.3, 0.05, 0.22], [0, -0.08, 0.3], [0.3, 0.02, 0.24], [0.12, 0.1, 0.22], [-0.15, 0.12, 0.2]]) { ctx.beginPath(); ctx.arc(cx + dx * w, cy + dy * w, r * w * 0.5, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function hills(ctx, w, y, amp, col, seed, rough = 1) {
  const rnd = mulberry32(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  ctx.beginPath(); ctx.moveTo(0, y + 200);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y - Math.sin(x * 0.004 + ph[0]) * amp - Math.sin(x * 0.011 + ph[1]) * amp * 0.4 * rough - Math.sin(x * 0.027 + ph[2]) * amp * 0.12 * rough);
  ctx.lineTo(w, y + 200); ctx.closePath(); paper(ctx, col, 2);
}

function holeShape(ctx, fn) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; fn(); ctx.fill(); ctx.restore();
}

function bricks(ctx, x, y, w, h, bw, bh, col, seed) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = shade(col, -0.4); ctx.fillRect(x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
    for (let xx = x - (r % 2 ? bw / 2 : 0); xx < x + w; xx += bw) {
      const l = (rnd() - 0.5) * 0.18;
      ctx.fillStyle = shade(col, l); ctx.fillRect(Math.max(x, xx + 1.5), yy + 1.5, Math.min(bw - 3, x + w - xx - 1.5), bh - 3);
    }
  }
}

function wallpaper(ctx, x, y, w, h, col, accent, kind) {
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, shade(col, 0.04)], [1, shade(col, -0.14)]]); ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (kind === 'stripes') { for (let xx = x; xx < x + w; xx += 54) { ctx.fillStyle = rgba(accent, 0.13); ctx.fillRect(xx, y, 22, h); } }
  else if (kind === 'stars') { for (let yy = y + 20; yy < y + h; yy += 56) for (let xx = x + ((yy - y) % 112 ? 30 : 0); xx < x + w; xx += 60) { star(ctx, xx, yy, 5, 8, 3.5, -1.57); fillOnly(ctx, rgba(accent, 0.28)); } }
  else { for (let yy = y + 18; yy < y + h; yy += 48) for (let xx = x + (((yy - y) / 48) % 2 ? 24 : 0); xx < x + w; xx += 48) { ell(ctx, xx, yy, 7, 10); fillOnly(ctx, rgba(accent, 0.2)); ell(ctx, xx, yy - 13, 4, 5); fillOnly(ctx, rgba(accent, 0.15)); } }
  ctx.restore();
}

const wood = (pal) => mix(pal.floor, '#8a5a3c', 0.55);

function wainscot(ctx, x, y, w, h, pal) {
  const col = wood(pal);
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  for (let xx = x + 20; xx < x + w - 40; xx += 120) { rr(ctx, xx, y + 10, 96, h - 20, 4); ctx.lineWidth = 3; ctx.strokeStyle = shade(col, -0.35); ctx.stroke(); rr(ctx, xx + 6, y + 16, 84, h - 32, 3); ctx.lineWidth = 1.5; ctx.strokeStyle = shade(col, 0.2); ctx.stroke(); }
  ctx.fillStyle = shade(col, 0.22); ctx.fillRect(x, y - 6, w, 8);
  ctx.fillStyle = shade(col, -0.45); ctx.fillRect(x, y + 2, w, 3);
}

function windowFrame(ctx, x, y, w, h, arch = false, col = '#6a4430') {
  const p = () => { if (arch) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); } else rr(ctx, x, y, w, h, 4); };
  holeShape(ctx, p);
  p(); ctx.lineWidth = 7; ctx.strokeStyle = col; ctx.stroke();
  p(); ctx.lineWidth = 2; ctx.strokeStyle = shade(col, -0.45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + (arch ? 0 : 3)); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x + w, y + h * 0.55); strokeOnly(ctx, col, 4);
}

function drape(ctx, x, y, w, h, col, side) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.quadraticCurveTo(x + w * (side > 0 ? 0.2 : 0.8), y + h * 0.5, x + w * (side > 0 ? 0.9 : 0.1), y + h); ctx.lineTo(x, y + h); ctx.closePath();
  paper(ctx, hgrad(ctx, x, x + w, [[0, shade(col, -0.2)], [0.5, shade(col, 0.1)], [1, shade(col, -0.2)]]), 2, shade(col, -0.5));
}

function groundLine(ctx, w, h, col) {
  ctx.fillStyle = vgrad(ctx, h - 26, h, [[0, rgba(col, 0)], [1, rgba(col, 0.55)]]); ctx.fillRect(0, h - 26, w, 26);
}

// ---- layer painters ------------------------------------------------------------------------------------------------------
// Each receives (ctx, W, Hh, pal, sky, rnd).
const L0 = {};
const L1 = {};
const L2 = {};

const indoorSky = (ctx, w, h, pal, sky, rnd) => {
  paintSky(ctx, 0, 0, w, h, sky, pal, rnd);
  // distant roofline
  ctx.fillStyle = rgba('#1b0f1f', 0.55);
  let x = 0; while (x < w) { const bw = 50 + rnd() * 70, bh = 30 + rnd() * 90; ctx.fillRect(x, h - bh, bw, bh); if (rnd() > 0.5) { poly(ctx, [x, h - bh, x + bw / 2, h - bh - 22, x + bw, h - bh]); ctx.fill(); } x += bw + 6; }
};
const outdoorSky = (far) => (ctx, w, h, pal, sky, rnd) => {
  paintSky(ctx, 0, 0, w, h, sky, pal, rnd);
  hills(ctx, w, h - 40, 36, mix(far, skyColors(sky, pal)[1], 0.45), 11, 0.6);
};

L0.parlour = indoorSky; L0.corridor = indoorSky; L0.bedroom = indoorSky; L0.ballroom = indoorSky; L0.library = indoorSky; L0.attic = indoorSky;
L0.cellar = (ctx, w, h) => { ctx.fillStyle = '#0d070f'; ctx.fillRect(0, 0, w, h); glow(ctx, w / 2, h * 0.9, 320, '#6a4575', 0.35); };
L0.moor = outdoorSky('#4d3a5a'); L0.graveyard = outdoorSky('#2d2238'); L0.garden = outdoorSky('#6a9a6a');
L0.castle = (ctx, w, h, pal, sky, rnd) => {
  outdoorSky('#5a4a6a')(ctx, w, h, pal, sky, rnd);
  // far towers
  for (const [x, th] of [[w * 0.2, 130], [w * 0.5, 170], [w * 0.8, 120]]) { ctx.fillStyle = rgba('#2a1d3a', 0.7); ctx.fillRect(x - 24, h - th, 48, th); poly(ctx, [x - 32, h - th, x, h - th - 44, x + 32, h - th]); ctx.fill(); }
};
L0.harbour = (ctx, w, h, pal, sky, rnd) => {
  paintSky(ctx, 0, 0, w, h * 0.78, sky, pal, rnd);
  ctx.fillStyle = vgrad(ctx, h * 0.78, h, [[0, mix('#3d6a82', skyColors(sky, pal)[1], 0.35)], [1, '#2a4a62']]); ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // far lighthouse
  const lx = w * 0.82; poly(ctx, [lx - 12, h * 0.78, lx + 12, h * 0.78, lx + 7, h * 0.28, lx - 7, h * 0.28]); paper(ctx, '#f0e8da', 1.6);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = c(CRIMSON()); ctx.fillRect(lx - 11 + i * 0.6, h * 0.34 + i * 44, 22 - i * 3, 14); }
  rr(ctx, lx - 11, h * 0.2, 22, 18, 3); paper(ctx, '#ffe08a', 1.4); glow(ctx, lx, h * 0.26, 130, '#ffe08a', 0.45);
};
L0.stage = (ctx, w, h, pal, sky, rnd) => {
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#2a1630'], [1, '#4d2e58']]); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { star(ctx, rnd() * w, rnd() * h, 5, 5 + rnd() * 8, 2.5, rnd() * 3); fillOnly(ctx, rgba('#f7dc8c', 0.35 + rnd() * 0.4)); }
  // painted sun
  circle(ctx, w * 0.5, h * 0.86, 120); fillOnly(ctx, rgba('#f2c14e', 0.35));
  circle(ctx, w * 0.5, h * 0.86, 84); fillOnly(ctx, rgba('#f7dc8c', 0.45));
};
const CRIMSON = () => '#b3263d';

// ---- mid flats ----
L1.parlour = (ctx, w, h, pal) => {
  wallpaper(ctx, 0, 0, w, h, mix(pal.flat, '#2a1630', 0.45), pal.accent, 'damask');
  wainscot(ctx, 0, h - 96, w, 96, pal);
  windowFrame(ctx, w * 0.22, 40, 120, 150);
  drape(ctx, w * 0.22 - 36, 28, 40, 170, '#b3263d', 1); drape(ctx, w * 0.22 + 116, 28, 40, 170, '#b3263d', -1);
  // fireplace
  const fx = w * 0.62;
  rr(ctx, fx - 100, h - 190, 200, 106, 6); paper(ctx, '#5a3a2e', 2.2);
  rr(ctx, fx - 66, h - 168, 132, 84, 4); paper(ctx, '#140a10', 1.8);
  glow(ctx, fx, h - 108, 80, '#ff9a3c', 0.7);
  rr(ctx, fx - 118, h - 202, 236, 16, 4); paper(ctx, shade('#5a3a2e', 0.2), 1.8);
  // portrait
  rr(ctx, fx - 56, 28, 112, 116, 6); paper(ctx, '#e9b949', 2.6, '#a97c1f');
  rr(ctx, fx - 46, 38, 92, 96, 3); paper(ctx, mix(pal.accent, '#2a1630', 0.5), 1.4);
  circle(ctx, fx, 74, 22); paper(ctx, '#e8c9a0', 1.4); poly(ctx, [fx - 38, 134, fx - 30, 100, fx + 30, 100, fx + 38, 134]); paper(ctx, '#3d405b', 1.4);
  // small frames
  for (const [x, y] of [[w * 0.4, 70], [w * 0.84, 60], [w * 0.92, 100]]) { rr(ctx, x, y, 44, 56, 4); paper(ctx, '#e9b949', 2); rr(ctx, x + 6, y + 6, 32, 44, 2); paper(ctx, mix(pal.flat, '#f6ecd6', 0.6), 1); }
};
L1.corridor = (ctx, w, h, pal) => {
  const wall = mix(pal.flat, '#2a1630', 0.5);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, shade(wall, 0.05)], [1, shade(wall, -0.2)]]); ctx.fillRect(0, 0, w, h);
  // back doorway (hole) and receding doors each side
  const cx = w / 2;
  holeShape(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - 70, h); ctx.lineTo(cx - 70, 100); ctx.arc(cx, 100, 70, Math.PI, 0); ctx.lineTo(cx + 70, h); ctx.closePath(); });
  ctx.beginPath(); ctx.moveTo(cx - 70, h); ctx.lineTo(cx - 70, 100); ctx.arc(cx, 100, 70, Math.PI, 0); ctx.lineTo(cx + 70, h); ctx.lineWidth = 8; ctx.strokeStyle = wood(pal); ctx.stroke();
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = cx + s * (150 + i * 150), dh = 168 - i * 4;
    rr(ctx, x - 44, h - dh - 18, 88, dh + 18, 6); paper(ctx, wood(pal), 2.2);
    rr(ctx, x - 36, h - dh - 10, 72, dh + 10, 4); paper(ctx, [pal.accent, '#b3263d', '#4fb3a5', '#e0a82e'][(i + (s > 0 ? 2 : 0)) % 4], 1.6);
    circle(ctx, x + s * -22, h - dh * 0.45, 5); paper(ctx, '#e9b949', 1.2);
    ctx.fillStyle = c(rgba('#ffffff', 0.18)); ctx.fillRect(x - 28, h - dh - 2, 26, 6);
  }
  // wall sconces
  for (const x of [cx - 80, cx + 80, w * 0.2, w * 0.8]) { glow(ctx, x, 60, 56, '#ffcf70', 0.5); rr(ctx, x - 5, 58, 10, 22, 3); paper(ctx, '#e9b949', 1.3); ell(ctx, x, 52, 4, 8); fillOnly(ctx, '#ffd36e'); }
  wainscot(ctx, 0, h - 56, w, 56, pal);
};
L1.bedroom = (ctx, w, h, pal) => {
  wallpaper(ctx, 0, 0, w, h, mix(pal.flat, '#2a1630', 0.4), pal.accent, 'stars');
  wainscot(ctx, 0, h - 70, w, 70, pal);
  windowFrame(ctx, w * 0.5 - 70, 38, 140, 170, true);
  drape(ctx, w * 0.5 - 112, 24, 44, 190, pal.accent, 1); drape(ctx, w * 0.5 + 68, 24, 44, 190, pal.accent, -1);
  // wardrobe
  const wx = w * 0.14;
  rr(ctx, wx - 64, 36, 128, h - 100, 6); paper(ctx, vfill(ctx, 36, h, '#8a5a3c', 0.1), 2.4);
  for (const s of [-1, 1]) { rr(ctx, wx + s * 31 - 28, 52, 56, h - 134, 4); paper(ctx, '#9b6a46', 1.6); circle(ctx, wx + s * 8, h * 0.45, 4); paper(ctx, '#e9b949', 1.2); }
  poly(ctx, [wx - 74, 36, wx + 74, 36, wx + 64, 22, wx - 64, 22]); paper(ctx, '#6a4430', 1.8);
  // pictures
  for (const x of [w * 0.8, w * 0.9]) { rr(ctx, x, 70, 54, 70, 4); paper(ctx, '#e9b949', 2); rr(ctx, x + 6, 76, 42, 58, 2); paper(ctx, mix(pal.accent, '#f6ecd6', 0.5), 1); }
};
L1.cellar = (ctx, w, h, pal) => {
  bricks(ctx, 0, 0, w, h, 70, 34, mix('#6a5a6a', pal.flat, 0.15), 5);
  for (const x of [w * 0.25, w * 0.5, w * 0.75]) {
    holeShape(ctx, () => { ctx.beginPath(); ctx.moveTo(x - 60, h); ctx.lineTo(x - 60, 130); ctx.arc(x, 130, 60, Math.PI, 0); ctx.lineTo(x + 60, h); ctx.closePath(); });
    ctx.beginPath(); ctx.moveTo(x - 60, h); ctx.lineTo(x - 60, 130); ctx.arc(x, 130, 60, Math.PI, 0); ctx.lineTo(x + 60, h); ctx.lineWidth = 9; ctx.strokeStyle = '#3d3340'; ctx.stroke();
  }
  // shelf with barrels
  rr(ctx, w * 0.06, 150, 190, 10, 2); paper(ctx, '#6a4430', 1.6);
  for (const x of [w * 0.07, w * 0.12]) { ell(ctx, x + 30, 128, 24, 22); paper(ctx, '#8a5a3c', 2); ctx.beginPath(); ctx.moveTo(x + 8, 120); ctx.lineTo(x + 52, 120); ctx.moveTo(x + 8, 136); ctx.lineTo(x + 52, 136); strokeOnly(ctx, '#3a2a2e', 3); }
  for (const x of [w * 0.86, w * 0.93]) { circle(ctx, x, 120, 5); fillOnly(ctx, '#2a1a22'); ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 114); strokeOnly(ctx, '#2a1a22', 2); }
  // cobweb
  ctx.strokeStyle = c('rgba(255,255,255,.35)'); ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(w - 4, 0); ctx.lineTo(w - 120 + i * 14, 120 - i * 4); ctx.stroke(); }
  for (let r = 1; r < 5; r++) { ctx.beginPath(); ctx.arc(w - 4, 0, r * 26, 1.55, 3.1); ctx.stroke(); }
};
L1.moor = (ctx, w, h, pal) => {
  hills(ctx, w, h - 70, 40, mix('#4a3d5a', pal.floor, 0.3), 21);
  hills(ctx, w, h - 20, 34, mix('#3a3050', pal.floor, 0.35), 22, 1.4);
  // crooked tree + fence
  const tx = w * 0.7;
  ctx.beginPath(); ctx.moveTo(tx, h); ctx.bezierCurveTo(tx - 14, h - 80, tx + 20, h - 130, tx + 4, h - 190); ctx.lineWidth = 14; ctx.strokeStyle = c('#1b1220'); ctx.stroke();
  for (const [dx, dy, ex, ey] of [[4, 150, -50, 190], [6, 130, 50, 182], [0, 100, -34, 128]]) { ctx.beginPath(); ctx.moveTo(tx + dx, h - dy); ctx.quadraticCurveTo(tx + (dx + ex) / 2, h - dy - 24, tx + ex, h - ey); ctx.lineWidth = 6; ctx.stroke(); }
  for (let x = w * 0.08; x < w * 0.4; x += 38) { rr(ctx, x, h - 60 + Math.sin(x) * 4, 7, 50, 2); paper(ctx, '#2a2030', 1.3); }
  ctx.beginPath(); ctx.moveTo(w * 0.08, h - 42); ctx.lineTo(w * 0.4, h - 38); ctx.moveTo(w * 0.08, h - 24); ctx.lineTo(w * 0.4, h - 22); strokeOnly(ctx, '#2a2030', 4);
  // heather dots
  const rnd = mulberry32(7); for (let i = 0; i < 70; i++) { circle(ctx, rnd() * w, h - 8 - rnd() * 40, 2 + rnd() * 3); fillOnly(ctx, rgba(mix('#8a5a9a', pal.accent, rnd() * 0.5), 0.8)); }
};
L1.ballroom = (ctx, w, h, pal) => {
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, mix(pal.flat, '#1b0f1f', 0.55)], [1, mix(pal.flat, '#1b0f1f', 0.7)]]); ctx.fillRect(0, 0, w, h);
  const n = 5;
  for (let i = 0; i < n; i++) { const x = (w * (i + 0.5)) / n; windowFrame(ctx, x - 52, 30, 104, h - 56, true, '#e9b949'); }
  for (let i = 0; i <= n; i++) { const x = (w * i) / n; rr(ctx, x - 14, 0, 28, h, 3); paper(ctx, vfill(ctx, 0, h, '#e9b949', 0.15), 1.8, '#a97c1f'); ctx.strokeStyle = c('rgba(70,40,5,.35)'); ctx.lineWidth = 2; for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + dx, 12); ctx.lineTo(x + dx, h - 12); ctx.stroke(); } }
  // swags between pilasters
  for (let i = 0; i < n; i++) { const x0 = (w * i) / n + 14, x1 = (w * (i + 1)) / n - 14; ctx.beginPath(); ctx.moveTo(x0, 6); ctx.quadraticCurveTo((x0 + x1) / 2, 60, x1, 6); ctx.lineTo(x1, 0); ctx.lineTo(x0, 0); ctx.closePath(); paper(ctx, '#b3263d', 1.6); }
  ctx.fillStyle = vgrad(ctx, h - 40, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.4)']]); ctx.fillRect(0, h - 40, w, 40);
};
L1.graveyard = (ctx, w, h, pal) => {
  hills(ctx, w, h - 50, 30, '#251a30', 31);
  // iron fence
  ctx.fillStyle = c('#15101c'); ctx.fillRect(0, h - 70, w, 5); ctx.fillRect(0, h - 36, w, 5);
  for (let x = 6; x < w; x += 26) { poly(ctx, [x - 3, h - 8, x + 3, h - 8, x + 3, h - 84, x, h - 98, x - 3, h - 84]); paper(ctx, '#15101c', 0); }
  // stones
  const rnd = mulberry32(3);
  for (const x of [w * 0.18, w * 0.3, w * 0.52, w * 0.74, w * 0.88]) { const th = 60 + rnd() * 40, tw = 36 + rnd() * 16; ctx.beginPath(); ctx.moveTo(x - tw / 2, h - 8); ctx.lineTo(x - tw / 2, h - th); ctx.arc(x, h - th, tw / 2, Math.PI, 0); ctx.lineTo(x + tw / 2, h - 8); ctx.closePath(); paper(ctx, mix('#7d7a8a', pal.floor, 0.2), 2); ctx.beginPath(); ctx.moveTo(x - 7, h - th - 4); ctx.lineTo(x + 7, h - th - 4); ctx.moveTo(x, h - th - 12); ctx.lineTo(x, h - th + 14); strokeOnly(ctx, 'rgba(30,20,40,.55)', 3); }
  // bare trees
  for (const tx of [w * 0.08, w * 0.62]) { ctx.beginPath(); ctx.moveTo(tx, h); ctx.quadraticCurveTo(tx + 10, h - 120, tx - 4, h - 200); ctx.lineWidth = 12; ctx.strokeStyle = c('#120d18'); ctx.stroke(); for (const [ex, ey] of [[-50, 230], [44, 220], [-30, 180], [34, 168]]) { ctx.beginPath(); ctx.moveTo(tx + (ex > 0 ? 2 : -2), h - ey + 46); ctx.quadraticCurveTo(tx + ex * 0.6, h - ey + 18, tx + ex, h - ey); ctx.lineWidth = 5; ctx.stroke(); } }
};
L1.castle = (ctx, w, h, pal) => {
  const stone = mix('#8a8296', pal.flat, 0.15);
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, 74); for (let x = 0; x < w; x += 56) { ctx.lineTo(x, 74); ctx.lineTo(x, 48); ctx.lineTo(x + 34, 48); ctx.lineTo(x + 34, 74); ctx.lineTo(x + 56, 74); } ctx.lineTo(w, h); ctx.closePath();
  paper(ctx, stone, 2.4);
  ctx.save(); ctx.clip(); bricks(ctx, 0, 74, w, h, 60, 30, stone, 8); ctx.restore();
  holeShape(ctx, () => { ctx.beginPath(); ctx.moveTo(w / 2 - 90, h); ctx.lineTo(w / 2 - 90, 150); ctx.arc(w / 2, 150, 90, Math.PI, 0); ctx.lineTo(w / 2 + 90, h); ctx.closePath(); });
  ctx.beginPath(); ctx.moveTo(w / 2 - 90, h); ctx.lineTo(w / 2 - 90, 150); ctx.arc(w / 2, 150, 90, Math.PI, 0); ctx.lineTo(w / 2 + 90, h); ctx.lineWidth = 12; ctx.strokeStyle = shade(stone, -0.35); ctx.stroke();
  // portcullis
  ctx.strokeStyle = c('#2a2430'); ctx.lineWidth = 5; for (let x = w / 2 - 70; x <= w / 2 + 70; x += 28) { ctx.beginPath(); ctx.moveTo(x, 80); ctx.lineTo(x, 130); ctx.stroke(); }
  for (const x of [w * 0.2, w * 0.8]) { rr(ctx, x - 20, 100, 40, 120, 2); paper(ctx, pal.accent, 1.6); poly(ctx, [x - 20, 220, x + 20, 220, x, 250]); paper(ctx, pal.accent, 1.6); star(ctx, x, 150, 5, 12, 5, -1.57); fillOnly(ctx, '#f7dc8c'); }
  for (const x of [w * 0.38, w * 0.62]) { rr(ctx, x - 3, 160, 6, 24, 2); paper(ctx, '#3a2a2e', 1.2); glow(ctx, x, 150, 50, '#ff9a3c', 0.6); ell(ctx, x, 150, 5, 11); fillOnly(ctx, '#ffb347'); }
};
L1.garden = (ctx, w, h, pal) => {
  hills(ctx, w, h - 60, 22, '#6aa05a', 41, 0.5);
  // hedge wall
  const hedge = mix('#4f8a4a', pal.accent, 0.2);
  rr(ctx, 0, h - 150, w, 150, 10); paper(ctx, hedge, 2.4);
  const rnd = mulberry32(5); for (let i = 0; i < 120; i++) { circle(ctx, rnd() * w, h - 150 + rnd() * 140, 6 + rnd() * 8); fillOnly(ctx, rgba(shade(hedge, (rnd() - 0.5) * 0.3), 0.7)); }
  // arch gate
  const gx = w / 2;
  holeShape(ctx, () => { ctx.beginPath(); ctx.moveTo(gx - 70, h); ctx.lineTo(gx - 70, h - 130); ctx.arc(gx, h - 130, 70, Math.PI, 0); ctx.lineTo(gx + 70, h); ctx.closePath(); });
  ctx.beginPath(); ctx.moveTo(gx - 70, h); ctx.lineTo(gx - 70, h - 130); ctx.arc(gx, h - 130, 70, Math.PI, 0); ctx.lineTo(gx + 70, h); ctx.lineWidth = 10; ctx.strokeStyle = c(shade(hedge, -0.3)); ctx.stroke();
  // topiary + roses
  for (const x of [w * 0.2, w * 0.8]) { rr(ctx, x - 5, h - 60, 10, 60, 2); paper(ctx, '#6a4430', 1.4); circle(ctx, x, h - 92, 30); paper(ctx, '#5d9a48', 2); circle(ctx, x, h - 140, 20); paper(ctx, '#6aa853', 2); }
  for (let i = 0; i < 14; i++) { const x = w * 0.28 + i * 26 + (i % 2) * 6, y = h - 110 - (i % 3) * 14; circle(ctx, x, y, 6); paper(ctx, ['#d8546b', '#f2c14e', '#ee6c4d'][i % 3], 1.2); }
};
L1.library = (ctx, w, h, pal) => {
  ctx.fillStyle = '#2a1a22'; ctx.fillRect(0, 0, w, h);
  const rnd = mulberry32(9), cols = ['#b3263d', '#4fb3a5', '#e9b949', '#6a4575', '#7bb661', '#ee6c4d', '#34495e', '#d8546b'];
  for (let row = 0; row < 5; row++) {
    const y = 10 + row * 60;
    ctx.fillStyle = c('#6a4430'); ctx.fillRect(0, y + 52, w, 8);
    for (let x = 0; x < w;) { const bw = 12 + rnd() * 16, bh = 36 + rnd() * 16; ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]; rr(ctx, x, y + 52 - bh, bw, bh, 2); ctx.fill(); ctx.strokeStyle = c('rgba(0,0,0,.4)'); ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = c(rgba('#f7dc8c', 0.55)); ctx.fillRect(x + 2, y + 52 - bh + 8, bw - 4, 3); x += bw + 1; }
  }
  holeShape(ctx, () => { ctx.beginPath(); ctx.arc(w * 0.5, 120, 56, 0, 6.3); });
  ctx.beginPath(); ctx.arc(w * 0.5, 120, 56, 0, 6.3); ctx.lineWidth = 12; ctx.strokeStyle = c('#e9b949'); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.5, 64); ctx.lineTo(w * 0.5, 176); ctx.moveTo(w * 0.5 - 56, 120); ctx.lineTo(w * 0.5 + 56, 120); strokeOnly(ctx, '#e9b949', 5);
  // rail + ladder
  ctx.fillStyle = c('#e9b949'); ctx.fillRect(0, 98, w, 5);
  for (const s of [-1, 1]) { rr(ctx, w * 0.2 + s * 20 - 4, 98, 8, h - 98, 2); paper(ctx, '#8a5a3c', 1.4); }
  for (let i = 0; i < 4; i++) { ctx.fillStyle = c('#9b6a46'); ctx.fillRect(w * 0.2 - 20, 130 + i * 44, 40, 6); }
};
L1.attic = (ctx, w, h, pal) => {
  // raftered roof: board wall with a triangular gap showing the sky
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#4a3328'], [1, '#6a4a38']]); ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 46) { ctx.fillStyle = c(rgba('#000', 0.16)); ctx.fillRect(x, 0, 3, h); }
  holeShape(ctx, () => { ctx.beginPath(); ctx.arc(w * 0.5, 130, 62, 0, 6.3); });
  ctx.beginPath(); ctx.arc(w * 0.5, 130, 62, 0, 6.3); ctx.lineWidth = 11; ctx.strokeStyle = c('#2a1a22'); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.5, 68); ctx.lineTo(w * 0.5, 192); ctx.moveTo(w * 0.5 - 62, 130); ctx.lineTo(w * 0.5 + 62, 130); strokeOnly(ctx, '#2a1a22', 5);
  for (const [x0, x1] of [[0, w * 0.5], [w, w * 0.5]]) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineWidth = 16; ctx.strokeStyle = c('#2a1a22'); ctx.stroke(); }
  for (const x of [w * 0.14, w * 0.3, w * 0.7, w * 0.86]) { rr(ctx, x - 7, 0, 14, h, 2); paper(ctx, '#3a2418', 1.4); }
  // bunting
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(w * 0.25, 90, w * 0.5 - 70, 40); strokeOnly(ctx, '#2a1a22', 2);
  for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, x = t * (w * 0.5 - 70), y = 30 + Math.sin(t * Math.PI) * 38 + 4; poly(ctx, [x - 9, y, x + 9, y, x, y + 22]); paper(ctx, [pal.accent, '#e9b949', '#d8546b'][i % 3], 1.2); }
  // hanging dust sheets
  for (const x of [w * 0.22, w * 0.78]) { ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 36, 150); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(x + 36 - i * 18 - 9, 164, x + 36 - (i + 1) * 18, 150); ctx.closePath(); paper(ctx, '#e8e0d0', 1.8, '#a89f88'); }
};
L1.harbour = (ctx, w, h, pal) => {
  // sea bands
  const sea = mix('#3d6a82', pal.accent, 0.15);
  ctx.fillStyle = vgrad(ctx, h - 150, h, [[0, sea], [1, shade(sea, -0.3)]]); ctx.fillRect(0, h - 150, w, 150);
  ctx.strokeStyle = c(rgba('#ffffff', 0.3)); ctx.lineWidth = 2.4;
  for (let r = 0; r < 6; r++) for (let x = (r % 2) * 20; x < w; x += 54) { ctx.beginPath(); ctx.arc(x, h - 130 + r * 22, 16, 3.6, 5.8); ctx.stroke(); }
  // boat with sail
  const bx = w * 0.3;
  poly(ctx, [bx - 70, h - 118, bx + 70, h - 118, bx + 50, h - 82, bx - 50, h - 82]); paper(ctx, '#8a5a3c', 2.2);
  rr(ctx, bx - 3, h - 250, 6, 134, 2); paper(ctx, '#3a2a2e', 1.4);
  poly(ctx, [bx + 6, h - 244, bx + 6, h - 130, bx + 66, h - 130]); paper(ctx, '#f6ecd6', 1.8, '#b9a98a');
  poly(ctx, [bx - 6, h - 230, bx - 6, h - 130, bx - 46, h - 130]); paper(ctx, pal.accent, 1.8);
  // pier
  rr(ctx, w * 0.56, h - 150, w * 0.44, 14, 2); paper(ctx, '#6a4430', 1.8);
  for (let x = w * 0.58; x < w; x += 70) { rr(ctx, x, h - 138, 14, 112, 2); paper(ctx, '#4a3028', 1.5); }
  // crates
  for (const [x, y] of [[w * 0.66, 0], [w * 0.7, 0], [w * 0.68, 34]]) { rr(ctx, x, h - 190 - y, 36, 36, 2); paper(ctx, '#a06f48', 1.8); ctx.beginPath(); ctx.moveTo(x, h - 190 - y); ctx.lineTo(x + 36, h - 154 - y); ctx.moveTo(x + 36, h - 190 - y); ctx.lineTo(x, h - 154 - y); strokeOnly(ctx, '#6a4430', 2.4); }
  // gulls
  for (const [x, y] of [[w * 0.45, 50], [w * 0.5, 74], [w * 0.1, 66]]) { ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x - 7, y - 10, x, y); ctx.quadraticCurveTo(x + 7, y - 10, x + 14, y); strokeOnly(ctx, '#f6ecd6', 2.6); }
};
L1.stage = (ctx, w, h, pal) => {
  // painted cardboard skyline cut-outs
  const rnd = mulberry32(13);
  for (let x = 20; x < w - 40;) {
    const bw = 70 + rnd() * 70, bh = 90 + rnd() * 120, col = [pal.flat, pal.accent, '#e9b949', '#b8a1e3', '#4fb3a5'][Math.floor(rnd() * 5)];
    rr(ctx, x, h - bh, bw, bh, 4); paper(ctx, mix(col, '#2a1630', 0.35), 2.2);
    for (let wy = h - bh + 18; wy < h - 22; wy += 30) for (let wx = x + 12; wx < x + bw - 18; wx += 26) { rr(ctx, wx, wy, 14, 18, 2); fillOnly(ctx, rgba('#ffe08a', 0.8)); }
    if (rnd() > 0.5) { poly(ctx, [x - 4, h - bh, x + bw / 2, h - bh - 36, x + bw + 4, h - bh]); paper(ctx, mix(col, '#2a1630', 0.15), 2); }
    x += bw + 10;
  }
  // painted scaffold supports (the flats are propped from behind)
  ctx.strokeStyle = c('rgba(255,255,255,.12)'); ctx.lineWidth = 2; for (let x = 60; x < w; x += 240) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 40, 24); ctx.stroke(); }
};

// ---- near wings ----
const wingBase = (ctx, w, h, side, col) => {
  // a flat with a groove shadow at its inner edge
  const x0 = side < 0 ? 0 : w - 230;
  const g = hgrad(ctx, x0, x0 + 230, side < 0 ? [[0, shade(col, -0.35)], [0.8, shade(col, -0.1)], [1, rgba(shade(col, -0.2), 0)]] : [[0, rgba(shade(col, -0.2), 0)], [0.2, shade(col, -0.1)], [1, shade(col, -0.35)]]);
  ctx.fillStyle = g; ctx.fillRect(x0, 0, 230, h);
  return x0;
};

L2.parlour = (ctx, w, h, pal) => { // fern + lamp
  const x = FLAT_PAD + 40; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x, h - 130); ctx.quadraticCurveTo(x + k * 28, h - 250 + Math.abs(k) * 18, x + k * 44, h - 190 + Math.abs(k) * 30); ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.strokeStyle = c(k % 2 ? '#4f8a4a' : '#6aa853'); ctx.stroke(); }
  poly(ctx, [x - 36, h - 130, x + 36, h - 130, x + 26, h - 56, x - 26, h - 56]); paper(ctx, '#b3263d', 2.2); rr(ctx, x - 40, h - 138, 80, 12, 4); paper(ctx, '#e9b949', 1.6);
  const lx = w - FLAT_PAD - 40; rr(ctx, lx - 4, h - 280, 8, 230, 2); paper(ctx, '#3a2a2e', 1.4); ell(ctx, lx, h - 56, 26, 8); paper(ctx, '#3a2a2e', 1.4);
  glow(ctx, lx, h - 292, 120, '#ffcf70', 0.4); poly(ctx, [lx - 32, h - 280, lx + 32, h - 280, lx + 22, h - 330, lx - 22, h - 330]); paper(ctx, 'rgba(255,225,160,.95)', 2, '#8a5a3c');
};
L2.corridor = (ctx, w, h, pal) => { // big near door frames
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 10 : w - FLAT_PAD - 10; rr(ctx, x - 64, 40, 128, h - 40, 6); paper(ctx, wood(pal), 2.6); rr(ctx, x - 52, 52, 104, h - 52, 4); paper(ctx, shade(wood(pal), -0.3), 1.8); }
};
L2.bedroom = (ctx, w, h, pal) => { // folding screen + bedpost
  const x = FLAT_PAD + 20; for (let i = 0; i < 3; i++) { rr(ctx, x + i * 54 - 74, h - 330 + Math.abs(i - 1) * 8, 52, 280, 4); paper(ctx, mix(pal.accent, '#f6ecd6', 0.4), 2); for (let k = 0; k < 3; k++) { circle(ctx, x + i * 54 - 48, h - 280 + k * 70, 14); paper(ctx, ['#d8546b', '#f2c14e', '#ee6c4d'][(i + k) % 3], 1.2); } }
  const bx = w - FLAT_PAD - 30; rr(ctx, bx - 14, h - 360, 28, 330, 6); paper(ctx, '#8a5a3c', 2.2); circle(ctx, bx, h - 368, 22); paper(ctx, '#e9b949', 1.8);
};
L2.cellar = (ctx, w, h, pal) => { // wine rack + pillar
  const x = FLAT_PAD + 6; rr(ctx, x - 70, h - 320, 150, 270, 4); paper(ctx, '#4a3028', 2.2);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { circle(ctx, x - 44 + k * 44, h - 284 + r * 62, 17); paper(ctx, '#140a10', 1.4); ell(ctx, x - 44 + k * 44, h - 284 + r * 62, 8, 12, 1.5); fillOnly(ctx, '#3f8a5a'); }
  const px = w - FLAT_PAD - 24; rr(ctx, px - 40, 0, 80, h, 4); paper(ctx, hgrad(ctx, px - 40, px + 40, [[0, '#4a4252'], [0.4, '#7a7088'], [1, '#3a3442']]), 2.4);
  rr(ctx, px - 52, 0, 104, 30, 4); paper(ctx, '#5a5264', 2);
};
L2.moor = (ctx, w, h, pal) => { // standing stone + thorn bush
  const x = FLAT_PAD + 30; ctx.beginPath(); ctx.moveTo(x - 46, h - 40); ctx.lineTo(x - 36, h - 270); ctx.quadraticCurveTo(x, h - 300, x + 30, h - 260); ctx.lineTo(x + 46, h - 40); ctx.closePath(); paper(ctx, hgrad(ctx, x - 46, x + 46, [[0, '#5d5870'], [1, '#2f2a3c']]), 2.4);
  const bx = w - FLAT_PAD - 20; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(bx, h - 40); ctx.quadraticCurveTo(bx - 60 + i * 14, h - 120 - (i % 3) * 30, bx - 90 + i * 22, h - 150 - (i % 4) * 22); ctx.lineWidth = 5; ctx.strokeStyle = c('#1b1220'); ctx.lineCap = 'round'; ctx.stroke(); }
  for (let i = 0; i < 12; i++) { circle(ctx, bx - 80 + (i % 6) * 26, h - 130 - (i % 4) * 18, 5); fillOnly(ctx, '#8a5a9a'); }
};
L2.ballroom = (ctx, w, h, pal) => { // columns with ferns
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 14 : w - FLAT_PAD - 14; rr(ctx, x - 34, 24, 68, h - 60, 4); paper(ctx, hgrad(ctx, x - 34, x + 34, [[0, '#d9cbb0'], [0.45, '#fffaf0'], [1, '#bfae90']]), 2.2, '#8a7a5c'); for (const dx of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(x + dx, 60); ctx.lineTo(x + dx, h - 60); strokeOnly(ctx, 'rgba(90,70,40,.22)', 2.5); } rr(ctx, x - 46, 6, 92, 28, 4); paper(ctx, '#e9b949', 2); rr(ctx, x - 46, h - 52, 92, 24, 4); paper(ctx, '#e9b949', 2); }
};
L2.graveyard = (ctx, w, h, pal) => { // big stone angel-ish cross + dead branch
  const x = FLAT_PAD + 30; rr(ctx, x - 22, h - 300, 44, 260, 4); paper(ctx, '#6a6578', 2.2); rr(ctx, x - 62, h - 250, 124, 40, 4); paper(ctx, '#6a6578', 2.2); rr(ctx, x - 40, h - 60, 80, 20, 3); paper(ctx, '#4a4558', 2);
  const bx = w - FLAT_PAD - 10; ctx.lineCap = 'round'; for (const [a, b, d] of [[0, -330, 90], [-40, -250, 70], [20, -170, 60]]) { ctx.beginPath(); ctx.moveTo(bx + 60, h - 30); ctx.quadraticCurveTo(bx + a, h + b / 2 + 80, bx - d, h + b + 90); ctx.lineWidth = 12 - Math.abs(a) * 0.05; ctx.strokeStyle = c('#120d18'); ctx.stroke(); }
};
L2.castle = (ctx, w, h, pal) => { // tower edge + torch
  const x = FLAT_PAD; const stone = '#8a8296'; rr(ctx, x - 110, 40, 200, h - 40, 4); paper(ctx, hgrad(ctx, x - 110, x + 90, [[0, shade(stone, -0.2)], [1, shade(stone, 0.05)]]), 2.4);
  ctx.save(); rr(ctx, x - 110, 40, 200, h - 40, 4); ctx.clip(); bricks(ctx, x - 110, 40, 200, h, 50, 28, stone, 4); ctx.restore();
  for (let i = 0; i < 4; i++) { rr(ctx, x - 108 + i * 52, 20, 36, 28, 2); paper(ctx, stone, 2); }
  const tx = w - FLAT_PAD - 24; rr(ctx, tx - 5, h - 360, 10, 80, 2); paper(ctx, '#3a2a2e', 1.4); glow(ctx, tx, h - 380, 100, '#ff9a3c', 0.6); ell(ctx, tx, h - 382, 12, 26); fillOnly(ctx, '#ff9a2e'); ell(ctx, tx, h - 378, 6, 14); fillOnly(ctx, '#ffe08a');
};
L2.garden = (ctx, w, h, pal) => { // rose bushes + pots
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 20 : w - FLAT_PAD - 20; const rnd = mulberry32(side + 5); circle(ctx, x, h - 150, 64); paper(ctx, '#4f8a4a', 2.4); circle(ctx, x - side * 40, h - 120, 46); paper(ctx, '#5d9a48', 2.4); for (let i = 0; i < 10; i++) { circle(ctx, x - 50 + rnd() * 100, h - 200 + rnd() * 110, 8); paper(ctx, ['#d8546b', '#f2c14e', '#ee6c4d', '#fff'][i % 4], 1.4); } poly(ctx, [x - 46, h - 70, x + 46, h - 70, x + 34, h - 20, x - 34, h - 20]); paper(ctx, '#c4623f', 2.2); }
};
L2.library = (ctx, w, h, pal) => { // globe + lamp desk
  const x = FLAT_PAD + 20; ell(ctx, x, h - 40, 52, 12); paper(ctx, '#6a4430', 1.8); rr(ctx, x - 5, h - 180, 10, 140, 2); paper(ctx, '#6a4430', 1.4); circle(ctx, x, h - 240, 64); paper(ctx, vfill(ctx, h - 304, h - 176, '#4a7a9a', 0.12), 2.4);
  ctx.save(); circle(ctx, x, h - 240, 62); ctx.clip(); for (const [dx, dy, r] of [[-20, -20, 24], [18, 10, 20], [-6, 34, 14]]) { ell(ctx, x + dx, h - 240 + dy, r, r * 0.7, 0.4); fillOnly(ctx, '#7bb661'); } ctx.restore();
  ctx.beginPath(); ctx.arc(x, h - 240, 74, 2.5, 6.0); strokeOnly(ctx, '#e9b949', 5);
  const dx = w - FLAT_PAD - 30; rr(ctx, dx - 80, h - 120, 160, 16, 3); paper(ctx, '#8a5a3c', 2); rr(ctx, dx - 70, h - 104, 12, 100, 2); paper(ctx, '#6a4430', 1.4); rr(ctx, dx + 58, h - 104, 12, 100, 2); paper(ctx, '#6a4430', 1.4);
  glow(ctx, dx, h - 170, 90, '#9affc0', 0.28); poly(ctx, [dx - 30, h - 124, dx + 30, h - 124, dx + 12, h - 168, dx - 12, h - 168]); paper(ctx, '#2f8a5a', 1.8); rr(ctx, dx - 3, h - 124, 6, 8, 1); paper(ctx, '#e9b949', 1);
};
L2.attic = (ctx, w, h, pal) => { // beam posts + cobwebs + trunk stack
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 8 : w - FLAT_PAD - 8; rr(ctx, x - 22, 0, 44, h, 3); paper(ctx, hgrad(ctx, x - 22, x + 22, [[0, '#3a2418'], [0.5, '#5a3a28'], [1, '#2a1810']]), 2.2); }
  ctx.strokeStyle = c('rgba(255,255,255,.4)'); ctx.lineWidth = 1.3; const cx = FLAT_PAD + 22; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + 30 + i * 18, 90 + i * 6 - 40 + (i * i) % 20); ctx.stroke(); } for (let r = 1; r < 5; r++) { ctx.beginPath(); ctx.arc(cx, 0, r * 24, 0.2, 1.5); ctx.stroke(); }
  const tx = w - FLAT_PAD - 60; rr(ctx, tx - 70, h - 96, 120, 60, 5); paper(ctx, '#8a5a3c', 2.2); rr(ctx, tx - 50, h - 150, 90, 54, 5); paper(ctx, '#9b6a46', 2.2); rr(ctx, tx - 10, h - 78, 20, 18, 3); paper(ctx, '#e9b949', 1.4);
};
L2.harbour = (ctx, w, h, pal) => { // mooring posts with rope + barrels
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 16 : w - FLAT_PAD - 16; rr(ctx, x - 22, h - 230, 44, 210, 5); paper(ctx, hgrad(ctx, x - 22, x + 22, [[0, '#5a3a28'], [0.5, '#8a5a3c'], [1, '#4a2a18']]), 2.4); ell(ctx, x, h - 230, 22, 8); paper(ctx, '#8a5a3c', 1.8); ctx.beginPath(); ctx.ellipse(x, h - 170, 28, 9, 0, 0, 6.3); strokeOnly(ctx, '#c9a47a', 7); ctx.beginPath(); ctx.ellipse(x, h - 150, 28, 9, 0, 0, 6.3); strokeOnly(ctx, '#c9a47a', 7); }
  const bx = FLAT_PAD + 110; ell(ctx, bx, h - 56, 40, 50); paper(ctx, '#8a5a3c', 2.2); for (const dy of [-26, 0, 24]) { ctx.beginPath(); ctx.ellipse(bx, h - 56 + dy, 40, 8, 0, 0, Math.PI); strokeOnly(ctx, '#3a2a2e', 3.5); }
};
L2.stage = (ctx, w, h, pal) => { // wing flats with sandbags + ropes
  for (const side of [-1, 1]) { const x = side < 0 ? FLAT_PAD + 20 : w - FLAT_PAD - 20; rr(ctx, x - 70, 20, 140, h - 20, 4); paper(ctx, mix(pal.flat, '#2a1630', 0.3), 2.4); ctx.save(); rr(ctx, x - 70, 20, 140, h - 20, 4); ctx.clip(); for (let i = 0; i < 7; i++) { star(ctx, x - 40 + (i % 2) * 70, 70 + i * 54, 5, 12, 5, i); fillOnly(ctx, rgba('#f7dc8c', 0.65)); } ctx.restore(); circle(ctx, x - side * 20, h - 48, 26); paper(ctx, '#b9946a', 2); ctx.beginPath(); ctx.moveTo(x - side * 20, h - 74); ctx.lineTo(x - side * 20, 40); strokeOnly(ctx, '#b9946a', 4); }
};

// ---- public --------------------------------------------------------------------------------------------------------------------
export const SET_IDS = ['parlour', 'corridor', 'bedroom', 'cellar', 'moor', 'ballroom', 'graveyard', 'castle', 'garden', 'library', 'attic', 'harbour', 'stage'];

/** Paint one layer into `ctx` (already scaled so that 1 unit = 1 virtual unit; origin = region top-left). */
export function paintFlat(ctx, layer, setId, skyName, palette) {
  const pal = { ...DEFAULT_PAL, ...(palette || {}) };
  const set = L1[setId] ? setId : 'parlour';
  const rnd = mulberry32(hashStr(set + ':' + layer + ':' + skyName));
  ctx.save();
  if (layer === 0) { (L0[set] || indoorSky)(ctx, FLAT_W, FLAT_H, pal, skyName, rnd); }
  else if (layer === 1) { (L1[set])(ctx, FLAT_W, FLAT_H, pal, skyName, rnd); groundLine(ctx, FLAT_W, FLAT_H, '#000000'); }
  else { (L2[set] || (() => {}))(ctx, FLAT_W, WING_H, pal, skyName, rnd); }
  ctx.restore();
}

export function flatSize(layer) { return { w: FLAT_W, h: layer === 2 ? WING_H : FLAT_H }; }
