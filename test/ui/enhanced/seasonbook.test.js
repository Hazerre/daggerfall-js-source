// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmSeasonAt, seatSeasonAt, seasonBookModel, arenaStanding, spireStanding, ladderStanding, seaStanding, SEASON_BOOK_DAYS,
  SEASON_TITLE_GAMES, SEASON_TITLE_FOES } from '../../../src/systems/seasonBook.js';
import { createSeasonBook, SEASON_BOARD_FRESH_MS, SEASON_BOARDS } from '../../../src/scenes/seasonBookHost.js';
import { seasonMark, seasonWindow, seasonSource, anchorSeason, SEASON_TICK_MS } from '../../../src/ui/enhanced/enhancedSeason.js';
import { pauseCommandOf, pauseCommandRefusal, HOST_COMMANDS, HELP_LINES, parseChatLine } from '../../../src/net/chatCommands.js';
import { ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_SEASON_S } from '../../../src/net/arena/arenaLaw.js';
import { SEASON_ZERO_WEEKS, SEASON_WEEKS } from '../../../src/net/townSeatLaw.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
// Thursday 2026-10-22 12:00 UTC - the realm's Season 1, day 25; the seats' Season 0 (zero 2), its third week; the festival open
const NOW = Date.UTC(2026, 9, 22, 12);
const sec = (m, id) => m.sections.find((s) => s.id === id);
const row = (s, id) => s.rows.find((r) => r.id === id);
const ok = (data) => ({ state: 'ok', data });

test('SEASON-BOOK the clocks: the realm\'s season is the arena\'s eight weeks from 28 September 2026; the seats\' Season is townSeatLaw\'s off the service\'s zero, Season 0 its four-week trial; each knows its end (mutants: the realm\'s day off by one; the seats\' week counted from zero; Season 0 not a trial)', () => {
  assert.equal(SEASON_BOOK_DAYS, 56);
  assert.equal(SEASON_BOOK_DAYS * 86_400, ARENA_SEASON_S);
  assert.deepEqual(realmSeasonAt(NOW), { n: 1, day: 25, days: 56, startMs: Date.UTC(2026, 8, 28), endMs: Date.UTC(2026, 10, 23) });
  assert.equal(realmSeasonAt(Date.UTC(2026, 8, 28)).day, 1, 'its first day is day 1');
  assert.deepEqual([realmSeasonAt(Date.UTC(2026, 10, 23)).n, realmSeasonAt(Date.UTC(2026, 10, 23)).day], [2, 1], 'the next starts at the end');
  assert.deepEqual(seatSeasonAt(NOW, 2), { n: 0, name: 'Season 0', week: 3, weeks: SEASON_ZERO_WEEKS, endMs: Date.UTC(2026, 10, 1, 18), trial: true });
  assert.equal(new Date(seatSeasonAt(NOW, 2).endMs).getUTCDay(), 0, 'a Season ends at a Sunday Turning');
  const one = seatSeasonAt(Date.UTC(2026, 10, 10), 2);
  assert.deepEqual([one.n, one.name, one.week, one.weeks, one.trial], [1, 'the Season of Morning Star', 2, SEASON_WEEKS, false]);
  assert.equal(seatSeasonAt(NOW, null), null, 'no Season counted');
  assert.equal(seatSeasonAt(NOW, 2, false), null, 'the seats shut to the account');
  assert.equal(seatSeasonAt(NOW, 99), null, 'before the zero');
});

