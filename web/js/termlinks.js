// Turns ability names in stat-block text ("plus attach", "scent", "improved evasion") into links that open
// the compendium entry. Pure: returns escaped HTML.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const title = t => t.replace(/(^|[ -])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/ Of /g, ' of ').replace(/ Its /g, ' its ').replace(/ With /g, ' with ');

// Monster abilities first; familiar abilities are class features.
const MONSTER = ['attach', 'grab', 'trip', 'poison', 'bleed', 'constrict', 'rake', 'pounce', 'trample', 'swallow whole', 'blood drain', 'low-light vision',
  'scent', 'tremorsense', 'blindsense', 'blindsight', 'fast healing', 'regeneration', 'amphibious', 'hold breath', 'web', 'burn', 'disease', 'fear aura',
  'rend', 'sprint', 'frightful presence', 'breath weapon', 'spell-like abilities', 'lunge', 'powerful charge', 'paralysis', 'energy drain', 'camouflage',
  'compression', 'keen scent', 'natural invisibility', 'sound mimicry', 'undersized weapons', 'woodland stride', 'ferocity', 'change shape', 'wounding'];
const FEATURE = ['improved evasion', 'evasion', 'empathic link', 'share spells', 'deliver touch spells', 'speak with master', 'alertness',
  'speak with animals of its kind', 'hide in plain sight', 'uncanny dodge'];
const OTHER = { 'improved grab': ['Grab', 'Monster Ability'], darkvision: ['Darkvision', 'Rules'], 'spider climb': ['Spider Climb', 'Spell'] };

const TERMS = new Map();
for (const t of MONSTER) TERMS.set(t, [title(t), 'Monster Ability']);
for (const t of FEATURE) TERMS.set(t, [title(t), 'Class Feature']);
for (const [t, v] of Object.entries(OTHER)) TERMS.set(t, v);

// Longest names first, so "improved evasion" wins over "evasion".
const ORDER = [...TERMS.keys()].sort((a, b) => b.length - a.length);
const RE = new RegExp(`(?<![\\w-])(${ORDER.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'gi');

/** HTML-escape `text` and wrap every known ability name in a compendium link (underlined, clickable). */
export function linkTerms(text) {
  const src = String(text ?? '');
  let out = '', last = 0;
  for (const m of src.matchAll(RE)) {
    const [name, cat] = TERMS.get(m[1].toLowerCase());
    out += esc(src.slice(last, m.index)) + `<a href="#" class="ref" data-entry="${esc(name)}" data-cat="${cat}">${esc(m[1])}</a>`;
    last = m.index + m[1].length;
  }
  return out + esc(src.slice(last));
}
