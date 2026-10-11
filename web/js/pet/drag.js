// Dragging Cookie out of the sidebar, and keeping his speech bubble on screen wherever he ends up.
// Drag him by his body; drop him over the sidebar to put him back. His spot is remembered (localStorage.cookiePos).
// `clampPos` and `bubbleSpot` are pure (tested); the rest touches the DOM.

const KEY = 'cookiePos';
const DRAG_PX = 5; // a press that moves less than this is still a poke

/** Keeps a box of w x h with its top-left at (x, y) fully inside a view of vw x vh. */
export function clampPos(x, y, w, h, vw, vh) {
  return { x: Math.round(Math.max(0, Math.min(x, Math.max(0, vw - w)))), y: Math.round(Math.max(0, Math.min(y, Math.max(0, vh - h)))) };
}

/**
 * Where the speech bubble goes, relative to Cookie's box, so it stays inside the view.
 * `s` is Cookie's box on screen {left, top}; `b` the bubble's {w, h}; `cs` his size factor.
 * Prefers the usual spot (right of his beak, above it) and flips to the left and/or below when there is no room.
 */
export function bubbleSpot(s, b, cs, vw, vh, margin = 8) {
  const beakX = 2 + 142 * cs, beakY = 92 * cs, petH = 140 * cs;
  let left = beakX, side = 'right';
  if (s.left + left + b.w > vw - margin) {
    const alt = 2 + 8 * cs - b.w; // its right edge by his cheek
    if (s.left + alt >= margin) { left = alt; side = 'left'; } else left = Math.min(left, Math.max(vw - margin - b.w - s.left, margin - s.left));
  }
  let top = beakY, above = true;
  if (s.top + beakY - b.h < margin) {
    const below = petH + 6;
    if (s.top + below + b.h <= vh - margin) { top = below; above = false; } else top = Math.max(top, margin - s.top + b.h);
  }
  return { left: Math.round(left), top: Math.round(top), side, above };
}

let slot, pet, bubble, drag = null, suppressUntil = 0;

const size = () => { const r = slot.getBoundingClientRect(); return { w: r.width, h: r.height }; };
const factor = () => parseFloat(getComputedStyle(slot).getPropertyValue('--cs')) || 1.25;

/** Puts the speech bubble where it stays visible. Call after showing it, and whenever Cookie or the window moves. */
export function placeBubble() {
  if (!bubble || bubble.hidden) return;
  const s = slot.getBoundingClientRect();
  const p = bubbleSpot({ left: s.left, top: s.top }, { w: bubble.offsetWidth, h: bubble.offsetHeight }, factor(), innerWidth, innerHeight);
  bubble.style.left = p.left + 'px';
  bubble.style.top = p.top + 'px';
  bubble.style.setProperty('--ty', p.above ? '-100%' : '0');
  bubble.classList.toggle('left', p.side === 'left');
  bubble.classList.toggle('below', !p.above);
}

const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && isFinite(v.x) && isFinite(v.y) ? v : null; } catch { return null; } };
const write = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage may be unavailable */ } };

function put(x, y) {
  const { w, h } = size();
  const p = clampPos(x, y, w, h, innerWidth, innerHeight);
  slot.style.left = p.x + 'px';
  slot.style.top = p.y + 'px';
  placeBubble();
  return p;
}

function float(x, y) { slot.classList.add('floating'); return put(x, y); }

function dock() {
  slot.classList.remove('floating', 'dragging');
  slot.style.left = slot.style.top = '';
  write(null);
  placeBubble();
}

/** @param hooks {onDrop(), onDock()} called when he is put down somewhere new / back in the sidebar. */
export function initDrag(slotEl, petEl, bubbleEl, hooks = {}) {
  slot = slotEl; pet = petEl; bubble = bubbleEl;
  const saved = read();
  if (saved) float(saved.x, saved.y);
  addEventListener('resize', () => { if (slot.classList.contains('floating')) { const r = slot.getBoundingClientRect(); write(put(r.left, r.top)); } else placeBubble(); });

  pet.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = slot.getBoundingClientRect();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    pet.setPointerCapture(e.pointerId);
  });
  pet.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      drag.moved = true;
      slot.classList.add('dragging');
      float(drag.ox, drag.oy);
    }
    put(drag.ox + dx, drag.oy + dy);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    suppressUntil = Date.now() + 250; // the click that follows a drop is not a poke
    slot.classList.remove('dragging');
    const nav = document.getElementById('nav')?.getBoundingClientRect();
    const over = nav && e.clientX >= nav.left && e.clientX <= nav.right && e.clientY >= nav.top && e.clientY <= nav.bottom;
    if (over) { dock(); hooks.onDock?.(); return; }
    const r = slot.getBoundingClientRect();
    write({ x: Math.round(r.left), y: Math.round(r.top) });
    hooks.onDrop?.();
  };
  pet.addEventListener('pointerup', end);
  pet.addEventListener('pointercancel', end);
  return { justDragged: () => Date.now() < suppressUntil, place: placeBubble };
}
