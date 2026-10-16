// Dice rolling in the notation of the Tad Discord bot ("roll 2d6+5", "roll adv d20+5", "roll 3xd20"), and its reply format.
// Pure (no DOM): `rng` is a function returning a float in [0, 1), so tests can fix the dice.

import { multiplyDice } from './weaponfx.js';

export const MAX_REPEAT = 20, MAX_DICE = 100, MAX_SIDES = 1000;
export const CRIT = '💥', FAIL = '💀';

const TERM = /([+-]?)(\d*)d(\d+)|([+-]\d+)/g;

/** Parse like Tad's parse_dice_notation: terms are [count, sides] (sides 0 = flat modifier), plus repeat/adv/dis. Throws on bad input. */
export function parseDice(text) {
  let s = String(text ?? '').toLowerCase();
  // dis is taken out first so the long form "disadvantage" is not also read as "adv" (Tad gets this wrong).
  const dis0 = /dis/.test(s);
  s = s.replace(/disadvantage|dis/g, ' ');
  let adv = /adv/.test(s), dis = dis0;
  s = s.replace(/advantage|adv/g, ' ').replace(/\s+/g, '');
  if (adv && dis) adv = dis = false;
  let repeat = 1;
  const rm = s.match(/(\d+)x/);
  if (rm) { repeat = +rm[1]; s = s.replace(rm[0], ''); }
  if (repeat < 1 || repeat > MAX_REPEAT) throw new Error(`Repeat must be 1 to ${MAX_REPEAT}`);
  const terms = [];
  for (const m of s.matchAll(TERM)) {
    if (m[4] !== undefined) { terms.push([+m[4], 0]); continue; }
    const n = (m[2] === '' ? 1 : +m[2]) * (m[1] === '-' ? -1 : 1), sides = +m[3];
    if (sides < 1) throw new Error('Dice must have at least 1 side.');
    if (sides > MAX_SIDES || Math.abs(n) > MAX_DICE) throw new Error(`Up to ${MAX_DICE} dice with ${MAX_SIDES} sides`);
    terms.push([n, sides]);
  }
  if (!terms.length) throw new Error('No dice found');
  return { terms, repeat, adv, dis };
}

/** One evaluation: signed die values, a crit marker per die (d20 only), the flat modifier and the total. */
export function rollTerms(terms, rng = Math.random) {
  const raw = [], marks = [];
  let modifier = 0;
  for (const [n, sides] of terms) {
    if (sides === 0) { modifier += n; continue; }
    const sgn = n < 0 ? -1 : 1;
    for (let i = 0; i < Math.abs(n); i++) {
      const face = 1 + Math.floor(rng() * sides);
      raw.push(sgn * face);
      marks.push(sides === 20 ? (face === 20 ? CRIT : face === 1 ? FAIL : '') : '');
    }
  }
  return { raw, marks, modifier, total: raw.reduce((a, b) => a + b, 0) + modifier };
}

const list = (raw, marks = []) => '[' + raw.map((v, i) => v + (marks[i] ? ' ' + marks[i] : '')).join(', ') + ']';
const mod = m => (m ? ` ${m > 0 ? '+' : '-'}${Math.abs(m)}` : '');

function once(p, rng) {
  if (!p.adv && !p.dis) {
    const r = rollTerms(p.terms, rng);
    return { line: `Roll result: ${list(r.raw, r.marks)}${mod(r.modifier)} **Total ${r.total}**`, total: r.total };
  }
  const a = rollTerms(p.terms, rng), b = rollTerms(p.terms, rng);
  const pickB = p.adv ? b.total > a.total : b.total < a.total; // ties keep the first, like Tad
  const r = pickB ? b : a;
  return {
    line: `Roll 1: ${list(a.raw)} • Roll 2: ${list(b.raw)}\n${p.adv ? 'Highest' : 'Lowest'} roll: ${list(r.raw, r.marks)}${mod(r.modifier)} **Total ${r.total}**`,
    total: r.total,
  };
}

/**
 * Roll `expr` for `who` and give the Discord message (Tad's layout) plus a one-line summary for the sheet.
 * `label` (e.g. "Fortitude save") is added to the first line.
 */
export function rollMessage(who, expr, { label = '', rng = Math.random } = {}) {
  const p = parseDice(expr);
  const head = `**${who}** rolled ${String(expr).trim()}${label ? ` (${label})` : ''}`;
  const rolls = Array.from({ length: p.repeat }, () => once(p, rng));
  const text = p.repeat === 1
    ? `${head}\n${rolls[0].line}`
    : rolls.map((r, i) => `**Roll ${i + 1}/${p.repeat}:** ${head}\n${r.line}`).join('\n\n');
  const totals = rolls.map(r => r.total);
  return { text, totals, short: `${label || expr}: ${totals.join(', ')}` };
}

