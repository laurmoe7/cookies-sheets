// Weapon enchantments and special materials: what they add to attack, damage and critical hits. Pure, no DOM.
// A weapon stores `mw` (masterwork), `material` (a MATERIALS id), `improvedCritical` and `fx` = [{id, on}] (an ABILITIES id; `on` matters for the conditional ones).

/** Special materials. `mw`: counts as masterwork. `weight`: multiplier on the weight typed in. `dmg`: change to each damage roll. `bypass`: the DR it overcomes. */
export const MATERIALS = [
  { id: '', name: 'Ordinary' },
  { id: 'adamantine', name: 'Adamantine', mw: true, bypass: 'adamantine', note: 'Overcomes DR/adamantine and ignores hardness under 20. Counts as masterwork.' },
  { id: 'coldiron', name: 'Cold iron', bypass: 'cold iron', note: 'Overcomes DR/cold iron (fey, many demons).' },
  { id: 'silver', name: 'Alchemical silver', dmg: -1, bypass: 'silver', note: 'Overcomes DR/silver (lycanthropes, many devils and undead). −1 damage per hit, never below 1.' },
  { id: 'mithral', name: 'Mithral', mw: true, weight: 0.5, bypass: 'silver', note: 'Half weight, overcomes DR/silver. Counts as masterwork.' },
  { id: 'darkwood', name: 'Darkwood', mw: true, weight: 0.5, note: 'Wooden weapons only: half weight. Counts as masterwork.' },
];
export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

/**
 * Special abilities, with the extra enhancement bonus each costs (`plus`).
 *   dice/type    extra damage on every hit        crit/ctype   extra damage on a critical hit, once per multiplier step (x2: 1, x3: 2, x4: 3)
 *   cond         only against something: the sheet offers a switch, off by default. condDice is its extra damage, condAtk/condDmg its bonus.
 *   keen         doubles the threat range         speed        one extra attack at the best bonus (not with Haste)
 */
export const ABILITIES = [
  { id: 'flaming', name: 'Flaming', plus: 1, dice: '1d6', type: 'fire' },
  { id: 'flamingburst', name: 'Flaming burst', plus: 2, dice: '1d6', type: 'fire', crit: '1d10', ctype: 'fire' },
  { id: 'frost', name: 'Frost', plus: 1, dice: '1d6', type: 'cold' },
  { id: 'icyburst', name: 'Icy burst', plus: 2, dice: '1d6', type: 'cold', crit: '1d10', ctype: 'cold' },
  { id: 'shock', name: 'Shock', plus: 1, dice: '1d6', type: 'electricity' },
  { id: 'shockingburst', name: 'Shocking burst', plus: 2, dice: '1d6', type: 'electricity', crit: '1d10', ctype: 'electricity' },
  { id: 'corrosive', name: 'Corrosive', plus: 1, dice: '1d6', type: 'acid' },
  { id: 'corrosiveburst', name: 'Corrosive burst', plus: 2, dice: '1d6', type: 'acid', crit: '1d10', ctype: 'acid' },
  { id: 'thundering', name: 'Thundering', plus: 1, crit: '1d8', ctype: 'sonic', note: 'Sonic damage on a critical hit, and the target must save or be deafened.' },
  { id: 'keen', name: 'Keen', plus: 1, keen: true, note: 'Doubles the threat range. Piercing and slashing only.' },
  { id: 'speed', name: 'Speed', plus: 3, speed: true, note: 'One extra attack at your best bonus. Does not stack with Haste.' },
  { id: 'holy', name: 'Holy', plus: 2, cond: 'vs evil', condDice: '2d6', ctype: 'holy', note: '2d6 against evil creatures; counts as good for DR.' },
  { id: 'unholy', name: 'Unholy', plus: 2, cond: 'vs good', condDice: '2d6', ctype: 'unholy', note: '2d6 against good creatures; counts as evil for DR.' },
  { id: 'axiomatic', name: 'Axiomatic', plus: 2, cond: 'vs chaotic', condDice: '2d6', ctype: 'axiomatic', note: '2d6 against chaotic creatures; counts as lawful for DR.' },
  { id: 'anarchic', name: 'Anarchic', plus: 2, cond: 'vs lawful', condDice: '2d6', ctype: 'anarchic', note: '2d6 against lawful creatures; counts as chaotic for DR.' },
  { id: 'bane', name: 'Bane', plus: 1, cond: 'vs its creature type', condDice: '2d6', condAtk: 2, condDmg: 2, note: 'Against the chosen creature type: +2 enhancement to attack and damage, and +2d6 damage.' },
  { id: 'merciful', name: 'Merciful', plus: 1, dice: '1d6', type: 'nonlethal', note: '+1d6 damage, and all of the weapon’s damage is nonlethal. A swift action turns it off.' },
  { id: 'wounding', name: 'Wounding', plus: 2, note: 'Each hit causes 1 point of bleed damage.' },
  { id: 'vicious', name: 'Vicious', plus: 1, dice: '2d6', type: 'vicious', note: '+2d6 damage on a hit, and you take 1d6 yourself (not counted here).' },
  { id: 'disruption', name: 'Disruption', plus: 2, note: 'Bludgeoning only. An undead you hit must pass a Will save or be destroyed.' },
  { id: 'ghosttouch', name: 'Ghost touch', plus: 1, note: 'Hits incorporeal creatures with no miss chance.' },
  { id: 'brilliant', name: 'Brilliant energy', plus: 4, note: 'Ignores armor, shield and natural armor bonuses to AC (not constructs, objects or undead).' },
  { id: 'vorpal', name: 'Vorpal', plus: 5, note: 'A confirmed natural 20 threat cuts off the head. Slashing only.' },
  { id: 'defending', name: 'Defending', plus: 1, note: 'Shift up to the weapon’s enhancement bonus from attack to AC each round.' },
  { id: 'distance', name: 'Distance', plus: 1, note: 'Doubles the range increment. Ranged weapons only.' },
  { id: 'returning', name: 'Returning', plus: 1, note: 'A thrown weapon flies back to your hand.' },
  { id: 'seeking', name: 'Seeking', plus: 1, note: 'Ranged only: negates the miss chance from concealment.' },
  { id: 'throwing', name: 'Throwing', plus: 1, note: 'Can be thrown, with a 10 ft. range increment.' },
  { id: 'dancing', name: 'Dancing', plus: 4, note: 'Fights on its own for 4 rounds.' },
  { id: 'spellstoring', name: 'Spell storing', plus: 1, note: 'Holds one spell of up to 3rd level.' },
  { id: 'mightycleaving', name: 'Mighty cleaving', plus: 1, note: 'Cleave, Great Cleave and Vital Strike behave as if you had more of the feat’s bonus.' },
];
export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

