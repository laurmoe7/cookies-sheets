"""Every creature stat block in the PSRD books, for data/creatures.json (the Companions tab's "From the creature list").

Each entry is the stat block as text (the fields app/web/js/summons.js statBlockHtml reads) plus its special ability write-ups.
Names repeat across books (a monster reprinted), so entries with the same name and source are kept once.
"""
from summons import abilities_of, text_of

KEEP = ['cr', 'xp', 'alignment', 'size', 'creature_type', 'creature_subtype', 'init', 'senses', 'aura', 'ac', 'hp', 'fortitude',
        'reflex', 'will', 'defensive_abilities', 'dr', 'resist', 'immune', 'sr', 'weaknesses', 'speed', 'melee', 'ranged', 'space',
        'reach', 'special_attacks', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'base_attack',
        'cmb', 'cmd', 'feats', 'skills', 'racial_modifiers', 'languages', 'special_qualities', 'gear', 'combat_gear', 'other_gear',
        'environment', 'organization', 'treasure']


def build(books):
    out, seen = [], set()
    for b in books:
        rows = b.db.execute('select s.section_id, s.name, s.source, s.description, c.* from sections s '
                            'join creature_details c on c.section_id = s.section_id').fetchall()
        for r in rows:
            name = (r['name'] or '').strip()
            if not name:
                continue
            source = (r['source'] or b.key).strip()
            key = (name.lower(), source.lower())
            if key in seen:
                continue
            seen.add(key)
            d = dict(r)
            entry = {k: text_of(d[k]) for k in KEEP if d.get(k)}
            if not entry.get('hp'):
                continue  # a template or fragment, not a creature
            entry['name'] = name
            entry['source'] = source
            if d.get('description'):
                entry['description'] = text_of(d['description'])
            entry['abilities'] = abilities_of(b, r['section_id'])
            out.append(entry)
    out.sort(key=lambda e: (e['name'].lower(), e['source']))
    return out
