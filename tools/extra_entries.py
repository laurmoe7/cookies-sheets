"""Compendium entries typed in by hand, for rules text the PSRD books and the spreadsheet do not have.

`build_data.py` adds them last (see `late` in `write_db`), so adding one never moves the id of another entry.
Each is (category, sub, name, source, text); the text becomes one paragraph. Add a row, rebuild.
"""

KITSUNE = 'Kitsune'
ARG = 'Advanced Race Guide'
BOTB = 'Blood of the Beast'

ENTRIES = [
    ('Racial Trait', KITSUNE, 'Duplicitous', 'Inner Sea Races',
     'Many kitsune prefer to avoid the attention they often attract from human neighbors and attempt to convince all around them that they are human. They gain a +2 racial bonus on Bluff and Disguise checks. This racial trait replaces kitsune magic.'),
    ('Racial Trait', KITSUNE, 'Fast Shifter (Su)', ARG,
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

# Ganzi (Planar Adventures): native outsiders touched by the chaos of the Maelstrom. Every ganzi has one oddity; each oddity is typed as
# a trait that takes the place of "Ganzi Oddity", so the level-up wizard offers them as the choices for it.
GANZI = 'Ganzi'
PA = 'Planar Adventures'
_ODD = ' Pick one oddity in place of the general entry: this racial trait replaces ganzi oddity.'

ENTRIES += [
    ('Race', 'Other Race', 'Ganzi', PA,
     'Ganzi are native outsiders of humanoid descent whose bloodlines were touched by the raw chaos of the Maelstrom, often through a protean ancestor. '
     'Each one carries some strange mark of that chaos, an oddity. They stand about 5 to 6 feet tall and weigh 100 to 300 pounds, though ganzi vary wildly. '
     'Racial traits: +2 Constitution, +2 Charisma, -2 Intelligence; Medium; base speed 30 feet; darkvision 60 feet; '
     'maelstrom resistance (acid 5, electricity 5, sonic 5, and +2 on saves against polymorph spells); +2 on Sense Motive and Survival; one ganzi oddity. '
     'Languages: Common plus one of Abyssal, Celestial or Protean; bonus languages Abyssal, Aklo, Aquan, Auran, Celestial, Ignan, Protean, Sylvan and Terran.'),
    ('Racial Trait', GANZI, 'Ability Score Modifiers', PA, 'Ganzi are hardy and forceful but impulsive: +2 Constitution, +2 Charisma, and -2 Intelligence.'),
    ('Racial Trait', GANZI, 'Type', PA, 'Ganzi are outsiders with the native subtype.'),
    ('Racial Trait', GANZI, 'Size', PA, 'Ganzi are Medium creatures and have no bonuses or penalties due to their size.'),
    ('Racial Trait', GANZI, 'Base Speed', PA, 'Ganzi have a base speed of 30 feet.'),
    ('Racial Trait', GANZI, 'Darkvision', PA, 'Ganzi can see in the dark up to 60 feet.'),
    ('Racial Trait', GANZI, 'Maelstrom Resistance', PA,
     'Ganzi have acid resistance 5, electricity resistance 5 and sonic resistance 5, and a +2 racial bonus on saving throws against spells of the polymorph subschool.'),
    ('Racial Trait', GANZI, 'Skilled', PA, 'Ganzi gain a +2 racial bonus on Sense Motive and Survival checks.'),
    ('Racial Trait', GANZI, 'Ganzi Oddity', PA,
     'Every ganzi has one oddity, rolled on a d20 or chosen with the GM: 1-2 chaos champion, 3-4 entropic flesh, 5-6 prehensile tail, 7-14 quibble (the most common), '
     '15-18 spell-like ability, 19-20 weaponplay. With the GM’s permission a ganzi can take one of the expanded oddities instead (amorphous limbs, ink, racing mind, '
     'expanded spell-like ability, uncanny aura, vestigial wings, void touch).'),
    ('Racial Trait', GANZI, 'Languages', PA,
     'Ganzi begin play speaking Common and one of Abyssal, Celestial or Protean. Ganzi with high Intelligence scores can choose from Abyssal, Aklo, Aquan, Auran, Celestial, Ignan, Protean, Sylvan and Terran.'),
    ('Racial Trait', GANZI, 'Chaos Champion (Su)', PA,
     'Once per day as a swift action, the ganzi can smite law: against one lawful creature it adds its Charisma modifier to attack rolls and its Hit Dice to damage rolls, until the target is dead or the ganzi rests.' + _ODD),
    ('Racial Trait', GANZI, 'Entropic Flesh (Ex)', PA,
     'The ganzi gains a +2 bonus on Escape Artist checks and to its CMD against grapple. When a hostile transmutation effect takes hold of it, it can attempt a new saving throw with a +4 bonus '
     'at the start of its next turn to end the effect; if that fails, the effect lasts as normal.' + _ODD),
    ('Racial Trait', GANZI, 'Prehensile Tail (Ex)', PA,
     'The ganzi has a tail that can carry objects. It cannot wield weapons with it, but it can draw a small stowed item as a swift action.' + _ODD),
    ('Racial Trait', GANZI, 'Quibble (Su)', PA,
     'Once per day as an immediate action, after a creature within 20 feet rolls a d20 but before the result is announced, the ganzi can make it roll again and take the second result. '
     'An unwilling creature can resist with a Will save (DC 10 + 1/2 the ganzi’s level + its Charisma modifier). This is a curse effect.' + _ODD),
    ('Racial Trait', GANZI, 'Spell-Like Ability (Sp)', PA,
     'The ganzi can use one of these once per day, with a caster level equal to its Hit Dice: alter self, blur, detect thoughts, hideous laughter, minor image, shatter or spider climb.' + _ODD),
    ('Racial Trait', GANZI, 'Weaponplay (Ex)', PA,
     'The ganzi is proficient with all simple and martial weapons, and can take feats that require fighter levels (such as Weapon Specialization) as if its character level were its fighter level.' + _ODD),
    ('Racial Trait', GANZI, 'Amorphous Limbs (Su)', PA,
     'Expanded oddity. As a swift action, once every 1d4 rounds, the ganzi can turn a limb into a natural weapon that deals 1d6 bludgeoning, piercing or slashing damage '
     '(lethal or nonlethal, its choice) until the start of its next turn.' + _ODD),
    ('Racial Trait', GANZI, 'Ink (Ex)', PA,
     'Expanded oddity. As a standard action, once per day plus once more per 4 Hit Dice, the ganzi can spit ink within 30 feet: as a ranged touch attack that blinds the target for 1d4 rounds '
     'unless it makes a Fortitude save, or onto a square that stays slick for 1d6 rounds, where creatures that enter must make a Reflex save or fall prone '
     '(DC 10 + 1/2 its Hit Dice + its Constitution modifier).' + _ODD),
    ('Racial Trait', GANZI, 'Racing Mind (Ex)', PA, 'Expanded oddity. The ganzi gains a +2 bonus on Will saves against mind-affecting effects.' + _ODD),
    ('Racial Trait', GANZI, 'Expanded Spell-Like Ability (Sp)', PA,
     'Expanded oddity. The ganzi can use one of these once per day, with a caster level equal to its Hit Dice: acid arrow, gust of wind, mirror image, resist energy, scorching ray, '
     'see invisibility or warp wood.' + _ODD),
    ('Racial Trait', GANZI, 'Uncanny Aura (Su)', PA,
     'Expanded oddity. Once per day as a standard action, the ganzi gives off an unsettling aura for a number of rounds equal to its Charisma modifier (at least 1). Enemies within 30 feet '
     'must make a Will save (DC 10 + 1/2 its Hit Dice + its Charisma modifier) or be frightened until the start of its next turn. A creature that has been affected, '
     'whether or not it saved, is immune for 24 hours.' + _ODD),
    ('Racial Trait', GANZI, 'Vestigial Wings (Ex)', PA,
     'Expanded oddity. The ganzi has small wings that cannot fly but steady it: +1 on Reflex saves and +2 on Acrobatics checks to keep its balance.' + _ODD),
    ('Racial Trait', GANZI, 'Void Touch (Su)', PA,
     'Expanded oddity. Three times per day, when it hits with a melee attack, the ganzi can as a free action force the target to make a Will save '
     '(DC 10 + 1/2 its Hit Dice + its Constitution modifier) or be confused for 1 round.' + _ODD),
]

# Racial favored class options that the books fcb.py reads do not have, in its output shape {race: {class: [{text, source}]}}.
# build_data.py adds them to data/fcb.json.
FCB = {
    GANZI: {cls: [{'text': text, 'source': PA}] for cls, text in {
        'Arcanist': 'Add +1/2 to the arcanist’s caster level when casting spells with the chaotic descriptor.',
        'Bard': 'Add +1/2 to the bard’s bardic knowledge bonus.',
        'Druid': 'Gain a +1 bonus on Knowledge (nature) and Knowledge (planes) checks about plants and animals from other planes.',
        'Hunter': 'The hunter’s animal companion gains a +1 bonus on Acrobatics and Stealth checks while not on the Material Plane.',
        'Investigator': 'Gain 1/3 of an extra point for the inspiration pool.',
        'Oracle': 'Learn one extra enchantment spell from the cleric or wizard list, at least one level below the highest level of spell the oracle can cast.',
        'Rogue': 'Add +1/2 on Stealth checks while not on the Material Plane.',
        'Sorcerer': 'Choose one abyssal or protean bloodline power; treat the sorcerer’s level as +1/2 higher for it (at most +4).',
        'Wizard': 'Add +1/3 to the wizard’s caster level when casting spells with the chaotic descriptor.',
    }.items()},
}
