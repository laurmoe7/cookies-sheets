// Summons: the chooser (pick a Summon Monster / Summon Nature's Ally creature) and the Summons section of the
// Companions tab, where each summoned creature is tracked with its key stats, hit points and rounds left.
import { api } from '../api.js';
import { state, changed } from '../app.js';
import { esc, $, $$, modal, toast, showCustom, confirmBox, textField, getPath } from '../ui.js';
import { picAction, picFrame } from '../cropper.js';
import { hpSegments, segsHtml } from '../bars.js';
import { hpFx } from '../healfx.js';
import { playSfx } from '../sfx.js';
import { event as petEvent } from '../pet/pet.js';
import { summonSpell, summonChoices, statBlockHtml, newSummon, templateNotes } from '../summons.js';

let dataPromise = null;
const loadData = () => (dataPromise ||= api.summons().catch(e => { dataPromise = null; throw e; }));
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const FAMILIES = ['Summon Monster', "Summon Nature's Ally"];

/** Caster level to default a summon's duration to: the given class's, else your best casting class. */
function casterLevel(cls) {
  const sc = state.derived?.spellcasting || {};
  if (cls && sc[cls]) return sc[cls].cl;
  return Math.max(1, ...Object.values(sc).map(x => x.cl || 0));
}

/** The chooser. Clicking a creature adds it to Companions → Summons and keeps the window open. */
export async function chooseSummon({ spell = 'Summon Monster I', cls = '' } = {}) {
  let data;
  try { data = await loadData(); } catch (e) { toast('Could not load summon lists: ' + e.message, 'err'); return; }
  const c = state.char;
  const start = summonSpell(spell) || { family: 'Summon Monster', level: 1 };
  let { family, level } = start;
  let rounds = casterLevel(cls);
  let preview = null;
  const added = {};
  await modal('Summon a creature', (body, close) => {
    const draw = () => {
      const groups = summonChoices(data, family, level);
      body.innerHTML = `<div class="row summon-top">
          <label>Spell <select data-f="family">${FAMILIES.map(f => `<option ${f === family ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
            <select data-f="level">${ROMAN.slice(1).map((r, i) => `<option value="${i + 1}" ${i + 1 === level ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label>Lasts <input type="number" class="num w3" data-f="rounds" value="${rounds}" min="1"> rounds</label>
          <span class="grow"></span><button class="btn primary" data-done>Done</button></div>
        <p class="small muted">Click a creature to add it to <b>Companions → Summons</b>. ${family === 'Summon Monster' ? 'A * means it takes the celestial or fiendish template. ' : ''}Press “Stats” to read a stat block first.
          ${Object.keys(added).length ? `<br>Added: <b>${Object.entries(added).map(([n, k]) => `${esc(n)}${k > 1 ? ' ×' + k : ''}`).join(', ')}</b>` : ''}</p>
        <div class="summon-pane"><div class="summon-lists">${groups.map(g => `<h4>${ORD[g.level]}-level list <span class="muted small">· summons ${g.count}</span></h4>
          <ul class="summon-list">${g.entries.map(e => `<li><button class="btn small summon-pick" data-pick="${esc(e.creature)}" data-label="${esc(e.name)}" data-tpl="${e.template ? 1 : 0}" title="Add to Companions → Summons">${esc(e.name)}${e.template ? '*' : ''}</button>
            <button class="btn small ghost summon-stats" data-stats="${esc(e.creature)}" data-label="${esc(e.name)}" data-tpl="${e.template ? 1 : 0}" title="Read the stat block">Stats</button>
            ${e.subtype ? `<span class="muted small">${esc(e.subtype)}</span>` : ''}</li>`).join('')}</ul>`).join('')}</div>
          <div class="summon-preview">${preview ? `<h3>${esc(preview.label)}</h3>${statBlockHtml(data.creatures[preview.key], { template: preview.tpl })}` : '<p class="muted">Press “Stats” beside a creature to read it here.</p>'}</div></div>`;
    };
    body.onchange = e => {
      const f = e.target.dataset.f;
      if (f === 'family') family = e.target.value;
      else if (f === 'level') level = +e.target.value;
      else if (f === 'rounds') { rounds = Math.max(1, +e.target.value || 1); return; }
      draw();
    };
    body.onclick = e => {
      if (e.target.closest('[data-done]')) return close();
      const pick = e.target.closest('[data-pick]');
      const st = e.target.closest('[data-stats]');
      if (pick || st) e.preventDefault();
      if (pick) {
        const entry = pick.dataset;
        const label = entry.label.replace(/\s*\(.*\)$/, '');
        c.summons ||= [];
        const n = c.summons.filter(s => s.key === entry.pick).length;
        c.summons.push(newSummon({ key: entry.pick, label: n ? `${label} #${n + 1}` : label, spell: `${family} ${ROMAN[level]}`, tpl: entry.tpl === '1', block: data.creatures[entry.pick], rounds }));
        added[label] = (added[label] || 0) + 1;
        changed();
        toast(`${label} added to Companions → Summons`);
        draw();
      } else if (st) {
        preview = { key: st.dataset.stats, label: st.dataset.label, tpl: st.dataset.tpl === '1' };
        draw();
      }
    };
    draw();
  }, { wide: true });
  if (Object.keys(added).length) changed({ rerender: true });
}

const tf = (path, opts) => textField(path, getPath(state.char, path), opts);

/** The Summons section at the top of the Companions tab. */
/** A hit point reaction waiting for the next draw: {id, kind, amount, frac, from}. */
let sumFx = null;

export function renderSummons(el, c) {
  c.summons ||= [];
  const list = c.summons;
  el.innerHTML = `<div class="row"><h3 class="grow" style="margin:0">Summons</h3>
      <span class="muted small">${list.length ? `${list.length} active` : ''}</span>
      <button class="btn small" data-sm-new>＋ Summon…</button>
      ${list.length ? '<button class="btn small" data-sm-round title="Take one round off every summon">Next round</button><button class="btn small ghost" data-sm-clear>Dismiss all</button>' : ''}</div>
    ${list.length ? `<div class="summon-cards">${list.map((s, i) => summonCard(s, i)).join('')}</div>`
      : '<p class="muted">No summons right now. Use “Summon…” here, or the button beside a Summon Monster / Summon Nature’s Ally spell on the Spells tab.</p>'}`;
  if (sumFx) {
    const fx = sumFx;
    sumFx = null;
    const card = el.querySelector(`[data-sm="${list.findIndex(x => x.id === fx.id)}"]`);
    if (card) hpFx(card, fx);
  }
  el.onclick = async e => {
    const t = e.target.closest('[data-pic],[data-pic-edit],[data-pic-clear],[data-sm-new],[data-sm-round],[data-sm-clear],[data-sm-dismiss],[data-sm-stats],[data-sm-dmg],[data-sm-heal],[data-sm-r]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.smNew !== undefined) return chooseSummon();
    if (t.dataset.smRound !== undefined) {
      const done = [];
      for (const s of list) { if (s.rounds > 0) { s.rounds--; if (s.rounds === 0) done.push(s.name); } }
      if (done.length) toast(`${done.join(', ')} ${done.length > 1 ? 'have' : 'has'} run out of time`);
      return changed({ rerender: true });
    }
    if (t.dataset.smClear !== undefined) {
      if (await confirmBox(`Dismiss all ${list.length} summons?`, 'Dismiss all')) { c.summons = []; changed({ rerender: true }); }
      return;
    }
    const i = +t.closest('[data-sm]').dataset.sm;
    const s = list[i];
    if (t.dataset.pic !== undefined || t.dataset.picEdit !== undefined || t.dataset.picClear !== undefined) {
      if (await picAction(t, s, { w: 1, h: 1, out: 320 })) changed({ rerender: true });
    }
    else if (t.dataset.smDismiss !== undefined) { list.splice(i, 1); changed({ rerender: true }); }
    else if (t.dataset.smStats !== undefined) {
      let data;
      try { data = await loadData(); } catch (err) { toast('Could not load stat blocks: ' + err.message, 'err'); return; }
      const b = data.creatures[s.key];
      if (b) showCustom({ name: s.name, cat: 'Summoned creature', sub: s.spell, html: statBlockHtml(b, { template: s.tpl, links: true }) });
    } else if (t.dataset.smDmg !== undefined || t.dataset.smHeal !== undefined) {
      const amt = Math.abs(+$('[data-sm-amt]', t.closest('[data-sm]')).value || 0);
      if (!amt) return;
      const before = s.hp;
      s.hp = t.dataset.smDmg !== undefined ? s.hp - amt : Math.min(s.hpMax, s.hp + amt);
      if (s.hp !== before) {
        sumFx = { id: s.id, kind: s.hp < before ? 'hurt' : 'heal', amount: Math.abs(s.hp - before), frac: Math.abs(s.hp - before) / Math.max(1, s.hpMax), from: before / Math.max(1, s.hpMax) };
        playSfx(s.hp < before ? 'hit' : 'heal');
      }
      const delta = s.hp - before, big = Math.max(8, 0.4 * s.hpMax);
      if (delta <= -big && s.hp > 0) petEvent('summon-hurt-big', { summon: s.name, n: -delta });
      else if (delta >= big) petEvent('summon-heal-big', { summon: s.name, n: delta });
      changed({ rerender: true });
    } else if (t.dataset.smR !== undefined) {
      s.rounds = Math.max(0, s.rounds + +t.dataset.smR);
      changed({ rerender: true });
    }
  };
}

function summonCard(s, i) {
  const pct = Math.max(0, Math.min(100, (s.hp / Math.max(1, s.hpMax)) * 100));
  const expired = s.rounds <= 0;
  // Down at 0 hp or less; dead once hp reaches the negative of its Con score (no Con score: destroyed at 0).
  const deadAt = -(s.con || 0);
  const dead = s.hp <= deadAt;
  const downed = s.hp <= 0 && !dead;
  const note = s.template ? templateNotes(s.hd || 1)[s.template] : '';
  return `<div class="summon-card ${expired ? 'expired' : ''} ${dead ? 'dead' : downed ? 'downed' : ''}" data-sm="${i}">
    <div class="row" style="margin:0">${picFrame(s.image, 'sm', 'Add a picture of this creature')}<b class="grow">${tf(`summons.${i}.name`, { placeholder: 'Name' })}</b>
      <span class="pill">${esc(s.spell)}</span><button class="icon-btn" data-sm-dismiss title="Dismiss">✕</button></div>
    <div class="sm-stats small">
      <div><b>AC</b> ${esc(s.ac || '—')}</div>
      <div><b>Saves</b> ${esc(s.saves || '—')}</div>
      <div><b>Speed</b> ${esc(s.speed || '—')}</div>
      <div><b>Melee</b> ${esc(s.melee || '—')}</div>
      ${s.special ? `<div><b>SQ</b> ${esc(s.special)}</div>` : ''}
    </div>
    ${dead ? '<div class="small bad down-note"><b>Dead</b> (or destroyed)</div>'
      : downed ? `<div class="small warn down-note"><b>Down</b>: dead at ${s.con ? '−' + s.con : '0'} hp, ${s.hp - deadAt} more damage</div>` : ''}
    <div class="hp-bar"><div class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></div>${segsHtml(hpSegments(s.hpMax))}</div>
    <div class="row sm-controls">
      <b>${s.hp} / ${s.hpMax} hp</b>
      <input type="number" class="num w3" data-sm-amt placeholder="0" min="0">
      <button class="btn small danger" data-sm-dmg>Damage</button><button class="btn small good" data-sm-heal>Heal</button>
      <span class="grow"></span>
      <span class="rounds-group"><span class="small ${expired ? 'bad' : ''}">${expired ? 'Time is up' : `${s.rounds} round${s.rounds === 1 ? '' : 's'} left`}</span>
      <span class="stepper"><button data-sm-r="-1" title="One round less" aria-label="One round less">−</button><button data-sm-r="1" title="One round more" aria-label="One round more">＋</button></span></span>
      <button class="btn sm-stats-btn" data-sm-stats>Stats</button></div>
    ${s.tpl ? `<div class="small"><label>Template <select data-bind="summons.${i}.template" data-rerender><option value="" ${!s.template ? 'selected' : ''}>none</option>
        <option value="celestial" ${s.template === 'celestial' ? 'selected' : ''}>celestial</option><option value="fiendish" ${s.template === 'fiendish' ? 'selected' : ''}>fiendish</option></select></label>
      ${note ? `<span class="muted"> ${esc(note)}</span>` : ''}</div>` : ''}
    <div class="small">${tf(`summons.${i}.notes`, { multiline: true, placeholder: 'Notes (double-click)' })}</div>
  </div>`;
}

/** Spells tab: the "Summon…" buttons. */
export function initSummons() {
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-summon]');
    if (!open) return;
    e.preventDefault();
    chooseSummon({ spell: open.dataset.summon, cls: open.dataset.summonCls || '' });
  });
}
