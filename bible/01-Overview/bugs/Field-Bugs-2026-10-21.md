# FIELD BUGS 2026-10-21 - enemy desync, and a player's CPU profile, read to their roots

The owner (2026-10-21): "People are also experiencing enemy dsync", then three screenshots of a player's CPU profile of
the client's main thread from a Discord message - the Come Sail Away boat pool 11%, peer bodies and the network update
10-11%, the Horse Cart pool 11%, grass streaming 11-24%, the naval host 3-4% - with the player's own suggested fixes.
No report said where or when the enemies went wrong, so the live relay (world237) and the account service were read
for the cause, and the profile's every line was traced on the code. Read on the code as it stands at main's
`4bba28c6c`. Multiplayer is the port's own (DFU has no relay), so no DFU member moves; the boats' far cadence names
its departure in `Port-Ledger.md`. The pins are `fb1021_*`, the mutants `tools/mutants/fb1021_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "enemy dsync" | A crowded cell's foes budget dropped the FULL frames first - they carry the sweep, the sites and the grants - so a reader missed deaths and removals and pruned a silent owner's foes; and the handover batches, deltas to the budget, were lost after their owner had let the foes go | FOES-FIRST, HIT-DROPS, AUDIT FOES-FIRST |
| 2 | "enemy dsync" | A slow owner's foes ran slow for everyone and their puppets stalled and jumped: the owner gave them half its clamped frame (FOE-CATCHUP), and a reader led them by arrival time | OWNER-CLOCK |
| 3 | the profile's boat pool, `rendererModelKey` 2.6% | One shape stamp for every tree in the game: any boat built anywhere re-planned every boat; and every boat drawn was walked, baked and lit every frame wherever she sailed | BOAT-STAMP, BOAT-FAR |
| 4 | the profile's Horse Cart pool | Inside 400 m every horse was posed and its palette sent every frame, off-screen and parked ones too | HORSE-VIEW |
| 5 | the profile's peer bodies, Web Worker | Already on a distance cadence (PEER-CADENCE); a worker would move only what is cheap (interpolation, 0.02 ms) | not a defect |
| 6 | the profile's grass | Real, under its budget already (`perFrame`, GRASS_SLICE); the catch-up mode while moving | left (not measured) |

## What the live service showed (2026-10-21)

- **The relay's own counts** (Analytics Engine `daggerfall_relay`, `world` rooms, ten hours): 482,305 frames its byte
  budgets dropped of 17.0 million foes frames - 2.8%. Every drop of a cell is `_foesFan`'s, the one room-wide bucket of
  `FOES_ROOM_BYTES_PER_S`. Over four days the drop rate ran from 0.01% to 1.25% of all frames in, highest at the
  evening's crowds and the Starfall's.
- **The readers' tallies** (`grant_tallies`, its newest 50,000 rows by rowid, about nine hours): 284,994 `ungranted` -
  a foe whose grant its reader never heard; grants ride full frames - from 1,673 owners, read by 1,968 readers, spread
  over every five minutes of the hour. Not one `stats`: the foe bounds removed nothing from an honest owner.
- **The rooms' resets** (Workers Observability): 877 "Internal error in Durable Object storage caused object to be
  reset" across about a hundred rooms, nearly all between 19:00 and 23:00 UTC on 2026-10-20, each closing every socket in
  its room and its foes with them. Nearly none since world237 went out at 00:24 UTC. No cause was found in this code and
  Cloudflare's status page named none; recorded, not fixed.
- **Not readable from here:** the relay's own settings (`grantMode`, `grantStrip`, `grantDoor`), kept in the hub's
  storage and set with `/relay`. Under `enforce`, the 285,000 `ungranted` records a night are foes its readers stand
  down - the owner checks it with `/relay grantMode`.

## FOES-FIRST and HIT-DROPS (1) - `bible/11-Multiplayer/Scale-Arc.md` FOES-FIRST

A room's foes bucket was shared by every owner in the cell, with no order: the deltas (every 200 ms, small) kept a
crowded cell's bucket drained and the full frames (every 2 s, large) lost first. Measured on the real Room
(`tools/foesFirstBench.mjs`): thirty owners of sixty sockets heard 1.2% of their full frames; now 100%, the bytes out
the same. A delta spends the bucket down to `FOES_FULL_RESERVE` (a quarter), a full frame into a debt of a quarter
second at most; a sender's full frame goes first once a `FOES_FIRST_MS`, a frame that hands foes on (an owner leaving,
dying, going through a door) once a `FOES_FIRST_MS` too, and its next frame first once it has been unheard
`FOES_UNHEARD_MS`. The audit found the handovers held as deltas (a crowded cell's heard 29.2%, a star's 0.8%: now 100%)
and a junked frame's sender left unheard (every frame of it first): both fixed. A cell whose full frames alone pass the
budget (the Starfall's eighty sockets) hears 35% of them, never an owner silent past six seconds - but one LARGE owner
among smaller ones, a star's stander, hears none of its full frames (0% before and after; its deltas are heard, so its
puppets stand, but its grants, sites and sweep do not reach a reader: two covens at one star). A claim was tried and
removed (it halved another crowd's full frames); the budget for an event's cell, a pending slot or thinner full frames
is the next slice, `Scale-Arc.md` FOES-FIRST's Left. The new blobs measure it live - blob3 the blows the hit funnels
dropped (silent until now), blob4 and blob5 the full frames dropped and asked. Relay world239.

## OWNER-CLOCK (2) - `bible/06-Systems/Online-Arc.md` OWNER-CLOCK

Every foes and own frame now says its owner's step time (`tm`, ms, wrapped as the pose's stamp is; 14 bytes at most,
0.3% to 3% of a room's foes budget), and a reader leads a puppet by the owner's time between its records, as far as the
owner's own pace of sending (0.3 s to 0.75 s) - a 3-fps owner's foes stood still 35% of the time on a reader's screen,
now 4.8%; a pair carrying one `tm` twice (a clock that stood) is led on the arrival clock. The relay passes `tm` unread
inside `data` - OWNER-CLOCK needs no relay change of its own - and an older reader never reads it. Online with anyone
else in the owner's room (the cell, not only those who see its foes), a slow owner's street foes step its own clamped
frame - 0.1 s at most, in 0.05 s substeps, one extra call a frame and only inside a tenth of the frame's measured time
(none after time away, none on a clock too coarse to price a call) - so they keep pace with its player and never
outrun it, where FOE-CATCHUP alone gave them half of it below 10 fps (three quarters at 15). As first built the same
day they caught up the wall's time instead, three times the player at 3 fps; the audit put them back to the host's
frame. FOE-CATCHUP's row in `Port-Ledger.md` says exactly what changed, for the owner to approve.

## BOAT-STAMP and BOAT-FAR (3) - `bible/07-Rendering/Performance-Priority.md`

Each prefab tree keeps its own shape stamp (`world/prefabNode.js` `prefabShapeStamp(node)`): one tree built a frame
made 747 model keys and an 8.9 ms boat frame; now none and 2.1 ms. A boat past 600 m is walked, baked and lit every
fourth frame on the time she missed, her held walk reused by the flats and the draw, a peer's boat's Animators the
same - the sea's ships' far-life law, moved to `scenes/comeSailAway/farLife.js`: four near and twenty far boats, 4.5 ms
to 2.5 ms. Its audit: a far boat's held walk now ends at any on/off switch in her tree (hidden or shown the next
frame, not up to three later), the stamp's field is `_treeStamp` (the renderer's `_sh*` names are its shadow memory's),
and `setParent` refuses a cycle (as Unity does).

## HORSE-VIEW (4) - `bible/07-Rendering/Performance-Priority.md`

A 3D horse's gait steps every frame; its pose and palette upload wait for the view and the peers' bodies' cadence, a
rider's horse posed with its rider's body, a horse turned into view posed before it is drawn. The cadence - the
horses' and the peers' bodies' alike - is measured from the camera that draws, through its lens (the audit: from the
head, a horse 2.3 m from a zoomed-out third-person camera was posed every other frame, and the spyglass's every
third; now every frame). Twenty peers' horses,
half behind the eye: twenty uploads a frame to 3.7, the pool's frame 0.24 ms to 0.09 ms.

## Left

The Durable Object resets' cause; the relay settings' state (the owner's `/relay grantMode`); a star's large owner and
the budget for a cell whose full frames alone pass it; world238, claimed by two open branches (STAR-TUNE #1090,
GRANT-SLEEP #1066), against this release's world239 - whichever lands after another takes the next number; my own boats' Animators, the road's stranger teams and the standing horses, still stepped every frame; a
slow dungeon or building host's foes, which carry `tm` but step FOE-CATCHUP's half of its frame (flagged in
`Online-Arc.md`).
