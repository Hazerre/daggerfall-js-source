// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK).
//
// THE LAUREL. A wreath beside the envelope over the paused game (ui/enhanced/enhancedPost.js's mark, placed as it is -
// online only, as the hourglass: every clock it shows is the relay's) opens a window in the pause window's own frame: the
// season's three clocks, each its own section - the ranked season and the boards it starts fresh (the player's own
// standing on each), the seats' Season, and the festival - with what each one holds, in a line apiece, and the time
// left on each counting down. The model is systems/seasonBook.js; this file draws it and keeps it live: once a second
// the countdowns are rewritten in place, and the window is rebuilt only when a line changes (a board's answer landing).
import { seasonBookModel } from '../../systems/seasonBook.js';
import { timerText, localWhenText } from '../../systems/eventTimers.js';
import { placeBeside } from './enhancedTimers.js';
import { t } from '../../systems/textManager.js';

/** How often the open window rewrites its countdowns and looks at its source, ms. */
export const SEASON_TICK_MS = 1000;

/** A row's door (systems/seasonBook.js `door`) -> its button's words. */
const SEASON_DOOR_TEXT = Object.freeze({
  arena: () => t('season.book.door.arena', 'Arena'),
  spire: () => t('season.book.door.spire', 'Boards'),
});

/**
 * WHAT THE WINDOW READS, off the pause face's hooks: the hourglass's source (hooks.timers - the relay's clock, the seats'
 * word, the Spire's boards' door) under the laurel's own reads (hooks.season - the boards), and the Arena's door once a
 * banner is worn. Null where there is no clock: offline, or before the relay's has been heard.
 * @param {any} hooks
 */
export function seasonSource(hooks) {
  const clock = hooks?.timers?.({ ask: true }) ?? null;
  if (!clock) return null;
  const reads = hooks.season?.({ ask: true }) ?? null;
  const arena = hooks.arenaJoined?.() && typeof hooks.openArena === 'function' ? () => hooks.openArena() : null;
  return { ...reads, now: clock.now, seatsOpen: clock.seatsOpen, zero: clock.zero, doors: { arena, spire: clock.doors?.board ?? null } };
}

/**
 * The laurel, the button beside the envelope.
 * @param {Document} doc
 * @param {{ onOpen: () => void, open?: boolean }} o
 */
export function seasonMark(doc, { onOpen, open = false }) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-seasonmark';
  b.setAttribute('aria-label', t('season.book.markLabel', 'Season: the ranked boards, the seats and the festival'));
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.title = t('season.book.title', 'Season');
  const wreath = doc.createElement('span');
  wreath.className = 'px-laurel';
  wreath.setAttribute('aria-hidden', 'true');
  b.append(wreath);
  b.addEventListener('click', () => onOpen());
  return b;
}

/** Stand the laurel at the end of the row of marks: each of `chain` (the hourglass, the envelope - either may be
 *  missing) placed beside the one before it, from the profile mark, and the laurel beside the last. Placed again on
 *  every resize of any of them, as the envelope is (enhancedPost.js anchorPost); the answer is the disconnect. */
export function anchorSeason(/** @type {any} */ mark, /** @type {any[]} */ chain, /** @type {any} */ profile, /** @type {any} */ host, gap = 10) {
  const marks = [...chain.filter(Boolean), mark];
  const place = () => { let at = profile; for (const m of marks) { placeBeside(m, at, host, gap); at = m; } };
  globalThis.requestAnimationFrame?.(place);
  const RO = globalThis.ResizeObserver;
  const ro = RO ? new RO(place) : null;
  for (const n of [profile, ...marks, host]) if (n) ro?.observe?.(n);
  globalThis.addEventListener?.('resize', place);
  globalThis.document?.fonts?.ready?.then?.(place).catch?.(() => {});
  return () => { ro?.disconnect?.(); globalThis.removeEventListener?.('resize', place); };
}

/**
 * THE WINDOW. `read()` answers seasonSource's shape, or null when there is no clock. A row with a door carries its
 * button, which hands the source's own door (`doors[door]`, read at the press) to `door(fn)` - the pause face's handoff,
 * as the hourglass's rows do. Answers { root, stop, draw, close }: the caller stops the tick when the window goes.
 * @param {Document} doc
 * @param {{ read: () => any, onClose: () => void, every?: number, door?: (fn: () => any) => any }} o
 */
