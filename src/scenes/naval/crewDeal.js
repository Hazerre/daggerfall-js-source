// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CREW-TRADE (2026-10-23, bible/03-World/Captains-Sea.md CREW-TRADE) - HER CREW AT THE EXCHANGE, the naval host's side:
// the shipwright's window's model carries it (navalHost.js yardModel `crewDeal`) to the harbour office's exchange
// (scenes/harbourOffice.js), which prices, pays and says. Out of createNavalHost (HOST-SPLIT): the host hands her state,
// its roster's sync and its crew companions, and keeps no state of this module's.
// ═══════════════════════════════════════════════════════════════════
import { crewSpare, crewRoom } from '../../systems/naval/crewTrade.js';
import { playerCrewCount } from '../../systems/naval/crewLife.js';
import { fleetCrossed } from '../../systems/fleet.js';

/**
 * A boat of mine's crew as the exchange deals in it: `st` her sea-fight state (navalHost.js myBoatState), `sync(boat)`
 * her roster made to match her deck and answered (navalHost.js crewHands - said to nobody), `companions` the crew
 * companions (systems/naval/crewCompanions.js - `awayOf(uid)` the names of hers ashore at the player's side).
 * @param {any} boat @param {any} st @param {(boat: any) => readonly { name: string }[]} sync
 * @param {{ awayOf: (uid: any) => { has: (name: string) => boolean } }} companions
 */
export function crewDealOf(boat, st, sync, companions) {
  const d = st.damage;
  /** Her crew as the exchange reads it: crewed (a hull whose deck stands men), her crew and her whole, in a fight, how
   *  many more she takes (`room`) and how many may leave her (`spare`, crewTrade.js crewSpare - `why` none may). */
  function stands() {
    const crewed = !!boat?.crewed && d.maxCrew > 0;
    const hands = crewed ? sync(boat) : [];
    const spare = crewSpare({ hull: boat.hull, crew: d.crew, hands, away: boat.uid ? companions.awayOf(boat.uid) : null, crossed: !!boat.uid && fleetCrossed(boat.uid) });
    return { crewed, crew: d.crew, maxCrew: d.maxCrew, fighting: !!st.inFight, room: crewRoom(d), spare: spare.n, why: spare.why };
  }
  return {
    stands,
    /** `k` men signed on: her crew raised, never past her whole (navalDamage.js `muster` - no blow, no fire put out, a
     *  wreck a wreck), no loss on her spirits' books, her new hands named quietly (the sync's own). Answers the men she
     *  took. @param {number} k */
    signOn(k) {
      const was = d.crew;
      d.muster(was + Math.max(0, Math.floor(Number(k) || 0)));
      st.lastCrew = d.crew;
      sync(boat);
      return d.crew - was;
    },
    /** `k` men signed off, as many as may leave her (`stands().spare`): the named hands past what her deck then stands
     *  paid off as the crew hall pays one off (the last to join first, the spirits a hall's recruit lifted leaving with
     *  him - shipCrew.js release), her crew lowered (navalDamage.js `discharge`), no loss on her spirits' books. Answers
     *  the men who left. @param {number} k */
    signOff(k) {
      const n = Math.min(Math.max(0, Math.floor(Number(k) || 0)), stands().spare);
      if (n <= 0) return 0;
      const was = d.crew;
      const keep = playerCrewCount(boat.hull, was - n);
      while (st.crew.hands.length > keep) st.crew.release(st.crew.hands[st.crew.hands.length - 1].name);
      d.discharge(was - n);
      st.lastCrew = d.crew;
      sync(boat);
      return was - d.crew;
    },
  };
}
