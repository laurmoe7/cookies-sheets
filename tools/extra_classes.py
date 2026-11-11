"""Classes typed in by hand, for classes the PSRD books do not have (third-party prestige classes from d20pfsrd.com, Open Game Content).

`build_data.py` appends CLASSES to data/classes.json (same shape as the parsed ones) and ENTRIES to the compendium, so the
level-up wizard's "read class" link finds them. Add a class here, rebuild (`python tools/build_data.py`).
"""
import html

N = None


def _levels(bab, fort, ref, will, special, per_day=None, known=None):
    out = []
    for i in range(len(bab)):
        lv = dict(level=i + 1, bab=bab[i], fort=fort[i], ref=ref[i], will=will[i], special=special[i])
        if per_day:
            lv['spells_per_day'] = [N] + list(per_day[i]) + [N] * (9 - len(per_day[i]))
            lv['spells_known'] = [N] + list(known[i]) + [N] * (9 - len(known[i]))
        out.append(lv)
    return out


GOOD = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
POOR = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3]

# Unicorn Charger (Legendary Games), https://www.d20pfsrd.com/classes/3rd-party-prestige-classes/legendary-games/unicorn-charger-prestige-class/
# Spells: spontaneous, paladin list, Charisma, 1st-4th level, no orisons. Table 11-3's "+r" (one more spell known of each level, from the
# ranger list) is counted in spells_known, and the ranger list is open for it. The page gives no caster level, so it is the class level.
UNICORN_CHARGER = dict(
    name='Unicorn Charger', group='Prestige', prestige=True, source='Legendary Games (third party)', hit_die=10,
    alignment='Any good.', skill_ranks=2,
    class_skills=['Craft', 'Diplomacy', 'Handle Animal', 'Knowledge (nature)', 'Knowledge (religion)', 'Profession', 'Ride',
                  'Sense Motive', 'Stealth', 'Survival'],
    requirements=[
        'Base Attack Bonus: +6.',
        'Feats: Mounted Combat.',
        'Skills: Handle Animal 5 ranks, Knowledge (nature) 5 ranks, Survival 5 ranks.',
        'Languages: Sylvan.',
        'Class Feature: Divine bond, hunter’s bond, mount, nature’s bond, or a similar feature that grants a horse or pony (or a similar creature, at the GM’s discretion) as an animal companion.',
        'Special: Peaceful contact with a unicorn, whether called, summoned, or present under its own power.',
    ],
    casting=dict(stat='cha', kind='spontaneous', lists=['Paladin', 'Ranger'], cl_offset=0, max_level=4, tradition='divine'),
    levels=_levels(
        bab=list(range(1, 11)), fort=GOOD, ref=POOR, will=POOR,
        special=['Aura of good, detect evil, unicorn mount, wild empathy', 'Poison resistance +2, woodland stride',
                 'Horn of healing, smite evil 1/day', 'Aura of courage, unicorn’s charge', 'Forestmaster, poison resistance +4',
                 'Horn of purity, smite evil 2/day', 'Forest leap, pure heart', 'Aura of resolve, poison resistance +6',
                 'Horn of light, smite evil 3/day', 'Forestmaster’s charge, poison immunity'],
        per_day=[(), (0,), (1,), (1, 0), (1, 1), (1, 1, 0), (1, 1, 1), (2, 1, 1, 0), (2, 2, 1, 1), (2, 2, 1, 1)],
        known=[(), (3,), (4,), (5, 3), (5, 4), (5, 4, 3), (6, 5, 4), (6, 5, 4, 3), (6, 5, 5, 4), (6, 6, 5, 4)],
    ),
)

CLASSES = [UNICORN_CHARGER]

