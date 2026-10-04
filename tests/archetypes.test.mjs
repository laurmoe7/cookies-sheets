// Archetypes applied to class features, class skills and spellcasting.
// The fixture holds real archetypes as parsed by tools/archetypes.py from the compendium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuresFor, archetypeConflicts, featureBase, featureNumbered, archetypesOf, bakeArchetype } from '../web/js/features.js';
import { classSkillSet } from '../web/js/calc.js';
import { migrate } from '../web/js/model.js';
import { classesByName, make, calc, fixture, repeat } from './helpers.mjs';

const A = fixture('archetypes.json');
const arch = (cls, name) => bakeArchetype(A[cls].find(a => a.name === name));
const names = list => list.map(f => `${f.level}:${f.name}`);

test('feature names normalise for matching', () => {
  assert.equal(featureBase('Trap sense +1'), 'trap sense');
  assert.equal(featureBase('Damage reduction 1/—'), 'damage reduction');
  assert.equal(featureBase('2nd favored enemy'), 'favored enemy');
  assert.equal(featureBase('Channel energy 1d6'), 'channel energy');
  assert.equal(featureBase('Tongue of the sun and moon'), 'tongue of sun and moon');
  assert.equal(featureNumbered('Armor training 1'), 'armor training 1');
  assert.equal(featureNumbered('Poison resistance +4'), 'poison resistance 4');
});

test('acrobat rogue: trapfinding and every trap sense are replaced, the rest stays', () => {
  const f = featuresFor('Rogue', 6, [arch('Rogue', 'Acrobat')], classesByName.Rogue);
  const n = names(f);
  assert.ok(!n.some(x => /trapfinding|trap sense/i.test(x)), n.join(', '));
  assert.ok(n.includes('1:Expert Acrobat') && n.includes('3:Second Chance'));
  assert.ok(n.some(x => /^1:Sneak attack/i.test(x)) && n.some(x => /^2:Evasion/i.test(x)));
  assert.deepEqual(f.find(x => x.name === 'Second Chance').replaces, ['trap sense']);
  assert.ok(!f.some(x => x.advice || x.name === 'Rogue Talents'), 'advice lists are not features');
});

test('two-handed fighter: numbered armor training is replaced one level at a time', () => {
  const f = names(featuresFor('Fighter', 7, [arch('Fighter', 'Two-Handed Fighter')], classesByName.Fighter));
  assert.ok(f.includes('2:Shattering Strike') && !f.some(x => /bravery/i.test(x)));
  assert.ok(f.includes('3:Overhand Chop') && f.includes('7:Backswing'));
  assert.ok(!f.some(x => /armor training/i.test(x)), f.join(', '));
  assert.ok(f.some(x => /^5:Weapon training 1/i.test(x)), 'weapon training is modified, not replaced');
  assert.ok(!f.includes('11:Piledriver'), 'nothing above the class level');
});

test('invulnerable rager: one feature replaces several, at the right levels', () => {
  const f = featuresFor('Barbarian', 7, [arch('Barbarian', 'Invulnerable Rager')], classesByName.Barbarian);
  const inv = f.find(x => x.name === 'Invulnerability');
  assert.equal(inv.level, 2);
  assert.deepEqual(inv.replaces, ['uncanny dodge', 'improved uncanny dodge', 'damage reduction']);
  assert.ok(!f.some(x => x.kind === 'class' && /uncanny dodge|damage reduction/i.test(x.name)));
});

test('archetypes that replace the same feature cannot be combined', () => {
  const clash = archetypeConflicts([arch('Fighter', 'Two-Handed Fighter'), arch('Fighter', 'Archer')], classesByName.Fighter);
  assert.ok(clash.some(x => /bravery/i.test(x.feature)));
  assert.ok(clash.some(x => /armor training/i.test(x.feature)));
  assert.deepEqual(archetypeConflicts([arch('Rogue', 'Acrobat')], classesByName.Rogue), []);
});

test('class-skill changes: urban ranger swaps nature skills for city ones', () => {
  const c = make({ levels: ['Ranger'], archetypes: { Ranger: [arch('Ranger', 'Urban Ranger')] } });
  const cs = classSkillSet(c, classesByName);
  assert.ok(cs.has('Disable Device') && cs.has('Knowledge (local)'));
  assert.ok(!cs.has('Handle Animal') && !cs.has('Knowledge (nature)'));
  assert.ok(cs.has('Survival'), 'untouched ranger skills stay');
  c.levelUps.push(...make({ levels: ['Druid'] }).levelUps);
  assert.ok(classSkillSet(c, classesByName).has('Handle Animal'), 'another class can still grant a removed skill');
});

test('diminished spellcasting (kensai): one fewer spell per day, bonus spells still apply', () => {
  const base = { raceChoice: 'int', base: { int: 14 }, levels: repeat('Magus', 4) };
  const normal = calc(make(base)).spellcasting.Magus;
  const kensai = calc(make({ ...base, archetypes: { Magus: [arch('Magus', 'Kensai')] } })).spellcasting.Magus;
  assert.equal(normal.slots[1], 3 + 1, 'magus 4: 3 per day + 1 bonus (Int 16)');
  assert.equal(kensai.slots[1], 2 + 1);
  assert.equal(normal.slots[2], 1 + 1);
  assert.equal(kensai.slots[2], 0 + 1, 'reduced to 0, so only the bonus spell');
  assert.equal(kensai.slots[0], normal.slots[0], 'cantrips are not reduced');
});

test('old free-text archetypes are kept as names', () => {
  const c = migrate({ ...make(), archetypes: { Rogue: 'Acrobat, Scout' } });
  assert.deepEqual(archetypesOf(c, 'Rogue'), [{ name: 'Acrobat' }, { name: 'Scout' }]);
  assert.deepEqual(archetypesOf({ archetypes: { Rogue: 'Acrobat' } }, 'Rogue'), [{ name: 'Acrobat' }]);
});
