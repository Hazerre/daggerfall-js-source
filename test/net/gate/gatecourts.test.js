// GATE-COURTS (2026-10-26, the owner: "We need to develop instances for oblivion gate. The player counts are becoming
// too large for one instance"; asked: fifty a court, placed automatically with the party together, the gate standing
// until every court is done, each court's kill said in the chat and the night once on Discord - bible/11-Multiplayer/
// World-Bosses.md section 29): A NIGHT'S BURNING COURTS. The law (net/gate/gateCourts.js: the book's seat, the night
// done, its word, the rite's own), the rooms (net/gate/gateLaw.js gateRoomKey), the wire's `go` and `cf` and the night's
// `fell`, the relay over real Rooms (server/src/index.js _gateSentOn, _gateSeatHere, _gateBookBeat, the hub's doors), the
// client's link (net/gate/gateLink.js) and the host's wiring. tools/mutants/gatecourts.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from '../../fakeRoom.mjs';
import * as C from '../../../src/net/gate/gateCourts.js';
import { gateTimes, gateRoomKey, gateCourtOfRoom, isGateRoom, gateBossOf } from '../../../src/net/gate/gateLaw.js';
import { COURT_COPY_RE, isCourtCopy, courtOfCopy } from '../../../src/net/hubShards.js';
import { validGateOut, GATE_BRAIN_V, GATE_BRAIN_MIN, SOCIAL_ROOM, PARTY_MAX, GATE_INTERNAL_PARTY, GATE_INTERNAL_FELL, RITE_INTERNAL_DAY } from '../../../src/net/wire.js';
import { COURT_CENTRE, BRAIN_TICK_MS, HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { readReceipt } from '../../../src/net/gate/gateReceipt.js';
import { createGateLink } from '../../../src/net/gate/gateLink.js';
import { courtFellLine, fellLine } from '../../../src/systems/gate/gateOmen.js';
import { fellPost } from '../../../src/net/gate/gateHerald.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const DAY = 200;
const TT = gateTimes(DAY);
const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
const settle = () => new Promise((r) => setImmediate(r));

// ═══ THE LAW ═══════════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the law: fifty a court, sixteen courts a night, a whole party\'s slack (PARTY_MAX - 1); a court\'s room `gate:<day>.<k>` past the first, and each court copied past its sockets (mutants: the slack not the party\'s; a court past the last)', () => {
  assert.equal(C.GATE_COURT_FIGHTERS, 50, 'the owner\'s fifty');
  assert.equal(C.GATE_COURTS_MAX, 16);
  assert.equal(C.GATE_PARTY_SLACK, PARTY_MAX - 1, 'a whole party stands in one court');
  assert.equal(gateRoomKey(DAY), `gate:${DAY}`, 'the first court is the gate\'s room as it always was');
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) { const k = gateRoomKey(DAY, c); assert.ok(isGateRoom(k), k); assert.equal(gateCourtOfRoom(k), c); }
  assert.equal(isGateRoom(`gate:${DAY}.${C.GATE_COURTS_MAX}`), false, 'no court past the last');
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) { const k = gateRoomKey(DAY, c); assert.ok(isCourtCopy(`${k}#3`), `${k}#3`); assert.equal(courtOfCopy(`${k}#3`), k); }
  assert.equal(isCourtCopy(`gate:${DAY}.${C.GATE_COURTS_MAX}#1`), false, 'COURT_COPY_RE pinned to GATE_COURTS_MAX');
  assert.ok(COURT_COPY_RE.source.includes('1[0-5]'), 'the copies\' law names the sixteen courts');
  for (const c of [0, 15]) assert.equal(C.courtOk(c), true);
  for (const c of [-1, 16, 1.5, '1', null]) assert.equal(C.courtOk(c), false, String(c));
});

