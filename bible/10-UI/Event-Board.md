# The Event Board (EVENTS1, 2026-10-23)

The owner, 2026-10-23, over the Discord's #feature-feedback threads "Make announcements for Fallen Stars and Town Raids"
(PanickedTofu: "I only ever get a notification about them AFTER they've been claimed by other players... Nothing feels
worse than spending 5 minutes to fast travel to a point only to arrive to nothing") and "Things are starting to get
worse" (EvoAva, on raids): "On the topic of event notifications. Instead of stuffing these in the chat menu, there must
be a less obstructive and more detailed way to handle them."

Not a DFU member: Daggerfall has no shared events. Ledger A row EVENTS1 (`01-Overview/Port-Ledger.md`).

## 1. What was wrong

- **Every shared event spoke in the chat.** The gate's omen, rise, opening, seal and collapse, the sea serpent's bells and
  its kill, the Abyss Dungeon's find, kill and fading, a fallen star's omen, landing and hold, and the Witches'
  Festival's nights were each a sentence on the chat's every tab (`scenes/world.js` chatNotice, `net/chat.js` pushAll),
  between the players' own lines, said once. The only other place to read them was the Timers window under the pause
  menu (TIMERS1, `ui/enhanced/enhancedTimers.js`).
- **The stars spoke too late, to too few.** A star's omen and its landing were said to its own region alone, 90 seconds
  before it fell (`STAR_OMEN_MS`); its hold was said to everyone. A player anywhere else heard of a star only once it was
  taken - PanickedTofu's report exactly. The Timers row named the next star's town only from its omen too.
- **The raids spoke only at the start, to the region, in the middle of the screen.** The mod's `AddHUDText` lines
  (`systems/raidingParties.js`, fix 8) and the map's ring (`ui/eventMapMarks.js`), which stands only while a raid runs -
  two classic hours, ten real minutes, against a fast travel of five. PanickedTofu: "I only see them on my map either
  right before completion or after they're done."

## 2. What ships

**THE BOARD** (`ui/eventBoard.js`, its law `systems/eventBoard.js`). One plate at the HUD's left edge, titled *World
Events*: the shared events a player can still reach. A row is an event under way (counting to its end) or one coming
within `EVENT_SOON_MS` (15 minutes) once it says where - the gate from its omen, the serpent from its bells, a star from
its warning (section 3), a raid from its roll. Each row says its name, its clock (*9:00 left*, *in 4:30*), how far and
which way from the player's map pixel (*12 km SW*, *Nearby* on the same pixel - a pixel is `PIXEL_M`, 819.2 m), then
where (*Near Gothway Garden*) - the way first, so a long place name cut at the plate's edge never cuts the distance - and,
for a running raid, its count where the relay keeps one (*7 of 18 raiders down*). Live rows first, each soonest first.
Rows: four on a screen 900 px tall or more, three on a desk's, none on a short screen (section 4); the rest counted
(*2 more in Timers*). The raids on it are the nearest two of the day's (about twenty-two across the Bay). The resets, the
seat week, the battles and a company's Elite Breach stay the Timers window's alone - they are schedules, not places.

**THE NEWS** at the board's head, in its kind's colour (the Timers window's own colours). It opens when an event comes
onto the board (*Starfall · Starting soon*) and when it begins (*Town Raid · Under way*) - an ANNOUNCEMENT, the board's
own - with the event's name, clock, way, place and detail; and the events' own lines ride it as its notes. While it
stands, its row leaves the list (the news is the row, opened) and the list gives it a row's place, so the plate keeps
about its height. One at a time, `EVENT_TOAST_MS` (9 s) of shown time each, the rest waiting; its clock stops while the
HUD is hidden, so news is never spent behind a window. A line finds its event's row by the town it names (a raid's, a
star's - `town` on the row), else its kind's one row. The same line twice within a minute is one. The first read of a
page only fills the board's memory: a page that opens on events already standing is shown the board, never a burst of
news for what began before it came; and while the source reads none (offline, a link dropped) nothing is announced and
the board keeps its memory, so a reconnect announces only what came on while it was away, never a replay. The news is
spoken (`aria-live`); the rows' clocks never are.

**WHO IS TOLD.** The board lists every event it carries wherever the player stands. The news announces every gate,
serpent, Abyss Dungeon and star to every screen; a raid only where the player stands in its region (the mod's own rule)
or within `EVENT_RAID_REACH_M` (25 km).

**THE DOOR** (`systems/eventNotices.js`): `eventNotice(kind, text)` is what each event's line goes through now. It waits
until the HUD's next frame takes it into the board's news - so a line said from a relay's word, a frame or a promise is
never lost and never drawn twice.

| line | said by | before | now |
|---|---|---|---|
| the gate's omen, rise, opening, seal, collapse, rite, marks | `systems/gate/gateOmen.js` (`say`) | chat, every tab | news, `gate` |
| the gate's fall | `scenes/world.js` (`onFell`) | chat | news, `gate` |
| the serpent's bells, rising, seal, dive; its kill | `systems/serpent/serpentOmen.js`, `scenes/world.js` | chat | news, `serpent` |
| the Abyss Dungeon's find, marks, kill, fading, Hour | `scenes/superDungeon/sdHost.js` (`say`) | chat | news, `super` |
| a star's omen and fall (its region), its hold (everyone) | `scenes/starfall/starfallHost.js` | chat | news, `star` |
| a raid's attack, withdrawal, cleansing | `systems/raidingParties.js` (`say`) | `AddHUDText` (hudText) | news, `raid` |
| the festival's open days and its nights | `scenes/witchesHost.js` | chat | news, `festival` |

What stays in the chat: the claims, receipts and spoils (each a line to the player alone), the server and build notices
(SRV-N), the party's rest, and every player's words.

**THE SWITCH** (`systems/features.js` `event-board`, the Interface tab's Messages & prompts, prefs key `eventBoard`, on
by default, every skin): off, the board comes down and each line goes where it went before - a raid's to the HUD's line
(the mod's `AddHUDText`), every other to the chat the host seated beside its source (the HUD's line on a host that seated
none). **MOVABLE** under Enhanced Plus (`ui/hud/hudLayout.js`
HUD_PIECES `events`, `.evhud`, a preview until the first event). **DRESSED** as the star's tracker is: Enhanced Plus's
kit panel (`ui/enhanced/enhancedFrame.js` FRAME_ROLES `panel`), the kit's rules cut to it on the classic skin.

## 3. The star's town, said earlier

`systems/starfall/starfallClient.js` starTimerRows names the next star's town (and carries its map pixel and its bare
town) from `STAR_WARN_MS` (10 minutes) before it falls, where it had named it from its omen (90 seconds). The sites are
already every client's own (found over the client's map files), so nothing new is sent; the Timers row and the board say
it at once, and the board's news announces it to every screen. The omen and the landing stay the region's lines, as
`11-Multiplayer/Starfall.md` section 8 has them - in the news now.

## 4. Where it stands (measured)

`tools/eventBoardProbe.mjs` draws the board over the real HUD in Chromium - the enhanced HUD through `drawEnhancedHud`,
a live chat panel with its peek full (five lines, each wrapped twice), the quest card and the party list - on Enhanced
Plus and the classic skin at 1920x1080, 1280x720, 1024x700, 844x390 and 390x844, and fails on any overlap with the chat's
peek, the quick slots, the buffs, the vitals, the hotbar, the compass, the quest card, the party list or the
temperature plate, or anything outside the screen.

- **Its place:** the left edge, from `clamp(244px, 40vh, 460px)` - under a full chat peek, over the quick slots' corner:
  the one stretch of the HUD's edges no other plate holds (the right's column is the quest card's, the star's tracker's
  and the party's, its middle the notices', its lower third the loot banners').
- **The status widget**, which grows up that edge from the quick slots, stands under the board as it stands under the
  chat: `.evboard` joins `STAT_ABOVE` (`ui/enhanced/enhancedHud.js`), so the widget wraps into its next column instead.
- **A short screen** (500 px tall or less - a phone on its side, where the chat and the quick slots already meet): the
  news alone, over the quick slots' corner, for its seconds; its rows are the Timers window's there. It stands over the
  chat peek's foot when both are up - the peek's lines fade (`net/chat.js` CHAT_FADE_MS); the probe holds it clear of
  everything that stays.

## 5. The four hosts

`ui/hud/hud.js` drawHud - the one call all four hosts make - draws the board under the HUD's own hide gate, and
`hideHudTextSurfaces` reaches its hide door, so the board and its news stand in every host. The SOURCE is seated by one:
`scenes/world.js` (its `timersSource`, wrapped where it is made - `seatEventBoard` answers the function as handed - with
the chat for the switch off). `scenes/exterior.js` (the fixed-city bench), `scenes/worldModes.js` (interiors, the
streaming host's own modes - its board is the world's) and `scenes/dungeonContext.js` (the standalone dungeon) seat
none: online is the streaming world's, so a bench has no shared events to list; a raid's line there (offline raids are
the mod's) still opens the news. The host grew no line: the raid list moved out of `timersSource` to
`systems/raidingParties.js` raidTimerList (with each town's pixel and ledger), which paid for the player's pixel and the
gate's and the serpent's sites on the source (`test/scenes/hostceiling.test.js`: 36,284 -> 36,281).

## 6. What it does not do

- **How often events come** is unchanged: three stars an hour while the festival runs, about twenty-two raids a two-hour
  day across the Bay, the gate every game day. PanickedTofu and EvoAva also asked for more of them (EvoAva: more raids
  where too many players go to one); that is a balance call, the owner's, left open here.
- **A raid on the map before it starts.** The map's ring (`ui/eventMapMarks.js` raidMapMarks) still stands while a raid
  runs; the board names a coming raid a quarter of an hour ahead.
- **Travel time.** The board says how far, not how long: a trip's real time depends on the travel mode and the Overworld.

## 7. Proof

`test/systems/events1_board.test.js` (7: the way, the board, its raids, its cut, the announcements, the news, the door),
`test/ui/events1_board_ui.test.js` (6: the plate on a fake document, the news, the switch, a link lost, the dress and the
piece, the seams), `test/systems/starfall/star6_words.test.js` (the warning), `tools/mutants/events1.json` (27, all
dead), and
`tools/eventBoardProbe.mjs` (every size and skin above, all clear).
