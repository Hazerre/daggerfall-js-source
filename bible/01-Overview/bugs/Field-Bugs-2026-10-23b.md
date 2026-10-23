# FIELD BUGS 2026-10-23b - a spell cast at the ground outdoors flies through it

One report, from the owner: "spells cast at the ground outdoors don't collide with it at all and sail straight
through". Read on main's `b0765ab21`; audited the same day (AUDIT GROUND-BOLT, at the foot). The pins are
`test/scenes/groundbolt.test.js` (and the moved ones named below), the mutants `tools/mutants/groundbolt.json` (29, all
dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "spells cast at the ground outdoors don't collide with it at all and sail straight through" | The streamed world and the fixed city handed the cast engine a collider proxy that carried `raycast` alone, and a missile's flight asked that ray alone. That ray walks the collider's MESHES; outdoors the ground is not a mesh but the host's `heightAt` sampler (`player/collider.js` surfaceHit's own note, MAC-BUG W5). A bolt met a building and never the ground: a Fireball at the grass went under it and on until its lifespan ran out, its blast never thrown. A foe's missile the same | GROUND-BOLT |

## GROUND-BOLT (1) - `src/scenes/hostMagic.js`, `src/scenes/world.js`, `src/scenes/exterior.js`

DFU: DaggerfallMissile.cs:337-339 casts the missile's displacement into the scene's physics, and a Unity terrain has
its own TerrainCollider - DFU's missiles meet the ground, so this is no departure and no Ledger row is owed.

THE CHANGE (as the audit left it):

- The flight's stop is `flightStop` (`hostMagic.js:"export function flightStop(collider, pos, unit, reach, stepLen) {"`),
  the one law of both flights (this engine's and `dungeonContext.js`'s): the mesh ray at the step's whole reach, cover
  (TACT1) by touch, and the terrain by touch - `groundHit`, AUDIT TECH1's march (`player/groundRay.js`, a leaf since
  the audit: the techniques, the engine and a foe's shot ask the one march). It meets a rise as well as a fall, so a
  level bolt into a hillside stops on it (the collider's `surfaceHit` meets the ground on the way down alone).
- `liveCollider` (`hostMagic.js:"export function liveCollider(live) {"`) is the collider a host hands the engine:
  whichever of its colliders the player stands in, asked at each call, whole - its mesh ray and what that ray struck,
  its ground (`heightAt`, `surfaceAt`, `surfaceHit`, `groundNormal`) and its cover. Both exterior hosts hand it in place
  of the bare proxy, one entry for one entry (THE HOSTS DO NOT GROW).
- What else reads the ground: an impact's chunks land on the ground under it (`impactGround`), and its shockwave lies on
  what it struck, a hillside's slope included (`struckSurface`); a Resurrect aimed at the grass beside a fallen mate
  finds the body; a burst does not reach over a crest (`burstClear`); a spell given to a mate or a companion is not
  given across a hill; and a foe behind a ridge finds no clear shot (`enemyMotor.js` hasClearPathToShootProjectile). A
  sky fireball (SUNBABY2) is met by my ground too; its count still lands it where the throw said, where no ground is
  streamed under it.

THE FOUR HOSTS: `world.js` and `exterior.js` wired. `worldModes.js` (interiors) casts through the world's engine, whose
collider follows the door to `interiorCollider` - a room has no ground sampler (`-Infinity`), so the flight's terrain
never moves there; what does is the room's meshes and cover now reaching the engine whole (an impact's floor and plane
are the room's meshes', as the dungeon's engine already had them, and a bolt meets the room's cover). `dungeonContext.js`
builds its engine on its own Collider: no ground sampler underground, its flight `flightStop` now (the same law, the
meshes and cover alone there).

## AUDIT GROUND-BOLT (2026-10-23) - the slice, read cold
