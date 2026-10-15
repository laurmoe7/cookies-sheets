# Cookie's Sheets

Windows desktop app for Pathfinder 1st Edition characters: live character sheet, level-up wizard, OGL compendium, quick rules, and an importer for charactersheet.co.uk. See README.md for the user-facing feature list.

## Architecture

- **`app.py`**: stdlib `ThreadingHTTPServer` on 127.0.0.1 that serves `web/` and a small JSON API, shown in a pywebview (WebView2) window. `--browser` serves only.
  - `Handler._allowed` refuses requests from other web pages (wrong `Host`, foreign `Origin`, or `Sec-Fetch-Site` cross-site/same-site), since any page open in a browser can otherwise call 127.0.0.1. Our own page, the address bar, tests and curl pass. Anything that serves the UI on another name or port must be added to `srv.hosts` in `start_server`.
  - The compendium is read-only SQLite (`data/pf1e.db`, an FTS5 table `entries_fts` over `entries`). The index is contentless (`content=''`), so it holds no copy of the text: always join `entries` by rowid for values, and don't use `snippet()` or `highlight()`.
  - Characters are plain JSON files in `Documents\Pathfinder Characters`. Saving writes a temp file and renames it, and copies the file it replaces into `.history/<id>-<unix time>.json` (at most one copy per 5 minutes, newest 5 kept; `/api/history`, `character/revert`; the Characters page lists them under "Earlier saves"). Delete moves them to `.deleted/` as `<id>-<unix time>.json`; the Characters page lists that folder (`/api/deleted`) with Restore (`character/restore`, which gives the copy a new id if its old id is taken again) and Delete for good (`character/purge`).
  - Static files are sent with `Cache-Control: no-cache` (the stdlib handler answers `If-Modified-Since` with 304), API answers with `no-store`.
