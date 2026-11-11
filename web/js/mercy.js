// Paladin mercies (Core Rulebook): one at 3rd level and every three levels after, plus one per Extra Mercy feat.
// Each adds its effect to lay on hands whenever it heals one target. Pure, no DOM; views/mercy.js is the window.

// `re` finds the mercy in level-up notes ("Mercy: fatigue", "took Sickened"); `needs` is the mercy it requires first.
export const MERCIES = [
  { name: 'Fatigued', level: 3, re: /\bfatigue/i, text: 'The target is no longer fatigued.' },
  { name: 'Shaken', level: 3, re: /\bshaken\b/i, text: 'The target is no longer shaken.' },
  { name: 'Sickened', level: 3, re: /\bsicken/i, text: 'The target is no longer sickened.' },
  { name: 'Dazed', level: 6, re: /\bdazed?\b/i, text: 'The target is no longer dazed.' },
  { name: 'Diseased', level: 6, re: /\bdisease/i, text: 'Lay on hands also acts as remove disease, with your paladin level as the caster level.', spell: 'remove disease' },
  { name: 'Staggered', level: 6, re: /\bstagger/i, text: 'The target is no longer staggered, unless it is at exactly 0 hit points.' },
  { name: 'Cursed', level: 9, re: /\bcurse/i, text: 'Lay on hands also acts as remove curse, with your paladin level as the caster level.', spell: 'remove curse' },
  { name: 'Exhausted', level: 9, needs: 'Fatigued', re: /\bexhaust/i, text: 'The target is no longer exhausted.' },
  { name: 'Frightened', level: 9, needs: 'Shaken', re: /\bfrighten/i, text: 'The target is no longer frightened.' },
  { name: 'Nauseated', level: 9, needs: 'Sickened', re: /\bnausea/i, text: 'The target is no longer nauseated.' },
  { name: 'Poisoned', level: 9, re: /\bpoison/i, text: 'Lay on hands also acts as neutralize poison, with your paladin level as the caster level.', spell: 'neutralize poison' },
  { name: 'Blinded', level: 12, re: /\bblind/i, text: 'The target is no longer blinded.' },
  { name: 'Deafened', level: 12, re: /\bdeaf/i, text: 'The target is no longer deafened.' },
  { name: 'Paralyzed', level: 12, re: /\bparaly[sz]/i, text: 'The target is no longer paralyzed.' },
  { name: 'Stunned', level: 12, re: /\bstun/i, text: 'The target is no longer stunned.' },
];
export const MERCY_BY_NAME = Object.fromEntries(MERCIES.map(m => [m.name, m]));

const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const featCount = (c, name) => (c.feats || []).filter(f => String(f.name || '').trim().toLowerCase() === name.toLowerCase()).length;

/** How many mercies a paladin of this level has: 3rd, 6th, 9th, 12th, 15th and 18th level, plus one per Extra Mercy feat. */
export function mercyAllowance(level, c = {}) {
  return Math.min(6, Math.floor(Math.max(0, level) / 3)) + featCount(c, 'Extra Mercy');
}

/** Whether a mercy can be chosen now: the paladin level for it, and the mercy it builds on (exhausted needs fatigued...). */
export function canChoose(name, level, chosen = []) {
  const m = MERCY_BY_NAME[name];
  if (!m) return true; // typed in from another book
  return level >= m.level && (!m.needs || chosen.includes(m.needs));
}

/** Mercies written in the notes of paladin levels from 3rd on, as the level-up wizard asks: used until some are chosen on the sheet. */
export function merciesFromNotes(c) {
  let paladin = 0;
  const text = [];
  for (const l of c.levelUps || []) {
    if (l.cls !== 'Paladin') continue;
    paladin++;
    if (paladin >= 3 && paladin % 3 === 0) text.push(l.notes || '');
  }
  for (const f of c.feats || []) if (/^extra mercy$/i.test(String(f.name || '').trim())) text.push([f.choice, f.notes, f.for].filter(Boolean).join(' '));
  const all = text.join('\n');
  return MERCIES.filter(m => m.re.test(all)).map(m => m.name);
}

/** The character's mercies: the ones chosen on the sheet (`c.mercies`), or until then the ones the level-up notes name. */
export function merciesOf(c) {
  return Array.isArray(c.mercies) ? c.mercies.filter(x => typeof x === 'string' && x.trim()) : merciesFromNotes(c);
}

/** Lay on hands' extra effects, one line per mercy, for the side panel and the roll window. `level` is the paladin level. */
export function mercyLines(names, level) {
  return names.map(n => {
    const m = MERCY_BY_NAME[n];
    return { name: n, text: m ? m.text.replace('your paladin level as the caster level', `caster level ${level}`) : 'From another book: see its rules.' };
  });
}

/** Mercies that do not fit the rules any more (too high for the level, or missing the mercy they need), as warnings. */
export function mercyProblems(names, level, c = {}) {
  const out = [];
  const allow = mercyAllowance(level, c);
  if (names.length > allow) out.push(`${names.length} mercies chosen, but a ${ord(level)}-level paladin has ${allow}.`);
  for (const n of names) {
    const m = MERCY_BY_NAME[n];
    if (!m) continue;
    if (level < m.level) out.push(`${n} needs paladin level ${m.level}.`);
    else if (m.needs && !names.includes(m.needs)) out.push(`${n} needs the ${m.needs} mercy.`);
  }
  return out;
}
