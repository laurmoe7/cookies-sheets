// Which spells a character may learn when gaining a level (level-up wizard spell chooser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnAllowance, remaining, pickableLevels, describeRemaining } from '../web/js/spellrules.js';
import { classesByName, make, calc, repeat } from './helpers.mjs';

/** Allowance for gaining `cls` level n (the character already has n-1 levels and `known` spells). */
function allow(cls, n, { known = [], base = {}, raceChoice = 'int' } = {}) {
  const after = calc(make({ raceChoice, base, levels: repeat(cls, n) }));
  return learnAllowance(classesByName[cls], n, known, after.spellcasting[cls], after.abilities.int.mod);
}
const spells = (lvl, n) => Array.from({ length: n }, () => ({ level: lvl }));

test('bard 1 learns 4 cantrips and 2 first-level spells', () => {
  const a = allow('Bard', 1, { raceChoice: 'cha', base: { cha: 16 } });
  assert.equal(a.kind, 'known');
  assert.deepEqual(a.byLevel, { 0: 4, 1: 2 });
  const r = remaining(a, [{ level: 0 }, { level: 1 }]);
  assert.deepEqual(r.byLevel, { 0: 3, 1: 1 });
  assert.equal(r.total, 4);
  assert.equal(describeRemaining(r), '3 × cantrips, 1 × 1st-level');
  assert.deepEqual(pickableLevels(r), [0, 1]);
  assert.equal(remaining(a, [...spells(0, 4), ...spells(1, 2)]).total, 0);
});

test('spells-known casters only learn what the table adds', () => {
  const a = allow('Bard', 2, { raceChoice: 'cha', known: [...spells(0, 4), ...spells(1, 2)] });
  assert.deepEqual(a.byLevel, { 0: 1, 1: 1 }, 'bard 2 knows 5 cantrips and 3 first-level spells');
  // sorcerer 3 knows 5 cantrips + 3 first; sorcerer 4 knows 6 cantrips, 3 first, 1 second
  const s = allow('Sorcerer', 4, { raceChoice: 'cha', base: { cha: 16 }, known: [...spells(0, 5), ...spells(1, 3)] });
  assert.deepEqual(s.byLevel, { 0: 1, 2: 1 });
});

test('wizard 1: every cantrip free, plus 3 + Int first-level spells', () => {
  const a = allow('Wizard', 1, { base: { int: 16 } });
  assert.equal(a.kind, 'book');
  assert.equal(a.allCantrips, true);
  assert.deepEqual(a.byLevel, { 1: 3 + 4 }, 'Int 18 (+4)');
  assert.equal(remaining(a, [{ level: 0 }, { level: 0 }]).total, 7, 'cantrips do not use up picks');
  assert.deepEqual(pickableLevels(remaining(a, [])), [1]);
});

test('wizard 5 adds 2 spells of any level up to 3rd', () => {
  const a = allow('Wizard', 5, { base: { int: 16 }, known: [...spells(0, 8), ...spells(1, 9)] });
  assert.deepEqual(a.any, { count: 2, maxLevel: 3 });
  assert.deepEqual(a.byLevel, {});
  assert.deepEqual(pickableLevels(remaining(a, [])), [1, 2, 3]);
  assert.equal(describeRemaining(remaining(a, [])), '2 of any level up to 3rd');
  assert.equal(remaining(a, [{ level: 3 }]).total, 1);
  assert.equal(remaining(a, [{ level: 3 }, { level: 1 }]).total, 0);
  assert.equal(remaining(a, [{ level: 4 }]).total, 2, 'a 4th-level spell is not allowed at wizard 5');
});

test('magus adds 1 per level; alchemist starts with 2 + Int formulae and no cantrips', () => {
  assert.deepEqual(allow('Magus', 1, { base: { int: 14 } }).byLevel, { 1: 3 + 3 });
  assert.deepEqual(allow('Magus', 2, { base: { int: 14 }, known: spells(1, 6) }).any, { count: 1, maxLevel: 1 });
  const al = allow('Alchemist', 1, { base: { int: 16 } });
  assert.deepEqual(al.byLevel, { 1: 2 + 4 });
  assert.equal(al.allCantrips, false);
});

test('a wizard who cannot cast 1st-level spells yet learns none', () => {
  assert.deepEqual(allow('Wizard', 1, { base: { int: 8 }, raceChoice: 'str' }).byLevel, {});
});

test('clerics and druids prepare from their whole list and learn nothing', () => {
  assert.equal(allow('Cleric', 1, { raceChoice: 'wis', base: { wis: 16 } }).kind, 'none');
  assert.equal(allow('Druid', 3, { raceChoice: 'wis' }).kind, 'none');
  assert.equal(allow('Fighter', 1).kind, 'none');
});
