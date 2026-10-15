// A companion from the creature list: numbers read from a stat block. The expected values are the Bestiary's Owlbear, worked out from its stat block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitTop, parseAttacks, parseSkills, firstNum, computeCreature, newCreatureCompanion } from '../web/js/creaturecomp.js';
import { rootPath } from './helpers.mjs';

const all = JSON.parse(readFileSync(rootPath + 'data/creatures.json', 'utf-8'));
const owlbear = all.find(c => c.name === 'Owlbear' && c.source === 'Bestiary');

test('splitting ignores separators inside brackets', () => {
  assert.deepEqual(splitTop('bite +5 (1d6, plus grab), 2 claws +3 (1d4)', [', ']), ['bite +5 (1d6, plus grab)', '2 claws +3 (1d4)']);
  assert.equal(firstNum('+10 (+14 grapple)'), 10);
  assert.equal(firstNum('−2'), -2);
  assert.equal(firstNum('—'), null);
});

test('attacks: counts, magic weapons, extras, alternatives', () => {
  assert.deepEqual(parseAttacks('2 claws +8 (1d6+4 plus grab), bite +8 (1d6+4)').map(a => [a.count, a.name, a.bonus, a.damage, a.extra]),
    [[2, 'claws', 8, '1d6+4', 'plus grab'], [1, 'bite', 8, '1d6+4', '']]);
  const sword = parseAttacks('+1 longsword +12/+7 (1d8+5/19-20)')[0];
  assert.deepEqual([sword.name, sword.bonus, sword.damage, sword.extra], ['+1 longsword', 12, '1d8+5', '/19-20']);
  assert.equal(parseAttacks('bite +10 (2d6+4 plus poison) or claw +8 (1d4)').length, 2);
  assert.deepEqual(parseAttacks('swarm'), [], 'text without a bonus is not an attack row');
  assert.deepEqual(parseSkills('Perception +12, Stealth +4 (+8 in rocky terrain), Knowledge (arcana) +5'), [{ name: 'Perception', total: 12 }, { name: 'Stealth', total: 4 }, { name: 'Knowledge (arcana)', total: 5 }]);
});

test('Owlbear: the numbers come straight from the stat block', () => {
  const s = computeCreature(newCreatureCompanion(owlbear));
  assert.equal(s.size, 'Large');
  assert.deepEqual([s.hp, s.hd], [47, 5], '47 (5d10+20)');
  assert.deepEqual([s.ac.total, s.ac.touch, s.ac.flat, s.ac.natural], [15, 10, 14, 5], '15, touch 10, flat-footed 14 (+1 Dex, +5 natural, -1 size)');
  assert.deepEqual(s.saves, { fort: 10, ref: 5, will: 2 });
  assert.deepEqual([s.init, s.bab, s.cmb, s.cmd], [5, 5, 10, 21]);
  assert.deepEqual(s.abilities, { str: 19, dex: 12, con: 18, int: 2, wis: 12, cha: 10 });
  assert.deepEqual([s.mods.str, s.mods.con], [4, 4], 'Str 19 and Con 18');
  assert.deepEqual(s.attacks.map(a => [a.count, a.name, a.bonus, a.damage]), [[2, 'claws', 8, '1d6+4'], [1, 'bite', 8, '1d6+4']]);
  assert.equal(s.attackCount, 3);
  assert.equal(s.skills.find(k => k.name === 'Perception').total, 12);
});

test('adjustments are added on top of the stat block', () => {
  const comp = { ...newCreatureCompanion(owlbear), hpMisc: 3, acMisc: 2, attackMisc: 1 };
  const s = computeCreature(comp);
  assert.deepEqual([s.hp, s.ac.total, s.ac.touch, s.ac.flat], [50, 17, 10, 16], 'hp +3, AC +2 (not touch), flat-footed +2');
  assert.equal(s.attacks[0].bonus, 9, 'attack +8 +1');
  assert.equal(s.attacks[0].parts.reduce((n, p) => n + p.value, 0), 9);
});

test('every creature in the list can be turned into a companion', () => {
  assert.ok(all.length > 1500);
  let withAttacks = 0;
  for (const b of all) {
    const s = computeCreature(newCreatureCompanion(b));
    assert.ok(s.hp >= 1 && s.ac.total > 0, b.name);
    if (s.attacks.length) withAttacks++;
  }
  assert.ok(withAttacks / all.length > 0.85, `${withAttacks} of ${all.length} have attack rows`);
});
