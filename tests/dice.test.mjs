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
