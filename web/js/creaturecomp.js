// A companion taken from the creature list: its numbers come straight from the Bestiary-style stat block it was copied from
// (data/creatures.json, built by tools/creatures.py). Nothing levels up; the player's adjustments (hp, AC, attack) are added on top.
// Pure functions, no DOM. computeCreature() returns the same shape the Companions tab's panels read from computeCompanion().
import { SIZES } from './data.js';
import { mod } from './calc.js';

const ABILS = [['str', 'strength'], ['dex', 'dexterity'], ['con', 'constitution'], ['int', 'intelligence'], ['wis', 'wisdom'], ['cha', 'charisma']];

/** The first whole number in some text ("+10 (+14 grapple)" -> 10, "—" -> null). Typographic minus signs count as minus. */
export const firstNum = v => {
  const m = String(v ?? '').replace(/[−–—]/g, '-').match(/[+-]?\d+/);
  return m ? parseInt(m[0], 10) : null;
};
const n0 = v => firstNum(v) ?? 0;

/** Splits on separators that sit outside brackets: splitTop('a (b, c), d', [', ']) -> ['a (b, c)', 'd']. */
export function splitTop(text, seps) {
  const out = [];
  let depth = 0, cur = '';
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    const sep = depth === 0 && seps.find(x => s.startsWith(x, i));
    if (sep) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** "2 claws +8 (1d6+4 plus grab), bite +8 (1d6+4)" -> [{name, count, bonus, dice, damage, extra}]. Alternatives ("or") become separate rows. */
export function parseAttacks(text) {
  const out = [];
  for (const part of splitTop(text, [', ', ' or ', ' and '])) {
    const m = /^(?:(\d+)\s+)?(.*?)\s+([+-]\d+(?:\/[+-]\d+)*)\s*(?:melee touch|ranged touch|touch)?\s*\((.*)\)\s*$/i.exec(part);
    if (!m) continue;
    const inner = m[4];
    const d = /(\d*d\d+)\s*([+-]\s*\d+)?/i.exec(inner);
    out.push({
      name: m[2].trim(), count: m[1] ? +m[1] : 1, bonus: parseInt(m[3], 10),
      dice: d ? d[1] : '', damage: d ? d[1] + (d[2] ? d[2].replace(/\s+/g, '') : '') : '',
      extra: d ? inner.slice(d.index + d[0].length).trim() : inner, text: part,
    });
  }
  return out;
}

/** "Perception +12, Stealth +4 (+8 in rocky terrain)" -> [{name, total}] */
export function parseSkills(text) {
  return splitTop(text, [', ']).map(part => {
    const m = /^(.+?)\s+([+-]\d+)\b/.exec(part);
    return m ? { name: m[1].trim(), total: parseInt(m[2], 10) } : null;
  }).filter(Boolean);
}

/** A new companion record for the creature stat block (kept whole in the save, so it works without the creature list). */
export function newCreatureCompanion(block) {
  return { id: Math.random().toString(36).slice(2, 10), kind: 'creature', name: block.name || 'Creature', creature: block, image: '', hpCur: null, hpTemp: 0,
    hpMisc: 0, acMisc: 0, attackMisc: 0, feats: [], skills: {}, tricks: '', notes: '' };
}

/** Everything the companion panels show, worked out from the stat block and the player's adjustments. */
export function computeCreature(comp) {
  const b = comp.creature || {};
  const abilities = Object.fromEntries(ABILS.map(([a, key]) => [a, firstNum(b[key])]));
  const mods = Object.fromEntries(ABILS.map(([a]) => [a, abilities[a] == null ? null : mod(abilities[a])]));
  const M = a => mods[a] ?? 0;
  const size = SIZES[b.size] ? b.size : 'Medium';
  const sz = SIZES[size];
  const hpm = /^(\d+)(?:\s*\((\d+)d\d+)?/.exec(String(b.hp || ''));
  const hd = hpm && hpm[2] ? +hpm[2] : 1;
  const hp = Math.max(1, (hpm ? +hpm[1] : 1) + n0(comp.hpMisc));
  const acm = /^(\d+)(?:,\s*touch\s*(\d+))?(?:,\s*flat-footed\s*(\d+))?\s*(?:\(([^)]*)\))?/i.exec(String(b.ac || ''));
  const natural = acm?.[4] ? n0((/([+-]\d+)\s*natural/i.exec(acm[4]) || [])[1]) : 0;
  const acTotal = acm ? +acm[1] : 10 + M('dex') + sz.ac;
  const acMisc = n0(comp.acMisc);
  const ac = { total: acTotal + acMisc, touch: acm?.[2] ? +acm[2] : acTotal - natural, flat: (acm?.[3] ? +acm[3] : acTotal - M('dex')) + acMisc, natural };
  const saves = { fort: n0(b.fortitude), ref: n0(b.reflex), will: n0(b.will) };
  const stat = v => [{ label: 'Stat block', value: v }].filter(p => p.value);
  const misc = n0(comp.attackMisc);
  const attacks = [...parseAttacks(b.melee), ...parseAttacks(b.ranged)].map(a => ({
    ...a, bonus: a.bonus + misc, secondary: false, parts: [...stat(a.bonus), ...(misc ? [{ label: 'Misc attack bonus', value: misc }] : [])],
  }));
  const bab = n0(b.base_attack);
  return {
    kind: 'creature', size, type: [b.creature_type, b.creature_subtype && `(${b.creature_subtype})`].filter(Boolean).join(' ').toLowerCase(), cr: b.cr || '', hd, level: hd, autoLevel: 0,
    hp, abilities, mods, sizeMods: sz, ac, natural, saves, init: n0(b.init), bab, speed: b.speed || '—',
    cmb: firstNum(b.cmb) ?? bab + M('str') + sz.cmb, cmd: firstNum(b.cmd) ?? 10 + bab + M('str') + M('dex') + sz.cmb,
    bd: { fort: stat(saves.fort), ref: stat(saves.ref), will: stat(saves.will), init: stat(n0(b.init)), cmb: stat(firstNum(b.cmb) ?? 0) },
    attacks, attackCount: attacks.reduce((n, a) => n + a.count, 0), specialAttacks: b.special_attacks || '', qualities: b.special_qualities || '', bonusFeats: b.feats || '',
    specials: [], skills: parseSkills(b.skills).map(k => ({ name: k.name, ranks: 0, total: k.total, isClass: false })), senses: b.senses || '',
    defense: { defensive: b.defensive_abilities || '', dr: b.dr || '', immune: b.immune || '', resist: b.resist || '' }, sr: b.sr || '', weaknesses: b.weaknesses || '',
  };
}
