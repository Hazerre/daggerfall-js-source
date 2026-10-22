// AUDIT SEA VENTURES (2026-10-22, the owner: "Audit this and ensure perfection") - six cold lanes read SEA VENTURES at
// 886f2b4a6 (the relay and the wire, the account service, the open zone at sea, the ventures' law, the page's sea, the
// record's honesty): bible/01-Overview/audits/Audit-Sea-Ventures.md. Each finding fixed is pinned here by its id, the
// failure it was driven through made to fail again - tools/mutants/auditsea.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeaBounty, SEA_BOARD_FRESH_MS, SEA_BOARD_RETRY_MS, boardRetryMs } from '../../../src/scenes/seaBountyHost.js';
import { createSeaSeason, SEA_SEASON_FRESH_MS, SEA_SEASON_RETRY_MS } from '../../../src/scenes/seaSeasonHost.js';
import { wantedText, seasonText } from '../../../src/ui/naval/navalYardWindow.js';
import * as P from '../../../src/net/sea/seaPrizeLaw.js';
import { tradeableRecord } from '../../../src/net/realm/realmTradeLaw.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seeded } from '../../honestItems.mjs';
import { mintDeed, mintParts } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { BAG_TEMPLATE } from '../../../src/net/bagLaw.js';
import { setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { mintSeaWreck, SEA_WRECK_GRACE_S } from '../../../src/net/wild/wildReceipt.js';
import { createSeaWreckHost, SEA_WRECK_SLACK_S, SEA_WRECK_RETRY_MS, SEA_WRECK_CAPTAIN_RETRY_MS, SEA_WRECK_TRANSIENT, SEA_WRECK_KEPT_KEY } from '../../../src/scenes/seaWreckHost.js';
import { seaWreck } from '../../../server-account/src/seaWreck.js';
import { gatePublicKey } from '../../../server-account/src/signing.js';
import { shutSeaHold, openSeaHold, seaHoldShut, SEA_HOLD_SHUT_MS, SEA_HOLD_SHUT_KEY } from '../../../src/systems/naval/seaHoldGuard.js';
import { createHoldDoor } from '../../../src/scenes/holdDoor.js';
import { createNavalPvp } from '../../../src/scenes/naval/navalPvp.js';
import { createShipDamage } from '../../../src/systems/naval/navalDamage.js';
import { appStorage } from '../../../src/systems/appStorage.js';
import { readFileSync } from 'node:fs';
import { SEA_REFUND_AFTER_S, SEA_ENDED_KEEP_S, seaSweeps } from '../../../server-account/src/seaBounty.js';
import { SEA_WANTED_DAYS } from '../../../src/net/sea/seaBountyLaw.js';
import { seaSeasonFigures, seaSeasonStartS, seaLegendsPossible, SEA_WORLD_DAY_S, SEA_SEASON_VENDOR } from '../../../src/net/sea/seaSeasonLaw.js';
import { worldRoom } from '../../../src/net/wire.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm, recordOf } from '../../realmSeat.mjs';

const { subtle } = globalThis.crypto;
const RC = 'r00000000000000000a01', RK = 'r00000000000000000a02';
const SEA_CELL = worldRoom(7800, -5000);
const sword = (m, extra = {}) => ({ ...createWeapon(120, m, seeded(9)), ...extra });
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
/** A realm session whose acts run at once over `seq`. */
const sessionAt = (seq = 3) => ({ transact: (fn) => fn({ id: RC, lease: 'lease', seq }) });

test('AUDIT SEA VENTURES E1: a board read the service refused is asked again SEA_BOARD_RETRY_MS on, doubling to the fresh wait - never at once from the paint that ends it, never a page frozen in reads; a good read waits SEA_BOARD_FRESH_MS (mutants: the backoff, the failure\'s wait, the fresh wait)', async () => {
  assert.deepEqual([SEA_BOARD_RETRY_MS, SEA_BOARD_FRESH_MS, SEA_SEASON_RETRY_MS, SEA_SEASON_FRESH_MS], [5_000, 30_000, 5_000, 60_000]);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(boardRetryMs), [5_000, 10_000, 20_000, 30_000, 30_000, 30_000]);
  let now = 1_000_000, asked = 0, answer = { ok: false, error: 'rate' };
  const door = { board: async () => { asked++; return answer; } };
  const b = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet: () => null, character: () => RC, region: () => 19, door, now: () => now });
  for (let i = 0; i < 200; i++) { b.office(); await settle(); }   // every paint asks for the section, as the window does
  assert.equal(asked, 1, 'one refused read - and none again from the paints after it');
  assert.equal(b.office().line?.warn, true, 'its refusal said');
  now += SEA_BOARD_RETRY_MS - 1; b.office(); await settle();
  assert.equal(asked, 1);
  now += 1; b.office(); await settle();
  assert.equal(asked, 2, 'asked again its wait on');
  now += SEA_BOARD_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 2, 'the wait doubled');
  now += SEA_BOARD_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 3);
  answer = { ok: true, data: { wanted: [], owed: 0, mine: 0 } };
  now += 4 * SEA_BOARD_RETRY_MS; b.office(); await settle();
  assert.equal(asked, 4);
  assert.equal(b.office().line, null, 'a good read takes the refusal away');
  now += SEA_BOARD_FRESH_MS - 1; b.office(); await settle();
  assert.equal(asked, 4);
  now += 1; b.office(); await settle();
  assert.equal(asked, 5, 'fresh again SEA_BOARD_FRESH_MS on');
  // a door that throws is a refusal too, and waits as one
  let thrown = 0;
  const t2 = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet: () => null, character: () => RC, region: () => 19, door: { board: async () => { thrown++; throw new Error('gone'); } }, now: () => now });
  for (let i = 0; i < 50; i++) { t2.office(); await settle(); }
  assert.equal(thrown, 1, 'a throw waits too');
  // the season's boards, the same
  let seasonAsked = 0;
  const s = createSeaSeason({ live: () => true, session: sessionAt(), character: () => RC, door: { board: async () => { seasonAsked++; return { ok: false, error: 'server' }; } }, now: () => now });
  for (let i = 0; i < 200; i++) { s.office(); await settle(); }
  assert.equal(seasonAsked, 1);
  now += SEA_SEASON_RETRY_MS; s.office(); await settle();
  assert.equal(seasonAsked, 2);
  now += SEA_SEASON_RETRY_MS; s.office(); await settle();
  assert.equal(seasonAsked, 2, 'the season\'s wait doubles too');
});

