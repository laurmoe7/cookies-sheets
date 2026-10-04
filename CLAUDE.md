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

- **Stop any running app/server before `tools/build_data.py`.** The server holds `data/pf1e.db` open, and the rebuild fails with WinError 32 (file in use).
- **Use `127.0.0.1`, not `localhost`.** On this machine `localhost` resolves to IPv6 first, and every request is about 300 ms slower.
- **The .exe bundles a copy of `web/` and `data/`.** Source edits don't reach `dist/` until you rebuild. Day to day, run from source.
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
- **Categories:** `build_data.py` maps PSRD section types to app categories in `TYPE_CATEGORY`. "Rules" entries come from `RULE_BOOKS`. Search ranking order is `CAT_ORDER` in `app.py`.

## Repo

- Git repo on `main`, no remote. Commit in small steps with messages that say why.
- Git-ignored: `dist/`, `build/`, `*.spec`, `data/pf1e.db`, `tools/sources/` and `*.lnk`.
