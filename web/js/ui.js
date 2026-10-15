// Small DOM helpers shared by all views.
import { api } from './api.js';
import { spellStatHtml } from './spellstat.js';
import { lookup as petLookup } from './pet/pet.js';

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
/** `top` pins the window's top edge near the top of the screen instead of centring it, so it does not jump when its content grows or shrinks (Options). */
export function modal(title, render, { wide = false, top = false } = {}) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back' + (top ? ' top' : '');
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

/** A warning window listing things left undone. Resolves true to carry on, false to go back and fix them. */
export function warnBox(title, items, { okLabel = 'Continue anyway', backLabel = 'Go back' } = {}) {
  return modal(title, (body, close) => {
    body.innerHTML = `<ul class="warn-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="row end"><button class="btn primary" data-no>${esc(backLabel)}</button><button class="btn" data-yes>${esc(okLabel)}</button></div>`;
    $('[data-no]', body).onclick = () => close(false);
    $('[data-yes]', body).onclick = () => close(true);
  });
}

// ---------- Reference drawer (right side) ----------
let drawerHistory = [];
let openedByClick = false; // the drawer was opened by a click that may turn out to be half of a double-click
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
  petLookup(entry.name, entry.cat);
}

/** Show something that isn't a compendium entry (an archetype feature, a custom trait's notes) in the drawer. */
/** Open an entry because of a click on a name that can also be double-clicked to edit: the double-click closes it again. */
export function showEntryFromClick(idOrName, cat) {
  showEntry(idOrName, cat);
  openedByClick = true;
}

export function showCustom({ name, cat = '', sub = '', html = '', source = '' }) {
  const entry = { id: null, name, cat, sub, html, source };
  drawerHistory.push(entry);
  renderDrawer(entry);
}

/** Plain text (with blank-line paragraphs) as HTML. */
export const textToHtml = t => String(t || '').trim().split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

let drawerShownAt = 0; // when the side panel last showed (or changed) an entry
function renderDrawer(entry, goingBack = false) {
  const dr = $('#drawer');
  drawerShownAt = Date.now();
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
    renderDrawer(typeof prev === 'object' ? prev : await api.entry(prev), true);
  };
  wireEntryLinks($('.entry-body', dr));
  document.dispatchEvent(new CustomEvent('entry-shown', { detail: { entry, actions: $('.entry-actions', dr), back: goingBack } }));
}

/**
 * Clicking outside the side panel closes it, unless the click was on something you use (a button, field, link, label...) or inside a window.
 * The check waits a moment, so a click that opens or changes the panel (a rule link, a read-more text) does not close it again.
 */
export function initDrawerDismiss() {
  document.addEventListener('click', e => {
    const dr = $('#drawer');
    if (!dr?.classList.contains('open') || dr.contains(e.target)) return;
    if (e.target.closest?.('button, input, select, textarea, a, label, summary, [contenteditable], [data-entry], .tf, .modal-back, #tooltip, #toasts')) return;
    const at = Date.now();
    setTimeout(() => { if (drawerShownAt < at && dr.classList.contains('open') && !$('.modal-back')) closeDrawer(); }, 150);
  });
}

export function closeDrawer() {
  $('#drawer').classList.remove('open');
  document.dispatchEvent(new Event('drawer-closed'));
  drawerHistory = [];
}

export function entryHtml(entry) {
  const src = entry.source ? `<p class="source">Source: ${esc(entry.source)}</p>` : '';
  return (entry.cat === 'Spell' ? spellStatHtml(entry.html || '') : entry.html || '') + src;
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
export function pickEntry(title, cat, { extraFilter, renderRow, search, subs = null, subLabel = 'Any type' } = {}) {
  return modal(title, (body, close) => {
    body.innerHTML = `<div class="row"><input class="search grow" placeholder="Search ${esc(cat || 'compendium')}…">${subs ? `<select data-f="sub"><option value="">${esc(subLabel)}</option>${subs.map(([label, v]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('')}</select>` : ''}</div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select an entry to preview it.</p></div></div>`;
    const input = $('input', body), subSel = $('[data-f=sub]', body), list = $('.picker-list', body), prev = $('.picker-preview', body);
    let rows = [], seq = 0;
    const run = debounce(async () => {
      const my = ++seq;
      const sub = subSel ? subSel.value : '';
      let res = await (search ? search(input.value, sub) : api.search(input.value, cat, 150, 0, sub));
      if (my !== seq) return; // a newer search is in flight
      rows = extraFilter ? res.filter(extraFilter) : res;
      list.innerHTML = rows.map((r, i) => `<div class="pick-row" data-i="${i}">
          <div><b>${esc(r.name)}</b> <span class="muted small">${esc(r.sub || '')}</span></div>
          <div class="muted small">${esc(renderRow ? renderRow(r) : r.summary || r.source)}</div>
          <button class="btn small primary" data-pick="${i}">Add</button></div>`).join('') || '<p class="muted pad">No matches.</p>';
    }, 150);
    input.addEventListener('input', run);
    subSel?.addEventListener('input', run);
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
    // Open straight away; waiting to tell a double-click apart made the panel feel laggy.
    const title = (el.dataset.readTitlePath && get(el.dataset.readTitlePath)) || el.dataset.readTitle || 'Notes';
    showCustom({ name: title, cat: el.dataset.readCat || '',
      html: textToHtml(text) + '<p class="muted small">Double-click the text on the sheet to edit it.</p>' });
    openedByClick = true;
  });
  document.addEventListener('dblclick', e => {
    const el = fieldAt(e.target);
    if (!el || el.querySelector('input,textarea')) return;
    e.preventDefault();
    if (openedByClick) { closeDrawer(); openedByClick = false; } // the first click of the double-click opened it
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

/** Styled tooltips: any element with a title (or data-tip) gets a tooltip in the app's look instead of the browser's. */
export function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let timer = null, cur = null;
  const hide = () => { clearTimeout(timer); tip.classList.remove('show'); cur = null; };
  const show = (el, text) => {
    tip.textContent = text;
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    let y = r.bottom + 8;
    if (y + t.height > window.innerHeight - 8) y = Math.max(8, r.top - t.height - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest?.('[title],[data-tip]');
    if (!el || el === cur) return;
    hide();
    if (el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
    const text = (el.dataset.tip || '').trim();
    if (!text) return;
    cur = el;
    if (document.documentElement.dataset.tips === 'off') return;
    timer = setTimeout(() => show(el, text), 350);
  });
  document.addEventListener('mouseout', e => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
  for (const ev of ['mousedown', 'keydown', 'wheel', 'scroll']) document.addEventListener(ev, hide, true);
}
