# SPAWN GRANTS - the relay decides which foes may exist (GRANT0, the design record)

**Status: DESIGN RECORD, PROPOSED (2026-10-17; revised 2026-10-18 for the relay's cost). The grants are not built; section 8's
reader fixes are (BUILT 2026-10-18, the owner: "Quick fixes first").** The relay
signs a grant when a foe is made and never reads the foe stream; every reader checks the grant. Section 4.11 keeps the
first draft, in which the relay read every record, as a fallback. Section 10 holds the questions that wait on the owner,
and nothing here binds a slice until the owner answers them. Section 7 orders the slices. Each one measures before it
enforces, as the Integrity arc does.

## The words

- KPbICA, on the Discord, 2026-10-17, read against FOE-FORGE (`06-Systems/Integrity-Arc.md` section 8): **"For now I'd
  suggest to just ban people for this until we find some anti-cheat solution"**. Then, having read the code: **"Looking
  into logic it looks like there is no good solution with current state of project. You can close this exact symptom by
  reducing the amount of elites and etc, but the problem is that modified client has an ability to have an impact to the
  server ... This is bad because it's electron and it's open-source"**.
- Mac handed that on. Asked to choose between a relay referee for foe frames, making strangers' foes harmless, a plan for
  spawns the server rolls, and a written reply, Mac chose **"Plan server-rolled spawns"**.
- Mac, 2026-10-18, on the first draft, whose relay read every foe record: **"So this would definitely affect
  performance..."**. Asked whether the relay should sign at spawn time only and leave the checking to each player's
  game: **"Lets do that"**.

## How to read this page

| Mark | Meaning |
|---|---|
| **FACT** | Read off the code at this record's commit. Each one cites the file and the member. |
| **PROPOSED** | This record's design. It binds nothing until the owner decides (section 10). |
| **OPEN** | A question the measure or the owner answers. |

## 1. Why FOE-FORGE is not the end (FACT)

KPbICA is right about the shape of the problem. In the open world every player's client owns the foes it spawns and
streams them to the cell (`scenes/exteriorFoes.js` foesFrame). The relay fans those records out and reads none of them
(`server/src/index.js`, the `foes` and `own` arms: "the relay reads none of it"). Each reader then decides what to
believe (applyFoes). FOE-FORGE tightened what a reader believes. It cannot make a reader know the truth, because nothing
in the system knows it: the foe exists only on the machine that made it up.

What a reader does with each field of a stranger's foe record today:

| Field | The reader | Where |
|---|---|---|
| `t` species | trusts any species with art | applyFoes: `!ENEMY_BASICS[r.t]` is the only refusal |
| `l` level | takes a class foe's level exactly, up to 100 (`FOE_LEVEL_MAX`); recomputes a monster's | makeEnemyEntity `exactLevel: !!puppet` |
| `w` weapon | trusts any template up to 1023 and any material | applyPuppetRecord, createWeapon |
| `h`, `k` health | trusts them, up to 1e5 (`FOE_HEALTH_MAX`); the reader's blows go to the owner | applyPuppetRecord |
| `z` elite (x3 blows) | believes it for at most 8 of an owner's foes (`PEER_ELITE_PUPPETS_MAX`) | FOE-FORGE |
| `cp` champion (up to x1.875) | believed it uncapped; since section 8, for at most 17 of an owner's foes (`PEER_CHAMPION_PUPPETS_MAX`) | FOE-FORGE's own open list; GRANT0 |
| `gg` Greater Giant (x4) | believes it only on a giant, one per index | FOE-FORGE |
| `nm` and the feud fields (`rb` up to x4, `p2` x1.2) | believes them for at most 9 of an owner's foes | FOE-FORGE |
| `n` fighters (up to x1.7 on me) | trusts it, 2 to 8 | partyHit |
| the wind-up's signature bit (x2) | believed it on any foe; since section 8, on a foe stood as a revenant alone | below |
| `e` heir | **takes over any foe whose record names me**, with no check that its owner is dying or leaving | applyFoes, adopt |

Found while planning, outside FOE-FORGE's record:

- **The signature bit is believed on every foe.** `applyBlowRecord` (`ai/puppetBlows.js`) gives a blow `sig.MULT` (x2)
  whenever the record's `wk` carries `WIRE_SIG` and a signature table is handed in. Both callers always hand one in
  (`exteriorFoes.js` and `dungeonContext.js`: `sig: SIG`), so the bit is never limited to revenants.
- **The dungeon's own lane trusts more than the street.** A room member's loose stands and quest foes go through
  `dungeonContext.js` applyFoeRecord. There a cast is looked up in the whole spell table
  (`spellsByIndex?.get(p.cast)`), with no check of the foe's own list, its range or a paralysis. Its `rb` and `p2` have no
  revenant cap, and each owner is allowed `LOOSE_PUPPETS_MAX` (24) loose stands (DESYNC-ZERO). Integrity-Arc section 8's
  "`dungeonContext.js` needs nothing here" misses this.

Section 8 closed both (2026-10-18).

What one modified client stands at every honest reader today: 64 foes of any species, 8 of them elites and 17
champions, and class foes at level 100 holding any weapon. Before section 8: any champion trait on every one, and blows
doubled by the signature bit. That is per session. A guest
session costs nothing (`server/src/index.js` `_named`: "A GUEST IS NOT SHUT OUT"), and nothing ever happens to the
sender.

## 2. What a spawn depends on (FACT)

Every roll that decides what a foe IS, and where each input comes from:

| Roll | Where | Inputs | From the map files? |
|---|---|---|---|
| An encounter's species | `systems/encounters.js` chooseRandomEnemy | `ENCOUNTER_TABLES` (`characters/encounterTables.js`, baked from DFU's RandomEncounters.cs); the climate index; whether the spot is inside a location's rect; day or night; the player's level | **only the climate index** (`formats/mapsFile.js` getClimateIndex, CLIMATE.PAK) **and the location rect** (MAPS) |
| A camp's or a pack's members | `systems/campEncounters.js` rollGroupComposition | a seed species from the same table, then its faction-mates; `CAMP_SIZE` 3-5, `PACK_SIZE` 2-4 | the same two |
| Elite | `systems/eliteFoes.js` rollOverworldElite | `ELITE_FOE_OVERWORLD_CHANCE` (0.05), Renown 5 online, level 3, not on a location's ground | the location rect |
| Champion | `systems/champions.js` rollStreetChampion | a hash of the feet, the species and `_streetN`, **a counter local to the client** | no |
| A class foe's level | `scenes/exteriorFoes.js` spawnFoe | `effectiveLevel(playerEntity)`, the player's level or a mentor's group level | no |
| Its weapon and health | `equipEnemy`, makeEnemyEntity | the level, the career's CFG, `Math.random` | the careers' CFG |

