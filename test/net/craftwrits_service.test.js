// CRAFT-WRITS (2026-10-22) - THE GUILDS' ASKS OF A CRAFTER, AS THE SERVICE KEEPS THEM: a realm character's three writs a
// UTC day posted on its first board read (/v1/writs/list's `crafts`), and a writ filled (/v1/writs/craft) - a potion writ
// by the character's own WITNESSED brews (a cauldron of loose units is none) and the bottles out of its realm record, a
// dish or kit writ by pieces of its own unsold make, their rows gone; the pay struck as a `craft-writ` mint, the XP to the
// craft's track, the Renown to the character, the guild's standing on its Roll; the account's three a day. Driven through
// the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Professions-Arc.md section 49.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { renownRate } from '../../src/net/renown.js';
import { layRecord, seatRealm } from '../realmSeat.mjs';
import { craftWritsFor, craftWritOf, writPotionKey, CRAFT_WRITS_PER_DAY } from '../../src/net/craftWritLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';
import { HALL_WRIT_REP } from '../../src/net/npcChapterLaw.js';
import { DIVINES, GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { deliverCraftWrit } from '../../server-account/src/craftWrits.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `cw-${String(++_rid).padStart(8, '0')}`;
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
const BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];
const bottles = (product, n, extra = {}) => ({ group: 'UselessItems1', templateIndex: BOTTLE, potionRecipeKey: writPotionKey(product), stackCount: n, value: 50, ...extra });

