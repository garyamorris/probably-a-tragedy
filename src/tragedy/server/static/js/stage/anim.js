// Easing, springs and the particle pool. Pure maths; no DOM.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t) => { t = clamp01(t); return t * t * t; };
export const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutBack = (t) => { t = clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => {
  t = clamp01(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const easeOutBounce = (t) => {
  t = clamp01(t);
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1; return n1 * t * t + 0.984375;
};
/** bump 0..1..0 over [0,1] */
export const hump = (t) => Math.sin(Math.PI * clamp01(t));
/** window: 0 before a, ramps to 1 by b, holds, ramps down c..d */
export function win(t, a, b, c, d) {
  if (t <= a || t >= d) return 0;
  if (t < b) return smooth((t - a) / (b - a));
  if (t <= c) return 1;
  return 1 - smooth((t - c) / (d - c));
}

/**
 * Damped spring on an object's fields: o[k] (value) and o[k+'V'] (velocity). Semi-implicit Euler, stable for
 * omega*dt < ~1.5. `w` = natural frequency (rad/s), `z` = damping ratio.
 */
export function spring(o, k, target, w, z, dt) {
  const kv = k + 'V';
  let v = o[kv] || 0;
  const x = o[k];
  v += (-2 * z * w * v - w * w * (x - target)) * dt;
  o[k] = x + v * dt;
  o[kv] = v;
}

export function snapSpring(o, k, value) { o[k] = value; o[k + 'V'] = 0; }

// ---- particles ---------------------------------------------------------------------------------------------
// One flat pool of reusable structs. kind selects the drawing routine (draw/fx.js).
export class Particles {
  constructor(max = 600) {
    this.max = max;
    this.list = [];
    this.free = [];
  }

  clear() {
    for (const p of this.list) this.free.push(p);
    this.list.length = 0;
  }

  spawn(kind, x, y, o = {}) {
    if (this.list.length >= this.max) return null;
    const p = this.free.pop() || {};
    p.kind = kind;
    p.x = x; p.y = y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.ax = o.ax || 0; p.ay = o.ay || 0;
    p.drag = o.drag == null ? 0 : o.drag;
    p.age = -(o.delay || 0);
    p.life = o.life || 1;
    p.size = o.size || 10;
    p.rot = o.rot || 0; p.vr = o.vr || 0;
    p.color = o.color || '#fff';
    p.color2 = o.color2 || null;
    p.text = o.text || '';
    p.grow = o.grow || 0;
    p.layer = o.layer || 0; // 0 = above everything, 1 = under the proscenium (inside the stage clip)
    p.data = o.data || null;
    this.list.push(p);
    return p;
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); this.free.push(p); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
}
