// Standard weapons and armor to start from (data/equipment.json, built by tools/equipment.py): a template becomes a row on the Weapons or Armor table.
// Pure functions, no DOM.
import { stripPlus } from './itemfx.js';

const num = v => +v || 0;

const SMALL_OR_LESS = ['Fine', 'Diminutive', 'Tiny', 'Small'];
/** Ranged weapons that add Strength to damage: thrown weapons and slings. Bows and crossbows do not (a Strength-rated composite bow is set by hand). */
const ADDS_STRENGTH = /javelin|dart|shuriken|throwing|\bsling\b|boomerang|bolas|chakram|starknife|harpoon|atlatl/i;

export const blankWeapon = () => ({ name: '', tpl: '', ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgAbility: '', dmgMult: '', dmgMisc: 0, crit: '×2', range: '', type: '', weight: 0,
  mw: false, material: '', improvedCritical: false, fx: [], slot: '' });
export const blankArmor = () => ({ name: '', tpl: '', type: 'armor', category: 'light', bonus: 0, enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true, mw: false, material: '', fx: [] });

/** What Weapon Finesse works with besides light melee weapons: these four are named in the feat. */
const FINESSE_ALSO = /^(rapier|whip|spiked chain|elven curve ?blade)$/i;
/** Can Weapon Finesse put Dexterity on this weapon's attack rolls? */
export const finesseWeapon = t => t.kind !== 'ranged' && t.kind !== 'unarmed' && (t.kind === 'light' || FINESSE_ALSO.test(t.name));

/** Light melee weapons (the ones data/equipment.json marks 'light', and the unarmed strike), for Weapon Finesse on a weapon that has only a name. */
const LIGHT_WEAPON = new RegExp('(^| )(' + ['unarmed strike', 'aklys', 'battle aspergillum', 'brass knuckles', 'butterfly sword', 'cestus', 'dagger', 'dan bong', 'dogslicer', 'emei piercer',
  'fighting fan', 'gauntlet', 'gladius', 'handaxe', 'hand axe', 'iron brush', 'jutte', 'kama', 'kerambit', 'knuckle axe', 'kukri', 'light hammer', 'light mace', 'light pick',
  'lungchuan tamo', 'madu', 'nunchaku', 'pata', 'punching dagger', 'quadrens', 'sai', 'sap', 'scorpion whip', 'shang gou', 'shortsword', 'short sword', 'siangham', 'sica',
  'sickle', 'spiked gauntlet', 'starknife', 'tekko kagi', 'throwing axe', 'tonfa', 'wakizashi', 'wooden stake', 'wushu dart'].join('|') + ')( |$)');
const nameKey = n => String(n || '').toLowerCase().replace(/\+\d+/g, ' ').replace(/[^a-z]+/g, ' ').trim();
/** Can Weapon Finesse put Dexterity on this weapon row's attack rolls? A melee weapon that is light, or one of the four the feat names, by its name or the template it came from. */
export const canFinesse = w => !w.ranged && [w.tpl, w.name].some(n => { const k = nameKey(n); return k && (LIGHT_WEAPON.test(k) || FINESSE_ALSO.test(k.replace(/^(masterwork|mwk) /, ''))); });

/** A weapon row from a template. Damage is the dice for the wielder's size; two-handed melee weapons get the ×1½ Strength bonus.
 * `finesse` is true when the character has Weapon Finesse: then a weapon it works with attacks with Dexterity. */
export function weaponFromTemplate(t, size = 'Medium', finesse = false) {
  const small = SMALL_OR_LESS.includes(size);
  const ranged = t.kind === 'ranged';
  return { ...blankWeapon(), name: t.name, tpl: t.name, ranged, ability: finesse && finesseWeapon(t) ? 'dex' : '', damage: (small ? t.dmgS : t.dmgM) || t.dmgM || t.dmgS || '', crit: t.crit || 'x2', range: t.range || '', type: t.type || '', weight: t.weight || 0,
    dmgMult: t.kind === 'two-handed' ? '1.5' : '', dmgAbility: ranged && ADDS_STRENGTH.test(t.name) ? 'str' : '' };
}

/** An armor or shield row from a template. Shields are "light" for the speed rules; armor carries its category. */
export function armorFromTemplate(t) {
  const shield = t.category === 'shield';
  return { ...blankArmor(), name: t.name, tpl: t.name, type: shield ? 'shield' : 'armor', category: shield ? 'light' : t.category, bonus: t.bonus || 0, maxDex: t.maxDex ?? '', acp: t.acp || 0, asf: t.asf || 0, weight: t.weight || 0 };
}

/** The templates matching a search and a filter. `q` matches any part of the name (every word must); `pick` is a function on the template or nothing. */
export function filterTemplates(list, q = '', pick = null) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(t => (!pick || pick(t)) && words.every(w => t.name.toLowerCase().includes(w)));
}

// ---- inventory weapons and the Weapons & Attacks table ----
// An inventory item and its attack row are linked by a shared id: the item's `uid`, the row's `gearUid`. The row then carries no weight of its own (calc.js).

