"""Server tests: character storage, compendium search/lookup, and the HTTP API.

Run with:  python -m unittest discover -s tests -p "test_*.py"
Characters are written to a temporary folder, never to Documents\\Pathfinder Characters.
No network access is needed.
"""
import json
import os
import shutil
import socket
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix='pf-test-chars-')
os.environ['PF_CHAR_DIR'] = TMP  # must be set before app is imported
sys.path.insert(0, ROOT)
import app  # noqa: E402



def tearDownModule():
    app.close_db()  # the tests above call the compendium functions on this thread
    shutil.rmtree(TMP, ignore_errors=True)


HAVE_DB = os.path.exists(os.path.join(ROOT, 'data', 'pf1e.db'))
NEEDS_DB = unittest.skipUnless(HAVE_DB, 'data/pf1e.db missing: run python tools/build_data.py')


class CharacterStorage(unittest.TestCase):
    def test_round_trip_and_list(self):
        r = app.save_character({'id': None, 'name': 'Valeros', 'race': 'Human',
                                'levelUps': [{'cls': 'Fighter'}, {'cls': 'Fighter'}, {'cls': 'Rogue'}]})
        self.assertRegex(r['id'], r'^[0-9a-f]{12}$')
        self.assertEqual(app.load_character(r['id'])['name'], 'Valeros')
        listed = {c['id']: c for c in app.list_characters()}
        self.assertEqual(listed[r['id']]['summary'], 'Fighter 2 / Rogue 1')

    def test_delete_moves_to_trash(self):
        r = app.save_character({'name': 'Doomed'})
        app.delete_character(r['id'])
        self.assertFalse(os.path.exists(os.path.join(TMP, r['id'] + '.json')))
        self.assertTrue(any(f.startswith(r['id']) for f in os.listdir(app.TRASH_DIR)))

    def test_restore_and_purge(self):
        r = app.save_character({'id': None, 'name': 'Kyra', 'race': 'Human', 'levelUps': [{'cls': 'Cleric'}]})
        app.delete_character(r['id'])
        gone = [d for d in app.list_deleted() if d['id'] == r['id']]
        self.assertEqual(len(gone), 1)
        self.assertEqual((gone[0]['name'], gone[0]['race'], gone[0]['summary']), ('Kyra', 'Human', 'Cleric 1'))
        self.assertAlmostEqual(gone[0]['deleted'], time.time(), delta=5)
        back = app.restore_character(gone[0]['file'])
        self.assertEqual(back['id'], r['id'], 'the id is free, so the character keeps it')
        self.assertEqual(app.load_character(r['id'])['name'], 'Kyra')
        self.assertFalse([d for d in app.list_deleted() if d['id'] == r['id']], 'restoring empties the bin of it')
        # Deleted, then another character saved under the same id (a re-import): restoring must not overwrite the newer one.
        app.delete_character(r['id'])
        app.save_character({'id': r['id'], 'name': 'Kyra the second', 'levelUps': []})
        f = next(d['file'] for d in app.list_deleted() if d['id'] == r['id'])
        back2 = app.restore_character(f)
        self.assertNotEqual(back2['id'], r['id'])
        self.assertEqual(app.load_character(r['id'])['name'], 'Kyra the second')
        self.assertEqual(app.load_character(back2['id'])['name'], 'Kyra')
        app.delete_character(back2['id'])
        f = next(d['file'] for d in app.list_deleted() if d['id'] == back2['id'])
        app.purge_character(f)
        self.assertFalse(os.path.exists(os.path.join(app.TRASH_DIR, f)))
        for bad in ('../x.json', 'abc.json', '', 'abc-12.txt', 'abc-12.json.bak'):
            with self.assertRaises(ValueError):
                app.restore_character(bad)
            with self.assertRaises(ValueError):
                app.purge_character(bad)

    def test_rejects_path_tricks(self):
        for bad in ['../evil', 'a/b', '', 'x.json']:
            with self.assertRaises(ValueError):
                app._char_path(bad)


