// Converts a character from charactersheet.co.uk (their JSON download / API) into this app's model.
// Their sheet stores hand-entered totals; this app derives numbers from class levels, so the importer
// rebuilds level records from the "Class / Level" text and reports where the two sheets disagree.
import { api } from './api.js';
import { hintFromSub } from './paperdoll.js';
import { suggestEffects } from './itemfx.js';
import { compute, sign } from './calc.js';
import { ABILITIES, SKILL_BY_NAME, MULTI_SKILLS, RACES, SIZES } from './data.js';
import { newCharacter, skillKey } from './model.js';
import { bakeArchetype } from './features.js';

export const CS_SOURCE = 'charactersheet.co.uk';

/** True when a parsed JSON object looks like a charactersheet.co.uk character rather than one of ours. */
export function isCsCharacter(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  if (Array.isArray(o.levelUps)) return false;
  const ab = o.abilities;
  return '_id' in o || (ab && typeof ab === 'object' && ab.str !== undefined && typeof ab.str !== 'object')
    || (o.skills && typeof o.skills === 'object' && !Array.isArray(o.skills));
}

const toNum = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const m = String(v).trim().match(/^([+-]?\s*\d+)\s*$/);
  return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null;
};
const leadNum = v => {
  const m = String(v ?? '').match(/[+-]?\d+/);
  return m ? parseInt(m[0], 10) : null;
};
const n0 = v => toNum(v) ?? 0;
const str = v => (v === null || v === undefined ? '' : String(v).trim());
/** A free-text field that isn't a plain number (e.g. "+2 vs poison") is kept as a note. */
const textOnly = v => (str(v) && toNum(v) === null ? str(v) : '');

// ---- classes ----

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Common shorthand people type for classes ("Ftr3/Rog2", "Wiz 5").
const CLASS_ABBR = {
  Barb: 'Barbarian', Bbn: 'Barbarian', Brb: 'Barbarian', Brd: 'Bard', Clr: 'Cleric', Cler: 'Cleric', Drd: 'Druid', Dru: 'Druid',
  Ftr: 'Fighter', Fig: 'Fighter', Fight: 'Fighter', Mnk: 'Monk', Pal: 'Paladin', Pally: 'Paladin', Rgr: 'Ranger', Rog: 'Rogue',
  Sor: 'Sorcerer', Sorc: 'Sorcerer', Wiz: 'Wizard', Alch: 'Alchemist', Cav: 'Cavalier', Inq: 'Inquisitor', Ora: 'Oracle',
  Summ: 'Summoner', Smn: 'Summoner', Wit: 'Witch', Mag: 'Magus', Gun: 'Gunslinger', Gunsl: 'Gunslinger', Nin: 'Ninja',
  Sam: 'Samurai', Apal: 'Antipaladin', 'Anti-Paladin': 'Antipaladin', Arc: 'Arcanist', Arcan: 'Arcanist', BR: 'Bloodrager',
  Brw: 'Brawler', Hun: 'Hunter', Inv: 'Investigator', Shm: 'Shaman', Sham: 'Shaman', Skl: 'Skald', Sla: 'Slayer',
  Swash: 'Swashbuckler', Swb: 'Swashbuckler', WP: 'Warpriest', Warp: 'Warpriest',
};

