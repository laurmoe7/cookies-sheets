"""Tests for windowstate.fit: where the window opens, in logical pixels."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from windowstate import fit  # noqa: E402

# A 1920x1080 screen whose taskbar takes the bottom 48 pixels, and a second 1280x1024 monitor to its right with no taskbar.
MAIN = (0, 0, 1920, 1032)
SIDE = (1920, 0, 1280, 1024)


class Fit(unittest.TestCase):
    def test_nothing_saved_centres_the_default_size_in_the_usable_area(self):
        r = fit({}, [MAIN])
        self.assertEqual((r['width'], r['height']), (1400, 900))
        self.assertEqual((r['x'], r['y']), ((1920 - 1400) // 2, (1032 - 900) // 2), 'centred in the area above the taskbar')

    def test_a_saved_spot_is_kept(self):
        r = fit(dict(x=100, y=50, width=1200, height=800), [MAIN])
        self.assertEqual(r, dict(x=100, y=50, width=1200, height=800))

    def test_a_window_that_ran_under_the_taskbar_is_pulled_up(self):
        r = fit(dict(x=100, y=300, width=1400, height=900), [MAIN])
        self.assertEqual(r['y'], 1032 - 900, 'its bottom edge sits on the taskbar, not behind it')

    def test_too_tall_for_the_screen_is_shrunk(self):
        r = fit(dict(x=0, y=0, width=1500, height=1100), [MAIN])
        self.assertEqual((r['height'], r['y']), (1032, 0))

    def test_a_monitor_that_is_gone_brings_it_back_onto_the_screen(self):
        r = fit(dict(x=2500, y=100, width=1200, height=800), [MAIN])
        self.assertEqual((r['x'], r['y']), (1920 - 1200, 100), 'right edge at the screen edge')

    def test_stays_on_the_second_monitor(self):
        r = fit(dict(x=2000, y=100, width=1100, height=700), [MAIN, SIDE])
        self.assertEqual((r['x'], r['y'], r['width']), (2000, 100, 1100))
        r = fit(dict(x=2900, y=100, width=1100, height=700), [MAIN, SIDE])
        self.assertEqual(r['x'], 3200 - 1100, 'pulled back inside the second monitor, not onto the first')

    def test_display_scaling_turns_physical_areas_into_logical_ones(self):
        r = fit(dict(x=0, y=1000, width=1400, height=900), [(0, 0, 3000, 1600)], scale=1.5)  # a 2000x1066 logical area
        self.assertEqual(r['y'], 1066 - 900)

    def test_bad_saved_values_fall_back(self):
        self.assertEqual(fit(dict(x='a', y=None, width=-5, height=True), [MAIN])['width'], 1000, 'the minimum size')
        self.assertEqual(fit(None, [MAIN])['width'], 1400)

    def test_without_monitor_information_the_saved_numbers_are_used_as_they_are(self):
        self.assertEqual(fit(dict(x=10, y=20, width=1200, height=700), []), dict(x=10, y=20, width=1200, height=700))
        self.assertEqual(fit({}, []), dict(x=None, y=None, width=1400, height=900))


if __name__ == '__main__':
    unittest.main()
