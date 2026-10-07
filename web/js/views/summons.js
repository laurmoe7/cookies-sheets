// Summon Monster / Summon Nature's Ally helper: the "Summon…" button on the Spells tab opens the spell's creature
// list in the side panel; picking a creature shows its stat block there (← goes back to the list).
import { api } from '../api.js';
import { esc, showCustom, toast } from '../ui.js';
import { summonSpell, summonChoices, statBlockHtml } from '../summons.js';

let dataPromise = null;
const loadData = () => (dataPromise ||= api.summons().catch(e => { dataPromise = null; throw e; }));
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export async function showSummonList(spellName) {
  const spell = summonSpell(spellName);
  if (!spell) return;
  let data;
  try { data = await loadData(); } catch (e) { toast('Could not load summon lists: ' + e.message, 'err'); return; }
  const groups = summonChoices(data, spell.family, spell.level);
  const html = `<p class="small muted">Pick a creature to see its stat block. ${spell.family === 'Summon Monster'
    ? 'A * means it takes the celestial or fiendish template.' : 'Lasts 1 round per caster level.'}</p>` +
    groups.map(g => `<h4>${ORD[g.level]}-level list <span class="muted small">· summons ${g.count}</span></h4>
      <ul class="summon-list">${g.entries.map(e => `<li><a href="#" data-summon-creature="${esc(e.creature)}" data-summon-template="${e.template ? 1 : 0}" data-summon-label="${esc(e.name)}">${esc(e.name)}${e.template ? '*' : ''}</a>
        ${e.subtype ? `<span class="muted small">${esc(e.subtype)}</span>` : ''}</li>`).join('')}</ul>`).join('');
  showCustom({ name: spellName, cat: 'Summon list', sub: spell.family, html });
}

async function showCreature(key, template, label) {
  let data;
  try { data = await loadData(); } catch (e) { toast('Could not load summon lists: ' + e.message, 'err'); return; }
  const b = data.creatures[key];
  if (!b) return;
  showCustom({ name: label || b.name, cat: 'Summoned creature', sub: b.name === label ? '' : b.name, html: statBlockHtml(b, { template }) });
}

export function initSummons() {
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-summon]');
    if (open) { e.preventDefault(); showSummonList(open.dataset.summon); return; }
    const c = e.target.closest('[data-summon-creature]');
    if (c) { e.preventDefault(); showCreature(c.dataset.summonCreature, c.dataset.summonTemplate === '1', c.dataset.summonLabel); }
  });
}
