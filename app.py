"""Cookie's Sheets, a Pathfinder 1e character sheet - desktop app entry point.

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
import traceback
import uuid
import updater
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

APP_NAME = "Cookie's Sheets"
OLD_APP_NAME = 'Pathfinder Sheet'  # the folder name before the rename
BASE = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(BASE, 'web')
DATA = os.path.join(BASE, 'data')
CHAR_DIR = os.environ.get('PF_CHAR_DIR') or os.path.join(os.path.expanduser('~'), 'Documents', 'Pathfinder Characters')
TRASH_DIR = os.path.join(CHAR_DIR, '.deleted')
HISTORY_DIR = os.path.join(CHAR_DIR, '.history')
HISTORY_EVERY = 300   # seconds: a save is only copied to .history when the newest copy is older than this
HISTORY_KEEP = 5      # copies kept per character


def log_error(text):
    """Appends to error.log in the app's settings folder; the windowed app has no console, so this is how problems get reported."""
    try:
        folder = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), APP_NAME)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, 'error.log'), 'a', encoding='utf8') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + text.rstrip() + '\n')
    except OSError:
        pass

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


def close_db():
    """Closes this thread's connection. The server gives every browser connection its own thread, which closes it when the connection ends."""
    conn = getattr(_local, 'db', None)
    if conn is not None:
        conn.close()
        del _local.db


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


WEAPON_WORDS = ('dagger|sword|rapier|scimitar|falchion|sabre|katana|axe|hammer|mace|morningstar|flail|club|quarterstaff|spear|trident|halberd|glaive|lance|scythe|'
                'sickle|kukri|bow|crossbow|sling|dart|javelin|shuriken|gauntlet|blade|knife')
WEAPON_RX = re.compile(r"\+\d+\s+[a-z ,'-]{0,60}?(?:%s)s?\b" % WEAPON_WORDS, re.I)
WEAPON_NAME_RX = re.compile(r'(?:%s)s?\b' % WEAPON_WORDS, re.I)
ARMOR_NAME_RX = re.compile(r'armor|plate|mail|shield|buckler|leather|\bhide\b|breastplate|aegis|bulwark', re.I)


def magic_gear(kind, q='', limit=150):
    """Magic items that are weapons ('weapon') or armor and shields ('armor') for the "+ Magic item" pickers.
    The compendium tags armor and shields (sub) but not weapons, so those are the items with no slot whose text names a +N weapon."""
    q = (q or '').strip().lower()
    cols = 'id, cat, sub, name, source, summary'
    if kind == 'weapon':
        rows = db().execute(f"select {cols}, html from entries where cat='Magic Item' and html like '%<dt>Slot</dt><dd>none%'").fetchall()

        def keep(r):
            if re.match(r'rod\b', r['name'], re.I):
                return False
            text = re.sub(r'<[^>]+>', ' ', (r['html'] or '').split('</dl>')[-1])[:500]
            return bool(WEAPON_RX.search(text) or WEAPON_NAME_RX.search(r['name']))
    else:
        rows = db().execute(f"select {cols}, html from entries where cat='Magic Item' and (sub in ('armor','shield','') or sub is null)").fetchall()

        def keep(r):
            return r['sub'] in ('armor', 'shield') or bool(ARMOR_NAME_RX.search(r['name']))
    out = [{k: r[k] for k in r.keys() if k != 'html'} for r in rows if keep(r) and q in r['name'].lower()]
    out.sort(key=lambda r: r['name'].lower())
    return out[:limit]


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


def _summary(c):
    """'Fighter 2 / Rogue 1' from the level-ups."""
    levels = {}
    for lu in c.get('levelUps', []):
        levels[lu.get('cls')] = levels.get(lu.get('cls'), 0) + 1
    return ' / '.join(f'{k} {v}' for k, v in levels.items()) or 'Level 0'


def list_characters():
    os.makedirs(CHAR_DIR, exist_ok=True)
    out = []
    for fn in os.listdir(CHAR_DIR):
        if not fn.endswith('.json'):
            continue
        try:
            with open(os.path.join(CHAR_DIR, fn), encoding='utf-8') as f:
                c = json.load(f)
            out.append(dict(id=c.get('id'), name=c.get('name') or 'Unnamed', race=c.get('race', ''),
                            summary=_summary(c), updated=c.get('updated', 0)))
        except Exception:
            continue
    return sorted(out, key=lambda c: -c['updated'])