Everything except the climate index, the location rect and the careers' numbers is code or a fact the relay already
holds under a signature. The identity token's `cl` (the judged level) and `lv` (Renown) are signed by the account service
(`net/identityToken.js`; Integrity-Arc INT7). The world minute is a pure function of wall time that both ends share
(`net/wire.js` sharedClassicMinutes). The owner's map pixel is the relay's own reading of its pose (`net/wire.js`
mapPixelOfWire).

**A socket's id is safe inside a room.** A client names its own id in its hello (`net/online.js` peerId, one per tab).
The room keeps the id's secret from the first hello, and a later hello with the same id and another secret is refused
(`server/src/index.js`: "the id's secret (A3): the first hello mints it, a later one must match", `'id taken'`). The
relay stamps the sender's id on every frame it fans out. So within one room, no socket streams under another's id.

## 3. Precedents in this tree (FACT)

- **A relay signature carried on a foes frame and checked by strangers.** Elite Gates: the hub signs an arch's call
  (`net/eliteGates/egCallSig.js` signEgCall), the opener carries it on its foes frame (`ea`), and every stranger checks it
  on their own machine (`scenes/eliteGates/egArch.js`, verifyEgCall, with a verdict cache and a cap per cell). The public
  half comes from the account service as `rk` (`/v1/eg/keys`). A grant travels and is checked the same way.
