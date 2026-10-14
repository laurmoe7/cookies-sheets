// Reads the popular "Pathfinder character sheet" Google Sheets template (by Hagal Rovas) from its CSV export and turns it into the
// charactersheet.co.uk shape, so importcs.js can build the character, match the compendium and run the numbers check.
// The template is a fixed grid: every value sits in the same column, and a value usually sits two rows above its label.
// Pure functions, no DOM and no network (the server downloads the CSV).

export const GS_SOURCE = 'Google Sheets';

const str = v => (v === null || v === undefined ? '' : String(v).replace(/�/g, '’').trim());
const toNum = v => { const m = str(v).match(/^([+-]?\s*\d+)$/); return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null; };

/** A pasted Google Sheets address (or a bare id) -> {id, gid}, or null. */
export function parseSheetRef(text) {
  const t = str(text);
  const m = t.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) || t.match(/^([A-Za-z0-9_-]{30,})$/);
  if (!m) return null;
  const g = t.match(/[#?&]gid=(\d+)/);
  return { id: m[1], gid: g ? g[1] : '0' };
}

/** CSV text -> rows of cells. Handles quotes, doubled quotes and line breaks inside a cell. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const SIZE_LETTERS = { F: 'Fine', D: 'Diminutive', T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal' };
const TYPO = { apraise: 'Appraise', profesion: 'Profession', 'sleight of hand': 'Sleight of Hand' };
const MULTI = ['Craft', 'Perform', 'Profession'];
const CLASS_SKILL_BONUS = 3;

/** True when the grid looks like that template (its section labels are where they should be). */
export function isGoogleSheetCharacter(rows) {
  const has = (r, c, t) => rows.some(row => str(row?.[c]).toLowerCase() === t);
  return has(0, 30, 'character name') && has(0, 1, 'ability name') && has(0, 45, 'skill name');
}

/** Rows of cells -> a charactersheet.co.uk style character. Anything not found is left out, never guessed. */
export function googleSheetToCs(rows) {
  const g = rows.map(r => (r || []).map(str));
  const cell = (r, c) => g[r]?.[c] || '';
  const SKIP = new Set(['', '+', '=']);
  // A value sits in its label's column, or one or two cells to the right when the label is a merged cell.
  const val = (r, c) => { for (let k = 0; k < 3; k++) { const v = cell(r, c + k); if (!SKIP.has(v)) return v; } return ''; };
  const rowOf = (c, text, from = 0, to = g.length) => { for (let r = from; r < to; r++) if (cell(r, c).toLowerCase() === text.toLowerCase()) return r; return -1; };
  const anyCol = (text, from = 0) => { for (let r = from; r < g.length; r++) { const c = g[r].findIndex(x => x.toLowerCase() === text.toLowerCase()); if (c >= 0) return [r, c]; } return null; };
  /** The value written above a label (two rows up, or one). */
  const above = text => { const p = anyCol(text); return p ? cell(p[0] - 2, p[1]) || cell(p[0] - 1, p[1]) : ''; };
  const after = (r, c) => { for (let k = c + 1; k < (g[r] || []).length; k++) if (toNum(cell(r, k)) !== null) return cell(r, k); return ''; };
  const out = { _source: GS_SOURCE };

  // -- who --
  out.name = above('Character Name');
  out.level = above('Character Level');
  out.alignment = above('Alignment');
  for (const [k, label] of [['deity', 'Deity'], ['homeland', 'Homeland'], ['race', 'Race'], ['gender', 'Gender'], ['age', 'Age'], ['height', 'Height'], ['weight', 'Weight'], ['hair', 'Hair'], ['eyes', 'Eyes']]) out[k] = above(label);
  const size = above('Size');
  out.size = SIZE_LETTERS[size.toUpperCase()] || size;

  // -- abilities --
  const head = rowOf(1, 'Ability Name');
  out.abilities = {};
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    for (let r = Math.max(head, 0); r < g.length; r++) {
      if (cell(r, 1) === a.toUpperCase() && toNum(cell(r, 7)) !== null) {
        out.abilities[a] = cell(r, 7);
        const t = toNum(cell(r, 15));
        if (t !== null) out.abilities['temp' + a[0].toUpperCase() + a.slice(1)] = String(t);
        break;
      }
    }
  }

  // -- hit points and speed --
  const hpRow = rowOf(23, 'HP');
  out.hp = { total: hpRow >= 0 ? after(hpRow, 23) : '' };
  const wounds = anyCol('Wounds/Current HP');
  const cur = wounds && (cell(wounds[0] + 2, wounds[1]) || cell(wounds[0] + 1, wounds[1])).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (cur) { out.hp.total = out.hp.total || cur[2]; out.hp.wounds = String(Math.max(0, +cur[2] - +cur[1])); }
  const spRow = rowOf(43, 'Speed');
  out.speed = { base: spRow >= 0 ? val(spRow, 49) : '', withArmor: spRow >= 0 ? val(spRow, 60) : '' };

  // -- armor class: the labels sit under the sums --
  const acLabels = rowOf(15, 'Armor Bonus');
  const v = acLabels - 2;
  out.ac = acLabels < 0 ? {} : {
    total: val(v, 7), armorBonus: val(v, 15), shieldBonus: val(v, 19), naturalArmor: val(v, 31), deflectionModifier: val(v, 34), miscModifier: val(v, 39),
  };
  const touch = rowOf(1, 'TOUCH');
  if (touch >= 0) { out.ac.touch = val(touch, 7); const ff = g[touch].findIndex(x => x.toUpperCase() === 'FLAT-FOOTED'); if (ff >= 0) out.ac.flatFooted = after(touch, ff); }
  const itemsHead = g.findIndex(r => r[18]?.toLowerCase() === 'bonus' && r[22]?.toLowerCase() === 'type');
  const itemsEnd = rowOf(1, 'TOTALS', Math.max(itemsHead, 0));
  out.ac.items = [];
  if (itemsHead >= 0) {
    for (let r = itemsHead + 1; r < (itemsEnd < 0 ? g.length : itemsEnd); r++) {
      if (!cell(r, 1)) continue;
      out.ac.items.push({ name: cell(r, 1), bonus: val(r, 18), type: val(r, 22), armorCheckPenalty: val(r, 27), spellFailure: val(r, 35), weight: val(r, 41), properties: val(r, 45) });
    }
  }

  // -- saves, initiative, attack numbers --
  out.saves = {};
  for (const [key, label] of [['fort', 'FORTITUDE'], ['reflex', 'REFLEX'], ['will', 'WILL']]) {
    const r = rowOf(1, label);
    if (r >= 0) out.saves[key] = { total: val(r, 13), magicModifier: val(r, 25), miscModifier: val(r, 29), tempModifier: val(r, 33) };
  }
  const ini = rowOf(23, 'INITIATIVE');
  out.initiative = ini >= 0 ? { total: val(ini, 31), miscModifier: val(ini, 39) } : {};
  const bab = rowOf(1, 'Base Attack Bonus');
  out.bab = bab >= 0 ? after(bab, 1) : '';
  const cmb = rowOf(1, 'CMB'), cmd = rowOf(1, 'CMD');
  out.cmb = { total: cmb >= 0 ? val(cmb, 14) : '' };
  out.cmd = { total: cmd >= 0 ? val(cmd, 14) : '' };
  out.damageReduction = ''; out.spellResistance = '';

  // -- skills: x = class skill, name, total, ability, modifier, ranks, misc --
  out.skills = {};
  const sk0 = rowOf(45, 'Skill Name'), sk1 = rowOf(45, 'Class Skill', Math.max(sk0, 0));
  const seen = {};
  for (let r = sk0 + 1; sk0 >= 0 && r < (sk1 < 0 ? g.length : sk1); r++) {
    let name = cell(r, 45).replace(/\*/g, '').trim();
    if (!name) continue;
    name = TYPO[name.toLowerCase()] || name;
    const sub = (cell(r, 48) || cell(r, 51)).replace(/[()*]/g, '').trim();
    const total = toNum(val(r, 59)), ranks = toNum(val(r, 70)) ?? 0;
    const classSkill = cell(r, 43).toLowerCase() === 'x';
    // Their misc box holds the +3 class skill bonus on ranked class skills; this app adds that itself, so take it back out.
    const typed = toNum(val(r, 74)) ?? 0;
    const misc = classSkill && ranks > 0 && typed >= CLASS_SKILL_BONUS ? typed - CLASS_SKILL_BONUS : typed;
    if (MULTI.includes(name) && !sub && !ranks && !misc) continue; // the template's empty Perform and Profession rows
    let key;
    if (name === 'Knowledge') { if (!sub) continue; key = 'knowledge' + sub.replace(/\s+/g, '').replace(/^./, ch => ch.toUpperCase()); }
    else if (MULTI.includes(name)) { seen[name] = (seen[name] || 0) + 1; key = name.toLowerCase() + seen[name]; }
    else { const w = name.split(/\s+/); key = w[0].toLowerCase() + w.slice(1).map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(''); }
    out.skills[key] = { ranks, misc, racial: 0, classSkill, total: total === null ? '' : String(total), ...(MULTI.includes(name) ? { name: sub } : {}) };
  }
  const cm = rowOf(43, 'Conditional Modifiers:'), lang = rowOf(43, 'Languages:');
  if (cm >= 0) out.skills.conditionalModifiers = g.slice(cm + 1, lang > cm ? lang : cm + 6).map(r => r[43]).filter(Boolean).join('\n');
  if (lang >= 0) out.languages = g.slice(lang + 1, lang + 4).map(r => r[43]).find(Boolean) || '';

  // -- weapons: WEAPON, then name + attack + critical three rows down, and type, range, ammunition, damage four rows below that --
  out.melee = []; out.ranged = [];
  g.forEach((row, r) => {
    if (row[1] !== 'WEAPON') return;
    const name = cell(r + 3, 1);
    if (!name) return;
    const w = { weapon: name, attackBonus: val(r + 3, 28), critical: val(r + 3, 35), type: cell(r + 7, 1), damage: cell(r + 7, 28), ammunition: cell(r + 7, 13) };
    const range = cell(r + 7, 6);
    if (!w.attackBonus && !w.damage) return; // the template's empty "Unarmed" block
    if (range) w.notes = `range ${range}`;
    (range || w.ammunition ? out.ranged : out.melee).push(w);
  });

  // -- gear: "10 x Torch" is a quantity; "- 20 x Bolts" sits inside the item above it --
  out.gear = [];
  const gearHead = g.findIndex(r => r[1] === 'Item' && r[18] === 'WT.');
  const gearEnd = rowOf(1, 'TOTAL WEIGHT', Math.max(gearHead, 0));
  let holder = '';
  for (let r = gearHead + 1; gearHead >= 0 && r < (gearEnd < 0 ? g.length : gearEnd); r++) {
    let text = cell(r, 1);
    if (!text) continue;
    const inner = /^[-–]\s*/.test(text);
    text = text.replace(/^[-–]\s*/, '');
    const m = text.match(/^(\d+)\s*x\s+(.+)$/i);
    // "HB of Vast Intelligence +2 [Arcana]": spell the shorthand out so the compendium finds it, and keep the bracket as a note.
    const full = (m ? m[2] : text).replace(/^HB\b/, 'Headband').replace(/^BoC\b/i, 'Boots of Climbing');
    const tag = full.match(/\s*\[([^\]]*)\]\s*$/);
    const item = { name: tag ? full.slice(0, tag.index).trim() : full, notes: tag ? tag[1] : '', quantity: m ? m[1] : '', weight: val(r, 18), location: inner ? holder : '' };
    if (!inner) holder = item.name;
    out.gear.push(item);
  }
  const money = { pp: 'PP', gp: 'GP', sp: 'SP', cp: 'CP' };
  out.money = {};
  for (const [k, label] of Object.entries(money)) { const r = rowOf(2, label); if (r >= 0 && toNum(val(r, 4)) !== null) out.money[k] = val(r, 4); }

  // -- feats (left column), special abilities (below them), then more special abilities further down --
  const splitEntry = text => {
    const m = text.match(/^(.*?)\s+[-–—]\s+([\s\S]*)$/);
    const name = (m ? m[1] : text).replace(/\[(su|ex|sp)\]/ig, '($1)').trim();
    return { name, notes: m ? m[2].trim() : '' };
  };
  const featsRow = rowOf(22, 'FEATS'), specRow = rowOf(22, 'SPECIAL ABILITIES'), spellsRow = rowOf(1, 'SPELLS', Math.max(specRow, 0));
  out.feats = []; out.traits = []; out.specialAbilities = [];
  for (let r = featsRow + 1; featsRow >= 0 && r < (specRow < 0 ? g.length : specRow); r++) if (cell(r, 22)) out.feats.push(splitEntry(cell(r, 22)));
  for (let r = specRow + 1; specRow >= 0 && r < (spellsRow < 0 ? g.length : spellsRow); r++) if (cell(r, 22)) out.specialAbilities.push(splitEntry(cell(r, 22)));

  // -- spells: LEVEL, prepared, used, name, school --
  out.spells = Array.from({ length: 10 }, () => ({ slotted: [] }));
  const spHead = g.findIndex(r => r[1] === 'LEVEL' && /^name/i.test(r[10] || ''));
  for (let r = spHead + 1; spHead >= 0 && r < g.length; r++) {
    const lvl = toNum(cell(r, 1)), name = cell(r, 10);
    if (lvl === null || lvl < 0 || lvl > 9 || !name) continue;
    out.spells[lvl].slotted.push({ name, level: String(lvl), school: cell(r, 48), prepared: toNum(val(r, 4)) ?? 0, cast: toNum(val(r, 7)) ?? 0 });
  }
  return out;
}