test('AUDIT SEA VENTURES E7: a post that landed is said as landed though the read after it is refused; a later good read takes a refusal away; boards never read are still asked for, never an empty season; a post the purse and the bank cannot pay is greyed and never asked (mutants: the two lines, the asking, the purse)', async () => {
  let now = 1_000_000, purse = 5_000, reads = 0, posts = 0;
  const door = {
    board: async () => (++reads === 2 ? { ok: false, error: 'offline' } : { ok: true, data: { wanted: [{ char: 'r00000000000000000a02', name: 'kim', kills: 1, bounty: 500 }], owed: 0, mine: 0 } }),
    post: async ({ gold }) => { posts++; return { ok: true, data: { ok: true, gold, bounty: 500 + gold, realm: { seq: 4 } } }; },
  };
  const wallet = () => ({ gold: () => purse, pay: (n) => { purse -= n; return () => { purse += n; }; } });
  const b = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet, character: () => RC, region: () => 19, door, now: () => now });
  b.office(); await settle();
  b.office().post({ char: 'r00000000000000000a02', name: 'kim' }, 2_000); await settle();
  assert.equal(posts, 1);
  assert.equal(reads, 2, 'the read after the post was refused');
  assert.deepEqual(b.office().line, { text: 'You post 2,000 gold on kim\'s head. The bounty stands at 2,500 gold.', warn: false }, 'the post is said as landed');
  // the season's boards never read: asking, never an empty season
  const s = createSeaSeason({ live: () => true, session: sessionAt(), character: () => RC, door: { board: async () => ({ ok: false, error: 'offline' }) }, now: () => now });
  s.office(); await settle();
  const so = s.office();
  assert.equal(so.asking, true);
  assert.deepEqual(seasonText(so).lists, [], 'no lists - "no captain has sailed this season" is never said of boards unread');
  assert.equal(so.line?.warn, true);
  // the purse: a post past it greyed, and refused unasked
  purse = 300;
  const w = wantedText(b.office());
  assert.deepEqual(w.rows[0].presses.map((p) => [p.n, p.can]), [[500, false], [2_000, false], [10_000, false]]);
  purse = 2_000;
  assert.deepEqual(wantedText(b.office()).rows[0].presses.map((p) => [p.n, p.can]), [[500, true], [2_000, true], [10_000, false]]);
  b.office().post({ char: 'r00000000000000000a02', name: 'kim' }, 10_000); await settle();
  assert.equal(posts, 1, 'never asked');
  assert.equal(purse, 2_000, 'nothing held out');
  assert.deepEqual(b.office().line, { text: 'You do not have 10,000 gold to post.', warn: true });
  // a refusal stands only until a good read
  reads = 0;
  const r2 = createSeaBounty({ live: () => true, session: sessionAt(), checkpoint: () => {}, wallet, character: () => RC, region: () => 19, door: { board: async () => (++reads === 1 ? { ok: false, error: 'rate' } : { ok: true, data: { wanted: [], owed: 0, mine: 0 } }) }, now: () => now });
  r2.office(); await settle();
  assert.equal(r2.office().line?.warn, true);
  now += SEA_BOARD_RETRY_MS; r2.office(); await settle();
  assert.equal(r2.office().line, null);
});

