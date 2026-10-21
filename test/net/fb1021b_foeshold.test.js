// FOES-HOLD (2026-10-21; bible/11-Multiplayer/Scale-Arc.md FOES-HOLD): A ROOM'S FIRST FRAMES WAIT THEIR TURN. Where a
// room's full frames alone are more than its foes budget (a Starfall's crowd), FOES-FIRST left them first-come and blind
// to size - a refused frame dropped, the next to arrive taking what the bucket had refilled - so one large owner among
// smaller ones heard none of its full frames (tools/foesFirstBench.mjs `stander`: 0%) and the owners the draw passed over
// waited half a minute between theirs. A frame that goes first is now HELD for its turn (server/src/foesHold.js): one line,
// one turn a sender, a newer full frame in its sender's place, nothing of a sender overtaking its own, a held sender beaten
// so its readers keep it, a leaving sender's handovers tried before its leave. Held here over the real Room on the pins'
// fake object, the beat through the real street pool; tools/mutants/fb1021b_foeshold.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { RoomMetrics } from '../../server/src/relayScale.js';
import { createFoesHold, holdFrame, heldHead, heldOf, unhold, served, FOES_HELD_PER_SENDER, FOES_HELD_BYTES_MAX, FOES_TURN_BYTES, FOES_BEAT_SCAN_MS } from '../../server/src/foesHold.js';
import { FOES_FULL_RESERVE, FOES_UNHEARD_MS, FOES_ROOM_BYTES_PER_S, FOES_FULL_MS, FOES_STALE_MS, FOES_FRAME_MAX, PIXEL_UNITS, RELAY_VERSION } from '../../src/net/wire.js';
import { scene, SCENES } from '../../tools/foesFirstBench.mjs';
import { relay as cellRelay, streetPlayer, clock } from './bodyLootHarness.mjs';   // the street pool, mounted as world.js mounts it

