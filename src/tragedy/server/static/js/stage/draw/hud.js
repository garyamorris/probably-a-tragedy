// The in-frame instruments: five beat pips, the WARMTH heart and string-TANGLE gauges, the speech scroll, Madame's note ticket.

import { c, shade, mix, rgba, luma } from '../color.js';
import { GAUGE_L, GAUGE_R, pipPos, bannerGeometry, ticketGeometry, wrapText, OPEN, PIT_Y, clamp } from '../layout.js';
import { smooth } from '../anim.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vgrad, hgrad, rgrad, glow, heartPath, text, FONT_DISPLAY, FONT_UI, INK } from './shapes.js';

const GOLD = '#e9b949', GOLD_LT = '#f7dc8c', GOLD_DK = '#a97c1f', CRIM = '#b3263d', PLUM = '#130a17';

// ---- beat pips ------------------------------------------------------------------------------------------------------------
export function drawPips(ctx, beat, age, calm) {
  for (let i = 0; i < 5; i++) {
    const p = pipPos(i);
    const cur = i === beat, done = i < beat;
    if (cur) {
      const pulse = calm ? 0 : 0.5 + 0.5 * Math.sin(age * 4);
      glow(ctx, p.x, p.y, 34 + pulse * 6, '#ffd36e', 0.55);
      const pop = smooth(age / 0.5);
      circle(ctx, p.x, p.y, (13 + pulse * 1.5) * (0.6 + 0.4 * pop)); paper(ctx, CRIM, 2.4, GOLD_LT);
      circle(ctx, p.x - 3, p.y - 3, 3.6); fillOnly(ctx, 'rgba(255,255,255,.55)');
    } else if (done) {
      circle(ctx, p.x, p.y, 11); paper(ctx, GOLD, 2, GOLD_DK);
      ctx.beginPath(); ctx.moveTo(p.x - 4.5, p.y); ctx.lineTo(p.x - 1.2, p.y + 4); ctx.lineTo(p.x + 5, p.y - 4); strokeOnly(ctx, '#5a3a10', 2.4);
    } else {
      circle(ctx, p.x, p.y, 10); ctx.fillStyle = c('#0b050e'); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = c(GOLD_DK); ctx.stroke();
    }
    if (i < 4) { ctx.beginPath(); ctx.moveTo(p.x + 17, p.y); ctx.lineTo(p.x + 29, p.y); strokeOnly(ctx, done ? GOLD : '#4a3a1a', 2.4); }
  }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
/** A paper tag that hangs under the valance when a beat begins. */
export function drawBeatTag(ctx, name, index, age, scale) {
  if (!name || age > 3.4) return;
  const a = smooth(age / 0.35) * (1 - smooth((age - 2.7) / 0.7));
  if (a <= 0.01) return;
  const fs = Math.max(26, 12 / scale);
  const label = `${ROMAN[index] || index + 1} · ${name}`;
  ctx.save();
  ctx.font = `italic 700 ${fs}px ${FONT_DISPLAY}`;
  const w = ctx.measureText(label).width + fs * 2.2, h = fs * 1.7;
  const y = 154 + (1 - a) * -20;
  ctx.globalAlpha = a;
  ctx.translate(800, y);
  ctx.rotate(Math.sin(age * 2) * 0.012);
  ctx.strokeStyle = c(GOLD_DK); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-w * 0.35, -h * 0.6); ctx.lineTo(-w * 0.3, 0); ctx.moveTo(w * 0.35, -h * 0.6); ctx.lineTo(w * 0.3, 0); ctx.stroke();
  rr(ctx, -w / 2, 0, w, h, h * 0.3); paper(ctx, '#f3e3bd', 2.2, GOLD_DK);
  rr(ctx, -w / 2 + 5, 5, w - 10, h - 10, h * 0.22); ctx.lineWidth = 1.2; ctx.strokeStyle = c(rgba(GOLD_DK, 0.7)); ctx.stroke();
  text(ctx, label, 0, h * 0.5 + fs * 0.05, `italic 700 ${fs}px ${FONT_DISPLAY}`, c('#4a1a26'), 'center', 'middle');
  ctx.restore();
}

// ---- gauges ---------------------------------------------------------------------------------------------------------------
function levelColor(v) {
  v = clamp(v, 0, 100) / 100;
  if (v < 0.35) return mix('#6a86e0', '#ee5f86', v / 0.35);
  if (v < 0.7) return mix('#ee5f86', '#ff9a4d', (v - 0.35) / 0.35);
  return mix('#ff9a4d', '#ffd24a', (v - 0.7) / 0.3);
}

