// Rolling from the sheet. Click a number to roll it; the result is shown on the sheet. When a webhook is set in Options and
// sending is on, nothing is rolled here: the command ("roll d20+5") is posted under the character's name and the Tad bot rolls.
// The dice logic is in dice.js (pure, tested).
//   data-roll="init"              d20 + a derived value (any path in compute() output, e.g. saves.fort.total, skills.Stealth.total)
//   data-roll-label="Initiative"  shown in the message
//   data-roll-add="7" / data-roll-dice="1d6+2"   a literal d20 bonus or dice expression (companion cards)
//   data-roll-weapon="2" data-roll-kind="attack|damage|full"   a weapon row
// The roll bar (in the buff strip) holds Advantage / Disadvantage for the next d20 roll, the Modifier chip (situational + and -, such as
// not being proficient or shooting past a range increment), the dice box, and the Discord switch.
import { rollMessage, rollMany, bonusText, addMods, modsLabel, MOD_PRESETS, presetsFor, sendName, parseDice, damagePresets, parseDamageMod, addDamageMods, damageLabel } from './dice.js';
import { parseCrit } from './weaponfx.js';
import { spellInfo } from './spellinfo.js';
import { state, changed } from './app.js';
import { getPath, toast, esc, modal } from './ui.js';
import { options, setOption, showOptions } from './options.js';
import { api } from './api.js';
import { tipText } from './rolltip.js';
import { sign, num } from './calc.js';

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

/** The classes of the Discord switch, the same in the roll bar and in the roll window: blue while sending, plain "Local only" (red on hover) when off. */
const discordClass = () => {
  const o = options();
  return 'rchip dchip ' + (o.webhook && o.rollSend ? 'on' : o.webhook ? 'local' : '');
};

/** The roll bar, drawn into the sheet's buff strip. */
export function rollBar() {
  const o = options();
  return `<span class="roll-bar">
    <span class="roll-hint" title="Highlighted numbers are buttons: click one to roll it. Hover one to see where its bonuses come from." aria-label="Click a highlighted number to roll">${D20}</span>
    <button class="btn small ghost ${mods.length || mode ? 'on' : ''}" id="roll-mods" title="Add a situational modifier to your d20 rolls: not proficient, a range increment, flanking, or your own number">${esc(modsChip())}</button>
    <input id="dice-box" class="w8" placeholder="2d6+3" title="Dice box: Tad notation such as 2d6+3, adv d20+5 or 3xd20. Press Roll or Enter." autocomplete="off" aria-label="Dice box">
    <button class="rchip go" id="dice-go" title="Roll the dice box (or press Enter)">🎲 Roll</button>
    <button class="${discordClass()}" id="roll-discord" title="Post rolls to your Discord channel, or keep them on the sheet">${esc(discordLabel())}</button>
  </span>`;
}

const modsTotal = () => mods.reduce((t, m) => t + m.n, 0);
const modsChip = () => ['＋ Modifier', mods.length ? bonusText(modsTotal()) || '+0' : '', mode === 'adv' ? 'Adv' : mode === 'dis' ? 'Disadv' : ''].filter(Boolean).join(' ');

function syncBar() {
  const mb = document.getElementById('roll-mods');
  if (mb) { mb.textContent = modsChip(); mb.classList.toggle('on', mods.length > 0 || !!mode); }
  document.querySelectorAll('[data-rmode]').forEach(b => b.classList.toggle('on', b.dataset.rmode === mode));
  const d = document.getElementById('roll-discord');
  if (d) { d.textContent = discordLabel(); d.className = discordClass(); }
}

