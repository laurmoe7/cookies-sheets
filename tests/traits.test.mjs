import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traitAllowance, traitBlock, traitCategory, usedCategories, countTraits } from '../web/js/traits.js';
import { levelWarnings } from '../web/js/levelcheck.js';

test('a new character gets two traits; the feat Additional Traits adds two more, whatever the level', () => {
  assert.equal(traitAllowance(1, []), 2, 'two at 1st level');
  assert.equal(traitAllowance(1, [{ name: 'Additional Traits' }]), 4, 'a human or other 1st-level feat can be Additional Traits');
  assert.equal(traitAllowance(3, [{ name: 'Dodge' }]), 0, 'no traits at later levels');
  assert.equal(traitAllowance(5, [{ name: 'additional traits ' }]), 2, 'taken later: two');
});

test('traits must come from different categories, and not from one the character already has', () => {
  const known = new Map([['reactionary', 'Combat'], ['berserker', 'Combat'], ['adopted', 'Social']]);
  const used = usedCategories([{ name: 'Reactionary' }, { name: 'Some racial trait' }], known);
  assert.deepEqual([...used], ['Combat'], 'only compendium character traits count; a racial trait is not a category');
  const social = { name: 'Adopted', sub: 'Social' };
  assert.equal(traitBlock(social, [], used), '');
  assert.match(traitBlock({ name: 'Berserker', sub: 'Combat' }, [], used), /already have a Combat trait/);
  assert.match(traitBlock({ name: 'Another', sub: 'Social' }, [social], used), /different categories/, 'two from one list in the same window');
  assert.equal(traitBlock(social, [social], used), '', 'the trait already chosen is not blocked by itself');
});

test('category names fold together: Racial Dwarf and Racial Orc are Racial; Region and Regional match', () => {
  assert.equal(traitCategory('Racial Dwarf'), 'Racial');
  assert.equal(traitCategory('Region'), 'Regional');
  assert.equal(traitCategory('Regional'), 'Regional');
  assert.equal(traitCategory(''), '');
});

test('applying a level warns about traits not chosen', () => {
  const base = { newLevel: 1, rankBudget: 0, ranksUsed: 0, name: 'Bob', pointsLeft: 0, getsFeat: false };
  assert.ok(levelWarnings({ ...base, traitsLeft: 2 }).includes('2 traits not chosen yet.'));
  assert.ok(!levelWarnings({ ...base, traitsLeft: 0 }).some(w => /trait/.test(w)));
});

test('racial traits picked in the traits window do not use up the allowance', () => {
  const picks = [{ name: 'Acrobat', sub: 'Social' }, { name: 'Affable', sub: 'Kitsune', racial: true }, { name: 'Eidetic', sub: 'Kitsune', racial: true }];
  assert.equal(countTraits(picks), 1, 'only the character trait counts');
  assert.equal(countTraits([]), 0);
});
