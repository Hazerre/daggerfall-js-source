# FIELD BUGS 2026-10-24 - four Discord threads

Four threads from the Discord, handed over by the owner as phone screenshots: one from #feature-feedback, three from
#bug-reports. Read on main's `f58525b0a`, each by a cold reader of its own beside this one. The pins are named under each
fix, the mutants `tools/mutants/fb1024.json` (27, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #bug-reports, "Potential Bug: Regens Health: In Darkness": "`src/scenes/hostEnchant.js` defines inSunlight and inHolyPlace in createEnchantCtx(), but apparently never provides inDarkness ... the enchantment may never activate, even at night or inside dungeons" | Proven as written. RegensHealth's InDarkness arm asks `ctx.inDarkness`, and the one enchant ctx every host mounts never carried it, so the arm read `false` everywhere. The E1 pin fed the arm a hand-built ctx | DARK-REGEN |
| 2 | #bug-reports, "Issue with deadlands ember count": "I tried to purchase my first battlemage piece ... the transaction never went through, the embers were not taken out and I didn't get the piece ... I was however locked out for the week ... I now have 52 deadlands embers on me, and it will not let me buy the aura, it says I have too few" | Proven mechanism, one cause for both halves. A sale is two ledgers, the pack's embers and the account's purse. A Panoply sale whose answer was lost, and whose question after went unheard too, gave the pack its embers back while the service had written the sale: the week's piece taken, the purse charged 20. The pack then held 20 the account would never spend, so the 50-ember aura was refused on the purse while the pack said 52 | EMBERS-OWED |
| 3 | #bug-reports, "Audio cutting out. During boss fights, or menu music." (Solved there: "If you have SteelSeries headphones try disabling steelseriesGG app ... there is still audio cutting out from time to time") | Not reproduced - no headset's driver chain here. Two mechanisms read in code: the menu theme's own context asked for the smallest buffer ('interactive') while it renders ~385 voices at peak (INTRO3b/c, four times INTRO3's); and the music scheduler's 0.25 s lookahead leaves the song silent through any main-thread stall past about half a second (`songPlayer.js` AUDIT 19 F8's skip) | THEME-BUFFER; the rest asked of the owner |
| 4 | #feature-feedback, "Inability to mix unarmed with 1H dual wielding": "you cannot mix a one handed weapon with punching, this seems like an oversight? OR maybe an issue with offhand casting?" | Not offhand casting (SPELL-HAND came a week after). TWO-HANDS' modes (`05-Combat/Two-Hands.md`) are Fists (both hands empty), Dual (two eligible weapons) and Single (anything else) - a weapon and an empty hand were never asked about, so the pair falls to Single by default, not by a decision | asked of the owner |

## DARK-REGEN (1) - `src/scenes/hostEnchant.js`, `src/systems/passiveSpecials.js`

DFU: RegensHealth.cs:97-98 regenerates on `Params.InDarkness` (2) when `PlayerEnterExit.IsPlayerInDarkness`, which is
`!isPlayerInSunlight` (PlayerEnterExit.cs:201, "Same as !IsPlayerInSunlight"). No departure, no Ledger row owed.

THE CHANGE. `playerInDarkness` (`passiveSpecials.js:"export const playerInDarkness = (nowMinutes = null) =>"`) is
`!playerInSunlight` over the same host seam, and the shared ctx answers it
(`hostEnchant.js:"inDarkness: () => playerInDarkness(),"`). The enchantment's darkness is DFU's: a roof at noon is
dark. The career's Regenerate Health: In Darkness keeps its own law (`!day || dungeon`, PassiveSpecialsEffect.cs), as
DFU has the two. Both heal, so a class with the advantage and a ring stack, as the report expected.

THE FOUR HOSTS: the ctx is `createEnchantCtx`'s, which `world.js` (and through it `worldModes.js`'s interiors),
`exterior.js` and the standalone `dungeonContext.js` all mount; the seam it reads is registered by each.

PINS: `test/systems/fb1024_darkregen.test.js` builds the ctx from the producer (TEST THE SHAPE THE PRODUCER MINTS) and
runs the real ring through the round pump - at midnight, under a roof at noon, and on the noon street.

## EMBERS-OWED (2) - `src/systems/sigil/sigilBroker.js`, `server-account/src/egEconomy.js`

No DFU member: the Broker, her insignia and the Panoply sink are the port's own (`11-Multiplayer/World-Bosses.md` WB9g,
`11-Multiplayer/Elite-Gates.md` section 19).

WHAT HAPPENED. `panoplySale` (and `insigniaSale`, its pattern) takes the pack's embers first, then asks the service
(`egSink`, one batch: the purse charged and the week's `eg_sink` row written). A lost answer (`insigniaUnheard`: no
answer, or a 5xx - `egSink` asks the purse again AFTER its batch commits, so a failure there answers 500 on a sale
already written) was asked after through `/v1/eg/keys`. "Not held" and "not heard either" were one branch: the embers
back. With the service down for both calls, the service kept the sale and the pack got its 20 back - the player's
"locked out for the week" (the next press is `bought`) and, the purse 20 under the pack, the aura's `short`
(`accounts.js buyInsignia` checks `EMBERS_EARNED_SQL - insignia_spent`, never the pack).

