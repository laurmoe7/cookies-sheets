// Rolling from the sheet. Click a number to roll it; the result is shown on the sheet and, when a webhook is set in Options,
// posted to Discord in the layout of the Tad bot. The dice logic is in dice.js (pure, tested).
//   data-roll="init"              d20 + a derived value (any path in compute() output, e.g. saves.fort.total, skills.Stealth.total)
//   data-roll-label="Initiative"  shown in the message
//   data-roll-add="7" / data-roll-dice="1d6+2"   a literal d20 bonus or dice expression (companion cards)
//   data-roll-weapon="2" data-roll-kind="attack|damage|full"   a weapon row
// The roll bar (in the buff strip) holds Advantage / Disadvantage for the next d20 roll, the Modifier chip (situational + and -, such as
// not being proficient or shooting past a range increment), the dice box, and the Discord switch.
import { rollMessage, rollMany, bonusText, addMods, modsLabel, MOD_PRESETS, presetsFor } from './dice.js';
import { spellInfo } from './spellinfo.js';
import { state } from './app.js';
import { getPath, toast, esc, modal } from './ui.js';
import { options, setOption, showOptions } from './options.js';
import { api } from './api.js';
import { tipText } from './rolltip.js';
import { sign } from './calc.js';

const D20 = '<svg class="d20" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 2l3.5 8.5H8.5zM3.5 7l5 3.5M20.5 7l-5 3.5M8.5 10.5L12 22l3.5-11.5M3.5 17l5-6.5M20.5 17l-5-6.5"/></svg>';
let mode = ''; // '', 'adv' or 'dis': applies to the next d20 roll only

let mods = []; // situational modifiers added to d20 rolls: {label, n, group?}
let keepMods = false; // false: they apply to the next roll only, like Advantage

export const rollMode = () => mode;
export const rollMods = () => mods;

const discordLabel = () => {
  const o = options();
  return !o.webhook ? 'Set up Discord' : o.rollSend ? 'Sending to Discord' : 'Local only';
};

/** The roll bar, drawn into the sheet's buff strip. */
export function rollBar() {
  const o = options();
  return `<span class="roll-bar">
    <span class="roll-hint" title="Highlighted numbers are buttons: click one to roll it. Hover one to see where its bonuses come from." aria-label="Click a highlighted number to roll">${D20}</span>
    <button class="rchip ${mode === 'adv' ? 'on' : ''}" data-rmode="adv" title="Roll the next d20 twice and keep the higher">Advantage</button>
    <button class="rchip ${mode === 'dis' ? 'on' : ''}" data-rmode="dis" title="Roll the next d20 twice and keep the lower">Disadvantage</button>
    <button class="rchip ${mods.length ? 'on' : ''}" id="roll-mods" title="Add a situational modifier to your d20 rolls: not proficient, a range increment, flanking, or your own number">${esc(modsChip())}</button>
    <input id="dice-box" class="w8" placeholder="2d6+3" title="Dice box: Tad notation such as 2d6+3, adv d20+5 or 3xd20. Press Roll or Enter." autocomplete="off" aria-label="Dice box">
    <button class="rchip go" id="dice-go" title="Roll the dice box (or press Enter)">🎲 Roll</button>
    <button class="rchip ${o.webhook && o.rollSend ? 'on' : ''}" id="roll-discord" title="Post rolls to your Discord channel">${esc(discordLabel())}</button>
  </span>`;
}

const modsTotal = () => mods.reduce((t, m) => t + m.n, 0);
const modsChip = () => (mods.length ? 'Modifier ' + (bonusText(modsTotal()) || '+0') : 'Modifier');

function syncBar() {
  const mb = document.getElementById('roll-mods');
  if (mb) { mb.textContent = modsChip(); mb.classList.toggle('on', mods.length > 0); }
  document.querySelectorAll('[data-rmode]').forEach(b => b.classList.toggle('on', b.dataset.rmode === mode));
  const d = document.getElementById('roll-discord');
  if (d) { d.textContent = discordLabel(); d.classList.toggle('on', !!(options().webhook && options().rollSend)); }
}

const withMode = expr => { expr = addMods(expr, modsTotal()); return mode && /^d20/.test(expr) ? mode + ' ' + expr : expr; };
const withModLabel = (label, expr) => (mods.length && /^d20/.test(expr) ? [label, modsLabel(mods)].filter(Boolean).join(' ') : label);
const afterRoll = () => { mode = ''; if (!keepMods) mods = []; syncBar(); };

