// Cookie's mouth. A thrush, a witch's familiar, and the boss of the Cookie Crumblers. Rude on purpose.
// Edit freely: each key is something that can happen, each line is a way he might react.
//   {name} the character's name   {n} an amount   {item} an item, feat or buff   {spell} a spell
//   {summon} a summoned creature  {hp} current hit points   {con} the Con score   {level} the new level
// A line that starts with "~" is Cookie doing his cute act (big sparkly eyes) to get away with something.
// A line that starts with "*" is an action, shown in italics.

export const LINES = {
  // ---- opening a character
  hello: [
    "Oh, look who finally showed up. {name}. The great malaka.",
    "Took you long enough. The Crumblers were starting to ask about your debts.",
    "*blows smoke in your face* Sit down, {name}. Try not to fuck anything up today.",
    "{name}! My favorite idiot. Don't touch my cigarettes.",
    "~Hi {name}! I definitely didn't go through your pockets while you were gone.",
    "Back already? I was having a nice, quiet, {name}-free time.",
  ],
  welcome_new: [
    "A new character? Fresh meat. Hope this one has more brains than the last, malaka.",
    "Ooh, a new one. Let me guess, a hero. They all die in a ditch anyway.",
    "Another one for the Crumblers' wall of 'former heroes'. Welcome aboard, malaka.",
  ],

  // ---- hit points
  'hp-loss': [
    "Ow? No wait, that was you. Carry on, malaka.",
    "{n} damage. My nest has survived worse from a moth.",
    "Keep bleeding. It's entertaining.",
    "Is that all? I've seen pigeons hit harder.",
    "Hah. {n} points. You really ought to try not getting hit.",
    "Don't look at me. I don't do healing. I do watching.",
    "That's {n} less HP. Nobody's surprised.",
    "*takes a drag* Mm. Do that again.",
  ],
  'big-hit': [
    "HA! {n} damage in one hit! Do it again, I'll get the popcorn.",
    "{n}?! Holy shit. That's gonna leave a mark, malaka.",
    "Fuck me, that looked like it hurt. Good.",
    "*chokes on smoke laughing* {n}! In one go!",
    "The Crumblers wouldn't have hit you that hard. They'd have taken their time.",
  ],
  'hp-low': [
    "You're at {hp} HP. I'd say 'run' but I'd rather watch.",
    "Almost dead. I've already picked out your boots.",
    "{hp} HP. One sneeze and you're done, malaka.",
    "You're one bad roll from a funeral. I'll bring snacks.",
    "Hey. HEY. {hp} HP. Don't die before you pay me back.",
  ],
  downed: [
    "You're down, {name}. Good. Stay there. *kicks you* Just checking.",
    "Down at {hp}. Dead at -{con}. Take your time, I've got all day.",
    "Lying on the floor again? You're so good at it.",
    "*stands on your chest and lights a cigarette* Comfy?",
    "Aww, are we dying? Do you need a hug? No? Good. *kicks you again*",
    "Down, bleeding, and useless. A hat trick.",
  ],
  revived: [
    "Oh, you're up. Shame. I was already going through your pockets.",
    "Back from the dead, malaka. Next time stay there.",
    "~Oh thank goodness you're okay! (...I was almost done with your boots.)",
    "Welp, the party's over. Get off the floor.",
    "You live. Disappointing, but I'll live with it.",
  ],
  dead: [
    "Well, fuck. Dead at {hp}. The Crumblers will take your stuff. Rest in piss, {name}.",
    "{name} is dead. I'm not crying. It's the smoke.",
    "Told you. Didn't I tell you? I did. Nobody listens to the bird.",
    "Dead. Fine. I'm taking the gold, the boots, and the nice pen.",
    "*puts out cigarette on your forehead* Just making sure.",
    "Pour one out for {name}. Actually, give it to me. I'm thirsty.",
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
    "Level {level}. Still a malaka, just a stronger one.",
    "Level {level}?! Who gave you permission?",
    "Congratulations on level {level}. I got you nothing. Not a thing.",
    "*slow clap* Level {level}. Your mother must be so disappointed in other ways.",
    "Level {level}. More power, same bad decisions.",
    "A new level. Let me guess, you'll put it all in the wrong stat.",
  ],
  'level-down': [
    "Lost a level? Best news all day.",
    "Level {level}. Going the wrong way, malaka.",
    "Ha! A level down. Don't tell the Crumblers, they'll lose respect for you. More.",
  ],
  xp: [
    "More XP. Slowly. You'll be level 20 by the time I'm dead.",
    "{n} XP? Wow. That's, like, a whole afternoon of hitting stuff.",
    "Keep grinding, little worm.",
  ],

  // ---- magic
  cast: [
    "{spell}, huh. Fancy. Still can't cast 'competent', can you?",
    "{spell}. Again. Original.",
    "*waves hand* Ooh, {spell}. I'm shaking. Not really.",
    "{spell}? That's your plan? Alright, malaka.",
    "Sparkly. Fancy. A spell slot well wasted.",
    "Burning your spells like they're free. Count 'em, genius.",
    "{spell}. If it goes wrong, I was never here.",
    "~Ooh, {spell}! Pretty! (Don't aim it at me.)",
  ],
  'cast-generic': [
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
  ],
  companion: [
    "A new pet? I'm warning you. I'm the cute one around here.",
    "Another animal? I don't share my snacks.",
    "~Oh, a new friend! (Keep it away from my cigarettes.)",
    "Great. More competition for the good seat.",
    "Another mouth to feed. And another to take a bite out of you.",
  ],

  // ---- things you own
  item: [
    "A {item}? Give it here. I'm just going to hold it. Forever.",
    "Another thing to carry. I'm not carrying it.",
    "{item}. Shiny. Mine, now. I'm joking. (I'm not.)",
    "The Crumblers will want a cut of that {item}.",
    "More junk. You and your stuff, malaka.",
    "A {item}. I'd steal it, but it's you who has to lug it around.",
    "~Ooh, a {item}! Can I hold it? Just for a second? I won't run off. I swear!",
    "*eyes the {item}* How much do you want for it? Name your price. Then double it, I'll be paying in cigarettes.",
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
    "Got rid of the {item}? Good. It was ugly.",
    "Where's the {item}? Don't look at me. ~I didn't take it. Look at my face.",
    "Sold it? Dropped it? Lost it? Doesn't matter, you're a malaka either way.",
    "There goes the {item}. Hope you got a decent price. You didn't.",
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
    "More gold? Good. The Crumblers like to be paid on time.",
    "You got paid. Share it. With me. Right now.",
    "Ca-ching. Don't spend it all in one tavern. You will.",
    "Nice. Now hand over my cut.",
  ],
  rich: [
    "{n} gold?! Where'd you steal that from? Teach me.",
    "Whoa. {n} gold. I'm your best friend now, {name}. Always have been.",
    "~Oh {name}, you're so good to me. You know I love you. Can I borrow some?",
    "That's a lot of coin. The Crumblers can smell it from here.",
  ],
  'gold-down': [
    "Spent money? On what, more junk?",
    "There goes your gold. Wasn't me. ~Look at my little face.",
    "Hah. Poorer by {n}. Smart.",
    "Money goes out, nothing comes in. Brilliant business plan, malaka.",
  ],
  splurge: [
    "You blew {n} gold?! On what, malaka?",
    "Did you just drop {n} on that? I hope it comes with a hug.",
    "{n} gold gone. I know a guy. He's not a good guy, but he'd have done it cheaper.",
    "Fuck me, that's a lot of coin. Could've bought a thousand cigarettes.",
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
  poke: [
    "Hey. Hands off the feathers.",
    "Touch me again and I'll have the Crumblers break your fingers.",
    "What? What do you want? Can't you see I'm busy?",
    "*smoke in your face* Yes?",
    "I'm not a toy, malaka.",
    "~Aww, you want to pet the little birdy? ...Try it. See what happens.",
    "Poke me one more time. I dare you.",
    "Keep poking, see where that gets you.",
  ],
  'poke-many': [
    "THAT'S IT. You're on the list. The Crumblers' list.",
    "You like getting pecked, don't you? You sick fuck.",
    "Fine. Tell me what you want. Spit it out, malaka.",
    "I swear to every god there is. One more.",
  ],
  idle: [
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
  ],
};

/** Strong words the "Bleeped" option turns into stars. */
const SWEARS = /\b(fuck\w*|shit\w*|ass(?:hole)?|bastards?|piss\w*|dick\w*|bitch\w*|cunt\w*|prick\w*|damn\w*)\b/gi;
export const bleep = text => text.replace(SWEARS, w => w[0] + '*'.repeat(w.length - 1));

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
  text = text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null || vars[k] === '' ? (k === 'name' ? 'malaka' : 'that') : String(vars[k])));
  return { text, cute, action: text.startsWith('*') };
}