test('SEASON-BOOK the model: three sections, each its clock - the ranked season\'s five boards, the seats\' Season (Season 0 as the trial it is), the festival open or coming; each section\'s countdown, its rows\' words (mutants: the trial crowning; the festival\'s end for its opening; a shut seat shown)', () => {
  const m = seasonBookModel({ now: NOW, seatsOpen: true, zero: 2, boards: {} });
  assert.deepEqual(m.sections.map((s) => s.id), ['realm', 'seats', 'festival']);
  const realm = sec(m, 'realm');
  assert.deepEqual([realm.title, realm.sub, realm.at, realm.atLabel], ['Ranked Season 1', 'Day 25 of 56', Date.UTC(2026, 10, 23), 'ends']);
  assert.deepEqual(realm.rows.map((r) => r.id), ['arena', 'spire', 'iliac', 'gambit', 'sea']);
  assert.ok(realm.rows.every((r) => r.name && r.about), 'every row named and said');
  assert.match(row(realm, 'arena').about, /Arena Champion/);
  assert.match(row(realm, 'spire').about, /Spire Champions next season.*half your deepest Redoubt/);
  assert.match(row(realm, 'iliac').about, /Iliac Champion/);
  assert.match(row(realm, 'gambit').about, /Grandmaster/);
  assert.match(realm.foot, new RegExp(`${SEASON_TITLE_GAMES} ranked games against ${SEASON_TITLE_FOES} different rivals`));
  assert.deepEqual([SEASON_TITLE_GAMES, SEASON_TITLE_FOES], [ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES], 'the arena\'s law (Iliac Hand\'s and the Gambit\'s are the service\'s, the same numbers)');
  const seats = sec(m, 'seats');
  assert.deepEqual([seats.title, seats.sub, seats.at], ['The Seats: Season 0', 'Week 3 of 4', Date.UTC(2026, 10, 1, 18)]);
  assert.match(seats.lead, /^The trial Season\. When it ends, seats, influence, fortifications, history, fealty and Pacts are wiped and no one is crowned\./);
  assert.deepEqual(seats.rows.map((r) => r.id), ['once', 'tides', 'chapters'], 'Season 0 crowns no one: no titles, no ribbon, no soft reset');
  assert.ok(seats.rows.every((r) => r.standing === null && r.door === null));
  const later = seasonBookModel({ now: Date.UTC(2026, 10, 10), seatsOpen: true, zero: 2, boards: {} });
  const s1 = sec(later, 'seats');
  assert.equal(s1.title, 'The Seats: Season of Morning Star');
  assert.deepEqual(s1.rows.map((r) => r.id), ['crowns', 'ribbon', 'reset', 'once', 'tides', 'chapters']);
  assert.match(row(s1, 'crowns').about, /Crowned in Season 1/);
  assert.match(row(s1, 'reset').about, /halfway back to 50.*loses a tier/);
  assert.equal(sec(seasonBookModel({ now: NOW, seatsOpen: false, zero: 2 }), 'seats'), undefined, 'the seats shut: no section');
  assert.equal(sec(seasonBookModel({ now: NOW, seatsOpen: true, zero: null }), 'seats'), undefined, 'no Season counted: no section');
  const fest = sec(m, 'festival');
  assert.deepEqual([fest.sub, fest.at, fest.atLabel], ['On now', FESTIVALS[0].toMs, 'ends']);
  assert.deepEqual(fest.rows.map((r) => r.id), ['cakes', 'starfall']);
  const coming = sec(seasonBookModel({ now: Date.UTC(2026, 9, 1) }), 'festival');
  assert.deepEqual([coming.sub, coming.at, coming.atLabel], ['Coming', FESTIVALS[0].fromMs, 'opens']);
  assert.equal(sec(seasonBookModel({ now: Date.UTC(2026, 10, 9) }), 'festival'), undefined, 'none to come: no section');
});