HISTORY_FILE = re.compile(r'^([A-Za-z0-9_-]+)-([0-9]+)[.]json$')  # <id>-<saved at>.json


def _history_of(cid):
    """The history files of one character as [(saved at, file name)], newest first."""
    if not os.path.isdir(HISTORY_DIR):
        return []
    out = []
    for fn in os.listdir(HISTORY_DIR):
        m = HISTORY_FILE.match(fn)
        if m and m.group(1) == cid:
            out.append((int(m.group(2)), fn))
    return sorted(out, reverse=True)


def _snapshot(cid, path, force=False):
    """Copies the file now on disk into .history before it is overwritten, so a bad save can be undone. Saving is frequent
    (every edit), so unless forced this only happens when the newest copy is older than HISTORY_EVERY."""
    if not os.path.exists(path):
        return
    now = int(time.time())
    have = _history_of(cid)
    if not force and have and now - have[0][0] < HISTORY_EVERY:
        return
    os.makedirs(HISTORY_DIR, exist_ok=True)
    shutil.copy2(path, os.path.join(HISTORY_DIR, f'{cid}-{now}.json'))
    for _, fn in _history_of(cid)[HISTORY_KEEP:]:
        os.remove(os.path.join(HISTORY_DIR, fn))


def save_character(c):
    os.makedirs(CHAR_DIR, exist_ok=True)
    if not c.get('id'):
        c['id'] = uuid.uuid4().hex[:12]
    c['updated'] = time.time()
    path = _char_path(c['id'])
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(c, f, indent=1)
    try:
        _snapshot(c['id'], path)
    except OSError:
        pass  # a failed backup must never stop the save
    os.replace(tmp, path)
    return {'id': c['id'], 'updated': c['updated']}


def list_history():
    """Earlier saves of the characters still in the folder: [{file, id, name, saved}], newest first."""
    out = []
    if not os.path.isdir(HISTORY_DIR):
        return out
    for fn in os.listdir(HISTORY_DIR):
        m = HISTORY_FILE.match(fn)
        if not m or not os.path.exists(os.path.join(CHAR_DIR, m.group(1) + '.json')):
            continue
        try:
            with open(os.path.join(HISTORY_DIR, fn), encoding='utf-8') as f:
                c = json.load(f)
        except Exception:
            continue
        out.append(dict(file=fn, id=m.group(1), name=c.get('name') or 'Unnamed', race=c.get('race', ''), summary=_summary(c),
                        saved=int(m.group(2))))
    return sorted(out, key=lambda c: -c['saved'])


def revert_character(fn):
    """Puts an earlier save back. The save it replaces is copied to .history first, so going back can itself be undone."""
    m = HISTORY_FILE.match(fn or '')
    if not m:
        raise ValueError('bad file')
    src = os.path.join(HISTORY_DIR, fn)
    with open(src, encoding='utf-8') as f:
        c = json.load(f)
    c['id'] = m.group(1)
    _snapshot(c['id'], _char_path(c['id']), force=True)
    os.remove(src)
    return save_character(c)


def load_character(cid):
    with open(_char_path(cid), encoding='utf-8') as f:
        return json.load(f)


def delete_character(cid):
    """Moves the file to a .deleted folder rather than destroying it."""
    os.makedirs(TRASH_DIR, exist_ok=True)
    shutil.move(_char_path(cid), os.path.join(TRASH_DIR, f'{cid}-{int(time.time())}.json'))
    return {'ok': True}


TRASH_FILE = re.compile(r'^([A-Za-z0-9_-]+)-([0-9]+)[.]json$')  # <id>-<deleted at>.json, as delete_character names them


def _trash_path(fn):
    if not TRASH_FILE.match(fn or ''):
        raise ValueError('bad file')
    return os.path.join(TRASH_DIR, fn)


def list_deleted():
    """The characters in .deleted, newest first: [{file, id, name, race, summary, deleted}]."""
    if not os.path.isdir(TRASH_DIR):
        return []
    out = []
    for fn in os.listdir(TRASH_DIR):
        m = TRASH_FILE.match(fn)
        if not m:
            continue
        try:
            with open(os.path.join(TRASH_DIR, fn), encoding='utf-8') as f:
                c = json.load(f)
        except Exception:
            continue
        out.append(dict(file=fn, id=m.group(1), name=c.get('name') or 'Unnamed', race=c.get('race', ''), summary=_summary(c),
                        deleted=int(m.group(2))))
    return sorted(out, key=lambda c: -c['deleted'])


