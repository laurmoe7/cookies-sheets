// Derives every computed number on the sheet from the stored character.
import {
  ABILITIES, BUFF_PRESETS, SKILL_BY_NAME, SIZES, RACES, STACKING_TYPES, NON_TOUCH_AC, CMD_AC_TYPES, carryingCapacity, XP_TRACKS,
} from './data.js';
import { skillKey } from './model.js';
import { archetypesOf } from './features.js';
import { weaponFx, parseCrit, doubleThreat, critLabel, multiplyDice } from './weaponfx.js';
import { armorFx, wornFx } from './armorfx.js';
import { wornEffects } from './itemfx.js';
import { autoEffects } from './autofx.js';
import { canFinesse } from './equipment.js';

const SKILL_FEATS = {
  acrobatic: ['Acrobatics', 'Fly'], alertness: ['Perception', 'Sense Motive'], 'animal affinity': ['Handle Animal', 'Ride'],
  athletic: ['Climb', 'Swim'], deceitful: ['Bluff', 'Disguise'], 'deft hands': ['Disable Device', 'Sleight of Hand'],
  'magical aptitude': ['Spellcraft', 'Use Magic Device'], persuasive: ['Diplomacy', 'Intimidate'],
  'self-sufficient': ['Heal', 'Survival'], stealthy: ['Escape Artist', 'Stealth'],
};
// The skill a Skill Focus feat names: its choice box, or the text in brackets after the name
const skillOfFeat = f => ((f.sub || (f.name || '').match(/\((.*)\)/)?.[1] || '').trim().toLowerCase()).replace(/\s*\(.*/, '');

/** The choice a feat was taken for: its choice box, or the text in brackets after the name ("Weapon Focus (Longsword)"). */
const featChoice = f => String(f.sub || (f.name || '').match(/\((.*)\)/)?.[1] || '').trim().toLowerCase();
const singular = s => s.replace(/\+\d+\s*/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/s\b/g, '');
/** True when a weapon on the sheet is the one a Weapon Focus-style feat names ("longsword" matches "Longsword +1"; "bow" does not match "Crossbow"). */
const weaponIs = (w, choice) => {
  const want = singular(choice);
  if (!want) return false;
  return [w.name, w.tpl].some(n => { const h = ' ' + singular(String(n || '').toLowerCase()) + ' '; return h.includes(' ' + want + ' ') || (want.includes(' ') && h.trim() === want); });
};

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

/**
 * The bonuses that actually count in stack(list), one entry per bonus: [{label, value}]. The label is the buff's name and its bonus type, so a
 * roll's hover text can say where each + or - comes from. Bonuses that did not count (a lower bonus of a type that does not stack) are left out.
 */
export function stackParts(list) {
  const groups = {};
  for (const m of list) {
    if (!m.value) continue;
    (groups[m.type || 'untyped'] ||= []).push(m);
  }
  const out = [];
  for (const [type, items] of Object.entries(groups)) {
    const label = m => (m.source || 'Bonus') + (type === 'untyped' ? '' : ' (' + type + ')');
    if (STACKING_TYPES.has(type)) { for (const m of items) out.push({ label: label(m), value: m.value, buff: true }); continue; }
    const pos = items.filter(m => m.value > 0);
    if (pos.length) {
      const best = pos.reduce((a, b) => (b.value > a.value ? b : a));
      out.push({ label: label(best), value: best.value, buff: true });
      // Active but not counted (same type, a better one wins): listed with value 0 so the parts still add up, and `was` for the roll window to show greyed.
      for (const m of pos) if (m !== best) out.push({ label: label(m), value: 0, was: m.value, buff: true, ignored: true });
    }
    for (const m of items.filter(m => m.value < 0)) out.push({ label: label(m), value: m.value, buff: true });
  }
  return out;
}
/** Flattens parts (single entries and lists) and drops the zeros. */
const parts = (...xs) => xs.flat().filter(p => p && (p.value || p.ignored));
const ABIL_SHORT = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

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

/** `opts.noAuto` leaves out what feats, traits and the race add by themselves (the importer uses it to see how much of an old sheet's Misc boxes they now cover). */
export function compute(c, classesByName, opts = {}) {
  const d = { abilities: {}, saves: {}, skills: {}, weapons: [], spellcasting: {}, warnings: [] };
  const bd = d.bd = {}; // where each rolled number comes from: {'saves.fort.total': [{label, value}]}, shown when hovering a roll
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
  for (const g of c.gear || []) for (const e of wornEffects(g)) add(e.target, e.value, e.type || 'untyped', g.name || 'Item', !!e.scale); // worn magic items
  // Feats on the Feats list that give a flat bonus count by themselves. A buff of the same name that is switched on wins, so nothing is counted twice.
  const featName = f => (f.name || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
  const auto = opts.noAuto ? { mods: [], skills: [], classSkills: new Set() } : autoEffects(c);
  for (const m of auto.mods) add(m.target, m.value, m.type, m.source, false);
  const takenFeats = new Set(opts.noAuto ? [] : (c.feats || []).map(featName));
  const buffOn = new Set((c.modifiers || []).filter(m => m.active).map(m => (m.name || '').trim().toLowerCase()));
  for (const p of BUFF_PRESETS) {
    const key = p.name.toLowerCase();
    if (p.group === 'Feat' && takenFeats.has(key) && !buffOn.has(key)) for (const e of p.effects) add(e.target, e.value, e.type || 'untyped', p.name, false);
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
    bd[`abilities.${a}.mod`] = parts({ label: `${ABIL_SHORT[a]} score ${score}`, value: mod(score) }, { label: 'Ability damage', value: -Math.floor(num(ab.damage) / 2) });
  }
  const M = a => d.abilities[a].mod;

  // ---- encumbrance ----
  let weight = 0;
  for (const g of c.gear) weight += num(g.weight) * (g.qty === '' || g.qty == null ? 1 : num(g.qty));
  for (const a of c.armor) weight += num(a.weight) * armorFx(a).weightMult;
  for (const w of c.weapons) weight += num(w.weight) * weaponFx(w).weightMult;
  weight += (num(c.money.pp) + num(c.money.gp) + num(c.money.sp) + num(c.money.cp)) / 50;
  const cap = carryingCapacity(d.abilities.str.score, size);
  let load = 'light';
  if (c.noEncumbrance) load = 'light';
  else if (weight > cap.heavy) load = 'overloaded'; else if (weight > cap.medium) load = 'heavy'; else if (weight > cap.light) load = 'medium';
  d.encumbrance = { weight: Math.round(weight * 10) / 10, ...cap, load, off: !!c.noEncumbrance };
  const loadMaxDex = load === 'medium' ? 3 : load === 'heavy' || load === 'overloaded' ? 1 : Infinity;
  const loadAcp = load === 'medium' ? -3 : load === 'heavy' || load === 'overloaded' ? -6 : 0;

  // ---- armor ----
  const acList = listOf('ac');
  let armorAcp = 0, maxDex = Infinity, asf = 0, armorSlow = false;
  for (const a of c.armor) {
    if (!a.equipped) continue;
    const isShield = a.type === 'shield';
    acList.push({ value: num(a.bonus) + num(a.enh), type: isShield ? 'shield' : 'armor', source: a.name });
    const fx = armorFx(a); // masterwork, mithral and the like change the penalty, the Dex cap and the spell failure
    armorAcp -= Math.max(0, Math.abs(num(a.acp)) + fx.acpDelta);
    if (a.maxDex !== '' && a.maxDex != null && !isNaN(parseInt(a.maxDex))) maxDex = Math.min(maxDex, parseInt(a.maxDex) + fx.maxDexDelta);
    asf += num(a.asf) > 0 ? Math.max(0, num(a.asf) + fx.asfDelta) : 0;
    const cat = fx.lighter ? { heavy: 'medium', medium: 'light' }[a.category] || a.category : a.category; // mithral counts as one category lighter for speed
    if (!isShield && (cat === 'medium' || cat === 'heavy')) armorSlow = true;
  }
  d.armorFx = wornFx(c.armor);
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
  // each level's die plus the Con modifier, never below 1 (a Con penalty cannot take a level to 0 or less)
  d.hp = { max: c.levelUps.reduce((s, l) => s + Math.max(1, num(l.hp) + M('con')), 0) + fcbHp + hpSt.total + num(c.hp.misc), fcb: fcbHp };
  // never above the maximum: when a Constitution buff ends the maximum drops, and what was stored for current HP can be higher than it
  d.hp.current = c.hp.current == null || c.hp.current === '' ? d.hp.max : Math.min(d.hp.max, num(c.hp.current));

  // ---- saves ----
  const saveAbility = { fort: 'con', ref: 'dex', will: 'wis' };
  for (const s of ['fort', 'ref', 'will']) {
    const st = stack(listOf('saves', s));
    d.saves[s] = { base: baseSave[s], ability: M(saveAbility[s]), misc: num(c.saveMisc[s]), bonus: st.total,
      total: baseSave[s] + M(saveAbility[s]) + num(c.saveMisc[s]) + st.total };
    bd[`saves.${s}.total`] = parts({ label: 'Base save (class levels)', value: baseSave[s] }, { label: ABIL_SHORT[saveAbility[s]] + ' modifier', value: M(saveAbility[s]) }, { label: 'Misc', value: num(c.saveMisc[s]) }, stackParts(listOf('saves', s)));
  }

  // ---- initiative / speed ----
  d.init = M('dex') + num(c.initMisc) + stack(listOf('init')).total;
  bd.init = parts({ label: 'Dex modifier', value: M('dex') }, { label: 'Misc', value: num(c.initMisc) }, stackParts(listOf('init')));
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
  d.extraAttacks = Math.min(1, Math.max(0, stack(listOf('extraAttack')).total)); // Haste: one more attack at the best bonus; it does not stack with itself
  if (d.extraAttacks) d.iteratives.push(bab);
  for (let b = bab - 5; b > 0; b -= 5) d.iteratives.push(b);
  d.melee = bab + M('str') + sz.ac + meleeSt.total;
  d.ranged = bab + M('dex') + sz.ac + rangedSt.total;
  bd.melee = parts({ label: 'Base attack bonus', value: bab }, { label: 'Str modifier', value: M('str') }, { label: `Size (${size})`, value: sz.ac }, stackParts(listOf('attack', 'melee')));
  bd.ranged = parts({ label: 'Base attack bonus', value: bab }, { label: 'Dex modifier', value: M('dex') }, { label: `Size (${size})`, value: sz.ac }, stackParts(listOf('attack', 'ranged')));
  // CMB uses attack-roll bonuses, except size bonuses (CMB has its own special size modifier)
  const cmbList = [...(mods.cmb || []), ...listOf('attack', 'melee').filter(m => m.type !== 'size')];
  d.cmb = bab + M('str') + sz.cmb + num(c.cmbMisc) + stack(cmbList).total;
  bd.cmb = parts({ label: 'Base attack bonus', value: bab }, { label: 'Str modifier', value: M('str') }, { label: `Size (${size}, maneuvers)`, value: sz.cmb }, { label: 'Misc', value: num(c.cmbMisc) }, stackParts(cmbList));
  const cmdAc = Object.entries(acSt.byType).filter(([t]) => CMD_AC_TYPES.has(t)).reduce((s, [, v]) => s + v, 0);
  d.cmd = 10 + bab + M('str') + M('dex') + sz.cmb + num(c.cmdMisc) + cmdAc + stack(listOf('cmd')).total;
  // What the number is made of. The AC bonuses of the kinds CMD counts, and every AC penalty (rage's -2, for one), are part of it.
  bd.cmd = parts({ label: 'Base attack bonus', value: bab }, { label: 'Str modifier', value: M('str') }, { label: 'Dex modifier', value: M('dex') },
    { label: `Size (${size}, maneuvers)`, value: sz.cmb }, { label: 'Misc', value: num(c.cmdMisc) },
    stackParts(acList.filter(m => CMD_AC_TYPES.has(m.type || 'untyped'))).map(p => ({ ...p, label: p.label + ' (also counts for AC)' })), stackParts(listOf('cmd')));
  d.cmdFlat = d.cmd - Math.max(M('dex'), 0) - Math.max(dodge, 0); // flat-footed loses a Dex bonus; a Dex penalty stays

  for (const w of c.weapons) {
    const ranged = !!w.ranged;
    // Weapon Finesse: a light melee weapon (or rapier, whip...) left on automatic attacks with Dexterity when that is better; setting the ability on the weapon overrides it
    const finesse = !opts.noAuto && !w.ability && !ranged && canFinesse(w) && (c.feats || []).some(f => featName(f) === 'weapon finesse') && M('dex') > M('str');
    const abil = w.ability || (ranged || finesse ? 'dex' : 'str');
    // Weapon Focus / Specialization (and the greater ones) for this weapon; Improved Critical sets the weapon's flag
    let focusAtk = 0, specDmg = 0, impCrit = false;
    if (!opts.noAuto) for (const f of c.feats || []) {
      const fn = featName(f);
      if (!['weapon focus', 'greater weapon focus', 'weapon specialization', 'greater weapon specialization', 'improved critical'].includes(fn) || !weaponIs(w, featChoice(f))) continue;
      if (fn.endsWith('weapon focus')) focusAtk += 1;
      else if (fn.endsWith('weapon specialization')) specDmg += 2;
      else impCrit = true;
    }
    const fx = weaponFx(impCrit && !w.improvedCritical ? { ...w, improvedCritical: true } : w);
    const condAtk = fx.conds.filter(x => x.on).reduce((n, x) => n + x.atk, 0), condDmg = fx.conds.filter(x => x.on).reduce((n, x) => n + x.dmg, 0);
    const atkBase = bab + M(abil) + sz.ac + num(w.enh) + fx.atkMasterwork + condAtk + num(w.misc) + focusAtk + (ranged ? rangedSt.total : meleeSt.total);
    const iters = fx.speed && !d.extraAttacks ? [d.iteratives[0], ...d.iteratives] : d.iteratives; // a speed weapon: one more attack at the best bonus (Haste does not stack with it)
    const attacks = iters.map(i => atkBase - bab + i);
    // Which ability adds to damage: Strength unless the weapon says otherwise (a ranged weapon adds nothing on "auto"; thrown weapons and composite bows are set to Str on the weapon).
    const dAb = ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(w.dmgAbility) ? w.dmgAbility : 'str';
    const mult = w.dmgAbility === 'none' ? 0 : w.dmgMult === undefined || w.dmgMult === '' ? (ranged && !w.dmgAbility ? 0 : 1) : num(w.dmgMult);
    const strM = M(dAb);
    const strDmg = strM < 0 && mult > 0 ? strM : Math.floor(strM * mult);
    const scaled = ranged ? 0 : Math.floor(meleeDmgScaled.total * (mult === 1.5 ? 1.5 : mult === 0.5 ? 0.5 : 1));
    const dmgBonus = strDmg + num(w.enh) + condDmg + fx.dmgPenalty + num(w.dmgMisc) + specDmg + (ranged ? rangedDmg.total : meleeDmg.total) + scaled;
    const atkBuffs = stackParts(listOf('attack', ranged ? 'ranged' : 'melee'));
    bd[`weapons.${d.weapons.length}.attack`] = parts({ label: 'Base attack bonus', value: bab }, { label: ABIL_SHORT[abil] + ' modifier', value: M(abil) }, { label: `Size (${size})`, value: sz.ac }, { label: 'Weapon enhancement', value: num(w.enh) }, { label: 'Masterwork', value: fx.atkMasterwork }, { label: 'Bane (enhancement against its type)', value: condAtk }, { label: 'Misc (attack)', value: num(w.misc) }, { label: 'Weapon Focus', value: focusAtk }, atkBuffs);
    bd[`weapons.${d.weapons.length}.damage`] = parts({ label: mult === 1 ? ABIL_SHORT[dAb] + ' modifier' : mult === 0 ? ABIL_SHORT[dAb] + ' modifier (not added)' : `${ABIL_SHORT[dAb]} modifier (${mult === 1.5 ? 'x1.5, two-handed' : mult === 0.5 ? 'x0.5, off-hand' : 'x' + mult})`, value: strDmg }, { label: 'Weapon enhancement', value: num(w.enh) }, { label: 'Bane (enhancement against its type)', value: condDmg }, { label: 'Material (alchemical silver)', value: fx.dmgPenalty }, { label: 'Misc (damage)', value: num(w.dmgMisc) }, { label: 'Weapon Specialization', value: specDmg }, stackParts((ranged ? listOf('damage', 'rangedDamage') : listOf('damage', 'meleeDamage')).filter(m => !m.scale)), ranged ? [] : stackParts(listOf('damage', 'meleeDamage').filter(m => m.scale)), // Power Attack by name, then what two hands or the off hand change
      { label: mult === 1.5 ? 'Two-handed (x1.5 on those)' : 'Off-hand (x0.5 on those)', value: scaled - meleeDmgScaled.total });
    // Critical hits: the threat range (doubled by keen or Improved Critical) and the multiplier come from the Crit box.
    const cr = parseCrit(w.crit);
    const crit = cr && { min: fx.keen ? doubleThreat(cr.min) : cr.min, mult: cr.mult };
    const dmgFlat = n => (n ? (n > 0 ? '+' : '') + n : '');
    const extraText = fx.extras.map(x => '+' + x.dice).join('');
    const critBase = crit && multiplyDice(w.damage, crit.mult);
    const critExtras = crit ? fx.critExtras(crit.mult) : [];
    d.weapons.push({
      attack: attacks[0], attacks, ability: abil,
      attackText: attacks.map(sign).join('/'),
      damageText: `${w.damage || '—'}${dmgFlat(dmgBonus)}${extraText}`,
      dmgBonus, extras: fx.extras, fxSummary: fx.summary, fxWarn: fx.warn,
      crit: crit ? critLabel(crit) : '', critMin: crit ? crit.min : 20,
      // Dice and bonuses are multiplied on a critical hit; extra dice from enchantments (flaming, bane...) are not, and bursts add their own.
      critText: crit && critBase ? `${critBase}${dmgFlat(dmgBonus * crit.mult)}${extraText}${critExtras.map(x => '+' + x.dice).join('')}` : '',
      critExtras,
    });
  }

  // ---- skills ----
  const csSet = classSkillSet(c, classesByName);
  const skillSt = stack(listOf('skills', 'checks'));
  // Skill feats: +2 to two skills (+4 once that skill has 10 ranks); Skill Focus is +3 (+6) to the skill named in its choice box
  const featSkillBonus = (name, ranks) => {
    let b = 0;
    if (opts.noAuto) return 0;
    for (const f of c.feats || []) {
      const fn = featName(f);
      const hit = SKILL_FEATS[fn] ? SKILL_FEATS[fn].includes(name) : fn === 'skill focus' && skillOfFeat(f) === name.toLowerCase();
      if (hit) b += (fn === 'skill focus' ? 3 : 2) * (ranks >= 10 ? 2 : 1);
    }
    return b;
  };
  const humanBonus = race.bonusSkill ? 1 : 0;
  // Skill points follow the Intelligence you have for good: base, race, level increases, enhancement and Misc. A spell such as Fox's Cunning, a temp bonus or
  // ability damage does not hand out (or take away) ranks for every level you already have.
  const intItems = (c.gear || []).flatMap(g => wornEffects(g)).filter(e => e.target === 'int').map(e => ({ value: evalExpr(e.value, vars), type: e.type || 'untyped' }));
  const ib = c.abilities.int;
  const intForRanks = mod(num(ib.base) + (race.mods.int || 0) + (increases.int || 0) + stack([...intItems, { value: num(ib.enh), type: 'enhancement' }, { value: num(ib.misc), type: 'untyped' }]).total - num(ib.drain));
  d.skillPoints = { intMod: intForRanks };
  let available = 0;
  for (const lu of c.levelUps) {
    const cls = classesByName[lu.cls];
    available += Math.max(1, (cls?.skill_ranks || 0) + intForRanks) + humanBonus + (lu.fcb === 'skill' ? 1 : 0);
  }
  let spent = 0;
  for (const s of c.skills) {
    const def = SKILL_BY_NAME[s.name] || SKILL_BY_NAME[s.name.replace(/ \(.*/, '')] || { ability: 'int', trained: false, acp: false };
    const key = skillKey(s);
    const isClass = s.classSkill || auto.classSkills.has(s.name) || csSet.has(s.name) || csSet.has(s.name.replace(/ \(.*/, ''));
    const ranks = num(s.ranks);
    spent += ranks;
    const traitSkill = stack(auto.skills.filter(x => x.skill === s.name.replace(/ \(.*/, '')));
    const armorSkill = d.armorFx.skills[s.name] || 0; // shadow, slick, silent moves: a competence bonus from what you wear
    let total = ranks + M(def.ability) + (isClass && ranks > 0 ? 3 : 0) + num(s.misc) + skillSt.total + armorSkill + featSkillBonus(s.name.replace(/ \(.*/, ''), ranks) + traitSkill.total;
    if (def.acp) total += acp;
    if (s.name === 'Stealth') total += sz.stealth;
    if (s.name === 'Fly') total += sz.fly;
    bd[`skills.${key}.total`] = parts({ label: 'Ranks', value: ranks }, { label: ABIL_SHORT[def.ability] + ' modifier', value: M(def.ability) }, { label: 'Class skill', value: isClass && ranks > 0 ? 3 : 0 }, { label: 'Misc', value: num(s.misc) }, stackParts(listOf('skills', 'checks')), { label: 'Feats', value: featSkillBonus(s.name.replace(/ \(.*/, ''), ranks) }, stackParts(auto.skills.filter(x => x.skill === s.name.replace(/ \(.*/, ''))), { label: 'Armor (competence)', value: armorSkill }, { label: 'Armor check penalty', value: def.acp ? acp : 0 }, { label: `Size (${size})`, value: s.name === 'Stealth' ? sz.stealth : s.name === 'Fly' ? sz.fly : 0 });
    d.skills[key] = { total, isClass, ability: def.ability, trained: def.trained, untrainedBlocked: def.trained && ranks === 0, acp: def.acp, overMax: ranks > lvl };
  }
  d.skillPoints = { ...d.skillPoints, available, spent, maxRanks: lvl };

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
    bd[`spellcasting.${cls}.cl`] = parts({ label: `${cls} levels`, value: n }, { label: 'Class caster level adjustment', value: cast.cl_offset || 0 }, stackParts(listOf('cl')));
    bd[`spellcasting.${cls}.concentration`] = parts({ label: 'Caster level', value: cl }, { label: ABIL_SHORT[cast.stat] + ' modifier', value: statMod }, stackParts(listOf('concentration')));
    // Spell Focus / Greater Spell Focus: +1 to the save DC of spells of that school (the DC row is per spell level, so the schools are listed beside it)
    const focus = {};
    if (!opts.noAuto) for (const f of c.feats || []) {
      const fn = featName(f), school = featChoice(f);
      if ((fn === 'spell focus' || fn === 'greater spell focus') && school) focus[school] = (focus[school] || 0) + 1;
    }
    d.spellcasting[cls] = {
      focus, cl, stat: cast.stat, statMod, kind: cast.kind, lists: cast.lists, slots, known, prepared, dcs,
      concentration: cl + statMod + concSt.total, maxLevel: cast.max_level, extracts: !!cast.extracts, hasExtraSlot: !!cast.domain,
    };
  }
  // ---- spell-like abilities: caster level is the character's level unless the ability says otherwise; the save DC uses the ability named on it (Charisma by default) ----
  d.spellLikes = (c.spellLikes || []).map((s, i) => {
    const stat = ['int', 'wis', 'cha'].includes(s.ability) ? s.ability : 'cha';
    const mod = M(stat), cl = Math.max(0, num(s.cl) || d.level), lvl = Math.max(0, Math.min(9, Math.floor(num(s.level))));
    const max = Math.max(0, Math.floor(num(s.perDay))), unlimited = !max;
    bd[`spellLikes.${i}.cl`] = parts({ label: s.cl ? 'Caster level of this ability' : 'Character level', value: cl });
    bd[`spellLikes.${i}.concentration`] = parts({ label: 'Caster level', value: cl }, { label: ABIL_SHORT[stat] + ' modifier', value: mod });
    return { cl, stat, mod, level: lvl, dc: 10 + lvl + mod, concentration: cl + mod, unlimited, max, left: unlimited ? Infinity : Math.max(0, max - Math.floor(num(s.used))) };
  });
  return d;
}
