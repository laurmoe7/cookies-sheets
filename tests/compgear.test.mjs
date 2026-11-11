// Gear on companions: barding and worn items. Expected values are worked out by hand from the Core Rulebook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeCompanion, newCompanion } from '../web/js/companions.js';
import { bardingFromTemplate, reducedSpeed, companionGear } from '../web/js/compgear.js';
import { rootPath } from './helpers.mjs';

const data = JSON.parse(readFileSync(new URL('../data/companions.json', import.meta.url), 'utf-8'));
const equip = JSON.parse(readFileSync(rootPath + 'data/equipment.json', 'utf-8'));
const armor = name => equip.armor.find(a => a.name === name);
// A level-5 horse (advanced at 4th): Str 16 + 2 + 1 = 19 (+4), Dex 13 + 1 = 14 (+2), Con 15 + 2 = 17 (+3), natural armor 4 + 2 = 6, Large.
const horse = (extra = {}) => ({ ...newCompanion('animal', data), species: 'Horse', ...extra });
const calc = comp => computeCompanion(comp, { _animal: 5 }, data);

test('speed in medium or heavy armor (Core Rulebook table)', () => {
  assert.deepEqual([20, 30, 40, 50, 60, 70, 80, 100].map(reducedSpeed), [15, 20, 30, 35, 40, 50, 55, 70]);
});

test('barding: the book armor, weight for the mount’s size', () => {
  const b = bardingFromTemplate(armor('Chain shirt'), 'Large');
  assert.equal(b.name, 'Chain shirt barding');
  assert.equal(b.weight, 50, 'chain shirt 25 lb. × 2 for a Large creature');
  assert.equal(b.bonus, 4);
  assert.equal(bardingFromTemplate(armor('Chain shirt'), 'Medium').weight, 25, 'Medium: × 1');
});

test('barding on a horse: AC, max Dex, check penalty, speed', () => {
  assert.equal(calc(horse()).ac.total, 17, 'no gear: 10 + 6 natural + 2 Dex − 1 size');
  const shirt = calc(horse({ barding: bardingFromTemplate(armor('Chain shirt'), 'Large') }));
  assert.equal(shirt.ac.total, 21, '17 + 4 armor');
  assert.equal(shirt.ac.touch, 11, 'armor does not count on touch: 10 + 2 Dex − 1');
  assert.equal(shirt.ac.flat, 19, 'flat-footed: 21 − 2 Dex');
  assert.match(shirt.speed, /^50/, 'light armor: full speed');

  const mail = horse({ barding: bardingFromTemplate(armor('Chainmail'), 'Large'), skills: { Swim: 1 } });
  const m = calc(mail);
  assert.equal(m.ac.total, 23, '10 + 6 natural + 2 Dex (max Dex 2, not capped) − 1 + 6 armor');
  assert.match(m.speed, /^35/, 'medium armor: 50 ft. → 35 ft.');
  assert.equal(m.skills.find(x => x.name === 'Swim').total, 3, '1 rank + 4 Str + 3 class skill − 5 check penalty');
  mail.barding.enh = 1;
  assert.equal(calc(mail).ac.total, 24, '+1 chainmail: 23 + 1');
  mail.barding.material = 'mithral';
  const mi = calc(mail);
  assert.match(mi.speed, /^50/, 'mithral chainmail counts as light: full speed');
  assert.equal(mi.gear.barding.maxDex, 4, 'max Dex 2 + 2 for mithral');
  assert.equal(mi.gear.barding.weight, 40, '80 lb. × ½ for mithral');
  mail.barding.equipped = false;
  assert.equal(calc(mail).ac.total, 17, 'taken off: no AC');
});

test('barding caps the mount’s Dex bonus to AC', () => {
  const plate = calc(horse({ barding: bardingFromTemplate(armor('Full plate'), 'Large') }));
  assert.equal(plate.ac.total, 10 + 6 + 1 - 1 + 9, 'full plate +9, max Dex 1: Dex +2 counts as +1 → 25');
  assert.equal(plate.ac.dexCapped, true);
  assert.match(plate.speed, /^35/, 'heavy armor slows too');
});

test('worn items on a companion: saves, AC, attacks, and only while worn', () => {
  const items = [
    { name: 'Cloak of Resistance +1', worn: true, effects: [{ target: 'saves', value: 1, type: 'resistance' }] },
    { name: 'Collar of protection', worn: true, effects: [{ target: 'ac', value: 1, type: 'deflection' }] },
    { name: 'Amulet of Mighty Fists +1', worn: true, effects: [{ target: 'attack', value: 1, type: 'enhancement' }, { target: 'damage', value: 1, type: 'enhancement' }] },
  ];
  const base = calc(horse()), s = calc(horse({ items }));
  assert.equal(s.saves.fort, base.saves.fort + 1, 'resistance +1 on Fortitude');
  assert.equal(s.saves.will, base.saves.will + 1, 'and on Will');
  assert.equal(s.ac.total, 18, '17 + 1 deflection');
  assert.equal(s.ac.touch, base.ac.touch + 1, 'deflection counts on touch');
  const bite = s.attacks.find(a => a.name === 'bite'), bite0 = base.attacks.find(a => a.name === 'bite');
  assert.equal(bite.bonus, bite0.bonus + 1, 'amulet: +1 to attack');
  assert.equal(bite.damage, '1d4+5', 'bite 1d4 + 4 Str + 1 amulet');
  items[0].worn = false;
  assert.equal(calc(horse({ items })).saves.fort, base.saves.fort, 'a cloak not worn does not count');
});

test('two items of the same bonus type do not stack', () => {
  const items = [{ name: 'Ring A', effects: [{ target: 'ac', value: 1, type: 'deflection' }] }, { name: 'Ring B', effects: [{ target: 'ac', value: 2, type: 'deflection' }] }];
  assert.equal(companionGear({ items }).stat('ac'), 2, 'deflection +1 and +2: only the +2 counts');
});
