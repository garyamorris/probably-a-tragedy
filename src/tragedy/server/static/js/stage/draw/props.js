// The thirty prop sprites (props.json `draw` ids). Origin = bottom-centre of the sprite (hanging props: top attach point),
// y negative upwards, nominal height PROP_H. Each is a small paper cut-out with an outline; a few have idle animation.

import { c, shade, mix, rgba } from '../color.js';
import { flicker } from '../rng.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vfill, hfill, vgrad, hgrad, glow, heartPath } from './shapes.js';

const WOOD = '#a06f48', WOOD_DK = '#6a4430', BRASS = '#e9b949', BRASS_DK = '#a97c1f', CREAM = '#f6ecd6', PAPER = '#efe0c2', CRIM = '#b3263d', TEAL = '#4fb3a5', LEAF = '#7bb661', LILAC = '#b8a1e3', INK = '#241a26';

export const PROP_H = {
  sword: 112, chair: 112, candle: 92, door: 215, umbrella_stand: 110, letter: 62, mask: 128, mirror: 190, crown: 84, chandelier: 140,
  goose: 98, cake: 96, ghost_sheet: 150, trunk: 80, skull: 74, bouquet: 104, ladder: 225, teapot: 62, lantern: 175, tree: 285,
  bed: 104, clock: 235, harp: 210, trophy: 104, bottle: 96, book: 54, rope: 46, banner: 195, fish: 96, moon: 150,
};
/** Props that hang from the top of the stage on a string: origin = their attach point. */
export const HANGING = new Set(['chandelier', 'banner']);
/** Props that float (bob) rather than sit. */
export const FLOATING = new Set(['ghost_sheet']);

const SP = {};

SP.sword = (ctx, t) => {
  rr(ctx, -16, -8, 32, 8, 3); paper(ctx, '#4a3030', 1.6);                           // a little block it is stuck in
  poly(ctx, [-5, -10, 5, -10, 4, -92, 0, -104, -4, -92]); paper(ctx, hfill(ctx, -5, 5, '#d5dde3', 0.18), 1.8, '#6b7a86');
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -94); strokeOnly(ctx, 'rgba(0,0,0,.18)', 1.5);
  rr(ctx, -20, -96, 40, 7, 3); paper(ctx, BRASS, 1.6);
  rr(ctx, -4, -112, 8, 17, 3); paper(ctx, CRIM, 1.5);
  circle(ctx, 0, -114, 5); paper(ctx, BRASS, 1.4);
};

SP.chair = (ctx) => {
  for (const s of [-1, 1]) { rr(ctx, s * 22 - 4, -48, 8, 48, 2); paper(ctx, WOOD_DK, 1.5); rr(ctx, s * 22 - 4, -112, 8, 66, 3); paper(ctx, WOOD, 1.6); }
  for (const x of [-12, 0, 12]) { rr(ctx, x - 2.5, -104, 5, 46, 2); paper(ctx, WOOD, 1.2); }
  rr(ctx, -26, -112, 52, 9, 4); paper(ctx, WOOD, 1.6);
  rr(ctx, -30, -56, 60, 12, 4); paper(ctx, CRIM, 1.8);
  rr(ctx, -28, -46, 56, 5, 2); paper(ctx, WOOD, 1.4);
};

SP.candle = (ctx, t) => {
  ell(ctx, 0, -4, 24, 6); paper(ctx, BRASS_DK, 1.5);
  rr(ctx, -4, -48, 8, 44, 3); paper(ctx, BRASS, 1.5);
  ell(ctx, 0, -26, 10, 4); paper(ctx, BRASS, 1.2);
  ell(ctx, 0, -52, 12, 5); paper(ctx, BRASS, 1.5);
  rr(ctx, -6, -86, 12, 36, 3); paper(ctx, CREAM, 1.5);
  const f = flicker(t, 3);
  glow(ctx, 0, -98, 46 + f * 5, '#ffb347', 0.5);
  ell(ctx, f, -98, 5, 11 + f * 2); fillOnly(ctx, '#ffb02e');
  ell(ctx, f * 0.6, -96, 3, 6.5 + f); fillOnly(ctx, '#fff1a8');
};

