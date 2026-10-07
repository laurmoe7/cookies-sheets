import test from 'node:test';
import assert from 'node:assert/strict';
import { linkTerms } from '../web/js/termlinks.js';

test('a monster ability in attack text becomes a link', () => {
  const h = linkTerms('bite +8 (1d3-4 plus attach)');
  assert.match(h, /<a href="#" class="ref" data-entry="Attach" data-cat="Monster Ability">attach<\/a>\)$/);
  assert.ok(h.startsWith('bite +8 (1d3-4 plus '));
});
test('longer names win and ordinary words are untouched', () => {
  const h = linkTerms('improved evasion, scent; tripod');
  assert.match(h, /data-entry="Improved Evasion" data-cat="Class Feature">improved evasion</);
  assert.match(h, /data-entry="Scent" data-cat="Monster Ability">scent</);
  assert.ok(!h.includes('data-entry="Trip"'), 'tripod is not trip');
});
test('text is escaped', () => assert.equal(linkTerms('<b> & grab'), '&lt;b&gt; &amp; <a href="#" class="ref" data-entry="Grab" data-cat="Monster Ability">grab</a>'));
