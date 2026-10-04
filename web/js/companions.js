// Stat blocks for animal companions and eidolons, computed from the progression tables and species /
// base-form data in data/companions.json (built by tools/companions.py).
import { mod, num, sign } from './calc.js';
import { SIZES } from './data.js';

export const ANIMAL_SKILLS = ['Acrobatics', 'Climb', 'Escape Artist', 'Fly', 'Intimidate', 'Perception', 'Stealth', 'Survival', 'Swim'];
export const EIDOLON_SKILLS = ['Bluff', 'Craft', 'Knowledge (planes)', 'Perception', 'Sense Motive', 'Stealth'];
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SIZE_ORDER = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];
const SKILL_ABILITY = {
  Acrobatics: 'dex', Appraise: 'int', Bluff: 'cha', Climb: 'str', Craft: 'int', Diplomacy: 'cha', 'Disable Device': 'dex',
  Disguise: 'cha', 'Escape Artist': 'dex', Fly: 'dex', 'Handle Animal': 'cha', Heal: 'wis', Intimidate: 'cha', Linguistics: 'int',
  Perception: 'wis', Perform: 'cha', Profession: 'wis', Ride: 'dex', 'Sense Motive': 'wis', 'Sleight of Hand': 'dex',
  Spellcraft: 'int', Stealth: 'dex', Survival: 'wis', Swim: 'str', 'Use Magic Device': 'cha',
};
export const skillAbility = s => SKILL_ABILITY[s] || (s.startsWith('Knowledge') ? 'int' : 'int');

// Natural attacks: primary unless listed here (Core Rulebook "Natural Attacks").
const SECONDARY = new Set(['hoof', 'hooves', 'tentacle', 'wing', 'wing buffet', 'pincer', 'pincers', 'tail', 'tail slap']);
// Eidolon evolutions that add natural attacks: [name, count, Medium damage, secondary]
const EVOLUTION_ATTACKS = {
  Bite: ['bite', 1, '1d6'], Claws: ['claw', 2, '1d4'], Gore: ['gore', 1, '1d6'], Hooves: ['hoof', 2, '1d4', true],
  Pincers: ['pincer', 2, '1d6', true], Rake: ['rake', 2, '1d4'], Slam: ['slam', 1, '1d8'], Sting: ['sting', 1, '1d4'],
  'Tail Slap': ['tail slap', 1, '1d6', true], Tentacle: ['tentacle', 1, '1d4', true], 'Wing Buffet': ['wing', 2, '1d4', true],
};
const DICE_STEPS = ['1d1', '1d2', '1d3', '1d4', '1d6', '1d8', '2d6', '3d6', '4d6', '6d6', '8d6', '12d6'];
/** Move a damage die up (+1) or down (-1) a size step. 2d4 and 1d10/1d12 map onto the nearest step. */
export function stepDice(d, steps) {
  const alias = { '2d4': '2d6', '1d10': '2d6', '1d12': '3d6', '2d8': '3d6' };
  let i = DICE_STEPS.indexOf(alias[d] || d);
  if (i < 0) return d;
  i = Math.max(0, Math.min(DICE_STEPS.length - 1, i + steps));
  return DICE_STEPS[i];
}

/** Total levels that count toward an animal companion (Core Rulebook + APG/ACG classes). */
export function animalCompanionLevel(levels) {
  return (levels.Druid || 0) + (levels.Hunter || 0) + Math.max(0, (levels.Ranger || 0) - 3) + (levels.Cavalier || 0) + (levels.Samurai || 0);
}

/** Levels that count toward a familiar (wizard, sorcerer and witch levels stack). */
export function familiarLevel(levels) {
  return (levels.Wizard || 0) + (levels.Sorcerer || 0) + (levels.Witch || 0);
}
export const FAMILIAR_CLASS_SKILLS = ['Acrobatics', 'Climb', 'Fly', 'Perception', 'Stealth', 'Swim'];

const hasFeat = (comp, name) => (comp.feats || []).some(f => (f.name || '').toLowerCase() === name.toLowerCase());
const featCount = (comp, name) => (comp.feats || []).filter(f => (f.name || '').toLowerCase() === name.toLowerCase()).length;

/**
 * @param comp     companion record from c.companions
 * @param levels   owner's class levels ({Druid: 5, ...})
 * @param data     companions.json
 * @param master   the owner's numbers a familiar borrows: {bab, saves: {fort, ref, will}, hp, ranks: {skill: ranks}}
 */
