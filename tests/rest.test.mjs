import test from 'node:test';
import assert from 'node:assert/strict';
import { fullRest } from '../web/js/rest.js';
import { classResources } from '../web/js/resources.js';
import { newCharacter } from '../web/js/model.js';

const zero = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
const byId = (levels, m = {}) => Object.fromEntries(classResources(levels, { ...zero, ...m }).map(r => [r.id, r]));

test('rest heals 1 HP per level, and stops at the maximum', () => {
  const c = newCharacter(); c.hp.current = 10;
  assert.deepEqual(fullRest(c, { maxHp: 40, level: 5 }), ['5 hit points back']);
  assert.equal(c.hp.current, 15, '10 + 5');
  c.hp.current = 38; fullRest(c, { maxHp: 40, level: 5 });
  assert.equal(c.hp.current, null, '38 + 5 is capped at 40, which is stored as "full"');
});
test('rest clears nonlethal and takes 1 off each ability damage (never below 0), leaving drain', () => {
  const c = newCharacter(); c.hp.nonlethal = 6; c.abilities.str.damage = 3; c.abilities.dex.damage = 0; c.abilities.con.drain = 2;
  fullRest(c, { maxHp: 10, level: 1 });
  assert.equal(c.hp.nonlethal, 0);
  assert.equal(c.abilities.str.damage, 2);
  assert.equal(c.abilities.dex.damage, 0);
  assert.equal(c.abilities.con.drain, 2, 'drain does not heal by resting');
});
test('rest refills pools, trackers and slots, and prepares cast spells again', () => {
  const c = newCharacter();
  c.resources = { rage: 1 }; c.trackers = [{ name: 'x', max: 3, cur: 0 }];
  c.spellbooks = { Wizard: { used: [0, 2, 1], spells: [{ name: 'a', prepared: 1, cast: 2 }] } };
  fullRest(c, { maxHp: 10, level: 1 });
  assert.deepEqual(c.resources, {});
  assert.equal(c.trackers[0].cur, 3);
  assert.equal(c.spellbooks.Wizard.used.every(n => n === 0), true);
  assert.equal(c.spellbooks.Wizard.spells[0].prepared, 3, '1 left + 2 cast');
  assert.equal(c.spellbooks.Wizard.spells[0].cast, 0);
});
test('smite, challenge: 1 per day, +1 at 4th and every 3 levels after', () => {
  assert.equal(byId({ Paladin: 1 })['smite-evil'].max, 1);
  assert.equal(byId({ Paladin: 4 })['smite-evil'].max, 2, '4th level');
  assert.equal(byId({ Paladin: 6 })['smite-evil'].max, 2);
  assert.equal(byId({ Paladin: 7 })['smite-evil'].max, 3, '7th level');
  assert.equal(byId({ Cavalier: 10 }).challenge.max, 4, '1, 4th, 7th, 10th');
  assert.equal(byId({ Antipaladin: 13 })['smite-good'].max, 5);
});
test('wild shape starts at 4th level and gains one use at each even level, up to 8', () => {
  assert.equal(byId({ Druid: 3 })['wild-shape'], undefined);
  assert.equal(byId({ Druid: 4 })['wild-shape'].max, 1);
  assert.equal(byId({ Druid: 8 })['wild-shape'].max, 3, '4th 1, 6th 2, 8th 3');
  assert.equal(byId({ Druid: 18 })['wild-shape'].max, 8);
});
test('martial flexibility is half the brawler level, at least 1', () => {
  assert.equal(byId({ Brawler: 1 })['martial-flexibility'].max, 1);
  assert.equal(byId({ Brawler: 9 })['martial-flexibility'].max, 4, 'floor(9/2)');
});

test('rest gives the uses of spell-like abilities back', () => {
  const c = { hp: {}, abilities: {}, resources: {}, trackers: [], spellbooks: {}, spellLikes: [{ name: 'Dimension Door', perDay: 3, used: 2 }, { name: 'Light', perDay: '', used: 0 }] };
  const said = fullRest(c, { maxHp: 10, level: 5 });
  assert.equal(c.spellLikes[0].used, 0);
  assert.ok(said.includes('spell slots reset'));
});
