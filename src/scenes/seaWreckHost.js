// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a ship wrecked
// and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP) - A WRECK'S SERVICE HALF on the page: the
// receipt the relay signed (net/wild/wildReceipt.js `n1`, handed here by scenes/naval/seaBroadsides.js) carried to the
// account service (server-account/src/seaWreck.js, net/accountClient.js accountSeaWreck). Built by the sea's host
// (scenes/seaVenturesHost.js).
//
//   HER CAPTAIN'S (the receipt's `f` mine): carried at once, a record act (systems/realmSaves.js realmGoldAct - where my
//     record stands, checkpointed first); boarded, the pieces the prize took come back, by their marks, and her game takes
//     the same out of her hold (navalHost.js pvp.takeHold) - said (a tab that joined her record since is told none: it
//     holds none of them).
//   HER KILLER'S (`k` mine): carried once her captain's grace has passed (SEA_WRECK_GRACE_S and SEA_WRECK_SLACK_S) -
//     the service answers the first asking's answer, or takes the prize itself; then, boarded, the prizes held for my
//     character collected into my record and my pack, said. A prize left uncollected here stands on a freeport's board
//     (seaBountyHost.js), its press the same collect.
//
// deps = {
//   session                 the realm session (world.js realmSession)
//   checkpoint()            the record checkpointed (world.js onlineCheckpoint)
//   character() -> id       my realm character
//   me() -> account | null  my account (online.js `acct`)
//   naval() -> host | null  the naval host (pvp.takeHold)
//   door?                   the service's door (accountSeaWreck) - its own, when none is given
//   say(text, s)
//   now?() -> ms            this machine's clock
// }
// ═══════════════════════════════════════════════════════════════════
import { accountSeaWreck } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { realmGoldAct } from '../systems/realmSaves.js';
import { readSeaWreck, SEA_WRECK_GRACE_S } from '../net/wild/wildReceipt.js';
import { addItem } from '../systems/inventory.js';
import { playerEntity } from '../characters/playerEntity.js';
import { t } from '../systems/textManager.js';

/** A killer's tab waits this long past her captain's grace before carrying the wreck itself, s. */
export const SEA_WRECK_SLACK_S = 5;
/** A killer's carry asked again this often, this many times, while the service cannot answer it (ms). */
export const SEA_WRECK_RETRY_MS = 15_000;
export const SEA_WRECK_TRIES = 4;

/**
 * MY PRIZES COLLECTED: every piece the service holds for my character from wrecks I boarded, into my record (a record
 * act) and my pack, said - the board's press and the killer's own carry. Answers the act's outcome.
 * @param {{ session: any, checkpoint: () => void, character: () => string, door: any, say?: (text: string, s?: number) => void }} o
 */
export function collectSeaPrizes({ session, checkpoint, character, door, say }) {
  return realmGoldAct({
    session, checkpoint: () => checkpoint(), needsAnswer: true,
    call: (/** @type {any} */ at) => door.collect({ character: character(), realm: at }),
    apply: (/** @type {any} */ a) => {
      const items = Array.isArray(a?.data?.items) ? a.data.items : [];
      for (const it of items) addItem((playerEntity.items ??= []), it);
      if (items.length) say?.(t('sea.pvp.prizeTaken', 'Plunder from a wreck\'s hold is in your pack: {n, plural, one {# piece} other {# pieces}}.', { n: items.length }), 5);
    },
  });
}

/**
 * MY HOLD'S GOODS BACK: every piece of my hold a killer of mine left the service holding past SEA_PRIZE_HOLD_S, into my
 * record (a record act) and my pack, said - the board's press.
 * @param {{ session: any, checkpoint: () => void, character: () => string, door: any, say?: (text: string, s?: number) => void }} o
 */
export function reclaimSeaPrizes({ session, checkpoint, character, door, say }) {
  return realmGoldAct({
    session, checkpoint: () => checkpoint(), needsAnswer: true,
    call: (/** @type {any} */ at) => door.reclaim({ character: character(), realm: at }),
    apply: (/** @type {any} */ a) => {
      const items = Array.isArray(a?.data?.items) ? a.data.items : [];
      for (const it of items) addItem((playerEntity.items ??= []), it);
      if (items.length) say?.(t('sea.pvp.holdBack', 'Goods your killer never collected are back in your pack: {n, plural, one {# piece} other {# pieces}}.', { n: items.length }), 5);
    },
  });
}

