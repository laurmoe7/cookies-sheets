async function req(method, path, body) {
  const r = await fetch('/api/' + path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || r.statusText);
  return data;
}
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

const entryCache = new Map();

export const api = {
  classes: () => req('GET', 'classes'),
  search: (q, cat = '', limit = 60, offset = 0) => req('GET', 'search?' + qs({ q, cat, limit, offset })),
  async entry(id) {
    if (!entryCache.has(id)) entryCache.set(id, await req('GET', 'entry?' + qs({ id })));
    return entryCache.get(id);
  },
  entryByName: (name, cat) => req('GET', 'entry?' + qs({ name, cat })),
  spells: (cls, level, q, school) => req('GET', 'spells?' + qs({ cls, level, q, school })),
  categories: () => req('GET', 'categories'),
  archetypes: cls => req('GET', 'archetypes?' + qs({ cls })),
  companions: () => req('GET', 'companions'),
  summons: () => req('GET', 'summons'),
  fcb: () => req('GET', 'fcb'),
  characters: () => req('GET', 'characters'),
  character: id => req('GET', 'character?' + qs({ id })),
  saveCharacter: c => req('POST', 'character', c),
  deleteCharacter: id => req('POST', 'character/delete?' + qs({ id })),
  openFolder: () => req('POST', 'open-folder'),
  csFetch: ref => req('GET', 'cs-fetch?' + qs({ id: ref })),
  resolve: items => req('POST', 'resolve', { items }),
};
