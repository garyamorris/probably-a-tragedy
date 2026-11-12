// Tiny procedural WebAudio blips. Strictly opt-in: nothing is created until `stage.sound = true` (which should be
// done from a user gesture). No audio files, no network.

// Levels, measured (peak into the output, full scale = 1.0). Measured with an AnalyserNode tee on the destination in stage-lab:
//   before: 0.015 (cry) .. 0.14 (thud), i.e. -36 .. -17 dBFS, a 19 dB spread and generally quiet (master 0.16).
// after (this file): -17.6 .. -3.9 dBFS, most effects near -12 dBFS, no clipping, spread 13.8 dB (percussive thud / next-beat are the
// hot transients, the curtain the quietest). Re-measure in stage-lab (tee the destination into an AnalyserNode) if you retune.
const MASTER_GAIN = 0.5;
// Per-effect trims for the effects that measured quiet (multipliers on that effect's own volume).
const TRIM = { sniff: 3.2, whisper: 3.2, close: 3.2, applause: 2.2, clap: 2.2, gasp: 2.4, laugh: 1.5, boo: 1.4, yawn: 1.6, chime: 1.6, ding: 1.4, hop: 1.5, slide: 1.8, whoosh: 1.8 };

export class Sfx {
  constructor() { this.ctx = null; this.master = null; this.last = {}; this.trim = 1; }

  ensure() {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      // a limiter: overlapping effects (applause = 14 noise bursts) must never clip, however many play at once
      const lim = this.ctx.createDynamicsCompressor();
      lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 14; lim.attack.value = 0.003; lim.release.value = 0.12;
      this.master.connect(lim);
      lim.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  tone(freq, dur, type = 'sine', vol = 1, to = null, delay = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * this.trim), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  noise(dur, vol = 0.5, freq = 1200, delay = 0, q = 0.7) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * this.trim, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  /** A jaw-flap blip for a speaker (pitch per actor). */
  blip(seed, vol = 0.5) {
    if (!this.ensure()) return;
    const f = 220 + (seed % 7) * 38;
    this.trim = 1;
    this.tone(f, 0.05, 'square', 0.12 * vol, f * 1.2);
  }

  play(name, a = 1) {
    if (!this.ensure()) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.06) return; // don't machine-gun
    this.last[name] = now;
    this.trim = TRIM[name] ?? 1;
    switch (name) {
      case 'chime': this.tone(660, 0.25, 'triangle', 0.5); this.tone(990, 0.35, 'triangle', 0.35, null, 0.09); break;
      case 'slide': this.noise(0.5, 0.25, 500, 0, 0.5); break;
      case 'thud': this.tone(140, 0.22, 'sine', 0.9, 55); this.noise(0.12, 0.35, 300); break;
      case 'boing': this.tone(260, 0.3, 'sine', 0.6, 520); break;
      case 'whisper': this.noise(0.5, 0.18, 3200, 0, 1.6); break;
      case 'thunder': this.noise(1.6, 0.7, 120, 0, 0.5); this.tone(70, 1.2, 'sawtooth', 0.35, 35); break;
      case 'trap': this.tone(420, 0.35, 'sawtooth', 0.35, 90); break;
      case 'click': this.tone(1800, 0.04, 'square', 0.3); break;
      case 'whoosh': this.noise(0.9, 0.25, 700, 0, 0.4); break;
      case 'close': this.noise(0.7, 0.3, 380, 0, 0.5); this.tone(110, 0.4, 'sine', 0.5, 70); break;
      case 'applause': for (let i = 0; i < 14; i++) this.noise(0.08, 0.28, 2400 + (i % 5) * 400, i * 0.07, 1.2); break;
      case 'laugh': for (let i = 0; i < 3; i++) this.tone(380 + i * 30, 0.08, 'triangle', 0.3 * a, 300, i * 0.1); break;
      case 'gasp': this.noise(0.3, 0.3, 1500, 0, 0.8); break;
      case 'boo': this.tone(130, 0.5, 'sawtooth', 0.35 * a, 100); break;
      case 'clap': this.noise(0.05, 0.4, 2600); break;
      case 'sniff': this.noise(0.15, 0.2, 1800); break;
      case 'yawn': this.tone(300, 0.7, 'sine', 0.25, 150); break;
      case 'ding': this.tone(1200, 0.4, 'sine', 0.5); this.tone(1800, 0.5, 'sine', 0.25, null, 0.03); break;
      case 'hop': this.tone(500, 0.1, 'triangle', 0.4, 800); break;
      default: break;
    }
  }
}
