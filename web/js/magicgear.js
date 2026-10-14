// Turns a compendium magic item (a weapon, armor or shield) into a row for the Weapons or Armor table. Pure, no DOM, tested in tests/magicgear.test.mjs.
// The compendium text names the base item and its enchantments ("This is a +1 flaming burst longsword"), so those are read from it; anything not recognised is left plain.
import { ABILITIES as WEAPON_ABILITIES } from './weaponfx.js';
import { ABILITIES as ARMOR_ABILITIES } from './armorfx.js';

/** Medium-size weapons: damage, crit, damage type, whether ranged, range, weight, and 1.5 for two-handed. */
const W = (damage, crit, type, weight, extra = {}) => ({ damage, crit, type, weight, ranged: false, range: '', mult: '', ...extra });
export const WEAPONS = {
  'dagger': W('1d4', '19-20/×2', 'P/S', 1, { range: '10 ft.' }), 'shortsword': W('1d6', '19-20/×2', 'P', 2), 'short sword': W('1d6', '19-20/×2', 'P', 2),
  'longsword': W('1d8', '19-20/×2', 'S', 4), 'bastard sword': W('1d10', '19-20/×2', 'S', 6), 'greatsword': W('2d6', '19-20/×2', 'S', 8, { mult: '1.5' }),
  'scimitar': W('1d6', '18-20/×2', 'S', 4), 'rapier': W('1d6', '18-20/×2', 'P', 2), 'falchion': W('2d4', '18-20/×2', 'S', 8, { mult: '1.5' }),
  'battleaxe': W('1d8', '×3', 'S', 6), 'greataxe': W('1d12', '×3', 'S', 12, { mult: '1.5' }), 'throwing axe': W('1d6', '×2', 'S', 2, { range: '10 ft.' }), 'handaxe': W('1d6', '×3', 'S', 3),
  'warhammer': W('1d8', '×3', 'B', 5), 'light hammer': W('1d4', '×2', 'B', 2, { range: '20 ft.' }), 'heavy mace': W('1d8', '×2', 'B', 8), 'light mace': W('1d6', '×2', 'B', 4), 'mace': W('1d8', '×2', 'B', 8),
  'morningstar': W('1d8', '×2', 'B/P', 6), 'heavy flail': W('1d10', '19-20/×2', 'B', 10, { mult: '1.5' }), 'flail': W('1d8', '×2', 'B', 5), 'club': W('1d6', '×2', 'B', 3, { range: '10 ft.' }),
  'quarterstaff': W('1d6', '×2', 'B', 4, { mult: '1.5' }), 'longspear': W('1d8', '×3', 'P', 9, { mult: '1.5' }), 'spear': W('1d8', '×3', 'P', 6, { range: '20 ft.' }), 'trident': W('1d8', '×2', 'P', 4, { range: '10 ft.' }),
  'halberd': W('1d10', '×3', 'P/S', 12, { mult: '1.5' }), 'glaive': W('1d10', '×3', 'S', 10, { mult: '1.5' }), 'lance': W('1d8', '×3', 'P', 10), 'scythe': W('2d4', '×4', 'P/S', 10, { mult: '1.5' }),
  'sickle': W('1d6', '×2', 'S', 2), 'kukri': W('1d4', '18-20/×2', 'S', 2), 'gauntlet': W('1d3', '×2', 'B', 1), 'shuriken': W('1d2', '×2', 'P', 0.5, { ranged: true, range: '10 ft.' }),
  'longbow': W('1d8', '×3', 'P', 3, { ranged: true, range: '100 ft.' }), 'shortbow': W('1d6', '×3', 'P', 2, { ranged: true, range: '60 ft.' }),
  'heavy crossbow': W('1d10', '19-20/×2', 'P', 8, { ranged: true, range: '120 ft.' }), 'light crossbow': W('1d8', '19-20/×2', 'P', 4, { ranged: true, range: '80 ft.' }), 'crossbow': W('1d8', '19-20/×2', 'P', 4, { ranged: true, range: '80 ft.' }),
  'sling': W('1d4', '×2', 'B', 0, { ranged: true, range: '50 ft.' }), 'javelin': W('1d6', '×2', 'P', 2, { ranged: true, range: '30 ft.' }), 'dart': W('1d4', '×2', 'P', 0.5, { ranged: true, range: '20 ft.' }),
  'bow': W('1d8', '×3', 'P', 3, { ranged: true, range: '100 ft.' }), 'sword': W('1d8', '19-20/×2', 'S', 4), 'axe': W('1d8', '×3', 'S', 6), 'hammer': W('1d8', '×3', 'B', 5),
};

const A = (category, bonus, maxDex, acp, asf, weight, type = 'armor') => ({ category, bonus, maxDex, acp, asf, weight, type });
export const ARMORS = {
  'padded': A('light', 1, 8, 0, 5, 10), 'studded leather': A('light', 3, 5, -1, 15, 20), 'leather': A('light', 2, 6, 0, 10, 15), 'chain shirt': A('light', 4, 4, -2, 20, 25),
  'hide': A('medium', 4, 4, -3, 20, 25), 'scale mail': A('medium', 4, 3, -4, 25, 30), 'chainmail': A('medium', 5, 2, -5, 30, 40), 'chain mail': A('medium', 5, 2, -5, 30, 40), 'breastplate': A('medium', 5, 3, -4, 25, 30),
  'splint mail': A('heavy', 6, 0, -7, 40, 45), 'banded mail': A('heavy', 6, 1, -6, 35, 35), 'half-plate': A('heavy', 7, 0, -7, 40, 50), 'full plate': A('heavy', 8, 1, -6, 35, 50),
  'buckler': A('light', 1, '', -1, 5, 5, 'shield'), 'light wooden shield': A('light', 1, '', -1, 5, 5, 'shield'), 'light steel shield': A('light', 1, '', -1, 5, 6, 'shield'),
  'heavy wooden shield': A('heavy', 2, '', -2, 15, 10, 'shield'), 'heavy steel shield': A('heavy', 2, '', -2, 15, 15, 'shield'), 'tower shield': A('heavy', 4, 2, -10, 50, 45, 'shield'), 'shield': A('heavy', 2, '', -2, 15, 15, 'shield'),
};

