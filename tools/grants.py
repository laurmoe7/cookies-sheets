"""Spells that a class choice grants: cleric and druid domains (and subdomains), sorcerer and bloodrager bloodlines,
oracle mysteries, witch patrons and shaman spirits.

Output (data/grants.json): {kind: {name: {source, desc, spells: [{name, level, at?, note?}], domain?}}}
  level  the spell's level
  at     the class level that grants it, when the book says so (bloodline "identify (3rd)", patron "2nd— jump");
         domain and spirit spells have none: they come when the class can cast that spell level.
  domain a subdomain's associated domain; its spell list is the domain's with the replacements applied.
Spell names are matched to the compendium's (`spell_names`: lower-case name -> name); one it lacks keeps the book's
wording and gets `missing: true`.
"""
import html
import re

KINDS = {'cleric_domain': 'domain', 'cleric_subdomain': 'subdomain', 'druid_domain': 'druidDomain',
         'sorcerer_bloodline': 'bloodline', 'bloodrager_bloodline': 'bloodragerBloodline',
         'oracle_mystery': 'mystery', 'witch_patron': 'patron', 'shaman_spirit': 'spirit'}
# Some sections lack a subtype; their names say what they are.
NAMED = [(re.compile(r'^(.+?) Sorcerer Bloodline$'), 'bloodline'), (re.compile(r'^(.+?) Oracle Mystery$'), 'mystery'),
         (re.compile(r'^(.+?) Subdomain$'), 'subdomain')]
ORD = r'(\d+)(?:st|nd|rd|th)'
DASH = re.compile(ORD + r'\s*[—–-]\s*(.+?)(?=,?\s*\d+(?:st|nd|rd|th)\s*[—–-]|$)')
# "identify (3rd)", "summon monster V (fire elementals only, 10th)", "summon monster VIII (elementals only) (17th)"
PAREN = re.compile(r'\s*(.+?)\s*\(([^()]*?,\s*)?' + ORD + r'\)\s*(?:[,.]|$)')
QUALIFIERS = ('mass', 'greater', 'lesser', 'communal')


def text_of(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def canonical(raw, spell_names):
    """'cat's grace (mass)*' -> ("Cat's Grace, Mass", ''); 'elemental body IV (fire only)' -> ('Elemental Body IV', 'fire only')."""
    name = raw.replace('*', '').strip().strip('.').strip()
    note = ''
    m = re.match(r'^(.*?)\s*\(([^)]*)\)\s*$', name)
    if m:
        name, inner = m.group(1).strip(), m.group(2).strip()
        if inner.lower() in QUALIFIERS:
            name = f'{name}, {inner}'
        else:
            note = inner
    key = re.sub(r'\s+', ' ', name.lower())
    tries = [key, key.replace('-', ' ')]
    for q in QUALIFIERS:  # "mass cure light wounds" -> "cure light wounds, mass"
        if key.startswith(q + ' '):
            tries.append(f'{key[len(q) + 1:]}, {q}')
    tries.append(re.sub(r', greater$', '', key))  # "globe of invulnerability, greater" is the plain spell
    tries += [re.sub(r's\b', '', t, count=1) for t in list(tries)]  # "charm animals"
    tries.append(key.replace(' and ', ' or '))  # "repel metal and stone"
    for t in tries:
        if t in spell_names:
            return spell_names[t], note, False
    for k, v in spell_names.items():  # "geas" is listed as "Geas/Quest"
        if k.startswith(key + '/'):
            return v, note, False
    return name[:1].upper() + name[1:], note, True


def parse_spells(text, spell_names, explicit_at):
    """The spell list of a 'Domain Spells' / 'Bonus Spells' / patron paragraph, in book order."""
    text = text_of(text).lstrip(': ')
    text = re.sub(r'\((\d+)(?:st|nd|rd|th);\s*([^()]*)\)', r'(\2, \1th)', text)  # "(9th; dealing fire damage)"
    items = [(int(m.group(1)), m.group(2).strip(), '') for m in DASH.finditer(text)]
    if not items:
        items = [(int(m.group(3)), m.group(1).strip(), (m.group(2) or '').strip().rstrip(',').strip()) for m in PAREN.finditer(text)]
    out = []
    for i, (n, raw, extra) in enumerate(items):
        whole = canonical(raw, spell_names)
        # "blindness/deafness" is one spell; "bless water/curse water" is two
        parts = [raw] if not whole[2] or '/' not in raw else re.split(r'\s*/\s*', raw)
        # "protection from chaos/evil/good/law": the later parts share the first part's opening words
        head = parts[0].rsplit(' ', 1)[0] + ' ' if ' ' in parts[0] else ''
        parts = [parts[0]] + [p if ' ' in p.strip() else head + p for p in parts[1:]]
        for part in parts:
            name, note, missing = canonical(part, spell_names)
            note = ', '.join(x for x in (note, extra) if x)
            sp = {'name': name, 'level': n}
            if explicit_at:  # "identify (3rd)": the 3rd is the class level; the spell level is its place in the list
                sp = {'name': name, 'level': i + 1, 'at': n}
            if note:
                sp['note'] = note
            if missing:
                sp['missing'] = True
            out.append(sp)
    return out


def kind_of(s):
    if s['subtype'] in KINDS:
        return KINDS[s['subtype']], s['name']
    for rx, kind in NAMED:
        m = rx.match(s['name'] or '')
        if m and s['type'] == 'section':
            return kind, m.group(1)
    return None, None


def build(books, spell_names):
    out = {k: {} for k in KINDS.values()}
    for b in books:
        for sid, s in b.sections.items():
            kind, name = kind_of(s)
            if not kind:
                continue
            name = re.sub(r'\s+(Domain|Subdomain|Bloodline|Mystery|Spirit)$', '', name.strip())
            kids = [b.sections[k] for k in b.children.get(sid, [])]
            by = {(k['name'] or '').lower(): k for k in kids}
            item = {'source': s['source'] or b.key}
            if kind == 'patron':  # the list is the section's own text
                item['spells'] = parse_spells(s['body'], spell_names, True)
            else:
                lst = by.get('domain spells') or by.get('replacement domain spells') or by.get('bonus spells') or by.get('spirit magic spells')
                item['spells'] = parse_spells((lst or {}).get('body') or (lst or {}).get('description'), spell_names,
                                              kind in ('bloodline', 'bloodragerBloodline', 'mystery'))
            if kind == 'subdomain':
                assoc = by.get('associated domain') or by.get('associated domains')
                item['domain'] = text_of((assoc or {}).get('body') or (assoc or {}).get('description')).strip('. ').split(',')[0].strip()
            gp = by.get('granted powers')
            item['desc'] = text_of(s['body'] or (gp or {}).get('body') or '')[:220]
            if not item['spells'] and kind != 'subdomain':
                continue
            prev = out[kind].get(name)
            if not prev or (not prev['spells'] and item['spells']):
                out[kind][name] = item
    # A subdomain lists only the spells it replaces: fill in the rest from its domain.
    for name, sub in list(out['subdomain'].items()):
        dom = out['domain'].get(sub.get('domain', ''))
        if not dom:
            del out['subdomain'][name]
            continue
        repl = {}
        for sp in sub['spells']:
            repl.setdefault(sp['level'], []).append(sp)
        sub['spells'] = [x for sp in dom['spells'] for x in repl.get(sp['level'], [sp])]
        sub['replaces'] = sorted(repl)
    return {k: dict(sorted(v.items())) for k, v in out.items()}
