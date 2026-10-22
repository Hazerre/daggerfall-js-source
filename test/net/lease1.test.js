// LEASE1 (2026-10-22, mob of the staff panel's freeze and mute: "this need addressed"; design doc "DFO Staff Panel: design",
// "Holding against a modded game: room leases"; net/roomLease.js): THE HUB'S WORD IN EVERY ROOM. The hub hands each socket a
// signed lease - its account, its mute and freeze, when it lapses - and the game hands it to every lease room it holds; a
// lease room takes the hub's word from one newer than its own, and while `leaseDoor` is on, a build that hands on none is
// turned away and a bound socket whose lease lapsed is closed `busy`. Over real Rooms (test/fakeRoom.mjs) and the session's
// fake socket (test/fakeSocket.mjs). tools/mutants/lease1.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import * as H from '../../src/net/hubShards.js';
import { leaseKeyOf, mintLease, readLease, leaseRoom, relaySupportsLease, LEASE_MS, LEASE_LIFE_S, LEASE_FRAME_MIN_MS, LEASE_OLD_REASON, LEASE_LAPSED } from '../../src/net/roomLease.js';
import { parseClient, cellRoomOfWire, chatRegionRoom, chatLangRoom, CHAT_WORLD_ROOM, CHAT_TRADE_ROOM, CHAT_LFG_ROOM, CLOSE_BUSY, CLOSE_POLICY, PIXEL_UNITS, LEASE_WIRE_MAX, GROUND_LAW, GRANT_HELLO_LAW } from '../../src/net/wire.js';
import { RELAY_CFG_KEYS, RELAY_INTERNAL_CFG } from '../../src/net/relayCfg.js';
import { mintOrder, _b64url } from '../../src/net/identityToken.js';
import { OnlineSession } from '../../src/net/online.js';

