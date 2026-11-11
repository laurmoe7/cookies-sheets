import test from 'node:test';
import assert from 'node:assert/strict';
import { startingWealth, rollStartingGold, CLASS_GOLD_DICE } from '../web/js/wealth.js';

const faces = list => { let i = 0; return () => (list[i++ % list.length] - 0.5) / 6; };

test('above 1st level the Wealth by Level table applies, whatever the class', () => {
  assert.equal(startingWealth(8, 'Wizard').gp, 33000, 'table: 8th level = 33,000 gp');
  assert.equal(startingWealth(2).gp, 1000, 'table: 2nd level = 1,000 gp');
  assert.equal(startingWealth(5, 'Fighter').gp, 10500, 'table: 5th level = 10,500 gp');
  assert.equal(startingWealth(20).gp, 880000, 'table: 20th level = 880,000 gp');
});

test('at 1st level the class starting wealth average is used', () => {
  assert.equal(startingWealth(1, 'Fighter').gp, 175, 'Fighter 5d6 × 10: 5 × 3.5 × 10 = 175');
  assert.equal(startingWealth(1, 'Monk').gp, 35, 'Monk 1d6 × 10: 3.5 × 10 = 35');
  assert.equal(startingWealth(1, 'Wizard').gp, 70, 'Wizard 2d6 × 10: 2 × 3.5 × 10 = 70');
  assert.equal(startingWealth(1, 'Fighter').dice, 5);
  assert.equal(startingWealth(1, 'Kineticist').gp, null, 'no entry: the player types it in');
  assert.equal(startingWealth(1).gp, null, 'no class picked yet');
});

test('every base class in classes.json has a starting wealth entry', async () => {
  const { readFile } = await import('node:fs/promises');
  const classes = JSON.parse(await readFile(new URL('../data/classes.json', import.meta.url)));
  const missing = classes.filter(k => !k.prestige && !CLASS_GOLD_DICE[k.name]).map(k => k.name);
  assert.deepEqual(missing, []);
});

test('rolling starting gold is Nd6 × 10', () => {
  const r = rollStartingGold(5, faces([6, 1, 3, 4, 2]));
  assert.deepEqual(r.rolls, [6, 1, 3, 4, 2]);
  assert.equal(r.gp, 160, '(6 + 1 + 3 + 4 + 2) × 10 = 160');
});