test('SEASON-BOOK the standings: each board\'s line in its state - asking, unread, the player\'s own; a host with no reads shows none; the sea\'s this season\'s alone; the doors only where the host hands one (mutants: an unread board shown as asking; last season\'s voyage counted; a door without its host)', () => {
  const arena = { me: { pvp: { rating: 1240, wins: 7, losses: 2, draws: 1 }, rank: 4, banner: 'red', points: 1 } };
  assert.equal(arenaStanding(arena), '#4 - rating 1,240. Red Banner: 1 point');
  assert.equal(arenaStanding({ me: { pvp: { rating: 1000, wins: 0, losses: 0, draws: 0 }, rank: null, banner: null } }), 'Rating 1,000 - no ranked bouts yet');
  assert.equal(arenaStanding({ me: { pvp: { rating: 990, wins: 1, losses: 3, draws: 0 }, rank: null, banner: 'blue', points: 3 } }), 'Rating 990. Blue Banner: 3 points');
  assert.equal(arenaStanding({ me: null }), null);
  assert.equal(spireStanding({ best: { h: 14, t: 3000 } }), 'Deepest this season: Hall 14');
  assert.equal(spireStanding({ best: null }), 'No Descent yet this season');
  assert.equal(ladderStanding({ me: { rating: 1100, games: 1 }, rows: [{ rank: 1 }], pinned: { you: true, rank: 23 } }), '#23 - rating 1,100 - 1 game');
  assert.equal(ladderStanding({ me: { rating: 1100, games: 3 }, rows: [] }), 'Rating 1,100 - 3 games');
  assert.equal(ladderStanding({ me: { rating: 1000, games: 0 } }), 'No ranked games yet');
  assert.equal(ladderStanding({ me: null }), null);
  assert.equal(seaStanding({ n: 1, deepest: 212.7, legends: 1 }, 1), 'Deepest: 212 leagues past the Veil - 1 legend ended');
  assert.equal(seaStanding({ n: 0, deepest: 400, legends: 3 }, 1), 'No voyage counted yet this season', 'last season\'s figures are not this one\'s');
  assert.equal(seaStanding(null, 1), 'No voyage counted yet this season');

  const m = seasonBookModel({ now: NOW, arena, boards: { spire: { state: 'asking', data: null }, iliac: { state: 'failed', data: null }, gambit: ok({ me: null }) }, sea: { n: 1, deepest: 9, legends: 0 }, doors: { arena: () => true, spire: null } });
  const realm = sec(m, 'realm');
  assert.deepEqual(realm.rows.map((r) => r.standing), ['#4 - rating 1,240. Red Banner: 1 point', 'Reading the board...', 'The board can\'t be read right now.', 'Sign in to be ranked.', 'Deepest: 9 leagues past the Veil - 0 legends ended']);
  assert.deepEqual(realm.rows.map((r) => r.door), ['arena', null, null, null, null], 'the Arena\'s door handed, the Spire\'s not');
  assert.equal(row(sec(seasonBookModel({ now: NOW, boards: {}, arenaAsking: true }), 'realm'), 'arena').standing, 'Reading the board...');
  assert.equal(row(sec(seasonBookModel({ now: NOW, boards: {} }), 'realm'), 'arena').standing, 'Open the Arena to read your standing.');
  assert.ok(sec(seasonBookModel({ now: NOW }), 'realm').rows.every((r) => r.standing === null), 'a host that hands no reads: no line at all, never "reading" for ever');
});

test('SEASON-BOOK the host\'s reads: each board asked only by the window\'s read, once a minute at most, through the host\'s own doors; the last good answer kept over a failed one; the arena refreshed its own way; a getter not declared yet is none (mutants: the pause face\'s test asking; asked every second; a failure wiping the answer; a throw out of the source)', async () => {
  let clock = 0;
  const asks = { eg: 0, iliac: 0, gambit: 0 };
  let answer = { ok: true, data: { me: { rating: 1, games: 1 } } };
  const door = (k) => ({ board: () => { asks[k]++; return Promise.resolve(answer); } });
  let refreshed = 0, live = true, arenaBoard = null;
  const world = { arena: { live: () => live, refresh: () => { refreshed++; }, board: () => arenaBoard }, eg: door('eg'), iliac: door('iliac'), gambit: door('gambit'), ledger: { season: () => ({ n: 1, deepest: 3, legends: 0 }) } };
  const book = createSeasonBook(() => world, { now: () => clock });
  assert.deepEqual(Object.keys(SEASON_BOARDS), ['spire', 'iliac', 'gambit']);
  const quiet = book.source();
  assert.deepEqual(asks, { eg: 0, iliac: 0, gambit: 0 }, 'the face\'s test asks nothing');
  assert.equal(refreshed, 0);
  assert.deepEqual(quiet.boards, { spire: null, iliac: null, gambit: null });
  const first = book.source({ ask: true });
  assert.deepEqual(asks, { eg: 1, iliac: 1, gambit: 1 }, 'the window\'s read asks each board through its door');
  assert.deepEqual([refreshed, first.arenaAsking, first.arena], [1, true, null], 'the arena asked its own way, and asking until it answers');
  assert.equal(first.boards.spire.state, 'asking');
  assert.deepEqual(first.sea, { n: 1, deepest: 3, legends: 0 });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(book.source({ ask: true }).boards.iliac, ok({ me: { rating: 1, games: 1 } }));
  clock += SEASON_BOARD_FRESH_MS - 1;
  book.source({ ask: true });
  assert.deepEqual(asks, { eg: 1, iliac: 1, gambit: 1 }, 'not again inside the minute');
  clock += 1;
  answer = { ok: false, error: 'server' };
  book.source({ ask: true });
  assert.deepEqual(asks, { eg: 2, iliac: 2, gambit: 2 }, 'a minute on, asked again');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(book.source().boards.gambit, ok({ me: { rating: 1, games: 1 } }), 'a failed ask keeps the last good answer');
  const lone = createSeasonBook(() => ({ iliac: { board: () => Promise.reject(new Error('net')) } }), { now: () => 0 });
  lone.source({ ask: true });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(lone.source().boards, { spire: { state: 'failed', data: null }, iliac: { state: 'failed', data: null }, gambit: { state: 'failed', data: null } }, 'none ever had: said failed, never asking for ever');
  arenaBoard = { me: {} };
  assert.deepEqual([book.source().arena, book.source().arenaAsking], [arenaBoard, false]);
  live = false;
  arenaBoard = null;
  assert.equal(book.source({ ask: true }).arenaAsking, false, 'an arena not live is not asking');
  assert.equal(refreshed, 4, '...and not asked: the four asks were the window\'s reads while it was live');
  const early = createSeasonBook(() => { throw new ReferenceError('Cannot access before initialization'); });
  assert.deepEqual(early.source({ ask: true }), { arena: null, arenaAsking: false, boards: { spire: { state: 'asking', data: null }, iliac: { state: 'asking', data: null }, gambit: { state: 'asking', data: null } }, sea: null }, 'AUDIT TIMERS1 D6\'s law: before the boot declared them, none - never a throw');
});

