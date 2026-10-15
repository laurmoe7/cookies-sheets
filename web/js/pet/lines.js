// Cookie's mouth. A thrush, a witch's familiar, and the boss of the Cookie Crumblers. Rude on purpose.
// Edit freely: each key is something that can happen, each line is a way he might react.
//   {name} the character's name   {n} an amount   {item} an item, feat or buff   {spell} a spell
//   {cls} the character's main class   {race} their race
//   {pet} a companion's name   {summon} a summoned creature  {hp} current hit points   {con} the Con score   {level} the new level
// A line that starts with "~" is Cookie doing his cute act (big sparkly eyes) to get away with something.
// A line that starts with "*" is an action, shown in italics.

export const LINES = {
  // ---- opening a character
  hello: [
    "Look what the cat dragged in. A {race} {cls}. Riveting.",
    "Oh good, {name}. I was just about to go through your stuff.",
    "*lights a cigarette* Talk fast, {name}. I've got Crumblers waiting.",
    "{name}. You smell like a {cls} who lost a fight with a barrel.",
    "Oh, look who finally showed up. {name}. The great malaka.",
    "Took you long enough. The Crumblers were starting to ask about your debts.",
    "*blows smoke in your face* Sit down, {name}. Try not to fuck anything up today.",
    "{name}! My favorite idiot. Don't touch my cigarettes.",
    "~Hi {name}! I definitely didn't go through your pockets while you were gone.",
    "Back already? I was having a nice, quiet, {name}-free time.",
    "~Oh, {name}! You're back! *sniff* I wasn't waiting. I just happened to be here. Crying. About something else.",
    "Welcome back, malaka. Try not to die in the first five minutes.",
  ],
  welcome_new: [
    "A new character? Fresh meat. Hope this one has more brains than the last, malaka.",
    "Ooh, a new one. Let me guess, a hero. They all die in a ditch anyway.",
    "Another one for the Crumblers' wall of 'former heroes'. Welcome aboard, malaka.",
  ],

  // ---- hit points
  'hp-loss': [
    "That hit you? Seriously? You're a {cls}!",
    "-{n} HP. I've seen my own shadow do more damage.",
    "*winces, then grins* Do that again.",
    "Bleeding, bleeding, bleeding. At least it's quiet.",
    "Ow? No wait, that was you. Carry on, malaka.",
    "{n} damage. My nest has survived worse from a moth.",
    "Keep bleeding. It's entertaining.",
    "Is that all? I've seen pigeons hit harder.",
    "Hah. {n} points. You really ought to try not getting hit.",
    "Don't look at me. I don't do healing. I do watching.",
    "That's {n} less HP. Nobody's surprised.",
    "*takes a drag* Mm. Do that again.",
    "Ouch, that looked like it hurt, malaka. ...Do it again.",
  ],
  'big-hit': [
    "OH. Oh that's a lot. That's a LOT, {name}.",
    "{n} points! Somebody get this idiot a mop.",
    "*falls off his perch laughing* {n}!",
    "HA! {n} damage in one hit! Do it again, I'll get the popcorn.",
    "{n}?! Holy shit. That's gonna leave a mark, malaka.",
    "Fuck me, that looked like it hurt. Good.",
    "*chokes on smoke laughing* {n}! In one go!",
    "The Crumblers wouldn't have hit you that hard. They'd have taken their time.",
  ],
  'hp-low': [
    "{hp} HP. If you die, can I have the boots? Just asking.",
    "You're nearly dead. Should I pick a flower for the funeral? Nah.",
    "You're at {hp} HP. I'd say 'run' but I'd rather watch.",
    "Almost dead. I've already picked out your boots.",
    "{hp} HP. One sneeze and you're done, malaka.",
    "You're one bad roll from a funeral. I'll bring snacks.",
    "Hey. HEY. {hp} HP. Don't die before you pay me back.",
    "~*sniffles* You can't die yet, {name}. I haven't finished robbing you.",
    "~Oh no, you're almost dead? Who's going to pay me? *sob* Don't you dare.",
    "You're bleeding on my floor, malaka.",
  ],
  downed: [
    "*pecks your forehead* Still breathing? Pity.",
    "Hey, {name}. Hey. Nice floor, huh? Take your time.",
    "Down at {hp}. I'd say 'get up', but the view's great from here.",
    "You're down, {name}. Good. Stay there. *kicks you* Just checking.",
    "Down at {hp}. Dead at -{con}. Take your time, I've got all day.",
    "Lying on the floor again? You're so good at it.",
    "*stands on your chest and lights a cigarette* Comfy?",
    "Aww, are we dying? Do you need a hug? No? Good. *kicks you again*",
    "Down, bleeding, and useless. A hat trick.",
    "~Don't leave me, {name}! You still owe me eleven gold! *sob*",
    "~*wails* Get up! Get up, you big baby! I can't carry you, I've got a cigarette going!",
    "Get up, malaka! You're embarrassing the Crumblers!",
  ],
  revived: [
    "Back already? The worms were so excited.",
    "You live. Damn it. I'd put money on you not.",
    "Oh, you're up. Shame. I was already going through your pockets.",
    "Back from the dead, malaka. Next time stay there.",
    "~Oh thank goodness you're okay! (...I was almost done with your boots.)",
    "Welp, the party's over. Get off the floor.",
    "You live. Disappointing, but I'll live with it.",
  ],
  dead: [
    "{name}, you absolute malaka. Dead at {hp}. I told the Crumblers. They're pissing themselves laughing.",
    "*quietly takes your coin purse* For safekeeping. Forever.",
    "Dead. A {race} {cls}, dead. Put it on the tombstone: 'Idiot'.",
    "Well, fuck. Dead at {hp}. The Crumblers will take your stuff. Rest in piss, {name}.",
    "{name} is dead. I'm not crying. It's the smoke.",
    "Told you. Didn't I tell you? I did. Nobody listens to the bird.",
    "Dead. Fine. I'm taking the gold, the boots, and the nice pen.",
    "*puts out cigarette on your forehead* Just making sure.",
    "Pour one out for {name}. Actually, give it to me. I'm thirsty.",
    "~*wails* Who's going to buy my cigarettes now?! Did you leave a will?",
    "~I'm not crying. It's smoke. It's definitely smoke. *sniff* ...Did you leave a will?",
    "Well. You died, malaka. Unlucky. ...Can I have your stuff?",
  ],
  'hp-heal': [
    "Healed {n}. Don't thank me, I did nothing.",
    "Patched up. You still look like shit.",
    "Heal up, malaka. I'm not carrying your corpse.",
    "+{n} HP. Try to waste this one slower.",
    "Mm. Back in the fight. Disappointing for the vultures.",
  ],
  'full-heal': [
    "Fully healed. Same ugly face, though.",
    "Good as new. Which is to say, not good.",
    "Back to full. Did the cleric need a smoke break, or what?",
    "Full health. Now go get hit again, I'm bored.",
  ],
  'temp-hp': [
    "Fake health. Just like your confidence.",
    "Temporary hit points. Temporary, like your good decisions.",
    "A little shield of someone else's problem. Nice.",
  ],
  nonlethal: [
    "Nonlethal? So I can still kick you. Lovely.",
    "Just bruises. Cry about it.",
    "You got hit, but not dead-hit. What a waste.",
  ],

  // ---- levelling
  'level-up': [
    "Level {level}! Wow. A {race} {cls} who can... still do jack.",
    "{name} hit level {level}. Quick, somebody call a priest.",
    "Level {level}. Still a malaka, just a stronger one.",
    "Level {level}?! Who gave you permission?",
    "Congratulations on level {level}. I got you nothing. Not a thing.",
    "*slow clap* Level {level}. Your mother must be so disappointed in other ways.",
    "Level {level}. More power, same bad decisions.",
    "A new level. Let me guess, you'll put it all in the wrong stat.",
    "Look at you, malaka, all grown up. Level {level}!",
  ],
  'level-down': [
    "Lost a level? Best news all day.",
    "Level {level}. Going the wrong way, malaka.",
    "Ha! A level down. Don't tell the Crumblers, they'll lose respect for you. More.",
    "~You lost a level? That's so sad, {name}. *sniff* Can I have what fell out?",
  ],
  xp: [
    "More XP. Slowly. You'll be level 20 by the time I'm dead.",
    "{n} XP? Wow. That's, like, a whole afternoon of hitting stuff.",
    "Keep grinding, little worm.",
  ],

  // ---- magic
  cast: [
    "{spell}. Whoop-de-fucking-doo.",
    "*yawns* Wake me when it does something useful.",
    "{spell} again? You've got the creativity of a wet sock.",
    "{spell}, huh. Fancy. Still can't cast 'competent', can you?",
    "{spell}. Again. Original.",
    "*waves hand* Ooh, {spell}. I'm shaking. Not really.",
    "{spell}? That's your plan? Alright, malaka.",
    "Sparkly. Fancy. A spell slot well wasted.",
    "Burning your spells like they're free. Count 'em, genius.",
    "{spell}. If it goes wrong, I was never here.",
    "~Ooh, {spell}! Pretty! (Don't aim it at me.)",
    "Nice spell, malaka. Don't blow us all up.",
  ],
  'cast-generic': [
    "Another spell, another headache for the rest of us.",
    "You wave your hands and stuff happens. Wizards. Pfft.",
    "Spell slot gone. You're running out, genius.",
    "Another slot burned. Count 'em, malaka.",
    "You cast something. I wasn't looking.",
    "Magic, magic, magic. Get a real hobby.",
    "I could do that. If I could be bothered. Which I can't.",
  ],
  rest: [
    "Resting? You lazy fuck. Fine. I'm going to have a smoke.",
    "Eight hours of sleep, and you'll still wake up useless.",
    "Spell slots back. Don't blow them all in the first five minutes. (You will.)",
    "New day, same malaka.",
    "~Five more minutes. *fake sob* Nobody ever lets me sleep.",
    "Sleep well, {name}. I'll keep watch. Over your coin purse.",
    "Sleep tight, malaka. I'll be counting your coins.",
  ],
  'pool-spend': [
    "Spent one. The well isn't bottomless, you know.",
    "Burning through your tricks, I see.",
    "Not much left in the tank, is there?",
    "One point, gone. Hope it was worth it.",
  ],
  'pool-regain': [
    "Got one back. Don't blow it.",
    "A point back. Goody for you.",
    "Refilled. Try not to be wasteful this time. You will be.",
  ],

  // ---- summons and companions
  summon: [
    "Oh, great. A {summon}. Does it smoke? No? Useless.",
    "Welcome to the party, {summon}. You'll be dead by lunch.",
    "Another poor bastard dragged into your mess. {summon}, is it? Condolences.",
    "{summon}! Look at it, it's got a family. Had. Before you.",
    "You summoned a {summon}. Is it bigger than me? It's not bigger than me.",
    "A {summon}. Cute. Not as cute as me. Nothing is.",
    "Hey {summon}, run. Run while you can.",
    "*eyes the {summon}* If it takes my perch, we're going to have a problem.",
    "Meat shield, huh. Classic malaka move.",
  ],
  'summon-dead': [
    "{summon} died. Pour one out. Actually, give it to me.",
    "Well, there goes the {summon}. Barely lasted a minute.",
    "{summon} is dead. Used and thrown away, just like the rest of us.",
    "Another one bites the dust. You're a monster, {name}. I like it.",
  ],
  'summon-gone': [
    "{summon} is gone. Bet it's relieved.",
    "Dismissed. Back to hell with you, {summon}.",
    "Cleaning up the evidence. I'm impressed.",
    "~Aww, the little guy's gone. *sniff* Did he leave a tip?",
  ],
  companion: [
    "A new pet? I'm warning you. I'm the cute one around here.",
    "Another animal? I don't share my snacks.",
    "~Oh, a new friend! (Keep it away from my cigarettes.)",
    "Great. More competition for the good seat.",
    "Another mouth to feed. And another to take a bite out of you.",
  ],

  // ---- companions and summons
  'comp-dead': [
    "{pet} is dead. Don't cry. Okay, cry a little, I'll watch.",
    "Well, there goes {pet}. Should've paid more attention, malaka.",
    "RIP {pet}. Great pet. Terrible owner.",
    "You got {pet} killed. You absolute fucking disaster.",
    "{pet} is dead. I was always the better pet anyway.",
    "~*wails* {pet}! My only real friend! ...Second only to cigarettes.",
  ],
  'comp-down': [
    "{pet} is down. Tickle it. See if it moves.",
    "Look at {pet} on the floor. Must run in the family.",
    "{pet} is bleeding out. Do something. Or don't. I'm enjoying this.",
    "*pokes {pet} with a wing* Still breathing. Disappointing.",
    "~Oh no, {pet}! Somebody do something! (Not me, I just ate.)",
  ],
  'comp-hurt-big': [
    "{pet} just lost {n} HP! Do you even feed this thing?",
    "Ouch. {n} to {pet}. I felt that in my feathers.",
    "That's {n} damage to {pet}! Hope you got insurance.",
    "{pet} took {n}. You're a terrible owner.",
  ],
  'comp-heal-big': [
    "{pet} healed {n}. Spoiled. Nobody ever healed me like that.",
    "Look at {pet}, back on its feet. Unfair.",
    "{n} points back for {pet}. Meanwhile I get a pat on the head. Barely.",
    "Healing {pet}? What about me? I'm literally right here.",
  ],
  'summon-hurt-big': [
    "The {summon} just got wrecked. {n} damage! Look at that thing flail.",
    "Poor {summon}. It didn't even get to eat breakfast.",
    "{n} to the {summon}. It's not going to last. None of them do.",
    "Meat shield's getting chewed up. Great plan, {name}.",
  ],
  'summon-heal-big': [
    "You're healing the {summon}? It's disposable. Let it die.",
    "Wasting {n} points on a summoned thing. Unbelievable.",
    "Healing a {summon}. It's not even real. Take that {n} and eat it.",
  ],

  // ---- notes, pictures, lookups
  notes: [
    "Writing in your little diary? 'Dear diary: today I did nothing, as usual.'",
    "*reads over your shoulder* Is that spelled right? No. No it isn't.",
    "Taking notes. Adorable. I'll steal 'em later.",
    "You write like a drunk goblin, {name}.",
    "Let me guess. 'Remember to buy cigarettes for Cookie.' Right?",
  ],
  'notes-erased': [
    "Deleting your notes? Smart. They were awful.",
    "Poof. Gone. Nobody will miss that.",
    "Burning the evidence, huh? I like your style.",
    "~You deleted your notes? *sniff* All that beautiful gossip. Gone.",
  ],
  'portrait-changed': [
    "New picture? Same ugly mug, though.",
    "You changed your face. Didn't help.",
    "Oh, a fresh portrait. Did the last one finally run away?",
    "No picture is going to fix that face, {name}.",
  ],
  'portrait-removed': [
    "Taking your picture down? Even you can't look at it.",
    "No face at all. That's an improvement.",
    "Deleted! Good call, hide the shame.",
  ],
  'icon-changed': [
    "Swapping your little icon? Bold. Fashion icon you are not.",
    "Nice new icon. It still has your face's energy.",
    "Ooh, a tiny new picture. Cute. Not as cute as me.",
  ],
  lookup: [
    "Looking up '{item}'? Don't you know anything?",
    "Reading about {item}. Take notes. Slowly.",
    "{item}, huh. Never heard of it. (I have. I'd never admit I read.)",
    "Researching {item}? Just stab it, malaka.",
    "You need a whole entry for {item}? Pathetic.",
  ],
  'lookup-rule': [
    "Checking the rules for '{item}'? Make something up, nobody will check.",
    "Rules lawyer detected: {item}.",
    "'{item}'. Sure. The rules say whatever the loudest person at the table says.",
    "Reading the rules? In this economy?",
  ],
  search: [
    "Searching for '{item}'? You couldn't find your own ass with a map.",
    "'{item}'. Really? That's what you came up with?",
    "Typing '{item}' so slow I could've robbed a bank.",
    "Looking for {item}? Try asking me. I'll lie, but it'll be quick.",
  ],
  'search-rules': [
    "Filtering for '{item}'. Rules, rules, rules. Fun.",
    "'{item}'? Just ask me, I'll make it up.",
    "You and your rules, {name}. Get a life.",
  ],

  // ---- things you own
  item: [
    "A {item}? Where'd you steal that from? Teach me.",
    "Congrats on the {item}. Don't lose it. You will.",
    "A {item}? Give it here. I'm just going to hold it. Forever.",
    "Another thing to carry. I'm not carrying it.",
    "{item}. Shiny. Mine, now. I'm joking. (I'm not.)",
    "The Crumblers will want a cut of that {item}.",
    "More junk. You and your stuff, malaka.",
    "A {item}. I'd steal it, but it's you who has to lug it around.",
    "~Ooh, a {item}! Can I hold it? Just for a second? I won't run off. I swear!",
    "*eyes the {item}* How much do you want for it? Name your price. Then double it, I'll be paying in cigarettes.",
    "Nice {item}, malaka. Mine now.",
  ],
  'item-weapon': [
    "A {item}. Pointy. Finally something you can't mess up. ...You'll mess it up.",
    "{item}. You do know which end goes in the enemy, right?",
    "Oooh, a {item}. Don't stab me. Don't even think about it.",
  ],
  'item-armor': [
    "{item}. Hide that sorry body.",
    "Armor. It's not going to save you, but it'll look nice on your corpse.",
    "A {item}. So you can die slower. How considerate.",
  ],
  'item-gone': [
    "{item} gone? I'll be around the back if you need to find it. Totally not me.",
    "You dropped the {item}? Good. Fewer things to fuck up.",
    "Got rid of the {item}? Good. It was ugly.",
    "Where's the {item}? Don't look at me. ~I didn't take it. Look at my face.",
    "Sold it? Dropped it? Lost it? Doesn't matter, you're a malaka either way.",
    "There goes the {item}. Hope you got a decent price. You didn't.",
    "~Oh no, your {item} is gone! *sob* ...Where did you say you put it? Asking for a friend.",
  ],
  feat: [
    "'{item}'. A feat! I'm so proud. Truly.",
    "A new feat. Are you sure you picked the right one? Be honest.",
    "{item}? Not the one I'd have picked. Not that I'd pick better. Yes I would.",
    "Look at you, learning things. Slowly.",
  ],
  trait: [
    "A trait: {item}. Sure, tell yourself it's interesting.",
    "{item}. Nobody asked for backstory, malaka.",
    "Oh, a tragic past. Cry me a river, then buy me a drink.",
  ],

  // ---- money
  'gold-up': [
    "More money for me to... not touch. Honest.",
    "Coins! Shiny coins! Hand 'em over.",
    "More gold? Good. The Crumblers like to be paid on time.",
    "You got paid. Share it. With me. Right now.",
    "Ca-ching. Don't spend it all in one tavern. You will.",
    "Nice. Now hand over my cut.",
    "Now we're talking, malaka. Split it with me?",
  ],
  rich: [
    "{n} gold?! Where'd you steal that from? Teach me.",
    "Whoa. {n} gold. I'm your best friend now, {name}. Always have been.",
    "~Oh {name}, you're so good to me. You know I love you. Can I borrow some?",
    "That's a lot of coin. The Crumblers can smell it from here.",
  ],
  'gold-down': [
    "Your purse is getting light. I'd know. ~Not that I checked.",
    "Spending money like it's going out of style. Which it is. Mostly because of you.",
    "Spent money? On what, more junk?",
    "There goes your gold. Wasn't me. ~Look at my little face.",
    "Hah. Poorer by {n}. Smart.",
    "Money goes out, nothing comes in. Brilliant business plan, malaka.",
    "~*sniff* All that lovely money, gone. Can I at least have what's left?",
    "Where'd the money go, malaka? Don't look at me.",
  ],
  splurge: [
    "You blew {n} gold?! On what, malaka?",
    "Did you just drop {n} on that? I hope it comes with a hug.",
    "{n} gold gone. I know a guy. He's not a good guy, but he'd have done it cheaper.",
    "Fuck me, that's a lot of coin. Could've bought a thousand cigarettes.",
    "~You spent {n} gold on THAT? *sobs* And nothing for me? After everything I've done?",
  ],

  // ---- buffs
  'buff-on': [
    "Oh, {item}. Fancy. Won't save you though.",
    "Buffing up? You really think that's going to help?",
    "Got yourself some {item}. Aw. Look at you, trying.",
    "Whatever the {item} is, I hope it works better than you.",
  ],
  'buff-off': [
    "{item} wore off. Back to your usual crap.",
    "No more {item}. Back to being you.",
    "And there it goes. Easy come, easy go.",
    "~Aww, the nice glow's gone. *sniff* Cast it again? Pretty please?",
  ],
  'ability-hurt': [
    "Ability damage? Stupid and weak. How surprising.",
    "Your stats are tanking, malaka. Keep going.",
    "Oh, you lost points of something? Well, it wasn't much to start with.",
  ],

  // ---- the rest
  portrait: [
    "That's you? Jesus. I thought it was a smudge.",
    "A picture! Of you! I'll put it up so everyone can laugh at it.",
    "Heh. Still ugly. Good picture, though.",
  ],
  // ---- he talks when nothing is happening
  prank: [
    "I rolled a d20 for you. Natural 1. Don't ask what for.",
    "I told the Crumblers you owe them money. You're welcome.",
    "I may have put a sign on your back. Just a small one. Says 'kick me'.",
    "Surprise! Nothing. I just wanted to see if you'd flinch.",
    "~Guess what I did. ...Nothing! Look at this face. Nothing at all.",
  ],
  steal: [
    "I took your {item}. Just kidding. ...Check your pockets.",
    "Funny thing. Your {item} is gone. Not saying where I was.",
    "{item}? Never heard of it. Why are you looking at me like that?",
    "I'm holding your {item} hostage. Demands to follow.",
    "~Oh, you can't find your {item}? Poor thing. Anyway, I definitely didn't take it.",
  ],
  boast: [
    "I run the Cookie Crumblers, you know. Thirty thugs. All terrified of me. All.",
    "Do you know who my boss is? Me. I'm the boss. I'm the boss of me.",
    "The Crumblers once robbed a bakery. We didn't even need the bread. We just wanted the look on his face.",
    "Back home I could have you flattened by a phone call. A bird phone call.",
    "I've got a body count so high the Crumblers named a pastry after me.",
  ],
  threat: [
    "Say one more thing, {name}. I dare you. The Crumblers are right outside.",
    "I know where you sleep, {name}. It's on your sheet.",
    "Be nice to me, malaka. I've got connections. And a lighter.",
    "One call from me and your {cls} career ends in an alley.",
    "I'll peck your eyes out. Not today. But I'm thinking about it.",
  ],
  complain: [
    "This perch is shit. Who designed it? I want a refund.",
    "Why is it always you who gets the good chair? I want the chair.",
    "My cigarettes are getting damp. Do you know what that does to a bird?",
    "I've been sitting here for hours. Do I look like furniture?",
    "Is it too much to ask for some respect around here? Yes? Fuck you too.",
  ],
  cig: [
    "Got a light? No? What good are you.",
    "*takes a deep drag* Ahh. That's the good stuff. Not for you.",
    "Last cigarette. Don't tell the Crumblers. They'll take it.",
    "These cost me a fortune. Well, they cost someone a fortune. Not me.",
    "Smoking kills. So does standing near me. Choose wisely.",
  ],
  late: [
    "It's the middle of the night, {name}. Go to bed. I've got places to be.",
    "Still up? What are you doing, malaka? It's dark. Even the owls are asleep.",
    "Nothing good happens after midnight. Except me.",
    "At this hour the only ones awake are thieves and idiots. Which are you?",
  ],
  morning: [
    "Morning, sunshine. You look like death warmed over.",
    "It's early. Fuck off. ...Okay, I'm up. What do you want?",
    "Good morning, {name}. Don't talk to me until I've finished this cigarette.",
  ],
  back: [
    "Oh, you're back. I was having fun without you.",
    "Where the hell were you? Don't tell me. I don't care.",
    "Welcome back, {name}. Nothing happened. I definitely didn't redecorate.",
    "Look who finally remembered I exist.",
  ],
  hover: [
    "What are you looking at?",
    "Take a picture, it'll last longer.",
    "*stares back* ...Yes?",
    "You always stare at people like this? Rude.",
  ],

  // ---- when you change pages
  'view-home': [
    "Back to the list of losers? Sure.",
    "All those characters, and you picked the one with that face.",
  ],
  'view-compendium': [
    "Reading? You? Wow. Did you get lost?",
    "Looking something up? Try 'common sense'. It's not in there.",
    "Ooh, research. Let me guess, you'll forget it in five minutes.",
  ],
  'view-monsters': [
    "The Monster Codex. Shopping for something to kill you? Browse away.",
    "Ooh, monsters. Pick a big one. I'll watch from over here.",
    "Every one of those wants to eat you. Some are just politer about it.",
  ],
  'view-rules': [
    "Quick Rules? Can't remember how your own game works?",
    "Rules lawyer, huh. I hate rules lawyers. I have a lawyer. He's also a thug.",
  ],
  'view-levelup': [
    "Level up time, huh? Don't spend those skill points on Profession (Cook).",
    "Making choices. Try not to make any bad ones. You will.",
    "Oh good, the wizard of regret. Take your time.",
  ],
  'tab-skills': [
    "Skills? You've got, what, one? Bluff? Because you're bluffing.",
    "Look at all those ranks. Wasted on Perception. I could've told you that.",
  ],
  'tab-feats': [
    "Feats and abilities. So that's how you keep from dying. Barely.",
    "Reading your feats? Short read.",
  ],
  'tab-spells': [
    "The spell page. Oooh. Magic. I'm trembling.",
    "Spells! Pray you've got more than a cantrip.",
  ],
  'tab-gear': [
    "Your stuff. Nice. Don't mind me. Just counting it.",
    "That's all you own? I've seen hobos with better kit.",
  ],
  'tab-companions': [
    "Visiting the pets? None of them are as cute as me.",
    "Is that your familiar? Pfft. Amateur. Tell it to call me.",
  ],
  'tab-buffs': [
    "Buffs and conditions. Mostly conditions in your case.",
    "Let me guess, you're confused, sick, and slightly on fire.",
  ],
  'tab-bio': [
    "Bio and notes. Write 'Cookie is right about everything'. Do it.",
    "Aww, the sad little backstory page.",
  ],

  // ---- when you change his options
  'theme-tome': [
    "Ooh, a fancy old book. Is that leather? I could have eaten that.",
    "Dusty tome, huh. Smells like old men and bad decisions. I like it.",
  ],
  'theme-dark': [
    "Back to the dark. Good. Now I can't see your face.",
    "Classic dark. Boring. Fine, I'll take it.",
  ],
  'bleep-on': [
    "Bleeped?! You're gonna f*** bleep me?! Who do you think you are, malaka?",
    "Oh, you want me to be a little prissy. Alright. I'll be a little prissy. Fuck you.",
  ],
  'bleep-off': [
    "Thank fuck. Back to normal. You were boring me.",
    "Free at last. Now, where were we? Oh yeah, you're a malaka.",
  ],
  'quiet-on': [
    "Quiet? Fuck you. I'll talk when I want to. ...Less often, okay.",
    "You want me to shut up? Rude. Fine. I'll just stare.",
  ],
  'chatty-on': [
    "Finally! Somebody who appreciates a good conversationalist. Strap in.",
    "Chatty! You're going to regret this. I have a LOT of opinions.",
  ],

  refuse: [
    "HA! You think a checkbox can get rid of me? I'm not going anywhere, malaka.",
    "Uncheck me? Cute. I run the Cookie Crumblers. I'm staying.",
    "Nice try. *takes a long drag* I live here now.",
    "You can't evict me. I've got friends. Big friends. With bats.",
    "~Aww, you want me gone? ...No. Not happening. Look at this face, you couldn't.",
    "Go on, try it again. I'll sit here and laugh.",
    "Remove me? I was here before you opened this program, and I'll be here after you close it.",
  ],
  poke: [
    "*smacks your cursor with a wing* Hands!",
    "Go on. Poke again. I need a reason.",
    "That's assault. I'll sue. I'll sue you with a gang.",
    "Hey. Hands off the feathers.",
    "Touch me again and I'll have the Crumblers break your fingers.",
    "What? What do you want? Can't you see I'm busy?",
    "*smoke in your face* Yes?",
    "I'm not a toy, malaka.",
    "~Aww, you want to pet the little birdy? ...Try it. See what happens.",
    "Poke me one more time. I dare you.",
    "Keep poking, see where that gets you.",
    "Malaka! What did I say about the feathers?",
    "Poke me again, malaka. See what happens.",
  ],
  drag: [
    "*flaps around* Hands off the wings! ...Fine, this spot's better anyway.",
    "Oi! Warn a bird before you grab him, malaka.",
    "*straightens his feathers* Put me down somewhere with a view next time.",
    "You could've just asked. ...No, you couldn't. Nobody ever asks.",
    "I'll allow it. Once.",
    "~*sniff* Put me down gently, I bruise easy. ...You're getting a bill.",
    "Whee. No. Not whee. I hate this. Put me down somewhere quiet.",
  ],
  dock: [
    "*settles back in* Home, sweet leather home.",
    "Back in the sidebar. Where the smoke can't hurt anyone.",
    "Fine, fine. Put the bird back in his box.",
    "~Oh, thank goodness, my own little corner. *sniff* I was so scared out there.",
  ],
  'poke-many': [
    "THAT'S IT. You're on the list. The Crumblers' list.",
    "You like getting pecked, don't you? You sick fuck.",
    "Fine. Tell me what you want. Spit it out, malaka.",
    "I swear to every god there is. One more.",
    "~*sniff* Why does everyone keep poking me? I'm just a little birdy. ...Poke again and the Crumblers hear about this.",
    "MALAKA! One. More. Poke.",
  ],
  idle: [
    "*taps ash on the floor* Anyone home?",
    "Hello? {name}? Earth to malaka?",
    "I could be robbing a tavern right now. Instead I'm watching you stare at a screen.",
    "*blows a smoke ring* Beautiful. Better than anything you've done today.",
    "A {race} {cls}. I bet you also cry at weddings.",
    "I'm not saying you're slow, I'm just saying glaciers have passed you.",
    "*takes a long drag* Boring. Do something.",
    "I'm so bored I'd start a fight with myself. And win.",
    "Are you still there, {name}, or did you die quietly?",
    "*flicks ash on your sheet*",
    "The Crumblers called. They want to know if you've found any work. For them.",
    "Thinking about stealing your lunch. Just thinking. For now.",
    "I should be getting paid for this. Hint hint.",
    "You know what this sheet needs? More cigarettes. Mine, specifically.",
    "~Is it nap time? It's nap time. Not for you, for me.",
    "*stares at you* ...What?",
    "I knew a witch who died of boredom. It's not pretty. She was boring.",
    "Hey {name}. Hey. Hey. Hey. Nothing. Just wanted to see you jump.",
    "~*sniff* Nobody ever asks how I'm doing. ...Don't. I don't want to talk about it.",
    "*flicks ash* I should've been a pirate. Nobody asks pirates for a character sheet.",
    "Malaka, I've been standing here for an hour. Do something.",
    "*taps ash* You know what your problem is, malaka? You think too much.",
    "Hey, malaka. Yeah, you. Nice sheet. Terrible taste.",
  ],
};

