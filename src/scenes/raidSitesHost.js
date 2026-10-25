// @ts-check
// RAID5 (2026-10-25, bible/03-World/Raiding-Parties.md RAID5): A RAIDED TOWN'S PLACES AND PEOPLE - the world host's half
// of the raid's kinds (systems/raidKinds.js, run by systems/raidingParties.js): the town's square (where the Standard is
// held and the refugees are bound), the way the refugees walk to it (the town's own walk grid - systems/livingWorld/
// townPaths.js findTownPath, the same cells every client walks), the Standard-Bearer (one of the town's watch, minted
// at the square - scenes/cityGuards.js standBearer) and a refugee (a townsperson of the street's pool, the player's ally,
// walking behind the way's guide - characters/enemy/enemyMotor.js `follow`). A module the host wires (HOST-SPLIT,
// bible/01-Overview/Host-Split.md): the host hands its own doors, as they are, and keeps none of this.
//
// THE FOUR HOSTS (THE FOUR HOSTS RULE, Home.md): scenes/world.js WIRED - the one host with the Bay's towns, their walk
// grids and the town watch.
// scenes/exterior.js - FLAGGED: the fixed-city bench runs no raid; the streaming host is where its towns are raided.
// scenes/worldModes.js and scenes/dungeonContext.js - FLAGGED: a raid is the street's, and stands nothing indoors (RAID1).
import { NAV_CELL } from '../world/city/cityNavigation.js';
import { findTownPath, pathLine } from '../systems/livingWorld/townPaths.js';
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';
import { RAID_BEARER_HEALTH_X, RAID_BEARER_LEASH_M, RAID_REFUGEE_HEALTH_X } from '../systems/raidKinds.js';

/** How far a cell is looked for about a wanted point (cells), and the most a way's search opens. */
export const RAID_SITE_CELL_SEARCH = 12;
export const RAID_WAY_EXPANSIONS = 30000;
/** The refugee's kind - a temple's healer, a townsperson the street's pool can stand. */
export const RAID_REFUGEE_KIND = MOBILE_TYPES.Healer;

/**
 * @param {{
 *   townAt: (x: number, z: number) => ({ town: number, nav: any, local: number[], toScene: (u: number, v: number) => number[] }|null|undefined),
 *   feet: () => (number[]|null), groundAt: (x: number, z: number) => number,
 *   standGuard: (pos: number[], yaw: number) => Promise<any>,
 *   spawnFoe: (mobileType: number, pos: number[], o: any) => Promise<any>,
 * }} deps  `townAt` the scene's point in a built town (scenes/wagon/wagonWardenHost.js wardenTownIn); `feet` the player's;
 *   `groundAt` the ground's height; `standGuard` a defender of the watch minted at a point (cityGuards.standBearer);
 *   `spawnFoe` the street's pool's own (exteriorFoes.spawnFoe - a refugee is its `allied`, loose and transient)
 */
export function createRaidSites({ townAt, feet, groundAt, standGuard, spawnFoe }) {
  const townHere = () => { const f = feet(); return f ? townAt(f[0], f[2]) ?? null : null; };
  /** The walkable cell nearest a wanted cell of the grid, or null. */
  function nearCell(nav, gx, gy) {
    const ok = (x, y) => x >= 0 && y >= 0 && x < nav.width && y < nav.height && nav.weightAt(x, y) > 0;
    for (let r = 0; r <= RAID_SITE_CELL_SEARCH; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(gx + dx, gy + dy)) return [gx + dx, gy + dy];
    }
    return null;
  }
  const sceneOf = (t, cell) => { const s = t.toScene((cell[0] + 0.5) * NAV_CELL, (cell[1] + 0.5) * NAV_CELL); return [s[0], groundAt(s[0], s[1]), s[1]]; };
  /** The square's cell: the walkable cell nearest the town grid's middle. */
  const squareCell = (t) => nearCell(t.nav, Math.floor(t.nav.width / 2), Math.floor(t.nav.height / 2));
  return {
    /** The town's square in the scene ([x, y, z]), or null (no built town about the player, or no street at its middle). */
    square() {
      const t = townHere();
      const c = t ? squareCell(t) : null;
      return c ? sceneOf(t, c) : null;
    },
    /**
     * The refugees' way: from the town's edge on the side `side` names (0 north, 1 east, 2 south, 3 west - the raid's own
     * draw, so every machine walks the same way) to its square, along the grid's streets - [x, y, z] points, or null.
     * @param {number} side
     */
    way(side) {
      const t = townHere();
      if (!t) return null;
      const { nav } = t, end = squareCell(t);
      const mid = [Math.floor(nav.width / 2), Math.floor(nav.height / 2)];
      const edge = [[mid[0], 1], [nav.width - 2, mid[1]], [mid[0], nav.height - 2], [1, mid[1]]][((side | 0) % 4 + 4) % 4];
      const start = nearCell(nav, edge[0], edge[1]);
      if (!end || !start) return null;
      const cells = findTownPath(nav, start, end, { maxExpansions: RAID_WAY_EXPANSIONS });
      if (!cells || cells.length < 2) return null;
      return pathLine(cells).pts.map((p) => { const s = t.toScene(p[0], p[1]); return [s[0], groundAt(s[0], s[1]), s[1]]; });
    },
    /** The Standard-Bearer at `post`: the watch's own, RAID_BEARER_HEALTH_X as hardy, kept within RAID_BEARER_LEASH_M of it. */
    async standBearer(post) {
      const g = await standGuard(post, 0);
      if (!g?.entity) return g ?? null;
      g.entity.maxHealth = Math.max(1, Math.round((g.entity.maxHealth || 1) * RAID_BEARER_HEALTH_X));
      g.entity.health = g.entity.maxHealth;
      g.raidBearer = true;
      if (g.ai) g.ai.follow = { feet: () => post, stop: 0.6, leash: RAID_BEARER_LEASH_M };
      return g;
    },
    /** A refugee at `at`, walking behind `follow` (the way's guide - characters/enemy/enemyMotor.js `follow`). */
    async standRefugee(at, follow) {
      const f = await spawnFoe(RAID_REFUGEE_KIND, at, { allied: true, loose: true, transient: true, feetGiven: true });
      if (!f?.entity) return f ?? null;
      f.entity.maxHealth = Math.max(1, Math.round((f.entity.maxHealth || 1) * RAID_REFUGEE_HEALTH_X));
      f.entity.health = f.entity.maxHealth;
      f.refugee = true;
      if (f.ai) f.ai.follow = follow;
      return f;
    },
  };
}
