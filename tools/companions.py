"""Extracts animal companion and eidolon rules data from the PSRD books into data/companions.json.

- Animal companions: the Core Rulebook progression table and every species stat block in the books
  (starting statistics plus the 4th- or 7th-level advancement).
- Eidolons: the APG progression table, base forms (starting statistics, free evolutions), and all
  evolutions grouped by point cost.
"""
import html
import re

from htmltable import parse_table

ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha']


def text_of(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def num(s):
    m = re.search(r'[+-]?\d+', (s or '').replace('–', '-').replace('—', '-').replace('−', '-'))
    return int(m.group()) if m else None


def parse_abilities(s):
    """'Str 15, Dex 15, Con 13, Int 2, Wis 12, Cha 6' -> {str: 15, ...}; works for '+4' deltas too.
    A dash ('Int —') is stored as None."""
    out = {}
    for m in re.finditer(r'\b(Str|Dex|Con|Int|Wis|Cha)\s*([+−–-]?\s*\d+|—|-)', s or '', re.I):
        v = m.group(2).replace(' ', '')
        out[m.group(1).lower()] = None if v in ('—', '-') else num(v)
    return out


def _singular(w):
    if w.endswith('ves'):
        return w[:-3] + 'f'
    if w.endswith('es') and re.search(r'(ch|sh|ss|x)es$', w):
        return w[:-2]
    if w.endswith('s') and not w.endswith('ss'):
        return w[:-1]
    return w


def parse_attacks(s):
    """'bite (1d4), 2 claws (1d3)' -> [{name, count, dice, extra}]"""
    out = []
    for part in re.split(r',(?![^(]*\))', s or ''):
        part = part.strip().rstrip('.')
        m = re.match(r'(?:(\d+)\s+)?([a-z][a-z \-]*?)(\*?)\s*\(([^)]*)\)', part, re.I)
        if not m:
            continue
        inner = m.group(4).strip()
        dm = re.match(r'(\d+d\d+)\s*(.*)', inner)
        out.append(dict(name=_singular(m.group(2).strip().lower()) if m.group(1) else m.group(2).strip().lower(),
                        count=int(m.group(1) or 1), dice=dm.group(1) if dm else '',
                        extra=(dm.group(2) if dm else inner).strip(), secondary=bool(m.group(3))))
    return out


def qualities(s):
    """Special qualities text, without the '*This is a secondary natural attack' footnote."""
    return re.split(r'\s*\*', text_of(s), maxsplit=1)[0].rstrip('. ')


def natural_armor(s):
    m = re.search(r'([+-]?\d+)\s*natural armor', s or '', re.I)
    return int(m.group(1)) if m else 0


def find_table(books, name):
    for b in books:
        for s in b.sections.values():
            if s['type'] == 'table' and s['name'] == name and s['body']:
                return parse_table(s['body'])
    raise KeyError(name)


def animal_progression(books):
    t = find_table(books, 'Table: Animal Companion Base Statistics')
    rows = []
    for r in t['rows'][:20]:
        rows.append(dict(level=num(r[0]), hd=num(r[1]), bab=num(r[2]), fort=num(r[3]), ref=num(r[4]), will=num(r[5]),
                         skills=num(r[6]), feats=num(r[7]), natural=num(r[8]), strDex=num(r[9]), tricks=num(r[10]),
                         special=[x.strip() for x in text_of(r[11]).split(',') if x.strip() and x.strip() not in '—-']))
    return rows


def eidolon_progression(books):
    t = find_table(books, 'Table: Eidolon Base Statistics')
    rows = []
    for r in t['rows'][:20]:
        rows.append(dict(level=num(r[0]), hd=num(r[1]), bab=num(r[2]), good=num(r[3]), bad=num(r[4]), skills=num(r[5]),
                         feats=num(r[6]), natural=num(r[7]), strDex=num(r[8]), pool=num(r[9]), maxAttacks=num(r[10]),
                         special=[x.strip() for x in text_of(r[11]).split(',') if x.strip() and x.strip() not in '—-']))
    return rows


def animal_species(books):
    out, seen = [], set()
    for b in books:
        try:
            details = {r['section_id']: dict(r) for r in b.db.execute('select * from animal_companion_details')}
        except Exception:
            continue
        for sid, s in b.sections.items():
            if s['type'] != 'animal_companion' or s['subtype'] != 'base' or s['name'] in seen:
                continue
            d = details.get(sid)
            if not d:
                continue
            adv_sid = next((c for c in b.children.get(sid, []) if b.sections[c]['subtype'] == 'advancement'), None)
            a = details.get(adv_sid, {}) if adv_sid else {}
            seen.add(s['name'])
            out.append(dict(
                name=s['name'], source=s['source'] or b.key,
                size=(d['size'] or 'Medium').strip(), speed=text_of(d['speed']), natural=natural_armor(d['ac']),
                attacks=parse_attacks(d['attack']), abilities=parse_abilities(d['ability_scores']),
                specialAttacks=text_of(d['special_attacks']), specialQualities=qualities(d['special_qualities']),
                bonusFeat=text_of(d['bonus_feat']),
                advance=dict(level=num(a.get('level')) or 4, size=(a.get('size') or '').strip(),
                             natural=natural_armor(a.get('ac')), attacks=parse_attacks(a.get('attack')),
                             abilities=parse_abilities(a.get('ability_scores')),
                             specialAttacks=text_of(a.get('special_attacks')), specialQualities=qualities(a.get('special_qualities')),
                             bonusFeat=text_of(a.get('bonus_feat'))) if a else None,
            ))
    return sorted(out, key=lambda x: x['name'])


def eidolon_forms(books):
    forms, seen = [], set()
    for b in books:
        if b.key not in ('apg', 'um'):
            continue
        for sid, s in b.sections.items():
            if s['name'] != 'Starting Statistics' or 'Free Evolutions' not in (s['body'] or ''):
                continue
            name = b.sections[s['parent_id']]['name'].replace(' Base Form', '')
            if name in seen:
                continue
            seen.add(name)
            fields = {}
            for chunk in re.split(r';\s*(?=<b>)', s['body']):
                m = re.match(r'\s*(?:<p[^>]*>)?\s*<b>([^<]+)</b>(.*)', chunk, re.S)
                if m:
                    fields[m.group(1).strip().lower()] = text_of(m.group(2)).rstrip('.')
            saves = fields.get('saves', '')
            good = [k for k, w in (('fort', 'Fort'), ('ref', 'Ref'), ('will', 'Will')) if re.search(w + r'\s*\(good\)', saves)]
            forms.append(dict(name=name, source=s['source'] or b.key, size=fields.get('size', 'Medium'),
                              speed=fields.get('speed', ''), natural=natural_armor(fields.get('ac')), good=good,
                              attacks=parse_attacks(fields.get('attack')), abilities=parse_abilities(fields.get('ability scores')),
                              free=[x.strip() for x in re.split(r',(?![^(]*\))', fields.get('free evolutions', '')) if x.strip()]))
    order = ['Biped', 'Quadruped', 'Serpentine']
    return sorted(forms, key=lambda f: (order.index(f['name']) if f['name'] in order else 9, f['name']))


def evolutions(books):
    out, seen = [], set()
    for b in books:
        for sid, s in b.sections.items():
            m = re.match(r'(\d+)-Point Evolutions', s['name'] or '')
            if not m:
                continue
            cost = int(m.group(1))
            for c in b.children.get(sid, []):
                e = b.sections[c]
                if e['type'] != 'ability' or e['name'] in seen:
                    continue
                seen.add(e['name'])
                body = e['body'] or ''
                text = text_of(body)
                out.append(dict(name=e['name'], cost=cost, source=e['source'] or b.key, html=body,
                                repeat=bool(re.search(r'selected more than once|taken multiple times|can be selected multiple', text, re.I)),
                                summary=re.split(r'(?<=\.)\s', text)[0][:200]))
    return sorted(out, key=lambda e: (e['cost'], e['name']))


# ---------------------------------------------------------------- familiars

def familiar_key(name):
    """'Familiar, Scorpion, Greensting' -> 'greensting scorpion'; table names like 'Raven*' -> 'raven'."""
    n = re.sub(r'^familiar,\s*', '', (name or '').strip(), flags=re.I).replace('*', '').strip().lower()
    parts = [x.strip() for x in n.split(',')]
    return ' '.join(reversed(parts))


def familiar_progression(books):
    """Master class level -> natural armor adjustment, Int, and new abilities (Core Rulebook wizard table)."""
    t = find_table(books, 'Master Class Level')
    rows = []
    for r in t['rows']:
        rows.append(dict(minLevel=num(r[0]) or 1, natural=num(r[1]) or 0, int=num(r[2]) or 6,
                         special=[x.strip().lower() for x in text_of(r[3]).split(',') if re.search(r'[a-z]', x)]))
    return rows


def familiar_bonuses(books):
    """{'bat': 'Master gains a +3 bonus on Fly checks'} from every 'Familiar / Special Ability' table."""
    out = {}
    for b in books:
        for s in b.sections.values():
            if s['type'] != 'table' or not s['body'] or not re.fullmatch(r'(?:Table: )?Familiars?', s['name'] or ''):
                continue
            try:
                t = parse_table(s['body'])
            except Exception:
                continue
            if [h.lower() for h in t['headers'][:2]] != ['familiar', 'special ability']:
                continue
            for r in t['rows']:
                if len(r) >= 2 and r[0] != r[1] and r[1].lower().startswith('master'):
                    out.setdefault(familiar_key(r[0]), (text_of(r[1]), b.key))
    return out


def parse_melee(s):
    """'2 claws +4 (1d2-4), bite +4 (1d3-4)' -> [{name, count, dice, extra}] (damage recomputed by the app)."""
    out = []
    for part in re.split(r',(?![^(]*\))', s or ''):
        m = re.match(r'\s*(?:(\d+)\s+)?([a-z][a-z \-]*?)\s+[+-]\d+(?:/[+-]\d+)*\s*\((.*)\)\s*$', part, re.I)
        if not m:
            continue
        dm = re.match(r'(\d+d\d+)\s*(?:[+-]\d+)?\s*(.*)', m.group(3).strip())
        name = m.group(2).strip().lower()
        out.append(dict(name=_singular(name) if m.group(1) else name, count=int(m.group(1) or 1),
                        dice=dm.group(1) if dm else '', extra=(dm.group(2) if dm else m.group(3)).strip()))
    return out


def familiar_skill_totals(s):
    """'Climb +6, Perception +5' -> {'Climb': 6, ...}; '(+5 when jumping)' notes are dropped."""
    out = {}
    for m in re.finditer(r'([A-Z][A-Za-z ]+?(?:\([^)]*\))?)\s*([+-]\d+)(?:\s*\([^)]*\))?', s or ''):
        out[m.group(1).strip()] = int(m.group(2))
    return out


def racial_modifiers(s):
    """'+4 Climb, +4 Stealth' -> {'Climb': 4, 'Stealth': 4} (conditional ones like '+4 Survival to find food' are kept as-is)."""
    out = {}
    for m in re.finditer(r'([+-]\d+)\s+([A-Z][A-Za-z ]+?)(?=,|$)', s or ''):
        out[m.group(2).strip()] = int(m.group(1))
    return out


def familiars(books):
    bonuses = familiar_bonuses(books)
    out, seen = [], set()
    for b in books:
        rows = b.db.execute("select s.section_id, s.name, s.source from sections s where s.type='creature' and s.name like 'Familiar,%'").fetchall()
        det = {r['section_id']: dict(r) for r in b.db.execute('select * from creature_details')}
        for r in rows:
            d = det.get(r['section_id'])
            key = familiar_key(r['name'])
            if not d or key in seen:
                continue
            seen.add(key)
            bonus = bonuses.get(key)
            senses = text_of(d['senses']).split(';')[0].strip()
            base = text_of(d['ac'])
            out.append(dict(
                name=' '.join(w.capitalize() if w != 'and' else w for w in key.split(' ')).replace('-Ringed', '-Ringed'),
                source=r['source'] or b.key, size=(d['size'] or 'Tiny').strip(), speed=text_of(d['speed']),
                natural=num(re.search(r'([+-]\d+)\s*natural', base).group(1)) if re.search(r'([+-]\d+)\s*natural', base) else 0, senses=senses, space=text_of(d['space']), reach=text_of(d['reach']),
                attacks=parse_melee(d['melee']), abilities={a: num(d[k]) for a, k in zip(ABIL, ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'])},
                feats=[x.strip() for x in text_of(d['feats']).split(',') if x.strip()],
                skills=familiar_skill_totals(text_of(d['skills'])), racial=racial_modifiers(text_of(d['racial_modifiers'])),
                racialText=text_of(d['racial_modifiers']),
                specialQualities=text_of(d['special_qualities']), specialAttacks=text_of(d['special_attacks']),
                masterBonus=bonus[0] if bonus else '',
            ))
    return sorted(out, key=lambda x: x['name'])


def build(books):
    return dict(animal=dict(progression=animal_progression(books), species=animal_species(books)),
                eidolon=dict(progression=eidolon_progression(books), forms=eidolon_forms(books), evolutions=evolutions(books)),
                familiar=dict(progression=familiar_progression(books), species=familiars(books)))