SP.door = (ctx) => {
  rr(ctx, -52, -215, 104, 215, 4); paper(ctx, '#6a4430', 2.2);
  rr(ctx, -44, -207, 88, 207, 8); paper(ctx, vfill(ctx, -207, 0, '#b3263d', 0.1), 1.8);
  for (const [x, y, w, h] of [[-36, -196, 31, 80], [5, -196, 31, 80], [-36, -108, 31, 94], [5, -108, 31, 94]]) { rr(ctx, x, y, w, h, 5); paper(ctx, shade('#b3263d', -0.18), 1.4); rr(ctx, x + 4, y + 4, w - 8, h - 8, 3); ctx.strokeStyle = 'rgba(255,200,200,.25)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  circle(ctx, 28, -104, 6.5); paper(ctx, BRASS, 1.5);
  ell(ctx, 0, -176, 12, 8); paper(ctx, BRASS, 1.2);
  ctx.fillStyle = c('#2a1530'); ctx.font = 'bold 12px serif'; ctx.textAlign = 'center'; ctx.fillText('13', 0, -172);
};

SP.umbrella_stand = (ctx) => {
  // umbrellas poking out
  for (const [x, a, col] of [[-10, -0.35, CRIM], [4, 0.1, '#34495e'], [14, 0.4, TEAL]]) {
    ctx.save(); ctx.translate(x, -40); ctx.rotate(a);
    rr(ctx, -2, -62, 4, 66, 2); paper(ctx, '#3a2a2e', 1.2);
    ctx.beginPath(); ctx.arc(0, -64, 8, Math.PI, 0); ctx.lineTo(0, -68); ctx.closePath(); paper(ctx, col, 1.3);
    ctx.beginPath(); ctx.arc(0, -80, 6, Math.PI * 0.5, Math.PI * 1.5, true); strokeOnly(ctx, '#3a2a2e', 3);
    ctx.restore();
  }
  poly(ctx, [-24, -62, 24, -62, 28, 0, -28, 0]); paper(ctx, vfill(ctx, -62, 0, TEAL, 0.12), 2);
  rr(ctx, -26, -64, 52, 9, 4); paper(ctx, BRASS, 1.5);
  rr(ctx, -28, -12, 56, 8, 3); paper(ctx, BRASS, 1.5);
  ctx.strokeStyle = c('rgba(255,255,255,.3)'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -50); ctx.lineTo(-18, -18); ctx.stroke();
};

SP.letter = (ctx) => {
  ctx.save(); ctx.rotate(-0.1);
  rr(ctx, -40, -62, 80, 56, 4); paper(ctx, CREAM, 2, '#b9a98a');
  ctx.beginPath(); ctx.moveTo(-40, -62); ctx.lineTo(0, -30); ctx.lineTo(40, -62); strokeOnly(ctx, '#b9a98a', 2);
  ctx.beginPath(); ctx.moveTo(-40, -6); ctx.lineTo(-10, -34); ctx.moveTo(40, -6); ctx.lineTo(10, -34); strokeOnly(ctx, '#d3c3a2', 1.5);
  circle(ctx, 0, -32, 9); paper(ctx, CRIM, 1.6);
  circle(ctx, 0, -32, 4.5); ctx.strokeStyle = c('rgba(255,200,200,.5)'); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
};

SP.mask = (ctx) => {
  rr(ctx, -2.5, -80, 5, 80, 2); paper(ctx, WOOD_DK, 1.3);
  ell(ctx, 0, -6, 18, 5); paper(ctx, WOOD_DK, 1.3);
  ctx.save(); ctx.translate(0, -98);
  ctx.beginPath(); ctx.moveTo(-28, -22); ctx.quadraticCurveTo(0, -34, 28, -22); ctx.quadraticCurveTo(34, 12, 0, 32); ctx.quadraticCurveTo(-34, 12, -28, -22); ctx.closePath();
  paper(ctx, vfill(ctx, -30, 30, CREAM, 0.08), 2, '#8a7a5c');
  for (const s of [-1, 1]) { ell(ctx, s * 12, -6, 8, 5, s * 0.3); fillOnly(ctx, INK); }
  ctx.beginPath(); ctx.arc(0, 8, 14, 0.25, Math.PI - 0.25); strokeOnly(ctx, CRIM, 3);
  star(ctx, 0, -20, 5, 6, 3, -1.57); fillOnly(ctx, BRASS);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 28, -10); ctx.quadraticCurveTo(s * 44, 0, s * 40, 24); strokeOnly(ctx, LILAC, 3); }
  ctx.restore();
};

SP.mirror = (ctx, t) => {
  rr(ctx, -4, -12, 8, 12, 2); paper(ctx, BRASS_DK, 1.3);
  for (const s of [-1, 1]) { poly(ctx, [s * 30, 0, s * 38, 0, s * 20, -34]); paper(ctx, WOOD_DK, 1.3); }
  ell(ctx, 0, -104, 46, 86); paper(ctx, BRASS, 2.4, BRASS_DK);
  ell(ctx, 0, -104, 38, 78); paper(ctx, vgrad(ctx, -182, -26, [[0, '#c9e7f2'], [0.5, '#9bc4d6'], [1, '#6f98ad']]), 1.6, BRASS_DK);
  ctx.save(); ell(ctx, 0, -104, 37, 77); ctx.clip();
  const g = ((t * 0.18) % 1.6) - 0.3;
  ctx.fillStyle = c('rgba(255,255,255,.4)');
  ctx.save(); ctx.rotate(0.5); ctx.fillRect(-60 + g * 140, -170, 14, 160); ctx.fillRect(-36 + g * 140, -170, 5, 160); ctx.restore();
  ctx.restore();
  star(ctx, 0, -192, 6, 9, 5, -1.57); paper(ctx, CRIM, 1.4);
};

