"""Build data/pf1e.db (searchable compendium) and data/classes.json (level-up tables).

Sources (Open Game License content):
  tools/sources/psrd/*.db   - PSRD-Data (github.com/devonjones/PSRD-Data)
  tools/sources/spells.tsv  - community spell spreadsheet (github.com/sturlabragason/pathfinder_spells)

Run:  python tools/build_data.py
"""
import csv
import glob
import html
import json
import os
import re
import sqlite3
import sys

import archetypes
import companions
import summons
from htmltable import parse_table

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sources')
OUT_DB = os.path.join(ROOT, 'data', 'pf1e.db')
OUT_CLASSES = os.path.join(ROOT, 'data', 'classes.json')
OUT_COMPANIONS = os.path.join(ROOT, 'data', 'companions.json')
OUT_SUMMONS = os.path.join(ROOT, 'data', 'summons.json')

# Book priority (earlier wins when the same entry appears twice)
BOOKS = ['cr', 'apg', 'acg', 'um', 'uc', 'ucampaign', 'arg', 'ue', 'gmg', 'ma', 'tech', 'mc', 'npc',
         'b1', 'b2', 'b3', 'b4', 'ogl']

TYPE_CATEGORY = {
    'spell': 'Spell', 'feat': 'Feat', 'trait': 'Trait', 'drawback': 'Trait',
    'racial_trait': 'Racial Trait', 'race': 'Race', 'class': 'Class',
    'class_archetype': 'Archetype', 'ability': 'Class Feature', 'skill': 'Skill',
    'item': 'Magic Item', 'affliction': 'Affliction', 'mythic_spell': 'Mythic Spell',
}
MONSTER_BOOKS = {'b1', 'b2', 'b3', 'b4', 'mc', 'npc'}
RULE_BOOKS = {'cr', 'apg', 'acg', 'um', 'uc', 'ucampaign', 'arg', 'gmg', 'ue'}
SKIP_ANCESTORS = {'class', 'spell', 'feat', 'race', 'item', 'creature', 'class_archetype', 'trait',
                  'mythic_spell', 'affliction', 'army', 'settlement', 'kingdom_resource', 'vehicle',
                  'haunt', 'trap', 'animal_companion'}

SKILLS = ['Acrobatics', 'Appraise', 'Bluff', 'Climb', 'Craft', 'Diplomacy', 'Disable Device', 'Disguise',
          'Escape Artist', 'Fly', 'Handle Animal', 'Heal', 'Intimidate', 'Knowledge', 'Linguistics',
          'Perception', 'Perform', 'Profession', 'Ride', 'Sense Motive', 'Sleight of Hand', 'Spellcraft',
          'Stealth', 'Survival', 'Swim', 'Use Magic Device']
KNOWLEDGES = ['arcana', 'dungeoneering', 'engineering', 'geography', 'history', 'local', 'nature',
              'nobility', 'planes', 'religion']

