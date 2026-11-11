// Weapon and armor templates (data/equipment.json). Expected values are the Core Rulebook's tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weaponFromTemplate, armorFromTemplate, filterTemplates, blankWeapon, blankArmor, weaponTemplateFor, inventoryWeapons, attackFor, gearFor, addAttackFromGear, addGearFromAttack, setWeaponPlus, linkByName, armorTemplateFor, armorFromGear, moveGearToArmor, setArmorPlus, isPlainArmor, withPlus } from '../web/js/equipment.js';
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

test('Weapon Finesse: a character with the feat gets Dex on light weapons and the four the feat names, never on others', () => {
  const dex = name => weaponFromTemplate(w(name), 'Medium', true).ability;
  assert.equal(dex('Spiked chain'), 'dex', 'the spiked chain is named in the feat');
  assert.equal(dex('Rapier'), 'dex');
  assert.equal(dex('Whip'), 'dex');
  assert.equal(dex('Dagger'), 'dex', 'light weapons');
  assert.equal(dex('Longsword'), '', 'a longsword is not light');
  assert.equal(dex('Longbow'), '', 'ranged weapons never');
  assert.equal(weaponFromTemplate(w('Spiked chain')).ability, '', 'without the feat it stays on auto (Strength)');
  const c = make({ raceChoice: 'dex', base: { str: 10, dex: 16 }, levels: ['Fighter', 'Fighter', 'Fighter', 'Fighter'] });
  c.weapons = [weaponFromTemplate(w('Spiked chain'), 'Medium', true), weaponFromTemplate(w('Spiked chain'))];
  const d = calc(c);
  assert.equal(d.weapons[0].attack, 4 + 4, 'BAB 4 (fighter 4) + Dex 18 (+4) with the feat');
  assert.equal(d.weapons[1].attack, 4 + 0, 'BAB 4 + Str 10 (+0) without');
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

test('inventory weapons: which items are weapons, and their standard stats', () => {
  const W = data.weapons;
  assert.equal(weaponTemplateFor('Longsword', W).name, 'Longsword');
  assert.equal(weaponTemplateFor('Longsword +1', W).name, 'Longsword', 'the +N is not part of the kind');
  assert.equal(weaponTemplateFor('+2 Cold Iron Longsword', W).name, 'Longsword', 'nor are the bonus and the material');
  assert.equal(weaponTemplateFor('Hooked Lance', W).name, 'Hooked lance', 'the longest name that fits, not Lance');
  assert.equal(weaponTemplateFor('Lance', W).name, 'Lance');
  assert.equal(weaponTemplateFor('Headband of Alluring Charisma +2', W), null, 'not a weapon');
  assert.equal(weaponTemplateFor('Cloak of Resistance +2', W), null);
});

test('inventory weapons: adding one to the attacks links the two and counts its weight once', () => {
  const W = data.weapons;
  const c = make({ raceChoice: 'cha', base: { str: 10 }, levels: ['Fighter'] });
  c.gear = [{ name: 'Longsword +1', qty: 1, weight: 4 }, { name: 'Lance', qty: 1, weight: 10 }, { name: 'Rope', qty: 1, weight: 10 }];
  assert.deepEqual(inventoryWeapons(c, W).map(x => [x.i, x.tpl.name, x.attack]), [[0, 'Longsword', -1], [1, 'Lance', -1]], 'two weapons, neither in attacks; the rope is not one');
  const i = addAttackFromGear(c, c.gear[0], weaponTemplateFor(c.gear[0].name, W));
  const w = c.weapons[i];
  assert.equal(w.name, 'Longsword +1');
  assert.equal(w.enh, 1, 'the +1 in its name is its enhancement bonus');
  assert.equal(w.damage, '1d8', 'Medium longsword');
  assert.equal(w.gearUid, c.gear[0].uid, 'linked');
  assert.equal(attackFor(c, c.gear[0]), i);
  assert.equal(addAttackFromGear(c, c.gear[0], weaponTemplateFor('Longsword', W)), i, 'adding again gives the same row, not a second one');
  const d = calc(c);
  assert.equal(d.weapons[0].attackText.split('/')[0], '+2', 'fighter 1 BAB +1, Str 10 +0 (the human’s +2 goes to Cha), enhancement +1');
  assert.equal(d.encumbrance.weight, 24, 'longsword 4 + lance 10 + rope 10; the linked attack row adds nothing');
});

test('inventory weapons: a hand-made attack row goes into the inventory, and +N changes both', () => {
  const c = make({ levels: ['Fighter'] });
  c.gear = [];
  c.weapons = [{ name: 'Lance', weight: 10, enh: 0 }];
  const gi = addGearFromAttack(c, c.weapons[0]);
  assert.equal(c.gear[gi].name, 'Lance');
  assert.equal(gearFor(c, c.weapons[0]), gi, 'linked');
  assert.equal(calc(c).encumbrance.weight, 10, 'counted once');
  setWeaponPlus(c, c.gear[gi], 2);
  assert.equal(c.gear[gi].name, 'Lance +2');
  assert.equal(c.weapons[0].name, 'Lance +2');
  assert.equal(c.weapons[0].enh, 2);
  setWeaponPlus(c, c.gear[gi], 0);
  assert.equal(c.gear[gi].name, 'Lance', '+0 takes the bonus off the name');
  assert.equal(c.weapons[0].enh, 0);
});

test('inventory weapons: an attack row of the same kind made before counts as its attack', () => {
  const c = make({ levels: ['Fighter'] });
  c.gear = [{ name: 'Longsword', qty: 1, weight: 4 }];
  c.weapons = [{ name: 'Longsword', weight: 4, enh: 0 }];
  assert.equal(inventoryWeapons(c, data.weapons)[0].attack, 0, 'not offered again');
  addAttackFromGear(c, c.gear[0], weaponTemplateFor('Longsword', data.weapons));
  assert.equal(c.weapons.length, 1, 'linked instead of a second row');
  assert.equal(c.weapons[0].gearUid, c.gear[0].uid);
});

test('inventory weapons: a row and an item of the same weapon made separately get linked, one to one', () => {
  const c = make({ levels: ['Fighter'] });
  c.gear = [{ name: 'Lance', qty: 1, weight: 10 }, { name: 'Dagger', weight: 1 }, { name: 'Dagger', weight: 1 }];
  c.weapons = [{ name: 'Lance', weight: 10, enh: 2 }, { name: 'Dagger', weight: 1 }];
  assert.equal(linkByName(c), true);
  assert.equal(c.weapons[0].gearUid, c.gear[0].uid);
  assert.equal(c.weapons[1].gearUid, c.gear[1].uid, 'the first dagger');
  assert.equal(c.gear[2].uid, undefined, 'the second dagger has no row of its own');
  assert.equal(calc(c).encumbrance.weight, 12, 'lance 10 + two daggers 1 each; the linked rows add nothing');
  assert.equal(linkByName(c), false, 'nothing more to link');
});

test('inventory to armor: which items are armor or shields, by the book list', () => {
  const A = data.armor;
  assert.equal(armorTemplateFor('Chain Shirt', A).name, 'Chain shirt');
  assert.equal(armorTemplateFor('+1 Mithral Chain Shirt', A).name, 'Chain shirt', 'bonus and material are not the kind');
  assert.equal(armorTemplateFor('Studded Leather Armor', A).name, 'Studded leather', 'the longest name that fits, not Leather');
  assert.equal(armorTemplateFor('Heavy Steel Shield +1', A).name, 'Heavy steel');
  assert.equal(armorTemplateFor('Light Wooden Shield', A).name, 'Light wooden', 'not the Wooden armor');
  assert.equal(armorTemplateFor('Chain mail', A).name, 'Chainmail', 'written as two words');
  assert.equal(armorTemplateFor('Rope', A), null);
  assert.equal(armorTemplateFor('Longsword', A), null);
});

test('inventory to armor: a dropped item becomes a row with the book numbers and its +N, and leaves the inventory', () => {
  const c = make({ levels: ['Fighter'] });
  c.armor = [];
  c.gear = [{ name: '+1 Mithral Chain Shirt', qty: 1, weight: 0 }, { name: 'Heavy Steel Shield', qty: 2, weight: 15 }, { name: 'Rope', qty: 1, weight: 10 }];
  assert.equal(moveGearToArmor(c, 0, data.armor), 0);
  const a = c.armor[0];
  assert.equal(a.bonus, 4, 'chain shirt: armor bonus +4');
  assert.equal(a.enh, 1, 'the +1 in its name');
  assert.equal(a.material, 'mithral');
  assert.equal(a.type, 'armor');
  assert.equal(a.weight, 25, 'no weight on the item, so the book weight (mithral halves it in calc.js)');
  assert.deepEqual(c.gear.map(g => g.name), ['Heavy Steel Shield', 'Rope'], 'it left the inventory');
  assert.equal(moveGearToArmor(c, 0, data.armor), 1);
  assert.equal(c.armor[1].type, 'shield');
  assert.equal(c.armor[1].bonus, 2, 'heavy steel shield: +2');
  assert.equal(c.gear[0].qty, 1, 'one of the two shields moved');
  assert.equal(moveGearToArmor(c, 1, data.armor), -1, 'rope is not armor');
  assert.equal(c.gear.length, 2, 'and stays in the inventory');
});

test('inventory to armor: magic armor not on the book list still moves when the compendium files it as armor', () => {
  const row = armorFromGear({ name: 'Celestial Armor', hint: 'armor', weight: 20, id: 42 }, data.armor);
  assert.equal(row.name, 'Celestial Armor');
  assert.equal(row.type, 'armor');
  assert.equal(row.weight, 20);
  assert.equal(row.id, 42, 'keeps its compendium entry');
  assert.equal(armorFromGear({ name: 'Mysterious Thing' }, data.armor), null);
});

test('armor in the inventory: +N, and which added items go with the armor', () => {
  const a = { name: 'Breastplate', bonus: 6, enh: 0 };
  setArmorPlus(a, 2);
  assert.equal(a.name, 'Breastplate +2');
  assert.equal(a.enh, 2, '+2 armor: +2 enhancement to its armor bonus');
  assert.equal(a.mw, true, 'magic armor is masterwork');
  setArmorPlus(a, 0);
  assert.equal(a.name, 'Breastplate', '+0 takes the +N off');
  assert.equal(withPlus('+1 Longsword', 3), 'Longsword +3', 'a +N in front moves to the end');
  assert.equal(isPlainArmor({ name: 'Chain Shirt' }, data.armor), true);
  assert.equal(isPlainArmor({ name: 'Celestial Armor', hint: 'armor' }, data.armor), true, 'the compendium files it as armor');
  assert.equal(isPlainArmor({ name: 'Leather Pouch' }, data.armor), false, 'only an exact armor name, not one that contains "leather"');
  assert.equal(isPlainArmor({ name: 'Rope' }, data.armor), false);
});