test('GATE-COURTS the seat: the lowest court with room that has not won, fifty a court; a seat held is its court for the night; joined where its court asked, pending where the page goes on - and a pending one lapses (mutants: the cap; a won court seated; a seat moved; never joined; never lapsing)', () => {
  const b = C.bookNew(DAY);
  const t0 = 1000;
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) assert.equal(C.placeSeat(b, `a${i}`, { asked: 0, now: t0, admits: true }), 0);
  assert.equal(C.placeSeat(b, 'b0', { asked: 0, now: t0, admits: true }), 1, 'the fifty-first: the second court');
  assert.deepEqual(b.s.b0, [1, t0, 0], 'pending - asked by the first, its court the second');
  assert.equal(C.placeSeat(b, 'b0', { asked: 2, now: t0 + 10, admits: true }), 1, 'asked by any court: its own');
  assert.equal(b.s.b0[2], 0, 'still pending - another court asked');
  assert.equal(C.placeSeat(b, 'b0', { asked: 1, now: t0 + 20, admits: true }), 1);
  assert.equal(b.s.b0[2], 1, 'joined once its own court asked');
  assert.deepEqual(C.courtCounts(b, t0 + 20).slice(0, 3), [50, 1, 0]);
  assert.equal(C.placeSeat(b, 'a3', { asked: 5, now: t0 + 30, admits: false }), 0, 'sealed: a seat held is still its court');
  assert.equal(C.placeSeat(b, 'zz', { asked: 0, now: t0 + 30, admits: false }), null, 'sealed: no newcomer');
  // a court that won seats nobody new
  C.courtFell(b, 1, { at: 5, top: ['x'], n: 1, rs: ['b0'] });
  assert.equal(C.placeSeat(b, 'c0', { asked: 0, now: t0 + 40, admits: true }), 2, 'the second won: the third');
  // a pending seat lapses: its court has room again
  const p = C.bookNew(DAY);
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(p, `p${i}`, { asked: 3, now: t0, admits: true });
  assert.equal(C.courtCounts(p, t0)[0], 50, 'given in the first, asked by another - all pending');
  assert.equal(C.placeSeat(p, 'late', { asked: 0, now: t0 + C.GATE_SEAT_PENDING_MS - 1, admits: true }), 1, 'pending seats count while they hold');
  assert.equal(C.placeSeat(p, 'later', { asked: 0, now: t0 + C.GATE_SEAT_PENDING_MS, admits: true }), 0, 'lapsed: the first court has room again');
  assert.equal(p.s.p0, undefined, 'and the lapsed seats let go');
  assert.equal(C.seatLive([0, 0, 1], 9e12), true, 'a joined seat never lapses');
  // every court full: none
  const f = C.bookNew(DAY);
  for (let c = 0; c < C.GATE_COURTS_MAX; c++) for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) f.s[`f${c}.${i}`] = [c, t0, 1];
  assert.equal(C.placeSeat(f, 'one-more', { asked: 0, now: t0, admits: true }), null, 'the night full');
});

test('GATE-COURTS the party: a newcomer sits in the lowest court where a mate holds a live seat, up to GATE_PARTY_SLACK over the fifty; past it, or a mate\'s court won, the lowest with room (mutants: the mates unread; the slack ignored; the highest mate\'s court)', () => {
  const t0 = 1000;
  const b = C.bookNew(DAY);
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(b, `a${i}`, { asked: 0, now: t0, admits: true });
  for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) C.placeSeat(b, `b${i}`, { asked: 1, now: t0, admits: true });
  C.placeSeat(b, 'c0', { asked: 2, now: t0, admits: true });
  assert.equal(C.placeSeat(b, 'stranger', { asked: 0, now: t0, admits: true }), 2, 'no mate: the lowest with room');
  assert.equal(C.placeSeat(b, 'mate-of-a', { asked: 0, now: t0, admits: true, mates: ['b9', 'a7'] }), 0, 'the lowest court a mate sits in - full, but within the slack');
  for (let i = 1; i < C.GATE_PARTY_SLACK; i++) C.placeSeat(b, `x${i}`, { asked: 0, now: t0, admits: true, mates: ['a7'] });
  assert.equal(C.courtCounts(b, t0)[0], C.GATE_COURT_FIGHTERS + C.GATE_PARTY_SLACK);
  assert.equal(C.placeSeat(b, 'too-many', { asked: 0, now: t0, admits: true, mates: ['a7'] }), 2, 'past the slack: the lowest with room');
  C.courtFell(b, 1, { at: 1, top: [], n: 50, rs: [] });
  assert.equal(C.placeSeat(b, 'mate-of-b', { asked: 0, now: t0, admits: true, mates: ['b3'] }), 2, 'a mate\'s court that won seats nobody new');
  assert.equal(C.placeSeat(b, 'self', { asked: 0, now: t0, admits: true, mates: ['self'] }), 2, 'its own name is no mate');
});

