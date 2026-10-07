import { api } from '../api.js';
import { state, changed, render, go, refreshCalc } from '../app.js';
import { sign, num, raceInfo, classLevels } from '../calc.js';
import {
  ABILITIES, ABILITY_NAMES, SKILL_BY_NAME, MULTI_SKILLS, RACES, ALIGNMENTS, SIZES, BONUS_TYPES, MOD_TARGETS,
  BUFF_PRESETS, SCHOOLS, CASTING_STAT_NAMES,
} from '../data.js';
import { esc, $, $$, getPath, modal, pickEntry, toast, confirmBox, debounce, textField, showCustom } from '../ui.js';
import { choosePicture, repositionPicture } from '../cropper.js';
import { classFeatures, archetypesOf } from '../features.js';
import { chooseArchetypes } from './archetypes.js';
import { summonSpell } from '../summons.js';
import { renderSummons, chooseSummon } from './summons.js';
import { renderCompanions } from './companions.js';
import { playPageTurn, snapshotPage } from '../options.js';
import { hpSegments, segsHtml } from '../bars.js';
import { playSfx } from '../sfx.js';
import { hpFx } from '../healfx.js';
import { view as petView } from '../pet/pet.js';
import { renderResources, resourceBlock, wire as wireResources } from './resources.js';

