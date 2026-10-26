# Lockpicking - the tumblers and the Lockpick (LOCKPICK, 2026-10-26)

The owner, 2026-10-26: **"I want to build a detailed lock picking minigame and introduce a lockpick item."**

DFO Online's own (SCOPE1, `01-Overview/Port-Doctrine.md`): Daggerfall rolls a chance and says a line; this page is the
record of what replaced the roll, why, and where DFU's law still stands under it.

## 1. What stood (FACT, read before building)

DFU's lockpicking is one roll a site, no item, and a retry gate:

- **A dungeon's door** - `DaggerfallActionDoor.AttemptLockpicking` (DaggerfallActionDoor.cs:147-191), ported 1:1 at R1 as
  `world/actionSystem.js` `attemptLockpicking`: in Steal mode a locked door tallies Lockpicking once, rolls
  `Dice100.FailedRoll(CalculateInteriorLockpickingChance)` - 5 x (level - lock) + Lockpicking, 5..95 - and opens, or records
  the failed skill (`FailedSkillLevel`) so the next try waits for the skill to move. A lock of 20 and up is magically held:
  a failure with no roll.
- **A building's front door** - `PlayerActivate.ActivateStaticDoor` (PlayerActivate.cs:512-568), ported at R1 into
  `scenes/worldModes.js` `activateStaticDoor`: Steal mode rolls `CalculateExteriorLockpickingChance` - Lockpicking -
  5 x lock, 5..95, no level term - against `Random.Range(1, 101)`, the per-building anti-grind record
  (`PlayerGPS.LastLockpickAttempt`) gating the retry, and a success tallies the Thieves Guild's break-in (CG2,
  PlayerActivate.cs:552) and raises `isBrokenIn`.
- **A locked chest or crate underground** - the port's own (SEARCH1, `06-Systems/Searchables.md`): the interior chance,
  rolled with no gate; PVPFIX let Grab mode try it too.
- **No item.** DFU checks no inventory (AttemptLockpicking's own comment in the port says so). The skill was the only
  thing a pick spent.

Nothing else in the port picks a lock: a building's own doors are never locked (`scenes/interiorContext.js` builds its
action graph with no lock skill), and the look-at text (`lookAtLockText`, PlayerActivate.cs:978-1008) is unchanged.

## 2. The Lockpick (DECIDED and BUILT)

**A lock needs one.** Steal mode at a locked door, chest or crate opens the lock's window only with a Lockpick in the pack;
none, and the lock says "You need a lockpick to pick this lock." - nothing rolled, tallied or spent. A pick that snaps in
the lock is gone. That is the departure the item exists for (section 6), so the pick is made easy to come by:

- **Template 584** (`systems/lockpick/lockpickRow.js`, a leaf the item law reads headless - the Weir Key's KEY-LAW shape;
  `systems/lockpick/lockpickItem.js` its home): "Lockpick", miscellany (UselessItems2), 0.05 kg, 12 gold, stacked, traded
  freely, rarity 20 (no DFU shelf draw, no loot table rolls it). Its own picture, painted in code under pseudo-archive
  38321 (`systems/lockpick/lockpickArt.js`: a hook pick with a leather-wrapped grip over an L-shaped tension wrench, on the
  Hour's paint box - nothing read from ARENA2). Its card says what it is for; its Use says how a lock is picked.
- **Every General Store's and Pawn Shop's counter** keeps a stack of 25 (`ENDLESS_LOCKPICK_STACK`), ENDLESS-STOCK's way
  (`systems/shopStock.js`): stood from no roll after DFU's draws, so the day's DFU stream is untouched; online a purchase
  stands it whole again (`restockEndless`), offline it sells out until the day's restock, as the Rations do.
- **A class that holds Lockpicking** - primary, major or minor - sets out with 5 (`LOCKPICK_KIT`, `systems/startingGear.js`
  addSurvivalProvisions, the port's own tail), and a character from before the lockpick is given the same once, as its
  save is restored - the Wallet's gift (`systems/save/save.js` restorePlayer; the save's `lockpickGift` mark).
- **A rogue's pockets** (`ROGUE_LOCKPICKS`, an enemy loot extra - `systems/loot/loot.js` registerEnemyLootExtra): a
  Burglar or a Thief carries 1-3 three times in five; a Rogue 1-2 three in ten; a Nightblade, an Acrobat or an Assassin
  1-2 one in four; a Bard one, one in seven. On the roll's own dice (PARTY-LOOT's law), so a room's shared base and a
  player's bonus each draw their own.

