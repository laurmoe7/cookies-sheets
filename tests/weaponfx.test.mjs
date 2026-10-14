import test from 'node:test';
import assert from 'node:assert/strict';
import { make, calc, buff, repeat } from './helpers.mjs';
import { parseCrit, doubleThreat, multiplyDice, critLabel, weaponFx } from '../web/js/weaponfx.js';

// Fighter 4: BAB +4. Human +2 Str on 14 = Str 16, +3.
const sword = (extra = {}) => ({ name: 'Longsword', ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgMult: '', dmgMisc: 0, crit: '19-20/x2', range: '', type: 'S', weight: 4, ...extra });
const hero = (w, levels = 4) => make({ base: { str: 14 }, levels: repeat('Fighter', levels), weapons: [w] });
const sumOf = list => list.reduce((s, p) => s + p.value, 0);

test('crit text is read in every common spelling', () => {
  assert.deepEqual(parseCrit('19-20/x2'), { min: 19, mult: 2 });
  assert.deepEqual(parseCrit('×3'), { min: 20, mult: 3 });
  assert.deepEqual(parseCrit('18–20/×2'), { min: 18, mult: 2 }, 'an en dash');
  assert.deepEqual(parseCrit('20/x3'), { min: 20, mult: 3 });
  assert.equal(parseCrit(''), null);
  assert.equal(parseCrit('—'), null);
});
test('keen doubles the threat range: 20 -> 19-20, 19-20 -> 17-20, 18-20 -> 15-20', () => {
  assert.equal(doubleThreat(20), 19);
  assert.equal(doubleThreat(19), 17, '2 numbers become 4');
  assert.equal(doubleThreat(18), 15, '3 numbers become 6');
  assert.equal(critLabel({ min: 17, mult: 2 }), '17-20/×2');
});
test('multiplyDice multiplies dice counts and flat numbers', () => {
  assert.equal(multiplyDice('1d8', 2), '2d8');
  assert.equal(multiplyDice('2d6+3', 3), '6d6+9');
  assert.equal(multiplyDice('—', 2), '', 'not dice');
});

