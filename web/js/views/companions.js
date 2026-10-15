// Companions tab: animal companions and eidolons with computed stat blocks, plus free-form entries
// (familiars, mounts, cohorts).
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { classLevels, sign, num } from '../calc.js';
import { computeCompanion, newCompanion, withCompanionSources, ANIMAL_SKILLS, EIDOLON_SKILLS, skillAbility } from '../companions.js';
import { computeCreature, newCreatureCompanion } from '../creaturecomp.js';
import { statBlockHtml } from '../summons.js';
import { classFeatures, archetypesOf } from '../features.js';
import { linkTerms } from '../termlinks.js';
import { hpSegments, segsHtml } from '../bars.js';
import { hpFx } from '../healfx.js';
import { playSfx } from '../sfx.js';
import { tipText } from '../rolltip.js';
import { event as petEvent } from '../pet/pet.js';
import { SKILLS } from '../data.js';
import { esc, $, $$, getPath, modal, pickEntry, textField, confirmBox, showCustom, debounce } from '../ui.js';
import { picAction, picFrame } from '../cropper.js';
import { renderSummons } from './summons.js';

const PIC = { w: 3, h: 4, out: 800 };

// What a familiar borrows from its master: base attack bonus, base saves, hit points and skill ranks.
function masterOf(c, levels = {}) {
  const d = state.derived;
  if (!d) return {};
  return { bab: d.bab, hp: d.hp.max, saves: { fort: d.saves.fort.base, ref: d.saves.ref.base, will: d.saves.will.base },
    ranks: Object.fromEntries((c.skills || []).map(s => [s.name, num(s.ranks)])), alignment: c.alignment, improvedFamiliar: levels._improved };
}

let dataPromise = null;
const loadData = () => (dataPromise ||= api.companions().catch(e => { dataPromise = null; throw e; }));
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const tf = (path, opts) => textField(path, getPath(state.char, path), opts);

