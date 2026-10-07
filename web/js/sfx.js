// Short sound effects for events (level up, full heal). Controlled by Options → Sound effects.
import { options } from './options.js';

const FILES = { levelUp: ['sounds/level-up.ogg', 0.6], heal: ['sounds/heal.ogg', 0.7] };

/** Plays a named effect once; silent when the option is off or the browser blocks audio. */
export function playSfx(name) {
  const f = FILES[name];
  if (!f || options().sfx === false) return;
  try {
    const a = new Audio(f[0]);
    a.volume = f[1];
    a.play().catch(() => { /* audio not allowed yet */ });
  } catch { /* no audio available */ }
}
