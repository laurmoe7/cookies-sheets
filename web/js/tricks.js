// Animal tricks (Handle Animal): the trick list, general-purpose training, and the companion's trick list (pure, tested).
// A companion keeps its tricks as plain text, one per comma ("attack, come, maneuver (trip)"), so old saves typed by hand still read,
// and a trick the list does not know stays as the player wrote it.

const CORE = 'Core Rulebook', AA = 'Animal Archive', PC = 'Player Companion', OTHER = 'Other books';

/** name, Handle Animal DC to teach it, book, what it does, and what it needs (other tricks, or a note). */
export const TRICKS = [
  { name: 'Attack', dc: 20, source: CORE, text: 'Attacks apparent enemies; you can point out the one to attack. Normally only humanoids, monstrous humanoids, giants and animals.' },
  { name: 'Attack (any creature)', dc: 20, source: CORE, weight: 2, text: 'Attacks any creature you point out, undead and aberrations too. Counts as two tricks, in place of Attack.' },
  { name: 'Come', dc: 15, source: CORE, text: 'Comes to you, even if it normally would not.' },
  { name: 'Defend', dc: 20, source: CORE, text: 'Defends you (or a character you name) without being told.' },
  { name: 'Down', dc: 15, source: CORE, text: 'Breaks off from combat. Without it, the animal fights until it must flee or the foe falls.' },
  { name: 'Fetch', dc: 15, source: CORE, text: 'Goes and gets something; a random object if you do not point one out.' },
  { name: 'Guard', dc: 20, source: CORE, text: 'Stays in place and keeps others from approaching.' },
  { name: 'Heel', dc: 15, source: CORE, text: 'Follows you closely, even where it normally would not go.' },
  { name: 'Perform', dc: 15, source: CORE, text: 'Simple tricks: sitting up, rolling over, roaring or barking.' },
  { name: 'Seek', dc: 15, source: CORE, text: 'Moves into an area and looks for anything obviously alive or animate.' },
  { name: 'Stay', dc: 15, source: CORE, text: 'Waits in place for you; still defends itself.' },
  { name: 'Track', dc: 20, source: CORE, needsNote: 'scent', text: 'Tracks the scent you present to it. Needs the scent ability.' },
  { name: 'Work', dc: 15, source: CORE, text: 'Pulls or pushes a medium or heavy load.' },

  { name: 'Aid', dc: 20, source: AA, text: 'Uses aid another for an ally you name, against a foe you point out.' },
  { name: 'Bombard', dc: 20, source: AA, needsNote: 'flying', text: 'A flier drops a carried splash weapon or object on a target.' },
  { name: 'Break Out', dc: 20, source: AA, text: 'Gnaws or breaks bonds, lifts latches, or fetches an unattended key.' },
  { name: 'Build Simple Structure', dc: 25, source: AA, text: 'Builds what its kind builds naturally (a dam, a nest) where you ask.' },
  { name: 'Bury', dc: 15, source: AA, text: 'Buries an object it holds; with Fetch, digs it up again.' },
  { name: 'Cocoon', dc: 15, source: AA, needs: ['Spin Silk'], text: 'Wraps an object or a helpless or willing creature in web.' },
  { name: 'Demolish', dc: 15, source: AA, needs: ['Attack'], text: 'Attacks objects and structures.' },
  { name: 'Detect', dc: 25, source: AA, text: 'Uses Perception to pinpoint a danger, smell, noise or secret door it was trained for.' },
  { name: 'Entertain', dc: 25, source: AA, text: 'Performs to distract onlookers (a Perform check).' },
  { name: 'Feint', dc: 20, source: AA, needs: ['Attack'], text: 'Feints against a target it would attack.' },
  { name: 'Flank', dc: 20, source: AA, needs: ['Attack'], text: 'Attacks a foe and moves to flank it, even at some risk.' },
  { name: 'Flee', dc: 20, source: AA, text: 'Runs away or hides, and comes back only when called.' },
  { name: 'Get Help', dc: 20, source: AA, text: 'Fetches one of the creatures it was taught to treat as “help” (one per point of Int).' },
  { name: 'Guide', dc: 15, source: AA, text: 'Leads a blinded character around obstacles and allies.' },
  { name: 'Hunt', dc: 20, source: AA, text: 'Forages or stalks prey, and helps your Survival checks for food, water and shelter.' },
  { name: 'Intimidate', dc: 15, source: AA, text: 'Threatens a creature you point out, or anyone but you.' },
  { name: 'Maneuver', dc: 20, source: AA, needs: ['Attack'], repeat: true, choice: 'maneuver', text: 'Uses one combat maneuver (trip, disarm…) on command. Taught again for each maneuver.' },
  { name: 'Mark Territory', dc: 25, source: AA, text: 'Marks up to half a square mile, warding off some random encounters.' },
  { name: 'Menace', dc: 20, source: AA, text: 'Holds a creature at bay; attacks only if it moves or acts hostile.' },
  { name: 'Milk Venom', dc: 20, source: AA, needsNote: 'poison', text: 'Gives one dose of its venom in 10 minutes.' },
  { name: 'Pose as Scenery', dc: 20, source: AA, needs: ['Take Root'], text: 'A plant holds still to look ordinary (+8 Disguise).' },
  { name: 'Receive Spell', dc: 25, source: AA, repeat: true, choice: 'spell', text: 'Knows how to make full use of one spell cast on it (air walk, water breathing…). Taught again for each spell.' },
  { name: 'Rescue', dc: 20, source: AA, needs: ['Deliver', 'Guard'], text: 'Drags you or another creature who is down to safety.' },
  { name: 'Speak', dc: 25, source: AA, needsNote: 'Int 2', text: 'Answers yes or no and counts to three, plus two learned questions per point of Int.' },
  { name: 'Spin Silk', dc: 20, source: AA, needsNote: 'web', text: 'Gives silk once a day, 10 ft. per point of Con; it rots after 24 hours.' },
  { name: 'Subdue', dc: 15, source: AA, text: 'Deals nonlethal damage with its natural attacks until told otherwise.' },
  { name: 'Take Root', dc: 15, source: AA, needsNote: 'plant', text: 'A plant anchors itself in soft ground: it cannot move, +4 CMD against bull rush, drag, reposition and trip.' },
  { name: 'Watch', dc: 15, source: AA, text: 'Keeps watch over a camp or other area and raises the alarm at dangerous intruders.' },
  { name: 'Withhold Venom', dc: 20, source: AA, needsNote: 'poison', text: 'Hits without injecting its venom.' },

  { name: 'Deliver', dc: 15, source: OTHER, text: 'Carries an item to a place or person you name.' },
  { name: 'Exclusive', dc: 20, source: OTHER, text: 'Takes trick commands only from you.' },
  { name: 'Serve', dc: 15, source: OTHER, text: 'Takes commands from a creature you name, who can use your Handle Animal bonus for its tricks.' },
  { name: 'Sneak', dc: 15, source: OTHER, text: 'Uses Stealth and stays hidden even when its instincts say otherwise.' },
  { name: 'Throw Rider', dc: 15, source: OTHER, text: 'Throws its riders off; with Exclusive, throws anyone but you who tries to ride it.' },

  { name: 'Drive', dc: 25, source: PC, text: 'Drives off riderless enemy mounts and other nonmagical creatures (Will DC 10).' },
  { name: 'Find Master', dc: 15, source: PC, text: 'Finds its master, by scent if it has scent.' },
  { name: 'Herd', dc: 20, source: PC, text: 'Drives noncombatant mounts and friendly bystanders away from a fight (Will DC 10).' },
  { name: 'Protect', dc: 20, source: PC, text: 'Readies an attack on any foe that steps next to the creature it guards.' },
  { name: 'Quiet Watch', dc: 20, source: PC, text: 'Watches an area and alerts its master quietly, or raises the alarm if it cannot.' },
];