/** Several labelled rolls in one Discord message (a full attack): each is {expr, label}. */
export function rollMany(who, items, { rng = Math.random } = {}) {
  const parts = items.map(it => rollMessage(who, it.expr, { label: it.label, rng }));
  return { text: parts.map(p => p.text).join('\n\n'), totals: parts.flatMap(p => p.totals), short: parts.map(p => p.short).join(' · ') };
}

/** "+7" / "-1" / "" to append to a d20 expression. */
export const bonusText = n => { n = Math.trunc(Number(n) || 0); return n ? (n > 0 ? '+' : '-') + Math.abs(n) : ''; };

/** A d20 expression with a situational modifier added ("d20+7" and -4 give "d20+7-4"); other dice are left alone. */
export const addMods = (expr, n) => (n && /^d20/.test(expr) ? expr + bonusText(n) : expr);

/** The display name a roll is posted under on Discord: "Fumu · Stealth (-4 not proficient)", cut to the 80 characters Discord allows. */
export const sendName = (who, label) => {
  const name = label ? `${who} · ${label}` : who;
  return name.length > 80 ? name.slice(0, 79) + '…' : name;
};

/** "(-4 not proficient, -2 2nd range increment)" for the roll's label. */
export const modsLabel = mods => '(' + mods.map(m => bonusText(m.n) + ' ' + m.label).join(', ') + ')';

/**
 * Situational, one-roll modifiers offered in the roll window (flanking, prone, dazzled and the like). Things that last or change your AC or damage
 * (charging, fighting defensively, shaken, sickened, power attack...) are presets on the Buffs & Conditions tab instead and apply by themselves.
 * Range increments are one group: only one applies. "for: 'attack'" ones are only offered on attack rolls.
 */
export const MOD_PRESETS = [
  { label: 'not proficient', spell: false, n: -4, for: 'attack', tip: 'Using a weapon you are not proficient with: -4 to hit' },
  { label: '2nd range increment', spell: false, n: -2, group: 'range', for: 'attack', tip: 'Each range increment past the first is -2 to hit' },
  { label: '3rd range increment', spell: false, n: -4, group: 'range', for: 'attack' },
  { label: '4th range increment', spell: false, n: -6, group: 'range', for: 'attack' },
  { label: '5th range increment', spell: false, n: -8, group: 'range', for: 'attack' },
  { label: 'flanking', kind: 'melee', n: 2, for: 'attack', tip: 'You and an ally threaten the target from opposite sides: +2 to melee attacks' },
  { label: 'you are prone', kind: 'melee', n: -4, for: 'attack', tip: 'Making a melee attack while prone: -4' },
  { label: 'dazzled', n: -1, for: 'attack', tip: '-1 on attacks (and sight-based Perception)' },
  { label: 'higher ground', kind: 'melee', n: 1, for: 'attack', tip: 'Melee against a lower foe: +1' },
  { label: 'target prone (melee)', kind: 'melee', n: 4, for: 'attack', tip: '+4 to melee attacks against a prone target' },
  { label: 'target prone (ranged)', kind: 'ranged', n: -4, for: 'attack', tip: '-4 to ranged attacks against a prone target' },
  { label: 'firing into melee', kind: 'ranged', n: -4, for: 'attack', tip: 'Ranged attack into a melee without Precise Shot: -4' },
  { label: 'attacker unseen', n: 2, for: 'attack', tip: 'Invisible, or the target cannot see you: +2' },
  { label: 'improvised weapon', spell: false, n: -4, for: 'attack', tip: 'Using something that is not a weapon: -4' },
  // Fighting with two weapons: -6 / -10, or -4 / -8 when the off-hand weapon is light; the Two-Weapon Fighting feat makes it -4 / -4 (-2 / -2 with a light off-hand)
  { label: 'two-weapon: main hand', spell: false, n: -6, nWith: -4, group: 'twf', for: 'attack', tip: 'Off-hand weapon is not light. Two-Weapon Fighting makes it -4' },
  { label: 'two-weapon: off hand', spell: false, n: -10, nWith: -4, group: 'twf', for: 'attack', tip: 'Off-hand weapon is not light. Two-Weapon Fighting makes it -4' },
  { label: 'two-weapon (light off-hand): main hand', spell: false, n: -4, nWith: -2, group: 'twf', for: 'attack', tip: 'Off-hand weapon is light. Two-Weapon Fighting makes it -2' },
  { label: 'two-weapon (light off-hand): off hand', spell: false, n: -8, nWith: -2, group: 'twf', for: 'attack', tip: 'Off-hand weapon is light. Two-Weapon Fighting makes it -2' },
  { label: 'squeezing', n: -4, for: 'attack', tip: 'Fighting in a space too narrow for you' },
  { label: 'strong wind (ranged)', spell: false, kind: 'ranged', n: -2, for: 'attack', tip: 'Strong wind: -2 to ranged attacks (-4 in a severe wind)' },
  { label: 'aid another', n: 2, tip: 'An ally helped you' },
  { label: 'favorable conditions', n: 2, tip: 'The GM says circumstances help (skills and checks)' },
  { label: 'unfavorable conditions', n: -2, tip: 'The GM says circumstances hurt (skills and checks)' },
  { label: 'no tools', n: -2, tip: 'A skill that needs tools, done without them' },
];

