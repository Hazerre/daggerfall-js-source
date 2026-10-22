// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow; the weak spot "Follow can't
// learn the target's next room") - THE RELAY'S HALF (server/src/staffFollow.js, server/src/staffTeleport.js) and the law
// both ends run (src/net/staffFollow.js): the where note kept outside a party and read for staff alone, the seat it must
// not move, a follow's spectator told `on`, the note, `in`/`out` and `gone`, the rooms' word to the bus only for an
// account someone follows, and a staff /tp answered from the note - with what it costs the bus, measured.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, validPartyPose, parseClient } from '../../src/net/wire.js';
import { mintToken, claimsValid } from '../../src/net/identityToken.js';
import { noteOf, followNoted, followHello, followJoined, followLeft } from '../../server/src/staffFollow.js';
import {
  FOLLOW_INTERNAL_SAY, FOLLOW_RELAY_MIN, FOLLOWERS_MAX, FOLLOWED_MAX, NOTE_STALE_MS, WHERE_NOTE_MOVING_MS, WHERE_NOTE_STILL_MS,
  followSupported, whereNoteDue, noteRoom, noteWhere, validFollowSay, validFollowOut,
} from '../../src/net/staffFollow.js';
import { validStaffTeleportIn, validStaffTeleportOut } from '../../src/net/staffTeleport.js';

const { subtle } = globalThis.crypto;
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
/** A where note - the party pose (net/wire.js validPartyPose) - standing in `rk`. */
const note = (rk = 'world:100,100', more = {}) => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk, ...more });
const fol = (ws, k) => ws.sent.filter((m) => m.t === 'fol' && (!k || m.k === k));

/** A spectator's hello: its token says `hd` 1 and the account it follows (`fo`), as server-account/src/staffFollow.js mints it. */
async function spectator(r, id, fo, extra = {}) {
  const kp = await r.signer();
  const tok = await mintToken({ s: `hd-${id}`, n: 'Spectator', k: 'guest', hd: 1, fo }, kp.privateKey, { subtle, nowS: Math.floor(r.now() / 1000) - 1 });
  const ws = r.connect();
  await r.hello(ws, id, extra.pose ?? null, { name: 'Spectator', tok, ...extra });
  return ws;
}

/** The hub, on a clock of its own: `join` a player's hub link (an account's), `party` a where note from it. */
async function hub(fn) {
  let now = 1e12;
  const realNow = Date.now; Date.now = () => now;
  const r = fakeRoom(SOCIAL_ROOM, { now: () => now });
  const tick = (ms = 1000) => { now += ms; };
  const join = async (id, name = id, glyphs = []) => { const ws = r.connect(); await r.hello(ws, id, null, { name, glyphs, acct: `acct-${id}`, asecret: `secret-${id}` }); tick(); return ws; };
  const party = (ws, p) => r.raw(ws, JSON.stringify({ t: 'party', p }));
  try { await fn({ r, tick, join, party, now: () => now }); } finally { Date.now = realNow; }
}

