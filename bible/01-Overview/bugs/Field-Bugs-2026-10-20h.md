# FIELD BUGS 2026-10-20h - the Discord's bug-reports, read to their roots

Nine threads from the Discord's #bug-reports (2026-10-20), handed over as screenshots with no word beside them: nine
reports, from Flylighter, PanickedTofu, SaberGGaming, MD-Geist, Afelipe, ATLAS, fogs (with sovot), CosmicBooty and
Kikkirik - and a tenth in the chat behind Kikkirik's crash, from Ballvald Steel-Hewer. Each was traced end to end on
the real producers, with the freeware's data (`tools/fetch-data.sh`) where the map, the blocks or the bodies decide, and
Daggerfall Unity's own C# beside it. Read on main's `ccfb3c135`, and built on `a6cd40934` (#1091's merge). The calls the
reports left open are taken here under the owner's standing word on these threads (Mac, 2026-10-19: "Stop with the
decisions for me") - except where the owner's own number decides, which is left to the owner with its measurements; each
section says which it took and why. The pins are `fb1020h_*`, the mutants `tools/mutants/fb1020h_*.json`.
Named 20h: begun as 20f, it was renumbered at its merge of main, which by then held 20 through 20g (20f, the Elite
Breach's stones, #1093; 20g, SWAP-CYCLE, #1094).

| | Report | What it was | Done |
|---|---|---|---|
| 9 | Kikkirik: "crash on talking with the fast traveler" (the CRASH panel: `TypeError: Cannot read properties of undefined (reading '0')` at `Qv` <- `bye` <- `i` <- `oy` <- `iy` <- `Object.Wh [as exteriorActivationHit]`) | A Hearth Offering's ray target carried the culling box's 6-array where the street's ray reads `{ min, max }`: every press in a town where one stood threw out of `rayAabb` | fixed on main by #1091 (FIELD BUGS 2026-10-20e OFFERING-RAY); nothing here |
| 10 | Ballvald Steel-Hewer, in the chat of another player's crash screenshot: "there are many instances where insert here names are not appearing. meaning when i ask about the work they say go to talk to 'insert name here' :D" | The Work answer names whoever the questor pool's selection points at. Two things left that selection on someone the pool no longer held: the offer window spends the questor it was opened for, and a load brings in a pool without the selection. The answer then read "Go to a place called  and talk to someone named ." Found on the way: every woman with work was "him" | QUESTOR-HELD; QUESTOR-SHE |

## QUESTOR-HELD: the Work answer names a questor the pool holds (10)

`src/systems/npcSession.js` (`_holdSelection`, run at the end of `removeNpcQuestor` and `restoreSaveData`).

FOUND. The Work answers, TEXT.RSC 8076 (6 variants) and 8077 (8), each name the potential questor through `%pqn` and
their building through `%pqp`. Both read the pool's selection, and `npcSession.js:"    if (!entry) return '';"` answers
the empty string for a selection the pool does not hold. The answer is expanded first and the next questor is picked
after it (`answerPipeline.js:"        this.deps.setRandomQuestor?.();"`), which is DFU's own order
(TalkManager.cs:2033-2036). So an answer names the selection that stood BEFORE the ask. The build keeps that selection
in the pool: it selects the last questor it adds (`npcSession.js:"        this.selectedNpcWorkKey = npc.nameSeed;"`,
TalkManager.cs:2869). The other two writers did not:
- THE OFFER. A click on a pool member opens the quest offer, and the offer window's constructor takes them out of the
  pool, whether the job is accepted, declined or never drawn:
  `offerFlow.js:"    if (!this.deps.isPlayerInsideCastle?.()) this.deps.removeNpcQuestor?.(npcData.nameSeed);"`,
  DaggerfallQuestOfferWindow.cs:33-35. Nothing moved the selection off the spent questor. The selection is a uniform pick
  made after the previous answer, so a player who goes to the person that answer named, and takes or declines their
  job, makes the next answer blank with a chance of 1 in N, N being the pool's size. Pools are small where most players
  ask. Over every location in Daggerfall's data, in its own layouts and in the town packs', the median village has 12
  candidates, a roadside tavern 10 (5 in Beautiful Villages' rebuild) and a manor 7 (11). The 25% roll leaves pools of
  about 3, 2.5 (1.25) and 1.75 (2.75). Driven over a sample of real locations, a player who follows each answer until the
  pool is spent read a blank in 7% (cities) to 20% (taverns) of all Work answers. At least one blank came in 56-89% of
  visits to a tavern, village, hamlet or city: "many instances". The blank happens once per stale selection, because the pick after it lands on a live questor.
- THE LOAD. `save.js:"    talk.session.restoreSaveData(extras.talk);"` brings the save's pool in, but neither the
  selection nor the pool's location is saved (DFU's SaveDataConversation carries neither). The arrival does not rebuild
  the pool in the same town (`world.js:"    if (key === _topicsKey) {"`, then the location gate,
  `npcSession.js:"    if (this.exteriorUsedForQuestors === locationIndex) return false;"`). The 25% draw is another
  session's, so this session's selection is rarely in the restored pool. 72% of first answers after loading an earlier
  session's save in the same town were blank, and 100% after a boot load in a location at index 0. The dungeon
  quickload takes the same restore with no arrival at all
  (`dungeonContext.js:"      if (session && restoreSessionState(extras, { questBridge: opts.questBridge, talk: opts.talkSave"`).
  Online refuses an in-session load, so an online player like Ballvald met the offer's blank.

Everything else that could print a blank was measured and does not occur, over all 12,068 locations with people in both
layouts. No questor's building name is empty: only named buildings enter the pool, and a guild hall takes its guild's
name. No questor's name is empty: the name bank is always a race bank, because the region index is clamped to 0..61. A
town with no questor answers "There's no work available at all." The first answer after a build names the last questor
added (200 of 200). The people named are real: in four cities, all 381 questors are a person the interior stands, with
the same identity and name, and each opens the offer when clicked.

DFU cannot print the blank, because it throws there. GetQuestorName, GetQuestorGender and GetQuestorLocation index the
pool with no guard (TalkManager.cs:2586-2600). The first macro's GetMacroDataSource reads GetQuestorGender
(TalkManagerMCP.cs:32-34), and MacroHelper.GetValue catches only NotImplementedException (MacroHelper.cs:503-528). So the
next Work answer throws KeyNotFoundException before SetRandomQuestor (TalkManager.cs:2036) can move the selection, and
the topic stays dead in that town until the pool is rebuilt. DFU's RemoveNpcQuestor (TalkManager.cs:2602-2605) and
RestoreConversationData (TalkManager.cs:2541-2542) both leave the selection where it stood.

FIXED. Both writers end in `npcSession.js:"  _holdSelection() {"`. While the pool holds questors and none of them is the
selection, it selects the last one it holds, the build's own rule. A selection the pool still holds is left alone, and
an empty pool still answers the no-work record. Nothing is drawn: neither DFRandom nor the talk's rolls. DFU's order
stays: the answer names the selection that stood before the ask, and the pick follows it. A departure from DFU's
KeyNotFoundException (a dead Work topic), with its Port-Ledger A row (THE WORK ANSWER NAMES A QUESTOR THE POOL HOLDS)
and its line in `06-Systems/Talk-Arc.md` (QUESTOR-HELD). The one new Ledger row moved every Ledger line below it:
`tools/citeShift.mjs --apply` moved the 19 line cites it maps. Port-Status' section-2 identifiers and its section A tally
(326 rows, 311 standing) were moved by hand, each checked against the base row it named, as were the struck
`.SAV`-reader cite and the struck keybinding-registry one. Two of its identifiers were already one row off before this
change (`:975`, A MOD'S MATERIALS, and `:976`, AN ENEMY'S GLOW), and are aimed at their rows now.

QUESTOR-SHE (found on the way). The four pronouns of the Work answer are the questor's
(`talkMacros.js:"  const female = () => ctx.questorGender?.() === GENDERS.Female;"`). That helper compared the string
`'female'`, but the pool's NPCData carries the Genders enum
(`staticNpc.js:"    gender: ((pn.flags ?? 0) & 32) === 32 ? GENDERS.Female : GENDERS.Male,"`), and the world host hands
it on unchanged (`world.js:"      return npcSession.getQuestorGender();"`). So every woman with work, 44.8% of questors,
was "he/him/his" in four of 8076's six variants and three of 8077's eight. The pins had handed the helper the string,
which no producer mints. DFU switches on the enum (TalkManagerMCP.cs:146-195), so this restores DFU and departs from
nothing.

THE FOUR HOSTS: none changed. `world.js` mounts the pool and the talk MCP, `worldModes.js` opens the offer that spends a
questor, and `dungeonContext.js`'s quickload restores the pool, each through the module. `exterior.js` runs no NPC session
(`exterior.js:"  //     %f-faction NAME getters, removeNpcQuestor). This route runs no"`).

PINS. `test/systems/talk/fb1020h_questor.test.js` (7). The fixtures come from their producers: the town's people from
questorCandidateBuildings over an RMB block, the pool from NPCSession, the offer from QuestOfferFlow.offerSocialQuest,
the save from composeSessionState and restoreSessionState, and the answer from AnswerPipeline over the talk macros:
- the build selects the last questor added, and the first answer names them;
- the offer spends the questor the selection names, and the next answer names the last one standing;
- an offer from another questor leaves the selection where it stood;
- the pool spent to its last questor answers the no-work record;
- a load whose pool lacks the standing selection selects the last questor it carries;
- a woman with work is "her", with the world host's seam handing the pool's own value on;
- with ARENA2, every variant of the real 8076 and 8077 names the held questor and their building after the offer.

Before the fix, four of them fail, the last with the field's own sentence
(`8076[0] names nobody the pool holds: " might have work. You can find him in ."`). The three DFU laws pass either way.
Mutants `tools/mutants/fb1020h_questor.json` (9, all dead): either writer unhooked, the empty-pool guard flipped, a held
selection moved, the first questor instead of the last, the selection never written, the female arm made Male, the
female arm inverted, and the string back.

PIN MOVED: `test/systems/talkmacros.test.js`'s pronoun pin and its `%pqn` pin hand the questor's gender and bank as the
pool mints them (`GENDERS`, `BANK_TYPES`), not as the strings `'female'`/`'Breton'`. `test/systems/audit26_talk.test.js`'s
F097 source pin reads the enum comparison. No existing mutant record named the lines this changes.

NOT CHANGED (recorded as found, the coordinator's call for this batch):
- THE POOL CAN OUTLIVE ITS TOWN. A restore carries no location, and the gate compares the per-region location index
  alone (DFU's too). A save made outside any town that carries town A's pool, loaded and then followed into a town
  whose index equals the session's stamp, keeps A's pool, and its answers name A's people and buildings. Two of the
  3,231 neighbouring cross-region pairs of locations share an index.
- THE WILDERNESS POOL. DFU's OnMapPixelChanged reaches GetBuildingList on a wilderness pixel, where CurrentLocationIndex
  is -1 (PlayerGPS.cs:191-194), and clears the pool. The port keeps it: `townTalk.js:"    if (!topics || !factions) return;"`
  never reaches the pool with no location. DFU, back in that town, then has no work at all, so the port's keeping is
  arguably the better law, but it is an unrecorded departure.
- THE INDEX-0 LOCATIONS. A fresh session's location stamp is 0 (DFU's Awake, TalkManager.cs:514), so the first visit to
  a location at index 0 (14 hold questors, among them Arkmore, Crosswich, Warborne and Lamwych Hall) builds no pool and
  answers "no work". After a boot load there, the stale selection is now held, so no blank.
- THE BUILD'S DFRANDOM DRAW. DFU's GetBuildingList logs every questor it adds through GetQuestorName (TalkManager.cs:2870),
  which srands DFRandom by that questor's seed and draws their name. The port's build draws nothing. Whether any
  unseeded DFRandom reader follows a pool build was not checked.

Not seen in play here. The pins and the measurements drive the real modules headless, the real records and towns
from the player's data, and the real save envelope.

## OFFERING-RAY, again: the fast traveler's crash is 2026-10-20e's (9)

No file changed for this report.

FOUND. The panel's build is Update 0.0.296 (`a0ba01168`, the release `app-v0.1.10373`). Rebuilt from `git archive` with
the release's own build stamp, its chunks are `worldTick-CEm_09Ca.js` - the panel's, exactly - with `arenaGate-GhJErWMY`
and `world-6d1hmgxx` beside it, which the blurred names on the panel match; the world chunk carries the build tag, so
the hash names that one build. The rebuilt sourcemaps map every frame of the panel, column for column:
`activate.js:"let t0 = (aabb.min[a] - origin[a]) * inv;"` in `rayAabb` <- `nearestActivatableHit` <- `nearest` <-
`firmFirst` <- `pickActivatableHit` <- `worldModes.js` `exteriorActivationHit` <- the press's `raceActivation` in
`world.js`'s `frameMotor`. The rebuilt chunk's own `pickActivatableHit`, handed a person and one target as WITCH1 minted
it, throws the panel's five frames at the panel's columns.

So it is OFFERING-RAY (`Field-Bugs-2026-10-20e.md`), found the same evening from Temegast's and Boar's panels: a Hearth
Offering's target (`witchesHost.js` `targets`) handed the ray the batch's culling box, and the pick tests every
entrant's box before it races them, so the throw did not depend on what the press was aimed at. "The fast traveler"
is Immersive Travel's carriage driver at the city gate (faction 8642, its "Fast Travel" service): a static NPC in the
same door set, whose press threw in the race before `activateStaticNpc` was reached. Any press in that town would have.

FIXED by #1091 (merged as `a6cd40934`, before this record was written), the same fix this trace had drafted: the
offering mints the ray's `{ min, max }`, and `player/activate.js`'s `RayBox`/`RayTarget` types make the 6-array a type
error at the producer. Checked on that merge: the trace's own end-to-end run (the real `createWitchesHost` standing two
offerings, the real `createWorldModes` with them wired as `world.js` wires them, the carriage driver among its
people, and `world.js`'s own press race cut out and run) threw the panel's TypeError on `a0ba01168` and on
`ccfb3c135`; on `a6cd40934` the offerings carry `{ min, max }`, the press at the driver picks `person:0` at 3.12 m, and
the hover pick throws nothing.
