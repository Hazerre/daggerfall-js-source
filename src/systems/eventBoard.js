// @ts-check
// EVENTS1 (2026-10-23, the owner, over the Discord threads "Make announcements for Fallen Stars and Town Raids" and
// "Things are starting to get worse": "On the topic of event notifications. Instead of stuffing these in the chat menu,
// there must be a less obstructive and more detailed way to handle them"): THE EVENT BOARD'S LAW.
// Design: bible/10-UI/Event-Board.md.
//
// WHAT WAS WRONG. Every shared event spoke in sentences on the chat's every tab (net/chat.js pushAll), between the
// players' own lines, and said each thing once: a reader who missed the line had the Timers window under the pause
// menu and nothing else. And two of them spoke too late to act on. A fallen star's omen and its landing were said to its
// own region alone, 90 seconds before it fell, while its hold was said to everyone - so a player anywhere else heard of
// a star only once it was taken. A town raid was said to its region as it began, and stood on the map only while it
// ran: ten real minutes, against a fast travel of five.
//
// WHAT THIS IS. The same schedule the Timers window reads (systems/eventTimers.js eventTimerRows, off the host's one
// source), cut to what a player can still reach: each shared event under way, or starting within EVENT_SOON_MS, with
// where it is, how far and which way from where the player stands, and the time left. A small board on the HUD
// (ui/eventBoard.js) draws it; its NEWS - a CARD, in this module's words - opens at its head when an event first comes
// onto it and when it begins (an ANNOUNCEMENT: the board's own, never the chat's), and the events' own lines - the gate's
// omen, the star's hold, a raid's cleansing - ride that news as its notes (systems/eventNotices.js, the one door)
// instead of the chat.
//
// THE STAR'S PLACE IS SAID EARLIER. starTimerRows (systems/starfall/starfallClient.js) named the next star's town only
// from its omen; it names it from STAR_WARN_MS before its fall now, so the board can say where it will land while there
// is time to travel there (bible/11-Multiplayer/Starfall.md, EVENTS1).
//
// PURE: no globals, no clock of its own; the host hands the source (`now`, the relay's), the door hands the notes. Not a
// DFU member - DFU has no shared events. Ledger A (EVENTS1).
import { eventTimerRows } from './eventTimers.js';
import { PIXEL_M } from '../net/gate/gateLaw.js';
import { t } from './textManager.js';

/** The kinds the board carries: the world's shared events. The resets, the seat week and a company's Elite Breach stay
 *  the Timers window's alone - they are schedules, not places to go. */
export const EVENT_BOARD_KINDS = Object.freeze(['gate', 'serpent', 'super', 'star', 'raid']);
/** An event coming is on the board from this long before it starts - a fast travel's five minutes and the walk after it. */
export const EVENT_SOON_MS = 15 * 60_000;
/** The board's rows at most on a desk's screen; the rest are counted ("2 more in Timers"). A tall screen stands four
 *  (ui/eventBoard.js eventRowsFor). */
export const EVENT_BOARD_ROWS = 3;
/** The raids among them at most - the nearest. The day rolls about twenty-two across the Bay. */
export const EVENT_BOARD_RAIDS = 2;
/** A raid is announced (its card) where the player stands in its region - the mod's own rule (systems/raidingParties.js
 *  fix 8) - or this near it. The board lists the nearest raids wherever the player is. */
export const EVENT_RAID_REACH_M = 25_000;
/** A card stands this long once it is shown (its clock stops while the HUD is hidden). */
export const EVENT_TOAST_MS = 9000;
/** The cards shown at once; the rest wait their turn. */
export const EVENT_TOASTS_SHOWN = 2;
/** The cards kept waiting at most - past it the oldest waiting goes (a stale announcement is worse than none). */
export const EVENT_TOASTS_KEPT = 6;
/** A card's notes at most. */
export const EVENT_TOAST_NOTES = 3;
/** A note said again within this long is the same note (a line said on two doors). */
export const EVENT_NOTE_SAME_MS = 60_000;

