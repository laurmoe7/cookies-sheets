import { api } from '../api.js';
import { state, openCharacter, createCharacter, flushSave, go } from '../app.js';
import { esc, $, confirmBox, toast, modal } from '../ui.js';
import { isCsCharacter } from '../importcs.js';
import { openCsImport, openGsImport } from './csimport.js';

/** Shows where characters are saved, and lets the player pick another folder (a native folder chooser in the desktop window). */
async function wireSaveFolder(main) {
  const show = $('#save-path', main), change = $('#change-folder', main), reset = $('#reset-folder', main);
  let info;
  try { info = await api.storage(); } catch { show.textContent = 'Documents\\Pathfinder Characters'; return; }
  show.textContent = info.path;
  reset.hidden = !info.custom || info.locked;
  change.hidden = info.locked; // fixed for this run (PF_CHAR_DIR)
  if (info.missing) toast(`The folder you chose (${info.missing}) cannot be reached, so characters are in the default folder for now.`, 'err');
  const use = async (path, message) => {
    if (!await confirmBox(message, 'Yes, use it')) return;
    try {
      const r = await api.setStorage(path, true);
      toast(`Characters are saved in ${r.path} now${r.copied ? `. ${r.copied} copied over` : ''}.`, 'good');
      renderHome(main);
    } catch (e) { toast(e.message, 'err'); }
  };
  change.onclick = async () => {
    const native = window.pywebview?.api?.pick_folder;
    const picked = native ? await window.pywebview.api.pick_folder(info.path) : (window.prompt('Folder to save characters in:', info.path) || '');
    if (picked && picked !== info.path) await use(picked, `Save your characters in ${picked} from now on? The ones you have now are copied there, and the old folder is left as it is.`);
  };
  reset.onclick = () => use('', `Go back to saving characters in ${info.default}? They are copied there, and the other folder is left as it is.`);
}

export async function renderHome(main) {
  main.innerHTML = `<div class="page narrow">
    <div class="hero">
      <h1>Characters</h1>
      <p class="muted">Characters save automatically to <code id="save-path">…</code>
        <button class="btn small" id="change-folder" title="Choose another folder to save your characters in">Change folder…</button>
        <button class="btn small ghost" id="reset-folder" hidden title="Go back to Documents\\Pathfinder Characters">Use the default</button></p>
      <div class="row">
        <button class="btn primary" id="new-char">＋ New character</button>
        <button class="btn" id="open-folder">Open save folder</button>
        <span class="btn-group"><span class="lbl">Import from</span>
          <button class="btn" id="cs-import-btn" title="Bring a character over from charactersheet.co.uk">charactersheet.co.uk</button>
          <button class="btn" id="gs-import-btn" title="Bring a character over from a Google Sheets character sheet">Google Sheet</button>
          <label class="btn" title="A character file saved by Cookie’s Sheets (Export)">.json file<input type="file" id="import" accept=".json" hidden></label></span>
      </div>
    </div>
    <div id="char-list" class="char-list"><p class="muted">Loading…</p></div>
    <div id="char-graveyard"></div>
    <div id="char-bin"></div>
    <div id="char-history"></div>
  </div>`;
  $('#new-char').onclick = createCharacter;
  wireSaveFolder(main);
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
  const [all, gone, older] = await Promise.all([api.characters(), api.deleted().catch(() => []), api.history().catch(() => [])]);
  const list = all.filter(c => !c.retired);
  renderGraveyard($('#char-graveyard'), all.filter(c => c.retired));
  renderBin($('#char-bin'), gone);
  renderHistory($('#char-history'), older);
  const el = $('#char-list');
  if (!list.length) {
    el.innerHTML = all.length ? `<div class="empty"><p>No one is adventuring right now.</p><p class="muted">Click <b>New character</b> to roll one up, or bring someone back from the graveyard below.</p></div>`
      : `<div class="empty"><p>No characters yet.</p><p class="muted">Click <b>New character</b> to roll one up. The level-up wizard walks you through 1st level.</p></div>`;
    return;
  }
  el.innerHTML = list.map(c => `<div class="char-card ${state.char?.id === c.id ? 'current' : ''}" data-id="${esc(c.id)}">
      <div class="grow"><h3>${esc(c.name)}</h3>
      <div class="muted">${classLine(c)}</div>
      <div class="muted small">Last edited ${new Date(c.updated * 1000).toLocaleString()}</div></div>
      <button class="btn small" data-export="${esc(c.id)}">Export</button>
      <button class="btn small" data-retire="${esc(c.id)}" title="Move to the graveyard: for a character who died or retired">🪦 Lay to rest</button>
      <button class="btn small danger" data-del="${esc(c.id)}">Delete</button></div>`).join('');
  el.onclick = async e => {
    const del = e.target.closest('[data-del]');
    const exp = e.target.closest('[data-export]');
    const ret = e.target.closest('[data-retire]');
    if (ret) {
      e.stopPropagation();
      const who = list.find(c => c.id === ret.dataset.retire);
      const r = await askRetire(who?.name || 'this character');
      if (r) {
        try {
          await setRetired(ret.dataset.retire, r);
          toast(`${who?.name || 'The character'} ${r.status === 'dead' ? 'was laid to rest' : 'retired'}.`);
          renderHome(main);
        } catch (err) { toast(err.message, 'err'); }
      }
      return;
    }
    if (del) {
      e.stopPropagation();
      if (await confirmBox('Delete this character? (It is moved to a .deleted folder inside the save folder, so you can recover it.)', 'Delete')) {
        await flushSave();
        await api.deleteCharacter(del.dataset.del);
        if (state.char?.id === del.dataset.del) state.char = null;
        go('home');
      }
      return;
    }
    if (exp) {
      e.stopPropagation();
      await flushSave(); // export what is on screen, not the save from half a second ago
      const c = await api.character(exp.dataset.export);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' }));
      a.download = (c.name || 'character').replace(/[^\w -]/g, '') + '.json';
      a.click();
      return;
    }
    const card = e.target.closest('.char-card');
    if (card) openCharacter(card.dataset.id).catch(err => toast(`Could not open this character: ${err.message}`, 'err'));
  };
}

