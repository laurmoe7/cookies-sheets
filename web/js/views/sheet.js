import { api } from '../api.js';
import { state, changed, render, go, refreshCalc } from '../app.js';
import { sign, num, raceInfo, classLevels } from '../calc.js';
import {
  ABILITIES, ABILITY_NAMES, SKILL_BY_NAME, MULTI_SKILLS, RACES, ALIGNMENTS, SIZES, BONUS_TYPES, MOD_TARGETS,
  BUFF_PRESETS, BUFF_GROUPS, presetsIn, SPELL_FILTERS, SPELL_LIST_CLASSES, CASTING_STAT_NAMES, FEAT_TYPES, TRAIT_CATEGORIES,
} from '../data.js';
import { esc, $, $$, getPath, modal, pickEntry, toast, confirmBox, debounce, textField, showCustom, showEntry, showEntryFromClick, closeDrawer } from '../ui.js';
import { choosePicture, repositionPicture } from '../cropper.js';
import { classFeatures, archetypesOf } from '../features.js';
import { chooseArchetypes } from './archetypes.js';
import { chooseTraits } from './traitpicker.js';
import { ADDITIONAL_TRAITS } from '../traits.js';
import { summonSpell } from '../summons.js';
import { rollBar, fillSpellRolls, SLA_KEY as SLA } from '../roller.js';
import { chooseSummon } from './summons.js';
import { renderCompanions } from './companions.js';
import { playPageTurn, snapshotPage, options, setOption, orderKeys } from '../options.js';
import { hpSegments, segsHtml } from '../bars.js';
import { playSfx } from '../sfx.js';
import { hpFx } from '../healfx.js';
import { view as petView } from '../pet/pet.js';
import { renderResources, resourceBlock, wire as wireResources, wireRest } from './resources.js';
import { weaponFxRow, wireWeaponFx } from './weaponfx.js';
import { armorFxChip, wireArmorFx } from './armorfx.js';
import { paperDollCard, wirePaperDoll } from './paperdoll.js';
import { suggestEffects, effectsText } from '../itemfx.js';
import { parseMagicWeapon, parseMagicArmor } from '../magicgear.js';
import { weaponFromTemplate, armorFromTemplate, blankWeapon, blankArmor } from '../equipment.js';
import { chooseWeapon, chooseArmor } from './equipment.js';
import { SLOTS, slotName, hintFromSub, sortByName } from '../paperdoll.js';

