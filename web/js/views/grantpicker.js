// Choosing a domain, bloodline, mystery, patron or spirit, and putting the spells it grants on the Spells tab.
// Used by the level-up wizard and the Spells tab. The rules are in ../grants.js.
import { api } from '../api.js';
import { esc } from '../ui.js';
import { sourceOf, optionsFor, grantedSpells, missingGranted, grantLabel } from '../grants.js';

let data = null, loading = null;
/** The granted spell lists (data/grants.json), loaded once. `then` runs after the first load (to redraw the page). */
export function grantsData(then) {
  if (data) return data;
  loading ||= api.grants().then(x => { data = x; then?.(); return x; }).catch(() => { loading = null; return null; });
  return null;
}
export const loadGrants = () => (data ? Promise.resolve(data) : (loading ||= api.grants().then(x => (data = x)).catch(() => { loading = null; return null; })));

const SL = ['0', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

/**
 * The selects for one class's choices, plus each choice's spell list (the ones already granted at caster level `lv` in full,
 * the later ones dimmed with the level they come at). `def` is the class definition.
 */
export function grantPickerHtml(cls, choices, { def, lv, compact = false } = {}) {
  const src = sourceOf(cls), d = data;
  if (!src || !d) return '';
  const groups = optionsFor(d, cls);
  const val = ch => (ch ? `${ch.kind}|${ch.name}` : '');
  const selects = Array.from({ length: src.count }, (_, i) => {
    const mine = choices[i];
    const taken = new Set(choices.filter((_, j) => j !== i).map(val));
    return `<select data-grant-slot="${i}" data-cls="${esc(cls)}" aria-label="${esc(src.title)} ${i + 1}">
      <option value="">${src.optional ? 'None' : '— choose —'}</option>
      ${groups.map(g => `<optgroup label="${esc(g.title)}">${g.options.filter(o => !taken.has(val(o))).map(o =>
        `<option value="${esc(val(o))}" ${val(o) === val(mine) ? 'selected' : ''}>${esc(o.name)}${o.domain ? ` (${esc(o.domain)})` : ''}</option>`).join('')}</optgroup>`).join('')}
    </select>`;
  }).join('');
  const lists = choices.filter(Boolean).map(ch => {
    const item = d[ch.kind]?.[ch.name];
    if (!item) return '';
    const now = new Set(grantedSpells(d, def, [ch], lv).map(s => `${s.name}|${s.level}`));
    return `<div class="grant-list"><b>${esc(grantLabel(ch))}</b> <span class="muted small">${esc(item.source)}</span>
      <span class="grant-spells">${item.spells.map(s => {
        const has = now.has(`${s.name}|${s.level}`);
        return `<span class="grant-sp ${has ? '' : 'later'}" title="${esc(`${SL[s.level]}-level spell${s.at ? `, from ${ORD(s.at)} level` : ''}${s.note ? ` (${s.note})` : ''}${has ? '' : ': not yet'}`)}"><span class="dim small">${SL[s.level]}</span> ${esc(s.name)}${!has && s.at ? ` <span class="dim small">(at ${ORD(s.at)})</span>` : ''}</span>`;
      }).join('')}</span></div>`;
  }).join('');
  return `<div class="grant-pick ${compact ? 'compact' : ''}"><div class="row grant-selects">${selects}</div>${lists}</div>`;
}

/** Calls onChange(newChoices) when a select changes. `choices` is the current list for that class. */
export function wireGrantPicker(el, getChoices, onChange) {
  el.querySelectorAll('[data-grant-slot]').forEach(s => (s.onchange = () => {
    const cls = s.dataset.cls;
    const next = [...getChoices(cls)];
    const [kind, name] = s.value ? s.value.split('|') : [];
    next[+s.dataset.grantSlot] = kind ? { kind, name } : null;
    onChange(cls, next.filter(Boolean));
  }));
}

/**
 * Put the spells that `cls`'s choices grant at caster level `lv` on its Spells tab list, with their compendium entry when there is one.
 * Returns how many were added. `book` is c.spellbooks[cls]; `addedAt` marks the level they came with.
 */
export async function addGrantedSpells(book, cls, def, choices, lv, addedAt) {
  const d = await loadGrants();
  if (!d) return 0;
  const add = missingGranted(grantedSpells(d, def, choices, lv), book.spells);
  if (!add.length) return 0;
  let hits = [];
  try { hits = await api.resolve(add.map(s => ({ variants: [s.name], cats: ['Spell'] }))); } catch { hits = []; }
  let full = [];
  try { full = await api.entries(hits.filter(Boolean).map(h => h.id)); } catch { full = []; }
  const byId = new Map(full.filter(Boolean).map(e => [e.id, e]));
  add.forEach((s, i) => {
    const h = hits[i], e = h && byId.get(h.id);
    book.spells.push({ ...(h ? { id: h.id } : {}), name: h?.name || s.name, level: s.level, school: h?.sub || '', summary: e?.summary || '',
      notes: s.note || '', granted: s.granted, prepared: 0, cast: 0, ...(addedAt ? { addedAt } : {}) });
  });
  return add.length;
}
