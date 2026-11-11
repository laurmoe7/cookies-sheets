# The server and the desktop window

`app.py` is a stdlib `ThreadingHTTPServer` on 127.0.0.1 that serves `web/` and a small JSON API, shown in a pywebview (WebView2) window.

## Start modes

`start_mode()` picks how to start:

- `--browser` serves only (development).
- `--web` opens the default browser with a tray icon (`tray.py`, plain ctypes) and quits a few seconds after the last page closes. The page pings `/api/ping` and sends `/api/bye` as it closes; `Presence` decides.
- `--window` forces the desktop window.
- Without a flag, `openIn` in `settings.json` (Options, Look) decides.

`updater.py` is the self-update (the built .exe only; from source, update with git). `windowstate.py` remembers the window's position and size, kept inside the screen's usable area.

## Requests from other pages

`Handler._allowed` refuses requests from other web pages (wrong `Host`, foreign `Origin`, or `Sec-Fetch-Site` cross-site/same-site), since any page open in a browser can otherwise call 127.0.0.1. Our own page, the address bar, tests and curl pass. Anything that serves the UI on another name or port must be added to `srv.hosts` in `start_server`.

## Caching

Static files are sent with `Cache-Control: no-cache` (the stdlib handler answers `If-Modified-Since` with 304); API answers with `no-store`.

**Another program's page in our window.** If the window shows some other project, something else served 127.0.0.1:8765 at some point. Two guards: on Windows the server refuses a port another program holds (`Server.allow_reuse_address`) and moves on, and the window opens `/?launch=<time>` so the browser cache cannot hand back a page cached from that port (a dev server with no cache headers is cached for days). If it still happens, delete `%LOCALAPPDATA%\Cookie's Sheets\webview\EBWebView\Default\Cache` with the app closed; Local Storage next to it holds the options and is safe to keep.

**Window storage:** the desktop window keeps localStorage in `%LOCALAPPDATA%\Cookie's Sheets\webview` (`private_mode=False`). Without that, the theme and last-open character are forgotten on every launch.

## The compendium database

Read-only SQLite (`data/pf1e.db`, an FTS5 table `entries_fts` over `entries`). The index is contentless (`content=''`), so it holds no copy of the text: always join `entries` by rowid for values, and don't use `snippet()` or `highlight()`. Search ranking order is `CAT_ORDER`.

`tools/build_data.py` writes `data/pf1e.db.new` when the database is in use, and the app installs it on next start (`install_new_db`). Delete a stale `.new` if you rebuild again after closing the app. `PF_DB` points the server at a different database file.

## Character storage

Characters are plain JSON files in `Documents\Pathfinder Characters` (see the Save folder bullet in [ui-conventions.md](ui-conventions.md) for `PF_CHAR_DIR` and choosing another folder).

- **Saving** writes a temp file and renames it, and copies the file it replaces into `.history/<id>-<unix time>.json` (at most one copy per 5 minutes, newest 5 kept; `/api/history`, `character/revert`; the Characters page lists them under "Earlier saves").
- **Delete** moves the file to `.deleted/` as `<id>-<unix time>.json`. The Characters page lists that folder (`/api/deleted`) with Restore (`character/restore`, which gives the copy a new id if its old id is taken again) and Delete for good (`character/purge`).
- **The graveyard** is not a folder: a character who died or retired keeps its file and has `retired: {status, date, note}`, which `list_characters` passes on so the page shows it apart.

## charactersheet.co.uk

The importer fetches `https://charactersheet.co.uk/api/v1/characters/<24-hex id>`, which is public and needs no login. The response includes the owner's account (`user`: name, email, token), which `app.fetch_charactersheet` strips. Never store or log it.

## Task Manager name and icon

Windows reads them from the .exe file, not the window. The built exe gets its name and version from `tools/brand.py version-file` (used by `build_exe.ps1`). Running from source, the shortcut and `Run Cookie's Sheets.bat` use `.launcher\Cookie's Sheets.exe`, a real copy of `pythonw.exe` with the app's icon and name plus its DLLs and a `pyvenv.cfg` (`python tools/brand.py launcher`; git-ignored; rerun after a Python upgrade). A venv's python.exe is only a redirector that starts the real one, which would still show as "Python".

Never hand pywebview an object that can reach the window (`js_api`): it walks it forever and freezes the app.
