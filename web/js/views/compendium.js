import { api } from '../api.js';
import { state, changed } from '../app.js';
import { esc, $, $$, debounce, entryHtml, wireEntryLinks, toast } from '../ui.js';
import { SCHOOLS, SPELL_LIST_CLASSES, FEAT_TYPES, TRAIT_CATEGORIES } from '../data.js';
import { search as petSearch } from '../pet/pet.js';
import { traitRaces } from '../racetraits.js';

const CATS = ['Spell', 'Feat', 'Trait', 'Rules', 'Condition', 'Class', 'Archetype', 'Class Feature', 'Race', 'Racial Trait',
  'Skill', 'Magic Item', 'Affliction', 'Mythic Spell', 'Monster Ability'];
const SPELL_CLASSES = SPELL_LIST_CLASSES;

// Categories with a second filter, and its choices.
const SUB_FILTERS = { Feat: ['Any type', FEAT_TYPES], Trait: ['Any category', TRAIT_CATEGORIES.filter(([, v]) => v !== 'Racial')],
  'Racial Trait': ['Any race', []] }; // the races are filled in once they are loaded
const st = { q: '', cat: '', cls: '', level: '', school: '', sub: '', selected: null, results: [], offset: 0 };

export async function renderCompendium(main) {
  main.innerHTML = `<div class="compendium">
    <aside class="comp-cats">
      <button class="cat ${st.cat === '' ? 'on' : ''}" data-cat="">All <span class="n" id="n-all"></span></button>
      ${CATS.map(c => `<button class="cat ${st.cat === c ? 'on' : ''}" data-cat="${c}">${c}<span class="n" data-n="${c}"></span></button>`).join('')}
    </aside>
    <div class="comp-list">
      <div class="comp-search">
        <input id="comp-q" class="search" placeholder="Search spells, feats, rules… (Ctrl+K)" value="${esc(st.q)}" autocomplete="off">
        <div class="row spell-filters ${st.cat === 'Spell' ? '' : 'hidden'}">
          <select id="f-cls"><option value="">Any class</option>${SPELL_CLASSES.map(c => `<option ${c === st.cls ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <select id="f-level"><option value="">Any level</option>${[...Array(10).keys()].map(l => `<option ${String(l) === st.level ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select id="f-school"><option value="">Any school</option>${SCHOOLS.map(s => `<option ${s === st.school ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        ${SUB_FILTERS[st.cat] ? `<div class="row sub-filters"><select id="f-sub"><option value="">${SUB_FILTERS[st.cat][0]}</option>${SUB_FILTERS[st.cat][1].map(([label, v]) => `<option value="${esc(v)}" ${v === st.sub ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>` : ''}
      </div>
      <div id="comp-results" class="results"></div>
    </div>
    <div class="comp-pane"><article class="comp-detail entry-body" id="comp-detail"><div class="empty"><p class="muted">Search the full OGL compendium: about 2,250 spells, 1,200 feats, traits, classes, archetypes, races, magic items, conditions, and the core rules text.</p>
      <p class="muted small">Tip: click any underlined link on your character sheet to open its rules here or in the side panel.</p></div></article></div>
  </div>`;
  api.categories().then(cs => {
    let tot = 0;
    for (const { cat, n } of cs) { tot += n; const el = $(`[data-n="${cat}"]`, main); if (el) el.textContent = n.toLocaleString(); }
    $('#n-all', main).textContent = tot.toLocaleString();
  });
  const q = $('#comp-q', main);
  const run = debounce(() => { st.q = q.value; st.offset = 0; search(main); }, 160);
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' && st.results[0]) select(main, st.results[0].id);
    if (e.key === 'ArrowDown') { e.preventDefault(); $('.result', main)?.focus(); }
  });
  $$('.cat', main).forEach(b => (b.onclick = () => { st.cat = b.dataset.cat; st.sub = ''; st.offset = 0; renderCompendium(main); }));
  const subSel = $('#f-sub', main);
  if (subSel && st.cat === 'Racial Trait') traitRaces().then(l => subSel.insertAdjacentHTML('beforeend', l.map(r => `<option ${r === st.sub ? 'selected' : ''}>${esc(r)}</option>`).join('')));
  if (subSel) subSel.onchange = () => { st.sub = subSel.value; st.offset = 0; search(main); };
  for (const [id, k] of [['f-cls', 'cls'], ['f-level', 'level'], ['f-school', 'school']]) {
    $('#' + id, main).onchange = e => { st[k] = e.target.value; search(main); };
  }
  $('#comp-results', main).addEventListener('click', e => {
    const r = e.target.closest('.result');
    if (r) select(main, +r.dataset.id);
    if (e.target.closest('[data-more]')) { st.offset += 100; search(main, true); }
  });
  $('#comp-results', main).addEventListener('keydown', e => {
    const r = e.target.closest('.result');
    if (!r) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); r.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (r.previousElementSibling || q).focus(); }
    if (e.key === 'Enter') select(main, +r.dataset.id);
  });
  wireEntryLinks($('#comp-detail', main));
  await search(main);
  if (st.selected) select(main, st.selected, false);
  q.focus();
}

let searchSeq = 0;
async function search(main, append = false) {
  const my = ++searchSeq;
  let rows;
  const box = $('#comp-results', main);
  if (st.cat === 'Spell' && (st.cls || st.level !== '' || st.school)) {
    rows = await api.spells(st.cls, st.level, st.q, st.school);
    if (my !== searchSeq) return;
    rows = rows.map(r => ({ ...r, cat: 'Spell', sub: r.school, lvl: st.cls ? `${st.cls} ${r.level}` : '' }));
    st.results = rows;
    box.innerHTML = rows.length ? `<div class="muted small pad">${rows.length} spells</div>` + rows.map(rowHtml).join('') : '<p class="pad muted">No matches.</p>';
    return;
  }
  rows = await api.search(st.q, st.cat, 100, st.offset, SUB_FILTERS[st.cat] ? (st.cat === 'Racial Trait' && st.sub ? '=' + st.sub : st.sub) : '');
  if (my !== searchSeq) return;
  if (!append) petSearch(st.q);
  st.results = append ? [...st.results, ...rows] : rows;
  const html = rows.map(rowHtml).join('') + (rows.length === 100 ? '<button class="btn small full" data-more>Load more</button>' : '');
  if (append) { $('[data-more]', box)?.remove(); box.insertAdjacentHTML('beforeend', html); } else box.innerHTML = html || '<p class="pad muted">No matches.</p>';
}

const rowHtml = r => `<div class="result ${st.selected === r.id ? 'sel' : ''}" tabindex="0" data-id="${r.id}">
  <div class="row"><b class="grow">${esc(r.name)}</b><span class="tag">${esc(r.cat)}</span></div>
  <div class="muted small">${esc([r.lvl, r.sub, r.source].filter(Boolean).join(' · '))}</div>
  ${r.summary ? `<div class="small">${esc(r.summary)}</div>` : ''}</div>`;

async function select(main, id, scroll = true) {
  st.selected = id;
  $$('.result', main).forEach(r => r.classList.toggle('sel', +r.dataset.id === id));
  const en = await api.entry(id);
  const det = $('#comp-detail', main);
  det.innerHTML = `<div class="eyebrow">${esc(en.cat)}${en.sub ? ' · ' + esc(en.sub) : ''}</div><h2>${esc(en.name)}</h2>
    <div class="entry-actions">${addButtons(en)}</div>${entryHtml(en)}`;
  if (scroll) det.scrollTop = 0;
  $$('[data-add-to]', det).forEach(b => (b.onclick = () => addToCharacter(en, b.dataset.addTo, b.dataset.cls, b.dataset.level)));
}

function addButtons(en) {
  const c = state.char;
  if (!c) return '';
  const name = esc(c.name);
  if (en.cat === 'Feat') return `<button class="btn small" data-add-to="feats">＋ Add to ${name}'s feats</button>`;
  if (en.cat === 'Trait' || en.cat === 'Racial Trait') return `<button class="btn small" data-add-to="traits">＋ Add to ${name}'s traits</button>`;
  if (en.cat === 'Class Feature') return `<button class="btn small" data-add-to="specials">＋ Add to ${name}'s abilities</button>`;
  if (en.cat === 'Magic Item') return `<button class="btn small" data-add-to="gear">＋ Add to ${name}'s gear</button>`;
  if (en.cat === 'Spell' && state.derived) {
    const levels = en.meta?.levels || {};
    return Object.entries(state.derived.spellcasting).map(([cls, sc]) => {
      const lv = sc.lists.map(l => levels[l]).filter(x => x != null);
      if (!lv.length) return '';
      const l = Math.min(...lv);
      return `<button class="btn small" data-add-to="spell" data-cls="${esc(cls)}" data-level="${l}">＋ ${esc(cls)} spell (level ${l})</button>`;
    }).join('');
  }
  return '';
}

function addToCharacter(en, where, cls, level) {
  const c = state.char;
  if (where === 'spell') {
    const book = (c.spellbooks[cls] ||= { spells: [], used: Array(10).fill(0), extraSlot: false });
    book.spells.push({ id: en.id, name: en.name, level: +level, school: en.sub, summary: en.summary, prepared: 0, cast: 0 });
  } else if (where === 'gear') {
    const w = parseFloat((en.html.match(/<dt>Weight<\/dt><dd>([\d.]+)/) || [])[1]) || 0;
    c.gear.push({ id: en.id, name: en.name, qty: 1, weight: w, value: (en.html.match(/<dt>Price<\/dt><dd>([^<]+)/) || [])[1] || '', notes: '' });
  } else {
    c[where].push({ id: en.id, name: en.name, sub: en.sub, notes: '', level: state.derived?.level });
  }
  changed();
  toast(`Added ${en.name}`, 'good');
}
