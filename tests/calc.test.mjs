// Rules math. Expected values are worked out by hand from the Pathfinder 1e rules, not copied from output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod, bonusSpells, stack, evalExpr } from '../web/js/calc.js';
import { make, calc, buff, repeat } from './helpers.mjs';

// ---------- building blocks ----------

test('ability modifiers', () => {
  assert.deepEqual([1, 7, 8, 9, 10, 11, 17, 18, 20, 30].map(mod), [-5, -2, -1, -1, 0, 0, 3, 4, 5, 10]);
});

test('bonus spells per day (Core Rulebook table 1-3)', () => {
  assert.equal(bonusSpells(4, 0), 0, 'never for cantrips');
  assert.equal(bonusSpells(4, 1), 1);
  assert.equal(bonusSpells(5, 1), 2);
  assert.equal(bonusSpells(5, 5), 1);
  assert.equal(bonusSpells(5, 6), 0);
  assert.equal(bonusSpells(9, 1), 3);
  assert.equal(bonusSpells(-1, 1), 0);
});

test('bonus stacking: same type keeps the highest, dodge/untyped/circumstance add, penalties always add', () => {
  assert.equal(stack([{ value: 2, type: 'enhancement' }, { value: 4, type: 'enhancement' }]).total, 4);
  assert.equal(stack([{ value: 1, type: 'dodge' }, { value: 1, type: 'dodge' }]).total, 2);
  assert.equal(stack([{ value: 1, type: 'untyped' }, { value: 2, type: 'untyped' }]).total, 3);
  assert.equal(stack([{ value: 2, type: 'circumstance' }, { value: 2, type: 'circumstance' }]).total, 4);
  assert.equal(stack([{ value: 2, type: 'morale' }, { value: -2, type: 'morale' }, { value: -1, type: 'morale' }]).total, -1);
  assert.deepEqual(stack([{ value: 2, type: 'deflection' }, { value: 1, type: 'luck' }]).byType, { deflection: 2, luck: 1 });
});

test('buff formulas evaluate safely', () => {
  assert.equal(evalExpr('-(1+floor(bab/4))', { bab: 8, lvl: 8 }), -3);
  assert.equal(evalExpr('2*(1+floor(bab/4))', { bab: 4, lvl: 4 }), 4);
  assert.equal(evalExpr('lvl', { bab: 0, lvl: 6 }), 6);
  assert.equal(evalExpr('alert(1)', { bab: 0, lvl: 1 }), 0, 'unknown names are rejected');
  assert.equal(evalExpr('', { bab: 0, lvl: 1 }), 0);
});

// ---------- a 4th-level human fighter ----------

const chainShirt = { name: 'Chain shirt', type: 'armor', category: 'light', bonus: 4, enh: 0, maxDex: 4, acp: -2, asf: 20, weight: 0, equipped: true };
const greatsword = { name: 'Greatsword', ability: '', ranged: false, enh: 0, misc: 0, damage: '2d6', dmgMult: '1.5', dmgMisc: 0, crit: '19-20/x2', weight: 0 };
const longsword = { name: 'Longsword', ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgMult: '', dmgMisc: 0, crit: '19-20/x2', weight: 0 };

const fighter = () => make({
  race: 'Human', raceChoice: 'str', base: { str: 15, dex: 14, con: 14 },
  levels: repeat('Fighter', 4), hp: [10, 6, 6, 6],
  armor: [structuredClone(chainShirt)], weapons: [structuredClone(greatsword), structuredClone(longsword)],
});

test('fighter 4: scores, HP, BAB, saves', () => {
  const d = calc(fighter());
  assert.equal(d.abilities.str.score, 17, '15 + 2 human');
  assert.equal(d.hp.max, 36, '10+6+6+6 + Con 2 x 4');
  assert.equal(d.bab, 4);
  assert.deepEqual([d.saves.fort.total, d.saves.ref.total, d.saves.will.total], [6, 3, 1]);
  assert.equal(d.init, 2);
});

test('fighter 4: AC, touch, flat-footed, CMB, CMD', () => {
  const d = calc(fighter());
  assert.deepEqual([d.ac.total, d.ac.touch, d.ac.flat], [16, 12, 14]);
  assert.equal(d.cmb, 7, 'BAB 4 + Str 3');
  assert.equal(d.cmd, 19, '10 + BAB 4 + Str 3 + Dex 2');
});