/** A card's heading per kind - what the event is, before what it says. */
export const EVENT_KIND_TEXT = Object.freeze({
  gate: () => t('events.kind.gate', 'Dagon\'s Breach'),
  serpent: () => t('events.kind.serpent', 'Sea Serpent'),
  super: () => t('events.kind.super', 'Abyss Dungeon'),
  star: () => t('events.kind.star', 'Starfall'),
  raid: () => t('events.kind.raid', 'Town Raid'),
  festival: () => t('events.kind.festival', 'Witches\' Festival'),
});
/** The board's and the cards' own words. */
export const EVENT_BOARD_TEXT = Object.freeze({
  title: () => t('events.board.title', 'World Events'),
  more: (n) => t('events.board.more', '{n, plural, one {1 more in Timers} other {# more in Timers}}', { n }),
  /** A live row's clock and a coming row's. */
  left: (time) => t('events.board.left', '{time} left', { time }),
  starts: (time) => t('events.board.starts', 'in {time}', { time }),
  /** The cards' second line: an event come onto the board, and one begun. */
  soon: () => t('events.toast.soon', 'Starting soon'),
  begun: () => t('events.toast.begun', 'Under way'),
  /** Where the player stands on the event's own map pixel. */
  here: () => t('events.way.here', 'Nearby'),
  way: (km, dir) => t('events.way.km', '{km} km {dir}', { km, dir }),
  /** A raid's rows. */
  raid: (town) => t('events.raid.title', 'Raid on {town}', { town }),
  raidComing: (party) => t('events.raid.coming', '{party} gather to attack', { party }),
  raidLive: (party) => t('events.raid.live', '{party} attacking', { party }),
  raidCount: (n, of) => t('events.raid.count', '{n} of {of} raiders down', { n, of }),
});
/** The eight ways, clockwise from north. */
const DIRS = Object.freeze([
  () => t('events.dir.n', 'N'), () => t('events.dir.ne', 'NE'), () => t('events.dir.e', 'E'), () => t('events.dir.se', 'SE'),
  () => t('events.dir.s', 'S'), () => t('events.dir.sw', 'SW'), () => t('events.dir.w', 'W'), () => t('events.dir.nw', 'NW'),
]);

/** Live first, then coming; each soonest first (the Timers window's order). */
const byTime = (a, b) => (a.live === b.live ? a.at - b.at : a.live ? -1 : 1);
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isPixel = (p) => !!p && Number.isFinite(p.px) && Number.isFinite(p.py);

/**
 * THE WAY TO AN EVENT from the player's map pixel (`from`: `{ x, y }`, the travel map's - x east, y south) to the
 * event's (`to`: `{ px, py }`): `{ m, dir, text }` - the metres between the pixels' hearts (a pixel is PIXEL_M), the
 * compass word ('NE'), and the board's words ("12 km NE", "Nearby" on the same pixel). Null where either is unknown.
 * @param {{ x: number, y: number } | null | undefined} from
 * @param {{ px: number, py: number } | null | undefined} to
 */
export function eventWay(from, to) {
  if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.y) || !isPixel(to)) return null;
  const dx = (/** @type {any} */ (to).px - from.x) * PIXEL_M, dy = (/** @type {any} */ (to).py - from.y) * PIXEL_M;
  const m = Math.hypot(dx, dy);
  if (m < 1) return { m: 0, dir: '', text: EVENT_BOARD_TEXT.here() };
  const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;   // 0 north, clockwise (y runs south)
  const dir = DIRS[Math.round(deg / 45) % 8]();
  const km = m < 10_000 ? (Math.round(m / 100) / 10).toFixed(1) : String(Math.round(m / 1000));
  return { m, dir, text: EVENT_BOARD_TEXT.way(km, dir) };
}

/** A raid as the board reads one (systems/raidingParties.js raidTimerList): its row, with its way and whether it is
 *  the player's to be told of. */