- **A table built from the map files that the relay may hold.** RAID-ROLL: the client hands over the towns table, and the
  relay keeps it only when its SHA-256 equals the operator's pin (`RAID_TOWNS_SHA256`, `net/raid/raidLaw.js`). The relay
  never holds a map file (Port-Doctrine, Non-negotiables).
- **The same roll again after an eviction.** `net/eliteGates/egDurable.js` egReceiptSeed takes an HMAC over a secret the
  room keeps and never sends, so a mint repeated after an eviction or a retry gives the same answer.
- **Every client agreeing by construction.** A dungeon's layout foes are the same on every machine: its elites are chosen
  by `pickDungeonElites` seeded with the location id, and the host's stream may only address foes in that layout
  (`dungeonContext.js` `_layoutFoes`). Bands, sea raiders, the rite's faithful, the zone's giants and the Living World's
  stands already draw from a cell, a day or the shared clock.
- **Measure first, then enforce, with the switch on the relay.** INT14's `BOSS_BODY` line enforced nothing until staff set
  it. `net/relayCfg.js` is the developers' runtime switch (`bossBody`, `egDrain`), which needs no deploy.

## 4. The design (PROPOSED)

### 4.1 One sentence

**Online, a foe that rides to another player exists only on a grant from the relay. The relay rolls what needs no map
file, signs it when the foe is made, and never reads the foe stream. The owner's client builds the foe from the grant's
seed. Every reader checks the grant's signature, rebuilds the foe from the same seed, and refuses a record that
disagrees.** The simulation stays on the owner's machine (Multiplayer.md, decision 2). What changes is who decides that a
foe exists, and what it is.

### 4.2 A grant

The cell room holding the owner's socket mints it on the owner's ask. It is signed with the relay's receipt key
(`GATE_SIGNING_KEY`) under a prefix of its own (`spawn-grant1\n`, kept apart from receipts, calls and chat stamps). Its
fields:

| Field | What |
|---|---|
| `g` | the grant's number, the room's own counter |
| `o` | the owner's socket id, which readers match to the frame's sender (section 2: the room guards it) |
| `q` | the room it was minted for, which readers match to the frame's cell |
| `a` | the owner's account (the token's `s`). Only the relay reads it, on a carry or a handover |
| `k` | its kind (section 4.9) |
| `p` | the map pixel the relay read off the owner's pose at the mint |
| `m` | the world minute at the mint (sharedClassicMinutes): day or night is everyone's |
| `l`, `r` | the owner's signed level (`cl`) and Renown (`lv`) |
| `n` | how many foes it stands: an encounter's party, a camp's group |
| `s` | the seed, `rand32` |
| `e`, `c` | which members are elite, and each member's champion trait. The relay rolls both from `s`, with pinned copies of `ELITE_FOE_OVERWORLD_CHANCE` and the champions' rate, held equal to `systems/eliteFoes.js` and `systems/champions.js` by a test (the relay cannot import those modules: they reach the loot tables) |
| `x` | when it expires, about ten minutes on (OPEN: the measure sets it) |

### 4.3 The asks

Online only, so solo play does not change. Every ask is a small frame of its own (`{t:'grant', k: ...}`) that comes
when a foe is made, renewed, lost or handed on. None of them is on the foe stream.

| Ask | When | What the relay does |
|---|---|---|
| `mint` | the client's own clock decides a spawn is due (the encounter tick's catch-up loop, a camp's roll when a chunk loads) | spends the kind's bucket, checks the cell's ceiling, rolls and signs, answers the grant or `no` with a reason |
| `renew` | before a live grant's `x`, all of an owner's live grants in one ask | signs each again with a new `x` |
| `free` | a granted foe died or was culled | lowers the counts. Believed only downward: a lie costs only the liar |
| `carry` | the owner crosses into another cell | the new room checks each grant's signature and that `a` is this socket's account, then signs it again for itself (`q`) |
| `heir` | the owner hands a foe on (section 4.8) | checks `a` as for a carry, and signs the member again for the heir's id |

