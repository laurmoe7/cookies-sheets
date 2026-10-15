"""The standard weapons and armor from Ultimate Equipment's tables, for data/equipment.json (the "＋ Add weapon" and "＋ Add armor" template lists).

Weapons come from the Simple, Martial and Exotic tables (grouped Light Melee, One-Handed Melee, Two-Handed Melee, Ranged, Ammunition);
armor from the Armor and Shields table (Light, Medium, Heavy, Shields; the "Extras" rows are not armor and are left out).
"""
import html
import re

WEAPON_TABLES = {'Simple': 105, 'Martial': 106, 'Exotic': 107}
ARMOR_TABLE = 36


def _text(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    return re.sub(r'\s+', ' ', s.replace('–', '-').replace('−', '-')).strip()


def _dash(s):
    return '' if s in ('—', '-', '–') else s


def _rows(body):
    """[(group heading or None, [cells])] for a PSRD equipment table: heading rows have a <th>, item rows <td> cells."""
    out, group = [], None
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body or '', re.S):
        ths = re.findall(r'<th[^>]*>(.*?)</th>', tr, re.S)
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
        if ths and not tds:
            first = _text(ths[0])
            if len(ths) == 1 or _text(ths[1]).lower() in ('price', 'cost'):
                group = first
            continue
        if tds:
            out.append((group, [_text(t) for t in tds]))
    return out


def weight_of(s):
    m = re.match(r'^(\d+)\s*/\s*(\d+)', s or '')
    if m:
        return int(m.group(1)) / int(m.group(2))
    m = re.match(r'^(\d+(?:\.\d+)?)', s or '')
    return float(m.group(1)) if m else 0


def _crit(s):
    return _dash(s).replace('×', 'x')


def build(books):
    ue = next((b for b in books if b.key == 'ue'), None)
    if ue is None:
        return {'weapons': [], 'armor': []}

    def body(sid):
        return ue.sections[sid]['body'] if sid in ue.sections else ''

    weapons = []
    for prof, sid in WEAPON_TABLES.items():
        for group, c in _rows(body(sid)):
            if len(c) < 9 or not c[0] or not group or 'ammunition' in group.lower():
                continue
            g = group.lower()
            kind = 'ranged' if 'ranged' in g else 'two-handed' if 'two-handed' in g else 'one-handed' if 'one-handed' in g else 'light' if 'light' in g else 'unarmed'
            weapons.append(dict(name=c[0], prof=prof, kind=kind, cost=_dash(c[1]), dmgS=_dash(c[2]), dmgM=_dash(c[3]), crit=_crit(c[4]), range=_dash(c[5]),
                                weight=weight_of(c[6]), type=_dash(c[7]), special=_dash(c[8])))
    armor = []
    for group, c in _rows(body(ARMOR_TABLE)):
        if len(c) < 9 or not c[0] or not group or group.lower().startswith('extra'):
            continue
        cat = 'shield' if group.lower().startswith('shield') else group.split()[0].lower()  # light / medium / heavy
        bonus = re.search(r'\d+', c[2])
        dex = re.search(r'\d+', c[3])
        acp = re.search(r'\d+', c[4])
        asf = re.search(r'\d+', c[5])
        armor.append(dict(name=c[0], category=cat, cost=_dash(c[1]), bonus=int(bonus.group()) if bonus else 0, maxDex=int(dex.group()) if dex else None,
                          acp=-int(acp.group()) if acp else 0, asf=int(asf.group()) if asf else 0, speed30=re.sub(r'\s+\d$', '', _dash(c[6])), speed20=re.sub(r'\s+\d$', '', _dash(c[7])), weight=weight_of(c[8])))
    weapons.sort(key=lambda w: (w['name'].lower(), w['prof']))
    armor.sort(key=lambda a: (['light', 'medium', 'heavy', 'shield'].index(a['category']) if a['category'] in ('light', 'medium', 'heavy', 'shield') else 9, a['bonus'], a['name'].lower()))
    return {'weapons': weapons, 'armor': armor}


# ---------- the compendium: combat stats on the weapon and armor entries ----------

def name_key(name):
    """A name as a sorted set of words, so "Chain, Spiked", "Spiked Chain" and "spiked chain" are one key."""
    return ' '.join(sorted(re.findall(r'[a-z0-9]+', str(name).lower())))


