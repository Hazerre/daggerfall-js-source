# FIELD BUGS 2026-10-22c - a gift's two Shields, a 5 GB tab, ships that surge, a lair with no door, and the quest marks

Five threads from the Discord's #bug-reports, handed over as phone screenshots with no word beside them: PauloHF's
"[Glitch] Overpowered spells", Foretold's "Memory Leak" (Xuurath, iamamitten and Mona Polca beneath it), Dahazed's "huge
amount of lag and ship warping during sea boss fight", fogs' "Revenant lair is inaccessible" (on Zenako's behalf), and
Stoned Jesus' "Quest tracking stopped working in overworld and dungeon maps". Read on main's `c7e5395cc`, with the
freeware's data (`tools/fetch-data.sh`) wherever the map, the blocks or the models decide, and Daggerfall Unity's
`Assets/Scripts` (the parity sparse clone) for the spell law. Every system changed here is the port's own - the gift
between players (ALLY-CAST), the revenants (RVN7), the peers' boats (CSA-K) and their art (LAYERED-PEERS) - so no DFU
member moves and no Port-Ledger row is touched; where DFU behaves otherwise it is said below. Named 22c: main's 22 and
22b were taken first. The pins are `fb1022c_*`, the mutants `tools/mutants/fb1022c.json` (30, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "a shield with 6002 strength, 1600 duration, and AoE (not mine). And yes, both shields work" - the buff's card: "Absorbs 2829 more damage." over "Absorbs 3001 more damage." in one bundle, Mega Shield | A party mate's spell carrying one effect twice stood it twice: the tags that keep a mate's bundle apart from mine are stamped at the bundle's tail, so the gift's second Shield read its own first one as somebody else's. The magnitude itself is the law's: 1 + 100 a level at the gift's level 30 | GIFT-ONE |
| 2 | "an instance out of 7 that is leaking 5gb of ram"; "massive memory leak on desktop app"; "started ... about 2 days ago" | Measured in the real game: the Snowfall blanket kept every map pixel left behind (SNOW-HOLD, fixed by #1106 on 2026-10-21 - a journey's heap grew 1.18 to 1.94 GB over three columns on the tree before it, and stays flat on main). Still open beside it: every armour outfit another player was seen in stood for the session | PEER-ART; SNOW-HOLD already on main |
| 3 | "the boss fight turns into dodging friendly ships while they randomly speed up / warp in front of you"; "couldn't do thing from all the lag" | Another player's boat was led 0.6 s past her word and then held; a crowded cell's relay carries only her full frames (every 2 s), so she stood still 1.4 s and then ran 17 m in a fifth of a second | SEA-GLIDE; the relay's share and the fight's frame named, not changed |
| 4 | "the Revenant lair designated on the Revenants page is inaccessible ... The Stuvam Graveyard, south of Ceriburea ... approximate coordinates 565, 427" | 28 graveyards MAPS.BSA flags with a dungeon lay a block (GRVEAS10, GRVEAS36) that places no dungeon-entrance door; a lair could be one. The Stuvam Graveyard (Alik'r Desert, pixel 565,427) is | LAIR-DOOR |
| 5 | "Quest tracking worked yesterday in overworld map and dungeon map now it just straight up doesnt show up anymore" | Not reproduced. Nothing on the chain the marks are drawn by changed between the day before and the report's hour | asked of the player |

## GIFT-ONE (1) - `06-Systems/Online-Arc.md` AUDIT ALLY-CAST

THE SPELL. The card's two lines are two live Shield entries in one bundle named Mega Shield. "Not mine": a gift (a party
mate's cast, or a stranger's under SPELL-GIFT), which the receiver applies as a self-cast at the caster's level, clamped
to 30 on the wire (`net/wire.js` CAST_LEVEL_MAX). Shield's magnitude is DFU's (BaseEntityEffect.GetMagnitude, `EntityEffect.cs:799-800`): base 1..1 +
plus 100..100 every 1 level = 3,001 at level 30 - the spell maker's spinners at their tops (`systems/spell/spellMaker.js`
SPINNER_RANGES, EffectSettingsEditorWindow's SetRange), and 2,829 is the first pool after 172 points of blows (the first
live pool soaks first, `characters/playerEntity.js` damageShieldPool). The duration, 40 + 52 a level = 1,600 rounds,
is in range too. So the numbers are the law's at level 30; what is not is TWO pools.

WHY TWO. AUDIT ALLY-CAST C2 keeps a mate's bundle beside mine: the incumbent law (`systems/effects.js` applySpell's
`findInc`) reads `bundleAlly` and `bundleDuel` on every entry, and those are stamped on the cast's entries at the
bundle's TAIL, after its loop. A gift carrying Shield twice pushed its first entry, untagged; the second asked for an
incumbent with `bundleAlly === true`, found none, and pushed another. Three Shields, three pools; a Fortify Strength twice,
two stacked. The caster's own cast of the same record had always merged into one (its entries untagged match its own
`false`). Not a crafted frame - an honest Mega Shield, made at the spell maker and cast as an area blast on a party.