test('+1 flaming keen longsword: attack, damage with the fire die, and the keen critical', () => {
  const d = calc(hero(sword({ enh: 1, fx: [{ id: 'flaming' }, { id: 'keen' }] }))).weapons[0];
  assert.equal(d.attackText, '+8', 'BAB 4 + Str 3 + enhancement 1');
  assert.equal(d.damageText, '1d8+4+1d6', 'Str 3 + enhancement 1, then the flaming die');
  assert.equal(d.crit, '17-20/×2', 'keen doubles 19-20');
  assert.equal(d.critText, '2d8+8+1d6', 'the 1d8 and the +4 are doubled; the flaming die is not');
});
test('a burst weapon adds its extra dice on a critical hit: 1d10 per step above x1 (x3 = 2d10)', () => {
  const d = calc(hero(sword({ name: 'Axe', enh: 2, crit: '×3', fx: [{ id: 'flamingburst' }] }))).weapons[0];
  assert.equal(d.damageText, '1d8+5+1d6', 'Str 3 + 2');
  assert.equal(d.critText, '3d8+15+1d6+2d10', 'x3 on 1d8 and 5; flaming 1d6 once; burst 2d10');
});
test('masterwork gives +1 to hit only when there is no enhancement bonus', () => {
  assert.equal(calc(hero(sword({ mw: true }))).weapons[0].attack, 8, '4 + 3 + 1');
  assert.equal(calc(hero(sword({ mw: true, enh: 1 }))).weapons[0].attack, 8, '4 + 3 + enhancement 1, masterwork adds nothing more');
  assert.equal(calc(hero(sword({ material: 'adamantine' }))).weapons[0].attack, 8, 'adamantine is masterwork');
  assert.equal(calc(hero(sword({ material: 'coldiron' }))).weapons[0].attack, 7, 'cold iron is not');
});
test('bane only counts while its switch is on: +2 attack, +2 damage and 2d6', () => {
  const off = calc(hero(sword({ enh: 1, fx: [{ id: 'bane', on: false }] }))).weapons[0];
  const on = calc(hero(sword({ enh: 1, fx: [{ id: 'bane', on: true }] }))).weapons[0];
  assert.equal(off.attack, 8, '4 + 3 + 1');
  assert.equal(off.damageText, '1d8+4');
  assert.equal(on.attack, 10, '8 + 2');
  assert.equal(on.damageText, '1d8+6+2d6', 'Str 3 + 1 + 2, then 2d6');
});
test('holy adds 2d6 against evil without changing the to-hit', () => {
  const on = calc(hero(sword({ enh: 2, fx: [{ id: 'holy', on: true }] }))).weapons[0];
  assert.equal(on.attack, 9, '4 + 3 + 2');
  assert.equal(on.damageText, '1d8+5+2d6');
});
test('alchemical silver takes 1 off damage; mithral halves the weight', () => {
  assert.equal(calc(hero(sword({ material: 'silver' }))).weapons[0].damageText, '1d8+2', 'Str 3 - 1');
  const heavy = calc(hero(sword())).encumbrance.weight, mithral = calc(hero(sword({ material: 'mithral' }))).encumbrance.weight;
  assert.equal(heavy - mithral, 2, '4 lb becomes 2 lb');
});
test('speed gives one extra attack at the best bonus, and does not double up with Haste', () => {
  const sp = { enh: 3, fx: [{ id: 'speed' }] };
  assert.equal(calc(hero(sword(sp), 6)).weapons[0].attackText, '+12/+12/+7', 'BAB 6 + Str 3 + 3 = +12, then 1 + 3 + 3 = +7');
  const haste = calc(buff(hero(sword(sp), 6), 'Haste')).weapons[0];
  assert.equal(haste.attacks.length, 3, 'Haste and speed give one extra attack between them');
  assert.equal(haste.attackText, '+13/+13/+8', 'Haste is +1 to hit');
});
test('Improved Critical doubles the threat range, and does not stack with keen', () => {
  assert.equal(calc(hero(sword({ improvedCritical: true }))).weapons[0].crit, '17-20/×2');
  assert.equal(calc(hero(sword({ improvedCritical: true, enh: 1, fx: [{ id: 'keen' }] }))).weapons[0].crit, '17-20/×2');
});
test('no crit text means no critical figures; the other numbers are unchanged', () => {
  const d = calc(hero(sword({ crit: '' }))).weapons[0];
  assert.equal(d.crit, '');
  assert.equal(d.critText, '');
  assert.equal(d.damageText, '1d8+3');
});
test('abilities need a +1 enhancement and the total is capped at +10', () => {
  assert.match(weaponFx({ enh: 0, fx: [{ id: 'flaming' }] }).warn, /at least a \+1/);
  assert.match(weaponFx({ enh: 5, fx: [{ id: 'vorpal' }, { id: 'speed' }] }).warn, /above \+10/, '5 + 5 + 3 = 13');
  assert.equal(weaponFx({ enh: 5, fx: [{ id: 'vorpal' }] }).warn, '', '+10 is allowed');
  assert.equal(weaponFx({ enh: 1, fx: [{ id: 'flaming' }, { id: 'keen' }], material: 'adamantine' }).summary, '+3 flaming keen · adamantine');
});
test('the breakdown still adds up with bane and silver', () => {
  const c = hero(sword({ enh: 1, material: 'silver', fx: [{ id: 'bane', on: true }] }));
  const d = calc(c);
  assert.equal(sumOf(d.bd['weapons.0.damage']), d.weapons[0].dmgBonus, 'Str 3 + 1 + 2 - 1 = 5');
  assert.equal(sumOf(d.bd['weapons.0.attack']), d.weapons[0].attack);
});
