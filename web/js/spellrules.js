// How many new spells a character may add to their list when they gain a class level.
//
//   Spells-known casters (bard, sorcerer, oracle, ...): up to the class table's "spells known" per level.
//   Spellbook casters: wizard/arcanist/witch start with every cantrip + (3 + Int) 1st-level spells, then
//     add 2 spells of any level they can cast each level; magus adds 1; alchemist/investigator start
//     with (2 + Int) 1st-level formulae and add 1 per level.
//   Everyone else (cleric, druid, paladin, ...) prepares from their whole list and learns nothing.

const SPELLBOOK = {
  Wizard: { cantrips: 'all', first: 3, perLevel: 2 },
  Arcanist: { cantrips: 'all', first: 3, perLevel: 2 },
  Witch: { cantrips: 'all', first: 3, perLevel: 2 },
  Magus: { cantrips: 'all', first: 3, perLevel: 1 },
  Alchemist: { cantrips: 0, first: 2, perLevel: 1 },
  Investigator: { cantrips: 0, first: 2, perLevel: 1 },
};

/**
 * @param def        class definition (classes.json entry)
 * @param classLevel the class level being gained
 * @param known      spells already on the character's list for this class: [{level}]
 * @param sc         spellcasting numbers for this class *after* the level (compute().spellcasting[cls])
 * @param intMod     Intelligence modifier after the level (spellbook casters)
 * @returns {kind: 'known'|'book'|'none', byLevel: {lvl: count}, allCantrips: bool, any: {count, maxLevel}|null}
 */
export function learnAllowance(def, classLevel, known, sc, intMod) {
  const none = { kind: 'none', byLevel: {}, allCantrips: false, any: null };
  if (!def?.casting || !sc) return none;
  const row = def.levels[Math.min(classLevel, 20) - 1];
  const have = l => known.filter(s => s.level === l).length;
  if (row.spells_known) {
    const byLevel = {};
    for (let l = 0; l <= 9; l++) {
      const room = (row.spells_known[l] ?? 0) - have(l);
      if (room > 0) byLevel[l] = room;
    }
    return { kind: 'known', byLevel, allCantrips: false, any: null };
  }
  const book = SPELLBOOK[def.name];
  if (!book) return none;
  const castable = [...Array(10).keys()].filter(l => l > 0 && sc.slots[l] != null);
  const maxLevel = castable.length ? Math.max(...castable) : 0;
  const starting = !known.some(s => s.level > 0);
  if (starting) {
    const byLevel = {};
    if (sc.slots[1] != null) byLevel[1] = Math.max(0, book.first + intMod - have(1));
    if (!byLevel[1]) delete byLevel[1];
    return { kind: 'book', byLevel, allCantrips: book.cantrips === 'all', any: null };
  }
  return { kind: 'book', byLevel: {}, allCantrips: false, any: maxLevel ? { count: book.perLevel, maxLevel } : null };
}

/**
 * What is still left to choose after `picks` ([{level}]) were taken this level.
 * Returns {byLevel: {lvl: n}, any: {count, maxLevel}|null, total}.
 */
export function remaining(allowance, picks) {
  const byLevel = { ...allowance.byLevel };
  let anyLeft = allowance.any ? allowance.any.count : 0;
  for (const p of picks) {
    if (p.level === 0 && allowance.allCantrips) continue; // cantrips are free when you get "all"
    if (byLevel[p.level] > 0) byLevel[p.level]--;
    else if (anyLeft > 0 && allowance.any && p.level > 0 && p.level <= allowance.any.maxLevel) anyLeft--;
  }
  for (const k of Object.keys(byLevel)) if (!byLevel[k]) delete byLevel[k];
  const any = allowance.any && anyLeft > 0 ? { count: anyLeft, maxLevel: allowance.any.maxLevel } : null;
  const total = Object.values(byLevel).reduce((a, b) => a + b, 0) + (any ? any.count : 0);
  return { byLevel, any, total };
}

/** Spell levels a pick may come from right now. */
export function pickableLevels(rem) {
  const set = new Set(Object.keys(rem.byLevel).map(Number));
  if (rem.any) for (let l = 1; l <= rem.any.maxLevel; l++) set.add(l);
  return [...set].sort((a, b) => a - b);
}

const ORD = ['cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'];
/** "2 × 1st-level, 4 × cantrip" style summary. */
export function describeRemaining(rem) {
  const parts = Object.entries(rem.byLevel).sort((a, b) => a[0] - b[0]).map(([l, n]) => `${n} × ${ORD[l]}${n > 1 && l === '0' ? 's' : ''}`);
  if (rem.any) parts.push(`${rem.any.count} of any level up to ${ORD[rem.any.maxLevel].replace('-level', '')}`);
  return parts.join(', ');
}
