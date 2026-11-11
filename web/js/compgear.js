// Gear on a companion: barding (armor for the mount) and worn items with bonuses. Pure, no DOM, tested in tests/compgear.test.mjs.
// A companion keeps `barding` (an armor row like c.armor's, or null) and `items` ([{name, id?, worn, effects, notes}], effects as on inventory items).
// computeCompanion() (companions.js) folds them into the stat block through companionGear().
import { stack, num } from './calc.js';
import { armorFx } from './armorfx.js';
import { armorFromTemplate } from './equipment.js';
import { stripPlus } from './itemfx.js';

/** Armor for unusual creatures (Core Rulebook): weight by the wearer's size. Cost changes too, but the sheet does not track it. */
export const SIZE_WEIGHT = { Fine: 0.1, Diminutive: 0.1, Tiny: 0.1, Small: 0.5, Medium: 1, Large: 2, Huge: 5, Gargantuan: 8, Colossal: 12 };

/** Speed in medium or heavy armor (Core Rulebook table): 20 → 15, 30 → 20, 40 → 30, 50 → 35, 60 → 40... */
export function reducedSpeed(ft) {
  const n = num(ft);
  if (n <= 0) return n;
  if (n % 10) return Math.max(5, Math.round((n * 2) / 3 / 5) * 5);
  return 20 * Math.floor(n / 30) + { 0: 0, 10: 10, 20: 15 }[n % 30];
}

/** Barding from a standard armor: the book's numbers, weight for the creature's size, worn. */
export function bardingFromTemplate(t, size = 'Large') {
  const a = armorFromTemplate(t);
  return { ...a, name: `${t.name} barding`, weight: Math.round(num(t.weight) * (SIZE_WEIGHT[size] ?? 1) * 10) / 10, equipped: true };
}

/** The compendium's write-up of barding in general, shown under the base armor's entry. */
export const BARDING_ENTRY = 'Barding, Medium Creature and Large Creature';

const bare = name => stripPlus(String(name ?? '').replace(/^\s*\+\s*\d+\s+/, ''));

/** Compendium names to try for a piece of gear typed in by hand: "Military saddle +1" → ["Military saddle", "Saddle, Military"] (the book's way of naming them). */
export function lookupNames(name) {
  const n = bare(name);
  if (!n) return [];
  const w = n.split(/\s+/);
  return [...new Set([n, ...(w.length > 1 ? [`${w[w.length - 1][0].toUpperCase()}${w[w.length - 1].slice(1)}, ${w.slice(0, -1).join(' ')}`] : [])])];
}

/** The armor a barding is made from: "Breastplate barding +1" → "Breastplate". */
export const bardingBase = name => bare(name).replace(/\s*barding$/i, '').trim();

const ARMOR_TYPES = new Set(['armor', 'shield', 'natural armor', 'natural armor enhancement']);
const LIGHTER = { heavy: 'medium', medium: 'light', light: 'light' };

/**
 * What the gear adds: `mods` [{target, value, type, source}] from the worn barding (its armor bonus) and the worn items' bonuses, and the
 * barding's limits. `stat(...targets)` stacks the mods for those targets; `touchAc` leaves out armor and natural armor.
 */
export function companionGear(comp) {
  const mods = [];
  for (const it of comp.items || []) {
    if (it.worn === false) continue;
    for (const e of it.effects || []) if (num(e.value)) mods.push({ target: e.target, value: num(e.value), type: e.type || 'untyped', source: it.name || 'Item' });
  }
  const b = comp.barding && comp.barding.equipped !== false ? comp.barding : null;
  let barding = null;
  if (b) {
    const fx = armorFx(b);
    const ac = num(b.bonus) + num(b.enh);
    if (ac) mods.push({ target: 'ac', value: ac, type: 'armor', source: b.name || 'Barding' });
    const maxDex = b.maxDex === '' || b.maxDex == null ? null : num(b.maxDex) + fx.maxDexDelta;
    const cat = fx.lighter ? LIGHTER[b.category] || b.category : b.category;
    barding = {
      name: b.name || 'Barding', ac, maxDex, acp: -Math.max(0, Math.abs(num(b.acp)) + fx.acpDelta) || 0, // the check penalty as calc.js works it out for the character's own armor
      slows: cat === 'medium' || cat === 'heavy',
      weight: Math.round(num(b.weight) * fx.weightMult * 10) / 10, fx,
    };
  }
  const pick = targets => mods.filter(m => targets.includes(m.target));
  return {
    mods, barding,
    stat: (...targets) => stack(pick(targets)).total,
    parts: (...targets) => pick(targets).map(m => ({ label: `${m.source} (${m.type})`, value: m.value })),
    touchAc: () => stack(pick(['ac']).filter(m => !ARMOR_TYPES.has(m.type))).total,
    flatAc: () => stack(pick(['ac']).filter(m => m.type !== 'dodge')).total,
    skill: name => stack(pick(['skills', 'checks', 'skill:' + name])).total,
  };
}
