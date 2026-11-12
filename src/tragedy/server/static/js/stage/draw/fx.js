// Particles (hearts, sweat, steam, tears, tomatoes, impact words...) and the stage-cue effects
// (colour wash, spotlight cone, fog, thunder flash + lightning, the trapdoor hatch).

import { OPEN, LIP_Y, FLOOR_Y, HORIZON_Y } from '../layout.js';
import { c, shade, mix, rgba } from '../color.js';
import { easeOutBack, easeOutCubic, smooth, clamp01 } from '../anim.js';
import { paper, poly, rr, ell, circle, star, strokeOnly, fillOnly, vgrad, hgrad, rgrad, glow, heartPath, outlinedText, FONT_UI, FONT_DISPLAY } from './shapes.js';

// ---- particles -----------------------------------------------------------------------------------------------------------
function spiky(ctx, cx, cy, r, spikes, rot) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rr_ = i % 2 === 0 ? r : r * 0.62, a = rot + (i * Math.PI) / spikes;
    const x = cx + Math.cos(a) * rr_, y = cy + Math.sin(a) * rr_;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const DRAW = {
  heart(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    ctx.save(); ctx.translate(p.x + Math.sin(p.age * 5 + p.rot) * 6, p.y); ctx.rotate(Math.sin(p.age * 3 + p.rot) * 0.25);
    const s = p.size * (0.6 + 0.4 * easeOutBack(k * 4));
    heartPath(ctx, 0, 0, s * 0.5); paper(ctx, p.color, 1.6);
    ctx.restore();
  },
  sweat(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.quadraticCurveTo(p.size * 0.8, 0, 0, p.size * 0.7); ctx.quadraticCurveTo(-p.size * 0.8, 0, 0, -p.size); paper(ctx, p.color || '#8fd0ff', 1.4);
    ctx.restore();
  },
  steam(ctx, p, k) {
    ctx.globalAlpha = (1 - k) * 0.7;
    circle(ctx, p.x, p.y, p.size * (0.5 + k * 1.1)); fillOnly(ctx, p.color || '#f6ecd6');
  },
  tear(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - p.size); ctx.quadraticCurveTo(p.x + p.size * 0.7, p.y, p.x, p.y + p.size * 0.7); ctx.quadraticCurveTo(p.x - p.size * 0.7, p.y, p.x, p.y - p.size); paper(ctx, '#7fc8ff', 1.2);
  },
  spark(ctx, p, k) {
    const tw = 0.6 + 0.4 * Math.sin(p.age * 18 + p.rot);
    ctx.globalAlpha = (1 - k) * tw;
    star(ctx, p.x, p.y, 4, p.size * (1 - k * 0.4), p.size * 0.22, p.rot + p.age * 2); fillOnly(ctx, p.color || '#f7dc8c');
  },
  star(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    star(ctx, p.x, p.y, 5, p.size * (0.5 + 0.5 * easeOutBack(k * 3)), p.size * 0.42, p.rot); paper(ctx, p.color || '#f2c14e', 1.4);
  },
  dust(ctx, p, k) {
    ctx.globalAlpha = (1 - k) * 0.55;
    circle(ctx, p.x, p.y, p.size * (0.5 + k * 1.3)); fillOnly(ctx, p.color || '#e6d6bd');
  },
  bit(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = c(p.color || '#a06f48'); ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); ctx.restore();
  },
  confetti(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k * k;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.age * 9 + p.rot)); ctx.fillStyle = c(p.color); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
  },
  tomato(ctx, p, k) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    circle(ctx, 0, 0, p.size); paper(ctx, '#d6361f', 1.8, '#7a1008');
    star(ctx, 0, -p.size * 0.78, 5, p.size * 0.5, p.size * 0.2, 0.3); paper(ctx, '#4f8a3a', 1.2);
    circle(ctx, -p.size * 0.35, -p.size * 0.25, p.size * 0.22); fillOnly(ctx, 'rgba(255,255,255,.4)');
    ctx.restore();
  },
  splat(ctx, p, k) {
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.save(); ctx.translate(p.x, p.y);
    spiky(ctx, 0, 0, p.size * (0.6 + 0.4 * easeOutCubic(k * 4)), 9, p.rot); fillOnly(ctx, '#c42d18');
    circle(ctx, -p.size * 0.2, -p.size * 0.1, p.size * 0.2); fillOnly(ctx, '#e9593e');
    ctx.restore();
  },
  rain(ctx, p, k) {
    ctx.globalAlpha = 0.85 * (1 - k * 0.4);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); strokeOnly(ctx, '#dcecff', 3);
  },
  zzz(ctx, p, k) {
    ctx.globalAlpha = Math.sin(Math.PI * k) * 0.95;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.2);
    ctx.font = `800 ${p.size * (0.7 + k * 0.6)}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = c('#1b0f1f'); ctx.lineJoin = 'round'; ctx.strokeText('Z', 0, 0); ctx.fillStyle = c('#b8a1e3'); ctx.fillText('Z', 0, 0);
    ctx.restore();
  },
  float(ctx, p, k) {
    ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - smooth((k - 0.6) / 0.4);
    outlinedText(ctx, p.text, p.x, p.y, `800 ${p.size}px ${FONT_UI}`, p.color || '#f7dc8c', '#1b0f1f', Math.max(3, p.size * 0.18));
  },
  ring(ctx, p, k) {
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (0.2 + k * 1.2), p.size * (0.2 + k * 1.2) * 0.6, 0, 0, 6.3); strokeOnly(ctx, p.color || '#f7dc8c', 4 * (1 - k) + 1);
  },
  orb(ctx, p, k) {
    const tr = p.data && p.data.trail;
    if (tr) { for (let i = 0; i < tr.length; i++) { const f = i / tr.length; ctx.globalAlpha = f * 0.6; circle(ctx, tr[i][0], tr[i][1], p.size * f * 0.8); fillOnly(ctx, p.color || '#f7dc8c'); } }
    ctx.globalAlpha = 1;
    glow(ctx, p.x, p.y, p.size * 3.4, p.color || '#f7dc8c', 0.8);
    circle(ctx, p.x, p.y, p.size); fillOnly(ctx, '#fff6d8');
  },
  glint(ctx, p, k) {
    ctx.globalAlpha = Math.sin(Math.PI * k);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size); strokeOnly(ctx, p.color || '#fff6d8', 3);
    ctx.restore();
  },
  puff(ctx, p, k) {
    // laughter / gasp bubble with a text word
    const pop = easeOutBack(clamp01(k * 5));
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.2); ctx.scale(pop, pop);
    ctx.font = `900 ${p.size}px ${FONT_UI}`;
    const w = ctx.measureText(p.text).width + p.size * 0.9, h = p.size * 1.5;
    rr(ctx, -w / 2, -h / 2, w, h, h / 2); paper(ctx, p.color2 || '#fff6e2', 2.4, '#2a1630');
    poly(ctx, [-w * 0.15, h / 2 - 2, -w * 0.02, h / 2 - 2, -w * 0.28, h / 2 + p.size * 0.55]); paper(ctx, p.color2 || '#fff6e2', 2, '#2a1630');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c(p.color || '#b3263d'); ctx.fillText(p.text, 0, 2);
    ctx.restore();
  },
  word(ctx, p, k) {
    // the comic-strip impact word on a spiky burst
    const pop = easeOutBack(clamp01(k * 6));
    const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    ctx.globalAlpha = fade;
    ctx.save(); ctx.translate(p.x, p.y - k * 18); ctx.rotate(p.rot * 0.35); ctx.scale(pop, pop);
    ctx.font = `900 ${p.size}px ${FONT_UI}`;
    const w = ctx.measureText(p.text).width;
    ctx.save(); ctx.scale(1, 0.62); spiky(ctx, 4, 6, w * 0.58 + p.size * 0.62, 11, 0.2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); spiky(ctx, 0, 0, w * 0.58 + p.size * 0.62, 11, 0.2); paper(ctx, p.color2 || '#f2c14e', 4, '#2a1630'); ctx.restore();
    ctx.lineWidth = Math.max(5, p.size * 0.2); ctx.lineJoin = 'round'; ctx.strokeStyle = c('#2a1630'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = c(p.color || '#b3263d'); ctx.fillText(p.text, 0, 0);
    ctx.restore();
  },
  exclaim(ctx, p, k) {
    const pop = easeOutBack(clamp01(k * 6));
    ctx.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.age * 8) * 3); ctx.scale(pop, pop);
    circle(ctx, 0, 0, p.size); paper(ctx, '#ee6c4d', 2.6, '#2a1630');
    ctx.font = `900 ${p.size * 1.3}px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c('#fff6e2'); ctx.fillText(p.text || '!', 0, 2);
    ctx.restore();
  },
  stars_orbit(ctx, p, k) {
    ctx.globalAlpha = 1 - k * k;
    for (let i = 0; i < 3; i++) { const a = p.age * 6 + (i * Math.PI * 2) / 3; star(ctx, p.x + Math.cos(a) * p.size * 1.6, p.y + Math.sin(a) * p.size * 0.5, 5, p.size * 0.5, p.size * 0.2, a); paper(ctx, '#f7dc8c', 1.2); }
  },
  note(ctx, p, k) {
    ctx.globalAlpha = Math.sin(Math.PI * k);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.2);
    ell(ctx, 0, 0, p.size * 0.5, p.size * 0.36, -0.4); fillOnly(ctx, p.color || '#b8a1e3');
    ctx.beginPath(); ctx.moveTo(p.size * 0.42, -2); ctx.lineTo(p.size * 0.42, -p.size * 1.3); strokeOnly(ctx, p.color || '#b8a1e3', 3);
    ctx.restore();
  },
};

