// @ts-check
// ═══════════════════════════════════════════════════════════════════
// JUNGLE-ROADSIDE (2026-10-23, the owner, through Mac, with pine.obj, pine-1.obj and pine2.obj: "These trees are meant
// for the jungle biome and roadside. Making it more like a jungle with the vines stringing across the roads", and to have
// them "sunk into the ground so they dont float") - THE ROADSIDE PAIRS, READ. bible/03-World/Bantha-Jungle.md, The
// roadside pairs, is the design and the record.
//
// Each of the owner's three files is a PAIR: the mahogany and a second tree of the jungle's own (a kapok they leant over
// the road, a fig, a kapok they sank 2 m), 33 m apart, and lianas strung between their crowns - ribbons cut from the fig
// picture's hanging vines, laid on their side so each vine drawn down the picture runs from one crown to the other.
//
// THE PAIR IS READ WHOLE. Its near tree is the owner's file as they drew it (both trees, the lianas, the leaning kapok's
// own shape), one prototype of the jungle's door with a run of faces a picture - the mirror, the fan and the winding
// jungleMesh's (jungleModels.js objMesh) - moved so its ANCHOR, the middle of its two roots, is the origin. Its trees
// stand again as the jungle's own trees at their roots (the species JUNGLE_PAIRS names), so far off each is its
// species' far picture, and near and far each is cover and a trunk - what is the pair's own is only what it draws near.
//
// A ROOT is the middle of what the tree's picture sinks below the owner's ground (y 0): the lianas wear the fig's
// picture and hang to within a metre of the ground beside a fig's trunk, so the lowest-band root of a single tree
// (jungleMesh's) would be pulled out toward the road by them.
//
// THIS MODULE IS PURE (no GL, no fetch, no DOM): the node tests read the very files the game reads, and the terrain
// worker reads its measures.
// ═══════════════════════════════════════════════════════════════════
import { parseObj, parseMtl, objMesh, eachDrawn, FOOT_TOP } from './jungleModels.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../terrain/terrainTiles.js';
import { ARMS, bandRoom, netBits, PATH_HALF_M } from '../road/roadBand.js';
import { tileDraw, groundAt } from '../terrain/terrainNature.js';

/**
 * THE OWNER'S THREE PAIRS. `file` the OBJ's name under src/assets/jungle/source/ (its MTL the same name's); `trees` the
 * two species (JUNGLE_SPECIES's index) whose pictures stand as its trees, the mahogany first - a picture no tree of the
 * pair wears (the fig's, beside a kapok) is its lianas' alone; `key` its name in the code.
 */
export const JUNGLE_PAIRS = Object.freeze([
  Object.freeze({ key: 'leaning', file: 'pine', trees: Object.freeze([4, 1]) }),   // the mahogany, and a kapok leant over the road on a mound
  Object.freeze({ key: 'fig', file: 'pine-1', trees: Object.freeze([4, 2]) }),     // the mahogany and a fig
  Object.freeze({ key: 'sunk', file: 'pine2', trees: Object.freeze([4, 1]) }),     // the mahogany and a kapok, sunk 2 m into its ground
]);

/** The record a pair's near tree is keyed by in the jungle's door (`500_${pairRecord(p)}`). */
export const pairRecord = (p) => `jungle-pair-${p.key}`;

/** A pair's files, relative to src/assets/jungle/source/. */
export const pairFiles = (p) => ({ obj: `${p.file}.obj`, mtl: `${p.file}.mtl` });

/**
 * (x, z) turned as the trees' program turns a mesh's vertex by its instance's turn (render/renderer.js BB_VS, uMesh:
 * `vec3(tc * p.x + tsn * p.z, p.y, -tsn * p.x + tc * p.z)`) - so a pair's trees stand where its near tree draws them.
 * @param {number} x @param {number} z @param {number} t
 * @returns {[number, number]}
 */
export const turnXZ = (x, z, t) => [Math.cos(t) * x + Math.sin(t) * z, -Math.sin(t) * x + Math.cos(t) * z];

/**
 * A PAIR, READ: its mesh about its anchor (objMesh's, `subs` each naming its `picture`), the anchor in the owner's scene,
 * its two trees' roots about the anchor in the port's frame (mirrored x), and each tree's `base` - how far the owner
 * stood it below (or above) its species' own file: its picture's lowest point here less the species tree's lowest
 * (`speciesLow`), so its far picture stands where its near tree does.
 * @param {string} objText @param {string} mtlText
 * @param {{ trees: ReadonlyArray<number> }} pair a JUNGLE_PAIRS row
 * @param {ReadonlyArray<string>} pictures each species' picture (its MTL's map_Kd), JUNGLE_SPECIES's order
 * @param {ReadonlyArray<number>} speciesLow each species tree's lowest point (jungleMesh's min y)
 */
