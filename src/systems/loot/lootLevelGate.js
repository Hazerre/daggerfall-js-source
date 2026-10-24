// @ts-check
// LOOT-GATE (2026-10-25, Dudey: two streamers found Legendaries at level 1 and 2 and never used another weapon; "early
// game 1-8/9/10ish swap out between blue gear, then at roughly 10/11ish you start finding yellow gear rarely and then
// legendaries get a small increase of chance to drop").
//
// THE ROLLER'S LEVEL SCALES THE TOP OF THE LADDER. Every rarity roll read its source alone - a Crypt's pile is tier 9
// whoever opens it - so a level 1 character met a Legendary in about one Crypt in three. Now the Rare and Legendary
// thresholds are multiplied by a factor of the roller's level before the roll (lootRarity.js rarityChances); Magic is
// left alone. The source still decides the odds; the level only holds the top tiers back until the character is ready.
//
//   Rare:      x0.15 up to level 7, then up to x1 at level 12
//   Legendary: x0.05 up to level 9, x0.25 at level 10, then up to x1 at level 15
//
// The drought (lootDrought.js) does not count under DROUGHT_FROM, so it never builds a pile of pity that empties on the
// day the character turns 10. A Legendary that does drop early is a whole one; a found Rare can be imbued Legendary at
// the Mages Guild's Reforge (reforge.js imbuePiece).
//
// KEPT FROM PLAYERS (Dudey, 2026-10-25): patch notes, release notes, Discord posts and in-game help never state these
// levels, factors or chances. Players are told only that Rare and Legendary gear is rarer early on and becomes more
// common as they grow.
//
// A leaf: the curves and the registered level, no import. The level comes from whoever registers it
// (lootPowers.js: the live player's effective level, Mentor Mode's when on, once a host publishes the player's door -
// systems/playerDoor.js); a roll with no level registered and none handed
// in is not gated, so a test, a tool or a room's shared roll that names no level rolls as before.

/** The Rare factor's floor, the level it holds to, and the level it reaches x1 at. */
export const RARE_GATE = Object.freeze({ floor: 0.15, holdTo: 7, fullAt: 12 });
/** The Legendary factor's floor, the level it holds to, its first step past that, and the level it reaches x1 at. */
export const LEGENDARY_GATE = Object.freeze({ floor: 0.05, holdTo: 9, step: 0.25, fullAt: 15 });
/** Under this level the drought does not count. */
export const DROUGHT_FROM = 10;

const lv = (level) => Math.max(1, Math.floor(Number(level) || 1));

/** The Rare threshold's factor at a level. */
export function rareGate(level) {
  const L = lv(level);
  const g = RARE_GATE;
  if (L <= g.holdTo) return g.floor;
  if (L >= g.fullAt) return 1;
  return g.floor + ((1 - g.floor) * (L - g.holdTo)) / (g.fullAt - g.holdTo);
}

/** The Legendary threshold's factor at a level. */
export function legendaryGate(level) {
  const L = lv(level);
  const g = LEGENDARY_GATE;
  if (L <= g.holdTo) return g.floor;
  if (L >= g.fullAt) return 1;
  return g.step + ((1 - g.step) * (L - g.holdTo - 1)) / (g.fullAt - g.holdTo - 1);
}

/** Whether the drought is held at this level (null: no level, never held). */
export const droughtHeld = (level) => Number.isFinite(Number(level)) && level != null && lv(level) < DROUGHT_FROM;

let _level = null;
/** Register the roller's level (a function answering a number), or clear it with null. */
export function registerRollerLevel(fn) { _level = typeof fn === 'function' ? fn : null; }
/** The roller's level now, or null when none is registered or it answers nonsense. */
export function rollerLevel() {
  if (!_level) return null;
  try { const v = Number(_level()); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
}
