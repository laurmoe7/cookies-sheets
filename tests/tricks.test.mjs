// Animal tricks: reading the companion's trick text, the limit, and general-purpose training (Core Rulebook, Handle Animal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTricks, tricksText, tricksUsed, trickLimit, toggleTrick, addPurpose, purposesMet, missingNeeds, trickDef, take10, TRICKS } from '../web/js/tricks.js';

test('old trick text typed by hand still reads', () => {
  const l = parseTricks('attack, come; Defend\nheel, fly to the moon');
  assert.deepEqual(l.map(t => t.name), ['Attack', 'Come', 'Defend', 'Heel', 'fly to the moon']);
  assert.equal(l[4].def, null, 'a trick the list lacks is kept as written');
  assert.equal(tricksText(l), 'Attack, Come, Defend, Heel, fly to the moon');
  assert.deepEqual(parseTricks(''), []);
});

test('attack any creature counts as two tricks and replaces Attack', () => {
  for (const s of ['attack (any)', 'Attack (any creature)', 'attack all', 'attack any target']) assert.equal(parseTricks(s)[0].name, 'Attack (any creature)', s);
  let l = parseTricks('attack, come');
  assert.equal(tricksUsed(l), 2);
  l = toggleTrick(l, 'Attack (any creature)');
  assert.deepEqual(l.map(t => t.name), ['Come', 'Attack (any creature)']);
  assert.equal(tricksUsed(l), 3, 'come 1 + attack any creature 2');
  assert.equal(toggleTrick(l, 'Attack'), l, 'plain Attack is already part of it');
});

test('limit: 3 per point of Int plus the bonus tricks', () => {
  assert.equal(trickLimit(1), 3, 'Int 1: three tricks');
  assert.equal(trickLimit(2, 1), 7, 'Int 2: six, plus 1 bonus trick');
  assert.equal(trickLimit(2, 7), 13, 'level 20 companion: 6 + 7');
  assert.equal(trickLimit(null, 2), 2);
});

test('repeatable tricks keep their choice', () => {
  let l = parseTricks('attack, maneuver (trip)');
  assert.equal(l[1].name, 'Maneuver');
  assert.equal(l[1].choice, 'trip');
  l = toggleTrick(l, 'Maneuver', 'disarm');
  assert.equal(tricksText(l), 'Attack, Maneuver (trip), Maneuver (disarm)');
  assert.equal(tricksUsed(l), 3);
  l = toggleTrick(l, 'Maneuver', 'trip');
  assert.equal(tricksText(l), 'Attack, Maneuver (disarm)');
});

test('needs: Flank needs Attack, Rescue needs Deliver and Guard', () => {
  assert.deepEqual(missingNeeds(parseTricks('flank'), trickDef('Flank')), ['Attack']);
  assert.deepEqual(missingNeeds(parseTricks('attack (any), flank'), trickDef('Flank')), [], 'attack any creature covers Attack');
  assert.deepEqual(missingNeeds(parseTricks('guard'), trickDef('Rescue')), ['Deliver']);
});

test('general purposes add the tricks the animal lacks', () => {
  const l = addPurpose(parseTricks('come, stay'), 'Combat training');
  assert.deepEqual(l.map(t => t.name), ['Come', 'Stay', 'Attack', 'Defend', 'Down', 'Guard', 'Heel'], 'combat training: attack, come, defend, down, guard, heel');
  assert.ok(purposesMet(l).includes('Riding'), 'come, heel, stay');
  assert.ok(purposesMet(l).includes('Fighting'), 'attack, down, stay');
  assert.ok(!purposesMet(l).includes('Hunting'));
});

test('take 10: bonus + 10 meets the DC', () => {
  assert.equal(take10(5, 15), true, '5 + 10 = 15');
  assert.equal(take10(9, 20), false, '9 + 10 = 19');
  assert.equal(take10(null, 15), false);
});

test('the Core Rulebook tricks and DCs', () => {
  const core = Object.fromEntries(TRICKS.filter(t => t.source === 'Core Rulebook').map(t => [t.name, t.dc]));
  assert.deepEqual(core, { Attack: 20, 'Attack (any creature)': 20, Come: 15, Defend: 20, Down: 15, Fetch: 15, Guard: 20, Heel: 15, Perform: 15, Seek: 15, Stay: 15, Track: 20, Work: 15 });
  assert.equal(new Set(TRICKS.map(t => t.name)).size, TRICKS.length, 'no trick twice');
});
