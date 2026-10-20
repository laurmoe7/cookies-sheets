import { api } from './api.js';
import { checkItemBoxes } from './views/itemboxes.js';
import { compute, sign } from './calc.js';
import { newCharacter, migrate } from './model.js';
import { classLine } from './features.js';
import { moveRacialTraits } from './racialtraits.js';
import { esc, $, $$, getPath, setPath, toast, showEntry, closeDrawer, initDrawerDismiss, modal, initTextFields, initTooltips } from './ui.js';
import { initSheetSearch } from './sheetsearch.js';
import { initOptions, showOptions, showChangelog } from './options.js';
import { choosePicture, repositionPicture } from './cropper.js';
import { initUpdateCheck } from './update.js';
import { initSummons } from './views/summons.js';
import { initRoller } from './roller.js';
import { mountPet, observe as petObserve, opened as petOpened, view as petView } from './pet/pet.js';
import { renderHome } from './views/home.js';
import { renderSheet } from './views/sheet.js';
import { renderLevelUp } from './views/levelup.js';
import { renderCompendium } from './views/compendium.js';
import { renderMonsters } from './views/monsters.js';
import { renderRules } from './views/rules.js';

export const state = {
  char: null, classes: [], classesByName: {}, derived: null,
  view: 'home', sheetTab: 'overview', dirty: false,
};

const VIEWS = { home: renderHome, sheet: renderSheet, levelup: renderLevelUp, compendium: renderCompendium, monsters: renderMonsters, rules: renderRules };

export function go(view, opts = {}) {
  petView('view-' + view);
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
  if (!(state.view === 'sheet' && state.char && main.dataset.view === 'sheet')) main.innerHTML = ''; // the sheet keeps its tab bar
  main.scrollTop = 0;
  if (state.char) recalc();
  VIEWS[state.view](main);
  main.dataset.view = state.view;
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
  $('#char-icon').hidden = !c;
  $('#char-icon').classList.toggle('has', !!(c && c.avatar));
  av.hidden = !(c && c.avatar);
  if (c && c.avatar && av.getAttribute('src') !== c.avatar) av.src = c.avatar;
  $('#char-title').textContent = c ? c.name || 'Unnamed' : 'No character loaded';
  const d = state.derived;
  $('#char-sub').textContent = c && d
    ? `${d.race.name} · ${classLine(c, d.classLevels) || 'Level 0'}`
    : 'Create or open a character to begin';
  $('#save-state').textContent = !c ? '' : state.dirty ? 'Saving…' : 'Saved';
  const ready = c && d && d.xp.levelByXp > d.level && d.level > 0;
  $('#nav [data-view=levelup]').classList.toggle('pulse', !!ready);
}

// Edits are saved half a second after they stop. Saves run one at a time: two at once could each give a new character its own
// file, and an answer arriving late must set the id of the character that was sent, not of whichever one is open by then.
let saveTimer = 0, saving = null;
function saveNow() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 500); }

// Closing the tab or window within half a second of an edit: send it anyway. A keepalive request outlives the page but is limited
// to 64 KB, so a character with a large picture may not make it; the earlier saves still stand.
addEventListener('pagehide', () => {
  if (!state.char || !state.dirty || (saving && !state.char.id)) return; // a new character's first save is still out: no second file
  try {
    fetch('/api/character', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.char) }).catch(() => {});
  } catch { /* too big for keepalive */ }
});

/** Saves the open character now if it has unsaved edits. Await it before opening another character, or before anything that
 *  reads or replaces the file on disk (delete, export, going back to an earlier save), so a pending save cannot land after it. */
export async function flushSave() {
  clearTimeout(saveTimer);
  while (saving) await saving;
  const c = state.char;
  if (!c || !state.dirty) return;
  state.dirty = false; // an edit made while this save is on its way sets it again and saves again
  saving = (async () => {
    try {
      const r = await api.saveCharacter(c);
      c.id = r.id;
      if (state.char === c) try { localStorage.setItem('lastChar', r.id); } catch { /* storage may be unavailable */ }
    } catch (e) {
      if (state.char === c) state.dirty = true;
      toast('Save failed: ' + e.message, 'err');
    } finally {
      saving = null;
      updateHeader();
    }
  })();
  await saving;
}