FIXED: an entry the cast itself pushed (at `pinStart` or past it) is the cast's own, read without its tag. One pool a
gift, as one a cast; a mate's bundle still stands beside mine and a duel opponent's beside mine. DFU, for the record:
its AssignBundle adds the instanced bundle to the manager only after its loop, so two like-kind effects of ONE bundle
both become incumbents there (`IncumbentEffect.FindIncumbent` cannot see the bundle being built) - "both shields work"
is DFU's own behaviour for a self-cast; the port's self-cast has merged them all along, and the gift now does as the
self-cast does.

THE BOSSES. "Maybe it's because some players have found glitches" - a Shield takes nothing from a boss. A world boss's
damage is held by the relay to a bucket per player (`11-Multiplayer/World-Bosses.md` section 5, "the damage a player
may deal"), so no spell, crafted or not, kills one faster than that bucket lets it.

PINS. `test/systems/fb1022c_giftone.test.js` (3), over the spell maker's record, the caster's frame, the wire's
projection, the receiver's gift and the receiver's own door (hostMagic applySpellToPlayer, as world.js online.onCast calls
it): Mega Shield's gift is one pool of 3,001 and the report's 172-point blow leaves 2,829 with nothing behind it; three
Shields one pool; Fortify twice one; mine beside a mate's (C2); a duel opponent's the same. All three fail on main's
code (the triple stood three pools). The pin on the incumbent line (`allycast.test.js`) and its mutant record
(`tools/mutants/allycast.json` AAC-effects-gift-merges-with-mine) moved with it.

## PEER-ART (2), and the memory - `04-Characters/Layered-Gearing.md` Online

MEASURED (a session-local probe over the real game in Chromium, the freeware's data, the draw calls stubbed, the heap
read after a forced collection; the figures stand here, the probe was not committed). A warp journey west from
Knightstale, the same on two trees:

| Tree | The heap as the journey crosses map columns |
|---|---|
| main just before #1106 (`f49e6aad9`) | 1,176 -> 1,407 -> 1,675 -> 1,941 MB over three columns; the renderer's resident set reached 4.0 GB |
| main (`c7e5395cc`) | 1,178 -> 1,309 -> 1,316 -> 1,268 -> 1,286 -> 1,313 MB over 67 columns - flat |

The growth was SNOW-HOLD's (FIELD BUGS 2026-10-21b, merged 2026-10-21 17:44 EDT): the Snowfall blanket queued every pixel
the traveller left behind and drained it only while its tier was not recentring - never on the move - each queued tile
holding its pixel's whole entry (~2 MB a pixel, ~22 MB a column crossed, ~1.5 GB an hour at a gallop). "About 2 days
ago" fits it: PRECIP (#1053, 2026-10-19) ran the Snowfall wherever snow lies within some ten pixels in any season, and the
online sky's calendar came into Evening Star on 2026-10-22. A player on a build from before #1106 still has it. Idle in a
town the heap grew 1.3 MB in some 1,900 frames (the blanket filling to its 49 tiles and stopping); 240 pixels built and
destroyed left 42 MB alive, the weather's own state.

STILL OPEN, AND FIXED HERE: THE PEERS' ART STORE. `net/peer/peerRiders.js` createEotbArt kept every sprite's decoded
pictures (`pixels`) for the session and let a texture go only for a rider's horse look (COATS1). Since LAYERED-PEERS
(2026-10-19) every other player on foot is a walker in the armour they wear - some 55 sprites of their own outfit - so
every outfit met online stood for good: ~4.1 MB of decoded pixels and 55 uploads each, none ever let go (120 outfits kept
497 MB, headless). An outfit is a look now (`spriteLookOf`: `LA:<body>:<combo>:<pieces>`, a horse's coat as before), let
go with every texture of it once RIDER_LOOKS_KEPT others were drawn and it has stood undrawn RIDER_LOOK_IDLE_MS - never
one drawn now; and the decoded pictures are the RIDER_PIXELS_KEPT (64) sprites most recently asked (a mirror asked soon
after its sprite shares its decode). ONE CACHE, TWO STORES: the renderer keeps a texture by its archive and record alone,
and my own body's store (`player/eyeOfTheBeholder/eotbBody.js`) uploads under the same keys - an outfit or a horse's look
can be mine and a peer's at once, so a look one store let go took the other's texture from under it, and that store,
believing it up, drew from nothing (COATS1's horse looks could already do it). Each store now asks the renderer's cache
whether its texture still stands before it trusts it (`renderer.textures.has`, the hosts' own test before a frame's
upload) and uploads it again from the pictures it kept. `test/net/peer/fb1022c_peerart.test.js` (4: the look, the
outfit let go and one drawn kept, the pictures kept, and both stores over one cache - my body driven as the world host
drives it); `prww1_werewolf.test.js`'s fake renderer records its uploads as the renderer does.

READ AND LEFT (bounded, or not measured): the Snowpack's lattice points (`systems/weather/snowpack.js` `points`, ~9.5 MB a
thousand pixels walked, bounded by the map); the Enemy Expansion's HD pictures through the pinned upload (#1067, up to
~0.5 GB as each kind is met, bounded); the player's own outfits' decoded map (`player/eyeOfTheBeholder/eotbBody.js`
`decoded`, bounded by one body's outfits). Read and cleared: OW-HORIZON's far ring, OW-HITCH's ground sets, the
SHADER-STALL program map, NPC-MARKS, NODE-GLINT, GATE-MIX, the DEX placeholders, the Starfall, the grass rim, TRADE-VIRT.
The baseline is high on its own: the heap after a collection at a boot into the world is 1.18 GB (121 pixels at ~3.3 MB).

## SEA-GLIDE (3) - `03-World/Come-Sail-Away.md` Sailing together

THE SEA BOSS is SERPENT1's Sethrakul (`11-Multiplayer/Sea-Serpent.md`); the "friendly ships" are the other players' boats,
drawn from the `sa` word on their foes frames (`scenes/comeSailAway/comeSailAwayPeers.js`): a delta every 200 ms, a full
frame every 2 s (`net/online.js` FOES_MS, FOES_FULL_MS). CSA-K led a word's way 0.6 s past its arrival and then held the
boat, and eased onto the next word at 12 a second. Where the room's fan passes its budget the relay drops the deltas and
keeps the full frames (FOES-FIRST) - a sea fight's crowd is such a room - so a boat at 12 m/s stood still 1.4 s of every
2 and then ran the 17 m to her next word in a fifth of a second. On a replica of the law (position alone, the record's
figures):

| Words | CSA-K (0.6 s, the ease) | SEA-GLIDE (4 s, the catch) |
|---|---|---|
| full frames alone, each up to 300 ms late | fastest 195 m/s, 70% of frames stopped, p99 19 m off | fastest 13.5 m/s, none stopped, p99 3.1 m |
| full frames alone, each held up to 1.5 s (FOES-HOLD) | 195 m/s, 70% stopped, 32 m | 13.5 m/s, none stopped, 13 m (her way times the hold) |
| every delta, 40-300 ms late | 40 m/s, 4% stopped, 3.2 m | 13.5 m/s, none stopped, 2.5 m |
| a boat that stops, full frames alone | 195 m/s | 13.5 m/s; overshoot 3.2 m at either |

FIXED: CSA_PEER_LEAD_MAX is two full frames' spacing (4 s; at the sea's own 2.5 - navalHost.js PREDICT_MAX_S - a full
frame held for its turn still stalled 1% of frames), and under way what the word says she is off by is taken up at the
sea's PUPPET-GLIDE catch (`glideToward`: 1 a second, never faster than 0.3 m/s plus a tenth of her way -
`scenes/naval/navalHost.js` PUPPET_CATCH, the fix for "Ai ships move very janky and quick", FIELD BUGS 2026-10-02d). A
boat lying still eases onto her word as before; past her snap she snaps. Driven on the real pool and module
(`test/scenes/fb1022c_seaglide.test.js`, 3): never stopped, never past her way and the catch, within 4 m of her place
(p99), and within her way times the hold where the full frames are held; `csa_together.test.js` and AUDIT SHIPS A7's pin
(`auditships_sail.test.js`) moved - A7's hitch now outlasts the lead (6 s), or no snap law is asked at all.