function tube(ctx, cx, y0, y1, w) {
  rr(ctx, cx - w, y0, w * 2, y1 - y0, w);
  ctx.fillStyle = c('#0b050e'); ctx.fill();
}

function tubeFrame(ctx, cx, y0, y1, w) {
  rr(ctx, cx - w, y0, w * 2, y1 - y0, w);
  ctx.lineWidth = 5; ctx.strokeStyle = c(GOLD); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = c(GOLD_DK); ctx.stroke();
  // glass highlight
  ctx.beginPath(); ctx.moveTo(cx - w * 0.55, y0 + w * 1.1); ctx.lineTo(cx - w * 0.55, y1 - w * 1.1); strokeOnly(ctx, 'rgba(255,255,255,.28)', 3);
  // ticks
  ctx.strokeStyle = c(GOLD_LT); ctx.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const y = y1 - ((y1 - y0 - w) * k) / 4 - w * 0.5; ctx.beginPath(); ctx.moveTo(cx + w + 4, y); ctx.lineTo(cx + w + (k % 2 ? 10 : 15), y); ctx.stroke(); }
}

function marker(ctx, x, y, dir, col) {
  poly(ctx, [x, y, x + dir * 15, y - 8, x + dir * 15, y + 8]);
  ctx.fillStyle = c(col); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
}

/** Left pillar: a heart that fills with warmth, over a thermometer tube. `ghost` = other timeline's value or null. */
export function drawWarmth(ctx, v, ghost, t, calm, pulseBoost) {
  const g = GAUGE_L, cx = g.x;
  const lv = clamp(v, 0, 100) / 100;
  // the heart
  const hy = g.y0 + 22, hs = 30;
  const beat = calm ? 0 : Math.max(0, Math.sin(t * (2.4 + lv * 3))) * 0.06 * (0.4 + lv);
  ctx.save();
  ctx.translate(cx, hy); ctx.scale(1 + beat + pulseBoost * 0.12, 1 + beat + pulseBoost * 0.12);
  heartPath(ctx, 0, 0, hs); ctx.fillStyle = c('#1b0b16'); ctx.fill();
  ctx.save(); heartPath(ctx, 0, 0, hs); ctx.clip();
  const lvY = hs * 0.95 - lv * hs * 1.9;
  ctx.fillStyle = vgrad(ctx, -hs, hs, [[0, levelColor(clamp(v + 12, 0, 100))], [1, shade(levelColor(v), -0.2)]]);
  ctx.beginPath(); ctx.moveTo(-hs * 1.8, hs * 1.4);
  for (let x = -hs * 1.8; x <= hs * 1.8; x += 6) ctx.lineTo(x, lvY + (calm ? 0 : Math.sin(x * 0.2 + t * 3) * 1.8));
  ctx.lineTo(hs * 1.8, hs * 1.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-hs * 0.5, -hs * 0.3, hs * 0.2, hs * 0.1, -0.6, 0, 6.3); ctx.fill();
  ctx.restore();
  heartPath(ctx, 0, 0, hs); ctx.lineWidth = 4; ctx.strokeStyle = c(GOLD); ctx.stroke();
  ctx.restore();
  // the tube
  const y0 = g.y0 + 62, y1 = g.y1, w = 15;
  tube(ctx, cx, y0, y1, w);
  ctx.save(); rr(ctx, cx - w + 2, y0 + 2, w * 2 - 4, y1 - y0 - 4, w - 2); ctx.clip();
  const top = y1 - 4 - (y1 - y0 - 8) * lv;
  ctx.fillStyle = vgrad(ctx, top, y1, [[0, levelColor(v)], [1, shade(levelColor(v), -0.22)]]);
  ctx.beginPath(); ctx.moveTo(cx - w, y1);
  for (let x = cx - w; x <= cx + w; x += 4) ctx.lineTo(x, top + (calm ? 0 : Math.sin(x * 0.5 + t * 3.4) * 2));
  ctx.lineTo(cx + w, y1); ctx.closePath(); ctx.fill();
  // bubbles
  if (!calm && lv > 0.1) for (let i = 0; i < 3; i++) { const p = (t * 0.25 + i / 3) % 1; circle(ctx, cx + Math.sin(i * 5 + t) * 6, y1 - 6 - p * (y1 - top), 2.2); fillOnly(ctx, 'rgba(255,255,255,.4)'); }
  ctx.restore();
  tubeFrame(ctx, cx, y0, y1, w);
  if (ghost != null) marker(ctx, cx - w - 5, y1 - 4 - (y1 - y0 - 8) * (clamp(ghost, 0, 100) / 100), -1, '#8fb4ff');
}