/** @param {any} deps */
export function createSeaWreckHost(deps) {
  const now = () => Number(deps.now?.()) || Date.now();
  let door = deps.door ?? null;
  const doorNow = () => (door ??= accountSeaWreck({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  const seen = new Set();      // wrecks carried, or waiting to be
  const due = new Map();       // r -> { rc, c, at, tries, busy } - my wrecks to carry as their killer
  const say = (/** @type {string} */ text, s = 5) => deps.say?.(text, s);

  /** HER CAPTAIN'S CARRY: at once, a record act; the prize's pieces out of her hold, said. */
  function asCaptain(/** @type {string} */ rc, /** @type {any} */ c) {
    void realmGoldAct({
      session: deps.session, checkpoint: () => deps.checkpoint?.(), needsAnswer: true,
      call: (/** @type {any} */ at) => doorNow().wreck({ receipt: rc, realm: at }),
      apply: (/** @type {any} */ a) => {
        const d = a?.data ?? {};
        const took = Array.isArray(d.took) ? d.took : [];
        const out = took.length ? deps.naval?.()?.pvp?.takeHold?.(c.u, took) ?? [] : [];
        const n = out.length || Math.max(0, Math.floor(Number(d.n) || 0));   // her record already without them: still said
        if (n) say(t('sea.pvp.holdTaken', 'Your wreck was boarded and her hold plundered: {n, plural, one {# piece} other {# pieces}} taken.', { n }), 6);
        else if (c.b === 1) say(t('sea.pvp.holdSpared', 'Your wreck was boarded, but nothing in her hold was worth the taking.'), 5);
      },
    }).catch((e) => console.warn('[sea] the wreck failed', e?.message ?? e));
  }
  /** A WRECK'S SIGNED RECEIPT (seaBroadsides.js hear's `wc`): her captain's carried at once; her killer's kept to carry. */
  function receipt(/** @type {unknown} */ rc) {
    const c = readSeaWreck(rc), me = deps.me?.() ?? null;
    if (!c || !me || seen.has(c.r)) return;
    seen.add(c.r);
    if (seen.size > 64) seen.delete(seen.values().next().value);
    if (c.f === me) { if (deps.session && !deps.session.lost) asCaptain(/** @type {string} */ (rc), c); return; }
    if (c.k !== me) return;
    if (c.b !== 1) { say(t('sea.pvp.notBoarded', 'You did not board her in time. Her hold stays her captain\'s.'), 5); return; }
    due.set(c.r, { rc, c, at: now() + (SEA_WRECK_GRACE_S + SEA_WRECK_SLACK_S) * 1000, tries: 0, busy: false });
    if (due.size > 8) due.delete(due.keys().next().value);
  }
  /** THE FRAME (the sea's host's step): a killer's carry come due - the wreck, then my prizes collected. */
  function frame() {
    if (!due.size || !deps.session || deps.session.lost) return;
    const at = now();
    for (const [r, w] of due) {
      if (w.busy || at < w.at) continue;
      w.busy = true;
      doorNow().wreck({ receipt: w.rc }).then((/** @type {any} */ res) => {
        if (res?.ok) { due.delete(r); return collectSeaPrizes({ session: deps.session, checkpoint: () => deps.checkpoint?.(), character: () => deps.character?.(), door: doorNow(), say: (x, s) => say(x, s) }); }
        w.tries++; w.at = now() + SEA_WRECK_RETRY_MS;
        if (w.tries >= SEA_WRECK_TRIES || !['grace', 'offline', 'busy', 'no-signing-key', 'no-gate-key'].includes(res?.error)) due.delete(r);
        return null;
      }).catch((e) => { console.warn('[sea] the wreck failed', e?.message ?? e); due.delete(r); }).finally(() => { w.busy = false; });
    }
  }
  return { receipt, frame };
}
