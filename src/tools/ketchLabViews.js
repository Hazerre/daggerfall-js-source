// @ts-check
// THE KETCH LAB'S EYES (KETCH, 2026-10-24; KETCH-LOOK KL0, bible/11-Multiplayer/Sky-Ketch-Look.md section 17): the cameras
// the lab (src/tools/ketchLab.js) stands at and the knobs it reads off its query - pure, so the views are checked in node
// (test/world/ketch/ketch_lab.test.js: every eye in open air, clear of the ship's colliders) and the page only reads them.
//
// Not a DFU member. Ledger A (KETCH).

/** The cameras, in the deck's frame (metres; yaw 0 faces +z, the stern; degrees). `top-out` (KETCH-LOOK KL0): the main
 *  top's ring outside the shaft, looking out along the yard to the Sailwalk - the `top` view stands at the shaft's west
 *  gate and its bars fill the frame. */
export const KT_LAB_VIEWS = Object.freeze({
  arrive: Object.freeze({ at: Object.freeze([0, 1.7, 6]), yaw: 0, pitch: -2 }),
  waist: Object.freeze({ at: Object.freeze([-9, 2.2, 20]), yaw: 25, pitch: -6 }),
  'waist-aft': Object.freeze({ at: Object.freeze([0, 4, 30]), yaw: 0, pitch: -4 }),
  gallery: Object.freeze({ at: Object.freeze([0, -4.3, 62]), yaw: 0, pitch: -6 }),
  landing: Object.freeze({ at: Object.freeze([-6, -4.3, 112]), yaw: 40, pitch: -10 }),
  hold: Object.freeze({ at: Object.freeze([0, -10.3, 128]), yaw: 180, pitch: -6 }),
  engine: Object.freeze({ at: Object.freeze([6, -9.6, 76]), yaw: 200, pitch: -10 }),
  lift: Object.freeze({ at: Object.freeze([2, -10.3, 58]), yaw: 90, pitch: 4 }),
  top: Object.freeze({ at: Object.freeze([5, 17.7, 56]), yaw: 70, pitch: -6 }),
  'top-out': Object.freeze({ at: Object.freeze([12.6, 17.7, 53.6]), yaw: 55, pitch: -8 }),
  sailwalk: Object.freeze({ at: Object.freeze([24, 17.7, 59]), yaw: 0, pitch: -6 }),
  'sailwalk-side': Object.freeze({ at: Object.freeze([44, 24, 100]), yaw: -100, pitch: -10 }),
  bridge: Object.freeze({ at: Object.freeze([16, 1.7, 186]), yaw: -60, pitch: -2 }),
  helm: Object.freeze({ at: Object.freeze([0, 2.4, 190]), yaw: 0, pitch: -2 }),
  cabin: Object.freeze({ at: Object.freeze([0, 1.7, 226]), yaw: 0, pitch: -6 }),
  bow: Object.freeze({ at: Object.freeze([-30, 14, -30]), yaw: 40, pitch: -14 }),
  side: Object.freeze({ at: Object.freeze([90, 30, 110]), yaw: -90, pitch: -12 }),
  stern: Object.freeze({ at: Object.freeze([40, 20, 280]), yaw: -150, pitch: -10 }),
  above: Object.freeze({ at: Object.freeze([0, 140, 110]), yaw: 0, pitch: -85 }),
  below: Object.freeze({ at: Object.freeze([30, -60, 90]), yaw: -30, pitch: 30 }),
  city: Object.freeze({ at: Object.freeze([0, 1.7, 30]), yaw: -100, pitch: -24 }),
});

/** The views a body stands at: the eye a body's height over a floor of the ship (the rest look at her from the air, or from
 *  over a crew's heads - `waist-aft`). */
export const KT_LAB_DECK_VIEWS = Object.freeze(['arrive', 'waist', 'gallery', 'landing', 'hold', 'engine', 'lift', 'top', 'top-out', 'sailwalk', 'bridge', 'helm', 'cabin', 'city']);

/**
 * THE LAB'S KNOBS read off a query string: `grey` the frame in grey (the look's grayscale check - every meaning carried by
 * shape, place and motion, never by hue alone); `lite` the phone's tier (ui/touch/touchDevice.js isTouchDevice's answer,
 * forced); `bill` the frame's bill on screen and on `window.__lab.bill()`; `sky` the world's sky over her (on unless
 * `sky=0` - the game always draws one: the dungeon arm's `host.drawSky`); `weather` the sky's word; `hour` the hour the
 * light is at. Pure.
 * @param {string} search
 */
export function ketchLabKnobs(search) {
  const p = new URLSearchParams(search);
  const hour = Number(p.get('hour') ?? 13);
  return Object.freeze({
    grey: p.has('grey'),
    lite: p.has('lite') || p.get('touch') === 'on',
    bill: p.has('bill'),
    sky: p.get('sky') !== '0',
    weather: p.get('weather') ?? 'sunny',
    hour: Number.isFinite(hour) ? hour : 13,
  });
}
