// Pure part of the sheet search: builds an index from a character and ranks matches.
import { classFeatures } from './features.js';

export const lc = s => String(s ?? '').toLowerCase();

/** Everything searchable on the current character: {kind, name, tab, text}. */
export function buildIndex(c, classesByName = {}) {
  const out = [];
  const add = (kind, name, tab, text = '') => { if (name) out.push({ kind, name: String(name), tab, text: String(text || '') }); };
  for (const s of c.skills || []) add('Skill', s.sub ? `${s.name} (${s.sub})` : s.name, 'skills');
  for (const [key, kind] of [['feats', 'Feat'], ['traits', 'Trait'], ['specials', 'Ability']]) {
    for (const f of c[key] || []) add(kind, f.name, 'feats', f.notes);
  }
  try { for (const f of classFeatures(c, classesByName)) add('Class feature', f.name, 'feats', f.archetype ? `${f.archetype} archetype` : f.cls); } catch { /* data not loaded */ }
  for (const [cls, book] of Object.entries(c.spellbooks || {})) {
    for (const sp of book.spells || []) add('Spell', sp.name, 'spells', `${cls} ${sp.level}`);
  }
  for (const w of c.weapons || []) add('Weapon', w.name, 'overview');
  for (const a of c.armor || []) add('Armor', a.name, 'gear');
  for (const g of c.gear || []) add('Gear', g.name, 'gear', g.notes);
  for (const m of c.modifiers || []) add('Buff', m.name, 'buffs', m.note);
  for (const k of c.companions || []) add('Companion', k.name, 'companions', k.species || k.form || '');
  if (c.quickNotes) add('Notes', 'Overview notes', 'overview', c.quickNotes);
  if (c.notes) add('Notes', 'Bio & notes', 'bio', c.notes);
  return out;
}

export function searchIndex(index, q) {
  q = lc(q).trim();
  if (!q) return [];
  const scored = [];
  for (const e of index) {
    const n = lc(e.name), t = lc(e.text);
    const score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : t.includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ ...e, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, 14);
}
