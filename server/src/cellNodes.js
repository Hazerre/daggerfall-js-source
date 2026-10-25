// @ts-check
// THE CELL DIRECTORY AND THE WORKER'S DOOR TO A CELL (bible/11-Multiplayer/Scale-Arc.md, COST-2).
//
// A page asks for its 16-pixel cell (`/room/world:<cx>,<cy>`). The Worker asks the directory for the cell tree
// (net/cellTree.js) - the directory is one object, named CELL_DIRECTORY, a name no page can ask for because wire.js
// roomOf takes no `#` - and keeps the tree for CELL_TREE_KEEP_MS in its isolate. It then hands the page's request,
// unchanged, to the NODE that holds the cell: the object is named after the node (its layers after it, walked as any
// crowded place's are), the socket's key is still the fine cell, and the object is told its node (NODE_HEADER). A halo
// whose node is a room the page already holds (`?of=`, wire.js HALO_OF_PARAM) is answered with a socket closed
// CLOSE_SAME_ROOM, because that object already hears the page.
//
// The Worker falls back to the last tree its isolate saw, and to the fine key only when it never saw one. Once the tree
// is seeded coarse the fine key is no longer a safe default - it would stand a player alone in a fine object no one else
// in its node is in - so a tree once seen outlives a directory that stops answering. A failed ask is not repeated for
// CELL_TREE_RETRY_MS, so a directory that is down costs each isolate one deadline, not each page.
//
// This lives outside index.js because every named export of the entrypoint is read as an entrypoint (relayScale.js).
import { readTree, L0_TREE, leafOf, isNodeRoom, nodeLevelOf, nodeAt, coversCell, cellsOfNode } from '../../src/net/cellTree.js';
import { isCellRoom, cellOfRoom, layerOf, CLOSE_SAME_ROOM, HALO_OF_PARAM, HALO_OF_MAX } from './relay.js';
import { layerWalk, ROOM_CALL_MS } from './relayScale.js';

/**
 * The fields the cell modules keep on a Room (index.js). A Room is the runtime's object, so they are set where they are
 * first known rather than in its constructor; this is their one declaration.
 * @typedef {object} CellRoomFields
 * @property {string | undefined} _node - the node this object is (cellTree.js key), told at an upgrade
 * @property {import('../../src/net/cellTree.js').CellTree | undefined} _cellTree - the directory's tree, read once an
 *   instance
 */

/** The directory's object - a name wire.js roomOf can never give, so no page reaches it. */
export const CELL_DIRECTORY = '#cells';
/** The directory's door: the tree, as JSON. */
export const CELL_INTERNAL_TREE = '/internal/cells/tree';
/** Where the directory keeps its tree. Nothing writes it while the tree is fixed at L0. */
export const CELL_TREE_KEY = 'celltree';
/** How long an isolate keeps the tree it was told, and how long it waits to ask again after an ask that failed. */
export const CELL_TREE_KEEP_MS = 30_000;
export const CELL_TREE_RETRY_MS = 5_000;
/** The header the Worker tells an object its node by - never the page's word (it is set whatever the page sent). */
export const NODE_HEADER = 'x-df-node';