const { subtle } = globalThis.crypto;
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const GATE = (async () => { const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); return Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'); })();
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const CELL = cellRoomOfWire(P0.x, P0.z);
const of = (ws, t) => ws.sent.filter((f) => f.t === t);
const lines = (ws) => of(ws, 'chat').map((f) => f.text);

test('LEASE1 THE LEASE: minted with the relay\'s key and read back whole; another key\'s, a body changed under its mac, a lapsed one, one from past the clock\'s skew and one whose life is not LEASE_LIFE_S read as none; the frame and the rooms it binds (mutants: the mac unchecked; the life unchecked; the lapse; the skew; a hub bound)', async () => {
  const secret = await GATE;
  const k = await leaseKeyOf(secret, { subtle }), other = await leaseKeyOf(`${secret}x`, { subtle });
  for (const none of ['', undefined, null, 7]) assert.equal(await leaseKeyOf(none, { subtle }), null);
  const at = 1_800_000_000;
  const l = await mintLease({ s: 'acct-mac-0001', mu: at + 600, at }, k, { subtle });
  assert.ok(l.length <= LEASE_WIRE_MAX);
  assert.deepEqual(await readLease(l, k, { subtle, nowS: at }), { s: 'acct-mac-0001', mu: at + 600, fz: 0, at, u: at + LEASE_LIFE_S });
  assert.equal(await readLease(l, other, { subtle, nowS: at }), null, 'another key\'s');
  assert.ok(await readLease(l, k, { subtle, nowS: at + LEASE_LIFE_S - 1 }));
  assert.equal(await readLease(l, k, { subtle, nowS: at + LEASE_LIFE_S }), null, 'lapsed');
  assert.ok(await readLease(l, k, { subtle, nowS: at - 30 }));
  assert.equal(await readLease(l, k, { subtle, nowS: at - 31 }), null, 'from past the skew');
  const enc = (o) => _b64url.encode(new TextEncoder().encode(JSON.stringify(o)));
  const mac = l.slice(l.indexOf('.') + 1);
  assert.equal(await readLease(`${enc({ s: 'acct-mac-0001', m: 0, f: 0, a: at, u: at + LEASE_LIFE_S })}.${mac}`, k, { subtle, nowS: at }), null, 'the mute taken off under the mac');
  const signed = async (o) => { const body = enc(o); return `${body}.${_b64url.encode(new Uint8Array(await subtle.sign('HMAC', k, new TextEncoder().encode(body))))}`; };
  assert.ok(await readLease(await signed({ s: 'acct-mac-0001', m: 0, f: 0, a: at, u: at + LEASE_LIFE_S }), k, { subtle, nowS: at }), 'the hand-signed control reads');
  assert.equal(await readLease(await signed({ s: 'acct-mac-0001', m: 0, f: 0, a: at, u: at + 10 * LEASE_LIFE_S }), k, { subtle, nowS: at }), null, 'a longer life than the law\'s');
  assert.equal(await readLease(await signed({ s: 'no', m: 0, f: 0, a: at, u: at + LEASE_LIFE_S }), k, { subtle, nowS: at }), null, 'no account');
  assert.equal(await readLease(await signed({ s: 'acct-mac-0001', m: -1, f: 0, a: at, u: at + LEASE_LIFE_S }), k, { subtle, nowS: at }), null);
  for (const bad of [{ s: 'no', at }, { s: 'acct-mac-0001', mu: -1, at }, { s: 'acct-mac-0001', fz: 1.5, at }, { s: 'acct-mac-0001', at: 0 }]) assert.equal(await mintLease(bad, k, { subtle }), null, JSON.stringify(bad));
  for (const junk of [null, 5, '', 'a.b.c', `${l}x`.repeat(3), '.x']) assert.equal(await readLease(junk, k, { subtle, nowS: at }), null);
  // the frame
  assert.deepEqual(parseClient('{"t":"lease"}', { hasHello: false }), { error: 'lease before hello' });
  assert.deepEqual(parseClient('{"t":"lease"}', { hasHello: true }), { t: 'lease' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'lease', l }), { hasHello: true }), { t: 'lease', l });
  for (const v of [5, '', 'x'.repeat(LEASE_WIRE_MAX + 1), null]) assert.deepEqual(parseClient(JSON.stringify({ t: 'lease', l: v }), { hasHello: true }), { error: 'bad lease' }, String(v));
  const hello = (ls) => parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'secret-of-mac-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, ls }), { hasHello: false });
  assert.equal(hello(1).ls, 1);
  for (const v of [undefined, 0, 2, '1', true]) assert.equal(hello(v).ls, undefined, String(v));
  // the rooms
  for (const key of [CHAT_TRADE_ROOM, CHAT_LFG_ROOM, chatRegionRoom(3), H.regionShardRoom(3, 1), chatLangRoom('de'), CELL, 'dungeon:m123', 'interior:m123456.7']) assert.equal(leaseRoom(key), true, key);
  for (const key of [CHAT_WORLD_ROOM, H.hubOfSubject('acct-mac-0001'), 'nowhere', null]) assert.equal(leaseRoom(key), false, String(key));
  assert.deepEqual([relaySupportsLease('world241'), relaySupportsLease('world242'), relaySupportsLease('world300'), relaySupportsLease(null), relaySupportsLease('world')], [false, true, true, false, false]);
  assert.ok(RELAY_CFG_KEYS.includes('leaseDoor'));
  assert.ok(new TextEncoder().encode(LEASE_OLD_REASON).length <= 123 && new TextEncoder().encode(LEASE_LAPSED).length <= 123);
});

/** A hub, a Trade channel and a cell, apart (no binding between them), on one clock and one relay secret. */
async function rooms(t, env = {}) {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const secret = await GATE;
  const make = (key) => { const r = fakeRoom(key, { now: () => now }); Object.assign(r.env, { GATE_SIGNING_KEY: secret }, env); return r; };
  const hub = make(CHAT_WORLD_ROOM), trade = make(CHAT_TRADE_ROOM), cell = make(CELL);
  const join = async (R, id, extra = {}) => { const ws = R.connect(); now += 300; await quiet(() => R.hello(ws, id, R === cell ? P0 : null, extra)); return ws; };
  const key = await leaseKeyOf(secret, { subtle });
  const lease = (o) => mintLease({ at: Math.floor(now / 1000), ...o }, key, { subtle });
  const say = (R, ws, o) => quiet(() => R.raw(ws, JSON.stringify(o)));
  return { hub, trade, cell, join, lease, say, tick: (ms) => { now += ms; }, nowS: () => Math.floor(now / 1000) };
}

