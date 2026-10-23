// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD ON THE HUD (ui/eventBoard.js) on a fake document, and THE SEAMS - the
// events' lines through the one door instead of the chat, the board drawn from drawHud, the status widget standing under
// it. Design: bible/10-UI/Event-Board.md. The layout is photographed and measured by tools/eventBoardProbe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawEventBoard, destroyEventBoard, eventRowsFor, newsRowOf, buildEventBoardPreview, isEventBoardSelector, EVENT_READ_MS, EVENT_BOARD_CSS } from '../../src/ui/eventBoard.js';
import { seatEventBoard, eventNotice, _resetEventNotices, EVENT_BOARD_PREF } from '../../src/systems/eventNotices.js';
import { EVENT_TOAST_MS } from '../../src/systems/eventBoard.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { HUD_PIECES } from '../../src/ui/hud/hudLayout.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A page the board writes into: its nodes, their classes and text (a cleared text clears the children, as a browser's). */
function boardDoc() {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, _cls: '', _text: '', parent: null, id: '', offsetWidth: 0 };
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = v; } });
    Object.defineProperty(n, 'textContent', {
      get: () => (n.children.length ? n.children.map((c) => c.textContent).join('') : n._text),
      set: (v) => { n._text = String(v); for (const c of n.children) c.parent = null; n.children = []; },
    });
    n.append = (...c) => { for (const x of c) { x.parent = n; n.children.push(x); } };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.remove = () => { if (n.parent) n.parent.children = n.parent.children.filter((x) => x !== n); n.parent = null; };
    return n;
  };
  const doc = { head: node('head'), body: node('body') };
  doc.createElement = (tag) => node(tag);
  doc.getElementById = (id) => doc.head.children.find((n) => n.id === id) ?? null;
  return doc;
}
const all = (n, out = []) => { out.push(n); for (const c of n.children) all(c, out); return out; };
const byCls = (root, cls) => all(root).filter((n) => String(n.className).split(' ').includes(cls));
const textOf = (root, cls) => byCls(root, cls).map((n) => n.textContent);

const NOW = 1_800_000_000_000;
const star = (o = {}) => ({ id: 'star:9.1', kind: 'star', title: 'Fallen Star', where: 'Near Gothway Garden', detail: 'The coven takes it when this runs out', live: true, at: NOW + 600_000, until: NOW + 600_000, px: 190, py: 210, town: 'Gothway Garden', ...o });
const raid = (o = {}) => ({ name: 'Ilessan Hills', region: 'Daggerfall', type: 'orcs', startMs: NOW - 60_000, endMs: NOW + 540_000, px: 201, py: 200, n: 7, tg: 18, ...o });
/** The host's source at `now`, the gate kept out of it (its day's clock is the law's, tested beside it). */
function seat(over = {}) {
  const src = { now: NOW, pixel: { x: 200, y: 200 }, region: 'Daggerfall', gate: null, stars: [star()], raids: [raid()], ...over };
  seatEventBoard(() => src);
  return src;
}
const fresh = () => { destroyEventBoard(); _resetEventNotices(); resetPrefs(); };

