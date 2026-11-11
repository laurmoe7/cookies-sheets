# Data pipeline

`python tools/build_data.py` builds `data/pf1e.db` and the JSON files in `data/` from `tools/sources/`.

## Sources

`tools/sources/` is git-ignored (about 65 MB). It holds:

- `psrd/*.db`: 19 book databases from https://github.com/devonjones/PSRD-Data, covering the Core Rulebook through the Advanced Class Guide (2015).
- `spells.tsv`: the community spell spreadsheet from https://github.com/sturlabragason/pathfinder_spells. It adds about 700 later-book spells.
- `aon/`: cached Archives of Nethys pages. `tools/aon_archetypes.py` (Ninja, Samurai and Antipaladin archetypes) and `tools/aon_races.py` (the non-core races' standard racial traits) fetch only what is not cached, then write `data/aon_archetypes.json` and `data/aon_race_traits.json` (committed), which `build_data.py` merges.

Hand-typed entries are in `tools/extra_entries.py` and `tools/extra_drawbacks.py`.

## Output

`data/pf1e.db` is generated and git-ignored. The JSON files are generated but committed, because the tests and the app use them; diff `data/classes.json` after parser changes. See [server.md](server.md) for rebuilding while the app runs.

**Categories:** `build_data.py` maps PSRD section types to app categories in `TYPE_CATEGORY`. "Rules" entries come from `RULE_BOOKS`. Search ranking order is `CAT_ORDER` in `app.py`.

## Classes

Class progression comes from parsed PSRD tables in `data/classes.json`.

- BAB and saves are read by column position, not header name (Swashbuckler's headers differ).
- Casting metadata (stat, prepared/spontaneous, `cl_offset`, domain slot) is hand-written in `CLASSES` in `build_data.py`.

**Prestige classes** (`PRESTIGE` in `build_data.py`: the Core Rulebook's 10 and the APG's 8) are in `classes.json` with `prestige: true`, 10 levels, `requirements` (text, not checked) and `advances` on the levels whose Spells per Day column adds a caster level (`'arcane'`, `'divine'`, `'any'` or `'Alchemist'`). Base casters carry `casting.tradition`.

- A prestige level's level-up records the base classes it advanced (`levelUps[i].advances`); `casterLevels(c)` in `calc.js` adds those to the class's own levels for spells per day, spells known and caster level.
- Other class features (sneak attack, bloodline, channel energy) are not advanced.
- Prestige classes the books lack are typed in by hand in `tools/extra_classes.py` (`CLASSES` in the same shape, plus a compendium entry in `ENTRIES`). The Unicorn Charger (Legendary Games) casts its own spells, so a prestige class can have `casting` too.

## Archetypes

`tools/archetypes.py` parses each archetype into features (level, replaces/modifies targets, advice lists), class-skill changes and diminished spellcasting. The result is stored as JSON in `entries.meta` and served by `/api/archetypes?cls=`. The app matches about 82% of "replaces X" targets against the class table; the rest (proficiencies, deeds, bonus spells) are not table features and are shown as text. See also the Archetype targets bullet in [ui-conventions.md](ui-conventions.md).

## Companions

`tools/companions.py` writes `data/companions.json` (committed): both progression tables, 68 animal species with advancement, eidolon base forms and evolutions, and 26 familiar kinds (stat blocks from the `Familiar, X` creatures plus the master-bonus tables, and the wizard familiar progression).

- Familiar stats borrow the master's BAB, base saves, HP and skill ranks (`computeCompanion(..., master)`).
- `familiar.improved` holds the 25 Improved Familiar kinds (the `IMPROVED` list in `companions.py`: Core list plus the Ultimate Magic update, each with the alignment and arcane caster level it needs, built from the Bestiary stat blocks).
- `familiar.templates` holds the celestial/entropic/fiendish/resolute archetypes (defenses by Hit Dice, which for a familiar is master level). `comp.template` picks the archetype (ignored on improved kinds); `computeFamiliar` adds darkvision, smite, resistances, DR and SR (CR + 5, or master level + 5 at 11th, whichever is higher) and returns `requirements` (feat, alignment within one step, master level) that the card shows as ticks.
- Not modelled: the Evolved Familiar feat and other familiar-changing feats; mephit and the other "any type" kinds use the base stat block, not each type's breath weapon.

## Granted spells

`tools/grants.py` writes `data/grants.json` (committed): cleric domains and subdomains, druid domains, sorcerer and bloodrager bloodlines, oracle mysteries, witch patrons and shaman spirits, each with its spell list (`level`, and `at` when the book gives the class level).

The character stores only the choice (`c.grantChoices[cls] = [{kind, name}]`); `js/grants.js` (pure, tested) works out the spells due at a caster level, and `views/grantpicker.js` adds them to the Spells tab with `granted: 'Fire domain'`. Granted spells do not count against spells known. Not modelled: archetypes that change these lists (gravewalker, crusader...), the shaman's wandering spirit.

## Racial favored class options

`tools/fcb.py` writes `data/fcb.json` (committed), `{race: {class: [{text, source}]}}`, from the race sections of the APG, ARG and ACG. The level-up wizard offers them when the class is the favored class (`fcb: 'racial'`, text in `fcbNote`); they have no automatic effect on the numbers.

## Weapons and armor

- **Compendium entries:** the compendium files the standard weapons and armor under Magic Item with only a price and weight. `equipment.enrich()` (run by `build_data.py`) matches them by name as a set of words to `data/equipment.json` and adds the combat stats (damage by size, critical, range, type, category, proficiency, special, and weapon groups from the Core Rulebook's fighter weapon training lists) to the entry's stat list, its summary and its search text.
- **Templates:** `tools/equipment.py` writes `data/equipment.json` (committed, about 35 KB): about 170 weapons (Ultimate Equipment's Simple, Martial and Exotic tables) and 44 armors and shields, with the book's numbers. "＋ Add weapon" and "＋ Add armor/shield" (`views/equipment.js`, `js/equipment.js`, pure and tested) list them, or give a blank row. Weapons from other books (kunai, handwraps...) are not in it; add them by hand.

## Creatures

`tools/creatures.py` writes `data/creatures.json` (committed, about 3 MB, minified): every creature stat block in the PSRD books that has hit points, once per name and book, with its special ability write-ups. `build_data.py` writes it with the other data files; `app.py` keeps it in memory (`creature_list`, `search_creatures`, `get_creature`). A companion taken from it is a `creature` companion that stores the whole stat block (`js/creaturecomp.js`).

## Summons

`tools/summons.py` writes `data/summons.json` (committed): the Core Rulebook Summon Monster / Summon Nature's Ally lists by level, with each creature's Bestiary stat block (the Core Rulebook lists only).

`js/summons.js` is the pure part; `views/summons.js` has the chooser modal and the Summons page of the Companions tab (its second sub-tab; `summonsView.open` makes the tab open there after a summon). Tracked summons live in `c.summons` and copy their key stats at creation. Modals sit above the side panel, so stat blocks inside the chooser are shown in its own preview pane. Note the side panel treats every `<a>` as a compendium lookup.
