import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPos, bubbleSpot } from '../web/js/pet/drag.js';

test('Cookie is kept fully on screen when dragged or when the window shrinks', () => {
  assert.deepEqual(clampPos(-40, -10, 190, 175, 1200, 800), { x: 0, y: 0 });
  assert.deepEqual(clampPos(1100, 700, 190, 175, 1200, 800), { x: 1010, y: 625 }, '1200 - 190 and 800 - 175');
  assert.deepEqual(clampPos(300, 200, 190, 175, 1200, 800), { x: 300, y: 200 });
  assert.deepEqual(clampPos(50, 50, 190, 175, 100, 100), { x: 0, y: 0 }, 'a window smaller than him pins him to the corner');
});

const cs = 1.25, b = { w: 300, h: 80 };

test('the bubble sits to the right of his beak and above it when there is room', () => {
  const p = bubbleSpot({ left: 10, top: 300 }, b, cs, 1200, 800);
  assert.deepEqual(p, { left: Math.round(2 + 142 * cs), top: Math.round(92 * cs), side: 'right', above: true }, 'the docked position, unchanged');
});

test('near the right edge the bubble flips to his left; near the top it drops below him', () => {
  const edge = bubbleSpot({ left: 1000, top: 300 }, b, cs, 1200, 800);
  assert.equal(edge.side, 'left');
  assert.ok(1000 + edge.left >= 8 && 1000 + edge.left + b.w <= 1200, 'fully inside the window');
  const tall = { w: 300, h: 160 };
  const top = bubbleSpot({ left: 10, top: 20 }, tall, cs, 1200, 800);
  assert.equal(top.above, false);
  assert.ok(20 + top.top + tall.h <= 800 - 8, 'below him and still inside');
});

test('in a corner it flips both ways, and in a tiny window it is still pulled inside', () => {
  const corner = bubbleSpot({ left: 1000, top: 10 }, { w: 300, h: 160 }, cs, 1200, 800);
  assert.equal(corner.side, 'left'); assert.equal(corner.above, false);
  const tiny = bubbleSpot({ left: 0, top: 100 }, b, cs, 260, 400);
  assert.equal(tiny.left, 8, 'as far left as the margin allows when it cannot fit at all');
});
