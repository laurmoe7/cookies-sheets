// Character traits: how many a character gets and which ones can be taken together. Pure.
// Rules: a character takes two traits at 1st level, and the feat Additional Traits gives two more.
// Traits must come from different categories (Combat, Faith, Magic, Social...), and Additional Traits
// cannot use a category the character already has a trait from.

export const ADDITIONAL_TRAITS = 'Additional Traits';

/** The category a trait entry belongs to: its `sub`, with the "Racial Dwarf" / "Region" variants folded together. */
export function traitCategory(sub) {
  const s = String(sub || '').trim();
  if (/^racial\b/i.test(s)) return 'Racial';
  if (/^region/i.test(s)) return 'Regional';
  return s;
}

/** How many traits the wizard offers: 2 at 1st level, plus 2 when Additional Traits is among the feats just chosen. */
export function traitAllowance(newLevel, draftFeats = []) {
  const extra = draftFeats.some(f => String(f.name || '').trim().toLowerCase() === ADDITIONAL_TRAITS.toLowerCase());
  return (newLevel === 1 ? 2 : 0) + (extra ? 2 : 0);
}

/** Categories the character already has a trait from. `known` maps lower-case trait names to their entry's sub. */
export function usedCategories(traits, known) {
  const out = new Set();
  for (const t of traits || []) {
    const sub = known.get(String(t.name || '').toLowerCase());
    if (sub != null && traitCategory(sub)) out.add(traitCategory(sub));
  }
  return out;
}

/**
 * Why `entry` cannot be taken now ('' if it can): its category is already used by the character or by another
 * trait chosen in this window.
 */
export function traitBlock(entry, picks, used) {
  const cat = traitCategory(entry.sub);
  if (!cat) return '';
  if (picks.some(p => p.name === entry.name)) return '';
  if (picks.some(p => traitCategory(p.sub) === cat)) return `You already chose a ${cat} trait here; traits must come from different categories.`;
  if (used.has(cat)) return `You already have a ${cat} trait.`;
  return '';
}
