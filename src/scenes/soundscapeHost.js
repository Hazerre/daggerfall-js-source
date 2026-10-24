// @ts-check
// SOUNDSCAPE (2026-10-24, the owner: "enhancing sound and ambience, different music and ambience sounds for sailing,
// more varied horse sounds, and whatever else we could improve") - THE SOUNDSCAPE'S HOST HALF. Design:
// bible/08-Audio/Audio.md SOUNDSCAPE. The laws are the systems' (systems/soundscape/seaAir.js, worldAir.js,
// seaScore.js); this module reads the world host's doors once a frame, keeps what is dear to ask (the shore's edge, the
// land near, the doors near, a port near) on clocks of its own, and plays them. The world host constructs it once and
// calls it (HOST-SPLIT: fishHost.js's shape) - three calls: `frame` on the exterior frame, `stop` on every modal one
// (a building, a dungeon, a cabin: the port's own sounds fall silent indoors, as the wind does), and `scoreFrame` in
// the music's chain (the sea's songs hold the music while I sail, before the director).
//
//   deps = {   (the world's own doors and objects, handed as they are - LEGIBLE's ceilings: no wrapper where none must be)
//     audio, music                                  the engine; the music service (registerSong, playSong, fadeOut)
//     boat() -> the deck I stand on | null          world.js csaBoatUnderMe: at her helm or aboard
//     csa -> Come Sail Away's runtime | null        helmPanelState (her way, her sails, in irons), IsNearPort
//     fight() -> a hostile ship near                world.js navalHostileNear
//     pixel() -> my map pixel { x, y }              seaPixel(x, y) -> the map's water there (overworldModel.js isWaterPixel)
//     dw -> Deep Waters' player | null              rawColumnAt(x, z).depth: the sea's depth at a scene point - the shore's
//                                                   edge is found by it
//     inRect() -> in a location's rect              towns() -> the living towns' index (y * 1000 + x -> { blocks })
//     doors -> the host's building doors            each { door, pixelKey, dfBlock, recordIndex }; doorAt(entry) -> its
//                                                   door in the scene's frame (world.js shiftedDoor)
//   }
// Not a DFU member - Ledger A (SOUNDSCAPE). THE FOUR HOSTS: world.js wires it; worldModes.js (interiors) and
// dungeonContext.js stop it by the modal frame's return (no air of the open world indoors or underground);
// scenes/exterior.js - FLAGGED: the fixed-city bench stands no sea, no boats and no streamed shore - its ambience is DFU's.
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';
import { createSeaAir } from '../systems/soundscape/seaAir.js';
import { createWorldAir } from '../systems/soundscape/worldAir.js';
import { installSoundscapeSounds } from '../systems/soundscape/soundscapeSfx.js';
import { createSeaScore, seaScoreSongs, SEA_SCORE_SILENCE } from '../systems/soundscape/seaScore.js';
import { isNight } from '../world/worldClock.js';
import { CLIMATES } from '../formats/mapsTables.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';

/** The gulls' land: a map pixel within this ring of mine that is not the sea. */
export const GULL_RING = 2;
/** THE SHORE'S EDGE, found by asking the sea's depth on SHORE_BEARINGS bearings at each of SHORE_RADII m, nearest
 *  first; the first ring with water deeper than SHORE_DEPTH on any bearing holds the edge, which a few halvings along
 *  each bearing that met it place - the nearest of them. */
export const SHORE_RADII = Object.freeze([6, 14, 28, 50, 85, 130, 200]);
export const SHORE_BEARINGS = 12;
export const SHORE_DEPTH = 0.3;
/** Without the sea's depth (Deep Waters not standing), a coast is heard as a far surf off a map pixel the sea is beside. */
export const SHORE_FAR_M = 150;
/** How often the dear questions are asked again (s), and how far I may walk before they are asked at once (m). */
export const ASK_EVERY_S = 0.5;
export const ASK_MOVED_M = 15;
/** The doors the town's sounds stand at: the smithies' and the taverns', within this of the ear (m). */
export const DOORS_REACH_M = 70;
const SMITHIES = new Set([BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith]);
/** The score's word while I am at no helm. */
const NOT_SAILING = Object.freeze({ sailing: false, fight: false, weather: 'sunny', night: false, nearPort: false, way: 0 });
const TAVERNS = new Set([BUILDING_TYPES.Tavern]);