const RATE = FOES_ROOM_BYTES_PER_S;
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
async function onClock(fn) {
  const realNow = Date.now;
  let clockMs = 1_800_000_000_000;
  Date.now = () => clockMs;
  try { return await quiet(() => fn({ now: () => clockMs, tick: (ms) => { clockMs += ms; } })); } finally { Date.now = realNow; }
}
const rec = (i, e = null) => ({ i, x: 1, y: 0, z: 1, h: 10, ...(e ? { e, it: [] } : {}) });
const frameOf = (n, { full = 0, records = 2, pad = 0, hands = null, k = 'world:3,12' } = {}) => JSON.stringify({ t: 'foes', data: { n, k, full, f: Array.from({ length: records }, (_, i) => rec(i, hands)), ...(pad ? { pad: 'p'.repeat(pad) } : {}) } });
async function cellOf(n, { now, tick }, key = 'world:3,12') {
  const R = fakeRoom(key, { now });
  const socks = [];
  for (let i = 0; i < n; i++) { const ws = R.connect(); tick(100); await R.hello(ws, `fh-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
  return { R, socks };
}

test('FOES-HOLD the law (server/src/foesHold.js): a first frame takes a place; a newer full frame of its sender takes the place of its newest held frame that is no handover - its words, never its place; a delta of a sender that holds one is refused; a handover waits behind its sender\'s own; past FOES_HELD_PER_SENDER or FOES_HELD_BYTES_MAX refused; the head is the oldest place; a sent frame\'s sender keeps its turn while the turn\'s frames come to FOES_TURN_BYTES, else its frames take places at the back; a frame unheld unsent ends any turn of its sender (mutants: the place lost on a replacement; the place kept on a refusal; a holding sender\'s delta held; the cap off by one; the head the newest; the turn unbounded; the turn never kept)', () => {
  assert.deepEqual([FOES_HELD_PER_SENDER, FOES_HELD_BYTES_MAX, FOES_TURN_BYTES, FOES_BEAT_SCAN_MS], [4, 64 * FOES_FRAME_MAX, 16 * 1024, 250]);
  const A = {}, B = {}, C = {};
  const h = createFoesHold();
  const f = (ws, n, o = {}) => ({ ws, data: { n }, length: o.length ?? 100, ranged: true, full: o.full ?? true, hands: o.hands ?? false, at: o.at ?? n });
  assert.equal(holdFrame(h, f(A, 1)), 'held');
  assert.equal(holdFrame(h, f(B, 2)), 'held');
  assert.equal(holdFrame(h, f(A, 3, { length: 140 })), 'replaced', 'A\'s newer full frame');
  assert.deepEqual(h.entries.map((e) => [e.ws === A ? 'A' : 'B', e.data.n, e.seq]), [['A', 3, 0], ['B', 2, 1]], 'in A\'s place, with its words');
  assert.equal(h.bytes, 240, 'the bytes its own');
  assert.equal(heldHead(h).data.n, 3, 'the head the oldest place');
  assert.equal(holdFrame(h, f(A, 4, { full: false })), 'refused', 'a delta of a sender that holds a frame');
  assert.equal(holdFrame(h, f(C, 5, { full: false })), 'held', 'an unheard sender\'s delta takes a place');
  assert.equal(holdFrame(h, f(C, 6)), 'replaced', 'and its full frame says all it said');
  assert.equal(heldOf(h, C)[0].full, true);
  assert.equal(holdFrame(h, f(B, 7, { hands: true, full: false })), 'held', 'a handover behind its sender\'s own');
  assert.equal(holdFrame(h, f(B, 8)), 'held', 'a full frame behind a handover takes a place of its own - the handover is never replaced');
  assert.deepEqual(heldOf(h, B).map((e) => e.data.n), [2, 7, 8]);
  assert.equal(holdFrame(h, f(B, 9)), 'replaced', 'the newest no handover');
  assert.equal(holdFrame(h, f(B, 10, { hands: true, full: false })), 'held', 'the fourth');
  assert.equal(heldOf(h, B).length, FOES_HELD_PER_SENDER);
  assert.equal(holdFrame(h, f(B, 11, { hands: true, full: false })), 'refused', 'past FOES_HELD_PER_SENDER');
  const big = createFoesHold();
  assert.equal(holdFrame(big, f(A, 1, { length: FOES_HELD_BYTES_MAX - 10 })), 'held');
  assert.equal(holdFrame(big, f(B, 2, { length: 11 })), 'refused', 'past FOES_HELD_BYTES_MAX');
  assert.equal(holdFrame(big, f(B, 2, { length: 10 })), 'held', 'to it, held');
  assert.equal(holdFrame(big, f(A, 3, { length: FOES_HELD_BYTES_MAX })), 'refused', 'a replacement past it too');
  // the turn
  const t = createFoesHold();
  holdFrame(t, f(A, 1, { length: 7000 }));
  holdFrame(t, f(B, 2, { length: 7000 }));
  holdFrame(t, f(A, 3, { length: 5000, hands: true, full: false }));
  holdFrame(t, f(A, 4, { length: 5000, hands: true, full: false }));
  served(t, heldHead(t));
  assert.deepEqual([heldHead(t).ws === A, heldHead(t).data.n], [true, 3], 'A\'s handover in the same turn - 12,000 bytes');
  served(t, heldHead(t));
  assert.deepEqual([heldHead(t).ws === B, heldHead(t).data.n], [true, 2], 'past FOES_TURN_BYTES (17,000): B\'s turn');
  assert.ok(heldOf(t, A)[0].seq > heldOf(t, B)[0].seq, 'A\'s next at the back');
  served(t, heldHead(t));
  assert.equal(heldHead(t).data.n, 4, 'then A again');
  const u = createFoesHold();
  holdFrame(u, f(A, 1, { length: 3000 })); holdFrame(u, f(A, 2, { length: 3000, hands: true, full: false })); holdFrame(u, f(B, 3, { length: 3000 }));
  served(u, heldHead(u));
  assert.equal(u.turn.ws, A, 'A\'s turn under way');
  assert.equal(unhold(u, heldHead(u)), true);
  assert.equal(u.turn, null, 'a frame unheld unsent ends its sender\'s turn');
  assert.equal(unhold(u, { ws: A }), false, 'a frame never held');
});

test('FOES-HOLD THE LINE over the real Room: a full frame the budget refuses is held, and goes first once the bucket holds it - before a smaller full frame that came after it and would have fitted, which waits its turn behind it; while any frame is held no delta passes; a holding sender\'s delta is dropped and its newer full frame goes in its place, never the older; each to the listeners its sender has where it stands at its turn (mutants: FH-delta-passes-a-held-frame; FH-drain-unasked; FH-a-small-frame-jumps-the-line; FH-replacement-drops-the-place; FH-drain-floor-at-zero)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(24, clk);
    const [L, S, D] = socks;
    const heard = (ws) => socks.filter((o) => o !== ws && ofType(o, 'foes').some((m) => m.id === R.room._attach(ws).id && m.data.n !== undefined)).length;   // a numbered frame - a beat carries none
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    for (const ws of [L, S, D]) await R.raw(ws, frameOf(0, { full: 0 }));   // each heard once: no sender here goes first for being unheard
    clk.tick(200); clear();
    const bigFan = (frameOf(1, { full: 1, pad: 60_000 }).length + 15) * 23;
    assert.ok(bigFan > FOES_FULL_RESERVE && bigFan < RATE + FOES_FULL_RESERVE, `the large frame's fan past what an empty bucket affords, inside what a full one does (${bigFan})`);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(1, { full: 1, pad: 60_000 }));
    assert.equal(heard(L), 0, 'the large full frame: refused');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'and held');
    clk.tick(10);
    await R.raw(S, frameOf(2, { full: 1 }));
    assert.equal(heard(S), 0, 'a small full frame that fits waits behind it');
    clk.tick(10);
    await R.raw(D, frameOf(3, { full: 0 }));
    assert.equal(heard(D), 0, 'a delta passes no held frame');
    await R.raw(L, frameOf(4, { full: 0 }));
    assert.equal(heard(L), 0, 'nor its sender\'s own');
    clk.tick(1100);
    R.room._roomFoes = { bytes: 0, at: clk.now() };   // still short of the large fan
    await R.raw(L, frameOf(5, { full: 1, pad: 60_000 }));
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map((e) => e.data.n), [5, 2], 'L\'s newer full frame in L\'s place');
    clk.tick(1);
    clear();
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    await R.raw(D, frameOf(6, { full: 0 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [5, 2, 6], 'its turn: the large one first, in its newest words, then the small one, then the delta');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 0);
    const c = R.room._metrics.c;
    assert.ok(c.held >= 3 && c.heldSent === 2, `held ${c.held}, sent ${c.heldSent}`);
  });
});

