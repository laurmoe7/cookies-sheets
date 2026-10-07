// Cookie, the rude thrush who sits at the bottom of the sidebar and comments on what you do.
// facts.js notices what changed on the sheet, lines.js says what he thinks of it, and this file draws him,
// decides whether he bothers to speak (options, cooldown, priority), and plays his faces and moves.
import { COOKIE_HTML } from './art.js';
import { facts, diffFacts } from './facts.js';
import { pickLine, bleep } from './lines.js';
import { options } from '../options.js';

// Faces use the same data attributes as the Pet Shopper bird: eyes, mouth (the beak), arms and extras.
const FACES = {
  smug: { eyes: 'open', mouth: 'smile', arms: 'idle', x: [] },
  laugh: { eyes: 'happy', mouth: 'open', arms: 'pat', x: [] },
  sneer: { eyes: 'squint', mouth: 'wavy', arms: 'idle', x: [] },
  shock: { eyes: 'open', mouth: 'o', arms: 'cover', x: ['shock'] },
  cute: { eyes: 'sparkle', mouth: 'smile', arms: 'cover', x: [] },
  huff: { eyes: 'closed', mouth: 'o', arms: 'idle', x: ['steam'] },
  shrug: { eyes: 'open', mouth: 'wavy', arms: 'scratch', x: ['question'] },
  nervous: { eyes: 'open', mouth: 'wavy', arms: 'cover', x: ['sweat'] },
  scratch: { eyes: 'open', mouth: 'wavy', arms: 'scratch', x: [] },
  mad: { eyes: 'squint', mouth: 'open', arms: 'clench', x: [] },
};
const EXTRAS = ['steam', 'question', 'sweat', 'shock'];

// What each kind of event looks like and how much he cares. `prio` 4+ always gets a line; lower ones depend on how chatty he is.
const REACT = {
  hello: { prio: 5, face: 'smug', move: 'hop' },
  welcome_new: { prio: 5, face: 'laugh', move: 'wiggle' },
  dead: { prio: 5, face: 'laugh', move: 'hophop' },
  downed: { prio: 4, face: 'laugh', move: 'wiggle' },
  revived: { prio: 4, face: 'sneer', move: 'bob' },
  'level-up': { prio: 4, face: 'sneer', move: 'peek' },
  'level-down': { prio: 3, face: 'laugh', move: 'wiggle' },
  'big-hit': { prio: 3, face: 'laugh', move: 'wiggle' },
  'hp-low': { prio: 3, face: 'mad', move: 'bob' },
  'hp-loss': { prio: 2, face: 'smug', move: 'bob' },
  'hp-heal': { prio: 1, face: 'sneer', move: '' },
  'full-heal': { prio: 2, face: 'sneer', move: '' },
  'temp-hp': { prio: 1, face: 'smug', move: '' },
  nonlethal: { prio: 1, face: 'smug', move: '' },
  cast: { prio: 2, face: 'sneer', move: 'bob' },
  rest: { prio: 2, face: 'huff', move: '' },
  'pool-spend': { prio: 1, face: 'smug', move: '' },
  'pool-regain': { prio: 1, face: 'smug', move: '' },
  summon: { prio: 3, face: 'shock', move: 'peek' },
  'summon-dead': { prio: 2, face: 'laugh', move: 'wiggle' },
  'summon-gone': { prio: 1, face: 'smug', move: '' },
  companion: { prio: 3, face: 'mad', move: 'sniff' },
  item: { prio: 2, face: 'cute', move: 'peek' },
  'item-gone': { prio: 2, face: 'cute', move: '' },
  feat: { prio: 2, face: 'sneer', move: '' },
  trait: { prio: 1, face: 'shrug', move: '' },
  'gold-up': { prio: 2, face: 'cute', move: 'bob' },
  rich: { prio: 3, face: 'cute', move: 'hop' },
  'gold-down': { prio: 2, face: 'cute', move: '' },
  splurge: { prio: 3, face: 'shock', move: 'wiggle' },
  'buff-on': { prio: 1, face: 'sneer', move: '' },
  'buff-off': { prio: 1, face: 'smug', move: '' },
  'ability-hurt': { prio: 2, face: 'laugh', move: 'wiggle' },
  xp: { prio: 1, face: 'smug', move: '' },
  portrait: { prio: 2, face: 'laugh', move: 'wiggle' },
  refuse: { prio: 5, face: 'laugh', move: 'hophop' },
  poke: { prio: 5, face: 'mad', move: 'wiggle' },
  'poke-many': { prio: 5, face: 'mad', move: 'hophop' },
  idle: { prio: 1, face: 'smug', move: 'sniff' },
};
// How likely a line is at each chattiness, and the quiet gap he leaves between lines (ms).
const TALK = { quiet: { odds: 0.3, gap: 45000 }, normal: { odds: 0.75, gap: 10000 }, chatty: { odds: 1, gap: 3500 } };

let wrap, pet, bubble, bubbleTimer, faceTimer, moveTimer, moving = '';
let settled = null, debounce = null, lastSpoke = 0, lastPrio = 0, pokes = [], idleTimer = null, name = '';

