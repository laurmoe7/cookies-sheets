// A spell's stat block laid out to be read at a glance: school on top, the class levels as chips, the five numbers you check mid-fight
// (casting time, range, duration, saving throw, spell resistance) as a row of labelled cells, then the rest (components, area, target...) as plain rows.
// Pure string work (no DOM), tested in tests/spellstat.test.mjs. Anything that does not look like a spell stat block is left alone.

const DL = /<dl class="stat">([\s\S]*?)<\/dl>/;
const PAIR = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
const FACTS = [['Casting Time', 'Casting time'], ['Range', 'Range'], ['Duration', 'Duration'], ['Saving Throw', 'Saving throw'], ['Spell Resistance', 'Spell resistance']];
const text = h => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = s => s.replace(/(^|[\s/])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** "Antipaladin: 1; Cleric: 1" or "antipaladin 1, cleric/oracle 1, sorcerer/wizard 3" -> [['Antipaladin', 1], ...] */
export function parseLevels(raw) {
  const out = [];
  for (const m of text(raw).matchAll(/([A-Za-z][A-Za-z/ '-]*?):?\s*(\d)\b/g)) out.push([cap(m[1].trim()), +m[2]]);
  return out;
}

export function spellStatHtml(html) {
  const m = DL.exec(String(html ?? ''));
  if (!m) return String(html ?? '');
  const pairs = [...m[1].matchAll(PAIR)].map(p => [text(p[1]), p[2].trim()]);
  const get = k => pairs.find(([n]) => n === k)?.[1];
  if (get('School') === undefined || get('Casting Time') === undefined) return String(html);
  const used = new Set(['School', ...FACTS.map(f => f[0])]);

  const levels = parseLevels(get('Level') ?? '');
  if (levels.length) used.add('Level');
  const byLevel = new Map();
  for (const [cls, lv] of levels) byLevel.set(lv, [...(byLevel.get(lv) || []), cls]);
  const levelRows = [...byLevel].sort((a, b) => a[0] - b[0]).map(([lv, list]) =>
    `<div class="ss-level"><span class="ss-lab">Level ${lv}</span>${list.map(c => `<span class="ss-chip">${esc(c)}</span>`).join('')}</div>`).join('');

  const cells = FACTS.filter(([k]) => get(k)).map(([k, label]) => `<div class="ss-cell"><span class="ss-lab">${label}</span><b>${get(k)}</b></div>`).join('');
  const rows = pairs.filter(([k, v]) => !used.has(k) && text(v)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');

  const block = `<div class="spell-stat"><div class="ss-school">${get('School')}</div>${levelRows}<div class="ss-facts">${cells}</div>${rows ? `<dl class="ss-rows">${rows}</dl>` : ''}</div>`;
  return String(html).replace(DL, () => block);
}
