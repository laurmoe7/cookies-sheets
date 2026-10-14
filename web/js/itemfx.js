// Bonuses carried by inventory items (a cloak of resistance, a headband of intelligence, a custom ring...). Pure, no DOM, tested in tests/itemfx.test.mjs.
// An item stores `effects: [{target, value, type}]`, the same shape as a buff's, and they count while the item is worn (it has a slot).
import { MOD_TARGETS } from './data.js';

const ABILITY = { 'giant strength': 'str', 'ogre power': 'str', 'incredible dexterity': 'dex', 'dexterity': 'dex', 'mighty constitution': 'con', 'constitution': 'con', 'vast intelligence': 'int', 'intelligence': 'int', 'inspired wisdom': 'wis', 'wisdom': 'wis', 'alluring charisma': 'cha', 'charisma': 'cha' };

/**
 * The bonuses an item of this name usually gives, or [] when the name is not one we know (or its bonus depends on a choice, like a belt of physical might).
 * Matches the way the compendium names them: "Cloak of Resistance +2", "Headband of Vast Intelligence +4".
 */
export function suggestEffects(name) {
  const n = String(name ?? '').trim();
  const plus = (/\+\s*(\d+)/.exec(n) || [])[1];
  if (!plus) return [];
  const v = +plus;
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
    return `${val} ${MOD_TARGETS[e.target] || e.target}${e.type && e.type !== 'untyped' ? ` (${e.type})` : ''}`;
  }).join(', ');
}

/** What an item gives right now: its bonuses while it is worn, nothing while it is only carried. */
export const wornEffects = g => (g && g.slot && Array.isArray(g.effects) ? g.effects : []);
