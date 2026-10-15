// Weapon and armor templates (data/equipment.json). Expected values are the Core Rulebook's tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weaponFromTemplate, armorFromTemplate, filterTemplates, blankWeapon, blankArmor } from '../web/js/equipment.js';
import { rootPath, make, calc } from './helpers.mjs';

const data = JSON.parse(readFileSync(rootPath + 'data/equipment.json', 'utf-8'));
const w = name => data.weapons.find(x => x.name === name);
const a = name => data.armor.find(x => x.name === name);

test('the list has the core weapons and armor with the book numbers', () => {
  assert.ok(data.weapons.length > 150 && data.armor.length > 35);
  assert.deepEqual([w('Longsword').dmgM, w('Longsword').dmgS, w('Longsword').crit, w('Longsword').weight, w('Longsword').type], ['1d8', '1d6', '19-20/x2', 4, 'S']);
  assert.deepEqual([w('Greatsword').dmgM, w('Greatsword').kind], ['2d6', 'two-handed']);
  assert.deepEqual([w('Longbow').range, w('Longbow').crit, w('Longbow').kind], ['100 ft.', 'x3', 'ranged']);
  assert.deepEqual([a('Chainmail').bonus, a('Chainmail').maxDex, a('Chainmail').acp, a('Chainmail').asf, a('Chainmail').weight], [6, 2, -5, 30, 40]);
  assert.deepEqual([a('Full plate').bonus, a('Full plate').category, a('Full plate').maxDex], [9, 'heavy', 1]);
  assert.equal(a('Buckler').category, 'shield');
  assert.ok(!data.weapons.some(x => x.kind === 'ammunition' || /^arrows?\b/i.test(x.name)), 'ammunition is not a weapon');
});

test('a weapon template becomes a row: damage by size, two-handed gets x1.5 Strength, thrown weapons add Strength', () => {
  const sword = weaponFromTemplate(w('Longsword'));
  assert.deepEqual([sword.name, sword.damage, sword.crit, sword.type, sword.weight, sword.ranged, sword.dmgMult, sword.dmgAbility], ['Longsword', '1d8', '19-20/x2', 'S', 4, false, '', '']);
  assert.equal(weaponFromTemplate(w('Longsword'), 'Small').damage, '1d6', 'Small wielders use the Small column');
  assert.equal(weaponFromTemplate(w('Greatsword')).dmgMult, '1.5');
  const bow = weaponFromTemplate(w('Longbow'));
  assert.deepEqual([bow.ranged, bow.range, bow.dmgAbility], [true, '100 ft.', ''], 'bows do not add Strength');
  assert.equal(weaponFromTemplate(w('Javelin')).dmgAbility, 'str', 'thrown weapons do');
  assert.deepEqual(Object.keys(sword).sort(), Object.keys(blankWeapon()).sort(), 'every field a weapon needs is there');
});

test('an armor template becomes a row, and shields are shields', () => {
  const mail = armorFromTemplate(a('Chainmail'));
  assert.deepEqual([mail.type, mail.category, mail.bonus, mail.maxDex, mail.acp, mail.asf, mail.weight], ['armor', 'medium', 6, 2, -5, 30, 40]);
  const shield = armorFromTemplate(a('Buckler'));
  assert.deepEqual([shield.type, shield.category, shield.bonus, shield.acp], ['shield', 'light', 1, -1]);
  assert.equal(armorFromTemplate(a('Haramaki')).maxDex, '', 'no Dex cap is a blank, as on the sheet');
  assert.deepEqual(Object.keys(mail).sort(), Object.keys(blankArmor()).sort());
});

test('templates drive the numbers: a longsword gives +3 damage from Str 16, chainmail +6 AC with Dex capped at +2', () => {
  const d = calc(make({ raceChoice: 'con', base: { str: 16, dex: 14 }, levels: ['Fighter'], weapons: [weaponFromTemplate(w('Longsword'))], armor: [armorFromTemplate(a('Chainmail'))] }));
  assert.equal(d.weapons[0].damageText, '1d8+3', 'Str 16 is +3');
  assert.equal(d.ac.total, 10 + 6 + 2, '10 + armor 6 + Dex 14 (+2, equal to the cap)');
  assert.equal(d.acp, -5);
});

test('searching and filtering the list', () => {
  assert.ok(filterTemplates(data.weapons, 'sword').every(t => /sword/i.test(t.name)));
  assert.ok(filterTemplates(data.weapons, 'long sword').some(t => t.name === 'Longsword'), 'each word only has to be somewhere in the name');
  assert.equal(filterTemplates(data.weapons, 'long zzzz').length, 0, 'but every word must be');
  assert.ok(filterTemplates(data.weapons, '', t => t.prof === 'Simple').every(t => t.prof === 'Simple'));
  assert.equal(filterTemplates(data.armor, 'zzzz').length, 0);
});