SP.crown = (ctx) => {
  rr(ctx, -20, -28, 40, 28, 4); paper(ctx, WOOD_DK, 1.6); rr(ctx, -26, -6, 52, 6, 3); paper(ctx, WOOD, 1.4);
  ell(ctx, 0, -32, 28, 8); paper(ctx, CRIM, 1.8);
  poly(ctx, [-24, -34, -26, -66, -13, -50, 0, -74, 13, -50, 26, -66, 24, -34]); paper(ctx, vfill(ctx, -74, -34, BRASS, 0.18), 2, BRASS_DK);
  for (const [x, y, col] of [[-26, -69, CRIM], [0, -77, TEAL], [26, -69, CRIM]]) { circle(ctx, x, y, 4.5); paper(ctx, col, 1.2); }
  for (const x of [-12, 0, 12]) { circle(ctx, x, -42, 3); paper(ctx, LILAC, 1.1); }
};

SP.chandelier = (ctx, t) => {
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); strokeOnly(ctx, '#3a2a2e', 2.5);
  ctx.save(); ctx.translate(0, 34); ctx.rotate(Math.sin(t * 1.1) * 0.015);
  circle(ctx, 0, 6, 10); paper(ctx, BRASS, 1.5);
  ctx.beginPath(); ctx.arc(0, 44, 56, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = 6; ctx.strokeStyle = c(BRASS); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-56, 32); ctx.quadraticCurveTo(-40, 76, 0, 80); ctx.quadraticCurveTo(40, 76, 56, 32); strokeOnly(ctx, BRASS_DK, 3);
  for (const x of [-48, -24, 0, 24, 48]) {
    const y = 24 + Math.abs(x) * 0.18;
    rr(ctx, x - 4, y - 24, 8, 22, 2); paper(ctx, CREAM, 1.2);
    glow(ctx, x, y - 34, 24, '#ffb347', 0.4);
    ell(ctx, x + flicker(t, x) * 0.8, y - 31, 3, 6.5); fillOnly(ctx, '#ffd36e');
    ell(ctx, x, y + 3, 7, 3); paper(ctx, BRASS, 1.1);
  }
  for (const x of [-34, -12, 12, 34]) { ctx.beginPath(); ctx.moveTo(x, 60 - Math.abs(x) * 0.3); ctx.lineTo(x, 80); strokeOnly(ctx, 'rgba(200,230,255,.8)', 1.4); poly(ctx, [x - 4, 80, x + 4, 80, x, 92]); paper(ctx, '#d8f0ff', 1.1, '#7fb7e6'); }
  ctx.restore();
};

SP.goose = (ctx, t) => {
  const bob = Math.sin(t * 2.2) * 2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 10, -16); ctx.lineTo(s * 10, -4); ctx.lineTo(s * 20, 0); strokeOnly(ctx, '#e9a23b', 3.5); }
  ell(ctx, 0, -34, 36, 26); paper(ctx, vfill(ctx, -60, -8, '#fbf8ee', 0.05), 2, '#a89f88');
  ctx.beginPath(); ctx.moveTo(-34, -34); ctx.quadraticCurveTo(-52, -44, -46, -62); ctx.quadraticCurveTo(-36, -46, -30, -42); ctx.closePath(); paper(ctx, '#fbf8ee', 1.6, '#a89f88');
  ell(ctx, 4, -32, 18, 12, -0.25); paper(ctx, '#efe9d6', 1.4, '#a89f88');
  // neck + head
  ctx.beginPath(); ctx.moveTo(18, -48); ctx.quadraticCurveTo(30, -76 + bob, 22, -86 + bob); ctx.lineTo(34, -88 + bob); ctx.quadraticCurveTo(44, -70, 34, -46); ctx.closePath(); paper(ctx, '#fbf8ee', 1.8, '#a89f88');
  circle(ctx, 30, -90 + bob, 11); paper(ctx, '#fbf8ee', 1.8, '#a89f88');
  poly(ctx, [38, -92 + bob, 54, -88 + bob, 38, -84 + bob]); paper(ctx, '#f08a2d', 1.4);
  circle(ctx, 31, -93 + bob, 2.4); fillOnly(ctx, INK);
  // a tiny wig-hint of ribbon
  ell(ctx, 22, -100 + bob, 6, 3, -0.4); paper(ctx, CRIM, 1.1);
};

