import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replacesOf, replacedConflicts, isAlternate, remainingBaseline, alternativesFor } from '../web/js/racetraits.js';

test('an alternate trait says what it replaces, in the summary the compendium gives it', () => {
  assert.deepEqual(replacesOf('Replaces agile.'), ['agile']);
  assert.deepEqual(replacesOf('Replaces agile, kitsune magic.'), ['agile', 'kitsune magic']);
  assert.deepEqual(replacesOf('A standard trait with some other summary.'), []);
  assert.deepEqual(replacesOf(''), []);
});

test('adding an alternate trait finds the standard trait it replaces and any alternate already replacing the same one', () => {
  const traits = [{ name: 'Agile (Ex)' }, { name: 'Eidetic', replaces: ['agile'] }, { name: 'Reactionary' }, { name: 'Kitsune Magic' }];
  const r = replacedConflicts(traits, ['agile', 'kitsune magic']);
  assert.deepEqual(r.standard, [0, 3], 'by name, ignoring (Ex) and capitals');
  assert.deepEqual(r.clashes, [1], 'Eidetic already replaces agile');
  assert.deepEqual(replacedConflicts(traits, ['unrelated']), { standard: [], clashes: [] });
});

test('the standard traits of a race and the alternates that can replace each', () => {
  const base = [{ name: 'Elven Magic' }, { name: 'Keen Senses' }, { name: 'Low-Light Vision' }];
  const alts = [{ name: 'Dreamspeaker', summary: 'Replaces elven magic.' }, { name: 'Sharp Eyes', summary: 'Replaces keen senses, low-light vision.' }, { name: 'Odd', summary: 'Alters keen senses.' }];
  assert.deepEqual(alts.map(isAlternate), [true, true, true]);
  assert.equal(isAlternate({ name: 'Keen Senses', summary: '' }), false, 'a standard trait has no "Replaces" summary');
  assert.deepEqual(alternativesFor('Keen Senses', alts).map(a => a.name), ['Sharp Eyes'], 'only a trait that replaces it; "alters" is not a swap');
  assert.deepEqual(alternativesFor('Keen Senses', alts, [alts[1]]), [], 'one already chosen is not offered twice');
  const chosen = [{ name: 'Sharp Eyes', replaces: ['keen senses', 'low-light vision'] }];
  assert.deepEqual(remainingBaseline(base, chosen).map(b => b.name), ['Elven Magic'], 'one alternate can replace several standard traits');
  assert.deepEqual(remainingBaseline(base, []).length, 3);
  assert.deepEqual(alternativesFor('Languages', [{ name: 'Multilingual', summary: 'Replaces agile, kitsune normal languages.' }]).map(a => a.name), ['Multilingual'], 'a phrase that ends with the trait name counts');
  assert.deepEqual(alternativesFor('Kitsune', [{ name: 'Skilled', summary: 'Replaces agile, kitsune magic.' }]), [], 'but a word in the middle does not')
});

