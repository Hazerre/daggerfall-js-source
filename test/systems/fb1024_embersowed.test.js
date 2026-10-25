// EMBERS-OWED (FB1024, 2026-10-24, #bug-reports: "A few days ago, I tried to purchase my first battlemage piece. Ther server
// decided to crap the bed and the transaction never went through, the embers were not taken out and I didn't get the piece
// ... I was however locked out for the week ... I now have 52 deadlands embers on me, and it will not let me buy the aura,
// it says I have too few"). A sale is two ledgers - the pack's embers and the account's purse - and a sale whose answer was
// lost AND whose question after went unheard gave the pack its embers back blind while the service had written it: the
// week's Panoply taken, the purse charged 20, the pack 20 over what the account would ever spend. Such a sale is now OWED
// (systems/sigil/sigilBroker.js oweSale) and the Broker's next open settles it. Record:
// bible/01-Overview/bugs/Field-Bugs-2026-10-24.md.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  panoplySale, insigniaSale, settleOwedPanoply, settleOwedInsignia, brokerOwedDoor, wardrobeHolds, sinkHolds, brokerOwed,
  validOwed, _resetOwed, stoneCount, spendableStonesIn, OWED_MAX, BROKER_OWED_VENDOR, BROKER_OWED_TEXT, brokerOwedText,
} from '../../src/systems/sigil/sigilBroker.js';
import { modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { sigilStone } from '../../src/systems/gate/gateSpoils.js';
import { panoplyPieceById } from '../../src/systems/aetheric.js';
import { EG_SINK_EMBERS, EG_PANOPLY_IDS, EG_SINK_RECENT_WEEKS } from '../../src/net/eliteGates/egPay.js';
import { INSIGNIA } from '../../src/net/insignia.js';
import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountEg, SESSION_KEY } from '../../src/net/accountClient.js';
import { ARENA_SEASON_EPOCH_S, ARENA_WEEK_S, arenaWeekOf } from '../../src/net/arena/arenaLaw.js';

const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const count = (pack) => stoneCount(spendableStonesIn(pack));
const P = EG_PANOPLY_IDS[3];
const W = 30;
const lostBuy = async () => { throw new Error('reset'); };
const unheard = async () => { throw new Error('offline'); };
const keysAnswer = (sink) => async () => ({ ok: true, data: { sink } });
const owePanoply = async (pack, { week = W } = {}) => panoplySale(P, { items: pack, save: () => {}, mint: panoplyPieceById, held: unheard, buy: lostBuy, week });
const pieces = (pack) => pack.filter((it) => it.stackCount == null || !count([it])).length;

beforeEach(() => _resetOwed());

test('EMBERS-OWED: a lost sale whose question went unheard keeps its embers OUT and owes the sale, saved at once; a service that answered without it gives them back', async () => {
  let saved = 0;
  const pack = [stack(52)];
  const r = await panoplySale(P, { items: pack, save: () => { saved++; }, mint: panoplyPieceById, held: unheard, buy: lostBuy, week: W });
  assert.deepEqual([r, count(pack), saved], [{ ok: false, error: 'unheard' }, 32, 1]);
  assert.deepEqual(brokerOwed(), [{ kind: 'panoply', id: P, embers: EG_SINK_EMBERS, week: W, clock: false }]);
  // a null `held` is unheard too; `false` is the service's answer: not held, the embers back as before
  _resetOwed();
  const back = [stack(52)];
  assert.deepEqual(await panoplySale(P, { items: back, save: () => {}, mint: panoplyPieceById, held: async () => false, buy: lostBuy }), { ok: false, error: 'offline' });
  assert.deepEqual([count(back), brokerOwed()], [52, []]);
  // the week the service last said, or the clock's (a week either side)
  _resetOwed();
  await panoplySale(P, { items: [stack(20)], save: () => {}, mint: panoplyPieceById, held: async () => null, buy: lostBuy });
  assert.deepEqual(brokerOwed().map((o) => [o.week, o.clock]), [[arenaWeekOf(Date.now() / 1000), true]]);
  // the insignia's sale the same
  _resetOwed();
  const ipack = [stack(60)];
  const offer = INSIGNIA.find((o) => o.kind === 'aura');
  assert.deepEqual(await insigniaSale(offer, { items: ipack, save: () => {}, held: unheard, buy: lostBuy }), { ok: false, error: 'unheard' });
  assert.deepEqual([count(ipack), brokerOwed()], [60 - offer.price, [{ kind: 'insignia', id: offer.id, embers: offer.price, week: null, clock: false }]]);
  assert.equal(brokerOwedText(), BROKER_OWED_TEXT, 'English where the player chose it');
  assert.match(BROKER_OWED_TEXT, /Your embers are held/);
});

