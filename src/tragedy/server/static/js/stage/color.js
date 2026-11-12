// Colour helpers with a global "tint mode" so one set of draw functions can render
// normally, as a flat drop-shadow silhouette, or as a cool translucent ghost.

const cache = new Map();

export function parse(hex) {
  if (typeof hex !== 'string') return [255, 0, 255];
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return [255, 0, 255];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [255, 0, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const h2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export function toHex(r, g, b) { return '#' + h2(r) + h2(g) + h2(b); }

export function mix(a, b, t) {
  const k = a + '|' + b + '|' + Math.round(t * 100);
  let v = cache.get(k);
  if (v) return v;
  const A = parse(a), B = parse(b);
  v = toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  cache.set(k, v);
  return v;
}

/** amt -1..1: toward black (negative) or white (positive). */
export function shade(hex, amt) {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#0c0610', -amt);
}

const rgbaCache = new Map();
export function rgba(hex, a) {
  const q = Math.round(a * 40) / 40;
  const k = hex + '@' + q;
  let v = rgbaCache.get(k);
  if (v) return v;
  const [r, g, b] = parse(hex);
  v = `rgba(${r},${g},${b},${q})`;
  rgbaCache.set(k, v);
  return v;
}

export function luma(hex) {
  const [r, g, b] = parse(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// ---- tint mode ---------------------------------------------------------------------------------
let mode = null; // null | 'shadow' | 'ghost' | 'flat'
let flatColor = '#ffffff';
export function setTint(m, color) { mode = m; if (color) flatColor = color; }
export function getTint() { return mode; }

const ghostCache = new Map();
function ghostOf(hex) {
  let v = ghostCache.get(hex);
  if (v) return v;
  const [r, g, b] = parse(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  v = mix(toHex(l, l, l), '#8fb4ff', 0.55);
  ghostCache.set(hex, v);
  return v;
}

/** Resolve a palette colour under the current tint mode. */
export function c(hex) {
  if (mode === null) return hex;
  if (mode === 'shadow') return '#0b0510';
  if (mode === 'flat') return flatColor;
  return ghostOf(hex);
}
