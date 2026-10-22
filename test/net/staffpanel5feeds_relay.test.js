// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts, Monster watch, Bot check, Server
// load) - THE RELAY'S SIDE, over real Rooms (test/fakeRoom.mjs): a socket's frames counted in memory and reported only
// over a limit, once a window, signed; a sender's live monsters counted outdoors (indoors a host's) only while grantStrip
// is on; a natural encounter's reaction timed from its grant's mint by the poses the room already takes; nothing counted
// or posted while a feed's URL is unset; and nothing any player receives changed by any of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS, DROP_STRIKES_MAX } from '../../src/net/wire.js';
import { validGrantOut } from '../../src/net/grantLaw.js';
import { openStaffFeed, sealStaffFeed, netBatchValid, reactBatchValid, NET_FEED_V, REACT_FEED_V, NET_KINDS, STAFF_FEED_SIG_HEADER, STAFF_FEED_ROWS, STAFF_FEED_AGE_MAX_MS, REACT_EPISODE_MS, NET_FEED_MS, NET_HOT, FOE_HOT } from '../../server/src/staffFeedLaw.js';
import { staffNetFlush, staffReactFlush, staffReactTick, staffFeedsStop, netHot, foeHot, REACT_OPEN_MAX } from '../../server/src/staffFeeds.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const CELL = cellRoomOfWire(P0.x, P0.z), ROOM = 'interior:m123456.7';
const NET_URL = 'https://accounts.example/v1/staff/net-feed', REACT_URL = 'https://accounts.example/v1/mod/reaction-feed';

