"""Server tests: character storage, compendium search/lookup, and the HTTP API.

Run with:  python -m unittest discover -s tests -p "test_*.py"
Characters are written to a temporary folder, never to Documents\\Pathfinder Characters.
No network access is needed.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix='pf-test-chars-')
os.environ['PF_CHAR_DIR'] = TMP  # must be set before app is imported
sys.path.insert(0, ROOT)
import app  # noqa: E402



def tearDownModule():
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

    def call(self, path, body=None):
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read())

    def test_serves_ui(self):
        with urllib.request.urlopen(self.base + '/', timeout=10) as r:
            self.assertIn(b'js/app.js', r.read())

    def test_classes(self):
        status, data = self.call('/api/classes')
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 32)

    def test_save_and_load(self):
        status, r = self.call('/api/character', {'name': 'Ezren'})
        self.assertEqual(status, 200)
        self.assertEqual(self.call(f'/api/character?id={r["id"]}')[1]['name'], 'Ezren')

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


if __name__ == '__main__':
    unittest.main()
