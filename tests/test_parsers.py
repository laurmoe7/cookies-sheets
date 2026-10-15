"""Tests for the build-time parsers in tools/archetypes.py and tools/companions.py (no source data needed)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from archetypes import class_skill_changes, first_level, parse_archetype, parse_targets  # noqa: E402
from companions import parse_abilities, parse_attacks, qualities  # noqa: E402
from extra_entries import ENTRIES  # noqa: E402


def names(phrase):
    return [t['name'] for t in parse_targets(phrase)]


class ReplacedFeatures(unittest.TestCase):
    def test_list_with_and(self):
        self.assertEqual(names('uncanny dodge, improved uncanny dodge, and damage reduction'),
                         ['uncanny dodge', 'improved uncanny dodge', 'damage reduction'])

    def test_levels(self):
        t = parse_targets('the arcanist exploits gained at 1st and 9th levels')
        self.assertEqual([(x['name'], x['levels']) for x in t], [('arcanist exploit', [1, 9])])
        t = parse_targets('the 1st-, 7th-, and 13th-level bonus feats')
        self.assertEqual([(x['name'], x['levels']) for x in t], [('bonus feat', [1, 7, 13])])

    def test_numbered_continuation(self):
        self.assertEqual(names('armor training 1, 2, 3, and 4'),
                         ['armor training 1', 'armor training 2', 'armor training 3', 'armor training 4'])

    def test_possessive_kept_with_fallback(self):
        t = parse_targets("the witch's hex gained at 1st level")[0]
        self.assertEqual(t['name'], "witch's hex")
        self.assertIn('hex', t['parts'])
        self.assertEqual(parse_targets("hunter's bond")[0]['name'], "hunter's bond")

    def test_names_containing_and(self):
        t = parse_targets('tongue of the sun and moon')[0]
        self.assertEqual(t['name'], 'tongue of the sun and moon')
        self.assertEqual(t['parts'], ['tongue of the sun', 'moon'])

    def test_first_level(self):
        self.assertEqual(first_level('At 3rd level, an acrobat can reroll'), 3)
        self.assertEqual(first_level('Beginning at 11th level, she'), 11)
        self.assertIsNone(first_level('A kensai is proficient with'))


class ClassSkills(unittest.TestCase):
    def test_add_and_remove(self):
        cs = class_skill_changes('At 1st level, an urban ranger adds Disable Device and Knowledge (local) to his list of class skills '
                                 'and removes Handle Animal and Knowledge (nature) from his list of class skills.')
        self.assertEqual(cs, {'add': ['Disable Device', 'Knowledge (local)'], 'remove': ['Handle Animal', 'Knowledge (nature)']})

    def test_but_does_not_gain(self):
        cs = class_skill_changes('A cutthroat gains Diplomacy, Knowledge (nobility), and Linguistics as class skills, '
                                 'but does not gain Knowledge (dungeoneering), Knowledge (geography), or Survival as class skills.')
        self.assertEqual(cs['add'], ['Diplomacy', 'Knowledge (nobility)', 'Linguistics'])
        self.assertEqual(cs['remove'], ['Knowledge (dungeoneering)', 'Knowledge (geography)', 'Survival'])

    def test_rather_than(self):
        cs = class_skill_changes('A underground druid adds Knowledge (dungeoneering) rather than Knowledge (geography) as a class skill.')
        self.assertEqual(cs, {'add': ['Knowledge (dungeoneering)'], 'remove': ['Knowledge (geography)']})

    def test_all_knowledge(self):
        self.assertEqual(len(class_skill_changes('A spirit guide gains all Knowledge skills as class skills.')['add']), 10)

    def test_unrelated_sentences_ignored(self):
        self.assertEqual(class_skill_changes('She gains a +2 bonus on Stealth checks.'), {'add': [], 'remove': []})


class Archetype(unittest.TestCase):
    def test_parse(self):
        a = parse_archetype('Test', 'Rogue', '<p>Quick and sly. Very sly.</p>', [
            ('ability', 'Expert Acrobat', '<p>At 1st level, ... This ability replaces trapfinding.</p>', None),
            ('section', 'Rogue Talents', '<p>The following rogue talents complement the acrobat archetype: x.</p>', None),
            ('section', 'Diminished Spellcasting', '<p>One fewer spell of each level.</p>', None),
        ])
        self.assertEqual(a['description'], 'Quick and sly. Very sly.')
        f = a['features']
        self.assertEqual((f[0]['level'], [t['name'] for t in f[0]['replaces']], f[0]['advice']), (1, ['trapfinding'], False))
        self.assertTrue(f[1]['advice'])
        self.assertTrue(a['diminished'])


class CompanionParsing(unittest.TestCase):
    def test_attacks(self):
        self.assertEqual(parse_attacks('bite (1d4), 2 hooves* (1d6)'), [
            dict(name='bite', count=1, dice='1d4', extra='', secondary=False),
            dict(name='hoof', count=2, dice='1d6', extra='', secondary=True)])
        self.assertEqual(parse_attacks('bite (1d6 plus trip)')[0]['extra'], 'plus trip')

    def test_abilities(self):
        self.assertEqual(parse_abilities('Str 10, Dex 12, Con 15, Int —, Wis 12, Cha 10'),
                         dict(str=10, dex=12, con=15, int=None, wis=12, cha=10))
        self.assertEqual(parse_abilities('Str +4, Dex -2, Con +2.'), dict(str=4, dex=-2, con=2))

    def test_footnote_removed(self):
        self.assertEqual(qualities('low-light vision, scent. *This is a secondary natural attack'), 'low-light vision, scent')


class ExtraEntries(unittest.TestCase):
    def test_hand_typed_entries_are_complete_and_unique(self):
        keys = [(cat, sub, name) for cat, sub, name, source, text in ENTRIES]
        self.assertEqual(len(keys), len(set(keys)), 'one entry per category, sub and name')
        self.assertTrue(all(text.strip().endswith('.') for *_, text in ENTRIES), 'every entry has its full text')
        kitsune = [name for cat, sub, name, *_ in ENTRIES if sub == 'Kitsune']
        self.assertEqual(len(kitsune), 17, 'the alternate kitsune racial traits (Gregarious comes from the book data)')


if __name__ == '__main__':
    unittest.main()