function raidRow(r, now, src) {
  const way = eventWay(src?.pixel, r);
  const party = capital(String(r.type ?? '')) || null;
  const live = r.startMs <= now;
  const count = live && Number.isFinite(r.n) && Number.isFinite(r.tg) && r.tg > 0 ? EVENT_BOARD_TEXT.raidCount(Math.min(r.n, r.tg), r.tg) : null;
  return {
    id: `raid:${r.name}:${r.startMs}`, kind: 'raid', title: EVENT_BOARD_TEXT.raid(r.name), where: r.region || null, town: r.name,
    detail: count ?? (party ? (live ? EVENT_BOARD_TEXT.raidLive(party) : EVENT_BOARD_TEXT.raidComing(party)) : null),
    live, at: live ? r.endMs : r.startMs, way,
    announce: (!!src?.region && r.region === src.region) || (!!way && way.m <= EVENT_RAID_REACH_M),
  };
}

/** Where a timer row's event stands, where the source knows it and the row has said it (a row that names no place -
 *  the next gate, a star before its warning - is no place to go yet). */
function placeOf(r, src) {
  if (!r.where) return null;
  if (r.kind === 'star') return isPixel(r) ? r : null;
  if (r.kind === 'gate') return isPixel(src?.gate?.site) ? src.gate.site : null;
  if (r.kind === 'serpent') return isPixel(src?.serpent?.site) ? src.serpent.site : null;
  if (r.kind === 'super') return isPixel(src?.sd?.site) ? src.sd.site : null;
  return null;
}

/**
 * THE BOARD: what a player can still reach - each shared event under way (counting to its end) or coming within
 * `soonMs` (counting to its start) once its place is said, live first and each soonest first, the nearest `raids` of the day's raids among
 * them, cut to `max` rows (`more` how many more stand; `all` every row, uncut, for eventAnnouncements). Each row is the Timers window's (`id`, `kind`, `title`, `where`, `detail`,
 * `live`, `at`), `way` (eventWay, or null), `town` (the bare town a line names it by, where the row knows it - a raid's, a
 * star's: the news finds a line's row by it) and `announce` (whether its coming and its start get a card: every shared
 * event, and a raid only in the player's region or within EVENT_RAID_REACH_M). `src` is the Timers window's source
 * (scenes/world.js timersSource) - with the player's map pixel (`pixel`) and the gate's and the serpent's sites - or
 * null (offline: no board). Pure.
 * @param {any} src
 * @param {{ soonMs?: number, max?: number, raids?: number }} [o]
 */
export function eventBoardModel(src, { soonMs = EVENT_SOON_MS, max = EVENT_BOARD_ROWS, raids = EVENT_BOARD_RAIDS } = {}) {
  const now = Number(src?.now);
  if (!Number.isFinite(now)) return { rows: [], more: 0, all: [], now: NaN };
  // a coming event is on the board once it says where - the gate's omen, the serpent's bells, a star's warning - so the
  // card that announces it names the place (a row with none yet, the Abyss Dungeon's "not before", is no place to go)
  const near = (r) => r.live || (!!r.where && r.at - now <= soonMs);
  const rows = [];
  for (const r of eventTimerRows({ ...src, raids: null })) {
    if (r.kind === 'raid' || !EVENT_BOARD_KINDS.includes(r.kind) || !near(r)) continue;
    rows.push({ id: r.id, kind: r.kind, title: r.title, where: r.where, detail: r.detail, live: r.live, at: r.at, way: eventWay(src?.pixel, placeOf(r, src)), town: typeof /** @type {any} */ (r).town === 'string' ? /** @type {any} */ (r).town : null, announce: true });
  }
  const raidRows = (Array.isArray(src?.raids) ? src.raids : [])
    .filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && !r.done && r.endMs > now && r.startMs - now <= soonMs)
    .map((r) => raidRow(r, now, src))
    // the nearest where the player's place is known, else the soonest
    .sort((a, b) => (a.way && b.way ? a.way.m - b.way.m : a.at - b.at));
  rows.push(...raidRows.slice(0, Math.max(0, raids)));
  const all = [...rows.filter((r) => r.kind !== 'raid'), ...raidRows].sort(byTime);
  rows.sort(byTime);
  const cut = Math.max(0, max);
  return { rows: rows.slice(0, cut), more: all.length - Math.min(cut, rows.length), all, now };
}

