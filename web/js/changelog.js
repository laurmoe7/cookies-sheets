// What changed, newest first. Add a new entry at the top whenever a batch of changes ships.
// Shown in the "What's new" window (sidebar and Options).

export const CHANGELOG = [
  {
    version: 'Latest', date: '2026-10-07',
    items: [
      'Dusty tome: a faster, smoother bending page turn, and an optional page-turn sound (Options → Page turn sound).',
      'Dusty tome: dark ink on the parchment so text is easier to read, burn marks and torn edges on some pages, a quicker backward page turn, and a Page turn option (Full, Light or Off) in Options.',
      'Resource bars are split into one segment per point. Scroll bars match each theme. In the Dusty tome, the ribbon tabs now rise like bookmarks, the page turn swings the old page over, and the background texture tiles without a seam.',
      'New Dusty tome theme (Options → Theme): dim parchment pages on dark leather, ribbon-bookmark tabs, a page turn when you switch tabs. Light mode is gone; Classic dark is the default.',
      'Options window: theme, accent color, text size, compact layout, tooltips, animations, and what opens at start.',
      'Tab icons, and tabs that look like tabs. The picture beside the character name is now the button to change it.',
      'Companion pages are laid out like the Overview: portrait, hit point tracking, ability scores, separate Defense and Offense cards, and an "At a glance" summary. The full stat block folds away.',
      'Ability names in stat blocks (such as "attach", "scent", "improved evasion") are underlined links to what they do.',
      'Archetype "replaces" targets now match far more class features, including proficiencies, deeds, bonus feats, favored enemies and bloodline powers.',
      'Familiar and animal companion levels now come from chosen abilities too: the arcanist\'s Familiar exploit, shaman, paladin mounts, the Animal domain, Animal Ally and Boon Companion.',
      'Pictures for companions and summons, with a window to recenter and resize any picture.',
      'Class resource trackers (arcane reservoir, rage rounds, ki and more) on the Overview, plus your own counters; extra currencies under Money.',
      'Down and dead are shown differently on the HP card and summon cards, with the point where death occurs.',
      'A warning lists anything left undone (skill ranks, feats, choices) before a level is applied.',
      'Full heal asks for confirmation. Companion levels follow the sheet unless you truly override them.',
    ],
  },
  {
    version: 'Earlier', date: '',
    items: [
      'Summon Monster and Summon Nature\'s Ally: pick a creature, track it under Buffs & Conditions with hit points and rounds left, and read its stat block.',
      'Racial favored class bonus options in the level-up wizard.',
      'Confirmation before deleting spells, items, buffs and other entries.',
      'Search bar for the open character, styled hover tooltips, an Overview notes box, and instant read-on-click panels.',
      'Premade familiars (26 kinds), animal companions and eidolons, guided spell picking, and archetypes.',
      'Portrait and name icon, importer for charactersheet.co.uk, light and dark themes.',
    ],
  },
];