test('GATE-COURTS the night: done after the seal once every court a fighter JOINED has won, or at the wrath once any has; its word the courts that won of the courts it held, the first to win\'s best three, every winner\'s fighters; the rite\'s own to those no court paid (mutants: before the seal; a pending court counted; the wrath unread; the sum)', () => {
  const b = C.bookNew(DAY);
  assert.equal(C.nightDone(b, TT.sealAt, TT), false, 'nobody won: no night to say');
  b.s.a = [0, 1, 1]; b.s.b = [1, 1, 1]; b.s.c = [2, 1, 0];
  C.courtFell(b, 0, { at: 50, top: ['Ann'], n: 30, rs: ['a'] });
  assert.equal(C.nightDone(b, TT.sealAt - 1, TT), false, 'before the seal a newcomer could open a court');
  assert.equal(C.nightDone(b, TT.sealAt, TT), false, 'the second court still fights');
  C.courtFell(b, 1, { at: 40, top: ['Bran'], n: 20, rs: ['b', 'h1'] });
  assert.equal(C.nightDone(b, TT.sealAt, TT), true, 'every joined court won - a pending seat\'s court is no court');
  C.courtFell(b, 1, { at: 99, top: ['Nope'], n: 1, rs: [] });
  assert.deepEqual(b.f[1].top, ['Bran'], 'a court\'s first word kept');
  assert.deepEqual(C.nightWord(b, 777), { at: 777, top: ['Bran'], n: 50, w: 2, cs: 2 }, 'the first to win\'s best three; fifty fighters; two of two');
  assert.deepEqual(C.riteOnly(b, ['h1', 'h2', 'h2', 'a']), ['h2'], 'the rite\'s own to one no court paid, once');
  const w = C.bookNew(DAY);
  w.s.a = [0, 1, 1]; w.s.b = [1, 1, 1];
  C.courtFell(w, 1, { at: 1, top: [], n: 1, rs: [] });
  assert.equal(C.nightDone(w, TT.wrathAt - 1, TT), false);
  assert.equal(C.nightDone(w, TT.wrathAt, TT), true, 'at the wrath: the rest are cast back');
  assert.equal(C.bookNextAt(w, TT, TT.openAt), TT.sealAt);
  assert.equal(C.bookNextAt(w, TT, TT.sealAt), TT.wrathAt);
  assert.equal(C.bookNextAt(w, TT, TT.wrathAt), null);
  w.end = 5;
  assert.equal(C.bookNextAt(w, TT, TT.openAt), null, 'said: nothing owed');
  assert.equal(C.isBook(w), true); assert.equal(C.isBook({ d: 1 }), false); assert.equal(C.isBook(null), false);
});

// ═══ THE WIRE ═════════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the wire: `go` its day and court, `cf` a court\'s kill with its court and the courts held, the night\'s `fell` with the courts that won and held - each bounded; the brain\'s law 7 (mutants: a court past the last taken; the night\'s counts dropped)', () => {
  assert.deepEqual(validGateOut({ k: 'go', d: DAY, c: 3, x: 1 }), { k: 'go', d: DAY, c: 3 });
  for (const bad of [{ k: 'go', d: DAY, c: C.GATE_COURTS_MAX }, { k: 'go', d: DAY, c: -1 }, { k: 'go', c: 1 }, { k: 'go', d: -1, c: 1 }]) assert.equal(validGateOut(bad), null, JSON.stringify(bad));
  const fall = { at: 5, top: ['Ann'], n: 4 };
  assert.deepEqual(validGateOut({ k: 'cf', d: DAY, c: 2, ...fall }), { k: 'cf', ...fall, d: DAY, c: 2 });
  assert.deepEqual(validGateOut({ k: 'cf', d: DAY, c: 0, cs: 3, ...fall }), { k: 'cf', ...fall, d: DAY, c: 0, cs: 3 });
  for (const bad of [{ k: 'cf', c: 1, ...fall }, { k: 'cf', d: DAY, c: 16, ...fall }, { k: 'cf', d: DAY, c: 0, cs: 0, ...fall }, { k: 'cf', d: DAY, c: 0 }]) assert.equal(validGateOut(bad), null, JSON.stringify(bad));
  assert.deepEqual(validGateOut({ k: 'fell', d: DAY, w: 2, cs: 3, ...fall }), { k: 'fell', ...fall, d: DAY, w: 2, cs: 3 });
  assert.deepEqual(validGateOut({ k: 'fell', d: DAY, ...fall }), { k: 'fell', ...fall, d: DAY }, 'a night of one court, as every kill was');
  assert.equal(validGateOut({ k: 'fell', d: DAY, w: 17, ...fall }), null);
  assert.equal(GATE_BRAIN_V, 7); assert.equal(GATE_BRAIN_MIN, 7, 'a game that would not hear `go` is told to reload');
});

