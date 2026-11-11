// An animal companion's tricks: the chips in its Build card, the side panel for one trick, and the chooser window.
import { state } from '../app.js';
import { sign } from '../calc.js';
import { TRICKS, SOURCES, PURPOSES, parseTricks, tricksText, tricksUsed, trickLimit, trickDef, missingNeeds, toggleTrick, addPurpose, purposesMet, take10 } from '../tricks.js';
import { esc, $, $$, modal, showCustom } from '../ui.js';

const MANEUVERS = ['bull rush', 'dirty trick', 'disarm', 'drag', 'grapple', 'overrun', 'reposition', 'steal', 'sunder', 'trip'];

/** The handler's Handle Animal bonus, or null when the sheet has no number for it. */
const handleBonus = () => state.derived?.skills?.['Handle Animal']?.total ?? null;

const needsText = (list, def) => {
  const miss = missingNeeds(list, def);
  return [miss.length ? `needs ${miss.join(' and ')}` : '', def?.needsNote ? `needs ${def.needsNote}` : ''].filter(Boolean).join(' · ');
};

/** The Tricks part of an animal companion's Build card. */
export function tricksBlock(comp, s) {
  const list = parseTricks(comp.tricks);
  const used = tricksUsed(list), limit = trickLimit(s.abilities.int, s.bonusTricks);
  const met = purposesMet(list);
  const chips = list.map((t, k) => {
    const miss = missingNeeds(list, t.def);
    const tip = t.def ? `DC ${t.def.dc} · ${t.def.text}${miss.length ? `\nNeeds ${miss.join(' and ')}` : ''}` : 'Not on the trick list: as your GM allows';
    return `<span class="chip on trick-chip${miss.length ? ' warn' : ''}${t.def ? '' : ' custom'}" title="${esc(tip)}"><a href="#" data-trick-info="${k}">${esc(t.choice ? `${t.name} (${t.choice})` : t.name)}</a>${t.weight > 1 ? ' <span class="dim small">×2</span>' : ''}
      <button class="icon-btn" data-rm-trick="${k}" aria-label="Remove ${esc(t.name)}">✕</button></span>`;
  }).join('');
  return `<h4>Tricks <span class="pill ${used > limit ? 'bad' : used === limit ? 'good' : ''}" title="3 per point of Int (${s.abilities.int ?? '—'}), plus ${s.bonusTricks} bonus tricks">${used} / ${limit}</span>
      <button class="btn small" data-add-trick>＋ Tricks</button></h4>
    <p class="small muted">Int ${s.abilities.int ?? '—'} teaches ${trickLimit(s.abilities.int)}, plus ${s.bonusTricks} bonus trick${s.bonusTricks === 1 ? '' : 's'} from its level${met.length ? ` · trained for ${esc(met.join(', ').toLowerCase())}` : ''}
      · <a href="#" class="ref" data-entry="Handle Animal" data-cat="Skill">Handle Animal</a></p>
    <div class="chips">${chips || '<span class="muted small">No tricks yet.</span>'}</div>`;
}

/** Clicks on the Tricks part. Returns true when it handled the click; `redraw` saves and redraws. */
export async function tricksClick(t, comp, s, redraw) {
  if (t.dataset.addTrick !== undefined) { await chooseTricks(comp, s); redraw(); return true; }
  if (t.dataset.rmTrick !== undefined) {
    const list = parseTricks(comp.tricks);
    list.splice(+t.dataset.rmTrick, 1);
    comp.tricks = tricksText(list);
    redraw();
    return true;
  }
  if (t.dataset.trickInfo !== undefined) {
    const list = parseTricks(comp.tricks);
    const tr = list[+t.dataset.trickInfo];
    if (!tr) return true;
    const d = tr.def, hb = handleBonus();
    const need = needsText(list, d);
    showCustom({ name: tr.choice ? `${tr.name} (${tr.choice})` : tr.name, cat: 'Trick', sub: d ? `DC ${d.dc} · ${d.source}` : 'Not on the trick list',
      html: d ? `<p>${esc(d.text)}</p>${need ? `<p class="warn">${esc(need[0].toUpperCase() + need.slice(1))}.</p>` : ''}
        <p class="small muted">Teaching it takes a week and a Handle Animal check against DC ${d.dc}${hb != null ? ` (your bonus ${sign(hb)}: ${take10(hb, d.dc) ? 'taking 10 is enough' : `you need a ${d.dc - hb} or better`})` : ''}.
        Bonus tricks from the companion’s level need no training.</p>
        <p class="small"><a href="#" class="ref" data-entry="Teach an Animal a Trick" data-cat="Rules">Teaching tricks</a> · <a href="#" class="ref" data-entry="Handle Animal" data-cat="Skill">Handle Animal</a></p>`
        : '<p>A trick written in by hand. Ask your GM what it does and how hard it is to teach.</p>' });
    return true;
  }
  return false;
}