## 3. The tumblers (DECIDED and BUILT - `systems/lockpick/lockpickLaw.js`, `lockpickAct.js`)

A lock is a row of pin stacks - a spring, a steel driver pin and a brass key pin each - over the plug. The pick sits under
one pin at a time.

- **How a lock is built, by its value.** Pins: 2, one more each 4 of lock, 6 at most (`pinsFor`): a front door (quality /
  2, 0-10) has 2-4, a chest (1-15) 2-5, a dungeon door (2-18) 2-6. Spool pins: one from a lock of 8, two from 14
  (`spoolsFor`), never the first to bind. The order the pins bind in is the lock's own - a shuffle by the lock's name
  (`lockSeed`, FNV-1a; `bindingOrder`) - the same every visit and on every client, so a lock remembered is a lock half
  picked.
- **One press, lift or set.** A press at a pin at rest LIFTS it. The BINDING pin (the next in the order) rises heavily to
  the shear line (0.16 s, each lift its own, up to 30% either way), HANGS there for the lock's window, and falls back
  (0.32 s). Any other pin is FREE: it springs up and straight back (0.22 s) and never hangs - the feel that tells it apart.
  A press while a pin moves is a SET: the binding pin pressed while it hangs (or within 50 ms of the hang either side)
  sets - it stays above the line and the next pin binds. A spool only FALSE-SETS the first time (the plug turns back a
  hair): lift and set it again.