/** The Modifier window: preset situational modifiers (toggle them), your own number, and whether they stay after the next roll. */
function modsWindow() {
  modal('Roll modifier', (body, close) => {
    const draw = () => {
      body.innerHTML = `<p class="small muted">Added to your d20 rolls (attacks, saves, skills, checks) ${keepMods ? 'until you clear it' : 'for the next roll only'}.</p>
        <div class="roll-bar" style="margin:6px 0">${MOD_PRESETS.map((m, i) => `<button class="rchip ${mods.some(x => x.label === m.label) ? 'on' : ''}" data-mod-preset="${i}" title="${esc(m.tip || '')}">${esc(m.label)} ${esc(bonusText(m.n))}</button>`).join(' ')}</div>
        <div class="row" style="margin:10px 0"><input id="mod-n" class="w3" type="number" placeholder="±" aria-label="Modifier"><input id="mod-label" class="w12" placeholder="Reason (optional)" autocomplete="off" aria-label="Reason"><button class="btn small" id="mod-add">Add</button></div>
        <div class="small" style="margin:6px 0">${mods.length ? 'Now: ' + esc(mods.map(m => bonusText(m.n) + ' ' + m.label).join(', ')) + ' = <b>' + esc(bonusText(modsTotal()) || '+0') + '</b>' : '<span class="muted">No modifier set.</span>'}</div>
        <label class="small"><input type="checkbox" id="mod-keep" ${keepMods ? 'checked' : ''}> Keep it until I clear it</label>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn small" id="mod-clear">Clear</button><button class="btn primary small" id="mod-done">Done</button></div>`;
    };
    draw();
    const add = () => {
      const n = Math.trunc(Number(body.querySelector('#mod-n').value));
      if (!n) return;
      mods.push({ n, label: body.querySelector('#mod-label').value.trim() || 'modifier' });
    };
    body.onclick = e => {
      const p = e.target.closest('[data-mod-preset]');
      if (p) {
        const m = MOD_PRESETS[+p.dataset.modPreset], had = mods.some(x => x.label === m.label);
        mods = mods.filter(x => x.label !== m.label && !(m.group && x.group === m.group)); // one range increment at a time
        if (!had) mods.push({ ...m });
      } else if (e.target.closest('#mod-add')) add();
      else if (e.target.closest('#mod-clear')) mods = [];
      else if (e.target.closest('#mod-done')) { syncBar(); return close(); }
      else return;
      syncBar(); draw();
    };
    body.onchange = e => { if (e.target.id === 'mod-keep') keepMods = e.target.checked; };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('#mod-n,#mod-label')) { add(); syncBar(); draw(); } };
  });
}

function plan(el) {
  const d = state.derived, c = state.char;
  if (!d || !c) return null;
  const ds = el.dataset;
  if (ds.rollAdd !== undefined) return { expr: 'd20' + bonusText(ds.rollAdd), label: ds.rollLabel || '' };
  if (ds.rollDice !== undefined) return { expr: ds.rollDice, label: ds.rollLabel || '' };
  if (ds.rollWeapon !== undefined) {
    const i = +ds.rollWeapon, w = c.weapons[i], dw = d.weapons[i];
    if (!w || !dw) return null;
    const name = w.name || 'Weapon';
    if (ds.rollKind === 'damage') return { expr: String(dw.damageText).replace(/\s/g, ''), label: `${name} damage` };
    if (ds.rollKind === 'full') return { items: dw.attacks.map((n, k) => ({ expr: 'd20' + bonusText(n), label: `${name} attack ${k + 1}/${dw.attacks.length}` })) };
    return { expr: 'd20' + bonusText(dw.attack), label: `${name} attack` };
  }
  const v = getPath(d, ds.roll);
  if (typeof v !== 'number') return null;
  return { expr: 'd20' + bonusText(v), label: ds.rollLabel || '' };
}