test('STAFF-PANEL5-FOLLOW law: the note\'s pace, its room, its place, the frames\' shapes and the claims', () => {
  assert.equal(whereNoteDue(10_000, 5_000, true), true, 'a changed note 5 s on');
  assert.equal(whereNoteDue(9_999, 5_000, true), false, 'not sooner');
  assert.equal(whereNoteDue(64_999, 5_000, false), false, 'an unchanged one waits the minute');
  assert.equal(whereNoteDue(65_000, 5_000, false), true);
  assert.equal(whereNoteDue(0, -Infinity, false), true, 'the first goes at once');
  assert.equal(NOTE_STALE_MS, 2 * WHERE_NOTE_STILL_MS + 30_000);
  assert.equal(WHERE_NOTE_MOVING_MS, 5_000);
  assert.equal(followSupported(`world${FOLLOW_RELAY_MIN - 1}`), false);
  assert.equal(followSupported(`world${FOLLOW_RELAY_MIN}`), true);
  assert.equal(followSupported(null), false);
  // the room a note names: a cell's or a world room's, with its layer; a private one or none is no room
  assert.deepEqual(noteRoom(note('dungeon:m1234', { ly: 2 })), { room: 'dungeon:m1234', ly: 2 });
  assert.deepEqual(noteRoom(note('world:3,4')), { room: 'world:3,4', ly: 0 });
  assert.equal(noteRoom(note('owned:abc.m1.2')), null);
  assert.equal(noteRoom({ ...note(), rk: undefined }), null);
  assert.equal(noteRoom(null), null);
  // the wire keeps `rk` only for a cell's or a world room's, and a note's `where` moves with a room, a layer, an instance or a building alone
  assert.equal(validPartyPose(note('world:3,4')).rk, 'world:3,4');
  assert.equal(validPartyPose(note('interior:m12.345')).rk, 'interior:m12.345');
  assert.equal('rk' in validPartyPose(note('owned:abc.m1.2')), false);
  assert.equal('rk' in validPartyPose(note('chat:world')), false);
  assert.deepEqual(validPartyPose(validPartyPose(note())), validPartyPose(note()), 'idempotent - an unchanged note reads unchanged');
  assert.equal(noteWhere(note('world:1,1', { h: 1 })), noteWhere(note('world:1,1', { h: 9 })), 'health is no move');
  for (const moved of [note('world:1,2'), note('world:1,1', { ly: 2 }), note('world:1,1', { in: 2, bk: 7 }), note('world:1,1', { ins: 'x' })]) assert.notEqual(noteWhere(note('world:1,1')), noteWhere(moved));
  assert.equal(noteWhere(note('world:1,1', { bk: 7 })), noteWhere(note('world:1,1', { bk: 8 })), 'a building key outside a building is no move');
  assert.notEqual(noteWhere({ px: 1, py: 2 }), noteWhere({ px: 1, py: 3 }), 'a build that names no room: its pixel');
  // a room's word at the bus's door
  assert.deepEqual(validFollowSay({ sub: 'acct-bran', k: 'in', room: 'world:1,2', ly: 3, extra: 1 }), { sub: 'acct-bran', k: 'in', room: 'world:1,2', ly: 3 });
  assert.deepEqual(validFollowSay({ sub: 'acct-bran', k: 'out', room: 'dungeon:m9', ly: 0 }), { sub: 'acct-bran', k: 'out', room: 'dungeon:m9' });
  assert.equal(validFollowSay({ sub: 'acct-bran', k: 'out', room: 'dungeon:m9', ly: 64 }).ly, undefined);
  for (const bad of [null, {}, { sub: 'x', k: 'in', room: 'world:1,2' }, { sub: 'acct-bran', k: 'on', room: 'world:1,2' }, { sub: 'acct-bran', k: 'in', room: 'a b' }, { sub: 'acct-bran', k: 'in', room: 'w'.repeat(129) }, { sub: 'acct-bran', k: 'in' }]) assert.equal(validFollowSay(bad), null, JSON.stringify(bad));
  assert.equal(validFollowSay({ sub: 'acct-bran', k: 'in', room: 'w'.repeat(128) }).room.length, 128);
  // the game's door
  assert.deepEqual(validFollowOut({ t: 'fol', k: 'on', sub: 'acct-bran', x: 1 }), { k: 'on', sub: 'acct-bran' });
  assert.deepEqual(validFollowOut({ t: 'fol', k: 'gone', sub: 'acct-bran' }), { k: 'gone', sub: 'acct-bran' });
  assert.deepEqual(validFollowOut({ t: 'fol', k: 'note', sub: 'acct-bran', p: note(), ag: 7 }), { k: 'note', sub: 'acct-bran', p: validPartyPose(note()), ag: 7 });
  assert.equal(validFollowOut({ t: 'fol', k: 'note', sub: 'acct-bran', p: note(), ag: -1 }).ag, 0);
  assert.equal(validFollowOut({ t: 'fol', k: 'note', sub: 'acct-bran', p: { px: 'x' } }), null);
  assert.deepEqual(validFollowOut({ t: 'fol', k: 'in', sub: 'acct-bran', room: 'interior:m12.34' }), { sub: 'acct-bran', k: 'in', room: 'interior:m12.34' });
  assert.equal(validFollowOut({ t: 'fol', k: 'in', sub: 'acct-bran', room: 'chat:world' }), null, 'no room a spectator stands in');
  const home = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:12.34567`;
  assert.equal(validFollowOut({ t: 'fol', k: 'in', sub: 'acct-bran', room: home })?.room, home, 'a home is one');
  assert.equal(validFollowOut({ t: 'fol', k: 'in', sub: 'acct-bran', room: 'owned:abcdefgh.m12.34567' }), null, 'a key of no home\'s shape is none');
  assert.equal(validFollowOut({ t: 'fol', k: 'bogus', sub: 'acct-bran' }), null);
  assert.equal(validFollowOut({ t: 'stp', k: 'on', sub: 'acct-bran' }), null);
  assert.equal(validFollowOut({ t: 'fol', k: 'on', sub: 'x' }), null);
  // the claims: `fo` beside `hd` alone, never its own subject; `hd` 1 or nothing
  const c = { s: 'hd-abcd', n: 'Spectator', k: 'guest', i: 1, e: 2 };
  assert.ok(claimsValid({ ...c, hd: 1, fo: 'acct-bran' }));
  assert.ok(claimsValid({ ...c, hd: 1 }));
  assert.equal(claimsValid({ ...c, fo: 'acct-bran' }), false, 'a follow is a hidden socket\'s alone');
  assert.equal(claimsValid({ ...c, hd: 1, fo: 'hd-abcd' }), false, 'never itself');
  assert.equal(claimsValid({ ...c, hd: 1, fo: 'x' }), false);
  assert.equal(claimsValid({ ...c, hd: 1, fo: 7 }), false);
  assert.equal(claimsValid({ ...c, hd: 2 }), false);
  // an ask may say it reads notes, and (by id) that the note did not match; an answer is a note or a capture, flagged
  assert.deepEqual(validStaffTeleportIn({ k: 'ask', nonce: 'n', name: 'Bran', nt: 1, cap: 1 }), { k: 'ask', nonce: 'n', name: 'Bran', nt: 1 });
  assert.deepEqual(validStaffTeleportIn({ k: 'ask', nonce: 'n', id: 'peer-bran', nt: 1, cap: 1 }), { k: 'ask', nonce: 'n', id: 'peer-bran', nt: 1, cap: 1 });
  assert.deepEqual(validStaffTeleportIn({ k: 'ask', nonce: 'n', id: 'peer-bran', nt: 2, cap: 2 }), { k: 'ask', nonce: 'n', id: 'peer-bran' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'stp', k: 'ask', nonce: 'n', id: 'peer-bran', nt: 1, cap: 1 }), { hasHello: true }), { t: 'stp', k: 'ask', nonce: 'n', id: 'peer-bran', nt: 1, cap: 1 });
  const viaNote = validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', acct: 'acct-bran', via: 'note', note: note(), ag: 3 });
  assert.deepEqual(viaNote, { k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', acct: 'acct-bran', via: 'note', note: validPartyPose(note()), ag: 3 });
  assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', via: 'note', note: { px: 'x' } }), null);
  const dest = { kind: 'exterior', pixel: { x: 1, y: 2 }, pos: [1, 2, 3], yaw: 0, pitch: 0 };
  assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', dest, fb: 'missing' }).fb, 'missing');
  assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', dest, fb: 'other' }).fb, undefined);
  assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer-bran', name: 'Bran', dest, acct: 'a b' }).acct, undefined);
});

test('STAFF-PANEL5-FOLLOW relay: a where note outside a party is kept for staff alone - fanned to nobody, read by the account, and old ones are no note', () => hub(async ({ r, tick, join, party, now }) => {
  const bran = await join('peer-bran', 'Bran'), other = await join('peer-other', 'Other');
  const before = other.sent.length;
  await party(bran, note('world:100,100'));
  assert.equal(other.sent.length, before, 'nobody hears it');
  assert.equal(bran.sent.some((m) => m.t === 'error'), false);
  const got = noteOf(r.room, 'acct-peer-bran', now());
  assert.equal(got.p.rk, 'world:100,100');
  assert.equal(got.at, now());
  assert.equal('at' in got.p, false);
  assert.equal(noteOf(r.room, 'acct-peer-other', now()), null, 'no note sent, none read');
  tick(NOTE_STALE_MS);
  assert.ok(noteOf(r.room, 'acct-peer-bran', now()), 'NOTE_STALE_MS old is a note still');
  tick(1);
  assert.equal(noteOf(r.room, 'acct-peer-bran', now()), null, 'older is none');
  // the newest of two tabs' notes
  const tab2 = r.connect(); await r.hello(tab2, 'peer-bran-2', null, { name: 'Bran', acct: 'acct-peer-bran', asecret: 'secret-peer-bran', tokenSub: 'acct-peer-bran', cl: 1 }); tick();
  await party(tab2, note('world:7,7'));
  assert.equal(noteOf(r.room, 'acct-peer-bran', now())?.p.rk, 'world:7,7');
}));

test('STAFF-PANEL5-FOLLOW relay: a pose from a player with no party moves no seat - the tab that speaks for the account is the one that took the seat last', () => hub(async ({ r, tick, party }) => {
  const tab = async (id) => { const ws = r.connect(); await r.hello(ws, id, null, { name: 'Bran', acct: 'acct-bran', asecret: 'secret-bran', tokenSub: 'acct-bran', cl: 1 }); tick(); return ws; };
  const one = await tab('peer-bran-1');
  const two = await tab('peer-bran-2');
  const speaker = () => r.room._speaker('acct-bran');
  const was = speaker();
  for (const ws of [one, two, one]) { await party(ws, note('world:1,1', { h: Math.random() * 50 })); tick(); assert.equal(speaker(), was, 'a note moves no seat'); }
  assert.equal(r.room._attach(one).since, r.room._attach(one).since);
  const sinceOf = (ws) => r.room._attach(ws)?.since;
  const before = [sinceOf(one), sinceOf(two)];
  await party(one, note('world:9,9'));
  assert.deepEqual([sinceOf(one), sinceOf(two)], before, 'a note writes no `since`');
}));

test('STAFF-PANEL5-FOLLOW relay: a party member\'s pose is fanned without its room; a note is written at once, party or not, as the hub always wrote one', async () => {
  const writes = [];
  const sent = [];
  const fake = { _setAttach: (ws, a, lazy) => { writes.push(lazy); ws.a = a; return true; }, _attach: (ws) => ws.a, _bySub: () => new Map(), _send: (ws, s) => sent.push(s), _dead: new Set(), _gone: new Set() };
  const ws = { a: { sub: 'acct-bran', acct: 'acct-bran', party: null } };
  const p = validPartyPose(note('world:1,1'));
  const fan = followNoted(fake, ws, ws.a, p, 5);
  assert.equal('rk' in fan, false);
  assert.equal(fan.px, p.px);
  assert.deepEqual(ws.a.pm, { ...p, at: 5 }, 'kept whole, room and all');
  ws.a.party = 'party-1';
  followNoted(fake, ws, ws.a, p, 6);
  assert.deepEqual(writes, [undefined, undefined]);
  assert.equal(sent.length, 0, 'nobody follows: nobody is told');
});

test('STAFF-PANEL5-FOLLOW relay: a spectator\'s hub link is told `on` and the note, every room change and nothing else, and `gone` when the target\'s last link goes', () => hub(async ({ r, tick, join, party }) => {
  const bran = await join('peer-bran', 'Bran');
  await party(bran, note('world:100,100'));
  tick(3000);
  const spy = await spectator(r, 'peer-spy', 'acct-peer-bran');
  assert.deepEqual(fol(spy).map((m) => m.k), ['on', 'note']);
  assert.equal(fol(spy, 'note')[0].ag, 3);
  assert.equal(fol(spy, 'note')[0].p.rk, 'world:100,100', 'the room, which a member never reads');
  assert.ok(validFollowOut(fol(spy, 'note')[0]));
  await party(bran, note('world:100,100', { h: 3 })); tick();
  assert.equal(fol(spy, 'note').length, 1, 'the same room: nothing said');
  await party(bran, note('dungeon:m1234', { in: 1 })); tick();
  assert.equal(fol(spy, 'note').length, 2, 'a door: said at once');
  assert.equal(fol(spy, 'note')[1].p.rk, 'dungeon:m1234');
  assert.equal(fol(spy, 'note')[1].ag, 0);
  // nobody else hears a follow's words
  const other = await join('peer-other', 'Other');
  await party(bran, note('world:5,5')); tick();
  assert.equal(fol(other).length, 0);
  // the target goes: `gone`
  await r.drop(bran);
  assert.deepEqual(fol(spy).at(-1), { t: 'fol', k: 'gone', sub: 'acct-peer-bran' });
  // a spectator of an account offline is told `gone` at once; a player's own token is never a follow
  const late = await spectator(r, 'peer-spy-2', 'acct-peer-bran');
  assert.deepEqual(fol(late).map((m) => m.k), ['on', 'gone']);
  const plain = await join('peer-plain', 'Plain');
  assert.equal(fol(plain).length, 0);
  // the spectator gone: no longer told
  await r.drop(spy); await r.drop(late);
  assert.equal(r.room._follows?.has('acct-peer-bran') ?? false, false);
}));

test('STAFF-PANEL5-FOLLOW relay: a follow is bounded - FOLLOWERS_MAX to an account and FOLLOWED_MAX accounts', async () => {
  const sent = [];
  const sockets = new Map();
  const fake = { _attach: (ws) => sockets.get(ws), _bySub: () => new Map(), _send: (ws, s) => { sent.push([ws, JSON.parse(s)]); return true; }, _dead: new Set(), _gone: new Set() };
  const hello = (fo) => { const ws = { n: sockets.size }; sockets.set(ws, { key: SOCIAL_ROOM, fo, id: `s${sockets.size}`, sub: `hd-${sockets.size}x` }); followHello(fake, ws, 0); return ws; };
  for (let i = 0; i < FOLLOWERS_MAX; i++) hello('acct-bran');
  const extra = hello('acct-bran');
  assert.equal(fake._follows.get('acct-bran').size, FOLLOWERS_MAX);
  assert.equal(sent.some(([ws]) => ws === extra), false, 'past the cap: never told `on`, so its game follows nobody');
  for (let i = 1; i < FOLLOWED_MAX; i++) hello(`acct-t${i}xx`);
  assert.equal(fake._follows.size, FOLLOWED_MAX);
  const over = hello('acct-one-more');
  assert.equal(fake._follows.has('acct-one-more'), false);
  assert.equal(sent.some(([ws]) => ws === over), false);
  // a follower no longer standing is let go and its place freed
  const [first] = fake._follows.get('acct-bran');
  fake._gone.add(first);
  const next = hello('acct-bran');
  assert.ok(fake._follows.get('acct-bran').has(next));
  assert.equal(fake._follows.get('acct-bran').has(first), false);
  // only on the hub: a room's spectator is counted, never held as a follower
  const room = { ...fake, _follows: undefined };
  sockets.set('cellws', { key: 'world:1,1', fo: 'acct-bran', id: 'x', sub: 'hd-x' });
  followHello(room, 'cellws', 0);
  assert.equal(room._follows, undefined);
});

/** A world of rooms (the Worker's ROOMS over fake objects): the bus and a cell, every internal call counted. */
async function world(fn) {
  let now = 1e12;
  const realNow = Date.now; Date.now = () => now;
  const rooms = fakeRooms({ now: () => now });
  const says = [];
  const get = rooms.ROOMS.get;
  rooms.ROOMS.get = (id) => { const stub = get(id); return { fetch: async (req) => { if (new URL(req.url).pathname === FOLLOW_INTERNAL_SAY) says.push([id, JSON.parse(await req.clone().text())]); return stub.fetch(req); } }; };
  const bus = rooms.room(SOCIAL_ROOM), cell = rooms.room('world:100,100');
  const tick = (ms = 1000) => { now += ms; };
  const at = { x: 100 * 32768 + 50, y: 0, z: (499 - 100) * 32768 + 50, yaw: 0, pitch: 0 };
  const player = async (r, id, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, r === bus ? null : at, { name: id, tokenSub: `acct-${id}`, ...(r === bus ? { acct: `acct-${id}`, asecret: `secret-${id}` } : {}), ...extra }); tick(); return ws; };
  try { await fn({ bus, cell, says, tick, player, at, now: () => now }); } finally { Date.now = realNow; }
}

test('STAFF-PANEL5-FOLLOW relay: a room tells the bus a followed account came and went, only while a spectator following it stands there - and nothing for anyone else', () => world(async ({ bus, cell, says, player, at }) => {
  const busSpy = await spectator(bus, 'peer-spy', 'acct-bran');
  assert.deepEqual(fol(busSpy).map((m) => m.k), ['on', 'gone']);
  // nobody follows anyone in the cell yet: a player coming and going costs the bus nothing
  const walker = await player(cell, 'walker');
  await cell.drop(walker); await flush();
  assert.equal(says.length, 0);
  // the spectator's room link in the cell; the target walks in, then out
  const cellSpy = await spectator(cell, 'peer-spy', 'acct-bran', { pose: at });
  assert.equal(cell.room._fol.get('acct-bran'), 1);
  const bran = await player(cell, 'bran');
  await flush();
  assert.deepEqual(says.map(([, b]) => b), [{ sub: 'acct-bran', k: 'in', room: 'world:100,100' }]);
  assert.deepEqual(fol(busSpy).at(-1), { t: 'fol', k: 'in', sub: 'acct-bran', room: 'world:100,100' });
  // a second tab of the target's says nothing more; its last socket going says `out`
  const stranger = await player(cell, 'stranger');
  await flush();
  assert.equal(says.length, 1, 'nobody follows the stranger');
  await cell.drop(bran); await flush();
  assert.deepEqual(says.at(-1)[1], { sub: 'acct-bran', k: 'out', room: 'world:100,100' });
  assert.deepEqual(fol(busSpy).at(-1), { t: 'fol', k: 'out', sub: 'acct-bran', room: 'world:100,100' });
  await cell.drop(stranger); await flush();
  assert.equal(says.length, 2);
  // the spectator gone from the cell: the room forgets the account, and says nothing of it after
  await cell.drop(cellSpy);
  assert.equal(cell.room._fol.has('acct-bran'), false);
  const back = await player(cell, 'bran');
  await flush();
  assert.equal(says.length, 2);
  // a spectator arriving where the target already stands says it at once
  const spy2 = await spectator(cell, 'peer-spy-2', 'acct-bran', { pose: at });
  await flush();
  assert.deepEqual(says.at(-1)[1], { sub: 'acct-bran', k: 'in', room: 'world:100,100' });
  void back; void spy2;
}));

test('STAFF-PANEL5-FOLLOW relay: the bus\'s door takes a room\'s word only in its shape', () => world(async ({ bus }) => {
  const call = (body) => bus.room.fetch(new Request(`https://relay.internal${FOLLOW_INTERNAL_SAY}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  assert.equal((await call({ sub: 'x', k: 'in', room: 'world:1,1' })).status, 400);
  assert.equal((await call('not json')).status, 400);
  const ok = await call({ sub: 'acct-bran', k: 'in', room: 'world:1,1' });
  assert.deepEqual([ok.status, await ok.json()], [200, { ok: 1, told: 0 }]);
}));

