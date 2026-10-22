# Collections - every title, aura, icon and glyph, and how each is had (COLLECTIONS-II)

> Design page and record (2026-10-22). Where the page and the code disagree, the code's own headers
> (`src/ui/collectionsPage.js`, `src/ui/collections/wardrobeCatalogue.js`, `src/ui/collections/wardrobePart.js`) and the
> pins (`test/ui/collections2.test.js`) are what runs. Not a DFU member: Daggerfall Unity has no accounts, so nothing
> here departs from it (Port-Ledger section A, COLLECTIONS-II).

## 1. What was asked

The owner, 2026-10-22:

> *"So with the introduction of a lot of titles, auras, profile icons, etc I think its time we introduce these elements
> to the collections tab, along with telling how they are found, even if they arent currently able to be obtained. This
> needs to be a proper overhaul to the collections ui"*

The Collections page (`11-Multiplayer/Tavern-Cards.md` section 26, COLLECTIONS) was the Holdings rail's last entry: a
Codex | Cards switch, shown only while Loot rarity made Legendaries or the character carried a Card Binder. The account's
titles, auras, profile icons and glyphs were seen only on the account card's Wardrobe, and only the ones held - a player
had no way to see what else exists or how it is had.

## 2. The page now

The Collections page shows for every player (`collectionsPageShown`), in six parts, a switch of tiles at the top:

| Part | What it lists | Whose |
| --- | --- | --- |
| Titles | every title of the vocabulary (`TITLES`) | the account's |
| Auras | every aura (`AURAS`) | the account's |
| Icons | every profile icon (`ICONS`) | the account's |
| Glyphs | every glyph (`GLYPHS`) | the account's |
| Codex | LOOT10's codex, as before - shown while Loot rarity is on | the character's |
| Cards | the Card Binder's collection and decks, as before - shown while a binder is carried | the character's |

Each tile is its part's name over its count (`3 / 52`) and a meter of it, so the page opens on how much of everything is
collected. A count the page cannot know - the account not read, nobody signed in - is a dash. The page opens on Titles;
a landing still names a part (`codex`, `cards`, and now `titles`, `auras`, `icons`, `glyphs`).

A wardrobe part (`drawWardrobePart`) reads, top to bottom:

- **The account's line** - "Held by your account, on every character." while the read is back; "Reading your account…"
  while it is not; "Sign in from your profile…" for nobody signed in; the flow's own refusal where the read failed; and
  the flow's last word after a Wear ("Wearing Gatebreaker.").
- **The festival's line** while the Witches' Festival is open and the kind has any of its pieces: "The Witches' Festival
  is on until 7 November: its pieces can be had now." (the date the festival's own, `net/festivalLaw.js` FESTIVALS, in
  the player's language).
