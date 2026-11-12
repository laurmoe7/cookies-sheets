# Themes, page turn, Cookie and sounds

The app's look and its noises. General UI rules are in [ui-conventions.md](ui-conventions.md).

## Themes

- The default theme is **Dusty tome**. **Classic dark** is the palette in `:root` of `app.css`. There is no light mode.
- Extra themes are `html[data-theme="<name>"]` blocks in their own `css/theme-<name>.css`, listed in `THEMES` in `options.js`. A theme overrides the same CSS variables and may restyle components.
- `theme-tome.css` is **generated**: edit `tools/make_tome_css.py` and run it.
- Textures are SVG `feTurbulence` sources in `make_tome_css.py`, baked into `web/css/tome/*` by `node tools/bake_tome_textures.mjs`. Run that after changing a texture (drawn live, they were re-rendered on every tile repaint).
- Cards cycle through four paper variants (`:nth-of-type`), each lighter in the middle and darker toward the edges.

### Keep it cheap to paint

- A scroller whose background is not opaque, like `#main` in Dusty tome, repaints on every scroll step unless it has its own layer. That is why `#main` has `will-change: transform` in `make_tome_css.py`: the Spells and Skills tabs scrolled at about 50 ms a frame without it, 4 ms with it.
- No `background-blend-mode`, no `background-attachment: fixed`, no big filters at runtime (textures are baked images).
- Never use `outline` for a card frame: a negative-offset outline made each hover or scroll step repaint the whole card, 3x the GPU raster work in the real window. The frame is `.card::before`.
- **Measure in the real desktop window:** start `app.py` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` and trace over CDP with real `Input.dispatchMouseEvent` hovers and wheels. Headless Chrome and rAF timings did not show the outline problem.

## Page turn

`playPageTurn` in `options.js` clones the old page (only the part on screen) into 14 overlapping hinged strips that bend, animated in CSS. Going back a tab plays it in reverse with the new page as the moving sheet. It is the boolean option `pageTurn` (old Full/Light/Off values are converted).

Cost matters here (measured in headless Chrome by timing a tab switch):

- The animated `--c` inherits, so `.pt-clone` resets it to 0; otherwise every element of every copy restyles each frame.
- Busy pages get fewer strips (`pageTurnStrips`).
- The copies keep the card paper (a dark base colour with no texture looked wrong) but drop the blurred inner shadow.

## Cookie (the mascot)

`web/js/pet/` is the rude thrush in the sidebar's `#cookie-slot`.

| File | What it is |
| --- | --- |
| `art.js` | His SVG (the Pet Shopper bird with the thrush skin, trimmed, plus a cigarette and brows) |
| `css/pet.css` | His styles, all scoped under `#cookie` (generic class names like `.arm` and `.skin` must not leak) |
| `facts.js` | Pure, tested. Boils the character down to a few facts; `diffFacts` says what happened (damage, down, dead, cast, summon, item, gold...) |
| `lines.js` | His dialogue, `LINES`. Placeholders `{name} {n} {item} {spell} {summon}`; a leading `~` is his cute act, a leading `*` an action |
| `pet.js` | Decides whether he talks (Options: off, Quiet/Normal/Chatty, bleeped swearing, squawks), picks a face and move per event (`REACT`), and plays them |

- `changed()` in `app.js` calls `observe()`, which waits 650 ms for typing to stop; `openCharacter`/`createCharacter` call `opened()`.
- The "Cookie" option cannot be turned off, on purpose: `sanitize` forces it on, and unchecking fires `cookie-refuse` and he laughs.
- His size is `--cs` on `#cookie-slot`; the bubble is positioned from it so the tail meets his beak.
- **To react to something new:** add a fact and a case in `diffFacts`, a `REACT` entry and a `LINES` key.

## Sound effects

- `sfx.js` plays named effects from `web/sounds/`: `levelUp`, `heal` (the Heal button), `fullHeal` (Full heal) and `hit` (damage). `SOUND_CATS` lists them.
- Each effect has a pool of sounds (`soundItems()`): the built-in files, any of which can be switched off (option `soundOff`), plus audio files the player added. `playSfx` picks one at random; an empty pool is silent.
- Added sounds: up to 8 per effect, stored by the server in `%LOCALAPPDATA%\Cookie's Sheets\sounds` as `<effect>__<id>__<label><ext>` (`PF_SOUND_DIR` overrides; `/api/sounds`, `/api/sound`, `/api/sound/delete`, `/api/sound-file`).
- Options, Sound lists each effect with Play, remove, Add and Restore defaults (which also brings back switched-off built-in sounds).
- Volume: `volume()` in `options.js`, 0 to 1 (0 is silent). The same slider scales the page-turn sound and Cookie's squawks, which keep their own on/off checkboxes.
- `tools/normalize_sounds.py` levels every file in `web/sounds/`; run it after adding a sound.

## Heal and hurt animation

`healfx.js` (`hpFx`) animates any `.hp-bar` after a heal or damage (`kind: 'heal'|'hurt'`), with strength from `frac` (share of max HP). Just before re-rendering, the Overview sets `state.healFx`, companions `state.compFx` and summons a module-level `sumFx`; the next draw consumes it.
