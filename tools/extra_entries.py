"""Compendium entries typed in by hand, for rules text the PSRD books and the spreadsheet do not have.

`build_data.py` adds them last (see `late` in `write_db`), so adding one never moves the id of another entry.
Each is (category, sub, name, source, text); the text becomes one paragraph. Add a row, rebuild.
"""

KITSUNE = 'Kitsune'
ARG = 'Advanced Race Guide'
BOTB = 'Blood of the Beast'

ENTRIES = [
    ('Racial Trait', KITSUNE, 'Duplicitous', 'PZO9280',
     'Many kitsune prefer to avoid the attention they often attract from human neighbors and attempt to convince all around them that they are human. They gain a +2 racial bonus on Bluff and Disguise checks. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Fast Shifter (Su)', '',
     'You were born with an innate talent for switching between your natural forms. Using your racial change shape ability is a move action instead of a standard action. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Keen Kitsune', BOTB,
     'Although amiable, kitsune are notoriously clever and cunning, often far more than they seem. Such characters gain a +2 bonus to Dexterity and Intelligence instead of Dexterity and Charisma. This racial trait alters the kitsune’s ability score modifiers.'),
    ('Racial Trait', KITSUNE, 'Multilingual', BOTB,
     'Although most kitsune speak only Common, some quickly learn other human languages in order to give themselves an edge when dealing with humanity. They speak Common, Sylvan, and the racial language of their human form’s ethnicity, and they can learn any language they want (except Druidic and other secret languages) if they have high Intelligence scores. This racial trait replaces agile as well as a kitsune’s normal languages.'),
    ('Racial Trait', KITSUNE, 'Skilled', BOTB,
     'Some kitsune focus on diversifying their skill set in order to better blend in with their human peers. They gain an additional skill rank at 1st level and one additional skill rank whenever they gain a level. This racial trait replaces agile and kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Superior Shapeshifter', BOTB,
     'Some talented kitsune take more naturally to shapeshifting than magic, and develop that gift. They gain Fox Shape as a bonus feat at 1st level, ignoring its prerequisites. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Affable', ARG,
     'Many kitsune are warmly cordial and easy to converse with. A kitsune with this racial trait gains a +1 racial bonus on Bluff, Diplomacy, and Knowledge (local) checks and one of these skills is always a class skill for him. This racial trait replaces agile.'),
    ('Racial Trait', KITSUNE, 'Eidetic', ARG,
     'Many kitsune have an uncanny memory for visual images. The kitsune gains a +1 racial bonus on Perception and Sense Motive checks. This racial trait replaces agile.'),
    ('Racial Trait', KITSUNE, 'Fey Sorcery', ARG,
     'Many kitsune possess traces of fey blood in their bloodlines. If the kitsune is a sorcerer with the Fey or Kitsune bloodline, he treats his caster level as 1 higher when casting bonus spells and bloodline powers and he increases the saving throw DC of his bloodline spells and bloodline powers by +1. This trait does not give the kitsune early access to level-based powers; it only affects powers that he could already use without this trait. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Kitsune Chakra (Su)', ARG,
     'Some kitsune are born with a natural wellspring of ki, supernatural energy that can be used to perform amazing feats. The kitsune can spend 1 point from his ki pool as a swift action before making an ability or skill check in order to gain a +2 bonus on the check. Additionally, kitsune with this racial trait gain a ki pool with 1 point to activate this ability with. The number of points in the kitsune’s ki pool increases by 1 for every 4 levels that he possesses. If he already has a ki pool from another source, the kitsune does not gain ki points from this ability but may use ki points from other sources to activate it instead. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Natural Finesse', ARG,
     'Sophisticated kitsune hone graceful and precise movements at the expense of their skill with their natural attacks. The kitsune gains Weapon Finesse as a bonus feat at 1st level. This racial trait replaces natural weapons.'),
    ('Racial Trait', KITSUNE, 'Naturalized', ARG,
     'Kitsune who live their entire lives around humans are able to perfectly mimic how humans talk, act, and think. While in human form, the kitsune no longer needs to make Disguise checks in order to appear human and he can take 10 on Bluff checks to convince others that he is human. This racial trait replaces agile.'),
    ('Racial Trait', KITSUNE, 'Nimble Dash', ARG,
     'Kitsune are light on their feet and capable of quick movement in a pinch thanks to their lithe bodies and limber frames. The kitsune gains Run as a bonus feat at 1st level. Additionally, the kitsune receives a +5 foot bonus to his speed when using the charge, run, or withdrawal actions. In his true form, this bonus increases to +10 feet. This racial trait replaces agile.'),
    ('Racial Trait', KITSUNE, 'Nine-Tailed Inheritor', ARG,
     'The kitsune is a wellspring of magical energy that manifests as additional tails. The kitsune gains Magical Tail as a bonus feat at 1st level. In addition, he adds Magical Tail to all class lists of bonus feats as initial feat choices for those lists, including all ranger combat styles and all sorcerer bloodlines. For example, a monk can select Magical Tail when he gains his first bonus feat at 1st level while a ranger can select it when he gains his first combat style feat at 2nd level. Additionally, the kitsune treats Magical Tail as all types of feats (except teamwork) when determining which feats he can select with a class’s bonus feats feature. A kitsune with this racial trait cannot select Magical Tail as a class bonus feat and as a feat from character advancement during the same level. This racial trait replaces natural weapons.'),
    ('Racial Trait', KITSUNE, 'Prankster', ARG,
     'Kitsune pranksters are experts at fooling and tricking others. A kitsune gains a +1 racial bonus on Bluff and Sleight of Hand checks and one of these skills is always a class skill for him. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Shifting Mind', ARG,
     'A kitsune’s shapeshifting abilities make him resistant to mental attacks. The kitsune gains a +2 bonus on Will saves. Additionally, once per day the kitsune can roll twice when making a Will save and use the better result. He must choose to use this ability before attempting the saving throw. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Skulker', ARG,
     'Kitsune are able to hide undetected from others with ease. The kitsune gains a +1 racial bonus on Stealth checks and Stealth is always a class skill for him. This racial trait replaces agile.'),
]