test('LEASE1 THE HUB HANDS ITS SOCKET A LEASE: its own account, its mute as the hub holds it, LEASE_LIFE_S of life - one a socket every LEASE_FRAME_MIN_MS; a room that is not the hub mints none, and the hub reads none; a relay without the secret hands out none (mutants: minted in any room; read in any room; the mute unsaid; the rate unread)', async (t) => {
  const W = await rooms(t);
  const mu = W.nowS() + 3600;
  const ws = await W.join(W.hub, 'mac-0001', { mu });
  await W.say(W.hub, ws, { t: 'lease' });
  const got = of(ws, 'lease');
  assert.equal(got.length, 1);
  const read = await readLease(got[0].l, await leaseKeyOf(await GATE, { subtle }), { subtle, nowS: W.nowS() });
  assert.deepEqual({ ...read, at: 0, u: 0 }, { s: 'acct-mac-0001', mu, fz: 0, at: 0, u: 0 });
  assert.equal(read.u - read.at, LEASE_LIFE_S);
  W.tick(LEASE_FRAME_MIN_MS - 1);
  await W.say(W.hub, ws, { t: 'lease' });
  assert.equal(of(ws, 'lease').length, 1, 'inside LEASE_FRAME_MIN_MS: nothing');
  W.tick(1);
  await W.say(W.hub, ws, { t: 'lease' });
  assert.equal(of(ws, 'lease').length, 2, 'past it: the next');
  assert.equal(ws.closed, null);
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.hub, ws, { t: 'lease', l: await W.lease({ s: 'acct-mac-0001', fz: W.nowS() + 600 }) });
  assert.deepEqual([ws.att.ld, ws.att.fz, ws.att.mu], [undefined, undefined, mu], 'the hub hands leases out and takes none: its own word stands');
  const tr = await W.join(W.trade, 'mac-0001');
  await W.say(W.trade, tr, { t: 'lease' });
  assert.equal(of(tr, 'lease').length, 0, 'a channel mints none');
  assert.equal(tr.closed, null);
  const bare = fakeRoom(CHAT_WORLD_ROOM);
  const b = bare.connect();
  await quiet(() => bare.hello(b, 'mac-0002'));
  await quiet(() => bare.raw(b, '{"t":"lease"}'));
  assert.equal(of(b, 'lease').length, 0, 'no secret, no lease');
});

