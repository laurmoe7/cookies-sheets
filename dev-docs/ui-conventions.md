# UI conventions

Read the section for the area you touch. The rules for every change (bindings, saving, save format, escaping, changelog) are in [CLAUDE.md](../CLAUDE.md); this file adds the detail. Also see:

- [look-and-sound.md](look-and-sound.md): themes and paint cost, the page turn, Cookie the mascot, sound effects.
- [web-modules.md](web-modules.md): what each module does and the save fields it owns.

## Basics

- **Bindings:** `<input data-bind="path.in.char">` binds two-way through a global listener in `app.js`. Add `data-type="num"` for numbers and `data-rerender` to redraw on change. In `sheet.js`, use `inp(path, opts)`, `chk(path)` and `sel(path, options)`.
- **Computed values:** `<span data-calc="path.in.derived" data-fmt="sign|plain|slots">` is filled from `compute()` after every change. Use `calc(key, fmt)` in `sheet.js`.
- **Saving and redrawing:** saving is debounced and automatic after `changed()`. `changed({ rerender: true })` keeps the scroll position.
- **Save format:** `migrate()` back-fills any field that has a default in `newCharacter()`, so adding a field needs no migration code.
- **Bonuses:** buffs and conditions are `{target, value, type, scale?}` effects. `value` may be a formula using `bab`, `lvl`, `floor`, `ceil`, `min` or `max`. Valid targets are in `MOD_TARGETS`.
- **Untrusted HTML:** HTML that did not come from our own compendium (a creature stat block stored in a character file) goes through `safehtml.js` before it is shown.
- **Text selection:** the desktop window disables it app-wide. Anything the user may want to copy (stat blocks, entry text) opts in with `user-select: text` in `app.css`.

## Text, links and the side panel

- **Text fields:** names and notes use `textField()` (`tf()` in `sheet.js`), which shows readable text. Double-click edits it; a single click opens the full text in the side panel when `read` is set. Numeric fields stay normal inputs.
- **Rules links:** `data-entry="Name"` (optional `data-cat`, `data-entry-id`) makes any element open that compendium entry in the side panel. Use `ref()` / `refId()`. The side panel treats every `<a>` as a compendium lookup.
- **Own content in the side panel:** `showCustom({name, cat, html})`.
- **Stat-block links:** `termlinks.js` (pure, tested) turns ability names in stat-block text into compendium links. Add new names to its lists.
- **Tooltips:** `title="..."` attributes are shown by our own styled tooltip (`initTooltips` in `ui.js`, which moves the text into `data-tip`). Use `title` as usual.

## Layout

- **Label + box forms:** wrap `<label>Text <input></label>` pairs in `<div class="fields">` (`cols2`/`cols3`/`cols4` for pairs per row, `compact` for the small muted look on the Overview). Prefer this to `.kv` / `.form` for new forms.
  - The labels are `display: contents`, so every label and box shares grid tracks and the boxes line up. Text boxes fill their track, number boxes stop at 96px, selects keep their width.
  - A row with extra controls is `<label>` + `<span class="ctl">`; `.span-all` and `.under` place a note across or under the boxes.
- **Sub-pages inside a tab:** the pill `.subtabs` / `.subtab` (Notes, Companions). Put the page's buttons on the same line with `.row.subtab-bar`.
- **Sheet tab bar:** `render()` keeps the tab bar in the page and only replaces `#tab-body` (tracked by `main.dataset.view`), so tabs never flicker. Don't add transitions or size changes to `.tab`. A new tab only needs adding to `TABS`.
- **Down vs. dead:** the Overview HP card and summon cards use an amber frame when down (0 or below) and a red, greyed frame once HP reaches minus the Con score. Summons store `con`.
- **Name icon:** the square beside the character name in the top bar is the button for adding, changing, recentering and removing it.
- **Pictures:** `cropper.js` is the picture chooser with a drag-to-recenter and zoom window (`imagecrop.js` holds the tested crop maths). `picFrame()`/`picAction()` give companions (large, 4:3) and summons (small square) an `image`. The uncropped original is kept beside it with `Src` added (`imageSrc`; `portraitSrc`/`avatarSrc` on the character) so it can be repositioned later.

## Rolls

- **Rolling:** `roller.js` handles clicks on any element with `data-roll`, `data-roll-weapon`, `data-roll-add` or `data-roll-dice`; `dice.js` is the pure dice logic.
- **Where numbers come from:** `compute()` fills `d.bd`: for each rolled number, a list of `{label, value}` parts that add up to it (`stackParts()` lists the buffs that count, by name and bonus type). The hover text (`rolltip.js`, built live by `tipFor` in `roller.js`) shows them.
  - When you add a rolled number, add its parts to `d.bd` under the same path as its `data-roll` key. `tests/breakdown.test.mjs` checks every part list sums to its total.
  - Companion numbers carry their own `data-tip`, built in `views/companions.js` from `computeCompanion`'s `bd` and attack `parts`.