NAMED, NOT CHANGED (each its own decision):
- THE RELAY'S SHARE. A moving boat's word lives in the deltas the budget drops first. Over the real Room with the wire's
  own frames (a probe of this session's, not committed): ~1.4 KB frames reach every listener up to 20 ships, 74% at 24,
  47% at 30 - a cliff, not a slope. A floor for `sa` (a few words a second an owner) or the boat on the pose stream would
  make the full frame its worst case, not its only one. A relay change, with its deploy.
- THE CLOCK. No boat word carries the sender's time, so a word's lateness is drawn as distance; OWNER-CLOCK's `tm` rides
  the foes frame and only the foes' puppets read it (`net/ownerClock.js`). Leading a boat on it is the next step.
- THE BUMPERS (SERPENT4, `scenes/naval/navalHost.js` withBumpers): in the serpent's waters my ship is pushed off every
  peer hull as it is drawn, up to 30 m/s - a hull drawn wrong was a real shove. With SEA-GLIDE she is drawn within metres.
- THE FRAME. The world host clamps a frame's dt at 0.1 s: below 10 fps a peer's boat moves slower than her word's way
  says, and a slow client's world runs in slow motion while the others' ships do not; `systems/naval/navalShots.js` tests
  every ball against every hull and rig box (N^2 as ships and volleys grow); BOAT-FAR's far law begins at 600 m and the
  fight's ring is 420 m, so every boat of it is walked and skinned. The fight's frame was never profiled (Sea-Serpent.md
  section 16 says so); "I couldn't do a thing from all the lag" on a Ryzen 9 and an RX 7900 XT wants that profile.

## LAIR-DOOR (4) - `12-Enhanced-AI/Feud-Arc.md` 18.1

THE PLACE. The Stuvam Graveyard is the Alik'r Desert's location 108 at map pixel (565, 427) - the report's coordinates to
the pixel - six pixels south of Ceriburea, a Graveyard (type 12) with `hasDungeon`. Its one block is GRVEAS36.RMB, and no
model it places carries a dungeon-entrance door (DFU's door law, `world/meshReader.js` subMeshDoorType: archive 56, or
331 past its stone record) - so in the port, as in DFU (PlayerEnterExit goes down only by such a door), nobody enters it.
Its crypt is a static model, as the report says.

THE WORLD. Every location MAPS.BSA flags with a dungeon, its blocks laid as the pixel build lays them and every model's
mesh read: the 1,500 labyrinths, 843 keeps and 1,112 ruins all place a door; 28 of the 774 graveyards do not, every one
on GRVEAS10 (15) or GRVEAS36 (13), the same 28 on the enhanced layout. A revenant's lair was one of the boards' ring's
named dungeons (RVN7a), so any of the 28 could be marked on the page and the map as a hunt nobody can finish.

FIXED: the world host's door (`scenes/lairHost.js` createLairDoor, out of bootWorld) offers only the ring's dungeons the
player can go down into - measured on the place as the pixel build lays it, a place and a model each read once a session,
a place the host cannot lay or whose models the archive lacks left a lair as before. A kept lair the host says nobody can
enter is chosen again at the next deed in the open world (`revenantFeud.js` lairAfter, `lairEnterable`); one already held
is moved by every reader of a lair - the page, the map's circle, the hunt, the rumours (`revenant.js`
mendRevenantLairs) - to the enterable dungeon nearest it within a rumour's reach (LAIR_MEND_PX, 20 px), known as it was
known; with none, it roams unheard of. The Stuvam Graveyard is the one of the 28 whose own ring holds no other dungeon
(nothing stands within 13 px of it): its revenant goes to Morarker's Nest, 14 px south. Every other of the 28 has one in
its ring.

