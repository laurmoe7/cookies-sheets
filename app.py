"""Pathfinder 1e Character Sheet - desktop app entry point.

Runs a small local HTTP server (127.0.0.1 only) for the UI and the compendium API,
then opens it in a native window via pywebview.

    python app.py            # desktop window
    python app.py --browser  # serve only (open http://127.0.0.1:8765 in a browser)
"""
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

APP_NAME = "Cookie's Sheets"
OLD_APP_NAME = 'Pathfinder Sheet'  # the folder name before the rename
BASE = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(BASE, 'web')
DATA = os.path.join(BASE, 'data')
CHAR_DIR = os.environ.get('PF_CHAR_DIR') or os.path.join(os.path.expanduser('~'), 'Documents', 'Pathfinder Characters')
TRASH_DIR = os.path.join(CHAR_DIR, '.deleted')

DB_PATH = os.environ.get('PF_DB') or os.path.join(DATA, 'pf1e.db')

_local = threading.local()


def install_new_db():
    """tools/build_data.py writes pf1e.db.new when the app had the database open; swap it in at startup."""
    new = DB_PATH + '.new'
    if os.path.exists(new):
        try:
            os.replace(new, DB_PATH)
        except OSError:
            pass  # another copy of the app still has it open; try again next start


def db():
    if not hasattr(_local, 'db'):
        _local.db = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
        _local.db.row_factory = sqlite3.Row
    return _local.db


def fts_query(q):
    words = re.findall(r'[\w\']+', q.lower())
    return ' AND '.join('"%s"*' % w.replace('"', '') for w in words)


CAT_ORDER = ['Spell', 'Feat', 'Condition', 'Trait', 'Class', 'Race', 'Skill', 'Rules', 'Archetype', 'Class Feature',
             'Racial Trait', 'Magic Item', 'Affliction', 'Mythic Spell', 'Monster Ability']


def search(q='', cat='', limit=60, offset=0):
    cats = [c for c in cat.split(',') if c]
    cat_sql = ' and e.cat in (%s)' % ','.join('?' * len(cats)) if cats else ''
    order_cat = 'case e.cat ' + ' '.join(f"when '{c}' then {i}" for i, c in enumerate(CAT_ORDER)) + ' else 99 end'
    cols = 'e.id, e.cat, e.sub, e.name, e.source, e.summary'
    q = (q or '').strip()
    if not q:
        rows = db().execute(f'select {cols} from entries e where 1=1 {cat_sql} order by e.name limit ? offset ?',
                            (*cats, limit, offset)).fetchall()
    else:
        fq = fts_query(q)
        if not fq:
            return []
        ql = q.lower()
        rows = db().execute(
            f'''select {cols} from entries_fts f join entries e on e.id = f.rowid
                where entries_fts match ? {cat_sql}
                order by case when lower(e.name) = ? then 0
                              when lower(e.name) like ? then 1
                              when lower(e.name) like ? then 2 else 3 end,
                         {order_cat}, bm25(entries_fts, 12.0, 3.0, 1.0)
                limit ? offset ?''',
            (fq, *cats, ql, ql + '%', '%' + ql + '%', limit, offset)).fetchall()
    return [dict(r) for r in rows]


def get_entry(id=None, name=None, cat=None):
    if id:
        r = db().execute('select * from entries where id=?', (int(id),)).fetchone()
    else:
        sql, args = 'select * from entries where lower(name)=lower(?)', [name]
        if cat:
            sql += ' and cat=?'
            args.append(cat)
        r = db().execute(sql + ' order by case cat when \'Rules\' then 1 else 0 end limit 1', args).fetchone()
    if not r:
        return None
    d = dict(r)
    d['meta'] = json.loads(d['meta'] or '{}')
    return d


def spells(cls='', level='', q='', school='', limit=1500):
    classes = [c for c in cls.split(',') if c]
    where, args = ["e.cat='Spell'"], []
    if classes:
        where.append('(' + ' or '.join("json_extract(e.meta, '$.levels.\"%s\"') is not null" % c.replace('"', '') for c in classes) + ')')
    if school:
        where.append('lower(e.sub)=lower(?)')
        args.append(school)
    join = ''
    if q.strip():
        join = 'join entries_fts f on f.rowid = e.id'
        where.append('f.name match ?')
        args.append(fts_query(q))
    rows = db().execute(f'select e.id, e.name, e.sub, e.source, e.summary, e.meta from entries e {join} '
                        f'where {" and ".join(where)} order by e.name', args).fetchall()
    out = []
    for r in rows:
        meta = json.loads(r['meta'])
        lv = [meta['levels'][c] for c in classes if c in meta.get('levels', {})]
        lvl = min(lv) if lv else None
        if level != '' and level is not None and str(lvl) != str(level):
            continue
        out.append(dict(id=r['id'], name=r['name'], school=r['sub'], source=r['source'], summary=r['summary'],
                        level=lvl, levels=meta.get('levels', {}), casting_time=meta.get('casting_time'),
                        range=meta.get('range'), duration=meta.get('duration'), save=meta.get('save'),
                        sr=meta.get('sr'), components=meta.get('components')))
        if len(out) >= limit:
            break
    return out