/** The hover text for a roll button, built from the current numbers (so it is right after a buff or a misc bonus changes). */
function tipFor(el) {
  const d = state.derived, c = state.char;
  if (!d || !c) return '';
  const ds = el.dataset;
  if (ds.rollWeapon !== undefined) {
    const i = +ds.rollWeapon, w = c.weapons[i], dw = d.weapons[i];
    if (!w || !dw) return '';
    const name = w.name || 'Weapon';
    if (ds.rollKind === 'damage') return tipText(`${name} damage bonus`, dw.dmgBonus, d.bd?.[`weapons.${i}.damage`], `Click to roll ${dw.damageText}`);
    if (ds.rollKind === 'full') return `Full attack: ${dw.attacks.map(sign).join(' / ')}\nClick to roll every attack (each later attack is 5 lower)`;
    return tipText(`${name} attack`, dw.attack, d.bd?.[`weapons.${i}.attack`], `Click to roll d20${sign(dw.attack)}${dw.attacks.length > 1 ? ' (first attack)' : ''}`);
  }
  if (ds.roll !== undefined) {
    const v = getPath(d, ds.roll);
    if (typeof v !== 'number') return '';
    return tipText(ds.rollLabel || 'Roll', v, d.bd?.[ds.roll], `Click to roll d20${sign(v)}`);
  }
  return '';
}

export async function doRoll(p) {
  const who = state.char?.name || 'Someone';
  let r;
  try {
    r = p.items
      ? rollMany(who, p.items.map(it => ({ ...it, label: withModLabel(it.label, it.expr), expr: withMode(it.expr) })))
      : rollMessage(who, withMode(p.expr), { label: withModLabel(p.label, p.expr) });
  } catch (e) { return toast(e.message, 'err'); }
  afterRoll();
  toast(r.short);
  const o = options();
  if (!((p.send ?? o.rollSend) && o.webhook)) return;
  try { await api.discord(o.webhook, r.text, who); } catch (e) { toast('Discord: ' + e.message, 'err'); }
}

/** Is this roll an attack? Attack rolls get the attack modifiers (proficiency, range increments, flanking...) in the roll window. */
const isAttack = (p, el) => {
  const ds = el?.dataset || {};
  if (ds.rollWeapon !== undefined) return ds.rollKind !== 'damage';
  if (['melee', 'ranged', 'cmb'].includes(ds.roll)) return true;
  return /attack|touch/i.test(p.label || p.items?.[0]?.label || '');
};

/** Clicking a number opens the roll window (unless Options says not to, or Shift is held): edit the roll, then roll it here or send it to Discord. */
function askRoll(p, el, shift) {
  if (!options().rollAsk || shift || !(p.items || [p]).length) return doRoll(p);
  rollWindow(p, isAttack(p, el));
}

