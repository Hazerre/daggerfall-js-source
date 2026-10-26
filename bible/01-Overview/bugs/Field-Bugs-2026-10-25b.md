# FIELD BUGS 2026-10-25b - seven #bug-reports threads

Seven threads from the Discord's #bug-reports, handed over by the owner as phone screenshots. Read on main's
`745ddb5c1`, with the freeware's data (`tools/fetch-data.sh`), each by a reader of its own beside this one; the owner
then asked "Audit this" (AUDIT FB1025b, below). The pins are named under each fix, the mutants
`tools/mutants/fb1025b_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | SaberGGaming, "Reforging 'Mule' items ... reverts name": "the carrying capacity doesnt get rerolled into something new if you reforge it. Not only that but if you've renamed your item it will revert it back into its original name" | Two halves. The line given its own kind back was REFORGE-REPLACE's (#1265, on main that morning). The name was this slice's: the reforge named the piece again from its template | NAME-KEPT |
| 2 | pepsiorcoke, "Player gets a bounty when defending themselves against quest NPC's who attack": "Assassin's are attacking me for escorting another NPC and I choose to defend myself and my escort target guards approach me with a hefty fee of 500+ gold" | Not the quest (measured: its attackers' deaths charge nothing). The likely path, not proven on the reporter's save: a swing past an attacker landed on a road traveller - Protect Bystanders never covered the road | ROAD-SPARE |
| 3 | Paofrenetico, "Can't buy this piece": "I did dismantle the other chest i bought days ago, but still i cant buy this one" | The law worked: today's The Warden (Mora's) was bought today; the one from 2026-10-22 was another offer (Malacath's) under the same Legendary name. The refusal's words misled | BOUGHT-YOURS |
| 4 | Mefwhesk, "Unable to turn in The Daedra's Heart": "Elyzabyth will not let me turn the quest in" | The turn-in is DFU's (the quest's own heart, never a plain one - the thread's reply was right). Two lies of the port's: the journal struck "take its heart" on a look at the body's row, and the Enhanced pack drew the quest's heart as a plain one | HEART-TAKEN, QUEST-MARK |
| 5 | kvassdrit, "Big trees hide resource node particles": "Needs to be size aware or have a completely different visual" | A 3D tree's crown box counted its prototype's scale twice: a temperate tree glinted on its lower half, a swamp's mostly in the air above; and a big crown's glints were a herb's six at a herb's reach (AUDIT FB1025b C1) | NODE-CROWN |
| 6 | Giljabrar, "Storage in the Decoration update may be Realm Locking items": "I placed 89 rare/legendary items in a chest ... they were all 'Realm Locked'" | The decorator's Discard wrote a snapshot of every chest back, so a piece stood in the chest and the pack and the ledger locked both; in #1223's build across rooms. No route lifted a lock | CHEST-DRAFT, COPY-LIFT |
| 7 | ajaegerson, "Caravans get caught on shop signs": "Sometimes they do when travelling through towns"; Harlander: "Even going on foot you can get hung up on shop signs and fences." | (pending) | (pending) |

## NAME-KEPT (1) - `src/systems/loot/lootRarity.js`

WHAT DFU DOES. Nothing to follow for the reforge - the Reforge is the Loot arc's own. The name the player gives is
DFU's: the item maker's RenameItem (DaggerfallItemMakerWindow.cs:761) writes the item's shortName, and nothing in DFU
names the item again.

WHAT THE PORT DID. `reforgeAffix` named a Magic or Rare piece again from its TEMPLATE on every reforge (`rarityName`),
at both doors (the Mages Guild's `reforge.js` reforgePiece and the Essence's `smithItems.js` reforgeItem - one roll).
So a name the Item Maker gave was lost; a Masterwork's own name (the maker's mark names it: "Saber's Silver Ring", its
`name` "Silver Ring") took the ladder's words its mint withholds ("Saber's Mule's Ring of the Ward" - the report's
card); and a crafted jewel lost its metal and gem ("Silver Ring" to "Ring").

FIXED (as AUDIT FB1025b left it - the first cut parsed a name by the lines it had, A1-A5 below). A name is the ladder's
- at most one of its tier's prefix words and one suffix word around the piece's BASE, read off the piece: a crafted
jewel's recipe name, a Masterwork's bare template, else the RRI word and the template, and an older save's bare
template besides (`lootRarity.js:"export function linesName(item, tier, was = item) {"`) - or it is the piece's own and
stands. A reforge builds the ladder's again from the piece's own lines (never a set gem's - AUDIT GEM), a Masterwork's
its base alone. The Imbue keeps a name of the piece's own (a questline's named reward), and a load gives a crafted
piece the old law broke its base's name back (`repairCraftedNames` - the reporter's ring is "Saber's Silver Ring"
again), never a found one (a curse's line is added after its name by design).

NOT DONE. A name already reverted to the ladder's cannot be given back: nothing kept the player's.

PINS: `test/systems/loot/fb1025b_namekept.test.js` (9: the report's ring through the jeweller's mint and the Item
Maker's window at both doors; a Masterwork's name; a ladder name's words round "Silver Ring"; an old gem word, set and
unset; a cursed piece; the old law's damage, at a reforge and on load; renames that keep a ladder word; the Imbue).
Mutants `tools/mutants/fb1025b_namekept.json` (14: 13 dead, 1 equivalent as recorded - a Masterwork's RRI word, '' with
the mods off). Re-aimed by content: gem1's AUDIT-GEM-named-by-the-gem, loot9's LOOT9-name-stays.

## ROAD-SPARE (2) - `src/scenes/livingWorld/roadStrike.js`, `src/scenes/world.js`

WHAT DFU DOES. HandleAttackFromSource charges a crime for a civilian MobilePersonNPC struck (Assault, or Murder on the
kill) and a city watch killed; a hostile foe struck or killed is no crime, so a quest's Assassins killed in
self-defence charge nothing. MeleeAttackFriendlyProtection never spares a mobile NPC (C# from memory; the quest
scripts are vendored).

WHAT THE PORT DID. The quest as DFU's: A0C00Y17 ("The Escort") through the real quest machine, its four hunter
branches answered, its Assassin wave killed in the real encounter pool - no crime, the law untouched (only its warrant
branch refused is `legal repute -20`, DFU's own). But a melee swing that met no foe in reach and no townsperson went
on to the living world's ROAD travellers (LW7), and PROTECT-FIGHT's law (`cityGuards.js` playerSparesPerson - with
Protect Bystanders on, a fight passes the townspeople by) was asked of the street's walkers and never of the road's.
In an escort's fight a swing at an attacker just past reach killed the traveller on the look line - a caravan's own
merchant in an LW11 escort - in one hit; the road reported a Murder (`caravanHost.js` slain), the region's law fell 20
at the town, and the watch, knowing the face under -10, asked 500 + 5 x 20 = 600 gold. The reporter's save was not
read: this is the one path found by which a fight in self-defence ends in a fine without a blow meant for anyone.

FIXED. The road's strike is its own module (out of `bootWorld`, 9 logical lines), and asks the street's law: a
traveller it spares stops the swing - nothing killed, nothing reported, no door behind them bashed (AUDIT 29g)
(`roadStrike.js:"if (cityGuards.playerSparesPerson(near.entry.person)) return ROAD_SPARED;"`). No fight, or the
protection off, and a blow at a traveller is DFU's one-hit civilian. A departure, extending PROTECT-FIGHT's (Port-Ledger
section A). THE FOUR HOSTS: `world.js` wired; `exterior.js` stands no living roads; `worldModes.js` and
`dungeonContext.js` never hold a road traveller.

NOT DONE. A0C00Y17's warrant branch (`_S.17_`, -20 for refusing the watch) is DFU's design and stays.

PINS: `test/systems/livingWorld/fb1025b_roadspare.test.js` (3). Mutants `tools/mutants/fb1025b_roadspare.json` (9, all
dead). Moved: `lw7_deeds`' and PVP-BLOOD's source pins. Re-aimed by content: LW7's five road records and
AUDIT29g-spared-surfaces.

## BOUGHT-YOURS (3) - `src/systems/sigil/sigilBroker.js`

WHAT DFU DOES. Nothing to follow: the Sigil Broker, her day's stock and its one-a-day mark are the port's own
(`11-Multiplayer/Sigil-Sets.md` section 7).

WHAT THE PORT DID. The screenshot is day 20751's stock exactly (`brokerStock(20751)` named through `itemLongName`: its
six rows by name, set and tier; "New stock in 3h 31m" is 20:29 UTC). Its "8" on The Warden and the mace and its "90"
on the Gatebreaker are the window's 6s and 30, misread at phone size - the Gatebreaker's own "Need 10 more" on a purse
of 20 is 30 - 20. The Warden is a Legendary's base-record name: day 20748's (2026-10-22) slot 0 was Malacath's chest,
day 20751's slot 3 Mora's. A mark is its offer's own id, the day in it, in a record of one day, made only by
`makeBrokerSale` after the stones are out and the piece is in; so the older sale never marks today's, its dismantle
frees nothing (SS5), and "Bought" on `20751:3` is a sale of today's Warden on that character. The refusal's word,
"Bought today", named no buyer, and a player holding the older Warden read it as "you have one already".

FIXED. The refusal reads "You bought this one today. You can buy each piece once a day." - the note a press of Bought
says, and the button's title and name; the button keeps "Bought". AUDIT FB1025b A8: a dismantle names the ware's set - "Dismantle
The Warden (Mora's Mantle)?" (`sigilBroker.js` wareName, both packs), since either reading of "I did dismantle the
other chest" leaves the screenshot as it is.

NOT DONE. The Broker's words are still English literals (L10N4's count for the file unchanged).

PINS: `test/systems/item/fb1025b_brokerbought.test.js` (3); set7_broker's two pins of the old word moved, and ss1_stones'
five of the dismantle's words (A8). Mutants `tools/mutants/fb1025b_brokerbought.json` (9, all dead).

## HEART-TAKEN, HEART-KEPT and QUEST-MARK (4) - `src/systems/questlines/sheets/`, `src/systems/item/itemTransfer.js`, `src/ui/enhanced/enhancedInventory.js`

WHAT DFU DOES. Q0C4XY04's `Item _heart_ daedra_heart` is the quest's own. Each of its four kinds is given it as one is
first hurt (`injured <foe>` then `give item _heart_ to <foe>`), and every instance of a kind given it takes a CLONE onto
its body - Foe.GetClonedItemQueue's ItemCollection.CloneAll, each a UID of its own. GiveItem then takes the quest's own
record out of the pack if the player holds it (GiveItem.cs:117-121, Contains(DaggerfallUnityItem): by UID), never a
clone the player took off a body. `toting _heart_ and _questgiver_ clicked` asks the pack for the quest's item
(ItemCollection.Contains(Item): the quest's uid and the item's symbol, a clone included) and the hand-in releases every
held copy (ReleaseQuestItemForReoffer). Any other Daedra's Heart is no quest's. `clicked item _heart_` fires on any press
of the heart's row in a body's list - the remote list sends the click before the take (DaggerfallInventoryWindow.cs:2027-2037).
The classic list paints a quest item's cell green (questItemBackgroundColor).

WHAT THE PORT DID. Three faults of its own, the first the report's likely cause (AUDIT FB1025b B1). The host's
playerHasItem read a quest's item by its quest and symbol alone (`world.js`'s `_heldItemIndex`, AUDIT 24's, so a save's
two restored copies still meet), so the heart taken off the first kind's body was pulled out of the pack onto the
second kind the player hurt: the pack held no quest heart, the witches asked nothing, and the journal stayed struck -
the switch on or off. The questlines sheet struck "take its heart" on `_S.01_` and opened "Bring the heart" with it, so
a take refused (a full pack) or a menu closed unused told the player the heart was theirs while it lay on the body. And
the Enhanced pack - the default - drew the quest's heart exactly as a plain one, where a Daedra Seducer's own loot leaves
a plain heart on the same body about half the time (201 of 400 bodies through spawnEnemyLoot). The screenshots: the line
struck and one "Daedra's Heart" row ("3.00 kg", if read right, is three hearts, and a quest's item never stacks).

FIXED. HEART-KEPT (B1, a return to DFU's law): a foe's clone says it is one (`questClone`, declared in `itemFields.js`,
`foe.js:"return this.itemQueue.map((it) => (it?.questItem ? { ...it, questClone: true } : { ...it }));"`), and the read of
a quest's own record in the pack is one law beside keepsQuestItem
(`itemTransfer.js:"export function heldQuestRecordIndex(items, dfItem, { clones = false } = {}) {"`) - the record, or a
restored copy that is no clone; playerHasItem never takes a clone for it
(`world.js:"playerHasItem: (dfItem) => _heldItemIndex(dfItem, false) >= 0,"`), and Item.Dispose's sweep
(removeItemFromPlayer) still finds one, own copy first. bootWorld 6 logical lines out (36,364 -> 36,358), its ceiling
down by them. `toting` reads a clone as held (Contains(Item)) and the hand-in takes every held copy, as before. THE FOUR
HOSTS: `world.js` wires both hooks (fixed); `exterior.js` (?exterior) wires no item seam (its own FLAG); `worldModes.js`
and `dungeonContext.js` run `world.js`'s bridge. HEART-TAKEN: the sheet's first line is done, and its second opened, by
the quest's heart held now or the hand-in (`{ any: [ { item: _heart_ }, { task: _qlask_ } ] }` - a party copy's resync
carries `_qlask_`). The same lie stood in three more sheets - a line struck on a `clicked item` of an item a foe's body
holds - and each is struck now by the item held: N0B00Y06's wrappings or its `_reward_`, R0C20Y07's sapphire or its
`_pcgetsgold_` (each `toting`, reached only holding it; B5: the two next lines open on the item alone, their own done
showing them), S0000503's hoard by its `_item_` alone (B3: `_S.30_` asks on DFU's click, `when _S.05_ and not _S.16_`,
so a look and a walk out reached `_S.28_`, `take _item_ from pc`, and `_S.29_`; a party copy has the latch by the merge,
`qlState.js` mergeSharedState). A SAVE FROM BEFORE (B4): each rebound objective names its mend (`"reread":"fb1025b"`), and
a state that has not taken it forgets that objective's latch once at its first read
(`qlLaw.js:"const unmended = (st, o) => !!o?.reread && !(st?.reread ?? []).includes(o.reread);"`); a fresh state takes it
at once, and a latch this build wrote stands through a load (`06-Systems/Questlines-Arc.md` 2.2). QUEST-MARK: a quest's
item says "quest item" on its row and names its quest on its card in the Enhanced pack and a body's list
(`enhancedInventory.js:"quest: item?.questItem ? (deps.getQuest?.(item.questUID)?.displayName ?? '') : null,"`) - "Quest
item" bare where no quest of this world holds it - and on the counter's and the player trade's rows (B6), in the catalog
and the thirteen whole languages (`inventory.quest.word`, `.of`, `.item`; no key added since).

NOT DONE. Accepting any Daedra's Heart is the owner's call and is not built: the quest's own words refuse a Lord's
("Any daedra heart will do but that of a Lord") and ask one "recently plucked and by thou", and a heart carries no
record of the body it came from. A clone left on a body may still be taken while its quest stands, and the load's
orphan sweep takes it out of the pack once the quest is tombstoned (SaveLoadManager.RemoveAllOrphanedItems) - DFU's own.
A resync from a partner still on a build before this one can merge an old latch back once (mergeSharedState takes the
union; the mend is per state). An older save loaded in S0000503's "kept" window (`_S.29_` made the item permanent, the
mage not yet down) reads the hoard open until the quest ends.

PINS: `test/systems/questlines/fb1025b_daedraheart.test.js` (15; the rig reads the host's own law, B2). PIN MOVED:
`test/scenes/audit24_lifetimes.test.js` (the held read, now in itemTransfer.js), `test/systems/fb1011_tradeloc.test.js`
(the player trade's row words). Mutants `tools/mutants/fb1025b_daedraheart.json` (39, all dead); re-aimed by content:
`fb1011_tradeloc.json` TRADE-LOC-II-a, `hostsplit.json` HOST-SPLIT-a, `ql4_flow.json` AUDIT-QL-FLOW-REWARD-15 (all dead).

## NODE-CROWN (5) - `src/render/nodeGlint.js`

WHAT DFU DOES. DFU has no gathering nodes and nothing that marks them: NODE-GLINT is the port's own (Professions-Arc
47). The tree it lights is drawn as DFU draws a terrain tree a mod's model replaces: the prefab's own scale under the
terrain's 0.6-1.4 (`MeshReplacement.ImportNatureGameObject`, from memory) - Low Poly Trees draw it so (`bbVertexShader`'s
mesh mode). No departure, no Ledger row owed.

WHAT THE PORT DID. A Logging node within 120 m is its 3D tree (Low Poly Trees, on by default, draws every wild tree
within 140 m). The glint boxed its crown at the run's standing size times the tree's row scale times the prototype's
scale - and the standing size already carries that scale (`world/lowPolyTrees.js` readLowPolyTrees, `m.max[1] * sy`).
The climates stand 95 Tree records (with the woodland sets' winter archives), 93 with a prototype, 74 of those scaled
(AUDIT FB1025b C2: this said 88 of 116, the pin loop's count): the temperate and mountain woods' mostly 0.5-0.8 glinted
only to half to four fifths of their height (504_16's 16 m tree to 8 m, its upper crown never), the swamp's, the
desert's and a winter wood's 15 (1.1-4.2) over a box up to four times their height, most of their glints' tries in the
air. Not the depth: the light is drawn after the trees. And (AUDIT FB1025b C1, the report's "size aware") a big crown's
glints were a herb's - six at most at a herb's reach: the light of their cores a picture's pixel 12 times sparser than a
near herb's at 30 m, 53 times at 12 m (the audit lane's probe, the real door's tree with the player's atlases).

FIXED. The crown is as tall as the tree its run draws (`h = t.run.size[1] * row[4]`). A 3D crown's glints grow with its
size on screen (`nodeGlint.js:"export const glintCrownGrowth = (rows, crownPx) =>"`): its side against the side a herb's
glint stops growing at, to the two thirds (their light, count times reach squared, as its area), up to twice as many
reaching twice as far - twelve at 28 px at 1080 rows, the room round it its own. After: 1.4 and 7 times sparser than the
herb at 30 and 12 m, the tree's hearts a frame 2.8 to 6.1 and 2.4 to 4.7. A herb, a vein, a boulder, a school and a far
flat keep six at a picture's reach, pixel for pixel. A glint's life is one law both stages read (`glintLife`), so twelve
glints take the varyings six and their turns took.

NOT DONE. A near tall crown past the screen's top spends about a tenth of its tries off the screen (C4); a small crown's
count steps a glint at a time as the eye nears; the crown box's depth is `reach` (C5).

PINS: `test/scenes/fb1025b_nodecrown.test.js` (4: the report's 504_16 through the loader, the shader and the pass; every
climate's Tree records at a row scale of 0.8 and 1.2, their counts by value; the growth's law; 504_16 at 30 and 12 m, its
far flat, a herb and a small far crown); `tools/nodeGlintProbe.mjs` (33: a half-scale prefab's top two fifths lit; the
big crown twelve at twice the reach, its hearts more than the herb's). Mutants `tools/mutants/fb1025b_nodecrown.json`
(24, all dead). Moved: nodeglint's boxes, programs and draw pins; nodeglint.json's seed and room records re-aimed.

## CHEST-DRAFT and COPY-LIFT (6) - `src/scenes/decor/decorTool.js`, `server-account/src/ledger.js`, `server-account/src/staffRealm.js`

WHAT DFU DOES. Nothing to compare: Daggerfall has no decorator, no online home and no realm ledger.

WHAT THE PORT DID. The decorator's draft (DECOR-BATCH, #1223) kept a snapshot of every chest when it opened, and its
Discard wrote the snapshot back. A piece taken out since stood in the chest and the pack, so the ledger read one key
twice in one record and locked both copies (`twice`); a piece put in since was gone. In #1223's build the draft
outlived the room: a Discard in the ship's, caravan's, offline house's or palace's decorator ("These changes are not
kept. Leave them behind?" over changes nobody made) stood the home's chests there with a copy of every stored piece,
so every piece was locked while it sat untouched in the home - the report. #1262 closed the cross-room path; the
within-visit one stayed. And no lock could lift: a known copy is never judged again, and staff's purge destroyed both.

FIXED. The draft stages pieces and its own moves of the owner's things, never chest contents
(`decorTool.js:"for (const { id, item } of d.packIn) if (!deps.packTake?.(item)) pool.takeOwn?.(id);"`); a chest the
draft placed and Discard removes gives its goods back to the pack. COPY-LIFT: a record's own `twice` copy is lifted
only by staff's purge with `keep: true`, in the batch that destroys its extra copies - its row the record's own, held
and unclaimed and of the piece kept, no other record's copy, no copier trail check
(`ledger.js:"export async function ownCopiesLiftable(db, char, pieces) {"`). No checkpoint lifts a copy: a slice that
did was found launderable before it merged - a copy moved where the record lists nothing (a deserting revenant's take,
a counter, the ground) and brought back would have freed the other. The account service's law moved: `ACCOUNT_VERSION`
acct191.

FOR THE REPORTER. Staff run `/v1/staff/item/purge-dupes` with `keep: true` on the character (preview first); their tab
loses its seat and they rejoin with one of each, unlocked. The staff panel needs a "keep one" choice that sends it.

NOT DONE. #1223's cross-room Discard also copied the home's pieces into the other room (each refunds half its cost if
removed). `flushStagedUse` wipes a newly shared chest's local list. The shared settle's "already in this save" check
reads the pack alone. `revenantMayTake` lets a deserter keep a realm-locked piece in its take, which the ledger does not
read. A copy of any other kind stays locked for good.

PINS: `test/server/fb1025b_chestlock.test.js` (8), `test/server/staffpanel3realm.test.js` (the keep). Mutants
`tools/mutants/fb1025b_chestlock.json` (25, all dead). `test/decorFakes.mjs`'s chests are the real `createDecorRoom`
store now - the fake's no-op `setItems` was why "Discard puts the room back" passed while the bug shipped.

## (7) - pending

## AUDIT FB1025b - pending