SP.cake = (ctx, t) => {
  ell(ctx, 0, -4, 46, 8); paper(ctx, '#d4d9de', 1.6, '#8896a3');
  rr(ctx, -4, -10, 8, 8, 2); paper(ctx, '#d4d9de', 1.2);
  const tier = (y, w, h, col) => { rr(ctx, -w, y - h, w * 2, h, 6); paper(ctx, vfill(ctx, y - h, y, col, 0.1), 1.8); ctx.fillStyle = c('#fffaf0'); ctx.beginPath(); ctx.moveTo(-w, y - h + 4); for (let i = 0; i <= 8; i++) ctx.quadraticCurveTo(-w + (i + 0.5) * w / 4, y - h + 16 + (i % 2) * 5, -w + (i + 1) * w / 4, y - h + 4); ctx.lineTo(w, y - h - 1); ctx.lineTo(-w, y - h - 1); ctx.closePath(); ctx.fill(); };
  tier(-10, 42, 24, '#e8a0b4'); tier(-34, 30, 22, '#f2c8d2'); tier(-56, 19, 18, '#e8a0b4');
  for (const x of [-30, -10, 14, 32]) { circle(ctx, x, -34, 4.5); paper(ctx, CRIM, 1.2); }
  rr(ctx, -2.5, -84, 5, 14, 1.5); paper(ctx, TEAL, 1.1);
  const f = flicker(t, 9);
  glow(ctx, 0, -92, 22, '#ffb347', 0.45);
  ell(ctx, f * 0.5, -90, 2.8, 6 + f); fillOnly(ctx, '#ffd36e');
};

SP.ghost_sheet = (ctx, t) => {
  const bob = Math.sin(t * 1.7) * 6 - 6;
  ctx.save(); ctx.translate(0, bob);
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.bezierCurveTo(-48, -96, -22, -146, 0, -146); ctx.bezierCurveTo(22, -146, 48, -96, 34, -6);
  for (let i = 0; i < 5; i++) { const x0 = 34 - i * 13.6; ctx.quadraticCurveTo(x0 - 6.8, 6 + (i % 2) * 4 + Math.sin(t * 3 + i) * 3, x0 - 13.6, -6); }
  ctx.closePath(); paper(ctx, vfill(ctx, -146, 0, '#fbf8ee', 0.04), 2, '#a89fc0');
  for (const s of [-1, 1]) { ell(ctx, s * 12, -108, 5.5, 9); fillOnly(ctx, INK); }
  ell(ctx, 0, -86, 7, 9); fillOnly(ctx, INK);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 34, -70); ctx.quadraticCurveTo(s * 54, -78 + Math.sin(t * 2.4 + s) * 5, s * 60, -62); strokeOnly(ctx, '#a89fc0', 3); }
  ctx.restore();
};

SP.trunk = (ctx) => {
  rr(ctx, -44, -48, 88, 48, 5); paper(ctx, vfill(ctx, -48, 0, '#8a5a3c', 0.1), 2);
  ctx.beginPath(); ctx.moveTo(-44, -48); ctx.quadraticCurveTo(0, -86, 44, -48); ctx.closePath(); paper(ctx, vfill(ctx, -76, -48, '#9b6a46', 0.12), 2);
  for (const x of [-26, 26]) { rr(ctx, x - 5, -70, 10, 70, 2); paper(ctx, BRASS_DK, 1.4); }
  rr(ctx, -8, -52, 16, 15, 3); paper(ctx, BRASS, 1.5); circle(ctx, 0, -46, 2.5); fillOnly(ctx, INK);
  for (const [x, y] of [[-38, -42], [38, -42], [-38, -6], [38, -6]]) { circle(ctx, x, y, 2.6); fillOnly(ctx, BRASS); }
  ctx.fillStyle = c('rgba(255,255,255,.14)'); ctx.beginPath(); ctx.moveTo(-36, -52); ctx.quadraticCurveTo(0, -80, 36, -52); ctx.lineTo(30, -50); ctx.quadraticCurveTo(0, -72, -30, -50); ctx.fill();
};

SP.skull = (ctx) => {
  rr(ctx, -22, -20, 44, 20, 3); paper(ctx, '#7a6a5a', 1.6); rr(ctx, -26, -6, 52, 6, 2); paper(ctx, '#6a5a4a', 1.4);
  ctx.beginPath(); ctx.moveTo(-26, -42); ctx.bezierCurveTo(-30, -78, 30, -78, 26, -42); ctx.lineTo(18, -36); ctx.lineTo(18, -26); ctx.lineTo(-18, -26); ctx.lineTo(-18, -36); ctx.closePath(); paper(ctx, vfill(ctx, -72, -26, '#f3ecd8', 0.06), 2, '#8c8268');
  for (const s of [-1, 1]) { ell(ctx, s * 11, -48, 7.5, 8.5); fillOnly(ctx, INK); }
  poly(ctx, [0, -42, -4, -34, 4, -34]); fillOnly(ctx, INK);
  ctx.strokeStyle = c(INK); ctx.lineWidth = 1.6; for (const x of [-9, -3, 3, 9]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, -27); ctx.stroke(); }
};