test('SEASON-BOOK the source: the hourglass\'s clock under the laurel\'s reads - none without a clock; the Arena\'s door once a banner is worn, the Spire\'s the hourglass\'s boards door (mutants: a window with no clock; the Arena\'s door for a stranger to it)', () => {
  assert.equal(seasonSource({}), null);
  assert.equal(seasonSource({ timers: () => null, season: () => ({}) }), null);
  let asked = null;
  const board = () => true;
  const hooks = { timers: (o) => { asked = o; return { now: NOW, seatsOpen: true, zero: 2, doors: { board } }; }, season: (o) => ({ arena: null, boards: { spire: null }, sea: null, asked: o }), arenaJoined: () => false, openArena: () => true };
  const src = seasonSource(hooks);
  assert.deepEqual(asked, { ask: true }, 'the window\'s read is the one that asks');
  assert.deepEqual([src.now, src.seatsOpen, src.zero, src.asked], [NOW, true, 2, { ask: true }]);
  assert.deepEqual(src.doors, { arena: null, spire: board });
  hooks.arenaJoined = () => true;
  assert.equal(seasonSource(hooks).doors.arena(), true, 'a banner worn: the Arena\'s window');
});

// ── the window, over a document just real enough ──
function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };

test('SEASON-BOOK the window: a dialog of its sections, each its countdown rewritten in place each second; rebuilt only when a line changes; a row\'s door hands the source\'s own door at the press; Close closes; no clock said so (mutants: rebuilt every tick; a door kept from the draw; the opening\'s word for an end)', () => {
  let now = NOW;
  let iliac = { state: 'asking', data: null };
  let opened = 0;
  const src = () => ({ now, seatsOpen: true, zero: 2, arena: null, boards: { spire: ok({ best: { h: 3 } }), iliac, gambit: null }, sea: null, doors: { arena: null, spire: () => { opened++; return true; } } });
  let closed = 0;
  const handed = [];
  const view = seasonWindow(fakeDoc(), { read: src, onClose: () => { closed++; }, every: 1e9, door: (fn) => { handed.push(fn); return fn(); } });
  view.stop();
  const root = view.root;
  assert.ok(root.className.includes('px-win') && root.className.includes('px-seasonwin'), 'the pause window\'s frame');
  assert.deepEqual([root.attrs.role, root.attrs['aria-modal'], root.attrs['aria-labelledby']], ['dialog', 'true', 'sb-title']);
  assert.equal(all(root, 'sb-title')[0].textContent, 'Season');
  assert.deepEqual(all(root, 'sb-stitle').map((n) => n.textContent), ['Ranked Season 1', 'The Seats: Season 0', 'The Witches\' Festival']);
  const realm = all(root, 'sb-realm')[0];
  const count = all(realm, 'sb-count')[0];
  assert.equal(count.textContent, '31d 12h');
  assert.match(all(realm, 'sb-when')[0].textContent, /^ends /);
  assert.match(all(all(root, 'sb-festival')[0], 'sb-when')[0].textContent, /^ends /);
  assert.equal(all(all(root, 'sb-iliac')[0], 'sb-standing')[0].textContent, 'Reading the board...');
  now += 3600_000; view.draw();
  assert.equal(all(root, 'sb-realm')[0], realm, 'the same section, moved on');
  assert.equal(all(realm, 'sb-count')[0].textContent, '31d 11h');
  iliac = ok({ me: { rating: 1200, games: 2 }, rows: [{ you: true, rank: 2 }] });
  view.draw();
  assert.notEqual(all(root, 'sb-realm')[0], realm, 'a board\'s answer rebuilds');
  assert.equal(all(all(root, 'sb-iliac')[0], 'sb-standing')[0].textContent, '#2 - rating 1,200 - 2 games');
  const doors = all(root, 'sb-door');
  assert.deepEqual(doors.map((d) => d.textContent), ['Boards'], 'the Spire\'s door, and no Arena door unhanded');
  doors[0].listeners.click[0]();
  assert.deepEqual([handed.length, opened], [1, 1], 'the source\'s door handed to the pause face\'s handoff');
  all(root, 'sb-close')[0].listeners.click[0]();
  assert.equal(closed, 1);
  const empty = seasonWindow(fakeDoc(), { read: () => null, onClose() {}, every: 1e9 });
  empty.stop();
  assert.equal(all(empty.root, 'sb-empty')[0].textContent, 'The world\'s clock can\'t be read right now.');
  const coming = seasonWindow(fakeDoc(), { read: () => ({ now: Date.UTC(2026, 9, 1) }), onClose() {}, every: 1e9 });
  coming.stop();
  assert.match(all(all(coming.root, 'sb-festival')[0], 'sb-when')[0].textContent, /^opens /, 'a festival to come counts to its opening');
  assert.equal(SEASON_TICK_MS, 1000);
});

