import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollTerms, rollMessage, rollMany, bonusText, CRIT, FAIL } from '../web/js/dice.js';

// rng that yields the given die faces in order (face f on an s-sided die is (f - 1) / s)
const faces = (list, sides) => { let i = 0; return () => (list[i++] - 1) / sides; };

test('parses like Tad: groups, flat modifiers, repeat, adv/dis', () => {
  assert.deepEqual(parseDice('2d6-d4+3').terms, [[2, 6], [-1, 4], [3, 0]]);
  const p = parseDice('3xadv d20+5');
  assert.deepEqual([p.terms, p.repeat, p.adv, p.dis], [[[1, 20], [5, 0]], 3, true, false]);
  assert.equal(parseDice('dis d20').dis, true);
  assert.deepEqual([parseDice('adv dis d20').adv, parseDice('adv dis d20').dis], [false, false], 'both cancel');
});

test('rejects what Tad would choke on', () => {
  assert.throws(() => parseDice('d0'), /at least 1 side/);
  assert.throws(() => parseDice('potato'), /No dice/);
  assert.throws(() => parseDice('21xd6'), /Repeat/);
  assert.throws(() => parseDice('0xd6'), /Repeat/);
  assert.throws(() => parseDice('500d6'), /dice/);
});

test('2d6-d4+3 with faces 4, 2, 1 totals 8 (the worked example in Tad\'s API notes)', () => {
  const r = rollTerms(parseDice('2d6-d4+3').terms, (() => { const q = [[4, 6], [2, 6], [1, 4]]; let i = 0; return () => { const [f, s] = q[i++]; return (f - 1) / s; }; })());
  assert.deepEqual(r.raw, [4, 2, -1]);
  assert.equal(r.modifier, 3);
  assert.equal(r.total, 8, '4 + 2 - 1 + 3');
});

test('message layout matches Tad', () => {
  const m = rollMessage('Alex', '2d6+5', { rng: faces([4, 2], 6) });
  assert.equal(m.text, '**Alex** rolled 2d6+5\nRoll result: [4, 2] +5 **Total 11**');
  assert.deepEqual(m.totals, [11]);
});

test('d20 crits and fumbles are marked, labels are added', () => {
  assert.ok(rollMessage('A', 'd20+1', { rng: faces([20], 20) }).text.includes(`[20 ${CRIT}] +1 **Total 21**`));
  assert.ok(rollMessage('A', 'd20', { rng: faces([1], 20) }).text.includes(`[1 ${FAIL}]`));
  assert.match(rollMessage('A', 'd20+7', { label: 'Fortitude save', rng: faces([5], 20) }).text, /rolled d20\+7 \(Fortitude save\)/);
});

test('advantage keeps the higher whole roll, disadvantage the lower, ties keep the first', () => {
  const adv = rollMessage('Alex', 'adv d20+5', { rng: faces([7, 16], 20) });
  assert.equal(adv.text, '**Alex** rolled adv d20+5\nRoll 1: [7] • Roll 2: [16]\nHighest roll: [16] +5 **Total 21**');
  assert.deepEqual(rollMessage('A', 'dis d20+5', { rng: faces([7, 16], 20) }).totals, [12], '7 + 5');
});

test('repeats are numbered and joined with a blank line', () => {
  const m = rollMessage('Alex', '2xd6', { rng: faces([3, 5], 6) });
  assert.equal(m.text, '**Alex** rolled 2xd6\nRoll result: [3] **Total 3**'.replace('**Alex** rolled', '**Roll 1/2:** **Alex** rolled') + '\n\n**Roll 2/2:** **Alex** rolled 2xd6\nRoll result: [5] **Total 5**');
});

test('a full attack rolls every iterative in one message; bonusText signs numbers', () => {
  const m = rollMany('Bo', [{ expr: 'd20+11', label: 'Sword attack 1/2' }, { expr: 'd20+6', label: 'Sword attack 2/2' }], { rng: faces([10, 3], 20) });
  assert.deepEqual(m.totals, [21, 9]);
  assert.match(m.text, /Sword attack 1\/2[\s\S]*\n\n[\s\S]*Sword attack 2\/2/);
  assert.deepEqual([bonusText(7), bonusText(-1), bonusText(0), bonusText(undefined)], ['+7', '-1', '', '']);
});

test('spell dice guess scales with caster level and respects the cap', async () => {
  const { guessSpellDice } = await import('../web/js/dice.js');
  assert.equal(guessSpellDice('A burst deals 1d6 points of fire damage per caster level (maximum 10d6).', 7), '7d6');
  assert.equal(guessSpellDice('deals 1d6 points of fire damage per caster level (maximum 10d6).', 14), '10d6', 'capped');
  assert.equal(guessSpellDice('Deals 1d6 damage per two caster levels (max 5d6).', 9), '4d6', 'half caster level, rounded down');
  assert.equal(guessSpellDice('heals 1d8 points of damage + 1 per caster level (max +5).', 3), '1d8+3');
  assert.equal(guessSpellDice('heals 1d8 points of damage + 1 per caster level (max +5).', 12), '1d8+5');
  assert.equal(guessSpellDice('A flat 2d4 hit with no scaling.', 9), '2d4');
  assert.equal(guessSpellDice('No dice in this one.', 9), '');
});

