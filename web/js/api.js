async function req(method, path, body) {
  const r = await fetch('/api/' + path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  // Read the text first: an answer that is not JSON (the file server's 404 page, a half-closed connection) should show its
  // status, not a parse error. Note a route may legitimately answer null (an entry that does not exist).
  const text = await r.text();
  let data, isJson = true;
  try { data = JSON.parse(text); } catch { isJson = false; }
  if (!r.ok) throw new Error((isJson && data?.error) || `${r.status} ${r.statusText}`.trim());
  if (!isJson) throw new Error('The server sent an answer that is not JSON');
  return data;
}
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

const entryCache = new Map();

export const api = {
  classes: () => req('GET', 'classes'),
  magicGear: (kind, q = '') => req('GET', 'magic-gear?' + qs({ kind, q })),
  search: (q, cat = '', limit = 60, offset = 0) => req('GET', 'search?' + qs({ q, cat, limit, offset })),
  /** One compendium entry. The request is cached (not just the answer), so callers asking at the same time share one fetch. */
  entry(id) {
    if (!entryCache.has(id)) entryCache.set(id, req('GET', 'entry?' + qs({ id })).catch(e => { entryCache.delete(id); throw e; }));
    return entryCache.get(id);
  },
  /** Several entries in one request (the Spells tab looks up every spell on the page); results go into the same cache. Entries that do not exist come back null. */
  entries(ids) {
    const need = [...new Set(ids)].filter(id => !entryCache.has(id));
    if (need.length) {
      const batch = req('GET', 'entries?' + qs({ ids: need.join(',') }));
      for (const id of need) entryCache.set(id, batch.then(list => list.find(e => e.id === id) || null).catch(e => { entryCache.delete(id); throw e; }));
    }
    return Promise.all(ids.map(id => entryCache.get(id)));
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
  deleted: () => req('GET', 'deleted'),
  restoreCharacter: file => req('POST', 'character/restore?' + qs({ file })),
  history: () => req('GET', 'history'),
  revertCharacter: file => req('POST', 'character/revert?' + qs({ file })),
  purgeCharacter: file => req('POST', 'character/purge?' + qs({ file })),
  updateCheck: () => req('GET', 'update-check'),
  updateApply: () => req('POST', 'update-apply'),
  openFolder: () => req('POST', 'open-folder'),
  gsFetch: ref => req('GET', 'gs-fetch?' + qs({ id: ref })),
  csFetch: ref => req('GET', 'cs-fetch?' + qs({ id: ref })),
  sounds: () => req('GET', 'sounds'),
  async addSound(name, file, label = '') {
    const r = await fetch('/api/sound?' + qs({ name, label }), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || r.statusText);
    return data;
  },
  removeSound: (name, id = '') => req('POST', 'sound/delete?' + qs({ name, id })),
  soundUrl: (name, id) => '/api/sound-file?' + qs({ name, id }),
  discord: (url, content, username) => req('POST', 'discord', { url, content, username }),
  resolve: items => req('POST', 'resolve', { items }),
};
