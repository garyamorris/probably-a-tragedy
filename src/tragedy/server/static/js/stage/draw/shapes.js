// Paper-craft drawing helpers shared by every painter. All colours pass through c() so a painter can be rendered
// normally, as a drop-shadow silhouette, or as a cool ghost without knowing which.

import { c, shade, rgba, getTint } from '../color.js';

export const INK = '#241a26';
export const FONT_DISPLAY = 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
export const FONT_UI = 'ui-rounded, "SF Pro Rounded", "Avenir Next Rounded", "Avenir Next", system-ui, sans-serif';
export const FONT_HAND = '"Bradley Hand", "Segoe Script", "Marker Felt", "Comic Sans MS", cursive';

/** Fill the current path (a hex colour or a CanvasGradient), then a thin darker outline: the paper cut-out look. */
export function paper(ctx, fill, lw = 2, edge) {
  const isHex = typeof fill === 'string';
  ctx.fillStyle = isHex ? c(fill) : fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = c(edge || (isHex ? shade(fill, -0.38) : '#2a1530'));
    ctx.stroke();
  }
}

/** A soft top-to-bottom gradient of one colour; collapses to a flat colour under any tint mode. */
export function vfill(ctx, y0, y1, hex, k = 0.16) {
  if (getTint()) return c(hex);
  return vgrad(ctx, y0, y1, [[0, shade(hex, k)], [1, shade(hex, -k)]]);
}
export function hfill(ctx, x0, x1, hex, k = 0.16) {
  if (getTint()) return c(hex);
  return hgrad(ctx, x0, x1, [[0, shade(hex, -k)], [0.45, shade(hex, k)], [1, shade(hex, -k)]]);
}

export function fillOnly(ctx, fill) { ctx.fillStyle = c(fill); ctx.fill(); }

export function strokeOnly(ctx, col, lw) {
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = c(col); ctx.stroke();
}

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
}

export function star(ctx, cx, cy, spikes, r1, r2, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot + (i * Math.PI) / spikes;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
export function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
export function rgrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

/** Soft radial glow (additive-friendly). */
export function glow(ctx, x, y, r, color, a) {
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(r) && r > 0)) return;
  ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, rgba(color, a)], [1, rgba(color, 0)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function text(ctx, str, x, y, font, fill, align = 'left', base = 'alphabetic') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

export function outlinedText(ctx, str, x, y, font, fill, outline, lw, align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = outline; ctx.strokeText(str, x, y);
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
