# QUEST-AUDIT III - the quest system read whole, every defect a player can hit, fixed

The owner, 2026-10-23: *"Can you do a detailed quest audit, fix any and all outstanding issues. Do not worry about DFU
parity."* QUEST-AUDIT (`Field-Bugs-2026-10-04d.md`) and QUEST-AUDIT II (`Quest-Audit-II.md`) hunted how the town mods
break quests. This one reads the whole quest system, from the script to the journal to a party's shared copy, under the
owner's standard: a difference from Daggerfall Unity is not a finding by itself (SCOPE1). A finding is a defect a player
can hit. That means a throw, a quest that cannot be started, carried on or finished, a target that never stands or cannot
be reached, a reward paid twice or never, progress lost over a save, a shelf, a restart or a share, or a journal that
says something false. Words a player sees raw or in the wrong language count too, as does a state that breaks the next
quest.

**How.** Six read-only lanes worked on a frozen snapshot: a git worktree at main `4728fb88a`, with the freeware ARENA2
fetched by `tools/fetch-data.sh`. The lanes were:

- the lifecycle and the save (L1);
- the actions and the macros (L2);
- placement and the scene mount (L3);
- the journal, the offers, the restart and the shelf (L4);
- the online share (L5);
- the record's own open items against the code (L6).

Each lane was told what was already in hand: #982, #986 (PR #1010) and CRATE-FREE's `N0000005.RDB` pin. Each finding
came with a script over the real modules that showed it (CONFIRMED) or a traced path (PLAUSIBLE), and each fix was
checked against its lane's script on the fixed tree. Every fix is pinned and every pin mutation-checked (below).

## The fixes, by lane

### The issue in hand: STORY-AGAIN (#982) and LODGED-STAND

