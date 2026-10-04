// Animal companion and eidolon stat blocks. Expected values are worked out by hand from the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeCompanion, newCompanion, animalCompanionLevel, stepDice } from '../web/js/companions.js';

const data = JSON.parse(readFileSync(new URL('../data/companions.json', import.meta.url), 'utf-8'));
const animal = (species, extra = {}) => ({ ...newCompanion('animal', data), species, ...extra });
const eidolon = (form, extra = {}) => ({ ...newCompanion('eidolon', data), form, ...extra });

test('data: 68 animal species, both progression tables, 4 eidolon forms', () => {
  assert.equal(data.animal.species.length, 68);
  assert.equal(data.animal.progression.length, 20);
  assert.equal(data.eidolon.progression.length, 20);
  assert.deepEqual(data.eidolon.forms.map(f => f.name), ['Biped', 'Quadruped', 'Serpentine', 'Aquatic']);
  assert.ok(data.eidolon.evolutions.length > 60);
});

test('companion level: druid + hunter + ranger-3 + cavalier', () => {
  assert.equal(animalCompanionLevel({ Druid: 5 }), 5);
  assert.equal(animalCompanionLevel({ Ranger: 3 }), 0);
  assert.equal(animalCompanionLevel({ Ranger: 6, Druid: 2 }), 5);
  assert.equal(animalCompanionLevel({ Cavalier: 4 }), 4);
});

test('wolf at druid 1', () => {
  const s = computeCompanion(animal('Wolf'), { Druid: 1 }, data);
  assert.equal(s.level, 1);
  assert.equal(s.hd, 2);
  assert.equal(s.hp, 9 + 4, '2d8 average (9) + Con 2 x 2');
  assert.deepEqual([s.ac.total, s.ac.touch, s.ac.flat], [14, 12, 12], '+2 natural, +2 Dex');
  assert.deepEqual(s.saves, { fort: 5, ref: 5, will: 1 });
  assert.equal(s.cmb, 2);
  assert.equal(s.cmd, 14);
  assert.equal(s.attacks[0].text, 'bite +2 (1d6+1 plus trip)', 'only attack: 1.5 x Str 1');
});

test('wolf at druid 7 advances to Large', () => {
  const s = computeCompanion(animal('Wolf'), { Druid: 7 }, data);
  assert.equal(s.size, 'Large');
  assert.deepEqual([s.abilities.str, s.abilities.dex, s.abilities.con], [23, 15, 19], '13+8+2, 15-2+2, 15+4');
  assert.equal(s.natural, 8, '2 species + 2 advancement + 4 table');
  assert.deepEqual([s.ac.total, s.ac.touch, s.ac.flat], [19, 11, 17], 'Large -1');
  assert.equal(s.hp, 27 + 24, '6d8 average + Con 4 x 6');
  assert.deepEqual(s.saves, { fort: 9, ref: 7, will: 3 });
  assert.equal(s.cmb, 4 + 6 + 1);
  assert.equal(s.cmd, 10 + 4 + 6 + 2 + 1);
  assert.equal(s.attacks[0].text, 'bite +9 (1d8+9 plus trip)');
  assert.ok(s.specials.includes('Evasion') && s.specials.includes('Devotion'));
  assert.equal(s.increases, 1, 'one ability score increase by 7th level');
});

test('ability score increase choices and feats apply', () => {
  const s = computeCompanion(animal('Wolf', { increases: ['str'], feats: [{ name: 'Toughness' }, { name: 'Improved Natural Armor' }] }), { Druid: 4 }, data);
  assert.equal(s.abilities.str, 13 + 1 + 1, 'Str/Dex +1 at 4th, +1 increase');
  assert.equal(s.natural, 2 + 2 + 1);
  assert.equal(s.hp, 18 + 2 * 4 + 4, '4d8 avg 18, Con 2 x 4, Toughness +4 (HD 4)');
});

test('horse: secondary hooves at -5 with half Strength', () => {
  const s = computeCompanion(animal('Horse'), { Druid: 1 }, data);
  assert.equal(s.size, 'Large');
  const bite = s.attacks.find(a => a.name === 'bite'), hooves = s.attacks.find(a => a.name === 'hoof');
  assert.equal(bite.text, 'bite +3 (1d4+3)', 'BAB 1 + Str 3 - 1 size; not its only attack, so 1 x Str');
  assert.equal(hooves.text, '2 hooves -2 (1d6+1)', '1 + 3 - 1 - 5; ½ Str');
});

test('biped eidolon at summoner 1', () => {
  const s = computeCompanion(eidolon('Biped'), { Summoner: 1 }, data);
  assert.equal(s.hp, 5 + 1, '1d10 average 5.5 rounds down, Con +1');
  assert.deepEqual(s.saves, { fort: 3, ref: 1, will: 2 }, 'good Fort and Will');
  assert.equal(s.ac.total, 10 + 2 + 1);
  assert.equal(s.pool, 3);
  assert.equal(s.attacks[0].text, '2 claws +4 (1d4+3)');
});

test('evolutions: points, attacks, natural armor and ability increase', () => {
  const comp = eidolon('Biped', { evolutions: [{ name: 'Bite' }, { name: 'Improved Natural Armor' }, { name: 'Ability Increase', choice: 'str' }] });
  const s = computeCompanion(comp, { Summoner: 1 }, data);
  assert.equal(s.spent, 1 + 1 + 2);
  assert.equal(s.ac.total, 10 + 4 + 1);
  assert.equal(s.abilities.str, 18);
  assert.deepEqual(s.attacks.map(a => a.text), ['2 claws +5 (1d4+4)', 'bite +5 (1d6+4)']);
  assert.equal(s.attackCount, 3);
});

test('large evolution steps damage dice up', () => {
  assert.equal(stepDice('1d4', 1), '1d6');
  assert.equal(stepDice('1d8', 1), '2d6');
  assert.equal(stepDice('1d6', -1), '1d4');
  const s = computeCompanion(eidolon('Biped', { evolutions: [{ name: 'Large' }] }), { Summoner: 8 }, data);
  assert.equal(s.size, 'Large');
  assert.equal(s.attacks[0].dice, '1d6', 'claws 1d4 -> 1d6');
  assert.equal(s.abilities.str, 16 + 3 + 8);
});