THE CHANGE.

- `held` answers three ways: the sale, `false` (the service answered and holds none - the embers back, as before), or
  null / a throw (unheard). The two hosts' reads are `wardrobeHolds` and `sinkHolds`.
- Unheard, the sale is OWED (`oweSale`): its embers stay out of the pack, the row `{ kind, id, embers, week, clock }`
  rides the save (`SigilBrokerOwed`), and the Broker says so (`broker.owed`, in every language). At most `OWED_MAX` (8); past it a
  lost sale gives back as it did. While one is owed the same sale is not taken again (any Panoply piece - one a week;
  the same insignia), or a second press could pay twice for what the first had already bought.
- Her window's two loads go through `brokerOwedDoor` (`world.js:"const brokerOwed = brokerOwedDoor(playerEntity, saveSoon, panoplyPieceById);"`):
  each asks the service and settles what was owed BEFORE it asked (an answer asked before a sale says nothing of it).
  An insignia owned is the sale, one not owned gives the embers back. A Panoply sale held in its week (or the next, a
  press as the week turned; one either side where the week was the device clock's, the window never having heard the
  service's) adds the piece, and one the service answered for and does not hold gives the embers back.
- The service says the weeks before: `egSinkOf` answers `sink.recent` (`EG_SINK_RECENT_WEEKS`, 8 in all, newest first),
  so a sale unheard in one week settles in a later one. A client against a service without `recent` keeps a past week's
  sale owed rather than guess. Past the eight weeks, the embers come back. No `ACCOUNT_VERSION` moved: the field is
  additive and read only where it is present.

THE FOUR HOSTS: the Broker's window stands in the streamed world alone (`world.js` openBroker); `exterior.js`,
`worldModes.js` and `dungeonContext.js` open no Broker.

NOT DONE HERE. The player in the report: no owed row exists for a sale made before this change, so their account stays
20 under their pack until an operator puts the 20 back (`UPDATE players SET insignia_spent = insignia_spent - 20 WHERE
id = ?`, after reading their `eg_sink` row for that week). And the refusal does not yet say the account's own count
("Your account can pay 32 of 50") - the service answers `purse` with `short`, and the client's refusal drops it; that
is a new string in every language, left for its own slice.

PINS: `test/systems/fb1024_embersowed.test.js` - the owed branch, the settles (every week rule, the race, the cap, the
save), and the report's case over the real Worker (the sale lands, both answers lost, the next open hands the piece);
`egeco_broker`, `wb9g_insignia` and `auditscale2_acct` moved to the three-way `held`; `egeco_service` and
`egplay_service` the `recent` answer. Mutants `tools/mutants/fb1024.json`, OWED1-OWED6 (22, all dead).

## THEME-BUFFER (3) - `src/systems/introTheme.js`

The menu theme plays on its own AudioContext (`introTheme.js` makeContext), which nothing interactive shares - the
clicks and the game's sounds are the game context's (`audio.js`). It asked for `latencyHint: 'interactive'`, the
smallest buffer the device gives, with no recorded reason, while INTRO3b/c made it the heaviest score in the game (a
cold read rendered it offline: 385 voices at peak, 204 on average, against 98 and 41 at INTRO3). A small buffer is the
first to under-run when the audio thread is slow, and a headset suite that processes the stream (SteelSeries Sonar)
takes from the same deadline. It asks for `'playback'` now. The film's clock is `audibleContextTime`, which reads the
device's output timestamp (or subtracts the output latency), so the longer latency moves no frame against the score.

NOT DONE HERE, put to the owner: the game context keeps the default `'interactive'` (a larger buffer delays every
blow's sound); the music scheduler's lookahead stays 0.25 s (a longer one rides out a stall but keeps that much more of
every voice's chain alive on the audio thread, which is the menu theme's load again); the menu theme's voice count is
INTRO3's design. Asked of the reporter: browser or desktop app, and whether the sounds cut with the music or the music
alone - the music alone is the scheduler's stall, both together the audio thread's.

PINS: `test/systems/fb1024_themebuffer.test.js`; mutants BUF1 (2, dead).

## (4) - a weapon and a fist

TWO-HANDS (`05-Combat/Two-Hands.md`; `combat/twoHands/handsLaw.js` handsModeOf) has three modes: Fists when both
hands are empty, Dual for two eligible weapons, Single for anything else, and Single strikes with the lead hand
alone. The owner's ask that made it named bare fists and two weapons; a weapon and an empty hand were never raised, and
no record says why not. DFU has no second hand at all (WeaponManager.cs ToggleHand swaps the one in use). So the
player's reading is right: an oversight, not a rule. It is a design question - whether the pair alternates, whether it
is on by default (the off hand's punch is HandToHand's skill/5+1, weaker than most weapons at low skill, so an
always-on pair would cost most characters damage), and how a readied spell's claim on the free hand (SPELL-HAND) wins -
so it is the owner's, asked with this record, and nothing changed.