test('LEASE1 A LEASE ROOM TAKES THE HUB\'S WORD from a lease newer than its own: a mute the game never carried holds in Trade, a mute lifted at the hub is lifted there; another account\'s, a lapsed, a forged and an older lease change nothing (mutants: the account unread; the law time unread; applied in a room it does not bind)', async (t) => {
  const W = await rooms(t);
  const mac = await W.join(W.trade, 'mac-0001', { ls: 1 });
  const ear = await W.join(W.trade, 'ear-0001', { ls: 1 });
  W.tick(1000);
  const mu = W.nowS() + 3600;
  await W.say(W.trade, mac, { t: 'lease', l: await W.lease({ s: 'acct-ear-0001', mu }) });
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'chat', text: 'still free' });
  assert.ok(lines(ear).includes('still free'), 'another account\'s lease says nothing of mine');
  W.tick(LEASE_FRAME_MIN_MS);
  const lapsed = await W.lease({ s: 'acct-mac-0001', mu, at: W.nowS() - LEASE_LIFE_S });
  await W.say(W.trade, mac, { t: 'lease', l: lapsed });
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'lease', l: `${(await W.lease({ s: 'acct-mac-0001' })).split('.')[0]}.${(await W.lease({ s: 'acct-mac-0001', mu })).split('.')[1]}` });
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'chat', text: 'free yet' });
  assert.ok(lines(ear).includes('free yet'), 'neither a lapsed lease nor a forged one');
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'lease', l: await W.lease({ s: 'acct-mac-0001', mu }) });
  W.tick(1000);
  await W.say(W.trade, mac, { t: 'chat', text: 'muted now' });
  assert.ok(!lines(ear).includes('muted now'), 'the hub\'s mute holds where no order was carried');
  assert.equal(of(mac, 'muted').at(-1)?.until, mu);
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'lease', l: await W.lease({ s: 'acct-mac-0001', mu: 0 }) });
  W.tick(1000);
  await W.say(W.trade, mac, { t: 'chat', text: 'lifted' });
  assert.ok(lines(ear).includes('lifted'), 'and its lifting too');
  assert.equal(mac.closed, null);
  // a lease minted before a mute the room was carried is old news: replayed after it, it lifts nothing
  W.tick(LEASE_FRAME_MIN_MS);
  const before = await W.lease({ s: 'acct-mac-0001', mu: 0 });
  W.tick(2000);
  const kp = await W.trade.signer();
  await W.say(W.trade, ear, { t: 'mute', order: await mintOrder({ s: 'acct-mac-0001', mu: W.nowS() + 3600 }, kp.privateKey, { subtle, nowS: W.nowS() }) });
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.trade, mac, { t: 'lease', l: before });
  W.tick(1000);
  await W.say(W.trade, mac, { t: 'chat', text: 'replayed' });
  assert.ok(!lines(ear).includes('replayed'), 'a lease older than a carried mute lifts nothing');
  // a lease older than the room's word: a token minted after it
  const oldAt = W.nowS();
  const old = await W.lease({ s: 'acct-new-0001', mu });
  W.tick(5000);
  const fresh = await W.join(W.trade, 'new-0001', { ls: 1 });
  await W.say(W.trade, fresh, { t: 'lease', l: old });
  W.tick(1000);
  await W.say(W.trade, fresh, { t: 'chat', text: 'newer token' });
  assert.ok(lines(ear).includes('newer token'), 'an older lease says nothing over a newer token');
  assert.equal(fresh.att.ld, oldAt + LEASE_LIFE_S, 'yet it leased the socket: to the lease\'s own lapse');
});

test('LEASE1 A FROZEN SOCKET IS HEARD IN NOTHING BUT ITS PING AND ITS LEASE: its poses and lines go nowhere, until a lease lifts it (mutants: the freeze unread; the ping dropped; the lease dropped)', async (t) => {
  const W = await rooms(t);
  const ice = await W.join(W.cell, 'ice-0001', { ls: 1 });
  const ear = await W.join(W.cell, 'ear-0001', { ls: 1 });
  W.tick(1000);
  const fz = W.nowS() + 600;
  await W.say(W.cell, ice, { t: 'lease', l: await W.lease({ s: 'acct-ice-0001', fz }) });
  assert.equal(ice.att.fz, fz);
  const heard = ear.sent.length;
  W.tick(1000);
  await W.say(W.cell, ice, { t: 'pose', p: { ...P0, x: P0.x + 50 } });
  await W.say(W.cell, ice, { t: 'chat', text: 'help' });
  assert.equal(ear.sent.length, heard, 'nothing of it reached the room');
  await W.say(W.cell, ice, { t: 'ping' });
  assert.deepEqual(ice.sent.at(-1), { t: 'pong' });
  W.tick(LEASE_FRAME_MIN_MS);
  await W.say(W.cell, ice, { t: 'lease', l: await W.lease({ s: 'acct-ice-0001', fz: 0 }) });
  W.tick(1000);
  await W.say(W.cell, ice, { t: 'chat', text: 'thawed' });
  assert.ok(lines(ear).includes('thawed'));
  assert.equal(ice.closed, null);
});