SP.bouquet = (ctx, t) => {
  poly(ctx, [-20, -42, 20, -42, 14, 0, -14, 0]); paper(ctx, vfill(ctx, -42, 0, LILAC, 0.1), 1.8);
  rr(ctx, -22, -46, 44, 8, 4); paper(ctx, BRASS, 1.4);
  const fl = [[-24, -78, CRIM], [0, -92, '#f2c14e'], [24, -78, '#ee6c4d'], [-12, -66, '#fff'], [14, -68, '#d8546b'], [0, -70, LILAC]];
  for (const [x, y, col] of fl) { ctx.beginPath(); ctx.moveTo(x * 0.3, -44); ctx.lineTo(x, y); strokeOnly(ctx, LEAF, 2.4); }
  for (const [x, y, col] of fl) { for (let k = 0; k < 5; k++) { const a = k * 1.2566 + 0.3; ell(ctx, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 5, a); paper(ctx, col, 1.2); } circle(ctx, x, y, 4.5); paper(ctx, '#f7dc8c', 1); }
  for (const s of [-1, 1]) { ell(ctx, s * 18, -52, 10, 4, s * 0.5); paper(ctx, LEAF, 1.1); }
};

SP.ladder = (ctx) => {
  ctx.save(); ctx.rotate(0.07);
  for (const s of [-1, 1]) { rr(ctx, s * 30 - 4, -225, 8, 225, 2); paper(ctx, WOOD, 1.7); }
  for (let i = 0; i < 8; i++) { rr(ctx, -30, -24 - i * 27, 60, 7, 2); paper(ctx, shade(WOOD, 0.1), 1.4); }
  ctx.restore();
};

SP.teapot = (ctx, t) => {
  ell(ctx, 0, -3, 26, 5); paper(ctx, '#d4d9de', 1.2, '#8896a3');
  ctx.beginPath(); ctx.moveTo(24, -26); ctx.quadraticCurveTo(46, -40, 36, -50); ctx.lineTo(30, -44); ctx.quadraticCurveTo(38, -36, 22, -22); ctx.closePath(); paper(ctx, TEAL, 1.5);
  ctx.beginPath(); ctx.moveTo(-26, -24); ctx.bezierCurveTo(-52, -54, -30, -58, -24, -40); ctx.lineWidth = 5; ctx.strokeStyle = c(shade(TEAL, -0.3)); ctx.stroke();
  ell(ctx, 0, -26, 28, 22); paper(ctx, vfill(ctx, -48, -4, TEAL, 0.12), 2);
  ell(ctx, 0, -46, 16, 4); paper(ctx, shade(TEAL, -0.1), 1.5);
  circle(ctx, 0, -53, 4.5); paper(ctx, BRASS, 1.2);
  for (let k = 0; k < 3; k++) { const p = ((t * 0.5 + k / 3) % 1); ctx.beginPath(); ctx.moveTo(38 + Math.sin(p * 9) * 3, -52 - p * 28); ctx.lineTo(38 + Math.sin(p * 9 + 1) * 3, -52 - p * 28 - 8); strokeOnly(ctx, `rgba(255,255,255,${0.6 * (1 - p)})`, 3); }
  ctx.beginPath(); ctx.arc(-6, -30, 12, 3.6, 4.7); strokeOnly(ctx, 'rgba(255,255,255,.3)', 3);
};

SP.lantern = (ctx, t) => {
  rr(ctx, -4, -150, 8, 150, 2); paper(ctx, '#3a2a2e', 1.4);
  ell(ctx, 0, -4, 18, 5); paper(ctx, '#3a2a2e', 1.4);
  ctx.beginPath(); ctx.moveTo(0, -150); ctx.quadraticCurveTo(24, -160, 28, -146); strokeOnly(ctx, '#3a2a2e', 4);
  const f = flicker(t, 21);
  ctx.save(); ctx.translate(28, -130);
  glow(ctx, 0, 10, 62 + f * 5, '#ffcf70', 0.45);
  poly(ctx, [-12, -4, 12, -4, 16, 26, -16, 26]); paper(ctx, 'rgba(255,225,150,.9)', 1.8, '#3a2a2e');
  ell(ctx, f * 0.5, 14, 4, 8); fillOnly(ctx, '#ff9a2e');
  poly(ctx, [-16, -4, 16, -4, 8, -16, -8, -16]); paper(ctx, '#3a2a2e', 1.4);
  rr(ctx, -16, 24, 32, 6, 2); paper(ctx, '#3a2a2e', 1.2);
  ctx.restore();
};

