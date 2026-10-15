// Racial traits by race, and alternate racial traits (the ones that replace a standard trait). Pure, except traitRaces.
import { api } from './api.js';

let races = null;
/** The races that have racial traits in the compendium, sorted (cached). */
export function traitRaces() {
  if (!races) races = api.search('', 'Racial Trait', 1000).then(rows => [...new Set(rows.map(r => r.sub).filter(Boolean))].sort((a, b) => a.localeCompare(b))).catch(() => { races = null; return []; });
  return races;
}

/** ['agile'] from the summary "Replaces agile." that the compendium gives an alternate racial trait; [] for any other entry. */
export function replacesOf(summary) {
  const m = /^Replaces (.+)\.$/.exec(String(summary || '').trim());
  return m ? m[1].split(/,\s*/).map(s => s.trim()).filter(Boolean) : [];
}

const key = s => String(s || '').toLowerCase().replace(/\((?:ex|su|sp)\)/g, '').replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * What adding an alternate trait that replaces `replaces` means for the traits already on the sheet:
 * `standard` are the traits it replaces (by name), `clashes` are alternate traits that already replace one of the same.
 */
export function replacedConflicts(traits, replaces) {
  const want = new Set((replaces || []).map(key));
  const standard = [], clashes = [];
  (traits || []).forEach((t, i) => {
    if (want.has(key(t.name))) standard.push(i);
    else if ((t.replaces || []).some(r => want.has(key(r)))) clashes.push(i);
  });
  return { standard, clashes };
}

const raceKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The compendium's name for a character's race ("Half-Elf" is "Half Elf" there), or '' if it has no racial traits. */
export async function compendiumRace(raceName) {
  const k = raceKey(raceName);
  return (await traitRaces()).find(r => raceKey(r) === k) || '';
}

/** True for an alternate racial trait: the compendium summarises it as "Replaces X." or "Alters X." */
export const isAlternate = entry => /^(Replaces|Alters) /.test(String(entry.summary || ''));

/** Does the replaced phrase from an alternate trait mean the standard trait `name`? "languages" and "kitsune normal languages" both mean Languages. */
const covers = (replaced, name) => key(replaced) === key(name) || key(replaced).endsWith(' ' + key(name));

/** The racial traits that remain after the chosen alternates have replaced theirs. */
export function remainingBaseline(baseline, chosen) {
  const gone = (chosen || []).flatMap(c => c.replaces || []);
  return baseline.filter(b => !gone.some(r => covers(r, b.name)));
}

/** The alternates that could take the place of the standard trait `name`, leaving out ones already chosen. */
export function alternativesFor(name, alternates, chosen = []) {
  const taken = new Set(chosen.map(c => c.name));
  return alternates.filter(a => !taken.has(a.name) && replacesOf(a.summary).some(r => covers(r, name)));
}

const racialCache = new Map();
/** {baseline, alternates} for a race, from the compendium (cached); null if the race has none. */
export async function racialTraitsOf(raceName) {
  const race = await compendiumRace(raceName);
  if (!race) return null;
  if (!racialCache.has(race)) racialCache.set(race, api.search('', 'Racial Trait', 500, 0, '=' + race).then(rows => ({
    baseline: rows.filter(r => !isAlternate(r)), alternates: rows.filter(isAlternate),
  })).catch(() => { racialCache.delete(race); return null; }));
  return racialCache.get(race);
}
