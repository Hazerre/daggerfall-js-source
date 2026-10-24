// HIDDEN-UNCOUNTED (2026-10-24, Mac: "Invisible players dont count towards the online count") - A HIDDEN STAFF MEMBER IS
// IN NO ONE'S COUNT, THEIR OWN INCLUDED. The relay already leaves a hidden socket out of every roster and count
// (server/src/staffHidden.js, NAMED BY NOBODY - test/net/staffpanel5hidden_relay.test.js pins it), so every other game's
// "Online - N" left them out; the hidden game's own list still drew its own row and counted it, one higher than everyone
// else's. Over the real relay (the harness of staffmap_e2e.test.js): the session notes its hello's hidden mark
// (net/online.js `hidden`) and the roster leaves its own row out (net/roster.js rosterRows), in every tab's source.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, tokenHidden } from '../../src/net/online.js';
import { tokenHidden as mapTokenHidden } from '../../src/net/staffMap.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { rosterRows, rosterTitle, partyRosterSource, guildRosterSource, localRosterSource, placedRosterSource } from '../../src/net/roster.js';

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
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; r.env.ACCOUNTS ??= { fetch: async () => new Response('{}') }; return r; };
      const pending = [];
      class BridgeWS {
        constructor(url) {
          this.url = url;
          this.key = decodeURIComponent(/\/room\/([^?]+)/.exec(url)[1]);
          this.r = room(this.key);
          this.readyState = 0;
          const rws = this.r.connect();
          const send = rws.send.bind(rws);
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
        return await fn({ signer, BridgeWS, Session, settle, tick: (ms) => { clock += ms; } });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}

for (const hidden of [true, false]) test(`HIDDEN-UNCOUNTED: a staff game's World tab ${hidden ? 'on a hidden token reads the count every player reads - no row of its own, nobody counting it' : 'with Hide me off is a player: its own row, and in everyone\'s count'} (mutants: the own row pushed while hidden; the hello's mark unread)`, async () => {
  await world(async ({ signer, BridgeWS, Session, settle, tick }) => {
    const mk = (id, claims) => new Session({ url: 'wss://relay.test', name: claims.n, id, secret: `secret-of-${id}`, presence: false, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token(id, claims) });
    const a = mk('pla-0001', { s: 'acct-a-0001', n: 'Alpha', k: 'linked' });
    const b = mk('plb-0002', { s: 'acct-b-0002', n: 'Beta', k: 'linked' });
    const staff = mk('stf-0003', hidden ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: 'acct-staff-0003', n: 'Mob', k: 'linked' });
    const all = [a, b, staff];
    // the World tab draws: each link asks the hub who is on its other shards while the tab is open (world.js chatRosterOf)
    const until = async (ok) => { for (let i = 0; i < 200 && !ok(); i++) { for (const s of all) { s.tick(); s.sendHubWho(); } await settle(); tick(250); } };
    const want = hidden ? 2 : 3;
    a.join(SOCIAL_ROOM); b.join(SOCIAL_ROOM); staff.join(SOCIAL_ROOM);
    await until(() => all.every((s) => s.welcomed && rosterRows(s).total === want));
    assert.ok(new Set(all.map((s) => s.room)).size > 1, 'the links stand on more than one shard - the hub\'s count and its other shards\' players read');
    assert.equal(staff.hidden, hidden, 'the session notes its hello\'s mark');
    assert.equal(a.hidden, false);
    for (const s of all) assert.equal(rosterRows(s).total, want, `${s.name}: ${rosterTitle(rosterRows(s).total)}`);
    const own = rosterRows(staff).rows.filter((r) => r.me);
    assert.deepEqual(own.map((r) => r.id), hidden ? [] : ['stf-0003'], hidden ? 'no row of its own' : 'its own row, marked');
    assert.deepEqual(rosterRows(staff).rows.map((r) => r.name).filter((n) => n !== 'Mob'), ['Alpha', 'Beta'], 'and everyone it can see');
    assert.equal(rosterRows(a).rows.some((r) => r.id === 'stf-0003'), !hidden, hidden ? 'nobody lists it' : 'everybody lists it');
  });
});

test('HIDDEN-UNCOUNTED: every tab\'s source carries the link\'s hidden mark - Party, Guild, Nearby and a placed tab list no row of mine while it is set, and mine while it is not; a placed tab keeps the link\'s roster, count and the hub\'s other shards under the place\'s name (mutants: a source drops `hidden`; the placed source drops a field)', () => {
  const peers = new Map([['plx-0001', { id: 'plx-0001', name: 'Xan', gt: 'WOLF' }], ['ply-0002', { id: 'ply-0002', name: 'Yorn' }]]);
  const hubOnline = new Map([['plz-0003', { id: 'plz-0003', name: 'Zed' }]]);
  for (const hidden of [true, false]) {
    const link = { id: 'stf-0009', name: 'Staff member', title: null, glyphs: ['mod'], gt: null, hidden, peers, roomCount: 900, hubOnline };
    const party = { members: [{ acct: 'acct-x', name: 'Xan', peers: ['plx-0001'] }] };
    const sources = { party: partyRosterSource(party, link, 'acct-me'), guild: guildRosterSource(link, 'WOLF'), local: localRosterSource(link, [{ id: 'ply-0002', feet: [0, 0, 0] }], [0, 0, 0]), placed: placedRosterSource(link, 'Wayrest') };
    for (const [tab, src] of Object.entries(sources)) {
      assert.equal(src.hidden, hidden, `${tab}: the mark carried`);
      assert.equal(rosterRows(src).rows.some((r) => r.me), !hidden, `${tab}: ${hidden ? 'no row of mine' : 'my row'}`);
    }
    const p = sources.placed;
    assert.deepEqual([p.id, p.name, p.glyphs, p.peers, p.roomCount, p.hubOnline, p.label], [link.id, link.name, link.glyphs, peers, 900, hubOnline, 'Wayrest']);
    assert.equal(rosterRows(p).total, 900, 'the relay\'s count, as the link\'s own');
  }
  assert.equal(placedRosterSource({ id: 'p1', name: 'P' }, 'Daggerfall').hidden, false, 'a link with no mark is shown');
});

test('HIDDEN-UNCOUNTED: the token\'s mark is one function - net/online.js reads it, net/staffMap.js hands the same one on', () => {
  assert.equal(mapTokenHidden, tokenHidden);
  const body = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(tokenHidden(`v1.${body({ s: 'x', hd: 1 })}.sig`), true);
  assert.equal(tokenHidden(`v1.${body({ s: 'x' })}.sig`), false);
  assert.equal(tokenHidden(null), false);
});
