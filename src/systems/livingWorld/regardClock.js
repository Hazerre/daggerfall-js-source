// @ts-check
// FIELD BUGS 2026-10-21d REGARD-OWN (lumin, the Discord's #bug-reports, "Family System appears to be broken": "I cannot
// raise the disposition of NPCs at all by talking to them. I can raise it, then after a while it resets back to
// baseline"): A REGARD IS COUNTED IN THE CHARACTER'S OWN DAYS.
//
// The regard (relations.js) eases back toward nothing by EASE_PER_DAY a day the player does not see a resident, and a
// word counts once a day - and its days were the SKY's (`Math.floor((skyMinutes() - 240) / 1440)`, the living day). Online
// the sky is a real hour a day and runs while the player is away (net/skyLaw.js), so a friendship eased twelve points a
// real day logged off, and a player who played an evening at a time came back to nought every evening: the +40 a
// courtship asks (legacy/marriage.js FRIEND_AT) was never reached. A word counted once a real hour. And the stamps were
// SAVED on the sky, which the clock law forbids (bible/06-Systems/Online-Time-Arc.md section 5: "No stamp is taken on the
// sky") - LIVED1 puts a character's standing on their own clock, and the courtship beside the regard was already there
// (legacyHost.js ownDay). Offline the sky, the world's clock and the character's are one clock: nothing changes there.
//
// The Living World's people, plans, roads and tales stay on the sky (LW0 decision 2: the world is shared); how it regards
// the character is theirs (decision 6), so its day is theirs. Every caller still hands the relations the living day it
// has (twenty-odd sites across the towns, roads, dives and caravans); this seam is the one place the relations are made
// (THE ONE CONSTRUCTION SEAM), and it counts every regard in the character's own day instead.
import { createRelations } from './relations.js';

/** A regard's day starts at 04:00, as the living day does (livingTown.js dayOf). */
export const REGARD_DAY_START_MIN = 240;
/** The day a regard is counted in, of the character's own minutes. @param {number} ownMinutes */
export const regardDayOf = (ownMinutes) => Math.floor((ownMinutes - REGARD_DAY_START_MIN) / 1440);
/** The record's mark: its stamps are the character's own days. A record without it was stamped on the sky. */
export const REGARD_CLOCK = 'own';

/** A sky-stamped record's people, met and seen today: the regard each holds stands as it was last written (what the sky
 *  eased since, unwritten, comes back), and its once-a-day marks - a sky day's number, meaningless on the own clock -
 *  are let go. @param {Record<string, any>} people @param {number} day */
const rebased = (people, day) => Object.fromEntries(Object.entries(people).map(([id, e]) => [id, e && typeof e === 'object' ? { r: e.r, met: day, seen: day, talked: -1 } : e]));

/**
 * One character's regards (relations.js createRelations), counted in their own days. Online, a record from before
 * REGARD-OWN (no `clock`) is rebased once to today; offline its days were already the one clock's.
 * @param {any} record - a save's (`snapshot()`), or none
 * @param {() => number} own - the character's own minutes (worldTick.js ownMinutes)
 * @param {boolean} [online] - the lane
 */
export function characterRelations(record, own, online = false) {
  const today = () => regardDayOf(own());
  const skyStamped = online && record && typeof record === 'object' && record.v === 1 && record.clock !== REGARD_CLOCK
    && record.people && typeof record.people === 'object';
  const rel = createRelations(skyStamped ? { ...record, people: rebased(record.people, today()) } : record);
  // the day a caller hands in is the living day it has; the regard's is the character's own
  return {
    ...rel,
    /** @param {string} id @param {number} [_day] */
    regard: (id, _day) => rel.regard(id, today()),
    /** @param {string} id @param {number} [_day] */
    standing: (id, _day) => rel.standing(id, today()),
    /** @param {string} id @param {any} kind @param {number} [_day] @param {number} [amount] */
    note: (id, kind, _day, amount) => rel.note(id, kind, today(), amount),
    /** @param {string} id @param {number} amount @param {number} [_day] */
    inherit: (id, amount, _day) => rel.inherit(id, amount, today()),
    /** @param {string} id @param {number} [_day] */
    seen: (id, _day) => rel.seen(id, today()),
    snapshot: () => ({ ...rel.snapshot(), clock: REGARD_CLOCK }),
    /** The regard's day now - the People page's "seen N days ago" reads it. */
    today,
  };
}