const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  skills: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  feats: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  spells: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gear: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 14h18"/>',
  companions: '<circle cx="6" cy="10" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="19" cy="10" r="1.8"/><path d="M12.5 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 3 2 1-.2 1.6-.5 2.5-.5s1.5.3 2.5.5c1.6.3 3-.4 3-2 0-2.2-2.5-5.2-5.5-5.2z"/>',
  buffs: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  notes: '<path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z"/><path d="M14 7l3 3M4 20l4-1"/>',
  bio: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
};
const icon = k => `<svg class="tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const TABS = [
  ['overview', 'Overview'], ['buffs', 'Buffs & Conditions'], ['skills', 'Skills'], ['gear', 'Inventory'], ['spells', 'Spells'],
  ['companions', 'Companions'], ['feats', 'Feats & Abilities'], ['bio', 'Biography'], ['notes', 'Notes'],
];

/** The tabs in the order the player chose (Options → Look → drag the tabs). */
const orderedTabs = () => orderKeys(TABS.map(t => t[0]), options().tabOrder).map(k => TABS.find(t => t[0] === k));
const tabsKey = () => orderedTabs().map(t => t[0]).join() + (options().tabDrag ? '+drag' : '');

/** Dragging a tab onto another puts it before or after it, depending on which half it is dropped on. Saved in the options. */
function wireTabDrag(main) {
  const bar = $('.tabs', main);
  let from = null;
  const clear = () => $$('.tab', bar).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after'));
  const after = (e, b) => { const r = b.getBoundingClientRect(); return e.clientX > r.left + r.width / 2; };
  $$('.tab', bar).forEach(b => {
    b.draggable = true;
    b.ondragstart = e => { from = b.dataset.tab; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', from); b.classList.add('dragging'); };
    b.ondragend = () => { from = null; clear(); };
    b.ondragover = e => {
      if (!from || from === b.dataset.tab) return;
      e.preventDefault();
      $$('.tab', bar).forEach(x => x.classList.remove('drop-before', 'drop-after'));
      b.classList.add(after(e, b) ? 'drop-after' : 'drop-before');
    };
    b.ondrop = e => {
      e.preventDefault();
      if (!from || from === b.dataset.tab) return;
      const keys = orderedTabs().map(t => t[0]).filter(k => k !== from);
      keys.splice(keys.indexOf(b.dataset.tab) + (after(e, b) ? 1 : 0), 0, from);
      from = null; clear();
      setOption('tabOrder', keys);
      changed({ rerender: true });
    };
  });
}
document.addEventListener('options-changed', () => { if (state.view === 'sheet' && state.char) changed({ rerender: true }); });

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
const roll = (key, label, inner) => `<button class="nb" data-roll="${esc(key)}" data-roll-label="${esc(label)}">${inner}</button>`;
const calc = (key, fmt = 'plain', cls = '') => `<span class="calc ${cls}" data-calc="${key}" data-fmt="${fmt}"></span>`;
const ref = (name, cat, label) => `<a href="#" class="ref" data-entry="${esc(name)}" ${cat ? `data-cat="${esc(cat)}"` : ''}>${esc(label ?? name)}</a>`;
const refId = (id, label) => `<a href="#" class="ref" data-entry="${esc(label)}" data-entry-id="${id}">${esc(label)}</a>`;

export function renderSheet(main) {
  const c = state.char;
  const d = state.derived;
  // The tab bar stays in the page while you edit or switch tabs (only the body is redrawn), so it never flickers.
  if (!$('.tabs', main) || main.dataset.view !== 'sheet' || main.dataset.tabs !== tabsKey()) {
    main.dataset.tabs = tabsKey();
    main.innerHTML = `<div class="page">
      <div class="tabs" role="tablist">${orderedTabs().map(([k, l]) => `<button class="tab" data-tab="${k}">${icon(k)}${l}</button>`).join('')}
        <div class="grow"></div><span id="tabs-extra"></span>
      </div>
      <div id="tab-body"></div></div>`;
    $$('.tab', main).forEach(b => (b.onclick = () => { if (state.sheetTab !== b.dataset.tab) { const snap = snapshotPage($('#tab-body')); const order = orderedTabs().map(t => t[0]), back = order.indexOf(b.dataset.tab) < order.indexOf(state.sheetTab); state.turn = snap && { snap, back }; state.sheetTab = b.dataset.tab; render(); petView('tab-' + b.dataset.tab); } }));
    if (options().tabDrag) wireTabDrag(main);
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
  ({ overview, skills, feats, spells, gear, companions: renderCompanions, buffs, bio, notes })[state.sheetTab](body, c, d);
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
    <span class="grow"></span>
    <button class="btn small rest-btn" data-full-rest title="A night's rest: heal 1 HP per level, clear nonlethal damage, heal 1 point of each ability damage, refill the class pools and spell slots, and prepare the spells you cast again">🌙 Rest</button>
    ${rollBar()}
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
      ${c.portrait ? `<div class="portrait-frame"><img src="${esc(c.portrait)}" alt="Character portrait">
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
          <td class="big accent">${roll(`abilities.${a}.mod`, a.toUpperCase() + ' check', calc(`abilities.${a}.mod`, 'sign'))}</td></tr>`).join('')}</tbody>
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
          <th>${ref(n + ' Saves', 'Rules', n)}</th><td class="big accent">${roll(`saves.${s}.total`, n + ' save', calc(`saves.${s}.total`, 'sign'))}</td>
          <td>${calc(`saves.${s}.base`, 'sign', 'dim')}</td><td>${calc(`saves.${s}.ability`, 'sign', 'dim')}</td>
          <td>${calc(`saves.${s}.bonus`, 'sign', 'dim')}</td><td>${inp(`saveMisc.${s}`, { type: 'num', cls: 'w3' })}</td></tr>`).join('')}
      </tbody></table>
      <div class="kv wide">
        <label>DR ${inp('defenses.dr', { cls: 'w8' })}</label><label>SR ${inp('defenses.sr', { cls: 'w4' })}</label>
        <label>Resist ${inp('defenses.resist', { cls: 'w8' })}</label><label>Immune ${inp('defenses.immune', { cls: 'w8' })}</label>
      </div>
      ${d.armorFx?.text ? `<div class="small muted" title="From the armor and shield you wear (Inventory tab, Enchant)">From your armor: ${esc(d.armorFx.text)}</div>` : ''}
    </section>

    <div class="stack">
    <section class="card offense">
      <h3>Offense</h3>
      <div class="stat-row">
        <div class="stat"><div class="label">${ref('Initiative', 'Rules')}</div>${roll('init', 'Initiative', calc('init', 'sign', 'big'))}</div>
        <div class="stat"><div class="label">${ref('Base Attack Bonus', 'Rules', 'BAB')}</div><span class="big" id="bab-text"></span></div>
        <div class="stat"><div class="label">Melee</div>${roll('melee', 'Melee attack', calc('melee', 'sign', 'big'))}</div>
        <div class="stat"><div class="label">Ranged</div>${roll('ranged', 'Ranged attack', calc('ranged', 'sign', 'big'))}</div>
        <div class="stat"><div class="label">${ref('Combat Maneuver Bonus', 'Rules', 'CMB')}</div>${roll('cmb', 'CMB', calc('cmb', 'sign', 'big'))}</div>
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
    <section class="card quick-notes">
      <h3>Notes</h3>
      <textarea class="full" data-bind="quickNotes" placeholder="Reminders, anything you want at a glance. The Notes tab is for the story, NPCs and quests.">${esc(c.quickNotes || '')}</textarea>
    </section>
    </div>

    <section class="card weapons span2">
      <div class="row"><h3 class="grow">Weapons & Attacks</h3><button class="btn small" data-pick-weapon>＋ Magic item</button><button class="btn small" data-add-weapon title="Pick a standard weapon, or start with a blank row">＋ Add weapon</button></div>
      ${c.weapons.length ? `<table class="tbl weapons-tbl"><thead><tr><th>Weapon</th><th>Attack</th><th>Damage</th><th>Crit</th>
        <th title="Ability for attack roll">Atk stat</th><th title="Ranged weapon">Rng</th><th title="Enhancement bonus">Enh</th>
        <th title="Misc attack bonus (masterwork +1, Weapon Focus, etc.)">Atk+</th><th>Dice</th><th title="Which ability adds to damage, and how much of it">Damage stat</th><th title="Misc damage">Dmg+</th>
        <th>Range</th><th>Type</th><th></th></tr></thead><tbody>
        ${c.weapons.map((w, i) => `<tr>
          <td class="w10"${entryAttrs(w)}>${tf(`weapons.${i}.name`, { placeholder: 'Name (double-click)' })}${weaponFxRow(c, i)}</td>
          <td class="big accent nowrap"><button class="nb" data-roll-weapon="${i}" data-roll-kind="attack">${calc(`weapons.${i}.attackText`)}</button>${d.iteratives.length > 1 ? `<button class="rchip" data-roll-weapon="${i}" data-roll-kind="full">Full</button>` : ''}</td>
          <td class="big nowrap"><button class="nb" data-roll-weapon="${i}" data-roll-kind="damage">${calc(`weapons.${i}.damageText`)}</button></td>
          <td>${inp(`weapons.${i}.crit`, { cls: 'w5', ph: '19-20/x2' })}</td>
          <td>${sel(`weapons.${i}.ability`, [['', 'auto'], ['str', 'Str'], ['dex', 'Dex']])}</td>
          <td>${chk(`weapons.${i}.ranged`)}</td>
          <td>${inp(`weapons.${i}.enh`, { type: 'num', cls: 'w2', rerender: true })}</td>
          <td>${inp(`weapons.${i}.misc`, { type: 'num', cls: 'w2' })}</td>
          <td>${inp(`weapons.${i}.damage`, { cls: 'w4', ph: '1d8' })}</td>
          <td class="nowrap">${sel(`weapons.${i}.dmgAbility`, [['', 'Str (auto)'], ['str', 'Str'], ['dex', 'Dex'], ['con', 'Con'], ['int', 'Int'], ['wis', 'Wis'], ['cha', 'Cha'], ['none', 'none']], { title: 'Which ability adds to damage. Auto is Strength for melee and nothing for ranged weapons; pick Str for thrown weapons and Strength-rated bows.' })}
            ${sel(`weapons.${i}.dmgMult`, [['', 'auto'], ['1', '×1'], ['1.5', '×1½ (2H)'], ['0.5', '×½ (off)'], ['0', 'none']])}</td>
          <td>${inp(`weapons.${i}.dmgMisc`, { type: 'num', cls: 'w2' })}</td>
          <td>${inp(`weapons.${i}.range`, { cls: 'w4' })}</td>
          <td>${inp(`weapons.${i}.type`, { cls: 'w3', ph: 'S' })}</td>
          <td><button class="icon-btn" data-del="weapons.${i}" title="Remove">✕</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No weapons yet. Add one to see its attack and damage calculated.</p>'}
      <p class="small muted">Full attack uses BAB iteratives (${d.iteratives.map(sign).join('/')}). Buffs such as Power Attack, Haste, and Bless apply automatically. ${ref('Two-Weapon Fighting', 'Rules')} · ${ref('Critical Hits', 'Rules')}</p>
    </section>

    <section class="card span2" id="res-card"></section>

  </div>`;
  wireCommon(body);
  wireWeaponFx(body, c);
  $('[data-pick-weapon]', body).onclick = () => addMagicGear('weapon');
  $('[data-add-weapon]', body).onclick = () => addFromList('weapon');
  wireRest(body, c);
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
        gear: { name: '', qty: 1, weight: 0, value: '', notes: '', slot: '', hint: '', effects: [] },
        specials: { name: '', notes: '' },
        'money.custom': { name: '', amount: 0 },
        sessions: { date: new Date().toISOString().slice(0, 10), name: '', notes: '' },
        npcs: { name: '', role: '', attitude: 'neutral', where: '', notes: '' },
        quests: { name: '', done: false, notes: '' },
        lore: { name: '', kind: 'Place', notes: '' },
      }[t.dataset.add];
      getPath(c, t.dataset.add).push(structuredClone(blank));
      changed({ rerender: true });
      if (t.dataset.add === 'gear') openItem(c.gear.length - 1);
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

/** "＋ Add weapon" and "＋ Add armor/shield": pick a standard one from the list, or take a blank row to fill in by hand. */
async function addFromList(kind) {
  const c = state.char, weapon = kind === 'weapon';
  const size = state.derived?.size || 'Medium';
  const pick = await (weapon ? chooseWeapon(size) : chooseArmor());
  if (!pick) return;
  const row = pick === 'blank' ? (weapon ? blankWeapon() : blankArmor()) : weapon ? weaponFromTemplate(pick, size, c.feats.some(f => /^weapon finesse/i.test(f.name))) : armorFromTemplate(pick);
  (weapon ? c.weapons : c.armor).push(row);
  changed({ rerender: true });
}

/** "＋ Magic item" on the Weapons and Armor tables: pick it from the compendium and its base weapon or armor, enchantments and material are filled in from the text. */
async function addMagicGear(kind) {
  const c = state.char, weapon = kind === 'weapon';
  const r = await pickEntry(weapon ? 'Add a magic weapon' : 'Add magic armor or a shield', 'Magic Item', { search: q => api.magicGear(kind, q) });
  if (!r) return;
  const en = await api.entry(r.id);
  const row = (weapon ? parseMagicWeapon : parseMagicArmor)(en);
  if (row) toast(`${r.name} added. Check the numbers: they were read from its description.`);
  else toast(`Could not tell what ${r.name} is built on, so it was added as a blank row to fill in.`, 'err');
  (weapon ? c.weapons : c.armor).push(row || (weapon
    ? { id: r.id, name: r.name, ability: '', ranged: false, enh: 0, misc: 0, damage: '1d8', dmgAbility: '', dmgMult: '', dmgMisc: 0, crit: '×2', range: '', type: '', weight: 0, mw: false, material: '', improvedCritical: false, fx: [], slot: '' }
    : { id: r.id, name: r.name, type: 'armor', category: 'light', bonus: 0, enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true, mw: false, material: '', fx: [] }));
  changed({ rerender: true });
}

function addPreset(p) {
  const c = state.char;
  const existing = c.modifiers.find(m => m.name === p.name);
  if (existing) { existing.active = true; return; }
  c.modifiers.push({ name: p.name, active: true, note: p.note || '', effects: structuredClone(p.effects) });
}

function chooseBuffPreset() {
  return modal('Add buff or condition', (body, close) => {
    body.innerHTML = BUFF_GROUPS.map(g => `<h4>${esc(g)}</h4><div class="chips">${presetsIn(g)
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
    <table class="tbl skills-tbl"><thead><tr><th title="Class skill">CS</th><th>Skill</th><th>Ability</th><th>Total</th><th>Ranks</th><th>Misc</th><th>Notes</th><th></th></tr></thead>
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
        <td class="big accent">${sd.untrainedBlocked ? '<span class="dim" title="Trained only">—</span>' : roll('skills.' + key + '.total', s.name + (s.sub ? ` (${s.sub})` : ''), `<span data-calc="skills.${esc(key)}.total" data-fmt="sign"></span>`)}</td>
        <td>${inp(`skills.${i}.ranks`, { type: 'num', cls: 'w3' + (sd.overMax ? ' bad' : ''), rerender: true })}</td>
        <td>${inp(`skills.${i}.misc`, { type: 'num', cls: 'w3', title: 'Racial, trait, item, feat bonuses' })}</td>
        <td class="skill-note">${inp(`skills.${i}.notes`, { cls: 'grow', ph: 'Notes', title: 'Anything to remember about this skill (+2 vs. traps, only in dim light...)' })}</td>
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
    c.skills.splice(i + 1, 0, { name: c.skills[i].name, sub: '', ranks: 0, misc: 0, classSkill: false, notes: '' });
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
        <td class="muted small">${esc(f.sub || '')}${f.level && key !== 'traits' ? ` · L${f.level}` : ''}</td>
        <td class="grow-cell">${tf(`${key}.${i}.notes`, { multiline: true, placeholder: f.id ? 'Add notes' : 'Add a description',
          read: { title: f.name || 'Notes', titlePath: `${key}.${i}.name`, cat: f.id ? 'Your notes' : KIND[key] } })}</td>
        <td><button class="icon-btn" data-del="${key}.${i}">✕</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">None yet.</p>'}
    </section>`;
  body.innerHTML = `<div class="grid two">
    <div>
      <section class="card"><h3>Archetype</h3>
        ${Object.keys(lv).map(cls => {
          const archs = archetypesOf(c, cls);
          return `<div class="kv-line"><b class="w8">${esc(cls)}</b>
            <span class="grow">${archs.length ? archs.map(a => `<a href="#" class="ref" data-entry="${esc(a.name)}" data-cat="Archetype">${esc(a.name)}</a>`).join(', ') : '<span class="muted">Standard class</span>'}</span>
            <button class="btn small ghost" data-arch="${esc(cls)}">${archs.length ? 'Change' : 'Choose'}</button></div>`;
        }).join('') || '<p class="muted">No classes yet.</p>'}
      </section>
      ${listBlock('feats', 'Feats', 'Feat', 'Add feat')}${listBlock('traits', 'Traits', 'Trait, racial trait', 'Add trait')}</div>
    <div>
      <section class="card">
        <h3>Class Features <span class="muted small">(from your class levels and archetypes; click to read)</span></h3>
        ${features.length ? `<ul class="features">${features.map((f, i) => `<li><span class="lvl">${esc(f.cls)} ${f.level}</span>${f.kind === 'archetype'
          ? `<a href="#" class="ref" data-feature="${i}">${esc(f.name)}</a><span class="arch-badge" title="${esc(f.replaces.length ? 'Replaces ' + f.replaces.join(', ') : f.archetype)}">${esc(f.archetype)}</span>`
          : `${ref(featureLookupName(f.name), '', f.name)}${f.modified ? ` <span class="mod" title="Changed by your archetype">✱</span>` : ''}`}</li>`).join('')}</ul>`
          : '<p class="muted">Take a level to see class features.</p>'}
      </section>
      ${listBlock('specials', 'Special Abilities', 'Class Feature', 'Add ability')}
    </div></div>`;
  wireCommon(body);
  body.addEventListener('click', async e => {
    const p = e.target.closest('[data-pick]');
    const cu = e.target.closest('[data-custom]');
    const ar = e.target.closest('[data-arch]');
    if (p) {
      // Traits are the character traits and the racial traits, in one list.
      const isTraits = p.dataset.pick === 'traits', isFeats = p.dataset.pick === 'feats';
      const search = isTraits ? async (q, sub) => (sub === 'Racial' ? await api.search(q, 'Racial Trait', 150)
        : (await Promise.all(['Trait', 'Racial Trait'].map(k => api.search(q, k, 100, 0, sub)))).flat().sort((a, b) => a.name.localeCompare(b.name))) : undefined;
      const r = await pickEntry(p.dataset.title, p.dataset.cat, { renderRow: r => r.summary || r.source, search,
        subs: isTraits ? TRAIT_CATEGORIES : isFeats ? FEAT_TYPES : null, subLabel: isTraits ? 'Any category' : 'Any type' });
      if (r) {
        c[p.dataset.pick].push({ id: r.id, name: r.name, sub: r.sub, notes: '', level: d.level });
        changed({ rerender: true });
        if (p.dataset.pick === 'feats' && r.name.toLowerCase() === ADDITIONAL_TRAITS.toLowerCase()) { // the feat gives two more traits
          const got = await chooseTraits({ count: 2, have: c.traits, title: 'Additional Traits: choose two traits' });
          if (got) { for (const t of got) c.traits.push({ id: t.id, name: t.name, sub: t.sub, notes: '' }); changed({ rerender: true }); }
        }
      }
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
    body.innerHTML = `<section class="card spellbook">${slaCard(c, d)}</section><section class="card"><h3>Spells</h3><p class="muted">None of your classes cast spells (yet), but you can still keep spells here: add any compendium spell or your own under <b>Spell-likes &amp; other spells</b> above. Paladins and rangers start casting at 4th level.</p>
      <p>Looking something up? Try the ${'<a href="#" data-goto="compendium">Compendium</a>'} or ${'<a href="#" data-goto="rules">Quick Rules</a>'}.</p></section>`;
    $$('[data-goto]', body).forEach(a => (a.onclick = e => { e.preventDefault(); go(a.dataset.goto); }));
    wireSla(body, c);
    if (spellDrawer?.el?.isConnected) renderSpellActions();
    return;
  }
  body.innerHTML = casters.map(([cls, sc], ci) => {
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
      <div class="sb-head">
        <div class="sb-title"><h3>${esc(cls)} ${sc.extracts ? 'extracts' : 'spells'}</h3><span class="muted small">${esc(sc.kind)} · ${CASTING_STAT_NAMES[sc.stat]}</span></div>
        <div class="sb-tools">
          <span class="pill" title="Roll a caster level check (d20 + caster level)">Caster level ${roll(`spellcasting.${cls}.cl`, cls + ' caster level check', `<b>${sc.cl}</b>`)}</span>
          <span class="pill" title="d20 + caster level + ${sc.stat.toUpperCase()} modifier">${ref('Concentration', 'Rules')} ${roll(`spellcasting.${cls}.concentration`, cls + ' concentration', `<b>${sign(sc.concentration)}</b>`)}</span>
          ${d.asf && ['Wizard', 'Sorcerer', 'Witch', 'Magus', 'Arcanist', 'Bard', 'Summoner', 'Skald', 'Bloodrager'].includes(cls) ? `<span class="pill warn" title="Arcane spell failure from armor">ASF ${d.asf}%</span>` : ''}
          ${sc.hasExtraSlot ? `<label class="small" title="Cleric/druid domain, wizard specialist school, or shaman spirit slot">${chk(`spellbooks.${cls}.extraSlot`, { rerender: true })} Domain / school slot</label>` : ''}
        </div>
      </div>
      ${cls === 'Arcanist' ? resourceBlock(c, 'arcane-reservoir') : ''}
      <table class="tbl slot-tbl"><thead><tr><th>Level</th>${levels.map(l => `<th>${ORD[l]}</th>`).join('')}</tr></thead><tbody>
        <tr><th>${spont ? 'Per day' : 'Slots'}</th>${levels.map(l => `<td><b>${fmtSlots(sc.slots[l])}</b></td>`).join('')}</tr>
        ${sc.known.some(k => k != null) ? `<tr><th>Known</th>${levels.map(l => `<td>${knownCount(book, l)} / ${sc.known[l] ?? '—'}</td>`).join('')}</tr>` : ''}
        ${sc.kind === 'arcanist' ? `<tr><th>Prepared</th>${levels.map(l => `<td>${preparedCount(book, l)} / ${sc.prepared[l] ?? '—'}</td>`).join('')}</tr>` : ''}
        ${spont ? `<tr><th title="Slots you can still cast with today">Left</th>${levels.map(l => (l === 0 && sc.slots[0] === Infinity) || sc.slots[l] == null ? '<td class="dim">—</td>' : `<td><div class="step-row"><button class="icon-btn step" data-slot-adj="${l}" data-d="-1" title="Spend a slot (one fewer left)">−</button><b class="${slotsLeft(book, sc, l) <= 0 ? 'bad' : ''}">${slotsLeft(book, sc, l)}</b><button class="icon-btn step" data-slot-adj="${l}" data-d="1" title="Get a slot back (one more left)">＋</button></div>${spontPips(book, sc, l)}</td>`).join('')}</tr>` : ''}
        <tr><th>Save DC</th>${levels.map(l => `<td>${sc.dcs[l]}</td>`).join('')}</tr>
        <tr><th title="Concentration DC to cast defensively: 15 + 2 × spell level">${ref('Casting Defensively', 'Rules', 'Defensive DC')}</th>${levels.map(l => `<td title="Need ${15 + 2 * l - sc.concentration} or higher on d20">${15 + 2 * l}<span class="dim small"> (${Math.max(1, Math.min(20, 15 + 2 * l - sc.concentration))}+)</span></td>`).join('')}</tr>
      </tbody></table>
      ${ci === 0 ? slaCard(c, d) : ''}
      ${levels.map(l => {
        const list = book.spells.map((s, i) => ({ ...s, i })).filter(s => s.level === l);
        const hasCast = sc.kind === 'prepared' || spont;
        const over = sc.kind === 'prepared' && sc.slots[l] != null && sc.slots[l] !== Infinity && preparedCount(book, l) > sc.slots[l];
        const count = sc.kind === 'prepared' && sc.slots[l] != null && sc.slots[l] !== Infinity ? `<span class="sl-count ${over ? 'bad' : ''}" title="Spells prepared today against your slots for this level">Prepared ${preparedCount(book, l)} of ${sc.slots[l]}</span>`
          : spont && l > 0 && sc.slots[l] != null && sc.slots[l] !== Infinity ? `<span class="sl-count ${slotsLeft(book, sc, l) <= 0 ? 'bad' : ''}" title="Slots left today: casting any spell of this level uses one">${slotsLeft(book, sc, l)} of ${sc.slots[l]} slots left</span>` : '';
        const heading = sc.kind === 'prepared' ? preparedPips(book, sc, l) : spont && l > 0 ? spontPips(book, sc, l) : '';
        const chip = s => {
          const left = num(s.prepared), spent = num(s.cast);
          const pips = prepared && l > 0 ? `<span class="pips" title="${left} prepared${spent ? `, ${spent} cast` : ''}">${'<i class="pip"></i>'.repeat(Math.min(left, 9))}${'<i class="pip used"></i>'.repeat(Math.min(spent, 9))}</span>` : '';
          return `<button class="sp-chip ${isActive(cls, s.i) ? 'on' : ''} ${prepared && l > 0 ? (left || spent ? 'ready' : 'idle') : ''}" data-sp-select="${s.i}" data-level="${l}" data-tip="${esc(s.id ? (s.summary || '') : (s.notes || ''))}" aria-pressed="${isActive(cls, s.i)}"><span class="sp-n">${esc(s.name || 'New spell')}</span>${s.school ? `<span class="sp-s">${esc(s.school)}</span>` : ''}${pips}</button>`;
        };
        return `<div class="spell-level">
          <div class="sl-head"><h4>${l === 0 ? (sc.extracts ? 'Level 0' : 'Cantrips / Orisons') : ORD[l] + ' level'}</h4>${count}${heading}<span class="grow"></span>
            <button class="btn small ghost" data-add-spell="${l}">＋ Add</button>
            <button class="btn small ghost" data-custom-spell="${l}" title="A spell that isn't in the compendium">＋ Custom</button></div>
          ${list.length ? `<div class="sp-chips">${list.map(chip).join('')}</div>`
            : '<p class="muted small sl-none">No spells yet.</p>'}
        </div>`;
      }).join('')}
    </section>`;
  }).join('');
  wireSla(body, c);
  wireCommon(body);
  wireResources(body, c);
  if (spellDrawer?.el?.isConnected) renderSpellActions(); // the open spell's bar shows the same numbers as the tab
  body.addEventListener('click', async e => {
    const sbEl = e.target.closest('[data-cls]');
    if (!sbEl) return;
    const cls = sbEl.dataset.cls;
    if (cls === SLA) return; // the spell-like abilities card has its own handler (wireSla)
    const book = c.spellbooks[cls];
    const sc = d.spellcasting[cls];
    const t = e.target.closest('[data-slot-adj],[data-sp-select],[data-add-spell],[data-custom-spell],[data-cast],[data-cast-spont],[data-prep]');
    if (!t) return;
    if (t.dataset.slotAdj !== undefined) {
      const l = +t.dataset.slotAdj;
      book.used[l] = Math.min(sc.slots[l], Math.max(0, num(book.used[l]) - +t.dataset.d)); // + = a slot back, - = one spent
      changed({ rerender: true });
      return;
    }
    if (t.dataset.spSelect !== undefined) {
      openSpell(cls, +t.dataset.spSelect, t);
      return;
    }
    if (t.dataset.customSpell !== undefined) {
      book.spells.push({ name: '', level: +t.dataset.customSpell, school: '', notes: '', prepared: 0, cast: 0 });
      changed({ rerender: true });
      openSpell(cls, book.spells.length - 1, null); // open it in the side panel so it can be named
      return;
    }
    if (t.dataset.addSpell !== undefined) {
      const picked = await pickSpell(cls, sc, +t.dataset.addSpell);
      if (picked) {
        book.spells.push({ id: picked.id, name: picked.name, level: picked.level ?? +t.dataset.addSpell, school: picked.school, summary: picked.summary, prepared: 0, cast: 0 });
        changed({ rerender: true });
      }
    } else if (t.dataset.prep !== undefined) {
      const s = book.spells[+t.dataset.prep];
      s.prepared = Math.max(0, num(s.prepared) + +t.dataset.d);
      changed({ rerender: true });
    } else if (t.dataset.cast !== undefined) {
      const s = book.spells[+t.dataset.cast];
      if (num(s.prepared) <= 0) return;
      s.prepared = num(s.prepared) - 1; // casting uses up a prepared spell; Rest gives it back
      s.cast = num(s.cast) + 1;
      changed({ rerender: true });
    } else if (t.dataset.castSpont !== undefined) {
      const l = +t.dataset.castSpont;
      if (slotsLeft(book, sc, l) <= 0) { toast(`No ${ORD[l]}-level slots left`, 'err'); return; }
      book.used[l] = num(book.used[l]) + 1;
      const left = slotsLeft(book, sc, l);
      toast(`${book.spells[+t.dataset.spell]?.name || 'Spell'} cast. ${left} ${left === 1 ? 'slot' : 'slots'} left at ${ORD[l]} level`);
      changed({ rerender: true });
    }
  });
}
/** The spell-likes block on the Spells tab: spell-like abilities (Dimension Door 1/day, Light at will). No slots, just uses per day, refilled by Rest. */
function slaCard(c, d) {
  const list = c.spellLikes || [];
  const chip = (s, i) => {
    const x = d.spellLikes[i];
    const pips = x.unlimited ? '<span class="sp-s">at will</span>'
      : `<span class="pips" title="${x.left} of ${x.max} left today">${'<i class="pip"></i>'.repeat(Math.min(x.left, 9))}${'<i class="pip used"></i>'.repeat(Math.min(x.max - x.left, 9))}</span>`;
    return `<button class="sp-chip ${isActive(SLA, i) ? 'on' : ''} ${x.unlimited || x.left ? 'ready' : 'idle'}" data-sp-select="${i}" data-level="${x.level}" data-tip="${esc(s.id ? (s.summary || '') : (s.notes || ''))}" aria-pressed="${isActive(SLA, i)}"><span class="sp-n">${esc(s.name || 'New ability')}</span><span class="sp-s">${x.level ? ORD[x.level] : '0'}</span>${pips}</button>`;
  };
  return `<div class="spell-level sla-card" data-cls="${SLA}">
    <div class="sl-head"><h4>Spell-likes &amp; other spells</h4><span class="muted small">any spell, no class needed · uses per day (or at will) · Rest refills them</span><span class="grow"></span>
      <button class="btn small ghost" data-sla-add title="Pick a spell from the compendium">＋ Add spell</button><button class="btn small ghost" data-sla-custom title="A spell or ability that is not in the compendium">＋ Custom</button></div>
    ${list.length ? `<div class="sp-chips">${list.map(chip).join('')}</div>` : '<p class="muted small sl-none">None yet. For spells that are not on a class list: racial and monster spell-likes (Dimension Door 1/day), item spells, or a spell you were given. Set how many times a day, or leave it blank for at will.</p>'}
  </div>`;
}