def archetypes(cls):
    """Archetypes for one class, with their parsed features (see tools/archetypes.py)."""
    rows = db().execute("select id, name, source, meta from entries where cat='Archetype' and lower(sub)=lower(?) order by name",
                        (cls or '',)).fetchall()
    return [dict(id=r['id'], name=r['name'], source=r['source'], **json.loads(r['meta'] or '{}')) for r in rows]


def categories():
    return [dict(r) for r in db().execute('select cat, count(*) n from entries group by cat')]


# ---------------- characters ----------------

def _char_path(cid):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', cid or ''):
        raise ValueError('bad id')
    return os.path.join(CHAR_DIR, cid + '.json')


def list_characters():
    os.makedirs(CHAR_DIR, exist_ok=True)
    out = []
    for fn in os.listdir(CHAR_DIR):
        if not fn.endswith('.json'):
            continue
        try:
            with open(os.path.join(CHAR_DIR, fn), encoding='utf-8') as f:
                c = json.load(f)
            levels = {}
            for lu in c.get('levelUps', []):
                levels[lu.get('cls')] = levels.get(lu.get('cls'), 0) + 1
            summary = ' / '.join(f'{k} {v}' for k, v in levels.items()) or 'Level 0'
            out.append(dict(id=c.get('id'), name=c.get('name') or 'Unnamed', race=c.get('race', ''),
                            summary=summary, updated=c.get('updated', 0)))
        except Exception:
            continue
    return sorted(out, key=lambda c: -c['updated'])


def save_character(c):
    os.makedirs(CHAR_DIR, exist_ok=True)
    if not c.get('id'):
        c['id'] = uuid.uuid4().hex[:12]
    c['updated'] = time.time()
    path = _char_path(c['id'])
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(c, f, indent=1)
    os.replace(tmp, path)
    return {'id': c['id'], 'updated': c['updated']}


def load_character(cid):
    with open(_char_path(cid), encoding='utf-8') as f:
        return json.load(f)


def delete_character(cid):
    """Moves the file to a .deleted folder rather than destroying it."""
    os.makedirs(TRASH_DIR, exist_ok=True)
    shutil.move(_char_path(cid), os.path.join(TRASH_DIR, f'{cid}-{int(time.time())}.json'))
    return {'ok': True}


def open_folder():
    os.makedirs(CHAR_DIR, exist_ok=True)
    if sys.platform == 'win32':
        os.startfile(CHAR_DIR)
    else:
        subprocess.Popen(['xdg-open', CHAR_DIR])
    return {'ok': True, 'path': CHAR_DIR}


# ---------------- charactersheet.co.uk import ----------------

CS_ID = re.compile(r'(?<![0-9a-f])([0-9a-f]{24})(?![0-9a-f])', re.I)
# Account details the site embeds in every character; never keep them.
CS_PRIVATE = ('user', 'comments', 'token', 'email', 'emails', 'avatar')


def fetch_charactersheet(ref):
    """Fetch a character from charactersheet.co.uk by sheet URL or id (their API needs no login)."""
    import urllib.request
    m = CS_ID.search(ref or '')
    if not m:
        raise ValueError('That does not look like a charactersheet.co.uk sheet link.')
    req = urllib.request.Request(f'https://charactersheet.co.uk/api/v1/characters/{m.group(1)}',
                                 headers={'Accept': 'application/json', 'User-Agent': APP_NAME})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        raise ValueError(f'Could not download the sheet ({e}). Check the link, or use the site\'s Download button and import the file.')
    if not isinstance(data, dict) or not data:
        raise ValueError('The site returned no character for that link.')
    for k in CS_PRIVATE:
        data.pop(k, None)
    return data