/** Right pillar: a ball of yarn that gets knottier, over a tube of tangled string. */
export function drawTangle(ctx, v, ghost, t, calm, shakeBoost) {
  const g = GAUGE_R, cx = g.x;
  const lv = clamp(v, 0, 100) / 100;
  const by = g.y0 + 22;
  // yarn ball
  const wob = calm ? 0 : Math.sin(t * (3 + lv * 14)) * lv * 2.2;
  ctx.save(); ctx.translate(cx + wob, by); ctx.rotate(calm ? 0 : Math.sin(t * 1.3) * 0.1 * lv);
  circle(ctx, 0, 0, 29); paper(ctx, vfill2(ctx, '#d8546b'), 2.4, '#7d1527');
  ctx.save(); circle(ctx, 0, 0, 28); ctx.clip();
  const loops = 3 + Math.round(lv * 9);
  ctx.lineWidth = 2.4; ctx.strokeStyle = c(rgba('#ffe3e8', 0.7));
  for (let i = 0; i < loops; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 30, 8 + (i % 5) * 5, i * 0.7 + lv * 1.5, 0, 6.3); ctx.stroke(); }
  ctx.restore();
  // loose end that tangles into a knot as chaos rises
  ctx.beginPath(); ctx.moveTo(22, 14); ctx.bezierCurveTo(44, 20, 30 + lv * 14, 44 + lv * 6, 12, 40 + lv * 4); strokeOnly(ctx, '#d8546b', 3.4);
  if (lv > 0.55) { circle(ctx, 14, 40 + lv * 4, 3 + lv * 5); paper(ctx, '#a83a50', 1.4); }
  ctx.restore();
  // tube with tangled string
  const y0 = g.y0 + 62, y1 = g.y1, w = 15;
  tube(ctx, cx, y0, y1, w);
  ctx.save(); rr(ctx, cx - w + 2, y0 + 2, w * 2 - 4, y1 - y0 - 4, w - 2); ctx.clip();
  const top = y1 - 4 - (y1 - y0 - 8) * lv;
  const amp = 3 + lv * 11, freq = 0.1 + lv * 0.16;
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    for (let y = y1; y >= top; y -= 3) { const x = cx + Math.sin(y * freq + s * 2.1 + (calm ? 0 : t * (0.6 + s * 0.3))) * amp * (0.55 + 0.45 * Math.sin(y * 0.05 + s)); if (y === y1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    strokeOnly(ctx, s === 0 ? '#f6ecd6' : s === 1 ? '#d8546b' : '#e9b949', 2.4);
  }
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(cx - w, top, w * 2, y1 - top);
  ctx.restore();
  tubeFrame(ctx, cx, y0, y1, w);
  if (ghost != null) marker(ctx, cx - w - 5, y1 - 4 - (y1 - y0 - 8) * (clamp(ghost, 0, 100) / 100), -1, '#8fb4ff');
}
const vfill2 = (ctx, hex) => hex;

// ---- speech scroll ----------------------------------------------------------------------------------------------------------
const wrapCache = new Map();
function wrapCached(ctx, str, font, maxW) {
  const k = font + '|' + Math.round(maxW) + '|' + str;
  let v = wrapCache.get(k);
  if (!v) {
    ctx.font = font;
    v = wrapText(str, maxW, (s) => ctx.measureText(s).width);
    if (wrapCache.size > 200) wrapCache.clear();
    wrapCache.set(k, v);
  }
  return v;
}

const SCROLL = {
  line: { paper: '#f1e3c4', edge: '#a98f62', ink: INK },
  mishap: { paper: '#f6d9c6', edge: '#b0523a', ink: '#3a1218' },
  decision: { paper: '#f7e4a6', edge: GOLD_DK, ink: '#3a2608' },
  cue: { paper: '#e6dcf5', edge: '#6a4d9a', ink: '#241a3a' },
  chain: { paper: '#d8f0e6', edge: '#2f8a72', ink: '#12302a' },
};

/**
 * bn: {kind, name, color, text, progress 0..1, label, slide 0..1}
 * Returns the rect it occupied (for tests / hit areas).
 */
