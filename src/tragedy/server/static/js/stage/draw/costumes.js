// Puppet bodies: eight costumes drawn as paper cut-outs. Origin = feet centre; y is negative going up.
// drawLower() is the skirt/legs (rotates with the whole body); drawTorso() sits in the "upper" group that can bend/bow.

import { c, shade, mix, rgba } from '../color.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vfill, hfill, vgrad, hgrad, INK } from './shapes.js';

const DARK = '#2a1530';
const CREAM = '#fff6e2';
const METAL = '#c9d4dc';

/** symmetric tapering polygon (a skirt / torso) */
function taper(ctx, yTop, yBot, wTop, wBot, pw = 1, steps = 9, dx = 0) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, y = yTop + (yBot - yTop) * t, w = wTop + (wBot - wTop) * Math.pow(t, pw);
    pts.push(dx - w, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps, y = yTop + (yBot - yTop) * t, w = wTop + (wBot - wTop) * Math.pow(t, pw);
    pts.push(dx + w, y);
  }
  poly(ctx, pts);
}

function leg(ctx, g, side, ang, col, wid, len, shoe, shoeCol, o = {}) {
  const hx = side * g.H * 0.066;
  const fx = hx + Math.sin(ang) * len, fy = g.hipY + Math.cos(ang) * len;
  const kx = (hx + fx) / 2 + side * 2, ky = (g.hipY + fy) / 2;
  ctx.beginPath(); ctx.moveTo(hx, g.hipY); ctx.quadraticCurveTo(kx, ky, fx, fy);
  strokeOnly(ctx, shade(col, -0.45), wid + 3.2);
  ctx.beginPath(); ctx.moveTo(hx, g.hipY); ctx.quadraticCurveTo(kx, ky, fx, fy);
  strokeOnly(ctx, col, wid);
  if (o.stripe) { ctx.beginPath(); ctx.moveTo(hx + side * wid * 0.2, g.hipY); ctx.quadraticCurveTo(kx + side * wid * 0.2, ky, fx + side * wid * 0.2, fy - 6); strokeOnly(ctx, o.stripe, 3); }
  if (o.stockings) {
    ctx.save(); ctx.lineCap = 'butt';
    for (let i = 1; i < 7; i += 2) {
      const t0 = i / 7, t1 = (i + 1) / 7;
      const px = (t) => (1 - t) * (1 - t) * hx + 2 * (1 - t) * t * kx + t * t * fx, py = (t) => (1 - t) * (1 - t) * g.hipY + 2 * (1 - t) * t * ky + t * t * fy;
      ctx.beginPath(); ctx.moveTo(px(t0), py(t0)); ctx.lineTo(px(t1), py(t1)); strokeOnly(ctx, o.stockings, wid);
    }
    ctx.restore();
  }
  // shoe
  ell(ctx, fx + side * wid * 0.45, fy - 1, wid * (shoe || 1.0), wid * 0.55);
  paper(ctx, shoeCol, 1.8);
}

function walkAng(pv, side) { return Math.sin(pv.walk + (side > 0 ? Math.PI : 0)) * 0.38 * pv.walkAmp; }

