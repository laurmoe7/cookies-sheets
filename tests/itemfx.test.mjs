import test from 'node:test';
import assert from 'node:assert/strict';
import { make, calc, repeat } from './helpers.mjs';
import { suggestEffects, effectsText, wornEffects } from '../web/js/itemfx.js';

test('the usual bonuses are read from the item name', () => {
  assert.deepEqual(suggestEffects('Cloak of Resistance +2'), [{ target: 'saves', value: 2, type: 'resistance' }]);
  assert.deepEqual(suggestEffects('Ring of Protection +1'), [{ target: 'ac', value: 1, type: 'deflection' }]);
  assert.deepEqual(suggestEffects('Amulet of Natural Armor +3'), [{ target: 'ac', value: 3, type: 'natural armor enhancement' }]);
  assert.deepEqual(suggestEffects('Bracers of Armor +4'), [{ target: 'ac', value: 4, type: 'armor' }]);
  assert.deepEqual(suggestEffects('Headband of Vast Intelligence +2'), [{ target: 'int', value: 2, type: 'enhancement' }]);
  assert.deepEqual(suggestEffects('Belt of Giant Strength +4'), [{ target: 'str', value: 4, type: 'enhancement' }]);
  assert.deepEqual(suggestEffects('Gloves of Dexterity +2'), [{ target: 'dex', value: 2, type: 'enhancement' }]);
  assert.deepEqual(suggestEffects('Headband of Alluring Charisma +2'), [{ target: 'cha', value: 2, type: 'enhancement' }]);
});
test('names we cannot be sure of give nothing', () => {
  for (const n of ['Belt of Physical Might +2', 'Rope', 'Ring of Swimming', 'Cloak of Resistance', '', null]) assert.deepEqual(suggestEffects(n), [], String(n));
});
test('bonuses are listed in words, and only count while the item is worn', () => {
  const fx = [{ target: 'int', value: 2, type: 'enhancement' }, { target: 'saves', value: 1, type: 'untyped' }];
  assert.equal(effectsText(fx), '+2 Intelligence (enhancement), +1 All saves');
  assert.deepEqual(wornEffects({ effects: fx, slot: '' }), []);
  assert.deepEqual(wornEffects({ effects: fx, slot: 'head' }), fx);
  assert.deepEqual(wornEffects({ slot: 'head' }), []);
});

// Fighter 1: base Fort +2, Con 10, Int 10.
const hero = gear => make({ levels: repeat('Fighter', 1), gear });
test('a worn cloak of resistance adds +2 to every save; carried, it does nothing', () => {
  const cloak = slot => ({ name: 'Cloak of Resistance +2', qty: 1, weight: 1, slot, effects: suggestEffects('Cloak of Resistance +2') });
  assert.equal(calc(hero([cloak('shoulders')])).saves.fort.total, 4, 'base 2 + 0 Con + 2 resistance');
  assert.equal(calc(hero([cloak('')])).saves.fort.total, 2, 'not worn');
});
test('a worn headband raises the ability score, and two enhancement bonuses do not stack', () => {
  const band = { name: 'Headband of Vast Intelligence +2', slot: 'headband', effects: suggestEffects('Headband of Vast Intelligence +2') };
  const other = { name: 'Custom int item', slot: 'head', effects: [{ target: 'int', value: 4, type: 'enhancement' }] };
  assert.equal(calc(hero([band])).abilities.int.score, 12, '10 + 2');
  assert.equal(calc(hero([band, other])).abilities.int.score, 14, 'only the +4 counts: 10 + 4');
});
test('ring of protection gives a deflection bonus to AC and touch AC', () => {
  const d = calc(hero([{ name: 'Ring of Protection +1', slot: 'ring1', effects: suggestEffects('Ring of Protection +1') }]));
  assert.equal(d.ac.total, 11, '10 + Dex 0 + 1 deflection');
  assert.equal(d.ac.touch, 11);
});
test('the roll breakdown names the item', () => {
  const d = calc(hero([{ name: 'Cloak of Resistance +2', slot: 'shoulders', effects: suggestEffects('Cloak of Resistance +2') }]));
  assert.ok(d.bd['saves.fort.total'].some(p => /Cloak of Resistance/.test(p.label) && p.value === 2));
});
