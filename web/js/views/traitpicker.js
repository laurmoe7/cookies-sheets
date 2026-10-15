// Trait chooser: like the spell picker. Pick `count` traits from different categories; the window closes
// when they are all chosen. Resolves with the chosen entries (or undefined if closed with none).
import { api } from '../api.js';
import { traitBlock, traitCategory, usedCategories, countTraits } from '../traits.js';
import { replacesOf, traitRaces } from '../racetraits.js';
import { esc, $, $$, modal, debounce, toast } from '../ui.js';

let allTraits = null;
/** Every character trait in the compendium (cached), for the category list and for spotting the traits already on a character. */
function traitList() {
  if (!allTraits) allTraits = api.search('', 'Trait', 1000).catch(() => { allTraits = null; return []; });
  return allTraits;
}

/**
 * @param count   how many traits to pick
 * @param have    the character's traits so far (their categories are unavailable)
 * @param picks   traits already chosen in this draft; added to in place
 */
export function chooseTraits({ count, have = [], picks = [], title = 'Choose traits', onChange = () => {} }) {
  return modal(title, (body, close) => {
    body.innerHTML = `<div class="pick-status" id="tr-status"></div>
      <div class="row"><input class="search grow" placeholder="Search traits…"><select data-f="cat"><option value="">Any category</option></select><select data-f="race" title="Show the racial traits of one race (they do not use up your traits)"><option value="">Any race</option></select></div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a trait to read it.</p></div></div>
      <div class="row end"><button class="btn" data-done>Done</button></div>`;
    const q = $('input.search', body), catSel = $('[data-f=cat]', body), raceSel = $('[data-f=race]', body), list = $('.picker-list', body), prev = $('.picker-preview', body), status = $('#tr-status', body);
    let rows = [], all = [], used = new Set(), current = null, seq = 0;
    const left = () => count - countTraits(picks);
    const isPicked = r => picks.some(p => p.name === r.name);
    const drawStatus = () => {
      status.classList.toggle('done', left() <= 0);
      status.innerHTML = (left() > 0 ? `<span>Left to choose:</span> <span class="left">${left()} trait${left() === 1 ? '' : 's'}</span> <span class="small">· each from a different category</span>` : '<span class="left">✓ All traits chosen</span>')
        + (picks.length ? `<span class="grow"></span>${picks.map((p, i) => `<span class="chip on">${esc(p.name)} <span class="dim small">${esc(p.sub || '')}</span> <button class="icon-btn" data-unpick="${i}" title="Remove">✕</button></span>`).join('')}` : '');
    };
    const draw = async () => {
      const f = q.value.trim().toLowerCase(), cat = catSel.value, race = raceSel.value, my = ++seq;
      catSel.disabled = !!race; // a race shows its racial traits, which have no category
      let source = all;
      if (race) { source = await api.search('', 'Racial Trait', 500, 0, '=' + race); if (my !== seq) return; }
      rows = source.filter(r => (race || !cat || traitCategory(r.sub) === cat) && (!f || (r.name + ' ' + (r.summary || '')).toLowerCase().includes(f)));
      list.innerHTML = rows.map((r, i) => {
        const on = isPicked(r), why = on || r.cat === 'Racial Trait' ? '' : traitBlock(r, picks, used);
        return `<div class="pick-row ${on ? 'known' : ''} ${why ? 'blocked' : ''} ${current?.id === r.id ? 'sel' : ''}" data-i="${i}">
          <div><b>${esc(r.name)}</b> <span class="muted small">${esc(r.sub || '')} · ${esc(r.source || '')}</span></div>
          <div class="muted small">${esc(why || r.summary || '')}</div>
          ${on ? '<span class="small good">added ✓</span>' : why ? '' : '<button class="btn small primary" data-pick>Add</button>'}</div>`;
      }).join('') || '<p class="pad muted">No traits match.</p>';
    };
    const refresh = () => { drawStatus(); draw(); };
    const take = r => {
      const racial = r.cat === 'Racial Trait';
      if (isPicked(r) || (!racial && (left() <= 0 || traitBlock(r, picks, used)))) return;
      picks.push({ id: r.id, name: r.name, sub: r.sub, ...(racial ? { racial: true } : {}), ...(replacesOf(r.summary).length ? { replaces: replacesOf(r.summary) } : {}) });
      onChange();
      if (!racial && left() <= 0) { toast('All traits chosen', 'good'); close(picks); return; }
      refresh();
    };
    q.addEventListener('input', debounce(draw, 100));
    catSel.addEventListener('input', draw);
    raceSel.addEventListener('input', draw);
    traitRaces().then(l => raceSel.insertAdjacentHTML('beforeend', l.map(r => `<option>${esc(r)}</option>`).join('')));
    status.addEventListener('click', e => {
      const u = e.target.closest('[data-unpick]');
      if (u) { picks.splice(+u.dataset.unpick, 1); onChange(); refresh(); }
    });
    list.addEventListener('click', async e => {
      const row = e.target.closest('.pick-row');
      if (!row) return;
      const r = rows[+row.dataset.i];
      if (e.target.closest('[data-pick]')) { take(r); return; }
      current = r;
      $$('.pick-row.sel', list).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      const en = await api.entry(r.id);
      if (current !== r) return;
      const why = isPicked(r) || r.cat === 'Racial Trait' ? '' : traitBlock(r, picks, used);
      prev.innerHTML = `<div class="row"><h3 class="grow">${esc(en.name)}</h3>${isPicked(r) ? '<span class="small good">Added ✓</span>' : why ? '' : '<button class="btn primary" data-pick-preview>＋ Add this trait</button>'}</div>
        <div class="muted small">${esc(en.sub || '')} · ${esc(en.source || '')}</div>${why ? `<p class="small bad">${esc(why)}</p>` : ''}${en.html}`;
    });
    prev.addEventListener('click', e => {
      if (!e.target.closest('[data-pick-preview]') || !current) return;
      take(current);
      if (body.isConnected) refresh();
    });
    $('[data-done]', body).onclick = () => close(picks.length ? picks : undefined);
    drawStatus();
    traitList().then(l => {
      all = l;
      used = usedCategories(have, new Map(l.map(r => [r.name.toLowerCase(), r.sub])));
      catSel.insertAdjacentHTML('beforeend', [...new Set(l.map(r => traitCategory(r.sub)).filter(Boolean))].sort().map(c => `<option>${esc(c)}</option>`).join(''));
      draw();
    });
  }, { wide: true });
}