test('FOES-HOLD NOTHING PASSES A HELD FRAME, AND A HELD FRAME BORROWS: with a fan too large for the bucket waiting, a delta the reserve would afford is dropped all the same; the held frame goes once the bucket holds its fan down to minus FOES_FULL_RESERVE - borrowing, not waiting for a whole one; a newer full frame of its sender inside its cadence takes its place in the line, the older never sent (mutants: FH-delta-passes-a-held-frame; FH-drain-floor-at-zero; FH-newer-full-dropped-inside-the-cadence)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(48, clk);
    const [L, D] = socks;
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    clk.tick(5000);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    for (const ws of [L, D]) await R.raw(ws, frameOf(0, { full: 0 }));
    clk.tick(1200); clear();
    const fan = (frameOf(1, { full: 1, pad: 60_000 }).length + 15) * 47;
    assert.ok(fan > 2 * FOES_FULL_RESERVE + 10_000 && fan < RATE + FOES_FULL_RESERVE, `a fan past twice the reserve (${fan})`);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(1, { full: 1, pad: 60_000 }));
    clk.tick(300);
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE + 50_000, at: clk.now() };   // the delta's floor and room for it - short of the held fan
    await R.raw(D, frameOf(2, { full: 0 }));
    assert.equal(ofType(socks[5], 'foes').length, 0, 'a delta the reserve affords passes no held frame');
    clk.tick(10);
    R.room._roomFoes = { bytes: 0, at: clk.now() };
    await R.raw(L, frameOf(3, { full: 1, pad: 60_000 }));   // inside its cadence: a delta to the budget - and its sender's newer list
    assert.deepEqual(R.room._foesHoldOf('foes').entries.map((e) => e.data.n), [3], 'a newer full frame inside the cadence takes its sender\'s place');
    clk.tick(10);
    R.room._roomFoes = { bytes: fan - FOES_FULL_RESERVE / 2, at: clk.now() };   // short of the whole fan, past it less the reserve
    await R.raw(D, frameOf(4, { full: 0 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [3], 'the held frame goes, borrowing - its newest words; the delta behind it within its floor or not');
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE && R.room._roomFoes.bytes < 0, 'into the debt the reserve bounds');
    clk.tick(730);   // FOES_FIRST_MS and 50 after L's turn was taken - its frame 3 took L's place, and spent no turn
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: clk.now() };   // the deltas' floor
    await R.raw(L, frameOf(5, { full: 1 }));
    assert.deepEqual(ofType(socks[5], 'foes').map((m) => m.data.n), [3, 5], 'L\'s next turn, first past the reserve (mutants: FF-turn-on-any-full)');
  });
});

