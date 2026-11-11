import { state, changed, go, render } from '../app.js';
import { compute, sign, num, classLevels, advanceable, raceInfo, mod } from '../calc.js';
import { ABILITIES, ABILITY_NAMES, RACES, POINT_BUY, SKILL_BY_NAME, FEAT_TYPES } from '../data.js';
import { skillKey } from '../model.js';
import { api } from '../api.js';
import { playSfx } from '../sfx.js';
import { featuresFor, archetypesOf } from '../features.js';
import { learnAllowance, favoritesAllowance, remaining, describeRemaining } from '../spellrules.js';
import { esc, $, $$, pickEntry, toast, confirmBox, warnBox, showCustom } from '../ui.js';
import { levelWarnings } from '../levelcheck.js';
import { featureLookupName } from './sheet.js';
import { chooseArchetypes } from './archetypes.js';
import { chooseTraits } from './traitpicker.js';
import { traitAllowance, countTraits } from '../traits.js';
import { racialTraitsOf, remainingBaseline, alternativesFor, replacesOf } from '../racetraits.js';
import { chooseSpells } from './spellpicker.js';
import { ROLL_METHODS, rollSet, assignRoll, rolledBases, diceText, setQuality, unplaced } from '../statroll.js';
import { startingWealth, rollStartingGold } from '../wealth.js';

let draft = null;
let fcbData = null; // racial favored class options, loaded once
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function freshDraft(c) {
  return { forLevel: c.levelUps.length, charId: c.id, cls: null, hpMode: 'avg', hpRoll: null, hpManual: '', fcb: 'hp', fcbNote: '',
    abilityIncrease: '', ranks: {}, feats: [], traits: [], racial: [], racialRace: '', spellsBy: {}, favsBy: {}, advances: [], archetypes: [], notes: '', budget: 20,
    scoreMode: c.abilityRolls ? 'roll' : 'pb', rollMethod: c.abilityRolls?.method || 'standard' };
}

export function renderLevelUp(main) {
  const c = state.char;
  if (!draft || draft.forLevel !== c.levelUps.length || draft.charId !== c.id) draft = freshDraft(c);
  const d = state.derived;
  const newLevel = d.level + 1;
  if (newLevel > 20) {
    main.innerHTML = '<div class="page narrow"><section class="card"><h2>Level 20</h2><p>Your character is at the maximum level. Mythic tiers are tracked in notes.</p></section></div>';
    return;
  }
  if (!fcbData) api.fcb().then(x => { fcbData = x; if (state.view === 'levelup') render({ keepScroll: true }); }).catch(() => { fcbData = {}; });
  main.innerHTML = `<div class="page levelup">
    <div class="row"><h1 class="grow">${d.level === 0 ? 'Create character · 1st level' : `Level up · ${ORD(d.level)} → ${ORD(newLevel)} level`}</h1>
      ${d.level > 0 ? '<button class="btn ghost" data-cancel>Back to sheet</button>' : ''}</div>
    ${d.level === 0 ? basicsCard(c, d) : ''}
    <section class="card"><h3>1 · Choose a class</h3>${classPicker(c)}</section>
    ${d.level === 0 && !draft.cls ? goldCard(c) : ''}
    <div id="lu-detail"></div>
  </div>`;
  const cancel = $('[data-cancel]', main);
  if (cancel) cancel.onclick = () => go('sheet');
  wireBasics(main, c);
  wireGold(main, c);
  $$('[data-pick-class]', main).forEach(b => (b.onclick = () => {
    draft.cls = b.dataset.pickClass;
    draft.ranks = {}; draft.spellsBy = {}; draft.favsBy = {};
    draft.archetypes = [...archetypesOf(c, draft.cls)];
    draft.advances = defaultAdvances(c, state.classesByName[draft.cls]);
    if (newLevel === 1) draft.hpMode = 'max';
    render();
  }));
  if (draft.cls) detail($('#lu-detail', main), c, d, newLevel);
}