const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  skills: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  feats: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  spells: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gear: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 14h18"/>',
  companions: '<circle cx="6" cy="10" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="19" cy="10" r="1.8"/><path d="M12.5 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 3 2 1-.2 1.6-.5 2.5-.5s1.5.3 2.5.5c1.6.3 3-.4 3-2 0-2.2-2.5-5.2-5.5-5.2z"/>',
  buffs: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  bio: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
};
const icon = k => `<svg class="tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const TABS = [
  ['overview', 'Overview'], ['skills', 'Skills'], ['feats', 'Feats & Abilities'], ['spells', 'Spells'],
  ['gear', 'Gear'], ['companions', 'Companions'], ['buffs', 'Buffs & Conditions'], ['bio', 'Bio & Notes'],
];

/** Read-first text bound to a character path: click to read in full, double-click to edit. */
const tf = (path, opts = {}) => textField(path, getPath(state.char, path), opts);

// ---------- small template helpers ----------
const val = p => { const v = getPath(state.char, p); return v ?? ''; };
function inp(path, { type = 'text', cls = '', ph = '', rerender = false, title = '', list = '' } = {}) {
  const isNum = type === 'num';
  return `<input class="${cls}${isNum ? ' num' : ''}" ${isNum ? 'type="number" data-type="num"' : 'type="text"'} data-bind="${path}"
    value="${esc(val(path))}" placeholder="${esc(ph)}" ${rerender ? 'data-rerender' : ''} ${title ? `title="${esc(title)}"` : ''} ${list ? `list="${list}"` : ''}>`;
}
function chk(path, { rerender = false, title = '' } = {}) {
  return `<input type="checkbox" data-bind="${path}" ${getPath(state.char, path) ? 'checked' : ''} ${rerender ? 'data-rerender' : ''} title="${esc(title)}">`;
}
function sel(path, options, { rerender = false, cls = '' } = {}) {
  const cur = String(val(path));
  return `<select data-bind="${path}" class="${cls}" ${rerender ? 'data-rerender' : ''}>${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === cur ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('')}</select>`;
}
const calc = (key, fmt = 'plain', cls = '') => `<span class="calc ${cls}" data-calc="${key}" data-fmt="${fmt}"></span>`;
const ref = (name, cat, label) => `<a href="#" class="ref" data-entry="${esc(name)}" ${cat ? `data-cat="${esc(cat)}"` : ''}>${esc(label ?? name)}</a>`;
const refId = (id, label) => `<a href="#" class="ref" data-entry="${esc(label)}" data-entry-id="${id}">${esc(label)}</a>`;

export function renderSheet(main) {
  const c = state.char;
  const d = state.derived;
  // The tab bar stays in the page while you edit or switch tabs (only the body is redrawn), so it never flickers.
  if (!$('.tabs', main) || main.dataset.view !== 'sheet') {
    main.innerHTML = `<div class="page">
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab" data-tab="${k}">${icon(k)}${l}</button>`).join('')}
        <div class="grow"></div><span id="tabs-extra"></span>
      </div>
      <div id="tab-body"></div></div>`;
    $$('.tab', main).forEach(b => (b.onclick = () => { if (state.sheetTab !== b.dataset.tab) { const snap = snapshotPage($('#tab-body')); const back = TABS.findIndex(t => t[0] === b.dataset.tab) < TABS.findIndex(t => t[0] === state.sheetTab); state.turn = snap && { snap, back }; state.sheetTab = b.dataset.tab; render(); petView('tab-' + b.dataset.tab); } }));
  }
  $$('.tab', main).forEach(b => b.classList.toggle('active', b.dataset.tab === state.sheetTab));
  $('#tabs-extra', main).innerHTML = d.level === 0 ? '<button class="btn primary" data-goto-levelup>Choose 1st level class →</button>' : '';
  const lu = $('[data-goto-levelup]', main);
  if (lu) lu.onclick = () => go('levelup');
  const fresh = document.createElement('div');
  fresh.id = 'tab-body';
  $('#tab-body', main).replaceWith(fresh);
  const turn = state.turn;
  state.turn = false;
  const body = $('#tab-body', main);
  ({ overview, skills, feats, spells, gear, companions: renderCompanions, buffs, bio })[state.sheetTab](body, c, d);
  if (turn) playPageTurn(body, turn.snap, turn.back);
}

// =====================================================================
// OVERVIEW
// =====================================================================
function overview(body, c, d) {
  const activeMods = c.modifiers.filter(m => m.active);
  body.innerHTML = `
  <div class="buff-strip">
    <span class="muted small">Active:</span>
    ${activeMods.length ? activeMods.map((m, i) => `<span class="chip on" data-toggle-mod="${c.modifiers.indexOf(m)}" title="Click to turn off">${esc(m.name)} ✕</span>`).join('') : '<span class="muted small">no buffs or conditions</span>'}
    <button class="btn small ghost" data-quick-buff>＋ Buff / condition</button>
  </div>
  <div class="grid overview-grid">
    <section class="card hp has-portrait">
      <div class="hp-main">
      <h3>Hit Points</h3>
      <div class="hp-big"><span class="calc" data-calc="hp.current"></span><span class="muted"> / </span>${calc('hp.max')}</div>
      <div class="hp-bar"><div id="hp-fill"></div>${segsHtml(hpSegments(d.hp.max))}</div>
      <div class="row">
        <input id="hp-amt" type="number" class="num w4" placeholder="0" min="0">
        <button class="btn danger" data-hp="dmg">Damage</button>
        <button class="btn good" data-hp="heal">Heal</button>
        <button class="btn" data-hp="full" title="Heal to full hit points"><span class="heart">♥</span> Full heal</button>
      </div>
      <div class="kv">
        <label>Current ${inp('hp.current', { type: 'num', cls: 'w4', ph: 'max' })}</label>
        <label>Temp ${inp('hp.temp', { type: 'num', cls: 'w3' })}</label>
        <label>Nonlethal ${inp('hp.nonlethal', { type: 'num', cls: 'w3' })}</label>
        <label title="Toughness, items, etc.">Max adj. ${inp('hp.misc', { type: 'num', cls: 'w3' })}</label>
      </div>
      <p class="small muted" id="hp-status"></p>
      </div>
      ${c.portrait ? `<div class="portrait-frame"><img src="${c.portrait}" alt="Character portrait">
        <div class="portrait-tools"><button class="icon-btn" data-img="portrait" title="Change portrait">✎</button><button class="icon-btn" data-img-edit="portrait" title="Recenter or resize">⤢</button><button class="icon-btn" data-img-clear="portrait" title="Remove portrait">✕</button></div></div>` : `<button class="portrait-frame empty" data-img="portrait" title="Add a portrait of your character">＋ Add a portrait</button>`}
    </section>

    <section class="card abilities">
      <h3>Ability Scores</h3>
      <table class="tbl">
        <thead><tr><th></th><th title="Base score (point buy / rolled)">Base</th><th title="Racial">Race</th><th title="Level-up increases">Lvl</th>
          <th title="Enhancement bonus (belts, headbands)">Enh</th><th title="Other / temporary adjustments">Misc</th>
          <th title="Ability damage">Dmg</th><th title="Ability drain">Drain</th><th>Score</th><th>Mod</th></tr></thead>
        <tbody>${ABILITIES.map(a => `<tr>
          <th><a href="#" class="ref" data-entry="${ABILITY_NAMES[a]}" data-cat="Rules">${a.toUpperCase()}</a></th>
          <td>${inp(`abilities.${a}.base`, { type: 'num', cls: 'w3' })}</td>
          <td>${calc(`abilities.${a}.racial`, 'sign', 'dim')}</td>
          <td>${calc(`abilities.${a}.increase`, 'plain', 'dim')}</td>
          <td>${inp(`abilities.${a}.enh`, { type: 'num', cls: 'w3' })}</td>
          <td>${inp(`abilities.${a}.misc`, { type: 'num', cls: 'w3' })}</td>
          <td>${inp(`abilities.${a}.damage`, { type: 'num', cls: 'w3' })}</td>
          <td>${inp(`abilities.${a}.drain`, { type: 'num', cls: 'w3' })}</td>
          <td class="big">${calc(`abilities.${a}.score`)}</td>
          <td class="big accent">${calc(`abilities.${a}.mod`, 'sign')}</td></tr>`).join('')}</tbody>
      </table>
      <div class="row small muted"><span>Point buy: <b id="pointbuy"></b></span><span class="grow"></span><span>Buffs to ability scores are applied automatically.</span></div>
    </section>

    <section class="card defense">
      <h3>Defense</h3>
      <div class="stat-row">
        <div class="stat"><div class="label">${ref('Armor Class', 'Rules', 'AC')}</div>${calc('ac.total', 'plain', 'big')}</div>
        <div class="stat"><div class="label">${ref('Touch Attacks', 'Rules', 'Touch')}</div>${calc('ac.touch', 'plain', 'big')}</div>
        <div class="stat"><div class="label">${ref('Flat-Footed', 'Rules', 'Flat-footed')}</div>${calc('ac.flat', 'plain', 'big')}</div>
        <div class="stat"><div class="label">${ref('Combat Maneuver Defense', 'Rules', 'CMD')}</div>${calc('cmd', 'plain', 'big')}</div>
      </div>
      <div class="small muted" id="ac-breakdown"></div>
      <div class="kv">
        <label title="Natural armor bonus">Natural ${inp('ac.natural', { type: 'num', cls: 'w3' })}</label>
        <label title="Deflection bonus (ring of protection)">Deflect ${inp('ac.deflection', { type: 'num', cls: 'w3' })}</label>
        <label title="Dodge bonus (Dodge feat)">Dodge ${inp('ac.dodge', { type: 'num', cls: 'w3' })}</label>
        <label title="Other untyped">Misc ${inp('ac.misc', { type: 'num', cls: 'w3' })}</label>
      </div>
      <table class="tbl saves"><thead><tr><th>Save</th><th>Total</th><th>Base</th><th>Ability</th><th>Buffs</th><th>Misc</th></tr></thead><tbody>
        ${[['fort', 'Fortitude'], ['ref', 'Reflex'], ['will', 'Will']].map(([s, n]) => `<tr>
          <th>${ref(n + ' Saves', 'Rules', n)}</th><td class="big accent">${calc(`saves.${s}.total`, 'sign')}</td>
          <td>${calc(`saves.${s}.base`, 'sign', 'dim')}</td><td>${calc(`saves.${s}.ability`, 'sign', 'dim')}</td>
          <td>${calc(`saves.${s}.bonus`, 'sign', 'dim')}</td><td>${inp(`saveMisc.${s}`, { type: 'num', cls: 'w3' })}</td></tr>`).join('')}
      </tbody></table>
      <div class="kv wide">
        <label>DR ${inp('defenses.dr', { cls: 'w8' })}</label><label>SR ${inp('defenses.sr', { cls: 'w4' })}</label>
        <label>Resist ${inp('defenses.resist', { cls: 'w8' })}</label><label>Immune ${inp('defenses.immune', { cls: 'w8' })}</label>
      </div>
    </section>

    <section class="card offense">
      <h3>Offense</h3>
      <div class="stat-row">
        <div class="stat"><div class="label">${ref('Initiative', 'Rules')}</div>${calc('init', 'sign', 'big')}</div>
        <div class="stat"><div class="label">${ref('Base Attack Bonus', 'Rules', 'BAB')}</div><span class="big" id="bab-text"></span></div>
        <div class="stat"><div class="label">Melee</div>${calc('melee', 'sign', 'big')}</div>
        <div class="stat"><div class="label">Ranged</div>${calc('ranged', 'sign', 'big')}</div>
        <div class="stat"><div class="label">${ref('Combat Maneuver Bonus', 'Rules', 'CMB')}</div>${calc('cmb', 'sign', 'big')}</div>
        <div class="stat"><div class="label">Speed</div><span class="big">${calc('speed')}<small> ft</small></span></div>
      </div>
      <div class="kv">
        <label>Init misc ${inp('initMisc', { type: 'num', cls: 'w3' })}</label>
        <label>CMB misc ${inp('cmbMisc', { type: 'num', cls: 'w3' })}</label>
        <label>CMD misc ${inp('cmdMisc', { type: 'num', cls: 'w3' })}</label>
        <label>Speed misc ${inp('speedMisc', { type: 'num', cls: 'w3' })}</label>
      </div>
      <div class="small muted">Flat-footed CMD ${calc('cmdFlat')} · Size ${esc(d.size)} · ${ref('Attacks of Opportunity', 'Rules', 'AoO rules')} · ${ref('Combat Maneuvers', 'Rules', 'Maneuvers')}</div>
    </section>

    <section class="card weapons span2">
      <div class="row"><h3 class="grow">Weapons & Attacks</h3><button class="btn small" data-add="weapons">＋ Add weapon</button></div>
      ${c.weapons.length ? `<table class="tbl weapons-tbl"><thead><tr><th>Weapon</th><th>Attack</th><th>Damage</th><th>Crit</th>
        <th title="Ability for attack roll">Atk stat</th><th title="Ranged weapon">Rng</th><th title="Enhancement bonus">Enh</th>
        <th title="Misc attack bonus (masterwork +1, Weapon Focus, etc.)">Atk+</th><th>Dice</th><th title="Strength to damage">Str dmg</th><th title="Misc damage">Dmg+</th>
        <th>Range</th><th>Type</th><th></th></tr></thead><tbody>
        ${c.weapons.map((w, i) => `<tr>
          <td class="w10">${tf(`weapons.${i}.name`, { placeholder: 'Name (double-click)' })}</td>
          <td class="big accent nowrap">${calc(`weapons.${i}.attackText`)}</td>
          <td class="big nowrap">${calc(`weapons.${i}.damageText`)}</td>
          <td>${inp(`weapons.${i}.crit`, { cls: 'w5', ph: '19-20/x2' })}</td>
          <td>${sel(`weapons.${i}.ability`, [['', 'auto'], ['str', 'Str'], ['dex', 'Dex']])}</td>
          <td>${chk(`weapons.${i}.ranged`)}</td>
          <td>${inp(`weapons.${i}.enh`, { type: 'num', cls: 'w2' })}</td>
          <td>${inp(`weapons.${i}.misc`, { type: 'num', cls: 'w2' })}</td>
          <td>${inp(`weapons.${i}.damage`, { cls: 'w4', ph: '1d8' })}</td>
          <td>${sel(`weapons.${i}.dmgMult`, [['', 'auto'], ['1', '×1'], ['1.5', '×1½ (2H)'], ['0.5', '×½ (off)'], ['0', 'none']])}</td>
          <td>${inp(`weapons.${i}.dmgMisc`, { type: 'num', cls: 'w2' })}</td>
          <td>${inp(`weapons.${i}.range`, { cls: 'w4' })}</td>
          <td>${inp(`weapons.${i}.type`, { cls: 'w3', ph: 'S' })}</td>
          <td><button class="icon-btn" data-del="weapons.${i}" title="Remove">✕</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No weapons yet. Add one to see its attack and damage calculated.</p>'}
      <p class="small muted">Full attack uses BAB iteratives (${d.iteratives.map(sign).join('/')}). Buffs such as Power Attack, Haste, and Bless apply automatically. ${ref('Two-Weapon Fighting', 'Rules')} · ${ref('Critical Hits', 'Rules')}</p>
    </section>

    <section class="card span2" id="res-card"></section>

    <section class="card span2 quick-notes">
      <h3>Notes</h3>
      <textarea class="full" data-bind="quickNotes" rows="5" placeholder="Session notes, reminders, anything you want to see at a glance…">${esc(c.quickNotes || '')}</textarea>
    </section>
  </div>`;
  wireCommon(body);
  wireImages(body, c);
  renderResources($('#res-card', body), c);

  const updateDyn = () => {
    const dd = state.derived;
    const pb = ABILITIES.reduce((s, a) => s + (POINTS[num(c.abilities[a].base)] ?? NaN), 0);
    $('#pointbuy').textContent = isNaN(pb) ? 'n/a (scores outside 7–18)' : pb;
    $('#bab-text').textContent = dd.iteratives.map(sign).join('/');
    const pct = Math.max(0, Math.min(100, dd.hp.current / Math.max(1, dd.hp.max) * 100));
    $('#hp-fill').style.width = pct + '%';
    const segs = $('.segs', $('#hp-fill').parentElement), want = hpSegments(dd.hp.max);
    if (segs.children.length !== want) segs.innerHTML = '<i></i>'.repeat(want);
    $('#hp-fill').className = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
    const cur = dd.hp.current, nl = num(c.hp.nonlethal);
    const conScore = dd.abilities.con.score;
    const left = cur + conScore; // damage still needed to reach -Con
    $('#hp-status').innerHTML = cur <= -conScore ? `<b class="bad">Dead</b> (HP at or below −${conScore}, your Con score)`
      : cur < 0 ? `<b class="bad">Dying</b>: DC 10 Con check each round to stabilize (penalty ${cur}). <b>Dead at −${conScore} HP</b>, ${left} more damage. ${ref('Dying', 'Rules', 'Dying rules')}`
        : cur === 0 ? `<b class="warn">Disabled</b>: staggered; strenuous action deals 1 damage. Dying below 0, dead at −${conScore} HP. ${ref('Disabled', 'Condition', 'Disabled')}`
          : nl >= cur ? `<b class="warn">${nl > cur ? 'Unconscious' : 'Staggered'}</b> from nonlethal damage.` : '';
    const card = $('.card.hp', body);
    card.classList.toggle('dead', cur <= -conScore);
    card.classList.toggle('downed', cur <= 0 && cur > -conScore);
    const t = dd.ac.byType;
    $('#ac-breakdown').textContent = 'AC = 10 ' + [['Dex', dd.ac.dex], ['size', dd.ac.size], ...Object.entries(t)].filter(([, v]) => v).map(([k, v]) => `${v >= 0 ? '+' : '−'} ${Math.abs(v)} ${k}`).join(' ') +
      (dd.maxDex != null ? ` · max Dex ${dd.maxDex}` : '') + (dd.acp ? ` · ACP ${dd.acp}` : '');
  };
  updateDyn();
  if (state.healFx) { hpFx($('.card.hp', body), state.healFx); state.healFx = null; }
  document.addEventListener('recalc', updateDyn);
  onLeave(() => document.removeEventListener('recalc', updateDyn));

  $$('[data-hp]', body).forEach(b => (b.onclick = async () => {
    const amt = Math.abs(num($('#hp-amt').value));
    const dd = state.derived;
    let cur = dd.hp.current;
    if (b.dataset.hp === 'full') {
      if (!await confirmBox('Heal to full hit points?', 'Heal fully')) return;
      const healed = Math.max(0, dd.hp.max - cur);
      state.healFx = { amount: healed, frac: Math.max(0.6, healed / Math.max(1, dd.hp.max)), from: cur / Math.max(1, dd.hp.max) };
      playSfx('fullHeal');
      c.hp.current = null; c.hp.nonlethal = 0; changed({ rerender: true }); return; }
    if (!amt) return;
    if (b.dataset.hp === 'dmg') {
      let rest = amt;
      const temp = num(c.hp.temp);
      if (temp) { const used = Math.min(temp, rest); c.hp.temp = temp - used; rest -= used; }
      cur -= rest;
      if (cur < dd.hp.current) {
        state.healFx = { kind: 'hurt', amount: dd.hp.current - cur, frac: (dd.hp.current - cur) / Math.max(1, dd.hp.max), from: dd.hp.current / Math.max(1, dd.hp.max) };
        playSfx('hit');
      }
    } else {
      const before = cur;
      cur = Math.min(dd.hp.max, cur + amt);
      if (cur > before) playSfx('heal');
      if (cur > before) state.healFx = { amount: cur - before, frac: (cur - before) / Math.max(1, dd.hp.max), from: before / Math.max(1, dd.hp.max) };
      c.hp.nonlethal = Math.max(0, num(c.hp.nonlethal) - amt);
    }
    c.hp.current = cur >= dd.hp.max ? null : cur;
    $('#hp-amt').value = '';
    changed({ rerender: true });
  }));
}

const IMG_OPTS = { avatar: { w: 1, h: 1, out: 256 }, portrait: { w: 3, h: 4, out: 800 } };
function wireImages(body, c) {
  $$('[data-img]', body).forEach(b => (b.onclick = async () => {
    const kind = b.dataset.img;
    const r = await choosePicture(IMG_OPTS[kind]);
    if (r) { c[kind] = r.image; c[kind + 'Src'] = r.src; changed({ rerender: true }); }
  }));
  $$('[data-img-edit]', body).forEach(b => (b.onclick = async () => {
    const kind = b.dataset.imgEdit;
    const r = await repositionPicture(c[kind + 'Src'] || c[kind], IMG_OPTS[kind]);
    if (r) { c[kind] = r.image; changed({ rerender: true }); }
  }));
  $$('[data-img-clear]', body).forEach(b => (b.onclick = () => { c[b.dataset.imgClear] = ''; c[b.dataset.imgClear + 'Src'] = ''; changed({ rerender: true }); }));
}

const POINTS = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 };

// Cleanup hooks for listeners that live on document
let leaveHooks = [];
function onLeave(fn) { leaveHooks.push(fn); }
document.addEventListener('view-leave', () => { leaveHooks.forEach(f => f()); leaveHooks = []; });

// Shared click handling for add/delete/toggle buttons in every tab.
function wireCommon(body) {
  body.addEventListener('click', async e => {
    const c = state.char;
    const t = e.target.closest('[data-add],[data-del],[data-toggle-mod],[data-quick-buff],[data-move]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.add) {
      const blank = {
        weapons: { name: '', ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgMult: '', dmgMisc: 0, crit: '×2', range: '', type: '', weight: 0 },
        armor: { name: '', type: 'armor', category: 'light', bonus: 0, enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true },
        gear: { name: '', qty: 1, weight: 0, value: '', notes: '' },
        specials: { name: '', notes: '' },
        'money.custom': { name: '', amount: 0 },
      }[t.dataset.add];
      getPath(c, t.dataset.add).push(structuredClone(blank));
      changed({ rerender: true });
    } else if (t.dataset.del) {
      const parts = t.dataset.del.split('.');
      const idx = +parts.pop();
      const list = getPath(c, parts.join('.'));
      const item = list[idx] || {};
      // A row you just added and never filled in goes without asking; anything with content asks first.
      const touched = item.name || item.notes || item.sub || num(item.ranks) || num(item.misc);
      if (touched) {
        const what = item.name ? `“${item.name}”` : 'this entry';
        if (!await confirmBox(`Remove ${what}?`, 'Remove')) return;
      }
      list.splice(idx, 1);
      changed({ rerender: true });
    } else if (t.dataset.toggleMod) {
      const m = c.modifiers[+t.dataset.toggleMod];
      m.active = !m.active;
      changed({ rerender: true });
    } else if (t.dataset.quickBuff !== undefined) {
      const preset = await chooseBuffPreset();
      if (preset) { addPreset(preset); changed({ rerender: true }); }
    }
  });
}

function addPreset(p) {
  const c = state.char;
  const existing = c.modifiers.find(m => m.name === p.name);
  if (existing) { existing.active = true; return; }
  c.modifiers.push({ name: p.name, active: true, note: p.note || '', effects: structuredClone(p.effects) });
}

function chooseBuffPreset() {
  return modal('Add buff or condition', (body, close) => {
    const groups = [...new Set(BUFF_PRESETS.map(p => p.group))];
    body.innerHTML = groups.map(g => `<h4>${esc(g)}</h4><div class="chips">${BUFF_PRESETS.filter(p => p.group === g)
      .map(p => `<button class="chip" data-name="${esc(p.name)}" title="${esc(p.note || '')}">${esc(p.name)}</button>`).join('')}</div>`).join('') +
      '<p class="small muted">Need something else? Use the Buffs & Conditions tab to build a custom modifier.</p>';
    body.onclick = e => { const b = e.target.closest('[data-name]'); if (b) close(BUFF_PRESETS.find(p => p.name === b.dataset.name)); };
  });
}

// =====================================================================
// SKILLS
// =====================================================================
function skills(body, c, d) {
  const sp = d.skillPoints;
  body.innerHTML = `<section class="card">
    <div class="row">
      <h3 class="grow">Skills</h3>
      <span class="pill ${sp.spent > sp.available ? 'bad' : sp.spent < sp.available ? 'warn' : 'good'}">Ranks spent <b>${sp.spent}</b> / ${sp.available}</span>
      <span class="pill">Max ranks per skill: <b>${sp.maxRanks}</b></span>
      ${d.acp ? `<span class="pill bad">Armor check penalty ${d.acp}</span>` : ''}
      <label class="small"><input type="checkbox" id="only-trained"> Hide untrained-only skills with 0 ranks</label>
    </div>
    <table class="tbl skills-tbl"><thead><tr><th title="Class skill">CS</th><th>Skill</th><th>Ability</th><th>Total</th><th>Ranks</th><th>Misc</th><th></th></tr></thead>
    <tbody>${c.skills.map((s, i) => {
      const key = s.sub ? `${s.name} (${s.sub})` : s.name;
      const sd = d.skills[key] || {};
      const def = SKILL_BY_NAME[s.name] || {};
      const multi = MULTI_SKILLS.includes(s.name);
      return `<tr class="${sd.untrainedBlocked ? 'untrained' : ''}" data-skill-row>
        <td>${sd.isClass && !s.classSkill ? '<span class="cs-dot" title="Class skill"></span>' : chk(`skills.${i}.classSkill`, { title: 'Mark as class skill (traits, etc.)' })}</td>
        <td>${ref(s.name.startsWith('Knowledge') ? 'Knowledge' : s.name, 'Skill', s.name)}${def.trained ? '<sup title="Trained only">T</sup>' : ''}${def.acp ? '<sup title="Armor check penalty applies">A</sup>' : ''}
          ${multi ? inp(`skills.${i}.sub`, { cls: 'w8 sub', ph: 'type', rerender: true }) : ''}</td>
        <td class="dim">${(def.ability || '').toUpperCase()}</td>
        <td class="big accent">${sd.untrainedBlocked ? '<span class="dim" title="Trained only">—</span>' : `<span data-calc="skills.${esc(key)}.total" data-fmt="sign"></span>`}</td>
        <td>${inp(`skills.${i}.ranks`, { type: 'num', cls: 'w3' + (sd.overMax ? ' bad' : ''), rerender: true })}</td>
        <td>${inp(`skills.${i}.misc`, { type: 'num', cls: 'w3', title: 'Racial, trait, item, feat bonuses' })}</td>
        <td>${multi ? `<button class="icon-btn" data-dup-skill="${i}" title="Add another ${s.name}">＋</button>` : ''}
            ${multi && c.skills.filter(x => x.name === s.name).length > 1 ? `<button class="icon-btn" data-del="skills.${i}" title="Remove">✕</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table>
    <p class="small muted">Class skills get +3 once they have at least 1 rank. Skill ranks per level = class ranks + Int modifier (min 1)${d.race.bonusSkill ? ' + 1 (human)' : ''}, plus favored-class choices. Size modifies Fly and Stealth automatically.</p>
  </section>`;
  wireCommon(body);
  $('#only-trained').onchange = e => $$('tr.untrained', body).forEach(r => (r.style.display = e.target.checked ? 'none' : ''));
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-dup-skill]');
    if (!b) return;
    const i = +b.dataset.dupSkill;
    c.skills.splice(i + 1, 0, { name: c.skills[i].name, sub: '', ranks: 0, misc: 0, classSkill: false });
    changed({ rerender: true });
  });
}

// =====================================================================
// FEATS & ABILITIES
// =====================================================================
export const featureLookupName = f => f.replace(/\s*[+−-]?\d+d\d+.*$/, '').replace(/\s*\(.*?\)/g, '').replace(/\s*[+−-]?\d+(\/day)?.*$/, '').replace(/\s+\d+(st|nd|rd|th).*$/, '').trim();

function feats(body, c, d) {
  const lv = classLevels(c);
  const features = classFeatures(c, state.classesByName);
  const KIND = { feats: 'Custom feat', traits: 'Custom trait', specials: 'Custom ability' };
  const listBlock = (key, title, cat, pickTitle) => `
    <section class="card">
      <div class="row"><h3 class="grow">${title}</h3>
        ${key === 'feats' ? `<span class="pill ${c.feats.length > d.featSlots ? 'warn' : ''}">${c.feats.length} taken · ${d.featSlots} from levels${d.race.bonusFeat ? ' (incl. human bonus)' : ''} + class bonus feats</span>` : ''}
        <button class="btn small" data-pick="${key}" data-cat="${cat}" data-title="${esc(pickTitle)}">＋ Add from compendium</button>
        <button class="btn small ghost" data-custom="${key}">＋ Custom</button></div>
      ${c[key].length ? `<table class="tbl"><tbody>${c[key].map((f, i) => `<tr>
        <td class="nowrap w12">${f.id ? refId(f.id, f.name)
          : tf(`${key}.${i}.name`, { placeholder: 'Name', read: { title: f.name || 'Untitled', titlePath: `${key}.${i}.name`, cat: KIND[key], path: `${key}.${i}.notes` } })}</td>
        <td class="muted small">${esc(f.sub || '')}${f.level ? ` · L${f.level}` : ''}</td>
        <td class="grow-cell">${tf(`${key}.${i}.notes`, { multiline: true, placeholder: f.id ? 'Add notes' : 'Add a description',
          read: { title: f.name || 'Notes', titlePath: `${key}.${i}.name`, cat: f.id ? 'Your notes' : KIND[key] } })}</td>
        <td><button class="icon-btn" data-del="${key}.${i}">✕</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">None yet.</p>'}
    </section>`;
  body.innerHTML = `<div class="grid two">
    <div>${listBlock('feats', 'Feats', 'Feat', 'Add feat')}${listBlock('traits', 'Traits', 'Trait', 'Add trait')}</div>
    <div>
      <section class="card">
        <h3>Class Features <span class="muted small">(from your class levels and archetypes; click to read)</span></h3>
        ${features.length ? `<ul class="features">${features.map((f, i) => `<li><span class="lvl">${esc(f.cls)} ${f.level}</span>${f.kind === 'archetype'
          ? `<a href="#" class="ref" data-feature="${i}">${esc(f.name)}</a><span class="arch-badge" title="${esc(f.replaces.length ? 'Replaces ' + f.replaces.join(', ') : f.archetype)}">${esc(f.archetype)}</span>`
          : `${ref(featureLookupName(f.name), '', f.name)}${f.modified ? ` <span class="mod" title="Changed by your archetype">✱</span>` : ''}`}</li>`).join('')}</ul>`
          : '<p class="muted">Take a level to see class features.</p>'}
      </section>
      ${listBlock('specials', 'Special Abilities & Racial Traits', 'Racial Trait', 'Add racial trait / ability')}
      <section class="card"><h3>Archetypes</h3>
        ${Object.keys(lv).map(cls => {
          const archs = archetypesOf(c, cls);
          return `<div class="kv-line"><b class="w8">${esc(cls)}</b>
            <span class="grow">${archs.length ? archs.map(a => a.id ? refId(a.id, a.name) : `${esc(a.name)} <span class="small warn" title="Open the chooser to link it to the compendium">(not linked)</span>`).join(', ') : '<span class="muted">Standard class</span>'}</span>
            <button class="btn small ghost" data-arch="${esc(cls)}">${archs.length ? 'Change' : 'Choose'}</button></div>`;
        }).join('') || '<p class="muted">No classes yet.</p>'}
        <p class="small muted">Archetype features replace the class features they say they replace, and their class-skill and spellcasting changes apply automatically.</p>
      </section>
    </div></div>`;
  wireCommon(body);
  body.addEventListener('click', async e => {
    const p = e.target.closest('[data-pick]');
    const cu = e.target.closest('[data-custom]');
    const ar = e.target.closest('[data-arch]');
    if (p) {
      const r = await pickEntry(p.dataset.title, p.dataset.cat, { renderRow: r => r.summary || r.source });
      if (r) { c[p.dataset.pick].push({ id: r.id, name: r.name, sub: r.sub, notes: '', level: d.level }); changed({ rerender: true }); }
    } else if (cu) {
      c[cu.dataset.custom].push({ name: '', notes: '' });
      changed({ rerender: true });
    } else if (ar) {
      const cls = ar.dataset.arch;
      const picked = await chooseArchetypes(cls, archetypesOf(c, cls));
      if (picked) { c.archetypes[cls] = picked; changed({ rerender: true }); }
    } else if (e.target.closest('[data-feature]')) {
      e.preventDefault();
      const f = features[+e.target.closest('[data-feature]').dataset.feature];
      showCustom({ name: f.name, cat: 'Archetype feature', sub: `${f.archetype} · ${f.cls} ${f.level}`,
        html: (f.replaces.length ? `<p class="field"><b>Replaces:</b> ${esc(f.replaces.join(', '))}</p>` : '')
          + (f.unmatched?.length ? `<p class="field"><b>Also replaces:</b> ${esc(f.unmatched.join(', '))}</p>` : '') + f.html });
    }
  });
}

// =====================================================================
// SPELLS
// =====================================================================
const ORD = ['0', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function spells(body, c, d) {
  const casters = Object.entries(d.spellcasting);
  if (!casters.length) {
    body.innerHTML = `<section class="card"><h3>Spells</h3><p class="muted">None of your classes cast spells (yet). Paladins and rangers start casting at 4th level.</p>
      <p>Looking something up? Try the ${'<a href="#" data-goto="compendium">Compendium</a>'} or ${'<a href="#" data-goto="rules">Quick Rules</a>'}.</p></section>`;
    $$('[data-goto]', body).forEach(a => (a.onclick = e => { e.preventDefault(); go(a.dataset.goto); }));
    return;
  }
  body.innerHTML = casters.map(([cls, sc]) => {
    const book = (c.spellbooks[cls] ||= { spells: [], used: Array(10).fill(0), extraSlot: false });
    book.used ||= Array(10).fill(0);
    const prepared = sc.kind === 'prepared' || sc.kind === 'arcanist';
    const spont = sc.kind === 'spontaneous' || sc.kind === 'arcanist';
    // Show spell levels the character can cast now, plus any level that already has spells listed.
    const levels = [];
    for (let sl = 0; sl <= sc.maxLevel; sl++) {
      if (sc.slots[sl] != null || sc.known[sl] != null || book.spells.some(s => s.level === sl)) levels.push(sl);
    }
    if (!levels.length) levels.push(sc.kind === 'spontaneous' ? 1 : 0);
    return `<section class="card spellbook" data-cls="${esc(cls)}">
      <div class="row">
        <h3 class="grow">${esc(cls)} ${sc.extracts ? 'Extracts' : 'Spells'} <span class="muted small">${esc(sc.kind)} · ${CASTING_STAT_NAMES[sc.stat]}</span></h3>
        <span class="pill">Caster level <b>${sc.cl}</b></span>
        <span class="pill" title="d20 + caster level + ${sc.stat.toUpperCase()} modifier">${ref('Concentration', 'Rules')} <b>${sign(sc.concentration)}</b></span>
        ${d.asf && ['Wizard', 'Sorcerer', 'Witch', 'Magus', 'Arcanist', 'Bard', 'Summoner', 'Skald', 'Bloodrager'].includes(cls) ? `<span class="pill warn" title="Arcane spell failure from armor">ASF ${d.asf}%</span>` : ''}
        ${sc.hasExtraSlot ? `<label class="small" title="Cleric/druid domain, wizard specialist school, or shaman spirit slot">${chk(`spellbooks.${cls}.extraSlot`, { rerender: true })} Domain / school slot</label>` : ''}
        <button class="btn small" data-rest="${esc(cls)}" title="Reset all used slots">Rest (reset)</button>
      </div>
      ${cls === 'Arcanist' ? resourceBlock(c, 'arcane-reservoir') : ''}
      <table class="tbl slot-tbl"><thead><tr><th>Level</th>${levels.map(l => `<th>${ORD[l]}</th>`).join('')}</tr></thead><tbody>
        <tr><th>${spont ? 'Per day' : 'Slots'}</th>${levels.map(l => `<td><b>${fmtSlots(sc.slots[l])}</b></td>`).join('')}</tr>
        ${sc.known.some(k => k != null) ? `<tr><th>Known</th>${levels.map(l => `<td>${knownCount(book, l)} / ${sc.known[l] ?? '—'}</td>`).join('')}</tr>` : ''}
        ${sc.kind === 'arcanist' ? `<tr><th>Prepared</th>${levels.map(l => `<td>${preparedCount(book, l)} / ${sc.prepared[l] ?? '—'}</td>`).join('')}</tr>` : ''}
        ${spont ? `<tr><th>Used</th>${levels.map(l => l === 0 && sc.slots[0] === Infinity ? '<td class="dim">at will</td>' : `<td>${inp(`spellbooks.${cls}.used.${l}`, { type: 'num', cls: 'w2', rerender: true })}</td>`).join('')}</tr>` : ''}
        <tr><th>Save DC</th>${levels.map(l => `<td>${sc.dcs[l]}</td>`).join('')}</tr>
        <tr><th title="Concentration DC to cast defensively: 15 + 2 × spell level">${ref('Casting Defensively', 'Rules', 'Defensive DC')}</th>${levels.map(l => `<td title="Need ${15 + 2 * l - sc.concentration} or higher on d20">${15 + 2 * l}<span class="dim small"> (${Math.max(1, Math.min(20, 15 + 2 * l - sc.concentration))}+)</span></td>`).join('')}</tr>
      </tbody></table>
      ${levels.map(l => {
        const list = book.spells.map((s, i) => ({ ...s, i })).filter(s => s.level === l);
        return `<div class="spell-level">
          <div class="row"><h4 class="grow">${l === 0 ? (sc.extracts ? 'Level 0' : 'Cantrips / Orisons') : ORD[l] + ' level'}</h4>
            <button class="btn small ghost" data-add-spell="${l}">＋ Add</button>
            <button class="btn small ghost" data-custom-spell="${l}" title="A spell that isn't in the compendium">＋ Custom</button></div>
          ${list.length ? `<table class="tbl spell-tbl"><tbody>${list.map(s => `<tr>
            <td class="nowrap">${s.id ? refId(s.id, s.name)
              : tf(`spellbooks.${cls}.spells.${s.i}.name`, { placeholder: 'Spell name', read: { title: s.name, titlePath: `spellbooks.${cls}.spells.${s.i}.name`, cat: 'Custom spell', path: `spellbooks.${cls}.spells.${s.i}.notes` } })}</td>
            <td class="muted small">${esc(s.school || '')}</td>
            <td class="nowrap summon-cell">${summonSpell(s.name) ? `<button class="btn small" data-summon="${esc(s.name)}" data-summon-cls="${esc(cls)}" title="Choose a creature; it is added to Buffs &amp; Conditions → Summons">Summon…</button>` : ''}</td>
            <td class="muted small summary">${s.id ? esc(s.summary || '') : tf(`spellbooks.${cls}.spells.${s.i}.notes`, { multiline: true, placeholder: 'Add a description', read: { title: s.name, titlePath: `spellbooks.${cls}.spells.${s.i}.name`, cat: 'Custom spell' } })}</td>
            ${prepared && !(l === 0 && sc.kind !== 'arcanist' && false) ? `<td class="nowrap small">Prep ${inp(`spellbooks.${cls}.spells.${s.i}.prepared`, { type: 'num', cls: 'w2', rerender: true })}</td>` : ''}
            ${sc.kind === 'prepared' && l > 0 ? `<td class="nowrap"><button class="btn small" data-cast="${s.i}" ${num(s.cast) >= num(s.prepared) ? 'disabled' : ''}>Cast</button>
              <span class="small dim">${num(s.cast)}/${num(s.prepared)}</span></td>` : ''}
            ${spont && l > 0 ? `<td><button class="btn small" data-cast-spont="${l}">Cast</button></td>` : ''}
            <td><button class="icon-btn" data-del="spellbooks.${cls}.spells.${s.i}">✕</button></td></tr>`).join('')}</tbody></table>`
            : '<p class="muted small">None.</p>'}
          ${sc.kind === 'prepared' && sc.slots[l] != null && sc.slots[l] !== Infinity ? `<div class="small ${preparedCount(book, l) > sc.slots[l] ? 'bad' : 'muted'}">Prepared ${preparedCount(book, l)} of ${sc.slots[l]} slots</div>` : ''}
        </div>`;
      }).join('')}
    </section>`;
  }).join('');
  wireCommon(body);
  wireResources(body, c);
  body.addEventListener('click', async e => {
    const sbEl = e.target.closest('[data-cls]');
    if (!sbEl) return;
    const cls = sbEl.dataset.cls;
    const book = c.spellbooks[cls];
    const sc = d.spellcasting[cls];
    const t = e.target.closest('[data-add-spell],[data-custom-spell],[data-cast],[data-cast-spont],[data-rest]');
    if (!t) return;
    if (t.dataset.customSpell !== undefined) {
      book.spells.push({ name: '', level: +t.dataset.customSpell, school: '', notes: '', prepared: 0, cast: 0 });
      changed({ rerender: true });
      return;
    }
    if (t.dataset.addSpell !== undefined) {
      const picked = await pickSpell(cls, sc, +t.dataset.addSpell);
      if (picked) {
        book.spells.push({ id: picked.id, name: picked.name, level: +t.dataset.addSpell, school: picked.school, summary: picked.summary, prepared: 0, cast: 0 });
        changed({ rerender: true });
      }
    } else if (t.dataset.cast !== undefined) {
      const s = book.spells[+t.dataset.cast];
      s.cast = num(s.cast) + 1;
      changed({ rerender: true });
    } else if (t.dataset.castSpont !== undefined) {
      const l = +t.dataset.castSpont;
      if (num(book.used[l]) >= sc.slots[l]) { toast(`No ${ORD[l]}-level slots left`, 'err'); return; }
      book.used[l] = num(book.used[l]) + 1;
      changed({ rerender: true });
    } else if (t.dataset.rest !== undefined) {
      book.used = Array(10).fill(0);
      for (const s of book.spells) s.cast = 0;
      if (cls === 'Arcanist' && c.resources) delete c.resources['arcane-reservoir'];
      toast('Spell slots reset');
      changed({ rerender: true });
    }
  });
}
const fmtSlots = v => (v == null ? '—' : v === Infinity ? '∞' : v);
const knownCount = (book, l) => book.spells.filter(s => s.level === l).length;
const preparedCount = (book, l) => book.spells.filter(s => s.level === l).reduce((a, s) => a + num(s.prepared), 0);

export function pickSpell(cls, sc, level) {
  return modal(`Add ${cls} spell`, (body, close) => {
    body.innerHTML = `<div class="row">
        <input class="search grow" placeholder="Search spell names…">
        <select data-f="level">${['', ...Array.from({ length: sc.maxLevel + 1 }, (_, i) => i)].map(l => `<option value="${l}" ${l === level ? 'selected' : ''}>${l === '' ? 'Any level' : 'Level ' + l}</option>`).join('')}</select>
        <select data-f="school"><option value="">Any school</option>${SCHOOLS.map(s => `<option>${s}</option>`).join('')}</select>
      </div>
      <div class="small muted">Spell lists: ${esc(sc.lists.join(', '))}</div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a spell to preview it.</p></div></div>`;
    const q = $('input', body), lv = $('[data-f=level]', body), sch = $('[data-f=school]', body);
    const list = $('.picker-list', body), prev = $('.picker-preview', body);
    let rows = [], seq = 0;
    const run = debounce(async () => {
      const my = ++seq;
      const res = await api.spells(sc.lists.join(','), lv.value, q.value, sch.value);
      if (my !== seq) return;
      rows = res;
      list.innerHTML = rows.map((r, i) => `<div class="pick-row" data-i="${i}">
        <div><b>${esc(r.name)}</b> <span class="muted small">L${r.level} · ${esc(r.school || '')}</span></div>
        <div class="muted small">${esc(r.summary || '')}</div><button class="btn small primary" data-pick="${i}">Add</button></div>`).join('') || '<p class="pad muted">No spells match.</p>';
    }, 120);
    [q, lv, sch].forEach(x => x.addEventListener('input', run));
    list.addEventListener('click', async e => {
      const p = e.target.closest('[data-pick]');
      if (p) { close(rows[+p.dataset.pick]); return; }
      const row = e.target.closest('.pick-row');
      if (!row) return;
      $$('.pick-row.sel', list).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      const en = await api.entry(rows[+row.dataset.i].id);
      prev.innerHTML = `<h3>${esc(en.name)}</h3>${en.html}<p class="source">Source: ${esc(en.source)}</p>`;
    });
    run();
  }, { wide: true });
}

// =====================================================================
// GEAR
// =====================================================================
function gear(body, c, d) {
  const enc = d.encumbrance;
  body.innerHTML = `<div class="grid two">
  <section class="card span2">
    <div class="row"><h3 class="grow">Armor & Shields</h3><button class="btn small" data-add="armor">＋ Add armor/shield</button></div>
    ${c.armor.length ? `<table class="tbl"><thead><tr><th>Worn</th><th>Name</th><th>Type</th><th>Category</th><th title="Armor/shield bonus">Bonus</th><th title="Enhancement">Enh</th>
      <th title="Max Dex bonus (blank = none)">Max Dex</th><th title="Armor check penalty">ACP</th><th title="Arcane spell failure %">ASF %</th><th>Weight</th><th></th></tr></thead><tbody>
      ${c.armor.map((a, i) => `<tr><td>${chk(`armor.${i}.equipped`)}</td><td class="w10">${tf(`armor.${i}.name`, { placeholder: 'Name' })}</td>
        <td>${sel(`armor.${i}.type`, [['armor', 'Armor'], ['shield', 'Shield']])}</td>
        <td>${sel(`armor.${i}.category`, [['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']])}</td>
        <td>${inp(`armor.${i}.bonus`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.enh`, { type: 'num', cls: 'w2' })}</td>
        <td>${inp(`armor.${i}.maxDex`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.acp`, { type: 'num', cls: 'w2' })}</td>
        <td>${inp(`armor.${i}.asf`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.weight`, { type: 'num', cls: 'w3' })}</td>
        <td><button class="icon-btn" data-del="armor.${i}">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No armor.</p>'}
  </section>
  <section class="card span2">
    <div class="row"><h3 class="grow">Equipment</h3>
      <button class="btn small" data-pick-item>＋ Magic item</button><button class="btn small" data-add="gear">＋ Item</button></div>
    ${c.gear.length ? `<table class="tbl"><thead><tr><th>Item</th><th>Qty</th><th>Wt (each)</th><th>Value</th><th>Notes</th><th></th></tr></thead><tbody>
      ${c.gear.map((g, i) => `<tr><td class="w12">${g.id ? refId(g.id, g.name)
          : tf(`gear.${i}.name`, { placeholder: 'Item name', read: { title: g.name || 'Item', titlePath: `gear.${i}.name`, cat: 'Custom item', path: `gear.${i}.notes` } })}</td>
        <td>${inp(`gear.${i}.qty`, { type: 'num', cls: 'w2' })}</td><td>${inp(`gear.${i}.weight`, { type: 'num', cls: 'w3' })}</td>
        <td>${inp(`gear.${i}.value`, { cls: 'w5' })}</td>
        <td class="grow-cell">${tf(`gear.${i}.notes`, { multiline: true, placeholder: 'Add notes', read: { title: g.name || 'Item', titlePath: `gear.${i}.name`, cat: g.id ? 'Your notes' : 'Custom item' } })}</td>
        <td><button class="icon-btn" data-del="gear.${i}">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing carried.</p>'}
  </section>
  <section class="card">
    <h3>Money</h3>
    <div class="kv">${['pp', 'gp', 'sp', 'cp'].map(k => `<label>${k.toUpperCase()} ${inp(`money.${k}`, { type: 'num', cls: 'w5' })}</label>`).join('')}</div>
    <p class="small muted">Total value: <b id="money-total"></b> gp (50 coins = 1 lb, included in weight)</p>
    <h4>Other currencies</h4>
    ${(c.money.custom || []).map((m, i) => `<div class="row cur-row">${inp(`money.custom.${i}.name`, { cls: 'cur-name', ph: 'Name (e.g. Gems, Fame, Credits)' })}
      ${inp(`money.custom.${i}.amount`, { type: 'num', cls: 'w5' })}
      <button class="icon-btn" data-del="money.custom.${i}" title="Remove">✕</button></div>`).join('') || '<p class="muted small">None. Use this for gems, favors, campaign points or any other currency.</p>'}
    <button class="btn small" data-add="money.custom">＋ Currency</button>
  </section>
  <section class="card">
    <h3>${ref('Carrying Capacity', 'Rules', 'Encumbrance')}</h3>
    <div class="stat-row">
      <div class="stat"><div class="label">Carried</div><span class="big">${calc('encumbrance.weight')}</span> lb</div>
      <div class="stat"><div class="label">Light</div>≤ ${calc('encumbrance.light')}</div>
      <div class="stat"><div class="label">Medium</div>≤ ${calc('encumbrance.medium')}</div>
      <div class="stat"><div class="label">Heavy</div>≤ ${calc('encumbrance.heavy')}</div>
    </div>
    <p>Load: <b class="${enc.load === 'light' ? 'good' : 'bad'}">${calc('encumbrance.load')}</b>
    ${enc.load === 'medium' ? '· max Dex +3, ACP −3, reduced speed' : enc.load === 'heavy' ? '· max Dex +1, ACP −6, reduced speed, run ×3' : enc.load === 'overloaded' ? '· can only move 5 ft. per round' : ''}</p>
  </section></div>`;
  wireCommon(body);
  const upd = () => { $('#money-total').textContent = (num(c.money.pp) * 10 + num(c.money.gp) + num(c.money.sp) / 10 + num(c.money.cp) / 100).toLocaleString(); };
  upd();
  document.addEventListener('recalc', upd);
  onLeave(() => document.removeEventListener('recalc', upd));
  $('[data-pick-item]', body).onclick = async () => {
    const r = await pickEntry('Add magic item', 'Magic Item');
    if (!r) return;
    const en = await api.entry(r.id);
    const w = parseFloat((en.html.match(/<dt>Weight<\/dt><dd>([\d.]+)/) || [])[1]) || 0;
    const price = (en.html.match(/<dt>Price<\/dt><dd>([^<]+)/) || [])[1] || '';
    c.gear.push({ id: r.id, name: r.name, qty: 1, weight: w, value: price, notes: '' });
    changed({ rerender: true });
  };
}

// =====================================================================
// BUFFS
// =====================================================================
function buffs(body, c, d) {
  const groups = [...new Set(BUFF_PRESETS.map(p => p.group))];
  body.innerHTML = `<div class="grid two">
  <section class="card">
    <div class="row"><h3 class="grow">Your buffs & conditions</h3><button class="btn small" data-new-mod>＋ Custom modifier</button></div>
    ${c.modifiers.length ? c.modifiers.map((m, i) => `<div class="mod ${m.active ? 'on' : ''}">
      <div class="row"><label class="grow">${chk(`modifiers.${i}.active`, { rerender: true })} <b>${esc(m.name)}</b></label>
        <button class="icon-btn" data-edit-mod="${i}" title="Edit">✎</button><button class="icon-btn" data-del="modifiers.${i}">✕</button></div>
      <div class="small muted">${m.effects.map(e => `${MOD_TARGETS[e.target] || e.target} ${typeof e.value === 'number' ? sign(e.value) : esc(e.value)} ${e.type !== 'untyped' ? esc(e.type) : ''}`).join(' · ')}</div>
      ${m.note ? `<div class="small">${esc(m.note)}</div>` : ''}</div>`).join('') : '<p class="muted">Nothing yet. Add presets from the right, or build a custom one.</p>'}
    <p class="small muted">Bonuses follow stacking rules: only the highest bonus of each type applies, except dodge, circumstance, and untyped bonuses. Penalties always stack. ${ref('Stacking', 'Rules', 'More on stacking')}</p>
  </section>
  <section class="card">
    <h3>Presets</h3>
    ${groups.map(g => `<h4>${esc(g)}</h4><div class="chips">${BUFF_PRESETS.filter(p => p.group === g).map(p => {
      const on = c.modifiers.find(m => m.name === p.name && m.active);
      return `<button class="chip ${on ? 'on' : ''}" data-preset="${esc(p.name)}" title="${esc(p.note || '')}">${esc(p.name)}</button>`;
    }).join('')}</div>`).join('')}
    <p class="small muted">Power Attack, Deadly Aim, and Combat Expertise scale with your BAB automatically.</p>
  </section></div>
  <section class="card summons" id="summons-card"></section>`;
  renderSummons($('#summons-card', body), c);
  wireCommon(body);
  body.addEventListener('click', async e => {
    const p = e.target.closest('[data-preset]');
    const ed = e.target.closest('[data-edit-mod]');
    if (p) {
      const existing = c.modifiers.find(m => m.name === p.dataset.preset);
      if (existing) existing.active = !existing.active; else addPreset(BUFF_PRESETS.find(x => x.name === p.dataset.preset));
      changed({ rerender: true });
    } else if (e.target.closest('[data-new-mod]')) {
      const m = await editModifier({ name: 'Custom', active: true, effects: [{ target: 'attack', value: 1, type: 'untyped' }] });
      if (m) { c.modifiers.push(m); changed({ rerender: true }); }
    } else if (ed) {
      const i = +ed.dataset.editMod;
      const m = await editModifier(structuredClone(c.modifiers[i]));
      if (m) { c.modifiers[i] = m; changed({ rerender: true }); }
    }
  });
}

function editModifier(m) {
  return modal('Edit modifier', (body, close) => {
    const draw = () => {
      body.innerHTML = `<label class="kv-line">Name <input id="m-name" value="${esc(m.name)}"></label>
      <label class="kv-line">Note <input id="m-note" value="${esc(m.note || '')}" class="w20"></label>
      <table class="tbl"><thead><tr><th>Applies to</th><th>Value</th><th>Bonus type</th><th></th></tr></thead><tbody>
      ${m.effects.map((e, i) => `<tr>
        <td><select data-e="${i}" data-k="target">${Object.entries(MOD_TARGETS).map(([k, l]) => `<option value="${k}" ${k === e.target ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><input data-e="${i}" data-k="value" value="${esc(e.value)}" class="w6" title="Number, or formula using bab / lvl (e.g. 1+floor(bab/4))"></td>
        <td><select data-e="${i}" data-k="type">${BONUS_TYPES.map(t => `<option ${t === e.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><button class="icon-btn" data-rm="${i}">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="row"><button class="btn small" id="m-add">＋ Effect</button><span class="grow"></span>
        <button class="btn" id="m-cancel">Cancel</button><button class="btn primary" id="m-save">Save</button></div>`;
      $('#m-add', body).onclick = () => { sync(); m.effects.push({ target: 'attack', value: 1, type: 'untyped' }); draw(); };
      $$('[data-rm]', body).forEach(b => (b.onclick = () => { sync(); m.effects.splice(+b.dataset.rm, 1); draw(); }));
      $('#m-cancel', body).onclick = () => close(undefined);
      $('#m-save', body).onclick = () => { sync(); close(m); };
    };
    const sync = () => {
      m.name = $('#m-name', body).value || 'Custom';
      m.note = $('#m-note', body).value;
      $$('[data-e]', body).forEach(x => {
        const e = m.effects[+x.dataset.e];
        let v = x.value;
        if (x.dataset.k === 'value' && /^[-+]?\d+$/.test(v.trim())) v = parseInt(v, 10);
        e[x.dataset.k] = v;
      });
    };
    draw();
  });
}

// =====================================================================
// BIO
// =====================================================================
function bio(body, c, d) {
  const r = RACES[c.race] || {};
  const classesTaken = Object.keys(classLevels(c));
  body.innerHTML = `<div class="grid two">
  <section class="card">
    <h3>Identity</h3>
    <div class="form">
      <label>Character name ${inp('name', { cls: 'full' })}</label>
      <label>Player ${inp('player', { cls: 'full' })}</label>
      <label>Race ${sel('race', Object.keys(RACES), { rerender: true })} ${c.race !== 'Custom' ? ref(c.race, 'Race', 'read') : ''}</label>
      ${r.flex ? `<label>+2 racial bonus to ${sel('raceChoice', ABILITIES.map(a => [a, ABILITY_NAMES[a]]), { rerender: true })}</label>` : ''}
      ${c.race === 'Custom' ? `<label>Race name ${inp('customRace.name')}</label>
        <label>Size ${sel('customRace.size', Object.keys(SIZES), { rerender: true })}</label>
        <label>Base speed ${inp('customRace.speed', { type: 'num', cls: 'w3' })}</label>
        <div class="kv">${ABILITIES.map(a => `<label>${a.toUpperCase()} ${inp(`customRace.mods.${a}`, { type: 'num', cls: 'w2' })}</label>`).join('')}</div>` : ''}
      <div class="small muted">Size ${esc(d.size)} · Speed ${d.race.speed} ft. ${r.note ? '· ' + esc(r.note) : ''}</div>
      <label>Alignment ${sel('alignment', ALIGNMENTS)}</label>
      <label>Deity ${inp('deity')}</label>
      <label>Favored class ${sel('favoredClass', [['', '—'], ...classesTaken.map(x => [x, x]), ...state.classes.filter(x => !classesTaken.includes(x.name)).map(x => [x.name, x.name])])}</label>
      <label>Homeland ${inp('homeland')}</label>
      <label>Languages ${inp('languages', { cls: 'full' })}</label>
    </div>
  </section>
  <section class="card">
    <h3>Experience</h3>
    <div class="form">
      <label>XP track ${sel('xpTrack', [['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']], { rerender: true })}</label>
      <label>Current XP ${inp('xp', { type: 'num', cls: 'w8', rerender: true })}</label>
    </div>
    <p>${d.xp.next != null ? `Next level at <b>${d.xp.next.toLocaleString()}</b> XP.` : 'Maximum level.'}
      ${d.xp.levelByXp > d.level ? `<b class="good">You have enough XP to reach level ${d.xp.levelByXp}!</b> <button class="btn small primary" data-goto-lu>Level up</button>` : ''}</p>
    <h3>Appearance</h3>
    <div class="kv">${['gender', 'age', 'height', 'weight', 'hair', 'eyes'].map(k => `<label>${k[0].toUpperCase() + k.slice(1)} ${inp(k, { cls: 'w6' })}</label>`).join('')}</div>
  </section>
  <section class="card span2">
    <h3>Notes</h3>
    <textarea data-bind="notes" rows="14" class="full" placeholder="Backstory, session notes, contacts, loot to sell…">${esc(c.notes)}</textarea>
  </section>
  <section class="card span2">
    <h3>Level history</h3>
    ${c.levelUps.length ? `<table class="tbl"><thead><tr><th>Lvl</th><th>Class</th><th>HP</th><th>Favored class</th><th>Ability +1</th><th>Notes</th></tr></thead><tbody>
      ${c.levelUps.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.cls)}</td><td>${inp(`levelUps.${i}.hp`, { type: 'num', cls: 'w3', title: 'Hit die roll for this level (before Con)' })}</td>
        <td>${sel(`levelUps.${i}.fcb`, [['', '—'], ['hp', '+1 HP'], ['skill', '+1 skill rank'], ['racial', 'Racial option'], ['other', 'Other']], { rerender: true })}
          ${l.fcb === 'racial' || l.fcb === 'other' ? `<div class="small">${tf(`levelUps.${i}.fcbNote`, { multiline: true, placeholder: 'Describe the bonus', read: { title: `Level ${i + 1} favored class bonus`, cat: l.cls } })}</div>` : ''}</td>
        <td>${(i + 1) % 4 === 0 ? sel(`levelUps.${i}.abilityIncrease`, [['', '—'], ...ABILITIES.map(a => [a, a.toUpperCase()])]) : ''}</td>
        <td>${tf(`levelUps.${i}.notes`, { multiline: true, placeholder: 'Add notes', read: { title: `Level ${i + 1} notes`, cat: l.cls } })}</td></tr>`).join('')}</tbody></table>
      <div class="row"><button class="btn small danger" data-undo-level>Undo last level</button></div>` : '<p class="muted">No levels yet.</p>'}
  </section></div>`;
  wireCommon(body);
  wireImages(body, c);
  const g = $('[data-goto-lu]', body);
  if (g) g.onclick = () => go('levelup');
  const u = $('[data-undo-level]', body);
  if (u) u.onclick = async () => {
    const last = c.levelUps[c.levelUps.length - 1];
    if (!await confirmBox(`Remove level ${c.levelUps.length} (${last.cls})? Skill ranks, feats, and spells added during that level-up are removed too.`, 'Undo level')) return;
    undoLevel(c);
    changed({ rerender: true });
  };
}

export function undoLevel(c) {
  const last = c.levelUps.pop();
  if (!last) return;
  for (const [key, n] of Object.entries(last.ranks || {})) {
    const s = c.skills.find(x => (x.sub ? `${x.name} (${x.sub})` : x.name) === key);
    if (s) s.ranks = Math.max(0, num(s.ranks) - n);
  }
  const lvl = c.levelUps.length + 1;
  c.feats = c.feats.filter(f => !(f.addedAt === lvl));
  for (const b of Object.values(c.spellbooks)) b.spells = (b.spells || []).filter(s => s.addedAt !== lvl);
}