/** Rooms on one clock with the relay's receipt key, the account service's door recorded (`status` its next answers). */
async function relay(t, env = {}) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pk = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const posts = [], status = [];
  const room = (key) => {
    const r = fakeRoom(key, { now: () => now });
    Object.assign(r.env, { GATE_SIGNING_KEY: pk, ...env });
    r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ url: req.url, sig: req.headers.get(STAFF_FEED_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: status.shift() ?? 202 }); } };
    t.after(() => { staffFeedsStop(r.room); return r.room._grantFlush(); });
    return r;
  };
  const join = async (r, id, pose) => {
    const ws = r.connect();
    await r.hello(ws, id, pose, { lv: 7, charLevel: 12 });
    let n = 0;
    return { ws, id, ask: (body) => r.raw(ws, JSON.stringify({ t: 'grant', id: ++n, ...body })) };
  };
  const open = async (i, v = NET_FEED_V) => {
    const o = await openStaffFeed(v, posts[i].body, posts[i].sig, kp.publicKey, { subtle, nowMs: now });
    assert.ok(o.ok, JSON.stringify(o));
    return o.batch;
  };
  return { kp, room, join, posts, status, open, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('STAFF-PANEL5-FEEDS THE LAW: a net batch\'s rows hold their law - the busiest 10 s within the busiest minute within the window, the kinds adding to the frames, an account\'s id; a monster row\'s split adds to its owned; an episode\'s times within its length, its kind a natural encounter\'s; each feed opens only under its own word, signed, young and whole (mutants: the kinds\' sum unchecked; a peak over the window; the version word not signed; the age unchecked)', async () => {
  const net = { a: 'acct-1234', n: 10, b: 900, p10: 4, pb10: 300, p60: 6, pb60: 500, k: [6, 1, 0, 0, 2, 1, 0], nr: 0, j: 0, c: 0 };
  const foe = { a: 'acct-1234', o: 5, h: 0, r: 2, e: 1, bo: 1, s: 1, x: 0 };
  const b = { v: NET_FEED_V, id: '0123456789abcdef', at: T * 1000, q: CELL, from: T * 1000 - 1000, ms: 1, net: [net], foe: [foe] };
  assert.equal(netBatchValid(b), true);
  for (const bad of [{ ...net, k: [6, 1, 0, 0, 2, 0, 0] }, { ...net, p10: 7 }, { ...net, p60: 11 }, { ...net, pb10: 501 }, { ...net, a: 'no' }, { ...net, w: 'x'.repeat(41) }, { ...net, nr: -1 }])
    assert.equal(netBatchValid({ ...b, net: [bad] }), false, JSON.stringify(bad));
  assert.equal(netBatchValid({ ...b, foe: [{ ...foe, r: 3 }] }), false, 'a split that is not its owned');
  assert.equal(netBatchValid({ ...b, net: [], foe: [] }), false, 'an empty batch');
  assert.equal(netBatchValid({ ...b, net: Array(STAFF_FEED_ROWS).fill(net) }), false, 'past its bound');
  assert.equal(netBatchValid({ ...b, ms: 2 }), false);
  const ep = { a: 'acct-1234', k: 'enc', n: 2, t: T * 1000 - 5000, ms: 5000, ps: 20, w0: 0, mv: 12, tn: 40, p1: 100, ac: 900 };
  const r = { v: REACT_FEED_V, id: '0123456789abcdef', at: T * 1000, q: CELL, rows: [ep] };
  assert.equal(reactBatchValid(r), true);
  for (const bad of [{ ...ep, k: 'camp' }, { ...ep, n: 5 }, { ...ep, ac: 5001 }, { ...ep, ms: REACT_EPISODE_MS + 1 }, { ...ep, t: T * 1000 + 1 }, { ...ep, w0: 2 }])
    assert.equal(reactBatchValid({ ...r, rows: [bad] }), false, JSON.stringify(bad));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const s = await sealStaffFeed(b, kp.privateKey, { subtle });
  const nowMs = T * 1000;
  assert.ok((await openStaffFeed(NET_FEED_V, s.body, s.sig, kp.publicKey, { subtle, nowMs })).ok);
  assert.deepEqual(await openStaffFeed(REACT_FEED_V, s.body, s.sig, kp.publicKey, { subtle, nowMs }), { error: 'feed-signature' }, 'one feed\'s batch is never the other\'s');
  assert.deepEqual(await openStaffFeed(NET_FEED_V, s.body, s.sig, kp.publicKey, { subtle, nowMs: nowMs + STAFF_FEED_AGE_MAX_MS + 1 }), { error: 'feed-stale' });
  assert.deepEqual(await openStaffFeed(NET_FEED_V, s.body, s.sig, null, { subtle, nowMs }), { error: 'feed-closed' });
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  assert.deepEqual(await openStaffFeed(NET_FEED_V, s.body, s.sig, other.publicKey, { subtle, nowMs }), { error: 'feed-signature' });
  assert.equal(await sealStaffFeed({ ...b, net: [{ ...net, n: 11 }] }, kp.privateKey, { subtle }), null, 'the relay seals nothing its law refuses');
  // the hot rules: a busy 10 s by frames or bytes, a refusal, junk or a close since the window began - each alone
  const s0 = { p10: 0, pb10: 0, nr0: 3, j0: 2, c0: 1 }, m0 = { nr: 3, junk: 2, nc: 1 };
  assert.equal(netHot(s0, m0), false, 'quiet');
  assert.equal(netHot({ ...s0, p10: NET_HOT.frames10 - 1 }, m0), false);
  assert.equal(netHot({ ...s0, p10: NET_HOT.frames10 }, m0), true);
  assert.equal(netHot({ ...s0, pb10: NET_HOT.bytes10 - 1 }, m0), false);
  assert.equal(netHot({ ...s0, pb10: NET_HOT.bytes10 }, m0), true);
  for (const k of ['nr', 'junk', 'nc']) assert.equal(netHot(s0, { ...m0, [k]: m0[k] + 1 }), true, k);
  const f0 = { o: FOE_HOT.own - 1, h: FOE_HOT.host - 1, x: 0 };
  assert.equal(foeHot(f0), false);
  assert.equal(foeHot({ ...f0, o: FOE_HOT.own }), true);
  assert.equal(foeHot({ ...f0, h: FOE_HOT.host }), true);
  assert.equal(foeHot({ ...f0, x: 1 }), true);
});

test('STAFF-PANEL5-FEEDS NETWORK BURSTS: a socket flooding poses is counted - its frames and bytes, the busiest 10 s and minute, by kind, the frames its meter refused - and a quiet one is not reported; the window posts once it has gone by, signed, to the net door; a close for "too many" is counted with its words; nothing is counted with the door unset (mutants: a refusal uncounted; the kind read off the wrong word; a quiet socket reported; counted with the door unset)', async (t) => {
  const R = await relay(t, { STAFF_NET_FEED_URL: NET_URL });
  const C = R.room(CELL);
  const mac = await R.join(C, 'sock-mac-01', P0), ann = await R.join(C, 'sock-ann-01', P0);
  for (let i = 0; i < 100; i++) await C.pose(mac.ws, { ...P0, x: P0.x + i });
  for (let i = 0; i < 3; i++) await C.pose(ann.ws, { ...P0, x: P0.x + i });
  await C.chat(mac.ws, 'hi');
  R.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(C.room), true);
  assert.equal(R.posts.length, 1);
  assert.equal(R.posts[0].url, NET_URL);
  const b = await R.open(0);
  assert.equal(b.q, CELL);
  assert.equal(b.ms, 0, 'grantStrip off: monsters not measured');
  assert.deepEqual(b.net.map((r) => r.a), ['acct-sock-mac-01'], 'the quiet one is not reported');
  const row = b.net[0];
  assert.equal(row.k[NET_KINDS.indexOf('move')], 100);
  assert.equal(row.k[NET_KINDS.indexOf('chat')], 1);
  assert.equal(row.k[NET_KINDS.indexOf('other')], 1, 'its hello');
  assert.equal(row.n, 102);
  assert.equal(row.p10, 102);
  assert.equal(row.p60, 102);
  assert.ok(row.nr >= 70 && row.nr < 100, `the pose gate's refusals (${row.nr})`);
  assert.equal(row.c, 0);
  assert.deepEqual(b.foe, []);
  assert.equal(await staffNetFlush(C.room), false, 'a window posts once');
  // a close: the pose gate's strikes past DROP_STRIKES_MAX
  for (let i = 0; i < DROP_STRIKES_MAX + 40 && !mac.ws.closed; i++) await C.pose(mac.ws, { ...P0, x: P0.x + i });
  const closed = mac.ws.sent.find((m) => m.t === 'error');
  assert.equal(closed?.m, 'too many poses');
  R.tick(NET_FEED_MS);
  await staffNetFlush(C.room);
  const c = (await R.open(1)).net.find((r) => r.a === 'acct-sock-mac-01');
  assert.equal(c.c, 1);
  assert.equal(c.w, 'too many poses');
  // the door unset: nothing counted, nothing posted
  const off = await relay(t);
  const D = off.room(CELL);
  const zed = await off.join(D, 'sock-zed-01', P0);
  for (let i = 0; i < 60; i++) await D.pose(zed.ws, { ...P0, x: P0.x + i });
  assert.equal(D.room._staffNet, undefined);
  off.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(D.room), false);
  assert.equal(off.posts.length, 0);
});

