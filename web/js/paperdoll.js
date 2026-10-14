// The paper doll: what the character wears, slot by slot. Pure, no DOM, tested in tests/paperdoll.test.mjs.
// An item is worn in a slot when it has `slot` set: gear and weapons store it; armor and shields use their "worn" tick and default to the Armor / Shield slot.
// Gear added from the compendium also remembers `hint`, the kind of slot the compendium says it fits ('ring', 'neck'...), so the right items are offered first.

export const SLOTS = [
  { id: 'head', label: 'Head', icon: '🎩' }, { id: 'headband', label: 'Headband', icon: '👑' }, { id: 'eyes', label: 'Eyes', icon: '👓' },
  { id: 'neck', label: 'Neck', icon: '📿' }, { id: 'shoulders', label: 'Shoulders', icon: '🧣' }, { id: 'chest', label: 'Chest', icon: '🦺' },
  { id: 'body', label: 'Body', icon: '👘' }, { id: 'armor', label: 'Armor', icon: '🥋' }, { id: 'belt', label: 'Belt', icon: '🎗️' },
  { id: 'wrists', label: 'Wrists', icon: '⌚' }, { id: 'hands', label: 'Hands', icon: '🧤' },
  { id: 'ring1', label: 'Ring', icon: '💍', family: 'ring' }, { id: 'ring2', label: 'Ring', icon: '💍', family: 'ring' },
  { id: 'feet', label: 'Feet', icon: '🥾' }, { id: 'shield', label: 'Shield', icon: '🛡️' },
  { id: 'main', label: 'Main hand', icon: '⚔️' }, { id: 'off', label: 'Off hand', icon: '🗡️' },
];
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
export const LAYOUT = {
  left: ['head', 'headband', 'eyes', 'neck', 'shoulders', 'chest', 'body'],
  right: ['hands', 'wrists', 'belt', 'ring1', 'ring2', 'feet', 'armor'],
  bottom: ['main', 'shield', 'off'],
};
/** What the slot is called when you pick one for an item (ring slots are numbered). */
export const slotName = id => (id === 'ring1' ? 'Ring (left)' : id === 'ring2' ? 'Ring (right)' : SLOT_BY_ID[id]?.label || id);

const familyOf = id => SLOT_BY_ID[id]?.family || id;
const SUB = { ring: 'ring', neck: 'neck', shoulders: 'shoulders', head: 'head', headband: 'headband', feet: 'feet', hands: 'hands', body: 'body', belt: 'belt', wrist: 'wrists', arms: 'wrists', eyes: 'eyes', chest: 'chest', armor: 'armor', shield: 'shield' };

/** The slot family the compendium's "sub" says a magic item fits ('ring', 'neck'...), or '' when it names none (wondrous gear, materials, alchemical). */
export const hintFromSub = sub => SUB[String(sub || '').toLowerCase()] || '';

const LISTS = { armor: 'armor', weapon: 'weapons', gear: 'gear' };
const list = (c, kind) => c[LISTS[kind]] || [];

/** The slot an item is worn in right now, or '' when it is not worn. */
export function slotOf(c, kind, i) {
  const it = list(c, kind)[i];
  if (!it) return '';
  if (kind === 'armor') return it.equipped ? it.slot || (it.type === 'shield' ? 'shield' : 'armor') : '';
  return it.slot || '';
}

/** {slotId: [{kind, i, name}]}: everything worn, by slot. More than one entry in a slot means a clash (an import, or a hand edit). */
export function wornBySlot(c) {
  const out = {};
  for (const kind of ['armor', 'weapon', 'gear']) list(c, kind).forEach((it, i) => {
    const s = slotOf(c, kind, i);
    if (s && SLOT_BY_ID[s]) (out[s] ||= []).push({ kind, i, name: it.name || '' });
  });
  return out;
}

/** What could go in `slotId`: `good` fits it (or the compendium says so), `other` is anything else you carry that is not worn. */
export function candidates(c, slotId) {
  const fam = familyOf(slotId), good = [], other = [];
  const free = (kind, i) => !slotOf(c, kind, i);
  (c.armor || []).forEach((a, i) => {
    const isShield = a.type === 'shield';
    if ((slotId === 'armor' && !isShield) || (slotId === 'shield' && isShield)) good.push({ kind: 'armor', i, name: a.name || (isShield ? 'Shield' : 'Armor'), worn: !free('armor', i) });
  });
  (c.weapons || []).forEach((w, i) => { if (slotId === 'main' || slotId === 'off') good.push({ kind: 'weapon', i, name: w.name || 'Weapon', worn: !free('weapon', i) }); });
  if (slotId !== 'armor' && slotId !== 'shield') {
    (c.gear || []).forEach((g, i) => {
      if (!free('gear', i)) return;
      (g.hint === fam ? good : other).push({ kind: 'gear', i, name: g.name || 'Item' });
    });
  }
  return { good: good.filter(x => !x.worn || slotOf(c, x.kind, x.i) !== slotId), other };
}

/** Take an item off: armor is unticked, anything else just loses its slot. */
export function takeOff(c, kind, i) {
  const it = list(c, kind)[i];
  if (!it) return;
  if (kind === 'armor') { it.equipped = false; delete it.slot; } else it.slot = '';
}

/** Put an item in a slot. Whatever was there comes off first (a slot holds one thing). */
export function wear(c, slotId, kind, i) {
  const it = list(c, kind)[i];
  if (!it || !SLOT_BY_ID[slotId]) return;
  for (const o of wornBySlot(c)[slotId] || []) if (!(o.kind === kind && o.i === i)) takeOff(c, o.kind, o.i);
  if (kind === 'armor') { it.equipped = true; it.slot = slotId; } else it.slot = slotId;
}

/** The first free ring slot, for an item that says it is a ring. */
export const freeRingSlot = c => ['ring1', 'ring2'].find(s => !(wornBySlot(c)[s] || []).length) || 'ring1';
