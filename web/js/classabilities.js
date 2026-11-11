// Class features you use (detect evil at will, smite evil 2/day, wild shape, divine bond...), for the Spell-likes card on the
// Spells tab, so they sit next to the spells and do not get forgotten. Pure, no DOM: the page passes each feature's text.

const plain = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Features that are never used on their own: proficiencies, the spells themselves, auras and other always-on bonuses.
const NOT_USED = /^(weapon and armor proficiency|weapon proficiency|armor proficiency|spells|cantrips|orisons|spellbook|domains?|bonus feats?|bonus languages|class skills|aura\b|aura of |divine (grace|health)|evasion|improved evasion|uncanny dodge|improved uncanny dodge|trap ?finding|trap sense|fast movement|danger sense|damage reduction|resist |still mind|purity of body|diamond body|timeless body|perfect self|slow fall|high jump|ac bonus|flurry of blows|unarmed strike|maneuver training|armor training|weapon training|weapon mastery|armor mastery|bravery|favored (enemy|terrain)|track|wild empathy|woodland stride|trackless step|resist nature|venom immunity|a thousand faces|nature sense|nature bond|bloodline|mystery|oracle'?s curse|patron|hex$|hexes|mercy|rage powers?|rogue talents?|advanced talents?|discoveries|discovery|arcane school|arcane bond|cantrip|eschew materials|mutagen$|alchemy|throw anything|poison (resistance|use|immunity)|swift alchemy|brew potion|combat style|endurance|hunter'?s bond|evasion|deeds?$|grit$|panache$|nimble|challenge$|order$|tactician|banner|mount$|expert trainer|tireless rage|indomitable will|mighty rage|greater rage)\b/i;

/**
 * How a feature is used, read from its text: 'At will', '2/day'-style 'Per day', '<kind> action', or null for a passive feature.
 * `name` is the feature's name (some, like "Aura of good", are passive whatever the text says).
 */
export function abilityUse(name, html) {
  if (NOT_USED.test(String(name || '').trim())) return null;
  const t = plain(html).toLowerCase();
  // Daily first: wild shape is "once per day ... at will at 20th level".
  if (/\b(once|twice|\w+ times?) per day\b|\bper day\b|\/day\b|\bonce per\b|\bnumber of times equal\b/.test(t)) return 'Per day';
  if (/\bat will\b/.test(t)) return 'At will';
  // Paid from a pool: channel positive energy uses lay on hands, empty body spends ki, spell recall arcane pool points.
  if (/\b(consumes?|expend(s|ing)?|spend(s|ing)?|uses? up)\b[^.]{0,40}\b(uses?|points?|rounds?)\b/.test(t)) return 'Uses a pool';
  if (/\bas if using the spell\b|\bas the spell\b|\bspell-like ability\b/.test(t)) return 'Spell-like';
  const act = t.match(/\bas an? (standard|move|swift|immediate|free|full-round) action\b/);
  if (act) return `${cap(act[1])} action`;
  return null;
}

/**
 * The usable features, one per ability (the highest level's name wins: "Smite evil 3/day" over "Smite evil 1/day").
 * features: [{name, cls, level, lookup}] (lookup = the compendium name, e.g. "Smite evil"); texts: {lookup: html};
 * pools: classResources() list, matched by their `entry`, so a feature with a tracker shows its uses.
 * Returns [{name, lookup, cls, level, use, pool?}] in class-level order.
 */
