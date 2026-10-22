// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK) - THE LAUREL'S
// READS IN THE WORLD: the boards the season window shows a standing off, asked of the account service only while the
// window is open (`ask`), each at most once a minute, the last answer kept - the window ticks every second, the boards
// do not move that fast. The law is systems/seasonBook.js; the window ui/enhanced/enhancedSeason.js; this is the host's
// half, reaching the world only through `world`, so a test drives it headless.
//
// `world()` answers what the host already holds, read at each call (HOST-SPLIT: one getter, not a dep a board):
//   arena   the arena online (scenes/arena/arenaOnline.js) or null - its own board, kept and refreshed its way
//   eg      the Elite Breach's account door (net/accountClient.js accountEg) - the Spire's boards
//   iliac   Iliac Hand's (accountIliac), gambit The King's Gambit's (accountGambit) - each `board()` `call`'s `{ ok, data }`
//   ledger  the captain's ledger (systems/naval/captainLedger.js) - `season()` its season's figures
// The getter is called under a try: the pause door stands before the world host's last declarations (AUDIT TIMERS1 D6),
// and one not declared yet is none.

/** A board asked no oftener than this, ms. */
export const SEASON_BOARD_FRESH_MS = 60_000;
/** The boards the window asks of the service, by the window's row - and the `world()` door each is asked through. */
export const SEASON_BOARDS = Object.freeze({ spire: 'eg', iliac: 'iliac', gambit: 'gambit' });

/**
 * @param {() => any} world
 * @param {{ now?: () => number }} [o] `now` a monotonic clock, ms (the freshness of a board's answer)
 */
export function createSeasonBook(world, { now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  const held = () => { try { return world?.() ?? null; } catch { return null; } };
  /** @type {Record<string, { state: 'asking' | 'ok' | 'failed', data: any, at: number, out: boolean }>} */
  const reads = {};
  function askBoard(/** @type {any} */ w, /** @type {string} */ id) {
    const r = reads[id] ?? (reads[id] = { state: 'asking', data: null, at: -Infinity, out: false });
    if (r.out || now() - r.at < SEASON_BOARD_FRESH_MS) return;
    r.out = true;
    r.at = now();
    let p;
    try { p = w?.[SEASON_BOARDS[id]]?.board?.(); } catch { p = null; }
    // an answer kept until a newer one comes: a failed ask again shows the last good one, else says it failed
    Promise.resolve(p).then((a) => {
      if (a?.ok && a.data) { r.data = a.data; r.state = 'ok'; } else if (!r.data) r.state = 'failed';
    }, () => { if (!r.data) r.state = 'failed'; }).finally(() => { r.out = false; });
  }
  const read = (/** @type {string} */ id) => { const r = reads[id]; return r ? { state: r.state, data: r.data } : null; };
  return {
    /** What the window reads (seasonBookModel's `arena`, `arenaAsking`, `boards`, `sea`); `ask` - the window's own read,
     *  which asks a stale board (the pause face's test never does). */
    source({ ask = false } = {}) {
      const w = held();
      const arena = w?.arena ?? null;
      let live = false, board = null, sea = null;
      try { live = !!arena?.live?.(); if (ask && live) arena.refresh?.(); board = arena?.board?.() ?? null; } catch { live = false; }
      if (ask) for (const id of Object.keys(SEASON_BOARDS)) askBoard(w, id);
      try { sea = w?.ledger?.season?.() ?? null; } catch { sea = null; }
      return { arena: board, arenaAsking: live && !board, boards: Object.fromEntries(Object.keys(SEASON_BOARDS).map((id) => [id, read(id)])), sea };
    },
  };
}
