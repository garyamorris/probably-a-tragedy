import test from 'node:test';
import assert from 'node:assert/strict';

import * as L from '../../src/tragedy/server/static/js/stage/layout.js';
import { Rope, knotTogether, tangleFor } from '../../src/tragedy/server/static/js/stage/verlet.js';
import { hash01, hashInt, mulberry32, noise1, pick } from '../../src/tragedy/server/static/js/stage/rng.js';
import { mix, shade, rgba, parse, c, setTint } from '../../src/tragedy/server/static/js/stage/color.js';
import { spring, Particles, easeOutBack, smooth, win } from '../../src/tragedy/server/static/js/stage/anim.js';

test('fitStage letterboxes 16:9 inside any container', () => {
  const wide = L.fitStage(2000, 600);
  assert.ok(Math.abs(wide.w / wide.h - 16 / 9) < 1e-9);
  assert.equal(wide.h, 600);
  assert.ok(wide.x > 0 && wide.y === 0);
  const tall = L.fitStage(360, 800);
  assert.equal(tall.w, 360);
  assert.ok(Math.abs(tall.h - 202.5) < 1e-9);
  assert.ok(Math.abs(tall.y - (800 - 202.5) / 2) < 1e-9);
  const exact = L.fitStage(1600, 900);
  assert.deepEqual([exact.x, exact.y, exact.scale], [0, 0, 1]);
  for (const [w, h] of [[360, 640], [1600, 900], [1, 1], [3000, 200]]) {
    const f = L.fitStage(w, h);
    assert.ok(f.x >= -1e-9 && f.y >= -1e-9 && f.x + f.w <= w + 1e-9 && f.y + f.h <= h + 1e-9);
  }
});

test('toStage/toScreen round-trip', () => {
  const f = L.fitStage(900, 700);
  const p = L.toScreen(f, 400, 300);
  const q = L.toStage(f, p.x, p.y);
  assert.ok(Math.abs(q.x - 400) < 1e-9 && Math.abs(q.y - 300) < 1e-9);
});

test('slot, prop and seat positions are inside the right zones', () => {
  for (let i = 0; i < 5; i++) {
    const p = L.slotPos(i);
    assert.ok(p.x > L.OPEN.x0 && p.x < L.OPEN.x1, 'slot ' + i);
    assert.ok(p.y > L.HORIZON_Y && p.y < L.LIP_Y);
  }
  for (let i = 0; i < 12; i++) {
    const p = L.propPos(i);
    assert.ok(p.x > L.OPEN.x0 && p.x < L.OPEN.x1);
    assert.ok(p.y > L.HORIZON_Y && p.y < L.LIP_Y + 60);
  }
  const seats = [];
  for (let i = 0; i < 12; i++) seats.push(L.seatPos(i));
  assert.equal(new Set(seats.map((s) => s.x + ':' + s.y)).size, 12, 'seats are all distinct');
  for (const s of seats) assert.ok(s.y > L.PIT_Y && s.x > 150 && s.x < 1450);
  assert.ok(seats[0].y < seats[6].y, 'front row is lower on screen');
  assert.ok(seats[0].s < seats[6].s, 'front row is bigger');
  assert.equal(L.slotPos(99).x, L.slotPos(4).x, 'slot index is clamped');
});

test('wrapText wraps greedily and hard-splits monster words', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(L.wrapText('aaa bbb ccc ddd', 70, measure), ['aaa bbb', 'ccc ddd']);
  assert.deepEqual(L.wrapText('', 100, measure), ['']);
  const lines = L.wrapText('x'.repeat(25), 100, measure);
  assert.ok(lines.length >= 3);
  for (const l of lines) assert.ok(measure(l) <= 100);
  assert.equal(lines.join(''), 'x'.repeat(25));
});

test('banner and ticket stay legible: font >= ~12px on screen even on a 360px stage', () => {
  for (const w of [360, 480, 800, 1200, 1600]) {
    const scale = w / L.W;
    const b = L.bannerGeometry(scale, 2);
    assert.ok(b.font * scale >= 12.4 || b.font >= 70 - 1e-9, `banner font at ${w}px: ${b.font * scale}`);
    assert.ok(b.x >= 0 && b.x + b.w <= L.W);
    const t = L.ticketGeometry(scale);
    assert.ok(t.font * scale >= 10.9, `ticket font at ${w}px`);
  }
});

test('hitTest prefers the topmost (last) shape', () => {
  const shapes = [{ id: 'a', x: 100, y: 100, rx: 50, ry: 50 }, { id: 'b', x: 120, y: 100, rx: 50, ry: 50 }];
  assert.equal(L.hitTest(110, 100, shapes).id, 'b');
  assert.equal(L.hitTest(60, 100, shapes).id, 'a');
  assert.equal(L.hitTest(500, 500, shapes), null);
});