/** The chooser: tricks by book as cards, general purposes as one-click sets, and a box for one the list lacks. Edits the companion as it goes. */
function chooseTricks(comp, s) {
  const limit = trickLimit(s.abilities.int, s.bonusTricks), hb = handleBonus();
  let filter = '';
  return modal(`Tricks for ${comp.name || 'your companion'}`, body => {
    const draw = () => {
      const list = parseTricks(comp.tricks), used = tricksUsed(list), left = limit - used;
      const met = purposesMet(list);
      const card = d => {
        const taken = list.filter(t => t.name === d.name);
        const on = taken.length > 0;
        const cost = (d.weight || 1) - (d.name === 'Attack (any creature)' && list.some(t => t.name === 'Attack') ? 1 : 0); // it replaces plain Attack
        const full = !on && !d.repeat && left < cost;
        const need = needsText(list, d);
        const t10 = hb != null ? (take10(hb, d.dc) ? 'take 10 ✓' : `you need ${d.dc - hb}+`) : '';
        const chosen = d.repeat && taken.length ? `<div class="chips">${taken.map(t => `<span class="chip on small">${esc(t.choice || '—')} <button class="icon-btn" data-trick-off="${esc(d.name)}" data-choice="${esc(t.choice)}">✕</button></span>`).join('')}</div>` : '';
        const adder = d.repeat ? `<div class="row trick-choice">${d.choice === 'maneuver'
          ? `<select data-choice-for="${esc(d.name)}"><option value="">maneuver…</option>${MANEUVERS.filter(m => !taken.some(t => t.choice === m)).map(m => `<option>${m}</option>`).join('')}</select>`
          : `<input data-choice-for="${esc(d.name)}" placeholder="which spell?" class="w8">`}<button class="btn small" data-trick-add="${esc(d.name)}">Add</button></div>` : '';
        return `<div class="arch-card trick-card ${on && !d.repeat ? 'on' : ''} ${full ? 'blocked' : ''}" ${d.repeat ? '' : `data-trick="${esc(d.name)}"`}
            data-search="${esc((d.name + ' ' + d.text).toLowerCase())}" title="${d.repeat ? '' : on ? 'Click to remove' : full ? 'No tricks left' : 'Click to add'}">
          <h4>${on && !d.repeat ? '✓ ' : ''}${esc(d.name)} <span class="pill small">DC ${d.dc}</span></h4><div class="desc">${esc(d.text)}</div>
          <div class="small muted">${[d.weight > 1 ? 'counts as 2' : '', need ? `<span class="warn">${esc(need)}</span>` : '', t10].filter(Boolean).join(' · ')}</div>${chosen}${adder}</div>`;
      };
      const custom = list.map((t, k) => [t, k]).filter(([t]) => !t.def);
      body.innerHTML = `<div class="pick-status ${left <= 0 ? 'done' : ''}"><span class="left">${left > 0 ? `${left} trick${left > 1 ? 's' : ''} left` : left === 0 ? 'Every trick slot is used' : `${-left} trick${left < -1 ? 's' : ''} over the limit`}</span>
          <span class="small">(${used} of ${limit}: 3 per point of Int, plus ${s.bonusTricks} bonus)${hb != null ? ` · your Handle Animal ${sign(hb)}` : ''}</span></div>
        <h4>Train for a purpose <span class="small muted">one check teaches the whole set; adds the tricks it lacks</span></h4>
        <div class="chips">${PURPOSES.map(p => `<button class="chip ${met.includes(p.name) ? 'on' : ''}" data-purpose="${esc(p.name)}" title="DC ${p.dc}${p.weeks ? `, ${p.weeks} weeks` : ''}: ${esc(p.tricks.join(', '))}">${met.includes(p.name) ? '✓ ' : ''}${esc(p.name)} <span class="dim small">DC ${p.dc}</span></button>`).join('')}</div>
        <input class="search" placeholder="Filter tricks…" value="${esc(filter)}">
        ${SOURCES.map(src => `<h4>${esc(src)}</h4><div class="arch-grid">${TRICKS.filter(d => d.source === src).map(card).join('')}</div>`).join('')}
        <h4>Another trick <span class="small muted">one your GM allows that is not listed</span></h4>
        ${custom.length ? `<div class="chips">${custom.map(([t]) => `<span class="chip on">${esc(t.name)} <button class="icon-btn" data-trick-off="${esc(t.name)}" data-choice="">✕</button></span>`).join('')}</div>` : ''}
        <div class="row"><input data-custom-trick class="grow" placeholder="Name of the trick"><button class="btn small" data-custom-add>Add</button></div>`;
      const input = $('input.search', body);
      const apply = () => $$('[data-search]', body).forEach(x => (x.style.display = x.dataset.search.includes(filter.toLowerCase()) ? '' : 'none'));
      input.oninput = () => { filter = input.value; apply(); };
      apply();
    };
    const save = list => { comp.tricks = tricksText(list); draw(); };
    body.onclick = e => {
      const list = parseTricks(comp.tricks);
      const off = e.target.closest('[data-trick-off]');
      if (off) return save(toggleTrick(list, off.dataset.trickOff, off.dataset.choice));
      const add = e.target.closest('[data-trick-add]');
      if (add) {
        const box = $(`[data-choice-for="${CSS.escape(add.dataset.trickAdd)}"]`, body);
        const v = box?.value.trim().replace(/[(),;]/g, '');
        if (!v) { box?.focus(); return; }
        return save(toggleTrick(list, add.dataset.trickAdd, v));
      }
      const p = e.target.closest('[data-purpose]');
      if (p) return save(addPurpose(list, p.dataset.purpose));
      if (e.target.closest('[data-custom-add]')) {
        const box = $('[data-custom-trick]', body), v = box.value.trim().replace(/[,;]/g, '');
        if (v && !list.some(t => t.name.toLowerCase() === v.toLowerCase())) save(toggleTrick(list, trickDef(v)?.name || v));
        return;
      }
      const c = e.target.closest('[data-trick]');
      if (!c || e.target.closest('select,input,button')) return;
      if (c.classList.contains('blocked')) return;
      save(toggleTrick(list, c.dataset.trick));
    };
    body.onkeydown = e => {
      if (e.key !== 'Enter') return;
      if (e.target.matches('[data-custom-trick]')) $('[data-custom-add]', body).click();
      else if (e.target.matches('input[data-choice-for]')) $(`[data-trick-add="${CSS.escape(e.target.dataset.choiceFor)}"]`, body).click();
    };
    draw();
  }, { wide: true });
}
