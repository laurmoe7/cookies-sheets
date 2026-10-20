// Rules math. Expected values are worked out by hand from the Pathfinder 1e rules, not copied from output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod, bonusSpells, stack, evalExpr, compute } from '../web/js/calc.js';
import { make, calc, buff, repeat, classesByName } from './helpers.mjs';

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

test('every level gives at least 1 hit point, whatever the Con penalty', () => {
  // Core Rulebook: a Constitution penalty can never take a level's hit points below 1.
  const c = make({ base: { con: 6 }, levels: repeat('Wizard', 3), hp: [6, 1, 3] });
  assert.equal(calc(c).hp.max, 6, 'Con 6 is -2 per level: 6-2 = 4, 1-2 = -1 -> 1, 3-2 = 1; 4 + 1 + 1 = 6');
});

test('flat-footed CMD loses a Dex bonus but keeps a Dex penalty', () => {
  const clumsy = calc(make({ raceChoice: 'wis', base: { str: 10, dex: 8 }, levels: ['Fighter'] }));
  assert.equal(clumsy.cmd, 10, '10 + BAB 1 + Str 0 + Dex -1');
  assert.equal(clumsy.cmdFlat, 10, 'flat-footed: no Dex bonus to lose, the -1 stays');
  const deft = calc(make({ raceChoice: 'wis', base: { str: 10, dex: 14 }, levels: ['Fighter'] }));
  assert.equal(deft.cmdFlat, 11, '10 + BAB 1 + Str 0, the Dex +2 is lost');
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

test('Toughness feat adds max(3, Hit Dice) HP, and is not counted twice with the buff preset', () => {
  const c = fighter();
  c.feats.push({ name: 'Toughness', sub: '', notes: '' });
  assert.equal(calc(c).hp.max, 40, '36 + max(3, 4 HD) = 40');
});

test('Toughness feat plus the Toughness buff counts once', () => {
  const c = buff(fighter(), 'Toughness');
  c.feats.push({ name: 'Toughness', sub: '', notes: '' });
  assert.equal(calc(c).hp.max, 40, 'still 36 + 4');
});

const withFeat = (name, sub = '') => { const c = fighter(); c.feats.push({ name, sub, notes: '' }); return c; };

test('passive feats on the Feats list apply by themselves', () => {
  const base = calc(fighter());
  const at = (n, f) => assert.equal(f(calc(withFeat(n))) - f(base), n === 'Dodge' ? 1 : n === 'Improved Initiative' ? 4 : 2, n);
  at('Dodge', d => d.ac.total);
  at('Great Fortitude', d => d.saves.fort.total);
  at('Iron Will', d => d.saves.will.total);
  at('Lightning Reflexes', d => d.saves.ref.total);
  at('Improved Initiative', d => d.init);
});

test('a feat and the same-named buff count once', () => {
  const c = buff(withFeat('Iron Will'), 'Iron Will');
  assert.equal(calc(c).saves.will.total - calc(fighter()).saves.will.total, 2, '+2 once');
});

test('skill feats: +2 to both skills, +4 with 10 ranks; Skill Focus +3 / +6', () => {
  const skill = (c, n) => { const s = c.skills.find(x => x.name === n); return s; };
  const c0 = fighter(), cf = withFeat('Athletic');
  const base = calc(c0).skills[Object.keys(calc(c0).skills).find(k => k.startsWith('Climb') || k.toLowerCase().includes('climb'))];
  const got = calc(cf).skills[Object.keys(calc(cf).skills).find(k => k.toLowerCase().includes('climb'))];
  assert.equal(got.total - base.total, 2, 'Athletic: +2 Climb');
  const cs = withFeat('Skill Focus', 'Climb');
  skill(cs, 'Climb').ranks = 10; skill(c0, 'Climb').ranks = 10;
  const k = o => o.skills[Object.keys(o.skills).find(x => x.toLowerCase().includes('climb'))].total;
  assert.equal(k(calc(cs)) - k(calc(c0)), 6, 'Skill Focus: +3 doubled at 10 ranks');
});

const withTrait = (name, extra = {}) => { const c = fighter(); c.traits.push({ name, sub: '', notes: '', ...extra }); return c; };
const skillTotal = (d, n) => d.skills[Object.keys(d.skills).find(k => k.toLowerCase().includes(n.toLowerCase()))].total;

test('traits with an always-on bonus apply: Reactionary +2 initiative, Resilient +1 Fortitude, Bully +1 Intimidate and class skill', () => {
  const base = calc(fighter());
  assert.equal(calc(withTrait('Reactionary')).init - base.init, 2);
  assert.equal(calc(withTrait('Resilient')).saves.fort.total - base.saves.fort.total, 1);
  assert.equal(calc(withTrait('Resilient')).saves.ref.total, base.saves.ref.total, 'only Fortitude');
  // Intimidate with 2 ranks: +1 trait, and the class-skill +3 if it was not one already (a fighter has Intimidate as a class skill, so only the +1 shows)
  const c0 = fighter(), c1 = withTrait('Bully');
  c0.skills.find(s => s.name === 'Perception').ranks = 2; c1.skills.find(s => s.name === 'Perception').ranks = 2;
  const c2 = withTrait('Seeker'); c2.skills.find(s => s.name === 'Perception').ranks = 2;
  assert.equal(skillTotal(calc(c2), 'Perception') - skillTotal(calc(c0), 'Perception'), 1 + 3, 'Seeker: +1 trait, and Perception becomes a class skill (+3 with a rank in it); fighter does not have it');
});

test('trait bonuses are one type: two +1 Fortitude traits give +1, Resilient and a +2 racial bonus do not clash', () => {
  const c = withTrait('Resilient'); c.traits.push({ name: 'Life of Toil' });
  assert.equal(calc(c).saves.fort.total - calc(fighter()).saves.fort.total, 1, 'same type, highest only');
});

test('racial bonuses: a halfling gets +1 on all saves and +2 Perception; an alternate trait that replaces Keen Senses turns the +2 off', () => {
  const mk = (extra) => { const c = fighter(); c.race = 'Halfling'; c.raceChoice = ''; Object.assign(c, extra); return c; };
  const plain = fighter(); plain.race = 'Halfling';
  const withOut = calc(Object.assign(fighter(), { race: 'Human' }));
  const h = calc(mk({}));
  assert.equal(h.saves.will.total - withOut.saves.will.total, 1, 'Halfling Luck');
  const rep = mk({ traits: [{ name: 'Wanderer', replaces: ['keen senses'] }] });
  assert.equal(skillTotal(calc(mk({})), 'Perception') - skillTotal(calc(rep), 'Perception'), 2, 'Keen Senses +2 gone when replaced');
});

test('Weapon Focus +1 attack, Specialization +2 damage, only for the weapon the feat names; Improved Critical doubles its threat range', () => {
  const base = calc(fighter());
  const c = fighter();
  c.feats.push({ name: 'Weapon Focus', sub: 'Longsword' }, { name: 'Greater Weapon Focus (Longsword)' }, { name: 'Weapon Specialization', sub: 'longsword' }, { name: 'Improved Critical', sub: 'Longsword' });
  const d = calc(c);
  const [gs, ls] = [1, 0].map(i => i).reverse(); // weapons: [0] Greatsword, [1] Longsword
  assert.equal(d.weapons[1].attack - base.weapons[1].attack, 2, 'Weapon Focus + Greater: +1 +1');
  assert.equal(d.weapons[1].dmgBonus - base.weapons[1].dmgBonus, 2, 'Weapon Specialization: +2');
  assert.equal(d.weapons[0].attack, base.weapons[0].attack, 'the greatsword gets nothing');
  assert.equal(d.weapons[0].dmgBonus, base.weapons[0].dmgBonus);
  assert.equal(base.weapons[1].critMin, 19, 'longsword 19-20');
  assert.equal(d.weapons[1].critMin, 17, 'Improved Critical: 19-20 doubles to 17-20');
});

test('Spell Focus is listed by school: +1, and Greater Spell Focus makes it +2', () => {
  const c = make({ race: 'Human', raceChoice: 'int', base: { int: 16 }, levels: repeat('Wizard', 3), hp: [6, 4, 4] });
  c.feats.push({ name: 'Spell Focus', sub: 'Evocation' }, { name: 'Greater Spell Focus (Evocation)' });
  assert.deepEqual(calc(c).spellcasting.Wizard.focus, { evocation: 2 });
});

test('a feat for "Bow" does not land on a Crossbow, and a plural choice still finds the weapon', () => {
  const c = fighter();
  c.weapons.push({ ...structuredClone(longsword), name: 'Light Crossbow' }, { ...structuredClone(longsword), name: 'Shortbow' });
  c.feats.push({ name: 'Weapon Focus', sub: 'Shortbows' }, { name: 'Weapon Focus', sub: 'Bow' });
  const d = calc(c), base = calc(Object.assign(structuredClone(c), { feats: [] }));
  assert.equal(d.weapons[2].attack - base.weapons[2].attack, 0, 'crossbow: no');
  assert.equal(d.weapons[3].attack - base.weapons[3].attack, 1, 'shortbow: Shortbows matches; "Bow" is a different word');
});

test('Weapon Finesse: a light melee weapon on automatic uses Dex when it is better; heavy weapons, ranged ones and a set ability do not', () => {
  const mk = feats => { const c = fighter(); c.abilities.str.base = 10; c.abilities.dex.base = 16; /* human +2 went to Str in the helper */ c.raceChoice = 'dex'; c.feats.push(...feats); c.weapons.push({ ...structuredClone(longsword), name: 'Dagger +1', tpl: 'Dagger' }, { ...structuredClone(longsword), name: 'Rapier' }); return c; };
  const plain = calc(mk([])), fin = calc(mk([{ name: 'Weapon Finesse' }]));
  const dex = fin.abilities.dex.score, str = fin.abilities.str.score;
  assert.ok(Math.floor((dex - 10) / 2) > Math.floor((str - 10) / 2), 'the test character has the better Dex');
  const gain = Math.floor((dex - 10) / 2) - Math.floor((str - 10) / 2);
  assert.equal(fin.weapons[2].attack - plain.weapons[2].attack, gain, 'dagger: Dex instead of Str');
  assert.equal(fin.weapons[3].attack - plain.weapons[3].attack, gain, 'rapier is named in the feat');
  assert.equal(fin.weapons[1].attack, plain.weapons[1].attack, 'longsword is not light');
  assert.equal(fin.weapons[2].dmgBonus, plain.weapons[2].dmgBonus, 'damage stays on Strength');
  const c = mk([{ name: 'Weapon Finesse' }]); c.weapons[2].ability = 'str';
  assert.equal(calc(c).weapons[2].attack, plain.weapons[2].attack, 'Str chosen on the weapon wins');
});

test('skill points ignore a temporary Intelligence bonus (Fox\'s Cunning) but count the permanent one', () => {
  const mk = () => make({ race: 'Human', raceChoice: 'int', base: { int: 14 }, levels: repeat('Wizard', 3), hp: [6, 4, 4] });
  const base = calc(mk()).skillPoints;
  // Wizard 2 + Int mod; human adds Int +2 -> 16 = +3; 3 levels x (2+3) + 3 human bonus ranks
  assert.equal(base.available, 3 * (2 + 3) + 3, 'Int 16: 5 a level, plus 1 a level for humans');
  const buffed = calc(buff(mk(), "Fox's Cunning")).skillPoints;
  assert.equal(buffed.available, base.available, "the +4 from a spell changes nothing");
  const c = mk(); c.abilities.int.temp = 4;
  assert.equal(calc(c).skillPoints.available, base.available, 'neither does a temp bonus');
  const p = mk(); p.abilities.int.misc = 2; // +2 for good: Int 18 = +4
  assert.equal(calc(p).skillPoints.available, 3 * (2 + 4) + 3, 'a permanent +2 counts');
});

test('current HP never shows above the maximum when a Constitution buff ends', () => {
  const c = fighter(); c.hp.current = 44;
  assert.equal(calc(c).hp.current, 36, 'stored 44, maximum is 36 now');
});

test('more racial skill bonuses: a tengu gets +2 Perception and Stealth, +4 Linguistics; a svirfneblin +2 dodge and +2 on every save', () => {
  const tengu = fighter(); tengu.race = 'Tengu';
  const t = compute(tengu, classesByName), t0 = compute(tengu, classesByName, { noAuto: true });
  assert.equal(skillTotal(t, 'Perception') - skillTotal(t0, 'Perception'), 2);
  assert.equal(skillTotal(t, 'Stealth') - skillTotal(t0, 'Stealth'), 2);
  assert.equal(skillTotal(t, 'Linguistics') - skillTotal(t0, 'Linguistics'), 4);
  const sv = fighter(); sv.race = 'Svirfneblin';
  const on = compute(sv, classesByName), off = compute(sv, classesByName, { noAuto: true });
  assert.deepEqual(['fort', 'ref', 'will'].map(k => on.saves[k].total - off.saves[k].total), [2, 2, 2], 'Fortunate: +2 racial on every save');
  assert.equal(on.ac.total - off.ac.total, 2, 'Defensive Training: +2 dodge');
});

test('a damaged save still opens: wrong-typed groups get their defaults and null list entries are dropped', async () => {
  const { migrate } = await import('../web/js/model.js');
  const c = make({ levels: ['Fighter'], hp: [10], feats: [{ name: 'Dodge' }, null] });
  Object.assign(c, { weapons: null, gear: {}, hp: null, saveMisc: 'x', levelUps: [null, ...c.levelUps] });
  const d = calc(migrate(c));
  assert.equal(d.level, 1, 'the null level is dropped, the real one kept');
  assert.deepEqual([c.weapons, c.gear, c.feats.map(f => f.name)], [[], [], ['Dodge']], 'nothing real is lost');
  assert.equal(d.saves.fort.total, 2, 'saveMisc back to zeros: Fighter 1 base Fort 2 + Con 0');
});
