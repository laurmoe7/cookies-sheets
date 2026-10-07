import test from 'node:test';
import assert from 'node:assert/strict';
import { levelWarnings } from '../web/js/levelcheck.js';

const done = { newLevel: 2, rankBudget: 6, ranksUsed: 6, getsFeat: false, bonusFeat: false, featsChosen: 0, getsAbility: false, abilityIncrease: '', isFav: false, fcb: 'hp', fcbNote: '', spellsLeft: '' };

test('a finished level has no warnings', () => assert.deepEqual(levelWarnings(done), []));
test('unspent skill ranks are reported with the counts', () => {
  const w = levelWarnings({ ...done, rankBudget: 6, ranksUsed: 4 });
  assert.equal(w.length, 1);
  assert.match(w[0], /2 skill ranks/, '6 - 4 = 2 left');
});
test('missing feat, ability increase and favored class choice', () => {
  const w = levelWarnings({ ...done, newLevel: 3, getsFeat: true, getsAbility: true, isFav: true, fcb: 'racial' });
  assert.equal(w.length, 3);
  assert.ok(w.some(s => /1 feat not chosen/.test(s)));
  assert.ok(w.some(s => /ability score increase/.test(s)));
  assert.ok(w.some(s => /racial option/.test(s)));
});
test('a human at 1st level needs two feats', () => {
  assert.match(levelWarnings({ ...done, newLevel: 1, getsFeat: true, bonusFeat: true, featsChosen: 1, pointsLeft: 0, name: 'Ada' })[0], /1 feat not chosen/);
  assert.equal(levelWarnings({ ...done, newLevel: 1, getsFeat: true, bonusFeat: true, featsChosen: 2, pointsLeft: 0, name: 'Ada' }).length, 0);
});
test('1st level checks point buy and the default name', () => {
  const w = levelWarnings({ ...done, newLevel: 1, pointsLeft: 3, name: 'New Character' });
  assert.ok(w.some(s => /3 ability point-buy points not spent/.test(s)));
  assert.ok(w.some(s => /default name/.test(s)));
  assert.ok(levelWarnings({ ...done, newLevel: 1, pointsLeft: -2, name: 'Ada' }).some(s => /2 points over/.test(s)));
});
