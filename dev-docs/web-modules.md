# Front-end modules (`web/js/`)

Vanilla ES modules, no build step, no framework. Most rules modules are pure (no DOM) and have `tests/<name>.test.mjs`; each file starts with a comment saying what it does. Per-area UI rules are in [ui-conventions.md](ui-conventions.md).

## Core

- `calc.js`: **all rules math**. `compute(char, classesByName)` returns every derived number. Views never do rules math themselves.
- `data.js`: rules tables (races, skills, sizes, bonus types, buff presets, XP tracks). `rulesdata.js` holds the Quick Rules cards.
- `model.js`: `newCharacter()` (the save format), `migrate()` (fills fields old saves lack) and `MODEL_VERSION`.
- `app.js`: state, routing (`go(view)`), saving, and the two-way binding.
- `views/*.js`: one module per page. `sheet.js` is the character sheet tabs; `levelup.js` is the wizard; `csimport.js` is the import dialog; `archetypes.js` is the archetype chooser; `spellpicker.js` is the multi-pick spell chooser that stays open until the allowance is used.

## Importers

- `importcs.js`: charactersheet.co.uk to our model (pure). Tested with `tests/fixtures/cs_fumu.json`, a real export with the account details stripped.
- `importgs.js`: reads the Google Sheets template's CSV into the charactersheet.co.uk shape, so the same importer and numbers check run on it.

## Classes and spells

- `features.js`: class features with **archetypes applied**. An archetype chosen for a class is stored on the character (`c.archetypes[cls] = [bakeArchetype(...)]`), so saves don't depend on the database. Its class-skill changes and diminished spellcasting apply in `calc.js`.
- `spellrules.js`: how many spells a class learns per level (spells-known table, spellbook classes, or none).
- `rest.js`: the Rest button's rules (HP per level, ability damage, pools, slots, daily item charges).
- `classabilities.js`: class features you use (smite evil, lay on hands, wild shape...) as chips beside the spell-likes on the Spells tab. `mercy.js`: the paladin's mercies on lay on hands (`views/mercy.js` is the chooser).
- `featchoice.js`: feats taken for one weapon, natural attack, skill or school (Weapon Focus, Skill Focus...); the choice is the feat's `choice`.
- `traits.js` (trait counts and categories), `autofx.js` (always-on trait and racial bonuses), `racetraits.js` (standard and alternate racial traits), `racialtraits.js` (moves racial traits out of old saves' special abilities). `featchoice` and `autofx` are tested in `statroll.test.mjs`.
- `statroll.js` (rolled ability scores, kept in `c.abilityRolls`), `wealth.js` (starting gold).

## Equipment

- `weaponfx.js`: weapon enchantments and special materials. A weapon stores `mw`, `material`, `improvedCritical` and `fx: [{id, on}]`; `compute()` folds them into `d.weapons[i]` (`damageText` with the extra dice, `crit`, `critText`). `views/weaponfx.js` is the ✦ Enchant window.
- `armorfx.js`: the same for armor and shields: `mw`, `material`, `fx: [{id}]` on each `c.armor` item; `compute()` applies them to the check penalty, Dex cap, spell failure, weight, speed and Stealth/Escape Artist, and returns `d.armorFx` (DR, SR, resistances, fortification). `views/armorfx.js` is its window.
- `paperdoll.js`: the Inventory tab's paper doll: `SLOTS`/`LAYOUT`, `wornBySlot`, `candidates`, `wear`, `takeOff`. An item is worn in a slot when it has `slot` (armor and shields use their Worn tick and default to the Armor/Shield slot); gear from the compendium also keeps `hint`, the slot family its `sub` names. `views/paperdoll.js` draws the card and the slot window.
- `itemfx.js`: bonuses on inventory items. `g.effects` has the same shape as a buff's effects and `compute()` adds them while the item has a slot (is worn). `suggestEffects(name)` knows the standard items (cloak of resistance, ring of protection, amulet of natural armor, bracers of armor, ability belts, headbands...); the item panel in `views/sheet.js` (`renderItemActions`) edits them with `editModifier`.
- `magicgear.js`: "＋ Magic item". `parseMagicWeapon` / `parseMagicArmor` read the base item, +N, abilities and material from a compendium entry's text against small `WEAPONS` / `ARMORS` tables (Medium size). `app.magic_gear(kind, q)` (`/api/magic-gear`) lists the candidates: the compendium tags armor and shields (`sub`) but not weapons, so weapons are the slotless items whose text names a +N weapon.
- `charges.js`: wand and staff charges and daily item uses (`g.charges`); see the Item charges bullet in [ui-conventions.md](ui-conventions.md).
- `equipment.js`: the weapon and armor templates (see [data-pipeline.md](data-pipeline.md)).

## Companions

- `companions.js`: animal companion, eidolon and familiar stat blocks from `data/companions.json`. The UI is `views/companions.js` (the sheet's Companions tab).
- `creaturecomp.js` (companions from the creature list), `compgear.js` (barding and worn items), `tricks.js` (Handle Animal tricks), `summons.js`.

## Small helpers

`spellstat.js` (a spell's stat block laid out), `safehtml.js` (cleans HTML that did not come from our compendium), `bars.js` (HP bar segments).
