// The Gear card on a companion (Companions tab): barding and worn items, drawn as chips like the Inventory tab's.
// Clicking one opens it in the side panel with its controls, as the inventory does. The rules are in ../compgear.js.
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { num, sign } from '../calc.js';
import { esc, $, modal, pickEntry, confirmBox, showEntry, showCustom, closeDrawer } from '../ui.js';
import { suggestEffects, effectsText } from '../itemfx.js';
import { armorFx } from '../armorfx.js';
import { bardingFromTemplate, lookupNames, bardingBase, BARDING_ENTRY } from '../compgear.js';
import { setArmorPlus, blankArmor } from '../equipment.js';
import { chooseArmor } from './equipment.js';
import { editArmorFx } from './armorfx.js';
import { editModifier } from './sheet.js';

// The piece of companion gear shown in the side panel: {ci, kind: 'barding' | 'item', k, armed, id, el}.
let compDrawer = null;
const isOpen = (ci, kind, k = 0) => compDrawer?.ci === ci && compDrawer.kind === kind && (kind === 'barding' || compDrawer.k === k);
const pieceOf = d => { const comp = state.char?.companions?.[d?.ci]; return !comp ? null : d.kind === 'barding' ? comp.barding : comp.items?.[d.k]; };

/** The card: `comp` the companion, `s` its computed stat block, `ci` its index in c.companions. */
export function gearCard(comp, s, ci) {
  const b = comp.barding, bOn = b && b.equipped !== false;
  const pip = '<span class="pips"><i class="pip"></i></span>';
  const barding = b ? `<button class="sp-chip armor-chip ${isOpen(ci, 'barding') ? 'on' : ''} ${bOn ? 'ready' : 'idle'}" data-cg-open="barding" title="${bOn ? 'Worn. ' : 'Not worn. '}Click for its numbers, +N and enchantments">
      <span class="sp-n">🛡 ${esc(b.name || 'Barding')}</span><span class="sp-s">AC +${num(b.bonus) + num(b.enh)}</span>${bOn ? pip : ''}</button>` : '';
  const items = (comp.items || []).map((it, k) => {
    const on = it.worn !== false, fx = it.effects || [];
    const fxMark = fx.length ? `<span class="sp-s" title="${esc(effectsText(fx))}${on ? '' : ' (counts once worn)'}">✦</span>` : '';
    return `<button class="sp-chip ${isOpen(ci, 'item', k) ? 'on' : ''} ${on ? 'ready' : 'idle'}" data-cg-open="${k}" title="${on ? 'Worn. ' : 'Not worn. '}Click for details">
      <span class="sp-n">${esc(it.name || 'Item')}</span>${fxMark}${on ? pip : ''}</button>`;
  }).join('');
  const total = s.gear?.ac ? `<span class="cg-total" title="AC from the worn barding and items">AC ${sign(s.gear.ac)} from gear</span>` : '';
  return `<section class="card span2 comp-gear">
    <div class="row"><h3>Gear</h3>${total}<span class="grow"></span>
      <button class="btn small" data-cg-magic title="A magic item from the compendium; known items get their bonuses filled in">＋ Magic item</button>
      ${b ? '' : '<button class="btn small" data-cg-add-barding title="Armor for the mount: the book’s numbers, weight for its size">＋ Barding</button>'}
      <button class="btn small" data-cg-item title="Anything else: a saddle, saddlebags, a collar…">＋ Item</button></div>
    ${barding || items ? `<div class="sp-chips inv-chips">${barding}${items}</div>` : '<p class="muted">Nothing worn.</p>'}</section>`;
}

/** Clicks inside a companion's Gear card. Returns true when it handled the click. */
export async function gearClick(e, comp, size, ci) {
  const t = e.target.closest('[data-cg-open],[data-cg-add-barding],[data-cg-magic],[data-cg-item]');
  if (!t) return false;
  e.preventDefault();
  const d = t.dataset;
  if (d.cgOpen !== undefined) { openPiece(ci, d.cgOpen === 'barding' ? 'barding' : 'item', +d.cgOpen || 0); return true; }
  if (d.cgAddBarding !== undefined) {
    const pick = await chooseArmor();
    if (!pick) return true;
    comp.barding = pick === 'blank' ? { ...blankArmor(), name: 'Barding', equipped: true } : bardingFromTemplate(pick, size);
    changed({ rerender: true });
    openPiece(ci, 'barding');
    return true;
  }
  if (d.cgMagic !== undefined) {
    const r = await pickEntry('Add a magic item to the companion', 'Magic Item');
    if (!r) return true;
    (comp.items ||= []).push({ id: r.id, name: r.name, worn: true, effects: suggestEffects(r.name), notes: '' });
  } else {
    const name = await askName();
    if (!name) return true;
    (comp.items ||= []).push({ name, worn: true, effects: suggestEffects(name), notes: '' });
  }
  changed({ rerender: true });
  openPiece(ci, 'item', comp.items.length - 1);
  return true;
}