export function seasonWindow(doc, { read, onClose, every = SEASON_TICK_MS, door = (fn) => fn() }) {
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {string|null} */ text = null) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const win = el('div', 'px-win px-seasonwin');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'sb-title');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', 'px-gem px-corner px-' + c));
  const body = el('div', 'px-body');
  const head = el('div', 'sb-head');
  const title = el('h3', 'sb-title', t('season.book.title', 'Season'));
  title.id = 'sb-title';
  const close = el('button', 'act sb-close', t('season.book.close', 'Close'));
  /** @type {any} */ (close).type = 'button';
  close.addEventListener('click', () => onClose());
  head.append(title, close);
  const list = el('div', 'sb-list');
  body.append(head, list);
  win.append(body);

  /** @type {Array<{ at: number, atLabel: string, count: any, when: any }>} */
  let clocks = [];
  let shape = null;   // never a model's shape, so the first draw always builds
  const draw = () => {
    const src = read();
    const model = src ? seasonBookModel(src) : null;
    const now = Number(src?.now) || Date.now();
    const offset = now - Date.now();   // the relay's clock against this machine's - the local time is the machine's
    const nextShape = JSON.stringify(model?.sections ?? null);
    if (nextShape !== shape) {
      shape = nextShape;
      clocks = [];
      list.textContent = '';
      if (!model) list.append(el('p', 'sb-empty', t('season.book.noClock', 'The world\'s clock can\'t be read right now.')));
      for (const s of model?.sections ?? []) {
        const sec = el('section', 'sb-section sb-' + s.id);
        const shead = el('div', 'sb-shead');
        const stext = el('div', 'sb-stext');
        stext.append(el('h4', 'sb-stitle', s.title), el('span', 'sb-ssub', s.sub));
        const clock = el('div', 'sb-clock');
        const count = el('span', 'sb-count');
        const when = el('span', 'sb-when');
        clock.append(count, when);
        shead.append(stext, clock);
        sec.append(shead);
        if (s.lead) sec.append(el('p', 'sb-lead', s.lead));
        for (const r of s.rows) {
          const row = el('div', 'sb-row sb-' + r.id);
          const text = el('div', 'sb-text');
          const line = el('div', 'sb-line');
          line.append(el('span', 'sb-name', r.name));
          if (r.standing) line.append(el('span', 'sb-standing', r.standing));
          text.append(line, el('p', 'sb-about', r.about));
          row.append(text);
          // the row's door - a button as Close is, so a press, a tap and the pad's walk reach it alike; the source's
          // door is read at the press, never kept from the draw
          const words = r.door ? SEASON_DOOR_TEXT[r.door] : null;
          if (words) {
            const go = el('button', 'act sb-door', words());
            /** @type {any} */ (go).type = 'button';
            const which = r.door;
            go.addEventListener('click', () => { const fn = read()?.doors?.[which]; if (typeof fn === 'function') door(fn); });
            row.append(go);
          }
          sec.append(row);
        }
        if (s.foot) sec.append(el('p', 'sb-foot', s.foot));
        list.append(sec);
        clocks.push({ at: s.at, atLabel: s.atLabel, count, when });
      }
    }
    for (const c of clocks) {
      const left = timerText(c.at - now);
      if (c.count.textContent !== left) c.count.textContent = left;
      const at = localWhenText(c.at - offset);
      const when = c.atLabel === 'opens' ? t('season.book.opens', 'opens {when}', { when: at }) : t('season.book.ends', 'ends {when}', { when: at });
      if (c.when.textContent !== when) c.when.textContent = when;
    }
  };
  let tick = null;
  // a window taken out of the page without its stop stops itself on the next tick (AUDIT TIMERS1 UI-10's law)
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  draw();
  tick = setInterval(step, every);
  // the focus goes into the window (AUDIT TIMERS1 UI-5's law)
  globalThis.requestAnimationFrame?.(() => close.focus?.());
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close };
}
