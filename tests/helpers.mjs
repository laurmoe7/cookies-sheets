// Shared helpers for the JS tests: build characters in code and compute them like the app does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../web/js/calc.js';
import { newCharacter } from '../web/js/model.js';
import { BUFF_PRESETS } from '../web/js/data.js';

const root = new URL('..', import.meta.url);
export const classes = JSON.parse(readFileSync(new URL('data/classes.json', root), 'utf-8'));
export const classesByName = Object.fromEntries(classes.map(c => [c.name, c]));
export const fixture = name => JSON.parse(readFileSync(new URL(`tests/fixtures/${name}`, root), 'utf-8'));
export const rootPath = fileURLToPath(root);

/**
 * Build a character.
 *   make({ race: 'Human', raceChoice: 'str', base: { str: 15 }, levels: ['Fighter', 'Fighter'], hp: [10, 6] })
 * Any other keys are assigned onto the character as-is (armor, weapons, gear, spellbooks, ...).
 */
export function make({ race = 'Human', raceChoice = 'str', base = {}, levels = [], hp = [], ...rest } = {}) {
  const c = newCharacter();
  c.race = race;
  c.raceChoice = raceChoice;
  for (const [a, v] of Object.entries(base)) c.abilities[a].base = v;
  c.levelUps = levels.map((cls, i) => ({
    cls, hp: hp[i] ?? (i === 0 ? classesByName[cls].hit_die : classesByName[cls].hit_die / 2 + 1),
    fcb: '', fcbNote: '', abilityIncrease: '', ranks: {}, notes: '',
  }));
  Object.assign(c, rest);
  return c;
}

export const calc = c => compute(c, classesByName);

/** Turn on a preset from the Buffs & Conditions tab by name. */
export function buff(c, name) {
  const p = BUFF_PRESETS.find(b => b.name === name);
  if (!p) throw new Error(`No buff preset named ${name}`);
  c.modifiers.push({ name: p.name, active: true, note: '', effects: structuredClone(p.effects) });
  return c;
}

export const repeat = (cls, n) => Array(n).fill(cls);
