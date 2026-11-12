// Layout math for the toy theatre. Pure: importable in Node. Everything is expressed in a 1600x900
// "virtual stage" and mapped to the real canvas by fitStage() (16:9 letterbox).

export const W = 1600;
export const H = 900;

export const OPEN = { x0: 130, x1: 1470, y0: 128, y1: 592, w: 1340, h: 464 }; // the stage opening inside the proscenium
export const LIP_Y = 592;       // front edge of the stage floor (footlights sit here)
export const HORIZON_Y = 424;   // where the back flats meet the floor
export const FLOOR_Y = 520;     // puppet foot baseline
export const BAR_Y = 166;       // control bars hang here
export const PIT_Y = 604;       // orchestra pit / caption zone starts
export const PROMPT = { x: 800, y: LIP_Y + 6 };

export const SLOT_FRAC = [0.3, 0.7, 0.5, 0.12, 0.88];
export const SLOT_DEPTH = [0, 0, -16, 8, 8];
export const SLOT_SCALE = [1, 1, 0.94, 1, 1];
export const ROLE_SLOT = { lead: 0, villain: 1, fool: 2, understudy: 3 };

export const PROP_FRAC = [0.125, 0.875, 0.235, 0.765, 0.5, 0.37, 0.63, 0.07, 0.93];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function slotPos(slot) {
  const s = clamp(slot | 0, 0, SLOT_FRAC.length - 1);
  return { x: OPEN.x0 + OPEN.w * SLOT_FRAC[s], y: FLOOR_Y + SLOT_DEPTH[s], s: SLOT_SCALE[s] };
}

/** Where prop number `i` of a set stands. Edge props are near (front, big); the middle ones sit further back. */
export function propPos(i) {
  const f = PROP_FRAC[((i % PROP_FRAC.length) + PROP_FRAC.length) % PROP_FRAC.length];
  const edge = Math.abs(f - 0.5) * 2; // 0 centre .. 1 edge
  const y = lerp(HORIZON_Y + 52, FLOOR_Y + 56, edge);
  const s = lerp(0.72, 1.0, edge);
  return { x: OPEN.x0 + OPEN.w * f, y, s, edge };
}

export function seatPos(i) {
  const row = i < 6 ? 0 : 1;
  const col = ((i % 6) + 6) % 6;
  return {
    x: 800 + (col - 2.5) * (row === 0 ? 168 : 190),
    y: row === 0 ? 782 : 856,
    s: row === 0 ? 0.86 : 1.0,
    row,
    col,
  };
}

export function pipPos(i) { return { x: 800 + (i - 2) * 46, y: 62 }; }
export const GAUGE_L = { x: 65, y0: 196, y1: 566 };
export const GAUGE_R = { x: 1535, y0: 196, y1: 566 };

// ---- canvas fitting ------------------------------------------------------------------------------
export function fitStage(cw, ch) {
  cw = Math.max(1, cw);
  ch = Math.max(1, ch);
  const scale = Math.min(cw / W, ch / H);
  const w = W * scale, h = H * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scale };
}

export function toStage(fit, px, py) {
  return { x: (px - fit.x) / fit.scale, y: (py - fit.y) / fit.scale };
}
export function toScreen(fit, sx, sy) {
  return { x: fit.x + sx * fit.scale, y: fit.y + sy * fit.scale };
}
/** A screen-pixel size expressed in virtual units (keeps text legible on small stages). */
export const unitsFor = (fit, px) => px / fit.scale;

// ---- text ----------------------------------------------------------------------------------------
/** Greedy word wrap. `measure(str)` -> width. Returns an array of lines (hard-splits over-long words). */
export function wrapText(text, maxW, measure) {
  const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let w of words) {
    while (measure(w) > maxW && w.length > 1) {
      // hard split a monster word
      let k = w.length - 1;
      while (k > 1 && measure(w.slice(0, k)) > maxW) k--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, k));
      w = w.slice(k);
    }
    const next = cur ? cur + ' ' + w : w;
    if (cur && measure(next) > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/** Geometry for the speech-scroll banner (virtual units). Font stays >= ~12.5 screen px on tiny stages. */
export function bannerGeometry(scale, lineCount) {
  const font = clamp(Math.max(30, 12.5 / scale), 30, 70);
  const lineH = font * 1.26;
  const w = scale < 0.4 ? 1440 : 1220;
  const padY = font * 0.62;
  const h = lineCount * lineH + padY * 2;
  const x = 800 - w / 2;
  const y = PIT_Y + 12;
  return { x, y, w, h, font, lineH, padX: font * 1.5, padY, textW: w - font * 3.4 };
}

export function ticketGeometry(scale) {
  const font = clamp(Math.max(21, 11 / scale), 21, 56);
  const w = scale < 0.4 ? 760 : 520;
  return { x: OPEN.x0 + 36, y: OPEN.y0 + 52, w, font, lineH: font * 1.25, pad: font * 0.8 };
}

// ---- hit tests ------------------------------------------------------------------------------------
export function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx, dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Which of the circles {id,x,y,rx,ry} contains the point? Later entries win (they draw on top). */
export function hitTest(px, py, shapes) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (inEllipse(px, py, s.x, s.y, s.rx, s.ry)) return s;
  }
  return null;
}
