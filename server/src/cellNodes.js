// @ts-check
// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2) - THE CELL DIRECTORY AND THE WORKER'S DOOR TO A CELL.
// A page asks for its 16-pixel cell (`/room/world:<cx>,<cy>`); the Worker asks the directory - one object, named
// CELL_DIRECTORY, a name no page can ask for (wire.js roomOf takes no `#`) - for the tree (net/cellTree.js), keeps it for
// CELL_TREE_KEEP_MS in its isolate, and hands the page's request to the NODE that holds the cell: the node's own name is
// the object's (its layers after it, as SCALE5d walks them), the page's request is passed on unchanged, so the socket's
// key is still its fine cell, and the object is told its node (NODE_HEADER). A halo whose node is its page's own
// (`?of=`, wire.js HALO_OF_PARAM) is answered with a socket closed CLOSE_SAME_ROOM - that object already hears it.
//
// THE DIRECTORY FAILS SAFE TO THE LAST TREE THIS ISOLATE SAW, and to the fine key only when it never saw one: once the
// tree is seeded coarse (COST-2's second drop) the fine key is no longer today's behaviour - it would stand a player
// alone in a fine object no one else in its node is in - so a tree once seen outlives a directory that stops answering.
// A failed ask is not repeated for CELL_TREE_RETRY_MS, so a directory down costs one deadline an isolate, not one a page.
//
// Here, not in index.js: the entrypoint's every named export is read as an entrypoint (relayScale.js's law).
import { readTree, L0_TREE, seedTree, cellSeedOf, isL0Tree, leafOf, isNodeRoom, isCoarseNode, nodeLevelOf, nodeAt, coversCell, cellsOfNode } from '../../src/net/cellTree.js';
import { relayCfgValue } from '../../src/net/relayCfg.js';
import { isCellRoom, cellOfRoom, layerOf, layerName, LAYER_HEADER, CLOSE_SAME_ROOM, HALO_OF_PARAM, HALO_OF_MAX } from './relay.js';
import { layerWalk, ROOM_CALL_MS } from './relayScale.js';

/** The directory's object - a name wire.js roomOf can never give, so no page reaches it. */
export const CELL_DIRECTORY = '#cells';
/** The directory's door: the tree, as JSON. */
export const CELL_INTERNAL_TREE = '/internal/cells/tree';
/** Where the directory keeps its tree - seeded the first time `cellSeed` is on, moved by cellMoves.js since. */
export const CELL_TREE_KEY = 'celltree';
/** How long an isolate keeps the tree it was told, and how long it waits to ask again after an ask that failed. */
export const CELL_TREE_KEEP_MS = 30_000;
export const CELL_TREE_RETRY_MS = 5_000;
/** The header the Worker tells an object its node by - never the page's word (it is set whatever the page sent). */
export const NODE_HEADER = 'x-df-node';
/** COST-2 part two: the Worker's word that the tree moves (it is not L0_TREE), so the object tells the directory its count
 *  (cellMoves.js) - never the page's word. */
export const CELL_TELL_HEADER = 'x-df-cells-tell';
/** COST-2 part two: a node a move closed answers a socket or a call naming a cell 503 with this header: the tree its
 *  caller holds is older than the move (cellMoves.js). */
export const MOVED_HEADER = 'x-df-moved';

