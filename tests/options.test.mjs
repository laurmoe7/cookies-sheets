import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, DEFAULTS } from '../web/js/options.js';

test('missing or broken stored options fall back to defaults', () => {
  assert.deepEqual(sanitize(null), DEFAULTS);
  assert.deepEqual(sanitize('junk'), DEFAULTS);
  const o = sanitize({ theme: 'neon', accent: 'pink', textSize: 77, compact: 1 });
  assert.equal(o.theme, 'tome', 'an unknown theme falls back to the default, Dusty tome');
  assert.equal(o.accent, 'crimson');
  assert.equal(o.textSize, 100);
  assert.equal(o.compact, true);
});

test('Classic dark is still a valid choice', () => {
  assert.equal(sanitize({ theme: 'dark' }).theme, 'dark');
  assert.equal(sanitize(null).theme, 'tome');
});

test('valid choices are kept', () => {
  const o = sanitize({ theme: 'tome', accent: 'blue', textSize: '112' });
  assert.deepEqual([o.theme, o.accent, o.textSize], ['tome', 'blue', 112]);
});