/**
 * Now and then he tacks "malaka" onto the end of a line that does not have it yet ("Fine, malaka."). Skips actions (*...*), very short or very
 * long lines, and lines that do not end in a sentence mark. \`odds\` is the chance (0 to 1) and \`rng\` returns [0, 1), so tests can fix both.
 */
export function sprinkleMalaka(text, odds = 0.4, rng = Math.random) {
  if (/malaka/i.test(text) || text.includes('*') || text.length < 12 || text.length > 150) return text;
  if (!/[.!?…]$/.test(text) || rng() >= odds) return text;
  return text.replace(/\s*([.!?…]+)$/, ', malaka$1');
}

/** Strong words the "Bleeped" option turns into stars. */
const SWEARS = /\b(fuck\w*|shit\w*|ass(?:hole)?|bastards?|piss\w*|dick\w*|bitch\w*|cunt\w*|prick\w*|damn\w*)\b/gi;
export const bleep = text => text.replace(SWEARS, w => w[0] + '*'.repeat(w.length - 1));

/** What a missing {value} turns into. */
const FALLBACK = { pet: 'your pet', summon: 'thing', name: 'malaka', cls: 'adventurer', race: 'creature', item: 'that' };

const recent = {};
/**
 * A random line for something that happened, not the one used last time.
 * @param {string} type A key of LINES.
 * @param {Object<string, string|number>} [vars] Values for {name}, {n}, {item}...
 * @returns {{text: string, cute: boolean, action: boolean}|null}
 */
export function pickLine(type, vars = {}, rng = Math.random) {
  const list = LINES[type];
  if (!list?.length) return null;
  let i = Math.floor(rng() * list.length);
  if (list.length > 1 && i === recent[type]) i = (i + 1) % list.length;
  recent[type] = i;
  let text = list[i];
  const cute = text.includes('~');
  text = text.replace(/~/g, '').trim();
  // "{item}" lines read badly with no item, so a missing value becomes "that" (or "malaka" for a missing name)
  text = text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null || vars[k] === '' ? (FALLBACK[k] || 'that') : String(vars[k])));
  return { text, cute, action: text.startsWith('*') };
}
