// Animal companion and eidolon stat blocks. Expected values are worked out by hand from the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeCompanion, newCompanion, animalCompanionLevel, familiarLevel, stepDice } from '../web/js/companions.js';

const data = JSON.parse(readFileSync(new URL('../data/companions.json', import.meta.url), 'utf-8'));
const animal = (species, extra = {}) => ({ ...newCompanion('animal', data), species, ...extra });
const eidolon = (form, extra = {}) => ({ ...newCompanion('eidolon', data), form, ...extra });

test('data: 68 animal species, both progression tables, 4 eidolon forms', () => {
  assert.equal(data.animal.species.length, 68);
  assert.equal(data.animal.progression.length, 20);
  assert.equal(data.eidolon.progression.length, 20);
  assert.deepEqual(data.eidolon.forms.map(f => f.name), ['Biped', 'Quadruped', 'Serpentine', 'Aquatic']);
  assert.ok(data.eidolon.evolutions.length > 60);
});

test('companion level: druid + hunter + ranger-3 + cavalier', () => {
  assert.equal(animalCompanionLevel({ Druid: 5 }), 5);
  assert.equal(animalCompanionLevel({ Ranger: 3 }), 0);
  assert.equal(animalCompanionLevel({ Ranger: 6, Druid: 2 }), 5);
  assert.equal(animalCompanionLevel({ Cavalier: 4 }), 4);
});

test('wolf at druid 1', () => {
  const s = computeCompanion(animal('Wolf'), { Druid: 1 }, data);
  assert.equal(s.level, 1);
  assert.equal(s.hd, 2);
  assert.equal(s.hp, 9 + 4, '2d8 average (9) + Con 2 x 2');
  assert.deepEqual([s.ac.total, s.ac.touch, s.ac.flat], [14, 12, 12], '+2 natural, +2 Dex');
  assert.deepEqual(s.saves, { fort: 5, ref: 5, will: 1 });
  assert.equal(s.cmb, 2);
  assert.equal(s.cmd, 14);
  assert.equal(s.attacks[0].text, 'bite +2 (1d6+1 plus trip)', 'only attack: 1.5 x Str 1');
});

test('wolf at druid 7 advances to Large', () => {
  const s = computeCompanion(animal('Wolf'), { Druid: 7 }, data);
  assert.equal(s.size, 'Large');
  assert.deepEqual([s.abilities.str, s.abilities.dex, s.abilities.con], [23, 15, 19], '13+8+2, 15-2+2, 15+4');
  assert.equal(s.natural, 8, '2 species + 2 advancement + 4 table');
  assert.deepEqual([s.ac.total, s.ac.touch, s.ac.flat], [19, 11, 17], 'Large -1');
  assert.equal(s.hp, 27 + 24, '6d8 average + Con 4 x 6');
  assert.deepEqual(s.saves, { fort: 9, ref: 7, will: 3 });
  assert.equal(s.cmb, 4 + 6 + 1);
  assert.equal(s.cmd, 10 + 4 + 6 + 2 + 1);
  assert.equal(s.attacks[0].text, 'bite +9 (1d8+9 plus trip)');
  assert.ok(s.specials.includes('Evasion') && s.specials.includes('Devotion'));
  assert.equal(s.increases, 1, 'one ability score increase by 7th level');
});

test('ability score increase choices and feats apply', () => {
  const s = computeCompanion(animal('Wolf', { increases: ['str'], feats: [{ name: 'Toughness' }, { name: 'Improved Natural Armor' }] }), { Druid: 4 }, data);
  assert.equal(s.abilities.str, 13 + 1 + 1, 'Str/Dex +1 at 4th, +1 increase');
  assert.equal(s.natural, 2 + 2 + 1);
  assert.equal(s.hp, 18 + 2 * 4 + 4, '4d8 avg 18, Con 2 x 4, Toughness +4 (HD 4)');
});