// ═══ THE RELAY ════════════════════════════════════════════════════════════════════════════════

/** A night's courts over real Rooms - the first court's object holding the book, the hub's party door answered as `party` says. */
async function night(fn, { start = TT.openAt + 1000, party = {} } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  try {
    return await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const get = world.ROOMS.get;
      world.ROOMS.get = (id) => { const o = get(id); return id === SOCIAL_ROOM ? { fetch: async (req) => (new URL(req.url).pathname === GATE_INTERNAL_PARTY ? new Response(JSON.stringify({ m: party[(await req.clone().json()).a] ?? [] })) : o.fetch(req)) } : o; };
      const court = (c) => world.room(gateRoomKey(DAY, c));
      const say = (R, ws, o) => R.raw(ws, JSON.stringify({ t: 'gate', ...o }));
      let n = 0;
      /** A fighter into court `c`: its hello (25 ms apart - inside the court's hello bucket, net/wire.js GATE_HELLO_HZ_MAX), its `in`. */
      const into = async (c, id, pose = at((n % 12) - 6, 3 + Math.floor(n / 12) % 8)) => { n++; const R = court(c); const ws = R.connect(); clock += 25; await R.hello(ws, id, pose); await say(R, ws, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle(); return ws; };
      const fire = async (c) => { const R = court(c); if (R.alarm.at != null) await R.fire(); await settle(); };
      const tick = async (cs, k = 1) => { for (let i = 0; i < k; i++) { clock += BRAIN_TICK_MS; for (const c of cs) { const R = court(c); if (R.alarm.at != null && clock >= R.alarm.at) await R.fire(); } await settle(); } };
      const hub = world.room(SOCIAL_ROOM);
      return await fn({ world, court, say, into, fire, tick, hub, now: () => clock, set: (t) => { clock = t; } });
    });
  } finally { Date.now = realNow; }
}
const id = (i) => `peer-${String(i).padStart(4, '0')}`;

test('GATE-COURTS the relay: the first court seats fifty, the fifty-first is sent on (`go`) and fights in the second court\'s own fight; one court a night - a fighter at another court\'s door is sent back to its own (mutants: the book unasked; the seat unconfirmed; the go unsaid; one fight for every court)', async () => {
  await night(async ({ court, into, say, tick, set }) => {
    const first = [];
    for (let i = 0; i < 50; i++) first.push(await into(0, id(i)));
    assert.ok(first.every((ws) => gates(ws, 'st').some((m) => m.me === 1)), 'fifty seated in the first court');
    const late = await into(0, id(50));
    assert.deepEqual(gates(late, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 1 }], 'the fifty-first: the second court');
    assert.equal(gates(late, 'st').length, 0, 'and nothing of the first court\'s fight');
    assert.equal(court(0).room._fight.players[`acct-${id(50)}`], undefined, 'not seated in the first court\'s fight');
    const there = await into(1, id(50));
    assert.ok(gates(there, 'st').some((m) => m.me === 1), 'seated in the second court');
    assert.ok(court(1).room._fight.players[`acct-${id(50)}`], 'the second court\'s own fight');
    assert.notEqual(court(1).room._fight, court(0).room._fight);
    assert.equal(court(1).room._fight.cn, 1, 'the fight knows its court');
    assert.deepEqual(court(0).store.get('gatebook').s[`acct-${id(50)}`].slice(0, 1).concat(court(0).store.get('gatebook').s[`acct-${id(50)}`][2]), [1, 1], 'the book: the second court, joined');
    // one court a night: a first-court fighter at the third court's door, a second-court fighter at the first's
    const stray = await into(2, id(3));
    assert.deepEqual(gates(stray, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 0 }], 'back to its own court');
    assert.equal(court(2).room._fight ?? null, null, 'the third court stood no fight for it');
    const back = court(0).connect(); await court(0).hello(back, id(50), at(0, 3));
    await say(court(0), back, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle();
    assert.deepEqual(gates(back, 'go'), [{ t: 'gate', k: 'go', d: DAY, c: 1 }]);
    await tick([0, 1], 4);
    assert.ok(gates(there, 'hp').length + gates(there, 'st').length + gates(there, 'atk').length > 0, 'the second court beats on its own');
    // after the seal a court's own fighter is its own court's to admit (no book there - its fight's seat)
    set(TT.sealAt + 1000);
    const again = court(1).connect(); await court(1).hello(again, id(50), at(0, 3));
    assert.equal(again.closed, null, 'a second-court fighter back at its court after the seal');
    const none = court(1).connect(); await court(1).hello(none, id(51), at(0, 3));
    assert.deepEqual(none.sent, [{ t: 'error', m: 'the gate is sealed' }], 'a stranger at a court past the first after the seal');
  });
});

