# Staff events - monsters staged on a town or an area, a hidden kill meter and a yellow mini boss (STAFF-EVENT)

> Design page and record, written 2026-10-24 with the build. mob: "lets start making an event tool for staff to use /
> need to be scalable by amount of enemy and customizable by type of enemys / need to have a hidden meter that killing
> enemys build up into a mini boss / mini boss need to be a single enlarges version of the mob spawns / instead of the
> blue elite glow lets make the mini boss have a yellow glow / needs to be bale to select a town or area for these
> events"; then "need to be able to scal amount for the meter as well", "show the meter to staff", "should allow all of
> the monster in the game", "also let staff pick the miniboss", "needs the mini bosses health on the start panel".
>
> OFFLINE ONLY until mob tries it live. Staff work: no player patch notes describe it.

## 1. What staff set (the Staff Panel's Events page, Admins only)

| Field | Bounds | Default |
|---|---|---|
| Place | a town or any named place (picked off the game's own map, over the game), or an AREA - one map pixel. A town (city, village or hamlet) is said as a CITY (`ct` 1, the panel's pick off the game's map kind), anything else - a dungeon, a temple, a pixel - as an AREA | - |
| Monsters | any of the game's, up to 12 kinds, mixed evenly: MobileTypes 0-42 and 128-145, Enemy Expansion's 256-290 and 384-398. Horse_Invalid (39) and the City Watch (146) are barred | - |
| How many in all | 1-500 | 50 |
| Kills to fill the meter | 1 to the total | 25 |
| Mini boss | any kind | the first monster picked |
| Its size | 150-300 % of its kind | 200 % |
| Its health | 1-100 x its kind's | 10 x |
| Ends when it falls | yes / no | yes |
| Runs for | until ended, 15 min - 1 day | until ended |

Up to four events run at once (`STAFF_EVENTS_MAX`). The page lists every event with its meter (kills / kills to the
boss, kills / total), its boss's state (not yet, due, up, fallen), the players fighting, and **Spawn mini boss now** and
**End**. Players never see the meter.

## 2. One law, three readers (`src/net/staffEvent/staffEventLaw.js`)

The event's shape (`validStaffEvent`), the words each way, and the cell's ledger are one pure module the account
service, the relay and the game all import. It imports nothing (`raidLaw.js`'s rule: the worker's graph stays flat).

## 3. The path of an order

1. **The account service** (`server-account/src/staffEvents.js`, routes `/v1/staff/event` `{op: start|end|boss}` and
   `/v1/staff/events`, Admins only) mints the event's id, checks it by the law, stores the row (`staff_events`,
   migration 0166) and its audit row in one batch, then pushes a signed order of its own kind
   (`identityToken.js` `mintStaffEventOrder`, `o: 'sevent'`, `op`, `ev` or `ei`) through the relay's law door
   (`sanctions.js` `pushLaw`). The door answers with the hub's book, each event with its live meter, so every answer
   the panel reads is the hub's. A refusal's why (a full book) comes back through `pushLaw`'s `refused`. The list's read
   pushes a `look` order; a row the book no longer names is marked ended there (`ended_by` 'game'). Rows keep 30 days
   (`cron.js` `staff-events`).
2. **The hub** (`server/src/staffEvents.js`) verifies the order with its own key, keeps the book in storage
   (`sevents`), lapses an event past its end, and says the book to everyone online (`{t:'sev', k:'ev', l}`) and at each
   hello; an end as `{t:'sev', k:'end', id, why}` (`staff`, `boss`, `time`, `done`). A hand boss call (`fb` + 1) is told
   to the event's cell.
3. **The place's cell** keeps the event's **kill meter**, a raid ledger's law (RAID3): each player standing in the place
   says, every 5 s or at once when it moved, the deaths of the monsters THEY stand (`{t:'sev', k:'w'}`). The cell hears
   a word only in the cell the event's pixel stands in, never in a layer, credits it only from a socket whose pose stands
   on the pixel, the most each account said, under a cap of 10 at once and four a second after. At the meter it calls
   the boss once (`bd`); each hand call is one more. It hears the boss stand (`bu`) and fall (`bk`) from the one who
   stands it, says its ledger to the place (`k:'st'` - the game reads the count only to stop standing monsters at the
   total), and tells the hub (at once for a boss moment, else every 3 s). Done by its ledger - the boss fell with
   "ends when it falls", or every monster fell and no boss stands - the hub ends it.

## 4. The game: an event run as a raid (`src/systems/staffEvents.js`, `src/systems/raidingParties.js`)

Each event in the book is held as a raid of its own (`key` `s.<id>`, `type` 9, no clock) and RAID2's machinery runs
it: one player in the place runs it (the raid's election, by its words) and stands its monsters, every other player
there stands them as puppets. A town's event runs while the player stands outdoors in its rect (the raid's own test);
an area's while the player stands outdoors on its pixel (`townHere(true)`). Differences from a day's raid:

- its monsters are staff's kinds, one every 0.5-2 s, never more standing or killed than its total (`staffRaidRoom`);
- no town guards come out to defend it;
- the boss is stood when the cell calls it and none stands for that call (`staffBossWanted`), before any raider;
- the boss's death is its own word (`bk`), never a kill on the meter;
- its end comes from the hub; its monsters are routed out of sight and the end is said.

Lines said in the place (through `t()`, `staffEvent.*`), each naming a city or an area (mob, 2026-10-24: "make sure to
add that it is a city when we are targeting a city and make sure to say its an area if it not"): "The city of X is
under attack!" / "The area of X is under attack!", "A mighty KIND has come to the city of X!", and at the end "The KIND
has fallen. The city of X is safe." or "The attack on the city of X is over." ("the area of X" for an area). A city is
the event's `ct` or a town of the player's own map.

## 5. The mini boss (`src/systems/eliteFoes.js` `promoteStaffBoss`)

An elite (the flag, the 3x blows, the elite's drop), staff's size and health, and named "Mighty KIND"
(`systems/foeTitle.js`). Its glow rides the elite channel with an offset of 2 (`STAFF_BOSS_GLOW`: 2.55-3 living,
-2.05 to -3 as a corpse); the shader (`systems/hitFlash.js`) decodes the offset and draws `STAFF_BOSS_RIM` yellow in
place of the elite's blue. A puppet boss is promoted from the frame's `sb` side list (`[[record, size %]]`,
`world/raidShared.js` `validStaffBossTags`, one a frame); its health is its owner's.

## 6. The place picker (`src/net/staffPlaces.js`)

The places are the player's own game data (MAPS.BSA), never in the panel or this repository, so the panel over the
game asks the game through the staff hook's door: `places?` (a region's named places, towns first) and `here?` (the
staff member's region, the place on their pixel or -1, their pixel). The boot hands its maps over with
`gameMaps(new MapsFile())`. A panel in a tab of its own can stage an area alone.

## 7. Versions and what a deploy does

- Relay `world255` (`STAFF_EVENT_RELAY_MIN`): `staffEventLaw.js` and `server/src/staffEvents.js` join the bundle. An
  older relay closes a socket on a `sev` frame, so the game sends one only to world255 on. A relay deploy drops every
  player for about 40 s.
- Account service `acct181`, migration 0166: drops nobody.
- Staff Panel 0.2.7: the Events page.

## 8. Known limits

- A kill is the player's machine's word (co-op's law); a forged word can bring a boss early, never stage, move or end
  an event.
- If the runner changes while a boss is being stood, two bosses may stand for one call.
- An event past its end lapses at the hub's next touch (a hello, an order, a cell's word or tell).
- Size, health and the 10x default are first guesses, set per event on the start form.