A spawn waits one round trip for its `mint`. Spawns stand out of view (`SPAWNER_ARMS` 10-20 m, past the line of sight;
camps at 100-150 m), so the wait is not seen.

### 4.4 The dice

A granted foe's identity is drawn from `eliteRng(s)` (mulberry32, already in `systems/eliteFoes.js`) in a fixed, pinned
order, for each member in turn: the species (chooseRandomEnemy at the grant's pixel, minute and level, or the kind's own
table), the level within its band, the weapon (equipEnemy), and the health dice. Elite and champion are the grant's `e`
and `c`. Movement, targets, blow timing and every other roll stay `Math.random` and stay the owner's.

### 4.5 Carrying

Each record carries `gr`: the grant's number and the member's index. The signed grant rides in the frame's list `gs`,
once on the record's first frame and again on every full frame (the cadence the look's `ls` already rides at). A grant is
about 150 bytes. A full frame of 64 foes drawn from 8 to 16 grants carries 1.2 to 2.4 KB more, against
`FOES_ROOM_BYTES_PER_S` (4 MiB a second). That figure is for the measure to confirm.

### 4.6 What the relay holds

**Nothing on the foe stream.** The relay never opens a foe frame, so its busiest path costs what it costs today. That
path is `_foesFan`, five frames a second from each socket, fanned to a crowd whose cost grows with its square (Scale-Arc
SCALE5d). Per room, the relay holds:

- each account's buckets, one per kind, spent at each mint and sized to the honest envelope the measure reads (section
  7);
- the grants not yet expired. The cell's ceiling on live granted hostile foes counts them. A foe that dies early keeps
  its grant counted until it is freed or expires, so the ceiling errs high, by at most one window.

Memory is a few numbers per live grant. Nothing goes to storage: the room secret's HMAC re-mints a grant after an
eviction.

**Why the relay does not strip records.** The first draft had the relay read every record and drop each one without a
grant. That law is stronger: a forged record never leaves the relay, and the relay's own counts are evidence. But it
reads every record of every frame in the crowded cells, where the relay is already at its limit (`_message` is past V8's
optimising ceiling, PERF-RELAY1; SCALE5d). It is kept as section 4.11, to build only if the measure shows the relay can
afford it.

### 4.7 What readers check

Every reader is the law here. It already reads every record (applyFoes, validFoeRecord), and it checks a record's grant
once per new foe:

- the grant's signature, with the key egArch already fetches (OPEN: does `/v1/eg/keys` reach a guest?);
- `o` is the frame's sender, and `q` is the frame's cell (`k`), which applyFoes already holds to the reader's cell or a
  halo's;
- the grant is not past `x`;
- the member index is under `n`, and the member stands as one live record;
- the species, the first feet within the kind's reach of `p`, and `l`, `w` and `k` all match the seed's draw. `z` and
  `cp` match `e` and `c`.

A verdict is kept per owner and grant, as egArch keeps its own. Every honest reader runs the same check on the same
bytes, so every honest reader agrees on what stands. DESYNC-ZERO refused a room-wide count because readers would
disagree; a deterministic check does not have that problem.

A reader that refuses a record counts it, by kind, reason and sender. It hands the tally to the relay every ten minutes
(`{t:'grant', k:'tally'}`), which is rare and off the foe stream. The tallies are the measure (section 7) and GRANT7's
evidence.

FOE-FORGE's caps stay underneath all of it.

### 4.8 The heir