const withMode = expr => { expr = addMods(expr, modsTotal()); return mode && /^d20/.test(expr) ? mode + ' ' + expr : expr; };
const withModLabel = (label, expr) => (mods.length && /^d20/.test(expr) ? [label, modsLabel(mods)].filter(Boolean).join(' ') : label);
/** Preset chips in two rows: bonuses, then penalties. */
const presetGroups = list => [['Bonuses', 'plus', list.filter(m => m.n > 0)], ['Penalties', 'minus', list.filter(m => m.n < 0)]]
  .filter(([, , l]) => l.length)
  .map(([head, cls, l]) => '<div class="small mod-head ' + cls + '">' + head + '</div><div class="roll-bar" style="margin:4px 0 8px">' +
    l.map(m => '<button class="rchip ' + (mods.some(x => x.label === m.label) ? 'on' : '') + '" data-mod-preset="' + MOD_PRESETS.indexOf(m) + '" title="' + esc(m.tip || '') + '">' + esc(m.label) + ' ' + esc(bonusText(m.n)) + '</button>').join(' ') + '</div>').join('');

const afterRoll = () => { mode = ''; if (!keepMods) mods = []; syncBar(); };

/** The buffs and conditions that change this roll, by name, so it is clear what the number includes. {label, value, buff} parts come from calc.js. */
function buffNote(p) {
  const buffs = (p.parts || []).filter(x => x.buff && x.value);
  const ignored = (p.parts || []).filter(x => x.ignored);
  const any = (state.char?.modifiers || []).some(m => m.active);
  if (!buffs.length && !ignored.length) return any ? '<p class="small muted rw-buffs">No active buff or condition changes this roll.</p>' : '';
  return '<div class="rw-buffs"><span class="small">' + (buffs.length ? 'Active buffs in this roll:' : 'Active, but not counted:') + '</span> ' +
    buffs.map(b => '<span class="rw-buff ' + (b.value < 0 ? 'neg' : 'pos') + '">' + esc(b.label) + ' <b>' + esc(bonusText(b.value)) + '</b></span>').join(' ') +
    ignored.map(b => '<span class="rw-buff off" title="Bonuses of the same type do not add up: only the highest one counts">' + esc(b.label) + ' ' + esc(bonusText(b.was)) + ' <i>(does not stack)</i></span>').join(' ') + '</div>';
}

