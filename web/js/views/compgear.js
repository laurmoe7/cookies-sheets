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

/** An icon for an item tile, from its name. */
function itemIcon(name) {
  const n = String(name || '').toLowerCase();
  return /amulet|necklace|periapt|pendant|medallion/.test(n) ? '📿' : /saddle|bridle|bit\b|harness|reins|stirrup/.test(n) ? '🐎' : /ring\b/.test(n) ? '💍'
    : /cloak|cape|blanket|caparison/.test(n) ? '🧣' : /collar|torc|choker/.test(n) ? '⭕' : /bag|pack|pouch|saddlebag/.test(n) ? '🎒' : '✦';
}

/** The Worn switch: a tick box drawn as an on/off pill (gearChange reads the tick box). */
const wornSwitch = (attr, on) => `<label class="cg-worn ${on ? 'on' : ''}" title="${on ? 'Worn, so it counts. Click to take it off' : 'Taken off, so it does not count. Click to put it on'}">
  <input type="checkbox" ${attr} ${on ? 'checked' : ''}><span>${on ? '● Worn' : '○ Off'}</span></label>`;

const pills = list => list.filter(Boolean).map(x => `<span class="cg-pill">${esc(x)}</span>`).join('');

/** The card: `comp` the companion, `s` its computed stat block. Every piece of gear is a tile; worn ones count, taken-off ones are dimmed. */
export function gearCard(comp, s) {
  const b = comp.barding, bd = s.gear?.barding, bOn = b && b.equipped !== false;
  const plus = b ? [0, 1, 2, 3, 4, 5].map(n => `<button class="${n === num(b.enh) ? 'on' : ''}" data-cg-plus="${n}" title="${n ? `+${n} barding: +${n} more to AC` : 'No enhancement bonus'}">+${n}</button>`).join('') : '';
  const fxSummary = String(bd?.fx.summary || '').replace(/^\+\d+\s*/, ''); // the +N is on the picker beside it
  const barding = b ? `<div class="cg-tile cg-barding ${bOn ? '' : 'off'}">
      <div class="cg-top"><span class="cg-icon">🛡</span>
        <div class="cg-title"><span class="cg-tag">Barding</span><b>${esc(b.name || 'Barding')}</b></div>
        ${wornSwitch('data-cg-worn', bOn)}<button class="icon-btn" data-cg-del-barding title="Remove the barding">✕</button></div>
      <div class="cg-pills">${bd ? pills([`AC +${bd.ac}`, `max Dex ${bd.maxDex == null ? '—' : sign(bd.maxDex)}`, `check ${bd.acp || 0}`, bd.slows ? 'slows' : 'full speed', `${bd.weight} lb.`]) : '<span class="small muted">Taken off: no AC, no penalties.</span>'}</div>
      <div class="cg-tools"><span class="cg-seg" title="Enhancement bonus">${plus}</span>
        <button class="btn small ghost" data-cg-fx title="Masterwork, special material and special abilities">✦ ${esc(fxSummary || 'Enchant')}</button></div></div>`
    : `<button class="cg-tile cg-empty" data-cg-add-barding title="Armor for the mount: the book’s numbers, weight for its size"><span class="cg-icon">🛡</span><span><b>＋ Barding</b><small>Armor made for the mount</small></span></button>`;
  const items = (comp.items || []).map((it, k) => {
    const on = it.worn !== false, fx = it.effects || [];
    return `<div class="cg-tile ${on ? '' : 'off'}">
      <div class="cg-top"><span class="cg-icon">${itemIcon(it.name)}</span>
        <div class="cg-title"><span class="cg-tag">Item</span><b>${esc(it.name || 'Item')}</b></div>
        ${wornSwitch(`data-cg-item-worn="${k}"`, on)}<button class="icon-btn" data-cg-item-del="${k}" title="Remove ${esc(it.name || 'this item')}">✕</button></div>
      <div class="cg-pills">${fx.length ? pills(fx.map(e => effectsText([e]))) : '<span class="small muted">No bonuses</span>'}</div>
      <div class="cg-tools"><button class="btn small ghost" data-cg-item-fx="${k}" title="What the item adds to the companion's numbers">✦ ${fx.length ? 'Edit bonuses' : 'Add bonuses'}</button></div></div>`;
  }).join('');
  const total = s.gear?.ac ? `<span class="cg-total" title="AC from the worn barding and items">AC ${sign(s.gear.ac)} from gear</span>` : '';
  return `<section class="card span2 comp-gear">
    <div class="cg-head"><h3>Gear</h3>${total}<span class="grow"></span>
      <button class="btn small" data-cg-magic title="A magic item from the compendium; known items get their bonuses filled in">✦ ＋ Magic item</button>
      <button class="btn small" data-cg-item title="Anything else: a saddle, saddlebags, a collar…">＋ Item</button></div>
    <div class="cg-grid">${barding}${items}</div></section>`;
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