/** Show a piece of companion gear in the side panel: its compendium text when it has one, its controls on top. */
export async function openPiece(ci, kind, k = 0) {
  const d = { ci, kind, k, armed: true, id: null };
  const g = pieceOf(d);
  if (!g) return;
  d.id = g.id || null;
  compDrawer = d;
  markOpen();
  const who = state.char.companions[ci].name || 'your companion';
  if (g.id) { showEntry(g.id); return; }
  // Typed in by hand: borrow the compendium's description (barding: its base armor, then the book's write-up of barding).
  const found = kind === 'barding' ? [await findEntry(lookupNames(bardingBase(g.name))), await findEntry([BARDING_ENTRY])] : [await findEntry(lookupNames(g.name))];
  if (compDrawer !== d) return; // another piece was clicked meanwhile
  const parts = found.filter(Boolean);
  const html = parts.map((e, n) => (kind === 'barding' && parts.length > 1 ? `<h4>${esc(n ? 'Barding' : e.name)}</h4>` : '') + e.html).join('');
  const source = [...new Set(parts.map(e => e.source).filter(Boolean))].join('; ');
  showCustom({ name: g.name || (kind === 'barding' ? 'Barding' : 'Item'), cat: kind === 'barding' ? 'Barding' : 'Companion item', sub: `on ${who}`, html, source });
}

/** The first of these names that is a compendium item, or null. */
async function findEntry(names) {
  for (const n of names) {
    try { const e = await api.entryByName(n, 'Magic Item'); if (e?.html) return e; } catch { /* not found */ }
  }
  return null;
}

function markOpen() {
  document.querySelectorAll('.comp-gear .sp-chip.on').forEach(x => x.classList.remove('on'));
  if (!compDrawer) return;
  document.querySelector(`[data-comp="${compDrawer.ci}"] .comp-gear [data-cg-open="${compDrawer.kind === 'barding' ? 'barding' : compDrawer.k}"]`)?.classList.add('on');
}

document.addEventListener('entry-shown', e => {
  const d = compDrawer;
  if (!d) return;
  if (d.armed && (e.detail.entry.id ?? null) === d.id) { d.armed = false; d.el = e.detail.actions; renderActions(); }
  else if (!d.armed) { compDrawer = null; markOpen(); } // the panel moved on to something else
});
document.addEventListener('drawer-closed', () => { compDrawer = null; markOpen(); });

