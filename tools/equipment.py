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
