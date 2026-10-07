// Companions tab: animal companions and eidolons with computed stat blocks, plus free-form entries
// (familiars, mounts, cohorts).
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { classLevels, sign, num } from '../calc.js';
import { computeCompanion, newCompanion, ANIMAL_SKILLS, EIDOLON_SKILLS, skillAbility } from '../companions.js';
import { SKILLS } from '../data.js';
import { esc, $, $$, getPath, modal, pickEntry, textField, confirmBox, showCustom, pickImage, picSlot } from '../ui.js';

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
  const levels = classLevels(c);
  body.innerHTML = `
    <div class="row"><h3 class="grow" style="margin:0">Companions</h3>
      <button class="btn small" data-new="animal">＋ Animal companion</button>
      <button class="btn small" data-new="eidolon">＋ Eidolon</button>
      <button class="btn small" data-new="familiar">＋ Familiar</button>
      <button class="btn small ghost" data-new="custom">＋ Other (mount, cohort)</button></div>
    ${c.companions.length ? '' : `<section class="card"><p class="muted">No companions yet.</p>
      <p class="small muted">Animal companions come from druid, hunter, ranger (from 4th level), cavalier and samurai levels; eidolons from summoner levels; familiars from wizard, sorcerer and witch levels.
      Levels are worked out from your classes automatically, and you can override them.</p></section>`}
    ${c.companions.map((comp, i) => companionCard(comp, i, levels, data, masterOf(c))).join('')}`;

  body.onclick = async e => {
    const t = e.target.closest('[data-pic],[data-pic-clear],[data-new],[data-del-comp],[data-add-feat],[data-rm-feat],[data-add-evo],[data-rm-evo],[data-add-skill],[data-evo-info]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.new) { c.companions.push(newCompanion(t.dataset.new, data)); return changed({ rerender: true }); }
    const i = +t.closest('[data-comp]').dataset.comp;
    const comp = c.companions[i];
    if (t.dataset.pic !== undefined) {
      const url = await pickImage(256, { square: true });
      if (url) { comp.image = url; changed({ rerender: true }); }
      return;
    }
    if (t.dataset.picClear !== undefined) { comp.image = ''; return changed({ rerender: true }); }
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

function companionCard(comp, i, levels, data, master) {
  const p = `companions.${i}`;
  const head = `<div class="row">${picSlot(comp.image, 'Add a picture of this companion')}<h3 class="grow" style="margin:0">${tf(`${p}.name`, { placeholder: 'Name' })}</h3>
    <span class="pill">${{ animal: 'Animal companion', eidolon: 'Eidolon', familiar: 'Familiar', custom: 'Companion' }[comp.kind]}</span>
    <button class="icon-btn" data-del-comp title="Remove">✕</button></div>`;
  if (comp.kind === 'custom') {
    return `<section class="card companion" data-comp="${i}">${head}
      <div class="grid two"><div><h4>Stat block</h4>${tf(`${p}.statblock`, { multiline: true, placeholder: 'Double-click to paste or type a stat block', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion stat block' } })}</div>
      <div><h4>Notes</h4>${tf(`${p}.notes`, { multiline: true, placeholder: 'Double-click to add notes', read: { title: comp.name, titlePath: `${p}.name`, cat: 'Companion notes' } })}</div></div></section>`;
  }
  if (comp.kind === 'familiar') return familiarCard(comp, i, levels, data, master, head);
  const s = computeCompanion(comp, levels, data);
  const isAnimal = comp.kind === 'animal';
  const levelNote = s.autoLevel
    ? `From your classes: <b>${s.autoLevel}</b>${num(comp.levelOverride) ? ` (overridden to ${s.level})` : ''}`
    : `<span class="warn">None of your classes grant ${isAnimal ? 'an animal companion' : 'an eidolon'}; set the level here.</span>`;
  const featsLeft = s.featSlots - s.featsUsed;
  const ranksLeft = s.skillRanks - s.skillRanksUsed;
  const classSkills = [...s.classSkills, ...(comp.extraClassSkills || [])];
  const skillNames = [...new Set([...classSkills.filter(x => !x.includes('(') || x.startsWith('Knowledge')), ...Object.keys(comp.skills || {})])];
  return `<section class="card companion" data-comp="${i}">${head}
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
  </div></section>`;
}

function familiarCard(comp, i, levels, data, master, head) {
  const p = `companions.${i}`;
  const s = computeCompanion(comp, levels, data, master);
  const levelNote = s.autoLevel
    ? `From your classes: <b>${s.autoLevel}</b>${num(comp.levelOverride) ? ` (overridden to ${s.level})` : ''}`
    : '<span class="warn">None of your classes grant a familiar; set the level here.</span>';
  const sp = s.species;
  return `<section class="card companion" data-comp="${i}">${head}
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
  </div></section>`;
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
    <p><b>Init</b> ${sign(s.init)}; <b>Senses</b> ${fam ? esc(s.species.senses || '—') : s.kind === 'animal' ? esc(s.qualities.match(/low-light vision|darkvision[^,]*|scent|tremorsense[^,]*/gi)?.join(', ') || '—') : 'darkvision 60 ft.'}; Perception ${sign((s.skills.find(x => x.name === 'Perception')?.total) ?? s.mods.wis)}</p>
    <h4>Defense</h4>
    <p><b>AC</b> ${s.ac.total}, touch ${s.ac.touch}, flat-footed ${s.ac.flat} <span class="muted small">(${[`${M('dex')} Dex`, `+${s.natural} natural`, s.sizeMods.ac ? `${sign(s.sizeMods.ac)} size` : ''].filter(Boolean).join(', ')})</span></p>
    <p><b>hp</b> ${s.hp} ${fam ? '(half the master’s)' : `(${s.hd}d${s.hdDie}${s.mods.con ? sign(s.mods.con * s.hd) : ''})`}</p>
    <p><b>Fort</b> ${sign(s.saves.fort)}, <b>Ref</b> ${sign(s.saves.ref)}, <b>Will</b> ${sign(s.saves.will)}${s.specials.some(x => /devotion/i.test(x)) ? ' (+4 vs. enchantment)' : ''}</p>
    ${s.specials.some(x => /evasion/i.test(x)) ? `<p><b>Defensive Abilities</b> ${esc(s.specials.filter(x => /evasion/i.test(x)).join(', ').toLowerCase())}</p>` : ''}
    <h4>Offense</h4>
    <p><b>Speed</b> ${esc(s.speed)}</p>
    <p><b>Melee</b> ${s.attacks.length ? esc(s.attacks.map(a => a.text).join(', ')) : '—'}</p>
    ${s.specialAttacks ? `<p><b>Special Attacks</b> ${esc(s.specialAttacks)}</p>` : ''}
    <h4>Statistics</h4>
    <p>${ABIL.map(ab).join(', ')}</p>
    <p><b>Base Atk</b> ${sign(s.bab)}; <b>CMB</b> ${sign(s.cmb)}; <b>CMD</b> ${s.cmd}</p>
    <p><b>Feats</b> ${esc([...(comp.feats || []).map(f => f.name), s.bonusFeats].filter(Boolean).join(', ') || '—')}</p>
    <p><b>Skills</b> ${esc(s.skills.map(x => `${x.name} ${sign(x.total)}`).join(', ') || '—')}</p>
    ${fam ? `<p><b>SQ</b> ${esc([...s.specials, s.qualities].filter(Boolean).join(', ').toLowerCase())}</p>` : s.kind === 'animal' ? `<p><b>SQ</b> ${esc([...s.specials.filter(x => !/evasion|devotion/i.test(x)), s.qualities].filter(Boolean).join(', ').toLowerCase())}</p>`
      : `<p><b>SQ</b> ${esc(s.specials.join(', ').toLowerCase())}</p>
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
