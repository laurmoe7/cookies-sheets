// Trait chooser: like the spell picker. Pick `count` traits from different categories; the window closes
// when they are all chosen. Resolves with the chosen entries (or undefined if closed with none).
// Drawbacks have their own view: they use up no traits, and under a "one drawback per trait" rule the window asks for them too.
import { api } from '../api.js';
import { traitBlock, traitCategory, usedCategories, countTraits, drawbacksLeft, isDrawback } from '../traits.js';
import { replacesOf, traitRaces } from '../racetraits.js';
import { esc, $, $$, modal, debounce, toast } from '../ui.js';

let allTraits = null;
/** Every character trait in the compendium (cached), for the category list and for spotting the traits already on a character. */
function traitList() {
  if (!allTraits) allTraits = api.search('', 'Trait', 1000).catch(() => { allTraits = null; return []; });
  return allTraits;
}

/**
 * @param count   how many traits to pick, or a function of the picks (under the book's rule a drawback adds a trait)
 * @param have    the character's traits so far (their categories are unavailable)
 * @param picks   traits already chosen in this draft; added to in place
 * @param rule    the character's drawback rule (traits.js): 'perTrait' asks for one drawback per trait picked here
 */
export function chooseTraits({ count, have = [], picks = [], title = 'Choose traits', onChange = () => {}, rule = 'optional' }) {
  return modal(title, (body, close) => {
    body.innerHTML = `<div class="pick-status" id="tr-status"></div>
      <div class="row"><span class="seg" role="group"><button class="seg-btn on" data-kind="traits">Traits</button><button class="seg-btn" data-kind="drawbacks">Drawbacks</button></span>
        <input class="search grow" placeholder="Search traits…"><select data-f="cat"><option value="">Any category</option></select><select data-f="race" title="Show the racial traits of one race (they do not use up your traits)"><option value="">Any race</option></select></div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a trait to read it.</p></div></div>
      <div class="row end"><button class="btn" data-done>Done</button></div>`;
    const q = $('input.search', body), catSel = $('[data-f=cat]', body), raceSel = $('[data-f=race]', body), list = $('.picker-list', body), prev = $('.picker-preview', body), status = $('#tr-status', body);
    let rows = [], all = [], used = new Set(), current = null, seq = 0, kind = 'traits';
    const left = () => (typeof count === 'function' ? count(picks) : count) - countTraits(picks);
    const dLeft = () => drawbacksLeft(rule, picks);
    const isPicked = r => picks.some(p => p.name === r.name);
    const drawStatus = () => {
      const todo = [left() > 0 ? `${left()} trait${left() === 1 ? '' : 's'}` : '', dLeft() > 0 ? `${dLeft()} drawback${dLeft() === 1 ? '' : 's'}` : ''].filter(Boolean);
      status.classList.toggle('done', !todo.length);
      status.innerHTML = (todo.length ? `<span>Left to choose:</span> <span class="left">${todo.join(' · ')}</span> <span class="small">· ${rule === 'perTrait' ? 'one drawback per trait' : 'each trait from a different category'}</span>` : '<span class="left">✓ All traits chosen</span>')
        + (picks.length ? `<span class="grow"></span>${picks.map((p, i) => `<span class="chip on ${isDrawback(p) ? 'drawback' : ''}">${esc(p.name)} <span class="dim small">${esc(p.sub || '')}</span> <button class="icon-btn" data-unpick="${i}" title="Remove">✕</button></span>`).join('')}` : '');
    };
    const why = r => (isPicked(r) || r.cat === 'Racial Trait' || isDrawback(r) ? '' : traitBlock(r, picks, used) || (left() <= 0 ? 'No traits left to choose.' : ''));
    const draw = async () => {
      const f = q.value.trim().toLowerCase(), cat = catSel.value, race = kind === 'drawbacks' ? '' : raceSel.value, my = ++seq;
      catSel.disabled = !!race; // a race shows its racial traits, which have no category
      let source = kind === 'drawbacks' ? all.filter(isDrawback) : all.filter(r => !isDrawback(r));
      if (race) { source = await api.search('', 'Racial Trait', 500, 0, '=' + race); if (my !== seq) return; }
      rows = source.filter(r => (race || kind === 'drawbacks' || !cat || traitCategory(r.sub) === cat) && (!f || (r.name + ' ' + (r.summary || '')).toLowerCase().includes(f)));
      const hint = kind === 'drawbacks' ? `<p class="pad small muted">${rule === 'perTrait' ? 'This character takes one drawback for each trait.' : 'Drawbacks are optional. Taking one at 1st level gives you a third trait.'}</p>` : '';
      list.innerHTML = hint + (rows.map((r, i) => {
        const on = isPicked(r), w = on ? '' : why(r);
        return `<div class="pick-row ${on ? 'known' : ''} ${w ? 'blocked' : ''} ${current?.id === r.id ? 'sel' : ''}" data-i="${i}">
          <div><b>${esc(r.name)}</b> <span class="muted small">${esc(r.sub || '')} · ${esc(r.source || '')}</span></div>
          <div class="muted small">${esc(w || r.summary || '')}</div>
          ${on ? '<span class="small good">added ✓</span>' : w ? '' : '<button class="btn small primary" data-pick>Add</button>'}</div>`;
      }).join('') || `<p class="pad muted">No ${kind === 'drawbacks' ? 'drawbacks' : 'traits'} match.</p>`);
    };
    const refresh = () => { drawStatus(); draw(); };
    const setKind = k => {
      kind = k;
      $$('[data-kind]', body).forEach(b => b.classList.toggle('on', b.dataset.kind === k));
      catSel.hidden = raceSel.hidden = k === 'drawbacks';
      q.placeholder = k === 'drawbacks' ? 'Search drawbacks…' : 'Search traits…';
      draw();
    };
    const take = r => {
      const racial = r.cat === 'Racial Trait', drawback = isDrawback(r);
      if (isPicked(r) || (!racial && !drawback && why(r))) return;
      picks.push({ id: r.id, name: r.name, sub: r.sub, ...(racial ? { racial: true } : {}), ...(replacesOf(r.summary).length ? { replaces: replacesOf(r.summary) } : {}) });
      onChange();
      if (!racial && left() <= 0 && dLeft() <= 0) { toast('All traits chosen', 'good'); close(picks); return; }
      drawStatus();
      if (!drawback && left() <= 0 && dLeft() > 0) { toast(`Now choose ${dLeft()} drawback${dLeft() === 1 ? '' : 's'}`); setKind('drawbacks'); return; }
      draw();
    };
    q.addEventListener('input', debounce(draw, 100));
    catSel.addEventListener('input', draw);
    raceSel.addEventListener('input', draw);
    $$('[data-kind]', body).forEach(b => (b.onclick = () => setKind(b.dataset.kind)));
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
      const w = isPicked(r) ? '' : why(r);
      prev.innerHTML = `<div class="row"><h3 class="grow">${esc(en.name)}</h3>${isPicked(r) ? '<span class="small good">Added ✓</span>' : w ? '' : `<button class="btn primary" data-pick-preview>＋ Add this ${isDrawback(r) ? 'drawback' : 'trait'}</button>`}</div>
        <div class="muted small">${esc(en.sub || '')} · ${esc(en.source || '')}</div>${w ? `<p class="small bad">${esc(w)}</p>` : ''}${en.html}`;
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
      catSel.insertAdjacentHTML('beforeend', [...new Set(l.filter(r => !isDrawback(r)).map(r => traitCategory(r.sub)).filter(Boolean))].sort().map(c => `<option>${esc(c)}</option>`).join(''));
      draw();
    });
  }, { wide: true });
}
