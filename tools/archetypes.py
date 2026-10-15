"""Turns PSRD archetype sections into structured data the app can apply to a character.

For each archetype feature we record its level and which base class features it replaces or modifies,
so the sheet can swap them in the class feature list. We also pick up class-skill changes and
"Diminished Spellcasting" (one fewer spell per day of each level).

The matching of replaced names against the class table happens in the app (web/js/features.js).
"""
import html
import re

ORDINAL = r'(\d+)(?:st|nd|rd|th)'
SKILL_NAMES = ['Acrobatics', 'Appraise', 'Bluff', 'Climb', 'Craft', 'Diplomacy', 'Disable Device', 'Disguise',
               'Escape Artist', 'Fly', 'Handle Animal', 'Heal', 'Intimidate', 'Linguistics', 'Perception', 'Perform',
               'Profession', 'Ride', 'Sense Motive', 'Sleight of Hand', 'Spellcraft', 'Stealth', 'Survival', 'Swim',
               'Use Magic Device']
KNOWLEDGES = ['arcana', 'dungeoneering', 'engineering', 'geography', 'history', 'local', 'nature', 'nobility',
              'planes', 'religion']
# Headings that recommend options rather than grant a feature.
ADVICE = re.compile(r'complement|recommended|are good choices|following .* are (?:especially )?(?:useful|suited)', re.I)


