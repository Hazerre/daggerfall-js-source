# FIELD BUGS 2026-10-23b - a spell cast at the ground outdoors flies through it

One report, from the owner: "spells cast at the ground outdoors don't collide with it at all and sail straight
through". Read on main's `b0765ab21`. The pins are `test/scenes/groundbolt.test.js`, the mutants
`tools/mutants/groundbolt.json` (6, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "spells cast at the ground outdoors don't collide with it at all and sail straight through" | The streamed world and the fixed city handed the cast engine a collider proxy that carried `raycast` alone, and a missile's flight asked that ray alone. That ray walks the collider's MESHES; outdoors the ground is not a mesh but the host's `heightAt` sampler (`player/collider.js` surfaceHit's own note, MAC-BUG W5). A bolt met a building and never the ground: a Fireball at the grass went under it and on until its lifespan ran out, its blast never thrown. A foe's missile the same | GROUND-BOLT |

## GROUND-BOLT (1) - `src/scenes/hostMagic.js`, `src/scenes/world.js`, `src/scenes/exterior.js`

DFU: DaggerfallMissile.cs:337-339 casts the missile's displacement into the scene's physics, and a Unity terrain has
its own TerrainCollider - DFU's missiles meet the ground, so this is no departure and no Ledger row is owed.

THE CHANGE:

- The flight asks `rayHit` (`combat/techniques.js`, AUDIT TECH1) - the collider's mesh ray AND the terrain, marched
  and halved to the crossing - where it asked `collider.raycast`: `hostMagic.js:"const _cs = coverStep(coverDistance(collider, m.pos, _unit, reach), rayHit("`.
  One march, imported; not a second copy (ONE DFU MEMBER, ONE EXPORT). It meets a rise as well as a fall, so a level
  bolt into a hillside stops on it (the collider's `surfaceHit` meets the ground on the way down alone).
- `liveCollider` (`hostMagic.js:"export function liveCollider(live) {"`) is the collider a host hands the engine:
  whichever of its colliders the player stands in, asked at each call, with its ground (`heightAt`, `surfaceAt`,
  `surfaceHit`) beside its mesh ray. Both exterior hosts hand it in place of the bare proxy, one entry for one entry
  (THE HOSTS DO NOT GROW).
- What else reads the ground now: an impact's sparks land on the ground under it, and its shockwave lies on the ground
  it struck (`groundUnder` and WALL-RING both asked `surfaceHit`, which the bare proxy did not carry - they guessed).
  A sky fireball (SUNBABY2) is met by the ground too; its count still lands it where the throw said, should the two
  grounds part.

THE FOUR HOSTS: `world.js` and `exterior.js` wired. `worldModes.js` (interiors) casts through the world's engine,
whose collider follows the door to `interiorCollider` - a room has no ground sampler (`-Infinity`) and its floors are
meshes, so nothing moves there. `dungeonContext.js` builds its engine on its own Collider, the same: no ground
sampler underground, its own flight unchanged.

Moved with it: the flight-line source pins in `test/scenes/roadh_tail.test.js` and `test/scenes/tact1.test.js` read
`rayHit` for this engine, and `tools/mutants/tact1.json` TACT1-bolt-through is re-aimed at the new line (still dead).

Seen, not changed: the bare proxy carried no `cover` either, and `liveCollider` carries none - so in the two exterior
hosts a bolt still passes through TACT1's cover (trees, rocks, props), which the dungeon's engine, on its own
Collider, meets. Left for the owner's word: it changes what a bolt does in the open world.
