// STAFF-MAP (2026-10-24, mob: "were is the map too?", "also need the map done as well cant see players far") - THE REGION
// MAP OVER THE REAL RELAY (the harness of staffpanel5live_e2e.test.js): the game's map link (net/staffMap.js) on the
// game's own minter, in another region's channel, hands the panel that region's travellers' marks - and only on a hidden
// token: a game whose Hide me is off sends none, says `hide`, and no player in the region ever learns a staff link came.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, roomKeyFor } from '../../src/net/online.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM, PIXEL_UNITS, isSocialRoom } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { createStaffMap, tokenHidden, STAFF_MAP_SEND_MS } from '../../src/net/staffMap.js';
import { staffHookDoor } from '../../src/net/staffHook.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';
import { CHAT_REGION_PREFIX } from '../../src/net/wire.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const turn = () => new Promise((r) => setImmediate(r));

async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const W = fakeRooms({ now: () => clock });
  try {
    return await quiet(async () => {
      const service = {};
      const signer = roomSigner(service, () => clock);
      await signer.signer();
      const gate = Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', (await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey))).toString('base64');
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; r.env.GATE_SIGNING_KEY ??= gate; r.env.HIDDEN_SEEN_URL ??= 'https://accounts.test/v1/mod/hidden-seen'; r.env.ACCOUNTS ??= { fetch: async () => new Response('{}') }; return r; };
      const pending = [];
      const opened = [];
      class BridgeWS {
        constructor(url) {
          this.url = url;
          this.key = decodeURIComponent(/\/room\/([^?]+)/.exec(url)[1]);
          this.r = room(this.key);
          this.readyState = 0;
          opened.push(this.key);
          const rws = this.r.connect();
          const send = rws.send.bind(rws), close = rws.close.bind(rws);
          rws.send = (s) => { send(s); pending.push(() => { if (this.readyState === 1) this.onmessage?.({ data: s }); }); };
          this.rws = rws;
          pending.push(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen?.(); } });
        }
        send(s) { if (this.readyState !== 1) throw new Error('not open'); const { r, rws } = this; pending.push(() => r.room.webSocketMessage(rws, s)); }
        close(code = 1000, reason = '') {
          if (this.readyState === 3) return;
          this.readyState = 3;
          const { r, rws } = this;
          pending.push(async () => { const i = r.sockets.indexOf(rws); if (i >= 0) { r.sockets.splice(i, 1); await r.room.webSocketClose(rws, code, reason); } });
        }
      }
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          while (pending.length) await pending.shift()();
          await turn();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const Session = class extends OnlineSession { constructor(o) { super({ wave: reconnectWave({ online: () => true }), ...o, now: () => clock }); } };
      try {
        return await fn({ W, service, signer, BridgeWS, Session, settle, opened, tick: (ms) => { clock += ms; }, now: () => clock });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}


const mark = (px, py, m = 0) => ({ px, py, fx: 128, fy: 64, h: 0, m, tv: 0 });

