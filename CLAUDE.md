# Cookie's Sheets

Windows desktop app for Pathfinder 1st Edition characters: live character sheet, level-up wizard, OGL compendium, quick rules, and importers for charactersheet.co.uk and a Google Sheets template. See README.md for the user-facing feature list.

## Architecture

- **`app.py`**: stdlib HTTP server on 127.0.0.1 that serves `web/` and a small JSON API, shown in a pywebview (WebView2) window. `--browser` serves only. Characters are plain JSON files in `Documents\Pathfinder Characters`; the compendium is read-only SQLite (`data/pf1e.db`).
- **`web/`**: vanilla ES modules, no build step, no framework. Edit and reload.
  - `js/calc.js`: **all rules math**. `compute(char, classesByName)` returns every derived number.
  - `js/model.js`: `newCharacter()` (the save format) and `migrate()`.
  - `js/app.js`: state, routing (`go(view)`), saving, two-way binding.
  - `js/views/*.js`: one module per page (`sheet.js` is the character sheet tabs, `levelup.js` the wizard).
  - Most other modules are pure, tested rules helpers with a header comment saying what they do.
- **`tools/build_data.py`**: builds `data/pf1e.db` and the JSON files in `data/` from `tools/sources/` (git-ignored).

## Where to read more

Read the doc for the area you touch before changing it:

| Doc | Covers |
| --- | --- |
| [dev-docs/ui-conventions.md](dev-docs/ui-conventions.md) | Per-area UI rules: bindings, side panel, layouts, rolls, spells tab, resources and notes, level up and import, companions, options, save folder, dev tools |
| [dev-docs/look-and-sound.md](dev-docs/look-and-sound.md) | Themes and keeping them cheap to paint, the page turn, Cookie the mascot, sound effects, the heal animation |
| [dev-docs/web-modules.md](dev-docs/web-modules.md) | What each `web/js` module does and the save fields it owns (enchantments, paper doll, item bonuses, magic gear, archetypes...) |
| [dev-docs/server.md](dev-docs/server.md) | `app.py`: start modes, request guard, caching, the FTS index, character storage (history, deleted, graveyard), the importer fetch, the launcher exe |
| [dev-docs/data-pipeline.md](dev-docs/data-pipeline.md) | Source data, class tables and prestige classes, archetypes, companions, granted spells, equipment, creatures, summons |

## Rules for every change

- **Rules math lives only in `calc.js`**; views never do it. Bonuses go through `stack()` with a bonus type; a new rolled number also gets its parts in `d.bd`.
- **Bindings:** `<input data-bind="path.in.char">` is two-way; add `data-type="num"` for numbers and `data-rerender` to redraw. In `sheet.js` use `inp()`, `chk()`, `sel()`. Computed values are `data-calc="path"`.
- **Saving:** after mutating `state.char`, call `changed()` (or `changed({ rerender: true })` if the layout changes).
- **Save-format changes:** give the field a default in `newCharacter()`; reshaping or renaming needs explicit code in `migrate()` and a bump of `MODEL_VERSION`. Never break old saves.
- **Escaping:** `esc()` for anything user- or data-supplied that goes into HTML.
- **Text selection is off app-wide**; anything copyable opts in with `user-select: text`.
- **Async search UI** guards against stale responses with a sequence counter (`seq`); copy that pattern.
- **Dev-only tools** live in `web/dev/` and never ship.
- **Changelog:** add a line to the top entry of `web/js/changelog.js` (marked `next: true` until it ships). Start it with its area (`'Spells: ...'`) and put it next to the other lines of that area. Raise `web/js/version.js` per shared build.
- **Never rebuild the .exe or refresh the zip (`python tools/make_zip.py`) unless the user asks.** Finish changes in source and commit. The .exe bundles its own copy of `web/` and `data/`, so source edits don't reach `dist/` anyway.

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
| Regenerate icon / shortcut | `python tools/make_icon.py` / `python tools/brand.py launcher` then `powershell -ExecutionPolicy Bypass -File tools\make_shortcut.ps1` |

Node.js is installed at `C:\Program Files\nodejs`. A shell started before it was installed may need `$env:Path = "C:\Program Files\nodejs;$env:Path"`.

## Testing

- **Run `npm test` before calling a change done.** Add a test with any rules change.
- `tests/calc.test.mjs`: rules math. Expected values are **worked out by hand from the rules**, with the arithmetic in the assertion message. Never copy them from the current output.
- `tests/helpers.mjs`: `make({ race, raceChoice, base, levels, hp, ...fields })` builds a character, `calc(c)` computes it, and `buff(c, 'Haste')` applies a preset.
- `tests/test_server.py`: storage, search, lookups and HTTP routes, in a temp folder with no network.
- **Manual/UI testing:** never write to the user's real `Documents\Pathfinder Characters`. Run `PF_CHAR_DIR=<scratch folder> PF_PORT=8790 python app.py --browser` and use a browser on that port. `localStorage` (`lastChar`, `theme`, options) is per port.

## Gotchas

- **Use `127.0.0.1`, not `localhost`.** On this machine `localhost` resolves to IPv6 first, and every request is about 300 ms slower.
- **Escaping in shell edit scripts:** don't write JS containing `\b` or `\n` through Python heredoc scripts; they turn into backspace characters and real newlines. Use the Edit tool. `grep -c $'\x08' file` finds stray backspaces.
- **The FTS index is contentless:** always join `entries` by rowid for values; `snippet()` and `highlight()` don't work.
- **New host or port serving the UI:** add it to `srv.hosts` in `start_server`, or `Handler._allowed` refuses its requests.
- **Never hand pywebview an object that can reach the window (`js_api`):** it walks it forever and freezes the app.
- **charactersheet.co.uk responses include the owner's account** (`user`: name, email, token). `app.fetch_charactersheet` strips it; never store or log it.
- **`data/classes.json` and the other JSON in `data/` are generated but committed** (the tests use them); diff them after parser changes.
- **Rebuilding data while the app runs** writes `data/pf1e.db.new`, installed on next start. Delete a stale `.new` if you rebuild again after closing the app.
- **The window shows another program's page:** see [dev-docs/server.md](dev-docs/server.md#caching).

## Repo

- Git repo on `main`; remote `origin` is the public repo https://github.com/laurmoe7/cookies-sheets. Commits use the GitHub noreply email (the real one is blocked on push). Commit in small steps with messages that say why.
- Git-ignored: `dist/`, `build/`, `*.spec`, `data/pf1e.db`, `tools/sources/` and `*.lnk`.
