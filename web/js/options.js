// App options (theme, accent colour, text size...) kept in localStorage and applied to the page.
// `sanitize` and `ACCENTS` are pure; `applyOptions` and `showOptions` touch the DOM.
import { modal, esc, toast, confirmBox } from './ui.js';
import { api } from './api.js';
import { SOUND_CATS, soundItems, isCustomized, refreshSounds as loadCustomSounds, previewSound } from './sfx.js';
import { VERSION } from './version.js';
import { checkForUpdate } from './update.js';
import { CHANGELOG } from './changelog.js';

export const ACCENTS = {
  crimson: { name: 'Crimson', light: null, dark: null },
  blue: { name: 'Blue', light: '#1f5fa8', dark: '#5aa2e8' },
  teal: { name: 'Teal', light: '#14797a', dark: '#4cc2c0' },
  green: { name: 'Green', light: '#2f7d4b', dark: '#5cc185' },
  purple: { name: 'Purple', light: '#6b3fa0', dark: '#a98be0' },
  gold: { name: 'Gold', light: '#9a6a10', dark: '#d6aa52' },
};
export const TEXT_SIZES = [[90, 'Small'], [100, 'Normal'], [112, 'Large'], [125, 'Extra large']];

export const THEMES = [['dark', 'Classic dark'], ['tome', 'Dusty tome']];

export const DEFAULTS = { theme: 'tome', accent: 'crimson', textSize: 100, compact: false, motion: true, pageTurn: true, pageSound: true, volume: 100, soundOff: {}, cookie: true, cookieTalk: 'normal', cookieSwear: 'full', cookieSound: false, webhook: '', rollSend: true, rollAsk: true, tabDrag: false, tabOrder: [], updateCheck: true };

/** Fill in defaults and drop anything invalid, so a bad or old stored value can never break the page. */
export function sanitize(raw) {
  const o = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!THEMES.some(([k]) => k === o.theme)) o.theme = DEFAULTS.theme; // light mode and "match Windows" are gone; they become dark
  if (!ACCENTS[o.accent]) o.accent = DEFAULTS.accent;
  o.textSize = Number(o.textSize);
  if (!TEXT_SIZES.some(([v]) => v === o.textSize)) o.textSize = DEFAULTS.textSize;
  o.pageTurn = o.pageTurn !== 'off' && o.pageTurn !== false; // used to be Full / Light / Off
  if (!['quiet', 'normal', 'chatty'].includes(o.cookieTalk)) o.cookieTalk = DEFAULTS.cookieTalk;
  if (!['full', 'bleep'].includes(o.cookieSwear)) o.cookieSwear = DEFAULTS.cookieSwear;
  for (const k of ['compact', 'motion', 'pageSound', 'cookieSound', 'tabDrag', 'updateCheck']) o[k] = !!o[k];
  delete o.tabLock; // the lock was folded into tabDrag (off = locked)
  o.tabOrder = Array.isArray(o.tabOrder) ? [...new Set(o.tabOrder.filter(k => typeof k === 'string' && k.length < 30))].slice(0, 30) : [];
  // One volume for every sound. Saves from before the slider had a "Sound effects" checkbox: unchecked becomes volume 0.
  const v = Math.round(Number(o.volume));
  o.volume = !(raw && typeof raw === 'object') || raw.volume === undefined ? (raw && raw.sfx === false ? 0 : DEFAULTS.volume) : Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : DEFAULTS.volume;
  delete o.sfx;
  // Built-in sounds the player switched off, per effect: {hit: ['sounds/hit-2.ogg']}.
  const off = {};
  for (const k of ['levelUp', 'heal', 'fullHeal', 'hit']) {
    const list = o.soundOff && Array.isArray(o.soundOff[k]) ? o.soundOff[k].filter(x => typeof x === 'string' && x.length < 80).slice(0, 8) : [];
    if (list.length) off[k] = list;
  }
  o.soundOff = off;
  o.webhook = typeof o.webhook === 'string' ? o.webhook.trim() : '';
  o.rollSend = !!o.rollSend;
  o.rollAsk = !!o.rollAsk;
  o.cookie = true; // he is not going anywhere (unchecking the box only makes him laugh)
  return o;
}

