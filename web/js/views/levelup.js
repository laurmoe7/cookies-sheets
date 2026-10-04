import { state, changed, go, render } from '../app.js';
import { compute, sign, num, classLevels, raceInfo, mod } from '../calc.js';
import { ABILITIES, ABILITY_NAMES, RACES, POINT_BUY, SKILL_BY_NAME } from '../data.js';
import { skillKey } from '../model.js';
import { esc, $, $$, pickEntry, toast } from '../ui.js';
import { pickSpell, featureLookupName } from './sheet.js';

let draft = null;
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function freshDraft(c) {
  return { forLevel: c.levelUps.length, charId: c.id, cls: null, hpMode: 'avg', hpRoll: null, hpManual: '', fcb: 'hp', fcbNote: '',
    abilityIncrease: '', ranks: {}, feats: [], spells: [], notes: '', budget: 20 };
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
  main.innerHTML = `<div class="page levelup">
    <div class="row"><h1 class="grow">${d.level === 0 ? 'Create character · 1st level' : `Level up · ${ORD(d.level)} → ${ORD(newLevel)} level`}</h1>
      ${d.level > 0 ? '<button class="btn ghost" data-cancel>Back to sheet</button>' : ''}</div>
    ${d.level === 0 ? basicsCard(c, d) : ''}
    <section class="card"><h3>1 · Choose a class</h3>${classPicker(c)}</section>
    <div id="lu-detail"></div>
  </div>`;
  const cancel = $('[data-cancel]', main);
  if (cancel) cancel.onclick = () => go('sheet');
  wireBasics(main, c);
  $$('[data-pick-class]', main).forEach(b => (b.onclick = () => {
    draft.cls = b.dataset.pickClass;
    draft.ranks = {}; draft.spells = [];
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
          <label class="small">Point buy <select id="pb-budget">${[10, 15, 20, 25].map(b => `<option ${b === draft.budget ? 'selected' : ''} value="${b}">${b} (${{ 10: 'low fantasy', 15: 'standard', 20: 'high fantasy', 25: 'epic' }[b]})</option>`).join('')}</select></label></div>
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
          ${isNaN(spent) ? '(rolled scores? Just type them in.)' : ''}</div>
      </div>
    </div></section>`;
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
  $$('[data-pb]', main).forEach(btn => (btn.onclick = () => {
    const a = btn.dataset.pb;
    c.abilities[a].base = Math.max(7, Math.min(18, num(c.abilities[a].base) + +btn.dataset.d));
    changed({ rerender: true });
  }));
}

// ---------------------------------------------------------------- class picker
function classPicker(c) {
  const lv = classLevels(c);
  const groups = ['Core', 'Base', 'Hybrid', 'Alternate'];
  return groups.map(g => `<div class="class-group"><div class="eyebrow">${g}</div><div class="chips">
    ${state.classes.filter(k => k.group === g).map(k => `<button class="chip class-chip ${draft.cls === k.name ? 'on' : ''}" data-pick-class="${esc(k.name)}"
      title="d${k.hit_die} · ${k.skill_ranks} + Int skill ranks${k.casting ? ' · ' + k.casting.kind + ' caster' : ''}">
      ${esc(k.name)}${lv[k.name] ? ` <b>${lv[k.name]}</b>` : ''}${c.favoredClass === k.name ? ' ★' : ''}</button>`).join('')}
  </div></div>`).join('') + '<p class="small muted">★ favored class · numbers show your current levels · hover for hit die and skills. Prestige classes can be tracked in notes for now.</p>';
}

// ---------------------------------------------------------------- the detail panels
function applyDraft(c, dr, newLevel) {
  const clone = structuredClone(c);
  clone.levelUps.push(levelRecord(dr, clone, newLevel));
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
  return { cls: dr.cls, hp: hpValue(dr, def.hit_die, newLevel), fcb: fav === dr.cls ? dr.fcb : '', fcbNote: dr.fcbNote,
    abilityIncrease: newLevel % 4 === 0 ? dr.abilityIncrease : '', ranks: { ...dr.ranks }, notes: dr.notes };
}

function detail(el, c, d, newLevel) {
  const def = state.classesByName[draft.cls];
  const lvBefore = classLevels(c)[draft.cls] || 0;
  const clsLevel = lvBefore + 1;
  const row = def.levels[clsLevel - 1];
  const prevRow = lvBefore ? def.levels[lvBefore - 1] : null;
  const after = compute(applyDraft(c, draft, newLevel), state.classesByName);
  const isFav = (c.favoredClass || (newLevel === 1 ? draft.cls : '')) === draft.cls;
  const ri = raceInfo(c);
  const rankBudget = Math.max(1, def.skill_ranks + after.abilities.int.mod) + (ri.bonusSkill ? 1 : 0) + (isFav && draft.fcb === 'skill' ? 1 : 0);
  const ranksUsed = Object.values(draft.ranks).reduce((a, b) => a + b, 0);
  const getsFeat = newLevel % 2 === 1;
  const getsAbility = newLevel % 4 === 0;
  const features = splitSpecial(row.special);
  const hpGain = after.hp.max - d.hp.max;
  const delta = (a, b, f = sign) => `<span class="dim">${f(a)}</span> → <b>${f(b)}</b>${b !== a ? ` <span class="up">(${b > a ? '+' : ''}${b - a})</span>` : ''}`;

  el.innerHTML = `
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
      ${features.length ? `<ul class="features">${features.map(f => `<li><a href="#" class="ref" data-entry="${esc(featureLookupName(f))}">${esc(f)}</a></li>`).join('')}</ul>` : '<p class="muted">No new features this level (numbers improve automatically).</p>'}
      ${spellDiff(def, row, prevRow, after)}
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

      <h3>4 · Favored class bonus</h3>
      ${isFav ? `<div class="seg">${[['hp', '+1 hit point'], ['skill', '+1 skill rank'], ['other', 'Alternate bonus']].map(([k, l]) =>
        `<button class="seg-btn ${draft.fcb === k ? 'on' : ''}" data-fcb="${k}">${l}</button>`).join('')}</div>
        ${draft.fcb === 'other' ? `<input id="fcb-note" class="full" placeholder="e.g. +1/6 new arcane discovery, +½ round of rage…" value="${esc(draft.fcbNote)}">` : ''}`
        : `<p class="muted">${esc(draft.cls)} isn't your favored class (${esc(c.favoredClass || 'not set')}). No bonus this level.</p>`}

      ${getsAbility ? `<h3>5 · Ability score increase</h3><p>Every 4th level, +1 to one ability score.</p>
        <div class="seg">${ABILITIES.map(a => `<button class="seg-btn ${draft.abilityIncrease === a ? 'on' : ''}" data-ability="${a}">${a.toUpperCase()} ${after.abilities[a].score - (draft.abilityIncrease === a ? 1 : 0)}→${after.abilities[a].score + (draft.abilityIncrease === a ? 0 : 1)}</button>`).join('')}</div>` : ''}

      <h3>${getsAbility ? 6 : 5} · Feats</h3>
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
        <button class="icon-btn" data-rank="${esc(key)}" data-d="-1" ${add ? '' : 'disabled'}>−</button>
        <button class="icon-btn" data-rank="${esc(key)}" data-d="1" ${cur + add >= newLevel ? 'disabled' : ''}>＋</button></div>`;
    }).join('')}</div>
  </section>

  ${spellPicks(c, def, row, prevRow, after, newLevel)}

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
  $$('[data-fcb]', el).forEach(b => (b.onclick = () => { draft.fcb = b.dataset.fcb; rerender(); }));
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
    const r = await pickEntry('Choose a feat', 'Feat');
    if (r) { draft.feats.push(r); rerender(); }
  };
  $$('[data-rm-feat]', el).forEach(b => (b.onclick = () => { draft.feats.splice(+b.dataset.rmFeat, 1); rerender(); }));
  $$('[data-add-lu-spell]', el).forEach(b => (b.onclick = async () => {
    const sc = after.spellcasting[draft.cls];
    const lvl = +b.dataset.addLuSpell;
    const r = await pickSpell(draft.cls, sc, lvl);
    if (r) { draft.spells.push({ ...r, level: lvl === -1 ? r.level : lvl }); rerender(); }
  }));
  $$('[data-rm-spell]', el).forEach(b => (b.onclick = () => { draft.spells.splice(+b.dataset.rmSpell, 1); rerender(); }));
  $('[data-apply]', el).onclick = () => apply(c, def, newLevel, rankBudget, ranksUsed, getsAbility);
}

function splitSpecial(text) {
  const out = []; let depth = 0, cur = '';
  for (const ch of text || '') {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(x => x && !/^[—–-]$/.test(x));
}

const SL = ['0', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
function spellDiff(def, row, prevRow, after) {
  if (!def.casting) return '';
  const sc = after.spellcasting[def.name];
  const levels = [...Array((def.casting.max_level || 0) + 1).keys()];
  const cell = (arr, l) => (arr?.[l] == null ? '—' : arr[l]);
  const changedLv = l => (prevRow?.spells_per_day?.[l] ?? null) !== (row.spells_per_day?.[l] ?? null);
  return `<h4>Spellcasting</h4>
    <table class="tbl slot-tbl"><thead><tr><th></th>${levels.map(l => `<th>${SL[l]}</th>`).join('')}</tr></thead><tbody>
      <tr><th>Per day (table)</th>${levels.map(l => `<td class="${changedLv(l) ? 'up' : ''}">${cell(row.spells_per_day, l)}</td>`).join('')}</tr>
      ${sc ? `<tr><th>With bonus spells</th>${levels.map(l => `<td>${sc.slots[l] === Infinity ? '∞' : sc.slots[l] ?? '—'}</td>`).join('')}</tr>` : ''}
      ${row.spells_known ? `<tr><th>Known</th>${levels.map(l => `<td class="${(prevRow?.spells_known?.[l] ?? null) !== (row.spells_known[l] ?? null) ? 'up' : ''}">${cell(row.spells_known, l)}</td>`).join('')}</tr>` : ''}
      ${sc ? `<tr><th>Save DC</th>${levels.map(l => `<td>${sc.dcs[l]}</td>`).join('')}</tr>` : ''}
    </tbody></table>
    ${sc ? `<p class="small muted">Caster level ${sc.cl} · concentration ${sign(sc.concentration)} · bonus spells from ${def.casting.stat.toUpperCase()} ${sign(sc.statMod)}</p>` : '<p class="small muted">Spellcasting begins at a later level.</p>'}`;
}

function spellPicks(c, def, row, prevRow, after, newLevel) {
  if (!def.casting || !after.spellcasting[def.name]) return '';
  const sc = after.spellcasting[def.name];
  const book = c.spellbooks[def.name] || { spells: [] };
  let guidance = '';
  const isWizardLike = ['Wizard', 'Arcanist'].includes(def.name) || def.casting.kind === 'arcanist';
  if (row.spells_known) {
    const gains = [];
    for (let l = 0; l <= 9; l++) {
      const now = row.spells_known[l] ?? 0;
      const have = book.spells.filter(s => s.level === l).length + draft.spells.filter(s => s.level === l).length;
      if (now > have) gains.push(`${now - have} × ${l === 0 ? 'cantrip' : SL[l] + '-level'}`);
    }
    guidance = gains.length ? `Spells to learn: <b>${gains.join(', ')}</b>` : '<span class="good">All known-spell slots filled.</span>';
  } else if (isWizardLike) {
    guidance = newLevel === 1 || !c.spellbooks[def.name]
      ? `Your spellbook starts with all cantrips plus 3 + Int modifier (${3 + after.abilities.int.mod}) 1st-level spells.`
      : 'Add 2 new spells of any level you can cast to your spellbook (more can be copied from scrolls/books).';
  } else if (def.name === 'Witch') {
    guidance = 'Your familiar learns 2 new spells of any level you can cast.';
  } else if (['Alchemist', 'Investigator'].includes(def.name)) {
    guidance = 'Add 1 new formula of any level you can create to your formula book.';
  } else {
    guidance = 'Prepared divine casters have access to their entire spell list. Add spells you want to track on the Spells tab.';
  }
  return `<section class="card"><div class="row"><h3 class="grow">${def.casting.extracts ? 'Formulae' : 'Spells'}</h3>
      <button class="btn small" data-add-lu-spell="-1">＋ Add spell</button></div>
    <p>${guidance}</p>
    <div class="chips">${draft.spells.map((s, i) => `<span class="chip on">L${s.level} ${esc(s.name)} <button class="icon-btn" data-rm-spell="${i}">✕</button></span>`).join('')}</div>
  </section>`;
}

function apply(c, def, newLevel, rankBudget, ranksUsed, getsAbility) {
  if (getsAbility && !draft.abilityIncrease) { toast('Choose an ability score to increase.', 'err'); return; }
  if (ranksUsed > rankBudget) { toast(`You assigned ${ranksUsed} ranks but only have ${rankBudget}.`, 'err'); return; }
  if (draft.hpMode === 'roll' && draft.hpRoll == null && newLevel > 1) { toast('Roll your hit die first (or pick another HP option).', 'err'); return; }
  if (!c.favoredClass && newLevel === 1) c.favoredClass = draft.cls;
  c.levelUps.push(levelRecord(draft, c, newLevel));
  for (const [key, n] of Object.entries(draft.ranks)) {
    const s = c.skills.find(x => skillKey(x) === key);
    if (s) s.ranks = num(s.ranks) + n;
  }
  for (const f of draft.feats) c.feats.push({ id: f.id, name: f.name, sub: f.sub, notes: '', level: newLevel, addedAt: newLevel });
  if (draft.spells.length) {
    const book = (c.spellbooks[def.name] ||= { spells: [], used: Array(10).fill(0), extraSlot: false });
    for (const s of draft.spells) book.spells.push({ id: s.id, name: s.name, level: s.level, school: s.school, summary: s.summary, prepared: 0, cast: 0, addedAt: newLevel });
  }
  const unspent = rankBudget - ranksUsed;
  const msg = `${def.name} ${classLevels(c)[def.name]} applied!` + (unspent > 0 ? ` (${unspent} skill rank${unspent > 1 ? 's' : ''} unspent; assign them on the Skills tab)` : '');
  draft = null;
  toast(msg, 'good');
  state.sheetTab = 'overview';
  changed();
  go('sheet');
}
