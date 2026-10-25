// FIELD BUGS 2026-10-25b CHEST-DRAFT and COPY-LIFT (#bug-reports, Giljabrar, "Storage in the Decoration update may be
// Realm Locking items": "I placed 89 rare/legendary items in a chest to await being ID'd this afternoon, and when I went
// to retrieve them they were all 'Realm Locked'"). The decorator's draft kept a picture of every chest the room held and
// its Discard wrote the picture back (scenes/decor/decorTool.js): a piece taken out of a chest since stood in the chest
// AND the pack, and the next checkpoint's ledger read one piece twice in one record - a copy, both locked
// (server-account/src/ledger.js). In #1223's build the draft outlived the room, and a Discard in the ship's decorator stood
// the home's chests there with a copy of everything they held. Pinned here through the real producers end to end: the
// real decorator (test/decorFakes.mjs toolRig - its chests the real room's store, scenes/decor/decorRoom.js), the
// inventory window's own move (systems/item/itemTransfer.js applyTransfer), rolled pieces stamped with their ids as a
// checkpoint stamps them (systems/item/itemIds.js stampItemIds), the save as the host composes it (systems/sceneCache.js),
// and the real Worker's checkpoint. And COPY-LIFT: a record's copy of its own is lifted only by the service's own hand -
// staff's purge with `keep`, which itself leaves the record one (ledger.js ownCopiesLiftable, staffpanel3realm.test.js) -
// and never on a checkpoint's word that the record shows it once: AUDIT FB1025b, a duper's copy moved where the record
// lists nothing (a deserter revenant's take, a counter, the ground) and brought back after stays locked throughout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { toolRig } from '../decorFakes.mjs';
import { DUPE_GRACE_S, piecesRefusal, ownCopiesLiftable, ownCopyLiftSteps } from '../../server-account/src/ledger.js';
import { ledgerPrintOf } from '../../server-account/src/judge.js';
import { createSceneCache, cacheScene, snapshotSceneCache } from '../../src/systems/sceneCache.js';
import { homeSceneName } from '../../src/systems/online/onlineHomes.js';
import { applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { stampItemIds, ledgerKeyOf } from '../../src/systems/item/itemIds.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seeded } from '../honestItems.mjs';

const HOME = { kind: 'home', where: 'Your home', mapId: 11, buildingKey: 22 };
const SCENE = homeSceneName(HOME.mapId, HOME.buildingKey);
const piece = (extra) => ({ model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });
const CHEST = piece({ id: 'c1', model: 41811, storage: true });
const BED = piece({ id: 'b1', pos: [3, 0, 3] });

/** `n` Rare pieces as the loot rolls them, each with the id its first checkpoint stamps. */
function rares(n, from = 0) {
  const who = { items: Array.from({ length: n }, (_, i) => applyRarity(createWeapon(113, 1, seeded(7 + from + i)), 'rare', seeded(11 + from + i))) };
  stampItemIds(who);
  return who.items;
}
const keysOf = (items) => items.map(ledgerKeyOf);

/** The decorator in an online home, its Confirm the service's batch. */
const homeRig = () => toolRig({
  room: HOME, gold: 5000,
  homeDecor: { list: async () => ({ ok: true, data: { rev: 1, pieces: [] } }), batch: async (b) => ({ ok: true, data: { rev: b.rev + 1, gold: 0 } }) },
});
/** The decorator opened (its draft with it), as the player's button opens it. */
function decorate(rig) {
  rig.frame();
  rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
  assert.equal(rig.tool.flying(), true, 'decorating');
}
/** The inventory window's own move of every piece in `from` to `to` (a chest's Take, or Store). */
const moveAll = (from, to, toPlayer) => { for (const it of [...from]) applyTransfer(it, { amount: 1 }, from, to, { toPlayer }); };

/** The realm: one character, its checkpoints put through the real Worker. */
async function realm() {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService();
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    return { who, R: await seatRealm(s.env, who.secret, handle) };
  };
  const putSave = async ({ who, R }, save) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200);
    return res.json();
  };
  /** The save as the host composes it inside the home (worldModes.js interiorSaveData): the pack, and the room's scene - an
   *  online home's pieces are the service's, what its chests hold the save's (`decorItems`). */
  const put = (c, pack, decorItems = {}, extra = {}) => {
    const cache = createSceneCache();
    cacheScene(cache, SCENE, { decor: [], decorItems });
    return putSave(c, freshSave({ name: c.who.handle, items: pack.map((it) => ({ ...it })), sceneCache: snapshotSceneCache(cache), ...extra }));
  };
  const copies = (c) => raw.prepare('SELECT uid, kind FROM item_dupes WHERE char_id = ? ORDER BY uid').all(c.R.id).map((r) => ({ ...r }));
  const dupeFindings = (c) => raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'dupe' ORDER BY id").all(c.R.id).map((r) => JSON.parse(r.detail));
  return { s, raw, seat, put, copies, dupeFindings, wait: (sec) => { now += sec; }, done: () => { Date.now = realNow; } };
}
const sorted = (a) => [...a].sort();