test('horse: secondary hooves at -5 with half Strength', () => {
  const s = computeCompanion(animal('Horse'), { Druid: 1 }, data);
  assert.equal(s.size, 'Large');
  const bite = s.attacks.find(a => a.name === 'bite'), hooves = s.attacks.find(a => a.name === 'hoof');
  assert.equal(bite.text, 'bite +3 (1d4+3)', 'BAB 1 + Str 3 - 1 size; not its only attack, so 1 x Str');
  assert.equal(hooves.text, '2 hooves -2 (1d6+1)', '1 + 3 - 1 - 5; ½ Str');
});

test('biped eidolon at summoner 1', () => {
  const s = computeCompanion(eidolon('Biped'), { Summoner: 1 }, data);
  assert.equal(s.hp, 5 + 1, '1d10 average 5.5 rounds down, Con +1');
  assert.deepEqual(s.saves, { fort: 3, ref: 1, will: 2 }, 'good Fort and Will');
  assert.equal(s.ac.total, 10 + 2 + 1);
  assert.equal(s.pool, 3);
  assert.equal(s.attacks[0].text, '2 claws +4 (1d4+3)');
});

test('evolutions: points, attacks, natural armor and ability increase', () => {
  const comp = eidolon('Biped', { evolutions: [{ name: 'Bite' }, { name: 'Improved Natural Armor' }, { name: 'Ability Increase', choice: 'str' }] });
  const s = computeCompanion(comp, { Summoner: 1 }, data);
  assert.equal(s.spent, 1 + 1 + 2);
  assert.equal(s.ac.total, 10 + 4 + 1);
  assert.equal(s.abilities.str, 18);
  assert.deepEqual(s.attacks.map(a => a.text), ['2 claws +5 (1d4+4)', 'bite +5 (1d6+4)']);
  assert.equal(s.attackCount, 3);
});

test('large evolution steps damage dice up', () => {
  assert.equal(stepDice('1d4', 1), '1d6');
  assert.equal(stepDice('1d8', 1), '2d6');
  assert.equal(stepDice('1d6', -1), '1d4');
  const s = computeCompanion(eidolon('Biped', { evolutions: [{ name: 'Large' }] }), { Summoner: 8 }, data);
  assert.equal(s.size, 'Large');
  assert.equal(s.attacks[0].dice, '1d6', 'claws 1d4 -> 1d6');
  assert.equal(s.abilities.str, 16 + 3 + 8);
});

const master5 = { bab: 2, hp: 27, saves: { fort: 1, ref: 1, will: 4 }, ranks: {} };
const familiar = (species, extra = {}) => ({ ...newCompanion('familiar', data), species, ...extra });

test('familiar level: wizard + sorcerer + witch levels', () => {
  assert.equal(familiarLevel({ Wizard: 3, Sorcerer: 2 }), 5);
  assert.equal(familiarLevel({ Fighter: 5 }), 0);
  assert.ok(data.familiar.species.length >= 24);
});

test('cat familiar of a 5th-level wizard', () => {
  const s = computeCompanion(familiar('Cat'), { Wizard: 5 }, data, master5);
  // Cat: Tiny, Str 3 (-4), Dex 15 (+2), Con 8 (-1), Wis 12 (+1). 5th-level row: natural armor +3, Int 8.
  assert.equal(s.level, 5);
  assert.equal(s.abilities.int, 8);
  assert.equal(s.ac.total, 10 + 3 + 2 + 2, 'AC = 10 + 3 natural + 2 Dex + 2 size');
  assert.equal(s.hp, 13, 'half of 27, rounded down');
  assert.deepEqual(s.saves, { fort: 2 - 1, ref: 2 + 2, will: 4 + 1 }, 'better of own (2/2/0) and master (1/1/4), plus own ability mods');
  const claw = s.attacks.find(a => a.name === 'claw');
  assert.equal(claw.bonus, 2 + 2 + 2, 'master BAB 2 + Dex 2 (better than Str -4) + Tiny size 2');
  assert.equal(claw.damage, '1d2-4');
  assert.ok(s.specials.includes('Deliver touch spells') && s.specials.includes('Speak with master'));
  assert.ok(!s.specials.includes('Speak with animals of its kind'));
});

