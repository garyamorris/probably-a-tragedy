import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../src/tragedy/server/static/js/views/_kit/art.js';
import { performers, staff, critics } from '../../src/tragedy/server/static/js/views/_lab/fixtures.js';

/** A tiny well-formedness check: every opened tag is closed in order (self-closing tags allowed). */
function balanced(markup) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m;
  while ((m = re.exec(markup))) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name);
  }
  return stack.length === 0;
}
const clean = (m) => !/undefined|NaN|\[object/.test(m);

test('every fixture performer draws in every view and mood', () => {
  for (const p of performers) {
    for (const view of ['full', 'bust', 'head']) {
      for (const mood of ['neutral', 'joy', 'fear', 'rage', 'love', 'grief', 'smug']) {
        const m = A.puppetMarkup(p, { view, mood });
        assert.ok(m.startsWith('<svg'), `${p.id}/${view}/${mood} starts with <svg`);
        assert.ok(balanced(m), `${p.id}/${view}/${mood} is balanced`);
        assert.ok(clean(m), `${p.id}/${view}/${mood} has no undefined/NaN`);
      }
    }
  }
});

test('all eight head types and all eight costumes are drawable', () => {
  const heads = ['round', 'long', 'square', 'beak', 'sock', 'nutcracker', 'tin', 'shadow'];
  const costumes = ['gown', 'coat', 'frock', 'uniform', 'rags', 'armour', 'robe', 'wig'];
  for (const head of heads) for (const costume of costumes) {
    const m = A.puppetMarkup({ id: 'x', name: 'X', palette: { body: '#336699', accent: '#ffcc00', hair: '#222222' }, build: { head, costume, height: 1.1, arms: 'long', strings: 6 } }, { view: 'full' });
    assert.ok(balanced(m) && clean(m), `${head}/${costume}`);
  }
});

test('unknown build values and missing palettes fall back instead of throwing', () => {
  const m = A.puppetMarkup({ id: 'y', name: 'Y', build: { head: 'dodecahedron', costume: 'spacesuit', height: 99, strings: 40 } });
  assert.ok(balanced(m) && clean(m));
  assert.ok(balanced(A.puppetMarkup(null)));
  assert.ok(balanced(A.puppetMarkup({})));
});

test('hostile colours and labels never reach the markup', () => {
  const m = A.puppetMarkup({ id: 'z', name: 'Z" onload="alert(1)', palette: { body: 'red" onload="alert(1)', accent: 'url(javascript:alert(1))', hair: '<script>' } }, { title: 'a" onload="x' });
  assert.ok(!/onload=/.test(m.replace(/aria-label="[^"]*"/, '')), 'no injected attribute');
  assert.ok(!m.includes('<script'), 'no script tag');
  assert.ok(!/javascript:/.test(m));
  const j = A.jarMarkup('<img src=x>');
  assert.ok(!j.includes('<img'));
});

test('hands puppets have no strings; marionettes do', () => {
  const hand = A.puppetMarkup(staff[0], { view: 'full' });
  assert.ok(!hand.includes('class="pp-strings"'));
  const marionette = A.puppetMarkup(performers[0], { view: 'full' });
  assert.ok(marionette.includes('class="pp-strings"'));
  const stringsOff = A.puppetMarkup(performers[0], { view: 'full', strings: false });
  assert.ok(!stringsOff.includes('class="pp-strings"'));
});

test('herons, pigeons, jars, seals, encore ticket are well-formed', () => {
  for (const s of staff.filter((x) => x.kind === 'heron')) assert.ok(balanced(A.heronMarkup(s)) && clean(A.heronMarkup(s)), s.id);
  for (const c of critics) assert.ok(balanced(A.pigeonMarkup(c)) && clean(A.pigeonMarkup(c)), c.id);
  for (const slug of ['the_lean', 'the_chair', 'the_goose_incident', 'the_chandelier', 'wild_card_x']) assert.ok(balanced(A.jarMarkup(slug)), slug);
  assert.ok(balanced(A.sealMarkup({ seed: 'a' })) && balanced(A.sealMarkup({ mark: 'tick' })) && balanced(A.sealMarkup({ mark: 'quill', colour: '#445566' })));
  assert.ok(balanced(A.encoreMarkup()));
  assert.ok(balanced(A.quillMarkup()));
});

test('jarIconFor is keyword-aware and deterministic', () => {
  assert.equal(A.jarIconFor('the_goose_incident'), 'goose');
  assert.equal(A.jarIconFor('the_chair'), 'chair');
  assert.equal(A.jarIconFor('the_chandelier'), 'chandelier');
  assert.equal(A.jarIconFor('the_lean'), 'lean');
  assert.equal(A.jarIconFor('mystery_x'), A.jarIconFor('mystery_x'));
});

test('star and heart rows draw the right number of slots in the right states', () => {
  const s = A.starsRowMarkup(3.5);
  assert.equal((s.match(/class="vstar /g) || []).length, 5);
  assert.equal((s.match(/vstar full/g) || []).length, 3);
  assert.equal((s.match(/vstar half/g) || []).length, 1);
  assert.equal((s.match(/vstar empty/g) || []).length, 1);
  assert.ok(balanced(s));
  const h = A.heartsRowMarkup(2.5, { max: 5 });
  assert.equal((h.match(/vheart full/g) || []).length, 2);
  assert.equal((h.match(/vheart half/g) || []).length, 1);
  assert.ok(balanced(h));
  assert.ok(balanced(A.iconMarkup('wagon')) && balanced(A.iconMarkup('nope')));
});

test('wobble is deterministic and bounded', () => {
  assert.equal(A.wobble('a', 3), A.wobble('a', 3));
  for (const k of ['a', 'b', 'c', 'zzz']) assert.ok(Math.abs(A.wobble(k, 2)) <= 2);
});
