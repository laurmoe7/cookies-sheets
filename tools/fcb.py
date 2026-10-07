"""Racial favored class options (Advanced Player's Guide, Advanced Race Guide, Advanced Class Guide).

A race's favored class bonus can be an alternate reward instead of +1 hit point or +1 skill rank. The books
list these per race and class, e.g. "Dwarf, Fighter: Add +1 to the fighter's CMD when resisting bull rush...".
Output: {race: {class: [{text, source}]}} in data/fcb.json.
"""
import html
import re

IRREGULAR = {'dwarves': 'Dwarf', 'elves': 'Elf', 'half-elves': 'Half-Elf', 'half-orcs': 'Half-Orc', 'gillmen': 'Gillman',
             'sulis': 'Suli', 'gripplis': 'Grippli', 'catfolk': 'Catfolk', 'drow': 'Drow', 'duergar': 'Duergar',
             'kitsune': 'Kitsune', 'merfolk': 'Merfolk', 'nagaji': 'Nagaji', 'ratfolk': 'Ratfolk', 'strix': 'Strix',
             'svirfneblin': 'Svirfneblin', 'goblinoids': None}
# Section names that appear above a race's heading but are not races.
NOT_RACES = {'races', 'rules', 'alternate racial rules', 'core races', 'featured races', 'uncommon races', 'hybrid classes',
             'favored class options', 'racial favored class options'}


def text_of(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def race_name(section_name):
    n = (section_name or '').strip().lower()
    if n in NOT_RACES or not n:
        return None
    if n in IRREGULAR:
        return IRREGULAR[n]
    return (n[:-1] if n.endswith('s') else n).title().replace('Half-Elf', 'Half-Elf')


def build(books):
    out = {}
    for b in books:
        if b.key not in ('apg', 'arg', 'acg'):
            continue

        def ancestors_race(sid):
            for a in b.ancestors(sid):
                r = race_name(a['name'])
                if r and a['type'] in ('race', 'section'):
                    return r
            return None

        def add(race, cls, text, source):
            if not race or not cls or not text:
                return
            opts = out.setdefault(race, {}).setdefault(cls, [])
            if not any(o['text'] == text for o in opts):
                opts.append(dict(text=text, source=source))

        for sid, s in b.sections.items():
            if not (s['name'] or '').lower().endswith('favored class options') or s['type'] != 'section':
                continue
            source = s['source'] or b.key
            for c in b.children.get(sid, []):
                kids = b.children.get(c, [])
                if kids:      # race heading with the classes below it
                    race = race_name(b.sections[c]['name'])
                    for k in kids:
                        add(race, b.sections[k]['name'], text_of(b.sections[k]['body']), source)
                else:         # a class directly under a race's Favored Class Options
                    add(ancestors_race(sid), b.sections[c]['name'], text_of(b.sections[c]['body']), source)
    return {r: dict(sorted(v.items())) for r, v in sorted(out.items())}