- **The filters** - All, Held, Not held, Obtainable (what a player can act on now: `AVAIL_NOW`).
- **The rows, grouped by where they come from**, each group under its divider with its own count ("The Elite Breach -
  1/13"). A row is the thing's picture (an aura's ring in its colours, an icon's drawing, a glyph's mark; a title's
  picture is its word, painted as it is over a head - `ui/playerBadge.js` titlePaint, an aura's in its title's paint as
  the account card paints it), its name, whose it is where the account holds it (Worn, Held; Shown, Hidden for a
  glyph) and whether it can be had (the availability's tag). A thing not held is its row's dimmed word - a "Not held"
  chip on fifty rows was noise, seen and taken off before the strings were drafted.
- **A row opened whole** - an aura's look in a sentence, *How to get it*, *Availability* in a sentence, *Comes with*
  (each thing granted beside it, a press that opens it in its own part - Kynbane's Beaconlight, the Aegis of
  Oblivion's ward and glyph), whose it is, and - held, signed in - **Wear / Take off** (Show / Hide for a glyph).

## 3. The catalogue (`src/ui/collections/wardrobeCatalogue.js`)

Every key of the four vocabularies has one entry: its **source**, its **availability**, its words of **how**, an aura's
**look**, and what comes **with** it. A pin holds the entries to the vocabularies both ways, so a title added to
`identityToken.js` TITLES fails the suite until it says how it is had.

**Sources**, in the page's order - what play earns first, what no play can earn last: the Elite Breach, the Abyss
Dungeons, the Sea Serpent, the Sigil Broker, Questlines, the Witches' Festival, the Seats, the Guild Chapters, the Arena
and the Card Tables, Around the Bay (I Love Lamp), Your Account (Founder, the sprout), Patrons, the Game's Staff,
Bestowed by Name.

**Availabilities** - the owner's "even if they arent currently able to be obtained", said on every row:

| Availability | Tag | Who |
| --- | --- | --- |
| open | Obtainable | the Spire's honours, the seats', the Broker's, the questlines', I Love Lamp, the Grand Champion, the sprout |
| chance | Rare drop | the Brass Remnant's (one in 4, one in 8) and the Sea Serpent's (one in 20, one in 50) |
| ranked | Ranked | held while on top of a board and passed on: Arena Champion and its laurel, Iliac Champion, Grandmaster, Spire Champion |
| seasonal / offseason | Seasonal / Out of season | the Witches' Festival's: Witchwarden, Hearthkeeper, Witchfire, the four icons, and Starwarden (the Thirteenth of Frostfall runs with the Starfall) - read against the festival's dates when drawn |
| patron | Patron reward | the Patreon tiers a pledge maps (`PATREON_TIERS`): Disciple, Herald, Hierophant |
| dormant | Not yet available | given out by nothing yet: Apostle (no tier maps it - "Apostle still has no tier", Accounts-And-Cloud-Saves-Arc), the five chapter titles (the service's `CHAPTER_TITLES` is off) |
| staff | Staff only | Developer, Dungeon Master, the Seraph Wings, the developer's, moderator's and Dungeon Master's glyphs |
| bestowed | Bestowed | the titles made for one player and their auras and glyphs (Shadow Fang, Penitent, Aegis of Oblivion, Primarch, Crystal Fist, WikiMaid) |
| retired | No longer obtainable | Founder (accounts that first played before 25 September 2026), Hour's First and The First Hour, First of the Spire and Firstlight |

The words name **no player**: a title made for one person says "Made for one player and granted to them by name", never
whose - the page is read by everyone, and a handle in it would go stale the day a grant moved.

**THE SERVICE DECIDES; THE CATALOGUE SAYS IT.** What is held is `server-account/src/titles.js` (titlesHeld, aurasHeld,
iconsHeld, glyphsOf). Where a number is the client's too it is read, not copied: the Broker's prices (`insignia.js`
INSIGNIA), the Wyrd Sister's (`festivalLaw.js` FESTIVAL_WARES), the Hearth's counts (HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN),
a questline's name, giver and level (`systems/questlines/qlLines.js`). Where it is the service's alone - a roll's odds,
the Redoubt an honour asks, the Spire's champions - it is written in the catalogue and `test/ui/collections2.test.js`
holds it to the service's own table (`sds.js` SD_TITLE_CHANCE, `serpents.js` SERPENT_AURA_CHANCE, `egHonours.js`
EG_REDOUBT_HONOURS, EG_CHAMPIONS_TOP), and what comes with what to TIER_GLYPH, TIER_AURA, DEVELOPER_AURA,
HOURS_FIRST_AURA, EG_FIRST_AURA and EG_HONOUR_AURA, both ways. Two switches of the service's config are read from
`server-account/wrangler.toml` by the pin: PATREON_TIERS (a tier mapped is a pledge's, a Patreon title unmapped is
dormant) and CHAPTER_TITLES (the chapters' five dormant while it is not "on"). Turning either fails the suite until the
catalogue says what changed.

**High Master** is the one `via`: the service never holds it - it signs it in a Chapter Master's place while the chapter
stands Ascendant (`server-account/src/index.js`, the mint) - so its row follows Chapter Master's holding ("With Chapter
Master"), is never worn from here, and is not counted.

## 4. The account, read and worn

What is held is the service's word, asked once a visit: the page is handed a constructor (`kit.account`) - the same one
the account card is built by, `enhancedMenu.js` newAccountFlow (Home.md, THE ONE CONSTRUCTION SEAM) - and reads the
wardrobe of `/v1/account` through it (`ui/accountFlow.js` start). The read begins **after** the draw that asked (a
read's first word repaints, and a repaint inside a draw rebuilds the page under it), its every change repaints while it
is still the visit's, and leaving the page (`disarmCollectionsPage`) or a new visit (`resetCollectionsPage`) lets it go:
its later answers repaint nothing, and the next visit asks again.

Wear is the flow's own press - `equip`, `wearAura`, `wearIcon`, `toggleGlyph` - so the service answers, the answer
replaces the wardrobe, and the name over the head, the fire at the feet and the portrait well learn it as they do from
the card (`adoptIdentity`). The account card is unchanged. One slip fixed on the way: the flow's note after wearing a
title said the title's key ("Wearing gatebreaker.") - it says its name now, as the aura's and the icon's always did.

A host with no flow to give (a lab, a pin) lists the catalogue and holds nothing.

## 5. Dressed by the kit

Every new surface is a role of `ui/enhanced/enhancedFrame.js` FRAME_ROLES: the part tiles (as before), the filters and a
"comes with" press are tiles, a row a list line, a row opened a panel, a tag a chip, Wear the kit's button. The page's
sheet (`WARDROBE_PART_CSS`) writes geometry and the words' colours alone - a pin holds it to no ground and no edge
colour of its own, CARDS-PLUS's law for the page.

## 6. Seen

`tools/collectionsProbe.mjs` (Chromium, the dev server, the enhanced pause opened onto Collections over the front door,
`/v1/account` answered by the probe): the tiles and their counts, a row opened and its Wear, every kind's part, an aura
opened, signed in and signed out, at 1280 and on a 390 phone - nothing wider than the pane, no page error. The frames
go to a scratch directory, never the tree.

## 7. Not done

- The pictures are signs: an aura's ring is drawn in its colours, never the aura itself (`render/auraRing.js` draws that,
  in the world). A preview in the round is its own slice.
- The Codex and Cards parts are as they were; the codex's three English lines stay on the localization ratchet.
- Other things a player gathers - the Annals of 3E 398's pages, the fish caught, a horse's coats - could each be a
  part of their own; none was asked for here.