test('STAFF-PANEL5-FEEDS MONSTER WATCH: while grantStrip is on, a sender\'s full frame\'s distinct live monsters outdoors are its own - over the limit reported, split regular, elite, boss and sea, a body not counted; under it not; indoors a host\'s, never owned; a record the relay strips counted on its sender; grantStrip off, the stream is not read and the batch says so (mutants: a body counted; the elite unsplit; an indoor host counted as owner; the strip uncounted)', async (t) => {
  const R = await relay(t, { STAFF_NET_FEED_URL: NET_URL, GRANT_STRIP: 'on' });
  const C = R.room(CELL);
  const mac = await R.join(C, 'sock-mac-01', P0), ann = await R.join(C, 'sock-ann-01', P0);
  const rec = (i, extra = {}) => ({ i, t: 0, f: [1, 2, 3], ...extra });
  const f = [...Array(30).keys()].map((i) => rec(i + 1)).concat(rec(31, { z: 1 }), rec(32, { t: 7, cp: 1, l: 10 }), rec(33, { t: 11 }), rec(34, { t: 41 }), rec(35, { d: 1 }), rec(36, { t: 16, gg: 1 }));
  await C.raw(mac.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f } }));
  await C.raw(mac.ws, JSON.stringify({ t: 'foes', data: { n: 2, k: CELL, full: 0, f: f.slice(0, 3) } }));   // a delta: no count
  await C.raw(ann.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f: [rec(1), rec(2), rec(3, { k: 1e6, h: 1e6 })] } }));   // a rat no builder could give: stripped
  const W = R.room(ROOM);
  const host = await R.join(W, 'sock-host-1', { x: 3, y: 1, z: 4, yaw: 0, pitch: 0 });
  R.tick(1000);   // the room's host is its longest in
  await R.join(W, 'sock-guest-1', { x: 3, y: 1, z: 4, yaw: 0, pitch: 0 });
  await W.raw(host.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: ROOM, full: 1, f: [...Array(100).keys()].map((i) => rec(i + 1)) } }));
  R.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(C.room), true);
  const b = await R.open(0);
  assert.equal(b.ms, 1, 'measured');
  assert.deepEqual(b.net, []);
  const mine = b.foe.find((r) => r.a === 'acct-sock-mac-01');
  assert.deepEqual(mine, { a: 'acct-sock-mac-01', o: 35, h: 0, r: 30, e: 1, bo: 2, s: 2, x: 0 }, 'live ones alone, split');
  const stripped = b.foe.find((r) => r.a === 'acct-sock-ann-01');
  assert.equal(stripped.x, 1, 'the strip on its sender');
  assert.equal(stripped.o, 2, 'and what stood');
  assert.deepEqual(b.foe.map((r) => r.a), ['acct-sock-ann-01', 'acct-sock-mac-01'], 'a strip first');
  assert.equal(await staffNetFlush(W.room), true);
  assert.deepEqual((await R.open(1)).foe, [{ a: 'acct-sock-host-1', o: 0, h: 100, r: 0, e: 0, bo: 0, s: 0, x: 0 }], 'indoors a host of 100, owning none');
  // under the limit: nothing
  const Q = await relay(t, { STAFF_NET_FEED_URL: NET_URL, GRANT_STRIP: 'on' });
  const D = Q.room(CELL);
  const zed = await Q.join(D, 'sock-zed-01', P0);
  await Q.join(D, 'sock-yan-01', P0);
  await D.raw(zed.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f: [...Array(FOE_HOT.own - 1).keys()].map((i) => rec(i + 1)) } }));
  Q.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(D.room), false);
  // grantStrip off: the stream not read
  const O = await relay(t, { STAFF_NET_FEED_URL: NET_URL });
  const E = O.room(CELL);
  const kim = await O.join(E, 'sock-kim-01', P0);
  await O.join(E, 'sock-lou-01', P0);
  await E.raw(kim.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f } }));
  assert.equal(E.room._staffNet, undefined, 'not read');
});