test('shield bonus stacks with armor, not vs touch, and both check penalties add', () => {
  const c = fighter();
  c.armor.push({ name: 'Heavy steel shield', type: 'shield', category: 'heavy', bonus: 2, enh: 1, maxDex: '', acp: -2, asf: 15, weight: 0, equipped: true });
  const d = calc(c);
  assert.deepEqual([d.ac.total, d.ac.touch, d.ac.flat], [19, 12, 17], '+4 armor, +3 shield (2 + 1 enh), Dex 2');
  assert.equal(d.acp, -4);
  assert.equal(d.asf, 35);
  c.armor[1].equipped = false;
  assert.equal(calc(c).ac.total, 16, 'unequipped shield does nothing');
});

test('fighter 4: two-handed weapon gets 1.5x Str', () => {
  const d = calc(fighter());
  assert.equal(d.weapons[0].attackText, '+7');
  assert.equal(d.weapons[0].damageText, '2d6+4', 'floor(3 x 1.5)');
  assert.equal(d.weapons[1].damageText, '1d8+3');
});

test('Power Attack scales with BAB and is 1.5x two-handed', () => {
  const d = calc(buff(fighter(), 'Power Attack'));
  assert.equal(d.weapons[0].attackText, '+5', '-2 at BAB 4');
  assert.equal(d.weapons[0].damageText, '2d6+10', 'Str 4 + PA 4 x 1.5 = 6');
  assert.equal(d.weapons[1].damageText, '1d8+7', 'one-handed: Str 3 + PA 4');
  const high = make({ base: { str: 10 }, levels: repeat('Fighter', 8), weapons: [structuredClone(longsword)] });
  assert.equal(calc(buff(high, 'Power Attack')).weapons[0].attackText, '+6/+1', 'BAB 8 + Str 1 = +9/+4, then -3 at BAB 8');
});

test('Haste: dodge AC is lost when flat-footed but kept vs touch', () => {
  const d = calc(buff(fighter(), 'Haste'));
  assert.deepEqual([d.ac.total, d.ac.touch, d.ac.flat], [17, 13, 14]);
  assert.equal(d.saves.ref.total, 4);
  assert.equal(d.weapons[0].attackText, '+8/+8', 'BAB 4 + Str 3 + Haste 1 = +8, and Haste gives one more attack at the best bonus');
  assert.equal(d.speed, 60);
});

test('Shaken: -2 attacks, saves and skill checks', () => {
  const base = calc(fighter());
  const d = calc(buff(fighter(), 'Shaken / Frightened'));
  assert.equal(d.weapons[0].attack, base.weapons[0].attack - 2);
  assert.equal(d.saves.will.total, base.saves.will.total - 2);
  assert.equal(d.skills.Climb.total, base.skills.Climb.total - 2);
});

test('iterative attacks every 5 points of BAB', () => {
  const d = calc(make({ base: { str: 10 }, raceChoice: 'dex', levels: repeat('Fighter', 11), weapons: [structuredClone(longsword)] }));
  assert.deepEqual(d.iteratives, [11, 6, 1]);
  assert.equal(d.weapons[0].attackText, '+11/+6/+1');
});

test('skills: class skill +3 only with a rank, armor check penalty applies', () => {
  const c = fighter();
  c.skills.find(s => s.name === 'Climb').ranks = 1;
  c.skills.find(s => s.name === 'Swim').ranks = 0;
  const d = calc(c);
  assert.equal(d.skills.Climb.total, 1 + 3 + 3 - 2, 'rank + class + Str - ACP');
  assert.equal(d.skills.Swim.total, 3 - 2, 'no +3 without ranks');
  assert.equal(d.skillPoints.available, 4 * (2 + 0 + 1), 'fighter 2 + Int 0 + human 1, per level');
});

// ---------- multiclass ----------

test('multiclass fighter 2 / rogue 1 adds BAB, saves and skill points per class', () => {
  const d = calc(make({ raceChoice: 'str', levels: ['Fighter', 'Fighter', 'Rogue'] }));
  assert.equal(d.bab, 2, 'fighter 2 + rogue 0');
  assert.deepEqual([d.saves.fort.base, d.saves.ref.base, d.saves.will.base], [3, 2, 0]);
  assert.equal(d.skillPoints.available, 3 + 3 + 9, 'fighter (2+1) x2 + rogue (8+1)');
  assert.ok(d.skills.Stealth.isClass && d.skills.Climb.isClass);
});

