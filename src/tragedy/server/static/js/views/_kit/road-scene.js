// The road: a parallax canvas scene of the wagon pulled by a tireless ostrich, trundling from town A to town B.
// Procedural paper-craft drawing (flat fills, ink outlines). Time-based; honours reduced motion by drawing still frames only.
import { mix, shade, hash, clamp } from './pure.js';

const INK = '#241a26';
const WORLD = 1900; // world units between the two towns' signs

const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RoadScene {
  /**
   * opts: {skyFrom:{top,bottom,body,stars}, skyTo:{...}, landmarks:{from:Image|null, to:Image|null}, puppets:[colour,...],
   *        townFrom:string, townTo:string, reduced:boolean, seed}
   */
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.o = opts;
    this.reduced = !!opts.reduced;
    this.pct = 0; // target progress 0-100
    this.off = 0; // world offset travelled
    this.vel = 0; // world units / second (for wheels, legs, parallax shimmer)
    this.moving = false;
    this.t = 0;
    this.phase = 0;
    this.weather = null;
    this.state = 'idle'; // idle | roll | crashed | recovering | arrived
    this.crashAt = 0;
    this.wheelOff = 0;
    this.smoke = [];
    this.raf = 0;
    this.last = 0;
    this.W = 800;
    this.H = 360;
    this.dpr = 1;
    this.seed = opts.seed ?? 7;
    this.trees = this._makeTrees();
    this._tick = this._tick.bind(this);
    this.resize();
  }

  _makeTrees() {
    const r = rng(this.seed * 977 + 13);
    return Array.from({ length: 40 }, (_, i) => ({ x: i * 120 + r() * 80, h: 40 + r() * 46, kind: r() < 0.55 ? 'pine' : 'round', shade: r() }));
  }

  /* ------------------------------------------------------------------ control */
  start() {
    if (this.raf || this.reduced) { this.draw(); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  destroy() { this.stop(); }
  resize() {
    const r = this.c.getBoundingClientRect();
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.W = Math.max(280, r.width || 800);
    this.H = Math.max(180, r.height || 360);
    this.c.width = Math.round(this.W * this.dpr);
    this.c.height = Math.round(this.H * this.dpr);
    this.draw();
  }
  setProgress(pct) {
    this.pct = clamp(pct, 0, 100);
    this.moving = this.state !== 'crashed';
    if (this.reduced) { this.off = (this.pct / 100) * WORLD; this.draw(); }
  }
  setMoving(m) { this.moving = m; }
  setWeather(kind) { this.weather = kind; if (this.reduced) this.draw(); }
  crash() { this.state = 'crashed'; this.crashAt = this.t; this.moving = false; this.vel = 0; if (this.reduced) this.draw(); }
  recover() { if (this.state === 'crashed') { this.state = 'recovering'; this.crashAt = this.t; } if (this.reduced) { this.state = 'roll'; this.draw(); } }
  arrive() { this.pct = 100; this.state = 'arrived'; this.moving = true; if (this.reduced) { this.off = WORLD; this.draw(); } }
  get progressPx() { return this.off; }
  jump() { this.off = (this.pct / 100) * WORLD; this.vel = 0; this.draw(); }
  /** Resolves when the wagon has (nearly) caught up with the target progress, so the show waits for the trundle. */
  settle(life, maxMs = 5200) {
    return new Promise((resolve) => {
      if (this.reduced || life?.fast) return resolve();
      const t0 = performance.now();
      const iv = setInterval(() => {
        const target = (this.pct / 100) * WORLD;
        if (life?.dead || life?.fast || this.state === 'crashed' || Math.abs(target - this.off) < 36 || performance.now() - t0 > maxMs / (life?.speed || 1)) { clearInterval(iv); resolve(); }
      }, 60);
    });
  }

  _tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const target = (this.pct / 100) * WORLD;
    if (this.state === 'crashed') { this.vel = lerp(this.vel, 0, Math.min(1, dt * 5)); }
    else {
      const d = target - this.off;
      const want = this.moving ? clamp(d * 1.4, 0, 260) : 0;
      this.vel = lerp(this.vel, want, Math.min(1, dt * 3));
      if (Math.abs(d) < 0.5 && this.state === 'arrived') this.vel = lerp(this.vel, 0, Math.min(1, dt * 4));
      this.off += this.vel * dt;
      if (this.state === 'recovering' && this.t - this.crashAt > 1.4) this.state = 'roll';
    }
    this.phase += (this.vel / 60) * dt * 4.4 + dt * 0.5; // legs keep a tiny idle shuffle
    // smoke puffs while crashed
    if (this.state === 'crashed' && Math.random() < dt * 14) this.smoke.push({ x: 0, y: 0, a: 1, r: 6 + Math.random() * 6, vx: (Math.random() - 0.3) * 14, vy: -22 - Math.random() * 18 });
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.a -= dt * 0.55; s.r += dt * 12; }
    this.smoke = this.smoke.filter((s) => s.a > 0);
    this.draw();
    this.raf = requestAnimationFrame(this._tick);
  }

  /* ------------------------------------------------------------------ drawing */
  draw() {
    const g = this.g;
    const { W, H } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const pct = this.state === 'arrived' ? 1 : clamp(this.off / WORLD, 0, 1);
    this._sky(g, pct);
    this._hills(g, 0.12, 0.5, 0.17, '#6a4575', 0.55);
    this._landmarks(g);
    this._hills(g, 0.3, 0.62, 0.12, '#4d2e58', 0.65);
    this._trees(g);
    this._ground(g);
    this._signs(g);
    this._party(g);
    this._weather(g);
    // vignette
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(19,10,23,.5)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  _sky(g, pct) {
    const { W, H } = this;
    const a = this.o.skyFrom || { top: '#6a4575', bottom: '#f09a6b', body: '#ffd9a0' };
    const b = this.o.skyTo || a;
    const top = mix(a.top, b.top, pct);
    const bot = mix(a.bottom, b.bottom, pct);
    const grd = g.createLinearGradient(0, 0, 0, H * 0.72);
    grd.addColorStop(0, top); grd.addColorStop(1, bot);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const night = (a.stars && pct < 0.5) || (b.stars && pct >= 0.5);
    if (night) {
      const r = rng(this.seed + 5);
      for (let i = 0; i < 46; i++) {
        const tw = 0.5 + 0.5 * Math.sin(this.t * 2 + i);
        g.fillStyle = `rgba(255,248,214,${0.35 + 0.5 * tw})`;
        g.fillRect(r() * W, r() * H * 0.5, 2, 2);
      }
    }
    const body = (pct < 0.5 ? a : b).body;
    if (body) {
      const sx = W * 0.78 - this.off * 0.02, sy = H * 0.2;
      const glow = g.createRadialGradient(sx, sy, 4, sx, sy, 90);
      glow.addColorStop(0, 'rgba(255,240,190,.75)'); glow.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = glow; g.fillRect(sx - 100, sy - 100, 200, 200);
      g.fillStyle = body; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.arc(sx, sy, 26, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // clouds
    const rc = rng(this.seed + 31);
    for (let i = 0; i < 6; i++) {
      const base = rc() * W * 2.2;
      const x = ((base - this.off * 0.1 - this.t * 6) % (W * 2.2) + W * 2.2) % (W * 2.2) - W * 0.4;
      const y = H * (0.08 + rc() * 0.22);
      const s = 0.8 + rc() * 0.9;
      g.fillStyle = 'rgba(255,255,255,.55)'; g.strokeStyle = 'rgba(36,26,38,.5)'; g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 18 * s, Math.PI, 0); g.arc(x + 26 * s, y - 6 * s, 22 * s, Math.PI, 0); g.arc(x + 54 * s, y, 16 * s, Math.PI, 0);
      g.lineTo(x + 70 * s, y + 10 * s); g.lineTo(x - 18 * s, y + 10 * s); g.closePath(); g.fill(); g.stroke();
    }
  }

  _hills(g, factor, baseY, amp, colour, alpha) {
    const { W, H } = this;
    const col = mix(this.o.skyFrom?.bottom || '#f09a6b', colour, 0.7);
    g.fillStyle = col; g.globalAlpha = alpha + 0.3; g.strokeStyle = INK; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) {
      const wx = x + this.off * factor;
      const y = H * baseY - Math.sin(wx * 0.006 + factor * 9) * H * amp * 0.5 - Math.sin(wx * 0.0021 + 1.7) * H * amp * 0.5;
      g.lineTo(x, y);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    g.globalAlpha = 1; g.stroke();
  }

  _landmarks(g) {
    const { W, H } = this;
    const { from, to } = this.o.landmarks || {};
    const wx = W * 0.3;
    const size = Math.min(210, H * 0.62);
    const baseY = H * 0.6;
    const f = 0.5;
    if (from) g.drawImage(from, wx - this.off * f - size * 0.9, baseY - size * 0.95, size, size);
    if (to) g.drawImage(to, wx + (WORLD * f + 360) - this.off * f - size * 0.2, baseY - size * 0.95, size, size);
  }

  _trees(g) {
    const { W, H } = this;
    const gy = H * 0.74;
    const f = 0.62;
    const span = this.trees.length * 120;
    for (const t of this.trees) {
      let x = ((t.x - this.off * f) % span + span) % span - 80;
      if (x > W + 60) continue;
      const sc = H / 300;
      const h = t.h * sc;
      g.strokeStyle = INK; g.lineWidth = 2;
      g.fillStyle = '#5a3a22';
      g.fillRect(x - 3 * sc, gy - h * 0.35, 6 * sc, h * 0.4); g.strokeRect(x - 3 * sc, gy - h * 0.35, 6 * sc, h * 0.4);
      g.fillStyle = shade('#3f6b3c', t.shade * 0.3 - 0.25);
      g.beginPath();
      if (t.kind === 'pine') { g.moveTo(x, gy - h); g.lineTo(x + 18 * sc, gy - h * 0.25); g.lineTo(x - 18 * sc, gy - h * 0.25); }
      else g.arc(x, gy - h * 0.62, 20 * sc, 0, Math.PI * 2);
      g.closePath(); g.fill(); g.stroke();
    }
  }

  _ground(g) {
    const { W, H } = this;
    const gy = H * 0.74;
    const grass = g.createLinearGradient(0, gy, 0, H);
    grass.addColorStop(0, '#6fa24f'); grass.addColorStop(1, '#3f6b3c');
    g.fillStyle = grass; g.fillRect(0, gy, W, H - gy);
    g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
    // the road
    const ry = H * 0.82, rh = H * 0.13;
    g.fillStyle = '#d9c49a'; g.fillRect(0, ry, W, rh);
    g.fillStyle = 'rgba(120,80,40,.28)'; g.fillRect(0, ry + rh * 0.7, W, rh * 0.3);
    g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, ry); g.lineTo(W, ry); g.moveTo(0, ry + rh); g.lineTo(W, ry + rh); g.stroke();
    // dashes
    g.strokeStyle = 'rgba(246,236,214,.85)'; g.lineWidth = 3; g.setLineDash([26, 30]); g.lineDashOffset = this.off % 56;
    g.beginPath(); g.moveTo(0, ry + rh * 0.5); g.lineTo(W, ry + rh * 0.5); g.stroke(); g.setLineDash([]);
    // roadside poles and tufts
    const r = rng(this.seed + 77);
    for (let i = 0; i < 24; i++) {
      const base = i * 260 + r() * 60;
      const x = (((base - this.off * 1.0) % (24 * 260)) + 24 * 260) % (24 * 260) - 120;
      if (x > W + 40) continue;
      g.strokeStyle = INK; g.lineWidth = 2.2; g.fillStyle = '#8a5a33';
      if (i % 3 === 0) { g.fillRect(x - 3, gy - H * 0.1, 6, H * 0.14); g.strokeRect(x - 3, gy - H * 0.1, 6, H * 0.14); }
      else { g.beginPath(); g.moveTo(x - 6, ry - 3); g.lineTo(x, ry - 16); g.lineTo(x + 6, ry - 3); g.strokeStyle = '#2f5a2d'; g.lineWidth = 3; g.stroke(); }
    }
    // foreground tufts (parallax > 1)
    for (let i = 0; i < 18; i++) {
      const base = i * 190 + r() * 90;
      const x = (((base - this.off * 1.35) % (18 * 190)) + 18 * 190) % (18 * 190) - 60;
      if (x > W + 40) continue;
      const y = ry + rh + (H - ry - rh) * (0.25 + (i % 3) * 0.3);
      g.strokeStyle = '#2b5a2d'; g.lineWidth = 3; g.beginPath();
      g.moveTo(x, y); g.lineTo(x - 5, y - 12); g.moveTo(x, y); g.lineTo(x + 1, y - 15); g.moveTo(x, y); g.lineTo(x + 6, y - 11); g.stroke();
    }
  }

  _signs(g) {
    const { W, H } = this;
    const wagonX = W * 0.3;
    const gy = H * 0.82;
    const sign = (wx, label, colour) => {
      const x = wagonX + wx - this.off;
      if (x < -140 || x > W + 140) return;
      const s = Math.min(1.2, H / 300);
      g.save(); g.translate(x, gy); g.scale(s, s);
      g.fillStyle = '#8a5a33'; g.strokeStyle = INK; g.lineWidth = 3;
      g.fillRect(-4, -92, 8, 96); g.strokeRect(-4, -92, 8, 96);
      g.fillStyle = colour; g.beginPath(); g.moveTo(-58, -108); g.lineTo(46, -108); g.lineTo(62, -92); g.lineTo(46, -76); g.lineTo(-58, -76); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = INK; g.font = '700 13px ui-serif, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let txt = label; while (g.measureText(txt).width > 92 && txt.length > 4) txt = txt.slice(0, -2);
      if (txt !== label) txt += '..';
      g.fillText(txt, -4, -92);
      g.restore();
    };
    sign(-210, this.o.townFrom || 'Behind us', '#f6d28b');
    sign(WORLD + 360, this.o.townTo || 'Ahead', '#9fe1d7');
  }

  _party(g) {
    const { W, H } = this;
    const x0 = W * 0.3;
    const gy = H * 0.835;
    const sc = clamp(H / 270, 0.7, 1.35);
    const t = this.t;
    g.save();
    g.translate(x0, gy);
    g.scale(sc, sc);
    // shadow
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(95, 6, 150, 10, 0, 0, Math.PI * 2); g.fill();

    const crashed = this.state === 'crashed';
    const rec = this.state === 'recovering';
    const since = t - this.crashAt;
    const wobble = crashed ? Math.sin(since * 26) * Math.max(0.04, 0.16 * Math.exp(-since * 0.8)) + 0.05 : rec ? Math.sin(since * 14) * 0.06 * Math.max(0, 1 - since / 1.4) : 0;
    const bump = this.vel > 4 ? Math.sin(this.phase * 2.1) * 1.6 : 0;
    this._wagon(g, wobble, bump, crashed, rec ? clamp(since / 1.2, 0, 1) : crashed ? 0 : 1);
    this._ostrich(g, bump);
    // harness
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(112, -22 + bump); g.quadraticCurveTo(150, -14, 178, -34 + bump * 0.5); g.stroke();
    // smoke
    for (const s of this.smoke) {
      g.fillStyle = `rgba(80,70,90,${Math.max(0, s.a * 0.6)})`;
      g.beginPath(); g.arc(30 + s.x, -52 + s.y, s.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  _wagon(g, wobble, bump, crashed, wheelBack) {
    g.save();
    g.translate(40, bump);
    g.rotate(wobble);
    // body
    g.fillStyle = '#b3263d'; g.strokeStyle = INK; g.lineWidth = 3.2; g.lineJoin = 'round';
    this._rr(g, -50, -64, 124, 58, 6); g.fill(); g.stroke();
    // trim
    g.fillStyle = '#e9b949'; g.fillRect(-50, -26, 124, 7); g.strokeRect(-50, -26, 124, 7);
    // roof (canvas hoop)
    g.fillStyle = '#f6ecd6';
    g.beginPath(); g.moveTo(-56, -62); g.quadraticCurveTo(12, -128, 80, -62); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(36,26,38,.5)'; g.lineWidth = 1.6;
    for (let i = -34; i <= 58; i += 18) { g.beginPath(); g.moveTo(i + 6, -64); g.quadraticCurveTo(i + 10, -92, i + 18, -108); g.stroke(); }
    // sign
    g.fillStyle = '#f6d28b'; g.strokeStyle = INK; g.lineWidth = 2.4; this._rr(g, -38, -56, 88, 22, 4); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = '800 9.5px ui-serif, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WIBBLING PLAYERS', 6, -45);
    // peeking puppet heads
    const cols = this.o.puppets || ['#c0566e', '#4d3a6b', '#9bb7d4'];
    cols.slice(0, 3).forEach((c, i) => {
      const hx = -22 + i * 28;
      const hy = -76 - Math.max(0, Math.sin(this.phase * 1.3 + i * 2)) * 5 - 6;
      g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2.2;
      g.beginPath(); g.arc(hx, hy, 8, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = INK; g.fillRect(hx - 4, hy - 2, 2, 3); g.fillRect(hx + 2, hy - 2, 2, 3);
    });
    // lantern
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(-56, -34, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    // wheels
    const spin = this.off / 22;
    this._wheel(g, -20, 2, 24, spin, 1);
    this._wheel(g, 52, 2, 24, spin + 1, wheelBack);
    g.restore();
  }

  _wheel(g, x, y, r, spin, attached) {
    g.save();
    let ox = 0, oy = 0, rot = spin;
    if (attached < 1) { // the wheel has come off: it rolls ahead, then is put back on
      const k = attached;
      ox = (1 - k) * 90; oy = (1 - k) * 4 - Math.sin(k * Math.PI) * 6; rot = spin * 3 + (1 - k) * 9;
    }
    g.translate(x + ox, y + oy);
    g.rotate(rot);
    g.fillStyle = '#6b3f22'; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#e9b949'; g.lineWidth = 2.6;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3)); g.stroke(); }
    g.fillStyle = '#e9b949'; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  _ostrich(g, bump) {
    const p = this.phase;
    const moving = this.vel > 6;
    g.save();
    g.translate(186, 0);
    g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
    // legs: two-segment, alternating
    const leg = (side) => {
      const ph = p + side * Math.PI;
      const swing = moving ? Math.sin(ph) * 22 : side * 3;
      const lift = moving ? Math.max(0, Math.cos(ph)) * 14 : 0;
      const hipX = side * 6 - 2, hipY = -52;
      const kneeX = hipX + swing * 0.5 + 6, kneeY = -28 - lift * 0.4;
      const footX = hipX + swing, footY = -2 - lift;
      g.strokeStyle = INK; g.lineWidth = 7.5;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      g.strokeStyle = '#f2a59a'; g.lineWidth = 4.2;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(footX - 2, footY); g.lineTo(footX + 11, footY + (lift > 4 ? -1 : 0)); g.stroke();
    };
    leg(1);
    // tail plumes
    g.fillStyle = '#f6ecd6'; g.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-26 - i * 2, -68 + i * 7, 18, 6, -0.5 + i * 0.35, 0, Math.PI * 2); g.fill(); g.stroke(); }
    // body
    g.fillStyle = '#2b2233'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(2, -68 + bump * 0.4, 32, 24, -0.1, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(246,236,214,.4)'; g.lineWidth = 2; g.beginPath(); g.arc(-4, -66, 14, 0.6, 2.4); g.stroke();
    leg(0);
    // neck: S curve with a bob, a long neck is the whole point
    const bob = Math.sin(p * 2) * (moving ? 6 : 2.5);
    const nx = 24, ny = -80;
    const hx = nx + 26 + bob * 0.6, hy = ny - 66 - Math.abs(bob) * 0.3;
    g.strokeStyle = INK; g.lineWidth = 13; g.beginPath(); g.moveTo(nx - 4, ny + 6); g.bezierCurveTo(nx + 22, ny - 14, nx - 10, ny - 38, hx - 3, hy + 6); g.stroke();
    g.strokeStyle = '#f2a59a'; g.lineWidth = 9; g.beginPath(); g.moveTo(nx - 4, ny + 6); g.bezierCurveTo(nx + 22, ny - 14, nx - 10, ny - 38, hx - 3, hy + 6); g.stroke();
    // head
    g.fillStyle = '#f2a59a'; g.strokeStyle = INK; g.lineWidth = 2.8;
    g.beginPath(); g.ellipse(hx, hy, 11, 8.5, -0.15, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#f2a03d'; g.beginPath(); g.moveTo(hx + 8, hy - 3); g.lineTo(hx + 26, hy + 1); g.lineTo(hx + 8, hy + 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(hx + 2, hy - 2, 3.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(hx + 3, hy - 2, 1.4, 0, Math.PI * 2); g.fill();
    // eyelashes: it is a very dignified ostrich
    g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx - 2, hy - 6); g.lineTo(hx - 4, hy - 9); g.moveTo(hx + 1, hy - 6); g.lineTo(hx + 1, hy - 10); g.stroke();
    // a little feather in the cap of its head
    g.fillStyle = '#b3263d'; g.beginPath(); g.moveTo(hx - 5, hy - 8); g.quadraticCurveTo(hx - 14, hy - 22, hx - 2, hy - 20); g.quadraticCurveTo(hx - 4, hy - 14, hx - 2, hy - 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  _weather(g) {
    const { W, H } = this;
    if (this.weather === 'rain') {
      g.strokeStyle = 'rgba(200,225,255,.55)'; g.lineWidth = 1.4; g.beginPath();
      const r = rng(11);
      for (let i = 0; i < 70; i++) {
        const x = (r() * W + this.t * 120 + i * 9) % (W + 40) - 20;
        const y = (r() * H + this.t * 520) % H;
        g.moveTo(x, y); g.lineTo(x - 5, y + 14);
      }
      g.stroke();
      g.fillStyle = 'rgba(40,50,80,.15)'; g.fillRect(0, 0, W, H);
    } else if (this.weather === 'fog') {
      const f = g.createLinearGradient(0, H * 0.4, 0, H);
      f.addColorStop(0, 'rgba(230,230,240,0)'); f.addColorStop(1, 'rgba(230,230,240,.45)');
      g.fillStyle = f; g.fillRect(0, 0, W, H);
    }
  }

  _rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
}

/** Rasterise a ui.landmarkGlyph() <g> (fill=currentColor) into an Image in the given colour. */
export function landmarkImage(glyph, colour = '#2a1630') {
  return new Promise((resolve) => {
    if (!glyph) return resolve(null);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '300');
    svg.setAttribute('height', '300');
    svg.setAttribute('style', `color:${colour}`);
    svg.appendChild(glyph.cloneNode(true));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  });
}

export { WORLD };
