// The in-sheet search: builds an index from a character and ranks matches (names before descriptions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchIndex } from '../web/js/searchindex.js';
import { newCharacter } from '../web/js/model.js';

test('index and ranking', () => {
  const c = newCharacter();
  c.feats.push({ name: 'Power Attack', notes: 'trade accuracy for damage' });
  c.gear.push({ name: 'Rope, hemp (50 ft.)', notes: 'for climbing' });
  c.spellbooks.Wizard = { spells: [{ name: 'Magic Missile', level: 1 }] };
  c.companions.push({ name: 'Mittens', kind: 'familiar', species: 'Cat' });
  const idx = buildIndex(c);
  assert.deepEqual(searchIndex(idx, 'power').map(r => r.kind), ['Feat']);
  assert.equal(searchIndex(idx, 'climb')[0].name, 'Climb', 'skill named Climb ranks before gear notes mentioning it');
  assert.equal(searchIndex(idx, 'climb').find(r => r.kind === 'Gear').score, 2);
  assert.equal(searchIndex(idx, 'missile')[0].tab, 'spells');
  assert.equal(searchIndex(idx, 'mitt')[0].tab, 'companions');
  assert.deepEqual(searchIndex(idx, '  '), []);
});

test('the Notes tab entries are searchable and old saves get empty lists', async () => {
  const { migrate } = await import('../web/js/model.js');
  const old = newCharacter();
  delete old.sessions; delete old.npcs; delete old.quests; delete old.lore;
  migrate(old);
  assert.deepEqual([old.sessions, old.npcs, old.quests, old.lore], [[], [], [], []]);
  old.npcs.push({ name: 'Captain Veyra', role: 'Harbor guard', attitude: 'ally', where: 'The docks', notes: 'Owes us a favor' });
  old.quests.push({ name: 'Find the caravan', done: false, notes: '' });
  old.sessions.push({ date: '2026-10-11', name: 'The Fenwick ambush', notes: 'goblins' });
  old.lore.push({ name: 'The Gilded Lantern', kind: 'Faction', notes: '' });
  old.notes = 'Backstory';
  old.story = 'The vault heist';
  old.bio = 'Raised by wolves';
  const idx = buildIndex(old);
  const hit = q => searchIndex(idx, q)[0];
  assert.deepEqual([hit('veyra').kind, hit('veyra').tab], ['NPC', 'notes']);
  assert.equal(hit('docks').name, 'Captain Veyra', 'finds an NPC by where they are');
  assert.equal(hit('caravan').kind, 'Quest');
  assert.equal(hit('ambush').kind, 'Session');
  assert.equal(hit('lantern').kind, 'Faction');
  assert.equal(hit('backstory').tab, 'notes');
  assert.deepEqual([hit('vault heist').name, hit('vault heist').tab], ['Story', 'notes']);
  assert.deepEqual([hit('wolves').name, hit('wolves').tab], ['Biography', 'bio']);
});
