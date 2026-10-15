"""The tray icon: it comes up, and the Quit menu item ends it (Windows only)."""
import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tray  # noqa: E402


@unittest.skipUnless(sys.platform == 'win32', 'the tray icon is Windows only')
class Tray(unittest.TestCase):
    def test_icon_comes_up_and_quit_ends_it(self):
        ready, result = threading.Event(), []
        opened = []
        t = threading.Thread(target=lambda: result.append(tray.run('test', lambda: opened.append(1), None, ready)), daemon=True)
        t.start()
        self.assertTrue(ready.wait(10), 'the icon was added')
        self.assertTrue(tray.quit_running(), 'its window can be found')
        t.join(10)
        self.assertFalse(t.is_alive(), 'Quit ends the loop')
        self.assertEqual(result, [True])
        self.assertEqual(opened, [])


if __name__ == '__main__':
    unittest.main()
