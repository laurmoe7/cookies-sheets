// Class resource pools (arcane reservoir, rage rounds, ki...) plus the character's own trackers.
import { state, changed } from '../app.js';
import { classResources, currentOf } from '../resources.js';
import { segsHtml } from '../bars.js';
import { esc, textField, getPath, toast, confirmBox } from '../ui.js';
import { fullRest } from '../rest.js';
import { chargesLeft, spendCharges, restCharges } from '../charges.js';
import { rollItemSpell } from './itemroll.js';

const tf = (path, opts) => textField(path, getPath(state.char, path), opts);

/** The pools this character's classes give, using the current ability modifiers. */
export function poolsFor(c) {
  const d = state.derived;
  const mods = Object.fromEntries(Object.entries(d.abilities).map(([a, v]) => [a, v.mod]));
  return classResources(d.classLevels || {}, mods, c.resourceAdj);
}

/** One segment per point, up to 40 (a bigger pool is drawn as 20 equal segments so the bar stays readable). */
const segs = max => { const n = Math.max(1, Math.round(+max) || 1); return n <= 40 ? n : 20; };

const editing = new Set(); // pools whose editor is open

function editor(res, c) {
  const a = (c.resourceAdj ||= {})[res.id] ||= {};
  return `<div class="res-edit" data-res-editor="${esc(res.id)}">
    <label>Extra capacity <input type="number" class="num w3" data-bind="resourceAdj.${esc(res.id)}.max" data-type="num" data-rerender value="${esc(a.max ?? '')}" placeholder="0"></label>
    <label>Extra at the start of the day <input type="number" class="num w3" data-bind="resourceAdj.${esc(res.id)}.start" data-type="num" data-rerender value="${esc(a.start ?? '')}" placeholder="${res.bonus || 0}" title="Leave blank to use the same as the extra capacity"></label>
    <span class="muted small">Base ${res.baseMax}. Extra Rage: +6 and +6. Extra Reservoir: +3 capacity, +1 at the start. Blank start = same as capacity.</span>
    <button class="btn small ghost" data-res-edit-clear title="Remove your changes to this pool">Clear</button></div>`;
}

function counter(res, cur, c) {
  const pct = res.max ? Math.max(0, Math.min(100, cur / res.max * 100)) : 0;
  return `<div class="res-row" data-res="${esc(res.id)}">
    <div class="res-name"><a href="#" class="ref" data-entry="${esc(res.entry)}" data-cat="Class Feature">${esc(res.name)}</a>
      <span class="muted small">${esc(res.cls)}</span></div>
    <div class="res-bar"><div style="width:${pct}%"></div>${segsHtml(segs(res.max))}</div>
    <span class="stepper"><button data-res-d="-1" title="Spend one" aria-label="Spend one">−</button><button data-res-d="1" title="Regain one" aria-label="Regain one">＋</button></span>
    <b class="res-val"><input type="number" class="num w3" min="0" max="${res.max}" data-res-cur value="${cur}" title="Points left: type a number"> / ${res.max}${res.bonus ? ` <span class="alt-note" title="Your extra capacity">(${res.bonus > 0 ? '+' : ''}${res.bonus})</span>` : ''}</b>
    <button class="btn small ghost" data-res-reset title="Back to the start-of-day amount (${res.start})">Reset</button>
    <button class="icon-btn" data-res-edit title="Change this pool (extra rounds from Extra Rage, extra points from Extra Reservoir...)" aria-label="Edit this pool">✎</button>
    <div class="small muted res-note">${esc(res.note)}</div>${editing.has(res.id) ? editor(res, c) : ''}</div>`;
}

function custom(t, i) {
  const pct = t.max ? Math.max(0, Math.min(100, t.cur / t.max * 100)) : 0;
  return `<div class="res-row" data-tracker="${i}">
    <div class="res-name">${tf(`trackers.${i}.name`, { placeholder: 'Name (e.g. Bomb, Inspiration)' })}</div>
    <div class="res-bar"><div style="width:${pct}%"></div>${segsHtml(segs(t.max))}</div>
    <span class="stepper"><button data-tr-d="-1" aria-label="Spend one" title="Spend one">−</button><button data-tr-d="1" aria-label="Regain one" title="Regain one">＋</button></span>
    <b class="res-val">${t.cur} / <input type="number" class="num w3" data-bind="trackers.${i}.max" data-type="num" data-rerender value="${esc(t.max)}" title="Maximum"></b>
    <button class="btn small ghost" data-tr-reset title="Refill to maximum">Refill</button>
    <button class="icon-btn" data-tr-del title="Remove this tracker">✕</button></div>`;
}