async function stand(env = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', CHAPTERS_OPEN: 'on', ...env });
  const raw = s.env.DB._raw;
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xp, _now);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const record = (who) => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj)));
  /** the pack the record holds, laid over its save (the client's checkpoint after its brews and crafts) */
  const pack = (who, items) => layRecord(s.env, who.character, { ...record(who), items });
  const board = async (who) => {
    const r = await s.call('/v1/writs/list', { character: who.character, region: 17 }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.crafts;
  };
  /** a writ of the day's turned to `product` (its count, pay, XP and Renown the law's) - the day's dice are the law's own pin */
  const aim = (who, slot, product, qty = undefined) => {
    const w = craftWritOf(product, qty);
    raw.prepare('UPDATE craft_writs SET product = ?, tier = ?, faction = ?, qty = ?, pay = ?, xp = ?, renown = ?, track = ? WHERE owner = ? AND slot = ? AND day = ?')
      .run(w.product, w.tier, w.faction, w.qty, w.pay, w.xp, w.renown, w.track, who.character, slot, utcDay(_now));
    return { ...w, id: `k:${utcDay(_now)}:${who.character}:${slot}` };
  };
  const brew = async (who, potion, keys) => {
    for (const k of keys) give(who, k, 'own', 1);
    const r = await s.call('/v1/prof/brew', { character: who.character, potion, keys, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const cook = async (who, recipe) => {
    for (const { key, n } of recipeById(recipe).inputs) give(who, key, 'own', n);
    const r = await s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: who.handle, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces.map((p) => p.provenance);
  };
  const deliver = (who, id, extra = {}) => s.call('/v1/writs/craft', { character: who.character, id, rid: rid(), realm: who.at(), ...extra }, who.secret);
  return { ...s, raw, give, xpOf, setXp, balance, record, pack, board, aim, brew, cook, deliver };
}

// ─── THE BOARD ───────────────────────────────────────────────────────

test('CRAFT-WRITS service: a realm character\'s first board read of the day posts its three - the law\'s own draw at its ranks (a potion, a dish, a second potion where it has never smithed); read again, the same three and nothing written; another account sees none of them; a character that is not the account\'s posts nothing (mutants: the ranks unread; the slot\'s draw)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, 'provisioning', xpForRank(30));
  const first = await s.board(mac);
  const day = utcDay(_now);
  const law = craftWritsFor(day, mac.character, { provisioning: 30, smithing: 0, smithed: false });
  assert.deepEqual(first.writs.map((w) => [w.id, w.product, w.qty, w.pay, w.xp, w.renown, w.track, w.faction, w.state]),
    law.map((w) => [`k:${day}:${mac.character}:${w.slot}`, w.product, w.qty, w.pay, w.xp, w.renown, w.track, w.faction, 'open']));
  assert.deepEqual(first.writs.map((w) => w.kind), ['potion', 'dish', 'potion']);
  assert.deepEqual(first.today, { filled: 0, max: CRAFT_WRITS_PER_DAY });
  assert.deepEqual([first.writs[0].brewed, first.writs[1].pieces], [0, []], 'nothing brewed, nothing cooked');
  assert.deepEqual((await s.board(mac)).writs.map((w) => w.id), first.writs.map((w) => w.id), 'the same three');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs').get().n, 3);
  // a character that has smithed is asked a kit third
  s.setXp(mac, 'smithing', xpForRank(25));
  s.raw.prepare('DELETE FROM craft_writs').run();
  const smith = await s.board(mac);
  assert.equal(smith.writs[2].kind, 'kit');
  assert.deepEqual(smith.writs[2].product, craftWritsFor(day, mac.character, { provisioning: 30, smithing: 25, smithed: true })[2].product);
  // another account: its own character's, never Mac's - and a character id that is not its own posts nothing
  const ann = await s.seated('Ann');
  assert.ok((await s.board(ann)).writs.every((w) => w.id.includes(ann.character)));
  const r = await s.call('/v1/writs/list', { character: mac.character, region: 17 }, ann.secret);
  assert.deepEqual([r.status, r.body.crafts?.writs], [200, []]);
  // a character of Mac's no board has read yet, asked by Ann: nothing posted under either account
  const R2 = await seatRealm(s.env, mac.secret, 'Mac Two');
  const asked = await s.call('/v1/writs/list', { character: R2.id, region: 17 }, ann.secret);
  assert.deepEqual([asked.status, asked.body.crafts?.writs, s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE owner = ?').get(R2.id).n], [200, [], 0]);
});

// ─── A POTION WRIT ───────────────────────────────────────────────────

test('CRAFT-WRITS service: a potion writ filled - two Novice brews of Healing (two potions each, witnessed whole), its four bottles out of the realm record (the plain before the Potent, a stack giving part of itself), the pay struck as a `craft-writ` mint, twice it to Provisioning, the Renown at the rate, the Temple of Stendarr\'s standing on the Roll, the record one on; asked again, its row; the brews it took are taken (mutants: the brews uncounted; the pay\'s line; the XP\'s track; the Roll\'s faction)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  assert.equal(w.qty, 4);
  // the Roll keeps the Temple of Stendarr for this character (CHAP1's row), at 10
  s.raw.prepare('INSERT INTO npc_roll_heads (char_id, player, cap, seq, tag, seeded_at, updated_at) VALUES (?, ?, 0, 1, ?, ?, ?)').run(mac.character, mac.id, 'seed', _now, _now);
  s.raw.prepare('INSERT INTO npc_roll (char_id, player, faction_id, rep, owed, member) VALUES (?, ?, ?, 10, 0, 0)').run(mac.character, mac.id, DIVINES.Stendarr);
  // nothing brewed: refused, nothing moved
  s.pack(mac, [bottles('potion:healing', 4), { templateIndex: 1, name: 'Torch' }]);
  const none = await s.deliver(mac, w.id);
  assert.deepEqual([none.status, none.body], [409, { error: 'craft-unbrewed' }], 'looted bottles: no brew stands behind them');
  assert.deepEqual([mac.at().seq, s.record(mac).items.length, s.balance(mac)], [1, 2, 0], 'the record untouched');
  const b1 = await s.brew(mac, 'healing', HEALING);
  const b2 = await s.brew(mac, 'healing', HEALING);
  assert.deepEqual([b1.count, b2.count], [2, 2]);
  assert.deepEqual(s.raw.prepare('SELECT witnessed FROM prof_brews WHERE char_id = ?').all(mac.character).map((r) => r.witnessed), [1, 1], 'no loose unit: witnessed whole');
  assert.equal((await s.board(mac)).writs[0].brewed, 4);
  s.pack(mac, [bottles('potion:healing', 3, { potent: 25 }), { templateIndex: 1, name: 'Torch' }, bottles('potion:healing', 2)]);
  const xp0 = s.xpOf(mac, 'provisioning');
  const ok = await s.deliver(mac, w.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, ok.body.xp, ok.body.writ.state, ok.body.today, ok.body.realm, ok.body.renown.credited], [w.pay, w.xp, 'mine', { filled: 1, max: 3 }, { seq: 2 }, renownRate(2 * w.pay)]);
  assert.deepEqual([s.balance(mac), ok.body.balance, s.xpOf(mac, 'provisioning') - xp0, ok.body.track.profession], [w.pay, w.pay, w.xp, 'provisioning']);
  assert.deepEqual(s.raw.prepare("SELECT kind, amount, src_kind, dst_id, rid FROM marks_ledger WHERE kind = 'craft-writ'").all().map((r) => ({ ...r })),
    [{ kind: 'craft-writ', amount: w.pay, src_kind: 'mint', dst_id: mac.id, rid: `craft:${w.id}` }]);
  const rec = s.record(mac);
  assert.deepEqual(rec.items.map((it) => [it.name ?? 'bottle', it.stackCount ?? 1, it.potent ?? 0]), [['bottle', 1, 25], ['Torch', 1, 0]], 'the two plain and two of the Potent three gone');
  assert.equal(Number(s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(mac.character, DIVINES.Stendarr).rep), 10 + HALL_WRIT_REP);
  const again = await s.call('/v1/writs/craft', { character: mac.character, id: w.id, rid: `cw-${String(_rid).padStart(8, '0')}`, realm: mac.at() }, mac.secret);
  assert.deepEqual([again.status, again.body.repeat, again.body.pay, s.balance(mac)], [200, true, w.pay, w.pay], 'its row\'s answer, nothing struck twice');
  assert.equal((await s.board(mac)).writs[0].state, 'mine');
  // the four brews are spent: another Healing writ tomorrow asks brews of its own
  _now += DAY;
  await s.board(mac);
  const w2 = s.aim(mac, 0, 'potion:healing');
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w2.id)).body, { error: 'craft-unbrewed' }, 'yesterday\'s four went to yesterday\'s writ');
});

