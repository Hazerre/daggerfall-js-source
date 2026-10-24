// @ts-check
// KETCH-LOOK (bible/11-Multiplayer/Sky-Ketch-Look.md section 2; slice KL1): HER LOOK'S SHARED NUMBERS - pure, a leaf (it
// imports nothing, so a renderer's pass, a probe and a test read it alike).
//
//   THE LIGHTS (KT_MEANING): the four meanings and the beat, each a colour that already had its home - the lamps'
//     (world/ketch/ketchModel.js KT_LAMP), the lit things' (scenes/ketch/ketchDeckHost.js KT_GLOWS), the Hour's red and its
//     moment (world/superDungeon/sdLook.js SD_LIGHT). A leaf cannot import a ship builder or a scene, so the numbers are
//     written here and test/world/ketch/ketch_atmos.test.js pins each equal to its home: nothing is re-pointed.
//   THE VALUE LADDER (KT_LADDER): the display luma each rung is held to, as tools/ketchLabProbe.mjs measures it (Y' =
//     0.2126R' + 0.7152G' + 0.0722B' over the encoded frame).
//
// Not a DFU member. Ledger A (KETCH).

const f3 = (a, b, c) => Object.freeze([a, b, c]);

/** THE LIGHTS, linear RGB as the renderer takes them: LAMP the made way (`lampBelow` its warmer self below decks), AETHER
 *  her soul true (`aetherTrue` a true resonator's), EMBER out of tune or about to fail, RED refused or the end, and `beat`
 *  the white-gold of a beat landing, once. */
export const KT_MEANING = Object.freeze({
  lamp: f3(1.0, 0.8, 0.5), lampBelow: f3(1.0, 0.7, 0.4),
  aether: f3(0.5, 0.85, 1.0), aetherTrue: f3(0.55, 0.9, 1.0),
  ember: f3(1.0, 0.4, 0.15),
  red: f3(1.0, 0.32, 0.26),
  beat: f3(1.0, 0.92, 0.62),
});

/** THE VALUE LADDER (display luma): L0 the land far below (by day at most `dayMax` and under her hull's mean, by night at
 *  most `nightMax`); L1 her structure - on the open decks at noon the floor (the frame's lower 30%) at mean `noonFloorMean`
 *  and p95 `noonFloorP95` at most, nothing over `max`, at dusk p50 at least `duskP50`, at night mean at least
 *  `nightMean`; below decks p50 at least `p50` at every hour, a lamp's pool at most `pool`, a telegraph's floor at most
 *  `telegraphFloor` under every lamp; the cabin's p50 in `p50`; L2 ambient light (cages, edge lines, gauge faces, ports by
 *  night); L3 signals (aether and ember glass, needles, lit bands); L4 critical (a telegraph's core, a tell at its
 *  hottest, the beat) at least `min`, peaking at `peak` - render/airPass.js AIR_BRIGHT_THRESHOLD, where bloom begins. */
export const KT_LADDER = Object.freeze({
  deep: Object.freeze({ dayMax: 0.40, nightMax: 0.06 }),
  deck: Object.freeze({ noonFloorMean: 0.22, noonFloorP95: 0.30, max: 0.5, duskP50: 0.10, nightMean: 0.06 }),
  below: Object.freeze({ p50: 0.08, pool: 0.30, telegraphFloor: 0.25 }),
  cabin: Object.freeze({ p50: Object.freeze([0.15, 0.35]) }),
  ambient: Object.freeze([0.30, 0.45]),
  signal: Object.freeze([0.5, 0.8]),
  critical: Object.freeze({ min: 0.7, peak: 0.85 }),
});
