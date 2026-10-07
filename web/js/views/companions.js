// Companions tab: animal companions and eidolons with computed stat blocks, plus free-form entries
// (familiars, mounts, cohorts).
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { classLevels, sign, num } from '../calc.js';
import { computeCompanion, newCompanion, withCompanionSources, ANIMAL_SKILLS, EIDOLON_SKILLS, skillAbility } from '../companions.js';
import { classFeatures, archetypesOf } from '../features.js';
import { linkTerms } from '../termlinks.js';
import { SKILLS } from '../data.js';
import { esc, $, $$, getPath, modal, pickEntry, textField, confirmBox, showCustom } from '../ui.js';
import { picAction, picFrame } from '../cropper.js';

const PIC = { w: 3, h: 4, out: 800 };

// What a familiar borrows from its master: base attack bonus, base saves, hit points and skill ranks.
function masterOf(c) {
  const d = state.derived;
  if (!d) return {};
  return { bab: d.bab, hp: d.hp.max, saves: { fort: d.saves.fort.base, ref: d.saves.ref.base, will: d.saves.will.base },
    ranks: Object.fromEntries((c.skills || []).map(s => [s.name, num(s.ranks)])) };
}

let dataPromise = null;
const loadData = () => (dataPromise ||= api.companions().catch(e => { dataPromise = null; throw e; }));
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const tf = (path, opts) => textField(path, getPath(state.char, path), opts);

