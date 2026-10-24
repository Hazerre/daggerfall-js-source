// @ts-check
// DECOR-ACCESS: who may open one container or one station. The owner always may.
// A guest's word that they are a friend or a guildmate is never read. Guild is the roster.
// Chosen friends are account names the owner sent, resolved here to the account, and stored.
// A shared container's goods live in decor_bin, not in two saves at once.
import { accountKind, displayName } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { DECOR_ID_RE } from '../../src/net/decorLaw.js';
import { OWNS } from './decor.js';
import { dropIfUnnamed, dropObjects, getRealmBlob, mustChange, prepareRealmRecord, realmSideOf, realmSaveTextOf, REALM_ID_RE } from './realm.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import { ITEM_UID_RE } from '../../src/systems/item/itemLaw.js';

const KINDS = new Set(['storage', 'station']);
const MODES = new Set(['private', 'guild', 'chosen_friends']);
const FRIENDS_MAX = 24;

const homeOf = (db, mapId, buildingKey) => db.prepare('SELECT player, char_id, guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();

function owns(db, mapId, buildingKey, player, character) {
  return db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
}

async function pieceKind(db, mapId, buildingKey, id, kind) {
  const row = await db.prepare('SELECT place FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND yard = 0').bind(mapId, buildingKey, id).first();
  if (!row) return null;
  let place = null;
  try { place = JSON.parse(row.place); } catch { return null; }
  if (kind === 'storage' && !place?.storage) return null;
  if (kind === 'station' && !place?.station) return null;
  return place;
}

/** Whether this account may use the piece. The owner always may. No row is private. */
export async function decorMay(ctx, player, body) {
  const { db } = ctx;
  const { mapId, buildingKey, character, id, kind } = body ?? {};
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id) || !KINDS.has(kind)) return { error: 'bad-decor' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character) || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const mine = await db.prepare('SELECT 1 AS ok FROM realm_characters WHERE id = ? AND player = ?').bind(character, player.id).first();
  if (!mine) return { error: 'realm-only' };
  const home = await homeOf(db, mapId, buildingKey);
  if (!home || home.guild_id != null) return { error: 'no-home' };
  if (home.player === player.id) return { ok: true, owner: true };
  const row = await db.prepare('SELECT mode, friends FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ? AND kind = ?').bind(mapId, buildingKey, id, kind).first();
  if (!row || row.mode === 'private') return { error: 'decor-shut' };
  if (row.mode === 'guild') {
    const hit = await db.prepare(`SELECT 1 AS ok FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
      WHERE a.player = ? AND a.char_id = ? AND b.player = ? AND b.char_id = ?`).bind(home.player, home.char_id, player.id, character).first();
    return hit ? { ok: true } : { error: 'decor-shut' };
  }
  let ids = [];
  try { ids = JSON.parse(row.friends); } catch { ids = []; }
  return Array.isArray(ids) && ids.includes(player.id) ? { ok: true } : { error: 'decor-shut' };
}

async function namesOf(db, ids) {
  const names = [];
  for (const id of ids) {
    const row = await db.prepare('SELECT handle, guest_name FROM players WHERE id = ?').bind(id).first();
    if (row) names.push(displayName(row));
  }
  return names;
}

/** The owner sets one piece's access. Names are usernames. The answer names them back and never an account id. */
export async function setDecorAccess(ctx, player, body) {
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, id, kind, mode } = body ?? {};
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id) || !KINDS.has(kind) || !MODES.has(mode)) return { error: 'bad-decor' };
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  if (!(await pieceKind(db, mapId, buildingKey, id, kind))) return { error: 'no-decor' };
  if (!(await owns(db, mapId, buildingKey, player, character))?.owns) return { error: 'no-home' };
  if (mode === 'private') {
    await db.prepare('DELETE FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ? AND kind = ?').bind(mapId, buildingKey, id, kind).run();
    return { ok: true, mode, names: [] };
  }
  /** @type {string[]} */
  const ids = [];
  if (mode === 'chosen_friends') {
    const names = Array.isArray(body.names) ? body.names : null;
    if (!names || names.length > FRIENDS_MAX) return { error: 'bad-decor' };
    for (const name of names) {
      if (typeof name !== 'string' || !HANDLE_RE.test(name)) return { error: 'no-reader' };
      const who = await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ?').bind(name.toLowerCase()).first();
      if (!who?.handle || who.id === player.id) return { error: 'no-reader' };
      if (!ids.includes(who.id)) ids.push(who.id);
    }
  }
  await db.prepare(`INSERT INTO decor_access (map_id, building_key, piece_id, kind, mode, friends) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_id, building_key, piece_id, kind) DO UPDATE SET mode = excluded.mode, friends = excluded.friends`)
    .bind(mapId, buildingKey, id, kind, mode, JSON.stringify(ids)).run();
  if (kind === 'storage') await adoptBin(ctx, player, { mapId, buildingKey, character, id, realm: body.realm });
  return { ok: true, mode, names: await namesOf(db, ids), at: nowS };
}

