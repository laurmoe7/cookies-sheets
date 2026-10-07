// DEVELOPER TOOL (author only). Not part of the build or the zip: build_exe.ps1 leaves web/dev out, and the
// Options button that opens this only appears when this file exists.
// A floating panel for trying out animations and sounds on the real page while you look at them.
import { IDLE_NAMES, idleMove, sayLine, FACES, face, move } from '../js/pet/pet.js';
import { LINES } from '../js/pet/lines.js';
import { healFx } from '../js/healfx.js';
import { playSfx } from '../js/sfx.js';
import { snapshotPage, playPageTurn, options } from '../js/options.js';
import { toast } from '../js/ui.js';

const MOVES = ['hop', 'hopsmall', 'hophop', 'wiggle', 'bob', 'peek', 'shuffle', 'sniff', 'rock', 'rocksmall', 'roly', 'sit', 'stroll', 'waddle', 'twirl', 'boogie'];
const HEALS = [['Tiny', 0.05], ['Small', 0.15], ['Medium', 0.35], ['Large', 0.6], ['Full', 1]];

const btn = (label, attrs) => `<button class="btn small ghost" ${attrs}>${label}</button>`;
const group = (title, inner) => `<fieldset class="lab-group"><legend>${title}</legend><div class="lab-btns">${inner}</div></fieldset>`;

export function showAnimLab() {
  document.getElementById('anim-lab')?.remove();
  const el = document.createElement('div');
  el.id = 'anim-lab';
  el.innerHTML = `<header><b>Animation lab</b><span class="muted small">developer tool</span><button class="icon-btn" data-x aria-label="Close">✕</button></header>
    <div class="lab-body">
      ${group('Cookie: idle moves', IDLE_NAMES.map((n, i) => btn(n, `data-idle="${i}"`)).join(''))}
      ${group('Cookie: faces', Object.keys(FACES).map(k => btn(k, `data-face="${k}"`)).join(''))}
      ${group('Cookie: body moves', MOVES.map(m => btn(m, `data-move="${m}"`)).join(''))}
      ${group('Cookie: says (any event)', Object.keys(LINES).map(k => btn(k, `data-say="${k}"`)).join(''))}
      ${group('HP bar heal (open the Overview tab)', HEALS.map(([l, f]) => btn(l, `data-heal="${f}"`)).join(''))}
      ${group('Sounds', btn('Level up', 'data-sfx="levelUp"') + btn('Heal', 'data-sfx="heal"'))}
      ${group('Page turn (Dusty tome)', btn('Forward', 'data-turn="fwd"') + btn('Back', 'data-turn="back"'))}
      ${group('Toasts', btn('Good', 'data-toast="good"') + btn('Error', 'data-toast="err"') + btn('Plain', 'data-toast=""'))}
    </div>`;
  document.body.appendChild(el);
  styleOnce();

  // drag by the header
  const head = el.querySelector('header');
  head.onpointerdown = e => {
    if (e.target.closest('button')) return;
    const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    head.onpointermove = m => { el.style.left = Math.max(0, m.clientX - dx) + 'px'; el.style.top = Math.max(0, m.clientY - dy) + 'px'; el.style.right = 'auto'; };
    head.onpointerup = () => { head.onpointermove = null; };
  };

  el.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (b.hasAttribute('data-x')) return el.remove();
    if (d.idle !== undefined) idleMove(+d.idle);
    else if (d.face) face(d.face, 2500);
    else if (d.move) move(d.move, 1800);
    else if (d.say) sayLine(d.say);
    else if (d.heal) lab.heal(+d.heal);
    else if (d.sfx) playSfx(d.sfx);
    else if (d.turn) lab.turn(d.turn === 'back');
    else if (d.toast !== undefined) toast('This is a test message', d.toast || undefined);
  };
}

const lab = {
  heal(f) {
    const card = document.querySelector('.card.hp');
    if (!card) return toast('Open a character’s Overview tab first', 'err');
    healFx(card, { amount: Math.max(1, Math.round(f * 40)), frac: f, from: Math.max(0, 0.9 - f) });
  },
  turn(back) {
    const body = document.getElementById('tab-body');
    if (!body) return toast('Open a character’s sheet first', 'err');
    const snap = snapshotPage(body);
    if (!snap) return toast(options().theme === 'tome' ? 'Page turn is Off or animations are off in Options' : 'Switch to the Dusty tome theme first', 'err');
    playPageTurn(body, snap, back);
  },
};

function styleOnce() {
  if (document.getElementById('anim-lab-style')) return;
  const s = document.createElement('style');
  s.id = 'anim-lab-style';
  s.textContent = `#anim-lab { position: fixed; top: 70px; right: 16px; width: 360px; max-height: calc(100vh - 100px); z-index: 70; display: flex; flex-direction: column;
      background: var(--panel); color: var(--ink); border: 2px solid var(--gold, #c9a24a); border-radius: 10px; box-shadow: 0 10px 34px rgba(0, 0, 0, .55); font-size: 13px; }
    #anim-lab header { display: flex; gap: 8px; align-items: center; padding: 8px 10px; cursor: move; border-bottom: 1px solid var(--line); }
    #anim-lab header .icon-btn { margin-left: auto; }
    #anim-lab .lab-body { overflow: auto; padding: 8px 10px 12px; }
    #anim-lab .lab-group { border: 1px solid var(--line); border-radius: 8px; margin: 0 0 8px; padding: 4px 8px 8px; }
    #anim-lab legend { padding: 0 6px; color: var(--muted); font-size: 12px; }
    #anim-lab .lab-btns { display: flex; flex-wrap: wrap; gap: 4px; }`;
  document.head.appendChild(s);
}
