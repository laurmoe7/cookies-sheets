// Spells granted by domains, bloodlines, mysteries, patrons and spirits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optionsFor, grantedSpells, firstCastLevel, missingGranted, dropGranted, learnedSpells, grantLabel } from '../web/js/grants.js';
import { classesByName } from './helpers.mjs';

const data = JSON.parse(readFileSync(new URL('../data/grants.json', import.meta.url), 'utf-8'));
const names = (cls, choices, lv) => grantedSpells(data, classesByName[cls], choices, lv).map(s => s.name);

test('domain spells arrive when the cleric can cast their level', () => {
  assert.equal(firstCastLevel(classesByName.Cleric, 2), 3, 'clerics cast 2nd-level spells at 3rd');
  assert.deepEqual(names('Cleric', [{ kind: 'domain', name: 'Fire' }], 1), ['Burning Hands'], '1st: burning hands');
  assert.deepEqual(names('Cleric', [{ kind: 'domain', name: 'Fire' }], 3), ['Burning Hands', 'Produce Flame'], '3rd adds produce flame');
  assert.deepEqual(names('Cleric', [{ kind: 'domain', name: 'Fire' }, { kind: 'domain', name: 'Sun' }], 1).length, 2, 'one 1st-level spell from each domain');
});
test('a subdomain swaps some of its domain spells', () => {
  // Ash (APG): 7th disintegrate, 9th fiery body; clerics cast 7th-level spells at 13th.
  const at13 = grantedSpells(data, classesByName.Cleric, [{ kind: 'subdomain', name: 'Ash' }], 13);
  assert.equal(at13.find(s => s.level === 7).name, 'Disintegrate');
  assert.equal(at13.find(s => s.level === 3).name, 'Fireball', 'the rest come from the Fire domain');
  assert.equal(at13[0].granted, 'Ash subdomain');
});
test('bloodline, mystery, patron and bloodrager spells come at the class level the book gives', () => {
  assert.deepEqual(names('Sorcerer', [{ kind: 'bloodline', name: 'Arcane' }], 4), ['Identify'], 'identify (3rd); invisibility waits for 5th');
  assert.deepEqual(names('Sorcerer', [{ kind: 'bloodline', name: 'Arcane' }], 2), [], 'nothing before 3rd');
  assert.deepEqual(names('Oracle', [{ kind: 'mystery', name: 'Flame' }], 2), ['Burning Hands'], 'burning hands (2nd)');
  assert.deepEqual(names('Witch', [{ kind: 'patron', name: 'Agility' }], 1), [], 'patron spells start at 2nd');
  assert.deepEqual(names('Witch', [{ kind: 'patron', name: 'Agility' }], 4), ['Jump', "Cat's Grace"], '2nd jump, 4th cat\'s grace');
  assert.deepEqual(names('Bloodrager', [{ kind: 'bloodragerBloodline', name: 'Arcane' }], 7), ['Magic Missile'], 'magic missile (7th)');
  const s = grantedSpells(data, classesByName.Sorcerer, [{ kind: 'bloodline', name: 'Arcane' }], 5)[1];
  assert.deepEqual([s.name, s.level, s.granted], ['Invisibility', 2, 'Arcane bloodline'], 'the 2nd bonus spell is a 2nd-level spell');
});
test('spirit magic spells arrive with their spell level', () => {
  assert.deepEqual(names('Shaman', [{ kind: 'spirit', name: 'Flame' }], 3), ['Burning Hands', 'Resist Energy']);
});
test('druids pick from druid domains and the seven nature cleric domains', () => {
  const groups = Object.fromEntries(optionsFor(data, 'Druid').map(g => [g.kind, g.options.map(o => o.name)]));
  assert.deepEqual(groups.domain, ['Air', 'Animal', 'Earth', 'Fire', 'Plant', 'Water', 'Weather']);
  assert.ok(groups.druidDomain.includes('Arctic'));
  assert.ok(!groups.subdomain.includes('Ancestors'), 'Ancestors is a Repose subdomain');
  assert.deepEqual(optionsFor(data, 'Fighter'), []);
});
test('missing, dropped and learned spells', () => {
  const book = [{ name: 'burning hands', level: 1, granted: 'Fire domain' }, { name: 'Bless', level: 1 }, { name: 'Light', level: 0, granted: 'Sun domain' }];
  const due = grantedSpells(data, classesByName.Cleric, [{ kind: 'domain', name: 'Fire' }], 3);
  assert.deepEqual(missingGranted(due, book).map(s => s.name), ['Produce Flame'], 'burning hands is there already (any case)');
  const kept = dropGranted(book, [{ kind: 'domain', name: 'Fire' }, { kind: 'domain', name: 'Sun' }], [{ kind: 'domain', name: 'Fire' }]);
  assert.deepEqual(kept.map(s => s.name), ['burning hands', 'Bless'], 'Sun dropped: its spell goes, hand-added spells stay');
  assert.deepEqual(learnedSpells(book).map(s => s.name), ['Bless']);
  assert.equal(grantLabel({ kind: 'bloodragerBloodline', name: 'Arcane' }), 'Arcane bloodline');
});
