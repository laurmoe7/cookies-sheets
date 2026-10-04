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
  if (back) back.onclick = async () => { drawerHistory.pop(); renderDrawer(await api.entry(drawerHistory[drawerHistory.length - 1])); };
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
