// Class resource pools that are used up and refilled (Arcanist's arcane reservoir, rage rounds, ki, grit...).
// Pure functions, no DOM. Current values live in c.resources[id]; when absent, the pool is at its daily start.

const lvl = (levels, cls) => levels[cls] || 0;
const atLeast1 = n => Math.max(1, n);

/**
 * Every resource pool the character's classes give, with its capacity (`max`) and what it holds after a night's rest (`start`).
 * `levels` is {Class: level}; `mods` is {str, dex, con, int, wis, cha} ability modifiers.
 * `adj` is the player's own change per pool, {id: {max, start}}: extra capacity (Extra Rage, Extra Reservoir...) and extra points at the start
 * of the day; a blank `start` means the same as `max`.
 */
export function classResources(levels, mods, adj = {}) {
  const out = [];
  const add = (cls, id, name, max, note, { start = max, entry = name } = {}) => out.push({ cls, id, name, max, start, note, entry });
  const L = c => lvl(levels, c);

  if (L('Arcanist')) {
    const l = L('Arcanist');
    add('Arcanist', 'arcane-reservoir', 'Arcane reservoir', 3 + l,
      `Capacity ${3 + l}; each day you start with ${3 + Math.floor(l / 2)}. Consume prepared spells to add 1 point per spell level (up to capacity).`,
      { start: 3 + Math.floor(l / 2), entry: 'Arcane Reservoir' });
  }
  if (L('Magus')) add('Magus', 'arcane-pool', 'Arcane pool', atLeast1(Math.floor(L('Magus') / 2) + mods.int), '½ magus level + Int modifier points per day.', { entry: 'Arcane Pool' });
  if (L('Barbarian')) add('Barbarian', 'rage', 'Rage rounds', 4 + mods.con + 2 * (L('Barbarian') - 1), '4 + Con modifier + 2 per level after 1st, rounds per day.', { entry: 'Rage' });
  if (L('Bloodrager')) add('Bloodrager', 'bloodrage', 'Bloodrage rounds', 4 + mods.con + 2 * (L('Bloodrager') - 1), '4 + Con modifier + 2 per level after 1st, rounds per day.', { entry: 'Bloodrage' });
  if (L('Bard')) add('Bard', 'bardic', 'Bardic performance rounds', 4 + mods.cha + 2 * (L('Bard') - 1), '4 + Cha modifier + 2 per level after 1st, rounds per day.', { entry: 'Bardic Performance' });
  if (L('Skald')) add('Skald', 'raging-song', 'Raging song rounds', 4 + mods.cha + 2 * (L('Skald') - 1), '4 + Cha modifier + 2 per level after 1st, rounds per day.', { entry: 'Raging Song' });
  if (L('Paladin')) add('Paladin', 'lay-on-hands', 'Lay on hands', atLeast1(Math.floor(L('Paladin') / 2) + mods.cha), '½ paladin level + Cha modifier uses per day.', { entry: 'Lay On Hands' });
  if (L('Cleric')) add('Cleric', 'channel', 'Channel energy', 3 + mods.cha, '3 + Cha modifier uses per day.', { entry: 'Channel Energy' });
  if (L('Monk') >= 4) add('Monk', 'ki-monk', 'Ki pool', Math.floor(L('Monk') / 2) + mods.wis, '½ monk level + Wis modifier points.', { entry: 'Ki Pool' });
  if (L('Ninja') >= 2) add('Ninja', 'ki-ninja', 'Ki pool', Math.floor(L('Ninja') / 2) + mods.cha, '½ ninja level + Cha modifier points.', { entry: 'Ki Pool' });
  if (L('Gunslinger')) add('Gunslinger', 'grit', 'Grit', atLeast1(mods.wis), 'Wis modifier (minimum 1) points. Regained when you kill or crit with a firearm.', { entry: 'Grit' });
  if (L('Swashbuckler')) add('Swashbuckler', 'panache', 'Panache', atLeast1(mods.cha), 'Cha modifier (minimum 1) points. Regained when you crit or kill with a light or one-handed piercing weapon.', { entry: 'Panache' });
  if (L('Investigator')) add('Investigator', 'inspiration', 'Inspiration', Math.floor(L('Investigator') / 2) + mods.int, '½ investigator level + Int modifier points per day.', { entry: 'Inspiration' });
  if (L('Alchemist')) add('Alchemist', 'bombs', 'Bombs', L('Alchemist') + mods.int, 'Alchemist level + Int modifier per day.', { entry: 'Bomb' });
  if (L('Inquisitor')) add('Inquisitor', 'judgment', 'Judgments', 1 + Math.floor(L('Inquisitor') / 3), '1 + 1 per 3 inquisitor levels, uses per day.', { entry: 'Judgment' });
  if (L('Warpriest') >= 2) add('Warpriest', 'fervor', 'Fervor', Math.floor(L('Warpriest') / 2) + mods.wis, '½ warpriest level + Wis modifier uses per day.', { entry: 'Fervor' });
  // "1 per day, +1 at 4th and every 3 levels after": 1 + floor((level - 1) / 3)
  const perThree = l => 1 + Math.floor((l - 1) / 3);
  if (L('Paladin')) add('Paladin', 'smite-evil', 'Smite evil', perThree(L('Paladin')), '1 per day, +1 at 4th level and every 3 levels after.', { entry: 'Smite Evil' });
  if (L('Antipaladin')) add('Antipaladin', 'smite-good', 'Smite good', perThree(L('Antipaladin')), '1 per day, +1 at 4th level and every 3 levels after.', { entry: 'Smite Good' });
  if (L('Cavalier')) add('Cavalier', 'challenge', 'Challenge', perThree(L('Cavalier')), '1 per day, +1 at 4th level and every 3 levels after.', { entry: 'Challenge' });
  if (L('Samurai')) add('Samurai', 'challenge-samurai', 'Challenge', perThree(L('Samurai')), '1 per day, +1 at 4th level and every 3 levels after.', { entry: 'Challenge' });
  if (L('Brawler')) add('Brawler', 'martial-flexibility', 'Martial flexibility', atLeast1(Math.floor(L('Brawler') / 2)), '½ brawler level (minimum 1) times per day.', { entry: 'Martial Flexibility' });
  if (L('Druid') >= 4) add('Druid', 'wild-shape', 'Wild shape', Math.min(8, Math.floor(L('Druid') / 2) - 1), '1 per day at 4th level, +1 at every even level after, up to 8 (at will at 20th).', { entry: 'Wild Shape' });
  return out.map(r => {
    const a = adj?.[r.id] || {};
    const bonus = Number(a.max) || 0;
    const startBonus = a.start === '' || a.start == null ? bonus : Number(a.start) || 0;
    const max = Math.max(0, r.max + bonus);
    return { ...r, max, start: Math.max(0, Math.min(r.start + startBonus, max)), baseMax: r.max, bonus, startBonus };
  });
}

/** Points currently held: the stored value, else the start-of-day value. Never below zero. */
export function currentOf(res, stored) {
  const v = stored?.[res.id];
  return Math.max(0, v == null ? res.start : Number(v) || 0);
}