def restore_character(fn):
    """Moves a character back out of .deleted. If its id is in use again (say it was re-imported meanwhile), the restored copy
    gets a new id, so nothing is overwritten."""
    path = _trash_path(fn)
    with open(path, encoding='utf-8') as f:
        c = json.load(f)
    try:
        taken = os.path.exists(_char_path(c.get('id')))
    except ValueError:
        taken = True
    if taken:
        c['id'] = None
    r = save_character(c)
    os.remove(path)
    return r


def purge_character(fn):
    """Removes a deleted character for good."""
    os.remove(_trash_path(fn))
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


# Custom sound effects: any number of audio files per effect (up to MAX_PER_SOUND), kept next to the app's other local data (not in the app folder,
# so updates keep them). A file is named <effect>__<id>__<label><ext>; the id is 8 hex digits and the label is the original file name.
SOUND_DIR = os.environ.get('PF_SOUND_DIR') or os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), APP_NAME, 'sounds')
SOUND_NAMES = ('levelUp', 'heal', 'fullHeal', 'hit')
SOUND_TYPES = {'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav',
               'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/webm': '.webm', 'audio/flac': '.flac'}
MAX_SOUND = 6 * 1024 * 1024
MAX_BODY = 64 * 1024 * 1024  # a character with several pictures is a few MB
MAX_PER_SOUND = 8
SOUND_ID = re.compile(r'^[0-9a-f]{8}$')


def _check_sound(name):
    if name not in SOUND_NAMES:
        raise ValueError('Unknown sound.')


def _sound_entries(name):
    """[(id, label, path)] for one effect, oldest first."""
    _check_sound(name)
    if not os.path.isdir(SOUND_DIR):
        return []
    out = []
    for f in sorted(os.listdir(SOUND_DIR), key=lambda f: (os.stat(os.path.join(SOUND_DIR, f)).st_mtime_ns, f)):  # oldest first
        stem, ext = os.path.splitext(f)
        parts = stem.split('__', 2)
        if ext in SOUND_TYPES.values() and len(parts) == 3 and parts[0] == name and SOUND_ID.match(parts[1]):
            out.append((parts[1], parts[2], os.path.join(SOUND_DIR, f)))
    return out


def list_sounds():
    """The custom files per effect: {name: [{id, label}]}."""
    return {n: [{'id': i, 'label': label} for i, label, _ in _sound_entries(n)] for n in SOUND_NAMES}


def save_sound(name, data, ctype, label=''):
    ext = SOUND_TYPES.get((ctype or '').split(';')[0].strip().lower())
    if not ext:
        raise ValueError('That is not an audio file the app can play (use mp3, ogg, wav, m4a, aac, webm or flac).')
    if not data:
        raise ValueError('The file is empty.')
    if len(data) > MAX_SOUND:
        raise ValueError('That file is too big (the limit is 6 MB). Use a short sound effect.')
    if len(_sound_entries(name)) >= MAX_PER_SOUND:
        raise ValueError(f'That effect already has {MAX_PER_SOUND} sounds. Remove one first.')
    label = re.sub(r'[^A-Za-z0-9 .\-]', '', os.path.splitext(label or '')[0]).strip()[:40] or 'My sound'
    os.makedirs(SOUND_DIR, exist_ok=True)
    path = os.path.join(SOUND_DIR, f'{name}__{uuid.uuid4().hex[:8]}__{label}{ext}')
    with open(path, 'wb') as f:
        f.write(data)
    # Files are listed oldest first by modified time, which can tie on Windows when two are saved close together: make each newer than the last.
    newest = max((os.stat(p).st_mtime_ns for _, _, p in _sound_entries(name) if p != path), default=0)
    stamp = max(time.time_ns(), newest + 1_000_000)
    os.utime(path, ns=(stamp, stamp))
    return list_sounds()


def delete_sound(name, sid=''):
    """Removes one custom file, or all of an effect's when no id is given (back to the built-in sounds)."""
    for i, _, path in _sound_entries(name):
        if not sid or i == sid:
            os.remove(path)
    return list_sounds()