test('GATE-COURTS the relay: a party stands together - the book asks the hub its party only once the night holds more than one court, and seats a mate in its party\'s court past the fifty (mutants: the hub never asked; asked for every newcomer; the mate unplaced)', async () => {
  const party = { [`acct-${id(99)}`]: [`acct-${id(99)}`, `acct-${id(60)}`] };
  await night(async ({ world, court, into }) => {
    let asked = 0;
    const get = world.ROOMS.get;
    world.ROOMS.get = (n) => { const o = get(n); return n === SOCIAL_ROOM ? { fetch: (req) => { if (new URL(req.url).pathname === GATE_INTERNAL_PARTY) asked++; return o.fetch(req); } } : o; };
    for (let i = 0; i < 10; i++) await into(0, id(i));
    assert.equal(asked, 0, 'one court with room: no party to ask');
    for (let i = 10; i < 50; i++) await into(0, id(i));
    // the second court opens, its first fighter id(60); then the first court's ... mate id(99) comes
    const g = await into(0, id(60));
    assert.deepEqual(gates(g, 'go').map((m) => m.c), [1]);
    await into(1, id(60));
    for (let i = 61; i <= 110; i++) { if (i === 99) continue; const w = await into(0, id(i)); const c = gates(w, 'go')[0]?.c; if (c != null) await into(c, id(i)); }
    assert.equal(C.courtCounts(court(0).store.get('gatebook'), Date.now())[1], 50, 'the second court full');
    const mate = await into(0, id(99));
    assert.deepEqual(gates(mate, 'go').map((m) => m.c), [1], 'its party\'s court, past the fifty');
    assert.ok(asked > 0, 'the hub asked once the night held two courts');
  }, { party });
});

