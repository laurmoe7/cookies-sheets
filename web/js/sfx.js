// Short sound effects for events (level up, heals, damage). Their loudness is the Options volume slider (0 is silent).
// Each effect has a pool of sounds and plays one of them at random: the built-in files (any of which can be switched off) plus any audio
// files the player added (Options -> Sound). Added files live on disk (served by /api/sound-file); `custom` lists them per effect, and the
// switched-off built-ins are in the option `soundOff`. An empty pool means the effect is silent.
import { volume, options } from './options.js';
import { api } from './api.js';

export const SOUND_CATS = [['levelUp', 'Level up'], ['heal', 'Heal'], ['fullHeal', 'Full heal'], ['hit', 'Damage']];
const BUILT_IN = {
  levelUp: ['sounds/level-up.ogg'],
  heal: ['sounds/heal.ogg'],
  fullHeal: ['sounds/full-heal.ogg'],
  hit: ['sounds/hit-1.mp3', 'sounds/hit-2.ogg', 'sounds/hit-3.ogg', 'sounds/hit-4.ogg'],
};
const BUILT_IN_GAIN = 0.65; // the built-in files are levelled to this; added files play at the slider's level

let custom = {}; // {effect: [{id, label}]}

/**
 * Every sound an effect has: the built-ins first, then the player's own. `enabled` is false for a built-in that was switched off.
 * Pure: pass the custom list and the soundOff option.
 */
export function soundItems(name, customList = {}, off = {}) {
  const built = BUILT_IN[name] || [];
  const out = built.map((path, i) => ({ kind: 'default', ref: path, label: built.length > 1 ? `Built-in ${i + 1}` : 'Built-in', enabled: !(off[name] || []).includes(path) }));
  for (const c of customList[name] || []) out.push({ kind: 'custom', ref: c.id, label: c.label, enabled: true });
  return out;
}

/** True when an effect has been changed from its factory sounds. */
export const isCustomized = (name, customList = {}, off = {}) => soundItems(name, customList, off).some(s => s.kind === 'custom' || !s.enabled);

/** Asks the app which custom files exist. Returns {effect: [{id, label}]}; safe to call any time. */
export async function refreshSounds() {
  try { custom = await api.sounds(); } catch { custom = {}; }
  return custom;
}
export const customSounds = () => custom;

function play(item, name) {
  if (volume() === 0) return;
  try {
    const a = item.kind === 'custom' ? new Audio(api.soundUrl(name, item.ref)) : new Audio(item.ref);
    a.volume = item.kind === 'custom' ? volume() : Math.min(1, BUILT_IN_GAIN * volume());
    a.play().catch(() => { /* audio not allowed yet */ });
  } catch { /* no audio available */ }
}

/** Plays one sound from an effect's pool at random; silent at volume 0, when the pool is empty, or when the browser blocks audio. */
export function playSfx(name) {
  const pool = soundItems(name, custom, options().soundOff).filter(s => s.enabled);
  if (pool.length) play(pool[Math.floor(Math.random() * pool.length)], name);
}

/** Plays one particular sound (the Play button beside it in Options), whether or not it is switched off. */
export function previewSound(name, kind, ref) {
  const item = soundItems(name, custom, options().soundOff).find(s => s.kind === kind && s.ref === ref);
  if (item) play(item, name);
}