- **STORY-AGAIN (#982, levelman123: S0000012's messenger was not found in its two days, "Quest fails. I am unable to
  continue main story").** A step of the main story ends on a refusal, a missed window or a death, and the step that
  would have started the next never runs, so the story stopped for good. DFU's only way back is its developer console.
  The machine now records the steps begun and the steps that ended unpaid. These are `storyStarted` and `storyFailed`,
  saved, because the tombstone's week is not long enough to remember them (`src/systems/quest/machine.js`
  storyAgainRefusal, startStoryAgain, seedStory). The journal's Main Quests offers such a step again from its first
  step. Its questor then waits and offers it once more.

  The refusals are:
  - not the main story's own, or the world's backbone (PROTECTED_QUESTS);
  - running or set aside;
  - never failed, or one that paid;
  - the story went on past it (a quest its script starts has begun);
  - a step that starts nothing and pays nothing, whose end cannot be told from its finish;
  - no source.

  A save from before the record learns it once from the journal's archive, where the last entry of a name is its
  verdict. Both journals (the pause window's Quests tab and the chronicle) draw it with the twice-armed press Abandon
  uses. Its words are in all fourteen languages.
- **QUEST-RESET's questor rung, narrowed.** The restart refused every quest with a questor, and so it refused every
  main-story step. Now only a questor bound by the click refuses (its `questorData` is the clicked NPC's), because
  whoever was clicked last would be bound. A questor the script names (`add _Mynisera_ as questor`) binds the same person
  again.
- **LODGED-STAND.** Daggerfall's N0000005.RDB lays quest spawn marker 29157 at the foot of statue 62330, inside its
  footprint, and the Person a dungeon Place stood there stood inside the statue. A dungeon quest Person is now freed by
  CRATE-FREE's own law (`src/systems/quest/sceneMount.js` freeQuestStand), at the billboard's height
  (`src/scenes/worldModes.js` standQuestFlatIn).

Pinned by `test/systems/quest/questaudit3.test.js` and fb1004d_cratefree's real-data pin; `tools/mutants/questaudit3.json`.

### L1 - the lifecycle and the save

- **END-GRACE.** A save taken inside `end quest`'s two ticks of grace (a reward box holds the tick) loaded a quest that
  ran for ever, and its questor refused all work. The envelope carries no `ticksToEnd`, and EndQuest never re-arms. A
  restored quest whose `end quest` has run enters its grace again. This was FIELD BUGS 2026-09-28's open item; L6
  found it too.
- **END-ONCE.** A second `end quest` inside the first one's grace re-paid the reputation and filed the notebook entry
  twice. That happens with a deadline's end under a reward box that held the tick while the clock ran on. The second
  `end quest` now only extends the grace.
- **START-HELD.** A `start quest` the next tick had not yet run was lost by a save: S0000012's hand-in shows its reward
  box, then `start quest 20 20`. The scheduled quests ride the envelope (`toInvoke`, written only when one waits).
- **PROMPT-HELD.** Prompt.cs and PromptMulti.cs complete when the box is shown, and the answer lives only in the box's
  callback. A save while the box was up (online, the five-minute save or the page-hide save) loaded a question spent and
  never answered. The Lost Child's child never asked again, and S0000003's `prompt QuestorOffer` left a quest with no
  way on. Now the box's place is held while it is up, and the action completes on its answer. The place is the task and
  the action's index there, which a party's resync rebuilds to. A load asks again.

Pinned by `test/systems/quest/questaudit3_life.test.js`; `tools/mutants/questaudit3_life.json`.

### L2 - the actions and the macros

- **SEND-HELD.** A `send` wave waiting for a town raised the encounter every tick it waited. That broke every rest and
  turned back every Travel Options trip outside a town (S0000021's zombies, S0000009/10/12's, K0C30Y03's). A held wave
  raises nothing.
- **GOLD-ONCE.** A quest's gold Item pays its holder once. S0000009's `_S.02_`, set again every dusk, paid its 87 gold
  every night, and N0B21Y14's `get item _gold_` then `give pc _gold_` paid one pile twice. The Item's `goldPaid` is
  saved. A partner's received copy starts unpaid, and a resync keeps the holder's own.
- **MUTE-HELD.** An `until _x_ performed:` body re-arms each tick, and MuteNpc's re-arm unmuted the person between
  ticks, where a click lands. S0000018's Gortwog took the click at once, skipping the thirty days, the tenth level and
  Medora's vision. The persisting re-arm keeps the mute.
- **ILL-SAYING.** `make pc ill with X saying N` was read past the `saying`: S0000007's "You feel a sickening jolt as the
  _relic_ vanishes." was never shown. It parses, saves and shows.
- **DOTTED-SYMBOLS.** Six actions captured a symbol with `\w+`, and a symbol with a dot or a dash fell to the
  unknown-action path. Those are DialogLink, AddDialog, PlaceNpc, PcAt, RevealLocation and CreateNpcAt.
- **CLIMATE-NAMES.** C#'s alternation bound `climate desert2` to desert and `climate mountainwoods` to mountain, so
  Foraging's MiningQuest's rich seam never read 225 or 230. The longer name is tried first.
- **CAST-SHARE.** A `cast X spell do` action's effects are read from the holder's ARENA2 at the parse. A receiver's
  reference parse is headless, so every share and resync of N0B00Y08, N0B00Y16 and N0B40Y07 was refused as a forgery.
  The effects are read lazily where the copy runs, and the share law holds them as the holder's.
- **JOKE-MACROS.** TEXT.RSC 200's jokes carry their own macros (%ra in 22 of the 23), and the expansion never walked inserted
  text. K0C00Y05's child and eight quests' rumors told the player "%ra" raw. Each joke's tokens are expanded, and a miss
  keeps the token.
- **DI-UNREF.** `%di` with no place referenced yet threw. C# reads LastPlaceReferenced.Scope before its null check, and
  a load or a share forgets the reference. The talk answer or the popup threw to the host, which error-ended the quest:
  P0B00L01 1014, R0C10Y12 1012, R0C11Y03 1011, and V0C00Y00's and Y0C00Y00's contacts after a load. It reads the Place
  a quest Person stands at, else DFU's own "...never mind...". This retires Quest-Guide-Arc's open bullet.
- **DUEL-TOWN.** This was Quest-Audit-II's "Recorded, not changed". A0C00Y10's journal sent the duel to "_inn_ in
  ___giver_", the questor's town, where the inn may be the nearest town's (NEAR-SITE). It is patched to `___inn_`
  (`src/systems/quest/questPatches.js`).
- **C0C00Y10's healer.** This was FIELD BUGS 2026-10-13e's owner's call, now taken. `_no_ task: clear _S.10_` meant
  the healer to ask again, and Prompt.cs's allowRearm kept the prompt spent, so the talisman was never bought.
  NO-ASKS-AGAIN now reads a No that only clears its click-asked task as that ask-again (`src/systems/quest/noAsksAgain.js`
  clearingNo).

Pinned by `test/systems/quest/questaudit3_acts.test.js` (DUEL-TOWN and the healer by `questaudit3_life.test.js`);
`tools/mutants/questaudit3_acts.json`, `questaudit3_life.json`.

### L3 - placement and the scene mount

- **RELOAD-TWINS (HIGH).** A load restores new quests under the same uids. A quickload inside the same dungeon mounts
  over the stands the scene still holds, and by their old Symbol objects none read "already here". Every quest person,
  item and live foe stood twice: two giants for M0B00Y16, and a hidden person's twin left standing and clickable. The
  mount relinks every standing behaviour to its live resource and symbol first. This closes the C# quirk the mount
  guard's comment kept.
- **ENDED-STANDS.** A quest that ended while its people and things stood (a timer, its own `end quest`) no longer
  ticks, so nothing put them away. Its item could be taken and its person took every click. They are put away as a
  shelved quest's are.
- **LINK-OWN.** HasSiteLink answered for any link at the site. A second Place of the same quest at the same building
  never got its own link: S0000503's `_dummy_` and `_magesguild_` share one Mages Guild hall in 17% of starts. Another
  quest's link stood in for this one's too. It is now this quest's link for this Place. QREPAIR's second mend is its
  backstop.
- **HOUSE-HOUSE.** The house fallback read (p2 -1, p3 0) as `random` and took a tavern, a shop or a guild hall for
  `remote house4` (6-8 towns in 87, Nearby on). It asks for any house, after the typed house at both reaches.
- **RESEAT-TYPED.** The re-seat seated sites in quest order, so A0C00Y06's and A0C00Y07's `local random` took both of a
  re-laid town's taverns, and A0C00Y10's `local tavern` was unseated. Sites of a kind are seated first, and a site
  prefers the building of its own journal name.
- **MARKERLESS-DRAW.** A drawn dungeon whose build holds no quest marker gave up the draw: 117 of 3,444 small builds,
  and one medium (Glork's Hold, the Cairn of Necromulan). Another of the pool is drawn, up to six.
- **QLBD02.** The questline's coven named one Mage for two foes. Each has its own.

Pinned by `test/systems/quest/questaudit3_scene.test.js`; `tools/mutants/questaudit3_scene.json`.

### L4 - the journal, the offers, the restart and the shelf

- **RESTART-PAID.** QUEST-RESET restarted a quest that had already paid (S0000015's diary money and standing,
  Nocturnal's artifact), as often as the button was pressed. A quest that paid out refuses: `'paid'` (machine.js
  questPaidOut).
- **SHELF-TWIN.** A quest item abandoned onto the ground is handed back when the quest is reclaimed, and picking up the
  ground copy made a second. A twin is refused. The reclaim's "is it kept" reads every keeping, including the wagon,
  the Materials Bag and a repairer's hands.
- **NAMED-TIMER.** "Time remains" showed the tightest counting clock, so a letter's six hours showed as urgent beside "I
  have 236 days to rescue her" (B0B00Y00, K0C00Y03, N0B00Y09). It is the deadline the entries name, where they name one.
  This is the lens's own law.
- **OFFER-STALE.** A pending offer whose sender had already been handed over, or whose quest no longer runs, held the
  latch. One Rest or Travel press hours later did nothing, even after another save was loaded. It is let go.
- **NO-WORK.** With Choose Guild Jobs on and no work to offer, the wait box opened a picker of nothing. The classic "no
  work" line answers.
- **RESTART-WORDS.** A questline step dropped by the journal's Restart kept its day of waiting and its "could not begin".
- **SHELF-WORDS.** The shelf's refusals, the abandon and reclaim lines and buttons, and the chronicle's "Time remains"
  were English in every language. They go through `t()`, drafted in the thirteen.
- `?exterior`'s quest world had no `getRandomText`, so %oth and %jok read nothing from TEXT.RSC's pool there.

Pinned by `test/systems/quest/questaudit3_life.test.js` (RESTART-PAID, SHELF-TWIN, RESTART-WORDS) and
`questaudit3_scene.test.js` (NAMED-TIMER, OFFER-STALE, NO-WORK, `?exterior`), SHELF-WORDS by questshelf's moved pin;
`tools/mutants/questaudit3_life.json`, `questaudit3_scene.json`.

### L5 - the online share

- **SAME-COPY.** A party member's own copy of a repeatable quest, or a stranger's final, carries another shareId. By
  name alone it replaced this copy's progress, sites and identity, or ended it and paid for a quest this player never
  did. Two known identities that differ are refused 'active'.
- **SHARE-MEMORY.** After a reload every partner's sync and final were refused 'active', and this copy's progress never
  left. The share memory is rebuilt from the quests restored.
- **PROGRESS-KEPT.** When two members acted at about the same moment, the envelope's task flags and journal replaced
  this copy's. A deed made in the ten seconds the client's floor held this copy's sync was gone from both copies. A task
  set here stays set, and a journal step stays, unless the partner's copy newly cleared it. The merge is then sent back.
- **BUSY-SYNC.** A sync the hub refused as 'busy' was sent by nothing until the next change. Its baseline is let go.
- **SHARER-GONE.** This is AUDIT QUESTLINES BRANCH-1's "LEFT, said", wider than written. A sharer who reloaded,
  abandoned, restarted or left kept every received copy waiting at its choice for good. Quiet for two minutes of ticks,
  the holder is asked.
- **GOLD-HOLDERS.** The purse was split by the party's size. A share three members refused paid its one holder a
  quarter. The shares are the copies held, never more than the party: this one, and each partner heard holding it.
- **GUARD-HOLDER.** GUARD-ONLINE's watch fields rode the progress law. A member who left at the close sent `guardAway`
  and started the watch over for the one still in the hall. They are the holder's.
- **KILL-ONCE.** This was VERMIN-SHARED's "Said, not fixed". Each copy counted the kills it saw, and the resync kept the
  larger count. An envelope that came before the credit counted one kill twice, so a `killed 2` closed on one spider.
  The kills an envelope brought are learned, and the partner's credit is not counted again.
- **REPUTE-SHARE.** REPUTE-GATE's two quests wait online for the guild standing their headers name. A party's share
  handed them to a member at standing 0. The receiver's own standing is asked.
- **SHARE-WORDS.** Every share refusal and arrival line was English in every language.

Pinned by `test/systems/quest/questaudit3_share.test.js`; `tools/mutants/questaudit3_share.json`.

## Pins moved

Each moved pin says PIN MOVED with its reason. They are:

- fb1004d_cratefree (four lodged, and the free);
- questreset1 (the click-bound questor);
- enhancedPause PX22;
- auditquests_linkage (the dotted symbol);
- fb1013e_noasks (the law list gains C0C00Y10);
- questmacros (%di);
- guide1_questLens (the moved counts);
- questactions5 and foragefix (the climates);
- fb1017b_shamtrail (the patch keys);
- world5 and world7 (START-HELD);
- qa2_layouts (SHARE-MEMORY);
- auditdisc28_quests, fb1003b_vermin and keptkill;
- disc22f_share_copy, disc25d_guild_share and sharemend;
- questbridge, rest8_questwaits and audit_guide (NAMED-TIMER);
- questmachine;
- fb1004d_questtrace (HOUSE-HOUSE);
- qrepair (LINK-OWN);
- questshelf;
- ql3_rewards and realm0 (GOLD-HOLDERS);
- auditparty8 (the echo's baseline);
- sd20g_delve;
- l10n3d_services (NO-WORK's wait box needs work in its pool) and l10n4_hardcoded (the ratchet: DUEL-TOWN's two
  anchors into DFU's own text up, the words routed down).

Twenty-two mutant records whose source moved were re-aimed, and all are dead again. The audit's own mutants are
240, all dead: `questaudit3.json` 16, `questaudit3_life.json` 75, `questaudit3_acts.json` 60, `questaudit3_scene.json`
30 and `questaudit3_share.json` 59.

## Left, and why

- **K0C30Y03's `_victin_`.** The start-up's `repute with _victin_ exceeds 15 do _S.28_` names a Person the script never
  declares, so that one branch never opens. Which Person the author meant cannot be told from the script, so it is not
  patched; the quest parses and runs by its other branches.
- **WAQ_SHIP_ATTACK_PIRATE's "with 100 success".** The vendored mod's text stays verbatim, and the quest is reachable.
- **#884 (sieges).** No cause was found in the quest system.
- **#986 (Wood Bundles).** PR #1010 is open for it.
- **DEAD-CLOCK's other half.** Whether a clock that no entry names should leave the journal windows altogether is still
  the owner's call. NAMED-TIMER took only the half that was false.
- **WD1's WALLAA08 sha.** `test/formats/worldData/wd1_worlddata.test.js`'s "every vendored patch rebuilds the author's
  file" fails on this ARENA2 at the snapshot's base as on this branch. It is not the quest system's, and is not touched
  here.