const reduce = () => options().motion === false || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Builds Cookie inside `slot` (an element in the sidebar) and starts listening for option changes. */
export function mountPet(slot) {
  wrap = slot;
  wrap.innerHTML = COOKIE_HTML + '<div id="cookie-bubble" class="cookie-bubble" role="status" aria-live="polite" hidden></div>';
  pet = wrap.querySelector('#cookie');
  bubble = wrap.querySelector('#cookie-bubble');
  pet.addEventListener('click', poke);
  document.addEventListener('optionschange', refreshOptions);
  document.addEventListener('cookie-refuse', () => { const l = pickLine('refuse', { name }); if (l) speak(l, 5, 'refuse'); });
  refreshOptions();
  face('smug');
  addEventListener('pointermove', follow, { passive: true });
  scheduleMoves();
}

function refreshOptions() {
  if (!wrap) return;
  const on = options().cookie;
  wrap.hidden = !on;
  clearTimeout(idleTimer);
  if (on) scheduleIdle(); else hush();
}

function hush() { bubble.hidden = true; clearTimeout(bubbleTimer); }

/** @param {string} key A name in FACES. */
function face(key, ms = 0) {
  const f = FACES[key] || FACES.smug;
  pet.dataset.eyes = f.eyes;
  pet.dataset.mouth = f.mouth;
  pet.dataset.arms = f.arms;
  for (const x of EXTRAS) pet.classList.toggle('x-' + x, f.x.includes(x));
  clearTimeout(faceTimer);
  if (ms) faceTimer = setTimeout(() => face('smug'), ms);
}

/** Plays one of the bird's CSS moves (hop, wiggle, bob, peek, sniff...) for a moment. */
function move(cls, ms = 900) {
  if (!cls || reduce()) return;
  if (moving) pet.classList.remove(moving);
  moving = cls;
  pet.classList.remove(cls);
  void pet.offsetWidth;
  pet.classList.add(cls);
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => { pet.classList.remove(cls); if (moving === cls) moving = ''; }, ms);
}

/** A short bird chirp made with the Web Audio API (only when "Cookie's squawks" is on). */
let audio;
function squawk() {
  if (!options().cookieSound) return;
  try {
    audio ||= new AudioContext();
    const t = audio.currentTime;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      const f = 1500 + Math.random() * 900, s = t + i * 0.11;
      o.type = 'square';
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * (1.4 + Math.random() * 0.5), s + 0.07);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.045, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g).connect(audio.destination);
      o.start(s); o.stop(s + 0.1);
    }
  } catch { /* no audio available */ }
}

/** Shows a line in the speech bubble and moves the beak while it is up. */
function speak(line, prio, key) {
  const r = REACT[key] || REACT.idle;
  let text = line.text;
  if (options().cookieSwear === 'bleep') text = bleep(text);
  bubble.textContent = text;
  bubble.classList.toggle('action', text.startsWith('*'));
  bubble.hidden = true;
  void bubble.offsetWidth;
  bubble.hidden = false;
  const ms = Math.min(9000, 2600 + text.length * 62);
  face(line.cute ? 'cute' : r.face, ms);
  move(r.move);
  pet.dataset.mouth = 'chew';
  setTimeout(() => { if (pet.dataset.mouth === 'chew') pet.dataset.mouth = FACES[line.cute ? 'cute' : r.face].mouth; }, Math.min(ms, 1500));
  squawk();
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
  lastSpoke = Date.now(); lastPrio = prio;
}

/** Whether Cookie can be bothered to speak about something of this importance right now. */
function willSpeak(prio) {
  const o = options();
  if (!o.cookie) return false;
  if (prio >= 4) return true;
  const t = TALK[o.cookieTalk] || TALK.normal;
  const since = Date.now() - lastSpoke;
  if (!bubble.hidden && prio <= lastPrio) return false;
  if (since < (prio >= 3 ? t.gap / 3 : t.gap)) return false;
  return Math.random() < t.odds * (prio >= 3 ? 1 : 0.8);
}

/** Maps an event from facts.js to the key of its lines. */
function lineKey(ev) {
  if (ev.type === 'cast') return ev.spell ? 'cast' : 'cast-generic';
  if (ev.type === 'item') return ev.kind === 'weapon' ? 'item-weapon' : ev.kind === 'armor' ? 'item-armor' : 'item';
  return ev.type;
}

/** Says something about one event (the most important one in a batch), if he feels like it. */
function react(events) {
  if (!options().cookie || !events.length) return;
  const ev = events.reduce((best, e) => ((REACT[e.type]?.prio || 0) > (REACT[best.type]?.prio || 0) ? e : best));
  const r = REACT[ev.type];
  if (!r || !willSpeak(r.prio)) return;
  const key = lineKey(ev);
  const line = pickLine(key, { name, n: ev.amount, item: ev.name, spell: ev.spell, summon: ev.name, hp: ev.hp, con: ev.con, level: ev.level, max: ev.max });
  if (line) speak(line, r.prio, REACT[key] ? key : ev.type);
}

