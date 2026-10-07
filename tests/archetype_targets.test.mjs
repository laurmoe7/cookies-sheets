// Archetype "replaces X" targets that name a feature differently from the class table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFeatures, findTargets, isNoise } from '../web/js/features.js';
import { classesByName } from './helpers.mjs';

const hits = (cls, name, levels = []) => findTargets(baseFeatures(classesByName[cls], 20), { name, text: name, parts: [], levels }, cls).map(h => `${h.level}:${h.name}`);

test('class-name prefixes and filler words are ignored', () => {
  assert.deepEqual(hits('Alchemist', 'alchemist bomb'), ['1:Bomb 1d6'], 'the 1st-level bomb');
  assert.deepEqual(hits('Alchemist', 'mutagen class'), ['1:Mutagen']);
});
test('weapon and armor proficiency is a replaceable level-1 feature for every class', () => {
  assert.deepEqual(hits('Fighter', "fighter's weapon and armor proficiency"), ['1:Weapon and Armor Proficiency']);
  assert.deepEqual(hits('Slayer', "slayer's weapon and armor proficiency"), ['1:Weapon and Armor Proficiency']);
});
test('ordinal favored enemies land on the right level', () => {
  assert.deepEqual(hits('Ranger', "ranger's second favored enemy"), ['5:2nd favored enemy']);
  assert.deepEqual(hits('Ranger', 'third'), ['10:3rd favored enemy']);
});
test('oracle bonus spells map to the mystery spells', () => {
  const h = hits('Oracle', "oracle's mystery bonus spells at these");
  assert.equal(h.length, 9, 'mystery spells at levels 2, 4, 6, 8, 10, 12, 14, 16 and 18');
});
test('sentence fragments are noise, real feature names are not', () => {
  assert.ok(isNoise('except that the new holy symbol retains its abilities while gaining the benefits'));
  assert.ok(isNoise('additional class skills from her mystery'));
  assert.ok(!isNoise('trapfinding'));
});
