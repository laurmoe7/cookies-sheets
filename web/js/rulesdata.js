// Quick-reference cards (summaries). Each "see" entry links to the full OGL rules text in the compendium.
export const RULE_CARDS = [
  // ---------------- MAGIC ----------------
  { title: 'Casting Defensively', cat: 'Magic', tags: 'concentration aoo attack of opportunity provoke spell',
    body: `<p>Casting a spell normally provokes attacks of opportunity. Instead, you may <b>cast defensively</b> to avoid provoking.</p>
      <ul><li>Make a <b>concentration check</b>: d20 + caster level + casting ability modifier.</li>
      <li><b>DC = 15 + (2 × spell level)</b>.</li><li>Fail: the spell is lost (the slot or prepared spell is used up).</li>
      <li>Decide before casting. The Combat Casting feat gives +4.</li></ul>
      <table class="tbl mini"><tr><th>Spell lvl</th><td>0</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td></tr>
      <tr><th>DC</th><td>15</td><td>17</td><td>19</td><td>21</td><td>23</td><td>25</td><td>27</td><td>29</td><td>31</td><td>33</td></tr></table>`,
    see: [['Casting Defensively', 'Rules'], ['Concentration', 'Rules'], ['Combat Casting', 'Feat']] },
  { title: 'Concentration Check DCs', cat: 'Magic', tags: 'concentration damage grappled entangled vigorous motion weather',
    body: `<p>Check = <b>d20 + caster level + casting ability modifier</b>. Fail and the spell is lost.</p>
      <table class="tbl mini">
      <tr><th>Situation</th><th>DC</th></tr>
      <tr><td>Casting defensively</td><td>15 + 2× spell level</td></tr>
      <tr><td>Injured while casting (e.g. AoO, readied attack)</td><td>10 + damage taken + spell level</td></tr>
      <tr><td>Continuous damage (e.g. acid arrow)</td><td>10 + ½ damage + spell level</td></tr>
      <tr><td>Affected by a non-damaging spell</td><td>That spell's DC + spell level</td></tr>
      <tr><td>Grappled or pinned</td><td>10 + grappler's CMB + spell level</td></tr>
      <tr><td>Entangled</td><td>15 + spell level</td></tr>
      <tr><td>Vigorous motion (moving mount, rough boat)</td><td>10 + spell level</td></tr>
      <tr><td>Violent motion (galloping, stormy seas)</td><td>15 + spell level</td></tr>
      <tr><td>Extremely violent motion (earthquake)</td><td>20 + spell level</td></tr>
      <tr><td>High wind with rain or sleet</td><td>5 + spell level</td></tr>
      <tr><td>Wind-driven hail, dust, or debris</td><td>10 + spell level</td></tr></table>`,
    see: [['Concentration', 'Rules']] },
  { title: 'Touch Spells & Holding the Charge', cat: 'Magic', tags: 'touch attack spell discharge melee touch ranged touch',
    body: `<ul><li>Casting a touch spell lets you deliver it the same round: one <b>free-action</b> touch as part of casting (melee touch attack).</li>
      <li>If you don't discharge it, you can <b>hold the charge</b> indefinitely. Later, delivering it is a standard action (or part of a full attack via natural/unarmed attacks).</li>
      <li>Touching anything (even accidentally) discharges it. Casting another spell dissipates the held charge.</li>
      <li>While holding a charge you <b>threaten</b> as if armed, and can deliver the spell with an unarmed strike or natural attack (normal damage + spell).</li>
      <li>Touching allies: up to six willing creatures in a full-round action, if the spell allows multiple targets.</li></ul>`,
    see: [['Touch Spells in Combat', 'Rules'], ['Holding the Charge', 'Rules']] },
  { title: 'Spell Resistance', cat: 'Magic', tags: 'sr caster level check',
    body: `<p>To affect a creature with SR, roll <b>d20 + caster level</b> ≥ the creature's SR. Only spells marked "Spell Resistance: yes" are affected.
      A creature can voluntarily lower its SR as a standard action. Spell Penetration gives +2 (+4 with Greater).</p>`,
    see: [['Spell Resistance', 'Rules']] },
  { title: 'Bonus Spells', cat: 'Magic', tags: 'ability score extra spells per day',
    body: `<p>A high casting ability score grants bonus spells for each spell level ≤ the modifier:
      bonus at level L = 1 + ⌊(mod − L) ÷ 4⌋ (none for level 0). You need a score of at least 10 + spell level to cast a spell of that level.
      The sheet calculates this automatically.</p>`, see: [['Ability Score Bonuses', 'Rules']] },
  { title: 'Arcane Spell Failure', cat: 'Magic', tags: 'armor asf somatic',
    body: `<p>Arcane spells with somatic components fail on a d% roll ≤ total ASF from armor and shields. Bards (light armor), magi (light, later medium/heavy), and others ignore ASF for their class spells in specific armor. Divine spells ignore ASF.</p>`,
    see: [['Arcane Spell Failure', 'Rules']] },
  { title: 'Counterspelling & Identifying', cat: 'Magic', tags: 'spellcraft identify ready counterspell',
    body: `<ul><li>Identify a spell being cast: Spellcraft DC <b>15 + spell level</b> (free, no action).</li>
      <li>To counterspell: ready an action, identify the spell, then cast the same spell (or dispel magic) to counter it.</li>
      <li>Identify magic item properties (with detect magic): Spellcraft DC 15 + item CL.</li></ul>`,
    see: [['Counterspells', 'Rules'], ['Spellcraft', 'Skill']] },

  // ---------------- COMBAT ----------------
  { title: 'Touch Attacks', cat: 'Combat', tags: 'touch ac armor ignore ray',
    body: `<p>A touch attack only needs to make contact. Your target's <b>touch AC</b> ignores armor, shield, and natural armor bonuses.
      Size, Dexterity, deflection, dodge, and most other bonuses (insight, luck, morale, sacred, profane) still apply.</p>
      <ul><li>Melee touch = BAB + Str. Ranged touch (rays) = BAB + Dex.</li><li>Rays can score critical hits. Ranged touch into melee takes the −4 penalty (Precise Shot negates).</li></ul>`,
    see: [['Touch Attacks', 'Rules']] },
  { title: 'Attacks of Opportunity', cat: 'Combat', tags: 'aoo provoke threatened square combat reflexes',
    body: `<p>You get one AoO per round (more with Combat Reflexes) against a foe in a square you threaten who:</p>
      <ul><li><b>Moves out of</b> a threatened square (not a 5-ft step, and not the first square of a withdraw)</li>
      <li>Casts a spell (unless cast defensively) or uses a spell-like ability</li>
      <li>Makes a ranged attack, or an unarmed attack without Improved Unarmed Strike</li>
      <li>Stands up from prone, drinks a potion, reads a scroll, or retrieves a stored item</li>
      <li>Attempts most combat maneuvers without the matching Improved feat</li></ul>
      <p>Flat-footed creatures can't make AoOs. Moving through several threatened squares of the same enemy only provokes once.</p>`,
    see: [['Attacks of Opportunity', 'Rules'], ['Combat Reflexes', 'Feat']] },
  { title: 'Actions in a Round', cat: 'Combat', tags: 'standard move swift free immediate full-round action economy',
    body: `<p>Each turn: <b>1 standard + 1 move</b>, <i>or</i> <b>1 full-round</b> action. Plus <b>1 swift</b> (or immediate), and any number of free actions.</p>
      <ul><li>You can trade your standard action for a second move action.</li>
      <li>An immediate action uses up your next swift action.</li>
      <li>A <b>5-foot step</b> is free if you don't otherwise move that round. It doesn't provoke and isn't allowed in difficult terrain.</li>
      <li>Full attack (multiple iterative attacks) is a full-round action, with a 5-ft step allowed.</li></ul>`,
    see: [['Action Types', 'Rules'], ['Full-Round Actions', 'Rules']] },
  { title: 'Flanking', cat: 'Combat', tags: 'flank +2 sneak attack opposite',
    body: `<p>When you and an ally threaten the same foe from <b>opposite sides</b> (a line between your centers passes through opposite borders), you each get <b>+2 on melee attacks</b> against it.
      Rogues deal sneak attack to flanked foes. Creatures with all-around vision or improved uncanny dodge can't be flanked (by lower-level rogues).</p>`,
    see: [['Flanking', 'Rules']] },
  { title: 'Charge', cat: 'Combat', tags: 'charge +2 attack -2 ac double move',
    body: `<ul><li>Full-round action: move up to <b>double speed</b> in a straight line (at least 10 ft.) and make one melee attack.</li>
      <li><b>+2 on the attack</b>, <b>−2 to AC</b> until your next turn.</li><li>The path must be unobstructed, with no difficult terrain or allies blocking.</li>
      <li>With a surprise-round standard action, you can charge up to your speed.</li><li>Lances deal double damage when charging on a mount.</li></ul>`,
    see: [['Charge', 'Rules']] },
  { title: 'Fighting Defensively & Total Defense', cat: 'Combat', tags: 'defensive dodge acrobatics',
    body: `<ul><li><b>Fighting defensively</b> (with a standard or full attack): −4 on attacks, +2 dodge AC (+3 with 3 ranks of Acrobatics).</li>
      <li><b>Total defense</b> (standard action): +4 dodge AC (+6 with 3 ranks of Acrobatics). You can't attack or make AoOs.</li>
      <li><b>Combat Expertise</b>: −1 attack / +1 dodge AC per 4 BAB (min 1).</li></ul>`,
    see: [['Fighting Defensively as a Standard Action', 'Rules'], ['Total Defense', 'Rules']] },
  { title: 'Combat Maneuvers', cat: 'Combat', tags: 'cmb cmd bull rush disarm grapple trip sunder overrun reposition steal drag dirty trick',
    body: `<p><b>CMB</b> = BAB + Str + special size modifier. <b>CMD</b> = 10 + BAB + Str + Dex + special size modifier (+ deflection, dodge, insight, luck, morale, profane, and sacred bonuses to AC).</p>
      <p>Most maneuvers <b>provoke an AoO</b> unless you have the matching Improved feat (+2 bonus, and +2 to your CMD against it).</p>
      <table class="tbl mini"><tr><th>Maneuver</th><th>Success</th></tr>
      <tr><td>Bull rush</td><td>Push 5 ft. +5 ft. per 5 you beat CMD</td></tr>
      <tr><td>Dirty trick</td><td>Blinded/dazzled/deafened/entangled/shaken/sickened 1 rd (+1 rd per 5)</td></tr>
      <tr><td>Disarm</td><td>Target drops item (fail by 10+: you drop yours)</td></tr>
      <tr><td>Drag</td><td>Pull 5 ft. +5 per 5</td></tr>
      <tr><td>Grapple</td><td>Both grappled (standard action)</td></tr>
      <tr><td>Overrun</td><td>Move through; beat by 5+ to knock prone</td></tr>
      <tr><td>Reposition</td><td>Move foe 5 ft. +5 per 5 within your reach</td></tr>
      <tr><td>Steal</td><td>Take an unattended-ish item</td></tr>
      <tr><td>Sunder</td><td>Damage an item</td></tr>
      <tr><td>Trip</td><td>Target falls prone (fail by 10+: you fall)</td></tr></table>
      <p class="small">Special size modifier: Fine −8, Dim −4, Tiny −2, Small −1, Medium 0, Large +1, Huge +2, Garg +4, Col +8.</p>`,
    see: [['Combat Maneuvers', 'Rules'], ['Combat Maneuver Bonus', 'Rules'], ['Combat Maneuver Defense', 'Rules']] },
  { title: 'Grapple', cat: 'Combat', tags: 'grappled pin pinned escape maintain',
    body: `<ul><li>Start: standard action CMB vs CMD (provokes without Improved Grapple). On success both are <b>grappled</b>.</li>
      <li>Grappled: can't move, −4 Dex, −2 on attacks and CMB (except to grapple/escape), no two-handed actions. Casting needs concentration DC 10 + grappler's CMB + spell level.</li>
      <li>Maintain (standard, +5 bonus if you grappled last round): move, damage, pin, or tie up.</li>
      <li><b>Pinned</b>: flat-footed, −4 AC, can only try to escape (or verbal-only spells).</li>
      <li>Escape: CMB or Escape Artist vs grappler's CMD, as a standard action.</li></ul>`,
    see: [['Grapple', 'Rules'], ['Grappled', 'Condition'], ['Pinned', 'Condition']] },
  { title: 'Cover & Concealment', cat: 'Combat', tags: 'cover concealment miss chance reflex soft cover',
    body: `<table class="tbl mini"><tr><th></th><th>Effect</th></tr>
      <tr><td>Cover</td><td>+4 AC, +2 Reflex. Target can't be targeted by AoOs from you.</td></tr>
      <tr><td>Partial cover</td><td>+2 AC, +1 Reflex</td></tr><tr><td>Improved cover</td><td>+8 AC, +4 Reflex (improved evasion)</td></tr>
      <tr><td>Soft cover (creatures)</td><td>+4 AC vs ranged only</td></tr>
      <tr><td>Concealment</td><td>20% miss chance</td></tr><tr><td>Total concealment</td><td>50% miss chance; you must guess the square</td></tr></table>`,
    see: [['Cover', 'Rules'], ['Concealment', 'Rules']] },
  { title: 'Attack Roll Modifiers', cat: 'Combat', tags: 'prone higher ground invisible squeezing dazzled shooting into melee',
    body: `<table class="tbl mini"><tr><th>Attacker is…</th><th>Melee</th><th>Ranged</th></tr>
      <tr><td>Dazzled</td><td>−1</td><td>−1</td></tr><tr><td>Entangled</td><td>−2</td><td>−2</td></tr>
      <tr><td>Flanking defender</td><td>+2</td><td>—</td></tr><tr><td>Invisible</td><td>+2 (ignore Dex)</td><td>+2 (ignore Dex)</td></tr>
      <tr><td>On higher ground</td><td>+1</td><td>+0</td></tr><tr><td>Prone</td><td>−4</td><td>no (except crossbow)</td></tr>
      <tr><td>Shaken/frightened</td><td>−2</td><td>−2</td></tr><tr><td>Squeezing</td><td>−4</td><td>−4</td></tr>
      <tr><td>Shooting into melee</td><td>—</td><td>−4 (Precise Shot)</td></tr></table>
      <table class="tbl mini"><tr><th>Defender is…</th><th>vs Melee</th><th>vs Ranged</th></tr>
      <tr><td>Prone</td><td>−4 AC</td><td>+4 AC</td></tr><tr><td>Pinned</td><td>−4 AC</td><td>−4 AC</td></tr>
      <tr><td>Blinded</td><td>−2 AC, loses Dex</td><td>−2 AC, loses Dex</td></tr><tr><td>Flat-footed</td><td>loses Dex</td><td>loses Dex</td></tr>
      <tr><td>Helpless</td><td>−4 + Dex 0 (coup de grace)</td><td>Dex 0</td></tr><tr><td>Squeezing</td><td>−4 AC</td><td>−4 AC</td></tr></table>`,
    see: [['Combat Modifiers', 'Rules']] },
  { title: 'Two-Weapon Fighting', cat: 'Combat', tags: 'twf off-hand penalty light weapon',
    body: `<table class="tbl mini"><tr><th>Circumstance</th><th>Primary</th><th>Off hand</th></tr>
      <tr><td>Normal</td><td>−6</td><td>−10</td></tr><tr><td>Off-hand weapon is light</td><td>−4</td><td>−8</td></tr>
      <tr><td>Two-Weapon Fighting feat</td><td>−4</td><td>−4</td></tr><tr><td>Light off-hand + TWF feat</td><td>−2</td><td>−2</td></tr></table>
      <p>Off-hand attacks add ½ Str to damage. Improved/Greater TWF add a 2nd/3rd off-hand attack at −5/−10.</p>`,
    see: [['Two-Weapon Fighting', 'Rules'], ['Two-Weapon Fighting', 'Feat']] },
  { title: 'Critical Hits', cat: 'Combat', tags: 'crit threat confirm multiplier natural 20',
    body: `<ul><li>A roll in the weapon's threat range (natural 20, or e.g. 19–20) that hits is a <b>threat</b>. Roll again with the same bonus: if it hits AC, it's confirmed.</li>
      <li>Multiply the weapon damage, including Str, enhancement, and Power Attack. <b>Don't</b> multiply extra dice (sneak attack, flaming) or precision damage.</li>
      <li>A natural 20 always hits; a natural 1 always misses. Immune creatures (many oozes and elementals) ignore crits.</li></ul>`,
    see: [['Critical Hits', 'Rules']] },
  { title: 'Flat-Footed & Surprise', cat: 'Combat', tags: 'flat-footed initiative surprise round uncanny dodge',
    body: `<p>Before your first turn in combat you're <b>flat-footed</b>: you lose your Dex bonus to AC (and CMD) and can't make AoOs (unless you have Combat Reflexes). In a surprise round, aware creatures get one standard or move action.</p>`,
    see: [['Flat-Footed', 'Condition'], ['Surprise', 'Rules']] },
  { title: 'Readying & Delaying', cat: 'Combat', tags: 'ready delay initiative trigger',
    body: `<ul><li><b>Ready</b> (standard action): prepare a standard, move, swift, or free action with a trigger. It resolves just before the trigger. Your initiative moves to just before the triggering creature.</li>
      <li><b>Delay</b> (no action): act later in the round. Your new initiative becomes the count where you act.</li></ul>`,
    see: [['Ready', 'Rules'], ['Delay', 'Rules']] },
  { title: 'Stacking Bonuses', cat: 'Character', tags: 'stack bonus type morale enhancement dodge circumstance',
    body: `<p>Bonuses of the <b>same type don't stack</b>; only the highest applies. Exceptions: <b>dodge</b> bonuses, <b>circumstance</b> bonuses from different sources, and <b>untyped</b> bonuses from different sources all stack. Penalties stack unless they come from the same source.</p>
      <p class="small">Common types: alchemical, armor, circumstance, competence, deflection, dodge, enhancement, insight, luck, morale, natural armor, profane, racial, resistance, sacred, shield, size, trait.</p>`,
    see: [['Bonus Types', 'Rules'], ['Stacking Effects', 'Rules']] },

  // ---------------- HEALTH ----------------
  { title: 'Dying, Disabled & Death', cat: 'Health', tags: 'hp 0 negative stabilize heal con',
    body: `<ul><li><b>0 HP: disabled</b>. Staggered (one move or standard action). A strenuous action deals 1 damage after it.</li>
      <li><b>Negative HP: dying</b>. Unconscious; each turn make a <b>DC 10 Con check</b> with a penalty equal to your negative HP. Fail: lose 1 HP. Success: stable.</li>
      <li><b>Dead</b> at negative HP equal to your Con score.</li>
      <li>An ally can stabilize you with a DC 15 Heal check, or any magical healing.</li></ul>`,
    see: [['Dying', 'Rules'], ['Disabled', 'Condition'], ['Stable Characters and Recovery', 'Rules']] },
  { title: 'Nonlethal Damage', cat: 'Health', tags: 'nonlethal staggered unconscious subdual',
    body: `<p>Track separately. Nonlethal = current HP: <b>staggered</b>. Nonlethal > current HP: <b>unconscious</b>. Heals 1 per character level per hour, and magical healing cures an equal amount. Lethal weapons deal nonlethal at −4 on attacks.</p>`,
    see: [['Nonlethal Damage', 'Rules']] },
  { title: 'Natural Healing & Rest', cat: 'Health', tags: 'rest healing heal skill long-term care ability damage',
    body: `<ul><li>Full night's rest (8 hours): recover <b>1 HP per character level</b> and 1 point of ability damage per ability.</li>
      <li>Complete bed rest for a day: 2 HP/level.</li><li>Long-term care (Heal DC 15) doubles natural healing.</li>
      <li>Spellcasters need 8 hours' rest to regain spells (prepared casters also need 1 hour of preparation).</li></ul>`,
    see: [['Natural Healing', 'Rules'], ['Heal', 'Skill']] },

  // ---------------- MOVEMENT / ENVIRONMENT ----------------
  { title: 'Movement & Terrain', cat: 'Movement', tags: 'difficult terrain diagonal run withdraw double move',
    body: `<ul><li>Diagonals alternate 5 ft. / 10 ft.</li><li><b>Difficult terrain</b> costs double. No 5-ft step or charge through it.</li>
      <li><b>Run</b> (full-round): ×4 speed (×3 in heavy armor) in a straight line. You lose your Dex bonus to AC.</li>
      <li><b>Withdraw</b> (full-round): move up to double speed. The first square you leave doesn't provoke.</li>
      <li>Medium/heavy armor or load: speed 30 → 20, 20 → 15.</li></ul>`,
    see: [['Movement', 'Rules'], ['Run', 'Rules'], ['Withdraw', 'Rules']] },
  { title: 'Acrobatics in Combat', cat: 'Movement', tags: 'tumble move through threatened acrobatics dc',
    body: `<ul><li>Move through threatened squares at half speed without provoking: Acrobatics vs <b>target's CMD</b> (+2 for each additional foe).</li>
      <li>Move through an enemy's square: vs CMD + 5.</li><li>At full speed: −10 penalty.</li>
      <li>Jump: DC = distance (long jump) or 4 × height (high jump), with a 10-ft. running start (doubled DC otherwise).</li></ul>`,
    see: [['Acrobatics', 'Skill']] },
  { title: 'Carrying Capacity', cat: 'Character', tags: 'encumbrance load weight strength',
    body: `<p>Loads (light/medium/heavy) depend on Strength; see the calculator below. Medium load: max Dex +3, ACP −3, reduced speed. Heavy: max Dex +1, ACP −6, reduced speed, run ×3.
      Lift over head = heavy load; off the ground = 2×; push/drag = 5×. Small creatures carry ¾ as much, Large 2×.</p>`,
    see: [['Carrying Capacity', 'Rules']] },
  { title: 'Falling, Suffocation & Hazards', cat: 'Movement', tags: 'falling damage drowning hold breath',
    body: `<ul><li>Falling: 1d6 per 10 ft. (max 20d6). Intentional jump or Acrobatics DC 15 makes the first 1d6 nonlethal. Falling into water: first 20 ft. nonlethal.</li>
      <li>Hold breath: 2 × Con rounds, then a DC 10 Con check each round (+1 per check). Failure: unconscious, then dying.</li></ul>`,
    see: [['Falling', 'Rules'], ['Suffocation', 'Rules']] },

  // ---------------- CHARACTER ----------------
  { title: 'Leveling Up Checklist', cat: 'Character', tags: 'level up hp feat skills favored class ability increase',
    body: `<ol><li>Choose class; gain its hit die (average = ½ HD + 1 is common in organized play) + Con modifier.</li>
      <li>Favored class bonus: +1 HP or +1 skill rank (or race-specific alternate).</li>
      <li>Skill ranks: class ranks + Int (min 1), +1 for humans. Max ranks = character level.</li>
      <li>Feat at every odd level (1, 3, 5…). +1 ability score at 4, 8, 12, 16, 20.</li>
      <li>Update BAB, saves, class features, spells. The <b>Level Up</b> tab does all of this for you.</li></ol>`, see: [] },
  { title: 'Skill Checks Basics', cat: 'Character', tags: 'take 10 take 20 aid another untrained class skill',
    body: `<ul><li>Class skills get <b>+3</b> once they have at least 1 rank.</li>
      <li><b>Take 10</b>: when not threatened or distracted. <b>Take 20</b>: when you have 20× the time and failure has no consequence.</li>
      <li><b>Aid another</b>: DC 10 check gives an ally +2.</li><li>Trained-only skills can't be used without ranks.</li></ul>`,
    see: [['Using Skills', 'Rules'], ['Aid Another', 'Rules']] },
  { title: 'Saving Throws', cat: 'Character', tags: 'fortitude reflex will save natural 1 20',
    body: `<p>Fortitude (Con), Reflex (Dex), Will (Wis). A natural 20 always succeeds and a natural 1 always fails. Save DC for spells = 10 + spell level + caster's ability modifier.
      Evasion: successful Reflex vs half damage means no damage.</p>`, see: [['Saving Throws', 'Rules']] },
];

export const RULE_CATS = ['Magic', 'Combat', 'Health', 'Movement', 'Character'];

// Conditions shown as compact chips (open the full condition entry when clicked)
export const CONDITIONS = ['Bleed', 'Blinded', 'Broken', 'Confused', 'Cowering', 'Dazed', 'Dazzled', 'Dead', 'Deafened', 'Disabled',
  'Dying', 'Energy Drained', 'Entangled', 'Exhausted', 'Fascinated', 'Fatigued', 'Flat-Footed', 'Frightened', 'Grappled',
  'Helpless', 'Incorporeal', 'Invisible', 'Nauseated', 'Panicked', 'Paralyzed', 'Petrified', 'Pinned', 'Prone', 'Shaken',
  'Sickened', 'Stable', 'Staggered', 'Stunned', 'Unconscious'];
