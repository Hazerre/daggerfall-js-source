// @ts-check
// BOAT-FAR (2026-10-21; bible/07-Rendering/Performance-Priority.md BOAT-FAR) - A SHIP'S LIFE BY HER RANGE, ONE LAW.
//
// AUDIT NAV1 (the presentation, #17) gave the sea's ships this law in scenes/naval/navalHost.js poseShip: past
// NEAR_LIFE_M of the eye her rigging steps every FAR_LIFE_EVERY frames with the time it missed. A player's profile
// (2026-10-21) found every boat the Come Sail Away pool draws - mine, the peers' and the sea's - walked, baked and lit
// every frame wherever she was, and every peer's boat's Animators stepped every frame at any range
// (scenes/comeSailAway/comeSailAwayPool.js frame, scenes/comeSailAway/comeSailAwayPeers.js pose). The three read the
// law here, so it is one: the constants (navalHost re-exports them, where they were born) and the step. The EYE is each
// reader's own (its audit): poseShip's the frame's view (navalHost's `deps.look().origin`, the camera over the
// shoulder too, or the feet with no look), the pool's the playerPosition its frame is handed (scenes/world.js:
// `player.pos`), the peers' the pool's last - so where the camera stands apart from the player, a sea ship and a boat
// at one range are judged from eyes as far apart. One eye for all three is the host's to hand the pool.

/** AUDIT NAV1 (the presentation, #17): HER RIGGING'S LIFE BY HER RANGE - past NEAR_LIFE_M of the eye a ship's animators
 *  and particle systems step every FAR_LIFE_EVERY frames with the time they missed: her sails' billow and her flag's
 *  wisps are too small to see there, and the traffic sits 650-1900 m out (five far war galleys cost 5.7 ms a frame on
 *  the CPU, their rigging stepped as a near one's). BOAT-FAR: and the pool's walk, bakes and lanterns of every boat it
 *  draws, and the peers' boats' Animators, by the same law. */
export const NEAR_LIFE_M = 600;
export const FAR_LIFE_EVERY = 4;

/** A ship's place in the law: `lifeN` her frame of the stride (`n`'s, so ships built one after another step on
 *  frames of their own), `lifeDt` the time she has missed. A sea entry of navalHost's carries the two itself. */
export const farLife = (n) => ({ lifeN: n % FAR_LIFE_EVERY, lifeDt: 0 });

/**
 * One frame of the law for one ship: within NEAR_LIFE_M of the eye on the ground plane (or no eye, or nowhere to stand
 * her - `pos` null) she lives this frame; past it, one frame in FAR_LIFE_EVERY, on her own frame of the stride.
 * @param {{ lifeN: number, lifeDt: number }} life - her record (farLife), written
 * @param {number} dt - this frame's time
 * @param {ArrayLike<number> | null} pos - where she stands
 * @param {ArrayLike<number> | null} eye - the eye her range is read from
 * @returns {number | null} the time to step her by - this frame's and every one she missed since she last lived - or
 *   null: she is held this frame
 */
export function farLifeStep(life, dt, pos, eye) {
  life.lifeDt += dt;
  if (eye && pos && Math.hypot(pos[0] - eye[0], pos[2] - eye[2]) > NEAR_LIFE_M && (life.lifeN = (life.lifeN + 1) % FAR_LIFE_EVERY) !== 0) return null;
  const lived = life.lifeDt;
  life.lifeDt = 0;
  return lived;
}
