// @ts-check
// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD, ON THE HUD. Design: bible/10-UI/Event-Board.md.
//
// ONE PLATE AT THE LEFT EDGE. Its rows are the shared events a player can still reach (systems/eventBoard.js
// eventBoardModel) - each one's name, its clock ("12:04 left", "in 4:30"), where it is and how far and which way from
// here; live ones first; a raid's count while it runs. Its NEWS stands at its head: an event come onto it ("Starting
// soon"), one begun ("Under way") - its name, place, way, clock and detail - and the events' own lines (systems/
// eventNotices.js, the one door) as its notes, so the gate's omen, a star's hold and a raid's cleansing are said here and
// no longer on the chat. One news at a time, EVENT_TOAST_MS of shown time each (the rest wait); its clock stops while the
// HUD is hidden, so news is never spent behind a window. Nothing takes the pointer; the news alone is spoken.
//
// WHERE IT STANDS (measured, tools/eventBoardProbe.mjs): under a full chat peek and over the quick slots' corner - the
// left edge's middle, the one stretch of the HUD's edges no other plate holds (the right's column is the quest card's,
// the star's tracker's and the party's, its middle the notices'). The status widget, which grows up that edge from the
// quick slots, stands under it as it stands under the chat (ui/enhanced/enhancedHud.js STAT_ABOVE). A short screen (a
// phone on its side, where the chat and the quick slots already meet) keeps the news alone, over the quick slots; its
// rows are the Timers window's there.
//
// DRAWN FROM ui/hud/hud.js drawHud, the one call all four hosts make, under the HUD's own hide gate - no host line
// (HOST-SPLIT). The source is the host's Timers source, seated where it is made (scenes/world.js timersSource,
// systems/eventNotices.js seatEventBoard), read at most every EVENT_READ_MS.
//
// DRESSED IN EVERY SKIN, as the star's tracker is: under Enhanced Plus the kit's panel (ui/enhanced/enhancedFrame.js
// FRAME_ROLES), on the classic skin the kit's own rules cut to it (scopeRules). A movable piece under Enhanced Plus
// (ui/hud/hudLayout.js HUD_PIECES `events`). The player's switch (systems/features.js `event-board`) takes it down and
// gives the lines back to the chat. Not a DFU member. Ledger A (EVENTS1).
import { eventBoardModel, eventAnnouncements, createEventToasts, EVENT_KIND_TEXT, EVENT_BOARD_TEXT, EVENT_BOARD_ROWS } from '../systems/eventBoard.js';
import { takeEventNotices, eventBoardSource, eventBoardOn } from '../systems/eventNotices.js';
import { timerText } from '../systems/eventTimers.js';
import { FRAME_TONES, frameCss, scopeRules } from './enhanced/enhancedFrame.js';
import { injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { STAR_VIOLET_CSS } from './starfall/starMapMark.js';
import { SERPENT_RING_MAP_CSS } from './serpentMapMark.js';
import { SD_RING_MAP_CSS } from './superDungeon/sdMapMark.js';

export const EVENT_BOARD_STYLE_ID = 'dagger-event-board-style';
export const EVENT_BOARD_KIT_ID = 'dagger-event-board-kit';
/** The source is read this often at most (the clocks are written every frame from the last read). */
export const EVENT_READ_MS = 500;
/** A tall screen's rows (EVENT_BOARD_ROWS a desk's), and a short one's - none: a phone on its side keeps the news alone. */
export const EVENT_TALL_ROWS = 4;
export const EVENT_TALL_PX = 900;
export const EVENT_SHORT_PX = 500;
/** The rows the board stands for a screen `h` px tall. */
export const eventRowsFor = (h) => (h >= EVENT_TALL_PX ? EVENT_TALL_ROWS : h > EVENT_SHORT_PX ? EVENT_BOARD_ROWS : 0);
/** A kind's mark - the Timers window's own colours (ui/enhanced/enhancedStyle.js `.px-timerswin .tm-*`), so a row reads
 *  the same in both. */
export const EVENT_KIND_CSS = Object.freeze({
  gate: '#e2554c', serpent: SERPENT_RING_MAP_CSS, super: SD_RING_MAP_CSS, star: STAR_VIOLET_CSS, raid: '#f2c46b', festival: '#9fd18b',
});

const kindRules = Object.entries(EVENT_KIND_CSS).map(([k, c]) => `.evboard .ev-${k} { --ev-kind: ${c}; }`).join('\n');
export const EVENT_BOARD_CSS = `
.evhud { position: fixed; left: calc(14px + var(--ui-pillar, 0px) + env(safe-area-inset-left, 0px)); top: clamp(244px, 40vh, 460px); z-index: 4;
  pointer-events: none; box-sizing: border-box; width: min(300px, calc((100vw - 28px) / var(--hud-scale, 1)));
  transform: scale(var(--hud-scale, 1)); transform-origin: left top; ${PIXEL_FONT_CSS} color: #e9e4d9; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.evhud.hidden { visibility: hidden; }
.evboard { box-sizing: border-box; padding: 7px 10px 8px; border-width: 2px; border-style: solid; }
.evboard.off { display: none; }
.evboard-title { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${FRAME_TONES.brassHi}; margin-bottom: 4px; }
.evrow { position: relative; padding: 4px 0 4px 12px; border-top: 1px solid rgba(163,152,128,0.22); }
.evboard-rows > .evrow:first-child { border-top: 0; }
.evrow::before { content: '\\25c6'; position: absolute; left: 0; top: 6px; font-size: 8px; color: var(--ev-kind, #9c937d); }
.evrow-top { display: flex; align-items: baseline; gap: 8px; }
.evrow-title { flex: 1 1 auto; min-width: 0; font-size: 14px; line-height: 1.25; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evrow-clock { flex: none; font-size: 13px; font-variant-numeric: tabular-nums; color: #f3cf86; }
.evrow.live .evrow-clock { color: #9fe8b4; }
.evrow-where, .evrow-detail { font-size: 12px; line-height: 1.3; color: #b7ae97; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evrow-detail { color: #9a9486; }
.evrow-where:empty, .evrow-detail:empty, .evboard-more:empty, .evboard-rows:empty { display: none; }
.evboard-more { font-size: 11px; color: #9a9486; margin-top: 3px; }
/* THE NEWS: at the head of the plate, in its kind's colour, sliding in from the edge the plate stands at */
.evnews { position: relative; margin: 2px 0 6px; padding: 6px 8px 7px 11px; background: rgba(255,255,255,0.05);
  box-shadow: inset 3px 0 0 var(--ev-kind, #c08a3e); transition: transform 240ms ease-out, opacity 240ms ease-out; }
.evnews.enter { transform: translateX(-24px); opacity: 0; }
.evnews-kind { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ev-kind, #c08a3e); }
.evnews-top { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; }
.evnews-title { flex: 1 1 auto; min-width: 0; font-size: 15px; line-height: 1.25; color: #ffffff; }
.evnews-where { font-size: 12px; line-height: 1.3; margin-top: 2px; color: #c9c0a8; }
.evnews-clock { flex: none; font-size: 13px; color: #f3cf86; font-variant-numeric: tabular-nums; }
.evnews.live .evnews-clock { color: #9fe8b4; }
.evnews-detail { font-size: 12px; line-height: 1.3; margin-top: 2px; color: #9a9486; }
.evnews-note { font-size: 13px; line-height: 1.35; margin-top: 4px; color: #e9e4d9; }
.evnews-title:empty, .evnews-where:empty, .evnews-clock:empty, .evnews-detail:empty { display: none; }
.evboard-news:empty + .evboard-rows .evrow:first-child { border-top: 0; }
@media (prefers-reduced-motion: reduce) { .evnews, .evnews.enter { transition: none; transform: none; opacity: 1; } }
@media (max-width: 640px) { .evhud { width: min(240px, calc((100vw - 28px) / var(--hud-scale, 1))); } .evrow-title { font-size: 13px; } }
/* a short screen: the news alone, over the quick slots' corner; its title and its detail go */
@media (max-height: ${EVENT_SHORT_PX}px) {
  .evhud { top: auto; bottom: calc(126px * var(--hud-scale, 1) + env(safe-area-inset-bottom, 0px)); transform-origin: left bottom; width: min(240px, 40vw); z-index: 6; }
  .evboard-title, .evboard-rows, .evboard-more, .evnews-detail { display: none; }
  .evnews { margin: 0; }
  .evnews-note ~ .evnews-note { display: none; }
}
${kindRules}
`;
/** The kit's selector of the board (its classic copy is the kit's rules cut to it). */
export const isEventBoardSelector = (/** @type {string} */ sel) => /\.evboard(?![\w-])/.test(sel);

let root = null, board = null, newsBox = null, list = null, more = null, readAt = -Infinity, rowsFor = -1;
let model = { rows: [], more: 0, all: [], now: NaN };
let seeded = false, offsetMs = 0;
const seen = new Map();
const toasts = createEventToasts({ shown: 1 });
/** news key -> its node and parts */
const newsNodes = new Map();
/** row id -> its parts, and the shape the rows were built for */
let rowNodes = new Map(), shape = null;

function ensureStyle(doc) {
  const lay = (id, text) => {
    if (doc.getElementById?.(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = text;
    (doc.head ?? doc.body)?.append(st);
  };
  lay(EVENT_BOARD_STYLE_ID, EVENT_BOARD_CSS);
  if (doc.head) injectEnhancedFonts(doc);
  if (!isEnhancedPlus()) lay(EVENT_BOARD_KIT_ID, scopeRules(frameCss(), isEventBoardSelector));
}
const part = (doc, cls, text = '') => { const n = doc.createElement('div'); n.className = cls; if (text) n.textContent = text; return n; };
const set = (n, v) => { const s = v ?? ''; if (n.textContent !== s) n.textContent = s; };

function build(doc) {
  ensureStyle(doc);
  root = part(doc, 'evhud');
  board = part(doc, 'evboard off');
  newsBox = part(doc, 'evboard-news');
  newsBox.setAttribute?.('aria-live', 'polite');   // the news is spoken; the rows' clocks never are
  list = part(doc, 'evboard-rows');
  list.setAttribute?.('aria-hidden', 'true');
  more = part(doc, 'evboard-more');
  board.append(part(doc, 'evboard-title', EVENT_BOARD_TEXT.title()), newsBox, list, more);
  root.append(board);
  (doc.body ?? doc.documentElement)?.append(root);
}

/** A row's or a news's clock: to its end while live, to its start while coming. */
const clockOf = (r, now) => (r ? (r.live ? EVENT_BOARD_TEXT.left(timerText(r.at - now)) : EVENT_BOARD_TEXT.starts(timerText(r.at - now))) : '');
/** How far and which way, then where - the way first, so a long place name cut at the plate's edge never cuts it. */
const whereOf = (r) => [r?.way?.text, r?.where].filter(Boolean).join(' · ');

/** A news's row: its own; for a line that came alone, the row of its kind whose town it names, or its kind's one row. */
export function newsRowOf(c, rows) {
  if (c.id) return rows.find((x) => x.id === c.id) ?? null;
  const ofKind = rows.filter((r) => r.kind === c.kind);
  const text = c.notes.join(' ');
  return ofKind.find((r) => r.town && text.includes(r.town)) ?? (ofKind.length === 1 ? ofKind[0] : null);
}

function drawRows(doc, now, inNews) {
  // the news's own row is the news, opened - never twice on the plate; and while news stands it takes a row's place, so
  // the plate keeps about its height (measured: a 1024 x 700 window's hotbar stands under it)
  const rows = model.rows.filter((r) => !inNews.has(r.id)).slice(0, Math.max(0, rowsFor - (newsNodes.size ? 1 : 0)));
  const next = JSON.stringify(rows.map((r) => [r.id, r.kind, r.live]));
  if (next !== shape) {
    shape = next;
    rowNodes = new Map();
    list.textContent = '';
    for (const r of rows) {
      const row = part(doc, `evrow ev-${r.kind}${r.live ? ' live' : ''}`);
      const top = part(doc, 'evrow-top');
      const p = { title: part(doc, 'evrow-title'), clock: part(doc, 'evrow-clock'), where: part(doc, 'evrow-where'), detail: part(doc, 'evrow-detail') };
      top.append(p.title, p.clock);
      row.append(top, p.where, p.detail);
      list.append(row);
      rowNodes.set(r.id, p);
    }
  }
  for (const r of rows) {
    const p = rowNodes.get(r.id);
    if (!p) continue;
    set(p.title, r.title); set(p.clock, clockOf(r, now)); set(p.where, whereOf(r));
    set(p.detail, r.kind === 'raid' && r.live ? r.detail : '');   // a raid's count; the rest on its news
  }
  const hidden = model.rows.length - inNews.size - rows.length + model.more;
  set(more, rowsFor > 0 && hidden > 0 ? EVENT_BOARD_TEXT.more(hidden) : '');
  return rows.length;
}

function drawNews(doc, now, inNews) {
  const shown = toasts.cards();
  const keep = new Set(shown.map((c) => c.key));
  for (const [key, n] of newsNodes) if (!keep.has(key)) { newsNodes.delete(key); n.root.remove?.(); }
  for (const c of shown) {
    let n = newsNodes.get(c.key);
    if (!n) {
      n = { root: part(doc, `evnews ev-${c.kind} enter`), kind: part(doc, 'evnews-kind'), title: part(doc, 'evnews-title'), where: part(doc, 'evnews-where'), clock: part(doc, 'evnews-clock'), detail: part(doc, 'evnews-detail'), notes: part(doc, 'evnews-notes'), said: '', entering: true };
      const top = part(doc, 'evnews-top');
      top.append(n.title, n.clock);
      n.root.append(n.kind, top, n.where, n.detail, n.notes);
      newsBox.append(n.root);
      newsNodes.set(c.key, n);
      void n.root.offsetWidth;   // the resting style computed first, so the slide has a "before" (ui/enhanced/enhancedNotice.js's law)
    } else n.entering = false;
    const r = newsRowOf(c, model.all);
    if (r && model.rows.some((x) => x.id === r.id)) inNews.add(r.id);
    const heading = EVENT_KIND_TEXT[c.kind]?.() ?? '';
    const phase = c.phase === 'soon' ? EVENT_BOARD_TEXT.soon() : c.phase === 'begun' ? EVENT_BOARD_TEXT.begun() : '';
    set(n.kind, phase ? `${heading} · ${phase}` : heading);
    set(n.title, r?.title ?? '');
    set(n.where, whereOf(r));
    set(n.clock, r ? clockOf(r, now) : '');
    set(n.detail, r?.detail ?? '');
    const cls = `evnews ev-${c.kind}${r?.live ? ' live' : ''}${n.entering ? ' enter' : ''}`;
    if (n.root.className !== cls) n.root.className = cls;
    const said = c.notes.join('\n');
    if (said !== n.said) {
      n.said = said;
      n.notes.textContent = '';
      for (const s of c.notes) n.notes.append(part(doc, 'evnews-note', s));
    }
  }
  return shown.length;
}

/**
 * ONE HUD FRAME OF THE BOARD. `hidden` the HUD's own hide gate (a window, the cursor, a hidden HUD): the board hides and
 * the news's clock stops; the lines still come off the door and the announcements are still made, so nothing is lost
 * behind a window. `dt` the frame's seconds; `nowMs` this machine's clock (the tests'); `height` the screen's (its rows).
 * @param {{ hidden?: boolean, dt?: number, doc?: any, nowMs?: number, height?: number }} [o]
 */
export function drawEventBoard({ hidden = false, dt = 0, doc = globalThis.document, nowMs = Date.now(), height = Number(globalThis.innerHeight) || 720 } = {}) {
  const lines = takeEventNotices();
  if (!eventBoardOn()) { if (root) destroyEventBoard(); return; }
  if (!doc?.createElement) return;
  if (nowMs - readAt >= EVENT_READ_MS) {
    const src = eventBoardSource();
    readAt = nowMs;
    model = eventBoardModel(src, { max: EVENT_TALL_ROWS });   // cut again to the screen's rows (eventRowsFor)
    offsetMs = Number.isFinite(model.now) ? model.now - nowMs : 0;
    // no source (offline, the relay's clock not yet heard, a link dropped): nothing is news and the memory stands, so
    // the read that finds the world again announces only what came on while it was away - never all that stood
    if (src) { for (const a of eventAnnouncements(model.all, seen, seeded)) toasts.announce(a); seeded = true; }
  }
  for (const l of lines) toasts.note(l.kind, l.text, l.at);
  const on = !hidden;
  if (on) toasts.step((Number(dt) || 0) * 1000);
  rowsFor = eventRowsFor(height);
  if (!root) {
    if (!(rowsFor > 0 && model.rows.length) && !toasts.cards().length) return;
    build(doc);
  }
  // hidden, the whole of it is - never torn down (news behind a window keeps its place and its time)
  const want = `evhud${on ? '' : ' hidden'}`;
  if (root.className !== want) root.className = want;
  if (!on) return;
  const now = nowMs + offsetMs;
  const inNews = new Set();
  const any = drawNews(doc, now, inNews) + drawRows(doc, now, inNews);
  const cls = any ? 'evboard' : 'evboard off';
  if (board.className !== cls) board.className = cls;
}

/** EVENTS1: the HUD editor's stand-in (ui/hud/hudLayout.js buildGhost `events`) - the board as it stands with an event
 *  on it, in its own sheet, so a player can place it before the first event comes. */
export function buildEventBoardPreview(doc) {
  ensureStyle(doc);
  const g = part(doc, 'evhud');
  const b = part(doc, 'evboard');
  b.append(part(doc, 'evboard-title', EVENT_BOARD_TEXT.title()));
  const row = part(doc, 'evrow ev-star live');
  const top = part(doc, 'evrow-top');
  top.append(part(doc, 'evrow-title', `${EVENT_KIND_TEXT.star()} (preview)`), part(doc, 'evrow-clock', EVENT_BOARD_TEXT.left('12:00')));
  row.append(top, part(doc, 'evrow-where', EVENT_BOARD_TEXT.way('4.2', 'NE')));
  const rows = part(doc, 'evboard-rows');
  rows.append(row);
  b.append(rows);
  g.append(b);
  return g;
}

/** The board taken down (the switch off, a reset): nothing waiting is kept. */
export function destroyEventBoard() {
  root?.remove?.();
  root = null; board = null; newsBox = null; list = null; more = null; readAt = -Infinity; rowsFor = -1;
  model = { rows: [], more: 0, all: [], now: NaN };
  seeded = false; offsetMs = 0; seen.clear(); toasts.clear(); newsNodes.clear(); rowNodes = new Map(); shape = null;
}
