// "Import from charactersheet.co.uk" dialog: paste a sheet link (or pick the site's .json download),
// review what was recognised, then save it as a new character.
import { api } from '../api.js';
import { state, openCharacter } from '../app.js';
import { isCsCharacter, guessClasses, resolveAll, buildCharacter, compareSheets, CS_SOURCE } from '../importcs.js';
import { esc, $, modal, toast } from '../ui.js';

export function openCsImport(preloaded = null) {
  return modal(`Import from ${CS_SOURCE}`, (body, close) => {
    if (preloaded) { preview(body, close, preloaded); return; }
    body.innerHTML = `
      <p>Paste the link to your character on <b>${CS_SOURCE}</b>. It’s the address in your browser while the sheet is open, like
        <code class="small">https://charactersheet.co.uk/pathfinder/#/sheet/6a60…</code></p>
      <div class="row"><input id="cs-url" class="grow" style="flex:1;min-width:260px" placeholder="Paste sheet link here" spellcheck="false">
        <button class="btn primary" id="cs-fetch">Fetch</button></div>
      <p class="muted small">No internet or link not working? On the site’s <b>Characters</b> page, click the <b>Download</b> icon next to the character, then choose that file here:</p>
      <div class="row"><label class="btn">Choose downloaded .json<input type="file" id="cs-file" accept=".json,application/json" hidden></label></div>
      <p id="cs-err" class="bad small"></p>`;
    const err = m => { $('#cs-err', body).textContent = m || ''; };
    const go = async () => {
      const v = $('#cs-url', body).value.trim();
      if (!v) return err('Paste a sheet link first.');
      err('');
      $('#cs-fetch', body).disabled = true;
      $('#cs-fetch', body).textContent = 'Fetching…';
      try { await preview(body, close, await api.csFetch(v)); }
      catch (e) { err(e.message); $('#cs-fetch', body).disabled = false; $('#cs-fetch', body).textContent = 'Fetch'; }
    };
    $('#cs-fetch', body).onclick = go;
    $('#cs-url', body).onkeydown = e => { if (e.key === 'Enter') go(); };
    $('#cs-file', body).onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!isCsCharacter(data)) throw new Error(`That file isn’t a ${CS_SOURCE} character.`);
        await preview(body, close, data);
      } catch (x) { err(x.message); }
    };
  }, { wide: true });
}

async function preview(body, close, src) {
  for (const k of ['user', 'comments']) delete src[k]; // account details from the site; never stored
  body.innerHTML = '<p class="muted">Matching feats, spells and items to the compendium…</p>';
  const resolved = await resolveAll(src);
  const classes = state.classes;
  let rows = guessClasses(src.level, classes);
  let built;
  const archetypeData = {};
  const loadArchetypes = async () => {
    for (const r of rows) if (r.archetype && !archetypeData[r.cls]) archetypeData[r.cls] = await api.archetypes(r.cls).catch(() => []);
  };
  await loadArchetypes();

  const draw = () => {
    built = buildCharacter(src, rows, resolved, state.classesByName, archetypeData);
    const cmp = compareSheets(src, built.char, state.classesByName);
    const diffs = cmp.filter(r => !r.same).length;
    const c = built.char;
    const raceLabel = c.race === 'Custom' ? `${esc(c.customRace.name)} <span class="pill warn">custom</span>` : esc(c.race);
    body.innerHTML = `
      <div class="row"><h2 class="grow" style="margin:0">${esc(c.name)}</h2><span class="muted">${raceLabel}</span></div>
      <section class="card">
        <h3>Class levels</h3>
        <p class="muted small">From the old sheet’s level text: <b>${esc(src.level || '(blank)')}</b>. Check these, because they set BAB, saves, HP, spells and class features.</p>
        <table class="tbl"><thead><tr><th>Class</th><th>Levels</th><th>Archetype</th><th></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr>
          <td><select data-row="${i}" data-f="cls">${classes.map(k => `<option ${k.name === r.cls ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></td>
          <td><input type="number" min="1" max="20" class="w3" data-row="${i}" data-f="levels" value="${r.levels}"></td>
          <td><input class="w16" data-row="${i}" data-f="archetype" value="${esc(r.archetype)}" placeholder="optional"></td>
          <td><button class="icon-btn" data-rm="${i}" title="Remove">✕</button></td></tr>`).join('')}
        </tbody></table>
        ${rows.length ? '' : '<p class="warn">No class was recognised. Add one below, or the character will import at level 0.</p>'}
        <button class="btn small" id="cs-add">＋ Add class</button>
      </section>
      <section class="card">
        <div class="row"><h3 class="grow">Numbers check</h3>
          <span class="pill ${diffs ? 'warn' : 'good'}">${diffs ? `${diffs} differ` : 'all match'}</span></div>
        <p class="muted small">This app calculates these from your levels, scores and gear. A difference means either the old sheet folded in a bonus this app doesn’t know about yet (a buff, a feat like Toughness or Iron Will, an item), so add it as a buff or misc modifier after importing, or the old total was simply out of date.</p>
        ${cmp.length ? `<table class="tbl mini"><thead><tr><th></th><th>Old sheet</th><th>This app</th></tr></thead><tbody>
          ${cmp.map(r => `<tr class="${r.same ? '' : 'warn'}"><td>${esc(r.label)}</td><td>${esc(r.theirs)}</td><td><b>${esc(r.ours)}</b>${r.same ? ' <span class="good">✓</span>' : ''}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">The old sheet had no totals filled in to compare.</p>'}
      </section>
      ${built.notes.length ? `<section class="card"><h3>Good to know</h3><ul>${built.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
      <p class="muted small">Anything that doesn’t have a place on this sheet (conditional modifiers, extra speeds, gems…) is added to the character’s Notes.</p>
      <div class="row end"><button class="btn" data-close-dlg>Cancel</button><button class="btn primary" id="cs-import">Import character</button></div>`;
    body.scrollTop = 0;
  };

  body.oninput = body.onchange = e => {
    const t = e.target;
    if (!t.dataset.row) return;
    const r = rows[+t.dataset.row];
    if (t.dataset.f === 'levels') r.levels = Math.max(1, Math.min(20, parseInt(t.value) || 1));
    else r[t.dataset.f] = t.value;
    if (e.type === 'change') loadArchetypes().then(draw);
  };
  body.onclick = async e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { rows.splice(+rm.dataset.rm, 1); draw(); return; }
    if (e.target.closest('#cs-add')) { rows.push({ cls: classes[0].name, levels: 1, archetype: '' }); draw(); return; }
    if (e.target.closest('[data-close-dlg]')) { close(); return; }
    if (e.target.closest('#cs-import')) {
      e.target.disabled = true;
      try {
        const r = await api.saveCharacter(built.char);
        close();
        toast(`Imported ${built.char.name}`);
        openCharacter(r.id);
      } catch (x) { toast('Import failed: ' + x.message, 'err'); e.target.disabled = false; }
    }
  };
  draw();
}
