# Pathfinder Sheet

Windows desktop app for Pathfinder 1st Edition characters: live character sheet, level-up wizard, OGL compendium, quick rules, and an importer for charactersheet.co.uk. See README.md for the user-facing feature list.

## Architecture

- **`app.py`**: stdlib `ThreadingHTTPServer` on 127.0.0.1 that serves `web/` and a small JSON API, shown in a pywebview (WebView2) window. `--browser` serves only.
  - The compendium is read-only SQLite (`data/pf1e.db`, an FTS5 table `entries_fts` over `entries`).
  - Characters are plain JSON files in `Documents\Pathfinder Characters`. Delete moves them to `.deleted/`.
- **`web/`**: vanilla ES modules, no build step, no framework. Edit and reload.
  - `js/calc.js`: **all rules math**. `compute(char, classesByName)` returns every derived number. Views never do rules math themselves.
  - `js/data.js`: rules tables (races, skills, sizes, bonus types, buff presets, XP tracks). `js/rulesdata.js` holds the Quick Rules cards.
  - `js/model.js`: `newCharacter()` (the save format) and `migrate()`, which fills fields that old saves lack.
  - `js/app.js`: state, routing (`go(view)`), saving, and the two-way binding.
  - `js/views/*.js`: one module per page. `sheet.js` is the character sheet tabs; `levelup.js` is the wizard; `csimport.js` is the import dialog.
  - `js/importcs.js`: charactersheet.co.uk to our model (pure functions, no DOM).
  - `js/features.js`: class features with **archetypes applied**. An archetype chosen for a class is stored on the character (`c.archetypes[cls] = [bakeArchetype(...)]`), so saves don't depend on the database. Its class-skill changes and diminished spellcasting apply in `calc.js`.
  - `js/spellrules.js`: how many spells a class learns per level (spells-known table, spellbook classes, or none).
  - `js/companions.js`: animal companion and eidolon stat blocks from `data/companions.json`. The UI is `views/companions.js` (the sheet's Companions tab).
  - `views/archetypes.js` is the archetype chooser; `views/spellpicker.js` is the multi-pick spell chooser that stays open until the allowance is used.
- **`tools/build_data.py`**: builds `data/pf1e.db` and `data/classes.json` from `tools/sources/`.

### UI conventions (follow these when adding fields)

- **Bindings:** `<input data-bind="path.in.char">` binds two-way through a global listener in `app.js`.
  - Add `data-type="num"` for numbers and `data-rerender` to redraw the page on change.
  - In `sheet.js`, use the helpers `inp(path, opts)`, `chk(path)` and `sel(path, options)`.
- **Computed values:** `<span data-calc="path.in.derived" data-fmt="sign|plain|slots">` is filled from `compute()` after every change. Use `calc(key, fmt)` in `sheet.js`.
- **Rules links:** `data-entry="Name"` (optional `data-cat`, `data-entry-id`) makes any element open that compendium entry in the side drawer. Use `ref()` / `refId()`.
- **Saving:** after mutating `state.char` in code, call `changed()`, or `changed({ rerender: true })` if the layout changes. Saving is debounced and automatic.
- **Bonuses:** go through `stack()` with a bonus type so the stacking rules apply. Buffs and conditions are `{target, value, type, scale?}` effects. `value` may be a formula using `bab`, `lvl`, `floor`, `ceil`, `min` or `max`. Valid targets are in `MOD_TARGETS`.
- **Save-format changes:** adding a field means giving it a default in `newCharacter()`; `migrate()` back-fills old saves automatically. Renaming or reshaping a field needs explicit code in `migrate()`. Never break old save files.
- **Escaping:** use `esc()` for anything user- or data-supplied that goes into HTML.
- **Text fields:** names and notes use `textField()` (`tf()` in `sheet.js`), which shows readable text. Double-click edits it; single click opens the full text in the drawer when `read` is set. Numeric fields stay as normal inputs. Use `showCustom({name, cat, html})` to put non-compendium content in the drawer.
- **Tooltips:** `title="..."` attributes are shown by our own styled tooltip (`initTooltips` in `ui.js`), which moves the text into `data-tip`. Use `title` as usual; no extra work.
- **Sheet search:** `searchindex.js` (pure, tested) indexes the open character; `sheetsearch.js` is the top-bar UI. A new character field worth finding goes into `buildIndex`.
- **Text selection:** the desktop window (pywebview) disables text selection app-wide. Anything the user may want to copy (stat blocks, entry text) must opt in with `user-select: text` in `app.css`.
- **Class resources:** `resources.js` (pure, tested) lists the pools a character's classes give (arcane reservoir, rage rounds, ki, grit...). Current points live in `c.resources[id]` (absent = start of day); `c.trackers` are the player's own counters. `views/resources.js` draws them on Overview, and the arcanist's reservoir also appears in its spell card. To add a pool, add a line to `classResources`.
- **Level-up warnings:** `levelcheck.js` (pure, tested) lists what is left undone when a level is applied; `warnBox()` in `ui.js` shows it with "Go back and fix" / "Apply anyway".
- **Down vs. dead:** the Overview HP card and summon cards use an amber frame when down (0 or below) and a red, greyed frame once HP reaches minus the Con score. Summons store `con`.
- **Pictures:** `cropper.js` is the picture chooser with a drag-to-recenter and zoom window (`imagecrop.js` holds the tested crop maths). `picFrame()`/`picAction()` give companions (large, 4:3) and summons (small square) an `image`; the uncropped original is kept in `imageSrc` (`portraitSrc`/`avatarSrc` on the character) so it can be repositioned later.
- **Companion eligibility:** `companionSources()` in `companions.js` works out familiar and animal-companion levels from classes plus chosen abilities, feats and archetypes (arcanist Familiar exploit, shaman, Animal domain, Animal Ally, Boon Companion, paladin mount...). Add new grants there.
- **Options:** `options.js` keeps app options (theme, accent, text size, compact layout, tooltips, animations, startup behaviour) in `localStorage.options`; `sanitize()` is pure and tested, `applyOptions()` sets CSS variables and `data-*` flags on `<html>`. The sidebar's Options button opens the window. Add a new option to `DEFAULTS`, `sanitize` and `showOptions`.
- **Themes:** the default is the dark palette in `:root` of `app.css`; there is no light mode. Extra themes are `html[data-theme="<name>"]` blocks in their own `css/theme-<name>.css` (Dusty tome is `theme-tome.css`), listed in `THEMES` in `options.js`. A theme overrides the same CSS variables and may restyle components; textures are inline SVG data URIs (`feTurbulence`). `theme-tome.css` is generated: edit `tools/make_tome_css.py` and run it. Cards cycle through four paper variants (`:nth-of-type`), each lighter in the middle and darker toward the edges. Keep it cheap to paint: no `background-blend-mode`, no `background-attachment: fixed`, no big filters at runtime (textures are rasterised once from the data URIs). The tab page turn (`playPageTurn` in `options.js`) is the old page cloned (only the part on screen) into 14 overlapping hinged strips that bend, animated in CSS; going back a tab plays it in reverse with the new page as the moving sheet.
- **Name icon:** the square beside the character name in the top bar is the button for adding, changing, recentering and removing it.
- **Changelog:** add an entry at the top of `web/js/changelog.js` when a batch of changes ships; it feeds the sidebar's "What's new" window.
- **Stat-block links:** `termlinks.js` (pure, tested) turns ability names in stat-block text into compendium links. Add new names to its lists.
- **Archetype targets:** `findTargets()` in `features.js` falls back to class-specific `ALIASES`, and `EXTRA_FEATURES` adds features the class table omits (weapon and armor proficiency, spellbook, patron spells). About 3% of targets still show as plain text (swashbuckler and gunslinger deed names, paladin auras).
- **Sheet tab bar:** `render()` keeps the sheet's tab bar in the page and only replaces `#tab-body` (tracked by `main.dataset.view`), so tabs never flicker. Don't add transitions or size changes to `.tab`.
- **Re-drawing:** `changed({ rerender: true })` keeps the scroll position.

## Commands

All of these run from the project root:

| Task | Command |
| --- | --- |
| Run from source (desktop window) | `python app.py` or the **Run Pathfinder Sheet** shortcut |
| Run in a browser for dev/testing | `python app.py --browser` then open http://127.0.0.1:8765 |
| **All tests** | `npm test` (JS rules/importer tests + Python server tests) |
| JS tests only / Python only | `npm run test:js` / `npm run test:py` |
| Syntax-check all JS | `npm run check` |
| Rebuild compendium data | `python tools/build_data.py` |
| Build the .exe | `powershell -ExecutionPolicy Bypass -File build_exe.ps1` (output in `dist\Pathfinder Sheet\`) |
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
- **Use `127.0.0.1`, not `localhost`.** On this machine `localhost` resolves to IPv6 first, and every request is about 300 ms slower.
- **The .exe bundles a copy of `web/` and `data/`.** Source edits don't reach `dist/` until you rebuild. Day to day, run from source.
- **Never rebuild the .exe or refresh the zip unless the user asks.** Finish changes in source and commit only.
- **Desktop window storage:** it keeps localStorage in `%LOCALAPPDATA%\Pathfinder Sheet\webview` (`private_mode=False`). Without that, the theme and last-open character are forgotten on every launch.
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
- **Companions:** `tools/companions.py` writes `data/companions.json` (committed): both progression tables, 68 animal species with advancement, eidolon base forms and evolutions, and 26 familiar kinds (stat blocks from the `Familiar, X` creatures plus the master-bonus tables, and the wizard familiar progression). Familiar stats borrow the master's BAB, base saves, HP and skill ranks (`computeCompanion(..., master)`). Familiar variants (Improved Familiar, archetypes) are not modelled.
- **Racial favored class options:** `tools/fcb.py` writes `data/fcb.json` (committed), `{race: {class: [{text, source}]}}`, from the race sections of the APG, ARG and ACG. The level-up wizard offers them when the class is the favored class (`fcb: 'racial'`, text in `fcbNote`); they have no automatic effect on the numbers.
- **Summons:** `tools/summons.py` writes `data/summons.json` (committed): the Core Rulebook Summon Monster / Summon Nature's Ally lists by level, with each creature's Bestiary stat block (the Core Rulebook lists only). `js/summons.js` is the pure part; `views/summons.js` has the chooser modal and the Summons section of the Buffs & Conditions tab. Tracked summons live in `c.summons` and copy their key stats at creation. Modals sit above the side panel, so stat blocks inside the chooser are shown in its own preview pane. Note the side panel treats every `<a>` as a compendium lookup.
- **Categories:** `build_data.py` maps PSRD section types to app categories in `TYPE_CATEGORY`. "Rules" entries come from `RULE_BOOKS`. Search ranking order is `CAT_ORDER` in `app.py`.

## Repo

- Git repo on `main`; remote `origin` is the private repo https://github.com/laurmoe7/pathfinder-sheet. Commits use the GitHub noreply email (the real one is blocked on push). A local `backup-before-email-rewrite` branch holds the pre-rewrite history. Commit in small steps with messages that say why.
- Git-ignored: `dist/`, `build/`, `*.spec`, `data/pf1e.db`, `tools/sources/` and `*.lnk`.