An owner hands its foe on with its grant. In the handover it asks the relay to sign the member again for the heir's id
(`heir`), and the handover frame carries that grant. A reader takes a foe over only on a grant made out to it. A forged
takeover then costs the forger one of its own grants. Today, any record naming a player takes a foe over. A foe orphaned
by a disconnect (QUEST-PARTY's pruneOwners) is taken on a fresh grant from the taker's own bucket.

### 4.9 Each source's grant

| Source | Kind | Who mints | Species law | Count law |
|---|---|---|---|---|
| Random encounters (`systems/encounters.js`) | `enc` | the cell | chooseRandomEnemy from the seed | `ROAD_PARTY_MAX` (4) |
| Camps and packs (`systems/campEncounters.js`) | `camp` | the cell | rollGroupComposition from the seed | `CAMP_SIZE`, `PACK_SIZE`, plus the party's extra |
| Bounty packs (BOUNTY1) | `bounty` | the cell | the bounty's own beast | 4-8 |
| Roaming bands (TV7b), sea raiders (OW6) | none new | already a function of the cell and the shared clock (bandOf, raiderOf); the stand's elite, champion and level move onto that seed | the band's own | the band's own; OW6L's cell ledger already keeps them |
| Naval boardings | `muster` | the cell | `musterOf(shipClass)` from the seed | `MUSTER_MAX` |
| Raiding parties (RAID1-3) | `raid` | the cell, against the raid ledger it already keeps | chooseRaider from the seed | `MAX_RAID_ENEMIES` 25 and `MAX_RAID_DEFENDERS` 8 |
| The City Watch | `watch` | the cell | Knight_CityWatch (146) only; readers check a location's ground | `CELL_WATCH_PUPPETS_MAX` (10) |
| World of Daggerfall sites | `site` | the cell, one per marker spring | the marker's arms from the seed | the marker's own |
| The rite's faithful (WB12d) | none new | already gateHash of the day | | |
| Deep water | `deep` | the cell | `DEPTH_AQUATIC_TABLE` from the seed | the deep's own cap |
| The Living World's stands | none new | already lwSeed; their elite moves onto it | | |
| Greater Giants | `giant` | the hub, which already holds the giants that are down (ZONE-GIANTS) | a giant | one per index, zone-wide; a call of ten as one grant of `n` 10 |
| Revenants | `rev` | the cell, keyed by the revenant's id | the revenant's own record | a character's five plus six sworn (OPEN: does the account service hold them?) |
| Loose stands, Wabbajack | `loose` | the cell | the item's own (WABBAJACK_CAREER_IDS from the seed) | a small bucket |
| Quest foes (QUEST-PARTY) | `quest` | the cell | the quest's script: party members holding the same quest check it | `QUEST_PUPPETS_MAX` (24) |
| Companions, shipmates | `ally` | the cell | the owner's word: allies fight foes, never the reader | counted |

Indoors, the interior lane's sources (quest foes, loose stands, Wabbajack, companions, the watch) take the same kinds.
A dungeon's layout stream needs no grant, because it is already right by construction. Its surplus and its own lane take
grants.

### 4.10 Later, if wanted: the relay rolls the species too

The relay could also hold the climate and location-rect slice of its own cell, handed over by a client and kept under
an operator-pinned Merkle root (RAID-ROLL's law, one root over every cell's slice). It would then roll the species
itself, and readers would only confirm. The first enforce does not need this. It is worth building if two honest
readers ever disagree on a species. It costs the relay only at a mint.

### 4.11 The fallback: the relay strips records (the first draft)

The relay reads every record of every foes frame, keeps each socket's grants bound to the records standing on them, and
drops each record that has no grant, has another account's, or disagrees with its `e` or `c`, before the fan (`fanOut`
already serialises the frame again). It is built only if the measure shows the relay can afford it. That measure is the
relay's time in `_foesFan` in its fullest cells, read before and after on the same crowd. It would bring two things the
readers' law cannot: a forged record that never leaves the relay, and counts that are the relay's own rather than the
readers'.

## 5. What it does not fix (the honest limit)

- **Behaviour stays the owner's.** A granted foe's movement, its target, its blows' timing and its health going down are
  its owner's word. A modified client can still make its granted foes unkillable or move them anywhere. The next laws,
  OPEN: a puppet's speed bounded by its species; a foe whose owner ignores every blow stands down at the reader.
- **At the granted rate, a cheater stands what an honest player stands.** It can still lead those foes to someone, as an
  honest player can.
- **A modified client still sees its own forged foes.** The readers' law decides what everyone else sees, not what the
  forger's screen shows.
