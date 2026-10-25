# FIELD BUGS 2026-10-25 - loot that says "a newer version of the game" when there is none

One report, handed over in a Claude Code session: "Loot will sometime be unobtainable and say theres a 'new version of
the game' when there isn't and you will have to leave and come back to the dungeon". Read on main's `ee6b01e551`. The
pin is `test/systems/partyloot.test.js` "CHAMP-BASE", the mutants `tools/mutants/fb1025_champbase.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Loot will sometime be unobtainable and say theres a 'new version of the game' when there isn't" | A dungeon body the layout marks a champion (LOOT7) had two shared bases in one room: the champion's level gate was read at each player's own level, and a class foe is built at its builder's level. A player under level 3 rolled the plain foe's base, and PARTY-LOOT read the host's word about the body as another build's | CHAMP-BASE |

## CHAMP-BASE (1) - `src/scenes/roomLootHost.js`, `src/systems/champions.js`

FOUND. The words are `LOOT_NEWER_TEXT` ("Something in here is from a newer version of the game. Reload to open it."),
which the dungeon's `takeLoot` says for a container in `_lootUnreadable`. PARTY-LOOT's `landRoomWord` puts a body there
when the base signature a word carries (`h`) differs from the one this client computes for the same terms - the law reads
that as another build (`systems/roomLoot.js`, THE TAKES). Reproduced through the two-peer harness over the real
producers before the fix: a level-30 host and a level-2 joiner in one party, six layout bodies of a class foe all marked
champions - three of the six unreadable to the joiner on `ee6b01e551` (five on `df1a2f8d8c`), and the joiner's press said
`LOOT_NEWER_TEXT`. With the joiner at level 3, or with no mark, none.

WHY. Every client marks the same records (`markDungeonChampions`, a hash of the location and the marker), but
`applyChampion` stands no champion under `CHAMPION_MIN_LEVEL` (3), and a class foe is built at its builder's level
(`dungeonContext.js` buildFoeAt: `makeEnemyEntity` at `effectiveLevel`). So the host's copy of a marked class foe was a
champion and a level-1 or level-2 joiner's was not. `roomBodyBase` moved a class foe's level to the room's for the base,
and read the champion mark the build had left. A champion skips PLAIN-LOOT's keep (`hostCombat.js` `eliteLooted`), and
the plain foe draws once a piece there, so the two clients' dice parted and every later piece differed. The mark is held
for the visit: it is cleared only by a readable word about that body, and the host says one only when a piece is taken
(a rebuild's `forgetRoomContainer` leaves `_lootUnreadable` as it was). About one layout foe in fourteen is marked
(`CHAMPION_PER_MILLE`), so a party with a character under level 3 met it on several bodies a dungeon.

Daggerfall Unity has no room and no shared base; LOOT7 and PARTY-LOOT are the port's own (Port-Ledger A: THE LOOT ARC,
and PARTY-LOOT's record in `06-Systems/Online-Arc.md`). Nothing here departs from a DFU member.

THE CALL:

- **The room's base judges the mark at the room's level.** `roomBodyBase` already stands a class foe at the party's
  level (`terms.lv`); it now asks the layout's mark (`f.src.champion`) at that level too, through `championTraitFor`
  (`champions.js`) - `applyChampion`'s gate, moved into its own export so the build and the base ask one rule. An elite
  foe is never one, as `applyEliteScaling`'s first arm stands it. Every client computes the same base again: the
  terms and the record are the room's.
- **The build is unchanged.** Each client still stands the mark at its own level, so a level-2 player's copy of a
  marked class foe is no champion in its own fight. The base hands the entity back as its builder stood it (its mark
  restored in the `finally`, as its level is).
- **The base stamps its own cap.** A plain copy's build stamps FOE-CAP's `lootCap` on the entity, and a champion's chain
  stamps none, so the base would have carried the build's cap into its record - which the player's own bonus reads
  (`rollRoomBonus`'s `lootCap`). `roomBodyBase` sets the build's cap aside for the roll and restores it after. No death
  handler caps a room body after its base: the kill's `raiseEnemyDeath` skips a room body (`if (!_roomBody)`), and an
  execution's runs before the body is born, which is when its base first rolls.

FLAGGED, not taken: the personal bonus (`roomBonusOf`) still hands `rollRoomBonus` the entity's own mark
(`f.entity.champion`), so a level-2 player's bonus over a champion's base rolls on a plain foe's corpse source. It is
the player's own layer, never said to the room, so no base splits.

NOT EXPLAINED. "You will have to leave and come back": this cause holds at one level. Re-entry clears it only if the
character has reached level 3 since, which a new character does quickly. Ruled out while looking for a cause re-entry
clears: an item shape the wire refuses (every honest producer's piece passes `validLootList`, `test/honestItems.mjs`
swept), a base draw on `Math.random` (none in 1,600 traced base rolls - plain, elite and wild), the foe and dungeon types
(all 62 foe types and all 19 dungeon types agree between a level-30 and a level-3 peer), the mods (the loot mods are the
room's whole online, `ONLINE_WHOLE_MODS`), a dive's cleared stops (`livingDeepCleared` answers none online), and the
open zone's mask (an online page wakes outside a dungeon, ONLINE-UNDERGROUND-LOAD1, so the exterior's frame sets it
before any dungeon builds).

THE FOUR HOSTS: dungeonContext.js - WIRED (the PARTY-LOOT block, `scenes/roomLootHost.js` `createRoomLoot`, which it
constructs; no line of the host moved); worldModes.js - unchanged (both dungeon hosts take dungeonContext.js's doors);
world.js - unchanged (the same); exterior.js - stands no room base (a body there is its owner's one list,
`scenes/bodyLootHost.js`, and a street champion's trait rides its owner's record, `cp`).

PINS. `partyloot.test.js` "CHAMP-BASE" (19 cases, was 18): a level-30 host and a level-2 joiner over six class-foe bodies
the real pick marks two of - one pick on both machines, the host's copies champions and the joiner's not; after the
fall, no body unreadable, every plaque the host's base, a marked body's base a champion's (no plain cap) and an unmarked
one's a plain foe's, the joiner's press on a marked body taking, and each entity handed back as its builder stood it
(mark and cap); then a party under level 3, where the mark is no champion in the base either. Red before the fix
(`FB1025-CHAMPBASE-the-builders-mark`). The harness's build follows the dungeon's own now: the layout's marks
(`markDungeonChampions` by the room's LocationId, which marks none of the six in the other cases) and `applyEliteScaling`
sliced from dungeonContext.js, before the loot. Pins moved, each marked: `test/net/partyloot_wire.test.js` and
`test/scenes/fb1018d_seatloop.test.js` hand their mount of the room block its new import (`championTraitFor`). MUTANTS: `tools/mutants/fb1025_champbase.json` (8: 7 dead, and the
elite arm `equivalent` as recorded - no layout foe the case builds is an elite, and every client reads the same
`eliteFoe`); `tools/mutants/loot7.json`'s LOOT7-stands-off, LOOT7-stands-under-level-3 and LOOT7-stands-an-ally re-aimed
at `championTraitFor` by content, and that list re-run whole (44, all dead).

NOT SEEN IN GAME. Checked through the two-peer harness over the dungeon host's real loot doors and the real producers,
not with two real players.