// ---- lower bodies ------------------------------------------------------------------------------------------------------
const LOWER = {
  gown(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal, top = g.hipY - g.H * 0.02, w1 = g.H * 0.32;
    // shoes peeking
    for (const s of [-1, 1]) { ell(ctx, s * g.H * 0.1 + Math.sin(pv.walk + (s > 0 ? 3.14 : 0)) * 6 * pv.walkAmp, -4, g.H * 0.05, g.H * 0.028); paper(ctx, P.accent, 1.6); }
    taper(ctx, top, -g.H * 0.012, g.H * 0.09, w1, 0.85);
    paper(ctx, vfill(ctx, top, 0, P.body, 0.14), 2.2, shade(P.body, -0.45));
    // underskirt ruffle with scalloped hem
    const rw = w1 * 0.98;
    taper(ctx, -g.H * 0.115, -g.H * 0.06, w1 * 0.8, rw, 1, 4); paper(ctx, shade(P.body, 0.12), 0, null);
    ctx.strokeStyle = c(rgba('#ffffff', 0.35)); ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * g.H * 0.075, top + g.H * 0.05); ctx.quadraticCurveTo(k * g.H * 0.11, -g.H * 0.15, k * g.H * 0.15, -g.H * 0.03); ctx.stroke(); }
    const n = 7;
    for (let i = 0; i < n; i++) { circle(ctx, -w1 + (w1 * 2 * (i + 0.5)) / n, -g.H * 0.012, (w1 * 2) / n / 2); paper(ctx, P.accent, 1.6); }
    // sash bow at the waist
    rr(ctx, -g.H * 0.095, top + 2, g.H * 0.19, g.H * 0.035, 3); paper(ctx, P.accent, 1.6);
  },
  robe(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal, top = g.shoulderY + g.H * 0.02, w1 = g.H * 0.27;
    for (const s of [-1, 1]) { ell(ctx, s * g.H * 0.08 + Math.sin(pv.walk + (s > 0 ? 3.14 : 0)) * 5 * pv.walkAmp, -3, g.H * 0.055, g.H * 0.026); paper(ctx, shade(P.body, -0.4), 1.6); }
    taper(ctx, top, -g.H * 0.01, g.H * 0.12, w1, 1.25);
    paper(ctx, vfill(ctx, top, 0, P.body, 0.16), 2.2, shade(P.body, -0.45));
    // star + moon pattern
    ctx.save(); ctx.clip();
    for (const [x, y, s] of [[-0.14, -0.22, 1], [0.13, -0.15, 0.8], [-0.04, -0.07, 0.7], [0.1, -0.31, 0.6], [-0.15, -0.4, 0.6]]) { star(ctx, x * g.H, y * g.H, 5, g.H * 0.028 * s, g.H * 0.012 * s, -1.57); fillOnly(ctx, P.accent); }
    ctx.beginPath(); ctx.arc(0.03 * g.H, -0.24 * g.H, g.H * 0.045, 0.9, 5.4); ctx.lineWidth = g.H * 0.02; ctx.strokeStyle = c(P.accent); ctx.stroke();
    ctx.restore();
    // hem band
    taper(ctx, -g.H * 0.05, -g.H * 0.01, w1 * 0.9, w1, 1, 3); paper(ctx, P.accent, 1.2);
  },
  coat(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal, trou = shade(P.body, -0.35);
    for (const s of [-1, 1]) leg(ctx, g, s, walkAng(pv, s), trou, g.H * 0.07, g.H * 0.335, 1.15, '#241a26');
  },
  wig(ctx, sp, pv) { LOWER.coat(ctx, sp, pv); },
  uniform(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal, trou = shade(P.body, -0.25);
    for (const s of [-1, 1]) leg(ctx, g, s, walkAng(pv, s), trou, g.H * 0.075, g.H * 0.335, 1.2, '#1b1218', { stripe: P.accent });
    for (const s of [-1, 1]) { const a = walkAng(pv, s); const fx = s * g.H * 0.066 + Math.sin(a) * g.H * 0.335, fy = g.hipY + Math.cos(a) * g.H * 0.335; rr(ctx, fx - g.H * 0.05, fy - g.H * 0.09, g.H * 0.1, g.H * 0.09, 4); paper(ctx, '#2a2028', 1.6); }
  },
  frock(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal;
    for (const s of [-1, 1]) leg(ctx, g, s, walkAng(pv, s), '#f4e6d0', g.H * 0.05, g.H * 0.335, 1.35, P.accent, { stockings: shade(P.accent, 0.1) });
    const top = g.hipY - g.H * 0.02, bot = -g.H * 0.2;
    taper(ctx, top, bot, g.H * 0.09, g.H * 0.23, 0.9);
    paper(ctx, vfill(ctx, top, bot, P.body, 0.14), 2.2, shade(P.body, -0.45));
    for (let i = -3; i <= 3; i++) { circle(ctx, i * g.H * 0.065, bot, g.H * 0.034); paper(ctx, shade(P.body, 0.08), 1.4); }
    // apron
    taper(ctx, top + g.H * 0.02, bot + g.H * 0.02, g.H * 0.06, g.H * 0.13, 1); paper(ctx, '#fff6e2', 1.6, '#c9b99b');
  },
  rags(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal;
    for (const s of [-1, 1]) leg(ctx, g, s, walkAng(pv, s), shade(P.body, -0.5), g.H * 0.035, g.H * 0.335, 1.9, P.accent);
    // ragged tunic skirt with zigzag hem
    const top = g.hipY - g.H * 0.05, hem = -g.H * 0.2, w = g.H * 0.15;
    const pts = [-g.H * 0.1, top, g.H * 0.1, top];
    const n = 7;
    for (let i = 0; i <= n; i++) pts.push(w - (w * 2 * i) / n, hem + (i % 2 ? g.H * 0.04 : -g.H * 0.01) + (i % 3) * 2);
    poly(ctx, [-g.H * 0.1, top, g.H * 0.1, top, ...pts.slice(4)]);
    paper(ctx, vfill(ctx, top, hem, P.body, 0.1), 2, shade(P.body, -0.45));
    rr(ctx, -g.H * 0.07, top + g.H * 0.03, g.H * 0.07, g.H * 0.06, 2); paper(ctx, P.accent, 1.2);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c(rgba('#2a1530', 0.55)); ctx.lineWidth = 1.2; ctx.strokeRect(-g.H * 0.065, top + g.H * 0.035, g.H * 0.06, g.H * 0.05); ctx.setLineDash([]);
  },
  armour(ctx, sp, pv) {
    const g = sp.geo, P = sp.pal, metal = mix(METAL, P.body, 0.25);
    for (const s of [-1, 1]) leg(ctx, g, s, walkAng(pv, s), metal, g.H * 0.085, g.H * 0.335, 1.25, shade(metal, -0.2));
    // tassets
    for (let i = 0; i < 3; i++) { const y0 = g.hipY - g.H * 0.04 + i * g.H * 0.04; taper(ctx, y0, y0 + g.H * 0.06, g.H * (0.11 + i * 0.012), g.H * (0.12 + i * 0.014), 1, 2); paper(ctx, vfill(ctx, y0, y0 + g.H * 0.06, metal, 0.18), 1.8, shade(metal, -0.5)); }
  },
};