export function computeCompanion(comp, levels, data, master = {}) {
  if (comp.kind === 'familiar') return computeFamiliar(comp, levels, data.familiar, master);
  if (comp.kind === 'animal') return computeAnimal(comp, levels, data.animal);
  if (comp.kind === 'eidolon') return computeEidolon(comp, levels, data.eidolon);
  return null;
}

function finish(out, comp) {
  const M = a => (out.abilities[a] == null ? 0 : mod(out.abilities[a]));
  out.mods = Object.fromEntries(ABIL.map(a => [a, out.abilities[a] == null ? null : M(a)]));
  const sz = SIZES[out.size] || SIZES.Medium;
  out.sizeMods = sz;
  const dodge = hasFeat(comp, 'Dodge') ? 1 : 0;
  out.ac = { total: 10 + out.natural + M('dex') + sz.ac + dodge + num(comp.acMisc), touch: 10 + M('dex') + sz.ac + dodge,
    flat: 10 + out.natural + Math.min(0, M('dex')) + sz.ac + num(comp.acMisc), natural: out.natural };
  const conHp = out.abilities.con == null ? 0 : M('con') * out.hd;
  const toughness = hasFeat(comp, 'Toughness') ? Math.max(3, out.hd) : 0;
  out.hp = out.hpFixed != null ? Math.max(1, out.hpFixed + num(comp.hpMisc))
    : Math.max(1, Math.floor(out.hd * out.hdAvg) + conHp + toughness + num(comp.hpMisc));
  out.saves.fort += M('con') + (hasFeat(comp, 'Great Fortitude') ? 2 : 0);
  out.saves.ref += M('dex') + (hasFeat(comp, 'Lightning Reflexes') ? 2 : 0);
  out.saves.will += M('wis') + (hasFeat(comp, 'Iron Will') ? 2 : 0);
  out.init = M('dex') + (hasFeat(comp, 'Improved Initiative') ? 4 : 0);
  out.cmb = out.bab + M('str') + sz.cmb;
  out.cmd = 10 + out.bab + M('str') + M('dex') + sz.cmb + dodge;
  // Natural attacks: full BAB; Str (or Dex with Weapon Finesse); secondary attacks -5 (-2 with Multiattack) and ½ Str.
  const finesse = (out.finesseAlways || hasFeat(comp, 'Weapon Finesse')) && M('dex') > M('str');
  const multi = hasFeat(comp, 'Multiattack') || (out.multiattackSpecial && out.attacks.reduce((n, a) => n + a.count, 0) >= 3);
  const totalAttacks = out.attacks.reduce((n, a) => n + a.count, 0);
  const strM = M('str');
  out.attacks = out.attacks.map(a => {
    const secondary = a.secondary ?? SECONDARY.has(a.name);
    const bonus = out.bab + (finesse ? M('dex') : strM) + sz.ac + num(comp.attackMisc) - (secondary ? (multi ? 2 : 5) : 0);
    const mult = totalAttacks === 1 && !secondary ? 1.5 : secondary ? 0.5 : 1;
    const dmg = strM < 0 ? strM : Math.floor(strM * mult);
    return { ...a, secondary, bonus, damage: a.dice ? `${a.dice}${dmg ? sign(dmg) : ''}` : '',
      text: `${a.count > 1 ? a.count + ' ' : ''}${a.count > 1 ? plural(a.name) : a.name} ${sign(bonus)} (${a.dice ? a.dice + (dmg ? sign(dmg) : '') : '—'}${a.extra ? ' ' + a.extra : ''})` };
  });
  // Skills
  out.skills = Object.entries(comp.skills || {}).filter(([, r]) => num(r) > 0).map(([name, r]) => {
    const isClass = out.classSkills.includes(name) || (comp.extraClassSkills || []).includes(name);
    const ab = skillAbility(name);
    let total = num(r) + (out.abilities[ab] == null ? 0 : M(ab)) + (isClass ? 3 : 0);
    if (name === 'Stealth') total += sz.stealth;
    if (name === 'Fly') total += sz.fly;
    return { name, ranks: num(r), total, isClass };
  });
  out.skillRanksUsed = out.skills.reduce((n, s) => n + s.ranks, 0);
  out.featsUsed = (comp.feats || []).length;
  return out;
}
const plural = n => (n.endsWith('f') ? n.slice(0, -1) + 'ves' : n.endsWith('s') || n.endsWith('sh') || n.endsWith('ch') ? n + 'es' : n + 's');

