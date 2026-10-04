// Class features by level, with archetypes applied: replaced features are swapped out and the
// archetype's own features slot in at their level. Archetype data comes from tools/archetypes.py and is
// stored on the character (c.archetypes[cls] = [{name, features, classSkills, diminished, ...}]) when chosen.

/** Split a class table "Special" cell on commas that aren't inside parentheses. */
export function splitSpecial(text) {
  const out = []; let depth = 0, cur = '';
  for (const ch of text || '') {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(x => x && !/^[—–-]$/.test(x));
}

/** The archetypes chosen for a class (tolerates the old free-text form). */
export function archetypesOf(c, cls) {
  const a = c.archetypes?.[cls];
  if (!a) return [];
  if (typeof a === 'string') return a.split(',').map(n => ({ name: n.trim() })).filter(x => x.name);
  return Array.isArray(a) ? a : [];
}

const singular = w => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') ? w.slice(0, -1) : w);
const tidy = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\([^)]*\)/g, '').replace(/-/g, ' ')
  .replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** Feature name without numbers: "Trap sense +1" -> "trap sense", "2nd favored enemy" -> "favored enemy". */
export function featureBase(name) {
  let f = tidy(name).replace(/^\d+(st|nd|rd|th)\s+/, '');
  f = f.replace(/\s*\d+d\d+.*$/, '').replace(/\s*[+−–]\s*\d+.*$/, '').replace(/\s*\d+\s*\/.*$/, '')
    .replace(/\s*\d+\s*ft\.?.*$/, '').replace(/\s+\d+$/, '').replace(/\s+[ivx]+$/, '');
  return f.split(' ').map((w, i, a) => (i === a.length - 1 ? singular(w) : w)).join(' ').trim();
}
/** Feature name keeping its number: "Armor training 1" -> "armor training 1", "Poison resistance +4" -> "poison resistance 4". */
export function featureNumbered(name) {
  return tidy(name).replace(/^\d+(st|nd|rd|th)\s+/, '').replace(/[+−–]\s*(\d)/g, '$1').replace(/\s+/g, ' ').trim();
}

function matches(target, baseName) {
  if (/\d/.test(target)) return featureNumbered(baseName) === featureNumbered(target);
  return featureBase(baseName) === featureBase(target);
}

/** Base features of a class up to level n: [{level, name}]. */
export function baseFeatures(def, n) {
  const out = [];
  for (let i = 0; i < Math.min(n, def?.levels?.length || 0); i++) {
    for (const name of splitSpecial(def.levels[i].special)) out.push({ level: i + 1, name: name[0].toUpperCase() + name.slice(1) });
  }
  return out;
}

/** Which base features (up to level 20) one archetype target replaces. Tries the whole name, then its parts. */
export function findTargets(base, target) {
  const lv = target.levels || [];
  const pick = name => base.filter(b => matches(name, b.name) && (!lv.length || lv.includes(b.level)));
  const whole = pick(target.name);
  if (whole.length) return whole;
  return (target.parts || []).flatMap(pick);
}

/**
 * Class features for every class the character has, with archetypes applied.
 * Returns [{cls, level, name, kind: 'class'|'archetype', archetype?, html?, replaces?: [names], modified?: [archetype names]}]
 */
export function classFeatures(c, classesByName) {
  const levels = {};
  for (const lu of c.levelUps || []) levels[lu.cls] = (levels[lu.cls] || 0) + 1;
  const out = [];
  for (const [cls, n] of Object.entries(levels)) out.push(...featuresFor(cls, n, archetypesOf(c, cls), classesByName[cls]));
  return out;
}

/** Features for one class at class level n with the given archetypes. */
export function featuresFor(cls, n, archs, def) {
  const all = baseFeatures(def, 20).map(f => ({ ...f, cls, kind: 'class' }));
  const replacedBy = new Map();
  const added = [];
  for (const a of archs) {
    for (const f of a.features || []) {
      if (f.advice) continue;
      const hits = (f.replaces || []).flatMap(t => findTargets(all, t));
      for (const h of hits) replacedBy.set(h, `${a.name}: ${f.name}`);
      for (const t of f.modifies || []) for (const h of findTargets(all, t)) (h.modified ||= []).push(a.name);
      const level = f.level ?? (hits.length ? Math.min(...hits.map(h => h.level)) : 1);
      added.push({ cls, level, name: f.name, kind: 'archetype', archetype: a.name, html: f.html || '',
        // Named the way the archetype names them ("trap sense", not "Trap sense +1 … +6").
        replaces: (f.replaces || []).filter(t => findTargets(all, t).length).map(t => t.text || t.name),
        unmatched: (f.replaces || []).filter(t => !findTargets(all, t).length).map(t => t.text || t.name) });
    }
  }
  const kept = all.filter(f => !replacedBy.has(f));
  return [...kept, ...added].filter(f => f.level <= n).sort((x, y) => x.level - y.level || (x.kind === 'archetype') - (y.kind === 'archetype'));
}

/** Base features that two or more chosen archetypes both replace: they can't be combined. */
export function archetypeConflicts(archs, def) {
  const all = baseFeatures(def, 20);
  const owner = new Map();
  const clashes = [];
  for (const a of archs) {
    for (const f of a.features || []) {
      for (const t of f.replaces || []) {
        for (const h of findTargets(all, t)) {
          const prev = owner.get(h);
          if (prev && prev !== a.name) clashes.push({ feature: h.name, level: h.level, archetypes: [prev, a.name] });
          else owner.set(h, a.name);
        }
      }
    }
  }
  return clashes;
}

/** The parts of an archetype the sheet stores on the character (everything the rules need, no extra). */
export function bakeArchetype(a) {
  return { id: a.id, name: a.name, source: a.source, description: a.description, features: a.features || [],
    classSkills: a.classSkills || { add: [], remove: [] }, diminished: !!a.diminished };
}
