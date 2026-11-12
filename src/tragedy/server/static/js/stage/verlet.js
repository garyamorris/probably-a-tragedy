// Verlet rope: the marionette strings. Pure maths on typed arrays (no DOM); unit-tested in Node.
// Both ends are pinned (bar anchor above, puppet attachment below). A rope is inextensible but compressible, so when
// `rest` > the anchor distance the string goes visibly slack and sways; when `rest` ~ the distance it is taut.

export class Rope {
  constructor(n = 8) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
  }

  reset(ax, ay, bx, by) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.x[i] = this.px[i] = ax + (bx - ax) * t;
      this.y[i] = this.py[i] = ay + (by - ay) * t;
    }
  }

  /**
   * Advance one step (dt in seconds). `rest` is the total rope length. opts: {g, damp, wind, iters}.
   * Returns the largest segment stretch (for tests).
   */
  step(dt, ax, ay, bx, by, rest, o = {}) {
    const n = this.n, x = this.x, y = this.y, px = this.px, py = this.py;
    const g = o.g == null ? 1500 : o.g;
    const damp = o.damp == null ? 0.985 : o.damp;
    const wind = o.wind || 0;
    const iters = o.iters || 6;
    const dt2 = dt * dt;
    // pin ends
    x[0] = px[0] = ax; y[0] = py[0] = ay;
    x[n - 1] = px[n - 1] = bx; y[n - 1] = py[n - 1] = by;
    for (let i = 1; i < n - 1; i++) {
      const vx = (x[i] - px[i]) * damp;
      const vy = (y[i] - py[i]) * damp;
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx + wind * dt2 * (0.6 + 0.4 * Math.sin(i * 1.7));
      y[i] += vy + g * dt2;
    }
    const seg = rest / (n - 1);
    let worst = 0;
    // alternate forward / backward sweeps so tension propagates from both pinned ends (taut strings stay straight)
    for (let k = 0; k < iters; k++) {
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < n - 1; j++) {
          const i = pass === 0 ? j : n - 2 - j;
          let dx = x[i + 1] - x[i], dy = y[i + 1] - y[i];
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          if (d <= seg) continue; // compressible
          const diff = (d - seg) / d;
          dx *= diff; dy *= diff;
          const wa = i === 0 ? 0 : 1, wb = i + 1 === n - 1 ? 0 : 1;
          const wsum = wa + wb;
          if (wsum === 0) continue;
          x[i] += (dx * wa) / wsum; y[i] += (dy * wa) / wsum;
          x[i + 1] -= (dx * wb) / wsum; y[i + 1] -= (dy * wb) / wsum;
        }
      }
    }
    // Gauss-Seidel converges slowly on nearly-taut chains, so blend toward the straight line as slack -> 0.
    const dist = Math.hypot(bx - ax, by - ay) || 1e-6;
    const slack = rest / dist - 1;
    if (slack < 0.05) {
      const w = Math.min(1, Math.max(0, 1 - slack / 0.05));
      const k = w * w;
      for (let i = 1; i < n - 1; i++) {
        const t = i / (n - 1);
        x[i] += (ax + (bx - ax) * t - x[i]) * k;
        y[i] += (ay + (by - ay) * t - y[i]) * k;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const d = Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]);
      if (d / seg > worst) worst = d / seg;
    }
    return worst;
  }

  /** Nudge node `idx` toward (tx,ty) by fraction k (knots / tangles). Call before step()'s constraint pass is fine. */
  pull(idx, tx, ty, k) {
    this.x[idx] += (tx - this.x[idx]) * k;
    this.y[idx] += (ty - this.y[idx]) * k;
  }

  /** Total polyline length (for tests). */
  length() {
    let L = 0;
    for (let i = 0; i < this.n - 1; i++) L += Math.hypot(this.x[i + 1] - this.x[i], this.y[i + 1] - this.y[i]);
    return L;
  }
}

/**
 * Tangle two ropes at node `idx`: both nodes are drawn toward their midpoint (strength 0..1), so the strings visibly
 * cross and bunch. Returns the knot centre.
 */
export function knotTogether(a, b, idx, strength) {
  const mx = (a.x[idx] + b.x[idx]) / 2, my = (a.y[idx] + b.y[idx]) / 2;
  a.pull(idx, mx, my, strength);
  b.pull(idx, mx, my, strength);
  return { x: mx, y: my };
}

/** How many knots (0..3) and how strong, for a given chaos (0..100). */
export function tangleFor(chaos) {
  const t = Math.max(0, Math.min(1, (chaos - 28) / 62));
  return { t, knots: t < 0.12 ? 0 : t < 0.45 ? 1 : t < 0.8 ? 2 : 3, strength: Math.min(0.85, 0.15 + t * 0.8) };
}
