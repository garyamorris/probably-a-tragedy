// The room, the proscenium, the heavy curtains, the candle-flame footlights and the Prompter's box.
// The room and the proscenium are static (painted once into cached bitmaps); curtains, flames and tassels are live.

import { OPEN, LIP_Y, PIT_Y, PROMPT, W, H, clamp } from '../layout.js';
import { flicker } from '../rng.js';
import { mix, shade, rgba, c } from '../color.js';
import { paper, poly, rr, ell, circle, star, vgrad, hgrad, rgrad, glow, strokeOnly, fillOnly } from './shapes.js';

const CRIMSON = '#b3263d', CRIMSON_DK = '#7d1527', CRIMSON_LT = '#d8546b';
const GOLD = '#e9b949', GOLD_LT = '#f7dc8c', GOLD_DK = '#a97c1f';
const PLUM9 = '#1b0f1f', PLUM95 = '#130a17', PLUM8 = '#2a1630', PLUM7 = '#3a2142';

export const SWAGS = 7;
const SWAG_W = OPEN.w / SWAGS;

// ---- static: room behind the stage + pit ---------------------------------------------------------------------------
export function paintBack(ctx) {
  // wallpaper
  ctx.fillStyle = vgrad(ctx, 0, H, [[0, PLUM8], [0.55, PLUM9], [1, PLUM95]]);
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba(PLUM7, 0.55);
  ctx.lineWidth = 2;
  for (let y = -40; y < H + 40; y += 56) {
    for (let x = -40 + ((y / 56) % 2 ? 28 : 0); x < W + 40; x += 56) {
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath(); ctx.stroke();
    }
  }
  // the stage's front face (apron) and the pit
  ctx.fillStyle = vgrad(ctx, LIP_Y, PIT_Y + 20, [[0, '#4a2a3a'], [1, '#2a1630']]);
  ctx.fillRect(0, LIP_Y, W, PIT_Y - LIP_Y + 6);
  ctx.fillStyle = vgrad(ctx, PIT_Y, H, [[0, '#150a19'], [0.5, '#0f0712'], [1, '#0b050e']]);
  ctx.fillRect(0, PIT_Y + 4, W, H - PIT_Y);
  // brass rail
  ctx.fillStyle = hgrad(ctx, 0, W, [[0, GOLD_DK], [0.25, GOLD_LT], [0.5, GOLD], [0.75, GOLD_LT], [1, GOLD_DK]]);
  ctx.fillRect(0, PIT_Y - 2, W, 7);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(0, PIT_Y + 5, W, 6);
  // apron carved panels
  for (let i = 0; i < 12; i++) {
    const x = 150 + i * 110;
    rr(ctx, x, LIP_Y + 3, 92, 8, 3);
    ctx.fillStyle = rgba(GOLD_DK, 0.35); ctx.fill();
  }
}

// ---- static: proscenium frame (transparent in the stage opening) -----------------------------------------------------
function fluted(ctx, x0, x1, y0, y1) {
  ctx.fillStyle = hgrad(ctx, x0, x1, [[0, CRIMSON_DK], [0.3, CRIMSON], [0.55, CRIMSON_LT], [0.8, CRIMSON], [1, CRIMSON_DK]]);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(60,5,20,.35)'; ctx.lineWidth = 3;
  const n = 5;
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    ctx.beginPath(); ctx.moveTo(x, y0 + 40); ctx.lineTo(x, y1 - 40); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,220,230,.16)';
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n + 4;
    ctx.beginPath(); ctx.moveTo(x, y0 + 40); ctx.lineTo(x, y1 - 40); ctx.stroke();
  }
}

function goldBlock(ctx, x, y, w, h, r = 5) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, GOLD_LT], [0.5, GOLD], [1, GOLD_DK]]);
  ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(70,40,5,.6)'; ctx.stroke();
}

