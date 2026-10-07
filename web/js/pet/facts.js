// What Cookie notices. `facts` boils a character down to the few numbers and names worth reacting to;
// `diffFacts` compares two of those and says what happened. Pure, so it is tested without a page.

const n = v => Number(v) || 0;
const names = list => (list || []).map(x => String(x?.name || '').trim()).filter(Boolean);
const sum = list => (list || []).reduce((s, x) => s + n(x), 0);

/** @returns {number} All the character's coin in gold pieces. */
export const goldValue = m => n(m?.pp) * 10 + n(m?.gp) + n(m?.sp) / 10 + n(m?.cp) / 100;

/** @param {object} c The character. @param {object} d Its derived numbers (state.derived). */
export function facts(c, d) {
  const casts = {};
  let used = 0;
  for (const book of Object.values(c.spellbooks || {})) {
    for (const s of book.spells || []) { const k = s.name || '?'; casts[k] = (casts[k] || 0) + n(s.cast); used += n(s.cast); }
    used += sum(book.used);
  }
  const hp = d?.hp || { current: 0, max: 0 };
  const byClass = {};
  for (const l of c.levelUps || []) if (l?.cls) byClass[l.cls] = (byClass[l.cls] || 0) + 1;
  const cls = Object.keys(byClass).sort((a, b) => byClass[b] - byClass[a])[0] || '';
  const abil = Object.values(c.abilities || {});
  return {
    who: c.id || c.name || '',
    hp: n(hp.current), max: n(hp.max), temp: n(c.hp?.temp), nl: n(c.hp?.nonlethal),
    con: n(d?.abilities?.con?.score) || 10,
    level: (c.levelUps || []).length,
    cls, race: String(c.race || ''),
    used, casts,
    gear: names(c.gear), weapons: names(c.weapons), armor: names(c.armor),
    feats: names(c.feats), traits: names(c.traits),
    summons: (c.summons || []).map(s => ({ id: s.id, name: s.name, hp: n(s.hp) })),
    companions: names(c.companions),
    mods: (c.modifiers || []).filter(m => m.active).map(m => m.name || 'something'),
    gold: goldValue(c.money),
    custom: (c.money?.custom || []).map(x => n(x.amount)),
    harm: sum(abil.map(a => n(a.damage) + n(a.drain))),
    pools: sum(Object.values(c.resources || {})) + sum((c.trackers || []).map(t => t.cur)),
    xp: n(c.xp),
    portrait: !!c.portrait,
  };
}

/** The names in `now` that were not in `was` (each name counts once per copy). */
export function added(was, now) {
  const left = [...was];
  return now.filter(x => { const i = left.indexOf(x); if (i >= 0) { left.splice(i, 1); return false; } return true; });
}

/** @returns {{type: string}[]} What changed between two `facts`, most important first. Different characters give nothing. */
export function diffFacts(a, b) {
  if (!a || !b || a.who !== b.who) return [];
  const out = [];
  const ev = (type, extra = {}) => out.push({ type, ...extra });
  const dead = f => f.hp <= -f.con, down = f => f.hp <= 0 && !dead(f);

  if (dead(b) && !dead(a)) ev('dead');
  else if (down(b) && !down(a) && !dead(a)) ev('downed', { hp: b.hp, con: b.con });
  else if (b.hp > a.hp && a.hp <= 0 && b.hp > 0) ev('revived', { hp: b.hp });
  else if (b.hp < a.hp) {
    const amount = a.hp - b.hp;
    ev(b.hp <= b.max * 0.25 && b.max > 0 ? 'hp-low' : amount >= Math.max(10, b.max * 0.4) ? 'big-hit' : 'hp-loss', { amount, hp: b.hp, max: b.max });
  } else if (b.hp > a.hp) {
    const amount = b.hp - a.hp;
    ev(b.hp >= b.max && a.hp < b.max * 0.5 ? 'full-heal' : 'hp-heal', { amount, hp: b.hp, max: b.max });
  }
  if (b.temp > a.temp) ev('temp-hp', { amount: b.temp - a.temp });
  if (b.nl > a.nl && b.hp > 0) ev('nonlethal', { amount: b.nl - a.nl });

  if (b.level > a.level) ev('level-up', { level: b.level });
  else if (b.level < a.level) ev('level-down', { level: b.level });

  if (b.used > a.used) {
    const spell = Object.keys(b.casts).find(k => (b.casts[k] || 0) > (a.casts[k] || 0));
    ev('cast', { spell: spell && spell !== '?' ? spell : '' });
  } else if (b.used < a.used) ev('rest');

  for (const s of b.summons) if (!a.summons.some(x => x.id === s.id)) ev('summon', { name: s.name });
  for (const s of a.summons) {
    const now = b.summons.find(x => x.id === s.id);
    if (!now) ev('summon-gone', { name: s.name });
    else if (now.hp <= 0 && s.hp > 0) ev('summon-dead', { name: s.name });
  }
  for (const x of added(a.companions, b.companions)) ev('companion', { name: x });

  for (const x of added(a.weapons, b.weapons)) ev('item', { name: x, kind: 'weapon' });
  for (const x of added(a.armor, b.armor)) ev('item', { name: x, kind: 'armor' });
  for (const x of added(a.gear, b.gear)) ev('item', { name: x, kind: 'gear' });
  for (const x of added(b.gear, a.gear).concat(added(b.weapons, a.weapons), added(b.armor, a.armor))) ev('item-gone', { name: x });

  for (const x of added(a.feats, b.feats)) ev('feat', { name: x });
  for (const x of added(a.traits, b.traits)) ev('trait', { name: x });

  const gain = b.gold - a.gold;
  if (gain >= 1) ev(gain >= 500 ? 'rich' : 'gold-up', { amount: Math.round(gain) });
  else if (gain <= -1) ev(-gain >= 500 ? 'splurge' : 'gold-down', { amount: Math.round(-gain) });
  else if (b.custom.length > a.custom.length || sum(b.custom) > sum(a.custom)) ev('gold-up', { amount: 0 });

  for (const m of added(a.mods, b.mods)) ev('buff-on', { name: m });
  for (const m of added(b.mods, a.mods)) ev('buff-off', { name: m });
  if (b.harm > a.harm) ev('ability-hurt');
  if (b.pools > a.pools) ev('pool-regain'); else if (b.pools < a.pools) ev('pool-spend');
  if (b.xp > a.xp) ev('xp', { amount: b.xp - a.xp });
  if (b.portrait && !a.portrait) ev('portrait');
  return out;
}