const MATERIALS = [['adamantine', 'adamantine'], ['cold iron', 'coldiron'], ['alchemical silver', 'silver'], ['silver', 'silver'], ['mithral', 'mithral'], ['darkwood', 'darkwood']];

/** The description text after the stat block, plain, first part only. */
const blurb = entry => String(entry.html ?? '').split('</dl>').pop().replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').slice(0, 500);
const longestFirst = obj => Object.keys(obj).sort((a, b) => b.length - a.length).map(k => k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
const dd = (entry, label) => (new RegExp(`<dt>${label}</dt>\\s*<dd>([^<]*)`, 'i').exec(String(entry.html ?? '')) || [])[1];
const entryWeight = entry => { const m = /([\d.]+)/.exec(dd(entry, 'Weight') || ''); return m ? +m[1] : null; };
const key = obj => Object.keys(obj).sort((a, b) => b.length - a.length);

/** "+1 flaming burst longsword" in the text -> {enh, words (the abilities between), base}. Falls back to a base word found in the item's name. */
function readPhrase(entry, table) {
  const text = blurb(entry);
  const m = new RegExp(`\\+(\\d+)\\s+((?:[a-z'’-]+,?\\s+){0,8}?)(${longestFirst(table)})\\b`, 'i').exec(text);
  if (m) return { enh: +m[1], words: m[2].toLowerCase(), base: m[3].toLowerCase() };
  const name = String(entry.name ?? '').toLowerCase();
  const base = key(table).find(k => name.includes(k)) || key(table).find(k => text.toLowerCase().includes(k));
  return { enh: 0, words: '', base: base || '' };
}

const materialOf = entry => {
  const t = `${entry.name} ${blurb(entry).slice(0, 200)}`.toLowerCase(); // only the start of the text: later mentions are about something else
  return (MATERIALS.find(([w]) => t.includes(w)) || [])[1] || '';
};

/** Abilities named in the words between the bonus and the item ("flaming burst", "greater shadow slick"). Longest names first, each word used once. */
function abilitiesIn(words, list, aliases = {}) {
  let rest = ' ' + words.replace(/[,]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const found = [];
  const names = [...list.map(a => [a.name.toLowerCase().replace(/ \(.*\)$/, ''), a.id]), ...Object.entries(aliases)].sort((a, b) => b[0].length - a[0].length);
  for (const [name, id] of names) {
    const at = rest.indexOf(' ' + name + ' ');
    if (at >= 0 && !found.includes(id)) { found.push(id); rest = rest.slice(0, at) + ' ' + rest.slice(at + name.length + 1); }
  }
  return found;
}

const WEAPON_ALIASES = { 'icy burst': 'icyburst', 'frost': 'frost' };
const ARMOR_ALIASES = {
  'improved shadow': 'shadowimp', 'greater shadow': 'shadowgreat', 'improved slick': 'slickimp', 'greater slick': 'slickgreat', 'improved silent moves': 'silentimp', 'greater silent moves': 'silentgreat',
  'spell resistance 13': 'sr13', 'spell resistance 15': 'sr15', 'spell resistance 17': 'sr17', 'spell resistance 19': 'sr19',
};

/** A weapon row from a compendium entry ({id, name, html}), or null if it names no weapon we know. */
export function parseMagicWeapon(entry) {
  const { enh, words, base } = readPhrase(entry, WEAPONS);
  const t = WEAPONS[base];
  if (!t) return null;
  const mat = materialOf(entry);
  return {
    id: entry.id, name: entry.name, ability: '', ranged: t.ranged, enh, misc: 0, damage: t.damage, dmgMult: t.mult, dmgMisc: 0, crit: t.crit, range: t.range, type: t.type,
    weight: entryWeight(entry) ?? t.weight, mw: false, material: mat, improvedCritical: false, slot: '',
    fx: abilitiesIn(words, WEAPON_ABILITIES, WEAPON_ALIASES).map(id => ({ id, on: false })),
  };
}

/** An armor or shield row from a compendium entry, or null if it names none we know. */
export function parseMagicArmor(entry) {
  const { enh, words, base } = readPhrase(entry, ARMORS);
  const t = ARMORS[base];
  if (!t) return null;
  const mat = materialOf(entry);
  return {
    id: entry.id, name: entry.name, type: t.type, category: t.category, bonus: t.bonus, enh, maxDex: t.maxDex, acp: t.acp, asf: t.asf,
    weight: entryWeight(entry) ?? t.weight, equipped: true, mw: false, material: (t.type === 'shield' ? ['mithral', 'darkwood'] : ['mithral', 'adamantine']).includes(mat) ? mat : '', slot: '',
    fx: abilitiesIn(words, ARMOR_ABILITIES, ARMOR_ALIASES).map(id => ({ id })),
  };
}
