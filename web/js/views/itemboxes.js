// Asks about bonuses counted twice: a worn item's bonus that is also typed in one of the sheet's boxes (an imported character's save Misc holding
// its cloak of resistance, say). Shown when a character opens and when something is put on.
import { state, changed } from '../app.js';
import { boxDuplicates, removeFromBoxes, duplicateText } from '../itemfx.js';
import { esc, modal, toast } from '../ui.js';

export function checkItemBoxes() {
  const c = state.char;
  const dups = c ? boxDuplicates(c) : [];
  if (!dups.length) return;
  modal('Counted twice?', (body, close) => {
    body.innerHTML = `<p>Worn items add their bonuses by themselves now, and these look like they are also typed in the sheet's boxes:</p>
      <ul>${dups.map(d => `<li>${esc(duplicateText(d))}</li>`).join('')}</ul>
      <p class="muted small">Take them out of the boxes unless the box is for something else that happens to be the same size.</p>
      <div class="row end"><button class="btn" data-keep>Keep both</button><button class="btn primary" data-fix>Take them out of the boxes</button></div>`;
    body.querySelector('[data-fix]').onclick = () => {
      for (const d of dups) removeFromBoxes(c, d);
      close();
      changed({ rerender: true });
      toast(`Fixed: ${dups.map(d => d.item).join(', ')} now count once`, 'good');
    };
    body.querySelector('[data-keep]').onclick = () => {
      c.itemBoxKeep = [...new Set([...(c.itemBoxKeep || []), ...dups.map(d => d.key)])]; // not asked again for these
      close();
      changed();
    };
  });
}
