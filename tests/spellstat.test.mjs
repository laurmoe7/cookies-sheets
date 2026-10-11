import test from 'node:test';
import assert from 'node:assert/strict';
import { spellStatHtml, parseLevels } from '../web/js/spellstat.js';

const stat = rows => `<dl class="stat">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p>Body text.</p>`;

test('class levels read both the compendium and the spreadsheet formats', () => {
  assert.deepEqual(parseLevels('Antipaladin: 1; Cleric: 1; Elementalist Wizard: 3'), [['Antipaladin', 1], ['Cleric', 1], ['Elementalist Wizard', 3]]);
  assert.deepEqual(parseLevels('antipaladin 1, bard 1, cleric/oracle 1, sorcerer/wizard 3, witch 1'),
    [['Antipaladin', 1], ['Bard', 1], ['Cleric/Oracle', 1], ['Sorcerer/Wizard', 3], ['Witch', 1]]);
  assert.deepEqual(parseLevels(''), []);
});

test('a spell stat block becomes school, level chips, a facts row and the remaining rows', () => {
  const out = spellStatHtml(stat([['School', 'illusion (shadow)'], ['Level', 'antipaladin 1, bard 1, sorcerer/wizard 2'], ['Casting Time', '1 standard action'],
    ['Components', 'V, S'], ['Range', 'close (25 ft. + 5 ft./level)'], ['Target', 'one creature'], ['Duration', '1 round/level (D)'],
    ['Saving Throw', 'Will negates'], ['Spell Resistance', 'yes']]));
  assert.match(out, /<div class="ss-school">illusion \(shadow\)<\/div>/);
  assert.match(out, /<span class="ss-lab">Level 1<\/span><span class="ss-chip">Antipaladin<\/span><span class="ss-chip">Bard<\/span>/);
  assert.match(out, /<span class="ss-lab">Level 2<\/span><span class="ss-chip">Sorcerer\/Wizard<\/span>/);
  for (const [lab, val] of [['Casting time', '1 standard action'], ['Range', 'close (25 ft. + 5 ft./level)'], ['Duration', '1 round/level (D)'], ['Saving throw', 'Will negates'], ['Spell resistance', 'yes']])
    assert.ok(out.includes(`<span class="ss-lab">${lab}</span><b>${val}</b>`), lab);
  assert.match(out, /<dl class="ss-rows"><dt>Components<\/dt><dd>V, S<\/dd><dt>Target<\/dt><dd>one creature<\/dd><\/dl>/);
  assert.ok(out.endsWith('<p>Body text.</p>'), 'the description is kept');
  assert.ok(!out.includes('class="stat"'));
});

test('empty fields are skipped, and anything that is not a spell stat block is untouched', () => {
  const sparse = spellStatHtml(stat([['School', 'abjuration'], ['Level', 'Wizard: 1'], ['Casting Time', '1 standard action'], ['Components', ''], ['Duration', '1 hour/level']]));
  assert.ok(!sparse.includes('ss-rows') && !sparse.includes('>Range<'));
  const monster = stat([['Race', 'Elf'], ['Size', 'Medium']]);
  assert.equal(spellStatHtml(monster), monster);
  assert.equal(spellStatHtml('<p>No stat block</p>'), '<p>No stat block</p>');
  assert.equal(spellStatHtml(null), '');
});