/** The panel's controls, the same as the inventory's item and armor panels where they apply. */
function renderActions() {
  const d = compDrawer;
  if (!d?.el?.isConnected) return;
  const g = pieceOf(d);
  if (!g) { d.el.innerHTML = ''; return; }
  const base = d.kind === 'barding' ? `companions.${d.ci}.barding` : `companions.${d.ci}.items.${d.k}`;
  const field = (k, label, { numeric = false, ph = '', cls = 'w3' } = {}) => `<label><span>${label}</span><input class="${cls}${numeric ? ' num' : ''}" ${numeric ? 'type="number" data-type="num"' : 'type="text"'}
    data-bind="${base}.${k}" value="${esc(g[k] ?? '')}" placeholder="${esc(ph)}" data-rerender></label>`;
  const worn = d.kind === 'barding' ? g.equipped !== false : g.worn !== false;
  const nameRow = g.id ? '' : `<label class="wide"><span>Name</span><input data-cd-name value="${esc(g.name || '')}" placeholder="${d.kind === 'barding' ? 'Barding' : 'Item name'}"></label>`;
  const wornRow = `<label class="row" style="gap:6px"><span>Worn</span><input type="checkbox" data-cd-worn ${worn ? 'checked' : ''}></label>`;
  const del = `<div class="wide row end"><button class="btn small danger" data-cd-del>Remove from ${esc(state.char.companions[d.ci].name || 'the companion')}</button></div>`;
  if (d.kind === 'barding') {
    const fx = armorFx(g).summary || '';
    const plus = [0, 1, 2, 3, 4, 5].map(n => `<button class="btn small ${n === num(g.enh) ? 'primary' : 'ghost'}" data-cd-plus="${n}" title="${n ? `+${n} barding: +${n} more to AC` : 'No enhancement bonus'}">+${n}</button>`).join('');
    d.el.innerHTML = `<div class="item-actions">${nameRow}${wornRow}
      <label><span>Category</span><select data-bind="${base}.category" data-rerender>${[['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']].map(([v, l]) => `<option value="${v}" ${g.category === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${field('bonus', 'Armor bonus', { numeric: true })}${field('maxDex', 'Max Dex', { numeric: true, ph: 'none' })}${field('acp', 'Check penalty', { numeric: true })}${field('weight', 'Weight', { numeric: true })}
      <div class="wide row plus-row">${plus}</div>
      <div class="wide item-fx"><div>${fx ? esc(fx) : '<span class="muted">No enchantments or special material</span>'}</div>
        <div class="row" style="margin-top:4px"><button class="btn small" data-cd-fx title="Masterwork, special material (mithral...) and special abilities (fortification...)">✦ Enchant</button></div></div>
      ${del}</div>`;
  } else {
    const fx = g.effects || [], sug = suggestEffects(g.name);
    d.el.innerHTML = `<div class="item-actions">${nameRow}${wornRow}
      <div class="wide item-fx">
        <div>${fx.length ? esc(effectsText(fx)) : '<span class="muted">No bonuses</span>'}${fx.length && !worn ? ' <span class="small bad">not worn, so they do not count</span>' : ''}</div>
        <div class="row" style="gap:6px;margin-top:4px"><button class="btn small" data-cd-fx>✦ ${fx.length ? 'Edit' : 'Add'} bonuses</button>${!fx.length && sug.length ? `<button class="btn small" data-cd-fx-auto title="Fill in what this kind of item normally gives">Use the usual: ${esc(effectsText(sug))}</button>` : ''}</div></div>
      ${g.id ? '' : `<label class="wide"><span>Your notes</span><textarea class="item-notes-big" data-bind="${base}.notes" rows="8" placeholder="Describe the item, what it does, where you got it...">${esc(g.notes || '')}</textarea></label>`}
      ${del}</div>`;
    const body = d.el.parentElement?.querySelector('.entry-body'); // a compendium item has its text, so your notes go under it
    body?.querySelector('.item-foot')?.remove();
    if (g.id && body) body.insertAdjacentHTML('beforeend', `<div class="item-foot"><label class="small muted">Your notes</label><textarea data-bind="${base}.notes" rows="5" placeholder="Anything to remember about it">${esc(g.notes || '')}</textarea></div>`);
  }
  const redo = () => { changed({ rerender: true }); renderActions(); markOpen(); };
  d.el.onchange = e => {
    if (e.target.matches('[data-cd-name]')) { g.name = e.target.value; const h2 = $('#drawer h2'); if (h2) h2.textContent = g.name || 'Item'; redo(); }
    else if (e.target.matches('[data-cd-worn]')) { if (d.kind === 'barding') g.equipped = e.target.checked; else g.worn = e.target.checked; redo(); }
  };
  d.el.onclick = async e => {
    const pl = e.target.closest('[data-cd-plus]');
    if (pl) { setArmorPlus(g, +pl.dataset.cdPlus); const h2 = $('#drawer h2'); if (h2) h2.textContent = g.name; return redo(); }
    if (e.target.closest('[data-cd-fx]')) {
      if (d.kind === 'barding') await editArmorFx(-1, g);
      else {
        const m = await editModifier({ name: g.name || 'Item', note: '', active: true, effects: structuredClone(g.effects || []).concat(g.effects?.length ? [] : [{ target: 'ac', value: 1, type: 'untyped' }]) });
        if (!m) return;
        g.effects = m.effects;
      }
      return redo();
    }
    if (e.target.closest('[data-cd-fx-auto]')) { g.effects = suggestEffects(g.name); return redo(); }
    if (!e.target.closest('[data-cd-del]')) return;
    if (!await confirmBox(`Remove “${g.name || 'this item'}” from ${state.char.companions[d.ci].name || 'the companion'}?`, 'Remove')) return;
    const comp = state.char.companions[d.ci];
    if (d.kind === 'barding') comp.barding = null; else comp.items.splice(d.k, 1);
    compDrawer = null;
    closeDrawer();
    changed({ rerender: true });
  };
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
