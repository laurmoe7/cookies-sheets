// Summon Monster / Summon Nature's Ally: which creatures a spell offers, and a stat block to read.
// Data comes from data/summons.json (built by tools/summons.py). Pure functions, no DOM.

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 'Summon Monster IV' -> {family: 'Summon Monster', level: 4}; anything else -> null. */
export function summonSpell(name) {
  const m = /^Summon (Monster|Nature['’]s Ally) (IX|VIII|VII|VI|IV|V|III|II|I)$/i.exec(String(name || '').trim());
  if (!m) return null;
  return { family: /monster/i.test(m[1]) ? 'Summon Monster' : "Summon Nature's Ally", level: ROMAN[m[2].toUpperCase()] };
}

/**
 * The lists a spell of this level can draw from: one creature from its own list, 1d3 from the list one level
 * below, or 1d4+1 from the list two levels below.
 */
export function summonChoices(data, family, level) {
  const all = data.families[family] || [];
  return [[level, '1 creature'], [level - 1, '1d3 creatures'], [level - 2, '1d4+1 creatures']]
    .filter(([l]) => l >= 1)
    .map(([l, count]) => ({ level: l, count, entries: all.filter(e => e.level === l) }))
    .filter(g => g.entries.length);
}

const hitDice = block => {
  const m = /\((\d+)d\d+/.exec(block.hp || '');
  return m ? +m[1] : 1;
};

/** Celestial / fiendish template benefits for a creature with this many Hit Dice (Bestiary template rules). */
export function templateNotes(hd) {
  const resist = hd >= 11 ? 15 : hd >= 5 ? 10 : 5;
  const dr = hd >= 11 ? '10' : hd >= 5 ? '5' : '';
  return {
    celestial: `Celestial: darkvision 60 ft., resist acid ${resist}, cold ${resist}, electricity ${resist}${dr ? `, DR ${dr}/evil` : ''}; smite evil once per day (+Cha bonus on attack, +${hd} damage vs. evil).`,
    fiendish: `Fiendish: darkvision 60 ft., resist cold ${resist}, fire ${resist}${dr ? `, DR ${dr}/good` : ''}; smite good once per day (+Cha bonus on attack, +${hd} damage vs. good).`,
  };
}

const row = (label, v) => (v ? `<p><b>${label}</b> ${esc(v)}</p>` : '');

/** A Pathfinder-style stat block as HTML. `template` is true when the entry takes the celestial/fiendish template. */
export function statBlockHtml(b, { template = false } = {}) {
  const type = [b.size, (b.creature_type || '').toLowerCase()].filter(Boolean).join(' ') + (b.creature_subtype ? ` (${b.creature_subtype})` : '');
  const abil = [['Str', 'strength'], ['Dex', 'dexterity'], ['Con', 'constitution'], ['Int', 'intelligence'], ['Wis', 'wisdom'], ['Cha', 'charisma']]
    .map(([a, k]) => `${a} ${b[k] || '—'}`).join(', ');
  const defense = [b.defensive_abilities, b.dr && `DR ${b.dr}`, b.immune && `Immune ${b.immune}`, b.resist && `Resist ${b.resist}`, b.sr && `SR ${b.sr}`].filter(Boolean).join('; ');
  const tpl = template ? templateNotes(hitDice(b)) : null;
  return `<div class="statblock summon-block">
    <p class="muted small">${esc(b.alignment || '')} ${esc(type)} · CR ${esc(b.cr || '—')}${b.source ? ' · ' + esc(b.source) : ''}</p>
    <p><b>Init</b> ${esc(b.init || '—')}; <b>Senses</b> ${esc(b.senses || '—')}</p>
    <h4>Defense</h4>
    <p><b>AC</b> ${esc(b.ac || '—')}</p>
    <p><b>hp</b> ${esc(b.hp || '—')}</p>
    <p><b>Fort</b> ${esc(b.fortitude || '—')}, <b>Ref</b> ${esc(b.reflex || '—')}, <b>Will</b> ${esc(b.will || '—')}</p>
    ${row('Defensive', defense)}${row('Weaknesses', b.weaknesses)}
    <h4>Offense</h4>
    <p><b>Speed</b> ${esc(b.speed || '—')}</p>
    ${row('Melee', b.melee)}${row('Ranged', b.ranged)}${row('Space / Reach', [b.space, b.reach].filter(Boolean).join(' / '))}${row('Special attacks', b.special_attacks)}
    <h4>Statistics</h4>
    <p>${esc(abil)}</p>
    <p><b>Base Atk</b> ${esc(b.base_attack || '—')}; <b>CMB</b> ${esc(b.cmb || '—')}; <b>CMD</b> ${esc(b.cmd || '—')}</p>
    ${row('Feats', b.feats)}${row('Skills', b.skills)}${row('Racial modifiers', b.racial_modifiers)}${row('Languages', b.languages)}${row('SQ', b.special_qualities)}
    ${(b.abilities || []).length ? `<h4>Special abilities</h4>${b.abilities.map(a => `<div><b>${esc(a.name)}.</b> ${a.html}</div>`).join('')}` : ''}
    ${tpl ? `<h4>Template</h4><p class="small">Summoned with the celestial template if you are good, the fiendish template if you are evil (either if neutral).</p>
      <p class="small">${esc(tpl.celestial)}</p><p class="small">${esc(tpl.fiendish)}</p>` : ''}
    <p class="muted small">Augment Summoning gives +4 Str and +4 Con to every creature you summon.</p>
  </div>`;
}

/** A tracked summon (stored in c.summons) with the numbers worth seeing at a glance copied from its stat block. */
export function newSummon({ key, label, spell, tpl = false, block, rounds = 1 }) {
  const hp = parseInt(block.hp, 10) || 1;
  return {
    id: Math.random().toString(36).slice(2, 10), key, name: label, spell, tpl, template: '',
    hp, hpMax: hp, con: parseInt(block.constitution, 10) || 0, hd: hitDice(block), rounds, roundsTotal: rounds,
    ac: String(block.ac || '').replace(/\s*\([^)]*\)/g, ''),
    saves: `Fort ${block.fortitude || '—'}, Ref ${block.reflex || '—'}, Will ${block.will || '—'}`,
    speed: block.speed || '', melee: block.melee || '', special: block.special_qualities || '', notes: '',
  };
}
