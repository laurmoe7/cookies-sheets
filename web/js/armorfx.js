// Armor and shield enchantments and special materials: what they change on the sheet. Pure, no DOM, tested in tests/armorfx.test.mjs.
// A piece of armor stores `mw` (masterwork), `material` (a MATERIALS id) and `fx` = [{id}] (an ABILITIES id), next to the `enh` bonus it already had.

/**
 * Special materials. `acp`, `maxDex`, `asf`: changes to the armor check penalty (a penalty of 0 stays 0), maximum Dex bonus and arcane spell failure.
 * `weight`: multiplier on the weight typed in. `lighter`: counts as one category lighter for speed. `dr`: damage reduction by category (armor only).
 * `only`: 'armor' or 'shield' when the material fits just one.
 */
export const MATERIALS = [
  { id: '', name: 'Ordinary' },
  { id: 'mithral', name: 'Mithral', mw: true, acp: -3, maxDex: 2, asf: -10, weight: 0.5, lighter: true, note: 'Check penalty −3 (not below 0), maximum Dex bonus +2, arcane spell failure −10%, half weight, and it counts as one category lighter for speed. Counts as masterwork.' },
  { id: 'adamantine', name: 'Adamantine', mw: true, only: 'armor', dr: { light: 1, medium: 2, heavy: 3 }, note: 'Damage reduction 1/− in light armor, 2/− in medium, 3/− in heavy. Counts as masterwork.' },
  { id: 'darkwood', name: 'Darkwood', mw: true, only: 'shield', acp: -2, weight: 0.5, note: 'Wooden shields only: check penalty −2 (not below 0) and half weight. Counts as masterwork.' },
];
export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

const ENERGY = ['acid', 'cold', 'electricity', 'fire', 'sonic'];
const GRADE = [['', 10], ['improved', 20], ['greater', 30]];
const SKILL = (id, name, skill) => [5, 10, 15].map((v, i) => ({ id: id + ['', 'imp', 'great'][i], name: name + ['', ' (improved)', ' (greater)'][i], plus: 0, skill, skillBonus: v, note: `+${v} competence bonus on ${skill} checks. Costs gold, not an enhancement bonus.` }));

/**
 * Special abilities. `plus` is the enhancement bonus the ability takes up (0 for the ones sold for a flat price). `only` limits it to armor or a shield.
 * Effects: skill/skillBonus (competence bonus on a skill), dr (e.g. '5/magic'), sr (spell resistance), resist {type, n}, fort (% chance to ignore a critical or sneak attack).
 */
export const ABILITIES = [
  ...SKILL('shadow', 'Shadow', 'Stealth'),
  ...SKILL('silent', 'Silent moves', 'Stealth'),
  ...SKILL('slick', 'Slick', 'Escape Artist'),
  { id: 'fort25', name: 'Light fortification', plus: 1, fort: 25, only: 'armor', note: '25% chance to ignore the extra damage of a critical hit or sneak attack.' },
  { id: 'fort75', name: 'Moderate fortification', plus: 3, fort: 75, only: 'armor', note: '75% chance to ignore the extra damage of a critical hit or sneak attack.' },
  { id: 'fort100', name: 'Heavy fortification', plus: 5, fort: 100, only: 'armor', note: 'Ignores the extra damage of critical hits and sneak attacks.' },
  { id: 'invuln', name: 'Invulnerability', plus: 3, dr: '5/magic', only: 'armor', note: 'Damage reduction 5/magic.' },
  { id: 'sr13', name: 'Spell resistance 13', plus: 2, sr: 13, only: 'armor' },
  { id: 'sr15', name: 'Spell resistance 15', plus: 3, sr: 15, only: 'armor' },
  { id: 'sr17', name: 'Spell resistance 17', plus: 4, sr: 17, only: 'armor' },
  { id: 'sr19', name: 'Spell resistance 19', plus: 5, sr: 19, only: 'armor' },
  ...ENERGY.flatMap(t => GRADE.map(([g, n]) => ({ id: `res-${t}${g ? '-' + g : ''}`, name: `${t[0].toUpperCase() + t.slice(1)} resistance${g ? ' (' + g + ')' : ''}`, plus: 0, resist: { type: t, n }, note: `Resist ${t} ${n}. Costs gold, not an enhancement bonus.` }))),
  { id: 'ghosttouch', name: 'Ghost touch', plus: 3, note: 'Counts as a ghost touch weapon against incorporeal creatures, and its bonus applies to incorporeal touch attacks.' },
  { id: 'glamered', name: 'Glamered', plus: 0, only: 'armor', note: 'Looks like ordinary clothes on command.' },
  { id: 'blinding', name: 'Blinding', plus: 0, note: 'Flash of light, 2/day: creatures within 20 ft. are blinded (Reflex DC 14 negates).' },
  { id: 'etherealness', name: 'Etherealness', plus: 0, only: 'armor', note: 'Becomes ethereal for up to 10 minutes a day, as the spell.' },
  { id: 'wild', name: 'Wild', plus: 3, only: 'armor', note: 'The armor’s bonuses carry over when you wild shape.' },
  { id: 'spellstoring', name: 'Spell storing', plus: 1, only: 'armor', note: 'Holds one spell of up to 3rd level.' },
  { id: 'bashing', name: 'Bashing', plus: 1, only: 'shield', note: 'Shield bashes deal damage as if the shield were two sizes larger.' },
  { id: 'arrowcatching', name: 'Arrow catching', plus: 1, only: 'shield', note: 'Ranged attacks aimed near you are drawn to the shield.' },
  { id: 'arrowdeflection', name: 'Arrow deflection', plus: 2, only: 'shield', note: 'Once per round, deflect one ranged weapon attack.' },
  { id: 'animated', name: 'Animated', plus: 2, only: 'shield', note: 'The shield floats and defends you without being held.' },
  { id: 'reflecting', name: 'Reflecting', plus: 5, only: 'shield', note: 'Once a day, reflect a spell back at its caster.' },
];
export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

