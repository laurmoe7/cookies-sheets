// Short sound effects for events (level up, heals, damage). Controlled by Options → Sound effects.
// An effect with several files plays one of them at random.
import { options } from './options.js';

const FILES = {
  levelUp: [['sounds/level-up.ogg'], 0.65],
  heal: [['sounds/heal.ogg'], 0.65],
  fullHeal: [['sounds/full-heal.ogg'], 0.65],
  hit: [['sounds/hit-1.mp3', 'sounds/hit-2.ogg', 'sounds/hit-3.ogg', 'sounds/hit-4.ogg'], 0.65],
};

/** Plays a named effect once; silent when the option is off or the browser blocks audio. */
export function playSfx(name) {
  const f = FILES[name];
  if (!f || options().sfx === false) return;
  try {
    const list = f[0];
    const a = new Audio(list[Math.floor(Math.random() * list.length)]);
    a.volume = f[1];
    a.play().catch(() => { /* audio not allowed yet */ });
  } catch { /* no audio available */ }
}