SP.tree = (ctx, t) => {
  const sw = Math.sin(t * 0.8) * 1.5;
  poly(ctx, [-16, 0, 16, 0, 10, -150, -10, -150]); paper(ctx, hfill(ctx, -16, 16, '#7a5232', 0.12), 2);
  ctx.beginPath(); ctx.moveTo(-6, -90); ctx.lineTo(-40, -130); ctx.lineTo(-34, -136); ctx.lineTo(0, -108); ctx.closePath(); paper(ctx, '#7a5232', 1.5);
  for (const [x, y, r, col] of [[-48 + sw, -176, 54, '#5d9a48'], [46 - sw, -184, 56, '#6aa853'], [0, -236, 62, '#7bb661'], [-6 + sw, -190, 58, '#6aa853'], [-30, -222, 40, '#7bb661'], [34, -226, 42, '#5d9a48']]) { circle(ctx, x, y, r); paper(ctx, col, 2); }
  for (const [x, y] of [[-30, -190], [20, -240], [48, -190], [-8, -214]]) { circle(ctx, x, y, 5); paper(ctx, CRIM, 1.2); }
};

SP.bed = (ctx) => {
  rr(ctx, -66, -92, 132, 92, 6); paper(ctx, WOOD_DK, 2);
  rr(ctx, -60, -86, 120, 70, 14); paper(ctx, vfill(ctx, -86, -16, WOOD, 0.14), 1.8);
  rr(ctx, -62, -50, 124, 40, 6); paper(ctx, TEAL, 1.8);
  ctx.save(); rr(ctx, -62, -50, 124, 40, 6); ctx.clip(); ctx.fillStyle = c(shade(TEAL, 0.25));
  for (let i = -6; i < 6; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 12, -50 + j * 14, 12, 14);
  ctx.restore();
  rr(ctx, -52, -70, 50, 24, 10); paper(ctx, CREAM, 1.6, '#b9a98a');
  rr(ctx, 6, -66, 46, 20, 10); paper(ctx, '#f7efe0', 1.6, '#b9a98a');
  for (const s of [-1, 1]) { rr(ctx, s * 58 - 5, -16, 10, 16, 2); paper(ctx, WOOD_DK, 1.5); circle(ctx, s * 58, -98, 7); paper(ctx, BRASS, 1.4); }
};

SP.clock = (ctx, t) => {
  rr(ctx, -30, -22, 60, 22, 3); paper(ctx, WOOD_DK, 1.7);
  poly(ctx, [-24, -22, 24, -22, 24, -170, -24, -170]); paper(ctx, hfill(ctx, -24, 24, '#8a5a3c', 0.12), 2);
  rr(ctx, -16, -118, 32, 84, 3); paper(ctx, '#2a1a22', 1.4);
  const sw = Math.sin(t * 2.4) * 0.36;
  ctx.save(); ctx.translate(0, -128); ctx.rotate(sw);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 68); strokeOnly(ctx, BRASS, 2.5); circle(ctx, 0, 68, 9); paper(ctx, BRASS, 1.4);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-30, -170); ctx.lineTo(-30, -190); ctx.quadraticCurveTo(0, -240, 30, -190); ctx.lineTo(30, -170); ctx.closePath(); paper(ctx, '#8a5a3c', 2);
  circle(ctx, 0, -192, 25); paper(ctx, '#f6ecd6', 2, BRASS_DK);
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(Math.sin(a) * 19, -192 - Math.cos(a) * 19); ctx.lineTo(Math.sin(a) * 22, -192 - Math.cos(a) * 22); strokeOnly(ctx, INK, i % 3 === 0 ? 2.4 : 1.2); }
  const m = (t * 0.25) % (Math.PI * 2), h = m / 12;
  ctx.beginPath(); ctx.moveTo(0, -192); ctx.lineTo(Math.sin(m) * 17, -192 - Math.cos(m) * 17); strokeOnly(ctx, INK, 2);
  ctx.beginPath(); ctx.moveTo(0, -192); ctx.lineTo(Math.sin(h + 1) * 11, -192 - Math.cos(h + 1) * 11); strokeOnly(ctx, INK, 3.2);
  star(ctx, 0, -228, 6, 8, 4, -1.57); paper(ctx, BRASS, 1.3);
};

SP.harp = (ctx, t) => {
  rr(ctx, -34, -14, 68, 14, 4); paper(ctx, WOOD_DK, 1.7);
  ctx.beginPath(); ctx.moveTo(-30, -14); ctx.lineTo(-30, -190); ctx.quadraticCurveTo(-20, -214, 18, -196); ctx.quadraticCurveTo(32, -150, 32, -14); ctx.closePath(); paper(ctx, hfill(ctx, -30, 32, BRASS, 0.2), 2.2, BRASS_DK);
  ctx.beginPath(); ctx.moveTo(-18, -20); ctx.lineTo(-18, -188); ctx.quadraticCurveTo(-8, -202, 14, -190); ctx.quadraticCurveTo(24, -140, 22, -20); ctx.closePath(); paper(ctx, '#2a1a22', 1.2);
  for (let i = 0; i < 9; i++) { const x = -14 + i * 3.6, top = -186 + i * 5 - (i > 6 ? (i - 6) * 3 : 0); const wob = Math.sin(t * 9 + i * 1.7) * 0.5; ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x + wob, top); strokeOnly(ctx, i % 3 === 0 ? CRIM : '#f6ecd6', 1.6); }
  for (const [x, y] of [[-30, -196], [-25, -150], [-30, -100], [-30, -50]]) { circle(ctx, x, y, 5); paper(ctx, CRIM, 1.2); }
};