const json = (/** @type {any} */ o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

/** The isolate's copy of the tree: `{ tree, at }` when one was read, the time of the last failed ask. */
let kept = /** @type {{ tree: any, at: number } | null} */ (null);
let failedAt = -Infinity;
/** The pins' door to the isolate's copy - and `stale`, COST-2 part two's: a node said "moved", so the copy is older than
 *  the directory's tree. It is asked again at once and KEPT as the fallback, part one's law: a directory down still
 *  leaves the last tree seen, never the fine key. */
export const cellTreeCache = { get: () => kept, reset: () => { kept = null; failedAt = -Infinity; }, stale: () => { if (kept) kept.at = -Infinity; failedAt = -Infinity; } };

/**
 * THE TREE, as this isolate knows it: its copy while fresh; else the directory's answer within ROOM_CALL_MS; else, after
 * a failed ask, the last tree it saw (null - the fine key - if it never saw one), asked again CELL_TREE_RETRY_MS on.
 * @param {any} env @param {number} [now]
 */
export async function cellTreeOf(env, now = Date.now()) {
  if (kept && now - kept.at < CELL_TREE_KEEP_MS) return kept.tree;
  if (now - failedAt < CELL_TREE_RETRY_MS) return kept?.tree ?? null;
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(CELL_DIRECTORY));
    const res = await stub.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TREE}`, { signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    const tree = res.ok ? readTree(await res.json()) : null;
    if (tree) { kept = { tree, at: now }; return tree; }
  } catch { /* the last tree seen, below */ }
  failedAt = now;
  return kept?.tree ?? null;
}

/** The node a fine cell's key is in under `tree` - the key itself with no tree. @param {any} tree @param {string} key */
export const cellNodeOf = (tree, key) => (tree && leafOf(tree, key)) || key;

/** A socket the Worker opens and closes at once, CLOSE_SAME_ROOM - the page's halo is its own room. */
export function sameRoomAnswer() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.close(CLOSE_SAME_ROOM, 'same room');
  return new Response(null, { status: 101, webSocket: client });
}

/** Is `res` a node's "moved" (MOVED_HEADER) - the tree that named it is older than its move? @param {Response} res */
const movedAnswer = (res) => res.status === 503 && res.headers.get(MOVED_HEADER) === '1';

/**
 * THE WORKER'S DOOR TO A CELL (`key` a fine cell's): its node found, a halo of the page's own node answered
 * CLOSE_SAME_ROOM, and the request walked through the node's layers with the node named - and told whether the tree
 * moves (CELL_TELL_HEADER). COST-2 part two: a node that answers "moved" sends the Worker to the directory again, and
 * the request is walked once more under the tree it answers.
 * @param {any} env @param {string} key @param {URL} url @param {Request} request
 */
export async function cellDoor(env, key, url, request) {
  for (let tries = 0; ; tries++) {
    const tree = await cellTreeOf(env);
    const node = cellNodeOf(tree, key);
    // the rooms the page holds already (`?of=`, its own first) - a halo whose node one of them is in is that room's object
    const held = String(url.searchParams.get(HALO_OF_PARAM) ?? '').split(';').slice(0, HALO_OF_MAX).filter((k) => k !== key && isCellRoom(k));
    if (held.some((k) => cellNodeOf(tree, k) === node)) return sameRoomAnswer();
    const headers = { ...Object.fromEntries(request.headers), [NODE_HEADER]: node, [CELL_TELL_HEADER]: tree && !isL0Tree(tree) ? '1' : '' };   // a Headers lower-cases its names, as these are
    const res = await layerWalk(env.ROOMS, node, new Request(request, { headers }), layerOf(url.searchParams.get('ly')));
    if (tries || !movedAnswer(res)) return res;
    cellTreeCache.stale();
  }
}

/**
 * COST-2 part two: A CALL BETWEEN ROOMS THAT NAMES A CELL (the park registry's drop, a staff event's call) - posted to
 * the object of the node that holds fine cell `cell` now (its layer `ly`), under this isolate's tree as the Worker's
 * door walks it, and once more under the directory's answer when that node says "moved". Null with no ROOMS binding.
 * @param {any} env @param {string} cell @param {number} ly @param {string} path @param {unknown} body @param {number} [ms]
 */
export async function cellCall(env, cell, ly, path, body, ms = ROOM_CALL_MS) {
  const rooms = env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return null;
  for (let tries = 0; ; tries++) {
    const tree = await cellTreeOf(env);
    const headers = { [CELL_TELL_HEADER]: tree && !isL0Tree(tree) ? '1' : '' };   // a node answers "moved" only to a caller in a moving tree
    const res = await rooms.get(rooms.idFromName(layerName(cellNodeOf(tree, cell), ly))).fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body), headers, signal: AbortSignal.timeout(ms) }));
    if (tries || !movedAnswer(res)) return res;
    cellTreeCache.stale();
  }
}

/**
 * THE DIRECTORY'S TREE: L0_TREE while the `cellSeed` setting is off (net/relayCfg.js - off unset, and off is the way
 * back); else the tree it stores, seeded at that level the first time it holds none it can read (net/cellTree.js
 * seedTree), and moved by cellMoves.js since. A stored tree outlives a setting turned off and on again. The hub's
 * settings are asked as a ground room's door asks them (index.js _groundRefusal): awaited before this instance's first
 * answer, beside it after. @param {any} room the directory's Room (index.js) @param {number} [now]
 */
export async function directoryTree(room, now = Date.now()) {
  if (room._relayCfgAt === -Infinity) await room._relayCfgFresh(now);
  else void room._relayCfgFresh(now);
  const seed = cellSeedOf(relayCfgValue(await room._relayCfgOf(), room.env, 'cellSeed')) ?? 0;
  if (!seed) return L0_TREE;
  if (room._cellTree === undefined) room._cellTree = readTree(await room.state.storage.get(CELL_TREE_KEY));
  if (!room._cellTree) { room._cellTree = seedTree(seed); await room.state.storage.put(CELL_TREE_KEY, room._cellTree); }
  return room._cellTree;
}
/** THE DIRECTORY'S DOOR: its tree, as JSON. @param {any} room the directory's Room (index.js) */
export async function cellTreeInternal(room) {
  return json(await directoryTree(room));
}

/** An object told its node (NODE_HEADER) for a socket of fine cell `key` - kept when it names a node that holds that
 *  cell, so a header that does not fit is never believed. Answers the node when it is COARSE (the socket's attachment
 *  keeps it, `nd`, so a woken object still knows what each socket covers), else null.
 *  @param {any} room @param {Request} request @param {string} key */
export function nodeHeard(room, request, key) {
  const n = request.headers.get(NODE_HEADER);
  const c = cellOfRoom(key);
  if (!c || !n || !isNodeRoom(n)) return null;
  const L = /** @type {number} */ (nodeLevelOf(n));
  if (nodeAt(L, c[0], c[1]) !== n) return null;
  room._node = n;
  room._cellTell = request.headers.get(CELL_TELL_HEADER) === '1';   // COST-2 part two: the tree moves - this object tells its count (cellMoves.js)
  room._cellLy = layerOf(request.headers.get(LAYER_HEADER));
  return L > 0 ? n : null;
}

/** COST-2 part two: THE NODE THIS OBJECT IS - the one the Worker told it at an upgrade, or, for an instance woken by a
 *  frame (the runtime tells a hibernated object nothing at its wake), the coarse node a socket's attachment keeps
 *  (`nd`), read once an instance. A coarse node stands only in a tree that moves, so one read back tells its count
 *  again (cellMoves.js cellTell). Null for none. @param {any} room */
export function nodeOfRoom(room) {
  if (room._node == null && !room._nodeRead) {
    room._nodeRead = true;
    for (const [, a] of room._all?.() ?? []) if (isCoarseNode(a?.nd)) { room._node = a.nd; room._cellTell = true; room._cellLy = a.ly | 0; break; }
  }
  return room._node ?? null;
}
/** The node level a room's metrics point carries (relayScale.js RoomMetrics blob11): its node's, or '' for a room that
 *  was never told one this instance life (no cell; or a fine cell woken by a frame or its alarm alone - a coarse node
 *  reads its own back, nodeOfRoom). @param {any} room */
export const cellLevelOf = (room) => { const n = nodeOfRoom(room); return n ? String(nodeLevelOf(n)) : ''; };

/** COST-2 (b): A SOCKET'S COVER - its coarse node (`nd`, kept on its attachment) or its own room's key. Every cell-scoped
 *  law reads it (net/cellTree.js coversCell): a word whose pixel's cell, a grant whose `q`, a park whose anchor, a
 *  ledger row whose pixel, stands in the room when the cover covers it. At L0 the cover is the room itself.
 *  @param {any} a a socket's attachment */
export const coverOf = (a) => a?.nd ?? a?.key;
/** Does socket `a`'s cover cover cell `cell`? @param {any} a @param {unknown} cell */
export const inCover = (a, cell) => coversCell(coverOf(a), cell);
/** A park word's law of its room (index.js, the `park` arm): `cover` a cell socket's cover, null for a place that is no
 *  cell - a cell holds a team whose anchor's cell it covers, a place one that names no cell. @param {unknown} cover @param {unknown} cell */
export const atCover = (cover, cell) => (cover == null ? cell == null : coversCell(cover, cell));
/** A cell's welcome's `cells` field - the fine cells the socket covers, `[x0, y0, x1, y1]` - for a cell's socket, '' for
 *  any other room. @param {any} a */
export const cellsWelcome = (a) => (isCellRoom(a?.key) ? `,"cells":${JSON.stringify(cellsOfNode(coverOf(a)))}` : '');