for (const hidden of [true, false]) test(`STAFF-MAP: the map's link in another region's channel ${hidden ? 'hands the panel its travellers, live, and nobody there sees it' : 'stays out while Hide me is off, and says so'}`, async () => {
  await world(async ({ signer, BridgeWS, Session, settle, tick }) => {
    const region = 17;
    const room = `${CHAT_REGION_PREFIX}${region}`;
    const mk = (id, sub, name) => new Session({ url: 'wss://relay.test', name, id, secret: `secret-of-${id}`, presence: false, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token(id, { s: sub, n: name, k: 'linked' }) });
    const a = mk('pla-0001', 'acct-a-0001', 'Alpha'), b = mk('plb-0002', 'acct-b-0002', 'Beta');
    const roster = [];
    for (const s of [a, b]) s.onJoin = (p) => roster.push(p?.name ?? p?.id);
    // the staff member's game: its presence session's relay and minter - hidden (Hide me on) or the account's own
    let n = 0;
    const minter = async () => signer.token(`stf-${String(++n).padStart(4, '0')}`, hidden ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: 'acct-staff-0001', n: 'Mob', k: 'linked' });
    const said = [];
    const map = createStaffMap({ main: () => ({ url: 'wss://relay.test', mintToken: minter }), post: (m) => said.push(m), Session, WS: BridgeWS, now: () => Date.now() });
    const step = async (k = 1) => { for (let i = 0; i < k; i++) { for (const s of [a, b]) s.tick(); map.tick(); await settle(); tick(250); } };
    a.join(room); b.join(room); await step(4);
    a.sendTraveller(mark(300, 200)); tick(11_000); b.sendTraveller(mark(310, 205, 1)); await step(4);
    map.pick(region); await step(12);
    const last = () => said.at(-1);
    assert.equal(last()?.region, region);
    assert.equal(last()?.name, REGION_NAMES[region]);
    if (!hidden) {
      assert.equal(last().state, 'hide', 'the panel is told Hide me is off');
      assert.deepEqual(last().list, []);
      assert.equal(n >= 1, true, 'the minter was asked');
      return;
    }
    assert.equal(last().state, 'open');
    assert.deepEqual(last().list.map((r) => [r.name, r.sub, r.px, r.py, r.way]).sort(), [['Alpha', 'acct-a-0001', 300.5, 200.25, 'foot'], ['Beta', 'acct-b-0002', 310.5, 205.25, 'horse']]);
    tick(11_000); a.sendTraveller(mark(301, 200)); await step(8);
    assert.equal(last().list.find((r) => r.name === 'Alpha')?.px, 301.5, 'a live mark lands');
    const before = said.length;
    await step(2);
    assert.ok(said.length - before <= 1, `at most one answer a STAFF_MAP_SEND_MS (${STAFF_MAP_SEND_MS} ms) while nothing moves`);
    assert.ok(![...a.peers.values(), ...b.peers.values()].some((p) => /Staff|Spectator/.test(p.name ?? '')), 'nobody in the region sees the staff link');
    map.pick(null); await step(2);
    assert.equal(said.at(-1).region, region, 'stopping says nothing more');
  });
});

test('STAFF-MAP: a token\'s hidden mark is read off its body - anything else is not hidden', async () => {
  const body = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(tokenHidden(`v1.${body({ s: 'x', hd: 1 })}.sig`), true);
  assert.equal(tokenHidden(`v1.${body({ s: 'x' })}.sig`), false);
  assert.equal(tokenHidden(`v1.${body({ s: 'x', hd: '1' })}.sig`), false);
  for (const t of [null, '', 'garbage', 'v1.%%%.x', 42]) assert.equal(tokenHidden(t), false);
});

test('STAFF-MAP: the panel\'s door - `regions?` answers the politic map\'s names, `map?` picks a region or stops, from this window alone', () => {
  const posted = [];
  const listeners = [];
  const win = { location: { origin: 'https://daggerfalljs.dev' }, postMessage: (m) => posted.push(m), addEventListener: (_t, f) => listeners.push(f) };
  const picks = [];
  const map = { pick: (r) => picks.push(r), regions: () => ['A', 'B'] };
  staffHookDoor(win, () => null, { mapOf: () => map });
  const send = (data, source = win, origin = 'https://daggerfalljs.dev') => { for (const f of listeners) f({ data, source, origin }); };
  send({ dfoStaff: 'regions?' });
  assert.deepEqual(posted.at(-1), { dfoStaff: 'regions', names: ['A', 'B'] });
  send({ dfoStaff: 'map?', region: 5 });
  send({ dfoStaff: 'map?', region: null });
  send({ dfoStaff: 'map?', region: 9 }, {}, 'https://daggerfalljs.dev');
  send({ dfoStaff: 'map?', region: 9 }, win, 'https://evil.example');
  assert.deepEqual(picks, [5, null]);
});
