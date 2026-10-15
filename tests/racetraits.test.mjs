import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replacesOf, replacedConflicts } from '../web/js/racetraits.js';

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
