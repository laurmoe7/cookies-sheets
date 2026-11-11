"""Drawbacks from the Player Companions, which the PSRD books lack (the 17 in Ultimate Campaign come from the books).

The list is d20pfsrd.com's drawbacks index (https://www.d20pfsrd.com/traits/drawbacks/). The text is a short summary of each
drawback's effect, not the book's wording; the source is the book its page credits. build_data.tag_drawbacks adds these as
Trait entries with the category 'Drawback', skipping any name the books already have.
"""

QC = 'Quests & Campaigns'
SH = "Spymaster's Handbook"
AH = "Antihero's Handbook"
CC = 'Champions of Corruption'

# (name, source, text)
DRAWBACKS = [
    ('Anxious', QC, 'You take a –2 penalty on Diplomacy checks. You must speak slowly because of the concentration it takes, and unless stated otherwise you are assumed not to speak above a whisper.'),
    ('Betrayed', SH, 'When you attempt a Sense Motive check to get a hunch, roll twice and take the lower result. You cannot reroll it, even with an ability that would let you.'),
    ('Bitter', AH, 'When you are healed by an ally’s class feature, spell or spell-like ability, that healing is reduced by 1 hit point.'),
    ('Burned', QC, 'You take a –1 penalty on saving throws against fire effects. While adjacent to open flames or on fire, you take a –1 penalty on attack rolls, saving throws and skill checks until you spend a full round away from fire.'),
    ('Condescending', QC, 'You take a –5 penalty on Diplomacy and Intimidate checks to improve other creatures’ attitude toward you.'),
    ('Cowardly', AH, 'Your base speed increases by 5 feet when you are frightened and fleeing, but the penalties from the cowering, frightened, panicked and shaken conditions increase by 1 for you. If you would be immune to fear, you lose that immunity and do not take these penalties.'),
    ('Cruelty', QC, 'In combat, while there are dying or helpless foes within 30 feet of you, you take a –2 penalty on attack rolls against foes that are neither dying nor helpless.'),
    ('Empty Mask', SH, 'You take a –1 penalty on Will saves against compulsion effects, or –2 against foes who know your true identity.'),
    ('Entomophobe', AH, 'You take a –2 penalty on attack rolls against vermin, and a –2 penalty on saving throws against the nausea of a swarm’s distraction.'),
    ('Envy', QC, 'Each day you do not steal at least 10 gp worth of valuables, attempt a DC 20 Will save. On a failure you take a cumulative –1 penalty (up to –5) on Will and Reflex saves and concentration checks; on a success the penalty goes back to 0.'),
    ('Fey-Taken', QC, 'You take a –2 penalty on saving throws against disease, illusions and poison, and against the spells, spell-like abilities and supernatural abilities of fey.'),
    ('Forgetful', QC, 'Whenever you leave a place where you spent more than 1 hour, attempt a DC 10 Wisdom check. On a failure you leave one random mundane item behind (a purse of money counts as an item).'),
    ('Foul Brand', CC, 'The symbol of an evil deity is burned into your skin. On the hand: –1 on Disable Device, Disguise and Sleight of Hand checks. On the face: –2 on Bluff, Diplomacy and Disguise checks. It does not count as a holy symbol for a divine focus.'),
    ('Guilty Fraud', SH, 'You got something through trickery and the guilt distracts you. You take a –4 penalty on Bluff checks against creatures whose attitude toward you is indifferent or better.'),
    ('Haunted', AH, 'A past event or hidden secret keeps you from peace. You take a –2 penalty on saving throws against spells with the evil descriptor.'),
    ('Haunting Regret', QC, 'The unquiet spirit of a quarrelsome relative appears at bad moments. You take a –2 penalty on saving throws against swarm distraction and mind-affecting effects, and on concentration checks.'),
    ('Helpless', AH, 'The first time each combat that an ally within 30 feet of you falls unconscious or dies from an attack, you are dazed until the end of your next turn.'),
    ('Impatient', AH, 'You cannot delay or ready actions. If you are the last of your allies to act in a combat round, you take a –1 penalty on ability checks, attack rolls, saving throws and skill checks.'),
    ('Infamous', SH, 'You were publicly tied to a notorious crime. You and anyone seen as your ally take a –4 penalty on Diplomacy checks with law-abiding citizens (except enemies of the authority that accused you), and you risk prison where the crime took place.'),
    ('Information Overload', SH, 'You have heard too many false reports to tell truth from fiction. You take a –2 penalty on all Knowledge checks, and failing one by 5 or more can make you recall something opposed to the truth.'),
    ('Insatiable', AH, 'Goods and services cost you 10% more, and allies cannot pay for them for you. You need twice the normal food and water to avoid starvation and thirst.'),
    ('Lonely', SH, 'You trust others far too easily. You take a –2 penalty on Sense Motive checks, on Perception checks to see through disguises, and on saving throws against charm effects.'),
    ('Loner', QC, 'You take a –1 penalty to AC and on attack rolls while adjacent to an ally, and when you take the aid another action.'),
    ('Magical Klutz', SH, 'Magic surges around you. Roll twice and take the lower result on Use Magic Device checks to activate items blindly, and on Reflex saves against effects from magic items.'),
    ('Mark of Slavery', QC, 'You were enslaved and branded in your youth. After you fail a skill check, you take a –2 penalty on skill checks and attack rolls until the end of your next turn, except to retry the failed check.'),
    ('Misbegotten', QC, 'A deformity hampers your movement. You take a –2 penalty on all Dexterity-based skill checks.'),
    ('Naive', QC, 'You assume everyone is good at heart. You take a –2 penalty to AC against improvised weapons and a –2 penalty to CMD against dirty trick combat maneuvers.'),
    ('Nervous', QC, 'When you take 10 on a check that has a consequence for failure (other than lost time), treat it as taking 8 instead, even if you could take your time.'),
    ('Oblivious', QC, 'You take a –2 penalty on Sense Motive checks and on Perception checks that rely on sight.'),
    ('Occult Bargain', SH, 'Your magic comes from a secret entity. You take a –1 penalty on concentration checks, and each day you must invoke its name or you cannot regain spell slots that day. You must be able to cast 0- and 1st-level spells from a class feature.'),
    ('Oppressive Expectations', QC, 'After you fail a skill check, you take a –2 penalty on checks with that skill until you succeed at it or fail a different skill check, whichever comes first.'),
    ('Overprotective', QC, 'If an ally falls unconscious from hit point damage, you take a –2 penalty on attack rolls and skill checks while you are more than 10 feet from that ally.'),
    ('Righteous Indignation', SH, 'When a foe provokes an attack of opportunity from you, you must take it unless you succeed at a Will save (DC 10 + your level). You take a –1 penalty on Will saves against emotion spells without the fear descriptor.'),
    ('Scarred', AH, 'You are visibly scarred. You take a –5 penalty on Disguise checks and a –2 penalty on Bluff checks.'),
    ('Secret Shame', SH, 'You take a –1 penalty on saving throws against fear effects, and the DC of Intimidate checks to demoralize you is 1 lower. If you would be immune to fear, you lose that immunity instead.'),
    ('Self-Doubting', AH, 'The first time each day you fail a Will save or a skill check, you take a –2 penalty on your next Will save or skill check of that kind.'),
    ('Shadow-Scarred', QC, 'You take a –1 penalty on saving throws while you are in dim light or darkness.'),
    ('Sheltered', QC, 'You are shaken whenever you have less than half your maximum hit points.'),
    ('Sleepy', QC, 'You take a –2 penalty on saving throws against sleep effects.'),
    ('Spooked', QC, 'When you notice a fey, outsider or undead within 60 feet, you are shaken for 1d4 rounds unless you succeed at a Will save (DC 15 + its Charisma modifier). Immunity to fear does not skip the save, but gives you a +4 bonus on it.'),
    ('Stigmatized', AH, 'You take a –3 penalty on Diplomacy checks to gather information or to improve a creature’s attitude.'),
    ('Superstitious', QC, 'When a harmless spell targets you, there is a 50% chance you must attempt a saving throw against it as if it were not harmless. This does not apply to spells you cast on yourself.'),
    ('Tainted Spirit', QC, 'At the end of each combat, attempt a Fortitude save (DC 10 + the number of rounds you acted). On a failure you are fatigued for 10 minutes per round you acted.'),
    ('Too Many Secrets', SH, 'You take a –2 penalty on Bluff checks and on saving throws against illusions.'),
    ('Umbral Unmasking', CC, 'You cast no shadow, or a monstrous one. A creature that succeeds at a DC 15 Wisdom check notices it. Misdirection, nondetection and illusions cannot hide it unless they also affect shadows (such as invisibility).'),
    ('Unlearned', QC, 'Choose one Knowledge skill. You cannot attempt untrained checks with any other Knowledge skill, even DC 10 or lower ones, except with the help of a library on that subject (at a –2 penalty).'),
    ('Vainglory', SH, 'You take a –1 penalty on Bluff, Disguise and Stealth checks, and the save DC of illusions you create is 1 lower.'),
    ('Warded Against Nature', CC, 'Animals do not willingly come within 30 feet of you unless you or their master succeeds at a DC 20 Handle Animal, Ride or wild empathy check. Animal companions, familiars and mounts from class features are not affected.'),
]
