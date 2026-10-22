// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT-WRITS (2026-10-22; bible/06-Systems/Professions-Arc.md section 49): THE WORK TAB'S CRAFTING WRITS, HANDED OVER
// FROM THE PACK. The law is src/net/craftWritLaw.js, the service server-account/src/craftWrits.js; this is the host's
// half - what the pack holds toward a writ, and its goods out of the pack inside the realm act that takes them out of the
// record (systems/realmSaves.js realmGoldAct: the save checkpointed first, the goods out as the service is first asked,
// back on a refusal; silence ends the session and a join reads the record - the disenchant's own order).
//
// THE FOUR HOSTS. The Notice Board's Work tab is scenes/world.js's (its `work` names this host); worldModes.js and
// dungeonContext.js stand inside world.js's page and open no board of their own;
// scenes/exterior.js - FLAGGED: the fixed-city bench never goes online, so it posts no crafting writ, as no Court writ.
// ═══════════════════════════════════════════════════════════════════

import { realmGoldAct } from '../systems/realmSaves.js';
import { craftGoodsPick, craftGoodsHeld, pieceAnswers } from '../net/craftWritLaw.js';
import { recordCount } from '../net/realm/realmTradeLaw.js';

/**
 * @param {{ player: () => any, session: () => any, checkpoint: () => any, saved: () => void, book: () => any }} deps
 *   `player` the playing entity (its `items` the pack), `session` the realm session (null offline), `checkpoint` the
 *   host's realm checkpoint, `saved` the save's own "changed", `book` the professions' book (net/profBook.js)
 */
export function createCraftWritHost({ player, session, checkpoint, saved, book }) {
  /** A dish or kit writ's pieces the pack holds - the service's list of the character's own (`w.pieces`), in pack order. */
  const piecesOf = (/** @type {any} */ w) => {
    const ok = new Set(Array.isArray(w?.pieces) ? w.pieces : []);
    return (player()?.items ?? []).filter((it) => ok.has(it?.provenance) && pieceAnswers(w.product, it?.recipe)).map((it) => String(it.provenance));
  };
  return {
    /**
     * WHAT THE CHARACTER HOLDS TOWARD A WRIT: `pack` its goods in the pack that may go, `made` what the service counts as
     * its own (a potion writ's witnessed brews not yet given, a piece writ's own pieces in the pack), `ready` whether
     * both cover the count.
     * @param {any} w
     */
    held(w) {
      if (w?.kind === 'potion') {
        const pack = craftGoodsHeld(player()?.items ?? [], w);
        const made = Math.max(0, Number(w.brewed) || 0);
        return { pack, made, ready: pack >= w.qty && made >= w.qty };
      }
      const made = piecesOf(w).length;
      return { pack: craftGoodsHeld(player()?.items ?? [], w), made, ready: made >= w.qty };
    },
    /**
     * A WRIT DELIVERED: its goods picked from the pack as the service picks them from the record (craftWritLaw.js
     * craftGoodsPick - the plain bottles before the Potent, a dish's or kit's own pieces), taken out as the service is
     * first asked, put back on its refusal. Answers the service's answer (`{ ok, data }`, `landed` for an act that landed
     * with its answer lost) or `{ ok: false, error }`.
     * @param {any} w
     */
    async deliver(w) {
      const p = player();
      const pack = p?.items;
      const s = session();
      if (!s || !Array.isArray(pack)) return { ok: false, error: 'realm-needed' };
      const pieces = w.kind === 'potion' ? null : piecesOf(w).slice(0, w.qty);
      const pick = craftGoodsPick(pack, w, pieces);
      if (!pick) return { ok: false, error: w.kind === 'potion' ? 'craft-goods-gone' : 'craft-pieces' };
      const took = pick.map(({ at, n }) => ({ rec: pack[at], n, whole: recordCount(pack[at]) <= n }));
      const here = () => player() === p && p.items === pack;
      let out = false;
      const takeOut = () => {
        for (const t of took) {
          if (t.whole) { const i = pack.indexOf(t.rec); if (i >= 0) pack.splice(i, 1); } else t.rec.stackCount = recordCount(t.rec) - t.n;
        }
        out = true;
      };
      const putBack = () => {
        if (!out) return;
        for (const t of took) { if (t.whole) { if (!pack.includes(t.rec)) pack.push(t.rec); } else t.rec.stackCount = recordCount(t.rec) + t.n; }
        out = false;
      };
      const r = await realmGoldAct({
        session: s, checkpoint: () => { if (here()) checkpoint(); },
        reserve: () => putBack,
        call: (at) => {
          if (!here()) return Promise.resolve({ ok: false, error: 'elsewhere', elsewhere: true });
          if (!out) takeOut();
          return book().craftDeliver(w.id, pieces, at);
        },
      });
      if (r?.ok) saved();
      return r;
    },
  };
}
