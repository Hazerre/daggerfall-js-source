# The Sky-Ketch - a Rourken airship over Daggerfall, and its raid (KETCH)

> Design page and record. Written 2026-10-24 with the code, as built; its live run's findings are section 15. The code's
> comments cite this page by section number; where the page and a pin disagree, the pin is what runs.

## What the owner asked for

The owner, 2026-10-24: *"A new quest line and world event that takes you to the skies with proper lore. A proper dwarven
airship flies in once a week over the skies of daggerfall, and you, along with other players venture into it in a raid
like format. Adapting aspects from all the raid like mechanics and details we have developed this far and implement a
new mechanic where players have to pick up an item and bank it to progress. The ending should be a proper dweamer boss,
there should be platforming. Really go all out for this. Imagine navigating the ketch of destiny? Different rooms with
different encounters. A chance to drop both guns with a gilded version of each gun."* Then: *"Make the dwarven event 8
player"*. And of the guns: *"Reduce the drop rate of gilded weapons across the board and ensure any gun drop is rare,
only found within this activity"* (`06-Systems/Gilded.md` section 10).

So, as decided here:

- **Online only, on the real clock.** The Ketch is a fact about the shared world, like the gate and the Hour: she comes
  every Loredas, the relay runs each crew's ship, signs each earner's receipt, and the account service pays the week's
  share. Offline there is no Ketch.
