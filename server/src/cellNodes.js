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
import { readTree, L0_TREE, nodeOf, isNodeRoom, levelOf, nodeAt } from '../../src/net/cellTree.js';
import { isCellRoom, cellOfRoom, layerOf, CLOSE_SAME_ROOM, HALO_OF_PARAM } from './relay.js';
import { layerWalk, ROOM_CALL_MS } from './relayScale.js';

/** The directory's object - a name wire.js roomOf can never give, so no page reaches it. */
export const CELL_DIRECTORY = '#cells';
/** The directory's door: the tree, as JSON. */
export const CELL_INTERNAL_TREE = '/internal/cells/tree';
/** Where the directory keeps its tree. Nothing writes it while the tree is fixed at L0 (COST-2's first drop). */
export const CELL_TREE_KEY = 'celltree';
/** How long an isolate keeps the tree it was told, and how long it waits to ask again after an ask that failed. */
export const CELL_TREE_KEEP_MS = 30_000;
export const CELL_TREE_RETRY_MS = 5_000;
/** The header the Worker tells an object its node by - never the page's word (it is set whatever the page sent). */
export const NODE_HEADER = 'x-df-node';

const json = (/** @type {any} */ o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

/** The isolate's copy of the tree: `{ tree, at }` when one was read, the time of the last failed ask. */
let kept = /** @type {{ tree: any, at: number } | null} */ (null);
let failedAt = -Infinity;
/** The pins' door to the isolate's copy. */
export const cellTreeCache = { get: () => kept, reset: () => { kept = null; failedAt = -Infinity; } };

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
export const cellNodeOf = (tree, key) => (tree && nodeOf(tree, key)) || key;

/** A socket the Worker opens and closes at once, CLOSE_SAME_ROOM - the page's halo is its own room. */
export function sameRoomAnswer() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.close(CLOSE_SAME_ROOM, 'same room');
  return new Response(null, { status: 101, webSocket: client });
}

/**
 * THE WORKER'S DOOR TO A CELL (`key` a fine cell's): its node found, a halo of the page's own node answered
 * CLOSE_SAME_ROOM, and the request walked through the node's layers with the node named.
 * @param {any} env @param {string} key @param {URL} url @param {Request} request
 */
export async function cellDoor(env, key, url, request) {
  const tree = await cellTreeOf(env);
  const node = cellNodeOf(tree, key);
  const of = url.searchParams.get(HALO_OF_PARAM);
  if (of && of !== key && isCellRoom(of) && cellNodeOf(tree, of) === node) return sameRoomAnswer();
  const headers = { ...Object.fromEntries(request.headers), [NODE_HEADER]: node };   // a Headers lower-cases its names, as NODE_HEADER is
  return layerWalk(env.ROOMS, node, new Request(request, { headers }), layerOf(url.searchParams.get('ly')));
}

/** THE DIRECTORY'S DOOR: its tree - L0_TREE while it holds none (or one it cannot read). Kept for the instance's life
 *  once read: only the directory itself changes it. @param {any} room the directory's Room (index.js) */
export async function cellTreeInternal(room) {
  room._cellTree ??= readTree(await room.state.storage.get(CELL_TREE_KEY)) ?? L0_TREE;
  return json(room._cellTree);
}

/** An object told its node (NODE_HEADER) for a socket of fine cell `key` - kept when it names a node that holds that
 *  cell, so a header that does not fit is never believed. @param {any} room @param {Request} request @param {string} key */
export function nodeHeard(room, request, key) {
  const n = request.headers.get(NODE_HEADER);
  const c = cellOfRoom(key);
  if (!c || !n || !isNodeRoom(n)) return;
  const L = /** @type {number} */ (levelOf(n));
  if (nodeAt(L, c[0], c[1]) === n) room._node = n;
}

/** The node level a room's metrics point carries (relayScale.js RoomMetrics blob11): its node's, or '' for a room that
 *  was never told one this instance life (no cell, or woken by its alarm alone). @param {any} room */
export const cellLevelOf = (room) => (room._node ? String(levelOf(room._node)) : '');