test('CHEST-DRAFT the report: pieces taken out of a home\'s chest while the draft stands are not stood back in the chest by Discard - the pack holds them once, and the realm locks none', async () => {
  const P = rares(3);
  const rig = homeRig();
  rig.standing.push({ ...CHEST });
  rig.chests.itemsOf('c1').push(...P);
  decorate(rig);
  moveAll(rig.chests.itemsOf('c1'), rig.pack, true);   // retrieved
  rig.standing.push({ ...BED });   // a change not kept yet
  assert.equal(rig.tool.discardDraft(), true);
  assert.deepEqual(rig.standing.map((p) => p.id), ['c1'], 'Discard puts the room\'s pieces back');
  assert.deepEqual(rig.chests.itemsSnapshot(), {}, 'and leaves the chest as the player left it - empty');
  assert.deepEqual(keysOf(rig.pack), keysOf(P), 'the pieces are the pack\'s, once');
  const r = await realm();
  try {
    const c = await r.seat('giljabrar');
    const answer = await r.put(c, rig.pack, rig.chests.itemsSnapshot());
    assert.deepEqual([answer.locked, r.copies(c)], [[], []], 'the checkpoint after it locks nothing');
  } finally { r.done(); }
});

test('CHEST-DRAFT the other face ("Items placed inside house storage randomly disappear"): pieces stored while the draft stands stay in the chest through Discard', () => {
  const P = rares(2, 10);
  const rig = homeRig();
  rig.standing.push({ ...CHEST });
  rig.pack.push(...P);
  decorate(rig);
  moveAll(rig.pack, rig.chests.itemsOf('c1'), false);   // stored
  rig.standing.push({ ...BED });
  rig.tool.discardDraft();
  assert.deepEqual(keysOf(rig.chests.itemsOf('c1')), keysOf(P), 'still in the chest');
  assert.deepEqual(rig.pack, []);
});

test('CHEST-DRAFT a chest the draft stood and Discard takes away gives back what was put in it - to the pack, once, and no record of it left under its id', () => {
  const P = rares(2, 20);
  const rig = homeRig();
  rig.pack.push(...P);
  decorate(rig);
  rig.standing.push(piece({ id: 'c2', model: 41811, storage: true }));   // a new chest, not kept yet
  moveAll(rig.pack, rig.chests.itemsOf('c2'), false);
  rig.tool.discardDraft();
  assert.deepEqual(rig.standing.map((p) => p.id), [], 'the chest goes');
  assert.deepEqual(keysOf(rig.pack), keysOf(P), 'what it held is the pack\'s again');
  assert.deepEqual(rig.chests.itemsSnapshot(), {}, 'and the scene writes nothing under its id');
});

test('CHEST-DRAFT an own thing the draft took down, stored in a chest since, is not stood again by Discard - one of it, in the chest', async () => {
  const [ring] = rares(1, 30);
  const rig = homeRig();
  rig.standing.push({ ...CHEST }, piece({ id: 'o1', model: null, flat: [209, 0], item: { t: ring.templateIndex } }));
  rig.owned.set('o1', ring);
  decorate(rig);
  assert.equal(rig.tool.act('remove', 'o1'), true);
  await new Promise((done) => { setTimeout(done, 0); });
  assert.deepEqual([rig.pack.length, rig.owned.has('o1')], [1, false], 'taken down into the pack');
  moveAll(rig.pack, rig.chests.itemsOf('c1'), false);
  rig.tool.discardDraft();
  assert.equal(rig.owned.has('o1'), false, 'not stood again beside the chest\'s');
  assert.deepEqual(keysOf(rig.chests.itemsOf('c1')), [ledgerKeyOf(ring)]);
});

test('CHEST-DRAFT an own thing the draft took down and still in the pack stands again on Discard, as it was', async () => {
  const [ring] = rares(1, 40);
  const rig = homeRig();
  rig.standing.push(piece({ id: 'o1', model: null, flat: [209, 0], item: { t: ring.templateIndex } }));
  rig.owned.set('o1', ring);
  decorate(rig);
  rig.tool.act('remove', 'o1');
  await new Promise((done) => { setTimeout(done, 0); });
  rig.tool.discardDraft();
  assert.deepEqual([rig.pack.length, ledgerKeyOf(rig.owned.get('o1'))], [0, ledgerKeyOf(ring)]);
});

/** A sworn revenant gone over to the feud, carrying `took` - the more valuable half of the pack it was given
 *  (systems/revenant/revenant.js splitPack: it keeps a realm-locked piece, only the player's own lock barred), on its record
 *  and in the save, read by no list the record holds (systems/item/possessedItems.js), given back when it falls. */
const deserter = (took) => ({ modData: { Revenant: { list: [{ id: 'rv1', sworn: false, defeated: false, took }] } } });

