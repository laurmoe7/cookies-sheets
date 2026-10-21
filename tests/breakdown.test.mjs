import test from 'node:test';
import assert from 'node:assert/strict';
import { make, calc, buff, repeat } from './helpers.mjs';
import { stackParts } from '../web/js/calc.js';

const sum = parts => (parts || []).reduce((n, p) => n + p.value, 0);

function sample() {
  const c = make({
    race: 'Human', raceChoice: 'str', base: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, levels: repeat('Fighter', 6),
    weapons: [{ name: 'Longsword', ability: '', ranged: false, enh: 1, misc: 1, damage: '1d8', dmgMult: '', dmgMisc: 2, crit: '19-20/x2', range: '', type: 'S', weight: 4 }],
    skills: [{ name: 'Climb', sub: '', ranks: 3, misc: 1, classSkill: false }],
    saveMisc: { fort: 1, ref: 0, will: 0 }, initMisc: 2,
  });
  buff(c, 'Bless'); buff(c, 'Haste'); buff(c, 'Power Attack');
  return c;
}

test('every roll\'s hover text adds up to the number that is rolled', () => {
  const d = calc(sample());
  for (const s of ['fort', 'ref', 'will']) assert.equal(sum(d.bd[`saves.${s}.total`]), d.saves[s].total, s + ' save');
  assert.equal(sum(d.bd.init), d.init, 'initiative');
  assert.equal(sum(d.bd.melee), d.melee, 'melee');
  assert.equal(sum(d.bd.ranged), d.ranged, 'ranged');
  assert.equal(sum(d.bd.cmb), d.cmb, 'cmb');
  assert.equal(sum(d.bd['weapons.0.attack']), d.weapons[0].attack, 'weapon attack');
  assert.equal(sum(d.bd['weapons.0.damage']), d.weapons[0].dmgBonus, 'weapon damage bonus');
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) assert.equal(sum(d.bd[`abilities.${a}.mod`]), d.abilities[a].mod, a);
  for (const [key, s] of Object.entries(d.skills)) assert.equal(sum(d.bd[`skills.${key}.total`]), s.total, key);
});

test('numbers that are not rolled (AC, CMD, HP, scores, speed, BAB) add up too', () => {
  const c = sample();
  c.armor = [{ name: 'Chain shirt', type: 'armor', bonus: 4, enh: 1, maxDex: 4, acp: -2, equipped: true }];
  Object.assign(c.ac, { natural: 1, deflection: 2 });
  c.abilities.str.enh = 2; c.abilities.con.drain = 1;
  buff(c, 'Rage');
  const d = calc(c);
  for (const k of ['total', 'touch', 'flat']) assert.equal(10 + sum(d.bd[`ac.${k}`]), d.ac[k], 'AC ' + k);
  assert.equal(10 + sum(d.bd.cmd), d.cmd, 'CMD');
  assert.equal(10 + sum(d.bd.cmdFlat), d.cmdFlat, 'flat-footed CMD');
  assert.equal(sum(d.bd['hp.max']), d.hp.max, 'max HP');
  assert.equal(sum(d.bd.speed), d.speed, 'speed');
  assert.equal(sum(d.bd.bab), d.bab, 'BAB');
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) assert.equal(sum(d.bd[`abilities.${a}.score`]), d.abilities[a].score, a + ' score');
  assert.ok(d.bd['ac.total'].some(p => p.label === 'Chain shirt (armor)' && p.value === 5), 'the armor is named');
  assert.ok(!d.bd['ac.touch'].some(p => /armor/.test(p.label)), 'touch AC leaves out armor and natural armor');
  assert.ok(!d.bd['ac.flat'].some(p => /Dex|dodge/.test(p.label)), 'flat-footed loses the Dex and dodge bonuses (Haste)');
});

test('buffs show up by name and type, as the source of a + or -', () => {
  const d = calc(sample());
  const labels = d.bd['weapons.0.attack'].map(p => p.label);
  assert.ok(labels.includes('Bless (morale)'), labels.join(' | '));
  assert.ok(labels.some(l => l.startsWith('Power Attack')), 'a penalty is shown too');
  assert.equal(d.bd['weapons.0.attack'].find(p => p.label === 'Power Attack').value, -2, 'Power Attack at BAB 6 is -2 (1 + floor(6/4))');
  assert.ok(d.bd['saves.ref.total'].some(p => p.label.startsWith('Haste')), 'Haste adds a dodge bonus to Reflex');
});

test('bonuses that do not stack add nothing; the one that counts is kept, the other is listed as ignored', () => {
  const parts = stackParts([
    { value: 2, type: 'morale', source: 'Bless' }, { value: 3, type: 'morale', source: 'Heroism' },
    { value: 1, type: 'dodge', source: 'Haste' }, { value: 1, type: 'dodge', source: 'Dodge feat' },
    { value: -2, type: 'morale', source: 'Shaken' },
  ]);
  assert.deepEqual(parts.filter(p => !p.ignored).map(p => [p.label, p.value]), [['Heroism (morale)', 3], ['Shaken (morale)', -2], ['Haste (dodge)', 1], ['Dodge feat (dodge)', 1]], 'morale: highest bonus + the penalty; dodge stacks');
  assert.deepEqual(parts.filter(p => p.ignored).map(p => [p.label, p.value, p.was]), [['Bless (morale)', 0, 2]], 'Bless is listed, worth 0, remembering its +2');
});

test('spell numbers have a breakdown too', () => {
  const c = make({ race: 'Human', base: { int: 18 }, levels: repeat('Wizard', 7) });
  const d = calc(c);
  assert.equal(sum(d.bd['spellcasting.Wizard.concentration']), d.spellcasting.Wizard.concentration);
  assert.equal(sum(d.bd['spellcasting.Wizard.cl']), d.spellcasting.Wizard.cl);
});
