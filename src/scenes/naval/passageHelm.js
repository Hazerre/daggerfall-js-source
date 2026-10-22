// @ts-check
// FIELD BUGS 2026-10-21d PASSAGE-HANDS (Harlander, the Discord's #bug-reports, "Booked ocean passage ...": "You can steer
// the ship as if it was yours"). A booked ship is her master's, never the player's (bible/03-World/Passage.md, "What she
// is not") - but Come Sail Away sails only the boat at whose helm the player stands, so the passage puts its passenger
// there (`passageHost.js` book: StartSailing) and her master is the Overworld crossing's hand on that helm (OWS2,
// `systems/seaHelm.js`). The mod's one input seam (`world.js`'s `input`) ORed the player's keys, the helm panel's buttons
// and the controller's helm d-pad in beside that hand: A and D swung her rudder off her master's course (D read first, so
// the passenger's won), W and S moved her oar rungs and her sails, and with the Overworld down - First Person Travel, a foe
// near, the twenty seconds between her master's tries - the whole helm was the passenger's, panel and all.
// AUDIT PASSAGE had recorded it ("B3 a passenger may steer her by hand between her master's tries") and left it.
//
// The law: while her boat carries a charter (passage.js charterRecord), the rudder, the oars, the sails, the trim and her
// lantern answer her master's hand ALONE - the journey's holds, its row and its presses - and the passenger keeps what is
// theirs: stepping from the helm (the mod's disembark key, and Transport) and the time dial. The helm panel is a
// passenger's card (`passengerCard`), naming her and her port, with no buttons. A boat of mine is untouched.
import { charterRecord } from '../../systems/naval/passage.js';
import { BOAT_ACTIONS } from '../../systems/comeSailAway/comeSailAwayActions.js';

/** What a passenger at her helm keeps of its keys: stepping from it, and the time dial. */
export const PASSENGER_KEYS = Object.freeze([BOAT_ACTIONS.disembark, 'Transport', BOAT_ACTIONS.timeScaleUp, BOAT_ACTIONS.timeScaleDown, BOAT_ACTIONS.timeScaleReset]);

/** OWS2: THE JOURNEY'S HAND ON THE HELM - the rudder keys an Overworld journey holds, the oars it pulls, and (PASSAGE-HANDS)
 *  the taps it makes (the sails at its word, the disembark at a landfall) - its own, never the helm panel's or the pad's,
 *  so a passenger's helm can tell her master's from theirs. The host spends the taps with the panel's, once the mod's
 *  step has read them. */
export function createJourneyHand() {
  return { held: new Set(), row: false, edges: new Set(), press(action) { if (typeof action === 'string') this.edges.add(action); } };
}

/** The voyage booked on this boat, or null - she is her master's. @param {any} boat */
export const charterOf = (boat) => charterRecord(boat?.charter);

/**
 * The mod's input seam with a passenger's hands taken off her helm (see above). `input` is the host's whole seam (the
 * keys, the panel, the pad and the journey together); the boat at the helm is asked each read.
 * @param {any} input @param {() => any} boat - Come Sail Away's CurrentBoat
 * @param {{ held: Set<string>, row: boolean, edges: Set<string> }} journey - createJourneyHand's
 */
export function passengerHelm(input, boat, journey) {
  const passenger = () => !!charterOf(boat());
  const seam = Object.create(input);
  Object.defineProperties(seam, {
    has: { value: (/** @type {string} */ action) => (passenger() ? journey.held.has(action) : input.has(action)) },
    started: { value: (/** @type {string} */ action) => (passenger() && !PASSENGER_KEYS.includes(action) ? journey.edges.has(action) : input.started(action) || journey.edges.has(action)) },
    horizontal: { value: () => (passenger() ? 0 : input.horizontal()) },
    vertical: { value: () => (passenger() ? 0 : input.vertical()) },
    toggleAutorun: { get: () => (passenger() ? journey.row : input.toggleAutorun), set: (v) => { input.toggleAutorun = v; } },
  });
  return seam;
}

/** The helm panel's card for a passenger at her helm - her hull, her name and her port - or null for a boat of mine.
 *  @param {any} boat */
export function passengerCard(boat) {
  const c = charterOf(boat);
  return c ? { hull: boat.hull, passage: { ship: c.ship, port: c.to.name } } : null;
}
