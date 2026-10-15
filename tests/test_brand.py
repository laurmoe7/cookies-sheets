"""Task Manager name and icon: the version resource text tools/brand.py writes into the built .exe and the source launcher."""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import brand  # noqa: E402


class VersionResource(unittest.TestCase):
    def test_names_the_app_and_carries_the_version(self):
        t = brand.version_text('1.2.3')
        self.assertIn('StringStruct(\'FileDescription\', "Cookie\'s Sheets")', t, 'Task Manager shows the file description')
        self.assertIn("filevers=(1, 2, 3, 0)", t)
        self.assertIn("StringStruct('ProductVersion', '1.2.3')", t)
        self.assertEqual(brand.version_text('1.1').count('(1, 1, 0, 0)'), 2, 'a two-part version is padded')

    def test_is_valid_for_pyinstaller(self):
        from PyInstaller.utils.win32 import versioninfo
        path = os.path.join(os.environ.get('TEMP') or ROOT, 'pf-version-test.txt')
        try:
            brand.write_version_file(path)
            info = versioninfo.load_version_info_from_text_file(path)
            names = {s.name: s.val for t in info.kids[0].kids for s in t.kids}
            self.assertEqual(names['FileDescription'], "Cookie's Sheets")
            self.assertEqual(names['OriginalFilename'], "Cookie's Sheets.exe")
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_the_version_is_read_from_the_page(self):
        with open(os.path.join(ROOT, 'web', 'js', 'version.js'), encoding='utf-8') as f:
            self.assertIn(f"'{brand.app_version()}'", f.read())


if __name__ == '__main__':
    unittest.main()