export function drawParticle(ctx, p) {
  if (p.age < 0) return;
  const k = p.age / p.life;
  const f = DRAW[p.kind];
  if (!f) return;
  ctx.save();
  f(ctx, p, k);
  ctx.restore();
}

export const IMPACT = {
  lean_left: ['LEEEAN!', 'TILT!', 'WHOA-OA!'],
  collapse: ['CLONK!', 'FLOP!', 'TIMBER!'],
  spin: ['WHEEE!', 'WHIRL!', 'SPIN!'],
  wobble: ['WOBBLE!', 'WHOOPS!', 'ERK!'],
  hide: ['EEP!', 'PEEK...', 'NOPE!'],
  fly: ['WHOOSH!', 'BOING!', 'UP!'],
  freeze: ['BLANK!', 'GULP...', 'FREEZE!'],
  shake: ['BRRR!', 'RATTLE!', 'EEK!'],
  flip: ['FLIP!', 'WHUMP!', 'TA-DA?'],
  slide: ['SKRRRT!', 'WHEEE!', 'ZOOM!'],
  bow: ['BRAVO?', 'TA-DA!', 'TOO SOON!'],
  drop_prop: ['CLATTER!', 'CLONK!', 'OOPS!'],
};
export const IMPACT_COLOR = { collapse: '#b3263d', lean_left: '#8d3ad0', spin: '#1f8a8a', wobble: '#c4521a', hide: '#4a4e69', fly: '#1f6fb0', freeze: '#1f7fb0', shake: '#4a6ad0', flip: '#c42d6a', slide: '#2f8a4a', bow: '#a97c1f', drop_prop: '#b3263d' };