// ---- torsos ---------------------------------------------------------------------------------------------------------------
function neck(ctx, g, skin) {
  rr(ctx, -g.H * 0.03, g.shoulderY - g.H * 0.05, g.H * 0.06, g.H * 0.07, 3); paper(ctx, skin, 1.4);
}

const TORSO = {
  gown(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY;
    // bodice
    taper(ctx, sh, hp + g.H * 0.02, g.H * 0.13, g.H * 0.085, 1);
    paper(ctx, vfill(ctx, sh, hp, P.body, 0.14), 2.2, shade(P.body, -0.45));
    // scoop neckline + lace
    ctx.beginPath(); ctx.arc(0, sh - g.H * 0.005, g.H * 0.075, 0.1, Math.PI - 0.1); ctx.closePath(); paper(ctx, sp.skin, 1.6);
    ctx.beginPath(); ctx.arc(0, sh - g.H * 0.005, g.H * 0.09, 0.2, Math.PI - 0.2); strokeOnly(ctx, CREAM, 3);
    // bodice stripes
    ctx.strokeStyle = c(P.accent); ctx.lineWidth = 2.4;
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(k * g.H * 0.035, sh + g.H * 0.07); ctx.lineTo(k * g.H * 0.025, hp); ctx.stroke(); }
    // puffed sleeves
    for (const s of [-1, 1]) { circle(ctx, s * g.shoulderX, sh + g.H * 0.02, g.H * 0.075); paper(ctx, shade(P.body, 0.06), 2); }
  },
  robe(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY;
    ell(ctx, 0, sh - g.H * 0.01, g.H * 0.17, g.H * 0.07); paper(ctx, shade(P.body, -0.2), 2);   // shawl collar
    ell(ctx, 0, sh + g.H * 0.005, g.H * 0.11, g.H * 0.04); paper(ctx, P.accent, 1.5);
    // belt cord + tassel
    ctx.beginPath(); ctx.moveTo(-g.H * 0.12, g.hipY - g.H * 0.04); ctx.quadraticCurveTo(0, g.hipY - g.H * 0.0, g.H * 0.12, g.hipY - g.H * 0.04); strokeOnly(ctx, P.accent, 5);
    ctx.beginPath(); ctx.moveTo(g.H * 0.05, g.hipY - g.H * 0.02); ctx.lineTo(g.H * 0.06, g.hipY + g.H * 0.1); strokeOnly(ctx, P.accent, 3);
    circle(ctx, g.H * 0.06, g.hipY + g.H * 0.11, g.H * 0.022); paper(ctx, P.accent, 1.2);
    for (const s of [-1, 1]) { circle(ctx, s * g.shoulderX, sh + g.H * 0.025, g.H * 0.06); paper(ctx, P.body, 2); }
  },
  coat(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY;
    // coat tails
    for (const s of [-1, 1]) { poly(ctx, [s * g.H * 0.04, hp - g.H * 0.02, s * g.H * 0.16, hp - g.H * 0.02, s * g.H * 0.2, hp + g.H * 0.12, s * g.H * 0.1, hp + g.H * 0.09]); paper(ctx, shade(P.body, -0.12), 1.8); }
    taper(ctx, sh, hp, g.H * 0.15, g.H * 0.11, 1);
    paper(ctx, vfill(ctx, sh, hp, P.body, 0.12), 2.2, shade(P.body, -0.45));
    // shirt + waistcoat
    poly(ctx, [-g.H * 0.06, sh, g.H * 0.06, sh, 0, hp + g.H * 0.01]); paper(ctx, CREAM, 1.5, '#b9a98a');
    poly(ctx, [-g.H * 0.05, sh + g.H * 0.09, g.H * 0.05, sh + g.H * 0.09, g.H * 0.05, hp, 0, hp + g.H * 0.02, -g.H * 0.05, hp]); paper(ctx, P.accent, 1.5);
    // lapels
    for (const s of [-1, 1]) { poly(ctx, [s * g.H * 0.02, sh, s * g.H * 0.09, sh, s * g.H * 0.065, sh + g.H * 0.11]); paper(ctx, shade(P.body, 0.12), 1.5); }
    for (const k of [0.13, 0.19]) { circle(ctx, 0, sh + g.H * k, g.H * 0.012); fillOnly(ctx, '#f7dc8c'); }
    // bow tie / jabot
    if (sp.costume === 'wig') { ell(ctx, 0, sh + g.H * 0.05, g.H * 0.05, g.H * 0.065); paper(ctx, '#fffaf0', 1.4, '#b9a98a'); for (const k of [0.06, 0.09]) { ctx.beginPath(); ctx.moveTo(-g.H * 0.04, sh + g.H * k); ctx.quadraticCurveTo(0, sh + g.H * (k + 0.02), g.H * 0.04, sh + g.H * k); strokeOnly(ctx, '#b9a98a', 1.2); } }
    else { poly(ctx, [0, sh + g.H * 0.012, -g.H * 0.055, sh - g.H * 0.012, -g.H * 0.055, sh + g.H * 0.04]); paper(ctx, '#e9b949', 1.2); poly(ctx, [0, sh + g.H * 0.012, g.H * 0.055, sh - g.H * 0.012, g.H * 0.055, sh + g.H * 0.04]); paper(ctx, '#e9b949', 1.2); }
    for (const s of [-1, 1]) { circle(ctx, s * g.shoulderX, sh + g.H * 0.02, g.H * 0.05); paper(ctx, P.body, 2); }
  },
  wig(ctx, sp) { TORSO.coat(ctx, sp); },
  uniform(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY;
    taper(ctx, sh, hp + g.H * 0.03, g.H * 0.15, g.H * 0.115, 1);
    paper(ctx, vfill(ctx, sh, hp, P.body, 0.12), 2.2, shade(P.body, -0.45));
    // sash
    poly(ctx, [-g.H * 0.15, sh + g.H * 0.02, -g.H * 0.09, sh, g.H * 0.115, hp + g.H * 0.02, g.H * 0.06, hp + g.H * 0.04]); paper(ctx, P.accent, 1.6);
    // double row of buttons
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { circle(ctx, s * g.H * 0.04, sh + g.H * (0.045 + i * 0.045), g.H * 0.013); paper(ctx, '#f7dc8c', 1); }
    // collar
    rr(ctx, -g.H * 0.065, sh - g.H * 0.012, g.H * 0.13, g.H * 0.04, 3); paper(ctx, shade(P.body, 0.12), 1.5);
    // epaulettes
    for (const s of [-1, 1]) { rr(ctx, s * g.shoulderX - g.H * 0.045, sh - g.H * 0.012, g.H * 0.09, g.H * 0.035, 3); paper(ctx, P.accent, 1.5); for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(s * g.shoulderX + k * g.H * 0.016, sh + g.H * 0.02); ctx.lineTo(s * g.shoulderX + k * g.H * 0.018, sh + g.H * 0.05); strokeOnly(ctx, P.accent, 2.2); } }
  },
  frock(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY;
    taper(ctx, sh, hp, g.H * 0.12, g.H * 0.09, 1);
    paper(ctx, vfill(ctx, sh, hp, P.body, 0.12), 2.2, shade(P.body, -0.45));
    // peter-pan collar
    for (const s of [-1, 1]) { ell(ctx, s * g.H * 0.05, sh + g.H * 0.012, g.H * 0.055, g.H * 0.034, s * 0.4); paper(ctx, '#fffaf0', 1.5, '#c9b99b'); }
    circle(ctx, 0, sh + g.H * 0.03, g.H * 0.016); paper(ctx, P.accent, 1.2);
    for (const s of [-1, 1]) { circle(ctx, s * g.shoulderX, sh + g.H * 0.025, g.H * 0.052); paper(ctx, P.body, 2); }
  },
  rags(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY;
    taper(ctx, sh, hp, g.H * 0.135, g.H * 0.11, 1);
    paper(ctx, vfill(ctx, sh, hp, P.body, 0.1), 2, shade(P.body, -0.45));
    // patches
    rr(ctx, -g.H * 0.09, sh + g.H * 0.06, g.H * 0.07, g.H * 0.07, 2); paper(ctx, P.accent, 1.2);
    rr(ctx, g.H * 0.02, sh + g.H * 0.13, g.H * 0.065, g.H * 0.05, 2); paper(ctx, mix(P.accent, P.body, 0.5), 1.2);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c(rgba('#2a1530', 0.55)); ctx.lineWidth = 1.2; ctx.strokeRect(-g.H * 0.085, sh + g.H * 0.065, g.H * 0.06, g.H * 0.06); ctx.strokeRect(g.H * 0.027, sh + g.H * 0.135, g.H * 0.052, g.H * 0.038); ctx.setLineDash([]);
    // rope belt
    ctx.beginPath(); ctx.moveTo(-g.H * 0.11, hp - g.H * 0.015); ctx.lineTo(g.H * 0.11, hp - g.H * 0.015); strokeOnly(ctx, '#b9946a', 4);
    // frayed shoulder straps
    for (const s of [-1, 1]) { circle(ctx, s * g.shoulderX, sh + g.H * 0.02, g.H * 0.04); paper(ctx, shade(P.body, -0.1), 1.6); }
  },
  armour(ctx, sp) {
    const g = sp.geo, P = sp.pal, sh = g.shoulderY, hp = g.hipY, metal = mix(METAL, P.body, 0.25);
    taper(ctx, sh, hp + g.H * 0.02, g.H * 0.15, g.H * 0.11, 1);
    paper(ctx, hfill(ctx, -g.H * 0.15, g.H * 0.15, metal, 0.22), 2.2, shade(metal, -0.5));
    // tabard
    poly(ctx, [-g.H * 0.055, sh + g.H * 0.02, g.H * 0.055, sh + g.H * 0.02, g.H * 0.05, hp + g.H * 0.1, 0, hp + g.H * 0.075, -g.H * 0.05, hp + g.H * 0.1]); paper(ctx, P.accent, 1.6);
    star(ctx, 0, sh + g.H * 0.1, 6, g.H * 0.035, g.H * 0.015, 0.3); paper(ctx, shade(P.accent, -0.35), 1.2);
    // rivets
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { circle(ctx, s * g.H * (0.1 - k * 0.012), sh + g.H * (0.04 + k * 0.07), g.H * 0.009); fillOnly(ctx, shade(metal, -0.5)); }
    // pauldrons
    for (const s of [-1, 1]) { ell(ctx, s * g.shoulderX, sh + g.H * 0.012, g.H * 0.075, g.H * 0.052, s * -0.3); paper(ctx, hfill(ctx, s * g.shoulderX - 20, s * g.shoulderX + 20, metal, 0.22), 2, shade(metal, -0.5)); circle(ctx, s * g.shoulderX, sh + g.H * 0.012, g.H * 0.016); fillOnly(ctx, P.accent); }
    ell(ctx, 0, sh - g.H * 0.01, g.H * 0.07, g.H * 0.03); paper(ctx, shade(metal, -0.12), 1.6);
  },
};