test('SEASON-BOOK a window taken out of the page stops its own tick (AUDIT TIMERS1 UI-10\'s law)', async () => {
  let reads = 0;
  const view = seasonWindow(fakeDoc(), { read: () => { reads++; return { now: NOW }; }, onClose() {}, every: 5 });
  view.root.isConnected = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await wait(40);
    const was = reads;
    await wait(40);
    assert.equal(reads, was, 'no more reads once the tick saw it gone');
    assert.equal(was, 1, 'only the first draw read');
  } finally { view.stop(); }   // a failing assertion never leaves the tick alive (and the run hung)
});

test('SEASON-BOOK the laurel: a button that opens, named for what it holds, placed at the end of the row of marks - each beside the one before it, from the profile mark (mutants: placed beside the profile over the envelope; a missing mark breaking the row)', () => {
  let opened = 0;
  const b = seasonMark(fakeDoc(), { onOpen: () => { opened++; }, open: true });
  assert.equal(b.className, 'px-seasonmark');
  assert.equal(b.title, 'Season');
  assert.match(b.attrs['aria-label'], /^Season: the ranked boards, the seats and the festival$/);
  assert.deepEqual([b.attrs['aria-haspopup'], b.attrs['aria-expanded']], ['dialog', 'true']);
  assert.deepEqual(b.children.map((c) => [c.className, c.attrs['aria-hidden']]), [['px-laurel', 'true']]);
  b.listeners.click[0]();
  assert.equal(opened, 1);
  const host = { getBoundingClientRect: () => ({ right: 1280, top: 0 }) };
  const profile = { getBoundingClientRect: () => ({ left: 1107, top: 10, width: 161, height: 48 }) };
  const mark = (w) => { const m = { style: {}, offsetHeight: 44 }; m.getBoundingClientRect = () => ({ left: 1280 - parseInt(m.style.right, 10) - w, top: 12, width: w, height: 44 }); return m; };
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (f) => f();
  try {
    const glass = mark(39), env = mark(44), laurel = mark(44);
    anchorSeason(laurel, [glass, env], profile, host)();
    assert.deepEqual([glass.style.right, env.style.right, laurel.style.right], ['183px', '232px', '286px'], 'the glass beside the profile, the envelope beside it, the laurel last');
    const alone = mark(44);
    anchorSeason(alone, [null, null], profile, host)();
    assert.equal(alone.style.right, '183px', 'with no other mark, beside the profile');
  } finally { globalThis.requestAnimationFrame = raf; }
});

