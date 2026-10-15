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

test('ignoring encumbrance removes the Dex cap, check penalty and speed loss, but still counts the weight', () => {
  const d = calc(make({ raceChoice: 'dex', base: { str: 10, dex: 16 }, levels: ['Rogue'], noEncumbrance: true,
    gear: [{ name: 'Rocks', qty: 1, weight: 40, notes: '' }] }));
  assert.equal(d.encumbrance.weight, 40, 'the 40 lb are still added up');
  assert.equal(d.encumbrance.load, 'light');
  assert.equal(d.ac.total, 10 + 4, 'Dex 4 is not capped');
  assert.equal(d.acp, 0);
  assert.equal(d.speed, 30);
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

test('presets are listed A to Z inside each group, with numbers in order', async () => {
  const { BUFF_PRESETS, BUFF_GROUPS, presetsIn } = await import('../web/js/data.js');
  assert.ok(BUFF_PRESETS.every(p => BUFF_GROUPS.includes(p.group)), 'every preset is in a listed group, so none is hidden');
  assert.equal(presetsIn('Spell').length + presetsIn('Class').length + presetsIn('Feat').length + presetsIn('Condition').length + presetsIn('Combat option').length, BUFF_PRESETS.length);
  const names = presetsIn('Class').map(p => p.name);
  assert.deepEqual(names.filter(n => n.startsWith('Inspire Courage')), ['Inspire Courage +1', 'Inspire Courage +2', 'Inspire Courage +3', 'Inspire Courage +4']);
  for (const g of BUFF_GROUPS) {
    const n = presetsIn(g).map(p => p.name);
    assert.deepEqual(n, [...n].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), g + ' is in order');
  }
});

test('feat, cover and condition presets change the numbers they say', () => {
  const base = () => make({ base: { con: 10, dex: 10 }, levels: repeat('Fighter', 6), hp: [10, 6, 6, 6, 6, 6] });
  const d0 = calc(base());
  assert.equal(calc(buff(base(), 'Dodge')).ac.total - d0.ac.total, 1, '+1 dodge to AC');
  assert.equal(calc(buff(base(), 'Toughness')).hp.max - d0.hp.max, 6, 'Toughness at 6 Hit Dice is +6 (more than 3)');
  assert.equal(calc(buff(base(), 'Great Fortitude')).saves.fort.total - d0.saves.fort.total, 2);
  assert.equal(calc(buff(base(), 'Improved Initiative')).init - d0.init, 4);
  assert.equal(calc(buff(base(), 'Cover (+4 AC)')).ac.total - d0.ac.total, 4);
  assert.equal(d0.ac.total - calc(buff(base(), 'Blinded')).ac.total, 2, 'blinded is -2 AC');
  const one = calc(buff(base(), 'Negative Level (-1)'));
  assert.equal(d0.saves.will.total - one.saves.will.total, 1, 'one negative level is -1 on saves');
  assert.equal(d0.melee - one.melee, 1, 'and -1 on attacks');
});

// ---------- spell-like abilities ----------

test('spell-like abilities: caster level is the character level, the DC uses Charisma unless set, uses are counted per day', () => {
  const c = make({ base: { str: 10, cha: 14, int: 12 }, levels: ['Fighter', 'Fighter', 'Fighter', 'Fighter', 'Fighter'], raceChoice: 'cha',
    spellLikes: [
      { name: 'Dimension Door', level: 4, perDay: 3, used: 1, cl: '', ability: 'cha' },
      { name: 'Detect Magic', level: 0, perDay: '', used: 0, cl: 9, ability: 'int' },
    ] });
  const d = calc(c);
  const [dd, dm] = d.spellLikes;
  assert.equal(d.abilities.cha.mod, 3, 'Human Cha 14 + 2 = 16');
  assert.deepEqual([dd.cl, dd.mod, dd.dc, dd.concentration], [5, 3, 10 + 4 + 3, 5 + 3], 'DC 10 + level 4 + Cha 3 = 17; concentration = CL 5 + Cha 3');
  assert.deepEqual([dd.max, dd.left, dd.unlimited], [3, 2, false], '3 per day with 1 used leaves 2');
  assert.deepEqual([dm.cl, dm.mod, dm.dc, dm.unlimited, dm.left], [9, 1, 10 + 0 + 1, true, Infinity], 'Int 12 is +1; at will never runs out; the CL 9 override wins');
  assert.equal(d.bd['spellLikes.0.cl'].reduce((n, p) => n + p.value, 0), 5);
});

test('old saves get an empty note on every skill, and a typed note is kept', async () => {
  const { migrate } = await import('../web/js/model.js');
  const c = make();
  for (const s of c.skills) delete s.notes;
  c.skills[0].notes = '+2 vs. traps';
  const m = migrate(c);
  assert.equal(m.skills[0].notes, '+2 vs. traps');
  assert.ok(m.skills.slice(1).every(s => s.notes === ''));
});

test('weapon damage stat: a ranged weapon adds nothing on auto, and can be set to Str (thrown, bows), Dex or none', () => {
  const sword = { name: 'Sling', ranged: true, damage: '1d4', enh: 0, misc: 0, dmgMisc: 0, dmgMult: '', crit: '×2', fx: [] };
  const mk = extra => calc(make({ raceChoice: 'con', base: { str: 16, dex: 14 }, levels: ['Fighter'], weapons: [{ ...sword, ...extra }] })).weapons[0];
  assert.equal(mk({}).dmgBonus, 0, 'auto: ranged adds no ability modifier');
  assert.equal(mk({ dmgAbility: 'str' }).dmgBonus, 3, 'Str 16 is +3, once');
  assert.equal(mk({ dmgAbility: 'dex' }).dmgBonus, 2, 'Dex 14 is +2');
  assert.equal(mk({ dmgAbility: 'str', dmgMult: '0.5' }).dmgBonus, 1, 'half of +3 rounds down');
  assert.equal(mk({ dmgAbility: 'none' }).dmgBonus, 0);
  const melee = { ...sword, name: 'Sword', ranged: false };
  assert.equal(calc(make({ raceChoice: 'con', base: { str: 16, dex: 14 }, levels: ['Fighter'], weapons: [melee] })).weapons[0].dmgBonus, 3, 'melee auto is Str');
  assert.equal(calc(make({ raceChoice: 'con', base: { str: 16, dex: 14 }, levels: ['Fighter'], weapons: [{ ...melee, dmgAbility: 'none' }] })).weapons[0].dmgBonus, 0, 'melee can be set to none');
});

test('old weapons get a damage stat of auto', async () => {
  const { migrate } = await import('../web/js/model.js');
  const c = make({ weapons: [{ name: 'x' }] });
  assert.equal(migrate(c).weapons[0].dmgAbility, '');
});

test('CMD counts the -2 AC penalty from rage, so a higher Strength from rage still adds up', () => {
  const c = make({ race: 'Custom', base: { str: 18, dex: 14 }, levels: Array(7).fill('Fighter') });
  const calm = calc(c);
  assert.equal(calm.cmd, 23, '10 + BAB 7 + Str 4 (18) + Dex 2 (14)');
  buff(c, 'Rage');
  const raging = calc(c);
  assert.equal(raging.abilities.str.mod, 6, 'rage +4 Str: 22 is a +6 modifier');
  assert.equal(raging.cmd, 23, '10 + 7 + Str 6 + Dex 2 - 2 (rage penalty to AC also applies to CMD) = 23: the +2 from Strength and the -2 cancel');
  const sum = 10 + raging.bd.cmd.reduce((s, p) => s + p.value, 0);
  assert.equal(sum, raging.cmd, 'the listed parts add up to the CMD');
  assert.ok(raging.bd.cmd.some(p => /Rage/.test(p.label) && p.value === -2), 'and the penalty is named in them');
  assert.ok(!calm.bd.cmd.some(p => /Rage/.test(p.label)), 'no rage, no penalty');
});
