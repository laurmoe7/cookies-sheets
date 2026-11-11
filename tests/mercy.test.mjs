// Paladin mercies (Core Rulebook, Paladin: Mercy; Extra Mercy feat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MERCIES, mercyAllowance, canChoose, merciesFromNotes, merciesOf, mercyLines, mercyProblems } from '../web/js/mercy.js';
import { newCharacter, migrate } from '../web/js/model.js';

const paladin = (notes, feats = []) => ({ levelUps: notes.map(n => ({ cls: 'Paladin', notes: n })), feats });

test('the Core Rulebook list: 3 at 3rd, 3 at 6th, 5 at 9th, 4 at 12th', () => {
  const by = l => MERCIES.filter(m => m.level === l).map(m => m.name);
  assert.deepEqual(by(3), ['Fatigued', 'Shaken', 'Sickened']);
  assert.deepEqual(by(6), ['Dazed', 'Diseased', 'Staggered']);
  assert.deepEqual(by(9), ['Cursed', 'Exhausted', 'Frightened', 'Nauseated', 'Poisoned']);
  assert.deepEqual(by(12), ['Blinded', 'Deafened', 'Paralyzed', 'Stunned']);
});

test('one mercy at 3rd level and every three levels after, plus Extra Mercy feats', () => {
  assert.equal(mercyAllowance(2), 0, 'none before 3rd');
  assert.equal(mercyAllowance(3), 1);
  assert.equal(mercyAllowance(8), 2, '3rd and 6th');
  assert.equal(mercyAllowance(20), 6, '3rd, 6th, 9th, 12th, 15th, 18th');
  assert.equal(mercyAllowance(6, { feats: [{ name: 'Extra Mercy' }, { name: 'extra mercy ' }] }), 2 + 2, 'two from levels, one per Extra Mercy');
});

test('a mercy needs its level, and exhausted / frightened / nauseated need the lesser one first', () => {
  assert.equal(canChoose('Dazed', 5), false, 'dazed opens at 6th');
  assert.equal(canChoose('Dazed', 6), true);
  assert.equal(canChoose('Exhausted', 9, []), false, 'needs fatigued');
  assert.equal(canChoose('Exhausted', 9, ['Fatigued']), true);
  assert.equal(canChoose('Injured', 3), true, 'a mercy typed in from another book is not checked');
  assert.deepEqual(mercyProblems(['Fatigued', 'Shaken'], 5), ['2 mercies chosen, but a 5th-level paladin has 1.']);
  assert.deepEqual(mercyProblems(['Frightened', 'Stunned'], 9), ['Frightened needs the Shaken mercy.', 'Stunned needs paladin level 12.']);
});

test('until mercies are chosen on the sheet they are read from the notes of paladin levels 3, 6, 9...', () => {
  const c = paladin(['', 'Took a sickened?', 'Mercy: fatigue', '', '', 'mercy - diseased']);
  assert.deepEqual(merciesFromNotes(c), ['Fatigued', 'Diseased'], '2nd-level notes do not count; "fatigue" names Fatigued');
  assert.deepEqual(merciesOf(c), ['Fatigued', 'Diseased']);
  c.mercies = ['Shaken'];
  assert.deepEqual(merciesOf(c), ['Shaken'], 'once chosen on the sheet, that list wins');
  c.mercies = [];
  assert.deepEqual(merciesOf(c), [], 'even when it is empty');
  assert.deepEqual(merciesFromNotes({ levelUps: [{ cls: 'Fighter', notes: 'x' }, { cls: 'Fighter', notes: 'x' }, { cls: 'Fighter', notes: 'shaken' }] }), [], 'only paladin levels');
});

test('each mercy says what it does, with the paladin level as caster level for the spell ones', () => {
  assert.deepEqual(mercyLines(['Shaken', 'Diseased', 'Injured'], 7), [
    { name: 'Shaken', text: 'The target is no longer shaken.' },
    { name: 'Diseased', text: 'Lay on hands also acts as remove disease, with caster level 7.' },
    { name: 'Injured', text: 'From another book: see its rules.' }]);
});

test('saves: no mercies field means read the notes, and old saves keep working', () => {
  assert.equal(newCharacter().mercies, null);
  const old = newCharacter(); delete old.mercies;
  assert.equal(migrate(old).mercies, null);
  const chosen = { ...newCharacter(), mercies: ['Fatigued'] };
  assert.deepEqual(migrate(chosen).mercies, ['Fatigued'], 'a list of names survives migrate');
});
