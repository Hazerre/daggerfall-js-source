// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK) - THE SEASON'S
// LAW FOR THE PAUSE FACE'S LAUREL: what the season window shows, built from what the world host already holds. Pure: the
// clock, the seats' word and each board's last answer in, the window's sections out (ui/enhanced/enhancedSeason.js draws
// them).
//
// THREE CLOCKS, KEPT APART - each says which it is:
//   - THE REALM'S SEASON (net/arena/arenaLaw.js arenaSeasonOf - eight weeks from Monday 28 September 2026, 00:00 UTC): the
//     ranked boards that start fresh with it - the Arena, the Spire's Descent, Iliac Hand, the King's Gambit and the sea's
//     captains.
//   - THE SEATS' SEASON (net/townSeatLaw.js seasonOf - its own weeks off the service's Season 0, ending at a Sunday
//     Turning): the guilds' war for the towns, its titles, its ribbon, its reset; Season 0 its trial run, wiped at its end.
//   - THE FESTIVAL (net/festivalLaw.js FESTIVALS - the real calendar): the Witches' Festival and its Starfall.
// Words through the text core (L10N4), read when built.
import { arenaSeasonOf, arenaSeasonDay, arenaSeasonEndsS, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../net/arena/arenaLaw.js';
import { seasonOf, seatWeekOf, seatWeekStartMs, seatSeasonName } from '../net/townSeatLaw.js';
import { festivalAt, festivalNext } from '../net/festivalLaw.js';
import { t } from './textManager.js';

/** The realm's season in days (eight weeks). */
export const SEASON_BOOK_DAYS = ARENA_SEASON_S / 86_400;
/** A champion's title asks this much of the season's leader (the arena's, Iliac Hand's and the Gambit's laws alike -
 *  ARENA_CHAMPION_MIN_BOUTS, ILIAC_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_GAMES and their FOES). */
export const SEASON_TITLE_GAMES = 10;
export const SEASON_TITLE_FOES = 5;

/** THE REALM'S SEASON at `nowMs` (the relay's clock): `{ n, day, days, startMs, endMs }`. */
export function realmSeasonAt(/** @type {number} */ nowMs) {
  const s = Math.floor(nowMs / 1000), n = arenaSeasonOf(s);
  return { n, day: arenaSeasonDay(s), days: SEASON_BOOK_DAYS, startMs: (ARENA_SEASON_EPOCH_S + (n - 1) * ARENA_SEASON_S) * 1000, endMs: arenaSeasonEndsS(n) * 1000 };
}

/** THE SEATS' SEASON at `nowMs`, Season 0 at seat week `zero` (the service's - net/townSeatBook.js `zero`): `{ n, name,
 *  week, weeks, endMs, trial }` (`week` 1-based, `trial` Season 0's), or null - the seats shut to the account, or no
 *  Season counted. */
export function seatSeasonAt(/** @type {number} */ nowMs, /** @type {number|null} */ zero, open = true) {
  if (!open || zero == null) return null;
  const week = seatWeekOf(nowMs), s = seasonOf(week, zero);
  if (!s) return null;
  return { n: s.n, name: seatSeasonName(s.n) ?? '', week: week - s.start + 1, weeks: s.end - s.start, endMs: seatWeekStartMs(s.end), trial: s.n === 0 };
}

const num = (/** @type {unknown} */ v) => Number(v).toLocaleString('en-US');

/** A board's standing line: `b` its read as the window shows it (scenes/seasonBookHost.js - `{ state: 'asking' | 'ok' |
 *  'failed', data }`), `line` its own line off the answer's data. Null where there is no read (a host that hands none). */
function boardLine(/** @type {any} */ b, /** @type {(data: any) => string|null} */ line) {
  if (!b) return null;
  if (b.state === 'asking') return t('season.book.asking', 'Reading the board...');
  if (b.state !== 'ok' || !b.data) return t('season.book.unread', 'The board can\'t be read right now.');
  return line(b.data) ?? t('season.book.signin', 'Sign in to be ranked.');
}

/** THE ARENA'S LINE: the season rating and rank, and the banner's points - `board` the arena's board (arenaOnline.board). */
export function arenaStanding(/** @type {any} */ board) {
  const me = board?.me;
  if (!me) return null;
  const rating = Number(me.pvp?.rating) || 0, bouts = (Number(me.pvp?.wins) || 0) + (Number(me.pvp?.losses) || 0) + (Number(me.pvp?.draws) || 0);
  const line = !bouts ? t('season.book.arena.none', 'Rating {rating} - no ranked bouts yet', { rating: num(rating) })
    : Number.isSafeInteger(me.rank) ? t('season.book.arena.ranked', '#{rank} - rating {rating}', { rank: me.rank, rating: num(rating) })
      : t('season.book.arena.rated', 'Rating {rating}', { rating: num(rating) });
  const banner = me.banner === 'red' ? t('season.book.arena.red', 'Red Banner') : me.banner === 'blue' ? t('season.book.arena.blue', 'Blue Banner') : null;
  return banner ? t('season.book.arena.withBanner', '{line}. {banner}: {points, plural, one {# point} other {# points}}', { line, banner, points: Number(me.points) || 0 }) : line;
}
/** THE SPIRE'S LINE: the deepest hall this season (the board's `best`). */
export function spireStanding(/** @type {any} */ data) {
  const h = Number(data?.best?.h);
  return Number.isSafeInteger(h) && h > 0 ? t('season.book.spire.best', 'Deepest this season: Hall {hall}', { hall: h }) : t('season.book.spire.none', 'No Descent yet this season');
}
/** A CARD OR GAMBIT BOARD'S LINE (iliac.js iliacBoardOf, gambit.js gambitBoardOf - one shape): rank, rating, games. */
export function ladderStanding(/** @type {any} */ data) {
  const me = data?.me;
  if (!me) return null;
  const games = Number(me.games) || 0;
  if (!games) return t('season.book.ladder.none', 'No ranked games yet');
  const mine = [...(Array.isArray(data.rows) ? data.rows : []), data.pinned].find((r) => r?.you);
  const args = { rating: num(Number(me.rating) || 0), games };
  return Number.isSafeInteger(mine?.rank) ? t('season.book.ladder.ranked', '#{rank} - rating {rating} - {games, plural, one {# game} other {# games}}', { rank: mine.rank, ...args })
    : t('season.book.ladder.rated', 'Rating {rating} - {games, plural, one {# game} other {# games}}', args);
}
/** THE SEA'S LINE: the captain's ledger's season figures (captainLedger.js `season`) - this season's alone. */
export function seaStanding(/** @type {any} */ figures, /** @type {number} */ n) {
  if (!figures || figures.n !== n || (!(figures.deepest > 0) && !(figures.legends > 0))) return t('season.book.sea.none', 'No voyage counted yet this season');
  return t('season.book.sea.figures', 'Deepest: {leagues, plural, one {# league} other {# leagues}} past the Veil - {legends, plural, one {# legend} other {# legends}} ended', { leagues: Math.floor(figures.deepest) || 0, legends: Math.floor(figures.legends) || 0 });
}

/**
 * THE WINDOW'S MODEL. `src`:
 *   now        the relay's clock, ms
 *   seatsOpen  the seats open to the account; zero - Season 0's seat week (the hourglass's source carries both)
 *   arena      the arena's board, or null; arenaAsking - asked and not yet answered
 *   boards     { spire, iliac, gambit } - each `{ state, data }` or null (scenes/seasonBookHost.js)
 *   sea        the ledger's season figures, or null
 *   doors      { arena, spire } - whether each row's door stands
 * Answers `{ sections: [{ id, title, sub, at, atLabel, lead, rows: [{ id, name, about, standing, door }], foot }] }` -
 * `at` the moment its countdown counts to (ms), `door` a door's id or null.
 */
export function seasonBookModel(/** @type {any} */ src) {
  const now = Number(src?.now) || 0;
  const sections = [];
  const realm = realmSeasonAt(now);
  const b = src?.boards ?? {};
  // the arena's line off its own board (the arena online keeps it); none where the host hands no reads (`boards`)
  const arenaLine = !src?.boards ? null : src.arena ? arenaStanding(src.arena) ?? t('season.book.signin', 'Sign in to be ranked.')
    : src.arenaAsking ? t('season.book.asking', 'Reading the board...') : t('season.book.arena.unread', 'Open the Arena to read your standing.');
  sections.push({
    id: 'realm',
    title: t('season.book.realm.title', 'Ranked Season {n}', { n: realm.n }),
    sub: t('season.book.realm.sub', 'Day {day} of {days}', { day: realm.day, days: realm.days }),
    at: realm.endMs, atLabel: 'ends',
    lead: t('season.book.realm.lead', 'The ranked boards start fresh each season.'),
    rows: [
      { id: 'arena', name: t('season.book.arena.name', 'The Arena'),
        about: t('season.book.arena.about', 'Ranked bouts set your season rating. The leader wears Arena Champion, and the winning banner wears the laurel next season.'),
        standing: arenaLine,
        door: src?.doors?.arena ? 'arena' : null },
      { id: 'spire', name: t('season.book.spire.name', 'The Spire'),
        about: t('season.book.spire.about', 'The deepest Descent in each bracket. Each bracket\'s top ten companies are Spire Champions next season. A new season lets you start from half your deepest Redoubt.'),
        standing: boardLine(b.spire, spireStanding), door: src?.doors?.spire ? 'spire' : null },
      { id: 'iliac', name: t('season.book.iliac.name', 'Iliac Hand'),
        about: t('season.book.iliac.about', 'Ranked games at the card table. The leader wears Iliac Champion.'),
        standing: boardLine(b.iliac, ladderStanding), door: null },
      { id: 'gambit', name: t('season.book.gambit.name', 'The King\'s Gambit'),
        about: t('season.book.gambit.about', 'Rated games between accounts. The leader wears Grandmaster.'),
        standing: boardLine(b.gambit, ladderStanding), door: null },
      { id: 'sea', name: t('season.book.sea.name', 'The Season\'s Captains'),
        about: t('season.book.sea.about', 'The deepest voyage past the Veil and the most legends sunk or taken, at any freeport\'s harbourmaster.'),
        standing: src?.boards ? seaStanding(src.sea, realm.n) : null, door: null },
    ],
    foot: t('season.book.realm.foot', 'A champion\'s title needs {games} ranked games against {foes} different rivals, and lasts while you hold first place.', { games: SEASON_TITLE_GAMES, foes: SEASON_TITLE_FOES }),
  });
  const seat = seatSeasonAt(now, src?.zero ?? null, !!src?.seatsOpen);
  if (seat) {
    sections.push({
      id: 'seats',
      title: t('season.book.seats.title', 'The Seats: {name}', { name: seat.name.replace(/^the /, '') }),
      sub: t('season.book.seats.sub', 'Week {week} of {weeks}', { week: seat.week, weeks: seat.weeks }),
      at: seat.endMs, atLabel: 'ends',
      lead: seat.trial
        ? t('season.book.seats.trialLead', 'The trial Season. When it ends, seats, influence, fortifications, history, fealty and Pacts are wiped and no one is crowned. Marks, Stores and profession tracks stay.')
        : t('season.book.seats.lead', 'The guilds\' war for the towns. A Season ends at its last Sunday Turning.'),
      rows: [
        ...(seat.trial ? [] : [
          { id: 'crowns', name: t('season.book.crowns.name', 'Crowns and keepers'),
            about: t('season.book.crowns.about', 'Each crown\'s guildmaster earns Crowned in Season {n}. A guild that holds a seat all Season earns Keeper of its town.', { n: seat.n }) },
          { id: 'ribbon', name: t('season.book.ribbon.name', 'The banner ribbon'),
            about: t('season.book.ribbon.about', 'Members of a guild that kept a seat all Season wear its ribbon through the next.') },
          { id: 'reset', name: t('season.book.reset.name', 'The turn of the Season'),
            about: t('season.book.reset.about', 'Standing drifts halfway back to 50 and every fortification loses a tier. Charters stand.') },
        ]),
        { id: 'once', name: t('season.book.once.name', 'Once a Season'),
          about: t('season.book.once.about', 'Siege Honours between the same two guilds, a forfeit\'s Standing from the same challenger and a Fortifier\'s saved Walls each come once a Season. Pacts end with it.') },
        { id: 'tides', name: t('season.book.tides.name', 'Tides'),
          about: t('season.book.tides.about', 'A Tide a week in every kingdom, changing its trade and influence.') },
        { id: 'chapters', name: t('season.book.chapters.name', 'Guild chapters'),
          about: t('season.book.chapters.about', 'Every chapter draws an event when the Season opens. In a Schism or a Succession, members back a side.') },
      ].map((r) => ({ ...r, standing: null, door: null })),
      foot: t('season.book.seats.foot', 'The Notice Board\'s Seat tab has the week\'s standings.'),
    });
  }
  const fest = festivalNext(now), open = festivalAt(now);
  if (fest) {
    sections.push({
      id: 'festival',
      title: t('season.book.festival.title', 'The Witches\' Festival'),
      sub: open ? t('season.book.festival.open', 'On now') : t('season.book.festival.coming', 'Coming'),
      at: open ? fest.toMs : fest.fromMs, atLabel: open ? 'ends' : 'opens',
      lead: t('season.book.festival.lead', 'Runs on the real-world calendar.'),
      rows: [
        { id: 'cakes', name: t('season.book.cakes.name', 'Soul Cakes'),
          about: t('season.book.cakes.about', 'Found on the dead and the summoned and in deeds, and spent with the Wyrd Sister outside every tavern. Finds count double on 31 October and on the nights the dead walk.') },
        { id: 'starfall', name: t('season.book.starfall.name', 'The Starfall'),
          about: t('season.book.starfall.about', 'Each night one coven\'s rite pulls three stars down near its region\'s towns. Hold the crater against the waves.') },
      ].map((r) => ({ ...r, standing: null, door: null })),
      foot: null,
    });
  }
  return { sections };
}
