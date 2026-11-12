// The twelve mishap animations as pure functions of progress u (0..1). Every clip starts and ends at the identity pose, so
// a puppet always settles back to standing. Pure maths: unit-tested in Node.

import { smooth, easeOutBack, easeOutCubic, easeInOut, hump, clamp01 } from './anim.js';

export function identity(o = {}) {
  o.dx = 0; o.dy = 0; o.rot = 0; o.sx = 1; o.sy = 1; o.bend = 0; o.fold = 0; o.tilt = 0; o.pivot = 0;
  o.barLift = 0; o.slack = 0; o.sway = 1; o.armUp = 0; o.flail = 0; o.mouth = -1; o.eye = 0; o.walk = 0;
  o.overlay = null; o.alpha = 1; o.shake = 0; o.peek = 0;
  return o;
}

const att = (u, a) => smooth(u / a);
const rel = (u, b) => 1 - smooth((u - b) / (1 - b));

/**
 * @param name   one of the 12 anims
 * @param u      progress 0..1
 * @param c      {H: puppet height, dir: -1|1 (slide/lean direction), rm: reduced motion}
 * @param o      output (reused)
 */
export function clipPose(name, u, c, o) {
  identity(o);
  u = clamp01(u);
  if (u <= 0 || u >= 1) return o;
  const rm = c.rm;
  const H = c.H, dir = c.dir || 1;
  const k = rm ? 0.35 : 1; // reduced motion: same story, much gentler
  switch (name) {
    case 'lean_left': {
      const hold = 0.42;
      const ee = u < hold ? att(u, 0.3) : 1 - smooth((u - hold) / 0.5);
      const settle = u > hold ? Math.sin((u - hold) * 34) * 0.05 * (1 - u) : 0;
      o.rot = -0.62 * ee * k + settle * k; o.dx = -34 * ee * k; o.bend = -0.2 * ee * k; o.tilt = -0.25 * ee * k; o.slack = 0.5 * ee; o.sway = 1 - ee * 0.7;
      o.armUp = 0.5 * ee; o.eye = 0.3 * ee; o.mouth = 0.35 * ee; break;
    }
    case 'collapse': {
      const hold = 0.4;
      const a = att(u, 0.2);
      const r = u < hold ? 1 : 1 - easeOutBack(clamp01((u - hold) / 0.5)) * 0.97;
      const e = a * r;
      o.sy = 1 - 0.58 * e * (rm ? 0.5 : 1); o.sx = 1 + 0.3 * e * (rm ? 0.5 : 1); o.fold = 0.3 * e; o.slack = Math.max(0, e); o.sway = 1 - Math.min(1, Math.abs(e)); o.dy = 4 * e; o.armUp = -0.3 * e; o.eye = 0.2 * e; break;
    }
    case 'spin': {
      const th = Math.PI * 4 * easeInOut(u);
      o.sx = rm ? 1 : Math.cos(th); o.dy = -hump(u) * 46 * k; o.walk = 1; o.flail = 0.5 * hump(u); o.armUp = 1.4 * hump(u); o.mouth = 0.7 * hump(u); break;
    }
    case 'wobble': {
      const d = Math.exp(-3.2 * u);
      o.rot = 0.4 * d * Math.sin(Math.PI * 7 * u) * k; o.sy = 1 + 0.04 * d * Math.sin(Math.PI * 14 * u); o.slack = 0.3 * d; o.eye = 0.35 * d; o.mouth = 0.4 * d; o.flail = 0.6 * d; break;
    }
    case 'hide': {
      const hold = 0.45;
      let sink;
      if (u < 0.22) sink = smooth(u / 0.22);
      else if (u < 0.3) sink = 1;
      else if (u < hold) sink = 1 - 0.14 * smooth((u - 0.3) / (hold - 0.3));    // rise to a peek
      else sink = (1 - 0.14) * (1 - smooth((u - hold) / 0.4));
      const target = rm ? 0.6 : 1.26;
      o.dy = H * target * sink; o.slack = 0.8 * sink; o.sway = 1 - sink; o.eye = 0.4 * sink; o.peek = sink; o.alpha = rm ? 1 - 0.7 * sink : 1; break;
    }
    case 'fly': {
      const lift = att(u, 0.16) * (1 - smooth((u - 0.5) / 0.45));
      o.barLift = -380 * lift * k; o.dy = -380 * lift * 0.96 * k; o.rot = Math.sin(u * 17) * 0.32 * Math.min(1, lift * 1.5) * k; o.walk = 1.6 * lift; o.flail = 1.2 * lift; o.armUp = 1.5 * lift; o.mouth = 0.8 * lift; o.eye = 0.4 * lift; o.slack = 0.2; break;
    }
    case 'freeze': {
      const hold = 0.35;
      const e = u < hold ? att(u, 0.1) : 1 - smooth((u - hold) / 0.55);
      o.sway = 1 - e; o.overlay = ['#9fdcff', 0.4 * e]; o.dx = Math.sin(u * 90) * 1.4 * e * k; o.eye = 0.45 * e; o.mouth = 0.45 * e; o.armUp = 0.4 * e; o.slack = 0.1 * e; break;
    }
    case 'shake': {
      const d = 1 - smooth(u);
      o.dx = Math.sin(u * 2 * Math.PI * 13) * 13 * d * k; o.rot = Math.sin(u * 2 * Math.PI * 13 + 1) * 0.07 * d * k; o.eye = 0.35 * d; o.mouth = 0.3 * d; o.armUp = 0.5 * d; o.shake = d; break;
    }
    case 'flip': {
      const e = easeInOut(u);
      o.rot = rm ? 0 : -Math.PI * 2 * e; o.pivot = H * 0.5; o.dy = -hump(u) * 64 * k; o.armUp = 1.6 * hump(u); o.walk = hump(u); o.sy = rm ? 1 : 1; o.mouth = 0.6 * hump(u); o.eye = 0.3 * hump(u); break;
    }
    case 'slide': {
      const go = easeOutCubic(clamp01(u / 0.35)), back = 1 - smooth((u - 0.58) / 0.42);
      const sp = go * back;
      o.dx = dir * 300 * sp * k; o.sx = 1 + 0.16 * Math.sin(Math.PI * clamp01(u / 0.5)) * 0.6; o.sy = 1 - 0.07 * hump(clamp01(u / 0.5)); o.rot = dir * 0.2 * hump(clamp01(u / 0.6)) * k; o.walk = 1.2 * hump(u); o.armUp = 0.8 * hump(u); o.mouth = 0.5 * hump(u); break;
    }
    case 'bow': {
      const hold = 0.45;
      const e = u < hold ? att(u, 0.28) : 1 - smooth((u - hold) / 0.5);
      o.fold = 0.9 * e * (rm ? 0.6 : 1); o.tilt = 0.28 * e; o.dy = 8 * e; o.barLift = 10 * e; o.armUp = 1.2 * e; o.slack = 0.15 * e; o.eye = -0.3 * e; break;
    }
    case 'drop_prop': {
      const j = hump(clamp01(u / 0.35));
      o.dy = -22 * j * k; o.sy = 1 + 0.08 * j; o.armUp = 0.6 * j * (u < 0.5 ? 1 : 0); o.eye = 0.45 * j; o.mouth = 0.6 * j; o.slack = 0.2 * j; break;
    }
    default: break;
  }
  return o;
}

export const CLIP_NAMES = ['lean_left', 'collapse', 'spin', 'wobble', 'hide', 'fly', 'freeze', 'shake', 'flip', 'slide', 'bow', 'drop_prop'];
