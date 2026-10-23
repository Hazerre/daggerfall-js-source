# FIELD BUGS 2026-10-23 - players on a deck, drawn in lurches

One report, from the owner: "I notice with sailing. Players on board the ship jitter while sailing instead of staying put.
Other players also slide when on board your ship/npc ships". Read on main's `dab1e710d`. Every system it touches is the
port's own (Come Sail Away is single-player and DFU has no second player to stand on a deck - `03-World/Come-Sail-Away.md`
"Sailing together (CSA-K)"), so no DFU member moves and no Ledger row is owed. The pins are
`test/net/peer/deckpose.test.js`, the mutants `tools/mutants/deckpose.json` (16, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Players on board the ship jitter while sailing instead of staying put. Other players also slide when on board your ship/npc ships" | Another player aboard a boat - mine, another's, a booked passage's ship - was stood on her deck by the foes frame's `ab` alone: five words a second at most, only when it changed, the full frames alone (one in two seconds) through a crowded cell's relay, each eased toward. A body walking her deck lurched and slid on after it stopped | DECK-POSE |

## DECK-POSE (1) - `src/net/wire.js`, `src/net/online.js`, `src/scenes/comeSailAway/comeSailAwayAboard.js`

MEASURED FIRST, on the real modules (each a replica of one screen's frame in its own order):

- The passenger's own screen, on Come Sail Away's real pool and the real motor and collider (FB1001b's rig): another's
  Small Ship sailing at 6 m/s and turning 6 degrees a second, her owner's words every fifth of a second up to 50 ms late,
  frames at 40, 60 and 144 a second with their lengths spread by a third. The feet stood within 0.1 mm of their place on
  her deck for 20 s, the eye within 0.4 mm, aboard every frame, one word said. Steady.
- The owner's screen, on the real Come Sail Away runtime at the helm (csa_sailing's scene): a passenger stood a frame ahead
  (`scenes/world.js` csaPoseAhead) against where her deck stood once the frame had moved and rocked her - within 0.5 mm in a
  calm, 1.6 cm at the storm's wind. The helmsman, pinned to the wheel, never read as walking on her rocking deck.
- A third player's screen: the glue on the copy their word leads (`poseAhead`) - exact.
- A player WALKING a deck, on every screen but their own: the glue (`glue`) eased toward the foes word's place, which is
  said every FOES_MS (200 ms) when it changed. A walk of 3 m/s was drawn at 0.5 to 7.7 m/s, five lurches a second, and
  went on 0.42 s after the walk had stopped (the body standing, its clip done). On a crowded cell's relay (FOES-FIRST keeps
  the full frames alone) the body stood still two seconds, then ran 6 m at 33 m/s. That is the report: aboard, a player
  is never standing quite still - a step, a turn to the rail - and each is drawn as a lurch and a slide on the deck.

WHY. CSA-K put the place aboard on the foes frame because "the pose frame could not carry it: the relay's `validPose`
projects the pose field by field and a new field would be a relay change (every player dropped)". The pose is the one
stream a body is drawn from - ten a second, played out at the sender's own pace with a cushion for the line's jitter
(NET-SMOOTH, SCALE2b) - and the place aboard was the one part of the body's place that did not ride it.

THE CHANGE - the place rides the pose:

- THE DOOR (`src/net/wire.js` validAboard, validPose's `ab`): `[owner, slot, x, y, z]` - the owner's id (a name, at most
  POSE_ABOARD_OWNER_MAX), which boat of their word (under POSE_ABOARD_SLOTS - Come Sail Away's CSA_WIRE_BOATS_MAX is this
  one), the feet in her own frame within POSE_ABOARD_LOCAL_MAX each way (CSA_ABOARD_LOCAL_MAX is this one), to the cm,
  never a -0. Out of any bound it is no place, never clamped, and the pose stands; ashore it is absent, the bytes a pose
  always had. The foes word's door (`validAboardWord`) is the same law. RELAY_VERSION world250 (world248 on its
  branch, renumbered past main's world248 and world249 at the merge); its deploy drops every connected player once, as
  every relay change's does. A relay before it strips the field and keeps the socket, and the reader stands the sender
  by the foes word as before.
- THE SENDER (`src/net/online.js` poseAboard, sendPose): each pose said carries my place aboard while the host names one -
  `scenes/world.js` csaDeckWord, the one place the foes word says too (another's deck, or my own helm).
- THE PLAY-OUT (`lerpPose`, `aboardAlong`): between two poses on one deck the place is eased as the feet are; onto a deck,
  onto another owner's or another of their boats, or from ashore, the newer whole (a place in one boat's frame is no place
  in another's); ashore, none. The drawn place is its own copy.
- THE GLUE (`scenes/comeSailAway/comeSailAwayAboard.js` glue): the drawn pose's place stands the body on that deck as it
  is drawn here, at once. One whose poses have carried a place and is drawn without one is ashore, whatever their last
  foes word said (it comes a fifth of a second and more late); a sender whose poses never carry one - an older build, an
  older relay - is stood by the eased word as before. The foes word is still said: the older readers', and the owner's
  pack refusal counts the passengers by it.

MEASURED AFTER, through a real session (fake socket, fake clock, poses 40-90 ms late): the walk across her deck at 3 m/s on
every frame but a play-out's hold - the session's own law, on land as on a deck - never past it, stopped where it stopped
within a play-out's delay and stood there, never off its line as the deck sailed on.

"NPC SHIPS". A booked passage's ship is Come Sail Away's boat of her hull (`03-World/Passage.md`, navalHost charter), so
her passengers and her helm are this path's. The sea's own ships under sail - a merchantman, a pirate - carry nobody who
stands on their decks: they stand in the player's collider (`navalHost.js` collidable) but no deck carries a body by
their move, here or on another's screen. Not changed here.

FOUND BESIDE IT, NOT CHANGED: `net/online.js` lerpPose carries no `pl` (EG-H1's ridden pose, `11-Multiplayer/Elite-Gates.md`
section 10.8), so the session's play-out drops it and `rideAt` never meets a ridden peer through the tick - the same gap
as this one, on the Spire's moving pieces. Its pins drive `rideAt` directly.

PINS MOVED: `test/net/peer/fbsea_deck.test.js` and `test/systems/csa_together.test.js` (the place said is world.js's
csaDeckWord); `test/net/eliteGates/egint_client.test.js` (sendPose lays the ride and the place); the RELAY_VERSION pins
(world250) and SLAM8's law row (`test/net/relayversion.test.js`); five mutant records re-aimed by content
(`csa_together.json` - the door's bounds now `wire.js`'s - `fbsea.json`, `soc1.json`).
