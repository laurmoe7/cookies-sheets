// What changed, one entry per version number, newest first. Shown in the "What's new" window (sidebar and Options).
// Changes that have not shipped yet go under the next version (give it `next: true`; drop that and add a date when you release it).
// Keep each item to one short, plain sentence.

export const CHANGELOG = [
  {
    version: '1.3', next: true,
    items: [
      'Making a character: pick your traits (two, plus two more with Additional Traits), see your race’s standard racial traits, and swap in alternates where the books have them.',
      'Racial traits: now in the Traits list, filterable by race, with all the standard and alternate traits for the later-book races (Kitsune, Tiefling, Aasimar and 26 more). Alternates show what they replace and offer to remove it.',
      'Archetypes: choose one in a window like the spell picker, with search and the full text. It shows after your class (“Arcanist (White Mage) 8”) in the top bar and the character list. Ninja, Samurai and Antipaladin now have theirs.',
      'Compendium: filter feats by type and traits by category or race, here and in the Add feat / Add trait windows. Weapons and armor show their combat stats.',
      'Weapons and armor: ＋ Add weapon and ＋ Add armor/shield start from a list of about 170 standard ones. Click the name of a listed or magic one to read it. Weapons have a Damage stat, and get Dex when finesse applies.',
      'Spells: add from another class’s list, filter by wizard school (including elemental), and keep spell-likes in the first spellbook. Prepared casters can pick as many spells as they like at level up.',
      'Monster Codex: about 1,850 creatures to search and read, and take as a companion with hit points, rolls, a picture and notes. Companion cards show the whole stat block; the Settings bar is gone (its controls are in the panels, and the old block is the 📋 Stat block button).',
      'Importing: the report names any Misc box the importer filled in to make a number match, with both numbers.',
      'The window opens where and how big you left it, and never under the taskbar.',
      'Characters: change the save folder from the Characters page. Inventory has an A–Z button.',
      'What’s new is shorter and sorted by version.',
    ],
  },
  {
    version: '1.2', date: '2026-10-14',
    items: [
      'Import from Google Sheet: paste the link of a Pathfinder character sheet (sharing set to Anyone with the link) or choose its .csv.',
      'Spell-likes & other spells: spells outside your class list, with uses per day or at will, a Use button and rolls. Rest refills them.',
      'Every skill has a Notes box.',
      'Fixed: charactersheet.co.uk sheets that keep names in the “type” box lost their gear and traits when imported.',
    ],
  },
  {
    version: '1.1', date: '2026-10-14',
    items: [
      'Update from inside the app: Options, Look, “Check for updates now”. It downloads, installs and reopens by itself.',
      'Ignore encumbrance: a tick beside Carrying Capacity that stops weight from slowing or penalizing you.',
      'Safer imports: a character file from someone else can no longer run code through its pictures.',
    ],
  },
  {
    version: '1.0', date: '2026-10-14',
    items: [
      'Rolling: click a save, skill, attack or damage number to roll it. Add modifiers, advantage, flanking and more, then roll here or send to Discord.',
      'Damage roll window with critical hits, sneak attack, smite, challenge, favored enemy and Vital Strike.',
      'Rest button: heals, clears damage, refills class pools, trackers and spell slots. New pools for smite, challenge, wild shape and martial flexibility.',
      'Buffs and conditions: dozens of presets, listed A to Z, with correct stacking shown in every roll.',
      'Weapons and armor: ✦ Enchant (enhancement, materials, 30 special abilities) and ＋ Magic item from the compendium. Armor’s DR, SR and resistances show under Defenses.',
      'Inventory: a paper doll with a slot for each worn item, item chips, and bonuses that count while an item is worn.',
      'Spells: each spell is a chip with a side panel for Roll, Prepared and Cast. Slots are drawn as circles, and rolling a spell counts as casting it.',
      'Companions: improved familiars with celestial, entropic, fiendish and resolute variants, summons, and pictures for each.',
      'Characters page: earlier saves to go back to, and a bin to restore deleted characters.',
      'Import from charactersheet.co.uk, now also reading archetypes written in brackets.',
      'Notes tab with story, quests, NPCs, places, lore and a session log; Biography tab.',
      'Options: themes (Dusty tome is the default), accent colors, text size, sound effects and draggable sheet tabs.',
      'Cookie, the rude thrush in the sidebar, comments on what you do. Options, Cookie turns him down.',
      'Earlier: Summon Monster lists, racial favored class options, familiars, animal companions, eidolons, archetypes, search and tooltips.',
    ],
  },
];
