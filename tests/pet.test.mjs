import test from 'node:test';
import assert from 'node:assert/strict';
import { facts, diffFacts, added, goldValue } from '../web/js/pet/facts.js';
import { LINES, pickLine, bleep } from '../web/js/pet/lines.js';
import { sanitize } from '../web/js/options.js';

const char = (over = {}) => ({ id: 'a', name: 'Fumu', levelUps: [{}], gear: [], weapons: [], armor: [], feats: [], traits: [], summons: [], companions: [],
  modifiers: [], money: { pp: 0, gp: 0, sp: 0, cp: 0, custom: [] }, spellbooks: {}, resources: {}, trackers: [], abilities: {}, hp: {}, xp: 0, ...over });
const der = (current, max = 20, con = 12) => ({ hp: { current, max }, abilities: { con: { score: con } } });
const ev = (a, b) => diffFacts(facts(a[0], a[1]), facts(b[0], b[1])).map(e => e.type);

test('taking damage, going down and dying are told apart', () => {
  assert.deepEqual(ev([char(), der(20)], [char(), der(15)]), ['hp-loss']);
  assert.deepEqual(ev([char(), der(20)], [char(), der(4)]), ['hp-low']);
  assert.deepEqual(ev([char(), der(20)], [char(), der(10)]), ['big-hit'], 'losing 10 of 20 is a big hit');
  assert.deepEqual(ev([char(), der(5)], [char(), der(-3)]), ['downed'], 'at -3 with Con 12 you are down, not dead');
  assert.deepEqual(ev([char(), der(-3)], [char(), der(-12)]), ['dead'], 'dead at minus the Con score (-12)');
  assert.deepEqual(ev([char(), der(-3)], [char(), der(6)]), ['revived']);
});

test('healing and full heal', () => {
  assert.deepEqual(ev([char(), der(15)], [char(), der(18)]), ['hp-heal']);
  assert.deepEqual(ev([char(), der(5)], [char(), der(20)]), ['full-heal']);
});

test('casting a named spell, a spontaneous slot, and resting', () => {
  const book = (cast, used) => ({ spellbooks: { Wizard: { spells: [{ name: 'Fireball', cast }], used: [0, used] } } });
  const e = diffFacts(facts(char(book(0, 0)), der(20)), facts(char(book(1, 0)), der(20)));
  assert.deepEqual(e, [{ type: 'cast', spell: 'Fireball' }]);
  assert.deepEqual(ev([char(book(0, 0)), der(20)], [char(book(0, 1)), der(20)]), ['cast']);
  assert.deepEqual(ev([char(book(2, 0)), der(20)], [char(book(0, 0)), der(20)]), ['rest']);
});

test('summons, items, feats and money', () => {
  assert.deepEqual(ev([char(), der(20)], [char({ summons: [{ id: 's', name: 'Eagle', hp: 5 }] }), der(20)]), ['summon']);
  assert.deepEqual(ev([char({ summons: [{ id: 's', name: 'Eagle', hp: 5 }] }), der(20)], [char({ summons: [{ id: 's', name: 'Eagle', hp: 0 }] }), der(20)]), ['summon-dead']);
  const [item] = diffFacts(facts(char(), der(20)), facts(char({ weapons: [{ name: 'Longsword' }] }), der(20)));
  assert.deepEqual(item, { type: 'item', name: 'Longsword', kind: 'weapon' });
  assert.deepEqual(ev([char({ gear: [{ name: 'Rope' }] }), der(20)], [char(), der(20)]), ['item-gone']);
  assert.deepEqual(ev([char(), der(20)], [char({ feats: [{ name: 'Toughness' }] }), der(20)]), ['feat']);
  assert.deepEqual(ev([char(), der(20)], [char({ levelUps: [{}, {}] }), der(20)]), ['level-up']);
  assert.deepEqual(ev([char(), der(20)], [char({ money: { gp: 50 } }), der(20)]), ['gold-up']);
  assert.deepEqual(ev([char(), der(20)], [char({ money: { pp: 100 } }), der(20)]), ['rich'], '100 pp is 1000 gp');
  assert.equal(goldValue({ pp: 1, gp: 2, sp: 10, cp: 100 }), 14, '10 + 2 + 1 + 1');
});

test('a different character, or no change, says nothing', () => {
  assert.deepEqual(ev([char(), der(20)], [char({ id: 'b' }), der(1)]), []);
  assert.deepEqual(ev([char(), der(20)], [char(), der(20)]), []);
  assert.deepEqual(diffFacts(null, facts(char(), der(20))), []);
});

test('added() counts duplicates once each', () => {
  assert.deepEqual(added(['a', 'b'], ['a', 'b', 'b', 'c']), ['b', 'c']);
});

test('every line fills its placeholders and a missing value never leaves braces', () => {
  for (const [type, list] of Object.entries(LINES)) {
    assert.ok(list.length >= 3, `${type} needs a few lines to vary`);
    for (let i = 0; i < 40; i++) {
      const l = pickLine(type, {});
      assert.ok(l && !/[{}]/.test(l.text), `${type}: ${l?.text}`);
    }
  }
  assert.equal(pickLine('nope'), null);
  const cute = LINES.rich.map((_, i) => pickLine('rich', { n: 1 }, () => i / LINES.rich.length)).find(l => l.cute);
  assert.ok(cute && !cute.text.includes('~'), 'the ~ marker is removed and flags the cute act');
});

test('the same line is not picked twice in a row', () => {
  let last = null;
  for (let i = 0; i < 30; i++) { const l = pickLine('poke', {}, () => 0); assert.notEqual(l.text, last); last = l.text; }
});

test('bleeping keeps the first letter only', () => {
  assert.equal(bleep('Well, fuck. That is some shit, malaka.'), 'Well, f***. That is some s***, malaka.');
  assert.equal(bleep('A classy glass.'), 'A classy glass.', 'words that merely contain "ass" are left alone');
});

test('Cookie options are sanitized', () => {
  const o = sanitize({ cookieTalk: 'screaming', cookieSwear: 'x', cookie: 0 });
  assert.deepEqual([o.cookieTalk, o.cookieSwear, o.cookie, o.cookieSound], ['normal', 'full', false, false]);
});
