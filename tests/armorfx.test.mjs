import test from 'node:test';
import assert from 'node:assert/strict';
import { make, calc, repeat } from './helpers.mjs';
import { armorFx, wornFx } from '../web/js/armorfx.js';

// Fighter 4. Human +2 Dex on 18 = Dex 20, +5.
const shirt = (extra = {}) => ({ name: 'Chain shirt', type: 'armor', category: 'light', bonus: 4, enh: 0, maxDex: 4, acp: -2, asf: 20, weight: 25, equipped: true, ...extra });
const breastplate = (extra = {}) => ({ name: 'Breastplate', type: 'armor', category: 'medium', bonus: 6, enh: 0, maxDex: 3, acp: -4, asf: 25, weight: 30, equipped: true, ...extra });
const hero = (...armor) => make({ base: { dex: 18 }, raceChoice: 'dex', levels: repeat('Fighter', 4), armor });
const sumOf = list => list.reduce((s, p) => s + p.value, 0);

test('plain armor is unchanged: the Dex cap, the penalty and the spell failure come from the table', () => {
  const d = calc(hero(shirt()));
  assert.equal(d.ac.total, 18, '10 + 4 armor + Dex capped at 4');
  assert.equal(d.acp, -2);
  assert.equal(d.asf, 20);
});
test('masterwork armor lowers the check penalty by 1; an enhancement bonus alone does not (older saves already typed the real number)', () => {
  assert.equal(calc(hero(shirt({ mw: true }))).acp, -1, '2 - 1');
  assert.equal(calc(hero(shirt({ enh: 1 }))).acp, -2);
});
test('a mithral chain shirt: penalty gone, Dex cap +2, spell failure -10%, half weight', () => {
  const plain = calc(hero(shirt())), mithral = calc(hero(shirt({ material: 'mithral' })));
  assert.equal(mithral.acp, 0, '2 - 3 - 1 masterwork, never below 0');
  assert.equal(mithral.ac.total, 19, '10 + 4 + Dex 5 (cap now 6)');
  assert.equal(mithral.asf, 10, '20 - 10');
  assert.equal(plain.encumbrance.weight - mithral.encumbrance.weight, 12.5, '25 lb becomes 12.5 lb');
});
test('mithral counts as one category lighter for speed: medium armor no longer slows you', () => {
  assert.equal(calc(hero(breastplate())).speed, 20, 'medium armor');
  assert.equal(calc(hero(breastplate({ material: 'mithral' }))).speed, 30, 'treated as light');
});
test('adamantine gives damage reduction by category', () => {
  assert.deepEqual(armorFx(shirt({ material: 'adamantine' })).dr, ['1/−']);
  assert.deepEqual(armorFx(breastplate({ material: 'adamantine' })).dr, ['2/−']);
  assert.deepEqual(armorFx(breastplate({ type: 'shield', category: 'heavy', material: 'adamantine' })).dr, [], 'shields give none');
});
test('darkwood shield: penalty -2 (and -1 masterwork, never below 0) and half weight', () => {
  const shield = { name: 'Heavy wooden shield', type: 'shield', category: 'heavy', bonus: 2, enh: 0, maxDex: '', acp: -2, asf: 15, weight: 10, equipped: true };
  const plain = calc(hero(shield)), dark = calc(hero({ ...shield, material: 'darkwood' }));
  assert.equal(plain.acp, -2);
  assert.equal(dark.acp, 0, '2 - 2 - 1 is below 0');
  assert.equal(plain.encumbrance.weight - dark.encumbrance.weight, 5, '10 lb becomes 5 lb');
});
test('shadow adds +5 to Stealth, improved +10, and silent moves does not stack with it', () => {
  const stealth = armor => calc(hero(armor)).skills.Stealth.total;
  assert.equal(stealth(shirt()), 3, 'Dex 5 - 2 check penalty');
  assert.equal(stealth(shirt({ enh: 1, fx: [{ id: 'shadow' }] })), 8, '5 + 5 - 2');
  assert.equal(stealth(shirt({ enh: 1, fx: [{ id: 'shadowimp' }] })), 13, '5 + 10 - 2');
  assert.equal(stealth(shirt({ enh: 1, fx: [{ id: 'shadow' }, { id: 'silent' }] })), 8, 'competence bonuses do not stack');
  const d = calc(hero(shirt({ enh: 1, fx: [{ id: 'shadow' }] })));
  assert.equal(sumOf(d.bd['skills.Stealth.total']), d.skills.Stealth.total, 'the breakdown adds up');
});
test('fortification, spell resistance and energy resistance show in the worn summary; the best of each counts', () => {
  const w = wornFx([shirt({ enh: 3, fx: [{ id: 'fort25' }, { id: 'sr15' }, { id: 'res-fire' }, { id: 'res-fire-improved' }] })]);
  assert.equal(w.sr, 15); assert.equal(w.fort, 25);
  assert.deepEqual(w.resist, [{ type: 'fire', n: 20 }]);
  assert.equal(w.text, 'SR 15 · resist fire 20 · fortification 25%');
  assert.equal(wornFx([shirt({ equipped: false, fx: [{ id: 'sr19' }] })]).sr, 0, 'not worn');
});
test('the bonus total is capped at +10 and abilities that cost a bonus need a +1', () => {
  assert.equal(armorFx(shirt({ enh: 1, fx: [{ id: 'fort75' }] })).summary, '+4 moderate fortification');
  assert.match(armorFx(shirt({ enh: 0, fx: [{ id: 'fort25' }] })).warn, /at least a \+1/);
  assert.match(armorFx(shirt({ enh: 5, fx: [{ id: 'reflecting' }, { id: 'sr19' }] })).warn, /above \+10/, '5 + 5 + 5 = 15 (reflecting is shield-only, but the sum is what is warned about)');
  assert.equal(armorFx(shirt({ enh: 1, fx: [{ id: 'res-cold' }] })).warn, '', 'energy resistance costs gold, not a bonus');
  assert.equal(armorFx(shirt({ enh: 2, material: 'mithral' })).summary, '+2 · mithral');
});
