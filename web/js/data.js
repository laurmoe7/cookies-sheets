// Static Pathfinder 1e rules data used by the sheet and calculators.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// name, ability, trainedOnly, armorCheckPenalty
export const SKILLS = [
  ['Acrobatics', 'dex', false, true], ['Appraise', 'int', false, false], ['Bluff', 'cha', false, false],
  ['Climb', 'str', false, true], ['Craft', 'int', false, false], ['Diplomacy', 'cha', false, false],
  ['Disable Device', 'dex', true, true], ['Disguise', 'cha', false, false], ['Escape Artist', 'dex', false, true],
  ['Fly', 'dex', false, true], ['Handle Animal', 'cha', true, false], ['Heal', 'wis', false, false],
  ['Intimidate', 'cha', false, false],
  ['Knowledge (arcana)', 'int', true, false], ['Knowledge (dungeoneering)', 'int', true, false],
  ['Knowledge (engineering)', 'int', true, false], ['Knowledge (geography)', 'int', true, false],
  ['Knowledge (history)', 'int', true, false], ['Knowledge (local)', 'int', true, false],
  ['Knowledge (nature)', 'int', true, false], ['Knowledge (nobility)', 'int', true, false],
  ['Knowledge (planes)', 'int', true, false], ['Knowledge (religion)', 'int', true, false],
  ['Linguistics', 'int', true, false], ['Perception', 'wis', false, false], ['Perform', 'cha', false, false],
  ['Profession', 'wis', true, false], ['Ride', 'dex', false, true], ['Sense Motive', 'wis', false, false],
  ['Sleight of Hand', 'dex', true, true], ['Spellcraft', 'int', true, false], ['Stealth', 'dex', false, true],
  ['Survival', 'wis', false, false], ['Swim', 'str', false, true], ['Use Magic Device', 'cha', true, false],
].map(([name, ability, trained, acp]) => ({ name, ability, trained, acp }));
export const SKILL_BY_NAME = Object.fromEntries(SKILLS.map(s => [s.name, s]));
export const MULTI_SKILLS = ['Craft', 'Perform', 'Profession'];

// Size modifiers: attack/AC, special (CMB/CMD), Fly, Stealth, carrying multiplier (biped)
export const SIZES = {
  Fine: { ac: 8, cmb: -8, fly: 8, stealth: 16, carry: 1 / 8 },
  Diminutive: { ac: 4, cmb: -4, fly: 6, stealth: 12, carry: 1 / 4 },
  Tiny: { ac: 2, cmb: -2, fly: 4, stealth: 8, carry: 1 / 2 },
  Small: { ac: 1, cmb: -1, fly: 2, stealth: 4, carry: 3 / 4 },
  Medium: { ac: 0, cmb: 0, fly: 0, stealth: 0, carry: 1 },
  Large: { ac: -1, cmb: 1, fly: -2, stealth: -4, carry: 2 },
  Huge: { ac: -2, cmb: 2, fly: -4, stealth: -8, carry: 4 },
  Gargantuan: { ac: -4, cmb: 4, fly: -6, stealth: -12, carry: 8 },
  Colossal: { ac: -8, cmb: 8, fly: -8, stealth: -16, carry: 16 },
};