/** Specials from every progression row up to `level`, with "Ability score increase" counted. */
function specialsUpTo(prog, level) {
  const list = [];
  let increases = 0;
  for (const r of prog.slice(0, level)) {
    for (const s of r.special) {
      if (/ability score increase/i.test(s)) increases++;
      else if (!list.some(x => x.toLowerCase() === s.toLowerCase())) list.push(s[0].toUpperCase() + s.slice(1));
    }
  }
  return { list, increases };
}

function computeAnimal(comp, levels, data) {
  const auto = animalCompanionLevel(levels);
  const level = Math.max(1, Math.min(20, num(comp.levelOverride) || auto || 1));
  const row = data.progression[level - 1];
  const sp = data.species.find(s => s.name === comp.species) || data.species.find(s => s.name === 'Wolf') || data.species[0];
  const adv = sp.advance && level >= sp.advance.level ? sp.advance : null;
  const abilities = { ...sp.abilities };
  if (adv) for (const [a, d] of Object.entries(adv.abilities || {})) if (abilities[a] != null && d != null) abilities[a] += d;
  abilities.str += row.strDex;
  abilities.dex += row.strDex;
  const { list: specials, increases } = specialsUpTo(data.progression, level);
  (comp.increases || []).slice(0, increases).forEach(a => { if (a && abilities[a] != null) abilities[a] += 1; });
  const attacks = (adv?.attacks?.length ? adv.attacks : sp.attacks).map(a => ({ ...a }));
  const out = {
    kind: 'animal', level, autoLevel: auto, species: sp, advanced: !!adv, size: (adv?.size || sp.size || 'Medium'),
    speed: sp.speed, abilities, hd: row.hd, hdAvg: 4.5, hdDie: 8, bab: row.bab,
    saves: { fort: row.fort, ref: row.ref, will: row.will }, natural: sp.natural + (adv?.natural || 0) + row.natural + featCount(comp, 'Improved Natural Armor'),
    attacks, specials, increases, skillRanks: row.skills, featSlots: row.feats, bonusTricks: row.tricks, multiattackSpecial: specials.some(s => /multiattack/i.test(s)),
    qualities: [sp.specialQualities, adv?.specialQualities].filter(Boolean).join(', '),
    specialAttacks: [sp.specialAttacks, adv?.specialAttacks].filter(Boolean).join(', '),
    bonusFeats: [sp.bonusFeat, adv?.bonusFeat].filter(Boolean).join(', '),
    classSkills: ANIMAL_SKILLS,
  };
  return finish(out, comp);
}