test('GATE-COURTS the relay: each court\'s kill is its own - its receipts, the hub\'s `cf` (its court; the first court\'s the courts it holds), the book told; the gate stands for the night\'s other courts until the seal, and the night\'s `fell` is said once every joined court has won - its courts, once (mutants: a court\'s kill said as the night; the book untold; the night before the seal; said twice)', async () => {
  await night(async ({ court, into, fire, tick, hub, set }) => {
    const h = hub.connect(); await hub.hello(h, id(900));
    const a = await into(0, id(1));
    const c1 = court(0);
    for (let i = 2; i <= 50; i++) await into(0, id(i));
    await into(0, id(51));
    const b = await into(1, id(51));
    await tick([0, 1], 3);
    // the second court wins first
    const f1 = court(1).room._fight;
    f1.players[`acct-${id(51)}`].stoodMs = 1e9; f1.hp = 1;
    await court(1).raw(b, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await settle();
    assert.equal(gates(b, 'fell').length, 1, 'the second court saw its kill');
    assert.equal(gates(a, 'fell').length, 0, 'the first court\'s fight goes on');
    assert.equal(gates(b, 'rcpt').length, 1, 'and its fighter its receipt');
    await tick([0, 1], 2);
    assert.deepEqual(gates(h, 'cf').map((m) => [m.c, m.cs ?? null]), [[1, null]], 'the hub said the second court\'s kill');
    assert.equal(gates(h, 'fell').length, 0, 'the gate stands');
    assert.ok(c1.store.get('gatebook').f[1], 'the book heard it');
    assert.equal(court(1).store.get('gatefight').booked, true);
    // the first court wins before the seal: said, the gate still standing
    const f0 = c1.room._fight;
    f0.players[`acct-${id(1)}`].stoodMs = 1e9; f0.hp = 1;
    await c1.raw(a, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await tick([0, 1], 2);
    assert.deepEqual(gates(h, 'cf').map((m) => [m.c, m.cs ?? null]), [[1, null], [0, 2]], 'the first court\'s kill, and the courts the night holds');
    assert.equal(gates(h, 'fell').length, 0, 'before the seal a newcomer may open a third court');
    // the seal: every joined court has won - the night, once
    set(TT.sealAt);
    await fire(0);
    const night = gates(h, 'fell');
    assert.equal(night.length, 1);
    assert.deepEqual([night[0].d, night[0].at, night[0].w, night[0].cs, night[0].n], [DAY, TT.sealAt, 2, 2, 51]);
    await tick([0, 1], 30);
    assert.equal(gates(h, 'fell').length, 1, 'once');
    assert.equal(c1.store.get('gatebook').told, 1);
  });
});

test('GATE-COURTS the relay: the rite\'s own receipt is the night\'s book\'s, minted at the night\'s end for one who broke the rite and holds no court\'s - never at a court\'s kill (mutants: minted by the court; to a court\'s fighter; before the night)', async () => {
  await night(async ({ world, court, into, fire, tick, hub, set }) => {
    const get = world.ROOMS.get;
    world.ROOMS.get = (n) => { const o = get(n); return n === SOCIAL_ROOM ? { fetch: async (req) => (new URL(req.url).pathname === RITE_INTERNAL_DAY ? new Response(JSON.stringify({ h: [`acct-${id(1)}`, `acct-${id(7)}`] })) : o.fetch(req)) } : o; };
    const a = await into(0, id(1));
    await tick([0], 2);
    const f = court(0).room._fight;
    f.players[`acct-${id(1)}`].stoodMs = 1e9; f.hp = 1;
    await court(0).raw(a, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell }));
    await tick([0], 2);
    assert.equal(readReceipt(gates(a, 'rcpt')[0].r).r, 1, 'the fighter who broke it: its own receipt, an ember more');
    assert.equal(Object.keys(f.rc).includes(`acct-${id(7)}`), false, 'the court mints no rite\'s receipt');
    assert.equal(hub.store.get(`gaterc:acct-${id(7)}`), undefined, 'not before the night');
    set(TT.sealAt);
    await fire(0);
    const kept = hub.store.get(`gaterc:acct-${id(7)}`);
    assert.ok(kept, 'the hub keeps the rite\'s own');
    assert.equal(readReceipt(kept.r).x, 'rite');
    assert.equal(readReceipt(kept.r).b, gateBossOf(DAY).id);
    assert.equal(readReceipt(hub.store.get(`gaterc:acct-${id(1)}`).r).x === 'rite', false, 'never over a court\'s');
  });
});