@NEEDS_DB
class Compendium(unittest.TestCase):
    def test_exact_spell_name_ranks_first(self):
        top = app.search('fireball')[0]
        self.assertEqual((top['name'], top['cat']), ('Fireball', 'Spell'))

    def test_category_filter(self):
        self.assertTrue(all(r['cat'] == 'Feat' for r in app.search('power', cat='Feat')))

    def test_entry_by_name(self):
        e = app.get_entry(name='power attack', cat='Feat')
        self.assertEqual(e['name'], 'Power Attack')
        self.assertIn('Prerequisite', e['html'])

    def test_spell_list_by_class_and_level(self):
        lvl1 = app.spells(cls='Wizard', level='1')
        names = {s['name'] for s in lvl1}
        self.assertIn('Magic Missile', names)
        self.assertNotIn('Fireball', names)
        self.assertTrue(all(s['level'] == 1 for s in lvl1))
        self.assertGreater(len(lvl1), 100, 'level filter must apply before the result limit')

    def test_entry_counts(self):
        counts = {r['cat']: r['n'] for r in app.categories()}
        self.assertGreater(counts['Spell'], 2000)
        self.assertGreater(counts['Feat'], 1000)
        self.assertGreater(counts['Trait'], 200)

    def test_archetypes_by_class(self):
        rogue = {a['name']: a for a in app.archetypes('Rogue')}
        self.assertIn('Acrobat', rogue)
        acro = rogue['Acrobat']
        self.assertEqual(acro['cls'], 'Rogue')
        self.assertTrue(acro['description'])
        self.assertEqual([(f['name'], f['level']) for f in acro['features'] if not f['advice']],
                         [('Expert Acrobat', 1), ('Second Chance', 3)])
        self.assertTrue(any(a['diminished'] for a in app.archetypes('Magus')), 'kensai and myrmidarch')
        self.assertEqual(app.archetypes('Nonexistent'), [])

    def test_resolve_names(self):
        hits = app.resolve_names({'items': [
            {'variants': ['Weapon Finesse'], 'cats': ['Feat']},
            {'variants': ['Dimensional Slide (Su)', 'Dimensional Slide'], 'cats': ['Racial Trait', 'Class Feature']},
            {'variants': ['Cloak of Resistance +2', 'Cloak of Resistance'], 'cats': ['Magic Item']},
            {'variants': ['No Such Thing Anywhere'], 'cats': ['Feat']},
        ]})
        self.assertEqual([h and h['name'] for h in hits],
                         ['Weapon Finesse', 'Dimensional Slide', 'Cloak of Resistance', None])
        self.assertEqual(hits[1]['cat'], 'Class Feature')


class ImportLink(unittest.TestCase):
    def test_rejects_non_sheet_links(self):
        for bad in ['', 'hello', 'https://example.com/sheet/123']:
            with self.assertRaises(ValueError):
                app.fetch_charactersheet(bad)

    def test_finds_id_in_sheet_url(self):
        url = 'https://charactersheet.co.uk/pathfinder/#/sheet/6a60b420ed836300029ba18d'
        self.assertEqual(app.CS_ID.search(url).group(1), '6a60b420ed836300029ba18d')


class HttpApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = app.start_server(0)  # any free port
        cls.base = f'http://127.0.0.1:{cls.srv.server_address[1]}'

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def call(self, path, body=None, method=None):
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read())

    def test_serves_ui(self):
        with urllib.request.urlopen(self.base + '/', timeout=10) as r:
            self.assertIn(b'js/app.js', r.read())
        with urllib.request.urlopen(self.base + '/?launch=123', timeout=10) as r:  # the window opens it with a per-launch query
            self.assertIn(b'js/app.js', r.read())

    def test_classes(self):
        status, data = self.call('/api/classes')
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 32)

    def test_companion_data(self):
        status, data = self.call('/api/companions')
        self.assertEqual(status, 200)
        self.assertEqual(len(data['animal']['species']), 68)
        self.assertTrue(data['eidolon']['evolutions'])

    def test_summon_data(self):
        status, data = self.call('/api/summons')
        self.assertEqual(status, 200)
        self.assertEqual(set(data['families']), {'Summon Monster', "Summon Nature's Ally"})
        self.assertIn('dog', data['creatures'])

    def test_racial_favored_class_data(self):
        status, data = self.call('/api/fcb')
        self.assertEqual(status, 200)
        self.assertIn('Fighter', data['Dwarf'])

    def test_save_and_load(self):
        status, r = self.call('/api/character', {'name': 'Ezren'})
        self.assertEqual(status, 200)
        self.assertEqual(self.call(f'/api/character?id={r["id"]}')[1]['name'], 'Ezren')

    def test_deleted_bin_routes(self):
        status, r = self.call('/api/character', {'name': 'Seoni'})
        self.assertEqual(self.call(f'/api/character/delete?id={r["id"]}', method='POST')[0], 200)
        status, gone = self.call('/api/deleted')
        self.assertEqual(status, 200)
        f = next(d['file'] for d in gone if d['id'] == r['id'])
        status, back = self.call(f'/api/character/restore?file={f}', method='POST')
        self.assertEqual((status, back['id']), (200, r['id']))
        self.assertEqual(self.call(f'/api/character?id={r["id"]}')[1]['name'], 'Seoni')
        self.assertEqual(self.call('/api/character/purge?file=nope.json', method='POST')[0], 500)
        self.assertEqual(self.call('/api/character/purge?file=abc-1.json', method='POST')[0], 404, 'well-formed name, no such file')

    def test_overwrites_keep_history_and_can_be_reverted(self):
        r = self.call('/api/character', {'name': 'v1'})[1]
        cid = r['id']
        hist = lambda: [h for h in self.call('/api/history')[1] if h['id'] == cid]
        self.assertEqual(hist(), [], 'a first save overwrites nothing')
        self.call('/api/character', {'id': cid, 'name': 'v2'})
        self.assertEqual([h['name'] for h in hist()], ['v1'], 'the second save keeps what it replaced')
        self.call('/api/character', {'id': cid, 'name': 'v3'})
        self.assertEqual(len(hist()), 1, 'saves within five minutes of the last copy do not pile up')
        # age the copy, so the next save is allowed to make another one
        old = os.path.join(app.HISTORY_DIR, hist()[0]['file'])
        os.rename(old, os.path.join(app.HISTORY_DIR, f'{cid}-1000.json'))
        self.call('/api/character', {'id': cid, 'name': 'v4'})
        self.assertEqual(sorted(h['name'] for h in hist()), ['v1', 'v3'])
        back = next(h for h in hist() if h['name'] == 'v1')
        self.assertEqual(self.call(f'/api/character/revert?file={back["file"]}', method='POST')[0], 200)
        self.assertEqual(self.call(f'/api/character?id={cid}')[1]['name'], 'v1')
        self.assertIn('v4', [h['name'] for h in hist()], 'going back keeps the save it replaced')
        self.assertEqual(self.call('/api/character/revert?file=nope.json', method='POST')[0], 500)

    def test_history_is_pruned(self):
        cid = app.save_character({'name': 'p'})['id']
        for i in range(app.HISTORY_KEEP + 3):
            app._snapshot(cid, app._char_path(cid), force=True)
            os.rename(os.path.join(app.HISTORY_DIR, app._history_of(cid)[0][1]), os.path.join(app.HISTORY_DIR, f'{cid}-{100 + i}.json'))
        self.assertEqual(len(app._history_of(cid)), app.HISTORY_KEEP)

    def test_cache_headers(self):
        with urllib.request.urlopen(self.base + '/css/app.css', timeout=10) as r:
            self.assertEqual(r.headers['Cache-Control'], 'no-cache', 'UI files may be kept and revalidated')
            stamp = r.headers['Last-Modified']
        req = urllib.request.Request(self.base + '/css/app.css', headers={'If-Modified-Since': stamp})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req, timeout=10)
        self.assertEqual(cm.exception.code, 304)
        cm.exception.close()
        with urllib.request.urlopen(self.base + '/api/classes', timeout=10) as r:
            self.assertEqual(r.headers['Cache-Control'], 'no-store', 'API answers are never cached')

    def test_errors_are_json(self):
        status, data = self.call('/api/cs-fetch?id=junk')
        self.assertEqual(status, 500)
        self.assertIn('charactersheet.co.uk', data['error'])
        self.assertEqual(self.call('/api/nope')[0], 404)

    @NEEDS_DB
    def test_search(self):
        status, data = self.call('/api/search?q=touch+attack&limit=5')
        self.assertEqual(status, 200)
        self.assertTrue(data)

    def headers(self, path, method='GET', **headers):
        req = urllib.request.Request(self.base + path, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status
        except urllib.error.HTTPError as e:
            with e:
                return e.code

    def test_other_pages_are_refused(self):
        # A web page open in a normal browser can send requests to 127.0.0.1; browsers label them, and the server refuses the labels.
        port = self.srv.server_address[1]
        self.assertEqual(self.headers('/api/characters', Origin='http://evil.example'), 403)  # fetch or form POST from another site
        self.assertEqual(self.headers('/api/character/delete?id=abc', 'POST', Origin='http://evil.example'), 403)
        self.assertEqual(self.headers('/api/characters', **{'Sec-Fetch-Site': 'cross-site'}), 403)  # <img src=...> has no Origin
        self.assertEqual(self.headers('/api/characters', **{'Sec-Fetch-Site': 'same-site'}), 403)  # another local app on a different port
        self.assertEqual(self.headers('/api/characters', Host=f'evil.example:{port}'), 403)  # DNS rebinding
        self.assertEqual(self.headers('/', Host=f'evil.example:{port}'), 403)  # the page itself too
        self.assertEqual(self.headers('/api/characters', Host='127.0.0.1:1'), 403)  # right name, wrong port
        self.assertEqual(self.headers('/', 'HEAD', Host=f'evil.example:{port}'), 403)  # HEAD is checked like GET

    def test_oversized_and_negative_bodies_are_refused(self):
        self.assertEqual(self.headers('/api/character', 'POST', **{'Content-Length': '-1'}), 500)  # would otherwise wait for the socket to close

    def test_own_page_is_allowed(self):
        port = self.srv.server_address[1]
        own = f'http://127.0.0.1:{port}'
        self.assertEqual(self.headers('/api/characters', Origin=own, **{'Sec-Fetch-Site': 'same-origin'}), 200)  # a fetch from the app
        self.assertEqual(self.headers('/api/characters', Host=f'localhost:{port}', Origin=f'http://localhost:{port}'), 200)
        self.assertEqual(self.headers('/', **{'Sec-Fetch-Site': 'none'}), 200)  # typed into the address bar
        self.assertEqual(self.headers('/api/characters'), 200)  # no browser headers at all (tests, curl)


if __name__ == '__main__':
    unittest.main()


class DiscordRelay(unittest.TestCase):
    """The roll relay only talks to discord.com webhooks; these cases fail before any network call."""

    def test_rejects_other_hosts_and_empty_rolls(self):
        for url in ('https://evil.example/api/webhooks/1/abc', 'http://discord.com/api/webhooks/1/abc',
                    'https://discord.com.evil.example/api/webhooks/1/abc', ''):
            with self.assertRaises(ValueError):
                app.post_discord({'url': url, 'content': 'hi'})
        with self.assertRaises(ValueError):
            app.post_discord({'url': 'https://discord.com/api/webhooks/1/abc', 'content': '  '})

    def test_accepts_real_webhook_shapes(self):
        for url in ('https://discord.com/api/webhooks/123456/abc-DEF_1', 'https://discordapp.com/api/v10/webhooks/1/x'):
            self.assertTrue(app.WEBHOOK.match(url), url)


class CustomSounds(unittest.TestCase):
    """Players can add their own audio files to the sound effects (any number per effect, stored on disk)."""

    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp(prefix='pf-test-sounds-')
        cls.old = app.SOUND_DIR
        app.SOUND_DIR = cls.dir

    @classmethod
    def tearDownClass(cls):
        app.SOUND_DIR = cls.old
        shutil.rmtree(cls.dir, ignore_errors=True)

    def setUp(self):
        for f in os.listdir(self.dir):
            os.remove(os.path.join(self.dir, f))

    def test_add_several_read_remove_one_and_restore(self):
        self.assertEqual(app.list_sounds(), {'levelUp': [], 'heal': [], 'fullHeal': [], 'hit': []})
        app.save_sound('hit', b'ID3one', 'audio/mpeg', 'ouch one.mp3')
        out = app.save_sound('hit', b'OggStwo', 'audio/ogg', 'bang!.ogg')
        self.assertEqual([s['label'] for s in out['hit']], ['ouch one', 'bang'], 'labels are the file names, made safe')
        self.assertEqual(out['heal'], [], 'other effects are untouched')
        first, second = [s['id'] for s in out['hit']]
        self.assertEqual(app.read_sound('hit', first), (b'ID3one', 'audio/mpeg'))
        self.assertEqual(app.read_sound('hit', second), (b'OggStwo', 'audio/ogg'))
        self.assertEqual([s['id'] for s in app.delete_sound('hit', first)['hit']], [second], 'removes only that one')
        app.save_sound('hit', b'RIFFwav', 'audio/wav', 'c.wav')
        self.assertEqual(app.delete_sound('hit'), {'levelUp': [], 'heal': [], 'fullHeal': [], 'hit': []}, 'no id = back to the built-ins')
        self.assertEqual(os.listdir(self.dir), [])
        with self.assertRaises(FileNotFoundError):
            app.read_sound('hit', first)

    def test_rejects_bad_names_types_sizes_and_ids(self):
        for name in ('../evil', 'heal.mp3', 'nope', ''):
            with self.assertRaises(ValueError):
                app.save_sound(name, b'x', 'audio/mpeg', 'a.mp3')
        with self.assertRaises(ValueError):
            app.save_sound('heal', b'x', 'text/html', 'a.html')
        with self.assertRaises(ValueError):
            app.save_sound('heal', b'', 'audio/mpeg', 'a.mp3')
        with self.assertRaises(ValueError):
            app.save_sound('heal', b'x' * (app.MAX_SOUND + 1), 'audio/mpeg', 'a.mp3')
        self.assertEqual(os.listdir(self.dir), [])
        app.save_sound('heal', b'abc', 'audio/mpeg', 'a.mp3')
        for bad in ('../x', '..', 'zzzzzzzz', ''):
            with self.assertRaises(FileNotFoundError):
                app.read_sound('heal', bad)

    def test_an_effect_holds_a_limited_number(self):
        for n in range(app.MAX_PER_SOUND):
            app.save_sound('heal', b'abc', 'audio/mpeg', f'{n}.mp3')
        with self.assertRaises(ValueError):
            app.save_sound('heal', b'abc', 'audio/mpeg', 'one too many.mp3')
        self.assertEqual(len(app.list_sounds()['heal']), app.MAX_PER_SOUND)
        app.save_sound('hit', b'abc', 'audio/mpeg', 'other effect still ok.mp3')

    def test_label_cleaning(self):
        out = app.save_sound('levelUp', b'abc', 'audio/mpeg', '../../C:/evil\\name <script>.mp3')
        label = out['levelUp'][0]['label']
        self.assertTrue(label and all(ch.isalnum() or ch in ' .-' for ch in label), label)
        self.assertEqual(app.save_sound('fullHeal', b'abc', 'audio/mpeg', '')['fullHeal'][0]['label'], 'My sound')


class PortChoice(unittest.TestCase):
    def test_a_busy_port_is_skipped(self):
        # Another program listening on our port, the way a leftover "python -m http.server 8765" did. http.server sets
        # SO_REUSEADDR, and on Windows that let the app bind the same port anyway and open its window on the other program's page.
        other = socket.socket()
        other.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        other.bind(('127.0.0.1', 0))
        other.listen()
        busy = other.getsockname()[1]
        try:
            if sys.platform == 'win32':
                with self.assertRaises(OSError):
                    app.start_server(busy)
            srv = app.start_server_from(busy)
            try:
                port = srv.server_address[1]
                self.assertNotEqual(port, busy)
                self.assertTrue(busy < port < busy + 20)
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/categories', timeout=10) as r:
                    self.assertEqual(r.status, 200)
            finally:
                srv.shutdown()
                srv.server_close()
        finally:
            other.close()


class EntriesBatch(unittest.TestCase):
    """The Spells tab asks for every spell on the page at once."""

    @NEEDS_DB
    def test_batch_returns_the_entries_asked_for_and_skips_missing_ones(self):
        hits = app.search('fireball', 'Spell', 2)
        ids = [h['id'] for h in hits][:2]
        self.assertTrue(ids)
        srv = app.start_server(0)
        try:
            base = f'http://127.0.0.1:{srv.server_address[1]}'
            with urllib.request.urlopen(f'{base}/api/entries?ids={",".join(map(str, ids))},99999999,abc', timeout=10) as r:
                got = json.loads(r.read())
            self.assertEqual([e['id'] for e in got], ids)
            self.assertTrue(all('html' in e and 'meta' in e for e in got))
        finally:
            srv.shutdown()
            srv.server_close()


@NEEDS_DB
class MagicGearPickers(unittest.TestCase):
    def test_weapons_are_found_by_what_their_text_names(self):
        names = [r['name'] for r in app.magic_gear('weapon')]
        for n in ('Flame Tongue', 'Frost Brand', 'Holy Avenger'):
            self.assertIn(n, names)
        self.assertFalse([n for n in names if n.lower().startswith('rod ')], 'rods are not weapons')
        self.assertEqual([r['name'] for r in app.magic_gear('weapon', 'flame tongue')], ['Flame Tongue'])

    def test_armor_picker_lists_armor_and_shields_not_rings(self):
        names = [r['name'] for r in app.magic_gear('armor')]
        for n in ('Elven Chain', 'Mithral Shirt', 'Darkwood Shield', 'Armor Of Insults'):
            self.assertIn(n, names)
        self.assertNotIn('Ring of Protection +1', names)
        self.assertTrue(all('html' not in r for r in app.magic_gear('armor')), 'the page text is not sent')