test('STAFF-PANEL5-FOLLOW relay: SILENT TP - an Admin\'s or a Shadow Fang\'s /tp is answered from the where note and the target\'s game is sent nothing; a missing or unmatched note falls back to the capture, flagged; a Dungeon Master\'s is today\'s capture', () => hub(async ({ r, tick, join, party }) => {
  const send = (ws, m) => { tick(3000); return r.raw(ws, JSON.stringify({ t: 'stp', ...m })); };   // paced: the hub meters teleport frames
  const stp = (ws, k) => ws.sent.filter((m) => m.t === 'stp' && m.k === k);
  const dev = await join('peer-dev', 'Mac', ['dev']), fang = await join('peer-fang', 'Mob', ['shadowfang']), dm = await join('peer-dm', 'Dee', ['dm']);
  const bran = await join('peer-bran', 'Bran');
  await party(bran, note('dungeon:m1234', { in: 1 }));
  tick(1000);
  for (const [staff, nonce, ag] of [[dev, 'a1', 4], [fang, 'a2', 7]]) {
    await send(staff, { k: 'ask', name: 'Bran', nonce, nt: 1 });
    const res = stp(staff, 'result').at(-1);
    assert.deepEqual([res.via, res.id, res.name, res.acct, res.ag, res.note.rk], ['note', 'peer-bran', 'Bran', 'acct-peer-bran', ag, 'dungeon:m1234']);
    assert.ok(validStaffTeleportOut(res));
  }
  assert.equal(stp(bran, 'capture').length, 0, 'their game was sent nothing');
  // a Dungeon Master: today's capture, unflagged
  await send(dm, { k: 'ask', name: 'Bran', nonce: 'd1', nt: 1 });
  assert.equal(stp(bran, 'capture').length, 1);
  assert.equal(stp(dm, 'result').length, 0);
  await send(bran, { k: 'answer', ticket: stp(bran, 'capture').at(-1).ticket, dest: { kind: 'exterior', pixel: { x: 1, y: 2 }, pos: [1, 2, 3], yaw: 0, pitch: 0 } });
  assert.equal(stp(dm, 'result').at(-1).fb, undefined);
  assert.equal(stp(dm, 'result').at(-1).acct, 'acct-peer-bran');
  tick();
  // a build that does not read notes: today's capture
  await send(dev, { k: 'ask', name: 'Bran', nonce: 'a3' });
  assert.equal(stp(bran, 'capture').length, 2);
  await send(bran, { k: 'answer', ticket: stp(bran, 'capture').at(-1).ticket, dest: { kind: 'exterior', pixel: { x: 1, y: 2 }, pos: [1, 2, 3], yaw: 0, pitch: 0 } });
  assert.equal(stp(dev, 'result').at(-1).fb, undefined, 'an ask that reads no note is never flagged');
  tick();
  // the note did not match (`cap`): asked, and flagged
  await send(dev, { k: 'ask', id: 'peer-bran', nonce: 'a4', nt: 1, cap: 1 });
  assert.equal(stp(bran, 'capture').length, 3);
  await send(bran, { k: 'answer', ticket: stp(bran, 'capture').at(-1).ticket, dest: { kind: 'exterior', pixel: { x: 1, y: 2 }, pos: [1, 2, 3], yaw: 0, pitch: 0 } });
  assert.equal(stp(dev, 'result').at(-1).fb, 'mismatch');
  tick(NOTE_STALE_MS);
  // the note gone stale: missing, asked, flagged
  await send(dev, { k: 'ask', name: 'Bran', nonce: 'a5', nt: 1 });
  assert.equal(stp(bran, 'capture').length, 4, JSON.stringify(stp(dev, 'result').at(-1)));
  await send(bran, { k: 'answer', ticket: stp(bran, 'capture').at(-1).ticket, dest: { kind: 'exterior', pixel: { x: 1, y: 2 }, pos: [1, 2, 3], yaw: 0, pitch: 0 } });
  const res = stp(dev, 'result').at(-1);
  assert.equal(res.fb, 'missing', JSON.stringify(res));
  assert.ok(validStaffTeleportOut(res).fb === 'missing');
  // an ordinary player asking with `nt`: denied, as ever
  const normal = await join('peer-normal', 'Normal');
  await send(normal, { k: 'ask', name: 'Bran', nonce: 'x', nt: 1 });
  assert.equal(stp(normal, 'result').at(-1).error, 'denied');
}));

