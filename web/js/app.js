import { api } from './api.js';
import { compute, sign } from './calc.js';
import { newCharacter, migrate } from './model.js';
import { $, $$, getPath, setPath, toast, showEntry, closeDrawer, debounce, modal, initTextFields, initTooltips } from './ui.js';
import { initSheetSearch } from './sheetsearch.js';
import { renderHome } from './views/home.js';
import { renderSheet } from './views/sheet.js';
import { renderLevelUp } from './views/levelup.js';
import { renderCompendium } from './views/compendium.js';
import { renderRules } from './views/rules.js';

export const state = {
  char: null, classes: [], classesByName: {}, derived: null,
  view: 'home', sheetTab: 'overview', dirty: false,
};

const VIEWS = { home: renderHome, sheet: renderSheet, levelup: renderLevelUp, compendium: renderCompendium, rules: renderRules };

export function go(view, opts = {}) {
  if ((view === 'sheet' || view === 'levelup') && !state.char) view = 'home';
  state.view = view;
  Object.assign(state, opts);
  $$('#nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}

export function render({ keepScroll = false } = {}) {
  const main = $('#main');
  const top = main.scrollTop;
  document.dispatchEvent(new Event('view-leave'));
  main.innerHTML = '';
  main.scrollTop = 0;
  if (state.char) recalc();
  VIEWS[state.view](main);
  refreshCalc();
  updateHeader();
  if (keepScroll) main.scrollTop = top; // edits re-draw the page; don't jump back to the top
}

export function recalc() {
  if (state.char) state.derived = compute(state.char, state.classesByName);
}

const FORMATS = {
  sign, plain: v => (v ?? '—'),
  slots: v => (v == null ? '—' : v === Infinity ? '∞' : v),
};
export function refreshCalc(root = document) {
  if (!state.derived) return;
  for (const el of $$('[data-calc]', root)) {
    const v = getPath(state.derived, el.dataset.calc);
    el.textContent = (FORMATS[el.dataset.fmt] || FORMATS.plain)(v);
  }
  document.dispatchEvent(new Event('recalc'));
}

function updateHeader() {
  const c = state.char;
  $('#sheet-search-wrap').hidden = !(c && state.view === 'sheet');
  const av = $('#char-avatar');
  av.hidden = !(c && c.avatar);
  if (c && c.avatar && av.getAttribute('src') !== c.avatar) av.src = c.avatar;
  $('#char-title').textContent = c ? c.name || 'Unnamed' : 'No character loaded';
  const d = state.derived;
  $('#char-sub').textContent = c && d
    ? `${d.race.name} · ${Object.entries(d.classLevels).map(([k, v]) => `${k} ${v}`).join(' / ') || 'Level 0'}`
    : 'Create or open a character to begin';
  $('#save-state').textContent = !c ? '' : state.dirty ? 'Saving…' : 'Saved';
  const ready = c && d && d.xp.levelByXp > d.level && d.level > 0;
  $('#nav [data-view=levelup]').classList.toggle('pulse', !!ready);
}

const saveNow = debounce(async () => {
  if (!state.char) return;
  try {
    const r = await api.saveCharacter(state.char);
    state.char.id = r.id;
    state.dirty = false;
    try { localStorage.setItem('lastChar', r.id); } catch { /* storage may be unavailable */ }
    updateHeader();
  } catch (e) { toast('Save failed: ' + e.message, 'err'); }
}, 500);

export function changed({ rerender = false } = {}) {
  state.dirty = true;
  if (rerender) render({ keepScroll: true }); else { recalc(); refreshCalc(); updateHeader(); }
  saveNow();
}

export async function openCharacter(id) {
  state.char = migrate(await api.character(id));
  state.dirty = false;
  try { localStorage.setItem('lastChar', id); } catch { /* storage may be unavailable */ }
  go('sheet', { sheetTab: 'overview' });
}

export function createCharacter() {
  state.char = newCharacter();
  state.dirty = true;
  saveNow();
  go('levelup');
}

// Two-way binding: <input data-bind="abilities.str.base" data-type="num">
function onInput(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.bind || !state.char) return;
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.dataset.type === 'num') v = el.value === '' ? '' : Number(el.value);
  else v = el.value;
  setPath(state.char, el.dataset.bind, v);
  changed({ rerender: 'rerender' in el.dataset && e.type === 'change' });
}

async function init() {
  document.addEventListener('input', onInput);
  initTooltips();
  initSheetSearch();
  initTextFields({
    get: path => (state.char ? getPath(state.char, path) : ''),
    set: (path, v) => { if (state.char) { setPath(state.char, path, v); changed(); } },
  });
  document.addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT' || 'rerender' in (e.target.dataset || {})) onInput(e); });
  $$('#nav [data-view]').forEach(b => (b.onclick = () => go(b.dataset.view)));
  // Any element with data-entry="Name" (and optional data-cat) opens the reference drawer.
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-entry]');
    if (t) { e.preventDefault(); showEntry(t.dataset.entryId ? +t.dataset.entryId : t.dataset.entry, t.dataset.cat); }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); go('compendium'); setTimeout(() => $('#comp-q')?.focus(), 0); }
    if (e.key === 'Escape' && !$('.modal-back')) closeDrawer();
  });
  $('#ogl-link').onclick = async e => {
    e.preventDefault();
    const text = await (await fetch('ogl.html')).text();
    modal('Open Game License', body => { body.innerHTML = `<div class="entry-body">${text}</div>`; }, { wide: true });
  };
  $('#theme-toggle').onclick = () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = cur;
    try { localStorage.setItem('theme', cur); } catch { /* ignore */ }
  };
  try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* ignore */ }

  state.classes = await api.classes();
  state.classesByName = Object.fromEntries(state.classes.map(c => [c.name, c]));
  let last = null;
  try { last = localStorage.getItem('lastChar'); } catch { /* ignore */ }
  if (last) {
    try { await openCharacter(last); return; } catch { /* fall through to home */ }
  }
  go('home');
}

init().catch(e => { $('#main').innerHTML = `<div class="pad"><h2>Failed to start</h2><pre>${e.stack || e}</pre></div>`; });
