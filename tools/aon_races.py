"""The standard racial traits of the non-core races, from Archives of Nethys, for the races the app has.

The PSRD books list the standard traits of the seven core races, and only the alternates for most of the others. Each AoN race page
has a flat "<Race> Racial Traits" list (`<b>Name</b>: text<br />`), which is read here. Pages are fetched once, 3 seconds apart, into
`tools/sources/aon/races/` (git-ignored); the result is `data/aon_race_traits.json` (committed), so a normal build needs no network.

    python tools/aon_races.py            # every race in web/js/data.js that is not a core race
    python tools/aon_races.py Kitsune    # just these
"""
import html
import json
import os
import re
import sys
import urllib.parse

from aon_archetypes import AGENT, BASE, CACHE, fetch, norm  # noqa: F401  (the same polite fetching and decoding)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_JS = os.path.join(HERE, '..', 'web', 'js', 'data.js')
OUT = os.path.join(HERE, '..', 'data', 'aon_race_traits.json')
RACE_CACHE = os.path.join(CACHE, 'races')
CORE = {'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Custom'}  # the books already give these in full


def app_races():
    """The races the app knows, in the order of RACES in web/js/data.js, without the core ones."""
    with open(DATA_JS, encoding='utf-8') as f:
        src = f.read()
    block = src[src.index('export const RACES'):]
    block = block[:block.index('\n};')]
    return [m.group(1) for m in re.finditer(r"^  '([^']+)': \{", block, re.M) if m.group(1) not in CORE]


def clean(frag):
    """A trait's text: links become plain words, italics stay."""
    frag = re.sub(r'<a\b[^>]*>(.*?)</a>', r'\1', frag, flags=re.S)
    frag = re.sub(r'<img\b[^>]*>', '', frag)
    frag = re.sub(r'<(?!/?i\b)[^>]+>', '', frag)
    return re.sub(r'\s+', ' ', frag).strip()


def parse_race(race, page):
    """[(trait name, source, html text)] from the standard "Racial Traits" list of a race page."""
    m = re.search(r'<h1 class="title">[^<]*\bRacial Traits</h1>(.*?)(?=<h1 class="title">|$)', page, re.S)
    if not m:
        return []
    src = re.search(r'<b>Source</b>(.*?)(?:<br|<h)', page, re.S)
    srcs = [re.sub(r'\s+pg\.?.*$', '', html.unescape(re.sub(r'<[^>]+>', '', s)).strip()) for s in re.findall(r'<i>(.*?)</i>', src.group(1))] if src else []
    source = next((s for s in srcs if s == 'Advanced Race Guide'), srcs[0] if srcs else 'Archives of Nethys')
    out = []
    for part in re.split(r'<br\s*/?>', m.group(1)):
        part = re.sub(r'<h2[^>]*>.*?</h2>', '', part, flags=re.S).strip()
        h = re.match(r'<b>(.*?)</b>\s*:?\s*(.*)$', part, re.S)
        if not h:
            continue
        name = html.unescape(re.sub(r'<[^>]+>', '', h.group(1))).strip()
        text = clean(h.group(2))
        if re.match(r'^[+−\-–±�]?\s*\d', name) or re.match(r'^[+\-]', name):  # "+2 Dexterity, +2 Charisma, -2 Strength"
            name, text = 'Ability Score Modifiers', clean(h.group(1)) + ': ' + text
        if name and text:
            out.append((name, source, text))
    return out


def main(races):
    result = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else []
    done = {r['race'] for r in result}
    for race in races or app_races():
        if race in done:
            continue
        page = fetch(f'{BASE}RacesDisplay.aspx?ItemName={urllib.parse.quote(race)}', os.path.join(RACE_CACHE, race.replace(' ', '_') + '.html'))
        traits = parse_race(race, page)
        print(race, len(traits), [t[0] for t in traits][:6])
        result.extend(dict(race=race, name=n, source=s, text=t) for n, s, t in traits)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