test('STAFF-PANEL5-FOLLOW bench: what the where note and the follow cost the bus, measured', () => hub(async ({ r, tick, join, party, now }) => {
  // the hub with ONLINE accounts on it, every one sending its note; then the same with a follow standing - the bus's own
  // party arm, end to end through webSocketMessage (the frame's parse, the meter, the attachment, the follow's look)
  const ONLINE = 400, NOTES = 4000;
  const links = [];
  for (let i = 0; i < ONLINE; i++) links.push(await join(`peer-n${i}`, `Walker${i}`));
  const time = async (n, fn) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) await fn(i); return Number(process.hrtime.bigint() - t0) / 1e6 / n; };
  // each note a moved one (a fresh pixel), so every follow's look runs in full
  const msNote = await time(NOTES, (i) => { if (i % ONLINE === 0) tick(1000); return party(links[i % ONLINE], note(`world:${i % 900},${(i / 900) | 0}`, { px: i % 900, py: (i / 900) | 0 })); });
  assert.equal(noteOf(r.room, `acct-peer-n${NOTES % ONLINE + 5}`, now())?.p.px, (NOTES - ONLINE + 5) % 900, 'every note was taken, none metered away');
  const spies = [];
  for (let i = 0; i < 16; i++) spies.push(await spectator(r, `peer-spy${i}`, `acct-peer-n${i}`));
  const msFollowed = await time(NOTES, (i) => { if (i % ONLINE === 0) tick(1000); return party(links[i % ONLINE], note(`world:${(i + 1) % 900},${(i / 900) | 0}`, { px: (i + 1) % 900, py: (i / 900) | 0 })); });
  assert.ok(fol(spies[3], 'note').length >= NOTES / ONLINE - 1, 'and each follow heard its target\'s every room');
  // a leave and a join where nobody follows: one look-up each (followLeft/followJoined on their own)
  const fake = { _follows: new Map(), _fol: new Map(), _bySub: () => new Map(), _attach: () => ({}), _dead: new Set(), _gone: new Set() };
  const msLeave = await time(100_000, () => followLeft(fake, {}, { id: 'x', sub: 'acct-nobody', key: 'world:1,1' }));
  const msJoin = await time(100_000, () => followJoined(fake, {}, { id: 'x', sub: 'acct-nobody', key: 'world:1,1' }));
  const read = await time(10_000, (i) => noteOf(r.room, `acct-peer-n${i % ONLINE}`, now()));
  // the scale: 10,000 online outside a party, each moving (a note every WHERE_NOTE_MOVING_MS) - 2,000 notes a second
  const perSecond = (10_000 / (WHERE_NOTE_MOVING_MS / 1000));
  const line = `bus bench (fake hub, this machine): a note ${msNote.toFixed(4)} ms (${msFollowed.toFixed(4)} ms with 16 follows standing); `
    + `2,000 notes/s (10,000 online, all moving) = ${(msNote * perSecond).toFixed(1)} ms of each second; `
    + `a staff read of a note ${read.toFixed(4)} ms; a room's leave/join where nobody follows ${(msLeave * 1000).toFixed(3)}/${(msJoin * 1000).toFixed(3)} us`;
  console.log(line);
  // loose bounds - the machine is shared; the numbers above are the measurement
  assert.ok(msNote < 5, line);
  assert.ok(msFollowed < msNote * 3 + 1, line);
  assert.ok(msLeave < 0.01 && msJoin < 0.01, line);
  void spies;
}));
