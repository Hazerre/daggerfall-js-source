// STAFF-PANEL2-FIX (2026-10-22; design doc "DFO Staff Panel: design", Weak spots: "Cutting off a staff member misses most
// doors" - "the cut also ends the person's game sessions and pushes a relay order that strips their staff glyphs"): THE
// STAFF CUT'S ORDER AT THE RELAY. The service's door (SAFE_LAW_PATH) hands the hub a signed `{o:'staffcut', s, i, e}`
// (net/identityToken.js mintStaffCutOrder, server-account/src/staff.js /v1/staff/cut), and the hub closes each of the
// account's sockets whose token was minted before it - CLOSE_POLICY 'staff-cut' - so the staff glyphs that token carried
// leave with it (server/src/index.js `_staffCut`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { CHAT_WORLD_ROOM, SAFE_LAW_PATH, CLOSE_POLICY } from '../../../src/net/wire.js';
import { mintStaffCutOrder, mintToken, orderValid, ORDER_TTL_S } from '../../../src/net/identityToken.js';

const subtle = globalThis.crypto.subtle;
const CUT = { code: CLOSE_POLICY, reason: 'staff-cut' };

test('STAFF-PANEL2-FIX: A STAFF CUT AT THE SERVICE\'S DOOR closes the account\'s socket whose token it postdates - CLOSE_POLICY \'staff-cut\', the room told its leave - and leaves a stranger and a socket on a newer token alone (mutants: the order refused at the door; the hub\'s kinds; the close; the newer token closed)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const kp = await hub.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const tok = (n, at) => mintToken({ s: 'acct-cutt-0001', n, k: 'linked', g: ['dev'] }, kp.privateKey, { subtle, nowS: at });
  const staffer = hub.connect(); await hub.hello(staffer, 'cutt-0001', null, { tok: await tok('cutt-0001', nowS - 5) });
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const post = (order) => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env);
  const cut = await mintStaffCutOrder({ s: 'acct-cutt-0001' }, kp.privateKey, { subtle, nowS });
  const said = await post(cut);
  assert.equal(said.status, 200);
  assert.deepEqual(await said.json(), { ok: true });
  assert.deepEqual(staffer.closed, CUT);
  assert.equal(bob.closed, null, 'a stranger stays');
  assert.deepEqual(bob.sent.filter((m) => m.t === 'leave').map((l) => l.id), ['cutt-0001'], 'and the room said its leave');
  assert.ok(!staffer.sent.some((m) => m.t === 'banned' || m.t === 'law'), 'no ban said, nothing handed to carry');
  // a socket on a token minted after the cut - the service's word as it stands now - is let be
  const fresh = hub.connect(); await hub.hello(fresh, 'cutt-0021', null, { tok: await tok('cutt-0021', nowS + 2) });
  const cut2 = await mintStaffCutOrder({ s: 'acct-cutt-0001' }, kp.privateKey, { subtle, nowS: nowS + 1 });
  assert.equal((await post(cut2)).status, 200);
  assert.equal(fresh.closed, null);
});

test('STAFF-PANEL2-FIX: A STAFF CUT IS THE SERVICE\'S ALONE - forged it is refused at the door, and carried in by a game socket it is taken as nothing; its claims carry no other kind\'s fields (mutants: the carried frame\'s kinds; orderValid\'s staffcut line)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const kp = await hub.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const target = hub.connect(); await hub.hello(target, 'cutt-0002');
  const carrier = hub.connect(); await hub.hello(carrier, 'carr-0001', null, { kind: 'linked' });
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const forged = await mintStaffCutOrder({ s: 'acct-cutt-0002' }, stranger.privateKey, { subtle, nowS });
  const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: forged }) }), env);
  assert.equal(res.status, 403);
  const real = await mintStaffCutOrder({ s: 'acct-cutt-0002' }, kp.privateKey, { subtle, nowS });
  await hub.room.webSocketMessage(carrier, JSON.stringify({ t: 'ban', order: real }));
  assert.equal(target.closed, null, 'a game socket carries no cut');
  assert.equal(carrier.closed, null);
  // the shape
  const c = { o: 'staffcut', s: 'acct-cutt-0002', i: nowS, e: nowS + ORDER_TTL_S };
  assert.equal(orderValid(c), true);
  for (const extra of [{ mu: nowS + 60 }, { bn: nowS + 60 }, { lv: 3 }, { gi: 'g0000001', gt: 'TAG', gm: 'M' }]) assert.equal(orderValid({ ...c, ...extra }), false, JSON.stringify(extra));
});