const json = (/** @type {any} */ body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The isolate's copy of the tree, `{ tree, at }` once one was read; and when the last ask failed. */
let isolateCopy = /** @type {{ tree: any, at: number } | null} */ (null);
let failedAt = -Infinity;
/** The isolate's copy, for the pins. */
export const cellTreeCache = {
  get: () => isolateCopy,
  reset: () => {
    isolateCopy = null;
    failedAt = -Infinity;
  },
};

/**
 * THE TREE, as this isolate knows it: its copy while fresh; else the directory's answer within ROOM_CALL_MS; else, after
 * a failed ask, the last tree it saw (null - the fine key - if it never saw one), asked again CELL_TREE_RETRY_MS on.
 * @param {any} env @param {number} [now]
 */
export async function cellTreeOf(env, now = Date.now()) {
  if (isolateCopy && now - isolateCopy.at < CELL_TREE_KEEP_MS) return isolateCopy.tree;
  if (now - failedAt < CELL_TREE_RETRY_MS) return isolateCopy?.tree ?? null;
  try {
    const directory = env.ROOMS.get(env.ROOMS.idFromName(CELL_DIRECTORY));
    const response = await directory.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TREE}`, { signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    const tree = response.ok ? readTree(await response.json()) : null;
    if (tree) {
      isolateCopy = { tree, at: now };
      return tree;
    }
  } catch {
    // an ask that throws is a failed ask, like an answer that cannot be read: the last tree seen, below
  }
  failedAt = now;
  return isolateCopy?.tree ?? null;
}

/** The node a fine cell's key is in under `tree` - the key itself with no tree. @param {any} tree @param {string} key */
export const cellNodeOf = (tree, key) => (tree && leafOf(tree, key)) || key;

/** A socket the Worker opens and closes at once, CLOSE_SAME_ROOM: a browser sees no HTTP status on a refused upgrade,
 *  so the close code is how the page learns its halo is its own room. */
export function sameRoomAnswer() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.close(CLOSE_SAME_ROOM, 'same room');
  return new Response(null, { status: 101, webSocket: client });
}

/**
 * THE WORKER'S DOOR TO A CELL (`key` a fine cell's): its node found, a halo of a room the page holds answered
 * CLOSE_SAME_ROOM, and the request walked through the node's layers with the node named.
 * @param {any} env @param {string} key @param {URL} url @param {Request} request
 */
export async function cellDoor(env, key, url, request) {
  const tree = await cellTreeOf(env);
  const node = cellNodeOf(tree, key);
  // the rooms the page holds already (`?of=`, its own first): a halo whose node one of them is in is that room's object
  const held = String(url.searchParams.get(HALO_OF_PARAM) ?? '').split(';').slice(0, HALO_OF_MAX).filter((room) => room !== key && isCellRoom(room));
  if (held.some((room) => cellNodeOf(tree, room) === node)) return sameRoomAnswer();
  // A Headers lower-cases its names, as NODE_HEADER is, so the Worker's word overwrites whatever the page sent under it.
  const headers = { ...Object.fromEntries(request.headers), [NODE_HEADER]: node };
  return layerWalk(env.ROOMS, node, new Request(request, { headers }), layerOf(url.searchParams.get('ly')));
}

/** THE DIRECTORY'S DOOR: its tree - L0_TREE while it holds none (or one it cannot read). Kept for the instance's life
 *  once read: only the directory itself changes it. @param {any} room the directory's Room (index.js) */
export async function cellTreeInternal(room) {
  room._cellTree ??= readTree(await room.state.storage.get(CELL_TREE_KEY)) ?? L0_TREE;
  return json(room._cellTree);
}

/** An object told its node (NODE_HEADER) for a socket of fine cell `key` keeps it only when it names a node that holds
 *  that cell, so a header that does not fit is never believed. Answers the node when it is COARSE - the socket's
 *  attachment keeps it (`nd`), so a woken object still knows what each socket covers - else null.
 *  @param {any} room @param {Request} request @param {string} key */
export function nodeHeard(room, request, key) {
  const node = request.headers.get(NODE_HEADER);
  const cell = cellOfRoom(key);
  if (!cell || !node || !isNodeRoom(node)) return null;
  const level = /** @type {number} */ (nodeLevelOf(node));
  if (nodeAt(level, cell[0], cell[1]) !== node) return null;
  room._node = node;
  return level > 0 ? node : null;
}

/** The node level a room's metrics point carries (relayScale.js RoomMetrics blob11): its node's, or '' for a room that
 *  was never told one this instance life (no cell, or woken by its alarm alone). @param {any} room */
export const cellLevelOf = (room) => (room._node ? String(nodeLevelOf(room._node)) : '');

/** A SOCKET'S COVER - its coarse node (`nd`, kept on its attachment) or its own room's key. Every cell-scoped law reads
 *  it (net/cellTree.js coversCell): a word by its pixel's cell, a grant by its `q`, a park by its anchor and a ledger
 *  row by its pixel stand in the room when the cover covers them. At L0 the cover is the room itself.
 *  @param {any} attachment a socket's attachment */
export const coverOf = (attachment) => attachment?.nd ?? attachment?.key;
/** Does a socket's cover cover cell `cell`? @param {any} attachment @param {unknown} cell */
export const inCover = (attachment, cell) => coversCell(coverOf(attachment), cell);
/** THE COVER GUARD, one home for every word that names its cell (the relay's arms in index.js, staffEvents.js): a
 *  frame naming a cell outside the socket's cover is junk, as a frame naming another room was before the tree.
 *  Returns true when the frame was junked, so the caller returns.
 *  @param {{ _junk: (ws: any) => void }} room @param {any} ws @param {any} attachment the socket's @param {unknown} cell
 *  @returns {boolean} */
export function junkOutsideCover(room, ws, attachment, cell) {
  if (inCover(attachment, cell)) return false;
  room._junk(ws);
  return true;
}
/** A park word's law of its room (index.js, the `park` arm): `cover` is a cell socket's cover, or null for a place that
 *  is no cell. A cell holds a team whose anchor's cell it covers; a place holds one that names no cell.
 *  @param {unknown} cover @param {unknown} cell */
export const atCover = (cover, cell) => (cover == null ? cell == null : coversCell(cover, cell));
/** A cell's welcome's `cells` field - the fine cells the socket covers, `[x0, y0, x1, y1]` - for a cell's socket, and ''
 *  for any other room. @param {any} attachment */
export const cellsWelcome = (attachment) => (isCellRoom(attachment?.key) ? `,"cells":${JSON.stringify(cellsOfNode(coverOf(attachment)))}` : '');
