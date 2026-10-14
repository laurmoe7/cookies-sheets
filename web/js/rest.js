// A night's rest (8 hours), applied to a character in place. Pure, no DOM: the sheet calls it and shows the summary.
// Rules: hit points come back at 1 per character level, nonlethal damage is gone, each ability's damage drops by 1,
// per-day class pools and spell slots refill, and the spells cast today are prepared again. Drain, temp HP and buffs are left alone.

const num = v => parseFloat(v) || 0;

/** `maxHp` and `level` come from compute(). Returns a list of short sentences saying what changed. */
export function fullRest(c, { maxHp, level }) {
  const said = [];

  const cur = c.hp.current == null || c.hp.current === '' ? maxHp : num(c.hp.current);
  if (cur < maxHp) {
    const now = Math.min(maxHp, cur + Math.max(1, level));
    said.push(`${now - cur} hit points back`);
    c.hp.current = now >= maxHp ? null : now;
  }
  if (num(c.hp.nonlethal)) { c.hp.nonlethal = 0; said.push('nonlethal damage gone'); }

  const healed = [];
  for (const [a, v] of Object.entries(c.abilities || {})) {
    if (num(v.damage) > 0) { v.damage = Math.max(0, num(v.damage) - 1); healed.push(a.toUpperCase()); }
  }
  if (healed.length) said.push(`1 point of ${healed.join(', ')} damage healed`);

  if (Object.keys(c.resources || {}).length) said.push('class pools refilled');
  c.resources = {};
  let trackers = 0;
  for (const t of c.trackers || []) if (num(t.cur) !== num(t.max)) { t.cur = t.max; trackers++; }
  if (trackers) said.push(`${trackers} tracker${trackers === 1 ? '' : 's'} refilled`);

  let spells = false;
  for (const book of Object.values(c.spellbooks || {})) {
    if ((book.used || []).some(n => num(n))) spells = true;
    book.used = Array(10).fill(0);
    for (const s of book.spells || []) {
      if (num(s.cast)) spells = true;
      s.prepared = num(s.prepared) + num(s.cast);
      s.cast = 0;
    }
  }
  for (const s of c.spellLikes || []) if (num(s.used)) { s.used = 0; spells = true; }
  if (spells) said.push('spell slots reset');
  return said;
}
