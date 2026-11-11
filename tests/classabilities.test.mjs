// Class features you use, listed with the spell-likes on the Spells tab.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityUse, usableAbilities, abilityActions } from '../web/js/classabilities.js';
import { classResources } from '../web/js/resources.js';

test('abilityUse reads how a feature is used from its text', () => {
  assert.equal(abilityUse('Detect evil', '<p>At will, a paladin can use <i>detect evil</i>, as the spell.</p>'), 'At will');
  assert.equal(abilityUse('Smite evil 1/day', 'Once per day, a paladin can call out to the powers of good'), 'Per day');
  assert.equal(abilityUse('Wild shape', 'turn herself into any Small or Medium animal and back again once per day. ... at will at 20th level'), 'Per day', 'daily wins over at will');
  assert.equal(abilityUse('Channel positive energy', 'Using this ability consumes two uses of her lay on hands ability.'), 'Uses a pool');
  assert.equal(abilityUse('Quarry', 'As a standard action, a ranger can denote one target'), 'Standard action');
  assert.equal(abilityUse('Abundant step', 'as if using the spell dimension door'), 'Spell-like');
});
test('passive features are left out, whatever their text says', () => {
  assert.equal(abilityUse('Aura of good', "The power of a paladin's aura of good is equal to her paladin level."), null);
  assert.equal(abilityUse('Aura of courage', 'Once per day... allies gain a +4 morale bonus'), null, 'auras are always on');
  assert.equal(abilityUse('Weapon and Armor Proficiency', 'Paladins are proficient with all simple and martial weapons'), null);
  assert.equal(abilityUse('Divine grace', 'a bonus equal to her Charisma bonus on all saving throws'), null);
});
test('usableAbilities: one per ability, the latest name, with its pool', () => {
  const lookup = n => n.replace(/\s*\d+\/day$/, '');
  const feats = [['Smite evil 1/day', 1], ['Detect evil', 1], ['Aura of good', 1], ['Lay on hands', 2], ['Smite evil 2/day', 4]]
    .map(([name, level]) => ({ name, level, cls: 'Paladin', lookup: lookup(name) }));
  const texts = { 'Smite evil': 'Once per day', 'Detect evil': 'At will, detect evil', 'Aura of good': 'aura', 'Lay on hands': 'heal wounds by touch' };
  const pools = classResources({ Paladin: 4 }, { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 2 });
  const got = usableAbilities(feats, texts, pools);
  assert.deepEqual(got.map(a => [a.name, a.level, a.use]), [['Detect evil', 1, 'At will'], ['Smite evil 2/day', 1, 'Per day'], ['Lay on hands', 2, 'Per day']],
    'smite evil once, under its 4th-level name but from 1st; lay on hands counts because a pool tracks it');
  assert.equal(got.find(a => a.lookup === 'Lay on hands').pool.max, 4, 'floor(4/2) + 2 = 4 uses');
  assert.equal(got.find(a => a.lookup === 'Detect evil').pool, undefined);
});
test('abilityActions: dice, DCs, costs and buffs from the rules', () => {
  const pal6 = { level: 6, mods: { cha: 3 } };
  assert.deepEqual(abilityActions('Lay on hands', 'Paladin', pal6).rolls[0], { label: 'Heal', dice: '3d6', group: 'Healing' }, '1d6 per two paladin levels: 6/2 = 3d6');
  assert.deepEqual(abilityActions('Lay on hands', 'Paladin', { ...pal6, greaterMercy: true }).rolls.map(r => r.dice), ['3d6', '4d6', '3d6'],
    'Greater Mercy: +1d6 (3d6 + 1d6) when no mercy has a condition to remove; harming undead stays 3d6');
  const ch = abilityActions('Channel positive energy', 'Paladin', pal6);
  assert.equal(ch.rolls[0].dice, '3d6', 'as a cleric of her paladin level: ceil(6/2) = 3d6');
  assert.equal(ch.dc.value, 16, '10 + 3 (half of 6) + 3 Cha');
  assert.deepEqual(ch.cost, { pool: 'lay-on-hands', n: 2 }, 'two uses of lay on hands');
  assert.equal(abilityActions('Channel energy', 'Cleric', { level: 5, mods: { cha: 1 } }).rolls[0].dice, '3d6', 'cleric 5: 1d6 + 1d6 at 3rd and 5th');
  const smite = abilityActions('Smite evil', 'Paladin', pal6).buff;
  assert.deepEqual(smite.effects.map(e => [e.target, e.value, e.type]), [['attack', 3, 'untyped'], ['damage', 6, 'untyped'], ['ac', 3, 'deflection']], '+Cha attack, +level damage, +Cha deflection');
  assert.equal(abilityActions('Smite evil', 'Paladin', { level: 1, mods: { cha: -1 } }).buff.effects[0].value, 0, 'no Cha bonus, no penalty');
  assert.equal(abilityActions('Rage', 'Barbarian', { level: 11 }).preset, 'Greater Rage', 'greater rage at 11th');
  assert.equal(abilityActions('Bardic performance', 'Bard', { level: 5 }).preset, 'Inspire Courage +2', '+2 at 5th');
  assert.equal(abilityActions('Quivering palm', 'Monk', { level: 15, mods: { wis: 4 } }).dc.value, 21, '10 + 7 + 4');
  assert.deepEqual(abilityActions('Detect evil', 'Paladin', pal6), { rolls: [] });
});
