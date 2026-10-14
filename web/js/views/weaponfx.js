// The weapon enchantment window and the quick switches under a weapon's name (Overview, Weapons & Attacks).
import { state, changed } from '../app.js';
import { MATERIALS, ABILITIES, MATERIAL_BY_ID, weaponFx } from '../weaponfx.js';
import { esc, modal } from '../ui.js';

/** The chip and the conditional switches (holy: vs evil...) shown under a weapon's name. */
export function weaponFxRow(c, i) {
  const w = c.weapons[i], fx = weaponFx(w);
  const sw = fx.conds.map(x => `<label class="small wfx-sw" title="Switch on while the target is right for ${esc(x.name)} (${esc(x.label)})"><input type="checkbox" data-wfx-on="${i}:${esc(x.id)}" ${x.on ? 'checked' : ''}> ${esc(x.label)}</label>`).join(' ');
  const warn = fx.warn ? ` <span class="bad small" title="${esc(fx.warn)}">⚠</span>` : '';
  return `<div class="wfx"><button class="wbtn fx ${fx.summary ? 'set' : ''}" data-wfx="${i}" title="Enchantments, special material and masterwork">✦ ${esc(fx.summary || 'Enchant')}</button>${warn} ${sw}</div>`;
}

/** Clicks inside the weapons table: open the window, flip a conditional switch. */
export function wireWeaponFx(body, c) {
  body.addEventListener('click', e => {
    const t = e.target.closest('[data-wfx]');
    if (t) { e.preventDefault(); editWeaponFx(+t.dataset.wfx); }
  });
  body.addEventListener('change', e => {
    const t = e.target.closest('[data-wfx-on]');
    if (!t) return;
    const [i, id] = t.dataset.wfxOn.split(':');
    const f = (c.weapons[+i].fx || []).find(x => x.id === id);
    if (f) { f.on = t.checked; changed({ rerender: true }); }
  });
}

function editWeaponFx(i) {
  const c = state.char, w = c.weapons[i];
  if (!w) return;
  w.fx ||= [];
  modal(`${w.name || 'Weapon'}: enchantments`, body => {
    const draw = () => {
      const fx = weaponFx(w), mat = MATERIAL_BY_ID[w.material || ''];
      const has = id => w.fx.some(f => f.id === id);
      const mwLocked = (w.material && mat.mw) || +w.enh > 0;
      body.innerHTML = `<div class="wfx-win">
        <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
          <label>Enhancement bonus <input type="number" class="num w3" min="0" max="10" data-w-enh value="${esc(w.enh || 0)}"></label>
          <label title="+1 to attack when the weapon has no enhancement bonus"><input type="checkbox" data-w-mw ${fx.mw ? 'checked' : ''} ${mwLocked ? 'disabled' : ''}> Masterwork</label>
          <label title="The feat doubles the threat range; it does not stack with keen"><input type="checkbox" data-w-ic ${w.improvedCritical ? 'checked' : ''}> Improved Critical</label>
        </div>
        <div class="row" style="margin:8px 0"><label>Material <select data-w-mat>${MATERIALS.map(m => `<option value="${m.id}" ${m.id === (w.material || '') ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>
        ${mat.note ? `<p class="small muted">${esc(mat.note)}${mat.weight ? ' The weight in the table is halved when carried.' : ''}</p>` : ''}
        <h4 style="margin:10px 0 4px">Special abilities</h4>
        <div class="wfx-grid">${ABILITIES.map(a => `<label class="wfx-ab" title="${esc(a.note || (a.dice ? `+${a.dice} ${a.type || ''} damage on a hit` : a.condDice ? `+${a.condDice} against the right target` : ''))}"><input type="checkbox" data-fx="${a.id}" ${has(a.id) ? 'checked' : ''}> ${esc(a.name)} <span class="muted">+${a.plus}</span></label>`).join('')}</div>
        <p class="small" style="margin-top:10px"><b>${esc(fx.summary || 'No enchantments')}</b> ${fx.warn ? `<span class="bad">${esc(fx.warn)}</span>` : ''}</p>
        <p class="small muted">The conditional abilities (holy, bane...) get a switch under the weapon’s name. Extra dice from enchantments are added to the damage roll but are not multiplied on a critical hit. Bursts and thundering add their own dice on a critical hit.</p>
      </div>`;
    };
    draw();
    body.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.fx) {
        const k = w.fx.findIndex(f => f.id === t.dataset.fx);
        if (t.checked && k < 0) w.fx.push({ id: t.dataset.fx, on: false });
        else if (!t.checked && k >= 0) w.fx.splice(k, 1);
      } else if (t.dataset.wMat !== undefined) w.material = t.value;
      else if (t.dataset.wMw !== undefined) w.mw = t.checked;
      else if (t.dataset.wIc !== undefined) w.improvedCritical = t.checked;
      else if (t.dataset.wEnh !== undefined) w.enh = Math.max(0, Math.min(10, +t.value || 0));
      else return;
      changed({ rerender: true });
      draw();
    });
  });
}