/** The Modifier window: preset situational modifiers (toggle them), your own number, and whether they stay after the next roll. */
function modsWindow() {
  modal('Roll modifier', (body, close) => {
    const draw = () => {
      body.innerHTML = `<p class="small muted">Added to your d20 rolls (attacks, saves, skills, checks) ${keepMods ? 'until you clear it' : 'for the next roll only'}.</p>
        <div class="roll-bar" style="margin:4px 0 8px">
          <button class="rchip ${mode === 'adv' ? 'on' : ''}" data-rmode="adv" title="Roll the next d20 twice and keep the higher">Advantage</button>
          <button class="rchip ${mode === 'dis' ? 'on' : ''}" data-rmode="dis" title="Roll the next d20 twice and keep the lower">Disadvantage</button></div>
        ${presetGroups(MOD_PRESETS)}
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
      const am = e.target.closest('[data-rmode]');
      if (am) mode = mode === am.dataset.rmode ? '' : am.dataset.rmode;
      else if (p) {
        const m = MOD_PRESETS[+p.dataset.modPreset], had = mods.some(x => x.label === m.label);
        mods = mods.filter(x => x.label !== m.label && !(m.group && x.group === m.group)); // one range increment at a time
        if (!had) mods.push({ ...m });
      } else if (e.target.closest('#mod-add')) add();
      else if (e.target.closest('#mod-clear')) { mods = []; mode = ''; }
      else if (e.target.closest('#mod-done')) { syncBar(); return close(); }
      else return;
      syncBar(); draw();
    };
    body.onchange = e => { if (e.target.id === 'mod-keep') keepMods = e.target.checked; };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('#mod-n,#mod-label')) { add(); syncBar(); draw(); } };
  });
}

/** " (threatens on 17-20)" for a weapon whose threat range is wider than a natural 20. */
const threat = dw => (dw.critMin < 20 ? ` (threatens on ${dw.critMin}-20)` : '');

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
    if (ds.rollKind === 'damage' || ds.rollKind === 'crit') {
      // the window can switch between a normal and a critical hit and add what only applies sometimes (sneak attack, smite...)
      const normal = { expr: String(dw.damageText).replace(/\s/g, ''), label: `${name} damage` };
      const crit = dw.critText ? { expr: String(dw.critText).replace(/\s/g, ''), label: `${name} critical damage (${dw.crit})`, mult: parseCrit(dw.crit)?.mult || 2 } : null;
      const first = ds.rollKind === 'crit' && crit ? crit : normal;
      return { ...first, parts: d.bd?.[`weapons.${i}.damage`], weaponDamage: { normal, crit, base: w.damage, startCrit: first === crit, presets: damagePresets(d.classLevels, d.bab) } };
    }
    if (ds.rollKind === 'full') return { items: dw.attacks.map((n, k) => ({ expr: 'd20' + bonusText(n), label: `${name} attack ${k + 1}/${dw.attacks.length}${threat(dw)}` })), parts: d.bd?.[`weapons.${i}.attack`] };
    return { expr: 'd20' + bonusText(dw.attack), label: `${name} attack${threat(dw)}`, parts: d.bd?.[`weapons.${i}.attack`] };
  }
  const v = getPath(d, ds.roll);
  if (typeof v !== 'number') return null;
  return { expr: 'd20' + bonusText(v), label: ds.rollLabel || '', parts: d.bd?.[ds.roll] };
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
    if (ds.rollKind === 'crit') return `Critical hit (${dw.crit}): ${dw.critText}\nEnchantment dice are not multiplied; bursts add their own.\nClick to roll it once a threat is confirmed`;
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

/** Rolls (here, or to Discord when that is on). Resolves true when the roll was made or sent, false when it failed. */
export async function doRoll(p) {
  const who = state.char?.name || 'Someone';
  const o = options();
  if ((p.send ?? o.rollSend) && o.webhook) {
    // Tad rolls: post only the command under the character's name and show nothing here, so the sheet and Discord never disagree.
    // The roll goes out under "Character · what it is for" (a webhook can change its display name per message), so the channel sees what was rolled.
    const sends = (p.items || [p]).map(it => ({ expr: withMode(it.expr), who: sendName(who, withModLabel(it.label, it.expr)) }));
    try { sends.forEach(x => parseDice(x.expr)); } catch (e) { toast(e.message, 'err'); return false; }
    afterRoll();
    try {
      for (const x of sends) await api.discord(o.webhook, 'roll ' + x.expr.trim(), x.who);
      toast('Sent to Discord');
      return true;
    } catch (e) { toast('Discord: ' + e.message, 'err'); return false; }
  }
  let r;
  try {
    r = p.items
      ? rollMany(who, p.items.map(it => ({ ...it, label: withModLabel(it.label, it.expr), expr: withMode(it.expr) })))
      : rollMessage(who, withMode(p.expr), { label: withModLabel(p.label, p.expr) });
  } catch (e) { toast(e.message, 'err'); return false; }
  afterRoll();
  toast(r.short);
  return true;
}

/** Is this roll an attack? Attack rolls get the attack modifiers (proficiency, range increments, flanking...) in the roll window. */
const isAttack = (p, el) => {
  const ds = el?.dataset || {};
  if (ds.rollWeapon !== undefined) return ds.rollKind !== 'damage' && ds.rollKind !== 'crit';
  if (['melee', 'ranged', 'cmb'].includes(ds.roll)) return true;
  return /attack|touch/i.test(p.label || p.items?.[0]?.label || '');
};

/** Clicking a number opens the roll window (unless Options says not to, or Shift is held): edit the roll, then roll it here or send it to Discord. */
function askRoll(p, el, shift) {
  if (!options().rollAsk || shift || !(p.items || [p]).length) return doRoll(p);
  rollWindow(p, isAttack(p, el));
}

/**
 * The roll window. For a spell, `sp` = {title, facts, start, dice, choices: [{label, p, attack, kind} | {label, dice: true, label2}]} adds a row
 * to pick what to roll (to hit, concentration, damage...) and filters the presets to the ones that apply to spells.
 */
function rollWindow(p0, attack0, sp = null) {
  let pick = sp ? sp.start : 0;
  let diceVal = sp?.dice || '';
  let castOn = !!sp?.cast?.on;
  const wd = !sp && p0.weaponDamage; // a weapon's damage roll: critical hit switch and the damage modifiers
  let dmods = [], useCrit = !!wd?.startCrit;
  const damageRoll = () => {
    const base = useCrit && wd.crit ? wd.crit : wd.normal, mult = useCrit && wd.crit ? wd.crit.mult : 1;
    return { ...p0, expr: addDamageMods(base.expr, dmods, wd.base, mult), label: base.label + (dmods.length ? ' ' + damageLabel(dmods, mult) : '') };
  };
  const sameMod = (x, m) => x.label === m.label && x.n === m.n && x.dice === m.dice && x.extraBase === m.extraBase;
  const damageBlock = () => {
    const chip = (m, i) => '<button class="rchip ' + (dmods.some(x => sameMod(x, m)) ? 'on' : '') + '" data-dmg-preset="' + i + '" title="' + esc(m.tip || '') + '">' + esc(m.label) + ' ' + esc(m.dice ? '+' + m.dice : m.extraBase ? '×' + (m.extraBase + 1) : bonusText(m.n)) + '</button>';
    return (wd.crit ? '<div class="small mod-head plus">Hit</div><div class="roll-bar" style="margin:4px 0 8px"><button class="rchip ' + (useCrit ? '' : 'on') + '" data-dmg-crit="0">Normal hit</button><button class="rchip ' + (useCrit ? 'on' : '') + '" data-dmg-crit="1" title="Rolls the multiplied damage; extra dice from enchantments are added once">Critical hit</button></div>' : '')
      + (wd.presets.length ? '<div class="small mod-head plus">Extra damage</div><div class="roll-bar" style="margin:4px 0 8px">' + wd.presets.map(chip).join(' ') + '</div>' : '')
      + (dmods.length ? '<div class="small" style="margin:4px 0">Now: ' + esc(dmods.map(m => (m.dice ? '+' + m.dice : m.extraBase ? 'weapon dice \u00d7' + (m.extraBase * (m.crit && useCrit && wd.crit ? wd.crit.mult : 1) + 1) : bonusText(m.n * (m.crit && useCrit && wd.crit ? wd.crit.mult : 1))) + ' ' + m.label).join(', ')) + (useCrit && wd.crit && dmods.some(m => m.crit) ? ' (multiplied by the critical hit)' : '') + '</div>' : '');
  };
  const cur = () => {
    if (wd) return { p: damageRoll(), attack: false };
    if (!sp) return { p: p0, attack: attack0 };
    const ch = sp.choices[pick];
    return ch.dice ? { p: { expr: diceVal.trim() || '0', label: ch.label2 }, attack: false, ch } : { p: ch.p, attack: ch.attack, ch };
  };
  const title = sp ? sp.title : p0.items ? p0.items[0].label.replace(/ attack \d+\/\d+$/, '') + ' full attack' : (p0.label || 'Roll');
  const snap = { mods: mods.map(m => ({ ...m })), mode };
  let went = false;
  modal(title, (body, close) => {
    const draw = () => {
      const { p, attack, ch } = cur();
      const items = p.items || [p];
      const d20 = /^d20/.test(items[0].expr);
      const exprs = items.map(it => withMode(it.expr));
      const shown = exprs[0] + (exprs.length > 1 ? ' … and ' + (exprs.length - 1) + ' more' : '');
      const presets = d20 ? presetsFor(attack, sp && { kind: ch.kind }) : [];
      const sending = !!(options().webhook && options().rollSend);
      body.innerHTML = (sp ? '<p class="small muted">' + esc(sp.facts) + '.</p><div style="margin:8px 0">' +
          ['Hit', 'Damage', 'Healing', 'Checks'].map(g => {
            const mine = sp.choices.map((c, i) => [c, i]).filter(([c]) => c.group === g);
            return mine.length ? '<div class="sp-group-row"><span class="sp-group-lab">' + g + '</span>' + mine.map(([c, i]) => '<button class="rchip ' + (i === pick ? 'on' : '') + '" data-sp-pick="' + i + '" title="' + esc(c.tip || '') + '">' + esc(c.label) + '</button>').join(' ') + '</div>' : '';
          }).join('') + '</div>' +
          (ch.dice ? '<div class="row" style="margin:8px 0"><input id="spell-dice" class="w12" value="' + esc(diceVal) + '" placeholder="e.g. 5d6" autocomplete="off" aria-label="Spell dice"></div>' : '') : '') +
        '<p class="rw-expr">Rolling <b>' + esc(shown) + '</b></p>' + buffNote(p) + (wd ? damageBlock() : '') +
        (d20 ? '<div class="roll-bar" style="margin:8px 0"><button class="rchip ' + (mode === 'adv' ? 'on' : '') + '" data-win-mode="adv">Advantage</button><button class="rchip ' + (mode === 'dis' ? 'on' : '') + '" data-win-mode="dis">Disadvantage</button></div>' : '') +
        (presets.length ? presetGroups(presets) : '') +
        (d20 ? '<p class="small muted" style="margin:0">Charging, fighting defensively, shaken, power attack and other conditions that last or change your AC are on the Buffs &amp; Conditions tab and apply by themselves.</p>' : '') +
        '<div class="row" style="margin:8px 0"><input id="mod-n" class="' + (wd ? 'w5' : 'w3') + '" type="' + (wd ? 'text' : 'number') + '" placeholder="' + (wd ? '2d6 or ±' : '±') + '" aria-label="Modifier" ' + (wd ? 'title="A number, or dice such as 2d6 for precision or other extra damage"' : '') + '><input id="mod-label" class="w12" placeholder="Reason (optional)" autocomplete="off" aria-label="Reason"><button class="btn small" id="mod-add">Add</button></div>' +
        (d20 && mods.length ? '<div class="small" style="margin:4px 0">Now: ' + esc(mods.map(m => bonusText(m.n) + ' ' + m.label).join(', ')) + ' = <b>' + esc(bonusText(modsTotal()) || '+0') + '</b></div>' : '') +
        (d20 ? '<label class="small"><input type="checkbox" id="mod-keep" ' + (keepMods ? 'checked' : '') + '> Keep these modifiers for my next rolls</label>' : '') +
        (sp?.cast ? '<label class="small" style="display:block;margin:6px 0" title="Rolling counts as casting the spell. Untick it if you already cast it or are only checking a number."><input type="checkbox" id="sp-cast" ' + (castOn ? 'checked' : '') + (sp.cast.left <= 0 ? ' disabled' : '') + '> ' + esc(sp.cast.label) + (sp.cast.left <= 0 ? ' (none left)' : sp.cast.recent ? ' (counted already for the roll you just made)' : sp.cast.left === Infinity ? '' : ' (' + sp.cast.left + ' left)') + '</label>' : '') +
        '<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn small" id="win-cancel">Cancel</button>' +
        '<button class="rchip go" data-win-go="roll">🎲 Roll</button>' +
        '<button class="' + discordClass() + '" id="win-discord" title="Post this roll to your Discord channel, or keep it on the sheet">' + esc(discordLabel()) + '</button></div>';
      if (ch?.dice) { const di = body.querySelector('#spell-dice'); di.focus(); di.setSelectionRange(di.value.length, di.value.length); }
      else body.querySelector('[data-win-go]')?.focus();
    };
    draw();
    const add = () => {
      if (wd) {
        const m = parseDamageMod(body.querySelector('#mod-n').value);
        if (m) dmods.push({ ...m, label: body.querySelector('#mod-label').value.trim() || 'extra' });
        return;
      }
      const n = Math.trunc(Number(body.querySelector('#mod-n').value));
      if (n) mods.push({ n, label: body.querySelector('#mod-label').value.trim() || 'modifier' });
    };
    const go = async () => {
      const { p, ch } = cur();
      if (ch?.dice && !diceVal.trim()) return toast('Type the dice first, such as 5d6', 'err');
      went = true; close(); syncBar();
      if (await doRoll(p) && sp?.cast && castOn && sp.cast.left > 0) sp.cast.spend(); // only a roll that was made or sent counts as casting
    };
    body.oninput = e => {
      if (e.target.id !== 'spell-dice') return;
      diceVal = e.target.value;
      const b = body.querySelector('.rw-expr b');
      if (b) b.textContent = diceVal.trim() || '0';
    };
    body.onclick = e => {
      const pr = e.target.closest('[data-mod-preset]'), md = e.target.closest('[data-win-mode]'), sk = e.target.closest('[data-sp-pick]');
      if (e.target.closest('[data-win-go]')) return go();
      if (sk) { pick = +sk.dataset.spPick; return draw(); }
      const dc = e.target.closest('[data-dmg-crit]'), dp = e.target.closest('[data-dmg-preset]');
      if (dc) { useCrit = dc.dataset.dmgCrit === '1'; return draw(); }
      if (dp) {
        const m = wd.presets[+dp.dataset.dmgPreset], had = dmods.some(x => x.label === m.label && x.n === m.n && x.dice === m.dice && x.extraBase === m.extraBase);
        dmods = dmods.filter(x => !(x.label === m.label && x.group === m.group) && !(m.group && x.group === m.group));
        if (!had) dmods.push({ ...m });
        return draw();
      }
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
    body.onchange = e => {
      if (e.target.id === 'mod-keep') keepMods = e.target.checked;
      else if (e.target.id === 'sp-cast') castOn = e.target.checked;
    };
    body.onkeydown = e => {
      if (e.key === 'Enter' && e.target.id === 'spell-dice') { e.preventDefault(); go(); }
      else if (e.key === 'Enter' && e.target.closest('#mod-n,#mod-label')) { e.preventDefault(); add(); syncBar(); draw(); }
    };
  }, { top: true }).then(() => { if (!went) { mods = snap.mods; mode = snap.mode; syncBar(); } });
}

export function initRoller() {
  // Sets the hover text just before the tooltip code reads it (capture phase, so this runs first).
  document.addEventListener('mouseover', e => {
    const el = e.target.closest?.('[data-roll],[data-roll-weapon]');
    if (el) el.dataset.tip = tipFor(el);
  }, true);
  document.addEventListener('click', e => {
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
/** The pseudo class that holds spell-like abilities on the Spells tab (the card and the roll buttons carry it as data-cls). */
export const SLA_KEY = 'Spell-like';

/** The caster numbers a spell is rolled with: a class's, or for a spell-like ability its own (caster level, DC, concentration). */
function casterOf(d, cls, i) {
  if (cls !== SLA_KEY) return d?.spellcasting?.[cls];
  const s = d?.spellLikes?.[i];
  return s && { cl: s.cl, dc: s.dc, dcs: { [s.level]: s.dc }, concentration: s.concentration, kind: 'spelllike', stat: s.stat };
}
const spellsOf = (c, cls) => (cls === SLA_KEY ? c?.spellLikes : c?.spellbooks?.[cls]?.spells);

export function fillSpellRolls(root) {
  const d = state.derived;
  const slots = [...root.querySelectorAll('[data-spell-slot]')];
  if (!slots.length) return;
  // One request for every spell on the page (cached afterwards), not one each.
  api.entries(slots.map(s => +s.dataset.spellId)).then(list => {
    slots.forEach((slot, n) => {
      const dd = slot.closest('.sp-panel')?.querySelector('[data-fill-desc]'); // saves that did not keep the spell's summary get it from the compendium
      if (dd && list[n]?.summary) dd.textContent = list[n].summary;
      const sc = casterOf(d, slot.closest('[data-cls]')?.dataset.cls, +slot.dataset.spellSlot);
      if (!sc || !slot.isConnected) return;
      const i = spellInfo(list[n], sc.cl);
      if (!(i.kind || i.attack || i.sr)) return;
      slot.innerHTML = '<button class="btn small" data-spell-roll="' + slot.dataset.spellSlot + '" title="Roll an attack, the damage or healing, or a caster level check for this spell">🎲 Roll</button>';
    });
  }).catch(() => {});
}

let lastSpellCast = { key: '', at: 0 }; // the spell a roll last counted as cast, so its damage roll right after does not use a second slot

/**
 * What rolling a spell uses up: a prepared copy for prepared casters, a slot for spontaneous and arcanist casters (cantrips use nothing).
 * {label, left, on, recent, spend()} for the roll window's "Cast it" box.
 */
function spellCast(cls, sp, sc, idx) {
  const c = state.char;
  if (cls === SLA_KEY) { // a spell-like ability: at will costs nothing, otherwise it uses one of the day's uses
    const x = state.derived?.spellLikes?.[idx];
    if (!x || x.unlimited) return null;
    const key = cls + ':' + (sp.id || sp.name), recent = lastSpellCast.key === key && Date.now() - lastSpellCast.at < 90000;
    return {
      label: 'Cast it: use one of today’s uses', left: x.left, recent, on: x.left > 0 && !recent,
      spend() {
        sp.used = num(sp.used) + 1;
        lastSpellCast = { key, at: Date.now() };
        changed({ rerender: true });
        document.dispatchEvent(new Event('spell-changed'));
        toast(`${sp.name || 'Ability'} used. ${x.left - 1} left`);
      },
    };
  }
  const book = c.spellbooks[cls], l = Number(sp.level) || 0;
  if (!book || l < 1) return null;
  const pre = sc.kind === 'prepared';
  const ord = ['0th', '1st', '2nd', '3rd'][l] || l + 'th';
  const left = pre ? num(sp.prepared) : sc.slots[l] == null ? 0 : sc.slots[l] === Infinity ? Infinity : Math.max(0, sc.slots[l] - num((book.used || [])[l]));
  const key = cls + ':' + (sp.id || sp.name) + ':' + l;
  const recent = lastSpellCast.key === key && Date.now() - lastSpellCast.at < 90000;
  return {
    label: pre ? 'Cast it: use up a prepared copy' : `Cast it: use a ${ord}-level slot`, left, recent, on: left > 0 && !recent,
    spend() {
      if (pre) { sp.prepared = Math.max(0, num(sp.prepared) - 1); sp.cast = num(sp.cast) + 1; }
      else { book.used ||= []; book.used[l] = num(book.used[l]) + 1; }
      lastSpellCast = { key, at: Date.now() };
      changed({ rerender: true });
      document.dispatchEvent(new Event('spell-changed')); // the side panel redraws its counts
      toast(`${sp.name || 'Spell'} cast` + (left === Infinity ? '' : `. ${left - 1} left`));
    },
  };
}

/**
 * The roll window for one spell. It shows only what the spell has: an attack chip when it needs an attack roll, a caster level check when it
 * can be resisted, its saving throw with your DC, and a dice box guessed from the spell text (editable). Custom spells get the generic chips.
 */
async function spellWindow(btn) {
  const c = state.char, d = state.derived;
  const cls = btn.closest('[data-cls]')?.dataset.cls;
  const idx = +btn.dataset.spellRoll, sla = cls === SLA_KEY;
  const sp = spellsOf(c, cls)?.[idx], sc = casterOf(d, cls, idx);
  if (!sp || !sc) return;
  const path = sla ? `spellLikes.${idx}` : `spellcasting.${cls}`; // where the breakdown of this caster's numbers is kept
  const name = sp.name || 'Spell';
  let entry = null;
  if (sp.id) { try { entry = await api.entry(sp.id); } catch { /* the window still works without the entry */ } }
  else if (sp.notes) entry = { summary: sp.notes, html: '', meta: {} };
  const info = spellInfo(entry, sc.cl);
  const known = !!(entry && sp.id); // custom spells have no data, so offer every chip
  const dc = sla ? sc.dc : sc.dcs[sp.level]; // a spell-like ability's own level can be blank or odd; its DC was worked out from the clamped one
  const chip = (label, n, kind, path) => ({ label: label + ' ' + (bonusText(n) || '+0'), n, tip: 'Roll d20 ' + kind, name: name + ' ' + kind, parts: d.bd?.[path] });
  const chips = [
    ...(!known || info.attack === 'ranged' ? [chip('To hit: ranged ' + (info.touch === false ? 'attack' : 'touch'), d.ranged, 'ranged ' + (info.touch === false ? 'attack' : 'touch attack'), 'ranged')] : []),
    ...(!known || info.attack === 'melee' ? [chip('To hit: melee ' + (info.touch === false ? 'attack' : 'touch'), d.melee, 'melee ' + (info.touch === false ? 'attack' : 'touch attack'), 'melee')] : []),
    chip('Concentration', sc.concentration, 'concentration check', `${path}.concentration`),
    chip('Cast defensively (DC ' + (15 + 2 * (Number(sp.level) || 0)) + ')', sc.concentration, 'cast defensively, DC ' + (15 + 2 * (Number(sp.level) || 0)), `${path}.concentration`),
    ...(!known || info.sr ? [chip('Caster level check', sc.cl, 'caster level check' + (info.sr ? ' to beat spell resistance' : ''), `${path}.cl`)] : []),
  ];
  const facts = [sla ? `Spell-like ability, caster level ${sc.cl}` : `${cls} caster level ${sc.cl}`,
    info.save ? `${info.save.label}${dc != null && info.save.type ? `, DC ${dc}` : ''}` : known ? 'no saving throw' : (dc != null ? `save DC ${dc}` : ''),
    known ? (info.sr ? 'spell resistance applies' : 'ignores spell resistance') : ''].filter(Boolean);
  const what = info.kind === 'healing' ? 'healing' : info.kind === 'damage' ? 'damage' : '';
  const kindOf = t => (t.includes('ranged') ? 'ranged' : t.includes('melee') ? 'melee' : null);
  const choices = [
    ...chips.map(ch => ({ group: /touch attack|ranged attack|melee attack/.test(ch.tip) ? 'Hit' : 'Checks', label: ch.label, tip: ch.tip, kind: kindOf(ch.tip), attack: /touch attack|ranged attack|melee attack/.test(ch.tip),
      p: { expr: 'd20' + bonusText(ch.n), label: ch.name, parts: ch.parts } })),
    { group: what === 'healing' ? 'Healing' : 'Damage', label: what ? (what === 'healing' ? 'Healing' : 'Damage') + (info.dice ? ' ' + info.dice : '') : 'Roll dice', dice: true, label2: what ? `${name} ${what}` : name, tip: 'Roll the dice of the spell (edit them first if the guess is wrong)' },
  ];
  const first = choices.findIndex(ch => ch.attack);
  rollWindow(null, false, { title: name, facts: facts.join(' · '), choices, cast: spellCast(cls, sp, sc, idx), dice: info.dice, start: first >= 0 && known ? first : (info.dice ? choices.length - 1 : 0) });
}