test('FOES-HOLD A HELD SENDER IS STILL HEARD: a sender whose frames wait while it streams is beaten once its readers have heard nothing of it for FOES_UNHEARD_MS - an empty frame of its own, `{ f: [] }` and its held frame\'s `k`, no number, no `full` - once each FOES_UNHEARD_MS; a sender gone quiet past FOES_FULL_MS is not; and the street pool takes the beat as its owner heard - its record kept past FOES_STALE_MS, its counter unmoved, nothing swept (mutants: FH-beat-unasked; FH-beat-every-scan; FH-beat-for-a-quiet-sender; FH-beat-numbered; FH-beat-uncounted)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [H, B] = socks;
    clk.tick(5000);
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };   // a bucket that never holds a fan
    starve();
    await R.raw(H, frameOf(1, { full: 1 }));
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'held');
    const beats = () => ofType(socks[3], 'foes').filter((m) => m.id === 'fh-0000' && m.data.n === undefined);
    const stream = (n, t) => frameOf(n + t, { full: t % FOES_FULL_MS === 0 ? 1 : 0 });   // world.js foesStream: every FOES_MS, whole every FOES_FULL_MS
    for (let t = 200; t <= FOES_UNHEARD_MS + 2000; t += 200) { clk.tick(200); starve(); await R.raw(H, stream(2, t)); }
    const said = beats();
    assert.equal(said.length, 1, `one beat in ${FOES_UNHEARD_MS + 2000} ms`);
    assert.deepEqual(said[0], { t: 'foes', id: 'fh-0000', data: { f: [], k: 'world:3,12' } }, 'an empty frame of its own: its held frame\'s k, no number, no full');
    assert.equal(R.room._metrics.c.beats, 1);
    const scans = [];
    for (let i = 0; i < 20; i++) { clk.tick(20); starve(); await R.raw(H, frameOf(50_000 + i, { full: 0 })); scans.push(R.room._foesHoldOf('foes').beatAt); }
    const at = [...new Set(scans)];
    assert.ok(at.length >= 2 && at.every((t, i) => i === 0 || t - at[i - 1] >= FOES_BEAT_SCAN_MS), `twenty frames in 400 ms: the held senders asked at most each FOES_BEAT_SCAN_MS (${at.map((t) => t - at[0])})`);
    for (let t = 200; t <= FOES_UNHEARD_MS; t += 200) { clk.tick(200); starve(); await R.raw(H, stream(90_000, t)); }
    assert.equal(beats().length, 2, 'the next FOES_UNHEARD_MS on');
    // a sender gone quiet: B held, then silent; H's frames keep the lane asked
    clk.tick(FOES_FULL_MS);   // H's own frames go on below; B says nothing past its one
    starve();
    await R.raw(B, frameOf(200_000, { full: 1 }));
    const bBeats = () => ofType(socks[3], 'foes').filter((m) => m.id === 'fh-0001' && m.data.n === undefined).length;
    for (let t = 200; t <= FOES_UNHEARD_MS + 2000; t += 200) { clk.tick(200); starve(); await R.raw(H, stream(300_000, t)); }
    assert.equal(bBeats(), 0, 'a sender that streams no longer is not beaten - its readers let it go as they did');
  });
  // the reader: the street pool (scenes/exteriorFoes.js applyFoes, pruneOwners), the owner's frame its own pool's mint
  const net = cellRelay();
  const owner = streetPlayer(net, 'own-0001', [30, 0, 30]);
  const reader = streetPlayer(net, 'rdr-0002', [11, 0, 11]);
  const alive = new Set(['own-0001']);
  const rat = await owner.pool().spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.ok(rat, 'the owner\'s foe stands');
  const first = owner.frame(true);
  reader.foes('own-0001', first);
  const stands = () => reader.pool().foes.some((x) => x.puppet === 'own-0001' && !x.dead);
  for (let i = 0; i < 40 && !stands(); i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(stands(), 'its puppet stands at the reader');
  clock.t += FOES_UNHEARD_MS;
  assert.equal(reader.foes('own-0001', { f: [], k: first.k }), true, 'the beat lands');
  clock.t += FOES_STALE_MS - FOES_UNHEARD_MS + 500;
  reader.prune(alive);
  assert.ok(stands(), 'kept past FOES_STALE_MS of its last numbered frame - and nothing swept');
  const next = owner.frame(true);
  assert.equal(next.n, first.n + 1);
  assert.equal(reader.foes('own-0001', next), true, 'its counter unmoved: the held frame that comes in its turn is taken');
  clock.t += FOES_STALE_MS + 1;
  reader.prune(alive);
  assert.equal(stands(), false, 'without a word, let go as before');
});