- **One party, one ship.** A crew is a party - eight at most, the party's own bound (`net/wire.js` PARTY_MAX) - and each
  crew boards its own copy of her (an instance, `11-Multiplayer/Instances.md`'s law): the captain's ship, the captain's
  party aboard. A member rides back up to the ship it was taken into, whoever leads the party since (AUDIT KETCH L1-6,
  `ketchShipChoice` - the room's `st` naming it keeps the ship on the device; its door saying it is not of that crew
  forgets it).
- **Rooms, each its own fight.** Six stages in the order a crew takes them (section 4): the Boarding Watch, the Gallery
  of Hammers, the Starved Engine, the Sailwalk, the Tonal Warden, the Ketchmaster's Cabin.
- **The new mechanic is the cells** (section 6): the engine eats aether cells a crew carries to it by hand - slowed, its
  weapon put up, a blow knocking the cell loose - and the Warden's Discord is put right the same way.
- **The platforming is the Hour's own course law** (the Sailwalk, section 3), outboard over the open sky.
- **The Dwemer boss** is the Tonal Warden (section 7), the Brass Remnant's fight rung for rung.
- **The guns are found here alone** (section 9): the Dwarven Thunderlock and the Dwarven Pistolet, and a Gilded version
  of each, in the hold's share.

Daggerfall has no airship, no other players and no raid, so none of this is a DFU member. Its Ledger A row is KETCH.

## 1. The lore - canon, and the port's own

**Canon** (the player's own data and the series): the **Rourken**, the Dwemer clan that would not join the Chimer
against the Nords, threw **Volendrung**, the Hammer of Might, and built their new home where it fell; the Dwemer
**vanished, every one, in a day** (the Battle of Red Mountain), and their constructs kept at their tasks - Morrowind's
ruins are kept by them still; **aetherium**, the Dwemer's blue crystal, mined and fought over; the **Numidium**, the Brass
God, raised by Tiber Septim and broken, its pieces lost about the Iliac Bay - the Daggerfall of 3E 417 is a game of the
Brass God's pieces.

**The port's own**, each said as such where it is said: the **Mzunthar**, a Rourken sky-ketch of tonal brass that never
landed after its masters went, flown by its steersman, the **Tonal Warden**, on the course it was last given - over the
Iliac Bay, a week round; its **anchor-lift**, let down to the fields east of Daggerfall while it keeps station;
**Imrah Bel-Tavir**, an antiquarian of Sentinel who wants to know what brought her down (section 13); and her reading
that the ship's **lodestone**, tuned to great masses of Dwemer brass, answers the Numidium's pieces - hers, never the
canon's word. Her two books (`systems/portBooks.js`): *The Ketch That Never Lands* (419) and *Rourken Thunder* (418,
on the guns - `05-Combat/Dwarven-Thunderlock.md` GUN-LORE).

## 2. The voyage on the clock, and the Ketch in the sky

**The law** (`net/ketch/ketchLaw.js`): voyage 0 arrives **Loredas 2026-10-24 at midnight UTC** (`KT_EPOCH_MS`) and
every voyage a week on (`KT_WEEK_MS`). She is **sighted** two hours before (`KT_SIGHT_MS`), **keeps station** a day and a
half (`KT_STATION_MS`), then **weighs anchor**: the crews aboard have twenty minutes more (`KT_LAST_MS`), and then she
is gone. `ketchVoyageAt(now)` names the voyage and its phase - away, sighted, docked, departing - each instant's edge
on the later side. A crew **boards** only while she keeps station (`ketchBoards`); her ships **hold** their crews from
her arrival to her going (`ketchHolds`).

**In the sky** (`scenes/ketch/ketchSky.js`), on the clock alone so every screen sees one ship in one place: sighted,
she comes in from the east six kilometres out and ninety metres over her station, slowing, bow west, and turns to her
station's heading (bow south) over the sighting's last share; at station she hangs still **700 m east and 140 m south of
Daggerfall's centre, 260 m over the fields** (`world/ketch/ketchModel.js` KT_STATION, KT_GROUND), and lets her
anchor-lift down on its chain over forty seconds; weighing anchor, she draws it up, turns west over a minute, and goes,
gaining way and height, over the city and out of sight. Her mesh is the made level's own, drawn in the exterior's world
pass; she stands to the world's collider while she keeps station (a body levitated up finds her hull), never while she
moves. A body that stands in the lowered cage **KT_BOARD_HOLD_MS** (2.5 s) rides it up, counted down on the screen; one
set down by the way down (or a fall) must step out of it first.

**On the map and the clock:** her ring on the held map and the ink map (`ui/ketch/ketchMapMark.js`, the gate's ring in
her blue `#7cc4ff`, "The Sky-Ketch"), and her rows on the Timers (`systems/eventTimers.js`, kind `ketch`: sighted,
arrives, keeps station, weighs anchor - "Over Daggerfall").

## 3. The deck plan - and the ship as built

**The frame** is the deck's (`net/ketch/ketchDeck.js`): metres, y up, x across (port -x), z along the keel from the
bow; into the dungeon host's frame by the Shattered Hour's own move (`realmToDungeon`), so the Hour's Steps lay the
Sailwalk unchanged.

| Part | Where | What |
|---|---|---|
| The Anchor Deck | y 0, z 0-14 | where the anchor-lift sets a crew down (KT_ARRIVE), and its way down |
| The waist | y 0, z 14-62 | the Boarding Watch; capstans and hatch covers to fight round; the quarter wall aft |
| The gun deck | y -6, z 52-128 | the Gallery of Hammers (six rows, three lanes), two steam lanes, the Wardens' landing |
| The hold | y -12, z 52-132 | the Starved Engine fore, six cradles aft, three arc-coils between, four spider vents |
| The mast-lift | a brass tower at the waist's starboard quarter | the hold to the main top (y 16); it runs once the engine is fed |
| The main top and its yard | y 16 | the yard out to the Sailwalk's first top; the bosun's line's post |
| The Sailwalk | outboard to starboard, x 24 | six drifting spars, the beating plates and a riser, seven rotten planks stepping down |
| The bridge | y 0, a disc r 24 about z 200 | the Tonal Warden; a core (r 15) that never falls, an outer ring in eight sections |
| The cabin | behind the helm | the Ketchmaster's chest, and the stern lift down |

**The Sailwalk** is the Hour's and the Spire's one course law (`net/eliteGates/egSpanLaw.js` courseOf): its steps' sizes
the Hour's own (pinned equal), every gap within the envelope (2.4 m to 3.2 m), the riser climbed straight off the plate
before it, every step down under DFU's fall damage (5 m, `player/motor.js` FALL_DAMAGE_THRESHOLD); a fall into the sky is
caught by the nets and cast back to the span's top for 15% of the body's health. **The bosun's line**, once the bridge is
unbarred, runs from the main top down to the gangway's head for whoever comes after.

**The ship as built** (`world/ketch/ketchModel.js`, `world/ketch/ketchKit.js`, `world/ketch/ketchArt.js` - its own art
on the pseudo archive KT_ARCHIVE): the hull, two masts and their stays, the engine house, every deck, stair and rail,
lamps on every deck, the hatches' grates and the cabin's doors (parts the host moves), the bridge's eight sections each
its own mesh and collider, the resonators' pylons, the land below and Daggerfall off the port bow in the haze. The made
level stands in the dungeon host (`world/ketch/ketchShip.js` - a made location, its one block file), as the Hour does.

## 4. The stages - the director

One crew's ship is one room (`kt:<voyage in 8 hex>.<captain's digest in 16>`), its voyage the pure director's
(`net/ketch/ketchBrain.js`): the moment and a [0,1) source in, frames out, so a test runs a voyage whole. ONE HAND AND
ONE PURSE a member for everything it strikes (the gate's `spendBlow`, `spendPurse`).

1. **The Boarding Watch.** Three waves - spheres; spheres and sentries; the Watch-Captain and spheres (`watchWave`, by
   the crew aboard) - each rising three seconds after the last is down, the first when a member steps into the waist
   (or twelve seconds after the first boarded). The waist's floor runs over the Anchor Deck too: the Watch goes at a crew
   wherever it stands on the open deck. The last down: the hatch opens.
2. **The Gallery of Hammers.** Its hammers and steam lanes run on the shared clock (`hazardsBetween` - each hammer
   slams once a cycle, its row's lanes a second apart, so one lane of every row stands clear two seconds in three); the
   two **Hammer Wardens** stand at their posts until a member comes past z 98 or strikes one. Both down: the hold opens.
3. **The Starved Engine** (section 6). Fed: the hold is cleared and the mast-lift runs.
4. **The Sailwalk.** The first member on the gangway or the bridge unbars the bridge, by name.
5. **The Tonal Warden** (section 7).
6. **The Ketchmaster's Cabin.** The Warden's fall opens it: each earner's share waits at the chest (section 9).

## 5. The constructs

The Rourken's brass crew (`net/ketch/ketchConstructs.js`), run by the relay as the gate's host and the Spire's legion
are: **the Dwarven Sphere** (a lunge down a lane, a spark about itself), **the Dwarven Sentry** (a crossbow-turret that
keeps its range - a bolt, a volley at three), **the Dwarven Spider** (the hold's vermin, quick to a carrier - its sting
knocks a cell loose), **the Hammer Warden** (a hammer ahead, a sweep, a steam lane), **the Watch-Captain** (a stomp and the
Tonal Wave rolling out of it - jumped - a cleave, a steam lane). Every blow a full shape stamp (`egBlowOf`) held at the
wind-up floor. Health: `hpS` seconds of the crew's mean reference damage, the Wardens and the Captain a share a member.
A body walks round what stands on its floor (the waist's cover, the mast-lift's tower and the main mast). A blow on one
is believed only risen, by the hand, from its storey, and a swing within reach; a sleeping Warden struck wakes.

## 6. The Starved Engine - the cells (the new mechanic)

The engine eats **aether cells**: three, and one for each two aboard (`engineNeeds` - four to seven). A member takes a
charged cell from one of six cradles (`pick`), carries it through the arc-coils to the engine and sets it in one of
its seven sockets (`bank`).

- **The burden** (`scenes/ketch/ketchClient.js`, `player/motor.js` registerFootSpeedMod - a departure: Daggerfall carries
  nothing in its hands): a carrier walks at 0.72 of its pace, its weapon put up; readying one lets the cell go.
- **Knocked loose:** a carrier struck by any blow (its own machine's verdict, `hurt`; the relay's census; an arc-coil on
  its trail), fallen, or who lets go (`drop`) drops the cell where it stands; it lies fifteen seconds for any member to
  take up, then bleeds out. A cell carried off the hold's floor (up the stair) is gone with it.
- A cradle charges again twenty seconds after its cell is taken; spiders pour from the vents two at a time, at most
  three and the crew alive at once, at carriers first.
- The Warden's Discord is put right the same way, with the bridge's own two cradles (section 7).

## 7. The Tonal Warden

What the Rourken left at the helm (`net/ketch/ketchWarden.js`): a construct twice a man's height in tonal brass, a
tuning-fork's tines for a crown - the Brass Remnant's fight rung for rung, on the boss seam (`KETCH_SEAM`). Each fighter
brings 300 s of its reference damage to its health; the crew's eight seats; a fight no living fighter has stood on the
bridge for thirty seconds is lost (the Warden whole at its helm again, the next `in` a fresh fight).

1. **The Steersman** (100% to 65%): the Keel-Strike (a lane 26 m down its facing), the Steam Lash (a cone of fire), the
   Tonal Ring (a disc, then the wave to 20 m - jumped).
2. **The Discord** (65% to 35%): warded while any of the bridge's four resonators is false; every thirty seconds the
   Discord (a quarter of everyone's health); two Sentries climb onto the bridge. A resonator is put right with a cell
   from the bridge's cradles; all four true break the ward and stun it ten seconds, struck half again as hard.
3. **The Last Note** (35% to 0): the Keel-Song every forty-five seconds while tuning-forks rise on the core (three and one
   for each two living, seven at most): every one broken stuns it; one standing and it lands (70% of everyone's health)
   and heals it. The outer ring gives way - two sections at a time shudder three seconds and fall away for seven.

Fourteen minutes after its wake **the Ketch turns west** - nine tenths of everyone's health every two seconds.

## 8. The ship's blows judged where the client cannot skip them

`net/ketch/ketchJudge.js`, net/bossRef.js's law rung for rung: a body struck only BODY_MARGIN deep in a stamp before and
after the landing, on the blow's own storey; a blow with a span also catches a pose inside it while it lasts - and **a
lane crossed while it lasts**: an arc-coil's lane is narrower than the margin (no pose stands deep in it), so two poses
either side of its line, both sent inside its live span, are the crossing (a crossing straddling its waking is not
counted - the carrier's favour). Plain blows count against the body's share; every blow of any kind knocks a carrier's
cell loose (the Tonal Wave, jumped, never). The Warden's own are its fight's (`judgeWarden`).

## 9. The Ketchmaster's hold - the receipt, the week's share, the spoils, the guns

**The receipt** (`net/ketch/ketchReceipt.js`, `k1`): the relay's signature on the fall for each earner - its voyage, the
crew's ship, the account, a seed, how it was earned, the level - never another boss's. Unsigned (a keyless relay) the
page reads it and the service declines it; the hold pays nothing off it.

**The week's share** (`server-account/src/ketch.js` claimKetch, migration 0166, `/v1/ketch/claim`): one row a (voyage,
account). The first receipt of a voyage takes its share; the same ship again is the same kill (`claimed`, its share
still the page's to roll); another crew's ship that voyage is answered `taken` - she pays no hand twice a week. The
device carries its receipts (`net/ketch/ketchClaims.js`) until they settle. The voyages sailed show on the account card
and the Inspect card (`ketchRecordOf`, `ui/profileWindow.js` profileRecordLines - the one door that laid the stars there
too, which STAR7 had laid on the card's view alone).

**The spoils** (`systems/ketch/ketchSpoils.js`), rolled off the receipt's seed: gold 450 a level (a fifth either way); a
Legendary piece a quarter of the time (else Rare) and one Rare or better; the foundry's **20 to 40 Pellets** always (the
one door that pays shot by the score - `PELLETS-SCARCE`); **the Dwarven Thunderlock one share in ten, the Dwarven
Pistolet one in eight**, each its own draw - no other door mints either; and last of all the Ketch's two Gilded guns,
**Volendrung's Echo** (a gilded Thunderlock - Hammerfall) and **the Ketchmaster's Word** (a gilded Pistolet - Broadside),
one in a hundred each (`06-Systems/Gilded.md` section 10). They spill from the cabin's chest; a share paid off the ship is
granted to the pack.

## 10. The relay and the wire

**The room** (`server/src/index.js`, `_kt*`): the Worker mints a ship's room only while its voyage holds its crews; the
door (`ketchAdmits`) takes the captain, the captain's party by the hub's word, staff, a member coming back - never a ninth
(staff neither: the wire's crew is eight, AUDIT KETCH L1-4; a full ship is watched by a hidden spectator, who takes no place),
a full ship freeing the place of a member gone from the captain's party and from the ship KT_PLACE_KEEP_MS with no part in
the Warden's fight (AUDIT KETCH L1-5, `idlePlaces`, `_ktFreePlace` - never the captain's, never on a hub that does not answer),
never a stranger, never a newcomer while she weighs anchor; the ship told whole at the hello and its receipt again; the
voyage kept to storage; its beat every BRAIN_TICK_MS while a member stands aboard; past her crews' last minutes every
socket told and closed. Every pose stamped (`pAt`) so the census reads its age.

**The step law** (AUDIT KETCH L1-7, `ketchBrain.js` `ktLeastMs`): the relay believes no member faster than the fastest
build runs (`KT_FAST_RUN_MPS`, the Elite Gates' `EG_FAST_RUN_MPS` pinned equal; a carrier at `KT_CARRY_PACE` of it, the
page's own pace), less `KT_STEP_SLACK` and a body's breadth - a time bound, the Elite Gates' crossing law's. A cell is set
no sooner after its pick than its straight walk would take; the bridge unbars to a member on the gangway no sooner than the
mast-lift's rise and the Sailwalk's least crossing after the engine is fed (`KT_SAILWALK_LEAST_MS`), nor sooner than that
crossing after it was last seen at the main top (`KT_CROSS_LEAST_MS`). A legitimate crew is never refused; a warp waits
what a run would take. A ranged blow keeps the gate's law (a storey, no range) - the Hour's and the gate's own.

**The words** (`net/wire.js`, from `world253` - `KT_RELAY_MIN`): one frame type, `kt`, in a ship's room alone - a member's
`in` (with its game's brain number), `hit`, `pick`, `bank`, `drop`, `hurt` and its body's word; the room's thirty kinds,
each projected (`validKetchOut`), on a bucket of its own. **The link** (`net/ketch/ketchLink.js`) folds them into the
page's ship, says each turn once, keeps the member's place in the bridge's fight (counted in only by the room's answer)
and the whole bridge's blows owed. **The herald's settings** `ktRole` and `ktThread` ride the relay settings
(`net/relayCfg.js`, world253's).

## 11. The ship on this screen

`scenes/ketch/ketchDeckHost.js` stands her in the dungeon host and routes the six combat seams to the ship while one
stands (the Spire's way); `scenes/ketch/ketchFight.js` draws the constructs, their blows' telegraphs, the Warden, its
forks and sections; `scenes/ketch/ketchClient.js` holds the world's half - the sky, boarding, the link, the claims, the
burden, the bosun's line, the presses aboard (`kt:` targets: a cradle, a cell lying loose, a socket, a resonator, the line,
the way down, the stern lift, the chest), the cast-back, and **a death aboard is a fall**: the death save (`kt-fall`)
wakes the body in the fields under her at a sliver of health - no death penalty. Her look: her own lighting by the hour
- her night never darker than the world's outside it (DFU's exterior night floor 0.25) - the air's fog above and the
lamps' below.

**The made level's rules** (`systems/madeLevel.js`, `ketch`): no save, no rest, no map, no Mark or Recall, no portal
stone, no companions, no regeneration, no levitation or slow fall, no flight, no run-leap, no resurrection, no
avoid-death, no unstuck; a death a fall, its penalty none. No tier label over her deck (`world/dungeon/dungeonLabel.js`
madeDungeon - nor over an Elite Breach's hall, which no list named before).

## 12. The Ketch on the screen

`ui/ketch/ketchHud.js`: **the voyage's tracker** - the ship's name, the stage and what it asks (the Watch's wave and what
stands; the Wardens asleep; the cells set of the engine's need and the cradles charged; the Sailwalk and the line; the
Discord's resonators; the Last Note's forks; the cabin), the cell in my hands, the crew of eight, and the clock to her
weighing anchor and her turn west; and **the Tonal Warden's bar** - the gate's boss bar in the Hour's brass, cut at its two
turns, the ward, the blow it winds up, the Keel-Song with its forks, the stun and the fall. A first-use tutorial page,
`sky-ketch` (`systems/tutorialCatalogue.js`).

**Every line in the player's language (L10N4).** The page's words of the voyage go through the text core when they are
read, never at import, so a language chosen after the game loaded is the one shown: `systems/ketch/ketchWords.js` holds
the voyage's turns, the made level's refusals, the stages', the Warden's phases' and blows', and the constructs' names (the
page names a blow or a kind by its KEY - the relay keeps no name of its own for a kind) and the map card's line;
each file that says a line routes it the same way (`ketchLink` KT_LINK_TEXT, `ketchHud`, `ketchClient`, `ketchSky`,
`ketchClaims`, `ketchSpoils`, `ketchMapMark`, the Timers' row in `systems/eventTimers.js`, the tutorial page). The relay
sets no locale, so it keeps English of its own and the page reads it back: the door's four refusals
(`net/ketch/ketchLaw.js` KT_TEXT.refuse - `ketchRefusal` turns each into the player's words, key for key), the blows'
`nm` on the wire (never said by the Ketch's page), and the herald's Discord cards (the channel's English, as every herald
post is). A refusal's number on the wire (`KT_NO_WORDS`: gone, over, older) is said by the link in the player's words. The
two port books stay English as On the Burning Doors does: a port book is BOK bytes read whole, and no language holds a
-LOC book for one (`ui/bookDoor.js`). Every routed line is in the catalog (`locales/en/Port_Strings.csv`) and drafted for
all 25 languages; `test/systems/l10n4_hardcoded.test.js` counts what stays English, each with its reason.

## 13. The questline - the Sky-Ketch

`skyKetch` (`systems/questlines/qlLines.js`; tier 4, level 12, online, an account), given by Imrah Bel-Tavir:

1. **The Ketch That Never Lands** (QLSK01) - her letter and book 419; ride the anchor-lift up (`ketch-boarded`).
2. **The Starved Engine** (QLSK02) - set three cells of your own (`ketch-cell-banked`); her book 418.
3. **The Tonal Warden** (QLSK03) - witnessed: the Warden felled, its receipt counted (`warden-felled`; the service's
   `ketch` witness, `ketch_voyages`) - and the line's title, **Skyfarer**.
4. **What the Lodestone Answers** (QLSK04) - the Numidium reading; who is told: the Mages Guild (Bel-Tavir's Tuning-Charm,
   the Guild's standing) or no one (the Steersman's Hammer).

## 14. The herald

`net/ketch/ketchHerald.js`: three cards a voyage on the clock alone - **sighted** (pinging the Ketch's role, else the
gate's), **arrived** and **weighing anchor** (quiet) - each owed once in its window and let go past it, in her family's
card (`net/herald/heraldCard.js` `ketch`, her blue) and her own thread when the operator names one (`KT_DISCORD_ROLE`,
`KT_DISCORD_THREAD`, `server/wrangler.toml`). The hub's alarm beats it (`_ktHeraldBeat`).

## 15. The live run, and what it found (2026-10-24)

The real relay and account service in workerd (`tools/loadHarness.mjs` standServices) and the real game online in
headless Chromium, voyage 0 docked: the Ketch over the fields, boarded through the lift into `kt:00000000.<digest>`, the
Watch, the Gallery, the engine fed, the bridge unbarred, the Tonal Warden felled solo in 9.4 minutes (its Discord, its
forks, its sections) and its receipt handed. The first run's relay held no signing key, so its receipt went out
unsigned; THE SECOND RUN (the same day, a throwaway gate pair in both Workers' env, as the account deploy mints one) took
the rest of the road: boarded, the Watch broken in 24 s, the Wardens in 7, the engine fed in 58, the bridge unbarred, the
Warden felled solo in 208 s (the Discord's four resonators, the Last Note's three forks, the stun, the sections), its
receipt SIGNED (an 86-character Ed25519 signature), claimed at `/v1/ketch/claim` (the account's `ketch.sailed` 1), the
chest offering "Open your share", and the share thrown across the cabin floor - a Legendary, a Rare, 37 Pellets and 526
gold - with the tracker and the Warden's bar drawn through the text core. A fall to the Watch's first wave before the
driver ran woke the body in the fields, as the made level's death says. What the runs and the tests written beside it found, each fixed and pinned:

| Found | Fixed | Pinned by |
|---|---|---|
| `kt` words closed the socket - the client parser knew no `kt` | `parseClient`'s `kt` arm | `ketch_relay.test.js` |
| the census lost every member 25 s after its hello - a ship's pose never stamped | `pAt` for a ship's room | `ketch_relay.test.js` |
| `/v1/ketch/claim` missing from the service's routes (404) | `ROUTES` | `ketch_claim.test.js` |
| a construct's first blow (index 0) never held to its recovery | `B.atk != null` | `ketch_constructs.test.js` |
| an arc-coil's lane narrower than the margin: never judged on the trail | the crossing rule (section 8) | `ketch_constructs.test.js` |
| a crew on the Anchor Deck out of the Watch's reach | the waist's floor over it | `ketch_constructs.test.js` |
| "Regular Dungeon, Small" over her deck | `madeDungeon` | `ketch_model.test.js` |
| her deck black at night (ambient 0.1) | the world's own night floor | the live run |
| Hammerfall's brief past the card's row | shortened | `ketch_gilded.test.js` |
| the Skyfarer's colour 32 from the Chaptermaster's | `#58d8ff` | `ql12_claim.test.js` |

**The tests:** `test/net/ketch/` (`ketch_law`, `ketch_deck`, `ketch_brain` - a voyage run whole through `ketchSim.mjs`,
every frame through the wire - `ketch_warden`, `ketch_constructs`, `ketch_link`, `ketch_herald`, `ketch_relay`),
`test/server/ketch_claim.test.js`, `test/systems/ketch/` (`ketch_spoils`, `ketch_gilded`, `ketch_words`), `test/scenes/ketch_sky.test.js`,
`test/ui/ketch_hud.test.js`, `test/world/ketch_model.test.js`. **The mutants:** `tools/mutants/ketch_*.json`, fifteen
lists, 208 records: 207 dead and one recorded equivalent (`KTB-the-cells-said-every-beat` - every caller says the cells
only after it moved them, so the word's dedupe guard is never the branch taken).