export function sleeveColor(sp) {
  const P = sp.pal;
  switch (sp.costume) {
    case 'armour': return mix(METAL, P.body, 0.25);
    case 'rags': return shade(P.body, -0.1);
    case 'gown': return shade(P.body, 0.06);
    default: return P.body;
  }
}

export function drawLower(ctx, sp, pv) { (LOWER[sp.costume] || LOWER.coat)(ctx, sp, pv); }
export function drawTorso(ctx, sp, pv) { neck(ctx, sp.geo, sp.skin); (TORSO[sp.costume] || TORSO.coat)(ctx, sp, pv); }

/** One noodle arm: shoulder -> elbow -> hand. `a` = angle from straight down (outward positive), `e` = elbow bend. */
export function armPoints(sp, side, a, e) {
  const g = sp.geo;
  const sx = side * g.shoulderX, sy = g.shoulderY + g.H * 0.025;
  const ex = sx + side * Math.sin(a) * g.armL1, ey = sy + Math.cos(a) * g.armL1;
  const b = a + e;
  const hx = ex + side * Math.sin(b) * g.armL2, hy = ey + Math.cos(b) * g.armL2;
  return { sx, sy, ex, ey, hx, hy };
}

export function drawArm(ctx, sp, side, a, e) {
  const g = sp.geo, p = armPoints(sp, side, a, e), col = sleeveColor(sp);
  ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.ex, p.ey); ctx.lineTo(p.hx, p.hy);
  strokeOnly(ctx, shade(col, -0.5), g.armW + 3.4);
  ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.ex, p.ey); ctx.lineTo(p.hx, p.hy);
  strokeOnly(ctx, col, g.armW);
  if (sp.costume === 'frock' || sp.costume === 'gown' || sp.costume === 'uniform') {
    // cuff
    const dx = p.hx - p.ex, dy = p.hy - p.ey, d = Math.hypot(dx, dy) || 1;
    ctx.beginPath(); ctx.moveTo(p.hx - (dx / d) * g.armW * 0.9, p.hy - (dy / d) * g.armW * 0.9); ctx.lineTo(p.hx - (dx / d) * g.armW * 0.15, p.hy - (dy / d) * g.armW * 0.15);
    strokeOnly(ctx, sp.pal.accent, g.armW + 2);
  }
  // hand: a round mitten
  circle(ctx, p.hx, p.hy, g.armW * 0.78); paper(ctx, sp.handColor, 1.8);
  return p;
}
