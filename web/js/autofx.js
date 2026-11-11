// Flat bonuses that come with a character trait or a racial trait, counted from the sheet without a buff (pure, tested).
// Only the bonuses that are always on are here. "While underground", "against fear", "once per day" and the like stay as text.
// Every trait bonus is typed 'trait' and every racial one 'racial', so they stack (or don't) like the rules say.

const key = s => String(s || '').toLowerCase().replace(/\s*\(.*$/, '').replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

// target -> value, and skill -> value; `cs` lists the skills the trait makes a class skill
const T = (o) => o;
const TRAITS = {
  reactionary: T({ init: 2 }), 'elven reflexes': T({ init: 2 }), 'warrior of old': T({ init: 2 }), tactician: T({ init: 1 }),
  'veteran of battle': T({ init: 1 }), 'arcane temper': T({ init: 1, concentration: 1 }), rapscallion: T({ init: 1, skills: { 'Escape Artist': 1 } }),
  forlorn: T({ fort: 1 }), resilient: T({ fort: 1 }), 'life of toil': T({ fort: 1 }), 'deft dodger': T({ ref: 1 }), 'indomitable faith': T({ will: 1 }),
  'desperate resolve': T({ concentration: 1 }), 'focused mind': T({ concentration: 2 }),
  // +1 on a skill that is also always a class skill
  bastard: T({ skills: { 'Sense Motive': 1 }, cs: ['Sense Motive'] }), brute: T({ skills: { Intimidate: 1 }, cs: ['Intimidate'] }),
  bully: T({ skills: { Intimidate: 1 }, cs: ['Intimidate'] }), omen: T({ skills: { Intimidate: 1 }, cs: ['Intimidate'] }),
  'twinned presence': T({ skills: { Intimidate: 1 }, cs: ['Intimidate'] }), caretaker: T({ skills: { Heal: 1 }, cs: ['Heal'] }),
  'child of the streets': T({ skills: { 'Sleight of Hand': 1 }, cs: ['Sleight of Hand'] }),
  'classically schooled': T({ skills: { Spellcraft: 1 }, cs: ['Spellcraft'] }), 'dangerously curious': T({ skills: { 'Use Magic Device': 1 }, cs: ['Use Magic Device'] }),
  'ease of faith': T({ skills: { Diplomacy: 1 }, cs: ['Diplomacy'] }), 'eyes and ears of the city': T({ skills: { Perception: 1 }, cs: ['Perception'] }),
  seeker: T({ skills: { Perception: 1 }, cs: ['Perception'] }), 'fast talker': T({ skills: { Bluff: 1 }, cs: ['Bluff'] }),
  unpredictable: T({ skills: { Bluff: 1 }, cs: ['Bluff'] }), highlander: T({ skills: { Stealth: 1 }, cs: ['Stealth'] }),
  orphaned: T({ skills: { Survival: 1 }, cs: ['Survival'] }), outcast: T({ skills: { Survival: 1 }, cs: ['Survival'] }),
  'poverty stricken': T({ skills: { Survival: 1 }, cs: ['Survival'] }), suspicious: T({ skills: { 'Sense Motive': 1 }, cs: ['Sense Motive'] }),
  "outcast s intuition": T({ skills: { 'Sense Motive': 1 }, cs: ['Sense Motive'] }), reckless: T({ skills: { Acrobatics: 1 }, cs: ['Acrobatics'] }),
  'black sheep': T({ skills: { 'Knowledge (local)': 1 }, cs: ['Knowledge (local)'] }), 'favored son daughter': T({ skills: { 'Knowledge (local)': 1 }, cs: ['Knowledge (local)'] }),
  "nature s mimic": T({ skills: { 'Knowledge (nature)': 1 }, cs: ['Knowledge (nature)'] }),
  'unintentional linguist': T({ skills: { Linguistics: 1 } }), 'weathered emissary': T({ skills: { Linguistics: 1, Survival: 1 }, cs: ['Linguistics'] }),
  // +1 on skills, no class skill
  acrobat: T({ skills: { Acrobatics: 1 } }), 'beast bond': T({ skills: { 'Handle Animal': 1, Ride: 1 } }),
  civilized: T({ skills: { 'Knowledge (nobility)': 1, 'Knowledge (local)': 1 } }), 'friend in every town': T({ skills: { 'Knowledge (local)': 1, Diplomacy: 1 } }),
  'guardian of the forge': T({ skills: { 'Knowledge (engineering)': 1, 'Knowledge (history)': 1 } }), 'scholar of ruins': T({ skills: { 'Knowledge (geography)': 1, 'Knowledge (dungeoneering)': 1 } }),
  savage: T({ skills: { 'Knowledge (nature)': 1 } }), 'vigilant battler': T({ skills: { 'Sense Motive': 1 } }), 'log roller': T({ skills: { Acrobatics: 1 } }),
  'sea souled': T({ skills: { Swim: 1 } }), 'imposing scion': T({ skills: { Intimidate: 1 } }), 'precise treatment': T({ skills: { Heal: 1 } }),
  'eldritch delver': T({ skills: { 'Knowledge (dungeoneering)': 1, 'Knowledge (history)': 1 } }), 'magic crafter': T({ skills: { Appraise: 1 } }),
};
// "One of these skills (your choice) is always a class skill": `choice` lists the skills, the player's pick is the trait's `choice`.
// Bonuses that only count in some cases (Survival to find food, Diplomacy to gather information) are left out of `skills`.
// `choiceBonus`: the bonus goes only to the skill picked (Style Sage).
Object.assign(TRAITS, {
  'beast bond': T({ skills: { 'Handle Animal': 1, Ride: 1 }, choice: ['Handle Animal', 'Ride'] }),
  'calistrian courtesan': T({ skills: { 'Sense Motive': 1 }, choice: ['Sense Motive', 'Diplomacy'] }),
  'divine courtesan': T({ skills: { 'Sense Motive': 1 }, choice: ['Sense Motive', 'Diplomacy'] }),
  'child of nature': T({ skills: { 'Knowledge (nature)': 1 }, choice: ['Survival', 'Knowledge (nature)'] }),
  'child of the temple': T({ skills: { 'Knowledge (nobility)': 1, 'Knowledge (religion)': 1 }, choice: ['Knowledge (nobility)', 'Knowledge (religion)'] }),
  'devotee of the green': T({ skills: { 'Knowledge (geography)': 1, 'Knowledge (nature)': 1 }, choice: ['Knowledge (geography)', 'Knowledge (nature)'] }),
  'friend in every town': T({ skills: { 'Knowledge (local)': 1, Diplomacy: 1 }, choice: ['Knowledge (local)', 'Diplomacy'] }),
  'guardian of the forge': T({ skills: { 'Knowledge (engineering)': 1, 'Knowledge (history)': 1 }, choice: ['Knowledge (engineering)', 'Knowledge (history)'] }),
  'mathematical prodigy': T({ skills: { 'Knowledge (arcana)': 1, 'Knowledge (engineering)': 1 }, choice: ['Knowledge (arcana)', 'Knowledge (engineering)'] }),
  'scholar of ruins': T({ skills: { 'Knowledge (geography)': 1, 'Knowledge (dungeoneering)': 1 }, choice: ['Knowledge (geography)', 'Knowledge (dungeoneering)'] }),
  'scholar of the great beyond': T({ skills: { 'Knowledge (history)': 1, 'Knowledge (planes)': 1 }, choice: ['Knowledge (history)', 'Knowledge (planes)'] }),
  'style sage': T({ choice: ['Knowledge (local)', 'Knowledge (history)'], choiceBonus: 1 }),
  'well informed': T({ skills: { 'Knowledge (local)': 1 }, choice: ['Diplomacy', 'Knowledge (local)'] }),
});

/** The skills a trait lets the player pick from ("one of these skills, your choice"), or null. */
export const traitChoices = name => TRAITS[key(name)]?.choice || null;

// Standard racial traits that are always on, by race. `trait` is the racial trait's name, so an alternate racial trait that replaces it turns it off.
const RACES = {
  Elf: [{ trait: 'Keen Senses', skills: { Perception: 2 } }],
  Gnome: [{ trait: 'Keen Senses', skills: { Perception: 2 } }],
  'Half-Elf': [{ trait: 'Keen Senses', skills: { Perception: 2 } }],
  'Half-Orc': [{ trait: 'Intimidating', skills: { Intimidate: 2 } }],
  Halfling: [{ trait: 'Halfling Luck', saves: 1, type: 'racial' }, { trait: 'Sure-Footed', skills: { Acrobatics: 2, Climb: 2 } }, { trait: 'Keen Senses', skills: { Perception: 2 } }],
  Aasimar: [{ trait: 'Skilled', skills: { Diplomacy: 2, Perception: 2 } }],
  Tiefling: [{ trait: 'Skilled', skills: { Bluff: 2, Stealth: 2 } }],
  Ganzi: [{ trait: 'Skilled', skills: { 'Sense Motive': 2, Survival: 2 } }],
  Hobgoblin: [{ trait: 'Sneaky', skills: { Stealth: 4 } }],
  Goblin: [{ trait: 'Skilled', skills: { Ride: 4, Stealth: 4 } }],
  Kobold: [{ trait: 'Armor', ac: 1, acType: 'natural armor' }, { trait: 'Crafty', skills: { Perception: 2 } }], // Craft (traps) and Profession (miner) +2 too, but those need a sub-skill
  Catfolk: [{ trait: 'Natural Hunter', skills: { Perception: 2, Stealth: 2, Survival: 2 } }],
  Kitsune: [{ trait: 'Agile', skills: { Acrobatics: 2 } }],
  Changeling: [{ trait: 'Natural Armor', ac: 1, acType: 'natural armor' }],
  Dhampir: [{ trait: 'Manipulative', skills: { Bluff: 2, Perception: 2 } }],
  Drow: [{ trait: 'Keen Senses', skills: { Perception: 2 } }],
  Fetchling: [{ trait: 'Skilled', skills: { 'Knowledge (planes)': 2, Stealth: 2 } }],
  Nagaji: [{ trait: 'Armored Scales', ac: 1, acType: 'natural armor' }, { trait: "Serpent's Sense", skills: { Perception: 2 } }],
  Ratfolk: [{ trait: 'Tinker', skills: { Perception: 2, 'Use Magic Device': 2 } }],
  Suli: [{ trait: 'Negotiator', skills: { Diplomacy: 2, 'Sense Motive': 2 } }],
  Svirfneblin: [{ trait: 'Defensive Training', ac: 2, acType: 'dodge' }, { trait: 'Fortunate', saves: 2, type: 'racial' }, { trait: 'Skilled', skills: { Stealth: 2, Perception: 2 } }],
  Tengu: [{ trait: 'Sneaky', skills: { Perception: 2, Stealth: 2 } }, { trait: 'Gifted Linguist', skills: { Linguistics: 4 } }],
  Vanara: [{ trait: 'Nimble', skills: { Acrobatics: 2, Stealth: 2 } }],
  Vishkanya: [{ trait: 'Keen Senses', skills: { Perception: 2 } }, { trait: 'Limber', skills: { 'Escape Artist': 2, Stealth: 2 } }],
  Wayang: [{ trait: 'Lurker', skills: { Perception: 2, Stealth: 2 } }],
};

/**
 * What the traits and the race add. `mods` are [{target, value, type, source}] in the shape calc.js's modifiers use,
 * `skills` are [{skill, value, type, source}], `classSkills` is a Set of skill names,
 * `choices` are the traits that let the player pick a class skill: [{index (in c.traits), name, options, chosen (or '')}].
 */
export function autoEffects(c) {
  const mods = [], skills = [], classSkills = new Set(), choices = [];
  (c.traits || []).forEach((t, index) => {
    const fx = TRAITS[key(t.name)];
    if (!fx) return;
    for (const k of ['init', 'fort', 'ref', 'will', 'concentration']) if (fx[k]) mods.push({ target: k, value: fx[k], type: 'trait', source: t.name });
    for (const [skill, value] of Object.entries(fx.skills || {})) skills.push({ skill, value, type: 'trait', source: t.name });
    for (const s of fx.cs || []) classSkills.add(s);
    if (fx.choice) {
      const chosen = fx.choice.includes(t.choice) ? t.choice : '';
      choices.push({ index, name: t.name, options: fx.choice, chosen });
      if (chosen) {
        classSkills.add(chosen);
        if (fx.choiceBonus) skills.push({ skill: chosen, value: fx.choiceBonus, type: 'trait', source: t.name });
      }
    }
  });
  const replaced = new Set((c.traits || []).flatMap(t => t.replaces || []).map(key));
  for (const r of RACES[c.race] || []) {
    if (replaced.has(key(r.trait))) continue;
    const src = `${c.race}: ${r.trait}`;
    if (r.saves) for (const k of ['fort', 'ref', 'will']) mods.push({ target: k, value: r.saves, type: r.type || 'racial', source: src });
    if (r.ac) mods.push({ target: 'ac', value: r.ac, type: r.acType || 'racial', source: src });
    for (const [skill, value] of Object.entries(r.skills || {})) skills.push({ skill, value, type: 'racial', source: src });
  }
  return { mods, skills, classSkills, choices };
}
