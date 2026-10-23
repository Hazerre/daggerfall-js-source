// STAFF-PANEL5-FOLLOW LIVE (2026-10-23, mob: "follow does not work", "tried didnt follow player at all") - THE WHOLE FOLLOW
// OVER THE REAL RELAY: a target's real OnlineSession (its cell and its hub link, which hops to its shard and sends where
// notes) and the real createStaffHook (its hub link and its eye), every socket a bridge to a real Room (test/fakeRoom.mjs),
// the hub's sixteen shards and their bus driven to rest between frames, follow tokens shaped as the account service mints
// them (server-account/src/staffFollow.js). No step stubbed between the panel's pick and the camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, roomKeyFor } from '../../src/net/online.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM, PIXEL_UNITS, isSocialRoom } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { createStaffHook } from '../../src/net/staffHook.js';
import { mintToken } from '../../src/net/identityToken.js';

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
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; return r; };
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
          rws.close = (code, reason) => { close(code, reason); pending.push(() => { if (this.readyState !== 3) { this.readyState = 3; this.onclose?.({ code, reason }); } }); };
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
        return await fn({ W, signer, BridgeWS, Session, settle, opened, tick: (ms) => { clock += ms; }, now: () => clock });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}

const TARGET = 'acct-target-0001';
const at = (px, py) => ({ x: (px + 0.5) * PIXEL_UNITS, y: 0, z: (499 - py + 0.5) * PIXEL_UNITS, yaw: 0.5, pitch: 0, mv: 1 });

test('STAFF-PANEL5-FOLLOW LIVE: a staff pick follows a solo player over the real relay and its hub shards - the hook\'s hub link is told `on`, hears the note, its eye joins the target\'s cell and the camera has their pose', async () => {
  await world(async ({ W, signer, BridgeWS, Session, settle, opened, tick, now }) => {
    // the target: a cell link and a hub link, on their account, as the game holds them
    const tmint = async () => signer.token('tgt-0001', { s: TARGET, n: 'Target', k: 'linked' });
    const main = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', WebSocketImpl: BridgeWS, mintToken: tmint });
    const thub = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', acct: TARGET, asecret: 'secret-of-acct-target', presence: false, WebSocketImpl: BridgeWS, mintToken: tmint });
    thub.solo = true;
    const pose = at(100, 100);
    const cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 100, y: 100 } });
    const note = () => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk: main.room ?? cell });
    // the staff member's game: the follow tokens the account service mints (hd 1, fo the target), one a room asked
    const asked = [];
    let n = 0;
    const kp = await signer.signer();
    // as server-account/src/staffFollow.js mints it (the harness's roomSigner signs no `fo`), each its own issued-at
    const askToken = async (sub, r) => { asked.push(r); n++; return mintToken({ s: 'hd-0123456789abcdef01234567', n: 'Spectator', k: 'guest', hd: 1, fo: sub }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(now() / 1000) - n }); };
    const links = [];
    const Spy = class extends Session { constructor(o) { super(o); links.push(this); } };
    const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken, Session: Spy, WS: BridgeWS });
    const frame = async () => {
      if (main.room !== cell) main.join(cell, { ...pose }); else main.sendPose({ ...pose });
      if (!isSocialRoom(thub.room)) thub.join(SOCIAL_ROOM);
      thub.sendParty(note());
      main.tick(); thub.tick();
      hook.tick();
      await settle();
      tick(100);
    };
    for (let i = 0; i < 20; i++) await frame();
    assert.ok(H.isHubShard(thub.room), `the target's hub link sits on its shard (${thub.room})`);
    assert.ok(main.followOk, 'the relay says follow at its welcome');
    hook.follow(TARGET);
    const trace = [];
    for (let i = 0; i < 80; i++) { await frame(); trace.push(`${i}:${hook.locked() ? 'L' : '-'}:${hook.room() ?? '?'}:${hook.view() ? 'V' : '-'}`); }
    // what went wrong, said in every message: the bus's follows, the hook's links, the tokens it asked and the last frames
    const bus = W.made.get(SOCIAL_ROOM).room;
    const info = `follows [${[...(bus._follows?.keys() ?? [])]}]; links ${links.map((l) => `${l.room}${l.welcomed ? '+' : '-'}`).join(' ')}; asked ${asked.length} tokens (${[...new Set(asked)].join(', ')}); sockets opened ${opened.length}; trace ${trace.slice(-5).join(' ')}`;
    assert.ok(asked.length <= 6, `the hook asks a token a room, not one a frame: ${info}`);
    assert.equal(hook.locked(), true, `the hub said on: ${info}`);
    assert.equal(hook.room(), cell, `the note named their cell: ${info}`);
    assert.ok(hook.view(), `the camera has their pose: ${info}`);
    assert.equal(hook.view().x, pose.x);
  });
});
