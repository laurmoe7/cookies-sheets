"""Archetypes from Archives of Nethys, for the ones the PSRD books do not have.

Only archetypes missing from the PSRD data are added (`build_data.py` skips any class + name it already
has). The pages are fetched once, politely, into `tools/sources/aon/` (git-ignored); the parsed result is
`data/aon_archetypes.json` (committed), so a normal build needs no network.

    python tools/aon_archetypes.py Ninja Samurai     # fetch what is not cached yet, then parse

Each archetype page is a flat run of `<b>Feature (Ex)</b>: text <br/><br/>` paragraphs, with the source book
first; the parts are turned into the same shape `archetypes.parse_archetype` gives for PSRD.
"""
import html
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

import archetypes

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'sources', 'aon')
OUT = os.path.join(HERE, '..', 'data', 'aon_archetypes.json')
BASE = 'https://www.aonprd.com/'
AGENT = 'CookiesSheets-personal-tool (one-time import)'
DELAY = 3  # seconds between requests
STRAY = re.compile('[' + chr(0xdc80) + '-' + chr(0xdcff) + ']')


def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


def decode(raw):
    """The pages mix UTF-8 with stray Windows-1252 bytes (an en dash is a lone 0x96): keep the valid UTF-8
    and read the leftover bytes as Windows-1252."""
    text = raw.decode('utf-8', 'surrogateescape')
    return STRAY.sub(lambda m: bytes([ord(m.group()) - 0xdc00]).decode('cp1252', 'replace'), text)


def fetch(url, path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': AGENT})
        with open(path, 'wb') as f:
            f.write(urllib.request.urlopen(req, timeout=30).read())
        time.sleep(DELAY)
    with open(path, 'rb') as f:
        return decode(f.read())


def list_names(cls):
    """Archetype names AoN lists for a class (its list page is cached as list_<cls>.html)."""
    page = fetch(f'{BASE}Archetypes.aspx?Class={urllib.parse.quote(cls)}', os.path.join(CACHE, f'list_{cls}.html'))
    names = re.findall(r'ArchetypeDisplay\.aspx\?FixedName=[^"]*"[^>]*>(?:<[^>]+>)*([^<]+)', page)
    return list(dict.fromkeys(html.unescape(n).strip() for n in names))


def page_for(cls, name):
    url = BASE + 'ArchetypeDisplay.aspx?FixedName=' + urllib.parse.quote(f'{cls} {name}')
    return fetch(url, os.path.join(CACHE, f'{cls}_{re.sub(r"[^A-Za-z0-9]", "_", name)}.html'))


def parse_page(cls, name, page):
    m = re.search(r'<span id="MainContent_DataListTypes_LabelName_0">(.*?)</span>\s*</td>', page, re.S)
    body = re.sub(r'<h1 class="title">.*?</h1>', '', m.group(1), flags=re.S)
    src = re.search(r'<b>Source</b>\s*<a[^>]*>\s*<i>(.*?)</i>', body, re.S)
    source = re.sub(r'\s+pg\.?\s*\d+.*$', '', html.unescape(src.group(1)).strip()) if src else 'Archives of Nethys'
    body = re.sub(r'<b>Source</b>.*?</a>(?:<br\s*/?>)?', '', body, count=1, flags=re.S)
    # paragraphs are separated by <br /><br />; a feature paragraph starts with <b>Name (Ex)</b>:
    paras = [p.strip() for p in re.split(r'(?:<br\s*/?>\s*){2,}', body) if p.strip()]
    intro, kids = [], []
    for p in paras:
        h = re.match(r'<b>(.*?)</b>\s*:?\s*(.*)$', p, re.S)
        if h:
            kids.append(['section', html.unescape(re.sub(r'<[^>]+>', '', h.group(1))).strip(), h.group(2), None])
        elif kids:  # "This ability replaces ..." continues the feature above
            kids[-1][2] += ' ' + p
        else:
            intro.append(p)
    for k in kids:
        k[2] = k[2].strip()
        k[3] = '<p>' + k[2] + '</p>'
    meta = archetypes.parse_archetype(name, cls, '<p>' + ' '.join(intro) + '</p>', [tuple(k) for k in kids])
    meta['aon'] = True  # marks it as not from PSRD, so a rebuild still sees what PSRD lacks
    for f in meta['features']:
        f['html'] = re.sub(r'<(?:br|hr)\s*/?>', ' ', f['html'])
    return dict(name=name, cls=cls, source=source, meta=meta)


def psrd_have():
    """(class, name) pairs the PSRD build already has, so only missing archetypes are fetched."""
    db = os.path.join(HERE, '..', 'data', 'pf1e.db')
    if not os.path.exists(db):
        return set()
    con = sqlite3.connect(db)
    return {(json.loads(m)['cls'], norm(n)) for n, m in con.execute("select name, meta from entries where cat='Archetype'")
            if not json.loads(m).get('aon')}


def main(classes):
    result = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else []
    have = {(r['cls'], norm(r['name'])) for r in result} | psrd_have()
    for cls in classes:
        for name in list_names(cls):
            if (cls, norm(name)) in have:
                continue
            result.append(parse_page(cls, name, page_for(cls, name)))
            print('parsed', cls, name)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
