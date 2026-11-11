// Charges and daily uses on inventory items (charges.js). Numbers from the Core Rulebook (wands 50 charges, staves 10) and the items' text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { guessCharges, staffSpells, wandSpell, spendCharges, chargesLeft, chargesText, chargesRecord, restCharges } from '../web/js/charges.js';
import { newCharacter, migrate } from '../web/js/model.js';

const STAFF_OF_FIRE = '<p>Crafted from bronzewood with brass bindings, this staff allows use of the following spells:</p><ul><li><i>Burning hands</i> (1 charge)</li><li><i>Fireball</i> (2 charges)</li><li><i>Wall of fire</i> (3 charges)</li></ul>';

test('a wand has 50 charges and holds the spell its name says; a name can say how many are left', () => {
  assert.deepEqual(guessCharges('Wand of Cure Light Wounds'), { max: 50, cur: 50, per: 'total', unit: 'charges', spells: [{ name: 'Cure Light Wounds', cost: 1 }], auto: true });
  assert.equal(guessCharges('Wand of Magic Missile (23 charges)').cur, 23);
  assert.equal(wandSpell('Wand of Magic Missile (23 charges)'), 'Magic Missile');
  assert.equal(guessCharges('Wand Key Ring', 'keyed to a specific spell'), null, 'not a wand');
});

test('a staff has 10 charges and its spells cost what its text says', () => {
  assert.deepEqual(staffSpells(STAFF_OF_FIRE), [{ name: 'Burning hands', cost: 1 }, { name: 'Fireball', cost: 2 }, { name: 'Wall of fire', cost: 3 }]);
  const g = guessCharges('Staff of Fire', STAFF_OF_FIRE);
  assert.deepEqual([g.max, g.per, g.auto], [10, 'total', true]);
});

test('stated charges, rounds per day and uses per day are read from the text', () => {
  assert.deepEqual(guessCharges('Ring of the Ram', '<p>A ring of the ram has 50 charges.</p>'), { max: 50, cur: 50, per: 'total', unit: 'charges', auto: true });
  assert.deepEqual(guessCharges('Boots of Speed', 'act as though affected by a <i>haste</i> spell for up to 10 rounds each day.'), { max: 10, cur: 10, per: 'day', unit: 'rounds', auto: false });
  assert.equal(guessCharges('Cape of the Mountebank', 'dimension door, once per day').max, 1);
  assert.equal(guessCharges('Helm', 'can use it three times per day').max, 3);
  assert.equal(guessCharges('Amulet', 'usable 2/day').max, 2);
  assert.equal(guessCharges('Rope', 'Fifty feet of hemp rope'), null);
});

test('spending: never below 0, never above the maximum, and a 2-charge spell needs 2 left', () => {
  const ch = chargesRecord(guessCharges('Staff of Fire', STAFF_OF_FIRE));
  assert.equal(ch.auto, undefined, 'the stored record has no auto flag');
  ch.cur = 3;
  assert.equal(spendCharges(ch, 2), true, 'fireball');
  assert.equal(chargesLeft(ch), 1);
  assert.equal(spendCharges(ch, 2), false, 'only 1 left');
  assert.equal(chargesLeft(ch), 1, 'nothing spent');
  spendCharges(ch, -20);
  assert.equal(chargesLeft(ch), 10, 'recharging stops at 10');
  assert.equal(chargesText(ch), '10/10 charges');
  assert.equal(chargesText({ max: 3, cur: 1, per: 'day', unit: 'uses' }), '1/3 uses per day');
});

test('restCharges refills only the per-day ones', () => {
  const c = { gear: [{ charges: { max: 3, cur: 0, per: 'day', unit: 'uses' } }, { charges: { max: 50, cur: 5, per: 'total' } }, { charges: null }] };
  assert.equal(restCharges(c), 1);
  assert.deepEqual(c.gear.map(g => g.charges && g.charges.cur), [3, 5, null]);
});

test('old saves: items without charges get charges: null', () => {
  const c = newCharacter();
  c.gear = [{ name: 'Rope', qty: 1 }];
  assert.equal(migrate(c).gear[0].charges, null);
});
