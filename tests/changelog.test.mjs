// The What's new page: one entry per version number, newest first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGELOG } from '../web/js/changelog.js';
import { VERSION } from '../web/js/version.js';

const parts = v => String(v).split('.').map(Number);
const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

test('the changelog has one entry per version, newest first, each with short items', () => {
  assert.ok(CHANGELOG.length >= 4);
  for (const e of CHANGELOG) {
    assert.match(e.version, /^\d+\.\d+(\.\d+)?$/, 'a version number, not a title');
    assert.ok(e.items.length > 0 && e.items.every(i => typeof i === 'string' && i.length < 260), `${e.version}: items are short sentences`);
  }
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(newer(CHANGELOG[i - 1].version, CHANGELOG[i].version), `${CHANGELOG[i - 1].version} comes before ${CHANGELOG[i].version}`);
});

test('the version in Options is in the changelog, and only versions newer than it are marked as next', () => {
  assert.ok(CHANGELOG.some(e => e.version === VERSION && !e.next), `${VERSION} has a released entry`);
  for (const e of CHANGELOG) assert.equal(!!e.next, newer(e.version, VERSION), `${e.version} is ${e.next ? '' : 'not '}marked next`);
  assert.ok(CHANGELOG.filter(e => !e.next).every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date)), 'released versions have a date');
});

test('a changelog line shows its area in bold', async () => {
  const { groupChangelog, changelogGroup } = await import('../web/js/options.js');
  const html = items => groupChangelog(items).map(changelogGroup).join('');
  assert.equal(html(['Spells: cure <b> spells']), '<li><b>Spells:</b> cure &lt;b&gt; spells</li>');
  assert.equal(html(['Fixed the app getting stuck on "Loading…": now it opens.']), '<li>Fixed the app getting stuck on &quot;Loading…&quot;: now it opens.</li>', 'no area: left as it is');
});

test('lines of the same area are shown together, under the area once, in the order the areas first come up', async () => {
  const { groupChangelog, changelogGroup } = await import('../web/js/options.js');
  const items = ['Characters: one', 'Spells: two', 'A line with no area.', 'Characters: three'];
  assert.deepEqual(groupChangelog(items), [
    { area: 'Characters', items: ['one', 'three'] },
    { area: 'Spells', items: ['two'] },
    { area: '', items: ['A line with no area.'] },
  ]);
  assert.equal(changelogGroup({ area: 'Characters', items: ['one', 'three'] }),
    '<li><b>Characters</b><ul class="changelog-sub"><li>One</li><li>Three</li></ul></li>', 'the area once, each line under it');
});
