// "＋ Add weapon" and "＋ Add armor": a list of the standard ones to start from, or a blank row to fill in by hand (the old way).
import { api } from '../api.js';
import { esc, $, $$, modal } from '../ui.js';
import { filterTemplates } from '../equipment.js';

let dataPromise = null;
const load = () => (dataPromise ||= api.equipment().catch(e => { dataPromise = null; throw e; }));

const WEAPON_KINDS = [['', 'Any kind'], ['unarmed', 'Unarmed'], ['light', 'Light melee'], ['one-handed', 'One-handed melee'], ['two-handed', 'Two-handed melee'], ['ranged', 'Ranged']];
const ARMOR_KINDS = [['', 'Any armor'], ['light', 'Light armor'], ['medium', 'Medium armor'], ['heavy', 'Heavy armor'], ['shield', 'Shields']];
const sign = n => (n > 0 ? '+' + n : String(n));

/**
 * The template window. Resolves to a template, 'blank' (the player wants an empty row) or nothing (closed).
 * `small` picks which damage column is shown for the wielder's size.
 */
function chooser(title, kinds, head, rowCells, search, extraFilter) {
  return modal(title, (body, close) => {
    body.innerHTML = `<div class="row"><input class="search grow" placeholder="Search by name…">
        <select data-f="kind">${kinds.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${extraFilter?.html || ''}
        <button class="btn" data-blank title="An empty row to fill in yourself">Blank row instead</button></div>
      <p class="small muted" data-count>Loading…</p>
      <div class="equip-scroll"><table class="tbl equip-tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`;
    const q = $('input', body), kind = $('[data-f=kind]', body), tbody = $('tbody', body), count = $('[data-count]', body);
    let rows = [];
    const draw = (all) => {
      rows = filterTemplates(all, q.value, t => (!kind.value || t.kind === kind.value || t.category === kind.value) && (!extraFilter || extraFilter.test(t, body)));
      count.textContent = `${rows.length} to choose from. Click one to add it, then change anything you need.`;
      tbody.innerHTML = rows.map((t, i) => `<tr data-i="${i}" tabindex="0"><td><b>${esc(t.name)}</b></td>${rowCells(t).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="${head.length}" class="muted pad">Nothing matches.</td></tr>`;
    };
    load().then(data => {
      const all = search(data);
      [q, ...$$('select', body)].forEach(x => x.addEventListener('input', () => draw(all)));
      tbody.addEventListener('click', e => { const tr = e.target.closest('tr[data-i]'); if (tr) close(rows[+tr.dataset.i]); });
      tbody.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-i]'); if (tr && e.key === 'Enter') close(rows[+tr.dataset.i]); });
      draw(all);
      q.focus();
    }).catch(e => { count.textContent = `Could not load the list: ${e.message}`; count.classList.add('bad'); });
    $('[data-blank]', body).onclick = () => close('blank');
  }, { wide: true });
}

/** `size` is the wielder's size name (Small characters see the Small damage). */
export function chooseWeapon(size = 'Medium') {
  const small = ['Fine', 'Diminutive', 'Tiny', 'Small'].includes(size);
  return chooser('Add a weapon', WEAPON_KINDS, ['Weapon', 'Cost', small ? 'Dmg (S)' : 'Dmg (M)', 'Critical', 'Range', 'Weight', 'Type', 'Special'],
    t => [t.cost || '—', (small ? t.dmgS : t.dmgM) || '—', t.crit || '—', t.range || '—', t.weight ? `${t.weight} lb.` : '—', t.type || '—', t.special || '—'],
    data => data.weapons,
    { html: `<select data-f="prof"><option value="">Simple, martial, exotic</option><option>Simple</option><option>Martial</option><option>Exotic</option></select>`,
      test: (t, body) => !$('[data-f=prof]', body).value || t.prof === $('[data-f=prof]', body).value });
}

export function chooseArmor() {
  return chooser('Add armor or a shield', ARMOR_KINDS, ['Armor', 'Cost', 'AC', 'Max Dex', 'Check penalty', 'Spell failure', 'Speed (30 / 20 ft.)', 'Weight'],
    t => [t.cost || '—', sign(t.bonus), t.maxDex == null ? '—' : sign(t.maxDex), t.acp ? String(t.acp) : '0', `${t.asf}%`, t.speed30 ? `${t.speed30} / ${t.speed20}` : '—', t.weight ? `${t.weight} lb.` : '—'],
    data => data.armor);
}