test('COPY-LIFT the exploit (AUDIT FB1025b): a pair locked stays locked when one copy goes where the record lists nothing - a deserter\'s take, a counter - and when it comes back; no route moves either', async () => {
  const r = await realm();
  try {
    const c = await r.seat('duper');
    const [k] = rares(1, 50);
    const key = ledgerKeyOf(k);
    assert.deepEqual((await r.put(c, [k], { c1: [k] })).locked, [key], 'a pair of it: locked');
    assert.deepEqual(r.copies(c), [{ uid: key, kind: 'twice' }]);
    const hidden = await r.put(c, [k], {}, deserter([{ ...k }]));
    assert.deepEqual(hidden.locked, [key], 'one copy in a deserter\'s take: the one the record shows is locked still');
    assert.equal(await piecesRefusal(r.s.env.DB, c.R.id, [key]), 'piece-dupe', 'and no trade, listing or chest moves it');
    assert.deepEqual((await r.put(c, [k])).locked, [key], 'the other sold at a counter, the service never told: locked still');
    assert.deepEqual((await r.put(c, [k, k])).locked, [key], 'the hidden copy back: a pair, locked');
    assert.deepEqual(r.copies(c), [{ uid: key, kind: 'twice' }], 'the copy written down throughout');
  } finally { r.done(); }
});

test('COPY-LIFT the law the keep act lifts by: a record\'s copy of its own, its row its own, held and unclaimed, of the piece kept, no other record\'s copy known, no trail check calling it a copier\'s - lifted in the act\'s batch and said; every other copy stays', async () => {
  const r = await realm();
  try {
    const A = await r.seat('aldric'), B = await r.seat('brenna');
    const [k0, k1, k2, k3, k4, k5, k6, k7, k8] = rares(9, 60);
    await r.put(B, [k7]);   // k7: another record held it first, and holds it still
    await r.put(A, [k0, k0, k1, k1, k2, k2, k3, k3, k4, k4, k5, k5, k6, k6, k7, k7, k8, k8]);
    assert.equal(r.copies(A).length, 9, 'each a copy');
    await r.put(B, [k7, k1]);   // k1: another record shows it - its claim on this record's row waits
    r.raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind) VALUES (?, ?, ?, 'claim')").run(ledgerKeyOf(k2), B.R.id, T0);   // k2: another record's copy known
    r.raw.prepare("UPDATE item_dupes SET trail_at = ?, trail_found = 'copier' WHERE uid = ? AND char_id = ?").run(T0, ledgerKeyOf(k3), A.R.id);   // k3: staff found a copier
    r.raw.prepare("UPDATE item_dupes SET kind = 'craft' WHERE uid = ? AND char_id = ?").run(ledgerKeyOf(k4), A.R.id);   // k4: a craft's copy
    r.raw.prepare('UPDATE item_dupes SET kind = NULL WHERE uid = ? AND char_id = ?').run(ledgerKeyOf(k5), A.R.id);   // k5: found before the census said how
    await r.put(A, [k0, k0, k1, k1, k2, k2, k3, k3, k4, k4, k5, k5, k6, k6, k7, k7]);   // k8: let go, its row kept gone for the copy
    const other = { ...applyRarity(createWeapon(120, 1, seeded(90)), 'rare', seeded(91)), uid: ledgerKeyOf(k6) };   // k6: the one kept is another piece
    const kept = [k0, k1, k2, k3, k4, k5, other, k7, k8].map((it) => ({ key: ledgerKeyOf(it), fp: ledgerPrintOf(it) }));
    const lifts = await ownCopiesLiftable(r.s.env.DB, A.R.id, kept);
    assert.deepEqual(lifts, [ledgerKeyOf(k0)], 'the clean pair alone');
    await r.s.env.DB.batch(ownCopyLiftSteps(r.s.env.DB, A.R.id, lifts, T0));
    assert.deepEqual(r.copies(A).map((x) => x.uid).includes(ledgerKeyOf(k0)), false, 'lifted');
    assert.equal(r.copies(A).length, 8, 'the rest stand');
    assert.deepEqual(r.dupeFindings(A).at(-1), { lifted: [ledgerKeyOf(k0)], count: 1 });
    await r.s.env.DB.batch(ownCopyLiftSteps(r.s.env.DB, A.R.id, keysOf([k1, k2, k3, k4, k5, k7, k8]), T0));   // keys the law refuses, handed to it
    assert.equal(r.copies(A).length, 8, 'the statement asks the law again: none of them lifted');
    const once = await r.put(A, [k0, k1, k2, k3, k4, k5, other, k7, k8]);
    assert.deepEqual(sorted(once.locked), sorted(keysOf([k1, k2, k3, k4, k5, k6, k7, k8])), 'k0 trades again; every other piece locked');
  } finally { r.done(); }
});

test('COPY-LIFT no checkpoint lifts a copy: a claim\'s copy - a piece another record held first - stays locked when the claimant shows it once', async () => {
  const r = await realm();
  try {
    const G = await r.seat('gil'), R = await r.seat('rhe');
    const [k] = rares(1, 70);
    await r.put(G, [k]);
    await r.put(R, [k]);
    r.wait(DUPE_GRACE_S);
    await r.put(G, [k]);
    assert.deepEqual(r.copies(R), [{ uid: ledgerKeyOf(k), kind: 'claim' }], 'the claimant\'s copy');
    assert.deepEqual((await r.put(R, [k])).locked, [ledgerKeyOf(k)], 'once, and locked still');
  } finally { r.done(); }
});