/** Marks a saved character as dead or retired (value = {status, date, note}) or brings them back (null). The open character is changed in place so a pending save cannot undo it. */
async function setRetired(id, value) {
  await flushSave();
  if (state.char?.id === id) {
    state.char.retired = value;
    state.dirty = true;
    await flushSave();
    return;
  }
  const c = await api.character(id);
  c.retired = value;
  await api.saveCharacter(c);
}

const RIP_TEXT = {
  dead: ['Cause of death or epitaph', 'e.g. Failed a Reflex save against a red dragon. Brave to the last.'],
  retired: ['Why they hung up their sword', 'e.g. Opened a tavern in Sandpoint with the treasure.'],
};

/** The "move to the graveyard" window: died or retired, when, and a line for the headstone. Resolves {status, date, note}, or undefined if cancelled. */
function askRetire(name) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return modal(`To the graveyard: ${name}`, (body, close) => {
    let status = 'dead';
    body.innerHTML = `<p class="muted">The character leaves the list of active characters. You can still open them, and bring them back at any time.</p>
      <div class="seg"><button class="seg-btn on" data-st="dead">† Died</button><button class="seg-btn" data-st="retired">Retired</button></div>
      <div class="form">
        <label>Date <input type="date" id="rip-date" value="${today}"></label>
        <label><span id="rip-note-label">${RIP_TEXT.dead[0]}</span> <textarea id="rip-note" class="full" rows="3" placeholder="${esc(RIP_TEXT.dead[1])}"></textarea></label>
      </div>
      <div class="row end"><button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Move to the graveyard</button></div>`;
    body.querySelectorAll('[data-st]').forEach(b => (b.onclick = () => {
      status = b.dataset.st;
      body.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b));
      $('#rip-note-label', body).textContent = RIP_TEXT[status][0];
      $('#rip-note', body).placeholder = RIP_TEXT[status][1];
    }));
    $('[data-no]', body).onclick = () => close(undefined);
    $('[data-yes]', body).onclick = () => close({ status, date: $('#rip-date', body).value || today, note: $('#rip-note', body).value.trim() });
  });
}

let graveOpen = true; // the graveyard is unfolded until the player folds it, kept across re-draws of the page

/** "Human · Arcanist (White Mage) 8": a level number never wraps onto a line of its own, away from its class. */
const classLine = c => `${esc(c.race)} · ${esc(c.summary || '').replace(/ (\d+)(?= \/|$)/g, '&nbsp;$1')}`;

/** Characters who died or retired: still openable, with a headstone line, and a way back to the active list. */
function renderGraveyard(box, fallen) {
  if (!fallen.length) { box.innerHTML = ''; return; }
  const when = r => {
    const d = new Date(r.date + 'T12:00:00');
    return isNaN(d) ? r.date : d.toLocaleDateString();
  };
  box.innerHTML = `<details class="bin graveyard" ${graveOpen ? 'open' : ''}><summary class="muted">🪦 Graveyard (${fallen.length})</summary>
    <div class="muted small">Characters who died or retired. Click one to read their sheet.</div>
    <div class="graves">${fallen.map(c => `<div class="char-card grave ${c.retired.status}" data-id="${esc(c.id)}">
      <div class="rip">${c.retired.status === 'dead' ? '† Here lies' : 'Retired'}</div>
      <h3>${esc(c.name)}</h3>
      <div class="muted">${classLine(c)}</div>
      ${c.retired.note ? `<div class="epitaph">“${esc(c.retired.note)}”</div>` : ''}
      <div class="muted small">${c.retired.status === 'dead' ? 'Fell' : 'Retired'}${c.retired.date ? ' ' + esc(when(c.retired)) : ''}</div>
      <div><button class="btn small" data-revive="${esc(c.id)}" title="Back to the active characters">${c.retired.status === 'dead' ? 'Raise dead' : 'Bring back'}</button></div></div>`).join('')}</div>
  </details>`;
  $('details', box).ontoggle = e => { graveOpen = e.target.open; };
  box.onclick = async e => {
    const revive = e.target.closest('[data-revive]');
    if (revive) {
      e.stopPropagation();
      try { await setRetired(revive.dataset.revive, null); toast('Back among the living.', 'good'); go('home'); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    const card = e.target.closest('.char-card');
    if (card) openCharacter(card.dataset.id).catch(err => toast(`Could not open this character: ${err.message}`, 'err'));
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
      <div class="muted">${classLine(c)}</div>
      <div class="muted small">Saved ${new Date(c.saved * 1000).toLocaleString()}</div></div>
      <button class="btn small" data-revert="${esc(c.file)}">Go back to this</button></div>`).join('')}
  </details>`;
  $('details', box).ontoggle = e => { historyOpen = e.target.open; };
  box.onclick = async e => {
    const b = e.target.closest('[data-revert]');
    if (!b || !await confirmBox('Go back to this earlier save? The current one is kept in the list, so you can undo this.', 'Go back')) return;
    try {
      await flushSave(); // or a pending save would land on top of the earlier one
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
      <div class="muted">${classLine(c)}</div>
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