test('EMBERS-OWED: settled at the next open - held, the piece minted into the pack (no Broker price); answered without it, the embers back; unanswered, still owed', async () => {
  const pack = [stack(20)];
  await owePanoply(pack);
  let saved = 0;
  const save = () => { saved++; };
  await settleOwedPanoply(async () => ({ ok: false, error: 'offline' }), { items: pack, save, mint: panoplyPieceById });
  assert.deepEqual([brokerOwed().length, count(pack), saved], [1, 0, 0], 'unanswered: still owed, nothing saved');
  const a = await settleOwedPanoply(keysAnswer({ week: W, piece: P, recent: [] }), { items: pack, save, mint: panoplyPieceById });
  assert.equal(a.data.sink.piece, P, 'the host gets the answer for its own rows');
  assert.deepEqual([brokerOwed(), count(pack), saved, pack.length], [[], 0, 1, 1]);
  assert.equal(pack[0].stonesPaid, undefined, 'the piece, no dismantle price');
  assert.equal(pack[0].name, panoplyPieceById(P).name);
  // not held the same week (none, or another character's piece): the embers back
  for (const sink of [{ week: W, piece: null, recent: [] }, { week: W, piece: EG_PANOPLY_IDS[0], recent: [] }]) {
    _resetOwed(); const p2 = [stack(20)]; await owePanoply(p2);
    await settleOwedPanoply(keysAnswer(sink), { items: p2, save, mint: panoplyPieceById });
    assert.deepEqual([brokerOwed(), count(p2)], [[], 20], JSON.stringify(sink));
  }
});

test('EMBERS-OWED: a later week - the service\'s `recent` decides; a service that says none keeps it owed; the week\'s edge; past EG_SINK_RECENT_WEEKS, the embers back', async () => {
  const settle = async (sink, { week = W, clock = false } = {}) => {
    _resetOwed();
    const pack = [stack(20)];
    await panoplySale(P, { items: pack, save: () => {}, mint: panoplyPieceById, held: async () => null, buy: lostBuy, week: clock ? null : week });
    if (clock) restoreModSaveRecords({ [BROKER_OWED_VENDOR]: [{ kind: 'panoply', id: P, embers: EG_SINK_EMBERS, week, clock: true }] });
    await settleOwedPanoply(keysAnswer(sink), { items: pack, save: () => {}, mint: panoplyPieceById });
    return [brokerOwed().length, count(pack), pieces(pack)];
  };
  assert.deepEqual(await settle({ week: W + 2, piece: null, recent: [{ week: W, piece: P }] }), [0, 0, 1], 'held two weeks back: the piece');
  assert.deepEqual(await settle({ week: W + 2, piece: null, recent: [{ week: W - 1, piece: P }] }), [0, 20, 0], 'the week before is another sale - the service\'s week was heard');
  assert.deepEqual(await settle({ week: W + 2, piece: null, recent: [{ week: W + 1, piece: P }] }), [0, 0, 1], 'pressed as the week turned: held the next');
  assert.deepEqual(await settle({ week: W + 2, piece: null, recent: [{ week: W - 1, piece: P }] }, { clock: true }), [0, 0, 1], 'the clock\'s week: one either side');
  assert.deepEqual(await settle({ week: W + 2, piece: null, recent: [] }), [0, 20, 0], 'answered for that week, none: the embers back');
  assert.deepEqual(await settle({ week: W + 2, piece: null }), [1, 0, 0], 'a service that says no `recent`: still owed');
  assert.deepEqual(await settle({ week: W + EG_SINK_RECENT_WEEKS, piece: null }), [0, 20, 0], 'past the weeks the service says: the embers back');
  assert.deepEqual(await settle({ week: W + EG_SINK_RECENT_WEEKS - 1, piece: null }), [1, 0, 0], 'inside them, a service without `recent` still owes');
});

