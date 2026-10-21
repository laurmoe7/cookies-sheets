// What changed, one entry per version number, newest first. Shown in the "What's new" window (sidebar and Options).
// Changes that have not shipped yet go under the next version (give it `next: true`; drop that and add a date when you release it).
// Keep each item to one short, plain sentence.

export const CHANGELOG = [
  {
    version: '1.3.4', date: '2026-10-21',
    items: [
      'Overview: hover AC, touch, flat-footed, CMD, max HP, an ability score, BAB or speed to see what adds up to it (rage’s –2 to AC shows in CMD too).',
      'These feats now count by themselves: Toughness, Dodge, Great Fortitude, Iron Will, Lightning Reflexes, Improved Initiative, Skill Focus and the skill feats. A buff with the same name isn’t counted twice.',
      'Traits with an always-on bonus (Reactionary, Resilient, Seeker...) and racial skill bonuses (Keen Senses, Halfling Luck...) now count by themselves too.',
      'Importing moves those bonuses out of the Misc boxes, so imported totals don’t change.',
      'Weapon Focus, Weapon Specialization (and the Greater versions) and Improved Critical apply to the weapon they name. Spell Focus shows its schools under Save DC.',
      'Weapon Finesse: light melee weapons, rapiers and whips use Dexterity to hit when it’s higher.',
      'Two-weapon fighting: the roll window has off-hand penalties for light and heavy weapons, and the Two-Weapon Fighting feat lowers them.',
      'Temporary Intelligence (like Fox’s Cunning) no longer changes your skill points. Permanent Int still does.',
      'Current HP no longer shows above max when a Constitution buff ends.',
      'Double-counted bonuses: if a worn item’s bonus is also typed in a box (common on imports, like a cloak of resistance in the save Misc boxes), the sheet offers to take it out of the box.',
      'More items give their bonuses by themselves: elvenkind cloak and boots, eyes of the eagle, gloves of swimming and climbing, rings of climbing and swimming, circlet of persuasion, goggles of minute seeing, vest of escape, and boots of striding and springing.',
      'So do ability belts and headbands, including ones that name two abilities ("Belt of Physical Might +4 (Str, Con)"). Items already on your sheet get them too.',
      'Buffs and items can add to a single skill (the “One skill” group in the bonus editor). A competence bonus from armor no longer stacks with one from an item.',
      'A headband of vast intelligence (or the Int Enh box) no longer adds skill points each level. Instead it gives ranks in one skill (your Hit Dice per +2), shown next to Ranks spent.',
      'Skills: hover “Ranks spent” to see where your ranks come from.',
      'Defense: AC, touch, flat-footed and CMD each have their own Misc box.',
      'Ability Scores: the score and modifier now sit right next to each ability’s name.',
      'Every level gives at least 1 hit point, even with a Con penalty and a low roll.',
      'Flat-footed CMD keeps a Dexterity penalty and only loses a Dexterity bonus.',
      'Damaged or hand-edited character files still open, and a file that can’t open says why.',
      'An edit made right before switching characters, deleting, exporting, restoring an earlier save or closing the window is no longer lost.',
      'Added racial bonuses for Kitsune, Changeling, Dhampir, Drow, Fetchling, Nagaji, Ratfolk, Suli, Svirfneblin, Tengu, Vanara, Vishkanya and Wayang.',
    ],
  },
  {
    version: '1.3.3', date: '2026-10-15',
    items: [
      'Class resources (rage, arcane reservoir, ki, bombs...): type the points you have left, and use ✎ to add extra capacity from feats and exploits like Extra Rage or Extra Reservoir.',
    ],
  },
  {
    version: '1.3.2', date: '2026-10-15',
    items: [
      'Options, Look: “Open Cookie’s Sheets in” its own window or your web browser, so the normal .exe can start either way.',
      'The browser version closes itself a few seconds after you close its page, so nothing is left running. You can turn that off in Options.',
    ],
  },
  {
    version: '1.3.1', date: '2026-10-15',
    items: [
      'Run in your web browser: “Cookie’s Sheets in browser.bat” opens the app in your browser, with a tray icon to open it again or quit.',
    ],
  },
  {
    version: '1.3', date: '2026-10-15',
    items: [
      'Making a character: pick your traits (two, plus two more with Additional Traits), see your race’s standard racial traits, and swap in alternates where the books have them.',
      'Racial traits: now in the Traits list, filterable by race, with all the standard and alternate traits for the later-book races (Kitsune, Tiefling, Aasimar and 26 more). Alternates show what they replace and offer to remove it.',
      'Archetypes: choose one in a window like the spell picker, with search and the full text. It shows after your class (“Arcanist (White Mage) 8”) in the top bar and the character list. Ninja, Samurai and Antipaladin now have theirs.',
      'Compendium: filter feats by type and traits by category or race, here and in the Add feat / Add trait windows. Weapons and armor show their combat stats.',
      'Weapons and armor: ＋ Add weapon and ＋ Add armor/shield start from a list of about 170 standard ones. Click the name of a listed or magic one to read it. Weapons have a Damage stat, and get Dex when finesse applies.',
      'Spells: add from another class’s list, filter by wizard school (including elemental), and keep spell-likes in the first spellbook. Prepared casters can pick as many spells as they like at level up.',
      'Monster Codex: about 1,850 creatures to search and read, and take as a companion with hit points, rolls, a picture and notes.',
      'Companion cards show the whole stat block. The Settings bar is gone: its controls are in the panels, and the old block is the 📋 Stat block button.',
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