/** Called after every change to the sheet. Looks at what changed once typing has paused. */
export function observe(char, derived) {
  if (!wrap || !char) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const now = facts(char, derived);
    name = char.name || '';
    if (settled) react(diffFacts(settled, now));
    settled = now;
  }, 650);
}

/** A character was opened or created: remember its state without reacting to it, and say hello. */
export function opened(char, derived, isNew = false) {
  if (!wrap || !char) return;
  clearTimeout(debounce);
  name = char.name || '';
  settled = facts(char, derived);
  pokes = [];
  setTimeout(() => react([{ type: isNew ? 'welcome_new' : 'hello' }]), 900);
}

function poke() {
  if (!options().cookie) return;
  const now = Date.now();
  pokes = pokes.filter(t => now - t < 6000).concat(now);
  const many = pokes.length >= 4;
  const line = pickLine(many ? 'poke-many' : 'poke', { name });
  if (line) speak(line, 5, many ? 'poke-many' : 'poke');
}

/** Now and then, with nothing happening, he mutters something. */
function scheduleIdle() {
  clearTimeout(idleTimer);
  if (!options().cookie) return;
  const t = TALK[options().cookieTalk] || TALK.normal;
  idleTimer = setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastSpoke > t.gap * 3 && options().cookieTalk !== 'quiet') {
      const line = pickLine('idle', { name });
      if (line) speak(line, 1, 'idle');
    }
    scheduleIdle();
  }, t.gap * (8 + Math.random() * 8));
}

// ---------- idle animations: things he does when nothing is happening (no words) ----------
let lookLock = 0, lastPointer = 0, movesTimer = null, tidy = [];
/** Points his pupils (in drawing units). */
function look(x, y) { pet.style.setProperty('--look-x', x + 'px'); pet.style.setProperty('--look-y', y + 'px'); pet.classList.add('looking'); }
const later = (ms, fn) => { const t = setTimeout(fn, ms); tidy.push(t); return t; };

/** His eyes follow the mouse a little, unless an idle move is steering them. */
function follow(e) {
  if (!pet || Date.now() < lookLock || Date.now() - lastPointer < 90 || !options().cookie) return;
  lastPointer = Date.now();
  const r = pet.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.6);
  const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220);
  look(+(dx / d * 3.4 * k).toFixed(2), +(dy / d * 2.4 * k).toFixed(2));
}

/** Steers the eyes through a list of [x, y, ms] stops, then hands them back to the mouse. */
function glance(stops) {
  let t = 0;
  for (const [x, y, ms] of stops) { later(t, () => look(x, y)); t += ms; }
  lookLock = Date.now() + t + 200;
  return t;
}

const IDLE_MOVES = [
  () => { face('smug'); pet.dataset.eyes = 'closed'; later(180, () => { pet.dataset.eyes = 'open'; }); return 300; },                       // blink
  () => glance([[-3.4, 0, 700], [3.4, 0, 900], [0, 1.5, 300]]),                                                                          // look around
  () => glance([[0, -3, 500], [3.4, -2, 400], [0, 2, 500], [0, 0, 100]]),                                                               // roll his eyes
  () => { face('huff', 2200); pet.classList.add('puff'); later(2400, () => pet.classList.remove('puff')); return 2400; },                // a long drag
  () => { face('huff', 1500); pet.dataset.mouth = 'o'; move('bob', 1400); return 1500; },                                             // a yawn
  () => { face('scratch', 1800); return 1800; },                                                                                         // scratches himself
  () => { move('shuffle', 1500); return 1500; },                                                                                         // taps his feet
  () => { move('rocksmall', 1300); return 1300; },                                                                                       // sways
  () => { face('sneer', 1700); move('sniff', 1700); return 1700; },                                                                      // sniffs at you
  () => { move('hopsmall', 450); return 450; },                                                                                          // flicks his ash
  () => { move('sit', 2600); return 2600; },                                                                                             // sits down
  () => { face('sneer', 1500); pet.classList.add('eyesquint'); later(1400, () => pet.classList.remove('eyesquint')); return 1500; },   // glares at you
  () => { move('peek', 1400); return 1400; },                                                                                            // peers about
  () => { face('smug'); pet.dataset.eyes = 'closed'; later(1800, () => { face('shock', 700); move('hop', 500); }); return 2600; },       // nods off, wakes with a start
];

/** Plays idle move number `i` (for trying them out); with no number, a random one. */
export function idleMove(i = Math.floor(Math.random() * IDLE_MOVES.length)) {
  tidy.forEach(clearTimeout); tidy = [];
  pet.classList.remove('puff', 'eyesquint');
  return IDLE_MOVES[i]();
}

function scheduleMoves() {
  clearTimeout(movesTimer);
  if (!options().cookie) return;
  movesTimer = setTimeout(() => {
    const idle = document.visibilityState === 'visible' && bubble.hidden && Date.now() - lastSpoke > 3000;
    if (idle) {
      idleMove();
    }
    scheduleMoves();
  }, 5000 + Math.random() * 7000);
}
