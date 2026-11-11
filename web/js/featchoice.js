// Feats taken for one weapon, natural attack, skill or school (Weapon Focus, Improved Natural Attack, Skill Focus, Spell Focus...).
// The choice is stored on the feat as `choice`; older saves name it in brackets ("Weapon Focus (Longsword)") or in `sub`.
// Pure: no DOM.
import { FEAT_TYPES } from './data.js';

/** Feat name (lower case, no bracket) → what it is taken for. */
export const CHOICE_FEATS = {
  'weapon focus': 'weapon', 'greater weapon focus': 'weapon', 'weapon specialization': 'weapon', 'greater weapon specialization': 'weapon',
  'improved critical': 'weapon', 'improved natural attack': 'natural',
  'skill focus': 'skill', 'spell focus': 'school', 'greater spell focus': 'school',
};
export const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Universal'];

const FEAT_TYPE_NAMES = new Set(FEAT_TYPES.flatMap(t => t).map(t => String(t).toLowerCase()));

/** The feat's name without its bracket, lower case ("Weapon Focus (Longsword)" → "weapon focus"). */
export const featBase = f => String(f?.name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();

/** What a choice feat is taken for ('weapon', 'natural', 'skill', 'school'), or '' for any other feat. */
export const choiceKind = f => CHOICE_FEATS[featBase(f)] || '';

/**
 * The choice a feat was taken for, in lower case: its `choice`, the text in brackets after the name, or (older saves) `sub`.
 * A compendium feat's `sub` is its feat type ("Combat"), which is never the choice.
 */
export function featChoice(f) {
  if (f?.choice) return String(f.choice).trim().toLowerCase();
  const br = String(f?.name || '').match(/\((.*)\)/)?.[1];
  if (br) return br.trim().toLowerCase();
  const sub = String(f?.sub || '').trim().toLowerCase();
  return sub && !FEAT_TYPE_NAMES.has(sub) ? sub : '';
}

const one = s => String(s || '').toLowerCase().replace(/\+\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/ves\b/g, 'f').replace(/(ch|sh|ss)es\b/g, '$1').replace(/([^s])s\b/g, '$1');
/** True when a natural attack ("hoof", "Gore", "claws") is the one a feat's choice names. */
export const attackIs = (name, choice) => !!one(choice) && one(name) === one(choice);

const DICE_STEPS = ['1d1', '1d2', '1d3', '1d4', '1d6', '1d8', '2d6', '3d6', '4d6', '6d6', '8d6', '12d6'];
/** Move a damage die up (+1) or down (-1) a size step. 2d4 and 1d10/1d12 map onto the nearest step. */
export function stepDice(d, steps) {
  const alias = { '2d4': '2d6', '1d10': '2d6', '1d12': '3d6', '2d8': '3d6' };
  let i = DICE_STEPS.indexOf(alias[d] || d);
  if (i < 0) return d;
  i = Math.max(0, Math.min(DICE_STEPS.length - 1, i + steps));
  return DICE_STEPS[i];
}

/**
 * What the weapon feats aimed at one attack add: Weapon Focus +1 attack (Greater +1 more), Weapon Specialization +2 damage (Greater +2 more),
 * Improved Natural Attack one die step each time it is taken, Improved Critical doubles the threat range.
 * `matches(choice)` says whether a feat's choice is this attack.
 */
export function featsForAttack(feats, matches) {
  const out = { atk: 0, dmg: 0, steps: 0, impCrit: false };
  for (const f of feats || []) {
    const fn = featBase(f), ch = featChoice(f);
    if (!CHOICE_FEATS[fn] || !ch || !matches(ch)) continue;
    if (fn.endsWith('weapon focus')) out.atk += 1;
    else if (fn.endsWith('weapon specialization')) out.dmg += 2;
    else if (fn === 'improved natural attack') out.steps += 1;
    else if (fn === 'improved critical') out.impCrit = true;
  }
  return out;
}

/** A weapon's name without its +N ("Lance +2" → "Lance"), the choice Weapon Focus is offered under. */
export const weaponChoiceName = w => (w?.tpl || String(w?.name || '').replace(/\s*\+\d+\s*$/, '')).trim();
