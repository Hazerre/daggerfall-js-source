// @ts-check
// COST-2 (2026-10-24, the owner: cells that size themselves to their players, not static bigger cells; bible/
// 11-Multiplayer/Scale-Arc.md COST-2) - THE CELL TREE: a quadtree over the open country's fixed grid. The page keeps
// computing its 16-pixel cell (wire.js worldRoom, cellHaloFor) exactly as before; the Worker maps that FINE key to the
// NODE that holds it - the object a cell's sockets share - and the node's own name is the object's name, never the
// socket's key (the layers' pattern: wire.js layerName). So a socket's every law (its cell's square, a grant's `q`, a
// ledger row's pixel) still reads its fine key, and only which object it shares changes.
//
//   L0  WORLD_CELL (16) pixels - today's cell, keyed `world:<cx>,<cy>` as it always was, so its stored rows stay valid
//   L1  32, L2 64, L3 128, L4 256 pixels - keyed `cell:<L>:<nx>,<ny>`, a name no page may ask for (the Worker refuses it)
//
// THE TREE is the set of nodes that are split, around a BASE level: a node above the base is split unless the tree has
// JOINED it, a node at or below the base (and above L0) is whole unless the tree has SPLIT it. A fine cell's node is
// found by walking down from its L4 node while the node it stands in is split. L0_TREE (base 0, nothing listed) splits
// every node down to L0: every fine key is its own node, today's partition exactly.
//
// Pure. In the relay's bundle and the pins'.
import { WORLD_CELL, cellOfRoom } from './wire.js';

/** The coarsest level - a 256-pixel node (the Bay, about 1,000 x 500 pixels, is some 4 x 2 of them). */
export const CELL_LEVEL_MAX = 4;
/** A level-`L` node's side, map pixels. @param {number} L */
export const nodeSize = (L) => WORLD_CELL * 2 ** L;
const NODE_RE = /^cell:([1-4]):(-?\d{1,3}),(-?\d{1,3})$/;
/** The level-`L` node (`nx`, `ny`)'s key - an L0 node is the fine cell's own `world:` key. */
export const cellNodeKey = (/** @type {number} */ L, /** @type {number} */ nx, /** @type {number} */ ny) => (L === 0 ? `world:${nx},${ny}` : `cell:${L}:${nx},${ny}`);
/** A node key read back - `{L, nx, ny}` - or null for a key that is no node. @param {unknown} key */
export function parseNode(key) {
  const c = cellOfRoom(key);
  if (c) return { L: 0, nx: c[0], ny: c[1] };
  const m = NODE_RE.exec(String(key ?? ''));
  return m ? { L: Number(m[1]), nx: Number(m[2]), ny: Number(m[3]) } : null;
}
/** Is `key` a node of the tree (a fine cell's key included)? @param {unknown} key */
export const isNodeRoom = (key) => parseNode(key) != null;
/** Is `key` a COARSE node (L1 and up) - a name only the Worker gives an object, never a page's room? @param {unknown} key */
export const isCoarseNode = (key) => NODE_RE.test(String(key ?? ''));
/** A node's level, or null for a key that is no node. @param {unknown} key */
export const nodeLevelOf = (key) => parseNode(key)?.L ?? null;
/** The level-`L` node holding fine cell (`cx`, `cy`). @param {number} L @param {number} cx @param {number} cy */
export const nodeAt = (L, cx, cy) => cellNodeKey(L, Math.floor(cx / 2 ** L), Math.floor(cy / 2 ** L));
/** A node's square, map pixels, `[x0, x1) x [y0, y1)`, or null. @param {unknown} key */
export function nodeBounds(key) {
  const n = parseNode(key);
  if (!n) return null;
  const s = nodeSize(n.L);
  return { x0: n.nx * s, y0: n.ny * s, x1: (n.nx + 1) * s, y1: (n.ny + 1) * s };
}
/** Does node `key` hold map pixel (`px`, `py`)? @param {unknown} key @param {number} px @param {number} py */
export const nodeHolds = (key, px, py) => { const b = nodeBounds(key); return !!b && Number.isFinite(px) && Number.isFinite(py) && px >= b.x0 && px < b.x1 && py >= b.y0 && py < b.y1; };
/** Does node `node` hold fine cell `cellKey`? An L0 node holds its own cell alone. @param {unknown} node @param {unknown} cellKey */
export function nodeHoldsCell(node, cellKey) {
  const n = parseNode(node), c = cellOfRoom(cellKey);
  return !!n && !!c && nodeAt(n.L, c[0], c[1]) === node;
}
/**
 * COST-2 (b): THE ONE LAW OF WHAT A SOCKET COVERS, both ends' - a socket's COVER is its node (a coarse node's key) or,
 * with none, its own room's key. A cell-scoped word, a grant's `q`, a park's anchor stands in that socket's room when its
 * cell is covered: the cover itself, or a fine cell its coarse node holds. Under L0 every cover is a fine cell, which
 * covers itself alone - today's law exactly. @param {unknown} cover @param {unknown} key
 */
