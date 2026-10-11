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
  const h = String(html ?? ''), cut = h.indexOf('</dl>');
  const opening = plain(cut >= 0 ? h.slice(cut) : h).slice(0, 450);
  const text = String(summary ?? '') + ' ' + opening;
  if (/<dt>Effect<\/dt>\s*<dd>\s*(?:one |a )?rays?\b/i.test(h) || /\branged touch attack\b/i.test(text)) return 'ranged';
  if (/\btouch attack\b/i.test(text)) return 'melee';
  return null;
}

/**
 * @param entry {summary, html, meta:{save, sr}} from /api/entry, or null for a custom spell
 * @param cl    caster level
 * @returns {dice, kind: 'damage'|'healing'|'', attack: 'ranged'|'melee'|null, save, sr}
 */
export function spellInfo(entry, cl) {
  if (!entry) return { dice: '', kind: '', attack: null, save: null, sr: false };
  const summary = entry.summary || '', meta = entry.meta || {};
  const attack = attackType(summary, entry.html);
  const body = plain(entry.html), healing = /\b(cures?|cured|heals?|restores?)\b/i;
  // Dice in the summary are the spell's own. Dice only in the description count when they sit next to damage or healing words (a duration of 1d6 rounds is not a roll).
  const near = /(?:\d*d\d+(?:(?!\d*d\d+)[^.]){0,60}\b(?:damage|hit points|hp)\b|\b(?:damage|cures?|heals?|restores?)\b(?:(?!\d*d\d+)[^.]){0,60}\d*d\d+)/i.exec(body);
  const dice = guessSpellDice(summary, cl) || (near ? guessSpellDice(body.slice(near.index, near.index + 200), cl) : '');
  const src = guessSpellDice(summary, cl) ? summary : near ? near[0] : '';
  const kind = !dice ? '' : healing.test(src) ? 'healing' : /damage|deals?|takes?|hit points|\bhp\b/i.test(src) ? 'damage' : '';
  return { dice, kind, attack, save: parseSave(meta.save), sr: /^yes/i.test(String(meta.sr ?? '').trim()) };
}
