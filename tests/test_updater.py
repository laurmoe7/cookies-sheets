"""Updater tests: version order, picking the release file, unpacking safely, and the install script. No network."""
import os
import shutil
import sys
import tempfile
import unittest
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import updater  # noqa: E402

BASE = updater.DOWNLOAD_PREFIX + 'v1.1/'


class Versions(unittest.TestCase):
    def test_order(self):
        self.assertTrue(updater.is_newer('1.1', '1.0'))
        self.assertTrue(updater.is_newer('v1.10', '1.9'), 'numbers, not text: 10 is more than 9')
        self.assertTrue(updater.is_newer('1.0.1', '1.0'))
        self.assertFalse(updater.is_newer('1.0.0', '1.0'), 'a missing part counts as 0')
        self.assertFalse(updater.is_newer('1.0', '1.1'))
        self.assertFalse(updater.is_newer('beta', '1.0'), 'a tag without a number is never newer')


class Release(unittest.TestCase):
    def rel(self, **kw):
        return {'tag_name': 'v1.1', 'body': 'notes', 'assets': [{'name': "Cookie's Sheets.zip", 'browser_download_url': BASE + 'x.zip',
                                                                  'size': 5, 'digest': 'sha256:ABC123'}], **kw}

    def test_picks_the_zip_and_its_checksum(self):
        a = updater.pick_asset(self.rel())
        self.assertEqual((a['url'], a['sha256']), (BASE + 'x.zip', 'abc123'))

    def test_ignores_files_from_elsewhere(self):
        r = self.rel()
        r['assets'][0]['browser_download_url'] = 'https://evil.example/x.zip'
        self.assertIsNone(updater.pick_asset(r))
        self.assertFalse(updater.describe(r, '1.0')['available'])

    def test_describe(self):
        self.assertTrue(updater.describe(self.rel(), '1.0')['available'])
        self.assertFalse(updater.describe(self.rel(), '1.1')['available'])
        self.assertFalse(updater.describe(self.rel(assets=[]), '1.0')['available'], 'no file to install')


class Unpack(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix='pf-upd-')

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def make(self, *names):
        p = os.path.join(self.dir, 'u.zip')
        with zipfile.ZipFile(p, 'w') as z:
            for n in names:
                z.writestr(n, 'x')
        return p

    def test_unpacks_the_app_folder(self):
        src = updater.safe_extract(self.make("Cookie's Sheets/Cookie's Sheets.exe", "Cookie's Sheets/_internal/a.txt"), os.path.join(self.dir, 'out'))
        self.assertTrue(os.path.isfile(os.path.join(src, "Cookie's Sheets.exe")))

    def test_refuses_paths_that_climb_out(self):
        with self.assertRaises(ValueError):
            updater.safe_extract(self.make("Cookie's Sheets/Cookie's Sheets.exe", '../evil.txt'), os.path.join(self.dir, 'out'))

    def test_refuses_a_zip_without_the_app(self):
        with self.assertRaises(ValueError):
            updater.safe_extract(self.make('readme.txt'), os.path.join(self.dir, 'out'))

    def test_script_copies_then_restarts(self):
        s = updater.script_text(r'C:\w\new', r'C:\Apps\Cookie', r'C:\w')
        self.assertLess(s.index('robocopy'), s.index('start ""'))
        self.assertIn(r'robocopy "C:\w\new" "C:\Apps\Cookie"', s)
        self.assertIn(r'''"C:\Apps\Cookie\Cookie's Sheets.exe"''', s)


if __name__ == '__main__':
    unittest.main()
