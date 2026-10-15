"""Alternate racial traits: which standard traits they replace, and one name per race.

Almost every racial trait after the first few for a race ends with "This racial trait replaces X." We read X
into `meta.replaces` and put "Replaces X." in the entry's summary, so the pickers can show it.
"""
import html
import re

# Some books name the race in the plural; the pickers filter on one name per race.
RACE_NAMES = {'Dwarves': 'Dwarf', 'Elves': 'Elf', 'Gnomes': 'Gnome', 'Half-Elves': 'Half Elf', 'Half-Orcs': 'Half Orc',
              'Halflings': 'Halfling', 'Humans': 'Human'}

REPLACES = re.compile(r'racial traits? (?:also )?replaces? ([^.]*)\.', re.I)
CUT = re.compile(r'\s+(?:and|but)\s+(?:alters?|modif(?:y|ies)|changes?)\b.*$', re.I)
SPLIT = re.compile(r',\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s+as well as\s+', re.I)
TAIL = re.compile(r'\s+(?:racial\s+)?traits?$', re.I)


ALTERS = re.compile(r'racial traits? (?:also )?alters? ([^.]*)\.', re.I)


def altered_traits(text):
    """What a trait that only alters (does not replace) one says it changes, e.g. ['the kitsune ability score modifiers']; [] if none."""
    plain = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', text or '')))
    m = ALTERS.search(plain)
    return [re.sub(r'^(?:the|a|an)\s+', '', p.strip(), flags=re.I) for p in SPLIT.split(m.group(1)) if p.strip()] if m else []


def replaced_traits(text):
    """['agile'] from 'This racial trait replaces agile.'; [] when the text replaces nothing."""
    plain = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', text or '')))
    m = REPLACES.search(plain)
    if not m:
        return []
    out = []
    for part in SPLIT.split(CUT.sub('', m.group(1))):
        p = TAIL.sub('', re.sub(r'^(?:the|a|an)\s+', '', part.strip(), flags=re.I)).strip(' ,;')
        if p and p.lower() not in ('trait', 'racial trait') and p not in out:
            out.append(p)
    return out
