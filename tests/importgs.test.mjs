// Google Sheets importer (the "Pathfinder character sheet" template). tests/fixtures/gs_beavis.csv is a real sheet's CSV export, Dwarf Wizard 8,
// with the player name removed. Expected values are read off that sheet by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, parseSheetRef, googleSheetToCs, isGoogleSheetCharacter } from '../web/js/importgs.js';
import { buildCharacter, guessClasses, compareSheets } from '../web/js/importcs.js';
import { classes, classesByName, rootPath } from './helpers.mjs';

const rows = parseCsv(readFileSync(rootPath + 'tests/fixtures/gs_beavis.csv', 'utf-8'));
const src = googleSheetToCs(rows);

test('CSV: quotes, doubled quotes and line breaks inside a cell', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e""\nf"\r\n,x\n'), [['a', 'b,c', 'd "e"\nf'], ['', 'x']]);
});

test('sheet links: id and tab', () => {
  const id = '1DkPwfR5IdcJ0Bk9NhUnBA7iXTUF-aQl4kqaCRj50Tps';
  assert.deepEqual(parseSheetRef(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0`), { id, gid: '0' });
  assert.deepEqual(parseSheetRef(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=1234`), { id, gid: '1234' });
  assert.deepEqual(parseSheetRef(id), { id, gid: '0' });
  assert.equal(parseSheetRef('https://example.com/x'), null);
});

test('recognises the template and nothing else', () => {
  assert.ok(isGoogleSheetCharacter(rows));
  assert.ok(!isGoogleSheetCharacter(parseCsv('a,b\n1,2')));
});

test('who, abilities, hit points and speed', () => {
  assert.equal(src.name, 'Admiral Beavis Stonebender');
  assert.equal(src.level, 'Wizard 8');
  assert.equal(src.race, 'Dwarf');
  assert.equal(src.size, 'Medium');
  assert.deepEqual(src.abilities, { str: '8', dex: '8', con: '16', int: '22', wis: '14', cha: '6' });
  assert.equal(src.hp.total, '62');
  assert.equal(src.hp.wounds, '33', '29 of 62 left is 33 taken');
  assert.equal(src.speed.base, '30');
});

test('defense and attack numbers', () => {
  assert.deepEqual([src.ac.total, src.ac.touch, src.ac.flatFooted, src.ac.naturalArmor], ['10', '9', '11', '1']);
  assert.deepEqual([src.saves.fort.total, src.saves.reflex.total, src.saves.will.total], ['5', '1', '7']);
  assert.deepEqual([src.initiative.total, src.initiative.miscModifier], ['0', '1']);
  assert.deepEqual([src.bab, src.cmb.total, src.cmd.total], ['4', '3', '12']);
});

test('skills: ranks, class skills, and the class skill +3 taken out of misc', () => {
  const sculpture = src.skills.craft1;
  assert.deepEqual([sculpture.name, sculpture.ranks, sculpture.total, sculpture.classSkill, sculpture.misc], ['Sculpture', 8, '17', true, 0], '17 = INT 6 + 8 ranks + 3 class skill');
  assert.equal(src.skills.craft3.misc, 2, 'Smithing: the misc box says 5, and 3 of it is the class skill bonus');
  assert.equal(src.skills.knowledgeArcana.ranks, 8);
  assert.deepEqual([src.skills.perception.ranks, src.skills.perception.misc, src.skills.perception.classSkill], [7, 3, false], '12 = WIS 2 + 7 ranks + 3 misc');
  assert.ok(src.skills.disableDevice && src.skills.sleightOfHand, 'starred (trained only) names are cleaned');
  assert.ok(src.skills.appraise, 'the template spells it "Apraise"');
  assert.ok(!src.skills.profession1, 'empty Profession rows are left out');
  assert.match(src.languages, /^Common, Undercommon/);
});

test('weapons, gear, money', () => {
  assert.equal(src.melee.length, 0, 'the empty Unarmed block is not a weapon');
  assert.deepEqual(src.ranged.map(w => [w.weapon, w.attackBonus, w.critical, w.damage, w.ammunition, w.type]), [['Heavy Crossbow', '3', '19-20/x2', '1d10', 'Bolts', 'P']]);
  assert.equal(src.gear.length, 21);
  const torch = src.gear.find(g => g.name === 'Torch'), bolts = src.gear.find(g => g.name === 'Ballista Bolts');
  assert.equal(torch.quantity, '10');
  assert.deepEqual([bolts.quantity, bolts.location], ['20', 'Light Ballista'], '"- 20 x Ballista Bolts" sits inside the ballista');
  assert.equal(src.gear.find(g => g.name === 'Rations').quantity, '210');
  assert.deepEqual([src.gear[0].name, src.gear[0].notes], ['Headband of Vast Intelligence +2', 'Arcana'], '"HB ... [Arcana]" is spelled out, with the skill kept as a note');
  assert.equal(src.money.gp, '1');
});

test('feats, special abilities, spells', () => {
  assert.equal(src.feats.length, 7, 'feats and traits share one column');
  assert.deepEqual([src.feats[0].name, src.feats[0].notes.slice(0, 20)], ['Scribe Scroll', 'You can create a scr']);
  assert.equal(src.specialAbilities.length, 16);
  assert.ok(src.specialAbilities.some(a => a.name === 'Metal Rending (Su)'), '[Su] becomes (Su) so the compendium can match it');
  assert.deepEqual(src.spells.map(l => l.slotted.length), [4, 10, 4, 6, 4, 0, 0, 0, 0, 0]);
  assert.equal(src.spells[1].slotted[9].name, 'Mage Armor');
});

test('builds a character that this app agrees with', () => {
  const { char } = buildCharacter(src, guessClasses(src.level, classes), {}, classesByName);
  assert.equal(char.race, 'Dwarf');
  assert.equal(char.levelUps.length, 8);
  assert.equal(char.importedFrom.source, 'Google Sheets');
  const cmp = Object.fromEntries(compareSheets(src, char, classesByName).map(r => [r.label, r]));
  for (const k of ['Hit points', 'AC', 'Touch AC', 'Fortitude', 'Reflex', 'Base attack', 'CMB', 'CMD', 'STR', 'INT', 'CON']) assert.ok(cmp[k]?.same, `${k} matches the sheet (${cmp[k]?.theirs} vs ${cmp[k]?.ours})`);
  assert.equal(char.gear.length, 21);
  assert.equal(char.spellbooks.Wizard.spells.length, 28);
});