function wireSla(body, c) {
  const card = body.querySelector('.sla-card');
  if (!card) return;
  const blank = extra => ({ name: '', school: '', summary: '', notes: '', level: 1, perDay: 1, used: 0, cl: '', ability: 'cha', ...extra });
  card.onclick = async e => {
    const t = e.target.closest('[data-sp-select],[data-sla-add],[data-sla-custom]');
    if (!t) return;
    if (t.dataset.spSelect !== undefined) return openSpell(SLA, +t.dataset.spSelect, t);
    if (t.dataset.slaCustom !== undefined) {
      (c.spellLikes ||= []).push(blank());
      changed({ rerender: true });
      return openSpell(SLA, c.spellLikes.length - 1, null); // open it in the side panel so it can be named
    }
    const r = await pickEntry('Add a spell', 'Spell');
    if (!r) return;
    let level = 1, summary = '';
    try { // a spell's level for the save DC: the lowest level any class gets it at
      const en = await api.entry(r.id);
      summary = en.summary || '';
      const lv = Object.values(en.meta?.levels || {}).map(Number).filter(Number.isFinite);
      if (lv.length) level = Math.min(...lv);
    } catch { /* the ability still gets added; its level can be set in the panel */ }
    (c.spellLikes ||= []).push(blank({ id: r.id, name: r.name, school: r.sub || '', summary, level }));
    changed({ rerender: true });
  };
}

