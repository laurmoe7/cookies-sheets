// Spell chooser for the level-up wizard: only offers spells of levels the character can still learn,
// shows what's left to choose at the top, and stays open until everything is chosen (or the user closes it).
import { api } from '../api.js';
import { SCHOOLS } from '../data.js';
import { remaining, pickableLevels, describeRemaining } from '../spellrules.js';
import { esc, $, $$, modal, debounce, toast } from '../ui.js';

const LV = l => (l === 0 ? 'Cantrip' : `Level ${l}`);

/**
 * @param cls        class name (for the title)
 * @param lists      spell lists to search (e.g. ['Wizard', 'Sorcerer'])
 * @param allowance  from spellrules.learnAllowance
 * @param picks      array of spells chosen this level; added to in place
 * @param known      names already on the character's list (shown as "known", can't be picked again)
 * @param onChange   called after each pick or removal
 */
export function chooseSpells({ cls, lists, allowance, picks, known, onChange = () => {} }) {
  return modal(`Choose ${cls} spells`, (body, close) => {
    body.innerHTML = `<div class="pick-status" id="sp-status"></div>
      <div class="row">
        <input class="search grow" placeholder="Search spell names…">
        <select data-f="level"></select>
        <select data-f="school"><option value="">Any school</option>${SCHOOLS.map(s => `<option>${s}</option>`).join('')}</select>
      </div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a spell to read it.</p></div></div>`;
    const q = $('input.search', body), lvSel = $('[data-f=level]', body), sch = $('[data-f=school]', body);
    const list = $('.picker-list', body), prev = $('.picker-preview', body), status = $('#sp-status', body);
    const knownSet = new Set(known.map(n => n.toLowerCase()));
    let rows = [], seq = 0;

    const rem = () => remaining(allowance, picks);
    const drawStatus = () => {
      const r = rem();
      status.classList.toggle('done', r.total === 0);
      status.innerHTML = (r.total ? `<span>Left to choose:</span> <span class="left">${esc(describeRemaining(r))}</span>` : '<span class="left">✓ All spells chosen</span>')
        + (allowance.allCantrips ? '<span class="small">· every cantrip is added automatically</span>' : '')
        + (picks.length ? `<span class="grow"></span>${picks.map((p, i) => `<span class="chip on">${esc(p.name)} <span class="dim small">${p.level}</span> <button class="icon-btn" data-unpick="${i}" title="Remove">✕</button></span>`).join('')}` : '');
    };
    const drawLevels = () => {
      const levels = pickableLevels(rem());
      const cur = lvSel.value;
      lvSel.innerHTML = (levels.length > 1 ? '<option value="">All levels you can pick</option>' : '')
        + levels.map(l => `<option value="${l}">${LV(l)}</option>`).join('');
      if ([...lvSel.options].some(o => o.value === cur)) lvSel.value = cur;
      return levels;
    };

    const run = debounce(async () => {
      const my = ++seq;
      const levels = pickableLevels(rem());
      const want = lvSel.value === '' ? levels : [+lvSel.value];
      const res = (await Promise.all(want.map(l => api.spells(lists.join(','), l, q.value, sch.value)))).flat();
      if (my !== seq) return;
      rows = res.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      const picked = new Set(picks.map(p => p.name.toLowerCase()));
      list.innerHTML = rows.map((r, i) => {
        const isKnown = knownSet.has(r.name.toLowerCase()), isPicked = picked.has(r.name.toLowerCase());
        return `<div class="pick-row ${isKnown || isPicked ? 'known' : ''}" data-i="${i}">
          <div><b>${esc(r.name)}</b> <span class="muted small">${LV(r.level)} · ${esc(r.school || '')}</span></div>
          <div class="muted small">${esc(r.summary || '')}</div>
          ${isKnown ? '<span class="small muted">known</span>' : isPicked ? '<span class="small good">chosen ✓</span>' : `<button class="btn small primary" data-pick="${i}">Choose</button>`}</div>`;
      }).join('') || '<p class="pad muted">No spells match.</p>';
    }, 120);

    const refresh = () => { drawStatus(); drawLevels(); run(); };
    [q, lvSel, sch].forEach(x => x.addEventListener('input', run));
    status.addEventListener('click', e => {
      const u = e.target.closest('[data-unpick]');
      if (!u) return;
      picks.splice(+u.dataset.unpick, 1);
      onChange();
      refresh();
    });
    list.addEventListener('click', async e => {
      const p = e.target.closest('[data-pick]');
      if (p) {
        const r = rows[+p.dataset.pick];
        if (!pickableLevels(rem()).includes(r.level)) { toast(`No ${LV(r.level).toLowerCase()} picks left`, 'err'); return; }
        picks.push({ id: r.id, name: r.name, level: r.level, school: r.school, summary: r.summary });
        onChange();
        if (rem().total === 0) { toast('All spells chosen', 'good'); close(true); return; }
        refresh();
        return;
      }
      const row = e.target.closest('.pick-row');
      if (!row) return;
      $$('.pick-row.sel', list).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      const en = await api.entry(rows[+row.dataset.i].id);
      prev.innerHTML = `<h3>${esc(en.name)}</h3>${en.html}<p class="source">Source: ${esc(en.source)}</p>`;
    });
    drawStatus();
    drawLevels();
    run();
  }, { wide: true });
}