export function paintFront(ctx) {
  const { x0, x1, y0 } = OPEN;
  // pillars
  fluted(ctx, 0, x0, 0, PIT_Y);
  fluted(ctx, x1, W, 0, PIT_Y);
  // pillar plinths + capitals
  for (const px of [0, x1]) {
    goldBlock(ctx, px - (px === 0 ? 0 : 0), 540, x0, 36, 4);
    goldBlock(ctx, px, 570, x0, 34, 4);
    goldBlock(ctx, px, 70, x0, 30, 4);
    goldBlock(ctx, px + 8, 96, x0 - 16, 14, 3);
  }
  // inner gold edges
  ctx.fillStyle = vgrad(ctx, 0, PIT_Y, [[0, GOLD_LT], [0.5, GOLD], [1, GOLD_DK]]);
  ctx.fillRect(x0 - 10, y0, 10, PIT_Y - y0 - 12);
  ctx.fillRect(x1, y0, 10, PIT_Y - y0 - 12);
  // top band
  ctx.fillStyle = vgrad(ctx, 0, 120, [[0, CRIMSON_DK], [0.5, CRIMSON], [1, CRIMSON_DK]]);
  ctx.fillRect(0, 0, W, 118);
  // cornice with dentils
  ctx.fillStyle = vgrad(ctx, 96, 124, [[0, GOLD_LT], [0.5, GOLD], [1, GOLD_DK]]);
  ctx.fillRect(0, 100, W, 22);
  ctx.fillStyle = 'rgba(70,40,5,.5)';
  for (let x = 6; x < W; x += 22) ctx.fillRect(x, 106, 10, 10);
  // upper border ornament
  ctx.fillStyle = rgba(GOLD, 0.8);
  for (let x = 18; x < W; x += 52) { ell(ctx, x, 12, 14, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,220,150,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(W, 28); ctx.stroke();
  // central cartouche (holds the beat pips)
  rr(ctx, 596, 18, 408, 84, 22);
  ctx.fillStyle = vgrad(ctx, 18, 102, [[0, GOLD_LT], [0.5, GOLD], [1, GOLD_DK]]); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,40,5,.7)'; ctx.stroke();
  rr(ctx, 612, 30, 376, 60, 16);
  ctx.fillStyle = PLUM95; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = GOLD_DK; ctx.stroke();
  // side finials on the cartouche
  for (const sx of [572, 1028]) { star(ctx, sx, 60, 8, 20, 10, 0.2); paper(ctx, GOLD, 2); }

  // valance swags
  for (let i = 0; i < SWAGS; i++) {
    const xa = x0 + i * SWAG_W, xb = xa + SWAG_W;
    const dip = 50 + (i % 2) * 6;
    ctx.beginPath();
    ctx.moveTo(xa, 104);
    ctx.lineTo(xb, 104);
    ctx.quadraticCurveTo(xb - 6, 120 + dip * 0.55, (xa + xb) / 2 + 24, 118 + dip);
    ctx.quadraticCurveTo(xa + 12, 114 + dip * 0.5, xa, 104);
    ctx.closePath();
    ctx.fillStyle = hgrad(ctx, xa, xb, [[0, CRIMSON_DK], [0.35, CRIMSON_LT], [0.7, CRIMSON], [1, CRIMSON_DK]]);
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(50,0,15,.55)'; ctx.stroke();
    // fold lines
    ctx.strokeStyle = 'rgba(50,0,15,.35)'; ctx.lineWidth = 2.5;
    for (let k = 1; k <= 4; k++) {
      const fx = xa + (SWAG_W * k) / 5;
      ctx.beginPath(); ctx.moveTo(fx, 106); ctx.quadraticCurveTo(fx + (k - 2.5) * 5, 112 + dip * 0.6, fx + (k - 2.5) * 12 + 10, 112 + dip * 0.9); ctx.stroke();
    }
    // gold fringe along the swag's lower edge
    ctx.strokeStyle = GOLD; ctx.lineWidth = 7; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(xb, 104); ctx.quadraticCurveTo(xb - 6, 120 + dip * 0.55 + 6, (xa + xb) / 2 + 24, 118 + dip + 6);
    ctx.quadraticCurveTo(xa + 12, 114 + dip * 0.5 + 6, xa, 104); ctx.stroke();
    ctx.setLineDash([]);
  }
  // rosettes at the junctions
  for (let i = 0; i <= SWAGS; i++) {
    const rx = x0 + i * SWAG_W;
    star(ctx, rx, 108, 10, 17, 11, 0.1); paper(ctx, GOLD, 1.5);
    circle(ctx, rx, 108, 6); paper(ctx, CRIMSON, 1.5);
  }
  // frame inner shadow on the stage side (depth)
  const g = ctx.createLinearGradient(x0, 0, x0 + 46, 0);
  g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0 + 40, 46, PIT_Y - y0 - 60);
  const g2 = ctx.createLinearGradient(x1, 0, x1 - 46, 0);
  g2.addColorStop(0, 'rgba(0,0,0,.4)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(x1 - 46, y0 + 40, 46, PIT_Y - y0 - 60);
}

/** Tassels that sway under the swag junctions (dynamic). */
export function drawTassels(ctx, t, calm) {
  for (let i = 0; i <= SWAGS; i++) {
    const x = OPEN.x0 + i * SWAG_W;
    const sw = calm ? 0 : Math.sin(t * 1.6 + i * 1.3) * 0.08;
    ctx.save();
    ctx.translate(x, 122);
    ctx.rotate(sw);
    ctx.strokeStyle = GOLD_DK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.stroke();
    circle(ctx, 0, 26, 7); paper(ctx, GOLD, 1.5);
    ctx.beginPath(); ctx.moveTo(-7, 30); ctx.lineTo(7, 30); ctx.lineTo(10, 54); ctx.lineTo(-10, 54); ctx.closePath();
    ctx.fillStyle = hgrad(ctx, -10, 10, [[0, GOLD_DK], [0.5, GOLD_LT], [1, GOLD_DK]]); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,5,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(70,40,5,.35)'; ctx.lineWidth = 1.5;
    for (let k = -6; k <= 6; k += 3) { ctx.beginPath(); ctx.moveTo(k, 34); ctx.lineTo(k * 1.4, 54); ctx.stroke(); }
    ctx.restore();
  }
}

// ---- curtains ----------------------------------------------------------------------------------------------------------
/**
 * `open` 0 (closed) .. 1 (open); `billow` adds a little wave while moving. Two panels of fluted crimson velvet; when open
 * they are gathered to the pillars with a gold tie-back.
 */
export function drawCurtains(ctx, open, t, billow) {
  const { x0, x1, y0, y1, w } = OPEN;
  if (open >= 0.995) {
    for (const side of [-1, 1]) drawPanel(ctx, side, 0.995, t, billow);
    return;
  }
  for (const side of [-1, 1]) drawPanel(ctx, side, open, t, billow);
  if (open < 0.2) {
    // crest on the meeting line
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0 - 6, w, y1 - y0 + 6); ctx.clip();
    ctx.globalAlpha = 1 - open / 0.2;
    drawCrest(ctx, 800, 330);
    ctx.restore();
  }
}