- **A player on an old client checks nothing**, and stands what it is sent, as today, until it updates.
- **Each account has its own budget.** The cell's ceiling bounds the total, and guests are the owner's call
  (section 10).
- **Fishing.** A client can ask for a grant, dislike the roll and never stand it. Every ask spends the budget, so its
  elites in an hour are no more than an honest player's.

## 6. What it costs (FACT, then estimates)

- **The relay's foe stream: nothing.** It is not read.
- **The relay's asks:** one Ed25519 signature (WebCrypto, which the relay already uses for receipts) at each mint, carry
  and handover, which is a few a minute for each player, and a renewal of all of a player's grants in one ask about every
  ten minutes. A tally from each reader every ten minutes. Memory: a few numbers for each live grant.
- **Each player's machine:** one signature check for each new grant, kept, as egArch keeps its verdicts. The dice are
  re-run once for each new foe, and the puppet's build already rolls the same things. Nothing runs each frame.
- **The wire:** a new frame type, `grant`. A client asks only of a relay at `GRANT_RELAY_MIN` or later, the
  relayCfgSupported pattern. The foe frames grow by the grants they carry (section 4.5).
- **Deploys:** every relay slice bumps `RELAY_VERSION`, and `relay-deploy.yml` then drops every connected player once.
  The switch from measuring to enforcing needs no deploy: relayCfg sets it, and the welcome tells each client.
- **DFU:** online, an encounter's dice come from the relay's seed instead of `Math.random`. That is a departure from
  RandomEncounters.ChooseRandomEnemy's draw, and the slice that ships it adds its bracket to Port-Ledger section A,
  row ONLINE. The tables and the law are unchanged.

## 7. The slices (PROPOSED)

| Slice | What | Ends with |
|---|---|---|
| GRANT1 | The law, pure, in a new module (`net/grantLaw.js`, proposed): the grant's shape, its signing and its check, the dice order, the buckets' gate, the pinned rates. Nothing calls it yet. | tests and mutants |
| GRANT2 | The relay takes the asks (section 4.3) and **measures**: every ask is granted, and the refusals the buckets and the ceiling would make are counted. The welcome says the law's mode, `measure`, from relayCfg. Clients ask for encounters (the largest stream). | a relay deploy |
| GRANT3 | Readers check grants and tally what they would refuse. They still stand everything FOE-FORGE allows. | |
| GRANT4 | Every other source takes its grant, one slice per family in section 4.9. | |
| GRANT5 | The measure is read (`tools/realmReview.mjs grants`) for seven days ("Measure 7 days, then enforce", Integrity-Arc section 3, call 2): the honest asks per kind set the buckets, and any honest reader's refusal is the law's mistake, fixed before enforcing. | the numbers |
| GRANT6 | **Enforce**: staff set relayCfg to `enforce`, and the welcome tells every client. The relay refuses asks past a bucket or the ceiling, readers refuse what has no grant or disagrees with one, and FOE-FORGE's caps stay. | no deploy |
| GRANT7 | Consequence: once every source is granted, an honest client sends nothing a reader refuses. When readers on several accounts tally against one sender in a window, its account is opened as a case in the moderators' queue (Chat-Safety-Arc SAFE8), with the tallies as evidence. One reader's tally alone never counts, because a tally can be forged to frame someone. It never bans by itself: SAFE5's law. | an account deploy |
| GRANT8 | Optional, section 4.10: the relay rolls the species. | |
| GRANT9 | Fallback, section 4.11: the relay strips records, only if the measure shows it can afford it. | a relay deploy |

THE FOUR HOSTS: `scenes/world.js` (the streamed exterior) asks for grants, carries them and checks them.
`scenes/worldModes.js` does the same for the interior lane. `scenes/dungeonContext.js` does the same for its own lane and
its surplus; its layout stream needs none. `scenes/exterior.js` (the fixed city) streams nothing and reads no peer, so it
needs nothing. The asks and the checks go into a module the hosts wire, never into the hosts' own functions (HOST-SPLIT).