def read_sound(name, sid):
    for i, _, path in _sound_entries(name):
        if i == sid:
            ext = os.path.splitext(path)[1]
            with open(path, 'rb') as f:
                return f.read(), next(t for t, e in SOUND_TYPES.items() if e == ext)
    raise FileNotFoundError(name)


WEBHOOK = re.compile(r'^https://(?:(?:canary|ptb)\.)?discord(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[\w-]+/?$')


def post_discord(body):
    """Send a dice roll to a Discord channel through its webhook. Only discord.com webhook URLs are accepted."""
    import urllib.request
    body = body or {}
    url = str(body.get('url') or '').strip()
    content = str(body.get('content') or '').strip()
    if not WEBHOOK.match(url):
        raise ValueError('That is not a Discord webhook URL (Channel settings > Integrations > Webhooks).')
    if not content:
        raise ValueError('Nothing to send.')
    payload = {'content': content[:1900], 'allowed_mentions': {'parse': []}}
    name = str(body.get('username') or '').strip()
    if name:
        payload['username'] = name[:80]
    req = urllib.request.Request(url + ('&' if '?' in url else '?') + 'wait=false', data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (CookiesSheets, 1.0)'})
    try:
        with urllib.request.urlopen(req, timeout=15):
            pass
    except Exception as e:
        raise ValueError(f'Discord did not accept the roll ({e}).')
    return {'ok': True}


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


def app_version():
    """The version the page shows, read from the one place it is written (web/js/version.js)."""
    with open(os.path.join(WEB, 'js', 'version.js'), encoding='utf-8') as f:
        m = re.search(r"VERSION\s*=\s*'([^']*)'", f.read())
    return m.group(1) if m else '0'


# ---------------- HTTP ----------------

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'}
    protocol_version = 'HTTP/1.1'  # keep-alive: far fewer connections when loading the UI

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        # API answers change with every edit, so never cache them. The UI files may be kept and revalidated (If-Modified-Since
        # gets a 304 from the stdlib handler) instead of being sent again on every launch.
        self.send_header('Cache-Control', 'no-store' if getattr(self, 'path', '').startswith('/api/') else 'no-cache')
        super().end_headers()

    def finish(self):
        try:
            super().finish()
        finally:
            close_db()

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _length(self, limit, what='That request'):
        n = int(self.headers.get('Content-Length') or 0)
        if n < 0 or n > limit:  # a negative length would make read() wait for the connection to close
            raise ValueError(f'{what} is too big.')
        return n

    def _body(self):
        return json.loads(self.rfile.read(self._length(MAX_BODY)) or b'null')

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
            elif route == ('GET', 'magic-gear'):
                self._json(magic_gear(p.get('kind', ''), p.get('q', '')))
            elif route == ('GET', 'search'):
                self._json(search(p.get('q', ''), p.get('cat', ''), int(p.get('limit', 60)), int(p.get('offset', 0))))
            elif route == ('GET', 'entries'):
                ids = [int(x) for x in (p.get('ids') or '').split(',') if x.strip().isdigit()][:300]
                self._json([e for e in (get_entry(i) for i in ids) if e])
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
            elif route == ('GET', 'deleted'):
                self._json(list_deleted())
            elif route == ('GET', 'history'):
                self._json(list_history())
            elif route == ('POST', 'character/revert'):
                self._json(revert_character(p.get('file', '')))
            elif route == ('POST', 'character/restore'):
                self._json(restore_character(p.get('file', '')))
            elif route == ('POST', 'character/purge'):
                self._json(purge_character(p.get('file', '')))
            elif route == ('POST', 'open-folder'):
                self._json(open_folder())
            elif route == ('GET', 'cs-fetch'):
                self._json(fetch_charactersheet(p.get('id', '')))
            elif route == ('GET', 'update-check'):
                self._json(updater.check(app_version()))
            elif route == ('POST', 'update-apply'):
                self._json(updater.apply(app_version()))
            elif route == ('GET', 'sounds'):
                self._json(list_sounds())
            elif route == ('POST', 'sound'):
                n = self._length(MAX_SOUND, 'That file (the limit is 6 MB; use a short sound effect)')
                self._json(save_sound(p.get('name', ''), self.rfile.read(n), self.headers.get('Content-Type'), p.get('label', '')))
            elif route == ('POST', 'sound/delete'):
                self._json(delete_sound(p.get('name', ''), p.get('id', '')))
            elif route == ('GET', 'sound-file'):
                data, ctype = read_sound(p.get('name', ''), p.get('id', ''))
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif route == ('POST', 'discord'):
                self._json(post_discord(self._body()))
            elif route == ('POST', 'resolve'):
                self._json(resolve_names(self._body()))
            else:
                self._json({'error': 'not found'}, 404)
        except FileNotFoundError:
            self._json({'error': 'not found'}, 404)
        except Exception as e:  # surface errors to the UI instead of hanging
            self._json({'error': str(e)}, 500)
        return True

    def _allowed(self):
        """Only this app's own page may use the server.

        The server listens on 127.0.0.1, but any web page open in a browser on this computer can still send requests to it:
        a hidden form can POST to /api/character/delete, and a DNS-rebinding page (a hostname that resolves to 127.0.0.1)
        could read the character files. Browsers mark such requests, so refuse them: the Host header must be one of our own
        loopback names, the Origin header (sent with every POST and cross-origin fetch) must be our own page, and
        Sec-Fetch-Site must not say another site asked (an <img> or a form has no Origin, but it has that).
        """
        if self.headers.get('Host', '') not in self.server.hosts:
            return False
        origin = self.headers.get('Origin')
        if origin is not None and origin not in self.server.origins:
            return False
        return self.headers.get('Sec-Fetch-Site') not in ('cross-site', 'same-site')

    def _refuse(self):
        if self.path.startswith('/api/'):
            self._json({"error": "Only Cookie's Sheets itself may use this server."}, 403)
        else:
            self.send_error(403)

    def do_GET(self):
        if not self._allowed():
            self._refuse()
        elif not self._route('GET'):
            super().do_GET()

    def do_HEAD(self):
        if not self._allowed():
            self._refuse()
        else:
            super().do_HEAD()

    def do_POST(self):
        if not self._allowed():
            self._refuse()
        elif not self._route('POST'):
            self._json({'error': 'not found'}, 404)


class Server(ThreadingHTTPServer):
    # HTTPServer turns on SO_REUSEADDR. On Windows that lets us bind a port another program is already listening on, and that
    # program keeps getting the connections: the app then opened its window on a stranger's page instead of moving to the next
    # port. Without the flag a busy port fails to bind, which is what start_server_from relies on. On other systems the flag
    # cannot take a port that is in use, and it is needed to restart right after closing, so it stays on there.
    allow_reuse_address = sys.platform != 'win32'


def start_server(port):
    srv = Server(('127.0.0.1', port), Handler)
    port = srv.server_address[1]  # the real one when 0 was asked for
    # The names a browser may call us by (see Handler._allowed). Anything else is another site's page or a rebinding trick.
    srv.hosts = {f'127.0.0.1:{port}', f'localhost:{port}', f'[::1]:{port}'}
    srv.origins = {'http://' + h for h in srv.hosts}
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def start_server_from(port, tries=20):
    """Starts the server on the first free port counting up from `port`."""
    for p in range(port, port + tries):
        try:
            return start_server(p)
        except OSError:
            continue
    raise OSError(f'No free port between {port} and {port + tries - 1}')


def main():
    install_new_db()
    browser = '--browser' in sys.argv
    srv = start_server_from(int(os.environ.get('PF_PORT') or 8765))
    # The query string makes each launch's address new to the browser cache. Without it, a page some other program once served on
    # this port (a dev server with no cache headers is cached for days on the strength of its Last-Modified date) came back from
    # the cache instead of ours. The file server ignores the query.
    url = f'http://127.0.0.1:{srv.server_address[1]}/?launch={int(time.time())}'
    if browser:
        print('Serving', url.split('?')[0])
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
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('CookiesSheets.App')
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
    try:
        webview.create_window(APP_NAME, url, width=1400, height=900, min_size=(1000, 650))
        webview.start(icon=os.path.join(WEB, 'icon.ico'), private_mode=False, storage_path=storage)
    except Exception:
        # No usable WebView2 runtime (or the window could not open): use the default browser instead, so the app still works.
        log_error('Window failed, falling back to the browser:\n' + traceback.format_exc())
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
    srv.shutdown()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        log_error(traceback.format_exc())
        raise