export function drawBanner(ctx, bn, scale) {
  if (!bn || !bn.text) return null;
  const sc = SCROLL[bn.kind] || SCROLL.line;
  const g0 = bannerGeometry(scale, 1);
  const font = `italic 600 ${g0.font}px ${FONT_DISPLAY}`;
  const lines = wrapCached(ctx, bn.text, font, g0.textW);
  const g = bannerGeometry(scale, Math.min(lines.length, 5));
  const slide = smooth(bn.slide == null ? 1 : bn.slide);
  if (slide <= 0.01) return null;
  ctx.save();
  ctx.globalAlpha *= slide;
  ctx.translate(0, (1 - slide) * 26);
  const { x, y, w, h } = g, ro = g.font * 0.34;
  // rolled ends
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x : x + w;
    rr(ctx, ex - ro, y - 7, ro * 2, h + 14, ro); paper(ctx, hgrad(ctx, ex - ro, ex + ro, [[0, shade(sc.paper, -0.25)], [0.4, shade(sc.paper, 0.1)], [1, shade(sc.paper, -0.2)]]), 2, sc.edge);
    ell(ctx, ex, y - 7 + ro * 0.2, ro, ro * 0.4); paper(ctx, shade(sc.paper, -0.12), 1.6, sc.edge);
    circle(ctx, ex, y - 7 + ro * 0.2, ro * 0.18); fillOnly(ctx, shade(sc.edge, -0.1));
  }
  // parchment
  ctx.beginPath();
  ctx.moveTo(x, y + 3);
  ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y + 3);
  ctx.lineTo(x + w, y + h - 3);
  ctx.quadraticCurveTo(x + w / 2, y + h + 8, x, y + h - 3);
  ctx.closePath();
  paper(ctx, vgrad(ctx, y, y + h, [[0, shade(sc.paper, 0.08)], [1, shade(sc.paper, -0.1)]]), 2.4, sc.edge);
  ctx.beginPath(); ctx.moveTo(x + 8, y + 9); ctx.quadraticCurveTo(x + w / 2, y - 1, x + w - 8, y + 9); strokeOnly(ctx, 'rgba(255,255,255,.35)', 2);
  // text, typewriter
  let remaining = Math.ceil(bn.text.length * clamp(bn.progress, 0, 1));
  ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = c(sc.ink);
  const tx = x + g.padX, ty0 = y + g.padY + g.font * 0.88;
  let consumed = 0;
  const show = Math.min(lines.length, 5);
  for (let i = 0; i < show; i++) {
    let ln = lines[i];
    if (i === show - 1 && lines.length > show) ln = ln.replace(/\s*\S*$/, '') + '…';
    const take = clamp(remaining - consumed, 0, ln.length);
    if (take > 0) ctx.fillText(ln.slice(0, take), tx, ty0 + i * g.lineH);
    consumed += lines[i].length + 1;
  }
  // blinking nib while typing
  if (bn.progress < 1) { ctx.fillStyle = c(rgba(sc.ink, 0.6)); }
  // name chip
  if (bn.name) {
    const cf = g.font * 0.58;
    ctx.font = `700 ${cf}px ${FONT_UI}`;
    const cw = ctx.measureText(bn.name).width + cf * 1.6, ch = cf * 1.75;
    const cx = x + g.padX * 0.55, cy = y - ch * 0.62;
    rr(ctx, cx + 3, cy + 4, cw, ch, ch / 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
    rr(ctx, cx, cy, cw, ch, ch / 2); paper(ctx, bn.color || '#6a4575', 2.2, shade(bn.color || '#6a4575', -0.5));
    ctx.fillStyle = c(luma(bn.color || '#6a4575') > 0.62 ? INK : '#fff6e2'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(bn.name, cx + cf * 0.8, cy + ch / 2 + 1);
  }
  if (bn.label) {
    const lf = g.font * 0.5;
    ctx.font = `700 ${lf}px ${FONT_UI}`;
    const lw = ctx.measureText(bn.label).width + lf * 1.6, lh = lf * 1.8;
    const lx = x + w - g.padX * 0.55 - lw, ly = y - lh * 0.62;
    rr(ctx, lx, ly, lw, lh, lh / 2); paper(ctx, bn.kind === 'mishap' ? '#ee6c4d' : bn.kind === 'cue' ? '#8d6ad0' : GOLD, 2, shade(GOLD_DK, -0.3));
    ctx.fillStyle = c(bn.kind === 'cue' ? '#fff6e2' : '#2a1608'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(bn.label, lx + lf * 0.8, ly + lh / 2 + 1);
  }
  ctx.restore();
  return g;
}

// ---- Madame's note ------------------------------------------------------------------------------------------------------------
export function drawTicket(ctx, tk, scale, t, calm) {
  if (!tk || !tk.text) return;
  const g = ticketGeometry(scale);
  const slide = smooth(tk.slide == null ? 1 : tk.slide);
  if (slide <= 0.01) return;
  const font = `italic 500 ${g.font}px ${FONT_DISPLAY}`;
  const lines = wrapCached(ctx, tk.text, font, g.w - g.pad * 2.4);
  const hdr = g.font * 0.8;
  const h = hdr * 2 + lines.length * g.lineH + g.pad;
  const x = g.x, y = g.y;
  ctx.save();
  ctx.translate(x + g.w / 2 - (1 - slide) * (g.w + 160), y + h / 2);
  ctx.rotate(-0.025 + (calm ? 0 : Math.sin(t * 1.2) * 0.004));
  ctx.translate(-g.w / 2, -h / 2);
  // ticket with notched sides
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(g.w, 0);
  ctx.arc(g.w, h * 0.5, g.font * 0.55, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(g.w, h); ctx.lineTo(0, h); ctx.arc(0, h * 0.5, g.font * 0.55, Math.PI / 2, -Math.PI / 2, true); ctx.closePath();
  ctx.save(); ctx.translate(4, 6); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); ctx.restore();
  paper(ctx, vgrad(ctx, 0, h, [[0, '#fbf1d6'], [1, '#ecd9a8']]), 2.2, '#a98f62');
  // perforation
  ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(g.pad * 1.2, hdr * 1.55); ctx.lineTo(g.w - g.pad * 1.2, hdr * 1.55); strokeOnly(ctx, '#a98f62', 1.6); ctx.setLineDash([]);
  text(ctx, "MADAME'S NOTE", g.pad * 1.2, hdr * 0.95, `700 ${hdr * 0.68}px ${FONT_UI}`, c(CRIM), 'left', 'middle');
  // little top hat
  const hx = g.w - g.pad * 1.8, hy = hdr * 0.9;
  rr(ctx, hx - hdr * 0.4, hy - hdr * 0.55, hdr * 0.8, hdr * 0.62, 2); paper(ctx, '#1d1822', 1.2); ell(ctx, hx, hy + hdr * 0.05, hdr * 0.62, hdr * 0.14); paper(ctx, '#1d1822', 1.2);
  rr(ctx, hx - hdr * 0.4, hy - hdr * 0.1, hdr * 0.8, hdr * 0.13, 1); fillOnly(ctx, CRIM);
  ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = c('#3a1c26');
  const n = Math.ceil(tk.text.length * clamp(tk.progress == null ? 1 : tk.progress, 0, 1));
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    const take = clamp(n - consumed, 0, lines[i].length);
    if (take > 0) ctx.fillText(lines[i].slice(0, take), g.pad * 1.2, hdr * 1.55 + g.font * 1.15 + i * g.lineH);
    consumed += lines[i].length + 1;
  }
  // washi tape
  ctx.save(); ctx.translate(g.w * 0.5, -3); ctx.rotate(0.05); rr(ctx, -34, -9, 68, 18, 2); ctx.fillStyle = 'rgba(224,168,46,.8)'; ctx.fill(); ctx.restore();
  ctx.restore();
}

/** Hover name-tag above a puppet or seat. */
export function drawNameTag(ctx, label, x, y, scale, accent) {
  const fs = Math.max(20, 11 / scale);
  ctx.save();
  ctx.font = `700 ${fs}px ${FONT_UI}`;
  const w = ctx.measureText(label).width + fs * 1.5, h = fs * 1.7;
  rr(ctx, x - w / 2, y - h, w, h, h / 2); paper(ctx, '#fbf1d6', 2, GOLD_DK);
  poly(ctx, [x - 6, y - 1, x + 6, y - 1, x, y + 8]); paper(ctx, '#fbf1d6', 1.6, GOLD_DK);
  rr(ctx, x - w / 2, y - h, w, h, h / 2); ctx.lineWidth = 2.2; ctx.strokeStyle = c(accent || GOLD_DK); ctx.stroke();
  text(ctx, label, x, y - h / 2 + 1, `700 ${fs}px ${FONT_UI}`, c(INK), 'center', 'middle');
  ctx.restore();
}
