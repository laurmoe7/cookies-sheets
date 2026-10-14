import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSave, spellInfo } from '../web/js/spellinfo.js';

test('saving throws are read from the stored text', () => {
  assert.deepEqual(parseSave('Reflex half'), { type: 'Reflex', effect: 'half', harmless: false, label: 'Reflex half' });
  assert.equal(parseSave('Will negates (harmless)').label, 'Will negates (harmless)');
  assert.equal(parseSave('Fortitude partial; see text').label, 'Fortitude partial');
  assert.equal(parseSave('see text').label, 'see the spell text');
  for (const none of ['none', 'no', '', null, 'none; see text']) assert.equal(parseSave(none), null, String(none));
});

test('Fireball: damage dice, Reflex half, spell resistance, no attack roll', () => {
  const i = spellInfo({ summary: '1d6 fire damage per level, 20-ft. radius.', html: '<p>A fireball spell is an explosion of flame that detonates with a low roar.</p>', meta: { save: 'Reflex half', sr: 'yes' } }, 7);
  assert.deepEqual(i, { dice: '7d6', kind: 'damage', attack: null, touch: false, save: parseSave('Reflex half'), sr: true });
});

test('Cure Light Wounds heals; a touch attack spell is a melee touch', () => {
  const cure = spellInfo({ summary: 'Cures 1d8 damage + 1/level (max +5).', html: '', meta: { save: 'Will half (harmless)', sr: 'yes (harmless)' } }, 3);
  assert.equal(cure.dice, '1d8+3'); assert.equal(cure.kind, 'healing'); assert.equal(cure.sr, true);
  const inflict = spellInfo({ summary: 'Touch attack, 2d8 damage +1/level (max +10).', html: '<p>You must succeed on a melee touch attack.</p>', meta: { save: 'Will half', sr: 'yes' } }, 4);
  assert.equal(inflict.attack, 'melee'); assert.equal(inflict.dice, '2d8+4'); assert.equal(inflict.kind, 'damage');
});

test('ray spells use a ranged touch attack; custom spells give nothing', () => {
  assert.equal(spellInfo({ summary: 'Ranged touch attack deals 4d6 fire damage, +1 ray/four levels (max 3).', html: '', meta: { save: 'none', sr: 'yes' } }, 9).attack, 'ranged');
  assert.deepEqual(spellInfo(null, 9), { dice: '', kind: '', attack: null, touch: false, save: null, sr: false });
  assert.equal(spellInfo({ summary: 'Wall of force.', html: '', meta: { save: 'none', sr: 'no' } }, 9).sr, false);
});

test('a plain "ranged attack" in the description (Fireball past a narrow passage) is not a touch attack', () => {
  const i = spellInfo({ summary: '1d6 fire damage per level, 20-ft. radius.', html: '<p>If you attempt to send the bead through a narrow passage, you must make a ranged attack roll to hit the opening.</p>', meta: { save: 'Reflex half', sr: 'yes' } }, 5);
  assert.equal(i.attack, null);
});

test('attack type reads the summary, the Effect line and the opening only', async () => {
  const { attackType } = await import('../web/js/spellinfo.js');
  const stat = e => `<dl class="stat"><dt>Effect</dt><dd>${e}</dd></dl>`;
  assert.equal(attackType('', stat('ray') + '<p>You emit a ray of frost.</p>'), 'ranged');
  assert.equal(attackType('Touch attack, 2d8 damage', ''), 'melee');
  assert.equal(attackType('', stat('one bead') + '<p>' + 'x '.repeat(300) + 'ranged touch attack</p>'), null, 'late mention is ignored');
});

test('dice that are not damage or healing do not count as a roll (durations, hit dice)', () => {
  const stat = '<dl class="stat"><dt>Duration</dt><dd>instantaneous</dd></dl>';
  const detect = spellInfo({ summary: 'Detects all spells and magic items within 60 ft.', html: stat + '<p>Lingering aura: faint 1d6 rounds, moderate 1d6 minutes. You detect magic.</p>', meta: { save: 'none', sr: 'no' } }, 7);
  assert.equal(detect.kind, ''); assert.equal(detect.attack, null); assert.equal(detect.sr, false);
  assert.equal(spellInfo({ summary: 'Calms 2d4 + level HD of animals.', html: '', meta: { sr: 'yes' } }, 5).kind, '', 'hit dice are not a damage roll');
});

test('damage dice only in the description are found next to the damage words', () => {
  const i = spellInfo({ summary: '', html: '<dl class="stat"><dt>Duration</dt><dd>1d4 rounds</dd></dl><p>The bolt deals 1d6 points of fire damage per caster level (maximum 10d6).</p>', meta: { save: 'Reflex half', sr: 'yes' } }, 8);
  assert.equal(i.dice, '8d6'); assert.equal(i.kind, 'damage');
});

test('spells that call for an ordinary attack roll get a roll to hit, asides and denials do not', () => {
  const info = html => spellInfo({ summary: '', html, meta: { save: 'none', sr: 'no' } }, 5);
  assert.deepEqual([info('<p>Each discus requires a ranged attack to hit and deals 4d6 points of damage.</p>').attack, info('<p>Each discus requires a ranged attack to hit.</p>').touch], ['ranged', false]);
  assert.equal(info('<p>You imbue an arrow with your power. Make a ranged attack roll. If it hits, the target takes damage.</p>').attack, 'ranged');
  assert.equal(info('<p>The user of the stones makes a normal ranged attack with them.</p>').attack, 'ranged');
  assert.equal(info('<p>This ray requires a ranged touch attack to hit and deals 6d6 points of fire damage.</p>').touch, true);
  assert.equal(info('<p>The creature is free to make melee attacks against you if you come within reach.</p>').attack, null, 'a creature making attacks is not your attack roll');
  assert.equal(info('<p>This liquid works as a tanglefoot bag, except you do not have to make a successful ranged attack roll to hit.</p>').attack, null, 'a denial');
});

test('a harming touch spell whose summary says "Touch deals" needs a melee touch attack; a healing one does not', () => {
  const inflict = spellInfo({ summary: 'Touch deals 1d8 damage +1/level (max +5).', html: '<p>You channel negative energy.</p>', meta: { range: 'touch', save: 'Will half', sr: 'yes' } }, 3);
  assert.equal(inflict.attack, 'melee'); assert.equal(inflict.touch, true); assert.equal(inflict.dice, '1d8+3', '1d8 + 1 x 3 levels');
  const cure = spellInfo({ summary: 'Cures 1d8 damage + 1/level (max +5).', html: '', meta: { range: 'touch', save: 'Will half (harmless)', sr: 'yes' } }, 3);
  assert.equal(cure.attack, null);
});

test('a flat bonus beside the dice is kept: Magic Missile is 1d4+1', () => {
  const mm = spellInfo({ summary: '1d4+1 damage; +1 missile per two levels above 1st (max 5).', html: '', meta: { sr: 'yes' } }, 5);
  assert.equal(mm.dice, '1d4+1'); assert.equal(mm.kind, 'damage'); assert.equal(mm.attack, null);
});
