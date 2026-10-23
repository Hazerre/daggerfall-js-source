// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD'S LAW (systems/eventBoard.js) AND ITS DOOR (systems/eventNotices.js).
// Design: bible/10-UI/Event-Board.md. Mutation list: tools/mutants/events1.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventWay, eventBoardModel, eventAnnouncements, createEventToasts, EVENT_SOON_MS, EVENT_BOARD_ROWS, EVENT_BOARD_RAIDS, EVENT_RAID_REACH_M,
  EVENT_TOAST_MS, EVENT_NOTE_SAME_MS, EVENT_KIND_TEXT,
} from '../../src/systems/eventBoard.js';
import { eventNotice, takeEventNotices, seatEventBoard, eventBoardSource, eventBoardOn, _resetEventNotices, EVENT_NOTICES_KEPT, EVENT_BOARD_PREF } from '../../src/systems/eventNotices.js';
import { gateAt } from '../../src/net/gate/gateLaw.js';
import { PIXEL_M } from '../../src/net/gate/gateLaw.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { FEATURES } from '../../src/systems/features.js';

const HERE = { x: 200, y: 200 };
/** A moment the day's gate is open (gateLaw's own clock), and one a quarter hour before it opens. */
const G = gateAt(Date.UTC(2026, 9, 23, 12, 0, 0));
const OPEN = G.openAt + 60_000;
const raid = (o = {}) => ({ name: 'Ilessan Hills', region: 'Daggerfall', type: 'orcs', startMs: OPEN - 60_000, endMs: OPEN + 540_000, done: false, px: 203, py: 196, n: null, tg: null, ...o });
const star = (o = {}) => ({ id: 'star:9.1', kind: 'star', title: 'Fallen Star', where: 'Near Gothway Garden', detail: 'The coven takes it when this runs out', live: true, at: OPEN + 600_000, until: OPEN + 600_000, px: 190, py: 210, town: 'Gothway Garden', ...o });
const src = (o = {}) => ({ now: OPEN, pixel: HERE, region: 'Daggerfall', gate: { place: 'Copperham, Daggerfall', site: { px: 207, py: 191 } }, ...o });
/** The board's row ids, of the kinds a check is about (the sea serpent's own clock stands beside them at some moments). */
const ids = (m, kinds = ['gate', 'star', 'raid']) => m.rows.filter((r) => kinds.includes(r.kind)).map((r) => r.id);

test('EVENTS1 THE WAY: metres between the pixels\' hearts (a pixel PIXEL_M), the compass word clockwise from north with y running south, "Nearby" on the same pixel, tenths of a km under 10 and whole km past it; nothing where either end is unknown (mutants: the scale, the bearing\'s sign, the rounding, the cut)', () => {
  assert.deepEqual(eventWay(HERE, { px: 200, py: 200 }), { m: 0, dir: '', text: 'Nearby' });
  const east = eventWay(HERE, { px: 210, py: 200 });
  assert.equal(east.m, 10 * PIXEL_M);
  assert.deepEqual([east.dir, east.text], ['E', '8.2 km E'], '8,192 m: under ten km, a tenth');
  assert.equal(eventWay(HERE, { px: 200, py: 195 }).text, '4.1 km N', 'a smaller y is north');
  assert.equal(eventWay(HERE, { px: 200, py: 205 }).dir, 'S');
  assert.equal(eventWay(HERE, { px: 205, py: 195 }).dir, 'NE');
  assert.equal(eventWay(HERE, { px: 195, py: 205 }).dir, 'SW');
  assert.equal(eventWay(HERE, { px: 195, py: 200 }).dir, 'W');
  assert.equal(eventWay(HERE, { px: 201, py: 200 }).text, '0.8 km E');
  assert.equal(eventWay(HERE, { px: 213, py: 200 }).text, '11 km E');
  assert.equal(eventWay(HERE, { px: 212, py: 200 }).text, '9.8 km E', 'under ten km: a tenth');
  assert.equal(eventWay(null, { px: 1, py: 1 }), null);
  assert.equal(eventWay(HERE, null), null);
  assert.equal(eventWay(HERE, { px: NaN, py: 1 }), null);
});