export const coversCell = (cover, key) => typeof key === 'string' && (key === cover || (isCoarseNode(cover) && nodeHoldsCell(cover, key)));
/** A node's square in FINE CELLS, `[x0, y0, x1, y1]` half-open - what a welcome tells a page its socket covers. @param {unknown} key */
export function cellsOfNode(key) {
  const n = parseNode(key);
  if (!n) return null;
  const s = 2 ** n.L;
  return [n.nx * s, n.ny * s, (n.nx + 1) * s, (n.ny + 1) * s];
}
/** The node a welcome's `cells` name - an aligned square of 1 to 16 cells a side - or null for anything else. @param {unknown} cells */
export function nodeOfCells(cells) {
  if (!Array.isArray(cells) || cells.length !== 4 || !cells.every((v) => Number.isInteger(v))) return null;
  const [x0, y0, x1, y1] = /** @type {number[]} */ (cells);
  const s = x1 - x0, L = Math.log2(s);
  if (y1 - y0 !== s || !Number.isInteger(L) || L < 0 || L > CELL_LEVEL_MAX || x0 % s !== 0 || y0 % s !== 0) return null;
  const key = cellNodeKey(L, x0 / s, y0 / s);
  return parseNode(key) ? key : null;
}
/** A node's parent (null at the top). @param {unknown} key */
export function parentNode(key) {
  const n = parseNode(key);
  return n && n.L < CELL_LEVEL_MAX ? cellNodeKey(n.L + 1, Math.floor(n.nx / 2), Math.floor(n.ny / 2)) : null;
}
/** A node's four children, row by row (none at L0). @param {unknown} key @returns {string[]} */
export function childNodes(key) {
  const n = parseNode(key);
  if (!n || n.L === 0) return [];
  return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => cellNodeKey(n.L - 1, n.nx * 2 + dx, n.ny * 2 + dy));
}

/** Today's partition: every node split down to L0, so a fine key is its own node. */
export const L0_TREE = Object.freeze({ v: 1, base: 0, split: Object.freeze([]), joined: Object.freeze([]) });
/** The most nodes a tree lists split or joined - a tree is read by every Worker isolate, so it stays small (a town's
 *  nodes, not the map's). */
export const TREE_NODES_MAX = 4096;
const sets = new WeakMap();
/** A tree's lists as sets, made once per tree object. @param {{split: readonly string[], joined: readonly string[]}} t */
const setsOf = (t) => { let s = sets.get(t); if (!s) { s = { split: new Set(t.split), joined: new Set(t.joined) }; sets.set(t, s); } return s; };

/**
 * A tree read off the wire or storage - a fresh, frozen tree whose every listed node is a coarse node at the side of the
 * base its list names (split: at or below the base, joined: above it), each once - or null for anything else.
 * @param {unknown} raw
 */
export function readTree(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = /** @type {{v?: unknown, base?: unknown, split?: unknown, joined?: unknown}} */ (raw);
  if (t.v !== 1 || !Number.isInteger(t.base) || /** @type {number} */ (t.base) < 0 || /** @type {number} */ (t.base) > CELL_LEVEL_MAX) return null;
  const base = /** @type {number} */ (t.base);
  const list = (/** @type {unknown} */ v, /** @type {(L: number) => boolean} */ side) => {
    if (!Array.isArray(v) || v.length > TREE_NODES_MAX) return null;
    const out = new Set();
    for (const k of v) { const L = isCoarseNode(k) ? nodeLevelOf(k) : null; if (L == null || !side(L) || out.has(k)) return null; out.add(k); }
    return Object.freeze([...out]);
  };
  const split = list(t.split ?? [], (L) => L <= base), joined = list(t.joined ?? [], (L) => L > base);
  return split && joined ? Object.freeze({ v: 1, base, split, joined }) : null;
}

/** Is node `key` split in `tree`? An L0 node never is. @param {{base: number, split: readonly string[], joined: readonly string[]}} tree @param {string} key */
export function isSplit(tree, key) {
  const L = nodeLevelOf(key);
  if (!L) return false;
  const s = setsOf(tree);
  return L > tree.base ? !s.joined.has(key) : s.split.has(key);
}

/**
 * THE WALK: the node that holds fine key `fineKey` in `tree` - down from its L4 node while the node it stands in is
 * split - or null for a key that is no fine cell. Under L0_TREE it is the fine key itself.
 * @param {{base: number, split: readonly string[], joined: readonly string[]}} tree @param {unknown} fineKey
 */
export function leafOf(tree, fineKey) {
  const c = cellOfRoom(fineKey);
  if (!c) return null;
  let L = CELL_LEVEL_MAX;
  let node = nodeAt(L, c[0], c[1]);
  while (L > 0 && isSplit(tree, node)) { L--; node = nodeAt(L, c[0], c[1]); }
  return node;
}

/**
 * THE HANDOVER'S PARTITION: each row given to the node of `targets` that holds its pixel (`pixelOf`: `[px, py]` or
 * null), the rows with no pixel - or none any target holds - apart (`rest`). Pure: the caller decides what the rest is.
 * @template T
 * @param {Iterable<T>} rows @param {(row: T) => ([number, number] | null)} pixelOf @param {string[]} targets
 * @returns {{ by: Map<string, T[]>, rest: T[] }}
 */
export function partitionRows(rows, pixelOf, targets) {
  const by = new Map(targets.map((t) => [t, /** @type {T[]} */ ([])]));
  const rest = /** @type {T[]} */ ([]);
  for (const r of rows) {
    const p = pixelOf(r);
    const t = p ? targets.find((k) => nodeHolds(k, p[0], p[1])) : undefined;
    if (t) /** @type {T[]} */ (by.get(t)).push(r); else rest.push(r);
  }
  return { by, rest };
}