test('GATE-COURTS the relay: the night full - every court seated - a newcomer is the court\'s watcher; after the seal the first court is the door of a fighter of any court, a stranger refused (mutants: the full night seated; a court\'s fighter shut out at the first court after the seal)', async () => {
  await night(async ({ court, into, set, say }) => {
    const book = C.bookNew(DAY);
    for (let c = 1; c < C.GATE_COURTS_MAX; c++) for (let i = 0; i < C.GATE_COURT_FIGHTERS; i++) book.s[`acct-c${c}.${i}`] = [c, Date.now(), 1];
    book.s[`acct-${id(77)}`] = [4, Date.now(), 1];
    court(0).store.set('gatebook', book);
    for (let i = 0; i < 50; i++) await into(0, id(i));
    const w = await into(0, id(50));
    assert.deepEqual(gates(w, 'no').map((m) => m.m), ['the court is full'], 'every court full: the watcher\'s word');
    assert.ok(gates(w, 'st').length === 1 && gates(w, 'st')[0].me === undefined, 'handed the first court\'s fight to watch');
    set(TT.sealAt + 1000);
    const back = court(0).connect(); await court(0).hello(back, id(77), at(0, 3));
    assert.equal(back.closed, null, 'a fourth-court fighter comes in at the first court after the seal');
    await say(court(0), back, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await settle();
    assert.deepEqual(gates(back, 'go').map((m) => m.c), [4], 'and is sent on to its own');
    const stranger = court(0).connect(); await court(0).hello(stranger, id(88), at(0, 3));
    assert.deepEqual(stranger.sent, [{ t: 'error', m: 'the gate is sealed' }]);
  });
});

test('GATE-COURTS the hub: a court\'s kill (`c`) said as `cf`, its receipts handed, neither kept nor the herald\'s; the night (`night`) is the gate\'s `fell`, kept and heralded once (mutants: a court\'s kill kept as the night; the herald told each court)', async () => {
  await night(async ({ hub }) => {
    hub.env.GATE_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-x';   // the herald on: what it is owed is read back
    const h = hub.connect(); await hub.hello(h, id(5));
    const door = (body) => hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body) }));
    assert.equal((await door({ d: DAY, c: 3, at: 10, top: ['Ann'], n: 4, rc: [], here: [] })).status, 200);
    assert.deepEqual(gates(h, 'cf'), [{ t: 'gate', k: 'cf', at: 10, top: ['Ann'], n: 4, d: DAY, c: 3 }]);
    assert.equal(hub.store.get('gatefell'), undefined, 'a court\'s kill is not the night');
    assert.equal(hub.store.get('herald'), undefined, 'nor owed to the channel');
    await door({ d: DAY, night: 1, at: 20, top: ['Ann'], n: 9, w: 2, cs: 3, rc: [], here: [] });
    assert.deepEqual(gates(h, 'fell'), [{ t: 'gate', k: 'fell', at: 20, top: ['Ann'], n: 9, d: DAY, w: 2, cs: 3 }]);
    assert.deepEqual(hub.store.get('gatefell'), { k: 'fell', at: 20, top: ['Ann'], n: 9, d: DAY, w: 2, cs: 3 }, 'kept for a hello');
    assert.deepEqual(hub.store.get('herald')?.owe, { d: DAY, top: ['Ann'], n: 9, w: 2, cs: 3 }, 'and owed to the channel once, with its courts');
    const party = await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_PARTY}`, { method: 'POST', body: JSON.stringify({ a: `acct-${id(5)}` }) }));
    assert.deepEqual(await party.json(), { m: [] }, 'one in no party: no mates');
    assert.equal((await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_PARTY}`, { method: 'POST', body: '{}' }))).status, 400);
  });
});

// ═══ THE CLIENT ═══════════════════════════════════════════════════════════════════════════════

