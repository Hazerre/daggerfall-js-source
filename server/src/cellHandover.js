// @ts-check
// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2) - A NODE'S ROWS HANDED OVER. When the cell tree moves (a
// node split into its four children, or four siblings merged into their parent - COST-2's second drop), what the
// departing node stores goes to the nodes that hold it now, by pixel (net/cellTree.js partitionRows), before the tree
// is committed and its sockets are closed. Every key a node can hold is CLASSED:
//   part  - pixel-addressed, partitioned by the receiving nodes' squares: the parked teams (`park:`) and the overworld
//           ledger (`ow:led` - its spent ids, its dungeons' rows, its searched graves);
//   copy  - per-place config, copied to every receiver: the relay's settings, the room's bans and freezes;
//   drop  - swept at every drain and made again at the next hello: ids' looks and secrets, the old hello bucket;
//   block - everything else, an unknown key included: a live fight, a debt owed an account, a raid, a star, a serpent,
//           the wild's remains. A node holding any key that blocks is not repartitioned - so the tree can only move
//           where the handover is whole, and a store this file does not know stops it rather than being lost.
// The receiver takes rows IDEMPOTENTLY by their own keys (a park by its key, the newest; a ledger entry by its id, row
// or grave key), so a handover asked again after a partial failure leaves every receiver as one would.
//
// Here, not in index.js: the entrypoint's every named export is read as an entrypoint (relayScale.js's law).
import { partitionRows, nodeBounds } from '../../src/net/cellTree.js';
import { owLedgerOf, owIdPixel, owPrune, owGraveKey, owRowKey } from '../../src/net/overworldLaw.js';
import { OW_LEDGER_KEY, parkSpotOf, mapPixelOfWire, SWEEP_PAGE } from './relay.js';
import { ROOM_CALL_MS } from './relayScale.js';
import { FREEZES_KEY } from './staffFreeze.js';

/** The receiving node's door. */
export const CELL_INTERNAL_TAKE = '/internal/cells/take';
/** The payload's shape. */
export const HANDOVER_V = 1;
/** Every key class, `[key or prefix (ending ':'), class, what it is]`; any key matching none blocks. */
export const KEY_CLASSES = Object.freeze([
  ['park:', 'part', 'a parked team - by its spot'],
  [OW_LEDGER_KEY, 'part', 'the overworld ledger - its spent ids, dungeons and graves, each by its pixel'],
  ['relaycfg', 'copy', 'the relay\'s settings, as the hub said them'],
  ['bans', 'copy', 'the room\'s bans'],
  [FREEZES_KEY, 'copy', 'the room\'s freezes'],
  ['look:', 'drop', 'an id\'s look - swept at the drain, said again at its hello'],
  ['secret:', 'drop', 'an id\'s secret - swept at the drain, said again at its hello'],
  ['hellos', 'drop', 'a relay before SCALE2b\'s hello bucket'],
].map((e) => Object.freeze(e)));
/** A key's class - 'part', 'copy', 'drop', or 'block' for any key no entry names. @param {string} key */
export const keyClass = (key) => {
  for (const [p, c] of KEY_CLASSES) if (p.endsWith(':') ? key.startsWith(p) : key === p) return c;
  return 'block';
};

/** The keys of a node's storage that block a handover, `max` at most - every key listed, a page at a time.
 *  @param {any} storage @param {number} [max] */
export async function blockersOf(storage, max = 8) {
  const out = [];
  let after = null;
  for (;;) {
    const page = await storage.list({ limit: SWEEP_PAGE, ...(after ? { startAfter: after } : {}) });
    for (const k of page.keys()) { if (keyClass(k) === 'block') { out.push(k); if (out.length >= max) return out; } after = k; }
    if (page.size < SWEEP_PAGE) return out;
  }
}

/** A park record's map pixel - its spot (natives) on the map. @param {any} rec @returns {[number, number] | null} */
export const parkPixel = (rec) => { const s = parkSpotOf(rec?.r); return s && Number.isFinite(s[0]) && Number.isFinite(s[1]) ? /** @type {[number, number]} */ (mapPixelOfWire(s[0], s[1])) : null; };

/**
 * THE PARTITION OF A NODE'S ROWS among `targets` (node keys whose squares tile one square - a node's four children, or
 * the one parent), each row by its pixel CLAMPED INTO that square: a ledger row may stand up to OW_CELL_MARGIN_PX past
 * its cell (a band met at the seam), so a pixel outside goes to the nearest target, never nowhere. Rows with no pixel at
 * all (a record a law no longer reads) are left out. Pure.
 * @param {{ parks: Array<[string, any]>, led: any, copy: Record<string, unknown> }} rows @param {string[]} targets
 */
export function handoverPayloads(rows, targets) {
  const sq = targets.map(nodeBounds).reduce((a, b) => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : null));
  if (!sq) throw new Error('handover: a target that is no node');
  const clamp = (/** @type {[number, number] | null} */ p) => (p ? /** @type {[number, number]} */ ([Math.min(Math.max(p[0], sq.x0), sq.x1 - 1), Math.min(Math.max(p[1], sq.y0), sq.y1 - 1)]) : null);
  const parks = partitionRows(rows.parks, ([, rec]) => clamp(parkPixel(rec)), targets).by;
  const sp = partitionRows(rows.led.sp, (e) => { const p = owIdPixel(e[0]); return clamp(p ? [p.x, p.y] : null); }, targets).by;
  const dg = partitionRows(Object.values(rows.led.dg), (r) => clamp([r[0], r[1]]), targets).by;
  const gr = partitionRows(Object.values(rows.led.gr ?? {}), (g) => clamp([g[0], g[1]]), targets).by;
  return new Map(targets.map((t) => [t, { v: HANDOVER_V, parks: parks.get(t), sp: sp.get(t), dg: dg.get(t), gr: gr.get(t), copy: rows.copy }]));
}

