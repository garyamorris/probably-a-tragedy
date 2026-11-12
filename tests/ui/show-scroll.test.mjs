// A playtest found the show yanking the whole page down to the stage log on every spoken line (scrollIntoView scrolls the window,
// and the log card sits below the stage). The log must scroll its own box only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stickToBottom } from '../../src/tragedy/server/static/js/core/dom.js';

const SHOW = readFileSync(new URL('../../src/tragedy/server/static/js/views/show.js', import.meta.url), 'utf8');

function fakeScroller({ scrollHeight = 400, clientHeight = 300 } = {}) {
  const handlers = {};
  return {
    scrollHeight, clientHeight, scrollTop: 0,
    addEventListener: (type, fn) => { handlers[type] = fn; },
    scroll(top) { this.scrollTop = top; handlers.scroll?.(); },
  };
}

test('stickToBottom: follows new lines, but leaves a player who scrolled up alone', () => {
  const el = fakeScroller();
  const f = stickToBottom(el);
  f.follow();
  assert.equal(el.scrollTop, 400, 'pinned by default: follows the newest line');
  el.scroll(0); // the player scrolls up to re-read
  el.scrollHeight = 500;
  f.follow();
  assert.equal(el.scrollTop, 0, 'not yanked back down while reading');
  f.pin();
  assert.equal(el.scrollTop, 500, 'pin() (a fresh show) goes back to following');
});

test('show.js: the per-line stage log never scrolls the page', () => {
  const logLine = SHOW.slice(SHOW.indexOf('function logLine('), SHOW.indexOf('function onEvent(')).replace(/\/\/.*$/gm, ''); // code only, not comments
  assert.ok(logLine.length > 40, 'found logLine');
  assert.doesNotMatch(logLine, /scrollIntoView/, 'scrollIntoView also scrolls the window; use the log box only');
  assert.match(logLine, /logFollow\.follow\(\)/);
  assert.match(SHOW, /stickToBottom\(logList\)/);
});