function computeFamiliar(comp, levels, data, master) {
  const auto = familiarLevel(levels);
  const level = Math.max(1, Math.min(20, num(comp.levelOverride) || auto || 1));
  const sp = data.species.find(x => x.name === comp.species) || data.species[0];
  const rows = data.progression.filter(r => r.minLevel <= level);
  const row = rows[rows.length - 1];
  const specials = [];
  for (const r of rows) for (const x of r.special) specials.push(x[0].toUpperCase() + x.slice(1));
  if (level >= 11) specials.push(`Spell resistance ${level + 5}`);
  const abilities = { ...sp.abilities, int: row.int };
  const ranks = master.ranks || {};
  const mBase = master.saves || {};
  const out = {
    kind: 'familiar', level, autoLevel: auto, species: sp, size: sp.size, speed: sp.speed, abilities,
    hd: Math.max(1, level), hdAvg: 4.5, hdDie: 8, hpFixed: Math.floor((master.hp ?? Math.floor(level * 4.5)) / 2),
    bab: master.bab ?? 0,
    // Base saves: the familiar's own (2/2/0) or the master's, whichever is better.
    saves: { fort: Math.max(2, mBase.fort ?? 0), ref: Math.max(2, mBase.ref ?? 0), will: Math.max(0, mBase.will ?? 0) },
    natural: sp.natural + row.natural, attacks: (sp.attacks || []).map(a => ({ ...a })), specials, increases: 0,
    skillRanks: 0, featSlots: 0, finesseAlways: true, multiattackSpecial: false,
    qualities: sp.specialQualities, specialAttacks: sp.specialAttacks, bonusFeats: sp.feats.join(', '), classSkills: FAMILIAR_CLASS_SKILLS,
  };
  finish(out, comp);
  // Skills: the better of the animal's listed bonus or the master's ranks with the familiar's own ability modifier.
  const sz = out.sizeMods;
  const names = [...new Set([...Object.keys(sp.skills), ...Object.keys(ranks).filter(k => num(ranks[k]) > 0)])]
    .filter(n => !n.includes('(') && !/ when | to /.test(n));
  out.skills = names.map(name => {
    const r = num(ranks[name]);
    const ab = skillAbility(name);
    const isClass = FAMILIAR_CLASS_SKILLS.includes(name);
    let own = r > 0 ? r + (out.mods[ab] ?? 0) + (isClass ? 3 : 0) + (sp.racial[name] || 0) : -Infinity;
    if (r > 0 && name === 'Stealth') own += sz.stealth;
    if (r > 0 && name === 'Fly') own += sz.fly;
    const book = sp.skills[name];
    return { name, ranks: r, total: Math.max(book ?? -Infinity, own), isClass, fromMaster: own > (book ?? -Infinity) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  out.skillRanksUsed = 0;
  return out;
}

function computeEidolon(comp, levels, data) {
  const auto = levels.Summoner || 0;
  const level = Math.max(1, Math.min(20, num(comp.levelOverride) || auto || 1));
  const row = data.progression[level - 1];
  const form = data.forms.find(f => f.name === comp.form) || data.forms[0];
  const abilities = { ...form.abilities };
  abilities.str += row.strDex;
  abilities.dex += row.strDex;
  const { list: specials, increases } = specialsUpTo(data.progression, level);
  (comp.increases || []).slice(0, increases).forEach(a => { if (a && abilities[a] != null) abilities[a] += 1; });
  let size = form.size || 'Medium';
  let natural = form.natural + row.natural;
  const attacks = form.attacks.map(a => ({ ...a }));
  const chosen = comp.evolutions || [];
  let spent = 0;
  for (const e of chosen) {
    const def = data.evolutions.find(x => x.name === e.name);
    spent += def ? def.cost : num(e.cost);
    if (e.name === 'Ability Increase' && abilities[e.choice] != null) abilities[e.choice] += 2;
    if (e.name === 'Improved Natural Armor') natural += 2;
    if (e.name === 'Large') { size = 'Large'; abilities.str += 8; abilities.con += 4; abilities.dex -= 2; natural += 2; }
    const atk = EVOLUTION_ATTACKS[e.name];
    if (atk) {
      const existing = attacks.find(a => a.name === atk[0]);
      if (existing && e.name !== 'Claws' && e.name !== 'Tentacle') existing.count += atk[1];
      else attacks.push({ name: atk[0], count: atk[1], dice: atk[2], extra: '', secondary: !!atk[3] });
    }
  }
  for (const e of chosen.filter(x => x.name === 'Improved Damage')) {
    const a = attacks.find(x => x.name === (e.choice || '').toLowerCase()) || attacks[0];
    if (a) a.dice = stepDice(a.dice, 1);
  }
  const steps = SIZE_ORDER.indexOf(size) - SIZE_ORDER.indexOf(form.size || 'Medium');
  if (steps) for (const a of attacks) a.dice = stepDice(a.dice, steps);
  const good = new Set(form.good);
  const out = {
    kind: 'eidolon', level, autoLevel: auto, form, size, speed: form.speed, abilities, hd: row.hd, hdAvg: 5.5, hdDie: 10,
    bab: row.bab, saves: { fort: good.has('fort') ? row.good : row.bad, ref: good.has('ref') ? row.good : row.bad, will: good.has('will') ? row.good : row.bad },
    natural: natural + featCount(comp, 'Improved Natural Armor'), attacks, specials, increases, skillRanks: row.skills, featSlots: row.feats,
    pool: row.pool, spent, maxAttacks: row.maxAttacks, multiattackSpecial: specials.some(s => /multiattack/i.test(s)),
    free: form.free, qualities: '', specialAttacks: '', bonusFeats: '', classSkills: EIDOLON_SKILLS,
  };
  out.attackCount = attacks.reduce((n, a) => n + a.count, 0);
  return finish(out, comp);
}

/** A new companion record of the given kind, with sensible starting choices. */
export function newCompanion(kind, data) {
  const base = { id: Math.random().toString(36).slice(2, 10), kind, name: '', levelOverride: '', increases: [], feats: [], skills: {},
    extraClassSkills: [], hpMisc: 0, acMisc: 0, attackMisc: 0, tricks: '', notes: '' };
  if (kind === 'animal') return { ...base, name: 'Animal companion', species: 'Wolf' };
  if (kind === 'eidolon') return { ...base, name: 'Eidolon', form: data?.eidolon?.forms?.[0]?.name || 'Biped', evolutions: [] };
  if (kind === 'familiar') return { ...base, name: 'Familiar', species: data?.familiar?.species?.[0]?.name || 'Cat' };
  return { ...base, name: 'Companion', statblock: '' };
}