test('AUDIT SEA VENTURES E5/B1: a prize never takes a piece the realm never lets pass between players - a quest\'s, a summoned one, a boat\'s deed (a second ship) or parts (their cargo left behind), a Materials Bag - nor counts it toward the share (mutants: the trade law)', () => {
  const dagger = createWeapon(113, 0, seeded(9));
  const barred = {
    quest: sword(2, { questItem: true }),
    summoned: sword(2, { timeForItemToDisappear: 123_456 }),
    deed: mintDeed(2, 0, 4242, 9000),
    parts: mintParts(1, 0, 4343),
    bag: setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE, material: 0, stackCount: 1, value: 50 }),
  };
  for (const [name, it] of Object.entries(barred)) {
    assert.equal(tradeableRecord({ ...it, equipSlot: undefined }), false, name);
    assert.equal(P.prizeable(it), false, name);
    const hold = [dagger, it];
    assert.deepEqual(P.seaPrizePlaces(hold), [0], `${name}: the dagger, never it`);
  }
  assert.equal(P.prizeable(sword(2)), true, 'a plain sword is a prize');
  assert.equal(P.prizeable({ ...sword(2), equipSlot: 3 }), true, 'a hold\'s piece is worn by no one');
});

/** The service and two captains - kim's ship a hold of swords - over the wreck's own law (seaWreck.js). */
async function harbour() {
  const svc = await standService();
  const who = {}, R = {};
  for (const n of ['kim', 'hal']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000, modData: { 'come-sail-away': { placedBoats: [{ UID: 77, Hull: 2, Items: [sword(2, { uid: '00000000000000c1', magic: true }), sword(0)] }] } } });
  }
  let n = 0;
  const wreck = (o = {}) => mintSeaWreck({ f: who.kim.id, c: R.kim.id, k: who.hal.id, kc: R.hal.id, r: `${(++n).toString(16).padStart(12, '0')}`, u: 77, b: 1, m: SEA_CELL, ...o }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const rows = (sql, ...a) => svc.env.DB._raw.prepare(sql).all(...a).map((x) => ({ ...x }));
  const ctx = (o = {}) => ({ db: svc.env.DB, primary: svc.env.DB, bucket: svc.env.SAVES, subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: Math.floor(Date.now() / 1000), ...o });
  return { svc, who, R, wreck, rows, ctx };
}

