// Derives every computed number on the sheet from the stored character.
import {
  ABILITIES, SKILL_BY_NAME, SIZES, RACES, STACKING_TYPES, NON_TOUCH_AC, CMD_AC_TYPES, carryingCapacity, XP_TRACKS,
} from './data.js';
import { skillKey } from './model.js';
import { archetypesOf } from './features.js';

export const mod = score => Math.floor((score - 10) / 2);
export const sign = n => (n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n);
export const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

export function bonusSpells(abilityMod, spellLevel) {
  if (spellLevel === 0 || abilityMod < spellLevel) return 0;
  return 1 + Math.floor((abilityMod - spellLevel) / 4);
}

export function evalExpr(v, vars) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (!/^[\d\s+\-*/().,a-z]+$/i.test(s)) return 0;
  const names = s.match(/[a-z]+/gi) || [];
  const allowed = new Set(['bab', 'lvl', 'floor', 'ceil', 'min', 'max']);
  if (names.some(n => !allowed.has(n))) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const r = Function('bab', 'lvl', 'floor', 'ceil', 'min', 'max', `return (${s});`)(
      vars.bab, vars.lvl, Math.floor, Math.ceil, Math.min, Math.max);
    return isFinite(r) ? Math.trunc(r) : 0;
  } catch { return 0; }
}

/** Combine bonuses using Pathfinder stacking rules. Returns {total, byType}. */
export function stack(list) {
  const byType = {};
  const groups = {};
  for (const m of list) {
    if (!m.value) continue;
    (groups[m.type || 'untyped'] ||= []).push(m.value);
  }
  let total = 0;
  for (const [type, vals] of Object.entries(groups)) {
    let t;
    if (STACKING_TYPES.has(type)) t = vals.reduce((a, b) => a + b, 0);
    else {
      const pos = vals.filter(v => v > 0);
      t = (pos.length ? Math.max(...pos) : 0) + vals.filter(v => v < 0).reduce((a, b) => a + b, 0);
    }
    byType[type] = t;
    total += t;
  }
  return { total, byType };
}

const SPEED_REDUCED = { 5: 5, 10: 5, 15: 10, 20: 15, 25: 20, 30: 20, 35: 25, 40: 30, 45: 30, 50: 35, 60: 40, 70: 50, 80: 55, 90: 60, 100: 70, 110: 75, 120: 80 };
const reduceSpeed = s => SPEED_REDUCED[s] ?? Math.round(s * 2 / 3 / 5) * 5;

export function raceInfo(c) {
  if (c.race === 'Custom') {
    const cr = c.customRace || {};
    return { name: cr.name || 'Custom', mods: cr.mods || {}, size: cr.size || 'Medium', speed: num(cr.speed) || 30 };
  }
  const r = RACES[c.race] || RACES.Human;
  const mods = { ...(r.mods || {}) };
  if (r.flex && c.raceChoice) mods[c.raceChoice] = (mods[c.raceChoice] || 0) + 2;
  return { ...r, name: c.race, mods };
}

export function classLevels(c) {
  const out = {};
  for (const lu of c.levelUps) out[lu.cls] = (out[lu.cls] || 0) + 1;
  return out;
}

export function classSkillSet(c, classesByName) {
  const set = new Set();
  for (const cls of Object.keys(classLevels(c))) {
    const own = new Set(classesByName[cls]?.class_skills || []);
    for (const a of archetypesOf(c, cls)) {
      for (const sk of a.classSkills?.remove || []) own.delete(sk);
      for (const sk of a.classSkills?.add || []) own.add(sk);
    }
    for (const sk of own) set.add(sk);
  }
  return set;
}