test('FOES-HOLD A SENDER LEAVING: its held handover is tried before its leave is said - on its lane\'s budget, never deeper than minus FOES_FULL_RESERVE - and its other held frames go with it; a handover is never aged out, a full frame FOES_STALE_MS old leaves the hold unsent (mutants: FH-leave-untried; FH-leave-after-the-word; FH-leave-borrows-deeper; FH-handover-aged-out; FH-full-never-aged)', async () => {
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [O] = socks;
    clk.tick(5000);
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE + 10, at: clk.now() };
    await R.raw(O, frameOf(1, { full: 1 }));
    await R.raw(O, frameOf(2, { hands: 'fh-0003' }));
    assert.equal(heldOf(R.room._foesHoldOf('foes'), O).length, 2, 'both held');
    clk.tick(300);   // the bucket refills past a handover's fan
    await R.drop(O);
    const words = socks[2].sent.filter((m) => m.t === 'foes' || m.t === 'leave').map((m) => (m.t === 'leave' ? 'leave' : m.data.n));
    assert.deepEqual(words, [2, 'leave'], 'the handover, then the leave - the full frame gone with its sender');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 0);
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE, 'no deeper than the reserve');
    // a leave the budget cannot afford: nothing borrowed
    const [, P] = socks;
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 };
    await R.raw(P, frameOf(3, { hands: 'fh-0003' }));
    await R.drop(P);
    assert.equal(socks[2].sent.filter((m) => m.t === 'foes' && m.data.n === 3).length, 0, 'refused at the floor');
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE, 'never put the room deeper in debt');
  });
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(6, clk);
    const [A, B, C] = socks;
    clk.tick(5000);
    const starve = () => { R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() + 10_000 }; };
    starve();
    await R.raw(A, frameOf(1, { full: 1 }));
    await R.raw(B, frameOf(2, { hands: 'fh-0002' }));
    clk.tick(FOES_STALE_MS + 1); starve();
    await R.raw(C, frameOf(3, { full: 0 }));
    const left = R.room._foesHoldOf('foes').entries.map((e) => e.data.n);
    assert.deepEqual(left.filter((n) => n < 3), [2], 'the full frame FOES_STALE_MS old gone unsent, the handover kept');   // (C, unheard on this instance, holds its own word behind them)
    assert.ok(R.room._metrics.c.heldGone >= 1);
  });
});

