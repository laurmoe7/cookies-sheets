// Small DOM helpers shared by all views.
import { api } from './api.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

export function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

/** Opens a modal. `render(body, close)` fills it. Returns a promise resolved with close(value). */
export function modal(title, render, { wide = false } = {}) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></header>
      <div class="modal-body"></div></div>`;
    document.body.appendChild(back);
    const close = v => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(undefined); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', e => { if (e.target === back) close(undefined); });
    $('[data-close]', back).onclick = () => close(undefined);
    render($('.modal-body', back), close);
    const f = $('input,select,textarea', back);
    if (f) f.focus();
  });
}

export function confirmBox(message, okLabel = 'OK') {
  return modal('Confirm', (body, close) => {
    body.innerHTML = `<p>${esc(message)}</p><div class="row end"><button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>${esc(okLabel)}</button></div>`;
    $('[data-no]', body).onclick = () => close(false);
    $('[data-yes]', body).onclick = () => close(true);
  });
}

// ---------- Reference drawer (right side) ----------
let drawerHistory = [];
export async function showEntry(idOrName, cat) {
  let entry;
  try {
    entry = typeof idOrName === 'number' ? await api.entry(idOrName) : await api.entryByName(idOrName, cat);
    if (!entry) {
      const r = await api.search(idOrName, cat || '', 1);
      if (r.length) entry = await api.entry(r[0].id);
    }
  } catch (e) { toast(e.message, 'err'); return; }
  if (!entry) { toast(`No entry found for "${idOrName}"`); return; }
  drawerHistory.push(entry.id);
  renderDrawer(entry);
}

/** Show something that isn't a compendium entry (an archetype feature, a custom trait's notes) in the drawer. */
export function showCustom({ name, cat = '', sub = '', html = '', source = '' }) {
  const entry = { id: null, name, cat, sub, html, source };
  drawerHistory.push(entry);
  renderDrawer(entry);
}

/** Plain text (with blank-line paragraphs) as HTML. */
export const textToHtml = t => String(t || '').trim().split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

function renderDrawer(entry) {
  const dr = $('#drawer');
  dr.classList.add('open');
  dr.innerHTML = `<header>
      ${drawerHistory.length > 1 ? '<button class="icon-btn" data-back title="Back">←</button>' : ''}
      <div class="grow"><div class="eyebrow">${esc(entry.cat)}${entry.sub ? ' · ' + esc(entry.sub) : ''}</div><h2>${esc(entry.name)}</h2></div>
      <button class="icon-btn" data-close title="Close">✕</button></header>
    <div class="entry-actions"></div>
    <div class="entry-body">${entryHtml(entry)}</div>`;
  $('[data-close]', dr).onclick = closeDrawer;
  const back = $('[data-back]', dr);
  if (back) back.onclick = async () => {
    drawerHistory.pop();
    const prev = drawerHistory[drawerHistory.length - 1];
    renderDrawer(typeof prev === 'object' ? prev : await api.entry(prev));
  };
  wireEntryLinks($('.entry-body', dr));
  document.dispatchEvent(new CustomEvent('entry-shown', { detail: { entry, actions: $('.entry-actions', dr) } }));
}

export function closeDrawer() {
  $('#drawer').classList.remove('open');
  drawerHistory = [];
}

export function entryHtml(entry) {
  const src = entry.source ? `<p class="source">Source: ${esc(entry.source)}</p>` : '';
  return (entry.html || '') + src;
}

/** Make links inside OGL text open the referenced entry instead of navigating away. */
export function wireEntryLinks(root) {
  root.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const text = a.textContent.trim();
    if (text) showEntry(text);
  });
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Generic searchable picker for compendium entries. Resolves with the chosen entry summary. */
export function pickEntry(title, cat, { extraFilter, renderRow } = {}) {
  return modal(title, (body, close) => {
    body.innerHTML = `<input class="search" placeholder="Search ${esc(cat || 'compendium')}…">
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select an entry to preview it.</p></div></div>`;
    const input = $('input', body), list = $('.picker-list', body), prev = $('.picker-preview', body);
    let rows = [], seq = 0;
    const run = debounce(async () => {
      const my = ++seq;
      let res = await api.search(input.value, cat, 150);
      if (my !== seq) return; // a newer search is in flight
      rows = extraFilter ? res.filter(extraFilter) : res;
      list.innerHTML = rows.map((r, i) => `<div class="pick-row" data-i="${i}">
          <div><b>${esc(r.name)}</b> <span class="muted small">${esc(r.sub || '')}</span></div>
          <div class="muted small">${esc(renderRow ? renderRow(r) : r.summary || r.source)}</div>
          <button class="btn small primary" data-pick="${i}">Add</button></div>`).join('') || '<p class="muted pad">No matches.</p>';
    }, 150);
    input.addEventListener('input', run);
    list.addEventListener('click', async e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { close(rows[+pick.dataset.pick]); return; }
      const row = e.target.closest('.pick-row');
      if (!row) return;
      $$('.pick-row.sel', list).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      const en = await api.entry(rows[+row.dataset.i].id);
      prev.innerHTML = `<h3>${esc(en.name)}</h3>` + entryHtml(en);
    });
    run();
  }, { wide: true });
}

// ---------- Read-first text fields ----------
// Text shows as plain, readable text. Click a "readable" field to open its full text in the drawer;
// double-click to edit (Enter saves, Escape cancels; Ctrl+Enter saves multi-line text).

/**
 * @param path   data path inside the character (e.g. "feats.2.notes")
 * @param value  current text
 * @param opts   multiline: textarea editing and 2-line preview; read: {title, cat} opens the full text on click;
 *               placeholder: shown when empty
 */
export function textField(path, value, { multiline = false, read = null, placeholder = 'Double-click to add', cls = '' } = {}) {
  const v = String(value ?? '');
  const tip = v ? (v.length > 400 ? v.slice(0, 400) + '…' : v) + '\n\n' : '';
  return `<span class="tf ${multiline ? 'ml' : ''} ${v ? '' : 'empty'} ${read ? 'readable' : ''} ${cls}" data-tf="${esc(path)}"${multiline ? ' data-ml' : ''}
    ${read ? `data-read-title="${esc(read.title || '')}" data-read-cat="${esc(read.cat || '')}" data-read-path="${esc(read.path || path)}"
      ${read.titlePath ? `data-read-title-path="${esc(read.titlePath)}"` : ''}` : ''}
    tabindex="0" title="${esc(tip)}${read ? 'Click to read · ' : ''}Double-click to edit">${v ? esc(v) : esc(placeholder)}</span>`;
}

/** Wire text fields once for the whole app. get(path) reads, set(path, value) saves. */
export function initTextFields({ get, set }) {
  let clickTimer = null;
  // A click anywhere in a table cell that holds a single text field counts as a click on that field.
  const fieldAt = target => {
    const tf = target.closest('.tf');
    if (tf) return tf;
    const cell = target.closest('td');
    const inner = cell && cell.querySelectorAll('.tf');
    return inner && inner.length === 1 && !target.closest('a,button,input,select,textarea') ? inner[0] : null;
  };
  document.addEventListener('click', e => {
    const el = fieldAt(e.target);
    if (!el || !el.classList.contains('readable') || el.querySelector('input,textarea')) return;
    const text = get(el.dataset.readPath) || '';
    if (!text) return; // nothing to read yet; double-click to write it
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      const title = (el.dataset.readTitlePath && get(el.dataset.readTitlePath)) || el.dataset.readTitle || 'Notes';
      showCustom({ name: title, cat: el.dataset.readCat || '',
        html: textToHtml(text) + '<p class="muted small">Double-click the text on the sheet to edit it.</p>' });
    }, 260);
  });
  document.addEventListener('dblclick', e => {
    const el = fieldAt(e.target);
    if (!el || el.querySelector('input,textarea')) return;
    clearTimeout(clickTimer);
    e.preventDefault();
    startEdit(el);
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest?.('.tf');
    if (el && e.key === 'Enter' && !el.querySelector('input,textarea')) { e.preventDefault(); startEdit(el); }
  });

  function startEdit(el) {
    const path = el.dataset.tf;
    const ml = 'ml' in el.dataset;
    const old = String(get(path) ?? '');
    const box = document.createElement(ml ? 'textarea' : 'input');
    box.className = 'tf-edit';
    box.value = old;
    if (ml) box.rows = Math.min(14, Math.max(3, old.split('\n').length + 1));
    const display = el.innerHTML;
    el.innerHTML = '';
    el.appendChild(box);
    el.classList.add('editing');
    box.focus();
    box.select();
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      const v = box.value;
      el.classList.remove('editing');
      if (save && v !== old) {
        set(path, v);
        el.innerHTML = v ? esc(v) : esc('Double-click to add');
        el.classList.toggle('empty', !v);
        el.title = (v ? v.slice(0, 400) + '\n\n' : '') + (el.classList.contains('readable') ? 'Click to read · ' : '') + 'Double-click to edit';
      } else el.innerHTML = display;
    };
    box.addEventListener('blur', () => finish(true));
    box.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && (!ml || e.ctrlKey)) { e.preventDefault(); finish(true); }
    });
    box.addEventListener('click', e => e.stopPropagation());
    box.addEventListener('dblclick', e => e.stopPropagation());
  }
}

/** Let the user choose an image file; resolves with a downscaled JPEG/PNG data URL (null if cancelled). */
export function pickImage(maxSize = 800, { square = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
        const k = Math.min(1, maxSize / Math.max(sw, sh));
        const cv = document.createElement('canvas');
        cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        const g = cv.getContext('2d');
        g.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image', 'err'); resolve(null); };
      img.src = url;
    };
    input.click();
  });
}