export function usableAbilities(features, texts, pools = []) {
  const byPool = new Map(pools.map(p => [String(p.entry || '').toLowerCase(), p]));
  const out = new Map();
  for (const f of features) {
    const key = `${f.cls}|${f.lookup.toLowerCase()}`;
    const pool = byPool.get(f.lookup.toLowerCase());
    const use = pool && !NOT_USED.test(f.name) ? (abilityUse(f.name, texts[f.lookup]) || 'Per day') : abilityUse(f.name, texts[f.lookup]);
    if (!use) continue;
    const prev = out.get(key);
    if (!prev || f.level >= prev.level) out.set(key, { name: f.name, lookup: f.lookup, cls: f.cls, level: prev ? Math.min(prev.level, f.level) : f.level, use, ...(pool ? { pool } : {}) });
  }
  return [...out.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

const inspireCourage = l => (l >= 17 ? 4 : l >= 11 ? 3 : l >= 5 ? 2 : 1);

/**
 * What the ability's side panel offers. `level` is the class level, `mods` the ability modifiers.
 * Returns {rolls: [{label, dice}], dc?: {value, text}, cost?: {pool, n}, buff?: {name, effects, note} | preset?: name, note?}.
 * `cost.pool` is a classResources() id; without one the panel spends from the feature's own pool, if it has one.
 */
export function abilityActions(lookup, cls, { level: L = 1, mods = {}, greaterMercy = false } = {}) {
  const k = String(lookup || '').toLowerCase();
  const m = a => mods[a] || 0;
  const half = Math.floor(L / 2);
  const channel = () => {
    const n = Math.ceil(L / 2); // 1d6 at 1st, +1d6 every two levels after
    return { rolls: [{ label: 'Heal the living', dice: `${n}d6`, group: 'Healing' }, { label: 'Harm undead', dice: `${n}d6`, group: 'Damage' }],
      dc: { value: 10 + half + m('cha'), text: 'Will half (10 + ½ level + Cha)' }, note: '30-foot burst around you.' };
  };
  switch (k) {
    case 'lay on hands':
      // Greater Mercy (Ultimate Magic): +1d6 healing when the target has no condition the paladin's mercies can remove.
      return { rolls: [{ label: 'Heal', dice: `${Math.max(1, half)}d6`, group: 'Healing' },
        ...(greaterMercy ? [{ label: 'Heal, Greater Mercy (nothing to remove)', dice: `${Math.max(1, half) + 1}d6`, group: 'Healing' }] : []),
        { label: 'Harm undead', dice: `${Math.max(1, half)}d6`, group: 'Damage' }],
        touch: true, note: 'Standard action on someone else, swift action on yourself. Undead: melee touch attack.' };
    case 'channel energy': return channel();
    case 'channel positive energy': return { ...channel(), cost: { pool: 'lay-on-hands', n: 2 }, note: '30-foot burst. Uses two uses of lay on hands.' };
    case 'channel negative energy': return { ...channel(), cost: { pool: 'touch-of-corruption', n: 2 } };
    case 'smite evil': case 'smite good': {
      const foe = k.endsWith('evil') ? 'evil' : 'good';
      return { rolls: [], buff: { name: k === 'smite evil' ? 'Smite Evil' : 'Smite Good', effects: [
        { target: 'attack', value: Math.max(0, m('cha')), type: 'untyped' }, { target: 'damage', value: L, type: 'untyped' },
        { target: 'ac', value: Math.max(0, m('cha')), type: 'deflection' }],
      note: `Against the ${foe} target only: +Cha to attack, +${L} damage (×2 on the first hit against ${foe === 'evil' ? 'evil outsiders, dragons and undead' : 'good outsiders, dragons and paladins'}), +Cha deflection to AC against it. Do not also tick “smite” in the damage window.` } };
    }
    case 'rage': return { rolls: [], preset: L >= 20 ? 'Mighty Rage' : L >= 11 ? 'Greater Rage' : 'Rage', note: 'Spend a round of rage each round it lasts.' };
    case 'bardic performance': return { rolls: [], preset: `Inspire Courage +${inspireCourage(L)}`, note: 'Inspire courage; spend a round each round you keep performing.' };
    case 'challenge': return { rolls: [], buff: { name: 'Challenge', effects: [{ target: 'damage', value: L, type: 'untyped' }, { target: 'ac', value: -2, type: 'untyped' }],
      note: `+${L} damage against the challenged target; −2 AC against everyone else.` } };
    case 'quivering palm': return { rolls: [], dc: { value: 10 + half + m('wis'), text: 'Fortitude or die (10 + ½ monk level + Wis)' } };
    case 'stunning fist': return { rolls: [], dc: { value: 10 + half + m('wis'), text: 'Fortitude (10 + ½ level + Wis)' } };
    default: return { rolls: [] };
  }
}