export async function renderCompanions(body, c) {
  body.innerHTML = '<p class="muted pad">Loading companion rules…</p>';
  let data;
  try { data = await loadData(); } catch (e) { body.innerHTML = `<p class="bad pad">Couldn't load companion data: ${esc(e.message)}</p>`; return; }
  c.companions ||= [];
  const base = classLevels(c);
  const archs = Object.keys(base).flatMap(cls => archetypesOf(c, cls).map(a => (a.name || '').toLowerCase()));
  const levels = withCompanionSources(base, c, classFeatures(c, state.classesByName), archs, state.derived?.level || 0);
  body.innerHTML = `
    <div class="row"><h3 class="grow" style="margin:0">Companions</h3>
      <button class="btn small" data-new="animal">＋ Animal companion</button>
      <button class="btn small" data-new="eidolon">＋ Eidolon</button>
      <button class="btn small" data-new="familiar">＋ Familiar</button>
      <button class="btn small ghost" data-new="custom">＋ Other (mount, cohort)</button></div>
    ${c.companions.length ? '' : `<section class="card"><p class="muted">No companions yet.</p>
      <p class="small muted">Animal companions come from druid, hunter, ranger (from 4th level), cavalier, samurai and paladin (divine bond) levels, the Animal domain, and the Animal Ally and Boon Companion feats; eidolons from summoner levels; familiars from wizard, sorcerer, witch and shaman levels, the arcanist’s Familiar exploit, and a few archetypes.
      Levels are worked out from your classes automatically, and you can override them.</p></section>`}
    ${c.companions.map((comp, i) => companionCard(comp, i, levels, data, masterOf(c))).join('')}`;

  body.addEventListener('toggle', e => {
    const d = e.target.closest?.('details[data-block]');
    if (!d) return;
    const comp = getPath(c, d.dataset.block);
    if (comp && (comp.blockOpen !== false) !== d.open) { comp.blockOpen = d.open; changed(); }
  }, true);
  body.onclick = async e => {
    const t = e.target.closest('[data-chp],[data-sync-level],[data-pic],[data-pic-edit],[data-pic-clear],[data-new],[data-del-comp],[data-add-feat],[data-rm-feat],[data-add-evo],[data-rm-evo],[data-add-skill],[data-evo-info]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.new) { c.companions.push(newCompanion(t.dataset.new, data)); return changed({ rerender: true }); }
    const i = +t.closest('[data-comp]').dataset.comp;
    const comp = c.companions[i];
    if (t.dataset.chp !== undefined) {
      const s = computeCompanion(comp, levels, data, masterOf(c));
      const row = t.closest('[data-comp]');
      const amt = Math.abs(num($('[data-chp-amt]', row).value));
      let cur = comp.hpCur == null || comp.hpCur === '' ? s.hp : num(comp.hpCur);
      if (t.dataset.chp === 'full') {
        if (!await confirmBox(`Heal ${comp.name || 'this companion'} to full hit points?`, 'Heal fully')) return;
        comp.hpCur = null;
      } else {
        if (!amt) return;
        if (t.dataset.chp === 'dmg') {
          let rest = amt; const temp = num(comp.hpTemp);
          if (temp) { const used = Math.min(temp, rest); comp.hpTemp = temp - used; rest -= used; }
          cur -= rest;
        } else cur = Math.min(s.hp, cur + amt);
        comp.hpCur = cur >= s.hp ? null : cur;
      }
      return changed({ rerender: true });
    }
    if (t.dataset.syncLevel !== undefined) { comp.levelOverride = ''; return changed({ rerender: true }); }
    if (t.dataset.pic !== undefined || t.dataset.picEdit !== undefined || t.dataset.picClear !== undefined) {
      if (await picAction(t, comp, PIC)) changed({ rerender: true });
      return;
    }
    if (t.dataset.delComp !== undefined) {
      if (await confirmBox(`Remove ${comp.name || 'this companion'}?`, 'Remove')) { c.companions.splice(i, 1); changed({ rerender: true }); }
    } else if (t.dataset.addFeat !== undefined) {
      const r = await pickEntry('Companion feat', 'Feat');
      if (r) { comp.feats.push({ id: r.id, name: r.name }); changed({ rerender: true }); }
    } else if (t.dataset.rmFeat !== undefined) {
      const f = comp.feats[+t.dataset.rmFeat];
      if (await confirmBox(`Remove the feat “${f?.name || 'this feat'}” from ${comp.name || 'this companion'}?`, 'Remove')) { comp.feats.splice(+t.dataset.rmFeat, 1); changed({ rerender: true }); }
    } else if (t.dataset.addEvo !== undefined) {
      await chooseEvolutions(comp, levels, data); changed({ rerender: true });
    } else if (t.dataset.rmEvo !== undefined) {
      const ev = comp.evolutions[+t.dataset.rmEvo];
      if (await confirmBox(`Remove the evolution “${ev?.name || 'this evolution'}”?`, 'Remove')) { comp.evolutions.splice(+t.dataset.rmEvo, 1); changed({ rerender: true }); }
    } else if (t.dataset.addSkill !== undefined) {
      const sel = t.previousElementSibling;
      if (sel.value) { comp.skills[sel.value] = num(comp.skills[sel.value]) || 1; changed({ rerender: true }); }
    } else if (t.dataset.evoInfo !== undefined) {
      const ev = data.eidolon.evolutions.find(x => x.name === t.dataset.evoInfo);
      if (ev) showCustom({ name: ev.name, cat: 'Evolution', sub: `${ev.cost}-point · ${ev.source}`, html: ev.html });
    }
  };
}

const bind = (path, v, { type = 'text', cls = 'w3', rerender = true, ph = '' } = {}) =>
  `<input class="${cls}${type === 'num' ? ' num' : ''}" ${type === 'num' ? 'type="number" data-type="num"' : ''} data-bind="${path}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${rerender ? 'data-rerender' : ''}>`;
const select = (path, cur, options) => `<select data-bind="${path}" data-rerender>${options.map(o => {
  const [v, l] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
}).join('')}</select>`;

/** A stored level override that just matches the sheet is dropped, so the level follows the sheet when you level up. */
function syncLevel(comp, s) {
  if (num(comp.levelOverride) && num(comp.levelOverride) === s.autoLevel) comp.levelOverride = '';
}
const overrideNote = (comp, s) => (num(comp.levelOverride) && num(comp.levelOverride) !== s.autoLevel
  ? ` · overridden to <b>${s.level}</b> <a href="#" data-sync-level>use the sheet’s level</a>` : '');

/** Overview-style panels for a companion: hit points with the portrait, ability scores, and defense / offense numbers. */
function topPanels(comp, s, p) {
  const max = s.hp;
  const cur = comp.hpCur == null || comp.hpCur === '' ? max : num(comp.hpCur);
  const con = s.abilities.con ?? 0;
  const pct = Math.max(0, Math.min(100, cur / Math.max(1, max) * 100));
  const state = cur <= -con ? 'dead' : cur <= 0 ? 'downed' : '';
  const status = cur <= -con ? `<b class="bad">Dead</b> (HP at or below −${con})`
    : cur < 0 ? `<b class="bad">Dying</b>. <b>Dead at −${con} HP</b>, ${cur + con} more damage.`
      : cur === 0 ? `<b class="warn">Disabled</b>. Dying below 0, dead at −${con} HP.` : '';
  const portrait = comp.image
    ? `<div class="portrait-frame"><img src="${comp.image}" alt="">
        <div class="portrait-tools"><button class="icon-btn" data-pic title="Change picture">✎</button><button class="icon-btn" data-pic-edit title="Recenter or resize">⤢</button><button class="icon-btn" data-pic-clear title="Remove picture">✕</button></div></div>`
    : '<button class="portrait-frame empty" data-pic title="Add a picture">＋ Add a picture</button>';
  const M = a => (s.mods[a] == null ? '—' : sign(s.mods[a]));
  const stat = (label, v) => `<div class="stat"><div class="label">${label}</div><span class="big">${v}</span></div>`;
  return `<div class="grid overview-grid comp-top">
    <section class="card hp has-portrait ${state}">
      <div class="hp-main"><h3>Hit Points</h3>
        <div class="hp-big">${cur}<span class="muted"> / </span>${max}</div>
        <div class="hp-bar"><div class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></div></div>
        <div class="row"><input type="number" class="num w4" data-chp-amt placeholder="0" min="0">
          <button class="btn danger" data-chp="dmg">Damage</button><button class="btn good" data-chp="heal">Heal</button>
          <button class="btn" data-chp="full" title="Heal to full hit points"><span class="heart">♥</span> Full heal</button></div>
        <div class="kv"><label>Current ${bind(`${p}.hpCur`, comp.hpCur, { type: 'num', cls: 'w4', ph: 'max' })}</label>
          <label>Temp ${bind(`${p}.hpTemp`, comp.hpTemp, { type: 'num', cls: 'w3' })}</label></div>
        <p class="small muted">${status}</p></div>
      ${portrait}
    </section>
    <section class="card abilities"><h3>Ability Scores</h3>
      <table class="tbl"><thead><tr><th></th><th>Score</th><th>Mod</th></tr></thead><tbody>${ABIL.map(a => `<tr><th>${a.toUpperCase()}</th>
        <td class="big">${s.abilities[a] ?? '—'}</td><td class="big accent">${M(a)}</td></tr>`).join('')}</tbody></table></section>
    <section class="card defense"><h3>Defense</h3>
      <div class="stat-row">${stat('AC', s.ac.total)}${stat('Touch', s.ac.touch)}${stat('Flat-footed', s.ac.flat)}${stat('CMD', s.cmd)}</div>
      <p class="small muted">AC = 10 ${[s.mods.dex ? `${sign(s.mods.dex)} Dex` : '', s.natural ? `+${s.natural} natural` : '', s.sizeMods.ac ? `${sign(s.sizeMods.ac)} size` : ''].filter(Boolean).join(' ')}</p>
      <table class="tbl saves"><thead><tr><th>Save</th><th>Total</th></tr></thead><tbody>
        ${[['Fortitude', 'fort'], ['Reflex', 'ref'], ['Will', 'will']].map(([n, k]) => `<tr><th>${n}</th><td class="big accent">${sign(s.saves[k])}</td></tr>`).join('')}</tbody></table>
      ${defenseLine(s)}
    </section>
    <section class="card offense"><h3>Offense</h3>
      <div class="stat-row">${stat('Init', sign(s.init))}${stat('BAB', sign(s.bab))}${stat('CMB', sign(s.cmb))}${stat('Speed', `${esc(String(s.speed))}`)}</div>
      ${s.attacks.length ? `<table class="tbl"><thead><tr><th>Attack</th><th>Bonus</th><th>Damage</th></tr></thead><tbody>${s.attacks.map(a => `<tr>
        <td>${a.count > 1 ? a.count + ' ' : ''}${esc(a.name)}${a.secondary ? ' <span class="dim small">(secondary)</span>' : ''}</td><td class="big accent">${sign(a.bonus)}</td>
        <td>${esc(a.dice ? a.dice + (a.damage.slice(a.dice.length) || '') + (a.extra ? ' ' + a.extra : '') : '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No natural attacks.</p>'}
      ${s.specialAttacks ? `<p><b>Special attacks</b> ${esc(s.specialAttacks)}</p>` : ''}
    </section>
    <section class="card span2"><h3>At a glance</h3>
      <div class="chips">${glance(s).map(x => `<span class="chip on">${esc(x)}</span>`).join('')}</div>
      ${extras(comp, s)}
      ${s.specials.length ? `<h4>Special abilities</h4><div class="chips">${s.specials.map(x => `<a href="#" class="chip ref" data-entry="${esc(x.replace(/ \d+$/, ''))}" data-cat="Class Feature">${esc(x)}</a>`).join('')}</div>` : ''}
      <h4>Skills</h4><div class="stat-row">${skillTiles(s).map(k => stat(esc(k.name), sign(k.total))).join('')}</div>
    </section></div>`;
}

/** Perception is always shown (it is in every stat block), then the trained skills. */
function skillTiles(s) {
  const out = s.skills.filter(k => k.name !== 'Perception');
  return [{ name: 'Perception', total: s.skills.find(k => k.name === 'Perception')?.total ?? s.mods.wis ?? 0 }, ...out];
}

/** Feats, evolutions, tricks and defensive abilities: the rest of what the full stat block lists. */
function extras(comp, s) {
  const feats = [...(comp.feats || []).map(f => f.name), ...(s.bonusFeats ? s.bonusFeats.split(/,\s*/) : [])].filter(Boolean);
  const evo = s.kind === 'eidolon' ? [...s.free, ...(comp.evolutions || []).map(e => e.name.toLowerCase() + (e.choice ? ` (${e.choice})` : ''))] : [];
  const evasion = s.specials.filter(x => /evasion/i.test(x));
  const block = (title, items) => (items.length ? `<h4>${title}</h4><div class="chips">${items.map(x => `<span class="chip">${linkTerms(x)}</span>`).join('')}</div>` : '');
  return block('Feats', feats) + block('Defensive abilities', evasion) + block('Evolutions', evo)
    + (s.kind === 'animal' && comp.tricks ? `<h4>Tricks</h4><p>${esc(comp.tricks)}</p>` : '')
    + (s.qualities && s.kind !== 'familiar' ? `<h4>Special qualities</h4><p>${linkTerms(s.qualities)}</p>` : '');
}

/** Short facts shown as chips: size and type, level, hit dice, senses, space and reach. */
function glance(s) {
  const type = s.kind === 'animal' ? 'animal' : s.kind === 'familiar' ? 'magical beast' : 'outsider';
  const out = [`${s.size} ${type}`, `${s.kind === 'familiar' ? 'Master level' : 'Level'} ${s.level}`, `${s.hd} HD`];
  if (s.kind === 'familiar') {
    if (s.species.senses) out.push(s.species.senses);
    if (s.species.space || s.species.reach) out.push(`Space ${s.species.space || '—'}, reach ${s.species.reach || '—'}`);
  } else if (s.kind === 'animal') {
    const sn = s.qualities.match(/low-light vision|darkvision[^,]*|scent|tremorsense[^,]*/gi);
    if (sn) out.push(sn.join(', '));
  } else out.push('Darkvision 60 ft.');
  if (s.kind === 'animal') out.push(`${s.bonusTricks} bonus tricks`);
  return out;
}
const defenseLine = s => (s.qualities && s.kind === 'animal' ? `<p class="small"><b>Qualities</b> ${esc(s.qualities)}</p>` : '');

function companionCard(comp, i, levels, data, master) {
  const p = `companions.${i}`;
  const head = `<div class="row"><h3 class="grow" style="margin:0">${tf(`${p}.name`, { placeholder: 'Name' })}</h3>
    <span class="pill">${{ animal: 'Animal companion', eidolon: 'Eidolon', familiar: 'Familiar', custom: 'Companion' }[comp.kind]}</span>
    <button class="icon-btn" data-del-comp title="Remove">✕</button></div>`;
  if (comp.kind === 'custom') {
    return `<section class="card companion" data-comp="${i}">${head}
      <div class="grid two"><div>${picFrame(comp.image, 'lg')}<h4>Stat block</h4>${tf(`${p}.statblock`, { multiline: true, placeholder: 'Double-click to paste or type a stat block', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion stat block' } })}</div>
      <div><h4>Notes</h4>${tf(`${p}.notes`, { multiline: true, placeholder: 'Double-click to add notes', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}</div></div></section>`;
  }
  if (comp.kind === 'familiar') return familiarCard(comp, i, levels, data, master, head);
  const s = computeCompanion(comp, levels, data);
  syncLevel(comp, s);
  const isAnimal = comp.kind === 'animal';
  const levelNote = s.autoLevel
    ? `From your classes: <b>${s.autoLevel}</b>${isAnimal && levels._why?.animal ? ` · ${esc(levels._why.animal)}` : ''}${overrideNote(comp, s)}`
    : `<span class="warn">Nothing on the sheet grants ${isAnimal ? 'an animal companion' : 'an eidolon'}; set the level here.</span>`;
  const featsLeft = s.featSlots - s.featsUsed;
  const ranksLeft = s.skillRanks - s.skillRanksUsed;
  const classSkills = [...s.classSkills, ...(comp.extraClassSkills || [])];
  const skillNames = [...new Set([...classSkills.filter(x => !x.includes('(') || x.startsWith('Knowledge')), ...Object.keys(comp.skills || {})])];
  return `<div class="companion" data-comp="${i}">${head}${topPanels(comp, s, p)}<details class="block-toggle card-details" data-block="${p}" ${comp.blockOpen === false ? '' : 'open'}><summary>Settings, abilities &amp; full stat block</summary>
  <div class="grid two">
    <div>
      <div class="form">
        ${isAnimal
          ? `<label>Species ${select(`${p}.species`, comp.species, data.animal.species.map(x => [x.name, `${x.name} (${x.size})`]))}</label>
             <p class="small muted">${esc(s.species.source)} · advances at ${ord(s.species.advance?.level || 4)} level${s.advanced ? ' <b class="good">(advanced)</b>' : ''}
               · <a href="#" class="ref" data-entry="Animal Companion" data-cat="Rules">companion rules</a></p>`
          : `<label>Base form ${select(`${p}.form`, comp.form, data.eidolon.forms.map(x => [x.name, `${x.name} (${x.source})`]))}</label>
             <p class="small muted"><a href="#" class="ref" data-entry="Eidolon" data-cat="Rules">eidolon rules</a></p>`}
        <label>${isAnimal ? 'Effective druid level' : 'Summoner level'} ${bind(`${p}.levelOverride`, comp.levelOverride, { type: 'num', ph: String(s.autoLevel || 1) })}
          <span class="small muted">${levelNote}</span></label>
      </div>
      ${s.increases ? `<h4>Ability score increases (${s.increases})</h4><div class="row">${Array.from({ length: s.increases }, (_, k) =>
        select(`${p}.increases.${k}`, comp.increases?.[k], [['', 'choose…'], ...ABIL.map(a => [a, '+1 ' + a.toUpperCase()])])).join('')}</div>` : ''}
      ${!isAnimal ? evolutionsBlock(comp, s, data, p) : ''}
      <h4>Feats <span class="pill ${featsLeft < 0 ? 'bad' : featsLeft ? 'warn' : 'good'}">${s.featsUsed} / ${s.featSlots}</span></h4>
      <div class="chips">${(comp.feats || []).map((f, k) => `<span class="chip on">${f.id ? `<a href="#" class="ref" data-entry="${esc(f.name)}" data-entry-id="${f.id}">${esc(f.name)}</a>` : esc(f.name)} <button class="icon-btn" data-rm-feat="${k}">✕</button></span>`).join('')}
        <button class="btn small" data-add-feat>＋ Feat</button></div>
      ${s.bonusFeats ? `<p class="small muted">Bonus feat: ${esc(s.bonusFeats)}</p>` : ''}
      <h4>Skills <span class="pill ${ranksLeft < 0 ? 'bad' : ranksLeft ? 'warn' : 'good'}">${s.skillRanksUsed} / ${s.skillRanks} ranks</span></h4>
      <table class="tbl mini"><tbody>${skillNames.map(name => {
        const r = num(comp.skills?.[name]);
        const sk = s.skills.find(x => x.name === name);
        const isClass = classSkills.includes(name);
        return `<tr><td>${isClass ? '●' : ''}</td><td>${esc(name)}</td><td class="dim small">${skillAbility(name).toUpperCase()}</td>
          <td>${bind(`${p}.skills.${name}`, r || '', { type: 'num', cls: 'w2' })}</td><td><b>${sk ? sign(sk.total) : ''}</b></td></tr>`;
      }).join('')}</tbody></table>
      <div class="row"><select><option value="">Add another skill…</option>${SKILLS.map(x => x.name).filter(x => !skillNames.includes(x) && !['Craft', 'Perform', 'Profession'].includes(x)).map(x => `<option>${esc(x)}</option>`).join('')}</select>
        <button class="btn small" data-add-skill>Add</button></div>
      ${!isAnimal ? `<p class="small muted">Eidolons choose 4 more class skills at 1st level: ${(comp.extraClassSkills || []).length}/4 chosen.
        ${select(`${p}.extraClassSkills.${(comp.extraClassSkills || []).length}`, '', [['', '＋ class skill…'], ...SKILLS.map(x => x.name).filter(x => !classSkills.includes(x)).map(x => [x, x])])}</p>` : ''}
      ${isAnimal ? `<h4>Tricks <span class="muted small">(${s.bonusTricks} bonus tricks; Int ${s.abilities.int ?? '—'} allows ${s.abilities.int ? 3 * s.abilities.int : 0} trained tricks)</span></h4>
        ${tf(`${p}.tricks`, { multiline: true, placeholder: 'e.g. attack, come, defend, down, guard, heel, track', read: { title: `${comp.name} tricks`, cat: 'Tricks' } })}
        <p class="small">${'<a href="#" class="ref" data-entry="Handle Animal" data-cat="Skill">Handle Animal and tricks</a>'}</p>` : ''}
      <h4>Adjustments</h4>
      <div class="kv"><label title="Barding, items">AC misc ${bind(`${p}.acMisc`, comp.acMisc, { type: 'num' })}</label>
        <label>HP misc ${bind(`${p}.hpMisc`, comp.hpMisc, { type: 'num' })}</label>
        <label title="Amulet of mighty fists, etc.">Attack misc ${bind(`${p}.attackMisc`, comp.attackMisc, { type: 'num' })}</label></div>
      <h4>Notes</h4>${tf(`${p}.notes`, { multiline: true, placeholder: 'Gear, personality, conditions…', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}
    </div>
    <div>${statBlock(comp, s)}</div>
  </div></details></div>`;
}

function familiarCard(comp, i, levels, data, master, head) {
  const p = `companions.${i}`;
  const s = computeCompanion(comp, levels, data, master);
  syncLevel(comp, s);
  const levelNote = s.autoLevel
    ? `From your sheet: <b>${s.autoLevel}</b>${levels._why?.familiar ? ` · ${esc(levels._why.familiar)}` : ''}${overrideNote(comp, s)}`
    : '<span class="warn">Nothing on the sheet grants a familiar (wizard, sorcerer, witch or shaman levels, or the arcanist’s Familiar exploit); set the level here.</span>';
  const sp = s.species;
  return `<div class="companion" data-comp="${i}">${head}${topPanels(comp, s, p)}<details class="block-toggle card-details" data-block="${p}" ${comp.blockOpen === false ? '' : 'open'}><summary>Settings, abilities &amp; full stat block</summary>
  <div class="grid two">
    <div>
      <div class="form">
        <label>Kind ${select(`${p}.species`, comp.species, data.familiar.species.map(x => [x.name, `${x.name} (${x.size})`]))}</label>
        <p class="small muted">${esc(sp.source)} · <a href="#" class="ref" data-entry="Familiar" data-cat="Rules">familiar rules</a></p>
        <label>Effective master level ${bind(`${p}.levelOverride`, comp.levelOverride, { type: 'num', ph: String(s.autoLevel || 1) })}
          <span class="small muted">${levelNote}</span></label>
      </div>
      <h4>Master gains</h4>
      <p>${esc(sp.masterBonus || 'No bonus listed in the books for this kind. Check with your GM.')}</p>
      <h4>Familiar abilities</h4>
      <ul class="small">${s.specials.map(x => `<li><a href="#" class="ref" data-entry="${esc(x.replace(/ \d+$/, ''))}" data-cat="Class Feature">${esc(x)}</a></li>`).join('')}</ul>
      <p class="small muted">Hit points are half the master's, attacks use the master's base attack bonus, and saves and skill ranks are the better of the familiar's or the master's.
        Feats and conditional skill bonuses (such as Skill Focus) are shown as printed. Variants (the Improved Familiar feat, archetypes and other changes) aren't calculated; note them below.</p>
      <h4>Adjustments</h4>
      <div class="kv"><label title="Barding, items">AC misc ${bind(`${p}.acMisc`, comp.acMisc, { type: 'num' })}</label>
        <label>HP misc ${bind(`${p}.hpMisc`, comp.hpMisc, { type: 'num' })}</label>
        <label>Attack misc ${bind(`${p}.attackMisc`, comp.attackMisc, { type: 'num' })}</label></div>
      <h4>Notes</h4>${tf(`${p}.notes`, { multiline: true, placeholder: 'Variants, gear, personality…', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}
    </div>
    <div>${statBlock(comp, s)}</div>
  </div></details></div>`;
}

function evolutionsBlock(comp, s, data, p) {
  const left = s.pool - s.spent;
  return `<h4>Evolutions <span class="pill ${left < 0 ? 'bad' : left ? 'warn' : 'good'}">${s.spent} / ${s.pool} points</span>
      <button class="btn small" data-add-evo>＋ Evolution</button></h4>
    <p class="small muted">Free with ${esc(s.form.name.toLowerCase())} form: ${esc(s.free.join(', '))}. Max natural attacks: ${s.maxAttacks}${s.attackCount > s.maxAttacks ? ` · <b class="bad">${s.attackCount} attacks is over the limit</b>` : ''}.</p>
    <div class="chips">${(comp.evolutions || []).map((e, k) => {
      const def = data.eidolon.evolutions.find(x => x.name === e.name);
      const choice = e.name === 'Ability Increase'
        ? select(`${p}.evolutions.${k}.choice`, e.choice, [['', 'ability…'], ...ABIL.map(a => [a, a.toUpperCase()])])
        : e.name === 'Improved Damage'
          ? select(`${p}.evolutions.${k}.choice`, e.choice, [['', 'attack…'], ...s.attacks.map(a => [a.name, a.name])])
          : def?.repeat || /Resistance|Immunity|Skilled|Energy Attacks|Basic Magic|Minor Magic|Major Magic|Ultimate Magic/.test(e.name)
            ? bind(`${p}.evolutions.${k}.choice`, e.choice, { cls: 'w6', ph: 'choice', rerender: false }) : '';
      return `<span class="chip on"><a href="#" class="ref" data-evo-info="${esc(e.name)}">${esc(e.name)}</a> <span class="dim small">${def?.cost ?? '?'}</span> ${choice}
        <button class="icon-btn" data-rm-evo="${k}">✕</button></span>`;
    }).join('')}</div>`;
}

function statBlock(comp, s) {
  const M = a => (s.mods[a] == null ? '—' : sign(s.mods[a]));
  const ab = a => `${a[0].toUpperCase() + a.slice(1)} ${s.abilities[a] ?? '—'}`;
  const typ = s.kind === 'animal' ? 'animal' : s.kind === 'familiar' ? 'magical beast (augmented animal)' : 'outsider';
  const fam = s.kind === 'familiar';
  return `<div class="statblock">
    <p><b style="font-size:15px">${esc(comp.name || (s.kind === 'animal' ? s.species.name : 'Eidolon'))}</b>
      <span class="muted"> · ${s.kind === 'eidolon' ? esc(s.form.name) + ' eidolon' : esc(s.species.name)} · ${fam ? 'master level' : 'level'} ${s.level}</span></p>
    <p>${esc(s.size)} ${typ}${fam ? `<span class="muted small"> · space ${esc(s.species.space || '—')}, reach ${esc(s.species.reach || '—')}</span>` : ''}</p>
    <p><b>Init</b> ${sign(s.init)}; <b>Senses</b> ${fam ? linkTerms(s.species.senses || '—') : s.kind === 'animal' ? linkTerms(s.qualities.match(/low-light vision|darkvision[^,]*|scent|tremorsense[^,]*/gi)?.join(', ') || '—') : linkTerms('darkvision 60 ft.')}; Perception ${sign((s.skills.find(x => x.name === 'Perception')?.total) ?? s.mods.wis)}</p>
    <h4>Defense</h4>
    <p><b>AC</b> ${s.ac.total}, touch ${s.ac.touch}, flat-footed ${s.ac.flat} <span class="muted small">(${[`${M('dex')} Dex`, `+${s.natural} natural`, s.sizeMods.ac ? `${sign(s.sizeMods.ac)} size` : ''].filter(Boolean).join(', ')})</span></p>
    <p><b>hp</b> ${s.hp} ${fam ? '(half the master’s)' : `(${s.hd}d${s.hdDie}${s.mods.con ? sign(s.mods.con * s.hd) : ''})`}</p>
    <p><b>Fort</b> ${sign(s.saves.fort)}, <b>Ref</b> ${sign(s.saves.ref)}, <b>Will</b> ${sign(s.saves.will)}${s.specials.some(x => /devotion/i.test(x)) ? ' (+4 vs. enchantment)' : ''}</p>
    ${s.specials.some(x => /evasion/i.test(x)) ? `<p><b>Defensive Abilities</b> ${linkTerms(s.specials.filter(x => /evasion/i.test(x)).join(', ').toLowerCase())}</p>` : ''}
    <h4>Offense</h4>
    <p><b>Speed</b> ${esc(s.speed)}</p>
    <p><b>Melee</b> ${s.attacks.length ? linkTerms(s.attacks.map(a => a.text).join(', ')) : '—'}</p>
    ${s.specialAttacks ? `<p><b>Special Attacks</b> ${linkTerms(s.specialAttacks)}</p>` : ''}
    <h4>Statistics</h4>
    <p>${ABIL.map(ab).join(', ')}</p>
    <p><b>Base Atk</b> ${sign(s.bab)}; <b>CMB</b> ${sign(s.cmb)}; <b>CMD</b> ${s.cmd}</p>
    <p><b>Feats</b> ${esc([...(comp.feats || []).map(f => f.name), s.bonusFeats].filter(Boolean).join(', ') || '—')}</p>
    <p><b>Skills</b> ${esc(s.skills.map(x => `${x.name} ${sign(x.total)}`).join(', ') || '—')}</p>
    ${fam ? `<p><b>SQ</b> ${linkTerms([...s.specials, s.qualities].filter(Boolean).join(', ').toLowerCase())}</p>` : s.kind === 'animal' ? `<p><b>SQ</b> ${linkTerms([...s.specials.filter(x => !/evasion|devotion/i.test(x)), s.qualities].filter(Boolean).join(', ').toLowerCase())}</p>`
      : `<p><b>SQ</b> ${linkTerms(s.specials.join(', ').toLowerCase())}</p>
         <p><b>Evolutions</b> ${esc([...s.free, ...(comp.evolutions || []).map(e => e.name.toLowerCase() + (e.choice ? ` (${e.choice})` : ''))].join(', '))}</p>`}
    ${s.kind === 'animal' && comp.tricks ? `<p><b>Tricks</b> ${esc(comp.tricks)}</p>` : ''}
  </div>`;
}

function chooseEvolutions(comp, levels, data) {
  return modal('Add evolutions', (body, close) => {
    const draw = () => {
      const s = computeCompanion(comp, levels, data);
      const left = s.pool - s.spent;
      body.innerHTML = `<div class="pick-status ${left <= 0 ? 'done' : ''}"><span class="left">${left > 0 ? `${left} evolution point${left > 1 ? 's' : ''} left` : 'All evolution points spent'}</span>
          <span class="small">(${s.spent} of ${s.pool} used at summoner level ${s.level})</span></div>
        <input class="search" placeholder="Filter evolutions…">
        ${[1, 2, 3, 4].map(cost => `<h4>${cost}-point evolutions</h4><div class="arch-grid">${data.eidolon.evolutions.filter(e => e.cost === cost).map(e => {
          const taken = comp.evolutions.some(x => x.name === e.name);
          const blocked = e.cost > left || (taken && !e.repeat);
          return `<div class="arch-card ${taken ? 'on' : ''} ${blocked ? 'blocked' : ''}" data-evo="${esc(e.name)}" data-search="${esc((e.name + ' ' + e.summary).toLowerCase())}"
            title="${blocked ? (taken && !e.repeat ? 'Already chosen' : 'Not enough points') : 'Click to add'}">
            <h4>${taken ? '✓ ' : ''}${esc(e.name)}</h4><div class="desc">${esc(e.summary)}</div>
            <div class="small muted">${esc(e.source)}${e.repeat ? ' · can be taken more than once' : ''}</div></div>`;
        }).join('')}</div>`).join('')}`;
      const input = $('input.search', body);
      input.oninput = () => $$('[data-evo]', body).forEach(x => (x.style.display = x.dataset.search.includes(input.value.toLowerCase()) ? '' : 'none'));
    };
    body.onclick = e => {
      const card = e.target.closest('[data-evo]');
      if (!card || card.classList.contains('blocked')) return;
      comp.evolutions.push({ name: card.dataset.evo, choice: '' });
      draw();
    };
    draw();
  }, { wide: true });
}