test('EMBERS-OWED: an answer asked BEFORE a sale settles nothing of it; a piece the host cannot mint stays owed; past OWED_MAX a lost sale gives back as it did', async () => {
  const pack = [stack(40)];
  let release;
  const gate = new Promise((r) => { release = r; });
  const settling = settleOwedPanoply(async () => { await gate; return { ok: true, data: { sink: { week: W, piece: null, recent: [] } } }; }, { items: pack, save: () => {}, mint: panoplyPieceById });
  await owePanoply(pack);
  release();
  await settling;
  assert.deepEqual([brokerOwed().length, count(pack)], [1, 20], 'owed after the ask: untouched by its answer');
  await settleOwedPanoply(keysAnswer({ week: W, piece: P, recent: [] }), { items: pack, save: () => {}, mint: () => null });
  assert.equal(brokerOwed().length, 1, 'no piece to give: still owed');
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: Array.from({ length: OWED_MAX }, (_, i) => ({ kind: 'insignia', id: `x${i}`, embers: 5, week: null, clock: false })) });
  const full = [stack(20)];
  assert.deepEqual(await owePanoply(full), { ok: false, error: 'offline' });
  assert.deepEqual([brokerOwed().length, count(full)], [OWED_MAX, 20]);
});

test('EMBERS-OWED: the insignia settled off the account\'s wardrobe - owned, the sale; answered without it, the embers back; unanswered, owed', async () => {
  const offer = INSIGNIA.find((o) => o.kind === 'aura');
  const run = async (answer) => {
    _resetOwed();
    const pack = [stack(offer.price)];
    await insigniaSale(offer, { items: pack, save: () => {}, held: async () => null, buy: lostBuy });
    await settleOwedInsignia(async () => answer, { items: pack, save: () => {} });
    return [brokerOwed().length, count(pack)];
  };
  assert.deepEqual(await run({ ok: true, data: { wardrobe: { insignia: [offer.id] } } }), [0, 0]);
  assert.deepEqual(await run({ ok: true, data: { wardrobe: { insignia: [] } } }), [0, offer.price]);
  assert.deepEqual(await run({ ok: false, error: 'offline' }), [1, 0]);
  assert.deepEqual([wardrobeHolds({ ok: true, data: { wardrobe: { insignia: ['x'] } } }, 'x')?.insignia, wardrobeHolds({ ok: true, data: { wardrobe: { insignia: [] } } }, 'x'), wardrobeHolds({ ok: false }, 'x')], [['x'], false, null]);
  assert.deepEqual([sinkHolds({ ok: true, data: { sink: { piece: P } } }, P)?.piece, sinkHolds({ ok: true, data: { sink: { piece: null } } }, P), sinkHolds({ ok: false }, P)], [P, false, null]);
});

test('EMBERS-OWED: while a sale is owed, the same sale is not paid again - the Panoply\'s week, the insignia\'s piece - until her next open settles it', async () => {
  const pack = [stack(60)];
  await owePanoply(pack);
  let asked = 0;
  const buy = async () => { asked++; return { ok: true, data: { ok: true, piece: EG_PANOPLY_IDS[0], week: W } }; };
  assert.deepEqual(await panoplySale(EG_PANOPLY_IDS[0], { items: pack, save: () => {}, mint: panoplyPieceById, held: unheard, buy }), { ok: false, error: 'unheard' });
  assert.deepEqual([asked, count(pack)], [0, 40], 'nothing asked, nothing taken');
  const offer = INSIGNIA.find((o) => o.kind === 'aura');
  const other = INSIGNIA.find((o) => o.kind === 'title');
  _resetOwed();
  const ip = [stack(200)];
  await insigniaSale(offer, { items: ip, save: () => {}, held: unheard, buy: lostBuy });
  assert.deepEqual(await insigniaSale(offer, { items: ip, save: () => {}, held: unheard, buy: async () => { asked++; return { ok: true, data: { insignia: [offer.id] } }; } }), { ok: false, error: 'unheard' });
  assert.equal(asked, 0);
  const r = await insigniaSale(other, { items: ip, save: () => {}, held: unheard, buy: async (id) => ({ ok: true, data: { insignia: [id] } }) });
  assert.equal(r.ok, true, 'another insignia sells');
});