- **DFU's chance is the tolerance.** The window a binding pin hangs for is 0.18 s at DFU's 5% to 0.60 s at its 95%
  (`setWindowS`, the site's own formula - interior underground, exterior at a front door), times the Agility band
  (Foraging's four, x0.85 to x1.30 - the acts' own, `net/professionLaw.js` actBand). From Lockpicking 50 the binding pin is
  told apart before it is lifted (its chamber lit).
- **What a mistake costs.** A press off the hang - the binding pin rising or falling, a free pin mid-bounce - SLIPS: the
  pick snaps at 0.55 of the chance DFU's roll would fail, 4% to 60% (`slipBreakChance`); if it holds, the last pin set
  drops, and the tension it lost takes any false set with it. Forcing a free pin (lifting a pin that is not binding) snaps
  the pick at 0.35 of that - probing is not free, which is what makes the sense and a remembered order worth having (a
  round-robin tap at one pace opened a six-pin lock with no risk before this, found in the first Chromium run, section 9).
  A snap drops every pin; the next pick starts over.
- **The Auto attempt** is DFU's roll itself, each site's - underground `Range(0, 100) < chance`, a front door
  `chance > Range(1, 101)` (`autoOpens`): the lock opens, or a pick snaps.

| Lock | Pins | Spools | Window at chance 50 | Snap on a slip at 50 | Free pin forced at 50 |
|---|---|---|---|---|---|
| 1-3 | 2 | 0 | 0.39 s | 27.5% | 9.6% |
| 4-7 | 3 | 0 | 0.39 s | 27.5% | 9.6% |
| 8-11 | 4 | 1 | 0.39 s | 27.5% | 9.6% |
| 12-13 | 5 | 1 | 0.39 s | 27.5% | 9.6% |
| 14-15 | 5 | 2 | 0.39 s | 27.5% | 9.6% |
| 16-19 | 6 | 2 | 0.39 s | 27.5% | 9.6% |

(The chance itself falls as the lock rises: at a dungeon door a level-15 character of Lockpicking 50 has 95% at lock 2 and
35% at lock 18 - DFU's interior formula.)

**The skill.** Lockpicking is tallied once an attempt, as DFU tallies it - and an attempt ends in a snap or an open, so a
snap tallies once and an open tallies once; a lift, a slip held or a window left tallies nothing (a window left and come
back to is no grind: nothing was spent).

## 4. The window (DECIDED and BUILT - `ui/lockpickWindow.js`, `ui/lockpickDoor.js`)

A window redesigned on purpose - Daggerfall has none - so it cites this section under THE NATIVE-WINDOW RULE's SCOPE1
sentence (`Home.md`). The DOM doors' shape (`ui/brokerDoor.js`): a fixed panel in the house's stone and brass
(`ui/enhanced/enhancedFrame.js` FRAME_TONES) on both skins - a lock is picked offline on the classic skin as online on the
enhanced - registered on the overlay stack, handed to the host's slot.

- **Its head** says what is being picked ("Picking the door", "Picking the chest") and DFU's look-at line for the lock at
  this hand (`lookAtLockText`: "This lock looks difficult...").
- **The lock** in cross-section on a canvas: the housing over the plug, the shear line between; a chamber a pin - its
  spring, its driver pin (a spool's waisted), its key pin cut to its own length; a set pin's driver held above the line and
  its key pin dropped back - the gap a set pin leaves; the pick along the keyway, its tip lifting the pin it is under; the
  tension wrench at the keyway's mouth. A false set turns the plug back a hair, a snapped tip falls, the opened plug turns.
- **Under it** the words for the last press (every answer its own line, two lines held so the window never jumps), the
  picks left, the pins set, the Lockpicking, and two presses: **Auto attempt (Q)** and **Leave (Esc)**.
- **Played with** Left / Right or A / D or a pin's number to move the pick; Space, Up, W or Enter to lift and set; the mouse
  over a chamber moves the pick there and a click presses; a tap on a chamber on a phone does both; a host's mapped
  gamepad press reaches it through the door's `input`. Esc leaves; the overlay stack's close leaves.
- **Accessibility.** Under Gentle work (the professions' accessibility setting, `gentleActs` - "crafting and gathering
  need no timing") the tumblers are shown and only the Auto attempt is offered: no timing, DFU's plain result. Under the
  system's reduced motion the plug never shakes and nothing pulses; the pins still move - their moving is the lock. Every
  cue is a shape, a word and a sound as well as a colour.
- **The world goes on online** under it, as under every window there; offline the slot holds the frame as every window
  does.
- **The ear** (`systems/lockpick/lockpickSounds.js`): seven clips of ours (`tools/lockSfx.mjs` -> `public/sfx/lock-*.wav`,
  provenance in `public/sfx/SOURCES.md`) - a pin lifted, a free pin springing, a pin set, a false set, a slip, a snap -
  on the enhanced skin's port sounds; off them, DFU's button click where a pin sets and nothing else. The opened lock
  still sounds DFU's own chime (ActivateLockUnlock) in the world, as the roll's success did.

## 5. Where (THE FOUR HOSTS RULE, HOST-SPLIT)

One home, `scenes/lockpickHost.js` (`createLockpickHost` - `begin`, `inside`, `frontDoor`), wired where the roll stood:

- `scenes/worldModes.js` - a building's front door in Steal mode: `lockpick.frontDoor` where :543-566 rolled; opened, CG2's
  tally, the success line and DFU's chime (the host's `frontDoor`, PlayerActivate.cs:552's order), and the door is
  activated again `picked` - `isBrokenIn` raised as the pick always raised it. The refusal in every other mode is DFU's,
  unchanged. The street's slot (townTalk).
- `scenes/dungeonContext.js` - a dungeon's door: `world/actionSystem.js` hands a lock under 20 to `onLockpickAttempt`
  (the magic arm stays the roll's), and the opened lock comes back through `lockpicked(o)` - AttemptLockpicking's success
  tail (the lock zeroed, the door opened) on the WORLD3 change seam, so a peer sees it as it saw the roll's. A locked chest
  or crate: `lockpick.inside` where SEARCH1 rolled; opened, marked picked and searched. The dungeon's slot.
- `scenes/world.js` - wires neither: its doors are worldModes' and its dungeons dungeonContext's.
- `scenes/exterior.js` - the fixed city's building doors are worldModes' too (`createWorldModes`), so it picks as the
  street does.
- A building's interior (`scenes/interiorContext.js`) has no locked door to pick.

`createWorldModes` and `buildDungeonContext` stay under their ceilings (`test/scenes/hostceiling.test.js`): the front
door's arm is shorter than the roll it replaced, and the host module defaults the page's singletons (the player, the
mid-screen line, the bus).

## 6. Departures (Ledger A, LOCKPICK)

- **A lock needs a Lockpick, and a snapped pick is spent** - DFU checks no inventory (`DaggerfallActionDoor.AttemptLockpicking`,
  `PlayerActivate.ActivateStaticDoor`).
- **The roll is played** - the chance DFU rolls once is the minigame's tolerance; the Auto attempt keeps the roll itself.
- **DFU's retry gates are not read** for a lock a host plays - `DaggerfallActionDoor.FailedSkillLevel` and
  `PlayerGPS.LastLockpickAttempt` ("the skill must rise past the last failure"): a snapped pick is what a retry costs now.
  Both fields still ride the save (`failedSkillLevel`, `lastLockpickAttempt`), and a host with no lock window (a test's
  bare graph) keeps DFU's gate whole.
- **The tally** is DFU's once an attempt, with an attempt ending in a snap or an open (DFU's ended in its one roll).

## 7. Not built, named

- **No crime for being seen picking.** DFU has none (the break-in is tallied on the open, as CG2 has it); the town watch's
  eyes on a picker would be its own slice.
- **No lockpick quality** (an iron pick, a dwarven one). One template, one stack.
- **A building's own doors** stay unlockable, as DFU's.
- **The window's world goes on online** - a foe can reach a picker; the window closes under a death or a transition as
  every window does (the slot's replace disposes it, and its success tail never runs).

## 8. The four process laws, applied

- ONE DFU MEMBER, ONE EXPORT: the chances are `world/actionSystem.js`'s (interiorLockpickingChance,
  exteriorLockpickingChance), the look-at line `lookAtLockText`, imported, never typed again.
- EVERY ALLOCATION HAS AN OWNER: the window's animation frame, its key listener and its DOM leave with it; a host's
  `dispose` shuts a window still up (the dungeon's `destroy`).
- THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the door's `done` reads true only once its DOM is gone; its `onClose`
  runs once, last - and the opened lock's tail runs from it, after the window is gone.
- TEST THE SHAPE THE PRODUCER MINTS: the tests mint the Lockpick with `lockpicks()`, the counter's stack with
  `ensureEndlessLockpicks`, the rogue's with `rogueLockpicks` over the real EnemyBasics rows.

## 9. Pinned

- `test/systems/lockpick/lockpick.test.js` (20): the law by value; the machine played (a clean hand, a slip held and
  snapped, the grace, a free pin forced and spared, a spool's false set lost to a slip, the rise's jitter, the Auto
  attempt at both sites' rolls); the item (its row and the law headless, the picture, the counter's stack and its online
  refill, the kit and the gift, a rogue's pockets); the host (no pick, a snap, the last snap, an open's tail after the
  shut, a window left, a dead host, the front door's order); the window's geometry and words; the ear; the sites (the
  dungeon's hook below the magic arm and its seam, the chest, the front door).
- `tools/mutants/lockpick.json` - 49 mutations, all dead (the first run's one survivor, a picked door picked again
  swinging shut, closed by its own pin).
- PIN MOVED: `test/net/world3.test.js` (`lockpicked` rides the seam), `test/systems/roadb_door_bash.test.js` (the window,
  not a tally, inside the ladder a bash skips), `test/ui/hud/audit64_hud.test.js` (one look-at line at a front door - the
  anti-grind one retired), `test/systems/shopstock.test.js` (the counter's Lockpicks), `test/systems/l10n4_hardcoded.test.js`
  (the archive registry's row), `test/tooling/doctrine.test.js` (the seven clips).
- Played in Chromium (the window over the real machine and door, a desktop and a phone viewport): a six-pin lock with two
  spools opened by keyboard; a phone's taps snapping the last pick into "Your last lockpick snaps!" with only Leave left;
  Esc shutting it with its DOM gone.
