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

// ═══ COST-2 PART TWO: THE TREE MOVES ═══════════════════════════════════════════════════════════════════════════════
// The directory starts from a SEED (every node above the seed's level split, every node at it whole) and moves one node
// at a time: a crowded leaf SPLITS into its four children, four quiet sibling leaves MERGE into their parent. Every tree
// a move makes lists only nodes the walk reaches, so a tree stays a town's nodes long, never the map's.

/** The tree seeded at level `L` (0 to CELL_LEVEL_MAX): every node above it split, every node at it whole - nothing listed.
 *  L0 is L0_TREE. Null for any other `L`. @param {unknown} L */
export function seedTree(L) {
  if (!Number.isInteger(L) || /** @type {number} */ (L) < 0 || /** @type {number} */ (L) > CELL_LEVEL_MAX) return null;
  return L === 0 ? L0_TREE : Object.freeze({ v: 1, base: /** @type {number} */ (L), split: Object.freeze([]), joined: Object.freeze([]) });
}
/** Is `tree` today's partition - every node split down to L0? (A base-0 tree lists no split node: its joined list is
 *  what it merged.) @param {{base: number, joined: readonly string[]}} tree */
export const isL0Tree = (tree) => tree.base === 0 && tree.joined.length === 0;
/** Does the walk reach node `key` in `tree` - is every node above it split? @param {any} tree @param {string} key */
export function isReached(tree, key) {
  if (!isNodeRoom(key)) return false;
  for (let p = parentNode(key); p; p = parentNode(p)) if (!isSplit(tree, p)) return false;
  return true;
}
/** Is node `key` a LEAF of `tree` - the object its fine cells' sockets share: reached, and not split itself? @param {any} tree @param {string} key */
export const isLeaf = (tree, key) => isReached(tree, key) && !isSplit(tree, key);

/** `tree` with each of `whole` made whole and each of `cut` split, every node in `drop` unlisted - or null past
 *  TREE_NODES_MAX. @param {any} tree @param {{ whole?: string[], cut?: string[], drop?: string[] }} change */
function changed(tree, { whole = [], cut = [], drop = [] }) {
  const s = setsOf(tree), split = new Set(s.split), joined = new Set(s.joined);
  for (const k of drop) { split.delete(k); joined.delete(k); }
  for (const k of whole) { if (/** @type {number} */ (nodeLevelOf(k)) > tree.base) joined.add(k); else split.delete(k); }
  for (const k of cut) { if (/** @type {number} */ (nodeLevelOf(k)) > tree.base) joined.delete(k); else split.add(k); }
  if (split.size > TREE_NODES_MAX || joined.size > TREE_NODES_MAX) return null;
  return Object.freeze({ v: 1, base: tree.base, split: Object.freeze([...split].sort()), joined: Object.freeze([...joined].sort()) });
}
/** THE SPLIT: `tree` with leaf `key` (above L0) split into its four children, each a leaf - or null when `key` is no such
 *  leaf. @param {any} tree @param {string} key */
export function splitTree(tree, key) {
  if (!isLeaf(tree, key) || !nodeLevelOf(key)) return null;
  return changed(tree, { cut: [key], whole: childNodes(key) });
}
/** THE MERGE: `tree` with the split node `parent`, whose four children are leaves, made a leaf itself - its children no
 *  longer listed - or null when it is no such node. @param {any} tree @param {string} parent */
export function mergeTree(tree, parent) {
  const kids = childNodes(parent);
  if (!kids.length || !isReached(tree, parent) || !isSplit(tree, parent) || !kids.every((k) => isLeaf(tree, k))) return null;
  return changed(tree, { drop: kids, whole: [parent] });
}
/** The tree a move leaves: a split's of its one departing node, a merge's of its one receiving node. @param {any} tree @param {{kind: string, from: string[], to: string[]}} move */
export const treeAfter = (tree, move) => (move.kind === 'split' ? splitTree(tree, move.from[0]) : move.kind === 'merge' ? mergeTree(tree, move.to[0]) : null);

/**
 * THE TREE'S HYSTERESIS (pure): the move due at `now` - `{ kind, from, to }`, the nodes it hands over from and to - or
 * null, and the dwell carried to the next ask.
 * - A SPLIT: a leaf above L0 whose count stays past `splitAt` for `splitDwellMs` splits into its four children.
 * - A MERGE: four sibling leaves whose players together stay under `mergeAt` for `mergeDwellMs` merge into their parent.
 * `counts` maps a leaf to its players now (a node with no fresh word counts none, so an emptied node merges); `dwell`
 * `{ over, under }` maps a node (split) or a parent (merge) to when its condition began; `cool` maps a node to the time
 * before which no move touches it (one its rows blocked). One move at a time: a split first - a crowd is
 * the cost that grows - and the longest dwell first among each.
 * @param {any} tree @param {Map<string, number>} counts
 * @param {{ over: Record<string, number>, under: Record<string, number> }} dwell @param {Record<string, number>} cool
 * @param {number} now @param {{ splitAt: number, splitDwellMs: number, mergeAt: number, mergeDwellMs: number }} law
 */
export function cellMoveDue(tree, counts, dwell, cool, now, law) {
  const cold = (/** @type {string} */ k) => !(now < (cool[k] ?? -Infinity));
  const n = (/** @type {string} */ k) => counts.get(k) ?? 0;
  const over = /** @type {Record<string, number>} */ ({}), under = /** @type {Record<string, number>} */ ({});
  const splits = [], merges = [];
  for (const [k, c] of counts) {
    if (!(c > law.splitAt) || !nodeLevelOf(k) || !isLeaf(tree, k) || !cold(k)) continue;
    over[k] = dwell.over[k] ?? now;
    if (now - over[k] >= law.splitDwellMs) splits.push(k);
  }
  const parents = new Set([...counts.keys()].map(parentNode).filter((p) => p != null));
  for (const p of /** @type {Set<string>} */ (parents)) {
    const kids = childNodes(p);
    if (!isReached(tree, p) || !isSplit(tree, p) || !kids.every((k) => isLeaf(tree, k) && cold(k)) || !cold(p)) continue;
    if (!(kids.reduce((s, k) => s + n(k), 0) < law.mergeAt)) continue;
    under[p] = dwell.under[p] ?? now;
    if (now - under[p] >= law.mergeDwellMs) merges.push(p);
  }
  const first = (/** @type {string[]} */ ks, /** @type {Record<string, number>} */ at) => ks.sort((a, b) => at[a] - at[b] || (a < b ? -1 : 1))[0];
  const s = first(splits, over), m = s ? null : first(merges, under);
  const move = s ? { kind: 'split', from: [s], to: childNodes(s) } : m ? { kind: 'merge', from: childNodes(m), to: [m] } : null;
  return { move, dwell: { over, under } };
}

/** The `cellSeed` relay setting (net/relayCfg.js) read: the level 1 to CELL_LEVEL_MAX the directory seeds its tree at, 0
 *  for off (or unset) - the tree fixed at L0 - and undefined for a value it is not. @param {unknown} v */
export const cellSeedOf = (v) => (v == null || v === '' || v === 'off' ? 0 : /^[1-4]$/.test(String(v)) ? Number(v) : undefined);