/** A preset with the Two-Weapon Fighting feat's smaller penalty when the character has it. */
export const adjustPreset = (m, hasTwf) => (hasTwf && m.nWith != null ? { ...m, n: m.nWith } : m);

/**
 * The presets that make sense for this roll: attack rolls get all of them, other d20 rolls only the general ones.
 * For a spell ({kind: 'melee'|'ranged'|null}) the weapon-only ones (proficiency, range increments, two-weapon...) are left out,
 * and a melee or ranged touch attack only gets the ones for that kind of attack.
 */
export const presetsFor = (attack, spell = null) => MOD_PRESETS.filter(m => (attack || m.for !== 'attack')
  && (!spell || (m.spell !== false && (!spell.kind || !m.kind || m.kind === spell.kind))));

/**
 * Sneak attack dice from class levels (they add up across classes): rogue and ninja have 1d6 at 1st level and one more every odd level,
 * a slayer has 1d6 at 3rd level and one more every 3 levels.
 */
export const sneakDice = (levels = {}) => Math.ceil((levels.Rogue || 0) / 2) + Math.ceil((levels.Ninja || 0) / 2) + Math.floor((levels.Slayer || 0) / 3);

/** An investigator's studied strike: 1d6 at 4th level and one more every 2 levels. */
export const studiedDice = (levels = {}) => ((levels.Investigator || 0) >= 4 ? Math.floor(levels.Investigator / 2) - 1 : 0);

/**
 * What can add to or change a weapon's damage on the roll window: flat bonuses (`n`), extra dice (`dice`) and Vital Strike (`extraBase`: that many more
 * copies of the weapon's own dice). Ones with the same `group` replace each other. Class based ones appear only for characters that have the class.
 * Things that last or are always on (Power Attack, rage, bless, enchantments) are not here: they are buffs and weapon enchantments and apply by themselves.
 */
export function damagePresets(levels = {}, bab = 0) {
  const out = [];
  const sneak = sneakDice(levels);
  const studied = studiedDice(levels);
  // `crit: true`: a plain damage bonus or the weapon's own dice, so a critical hit multiplies it. Sneak attack and studied strike are precision damage: never multiplied.
  if (sneak) out.push({ label: 'sneak attack', dice: sneak + 'd6', tip: 'The target is flat-footed, flanked or denied its Dex bonus. Precision damage: not multiplied on a critical hit.' });
  if (studied) out.push({ label: 'studied strike', dice: studied + 'd6', tip: 'You hit your studied target. Precision damage: not multiplied on a critical hit.' });
  if (levels.Paladin) out.push({ label: 'smite evil', n: levels.Paladin, crit: true, tip: 'Against evil: your paladin level in extra damage (double against evil outsiders, dragons and undead). Multiplied on a critical hit.' });
  if (levels.Antipaladin) out.push({ label: 'smite good', n: levels.Antipaladin, crit: true, tip: 'Against good: your antipaladin level in extra damage. Multiplied on a critical hit.' });
  if (levels.Cavalier) out.push({ label: 'challenge', n: levels.Cavalier, crit: true, tip: 'Against your challenged target: +1 damage per cavalier level. Multiplied on a critical hit.' });
  if (levels.Samurai) out.push({ label: 'challenge', n: levels.Samurai, crit: true, tip: 'Against your challenged target: +1 damage per samurai level. Multiplied on a critical hit.' });
  for (const n of [2, 4, 6, 8]) out.push({ label: 'favored enemy', n, crit: true, group: 'favored', tip: 'Against a favored enemy: +2, and +2 more for each time you have picked it. Multiplied on a critical hit.' });
  if (bab >= 6) out.push({ label: 'Vital Strike', extraBase: 1, crit: true, group: 'vital', tip: 'Standard action attack: roll the weapon\u2019s dice twice (all multiplied on a critical hit)' });
  if (bab >= 11) out.push({ label: 'Improved Vital Strike', extraBase: 2, crit: true, group: 'vital', tip: 'Roll the weapon\u2019s dice three times' });
  if (bab >= 16) out.push({ label: 'Greater Vital Strike', extraBase: 3, crit: true, group: 'vital', tip: 'Roll the weapon\u2019s dice four times' });
  return out;
}