export const SOURCES = [CORE, AA, OTHER, PC];

/** Training an animal for a general purpose (Core Rulebook, and two from Animal Archive): one check teaches all of these tricks. */
export const PURPOSES = [
  { name: 'Combat training', dc: 20, weeks: 6, tricks: ['Attack', 'Come', 'Defend', 'Down', 'Guard', 'Heel'] },
  { name: 'Fighting', dc: 20, weeks: 3, tricks: ['Attack', 'Down', 'Stay'] },
  { name: 'Guarding', dc: 20, weeks: 4, tricks: ['Attack', 'Defend', 'Down', 'Guard'] },
  { name: 'Heavy labor', dc: 15, weeks: 2, tricks: ['Come', 'Work'] },
  { name: 'Hunting', dc: 20, weeks: 6, tricks: ['Attack', 'Down', 'Fetch', 'Heel', 'Seek', 'Track'] },
  { name: 'Performance', dc: 15, weeks: 5, tricks: ['Come', 'Fetch', 'Heel', 'Perform', 'Stay'] },
  { name: 'Riding', dc: 15, weeks: 3, tricks: ['Come', 'Heel', 'Stay'] },
  { name: 'Air support', dc: 20, tricks: ['Attack', 'Bombard', 'Deliver'] },
  { name: 'Liberate', dc: 25, tricks: ['Break Out', 'Flee', 'Get Help'] },
];