export async function renderCompanions(body, c) {
  body.innerHTML = '<section class="card loading-page"><p class="muted">Loading companion rules…</p></section>';
  let data;
  try { data = await loadData(); } catch (e) { body.innerHTML = `<p class="bad pad">Couldn't load companion data: ${esc(e.message)}</p>`; return; }
  c.companions ||= [];
  const base = classLevels(c);
  const archs = Object.keys(base).flatMap(cls => archetypesOf(c, cls).map(a => (a.name || '').toLowerCase()));
  const levels = withCompanionSources(base, c, classFeatures(c, state.classesByName), archs, state.derived?.level || 0);
  body.innerHTML = `
    <h3 class="page-title">Companions</h3>
    <section class="card summons" id="summons-card"></section>
    <div class="row"><span class="grow"></span>
      <button class="btn small" data-new="animal">＋ Animal companion</button>
      <button class="btn small" data-new="eidolon">＋ Eidolon</button>
      <button class="btn small" data-new="familiar">＋ Familiar</button>
      <button class="btn small" data-from-creature title="Take any creature from the Bestiary and other monster books as a companion">＋ From creature list…</button>
      <button class="btn small ghost" data-new="custom">＋ Other (mount, cohort)</button></div>
    ${c.companions.length ? '' : `<section class="card"><p class="muted">No companions yet.</p>
      <p class="small muted">Animal companions come from druid, hunter, ranger (from 4th level), cavalier, samurai and paladin (divine bond) levels, the Animal domain, and the Animal Ally and Boon Companion feats; eidolons from summoner levels; familiars from wizard, sorcerer, witch and shaman levels, the arcanist’s Familiar exploit, and a few archetypes.
      Levels are worked out from your classes automatically, and you can override them.</p></section>`}
    ${c.companions.map((comp, i) => companionCard(comp, i, levels, data, masterOf(c, levels))).join('')}`;
  renderSummons($('#summons-card', body), c);
  if (state.compFx) {
    const fx = state.compFx;
    state.compFx = null;
    const card = body.querySelector(`[data-comp="${c.companions.findIndex(x => x.id === fx.id)}"] .card.hp`);
    if (card) hpFx(card, fx);
  }

  body.addEventListener('toggle', e => {
    const d = e.target.closest?.('details[data-block]');
    if (!d) return;
    const comp = getPath(c, d.dataset.block);
    if (comp && (comp.blockOpen !== false) !== d.open) { comp.blockOpen = d.open; changed(); }
  }, true);
  body.onclick = async e => {
    const t = e.target.closest('[data-chp],[data-sync-level],[data-pic],[data-pic-edit],[data-pic-clear],[data-new],[data-from-creature],[data-statblock],[data-del-comp],[data-add-feat],[data-rm-feat],[data-add-evo],[data-rm-evo],[data-add-skill],[data-evo-info]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.new) { c.companions.push(newCompanion(t.dataset.new, data)); return changed({ rerender: true }); }
    if (t.dataset.fromCreature !== undefined) {
      const block = await chooseCreature();
      if (block) { c.companions.push(newCreatureCompanion(block)); changed({ rerender: true }); }
      return;
    }
    const i = +t.closest('[data-comp]').dataset.comp;
    const comp = c.companions[i];
    if (t.dataset.statblock !== undefined) { // the classic stat block, in the side panel
      const creature = comp.kind === 'creature';
      const st = creature ? computeCreature(comp) : computeCompanion(comp, levels, data, masterOf(c, levels));
      showCustom({ name: comp.name || (creature ? 'Creature' : 'Companion'), cat: 'Stat block', sub: creature ? `${comp.creature?.source || ''}` : `${st.kind} · level ${st.level}`,
        html: creature ? statBlockHtml(comp.creature || {}, { links: true, companion: true }) : statBlock(comp, st) });
      return;
    }
    if (t.dataset.chp !== undefined) {
      const s = comp.kind === 'creature' ? computeCreature(comp) : computeCompanion(comp, levels, data, masterOf(c, levels));
      const row = t.closest('[data-comp]');
      const amt = Math.abs(num($('[data-chp-amt]', row).value));
      let cur = comp.hpCur == null || comp.hpCur === '' ? s.hp : num(comp.hpCur);
      const before = cur;
      const frac = n => n / Math.max(1, s.hp);
      if (t.dataset.chp === 'full') {
        if (!await confirmBox(`Heal ${comp.name || 'this companion'} to full hit points?`, 'Heal fully')) return;
        state.compFx = { id: comp.id, kind: 'heal', amount: Math.max(0, s.hp - before), frac: Math.max(0.6, frac(s.hp - before)), from: frac(before) };
        playSfx('fullHeal');
        comp.hpCur = null;
      } else {
        if (!amt) return;
        if (t.dataset.chp === 'dmg') {
          let rest = amt; const temp = num(comp.hpTemp);
          if (temp) { const used = Math.min(temp, rest); comp.hpTemp = temp - used; rest -= used; }
          cur -= rest;
        } else cur = Math.min(s.hp, cur + amt);
        comp.hpCur = cur >= s.hp ? null : cur;
        if (cur !== before) {
          state.compFx = { id: comp.id, kind: cur < before ? 'hurt' : 'heal', amount: Math.abs(cur - before), frac: frac(Math.abs(cur - before)), from: frac(before) };
          playSfx(cur < before ? 'hit' : 'heal');
        }
      }
      remarkOnCompanion(comp, before, comp.hpCur == null || comp.hpCur === '' ? s.hp : num(comp.hpCur), s.hp, s.abilities.con ?? 0);
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

/** Lets Cookie react when a companion dies, goes down, or takes or gets a lot of hit points. */
function remarkOnCompanion(comp, before, now, max, con) {
  const delta = now - before, big = Math.max(8, 0.4 * max), pet = comp.name || 'Your companion';
  const type = now <= -con && before > -con ? 'comp-dead' : now <= 0 && before > 0 ? 'comp-down'
    : delta <= -big ? 'comp-hurt-big' : delta >= big ? 'comp-heal-big' : '';
  if (type) petEvent(type, { pet, n: Math.abs(delta) });
}

/** A stored level override that just matches the sheet is dropped, so the level follows the sheet when you level up. */
function syncLevel(comp, s) {
  if (num(comp.levelOverride) && num(comp.levelOverride) === s.autoLevel) comp.levelOverride = '';
}
const overrideNote = (comp, s) => (num(comp.levelOverride) && num(comp.levelOverride) !== s.autoLevel
  ? ` · overridden to <b>${s.level}</b> <a href="#" data-sync-level>use the sheet’s level</a>` : '');

/** Overview-style panels for a companion: hit points with the portrait, ability scores, and defense / offense numbers. */
function topPanels(comp, s, p, ed = {}) {
  const max = s.hp;
  const cur = comp.hpCur == null || comp.hpCur === '' ? max : num(comp.hpCur);
  const con = s.abilities.con ?? 0;
  const pct = Math.max(0, Math.min(100, cur / Math.max(1, max) * 100));
  const state = cur <= -con ? 'dead' : cur <= 0 ? 'downed' : '';
  const status = cur <= -con ? `<b class="bad">Dead</b> (HP at or below −${con})`
    : cur < 0 ? `<b class="bad">Dying</b>. <b>Dead at −${con} HP</b>, ${cur + con} more damage.`
      : cur === 0 ? `<b class="warn">Disabled</b>. Dying below 0, dead at −${con} HP.` : '';
  const portrait = comp.image
    ? `<div class="portrait-frame"><img src="${esc(comp.image)}" alt="">
        <div class="portrait-tools"><button class="icon-btn" data-pic title="Change picture">✎</button><button class="icon-btn" data-pic-edit title="Recenter or resize">⤢</button><button class="icon-btn" data-pic-clear title="Remove picture">✕</button></div></div>`
    : '<button class="portrait-frame empty" data-pic title="Add a picture">＋ Add a picture</button>';
  const M = a => (s.mods[a] == null ? '—' : sign(s.mods[a]));
  const rb = (n, label, parts) => `<button class="nb" data-roll-add="${n}" data-roll-label="${esc(comp.name + ' ' + label)}" data-tip="${esc(tipText(`${comp.name} ${label}`, n, parts, `Click to roll d20${sign(n)}`))}">${sign(n)}</button>`;
  // A skill's parts, worked out from the stat block; whatever they do not cover (a species' listed bonus, the master's ranks) is shown as other bonuses.
  const skillParts = k => { if (s.kind === 'creature') return [{ label: 'Stat block', value: k.total }].filter(x => x.value); const ab = skillAbility(k.name), sz = s.sizeMods || {}; return [{ label: 'Ranks', value: k.ranks || 0 }, { label: `${ab.toUpperCase()} modifier`, value: s.mods?.[ab] ?? 0 }, { label: 'Class skill', value: k.isClass && k.ranks > 0 ? 3 : 0 }, { label: 'Size', value: k.name === 'Stealth' ? sz.stealth || 0 : k.name === 'Fly' ? sz.fly || 0 : 0 }].filter(p => p.value); };
  const stat = (label, v) => `<div class="stat"><div class="label">${label}</div><span class="big">${v}</span></div>`;
  return `<div class="grid overview-grid comp-top">
    <section class="card hp has-portrait ${state}">
      <div class="hp-main"><h3>Hit Points</h3>
        <div class="hp-big">${cur}<span class="muted"> / </span>${max}</div>
        <div class="hp-bar"><div class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></div>${segsHtml(hpSegments(max))}</div>
        <div class="row"><input type="number" class="num w4" data-chp-amt placeholder="0" min="0">
          <button class="btn danger" data-chp="dmg">Damage</button><button class="btn good" data-chp="heal">Heal</button>
          <button class="btn" data-chp="full" title="Heal to full hit points"><span class="heart">♥</span> Full heal</button></div>
        <div class="kv"><label>Current ${bind(`${p}.hpCur`, comp.hpCur, { type: 'num', cls: 'w4', ph: 'max' })}</label>
          <label>Temp ${bind(`${p}.hpTemp`, comp.hpTemp, { type: 'num', cls: 'w3' })}</label>${ed.hp || ''}</div>
        <p class="small muted">${hpNote(s)}</p>
        <p class="small muted">${status}</p></div>
      ${portrait}
    </section>
    <section class="card abilities"><h3>Ability Scores</h3>
      <table class="tbl"><thead><tr><th></th><th>Score</th><th>Mod</th></tr></thead><tbody>${ABIL.map(a => `<tr><th>${a.toUpperCase()}</th>
        <td class="big">${s.abilities[a] ?? '—'}</td><td class="big accent">${M(a)}</td></tr>`).join('')}</tbody></table>${ed.abilities || ''}</section>
    <section class="card defense"><h3>Defense</h3>
      <div class="stat-row">${stat('AC', s.ac.total)}${stat('Touch', s.ac.touch)}${stat('Flat-footed', s.ac.flat)}${stat('CMD', s.cmd)}</div>
      ${ed.ac || ''}
      <p class="small muted">${s.kind === 'creature' ? 'AC from the stat block' + (num(comp.acMisc) ? ` ${sign(num(comp.acMisc))} adjustment` : '') : `AC = 10 ${[s.mods.dex ? `${sign(s.mods.dex)} Dex` : '', s.natural ? `+${s.natural} natural` : '', s.sizeMods.ac ? `${sign(s.sizeMods.ac)} size` : '', num(comp.acMisc) ? `${sign(num(comp.acMisc))} adjustment` : ''].filter(Boolean).join(' ')}`}</p>
      <table class="tbl saves"><thead><tr><th>Save</th><th>Total</th></tr></thead><tbody>
        ${[['Fortitude', 'fort'], ['Reflex', 'ref'], ['Will', 'will']].map(([n, k]) => `<tr><th>${n}</th><td class="big accent">${rb(s.saves[k], n + ' save', s.bd?.[k])}</td></tr>`).join('')}</tbody></table>
      ${s.specials?.some(x => /devotion/i.test(x)) ? '<p class="small muted">+4 vs. enchantment spells and effects (devotion)</p>' : ''}
      ${defenseLine(s)}
    </section>
    <section class="card offense"><h3>Offense</h3>
      <div class="stat-row">${stat('Init', rb(s.init, 'initiative', s.bd?.init))}${stat('BAB', sign(s.bab))}${stat('CMB', rb(s.cmb, 'CMB', s.bd?.cmb))}${stat('Speed', `${esc(String(s.speed))}`)}</div>
      ${s.attacks.length ? `<table class="tbl"><thead><tr><th>Attack</th><th>Bonus</th><th>Damage</th></tr></thead><tbody>${s.attacks.map(a => `<tr>
        <td>${a.count > 1 ? a.count + ' ' : ''}${linkTerms(a.name)}${a.secondary ? ' <span class="dim small">(secondary)</span>' : ''}</td><td class="big accent">${rb(a.bonus, a.name + ' attack', a.parts)}</td>
        <td>${a.dice ? `<button class="nb" data-roll-dice="${esc(a.damage)}" data-roll-label="${esc(comp.name + ' ' + a.name + ' damage')}" data-tip="${esc(`${comp.name} ${a.name} damage` + '\n' + 'Click to roll ' + a.damage)}">${esc(a.damage)}</button>${a.extra ? ' ' + linkTerms(a.extra) : ''}` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No natural attacks.</p>'}
      ${s.specialAttacks ? `<p><b>Special attacks</b> ${linkTerms(s.specialAttacks)}</p>` : ''}
      ${ed.atk || ''}
    </section>
    <section class="card span2"><h3>At a glance</h3>
      <div class="chips">${glance(s).map(x => `<span class="chip on">${esc(x)}</span>`).join('')}</div>
      ${extras(comp, s)}
      ${s.kind === 'familiar' ? `<h4>Master gains</h4><p>${esc(s.species?.masterBonus || 'No bonus listed in the books for this kind. Check with your GM.')}</p>
        <p class="small muted">Hit points are half the master’s, attacks use the master’s base attack bonus, and saves and skill ranks are the better of the familiar’s or the master’s. Feats and conditional skill bonuses (such as Skill Focus) are shown as printed. Improved Familiar kinds and the celestial, entropic, fiendish and resolute archetypes are calculated; other changes (such as the Evolved Familiar feat) aren’t, so note them below.</p>` : ''}
      ${s.abilityNotes?.length ? `<h4>Special abilities</h4>${s.abilityNotes.map(a => `<div class="small"><b>${esc(a.name)}.</b> ${a.html}</div>`).join('')}` : ''}
      ${s.specials.length ? `<h4>Special abilities</h4><div class="chips">${s.specials.map(x => `<a href="#" class="chip ref" data-entry="${esc(x.replace(/ \d+$/, ''))}" data-cat="Class Feature">${esc(x)}</a>`).join('')}</div>` : ''}
      <h4>Skills</h4><div class="stat-row">${skillTiles(s).map(k => stat(esc(k.name), rb(k.total, k.name, skillParts(k)))).join('')}</div>
    </section>${ed.cards || ''}</div>`;
}

/** What the hit points are made of, from the stat block: the dice, or whose they are. */
function hpNote(s) {
  if (s.kind === 'familiar') return ''; // the At a glance panel already says whose they are
  if (s.kind === 'creature') return s.hpText ? `Stat block: ${esc(s.hpText)}` : '';
  return `${s.hd}d${s.hdDie}${s.mods?.con ? sign(s.mods.con * s.hd) : ''} hit dice`;
}
/** Special qualities as the stat block lists them. A familiar's abilities are already chips, so only what they do not repeat is left. */
function qualitiesText(s) {
  if (!s.qualities) return '';
  if (s.kind !== 'familiar') return s.qualities;
  const have = new Set((s.specials || []).map(x => x.toLowerCase()));
  return s.qualities.split(/,\s*/).filter(q => q && !have.has(q.toLowerCase())).join(', ');
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
  const editable = s.kind === 'animal' || s.kind === 'eidolon'; // their feats, evolutions and tricks are edited in the Build panel
  return (editable ? '' : block('Feats', feats)) + block('Defensive abilities', evasion) + (editable ? '' : block('Evolutions', evo))
    + (s.kind === 'animal' && comp.tricks && !editable ? `<h4>Tricks</h4><p>${esc(comp.tricks)}</p>` : '')
    + (qualitiesText(s) ? `<h4>Special qualities</h4><p>${linkTerms(qualitiesText(s))}</p>` : '');
}

/** Short facts shown as chips: size and type, level, hit dice, senses, space and reach. */
function glance(s) {
  if (s.kind === 'creature') return [`${s.size} ${s.type}`, `CR ${s.cr || '—'}`, `${s.hd} HD`, ...(s.senses ? [s.senses] : []), ...(s.space || s.reach ? [`Space ${s.space || '—'}, reach ${s.reach || '—'}`] : []), ...(s.aura ? [`Aura ${s.aura}`] : []), ...(s.languages ? [`Speaks ${s.languages}`] : [])];
  const type = s.kind === 'animal' ? 'animal' : s.kind === 'familiar' ? s.type : 'outsider';
  const out = [`${s.size} ${type}`, `${s.kind === 'familiar' ? 'Master level' : 'Level'} ${s.level}`, `${s.hd} HD`];
  if (s.kind === 'familiar') {
    if (s.template) out.push(`${s.template.name} archetype`);
    if (s.senses) out.push(s.senses);
    if (s.species.space || s.species.reach) out.push(`Space ${s.species.space || '—'}, reach ${s.species.reach || '—'}`);
  } else if (s.kind === 'animal') {
    const sn = s.qualities.match(/low-light vision|darkvision[^,]*|scent|tremorsense[^,]*/gi);
    if (sn) out.push(sn.join(', '));
  } else out.push('Darkvision 60 ft.');
  if (s.kind === 'animal') out.push(`${s.bonusTricks} bonus tricks`);
  return out;
}
/** Damage reduction, resistances, immunities and the like, as one line (familiars; stat-block order). */
const defenseText = s => {
  const d = s.defense || {};
  return [d.defensive, d.fastHealing ? `fast healing ${d.fastHealing}` : '', d.dr && `DR ${d.dr}`, d.immune && `immune ${d.immune}`, d.resist && `resist ${d.resist}`, s.sr && `SR ${s.sr}`, s.weaknesses && `weaknesses ${s.weaknesses}`].filter(Boolean).join('; ');
};
const defenseLine = s => (s.qualities && s.kind === 'animal' ? `<p class="small"><b>Qualities</b> ${esc(s.qualities)}</p>`
  : (s.kind === 'familiar' || s.kind === 'creature') && defenseText(s) ? `<p class="small"><b>Defenses</b> ${linkTerms(defenseText(s))}</p>` : '');

const CREATURE_TYPES = ['Aberration', 'Animal', 'Construct', 'Dragon', 'Fey', 'Humanoid', 'Magical Beast', 'Monstrous Humanoid', 'Ooze', 'Outsider', 'Plant', 'Undead', 'Vermin'];
const CR_RANGES = [['', 'Any CR'], ['0-1', 'CR 0 to 1'], ['2-4', 'CR 2 to 4'], ['5-8', 'CR 5 to 8'], ['9-12', 'CR 9 to 12'], ['13-20', 'CR 13 to 20'], ['21-40', 'CR 21 and up']];

/** The creature list: search, filter by type and CR, read the stat block, and take one as a companion. Resolves to the full stat block, or nothing. */
function chooseCreature() {
  return modal('Companion from the creature list', (body, close) => {
    body.innerHTML = `<div class="row"><input class="search grow" placeholder="Search creatures by name or type…">
        <select data-f="type"><option value="">Any type</option>${CREATURE_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select>
        <select data-f="cr">${CR_RANGES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <p class="small muted" data-count></p>
      <div class="picker"><div class="picker-list"></div><div class="picker-preview entry-body"><p class="muted">Select a creature to read its stat block. It is copied onto your sheet, so it keeps working without the list.</p></div></div>`;
    const q = $('input', body), type = $('[data-f=type]', body), cr = $('[data-f=cr]', body), list = $('.picker-list', body), prev = $('.picker-preview', body), count = $('[data-count]', body);
    let rows = [], seq = 0;
    const run = debounce(async () => {
      const my = ++seq;
      let res;
      try { res = await api.creatures(q.value, type.value, cr.value, 200); } catch (e) { list.innerHTML = `<p class="pad bad">${esc(e.message)}</p>`; return; }
      if (my !== seq) return; // a newer search is already running
      rows = res.rows;
      count.textContent = `${res.total} creature${res.total === 1 ? '' : 's'}${res.total > rows.length ? `, showing the first ${rows.length}: narrow the search` : ''}`;
      list.innerHTML = rows.map((r, i) => `<div class="pick-row" data-i="${i}">
        <div><b>${esc(r.name)}</b> <span class="muted small">CR ${esc(r.cr || '—')} · ${esc(r.size)} ${esc((r.type || '').toLowerCase())}</span></div>
        <div class="muted small">${esc(r.source)}</div><button class="btn small primary" data-pick="${i}">Add</button></div>`).join('') || '<p class="pad muted">No creatures match.</p>';
    }, 150);
    [q, type, cr].forEach(x => x.addEventListener('input', run));
    list.addEventListener('click', async e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { close(await api.creature(rows[+pick.dataset.pick].i)); return; }
      const row = e.target.closest('.pick-row');
      if (!row) return;
      $$('.pick-row.sel', list).forEach(x => x.classList.remove('sel'));
      row.classList.add('sel');
      const b = await api.creature(rows[+row.dataset.i].i);
      prev.innerHTML = `<h3>${esc(b.name)}</h3>${b.description ? `<p class="small muted">${esc(b.description)}</p>` : ''}${statBlockHtml(b, { companion: true })}`;
    });
    run();
    q.focus();
  }, { wide: true });
}

/** A companion taken from the creature list: the stat block's own numbers in the same panels. */
function creatureCard(comp, i, head, actions) {
  const p = `companions.${i}`;
  const s = computeCreature(comp);
  const ed = creatureEditors(comp, p);
  return `<div class="companion" data-comp="${i}">${head}<section class="card comp-bar"><div class="comp-bar-main">${ed.strip}</div><div class="comp-actions">${actions}</div></section>${topPanels(comp, s, p, ed)}</div>`;
}

/** The button that opens the classic stat block in the side panel, at the end of the line of links under the controls. */
const STAT_BTN = '<button class="pill pill-btn comp-statblock" data-statblock title="Open the full stat block in the side panel">📋 Stat block</button>';

/** The player's adjustments, one small box in each panel they change. */
const adjust = (comp, p) => ({
  hp: `<label>HP misc ${bind(`${p}.hpMisc`, comp.hpMisc, { type: 'num' })}</label>`,
  ac: `<div class="kv"><label title="Barding, items">AC misc ${bind(`${p}.acMisc`, comp.acMisc, { type: 'num' })}</label></div>`,
  atk: `<div class="kv"><label title="Amulet of mighty fists, a creature’s feats and so on">Attack misc ${bind(`${p}.attackMisc`, comp.attackMisc, { type: 'num' })}</label></div>`,
});
const notesCard = (comp, p, placeholder) => `<section class="card span2"><h3>Notes</h3>${tf(`${p}.notes`, { multiline: true, placeholder, read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}</section>`;

/** The animal companion's and the eidolon's controls: species or form, level, ability increases, and a Build panel for evolutions, feats, skills and tricks. */
function buildEditors(comp, s, p, { data, levels }) {
  const isAnimal = comp.kind === 'animal';
  const levelNote = s.autoLevel
    ? `From your classes: <b>${s.autoLevel}</b>${isAnimal && levels._why?.animal ? ` · ${esc(levels._why.animal)}` : ''}${overrideNote(comp, s)}`
    : `<span class="warn">Nothing on the sheet grants ${isAnimal ? 'an animal companion' : 'an eidolon'}; set the level here.</span>`;
  const featsLeft = s.featSlots - s.featsUsed;
  const ranksLeft = s.skillRanks - s.skillRanksUsed;
  const classSkills = [...s.classSkills, ...(comp.extraClassSkills || [])];
  const skillNames = [...new Set([...classSkills.filter(x => !x.includes('(') || x.startsWith('Knowledge')), ...Object.keys(comp.skills || {})])];
  const strip = `<div class="comp-strip">
      ${isAnimal
        ? `<label>Species ${select(`${p}.species`, comp.species, data.animal.species.map(x => [x.name, `${x.name} (${x.size})`]))}</label>`
        : `<label>Base form ${select(`${p}.form`, comp.form, data.eidolon.forms.map(x => [x.name, `${x.name} (${x.source})`]))}</label>`}
      <label>${isAnimal ? 'Effective druid level' : 'Summoner level'} ${bind(`${p}.levelOverride`, comp.levelOverride, { type: 'num', ph: String(s.autoLevel || 1) })}</label>
      <span class="small muted">${levelNote}</span>
      <div class="small muted comp-links"><span>${isAnimal
        ? `${esc(s.species.source)} · advances at ${ord(s.species.advance?.level || 4)} level${s.advanced ? ' <b class="good">(advanced)</b>' : ''} · <a href="#" class="ref" data-entry="Animal Companion" data-cat="Rules">companion rules</a>`
        : '<a href="#" class="ref" data-entry="Eidolon" data-cat="Rules">eidolon rules</a>'}</span>${STAT_BTN}</div></div>`;
  const abilities = s.increases ? `<h4>Ability score increases (${s.increases})</h4><div class="row">${Array.from({ length: s.increases }, (_, k) =>
    select(`${p}.increases.${k}`, comp.increases?.[k], [['', 'choose…'], ...ABIL.map(a => [a, '+1 ' + a.toUpperCase()])])).join('')}</div>` : '';
  const build = `<section class="card span2"><h3>Build</h3>
      ${!isAnimal ? evolutionsBlock(comp, s, data, p) : ''}
      <h4>Feats <span class="pill ${featsLeft < 0 ? 'bad' : featsLeft ? 'warn' : 'good'}">${s.featsUsed} / ${s.featSlots}</span></h4>
      <div class="chips">${(comp.feats || []).map((f, k) => `<span class="chip on">${f.id ? `<a href="#" class="ref" data-entry="${esc(f.name)}" data-entry-id="${f.id}">${esc(f.name)}</a>` : esc(f.name)} <button class="icon-btn" data-rm-feat="${k}">✕</button></span>`).join('')}
        <button class="btn small" data-add-feat>＋ Feat</button></div>
      ${s.bonusFeats ? `<p class="small muted">Bonus feat: ${esc(s.bonusFeats)}</p>` : ''}
      <h4>Skill ranks <span class="pill ${ranksLeft < 0 ? 'bad' : ranksLeft ? 'warn' : 'good'}">${s.skillRanksUsed} / ${s.skillRanks} ranks</span></h4>
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
    </section>`;
  return { strip, abilities, ...adjust(comp, p), cards: build + notesCard(comp, p, 'Gear, personality, conditions…') };
}

/** The familiar's controls: kind, archetype, what the feat and alignment need, and the master's level. */
function familiarEditors(comp, s, p, { data, levels }) {
  const sp = s.species;
  const levelNote = s.autoLevel
    ? `From your sheet: <b>${s.autoLevel}</b>${levels._why?.familiar ? ` · ${esc(levels._why.familiar)}` : ''}${overrideNote(comp, s)}`
    : '<span class="warn">Nothing on the sheet grants a familiar (wizard, sorcerer, witch or shaman levels, or the arcanist’s Familiar exploit); set the level here.</span>';
  const strip = `<div class="comp-strip">
      <label>Kind ${kindSelect(`${p}.species`, comp.species, data.familiar)}</label>
      ${sp.improved ? '' : `<label>Archetype ${select(`${p}.template`, comp.template, [['', 'None'], ...(data.familiar.templates || []).map(t => [t.name, `${t.name} (${t.alignment})`])])}</label>`}
      <label>Effective master level ${bind(`${p}.levelOverride`, comp.levelOverride, { type: 'num', ph: String(s.autoLevel || 1) })}</label>
      <span class="small muted">${levelNote}</span>
      <div class="small muted comp-links"><span>${esc(sp.source)} · <a href="#" class="ref" data-entry="Familiar" data-cat="Rules">familiar rules</a>
        · <a href="#" class="ref" data-entry="Improved Familiar" data-cat="Feat">Improved Familiar</a>
        ${sp.improved ? `· <a href="#" class="ref" data-entry="${esc(sp.entry)}" data-cat="Monster">${esc(sp.entry)} stat block</a>` : ''}</span>${STAT_BTN}</div>
      ${s.requirements.length ? `<ul class="small comp-reqs">${s.requirements.map(r => `<li class="${r.ok ? 'good' : 'warn'}">${r.ok ? '✓' : '✗'} ${esc(r.text)}</li>`).join('')}</ul>` : ''}</div>`;
  return { strip, ...adjust(comp, p), cards: notesCard(comp, p, 'Variants, gear, personality…') };
}

/** A creature from the creature list has nothing to choose: just its adjustments and notes. */
function creatureEditors(comp, p) {
  return { strip: `<div class="small muted comp-strip comp-links"><span>Taken from the creature list (${esc(comp.creature?.source || '')}). Its numbers do not change with your level; adjust them for gear, spells and templates.</span>${STAT_BTN}</div>`,
    ...adjust(comp, p), cards: notesCard(comp, p, 'Gear, orders, personality, conditions…') };
}

function companionCard(comp, i, levels, data, master) {
  const p = `companions.${i}`;
  // The kind chip, the stat block button and remove sit on the paper card under the name (a custom companion has no such card, so they stay beside its name).
  const actions = `<span class="pill">${{ animal: 'Animal companion', eidolon: 'Eidolon', familiar: 'Familiar', creature: 'Creature', custom: 'Companion' }[comp.kind]}</span>
    <button class="icon-btn" data-del-comp title="Remove">✕</button>`;
  const head = `<div class="row"><h3 class="grow" style="margin:0">${tf(`${p}.name`, { placeholder: 'Name' })}</h3>${comp.kind === 'custom' ? actions : ''}</div>`;
  if (comp.kind === 'custom') {
    return `<section class="card companion" data-comp="${i}">${head}
      <div class="grid two"><div>${picFrame(comp.image, 'lg')}<h4>Stat block</h4>${tf(`${p}.statblock`, { multiline: true, placeholder: 'Double-click to paste or type a stat block', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion stat block' } })}</div>
      <div><h4>Notes</h4>${tf(`${p}.notes`, { multiline: true, placeholder: 'Double-click to add notes', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}</div></div></section>`;
  }
  if (comp.kind === 'creature') return creatureCard(comp, i, head, actions);
  if (comp.kind === 'familiar') return familiarCard(comp, i, levels, data, master, head, actions);
  const s = computeCompanion(comp, levels, data);
  syncLevel(comp, s);
  const ed = buildEditors(comp, s, p, { data, levels });
  return `<div class="companion" data-comp="${i}">${head}<section class="card comp-bar"><div class="comp-bar-main">${ed.strip}</div><div class="comp-actions">${actions}</div></section>${topPanels(comp, s, p, ed)}</div>`;
}

function familiarCard(comp, i, levels, data, master, head, actions) {
  const p = `companions.${i}`;
  const s = computeCompanion(comp, levels, data, master);
  syncLevel(comp, s);
  const ed = familiarEditors(comp, s, p, { data, levels });
  return `<div class="companion" data-comp="${i}">${head}<section class="card comp-bar"><div class="comp-bar-main">${ed.strip}</div><div class="comp-actions">${actions}</div></section>${topPanels(comp, s, p, ed)}</div>`;
}

/** The familiar Kind picker: the standard list, then what the Improved Familiar feat adds. */
function kindSelect(path, cur, fam) {
  const opt = x => `<option value="${esc(x.name)}" ${x.name === cur ? 'selected' : ''}>${esc(`${x.name} (${x.size})`)}</option>`;
  return `<select data-bind="${path}" data-rerender><optgroup label="Standard familiars">${fam.species.map(opt).join('')}</optgroup>
    <optgroup label="Improved Familiar feat">${(fam.improved || []).map(opt).join('')}</optgroup></select>`;
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
  const typ = s.kind === 'animal' ? 'animal' : s.kind === 'familiar' ? s.type : 'outsider';
  const fam = s.kind === 'familiar';
  return `<div class="statblock">
    <p><b style="font-size:15px">${esc(comp.name || (s.kind === 'animal' ? s.species.name : 'Eidolon'))}</b>
      <span class="muted"> · ${s.kind === 'eidolon' ? esc(s.form.name) + ' eidolon' : esc((s.template ? s.template.name + ' ' : '') + s.species.name)} · ${fam ? 'master level' : 'level'} ${s.level}</span></p>
    <p>${esc(s.size)} ${typ}${fam ? `<span class="muted small"> · space ${esc(s.species.space || '—')}, reach ${esc(s.species.reach || '—')}</span>` : ''}</p>
    <p><b>Init</b> ${sign(s.init)}; <b>Senses</b> ${fam ? linkTerms(s.senses || '—') : s.kind === 'animal' ? linkTerms(s.qualities.match(/low-light vision|darkvision[^,]*|scent|tremorsense[^,]*/gi)?.join(', ') || '—') : linkTerms('darkvision 60 ft.')}; Perception ${sign((s.skills.find(x => x.name === 'Perception')?.total) ?? s.mods.wis)}</p>
    <h4>Defense</h4>
    <p><b>AC</b> ${s.ac.total}, touch ${s.ac.touch}, flat-footed ${s.ac.flat} <span class="muted small">(${[`${M('dex')} Dex`, `+${s.natural} natural`, s.sizeMods.ac ? `${sign(s.sizeMods.ac)} size` : ''].filter(Boolean).join(', ')})</span></p>
    <p><b>hp</b> ${s.hp} ${fam ? '(half the master’s)' : `(${s.hd}d${s.hdDie}${s.mods.con ? sign(s.mods.con * s.hd) : ''})`}</p>
    <p><b>Fort</b> ${sign(s.saves.fort)}, <b>Ref</b> ${sign(s.saves.ref)}, <b>Will</b> ${sign(s.saves.will)}${s.specials.some(x => /devotion/i.test(x)) ? ' (+4 vs. enchantment)' : ''}</p>
    ${s.specials.some(x => /evasion/i.test(x)) ? `<p><b>Defensive Abilities</b> ${linkTerms(s.specials.filter(x => /evasion/i.test(x)).join(', ').toLowerCase())}</p>` : ''}
    ${fam && defenseText(s) ? `<p><b>Defenses</b> ${linkTerms(defenseText(s))}</p>` : ''}
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