test('spell dice guess reads the compendium shorthand (summaries from the real data)', async () => {
  const { guessSpellDice: g } = await import('../web/js/dice.js');
  const cases = [
    ['Delayed Blast Fireball', '1d6/level fire damage; you can postpone blast for up to 5 rounds.', 9, '9d6'],
    ['Searing Light', 'Ray deals 1d8/two levels damage (more against undead).', 9, '4d8'],
    ['Shocking Grasp', 'Touch delivers 1d6/level electricity damage (max 5d6).', 12, '5d6'],
    ['Burst Bonds', '1d6 damage/level (max 5d6) to restraints.', 3, '3d6'],
    ['Rebuke', 'Foes take 1d8 damage/two caster levels (max 5d8).', 7, '3d8'],
    ['Parchment Swarm', 'Shredded parchment deals 1d6 points of damage per level, and has a spell effect.', 6, '6d6'],
    ['Cure Light Wounds', 'Cures 1d8 damage + 1/level (max +5).', 3, '1d8+3'],
    ['Cure Light Wounds, capped', 'Cures 1d8 damage + 1/level (max +5).', 11, '1d8+5'],
    ['Cure Moderate Wounds', 'Cures 2d8 damage +1/level (max. +10).', 6, '2d8+6'],
    ['Inflict Moderate Wounds', 'Touch attack, 2d8 damage +1/level (max +10).', 12, '2d8+10'],
    ['Cure Light Wounds, Mass', 'Cures 1d8 damage + 1/level, affects 1 subject/level.', 9, '1d8+9'],
    ['Thorn Body', 'Your attackers take 1d6 +1 damage/level.', 5, '1d6+5'],
    ['Fire Trap', 'Opened object deals 1d4 damage +1/level.', 8, '1d4+8'],
    ['Produce Flame', '1d6 damage + 1/level, touch or thrown.', 4, '1d6+4'],
    ['Unholy Blight', 'Harms and sickens good creatures (1d8 damage/2 levels).', 9, '4d8'],
    ['Scorching Ray (rays are not a bonus)', 'Ranged touch attack deals 4d6 fire damage, +1 ray/four levels (max 3).', 11, '4d6'],
    ['Sunburst', 'Blinds all within 10 ft., deals 6d6 damage.', 15, '6d6'],
    ['Spike Stones', 'Creatures in area take 1d8 damage, may also be slowed.', 9, '1d8'],
  ];
  for (const [name, text, cl, want] of cases) assert.equal(g(text, cl), want, `${name} at caster level ${cl}`);
  assert.equal(g('Cure Light Wounds', 5), '', 'no dice in the text means no guess');
});

test('situational modifiers go on d20 rolls only', async () => {
  const { addMods, modsLabel, MOD_PRESETS } = await import('../web/js/dice.js');
  assert.equal(addMods('d20+7', -4), 'd20+7-4');
  assert.equal(addMods('d20', 2), 'd20+2');
  assert.equal(addMods('d20+7', 0), 'd20+7', 'nothing to add');
  assert.equal(addMods('2d6+3', -4), '2d6+3', 'damage and other dice are left alone');
  assert.deepEqual(parseDice(addMods('d20+7', -4)).terms, [[1, 20], [7, 0], [-4, 0]], 'Tad can parse the result');
  assert.equal(modsLabel([{ n: -4, label: 'not proficient' }, { n: -2, label: '2nd range increment' }]), '(-4 not proficient, -2 2nd range increment)');
  const range = MOD_PRESETS.filter(m => m.group === 'range').map(m => m.n);
  assert.deepEqual(range, [-2, -4, -6, -8], 'each range increment past the first is -2 more (Pathfinder core rules)');
  assert.equal(MOD_PRESETS.find(m => m.label === 'not proficient').n, -4, 'weapon non-proficiency is -4 to hit');
});

test('rolls are posted under the character and what they are for', async () => {
  const { sendName } = await import('../web/js/dice.js');
  assert.equal(sendName('Fumu', 'Stealth'), 'Fumu · Stealth');
  assert.equal(sendName('Fumu', ''), 'Fumu');
  assert.equal(sendName('Fumu', 'Longbow attack (-4 not proficient, -2 2nd range increment)'), 'Fumu · Longbow attack (-4 not proficient, -2 2nd range increment)');
  assert.equal(sendName('Fumu', 'x'.repeat(200)).length, 80, 'Discord allows 80 characters');
});

