// Bonuses carried by inventory items (a cloak of resistance, a headband of intelligence, a custom ring...). Pure, no DOM, tested in tests/itemfx.test.mjs.
// An item stores `effects: [{target, value, type}]`, the same shape as a buff's, and they count while the item is worn (it has a slot).
import { SKILLS, targetLabel } from './data.js';

const ABILITY = { 'giant strength': 'str', 'ogre power': 'str', 'incredible dexterity': 'dex', 'dexterity': 'dex', 'mighty constitution': 'con', 'constitution': 'con', 'vast intelligence': 'int', 'intelligence': 'int', 'inspired wisdom': 'wis', 'wisdom': 'wis', 'alluring charisma': 'cha', 'charisma': 'cha' };
const ABBR = { str: 'str', strength: 'str', dex: 'dex', dexterity: 'dex', con: 'con', constitution: 'con', int: 'int', intelligence: 'int', wis: 'wis', wisdom: 'wis', cha: 'cha', charisma: 'cha' };

const skill = (name, value) => ({ target: 'skill:' + name, value, type: 'competence' });
const CHA_SKILLS = SKILLS.filter(s => s.ability === 'cha').map(s => s.name);
// Items whose bonus is fixed by what they are, not by a +N in the name (Core Rulebook / Ultimate Equipment text). Conditional parts (the vest's
// lockpicks, the boots' jumping) are left out, since they only count some of the time.
const NAMED = [
  [/^cloak of elvenkind\b/i, () => [skill('Stealth', 5)]],
  [/^boots of elvenkind\b/i, () => [skill('Acrobatics', 5)]],
  [/^eyes of the eagle\b/i, () => [skill('Perception', 5)]],
  [/^gloves of swimming and climbing\b/i, () => [skill('Climb', 5), skill('Swim', 5)]],
  [/^(?:improved )?ring of climbing\b/i, n => [skill('Climb', /improved/i.test(n) ? 10 : 5)]],
  [/^(?:improved )?ring of swimming\b/i, n => [skill('Swim', /improved/i.test(n) ? 10 : 5)]],
  [/^circlet of persuasion\b/i, () => CHA_SKILLS.map(s => skill(s, 3))], // "+3 competence bonus on Charisma-based checks"
  [/^goggles of minute seeing\b/i, () => [skill('Disable Device', 5)]],
  [/^vest of escape\b/i, () => [skill('Escape Artist', 6)]],
  [/^boots of striding and springing\b/i, () => [{ target: 'speed', value: 10, type: 'enhancement' }]],
];

/**
 * The bonuses an item of this name usually gives, or [] when the name is not one we know (or its bonus depends on a choice the name does not say).
 * Matches the way the compendium names them: "Cloak of Resistance +2", "Headband of Vast Intelligence +4", "Cloak of Elvenkind".
 */