test('EVENTS1 THE BOARD: the shared events a player can still reach - each under way, and each coming within EVENT_SOON_MS once it says where - live first, each soonest first; the gate\'s way from its site; the resets, the seat week and the battles stay the Timers window\'s; offline there is none (mutants: the horizon, the place test, the order, the kinds)', () => {
  assert.deepEqual(eventBoardModel(null), { rows: [], more: 0, all: [], now: NaN });
  const open = eventBoardModel(src({ stars: [star()] }));
  assert.deepEqual(ids(open), [`gate:${G.day}`, 'star:9.1'], 'the gate open (to its seal) before the star (to its deadline)');
  const gate = open.rows.find((r) => r.kind === 'gate');
  assert.deepEqual([gate.live, gate.at, gate.where, gate.way.text, gate.announce], [true, G.sealAt, 'Near Copperham, Daggerfall', '9.3 km NE', true]);
  const st = open.rows.find((r) => r.kind === 'star');
  assert.equal(st.way.text, '12 km SW', 'a star\'s way from its own pixel');
  assert.equal(st.town, 'Gothway Garden');
  assert.ok(open.rows.findIndex((r) => r.kind === 'gate') < open.rows.findIndex((r) => r.kind === 'star'), 'the sooner end first');
  assert.ok(open.all.every((r) => ['gate', 'serpent', 'super', 'star', 'raid'].includes(r.kind)), 'no reset, seat or battle row');
  // a coming star: on the board once it says where, inside the horizon
  const coming = (at, where) => eventBoardModel(src({ now: G.omenAt - 3_600_000, stars: [star({ live: false, at, until: null, where })] }));
  const t = G.omenAt - 3_600_000;
  assert.deepEqual(ids(coming(t + EVENT_SOON_MS, 'Near Gothway Garden')), ['star:9.1'], 'at the horizon\'s edge');
  assert.deepEqual(ids(coming(t + EVENT_SOON_MS + 1, 'Near Gothway Garden')), [], 'past it');
  assert.deepEqual(ids(coming(t + 60_000, null)), [], 'no place yet: no place to go');
  // the gate before its omen is no row; at its omen (15 minutes before it opens) it is, coming
  assert.deepEqual(ids(eventBoardModel(src({ now: G.omenAt - 60_000, gate: { place: null, site: null } }))), []);
  const omen = eventBoardModel(src({ now: G.omenAt + 1000 }));
  assert.deepEqual(omen.rows.filter((r) => r.kind === 'gate').map((r) => [r.id, r.live, r.at]), [[`gate:${G.day}`, false, G.openAt]]);
  // live first, whatever the clocks: a coming row never stands over a live one
  const mixed = eventBoardModel(src({ stars: [star({ live: false, at: OPEN + 1000, until: null })] }));
  assert.deepEqual(mixed.rows.map((r) => r.live), [...mixed.rows.map((r) => r.live)].sort((a, b) => b - a));
});

