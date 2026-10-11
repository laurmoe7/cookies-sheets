import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tome = readFileSync(new URL('../web/css/theme-tome.css', import.meta.url), 'utf8');

test('Dusty tome keeps its scrolling page on its own layer', () => {
  // The leather background is not opaque, so without a layer of its own the browser repainted all of #main on every scroll step:
  // scrolling the Spells and Skills tabs took about 50 ms a frame in a headless test, against about 4 ms in Classic dark.
  assert.match(tome, /html\[data-theme="tome"\] #main \{ will-change: transform; \}/);
});

test('the page turn keeps its copies cheap', async () => {
  // The animated --c inherits into every element of every copy of the old page unless the copy resets it; the copies also skip the card textures.
  assert.match(tome, /\.pt-clone \{ position: absolute; top: 0; --c: 0; \}/);
  assert.match(tome, /\.pt-clone \.card \{ background-image: radial-gradient/);
  const { pageTurnStrips } = await import('../web/js/options.js');
  assert.deepEqual([100, 200, 300, 500].map(pageTurnStrips), [14, 11, 9, 7], 'busier pages get fewer strips');
});