/**
 * An inventory item with charges (a wand, a staff, boots of speed): spent here too, so it is at hand in a fight. Each of its spells has a
 * Use button (spends its cost) and a 🎲 (the spell's roll window, see itemroll.js). `g.charges.min` folds the row away into a chip.
 */
function itemRow(g, i) {
  const ch = g.charges, left = chargesLeft(ch), max = Math.max(0, Math.round(+ch.max) || 0);
  const pct = max ? Math.max(0, Math.min(100, left / max * 100)) : 0;
  const unit = ch.unit || 'charges', one = unit.replace(/s$/, '');
  const spells = (ch.spells || []).filter(s => s.name);
  return `<div class="res-row" data-gear-ch="${i}">
    <div class="res-name"><span>⚡ ${esc(g.name || 'Item')}</span> <span class="muted small">${esc(ch.per === 'day' ? `${ch.unit || 'uses'} per day` : unit)}</span></div>
    <div class="res-bar"><div style="width:${pct}%"></div>${segsHtml(segs(max))}</div>
    <span class="stepper"><button data-gc-d="-1" title="Spend one" aria-label="Spend one">−</button><button data-gc-d="1" title="Get one back" aria-label="Get one back">＋</button></span>
    <b class="res-val">${left} / ${max}</b>
    <button class="icon-btn" data-gc-min title="Minimize: keep only its name and count here" aria-label="Minimize ${esc(g.name || 'item')}">▴</button>
    ${spells.length ? `<div class="res-note res-uses">${spells.map(s => `<span class="res-use"><button class="btn small ${left >= s.cost ? 'primary' : ''}" data-gc-use="${s.cost}" data-label="${esc(s.name)}" ${left >= s.cost ? '' : 'disabled'} title="Use it: spend ${s.cost} ${esc(s.cost === 1 ? one : unit)}">${esc(s.name)}${s.cost !== 1 || spells.length > 1 ? ` <span class="ch-cost">· ${s.cost}</span>` : ''}</button><button class="btn small" data-gc-roll="${esc(s.name)}" data-cost="${s.cost}" title="Roll ${esc(s.name)}: its attack, damage or healing, with the item’s caster level and save DC" aria-label="Roll ${esc(s.name)}">🎲</button></span>`).join('')}</div>` : ''}</div>`;
}

/** A minimized item: its name and what is left; click to bring its counter back. */
function itemChip(g, i) {
  const ch = g.charges, left = chargesLeft(ch), max = Math.max(0, Math.round(+ch.max) || 0);
  return `<button class="sp-chip ${left ? 'ready' : 'idle'}" data-gc-max="${i}" title="${left} of ${max} ${esc(ch.unit || 'charges')} left${ch.per === 'day' ? ' today' : ''}. Click to show its counter"><span class="sp-n">⚡ ${esc(g.name || 'Item')}</span><span class="sp-s ${left ? '' : 'bad'}">${left}/${max}</span></button>`;
}

/** The Rest button at the top of the Overview. */
export function wireRest(el, c) {
  el.querySelector('[data-full-rest]')?.addEventListener('click', async () => {
    const now = { maxHp: state.derived.hp.max, level: state.derived.level };
    const preview = fullRest(structuredClone(c), now); // what a rest would do, without doing it
    if (!preview.length) return toast('Nothing needs resting for');
    if (!await confirmBox('Take a night’s rest? This will: ' + preview.join('; ') + '.', '🌙 Rest')) return;
    const said = fullRest(c, now);
    toast(said.length ? 'Rested: ' + said.join(', ') : 'Rested. Nothing needed restoring');
    changed({ rerender: true });
  });
}

/** Overview card: every class pool plus the player's own trackers. */
export function renderResources(el, c) {
  el.innerHTML = resourcesHtml(c);
  wire(el, c);
}