function rollWindow(p, attack) {
  const items = p.items || [p];
  const d20 = /^d20/.test(items[0].expr);
  const title = p.items ? items[0].label.replace(/ attack \d+\/\d+$/, '') + ' full attack' : (p.label || 'Roll');
  const snap = { mods: mods.map(m => ({ ...m })), mode };
  let went = false;
  modal(title, (body, close) => {
    const chips = list => list.map(m => '<button class="rchip ' + (mods.some(x => x.label === m.label) ? 'on' : '') + '" data-mod-preset="' + MOD_PRESETS.indexOf(m) + '" title="' + esc(m.tip || '') + '">' + esc(m.label) + ' ' + esc(bonusText(m.n)) + '</button>').join(' ');
    const draw = () => {
      const exprs = items.map(it => withMode(it.expr));
      const shown = exprs[0] + (exprs.length > 1 ? ' … and ' + (exprs.length - 1) + ' more' : '');
      const presets = d20 ? presetsFor(attack) : [];
      const sending = !!(options().webhook && options().rollSend);
      body.innerHTML = '<p class="rw-expr">Rolling <b>' + esc(shown) + '</b></p>' +
        (d20 ? '<div class="roll-bar" style="margin:8px 0"><button class="rchip ' + (mode === 'adv' ? 'on' : '') + '" data-win-mode="adv">Advantage</button><button class="rchip ' + (mode === 'dis' ? 'on' : '') + '" data-win-mode="dis">Disadvantage</button></div>' : '') +
        (presets.length ? '<div class="small muted">' + (attack ? 'Attack modifiers' : 'Modifiers') + '</div><div class="roll-bar" style="margin:4px 0 8px">' + chips(presets) + '</div>' : '') +
        (d20 ? '<p class="small muted" style="margin:0">Charging, fighting defensively, shaken, power attack and other conditions that last or change your AC are on the Buffs &amp; Conditions tab and apply by themselves.</p>' : '') +
        '<div class="row" style="margin:8px 0"><input id="mod-n" class="w3" type="number" placeholder="±" aria-label="Modifier"><input id="mod-label" class="w12" placeholder="Reason (optional)" autocomplete="off" aria-label="Reason"><button class="btn small" id="mod-add">Add</button></div>' +
        (d20 && mods.length ? '<div class="small" style="margin:4px 0">Now: ' + esc(mods.map(m => bonusText(m.n) + ' ' + m.label).join(', ')) + ' = <b>' + esc(bonusText(modsTotal()) || '+0') + '</b></div>' : '') +
        (d20 ? '<label class="small"><input type="checkbox" id="mod-keep" ' + (keepMods ? 'checked' : '') + '> Keep these modifiers for my next rolls</label>' : '') +
        '<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn small" id="win-cancel">Cancel</button>' +
        '<button class="rchip go" data-win-go="roll">🎲 Roll</button>' +
        '<button class="rchip dchip ' + (sending ? 'on' : '') + '" id="win-discord" title="Post this roll to your Discord channel, or keep it on the sheet">' + esc(discordLabel()) + '</button></div>';
      body.querySelector('[data-win-go]')?.focus();
    };
    draw();
    const add = () => {
      const n = Math.trunc(Number(body.querySelector('#mod-n').value));
      if (n) mods.push({ n, label: body.querySelector('#mod-label').value.trim() || 'modifier' });
    };
    body.onclick = e => {
      const pr = e.target.closest('[data-mod-preset]'), md = e.target.closest('[data-win-mode]'), go = e.target.closest('[data-win-go]');
      if (go) { went = true; close(); syncBar(); return doRoll(p); }
      if (e.target.closest('#win-discord')) {
        if (!options().webhook) return showOptions();
        setOption('rollSend', !options().rollSend);
        syncBar(); return draw();
      }
      if (e.target.closest('#win-cancel')) return close();
      if (pr) {
        const m = MOD_PRESETS[+pr.dataset.modPreset], had = mods.some(x => x.label === m.label);
        mods = mods.filter(x => x.label !== m.label && !(m.group && x.group === m.group));
        if (!had) mods.push({ ...m });
      } else if (md) mode = mode === md.dataset.winMode ? '' : md.dataset.winMode;
      else if (e.target.closest('#mod-add')) add();
      else return;
      syncBar(); draw();
    };
    body.onchange = e => { if (e.target.id === 'mod-keep') keepMods = e.target.checked; };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('#mod-n,#mod-label')) { e.preventDefault(); add(); syncBar(); draw(); } };
  }).then(() => { if (!went) { mods = snap.mods; mode = snap.mode; syncBar(); } });
}

export function initRoller() {
  // Sets the hover text just before the tooltip code reads it (capture phase, so this runs first).
  document.addEventListener('mouseover', e => {
    const el = e.target.closest?.('[data-roll],[data-roll-weapon]');
    if (el) el.dataset.tip = tipFor(el);
  }, true);
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-rmode]');
    if (m) { mode = mode === m.dataset.rmode ? '' : m.dataset.rmode; return syncBar(); }
    if (e.target.closest('#roll-mods')) return modsWindow();
    if (e.target.closest('#dice-go')) return rollDiceBox();
    if (e.target.closest('#roll-discord')) {
      if (!options().webhook) return showOptions();
      setOption('rollSend', !options().rollSend);
      return syncBar();
    }
    const sp = e.target.closest('[data-spell-roll]');
    if (sp) return spellWindow(sp);
    const el = e.target.closest('[data-roll],[data-roll-weapon],[data-roll-add],[data-roll-dice]');
    if (!el) return;
    e.preventDefault();
    const p = plan(el);
    if (p) askRoll(p, el, e.shiftKey);
  });
  // The dice box: Enter rolls it, like typing "roll ..." to Tad.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.id !== 'dice-box') return;
    e.preventDefault();
    rollDiceBox();
  });
}

function rollDiceBox() {
  const box = document.getElementById('dice-box');
  const v = box?.value.trim();
  if (!v) { box?.focus(); return toast('Type dice first, such as 2d6+3', 'err'); }
  doRoll({ expr: v, label: '' });
}

/**
 * Puts the Roll button on the spells that have something to roll (damage or healing dice, an attack roll, or spell resistance to beat).
 * Spells with none of those, like Mage Armor, get no button. Runs after the Spells tab is drawn; entries are cached, so redraws are instant.
 */