test('STAFF-PANEL5-FEEDS BOT CHECK: a natural encounter\'s mint opens its asker\'s episode, and the poses it already sends time it - the first pose, the weapon drawn, the first swing, the first blow landed and taken, the distance and turn in the first 3 s, a death ending it; one never answered ends at its length; two open a socket at most; a camp opens none; a leave ends what is open; the window posts signed to the reaction door (mutants: the clock not the ask\'s; a swing unread; the turn unwrapped; the cap unchecked; a camp timed)', async (t) => {
  const R = await relay(t, { REACTION_FEED_URL: REACT_URL });
  const C = R.room(CELL);
  const mac = await R.join(C, 'sock-mac-01', P0);
  await R.join(C, 'sock-ann-01', P0);
  await mac.ask({ k: 'mint', kind: 'enc', n: 2 });
  await mac.ask({ k: 'mint', kind: 'camp', n: 3 });
  const say = async (ms, p) => { R.tick(ms); await C.pose(mac.ws, { ...P0, ...p }); };
  await say(200, {});
  await say(300, { wd: 1 });
  await say(400, { wd: 1, an: 1, x: P0.x + 40, yaw: 3 });   // 1 m, and a turn across the seam
  await say(600, { wd: 1, an: 1, x: P0.x + 80, yaw: -3, hk: 1, hp: [1, 2, 3] });
  await say(2500, { wd: 1, an: 2, x: P0.x + 400, yaw: -3, hk: 1, hp: [1, 2, 3], hu: 1, uq: [1, 2, 3] });
  await say(4000, { wd: 1, an: 2, x: P0.x + 400, yaw: -3, dd: 1 });
  assert.equal(await staffReactFlush(C.room), true);
  assert.equal(R.posts[0].url, REACT_URL);
  const b = await R.open(0, REACT_FEED_V);
  assert.equal(b.rows.length, 1, 'the camp timed nothing');
  const e = b.rows[0];
  assert.deepEqual({ a: e.a, k: e.k, n: e.n, p1: e.p1, wd: e.wd, ac: e.ac, hk: e.hk, hu: e.hu, dd: e.dd, ms: e.ms, ps: e.ps, w0: e.w0, mv: e.mv },
    { a: 'acct-sock-mac-01', k: 'enc', n: 2, p1: 200, wd: 500, ac: 900, hk: 1500, hu: 4000, dd: 8000, ms: 8000, ps: 6, w0: 0, mv: 20 });
  assert.equal(e.tn, Math.round((3 + 2 * Math.PI - 6) * 100), 'the turn across the seam, wrapped');
  // never answered: ended at its length; the cap of open ones a socket; a leave ends the rest
  await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  for (let i = 0; i < REACT_OPEN_MAX + 2; i++) await mac.ask({ k: 'mint', kind: 'enc', n: 1 });
  assert.equal(C.room._staffReact.open.get(mac.ws).length, REACT_OPEN_MAX);
  R.tick(REACT_EPISODE_MS);
  await staffReactTick(C.room, R.now);
  assert.equal(C.room._staffReact.openN, 0);
  await mac.ask({ k: 'mint', kind: 'enc', n: 4 });
  await C.drop(mac.ws);
  assert.equal(C.room._staffReact.openN, 0, 'a leave ends it');
  assert.equal(await staffReactFlush(C.room), true);
  const rows = (await R.open(1, REACT_FEED_V)).rows;
  assert.deepEqual(rows.map((r) => [r.n, r.ms, r.p1 ?? null]), [[1, REACT_EPISODE_MS, null], [1, REACT_EPISODE_MS, null], [4, 0, null]]);
});

