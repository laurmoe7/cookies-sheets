// Monster Codex: browse every creature stat block (data/creatures.json, built by tools/creatures.py) by name, type and CR, read it, and take one as a companion.
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { newCreatureCompanion } from '../creaturecomp.js';
import { statBlockHtml } from '../summons.js';
import { esc, $, $$, debounce, wireEntryLinks, toast } from '../ui.js';
import { search as petSearch } from '../pet/pet.js';

const CR_RANGES = [['', 'Any CR'], ['0-1', 'CR 0 to 1'], ['2-4', 'CR 2 to 4'], ['5-8', 'CR 5 to 8'], ['9-12', 'CR 9 to 12'], ['13-20', 'CR 13 to 20'], ['21-40', 'CR 21 and up']];
const PAGE = 100;
const TYPES = ['Aberration', 'Animal', 'Construct', 'Dragon', 'Fey', 'Humanoid', 'Magical Beast', 'Monstrous Humanoid', 'Ooze', 'Outsider', 'Plant', 'Undead', 'Vermin']; // a few entries in the books have a class name for a type; they stay under All

const st = { q: '', type: '', cr: '', selected: null, rows: [], total: 0, types: {} }; // what you were looking at when you left the page

export async function renderMonsters(main) {
  main.innerHTML = `<div class="compendium monsters">
    <aside class="comp-cats" id="mon-types"></aside>
    <div class="comp-list">
      <div class="comp-search">
        <input id="mon-q" class="search" placeholder="Search monsters by name…" value="${esc(st.q)}" autocomplete="off">
        <div class="row"><select id="mon-cr">${CR_RANGES.map(([v, l]) => `<option value="${v}" ${v === st.cr ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="muted small grow" id="mon-count"></span></div>
      </div>
      <div id="mon-results" class="results"></div>
    </div>
    <div class="comp-pane"><article class="comp-detail entry-body" id="mon-detail"><div class="empty"><p class="muted">The Monster Codex: about 1,850 creatures from the Bestiaries, the NPC and Monster Codex and other books. Search by name, pick a type on the left or a CR range, and click a creature to read its stat block.</p>
      <p class="muted small">With a character open, a creature can be taken as a companion from here, or from the Companions tab.</p></div></article></div>
  </div>`;
  const q = $('#mon-q', main);
  const run = debounce(() => { st.q = q.value; search(main); }, 160);
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' && st.rows[0]) select(main, st.rows[0].i);
    if (e.key === 'ArrowDown') { e.preventDefault(); $('.result', main)?.focus(); }
  });
  $('#mon-cr', main).onchange = e => { st.cr = e.target.value; search(main); };
  $('#mon-types', main).addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (b) { st.type = b.dataset.type; search(main); }
  });
  const box = $('#mon-results', main);
  box.addEventListener('click', e => {
    const r = e.target.closest('.result');
    if (r) select(main, +r.dataset.i);
    if (e.target.closest('[data-more]')) search(main, true);
  });
  box.addEventListener('keydown', e => {
    const r = e.target.closest('.result');
    if (!r) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); r.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (r.previousElementSibling || q).focus(); }
    if (e.key === 'Enter') select(main, +r.dataset.i);
  });
  wireEntryLinks($('#mon-detail', main));
  await search(main);
  if (st.selected !== null) select(main, st.selected, false);
  q.focus();
}

let seq = 0; // a slow answer must not overwrite a newer one
async function search(main, more = false) {
  const my = ++seq;
  let res;
  try { res = await api.creatures(st.q, st.type, st.cr, PAGE, more ? st.rows.length : 0); } catch (e) { $('#mon-results', main).innerHTML = `<p class="pad bad">${esc(e.message)}</p>`; return; }
  if (my !== seq) return;
  if (!more) petSearch(st.q);
  st.rows = more ? [...st.rows, ...res.rows] : res.rows;
  st.total = res.total;
  st.types = res.types;
  drawTypes(main);
  $('#mon-count', main).textContent = `${res.total.toLocaleString()} creature${res.total === 1 ? '' : 's'}`;
  const box = $('#mon-results', main);
  const html = res.rows.map(rowHtml).join('') + (st.rows.length < res.total ? '<button class="btn small full" data-more>Load more</button>' : '');
  if (more) { $('[data-more]', box)?.remove(); box.insertAdjacentHTML('beforeend', html); } else box.innerHTML = html || '<p class="pad muted">No creatures match.</p>';
}

function drawTypes(main) {
  const all = Object.values(st.types).reduce((n, v) => n + v, 0);
  const types = TYPES.filter(t => st.types[t]);
  $('#mon-types', main).innerHTML = `<button class="cat ${st.type === '' ? 'on' : ''}" data-type="">All <span class="n">${all.toLocaleString()}</span></button>`
    + types.map(t => `<button class="cat ${st.type === t ? 'on' : ''}" data-type="${esc(t)}">${esc(t)}<span class="n">${st.types[t].toLocaleString()}</span></button>`).join('');
}

const rowHtml = r => `<div class="result ${st.selected === r.i ? 'sel' : ''}" tabindex="0" data-i="${r.i}">
  <div class="row"><b class="grow">${esc(r.name)}</b><span class="tag">CR ${esc(r.cr || '—')}</span></div>
  <div class="muted small">${esc([r.size, (r.type || '').toLowerCase(), r.source].filter(Boolean).join(' · '))}</div></div>`;

let selSeq = 0;
async function select(main, i, scroll = true) {
  st.selected = i;
  const my = ++selSeq;
  $$('.result', main).forEach(r => r.classList.toggle('sel', +r.dataset.i === i));
  const b = await api.creature(i);
  if (my !== selSeq) return;
  const det = $('#mon-detail', main);
  const c = state.char;
  det.innerHTML = `<div class="eyebrow">${esc(b.creature_type || 'Creature')}${b.source ? ' · ' + esc(b.source) : ''}</div><h2>${esc(b.name)}</h2>
    <div class="entry-actions">${c ? `<button class="btn small" data-add-companion>＋ Take as ${esc(c.name || 'your')} companion</button>` : '<span class="muted small">Open a character to take this as a companion.</span>'}</div>
    ${b.description ? `<p><i>${esc(b.description)}</i></p>` : ''}${statBlockHtml(b, { links: true, companion: true })}${ecology(b)}`;
  if (scroll) det.scrollTop = 0;
  wireEntryLinks(det);
  const add = $('[data-add-companion]', det);
  if (add) add.onclick = () => {
    c.companions ||= [];
    c.companions.push(newCreatureCompanion(b));
    changed();
    toast(`${b.name} added to ${c.name || 'your'} companions`, 'good');
  };
}

/** Where it lives and how it turns up, the part of a monster entry the stat block itself leaves out. */
function ecology(b) {
  const rows = [['Environment', b.environment], ['Organization', b.organization], ['Treasure', b.treasure]].filter(([, v]) => v);
  return rows.length ? `<h4>Ecology</h4>${rows.map(([k, v]) => `<p><b>${k}</b> ${esc(v)}</p>`).join('')}` : '';
}
