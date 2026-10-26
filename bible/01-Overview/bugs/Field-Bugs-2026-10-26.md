# FIELD BUGS 2026-10-26 - the item maker and the Rare tier

One report from the owner, in a session, 2026-10-26, read on main's `e528ddda7`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | The owner: "You cant enchant masterwork/rare armor" | A Rare carries one of DFU's catalogue enchantments as its flavour, so DFU's refusal of an enchanted item kept every Rare - a loot door's and a Masterwork's - off the item maker's list. PROF10 J2 had opened the door for a crafted piece of jewellery alone | MAKER-RARE |

## MAKER-RARE (1) - `src/systems/enchanting.js`

WHAT DFU DOES. The item maker lists an item only if it is not enchanted: AddFilteredItem skips `item.IsEnchanted`
(DaggerfallItemMakerWindow.cs:419-422, the line the tree cites), which is `HasLegacyEnchantments ||
HasCustomEnchantments`. DFU has no tier above its magic items and artifacts, so in DFU the refusal only ever kept
MAGIC.DEF's items and the artifacts out, and an item the maker made from coming back. SetEnchantments ends with
IdentifyItem (DaggerfallUnityItem.cs:1341): whatever the maker touches comes out identified.

WHAT THE PORT DID. The Loot Rarity ladder gives every Rare one of DFU's catalogue enchantments as its flavour
(`lootRarity.js` applyRarity, RARE_FLAVOURS), and a cursed Rare its drawback beside it (cursePiece). A smith's Masterwork
rolls a Rare (`smithItems.js` mintPiece). So DFU's refusal read every Rare as a magic item: off every tab of the item
maker, on both skins. AUDIT PROF10 J2 (`06-Systems/Professions-Arc.md` 36, Mac: "Item maker can add to it") opened the
door for a crafted piece of jewellery and nothing else (`keptEnchantments`), and AETHERIC-MAKER's record
(`Field-Bugs-2026-10-03b.md`) wrote that every other enchanted item stays out "because they carry enchantments" - a
consequence of DFU's filter meeting the ladder, never decided. The report's piece, a Masterwork Daedric Cuirass,
carries Water Walking when held and 1,200 enchantment points; it was not listed.

FIXED. The item maker takes an IDENTIFIED RARE with the rows the ladder rolled on it - its flavour, a curse's drawback
- and any the maker laid since (`enchanting.js` rareKeeps, keptEnchantments; `itemMakerWindow.js` itemMakerFilter
reads it, so both skins list it). Those rows stand at the head of the two lists in the forced colour, are never taken
off, count in the ten-row guard and the picker's filters (so a curse's own setting is never offered again, and the
temple's lift after it takes the curse's row, never the maker's - `lootCurse.js` liftCurse), and stay ahead of the new
rows (applyEnchantments, J2's own path).

THE LADDER'S ROWS COST THE MAKER NOTHING. A crafted jewel's roll is drawn among the flavours its points hold (AUDIT
PROF-541 J4), so J2 costs it against them. Any other Rare's flavour is drawn whatever its points: Regens Health costs
3,000 of the maker's points, and a Steel Cuirass holds 400, a Daedric one 1,200 - counted, nearly no Rare armour could
ever take a row, and the report would stand. So a Rare's own rows are free, and a curse's drawback - a side effect,
whose negative cost buys points when a player chooses it - buys none (the temple may lift it later). The rows the maker
lays on a Rare cost as they always do, the side effects among them buying their points. A crafted jewel keeps J2's
costing. This is the item law's budget already (`itemLaw.js` makerFindings counts a crafted jewel's kept rows and no
other piece's), so the law does not move: ITEM_LAW_VERSION stays 14 and no account service is owed.

THE TWO THAT STAY OUT. An UNIDENTIFIED Rare: the maker would show its hidden rows and, through SetEnchantments'
IdentifyItem, identify it for nothing - the Mages Guild's Identify (or the spell) first, as the Reforge, the Imbue and
the temple's lift each ask ('unknown'). A Masterwork is minted identified, so it is listed at once. A LEGENDARY keeps
DFU's refusal: it is a fixed record, named and made like an artifact (`06-Systems/Loot-Rarity.md`, Names), and the
artifacts are out by DFU's own filter. DFU's MAGIC.DEF items, the artifacts and a Rare carrying a row its ladder never
rolls stay out as before; AETHERIC-MAKER's Aetheric and Gilded refusal is untouched.

Port-Ledger A: THE ITEM MAKER TAKES A RARE. `06-Systems/Professions-Arc.md` 36's J2 sentence narrowed beside it.

PINS: `test/systems/fb1026_makerrare.test.js` (3: the report's cuirass through the window - listed, its roll free,
enchanted, paid, lawful, listed again with the maker's row costed; a found Rare out unidentified and in identified, a
Rare of every group on its tab, a maker's side effect still buying its points, and the Legendary, MAGIC.DEF,
artifact and forged-row refusals; a cursed Rare's drawback free, its setting never offered again, lifted after the
maker with the maker's row kept). The honest sweep's item-maker section gains a run over every identified Rare the
sweep mints, loot and crafted (`test/honestItems.mjs`; 389 enchanted pieces at four seeds, every one lawful), so the
item law is held to every Rare the maker now makes - INT1's producer count moved to 90 (PIN MOVED). PIN MOVED in
`prof10_client.test.js`: J2's "no provenance" and "another recipe" pieces are no crafted jewels, and as identified Rares
they are taken now, their roll free. Mutants `tools/mutants/fb1026_makerrare.json` (12, all dead); prof10's
AUDIT-PROF10-J2-kept-any-enchanted re-aimed by content at the new guard (dead).
