// Spells a class choice grants: cleric and druid domains, sorcerer and bloodrager bloodlines, oracle mysteries,
// witch patrons and shaman spirits. Pure, no DOM. The lists come from data/grants.json (tools/grants.py):
//   {kind: {name: {source, desc, spells: [{name, level, at?, note?}], domain?}}}
// The character keeps only what was chosen, c.grantChoices = {Class: [{kind, name}]}; the spells themselves go on the
// Spells tab with `granted: 'Fire domain'`, so a save never depends on the data file.

// Druids with the nature bond domain choose from these cleric domains (Core Rulebook) or a druid domain (Ultimate Magic).
const DRUID_CLERIC_DOMAINS = ['Air', 'Animal', 'Earth', 'Fire', 'Plant', 'Water', 'Weather'];

/** What each class chooses. `count` is how many; `optional` means it may be left out (a druid can bond with an animal instead). */
export const SOURCES = {
  Cleric: { title: 'Domains', one: 'domain', count: 2, kinds: ['domain', 'subdomain'],
    about: 'Two domains from your deity’s. Each gives a domain spell of every level you can cast, prepared in your extra domain slot.' },
  Druid: { title: 'Nature bond domain', one: 'domain', count: 1, optional: true, kinds: ['druidDomain', 'domain', 'subdomain'],
    about: 'Optional: a domain instead of an animal companion. It gives a domain spell of every level you can cast, prepared in your extra domain slot.' },
  Sorcerer: { title: 'Bloodline', one: 'bloodline', count: 1, kinds: ['bloodline'],
    about: 'Your bloodline adds a bonus spell known at 3rd level and every odd level after; they do not count against your spells known.' },
  Bloodrager: { title: 'Bloodline', one: 'bloodline', count: 1, kinds: ['bloodragerBloodline'],
    about: 'Your bloodline adds a bonus spell known at 7th, 10th, 13th and 16th level.' },
  Oracle: { title: 'Mystery', one: 'mystery', count: 1, kinds: ['mystery'],
    about: 'Your mystery adds a bonus spell known at 2nd level and every even level after; they do not count against your spells known.' },
  Witch: { title: 'Patron', one: 'patron', count: 1, kinds: ['patron'],
    about: 'Your patron adds a spell to your familiar at 2nd level and every even level after.' },
  Shaman: { title: 'Spirit', one: 'spirit', count: 1, kinds: ['spirit'],
    about: 'Your spirit’s spirit magic spells, one of each level you can cast, for your extra spirit magic slot.' },
};

const WORD = { domain: 'domain', subdomain: 'subdomain', druidDomain: 'domain', bloodline: 'bloodline', bloodragerBloodline: 'bloodline',
  mystery: 'mystery', patron: 'patron', spirit: 'spirit' };
const KIND_TITLE = { domain: 'Domains', subdomain: 'Subdomains', druidDomain: 'Druid domains', bloodline: 'Bloodlines',
  bloodragerBloodline: 'Bloodlines', mystery: 'Mysteries', patron: 'Patrons', spirit: 'Spirits' };

export const sourceOf = cls => SOURCES[cls] || null;
/** "Fire domain", "Ash subdomain", "Arcane bloodline". Stored on each granted spell as `granted`. */
export const grantLabel = ch => `${ch.name} ${WORD[ch.kind] || ch.kind}`;
export const kindTitle = kind => KIND_TITLE[kind] || kind;

/** The options a class may choose from, grouped by kind: [{kind, title, options: [{kind, name, source, desc, spells, domain?}]}]. */
export function optionsFor(data, cls) {
  const src = sourceOf(cls);
  if (!src || !data) return [];
  return src.kinds.map(kind => {
    let names = Object.keys(data[kind] || {});
    if (cls === 'Druid' && kind === 'domain') names = names.filter(n => DRUID_CLERIC_DOMAINS.includes(n));
    if (cls === 'Druid' && kind === 'subdomain') names = names.filter(n => DRUID_CLERIC_DOMAINS.includes(data.subdomain[n].domain));
    return { kind, title: kindTitle(kind), options: names.map(name => ({ kind, name, ...data[kind][name] })) };
  }).filter(g => g.options.length);
}

/** The first level of class `def` whose table casts spells of `level` (domain and spirit spells arrive then). */
export function firstCastLevel(def, level) {
  const i = (def?.levels || []).findIndex(r => r.spells_per_day?.[level] != null);
  return i < 0 ? Infinity : i + 1;
}

/**
 * The spells the character's choices for class `def` grant at caster level `lv` (the class's levels plus any prestige levels that advance it):
 * [{name, level, note?, granted, at}]. A spell with its own class level (bloodline "identify (3rd)") counts from then; the others from the
 * level the class can cast them. `choices` is c.grantChoices[cls].
 */
export function grantedSpells(data, def, choices, lv) {
  const out = [];
  for (const ch of choices || []) {
    const item = data?.[ch.kind]?.[ch.name];
    if (!item) continue;
    for (const sp of item.spells) {
      const at = sp.at ?? firstCastLevel(def, sp.level);
      if (at <= lv) out.push({ name: sp.name, level: sp.level, ...(sp.note ? { note: sp.note } : {}), granted: grantLabel(ch), at });
    }
  }
  return out;
}

const key = s => String(s.name || '').trim().toLowerCase();

/** The granted spells not on the spell list yet (by name and level). */
export function missingGranted(granted, spells) {
  const have = new Set((spells || []).map(s => `${key(s)}|${s.level}`));
  return granted.filter(g => !have.has(`${key(g)}|${g.level}`));
}

/**
 * Change one class's choices: returns the new spell list, without the spells the dropped choices had granted. Spells the player
 * added by hand (no `granted`), and granted spells of choices that stay, are kept.
 */
export function dropGranted(spells, oldChoices, newChoices) {
  const keep = new Set((newChoices || []).map(grantLabel));
  const gone = new Set((oldChoices || []).map(grantLabel).filter(l => !keep.has(l)));
  return (spells || []).filter(s => !s.granted || !gone.has(s.granted));
}

/** Spells that count against the "known" numbers: granted ones (bloodline, mystery bonus spells) do not. */
export const learnedSpells = spells => (spells || []).filter(s => !s.granted);