/** "White Mage Arcanist, lvl 8" / "Fighter 3 / Rogue 2" / "Wiz5" / "Fighter (Two-Handed Fighter) 7" -> [{cls, levels, archetype}] */
export function guessClasses(text, classes) {
  const whole = str(text);
  if (!whole) return [];
  // Archetypes written in brackets after the class ("Fighter (Two-Handed Fighter) 7"). They are blanked out here so the class and number matching below ignores them
  // (an archetype can contain a class name), and handed back to the class they follow.
  const brackets = [...whole.matchAll(/\(([^)]*)\)/g)].map(m => ({ start: m.index, end: m.index + m[0].length, text: m[1].trim() })).filter(b => b.text);
  let t = whole;
  for (const b of brackets) t = t.slice(0, b.start) + ' '.repeat(b.end - b.start) + t.slice(b.end);
  const known = new Set(classes.map(c => c.name));
  const names = [...classes.map(c => [c.name, c.name]), ...Object.entries(CLASS_ABBR).filter(([, v]) => known.has(v))]
    .sort((a, b) => b[0].length - a[0].length);
  const found = [];
  for (const [word, name] of names) {
    // Lookarounds instead of \b so "Wiz5" and "Ftr3" still match.
    const re = new RegExp(`(?<![a-z])${escRe(word)}s?(?![a-z])`, 'ig');
    let m;
    while ((m = re.exec(t))) {
      if (found.some(f => m.index < f.end && m.index + m[0].length > f.start)) continue;
      found.push({ cls: name, start: m.index, end: m.index + m[0].length });
    }
  }
  found.sort((a, b) => a.start - b.start);
  const nums = [...t.matchAll(/\d+/g)].map(m => ({ n: +m[0], at: m.index }));
  return found.map((f, i) => {
    const next = found[i + 1]?.start ?? t.length;
    const prevEnd = found[i - 1]?.end ?? 0;
    // Prefer a number after the class name ("Fighter 3"), else one just before it ("3rd-level fighter").
    let num = nums.find(x => x.at >= f.end && x.at < next) || [...nums].reverse().find(x => x.at < f.start && x.at >= prevEnd);
    if (!num && found.length === 1 && nums.length === 1) num = nums[0];
    // Words in front of the class name in the same segment are usually an archetype ("White Mage Arcanist").
    const seg = t.slice(prevEnd, f.start).split(/[\/,;&+]|\band\b/i).pop();
    const before = seg.replace(/\d+(st|nd|rd|th)?(-|\s)*(level)?/ig, '').replace(/\blvl\b|\blevel\b/ig, '').trim().replace(/^[-–:]+|[-–:]+$/g, '').trim();
    // A bracket belongs to the class just before it ("Fighter 7 (Two-Handed Fighter)"), else to the one just after it.
    const mine = brackets.filter(b => {
      const prev = [...found].reverse().find(x => x.end <= b.start);
      if (prev && /^[\s\d\-–:]*$/.test(t.slice(prev.end, b.start))) return prev === f;
      return !prev && found.find(x => x.start >= b.end) === f;
    }).map(b => b.text);
    return { cls: f.cls, levels: Math.max(1, Math.min(20, num ? num.n : 1)), archetype: [before, ...mine].filter(Boolean).join(', ') };
  });
}

/** Some sheets keep an item's, trait's or feat's name in `type` and leave `name` empty (the site's type picker doubles as the name).
 * Gives those entries a `name`, so nothing is skipped as nameless. Safe to run twice. */
export function normalizeCs(src) {
  for (const list of ['gear', 'feats', 'traits', 'specialAbilities']) {
    if (!Array.isArray(src[list])) continue;
    for (const x of src[list]) {
      if (x && typeof x === 'object' && !str(x.name) && str(x.type)) { x.name = x.type; delete x.type; }
    }
  }
  return src;
}

// ---- name resolution against the compendium ----

const ROUTE = { Feat: 'feats', Trait: 'traits', 'Racial Trait': 'traits' };
const LIST_CATS = {
  feats: ['Feat', 'Trait', 'Racial Trait', 'Class Feature', 'Archetype'],
  traits: ['Trait', 'Racial Trait', 'Feat', 'Class Feature'],
  specials: ['Racial Trait', 'Class Feature', 'Trait', 'Feat', 'Monster Ability'],
};

function nameVariants(raw) {
  const out = [];
  const add = v => { v = v.replace(/\s+/g, ' ').trim(); if (v && !out.includes(v)) out.push(v); };
  let n = str(raw).replace(/^[*•\-–\s]+/, '');
  add(n);
  n = n.replace(/\s*[x×]\s*\d+$/i, '');            // "Extra Reservoir x2"
  add(n);
  n = n.replace(/\s*\((su|ex|sp)\)$/i, '');        // "Dimensional Slide (Su)"
  add(n);
  const paren = n.match(/^(.*?)\s*\(([^)]*)\)\s*$/); // "Weapon Focus (longsword)"
  if (paren) add(paren[1]);
  add(n.replace(/\s*\+\d+$/, ''));                // "Cloak of Resistance +2"
  add(n.replace(/^(greater|improved|lesser|mass)\s+(.*)$/i, '$2, $1'));
  return { variants: out, detail: paren ? paren[2] : '' };
}