test('SEASON-BOOK `/season`: the laurel\'s window from the chat, on either skin and wherever the player stands - the mailbox\'s door, its own refusal words; /help says it (mutants: /season sent to the room; /seasons unread; the mailbox\'s refusal for the season)', () => {
  assert.equal(pauseCommandOf('/season'), 'season');
  assert.equal(pauseCommandOf(' /Seasons '), 'season');
  assert.equal(pauseCommandOf('/season 2'), null);
  assert.equal(pauseCommandOf('/mail'), 'mailbox', 'the mailbox\'s lines read as they were');
  assert.equal(pauseCommandOf('/bug'), 'report');
  assert.equal(pauseCommandOf('hello'), null);
  assert.ok(HOST_COMMANDS.includes('season') && HOST_COMMANDS.includes('seasons'));
  assert.deepEqual(parseChatLine('/season'), { kind: 'host', name: 'season' }, 'never said to the room');
  assert.equal(pauseCommandRefusal('season'), 'Connect and sign in to see the season.');
  assert.equal(pauseCommandRefusal('mailbox'), 'Connect and sign in to use the mailbox.');
  assert.ok(HELP_LINES.some((l) => l.startsWith('/season - ')), '/help says it');
  const world = read('src/scenes/world.js');
  assert.match(world, /\{ const at = pauseCommandOf\(text\); if \(at\) \{[^\n]*\n\s*if \(!\(at === 'season' \? timersSource\(\) : postSource\(\)\)\) \{ chatLog\.push\(tabId, \{ text: pauseCommandRefusal\(at\), system: true \}\); return true; \}\n\s*if \(!modes\?\.openPauseAt\?\.\(at\)\) hudCtx\.togglePause\(\{ at \}\);/, 'the hourglass\'s clock its door, the pause face opened at it');
  assert.match(read('src/ui/pauseDoor.js'), /hooks\.at === 'season'\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/, 'the classic skin opens the enhanced face (it has no laurel)');
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), /else if \(at === 'season'\) seasonOpen = true;/, 'the face lands on the window');
});

