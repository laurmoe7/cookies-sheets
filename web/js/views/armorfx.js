// The armor enchantment window and the chip under an armor or shield's name (Inventory tab, Armor & Shields).
import { state, changed } from '../app.js';
import { materialsFor, abilitiesFor, MATERIAL_BY_ID, armorFx } from '../armorfx.js';
import { esc, modal } from '../ui.js';

/** The chip under an item's name: its enchantments in short, or "Enchant" when it has none. */
export function armorFxChip(c, i) {
  const fx = armorFx(c.armor[i]);
  const warn = fx.warn ? ` <span class="bad small" title="${esc(fx.warn)}">⚠</span>` : '';
  return `<div class="wfx"><button class="wbtn fx ${fx.summary ? 'set' : ''}" data-afx="${i}" title="Enchantments, special material and masterwork">✦ ${esc(fx.summary || 'Enchant')}</button>${warn}</div>`;
}

export function wireArmorFx(body) {
  body.addEventListener('click', e => {
    const t = e.target.closest('[data-afx]');
    if (t) { e.preventDefault(); editArmorFx(+t.dataset.afx); }
  });
}

function editArmorFx(i) {
  const c = state.char, a = c.armor[i];
  if (!a) return;
  a.fx ||= [];
  const type = a.type === 'shield' ? 'shield' : 'armor';
  modal(`${a.name || (type === 'shield' ? 'Shield' : 'Armor')}: enchantments`, body => {
    const draw = () => {
      const fx = armorFx(a), mat = MATERIAL_BY_ID[a.material || ''];
      const has = id => a.fx.some(f => f.id === id);
      const mwLocked = (a.material && mat.mw);
      body.innerHTML = `<div class="wfx-win">
        <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
          <label>Enhancement bonus <input type="number" class="num w3" min="0" max="10" data-a-enh value="${esc(a.enh || 0)}"></label>
          <label title="Lowers the armor check penalty by 1"><input type="checkbox" data-a-mw ${a.mw || mwLocked ? 'checked' : ''} ${mwLocked ? 'disabled' : ''}> Masterwork</label>
        </div>
        <div class="row" style="margin:8px 0"><label>Material <select data-a-mat>${materialsFor(type).map(m => `<option value="${m.id}" ${m.id === (a.material || '') ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>
        ${mat.note ? `<p class="small muted">${esc(mat.note)}</p>` : ''}
        <h4 style="margin:10px 0 4px">Special abilities</h4>
        <div class="wfx-grid">${abilitiesFor(type).map(x => `<label class="wfx-ab" title="${esc(x.note || '')}"><input type="checkbox" data-fx="${x.id}" ${has(x.id) ? 'checked' : ''}> ${esc(x.name)}${x.plus ? ` <span class="muted">+${x.plus}</span>` : ''}</label>`).join('')}</div>
        <p class="small" style="margin-top:10px"><b>${esc(fx.summary || 'No enchantments')}</b> ${fx.warn ? `<span class="bad">${esc(fx.warn)}</span>` : ''}</p>
        <p class="small muted">The armor bonus, check penalty, Dex cap and spell failure in the table are the base armor’s; masterwork and the material adjust them for you. Skill bonuses (shadow, slick), damage reduction, spell resistance, energy resistance and fortification show on the Overview.</p>
      </div>`;
    };
    draw();
    body.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.fx) {
        const k = a.fx.findIndex(f => f.id === t.dataset.fx);
        if (t.checked && k < 0) a.fx.push({ id: t.dataset.fx });
        else if (!t.checked && k >= 0) a.fx.splice(k, 1);
      } else if (t.dataset.aMat !== undefined) a.material = t.value;
      else if (t.dataset.aMw !== undefined) a.mw = t.checked;
      else if (t.dataset.aEnh !== undefined) a.enh = Math.max(0, Math.min(10, +t.value || 0));
      else return;
      changed({ rerender: true });
      draw();
    });
  });
}