def resolve_names(body):
    """Match free-text names to compendium entries.

    body: {"items": [{"variants": [...], "cats": [...]}]}; returns one {id,name,cat,sub} or null per item,
    trying each variant in order and preferring categories in the order given."""
    out = []
    for it in (body or {}).get('items', [])[:2000]:
        cats = [c for c in it.get('cats') or [] if isinstance(c, str)][:12]
        hit = None
        for v in it.get('variants') or []:
            if not isinstance(v, str) or not v.strip():
                continue
            sql = 'select id, name, cat, sub from entries where lower(name)=lower(?)'
            args = [v.strip()]
            if cats:
                sql += ' and cat in (%s) order by case cat %s end' % (
                    ','.join('?' * len(cats)), ' '.join(f'when ? then {i}' for i in range(len(cats))))
                args += cats + cats
            r = db().execute(sql + ' limit 1', args).fetchone()
            if r:
                hit = dict(r)
                break
        out.append(hit)
    return out


# ---------------- HTTP ----------------

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'}
    protocol_version = 'HTTP/1.1'  # keep-alive: far fewer connections when loading the UI

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null')

    def _route(self, method):
        u = urlparse(self.path)
        if not u.path.startswith('/api/'):
            return False
        p = {k: v[0] for k, v in parse_qs(u.query).items()}
        route = (method, u.path[5:])
        try:
            if route == ('GET', 'classes'):
                with open(os.path.join(DATA, 'classes.json'), encoding='utf-8') as f:
                    self._json(json.load(f))
            elif route == ('GET', 'search'):
                self._json(search(p.get('q', ''), p.get('cat', ''), int(p.get('limit', 60)), int(p.get('offset', 0))))
            elif route == ('GET', 'entry'):
                self._json(get_entry(p.get('id'), p.get('name'), p.get('cat')))
            elif route == ('GET', 'spells'):
                self._json(spells(p.get('cls', ''), p.get('level', ''), p.get('q', ''), p.get('school', '')))
            elif route == ('GET', 'archetypes'):
                self._json(archetypes(p.get('cls', '')))
            elif route == ('GET', 'companions'):
                with open(os.path.join(DATA, 'companions.json'), encoding='utf-8') as f:
                    self._json(json.load(f))
            elif route == ('GET', 'fcb'):
                with open(os.path.join(DATA, 'fcb.json'), encoding='utf-8') as f:
                    self._json(json.load(f))
            elif route == ('GET', 'summons'):
                with open(os.path.join(DATA, 'summons.json'), encoding='utf-8') as f:
                    self._json(json.load(f))
            elif route == ('GET', 'categories'):
                self._json(categories())
            elif route == ('GET', 'characters'):
                self._json(list_characters())
            elif route == ('GET', 'character'):
                self._json(load_character(p.get('id')))
            elif route == ('POST', 'character'):
                self._json(save_character(self._body()))
            elif route == ('POST', 'character/delete'):
                self._json(delete_character(p.get('id')))
            elif route == ('POST', 'open-folder'):
                self._json(open_folder())
            elif route == ('GET', 'cs-fetch'):
                self._json(fetch_charactersheet(p.get('id', '')))
            elif route == ('POST', 'resolve'):
                self._json(resolve_names(self._body()))
            else:
                self._json({'error': 'not found'}, 404)
        except FileNotFoundError:
            self._json({'error': 'not found'}, 404)
        except Exception as e:  # surface errors to the UI instead of hanging
            self._json({'error': str(e)}, 500)
        return True

    def do_GET(self):
        if not self._route('GET'):
            super().do_GET()

    def do_POST(self):
        if not self._route('POST'):
            self._json({'error': 'not found'}, 404)


def start_server(port):
    srv = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    install_new_db()
    browser = '--browser' in sys.argv
    port = int(os.environ.get('PF_PORT') or 8765)
    for p in range(port, port + 20):
        try:
            srv = start_server(p)
            port = p
            break
        except OSError:
            continue
    url = f'http://127.0.0.1:{port}/'
    if browser:
        print('Serving', url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return
    import webview
    webview.settings['ALLOW_DOWNLOADS'] = True  # lets 'Export' save character files
    if sys.platform == 'win32':
        # Own taskbar identity, so the window shows the d20 icon instead of grouping under Python.
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('PathfinderSheet.App')
        except Exception:
            pass
    # Keep browser storage (theme, last opened character) between launches.
    base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    storage = os.path.join(base, APP_NAME, 'webview')
    old_storage = os.path.join(base, OLD_APP_NAME, 'webview')
    if os.path.isdir(old_storage) and not os.path.exists(storage):  # keep the saved theme and last character through the rename
        try:
            os.makedirs(os.path.dirname(storage), exist_ok=True)
            os.rename(old_storage, storage)
        except OSError:
            pass
    webview.create_window(APP_NAME, url, width=1400, height=900, min_size=(1000, 650))
    webview.start(icon=os.path.join(WEB, 'icon.ico'), private_mode=False, storage_path=storage)
    srv.shutdown()


if __name__ == '__main__':
    main()
