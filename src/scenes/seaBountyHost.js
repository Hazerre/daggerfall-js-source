// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-BOUNTY) - A FREEPORT'S BOUNTY BOARD, the page's half: the harbourmaster's tab's Wanted section
// (ui/naval/navalYardWindow.js) over the service's board (server-account/src/seaBounty.js, net/accountClient.js
// accountSeaBounty). Built by the sea's host (scenes/seaVenturesHost.js) - HOST-SPLIT: the world wires it there.
//
// THE BOARD is read when the tab is shown and again SEA_BOARD_FRESH_MS on; a POST and a COLLECT are the realm record's
// gold acts (systems/realmSaves.js realmGoldAct, as a card table's stake is): a post's gold held out of the purse while it
// is asked (the wallet's `pay`, given back on a refusal), a collect's banked in the region's account as the service banks
// it (`bank`). Each answer is said on the section's own line and the tab painted again (navalPlunderDoor.js
// repaintNavalYard). Online with a realm character alone: offline, or a character the service does not keep, no section.
//
// deps = {
//   live() -> bool          online, at a relay that raises the open sea
//   session                 the realm session (world.js realmSession - null: no realm character)
//   checkpoint()            the record checkpointed (world.js onlineCheckpoint)
//   wallet(region)          the purse and bank as the record's gold pays (world.js realmWallet: pay, bank)
//   character() -> id       the realm character
//   region() -> index       the region the player stands in (a freeport's: the sea's)
//   door?                   the service's door (accountSeaBounty) - its own, when none is given
//   wreckDoor?              SHIP-PVP: a wreck's prizes' door (accountSeaWreck) - its own, when none is given
//   now?() -> ms            the clock
// }
// ═══════════════════════════════════════════════════════════════════
import { accountSeaBounty, accountSeaWreck, accountRefusalText } from '../net/accountClient.js';
import { collectSeaPrizes, reclaimSeaPrizes } from './seaWreckHost.js';   // SHIP-PVP: a wreck's prizes, collected or back
import { appStorage } from '../systems/appStorage.js';
import { realmGoldAct } from '../systems/realmSaves.js';
import { readSeaBoard, SEA_BOUNTY_POSTS } from '../net/sea/seaBountyLaw.js';
import { repaintNavalYard } from '../ui/naval/navalPlunderDoor.js';
import { t } from '../systems/textManager.js';

/** The board is read again when it is this old and the tab is shown (ms). */
export const SEA_BOARD_FRESH_MS = 30_000;

const gold = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
/** A post's request id: one asked twice is one post. */
const ridOf = () => `sb${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;

/** @param {any} deps */
export function createSeaBounty(deps) {
  const now = () => Number(deps.now?.()) || Date.now();
  let door = deps.door ?? null, wreckDoor = deps.wreckDoor ?? null;
  const doorNow = () => (door ??= accountSeaBounty({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  const wreckDoorNow = () => (wreckDoor ??= accountSeaWreck({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  let board = null, readAt = -Infinity, reading = false, busy = false, line = null;
  const on = () => !!deps.live?.() && !!deps.session;
  const repaint = () => { try { repaintNavalYard(); } catch { /* no window: nothing to paint */ } };
  /** The board read from the service (once at a time) - painted when it comes. */
  async function read() {
    if (reading || !on()) return;
    reading = true;
    try {
      const r = await doorNow().board({ character: deps.character?.() });
      if (r?.ok) { board = readSeaBoard(r.data); readAt = now(); }
      else line = { text: accountRefusalText(r?.error), warn: true };
    } finally { reading = false; repaint(); }
  }
  /** An act of the record's gold, its answer said and the board read again. */
  async function act(o, said) {
    busy = true; repaint();
    try {
      const r = await realmGoldAct({ ...o, needsAnswer: true, session: deps.session, checkpoint: () => deps.checkpoint?.() });
      line = r?.ok ? { text: said(r.data ?? {}), warn: false } : { text: accountRefusalText(r?.error), warn: true };
    } finally { busy = false; readAt = -Infinity; await read(); }
  }
  /** GOLD ON A WANTED HEAD: `gold` off the purse onto captain `row`'s - held out while it is asked. */
  function post(row, n) {
    if (!on() || busy || !row) return;
    const region = deps.region(), rid = ridOf();
    void act({
      reserve: () => deps.wallet?.(region)?.pay(n),
      call: (/** @type {any} */ at) => doorNow().post({ character: deps.character(), realm: at, region, target: row.char, gold: n, rid }),
    }, (d) => (d.repeat ? t('sea.bounty.repeat', 'That bounty was already posted.') : t('sea.bounty.posted', 'You post {gold} gold on {name}\'s head. The bounty stands at {bounty} gold.', { gold: gold(n), name: row.name, bounty: gold(d.bounty) })));
  }
  /** THE OWED COLLECTED: into the record, banked in this region's account as the service banks it. */
  function collect() {
    if (!on() || busy) return;
    const region = deps.region();
    void act({
      apply: (/** @type {any} */ a) => { const g = a?.data?.gold; if (Number.isSafeInteger(g) && g > 0) deps.wallet?.(region)?.bank(g); },
      call: (/** @type {any} */ at) => doorNow().collect({ character: deps.character(), realm: at, region }),
    }, (d) => (d.gold > 0 ? t('sea.bounty.collected', 'You collect {gold} gold in bounties. It is in your account here.', { gold: gold(d.gold) }) : t('sea.bounty.nothing', 'Nothing is owed you.')));
  }
  /** SHIP-PVP: a wreck's prizes moved (`fn` - collectSeaPrizes or reclaimSeaPrizes), its answer said on the section's line
   *  as well, and the board read again. */
  async function prizesAct(/** @type {any} */ fn) {
    if (!on() || busy) return;
    busy = true; repaint();
    try {
      const r = await fn({ session: deps.session, checkpoint: () => deps.checkpoint?.(), character: () => deps.character(), door: wreckDoorNow(), say: (/** @type {string} */ text) => { line = { text, warn: false }; } });
      if (!r?.ok) line = { text: accountRefusalText(r?.error), warn: true };
    } finally { readAt = -Infinity; busy = false; await read(); }
  }
  /**
   * THE TAB'S WANTED SECTION (ui/naval/navalYardWindow.js wantedText): null offline or with no realm character; else the
   * board as last read - `{ asking, rows: [{ char, name, kills, bounty }], owed, mine, prizes, back, posts, busy, line,
   * post, collect, collectPrizes, reclaim }` - read again when it is SEA_BOARD_FRESH_MS old.
   */
  function office() {
    if (!on()) return null;
    if (!reading && now() - readAt >= SEA_BOARD_FRESH_MS) void read();
    return {
      asking: !board, rows: board?.wanted ?? [], owed: board?.owed ?? 0, mine: board?.mine ?? 0, prizes: board?.prizes ?? 0, back: board?.back ?? 0, posts: SEA_BOUNTY_POSTS, busy: busy || reading, line,
      post: (row, n) => post(row, n), collect: () => collect(),
      collectPrizes: () => void prizesAct(collectSeaPrizes), reclaim: () => void prizesAct(reclaimSeaPrizes),   // SHIP-PVP
    };
  }
  return { office, read };
}