# Classes for the level-up calculator: (name, book, group, casting info or None)
# casting: stat, kind (prepared/spontaneous), list = spell-list class names, cl_offset, max spell level
CLASSES = [
    ('Barbarian', 'cr', 'Core', None),
    ('Bard', 'cr', 'Core', dict(stat='cha', kind='spontaneous', lists=['Bard'], cl_offset=0)),
    ('Cleric', 'cr', 'Core', dict(stat='wis', kind='prepared', lists=['Cleric'], cl_offset=0, domain=True)),
    ('Druid', 'cr', 'Core', dict(stat='wis', kind='prepared', lists=['Druid'], cl_offset=0, domain=True)),
    ('Fighter', 'cr', 'Core', None),
    ('Monk', 'cr', 'Core', None),
    ('Paladin', 'cr', 'Core', dict(stat='cha', kind='prepared', lists=['Paladin'], cl_offset=-3)),
    ('Ranger', 'cr', 'Core', dict(stat='wis', kind='prepared', lists=['Ranger'], cl_offset=-3)),
    ('Rogue', 'cr', 'Core', None),
    ('Sorcerer', 'cr', 'Core', dict(stat='cha', kind='spontaneous', lists=['Sorcerer', 'Wizard'], cl_offset=0)),
    ('Wizard', 'cr', 'Core', dict(stat='int', kind='prepared', lists=['Wizard', 'Sorcerer'], cl_offset=0, domain=True)),
    ('Alchemist', 'apg', 'Base', dict(stat='int', kind='prepared', lists=['Alchemist'], cl_offset=0, extracts=True)),
    ('Cavalier', 'apg', 'Base', None),
    ('Inquisitor', 'apg', 'Base', dict(stat='wis', kind='spontaneous', lists=['Inquisitor'], cl_offset=0)),
    ('Oracle', 'apg', 'Base', dict(stat='cha', kind='spontaneous', lists=['Oracle', 'Cleric'], cl_offset=0)),
    ('Summoner', 'apg', 'Base', dict(stat='cha', kind='spontaneous', lists=['Summoner'], cl_offset=0)),
    ('Witch', 'apg', 'Base', dict(stat='int', kind='prepared', lists=['Witch'], cl_offset=0, domain=True)),
    ('Magus', 'um', 'Base', dict(stat='int', kind='prepared', lists=['Magus'], cl_offset=0)),
    ('Gunslinger', 'uc', 'Base', None),
    ('Ninja', 'uc', 'Alternate', None),
    ('Samurai', 'uc', 'Alternate', None),
    ('Antipaladin', 'apg', 'Alternate', dict(stat='cha', kind='prepared', lists=['Antipaladin'], cl_offset=-3)),
    ('Arcanist', 'acg', 'Hybrid', dict(stat='int', kind='arcanist', lists=['Arcanist', 'Wizard', 'Sorcerer'], cl_offset=0)),
    ('Bloodrager', 'acg', 'Hybrid', dict(stat='cha', kind='spontaneous', lists=['Bloodrager'], cl_offset=-3)),
    ('Brawler', 'acg', 'Hybrid', None),
    ('Hunter', 'acg', 'Hybrid', dict(stat='wis', kind='spontaneous', lists=['Hunter', 'Druid', 'Ranger'], cl_offset=0)),
    ('Investigator', 'acg', 'Hybrid', dict(stat='int', kind='prepared', lists=['Investigator', 'Alchemist'], cl_offset=0, extracts=True)),
    ('Shaman', 'acg', 'Hybrid', dict(stat='wis', kind='prepared', lists=['Shaman'], cl_offset=0, domain=True)),
    ('Skald', 'acg', 'Hybrid', dict(stat='cha', kind='spontaneous', lists=['Skald', 'Bard'], cl_offset=0)),
    ('Slayer', 'acg', 'Hybrid', None),
    ('Swashbuckler', 'acg', 'Hybrid', None),
    ('Warpriest', 'acg', 'Hybrid', dict(stat='wis', kind='prepared', lists=['Warpriest', 'Cleric'], cl_offset=0)),
]