- **Roll window:** clicking a rollable number opens it (`rollWindow`/`askRoll` in `roller.js`; option `rollAsk`, Shift skips it), with modifier presets (`presetsFor(attack)`), Advantage/Disadvantage, and Roll here / Send to Discord (`doRoll({..., send})`).
  - Layout: both roll windows (`rollWindow`, `modsWindow`) are one `.rw-grid` of rows built with `rwRow(label, html)` (spell choices, Roll + Advantage/Disadvantage, Buffs, Extra damage, Bonuses, Penalties, Custom), then the `Now:` line, a one-line note, and `.rw-foot` with compact `toggle()`s (`.check-row.mini`, explanation in the hover text) and the buttons. **A new option is a row or a toggle, not a new block.**
- **Roll modifiers:** the roll bar's Modifier chip opens a window of presets (`MOD_PRESETS` in `dice.js`; presets with the same `group` replace each other) and a custom number. `addMods` appends the total to d20 expressions only, and the roll's label lists them. They last for the next roll unless "Keep it until I clear it" is ticked. Add a preset with a line in `MOD_PRESETS`.
  - One-roll situations (flanking, prone, dazzled) are modifier presets. Anything that lasts or changes AC or damage is a `BUFF_PRESETS` entry in `data.js` instead, so it is never offered in both places.
- **Discord switch:** one class set (`discordClass()`: `dchip` + `on` / `local`), used in the roll bar and the roll window.

## Spells tab

- **Chips and the side panel:** each spell level is a flow of chips (`.sp-chip`). Clicking one shows the spell in the side panel (`openSpell` in `sheet.js`). Its actions (Roll, Summon, Prepared, Cast, Delete, and name/description for custom spells) are drawn into the panel's `.entry-actions` by `renderSpellActions` when the `entry-shown` event arrives, and cleared on `drawer-closed`.
- **Slots:** prepared casters: `prepared` is what is left to cast, `cast` what was cast since Rest. Spontaneous and arcanist casters spend slots (`used[level]`, `slotsLeft()`); prepared spells there are only a list.
- **Rolling a spell:** roll buttons come from `fillSpellRolls` (`roller.js`), which only looks up the opened spell. The roll window (`spellWindow`) uses `spellInfo` (`spellinfo.js`): `count`/`noun` (rays and missiles at this caster level, one roll each, lowerable), and `undead` for cure spells (a melee touch attack when the range is touch, and a "Damage to undead" roll).
- **In play:** a spell with `active` (the "In play" tick, in the side panel and the roll window, kept in step; Rest clears it) opens the window on its damage, and the "Cast it" box is hidden while it is ticked.
- **Spell-like abilities** (`c.spellLikes`: `{id?, name, school, summary, notes, level, perDay, used, cl, ability}`, `perDay` blank = at will) are a block inside the first spellbook card, above the cantrips, or their own card when no class casts (`slaCard`, `wireSla`, `renderSlaActions` in `sheet.js`).
  - They use the same chips, side panel and roll window under the pseudo class `SLA_KEY` ('Spell-like', `roller.js`). `compute()` returns `d.spellLikes[i]` (`cl`, `dc` = 10 + level + the named ability's modifier, `concentration`, `left`, `unlimited`), and `casterOf()` in `roller.js` turns it into the caster numbers a class would give. Rest clears `used`.
  - The charactersheet.co.uk importer puts an entry here when it is a compendium spell or has a school; other entries (Arcane Reservoir) stay special abilities.
- **Class abilities:** `classabilities.js` (pure, tested) turns the class features you use (smite evil, lay on hands, wild shape...) into chips beside the spell-likes. `mercy.js` (pure, tested) is the paladin's mercies on lay on hands; `views/mercy.js` is the chooser.
- **Adding a spell:** `pickSpell()` in `sheet.js` searches the class's own lists by default; its "Spell list" choice (`SPELL_LIST_CLASSES` in `data.js`) looks through another class's list instead, and the spell goes in the book at the level it has on that list.
- **Favourite spells:** `favoritesAllowance()` in `spellrules.js` is a no-limit allowance (every level the caster has slots for, or `only` one level) in the same shape as `learnAllowance`, so the multi-pick `chooseSpells` works with it. The level-up wizard's "Favorite spells" (`draft.favs`, kept apart from the required picks in `draft.spells`) uses it with all levels. Spontaneous casters keep the table's fixed number.

## Resources, items and notes

- **Class resources:** `resources.js` (pure, tested) lists the pools a character's classes give (arcane reservoir, rage rounds, ki, grit...). Current points live in `c.resources[id]` (absent = start of day); `c.trackers` are the player's own counters. `views/resources.js` draws them on the Overview and the Spells tab, and the arcanist's reservoir also appears in its spell card. To add a pool, add a line to `classResources`.
- **Item charges:** `charges.js` (pure, tested) gives an inventory item `g.charges = {max, cur, per: 'total'|'day', unit, spells?}`: wands 50, staves 10 with each spell's cost, "has N charges" items their number. Items used so many times or rounds a day are offered, not set. The item panel in `sheet.js` and `views/resources.js` show and spend them; `rest.js` refills only `per: 'day'`.
- **Notes tab:** `notes()` in `sheet.js`, with inner tabs (`NOTE_TABS`; the open one is remembered in `notesTab`). Free text (`c.story`, and `c.notes` = General notes, which used to be the single Bio notes box), plus the lists `c.quests`, `c.npcs`, `c.lore` and `c.sessions` (shown newest first), added with `data-add` and removed with `data-del`. The Overview has a short Notes box (`c.quickNotes`) under Offense.
- **Sheet search:** `searchindex.js` (pure, tested) indexes the open character; `sheetsearch.js` is the top-bar UI. A new character field worth finding goes into `buildIndex`.

## Level up and import

- **Level-up warnings:** `levelcheck.js` (pure, tested) lists what is left undone when a level is applied; `warnBox()` in `ui.js` shows it with "Go back and fix" / "Apply anyway".
- **Archetype targets:** `findTargets()` in `features.js` falls back to class-specific `ALIASES`, and `EXTRA_FEATURES` adds features the class table omits (weapon and armor proficiency, spellbook, patron spells). About 3% of targets still show as plain text (swashbuckler and gunslinger deed names, paladin auras).
- **Importer checks:** `reconcile()` in `importcs.js` makes the app's numbers match the old sheet by putting the difference in a Misc box (HP Misc, a weapon's Atk+ and Dmg+). **It must never do that silently:** each one goes into the import report (`notes`) with both numbers and the box to clear. A new place that invents a number gets a note and a test the same way.