test('LEASE1 THE DOOR: off, a build that hands on no lease is let in, and a bound socket with no lease yet or a lapsed one stands and is heard; on, a lease room refuses such a hello (GROUND-GATE\'s words, CLOSE_POLICY, LEASE_OLD_REASON) and the hub never does, a bound socket is heard in nothing but its ping until its first lease lands - NO GRACE (a review of the PR: a changed game that reconnected inside one was never leased, and a token carries no freeze) - a frame right behind a lease still being read waits on it and is heard, and a bound socket whose lease lapsed is closed CLOSE_BUSY at its own next frame while a renewed one stands (mutants: the door always on; the hub bound; the renewed closed; the lapse unread; a grace back; the frame not waiting on its lease)', async (t) => {
  const off = await rooms(t);
  const ear0 = await off.join(off.trade, 'ear-0000', { ls: 1 });
  const old = await off.join(off.trade, 'old-0001');
  const bound = await off.join(off.trade, 'bnd-0001', { ls: 1 });
  assert.equal(bound.att.ld, 0, 'bound, with no lease until its first lands: no grace');
  assert.equal(old.att.ld, undefined, 'an old build is bound to nothing');
  off.tick(LEASE_LIFE_S * 1000);
  await off.say(off.trade, bound, { t: 'chat', text: 'no lease yet' });
  await off.say(off.trade, old, { t: 'chat', text: 'an old build' });
  assert.deepEqual([old.closed, bound.closed], [null, null], 'off: nobody refused, nobody closed');
  assert.ok(lines(ear0).includes('no lease yet') && lines(ear0).includes('an old build'), 'off: both heard');
  t.mock.restoreAll();
  const on = await rooms(t, { LEASE_DOOR: 'on' });
  const refused = await on.join(on.trade, 'old-0002');
  assert.deepEqual(refused.closed, { code: CLOSE_POLICY, reason: LEASE_OLD_REASON });
  assert.match(refused.sent.at(-1).m, /^This copy of the game is older than the world online/);
  assert.deepEqual((await on.join(on.cell, 'old-0003', {})).closed, { code: CLOSE_POLICY, reason: LEASE_OLD_REASON }, 'a cell too');
  assert.equal((await on.join(on.hub, 'old-0004')).closed, null, 'the hub binds nobody: it hands the leases out');
  const ear = await on.join(on.trade, 'ear-0001', { ls: 1 });
  const kept = await on.join(on.trade, 'kpt-0001', { ls: 1 });
  const fresh = await on.join(on.trade, 'frs-0001', { ls: 1 });
  // a changed game that hands on nothing, straight after its hello: nothing it says is heard, and it stands
  await on.say(on.trade, fresh, { t: 'chat', text: 'straight after my hello' });
  await on.say(on.trade, fresh, { t: 'ping' });
  assert.deepEqual(fresh.sent.at(-1), { t: 'pong' }, 'its ping is the runtime\'s answer, as ever');
  assert.equal(fresh.closed, null, 'not closed: its lease may be on its way');
  assert.ok(!lines(ear).includes('straight after my hello'), 'no grace: nothing it says is heard before its first lease');
  // the honest game: its lease rides just ahead of its first frame, and that frame waits on the lease's read
  const l = await on.lease({ s: 'acct-kpt-0001' });
  await Promise.all([on.say(on.trade, kept, { t: 'lease', l }), on.say(on.trade, kept, { t: 'chat', text: 'right behind my lease' })]);
  assert.ok(lines(ear).includes('right behind my lease'), 'the frame behind the lease is heard');
  on.tick(2000);
  await on.say(on.trade, fresh, { t: 'lease', l: await on.lease({ s: 'acct-frs-0001' }) });
  await on.say(on.trade, fresh, { t: 'chat', text: 'leased now' });
  assert.ok(lines(ear).includes('leased now'), 'its first lease landed: heard from then on');
  on.tick((LEASE_LIFE_S - 10) * 1000);
  await on.say(on.trade, fresh, { t: 'lease', l: await on.lease({ s: 'acct-frs-0001' }) });
  on.tick(20_000);
  await on.say(on.trade, fresh, { t: 'chat', text: 'renewed' });
  assert.equal(kept.closed, null, 'another\'s frame closes nobody: the speaker alone is looked at');
  await on.say(on.trade, kept, { t: 'chat', text: 'and now' });
  assert.equal(kept.closed?.code, CLOSE_BUSY, 'its lease lapsed: closed busy at its own next frame');
  assert.equal(kept.closed?.reason, LEASE_LAPSED);
  assert.equal(fresh.closed, null, 'renewed: stands');
  assert.ok(lines(ear).includes('renewed'));
});