// ---------- spellcasting ----------

test('wizard 1: slots, bonus spell, school slot, DCs, concentration', () => {
  const c = make({ raceChoice: 'int', base: { int: 16 }, levels: ['Wizard'] });
  let sc = calc(c).spellcasting.Wizard;
  assert.equal(sc.cl, 1);
  assert.equal(sc.slots[0], 3);
  assert.equal(sc.slots[1], 2, '1 + bonus for Int 18');
  assert.equal(sc.slots[2], null, 'no 2nd-level spells yet');
  assert.equal(sc.dcs[0], 14);
  assert.equal(sc.dcs[1], 15);
  assert.equal(sc.concentration, 5);
  c.spellbooks.Wizard = { spells: [], used: Array(10).fill(0), extraSlot: true };
  sc = calc(c).spellcasting.Wizard;
  assert.equal(sc.slots[1], 3, 'specialist school slot');
  assert.equal(sc.slots[0], 3, 'no extra cantrip');
});

test('casting stat too low means no slots of that level', () => {
  const sc = calc(make({ raceChoice: 'str', base: { int: 10 }, levels: ['Wizard'] })).spellcasting.Wizard;
  assert.equal(sc.slots[0], 3);
  assert.equal(sc.slots[1], null, 'needs Int 11 for 1st-level spells');
});

test('sorcerer 1: unlimited cantrips, spells known', () => {
  const sc = calc(make({ raceChoice: 'cha', base: { cha: 14 }, levels: ['Sorcerer'] })).spellcasting.Sorcerer;
  assert.equal(sc.slots[0], Infinity);
  assert.equal(sc.slots[1], 4, '3 + bonus for Cha 16');
  assert.equal(sc.known[0], 4);
  assert.equal(sc.known[1], 2);
});

test('paladin 4: caster level is class level - 3, bonus spell on a 0-slot level', () => {
  const sc = calc(make({ raceChoice: 'str', base: { cha: 14 }, levels: repeat('Paladin', 4) })).spellcasting.Paladin;
  assert.equal(sc.cl, 1);
  assert.equal(sc.slots[1], 1, '0 per day + 1 bonus');
});

// ---------- size, encumbrance, damage ----------

test('small race: +1 AC and attack, -1 CMB, +4 Stealth', () => {
  const d = calc(make({ race: 'Halfling', base: { str: 12, dex: 14 }, levels: ['Rogue'], weapons: [structuredClone(longsword)] }));
  assert.equal(d.size, 'Small');
  assert.equal(d.ac.total, 10 + 3 + 1);
  assert.equal(d.cmb, 0 + 0 - 1, 'BAB 0 + Str 0 (12-2) - 1');
  assert.equal(d.weapons[0].attack, 0 + 0 + 1);
  assert.equal(d.skills.Stealth.total, 3 + 4, 'Dex 3 + size 4 (no ranks)');
});

test('medium load caps Dex, adds check penalty and slows speed', () => {
  const d = calc(make({ raceChoice: 'dex', base: { str: 10, dex: 16 }, levels: ['Rogue'],
    gear: [{ name: 'Rocks', qty: 1, weight: 40, notes: '' }] }));
  assert.equal(d.encumbrance.load, 'medium', 'Str 10 light load is 33 lb');
  assert.equal(d.maxDex, 3);
  assert.equal(d.ac.total, 13, 'Dex 4 capped at 3');
  assert.equal(d.acp, -3);
  assert.equal(d.speed, 20);
});

test('ability damage lowers the modifier, drain lowers the score', () => {
  const c = make({ raceChoice: 'dex', base: { str: 10 } });
  c.abilities.str.damage = 4;
  assert.equal(calc(c).abilities.str.mod, -2);
  c.abilities.str.damage = 0;
  c.abilities.str.drain = 2;
  assert.equal(calc(c).abilities.str.score, 8);
});