test('EVENTS1 THE PLATE: made only once there is something on it; its rows the board\'s, each its title, clock, way then place; a raid\'s count under it; live first; cut to the screen\'s rows (four tall, three on a desk, none on a phone on its side); hidden whole, never torn down (mutants: the way\'s order, the count\'s kind, the rows for the screen, the hide)', () => {
  fresh();
  const doc = boardDoc();
  drawEventBoard({ doc, nowMs: NOW });
  assert.equal(doc.body.children.length, 0, 'nothing seated, nothing made');
  destroyEventBoard();
  const src = seat();
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  const root = doc.body.children[0];
  assert.equal(root.className, 'evhud');
  const board = root.children[0];
  assert.equal(board.className, 'evboard');
  assert.deepEqual(textOf(board, 'evrow-title'), ['Raid on Ilessan Hills', 'Fallen Star'], 'the raid ends sooner');
  assert.deepEqual(textOf(board, 'evrow-clock'), ['9:00 left', '10:00 left']);
  assert.deepEqual(textOf(board, 'evrow-where'), ['0.8 km E · Daggerfall', '12 km SW · Near Gothway Garden'], 'the way first - a long place cut at the edge never cuts it');
  assert.deepEqual(textOf(board, 'evrow-detail'), ['7 of 18 raiders down', ''], 'a raid\'s count; the rest on its news');
  assert.equal(byCls(board, 'evrow')[0].className, 'evrow ev-raid live');
  src.now = NOW + 1000;
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 1080 });
  assert.deepEqual(textOf(board, 'evrow-clock'), ['8:59 left', '9:59 left'], 'the relay\'s clock, read again');
  src.now = NOW;   // a read between reads would say the old clock: none is made
  drawEventBoard({ doc, nowMs: NOW + 1000 + EVENT_READ_MS - 1, height: 1080 });
  assert.deepEqual(textOf(board, 'evrow-clock'), ['8:59 left', '9:59 left'], 'between reads, this machine\'s clock on from the last');
  assert.deepEqual([eventRowsFor(1080), eventRowsFor(720), eventRowsFor(500), eventRowsFor(390)], [4, 3, 0, 0]);
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 390 });
  assert.deepEqual(byCls(board, 'evrow'), [], 'a phone on its side: no rows');
  assert.equal(board.className, 'evboard off', 'and nothing else to show: the plate off');
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 720, hidden: true });
  assert.equal(root.className, 'evhud hidden');
  assert.equal(doc.body.children[0], root, 'hidden, never torn down');
  fresh();
});

test('EVENTS1 THE NEWS: an event\'s line through the door stands at the plate\'s head - its kind, the row it names by its town (or its kind\'s one row), that row\'s clock, way, place and detail - and the row itself leaves the list while it stands; one at a time, its time spent only while shown, the HUD hidden its clock stopped; an event come onto the board is announced, never what stood at the first read; the news is spoken, the rows are not (mutants: the town match, the row\'s place in the news, the shown-time clock, the seed)', () => {
  fresh();
  const doc = boardDoc();
  const src = seat({ stars: [star(), star({ id: 'star:9.2', where: 'Near Copperham', town: 'Copperham', px: 210, py: 200, at: NOW + 800_000, until: NOW + 800_000 })] });
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  const board = doc.body.children[0].children[0];
  assert.deepEqual(byCls(board, 'evnews'), [], 'the first read: what stands is no news');
  eventNotice('star', 'The star near Copperham is held by Ann.');
  drawEventBoard({ doc, nowMs: NOW + 10, dt: 0.01, height: 1080 });
  const news = byCls(board, 'evnews');
  assert.equal(news.length, 1);
  assert.deepEqual([textOf(news[0], 'evnews-kind')[0], textOf(news[0], 'evnews-title')[0], textOf(news[0], 'evnews-where')[0], textOf(news[0], 'evnews-note')[0]],
    ['Starfall', 'Fallen Star', '8.2 km E · Near Copperham', 'The star near Copperham is held by Ann.'], 'the star the line names');
  assert.deepEqual(textOf(board, 'evrow-where').filter((w) => w.includes('Copperham')), [], 'its row is the news, opened - never twice');
  assert.equal(byCls(board, 'evboard-news')[0].attrs['aria-live'], 'polite');
  assert.equal(byCls(board, 'evboard-rows')[0].attrs['aria-hidden'], 'true');
  // its time: only while shown
  drawEventBoard({ doc, nowMs: NOW + 20, dt: (EVENT_TOAST_MS * 2) / 1000, height: 1080, hidden: true });
  drawEventBoard({ doc, nowMs: NOW + 30, dt: 0.01, height: 1080 });
  assert.equal(byCls(board, 'evnews').length, 1, 'behind a window, its time kept');
  drawEventBoard({ doc, nowMs: NOW + 40, dt: EVENT_TOAST_MS / 1000, height: 1080 });
  assert.equal(byCls(board, 'evnews').length, 0, 'shown its time, gone');
  // a raid comes onto the board: announced, its row's news
  src.raids = [raid(), raid({ name: 'Anticlere', startMs: NOW + 300_000, endMs: NOW + 900_000, px: 199, py: 201 })];
  src.now = NOW + 1000;
  drawEventBoard({ doc, nowMs: NOW + 40 + EVENT_READ_MS, dt: 0.01, height: 1080 });
  const ann = byCls(board, 'evnews');
  assert.equal(ann.length, 1);
  assert.deepEqual([textOf(ann[0], 'evnews-kind')[0], textOf(ann[0], 'evnews-title')[0], textOf(ann[0], 'evnews-clock')[0]], ['Town Raid · Starting soon', 'Raid on Anticlere', 'in 4:59']);
  // a line that names no town finds its kind's one row, or none
  assert.equal(newsRowOf({ id: null, kind: 'raid', notes: ['The attackers have withdrawn.'] }, [{ id: 'r', kind: 'raid' }]).id, 'r');
  assert.equal(newsRowOf({ id: null, kind: 'raid', notes: ['The attackers have withdrawn.'] }, [{ id: 'r', kind: 'raid' }, { id: 's', kind: 'raid' }]), null);
  fresh();
});

