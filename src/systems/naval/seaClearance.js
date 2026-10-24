// @ts-check
// FERRY-CLEAR (2026-10-24, Discord - "Ferrys still unstable": "Had several issues with the ferry ramming a neighbour
// ship till it broke, or running ashore"; bible/03-World/Passage.md FERRY-CLEAR) - THE SHIPS A JOURNEY'S HAND STEERS
// ROUND. The hand on a crossing's helm (OWS2, scenes/world.js tvSeaSail and systems/seaHelm.js) - a booked ship's master
// on a passage, the traveller's own on a crossing - looked at the water alone: a ship moored at the next berth along
// the quay she left from stood dead ahead of her, and the hand drove her into it. A ship's hull is as land to it now:
// how far along each of its looks the first hull stands, HULL_CLEAR_M off her side, is the lesser of that and the land
// (the naval host's `hullAlong` over the sea's ships afloat - navalHost.js). The port's own: Daggerfall has no sea.
import { segmentBoxEntry } from './navalBallistics.js';

/** The water the hand keeps between her and another ship's side (m): a hull grown by this is where its looks stop. */
export const HULL_CLEAR_M = 6;

/**
 * Metres along a flat look from `p` (`dx`, `dz` a unit direction) to the first of `boxes` (the ships' hulls - oriented
 * boxes, navalBallistics.js orientedBox) grown by `clear`, within `far`; Infinity where none stands. Each box is met at
 * its own middle height, so the look is the hull's plan, whatever the sea's height under her. A look that starts
 * within a hull's clearance already (alongside her) stops at her side itself, and one leading away from her side does
 * not stop for her at all - the hand turns off a ship it lies beside, never toward it.
 * @param {number[]} p @param {number} dx @param {number} dz @param {number} far
 * @param {Iterable<{ c: number[], ax: number[], ay: number[], az: number[], h: number[] } | null>} boxes
 */
export function hullAlong(p, dx, dz, far, boxes, clear = HULL_CLEAR_M) {
  let best = Infinity;
  for (const box of boxes) {
    if (!box) continue;
    const r = Math.hypot(box.h[0], box.h[1], box.h[2]) + clear;
    const ox = box.c[0] - p[0], oz = box.c[2] - p[2];
    const along = Math.max(0, Math.min(far, ox * dx + oz * dz));
    if (Math.hypot(ox - dx * along, oz - dz * along) > r) continue;   // nowhere near the look
    const a = [p[0], box.c[1], p[2]], b = [p[0] + dx * far, box.c[1], p[2] + dz * far];
    let hit = segmentBoxEntry(a, b, box, clear);
    if (hit && hit.t === 0) hit = segmentBoxEntry(a, b, box, 0);   // within her clearance already: her side itself
    if (!hit || hit.t === 0) continue;
    best = Math.min(best, hit.t * far);
  }
  return best;
}