export function compute(c, classesByName) {
  const d = { abilities: {}, saves: {}, skills: {}, weapons: [], spellcasting: {}, warnings: [] };
  const race = raceInfo(c);
  const size = race.size || 'Medium';
  const sz = SIZES[size] || SIZES.Medium;
  const lvl = c.levelUps.length;
  const levels = classLevels(c);
  d.level = lvl;
  d.classLevels = levels;
  d.race = race;
  d.size = size;

  // ---- class base values ----
  let bab = 0;
  const baseSave = { fort: 0, ref: 0, will: 0 };
  for (const [cls, n] of Object.entries(levels)) {
    const row = classesByName[cls]?.levels[Math.min(n, 20) - 1];
    if (!row) continue;
    bab += row.bab;
    for (const s of ['fort', 'ref', 'will']) baseSave[s] += row[s];
  }
  d.bab = bab;
  const vars = { bab, lvl };

  // ---- modifiers ----
  const mods = {};
  const add = (target, value, type, source, scale) => (mods[target] ||= []).push({ value: evalExpr(value, vars), type, source, scale });
  for (const m of c.modifiers || []) {
    if (!m.active) continue;
    for (const e of m.effects || []) add(e.target, e.value, e.type || 'untyped', m.name, !!e.scale);
  }
  const listOf = (...targets) => targets.flatMap(t => mods[t] || []);

  // ---- ability scores ----
  const increases = {};
  for (const lu of c.levelUps) if (lu.abilityIncrease) increases[lu.abilityIncrease] = (increases[lu.abilityIncrease] || 0) + 1;
  for (const a of ABILITIES) {
    const ab = c.abilities[a];
    const list = [
      ...listOf(a),
      { value: num(ab.enh), type: 'enhancement' }, { value: num(ab.misc), type: 'untyped' }, { value: num(ab.temp), type: 'untyped' },
    ];
    const st = stack(list);
    const racial = race.mods[a] || 0;
    const score = num(ab.base) + racial + (increases[a] || 0) + st.total - num(ab.drain);
    const m = mod(score) - Math.floor(num(ab.damage) / 2);
    d.abilities[a] = { score, mod: m, racial, increase: increases[a] || 0, bonus: st.total, base: num(ab.base) };
  }
  const M = a => d.abilities[a].mod;

  // ---- encumbrance ----
  let weight = 0;
  for (const g of c.gear) weight += num(g.weight) * (g.qty === '' || g.qty == null ? 1 : num(g.qty));
  for (const a of c.armor) weight += num(a.weight);
  for (const w of c.weapons) weight += num(w.weight);
  weight += (num(c.money.pp) + num(c.money.gp) + num(c.money.sp) + num(c.money.cp)) / 50;
  const cap = carryingCapacity(d.abilities.str.score, size);
  let load = 'light';
  if (weight > cap.heavy) load = 'overloaded'; else if (weight > cap.medium) load = 'heavy'; else if (weight > cap.light) load = 'medium';
  d.encumbrance = { weight: Math.round(weight * 10) / 10, ...cap, load };
  const loadMaxDex = load === 'medium' ? 3 : load === 'heavy' || load === 'overloaded' ? 1 : Infinity;
  const loadAcp = load === 'medium' ? -3 : load === 'heavy' || load === 'overloaded' ? -6 : 0;

  // ---- armor ----
  const acList = listOf('ac');
  let armorAcp = 0, maxDex = Infinity, asf = 0, armorSlow = false;
  for (const a of c.armor) {
    if (!a.equipped) continue;
    const isShield = a.type === 'shield';
    acList.push({ value: num(a.bonus) + num(a.enh), type: isShield ? 'shield' : 'armor', source: a.name });
    armorAcp -= Math.abs(num(a.acp));
    if (a.maxDex !== '' && a.maxDex != null && !isNaN(parseInt(a.maxDex))) maxDex = Math.min(maxDex, parseInt(a.maxDex));
    asf += num(a.asf);
    if (!isShield && (a.category === 'medium' || a.category === 'heavy')) armorSlow = true;
  }
  acList.push({ value: num(c.ac.natural), type: 'natural armor' }, { value: num(c.ac.deflection), type: 'deflection' },
    { value: num(c.ac.dodge), type: 'dodge' }, { value: num(c.ac.misc), type: 'untyped' });
  const acp = Math.min(armorAcp, loadAcp);
  const effMaxDex = Math.min(maxDex, loadMaxDex);
  d.acp = acp; d.maxDex = effMaxDex === Infinity ? null : effMaxDex; d.asf = asf;

  const acSt = stack(acList);
  const dexToAc = Math.min(M('dex'), effMaxDex);
  const touchBonus = Object.entries(acSt.byType).filter(([t]) => !NON_TOUCH_AC.has(t)).reduce((s, [, v]) => s + v, 0);
  const dodge = acSt.byType.dodge || 0;
  d.ac = {
    total: 10 + acSt.total + dexToAc + sz.ac,
    touch: 10 + touchBonus + dexToAc + sz.ac,
    flat: 10 + acSt.total - Math.max(dodge, 0) + Math.min(dexToAc, 0) + sz.ac,
    dex: dexToAc, size: sz.ac, byType: acSt.byType,
  };

  // ---- HP ----
  const fcbHp = c.levelUps.filter(l => l.fcb === 'hp').length;
  const hpSt = stack(listOf('hp'));
  d.hp = { max: c.levelUps.reduce((s, l) => s + num(l.hp), 0) + M('con') * lvl + fcbHp + hpSt.total + num(c.hp.misc), fcb: fcbHp };
  d.hp.current = c.hp.current == null || c.hp.current === '' ? d.hp.max : num(c.hp.current);

  // ---- saves ----
  const saveAbility = { fort: 'con', ref: 'dex', will: 'wis' };
  for (const s of ['fort', 'ref', 'will']) {
    const st = stack(listOf('saves', s));
    d.saves[s] = { base: baseSave[s], ability: M(saveAbility[s]), misc: num(c.saveMisc[s]), bonus: st.total,
      total: baseSave[s] + M(saveAbility[s]) + num(c.saveMisc[s]) + st.total };
  }

  // ---- initiative / speed ----
  d.init = M('dex') + num(c.initMisc) + stack(listOf('init')).total;
  let speed = race.speed || 30;
  const dwarfLike = c.race === 'Dwarf';
  if (!dwarfLike && (armorSlow || load === 'medium' || load === 'heavy')) speed = reduceSpeed(speed);
  d.speed = speed + num(c.speedMisc) + stack(listOf('speed')).total;

  // ---- attacks ----
  const meleeSt = stack(listOf('attack', 'melee'));
  const rangedSt = stack(listOf('attack', 'ranged'));
  // Damage bonuses flagged "scale" (Power Attack) are x1.5 two-handed and x0.5 off-hand.
  const meleeDmg = stack(listOf('damage', 'meleeDamage').filter(m => !m.scale));
  const meleeDmgScaled = stack(listOf('damage', 'meleeDamage').filter(m => m.scale));
  const rangedDmg = stack(listOf('damage', 'rangedDamage'));
  d.iteratives = [bab];
  for (let b = bab - 5; b > 0; b -= 5) d.iteratives.push(b);
  d.melee = bab + M('str') + sz.ac + meleeSt.total;
  d.ranged = bab + M('dex') + sz.ac + rangedSt.total;
  // CMB uses attack-roll bonuses, except size bonuses (CMB has its own special size modifier)
  const cmbList = [...(mods.cmb || []), ...listOf('attack', 'melee').filter(m => m.type !== 'size')];
  d.cmb = bab + M('str') + sz.cmb + num(c.cmbMisc) + stack(cmbList).total;
  const cmdAc = Object.entries(acSt.byType).filter(([t]) => CMD_AC_TYPES.has(t)).reduce((s, [, v]) => s + v, 0);
  d.cmd = 10 + bab + M('str') + M('dex') + sz.cmb + num(c.cmdMisc) + cmdAc + stack(listOf('cmd')).total;
  d.cmdFlat = d.cmd - M('dex') - Math.max(dodge, 0);

  for (const w of c.weapons) {
    const ranged = !!w.ranged;
    const abil = w.ability || (ranged ? 'dex' : 'str');
    const atkBase = bab + M(abil) + sz.ac + num(w.enh) + num(w.misc) + (ranged ? rangedSt.total : meleeSt.total);
    const attacks = d.iteratives.map(i => atkBase - bab + i);
    const mult = w.dmgMult === undefined || w.dmgMult === '' ? (ranged ? 0 : 1) : num(w.dmgMult);
    const strM = M('str');
    const strDmg = strM < 0 && mult > 0 ? strM : Math.floor(strM * mult);
    const scaled = ranged ? 0 : Math.floor(meleeDmgScaled.total * (mult === 1.5 ? 1.5 : mult === 0.5 ? 0.5 : 1));
    const dmgBonus = strDmg + num(w.enh) + num(w.dmgMisc) + (ranged ? rangedDmg.total : meleeDmg.total) + scaled;
    d.weapons.push({
      attack: attacks[0], attacks,
      attackText: attacks.map(sign).join('/'),
      damageText: `${w.damage || '—'}${dmgBonus ? (dmgBonus > 0 ? '+' : '') + dmgBonus : ''}`,
      dmgBonus,
    });
  }

  // ---- skills ----
  const csSet = classSkillSet(c, classesByName);
  const skillSt = stack(listOf('skills', 'checks'));
  const humanBonus = race.bonusSkill ? 1 : 0;
  let available = 0;
  for (const lu of c.levelUps) {
    const cls = classesByName[lu.cls];
    available += Math.max(1, (cls?.skill_ranks || 0) + M('int')) + humanBonus + (lu.fcb === 'skill' ? 1 : 0);
  }
  let spent = 0;
  for (const s of c.skills) {
    const def = SKILL_BY_NAME[s.name] || SKILL_BY_NAME[s.name.replace(/ \(.*/, '')] || { ability: 'int', trained: false, acp: false };
    const key = skillKey(s);
    const isClass = s.classSkill || csSet.has(s.name) || csSet.has(s.name.replace(/ \(.*/, ''));
    const ranks = num(s.ranks);
    spent += ranks;
    let total = ranks + M(def.ability) + (isClass && ranks > 0 ? 3 : 0) + num(s.misc) + skillSt.total;
    if (def.acp) total += acp;
    if (s.name === 'Stealth') total += sz.stealth;
    if (s.name === 'Fly') total += sz.fly;
    d.skills[key] = { total, isClass, ability: def.ability, trained: def.trained, untrainedBlocked: def.trained && ranks === 0, acp: def.acp, overMax: ranks > lvl };
  }
  d.skillPoints = { available, spent, maxRanks: lvl };

  // ---- feats ----
  d.featSlots = Math.ceil(lvl / 2) + (race.bonusFeat ? 1 : 0);
  d.abilityIncreases = Math.floor(lvl / 4);

  // ---- XP ----
  const track = XP_TRACKS[c.xpTrack] || XP_TRACKS.medium;
  d.xp = { next: track[lvl] ?? null, levelByXp: track.filter(x => num(c.xp) >= x).length };

  // ---- spellcasting ----
  const clSt = stack(listOf('cl'));
  const concSt = stack(listOf('concentration'));
  for (const [cls, n] of Object.entries(levels)) {
    const def = classesByName[cls];
    if (!def?.casting) continue;
    const row = def.levels[Math.min(n, 20) - 1];
    const cast = def.casting;
    const statMod = M(cast.stat);
    // Diminished Spellcasting archetypes (e.g. kensai): one fewer spell per day of each level.
    const diminished = archetypesOf(c, cls).some(a => a.diminished);
    const cl = Math.max(0, n + (cast.cl_offset || 0)) + clSt.total;
    const book = c.spellbooks?.[cls] || {};
    const slots = [], known = [], dcs = [], prepared = [];
    for (let sl = 0; sl <= 9; sl++) {
      const base = row.spells_per_day?.[sl];
      const canCast = d.abilities[cast.stat].score >= 10 + sl;
      if (base == null || !canCast) slots.push(sl === 0 && (cast.kind === 'spontaneous') && row.spells_known?.[0] != null ? Infinity : null);
      else slots.push(Math.max(0, base - (diminished && sl > 0 ? 1 : 0)) + bonusSpells(statMod, sl) + (book.extraSlot && sl > 0 ? 1 : 0));
      known.push(row.spells_known?.[sl] ?? null);
      prepared.push(row.spells_prepared?.[sl] ?? null);
      dcs.push(10 + sl + statMod);
    }
    d.spellcasting[cls] = {
      cl, stat: cast.stat, statMod, kind: cast.kind, lists: cast.lists, slots, known, prepared, dcs,
      concentration: cl + statMod + concSt.total, maxLevel: cast.max_level, extracts: !!cast.extracts, hasExtraSlot: !!cast.domain,
    };
  }
  return d;
}
