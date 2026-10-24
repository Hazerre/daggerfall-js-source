// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9) — THE KETCHMASTER'S HOLD, AS THE SERVICE KEEPS IT.
//
// The relay runs each crew's sky-ketch and, at the Tonal Warden's fall, signs a receipt for each member who earned it
// (src/net/ketch/ketchReceipt.js - `k1`, under the relay's GATE_SIGNING_KEY). This file is where that receipt is honoured:
// the Hour's claim (sds.js claimSd) rung for rung, and THE WEEK'S SHARE.
//
// ═══ ONCE A VOYAGE ═════════════════════════════════════════════════
//
// ketch_voyages' primary key is (voyage, account): the hold pays a hand once a week. The first receipt of a voyage the
// service is shown takes its share (`recorded`). The same voyage again from the SAME ship - another device, a retry after
// a lost answer - is the same kill: answered `claimed`, `share` true, and the page rolls its spoils off the receipt as it
// would have. The same voyage from ANOTHER crew's ship is answered `taken`, `share` false: the account helped a second
// crew this week, and its page throws no spoils for it. A guest's share is written too - the week is the account's,
// registered or not - and its record says `guest` (no voyages counted to a name nobody holds).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyKetchReceipt } from '../../src/net/ketch/ketchReceipt.js';

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's voyages to the Ketchmaster's hold, for the cards: `{ sailed }`. */
export async function ketchRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM ketch_voyages WHERE account = ?1').bind(playerId).first();
  return { sailed: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the body's
 * word), one row a (voyage, account). Answers `{ recorded: true, voyage, share: true, sailed }`, `{ recorded: false, why:
 * 'claimed', share: true, sailed }` (this ship's kill again), `{ recorded: false, why: 'taken', share: false, sailed }`
 * (another crew's ship this voyage), or `{ error }` - `no-gate-key`, `receipt` (`why` says which rung), `not-yours`. A
 * guest's answer says `guest: true` beside it.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {unknown} receipt
 * @param {CryptoKey|null} publicKey
 */
export async function claimKetch({ db, nowS, subtle, rand }, player, receipt, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyKetchReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const nonce = hex(rand(new Uint8Array(8)));
  const [row, kept, count] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO ketch_voyages (voyage, account, owner, earned, lv, nonce, at, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(c.d, player.id, c.o, c.x, c.l, nonce, nowS, c.m ? JSON.stringify(c.m) : null),
    db.prepare('SELECT owner, nonce FROM ketch_voyages WHERE voyage = ?1 AND account = ?2').bind(c.d, player.id),
    db.prepare('SELECT COUNT(*) AS n FROM ketch_voyages WHERE account = ?1').bind(player.id),
  ]);
  const sailed = int(count?.results?.[0]?.n), guest = !player.handle ? { guest: true } : {};
  if (Number(row?.meta?.changes ?? 0) > 0) return { recorded: true, voyage: c.d, share: true, sailed, ...guest };
  const owner = kept?.results?.[0]?.owner ?? null;
  return owner === c.o ? { recorded: false, why: 'claimed', share: true, sailed, ...guest } : { recorded: false, why: 'taken', share: false, sailed, ...guest };
}