test('LEASE1 THE LOAD (mob, 07:57Z: "we need to test if this affected load times", "for players", "if we affected server performasnce"): a lease room whose every socket holds a live lease never asks the hub - not on a fresh object\'s first frame past a hello, not once a minute after; a cold room lets a build that hands on no lease in without waiting on the hub, and turns it away at its next frame once the hub\'s answer says the door is on (mutants: the door asked of every frame; the hello door awaited; the unbound let stand)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const secret = await GATE;
  try {
    await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const room = (k) => { const r = W.room(k); r.env.GATE_SIGNING_KEY = secret; return r; };
      const hub = room(CHAT_WORLD_ROOM);
      let asked = 0;
      const fetch0 = hub.room.fetch.bind(hub.room);
      hub.room.fetch = (req) => { if (new URL(req.url).pathname === RELAY_INTERNAL_CFG) asked++; return fetch0(req); };
      const key = await leaseKeyOf(secret, { subtle });
      const join = async (R, id, extra, pose = null) => { const ws = R.connect(); clock += 300; await R.hello(ws, id, pose, extra); return ws; };
      const cell = room(CELL);
      const cur = await join(cell, 'cur-0001', { gl: GROUND_LAW, gv: GRANT_HELLO_LAW, ls: 1 }, P0);
      for (let s = 0; s < 300; s += 15) {   // five minutes of play: a pose every 15 s, the hub's lease handed on every 30
        clock += 15_000;
        if (s % 30 === 0) await cell.raw(cur, JSON.stringify({ t: 'lease', l: await mintLease({ s: 'acct-cur-0001', at: Math.floor(clock / 1000) }, key, { subtle }) }));
        await cell.raw(cur, JSON.stringify({ t: 'pose', p: { ...P0, x: P0.x + s } }));
      }
      assert.equal(cur.closed, null);
      assert.equal(asked, 0, 'a room whose sockets all hold live leases asks the hub nothing');
      // a developer turns the door on at the hub; a COLD channel takes an old build's hello without waiting on the hub
      const dev = await join(hub, 'dev-0001', { glyphs: ['dev'] });
      clock += 5000;
      await hub.raw(dev, JSON.stringify({ t: 'cfg', k: 'leaseDoor', v: 'on' }));
      const trade = room(CHAT_TRADE_ROOM);
      const old = await join(trade, 'old-0001', {});
      assert.equal(old.closed, null, 'let in: the hello never waited on the hub');
      await new Promise((r) => setImmediate(r));   // the ask it sent lands
      assert.equal(asked, 1, 'and the hub was asked once, beside it');
      clock += 1000;
      await trade.raw(old, JSON.stringify({ t: 'chat', text: 'hello' }));
      assert.deepEqual(old.closed, { code: CLOSE_POLICY, reason: LEASE_OLD_REASON }, 'its next frame turns it away with the door\'s own close');
      assert.match(old.sent.filter((f) => f.t === 'error').at(-1)?.m ?? '', /^This copy of the game is older than the world online/);
    });
  } finally { Date.now = realNow; }
});