function drawPanel(ctx, side, open, t, billow) {
  const { x0, x1, y0, y1, w } = OPEN;
  const half = w / 2;
  const gathered = 118;
  const wid = gathered + (half + 6 - gathered) * (1 - open);
  const wob = billow * 7;
  const tieY = 360;
  const pinch = open * 30;
  const flare = open * 26;
  const edge = (y) => {
    // inner edge x offset (from the pillar), a smooth swag
    const base = wid;
    const tie = Math.exp(-Math.pow((y - tieY) / 120, 2)) * pinch;
    const fl = Math.pow(Math.max(0, (y - tieY) / (y1 - tieY)), 2) * flare;
    return base - tie + fl + Math.sin(y * 0.021 + t * 1.4 + side) * wob;
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0 - 8, w, y1 - y0 + 8); ctx.clip();
  ctx.beginPath();
  const xp = side < 0 ? x0 : x1; // pillar side
  ctx.moveTo(xp, y0 - 8);
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const y = y0 - 8 + ((y1 - y0 + 10) * i) / steps;
    ctx.lineTo(side < 0 ? x0 + edge(y) : x1 - edge(y), y);
  }
  ctx.lineTo(xp, y1 + 2);
  ctx.closePath();
  // base velvet
  ctx.fillStyle = CRIMSON;
  ctx.fill();
  ctx.clip();
  // folds: vertical stripes (clipped to the panel)
  const folds = 16;
  const span = wid;
  for (let i = 0; i < folds; i++) {
    const fx = side < 0 ? x0 + (span * i) / folds : x1 - (span * (i + 1)) / folds;
    const fw = span / folds;
    const phase = Math.sin(i * 1.9 + t * 0.9 * (0.3 + billow * 3)) * 0.5 + 0.5;
    ctx.fillStyle = i % 2 === 0 ? `rgba(60,0,20,${0.28 + phase * 0.1})` : `rgba(255,170,190,${0.07 + phase * 0.07})`;
    ctx.fillRect(fx, y0 - 8, fw + 1, y1 - y0 + 12);
  }
  // top shadow under the valance & floor shadow
  const sg = ctx.createLinearGradient(0, y0, 0, y0 + 90);
  sg.addColorStop(0, 'rgba(20,0,10,.6)'); sg.addColorStop(1, 'rgba(20,0,10,0)');
  ctx.fillStyle = sg; ctx.fillRect(x0, y0 - 8, w, 98);
  ctx.restore();
  // inner edge trim + fringe
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 2, y0 - 8, w + 4, y1 - y0 + 12); ctx.clip();
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const y = y0 - 8 + ((y1 - y0 + 10) * i) / 14;
    const ex = side < 0 ? x0 + edge(y) : x1 - edge(y);
    if (i === 0) ctx.moveTo(ex, y); else ctx.lineTo(ex, y);
  }
  ctx.strokeStyle = GOLD; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,5,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  // hem fringe
  ctx.save();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 9; ctx.setLineDash([3, 4]);
  ctx.beginPath();
  const xe = side < 0 ? x0 + edge(y1) : x1 - edge(y1);
  ctx.moveTo(side < 0 ? x0 : x1, y1 - 3); ctx.lineTo(xe, y1 - 3); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // tie-back when gathered
  if (open > 0.5) {
    const a = (open - 0.5) * 2;
    const ex = side < 0 ? x0 + edge(tieY) : x1 - edge(tieY);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(ex, tieY); ctx.quadraticCurveTo((ex + (side < 0 ? x0 : x1)) / 2, tieY + 14, side < 0 ? x0 : x1, tieY - 6); ctx.stroke();
    circle(ctx, ex, tieY, 8); paper(ctx, GOLD_LT, 1.5);
    ctx.beginPath(); ctx.moveTo(ex - 6, tieY + 6); ctx.lineTo(ex + 6, tieY + 6); ctx.lineTo(ex + 9, tieY + 40); ctx.lineTo(ex - 9, tieY + 40); ctx.closePath();
    ctx.fillStyle = GOLD; ctx.fill();
    ctx.restore();
  }
}