test('the roll window offers attack modifiers only on attacks', async () => {
  const { presetsFor, MOD_PRESETS } = await import('../web/js/dice.js');
  const names = list => list.map(m => m.label);
  assert.ok(names(presetsFor(true)).includes('not proficient') && names(presetsFor(true)).includes('2nd range increment'));
  assert.ok(!names(presetsFor(false)).includes('not proficient'), 'a saving throw is not affected by weapon proficiency');
  assert.ok(names(presetsFor(false)).includes('aid another'), 'aid another applies to saves and skills too');
  assert.ok(!names(MOD_PRESETS).some(n => /charging|shaken|sickened|fighting defensively/.test(n)), 'conditions kept on the Buffs & Conditions tab are not repeated');
  assert.ok(['flanking', 'you are prone', 'dazzled'].every(n => names(presetsFor(true)).includes(n)), 'one-roll situations live in the roll window');
  assert.ok(MOD_PRESETS.every(m => m.n !== 0));
});

test('spell rolls get only the modifiers that apply to spells', async () => {
  const { presetsFor } = await import('../web/js/dice.js');
  const names = list => list.map(m => m.label);
  const ranged = names(presetsFor(true, { kind: 'ranged' })), melee = names(presetsFor(true, { kind: 'melee' }));
  for (const w of ['not proficient', '2nd range increment', 'improvised weapon', 'two-weapon: main hand', 'strong wind (ranged)']) {
    assert.ok(!ranged.includes(w) && !melee.includes(w), w + ' is for weapons, not spells');
  }
  assert.ok(ranged.includes('target prone (ranged)') && ranged.includes('firing into melee') && ranged.includes('dazzled') && ranged.includes('attacker unseen'));
  assert.ok(!ranged.includes('flanking') && !ranged.includes('higher ground'), 'flanking is a melee bonus');
  assert.ok(melee.includes('flanking') && melee.includes('target prone (melee)') && !melee.includes('target prone (ranged)'));
  assert.ok(!names(presetsFor(false, { kind: null })).includes('dazzled'), 'a concentration check is not an attack');
  assert.ok(names(presetsFor(false, { kind: null })).includes('aid another'));
});

test('sneak attack dice follow the class tables: rogue and ninja 1d6 at 1st and one more every odd level, slayer 1d6 at 3rd and one more every 3 levels; investigator studied strike from 4th', async () => {
  const { sneakDice, studiedDice } = await import('../web/js/dice.js');
  assert.equal(sneakDice({ Rogue: 1 }), 1);
  assert.equal(sneakDice({ Rogue: 5 }), 3, 'ceil(5/2)');
  assert.equal(sneakDice({ Rogue: 6 }), 3);
  assert.equal(sneakDice({ Ninja: 1 }), 1, 'the class table has +1d6 at 1st level');
  assert.equal(sneakDice({ Ninja: 5 }), 3, 'ceil(5/2)');
  assert.equal(sneakDice({ Rogue: 3, Ninja: 4 }), 2 + 2, 'ceil(3/2) + ceil(4/2)');
  assert.deepEqual([2, 3, 5, 6, 9, 18].map(l => sneakDice({ Slayer: l })), [0, 1, 1, 2, 3, 6], 'slayer: +1d6 at 3rd, 6th, 9th ... 18th');
  assert.deepEqual([3, 4, 5, 6, 8, 20].map(l => studiedDice({ Investigator: l })), [0, 1, 1, 2, 3, 9], 'studied strike: 1d6 at 4th, 2d6 at 6th ... 9d6 at 20th');
  assert.equal(sneakDice({ Fighter: 9 }), 0);
});

test('the damage window offers what the character can use: class abilities only with the class, Vital Strike by BAB', async () => {
  const { damagePresets } = await import('../web/js/dice.js');
  const labels = (lv, bab) => damagePresets(lv, bab).map(p => p.label + (p.dice ? ' ' + p.dice : p.n ? ' ' + p.n : ''));
  assert.deepEqual(labels({ Fighter: 4 }, 4).filter(l => !/favored/.test(l)), [], 'a fighter has none of these yet');
  assert.ok(labels({ Rogue: 5 }, 3).includes('sneak attack 3d6'));
  assert.ok(labels({ Slayer: 6 }, 6).includes('sneak attack 2d6'));
  assert.ok(labels({ Investigator: 6 }, 4).includes('studied strike 2d6'));
  assert.ok(labels({ Paladin: 7 }, 7).includes('smite evil 7'), 'paladin level in damage');
  assert.ok(labels({ Cavalier: 4 }, 4).includes('challenge 4'));
  const vital = bab => damagePresets({}, bab).filter(p => p.extraBase).map(p => p.extraBase);
  assert.deepEqual([vital(5), vital(6), vital(11), vital(16)], [[], [1], [1, 2], [1, 2, 3]]);
  assert.equal(damagePresets({}, 0).filter(p => p.group === 'favored').length, 4, '+2, +4, +6, +8');
});

