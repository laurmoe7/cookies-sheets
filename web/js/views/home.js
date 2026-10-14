import { api } from '../api.js';
import { state, openCharacter, createCharacter, go } from '../app.js';
import { esc, $, confirmBox, toast } from '../ui.js';
import { isCsCharacter } from '../importcs.js';
import { openCsImport, openGsImport } from './csimport.js';

export async function renderHome(main) {
  main.innerHTML = `<div class="page narrow">
    <div class="hero">
      <h1>Characters</h1>
      <p class="muted">Characters save automatically to <code>Documents\\Pathfinder Characters</code>.</p>
      <div class="row">
        <button class="btn primary" id="new-char">＋ New character</button>
        <button class="btn" id="open-folder">Open save folder</button>
        <button class="btn" id="cs-import-btn" title="Bring a character over from charactersheet.co.uk">Import from charactersheet.co.uk</button>
        <button class="btn" id="gs-import-btn" title="Bring a character over from a Google Sheets character sheet">Import from Google Sheet</button>
        <label class="btn">Import .json<input type="file" id="import" accept=".json" hidden></label>
      </div>
    </div>
    <div id="char-list" class="char-list"><p class="muted">Loading…</p></div>
    <div id="char-bin"></div>
    <div id="char-history"></div>
  </div>`;
  $('#new-char').onclick = createCharacter;
  $('#open-folder').onclick = () => api.openFolder();
  $('#cs-import-btn').onclick = () => openCsImport();
  $('#gs-import-btn').onclick = () => openGsImport();
  $('#import').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const c = JSON.parse(await f.text());
      e.target.value = '';
      if (isCsCharacter(c)) { openCsImport(c); return; }
      c.id = null;
      const r = await api.saveCharacter(c);
      toast('Imported ' + (c.name || 'character'));
      openCharacter(r.id);
    } catch (err) { toast('Import failed: ' + err.message, 'err'); }
  };
  const [list, gone, older] = await Promise.all([api.characters(), api.deleted().catch(() => []), api.history().catch(() => [])]);
  renderBin($('#char-bin'), gone);
  renderHistory($('#char-history'), older);
  const el = $('#char-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty"><p>No characters yet.</p><p class="muted">Click <b>New character</b> to roll one up. The level-up wizard walks you through 1st level.</p></div>`;
    return;
  }
  el.innerHTML = list.map(c => `<div class="char-card ${state.char?.id === c.id ? 'current' : ''}" data-id="${esc(c.id)}">
      <div class="grow"><h3>${esc(c.name)}</h3>
      <div class="muted">${esc(c.race)} · ${esc(c.summary)}</div>
      <div class="muted small">Last edited ${new Date(c.updated * 1000).toLocaleString()}</div></div>
      <button class="btn small" data-export="${esc(c.id)}">Export</button>
      <button class="btn small danger" data-del="${esc(c.id)}">Delete</button></div>`).join('');
  el.onclick = async e => {
    const del = e.target.closest('[data-del]');
    const exp = e.target.closest('[data-export]');
    if (del) {
      e.stopPropagation();
      if (await confirmBox('Delete this character? (It is moved to a .deleted folder inside the save folder, so you can recover it.)', 'Delete')) {
        await api.deleteCharacter(del.dataset.del);
        if (state.char?.id === del.dataset.del) state.char = null;
        go('home');
      }
      return;
    }
    if (exp) {
      e.stopPropagation();
      const c = await api.character(exp.dataset.export);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' }));
      a.download = (c.name || 'character').replace(/[^\w -]/g, '') + '.json';
      a.click();
      return;
    }
    const card = e.target.closest('.char-card');
    if (card) openCharacter(card.dataset.id);
  };
}

let historyOpen = false; // same, for the earlier-saves list

/** Earlier saves of each character (the .history folder): going back replaces the current save, which is itself kept. */
function renderHistory(box, older) {
  if (!box) return;
  if (!older.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<details class="bin" ${historyOpen ? 'open' : ''}><summary class="muted">Earlier saves (${older.length})</summary>
    <div class="muted small">Copies made automatically as you edit, in case a change went wrong. Going back keeps the save it replaces.</div>
    ${older.map(c => `<div class="char-card gone">
      <div class="grow"><h3>${esc(c.name)}</h3>
      <div class="muted">${esc(c.race)} · ${esc(c.summary)}</div>
      <div class="muted small">Saved ${new Date(c.saved * 1000).toLocaleString()}</div></div>
      <button class="btn small" data-revert="${esc(c.file)}">Go back to this</button></div>`).join('')}
  </details>`;
  $('details', box).ontoggle = e => { historyOpen = e.target.open; };
  box.onclick = async e => {
    const b = e.target.closest('[data-revert]');
    if (!b || !await confirmBox('Go back to this earlier save? The current one is kept in the list, so you can undo this.', 'Go back')) return;
    try {
      const r = await api.revertCharacter(b.dataset.revert);
      if (state.char?.id === r.id) state.char = null;
      toast('Went back', 'good');
      openCharacter(r.id);
    } catch (err) { toast(err.message, 'err'); }
  };
}

let binOpen = false; // whether the deleted list is unfolded, kept across re-draws of the page

/** Deleted characters (the .deleted folder): each can be brought back or removed for good. */
function renderBin(bin, gone) {
  if (!gone.length) { bin.innerHTML = ''; return; }
  bin.innerHTML = `<details class="bin" ${binOpen ? 'open' : ''}><summary class="muted">Deleted characters (${gone.length})</summary>
    ${gone.map(c => `<div class="char-card gone">
      <div class="grow"><h3>${esc(c.name)}</h3>
      <div class="muted">${esc(c.race)} · ${esc(c.summary)}</div>
      <div class="muted small">Deleted ${new Date(c.deleted * 1000).toLocaleString()}</div></div>
      <button class="btn small" data-restore="${esc(c.file)}">Restore</button>
      <button class="btn small danger" data-purge="${esc(c.file)}" title="Remove the file for good">Delete for good</button></div>`).join('')}
  </details>`;
  $('details', bin).ontoggle = e => { binOpen = e.target.open; };
  bin.onclick = async e => {
    const restore = e.target.closest('[data-restore]'), purge = e.target.closest('[data-purge]');
    try {
      if (restore) {
        const r = await api.restoreCharacter(restore.dataset.restore);
        toast('Restored', 'good');
        openCharacter(r.id);
      } else if (purge && await confirmBox('Delete this character for good? There is no way back after this.', 'Delete for good')) {
        await api.purgeCharacter(purge.dataset.purge);
        go('home');
      }
    } catch (err) { toast(err.message, 'err'); }
  };
}
