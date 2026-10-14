// Class resource pools (arcane reservoir, rage rounds, ki...) plus the character's own trackers.
import { state, changed } from '../app.js';
import { classResources, currentOf } from '../resources.js';
import { segsHtml } from '../bars.js';
import { esc, textField, getPath, toast } from '../ui.js';
import { fullRest } from '../rest.js';

const tf = (path, opts) => textField(path, getPath(state.char, path), opts);

/** The pools this character's classes give, using the current ability modifiers. */
export function poolsFor(c) {
  const d = state.derived;
  const mods = Object.fromEntries(Object.entries(d.abilities).map(([a, v]) => [a, v.mod]));
  return classResources(d.classLevels || {}, mods);
}

/** One segment per point, up to 40 (a bigger pool is drawn as 20 equal segments so the bar stays readable). */
const segs = max => { const n = Math.max(1, Math.round(+max) || 1); return n <= 40 ? n : 20; };

function counter(res, cur) {
  const pct = res.max ? Math.max(0, Math.min(100, cur / res.max * 100)) : 0;
  return `<div class="res-row" data-res="${esc(res.id)}">
    <div class="res-name"><a href="#" class="ref" data-entry="${esc(res.entry)}" data-cat="Class Feature">${esc(res.name)}</a>
      <span class="muted small">${esc(res.cls)}</span></div>
    <div class="res-bar"><div style="width:${pct}%"></div>${segsHtml(segs(res.max))}</div>
    <span class="stepper"><button data-res-d="-1" title="Spend one" aria-label="Spend one">−</button><button data-res-d="1" title="Regain one" aria-label="Regain one">＋</button></span>
    <b class="res-val">${cur} / ${res.max}</b>
    <button class="btn small ghost" data-res-reset title="Back to the start-of-day amount (${res.start})">Reset</button>
    <div class="small muted res-note">${esc(res.note)}</div></div>`;
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

/** The Rest button at the top of the Overview. */
export function wireRest(el, c) {
  el.querySelector('[data-full-rest]')?.addEventListener('click', () => {
    const said = fullRest(c, { maxHp: state.derived.hp.max, level: state.derived.level });
    toast(said.length ? 'Rested: ' + said.join(', ') : 'Rested. Nothing needed restoring');
    changed({ rerender: true });
  });
}

/** Overview card: every class pool plus the player's own trackers. */
export function renderResources(el, c) {
  c.trackers ||= [];
  const pools = poolsFor(c);
  el.innerHTML = `<div class="row"><h3 class="grow" style="margin:0">Class resources &amp; trackers</h3>
      <button class="btn small" data-tr-new>＋ Tracker</button>
      <button class="btn small ghost" data-res-rest title="Refill every pool below for a new day (the 🌙 Rest button at the top does that and more)">New day</button></div>
    ${pools.map(r => counter(r, currentOf(r, c.resources))).join('')}
    ${c.trackers.map(custom).join('')}
    ${pools.length || c.trackers.length ? '' : '<p class="muted small">Nothing to track yet. Classes such as arcanist, barbarian, bard, magus and monk show their pools here; “＋ Tracker” adds your own counter for anything else.</p>'}`;
  wire(el, c);
}

/** A single pool inside a spell card (the arcanist's reservoir). */
export function resourceBlock(c, id) {
  const res = poolsFor(c).find(r => r.id === id);
  return res ? `<div class="res-inline">${counter(res, currentOf(res, c.resources))}</div>` : '';
}

/** Delegated click handling for any element holding counters. */
export function wire(el, c) {
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-res-d],[data-res-reset],[data-res-rest],[data-tr-new],[data-tr-d],[data-tr-reset],[data-tr-del]');
    if (!t) return;
    e.preventDefault();
    c.resources ||= {};
    c.trackers ||= [];
    if (t.dataset.trNew !== undefined) { c.trackers.push({ name: '', max: 3, cur: 3 }); return changed({ rerender: true }); }
    if (t.dataset.resRest !== undefined) {
      c.resources = {};
      for (const tr of c.trackers) tr.cur = tr.max;
      return changed({ rerender: true });
    }
    const row = t.closest('[data-res],[data-tracker]');
    if (row?.dataset.res) {
      const res = poolsFor(c).find(r => r.id === row.dataset.res);
      if (!res) return;
      if (t.dataset.resReset !== undefined) delete c.resources[res.id];
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
