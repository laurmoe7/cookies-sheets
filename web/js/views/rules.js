import { state } from '../app.js';
import { carryingCapacity, SIZES } from '../data.js';
import { sign } from '../calc.js';
import { esc, $, $$ } from '../ui.js';
import { RULE_CARDS, RULE_CATS, CONDITIONS } from '../rulesdata.js';

const st = { q: '', cat: '' };

export function renderRules(main) {
  const d = state.derived;
  const conc = d ? Object.values(d.spellcasting)[0]?.concentration : undefined;
  main.innerHTML = `<div class="page">
    <div class="row"><h1 class="grow">Quick Rules</h1>
      <input id="rules-q" class="search w20" placeholder="Filter: grapple, touch, concentration…" value="${esc(st.q)}"></div>
    <div class="chips">${['', ...RULE_CATS].map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-rcat="${c}">${c || 'All'}</button>`).join('')}</div>
    <section class="card"><h3>Conditions <span class="muted small">click for full text</span></h3>
      <div class="chips">${CONDITIONS.map(c => `<a href="#" class="chip" data-entry="${c}" data-cat="Condition">${c}</a>`).join('')}</div></section>
    <div class="grid rules-grid" id="rule-cards"></div>
    <div class="grid two">
      <section class="card"><h3>Concentration check helper</h3>
        <div class="kv"><label>Your bonus <input id="cc-bonus" type="number" class="num w3" value="${conc ?? 5}"></label>
          <label>Spell level <input id="cc-sl" type="number" class="num w2" value="1" min="0" max="9"></label>
          <label>Damage taken <input id="cc-dmg" type="number" class="num w3" value="0"></label></div>
        <div id="cc-out"></div></section>
      <section class="card"><h3>Carrying capacity</h3>
        <div class="kv"><label>Strength <input id="cap-str" type="number" class="num w3" value="${d ? d.abilities.str.score : 10}"></label>
          <label>Size <select id="cap-size">${Object.keys(SIZES).map(s => `<option ${s === (d?.size || 'Medium') ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
        <div id="cap-out"></div></section>
    </div>
  </div>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    const cards = RULE_CARDS.filter(c => (!st.cat || c.cat === st.cat) && (!q || (c.title + ' ' + c.tags + ' ' + c.body).toLowerCase().includes(q)));
    $('#rule-cards', main).innerHTML = cards.map(c => `<section class="card rule-card">
      <div class="eyebrow">${c.cat}</div><h3>${esc(c.title)}</h3><div class="rule-body">${c.body}</div>
      ${c.see.length ? `<div class="see small">Full rules: ${c.see.map(([n, cat]) => `<a href="#" class="ref" data-entry="${esc(n)}" data-cat="${cat}">${esc(n)}</a>`).join(' · ')}</div>` : ''}
    </section>`).join('') || '<p class="muted pad">No quick-reference card matches. Try the Compendium for the full rules text.</p>';
  };
  draw();
  $('#rules-q', main).oninput = e => { st.q = e.target.value; draw(); };
  $$('[data-rcat]', main).forEach(b => (b.onclick = () => { st.cat = b.dataset.rcat; renderRules(main); }));

  const cc = () => {
    const b = +$('#cc-bonus', main).value || 0, sl = +$('#cc-sl', main).value || 0, dmg = +$('#cc-dmg', main).value || 0;
    const rows = [['Cast defensively', 15 + 2 * sl], ['Hit while casting', 10 + dmg + sl], ['Entangled', 15 + sl], ['Vigorous motion', 10 + sl], ['Violent motion', 15 + sl]];
    $('#cc-out', main).innerHTML = `<table class="tbl mini"><tr><th>Situation</th><th>DC</th><th>Need on d20</th><th>Chance</th></tr>${rows.map(([n, dc]) => {
      const need = Math.max(1, dc - b);
      const pct = need > 20 ? 0 : Math.round((21 - Math.max(need, 1)) / 20 * 100);
      return `<tr><td>${n}</td><td>${dc}</td><td>${need > 20 ? '—' : need + '+'}</td><td class="${pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad'}">${pct}%</td></tr>`;
    }).join('')}</table><p class="small muted">Bonus ${sign(b)} = caster level + casting ability modifier (+4 Combat Casting when defensive).</p>`;
  };
  ['cc-bonus', 'cc-sl', 'cc-dmg'].forEach(id => ($('#' + id, main).oninput = cc));
  cc();
  const cap = () => {
    const r = carryingCapacity(+$('#cap-str', main).value || 0, $('#cap-size', main).value);
    $('#cap-out', main).innerHTML = `<table class="tbl mini"><tr><th>Light</th><th>Medium</th><th>Heavy</th><th>Lift overhead</th><th>Lift off ground</th><th>Push/drag</th></tr>
      <tr><td>≤ ${r.light} lb</td><td>${r.light + 1}–${r.medium}</td><td>${r.medium + 1}–${r.heavy}</td><td>${r.heavy}</td><td>${r.heavy * 2}</td><td>${r.heavy * 5}</td></tr></table>`;
  };
  $('#cap-str', main).oninput = cap; $('#cap-size', main).onchange = cap;
  cap();
}