test('CRAFT-WRITS service: a cauldron that spent a LOOSE unit (the pack\'s, never the service\'s) is no witness - its potions fill nothing; brews without the bottles in the record are refused craft-goods-gone and nothing moves; a writ of another character, of yesterday, or with no record named is refused (mutants: the loose clause; the record\'s take)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  s.give(mac, 'p1:16', 'loose', 1);
  await s.brew(mac, 'healing', HEALING);
  await s.brew(mac, 'healing', HEALING);
  assert.deepEqual(s.raw.prepare('SELECT witnessed FROM prof_brews WHERE char_id = ? ORDER BY at, rid').all(mac.character).map((r) => r.witnessed).sort(), [0, 1], 'the first spent the loose Red Berries; the second none');
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w.id)).body, { error: 'craft-unbrewed' }, 'two witnessed of four');
  await s.brew(mac, 'healing', HEALING);
  s.pack(mac, [bottles('potion:healing', 3)]);
  const gone = await s.deliver(mac, w.id);
  assert.deepEqual([gone.status, gone.body, mac.at().seq, s.balance(mac)], [409, { error: 'craft-goods-gone' }, 1, 0], 'three bottles of four: nothing out, nothing struck');
  assert.deepEqual(Object.values(await s.call('/v1/writs/craft', { character: mac.character, id: w.id, rid: rid() }, mac.secret)), [400, { error: 'realm-needed' }]);
  // a character that is no realm character at all (the router's seat asks first; the act's own door holds too)
  const row = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  assert.deepEqual(await deliverCraftWrit({ db: s.env.DB, nowS: _now, rand: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)), bucket: s.env.SAVES }, row, { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' }, { character: 'char-mac1', id: w.id, rid: rid() }), { error: 'realm-needed' });
  const ann = await s.seated('Ann');
  assert.deepEqual((await s.call('/v1/writs/craft', { character: ann.character, id: w.id, rid: rid(), realm: ann.at() }, ann.secret)).body, { error: 'no-writ' });
  _now += DAY;
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w.id)).body, { error: 'writ-expired' });  // the character deleted: its open writs go with it
  await s.board(ann);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE owner = ? AND filled_at IS NULL').get(ann.character).n, 3);
  const del = await s.call('/v1/realm/delete', { id: ann.character }, ann.secret);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE owner = ?').get(ann.character).n, 0);
});

// ─── A DISH OR KIT WRIT ──────────────────────────────────────────────

