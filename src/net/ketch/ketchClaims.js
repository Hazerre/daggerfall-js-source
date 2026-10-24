// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE TONAL WARDEN'S RECEIPTS THIS DEVICE CARRIES TO THE
// ACCOUNT SERVICE - the Hour's book (net/superDungeon/sdClaims.js) rung for rung, and the hold's week.
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the ship hands this socket (net/online.js
// `onKetch`'s `rcpt` - at the Warden's fall, and again at a hello into the ship while it holds the voyage) is kept on the
// device (KT_CLAIMS_KEY) and offered to the account service (`/v1/ketch/claim` - server-account/src/ketch.js claimKetch)
// at once, and again while it is kept, at most every KT_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted,
// counted before, taken by another crew's ship, not a receipt the relay signed. One that does not keeps it: no session yet,
// the service without its public half, a guest who may still register, the network, a refusal the service can mend.
//
// THE HOLD PAYS: a receipt the service answers with its share (`recorded`, or `claimed` - this ship's kill again) is
// handed to `paid` with its claims, which rolls the spoils off its seed (systems/ketch/ketchSpoils.js) - once a voyage and
// ship on this device, the spoils pool's own key (scenes/spoilsPool.js). A receipt answered `taken` throws nothing: the
// account took its week's share with another crew.
//
// THE DEVICE IS NOT THE ACCOUNT: kept one a voyage AND account, and only the signed-in account's offered.
//
// Pure - the call, the store and the clocks are handed in. Not a DFU member. Ledger A (KETCH).
import { readKetchReceipt } from './ketchReceipt.js';
import { noteAct } from '../../systems/questlines/qlActs.js';   // the questline's act: the Warden felled, counted once
import { t } from '../../systems/textManager.js';

/** The device's Ketch receipts not yet settled with the account service. */
export const KT_CLAIMS_KEY = 'kt.ketchClaims';
/** The most it keeps for one account and for the device (a voyage a week: a handful at most). */
export const KT_CLAIMS_MAX = 8;
export const KT_CLAIMS_ALL_MAX = 64;
/** The least time between two offers of what is kept, ms; how often a frame asks who is signed in. */
export const KT_CLAIM_RETRY_MS = 10 * 60 * 1000;
export const KT_ME_POLL_MS = 1000;
/** The refusals of a receipt the service can mend - kept for the receipt's week rather than let go (the gate's). */
export const KT_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** The words - each read through the text core when it is said (L10N4). */
export const KT_CLAIM_TEXT = Object.freeze({
  recorded: (n) => t('ketch.claim.recorded', 'The Ketchmaster\'s hold pays your share. Voyages sailed: {n}.', { n }),
  get taken() { return t('ketch.claim.taken', 'You have already taken your share of the Ketchmaster\'s hold this voyage, with another crew. She pays no hand twice a week.'); },
  get guest() { return t('ketch.claim.guest', 'Voyage not recorded to a name. Add a username within a week to keep it.'); },
});

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function ketchClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.guest === true && answer.data?.recorded !== true && answer.data?.why !== 'taken' && answer.data?.why !== 'claimed' ? 'keep' : 'done';
  return answer?.error === 'receipt' && !KT_CLAIM_MENDABLE.includes(answer.why) ? 'done' : answer?.error === 'not-yours' ? 'done' : 'keep';
}
/** The voyages sailed as the account card says them - "3", "None yet" - or null for no record. */
export function ketchRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.sailed) || rec.sailed < 0) return null;
  return rec.sailed > 0 ? String(rec.sailed) : t('ketch.claim.none', 'None yet');
}

/**
 * @param {{
 *   claim: (receipt: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, say?: (text: string) => void, me?: () => (string|null),
 *   paid?: (claims: any, answer: any) => void,
 * }} deps `claim` net/accountClient.js accountKetch's - `{ ok, data }` or `{ ok: false, error, why? }`, never a throw; `nowS`
 *   the relay's clock (null unheard); `me` the signed-in account; `paid` the hold's share answered - its spoils to roll
 */
export function createKetchClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, me = () => null, paid = () => {} }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readKetchReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(KT_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((r) => live(r));
  }
  const keep = (list) => { memory = list; try { store?.set(KT_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let n = 0;
    try {
      const list = kept();
      keep(list);
      const mine = me();
      for (const r of list) {
        const c = live(r);
        if (!mine || c?.s !== mine) continue;
        let answer;
        try { answer = await claim(r); } catch { answer = { ok: false, error: 'offline' }; }
        const d = answer?.ok ? answer.data ?? {} : null;
        if (d?.recorded === true) {
          n++;
          noteAct('warden-felled');
          if (Number.isSafeInteger(d.sailed)) say(KT_CLAIM_TEXT.recorded(d.sailed));
        }
        if (d && d.share === true) { try { paid(c, d); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); } }
        else if (d && d.why === 'taken') say(KT_CLAIM_TEXT.taken);
        if (d?.guest === true && !guestSaid.has(r)) { guestSaid.add(r); say(KT_CLAIM_TEXT.guest); }
        if (ketchClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k !== r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return n;
  }
  return {
    /** A receipt the ship handed this socket: kept (one a voyage and account) and offered at once. Answers whether kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => { const o = readKetchReceipt(k); return k === r || (o?.d === c.d && o?.s === c.s && o?.o === c.o); })) {
        const theirs = list.filter((k) => readKetchReceipt(k)?.s === c.s);
        const drop = theirs.length >= KT_CLAIMS_MAX ? theirs[0] : null;
        keep([...list.filter((k) => k !== drop), r].slice(-KT_CLAIMS_ALL_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept offered again once KT_CLAIM_RETRY_MS has passed - and the first frame after another account
     *  signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= KT_CLAIM_RETRY_MS;
      if (!due && t - meAt < KT_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((r) => mine && live(r)?.s === mine)) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    kept,
  };
}
