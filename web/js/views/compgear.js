// The Gear card on a companion (Companions tab): barding and worn items. The rules are in ../compgear.js.
import { changed } from '../app.js';
import { num, sign } from '../calc.js';
import { esc, $, modal, pickEntry, confirmBox } from '../ui.js';
import { suggestEffects, effectsText } from '../itemfx.js';
import { bardingFromTemplate } from '../compgear.js';
import { setArmorPlus, blankArmor } from '../equipment.js';
import { chooseArmor } from './equipment.js';
import { editArmorFx } from './armorfx.js';
import { editModifier } from './sheet.js';

/** The card: `comp` the companion, `s` its computed stat block, `i` its index in c.companions. */
export function gearCard(comp, s) {
  const b = comp.barding, bd = s.gear?.barding;
  const plus = b ? [0, 1, 2, 3, 4, 5].map(n => `<button class="btn small ${n === num(b.enh) ? 'primary' : 'ghost'}" data-cg-plus="${n}" title="${n ? `+${n} barding: +${n} more to AC` : 'No enhancement bonus'}">+${n}</button>`).join('') : '';
  const barding = b ? `<div class="cg-row">
      <label class="small"><input type="checkbox" data-cg-worn ${b.equipped !== false ? 'checked' : ''}> Worn</label>
      <b>${esc(b.name || 'Barding')}</b>
      <span class="small muted">${bd ? `AC +${bd.ac} · max Dex ${bd.maxDex == null ? '—' : sign(bd.maxDex)} · check ${bd.acp || 0}${bd.slows ? ' · slows' : ''} · ${bd.weight} lb.` : 'not worn'}</span>
      <span class="grow"></span>
      <span class="row plus-row">${plus}</span>
      <button class="btn small" data-cg-fx title="Masterwork, special material and special abilities">✦ ${esc(bd?.fx.summary || 'Enchant')}</button>
      <button class="icon-btn" data-cg-del-barding title="Remove">✕</button></div>`
    : '<button class="btn small" data-cg-add-barding title="Armor for the mount: the book’s numbers, weight for its size">＋ Barding</button>';
  const items = (comp.items || []).map((it, k) => `<div class="cg-row">
      <label class="small"><input type="checkbox" data-cg-item-worn="${k}" ${it.worn !== false ? 'checked' : ''}> Worn</label>
      <b>${esc(it.name || 'Item')}</b><span class="small muted">${esc(effectsText(it.effects || []))}</span><span class="grow"></span>
      <button class="btn small ghost" data-cg-item-fx="${k}">✦ Bonuses</button>
      <button class="icon-btn" data-cg-item-del="${k}" title="Remove">✕</button></div>`).join('');
  return `<section class="card span2 comp-gear"><h3>Gear</h3>
    <h4>Barding</h4>${barding}
    <h4>Items</h4>${items || '<p class="small muted">None.</p>'}
    <div class="row" style="gap:6px;margin-top:6px"><button class="btn small" data-cg-magic>＋ Magic item</button><button class="btn small" data-cg-item>＋ Item</button></div></section>`;
}

/** Clicks inside a companion's Gear card. Returns true when it handled the click. */
export async function gearClick(e, comp, size) {
  const t = e.target.closest('[data-cg-add-barding],[data-cg-plus],[data-cg-fx],[data-cg-del-barding],[data-cg-magic],[data-cg-item],[data-cg-item-fx],[data-cg-item-del]');
  if (!t) return false;
  e.preventDefault();
  const d = t.dataset;
  if (d.cgAddBarding !== undefined) {
    const pick = await chooseArmor();
    if (!pick) return true;
    comp.barding = pick === 'blank' ? { ...blankArmor(), name: 'Barding' } : bardingFromTemplate(pick, size);
  } else if (d.cgPlus !== undefined) setArmorPlus(comp.barding, +d.cgPlus);
  else if (d.cgFx !== undefined) { await editArmorFx(-1, comp.barding); }
  else if (d.cgDelBarding !== undefined) { if (!await confirmBox(`Remove ${comp.barding?.name || 'the barding'}?`, 'Remove')) return true; comp.barding = null; }
  else if (d.cgMagic !== undefined) {
    const r = await pickEntry('Add a magic item to the companion', 'Magic Item');
    if (!r) return true;
    (comp.items ||= []).push({ id: r.id, name: r.name, worn: true, effects: suggestEffects(r.name), notes: '' });
  } else if (d.cgItem !== undefined) {
    const name = await askName();
    if (!name) return true;
    (comp.items ||= []).push({ name, worn: true, effects: suggestEffects(name), notes: '' });
  } else if (d.cgItemFx !== undefined) {
    const it = comp.items[+d.cgItemFx];
    const m = await editModifier({ name: it.name || 'Item', note: '', active: true, effects: structuredClone(it.effects || []).concat(it.effects?.length ? [] : [{ target: 'ac', value: 1, type: 'untyped' }]) });
    if (m) it.effects = m.effects;
  } else if (d.cgItemDel !== undefined) {
    const it = comp.items[+d.cgItemDel];
    if (!await confirmBox(`Remove ${it?.name || 'this item'}?`, 'Remove')) return true;
    comp.items.splice(+d.cgItemDel, 1);
  }
  changed({ rerender: true });
  return true;
}

/** A small window asking for an item's name; resolves to it, or '' when cancelled. */
function askName() {
  return modal('Add an item', (body, close) => {
    body.innerHTML = `<label class="wide"><span>Name</span><input class="full" data-n placeholder="A saddle, a collar, an amulet of mighty fists +1…"></label>
      <div class="row end" style="margin-top:8px"><button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Add</button></div>`;
    const inp = $('[data-n]', body);
    const ok = () => close(inp.value.trim());
    inp.focus();
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    $('[data-yes]', body).onclick = ok;
    $('[data-no]', body).onclick = () => close('');
  }).then(v => v || '');
}

/** The Worn tick boxes. Returns true when it handled the change. */
export function gearChange(e, comp) {
  const t = e.target;
  if (t.matches('[data-cg-worn]')) { comp.barding.equipped = t.checked; changed({ rerender: true }); return true; }
  if (t.matches('[data-cg-item-worn]')) { comp.items[+t.dataset.cgItemWorn].worn = t.checked; changed({ rerender: true }); return true; }
  return false;
}
