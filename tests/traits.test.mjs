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

test('drawbacks: known by their category, by a custom mark, or by name on saves from before they had one', async () => {
  const { isDrawback, countDrawbacks } = await import('../web/js/traits.js');
  assert.ok(isDrawback({ name: 'Doubt', sub: 'Drawback' }));
  assert.ok(isDrawback({ name: 'Pride', sub: '' }), 'an old save: no category, a book drawback name');
  assert.ok(isDrawback({ name: 'Power-Hungry' }), 'hyphen or not');
  assert.ok(isDrawback({ name: 'My GM’s flaw', drawback: true }), 'a custom drawback');
  assert.ok(!isDrawback({ name: 'Xenophobic', sub: 'Dwarf' }), 'the dwarf racial trait of the same name is not one');
  assert.ok(!isDrawback({ name: 'Reactionary', sub: 'Combat' }));
  assert.equal(countDrawbacks([{ name: 'Doubt', sub: 'Drawback' }, { name: 'Reactionary', sub: 'Combat' }]), 1);
});

test('drawbacks use up no traits and have no category rule', async () => {
  const { traitBlock: block } = await import('../web/js/traits.js');
  const picks = [{ name: 'Reactionary', sub: 'Combat' }, { name: 'Doubt', sub: 'Drawback' }];
  assert.equal(countTraits(picks), 1, 'the drawback is not a trait');
  assert.equal(block({ name: 'Pride', sub: 'Drawback' }, picks, new Set(['Drawback'])), '', 'a second drawback is fine');
});

test('the book: a drawback taken at 1st level gives a third trait; the house rule gives none', () => {
  assert.equal(traitAllowance(1, [], { rule: 'optional', drawbacks: 0 }), 2);
  assert.equal(traitAllowance(1, [], { rule: 'optional', drawbacks: 1 }), 3, '2 + 1 for the drawback');
  assert.equal(traitAllowance(1, [], { rule: 'optional', drawbacks: 2 }), 3, 'only one extra, however many drawbacks');
  assert.equal(traitAllowance(3, [], { rule: 'optional', drawbacks: 1 }), 0, 'not at later levels');
  assert.equal(traitAllowance(1, [], { rule: 'perTrait', drawbacks: 2 }), 2, 'house rule: drawbacks pay for traits, they add none');
});

test('house rule "one drawback per trait": how many drawbacks are still owed', async () => {
  const { drawbacksLeft, traitBalance } = await import('../web/js/traits.js');
  const two = [{ name: 'Reactionary', sub: 'Combat' }, { name: 'Seeker', sub: 'Social' }];
  assert.equal(drawbacksLeft('perTrait', two), 2, 'two traits, no drawbacks: 2 owed');
  assert.equal(drawbacksLeft('perTrait', [...two, { name: 'Doubt', sub: 'Drawback' }]), 1, '2 - 1 = 1');
  assert.equal(drawbacksLeft('optional', two), 0, 'the book asks for none');
  assert.equal(drawbacksLeft('perTrait', [{ name: 'Keen Senses', sub: 'Elf', racial: true }]), 0, 'racial traits do not count');
  const sheet = [...two, { name: 'Keen Senses', sub: 'Elf' }, { name: 'Pride' }];
  assert.deepEqual(traitBalance(sheet, 'perTrait', t => t.sub === 'Elf'), { positive: 2, drawbacks: 1, missing: 1 });
  assert.equal(traitBalance(sheet, 'optional', t => t.sub === 'Elf').missing, 0);
});

test('applying a level warns about drawbacks owed and trait class skills not picked', () => {
  const base = { newLevel: 1, rankBudget: 0, ranksUsed: 0, name: 'Bob', pointsLeft: 0, getsFeat: false };
  assert.ok(levelWarnings({ ...base, drawbacksLeft: 2 }).includes('2 drawbacks still needed: this character takes one drawback per trait.'));
  assert.ok(levelWarnings({ ...base, traitChoicesLeft: 1 }).includes('1 trait still needs a class skill picked.'));
  assert.ok(!levelWarnings({ ...base, drawbacksLeft: 0, traitChoicesLeft: 0 }).some(w => /drawback|class skill/.test(w)));
});