## 8. Reader fixes that need no grants (BUILT 2026-10-18)

The owner, asked what to build first: **"Quick fixes first"**. These are section 1's finds. Each is a reader's law alone:
no relay deploy, nobody dropped, and every player has them on their next update. They ride this record's pull request.

1. **The signature is a revenant's.** An honest owner sets it only on a revenant's blow (`ai/tactics.js`,
   `ent?.revenant?.sigBlow`). Both pools now hand the signature's numbers to a puppet's blow only when the puppet stands
   as a revenant (`sig: f.entity.revenant ? SIG : null`): at the street, inside FOE-FORGE's bound on `nm`; in the
   dungeon, inside item 2's. Every revenant of rank 1 or more streams `rb` (`REVENANT_DAMAGE_PER_RANK`), and a signature
   needs rank 2 (`SIG_RANK`), so no honest revenant loses it.
2. **The dungeon's copies.** A peer's cast is taken only if its kind casts that spell at its owner's level
   (`systems/enemySpells.js` enemySpellIndices, asked at the record's `l`), and never from a paralysed copy. The level
   matters: a copy is built at its reader's level, so its own list is the wrong one to ask. Only a caster's decision
   rides the dungeon's stream (`_castN` counts nothing else), and it draws from that same list, so no honest cast is
   refused. A revenant's fields (`rb`, `p2`, its adaptations and weakness) are believed for at most
   `PEER_REVENANT_PUPPETS_MAX` of one owner's copies - the room host's layout foes, or one sender's own lane - and
   always on the reader's own revenant. **OPEN:** the street's range band (puppetCastInBand) is not added, because a
   dungeon copy keeps no distance to its reader.
3. **Champions.** `PEER_CHAMPION_PUPPETS_MAX` is 17: the elites' allowance and the revenants' bound, because a revenant
   wears its trait as a champion. Past it a record's `cp` is not believed, and its foe stands as its plain kind. A trait
   is stood inside the build, before the puppet is indexed, so the count includes the builds in flight. Both of a
   puppet's stands count: applyFoes, and a kept orphan's (standKeptOrphan).

Pins: `test/scenes/grant0_reader.test.js` (4); `tools/mutants/grant0.json` (17, all dead). Pins moved (PIN MOVED where
each stands): `tell8_online`, `feudwire`, `rvn13_wire`, `world3`, `loot7_champions`. Eight older mutant records were
re-aimed at the text they name and run again, and seven died. `AD28Q-J2-cell-orphan-unmarked` survives, and survives on
the file from before this change too: since DESYNC-ZERO an unlinked party member stands the puppet itself, so its test no
longer reaches the kept-record stand that mutant breaks. That is a finding for QUEST-PARTY's arc, not fixed here.

A forged takeover (`e`) is not on this list. A reader cannot tell it from an honest one: OW6 hands a foe over from an
owner that is still playing (world.js handOverWalkedAway), so only a grant (section 4.8) can close it.

## 9. Where this page sits

- `06-Systems/Integrity-Arc.md` section 8 lists FOE-FORGE's open items. This page is the plan that closes them at the
  root. The integrity arc's principle (section 2) holds: the world is simulated on the player's machine, and what the
  client's word can BUY is decided where the client cannot reach.
- `11-Multiplayer/Multiplayer.md` decision 2 holds. The relay rolls a foe's identity, not its life.

## 10. Questions for the owner (OPEN)

1. **Guests.** A guest's grants: the same budget, a smaller one, or no hostile kinds at all? Ban evasion is a new guest
   (Chat-Safety-Arc section 11).
2. **The consequence (GRANT7).** Open a moderators' case when readers on several accounts tally against one sender? If
   so, how many accounts, in what window? The recommendation is three accounts in ten minutes: a case, never a ban.
3. **The measure's window.** Seven days, as the integrity arc's budgets had?
4. **Section 8's reader fixes.** ANSWERED 2026-10-18: "Quick fixes first" - built, section 8.
5. **The cell's ceiling** on live granted hostile foes, all senders together: on, at the number the measure gives?