/** The side panel's action area for the open spell-like ability. */
function renderSlaActions() {
  const sd = spellDrawer;
  if (!sd?.el?.isConnected) return;
  const c = state.char, d = state.derived;
  const s = c.spellLikes?.[sd.i], x = d?.spellLikes?.[sd.i];
  if (!s || !x) { sd.el.innerHTML = ''; return; }
  const p = k => `spellLikes.${sd.i}.${k}`;
  sd.el.dataset.cls = SLA; // the roll window finds the ability from here
  sd.el.innerHTML = `<div class="sp-actions">
      <div class="sp-group">${s.id ? `<span data-spell-slot="${sd.i}" data-spell-id="${s.id}"></span>` : `<button class="btn" data-spell-roll="${sd.i}" title="Roll an attack, concentration or the damage for this ability">🎲 Roll</button>`}</div>
      <div class="sp-group">
        ${x.unlimited ? '<span class="sp-group-label">At will</span>'
    : `<span class="sp-group-label">Left today</span><b>${x.left} / ${x.max}</b>
        <button class="btn primary sp-cast" data-sa="sla-use" ${x.left <= 0 ? 'disabled' : ''} title="${x.left <= 0 ? 'No uses left today' : 'Use it once: one fewer left until you rest'}">Use</button>
        <button class="btn small ghost" data-sa="sla-back" ${num(s.used) ? '' : 'disabled'} title="Get one use back">Undo</button>`}
      </div>
    </div>
    <div class="item-actions">
      <label><span>Times per day (blank = at will)</span>${inp(p('perDay'), { type: 'num', cls: 'w3', rerender: true })}</label>
      <label><span>Spell level</span>${inp(p('level'), { type: 'num', cls: 'w3', rerender: true })}</label>
      <label><span>Caster level (blank = yours)</span>${inp(p('cl'), { type: 'num', cls: 'w3', rerender: true })}</label>
      <label><span>Save DC from</span>${sel(p('ability'), [['cha', 'Charisma'], ['int', 'Intelligence'], ['wis', 'Wisdom']], { rerender: true })}</label>
      <div class="wide small muted">Save DC ${x.dc} · caster level ${x.cl} · concentration ${sign(x.concentration)}</div>
      ${s.id ? '' : `<label class="wide"><span>Name</span><input data-sla-name value="${esc(s.name || '')}" placeholder="Ability name"></label>
      <label class="wide"><span>Description</span><textarea rows="6" data-bind="${p('notes')}" placeholder="What it does">${esc(s.notes || '')}</textarea></label>`}
    </div>`;
  fillSpellRolls(sd.el);
  const body = sd.el.parentElement?.querySelector('.entry-body');
  if (body) {
    body.querySelector('.sp-foot')?.remove();
    const foot = document.createElement('div');
    foot.className = 'sp-foot';
    foot.innerHTML = '<button class="btn danger-solid" title="Remove this spell-like ability">Delete ability</button>';
    body.appendChild(foot);
    foot.querySelector('button').onclick = async () => {
      if (!(await confirmBox(`Remove ${s.name || 'this ability'} from your spell-like abilities?`, 'Delete ability'))) return;
      c.spellLikes.splice(sd.i, 1);
      closeDrawer();
      changed({ rerender: true });
    };
  }
  sd.el.onclick = e => {
    const b = e.target.closest('[data-sa]');
    if (!b) return;
    if (b.dataset.sa === 'sla-use') {
      if (x.left <= 0) return;
      s.used = num(s.used) + 1;
      toast(`${s.name || 'Ability'} used. ${x.left - 1} left`);
    } else if (b.dataset.sa === 'sla-back') s.used = Math.max(0, num(s.used) - 1);
    else return;
    changed({ rerender: true });
    renderSlaActions();
  };
  sd.el.onchange = e => {
    if (!e.target.matches('[data-sla-name]')) return;
    s.name = e.target.value;
    const h2 = document.querySelector('#drawer h2'); if (h2) h2.textContent = s.name || 'New ability';
    changed({ rerender: true });
    renderSlaActions();
  };
}

