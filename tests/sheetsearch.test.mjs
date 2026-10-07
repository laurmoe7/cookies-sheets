// The in-sheet search: builds an index from a character and ranks matches (names before descriptions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchIndex } from '../web/js/searchindex.js';
import { newCharacter } from '../web/js/model.js';

test('index and ranking', () => {
  const c = newCharacter();
  c.feats.push({ name: 'Power Attack', notes: 'trade accuracy for damage' });
  c.gear.push({ name: 'Rope, hemp (50 ft.)', notes: 'for climbing' });
  c.spellbooks.Wizard = { spells: [{ name: 'Magic Missile', level: 1 }] };
  c.companions.push({ name: 'Mittens', kind: 'familiar', species: 'Cat' });
  const idx = buildIndex(c);
  assert.deepEqual(searchIndex(idx, 'power').map(r => r.kind), ['Feat']);
  assert.equal(searchIndex(idx, 'climb')[0].name, 'Climb', 'skill named Climb ranks before gear notes mentioning it');
  assert.equal(searchIndex(idx, 'climb').find(r => r.kind === 'Gear').score, 2);
  assert.equal(searchIndex(idx, 'missile')[0].tab, 'spells');
  assert.equal(searchIndex(idx, 'mitt')[0].tab, 'companions');
  assert.deepEqual(searchIndex(idx, '  '), []);
});
