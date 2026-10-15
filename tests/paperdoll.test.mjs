import test from 'node:test';
import assert from 'node:assert/strict';
import { newCharacter } from '../web/js/model.js';
import { hintFromSub, slotOf, wornBySlot, candidates, wear, takeOff, SLOTS, LAYOUT } from '../web/js/paperdoll.js';

const char = () => {
  const c = newCharacter();
  c.armor = [
    { name: 'Chain shirt', type: 'armor', equipped: true }, { name: 'Buckler', type: 'shield', equipped: true },
    { name: 'Spare mail', type: 'armor', equipped: false },
  ];
  c.weapons = [{ name: 'Longsword' }, { name: 'Dagger', slot: 'off' }];
  c.gear = [
    { name: 'Ring of Protection +1', hint: 'ring', slot: '' }, { name: 'Ring of Feather Falling', hint: 'ring', slot: 'ring1' },
    { name: 'Cloak of Resistance +1', hint: 'shoulders', slot: '' }, { name: 'Rope', hint: '', slot: '' },
  ];
  return c;
};

test('the compendium sub-category says which slot a magic item fits', () => {
  assert.equal(hintFromSub('ring'), 'ring');
  assert.equal(hintFromSub('wrist'), 'wrists');
  assert.equal(hintFromSub('arms'), 'wrists');
  assert.equal(hintFromSub('Shoulders'), 'shoulders');
  for (const none of ['', 'gear', 'material', 'alchemical', 'weapon', null, undefined]) assert.equal(hintFromSub(none), '', String(none));
});

test('armor and shields are worn in their own slots when ticked; weapons and gear only when given one', () => {
  const c = char();
  assert.equal(slotOf(c, 'armor', 0), 'armor');
  assert.equal(slotOf(c, 'armor', 1), 'shield');
  assert.equal(slotOf(c, 'armor', 2), '', 'not worn');
  assert.equal(slotOf(c, 'weapon', 0), '');
  assert.equal(slotOf(c, 'weapon', 1), 'off');
  const w = wornBySlot(c);
  assert.deepEqual(Object.keys(w).sort(), ['armor', 'off', 'ring1', 'shield']);
  assert.equal(w.ring1[0].name, 'Ring of Feather Falling');
});

test('wearing something takes off what was in the slot, and a slot holds one thing', () => {
  const c = char();
  wear(c, 'ring1', 'gear', 0);
  assert.equal(c.gear[0].slot, 'ring1');
  assert.equal(c.gear[1].slot, '', 'the old ring came off');
  wear(c, 'armor', 'armor', 2);
  assert.equal(c.armor[2].equipped, true);
  assert.equal(c.armor[0].equipped, false, 'the chain shirt came off, so it stops counting for AC');
});

test('taking off: armor is unticked, anything else loses its slot', () => {
  const c = char();
  takeOff(c, 'armor', 1); takeOff(c, 'weapon', 1); takeOff(c, 'gear', 1);
  assert.equal(c.armor[1].equipped, false);
  assert.equal(c.weapons[1].slot, '');
  assert.equal(c.gear[1].slot, '');
  assert.deepEqual(wornBySlot(c), { armor: [{ kind: 'armor', i: 0, name: 'Chain shirt' }] });
});

test('what is offered for a slot: matching items first, then the rest of what you carry that is not worn', () => {
  const c = char();
  const ring = candidates(c, 'ring2');
  assert.deepEqual(ring.good.map(x => x.name), ['Ring of Protection +1'], 'the worn ring is not offered again');
  assert.deepEqual(ring.other.map(x => x.name), ['Cloak of Resistance +1', 'Rope']);
  assert.deepEqual(candidates(c, 'armor').good.map(x => x.name), ['Spare mail'], 'armor slot: armor you are not already wearing there');
  assert.deepEqual(candidates(c, 'shield').good.map(x => x.name), [], 'the only shield is already in the slot');
  assert.deepEqual(candidates(c, 'main').good.map(x => x.name), ['Longsword', 'Dagger'], 'a weapon can move hands');
});

test('every slot is placed on the doll exactly once', () => {
  const placed = [...LAYOUT.left, ...LAYOUT.right, ...LAYOUT.bottom].sort();
  assert.deepEqual(placed, SLOTS.map(s => s.id).sort());
});

test('an item can be worn in another slot than its default: a robe is "body" armor', () => {
  const c = char();
  wear(c, 'body', 'armor', 2);
  assert.equal(slotOf(c, 'armor', 2), 'body');
  assert.equal(c.armor[0].equipped, true, 'the chain shirt stays on: a different slot');
});

test('inventory sorts alphabetically: case ignored, numbers as numbers, unnamed last, stable', async () => {
  const { sortByName } = await import('../web/js/paperdoll.js');
  const names = l => l.map(x => x.name);
  assert.deepEqual(names(sortByName([{ name: 'rope' }, { name: 'Bedroll' }, { name: '' }, { name: 'Ration' }, { name: 'Torch 10' }, { name: 'Torch 2' }])),
    ['Bedroll', 'Ration', 'rope', 'Torch 2', 'Torch 10', ''], 'Torch 2 before Torch 10');
  const a = { name: 'Potion', id: 1 }, b = { name: 'potion', id: 2 };
  assert.deepEqual(sortByName([a, b]).map(x => x.id), [1, 2], 'equal names keep their order');
  const list = [{ name: 'b' }, { name: 'a' }];
  sortByName(list);
  assert.equal(list[0].name, 'b', 'the original list is not changed');
});
