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

test('one volume slider replaces the Sound effects checkbox', () => {
  assert.equal(sanitize(null).volume, 100);
  assert.equal('sfx' in sanitize(null), false);
  assert.equal(sanitize({ volume: 40 }).volume, 40);
  assert.equal(sanitize({ volume: '65' }).volume, 65);
  assert.equal(sanitize({ volume: 250 }).volume, 100, 'clamped');
  assert.equal(sanitize({ volume: -5 }).volume, 0, 'clamped');
  assert.equal(sanitize({ volume: 'loud' }).volume, 100, 'junk falls back to the default');
  assert.equal(sanitize({ sfx: false }).volume, 0, 'an old save with sound effects off stays silent');
  assert.equal(sanitize({ sfx: true }).volume, 100);
  assert.equal(sanitize({ sfx: false, volume: 30 }).volume, 30, 'a chosen volume wins over the old checkbox');
});

test('the Options window never keeps state in a data-pick attribute on its own body', async () => {
  // It used to (body.dataset.pick = effect). Click handling then runs closest('[data-pick]'), which finds the body itself,
  // so after one "Add sound" every later click in the window (the remove buttons too) reopened the file chooser.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../web/js/options.js', import.meta.url), 'utf8');
  assert.equal(/body\.dataset\.pick/.test(src), false);
});

test('the tab order: saved keys first, unknown ones dropped, new tabs keep their place at the end', async () => {
  const { orderKeys, sanitize, DEFAULTS } = await import('../web/js/options.js');
  const base = ['overview', 'buffs', 'skills', 'gear'];
  assert.deepEqual(orderKeys(base, []), base, 'nothing saved: the usual order');
  assert.deepEqual(orderKeys(base, ['gear', 'overview']), ['gear', 'overview', 'buffs', 'skills']);
  assert.deepEqual(orderKeys(base, ['gear', 'gone', 'gear', 'skills']), ['gear', 'skills', 'overview', 'buffs'], 'a removed tab and repeats are ignored');
  assert.equal(DEFAULTS.tabDrag, false, 'dragging is off until switched on');
  assert.deepEqual(sanitize({ tabOrder: 'nonsense', tabDrag: 1 }).tabOrder, []);
  assert.equal(sanitize({ tabDrag: 1 }).tabDrag, true);
  assert.equal('tabLock' in sanitize({ tabLock: true }), false, 'the old separate lock is gone: dragging off means locked');
  assert.deepEqual(sanitize({ tabOrder: ['a', 5, 'a', 'b'] }).tabOrder, ['a', 'b'], 'only text, no repeats');
});