/** A POST to the node `target`'s take door, inside ROOM_CALL_MS - production's `post` for handOver. @param {any} env */
export const roomPost = (env) => async (/** @type {string} */ target, /** @type {any} */ payload) => {
  const res = await env.ROOMS.get(env.ROOMS.idFromName(target)).fetch(new Request(`https://relay.internal${CELL_INTERNAL_TAKE}`, { method: 'POST', body: JSON.stringify(payload), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
  return res.ok;
};

/**
 * THE HANDOVER: the departing node `room`'s rows posted to `targets` (each asked again once on a miss), and only when
 * every target took its part are the handed rows let go here. A node holding a key that blocks hands nothing.
 * Answers `{ ok, blocked?, failed?, sent? }`.
 * @param {any} room the departing Room (index.js) @param {string[]} targets
 * @param {(target: string, payload: any) => Promise<boolean>} post @param {number} [now]
 */
export async function handOver(room, targets, post, now = Date.now()) {
  const st = room.state.storage;
  const blocked = await blockersOf(st);
  if (blocked.length) return { ok: false, blocked };
  const parks = [...(await st.list({ prefix: 'park:' }))];
  const led = owLedgerOf(await st.get(OW_LEDGER_KEY));
  owPrune(led, now);
  const copy = /** @type {Record<string, unknown>} */ ({});
  for (const [k, c] of KEY_CLASSES) if (c === 'copy') { const v = await st.get(k); if (v !== undefined) copy[k] = v; }
  const payloads = handoverPayloads({ parks, led, copy }, targets);
  const once = async (/** @type {string} */ t) => { try { return await post(t, payloads.get(t)); } catch { return false; } };
  const failed = [];
  for (const t of targets) if (!(await once(t)) && !(await once(t))) failed.push(t);
  if (failed.length) return { ok: false, failed };
  const handed = parks.map(([k]) => k);
  for (let i = 0; i < handed.length; i += 128) await st.delete(handed.slice(i, i + 128));
  await st.delete(OW_LEDGER_KEY);
  room._parks = null;   // the instance's kept copies, read again on their next use
  room._owLoad = null;
  return { ok: true, sent: Object.fromEntries([...payloads].map(([t, p]) => [t, p.parks.length + p.sp.length + p.dg.length + p.gr.length])) };
}

/**
 * THE RECEIVING SIDE: a handover's payload taken into `room` - a park kept where none stands under its key or it is the
 * newer, the ledger's entries merged by their own keys (the later end of a spent id, the newer sighting of a dungeon,
 * a grave once) through the room's own ledger (index.js _owLedger, _owWrite, so the instance's copy stays its storage's),
 * a config key copied where the room holds none. Answers how many rows it took.
 * @param {any} room @param {any} payload @param {number} [now]
 */
export async function takeHandover(room, payload, now = Date.now()) {
  if (!payload || payload.v !== HANDOVER_V) return null;
  const st = room.state.storage;
  let n = 0;
  const kept = room._parks ? await room._parks : null;
  for (const e of Array.isArray(payload.parks) ? payload.parks : []) {
    const [k, rec] = Array.isArray(e) ? e : [];
    if (typeof k !== 'string' || keyClass(k) !== 'part' || !k.startsWith('park:') || typeof rec?.k !== 'string') continue;
    const had = await st.get(k);
    if (had && (had.at ?? 0) >= (rec.at ?? 0)) continue;
    await st.put(k, rec);
    kept?.set(k, rec);
    n++;
  }
  const led = await room._owLedger(now);
  const ends = new Map(led.sp.map((/** @type {[string, number]} */ e) => [e[0], e[1]]));
  for (const e of Array.isArray(payload.sp) ? payload.sp : []) if (Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]) && !(ends.get(e[0]) >= e[1])) { ends.set(e[0], e[1]); n++; }
  const dg = { ...led.dg };
  for (const r of Array.isArray(payload.dg) ? payload.dg : []) { if (!Array.isArray(r)) continue; const k = owRowKey(r[0], r[1]); if (!(dg[k]?.[2] >= r[2])) { dg[k] = r; n++; } }
  const gr = { ...(led.gr ?? {}) };
  for (const g of Array.isArray(payload.gr) ? payload.gr : []) { if (!Array.isArray(g)) continue; const k = owGraveKey(g); if (!gr[k]) { gr[k] = g; n++; } }
  const merged = owLedgerOf({ sp: [...ends].sort((a, b) => a[1] - b[1]), dg, gr });   // its law's bounds and sanity, the newest kept
  owPrune(merged, now);
  Object.assign(led, merged);   // the instance's own ledger object, so a word that lands next reads the merge
  await room._owWrite(led);
  for (const [k, v] of Object.entries(payload.copy && typeof payload.copy === 'object' ? payload.copy : {})) {
    if (keyClass(k) === 'copy' && (await st.get(k)) === undefined) await st.put(k, v);
  }
  return n;
}

/** The take's door (CELL_INTERNAL_TAKE): a payload posted by a departing node. @param {any} room @param {Request} request */
export async function cellTakeInternal(room, request) {
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  const n = await takeHandover(room, body);
  return new Response(JSON.stringify(n == null ? { error: 'not a handover' } : { ok: true, n }), { status: n == null ? 400 : 200, headers: { 'content-type': 'application/json' } });
}
