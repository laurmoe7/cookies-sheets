// What the spell roll window knows about a spell, worked out from its compendium entry (summary, description and the stored saving throw / spell resistance).
// Pure (no DOM), tested in tests/spellinfo.test.mjs.
import { guessSpellDice } from './dice.js';

const plain = html => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');

/** "Reflex half", "Will negates (harmless)", "none", "see text" -> {type, effect, harmless, label} or null when there is no save to roll for. */
export function parseSave(raw) {
  const s = String(raw ?? '').trim();
  if (!s || /^(none|no)\b/i.test(s)) return null;
  const type = /fort/i.test(s) ? 'Fortitude' : /ref/i.test(s) ? 'Reflex' : /will/i.test(s) ? 'Will' : null;
  const effect = /half/i.test(s) ? 'half' : /negates/i.test(s) ? 'negates' : /partial/i.test(s) ? 'partial' : /disbelief/i.test(s) ? 'disbelief' : '';
  const harmless = /harmless/i.test(s);
  const label = type ? `${type}${effect ? ' ' + effect : ''}${harmless ? ' (harmless)' : ''}` : 'see the spell text';
  return { type, effect, harmless, label };
}

/**
 * Whether casting needs an attack roll. Only the summary, the Effect line (a ray) and the opening of the description count: Fireball
 * mentions a ranged touch attack much later, for squeezing the bead through a narrow opening, and does not need one.
 */
export function attackType(summary, html) {
  return attackInfo(summary, html).attack;
}

/** {attack: 'ranged'|'melee'|null, touch}: touch is false for spells that call for an ordinary attack ("each discus requires a ranged attack to hit"). */
export function attackInfo(summary, html) {
  const h = String(html ?? ''), cut = h.indexOf('</dl>');
  const opening = plain(cut >= 0 ? h.slice(cut) : h).slice(0, 450);
  const text = String(summary ?? '') + ' ' + opening;
  if (/<dt>Effect<\/dt>\s*<dd>\s*(?:one |a )?rays?\b/i.test(h) || /\branged touch attack\b/i.test(text)) return { attack: 'ranged', touch: true };
  if (/\btouch attack\b/i.test(text)) return { attack: 'melee', touch: true };
  // Further down, only plain statements count: "This ray requires a ranged touch attack to hit", "Each discus requires a ranged attack", "Make a ranged attack roll".
  // Asides ("If you send the bead through a narrow passage, you must make a ranged attack roll": Fireball) and denials do not.
  const long = plain(cut >= 0 ? h.slice(cut) : h).slice(0, 1500);
  for (const sentence of long.split(/(?<=[.;])\s+/)) {
    if (/^\s*(if|when|unless|should)\b/i.test(sentence) || /\bnot\b|n't\b/i.test(sentence)) continue;
    const m = /\b(?:requires?|must (?:succeed|make))\b[^.]{0,40}?\b(ranged|melee)\b( touch)?[^.]{0,12}?\battack\b(?!s)/i.exec(sentence)
      || /^\s*(?:[A-Z][\w' ]{0,30} )?[Mm]akes? (?:an? )?(?:normal |single )?(ranged|melee)( touch)? attack\b(?!s)/.exec(sentence);
    if (m) return { attack: m[1].toLowerCase(), touch: !!m[2] };
  }
  return { attack: null, touch: false };
}

/**
 * @param entry {summary, html, meta:{save, sr}} from /api/entry, or null for a custom spell
 * @param cl    caster level
 * @returns {dice, kind: 'damage'|'healing'|'', attack: 'ranged'|'melee'|null, touch (the attack is a touch attack), save, sr}
 */
export function spellInfo(entry, cl) {
  if (!entry) return { dice: '', kind: '', attack: null, touch: false, save: null, sr: false };
  const summary = entry.summary || '', meta = entry.meta || {};
  const { attack, touch } = attackInfo(summary, entry.html);
  const body = plain(entry.html), healing = /\b(cures?|cured|heals?|restores?)\b/i;
  // Dice in the summary are the spell's own. Dice only in the description count when they sit next to damage or healing words (a duration of 1d6 rounds is not a roll).
  const near = /(?:\d*d\d+(?:(?!\d*d\d+)[^.]){0,60}\b(?:damage|hit points|hp)\b|\b(?:damage|cures?|heals?|restores?)\b(?:(?!\d*d\d+)[^.]){0,60}\d*d\d+)/i.exec(body);
  const dice = guessSpellDice(summary, cl) || (near ? guessSpellDice(body.slice(near.index, near.index + 200), cl) : '');
  const src = guessSpellDice(summary, cl) ? summary : near ? near[0] : '';
  const kind = !dice ? '' : healing.test(src) ? 'healing' : /damage|deals?|takes?|hit points|\bhp\b/i.test(src) ? 'damage' : '';
  return { dice, kind, attack, touch, save: parseSave(meta.save), sr: /^yes/i.test(String(meta.sr ?? '').trim()) };
}