// The spell shown in the side panel, with its actions (Roll, Summon, Prepared, Cast, Delete) under the name. {cls, i, armed, el}
// `armed` means the next entry the panel shows is this spell, so its actions go into that entry's action area.
let spellDrawer = null;
let parkedSpell = null; // the open spell while the panel shows something else (a creature linked from its text); Back brings it home
const isActive = (cls, i) => spellDrawer?.cls === cls && spellDrawer.i === i;

function clearActiveSpell() {
  spellDrawer = null;
  document.querySelectorAll('.sp-chip[data-sp-select].on').forEach(x => x.classList.remove('on'));
}

/** Clicking a spell chip: show the spell in the side panel (its text, then the actions under its name). */
function openSpell(cls, i, chip) {
  const s = cls === SLA ? state.char.spellLikes?.[i] : state.char.spellbooks[cls]?.spells[i];
  if (!s) return;
  parkedSpell = null;
  spellDrawer = { cls, i, armed: true, id: s.id || null };
  document.querySelectorAll('.sp-chip[data-sp-select].on').forEach(x => x.classList.remove('on'));
  chip?.classList.add('on');
  if (s.id) showEntry(s.id);
  else showCustom({ name: s.name || 'New spell', cat: 'Custom spell', sub: ORD[s.level] + ' level', html: '' });
}

/** Weapons and armor added from the list or as magic items remember their compendium entry; a click on the name opens it. */
const entryAttrs = row => row.id ? ` data-open-id="${row.id}" title="Click to read it · double-click the name to rename"` : row.tpl ? ` data-open-name="${esc(row.tpl)}" title="Click to read it · double-click the name to rename"` : '';
document.addEventListener('click', e => {
  const cell = e.target.closest('[data-open-id],[data-open-name]');
  if (!cell || e.target.closest('a,button,input,select,textarea') || cell.querySelector('input,textarea')) return;
  showEntryFromClick(cell.dataset.openId ? +cell.dataset.openId : cell.dataset.openName, 'Magic Item');
});

// An inventory item shown in the side panel: its compendium text, and under the name the fields to edit. {i, armed, id, el}
let itemDrawer = null;
const isItemActive = i => itemDrawer?.i === i;
const WEARABLE = () => [['', 'Not worn'], ...SLOTS.filter(x => !['armor', 'shield', 'main', 'off'].includes(x.id)).map(x => [x.id, slotName(x.id)])];

function openItem(i) {
  const g = state.char.gear[i];
  if (!g) return;
  itemDrawer = { i, armed: true, id: g.id || null };
  document.querySelectorAll('.sp-chip[data-item].on').forEach(x => x.classList.remove('on'));
  document.querySelector(`[data-item="${i}"]`)?.classList.add('on');
  if (g.id) showEntry(g.id);
  else showCustom({ name: g.name || 'New item', cat: 'Custom item', sub: g.value || '', html: '' });
}

document.addEventListener('entry-shown', e => {
  const it = itemDrawer;
  if (!it) return;
  if (it.armed && (e.detail.entry.id ?? null) === it.id) { it.armed = false; it.el = e.detail.actions; renderItemActions(); }
  else if (!it.armed) clearItem(); // the panel moved on to something else
});
document.addEventListener('drawer-closed', () => clearItem());
function clearItem() { itemDrawer = null; document.querySelectorAll('.sp-chip[data-item].on').forEach(x => x.classList.remove('on')); }

