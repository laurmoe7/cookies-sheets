// Archetype chooser: a window like the spell picker. A searchable list on the left, the highlighted
// archetype read out in full on the right (what it gains at each level, what it replaces), and the
// chosen ones as chips on top. Used by the level-up wizard and the sheet's Feats & Abilities tab.
import { api } from '../api.js';
import { state } from '../app.js';
import { archetypeConflicts, bakeArchetype, findTargets, baseFeatures } from '../features.js';
import { esc, $, $$, modal } from '../ui.js';

const cache = new Map();
/** All archetypes for a class (cached). */
export function archetypesFor(cls) {
  if (!cache.has(cls)) cache.set(cls, api.archetypes(cls).catch(() => { cache.delete(cls); return []; }));
  return cache.get(cls);
}

const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

/** The archetype read out in full: description, each feature with its level and what it replaces. */
function detail(a, def) {
  const base = baseFeatures(def, 20);
  const cs = a.classSkills || { add: [], remove: [] };
  const feats = (a.features || []).map(f => {
    const hits = (f.replaces || []).flatMap(t => findTargets(base, t, def.name));
    const lv = f.level ?? (hits.length ? Math.min(...hits.map(h => h.level)) : null);
    const rep = (f.replaces || []).map(t => t.text || t.name).join(', ');
    const mod = (f.modifies || []).map(t => t.text || t.name).join(', ');
    return `<div class="arch-feat ${f.advice ? 'advice' : ''}">
      <div><span class="lv">${lv ? ord(lv) : '—'}</span><b>${esc(f.name)}</b>${rep ? ` <span class="rep">replaces ${esc(rep)}</span>` : ''}${mod ? ` <span class="rep">modifies ${esc(mod)}</span>` : ''}</div>
      <div class="arch-feat-text">${f.html || ''}</div></div>`;
  }).join('');
  return `${a.description ? `<p>${esc(a.description)}</p>` : ''}
    ${cs.add.length || cs.remove.length ? `<p class="small"><b>Class skills:</b> ${cs.add.length ? '+ ' + esc(cs.add.join(', ')) : ''}${cs.remove.length ? ` · − ${esc(cs.remove.join(', '))}` : ''}</p>` : ''}
    ${a.diminished ? '<p class="small warn">Diminished spellcasting: one fewer spell per day of each level.</p>' : ''}
    ${feats}`;
}

/** Dialog for the sheet and the wizard. Resolves with the new list, or undefined if cancelled. */
export function chooseArchetypes(cls, have) {
  let selected = [...have];
  const def = state.classesByName[cls];
  return modal(`Choose ${cls} archetype`, (body, close) => {
    body.innerHTML = `<div class="pick-status" id="ar-status"></div>
      <div class="row"><input class="search grow" placeholder="Search archetypes…"></div>
      <div class="picker"><div class="picker-list"><p class="pad muted">Loading archetypes…</p></div>
        <div class="picker-preview entry-body"><p class="muted">Select an archetype to read it.</p></div></div>
      <div class="row end"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    const status = $('#ar-status', body), q = $('input.search', body), listEl = $('.picker-list', body), prev = $('.picker-preview', body);
    let list = [], current = null; // `current` is the archetype shown on the right
    const sameAs = (s, a) => s.id === a.id || (!s.id && s.name.toLowerCase() === a.name.toLowerCase());
    const isOn = a => selected.some(s => sameAs(s, a));
    const chosen = () => list.filter(isOn);
    /** Why `a` cannot be taken together with what is already chosen ('' if it can). */
    const blockedBy = a => {
      if (isOn(a)) return '';
      const clash = archetypeConflicts([...chosen(), a], def).find(x => x.archetypes.includes(a.name));
      return clash ? `Can't combine with ${clash.archetypes.find(n => n !== a.name)}: both replace ${clash.feature}.` : '';
    };

    const drawStatus = () => {
      status.classList.toggle('done', selected.length > 0);
      status.innerHTML = selected.length
        ? `<span>Chosen:</span> ${selected.map((s, i) => `<span class="chip on">${esc(s.name)} <button class="icon-btn" data-unpick="${i}" title="Remove">✕</button></span>`).join('')}`
        : '<span class="left">None chosen</span> <span class="small">· optional: leave it empty to play the standard class</span>';
    };
    const drawList = () => {
      const f = q.value.trim().toLowerCase();
      const shown = list.filter(a => !f || (a.name + ' ' + (a.description || '') + ' ' + (a.source || '')).toLowerCase().includes(f));
      listEl.innerHTML = shown.map(a => {
        const why = blockedBy(a), on = isOn(a);
        return `<div class="pick-row ${on ? 'known' : ''} ${why ? 'blocked' : ''} ${current?.id === a.id ? 'sel' : ''}" data-id="${a.id}">
          <div><b>${esc(a.name)}</b> <span class="muted small">${esc(a.source || '')}</span></div>
          <div class="muted small">${esc(why || a.description || '')}</div>
          ${on ? '<button class="btn small" data-toggle>Remove</button>' : why ? '' : '<button class="btn small primary" data-toggle>Choose</button>'}</div>`;
      }).join('') || `<p class="pad muted">${list.length ? 'No archetypes match.' : `No archetypes for ${esc(cls)} in the compendium.`}</p>`;
    };
    const drawPreview = () => {
      if (!current) return;
      const why = blockedBy(current), on = isOn(current);
      prev.innerHTML = `<div class="row"><h3 class="grow">${esc(current.name)}</h3>
        ${on ? '<button class="btn" data-toggle>Remove</button>' : why ? '' : '<button class="btn primary" data-toggle>＋ Choose this archetype</button>'}</div>
        <div class="muted small">${esc(current.source || '')}</div>${why ? `<p class="small bad">${esc(why)}</p>` : ''}${detail(current, def)}`;
    };
    const refresh = () => { drawStatus(); drawList(); drawPreview(); };
    const toggle = a => {
      if (isOn(a)) selected = selected.filter(s => !sameAs(s, a));
      else if (!blockedBy(a)) selected = [...selected, bakeArchetype(a)];
      refresh();
    };

    q.addEventListener('input', drawList);
    status.addEventListener('click', e => {
      const u = e.target.closest('[data-unpick]');
      if (u) { selected.splice(+u.dataset.unpick, 1); refresh(); }
    });
    listEl.addEventListener('click', e => {
      const row = e.target.closest('.pick-row');
      if (!row) return;
      const a = list.find(x => x.id === +row.dataset.id);
      if (e.target.closest('[data-toggle]')) { current = a; toggle(a); return; }
      current = a;
      $$('.pick-row.sel', listEl).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      drawPreview();
    });
    prev.addEventListener('click', e => { if (e.target.closest('[data-toggle]') && current) toggle(current); });
    $('[data-cancel]', body).onclick = () => close(undefined);
    $('[data-save]', body).onclick = () => close(selected);

    archetypesFor(cls).then(all => {
      list = all;
      // Archetypes saved by name only (old sheets, imports) get their full data once we can match them.
      selected = selected.map(s => {
        if (s.features) return s;
        const hit = list.find(a => a.name.toLowerCase() === s.name.toLowerCase());
        return hit ? bakeArchetype(hit) : s;
      });
      refresh();
    });
    drawStatus();
  }, { wide: true });
}