test('verlet rope: stays finite and inextensible while the anchors thrash about', () => {
  const r = new Rope(8);
  r.reset(0, 0, 0, 200);
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const t = i / 60;
    const ax = Math.sin(t * 3) * 60, bx = Math.cos(t * 2.3) * 90;
    const by = 200 + Math.sin(t * 1.7) * 30;
    const w = r.step(1 / 60, ax, 0, bx, by, Math.hypot(bx - ax, by) * 1.08);
    worst = Math.max(worst, w);
  }
  for (let i = 0; i < r.n; i++) assert.ok(Number.isFinite(r.x[i]) && Number.isFinite(r.y[i]) && Math.abs(r.x[i]) < 1000 && Math.abs(r.y[i]) < 1000);
  assert.ok(worst < 1.25, 'segments stretched by ' + worst);
});

test('verlet rope: slack sags below a straight line, taut rope is straight', () => {
  const slack = new Rope(9), taut = new Rope(9);
  slack.reset(0, 0, 100, 0); taut.reset(0, 0, 100, 0);
  for (let i = 0; i < 400; i++) {
    slack.step(1 / 60, 0, 0, 100, 0, 140);
    taut.step(1 / 60, 0, 0, 100, 0, 100.2);
  }
  const mid = (r) => r.y[4];
  assert.ok(mid(slack) > 20, 'slack rope hangs: ' + mid(slack));
  assert.ok(mid(taut) < 6, 'taut rope is straight: ' + mid(taut));
});

test('knotTogether pulls two strings to a shared point', () => {
  const a = new Rope(8), b = new Rope(8);
  a.reset(0, 0, 40, 200); b.reset(100, 0, 60, 200);
  const k = knotTogether(a, b, 3, 1);
  assert.ok(Math.abs(a.x[3] - b.x[3]) < 1e-3 && Math.abs(a.y[3] - b.y[3]) < 1e-3);
  assert.ok(Math.abs(a.x[3] - k.x) < 1e-3);
});

test('tangleFor ramps with chaos', () => {
  assert.equal(tangleFor(5).knots, 0);
  assert.equal(tangleFor(10).t, 0);
  assert.ok(tangleFor(60).knots >= 1);
  assert.equal(tangleFor(100).knots, 3);
  assert.ok(tangleFor(90).strength > tangleFor(40).strength);
});

test('rng: hash01 is stable, in range, and well spread', () => {
  assert.equal(hash01('a', 1), hash01('a', 1));
  assert.notEqual(hash01('a', 1), hash01('a', 2));
  let sum = 0;
  for (let i = 0; i < 2000; i++) { const v = hash01('s', i); assert.ok(v >= 0 && v < 1); sum += v; }
  assert.ok(Math.abs(sum / 2000 - 0.5) < 0.03);
  const r1 = mulberry32(7), r2 = mulberry32(7);
  for (let i = 0; i < 10; i++) assert.equal(r1(), r2());
  assert.ok(hashInt(5, 'q') < 5);
  assert.equal(pick([], 'a'), undefined);
  assert.ok(Math.abs(noise1(3.3, 1)) <= 1);
  assert.equal(noise1(4, 2), noise1(4, 2));
});

test('colour helpers and tint modes', () => {
  assert.deepEqual(parse('#fff'), [255, 255, 255]);
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(shade('#808080', 1), '#ffffff');
  assert.equal(rgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
  assert.equal(c('#abcdef'), '#abcdef');
  setTint('shadow');
  assert.equal(c('#abcdef'), '#0b0510');
  setTint('ghost');
  assert.notEqual(c('#ff0000'), '#ff0000');
  setTint(null);
  assert.equal(c('#ff0000'), '#ff0000');
});

test('anim: spring settles on its target; particles recycle; easing endpoints', () => {
  const o = { x: 0, xV: 0 };
  for (let i = 0; i < 300; i++) spring(o, 'x', 10, 14, 0.8, 1 / 60);
  assert.ok(Math.abs(o.x - 10) < 0.01);
  const p = new Particles(5);
  for (let i = 0; i < 8; i++) p.spawn('spark', 0, 0, { life: 0.1 });
  assert.equal(p.list.length, 5, 'pool is capped');
  p.update(0.2);
  assert.equal(p.list.length, 0);
  p.spawn('spark', 0, 0, { life: 1 });
  assert.equal(p.list.length, 1);
  assert.ok(Math.abs(easeOutBack(0)) < 1e-9);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
  assert.equal(smooth(2), 1);
  assert.equal(win(0.5, 0.2, 0.3, 0.6, 0.8), 1);
  assert.equal(win(0.1, 0.2, 0.3, 0.6, 0.8), 0);
});