PINS. `test/systems/revenant/fb1022c_lairdoor.test.js` (6): the blocks' law; the door (the ring filtered, the regions, the
nearest, a place laid and a model read once, the unjudged kept); the lair after a deed; the mend (moved and known, asked
once a session, roams with none, asked again where the host cannot say); the wiring by source; and on the player's data
the 28, the Stuvam Graveyard among them and never offered from Ceriburea, each with a den within LAIR_MEND_PX.
`rvn7a_lair.test.js`'s two wiring pins and five `tools/mutants/rvn7a.json` records moved with the door.

## The quest marks (5) - not reproduced

THE CHAIN. The Overworld's quest marks (OW-QUEST, `scenes/travelViewMarks.js`) and the held map's (GUIDE5) are
`ui/quest/questMarks.js` questMapMarks over the tracker's last look (`ui/quest/questTracker.js` `views`), fed by the quest
bridge's tick (`scenes/quest/questBridge.js` news: `lens.look`), under the Quest marks switch on the enhanced skin; a
place's pixel is the travel map's own (`ui/travel/travelMapWindow.js` placePixelMemo). A dungeon's map marks a quest only
under the Quest guidance switch's Exact tier (GUIDE8, `scenes/worldModes.js` dungeonQuestMarksHere) - the Journal tier,
the default, never marks inside a dungeon - so a player who saw marks in a dungeon yesterday had Exact on.