function renderItemActions() {
  const it = itemDrawer;
  if (!it?.el?.isConnected) return;
  const c = state.char, g = c.gear[it.i];
  if (!g) { it.el.innerHTML = ''; return; }
  const p = k => `gear.${it.i}.${k}`;
  const fx = g.effects || [], sug = suggestEffects(g.name);
  it.el.innerHTML = `<div class="item-actions">
    ${g.id ? '' : `<label class="wide"><span>Name</span><input data-item-name value="${esc(g.name || '')}" placeholder="Item name"></label>`}
    <label><span>Worn in</span>${sel(p('slot'), WEARABLE(), { rerender: true })}</label>
    <label><span>Qty</span>${inp(p('qty'), { type: 'num', cls: 'w3', rerender: true })}</label>
    <label><span>Weight (each)</span>${inp(p('weight'), { type: 'num', cls: 'w3' })}</label>
    <label><span>Value</span>${inp(p('value'), { cls: 'w6' })}</label>
    <div class="wide item-fx">
      <div>${fx.length ? esc(effectsText(fx)) : '<span class="muted">none</span>'}${fx.length && !g.slot ? ' <span class="small bad">not worn yet, so they do not count</span>' : ''}</div>
      <div class="row" style="gap:6px;margin-top:4px"><button class="btn small" data-item-fx>✦ ${fx.length ? 'Edit' : 'Add'} bonuses</button>${!fx.length && sug.length ? `<button class="btn small" data-item-fx-auto title="Fill in what this kind of item normally gives">Use the usual: ${esc(effectsText(sug))}</button>` : ''}</div></div>
    ${g.id ? '' : `<label class="wide"><span>Your notes</span><textarea class="item-notes-big" data-bind="${p('notes')}" rows="10" placeholder="Describe the item, what it does, where you got it...">${esc(g.notes || '')}</textarea></label>`}
    <div class="wide row end"><button class="btn small danger" data-item-del>Remove from inventory</button></div></div>`;
  // A compendium item already has its text, so your own notes go at the bottom of the page
  const body = it.el.parentElement?.querySelector('.entry-body');
  body?.querySelector('.item-foot')?.remove();
  if (g.id && body) body.insertAdjacentHTML('beforeend', `<div class="item-foot"><label class="small muted">Your notes</label><textarea data-bind="${p('notes')}" rows="5" placeholder="Anything to remember about it">${esc(g.notes || '')}</textarea></div>`);
  it.el.onchange = e => {
    if (!e.target.matches('[data-item-name]')) return;
    g.name = e.target.value;
    const h2 = document.querySelector('#drawer h2'); if (h2) h2.textContent = g.name || 'New item';
    changed({ rerender: true });
  };
  it.el.onclick = async e => {
    if (e.target.closest('[data-item-fx]')) {
      const m = await editModifier({ name: g.name || 'Item', note: '', active: true, effects: structuredClone(g.effects || []).concat(g.effects?.length ? [] : [{ target: 'ac', value: 1, type: 'untyped' }]) });
      if (m) { g.effects = m.effects; changed({ rerender: true }); renderItemActions(); }
      return;
    }
    if (e.target.closest('[data-item-fx-auto]')) { g.effects = suggestEffects(g.name); changed({ rerender: true }); renderItemActions(); return; }
    if (!e.target.closest('[data-item-del]')) return;
    if (!await confirmBox(`Remove “${g.name || 'this item'}” from your inventory?`, 'Remove')) return;
    c.gear.splice(it.i, 1);
    itemDrawer = null;
    closeDrawer();
    changed({ rerender: true });
  };
}

document.addEventListener('entry-shown', e => {
  const sd = spellDrawer;
  if (sd?.armed && (e.detail.entry.id ?? null) === sd.id) { sd.armed = false; sd.el = e.detail.actions; renderSpellActions(); }
  else if (e.detail.back && parkedSpell && (e.detail.entry.id ?? null) === parkedSpell.id) { // Back to the spell: its actions return
    spellDrawer = parkedSpell; parkedSpell = null; spellDrawer.el = e.detail.actions; renderSpellActions();
  } else { // the panel moved on to something else
    if (sd) parkedSpell = sd;
    clearActiveSpell();
  }
});
document.addEventListener('drawer-closed', () => { parkedSpell = null; clearActiveSpell(); });
document.addEventListener('spell-changed', () => renderSpellActions()); // a roll counted as casting the open spell

/** Fills the side panel's action area for the open spell. Called again after every change so the numbers stay right. */
function renderSpellActions() {
  const sd = spellDrawer;
  if (!sd?.el?.isConnected) return;
  if (sd.cls === SLA) return renderSlaActions();
  const c = state.char, d = state.derived;
  const book = c.spellbooks[sd.cls], s = book?.spells[sd.i], sc = d?.spellcasting?.[sd.cls];
  if (!s || !sc) { sd.el.innerHTML = ''; return; }
  const l = s.level, prepared = sc.kind === 'prepared' || sc.kind === 'arcanist', spont = sc.kind === 'spontaneous' || sc.kind === 'arcanist';
  const left = num(s.prepared);
  sd.el.dataset.cls = sd.cls; // the roll window finds the caster class from here
  sd.el.innerHTML = `<div class="sp-actions">
      <div class="sp-group">
        ${s.id ? `<span data-spell-slot="${sd.i}" data-spell-id="${s.id}"></span>` : `<button class="btn" data-spell-roll="${sd.i}" title="Roll an attack, concentration or the damage for this spell">🎲 Roll</button>`}
        ${summonSpell(s.name) ? `<button class="btn" data-summon="${esc(s.name)}" data-summon-cls="${esc(sd.cls)}" title="Choose a creature; it is added to Companions → Summons">✨ Summon…</button>` : ''}
      </div>
      ${prepared ? `<div class="sp-group" title="Prepared and not cast yet. Casting uses one; Rest gives them back.">
        <span class="sp-group-label">Prepared</span>
        <span class="stepper"><button data-sa="prep" data-d="-1" title="One fewer prepared" aria-label="One fewer prepared">−</button><input type="number" min="0" data-sa-prep value="${left}" aria-label="Prepared"><button data-sa="prep" data-d="1" title="One more prepared" aria-label="One more prepared">＋</button></span>
      </div>` : ''}
      ${l > 0 && sc.kind === 'prepared' ? `<div class="sp-group">
        <button class="btn primary sp-cast" data-sa="cast" ${left <= 0 ? 'disabled' : ''} title="${left <= 0 ? 'None prepared' : 'Cast it: uses up one prepared copy until you rest'}">Cast</button>
        ${num(s.cast) ? `<span class="sp-cast-n" title="Cast since your last rest">cast ${num(s.cast)}</span>` : ''}
      </div>` : ''}
      ${l > 0 && spont ? `<div class="sp-group">
        <button class="btn primary sp-cast" data-sa="cast-spont" ${slotsLeft(book, sc, l) <= 0 ? 'disabled' : ''} title="${slotsLeft(book, sc, l) <= 0 ? 'No slots left at this level' : 'Cast it: uses one ' + ORD[l] + '-level slot. Prepared spells can be cast again while you have slots.'}">Cast</button>
      </div>` : ''}
    </div>
    ${s.id ? '' : `<div class="sp-custom"><label class="small muted">Name</label><input class="grow" data-sa-name value="${esc(s.name || '')}" placeholder="Spell name"><label class="small muted">Description</label><textarea rows="5" data-sa-notes placeholder="What it does">${esc(s.notes || '')}</textarea></div>`}`;
  fillSpellRolls(sd.el);
  const body = sd.el.parentElement?.querySelector('.entry-body');
  if (body) {
    body.querySelector('.sp-foot')?.remove();
    const foot = document.createElement('div');
    foot.className = 'sp-foot';
    foot.innerHTML = `<button class="btn danger-solid" title="Remove this spell from your ${esc(sd.cls)} list">Delete spell</button>`;
    body.appendChild(foot);
    foot.querySelector('button').onclick = async () => {
      if (!(await confirmBox(`Remove ${s.name || 'this spell'} from your ${sd.cls} spells?`, 'Delete spell'))) return;
      book.spells.splice(sd.i, 1);
      closeDrawer();
      changed({ rerender: true });
    };
  }
  sd.el.onclick = async e => {
    const b = e.target.closest('[data-sa]');
    if (!b) return;
    const act = b.dataset.sa;
    if (act === 'prep') s.prepared = Math.max(0, num(s.prepared) + +b.dataset.d);
    else if (act === 'slot') book.used[l] = Math.min(sc.slots[l], Math.max(0, num(book.used[l]) - +b.dataset.d)); // + = a slot back, - = one spent
    else if (act === 'cast') { if (num(s.prepared) <= 0) return; s.prepared = num(s.prepared) - 1; s.cast = num(s.cast) + 1; }
    else if (act === 'cast-spont') {
      if (slotsLeft(book, sc, l) <= 0) { toast(`No ${ORD[l]}-level slots left`, 'err'); return; }
      book.used[l] = num(book.used[l]) + 1;
      const n = slotsLeft(book, sc, l);
      toast(`${s.name || 'Spell'} cast. ${n} ${n === 1 ? 'slot' : 'slots'} left at ${ORD[l]} level`);
    }
    changed({ rerender: true });
    renderSpellActions();
  };
  sd.el.onchange = e => {
    if (e.target.matches('[data-sa-prep]')) s.prepared = Math.max(0, Math.round(num(e.target.value)));
    else if (e.target.matches('[data-sa-name]')) { s.name = e.target.value; const h2 = document.querySelector('#drawer h2'); if (h2) h2.textContent = s.name || 'New spell'; }
    else if (e.target.matches('[data-sa-notes]')) s.notes = e.target.value;
    else return;
    changed({ rerender: true });
    renderSpellActions();
  };
}

