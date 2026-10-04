// Archetype chooser: cards with each archetype's description, what it gains at each level and what it
// replaces. Used inline by the level-up wizard and in a dialog from the sheet.
import { api } from '../api.js';
import { state } from '../app.js';
import { archetypeConflicts, bakeArchetype, findTargets, baseFeatures } from '../features.js';
import { esc, $, modal } from '../ui.js';

const cache = new Map();
/** All archetypes for a class (cached). */
export function archetypesFor(cls) {
  if (!cache.has(cls)) cache.set(cls, api.archetypes(cls).catch(() => { cache.delete(cls); return []; }));
  return cache.get(cls);
}

const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function card(a, def, on, blockedBy) {
  const base = baseFeatures(def, 20);
  const feats = (a.features || []).filter(f => !f.advice);
  const cs = a.classSkills || { add: [], remove: [] };
  return `<div class="arch-card ${on ? 'on' : ''} ${blockedBy ? 'blocked' : ''}" data-arch-id="${a.id}" title="${blockedBy ? esc(blockedBy) : on ? 'Click to remove' : 'Click to choose'}">
    <div class="row" style="margin:0"><h4 class="grow">${on ? '✓ ' : ''}${esc(a.name)}</h4>
      <a href="#" class="ref small" data-entry="${esc(a.name)}" data-entry-id="${a.id}">read full</a></div>
    <div class="muted small">${esc(a.source || '')}</div>
    ${a.description ? `<div class="desc">${esc(a.description)}</div>` : ''}
    <ul>${feats.map(f => {
      const hits = (f.replaces || []).flatMap(t => findTargets(base, t));
      const lv = f.level ?? (hits.length ? Math.min(...hits.map(h => h.level)) : null);
      const rep = (f.replaces || []).map(t => t.text || t.name).join(', ');
      return `<li><span class="lv">${lv ? ord(lv) : '—'}</span><b>${esc(f.name)}</b>${rep ? ` <span class="rep">replaces ${esc(rep)}</span>` : ''}</li>`;
    }).join('')}</ul>
    ${cs.add.length || cs.remove.length ? `<div class="small">Class skills: ${cs.add.length ? '+ ' + esc(cs.add.join(', ')) : ''}${cs.remove.length ? ` · − ${esc(cs.remove.join(', '))}` : ''}</div>` : ''}
    ${a.diminished ? '<div class="small warn">Diminished spellcasting: one fewer spell per day of each level.</div>' : ''}
    ${blockedBy ? `<div class="why">${esc(blockedBy)}</div>` : ''}
  </div>`;
}

/**
 * Render the chooser into `el`. `selected` is an array of archetype objects; `onChange(newSelected)` is
 * called after every toggle. Archetypes that replace a feature another chosen archetype already replaces
 * are blocked, since the rules don't allow combining them.
 */
export async function renderArchetypeChooser(el, cls, selected, onChange) {
  const def = state.classesByName[cls];
  el.innerHTML = '<p class="muted">Loading archetypes…</p>';
  const list = await archetypesFor(cls);
  if (!list.length) { el.innerHTML = `<p class="muted">No archetypes for ${esc(cls)} in the compendium.</p>`; return; }
  let filter = '';
  // Archetypes saved by name only (old sheets, imports) get their full data once we can match them.
  if (selected.some(s => !s.features)) {
    selected = selected.map(s => {
      if (s.features) return s;
      const hit = list.find(a => a.name.toLowerCase() === s.name.toLowerCase());
      return hit ? bakeArchetype(hit) : s;
    });
    onChange(selected);
  }
  const isOn = a =>selected.some(s => s.id === a.id || (!s.id && s.name.toLowerCase() === a.name.toLowerCase()));
  const draw = () => {
    const chosen = list.filter(isOn);
    const shown = list.filter(a => !filter || (a.name + ' ' + (a.description || '')).toLowerCase().includes(filter));
    el.innerHTML = `<div class="row">
        <input class="search grow" placeholder="Filter ${list.length} ${esc(cls)} archetypes…" value="${esc(filter)}">
        <span class="muted small">${chosen.length ? `Chosen: <b>${chosen.map(a => esc(a.name)).join(', ')}</b>` : 'Optional: choose none to play the standard class.'}</span></div>
      <div class="arch-grid">${shown.map(a => {
        let blocked = '';
        if (!isOn(a)) {
          const clash = archetypeConflicts([...chosen, a], def).find(x => x.archetypes.includes(a.name));
          if (clash) blocked = `Can't combine with ${clash.archetypes.find(n => n !== a.name)}: both replace ${clash.feature}.`;
        }
        return card(a, def, isOn(a), blocked);
      }).join('') || '<p class="muted">No archetypes match.</p>'}</div>`;
    const input = $('input.search', el);
    input.oninput = () => { filter = input.value.toLowerCase(); const pos = input.selectionStart; draw(); const i2 = $('input.search', el); i2.focus(); i2.setSelectionRange(pos, pos); };
  };
  el.onclick = e => {
    if (e.target.closest('[data-entry]')) return; // "read full" opens the drawer
    const c = e.target.closest('[data-arch-id]');
    if (!c || c.classList.contains('blocked')) return;
    const a = list.find(x => x.id === +c.dataset.archId);
    selected = isOn(a) ? selected.filter(s => !(s.id === a.id || (!s.id && s.name.toLowerCase() === a.name.toLowerCase()))) : [...selected, bakeArchetype(a)];
    onChange(selected);
    draw();
  };
  draw();
}

/** Dialog version for the sheet. Resolves with the new list, or undefined if cancelled. */
export function chooseArchetypes(cls, current) {
  let picked = [...current];
  return modal(`${cls} archetypes`, (body, close) => {
    body.innerHTML = `<div id="arch-chooser"></div>
      <div class="row end"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    renderArchetypeChooser($('#arch-chooser', body), cls, picked, s => (picked = s));
    $('[data-cancel]', body).onclick = () => close(undefined);
    $('[data-save]', body).onclick = () => close(picked);
  }, { wide: true });
}
