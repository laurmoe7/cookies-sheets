import test from 'node:test';
import assert from 'node:assert/strict';
import { classResources, currentOf, poolChanges } from '../web/js/resources.js';

const mods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...{} };
const byId = (levels, m = {}) => Object.fromEntries(classResources(levels, { ...mods, ...m }).map(r => [r.id, r]));

test('arcane reservoir: capacity 3 + level, starts the day at 3 + half level', () => {
  const r = byId({ Arcanist: 5 })['arcane-reservoir'];
  assert.equal(r.max, 8, '3 + 5 = 8');
  assert.equal(r.start, 5, '3 + floor(5/2) = 5');
});
test('arcane pool: half level + Int, never below 1', () => {
  assert.equal(byId({ Magus: 6 }, { int: 3 })['arcane-pool'].max, 6, '3 + 3');
  assert.equal(byId({ Magus: 1 }, { int: -1 })['arcane-pool'].max, 1, '0 - 1 -> minimum 1');
});
test('rage rounds: 4 + Con + 2 per level after 1st', () => {
  assert.equal(byId({ Barbarian: 3 }, { con: 2 }).rage.max, 10, '4 + 2 + 2*2 = 10');
});
test('ki pool needs monk level 4; ninja level 2', () => {
  assert.equal(byId({ Monk: 3 }, { wis: 2 })['ki-monk'], undefined);
  assert.equal(byId({ Monk: 4 }, { wis: 2 })['ki-monk'].max, 4, '2 + 2');
  assert.equal(byId({ Ninja: 2 }, { cha: 1 })['ki-ninja'].max, 2, '1 + 1');
});
test('bardic performance and lay on hands', () => {
  assert.equal(byId({ Bard: 1 }, { cha: 3 }).bardic.max, 7, '4 + 3');
  assert.equal(byId({ Paladin: 2 }, { cha: 0 })['lay-on-hands'].max, 1, 'floor(2/2) + 0 = 1');
  assert.equal(byId({ Paladin: 2 }, { cha: -1 })['lay-on-hands'].max, 1, '1 - 1 = 0 -> minimum 1');
  assert.equal(byId({ Paladin: 6 }, { cha: 2 })['lay-on-hands'].max, 5, 'floor(6/2) + 2 = 5');
  assert.equal(byId({ Paladin: 1 }, { cha: 3 })['lay-on-hands'], undefined, 'lay on hands is a 2nd-level feature');
});
test('poolChanges: new pools and changed capacity, unchanged ones left out', () => {
  const m = { ...mods, cha: 2 };
  const ch = Object.fromEntries(poolChanges(classResources({ Paladin: 1 }, m), classResources({ Paladin: 2 }, m)).map(r => [r.id, r]));
  assert.deepEqual(ch['lay-on-hands'], { id: 'lay-on-hands', name: 'Lay on hands', cls: 'Paladin', from: 0, to: 3, isNew: true }, 'new at 2nd: 1 + 2 = 3');
  assert.equal(ch['smite-evil'], undefined, 'smite stays 1/day from 1st to 2nd');
  const at4 = Object.fromEntries(poolChanges(classResources({ Paladin: 3 }, m), classResources({ Paladin: 4 }, m)).map(r => [r.id, r]));
  assert.deepEqual([at4['smite-evil'].from, at4['smite-evil'].to], [1, 2], 'smite evil 2/day at 4th');
  assert.deepEqual([at4['lay-on-hands'].from, at4['lay-on-hands'].to], [3, 4], 'floor(3/2)+2 = 3 -> floor(4/2)+2 = 4');
});
test('classes with no pool give none; stored value wins over the daily start', () => {
  assert.equal(classResources({ Fighter: 5 }, mods).length, 0);
  const r = byId({ Arcanist: 5 })['arcane-reservoir'];
  assert.equal(currentOf(r, {}), 5);
  assert.equal(currentOf(r, { 'arcane-reservoir': 2 }), 2);
  assert.equal(currentOf(r, { 'arcane-reservoir': -3 }), 0);
});

test('your own extra capacity (Extra Rage, Extra Reservoir) adds to the maximum and to the start of the day', () => {
  const lv = { Barbarian: 3, Arcanist: 5 }, m = { ...mods, con: 2 };
  const base = Object.fromEntries(classResources(lv, m).map(r => [r.id, r]));
  assert.equal(base.rage.max, 10, '4 + 2 + 2*2 = 10, unchanged without an adjustment');
  const adj = Object.fromEntries(classResources(lv, m, { rage: { max: 6 } }).map(r => [r.id, r]));
  assert.equal(adj.rage.max, 16, '10 + 6 extra rounds');
  assert.equal(adj.rage.start, 16, 'a blank start means the same extra at the start of the day: 10 + 6');
  assert.equal(adj.rage.baseMax, 10);
  const res = Object.fromEntries(classResources(lv, m, { 'arcane-reservoir': { max: 3, start: 1 } }).map(r => [r.id, r]));
  assert.equal(res['arcane-reservoir'].max, 11, '3 + 5 = 8, plus 3 capacity');
  assert.equal(res['arcane-reservoir'].start, 6, 'starts the day at 3 + floor(5/2) = 5, plus 1');
  assert.equal(adj['arcane-reservoir'].max, 8, 'other pools are untouched');
  const low = classResources({ Barbarian: 1 }, mods, { rage: { max: -10 } })[0];
  assert.deepEqual([low.max, low.start], [0, 0], 'never below zero');
  const capped = classResources({ Barbarian: 1 }, mods, { rage: { max: 0, start: 20 } })[0];
  assert.equal(capped.start, 4, 'the start cannot be more than the capacity');
  assert.equal(currentOf(adj.rage, {}), 16, 'a fresh day starts full');
});