function drawCrest(ctx, cx, cy) {
  // two theatre masks on a gold roundel
  circle(ctx, cx, cy, 86); ctx.fillStyle = rgba(GOLD, 0.95); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = GOLD_DK; ctx.stroke();
  circle(ctx, cx, cy, 70); ctx.strokeStyle = CRIMSON_DK; ctx.lineWidth = 3; ctx.stroke();
  const mask = (mx, my, happy, col) => {
    ctx.save(); ctx.translate(mx, my); ctx.rotate(happy ? -0.18 : 0.18);
    ctx.beginPath(); ctx.moveTo(-24, -28); ctx.quadraticCurveTo(0, -36, 24, -28); ctx.quadraticCurveTo(28, 14, 0, 34); ctx.quadraticCurveTo(-28, 14, -24, -28); ctx.closePath();
    paper(ctx, col, 2);
    ctx.fillStyle = PLUM95;
    ell(ctx, -10, -8, 6, happy ? 4 : 5, happy ? 0.3 : -0.3); ctx.fill();
    ell(ctx, 10, -8, 6, happy ? 4 : 5, happy ? -0.3 : 0.3); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = PLUM95; ctx.lineCap = 'round';
    ctx.beginPath(); if (happy) ctx.arc(0, 8, 13, 0.2, Math.PI - 0.2); else ctx.arc(0, 26, 13, Math.PI + 0.3, -0.3); ctx.stroke();
    ctx.restore();
  };
  mask(cx - 24, cy - 2, true, '#f6ecd6');
  mask(cx + 24, cy + 4, false, '#b8a1e3');
  // ribbon
  ctx.beginPath(); ctx.moveTo(cx - 70, cy + 52); ctx.quadraticCurveTo(cx, cy + 84, cx + 70, cy + 52); ctx.lineWidth = 9; ctx.strokeStyle = CRIMSON_DK; ctx.stroke();
}

