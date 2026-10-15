// Racial traits live in the Traits list. Older sheets kept them under Special Abilities; this moves them.

/**
 * Moves every entry of `c.specials` whose name is a compendium racial trait into `c.traits`
 * (linking it to the entry if it was typed in by hand). `resolve` is api.resolve. Returns how many moved.
 */
export async function moveRacialTraits(c, resolve) {
  const specials = c.specials || [];
  const named = specials.filter(s => s && String(s.name || '').trim());
  if (!named.length) return 0;
  const hits = await resolve(named.map(s => ({
    // the book names carry the ability type: "Change Shape (Su)"
    variants: [s.name, String(s.name).replace(/\s*\((su|ex|sp)\)\s*$/i, ''), ...['Su', 'Ex', 'Sp'].map(t => `${String(s.name).trim()} (${t})`)], cats: ['Racial Trait'],
  })));
  let moved = 0;
  named.forEach((s, i) => {
    if (!hits[i]) return;
    if (!s.id) { s.id = hits[i].id; s.sub = s.sub || hits[i].sub; }
    c.traits.push(s);
    c.specials.splice(c.specials.indexOf(s), 1);
    moved++;
  });
  return moved;
}
