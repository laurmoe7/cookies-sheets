// App options (theme, accent colour, text size...) kept in localStorage and applied to the page.
// `sanitize` and `ACCENTS` are pure; `applyOptions` and `showOptions` touch the DOM.
import { modal, esc } from './ui.js';
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
export const START_TABS = [['overview', 'Overview'], ['skills', 'Skills'], ['feats', 'Feats & Abilities'], ['spells', 'Spells'], ['gear', 'Gear'],
  ['companions', 'Companions'], ['buffs', 'Buffs & Conditions'], ['bio', 'Bio & Notes']];

export const THEMES = [['dark', 'Classic dark'], ['tome', 'Dusty tome']];

export const DEFAULTS = { theme: 'dark', accent: 'crimson', textSize: 100, compact: false, tooltips: true, motion: true, reopenLast: true, startTab: 'overview', pageTurn: 'full', pageSound: true };

/** Fill in defaults and drop anything invalid, so a bad or old stored value can never break the page. */
export function sanitize(raw) {
  const o = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!THEMES.some(([k]) => k === o.theme)) o.theme = DEFAULTS.theme; // light mode and "match Windows" are gone; they become dark
  if (!ACCENTS[o.accent]) o.accent = DEFAULTS.accent;
  o.textSize = Number(o.textSize);
  if (!TEXT_SIZES.some(([v]) => v === o.textSize)) o.textSize = DEFAULTS.textSize;
  if (!START_TABS.some(([k]) => k === o.startTab)) o.startTab = DEFAULTS.startTab;
  if (!['full', 'light', 'off'].includes(o.pageTurn)) o.pageTurn = DEFAULTS.pageTurn;
  for (const k of ['compact', 'tooltips', 'motion', 'reopenLast', 'pageSound']) o[k] = !!o[k];
  return o;
}

let current = sanitize(null);
export const options = () => current;

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
  const col = a && a.dark;
  if (col) {
    root.style.setProperty('--accent', col);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${col} 18%, var(--panel))`);
  } else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); }
  root.style.zoom = current.textSize === 100 ? '' : String(current.textSize / 100);
  root.dataset.compact = current.compact ? 'on' : 'off';
  root.dataset.tips = current.tooltips ? 'on' : 'off';
  root.dataset.motion = current.motion ? 'on' : 'off';
}

export function initOptions() {
  loadOptions();
}

export function showOptions() {
  return modal('Options', body => {
    const draw = () => {
      const o = current;
      body.innerHTML = `<div class="opt-grid">
        <div class="opt-row"><b>Theme</b><div class="seg">${THEMES.map(([k, l]) => `<button class="seg-btn ${o.theme === k ? 'on' : ''}" data-opt="theme" data-v="${k}">${l}</button>`).join('')}</div></div>
        <div class="opt-row"><b>Accent color</b><div class="swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button class="swatch ${o.accent === k ? 'on' : ''}" data-opt="accent" data-v="${k}" title="${a.name}" style="background:${a.dark || '#e0605a'}"></button>`).join('')}</div></div>
        <div class="opt-row"><b>Text size</b><div class="seg">${TEXT_SIZES.map(([v, l]) => `<button class="seg-btn ${o.textSize === v ? 'on' : ''}" data-opt="textSize" data-v="${v}">${l}</button>`).join('')}</div></div>
        <label class="opt-row"><span><b>Compact layout</b><br><span class="muted small">Tighter cards and spacing, to fit more on screen.</span></span><input type="checkbox" data-opt="compact" ${o.compact ? 'checked' : ''}></label>
        <label class="opt-row"><span><b>Hover tooltips</b><br><span class="muted small">Short explanations when you hover a label or button.</span></span><input type="checkbox" data-opt="tooltips" ${o.tooltips ? 'checked' : ''}></label>
        <label class="opt-row"><span><b>Animations</b><br><span class="muted small">Turn off to remove fades and sliding bars.</span></span><input type="checkbox" data-opt="motion" ${o.motion ? 'checked' : ''}></label>
        ${o.theme === 'tome' ? `<div class="opt-row"><span><b>Page turn</b><br><span class="muted small">Dusty tome only. Choose Light if page turns feel slow.</span></span><select data-opt="pageTurn">${[['full', 'Full (bending page)'], ['light', 'Light (flat page)'], ['off', 'Off']].map(([k, l]) => `<option value="${k}" ${o.pageTurn === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
        ${o.theme === 'tome' ? `<label class="opt-row"><span><b>Page turn sound</b><br><span class="muted small">A paper rustle when a page turns. Dusty tome only.</span></span><input type="checkbox" data-opt="pageSound" ${o.pageSound ? 'checked' : ''}></label>` : ''}
        <label class="opt-row"><span><b>Reopen the last character</b><br><span class="muted small">On start, open the character you used last instead of the character list.</span></span><input type="checkbox" data-opt="reopenLast" ${o.reopenLast ? 'checked' : ''}></label>
        <div class="opt-row"><b>Sheet tab to open first</b><select data-opt="startTab">${START_TABS.map(([k, l]) => `<option value="${k}" ${o.startTab === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="row end"><button class="btn ghost" data-changelog>What’s new</button><button class="btn ghost" data-reset>Reset to defaults</button></div>`;
    };
    const set = (k, v) => { current = sanitize({ ...current, [k]: v }); save(); applyOptions(); draw(); };
    body.onclick = e => {
      const b = e.target.closest('button[data-opt]');
      if (b) return set(b.dataset.opt, b.dataset.opt === 'textSize' ? +b.dataset.v : b.dataset.v);
      if (e.target.closest('[data-changelog]')) return showChangelog();
      if (e.target.closest('[data-reset]')) { current = sanitize(null); save(); applyOptions(); draw(); }
    };
    body.onchange = e => {
      const t = e.target.closest('[data-opt]');
      if (!t || t.tagName === 'BUTTON') return;
      set(t.dataset.opt, t.type === 'checkbox' ? t.checked : t.value);
    };
    draw();
  });
}

/** The "What’s new" window. */
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
  if (!current.pageSound) return;
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
    gain.gain.value = 0.55 + Math.random() * 0.2;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
  } catch { /* no audio available */ }
}

/** A copy of the page for the page turn, holding only the part that is on screen. null unless the tome theme and animations are on. */
export function snapshotPage(body) {
  if (current.theme !== 'tome' || !current.motion || current.pageTurn === 'off' || !body) return null;
  const clone = body.cloneNode(true);
  clone.dataset.h = body.offsetHeight;
  clone.removeAttribute('id');
  // Inner ids stay: the stylesheet styles some things by id (the health bar fill). The live page comes first in the document, so lookups still find it.
  pruneBelow(body, clone, window.innerHeight + 40);
  return clone;
}

/**
 * Tome theme: the old page (a snapshot) swings over from the spine like a sheet of loose paper, uncovering the new page underneath.
 * Going back a tab plays it in reverse: the new page swings back over the old one. The animation itself is CSS (see theme-tome.css).
 */
export function playPageTurn(body, snapshot, back = false) {
  if (!snapshot || !body?.parentElement) return;
  const STRIPS = current.pageTurn === 'light' ? 1 : 14; // 'light' is one flat sheet: much less to draw on a slow machine
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