test('EVENTS1 THE SWITCH: off, the plate comes down and each event\'s line goes where it went before - the chat the host seated, a raid\'s the HUD\'s line; on again, the board reads afresh (mutants: the switch\'s door, the raid\'s own, the take-down)', () => {
  fresh();
  const doc = boardDoc();
  const chat = [];
  seatEventBoard(() => ({ now: NOW, pixel: { x: 200, y: 200 }, raids: [raid()] }), (t) => chat.push(t));
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  assert.equal(doc.body.children.length, 1);
  setPref(EVENT_BOARD_PREF, false);
  eventNotice('star', 'A star has fallen near Gothway Garden.');
  eventNotice('raid', 'Ilessan Hills in Daggerfall has been cleansed of the orc attack!');
  drawEventBoard({ doc, nowMs: NOW + 10, height: 1080 });
  assert.equal(doc.body.children.length, 0, 'taken down');
  assert.deepEqual(chat, ['A star has fallen near Gothway Garden.'], 'each line where it went before the board: a star\'s the chat, a raid\'s the HUD\'s line (the mod\'s AddHUDText)');
  setPref(EVENT_BOARD_PREF, true);
  drawEventBoard({ doc, nowMs: NOW + 20, height: 1080 });
  assert.equal(doc.body.children.length, 1, 'on again');
  assert.deepEqual(byCls(doc.body.children[0], 'evnews'), [], 'read afresh: the first read is no news');
  fresh();
});

test('EVENTS1 A LINK LOST IS NO NEWS: while the source reads none nothing is announced and the board keeps its memory, so the read that finds the world again announces only what came on while it was away - never all that stood (mutants: the announcements made over an empty read)', () => {
  fresh();
  const doc = boardDoc();
  let up = true;
  const src = { now: NOW, pixel: { x: 200, y: 200 }, region: 'Daggerfall', gate: null, stars: [star()], raids: [raid()] };
  seatEventBoard(() => (up ? src : null));
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  const board = doc.body.children[0].children[0];
  up = false;
  drawEventBoard({ doc, nowMs: NOW + EVENT_READ_MS, height: 1080 });
  src.raids = [raid(), raid({ name: 'Anticlere', startMs: NOW + 300_000, endMs: NOW + 900_000, px: 199, py: 201 })];
  up = true;
  drawEventBoard({ doc, nowMs: NOW + 2 * EVENT_READ_MS, height: 1080 });
  const news = byCls(board, 'evnews');
  assert.equal(news.length, 1, 'one news - not the star and the raid that stood before the loss');
  assert.equal(textOf(news[0], 'evnews-title')[0], 'Raid on Anticlere', 'the one that came on while it was away');
  fresh();
});