export function fillSpellRolls(root) {
  const d = state.derived;
  const slots = [...root.querySelectorAll('[data-spell-slot]')];
  if (!slots.length) return;
  // One request for every spell on the page (cached afterwards), not one each.
  api.entries(slots.map(s => +s.dataset.spellId)).then(list => {
    slots.forEach((slot, n) => {
      const dd = slot.closest('.sp-panel')?.querySelector('[data-fill-desc]'); // saves that did not keep the spell's summary get it from the compendium
      if (dd && list[n]?.summary) dd.textContent = list[n].summary;
      const sc = d?.spellcasting?.[slot.closest('[data-cls]')?.dataset.cls];
      if (!sc || !slot.isConnected) return;
      const i = spellInfo(list[n], sc.cl);
      if (!(i.kind || i.attack || i.sr)) return;
      slot.innerHTML = '<button class="btn small" data-spell-roll="' + slot.dataset.spellSlot + '" title="Roll an attack, the damage or healing, or a caster level check for this spell">Roll</button>';
    });
  }).catch(() => {});
}

/**
 * The roll window for one spell. It shows only what the spell has: an attack chip when it needs an attack roll, a caster level check when it
 * can be resisted, its saving throw with your DC, and a dice box guessed from the spell text (editable). Custom spells get the generic chips.
 */
async function spellWindow(btn) {
  const c = state.char, d = state.derived;
  const cls = btn.closest('[data-cls]')?.dataset.cls;
  const sp = c?.spellbooks?.[cls]?.spells?.[+btn.dataset.spellRoll], sc = d?.spellcasting?.[cls];
  if (!sp || !sc) return;
  const name = sp.name || 'Spell';
  let entry = null;
  if (sp.id) { try { entry = await api.entry(sp.id); } catch { /* the window still works without the entry */ } }
  else if (sp.notes) entry = { summary: sp.notes, html: '', meta: {} };
  const info = spellInfo(entry, sc.cl);
  const known = !!(entry && sp.id); // custom spells have no data, so offer every chip
  const dc = sc.dcs[sp.level];
  const chip = (label, n, kind) => `<button class="rchip" data-w-add="${n}" data-w-label="${esc(name + ' ' + kind)}" title="Roll d20 ${esc(kind)}">${esc(label)} ${esc(bonusText(n) || '+0')}</button>`;
  const chips = [
    ...(!known || info.attack === 'ranged' ? [chip('Ranged touch', d.ranged, 'ranged touch attack')] : []),
    ...(!known || info.attack === 'melee' ? [chip('Melee touch', d.melee, 'melee touch attack')] : []),
    chip('Concentration', sc.concentration, 'concentration check'),
    ...(!known || info.sr ? [chip('Caster level check', sc.cl, 'caster level check' + (info.sr ? ' to beat spell resistance' : ''))] : []),
  ];
  const facts = [`${cls} caster level ${sc.cl}`,
    info.save ? `${info.save.label}${dc != null && info.save.type ? `, DC ${dc}` : ''}` : known ? 'no saving throw' : (dc != null ? `save DC ${dc}` : ''),
    known ? (info.sr ? 'spell resistance applies' : 'ignores spell resistance') : ''].filter(Boolean);
  const what = info.kind === 'healing' ? 'healing' : info.kind === 'damage' ? 'damage' : '';
  modal(name + ': roll', (body, close) => {
    body.innerHTML = `<p class="small muted">${esc(facts.join(' · '))}.${info.dice ? ' The dice are a guess from the spell text; change them if the spell works differently (metamagic, a different cap).' : ''}</p>
      <div class="roll-bar" style="margin:8px 0">${chips.join(' ')}</div>
      <div class="row"><input id="spell-dice" class="w12" value="${esc(info.dice)}" placeholder="e.g. 5d6" autocomplete="off" aria-label="Spell dice">
        <button class="btn" id="spell-go">Roll ${esc(what || name)}</button></div>`;
    const go = () => { const v = body.querySelector('#spell-dice').value.trim(); if (v) doRoll({ expr: v, label: what ? `${name} ${what}` : name }); };
    body.onclick = e => {
      const a = e.target.closest('[data-w-add]');
      if (a) askRoll({ expr: 'd20' + bonusText(a.dataset.wAdd), label: a.dataset.wLabel }, null, e.shiftKey);
      else if (e.target.closest('#spell-go')) go();
    };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'spell-dice') go(); };
    setTimeout(() => body.querySelector('#spell-dice')?.focus(), 0);
  });
}
