// The paper doll card at the top of the Inventory tab: slots around a figure, each showing what is worn there.
import { state, changed } from '../app.js';
import { SLOTS, SLOT_BY_ID, LAYOUT, slotName, wornBySlot, candidates, wear, takeOff } from '../paperdoll.js';
import { armorFx } from '../armorfx.js';
import { effectsText } from '../itemfx.js';
import { esc, modal, showEntry } from '../ui.js';
import { choosePicture, repositionPicture } from '../cropper.js';

const sign = n => (n >= 0 ? '+' : '') + n;

/** What a worn item is, in short: its name, a line of numbers, whether it is enchanted, and a longer hover text. */
function describe(c, d, o) {
  if (o.kind === 'armor') {
    const a = c.armor[o.i], fx = armorFx(a), ac = (+a.bonus || 0) + (+a.enh || 0);
    const sub = `AC ${sign(ac)}${fx.summary ? ' · ' + fx.summary : ''}`;
    return { name: a.name || (a.type === 'shield' ? 'Shield' : 'Armor'), sub, magic: (+a.enh || 0) > 0 || !!fx.summary, tip: `${a.name || 'Armor'}: ${sub}` };
  }
  if (o.kind === 'weapon') {
    const w = c.weapons[o.i], dw = d.weapons[o.i] || {};
    const sub = `${dw.attackText || ''} · ${dw.damageText || ''}`;
    return { name: w.name || 'Weapon', sub, magic: !!dw.fxSummary || (+w.enh || 0) > 0, tip: `${w.name || 'Weapon'}: attack ${dw.attackText}, damage ${dw.damageText}${dw.crit ? ', crit ' + dw.crit : ''}${dw.fxSummary ? '\n' + dw.fxSummary : ''}` };
  }
  const g = c.gear[o.i];
  const note = String(g.notes || '').replace(/\s+/g, ' ').trim();
  const fx = effectsText(g.effects);
  return { name: g.name || 'Item', sub: fx || note.slice(0, 40) || g.value || '', magic: !!g.id || !!fx, tip: `${g.name || 'Item'}${g.value ? ' (' + g.value + ')' : ''}${fx ? '\n' + fx : ''}${note ? '\n' + note : ''}` };
}

function tile(c, d, id, worn) {
  const slot = SLOT_BY_ID[id], list = worn[id] || [], first = list[0];
  const it = first && describe(c, d, first);
  const clash = list.length > 1 ? `<i class="ds-clash" title="${list.length} items are set to this slot. Only the first is shown.">!</i>` : '';
  return `<button class="doll-slot ${it ? 'full' : ''} ${it?.magic ? 'magic' : ''}" data-doll="${id}" title="${esc(it ? it.tip + '\nClick to change or take off' : slot.label + ': empty. Click to choose what to wear')}">
    <span class="ds-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${slot.icon}</svg></span>
    <span class="ds-txt"><span class="ds-lab">${esc(slot.label)}</span>${it ? `<b class="ds-name">${esc(it.name)}</b><span class="ds-sub">${esc(it.sub)}</span>` : '<span class="ds-empty">empty</span>'}</span>${clash}</button>`;
}

/** The card's HTML. `d` is the computed sheet. */
export function paperDollCard(c, d) {
  const worn = wornBySlot(c), t = id => tile(c, d, id, worn);
  const pic = c.doll || c.portrait || c.avatar;
  const fig = pic
    ? `<div class="doll-fig"><img src="${pic}" alt=""><div class="portrait-tools"><button class="icon-btn" data-doll-img title="${c.doll ? 'Change picture' : 'Choose a picture of its own (your portrait is shown until you do)'}">✎</button>${c.doll ? '<button class="icon-btn" data-doll-edit title="Recenter or resize">⤢</button><button class="icon-btn" data-doll-clear title="Remove picture (your portrait is shown instead)">✕</button>' : ''}</div></div>`
    : '<button class="doll-fig empty" data-doll-img title="Add a picture for the paper doll">＋ Add a picture</button>';
  const total = Object.values(worn).reduce((n, l) => n + l.length, 0);
  return `<section class="card span2 doll-card">
    <div class="row"><h3 class="grow">Equipment</h3><span class="small muted">${total} slot${total === 1 ? '' : 's'} filled of ${SLOTS.length}</span></div>
    <div class="doll">
      <div class="doll-col">${LAYOUT.left.map(t).join('')}</div>
      <div class="doll-mid">${fig}
        <div class="doll-stats small"><span title="Armor Class">AC <b>${d.ac.total}</b></span><span title="Touch AC">touch <b>${d.ac.touch}</b></span><span title="Flat-footed AC">flat <b>${d.ac.flat}</b></span><span title="Armor check penalty">ACP <b>${d.acp}</b></span>${d.asf ? `<span title="Arcane spell failure">ASF <b>${d.asf}%</b></span>` : ''}</div></div>
      <div class="doll-col">${LAYOUT.right.map(t).join('')}</div>
    </div>
    <div class="doll-row">${LAYOUT.bottom.map(t).join('')}</div>
    <p class="small muted">Click a slot to wear something there. Armor and shields use their Worn tick below, weapons and carried items are picked here. A magic item added from the compendium shows up under the slot it fits.</p>
  </section>`;
}