test('FOES-HOLD A STAR, measured (tools/foesFirstBench.mjs over the real Room): the stander - one owner of 48 records among 39 of 24 - hears its full frames as often as the rest (0% before), every owner\'s full frames come round inside FOES_STALE_MS (37 s apart at the 99th before); at the record cap no owner unheard past its readers\' patience; an owner handing on three batches at once is heard whole; a page that calls every 16 KiB frame a handover buys its one turn and no more; the quiet and the crowded cells as they were (mutants: FH-a-small-frame-jumps-the-line; FH-beat-unasked; FH-hands-dropped-inside-the-cadence)', async () => {
  const by = (name) => SCENES.find((s) => s.name === name);
  const quietCell = await scene(by('quiet'), 20);
  assert.deepEqual([quietCell.full, quietCell.delta], [100, 100], 'inside the budget, everything');
  const crowded = await scene(by('crowded'), 20);
  assert.equal(crowded.full, 100);
  assert.ok(crowded.delta > 5, `the deltas past the budget, some heard (${crowded.delta}%)`);
  const stander = await scene(by('stander'), 20);
  assert.ok(stander.heavyFull > 30 && Math.abs(stander.heavyFull - stander.full) < 10, `the stander's full frames as the rest's (${JSON.stringify(stander)})`);
  assert.ok(stander.gapP99 * 1000 < FOES_STALE_MS + 1000, 'every owner\'s full frames come round');
  assert.equal(stander.stale, 0);
  const star = await scene(by('star80'), 20);
  assert.ok(star.gapMax * 1000 < FOES_STALE_MS + 1500 && star.stale === 0, `the bigger star (${JSON.stringify(star)})`);
  const big = await scene(by('big'), 20);
  assert.equal(big.stale, 0, `the record cap: nobody past its readers' patience (${JSON.stringify(big)})`);
  assert.ok(big.unheardMax * 1000 < FOES_STALE_MS && big.beats > 0, 'kept by the beats');
  const burst = await scene(by('burst'), 20);
  assert.equal(burst.hands, 100, `three batches at once, every one heard (${JSON.stringify(burst)})`);
  const liar = await scene(by('liar'), 20);
  assert.ok(liar.flood < 10 && liar.full > 55 && liar.gapP99 * 1000 < FOES_STALE_MS, `a page whose every frame is a "handover" buys its turn (${JSON.stringify(liar)})`);
});

test('FOES-HOLD the metrics point: the frames held, the held sent, the held gone unsent, their waits summed and the beats, as blob6 to blob10 after FOES-FIRST\'s three, decimal; reset with the window (mutants: a hold blob dropped; their order; the waits unsummed)', async () => {
  const m = new RoomMetrics(0);
  Object.assign(m.c, { frames: 1, hitDrops: 1, fullDrops: 2, fulls: 3, held: 4, heldSent: 5, heldGone: 6, heldMs: 7.4, beats: 8 });
  const got = [];
  m.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 7, 'w', 1, true);
  assert.deepEqual(got[0].blobs, ['world', 'w', '1', '2', '3', '4', '5', '6', '7', '8']);
  assert.deepEqual([m.c.held, m.c.heldSent, m.c.heldGone, m.c.heldMs, m.c.beats], [0, 0, 0, 0, 0]);
  await onClock(async (clk) => {
    const { R, socks } = await cellOf(4, clk);
    clk.tick(5000);
    R.room._roomFoes = { bytes: -FOES_FULL_RESERVE, at: clk.now() };
    await R.raw(socks[0], frameOf(1, { full: 1 }));
    clk.tick(400);
    R.room._roomFoes = { bytes: RATE, at: clk.now() };
    await R.raw(socks[1], frameOf(2, { full: 0 }));
    assert.deepEqual([R.room._metrics.c.held, R.room._metrics.c.heldSent, R.room._metrics.c.heldMs], [1, 1, 400], 'held, sent 400 ms on');
    assert.ok(RELAY_VERSION);
  });
});