/** A row of small circles for a level's slots: filled = still available, ringed = used, dashed = not filled. Nothing when there are too many to draw. */
function slotPips(full, used, empty, title) {
  const n = full + used + empty;
  if (!n || n > 14) return '';
  return `<span class="slot-pips" title="${esc(title)}">${'<i class="spip full"></i>'.repeat(full)}${'<i class="spip used"></i>'.repeat(used)}${'<i class="spip empty"></i>'.repeat(empty)}</span>`;
}
function spontPips(book, sc, l) {
  const n = sc.slots[l];
  if (n == null || n === Infinity) return '';
  const left = slotsLeft(book, sc, l);
  return slotPips(left, n - left, 0, `${left} of ${n} slots left`);
}
function preparedPips(book, sc, l) {
  const n = sc.slots[l];
  if (n == null || n === Infinity) return '';
  let ready = 0, spent = 0;
  for (const sp of book.spells) if (sp.level === l) { ready += num(sp.prepared); spent += num(sp.cast); }
  const full = Math.min(ready, n), used = Math.min(spent, n - full);
  return slotPips(full, used, Math.max(0, n - full - used), `${full} prepared, ${used} cast, ${Math.max(0, n - full - used)} slots not filled`);
}
/** Slots still free at a spell level for a spontaneous caster (the Used box counts the ones spent). */
const slotsLeft = (book, sc, l) => (sc.slots[l] == null ? 0 : sc.slots[l] === Infinity ? Infinity : Math.max(0, sc.slots[l] - num((book.used || [])[l])));
const fmtSlots = v => (v == null ? '—' : v === Infinity ? '∞' : v);
const knownCount = (book, l) => book.spells.filter(s => s.level === l).length;
// the day's preparation: what is left plus what has been cast, so casting does not look like unpreparing
const preparedCount = (book, l) => book.spells.filter(s => s.level === l).reduce((a, s) => a + num(s.prepared) + num(s.cast), 0);