// The developer tools live in web/dev/, which is left out of the build and the zip, so there the button never appears.
let devTools = null;
fetch('dev/animlab.js', { method: 'HEAD' }).then(r => (r.ok ? import('../dev/animlab.js') : null)).then(m => { devTools = m; }).catch(() => {});

let current = sanitize(null);
export const options = () => current;
/** The volume slider as 0 to 1, for every sound the app plays. */
export const volume = () => current.volume / 100;

/** The sheet's tabs in the player's order: the saved keys first (unknown ones dropped), then any tab not mentioned, in its usual place. Pure. */
export function orderKeys(base, saved) {
  const keep = (saved || []).filter((k, i, a) => base.includes(k) && a.indexOf(k) === i);
  return [...keep, ...base.filter(k => !keep.includes(k))];
}

/** Change one option from code (the roll bar's Discord switch). */
export function setOption(k, v) { current = sanitize({ ...current, [k]: v }); save(); }

export function loadOptions() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem('options') || 'null'); } catch { /* ignore */ }
  if (!raw) { try { const t = localStorage.getItem('theme'); if (t === 'dark') raw = { theme: t }; } catch { /* ignore */ } }
  current = sanitize(raw);
  applyOptions();
  return current;
}

function save() { try { localStorage.setItem('options', JSON.stringify(current)); } catch { /* ignore */ } }