test('EVENTS1 DRESSED AND MOVABLE: the kit\'s panel on the plate; its classic copy cut to the plate alone; a movable piece with its preview; its sheet keeps the short screen\'s news-alone rule (mutants: the role, the piece, the selector)', () => {
  assert.ok(FRAME_ROLES.panel.includes('body .evboard'));
  assert.equal(isEventBoardSelector('body .evboard'), true);
  assert.equal(isEventBoardSelector('body .evboard-title'), false);
  assert.equal(isEventBoardSelector('body .star-hud'), false);
  const piece = HUD_PIECES.find((p) => p.id === 'events');
  assert.deepEqual([piece.sel, piece.ghost, piece.dummy, piece.name], ['.evhud', 'events', true, 'Event board']);
  const doc = boardDoc();
  const g = buildEventBoardPreview(doc);
  assert.equal(g.className, 'evhud');
  assert.match(textOf(g, 'evrow-title')[0], /\(preview\)$/);
  assert.match(EVENT_BOARD_CSS, /@media \(max-height: 500px\) \{[^}]*\.evhud \{ top: auto;/);
  assert.match(EVENT_BOARD_CSS, /\.evboard-title, \.evboard-rows, \.evboard-more, \.evnews-detail \{ display: none; \}/);
});

test('EVENTS1 THE SEAMS: the gate\'s, the serpent\'s, the Abyss Dungeon\'s, the stars\', the raids\' and the festival\'s lines through the one door, never the chat; the Timers source seated where it is made, with the chat for the switch off, the player\'s pixel and the two sites; the raids\' list the raids\' own; the board on drawHud and its hide door; the status widget under it (mutants: each door, the seat, the draw)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const timersSource = seatEventBoard\(\(\{ ask = false \} = \{\}\) => \{/);
  assert.match(world, /\}, \(text\) => chatNotice\(text\)\);/, 'the chat, for a line said with the board off');
  assert.match(world, /pixel: playerTravelPixel\(\),\n\s+gate: \{ place: gateOmen\?\.current\?\.\(\)\?\.site\?\.place \?\? null, site: gateOmen\?\.current\?\.\(\)\?\.site \?\? null,/);
  assert.match(world, /serpent: \{ place: serpentOmen\?\.current\?\.\(\)\?\.site\?\.near \?\? null, site: serpentOmen\?\.current\?\.\(\)\?\.site \?\? null,/);
  assert.match(world, /raids: raidingPartiesOn\(\) \? raidTimerList\(relayOf, \(r\) => REGION_NAMES\[r\]\) : null,/);
  assert.match(world, /say: \(text\) => eventNotice\('gate', text\),/);
  assert.match(world, /say: \(text\) => eventNotice\('serpent', text\),/);
  assert.match(world, /say: \(text\) => eventNotice\('super', text\),/);
  assert.match(world, /eventNotice\('serpent', slainLine\(\{/);
  assert.doesNotMatch(world, /chatNotice\((fellLine|slainLine)\(/, 'no gate\'s or serpent\'s fall in the chat');
  assert.match(read('src/scenes/starfall/starfallHost.js'), /const say = \(text\) => \(host\.eventNotice \?\? eventNotice\)\('star', text\);/);
  assert.match(read('src/systems/raidingParties.js'), /const say = \(line\) => \(host\(\)\.say \?\? \(\(l\) => eventNotice\('raid', l\)\)\)\(line\);/);
  assert.match(read('src/scenes/witchesHost.js'), /const herald = \(\/\*\* @type \{string\} \*\/ l\) => \(deps\.eventNotice \?\? eventNotice\)\('festival', l\);/);
  const hud = read('src/ui/hud/hud.js');
  assert.match(hud, /drawEventBoard\(\{ hidden: true \}\);[^\n]*\n  drawQuestHerald\(\{ hidden: true \}\);/, 'the hide door');
  assert.match(hud, /\n  drawEventBoard\(\{ hidden: cursorActive \|\| !hudRenderEnabled\(\), dt \}\);\n  drawQuestHerald\(/, 'the frame, beside the herald and outside the skin\'s gate - on every skin');
  assert.match(read('src/ui/enhanced/enhancedHud.js'), /const STAT_ABOVE = '[^']*, \.evboard';/, 'the status widget stands under it');
});
