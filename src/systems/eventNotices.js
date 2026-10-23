// @ts-check
// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE ONE DOOR AN EVENT'S LINE GOES THROUGH, AND THE SEAT OF THE BOARD'S SOURCE.
// Design: bible/10-UI/Event-Board.md.
//
// `eventNotice(kind, text)` is what the gate's omen, the sea serpent's bells, a star's region lines and its hold, the
// Abyss Dungeon's find, a town raid's attack and cleansing and the Witches' Festival's nights say now, where each had
// said its line on the chat's every tab (scenes/world.js chatNotice) - or, the raids, at the middle of the screen
// (DaggerfallUI.AddHUDText, systems/notify.js hudText, the mod's own call). The line waits here until the HUD's next
// frame takes it into the event board's news (ui/eventBoard.js drawEventBoard, from ui/hud/hud.js drawHud - the one
// call all four hosts make), so a line said from anywhere - a relay's word, a frame, a promise - is never lost and
// never drawn twice.
//
// WHERE THE BOARD IS OFF, EACH LINE GOES WHERE IT WENT BEFORE: the player's Event board switch (systems/features.js
// `event-board`, prefs `eventBoard`) off, a raid's line to the HUD's line (hudText - the mod's AddHUDText, as RAID1 said
// it) and every other to the sink the host seated beside its source (`seatEventBoard(source, chat)`) - the chat, as
// before EVENTS1 - or, where no host seated one (a bench host), to the HUD's line.
//
// THE SEAT: `seatEventBoard(source)` takes the host's Timers source (scenes/world.js timersSource - the one function
// the pause face's Timers window reads) and answers it unchanged, so the host seats it where it makes it and grows no
// line for it (HOST-SPLIT). Not a DFU member. Ledger A (EVENTS1).
import { getPref } from './uiPrefs.js';
import { hudText } from './notify.js';

/** The kinds a line may say itself under (systems/eventBoard.js EVENT_KIND_TEXT); any other is the gate's. */
export const EVENT_NOTICE_KINDS = Object.freeze(['gate', 'serpent', 'super', 'star', 'raid', 'festival']);
/** The lines kept waiting at most (a HUD that never draws - a page with no HUD - must not hold every line of a night). */
export const EVENT_NOTICES_KEPT = 32;
/** The player's switch (systems/uiPrefs.js PREF_DEFAULTS): the board and its cards, on by default. */
export const EVENT_BOARD_PREF = 'eventBoard';

/** @type {Array<{ kind: string, text: string, at: number }>} */
let _waiting = [];
/** @type {(() => any) | null} */
let _source = null;
/** @type {((text: string) => any) | null} */
let _off = null;

/** Whether the board stands - the player's switch (on unless set off). */
export const eventBoardOn = () => { try { return getPref(EVENT_BOARD_PREF) !== false; } catch { return true; } };

/**
 * AN EVENT'S LINE: kept for the board's news, or - the board switched off - said where it was said before.
 * @param {string} kind one of EVENT_NOTICE_KINDS
 * @param {string} text the line, as its event's own words say it
 */
export function eventNotice(kind, text) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s) return false;
  if (!eventBoardOn()) {
    try { if (_off && kind !== 'raid') _off(s); else hudText(s); } catch { /* a sink that throws loses one line, never the caller's frame */ }
    return true;
  }
  _waiting.push({ kind: EVENT_NOTICE_KINDS.includes(kind) ? kind : 'gate', text: s, at: Date.now() });
  if (_waiting.length > EVENT_NOTICES_KEPT) _waiting = _waiting.slice(-EVENT_NOTICES_KEPT);
  return true;
}

/** The lines waiting, oldest first, taken (the board's frame). */
export function takeEventNotices() {
  const out = _waiting;
  _waiting = [];
  return out;
}

/**
 * THE SEAT: the host's Timers source (null offline), and where a line goes with the board off (the chat). Answers the
 * source as handed, so the host wraps its own definition in it.
 * @template {(() => any) | ((o?: any) => any)} F
 * @param {F} source
 * @param {((text: string) => any) | null} [off]
 * @returns {F}
 */
export function seatEventBoard(source, off = null) {
  _source = typeof source === 'function' ? source : null;
  _off = typeof off === 'function' ? off : null;
  return source;
}

/** The source's read now - the relay's clock and what the host holds - or null (none seated, offline, or it threw). */
export function eventBoardSource() {
  try { return _source ? _source() ?? null : null; } catch { return null; }
}

/** For the tests: nothing waiting, nothing seated. */
export function _resetEventNotices() { _waiting = []; _source = null; _off = null; }