export function suggestEffects(name) {
  const n = String(name ?? '').trim();
  for (const [re, fx] of NAMED) if (re.test(n)) return fx(n);
  const plus = (/\+\s*(\d+)/.exec(n) || [])[1];
  if (!plus) return [];
  const v = +plus;
  // Belts and headbands for several abilities: perfection and superiority give all three; might and prowess two, chosen when made, so the name must say which ("Belt of Physical Might +4 (Str, Con)")
  const multi = /^(belt of physical|headband of mental) (might|prowess|perfection|superiority)\b/i.exec(n);
  if (multi) {
    const pool = /belt/i.test(multi[1]) ? ['str', 'dex', 'con'] : ['int', 'wis', 'cha'];
    const named = [...new Set((n.slice(multi[0].length).toLowerCase().match(/\b(?:str|strength|dex|dexterity|con|constitution|int|intelligence|wis|wisdom|cha|charisma)\b/g) || []).map(w => ABBR[w]))].filter(a => pool.includes(a));
    const abs = /perfection|superiority/i.test(multi[2]) ? pool : named.length === 2 ? named : [];
    return abs.map(a => ({ target: a, value: v, type: 'enhancement' }));
  }
  if (/^(cloak|cape|mantle|vestment) of resistance\b/i.test(n)) return [{ target: 'saves', value: v, type: 'resistance' }];
  if (/^ring of protection\b/i.test(n)) return [{ target: 'ac', value: v, type: 'deflection' }];
  if (/^amulet of natural armor\b/i.test(n)) return [{ target: 'ac', value: v, type: 'natural armor enhancement' }];
  if (/^bracers of armor\b/i.test(n)) return [{ target: 'ac', value: v, type: 'armor' }];
  const m = /^(?:belt|gloves|gauntlets|headband|cloak|periapt|amulet|ioun stone)s? of ([a-z ]+?)(?:\s*\+|\s*\(|$)/i.exec(n);
  const ab = m && ABILITY[m[1].trim().toLowerCase()];
  if (ab) return [{ target: ab, value: v, type: 'enhancement' }];
  return [];
}

/** "+2 Intelligence (enhancement), +2 All saves (resistance)" */
export function effectsText(effects) {
  return (effects || []).map(e => {
    const val = typeof e.value === 'number' ? (e.value >= 0 ? '+' : '') + e.value : String(e.value);
    return `${val} ${targetLabel(e.target)}${e.type && e.type !== 'untyped' ? ` (${e.type})` : ''}`;
  }).join(', ');
}

/** What an item gives right now: its bonuses while it is worn, nothing while it is only carried. */
export const wornEffects = g => (g && g.slot && Array.isArray(g.effects) ? g.effects : []);

const numOf = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const SAVE_NAME = { fort: 'Fortitude', ref: 'Reflex', will: 'Will' };
const ABIL_NAME = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** The sheet boxes a worn item's bonus could also have been typed into, where it would count a second time ([path, label]). Boxes of the same
 *  bonus type as the item (Deflect for a ring of protection, an ability's Enh) are left out: those do not stack, so nothing counts twice. */
function boxesFor(c, e) {
  const t = String(e.target || '');
  if (t === 'ac' && e.type === 'natural armor enhancement') return [['ac.natural', 'Natural armor']];
  if (t === 'saves' && e.type === 'resistance') return Object.keys(SAVE_NAME).map(s => [`saveMisc.${s}`, `${SAVE_NAME[s]} misc`]);
  if (SAVE_NAME[t] && e.type === 'resistance') return [[`saveMisc.${t}`, `${SAVE_NAME[t]} misc`]];
  if (ABIL_NAME[t] && e.type === 'enhancement') return [[`abilities.${t}.misc`, `${ABIL_NAME[t]} misc`]];
  if (t === 'speed') return [['speedMisc', 'Speed misc']];
  if (t.startsWith('skill:')) {
    const i = (c.skills || []).findIndex(s => s && s.name === t.slice(6) && !s.sub);
    return i < 0 ? [] : [[`skills.${i}.misc`, `${t.slice(6)} misc`]];
  }
  return [];
}

/**
 * Bonuses from worn items that the sheet's own boxes seem to hold as well, so they count twice: typed by hand, or imported, before worn items
 * counted by themselves. [{key, item, value, target, boxes: [{path, label}]}], naming only boxes that hold at least the item's bonus. Keys in
 * c.itemBoxKeep are ones the player chose to keep.
 */
export function boxDuplicates(c) {
  const keep = new Set(c.itemBoxKeep || []), out = [];
  const get = path => numOf(path.split('.').reduce((o, k) => o?.[k], c));
  for (const g of c.gear || []) for (const e of wornEffects(g)) {
    const value = numOf(e.value);
    const key = `${g.name || 'Item'}|${e.target}`;
    if (value <= 0 || keep.has(key)) continue;
    const boxes = boxesFor(c, e).filter(([path]) => get(path) >= value).map(([path, label]) => ({ path, label }));
    if (boxes.length) out.push({ key, item: g.name || 'Item', value, target: e.target, type: e.type, boxes });
  }
  return out;
}

/** Takes a duplicate's bonus back out of the boxes that also held it, once: what is left in a box (Will's other +2) is not asked about again. */
export function removeFromBoxes(c, dup) {
  for (const { path } of dup.boxes) {
    const keys = path.split('.'), last = keys.pop();
    const o = keys.reduce((x, k) => x?.[k], c);
    if (o) o[last] = numOf(o[last]) - dup.value;
  }
  c.itemBoxKeep = [...new Set([...(c.itemBoxKeep || []), dup.key])];
}

/** "+2 to Fortitude misc, Reflex misc and Will misc" style text for one duplicate. */
export const duplicateText = dup => `${dup.item} adds +${dup.value} ${targetLabel(dup.target)}${dup.type && dup.type !== 'untyped' ? ` (${dup.type})` : ''}, and +${dup.value} is also typed in ${dup.boxes.map(b => b.label).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