const num = v => parseFloat(v) || 0;

/** Abilities and materials that apply to this kind of piece (`type` is 'armor' or 'shield'). */
export const materialsFor = type => MATERIALS.filter(m => !m.only || m.only === type);
export const abilitiesFor = type => ABILITIES.filter(a => !a.only || a.only === type);

/**
 * What one piece of armor (or a shield) changes. `a` is the saved item.
 * Returns { mw, acpDelta, maxDexDelta, asfDelta, weightMult, lighter, dr: [text], sr, resist: [{type, n}], fort, skills: {Skill: value}, notes: [text], summary, warn }.
 */
export function armorFx(a) {
  const type = a.type === 'shield' ? 'shield' : 'armor';
  const mat = MATERIAL_BY_ID[a.material || ''] || MATERIAL_BY_ID[''];
  const fx = (a.fx || []).map(f => ABILITY_BY_ID[f.id]).filter(Boolean);
  const enh = Math.max(0, num(a.enh));
  const total = enh + fx.reduce((s, f) => s + f.plus, 0);
  const mw = !!a.mw || !!mat.mw || enh > 0;
  // An enhancement bonus alone does not lower the check penalty again: saves made before this had the real one typed in.
  const out = {
    mw, acpDelta: (mat.acp || 0) - (a.mw || mat.mw ? 1 : 0), maxDexDelta: mat.maxDex || 0, asfDelta: mat.asf || 0, weightMult: mat.weight || 1, lighter: !!mat.lighter,
    dr: [], sr: 0, resist: [], fort: 0, skills: {}, notes: [],
  };
  if (mat.dr && type === 'armor' && mat.dr[a.category]) out.dr.push(`${mat.dr[a.category]}/−`);
  for (const f of fx) {
    if (f.dr) out.dr.push(f.dr);
    if (f.sr) out.sr = Math.max(out.sr, f.sr);
    if (f.fort) out.fort = Math.max(out.fort, f.fort);
    if (f.resist) { const r = out.resist.find(x => x.type === f.resist.type); if (r) r.n = Math.max(r.n, f.resist.n); else out.resist.push({ ...f.resist }); }
    if (f.skill) out.skills[f.skill] = Math.max(out.skills[f.skill] || 0, f.skillBonus); // competence bonuses do not stack
    if (f.note && !f.skill && !f.resist && !f.dr && !f.sr && !f.fort) out.notes.push(`${f.name}: ${f.note}`);
  }
  const bits = [];
  const head = enh || fx.some(f => f.plus) ? `+${total}` : '';
  const named = [head, fx.map(f => f.name.toLowerCase()).join(', ')].filter(Boolean).join(' ');
  if (named) bits.push(named);
  if (mat.id) bits.push(mat.name.toLowerCase());
  else if (a.mw && !enh) bits.push('masterwork');
  out.summary = bits.join(' · ');
  out.warn = total > 10 ? `An enhancement bonus above +10 is not allowed (this is +${total}).` : fx.some(f => f.plus) && !enh ? 'Special abilities that cost a bonus need at least a +1 enhancement bonus.' : '';
  return out;
}

/** What everything worn adds up to, for the AC card: damage reduction, spell resistance, resistances, fortification and notes. */
export function wornFx(list) {
  const on = (list || []).filter(a => a.equipped);
  const all = on.map(a => ({ a, fx: armorFx(a) }));
  const dr = all.flatMap(({ a, fx }) => fx.dr.map(t => `${t}${all.length > 1 ? ` (${a.name || 'armor'})` : ''}`));
  const sr = Math.max(0, ...all.map(x => x.fx.sr));
  const resist = [];
  for (const { fx } of all) for (const r of fx.resist) { const e = resist.find(x => x.type === r.type); if (e) e.n = Math.max(e.n, r.n); else resist.push({ ...r }); }
  const fort = Math.max(0, ...all.map(x => x.fx.fort));
  const skills = {};
  for (const { fx } of all) for (const [k, v] of Object.entries(fx.skills)) skills[k] = Math.max(skills[k] || 0, v);
  const parts = [];
  if (dr.length) parts.push('DR ' + dr.join(', '));
  if (sr) parts.push('SR ' + sr);
  if (resist.length) parts.push('resist ' + resist.map(r => `${r.type} ${r.n}`).join(', '));
  if (fort) parts.push(`fortification ${fort}%`);
  return { dr, sr, resist, fort, skills, text: parts.join(' · ') };
}