test('EVENTS1 THE RAIDS ON IT: the nearest EVENT_BOARD_RAIDS of the day\'s raids under way or starting within the horizon, never one over or cleansed; a running raid\'s count where the relay keeps one; announced only in the player\'s region or within EVENT_RAID_REACH_M - the board lists them anywhere (mutants: the nearest, the cut, the count, the announcement\'s reach)', () => {
  const far = (n, px) => raid({ name: n, region: 'Wayrest', px, py: 200 });
  const m = eventBoardModel(src({ gate: null, now: G.omenAt - 3_600_000, raids: [
    raid({ name: 'Here', startMs: G.omenAt - 3_660_000, endMs: G.omenAt - 3_000_000, px: 201, py: 200, n: 7, tg: 18 }),
    { ...far('Far', 260), startMs: G.omenAt - 3_660_000, endMs: G.omenAt - 3_000_000 },
    { ...far('Near', 225), startMs: G.omenAt - 3_660_000, endMs: G.omenAt - 3_000_000 },
    { ...far('Done', 200), startMs: G.omenAt - 3_660_000, endMs: G.omenAt - 3_000_000, done: true },
    { ...far('Later', 200), startMs: G.omenAt - 3_600_000 + EVENT_SOON_MS + 1, endMs: G.omenAt },
    { ...far('Over', 200), startMs: G.omenAt - 4_000_000, endMs: G.omenAt - 3_600_000 },
  ] }));
  assert.equal(EVENT_BOARD_RAIDS, 2);
  const raids = (rows) => rows.filter((r) => r.kind === 'raid');   // the shared clock's other events stand beside them
  assert.deepEqual(raids(m.rows).map((r) => r.town), ['Here', 'Near'], 'the nearest two');
  assert.deepEqual(raids(m.all).map((r) => r.town), ['Here', 'Near', 'Far'], 'every raid the board could stand, for the announcements');
  assert.equal(m.more, m.all.length - m.rows.length, 'and how many more');
  const [here, near] = raids(m.rows);
  assert.deepEqual([here.title, here.where, here.detail, here.live, here.announce], ['Raid on Here', 'Daggerfall', '7 of 18 raiders down', true, true]);
  assert.equal(near.detail, 'Orcs attacking', 'no ledger here: its party');
  assert.equal(near.announce, 25 * PIXEL_M <= EVENT_RAID_REACH_M, 'within the reach');
  assert.equal(raids(m.all)[2].announce, false, 'another region, past the reach: listed, never announced');
  const soon = raids(eventBoardModel(src({ gate: null, raids: [raid({ startMs: OPEN + 60_000 })] })).rows)[0];
  assert.deepEqual([soon.live, soon.at, soon.detail], [false, OPEN + 60_000, 'Orcs gather to attack']);
  assert.equal(raids(eventBoardModel(src({ gate: null, raids: [raid({ n: 30, tg: 18 })] })).rows)[0].detail, '18 of 18 raiders down', 'never past its target');
});

test('EVENTS1 THE BOARD\'S CUT: at most `max` rows (EVENT_BOARD_ROWS on a desk), `more` the rest, `all` every row uncut (mutants: the cut, the count)', () => {
  assert.equal(EVENT_BOARD_ROWS, 3);
  const stars = [1, 2, 3, 4].map((k) => star({ id: `star:9.${k}`, at: OPEN + k * 60_000 }));
  const m = eventBoardModel(src({ stars }));
  assert.equal(m.rows.length, 3);
  assert.equal(m.more, 2);
  assert.equal(m.all.length, 5);
  assert.equal(eventBoardModel(src({ stars }), { max: 4 }).more, 1);
});

test('EVENTS1 THE ANNOUNCEMENTS: the first read only fills the memory; then each row that comes on is announced (`soon`, or `begun` where it came on under way), each that turns live `begun`, each once; a row that does not announce never is; a row gone is let go (mutants: the seed, the turn, the once, the announce flag)', () => {
  const seen = new Map();
  const r = (id, live, announce = true) => ({ id, kind: 'raid', live, announce });
  assert.deepEqual(eventAnnouncements([r('a', false), r('b', true)], seen, false), [], 'the first read: what stands is no news');
  assert.deepEqual(eventAnnouncements([r('a', false), r('b', true)], seen, true), [], 'nothing moved');
  assert.deepEqual(eventAnnouncements([r('a', true), r('b', true), r('c', false), r('d', true), r('e', false, false)], seen, true),
    [{ id: 'a', kind: 'raid', phase: 'begun' }, { id: 'c', kind: 'raid', phase: 'soon' }, { id: 'd', kind: 'raid', phase: 'begun' }]);
  assert.deepEqual(eventAnnouncements([r('a', true), r('c', false), r('d', true), r('e', true, false)], seen, true), [], 'each once; a quiet row stays quiet');
  assert.equal(seen.has('b'), false, 'gone, let go');
});