def text_of(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def first_level(text):
    m = re.search(r'\b(?:at|beginning at|starting at|upon reaching)\s+' + ORDINAL + r'[- ]level', text, re.I)
    return int(m.group(1)) if m else None


def _singular(w):
    if w.endswith('ies'):
        return w[:-3] + 'y'
    if w.endswith('s') and not w.endswith('ss') and not w.endswith('us'):
        return w[:-1]
    return w


def parse_targets(phrase):
    """'uncanny dodge, improved uncanny dodge, and damage reduction' -> [{name, levels}].

    Handles 'the arcanist exploits gained at 1st and 9th levels', 'armor training 1, 2, 3, and 4',
    "the 1st-, 7th-, and 13th-level bonus feats"."""
    p = phrase.strip().rstrip('.').strip()
    p = re.split(r'\s+(?:and|but)\s+(?:alters?|modif(?:y|ies)|changes?|replaces?)\b', p, maxsplit=1)[0]
    p = re.sub(r'\([^)]*\)', '', p)
    levels = []
    if re.search(r'level', p, re.I):
        levels = sorted({int(x) for x in re.findall(ORDINAL, p)})
        p = re.sub(r'\b(?:gained|received|obtained|granted)?\s*(?:at|from)\s+(?:' + ORDINAL + r'(?:,?\s*(?:and|or)?\s*)?)+\s*levels?\b', '', p, flags=re.I)
        p = re.sub(ORDINAL + r'-?,?\s*(?:and|or)?\s*', '', p)
        p = re.sub(r'-?\s*levels?\b', '', p, flags=re.I)
    out = []
    prev = None
    # Split on commas (and a final ", and"); keep "x and y" whole, since many feature names contain "and"
    # ("tongue of the sun and moon"). The app tries the whole name first, then the and/or parts.
    for part in re.split(r',\s*(?:and|or)?\s*', p):
        t = clean_target(part)
        if not t:
            continue
        if re.fullmatch(r'(?:and\s+|or\s+)?\d+', t) and prev:  # "armor training 1, 2, and 3"
            base = re.sub(r'\s+\d+$', '', prev['name'])
            out.append(dict(name=f'{base} {t.split()[-1]}', text=f'{base} {t.split()[-1]}', parts=[], levels=levels))
            continue
        pieces = [clean_target(x) for x in re.split(r'\s+(?:and|or)\s+', t)]
        pieces = [x for x in pieces if x and x != t] if len(pieces) > 1 else []
        # "hunter's bond" is a feature name, but "witch's hex" means "hex": try with the possessive first.
        bare = clean_target(re.sub(r"^[a-z]+['’]s\s+", '', t))
        if bare and bare != t:
            pieces.append(bare)
        prev = dict(name=t, text=clean_target(part, singular=False), parts=pieces, levels=levels)
        out.append(prev)
    return [x for x in out if len(x['name']) > 2 and x['name'] not in ('this', 'that', 'it', 'them')]


def clean_target(t, singular=True):
    """Normalised feature name; singular=False keeps the wording for display ("jack of all trades")."""
    t = t.strip().lower().replace(chr(0x2019), "'")
    t = re.sub(r"^(?:and|or)\s+", '', t)
    for _ in range(3):
        t = re.sub(r"^(?:the|a|an|her|his|its|their|all|standard|normal|usual|regular|existing|later|first)\s+", '', t)
    t = re.sub(r"\s*(?:class features?|abilit(?:y|ies)|features?|normally|as normal)$", '', t).strip(" -'")
    if not t:
        return ''
    if not singular:
        return t
    words = t.split()
    words[-1] = _singular(words[-1])
    return ' '.join(words)


REPLACE = re.compile(r'\breplac(?:es|e|ing)\s+([^.;]+)', re.I)
MODIFY = re.compile(r'\b(?:alters?|modif(?:ies|y)|changes)\s+(?!to\b)([^.;]+)', re.I)


def replaced_and_modified(text):
    reps, mods = [], []
    for m in REPLACE.finditer(text):
        tgt = m.group(1)
        if re.match(r'\s*(?:it|them|this|that)\b', tgt, re.I):
            continue
        reps += parse_targets(tgt)
    for m in MODIFY.finditer(text):
        before = text[max(0, m.start() - 40):m.start()].lower()
        if not re.search(r'(this|these|which|ability|and)\s*$', before):
            continue
        mods += parse_targets(m.group(1))
    return reps, mods


def _skills_in(seg):
    found = []
    if re.search(r'all\s+Knowledge\s+skills|Knowledge\s*\(all\)', seg, re.I):
        found += [f'Knowledge ({k})' for k in KNOWLEDGES]
    for m in re.finditer(r'Knowledge\s*\(([^)]*)\)', seg):
        found += [f'Knowledge ({k})' for k in KNOWLEDGES if k in m.group(1).lower()]
    for sk in SKILL_NAMES:
        if re.search(r'\b' + re.escape(sk) + r'\b', seg):
            found.append(sk)
    return found


REMOVE_MARK = re.compile(r'(but does not gain|does not gain|and removes|removes|rather than|instead of|;\s*instead,?|instead,)', re.I)


def class_skill_changes(text):
    """Return {'add': [...], 'remove': [...]} from sentences about class skills."""
    add, remove = [], []
    for sent in re.split(r'(?<=[.!?])\s+', text):
        if 'class skill' not in sent.lower():
            continue
        if re.search(r'no additional class skills|gains these as normal|replace the additional class skills|in addition to the normal', sent, re.I) \
                and not re.search(r'adds?\b', sent, re.I):
            continue
        parts = REMOVE_MARK.split(sent)
        polarity = 'add'
        for seg in parts:
            low = seg.lower().strip()
            if REMOVE_MARK.fullmatch(seg.strip()):
                polarity = 'add' if 'instead' in low and 'of' not in low else 'remove'
                continue
            (add if polarity == 'add' else remove).extend(_skills_in(seg))
    add = sorted(set(add))
    remove = sorted(set(remove) - set(add))
    return dict(add=add, remove=remove)


def parse_archetype(name, cls, body_html, children):
    """children: [(type, name, html, child_html_rendered)] for each direct child section."""
    features, all_text = [], text_of(body_html)
    diminished = False
    for typ, fname, fhtml, rendered in children:
        text = text_of(rendered or fhtml)
        all_text += ' ' + text
        if (fname or '').lower().startswith('diminished spellcasting') or re.search(r'one fewer spell (?:of each level|per day)', text, re.I):
            diminished = diminished or 'spells known' not in text.lower()
        advice = typ == 'section' and bool(ADVICE.search(text)) and not REPLACE.search(text)
        reps, mods = replaced_and_modified(text)
        features.append(dict(name=fname, level=first_level(text), replaces=reps, modifies=mods,
                             advice=advice, html=rendered or fhtml or ''))
    intro = re.split(r'(?<=[.!?])\s', text_of(body_html))
    return dict(cls=cls, description=' '.join(intro[:3]).strip(), features=features,
                classSkills=class_skill_changes(all_text), diminished=diminished)