export function pickSpell(cls, sc, level) {
  return modal(`Add ${cls} spell`, (body, close) => {
    body.innerHTML = `<div class="row">
        <input class="search grow" placeholder="Search spell names…">
        <select data-f="level"></select>
        <select data-f="school" title="Filter by school of magic, elemental school (Metal, Wood, Fire...) or subschool"><option value="">Any school</option>${SPELL_FILTERS.map(([group, list]) => `<optgroup label="${esc(group)}">${list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</optgroup>`).join('')}</select>
      </div>
      <div class="row"><label class="small">Spell list <select data-f="list" title="Whose spell list to look through. Your own class is the default; pick another when you can learn that class's spells (a scroll, a feat, a bloodline...).">
          <option value="">${esc(cls)} (${esc(sc.lists.join(', '))})</option>${SPELL_LIST_CLASSES.filter(k => !sc.lists.includes(k)).map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
        <span class="small muted" data-hint></span></div>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a spell to preview it.</p></div></div>`;
    const q = $('input', body), lv = $('[data-f=level]', body), sch = $('[data-f=school]', body), which = $('[data-f=list]', body), hint = $('[data-hint]', body);
    const list = $('.picker-list', body), prev = $('.picker-preview', body);
    let rows = [], seq = 0;
    // Your own class offers the levels you can cast; another class's list offers all of them (the spell goes on your list at the level that class has it).
    const fillLevels = (max, keep) => { lv.innerHTML = ['', ...Array.from({ length: max + 1 }, (_, i) => i)].map(l => `<option value="${l}" ${String(l) === String(keep) ? 'selected' : ''}>${l === '' ? 'Any level' : 'Level ' + l}</option>`).join(''); };
    fillLevels(sc.maxLevel, level);
    const run = debounce(async () => {
      const my = ++seq;
      const res = await api.spells(which.value || sc.lists.join(','), lv.value, q.value, sch.value);
      if (my !== seq) return;
      rows = res;
      list.innerHTML = rows.map((r, i) => `<div class="pick-row" data-i="${i}">
        <div><b>${esc(r.name)}</b> <span class="muted small">L${r.level} · ${esc(r.school || '')}</span></div>
        <div class="muted small">${esc(r.summary || '')}</div><button class="btn small primary" data-pick="${i}">Add</button></div>`).join('') || '<p class="pad muted">No spells match.</p>';
    }, 120);
    [q, lv, sch].forEach(x => x.addEventListener('input', run));
    which.addEventListener('input', () => {
      fillLevels(which.value ? 9 : sc.maxLevel, '');
      hint.textContent = which.value ? `Added to your ${cls} spells at the level ${which.value}s have it.` : '';
      run();
    });
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
  ${paperDollCard(c, d)}
  <section class="card span2">
    <div class="row"><h3 class="grow">Armor & Shields</h3><button class="btn small" data-pick-armor>＋ Magic item</button><button class="btn small" data-add-armor title="Pick standard armor or a shield, or start with a blank row">＋ Add armor/shield</button></div>
    ${c.armor.length ? `<table class="tbl"><thead><tr><th>Worn</th><th>Name</th><th>Type</th><th>Category</th><th title="Armor/shield bonus">Bonus</th><th title="Enhancement">Enh</th>
      <th title="Max Dex bonus (blank = none)">Max Dex</th><th title="Armor check penalty">ACP</th><th title="Arcane spell failure %">ASF %</th><th>Weight</th><th></th></tr></thead><tbody>
      ${c.armor.map((a, i) => `<tr><td>${chk(`armor.${i}.equipped`)}</td><td class="w10"${entryAttrs(a)}>${tf(`armor.${i}.name`, { placeholder: 'Name' })}${armorFxChip(c, i)}</td>
        <td>${sel(`armor.${i}.type`, [['armor', 'Armor'], ['shield', 'Shield']], { rerender: true })}</td>
        <td>${sel(`armor.${i}.category`, [['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']])}</td>
        <td>${inp(`armor.${i}.bonus`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.enh`, { type: 'num', cls: 'w2', rerender: true })}</td>
        <td>${inp(`armor.${i}.maxDex`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.acp`, { type: 'num', cls: 'w2' })}</td>
        <td>${inp(`armor.${i}.asf`, { type: 'num', cls: 'w2' })}</td><td>${inp(`armor.${i}.weight`, { type: 'num', cls: 'w3' })}</td>
        <td><button class="icon-btn" data-del="armor.${i}">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No armor.</p>'}
  </section>
  <section class="card span2">
    <div class="row"><h3 class="grow">Inventory</h3>
      <button class="btn small ghost" data-sort-gear title="Put the inventory in alphabetical order">A–Z</button><button class="btn small" data-pick-item>＋ Magic item</button><button class="btn small" data-add="gear">＋ Item</button></div>
    ${c.gear.length ? `<div class="sp-chips inv-chips">${c.gear.map((g, i) => {
      const worn = !!g.slot, qty = num(g.qty) > 1 ? `<span class="sp-s">×${esc(g.qty)}</span>` : '';
      const fxMark = (g.effects || []).length ? `<span class="sp-s" title="${esc(effectsText(g.effects))}${worn ? '' : ' (counts once worn)'}">✦</span>` : '';
      const where = worn ? `<span class="sp-s">${esc(slotName(g.slot))}</span><span class="pips"><i class="pip"></i></span>` : '';
      return `<button class="sp-chip ${isItemActive(i) ? 'on' : ''} ${worn ? 'ready' : g.hint ? 'idle' : ''}" data-item="${i}" title="${worn ? 'Equipped: ' + esc(slotName(g.slot)) + '. ' : ''}Click for details"><span class="sp-n">${esc(g.name || 'New item')}</span>${qty}${fxMark}${where}</button>`;
    }).join('')}</div>` : '<p class="muted">Nothing carried.</p>'}
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
    <div class="row"><h3 class="grow">${ref('Carrying Capacity', 'Rules', 'Encumbrance')}</h3>
      <label class="small"><input type="checkbox" data-bind="noEncumbrance" ${c.noEncumbrance ? 'checked' : ''} data-rerender> Ignore encumbrance</label></div>
    <div class="stat-row">
      <div class="stat"><div class="label">Carried</div><span class="big">${calc('encumbrance.weight')}</span> lb</div>
      <div class="stat"><div class="label">Light</div>≤ ${calc('encumbrance.light')}</div>
      <div class="stat"><div class="label">Medium</div>≤ ${calc('encumbrance.medium')}</div>
      <div class="stat"><div class="label">Heavy</div>≤ ${calc('encumbrance.heavy')}</div>
    </div>
    ${enc.off ? '' : `<p>Load: <b class="${enc.load === 'light' ? 'good' : 'bad'}">${calc('encumbrance.load')}</b>
    ${enc.load === 'medium' ? '· max Dex +3, ACP −3, reduced speed' : enc.load === 'heavy' ? '· max Dex +1, ACP −6, reduced speed, run ×3' : enc.load === 'overloaded' ? '· can only move 5 ft. per round' : ''}</p>`}
  </section></div>`;
  wireCommon(body);
  wireArmorFx(body);
  $('[data-pick-armor]', body).onclick = () => addMagicGear('armor');
  $('[data-add-armor]', body).onclick = () => addFromList('armor');
  wirePaperDoll(body);
  body.addEventListener('click', e => { const t = e.target.closest('[data-item]'); if (t) openItem(+t.dataset.item); });
  const upd = () => { $('#money-total').textContent = (num(c.money.pp) * 10 + num(c.money.gp) + num(c.money.sp) / 10 + num(c.money.cp) / 100).toLocaleString(); };
  upd();
  document.addEventListener('recalc', upd);
  onLeave(() => document.removeEventListener('recalc', upd));
  $('[data-sort-gear]', body).onclick = () => {
    if (c.gear.length < 2) return;
    c.gear = sortByName(c.gear);
    if (itemDrawer) { itemDrawer = null; closeDrawer(); } // the open item's place in the list has changed
    changed({ rerender: true });
  };
  $('[data-pick-item]', body).onclick = async () => {
    const r = await pickEntry('Add magic item', 'Magic Item');
    if (!r) return;
    const en = await api.entry(r.id);
    const w = parseFloat((en.html.match(/<dt>Weight<\/dt><dd>([\d.]+)/) || [])[1]) || 0;
    const price = (en.html.match(/<dt>Price<\/dt><dd>([^<]+)/) || [])[1] || '';
    c.gear.push({ id: r.id, name: r.name, qty: 1, weight: w, value: price, notes: '', slot: '', hint: hintFromSub(r.sub), effects: suggestEffects(r.name) });
    changed({ rerender: true });
    openItem(c.gear.length - 1);
  };
}

// =====================================================================
// BUFFS
// =====================================================================
function buffs(body, c, d) {
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
    ${BUFF_GROUPS.map(g => `<h4>${esc(g)}</h4><div class="chips">${presetsIn(g).map(p => {
      const on = c.modifiers.find(m => m.name === p.name && m.active);
      return `<button class="chip ${on ? 'on' : ''}" data-preset="${esc(p.name)}" title="${esc(p.note || '')}">${esc(p.name)}</button>`;
    }).join('')}</div>`).join('')}
    <p class="small muted">Power Attack, Deadly Aim, and Combat Expertise scale with your BAB automatically.</p>
  </section></div>`;
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
// NOTES
// =====================================================================
export const ATTITUDES = [['ally', 'Ally'], ['friendly', 'Friendly'], ['neutral', 'Neutral'], ['wary', 'Wary'], ['hostile', 'Hostile'], ['unknown', 'Unknown']];
export const LORE_KINDS = ['Place', 'Faction', 'Item', 'Lore'];

/** Story notes: free text, quests, NPCs, places and factions, and a session log (newest first), one inner tab each. */
const NOTE_TABS = [['general', 'General notes'], ['story', 'Story'], ['quests', 'Quests & goals'], ['npcs', 'People'], ['lore', 'Places & lore'], ['sessions', 'Session log']];
let notesTab = 'general';

function notes(body, c) {
  const entries = key => (c[key] || []).map((x, i) => ({ x, i }));
  const quest = ({ x, i }) => `<div class="note-row quest ${x.done ? 'done' : ''}">
      ${chk(`quests.${i}.done`, { rerender: true, title: 'Done' })}
      ${inp(`quests.${i}.name`, { cls: 'grow', ph: 'Quest, goal or lead' })}
      <button class="icon-btn" data-del="quests.${i}" title="Remove">✕</button>
      <textarea class="full" rows="2" data-bind="quests.${i}.notes" placeholder="Who gave it, reward, what you know…">${esc(x.notes || '')}</textarea></div>`;
  const npc = ({ x, i }) => `<div class="note-card att-${esc(x.attitude || 'unknown')}">
      <div class="row">${inp(`npcs.${i}.name`, { cls: 'grow', ph: 'Name' })}<button class="icon-btn" data-del="npcs.${i}" title="Remove">✕</button></div>
      <div class="row">${inp(`npcs.${i}.role`, { cls: 'grow', ph: 'Who they are' })}${sel(`npcs.${i}.attitude`, ATTITUDES, { rerender: true })}</div>
      ${inp(`npcs.${i}.where`, { cls: 'full', ph: 'Where to find them' })}
      <textarea class="full" rows="4" data-bind="npcs.${i}.notes" placeholder="What they want, what they know, how they spoke…">${esc(x.notes || '')}</textarea></div>`;
  const lore = ({ x, i }) => `<div class="note-card">
      <div class="row">${inp(`lore.${i}.name`, { cls: 'grow', ph: 'Name' })}${sel(`lore.${i}.kind`, LORE_KINDS)}<button class="icon-btn" data-del="lore.${i}" title="Remove">✕</button></div>
      <textarea class="full" rows="4" data-bind="lore.${i}.notes" placeholder="Details…">${esc(x.notes || '')}</textarea></div>`;
  const session = ({ x, i }) => `<div class="note-card session">
      <div class="row">${inp(`sessions.${i}.date`, { cls: 'w8', ph: 'Date' })}${inp(`sessions.${i}.name`, { cls: 'grow', ph: 'Session title or one-line recap' })}<button class="icon-btn" data-del="sessions.${i}" title="Remove">✕</button></div>
      <textarea class="full" rows="8" data-bind="sessions.${i}.notes" placeholder="What happened, decisions, loot, what to do next…">${esc(x.notes || '')}</textarea></div>`;
  const grid = (key, fn, empty, one) => `<div class="note-grid ${one ? 'one' : ''}">${(c[key] || []).length ? entries(key).map(fn).reverse().join('') : `<p class="muted small">${empty}</p>`}</div>`;
  const panels = {
    story: () => `<h3>Story</h3>
      <textarea data-bind="story" class="full story-text" placeholder="The plot so far, what the party is after, theories, loose threads…">${esc(c.story || '')}</textarea>`,
    general: () => `<h3>General notes</h3>
      <textarea data-bind="notes" class="full story-text" placeholder="Anything else: house rules, loot to sell, contacts, reminders…">${esc(c.notes || '')}</textarea>`,
    quests: () => {
      const open = entries('quests').filter(q => !q.x.done), done = entries('quests').filter(q => q.x.done);
      return `<h3>Quests &amp; goals <button class="btn small ghost" data-add="quests">＋ Add</button></h3>
        ${open.length ? open.map(quest).join('') : '<p class="muted small">Nothing open. Add the jobs, leads and personal goals you are chasing.</p>'}
        ${done.length ? `<h4 class="muted">Done</h4>${done.map(quest).join('')}` : ''}`;
    },
    npcs: () => `<h3>People (NPCs) <button class="btn small ghost" data-add="npcs">＋ Add</button></h3>
      ${grid('npcs', npc, 'Who have you met? Note their name, what they want and whether they can be trusted.')}`,
    lore: () => `<h3>Places, factions &amp; lore <button class="btn small ghost" data-add="lore">＋ Add</button></h3>
      ${grid('lore', lore, 'Towns, guilds, cults, famous items, rumours you want to keep straight.')}`,
    sessions: () => `<h3>Session log <button class="btn small ghost" data-add="sessions">＋ New session</button></h3>
      ${grid('sessions', session, 'Add a session after each game so you can remember what happened. The newest is first.', true)}`,
  };
  const draw = () => {
    if (!panels[notesTab]) notesTab = 'general';
    const count = k => (Array.isArray(c[k]) ? c[k].length : 0);
    body.innerHTML = `<div class="notes-tab">
      <div class="subtabs" role="tablist">${NOTE_TABS.map(([k, l]) => `<button class="subtab ${k === notesTab ? 'active' : ''}" role="tab" data-note-tab="${k}">${l}${count(k) ? ` <span class="count">${count(k)}</span>` : ''}</button>`).join('')}</div>
      <section class="card">${panels[notesTab]()}</section></div>`;
  };
  draw();
  wireCommon(body);
  body.addEventListener('click', e => {
    const t = e.target.closest('[data-note-tab]');
    if (t) { notesTab = t.dataset.noteTab; draw(); }
  });
  // adding or removing an entry redraws the whole sheet, which comes back here with the same inner tab
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
    <h3>Biography</h3>
    <textarea data-bind="bio" class="full bio-text" placeholder="Who is your character? Where they come from, what they want, what they fear, how they got here…">${esc(c.bio || '')}</textarea>
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
