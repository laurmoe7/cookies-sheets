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