def clean(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def norm(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def parse_int(s):
    s = (s or '').replace('–', '-').replace('—', '-').replace('−', '-')
    m = re.search(r'[+-]?\d+', s)
    return int(m.group()) if m else None


class Book:
    def __init__(self, key, path):
        self.key = key
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.sections = {r['section_id']: dict(r) for r in self.db.execute('select * from sections')}
        self.children = {}
        for s in sorted(self.sections.values(), key=lambda s: s['lft']):
            self.children.setdefault(s['parent_id'], []).append(s['section_id'])
        self.spell_details = {r['section_id']: dict(r) for r in self.db.execute('select * from spell_details')}
        self.spell_lists = {}
        for r in self.db.execute('select * from spell_lists'):
            self.spell_lists.setdefault(r['section_id'], []).append((r['class'], r['level']))
        self.feat_types = {}
        for r in self.db.execute('select * from feat_types'):
            self.feat_types.setdefault(r['section_id'], []).append(r['feat_type'])
        self.class_details = {r['section_id']: dict(r) for r in self.db.execute('select * from class_details')}
        self.item_details = {r['section_id']: dict(r) for r in self.db.execute('select * from item_details')}
        self.skill_attrs = {r['section_id']: dict(r) for r in self.db.execute('select * from skill_attributes')}
        self.afflictions = {r['section_id']: dict(r) for r in self.db.execute('select * from affliction_details')}

    def ancestors(self, sid):
        p = self.sections[sid]['parent_id']
        while p is not None and p in self.sections:
            yield self.sections[p]
            p = self.sections[p]['parent_id']

    def subtree_text(self, sid):
        s = self.sections[sid]
        out = [s['name'] or '', s['description'] or '', clean(s['body'])]
        for c in self.children.get(sid, []):
            out.append(self.subtree_text(c))
        return ' '.join(x for x in out if x)

    # ---------- HTML rendering ----------
    def render(self, sid, depth=0):
        s = self.sections[sid]
        parts = []
        if depth > 0 and s['description'] and not s['body'] and not self.children.get(sid):
            # short labelled fields such as "Prerequisites: Str 13" are stored in description
            label = f'<b>{html.escape(s["name"])}:</b> ' if s['name'] else ''
            return f'<p class="field">{label}{s["description"].strip()}</p>'
        if depth > 0 and s['name'] and s['type'] != 'table':
            h = min(3 + depth, 6)
            parts.append(f'<h{h}>{html.escape(s["name"])}</h{h}>')
        if depth > 0 and s['description']:
            parts.append(f'<p><i>{s["description"]}</i></p>')
        if depth == 0:
            parts.append(self.stat_block(s))
        if s['description'] and depth == 0 and s['type'] not in ('spell',):
            parts.append(f'<p class="desc"><i>{s["description"]}</i></p>')
        if s['body']:
            parts.append(s['body'])
        for c in self.children.get(sid, []):
            parts.append(self.render(c, depth + 1))
        return ''.join(p for p in parts if p)

    def stat_block(self, s):
        sid = s['section_id']
        rows = []
        if s['type'] == 'spell' and sid in self.spell_details:
            d = self.spell_details[sid]
            school = d['school'] or ''
            if d['subschool_text']:
                school += f' ({d["subschool_text"]})'
            if d['descriptor_text']:
                school += f' [{d["descriptor_text"]}]'
            rows.append(('School', school))
            rows.append(('Level', d['level_text']))
            rows.append(('Casting Time', d['casting_time']))
            rows.append(('Components', d['component_text']))
            rows.append(('Range', d['range']))
            for e in self.db.execute('select name, description from spell_effects where section_id=?', (sid,)):
                rows.append((e['name'], e['description']))
            rows.append(('Duration', d['duration']))
            rows.append(('Saving Throw', d['saving_throw']))
            rows.append(('Spell Resistance', d['spell_resistance']))
        elif s['type'] == 'feat':
            types = self.feat_types.get(sid)
            if types:
                rows.append(('Type', ', '.join(types)))
        elif s['type'] == 'item' and sid in self.item_details:
            d = self.item_details[sid]
            for k in ('aura', 'cl', 'slot', 'price', 'weight'):
                rows.append((k.upper() if k == 'cl' else k.title(), d[k]))
        elif s['type'] == 'skill' and sid in self.skill_attrs:
            d = self.skill_attrs[sid]
            rows.append(('Ability', d['attribute']))
            rows.append(('Trained Only', 'Yes' if d['trained_only'] else 'No'))
            rows.append(('Armor Check Penalty', 'Yes' if d['armor_check_penalty'] else 'No'))
        elif s['type'] == 'class' and sid in self.class_details:
            d = self.class_details[sid]
            rows.append(('Alignment', d['alignment']))
            rows.append(('Hit Die', d['hit_die']))
        elif s['type'] == 'affliction' and sid in self.afflictions:
            d = self.afflictions[sid]
            for k in ('contracted', 'save', 'onset', 'frequency', 'effect', 'initial_effect', 'secondary_effect', 'cure', 'cost'):
                rows.append((k.replace('_', ' ').title(), d[k]))
        rows = [(k, v) for k, v in rows if v]
        if not rows:
            return ''
        return '<dl class="stat">' + ''.join(f'<dt>{html.escape(k)}</dt><dd>{v}</dd>' for k, v in rows) + '</dl>'


def load_books():
    books = []
    for key in BOOKS:
        path = os.path.join(SRC, 'psrd', f'book-{key}.db')
        if os.path.exists(path):
            books.append(Book(key, path))
    return books


def class_name_variants(name):
    """Split TSV class tokens like 'sorcerer/wizard' into canonical names."""
    out = []
    for part in name.split('/'):
        part = part.strip()
        if part:
            out.append(part.title())
    return out


def parse_level_text(text):
    """'Sorcerer: 3; Wizard: 3' or 'sorcerer/wizard 3, magus 3' -> {Class: level}"""
    levels = {}
    if not text:
        return levels
    for chunk in re.split(r'[;,]', text):
        m = re.match(r'\s*(.+?)[:\s]+(\d)\s*$', chunk)
        if not m:
            continue
        for c in class_name_variants(m.group(1)):
            levels[c] = int(m.group(2))
    return levels


def build_entries(books):
    entries = []
    seen = set()

    def add(cat, sub, name, source, summary, body_html, meta, text):
        key = (cat, norm(name))
        if key in seen:
            return False
        seen.add(key)
        entries.append(dict(cat=cat, sub=sub or '', name=name, source=source, summary=summary or '',
                            html=body_html, meta=json.dumps(meta), text=text))
        return True

    for b in books:
        for sid, s in b.sections.items():
            t = s['type']
            if not s['name']:
                continue
            cat = TYPE_CATEGORY.get(t)
            if t == 'section' and s['subtype'] == 'condition':
                cat = 'Condition'
            elif t == 'section':
                if b.key not in RULE_BOOKS or not s['body'] and not b.children.get(sid):
                    continue
                if any(a['type'] in SKIP_ANCESTORS for a in b.ancestors(sid)):
                    continue
                if s['rgt'] - s['lft'] > 120:  # whole chapters are too large to be useful entries
                    continue
                if re.fullmatch(r'\d+(st|nd|rd|th)[- ]Level|Level \d+', s['name']):  # table-of-contents style headings
                    continue
                cat = 'Rules'
            if not cat:
                continue
            if cat == 'Class Feature' and b.key in MONSTER_BOOKS:
                cat = 'Monster Ability'
            meta = {}
            sub = s['subtype']
            if t == 'spell':
                d = b.spell_details.get(sid, {})
                levels = {c: l for c, l in b.spell_lists.get(sid, [])} or parse_level_text(d.get('level_text'))
                meta = dict(school=d.get('school'), subschool=d.get('subschool_text'),
                            descriptor=d.get('descriptor_text'), levels=levels,
                            casting_time=d.get('casting_time'), components=d.get('component_text'),
                            range=d.get('range'), duration=d.get('duration'),
                            save=d.get('saving_throw'), sr=d.get('spell_resistance'))
                sub = d.get('school')
            elif t == 'feat':
                meta = dict(types=b.feat_types.get(sid, []))
                prereq = next((b.sections[c] for c in b.children.get(sid, []) if (b.sections[c]['name'] or '') == 'Prerequisites'), None)
                if prereq:
                    meta['prereq'] = clean(prereq['body'] or prereq['description'])
                sub = ', '.join(meta['types']) or 'General'
            elif t == 'race' and sub:
                sub = sub.replace('_', ' ').title()
            elif t == 'class' and sid in b.class_details:
                meta = dict(hit_die=b.class_details[sid]['hit_die'])
            elif t == 'class_archetype':
                kids = []
                for c in b.children.get(sid, []):
                    k = b.sections[c]
                    feature_html = (k['body'] or '') + ''.join(b.render(g, 2) for g in b.children.get(c, []))
                    kids.append((k['type'], k['name'], k['body'], feature_html))
                meta = archetypes.parse_archetype(s['name'], (sub or '').title(), s['body'], kids)
                sub = meta['cls'].lower()
            if sub:
                sub = sub.replace('_', ' ')
                if t in ('trait', 'racial_trait', 'ability'):
                    sub = sub.title()
            add(cat, sub, s['name'], s['source'] or b.key, s['description'], b.render(sid), meta,
                b.subtree_text(sid))
    return entries


def merge_tsv_spells(entries):
    path = os.path.join(SRC, 'spells.tsv')
    if not os.path.exists(path):
        return 0
    csv.field_size_limit(10 ** 9)
    by_name = {norm(e['name']): e for e in entries if e['cat'] == 'Spell'}
    added = 0
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            levels = parse_level_text(r.get('spell_level'))
            existing = by_name.get(norm(r['name']))
            if existing:
                meta = json.loads(existing['meta'])
                for c, l in levels.items():
                    meta.setdefault('levels', {}).setdefault(c, l)
                existing['meta'] = json.dumps(meta)
                continue
            school = r['school'] + (f' ({r["subschool"]})' if r['subschool'] else '') + \
                (f' [{r["descriptor"]}]' if r['descriptor'] else '')
            rows = [('School', school), ('Level', r['spell_level']), ('Casting Time', r['casting_time']),
                    ('Components', r['components']), ('Range', r['range']), ('Area', r['area']),
                    ('Effect', r['effect']), ('Target', r['targets']), ('Duration', r['duration']),
                    ('Saving Throw', r['saving_throw']), ('Spell Resistance', r['spell_resistence'])]
            stat = '<dl class="stat">' + ''.join(f'<dt>{k}</dt><dd>{html.escape(v)}</dd>' for k, v in rows if v) + '</dl>'
            body = r.get('description_formated') or f'<p>{html.escape(r.get("description", ""))}</p>'
            meta = dict(school=r['school'], subschool=r['subschool'], descriptor=r['descriptor'], levels=levels,
                        casting_time=r['casting_time'], components=r['components'], range=r['range'],
                        duration=r['duration'], save=r['saving_throw'], sr=r['spell_resistence'])
            entries.append(dict(cat='Spell', sub=r['school'], name=r['name'], source=r['source'],
                                summary=(r.get('short_description') or '').strip(), html=stat + body,
                                meta=json.dumps(meta), text=clean(body)))
            by_name[norm(r['name'])] = entries[-1]
            added += 1
    return added


# ---------------- class tables ----------------

def find_class(books, name, book_key):
    for b in books:
        if b.key != book_key:
            continue
        for sid, s in b.sections.items():
            if s['type'] == 'class' and s['name'] == name:
                return b, sid
    raise KeyError(name)


def descendants(b, sid):
    for c in b.children.get(sid, []):
        yield b.sections[c]
        yield from descendants(b, c)


def spell_cols(headers):
    cols = {}
    for i, h in enumerate(headers):
        last = h.split('/')[-1].strip()
        m = re.match(r'^(\d)(st|nd|rd|th)?$', last)
        if m and ('Spell' in h or 'Extract' in h or re.match(r'^\d', h)):
            cols[int(m.group(1))] = i
    return cols


def cell_num(v):
    v = (v or '').strip()
    if not v or not re.search(r'\d', v):
        return None
    return parse_int(v)


def parse_class_skills(text):
    text = clean(text)
    found = []
    for sk in SKILLS:
        if sk == 'Knowledge':
            for m in re.finditer(r'Knowledge \(([^)]*)\)', text):
                inner = m.group(1).lower()
                if inner.startswith('all'):
                    found += [f'Knowledge ({k})' for k in KNOWLEDGES]
                else:
                    for k in KNOWLEDGES:
                        if k in inner:
                            found.append(f'Knowledge ({k})')
        elif re.search(r'\b' + re.escape(sk) + r'\b', text):
            found.append(sk)
    return sorted(set(found))


def build_classes(books):
    out = []
    for name, book_key, group, casting in CLASSES:
        b, sid = find_class(books, name, book_key)
        desc = list(descendants(b, sid))
        main = known = prepared = None
        for s in desc:
            if s['type'] != 'table' or not s['body']:
                continue
            t = parse_table(s['body'])
            heads = ' '.join(t['headers'])
            if (heads.startswith('Level Base Attack Bonus') or heads.startswith('Level Bonus Save'))                     and len(t['rows']) >= 20 and main is None:
                main = t
            elif 'Known' in (s['name'] or '') + t['caption'] and len(t['rows']) >= 20 and known is None:
                known = t
            elif 'Prepared' in (s['name'] or '') + t['caption'] and len(t['rows']) >= 20:
                prepared = t
        if main is None:
            print('!! no table for', name, file=sys.stderr)
            continue
        h = main['headers']
        idx = {'Base Attack': 1, 'Fort': 2, 'Ref': 3, 'Will': 4}  # every progression table uses this column order
        special_i = next((i for i, x in enumerate(h) if x.startswith('Special')), None)
        scols = spell_cols(h) if casting else {}
        kcols = spell_cols(known['headers']) if known else {}
        pcols = spell_cols(prepared['headers']) if prepared else {}
        levels = []
        for li, row in enumerate(main['rows'][:20]):
            bab = parse_int(row[idx['Base Attack']])
            lv = dict(level=li + 1, bab=bab, fort=parse_int(row[idx['Fort']]),
                      ref=parse_int(row[idx['Ref']]), will=parse_int(row[idx['Will']]),
                      special=clean(row[special_i]) if special_i is not None else '')
            if casting:
                spd = [None] * 10
                for sl, ci in scols.items():
                    spd[sl] = cell_num(row[ci]) if ci < len(row) else None
                    # paladin-style '0' means bonus spells only
                lv['spells_per_day'] = spd
                if known:
                    kr = known['rows'][li]
                    lv['spells_known'] = [cell_num(kr[kcols[sl]]) if sl in kcols and kcols[sl] < len(kr) else None for sl in range(10)]
                if prepared:
                    pr = prepared['rows'][li]
                    lv['spells_prepared'] = [cell_num(pr[pcols[sl]]) if sl in pcols and pcols[sl] < len(pr) else None for sl in range(10)]
            levels.append(lv)
        skills_sec = next((s for s in desc if (s['name'] or '') == 'Class Skills'), None)
        ranks_sec = next((s for s in desc if (s['name'] or '').startswith('Skill Ranks')), None)
        ranks = parse_int(clean(ranks_sec['body'])) if ranks_sec else None
        skill_text = skills_sec['body'] if skills_sec else ''
        if not clean(skill_text):  # some books put class skills in the class body paragraph
            m = re.search(r'Class Skills(.*?)(Skill Ranks|$)', b.subtree_text(sid), re.S)
            skill_text = m.group(1) if m else ''
            if ranks is None:
                m2 = re.search(r'Skill Ranks per Level:?\s*(\d+)', b.subtree_text(sid))
                ranks = int(m2.group(1)) if m2 else None
        cd = dict(b.class_details.get(sid, {}))
        if not cd.get('hit_die'):
            hd_sec = next((s for s in desc if (s['name'] or '') == 'Hit Die'), None)
            cd['hit_die'] = clean(hd_sec['body']) if hd_sec else None
        max_sl = max([i for i in range(10) if any((lv.get('spells_per_day') or [None] * 10)[i] is not None for lv in levels)] or [0]) if casting else 0
        entry = dict(name=name, group=group, source=b.sections[sid]['source'], hit_die=parse_int(cd.get('hit_die')),
                     alignment=clean(cd.get('alignment')), skill_ranks=ranks,
                     class_skills=parse_class_skills(skill_text), levels=levels)
        if casting:
            entry['casting'] = dict(casting, max_level=max_sl)
        out.append(entry)
    return out


def write_db(entries):
    os.makedirs(os.path.dirname(OUT_DB), exist_ok=True)
    out = OUT_DB
    try:
        if os.path.exists(out):
            os.remove(out)
    except PermissionError:
        # The app has the database open. Write alongside it; app.py swaps it in on next start.
        out = OUT_DB + '.new'
        if os.path.exists(out):
            os.remove(out)
        print(f'NOTE: {OUT_DB} is in use (app running?), wrote {out}; it will be installed when the app restarts.')
    db = sqlite3.connect(out)
    db.executescript('''
        create table entries (id integer primary key, cat text, sub text, name text, source text,
                              summary text, html text, meta text);
        create index entries_cat on entries(cat, name);
        create virtual table entries_fts using fts5(name, summary, text, tokenize='porter unicode61');
    ''')
    entries.sort(key=lambda e: (e['cat'], e['name'].lower()))
    for i, e in enumerate(entries, 1):
        db.execute('insert into entries values (?,?,?,?,?,?,?,?)',
                   (i, e['cat'], e['sub'], e['name'], e['source'], e['summary'], e['html'], e['meta']))
        db.execute('insert into entries_fts(rowid, name, summary, text) values (?,?,?,?)',
                   (i, e['name'], e['summary'], e['text']))
    db.commit()
    db.execute('vacuum')
    db.close()


def write_ogl(books):
    """The Open Game License text and Section 15 notices, shown from the app's sidebar."""
    ogl = next((b for b in books if b.key == 'ogl'), None)
    if not ogl:
        return
    root = next(sid for sid, s in ogl.sections.items() if s['parent_id'] is None)
    body = ogl.render(root, depth=1)
    extra = ('<h4>Pathfinder Sheet</h4><p>This application is not published, endorsed, or specifically approved by Paizo Inc. '
             'Game content is Open Game Content used under the Open Game License v1.0a. Data compiled from the PSRD-Data project '
             '(github.com/devonjones/PSRD-Data) and the community Pathfinder spell spreadsheet. '
             'Quick-rules summaries and application code are original to this application.</p>')
    with open(os.path.join(ROOT, 'web', 'ogl.html'), 'w', encoding='utf-8') as f:
        f.write(extra + body)


def main():
    books = load_books()
    write_ogl(books)
    print('loaded', len(books), 'books')
    entries = build_entries(books)
    added = merge_tsv_spells(entries)
    print('added', added, 'spells from spreadsheet')
    from collections import Counter
    print(Counter(e['cat'] for e in entries))
    write_db(entries)
    classes = build_classes(books)
    with open(OUT_CLASSES, 'w', encoding='utf-8') as f:
        json.dump(classes, f, indent=1)
    print('wrote', len(classes), 'classes')
    comp = companions.build(books)
    with open(OUT_COMPANIONS, 'w', encoding='utf-8') as f:
        json.dump(comp, f, indent=1)
    summon_data, summon_misses = summons.build(books)
    with open(OUT_SUMMONS, 'w', encoding='utf-8') as f:
        json.dump(summon_data, f, indent=1)
    print('wrote summons:', {k: len(v) for k, v in summon_data['families'].items()}, len(summon_data['creatures']), 'stat blocks', summon_misses or '')
    print('wrote companions:', len(comp['animal']['species']), 'animals,', len(comp['familiar']['species']), 'familiars,', len(comp['eidolon']['evolutions']), 'evolutions')


if __name__ == '__main__':
    main()