test('GATE-COURTS the link: `go` moves my room to that court for its day; a court\'s kill said once in its own words, moving no fall; the night\'s `fell` the fall, said only where no court\'s was; a court\'s own `fell` folds its fight alone (mutants: the go unkept; a court\'s kill as the fall; said twice; the night said over a court\'s)', () => {
  const said = [];
  const link = createGateLink({ now: () => 0, onFell: (day, f) => said.push([day, f.c ?? null, f.cs ?? null]) });
  assert.equal(link.room(DAY), gateRoomKey(DAY), 'the first court until the book says');
  link.word({ k: 'go', d: DAY, c: 4 });
  assert.equal(link.room(DAY), gateRoomKey(DAY, 4));
  assert.equal(link.room(DAY + 1), gateRoomKey(DAY + 1), 'a court is its night\'s');
  link.word({ k: 'st', d: DAY, b: 'ruhn', ph: 1, h: 5, m: 10, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 1, fell: null, wrath: null, md: null, ct: 0, xa: [], cx: null, su: 0, rk: 0, op: 0 });
  link.word({ k: 'fell', at: 5, top: [], n: 1 });
  assert.equal(link.state().fell?.at, 5, 'a court\'s own kill folds its fight');
  assert.equal(link.fellAt(DAY), null, 'and moves no fall - it names no day, and the court it was is not the night');
  link.word({ k: 'cf', d: DAY, c: 4, at: 5, top: ['Ann'], n: 3 });
  link.word({ k: 'cf', d: DAY, c: 4, at: 5, top: ['Ann'], n: 3 });
  link.word({ k: 'cf', d: DAY, c: 0, cs: 5, at: 6, top: [], n: 2 });
  assert.deepEqual(said, [[DAY, 4, 0], [DAY, 0, 5]], 'each court once');
  assert.equal(link.fellAt(DAY), null, 'the gate stands');
  link.word({ k: 'fell', d: DAY, at: 9, top: [], n: 5, w: 2, cs: 5 });
  assert.equal(link.fellAt(DAY), 9, 'the night\'s fall');
  assert.equal(said.length, 2, 'said nothing more - its courts were');
  const quiet2 = [];
  const other = createGateLink({ now: () => 0, onFell: (day, f) => quiet2.push(f.c ?? null) });
  other.word({ k: 'fell', d: DAY, at: 9, top: [], n: 5 });
  assert.deepEqual(quiet2, [null], 'a night heard with no court\'s kill before it: said, as every kill was');
});

test('GATE-COURTS the words: a court\'s kill by its number, where, and who struck - no collapse; a night of courts on Discord says the courts that won of the courts it held (mutants: the court\'s number; the collapse said for a court)', () => {
  assert.equal(courtFellLine({ near: 'Copperham', boss: 'Valkynaz Ruhn', top: ['Ann', 'Bran'], c: 2 }), "Valkynaz Ruhn has fallen in court 3 of Dagon's Breach near Copperham, struck down by Ann, Bran.");
  assert.equal(courtFellLine({ near: null, boss: 'Valkynaz Ruhn', top: [], c: 0 }), "Valkynaz Ruhn has fallen in court 1 of Dagon's Breach in the wilds.");
  assert.ok(!courtFellLine({ near: 'X', boss: 'B', top: [], c: 0 }).includes('collapses'), 'the breach stands for the other courts');
  assert.ok(fellLine({ near: 'X', boss: 'B', top: [] }).includes('The breach collapses.'), 'the night\'s own line keeps it');
  const card = (o) => JSON.stringify(fellPost({ day: DAY, place: 'Copperham', top: ['Ann'], n: 9, ...o }));
  assert.ok(card({ w: 2, cs: 3 }).includes(`${gateBossOf(DAY).name} has fallen in 2 of 3 courts`));
  assert.ok(card({}).includes(`${gateBossOf(DAY).name} has fallen"`), 'a night of one court: the card as it was');
});

test('GATE-COURTS the wiring: the host\'s room is the court the book seats me in, a court\'s kill its own line; the relay\'s doors and its seat asked before a newcomer\'s fight (mutants: the first court forever; the doors unrouted; the seat asked after the fight is made)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /else if \(modes\?\.roomIdentity\?\.\(\)\?\.kind === 'gate'\) key = \(gateLink\?\.room \?\? gateRoomKey\)\(modes\?\.roomIdentity\?\.\(\)\?\.day\);/);
  assert.match(w, /eventNotice\('gate', \(f\.c != null \? courtFellLine : fellLine\)\(\{ \.\.\.f,/);
  const r = src('server/src/index.js');
  for (const [door, fn] of [['GATE_INTERNAL_SEAT', '_gateSeatInternal'], ['GATE_INTERNAL_COURT', '_gateCourtInternal'], ['GATE_INTERNAL_PARTY', '_gatePartyInternal']]) assert.ok(r.includes(`if (path === ${door}) return this.${fn}(request);`), door);
  const frame = r.slice(r.indexOf('  async _gateFrame(ws, a, m, now) {'));
  assert.ok(frame.indexOf('await this._gateSentOn(ws, a, f, now)') > 0 && frame.indexOf('await this._gateSentOn(ws, a, f, now)') < frame.indexOf('if (!f) { f = this._fight = GATE_SEAM.new('), 'asked before the fight is made');
  assert.ok(r.includes('if (!f) return this._gateBookTick();'), 'a first court\'s book beats with no fight of its own');
});