/**
 * THE SHORE'S EDGE near `ear` (the scene's frame): `{ dist, dir }` - metres to the nearest water deeper than
 * SHORE_DEPTH and the bearing to it ([x, z], unit) - or null with none within the last ring. Standing in it: dist 0, no
 * bearing. Pure (`depthAt` the only door).
 * @param {number[]} ear @param {(x: number, z: number) => (number | null)} depthAt
 */
export function shoreEdge(ear, depthAt) {
  const deep = (x, z) => { const d = depthAt(x, z); return Number.isFinite(d) && /** @type {number} */ (d) > SHORE_DEPTH; };
  if (deep(ear[0], ear[2])) return { dist: 0, dir: null };
  let inner = 0;
  for (const r of SHORE_RADII) {
    /** @type {{ dist: number, dir: number[] } | null} */
    let best = null;
    // every bearing that meets the water on this ring, each placed along itself - the nearest is the edge (a slanting
    // bearing meets a straight shore further off than the one square to it)
    for (let b = 0; b < SHORE_BEARINGS; b++) {
      const a = (2 * Math.PI * b) / SHORE_BEARINGS, dir = [Math.sin(a), Math.cos(a)];
      if (!deep(ear[0] + dir[0] * r, ear[2] + dir[1] * r)) continue;
      let lo = inner, hi = r;
      for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (deep(ear[0] + dir[0] * m, ear[2] + dir[1] * m)) hi = m; else lo = m; }
      if (!best || hi < best.dist) best = { dist: hi, dir };
    }
    if (best) return best;
    inner = r;
  }
  return null;
}

/** Whether land is near a map pixel - one within GULL_RING that is not the sea. Pure. @param {number} px @param {number} py @param {(x: number, y: number) => boolean} isSea */
export function landNear(px, py, isSea) {
  for (let dy = -GULL_RING; dy <= GULL_RING; dy++) for (let dx = -GULL_RING; dx <= GULL_RING; dx++) if (!isSea(px + dx, py + dy)) return true;
  return false;
}
/** Whether the sea is beside a map pixel - its own or one of the eight about it. Pure. @param {number} px @param {number} py @param {(x: number, y: number) => boolean} isSea */
export function seaBeside(px, py, isSea) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSea(px + dx, py + dy)) return true;
  return false;
}

/** A door's building type, off its block's own list (the record its door names), or -1. Pure. @param {any} entry */
export const doorBuildingType = (entry) => entry?.dfBlock?.rmbBlock?.fldHeader?.buildingDataList?.[entry?.recordIndex]?.buildingType ?? -1;

/** The climate's word for the seasons: a winter there, or none (the desert's and the rainforest's never come). Pure. */
export const winterIn = (climate, winter) => !!winter && climate !== CLIMATES.Desert && climate !== CLIMATES.Desert2 && climate !== CLIMATES.Rainforest && climate !== CLIMATES.Subtropical;

/**
 * @param {{ audio: any, music: any, boat: () => any, csa: any, fight: () => boolean, pixel: () => ({ x: number, y: number } | null),
 *   seaPixel: (x: number, y: number) => boolean, dw: any, inRect: () => boolean, towns: () => Map<number, { blocks?: number }>,
 *   doors: any[], doorAt: (entry: any) => any }} deps
 */