test('Haste adds one attack at the best bonus before the iteratives, and only one', () => {
  const high = make({ base: { str: 10 }, levels: repeat('Fighter', 8), weapons: [structuredClone(longsword)] });
  assert.equal(calc(high).weapons[0].attackText, '+9/+4', 'BAB 8 + Str 1 (human +2) = +9, +4');
  const hasted = calc(buff(structuredClone(high), 'Haste'));
  assert.equal(hasted.weapons[0].attackText, '+10/+10/+5', 'Haste +1 to hit: +10, the extra +10, then +5');
  const twice = buff(buff(structuredClone(high), 'Haste'), 'Haste');
  assert.equal(calc(twice).weapons[0].attacks.length, 3, 'two Hastes do not give two extra attacks');
});

test('a Haste saved before it had its extra attack gets it back when loaded', async () => {
  const { migrate } = await import('../web/js/model.js');
  const c = make({ levels: repeat('Fighter', 6) });
  c.modifiers.push({ name: 'Haste', active: true, note: '', effects: [{ target: 'attack', value: 1, type: 'untyped' }] });
  c.modifiers.push({ name: 'Power Attack', active: true, note: '', effects: [{ target: 'melee', value: '-(1+floor(bab/4))', type: 'untyped' }, { target: 'meleeDamage', value: '2*(1+floor(bab/4))', type: 'untyped' }] });
  migrate(c);
  assert.ok(c.modifiers[0].effects.some(e => e.target === 'extraAttack'));
  assert.equal(c.modifiers[1].effects[1].scale, true, 'its damage scales two-handed again');
});

test('the damage breakdown names Power Attack and the two-handed change', () => {
  const c = buff(make({ base: { str: 10 }, levels: repeat('Fighter', 8), weapons: [{ ...structuredClone(longsword), dmgMult: 1.5 }] }), 'Power Attack');
  const d = calc(c), parts = d.bd['weapons.0.damage'];
  // BAB 8: Power Attack +2 x (1 + 2) = +6, x1.5 two-handed = +9; Str 12 is +1 x1.5 = +1 (floor)
  assert.equal(parts.find(p => p.label === 'Power Attack').value, 6);
  assert.ok(parts.find(p => p.label === 'Power Attack').buff, 'marked as a buff so the roll window lists it');
  assert.equal(parts.find(p => /Two-handed/.test(p.label)).value, 3, '6 x 1.5 = 9, so +3 more');
  assert.equal(parts.reduce((n, p) => n + p.value, 0), d.weapons[0].dmgBonus, 'the parts add up to the damage bonus');
});

test('every buff preset uses a real target and bonus type, and has a unique name', async () => {
  const { BUFF_PRESETS, BONUS_TYPES, MOD_TARGETS } = await import('../web/js/data.js');
  const names = BUFF_PRESETS.map(p => p.name);
  assert.equal(new Set(names).size, names.length, 'a name picks the preset, so names cannot repeat');
  for (const p of BUFF_PRESETS) for (const e of p.effects) {
    assert.ok(MOD_TARGETS[e.target], `${p.name}: unknown target ${e.target}`);
    assert.ok(BONUS_TYPES.includes(e.type), `${p.name}: unknown bonus type ${e.type}`);
  }
});

test('Divine Favor is +1 luck per 3 levels, min 1 and max 3, and luck does not stack with Prayer', () => {
  const luck = (lv, ...buffs) => {
    const c = make({ base: { str: 10 }, levels: repeat('Fighter', lv), weapons: [structuredClone(longsword)] });
    for (const b of buffs) buff(c, b);
    return calc(c).bd['weapons.0.attack'].filter(p => /luck/.test(p.label) && !p.ignored).reduce((n, p) => n + p.value, 0);
  };
  assert.equal(luck(1, 'Divine Favor'), 1, 'floor(1/3) = 0, raised to the minimum +1');
  assert.equal(luck(6, 'Divine Favor'), 2, 'floor(6/3) = 2');
  assert.equal(luck(12, 'Divine Favor'), 3, 'floor(12/3) = 4, capped at +3');
  assert.equal(luck(6, 'Divine Favor', 'Prayer (ally)'), 2, 'both are luck bonuses: only the +2 counts');
});

test('the higher rages and bard songs are bigger than the first ones', () => {
  const str = name => calc(buff(make({ base: { str: 10 }, levels: repeat('Fighter', 2) }), name)).abilities.str.score;
  assert.deepEqual([str('Rage'), str('Greater Rage'), str('Mighty Rage')], [16, 18, 20], 'Str 10 + human 2 = 12, then +4, +6, +8');
});