SP.trophy = (ctx) => {
  rr(ctx, -26, -14, 52, 14, 3); paper(ctx, WOOD_DK, 1.7); rr(ctx, -20, -26, 40, 14, 3); paper(ctx, '#2a1a22', 1.4);
  ctx.fillStyle = c(BRASS_DK); ctx.fillRect(-18, -22, 36, 6);
  rr(ctx, -5, -44, 10, 20, 3); paper(ctx, BRASS, 1.4);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 26, -88); ctx.bezierCurveTo(s * 50, -88, s * 50, -56, s * 20, -56); strokeOnly(ctx, BRASS_DK, 5); ctx.beginPath(); ctx.moveTo(s * 26, -88); ctx.bezierCurveTo(s * 50, -88, s * 50, -56, s * 20, -56); strokeOnly(ctx, BRASS, 2.5); }
  ctx.beginPath(); ctx.moveTo(-30, -104); ctx.lineTo(30, -104); ctx.quadraticCurveTo(30, -50, 0, -44); ctx.quadraticCurveTo(-30, -50, -30, -104); ctx.closePath(); paper(ctx, hfill(ctx, -30, 30, BRASS, 0.25), 2.2, BRASS_DK);
  star(ctx, 0, -78, 5, 11, 5, -1.57); paper(ctx, CRIM, 1.2);
  ctx.beginPath(); ctx.moveTo(-18, -98); ctx.lineTo(-16, -66); strokeOnly(ctx, 'rgba(255,255,255,.5)', 3);
};

SP.bottle = (ctx) => {
  ctx.beginPath(); ctx.moveTo(-9, -62); ctx.quadraticCurveTo(-9, -80, -5, -82); ctx.lineTo(-5, -90); ctx.lineTo(5, -90); ctx.lineTo(5, -82); ctx.quadraticCurveTo(9, -80, 9, -62);
  ctx.quadraticCurveTo(24, -52, 24, -26); ctx.lineTo(24, -4); ctx.quadraticCurveTo(24, 0, 20, 0); ctx.lineTo(-20, 0); ctx.quadraticCurveTo(-24, 0, -24, -4); ctx.lineTo(-24, -26); ctx.quadraticCurveTo(-24, -52, -9, -62); ctx.closePath();
  paper(ctx, hfill(ctx, -24, 24, '#3f8a5a', 0.2), 2, '#1c4a30');
  rr(ctx, -6, -98, 12, 10, 2); paper(ctx, '#b9946a', 1.4);
  rr(ctx, -20, -42, 40, 24, 3); paper(ctx, CREAM, 1.4, '#b9a98a');
  ctx.fillStyle = c(CRIM); ctx.font = 'bold 15px serif'; ctx.textAlign = 'center'; ctx.fillText('XXX', 0, -24);
  ctx.beginPath(); ctx.moveTo(-17, -52); ctx.lineTo(-18, -8); strokeOnly(ctx, 'rgba(255,255,255,.3)', 3);
};

