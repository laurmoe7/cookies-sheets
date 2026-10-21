// The hover text on a roll: what the number is made of, so every + or - has a source. Pure (no DOM), tested in tests/rolltip.test.mjs.

const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);

/**
 * @param title  what is rolled, e.g. "Fortitude save"
 * @param total  the number added to the d20 (or the damage bonus)
 * @param parts  [{label, value}] that add up to total (calc.js builds them); may be missing
 * @param hint   the closing line, e.g. "Click to roll d20+8"
 */
export function tipText(title, total, parts, hint) {
  const lines = [`${title} ${sgn(total)}`];
  const list = (parts || []).filter(p => p && p.value);
  for (const p of list) lines.push(`${sgn(p.value)}  ${p.label}`);
  const sum = list.reduce((n, p) => n + p.value, 0);
  // Anything the breakdown does not cover (for example a companion's listed species bonus) is shown rather than hidden.
  if (list.length && sum !== total) lines.push(`${sgn(total - sum)}  Other bonuses`);
  if (hint) lines.push(hint);
  return lines.join('\n');
}

/**
 * The hover text on a number that is not rolled (AC, hit points, an ability score...): the total, then what adds up to it.
 * @param base   a starting number that is not in parts, e.g. the 10 of AC and CMD
 * @param notes  closing lines, e.g. "Max Dex +3 (armor)"
 */
export function sumText(title, total, parts, { base = 0, unit = '', notes = [] } = {}) {
  const lines = [`${title} ${total}${unit}`];
  if (base) lines.push(`${base}  Base`);
  const list = (parts || []).filter(p => p && p.value);
  // the first number is where the sum starts, so it has no + (a base score, the hit dice, the race's speed)
  list.forEach((p, i) => lines.push(`${!base && !i && p.value > 0 ? p.value : sgn(p.value)}  ${p.label}`));
  const sum = base + list.reduce((n, p) => n + p.value, 0);
  if (sum !== total) lines.push(`${sgn(total - sum)}  Other`);
  return [...lines, ...notes.filter(Boolean)].join('\n');
}
