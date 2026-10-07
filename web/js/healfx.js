// The hit point bar's reaction to healing and damage. Heals glow green and swell, with a floating "+N" and sparkles;
// damage flashes red and shakes, with a falling "−N" and shards. The bigger the change (as a share of maximum HP),
// the stronger and longer the reaction. Works on any card that holds a `.hp-bar` (the character, companions, summons).

/**
 * @param {Element} scope An element containing the `.hp-bar` (and the fill, which is `#hp-fill` or the bar's first child).
 * @param {{amount: number, frac: number, from: number, kind?: 'heal'|'hurt'}} fx `from` is the fill's old size (0 to 1).
 */
export function hpFx(scope, { amount, frac, from, kind = 'heal' }) {
  const bar = scope?.querySelector('.hp-bar');
  const fill = bar && (bar.querySelector('#hp-fill') || bar.firstElementChild);
  if (!bar || !fill || !(amount > 0)) return;
  const hurt = kind === 'hurt';
  const f = Math.max(0.06, Math.min(1, frac));
  const ms = Math.round((hurt ? 400 : 500) + 1000 * f);
  const cls = hurt ? 'hurting' : 'healing';
  bar.style.setProperty('--fx', f.toFixed(2));
  bar.style.setProperty('--fx-ms', ms + 'ms');

  // the fill moves from where it was instead of jumping
  const target = fill.style.width;
  const end = Math.min(0.96, Math.max(0.02, parseFloat(target) / 100 || 0.5));
  fill.style.transition = 'none';
  fill.style.width = Math.max(0, Math.min(100, from * 100)) + '%';
  void fill.offsetWidth;
  fill.style.transition = `width ${ms}ms cubic-bezier(.2,.8,.2,1)`;
  fill.style.width = target;
  setTimeout(() => { fill.style.transition = ''; }, ms + 60);

  bar.classList.remove('healing', 'hurting');
  void bar.offsetWidth;
  bar.classList.add(cls);
  setTimeout(() => bar.classList.remove(cls), ms + 100);

  const host = bar.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const x = bar.offsetLeft + bar.offsetWidth * end;
  const pop = document.createElement('span');
  pop.className = hurt ? 'fx-pop hurt' : 'fx-pop heal';
  pop.textContent = (hurt ? '−' : '+') + amount;
  pop.style.fontSize = (15 + 17 * f).toFixed(0) + 'px';
  pop.style.left = x + 'px';
  pop.style.top = bar.offsetTop + 'px';
  host.appendChild(pop);
  setTimeout(() => pop.remove(), ms + 500);

  const n = Math.round(3 + 14 * f);
  const span = Math.abs(from - end);
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('i');
    sp.className = hurt ? 'fx-spark hurt' : 'fx-spark heal';
    // heal sparkles rise from the filled part; damage shards break off the part that was lost
    const at = hurt ? end + Math.random() * Math.max(0.04, span) : end - Math.random() * Math.max(0.05, f * 0.45);
    sp.style.left = bar.offsetLeft + bar.offsetWidth * Math.max(0, Math.min(1, at)) + 'px';
    sp.style.top = bar.offsetTop + bar.offsetHeight / 2 + 'px';
    sp.style.setProperty('--dx', ((Math.random() - 0.5) * (hurt ? 46 : 30)).toFixed(0) + 'px');
    sp.style.setProperty('--dy', (hurt ? 10 + Math.random() * (14 + 30 * f) : -(14 + Math.random() * (20 + 40 * f))).toFixed(0) + 'px');
    sp.style.animationDelay = (Math.random() * ms * 0.4).toFixed(0) + 'ms';
    host.appendChild(sp);
    setTimeout(() => sp.remove(), ms * 1.5 + 600);
  }
}

/** The Overview and lab callers use these names. */
export const healFx = (scope, fx) => hpFx(scope, { ...fx, kind: 'heal' });
export const hurtFx = (scope, fx) => hpFx(scope, { ...fx, kind: 'hurt' });