// Racial ability adjustments. flex: +2 to one ability of choice.
export const RACES = {
  'Dwarf': { mods: { con: 2, wis: 2, cha: -2 }, size: 'Medium', speed: 20, note: 'Speed never modified by armor or encumbrance.' },
  'Elf': { mods: { dex: 2, int: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Gnome': { mods: { con: 2, cha: 2, str: -2 }, size: 'Small', speed: 20 },
  'Half-Elf': { flex: true, size: 'Medium', speed: 30 },
  'Half-Orc': { flex: true, size: 'Medium', speed: 30 },
  'Halfling': { mods: { dex: 2, cha: 2, str: -2 }, size: 'Small', speed: 20 },
  'Human': { flex: true, size: 'Medium', speed: 30, bonusFeat: true, bonusSkill: true },
  'Aasimar': { mods: { wis: 2, cha: 2 }, size: 'Medium', speed: 30 },
  'Catfolk': { mods: { dex: 2, cha: 2, wis: -2 }, size: 'Medium', speed: 30 },
  'Changeling': { mods: { wis: 2, cha: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Dhampir': { mods: { dex: 2, cha: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Drow': { mods: { dex: 2, cha: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Duergar': { mods: { con: 2, wis: 2, cha: -4 }, size: 'Medium', speed: 20 },
  'Fetchling': { mods: { dex: 2, cha: 2, wis: -2 }, size: 'Medium', speed: 30 },
  'Gillman': { mods: { con: 2, cha: 2, wis: -2 }, size: 'Medium', speed: 30 },
  'Goblin': { mods: { dex: 4, str: -2, cha: -2 }, size: 'Small', speed: 30 },
  'Grippli': { mods: { dex: 2, wis: 2, str: -2 }, size: 'Small', speed: 30 },
  'Hobgoblin': { mods: { dex: 2, con: 2 }, size: 'Medium', speed: 30 },
  'Ifrit': { mods: { dex: 2, cha: 2, wis: -2 }, size: 'Medium', speed: 30 },
  'Kitsune': { mods: { dex: 2, cha: 2, str: -2 }, size: 'Medium', speed: 30 },
  'Kobold': { mods: { dex: 2, str: -4, con: -2 }, size: 'Small', speed: 30 },
  'Nagaji': { mods: { str: 2, cha: 2, int: -2 }, size: 'Medium', speed: 30 },
  'Orc': { mods: { str: 4, int: -2, wis: -2, cha: -2 }, size: 'Medium', speed: 30 },
  'Oread': { mods: { str: 2, wis: 2, cha: -2 }, size: 'Medium', speed: 20 },
  'Ratfolk': { mods: { dex: 2, int: 2, str: -2 }, size: 'Small', speed: 20 },
  'Samsaran': { mods: { int: 2, wis: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Strix': { mods: { dex: 2, cha: -2 }, size: 'Medium', speed: 30 },
  'Suli': { mods: { str: 2, cha: 2, int: -2 }, size: 'Medium', speed: 30 },
  'Svirfneblin': { mods: { dex: 2, wis: 2, str: -2, cha: -4 }, size: 'Small', speed: 20 },
  'Sylph': { mods: { dex: 2, int: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Tengu': { mods: { dex: 2, wis: 2, con: -2 }, size: 'Medium', speed: 30 },
  'Tiefling': { mods: { dex: 2, int: 2, cha: -2 }, size: 'Medium', speed: 30 },
  'Undine': { mods: { dex: 2, wis: 2, str: -2 }, size: 'Medium', speed: 30 },
  'Vanara': { mods: { dex: 2, wis: 2, cha: -2 }, size: 'Medium', speed: 30 },
  'Vishkanya': { mods: { dex: 2, cha: 2, wis: -2 }, size: 'Medium', speed: 30 },
  'Wayang': { mods: { dex: 2, int: 2, wis: -2 }, size: 'Small', speed: 20 },
  'Custom': { mods: {}, size: 'Medium', speed: 30, custom: true },
};

export const ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'];

export const XP_TRACKS = {
  slow: [0, 3000, 7500, 14000, 23000, 35000, 53000, 77000, 115000, 160000, 235000, 330000, 475000, 665000, 955000, 1350000, 1900000, 2700000, 3850000, 5350000],
  medium: [0, 2000, 5000, 9000, 15000, 23000, 35000, 51000, 75000, 105000, 155000, 220000, 315000, 445000, 635000, 890000, 1300000, 1800000, 2550000, 3600000],
  fast: [0, 1300, 3300, 6000, 10000, 15000, 23000, 34000, 50000, 71000, 105000, 145000, 210000, 295000, 425000, 600000, 850000, 1200000, 1700000, 2400000],
};

// Heavy load (lbs) by Strength score 1-29; light = 1/3, medium = 2/3. +10 Str multiplies by 4.
const HEAVY = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400];
export function carryingCapacity(str, size = 'Medium') {
  if (str <= 0) return { light: 0, medium: 0, heavy: 0 };
  let mult = 1;
  while (str > 29) { str -= 10; mult *= 4; }
  const heavy = HEAVY[str] * mult * (SIZES[size]?.carry ?? 1);
  return { light: Math.floor(heavy / 3), medium: Math.floor(heavy * 2 / 3), heavy };
}

export const POINT_BUY = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 };

export const BONUS_TYPES = ['untyped', 'alchemical', 'armor', 'circumstance', 'competence', 'deflection', 'dodge',
  'enhancement', 'inherent', 'insight', 'luck', 'morale', 'natural armor', 'natural armor enhancement', 'profane',
  'racial', 'resistance', 'sacred', 'shield', 'size', 'trait'];
export const STACKING_TYPES = new Set(['untyped', 'dodge', 'circumstance']);
// AC bonus types that do NOT apply to touch AC
export const NON_TOUCH_AC = new Set(['armor', 'shield', 'natural armor', 'natural armor enhancement']);
// AC bonus types that also apply to CMD
export const CMD_AC_TYPES = new Set(['circumstance', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred', 'untyped']);

export const MOD_TARGETS = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  attack: 'Attack rolls (all)', melee: 'Melee attack', ranged: 'Ranged attack', damage: 'Damage (all)',
  meleeDamage: 'Melee damage', rangedDamage: 'Ranged damage',
  ac: 'Armor Class', saves: 'All saves', fort: 'Fortitude', ref: 'Reflex', will: 'Will',
  skills: 'All skills', checks: 'Ability & skill checks', init: 'Initiative', cmb: 'CMB', cmd: 'CMD',
  speed: 'Speed (ft.)', hp: 'Max HP', cl: 'Caster level', concentration: 'Concentration',
};

// Values may be expressions using: bab, lvl, floor, ceil, min, max
export const BUFF_PRESETS = [
  { name: 'Power Attack', group: 'Combat option', effects: [{ target: 'melee', value: '-(1+floor(bab/4))', type: 'untyped' }, { target: 'meleeDamage', value: '2*(1+floor(bab/4))', type: 'untyped', scale: true }], note: 'Damage bonus is ×1.5 with two-handed weapons and ×½ off-hand (set Str dmg on the weapon).' },
  { name: 'Deadly Aim', group: 'Combat option', effects: [{ target: 'ranged', value: '-(1+floor(bab/4))', type: 'untyped' }, { target: 'rangedDamage', value: '2*(1+floor(bab/4))', type: 'untyped' }] },
  { name: 'Combat Expertise', group: 'Combat option', effects: [{ target: 'attack', value: '-(1+floor(bab/4))', type: 'untyped' }, { target: 'ac', value: '1+floor(bab/4)', type: 'dodge' }] },
  { name: 'Fighting Defensively', group: 'Combat option', effects: [{ target: 'attack', value: -4, type: 'untyped' }, { target: 'ac', value: 2, type: 'dodge' }], note: '+3 dodge instead of +2 with 3+ ranks in Acrobatics.' },
  { name: 'Total Defense', group: 'Combat option', effects: [{ target: 'ac', value: 4, type: 'dodge' }], note: 'Standard action; no attacks or AoOs. +6 with 3+ Acrobatics ranks.' },
  { name: 'Charging', group: 'Combat option', effects: [{ target: 'melee', value: 2, type: 'untyped' }, { target: 'ac', value: -2, type: 'untyped' }] },
  { name: 'Bless', group: 'Spell', effects: [{ target: 'attack', value: 1, type: 'morale' }], note: '+1 morale on saves vs fear.' },
  { name: 'Prayer (ally)', group: 'Spell', effects: [{ target: 'attack', value: 1, type: 'luck' }, { target: 'damage', value: 1, type: 'luck' }, { target: 'saves', value: 1, type: 'luck' }, { target: 'skills', value: 1, type: 'luck' }] },
  { name: 'Haste', group: 'Spell', effects: [{ target: 'attack', value: 1, type: 'untyped' }, { target: 'ac', value: 1, type: 'dodge' }, { target: 'ref', value: 1, type: 'dodge' }, { target: 'speed', value: 30, type: 'enhancement' }], note: 'One extra attack at highest bonus on a full attack.' },
  { name: 'Heroism', group: 'Spell', effects: [{ target: 'attack', value: 2, type: 'morale' }, { target: 'saves', value: 2, type: 'morale' }, { target: 'skills', value: 2, type: 'morale' }] },
  { name: 'Greater Heroism', group: 'Spell', effects: [{ target: 'attack', value: 4, type: 'morale' }, { target: 'saves', value: 4, type: 'morale' }, { target: 'skills', value: 4, type: 'morale' }], note: 'Immune to fear; temp HP = caster level (max 20).' },
  { name: 'Shield of Faith (+2)', group: 'Spell', effects: [{ target: 'ac', value: 2, type: 'deflection' }] },
  { name: 'Mage Armor', group: 'Spell', effects: [{ target: 'ac', value: 4, type: 'armor' }] },
  { name: 'Shield (spell)', group: 'Spell', effects: [{ target: 'ac', value: 4, type: 'shield' }] },
  { name: 'Barkskin (+2)', group: 'Spell', effects: [{ target: 'ac', value: 2, type: 'natural armor enhancement' }] },
  { name: "Bull's Strength", group: 'Spell', effects: [{ target: 'str', value: 4, type: 'enhancement' }] },
  { name: "Cat's Grace", group: 'Spell', effects: [{ target: 'dex', value: 4, type: 'enhancement' }] },
  { name: "Bear's Endurance", group: 'Spell', effects: [{ target: 'con', value: 4, type: 'enhancement' }] },
  { name: "Fox's Cunning", group: 'Spell', effects: [{ target: 'int', value: 4, type: 'enhancement' }] },
  { name: "Owl's Wisdom", group: 'Spell', effects: [{ target: 'wis', value: 4, type: 'enhancement' }] },
  { name: "Eagle's Splendor", group: 'Spell', effects: [{ target: 'cha', value: 4, type: 'enhancement' }] },
  { name: 'Enlarge Person', group: 'Spell', effects: [{ target: 'str', value: 2, type: 'size' }, { target: 'dex', value: -2, type: 'size' }, { target: 'attack', value: -1, type: 'size' }, { target: 'ac', value: -1, type: 'size' }, { target: 'cmb', value: 1, type: 'size' }, { target: 'cmd', value: 1, type: 'size' }], note: 'Large: reach +5 ft., weapon damage dice go up one size.' },
  { name: 'Reduce Person', group: 'Spell', effects: [{ target: 'str', value: -2, type: 'size' }, { target: 'dex', value: 2, type: 'size' }, { target: 'attack', value: 1, type: 'size' }, { target: 'ac', value: 1, type: 'size' }, { target: 'cmb', value: -1, type: 'size' }, { target: 'cmd', value: -1, type: 'size' }] },
  { name: 'Rage', group: 'Class', effects: [{ target: 'str', value: 4, type: 'morale' }, { target: 'con', value: 4, type: 'morale' }, { target: 'will', value: 2, type: 'morale' }, { target: 'ac', value: -2, type: 'untyped' }], note: 'Greater rage: +6/+6/+3. Cannot use most Cha/Dex/Int skills or concentrate.' },
  { name: 'Inspire Courage +1', group: 'Class', effects: [{ target: 'attack', value: 1, type: 'competence' }, { target: 'damage', value: 1, type: 'competence' }], note: 'Also +1 morale on saves vs charm and fear. +2 at 5th, +3 at 11th, +4 at 17th bard level.' },
  { name: 'Shaken / Frightened', group: 'Condition', effects: [{ target: 'attack', value: -2, type: 'untyped' }, { target: 'saves', value: -2, type: 'untyped' }, { target: 'checks', value: -2, type: 'untyped' }] },
  { name: 'Sickened', group: 'Condition', effects: [{ target: 'attack', value: -2, type: 'untyped' }, { target: 'damage', value: -2, type: 'untyped' }, { target: 'saves', value: -2, type: 'untyped' }, { target: 'checks', value: -2, type: 'untyped' }] },
  { name: 'Fatigued', group: 'Condition', effects: [{ target: 'str', value: -2, type: 'untyped' }, { target: 'dex', value: -2, type: 'untyped' }], note: "Can't run or charge." },
  { name: 'Exhausted', group: 'Condition', effects: [{ target: 'str', value: -6, type: 'untyped' }, { target: 'dex', value: -6, type: 'untyped' }], note: 'Half speed; can\'t run or charge.' },
  { name: 'Entangled', group: 'Condition', effects: [{ target: 'attack', value: -2, type: 'untyped' }, { target: 'dex', value: -4, type: 'untyped' }], note: 'Half speed, can\'t run or charge. Concentration DC 15 + spell level to cast.' },
  { name: 'Grappled', group: 'Condition', effects: [{ target: 'attack', value: -2, type: 'untyped' }, { target: 'dex', value: -4, type: 'untyped' }], note: 'CMB penalty does not apply to grapple/escape checks. Can\'t move. Concentration DC 10 + grappler CMB + spell level.' },
];

export const CASTING_STAT_NAMES = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation', 'universal'];
