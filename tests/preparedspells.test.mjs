import test from 'node:test';
import assert from 'node:assert/strict';
import { newCharacter, migrate, MODEL_VERSION } from '../web/js/model.js';

const oldSave = () => {
  const c = newCharacter();
  c.version = 1; // saved before "prepared" meant what is left to cast
  c.spellbooks = { Wizard: { used: Array(10).fill(0), extraSlot: false, spells: [
    { name: 'Fireball', level: 3, prepared: 3, cast: 1 },
    { name: 'Shield', level: 1, prepared: 2, cast: 2 },
    { name: 'Grease', level: 1, prepared: 1, cast: 0 },
    { name: 'Odd', level: 2, prepared: 1, cast: 5 },
  ] } };
  return c;
};

test('an older save keeps its day: the casts are taken off what was prepared, once', () => {
  const c = migrate(oldSave());
  assert.deepEqual(c.spellbooks.Wizard.spells.map(s => [s.prepared, s.cast]), [[2, 1], [0, 2], [1, 0], [0, 5]], 'prepared is what is left; cast is kept');
  assert.equal(c.version, MODEL_VERSION);
  migrate(c); // loading it again must not take the casts off a second time
  assert.deepEqual(c.spellbooks.Wizard.spells.map(s => s.prepared), [2, 0, 1, 0]);
});

test('a new character and a current save are left alone', () => {
  const c = newCharacter();
  c.spellbooks = { Wizard: { used: [], extraSlot: false, spells: [{ name: 'Fireball', level: 3, prepared: 2, cast: 1 }] } };
  assert.equal(c.version, MODEL_VERSION);
  migrate(c);
  assert.equal(c.spellbooks.Wizard.spells[0].prepared, 2);
});

test('a save from a newer build keeps its version number', () => {
  const c = migrate({ ...newCharacter(), version: MODEL_VERSION + 3 });
  assert.equal(c.version, MODEL_VERSION + 3, 'an older build must not stamp it with its own number');
});