- **`web/`**: vanilla ES modules, no build step, no framework. Edit and reload.
  - `js/calc.js`: **all rules math**. `compute(char, classesByName)` returns every derived number. Views never do rules math themselves.
  - `js/data.js`: rules tables (races, skills, sizes, bonus types, buff presets, XP tracks). `js/rulesdata.js` holds the Quick Rules cards.
  - `js/model.js`: `newCharacter()` (the save format) and `migrate()`, which fills fields that old saves lack.
  - `js/app.js`: state, routing (`go(view)`), saving, and the two-way binding.
  - `js/views/*.js`: one module per page. `sheet.js` is the character sheet tabs; `levelup.js` is the wizard; `csimport.js` is the import dialog.
  - `js/importcs.js`: charactersheet.co.uk to our model (pure functions, no DOM).
  - `js/features.js`: class features with **archetypes applied**. An archetype chosen for a class is stored on the character (`c.archetypes[cls] = [bakeArchetype(...)]`), so saves don't depend on the database. Its class-skill changes and diminished spellcasting apply in `calc.js`.
  - `js/weaponfx.js`: weapon enchantments and special materials (pure, tested). A weapon stores `mw`, `material`, `improvedCritical` and `fx: [{id, on}]`; `compute()` folds them into `d.weapons[i]` (`damageText` with the extra dice, `crit`, `critText`). `views/weaponfx.js` is the ✦ Enchant window.
  - `js/armorfx.js`: the same for armor and shields (pure, tested): `mw`, `material`, `fx: [{id}]` on each `c.armor` item; `compute()` applies them to the check penalty, Dex cap, spell failure, weight, speed and Stealth/Escape Artist, and returns `d.armorFx` (DR, SR, resistances, fortification). `views/armorfx.js` is its window.
  - `js/paperdoll.js`: the Inventory tab's paper doll (pure, tested): `SLOTS`/`LAYOUT`, `wornBySlot`, `candidates`, `wear`, `takeOff`. An item is worn in a slot when it has `slot` (armor and shields use their Worn tick and default to the Armor/Shield slot); gear from the compendium also keeps `hint`, the slot family its `sub` names. `views/paperdoll.js` draws the card and the slot window.
  - `js/itemfx.js`: bonuses on inventory items (pure, tested): `g.effects` has the same shape as a buff's effects and `compute()` adds them while the item has a slot (is worn). `suggestEffects(name)` knows the standard items (cloak of resistance, ring of protection, amulet of natural armor, bracers of armor, ability belts, headbands...); the item panel in `views/sheet.js` (`renderItemActions`) edits them with `editModifier`.
  - `js/magicgear.js`: the Weapons and Armor tables' "＋ Magic item" (pure, tested): `parseMagicWeapon` / `parseMagicArmor` read the base item, +N, abilities and material from a compendium entry's text against small `WEAPONS` / `ARMORS` tables (Medium size). `app.magic_gear(kind, q)` (`/api/magic-gear`) lists the candidates: the compendium tags armor and shields (`sub`) but not weapons, so weapons are the slotless items whose text names a +N weapon.
  - `js/rest.js`: the Rest button's rules (HP per level, ability damage, pools, slots).
  - `js/spellrules.js`: how many spells a class learns per level (spells-known table, spellbook classes, or none).
  - `js/companions.js`: animal companion and eidolon stat blocks from `data/companions.json`. The UI is `views/companions.js` (the sheet's Companions tab).
  - `views/archetypes.js` is the archetype chooser; `views/spellpicker.js` is the multi-pick spell chooser that stays open until the allowance is used.
- **`tools/build_data.py`**: builds `data/pf1e.db` and `data/classes.json` from `tools/sources/`.

### UI conventions

The full list is in **[dev-docs/ui-conventions.md](dev-docs/ui-conventions.md)**: read the bullet for the area you touch (bindings, themes, Cookie the mascot, sounds, rolls, spells tab, notes tab, options, pictures, companions, sharing...). The rules that apply to almost every change:

- **Bindings:** `<input data-bind="path.in.char">` is two-way; add `data-type="num"` for numbers and `data-rerender` to redraw. In `sheet.js` use `inp()`, `chk()`, `sel()`. Computed values are `data-calc="path"` filled from `compute()`.
- **Saving:** after mutating `state.char`, call `changed()` (or `changed({ rerender: true })` if the layout changes).
- **Rules math lives only in `calc.js`**; bonuses go through `stack()` with a bonus type; a new rolled number also gets its parts in `d.bd`.
- **Save-format changes:** give the field a default in `newCharacter()`; reshaping or renaming needs explicit code in `migrate()` and a bump of `MODEL_VERSION`. Never break old saves.
- **Escaping:** `esc()` for anything user- or data-supplied that goes into HTML.
- **Text selection is off app-wide**; anything copyable opts in with `user-select: text`.
- **Dev-only tools** live in `web/dev/` and never ship.
- **Changelog and version:** `web/js/changelog.js` has one entry per version number, newest first; add a line to the top entry (marked `next: true` until it ships, then give it a date and start a new one). Raise `web/js/version.js` per shared build.

## Commands

All of these run from the project root:

| Task | Command |
| --- | --- |
| Run from source (desktop window) | `python app.py` or the **Run Cookie's Sheets** shortcut |
| Run in a browser for dev/testing | `python app.py --browser` then open http://127.0.0.1:8765 |
| **All tests** | `npm test` (JS rules/importer tests + Python server tests) |
| JS tests only / Python only | `npm run test:js` / `npm run test:py` |
| Syntax-check all JS | `npm run check` |
| Rebuild compendium data | `python tools/build_data.py` |
| Build the .exe | `powershell -ExecutionPolicy Bypass -File build_exe.ps1` (output in `dist\Cookie's Sheets\`) |
| Regenerate icon / shortcut | `python tools/make_icon.py` / `powershell -ExecutionPolicy Bypass -File tools\make_shortcut.ps1` |

Node.js is installed at `C:\Program Files\nodejs`. A shell started before it was installed may need `$env:Path = "C:\Program Files\nodejs;$env:Path"`.

## Testing

- **Run `npm test` before calling a change done.** Add a test with any rules change.
  - `tests/calc.test.mjs`: rules math. Expected values are **worked out by hand from the rules**, with the arithmetic in the assertion message. Never copy them from the current output.
  - `tests/importcs.test.mjs`: the importer. It uses `tests/fixtures/cs_fumu.json`, a real charactersheet.co.uk export with the account details stripped.
  - `tests/test_server.py`: storage, search, lookups and HTTP routes. It writes characters to a temp folder and needs no network.
  - `tests/helpers.mjs`: `make({ race, raceChoice, base, levels, hp, ...fields })` builds a character, `calc(c)` computes it, and `buff(c, 'Haste')` applies a preset.
- **Manual/UI testing:** never write to the user's real `Documents\Pathfinder Characters`. Point the server elsewhere, then use a browser on that port:
  - `PF_CHAR_DIR=<scratch folder> PF_PORT=8790 python app.py --browser`
  - Per-page `localStorage` holds `lastChar` and `theme`, and it is per port.

## Gotchas

- **Rebuilding while the app runs:** `tools/build_data.py` writes `data/pf1e.db.new` when the database is in use, and the app installs it on next start (`install_new_db`). Delete a stale `.new` if you rebuild again after closing the app. `PF_DB` points the server at a different database file.
- **Escaping in shell edit scripts:** don't write JS containing `\b` or `\n` through Python heredoc scripts; they turn into backspace characters and real newlines. Use the Edit tool for those. `grep -c $'\x08' file` finds stray backspaces.
- **Another program's page in our window.** If the window shows some other project, something else served 127.0.0.1:8765 at some point. Two guards: on Windows the server refuses a port another program holds (`Server.allow_reuse_address`) and moves on, and the window opens `/?launch=<time>` so the browser cache cannot hand back a page cached from that port (a dev server with no cache headers is cached for days). If it still happens, delete `%LOCALAPPDATA%\Cookie's Sheets\webview\EBWebView\Default\Cache` with the app closed; Local Storage next to it holds the options and is safe to keep.
- **Use `127.0.0.1`, not `localhost`.** On this machine `localhost` resolves to IPv6 first, and every request is about 300 ms slower.
- **The .exe bundles a copy of `web/` and `data/`.** Source edits don't reach `dist/` until you rebuild. Day to day, run from source.
- **Never rebuild the .exe or refresh the zip (`python tools/make_zip.py`) unless the user asks.** Finish changes in source and commit only.
- **Desktop window storage:** it keeps localStorage in `%LOCALAPPDATA%\Cookie's Sheets\webview` (`private_mode=False`). Without that, the theme and last-open character are forgotten on every launch.
- **Stale async responses:** pickers and search guard against them with a sequence counter (`seq`). Copy that pattern for any new async search UI.
- **Class progression comes from parsed PSRD tables in `data/classes.json`.**
  - BAB and saves are read by column position, not header name (Swashbuckler's headers differ).
  - Casting metadata (stat, prepared/spontaneous, `cl_offset`, domain slot) is hand-written in `CLASSES` in `build_data.py`.
- **Prestige classes are not supported** by the level-up wizard or `compute()`.
- **charactersheet.co.uk:** the importer fetches `https://charactersheet.co.uk/api/v1/characters/<24-hex id>`, which is public and needs no login. The response includes the owner's account (`user`: name, email, token), which `app.fetch_charactersheet` strips. Never store or log it.

## Data pipeline

- **Sources:** `tools/sources/` is git-ignored (about 65 MB). It holds:
  - `psrd/*.db`: 19 book databases from https://github.com/devonjones/PSRD-Data, covering the Core Rulebook through the Advanced Class Guide (2015).
  - `spells.tsv`: the community spell spreadsheet from https://github.com/sturlabragason/pathfinder_spells. It adds about 700 later-book spells.
- **Output:** `data/pf1e.db` is generated and git-ignored. `data/classes.json` is generated but committed, because the tests use it; diff it after parser changes.
- **Archetypes:** `tools/archetypes.py` parses each archetype into features (level, replaces/modifies targets, advice lists), class-skill changes and diminished spellcasting. The result is stored as JSON in `entries.meta` and served by `/api/archetypes?cls=`. The app matches about 82% of "replaces X" targets against the class table; the rest (proficiencies, deeds, bonus spells) are not table features and are shown as text.
- **Companions:** `tools/companions.py` writes `data/companions.json` (committed): both progression tables, 68 animal species with advancement, eidolon base forms and evolutions, and 26 familiar kinds (stat blocks from the `Familiar, X` creatures plus the master-bonus tables, and the wizard familiar progression). Familiar stats borrow the master's BAB, base saves, HP and skill ranks (`computeCompanion(..., master)`). Familiar variants: `familiar.improved` holds the 25 Improved Familiar kinds (the `IMPROVED` list in `companions.py`: Core list plus the Ultimate Magic update, each with the alignment and arcane caster level it needs, built from the Bestiary stat blocks), and `familiar.templates` the celestial/entropic/fiendish/resolute archetypes (defenses by Hit Dice, which for a familiar is master level). `comp.template` picks the archetype (ignored on improved kinds); `computeFamiliar` adds darkvision, smite, resistances, DR and SR (CR + 5, or master level + 5 at 11th, whichever is higher) and returns `requirements` (feat, alignment within one step, master level) that the card shows as ticks. Not modelled: the Evolved Familiar feat and other familiar-changing feats; mephit and the other "any type" kinds use the base stat block, not each type's breath weapon.
- **Racial favored class options:** `tools/fcb.py` writes `data/fcb.json` (committed), `{race: {class: [{text, source}]}}`, from the race sections of the APG, ARG and ACG. The level-up wizard offers them when the class is the favored class (`fcb: 'racial'`, text in `fcbNote`); they have no automatic effect on the numbers.
- **Creatures:** `tools/creatures.py` writes `data/creatures.json` (committed, about 3 MB, minified): every creature stat block in the PSRD books that has hit points, once per name and book, with its special ability write-ups. `build_data.py` writes it with the other data files; `app.py` keeps it in memory (`creature_list`, `search_creatures`, `get_creature`). A companion taken from it is a `creature` companion that stores the whole stat block (`js/creaturecomp.js`).
- **Summons:** `tools/summons.py` writes `data/summons.json` (committed): the Core Rulebook Summon Monster / Summon Nature's Ally lists by level, with each creature's Bestiary stat block (the Core Rulebook lists only). `js/summons.js` is the pure part; `views/summons.js` has the chooser modal and the Summons section at the top of the Companions tab. Tracked summons live in `c.summons` and copy their key stats at creation. Modals sit above the side panel, so stat blocks inside the chooser are shown in its own preview pane. Note the side panel treats every `<a>` as a compendium lookup.
- **Categories:** `build_data.py` maps PSRD section types to app categories in `TYPE_CATEGORY`. "Rules" entries come from `RULE_BOOKS`. Search ranking order is `CAT_ORDER` in `app.py`.

## Repo

- Git repo on `main`; remote `origin` is the public repo https://github.com/laurmoe7/cookies-sheets. Commits use the GitHub noreply email (the real one is blocked on push). Commit in small steps with messages that say why.
- Git-ignored: `dist/`, `build/`, `*.spec`, `data/pf1e.db`, `tools/sources/` and `*.lnk`.