_UC_FEATURES = [
    ('Weapon and Armor Proficiency', 'Proficient with the lance and with shields (except tower shields). No other weapon or armor proficiencies.'),
    ('Aura of Good (Ex), 1st', 'An aura of good like a cleric’s, of a strength equal to character level; the mount’s uses its Hit Dice. An antipaladin’s smite deals extra damage to the charger and the mount.'),
    ('Detect Evil (Sp), 1st', 'As the paladin ability.'),
    ('Unicorn Mount (Ex), 1st', 'The mount gains a primary gore attack, Intelligence 6, and speaks and understands Sylvan; its horn can shed light at will. Unicorn charger levels stack with the class that grants the companion or mount. At 3rd level and every 3 levels after, the mount gains a +2 enhancement bonus to Int, Wis or Cha (the charger’s choice).'),
    ('Wild Empathy (Ex), 1st', 'As the druid ability, with a bonus of twice the class level with good magical beasts. Stacks with wild empathy from other classes.'),
    ('Spellcasting, 2nd', 'Casts divine spells spontaneously from the paladin list, using Charisma for the highest spell level, save DCs and bonus spells, like a paladin (Table 11-2 spells per day, Table 11-3 spells known). Gains one more spell known of each level, chosen from the ranger list. Can swap a spell known at 4th level and every 3 levels after. A paladin may advance the two classes’ spellcasting separately or count unicorn charger levels as paladin levels for spellcasting.'),
    ('Poison Resistance (Ex), 2nd', '+2 on saves against poison, +4 at 5th, +6 at 8th, and immunity at 10th. The mount shares it.'),
    ('Woodland Stride (Ex), 2nd', 'As the druid ability, for the charger and the mount.'),
    ('Smite Evil (Su), 3rd', 'As the paladin ability (1/day, 2/day at 6th, 3/day at 9th), for the charger and the mount; the first hit deals double the damage bonus against evil fey, magical beasts, monstrous humanoids, plants and lycanthropes instead of dragons, outsiders and undead.'),
    ('Horn of Healing (Su), 3rd', 'The mount heals with its horn, 1d6 per two class levels, following the lay on hands rules; 1 + the higher Charisma modifier of charger or mount uses per day.'),
    ('Aura of Courage (Su), 4th', 'As the paladin ability.'),
    ('Unicorn’s Charge (Ex), 4th', 'A +4 bonus (instead of +2) on attack rolls when charging, and no AC penalty after a charge while mounted.'),
    ('Forestmaster (Su), 5th', 'Non-evil animals, fey, magical beasts, monstrous humanoids, plants and lycanthropes are kept off as by sanctuary. Adds half the class level on Diplomacy checks with them, and on Intimidate checks against evil ones.'),
    ('Horn of Purity (Su), 6th', 'The healing horn can neutralize poison, and one extra use can remove a disease.'),
    ('Forest Leap (Sp), 7th', 'The mount can dimension door in forest terrain once per day, plus once more per level after 7th; the charger goes along only while riding it.'),
    ('Pure Heart (Su), 7th', 'The mount’s natural weapons count as good for damage reduction. While mounted, the charger can cast align weapon (good only), bless weapon, magic circle against evil and protection from evil.'),
    ('Aura of Resolve (Su), 8th', 'As the paladin ability.'),
    ('Horn of Light (Su), 9th', 'The horn counts as good for damage reduction, and the mount can cast daylight once per day. While mounted, the horn works as a limning weapon.'),
    ('Forestmaster’s Charge (Ex), 10th', 'The critical threat range doubles on a mounted charge. On a hit, the mount can deal double damage or make a free bull rush, overrun, sunder or trip.'),
]


def _class_html(c, blurb, features):
    rows = ''.join(f"<tr><td>{lv['level']}</td><td>+{lv['bab']}</td><td>+{lv['fort']}</td><td>+{lv['ref']}</td><td>+{lv['will']}</td><td>{html.escape(lv['special'])}</td>"
                   f"<td>{' / '.join('—' if x is None else str(x) for x in lv['spells_per_day'][1:5])}</td></tr>" for lv in c['levels'])
    return (f'<dl class="stat"><dt>Alignment</dt><dd>{html.escape(c["alignment"])}</dd><dt>Hit Die</dt><dd>d{c["hit_die"]}</dd></dl>'
            f'<p class="desc"><i>{html.escape(blurb)}</i></p>'
            '<h4>Requirements</h4><ul>' + ''.join(f'<li>{html.escape(r)}</li>' for r in c['requirements']) + '</ul>'
            f'<p class="field"><b>Class Skills:</b> {html.escape(", ".join(c["class_skills"]))}.</p>'
            f'<p class="field"><b>Skill Ranks at Each Level:</b> {c["skill_ranks"]} + Int modifier.</p>'
            '<table><thead><tr><th>Level</th><th>BAB</th><th>Fort</th><th>Ref</th><th>Will</th><th>Special</th><th>Spells per day (1st–4th)</th></tr></thead>'
            f'<tbody>{rows}</tbody></table>'
            '<h4>Class Features</h4>' + ''.join(f'<p><b>{html.escape(n)}:</b> {html.escape(t)}</p>' for n, t in features))


# (cat, sub, name, source, html, meta) for the compendium
ENTRIES = [
    ('Class', 'prestige', 'Unicorn Charger', UNICORN_CHARGER['source'],
     _class_html(UNICORN_CHARGER, 'A champion of unicorns and the spirits of the forest, who fights evil from the back of a mount that grows ever more unicorn-like, and brings healing where it rides.', _UC_FEATURES),
     {'hit_die': 'd10'}),
]