test('CRAFT-WRITS service: a dish writ filled by three servings of the character\'s own cooking - their rows gone with them, each out of the record by its provenance; a piece another character made, one listed, or one too few refused craft-pieces (mutants: the maker\'s character; the listing guard; the rows\' delete)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 1, 'dish:stew');
  assert.deepEqual([w.qty, w.faction, w.track], [3, GUILD_FACTION_IDS.FightersGuild, 'provisioning']);
  const pvs = [...await s.cook(mac, 'stew:north'), ...await s.cook(mac, 'stew:south'), ...await s.cook(mac, 'stew:north')];
  const dish = (pv, recipe = 'stew:north') => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe, name: 'Hunter\'s Stew' });
  s.pack(mac, [dish(pvs[0]), dish(pvs[1], 'stew:south'), dish(pvs[2]), { templateIndex: 1, name: 'Torch' }]);
  assert.deepEqual((await s.board(mac)).writs[1].pieces, pvs, 'the three of its make, oldest first');
  assert.deepEqual((await s.deliver(mac, w.id, { pieces: pvs.slice(0, 2) })).body, { error: 'craft-pieces' }, 'two of three');
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(pvs[2]);
  const listed = await s.deliver(mac, w.id, { pieces: pvs });
  assert.deepEqual([listed.body, mac.at().seq], [{ error: 'craft-pieces' }, 1], 'one on the market');
  s.raw.prepare('UPDATE products SET listed = 0, char_id = ? WHERE provenance = ?').run('r00000000000000000000', pvs[2]);
  assert.deepEqual((await s.deliver(mac, w.id, { pieces: pvs })).body, { error: 'craft-pieces' }, 'another character\'s make');
  s.raw.prepare('UPDATE products SET char_id = ? WHERE provenance = ?').run(mac.character, pvs[2]);
  const ok = await s.deliver(mac, w.id, { pieces: pvs });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, s.balance(mac), pvs.map((pv) => s.raw.prepare('SELECT 1 FROM products WHERE provenance = ?').get(pv) ?? null)], [w.pay, w.pay, [null, null, null]]);
  assert.deepEqual(s.record(mac).items.map((it) => it.name), ['Torch']);
});

test('CRAFT-WRITS service: a kit writ\'s XP is Smithing\'s; the account fills three a day across its characters (craft-writ-cap), and a balance with no room is refused marks-full (mutants: the day\'s count; the cap\'s room)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, 'smithing', xpForRank(10));
  await s.board(mac);
  const kit = s.aim(mac, 2, 'kit:iron');
  const kits = [];
  for (let i = 0; i < kit.qty; i++) {
    for (const { key, n } of recipeById('kit:iron').inputs) s.give(mac, key, 'own', n);
    const r = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'kit:iron', clean: false, name: 'Mac', rid: rid() }, mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    kits.push(r.body.pieces[0].provenance);
  }
  s.pack(mac, kits.map((pv) => ({ group: 'UselessItems2', templateIndex: 692, provenance: pv, recipe: 'kit:iron', name: 'Iron Repair Kit' })));
  const smith0 = s.xpOf(mac, 'smithing');
  const ok = await s.deliver(mac, kit.id, { pieces: kits });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.track.profession, s.xpOf(mac, 'smithing') - smith0], ['smithing', kit.xp]);
  // two more filled by hand today; the fourth - the account's second character's own writ - is refused
  s.raw.prepare("UPDATE craft_writs SET filled_at = ?, rid = 'byhand' || slot, n = 'x' WHERE owner = ? AND slot IN (0, 1)").run(_now, mac.character);
  const R2 = await seatRealm(s.env, mac.secret, 'Mac Two');   // the account takes up another character: it holds the lease now
  const two = { ...mac, character: R2.id, at: R2.at };
  await s.board(two);
  const w2 = s.aim(two, 0, 'potion:healing');
  await s.brew(two, 'healing', HEALING);
  await s.brew(two, 'healing', HEALING);
  s.pack(two, [bottles('potion:healing', 4)]);
  const capped = await s.deliver(two, w2.id);
  assert.deepEqual([capped.status, capped.body, two.at().seq], [409, { error: 'craft-writ-cap' }, 1], 'three today on the account: nothing out of the record');
  _now += DAY;
  await s.board(two);
  const w3 = s.aim(two, 0, 'potion:healing');
  assert.equal((await s.deliver(two, w3.id)).status, 200, 'the next day: its own three again (yesterday\'s brews stand behind it)');
  // marks-full: a balance at the cap
  _now += DAY;
  await s.board(two);
  const w4 = s.aim(two, 0, 'potion:healing');
  await s.brew(two, 'healing', HEALING);
  await s.brew(two, 'healing', HEALING);
  s.pack(two, [bottles('potion:healing', 4)]);
  s.raw.prepare('UPDATE marks SET balance = ? WHERE account = ?').run(10_000_000, mac.id);
  assert.deepEqual((await s.deliver(two, w4.id)).body, { error: 'marks-full' });
});