/** Looks up every feat, trait, ability, spell and item name in one request. */
export async function resolveAll(src) {
  normalizeCs(src);
  const jobs = [];
  const push = (key, name, cats) => { const v = nameVariants(name); jobs.push({ key, name, ...v, cats }); };
  for (const [list, key] of [['feats', 'feats'], ['traits', 'traits'], ['specialAbilities', 'specials']]) {
    (Array.isArray(src[list]) ? src[list] : []).forEach((x, i) => str(x?.name) && push(`${key}.${i}`, x.name, LIST_CATS[key]));
  }
  (Array.isArray(src.spells) ? src.spells : []).forEach((lv, l) =>
    (Array.isArray(lv?.slotted) ? lv.slotted : []).forEach((s, i) => str(s?.name) && push(`spell.${l}.${i}`, s.name, ['Spell'])));
  (Array.isArray(src.gear) ? src.gear : []).forEach((g, i) => str(g?.name) && push(`gear.${i}`, g.name, ['Magic Item']));
  (Array.isArray(src.spellLikes) ? src.spellLikes : []).forEach((s, i) => str(s?.name) && push(`sla.${i}`, s.name, ['Spell']));
  const hits = jobs.length ? await api.resolve(jobs.map(j => ({ variants: j.variants, cats: j.cats }))) : [];
  const map = {};
  jobs.forEach((j, i) => { map[j.key] = { hit: hits[i] || null, detail: j.detail, name: j.variants[0] || j.name }; });
  // A spell-like ability's level sets its save DC: take the lowest level any class gets the spell at.
  const slas = Object.entries(map).filter(([k, v]) => k.startsWith('sla.') && v.hit);
  if (slas.length) {
    const entries = await api.entries(slas.map(([, v]) => v.hit.id)).catch(() => []);
    slas.forEach(([, v], i) => { const lv = Object.values(entries[i]?.meta?.levels || {}).map(Number).filter(Number.isFinite); if (lv.length) v.level = Math.min(...lv); });
  }
  return map;
}

// ---- conversion ----

const SKILL_KEYS = {
  disableDevice: 'Disable Device', escapeArtist: 'Escape Artist', handleAnimal: 'Handle Animal',
  senseMotive: 'Sense Motive', sleightOfHand: 'Sleight of Hand', useMagicDevice: 'Use Magic Device',
};
function skillName(key) {
  if (SKILL_KEYS[key]) return SKILL_KEYS[key];
  const k = key.match(/^knowledge(\w+)$/);
  if (k) return `Knowledge (${k[1].toLowerCase()})`;
  const base = key.replace(/\d+$/, '');
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  return SKILL_BY_NAME[name] ? name : null;
}

function matchRace(text) {
  const t = str(text).toLowerCase().replace(/[\s_]+/g, '-');
  if (!t) return null;
  const keys = Object.keys(RACES).filter(k => k !== 'Custom');
  return keys.find(k => k.toLowerCase() === t)
    || keys.sort((a, b) => b.length - a.length).find(k => new RegExp(`(^|[^a-z])${escRe(k.toLowerCase())}($|[^a-z])`).test(t)) || null;
}

function matchAlignment(text) {
  const t = str(text).toUpperCase();
  if (/^(LG|NG|CG|LN|N|CN|LE|NE|CE)$/.test(t)) return t;
  if (/TRUE\s+NEUTRAL|^NEUTRAL$/.test(t)) return 'N';
  const law = /LAWFUL/.test(t) ? 'L' : /CHAOTIC/.test(t) ? 'C' : 'N';
  const good = /GOOD/.test(t) ? 'G' : /EVIL/.test(t) ? 'E' : 'N';
  if (!/LAWFUL|CHAOTIC|GOOD|EVIL/.test(t)) return null;
  return law === 'N' && good === 'N' ? 'N' : law + good;
}

const SIZE_NAMES = Object.keys(SIZES);
const matchSize = s => SIZE_NAMES.find(z => z.toLowerCase() === str(s).toLowerCase()) || null;

/**
 * Builds a character for this app. `classRows` is [{cls, levels, archetype}] (from guessClasses, possibly
 * edited by the user). Returns {char, notes} where notes lists what was carried over as text.
 */
