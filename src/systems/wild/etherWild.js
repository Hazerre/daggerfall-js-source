// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ETHER-WILD (2026-10-21) - THE OPEN SEA: THE ELTHERIC OCEAN AN OPEN PVP ZONE (bible/03-World/Eltheric-Ocean.md ETHER-WILD;
// bible/11-Multiplayer/Wild-Zone.md section 24).
//
// The owner: "The etheric ocean is some amazing content we havent touched in awhile. I want there to be more of a reason
// to venture into this zone. ... id also like to implement open pvp for this zone specifficaly and implement some of the
// wrothgarian mountain open pvp aspects into the procedural Islands".
//
// WHAT THE ZONE IS: every pixel of the sea's box (world/ethericSea.js inEther) but VEILHAVEN'S PEACE - the Veil, the way
// home (`inVeil`), and the water within ETHER_PEACE_PX of Veilhaven's own pixel, where the crossing makes its landfall.
// The rest of the sea, its isles, their towns and their ruins, is the Wrothgarian Mountains' law (systems/wild/wildZone.js
// - the live flag, the fights the relay referees, the death's drop and the remains, the strangers, the foes four times
// as strong and their loot by the ring), with the sea's DEPTH BANDS for the mountains' four rings: the Shallows the
// foothills' +25%, the Reaches +50%, the Deep Aether +75%, the Abyss the heart's twice. The deeper, the deadlier and the
// richer - the sea's own law already (its ships' levels, its holds' tiers), now its foes' and its players' too.
//
// ONLINE ALONE, as the mountains are: offline the sea is the captain's own. The world host asks it each frame, beside
// the mountains' (scenes/world.js wildFrame), and a dungeon of an isle at its build (scenes/dungeonContext.js
// wildRingAtPlace).
//
// THIS FILE IS A LEAF of the zone: the sea's law (pure, worker-safe - world/ethericSea.js imports formats/ alone) and the
// zone's words on this ground, registered with wildZone.js so the mountains' leaf imports nothing of the sea.
// ═══════════════════════════════════════════════════════════════════
import { BANDS, ETHER_WORD, inEther, inVeil, etherBandAt, veilhaven } from '../../world/ethericSea.js';
import { WILD_RINGS, wildRingAt, wildRingBonus, registerZoneWords } from './wildZone.js';
import { t } from '../textManager.js';

/** The ground's kind on the live flag (wildZone.js setWildHere). */
export const ETHER_KIND = 'ether';
/** VEILHAVEN'S PEACE: no player fights within this many pixels of Veilhaven's own pixel (some 10 km - the landfall, LANDFALL_OFF_PX
 *  east of it, well inside), nor in the Veil itself. */
export const ETHER_PEACE_PX = 12;

/** Is pixel (x, y) in Veilhaven's peace - the Veil, or within ETHER_PEACE_PX of Veilhaven? */
export function etherInPeace(x, y) {
  if (inVeil(x, y)) return true;
  const h = veilhaven();
  return Math.hypot(x - h.px, y - h.py) <= ETHER_PEACE_PX;
}

/** The ring of the open sea at pixel (x, y): its depth band's place (1 the Shallows ... 4 the Abyss), or 0 - outside the
 *  sea's box, or in Veilhaven's peace. */
export function etherWildRingAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !inEther(x, y) || etherInPeace(x, y)) return 0;
  return Math.max(1, Math.min(WILD_RINGS, BANDS.indexOf(etherBandAt(x)) + 1));
}

/**
 * WILD2: A PLACE'S RING of the open zone, by its map pixel (mapTableData's longitude/latitude, MapsFile's own sum) - a
 * dungeon's build reads it once (scenes/dungeonContext.js, moved here from there so it is read the same way everywhere).
 * ETHER-WILD: an isle's place (world/etherPlaces.js synthesizeEtherLocation's `ether`) by the sea's band at its pixel;
 * any other by the mountains' registered mask (wildZone.js wildRingAt). 0 for a place that cannot say where it stands.
 */
export function wildRingAtPlace(loc) {
  const at = loc?.mapTableData;
  if (!Number.isFinite(at?.longitude) || !Number.isFinite(at?.latitude)) return 0;
  const px = Math.trunc(at.longitude / 128), py = 499 - Math.trunc(at.latitude / 128);   // formats/mapsFile.js longitudeLatitudeToMapPixel
  return loc?.ether ? etherWildRingAt(px, py) : wildRingAt(px, py);
}

/** A ring's name on the sea: its band's ("The Shallows" ... "The Abyss"). */
export const etherRingName = (ring) => BAND_NAMES[BANDS[Math.max(1, Math.min(WILD_RINGS, ring | 0 || WILD_RINGS)) - 1].id]();
/** The bands' names at the head of a line - each its own key (the extractor reads a key whole). */
const BAND_NAMES = Object.freeze({
  shallows: () => t('sea.wild.band.shallows', 'The Shallows'),
  reaches: () => t('sea.wild.band.reaches', 'The Reaches'),
  deep: () => t('sea.wild.band.deep', 'The Deep Aether'),
  abyss: () => t('sea.wild.band.abyss', 'The Abyss'),
});

/** The zone's words on the sea (WILD_TEXT's keys, said this ground's way) - through the text core (L10N4), read when said. */
export const ETHER_WILD_TEXT = Object.freeze({
  enter: () => t('sea.wild.enter', 'You sail out of Veilhaven\'s peace onto the open {word} Ocean, an open PvP zone. Foes here are four times as strong, and you can lose what you carry.', { word: ETHER_WORD }),
  leave: () => t('sea.wild.leave', 'You are in Veilhaven\'s peace. No player may attack you here.'),
  ring: (r) => t('sea.wild.ring', '{band}: {bonus}.', { band: etherRingName(r), bonus: wildRingBonus(r) }),
  ringCross: (r, deeper) => (deeper
    ? t('sea.wild.deeper', 'Deeper - {band}: {bonus}.', { band: etherRingName(r), bonus: wildRingBonus(r) })
    : t('sea.wild.shallower', 'Back toward the Veil - {band}: {bonus}.', { band: etherRingName(r), bonus: wildRingBonus(r) })),
  chipTip: () => t('sea.wild.chipTip', 'The {word} Ocean past Veilhaven\'s peace: other players may attack you. Foes are four times as strong and drop up to twice the loot (25% more in the Shallows, twice in the Abyss). If you die, you drop what you carry.', { word: ETHER_WORD }),
  deathHold: () => t('sea.wild.deathHold', 'Past the Veil the dead wait two minutes.'),
  teleport: () => t('sea.wild.teleport', 'You cannot teleport into, out of or about the open {word} Ocean. Sail.', { word: ETHER_WORD }),
});

// The zone's words on this ground: wildZone.js zoneWord/zoneName/zoneRingName answer them while the player stands here.
// A word is a string where WILD_TEXT's is one (read here, at the first ask of each: a getter keeps the language's).
registerZoneWords(ETHER_KIND, {
  name: `${ETHER_WORD} Ocean`,   // as WILD_NAME is said: the sentence brings its own "the" ("until you leave the {zone}")
  ringName: etherRingName,
  get enter() { return ETHER_WILD_TEXT.enter(); },
  get leave() { return ETHER_WILD_TEXT.leave(); },
  ring: ETHER_WILD_TEXT.ring,
  ringCross: ETHER_WILD_TEXT.ringCross,
  get chipTip() { return ETHER_WILD_TEXT.chipTip(); },
  get deathHold() { return ETHER_WILD_TEXT.deathHold(); },
});
