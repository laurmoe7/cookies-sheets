# Cookie's Sheets

A standalone Windows desktop app for **Pathfinder 1st Edition** characters. It combines a live character sheet, a level-up wizard that does the math, a searchable OGL compendium, and quick-reference rules.

## Running it

- **Packaged app:** `dist\Cookie's Sheets\Cookie's Sheets.exe`. Copy the whole `Cookie's Sheets` folder anywhere you like and pin the .exe to your taskbar.
- **From source:** double-click the **Run Cookie's Sheets** shortcut (needs Python 3.10+ and `pip install -r requirements.txt`). `Run Cookie's Sheets.bat` does the same thing.
  - If you move the folder, recreate the shortcut with `powershell -ExecutionPolicy Bypass -File tools\make_shortcut.ps1`. Add `-Desktop` to also put one on your desktop.
  - The icon comes from `tools/make_icon.py`.

Characters save automatically, as plain `.json` files, to `Documents\Pathfinder Characters`. Deleted characters go to the `.deleted` subfolder, so you can get them back.

## Importing from charactersheet.co.uk

On the **Characters** page, click **Import from charactersheet.co.uk** and paste your sheet's link (the address shown while the sheet is open). Or, on that site's Characters page, click **Download** and pick the file with either import button.

Before saving, you see a preview where you can:
- Check the class levels it read from the "Class / Level" text. Archetypes and shorthand like "Ftr3/Rog2" are understood.
- Compare the old sheet's totals with what this app calculates.

Feats, traits, abilities, spells, and magic items are matched to the compendium where possible. Anything without a place on this sheet goes into the character's Notes. Your account details from the site are never saved.

## Features

**Character sheet**: every number updates instantly.
- Ability scores (base, racial, level-up increases, enhancement, misc, damage, drain), a point-buy counter, and 36 races with their racial modifiers
- HP with damage/heal buttons, temp HP and nonlethal damage, plus disabled/dying/dead status
- AC, touch, and flat-footed, with a breakdown by bonus type; CMB/CMD; initiative; speed (reduced by medium/heavy armor or load)
- Saves, BAB with iterative attacks, and a weapons table that calculates attack and damage (Str ×1, ×1½, ×½)
- Skills: class-skill +3, armor check penalty, size modifiers for Fly/Stealth, ranks spent vs. available, max ranks
- Feats, traits, and racial/special abilities picked from the compendium; class features listed automatically per level
- Spellbooks for every casting class: slots with bonus spells, spells known, save DCs, concentration, casting-defensively DCs, prepare/cast tracking, domain/school slot, and a rest button
- Gear, money, magic items, and encumbrance
- Archetypes: choose them when you take a class (descriptions and what each replaces). Their features replace the class features they replace, and class-skill and spellcasting changes apply automatically.
- Portrait (Overview tab) and a small name icon (top bar), stored in the character file as downscaled images
- Companions tab: animal companions (68 species, advancing at 4th/7th level) and eidolons (base forms, evolution points) with full stat blocks, plus familiars (26 kinds from the Bestiary, Ultimate Magic and Bestiary 3, advancing with your wizard, sorcerer and witch levels, plus 25 Improved Familiar kinds and the celestial, entropic, fiendish and resolute archetypes) and free-form entries for mounts and cohorts
- A search box in the top bar (Ctrl+F) finds anything on the open character, from skills to spells to notes, and jumps to it
- Summons: a "Summon…" button beside Summon Monster / Summon Nature's Ally spells (and at the top of Companions) picks a creature by list level; it is tracked under Companions → Summons with its key stats, hit points, rounds left, template and stat block
- Custom traits, feats, items and spells read like official ones: click to read the full text, double-click to edit
- **Buffs & conditions** with correct bonus-type stacking: Power Attack, Deadly Aim, and Combat Expertise scale with your BAB. Also Rage, Haste, Bless, Heroism, Enlarge Person, Shaken, Sickened, Fatigued, Grappled, and more, plus custom modifiers.

**Level Up wizard**: choose a class and it shows the before → after for HP, BAB, saves, CMB/CMD, and spells per day. It also handles:
- HP: average, roll, max, or manual
- Favored class bonus
- Feats every odd level, ability increases every 4th level
- Favored class bonus: +1 HP, +1 skill rank, or your race's own option for that class (about 430 options from the Advanced Player's Guide, Advanced Race Guide and Advanced Class Guide)
- Skill rank allocation with a live budget
- New class features (click any feature to read it)
- Spells to learn: only levels you can actually learn, with a "left to choose" counter (e.g. bard 1: 4 cantrips and 2 1st-level spells). Spellbook casters get every cantrip automatically.

You can undo the last level from the Bio tab. 32 classes are supported: the 11 core classes, plus APG, Magus, Gunslinger, Ninja, Samurai, Antipaladin, and all 10 ACG hybrid classes.

**Compendium** (Ctrl+K): full-text search over about 2,250 spells, 1,200 feats, 240 traits, races, classes, archetypes, class features, magic items, conditions, and the rules text. You can filter spells by class, level, and school, and add entries straight to your character.

**Quick Rules**: cheat-sheet cards for casting defensively, concentration DCs, touch attacks, AoOs, combat maneuvers, grapple, cover, two-weapon fighting, dying, and more. There's also a concentration-check odds calculator and a carrying-capacity calculator.

## Rebuilding

```bash
python tools/build_data.py
```

```bash
powershell -ExecutionPolicy Bypass -File build_exe.ps1
```

`build_data.py` regenerates `data/pf1e.db` and `data/classes.json` from `tools/sources/`. `build_exe.ps1` rebuilds the .exe into `dist/`.

## Testing

```bash
npm test
```

This runs the rules-math and importer tests (Node.js) and the server tests (Python). `npm run check` syntax-checks all of the UI code. Developer notes are in `CLAUDE.md`.

## Project layout

| Path | What it is |
| --- | --- |
| `app.py` | Local server (127.0.0.1 only) and the pywebview desktop window |
| `web/` | The UI: plain HTML/CSS/JS modules, no build step |
| `web/js/calc.js` | All character math (stacking rules, AC, saves, skills, spells) |
| `web/js/rulesdata.js` | Quick-rules cards |
| `tools/build_data.py` | Converts the source data into the compendium database |
| `tools/sources/` | Raw OGL data (PSRD-Data SQLite files and the spell spreadsheet) |

## Data sources and license

Game rules text is Open Game Content under the Open Game License v1.0a (the full license is in the app's sidebar footer). Sources:
[PSRD-Data](https://github.com/devonjones/PSRD-Data) and the community spell spreadsheet via [pathfinder_spells](https://github.com/sturlabragason/pathfinder_spells).
This app is not published, endorsed, or approved by Paizo Inc.

Known gaps: PSRD-Data stops around 2015 (Advanced Class Guide). Later books (Occult Adventures, Ultimate Intrigue, and so on) are covered only for spells, through the spreadsheet. Prestige classes are tracked in notes for now. Unchained summoner eidolons aren't in the data.

## Sound credits

The page-turn sounds in `web/sounds/` are free sound effects from Pixabay / freesound_community (page-turn-1: "page-turn" 305789; page-turn-2 and -3: "book-turn-page" 1 and 2). Check their license terms before redistributing the app.

The level-up and heal sounds (`level-up.ogg`, `heal.ogg`) are short game sound effects supplied by the author; they come from video games, so check their terms before sharing the app publicly.
