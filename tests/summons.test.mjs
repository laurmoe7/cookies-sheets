// Summon Monster / Nature's Ally lists. Counts come straight from the Core Rulebook tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summonSpell, summonChoices, statBlockHtml, templateNotes } from '../web/js/summons.js';

const data = JSON.parse(readFileSync(new URL('../data/summons.json', import.meta.url), 'utf-8'));

test('recognises the summon spells', () => {
  assert.deepEqual(summonSpell('Summon Monster IV'), { family: 'Summon Monster', level: 4 });
  assert.deepEqual(summonSpell("Summon Nature's Ally IX"), { family: "Summon Nature's Ally", level: 9 });
  assert.equal(summonSpell('Summon Swarm'), null);
  assert.equal(summonSpell('Summon Monster'), null);
});

test('Summon Monster I offers only the eight 1st-level creatures', () => {
  const g = summonChoices(data, 'Summon Monster', 1);
  assert.equal(g.length, 1);
  assert.equal(g[0].count, '1 creature');
  assert.deepEqual(g[0].entries.map(e => e.name).sort(),
    ['Dire rat', 'Dog', 'Dolphin', 'Eagle', 'Fire beetle', 'Poisonous frog', 'Pony (horse)', 'Viper (snake)']);
  assert.ok(g[0].entries.every(e => e.template), 'all are celestial/fiendish creatures');
});

test('a 3rd-level spell draws from the 3rd list (1), 2nd list (1d3) and 1st list (1d4+1)', () => {
  const g = summonChoices(data, "Summon Nature's Ally", 3);
  assert.deepEqual(g.map(x => [x.level, x.count]), [[3, '1 creature'], [2, '1d3 creatures'], [1, '1d4+1 creatures']]);
});

test('every listed creature has a stat block', () => {
  for (const list of Object.values(data.families)) for (const e of list) assert.ok(data.creatures[e.creature], `${e.name} -> ${e.creature}`);
});

test('stat block renders and template notes scale with Hit Dice', () => {
  const html = statBlockHtml(data.creatures[data.families['Summon Monster'][0].creature], { template: true });
  assert.match(html, /Defense/);
  assert.match(html, /Celestial/);
  assert.match(templateNotes(3).celestial, /resist acid 5/);
  assert.doesNotMatch(templateNotes(3).celestial, /DR/);
  assert.match(templateNotes(6).fiendish, /resist cold 10, fire 10, DR 5\/good/);
  assert.match(templateNotes(12).celestial, /DR 10\/evil/);
});

import { newSummon } from '../web/js/summons.js';

test('a tracked summon copies the numbers worth seeing from its stat block', () => {
  const ape = data.creatures['ape, gorilla'];
  const s = newSummon({ key: 'ape, gorilla', label: 'Ape', spell: 'Summon Monster III', tpl: true, block: ape, rounds: 5 });
  assert.equal(s.hp, 19, 'Ape: hp 19 (3d8+6)');
  assert.equal(s.hpMax, 19);
  assert.equal(s.hd, 3);
  assert.equal(s.rounds, 5);
  assert.match(s.ac, /^14, touch 11, flat-footed 12$/, 'bonus breakdown in parentheses is dropped');
  assert.equal(s.saves, 'Fort +7, Ref +5, Will +2');
});