test('familiar skills: master ranks beat the printed bonus when higher', () => {
  const m = { ...master5, ranks: { Stealth: 5, Bluff: 5 } };
  const s = computeCompanion(familiar('Cat'), { Wizard: 5 }, data, m);
  // Stealth: 5 ranks + 2 Dex + 3 class skill + 4 racial + 8 Tiny = 22 (printed +14)
  assert.equal(s.skills.find(x => x.name === 'Stealth').total, 22);
  assert.equal(s.skills.find(x => x.name === 'Climb').total, 6, 'no master ranks: printed bonus stands');
  // Bluff: 5 ranks + Cha 7 (-2) = 3, not a class skill
  assert.equal(s.skills.find(x => x.name === 'Bluff').total, 3);
});

test('familiar at 11th level has spell resistance equal to master level + 5', () => {
  const s = computeCompanion(familiar('Bat'), { Wizard: 11 }, data, { ...master5, hp: 60 });
  assert.ok(s.specials.includes('Spell resistance 16'));
  assert.equal(s.abilities.int, 11);
  assert.equal(s.hp, 30);
});

import { companionSources, ownedNames, withCompanionSources } from '../web/js/companions.js';

test('arcanist with the Familiar exploit gets a familiar at arcanist level, however it was entered', () => {
  for (const n of ['Familiar', 'Arcane Exploit: Familiar', 'Arcanist Exploit (Familiar)']) {
    const s = companionSources({ Arcanist: 5 }, [n.toLowerCase()]);
    assert.equal(s.familiar, 5, `${n}: arcanist level 5 counts`);
  }
  assert.equal(companionSources({ Arcanist: 5 }, []).familiar, 0, 'no exploit, no familiar');
  assert.equal(companionSources({ Arcanist: 5 }, ['improved familiar']).familiar, 0, 'the feat alone is not a source');
});
test('exploit levels stack with wizard levels', () => {
  assert.equal(companionSources({ Wizard: 3, Arcanist: 2 }, ['familiar']).familiar, 5, '3 + 2');
});
test('level notes mentioning a familiar count for the exploit', () => {
  const c = { levelUps: [{ notes: 'took the Familiar exploit' }], feats: [], traits: [], specials: [] };
  assert.equal(withCompanionSources({ Arcanist: 3 }, c, [], [], 3)._familiar, 3);
  assert.deepEqual(ownedNames({ feats: [{ name: 'Dodge' }], traits: [], specials: [{ name: 'Familiar ' }], levelUps: [] }), ['dodge', 'familiar']);
});
test('shaman, sea singer and blight druid get familiars; paladin, Animal domain and feats get companions', () => {
  assert.equal(companionSources({ Shaman: 4 }, []).familiar, 4);
  assert.equal(companionSources({ Bard: 4 }, [], ['sea singer']).familiar, 4);
  assert.equal(companionSources({ Bard: 4 }, [], []).familiar, 0);
  assert.equal(companionSources({ Druid: 6 }, [], ['blight druid']).familiar, 6);
  assert.equal(companionSources({ Paladin: 7 }, []).animal, 4, '7 - 3');
  assert.equal(companionSources({ Paladin: 4 }, []).animal, 0, 'no mount before 5th');
  assert.equal(companionSources({ Cleric: 6 }, ['link to the wild']).animal, 3, '6 - 3');
  assert.equal(companionSources({ Fighter: 8 }, ['animal ally'], [], 8).animal, 5, 'character level 8 - 3');
  assert.equal(companionSources({ Druid: 3, Fighter: 6 }, ['boon companion'], [], 9).animal, 7, '3 + 4, under character level 9');
  assert.equal(companionSources({ Druid: 8 }, ['boon companion'], [], 9).animal, 9, 'capped at character level');
});

