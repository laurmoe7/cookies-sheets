import test from 'node:test';
import assert from 'node:assert/strict';
import { soundItems, isCustomized, SOUND_CATS } from '../web/js/sfx.js';
import { sanitize } from '../web/js/options.js';

test('every effect lists its built-in sounds first, then the ones the player added', () => {
  const hit = soundItems('hit', { hit: [{ id: 'a1b2c3d4', label: 'my bang' }] }, {});
  assert.deepEqual(hit.map(s => [s.kind, s.label, s.enabled]), [['default', 'Built-in 1', true], ['default', 'Built-in 2', true], ['default', 'Built-in 3', true], ['default', 'Built-in 4', true], ['custom', 'my bang', true]]);
  assert.deepEqual(soundItems('heal', {}, {}).map(s => s.label), ['Built-in'], 'a single built-in is not numbered');
  assert.deepEqual(SOUND_CATS.map(c => c[0]), ['levelUp', 'heal', 'fullHeal', 'hit']);
});

test('a built-in that was switched off stays listed (so it can be brought back) but is not enabled', () => {
  const off = { hit: ['sounds/hit-2.ogg', 'sounds/hit-4.ogg'] };
  const items = soundItems('hit', {}, off);
  assert.deepEqual(items.map(s => s.enabled), [true, false, true, false]);
  assert.deepEqual(items.filter(s => s.enabled).map(s => s.ref), ['sounds/hit-1.mp3', 'sounds/hit-3.ogg']);
  assert.equal(soundItems('heal', {}, off).every(s => s.enabled), true, 'other effects are untouched');
});

test('an effect with nothing enabled is silent, and restoring means no custom files and nothing switched off', () => {
  assert.equal(soundItems('heal', {}, { heal: ['sounds/heal.ogg'] }).filter(s => s.enabled).length, 0);
  assert.equal(isCustomized('heal', {}, {}), false);
  assert.equal(isCustomized('heal', {}, { heal: ['sounds/heal.ogg'] }), true);
  assert.equal(isCustomized('heal', { heal: [{ id: 'a1b2c3d4', label: 'x' }] }, {}), true);
  assert.equal(isCustomized('heal', { hit: [{ id: 'a1b2c3d4', label: 'x' }] }, {}), false, 'only this effect counts');
});

test('the switched-off list in the options is cleaned up', () => {
  assert.deepEqual(sanitize(null).soundOff, {});
  assert.deepEqual(sanitize({ soundOff: { hit: ['sounds/hit-2.ogg'], bogus: ['x'], heal: 'nope', fullHeal: [3, 'sounds/full-heal.ogg'] } }).soundOff, { hit: ['sounds/hit-2.ogg'], fullHeal: ['sounds/full-heal.ogg'] });
  assert.deepEqual(sanitize({ soundOff: 'junk' }).soundOff, {});
});