export function buildCharacter(src, classRows, resolved, classesByName, archetypeData = {}) {
  normalizeCs(src);
  const c = newCharacter();
  const notes = [];          // human-readable lines for the import report
  const extra = [];          // text appended to the character's Notes
  const keepNote = (label, v) => { if (str(v)) extra.push(`${label}: ${str(v)}`); };

  // -- bio --
  c.name = str(src.name) || 'Imported character';
  for (const k of ['gender', 'age', 'height', 'weight', 'hair', 'eyes', 'deity', 'homeland', 'languages']) if (str(src[k])) c[k] = str(src[k]);
  const al = matchAlignment(src.alignment);
  if (al) c.alignment = al; else keepNote('Alignment', src.alignment);
  c.xp = n0(src.xp?.total);

  // -- race --
  const race = matchRace(src.race);
  if (race) c.race = race;
  else {
    c.race = 'Custom';
    c.customRace = { name: str(src.race) || 'Unknown', mods: {}, size: matchSize(src.size) || 'Medium', speed: toNum(src.speed?.base) ?? 30 };
    if (str(src.race)) notes.push(`Race “${str(src.race)}” isn’t in the race list, so it was set up as a custom race (no ability modifiers).`);
  }

  // -- abilities: their scores are final totals; back out the racial modifier so the totals stay the same --
  const raw = {};
  for (const a of ABILITIES) raw[a] = toNum(src.abilities?.[a]) ?? 10;
  if (race && RACES[race].flex) {
    c.raceChoice = [...ABILITIES].sort((x, y) => raw[y] - raw[x])[0];
  }
  const racial = race ? { ...(RACES[race].mods || {}) } : {};
  if (race && RACES[race].flex) racial[c.raceChoice] = (racial[c.raceChoice] || 0) + 2;
  for (const a of ABILITIES) {
    c.abilities[a].base = raw[a] - (racial[a] || 0);
    const temp = toNum(src.abilities?.['temp' + a.charAt(0).toUpperCase() + a.slice(1)]);
    if (temp !== null && temp !== raw[a]) c.abilities[a].temp = temp - raw[a];
  }

  // -- class levels --
  const rows = classRows.filter(r => classesByName[r.cls] && r.levels > 0);
  for (const r of rows) {
    for (let i = 0; i < r.levels; i++) c.levelUps.push({ cls: r.cls, hp: 0, fcb: '', fcbNote: '', abilityIncrease: '', ranks: {}, notes: 'Imported' });
    if (r.archetype) c.archetypes[r.cls] = r.archetype.split(/\s*(?:,|\/|\band\b)\s*/).filter(Boolean).map(name => {
      // Use the compendium's archetype (features, class-skill changes) when the name matches one.
      const list = archetypeData[r.cls] || [];
      const hit = list.find(a => a.name.toLowerCase() === name.toLowerCase())
        || list.find(a => name.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(name.toLowerCase()));
      return hit ? bakeArchetype(hit) : { name };
    });
  }
  if (rows.length) c.favoredClass = rows[0].cls;
  keepNote(`Class/level on ${src._source || CS_SOURCE}`, src.level);

  // -- defenses / AC --
  c.ac.natural = n0(src.ac?.naturalArmor);
  c.ac.deflection = n0(src.ac?.deflectionModifier);
  c.ac.misc = n0(src.ac?.miscModifier);
  keepNote('AC notes', textOnly(src.ac?.otherModifiers) || textOnly(src.ac?.miscModifier));
  const items = Array.isArray(src.ac?.items) ? src.ac.items.filter(x => x && (str(x.name) || str(x.bonus))) : [];
  for (const it of items) {
    const label = `${str(it.name)} ${str(it.type)}`.toLowerCase();
    const shield = /shield|buckler/.test(label);
    c.armor.push({
      name: str(it.name) || (shield ? 'Shield' : 'Armor'), type: shield ? 'shield' : 'armor',
      category: /heavy/.test(label) ? 'heavy' : /medium/.test(label) ? 'medium' : 'light',
      bonus: n0(it.bonus), enh: 0, maxDex: '', acp: -Math.abs(n0(it.armorCheckPenalty)), asf: n0(String(it.spellFailure ?? '').replace('%', '')),
      weight: n0(it.weight), equipped: true, mw: false, material: '', fx: [],
    });
    if (str(it.properties)) extra.push(`${str(it.name) || 'Armor'}: ${str(it.properties)}`);
  }
  // Armor/shield bonus typed straight into the AC box with no item behind it (e.g. mage armor).
  if (!items.some(i => !/shield|buckler/i.test(`${i.name} ${i.type}`)) && n0(src.ac?.armorBonus)) {
    c.armor.push({ name: 'Armor bonus (imported)', type: 'armor', category: 'light', bonus: n0(src.ac.armorBonus), enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true, mw: false, material: '', fx: [] });
    notes.push(`An armor bonus of ${sign(n0(src.ac.armorBonus))} had no armor item behind it, so an “Armor bonus (imported)” entry was added. If it comes from a spell like mage armor, you may prefer to remove it and use a buff instead.`);
  }
  if (!items.some(i => /shield|buckler/i.test(`${i.name} ${i.type}`)) && n0(src.ac?.shieldBonus)) {
    c.armor.push({ name: 'Shield bonus (imported)', type: 'shield', category: 'light', bonus: n0(src.ac.shieldBonus), enh: 0, maxDex: '', acp: 0, asf: 0, weight: 0, equipped: true, mw: false, material: '', fx: [] });
  }
  if (c.armor.some(a => a.maxDex === '' && !/imported/.test(a.name))) notes.push(`Armor max Dex bonus isn’t stored on ${src._source || CS_SOURCE}. Fill it in on the Inventory tab.`);
  c.defenses = { dr: str(src.damageReduction), sr: str(src.spellResistance), resist: str(src.resistances), immune: str(src.immunities) };

  // -- saves, initiative, combat misc --
  const saveSrc = { fort: src.saves?.fort, ref: src.saves?.reflex, will: src.saves?.will };
  for (const [k, s] of Object.entries(saveSrc)) {
    c.saveMisc[k] = n0(s?.magicModifier) + n0(s?.miscModifier);
    const t = [textOnly(s?.otherModifiers) || (toNum(s?.otherModifiers) ? sign(toNum(s.otherModifiers)) : ''), textOnly(s?.tempModifier), textOnly(s?.miscModifier)].filter(Boolean).join('; ');
    keepNote(`${{ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[k]} (conditional)`, t);
  }
  c.initMisc = n0(src.initiative?.miscModifier);
  c.cmbMisc = n0(src.cmb?.miscModifiers);
  c.cmdMisc = n0(src.cmd?.miscModifiers);
  keepNote('CMB (conditional)', textOnly(src.cmb?.miscModifiers) || str(src.cmb?.tempModifiers));
  keepNote('CMD (conditional)', textOnly(src.cmd?.miscModifiers) || str(src.cmd?.tempModifiers));
  keepNote('Conditional offense modifiers', src.conditionalOffenseModifiers);
  const sp = src.speed || {};
  const raceSpeed = race ? RACES[race].speed : c.customRace.speed;
  if (toNum(sp.base) !== null && race) c.speedMisc = toNum(sp.base) - raceSpeed;
  for (const k of ['withArmor', 'fly', 'swim', 'climb', 'burrow', 'tempModifiers']) keepNote(`Speed (${k === 'withArmor' ? 'with armor' : k === 'tempModifiers' ? 'temporary' : k})`, sp[k]);

  // -- skills --
  const extraSkills = [];
  for (const [key, s] of Object.entries(src.skills && typeof src.skills === 'object' ? src.skills : {})) {
    if (!s || typeof s !== 'object') continue;
    if (key === 'conditionalModifiers') continue;
    const name = skillName(key);
    if (!name) continue;
    const ranks = n0(s.ranks);
    const misc = n0(s.misc) + n0(s.racial) + n0(s.trait);
    const sub = str(s.name);
    if (!ranks && !misc && !s.classSkill && !sub) continue;
    let target = MULTI_SKILLS.includes(name)
      ? c.skills.find(x => x.name === name && (x.sub === sub || (!x.sub && !x.ranks && !x.misc && !x.classSkill)))
      : c.skills.find(x => x.name === name);
    if (!target) { target = { name, sub: '', ranks: 0, misc: 0, classSkill: false }; extraSkills.push(target); }
    Object.assign(target, { sub: MULTI_SKILLS.includes(name) ? sub : target.sub, ranks, misc, classSkill: !!s.classSkill });
  }
  c.skills.push(...extraSkills);
  keepNote('Skill notes', src.skills?.conditionalModifiers);

  // -- feats, traits, special abilities (routed by what the compendium says they are) --
  const lists = { feats: [], traits: [], specials: [] };
  const addItem = (from, key, x, i) => {
    const r = resolved[`${key}.${i}`];
    const note = str(x.notes);
    const hit = r?.hit;
    const dest = hit ? (ROUTE[hit.cat] || 'specials') : key;
    const entry = hit
      ? { id: hit.id, name: hit.name, sub: hit.sub || '', notes: [r.detail, note.length <= 200 ? note : ''].filter(Boolean).join(' · ') }
      : { name: r?.name || str(x.name), notes: [str(x.type), note].filter(Boolean).join(' · ') };
    if (hit && str(x.type) && !hit.sub) entry.sub = str(x.type);
    lists[dest].push(entry);
  };
  (src.feats || []).forEach((x, i) => x && str(x.name) && addItem('feats', 'feats', x, i));
  (src.traits || []).forEach((x, i) => x && str(x.name) && addItem('traits', 'traits', x, i));
  (src.specialAbilities || []).forEach((x, i) => x && str(x.name) && addItem('specialAbilities', 'specials', x, i));
  (src.spellLikes || []).forEach((s, i) => {
    if (!s || !str(s.name)) return;
    // A spell-like ability that is a spell goes on the Spells tab, with its uses per day; anything else (a class pool such as Arcane Reservoir) stays a special ability.
    const r = resolved[`sla.${i}`], hit = r?.hit?.cat === 'Spell' ? r.hit : null;
    if (hit || str(s.school)) {
      const perDay = s.atWill ? '' : n0(s.prepared) || '';
      c.spellLikes.push({ ...(hit ? { id: hit.id } : {}), name: hit ? hit.name : str(s.name), school: (str(s.school) || hit?.sub || '').toLowerCase(), summary: '', notes: str(s.notes),
        level: r?.level ?? 1, perDay, used: perDay ? Math.min(n0(s.cast), perDay) : 0, cl: '', ability: 'cha' });
      return;
    }
    const per = s.atWill ? 'at will' : toNum(s.prepared) ? `${toNum(s.prepared)}/day` : '';
    const note = [per, str(s.notes)].filter(Boolean).join(' · ');
    const same = [...lists.specials, ...lists.feats, ...lists.traits].find(x => x.name.toLowerCase() === str(s.name).toLowerCase());
    if (same) same.notes = [note, same.notes].filter(Boolean).join(' · ');
    else lists.specials.push({ name: str(s.name), notes: note });
  });
  Object.assign(c, lists);
  const moved = ['feats', 'traits', 'specialAbilities'].reduce((n, k) => n + (src[k] || []).length, 0);
  const linked = Object.entries(resolved).filter(([k, v]) => !k.startsWith('spell') && !k.startsWith('gear') && v.hit).length;
  if (moved) notes.push(`${linked} of ${moved} feats, traits and abilities were matched to the compendium (click them to read the rules). Racial traits and class features were filed under Special Abilities.`);

  // -- weapons (attack/damage are reconciled against the old sheet after computing) --
  for (const [list, ranged] of [['melee', false], ['ranged', true]]) {
    for (const w of Array.isArray(src[list]) ? src[list] : []) {
      if (!w || !str(w.weapon)) continue;
      const dice = (str(w.damage).match(/^\s*(\d+d\d+(?:\s*[+]\s*\d+d\d+)*)/i) || [])[1] || '';
      c.weapons.push({
        name: str(w.weapon), ability: '', ranged, enh: 0, misc: 0, damage: dice.replace(/\s+/g, '') || str(w.damage),
        dmgAbility: '', dmgMult: '', dmgMisc: 0, crit: str(w.critical), range: '', type: str(w.type), weight: 0, mw: false, material: '', improvedCritical: false, fx: [], slot: '',
        _src: { attack: leadNum(w.attackBonus), damage: str(w.damage), dice },
      });
      const wn = [str(w.notes), str(w.ammunition) && `ammunition: ${str(w.ammunition)}`].filter(Boolean).join('; ');
      if (wn) extra.push(`${str(w.weapon)}: ${wn}`);
    }
  }

  // -- gear & money --
  (src.gear || []).forEach((g, i) => {
    if (!g || !str(g.name)) return;
    const qty = toNum(g.quantity) ?? 1;
    const wt = Number(String(g.weight ?? '').replace(/[^\d.]/g, '')) || 0;
    const hit = resolved[`gear.${i}`]?.hit;
    const note = str(g.notes);
    c.gear.push({
      ...(hit ? { id: hit.id } : {}), name: str(g.name), qty,
      weight: qty > 1 ? Math.round((wt / qty) * 100) / 100 : wt, value: '',
      notes: [str(g.location), str(g.type), hit && note.length > 200 ? '' : note].filter(Boolean).join(' · '),
      // worn items are set on the Inventory tab's paper doll; the item remembers which slot it fits and what bonuses it usually gives (they count once worn)
      slot: '', hint: hintFromSub(hit?.sub), effects: suggestEffects(str(g.name)),
    });
  });
  for (const k of ['pp', 'gp', 'sp', 'cp']) c.money[k] = Number(String(src.money?.[k] ?? '').replace(/[^\d.]/g, '')) || 0;
  keepNote('Gems', src.money?.gems);
  keepNote('Other treasure', src.money?.other);

  // -- spells --
  const casters = rows.map(r => r.cls).filter(n => classesByName[n]?.casting);
  const spellRows = [];
  (Array.isArray(src.spells) ? src.spells : []).forEach((lv, l) => (Array.isArray(lv?.slotted) ? lv.slotted : []).forEach((s, i) => {
    if (!s || !str(s.name) || /^\*/.test(str(s.name))) return; // "*Slots" and similar are placeholders on their sheet
    const hit = resolved[`spell.${l}.${i}`]?.hit;
    spellRows.push({ ...(hit ? { id: hit.id } : {}), name: hit ? hit.name : str(s.name), level: toNum(s.level) ?? l,
      school: str(s.school).toLowerCase() || hit?.sub || '', summary: '', prepared: Math.max(0, n0(s.prepared) - n0(s.cast)), cast: Math.min(n0(s.cast), n0(s.prepared)) }); // their sheet counts prepared and cast; ours counts what is left to cast
  }));
  if (spellRows.length) {
    if (casters.length) {
      c.spellbooks[casters[0]] = { spells: spellRows, used: Array(10).fill(0), extraSlot: false };
      if (casters.length > 1) notes.push(`All ${spellRows.length} spells went into the ${casters[0]} spellbook (the old sheet has a single spell list). Move any ${casters.slice(1).join('/')} spells by re-adding them.`);
    } else {
      extra.push('Spells: ' + spellRows.map(s => `${s.name} (${s.level})`).join(', '));
      notes.push('Spells were saved to Notes because none of the chosen classes casts spells.');
    }
  }
  keepNote('Spell notes', src.spellsConditionalModifiers);
  keepNote('Spell specialty / notes', src.spellsSpeciality);

  const found = { gear: (src.gear || []).length, feats: (src.feats || []).length, traits: (src.traits || []).length };
  const got = { gear: c.gear.length, feats: c.feats.length + c.traits.length + c.specials.length };
  if (got.gear < found.gear) notes.push(`The sheet lists ${found.gear} gear items but only ${got.gear} had a name, so the rest were skipped. Add them on the Inventory tab.`);
  if (got.feats < found.feats + found.traits) notes.push(`Some feats or traits had no name and were skipped (${got.feats} of ${found.feats + found.traits} imported).`);

  // -- notes --
  c.notes = [str(src.notes), extra.length ? `— Imported from ${src._source || CS_SOURCE} —\n${extra.join('\n')}` : ''].filter(Boolean).join('\n\n');
  c.importedFrom = { source: src._source || CS_SOURCE, id: str(src._id), date: new Date().toISOString() };

  // -- second pass: HP and weapons need the computed numbers --
  neutralizeAuto(c, classesByName, notes);
  reconcile(c, src, classesByName, notes);
  return { char: c, notes };
}