WHAT WAS READ. Every change to main between the evening before (`4bba28c6c`) and the report's hour (to #1130): nothing
in questMarks.js, questTracker.js, questGuidance.js, travelViewMarks.js's quest block, the automap's quest sheet,
uiPrefs or uiSkin; the online lane forces neither switch. MAP-PAN (#1016) baked the held world sheet's place marks into a
layer - the quest diamonds stay on the overlay. NPC-MARKS (#1121) reads quest people and writes nothing of a quest. The
travel map's pixels for quest places read true on the player's MAPS.BSA, regions interleaved. The quest-mark suites
(guide1-guide8, owquest, sd20g's delve, 83 tests, the bridge driven with real quests) pass on main.

ONE THING THAT WOULD DO IT: a look that throws. The bridge says it once - `[quest herald] the lens could not look (...)`
in the console - and the tracker hears nothing more that session: no quest's place on any map, no card, the compass's
mark gone; a dungeon's Exact marks would still show. Nothing found makes the look throw on main.

## Asked of the players

- The overpowered spell: nothing to ask - the gift is fixed; a level-30 caster's one Shield of 3,001 is the law's.
- The memory: the update number the game shows (REL8) - before 2026-10-21's #1106 or after;
  whether it grows standing in a town or only on a journey, on foot or on a horse, online or offline; and the `crash.log`
  RENDERER-GONE writes beside the saves.
- The ships: how many players were in the fight; whether the warping boats were Come Sail Away boats or the sea's ships;
  the client's frame rate in it (the FPS counter).
- The quest marks: online or offline; the skin (Enhanced Plus or Classic), and in Settings -> Features the Quest marks
  switch and the Quest guidance tier; whether the quest card still shows and the journal's Track still answers; whether
  the quest's place is on their map; the update number; and, if the console can be opened, any `[quest herald]` line.

## Found on the way, not fixed here

- QUESTS CAN NAME THE 28. `systems/quest/place.js` `_isDungeonType` takes graveyards as DFU's Place does, so a quest's
  remote dungeon can be one of the 28 graveyards nobody enters - DFU behaves the same. Not the report's.
- AUDIT-SHIPS-A5-the-gain-on-every-coast (`tools/mutants/auditships_sail.json`) survives on main as it does here.