/** Clicking a slot: see what is there and what could go there. */
export function wirePaperDoll(body) {
  body.addEventListener('click', e => {
    const pic = e.target.closest('[data-doll-img],[data-doll-edit],[data-doll-clear]');
    if (pic) { e.preventDefault(); pictureAction(pic.dataset); return; }
    const t = e.target.closest('[data-doll]');
    if (t) { e.preventDefault(); openSlot(t.dataset.doll); }
  });
}

function openSlot(id) {
  const c = state.char;
  modal(slotName(id), (body, close) => {
    const draw = () => {
      const d = state.derived, now = (wornBySlot(c)[id] || [])[0], cand = candidates(c, id);
      const row = (o, label) => `<div class="pick-row"><div><b>${esc(o.name)}</b></div><div class="muted small">${esc(describe(c, d, o).sub)}</div><button class="btn small primary" data-wear="${o.kind}:${o.i}">${label}</button></div>`;
      body.innerHTML = `${now ? `<div class="doll-now"><div><div class="small muted">Wearing</div><b>${esc(describe(c, d, now).name)}</b> <span class="muted small">${esc(describe(c, d, now).sub)}</span></div>
          <div class="row" style="gap:6px">${now.kind === 'gear' && c.gear[now.i].id ? '<button class="btn small" data-read>Read it</button>' : ''}<button class="btn small danger" data-off>Take off</button></div></div>` : ''}
        ${cand.good.length ? `<h4 style="margin:10px 0 4px">${now ? 'Swap for' : 'Wear'}</h4>${cand.good.map(o => row(o, 'Wear')).join('')}` : ''}
        ${cand.other.length ? `<h4 style="margin:10px 0 4px">${cand.good.length ? 'Other things you carry' : (now ? 'Swap for' : 'Wear')}</h4>${cand.other.map(o => row(o, 'Wear')).join('')}` : ''}
        ${!now && !cand.good.length && !cand.other.length ? '<p class="muted">Nothing to put here yet. Add armor, weapons or items first (a magic item from the compendium that fits this slot is offered here).</p>' : ''}`;
    };
    draw();
    body.addEventListener('click', e => {
      const w = e.target.closest('[data-wear]'), off = e.target.closest('[data-off]'), read = e.target.closest('[data-read]');
      if (w) { const [kind, i] = w.dataset.wear.split(':'); wear(c, id, kind, +i); }
      else if (off) { const now = (wornBySlot(c)[id] || [])[0]; if (now) takeOff(c, now.kind, now.i); }
      else if (read) { const now = (wornBySlot(c)[id] || [])[0]; close(); if (now) showEntry(c.gear[now.i].id); return; }
      else return;
      changed({ rerender: true });
      close();
    });
  });
}

const PIC = { w: 3, h: 4, out: 800 };

/** The picture tools, the same three as on the portrait: change it, recenter or resize it, remove it (the portrait shows instead). */
async function pictureAction(ds) {
  const c = state.char;
  if ('dollImg' in ds) { const r = await choosePicture(PIC); if (r) { c.doll = r.image; c.dollSrc = r.src; changed({ rerender: true }); } }
  else if ('dollEdit' in ds) { const r = await repositionPicture(c.dollSrc || c.doll, PIC); if (r) { c.doll = r.image; changed({ rerender: true }); } }
  else { c.doll = ''; c.dollSrc = ''; changed({ rerender: true }); }
}
