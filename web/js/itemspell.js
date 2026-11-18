// Casting a spell out of an item: wands, scrolls, potions and oils (the item's own caster level and save DC) and staves (the wielder's,
// when better). Pure, no DOM, tested in tests/itemspell.test.mjs. The roll window itself is roller.js's itemSpellWindow().
//   Wand, scroll, potion: the spell at the lowest caster level that can cast it, DC 10 + spell level + the lowest ability modifier
//     that can cast it (a score of 10 + spell level). A name can say otherwise: "Wand of Fireball (CL 8)".
//   Staff: the wielder's caster level if higher than the staff's, and the wielder's own save DC (ability score and feats).

/** The classes an item's spell level is read from first: a wand of a spell on these lists is made at their level (Core Rulebook, magic item creation). */
const FULL = ['Wizard', 'Cleric', 'Druid', 'Sorcerer'];
/** Other casters with nine spell levels; everyone else (bard, paladin, magus...) gets a new spell level every three caster levels. */
const NINE = new Set([...FULL, 'Oracle', 'Witch', 'Shaman', 'Arcanist', 'Psychic', 'Adept']);

const KINDS = { wand: 'wand', scroll: 'scroll', potion: 'potion', oil: 'potion', elixir: 'potion' };

/**
 * The spell an item is named for: "Wand of Cure Light Wounds (23 charges)", "Scroll of Fireball (CL 8)", "Potion of Barkskin".
 * {kind: 'wand' | 'scroll' | 'potion', spell, cl (when the name gives one, else null)} or null.
 */
export function itemSpellOf(name) {
  const n = String(name || '').trim();
  const cl = /\bCL\s*(\d+)/i.exec(n);
  const m = /^(wand|scroll|potion|oil|elixir) of (.+)$/i.exec(n.replace(/\s*\([^)]*\)/g, '').replace(/,?\s*\bCL\s*\d+(?:st|nd|rd|th)?\b.*$/i, '').trim());
  if (!m || !m[2].trim()) return null;
  return { kind: KINDS[m[1].toLowerCase()], spell: m[2].trim(), cl: cl ? +cl[1] : null };
}

/** A magic item's caster level from its compendium text ("CL 8th"), or null. */
export function itemClFromHtml(html) {
  const m = /<dt>\s*CL\s*<\/dt>\s*<dd>\s*(\d+)/i.exec(String(html || ''));
  return m ? +m[1] : null;
}

/**
 * The level an item holds the spell at and the lowest caster level for it. `levels` is the spell's {Class: level}.
 * Wizard, cleric, druid and sorcerer lists come first (lowest of them); otherwise the lowest level on any list.
 */
export function baseSpellLevel(levels = {}) {
  const pick = names => names.filter(([, l]) => Number.isFinite(l)).sort((a, b) => a[1] - b[1])[0];
  const all = Object.entries(levels || {}).map(([c, l]) => [c, Number(l)]);
  const [cls, level] = pick(all.filter(([c]) => FULL.includes(c))) || pick(all) || ['', 0];
  // Full casters reach spell level L at caster level 2L − 1; the others at 3L − 2 (bard 2nd-level spells at 4th, paladin's at caster level 4).
  return { cls, level, cl: Math.max(1, NINE.has(cls) || !cls ? 2 * level - 1 : 3 * level - 2) };
}

/**
 * The numbers a spell from an item is rolled with: {level, cl, dc, by}.
 * @param kind    'wand' | 'scroll' | 'potion' | 'staff'
 * @param levels  the spell's {Class: level}
 * @param itemCl  the item's caster level when known (a staff's from its text, or "(CL 8)" in a name)
 * @param casters the wielder's casting classes: [{cls, cl, statMod, dcs}] (a staff uses the best one that has the spell on its list)
 * `by` is the wielder's class a staff is used with, or null when the item's own numbers apply.
 */
export function itemCasting({ kind, levels = {}, itemCl = null, casters = [] }) {
  const base = baseSpellLevel(levels);
  const minDc = l => 10 + l + Math.floor(l / 2); // a score of 10 + spell level is the least that can cast it
  if (kind === 'staff') {
    const mine = casters.filter(c => Number.isFinite(Number(levels?.[c.cls])) && levels[c.cls] !== null).sort((a, b) => b.cl - a.cl)[0];
    if (mine) {
      const level = Number(levels[mine.cls]);
      return { level, cl: Math.max(itemCl || 0, mine.cl), dc: mine.dcs?.[level] ?? 10 + level + (mine.statMod || 0), by: mine.cls };
    }
    return { level: base.level, cl: itemCl || Math.max(8, base.cl), dc: minDc(base.level), by: null }; // staves are at least caster level 8
  }
  return { level: base.level, cl: itemCl || base.cl, dc: minDc(base.level), by: null };
}