## Companions

- **Eligibility:** `companionSources()` in `companions.js` works out familiar and animal-companion levels from classes plus chosen abilities, feats and archetypes (arcanist Familiar exploit, shaman, Animal domain, Animal Ally, Boon Companion, paladin mount...). Add new grants there.
- **Cards:** every kind (animal, eidolon, familiar, creature) is drawn by `topPanels(comp, s, p, ed)` in `views/companions.js` from the same shape of numbers (`computeCompanion` / `computeCreature`). A card should show everything the stat block says (hit dice, save notes, special qualities, abilities, space and reach).
  - The classic stat block (`statBlock()`, or `statBlockHtml` for creatures) is not on the card; the card's "📋 Stat block" button opens it in the side panel (`showCustom`).
  - There is no settings bar; controls sit where they belong (`buildEditors`, `familiarEditors`, `creatureEditors`): kind, level and links in a strip under the title; AC, HP and attack adjustments inside the Defense, Hit Points and Offense panels; ability increases under the scores; then Build (evolutions, feats, skill ranks, tricks) and Notes panels.
- **From the creature list:** `/api/creatures` searches `data/creatures.json` (`q`, `type`, `cr` as "low-high") and `/api/creature?i=` reads one whole. "＋ From creature list…" (`chooseCreature` in `views/companions.js`) copies the stat block into a companion of kind `creature` (`comp.creature`, so a save never depends on the list). `creaturecomp.js` (pure, tested) reads the stat block text into the numbers the panels show (`computeCreature`); it does not level, and the player's `hpMisc`, `acMisc` and `attackMisc` are added on top.

## Options and the app shell

- **Options:** `options.js` keeps app options in `localStorage.options`. `sanitize()` is pure and tested; `applyOptions()` sets CSS variables and `data-*` flags on `<html>`.
  - The window has Look, Sound, Cookie and Discord tabs (`optionRows()`; add a row to the tab it belongs to).
  - **To add an option:** add it to `DEFAULTS`, `sanitize` and `showOptions`.
  - Sheet tab order is `tabOrder` (saved keys, merged with the usual list by the pure `orderKeys`); `tabDrag` turns on dragging in `wireTabDrag` (`sheet.js`).
- **Save folder:** `CHAR_DIR` in `app.py`: `PF_CHAR_DIR` (tests, dev) wins, else `charDir` in `%LOCALAPPDATA%\Cookie's Sheets\settings.json` (`read_settings`, `write_settings`), else Documents.
  - `set_char_dir()` switches at run time (`/api/storage`; the Characters page's "Change folder…", `wireSaveFolder` in `views/home.js`), copying characters, `.history` and `.deleted` when asked and never overwriting or deleting. A chosen folder on a missing drive falls back to the default and is reported.
  - The desktop window gives the page a folder chooser through pywebview's `js_api` (`WindowApi.pick_folder`); in a browser the Browse button stays hidden.
- **Changelog:** one entry per version in `web/js/changelog.js`, newest first; it feeds the "What's new" window (sidebar and Options). Each line is one short, plain sentence. `groupChangelog` in `options.js` shows each area once, so lines of one area belong together.
- **Sharing a build:** `web/js/version.js` holds the version shown in Options. The app writes problems to `%LOCALAPPDATA%\Cookie's Sheets\error.log` and falls back to the default browser if the native window cannot open.
- **Developer tools:** anything for the author only lives in `web/dev/` (today `animlab.js`, the Animation lab, opened from Options, Developer tools; the button shows only when `dev/animlab.js` exists). `build_exe.ps1` builds from a copy of `web` without `dev/`, and `python tools/make_zip.py` refuses if `web/dev`, `tests` or `tools` are in `dist`. Never put dev tools anywhere else.
