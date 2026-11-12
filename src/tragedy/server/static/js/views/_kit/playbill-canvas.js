// Renders a playbill to a <canvas> (no libraries) from the shared poster layout in pure.js, for "Download PNG".
import { layoutPlaybill, hash, shade } from './pure.js';
import { puppetMarkup, sealMarkup } from './art.js';

const PAPER = '#f3e6c6';

function svgToImage(markup) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawText(g, op) {
  g.font = op.font;
  g.fillStyle = op.fill;
  g.textAlign = op.align || 'center';
  g.textBaseline = 'alphabetic';
  if (op.spacing > 0 && 'letterSpacing' in g) {
    g.letterSpacing = `${op.spacing}px`;
    g.fillText(op.text, op.x + (op.align === 'center' ? op.spacing / 2 : 0), op.y);
    g.letterSpacing = '0px';
  } else if (op.spacing > 0) {
    // no native letter-spacing: place glyphs by hand
    const chars = [...op.text];
    const widths = chars.map((c) => g.measureText(c).width + op.spacing);
    const total = widths.reduce((a, b) => a + b, 0) - op.spacing;
    let x = op.align === 'center' ? op.x - total / 2 : op.align === 'right' ? op.x - total : op.x;
    g.textAlign = 'left';
    chars.forEach((c, i) => { g.fillText(c, x, op.y); x += widths[i]; });
  } else {
    g.fillText(op.text, op.x, op.y);
  }
}

function drawRule(g, op) {
  g.save();
  g.strokeStyle = '#7d1527';
  g.lineWidth = 2;
  const cx = (op.x1 + op.x2) / 2;
  g.beginPath();
  g.moveTo(op.x1, op.y); g.lineTo(cx - 22, op.y);
  g.moveTo(cx + 22, op.y); g.lineTo(op.x2, op.y);
  g.stroke();
  if (op.ornament) {
    g.fillStyle = '#a97c1f';
    g.beginPath();
    g.moveTo(cx, op.y - 9); g.lineTo(cx + 9, op.y); g.lineTo(cx, op.y + 9); g.lineTo(cx - 9, op.y);
    g.closePath(); g.fill();
    g.strokeStyle = '#241a26'; g.lineWidth = 1.2; g.stroke();
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawFrame(g, op, W, H) {
  g.save();
  g.strokeStyle = '#7d1527'; g.lineWidth = 6;
  roundRect(g, op.x, op.y, op.w, op.h, 10); g.stroke();
  g.strokeStyle = '#a97c1f'; g.lineWidth = 2.5;
  roundRect(g, op.x + 14, op.y + 14, op.w - 28, op.h - 28, 6); g.stroke();
  // corner studs
  g.fillStyle = '#a97c1f';
  for (const [x, y] of [[op.x + 14, op.y + 14], [op.x + op.w - 14, op.y + 14], [op.x + 14, op.y + op.h - 14], [op.x + op.w - 14, op.y + op.h - 14]]) {
    g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#241a26'; g.lineWidth = 1.5; g.stroke();
  }
  g.restore();
}

/**
 * pb: a normalized playbill (pure.normalizePlaybill). performers: {id: performer row}. Returns a canvas.
 * Honest about its limits: system fonts only (the CSS stack in pure.js), so it matches the on-screen poster in spirit, not pixel for pixel.
 */
export async function renderPlaybillCanvas(pb, { performers = {}, width = 1080, height = 1440 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // paper, grain, vignette
  g.fillStyle = PAPER;
  g.fillRect(0, 0, width, height);
  const rnd = mulberry(hash(pb.title + pb.town));
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = `rgba(${90 + (rnd() * 40) | 0}, ${60 + (rnd() * 30) | 0}, 30, ${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * width, rnd() * height, 1 + rnd() * 2.2, 1 + rnd() * 2.2);
  }
  const vg = g.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(90,50,20,0.28)');
  g.fillStyle = vg;
  g.fillRect(0, 0, width, height);

  // measure with the real font metrics
  const measure = (text, font) => { g.font = font; return g.measureText(text).width; };
  const L = layoutPlaybill(pb, measure, { width, height, margin: 86 });

  // images for portraits and the seal (async), loaded up front
  const portraitOp = L.ops.find((o) => o.t === 'portraits');
  const imgs = {};
  if (portraitOp) {
    await Promise.all(portraitOp.ids.map(async (id) => {
      const p = performers[id];
      if (!p) return;
      imgs[id] = await svgToImage(puppetMarkup(p, { view: 'bust', strings: false }));
    }));
  }
  const seal = await svgToImage(sealMarkup({ seed: pb.title, mark: 'star' }));

  for (const op of L.ops) {
    if (op.t === 'frame') drawFrame(g, op, width, height);
    else if (op.t === 'rule') drawRule(g, op);
    else if (op.t === 'text') drawText(g, op);
    else if (op.t === 'box') {
      g.save(); g.strokeStyle = '#7d1527'; g.lineWidth = 2.5; g.setLineDash([10, 7]); roundRect(g, op.x, op.y, op.w, op.h, 12); g.stroke(); g.restore();
    } else if (op.t === 'portraits') {
      const n = op.ids.length;
      const gap = 48;
      const totalW = n * op.size * 0.82 + (n - 1) * gap;
      let x = (width - totalW) / 2;
      for (const id of op.ids) {
        const w = op.size * 0.82;
        g.save();
        g.beginPath();
        g.ellipse(x + w / 2, op.y + op.size / 2, w / 2, op.size / 2, 0, 0, Math.PI * 2);
        g.clip();
        const grd = g.createRadialGradient(x + w / 2, op.y + op.size * 0.35, 8, x + w / 2, op.y + op.size / 2, op.size * 0.6);
        const pal = performers[id]?.palette?.body || '#6a4575';
        grd.addColorStop(0, shade(pal, -0.2)); grd.addColorStop(1, '#170c1c');
        g.fillStyle = grd;
        g.fillRect(x, op.y, w, op.size);
        if (imgs[id]) g.drawImage(imgs[id], x + w * 0.04, op.y + op.size * 0.06, w * 0.92, op.size * 0.94);
        g.restore();
        g.save(); g.strokeStyle = '#a97c1f'; g.lineWidth = 5; g.beginPath(); g.ellipse(x + w / 2, op.y + op.size / 2, w / 2, op.size / 2, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#7d1527'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + w / 2, op.y + op.size / 2, w / 2 + 6, op.size / 2 + 6, 0, 0, Math.PI * 2); g.stroke(); g.restore();
        x += w + gap;
      }
    }
  }
  if (seal) { g.save(); g.translate(width - 86 - 44, 78 + 44); g.rotate(0.18); g.drawImage(seal, -44, -44, 88, 88); g.restore(); }
  // small colophon
  g.font = `italic 20px ${'ui-serif, Georgia, serif'}`;
  g.fillStyle = 'rgba(36,26,38,.55)';
  g.textAlign = 'left';
  g.fillText('Probably a Tragedy', 86, height - 52);
  return canvas;
}

/** Trigger a download of the canvas as a PNG. */
export function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('The canvas would not give up its ink.'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(blob.size);
    }, 'image/png');
  });
}
