// Charges and daily uses on inventory items: wands (50 charges), staves (10, each spell costing 1 or more), items that
// "have 50 charges" (ring of the ram), and items used so many times or rounds per day (boots of speed). Pure, no DOM.
// An item stores g.charges = {max, cur, per: 'total' | 'day', unit: 'charges' | 'uses' | 'rounds', spells?: [{name, cost}]}
// or null. Per-day ones refill on a rest; charges do not (a staff is recharged by hand, a wand never).

const plain = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;?/g, ' ').replace(/\s+/g, ' ').trim();
const WORDS = { once: 1, twice: 2, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const count = w => WORDS[String(w).toLowerCase()] ?? (parseInt(w, 10) || 0);

/** "Wand of cure light wounds (23 charges)": the charges a name says are left, or null. */
const chargesInName = name => { const m = /\((\d+)\s*charges?\)/i.exec(name || ''); return m ? +m[1] : null; };

/** A staff's spells and what each costs, from its text: "Burning hands (1 charge) Fireball (2 charges)". */
export function staffSpells(html) {
  const t = plain(html).replace(/^.*?\b(?:use of the following spells|following spells)\s*:?/i, '');
  const out = [];
  for (const m of t.matchAll(/([A-Za-z][A-Za-z' ,/-]{1,60}?)\s*\((\d+) charges?\)/g)) {
    const name = m[1].replace(/^.*?(?:\.|:)\s*/, '').trim();
    if (name && !out.some(s => s.name.toLowerCase() === name.toLowerCase())) out.push({ name, cost: +m[2] });
  }
  return out;
}

/** The spell a wand holds, from its name: "Wand of Cure Light Wounds (23 charges)" -> "Cure Light Wounds". */
export const wandSpell = name => (/^wand of (.+?)(?:\s*\(.*\))?$/i.exec(String(name || '').trim()) || [])[1] || '';

/**
 * What an item's charges should be, from its name and compendium text: wands and staves by name, "has 50 charges", or
 * "10 rounds each day" / "three times per day". Returns {max, cur, per, unit, spells?} or null when the item has none.
 * `auto` is true for wands, staves and stated charges (safe to apply on adding the item); daily uses are only offered.
 */
export function guessCharges(name, html = '') {
  const n = String(name || '').trim();
  const left = chargesInName(n);
  const t = plain(html);
  if (/^wand\b/i.test(n) && !/key ring/i.test(n)) {
    const sp = wandSpell(n);
    return { max: 50, cur: Math.min(50, left ?? 50), per: 'total', unit: 'charges', ...(sp ? { spells: [{ name: sp, cost: 1 }] } : {}), auto: true };
  }
  if (/^staff\b/i.test(n)) {
    const spells = staffSpells(html);
    return { max: 10, cur: Math.min(10, left ?? 10), per: 'total', unit: 'charges', ...(spells.length ? { spells } : {}), auto: true };
  }
  const has = /\b(?:has|holds|contains|with|of) (\d+) charges\b/i.exec(t);
  if (has) return { max: +has[1], cur: Math.min(+has[1], left ?? +has[1]), per: 'total', unit: 'charges', auto: true };
  const rounds = /\b(?:up to )?(\d+|one|two|three|four|five|six|seven|eight|nine|ten) rounds? (?:each|per|a) day\b/i.exec(t);
  if (rounds) return { max: count(rounds[1]), cur: count(rounds[1]), per: 'day', unit: 'rounds', auto: false };
  const times = /\b(once|twice|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten) times) (?:each|per|a) day\b|\b(\d+)\/day\b/i.exec(t);
  if (times) { const k = times[2] ? +times[2] : count(times[1].split(' ')[0]); if (k) return { max: k, cur: k, per: 'day', unit: 'uses', auto: false }; }
  return null;
}

/** The record to store on the item (drops the `auto` flag). */
export const chargesRecord = g => { if (!g) return null; const { auto, ...rest } = g; return { ...rest, spells: rest.spells ? rest.spells.map(s => ({ ...s })) : undefined }; };

const n0 = v => Math.max(0, Math.round(Number(v)) || 0);
/** Charges left, kept between 0 and the maximum. */
export const chargesLeft = ch => (ch ? Math.min(n0(ch.cur), n0(ch.max)) : 0);

/** Spends `n` (or gives back with a negative n). Returns false, changing nothing, when there are not enough left. */
export function spendCharges(ch, n = 1) {
  if (!ch) return false;
  const left = chargesLeft(ch);
  if (n > 0 && left < n) return false;
  ch.cur = Math.max(0, Math.min(n0(ch.max), left - n));
  return true;
}

/** "37/50 charges", "2/3 uses per day", "10/10 rounds per day". */
export const chargesText = ch => (ch ? `${chargesLeft(ch)}/${n0(ch.max)} ${ch.unit || 'charges'}${ch.per === 'day' ? ' per day' : ''}` : '');

/** A night's rest: items used per day are full again. Returns how many were refilled. */
export function restCharges(c) {
  let k = 0;
  for (const g of c.gear || []) {
    const ch = g.charges;
    if (ch?.per === 'day' && chargesLeft(ch) !== n0(ch.max)) { ch.cur = n0(ch.max); k++; }
  }
  return k;
}