test('AUDIT SEA VENTURES B2: each piece a prize took is written down as her own copy, in the wreck\'s batch - a game that kept it in its hold holds a copy, never the craft\'s original (mutants: the copies)', async () => {
  const h = await harbour();
  const res = await h.svc.call('/v1/sea/wreck', { receipt: await h.wreck(), realm: h.R.kim.at() }, h.who.kim.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.took.map((x) => x.u), ['00000000000000c1']);
  assert.deepEqual(h.rows('SELECT uid, char_id FROM item_dupes'), [{ uid: '00000000000000c1', char_id: h.R.kim.id }], 'her copy written down');
});

test('AUDIT SEA VENTURES B7, E3: a wreck that stands answers her killer within her grace (his prize waits on her carry alone); past it, a seize whose batch her own checkpoint beat answers \'seq\' - asked again, it lands (mutants: the order, the race)', async () => {
  const h = await harbour();
  const rc = await h.wreck();
  assert.equal((await h.svc.call('/v1/sea/wreck', { receipt: rc }, h.who.hal.secret)).body.error, 'grace', 'nothing stands yet: her grace');
  const mine = await h.svc.call('/v1/sea/wreck', { receipt: rc, realm: h.R.kim.at() }, h.who.kim.secret);
  assert.equal(mine.status, 200);
  const his = await h.svc.call('/v1/sea/wreck', { receipt: rc }, h.who.hal.secret);
  assert.deepEqual([his.status, his.body.again, his.body.n], [200, true, 1], 'her carry stands: his answer at once');
  // the race: past her grace, a seize whose batch fails as her checkpoint moved the record first
  const rc2 = await h.wreck();
  let failed = 0;
  const db = new Proxy(h.svc.env.DB, { get: (t, k) => (k === 'batch' ? async (steps) => { if (!failed++) throw new Error('CHECK constraint failed: moved = expected'); return t.batch(steps); } : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
  const nowS = Math.floor(Date.now() / 1000) + SEA_WRECK_GRACE_S + 1;
  const seize = async () => seaWreck(h.ctx({ db, nowS }), { id: h.who.hal.id }, { receipt: rc2 }, { gateKey: await gateKeyOf(h.svc) });
  assert.equal((await seaWreck(h.ctx({ db, nowS: nowS - 2 }), { id: h.who.hal.id }, { receipt: rc2 }, { gateKey: await gateKeyOf(h.svc) })).error, 'grace');
  assert.deepEqual(await seize(), { error: 'seq' }, 'the record moved under it: asked again, never a throw');
  assert.ok(SEA_WRECK_TRANSIENT.includes('seq'), 'the page asks again');
  assert.equal((await seize()).n, 1, 'asked again, it lands');
});

/** The gate's public key the service verifies with (standService's GATE_PUBLIC_KEY). */
const gateKeyOf = (svc) => gatePublicKey(svc.env, subtle);

test('AUDIT SEA VENTURES E2, E3, E4: the wreck\'s page half - her killer carries an unboarded wreck (a kill at sea) as a boarded one; her captain\'s carry only over a checkpoint that went, asked again while it cannot be; a refusal that says nothing of the wreck asked again; the carries owed kept across a reload (mutants: the unboarded, the checkpoint, the retries, the storage)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const T = 1_800_000_000;
  const mint = (o = {}) => mintSeaWreck({ f: 'acct-kim', c: RC, k: 'acct-hal', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL, ...o }, kp.privateKey, { subtle, nowS: T });
  const host = (me, { answers = [], checkpoint = () => true, kept = new Map() } = {}) => {
    const st = { asked: [], said: [], now: T * 1000 };
    const door = {
      wreck: async (req) => { st.asked.push(['wreck', req]); return answers.shift() ?? { ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 0, realm: { seq: 4 } } }; },
      collect: async (req) => { st.asked.push(['collect', req]); return { ok: true, data: { ok: true, items: [], realm: { seq: 5 } } }; },
    };
    const session = { transact: (fn) => fn({ id: me === 'acct-kim' ? RC : RK, lease: 'lease', seq: 3 }) };
    const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
    const w = createSeaWreckHost({ session, checkpoint, character: () => RK, me: () => me, naval: () => null, door, storage, say: (x) => st.said.push(x), now: () => st.now });
    return { w, st, kept };
  };
  // E2: her killer, unboarded - carried a moment on, nothing collected
  const ub = host('acct-hal');
  ub.w.receipt(await mint({ b: 0 }));
  ub.w.frame(); await settle();
  assert.equal(ub.st.asked.length, 0);
  ub.st.now += SEA_WRECK_SLACK_S * 1000; ub.w.frame(); await settle();
  assert.deepEqual(ub.st.asked.map(([k]) => k), ['wreck'], 'a wreck is a kill at sea, boarded or not');
  // her killer, refused 'grace' then carried: asked again SEA_WRECK_RETRY_MS on
  const k = host('acct-hal', { answers: [{ ok: false, error: 'grace' }] });
  k.w.receipt(await mint());
  k.st.now += SEA_WRECK_SLACK_S * 1000; k.w.frame(); await settle();
  k.st.now += SEA_WRECK_RETRY_MS - 1; k.w.frame(); await settle();
  assert.equal(k.st.asked.length, 1);
  k.st.now += 1; k.w.frame(); await settle();
  assert.deepEqual(k.st.asked.map(([x]) => x), ['wreck', 'wreck', 'collect'], 'asked again, then collected');
  // a refusal of the wreck itself: dropped
  const bad = host('acct-hal', { answers: [{ ok: false, error: 'receipt' }] });
  bad.w.receipt(await mint());
  bad.st.now += SEA_WRECK_SLACK_S * 1000; bad.w.frame(); await settle();
  bad.st.now += 10 * SEA_WRECK_RETRY_MS; bad.w.frame(); await settle();
  assert.equal(bad.st.asked.length, 1, 'never asked again');
  // E4: her captain - a checkpoint refused (a duel) asks the service nothing; allowed, carried
  let allowed = false;
  const cap = host('acct-kim', { checkpoint: () => allowed });
  cap.w.receipt(await mint());
  cap.w.frame(); await settle();
  assert.equal(cap.st.asked.length, 0, 'over a stale record: never');
  cap.st.now += SEA_WRECK_CAPTAIN_RETRY_MS - 1; cap.w.frame(); await settle();
  assert.equal(cap.st.asked.length, 0);
  allowed = true;
  cap.st.now += 1; cap.w.frame(); await settle();
  assert.deepEqual(cap.st.asked.map(([x, req]) => [x, req.realm?.seq]), [['wreck', 3]], 'carried once a checkpoint went');
  // E3: her captain's carry refused 'busy' (another act): asked again
  const busy = host('acct-kim', { answers: [{ ok: false, error: 'busy' }] });
  busy.w.receipt(await mint());
  busy.w.frame(); await settle();
  busy.st.now += SEA_WRECK_CAPTAIN_RETRY_MS; busy.w.frame(); await settle();
  assert.equal(busy.st.asked.length, 2, 'asked again');
  // E2: the carries owed kept across a reload - her killer's page reloaded before his grace
  const kept = new Map();
  const before = host('acct-hal', { kept });
  before.w.receipt(await mint());
  assert.ok(JSON.parse(kept.get(SEA_WRECK_KEPT_KEY)).length === 1, 'kept');
  const after = host('acct-hal', { kept });
  after.w.frame(); await settle();
  assert.deepEqual(after.st.asked.map(([x]) => x), ['wreck', 'collect'], 'the reloaded page carries it');
  assert.deepEqual(JSON.parse(kept.get(SEA_WRECK_KEPT_KEY)), [], 'and forgets it carried');
  // an expired receipt is dropped unasked
  const late = host('acct-hal');
  late.w.receipt(await mint());
  late.st.now += 3601 * 1000; late.w.frame(); await settle();
  assert.equal(late.st.asked.length, 0);
});

test('AUDIT SEA VENTURES B3: a wrecked ship\'s hold is shut while her wreck may be boarded - the referee\'s wreck shuts it, the door and the mod\'s own box open it to no one, she is neither packed nor laid up - and her carry settled opens it again; kept across a reload, never past SEA_HOLD_SHUT_MS (mutants: the shut, the door, the box, the pack, the lay-up, the open)', async () => {
  assert.equal(SEA_HOLD_SHUT_MS, 240_000);
  const boat = { uid: 77, hull: 2, Cargo: { Items: [{ name: 'Longsword' }] } };
  const dmg = createShipDamage({ hullHp: 600, sailHp: 200, crew: 10, player: true });
  const pvp = createNavalPvp({ enabled: () => true, boat: () => boat, stateOf: () => ({ damage: dmg }), clock: () => 5 });
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) };
  try {
  openSeaHold(77);
  pvp.wreck();
  assert.equal(seaHoldShut(77), true, 'the referee\'s wreck shuts her hold');
  assert.ok(JSON.parse(appStorage().getItem(SEA_HOLD_SHUT_KEY))['77'] > Date.now(), 'kept in the page\'s storage');
  const reloaded = await import(`../../../src/systems/naval/seaHoldGuard.js?reload=${Date.now()}`);
  assert.equal(reloaded.seaHoldShut(77), true, 'a reloaded page reads it back');
  const said = [];
  let opened = 0;
  const door = createHoldDoor({ csa: () => ({ AllBoats: [boat] }), ships: () => [{ uid: 77, hull: 2 }], openHold: () => { opened++; return true; }, say: (x) => said.push(x) });
  assert.equal(door.openShip(77), false);
  assert.deepEqual([opened, said], [0, ['Her hold is shut while her wreck may be boarded.']]);
  const csa = readFileSync(new URL('../../../src/systems/comeSailAway/comeSailAway.js', import.meta.url), 'utf8');
  assert.match(csa, /function OpenCargo\(boat\) \{ if \(seaHoldShut\(boat\?\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return; \} deps\.openCargo\?\.\(boat\.Cargo\); \}/, 'the mod\'s own box');
  assert.match(csa, /if \(!lost && seaHoldShut\(boat\?\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return false; \}/, 'never packed - a lost boat\'s recovery aside');
  assert.match(csa, /function LayUpBoat\(boat\) \{\n[^\n]*\n\s+if \(seaHoldShut\(boat\.uid\)\) \{ deps\.messageBox\?\.\(seaHoldShutText\(\)\); return false; \}/, 'nor laid up');
  // her carry settled: open again
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const rc = await mintSeaWreck({ f: 'acct-kim', c: RC, k: 'acct-hal', kc: RK, r: '0123456789ab', u: 77, b: 1, m: SEA_CELL }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const w = createSeaWreckHost({ session: sessionAt(), checkpoint: () => true, character: () => RC, me: () => 'acct-kim', naval: () => ({ pvp }), door: { wreck: async () => ({ ok: true, data: { r: '0123456789ab', b: 1, took: [], n: 0, realm: { seq: 4 } } }) }, storage: { getItem: () => null, setItem: () => {} }, say: () => {} });
  w.receipt(rc); w.frame(); await settle();
  assert.equal(seaHoldShut(77), false, 'her carry landed: open');
  assert.equal(door.openShip(77), true);
  // never past SEA_HOLD_SHUT_MS
  shutSeaHold(78, 1_000);
  assert.deepEqual([seaHoldShut(78, 1_000 + SEA_HOLD_SHUT_MS - 1), seaHoldShut(78, 1_000 + SEA_HOLD_SHUT_MS)], [true, false]);
  } finally { delete globalThis.localStorage; }
});

test('AUDIT SEA VENTURES B4: a post on a head gone - deleted, or dead SEA_REFUND_AFTER_S - is owed back to its poster and paid by its collect, once; a character with bounties, prizes or hold goods waiting is not deleted until they come home (mutants: the refund, its wait, the delete\'s refusal)', async () => {
  const svc = await standService();
  const who = {}, R = {};
  for (const n of ['pat', 'kim', 'hal']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, { name: n, level: 5, items: [], goldPieces: 5000 });
  }
  const raw = svc.env.DB._raw;
  const nowS = Math.floor(Date.now() / 1000);
  raw.prepare('INSERT INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?, ?, ?, ?, ?, ?)').run('k1', who.kim.id, R.kim.id, who.hal.id, R.hal.id, nowS);
  const post = await svc.call('/v1/sea/bounty/post', { character: R.pat.id, realm: R.pat.at(), region: 19, target: R.kim.id, gold: 2000, rid: 'sbaudit0001' }, who.pat.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const board = async () => (await svc.call('/v1/sea/bounty/board', { character: R.pat.id }, who.pat.secret)).body;
  assert.equal((await board()).refund, 0, 'a living head: nothing back');
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS - SEA_REFUND_AFTER_S + 60, R.kim.id);
  assert.equal((await board()).refund, 0, 'dead a moment: a fall that ended it may yet claim it');
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS - SEA_REFUND_AFTER_S - 1, R.kim.id);
  assert.equal((await board()).refund, 2000, 'dead past the wait: back to its poster');
  const before = recordOf(svc.env, R.pat.id);
  const got = await svc.call('/v1/sea/bounty/collect', { character: R.pat.id, realm: R.pat.at(), region: 19 }, who.pat.secret);
  assert.deepEqual([got.status, got.body.gold], [200, 2000], JSON.stringify(got.body));
  const after = recordOf(svc.env, R.pat.id);
  const goldOf = (rec) => (Number(rec.goldPieces) || 0) + (rec.bankAccounts ?? []).reduce((n, a) => n + (Number(a?.accountGold) || 0), 0);   // the region's bank, the purse where it keeps none
  assert.equal(goldOf(after) - goldOf(before), 2000, 'into the poster\'s record');
  assert.deepEqual((await svc.call('/v1/sea/bounty/collect', { character: R.pat.id, realm: R.pat.at(), region: 19 }, who.pat.secret)).body.gold, 0, 'once');
  assert.equal((await board()).refund, 0);
  // the delete waits for what is owed
  raw.prepare('INSERT INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at) VALUES (?, ?, ?, ?, ?, ?)').run('k9', who.hal.id, R.hal.id, R.kim.id, 500, nowS);
  assert.equal((await svc.call('/v1/realm/delete', { id: R.hal.id }, who.hal.secret)).body.error, 'sea-held');
  raw.prepare('UPDATE sea_bounty_owed SET paid_at = ? WHERE r = ?').run(nowS, 'k9');
  assert.equal((await svc.call('/v1/realm/delete', { id: R.hal.id }, who.hal.secret)).status, 200, 'collected: deleted as any other');
});

test('AUDIT SEA VENTURES B5: the sea\'s tables are swept - a kill past the Wanted window, a wreck past its hour, what has ended past its keeping - and never a bounty standing, a sum owed or a prize held; the reads walk their own indexes (mutants: each sweep, each keep)', async () => {
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const nowS = 2_000_000_000;
  const old = nowS - SEA_ENDED_KEEP_S - 1, young = nowS - 60;
  raw.prepare('INSERT INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)').run('ka', 'a', 'ca', 'b', 'cb', nowS - SEA_WANTED_DAYS * 86_400 - 1, 'kb', 'a', 'ca', 'b', 'cb', young);
  raw.prepare('INSERT INTO sea_wrecks (r, victim, victim_char, killer, killer_char, boat, boarded, took, seq, at) VALUES (?, ?, ?, ?, ?, 1, 1, ?, NULL, ?), (?, ?, ?, ?, ?, 1, 1, ?, NULL, ?)').run('wa', 'b', 'cb', 'a', 'ca', '[]', nowS - 7201, 'wb', 'b', 'cb', 'a', 'ca', '[]', young);
  raw.prepare('INSERT INTO sea_bounties (id, poster, poster_char, rid, target_char, gold, at, claimed_r) VALUES (?, ?, ?, ?, ?, 100, ?, ?), (?, ?, ?, ?, ?, 100, ?, NULL)').run('ba', 'p', 'cp', 'r1', 'cb', old, 'ka', 'bb', 'p', 'cp', 'r2', 'cb', old);
  raw.prepare('INSERT INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at, paid_at) VALUES (?, ?, ?, ?, 100, ?, ?), (?, ?, ?, ?, 100, ?, NULL)').run('oa', 'a', 'ca', 'cb', old, old, 'ob', 'a', 'ca', 'cb', old);
  raw.prepare("INSERT INTO sea_prizes (r, i, victim, victim_char, killer, killer_char, rec, at, until_s, state, ended_at) VALUES (?, 0, 'b', 'cb', 'a', 'ca', '{}', ?, ?, 'collected', ?), (?, 0, 'b', 'cb', 'a', 'ca', '{}', ?, ?, 'held', NULL)").run('pa', old, old, old, 'pb', old, old);
  for (const [sql, cutoff] of seaSweeps(nowS)) raw.prepare(sql).run(cutoff, 500);
  const ids = (sql) => raw.prepare(sql).all().map((x) => Object.values(x)[0]);
  assert.deepEqual(ids('SELECT r FROM sea_kills'), ['kb'], 'a kill in the Wanted window kept');
  assert.deepEqual(ids('SELECT r FROM sea_wrecks'), ['wb'], 'a wreck within its hours kept');
  assert.deepEqual(ids('SELECT id FROM sea_bounties'), ['bb'], 'a bounty standing never swept');
  assert.deepEqual(ids('SELECT r FROM sea_bounty_owed'), ['ob'], 'a sum owed never swept');
  assert.deepEqual(ids('SELECT r FROM sea_prizes'), ['pb'], 'a prize held never swept');
  const plan = (sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((x) => x.detail).join(' | ');
  assert.match(plan('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE target_char = \'x\' AND claimed_r IS NULL'), /USING (COVERING )?INDEX sea_bounties_(standing|target)/);
  assert.match(plan('SELECT SUM(gold) FROM sea_bounties WHERE claimed_r = \'x\''), /USING (COVERING )?INDEX sea_bounties_claimed/);
  assert.match(plan('SELECT r FROM sea_kills WHERE at < 5'), /USING (COVERING )?INDEX sea_kills_at/);
  assert.match(plan('SELECT r FROM sea_wrecks WHERE at < 5'), /USING (COVERING )?INDEX sea_wrecks_at/);
});

test('AUDIT SEA VENTURES B6: the day a season turns in counts for the old one - a world day past the turn, a save filing the season before\'s figures is read for it, its legends bounded by that whole season; past the day, never (mutants: the day, the season before, the legends\' bound)', () => {
  assert.equal(SEA_WORLD_DAY_S, 7200);
  const turn = seaSeasonStartS(2);
  const save = (n, deepest = 900, legends = 1) => ({ modData: { [SEA_SEASON_VENDOR]: { ether: { season: { n, deepest, legends } } } } });
  assert.deepEqual(seaSeasonFigures(save(1), turn + 60), { n: 1, deepest: 900, legends: 1 }, 'the season before, the turn\'s day');
  assert.deepEqual(seaSeasonFigures(save(1), turn + SEA_WORLD_DAY_S - 1), { n: 1, deepest: 900, legends: 1 });
  assert.equal(seaSeasonFigures(save(1), turn + SEA_WORLD_DAY_S), null, 'past the day: never');
  assert.deepEqual(seaSeasonFigures(save(2), turn + 60), { n: 2, deepest: 900, legends: 1 }, 'the new season\'s too');
  assert.equal(seaSeasonFigures(save(0), turn + 60), null, 'two seasons back: never');
  const oldMost = seaLegendsPossible(turn - 1);
  assert.ok(oldMost > seaLegendsPossible(turn + 60), 'the old season had more legends to end than the new one\'s first day');
  assert.deepEqual(seaSeasonFigures(save(1, 0, oldMost), turn + 60)?.legends, oldMost, 'bounded by the old season\'s whole');
  assert.equal(seaSeasonFigures(save(1, 0, oldMost + 1), turn + 60), null);
});
