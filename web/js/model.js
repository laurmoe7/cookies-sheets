import { ABILITIES, SKILLS } from './data.js';

export const MODEL_VERSION = 2; // 2: a prepared spell's "prepared" count is what is left to cast (casting uses one, resting gives them back)

export function newCharacter() {
  const abilities = {};
  for (const a of ABILITIES) abilities[a] = { base: 10, enh: 0, misc: 0, temp: 0, damage: 0, drain: 0 };
  return {
    version: MODEL_VERSION,
    id: null,
    name: 'New Character',
    player: '', alignment: 'N', deity: '', gender: '', age: '', height: '', weight: '', hair: '', eyes: '',
    homeland: '', languages: 'Common', xpTrack: 'medium', xp: 0,
    race: 'Human', raceChoice: 'str', customRace: { name: '', mods: {}, size: 'Medium', speed: 30 },
    favoredClass: '',
    abilities,
    levelUps: [], // {cls, hp, fcb, fcbNote, abilityIncrease, feats:[], ranks:{skillKey:n}, spells:[], features}
    archetypes: {}, // {Class: [archetype data from features.bakeArchetype]}
    portrait: '', // data URL, large picture on the Overview tab
    portraitSrc: '', avatarSrc: '', // the uncropped pictures, kept so they can be recentered
    doll: '', dollSrc: '', // the picture in the middle of the Inventory tab's paper doll (blank = use the portrait)
    avatar: '',   // data URL, small picture beside the name in the top bar
    summons: [], // tracked Summon Monster / Nature's Ally creatures (top of the Companions tab)
    companions: [], // animal companions, eidolons, familiars (see companions.js)
    hp: { current: null, temp: 0, nonlethal: 0, misc: 0 },
    ac: { natural: 0, deflection: 0, dodge: 0, misc: 0 },
    saveMisc: { fort: 0, ref: 0, will: 0 },
    initMisc: 0, speedMisc: 0, cmbMisc: 0, cmdMisc: 0,
    defenses: { dr: '', sr: '', resist: '', immune: '' },
    armor: [],
    weapons: [],
    skills: SKILLS.map(s => ({ name: s.name, sub: '', ranks: 0, misc: 0, classSkill: false, notes: '' })),
    feats: [], traits: [], specials: [],
    modifiers: [],
    gear: [], money: { pp: 0, gp: 0, sp: 0, cp: 0, custom: [] }, // custom: [{name, amount}] other currencies
    spellbooks: {},
    spellLikes: [], // spell-like abilities: {id?, name, school, summary, notes, level, perDay ('' = at will), used, cl ('' = character level), ability}
    resources: {}, // current points in class pools by id (arcane reservoir...); absent = full for the day
    resourceAdj: {}, // the player's changes to those pools by id: {max, start} extra capacity and extra points at the start of the day
    trackers: [], // the player's own counters {name, max, cur}
    bio: '', // the character's biography (Biography tab)
    story: '', // the plot so far (Notes tab, Story)
    notes: '', // general notes (Notes tab)
    noEncumbrance: false, // true: carried weight is still added up, but the load never slows or penalizes the character
    sessions: [], // {date, name, notes}: the session log on the Notes tab
    npcs: [], // {name, role, attitude, where, notes}
    quests: [], // {name, done, notes}
    lore: [], // {name, kind, notes}: places, factions, items
    quickNotes: '', // the Notes box at the bottom of the Overview tab
  };
}

export function skillKey(s) {
  return s.sub ? `${s.name} (${s.sub})` : s.name;
}

export function migrate(c) {
  const base = newCharacter();
  for (const k of Object.keys(base)) if (c[k] === undefined) c[k] = base[k];
  for (const a of ABILITIES) c.abilities[a] = { ...base.abilities[a], ...(c.abilities[a] || {}) };
  // Archetypes used to be free text ("Acrobat, Scout"); keep the names so they can be looked up again.
  for (const [cls, v] of Object.entries(c.archetypes || {})) {
    if (typeof v === 'string') c.archetypes[cls] = v.split(',').map(n => ({ name: n.trim() })).filter(x => x.name);
  }
  // Weapons, armor and gear saved before enchantments, materials and the paper doll lack their fields; code reads them as "none", this makes them explicit.
  for (const w of c.weapons || []) { w.mw ??= false; w.material ??= ''; w.improvedCritical ??= false; w.fx ||= []; w.slot ??= ''; }
  for (const a of c.armor || []) { a.mw ??= false; a.material ??= ''; a.fx ||= []; }
  for (const g of c.gear || []) { g.slot ??= ''; g.hint ??= ''; g.effects ||= []; }
  for (const w of c.weapons || []) w.dmgAbility ??= ''; // which ability adds to damage ('' = Strength; none for ranged weapons)
  for (const s of c.skills || []) s.notes ??= ''; // a note on each skill (Skills tab)
  c.money = { ...base.money, ...(c.money || {}) };
  if (!Array.isArray(c.money.custom)) c.money.custom = [];
  // Version 1 kept the day's total in "prepared" and counted casts separately; now "prepared" is what is left, so take the casts off once.
  if ((c.version || 1) < 2) {
    for (const book of Object.values(c.spellbooks || {})) {
      for (const s of book.spells || []) s.prepared = Math.max(0, (parseFloat(s.prepared) || 0) - (parseFloat(s.cast) || 0));
    }
  }
  // A save made by a newer build keeps its number, so an older build opening it does not stamp it as its own and re-run steps later.
  // Buffs saved before these effects existed: Haste's extra attack, and Power Attack's x1.5 two-handed damage.
  for (const m of c.modifiers || []) {
    if (m.name === 'Haste' && !(m.effects || []).some(e => e.target === 'extraAttack')) (m.effects ||= []).push({ target: 'extraAttack', value: 1, type: 'untyped' });
    if (m.name === 'Power Attack') for (const e of m.effects || []) if (e.target === 'meleeDamage' && e.scale === undefined) e.scale = true;
  }
  c.version = Math.max(c.version || 1, MODEL_VERSION);
  return c;
}