test('SEASON-BOOK wiring: the pause face stands the laurel after the envelope where the hourglass stands, opens its window on the hourglass\'s stage with its own scrim, the face under it out of reach, Escapes it before resuming, stops its tick on every rebuild and unmount; every host hands the world\'s reads (mutants: the laurel offline; the window without its scrim; a host that forgets it)', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /import \{ seasonMark, seasonWindow, seasonSource, anchorSeason \} from '\.\/enhancedSeason\.js';/);
  assert.match(menu, /function seasonLaurel\(home, chain\) \{\n\s*if \(!hooks\.timers\?\.\(\)\) return null;/, 'online only, where the hourglass stands');
  assert.match(menu, /const envelope = postEnvelope\(home, mark\);[^\n]*\n\s*const laurel = seasonLaurel\(home, \[mark, envelope\]\);/, 'after the envelope, the row its chain');
  assert.match(menu, /else if \(seasonOpen && laurel\) \{[\s\S]{0,400}?seasonView = seasonWindow\(document, \{ read: \(\) => seasonSource\(hooks\), onClose: closeSeason, door: seasonDoor \}\);[\s\S]{0,300}?closeOnOutsideTap\(home, '\.px-seasonwin', closeSeason\);\n\s*for \(const n of \[stage, home\.querySelector\?\.\('\.px-profile'\), mark, envelope, laurel\]\) n\?\.setAttribute\?\.\('inert', ''\);/);
  assert.match(menu, /const sstage = el\('div', 'px-stage px-timersstage px-seasonstage'\);/, 'the hourglass\'s stage, centred, its own padding');
  assert.match(menu, /const seasonDoor = \(fn\) => \{ if \(pauseTab === 'growth' && growthAsks\(\)\) \{ closeSeason\(\); return; \} timersDoor\(fn\); \};/, 'a Growth face asking under it: the window shut so the ask is seen, else the hourglass\'s handoff');
  assert.match(menu, /: seasonOpen && seasonView \? \(\) => closeSeason\(\)/, 'Escape closes a drawn window before it resumes');
  assert.equal((menu.match(/stopSeason\(\);/g) ?? []).length, 2, 'a rebuild and an unmount stop the tick');
  assert.match(menu, /discardControlsStaging\(\);[^\n]*\n\s*seasonOpen = false;   \/\/ SEASON-BOOK: and the season window's[^\n]*\n\s*seasonFocusBack = false;[\s\S]{0,1600}?else if \(at === 'season'\) seasonOpen = true;/, 'a visit\'s window, reset before the door that opens it');
  assert.match(menu, /'\.px-win, \.px-clock, \.px-foot, \.px-profile, \.px-timersmark, \.px-postmark, \.px-seasonmark'/, 'the laurel inside the pause face: a press on it never resumes');
  const world = read('src/scenes/world.js');
  assert.match(world, /const seasonBook = createSeasonBook\(\(\) => \(\{ arena: arenaOnline, eg: _accountEg, iliac: iliacDoor, gambit: gambitDoor, ledger: captainLedger \}\)\);/);
  assert.equal((world.match(/season: seasonBook\.source,/g) ?? []).length, 2, 'the street\'s pause bag and the modes host');
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /season: host\.season,/, 'a building\'s pause');
  assert.match(modes, /season: \(o\) => host\.season\?\.\(o\) \?\? null,/, 'the dungeon\'s opts, the ask carried');
  assert.match(read('src/scenes/dungeonContext.js'), /season: \(o\) => opts\.season\?\.\(o\) \?\? null,/, 'the dungeon\'s pause');
});

// Stone's panel, measured under the timers window (test/ui/enhanced/timers1.test.js AUDIT TIMERS1 UI-4)
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('SEASON-BOOK the sheet: the laurel a pixel wreath beside the envelope, its window the timers\' frame, wider; Stone\'s light ground lifted past 4.5:1; a phone\'s door under its words, a short screen\'s window within it', () => {
  assert.match(ENHANCED_CSS, /\n\.px-seasonmark \{ position: absolute; top: 12px; right: 420px;[^}]*min-height: 44px; min-width: 44px;/, 'a 44px target');
  assert.match(ENHANCED_CSS, /\n\.px-laurel \{[^}]*background: url\("data:image\/svg\+xml,<svg[^"]*viewBox='0 0 12 12' shape-rendering='crispEdges'>/);
  assert.match(ENHANCED_CSS, /\n\.px-win\.px-seasonwin \{ height: auto; max-height: min\(700px, 88dvh\); width: min\(660px, 94vw\);/);
  for (const [what, c] of [['dim', '#e2dccd'], ['brass', '#ffd98a'], ['count and standing', '#ffe3a6'], ['lead', '#fbf8f0']]) {
    assert.ok(contrast(c, '#51514c') >= 4.5, `Stone ${what} ${c} at ${contrast(c, '#51514c').toFixed(2)}:1`);
  }
  assert.match(ENHANCED_CSS, /:root\[data-plus-theme="stone"\] \.px-seasonwin \{ --dim: #e2dccd; --brass: #ffd98a;/);
  assert.match(ENHANCED_CSS, /:root\[data-plus-theme="stone"\] \.px-seasonwin \.sb-lead \{ color: #fbf8f0; \}/);
  assert.match(ENHANCED_CSS, /@media \(max-width: 560px\) \{\n[^}]*\}\n\s*\.px-seasonwin \.sb-count \{ font-size: 16px; \}\n\s*\.px-seasonwin \.sb-row \{ flex-wrap: wrap; row-gap: 6px; \}/);
  assert.match(ENHANCED_CSS, /@media \(max-height: 560px\) \{ \.px-win\.px-seasonwin \{ max-height: calc\(100dvh - 20px\); \} \}/);
});
