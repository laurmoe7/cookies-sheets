// Racial favored class options, as printed in the Advanced Player's Guide and Advanced Race Guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RACES } from '../web/js/data.js';

const fcb = JSON.parse(readFileSync(new URL('../data/fcb.json', import.meta.url), 'utf-8'));

test('known options come through word for word', () => {
  assert.equal(fcb.Dwarf.Fighter[0].text, "Add +1 to the fighter's CMD when resisting a bull rush or trip.");
  assert.equal(fcb.Kitsune.Rogue[0].text, 'The rogue gains 1/6 of a new rogue talent.');
});

test('every race with options is one the app offers', () => {
  const known = new Set(Object.keys(RACES));
  const unknown = Object.keys(fcb).filter(r => !known.has(r));
  assert.deepEqual(unknown, ['Merfolk'], 'only Merfolk is in the books but not in the race list');
});

test('every option names a class and has text and a source', () => {
  for (const [race, classes] of Object.entries(fcb)) {
    for (const [cls, opts] of Object.entries(classes)) {
      assert.ok(cls && opts.length, `${race} ${cls}`);
      for (const o of opts) assert.ok(o.text.length > 10 && o.source, `${race} ${cls}: ${o.text}`);
    }
  }
});
