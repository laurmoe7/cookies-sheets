import test from 'node:test';
import assert from 'node:assert/strict';
import { cropRect, panCentre } from '../web/js/imagecrop.js';

test('zoom 1 on a wide image shows the full height and a centred slice of the width', () => {
  const r = cropRect(2000, 1000, 100, 100, 1, 0.5, 0.5);
  assert.equal(r.sh, 1000);
  assert.equal(r.sw, 1000, 'square frame: 1000 x 1000 of 2000 x 1000');
  assert.equal(r.sx, 500, 'centred: (2000 - 1000) / 2');
});
test('zoom 2 halves the visible area', () => {
  const r = cropRect(1000, 1000, 100, 100, 2, 0.5, 0.5);
  assert.equal(r.sw, 500);
  assert.equal(r.sx, 250);
});
test('the crop never leaves the image', () => {
  const r = cropRect(1000, 1000, 100, 100, 2, 0, 1);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 500, 'bottom edge: 1000 - 500');
});
test('dragging right moves the visible part left, within bounds', () => {
  const p = panCentre(2000, 1000, 100, 100, 1, 0.5, 0.5, 10, 0);
  assert.ok(Math.abs(p.cx - 0.45) < 1e-9, 'scale 0.1 px per source px: 10 px drag = 100 source px = 0.05 of 2000');
  const q = panCentre(2000, 1000, 100, 100, 1, 0.5, 0.5, 1000, 0);
  assert.ok(Math.abs(q.cx - 0.25) < 1e-9, 'stops at the left edge: centre = 500 / 2000');
});
