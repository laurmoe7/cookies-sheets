// Text that arrives as HTML but did not come from this app's own compendium (a creature stored in a character file, which could be anyone's) is cleaned before it
// is shown: only plain formatting tags survive, and they lose every attribute. Pure string work, no DOM, so it behaves the same in the page and in the tests.

const ALLOWED = new Set(['p', 'b', 'i', 'u', 'em', 'strong', 'br', 'ul', 'ol', 'li', 'sup', 'sub', 'span', 'div', 'a', 'blockquote', 'h3', 'h4', 'h5',
  'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const VOID = new Set(['br']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/** HTML with only the tags in ALLOWED, no attributes (so no on* handlers, no javascript: links, no styles); other tags are dropped and stray < characters escaped. */
export function safeHtml(html) {
  const src = String(html ?? '');
  let out = '', last = 0;
  const text = t => t.replace(/</g, '&lt;');
  for (const m of src.matchAll(TAG)) {
    const name = m[2].toLowerCase();
    out += text(src.slice(last, m.index));
    if (ALLOWED.has(name)) out += VOID.has(name) ? `<${name}>` : `<${m[1]}${name}>`;
    last = m.index + m[0].length;
  }
  return out + text(src.slice(last));
}