/** Move the owner's save-held goods for this piece into the bin, once. A uid already there is not copied. */
async function adoptBin(ctx, player, { mapId, buildingKey, character, id, realm }) {
  const blob = await getRealmBlob(ctx, player.id, character);
  if (!blob.ok) return;
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { return; }
  const found = [];
  for (const scene of save?.sceneCache?.scenes ?? []) {
    const list = scene?.decorItems?.[id];
    if (Array.isArray(list)) found.push(...list);
  }
  const moving = found.filter((it) => typeof it?.uid === 'string' && ITEM_UID_RE.test(it.uid));
  if (!moving.length) return;
  const side = realmSideOf(character, realm);
  if (side.error) return;
  const uids = new Set(moving.map((it) => it.uid));
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    for (const scene of live?.sceneCache?.scenes ?? []) {
      const list = scene?.decorItems?.[id];
      if (!Array.isArray(list)) continue;
      scene.decorItems[id] = list.filter((it) => !uids.has(it?.uid));
      if (!scene.decorItems[id].length) delete scene.decorItems[id];
    }
    return null;
  });
  if (prep.error) return;
  const steps = [...prep.steps];
  for (const item of moving) {
    const uid = typeof item?.uid === 'string' && ITEM_UID_RE.test(item.uid) ? item.uid : null;
    if (!uid) continue;
    steps.push(ctx.db.prepare('INSERT OR IGNORE INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)')
      .bind(mapId, buildingKey, id, uid, JSON.stringify(item)));
  }
  try { await ctx.db.batch(steps); } catch {
    await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key);
    return;
  }
  await dropObjects(ctx.bucket, [prep.prev]);
}

async function decorGrants(ctx, player, body) {
  const { db } = ctx;
  const { mapId, buildingKey, character } = body ?? {};
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  const home = await homeOf(db, mapId, buildingKey);
  if (!home) return { error: 'no-home' };
  const { results = [] } = await db.prepare('SELECT piece_id, kind, mode, friends FROM decor_access WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  const storage = [];
  const station = [];
  const bin = [];
  const owner = home.player === player.id;
  let guild = false;
  if (!owner && typeof character === 'string') {
    const hit = await db.prepare(`SELECT 1 AS ok FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
      WHERE a.player = ? AND a.char_id = ? AND b.player = ? AND b.char_id = ?`).bind(home.player, home.char_id, player.id, character).first();
    guild = !!hit;
  }
  for (const row of results) {
    let ids = [];
    try { ids = JSON.parse(row.friends); } catch { ids = []; }
    const allowed = owner || (row.mode === 'guild' && guild) || (row.mode === 'chosen_friends' && Array.isArray(ids) && ids.includes(player.id));
    if (!allowed) continue;
    if (row.kind === 'storage') storage.push(row.piece_id);
    else station.push(row.piece_id);
  }
  if (owner) {
    const pieces = await db.prepare('SELECT id, place FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 0').bind(mapId, buildingKey).all();
    for (const row of pieces.results ?? []) {
      let place = null;
      try { place = JSON.parse(row.place); } catch { place = null; }
      if (place?.storage && !storage.includes(row.id)) storage.push(row.id);
      if (place?.station && !station.includes(row.id)) station.push(row.id);
    }
  }
  const held = await db.prepare('SELECT DISTINCT piece_id FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  for (const row of held.results ?? []) if (storage.includes(row.piece_id)) bin.push(row.piece_id);
  return { ok: true, storage, station, bin };
}

async function decorDeposit(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { mapId, buildingKey, character, id, item, realm } = body;
  if (!item || typeof item !== 'object' || !ITEM_UID_RE.test(item.uid)) return { error: 'bad-item' };
  const have = await ctx.db.prepare('SELECT 1 AS ok FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, item.uid).first();
  if (have) return { ok: true, repeat: true };
  const side = realmSideOf(character, realm);
  if (side.error) return side;
  const blob = await getRealmBlob(ctx, player.id, character);
  if (!blob.ok) return blob;
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { return { error: 'no-data' }; }
  const carried = (save.items ?? []).find((it) => it?.uid === item.uid);
  if (!carried) return { error: 'no-item' };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    const list = live.items;
    if (!Array.isArray(list)) return 'no-item';
    const at = list.findIndex((it) => it?.uid === item.uid);
    if (at < 0) return 'no-item';
    list.splice(at, 1);
    return null;
  });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').bind(mapId, buildingKey, id, carried.uid, JSON.stringify(carried)),
      mustChange(ctx.db),
    ]);
  } catch {
    const landed = await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key);
    if (landed) return { ok: true, repeat: true };
    return { error: 'decor-held' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, item: carried };
}

async function decorWithdraw(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { mapId, buildingKey, character, id, uid, realm } = body;
  if (!ITEM_UID_RE.test(uid)) return { error: 'bad-item' };
  const row = await ctx.db.prepare('SELECT item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, uid).first();
  if (!row) return { error: 'no-item' };
  let item = null;
  try { item = JSON.parse(row.item); } catch { return { error: 'no-item' }; }
  const side = realmSideOf(character, realm);
  if (side.error) return side;
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    if (!Array.isArray(live.items)) live.items = [];
    if (live.items.some((it) => it?.uid === uid)) return 'decor-held';
    live.items.push(item);
    return null;
  });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db.prepare('DELETE FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, uid),
      mustChange(ctx.db),
    ]);
  } catch {
    await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key);
    return { error: 'decor-held' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, item };
}

/** One door. `op` is set, grants, open, deposit, withdraw or craft. */
export async function decorUse(ctx, player, body = {}) {
  if (body.op === 'set') return setDecorAccess(ctx, player, body);
  if (body.op === 'grants') return decorGrants(ctx, player, body);
  if (body.op === 'deposit') return decorDeposit(ctx, player, body);
  if (body.op === 'withdraw') return decorWithdraw(ctx, player, body);
  if (body.op === 'list') {
    const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
    if (gate.error) return gate;
    const { results = [] } = await ctx.db.prepare('SELECT item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(body.mapId, body.buildingKey, body.id).all();
    const items = [];
    for (const row of results) { try { items.push(JSON.parse(row.item)); } catch { /* a torn row is not shown */ } }
    return { ok: true, items };
  }
  if (body.op === 'craft' || body.op === 'open') {
    const gate = await decorMay(ctx, player, { ...body, kind: body.op === 'craft' ? 'station' : body.kind });
    return gate.error ? gate : { ok: true };
  }
  return { error: 'bad-decor' };
}