export function applyOptions() {
  const root = document.documentElement;
  root.dataset.theme = current.theme;
  const a = ACCENTS[current.accent];
  const col = current.theme === 'dark' && a && a.dark; // accent colors are for Classic dark only
  if (col) {
    root.style.setProperty('--accent', col);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${col} 18%, var(--panel))`);
  } else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); }
  root.style.zoom = current.textSize === 100 ? '' : String(current.textSize / 100);
  root.dataset.compact = current.compact ? 'on' : 'off';
  root.dataset.motion = current.motion ? 'on' : 'off';
  document.dispatchEvent(new Event('optionschange'));
}

export function initOptions() {
  loadOptions();
  loadCustomSounds(); // which custom sound files exist
}

const OPT_TABS = [['look', 'Look'], ['sound', 'Sound'], ['cookie', 'Cookie'], ['discord', 'Discord']];
const openCats = new Set(); // which sound effects are expanded in the Sound tab
const AUDIO_TYPES = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', flac: 'audio/flac' };
let optTab = 'look'; // the window opens on the tab you used last

const seg = (key, value, items) => `<div class="seg">${items.map(([k, l]) => `<button class="seg-btn ${value === k ? 'on' : ''}" data-opt="${key}" data-v="${k}">${l}</button>`).join('')}</div>`;
const check = (key, label, on) => `<label class="opt-row"><b>${label}</b><input type="checkbox" data-opt="${key}" ${on ? 'checked' : ''}></label>`;

/** One effect in the Sound tab: a summary of what plays now, and (when opened) every sound it has with Play and a way to remove or bring it back. */
function soundCategory(k, label, o, customSounds) {
  const items = soundItems(k, customSounds, o.soundOff);
  const active = items.filter(s => s.enabled);
  const summary = active.length ? active.map(s => s.label).join(', ') : 'silent';
  const rows = items.map(s => {
    const mine = s.kind === 'custom';
    const act = mine ? `<button class="icon-btn" data-sfx-remove="${k}" data-ref="${esc(s.ref)}" title="Remove this sound">✕</button>`
      : s.enabled ? `<button class="icon-btn" data-sfx-off="${k}" data-ref="${esc(s.ref)}" title="Switch this built-in sound off">✕</button>`
        : '<span class="muted small" title="Switched off. Restore defaults brings it back.">off</span>';
    return `<div class="sfx-item ${s.enabled ? '' : 'off'}"><button class="btn small ghost" data-play="${k}" data-kind="${s.kind}" data-ref="${esc(s.ref)}" title="Play">▶</button>
      <span class="sfx-name">${esc(s.label)}${mine ? ' <span class="muted small">(yours)</span>' : ''}</span>${act}</div>`;
  }).join('');
  return `<details class="sfx-cat" data-cat="${k}" ${openCats.has(k) ? 'open' : ''}><summary><b>${label}</b> <span class="muted small">${esc(summary)}</span></summary>
    <div class="sfx-list">${rows || ''}
      ${active.length ? '' : '<p class="muted small sfx-empty">Nothing plays for this effect.</p>'}
      <div class="row sfx-add"><button class="btn small" data-pick="${k}">＋ Add sound…</button>${isCustomized(k, customSounds, o.soundOff) ? `<button class="btn small ghost" data-sfx-restore="${k}" title="Back to the factory sounds: removes the ones you added">Restore defaults</button>` : ''}</div></div></details>`;
}

/** One tab's rows. Pure string building from the current options (and which sounds are custom). */
function optionRows(tab, o, customSounds) {
  const tome = o.theme === 'tome';
  if (tab === 'look') {
    return `<div class="opt-row"><b>Theme</b>${seg('theme', o.theme, THEMES)}</div>
      ${tome ? check('pageTurn', 'Page turn', o.pageTurn) : ''}
      <div class="opt-row" ${tome ? 'style="opacity:.45"' : ''}><b>Accent color <span class="muted small">(Classic dark only)</span></b><div class="swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button class="swatch ${o.accent === k ? 'on' : ''}" data-opt="accent" data-v="${k}" title="${a.name}" style="background:${a.dark || '#e0605a'}" ${tome ? 'disabled' : ''}></button>`).join('')}</div></div>
      <div class="opt-row"><b>Text size</b>${seg('textSize', o.textSize, TEXT_SIZES)}</div>
      ${check('compact', 'Compact layout', o.compact)}
      <div class="opt-row"><b>Sheet tabs</b><span class="opt-inline"><button class="btn small ${o.tabDrag ? '' : 'ghost'}" data-tab-lock title="${o.tabDrag ? 'The tabs can be dragged into a new order. Click to lock them where they are.' : 'The tabs are locked in place. Click to unlock them so they can be dragged.'}">${o.tabDrag ? '🔓 Drag to rearrange' : '🔒 Locked'}</button>${o.tabOrder.length ? '<button class="btn small ghost" data-tab-reset title="Put the tabs back in their usual order">Reset order</button>' : ''}</span></div>
      ${check('motion', 'Animations', o.motion)}
      ${check('updateCheck', 'Look for a new version when the app starts', o.updateCheck)}
      <div class="opt-row"><b>Updates</b><button class="btn small" data-update-now>Check for updates now</button></div>`;
  }
  if (tab === 'sound') {
    return `<div class="opt-row"><b>Volume</b><span class="vol"><input type="range" min="0" max="100" step="5" data-opt="volume" value="${o.volume}" aria-label="Volume"> <b id="vol-out">${o.volume}%</b></span></div>
      ${check('pageSound', 'Page turn sound' + (tome ? '' : ' <span class="muted small">(Dusty tome)</span>'), o.pageSound)}
      ${check('cookieSound', 'Cookie’s squawks', o.cookieSound)}
      <h4 class="opt-head">Sound effects</h4>
      ${SOUND_CATS.map(([k, label]) => soundCategory(k, label, o, customSounds)).join('')}
      <input type="file" id="sfx-file" accept="audio/*" hidden>`;
  }
  if (tab === 'cookie') {
    return `${check('cookie', 'Cookie, the rude bird', o.cookie)}
      <div class="opt-row"><b>How much he talks</b>${seg('cookieTalk', o.cookieTalk, [['quiet', 'Quiet'], ['normal', 'Normal'], ['chatty', 'Chatty']])}</div>
      <div class="opt-row"><b>Swearing</b>${seg('cookieSwear', o.cookieSwear, [['full', 'Full'], ['bleep', 'Bleeped']])}</div>`;
  }
  return `<div class="opt-row"><span><b>Webhook</b><br><span class="muted small">The channel's webhook URL (Channel settings, Integrations, Webhooks).</span></span><input type="password" class="w20" data-opt="webhook" value="${esc(o.webhook)}" placeholder="https://discord.com/api/webhooks/..." autocomplete="off"></div>
    ${check('rollSend', 'Send rolls to Discord', o.rollSend)}
    ${check('rollAsk', 'Ask before rolling (hold Shift to roll straight away)', o.rollAsk)}`;
}

export function showOptions() {
  return modal('Options', body => {
    let customSounds = {};
    let pickFor = ''; // the effect the file chooser was opened for (a variable, not an attribute on the body: closest('[data-pick]') would then match the body itself for every later click)
    const draw = () => {
      body.innerHTML = `<div class="seg opt-tabs">${OPT_TABS.map(([k, l]) => `<button class="seg-btn ${optTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="opt-grid">${optionRows(optTab, current, customSounds)}</div>
        <div class="opt-foot"><span class="muted small">Cookie’s Sheets, version ${VERSION}</span><span class="grow"></span>
          <button class="btn small ghost" data-changelog>What’s new</button><button class="btn small ghost" data-ogl>Game content &amp; license</button>${devTools ? '<button class="btn small ghost" data-dev>Developer tools</button>' : ''}</div>`;
    };
    const set = (k, v) => { current = sanitize({ ...current, [k]: v }); save(); applyOptions(); draw(); document.dispatchEvent(new Event('options-changed')); };
    const refreshSounds = async () => { customSounds = await loadCustomSounds(); };
    body.onclick = async e => {
      if (e.target.closest('[data-tab-lock]')) return set('tabDrag', !current.tabDrag);
      if (e.target.closest('[data-tab-reset]')) return set('tabOrder', []);
      const tab = e.target.closest('[data-tab]');
      if (tab) { optTab = tab.dataset.tab; return draw(); }
      const b = e.target.closest('button[data-opt]');
      if (b) return set(b.dataset.opt, b.dataset.opt === 'textSize' ? +b.dataset.v : b.dataset.v);
      const play = e.target.closest('[data-play]');
      if (play) return previewSound(play.dataset.play, play.dataset.kind, play.dataset.ref);
      const pick = e.target.closest('[data-pick]');
      if (pick) { pickFor = pick.dataset.pick; return body.querySelector('#sfx-file').click(); }
      const off = (k, f) => { const list = current.soundOff[k] || []; set('soundOff', { ...current.soundOff, [k]: f(list) }); };
      const sOff = e.target.closest('[data-sfx-off]');
      if (sOff) return off(sOff.dataset.sfxOff, l => [...l, sOff.dataset.ref]);
      const del = e.target.closest('[data-sfx-remove]'), restore = e.target.closest('[data-sfx-restore]');
      if (del || restore) {
        const k = restore?.dataset.sfxRestore;
        const mine = restore ? (customSounds[k] || []).length : 0;
        // Restoring removes the files the player added, so ask first when there are any.
        if (mine && !(await confirmBox(`This puts this effect back to its built-in sounds and removes the ${mine} sound${mine === 1 ? '' : 's'} you added. Continue?`, 'Restore defaults'))) return;
        try {
          if (del) await api.removeSound(del.dataset.sfxRemove, del.dataset.ref);
          else { await api.removeSound(k); current = sanitize({ ...current, soundOff: { ...current.soundOff, [k]: [] } }); save(); }
        } catch (err) { toast(err.message, 'err'); }
        await refreshSounds(); return draw();
      }
      if (e.target.closest('[data-update-now]')) { e.target.closest('.modal-back')?.querySelector('[data-close]')?.click(); return checkForUpdate(); }
      if (e.target.closest('[data-changelog]')) return showChangelog();
      if (e.target.closest('[data-ogl]')) return showLicense();
      if (e.target.closest('[data-dev]')) { e.target.closest('.modal-back')?.querySelector('[data-close]')?.click(); devTools.showAnimLab(); }
    };
    body.addEventListener('toggle', e => { const d = e.target.closest?.('details[data-cat]'); if (d) (d.open ? openCats.add(d.dataset.cat) : openCats.delete(d.dataset.cat)); }, true);
    body.oninput = e => { if (e.target.dataset?.opt === 'volume') body.querySelector('#vol-out').textContent = e.target.value + '%'; };
    body.onchange = async e => {
      if (e.target.id === 'sfx-file') {
        const file = e.target.files?.[0], name = pickFor;
        e.target.value = ''; // so choosing the same file again still fires
        if (!file || !name) return;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const typed = file.type && file.type.startsWith('audio/') ? file : new Blob([file], { type: AUDIO_TYPES[ext] || '' }); // some browsers leave .ogg or .flac untyped
        try {
          const all = await api.addSound(name, typed, file.name);
          openCats.add(name);
          await refreshSounds();
          draw();
          const added = (all[name] || []).slice(-1)[0];
          if (added) previewSound(name, 'custom', added.id);
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      const t = e.target.closest('[data-opt]');
      if (!t || t.tagName === 'BUTTON') return;
      if (t.dataset.opt === 'cookie') { if (!t.checked) document.dispatchEvent(new Event('cookie-refuse')); draw(); return; }
      set(t.dataset.opt, t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value);
      if (t.dataset.opt === 'volume') import('./sfx.js').then(m => m.playSfx('heal')); // so you can hear the level you picked
    };
    draw();
    refreshSounds().then(draw);
  }, { top: true });
}

/** The "What’s new" window. */
/** The Open Game License text that covers the game content. */
export async function showLicense() {
  const text = await (await fetch('ogl.html')).text();
  return modal('Game content: Open Game License v1.0a', body => { body.innerHTML = `<div class="entry-body">${text}</div>`; }, { wide: true });
}

export function showChangelog() {
  return modal('What’s new', body => {
    body.innerHTML = CHANGELOG.map(e => `<h3>${esc(e.version)}${e.date ? ` <span class="muted small">${esc(e.date)}</span>` : ''}</h3>
      <ul class="changelog">${e.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
  }, { wide: true });
}

/** Remove from `clone` everything that sits below `limit` (a y position on screen), walking the live page in step with it. */
function pruneBelow(live, clone, limit) {
  for (let i = live.children.length - 1; i >= 0; i--) {
    const r = live.children[i].getBoundingClientRect();
    if (r.top > limit) clone.children[i].remove();
    else if (r.bottom > limit) pruneBelow(live.children[i], clone.children[i], limit);
  }
}

const PAGE_SOUNDS = ['sounds/page-turn-1.mp3', 'sounds/page-turn-2.mp3', 'sounds/page-turn-3.mp3'];
let audioCtx = null, soundBuffers = null, lastSound = -1, lastRate = 1;
/** Decode the sounds once (Web Audio lets each play be pitched a little differently). Resolves null if audio is unavailable. */
function loadSounds() {
  if (soundBuffers) return soundBuffers;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    soundBuffers = Promise.all(PAGE_SOUNDS.map(src => fetch(src).then(r => r.arrayBuffer()).then(b => audioCtx.decodeAudioData(b))))
      .catch(() => null);
  } catch { soundBuffers = Promise.resolve(null); }
  return soundBuffers;
}
/** A short paper rustle: a different recording from last time, pitched up or down a little (and a touch louder or softer) each play. */
async function playPageSound() {
  if (!current.pageSound || current.volume === 0) return;
  try {
    const bufs = await loadSounds();
    if (!bufs || !audioCtx) return;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    let i;
    do { i = Math.floor(Math.random() * bufs.length); } while (i === lastSound && bufs.length > 1);
    lastSound = i;
    let rate;
    do { rate = 0.88 + Math.random() * 0.26; } while (Math.abs(rate - lastRate) < 0.05);
    lastRate = rate;
    const src = audioCtx.createBufferSource();
    src.buffer = bufs[i];
    src.playbackRate.value = rate;
    const gain = audioCtx.createGain();
    gain.gain.value = (0.55 + Math.random() * 0.2) * volume();
    src.connect(gain).connect(audioCtx.destination);
    src.start();
  } catch { /* no audio available */ }
}

/** A copy of the page for the page turn, holding only the part that is on screen. null unless the tome theme and animations are on. */
export function snapshotPage(body) {
  if (current.theme !== 'tome' || !current.motion || !current.pageTurn || !body) return null;
  const clone = body.cloneNode(true);
  clone.dataset.h = body.offsetHeight;
  clone.removeAttribute('id');
  // Inner ids stay: the stylesheet styles some things by id (the health bar fill). The live page comes first in the document, so lookups still find it.
  pruneBelow(body, clone, window.innerHeight + 40);
  return clone;
}

/** How many hinged strips the page turn uses for a page with this many elements: 14 for a plain page, down to 7 for a busy one. */
export const pageTurnStrips = size => (size > 420 ? 7 : size > 260 ? 9 : size > 150 ? 11 : 14);

/**
 * Tome theme: the old page (a snapshot) swings over from the spine like a sheet of loose paper, uncovering the new page underneath.
 * Going back a tab plays it in reverse: the new page swings back over the old one. The animation itself is CSS (see theme-tome.css).
 */
export function playPageTurn(body, snapshot, back = false) {
  if (!snapshot || !body?.parentElement) return;
  // The turn is hinged strips, each holding its own copy of the page, so a busy
  // page (the Skills tab, the Overview) gets fewer strips: the work grows with strips x page size. A bend of 7 to 9 strips still reads as a curl.
  const size = (back ? body : snapshot)?.querySelectorAll('*').length || 0;
  const STRIPS = pageTurnStrips(size);
  const W = body.offsetWidth;
  const sw = W / STRIPS;
  const main = document.getElementById('main');
  // As tall as the old page, but never taller than what is on screen; the new page may still be loading (companions), so its height is no guide.
  const avail = (main?.clientHeight || 700) - body.offsetTop + 30;
  const h = Math.max(260, Math.min(Math.max(+snapshot.dataset.h || 0, body.offsetHeight), avail));
  const leaf = document.createElement('div');
  leaf.className = 'page-turn' + (back ? ' rev' : '');
  // The leather behind the sheet is drawn at the same offsets as the real background, so the pattern lines up and does not restart per strip.
  leaf.style.cssText = `left:${body.offsetLeft}px;top:${body.offsetTop}px;width:${W}px;height:${h}px;--bx:${body.offsetLeft}px;--by:${body.offsetTop}px;--mw:${main?.clientWidth || 1200}px;--mh:${main?.clientHeight || 800}px`;
  // The sheet that moves shows the old page going forward, and the new page coming back.
  const moving = back ? snapshotPage(body) : snapshot;
  if (back) {
    const under = document.createElement('div');
    under.className = 'pt-under';
    snapshot.classList.add('pt-clone');
    snapshot.style.width = W + 'px';
    under.appendChild(snapshot);
    leaf.appendChild(under);
  }
  const shadow = document.createElement('div');
  shadow.className = 'pt-shadow';
  const sheet = document.createElement('div');
  sheet.className = 'pt-sheet';
  let parent = sheet;
  for (let i = 0; i < STRIPS; i++) {
    const strip = document.createElement('div');
    strip.className = 'pt-strip' + (i === 0 ? ' first' : '');
    strip.style.cssText = `width:${sw + 3}px;--i:${STRIPS > 1 ? (i / (STRIPS - 1)).toFixed(3) : 0};--sx:${(i * sw).toFixed(2)}px`;
    const front = document.createElement('div');
    front.className = 'pt-face pt-front';
    const clone = i === STRIPS - 1 ? moving : moving.cloneNode(true);
    clone.classList.add('pt-clone');
    clone.style.cssText = `left:${-i * (sw - 0)}px;width:${W}px`;
    front.appendChild(clone);
    const rear = document.createElement('div');
    rear.className = 'pt-face pt-back';
    strip.append(front, rear);
    parent.appendChild(strip);
    parent = strip;
  }
  leaf.append(shadow, sheet);
  body.parentElement.appendChild(leaf);
  void leaf.offsetWidth;
  leaf.classList.add('go');
  setTimeout(() => leaf.remove(), 800);
  playPageSound();
}
