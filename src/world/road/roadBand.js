// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VERGE1's BAND, ONE HOME FOR BOTH THREADS (JUNGLE-ROADSIDE, 2026-10-23; bible/03-World/Roads.md VERGE1): the band Basic
// Roads paints a road or a track as - one tile either side of the line from a map pixel's centre to the edge or corner
// its compass bit names - and the room a point has beside it, measured as a disc to a segment. Moved here out of
// world/road/roadVerge.js, which asks it of the road network as it always did (roadRoom, through GetPathsDataPoint's
// port - systems/travel/travelPaths.js pathsDataPoint); the terrain worker, which reaches world/ and formats/ alone
// (TAMRIEL2-WORKER), asks it of the arrays it paints its roads from (`netBits` - world/terrain/terrainGen.js's own read)
// when it stands the jungle's roadside pairs astride them (world/jungle/jungleRoadside.js).
// ═══════════════════════════════════════════════════════════════════
import { DIR, MAP_W, MAP_H } from './roadNetwork.js';
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';

/** A path's half width (m): Basic Roads paints a road or a track two tiles wide about its line - one tile either side
 *  (roadClearance.js PATH_HALF_WIDTH, the mod's P_SIZE / 2 of a pixel's 32768 units: 6.4 m). */
export const PATH_HALF_M = TERRAIN_SIZE / 128;
/** A map pixel (m), and half of one. */
const PIXEL_M = TERRAIN_SIZE;
const HALF_M = PIXEL_M / 2;
/** Each compass bit's arm: from the pixel's centre to the edge or corner it names, in half pixels (x east, z north). */
export const ARMS = Object.freeze([[DIR.N, 0, 1], [DIR.NE, 1, 1], [DIR.E, 1, 0], [DIR.SE, 1, -1], [DIR.S, 0, -1], [DIR.SW, -1, -1], [DIR.W, -1, 0], [DIR.NW, -1, 1]]);

/**
 * A pixel's compass bits read off the road network's own arrays - a road's or a track's, as GetPathsDataPoint reads them
 * (systems/travel/travelPaths.js pathsDataPoint; test/world/jungleroadside.test.js holds the two equal over the whole
 * map), a pixel off the map answered 0. The worker's read: it reaches no systems/ module.
 * @param {{ roads?: ArrayLike<number>, tracks?: ArrayLike<number> }} net
 * @returns {(x: number, y: number) => number}
 */
export const netBits = (net) => (x, y) => {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 0;
  const i = x + y * MAP_W;
  return ((net.roads?.[i] ?? 0) | (net.tracks?.[i] ?? 0)) & 0xff;
};

/**
 * THE ROOM BESIDE THE ROAD: how far (m) a pixel-local point - x east, z north, from the pixel's south-west corner, the
 * frame the nature flats and roadClearance.js share - stands from the nearest edge of a road's or a track's band, in its
 * own pixel or any other a band within `reach` of it runs through; `reach` when none comes nearer, 0 on one.
 * @param {((x: number, y: number) => number)|null} bitsAt a map pixel's compass bits - null answers `reach` (nothing is painted)
 * @param {number} px @param {number} py the pixel @param {number} x @param {number} z @param {number} reach (m)
 */
export function bandRoom(bitsAt, px, py, x, z, reach) {
  if (!bitsAt || !(reach > 0)) return Math.max(0, reach);
  const g = PATH_HALF_M + reach;
  // only the map's pixels are asked (OW-WOD-LAG's law, roadClearance.js): none past its edges has a road
  const ix0 = Math.max(-px, Math.floor((x - g) / PIXEL_M)), ix1 = Math.min(MAP_W - 1 - px, Math.floor((x + g) / PIXEL_M));
  const iz0 = Math.max(py - (MAP_H - 1), Math.floor((z - g) / PIXEL_M)), iz1 = Math.min(py, Math.floor((z + g) / PIXEL_M));
  let room = reach;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const bits = bitsAt(px + ix, py - iz);   // north (+z) is the row above: py - 1
      if (!bits) continue;
      const qx = x - (ix * PIXEL_M + HALF_M), qz = z - (iz * PIXEL_M + HALF_M);   // the point from that pixel's centre
      for (const [bit, sx, sz] of ARMS) {
        if (!(bits & bit)) continue;
        const ex = sx * HALF_M, ez = sz * HALF_M;
        const t = Math.min(1, Math.max(0, (qx * ex + qz * ez) / (ex * ex + ez * ez)));
        const d = Math.hypot(qx - t * ex, qz - t * ez) - PATH_HALF_M;
        if (d < room) room = Math.max(0, d);
      }
    }
  }
  return room;
}
