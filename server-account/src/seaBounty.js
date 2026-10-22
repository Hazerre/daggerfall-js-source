// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-BOUNTY) - A FREEPORT'S BOUNTY BOARD ON THE OPEN SEA'S KILLERS, the service's half. The law is both
// ends' (src/net/sea/seaBountyLaw.js); the tables migrations/0144_sea_bounty.sql's.
//
//   THE KILL (seaKillSteps): a fall the relay refereed in a room of the open sea (its receipt's `m` - src/net/wire.js
//     seaRoomOf) at another player's hand, written in the fall's OWN batch (wild.js wildFall) - so once, by its remains'
//     id, whichever tab brings it first: every bounty standing on the fallen is claimed by it, and their sum owed to the
//     killer's character (the receipt's `kc`). A receipt of an older relay names neither the room nor the character, and
//     is no kill at sea.
//   BOARD (/v1/sea/bounty/board): the wanted captains - a kill at sea within SEA_WANTED_DAYS, or a bounty standing - by
//     their bounty, then their kills; the gold owed the asking character, and the bounty on its own head.
//   POST (/v1/sea/bounty/post): gold off the poster's record (payFromSave, the wallet's own order - and `outbound`: a held
//     record hands no value to another player) onto a wanted captain's head, in one batch with its row; a request asked
//     twice is one post.
//   COLLECT (/v1/sea/bounty/collect): every owed sum of the asking character's paid into its record (creditSave, the
//     region's bank as a market's gold is) and turned paid, in one batch - each row exactly once (mustChange).
//
// GOLD IS NEVER MADE HERE: an owed sum is the posts its fall claimed, and a post left its poster's record in its own
// batch. Not a DFU member: Daggerfall Unity has no players to hunt.
// ═══════════════════════════════════════════════════════════════════
import { realmActFirst, prepareRealmRecord, mustChange, dropIfUnnamed, recordMovedOf, dropObjects } from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realm/realmGoldLaw.js';
import { regionOk } from '../../src/net/nodeLaw.js';
import { seaRoomOf } from '../../src/net/wire.js';
import { REALM_CHARACTER_RE } from '../../src/net/identityToken.js';
import { SEA_WANTED_DAYS, SEA_BOARD_MAX, SEA_BOUNTY_RID_RE, seaBountyGoldOk } from '../../src/net/sea/seaBountyLaw.js';

