import test from 'node:test';
import assert from 'node:assert/strict';
import { tipText } from '../web/js/rolltip.js';

test('the hover text lists every part with its sign, then how to roll', () => {
  const t = tipText('Fortitude save', 8, [{ label: 'Base save (class levels)', value: 5 }, { label: 'Con modifier', value: 2 }, { label: 'Resistance (resistance)', value: 1 }], 'Click to roll d20+8');
  assert.equal(t, 'Fortitude save +8\n+5  Base save (class levels)\n+2  Con modifier\n+1  Resistance (resistance)\nClick to roll d20+8');
});

test('penalties use a real minus sign and zero parts are skipped', () => {
  const t = tipText('Longsword attack', 4, [{ label: 'Base attack bonus', value: 6 }, { label: 'Nothing', value: 0 }, { label: 'Power Attack', value: -2 }], '');
  assert.equal(t, 'Longsword attack +4\n+6  Base attack bonus\n\u22122  Power Attack');
  assert.equal(tipText('Penalty', -1, [{ label: 'Shaken', value: -1 }]), 'Penalty \u22121\n\u22121  Shaken');
});

test('a part list that does not cover the total shows the rest as other bonuses; with no list the total stands alone', () => {
  assert.equal(tipText('Perception', 7, [{ label: 'Ranks', value: 4 }, { label: 'Wis modifier', value: 1 }], 'Click to roll d20+7'), 'Perception +7\n+4  Ranks\n+1  Wis modifier\n+2  Other bonuses\nClick to roll d20+7');
  assert.equal(tipText('Initiative', 3, undefined, 'Click to roll d20+3'), 'Initiative +3\nClick to roll d20+3');
});