const MATERIAL_WORDS = /\b(masterwork|mwk|cold iron|alchemical silver|silver|silvered|adamantine|mithral|darkwood|dragonhide|bronze|obsidian|bone|stone|wooden)\b/g;
/** A weapon name reduced to what identifies its kind: "+1 Cold Iron Longsword" → "longsword". */
export const weaponKey = n => String(n || '').toLowerCase().replace(/\+\s*\d+/g, ' ').replace(/\(.*?\)/g, ' ').replace(MATERIAL_WORDS, ' ').replace(/[^a-z]+/g, ' ').trim();

/** The standard weapon an item's name is (or ends in): "Longsword +1" → Longsword, "Hooked Lance" → Hooked lance (not Lance). Null when it is not a weapon we know. */
export function weaponTemplateFor(name, templates) {
  const k = weaponKey(name);
  if (!k) return null;
  let best = null, bestLen = 0;
  for (const t of templates || []) {
    const tk = weaponKey(t.name);
    if (!tk) continue;
    if (tk === k) return t;
    if ((' ' + k + ' ').includes(' ' + tk + ' ') && tk.length > bestLen) { best = t; bestLen = tk.length; }
  }
  return best;
}

/** A new id for linking an item and its attack row. */
export const newUid = () => Math.random().toString(36).slice(2, 10);

/** The attack row for an inventory item: linked by id, or else an unlinked row of the same weapon kind ("Longsword" for an item "Longsword"). Its index, or -1. */
export function attackFor(c, g) {
  if (g.uid) { const i = c.weapons.findIndex(w => w.gearUid === g.uid); if (i >= 0) return i; }
  const k = weaponKey(g.name);
  return c.weapons.findIndex(w => !w.gearUid && k && weaponKey(w.name) === k);
}

/** The inventory item an attack row is linked to, its index or -1. */
export const gearFor = (c, w) => (w.gearUid ? c.gear.findIndex(g => g.uid === w.gearUid) : -1);

/** Inventory items that are weapons: [{i, tpl, attack}] where `attack` is the index of their attack row or -1. */
export function inventoryWeapons(c, templates) {
  const out = [];
  c.gear.forEach((g, i) => {
    const tpl = weaponTemplateFor(g.name, templates);
    if (tpl) out.push({ i, tpl, attack: attackFor(c, g) });
  });
  return out;
}

/** The +N an item or row name carries ("Longsword +1", "+2 Lance"), or 0. */
const plusIn = n => +((/\+\s*(\d+)/.exec(String(n || '')) || [])[1] || 0);

/** Adds an attack row for inventory item `g` (linking the two) and returns its index. An unlinked row of the same weapon gets linked instead of a second one. */
export function addAttackFromGear(c, g, tpl, size = 'Medium', finesse = false) {
  const have = attackFor(c, g);
  g.uid ||= newUid();
  if (have >= 0) { c.weapons[have].gearUid = g.uid; return have; }
  c.weapons.push({ ...weaponFromTemplate(tpl, size, finesse), name: g.name || tpl.name, enh: plusIn(g.name), gearUid: g.uid, ...(g.id ? { id: g.id } : {}) });
  return c.weapons.length - 1;
}

/** Puts attack row `w` into the inventory too (linked) and returns the item's index. */
export function addGearFromAttack(c, w) {
  const have = gearFor(c, w);
  if (have >= 0) return have;
  const uid = newUid();
  w.gearUid = uid;
  c.gear.push({ ...(w.id ? { id: w.id } : {}), uid, name: w.name || 'Weapon', qty: 1, weight: num(w.weight), value: '', notes: '', slot: '', hint: '', effects: [] });
  return c.gear.length - 1;
}

/** Sets a weapon's +N on both the inventory item and its attack row: the names end in +N and the row's enhancement bonus is N. */
export function setWeaponPlus(c, g, plus) {
  const rename = n => `${stripPlus(String(n || '').replace(/^\+\s*\d+\s+/, ''))}${plus ? ' +' + plus : ''}`; // "+1 Longsword" and "Longsword +1" both become "Longsword +N"
  g.name = rename(g.name);
  const i = attackFor(c, g);
  if (i >= 0) { c.weapons[i].name = rename(c.weapons[i].name); c.weapons[i].enh = plus; }
}


/** Links attack rows and inventory items of the same weapon that were made separately (a Lance row and a Lance item), one to one.
 * Returns true when it linked any, so the caller can save. */
export function linkByName(c) {
  const rowUids = new Set(c.weapons.map(w => w.gearUid).filter(Boolean));
  const gearUids = new Set(c.gear.map(g => g.uid).filter(Boolean));
  let changedAny = false;
  for (const w of c.weapons) {
    if (w.gearUid && gearUids.has(w.gearUid)) continue;
    const k = weaponKey(w.name);
    const g = k && c.gear.find(x => weaponKey(x.name) === k && !(x.uid && rowUids.has(x.uid)));
    if (!g) continue;
    g.uid ||= newUid();
    w.gearUid = g.uid;
    rowUids.add(g.uid); gearUids.add(g.uid);
    changedAny = true;
  }
  return changedAny;
}