test('EVENTS1 THE NEWS: one shown at a time (the board\'s own), each EVENT_TOAST_MS of shown time; an event\'s line joins its kind\'s news or makes its own; an announcement takes a line\'s news that waits for it; the same line again within EVENT_NOTE_SAME_MS is dropped; a news holds EVENT_TOAST_NOTES lines; past the kept, the oldest waiting goes (mutants: the merge, the sameness, the clock, the kept)', () => {
  const q = createEventToasts({ shown: 1, kept: 3 });
  q.note('gate', 'The omen burns.', 0);
  q.announce({ id: 'gate:1', kind: 'gate', phase: 'soon' });
  assert.deepEqual(q.cards().map((c) => [c.kind, c.id, c.phase, c.notes]), [['gate', 'gate:1', 'soon', ['The omen burns.']]], 'the line came first; the announcement took its news');
  q.note('gate', 'The faithful work their rite.', 10);
  q.note('gate', 'The omen burns.', 20);
  assert.deepEqual(q.cards()[0].notes, ['The omen burns.', 'The faithful work their rite.'], 'joined; the same line dropped');
  q.note('star', 'A star is falling.', 30);
  assert.equal(q.waiting(), 1, 'another kind waits its turn');
  q.step(EVENT_TOAST_MS - 1);
  assert.equal(q.cards()[0].kind, 'gate');
  q.step(1);
  assert.equal(q.cards()[0].kind, 'star', 'its time spent, the next');
  assert.equal(q.cards()[0].age, 0, 'a waiting news ages only once shown');
  q.note('serpent', 'One.', 40); q.note('super', 'Two.', 50); q.note('raid', 'Three.', 60);
  assert.deepEqual([q.cards()[0].kind, q.waiting()], ['star', 2], 'the oldest waiting went');
  q.clear();
  q.note('gate', 'The omen burns.', 70);
  assert.equal(q.cards().length, 1, 'cleared, the line is new again');
  const s = createEventToasts({ shown: 2 });
  s.note('gate', 'x', 0);
  assert.equal(s.note('gate', 'x', EVENT_NOTE_SAME_MS - 1), null);
  s.step(EVENT_TOAST_MS);
  assert.ok(s.note('gate', 'x', EVENT_NOTE_SAME_MS), 'a minute on, said again');
  const full = createEventToasts({ notes: 2 });
  full.note('raid', 'a', 0); full.note('raid', 'b', 0); full.note('raid', 'c', 0);
  assert.deepEqual(full.cards().map((c) => c.notes), [['a', 'b'], ['c']], 'a full news makes another');
  assert.ok(Object.keys(EVENT_KIND_TEXT).every((k) => typeof EVENT_KIND_TEXT[k]() === 'string'));
});

test('EVENTS1 THE DOOR: a line waits with its kind until the board takes it (an unknown kind the gate\'s, an empty line nothing), EVENT_NOTICES_KEPT at most; the board switched off, the line goes where the host seated - the chat; the seat answers the source as handed and a source that throws reads as none (mutants: the kind\'s fallback, the kept, the switch, the seat)', () => {
  _resetEventNotices(); resetPrefs();
  try {
    assert.equal(eventBoardOn(), true, 'on by default');
    assert.equal(eventNotice('star', '  A star has fallen.  '), true);
    assert.equal(eventNotice('nope', 'x'), true);
    assert.equal(eventNotice('gate', '   '), false);
    assert.deepEqual(takeEventNotices().map((l) => [l.kind, l.text]), [['star', 'A star has fallen.'], ['gate', 'x']]);
    assert.deepEqual(takeEventNotices(), [], 'taken');
    for (let i = 0; i < EVENT_NOTICES_KEPT + 5; i++) eventNotice('raid', `line ${i}`);
    const kept = takeEventNotices();
    assert.equal(kept.length, EVENT_NOTICES_KEPT);
    assert.equal(kept[0].text, 'line 5', 'the newest kept');
    const chat = [];
    const f = () => ({ now: 1 });
    assert.equal(seatEventBoard(f, (t) => chat.push(t)), f, 'the source as handed');
    assert.deepEqual(eventBoardSource(), { now: 1 });
    setPref(EVENT_BOARD_PREF, false);
    eventNotice('gate', 'The omen burns.');
    assert.deepEqual([chat, takeEventNotices()], [['The omen burns.'], []], 'off: the chat');
    setPref(EVENT_BOARD_PREF, true);
    seatEventBoard(() => { throw new Error('x'); });
    assert.equal(eventBoardSource(), null);
    const row = FEATURES.find((r) => r.id === 'event-board');
    assert.deepEqual([row.control.store, row.control.key, row.control.initial], ['prefs', EVENT_BOARD_PREF, true], 'the switch is the feature row\'s');
  } finally { _resetEventNotices(); resetPrefs(); }
});
