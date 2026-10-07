// Search box in the top bar, visible only on the character sheet. It looks through the open character
// (skills, feats, spells, gear, companions, notes...) and jumps to the match.
import { state, go } from './app.js';
import { buildIndex, searchIndex, lc } from './searchindex.js';
import { $, esc } from './ui.js';

/** After the tab has drawn, scroll to the element showing `name` and flash it. */
function reveal(name, text) {
  const want = lc(name);
  const body = $('#tab-body');
  if (!body) return;
  let hit = null;
  for (const el of body.querySelectorAll('*')) {
    const v = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : el.children.length === 0 ? el.textContent : '';
    if (v && lc(v).includes(want)) { hit = el; break; }
  }
  if (!hit && text) {
    const t = lc(text).slice(0, 40);
    for (const el of body.querySelectorAll('textarea,input')) if (lc(el.value).includes(t)) { hit = el; break; }
  }
  if (!hit) return;
  hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const target = hit.closest('tr,.card,li') || hit;
  target.classList.remove('flash-hit');
  void target.offsetWidth;
  target.classList.add('flash-hit');
  setTimeout(() => target.classList.remove('flash-hit'), 2000);
}

export function initSheetSearch() {
  const input = $('#sheet-search'), list = $('#sheet-results');
  let results = [], sel = 0;
  const close = () => { list.hidden = true; results = []; };
  const draw = () => {
    if (!input.value.trim()) return close();
    list.hidden = false;
    list.innerHTML = results.length
      ? results.map((r, i) => `<div class="res ${i === sel ? 'sel' : ''}" data-i="${i}"><span class="kind">${esc(r.kind)}</span>
          <span><span class="nm">${esc(r.name)}</span>${r.score === 2 ? `<div class="snip">${esc(r.text.slice(0, 90))}</div>` : ''}</span></div>`).join('')
      : '<div class="none">Nothing on this character matches.</div>';
  };
  const run = () => { results = searchIndex(buildIndex(state.char, state.classesByName), input.value); sel = 0; draw(); };
  const choose = r => {
    if (!r) return;
    close();
    state.sheetTab = r.tab;
    go('sheet');
    // Some tabs (Companions) draw after loading data, so try again shortly.
    setTimeout(() => reveal(r.name, r.text), 80);
    setTimeout(() => reveal(r.name, r.text), 500);
  };
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (input.value.trim()) run(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[sel]); }
    else if (e.key === 'Escape') { input.value = ''; close(); input.blur(); }
  });
  list.addEventListener('mousedown', e => {
    const row = e.target.closest('[data-i]');
    if (row) { e.preventDefault(); choose(results[+row.dataset.i]); }
  });
  document.addEventListener('mousedown', e => { if (!e.target.closest('#sheet-search-wrap')) close(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && state.view === 'sheet' && state.char) { e.preventDefault(); input.focus(); input.select(); }
  });
}
