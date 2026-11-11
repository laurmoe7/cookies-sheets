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

// Drawbacks (Ultimate Campaign) are traits in reverse: a penalty and a roleplaying hook. The compendium files them as traits
// with the category "Drawback"; characters saved before that have them with no category, so the book's 17 are known by name too.
export const DRAWBACK = 'Drawback';
const DRAWBACK_NAMES = new Set(['attached', 'avarice', 'dependent', 'doubt', 'family ties', 'headstrong', 'hedonistic', 'lovesick', 'meticulous',
  'paranoid', 'power hungry', 'pride', 'provincial', 'sentimental', 'vain', 'xenophobic', 'zealous']);
const nameKey = s => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
/** True for a drawback: one from the compendium, a custom one marked `drawback`, or one of the book's own saved before they had a category. */
export const isDrawback = t => !!t && (t.drawback === true || String(t.sub || '').toLowerCase() === 'drawback' || (!t.sub && DRAWBACK_NAMES.has(nameKey(t.name))));

/**
 * The character's rule for drawbacks (`c.drawbackRule`):
 * 'optional' (the book): drawbacks are optional, and taking one gives a third trait at 1st level;
 * 'perTrait' (a house rule some GMs use): every trait must be paid for with a drawback, and drawbacks give no extra traits.
 */
export const DRAWBACK_RULES = { optional: 'Optional (one gives a 3rd trait)', perTrait: 'One drawback per trait' };
export const drawbackRule = c => (c?.drawbackRule === 'perTrait' ? 'perTrait' : 'optional');

/**
 * How many traits the wizard offers: 2 at 1st level, plus 2 when Additional Traits is among the feats just chosen.
 * Under the book's rule, a drawback picked at 1st level adds a third.
 */
export function traitAllowance(newLevel, draftFeats = [], { rule = 'optional', drawbacks = 0 } = {}) {
  const extra = draftFeats.some(f => String(f.name || '').trim().toLowerCase() === ADDITIONAL_TRAITS.toLowerCase());
  return (newLevel === 1 ? 2 : 0) + (extra ? 2 : 0) + (rule === 'optional' && newLevel === 1 && drawbacks > 0 ? 1 : 0);
}

/** How many of the picked traits use up the allowance: racial traits (alternate or not) and drawbacks do not. */
export function countTraits(picks) {
  return (picks || []).filter(p => !p.racial && !isDrawback(p)).length;
}
export const countDrawbacks = picks => (picks || []).filter(isDrawback).length;
/** Drawbacks still owed for the traits in `picks` (the 'perTrait' rule only): one per trait, racial traits not counted. */
export const drawbacksLeft = (rule, picks) => (rule === 'perTrait' ? Math.max(0, countTraits(picks) - countDrawbacks(picks)) : 0);

/**
 * Traits against drawbacks on a whole list (the sheet, or the sheet plus a level's picks).
 * `isRacial(t)` tells racial traits apart (they are neither). `missing` is how many drawbacks the rule still asks for.
 */
export function traitBalance(traits, rule, isRacial = t => !!t.racial) {
  const drawbacks = (traits || []).filter(isDrawback).length;
  const positive = (traits || []).filter(t => !isDrawback(t) && !isRacial(t)).length;
  return { positive, drawbacks, missing: rule === 'perTrait' ? Math.max(0, positive - drawbacks) : 0 };
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
  if (!cat || isDrawback(entry)) return ''; // drawbacks have no category rule
  if (picks.some(p => p.name === entry.name)) return '';
  if (picks.some(p => traitCategory(p.sub) === cat)) return `You already chose a ${cat} trait here; traits must come from different categories.`;
  if (used.has(cat)) return `You already have a ${cat} trait.`;
  return '';
}