// ---- Familiar variants: the Improved Familiar list and the celestial / entropic / fiendish / resolute archetypes
import { alignmentWithinOneStep, familiarRequirements } from '../web/js/companions.js';

const master7 = { bab: 3, hp: 40, saves: { fort: 2, ref: 2, will: 5 }, ranks: {} };

test('data: 25 improved familiars (Core list + Ultimate Magic update) and 4 archetypes with defenses by Hit Dice', () => {
  assert.equal(data.familiar.improved.length, 25);
  for (const n of ['Imp', 'Quasit', 'Pseudodragon', 'Homunculus', 'Stirge', 'Dire rat', 'Brownie', 'Mephit', 'Silvanshee agathion', 'Small fire elemental']) {
    assert.ok(data.familiar.improved.some(x => x.name === n), n);
  }
  assert.deepEqual(data.familiar.templates.map(t => t.name), ['Celestial', 'Entropic', 'Fiendish', 'Resolute']);
  assert.deepEqual(data.familiar.templates[0].steps.map(x => [x.hd, x.resist, x.dr]), [[1, 5, ''], [5, 10, '5/evil'], [11, 15, '10/evil']]);
});

test('imp familiar of a 7th-level wizard keeps its own scores and gets the familiar rules', () => {
  const s = computeCompanion(familiar('Imp'), { Wizard: 7 }, data, master7);
  // Imp: Tiny, Str 10, Dex 17 (+3), Con 10, Int 13, Wis 12 (+1), 1 natural armor, feats Dodge and Weapon Finesse.
  // 7th-level master row: natural armor +4, Int 9, so Int stays at the imp's 13.
  assert.equal(s.abilities.int, 13);
  assert.equal(s.ac.total, 10 + 5 + 3 + 2 + 1, 'AC = 10 + (1 + 4) natural + 3 Dex + 2 size + 1 Dodge (the imp\'s own feat)');
  assert.equal(s.ac.touch, 10 + 3 + 2 + 1);
  assert.equal(s.hp, 20, 'half of 40');
  assert.deepEqual(s.saves, { fort: 2, ref: 2 + 3, will: 5 + 1 }, 'better of 2/2/0 and the master 2/2/5, plus Con 0, Dex 3, Wis 1');
  assert.equal(s.attacks[0].bonus, 3 + 3 + 2, 'master BAB 3 + Dex 3 (finesse) + Tiny 2');
  assert.equal(s.attacks[0].damage, '1d4');
  assert.equal(s.type, 'outsider (devil, evil, extraplanar, lawful)');
  assert.equal(s.defense.dr, '5/good or silver');
  assert.equal(s.defense.fastHealing, 2);
  assert.equal(s.sr, 0, 'no spell resistance below 11th');
  assert.ok(computeCompanion(familiar('Imp'), { Wizard: 11 }, data, master7).specials.includes('Spell resistance 16'));
});

test('an improved familiar with its own spell resistance keeps it until the master level beats it', () => {
  const brownie = lv => computeCompanion(familiar('Brownie'), { Wizard: lv }, data, master7).sr;
  assert.equal(brownie(7), 12, 'printed SR 12');
  assert.equal(brownie(11), 16, '11 + 5 beats 12');
});