export function readPair(objText, mtlText, pair, pictures, speciesLow) {
  const obj = parseObj(objText), mtl = parseMtl(mtlText);
  const pictureOf = (material) => mtl.get(material ?? '')?.mapKd ?? null;
  const P = obj.positions;
  const roots = pair.trees.map((species) => {
    const pic = pictures[species];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, low = Infinity;
    for (const f of obj.faces) {
      if (pictureOf(f.material) !== pic) continue;
      for (const c of f.corners) {
        const x = P[c[0] * 3], y = P[c[0] * 3 + 1], z = P[c[0] * 3 + 2];
        low = Math.min(low, y);
        if (y >= 0) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
    if (!(x1 >= x0)) throw new Error(`jungle pair: no tree of ${pic} stands into its ground`);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, base: low - speciesLow[species] };
  });
  const ax = (roots[0].x + roots[1].x) / 2, az = (roots[0].z + roots[1].z) / 2;
  const mesh = objMesh(obj, ax, az);
  const subs = mesh.subs.map((s) => {
    const picture = pictureOf(s.material);
    if (!picture) throw new Error(`jungle pair: ${s.material} names no picture`);
    return { ...s, picture };
  });
  return {
    mesh: { ...mesh, subs }, anchor: [ax, az],
    roots: roots.map((r) => [-(r.x - ax), r.z - az]),   // the port's frame: mirrored in x, as the mesh
    base: roots.map((r) => r.base),
  };
}

/**
 * A PAIR AS IT STANDS, MEASURED off what it draws (jungleModels.js eachDrawn over every run, each its own picture), at
 * the owner's size: `feet` - each tree's foot, how far the drawn points under FOOT_TOP nearer its root than the other's
 * reach from it (its roots, buttresses and mound: what a road keeps clear of); `height` - its top; `over` - the lowest a
 * drawn point hangs over the road it stands astride: within a road's half band (VERGE1's PATH_HALF_M) of the middle of
 * the gap between its feet, along its axis - the lianas' lowest, and the leaning kapok's crown.
 * @param {ReturnType<typeof readPair>} read
 * @param {(picture: string) => {width: number, height: number, data: Uint8Array}} picOf
 * @param {number} [step]
 */
export function measurePair(read, picOf, step = 0.1) {
  const [[ax, az], [bx, bz]] = read.roots;
  const feet = [0, 0], points = [];
  let height = 0;
  for (const s of read.mesh.subs) {
    eachDrawn(read.mesh, picOf(s.picture), step, (x, y, z) => {
      height = Math.max(height, y);
      points.push(x, y, z);
      if (y >= FOOT_TOP) return;
      const da = Math.hypot(x - ax, z - az), db = Math.hypot(x - bx, z - bz);
      if (da <= db) feet[0] = Math.max(feet[0], da); else feet[1] = Math.max(feet[1], db);
    }, s.at, s.count);
  }
  const d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d, mid = (feet[0] - feet[1]) / 2;
  let over = Infinity;
  for (let i = 0; i < points.length; i += 3) if (Math.abs(points[i] * ux + points[i + 2] * uz - mid) <= PATH_HALF_M) over = Math.min(over, points[i + 1]);
  return { feet, height, over };
}

/**
 * EACH PAIR AS IT STANDS, MEASURED (readPair and measurePair at their own 0.1 m, off the owner's files - test/world/
 * jungleroadside.test.js reads them again and holds this table to them): JUNGLE_PAIRS's order, metres at the owner's
 * size - its two roots about its anchor (the port's frame), each tree's `base` against its species' file, each tree's
 * foot, its height and the lowest it hangs over the road (`over`). A constant of the files, so the terrain worker stands
 * a pair with no file read.
 */
export const JUNGLE_PAIR_MEASURES = Object.freeze([
  Object.freeze({ roots: Object.freeze([Object.freeze([-4.439, 16.334]), Object.freeze([4.439, -16.334])]), base: Object.freeze([0, 0.21]), feet: Object.freeze([6.37, 8.53]), height: 22.54, over: 4.21 }),   // leaning - its kapok's crown leant over the road
  Object.freeze({ roots: Object.freeze([Object.freeze([-3.256, 17.506]), Object.freeze([3.256, -17.506])]), base: Object.freeze([0, 0]), feet: Object.freeze([6.37, 7.52]), height: 22.54, over: 7.53 }),   // fig
  Object.freeze({ roots: Object.freeze([Object.freeze([-4.439, 15.926]), Object.freeze([4.439, -15.926])]), base: Object.freeze([0, -2]), feet: Object.freeze([6.37, 8.53]), height: 22.54, over: 4.21 }),   // sunk - its kapok 2 m into its ground
]);

/** The roadside's numbers, in one place (metres unless said). */
export const JUNGLE_ROADSIDE = Object.freeze({
  /** a station every `step` along a road's arm from the pixel's middle, the first `first` out (past a junction's
   *  crossing), none within `end` of the pixel's edge (the next pixel's arm stands its own); each slid along the road by
   *  up to `jitter` either way */
  first: 44,
  step: 40,
  end: 24,
  jitter: 8,
  /** a station's chance of a pair, where everything else allows one */
  chance: 0.6,
  /** a pair's scale, of the owner's */
  scale: Object.freeze([0.92, 1.08]),
  /** SUNK, NEVER FLOATING: a pair stands this far under the lowest ground beneath either foot */
  sink: 0.3,
  /** ...where neither trunk's own ground stands more than this over it (the uphill tree is buried by it) */
  bury: 3,
  /** ...and the road between them stands this far under its lowest liana at least */
  headroom: 1.5,
  /** no other jungle trunk within this of a pair's trunk (times the pair's scale) - the canopy's own spacing */
  clear: 9,
  /** a pair's trunks this far inside its pixel's edges at least - no pixel's trees crowd another's pair */
  edge: 12,
  /** the stations' draws' salt */
  salt: 600,
});

/** A map pixel's side (m) and its tile's. */
const PIXEL = TERRAIN_SIZE, HALF = PIXEL / 2;

/**
 * THE PAIRS A PIXEL STANDS - astride its roads and tracks (the network's arms, VERGE1's bands: world/road/roadBand.js
 * ARMS, bandRoom - read off the network's own arrays, netBits), in the jungle whole. Along each arm a station every JUNGLE_ROADSIDE.step, its draws a hash of its
 * world tile (terrainNature.js tileDraw: every client, every rebuild the same pairs); at a station a pair of one of the
 * owner's three, its axis across the road and its two feet's gap centred on the road's line, turned so (turnXZ) - and it
 * stands only where:
 *   - both trunks are well inside the pixel (`edge`), on ground the jungle's trees stand on (`tileOk` - whole jungle, a
 *     ground that grows, no slope past the trees' 34 degrees, no place's fields or clearing);
 *   - both feet keep off every road and track band (bandRoom - its own pixel's and its neighbours') and off the jungle's
 *     trails (`trailOk`);
 *   - neither trunk is buried past `bury` (its own ground over where the pair stands), and the road between them - its
 *     line and its band's two edges, across - leaves `headroom` under what hangs lowest over it (`over`);
 *   - no trunk of a pair it already stood is within `clear`.
 * SUNK, NEVER FLOATING (the owner: "sunk into the ground so they dont float"): the pair is one rigid thing - its lianas
 * hang from both crowns - so it stands at the LOWEST ground beneath either foot (`lowest`, exact on the ground's own
 * surface) less `sink`: nowhere under its feet is the ground lower than its own, and the uphill tree's roots go into the
 * slope. The sink covers the drawn ground's own triangles, which part from the bilinear surface by centimetres. Answers
 * `[{ kind, js, turn, ax, az, y, trees: [{ species, x, z, y }] }]`, pixel-local.
 * @param {{ px: number, py: number, net: any, heightmapData: Float32Array, tileOk: (tx: number, ty: number) => boolean,
 *   trailOk: (x: number, z: number, r: number) => boolean }} job
 */
export function standPairs({ px, py, net, heightmapData, tileOk, trailOk }) {
  const bitsAt = net ? netBits(net) : null, bits = bitsAt ? bitsAt(px, py) : 0;
  if (!bits) return [];
  const R = JUNGLE_ROADSIDE, hDim = HEIGHTMAP_DIMENSION, cell = PIXEL / (hDim - 1), tile = PIXEL / WORLD_MAP_TILE_DIM, RIM = 32;
  const yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const ox = px * WORLD_MAP_TILE_DIM, oz = -py * WORLD_MAP_TILE_DIM;
  /** THE LOWEST GROUND under a disc of `r` about (x, z): the ground is bilinear across each heightmap cell, so it has no
   *  low point inside a cell or along a cell's edge but at a sample - its lowest under the disc is at a sample inside it
   *  or on its rim (RIM samples, ~1.7 m apart on the widest foot) */
  const lowest = (x, z, r) => {
    let lo = groundAt(heightmapData, x, z);
    for (let i = Math.max(0, Math.ceil((x - r) / cell)); i <= Math.min(hDim - 1, Math.floor((x + r) / cell)); i++) {
      for (let j = Math.max(0, Math.ceil((z - r) / cell)); j <= Math.min(hDim - 1, Math.floor((z + r) / cell)); j++) {
        if (Math.hypot(i * cell - x, j * cell - z) <= r) lo = Math.min(lo, heightmapData[i * hDim + j] * yScale);
      }
    }
    for (let k = 0; k < RIM; k++) lo = Math.min(lo, groundAt(heightmapData, x + r * Math.cos((k * 2 * Math.PI) / RIM), z + r * Math.sin((k * 2 * Math.PI) / RIM)));
    return lo;
  };
  const out = [], trunks = [];
  for (const [bit, sx, sz] of ARMS) {
    if (!(bits & bit)) continue;
    const len = Math.hypot(sx, sz) * HALF, rx = sx / Math.hypot(sx, sz), rz = sz / Math.hypot(sx, sz);
    for (let s0 = R.first; s0 <= len - R.end; s0 += R.step) {
      const wx = ox + Math.floor((HALF + rx * s0) / tile), wz = oz + Math.floor((HALF + rz * s0) / tile);
      if (tileDraw(wx, wz, R.salt) >= R.chance) continue;
      const s = s0 + (tileDraw(wx, wz, R.salt + 1) * 2 - 1) * R.jitter;
      const kind = Math.min(JUNGLE_PAIRS.length - 1, Math.floor(tileDraw(wx, wz, R.salt + 2) * JUNGLE_PAIRS.length));
      const flip = tileDraw(wx, wz, R.salt + 3) < 0.5;
      const js = R.scale[0] + (R.scale[1] - R.scale[0]) * tileDraw(wx, wz, R.salt + 4);
      const m = JUNGLE_PAIR_MEASURES[kind], [[lax, laz], [lbx, lbz]] = m.roots;
      // the axis across the road, from the first tree to the second; the gap between the feet centred on the road's line
      const ux = flip ? rz : -rz, uz = flip ? -rx : rx;
      const turn = Math.atan2(lbz - laz, lbx - lax) - Math.atan2(uz, ux);
      const qx = HALF + rx * s, qz = HALF + rz * s, mid = ((m.feet[0] - m.feet[1]) / 2) * js;
      const ax = qx - ux * mid, az = qz - uz * mid;
      const trees = m.roots.map(([x, z], t) => {
        const [dx, dz] = turnXZ(x * js, z * js, turn);
        return { species: JUNGLE_PAIRS[kind].trees[t], x: ax + dx, z: az + dz, foot: m.feet[t] * js };
      });
      if (!trees.every((t) => t.x >= R.edge && t.x <= PIXEL - R.edge && t.z >= R.edge && t.z <= PIXEL - R.edge)) continue;
      if (!trees.every((t) => tileOk(Math.floor(t.x / tile), Math.floor(t.z / tile)))) continue;
      if (!trees.every((t) => bandRoom(bitsAt, px, py, t.x, t.z, t.foot) >= t.foot && trailOk(t.x, t.z, t.foot))) continue;
      if (trees.some((t) => trunks.some((u) => Math.hypot(t.x - u.x, t.z - u.z) < R.clear * js))) continue;
      const y = Math.min(...trees.map((t) => lowest(t.x, t.z, t.foot))) - R.sink;
      if (trees.some((t) => groundAt(heightmapData, t.x, t.z) - y > R.bury)) continue;
      let road = -Infinity;
      for (const k of [-1, 0, 1]) road = Math.max(road, groundAt(heightmapData, qx + ux * k * PATH_HALF_M, qz + uz * k * PATH_HALF_M));
      if (road - y > m.over * js - R.headroom) continue;
      for (const t of trees) trunks.push(t);
      out.push({ kind, js, turn, ax, az, y, trees: trees.map((t, k) => ({ species: t.species, x: t.x, z: t.z, y: y + m.base[k] * js })) });
    }
  }
  return out;
}

/**
 * A PIXEL'S PAIRS, WHOLE: its pair trees (withJungle's flats with `pair`) by their pair, a pair standing only where its
 * two trees both `keep` (the build's own tests of a flat - the gate's clearing, the rocks): a lone tree under lianas
 * strung to nothing never stands. `[{ kind, js, turn, ax, ay, az, trees: [first, second] }]`, in the layout's order.
 * @param {any[]} flats @param {(f: any) => boolean} keep
 */
export function wholePairs(flats, keep) {
  const by = new Map();
  for (const f of flats) {
    let p = by.get(f.pi);
    if (!p) by.set(f.pi, (p = { kind: f.pair, js: f.js, turn: f.turn, ax: f.ax, ay: f.ay, az: f.az, trees: [null, null] }));
    p.trees[f.side] = f;
  }
  return [...by.values()].filter((p) => p.trees.every((t) => t && keep(t)));
}
