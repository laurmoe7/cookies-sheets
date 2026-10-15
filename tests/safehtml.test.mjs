// Creature text stored in a character file can be anyone's, so it is cleaned before it is shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeHtml } from '../web/js/safehtml.js';
import { statBlockHtml } from '../web/js/summons.js';

test('formatting survives, everything dangerous does not', () => {
  assert.equal(safeHtml('<p>Poison. The save is <i>Con</i>-based.<br>Sting: <b>1d6</b></p>'), '<p>Poison. The save is <i>Con</i>-based.<br>Sting: <b>1d6</b></p>');
  assert.equal(safeHtml('<img src=x onerror="alert(1)">hi'), 'hi', 'an image with a handler is dropped');
  assert.equal(safeHtml('<a href="javascript:alert(1)" onclick="x()">link</a>'), '<a>link</a>', 'attributes go, including the javascript: address');
  assert.equal(safeHtml('<p onmouseover="x()" style="a:b">t</p>'), '<p>t</p>');
  assert.ok(!/<script|<iframe|<svg|<style/i.test(safeHtml('<script>alert(1)</script><iframe src=//e></iframe><svg onload=x><style>*{}</style>ok')), 'no script, frame, svg or style tags');
  assert.equal(safeHtml('<p>5 < 6 and <b'), '<p>5 &lt; 6 and &lt;b', 'a broken tag cannot be completed by what follows it');
  assert.equal(safeHtml(null), '');
  assert.equal(safeHtml('Tom &amp; Jerry'), 'Tom &amp; Jerry', 'entities are left alone');
});

test('a creature stat block built from a doctored file shows no active content', () => {
  const html = statBlockHtml({ name: 'Evil', abilities: [{ name: 'Gaze', html: '<img src=x onerror=alert(1)><p>You faint.</p>' }] }, { companion: true });
  assert.ok(!/onerror|<img/i.test(html), html);
  assert.ok(html.includes('<p>You faint.</p>'), 'the plain text survives');
});
