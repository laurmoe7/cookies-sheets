// Rolling a spell out of an inventory item (a wand, staff, scroll, potion or oil), from the item's panel and from the
// Class resources & trackers card. The numbers come from itemspell.js; the window is the spells' roll window (roller.js).
import { state, changed } from '../app.js';
import { api } from '../api.js';
import { toast } from '../ui.js';
import { num } from '../calc.js';
import { chargesLeft, spendCharges } from '../charges.js';
import { itemSpellOf, itemClFromHtml, itemCasting } from '../itemspell.js';
import { itemSpellWindow } from '../roller.js';

let lastItemUse = { key: '', at: 0 }; // the item spell a roll last used up, so its damage roll right after does not spend again

/**
 * Rolls `spell` out of the item `g`: `cost` charges for a wand or staff, or one of the item (a scroll, a potion) when `cost` is null.
 * `redraw` runs after the "Use it" tick spent something, for a panel that does not redraw with the sheet.
 */
export async function rollItemSpell(g, spell, cost, redraw) {
  const d = state.derived;
  let entry = null, own = null;
  try { entry = await api.entryByName(spell, 'Spell'); } catch { /* handled below */ }
  if (!entry?.name) return toast(`“${spell}” is not a spell in the compendium, so there is nothing to roll`, 'bad');
  const staff = /^staff\b/i.test(g.name || ''), named = itemSpellOf(g.name);
  if (g.id) { try { own = await api.entry(g.id); } catch { /* the name's or the lowest caster level is used */ } }
  const k = itemCasting({ kind: staff ? 'staff' : named?.kind || 'wand', levels: entry.meta?.levels, itemCl: named?.cl ?? itemClFromHtml(own?.html),
    casters: Object.entries(d?.spellcasting || {}).map(([cls, s]) => ({ cls, cl: s.cl, statMod: s.statMod, dcs: s.dcs })) });
  const key = `${state.char.gear.indexOf(g)}:${spell}`, recent = lastItemUse.key === key && Date.now() - lastItemUse.at < 90000;
  const ch = cost == null ? null : g.charges, unit = ch?.unit || 'charges';
  const left = ch ? Math.floor(chargesLeft(ch) / Math.max(1, cost)) : Math.max(0, num(g.qty));
  const cast = {
    label: ch ? `Use it (−${cost} ${cost === 1 ? unit.replace(/s$/, '') : unit})` : 'Use it (−1 from the quantity)', left, recent, on: left > 0 && !recent,
    spend() {
      if (ch) spendCharges(ch, cost); else g.qty = Math.max(0, num(g.qty) - 1);
      lastItemUse = { key, at: Date.now() };
      changed({ rerender: true }); redraw?.();
      toast(ch ? `${entry.name}: ${chargesLeft(ch)} ${unit} left` : `${g.name}: ${num(g.qty)} left`);
    },
  };
  itemSpellWindow({ name: entry.name, entry, cl: k.cl, dc: k.dc, level: k.level, cast,
    head: `${g.name || 'Item'}, caster level ${k.cl}${k.by ? ` (your ${k.by} level and save DC)` : ''}` });
}
