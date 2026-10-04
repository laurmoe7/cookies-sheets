import { ABILITIES, SKILLS } from './data.js';

export const MODEL_VERSION = 1;

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
    avatar: '',   // data URL, small picture beside the name in the top bar
    companions: [], // animal companions, eidolons, familiars (see companions.js)
    hp: { current: null, temp: 0, nonlethal: 0, misc: 0 },
    ac: { natural: 0, deflection: 0, dodge: 0, misc: 0 },
    saveMisc: { fort: 0, ref: 0, will: 0 },
    initMisc: 0, speedMisc: 0, cmbMisc: 0, cmdMisc: 0,
    defenses: { dr: '', sr: '', resist: '', immune: '' },
    armor: [],
    weapons: [],
    skills: SKILLS.map(s => ({ name: s.name, sub: '', ranks: 0, misc: 0, classSkill: false })),
    feats: [], traits: [], specials: [],
    modifiers: [],
    gear: [], money: { pp: 0, gp: 0, sp: 0, cp: 0 },
    spellbooks: {},
    notes: '',
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
  c.version = MODEL_VERSION;
  return c;
}
