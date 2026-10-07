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

// Features every class has that the class table does not list, so archetypes can replace them.
const EXTRA_FEATURES = { '*': [[1, 'Weapon and Armor Proficiency']], Wizard: [[1, 'Spellbook']], Arcanist: [[1, 'Spellbook']], Witch: [[2, 'Patron spells']] };

// Archetypes sometimes name a feature differently from the class table ("increase to bomb damage", "gunslinger's dodge deed").
// Each rule: when the target text matches `re`, it points at the table feature `to` (optionally at certain levels, or only the first).
const ALIASES = {
  '*': [
    { re: /proficien/, to: 'weapon and armor proficiency' },
    { re: /\bbonus (combat )?feats?\b/, to: 'bonus feat', first: true },
  ],
  Alchemist: [{ re: /poison immunity/, to: 'poison immunity' }, { re: /mutagen/, to: 'mutagen' }, { re: /bomb/, to: 'bomb', first: true }],
  Bard: [{ re: /versatile performance/, to: 'versatile performance' }, { re: /inspire competence/, to: 'inspire competence' }],
  Cleric: [{ re: /domain/, to: 'domains' }, { re: /channel energy/, to: 'channel energy' }],
  Druid: [{ re: /wild shape/, to: 'wild shape' }, { re: /spontaneous/, to: 'spontaneous casting' }],
  Gunslinger: [{ re: /(gun|firearm) training/, to: 'gun training' }, { re: /deed|deadeye|quick clear|expert loading|bleeding wound|lightning reload|startling shot|utility shot|menacing shot|evasive/, to: 'deeds', first: true }],
  Hunter: [{ re: /raise animal companion/, to: 'raise animal companion' }, { re: /speak with master/, to: 'speak with master' }],
  Inquisitor: [{ re: /teamwork feat/, to: 'teamwork feat' }, { re: /final judgment|true judg/, to: 'true judgment' }, { re: /judgment/, to: 'judgment' }],
  Monk: [{ re: /slow fall/, to: 'slow fall' }, { re: /combat reflex|deflect arrow|^dodge$|improved (trip|reposition)|weapon finesse|nimble move/, to: 'bonus feat', first: true }],
  Oracle: [{ re: /mystery.*bonus spell|bonus spell/, to: 'mystery spell' }, { re: /final revelation/, to: 'final revelation' }],
  Ranger: [
    { re: /fifth/, to: 'favored enemy', lv: [20] }, { re: /fourth/, to: 'favored enemy', lv: [15] },
    { re: /third/, to: 'favored enemy', lv: [10] }, { re: /second/, to: 'favored enemy', lv: [5] },
  ],
  Shaman: [{ re: /spirit magic/, to: 'spirit magic' }, { re: /wandering spirit/, to: 'wandering spirit' }, { re: /hex/, to: 'hex' }, { re: /familiar/, to: 'spirit animal' }],
  Skald: [{ re: /dirge of doom/, to: 'dirge of doom' }, { re: /inspired rage/, to: 'inspired rage' }, { re: /spell kenning/, to: 'spell kenning' }],
  Slayer: [{ re: /advanced slayer talent/, to: 'advanced talent' }],
  Sorcerer: [{ re: /bloodline feat/, to: 'bloodline feat' }, { re: /./, to: 'bloodline power' }],
  Paladin: [{ re: /smite/, to: 'smite evil' }],
  Witch: [{ re: /patron|^\d+(st|nd|rd|th)/, to: 'patron spells' }, { re: /familiar/, to: "witch's familiar" }, { re: /hex/, to: 'hex' }],
};

// Fragments the parser pulled out of a sentence that are not feature names at all.
const NOISE = /^(except|as well as|but |just as|both |feat( that)? (is )?currently|previous|abilities|class abilities|old ones|melee attack|lost or|summoner class features|increments|instances|iterations|some of)/;
/** True for archetype "replaces" text that is a sentence fragment or only changes class skills (handled separately), not a feature. */
export function isNoise(text) {
  const t = tidy(text);
  return NOISE.test(t) || t.split(' ').length > 8 || /\bclass skills?\b/.test(t);
}

/** Base features of a class up to level n: [{level, name}]. */
export function baseFeatures(def, n) {
  const out = [];
  for (let i = 0; i < Math.min(n, def?.levels?.length || 0); i++) {
    for (const name of splitSpecial(def.levels[i].special)) out.push({ level: i + 1, name: name[0].toUpperCase() + name.slice(1) });
  }
  for (const [lvl, name] of [...EXTRA_FEATURES['*'], ...(EXTRA_FEATURES[def?.name] || [])]) if (lvl <= n && def) out.unshift({ level: lvl, name });
  return out;
}

/** Which base features (up to level 20) one archetype target replaces. Tries the whole name, then its parts, then looser readings. */
export function findTargets(base, target, cls = '') {
  const lv = target.levels || [];
  const pick = (name, levels = lv) => base.filter(b => matches(name, b.name) && (!levels.length || levels.includes(b.level)));
  const whole = pick(target.name);
  if (whole.length) return whole;
  const parts = (target.parts || []).flatMap(p => pick(p));
  if (parts.length) return parts;
  // Looser: drop the class name and filler words ("oracle's mystery", "mutagen class", "bleeding wound deed").
  const text = tidy(target.text || target.name);
  const stripped = text.replace(/^[a-z]+'s /, '').replace(/ (class|deed|raging song|class features?)$/, '').trim();
  if (stripped && stripped !== text) { const hit = pick(stripped); if (hit.length) return hit; }
  for (const rule of [...(ALIASES[cls] || []), ...ALIASES['*']]) {
    if (!rule.re.test(text) && !rule.re.test(stripped)) continue;
    const hits = pick(rule.to, rule.lv || lv);
    if (hits.length) return rule.first ? [hits[0]] : hits;
  }
  return [];
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
      const hits = (f.replaces || []).flatMap(t => findTargets(all, t, cls));
      for (const h of hits) replacedBy.set(h, `${a.name}: ${f.name}`);
      for (const t of f.modifies || []) for (const h of findTargets(all, t, cls)) (h.modified ||= []).push(a.name);
      const level = f.level ?? (hits.length ? Math.min(...hits.map(h => h.level)) : 1);
      added.push({ cls, level, name: f.name, kind: 'archetype', archetype: a.name, html: f.html || '',
        // Named the way the archetype names them ("trap sense", not "Trap sense +1 … +6").
        replaces: (f.replaces || []).filter(t => findTargets(all, t, cls).length).map(t => t.text || t.name),
        unmatched: (f.replaces || []).filter(t => !findTargets(all, t, cls).length && !isNoise(t.text || t.name)).map(t => t.text || t.name) });
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
        for (const h of findTargets(all, t, def?.name)) {
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
