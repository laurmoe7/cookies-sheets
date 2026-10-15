// The paper doll: what the character wears, slot by slot. Pure, no DOM, tested in tests/paperdoll.test.mjs.
// An item is worn in a slot when it has `slot` set: gear and weapons store it; armor and shields use their "worn" tick and default to the Armor / Shield slot.
// Gear added from the compendium also remembers `hint`, the kind of slot the compendium says it fits ('ring', 'neck'...), so the right items are offered first.

export const SLOTS = [
  { id: 'head', label: 'Head', icon: '<path d="M5 15v-4a7 7 0 0114 0v4"/><path d="M3.5 15h17"/><path d="M8 11.5h8"/><path d="M12 5v6.5M5 15v3.5h3.5V15M15.5 15v3.5H19V15"/>' }, { id: 'headband', label: 'Headband', icon: '<path d="M3.5 14c2.5-2.5 5.5-3.5 8.5-3.5s6 1 8.5 3.5"/><path d="M3.5 14c2.5 3 5.5 4 8.5 4s6-1 8.5-4"/><path d="M12 3.5l2.2 2.8-2.2 2.8-2.2-2.8z"/>' }, { id: 'eyes', label: 'Eyes', icon: '<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".6"/>' },
  { id: 'neck', label: 'Neck', icon: '<path d="M6 3.5c0 6 2.5 9.5 6 9.5s6-3.5 6-9.5"/><path d="M12 13l3.2 3.8-3.2 4.7-3.2-4.7z"/><path d="M12 15.5v3"/>' }, { id: 'shoulders', label: 'Shoulders', icon: '<path d="M7 4c1.2 1.4 3 2 5 2s3.8-.6 5-2l3.5 5.5-2 11-6.5-2.5L5.5 20.5l-2-11z"/><circle cx="12" cy="6.2" r="1.1"/>' }, { id: 'chest', label: 'Chest', icon: '<path d="M8.5 3.5L3.5 7l2.2 4.3 2.3-1.3V21h8V10l2.3 1.3L20.5 7l-5-3.5c-.8 1.8-2 2.8-3.5 2.8S9.3 5.3 8.5 3.5z"/><path d="M12 6.5V21"/>' },
  { id: 'body', label: 'Body', icon: '<path d="M9 3l3 2.8L15 3l3.5 4-2 3v11h-9V10l-2-3z"/><path d="M7.5 13h9"/><path d="M12 5.8V13"/>' }, { id: 'armor', label: 'Armor', icon: '<path d="M4.5 5l4.5-2 3 1.6L15 3l4.5 2-1 6.5-2.5 2.5V20.5H8V14L5.5 11.5z"/><path d="M12 4.6V20"/><path d="M8.5 11h7"/>' }, { id: 'belt', label: 'Belt', icon: '<rect x="2" y="9.5" width="20" height="5.5" rx="1"/><rect x="9" y="8.3" width="6" height="7.9" rx="1"/><path d="M12 10.8v3.2"/>' },
  { id: 'wrists', label: 'Wrists', icon: '<path d="M7.5 3.5h9l.8 5-.8 3.5.8 3.5-.8 5h-9l-.8-5 .8-3.5-.8-3.5z"/><path d="M6.7 8.5h10.6M6.7 15.5h10.6"/><path d="M12 10.5v3"/>' }, { id: 'hands', label: 'Hands', icon: '<path d="M7 21v-5.5L5 11.5l1.6-1L9 12.5V5a1.3 1.3 0 012.6 0v5-6.5a1.3 1.3 0 012.6 0V10V5a1.3 1.3 0 012.6 0v9l-1.8 3v4z"/><path d="M7 18h9.5"/>' },
  { id: 'ring1', label: 'Ring', icon: '<circle cx="12" cy="14.5" r="6"/><circle cx="12" cy="14.5" r="3.6"/><path d="M9.7 6.8L12 3.2l2.3 3.6z"/>', family: 'ring' }, { id: 'ring2', label: 'Ring', icon: '<circle cx="12" cy="14.5" r="6"/><circle cx="12" cy="14.5" r="3.6"/><path d="M9.7 6.8L12 3.2l2.3 3.6z"/>', family: 'ring' },
  { id: 'feet', label: 'Feet', icon: '<path d="M8.5 3h6v8.2l5.8 3.4V19.5H4.5v-5.2c2.3-.8 4-1.4 4-3.2z"/><path d="M4.5 16.2h15.8"/>' }, { id: 'shield', label: 'Shield', icon: '<path d="M12 3l7.2 2.6v6c0 4.4-3 7.4-7.2 9.4-4.2-2-7.2-5-7.2-9.4v-6z"/><path d="M12 7v10M8.2 11h7.6"/>' },
  { id: 'main', label: 'Main hand', icon: '<path d="M20 4L10 14"/><path d="M16 4h4v4"/><path d="M7.5 11.5l5 5"/><path d="M10 14l-5 5"/><circle cx="4.3" cy="19.7" r="1"/>' }, { id: 'off', label: 'Off hand', icon: '<path d="M5 5l7 7"/><path d="M5 9V5h4"/><path d="M9.5 14.5l5-5"/><path d="M12 12l6 6"/><circle cx="19.2" cy="19.2" r="1"/>' },
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

/** The items in alphabetical order (numbers sort as numbers, letter case is ignored, unnamed items go last). A new list; equal names keep their order. */
export const sortByName = list => [...list].sort((a, b) => {
  const x = String(a.name || '').trim(), y = String(b.name || '').trim();
  if (!x || !y) return !x && !y ? 0 : !x ? 1 : -1;
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
});
