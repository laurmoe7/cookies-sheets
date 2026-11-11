// The paladin's mercies in lay on hands' side panel (mercyBlock) and the window to choose them (pickMercies). Rules in js/mercy.js.
import { MERCIES, MERCY_BY_NAME, mercyAllowance, canChoose, merciesOf, mercyLines, mercyProblems } from '../mercy.js';
import { esc, $, modal } from '../ui.js';

/** The Mercies rows of lay on hands' stat card: what each mercy the paladin has does, and the button that opens the chooser. */
export function mercyBlock(c, level) {
  const have = merciesOf(c);
  const allow = mercyAllowance(level, c);
  const fromNotes = !Array.isArray(c.mercies) && have.length;
  const problems = mercyProblems(have, level, c);
  return `<dl class="ss-rows mercy-rows"><dt>Mercies</dt><dd>
    ${have.length ? `<ul class="mercy-list">${mercyLines(have, level).map(m => `<li><b>${esc(m.name)}.</b> ${esc(m.text)}</li>`).join('')}</ul>`
      : '<span class="muted">None chosen yet.</span>'}
    <div class="row"><button class="btn small" data-mercy-pick>Choose mercies <span class="pill ${have.length < allow ? 'warn' : have.length > allow ? 'bad' : 'good'}">${have.length} / ${allow}</span></button>
      ${fromNotes ? '<span class="small muted">From your level-up notes.</span>' : ''}</div>
    ${problems.length ? `<p class="small warn">${problems.map(esc).join(' ')}</p>` : ''}
    <p class="small muted">They apply whenever lay on hands heals one target (not when it harms undead).</p></dd></dl>`;
}

/** Choose the mercies: chips by the level they open at, the ones not open yet greyed out. Saves to c.mercies; resolves true when saved. */
export function pickMercies(c, level) {
  let chosen = [...merciesOf(c)];
  const allow = mercyAllowance(level, c);
  return modal('Mercies', (body, close) => {
    const draw = () => {
      const levels = [...new Set(MERCIES.map(m => m.level))];
      const other = chosen.filter(n => !MERCY_BY_NAME[n]);
      body.innerHTML = `<p class="small muted">A paladin picks one mercy at 3rd level and every three levels after (plus one per Extra Mercy feat). Each one adds its effect whenever lay on hands heals a target.</p>
        <p><span class="pill ${chosen.length < allow ? 'warn' : chosen.length > allow ? 'bad' : 'good'}">${chosen.length} / ${allow} chosen</span></p>
        ${levels.map(l => `<h4>${l === 3 ? '3rd' : l + 'th'} level</h4><div class="chips">${MERCIES.filter(m => m.level === l).map(m => {
          const on = chosen.includes(m.name), ok = on || canChoose(m.name, level, chosen);
          const why = level < m.level ? `Opens at paladin level ${m.level}.` : m.needs && !chosen.includes(m.needs) ? `Needs the ${m.needs} mercy first.` : '';
          return `<button class="chip ${on ? 'on' : ''}" data-m="${esc(m.name)}" ${ok ? '' : 'disabled'} data-tip="${esc([m.text, why].filter(Boolean).join('\n'))}">${on ? '✓ ' : ''}${esc(m.name)}</button>`;
        }).join('')}</div>`).join('')}
        <h4>From another book</h4>
        <div class="chips">${other.map(n => `<button class="chip on" data-m="${esc(n)}" data-tip="Click to remove">✓ ${esc(n)}</button>`).join('')}</div>
        <div class="row"><input type="text" data-other placeholder="Mercy name, e.g. Injured" aria-label="Another mercy's name"><button class="btn small" data-add>Add</button></div>
        <div class="row end"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    };
    draw();
    body.onclick = e => {
      const t = e.target.closest('[data-m],[data-add],[data-save],[data-cancel]');
      if (!t) return;
      if (t.dataset.m !== undefined) {
        const n = t.dataset.m;
        // Taking a mercy away also takes the ones built on it (exhausted goes with fatigued).
        chosen = chosen.includes(n) ? chosen.filter(x => x !== n && MERCY_BY_NAME[x]?.needs !== n) : [...chosen, n];
        draw();
      } else if (t.dataset.add !== undefined) {
        const v = $('[data-other]', body).value.trim();
        const known = MERCIES.find(m => m.name.toLowerCase() === v.toLowerCase());
        if (v && !chosen.some(x => x.toLowerCase() === v.toLowerCase())) chosen.push(known ? known.name : v);
        draw();
      } else if (t.dataset.save !== undefined) {
        c.mercies = MERCIES.filter(m => chosen.includes(m.name)).map(m => m.name).concat(chosen.filter(n => !MERCY_BY_NAME[n]));
        close(true);
      } else close(false);
    };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('[data-other]')) $('[data-add]', body).click(); };
  });
}