const num = v => parseFloat(v) || 0;

/** "19-20/x2", "×3", "20/x3" -> { min, mult } (min = lowest threatening roll). Empty or unreadable text gives null. */
export function parseCrit(text) {
  const s = String(text ?? '').replace(/[–—−]/g, '-');
  const mult = s.match(/[x×]\s*(\d+)/i);
  const range = s.match(/(\d+)\s*-\s*20/);
  const single = !range && /^\s*20\s*(\/|$)/.test(s);
  if (!mult && !range && !single) return null;
  return { min: range ? +range[1] : 20, mult: mult ? +mult[1] : 2 };
}

/** Keen (or Improved Critical) doubles how many numbers threaten: 20 becomes 19-20, 19-20 becomes 17-20, 18-20 becomes 15-20. */
export const doubleThreat = min => Math.max(2, 21 - (21 - min) * 2);

export const critLabel = ({ min, mult }) => `${min === 20 ? '20' : min + '-20'}/×${mult}`;

/** Multiply every die count and flat number in a damage expression ("1d8+2" x2 -> "2d8+4"). Empty if it is not dice. */
export function multiplyDice(expr, n) {
  const s = String(expr ?? '').replace(/\s/g, '');
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(s)) return '';
  return s.replace(/(\d*)d(\d+)|(\d+)/g, (m, cnt, sides, flat) => (sides ? `${(cnt === '' ? 1 : +cnt) * n}d${sides}` : String(+flat * n)));
}

/**
 * Everything a weapon's enchantments and material change. `w` is the saved weapon.
 * Returns { enhEffective, mw, atkMasterwork, dmgPenalty, weightMult, bypass, keen, speed, extras: [{label, dice, type}],
 *   critExtras(mult) -> the same, conds: [{id, name, label, on, atk, dmg, dice}], summary, warn }
 */
export function weaponFx(w) {
  const mat = MATERIAL_BY_ID[w.material || ''] || MATERIAL_BY_ID[''];
  const fx = (w.fx || []).map(f => ({ ...ABILITY_BY_ID[f.id], on: !!f.on })).filter(f => f.id);
  const enh = Math.max(0, num(w.enh));
  const total = enh + fx.reduce((s, f) => s + f.plus, 0);
  const mw = !!w.mw || !!mat.mw || enh > 0;
  const extras = [], conds = [];
  let keen = !!w.improvedCritical, speed = false;
  for (const f of fx) {
    if (f.dice) extras.push({ label: f.name, dice: f.dice, type: f.type });
    if (f.keen) keen = true;
    if (f.speed) speed = true;
    if (f.cond) {
      conds.push({ id: f.id, name: f.name, label: f.cond, on: f.on, atk: f.condAtk || 0, dmg: f.condDmg || 0, dice: f.condDice || '' });
      if (f.on && f.condDice) extras.push({ label: `${f.name} (${f.cond})`, dice: f.condDice, type: f.ctype });
    }
  }
  const critExtras = mult => fx.filter(f => f.crit).map(f => ({ label: f.name, dice: multiplyDice(f.crit, Math.max(1, mult - 1)), type: f.ctype }));
  const bits = [];
  if (enh || fx.length) bits.push(`+${total} ${fx.map(f => f.name.toLowerCase()).join(' ')}`.trim());
  if (mat.id) bits.push(mat.name.toLowerCase());
  else if (w.mw && !enh) bits.push('masterwork');
  return {
    enhEffective: total, mw, atkMasterwork: !enh && mw ? 1 : 0,
    dmgPenalty: mat.dmg || 0, weightMult: mat.weight || 1, bypass: mat.bypass || '',
    keen, speed, extras, critExtras, conds,
    summary: bits.join(' · '),
    warn: total > 10 ? `An enhancement bonus above +10 is not allowed (this is +${total}).` : fx.length && !enh ? 'Special abilities need at least a +1 enhancement bonus.' : '',
  };
}

/** "1d6 fire (Flaming), ..." for a tooltip. */
export const extrasText = list => list.map(x => `${x.dice}${x.type ? ' ' + x.type : ''} (${x.label})`).join(', ');
