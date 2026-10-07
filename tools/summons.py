"""Summon Monster / Summon Nature's Ally creature lists and the stat blocks they point to, for data/summons.json.

Core Rulebook tables list creatures by name per spell level ('Dire rat*', 'Elemental (Small)', 'Lemure (devil)').
Each name is matched against the Bestiary stat blocks (creature_details); an asterisk means the creature
gets the celestial or fiendish template (Summon Monster only).
"""
import html
import re

from htmltable import parse_table

# Table names that differ from the Bestiary's "Type, Kind" naming.
ALIASES = {
    'viper (snake)': 'snake, venomous', 'poisonous frog': 'frog, poison', 'ape': 'ape, gorilla', 'bebelith': 'bebilith',
    'cheetah': 'cat, cheetah', 'ant, giant (worker)': 'ant, giant', 'ant, giant (soldier)': 'ant, giant',
    'ant, giant (drone)': 'ant, giant', 'pony (horse)': 'horse, pony', 'aurochs (herd animal)': 'herd animal, aurochs',
}
ELEMENTALS = ['air', 'earth', 'fire', 'water']
LEVEL_ROW = re.compile(r'^(\d+)(?:st|nd|rd|th) level$', re.I)
ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']


def text_of(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def variants(name):
    """Possible Bestiary names for a table entry, most specific first."""
    w = name.lower().strip()
    if w in ALIASES:
        return [ALIASES[w]]
    base = re.sub(r'\s*\([^)]*\)', '', w).strip()
    par = re.findall(r'\(([^)]*)\)', w)
    out = [w, base]
    words = base.split(' ')
    if len(words) > 1:
        out += [f"{words[-1]}, {' '.join(words[:-1])}", f"{words[-1]}, giant {' '.join(words[:-1])}"]
        if words[0] == 'giant':
            out.append(f"{words[-1]}, giant")
    for p in par:
        out += [f'{base}, {p}', f'{p}, {base}', p]
    return out


def load_creatures(books):
    """{lowercase name: (book, section_id)} for every creature stat block."""
    out = {}
    for b in books:
        for r in b.db.execute('select s.section_id, s.name from sections s join creature_details c on c.section_id = s.section_id'):
            out.setdefault((r['name'] or '').lower(), (b, r['section_id']))
    return out


def abilities_of(b, sid):
    """Special ability write-ups under the creature: [{name, html}]."""
    out = []
    def walk(x):
        for c in b.children.get(x, []):
            s = b.sections[c]
            if s['type'] == 'ability' and s['name']:
                out.append(dict(name=s['name'], html=s['body'] or ''))
            walk(c)
    for c in b.children.get(sid, []):
        if b.sections[c]['name'] == 'Special Abilities':
            walk(c)
    return out


def stat_block(b, sid):
    d = dict(b.db.execute('select * from creature_details where section_id = ?', (sid,)).fetchone())
    keep = ['cr', 'xp', 'alignment', 'size', 'creature_type', 'creature_subtype', 'init', 'senses', 'aura', 'ac', 'hp', 'fortitude',
            'reflex', 'will', 'defensive_abilities', 'dr', 'resist', 'immune', 'sr', 'weaknesses', 'speed', 'melee', 'ranged', 'space',
            'reach', 'special_attacks', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'base_attack',
            'cmb', 'cmd', 'feats', 'skills', 'racial_modifiers', 'languages', 'special_qualities']
    out = {k: text_of(d[k]) for k in keep if d.get(k)}
    out['name'] = b.sections[sid]['name']
    out['source'] = b.sections[sid]['source'] or b.key
    out['abilities'] = abilities_of(b, sid)
    return out


def find_table(books, name):
    for b in books:
        for s in b.sections.values():
            if s['type'] == 'table' and s['name'] == name and s['body']:
                return parse_table(s['body'])
    return None


def build(books):
    creatures = load_creatures(books)
    blocks, misses = {}, []

    def key_for(name):
        for v in variants(name):
            if v in creatures:
                b, sid = creatures[v]
                k = b.sections[sid]['name'].lower()
                if k not in blocks:
                    blocks[k] = stat_block(b, sid)
                return k
        return None

    families = {}
    for family, prefix in (('Summon Monster', 'Table: Summon Monster '), ("Summon Nature's Ally", "Table: Summon Nature's Ally ")):
        t = find_table(books, prefix + 'IX')
        entries = []
        m0 = LEVEL_ROW.match(t['headers'][0].strip())  # the first list's heading is the table header
        level = int(m0.group(1)) if m0 else 0
        for r in t['rows']:
            cell = r[0].strip()
            m = LEVEL_ROW.match(cell)
            if m:
                level = int(m.group(1))
                continue
            if not level or len(r) < 2 or not cell or len(cell) > 80:
                continue
            tpl = cell.endswith('*')
            name = cell.rstrip('*').strip()
            subtype = '' if r[1] in ('', '—', '–', '-') or not re.search(r'[A-Za-z]', r[1]) else r[1]
            base = re.sub(r'\s*\([^)]*\)', '', name).lower()
            if base == 'elemental':
                size = re.search(r'\(([^)]*)\)', name).group(1).strip()
                for el in ELEMENTALS:
                    k = key_for(f'elemental, {el}, {size.lower()}')
                    if k:
                        entries.append(dict(level=level, name=f'{el.capitalize()} elemental ({size})', subtype='Elemental', template=False, creature=k))
                    else:
                        misses.append(f'{family}: elemental {el} {size}')
                continue
            k = key_for(name)
            if not k:
                misses.append(f'{family}: {name}')
                continue
            entries.append(dict(level=level, name=name[0].upper() + name[1:], subtype=subtype, template=tpl, creature=k))
        families[family] = entries
    return dict(families=families, creatures=blocks), misses