/**
 * Feats, traits and the race now add their flat bonuses by themselves, but the old sheet's Misc boxes already hold them (people typed them in).
 * Take that much out of each Misc box so the totals stay what the old sheet said, and so nothing is counted twice.
 */
function neutralizeAuto(c, classesByName, notes) {
  const on = compute(c, classesByName), off = compute(c, classesByName, { noAuto: true });
  const moved = [];
  const take = (label, by, apply) => { if (by) { apply(by); moved.push(`${label} ${signed(-by)}`); } };
  for (const k of ['fort', 'ref', 'will']) take({ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[k], on.saves[k].total - off.saves[k].total, by => { c.saveMisc[k] -= by; });
  take('Initiative', on.init - off.init, by => { c.initMisc -= by; });
  take('AC', on.ac.total - off.ac.total, by => { c.ac.misc -= by; });
  for (const s of c.skills) {
    const k = skillKey(s);
    take(k, (on.skills[k]?.total ?? 0) - (off.skills[k]?.total ?? 0), by => { s.misc = (Number(s.misc) || 0) - by; });
  }
  if (moved.length) notes.push(`Some feats, traits or racial traits now add their bonus on their own, so the same amount was taken out of the old sheet’s Misc boxes to keep the totals the same: ${moved.join(', ')}. Add the bonus back to Misc if you turn the feat or trait off.`);
}

/** A signed number for a sentence: +2, −3 (a real minus sign, so it cannot be mistaken for a dash). */
const signed = n => (n < 0 ? '\u2212' : '+') + Math.abs(n);

/**
 * Makes the numbers this app works out match the old sheet's, by putting the difference in a Misc box. Every difference put there is written into `notes`:
 * a number nobody can explain is how a wrong attack bonus hides for weeks, so the import report names each one and says where to clear it.
 */
function reconcile(c, src, classesByName, notes = []) {
  let d = compute(c, classesByName);
  // HP: first level max, then average; spread any difference across later levels so the total matches.
  const target = toNum(src.hp?.total);
  if (c.levelUps.length) {
    const hds = c.levelUps.map(l => classesByName[l.cls]?.hit_die || 8);
    c.levelUps.forEach((l, i) => { l.hp = i === 0 ? hds[0] : Math.floor(hds[i] / 2) + 1; });
    if (target !== null) {
      d = compute(c, classesByName);
      let diff = target - d.hp.max;
      for (let pass = 0; diff !== 0 && pass < 40; pass++) {
        let changedAny = false;
        for (let i = 1; i < c.levelUps.length && diff !== 0; i++) {
          const l = c.levelUps[i];
          if (diff > 0 && l.hp < hds[i]) { l.hp++; diff--; changedAny = true; }
          else if (diff < 0 && l.hp > 1) { l.hp--; diff++; changedAny = true; }
        }
        if (!changedAny) break;
      }
      c.hp.misc = diff;
    }
  } else if (target !== null) c.hp.misc = target - d.hp.max;
  if (c.hp.misc) notes.push(`Hit points: the old sheet says ${target}, and this app works out ${target - c.hp.misc} from your levels and Constitution, so ${signed(c.hp.misc)} was put in the HP Misc box. A feat such as Toughness, a favored class bonus or rolled hit dice usually explain it; if none does, clear the box.`);
  const wounds = toNum(src.hp?.wounds);
  if (wounds) c.hp.current = (target ?? 0) - wounds;
  c.hp.nonlethal = n0(src.hp?.nonLethal);

  // Weapons: pick Str or Dex to attack with, then put any leftover (Weapon Focus, enhancement…) in misc.
  d = compute(c, classesByName);
  const M = a => d.abilities[a].mod;
  c.weapons.forEach((w, i) => {
    const s = w._src;
    delete w._src;
    if (!s) return;
    const dw = d.weapons[i];
    if (s.attack !== null) {
      // dw.attack already uses Dex when Weapon Finesse does it by itself, so work out each choice from the ability it used
      const opts = w.ranged ? [['', dw.attack]] : [['str', dw.attack - M(dw.ability) + M('str')], ['dex', dw.attack - M(dw.ability) + M('dex')]];
      let [abil, base] = opts.reduce((best, o) => (Math.abs(s.attack - o[1]) < Math.abs(s.attack - best[1]) ? o : best));
      if (abil === 'str' && !(dw.ability === 'dex' && !w.ability)) abil = ''; // plain Strength is the automatic choice, unless the finesse feat would pick Dex
      w.ability = abil;
      w.misc = s.attack - base;
      if (w.misc) notes.push(`${w.name} attack: the old sheet says ${signed(s.attack)}, and this app works out ${signed(base)} (${abil ? 'Dexterity' : w.ranged ? 'Dexterity' : 'Strength'}), so ${signed(w.misc)} was put in the weapon's Atk+ box. ${w.misc > 0 ? 'A feat such as Weapon Focus, a magic or masterwork bonus, or a buff the old sheet had on usually explains a bonus.' : 'A penalty such as not being proficient, fatigue or a spell the old sheet had on usually explains it.'} If you do not know where it comes from, clear the box.`);
    }
    // Damage: only reconcile when the old sheet spelled out a bonus ("1d8+4"), not just dice.
    const bonusM = s.dice && s.damage.slice(s.damage.indexOf(s.dice) + s.dice.length).match(/^\s*([+-]\s*\d+)/);
    if (bonusM) {
      const want = parseInt(bonusM[1].replace(/\s/g, ''), 10);
      const strM = M('str');
      const base = dw.dmgBonus;
      if (!w.ranged && strM > 0 && base - strM + Math.floor(strM * 1.5) === want) w.dmgMult = '1.5';
      else if (!w.ranged && strM > 0 && base - strM + Math.floor(strM * 0.5) === want) w.dmgMult = '0.5';
      else w.dmgMisc = want - base;
      if (w.dmgMisc) notes.push(`${w.name} damage: the old sheet says ${signed(want)}, and this app works out ${signed(base)}, so ${signed(w.dmgMisc)} was put in the weapon's Dmg+ box. Check it against the weapon's feats and bonuses; if you do not know where it comes from, clear the box.`);
    }
  });
}

/** Rows of [label, old sheet value, value now] for the numbers both sheets show. */
export function compareSheets(src, c, classesByName) {
  const d = compute(c, classesByName);
  const rows = [];
  const row = (label, theirs, ours, fmt = sign) => {
    const t = leadNum(theirs);
    if (t === null) return;
    rows.push({ label, theirs: fmt === sign ? sign(t) : t, ours: fmt(ours), same: t === ours });
  };
  row('Hit points', src.hp?.total, d.hp.max, v => v);
  row('AC', src.ac?.total, d.ac.total, v => v);
  row('Touch AC', src.ac?.touch, d.ac.touch, v => v);
  row('Flat-footed AC', src.ac?.flatFooted, d.ac.flat, v => v);
  row('Fortitude', src.saves?.fort?.total, d.saves.fort.total);
  row('Reflex', src.saves?.reflex?.total, d.saves.ref.total);
  row('Will', src.saves?.will?.total, d.saves.will.total);
  row('Initiative', src.initiative?.total, d.init);
  row('Base attack', src.bab, d.bab);
  row('CMB', src.cmb?.total, d.cmb);
  row('CMD', src.cmd?.total, d.cmd, v => v);
  for (const a of ABILITIES) row(a.toUpperCase(), src.abilities?.[a], d.abilities[a].score - (num0(c.abilities[a].temp)), v => v);
  const skillTotals = {};
  for (const [key, s] of Object.entries(src.skills || {})) {
    const name = skillName(key);
    if (!name || !s || typeof s !== 'object' || leadNum(s.total) === null) continue;
    const sk = c.skills.find(x => x.name === name && (!MULTI_SKILLS.includes(name) || x.sub === str(s.name)));
    if (sk) skillTotals[skillKey(sk)] = s.total;
  }
  for (const [k, t] of Object.entries(skillTotals)) row(k, t, d.skills[k]?.total ?? 0);
  return rows;
}
const num0 = v => Number(v) || 0;
