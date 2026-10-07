// The hit point bar's reaction to healing: a green glow and a swell, a number floating up, and sparkles.
// The bigger the heal (as a share of maximum HP), the stronger and longer the reaction.

/** @param {Element} card The Overview HP card. @param {{amount: number, frac: number, from: number}} fx */
export function healFx(card, { amount, frac, from }) {
  const bar = card?.querySelector('.hp-bar');
  const fill = card?.querySelector('#hp-fill');
  if (!bar || !fill || !(amount > 0)) return;
  const f = Math.max(0.06, Math.min(1, frac));
  const ms = Math.round(500 + 1100 * f);
  bar.style.setProperty('--heal', f.toFixed(2));
  bar.style.setProperty('--heal-ms', ms + 'ms');

  // the fill grows from where it was instead of jumping
  const target = fill.style.width;
  const end = Math.min(0.96, parseFloat(target) / 100 || 0.5);
  fill.style.transition = 'none';
  fill.style.width = Math.max(0, Math.min(100, from * 100)) + '%';
  void fill.offsetWidth;
  fill.style.transition = `width ${ms}ms cubic-bezier(.2,.8,.2,1)`;
  fill.style.width = target;
  setTimeout(() => { fill.style.transition = ''; }, ms + 60);

  bar.classList.remove('healing');
  void bar.offsetWidth;
  bar.classList.add('healing');
  setTimeout(() => bar.classList.remove('healing'), ms + 100);

  const host = bar.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const pop = document.createElement('span');
  pop.className = 'heal-pop';
  pop.textContent = '+' + amount;
  pop.style.fontSize = (15 + 17 * f).toFixed(0) + 'px';
  pop.style.left = bar.offsetLeft + bar.offsetWidth * end + 'px';
  pop.style.top = bar.offsetTop + 'px';
  host.appendChild(pop);
  setTimeout(() => pop.remove(), ms + 500);

  const n = Math.round(3 + 14 * f);
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('i');
    sp.className = 'heal-spark';
    sp.style.left = bar.offsetLeft + bar.offsetWidth * (end - Math.random() * Math.max(0.05, f * 0.45)) + 'px';
    sp.style.top = bar.offsetTop + bar.offsetHeight / 2 + 'px';
    sp.style.setProperty('--dx', ((Math.random() - 0.5) * 30).toFixed(0) + 'px');
    sp.style.setProperty('--dy', -(14 + Math.random() * (20 + 40 * f)).toFixed(0) + 'px');
    sp.style.animationDelay = (Math.random() * ms * 0.5).toFixed(0) + 'ms';
    host.appendChild(sp);
    setTimeout(() => sp.remove(), ms * 1.5 + 600);
  }
}
