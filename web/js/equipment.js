// Standard weapons and armor to start from (data/equipment.json, built by tools/equipment.py): a template becomes a row on the Weapons or Armor table.
// Pure functions, no DOM.

const SMALL_OR_LESS = ['Fine', 'Diminutive', 'Tiny', 'Small'];
/** Ranged weapons that add Strength to damage: thrown weapons and slings. Bows and crossbows do not (a Strength-rated composite bow is set by hand). */
const ADDS_STRENGTH = /javelin|dart|shuriken|throwing|\bsling\b|boomerang|bolas|chakram|starknife|harpoon|atlatl/i;

export const blankWeapon = () => ({ name: '', ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgAbility: '', dmgMult: '', dmgMisc: 0, crit: '×2', range: '', type: '', weight: 0,
  mw: false, material: '', improvedCritical: false, fx: [], slot: '' });
export const blankArmor = () => ({ name: '', type: 'armor', category: 'light', bonus: 0, enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true, mw: false, material: '', fx: [] });

/** A weapon row from a template. Damage is the dice for the wielder's size; two-handed melee weapons get the ×1½ Strength bonus. */
export function weaponFromTemplate(t, size = 'Medium') {
  const small = SMALL_OR_LESS.includes(size);
  const ranged = t.kind === 'ranged';
  return { ...blankWeapon(), name: t.name, ranged, damage: (small ? t.dmgS : t.dmgM) || t.dmgM || t.dmgS || '', crit: t.crit || 'x2', range: t.range || '', type: t.type || '', weight: t.weight || 0,
    dmgMult: t.kind === 'two-handed' ? '1.5' : '', dmgAbility: ranged && ADDS_STRENGTH.test(t.name) ? 'str' : '' };
}

/** An armor or shield row from a template. Shields are "light" for the speed rules; armor carries its category. */
export function armorFromTemplate(t) {
  const shield = t.category === 'shield';
  return { ...blankArmor(), name: t.name, type: shield ? 'shield' : 'armor', category: shield ? 'light' : t.category, bonus: t.bonus || 0, maxDex: t.maxDex ?? '', acp: t.acp || 0, asf: t.asf || 0, weight: t.weight || 0 };
}

/** The templates matching a search and a filter. `q` matches any part of the name (every word must); `pick` is a function on the template or nothing. */
export function filterTemplates(list, q = '', pick = null) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(t => (!pick || pick(t)) && words.every(w => t.name.toLowerCase().includes(w)));
}