// ---- footlights --------------------------------------------------------------------------------------------------------
export const FOOT_N = 18;
export function footX(i) { return 205 + i * ((1190) / (FOOT_N - 1)); }

/** Candle-flame footlights along the stage lip. `calm` (reduced motion) = steady flames. */
export function drawFootlights(ctx, t, calm, boost = 0) {
  for (let i = 0; i < FOOT_N; i++) {
    const x = footX(i);
    if (Math.abs(x - PROMPT.x) < 78) continue;
    const f = calm ? 0 : flicker(t + i * 0.37, i);
    const hgt = 17 + f * 4 + boost * 4;
    // glow
    glow(ctx, x, LIP_Y - 18, 46 + f * 6, '#ffb347', 0.38 + boost * 0.15);
    // holder
    ctx.beginPath(); ctx.moveTo(x - 11, LIP_Y + 4); ctx.lineTo(x + 11, LIP_Y + 4); ctx.lineTo(x + 7, LIP_Y - 6); ctx.lineTo(x - 7, LIP_Y - 6); ctx.closePath();
    ctx.fillStyle = hgrad(ctx, x - 11, x + 11, [[0, GOLD_DK], [0.5, GOLD_LT], [1, GOLD_DK]]); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,5,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // candle
    rr(ctx, x - 4.5, LIP_Y - 20, 9, 15, 2); ctx.fillStyle = '#f6ecd6'; ctx.fill();
    // flame
    const sway = calm ? 0 : f * 2.2;
    ctx.save();
    ctx.translate(x + sway * 0.4, LIP_Y - 22);
    ell(ctx, 0, -hgt * 0.45, 5.2, hgt * 0.6); ctx.fillStyle = '#ffb02e'; ctx.fill();
    ell(ctx, 0, -hgt * 0.38, 3.2, hgt * 0.4); ctx.fillStyle = '#fff1a8'; ctx.fill();
    ctx.restore();
  }
}

/** Warm light climbing the stage from the footlights (soft-light blend), plus a vignette. */
export function drawWarmGlow(ctx, strength = 1) {
  const { x0, y0, w, h } = OPEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, LIP_Y, 0, y0 + 40);
  g.addColorStop(0, rgba('#ffb04a', 0.85 * strength));
  g.addColorStop(0.5, rgba('#ff9a3c', 0.28 * strength));
  g.addColorStop(1, rgba('#ff9a3c', 0));
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // side darkening toward the wings
  const sg = ctx.createLinearGradient(x0, 0, x1(), 0);
  sg.addColorStop(0, 'rgba(10,2,14,.42)'); sg.addColorStop(0.16, 'rgba(10,2,14,0)');
  sg.addColorStop(0.84, 'rgba(10,2,14,0)'); sg.addColorStop(1, 'rgba(10,2,14,.42)');
  ctx.fillStyle = sg; ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}