test('STAFF-PANEL5-FEEDS NOTHING A PLAYER RECEIVES CHANGES: the same play with both feeds on and off - every frame each socket is sent the same, but a grant\'s and a receipt\'s own seed and signature (mutants: a frame sent to the asker)', async (t) => {
  const play = async (env) => {
    const R = await relay(t, env);
    const C = R.room(CELL);
    const mac = await R.join(C, 'sock-mac-01', P0), ann = await R.join(C, 'sock-ann-01', P0);
    await mac.ask({ k: 'mint', kind: 'enc', n: 2 });
    for (let i = 0; i < 40; i++) { R.tick(50); await C.pose(mac.ws, { ...P0, x: P0.x + i, wd: i > 5 ? 1 : 0, an: i > 10 ? 1 : 0 }); }
    await C.raw(mac.ws, JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3] }] } }));
    R.tick(NET_FEED_MS);
    await staffNetFlush(C.room);
    await staffReactTick(C.room, R.now);
    const seen = (ws) => ws.sent.map((m) => (m.t === 'grant' ? { t: 'grant', k: validGrantOut(m)?.k } : typeof m.r === 'string' && m.r.startsWith('k1.') ? { ...m, r: 'a receipt' } : m));   // a grant's seed, a watch receipt's nonce and signature: each run's own
    return [seen(mac.ws), seen(ann.ws)];
  };
  const quiet = await play({});
  const loud = await play({ STAFF_NET_FEED_URL: NET_URL, REACTION_FEED_URL: REACT_URL, GRANT_STRIP: 'on' });
  const strip = await play({ GRANT_STRIP: 'on' });
  assert.deepEqual(loud, strip, 'the feeds on: every frame the same');
  assert.ok(quiet[1].length > 10, 'and the play heard');
});

test('STAFF-PANEL5-FEEDS A FAILED POST IS SENT AGAIN UNDER ITS OWN ID: the service failing, the batch is kept and goes ahead of the next window\'s; one the service refused is not (mutants: the retry dropped; a refusal retried)', async (t) => {
  const R = await relay(t, { STAFF_NET_FEED_URL: NET_URL });
  const C = R.room(CELL);
  const mac = await R.join(C, 'sock-mac-01', P0);
  const flood = async () => { for (let i = 0; i < 40; i++) await C.pose(mac.ws, { ...P0, x: P0.x + i }); };
  await flood();
  R.status.push(503);
  R.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(C.room), false);
  const first = (await R.open(0)).id;
  await flood();
  R.tick(NET_FEED_MS);
  assert.equal(await staffNetFlush(C.room), true);
  assert.equal(R.posts.length, 3);
  assert.equal((await R.open(1)).id, first, 'the failed one again, its own id');
  assert.notEqual((await R.open(2)).id, first);
  await flood();
  R.status.push(400);
  R.tick(NET_FEED_MS);
  await staffNetFlush(C.room);
  await flood();
  R.tick(NET_FEED_MS);
  await staffNetFlush(C.room);
  assert.equal(R.posts.length, 5, 'a refusal is not sent again');
});