def weapon_groups(books):
    """{group name: set of name keys} from the Core Rulebook's fighter weapon training groups (axes, flails, hammers...)."""
    cr = next((b for b in books if b.key == 'cr'), None)
    out = {}
    if cr is None:
        return out
    for sid, sec in cr.sections.items():
        if sec['name'] != 'Weapon Training' or sec['type'] != 'ability':
            continue
        for c in cr.children.get(sid, []):
            kid = cr.sections[c]
            text = _text(kid['body'])
            if not kid['name'] or not text:
                continue
            names = [n.strip(' .') for n in re.split(r',|\band\b', text) if n.strip(' .')]
            out[kid['name'].lower()] = {name_key(n) for n in names}
    return out


TYPES = {'B': 'bludgeoning', 'P': 'piercing', 'S': 'slashing'}
KINDS = {'light': 'light', 'one-handed': 'one-handed', 'two-handed': 'two-handed', 'ranged': 'ranged', 'unarmed': 'unarmed attack'}


def _damage_types(t):
    return re.sub(r'\b[BPS]\b', lambda m: TYPES[m.group()], t or '').strip()


def weapon_pairs(w, groups):
    """[(label, value)] for a weapon entry, in the order the books print them."""
    key = name_key(w['name'])
    grp = sorted(g for g, keys in groups.items() if key in keys)
    dmg = ', '.join(f'{d} ({size})' for d, size in ((w['dmgS'], 'small'), (w['dmgM'], 'medium')) if d)
    pairs = [('Damage', dmg), ('Critical', w['crit'] or 'x2')]
    if w['range']:
        pairs.append(('Range', w['range']))
    pairs += [('Type', _damage_types(w['type'])), ('Category', KINDS.get(w['kind'], w['kind'])), ('Proficiency', w['prof'].lower())]
    if grp:
        pairs.append(('Weapon Group', ', '.join(grp)))
    if w['special']:
        pairs.append(('Special', w['special'].lower()))
    return pairs


def armor_pairs(a):
    dex = 'none' if a['maxDex'] is None else f"+{a['maxDex']}"
    pairs = [('Shield Bonus' if a['category'] == 'shield' else 'Armor Bonus', f"+{a['bonus']}"), ('Maximum Dex Bonus', dex),
             ('Armor Check Penalty', str(a['acp'])), ('Arcane Spell Failure', f"{a['asf']}%")]
    if a['speed30']:
        pairs.append(('Speed', f"{a['speed30']} (base 30 ft.), {a['speed20']} (base 20 ft.)"))
    pairs.append(('Category', 'shield' if a['category'] == 'shield' else f"{a['category']} armor"))
    return pairs


def _dl(pairs):
    from html import escape
    return ''.join(f'<dt>{escape(k)}</dt><dd>{escape(v)}</dd>' for k, v in pairs if v)


# Core Rulebook names that Ultimate Equipment spells differently (the same weapon)
ALIASES = {'flail': 'light flail', 'short sword': 'shortsword'}


def enrich(entries, gear, groups):
    """Adds combat stats to the standard weapon and armor entries (the compendium files them under Magic Item with only a price and weight).
    Matched by name as a set of words. Returns how many entries got stats."""
    widx = {name_key(w['name']): w for w in gear['weapons']}
    widx.update({name_key(k): widx[name_key(v)] for k, v in ALIASES.items() if name_key(v) in widx})
    aidx = {name_key(a['name'] + (' shield' if a['category'] == 'shield' else '')): a for a in gear['armor']}
    aidx.update({name_key(a['name']): a for a in gear['armor'] if a['category'] == 'shield'})  # the compendium files some shields as "Buckler", others as "Shield, Heavy Steel"
    n = 0
    for e in entries:
        if e['cat'] != 'Magic Item':
            continue
        key = name_key(e['name'])
        if key in widx:
            w = widx[key]
            pairs = weapon_pairs(w, groups)
            hit = ' '.join(x for x in (w['dmgM'], _damage_types(w['type'])) if x)  # a net has no damage
            line = f"{w['prof']} {KINDS.get(w['kind'], w['kind'])} weapon" + (f": {hit}, {w['crit'] or 'x2'}." if hit else ".")
        elif key in aidx:
            a = aidx[key]
            pairs = armor_pairs(a)
            line = f"{a['category'].title()} {'shield' if a['category'] == 'shield' else 'armor'}: +{a['bonus']} AC, check penalty {a['acp']}."
        else:
            continue
        stats = _dl(pairs)
        html = (e['html'] or '').replace('<dd>�</dd>', '<dd>—</dd>')  # a price of "—" came through the source as a broken character
        e['html'] = html.replace('</dl>', stats + '</dl>', 1) if html.lstrip().startswith('<dl class="stat">') else f'<dl class="stat">{stats}</dl>' + html
        if not e['summary']:
            e['summary'] = line
        e['text'] = (e['text'] or '') + ' ' + ' '.join(v for _, v in pairs)
        n += 1
    return n