/** What someone typed in the damage box: "4", "-2", "2d6", "+1d8" -> {n} or {dice}; null when it is neither. */
export function parseDamageMod(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, '');
  if (/^[+-]?\d+$/.test(t)) return { n: parseInt(t, 10) };
  const m = /^([+-]?)(\d*d\d+)$/i.exec(t);
  return m ? { dice: (m[1] === '-' ? '-' : '') + m[2].toLowerCase() } : null;
}

/**
 * The damage expression with the chosen modifiers added on the end ("1d8+5" with sneak attack 2d6 and smite 6 gives "1d8+5+2d6+6").
 * On a critical hit (`mult` is the weapon's multiplier) the ones marked `crit` are multiplied too: smite, challenge, favored enemy and the dice of Vital Strike.
 * Precision damage (sneak attack) and anything typed in by hand are added as they are.
 */
export function addDamageMods(expr, mods, base = '', mult = 1) {
  let out = String(expr);
  for (const m of mods || []) {
    const k = m.crit ? Math.max(1, mult) : 1;
    if (m.dice) out += (/^-/.test(m.dice) ? '' : '+') + m.dice;
    else if (m.extraBase) { const d = multiplyDice(base, m.extraBase * k); if (d) out += '+' + d; }
    else if (m.n) out += (m.n * k > 0 ? '+' : '-') + Math.abs(m.n * k);
  }
  return out;
}

/** "(+2d6 sneak attack, +6 smite evil)" for the roll's label. */
export const damageLabel = (mods, mult = 1) => '(' + mods.map(m => (m.dice ? (/^-/.test(m.dice) ? '' : '+') + m.dice : m.extraBase ? 'weapon dice \u00d7' + (m.extraBase * (m.crit ? mult : 1) + 1) : bonusText(m.n * (m.crit ? mult : 1))) + ' ' + m.label).join(', ') + ')';

const DIVISOR = { two: 2, three: 3, four: 4, five: 5 };
const divisor = w => (w ? DIVISOR[w.toLowerCase()] ?? (+w || 1) : 1);
// "/level", "per level", "damage/two levels", "per two caster levels": the text right after the dice, with no "+" or sentence break before it.
const PER_LEVEL = /^[^.;,()+/]{0,40}?(?:\/|\bper\s+)\s*(two|three|four|five|\d+)?\s*(?:caster\s+)?levels?\b/i;
// "+1/level", "+ 1 per level", "+1 damage/level": a flat bonus that grows with level.
const PLUS_LEVEL = /^[^.;,()+/]{0,30}?\+\s*(\d+)\s*(?:damage\s*)?(?:\/|\bper\s+)\s*(two|three|four|five|\d+)?\s*(?:caster\s+)?levels?\b/i;

/**
 * Best guess at a spell's dice from its text (the compendium's one-line summary or the full description) and the caster level.
 * Handles the shorthand the summaries use: "1d6/level (max 10d6)", "1d8/two levels", "2d8 damage +1/level (max +10)",
 * "1d6 points of fire damage per caster level". Only a starting point: the spell roll window lets the player edit it. '' when no dice are found.
 */
export function guessSpellDice(text, cl) {
  const t = String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const m = /(\d*)d(\d+)/i.exec(t);
  if (!m) return '';
  const n = m[1] === '' ? 1 : +m[1], sides = +m[2];
  const rest = t.slice(m.index + m[0].length, m.index + m[0].length + 140);
  const level = Math.max(0, Math.trunc(Number(cl) || 0));
  const plus = PLUS_LEVEL.exec(rest);
  const flat = !plus && /^\s*\+\s*(\d+)\s*(?:points? of |hit points|damage|hp)/i.exec(rest); // "1d4+1 damage"
  if (flat) return `${n}d${sides}+${flat[1]}`;
  if (plus) {
    let bonus = (+plus[1]) * Math.floor(level / divisor(plus[2]));
    const cap = /\bmax(?:imum)?\.?\s*\+\s*(\d+)/i.exec(rest);
    if (cap) bonus = Math.min(bonus, +cap[1]);
    return `${n}d${sides}${bonus ? '+' + bonus : ''}`;
  }
  const per = PER_LEVEL.exec(rest);
  if (per) {
    let count = n * Math.max(1, Math.floor(level / divisor(per[1])));
    const cap = /\bmax(?:imum)?\.?\s*(\d+)d\d+/i.exec(rest);
    if (cap) count = Math.min(count, +cap[1]);
    return `${count}d${sides}`;
  }
  return `${n}d${sides}`;
}