/** scale5c's world (auditscale2_bus.test.js): the buses and their shards on the pins' fake objects, one clock, one relay secret. */
async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const secret = await GATE;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const room = (k) => { const r = W.room(k); r.env.GATE_SIGNING_KEY = secret; return r; };
      const bus = room(CHAT_WORLD_ROOM);
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const link = async (n, key, extra = {}) => {
        const R = room(key);
        const ws = R.connect();
        clock += 30;
        await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra });
        await settle();
        return ws;
      };
      const say = async (ws, key, o) => { await W.room(key).raw(ws, JSON.stringify(o)); await settle(); };
      try { return await fn({ W, bus, room, settle, link, say, tick: (ms) => { clock += ms; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}

test('LEASE1 THROUGH THE SHARDS: a mute the hub\'s bus took after the hello reaches the player\'s hub shard (SHARD_LAW_KEYS), so the lease that shard mints carries it; handed to a region\'s shard, the shard hands the change to its bus, where the region\'s lines are judged - the muted player\'s line reaches nobody (mutants: `mu`/`lt` not told the shard; the change not handed up)', async () => {
  await world(async ({ bus, room, link, say, tick }) => {
    const v = 'p0', c = 'p1';
    const hv = H.hubOfSubject(`acct-${v}`), hc = H.hubOfSubject(`acct-${c}`);
    const region = chatRegionRoom(3), rv = H.shardOf(region, `acct-${v}`), rc = H.shardOf(region, `acct-${c}`);
    room(region); room(rv); room(rc);
    const wv = await link(v, hv, { peer: undefined });
    const wc = await link(c, hc);
    const sv = await link(v, rv, { ls: 1 });
    const sc = await link(c, rc, { ls: 1 });
    tick(2000);
    const kp = await bus.signer();
    const mu = Math.floor(Date.now() / 1000) + 3600;
    const said = Math.floor(Date.now() / 1000);
    assert.ok(wv.att.lt < said, 'the hub shard\'s word on its mute: the token, before the order');
    await say(wc, hc, { t: 'mute', order: await mintOrder({ s: `acct-${v}`, mu }, kp.privateKey, { subtle, nowS: said }) });
    tick(2000);
    assert.equal(wv.att.mu, mu, 'the hub shard\'s own attachment carries the bus\'s mute');
    assert.equal(wv.att.lt, said, 'and when it was said');
    // the modded game carries no `law` to the region: only its lease reaches it
    tick(LEASE_FRAME_MIN_MS);
    await say(wv, hv, { t: 'lease' });
    const l = of(wv, 'lease').at(-1)?.l;
    assert.ok(l, 'the hub shard minted a lease');
    assert.equal((await readLease(l, await leaseKeyOf(await GATE, { subtle }), { subtle, nowS: Math.floor(Date.now() / 1000) })).mu, mu);
    await say(sv, rv, { t: 'lease', l });
    tick(1000);
    await say(sv, rv, { t: 'chat', text: 'region line' });
    assert.ok(!lines(sc).includes('region line'), 'the region\'s bus judged it muted');
    assert.ok(of(sv, 'muted').length > 0, 'and told it so');
    void sv; void sc;
  });
});

test('LEASE1 THE GAME: a hello to a lease room says `ls` 1 and to the hub none; the hub link asks every LEASE_MS of a relay that knows the frame and never of an older one; the hub\'s lease is kept, never sent on its own - each lease room\'s socket, the primary\'s and every halo\'s, hands it just ahead of the next frame it sends, once, and never ahead of a ping (mob, 07:57Z: "if we affected server performasnce" - a room where I do nothing is woken by nothing) (mutants: `ls` everywhere; the ask unpaced; an old relay asked; a halo skipped; sent on its own; handed ahead of every frame; handed ahead of a ping)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const session = (room, v, opts = {}) => {
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Me', id: 'me-00001', secret: 'secret-of-me-00001', presence: false, WebSocketImpl: FakeWS, now: () => now, ...opts });
    s.join(room, room === CELL ? P0 : null);
    const ws = sockets.at(-1);
    ws.open();
    return { s, ws, welcome: () => ws.receive({ t: 'welcome', id: 'me-00001', peers: [], n: 1, v }) };
  };
  const sent = (ws) => ws.sent.map((f) => JSON.parse(f));
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const hub = session(CHAT_WORLD_ROOM, 'world242');
  const trade = session(CHAT_TRADE_ROOM, 'world242');
  await settle();
  assert.equal(sent(hub.ws).find((f) => f.t === 'hello')?.ls, undefined, 'the hub: no `ls`');
  assert.equal(sent(trade.ws).find((f) => f.t === 'hello')?.ls, 1, 'a lease room: `ls` 1');
  hub.welcome(); trade.welcome();
  assert.equal(hub.s.leaseOk, true);
  hub.s.tick();
  const asks = () => sent(hub.ws).filter((f) => f.t === 'lease').length;
  assert.equal(asks(), 1, 'asked at once');
  now += LEASE_MS - 1; hub.s.tick();
  assert.equal(asks(), 1);
  now += 1; hub.s.tick();
  assert.equal(asks(), 2, 'and every LEASE_MS');
  trade.s.tick();
  assert.equal(sent(trade.ws).filter((f) => f.t === 'lease').length, 0, 'a channel asks nothing');
  const old = session(CHAT_WORLD_ROOM, 'world241');
  old.welcome();
  old.s.tick(); now += LEASE_MS; old.s.tick();
  assert.equal(sent(old.ws).filter((f) => f.t === 'lease').length, 0, 'never of a relay that closes on the frame');
  let handed = null;
  hub.s.onLease = (l) => { handed = l; };
  hub.ws.receive({ t: 'lease', l: 'body.mac' });
  await settle();
  assert.equal(handed, 'body.mac');
  handed = null;
  trade.s.onLease = (l) => { handed = l; };
  trade.ws.receive({ t: 'lease', l: 'body.mac' });
  await settle();
  assert.equal(handed, null, 'a lease from a room that is not the hub is no lease');
  const quiet0 = trade.ws.sent.length;
  assert.equal(trade.s.sendLease('body.mac'), true);
  assert.equal(trade.ws.sent.length, quiet0, 'kept, not sent: a room where I do nothing hears nothing');
  assert.equal(trade.s.sendChat('wts iron'), true);
  assert.deepEqual(sent(trade.ws).slice(-2), [{ t: 'lease', l: 'body.mac' }, { t: 'chat', text: 'wts iron' }], 'handed just ahead of my next frame there');
  now += 5000;
  assert.equal(trade.s.sendChat('still selling'), true);
  assert.equal(sent(trade.ws).filter((f) => f.t === 'lease' && f.l).length, 1, 'and once: the same lease never twice');
  trade.s.sendLease('body.mac2');
  now += 60_000; trade.s.tick();
  assert.equal(sent(trade.ws).at(-1).t, 'ping', 'a ping goes with no lease ahead of it (the runtime answers it, the room never wakes)');
  assert.equal(sent(trade.ws).filter((f) => f.t === 'lease' && f.l).length, 1);
  assert.equal(trade.s.sendChat('last call'), true);
  assert.deepEqual(sent(trade.ws).slice(-2).map((f) => f.l ?? f.t), ['body.mac2', 'chat'], 'a newer lease rides ahead of the next line');
  assert.equal(hub.s.sendLease('body.mac'), false, 'the hub is handed none back');
  assert.equal(old.s.sendLease('body.mac'), false, 'nor an old relay');
  // the world's primary and its halos
  const cell = session(CELL, 'world242', { presence: true });
  cell.welcome();
  const [hx, hz] = CELL.slice(CELL.indexOf(':') + 1).split(',').map(Number);
  const near = `world:${hx + 1},${hz}`;
  cell.s.setHalo([near]);
  const halo = sockets.at(-1);
  halo.open();
  await settle();
  assert.equal(sent(halo).find((f) => f.t === 'hello')?.ls, 1, 'a halo\'s hello says it too');
  halo.receive({ t: 'welcome', id: 'me-00001', peers: [], n: 1, v: 'world242' });
  assert.equal(cell.s.sendLease('body.mac'), true);
  assert.notDeepEqual(sent(halo).at(-1), { t: 'lease', l: 'body.mac' }, 'kept for the halo too');
  now += 1000;
  assert.equal(cell.s.sendPose({ ...P0, x: P0.x + 40 }), true);
  assert.deepEqual(sent(cell.ws).slice(-2).map((f) => f.l ?? f.t), ['body.mac', 'pose'], 'my cell: the lease, then my pose');
  assert.deepEqual(sent(halo).slice(-2).map((f) => f.l ?? f.t), ['body.mac', 'pose'], 'the halo: the lease, then my pose');
});