/** The same card's contents, for a page that wires its own element (the Spells tab). Empty when there is nothing to track. */
export function resourcesHtml(c, { hideEmpty = false } = {}) {
  c.trackers ||= [];
  const pools = poolsFor(c);
  const items = (c.gear || []).map((g, i) => [g, i]).filter(([g]) => g.charges);
  if (hideEmpty && !pools.length && !c.trackers.length && !items.length) return '';
  return `<div class="row"><h3 class="grow" style="margin:0">Class resources &amp; trackers</h3>
      <button class="btn small" data-tr-new>＋ Tracker</button>
      <button class="btn small ghost" data-res-rest title="Refill every pool below for a new day (the 🌙 Rest button at the top does that and more)">New day</button></div>
    ${pools.map(r => counter(r, currentOf(r, c.resources), c)).join('')}
    ${c.trackers.map(custom).join('')}
    ${items.filter(([g]) => !g.charges.min).map(([g, i]) => itemRow(g, i)).join('')}
    ${items.some(([g]) => g.charges.min) ? `<div class="res-row res-min">${items.filter(([g]) => g.charges.min).map(([g, i]) => itemChip(g, i)).join('')}</div>` : ''}
    ${pools.length || c.trackers.length || items.length ? '' : '<p class="muted small">Nothing to track yet. Classes such as arcanist, barbarian, bard, magus and monk show their pools here; “＋ Tracker” adds your own counter for anything else.</p>'}`;
}

/** Delegated click handling for any element holding counters. */
export function wire(el, c) {
  el.addEventListener('change', e => { // typing the points left into a pool
    const input = e.target.closest?.('[data-res-cur]');
    const row = input?.closest('[data-res]');
    const res = row && poolsFor(c).find(r => r.id === row.dataset.res);
    if (!res) return;
    (c.resources ||= {})[res.id] = Math.max(0, Math.min(res.max, Math.round(Number(input.value)) || 0));
    changed({ rerender: true });
  });
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-res-d],[data-res-reset],[data-res-rest],[data-res-edit],[data-res-edit-clear],[data-tr-new],[data-tr-d],[data-tr-reset],[data-tr-del],[data-gc-d],[data-gc-use],[data-gc-roll],[data-gc-min],[data-gc-max]');
    if (!t) return;
    e.preventDefault();
    c.resources ||= {};
    c.trackers ||= [];
    if (t.dataset.trNew !== undefined) { c.trackers.push({ name: '', max: 3, cur: 3 }); return changed({ rerender: true }); }
    if (t.dataset.resRest !== undefined) {
      c.resources = {};
      for (const tr of c.trackers) tr.cur = tr.max;
      restCharges(c); // items used so many times per day
      return changed({ rerender: true });
    }
    if (t.dataset.gcMax !== undefined) { // a minimized item's chip: its counter again
      const g = c.gear?.[+t.dataset.gcMax];
      if (g?.charges) delete g.charges.min;
      return changed({ rerender: true });
    }
    const gearRow = t.closest('[data-gear-ch]');
    if (gearRow) {
      const g = c.gear?.[+gearRow.dataset.gearCh], ch = g?.charges;
      if (!ch) return;
      if (t.dataset.gcRoll !== undefined) return void rollItemSpell(g, t.dataset.gcRoll, +t.dataset.cost); // the window's "Use it" tick spends the charge
      if (t.dataset.gcMin !== undefined) ch.min = true;
      else if (t.dataset.gcUse !== undefined) {
        if (!spendCharges(ch, +t.dataset.gcUse)) return toast(`Not enough ${ch.unit || 'charges'} left`, 'bad');
        toast(`${t.dataset.label}: ${chargesLeft(ch)} ${ch.unit || 'charges'} left`);
      } else spendCharges(ch, -t.dataset.gcD);
      return changed({ rerender: true });
    }
    const row = t.closest('[data-res],[data-tracker]');
    if (row?.dataset.res) {
      const res = poolsFor(c).find(r => r.id === row.dataset.res);
      if (!res) return;
      if (t.dataset.resEdit !== undefined) { if (!editing.delete(res.id)) editing.add(res.id); }
      else if (t.dataset.resEditClear !== undefined) { delete (c.resourceAdj ||= {})[res.id]; editing.delete(res.id); }
      else if (t.dataset.resReset !== undefined) delete c.resources[res.id];
      else c.resources[res.id] = Math.max(0, Math.min(res.max, currentOf(res, c.resources) + +t.dataset.resD));
    } else if (row?.dataset.tracker !== undefined) {
      const tr = c.trackers[+row.dataset.tracker];
      if (t.dataset.trDel !== undefined) c.trackers.splice(+row.dataset.tracker, 1);
      else if (t.dataset.trReset !== undefined) tr.cur = tr.max;
      else tr.cur = Math.max(0, Math.min(+tr.max || 0, (+tr.cur || 0) + +t.dataset.trD));
    }
    changed({ rerender: true });
  });
}
