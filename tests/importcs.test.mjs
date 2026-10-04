// charactersheet.co.uk importer. Compendium matching (resolveAll) needs the server, so these tests pass
// an empty match table; tests/test_server.py covers the lookup endpoint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCsCharacter, guessClasses, buildCharacter, compareSheets } from '../web/js/importcs.js';
import { newCharacter } from '../web/js/model.js';
import { classes, classesByName, calc, fixture } from './helpers.mjs';

const build = (src, rows = guessClasses(src.level, classes)) => buildCharacter(src, rows, {}, classesByName);

test('recognises charactersheet.co.uk files but not our own saves', () => {
  assert.ok(isCsCharacter(fixture('cs_fumu.json')));
  assert.ok(isCsCharacter({ name: 'x', abilities: { str: '10' } }));
  assert.ok(!isCsCharacter(newCharacter()));
  assert.ok(!isCsCharacter(null));
  assert.ok(!isCsCharacter([]));
});

test('reads class levels from free text', () => {
  const g = t => guessClasses(t, classes).map(r => [r.cls, r.levels, r.archetype]);
  assert.deepEqual(g('White Mage Arcanist, lvl 8'), [['Arcanist', 8, 'White Mage']]);
  assert.deepEqual(g('Fighter 3 / Rogue 2'), [['Fighter', 3, ''], ['Rogue', 2, '']]);
  assert.deepEqual(g('Ftr3/Rog2'), [['Fighter', 3, ''], ['Rogue', 2, '']]);
  assert.deepEqual(g('Wiz5'), [['Wizard', 5, '']]);
  assert.deepEqual(g('Lvl 6 Cleric'), [['Cleric', 6, '']]);
  assert.deepEqual(g('3rd-level wizard'), [['Wizard', 3, '']]);
  assert.deepEqual(g('Invulnerable Rager Barbarian 4, Fighter 1'), [['Barbarian', 4, 'Invulnerable Rager'], ['Fighter', 1, '']]);
  assert.deepEqual(g('Oracle'), [['Oracle', 1, '']]);
  assert.deepEqual(g(''), []);
  assert.deepEqual(g('5'), []);
});

// ---------- a real sheet (Fumu, Kitsune White Mage Arcanist 8) ----------

test('Fumu: levels, archetype, scores and HP carry over', () => {
  const { char } = build(fixture('cs_fumu.json'));
  const d = calc(char);
  assert.equal(char.name, 'Fumu');
  assert.equal(char.race, 'Kitsune');
  assert.equal(char.levelUps.length, 8);
  assert.ok(char.levelUps.every(l => l.cls === 'Arcanist'));
  assert.deepEqual(char.archetypes.Arcanist, [{ name: 'White Mage' }], 'name kept; linked when compendium data is passed');
  assert.deepEqual(Object.fromEntries(Object.entries(d.abilities).map(([k, v]) => [k, v.score])),
    { str: 8, dex: 18, con: 12, int: 20, wis: 8, cha: 10 });
  assert.equal(d.hp.max, 50);
});

test('Fumu: the White Mage archetype is linked when compendium data is available', () => {
  const whiteMage = { id: 7, name: 'White Mage', source: 'ACG', description: 'healer', diminished: false, classSkills: { add: [], remove: [] },
    features: [{ name: 'Spontaneous Healing', level: 1, replaces: [{ name: 'arcanist exploit', parts: [], levels: [1, 9] }], modifies: [], advice: false, html: '' }] };
  const src = fixture('cs_fumu.json');
  const { char } = buildCharacter(src, guessClasses(src.level, classes), {}, classesByName, { Arcanist: [whiteMage] });
  assert.equal(char.archetypes.Arcanist[0].id, 7);
  assert.equal(char.archetypes.Arcanist[0].features[0].name, 'Spontaneous Healing');
});

test('Fumu: spells, money, saves and bonuses', () => {
  const { char } = build(fixture('cs_fumu.json'));
  const book = char.spellbooks.Arcanist;
  assert.equal(book.spells.length, 90, '"*Slots" placeholder rows are skipped');
  assert.ok(book.spells.some(s => s.name === 'Fireball' && s.level === 3 && s.prepared === 1));
  assert.equal(char.money.gp, 100);
  assert.deepEqual(char.saveMisc, { fort: 2, ref: 2, will: 4 });
  assert.ok(char.armor.some(a => a.name === 'Armor bonus (imported)' && a.bonus === 4));
  assert.equal(char.ac.natural, 1);
  assert.equal(char.ac.deflection, 1);
});

test('Fumu: weapon attack matches the old sheet, using Dex (finesse)', () => {
  const { char } = build(fixture('cs_fumu.json'));
  assert.equal(char.weapons[0].ability, 'dex');
  assert.equal(calc(char).weapons[0].attack, 6);
});

test('Fumu: text-only details go to Notes, spell-like uses merge into the ability', () => {
  const { char } = build(fixture('cs_fumu.json'));
  for (const s of ['+2 weasel', '+10 as fox', 'AR: 12', 'White Mage Arcanist, lvl 8']) assert.ok(char.notes.includes(s), s);
  assert.ok(char.notes.startsWith('cast defensively'), 'the old notes come first');
  const reservoir = char.specials.filter(s => s.name === 'Arcane Reservoir');
  assert.equal(reservoir.length, 1);
  assert.ok(reservoir[0].notes.startsWith('12/day'));
});

