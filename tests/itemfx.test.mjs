import test from 'node:test';
import assert from 'node:assert/strict';
import { make, calc, repeat } from './helpers.mjs';
import { suggestEffects, effectsText, wornEffects, boxDuplicates, removeFromBoxes } from '../web/js/itemfx.js';
import { migrate } from '../web/js/model.js';

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
  for (const n of ['Belt of Physical Might +2', 'Headband of Mental Prowess +4', 'Rope', 'Cloak of Resistance', '', null]) assert.deepEqual(suggestEffects(n), [], String(n));
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

// Values from the item descriptions in the compendium (Core Rulebook / Ultimate Equipment).
test('items whose bonus is fixed by what they are, with no +N in the name', () => {
  const c = (skill, value) => ({ target: 'skill:' + skill, value, type: 'competence' });
  assert.deepEqual(suggestEffects('Cloak of Elvenkind'), [c('Stealth', 5)]);
  assert.deepEqual(suggestEffects('Boots of Elvenkind'), [c('Acrobatics', 5)]);
  assert.deepEqual(suggestEffects('Eyes of the Eagle'), [c('Perception', 5)]);
  assert.deepEqual(suggestEffects('Gloves of Swimming and Climbing'), [c('Climb', 5), c('Swim', 5)]);
  assert.deepEqual(suggestEffects('Ring of Swimming'), [c('Swim', 5)]);
  assert.deepEqual(suggestEffects('Ring of Climbing, Improved'), [c('Climb', 10)], 'improved is +10');
  assert.deepEqual(suggestEffects('Goggles of Minute Seeing'), [c('Disable Device', 5)]);
  assert.deepEqual(suggestEffects('Vest of Escape'), [c('Escape Artist', 6)], 'the lockpicks only help on locks, so they are left out');
  assert.deepEqual(suggestEffects('Boots of Striding and Springing'), [{ target: 'speed', value: 10, type: 'enhancement' }]);
  assert.deepEqual(suggestEffects('Circlet of Persuasion').map(e => e.target).sort(),
    ['Bluff', 'Diplomacy', 'Disguise', 'Handle Animal', 'Intimidate', 'Perform', 'Use Magic Device'].map(s => 'skill:' + s), 'every Charisma-based skill, +3');
});

test('belts and headbands for several abilities', () => {
  const e = (t, v) => ({ target: t, value: v, type: 'enhancement' });
  assert.deepEqual(suggestEffects('Belt of Physical Perfection +4'), [e('str', 4), e('dex', 4), e('con', 4)]);
  assert.deepEqual(suggestEffects('Headband of Mental Superiority +2'), [e('int', 2), e('wis', 2), e('cha', 2)]);
  assert.deepEqual(suggestEffects('Belt of Physical Might +4 (Str, Con)'), [e('str', 4), e('con', 4)], 'might: the two the name gives');
  assert.deepEqual(suggestEffects('Headband of Mental Prowess +2 (Intelligence and Wisdom)'), [e('int', 2), e('wis', 2)]);
});

test('a skill item adds to its skill, and does not stack with another competence bonus to it', () => {
  const cloak = { name: 'Cloak of Elvenkind', slot: 'shoulders', effects: suggestEffects('Cloak of Elvenkind') };
  const c = hero([cloak]);
  const base = calc(hero([])).skills.Stealth.total;
  assert.equal(calc(c).skills.Stealth.total, base + 5, '+5 competence');
  assert.equal(calc(c).skills.Perception.total, calc(hero([])).skills.Perception.total, 'only Stealth');
  c.modifiers.push({ name: 'Some competence', active: true, effects: [{ target: 'skills', value: 2, type: 'competence' }] });
  assert.equal(calc(c).skills.Stealth.total, base + 5, 'the +5 and the +2 are both competence: only the +5 counts');
});

test('a worn item whose bonus is also typed in a box is found, and taking it out counts it once', () => {
  // Fumu's case: an imported sheet put the cloak's +2 in the save Misc boxes and the amulet's +1 in Natural; wearing both counted them twice
  const c = hero([
    { name: 'Cloak of Resistance +2', slot: 'shoulders', effects: suggestEffects('Cloak of Resistance +2') },
    { name: 'Amulet of Natural Armor +1', slot: 'neck', effects: suggestEffects('Amulet of Natural Armor +1') },
    { name: 'Ring of Protection +1', slot: 'ring1', effects: suggestEffects('Ring of Protection +1') },
  ]);
  Object.assign(c.saveMisc, { fort: 2, ref: 2, will: 4 });
  Object.assign(c.ac, { natural: 1, deflection: 1 });
  assert.deepEqual(calc(c).saves.fort.total, 6, 'counted twice: 2 base + 2 box + 2 cloak');
  const dups = boxDuplicates(c);
  assert.deepEqual(dups.map(d => [d.item, d.boxes.map(b => b.path)]), [
    ['Cloak of Resistance +2', ['saveMisc.fort', 'saveMisc.ref', 'saveMisc.will']],
    ['Amulet of Natural Armor +1', ['ac.natural']],
  ], 'the ring is left alone: the Deflect box is deflection too, so it never counted twice');
  for (const d of dups) removeFromBoxes(c, d);
  assert.deepEqual([c.saveMisc.fort, c.saveMisc.ref, c.saveMisc.will, c.ac.natural], [0, 0, 2, 0], 'Will keeps the +2 that was something else');
  const d = calc(c);
  assert.equal(d.saves.fort.total, 4, '2 base + 2 cloak');
  assert.equal(d.ac.total, 12, '10 + 1 natural armor (amulet) + 1 deflection');
  assert.deepEqual(boxDuplicates(c), [], 'nothing left to ask about');
});

test('a box that holds less than the item, or a pair the player kept, is not asked about', () => {
  const c = hero([{ name: 'Cloak of Resistance +3', slot: 'shoulders', effects: suggestEffects('Cloak of Resistance +3') }]);
  Object.assign(c.saveMisc, { fort: 2, ref: 0, will: 0 });
  assert.deepEqual(boxDuplicates(c), [], '+2 in a box is not the cloak\'s +3');
  c.saveMisc = { fort: 3, ref: 3, will: 3 };
  c.itemBoxKeep = ['Cloak of Resistance +3|saves'];
  assert.deepEqual(boxDuplicates(c), []);
  c.gear[0].slot = '';
  c.itemBoxKeep = [];
  assert.deepEqual(boxDuplicates(c), [], 'carried, not worn: it adds nothing, so nothing is twice');
});

test('older saves: items with no bonuses get the ones their name now gives, once', () => {
  const c = hero([{ name: 'Cloak of Elvenkind', slot: '', effects: [] }, { name: 'Rope', effects: [] }]);
  c.version = 2;
  migrate(c);
  assert.deepEqual(c.gear.map(g => g.effects.length), [1, 0]);
  c.gear[0].effects = []; // the player cleared them afterwards: that choice stays
  migrate(c);
  assert.deepEqual(c.gear[0].effects, []);
});

test('a settled question stays settled after the save is loaded again', () => {
  const c = hero([{ name: 'Cloak of Resistance +2', slot: 'shoulders', effects: suggestEffects('Cloak of Resistance +2') }]);
  c.saveMisc = { fort: 2, ref: 2, will: 4 };
  removeFromBoxes(c, boxDuplicates(c)[0]);
  const loaded = migrate(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(loaded.itemBoxKeep, ['Cloak of Resistance +2|saves'], 'text entries survive migrate (it drops non-objects from the other lists)');
  assert.deepEqual(boxDuplicates(loaded), [], "Will's leftover +2 is not asked about again");
});