SP.book = (ctx) => {
  for (const [y, w, col, rot] of [[0, 48, CRIM, 0], [-14, 42, TEAL, -0.03], [-27, 36, '#e9b949', 0.04]]) {
    ctx.save(); ctx.translate(0, y); ctx.rotate(rot);
    rr(ctx, -w, -14, w * 2, 14, 2); paper(ctx, vfill(ctx, -14, 0, col, 0.1), 1.8);
    ctx.fillStyle = c(PAPER); ctx.fillRect(w - 4, -12, 4, 10);
    ctx.fillStyle = c(rgba('#ffffff', 0.4)); ctx.fillRect(-w + 8, -9, 12, 2); ctx.fillRect(-w + 8, -5, 8, 2);
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(10, -36); ctx.lineTo(10, -48); ctx.lineTo(14, -44); ctx.lineTo(18, -48); ctx.lineTo(18, -34); ctx.closePath(); paper(ctx, CRIM, 1.2);
};

SP.rope = (ctx) => {
  for (let i = 0; i < 4; i++) { ell(ctx, 0, -8 - i * 8, 40 - i * 5, 14 - i * 1.5); ctx.lineWidth = 7; ctx.strokeStyle = c(shade('#b9946a', -0.25)); ctx.stroke(); ell(ctx, 0, -8 - i * 8, 40 - i * 5, 14 - i * 1.5); ctx.lineWidth = 4.2; ctx.strokeStyle = c('#c9a47a'); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(34, -10); ctx.quadraticCurveTo(58, -4, 54, 0); strokeOnly(ctx, '#c9a47a', 4);
};

SP.banner = (ctx, t) => {
  rr(ctx, -50, -4, 100, 8, 4); paper(ctx, BRASS_DK, 1.5);
  for (const s of [-1, 1]) { circle(ctx, s * 52, 0, 6); paper(ctx, BRASS, 1.3); ctx.beginPath(); ctx.moveTo(s * 40, 4); ctx.lineTo(s * 40, 12); strokeOnly(ctx, '#3a2a2e', 1.5); }
  const w = Math.sin(t * 1.5) * 3;
  ctx.beginPath(); ctx.moveTo(-42, 4); ctx.lineTo(42, 4); ctx.lineTo(42 + w, 150); ctx.lineTo(0, 120 + w); ctx.lineTo(-42 + w, 150); ctx.closePath();
  paper(ctx, vfill(ctx, 4, 150, CRIM, 0.12), 2);
  ctx.save(); ctx.clip(); ctx.fillStyle = c(rgba(BRASS, 0.9)); ctx.fillRect(-42, 14, 84, 6); ctx.fillRect(-42, 126, 84, 3); ctx.restore();
  star(ctx, 0, 62, 5, 18, 8, -1.57); paper(ctx, BRASS, 1.6);
  circle(ctx, 0, 62, 5); paper(ctx, CRIM, 1.2);
  ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(-36, 40); ctx.lineTo(-36, 100); strokeOnly(ctx, 'rgba(255,230,160,.55)', 1.4); ctx.beginPath(); ctx.moveTo(36, 40); ctx.lineTo(36, 100); ctx.stroke(); ctx.setLineDash([]);
};

SP.fish = (ctx, t) => {
  rr(ctx, -20, -14, 40, 14, 3); paper(ctx, WOOD_DK, 1.6); rr(ctx, -14, -24, 28, 12, 3); paper(ctx, WOOD, 1.4);
  const w = Math.sin(t * 3) * 3;
  ctx.save(); ctx.translate(0, -62); ctx.rotate(-0.15);
  poly(ctx, [-40, 0, -58, -22 + w, -52, 0, -58, 22 - w]); paper(ctx, TEAL, 1.6);
  ctx.beginPath(); ctx.moveTo(-42, 0); ctx.quadraticCurveTo(-4, -34, 36, -2); ctx.quadraticCurveTo(-4, 34, -42, 0); ctx.closePath(); paper(ctx, hfill(ctx, -44, 38, '#8fb4c9', 0.2), 2, '#3d6a82');
  ctx.save(); ctx.clip(); ctx.strokeStyle = c('rgba(255,255,255,.35)'); ctx.lineWidth = 1.5; for (let i = -3; i < 6; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(i * 9 - 8, j * 10 + (i % 2 ? 4 : 0), 5, 0.3, 2.8); ctx.stroke(); } ctx.restore();
  poly(ctx, [-10, -16, 6, -28 + w * 0.5, 14, -12]); paper(ctx, TEAL, 1.3);
  circle(ctx, 24, -4, 5); paper(ctx, '#fff', 1.3); circle(ctx, 25.5, -4, 2.4); fillOnly(ctx, INK);
  ctx.beginPath(); ctx.arc(34, 4, 5, 0.3, 2.4); strokeOnly(ctx, '#3d6a82', 1.6);
  ctx.restore();
};

SP.moon = (ctx, t) => {
  rr(ctx, -3, -60, 6, 60, 2); paper(ctx, WOOD_DK, 1.3);
  ell(ctx, 0, -4, 22, 6); paper(ctx, WOOD_DK, 1.3);
  ctx.save(); ctx.translate(0, -104); ctx.rotate(Math.sin(t * 0.9) * 0.05);
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.arc(20, -8, 36, Math.PI * 2, 0, true); ctx.closePath();
  paper(ctx, vfill(ctx, -44, 44, '#f7dc8c', 0.1), 2, BRASS_DK);
  circle(ctx, -22, -4, 3); fillOnly(ctx, INK);
  ctx.beginPath(); ctx.arc(-26, 10, 10, 0.3, 2.2); strokeOnly(ctx, INK, 2.2);
  star(ctx, 40, -32, 4, 7, 2, 0); fillOnly(ctx, BRASS);
  ctx.restore();
};

export function drawProp(ctx, id, t) {
  const f = SP[id];
  if (f) f(ctx, t);
  else {
    // unknown prop id: a mystery parcel
    rr(ctx, -26, -44, 52, 44, 4); paper(ctx, PAPER, 2);
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 0); ctx.moveTo(-26, -22); ctx.lineTo(26, -22); strokeOnly(ctx, CRIM, 4);
    ctx.fillStyle = c(INK); ctx.font = 'bold 22px serif'; ctx.textAlign = 'center'; ctx.fillText('?', 0, -26);
  }
}
export const PROP_IDS = Object.keys(SP);