test('Fumu: no account details survive, source is recorded', () => {
  const src = { ...fixture('cs_fumu.json'), user: { email: 'someone@example.com', token: 'secret' } };
  const { char } = build(src);
  const json = JSON.stringify(char);
  assert.ok(!json.includes('someone@example.com') && !json.includes('secret'));
  assert.equal(char.importedFrom.source, 'charactersheet.co.uk');
});

test('Fumu: numbers check lists matches and differences', () => {
  const src = fixture('cs_fumu.json');
  const rows = Object.fromEntries(compareSheets(src, build(src).char, classesByName).map(r => [r.label, r]));
  for (const k of ['Hit points', 'Fortitude', 'Will', 'Base attack', 'Appraise']) assert.ok(rows[k].same, k);
  assert.equal(rows.Initiative.theirs, '+3');
  assert.equal(rows.Initiative.ours, '+4', 'Dex 18 is +4; the old sheet was out of date');
});

// ---------- a made-up multiclass sheet exercising the trickier conversions ----------

const sample = () => ({
  _id: 'x', name: 'Test', race: 'Human', alignment: 'Lawful Good', level: 'Fighter 3 / Rogue 2',
  abilities: { str: '18', dex: '14', con: '14', int: '10', wis: '12', cha: '8', tempStr: '22' },
  hp: { total: '44', wounds: '10' },
  ac: { items: [{ name: 'Chainmail +1', type: 'Medium armor', bonus: '7', armorCheckPenalty: '-4', spellFailure: '30%', weight: '40' }] },
  saves: { fort: { magicModifier: '1' }, will: { otherModifiers: '+2 vs fear' } },
  skills: { craft1: { name: 'Weapons', ranks: '2', classSkill: true }, craft2: { name: 'Bows', ranks: '1' }, stealth: { ranks: '2', racial: '2' } },
  melee: [{ weapon: 'Longsword +1', attackBonus: '+11', damage: '1d8+7' }, { weapon: 'Greatsword', attackBonus: '+9', damage: '2d6+9' }],
  ranged: [{ weapon: 'Longbow', attackBonus: '+7', damage: '1d8', ammunition: '20 arrows' }],
  gear: [{ name: 'Arrows', quantity: '20', weight: '3' }],
  money: { gp: '120', gems: 'ruby' },
});

test('multiclass sample: abilities keep their totals, temp score becomes a temp bonus', () => {
  const { char } = build(sample());
  assert.equal(char.raceChoice, 'str', 'human +2 goes to the highest score');
  assert.equal(char.abilities.str.base, 16);
  assert.equal(char.abilities.str.temp, 4);
  assert.equal(calc(char).abilities.str.score, 22);
  assert.equal(char.alignment, 'LG');
});

test('multiclass sample: HP total is spread across levels, wounds become current HP', () => {
  const { char } = build(sample());
  assert.deepEqual(char.levelUps.map(l => `${l.cls}:${l.hp}`), ['Fighter:10', 'Fighter:7', 'Fighter:7', 'Rogue:5', 'Rogue:5']);
  assert.equal(calc(char).hp.max, 44);
  assert.equal(char.hp.misc, 0);
  assert.equal(char.hp.current, 34);
});

test('multiclass sample: weapons reproduce the old attack and damage', () => {
  const { char } = build(sample());
  const d = calc(char);
  assert.deepEqual(d.weapons.map(w => w.attack), [11, 9, 7]);
  assert.deepEqual(d.weapons.map(w => w.damageText), ['1d8+7', '2d6+9', '1d8']);
  assert.equal(char.weapons[1].dmgMult, '1.5', 'greatsword detected as two-handed');
  assert.ok(char.notes.includes('ammunition: 20 arrows'));
});

test('multiclass sample: skills, armor, gear, money', () => {
  const { char, notes } = build(sample());
  const crafts = char.skills.filter(s => s.name === 'Craft').map(s => [s.sub, s.ranks, s.classSkill]);
  assert.deepEqual(crafts, [['Weapons', 2, true], ['Bows', 1, false]]);
  assert.equal(char.skills.find(s => s.name === 'Stealth').misc, 2, 'racial bonus kept as misc');
  assert.deepEqual([char.armor[0].category, char.armor[0].acp, char.armor[0].asf], ['medium', -4, 30]);
  assert.ok(notes.some(n => n.includes('max Dex')));
  assert.equal(char.gear[0].weight, 0.15, '3 lb for 20 arrows, stored per arrow');
  assert.equal(char.money.gp, 120);
  assert.ok(char.notes.includes('Gems: ruby'));
  assert.ok(char.notes.includes('Will (conditional): +2 vs fear'));
});

test('unknown race becomes a custom race; no class means level 0', () => {
  const { char } = build({ name: 'Odd', race: 'Lizardfolk', size: 'Medium', speed: { base: '30' }, level: 'Monster' });
  assert.equal(char.race, 'Custom');
  assert.equal(char.customRace.name, 'Lizardfolk');
  assert.equal(char.levelUps.length, 0);
});