// ---- cue effects (all drawn clipped to the stage opening) ------------------------------------------------------------
export function drawWash(ctx, kind, a, t) {
  const { x0, y0, w, h } = OPEN;
  const col = kind === 'sick' ? '#a6e22e' : '#ffc857';
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = rgba(col, 0.75 * a); ctx.fillRect(x0, y0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  if (kind === 'sick') { ctx.fillStyle = rgba('#c62a8a', 0.14 * a * (0.7 + 0.3 * Math.sin(t * 7))); ctx.fillRect(x0, y0, w, h); }
  else { ctx.fillStyle = rgba('#ffd98a', 0.08 * a); ctx.fillRect(x0, y0, w, h); }
  ctx.restore();
}

export function drawSpot(ctx, x, y, a, t, lampX) {
  const { x0, y0, w, h } = OPEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  // darken everything except a pool of light on the target
  const cy = y;
  const g = ctx.createRadialGradient(x, cy, 70, x, cy, 360);
  g.addColorStop(0, 'rgba(8,2,12,0)'); g.addColorStop(0.55, `rgba(8,2,12,${0.5 * a})`); g.addColorStop(1, `rgba(8,2,12,${0.78 * a})`);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  // the beam
  ctx.globalCompositeOperation = 'lighter';
  const lx = lampX == null ? (x < 800 ? x0 + 130 : x1() - 130) : lampX;
  const bg = ctx.createLinearGradient(lx, y0, x, cy);
  bg.addColorStop(0, `rgba(255,236,170,${0.34 * a})`); bg.addColorStop(1, `rgba(255,236,170,${0.08 * a})`);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(lx - 16, y0); ctx.lineTo(lx + 16, y0); ctx.lineTo(x + 120, FLOOR_Y + 10); ctx.lineTo(x - 120, FLOOR_Y + 10); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ell(ctx, x, FLOOR_Y + 6, 130, 26); ctx.fillStyle = rgba('#fff3c0', 0.35 * a); ctx.fill();
  // the lamp
  rr(ctx, lx - 24, y0 - 4, 48, 30, 6); paper(ctx, '#2a2030', 2, '#8a8296');
  glow(ctx, lx, y0 + 28, 44, '#fff3c0', 0.9 * a);
  ctx.restore();
}
const x1 = () => OPEN.x1;

export function drawFog(ctx, a, t, calm) {
  const { x0, y0, w, h } = OPEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  for (let L = 0; L < 5; L++) {
    const spd = (L % 2 ? -1 : 1) * (12 + L * 7) * (calm ? 0.2 : 1);
    const baseY = FLOOR_Y + 60 - L * 46;
    for (let i = -1; i < 5; i++) {
      const cx = x0 + ((i * 420 + t * spd + L * 170) % (w + 800)) - 200;
      const cy = baseY + Math.sin(t * 0.3 + i + L) * 8;
      const rad = 170 + L * 24;
      ctx.fillStyle = rgrad(ctx, cx, cy, 0, rad, [[0, rgba('#e9e4f3', 0.34 * a * (1 - L * 0.1))], [1, rgba('#e9e4f3', 0)]]);
      ctx.fillRect(cx - rad, cy - rad * 0.55, rad * 2, rad * 1.1);
    }
  }
  ctx.restore();
}

export function drawFlash(ctx, a) {
  if (a <= 0.01) return;
  const { x0, y0, w, h } = OPEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.fillStyle = `rgba(240,246,255,${a})`; ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}

export function drawBolt(ctx, pts, a) {
  if (a <= 0.01 || !pts) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(OPEN.x0, OPEN.y0, OPEN.w, OPEN.h); ctx.clip();
  ctx.globalAlpha = a;
  for (const [lw, col] of [[16, 'rgba(180,200,255,.35)'], [6, '#f2f6ff']]) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.strokeStyle = col; ctx.stroke();
  }
  ctx.restore();
}

/** The trapdoor: a floor hatch at (x,y) that swings open (open 0..1) and closes. */
export function drawHatch(ctx, x, y, open) {
  if (open <= 0.01) return;
  const w = 150, h = 34;
  ctx.save();
  ctx.translate(x, y);
  // hole
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2 + 14, h); ctx.lineTo(-w / 2 - 14, h); ctx.closePath();
  ctx.fillStyle = rgrad(ctx, 0, h * 0.5, 4, w * 0.6, [[0, '#2a0f3a'], [1, '#0a0410']]); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = c('#4a2a1e'); ctx.stroke();
  glow(ctx, 0, h * 0.4, 70 * open, '#b88cff', 0.45 * open);
  // lid, hinged at the back edge
  const lh = h * (1 - open) + 6 * open;
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2 + 14 * (1 - open), -lh * 0.0 + lh); ctx.lineTo(-w / 2 - 14 * (1 - open), lh); ctx.closePath();
  ctx.save(); ctx.translate(0, -h * open * 1.3); paper(ctx, '#7a4e34', 2.4, '#3a2418'); ctx.restore();
  ctx.restore();
}
