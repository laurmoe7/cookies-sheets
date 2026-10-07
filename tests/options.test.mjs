import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, DEFAULTS } from '../web/js/options.js';

test('missing or broken stored options fall back to defaults', () => {
  assert.deepEqual(sanitize(null), DEFAULTS);
  assert.deepEqual(sanitize('junk'), DEFAULTS);
  const o = sanitize({ theme: 'neon', accent: 'pink', textSize: 77, startTab: 'nope', compact: 1 });
  assert.equal(o.theme, 'dark');
  assert.equal(o.accent, 'crimson');
  assert.equal(o.textSize, 100);
  assert.equal(o.startTab, 'overview');
  assert.equal(o.compact, true);
});

test('valid choices are kept', () => {
  const o = sanitize({ theme: 'tome', accent: 'blue', textSize: '112', tooltips: false, startTab: 'spells' });
  assert.deepEqual([o.theme, o.accent, o.textSize, o.tooltips, o.startTab], ['tome', 'blue', 112, false, 'spells']);
});
