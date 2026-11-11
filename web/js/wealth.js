// Starting gold (pure, tested). Core Rulebook, Character Advancement: a character made above 1st level starts with the
// Character Wealth by Level table; a 1st-level character rolls (or takes the average of) its class's starting wealth.

/** Character Wealth by Level, in gp, for PCs created above 1st level. */
export const WEALTH_BY_LEVEL = {
  2: 1000, 3: 3000, 4: 6000, 5: 10500, 6: 16000, 7: 23500, 8: 33000, 9: 46000, 10: 62000, 11: 82000,
  12: 108000, 13: 140000, 14: 185000, 15: 240000, 16: 315000, 17: 410000, 18: 530000, 19: 685000, 20: 880000,
};

/** Starting wealth of a 1st-level character: the number of d6 rolled, times 10 gp. */
export const CLASS_GOLD_DICE = {
  Barbarian: 3, Bard: 3, Cleric: 4, Druid: 2, Fighter: 5, Monk: 1, Paladin: 5, Ranger: 5, Rogue: 4, Sorcerer: 2, Wizard: 2,
  Alchemist: 3, Cavalier: 5, Inquisitor: 4, Oracle: 3, Summoner: 2, Witch: 3, Magus: 4, Gunslinger: 5,
  Ninja: 4, Samurai: 5, Antipaladin: 5,
  Arcanist: 2, Bloodrager: 3, Brawler: 3, Hunter: 4, Investigator: 3, Shaman: 2, Skald: 3, Slayer: 5, Swashbuckler: 5, Warpriest: 5,
};

/**
 * What a new character starts with.
 * @param {number} level the level the character starts at (1-20)
 * @param {string} [cls] its 1st-level class, for level 1
 * @returns {{gp: number|null, dice: number|null, source: string}} gp is null at level 1 for a class with no starting-wealth entry
 */
export function startingWealth(level, cls) {
  const lv = Math.max(1, Math.min(20, Math.floor(+level) || 1));
  if (lv > 1) return { gp: WEALTH_BY_LEVEL[lv], dice: null, source: `Wealth by level, ${lv}` };
  const dice = CLASS_GOLD_DICE[cls] ?? null;
  if (!dice) return { gp: null, dice: null, source: cls ? `${cls}: no starting wealth listed` : 'Pick a class' };
  return { gp: dice * 35, dice, source: `${cls}, ${dice}d6 × 10 (average)` }; // average of a d6 is 3.5, times 10 gp
}

/** Roll a 1st-level class's starting gold: Nd6 × 10. rng returns [0, 1). */
export function rollStartingGold(dice, rng = Math.random) {
  const rolls = Array.from({ length: dice }, () => 1 + Math.floor(rng() * 6));
  return { rolls, gp: rolls.reduce((s, r) => s + r, 0) * 10 };
}