test('EMBERS-OWED: the owed list rides the save, each row whole', async () => {
  await owePanoply([stack(20)]);
  const rec = modSaveRecords()[BROKER_OWED_VENDOR];
  assert.deepEqual(rec, [{ kind: 'panoply', id: P, embers: EG_SINK_EMBERS, week: W, clock: false }]);
  _resetOwed();
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: rec });
  assert.deepEqual(brokerOwed(), rec);
  assert.deepEqual(validOwed([{ kind: 'gold', id: 'x', embers: 5, week: 1, clock: false }, { kind: 'panoply', id: P, embers: -1, week: 1, clock: false }, { kind: 'panoply', id: P, embers: 20, week: 1 }, null]), []);
  assert.equal(validOwed(new Array(40).fill(rec[0])).length, OWED_MAX);
});

test('EMBERS-OWED: the host door (world.js) - the report\'s case over the real Worker: the sale lands, its answer and the question after are lost, the embers are owed - and the Broker\'s next open hands the piece', async (t) => {
  const NOW0 = ARENA_SEASON_EPOCH_S + 9 * ARENA_WEEK_S + 86_400;
  t.mock.method(Date, 'now', () => NOW0 * 1000);
  const S = await standService({ MARKS_OPEN: 'on' });
  const raw = S.env.DB._raw;
  const me = await S.registered('Punch');
  for (let i = 0; i < 52; i++) raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(3001 + i, me.id, 'sethrakul', 4, me.character, 0, `e${i}`, NOW0, 1);
  const door = accountEg({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, me) });
  const down = accountEg({ fetch: async (u, i) => { await S.fetch(u, i); throw new TypeError('Failed to fetch'); }, storage: sessionStorageOf(SESSION_KEY, me) });
  const entity = { items: [stack(52)] };
  let saved = 0;
  const owed = brokerOwedDoor(entity, { changed: () => { saved++; } }, panoplyPieceById);
  const week = (await owed.panoply(door.keys)).data.sink.week;   // the window opens: the week heard
  const r = await panoplySale(P, { items: entity.items, buy: (p) => down.sink(p), held: async (p) => sinkHolds(await down.keys(), p), mint: panoplyPieceById, save: () => { saved++; }, week });
  assert.deepEqual([r.error, count(entity.items), saved], ['unheard', 32, 1], 'the sale went through the service, the embers stay out');
  assert.equal(Number(raw.prepare('SELECT insignia_spent FROM players WHERE id = ?').get(me.id).insignia_spent), EG_SINK_EMBERS, 'the account was charged');
  const a = await owed.panoply(door.keys);   // the next open
  assert.equal(a.data.sink.piece, P);
  assert.deepEqual([brokerOwed(), count(entity.items), entity.items.some((it) => it.name === panoplyPieceById(P).name), saved], [[], 32, true, 2], 'the piece, and the pack\'s 32 the account\'s too');
  // the host wires exactly this door
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const brokerOwed = brokerOwedDoor\(playerEntity, saveSoon, panoplyPieceById\);/);
  assert.match(w, /const r = await brokerOwed\.insignia\(readAccount, io\); if \(r\.ok\) insigniaAdopt\(r\.data\?\.wardrobe\);/);
  assert.match(w, /load: async \(\) => \{ try \{ const a = await brokerOwed\.panoply\(_accountEg\.keys\); if \(a\?\.ok\) _panoplySink = a\.data\?\.sink \?\? null; \}/);
  assert.match(w, /held: async \(p\) => sinkHolds\(await _accountEg\.keys\(\), p\), week: _panoplySink\?\.week \?\? null,/);
  assert.equal((w.match(/r\.error === 'unheard' \? brokerOwedText\(\)/g) ?? []).length, 2, 'both sales say it');
});
