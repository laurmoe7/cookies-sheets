import test from 'node:test';
import assert from 'node:assert/strict';
import { hpSegments, segsHtml } from '../web/js/bars.js';

test('hit point bars get 4 to 10 segments, not one per hit point', () => {
  assert.equal(hpSegments(5), 4, 'small totals still get 4');
  assert.equal(hpSegments(34), 4, '34 / 8 = 4.25, rounds to 4');
  assert.equal(hpSegments(60), 8, '60 / 8 = 7.5, rounds to 8');
  assert.equal(hpSegments(200), 10, 'capped at 10');
  assert.equal(hpSegments(0), 4);
});

test('segment markup has one cell per segment', () => {
  assert.equal((segsHtml(6).match(/<i><\/i>/g) || []).length, 6);
  assert.equal((segsHtml(0).match(/<i><\/i>/g) || []).length, 1);
});