export function changed({ rerender = false } = {}) {
  state.dirty = true;
  if (rerender) render({ keepScroll: true }); else { recalc(); refreshCalc(); updateHeader(); }
  saveNow();
  petObserve(state.char, state.derived);
}

export async function openCharacter(id) {
  await flushSave();
  state.char = migrate(await api.character(id));
  state.dirty = false;
  try { if (await moveRacialTraits(state.char, api.resolve)) { state.dirty = true; saveNow(); } } catch { /* the compendium is unavailable; try again next time */ }
  try { localStorage.setItem('lastChar', id); } catch { /* storage may be unavailable */ }
  go('sheet', { sheetTab: 'overview' });
  petOpened(state.char, state.derived);
  checkItemBoxes(); // a worn item's bonus also typed in a box (an imported sheet): offer to count it once
}

export async function createCharacter() {
  await flushSave();
  state.char = newCharacter();
  state.dirty = true;
  saveNow();
  go('levelup');
  petOpened(state.char, state.derived, true);
}

/** The picture beside the character name: click it to add, change, recenter or remove. */
function editIcon() {
  const c = state.char;
  if (!c) return;
  const opts = { w: 1, h: 1, out: 256 };
  const choose = async () => { const r = await choosePicture(opts); if (r) { c.avatar = r.image; c.avatarSrc = r.src; changed({ rerender: true }); } };
  if (!c.avatar) return choose();
  modal('Character icon', (body, close) => {
    body.innerHTML = `<div class="row" style="gap:16px;align-items:center"><img class="avatar-lg" src="${esc(c.avatar)}" alt="" style="width:96px;height:96px">
      <div class="icon-actions"><button class="btn" data-a="change">Choose another picture</button><button class="btn" data-a="edit">Recenter or resize</button><button class="btn danger" data-a="clear">Remove</button></div></div>`;
    body.onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      close();
      if (a === 'change') await choose();
      else if (a === 'edit') { const r = await repositionPicture(c.avatarSrc || c.avatar, opts); if (r) { c.avatar = r.image; changed({ rerender: true }); } }
      else { c.avatar = ''; c.avatarSrc = ''; changed({ rerender: true }); }
    };
  });
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

/**
 * Numbers the cards of the page in order (data-paper). The Dusty tome theme puts a different sheet of paper under each number (12 of them),
 * so a tab never shows the same page twice, wherever the cards sit in the layout. Cards inside cards are left alone.
 */
function initPapers() {
  const main = $('#main');
  const run = () => {
    let i = 0;
    for (const c of main.querySelectorAll('.card')) {
      if (c.parentElement.closest('.card, .pt-clone')) { c.removeAttribute('data-paper'); continue; }
      const v = String(i++ % 12);
      if (c.dataset.paper !== v) c.dataset.paper = v;
    }
  };
  new MutationObserver(run).observe(main, { childList: true, subtree: true }); // setting an attribute is not a child change, so this does not loop
  run();
}

/** Tells the app this page is open, so the web-browser version can close itself when the last page goes. Harmless in the window. */
function heartbeat() {
  const id = Math.random().toString(36).slice(2);
  const ping = () => api.ping(id).catch(() => {});
  ping();
  setInterval(ping, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/bye', new Blob([JSON.stringify({ id })], { type: 'application/json' })); } catch { /* the app notices the pings stopped */ } });
}

async function init() {
  heartbeat();
  initOptions();
  initPapers();
  mountPet($('#cookie-slot'));
  document.addEventListener('input', onInput);
  initTooltips();
  initDrawerDismiss();
  initSheetSearch();
  initSummons();
  initUpdateCheck();
  initRoller();
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
  $('#options-btn').onclick = () => showOptions();
  $('#changelog-btn').onclick = () => showChangelog();
  $('#char-icon').onclick = () => editIcon();
  $('#char-sub').onclick = () => { if (state.char) go('sheet', { sheetTab: 'feats' }); }; // the archetype lives there

  state.classes = await api.classes();
  state.classesByName = Object.fromEntries(state.classes.map(c => [c.name, c]));
  let last = null;
  try { last = localStorage.getItem('lastChar'); } catch { /* ignore */ }
  if (last) {
    try { await openCharacter(last); return; } catch { /* fall through to home */ }
  }
  go('home');
}

init().catch(e => { $('#main').innerHTML = `<div class="pad"><h2>Failed to start</h2><pre>${esc(e.stack || e)}</pre></div>`; });