const key = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const BY_KEY = new Map(TRICKS.map(t => [key(t.name), t]));
// Ways people write "attack any creature"
const ATTACK_ANY = /^attack\s*(\((any|all)( creatures?| targets?)?\)|(any|all)( creatures?| targets?)?)$/;

export const trickDef = name => BY_KEY.get(key(name)) || null;

/** One item of the text: {name, choice, def, weight}. "maneuver (trip)" is the Maneuver trick for trip. */
function parseOne(raw) {
  const s = raw.trim().replace(/\.$/, '');
  const k = key(s);
  if (ATTACK_ANY.test(k)) return { name: 'Attack (any creature)', choice: '', def: BY_KEY.get('attack (any creature)'), weight: 2 };
  const def = BY_KEY.get(k);
  if (def) return { name: def.name, choice: '', def, weight: def.weight || 1 };
  const m = s.match(/^(.*?)\s*\(([^)]*)\)$/);
  const rep = m && BY_KEY.get(key(m[1]));
  if (rep?.repeat) return { name: rep.name, choice: m[2].trim(), def: rep, weight: 1 };
  return { name: s, choice: '', def: null, weight: 1 };
}

/** The companion's trick text as a list. Commas, semicolons and new lines separate tricks. */
export function parseTricks(text) {
  return String(text || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean).map(parseOne);
}

const label = t => (t.choice ? `${t.name} (${t.choice})` : t.name);
/** The list back as the text the save keeps. */
export const tricksText = list => list.map(label).join(', ');

/** How many tricks the list uses (attack any creature counts as two). */
export const tricksUsed = list => list.reduce((n, t) => n + t.weight, 0);

/** How many tricks the animal can know: 3 per point of Int (Core Rulebook: Int 1 three, Int 2 six), plus its bonus tricks, which do not count against that. */
export const trickLimit = (int, bonus = 0) => Math.max(0, 3 * (Number(int) || 0)) + (Number(bonus) || 0);

const has = (list, name) => list.some(t => t.name === name || (name === 'Attack' && t.name === 'Attack (any creature)'));

/** Tricks this one needs that the list lacks (Flank needs Attack, Rescue needs Deliver and Guard). */
export const missingNeeds = (list, def) => (def?.needs || []).filter(n => !has(list, n));

/** Add or remove one trick (by name; a repeatable one with a choice is its own item). Returns the new list. */
export function toggleTrick(list, name, choice = '') {
  const i = list.findIndex(t => t.name === name && (t.choice || '') === (choice || ''));
  if (i >= 0) return list.filter((_, k) => k !== i);
  const def = trickDef(name);
  // Attack against any creature replaces plain Attack (it counts as two tricks, not three); plain Attack is already part of it
  if (def?.name === 'Attack' && list.some(t => t.name === 'Attack (any creature)')) return list;
  const rest = def?.name === 'Attack (any creature)' ? list.filter(t => t.name !== 'Attack') : list;
  return [...rest, { name: def?.name || name, choice, def, weight: def?.weight || 1 }];
}

/** Add a general purpose's tricks the animal does not know yet. */
export function addPurpose(list, purposeName) {
  const p = PURPOSES.find(x => x.name === purposeName);
  if (!p) return list;
  return p.tricks.reduce((l, n) => (has(l, n) ? l : toggleTrick(l, n)), list);
}

/** Purposes whose tricks the list already holds in full. */
export const purposesMet = list => PURPOSES.filter(p => p.tricks.every(n => has(list, n))).map(p => p.name);

/** Can the handler teach it by taking 10 on Handle Animal? */
export const take10 = (bonus, dc) => bonus != null && bonus + 10 >= dc;