export function createSoundscapeHost(deps) {
  const depthAt = deps.dw?.rawColumnAt ? (/** @type {number} */ x, /** @type {number} */ z) => deps.dw.rawColumnAt(x, z)?.depth ?? null : null;
  const sea = createSeaAir({ engine: deps.audio });
  const world = createWorldAir({ engine: deps.audio });
  const score = createSeaScore();
  let installed = false, songsMade = false, held = false;
  /** the sea's word for the music, as the last frame left it (null: not at a helm) */
  let sailing = null;
  // the dear questions, asked on their own clock
  let askIn = 0, askedAt = null, pixKey = '', land = false, port = false, coast = false, blocks = 1;
  /** @type {{ dist: number, dir: number[] | null } | null} */ let shore = null;
  /** @type {number[][]} */ let smithies = [];
  /** @type {number[][]} */ let taverns = [];
  const ask = (ear) => {
    const p = deps.pixel?.() ?? null;
    const key = p ? `${p.x},${p.y}` : '';
    if (key !== pixKey) {
      pixKey = key;
      land = !!p && landNear(p.x, p.y, deps.seaPixel);
      coast = !!p && seaBeside(p.x, p.y, deps.seaPixel);
      try { port = !!deps.csa?.IsNearPort?.(3); } catch { port = false; }
      try { blocks = p ? deps.towns?.()?.get(p.y * 1000 + p.x)?.blocks ?? 1 : 1; } catch { blocks = 1; }
    }
    shore = depthAt ? shoreEdge(ear, depthAt) : coast ? { dist: SHORE_FAR_M, dir: null } : null;
    smithies = []; taverns = [];
    for (const e of deps.doors ?? []) {
      const type = doorBuildingType(e);
      const list = SMITHIES.has(type) ? smithies : TAVERNS.has(type) ? taverns : null;
      if (!list) continue;
      const m = deps.doorAt(e)?.matrix;
      if (!m || Math.hypot(m[12] - ear[0], m[14] - ear[2]) > DOORS_REACH_M) continue;
      list.push([m[12], m[13], m[14]]);
    }
  };
  const stopAll = () => { sea.stop(); world.stop(); sailing = null; };
  return {
    /**
     * Once an exterior frame, after the host's setListener (the ear and its forward are the engine's listenerPose -
     * `ear` and `fwd` given take their place): `wd` the frame's wind (windDrive), `weather`
     * the word the ear hears (soundWeather), `minute` the world's minute of the day, `climate` CLIMATE.PAK's under me,
     * `winter` the season's, `timeScale` the world's, `paused` the game's.
     * @param {number} dt
     * @param {{ ear?: number[], fwd?: number[], wd: any, weather: string, minute: number, climate: number, winter: boolean, timeScale: number, paused: boolean }} f
     */
    frame(dt, f) {
      const pose = f?.ear ? null : deps.audio?.listenerPose?.() ?? null;
      const ear = f?.ear ?? pose?.pos, fwd = f?.fwd ?? pose?.fwd ?? [0, 0, 1];
      if (!enhancedSoundsOn() || !Array.isArray(ear) || !ear.every(Number.isFinite)) { stopAll(); return; }
      if (!installed) { installed = true; installSoundscapeSounds(deps.audio); }
      if ((askIn -= Math.max(0, dt)) <= 0 || !askedAt || Math.hypot(ear[0] - askedAt[0], ear[2] - askedAt[2]) > ASK_MOVED_M) {
        askIn = ASK_EVERY_S; askedAt = [...ear];
        ask(ear);
      }
      const minute = Number(f.minute) || 0, night = isNight(minute), wind = f.wd?.on ? f.wd.strength01 : 0.35, gust = f.wd?.gust ?? 0.7;
      const boat = deps.boat?.() ?? null;
      if (boat) {
        world.stop();
        let helm = null;
        try { helm = deps.csa?.helmPanelState?.() ?? null; } catch { helm = null; }
        const way = Number(helm?.way) || 0;
        sea.frame(dt, { ear, fwd, way, sailsUp: !!helm?.sailsUp, inIrons: !!helm?.inIrons, wind, gust, weather: f.weather, night, nearLand: land, minute, timeScale: f.timeScale, paused: f.paused });
        sailing = helm ? { sailing: true, fight: !!deps.fight?.(), weather: f.weather, night, nearPort: port, way } : null;
        return;
      }
      sea.stop();
      sailing = null;
      let inTown = false;
      try { inTown = !!deps.inRect?.(); } catch { inTown = false; }
      world.frame(dt, {
        ear, climate: f.climate, night, hour: minute / 60, weather: f.weather, wind, winter: winterIn(f.climate, f.winter),
        inTown, townBlocks: blocks, shore, smithies, taverns, paused: f.paused,
      });
    },
    /** On every modal frame: silent, nothing left looping. */
    stop: stopAll,
    /**
     * THE SEA'S SONGS hold the music while I sail (systems/soundscape/seaScore.js) - before the director, after the
     * gate's, the Hour's and the arena's. The songs are made the first time a helm is taken; let go by a fade, never a
     * cut, the frame I sail no more (the director's next frame plays its own). Answers whether the sea holds the music.
     */
    scoreFrame(now = Date.now()) {
      const want = score.want(sailing && enhancedSoundsOn() ? sailing : NOT_SAILING, now);
      if (want == null) {
        if (held) { held = false; deps.music?.fadeOut?.(); }
        return false;
      }
      if (!songsMade) { songsMade = true; for (const song of Object.values(seaScoreSongs())) deps.music?.registerSong?.(song.name, song); }
      held = true;
      if (want === SEA_SCORE_SILENCE) { if (deps.music?.current !== null) deps.music?.fadeOut?.(); } else deps.music?.playSong?.(want);
      return true;
    },
  };
}
