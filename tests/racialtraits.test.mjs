import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveRacialTraits } from '../web/js/racialtraits.js';

// A stand-in for api.resolve: only these names are racial traits.
const racial = { 'gregarious': { id: 9785, name: 'Gregarious (Ex)', sub: 'Kitsune' }, 'darkvision': { id: 5, name: 'Darkvision', sub: 'Elf' } };
const resolve = async items => items.map(it => it.variants.map(v => racial[v.toLowerCase()]).find(Boolean) || null);

test('racial traits move from special abilities to traits; class features and custom abilities stay', async () => {
  const c = { traits: [{ name: 'Reactionary' }], specials: [{ name: 'Darkvision' }, { name: 'Arcane Reservoir', id: 1 }, { name: 'Gregarious (Ex)', id: 9785, notes: 'mine' }, { name: '' }] };
  assert.equal(await moveRacialTraits(c, resolve), 2);
  assert.deepEqual(c.traits.map(t => t.name), ['Reactionary', 'Darkvision', 'Gregarious (Ex)']);
  assert.deepEqual(c.specials.map(t => t.name), ['Arcane Reservoir', ''], 'the rest are untouched');
  assert.equal(c.traits[1].id, 5, 'a hand-typed trait gets linked to its entry');
  assert.equal(c.traits[2].notes, 'mine', 'notes are kept');
  assert.equal(await moveRacialTraits(c, resolve), 0, 'running it again changes nothing');
});

test('the "(Ex)" suffix is optional when matching', async () => {
  const c = { traits: [], specials: [{ name: 'Gregarious' }] };
  assert.equal(await moveRacialTraits(c, resolve), 1);
});