test('celestial hawk: darkvision, smite, resistances and DR by master level (Hit Dice), SR from CR + 5', () => {
  const hawk = (lv, template = 'Celestial') => computeCompanion(familiar('Hawk', { template }), { Wizard: lv }, data, master7);
  const h4 = hawk(4), h7 = hawk(7), h11 = hawk(11);
  assert.equal(h4.defense.resist, 'cold 5, acid 5, electricity 5');
  assert.equal(h4.defense.dr, '');
  assert.equal(h4.sr, 5, 'CR 1/3 rounds down to 0, +5; no +1 below 5 HD');
  assert.equal(h7.defense.resist, 'cold 10, acid 10, electricity 10');
  assert.equal(h7.defense.dr, '5/evil');
  assert.equal(h7.sr, 6, '0 + 1 (5 or more HD) + 5');
  assert.equal(h11.defense.resist, 'cold 15, acid 15, electricity 15');
  assert.equal(h11.defense.dr, '10/evil');
  assert.equal(h11.sr, 16, 'master level + 5 beats the template');
  assert.equal(h7.senses, 'low-light vision, darkvision 60 ft.');
  assert.ok(h7.specialAttacks.includes('smite evil 1/day'));
  assert.equal(h7.type, 'magical beast (augmented animal)');
  const e = computeCompanion(familiar('Viper', { template: 'Entropic' }), { Wizard: 5 }, data, master7);
  assert.equal(e.defense.resist, 'acid 10, fire 10');
  assert.equal(e.defense.dr, '5/lawful');
  assert.ok(e.specialAttacks.includes('smite law 1/day'));
  assert.equal(computeCompanion(familiar('Cat'), { Wizard: 5 }, data, master7).defense.resist, '', 'no archetype, no resistances');
});

test('an archetype is ignored on an improved familiar (those are already what they are)', () => {
  const s = computeCompanion(familiar('Imp', { template: 'Celestial' }), { Wizard: 7 }, data, master7);
  assert.equal(s.template, null);
  assert.equal(s.defense.resist, 'acid 10, cold 10');
});

test('Improved Familiar alignment: up to one step from the familiar on each axis', () => {
  assert.ok(alignmentWithinOneStep('N', 'LE'), 'neutral reaches every alignment');
  assert.ok(alignmentWithinOneStep('LN', 'LE'));
  assert.ok(!alignmentWithinOneStep('NG', 'LE'), 'good to evil is two steps');
  assert.ok(!alignmentWithinOneStep('LG', 'CE'));
  assert.ok(!alignmentWithinOneStep('CG', 'NE'));
  assert.ok(alignmentWithinOneStep('CG', 'N'));
  assert.ok(alignmentWithinOneStep('LG', 'Any') && alignmentWithinOneStep('', 'LE'), 'unknown alignments pass');
});

test('requirements: the feat, alignment and master level, each checked', () => {
  const imp = data.familiar.improved.find(x => x.name === 'Imp');
  const bad = familiarRequirements(imp, null, 5, { alignment: 'NG', improvedFamiliar: false });
  assert.deepEqual(bad.map(r => r.ok), [false, false, false]);
  const good = familiarRequirements(imp, null, 7, { alignment: 'LN', improvedFamiliar: true });
  assert.deepEqual(good.map(r => r.ok), [true, true, true]);
  assert.deepEqual(familiarRequirements(data.familiar.species[0], null, 1, {}), [], 'a standard familiar asks for nothing');
  const cel = familiarRequirements(data.familiar.species[0], data.familiar.templates[0], 3, { alignment: 'CE', improvedFamiliar: true });
  assert.deepEqual(cel.map(r => r.ok), [true, false, true], 'celestial needs NG; CE is two steps off on the good axis');
  assert.equal(computeCompanion(familiar('Quasit'), { Wizard: 3 }, data, { ...master7, alignment: 'LG', improvedFamiliar: true }).requirements.filter(r => !r.ok).length, 2, 'LG is far from CE, and 3 is under 7');
});

test('Improved Familiar feat (or demonic / fiendish familiar abilities) is detected as a source', () => {
  assert.equal(companionSources({ Wizard: 7 }, ['improved familiar']).improved, true);
  assert.equal(companionSources({ Wizard: 7 }, ['fiendish familiar']).improved, true);
  assert.equal(companionSources({ Wizard: 7 }, ['dodge']).improved, false);
  assert.equal(withCompanionSources({ Wizard: 7 }, { feats: [{ name: 'Improved Familiar' }] }, [], [], 7)._improved, true);
});
