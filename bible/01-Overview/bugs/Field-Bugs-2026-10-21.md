# FIELD BUGS 2026-10-21 - the Discord's bug-reports, read to their roots

Five threads from the Discord's #bug-reports (2026-10-21), handed over as screenshots with no word beside them: from
Dûmorîkh, grayhatharry, LEGALISE ARO..., 4M and Boar, and Prefixo. Each was traced end to end on the real producers, with
the freeware's data (`tools/fetch-data.sh`) where the map decides. Read on the code as it stands at main's `4bba28c6c`.
The calls the reports left open are taken here, under the owner's standing word on these threads (Mac, 2026-10-19: "Stop
with the decisions for me"); each section says which it took and why. The pins are `fb1021_*`, the mutants
`tools/mutants/fb1021_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Dûmorîkh: "Sailing Vessels Sometimes Have No Propulsion" - "This is only with sails. Oars work fine." | A save made below ground keeps the indoors' wind - none - and a load that lands outdoors (online a dungeon save wakes at a temple or town) restored it on the open sea: no way and no pull under sail, the oars untouched, until the game's next hour; a restart's exit save kept it | SAIL-WIND |
| 2 | grayhatharry: "I had a quest that wanted me to sail from one port to another ... he informed me I hadn't sailed at all" | open: traced - a slow boat's departure dragged to the edge of its port's waters, a boat run aground or left at speed never berths, a load forgets the departure, and Pencart's waters were all Longham's | - |
| 3 | LEGALISE ARO...: "Equipping the lantern with O still puts it into your shield slot and not the lantern slot" | The world hangs a lit lantern at the hip whenever Handheld Torches' waist switch says so (shipped on), and the inventory read the belt's mark alone: the O key's lantern was drawn in the shield's hand, the lantern slot empty | BELT-WAIST |
| 4 | 4M and Boar: "Crashing every minute" - "No message just black", "when I enter dungeons or traveling overworld" | open: traced on this branch | - |
| 5 | Prefixo: "Soul Cake stopped dropping" - "still stuck at 122" | The day's cap (120 a UTC day), reached in under an hour of undead, answered every find past it with a miss's own `{ found: 0 }`: nothing said there was a cap, or when it ends | CAKE-CAP-SAID |

## SAIL-WIND: a load outdoors lays the outdoors' wind (1)

`src/systems/comeSailAway/csaLoadWind.js` (`windStaleOutdoors`), `src/systems/comeSailAway/comeSailAway.js` (OnLoad).

FOUND. Both screenshots read the helm's panel with the sails up - its first button is "Stow sails" (the toolbar is
`helmButtons`' order) - at 0.1 knots in a Small Ship and 0.0 in a Large Boat, online (no time dial). Under the Responsive
helm (the default) a ship under sail makes nothing at exactly one wind: none. Driven over every hull, all seven Large Boat
rigs and 24 headings at the base wind, the slowest was 1.47 m/s and no heading is in irons; a wind of a millionth still
drives a Small Ship at 4.31 m/s; a wind of nought drives nothing, because the sails' way and their pull both read it
(`helmWay.js:"export const seaWind = (windLen) => (windLen > 0 ? WIND_RATED * windShare(windLen) : 0);"`) - so whatever
way she had when the sail went up is all she keeps. The oars read no wind, which is "Oars work fine".

Where the nought comes from: Come Sail Away lays no wind indoors (`comeSailAway.js:"if (deps.isPlayerInside()) {"`, both
vectors zeroed), its save keeps the wind as it stands (`comeSailAway.js:"data.windVector = v3(state.windVectorCurrent);"`),
and its load restores it (`comeSailAway.js:"state.windVectorCurrent = arr3(data.windVector);"`) with no new roll - OnLoad
(ComeSailAway.cs 1943-1950) only shows the boats and the waves. In Daggerfall Unity that is whole: a save made indoors
loads indoors, and the next door lays the outdoors' wind. Here a load can land OUTDOORS from a save made below ground -
online a dungeon save always wakes at the nearest temple, town or graveyard (`world.js` ONLINE-UNDERGROUND-LOAD1), and a
dungeon that cannot be entered or found, or a save made elsewhere, is restored outside - and the mod loop then laid the
indoors' none on the open sea. Nothing laid a wind until the game's next hour (OnNewHour: two and a half real minutes
online, five offline), a change of weather or a door; and a restart inside that window re-saved the nought at the exit
(`exitAutosave`) for the next load - "restarts have been attempted". The chat's tip ("the local map to travel a bit")
worked because travel moves the clock past an hour. Measured on the real runtime (`test/csaScene.mjs`): saved below ground,
loaded outdoors - a Small Ship's W, W (a quarter second at the oars, then sail) held 0.12 knots for two minutes; a Large
Boat raised sail from rest and made 0.00; one rung down to the oars, 1.94 and 3.89; after OnNewHour, 19.89 and 6.63.

THE LAW NOW. A load that lands outdoors under a wind of nought asks the door's own call, UpdateWind, for the player's
weather (`comeSailAway.js:"if (windStaleOutdoors(deps.isPlayerInside(), state.windVectorCurrent)) UpdateWind(deps.weatherType?.() ?? WEATHER_TYPE.Sunny);"`).
Outdoors UpdateWind never lays a nought (a fog's tenth of 1 is its least), so a nought outdoors is only ever the indoors'
brought out; a load indoors keeps the indoors' none, and a wind its save carried stands. The world settles where the
player landed before the mod loop restores the runtime, so the runtime's OnLoad reads the landing. The same chain after:
19.89 knots and 6.63 under sail. A departure from ComeSailAway.OnLoad, named in Port-Ledger A (SAIL-WIND).

NOT THE CAUSE, measured and ruled out: the wind's heading under the Responsive helm, fog and storm (a share of 0.3 to 2),
hull damage (never under 0.35 of her way; a rig shot away lowers the sails and says so), the refits and crew, the
heave-to, cargo and the serpent (each stops the oars too), a beached or blocked boat (her sails come down: the button reads
"Raise sails"), the online wind (each machine rolls its own). Under the Classic helm (a player's own choice) the square-sail
assist stows a Large Galley's and a Large Boat VII's canvas with the wind ahead of the beam and a Small Ship has a dead band
about 30 degrees off the wind's eye - the Classic model as built, within the "In irons" hint's 40 degrees; the screenshots'
panels show no such hint.

`test/systems/comeSailAway/fb1021_sailwind.test.js` (4): the chain on the real runtime, saved below ground and loaded
outdoors - a Small Ship under sail and a Large Boat raised from rest make way; a load indoors keeps none and a load outdoors
keeps the wind its save carried; the predicate. `tools/mutants/fb1021_sailwind.json` (3, 3 dead).

## BELT-WAIST: the lantern at the waist is the slot's (3)

`src/systems/beltLantern.js` (`waistLanternOf`), `src/ui/enhanced/enhancedInventory.js` (`equippedModel`, `lanternGroup`),
`src/systems/handheldTorches.js` (`lanternFirst`, `toggleLightPress`, `waistPress`), `src/systems/quickslots.js` (the
hotbar's light arm).

FOUND. O is Handheld Torches' TorchToggleLight (`inputActions.js:"['KeyO', 'TorchToggleLight'],"`), and its press lights
the pack's first lantern through PlayerEntity.LightSource's one door - it never marks one for the belt. BELT-LANTERN
(2026-10-20, `10-UI/UI-Arc.md`) gave the lantern its own socket and the item its mark (`beltLantern: true`), and the
inventory's hand row took a light only when it was NOT marked. But the world asks another question:
`playerTorch.js` lanternAtWaist is the mark OR Handheld Torches' "lanterns at the waist" switch, which ships on
(HT-WAIST-ON), and the hand law, the first-person sprite, the Morrowind body and the light itself all ask it. So with the
shipped settings a lantern lit by O hung at the hip in the world while the inventory drew it in L·Hand - the panel the
shield's slot shares - and the Lantern socket stood empty. The card's Light, a double-click (the pack's Use) and the
hotbar did the same. Measured with shop-minted items (`stockShopShelf`) and the real press (`createHandheldTorches`):
O -> lit, unmarked, at the waist, in the hand's row, the socket empty. DFU has no light slot (its GetEquipSlot answers
None for every light); the only DFU member here is PlayerEntity.LightSource, unchanged.

THE LAW NOW. One question, `beltLantern.js` waistLanternOf: the lit light where it hangs at the waist (lanternAtWaist),
else the lantern on the belt, unlit. The hand's row holds the lit light only when it is not that lantern
(`enhancedInventory.js:"const light = entity?.lightSource && waistLanternOf(entity) !== entity.lightSource ? entity.lightSource : null;"`),
and the socket draws it (`enhancedInventory.js:"const item = waistLanternOf(deps.entity);"`). Three more paths were wrong
the same way, found on the way:

- O lit the pack's first lantern even with another hung on the belt - the hung one stood dark while a second hung lit
  beside it. A press now lights the slot's lantern first (`handheldTorches.js:"const lanternFirst = () => beltLanternOf(ctx?.entity) ?? firstOf('UselessItems2', T.Lantern);"`),
  on the mod's ladder and its remembered-light branch alike.
- With the switch off, a hung lantern behind a shield and a drawn sword was refused ("You can't hold a light source right
  now"): the waist branch read the switch alone. BELT-LANTERN's own word is that a hung lantern takes no hand; the branch
  now runs with a lantern hung (`handheldTorches.js:"if ((w.s.lanternsAtWaist || beltLanternOf(ctx?.entity)) && !hasFreeHand() && waistPress()) return true;"`).
  An unhung lantern with the switch off still asks a hand.
- The hotbar's lantern slot took the shield off (SHIELD1's torch law) and an off-hand weapon refused it. A lantern at the
  waist takes no hand, so its slot does neither (`quickslots.js:"const atWaist = lanternAtWaist(hotbarView(entity)[i]?.item);"`);
  a torch's slot still takes the shield off first.

A torch and a candle are held, as Handheld Torches holds them, and stay the hand's row.

`test/systems/fb1021_beltwaist.test.js` (8): the report through the real O press, the socket drawn lit in the mounted pane,
the pack's Use, a torch and a candle still in hand, the hung lantern first (and on the remembered light), the switch off
behind a shield and a drawn sword, the hotbar beside a shield and an off-hand weapon. `tools/mutants/fb1021_beltwaist.json`
(9, 9 dead).

## CAKE-CAP-SAID: the day's cakes, said (5)

`server-account/src/festival.js` (`findFestival`, `festivalOf`), `src/systems/festival/festivalClient.js` (`learn`,
`festivalFindsToday`, `askFind`), `src/systems/festival/festivalWords.js`, `src/ui/wyrdWindow.js`,
`src/scenes/witchesHost.js`. Account service acct166, no migration.

FOUND. A find is decided by the account service's die and capped by the day (`06-Systems/Witches-Festival.md`):
`FIND_CAKES_PER_DAY` cakes a UTC day. Once the day's 120 were found, `findFestival` asked its die for nothing
(`want` was 0) and answered `{ found: 0 }` - word for word a miss. The refusal `capped` went out only once the day's
1,500 ASKS were spent, and the page said nothing for either: `askFind` speaks only when `found > 0`. Measured on the real
service over the real migrations (`test/accountDb.mjs`), an undead kill every 12 s from the release (21:10 UTC,
2026-10-20): the 120th cake at kill 231 (21:56 UTC), then 619 kills to midnight with none; from 00:00 UTC it found again.
Through the whole path - the kill listener, `askFind`, the Worker's route - 729 answers of `found: 0` and not a line.
Prefixo's 122 is the 120 found and two taken from others' Hearth Offerings (a take is no find). "Yesterday" was the
release's evening; the cap rolls at 00:00 UTC, 20:00 on the US east coast.

THE CALL: the cap stands, said. It is the service's guard against a forged client, and the Wyrd Sister's prices lean on
it - her whole stock, 865 cakes of the twenty wares, is 7.2 capped days of the festival's 19. What was wrong is that
nothing said it, and that the page kept asking: every kill past the cap was still a write to the service's primary.

THE LAW NOW.

- The service says the day: a find answers `today`, the cakes found this UTC day with its own, and `capped: true` once
  they are all found (`festival.js:"return { found, cakes: await cakesOf(db, player.id), today, ...(today >= FIND_CAKES_PER_DAY ? { capped: true } : {}) };"`);
  the account's festival answers `today` from the same row. A 200 still, so a page from before reads it as it did.
- The page learns it (`festivalFindsToday`: a count said on an earlier UTC day is today's nought), says the day's end ONCE
  a UTC day an account - *"You have found all 120 Soul Cakes a day allows. More can be found from 8:00 PM."*, the hour the
  player's own clock reads at the next UTC midnight - and asks nothing more until the day turns
  (`festivalClient.js:"if (festivalFindsToday().full) { sayDayFull(); return 0; }"`). The asks' own refusal ends the day
  the same way. A player back after the cap is told at the first kill.
- The Wyrd Sister's window counts it under her name: *"Found today: 87 of 120 Soul Cakes."*, and once spent *"Found
  today: all 120 Soul Cakes. More from 8:00 PM."* - and its watch repaints when the UTC day turns with it open.

The three lines are drafted in the thirteen whole languages (`festival.finds.*`).

`test/server/witch1_festival.test.js` (CAKE-CAP-SAID: a winning roll past the cap answers `capped`, the account's festival
counts the day, a new UTC day finds; the find pins moved to carry `today`); `test/systems/festival/fb1021_cakecap.test.js`
(5): the find that ends the day and the day's end said once, nothing asked after, the next day asked again; the asks'
refusal; a player back after the cap; an older service (no `today`) asked and silent as before; the window's line and its
day-turn. `tools/mutants/fb1021_cakecap.json` (10, 10 dead). The version's pins moved to acct166.
