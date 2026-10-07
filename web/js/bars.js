// How many segments a hit point bar is drawn with: enough to read at a glance, never one per hit point. Pure, no DOM.

/** 4 to 10 segments, growing with the hit point total (about one per 8 hit points). */
export function hpSegments(max) {
  const m = Math.max(1, Math.round(Number(max) || 1));
  return Math.min(10, Math.max(4, Math.round(m / 8)));
}
