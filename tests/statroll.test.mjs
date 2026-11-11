import test from 'node:test';
import assert from 'node:assert/strict';
import { rollScore, rollSet, assignRoll, rolledBases, diceText, setQuality, unplaced } from '../web/js/statroll.js';
import { levelWarnings } from '../web/js/levelcheck.js';
import { migrate } from '../web/js/model.js';

// A d6 face f comes from rng() in [(f-1)/6, f/6); (f - 0.5) / 6 is the middle of it.
const faces = list => { let i = 0; return () => (list[i++ % list.length] - 0.5) / 6; };

test('4d6 drops the lowest die', () => {
  const r = rollScore('standard', faces([3, 6, 1, 5]));
  assert.deepEqual(r.dice, [3, 6, 1, 5]);
  assert.equal(r.drop, 2, 'the 1 is dropped');
  assert.equal(r.total, 14, '3 + 6 + 5 = 14');
  assert.equal(diceText(r, 'standard'), '3 + 6 + 5 (1 dropped)');
});
test('only one of two equal lowest dice is dropped', () => {
  assert.equal(rollScore('standard', faces([2, 2, 4, 4])).total, 10, '2 + 4 + 4 = 10');
});
test('3d6 and 2d6 + 6', () => {
  assert.equal(rollScore('classic', faces([1, 2, 3])).total, 6, '1 + 2 + 3 = 6');
  const h = rollScore('heroic', faces([1, 1]));
  assert.equal(h.total, 8, '1 + 1 + 6 = 8');
  assert.equal(diceText(h, 'heroic'), '1 + 1 + 6');
});
const SIX = [6, 6, 6, 1, 1, 1, 3, 3, 3, 4, 4, 4, 5, 5, 5, 2, 2, 2]; // 3d6 x 6: 18, 3, 9, 12, 15, 6
const placeAll = s => ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((t, a, i) => assignRoll(t, a, i), s);

test('a set is six scores, none placed yet, and rerolls are counted', () => {
  const s = rollSet('classic', null, { rng: faces(SIX), date: '2026-11-11' });
  assert.deepEqual(s.rolls.map(r => r.total), [18, 3, 9, 12, 15, 6]);
  assert.deepEqual(unplaced(s), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(rolledBases(s), { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, 'an ability with no roll stays 10');
  assert.equal(s.times, 1);
  assert.equal(rollSet('classic', s, { rng: faces([3]) }).times, 2);
});
test('placing rolls', () => {
  const s = placeAll(rollSet('classic', null, { rng: faces(SIX) }));
  assert.deepEqual(rolledBases(s), { str: 18, dex: 3, con: 9, int: 12, wis: 15, cha: 6 });
  assert.deepEqual(unplaced(s), []);
});
test('dropping a roll on an ability that has one swaps them', () => {
  const s = placeAll(rollSet('classic', null, { rng: faces(SIX) }));
  const t = assignRoll(s, 'dex', 0); // Dex takes the 18 that Str had; Str gets Dex's 3
  assert.deepEqual(rolledBases(t), { str: 3, dex: 18, con: 9, int: 12, wis: 15, cha: 6 });
  assert.equal(new Set(Object.values(t.assign)).size, 6, 'every roll used once');
  assert.equal(s.assign.str, 0, 'the old set is not changed');
});
test('moving a placed roll to an empty ability leaves the old one empty, and the pool takes rolls back', () => {
  let s = assignRoll(rollSet('classic', null, { rng: faces(SIX) }), 'str', 0);
  s = assignRoll(s, 'con', 0); // the 18 moves from Str to Con
  assert.equal(s.assign.str, null);
  assert.equal(s.assign.con, 0);
  s = assignRoll(s, null, 0); // back to the pool
  assert.equal(s.assign.con, null);
  assert.deepEqual(unplaced(s), [0, 1, 2, 3, 4, 5]);
});
test('a weak set is flagged (modifiers +0 or less, or nothing above 13)', () => {
  const set = totals => ({ rolls: totals.map(total => ({ total })) });
  // 18 15 12 9 6 3: +4 +2 +1 -1 -2 -4 = 0
  assert.deepEqual(setQuality(set([18, 15, 12, 9, 6, 3])), { mods: 0, low: true });
  // 13 13 13 13 13 13: +1 x 6 = +6, but nothing above 13
  assert.deepEqual(setQuality(set([13, 13, 13, 13, 13, 13])), { mods: 6, low: true });
  // 16 14 12 12 10 8: +3 +2 +1 +1 +0 -1 = +6
  assert.deepEqual(setQuality(set([16, 14, 12, 12, 10, 8])), { mods: 6, low: false });
});
test('old saves get no rolls, and creation warns when Roll is chosen but nothing rolled', () => {
  assert.equal(migrate({ abilities: {} }).abilityRolls, null);
  const base = { newLevel: 1, rankBudget: 0, ranksUsed: 0, pointsLeft: 0, name: 'Ada' };
  assert.ok(levelWarnings({ ...base, notRolled: true }).some(s => /not rolled/.test(s)));
  assert.ok(levelWarnings({ ...base, rollsUnplaced: 2 }).some(s => /2 rolled scores not given/.test(s)));
  assert.equal(levelWarnings(base).length, 0);
});

test('a ganzi gets +2 Con, +2 Cha, -2 Int and +2 on Sense Motive and Survival', async () => {
  const { make, calc } = await import('./helpers.mjs');
  const { autoEffects } = await import('../web/js/autofx.js');
  const c = make({ race: 'Ganzi', base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
  const d = calc(c);
  assert.equal(d.abilities.con.score, 12, '10 + 2');
  assert.equal(d.abilities.cha.score, 12, '10 + 2');
  assert.equal(d.abilities.int.score, 8, '10 - 2');
  const sk = autoEffects(c).skills.filter(s => s.source === 'Ganzi: Skilled').map(s => `${s.skill} +${s.value}`).sort();
  assert.deepEqual(sk, ['Sense Motive +2', 'Survival +2']);
});