/**
 * THE ANNOUNCEMENTS a board's change makes: each row that came onto it (`soon` - or `begun` where it came on already
 * under way) and each row that turned live (`begun`), for the rows that announce. `seen` is the caller's own map of
 * row id -> live, kept across reads; the FIRST read (`seen` empty and `seeded` false) only fills it - a page that opens
 * on a board already standing is shown the board, never a burst of cards for what began before it came.
 * Returns the cards' asks: `{ id, kind, phase: 'soon'|'begun' }`.
 * @param {ReadonlyArray<any>} rows
 * @param {Map<string, boolean>} seen
 * @param {boolean} seeded
 */
export function eventAnnouncements(rows, seen, seeded) {
  const out = [];
  const here = new Set();
  for (const r of rows ?? []) {
    here.add(r.id);
    const was = seen.get(r.id);
    seen.set(r.id, !!r.live);
    if (!seeded || !r.announce) continue;
    if (was === undefined) out.push({ id: r.id, kind: r.kind, phase: r.live ? 'begun' : 'soon' });
    else if (!was && r.live) out.push({ id: r.id, kind: r.kind, phase: 'begun' });
  }
  // a row gone is let go - so the caller hands EVERY row it read (the model's `all`): one cut by the board's `max` and
  // back on later is the same event, never news
  for (const id of [...seen.keys()]) if (!here.has(id)) seen.delete(id);
  return out;
}

/**
 * THE CARDS: the announcements and the notes, in the order they came, EVENT_TOASTS_SHOWN at a time, each for `lifeMs`
 * of shown time. A note (an event's own line) joins the card of its kind that stands or waits - so the gate's omen line
 * rides the gate's "starting soon" card, and a star's hold its card - else makes a card of its own; the same note again
 * within EVENT_NOTE_SAME_MS is dropped. An announcement joins a card of its kind that is only notes (the line came
 * first) and takes its row. `step(dtMs)` ages the cards shown (the caller stops calling it while the HUD is hidden);
 * `cards()` the shown ones, oldest first. Pure: the caller's clock (`nowMs` on each push, for the sameness) and its
 * frame (`step`).
 * @param {{ lifeMs?: number, shown?: number, kept?: number, notes?: number }} [o]
 */
export function createEventToasts({ lifeMs = EVENT_TOAST_MS, shown = EVENT_TOASTS_SHOWN, kept = EVENT_TOASTS_KEPT, notes = EVENT_TOAST_NOTES } = {}) {
  /** @type {Array<{ key: number, kind: string, id: string|null, phase: string|null, notes: string[], age: number }>} */
  let list = [];
  let nextKey = 1;
  /** note text -> when it was last taken */
  const said = new Map();
  const make = (kind, id, phase, note) => {
    const c = { key: nextKey++, kind, id, phase, notes: note ? [note] : [], age: 0 };
    list.push(c);
    // past the kept, the oldest WAITING card goes (a shown one finishes its time)
    while (list.length > Math.max(shown, kept)) list.splice(Math.min(shown, list.length - 1), 1);
    return c;
  };
  return {
    /** An announcement (`announce`) or an event's line (`note`). */
    announce({ id, kind, phase }) {
      const c = list.find((x) => x.kind === kind && (x.id === id || x.id === null));
      if (c) { c.id = id; c.phase = phase; return c; }
      return make(kind, id, phase, null);
    },
    note(kind, text, nowMs = 0) {
      const s = String(text ?? '').trim();
      if (!s) return null;
      const last = said.get(s);
      if (Number.isFinite(last) && nowMs - /** @type {number} */ (last) < EVENT_NOTE_SAME_MS) return null;
      said.set(s, nowMs);
      for (const [k, at] of said) if (nowMs - at >= EVENT_NOTE_SAME_MS) said.delete(k);
      const c = list.find((x) => x.kind === kind && x.notes.length < notes);
      if (c) { if (!c.notes.includes(s)) c.notes.push(s); return c; }
      return make(kind, null, null, s);
    },
    step(dtMs) {
      const d = Math.max(0, Number(dtMs) || 0);
      for (let i = 0; i < Math.min(shown, list.length); i++) list[i].age += d;
      list = list.filter((c) => c.age < lifeMs);
    },
    cards: () => list.slice(0, shown),
    waiting: () => Math.max(0, list.length - shown),
    clear() { list = []; said.clear(); },
  };
}
