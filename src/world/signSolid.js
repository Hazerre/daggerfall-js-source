// @ts-check
// FIELD BUGS 2026-10-25b SIGN-PASS (#bug-reports, ajaegerson, "Caravans get caught on shop signs": "Sometimes they do
// when travelling through towns its really easy to fix just return and move a bit but kinda annoying it stops you";
// Harlander: "Even going on foot you can get hung up on shop signs and fences"): A SHOP'S SIGN IS SOLID WHERE IT
// STANDS, NEVER WHERE IT HANGS.
//
// WHAT DFU DOES. A shop's sign is one of a town block's misc models - ARCH3D 43700-43755, three frames of nineteen
// boards (TEXTURE.333 records 0-18) - and RMBLayout.AddProps combines it into the block's one mesh, whose MeshCollider
// is all of it (GameObjectHelper.CreateCombinedMeshGameObject): its post, and the board, arm and brace over the street.
// Every one of BLOCKS.BSA's 668 is a misc model of a town block; no interior and no dungeon places one.
//
// WHAT THE PORT DID. The same - the town hosts put every triangle of it in the collider. The boards hang from 1.65 m
// (43718-43736, a post with an arm), 2.1 m (43700-43717, a frame on two posts) and 2.4 m (43737-43755, a T on a pole):
// inside a rider's 2.6 m capsule (player/motor.js RIDE_HEIGHT, DFU's controllerRideHeight - a wagon's driver rides one)
// and, the lowest, a walker's 1.8 m. A horse or a wagon riding a street was stopped by a board over it; a journey's
// feelers, at the knee (systems/travel/travelSteer.js FEELER_HEIGHT), saw nothing, and its grinding stopped it; a
// walker passing under a low board's edge was caught there by the head.
//
// THE DEPARTURE (Port-Ledger A, SIGN-PASS). A sign's triangle whose every corner stands SIGN_HANG_M or more over the
// sign's own foot HANGS - the board, its arm and brace, the frame's crossbar, the caps over them - and is drawn, never
// solid; every other STANDS, as a fence does (the posts from the ground, the T's pole off its flared foot). Measured
// over ARCH3D's 56 signs: the standing triangles' lowest corners are at 0 and 0.5 m, the hanging ones' at 1.65 m and
// over, so a line anywhere between parts them alike. Nothing hangs from a sign that a body could stand on.

/** The ARCH3D records of the shops' signs: every misc model BLOCKS.BSA places in this range is one. */
export const SIGN_FIRST_MODEL = 43700;
export const SIGN_LAST_MODEL = 43799;

/** @param {number} modelIdNum */
export const isSignModel = (modelIdNum) => modelIdNum >= SIGN_FIRST_MODEL && modelIdNum <= SIGN_LAST_MODEL;

/** How far (metres, in the model's own frame) over its foot a sign's triangle must stand, every corner of it, to hang. */
export const SIGN_HANG_M = 1;

/**
 * The triangles of a sign a body meets: every one with a corner under SIGN_HANG_M over the model's lowest corner (its
 * foot), in the mesh's own order. Pure.
 * @param {ArrayLike<number>} positions the model's (x, y, z) triples, y up (world/meshReader.js dfMeshToModel)
 * @param {ArrayLike<number>} indices its triangles
 * @returns {Uint32Array}
 */
export function signStandingIndices(positions, indices) {
  let foot = Infinity;
  for (let i = 1; i < positions.length; i += 3) if (positions[i] < foot) foot = positions[i];
  const hang = foot + SIGN_HANG_M;
  const keep = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (Math.min(positions[a * 3 + 1], positions[b * 3 + 1], positions[c * 3 + 1]) < hang) keep.push(a, b, c);
  }
  return Uint32Array.from(keep);
}

/** @type {WeakMap<object, Uint32Array>} a sign model's standing triangles, made once a model */
const STANDING = new WeakMap();

/**
 * What a town host puts in the collider for a placed model: a sign's standing triangles (signStandingIndices, once a
 * model), every other model's own indices untouched.
 * @param {number} modelIdNum
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number> }} model its CPU mesh, as the host's model cache holds it
 * @returns {ArrayLike<number>}
 */
export function solidIndicesOf(modelIdNum, model) {
  if (!isSignModel(modelIdNum)) return model.indices;
  let standing = STANDING.get(model);
  if (!standing) STANDING.set(model, (standing = signStandingIndices(model.positions, model.indices)));
  return standing;
}
