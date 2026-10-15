// What changed, one entry per version number, newest first. Shown in the "What's new" window (sidebar and Options).
// Changes that have not shipped yet go under the next version (give it `next: true`; drop that and add a date when you release it).
// Keep each item to one short, plain sentence.

export const CHANGELOG = [
  {
    version: '1.3', next: true,
    items: [
      'Monster Codex: a new page under the Compendium with about 1,850 creatures. Search by name, pick a type or CR, read the stat block, and take one as a companion.',
      'Companions: “＋ From creature list…” takes any creature as a companion, with hit points to track, attack and skill rolls, a picture and notes.',
      'Companions: everything from the stat block is in the cards now (hit dice, special qualities, what the master gains, a creature’s abilities, space and reach). The old stat block moved to a 📋 Stat block button on each card that opens it in the side panel, and the Settings bar is gone: kind, archetype and level sit under the name, the AC, HP and attack adjustments are in their panels, and feats, skills, evolutions, tricks and notes have panels of their own.',
      'Adding a spell lets you pick whose spell list to look through (your own class is the default), for the times you can learn another class’s spells.',
      'Level up: prepared casters (clerics, druids, wizards...) can choose any spells they like, with no limit, so the ones they use most are on the Spells tab ready to prepare.',
      'Spell search can filter by wizard school, including the elemental schools (Air, Earth, Fire, Water, Metal, Wood).',
      'Weapons have a Damage stat, so any ability (or none) can add to damage. Thrown weapons and Strength-rated bows can use Str.',
      '＋ Add weapon and ＋ Add armor/shield open a list of the standard ones (longsword, chainmail, tower shield and about 170 more) to start from, or a blank row like before.',
      'Inventory has an A–Z button to put the items in alphabetical order.',
      'Change where characters are saved: the Characters page has a Change folder… button beside the save path. Pick any folder (a Dropbox or OneDrive folder keeps them backed up) and your characters are copied there.',
      'Spell-likes & other spells now sit inside the first spellbook, right above the cantrips.',
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
