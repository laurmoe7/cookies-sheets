// Spells cast out of items (itemspell.js). Numbers worked out from the Core Rulebook: wands, scrolls and potions use the lowest
// caster level and ability score that can cast the spell; a staff uses its wielder's caster level (if higher) and save DC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemSpellOf, itemClFromHtml, baseSpellLevel, itemCasting } from '../web/js/itemspell.js';

const SCORCHING_RAY = { Sorcerer: 2, Wizard: 2, Magus: 2, Bloodrager: 2 };
const CURE_LIGHT = { Bard: 1, Cleric: 1, Druid: 1, Paladin: 1, Ranger: 2 };
const FIREBALL = { Sorcerer: 3, Wizard: 3, Magus: 3 };

test('the spell is read from the name of a wand, scroll, potion or oil', () => {
  assert.deepEqual(itemSpellOf('Wand of Cure Light Wounds (23 charges)'), { kind: 'wand', spell: 'Cure Light Wounds', cl: null });
  assert.deepEqual(itemSpellOf('Scroll of Fireball (CL 8)'), { kind: 'scroll', spell: 'Fireball', cl: 8 });
  assert.deepEqual(itemSpellOf('Potion of Barkskin, CL 6th'), { kind: 'potion', spell: 'Barkskin', cl: 6 });
  assert.deepEqual(itemSpellOf('Oil of Magic Weapon'), { kind: 'potion', spell: 'Magic Weapon', cl: null });
  assert.equal(itemSpellOf('Staff of Fire'), null, 'a staff lists its spells in its text, not its name');
  assert.equal(itemSpellOf('Rope'), null);
});

test('a staff\'s caster level comes from its stat line', () => {
  assert.equal(itemClFromHtml('<dl class="stat"><dt>Aura</dt><dd>moderate evocation</dd><dt>CL</dt><dd>8th</dd></dl>'), 8);
  assert.equal(itemClFromHtml('<p>no stat line</p>'), null);
});

test('spell level and lowest caster level: wizard, cleric and druid lists first', () => {
  assert.deepEqual(baseSpellLevel(SCORCHING_RAY), { cls: 'Sorcerer', level: 2, cl: 3 }, '2nd-level spell: caster level 2×2 − 1 = 3');
  assert.equal(baseSpellLevel(CURE_LIGHT).cl, 1, '1st-level cleric spell: caster level 1');
  assert.deepEqual(baseSpellLevel({ Summoner: 2, Wizard: 3 }), { cls: 'Wizard', level: 3, cl: 5 }, 'haste is a 3rd-level wizard spell even though summoners get it at 2nd');
  assert.deepEqual(baseSpellLevel({ Paladin: 2 }), { cls: 'Paladin', level: 2, cl: 4 }, 'a 2nd-level paladin spell: caster level 3×2 − 2 = 4');
  assert.deepEqual(baseSpellLevel({ Wizard: 0 }), { cls: 'Wizard', level: 0, cl: 1 }, 'a cantrip is caster level 1');
});

test('a wand uses the lowest caster level and DC, whoever holds it', () => {
  const wizard = [{ cls: 'Wizard', cl: 9, statMod: 4, dcs: [14, 15, 16, 17] }];
  assert.deepEqual(itemCasting({ kind: 'wand', levels: SCORCHING_RAY, casters: wizard }), { level: 2, cl: 3, dc: 13, by: null }, 'DC 10 + 2 + 1 (Int 12)');
  assert.deepEqual(itemCasting({ kind: 'scroll', levels: FIREBALL, itemCl: 8 }), { level: 3, cl: 8, dc: 14, by: null }, 'the name\'s caster level 8; DC 10 + 3 + 1 (Int 13)');
  assert.deepEqual(itemCasting({ kind: 'potion', levels: CURE_LIGHT }), { level: 1, cl: 1, dc: 11, by: null }, 'DC 10 + 1 + 0 (Wis 11)');
});

test('a staff uses the wielder\'s caster level and save DC when the spell is on their list', () => {
  const wizard = [{ cls: 'Wizard', cl: 9, statMod: 4, dcs: [14, 15, 16, 17] }];
  assert.deepEqual(itemCasting({ kind: 'staff', levels: FIREBALL, itemCl: 8, casters: wizard }), { level: 3, cl: 9, dc: 17, by: 'Wizard' }, 'caster level 9 beats the staff\'s 8; DC 10 + 3 + 4');
  assert.equal(itemCasting({ kind: 'staff', levels: FIREBALL, itemCl: 8, casters: [{ cls: 'Wizard', cl: 5, statMod: 3, dcs: [13, 14, 15, 16] }] }).cl, 8, 'a 5th-level wizard uses the staff\'s caster level 8');
  assert.deepEqual(itemCasting({ kind: 'staff', levels: FIREBALL, itemCl: 8, casters: [{ cls: 'Cleric', cl: 12, statMod: 5, dcs: [] }] }), { level: 3, cl: 8, dc: 14, by: null }, 'not on the cleric list: the staff\'s own caster level, DC 10 + 3 + 1');
});