const DAY_S = 86_400;
/** The most owed sums one collect pays (a captain owed more collects again). */
export const SEA_COLLECT_ROWS = 64;
/** A post's id: twenty hex digits from the service's own randomness. */
const postIdOf = (rand) => { const b = new Uint8Array(10); rand(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** The gold standing on a captain's head. */
const standing = async (db, target) => Number((await db.prepare('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE target_char = ?1 AND claimed_r IS NULL').bind(target).first())?.n ?? 0);

/**
 * THE KILL AT SEA - the steps for a fall's own batch (wild.js wildFall), or none: `claims` the fall's verified receipt
 * (`{ r, f, c, k, kc, m }`), `nowS` the service's clock. A fall at another's hand, in a room of the open sea, with both
 * characters named: every bounty standing on the fallen claimed by it (only while no kill of this fall is written - a
 * fall asked again claims nothing), the kill written once, and the sum claimed owed to the killer's character.
 * @param {any} db @param {any} claims @param {number} nowS
 */
export function seaKillSteps(db, claims, nowS) {
  const { r, f, c, k, kc, m } = claims ?? {};
  if (!k || !c || typeof kc !== 'string' || !REALM_CHARACTER_RE.test(kc) || !seaRoomOf(m)) return [];
  return [
    db.prepare('UPDATE sea_bounties SET claimed_r = ?1 WHERE target_char = ?2 AND claimed_r IS NULL AND NOT EXISTS (SELECT 1 FROM sea_kills WHERE r = ?1)').bind(r, c),
    db.prepare('INSERT OR IGNORE INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(r, k, kc, f, c, nowS),
    db.prepare('INSERT OR IGNORE INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at) SELECT ?1, ?2, ?3, ?4, SUM(gold), ?5 FROM sea_bounties WHERE claimed_r = ?1 HAVING SUM(gold) > 0')
      .bind(r, k, kc, c, nowS),
  ];
}

/**
 * BOARD: `{ character? }` - `{ wanted: [{ char, name, kills, bounty }], owed, mine }`: the wanted captains (a kill at sea
 * within SEA_WANTED_DAYS, or a bounty standing; a living character), the largest bounty first, then the most kills, at
 * most SEA_BOARD_MAX; the gold owed the asking character and the bounty on its own head (0 without one).
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyBoard(ctx, player, body) {
  const { db, nowS } = ctx;
  const since = nowS - SEA_WANTED_DAYS * DAY_S;
  const rows = await db.prepare(`SELECT w.ch AS ch, rc.name AS name, COALESCE(k.n, 0) AS kills, COALESCE(b.gold, 0) AS bounty FROM (
      SELECT killer_char AS ch FROM sea_kills WHERE at >= ?1 UNION SELECT target_char FROM sea_bounties WHERE claimed_r IS NULL
    ) w
    JOIN realm_characters rc ON rc.id = w.ch AND rc.dead_at IS NULL
    LEFT JOIN (SELECT killer_char, COUNT(*) AS n FROM sea_kills WHERE at >= ?1 GROUP BY killer_char) k ON k.killer_char = w.ch
    LEFT JOIN (SELECT target_char, SUM(gold) AS gold FROM sea_bounties WHERE claimed_r IS NULL GROUP BY target_char) b ON b.target_char = w.ch
    ORDER BY bounty DESC, kills DESC, rc.name LIMIT ?2`).bind(since, SEA_BOARD_MAX).all();
  const character = typeof body?.character === 'string' && REALM_CHARACTER_RE.test(body.character) ? body.character : null;
  const owed = character ? Number((await db.prepare('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounty_owed WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL').bind(player.id, character).first())?.n ?? 0) : 0;
  return {
    wanted: (rows.results ?? []).map((x) => ({ char: x.ch, name: x.name, kills: Number(x.kills), bounty: Number(x.bounty) })),
    owed, mine: character ? await standing(db, character) : 0,
  };
}

/**
 * POST: `{ character, realm, region, target, gold, rid }` - `gold` (SEA_BOUNTY_MIN to SEA_BOUNTY_MAX) off the realm
 * character's record onto wanted captain `target`'s head. Answers `{ ok, id, gold, bounty, realm: { seq } }` - `bounty` the
 * gold standing on that head now; a request asked again answers its post again (`repeat`), no gold moving twice.
 * Refused: 'sea-bounty-realm' (no realm character), 'bad-rid', 'bad-region', 'sea-bounty-gold', 'sea-bounty-target',
 * 'sea-bounty-self' (one's own head, or another character of one's own account), 'sea-bounty-not-wanted', 'realm-gold'.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyPost(ctx, player, { character, realm = null, region, target, gold, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, first
  if (side.error) return side;
  if (!side.at) return { error: 'sea-bounty-realm' };
  if (typeof rid !== 'string' || !SEA_BOUNTY_RID_RE.test(rid)) return { error: 'bad-rid' };
  const prior = await db.prepare('SELECT id, target_char, gold FROM sea_bounties WHERE poster = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return { ok: true, repeat: true, id: prior.id, gold: Number(prior.gold), bounty: await standing(db, prior.target_char) };
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!seaBountyGoldOk(gold)) return { error: 'sea-bounty-gold' };
  if (typeof target !== 'string' || !REALM_CHARACTER_RE.test(target)) return { error: 'sea-bounty-target' };
  const wanted = await db.prepare(`SELECT player FROM realm_characters WHERE id = ?1 AND dead_at IS NULL AND (
      EXISTS (SELECT 1 FROM sea_kills WHERE killer_char = ?1 AND at >= ?2) OR EXISTS (SELECT 1 FROM sea_bounties WHERE target_char = ?1 AND claimed_r IS NULL))`)
    .bind(target, nowS - SEA_WANTED_DAYS * DAY_S).first();
  if (!wanted) return { error: 'sea-bounty-not-wanted' };
  if (wanted.player === player.id) return { error: 'sea-bounty-self' };   // a head of one's own account: a bounty one's own hand could collect
  const id = postIdOf(rand);
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, gold, region) ? null : 'realm-gold'), { outbound: true });
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('INSERT INTO sea_bounties (id, poster, poster_char, rid, target_char, gold, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(id, player.id, character, rid, target, gold, nowS),
    ]);
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'sea-bounty-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, id, gold, bounty: await standing(db, target), realm: { seq: prep.seq } };
}

/**
 * COLLECT: `{ character, realm, region }` - every sum owed the realm character (the oldest SEA_COLLECT_ROWS) paid into its
 * record (the bank of `region`, as a market's gold is collected) and turned paid, in one batch. Answers `{ ok, gold,
 * realm: { seq } }`; nothing owed answers `{ ok, gold: 0 }` and moves nothing.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyCollect(ctx, player, { character, realm = null, region } = {}) {
  const { db, nowS } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'sea-bounty-realm' };
  if (!regionOk(region)) return { error: 'bad-region' };
  const rows = (await db.prepare('SELECT r, gold FROM sea_bounty_owed WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL ORDER BY at, r LIMIT ?3').bind(player.id, character, SEA_COLLECT_ROWS).all()).results ?? [];
  const gold = rows.reduce((n, x) => n + Number(x.gold), 0);
  if (!rows.length || !(gold > 0)) return { ok: true, gold: 0 };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (creditSave(save, gold, { bank: region }) ? null : 'bad-gold'));
  if (prep.error) return prep;
  const rs = rows.map((x) => x.r);
  const settle = db.prepare(`UPDATE sea_bounty_owed SET paid_at = ?3 WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL AND r IN (${rs.map((_, i) => `?${i + 4}`).join(', ')})`)
    .bind(player.id, character, nowS, ...rs);
  try {
    await db.batch([...prep.steps, settle, mustChange(db, rs.length)]);   // every row this collect read, once - another collect that landed first fails it whole
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'sea-bounty-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, gold, realm: { seq: prep.seq } };
}