test('typed damage modifiers: a number or dice, nothing else', async () => {
  const { parseDamageMod } = await import('../web/js/dice.js');
  assert.deepEqual(parseDamageMod('4'), { n: 4 });
  assert.deepEqual(parseDamageMod('-2'), { n: -2 });
  assert.deepEqual(parseDamageMod(' 2d6 '), { dice: '2d6' });
  assert.deepEqual(parseDamageMod('+1D8'), { dice: '1d8' });
  assert.deepEqual(parseDamageMod('-1d4'), { dice: '-1d4' });
  assert.equal(parseDamageMod('lots'), null);
  assert.equal(parseDamageMod(''), null);
});

test('damage modifiers go on the end of the expression; Vital Strike repeats the weapon dice; the result still rolls', async () => {
  const { addDamageMods, damageLabel, parseDice } = await import('../web/js/dice.js');
  const mods = [{ label: 'sneak attack', dice: '2d6' }, { label: 'smite evil', n: 6 }, { label: 'weakened', n: -1 }];
  assert.equal(addDamageMods('1d8+5', mods, '1d8'), '1d8+5+2d6+6-1');
  assert.equal(addDamageMods('1d8+5', [{ label: 'Vital Strike', extraBase: 1 }], '1d8'), '1d8+5+1d8');
  assert.equal(addDamageMods('2d6+4', [{ label: 'Improved Vital Strike', extraBase: 2 }], '2d6'), '2d6+4+4d6', 'two more copies of 2d6');
  assert.equal(addDamageMods('1d8+5', [], '1d8'), '1d8+5');
  assert.equal(damageLabel(mods), '(+2d6 sneak attack, +6 smite evil, -1 weakened)');
  assert.doesNotThrow(() => parseDice(addDamageMods('1d8+5+1d6', mods, '1d8')));
});

test('on a critical hit smite, challenge, favored enemy and Vital Strike dice are multiplied; sneak attack, studied strike and typed bonuses are not', async () => {
  const { damagePresets, addDamageMods, damageLabel } = await import('../web/js/dice.js');
  const crit = { label: 'smite evil', n: 7, crit: true }, sneak = { label: 'sneak attack', dice: '3d6' }, typed = { label: 'extra', n: 2 };
  assert.equal(addDamageMods('1d8+5', [crit, sneak, typed], '1d8', 1), '1d8+5+7+3d6+2', 'a normal hit');
  assert.equal(addDamageMods('2d8+10', [crit, sneak, typed], '1d8', 2), '2d8+10+14+3d6+2', 'x2: smite 7 becomes 14');
  assert.equal(addDamageMods('3d8+15', [crit], '1d8', 3), '3d8+15+21', 'x3: 7 becomes 21');
  assert.equal(addDamageMods('2d8+10', [{ label: 'Vital Strike', extraBase: 1, crit: true }], '1d8', 2), '2d8+10+2d8', 'the extra weapon dice are doubled too');
  assert.equal(addDamageMods('2d8+10', [{ label: 'Improved Vital Strike', extraBase: 2, crit: true }], '1d8', 2), '2d8+10+4d8', 'two extra copies, doubled');
  assert.equal(damageLabel([crit, sneak], 2), '(+14 smite evil, +3d6 sneak attack)');
  const flagged = damagePresets({ Paladin: 7, Rogue: 5 }, 11).map(p => [p.label, !!p.crit]);
  assert.deepEqual(flagged.filter(([l]) => /smite|sneak|Vital/.test(l)), [['sneak attack', false], ['smite evil', true], ['Vital Strike', true], ['Improved Vital Strike', true]]);
});

test('two-weapon fighting presets: -6/-10, -4/-8 with a light off hand, and the feat brings them to -4/-4 and -2/-2', async () => {
  const { MOD_PRESETS, adjustPreset } = await import('../web/js/dice.js');
  const f = l => MOD_PRESETS.find(m => m.label === l);
  const got = (l, twf) => adjustPreset(f(l), twf).n;
  assert.deepEqual(['two-weapon: main hand', 'two-weapon: off hand', 'two-weapon (light off-hand): main hand', 'two-weapon (light off-hand): off hand'].map(l => got(l, false)), [-6, -10, -4, -8]);
  assert.deepEqual(['two-weapon: main hand', 'two-weapon: off hand', 'two-weapon (light off-hand): main hand', 'two-weapon (light off-hand): off hand'].map(l => got(l, true)), [-4, -4, -2, -2]);
  assert.equal(adjustPreset(f('flanking'), true).n, 2, 'other presets are untouched');
});