// ---------------------------------------------------------------- basics (1st level only)
function basicsCard(c, d) {
  const r = RACES[c.race] || {};
  const spent = ABILITIES.reduce((s, a) => s + (POINT_BUY[num(c.abilities[a].base)] ?? NaN), 0);
  return `<section class="card"><h3>Basics</h3>
    <div class="grid two">
      <div class="form">
        <label>Name <input data-bind="name" value="${esc(c.name)}" class="full"></label>
        <label>Race <select data-bind="race" data-rerender>${Object.keys(RACES).map(k => `<option ${k === c.race ? 'selected' : ''}>${k}</option>`).join('')}</select>
          ${c.race !== 'Custom' ? `<a href="#" class="ref" data-entry="${esc(c.race)}" data-cat="Race">read about ${esc(c.race)}s</a>` : '<span class="muted small">Set custom racial modifiers on the Bio tab.</span>'}</label>
        ${r.flex ? `<label>+2 to <select data-bind="raceChoice" data-rerender>${ABILITIES.map(a => `<option value="${a}" ${a === c.raceChoice ? 'selected' : ''}>${ABILITY_NAMES[a]}</option>`).join('')}</select></label>` : ''}
        <p class="small muted">${raceSummary(c)}</p>
      </div>
      <div>
        <div class="row"><b class="grow">Ability scores</b>
          <div class="seg" role="group"><button class="seg-btn ${draft.scoreMode === 'pb' ? 'on' : ''}" data-score-mode="pb">Point buy</button><button class="seg-btn ${draft.scoreMode === 'roll' ? 'on' : ''}" data-score-mode="roll">🎲 Roll</button></div></div>
        ${draft.scoreMode === 'roll' ? rollPanel(c) : pointBuyPanel(c, spent)}
      </div>
    </div></section>`;
}
function pointBuyPanel(c, spent) {
  return `<div class="row"><span class="grow"></span><label class="small">Budget <select id="pb-budget">${[10, 15, 20, 25].map(b => `<option ${b === draft.budget ? 'selected' : ''} value="${b}">${b} (${{ 10: 'low fantasy', 15: 'standard', 20: 'high fantasy', 25: 'epic' }[b]})</option>`).join('')}</select></label></div>
        <table class="tbl"><thead><tr><th></th><th>Base</th><th></th><th>Cost</th><th>Racial</th><th>Final</th><th>Mod</th></tr></thead><tbody>
          ${ABILITIES.map(a => {
            const base = num(c.abilities[a].base);
            const racial = raceInfo(c).mods[a] || 0;
            return `<tr><th>${a.toUpperCase()}</th>
              <td><input type="number" class="num w3" data-bind="abilities.${a}.base" data-type="num" data-rerender value="${base}"></td>
              <td class="nowrap"><button class="icon-btn" data-pb="${a}" data-d="-1">−</button><button class="icon-btn" data-pb="${a}" data-d="1">＋</button></td>
              <td class="dim">${POINT_BUY[base] ?? '—'}</td><td class="dim">${racial ? sign(racial) : ''}</td>
              <td><b>${base + racial}</b></td><td class="accent"><b>${sign(mod(base + racial))}</b></td></tr>`;
          }).join('')}</tbody></table>
        <div class="small ${spent > draft.budget ? 'bad' : spent === draft.budget ? 'good' : 'muted'}">Points spent: <b>${isNaN(spent) ? 'n/a' : spent}</b> / ${draft.budget}
          ${isNaN(spent) ? '(rolled scores? Use 🎲 Roll above, or just type them in.)' : ''}</div>`;
}
function rollPanel(c) {
  const set = c.abilityRolls;
  const head = `<div class="row"><label class="small">Method <select id="roll-method">${Object.entries(ROLL_METHODS).map(([k, m]) => `<option value="${k}" ${k === draft.rollMethod ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
    <span class="grow"></span><button class="btn ${set ? '' : 'primary'}" data-roll-scores>🎲 ${set ? 'Roll a new set' : 'Roll scores'}</button></div>`;
  if (!set) return head + `<div class="roll-empty"><span class="roll-empty-die">🎲</span><div><b>Roll six scores</b><br>
    <span class="small muted">Then drag each roll onto the ability you want it for.</span></div></div>`;
  const q = setQuality(set);
  const fresh = draft.justRolled === set.times; // animate the tiles only right after a roll
  const plus = ROLL_METHODS[set.method]?.plus;
  const tile = (i, n = 0) => {
    const r = set.rolls[i];
    return `<div class="roll-tile ${pickedRoll === i ? 'picked' : ''} ${fresh ? 'fresh' : ''}" style="--i:${n}" data-roll-idx="${i}" title="${esc(diceText(r, set.method))}${pickedRoll === i ? '' : ' · drag onto an ability'}">
      <b>${r.total}</b><small>${r.dice.map((v, j) => j === r.drop ? `<s>${v}</s>` : `<span>${v}</span>`).join('')}${plus ? `<em>+${plus}</em>` : ''}</small></div>`;
  };
  const pool = unplaced(set);
  const pbAll = set.rolls.reduce((s, r) => s + (POINT_BUY[r.total] ?? NaN), 0);
  draft.justRolled = null;
  return head + `<div class="roll-pool ${pool.length ? '' : 'done'} ${pickedRoll != null ? 'picking' : ''}" data-roll-slot="">
      ${pool.length ? `<span class="roll-pool-label">${pool.length === 6 ? 'Your rolls' : `${pool.length} left`}</span>${pool.map((i, n) => tile(i, n)).join('')}`
        : '<span class="small">✓ Every roll is placed. Drag one back here to take it off.</span>'}</div>
    <table class="tbl roll-table"><tbody>
    ${ABILITIES.map(a => {
      const has = set.assign[a] != null, racial = raceInfo(c).mods[a] || 0, score = num(c.abilities[a].base) + racial, m = mod(score);
      return `<tr class="${has ? '' : 'empty'}"><th>${a.toUpperCase()}<small>${ABILITY_NAMES[a]}</small></th>
        <td><div class="roll-slot ${has ? 'full' : ''}" data-roll-slot="${a}">${has ? tile(set.assign[a]) : '<span>drop here</span>'}</div></td>
        <td class="roll-race">${racial ? `<span class="pill ${racial > 0 ? 'good' : 'bad'}">${sign(racial)} race</span>` : ''}</td>
        <td class="roll-final">${has ? `<b>${score}</b>` : '<span class="dim">—</span>'}</td>
        <td class="roll-mod">${has ? `<span class="${m > 0 ? 'good' : m < 0 ? 'bad' : 'muted'}">${sign(m)}</span>` : ''}</td></tr>`;
    }).join('')}</tbody></table>
    <div class="roll-foot">
      <span class="pill">${esc(ROLL_METHODS[set.method]?.label || set.method)}</span>
      <span class="pill" title="How many sets were rolled for this character">${set.times === 1 ? '1st set' : `set ${set.times}`}</span>
      <span class="pill ${q.low ? 'warn' : ''}" title="The six modifiers added up, before race">mods ${sign(q.mods)}</span>
      <span class="pill" title="What these six scores would cost in point buy">${isNaN(pbAll) ? 'beyond point buy' : `= ${pbAll}-point buy`}</span>
    </div>
    ${q.low ? '<div class="roll-weak small">A weak set: the Core Rulebook lets you reroll when the modifiers add up to +0 or less, or no score is above 13.</div>' : ''}
    <div class="small muted">Drop a roll on an ability that has one to swap them, or double-click it to put it back. No mouse? Click a roll, then an ability.</div>`;
}
let pickedRoll = null; // a roll clicked to be placed by a click on an ability (the no-drag way)
let lastTap = { idx: null, t: 0 };
/**
 * Dragging a roll tile with pointer events (mouse, pen or touch; the browser's own drag and drop does not work on touch screens).
 * A copy of the tile follows the pointer; letting go over an ability's slot or the pool places it there. A press without moving is a click: it picks the roll.
 */
function wireRollTile(c, t, main) {
  const idx = +t.dataset.rollIdx;
  t.onpointerdown = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY }, box = t.getBoundingClientRect();
    let ghost = null, over = null;
    const target = ev => {
      if (ghost) ghost.style.display = 'none';
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-roll-slot]');
      if (ghost) ghost.style.display = '';
      return el && main.contains(el) ? el : null;
    };
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        ghost = t.cloneNode(true);
        ghost.classList.add('roll-ghost');
        Object.assign(ghost.style, { width: box.width + 'px', height: box.height + 'px' });
        document.body.append(ghost);
        t.classList.add('dragging');
        main.classList.add('roll-dragging'); // lights up the places it can go
      }
      ghost.style.transform = `translate(${ev.clientX - (start.x - box.left)}px, ${ev.clientY - (start.y - box.top)}px)`;
      const el = target(ev);
      if (el !== over) { over?.classList.remove('over'); el?.classList.add('over'); over = el; }
    };
    const up = ev => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      t.removeEventListener('pointercancel', up);
      over?.classList.remove('over');
      t.classList.remove('dragging');
      main.classList.remove('roll-dragging');
      if (!ghost) { // a click; a second one soon after on a placed roll puts it back in the pool (the first redraws the page, so no dblclick event)
        const now = Date.now(), again = lastTap.idx === idx && now - lastTap.t < 400;
        lastTap = { idx, t: now };
        if (again && !t.closest('.roll-pool')) { placeRoll(c, '', idx); return; }
        pickedRoll = pickedRoll === idx ? null : idx;
        render({ keepScroll: true });
        return;
      }
      ghost.remove();
      const el = ev.type === 'pointerup' ? target(ev) : null;
      if (el) placeRoll(c, el.dataset.rollSlot, idx);
    };
    t.setPointerCapture(e.pointerId);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  };
  t.onclick = e => e.stopPropagation(); // the press is handled above; don't let the slot under it also take the click
}
function placeRoll(c, slot, idx) {
  pickedRoll = null;
  c.abilityRolls = assignRoll(c.abilityRolls, slot || null, idx);
  Object.entries(rolledBases(c.abilityRolls)).forEach(([a, v]) => (c.abilities[a].base = v));
  changed({ rerender: true });
}
function raceSummary(c) {
  const ri = raceInfo(c);
  const mods = Object.entries(ri.mods).filter(([, v]) => v).map(([k, v]) => `${sign(v)} ${k.toUpperCase()}`).join(', ');
  const r = RACES[c.race] || {};
  return `${mods || 'No ability modifiers'} · ${ri.size} · speed ${ri.speed} ft.${r.bonusFeat ? ' · bonus feat at 1st level · +1 skill rank per level' : ''}`;
}
function wireBasics(main, c) {
  const b = $('#pb-budget', main);
  if (b) b.onchange = () => { draft.budget = +b.value; render(); };
  $$('[data-score-mode]', main).forEach(btn => (btn.onclick = async () => {
    const m = btn.dataset.scoreMode;
    if (m === draft.scoreMode) return;
    if (m === 'pb' && c.abilityRolls) {
      if (!await confirmBox('Switch to point buy? The rolled scores are thrown away and every score goes back to 10.', 'Use point buy')) return;
      c.abilityRolls = null;
      for (const a of ABILITIES) c.abilities[a].base = 10;
      changed();
    }
    draft.scoreMode = m;
    render();
  }));
  const rm = $('#roll-method', main);
  if (rm) rm.onchange = () => { draft.rollMethod = rm.value; };
  const roll = $('[data-roll-scores]', main);
  if (roll) roll.onclick = async () => {
    if (c.abilityRolls && !await confirmBox(`Roll a new set? These scores are replaced, and the sheet counts how many sets you rolled (${c.abilityRolls.times} so far).`, 'Roll again')) return;
    c.abilityRolls = rollSet(draft.rollMethod, c.abilityRolls);
    pickedRoll = null;
    draft.justRolled = c.abilityRolls.times;
    Object.entries(rolledBases(c.abilityRolls)).forEach(([a, v]) => (c.abilities[a].base = v));
    changed({ rerender: true });
  };
  $$('[data-roll-idx]', main).forEach(t => wireRollTile(c, t, main));
  $$('[data-roll-slot]', main).forEach(s => (s.onclick = () => { if (pickedRoll != null) placeRoll(c, s.dataset.rollSlot, pickedRoll); }));
  $$('[data-pb]', main).forEach(btn => (btn.onclick = () => {
    const a = btn.dataset.pb;
    c.abilities[a].base = Math.max(7, Math.min(18, num(c.abilities[a].base) + +btn.dataset.d));
    changed({ rerender: true });
  }));
}

// ---------------------------------------------------------------- starting gold (creation only)
/** The gold this card would give: a roll made for the current class, else the table or the class average. */
function goldOffer() {
  const lv = draft.goldLevel || 1;
  const w = startingWealth(lv, draft.cls);
  const roll = lv === 1 && draft.goldRoll?.cls === draft.cls ? draft.goldRoll : null;
  const custom = customGold();
  return { lv, w, roll, custom, gp: custom ?? (roll ? roll.gp : w.gp) };
}
/** The amount typed in the Custom box, or null when it is empty or not a number of 0 or more. */
function customGold() {
  const v = String(draft.goldCustom ?? '').trim();
  const n = v === '' ? NaN : Math.round(+v * 100) / 100;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function goldCard(c) {
  const { lv, w, roll, gp, custom } = goldOffer();
  const have = num(c.money.pp) * 10 + num(c.money.gp) + num(c.money.sp) / 10 + num(c.money.cp) / 100;
  const body = lv > 1
    ? `<div class="gold-amount"><b>${w.gp.toLocaleString()} gp</b><span class="small muted">Character Wealth by Level, ${ORD(lv)} level. Spend no more than half of it on any single item.</span></div>`
    : !draft.cls ? '<p class="small muted">Choose a class above: a 1st-level character starts with its class’s starting wealth.</p>'
    : !w.dice ? `<p class="small muted">${esc(draft.cls)} has no starting wealth listed here. Type the gold in on the Inventory tab.</p>`
    : `<div class="row"><div class="seg" role="group">
        <button class="seg-btn ${roll ? '' : 'on'}" data-gold-avg>Average ${w.gp} gp</button>
        <button class="seg-btn ${roll ? 'on' : ''}" data-gold-roll>🎲 ${roll ? 'Roll again' : `Roll ${w.dice}d6 × 10`}</button></div></div>
      <div class="gold-amount"><b>${gp.toLocaleString()} gp</b><span class="small muted">${roll ? `${esc(draft.cls)}: (${roll.rolls.join(' + ')}) × 10` : esc(w.source)}</span></div>`;
  return `<section class="card gold-card"><h3>Starting gold</h3>
    <div class="row"><label class="small">Starting level <select id="gold-level">${Array.from({ length: 20 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === lv ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="grow"></span><span class="small muted">Purse now: ${have.toLocaleString()} gp</span></div>
    <div class="${custom != null ? 'gold-dim' : ''}" data-gold-body>${body}</div>
    <div class="row"><label class="small">Or a custom amount <input type="number" min="0" step="any" class="num w5" id="gold-custom" placeholder="gp" value="${esc(draft.goldCustom ?? '')}"> gp</label>
      <span class="small muted">Your GM’s number, if it differs. Leave it empty to use the one above.</span></div>
    <div class="row"><button class="btn primary" data-gold-set ${gp == null ? 'hidden' : ''}>Set gold to ${(gp ?? 0).toLocaleString()} gp</button>
      ${lv > 1 ? '<span class="small muted">Then finish 1st level and level up to the level you start at.</span>' : ''}</div>
  </section>`;
}
function wireGold(main, c) {
  const sel = $('#gold-level', main);
  if (sel) sel.onchange = () => { draft.goldLevel = +sel.value; render({ keepScroll: true }); };
  const avg = $('[data-gold-avg]', main);
  if (avg) avg.onclick = () => { draft.goldRoll = null; render({ keepScroll: true }); };
  const roll = $('[data-gold-roll]', main);
  if (roll) roll.onclick = () => {
    const w = startingWealth(1, draft.cls);
    draft.goldRoll = { cls: draft.cls, ...rollStartingGold(w.dice) };
    render({ keepScroll: true });
  };
  const set = $('[data-gold-set]', main);
  const custom = $('#gold-custom', main);
  if (custom) custom.oninput = () => { // no redraw while typing (it would take the focus away): update the button in place
    draft.goldCustom = custom.value;
    const { gp, custom: n } = goldOffer();
    set.hidden = gp == null;
    set.textContent = `Set gold to ${(gp ?? 0).toLocaleString()} gp`;
    $('[data-gold-body]', main)?.classList.toggle('gold-dim', n != null);
  };
  if (set) set.onclick = async () => {
    const { gp } = goldOffer();
    if (gp == null) return;
    const m = c.money;
    if ((num(m.pp) || num(m.gp) || num(m.sp) || num(m.cp)) && !await confirmBox(`Replace the coins in the purse with ${gp.toLocaleString()} gp?`, 'Set gold')) return;
    Object.assign(m, { pp: 0, gp, sp: 0, cp: 0 });
    toast(`Purse set to ${gp.toLocaleString()} gp`);
    changed({ rerender: true });
  };
}

// ---------------------------------------------------------------- class picker
function classPicker(c) {
  const lv = classLevels(c);
  const first = !c.levelUps.length;
  const groups = ['Core', 'Base', 'Hybrid', 'Alternate', 'Prestige'];
  const why = k => !k.prestige ? '' : first ? 'Prestige classes are taken after 1st level' : (lv[k.name] || 0) >= k.levels.length ? `${k.name} has only ${k.levels.length} levels` : '';
  return groups.map(g => `<div class="class-group"><div class="eyebrow">${g}</div><div class="chips">
    ${state.classes.filter(k => k.group === g).map(k => `<button class="chip class-chip ${draft.cls === k.name ? 'on' : ''}" data-pick-class="${esc(k.name)}" ${why(k) ? 'disabled' : ''}
      title="${esc(why(k) || `d${k.hit_die} · ${k.skill_ranks} + Int skill ranks${k.casting ? ' · ' + k.casting.kind + ' caster' : ''}${k.prestige ? ` · ${k.levels.length} levels` : ''}`)}">
      ${esc(k.name)}${lv[k.name] ? ` <b>${lv[k.name]}</b>` : ''}${c.favoredClass === k.name ? ' ★' : ''}</button>`).join('')}
  </div></div>`).join('') + '<p class="small muted">★ favored class · numbers show your current levels · hover for hit die and skills. Prestige classes have requirements to meet first; the wizard lists them when you pick one.</p>';
}

// ---------------------------------------------------------------- prestige spellcasting
/** For a prestige level: one entry per "+1 level of existing ... class" in its Spells per Day column, with the character's classes that can take it. */
function advanceSlots(c, def, clsLevel) {
  const row = def?.prestige ? def.levels[clsLevel - 1] : null;
  return (row?.advances || []).map(kind => ({ kind, options: advanceable(kind, classLevels(c), state.classesByName) }));
}
/** The classes a new prestige level advances unless the player picks others: the ones this prestige class advanced last time, else the first that fits. */
function defaultAdvances(c, def) {
  if (!def?.prestige) return [];
  const before = [...c.levelUps].reverse().find(l => l.cls === def.name && l.advances?.length)?.advances || [];
  return advanceSlots(c, def, (classLevels(c)[def.name] || 0) + 1).map((slot, i) => slot.options.includes(before[i]) ? before[i] : slot.options[0] || '');
}
/** The spellcasting classes whose spells change with this level: the class itself, or the classes the prestige level advances. */
function spellTargets(def) {
  return [...new Set([...(def.casting ? [def.name] : []), ...(def.prestige ? draft.advances.filter(Boolean) : [])])]; // a prestige class may cast on its own (unicorn charger)
}
const KIND_TEXT = { arcane: 'arcane spellcasting class', divine: 'divine spellcasting class', any: 'spellcasting class' };

// ---------------------------------------------------------------- the detail panels
function applyDraft(c, dr, newLevel) {
  const clone = structuredClone(c);
  clone.levelUps.push(levelRecord(dr, clone, newLevel));
  clone.archetypes = { ...clone.archetypes, [dr.cls]: dr.archetypes };
  for (const [key, n] of Object.entries(dr.ranks)) {
    const s = clone.skills.find(x => skillKey(x) === key);
    if (s) s.ranks = num(s.ranks) + n;
  }
  return clone;
}
function hpValue(dr, hd, newLevel) {
  if (newLevel === 1 || dr.hpMode === 'max') return hd;
  if (dr.hpMode === 'avg') return Math.floor(hd / 2) + 1;
  if (dr.hpMode === 'roll') return dr.hpRoll ?? Math.floor(hd / 2) + 1;
  return Math.max(1, Math.min(hd, num(dr.hpManual) || 1));
}
function levelRecord(dr, c, newLevel) {
  const def = state.classesByName[dr.cls];
  const fav = c.favoredClass || (newLevel === 1 ? dr.cls : '');
  const advances = def.prestige ? dr.advances.filter(Boolean) : [];
  return { cls: dr.cls, hp: hpValue(dr, def.hit_die, newLevel), fcb: fav === dr.cls ? dr.fcb : '', fcbNote: dr.fcbNote,
    abilityIncrease: newLevel % 4 === 0 ? dr.abilityIncrease : '', ranks: { ...dr.ranks }, notes: dr.notes, ...(advances.length ? { advances } : {}) };
}

// The race's standard racial traits and the alternates for the wizard, loaded once per race.
const racialUi = { race: null, data: null };

/** The "Racial traits" part of the Traits section: the race's standard traits, each with a Swap button when alternates exist. */
function racialSection(el, c, d, newLevel) {
  if (racialUi.race !== c.race) {
    racialUi.race = c.race; racialUi.data = null;
    racialTraitsOf(c.race).then(data => {
      if (racialUi.race !== c.race) return;
      racialUi.data = data;
      if (data && draft && state.view === 'levelup') detail(el, c, d, newLevel);
    });
  }
  const data = racialUi.data;
  if (!data || (!data.baseline.length && !data.alternates.length)) return '';
  const left = remainingBaseline(data.baseline, draft.racial);
  const link = t => `<a href="#" class="ref" data-entry="${esc(t.name)}" data-entry-id="${t.id}">${esc(t.name)}</a>`;
  return `<h4 class="lu-sub">${esc(c.race)} racial traits</h4>
    <ul class="rt-list">${left.map(t => `<li>${link(t)} ${alternativesFor(t.name, data.alternates, draft.racial).length ? `<button class="btn small ghost" data-swap-racial="${esc(t.name)}">Swap…</button>` : ''}</li>`).join('')}
      ${draft.racial.map((t, i) => `<li class="alt">${link(t)} <span class="rep">alternate, replaces ${esc(t.replaces.join(', '))}</span> <button class="icon-btn" data-undo-racial="${i}" title="Go back to the standard trait">✕</button></li>`).join('')}</ul>`;
}

function detail(el, c, d, newLevel) {
  const def = state.classesByName[draft.cls];
  const lvBefore = classLevels(c)[draft.cls] || 0;
  const clsLevel = lvBefore + 1;
  const row = def.levels[clsLevel - 1];
  const after = compute(applyDraft(c, draft, newLevel), state.classesByName);
  const targets = spellTargets(def).filter(t => state.classesByName[t]);
  const slots = advanceSlots(c, def, clsLevel);
  const isFav = (c.favoredClass || (newLevel === 1 ? draft.cls : '')) === draft.cls;
  const ri = raceInfo(c);
  const rankBudget = Math.max(1, def.skill_ranks + after.abilities.int.mod) + (ri.bonusSkill ? 1 : 0) + (isFav && draft.fcb === 'skill' ? 1 : 0);
  const ranksUsed = Object.values(draft.ranks).reduce((a, b) => a + b, 0);
  const getsFeat = newLevel % 2 === 1;
  const getsAbility = newLevel % 4 === 0;
  const features = featuresFor(draft.cls, clsLevel, draft.archetypes, def).filter(f => f.level === clsLevel);
  const traitCount = traitAllowance(newLevel, draft.feats);
  if (draft.racialRace !== c.race) { draft.racialRace = c.race; draft.racial = []; } // the choices belong to the race they were made for
  const racialBlock = newLevel === 1 ? racialSection(el, c, d, newLevel) : '';
  const nTraits = getsAbility ? 6 : 5;
  const nFeats = nTraits + (traitCount || racialBlock ? 1 : 0);
  // Racial traits picked in the same window do not use up the allowance. Drop the extra character traits if Additional Traits was taken back out.
  for (let i = draft.traits.length - 1; i >= 0 && countTraits(draft.traits) > traitCount; i--) if (!draft.traits[i].racial) draft.traits.splice(i, 1);
  const hpGain = after.hp.max - d.hp.max;
  const delta = (a, b, f = sign) => `<span class="dim">${f(a)}</span> → <b>${f(b)}</b>${b !== a ? ` <span class="up">(${b > a ? '+' : ''}${b - a})</span>` : ''}`;

  el.innerHTML = `
  ${def.prestige && lvBefore === 0 ? `<section class="card">
    <h3>Requirements for ${esc(def.name)}</h3>
    <ul class="prestige-req">${(def.requirements || []).map(r => { const [k, ...v] = r.split(': '); return v.length ? `<li><b>${esc(k)}:</b> ${esc(v.join(': '))}</li>` : `<li>${esc(r)}</li>`; }).join('')}</ul>
    <p class="small muted">The wizard does not check these. Make sure your character meets them (or your GM agrees) before taking the class.</p></section>` : ''}
  ${slots.length ? `<section class="card">
    <h3>Spellcasting this level</h3>
    ${slots.map((slot, i) => `<p>${esc(def.name)} ${clsLevel}: +1 level of an existing ${esc(KIND_TEXT[slot.kind] || slot.kind)}.
      ${slot.options.length ? `<select data-advance="${i}">${slot.options.map(o => `<option ${draft.advances[i] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}<option value="" ${draft.advances[i] ? '' : 'selected'}>None</option></select>`
        : '<span class="warn">You have no class that fits, so this level adds no spellcasting.</span>'}</p>`).join('')}
    <p class="small muted">The class you pick gets this level for spells per day, spells known and caster level, as if it had gained a level (its other class features do not improve).</p></section>` : ''}
  ${lvBefore === 0 && !def.prestige ? `<div class="${d.level === 0 ? 'grid two' : ''}">${d.level === 0 ? goldCard(c) : ''}<section class="card">
    <h3>Archetype <span class="muted small">(optional; replaces some ${esc(def.name)} features with new ones)</span></h3>
    <div class="row"><span class="grow" id="lu-arch">${draft.archetypes.length ? `<b>${esc(draft.archetypes.map(a => a.name).join(', '))}</b>` : '<span class="muted">Standard class</span>'}</span>
      <button class="btn" data-choose-arch>${draft.archetypes.length ? 'Change archetype…' : 'Choose archetype…'}</button></div></section></div>`
    : draft.archetypes.length ? `<p class="small muted">Archetype: <b>${esc(draft.archetypes.map(a => a.name).join(', '))}</b> (change it on the sheet's Feats & Abilities tab).</p>` : ''}
  <div class="grid two">
    <section class="card">
      <h3>2 · What changes</h3>
      <p><b>${esc(def.name)} ${clsLevel}</b> · d${def.hit_die} · ${def.skill_ranks} + Int ranks/level · <a href="#" class="ref" data-entry="${esc(def.name)}" data-cat="Class">read class</a></p>
      <table class="tbl compare"><tbody>
        <tr><th>Character level</th><td>${delta(d.level, newLevel, x => x)}</td></tr>
        <tr><th>Hit points</th><td>${delta(d.hp.max, after.hp.max, x => x)}</td></tr>
        <tr><th>Base attack</th><td>${delta(d.bab, after.bab)}</td></tr>
        <tr><th>Fortitude</th><td>${delta(d.saves.fort.total, after.saves.fort.total)}</td></tr>
        <tr><th>Reflex</th><td>${delta(d.saves.ref.total, after.saves.ref.total)}</td></tr>
        <tr><th>Will</th><td>${delta(d.saves.will.total, after.saves.will.total)}</td></tr>
        <tr><th>CMB / CMD</th><td>${delta(d.cmb, after.cmb)} / ${delta(d.cmd, after.cmd, x => x)}</td></tr>
        <tr><th>Max skill ranks</th><td>${delta(d.level, newLevel, x => x)}</td></tr>
        ${after.iteratives.length > d.iteratives.length ? `<tr><th>Attacks</th><td class="good"><b>New iterative attack!</b> ${after.iteratives.map(sign).join('/')}</td></tr>` : ''}
      </tbody></table>
      <h4>New class features</h4>
      ${features.length ? `<ul class="features" style="columns:1">${features.map((f, i) => f.kind === 'archetype'
        ? `<li><a href="#" class="ref" data-arch-feat="${i}">${esc(f.name)}</a><span class="arch-badge">${esc(f.archetype)}</span>${f.replaces.length ? ` <span class="rep">replaces ${esc(f.replaces.join(', '))}</span>` : ''}</li>`
        : `<li><a href="#" class="ref" data-entry="${esc(featureLookupName(f.name))}">${esc(f.name)}</a>${f.modified ? ` <span class="mod">modified by ${esc(f.modified.join(', '))}</span>` : ''}</li>`).join('')}</ul>`
        : '<p class="muted">No new features this level (numbers improve automatically).</p>'}
      ${targets.map(t => spellDiff(state.classesByName[t], d, after, t !== def.name)).join('')}
    </section>

    <section class="card">
      <h3>3 · Hit points</h3>
      ${newLevel === 1 ? `<p>1st level: maximum hit die (<b>${def.hit_die}</b>) + Con modifier (${sign(after.abilities.con.mod)}).</p>` : `
      <div class="seg">
        ${[['avg', `Average (${Math.floor(def.hit_die / 2) + 1})`], ['roll', 'Roll'], ['max', `Max (${def.hit_die})`], ['manual', 'Manual']].map(([k, l]) =>
          `<button class="seg-btn ${draft.hpMode === k ? 'on' : ''}" data-hp-mode="${k}">${l}</button>`).join('')}
      </div>
      ${draft.hpMode === 'roll' ? `<div class="row"><button class="btn" data-roll>🎲 Roll d${def.hit_die}</button> ${draft.hpRoll != null ? `<span class="big">${draft.hpRoll}</span>` : ''}</div>` : ''}
      ${draft.hpMode === 'manual' ? `<label>Die result <input type="number" class="num w3" id="hp-manual" min="1" max="${def.hit_die}" value="${esc(draft.hpManual)}"></label>` : ''}
      `}
      <p>HP gained this level: <b class="big">${hpGain}</b> <span class="small muted">(die ${hpValue(draft, def.hit_die, newLevel)} ${sign(after.abilities.con.mod)} Con${isFav && draft.fcb === 'hp' ? ' +1 favored class' : ''})</span></p>

      <h3 class="lu-sep">4 · Favored class bonus</h3>
      ${isFav ? (() => {
        const racial = fcbData?.[c.race]?.[draft.cls] || [];
        const modes = [['hp', '+1 hit point'], ['skill', '+1 skill rank'], ...(racial.length ? [['racial', `${c.race} option`]] : []), ['other', 'Your own bonus']];
        return `<div class="seg">${modes.map(([k, l]) => `<button class="seg-btn ${draft.fcb === k ? 'on' : ''}" data-fcb="${k}">${esc(l)}</button>`).join('')}</div>
        ${draft.fcb === 'racial' ? `<div class="fcb-options">${racial.map((o, i) => `<button class="fcb-opt ${draft.fcbNote === o.text ? 'on' : ''}" data-fcb-opt="${i}">
            <span>${esc(o.text)}</span><span class="muted small">${esc(o.source)}</span></button>`).join('')}</div>
          ${draft.fcbNote ? '' : '<p class="small warn">Choose one of the options above.</p>'}` : ''}
        ${draft.fcb === 'other' ? `<input id="fcb-note" class="full" placeholder="e.g. +1/6 new arcane discovery, +½ round of rage…" value="${esc(draft.fcbNote)}">` : ''}
        ${!racial.length ? `<p class="small muted">The books list no ${esc(c.race)} favored class option for the ${esc(draft.cls)}.</p>` : ''}`;
      })()
        : `<p class="muted">${esc(draft.cls)} isn't your favored class (${esc(c.favoredClass || 'not set')}). No bonus this level.</p>`}

      ${getsAbility ? `<h3 class="lu-sep">5 · Ability score increase</h3><p>Every 4th level, +1 to one ability score.</p>
        <div class="seg">${ABILITIES.map(a => `<button class="seg-btn ${draft.abilityIncrease === a ? 'on' : ''}" data-ability="${a}">${a.toUpperCase()} ${after.abilities[a].score - (draft.abilityIncrease === a ? 1 : 0)}→${after.abilities[a].score + (draft.abilityIncrease === a ? 0 : 1)}</button>`).join('')}</div>` : ''}

      ${traitCount || racialBlock ? `<h3 class="lu-sep">${nTraits} · Traits</h3>
        ${traitCount ? `<p>${newLevel === 1 ? 'Choose two character traits, each from a different category.' : 'Additional Traits gives you two more, from categories you have no trait in yet.'}${newLevel === 1 && traitCount > 2 ? ' Additional Traits adds two more.' : ''}</p>
        <div class="chips">${draft.traits.map((t, i) => `<span class="chip on">${esc(t.name)} <span class="dim small">${esc(t.sub || '')}</span> <button class="icon-btn" data-rm-trait="${i}">✕</button></span>`).join('')}</div>
        <button class="btn small" data-choose-traits>＋ Choose traits (${traitCount - countTraits(draft.traits)} left)</button>` : ''}
        ${racialBlock}` : ''}

      <h3 class="lu-sep">${nFeats} · Feats</h3>
      ${getsFeat ? `<p>You gain a feat at ${ORD(newLevel)} level.</p>` : '<p class="muted">No general feat this level.</p>'}
      ${newLevel === 1 && ri.bonusFeat ? '<p>Humans gain a bonus feat at 1st level.</p>' : ''}
      ${/bonus feat|combat feat|teamwork feat/i.test(row.special) ? `<p class="good">This class level grants a bonus feat. Check the class feature for allowed feats.</p>` : ''}
      <div class="chips">${draft.feats.map((f, i) => `<span class="chip on">${esc(f.name)} <button class="icon-btn" data-rm-feat="${i}">✕</button></span>`).join('')}</div>
      <button class="btn small" data-add-feat>＋ Choose feat</button>
    </section>
  </div>

  <section class="card">
    <div class="row"><h3 class="grow">Skill ranks</h3>
      <span class="pill ${ranksUsed > rankBudget ? 'bad' : ranksUsed === rankBudget ? 'good' : 'warn'}">This level: <b>${ranksUsed}</b> / ${rankBudget}</span>
      <span class="pill">Max ranks per skill: ${newLevel}</span></div>
    <p class="small muted">${def.skill_ranks} (class) ${sign(after.abilities.int.mod)} (Int)${ri.bonusSkill ? ' + 1 (human)' : ''}${isFav && draft.fcb === 'skill' ? ' + 1 (favored class)' : ''} · ● = class skill (+3 once trained)</p>
    <div class="skill-grid">${c.skills.map(s => {
      const key = skillKey(s);
      const cur = num(s.ranks), add = draft.ranks[key] || 0;
      const isCs = after.skills[key]?.isClass;
      return `<div class="skill-cell ${add ? 'on' : ''}"><span class="cs">${isCs ? '●' : ''}</span><span class="grow">${esc(key)}</span>
        <span class="dim small">${cur}${add ? `<b class="up">+${add}</b>` : ''}</span>
        <span class="stepper sm"><button data-rank="${esc(key)}" data-d="-1" ${add ? '' : 'disabled'} aria-label="One rank less">−</button><button data-rank="${esc(key)}" data-d="1" ${cur + add >= newLevel ? 'disabled' : ''} aria-label="One rank more">＋</button></span></div>`;
    }).join('')}</div>
  </section>

  ${targets.map(t => spellPicks(c, state.classesByName[t], after)).join('')}

  <section class="card apply">
    <label class="grow">Notes for this level <input id="lu-notes" class="full" value="${esc(draft.notes)}" placeholder="e.g. chose Weapon Training (heavy blades)"></label>
    <button class="btn primary big-btn" data-apply>Apply ${ORD(newLevel)} level</button>
  </section>`;

  // ---- wiring ----
  const rerender = () => detail(el, c, d, newLevel);
  $$('[data-hp-mode]', el).forEach(b => (b.onclick = () => { draft.hpMode = b.dataset.hpMode; rerender(); }));
  const roll = $('[data-roll]', el);
  if (roll) roll.onclick = () => { draft.hpRoll = 1 + Math.floor(Math.random() * def.hit_die); rerender(); };
  const man = $('#hp-manual', el);
  if (man) man.onchange = () => { draft.hpManual = man.value; rerender(); };
  $$('[data-fcb]', el).forEach(b => (b.onclick = () => { if (draft.fcb !== b.dataset.fcb) { draft.fcb = b.dataset.fcb; draft.fcbNote = ''; } rerender(); }));
  $$('[data-fcb-opt]', el).forEach(b => (b.onclick = () => { draft.fcbNote = (fcbData?.[c.race]?.[draft.cls] || [])[+b.dataset.fcbOpt]?.text || ''; rerender(); }));
  const fn = $('#fcb-note', el);
  if (fn) fn.oninput = () => (draft.fcbNote = fn.value);
  $('#lu-notes', el).oninput = e => (draft.notes = e.target.value);
  $$('[data-ability]', el).forEach(b => (b.onclick = () => { draft.abilityIncrease = b.dataset.ability; rerender(); }));
  $$('[data-rank]', el).forEach(b => (b.onclick = () => {
    const k = b.dataset.rank;
    draft.ranks[k] = Math.max(0, (draft.ranks[k] || 0) + +b.dataset.d);
    if (!draft.ranks[k]) delete draft.ranks[k];
    rerender();
  }));
  $('[data-add-feat]', el).onclick = async () => {
    const r = await pickEntry('Choose a feat', 'Feat', { subs: FEAT_TYPES });
    if (r) { draft.feats.push(r); rerender(); }
  };
  $$('[data-swap-racial]', el).forEach(b => (b.onclick = async () => {
    const base = racialUi.data?.baseline.find(x => x.name === b.dataset.swapRacial);
    const opts = alternativesFor(base.name, racialUi.data.alternates, draft.racial);
    const r = await pickEntry(`Swap ${base.name} for an alternate`, 'Racial Trait', { search: async q => opts.filter(o => !q || o.name.toLowerCase().includes(q.toLowerCase())), renderRow: r => r.summary });
    if (r) { draft.racial.push({ id: r.id, name: r.name, sub: r.sub, replaces: replacesOf(r.summary), racial: true }); rerender(); }
  }));
  $$('[data-undo-racial]', el).forEach(b => (b.onclick = () => { draft.racial.splice(+b.dataset.undoRacial, 1); rerender(); }));
  const tb = $('[data-choose-traits]', el);
  if (tb) tb.onclick = async () => {
    await chooseTraits({ count: traitAllowance(newLevel, draft.feats), have: c.traits, picks: draft.traits, title: 'Choose traits' });
    rerender();
  };
  $$('[data-rm-trait]', el).forEach(b => (b.onclick = () => { draft.traits.splice(+b.dataset.rmTrait, 1); rerender(); }));
  $$('[data-rm-feat]', el).forEach(b => (b.onclick = () => { draft.feats.splice(+b.dataset.rmFeat, 1); rerender(); }));
  wireGold(el, c);
  const archBtn = $('[data-choose-arch]', el);
  if (archBtn) archBtn.onclick = async () => {
    const picked = await chooseArchetypes(draft.cls, draft.archetypes);
    if (picked) { draft.archetypes = picked; rerender(); }
  };
  $$('[data-arch-feat]', el).forEach(a => (a.onclick = e => {
    e.preventDefault();
    const f = features[+a.dataset.archFeat];
    showCustom({ name: f.name, cat: 'Archetype feature', sub: f.archetype,
      html: (f.replaces.length ? `<p class="field"><b>Replaces:</b> ${esc(f.replaces.join(', '))}</p>` : '') + f.html });
  }));
  $$('[data-advance]', el).forEach(s => (s.onchange = () => {
    const was = draft.advances[+s.dataset.advance];
    draft.advances[+s.dataset.advance] = s.value;
    if (was && !draft.advances.includes(was)) { delete draft.spellsBy[was]; delete draft.favsBy[was]; } // the spells chosen for a class no longer advanced
    rerender();
  }));
  $$('[data-choose-spells]', el).forEach(b => (b.onclick = async () => {
    const t = b.dataset.cls, sc = after.spellcasting[t];
    const book = c.spellbooks[t] || { spells: [] };
    await chooseSpells({ cls: t, lists: sc.lists, allowance: spellAllowance(c, state.classesByName[t], after), picks: (draft.spellsBy[t] ||= []),
      known: [...book.spells, ...(draft.favsBy[t] || [])].map(s => s.name) });
    rerender();
  }));
  // Favourites: spells picked only to have them on the Spells tab (prepared casters can prepare anything on their list), with no limit.
  $$('[data-choose-favs]', el).forEach(b => (b.onclick = async () => {
    const t = b.dataset.cls, sc = after.spellcasting[t];
    const book = c.spellbooks[t] || { spells: [] };
    await chooseSpells({ cls: t, lists: sc.lists, allowance: favoritesAllowance(sc), picks: (draft.favsBy[t] ||= []), known: [...book.spells, ...(draft.spellsBy[t] || [])].map(s => s.name) });
    rerender();
  }));
  $$('[data-rm-fav]', el).forEach(b => (b.onclick = () => { draft.favsBy[b.dataset.cls].splice(+b.dataset.rmFav, 1); rerender(); }));
  $$('[data-rm-spell]', el).forEach(b => (b.onclick = () => { draft.spellsBy[b.dataset.cls].splice(+b.dataset.rmSpell, 1); rerender(); }));
  $('[data-apply]', el).onclick = () => apply(c, def, newLevel, rankBudget, ranksUsed, getsAbility, after, targets);
}

/** What the spellcasting class `def` learns at this level. Its level counts the prestige levels that advance it. */
function spellAllowance(c, def, after) {
  const book = c.spellbooks[def.name] || { spells: [] };
  return learnAllowance(def, after.casterLevels[def.name], book.spells, after.spellcasting[def.name], after.abilities.int.mod);
}

const SL = ['0', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
/** The spells-per-day table of the spellcasting class `def` before (d) and after this level. */
function spellDiff(def, d, after, viaPrestige) {
  if (!def.casting) return '';
  const lvAfter = after.casterLevels[def.name], lvBefore = d.casterLevels?.[def.name] || 0;
  const row = def.levels[Math.min(lvAfter, 20) - 1];
  const prevRow = lvBefore ? def.levels[Math.min(lvBefore, 20) - 1] : null;
  const sc = after.spellcasting[def.name];
  const levels = [...Array((def.casting.max_level || 0) + 1).keys()];
  const cell = (arr, l) => (arr?.[l] == null ? '—' : arr[l]);
  const changedLv = l => (prevRow?.spells_per_day?.[l] ?? null) !== (row.spells_per_day?.[l] ?? null);
  return `<h4>Spellcasting${viaPrestige ? `: ${esc(def.name)} (as ${ORD(lvAfter)} level)` : ''}</h4>
    <table class="tbl slot-tbl"><thead><tr><th></th>${levels.map(l => `<th>${SL[l]}</th>`).join('')}</tr></thead><tbody>
      <tr><th>Per day (table)</th>${levels.map(l => `<td class="${changedLv(l) ? 'up' : ''}">${cell(row.spells_per_day, l)}</td>`).join('')}</tr>
      ${sc ? `<tr><th>With bonus spells</th>${levels.map(l => `<td>${sc.slots[l] === Infinity ? '∞' : sc.slots[l] ?? '—'}</td>`).join('')}</tr>` : ''}
      ${row.spells_known ? `<tr><th>Known</th>${levels.map(l => `<td class="${(prevRow?.spells_known?.[l] ?? null) !== (row.spells_known[l] ?? null) ? 'up' : ''}">${cell(row.spells_known, l)}</td>`).join('')}</tr>` : ''}
      ${sc ? `<tr><th>Save DC</th>${levels.map(l => `<td>${sc.dcs[l]}</td>`).join('')}</tr>` : ''}
    </tbody></table>
    ${sc ? `<p class="small muted">Caster level ${sc.cl} · concentration ${sign(sc.concentration)} · bonus spells from ${def.casting.stat.toUpperCase()} ${sign(sc.statMod)}</p>` : '<p class="small muted">Spellcasting begins at a later level.</p>'}`;
}

function spellPicks(c, def, after) {
  if (!def.casting || !after.spellcasting[def.name]) return '';
  const allowance = spellAllowance(c, def, after);
  const picks = draft.spellsBy[def.name] || [], favs = draft.favsBy[def.name] || [];
  const rem = remaining(allowance, picks);
  const cls = `data-cls="${esc(def.name)}"`;
  const of = def.name === draft.cls ? '' : ` <span class="muted small">(${esc(def.name)})</span>`;
  const word = def.casting.extracts ? 'formulae' : 'spells';
  let guidance;
  if (allowance.kind === 'known') {
    guidance = `${def.name}s know a fixed number of spells. This level you learn the spells in the "known" row above that you don't have yet.`;
  } else if (allowance.kind === 'book') {
    const first = allowance.byLevel[1] != null || allowance.allCantrips;
    guidance = first
      ? `Your ${def.casting.extracts ? 'formula book' : def.name === 'Witch' ? 'familiar' : 'spellbook'} starts with ${allowance.allCantrips ? 'every cantrip (added automatically) plus ' : ''}${allowance.byLevel[1] ?? 0} 1st-level ${word} (base + Int modifier).`
      : `Add ${allowance.any?.count ?? 0} new ${word} of any level you can cast. More can be copied from scrolls and books later on the Spells tab.`;
  } else {
    guidance = `${def.name}s prepare from their entire spell list, so there's nothing to learn. Track favourites on the Spells tab.`;
  }
  const chips = picks.map((s, i) => `<span class="chip on">${s.level === 0 ? 'Cantrip' : 'L' + s.level} ${esc(s.name)} <button class="icon-btn" ${cls} data-rm-spell="${i}">✕</button></span>`).join('');
  const favChips = favs.map((s, i) => `<span class="chip on">${s.level === 0 ? 'Cantrip' : 'L' + s.level} ${esc(s.name)} <button class="icon-btn" ${cls} data-rm-fav="${i}">✕</button></span>`).join('');
  if (allowance.kind === 'none') {
    return `<section class="card"><div class="row"><h3 class="grow">Spells${of} <span class="muted small">(optional)</span></h3><button class="btn small primary" ${cls} data-choose-favs>Choose spells</button></div>
      <p>${def.name}s prepare from their entire spell list, so you do not have to learn anything. Pick any spells you want quick access to and they are put on your Spells tab, ready to prepare. You can add more there any time.</p>
      <div class="chips">${favChips}</div></section>`;
  }
  return `<section class="card"><div class="row"><h3 class="grow">${def.casting.extracts ? 'Formulae' : 'Spells'} to learn${of}</h3>
      <span class="pill ${rem.total ? 'warn' : 'good'}">${rem.total ? `Left: <b>${esc(describeRemaining(rem))}</b>` : 'All chosen ✓'}</span>
      <button class="btn small ${rem.total ? 'primary' : ''}" ${cls} data-choose-spells ${rem.total ? '' : 'disabled'}>Choose ${word}</button></div>
    <p>${guidance}</p>
    <div class="chips">${chips}</div>
    ${allowance.kind === 'book' ? `<div class="row"><button class="btn small ghost" ${cls} data-choose-favs title="Spells you want on your list for quick access, beyond the ones above">＋ More spells (optional)</button></div>
      <div class="chips">${favChips}</div>` : ''}
  </section>`;
}

async function apply(c, def, newLevel, rankBudget, ranksUsed, getsAbility, after, targets) {
  if (ranksUsed > rankBudget) { toast(`You assigned ${ranksUsed} ranks but only have ${rankBudget}.`, 'err'); return; }
  if (draft.hpMode === 'roll' && draft.hpRoll == null && newLevel > 1) { toast('Roll your hit die first (or pick another HP option).', 'err'); return; }
  // Each spellcasting class this level touches: what it may learn, and what is still left to choose.
  const learn = targets.map(t => state.classesByName[t]).filter(t => t.casting && after.spellcasting[t.name]).map(t => {
    const allowance = spellAllowance(c, t, after);
    return { def: t, allowance, rem: remaining(allowance, draft.spellsBy[t.name] || []) };
  });
  const spellsLeft = learn.filter(l => l.rem.total).map(l => `${describeRemaining(l.rem)} ${l.def.casting.extracts ? 'formulae' : 'spells'}${learn.length > 1 || l.def !== def ? ` (${l.def.name})` : ''}`).join('; ');
  const ri = raceInfo(c);
  const spent = ABILITIES.reduce((s, a) => s + (POINT_BUY[num(c.abilities[a].base)] ?? NaN), 0);
  const warnings = levelWarnings({
    newLevel, rankBudget, ranksUsed, getsFeat: newLevel % 2 === 1, bonusFeat: newLevel === 1 && !!ri.bonusFeat, featsChosen: draft.feats.length,
    traitsLeft: Math.max(0, traitAllowance(newLevel, draft.feats) - countTraits(draft.traits)),
    getsAbility, abilityIncrease: draft.abilityIncrease, isFav: (c.favoredClass || (newLevel === 1 ? def.name : '')) === def.name, fcb: draft.fcb, fcbNote: draft.fcbNote,
    spellsLeft,
    pointsLeft: isNaN(spent) || draft.scoreMode === 'roll' ? 0 : draft.budget - spent, name: c.name,
    notRolled: newLevel === 1 && draft.scoreMode === 'roll' && !c.abilityRolls,
    rollsUnplaced: newLevel === 1 && draft.scoreMode === 'roll' && c.abilityRolls ? unplaced(c.abilityRolls).length : 0,
  });
  if (warnings.length && !await warnBox(newLevel === 1 ? 'Before you finish your character' : `Before you apply ${ORD(newLevel)} level`, warnings,
    { okLabel: 'Apply anyway', backLabel: 'Go back and fix' })) return;
  // Spellbook casters start with every cantrip on their list.
  for (const { def: t, allowance } of learn) {
    if (!allowance.allCantrips) continue;
    const picks = (draft.spellsBy[t.name] ||= []);
    try {
      const known = new Set([...(c.spellbooks[t.name]?.spells || []), ...picks, ...(draft.favsBy[t.name] || [])].map(s => s.name.toLowerCase()));
      const cantrips = (await api.spells(after.spellcasting[t.name].lists.join(','), 0)).filter(s => !known.has(s.name.toLowerCase()));
      picks.push(...cantrips.map(s => ({ id: s.id, name: s.name, level: 0, school: s.school, summary: s.summary })));
    } catch { toast('Could not load cantrips; add them on the Spells tab.', 'err'); }
  }
  if (!c.favoredClass && newLevel === 1) c.favoredClass = draft.cls;
  if (draft.archetypes.length || c.archetypes[draft.cls]) c.archetypes[draft.cls] = draft.archetypes;
  c.levelUps.push(levelRecord(draft, c, newLevel));
  for (const [key, n] of Object.entries(draft.ranks)) {
    const s = c.skills.find(x => skillKey(x) === key);
    if (s) s.ranks = num(s.ranks) + n;
  }
  if (newLevel === 1 && racialUi.data) {
    const have = new Set(c.traits.map(t => t.name.toLowerCase()));
    for (const t of [...remainingBaseline(racialUi.data.baseline, draft.racial), ...draft.racial]) {
      if (!have.has(t.name.toLowerCase())) c.traits.push({ id: t.id, name: t.name, sub: t.sub, notes: '', ...(t.replaces?.length ? { replaces: t.replaces } : {}) });
    }
  }
  for (const t of draft.traits) c.traits.push({ id: t.id, name: t.name, sub: t.sub, notes: '', ...(t.replaces ? { replaces: t.replaces } : {}) });
  for (const f of draft.feats) c.feats.push({ id: f.id, name: f.name, sub: f.sub, notes: '', level: newLevel, addedAt: newLevel });
  for (const t of targets) {
    const add = [...(draft.spellsBy[t] || []), ...(draft.favsBy[t] || [])];
    if (!add.length) continue;
    const book = (c.spellbooks[t] ||= { spells: [], used: Array(10).fill(0), extraSlot: false });
    for (const s of add) book.spells.push({ id: s.id, name: s.name, level: s.level, school: s.school, summary: s.summary, prepared: 0, cast: 0, addedAt: newLevel });
  }
  const unspent = rankBudget - ranksUsed;
  const msg = `${def.name} ${classLevels(c)[def.name]} applied!` + (unspent > 0 ? ` (${unspent} skill rank${unspent > 1 ? 's' : ''} unspent; assign them on the Skills tab)` : '');
  draft = null;
  toast(msg, 'good');
  state.sheetTab = 'overview';
  changed();
  go('sheet');
  playSfx('levelUp');
}