const x1 = () => OPEN.x1;

// ---- Prompter's box -----------------------------------------------------------------------------------------------------
/** `lit` 0..1: whisper energy (brighter lantern); `pulse` pulses a gold "your move" ring while a major mishap waits. */
export function drawPrompter(ctx, t, calm, lit, pulse) {
  const cx = PROMPT.x, cy = PROMPT.y;
  const f = calm ? 0 : flicker(t, 77);
  ctx.save();
  ctx.translate(cx, cy);
  // lantern light on the stage floor
  glow(ctx, 0, -26, 96 + lit * 40, '#ffcf70', 0.18 + lit * 0.22 + f * 0.03);
  // back of the box (dark opening)
  ctx.beginPath(); ctx.moveTo(-62, 4); ctx.quadraticCurveTo(-62, -64, 0, -66); ctx.quadraticCurveTo(62, -64, 62, 4); ctx.closePath();
  ctx.fillStyle = '#0e0612'; ctx.fill();
  // hooded figure
  ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(-36, -34, -16, -50); ctx.quadraticCurveTo(0, -60, 16, -50); ctx.quadraticCurveTo(36, -34, 34, 4); ctx.closePath();
  ctx.fillStyle = '#241a2e'; ctx.fill();
  ctx.strokeStyle = '#3a2a48'; ctx.lineWidth = 2; ctx.stroke();
  // face shadow + glints
  ell(ctx, 0, -32, 14, 16); ctx.fillStyle = '#0a0410'; ctx.fill();
  const blink = !calm && ((t * 0.5) % 5) > 4.85;
  if (!blink) {
    circle(ctx, -5, -34, 1.9); ctx.fillStyle = '#f7dc8c'; ctx.fill();
    circle(ctx, 5, -34, 1.9); ctx.fillStyle = '#f7dc8c'; ctx.fill();
  }
  // lantern held at the right
  const lx = 36 + Math.sin(t * 1.3) * (calm ? 0 : 1.5), ly = -14;
  ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx, ly - 16); ctx.lineTo(lx, ly - 24); ctx.stroke();
  rr(ctx, lx - 7, ly - 14, 14, 20, 3); ctx.fillStyle = GOLD_DK; ctx.fill();
  rr(ctx, lx - 5, ly - 11, 10, 14, 2); ctx.fillStyle = `rgba(255,${210 + f * 20},120,${0.9 + f * 0.1})`; ctx.fill();
  glow(ctx, lx, ly - 4, 30 + lit * 26, '#ffd070', 0.55 + lit * 0.3);
  // shell hood
  ctx.beginPath(); ctx.moveTo(-70, 8); ctx.quadraticCurveTo(-76, -70, 0, -76); ctx.quadraticCurveTo(76, -70, 70, 8);
  ctx.quadraticCurveTo(0, -34, -70, 8); ctx.closePath();
  ctx.fillStyle = hgrad(ctx, -70, 70, [[0, CRIMSON_DK], [0.4, CRIMSON_LT], [0.7, CRIMSON], [1, CRIMSON_DK]]); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
  // shell ribs
  ctx.strokeStyle = rgba(GOLD, 0.7); ctx.lineWidth = 2.5;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(k * 20, -2 - Math.abs(k) * 1.5); ctx.quadraticCurveTo(k * 22, -50, k * 6, -72 + Math.abs(k) * 2); ctx.stroke();
  }
  // scalloped lip
  for (let k = -3; k <= 3; k++) { circle(ctx, k * 20, 7, 11); paper(ctx, GOLD, 1.5); }
  ctx.restore();
  if (pulse > 0) {
    const p = (t * 1.4) % 1;
    ctx.save();
    ctx.globalAlpha = pulse * (1 - p) * 0.9;
    ctx.strokeStyle = GOLD_LT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy - 26, 80 + p * 70, 52 + p * 40, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
