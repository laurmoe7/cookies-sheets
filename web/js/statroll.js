// Rolling ability scores at character creation (Core Rulebook, "Generating Ability Scores"). Pure: `rng` returns a float in [0, 1).
// The character keeps the rolls in `c.abilityRolls` so the table can see what came up and how many times the player rolled:
// {method, rolls: [{dice, drop, total}] (six of them), assign: {str: index into rolls or null while not placed, ...}, times, date}.

import { ABILITIES } from './data.js';

export const ROLL_METHODS = {
  standard: { label: '4d6, drop the lowest', dice: 4, plus: 0, dropLowest: true },
  classic: { label: '3d6', dice: 3, plus: 0, dropLowest: false },
  heroic: { label: '2d6 + 6', dice: 2, plus: 6, dropLowest: false },
};

/** One score: the dice, the index of the dropped die (-1 if none) and the total. */
export function rollScore(method, rng = Math.random) {
  const m = ROLL_METHODS[method] || ROLL_METHODS.standard;
  const dice = Array.from({ length: m.dice }, () => 1 + Math.floor(rng() * 6));
  const drop = m.dropLowest ? dice.indexOf(Math.min(...dice)) : -1;
  const total = dice.reduce((s, v, i) => s + (i === drop ? 0 : v), 0) + m.plus;
  return { dice, drop, total };
}

/** A fresh set of six, none placed yet. `prev` is the set it replaces, so rerolls are counted. */
export function rollSet(method, prev = null, { rng = Math.random, date = new Date().toISOString().slice(0, 10) } = {}) {
  const rolls = ABILITIES.map(() => rollScore(method, rng));
  return { method, rolls, assign: Object.fromEntries(ABILITIES.map(a => [a, null])), times: (prev?.times || 0) + 1, date };
}

/**
 * Give ability `a` the roll at `idx`; the ability that had it takes `a`'s old roll (or goes back to empty), so each roll is used once.
 * `a` = null takes the roll back to the pool.
 */
export function assignRoll(set, a, idx) {
  const assign = { ...set.assign };
  const other = Object.keys(assign).find(k => assign[k] === idx);
  if (other && other !== a) assign[other] = a ? assign[a] ?? null : null;
  if (a) assign[a] = idx;
  return { ...set, assign };
}

/** The rolls not given to an ability yet, as indexes. */
export const unplaced = set => set.rolls.map((_, i) => i).filter(i => !Object.values(set.assign).includes(i));

/** The base score each ability gets from the set (10 while it has no roll). */
export const rolledBases = set => Object.fromEntries(ABILITIES.map(a => [a, set.rolls[set.assign[a]]?.total ?? 10]));

/** "4 + 5 + 6 (2 dropped)" style text for one roll. */
export function diceText(r, method) {
  const m = ROLL_METHODS[method] || ROLL_METHODS.standard;
  return r.dice.filter((_, i) => i !== r.drop).join(' + ') + (m.plus ? ` + ${m.plus}` : '') + (r.drop >= 0 ? ` (${r.dice[r.drop]} dropped)` : '');
}

/** Sum of ability modifiers before racial adjustments; the Core Rulebook suggests rerolling a set at +0 or less, or with no score above 13. */
export function setQuality(set) {
  const totals = set.rolls.map(r => r.total);
  const mods = totals.reduce((s, t) => s + Math.floor((t - 10) / 2), 0);
  return { mods, low: mods <= 0 || Math.max(...totals) <= 13 };
}
