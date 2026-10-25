// @ts-check
// WBX6 (2026-09-26, Swololo on Discord: "regeneration defeats the purpose if someone regenerates all the health back in
// 5 seconds. instead of wiping buffs, maybe disable regen in oblivion"): THE DEADLANDS HELD REGENERATION. One switch
// the world host sets every frame (scenes/world.js - beside arenaFrame: a made level stands under this player,
// systems/madeLevel.js), read where each regeneration lives:
//   - the Regenerate effect's round (systems/effects.js - the spell, the potion, the enchantment's cast),
//   - a RegensHealth enchantment's round (systems/enchantments.js),
//   - a career's Regenerate Health advantage (systems/passiveSpecials.js),
//   - a Brawler's Grit (systems/martialPowers.js).
// HEALING IS NOT REGENERATION: a Heal spell, a potion of healing and a friend's cast land as they always did - the fight
// still has its healers (World-Bosses.md section 6: standing the fight earns the spoils). Nothing is wiped.
//
// EVENT-RULES (2026-10-25, the owner, asked how regeneration should work in the world events: "Back, held in a fight"):
// WBX6 turned every regeneration OFF in the made levels, silently - a Regenerate's tile still said "Restores health
// every round" and healed nothing, and the Discord read it as broken. It is HELD now, not off: a regeneration heals
// REGEN_HELD_SHARE of what it would (the fractions carried round to round, each source its own, so a +1 every fourth
// round is a +1 every eighth), and NOTHING for REGEN_HELD_HURT_MS after the player loses health - so the boss's blows
// (WBX4: a share of the struck player's health) still cost what they cost in the thick of a fight, and the fighter who
// steps back heals again. The HUD says so: the made level's tile (ui/hud/statusTips.js madeRulesTip) and a Regenerate's
// own tip (`regenerate`) read regenHeldNow / regenPausedMs.
//
// Offline and outside a made level the switch is off and nothing changes. Not a DFU member. Ledger A (WB; EVENT-RULES).

/** A held regeneration heals this share of its round. */
export const REGEN_HELD_SHARE = 0.5;
/** ...and none for this long after the player last lost health (ms). */
export const REGEN_HELD_HURT_MS = 5000;

let _on = false;
let _now = 0;
let _hurtAt = -Infinity;
/** @type {number|null} */
let _lastHealth = null;
/** Each source's fraction carried to its next round. @type {Map<string, number>} */
const _carry = new Map();

/**
 * The made level's law on (a made level stands under this player and holds its regeneration) or off - and, with it,
 * the player's health this frame, so a loss starts the pause. Set every frame, before any magic round of it.
 * @param {boolean} on @param {number|null} [health] @param {number} [nowMs]
 */
export function setCourtRules(on, health = null, nowMs = performance.now()) {
  _on = !!on;
  _now = nowMs;
  if (!_on) { _lastHealth = null; _hurtAt = -Infinity; _carry.clear(); return; }
  if (!Number.isFinite(health)) return;
  if (_lastHealth != null && /** @type {number} */ (health) < _lastHealth) _hurtAt = nowMs;
  _lastHealth = /** @type {number} */ (health);
}

/** Whether a made level holds regeneration here now. */
export const regenHeldNow = () => _on;
/** How long the pause after a hurt has left (ms), 0 when a held regeneration heals. */
export const regenPausedMs = () => (_on ? Math.max(0, REGEN_HELD_HURT_MS - (_now - _hurtAt)) : 0);

/**
 * What a regeneration of `n` heals now: all of it outside a made level; inside one, none on the player while the
 * pause runs, else REGEN_HELD_SHARE of it with the fraction carried in `source`'s name.
 * @param {number} n @param {string} source @param {boolean} [onPlayer] the healed body is the player's (a foe's own
 *   Regenerate is halved, never paused by the player's hurt)
 */
export function regenShare(n, source, onPlayer = true) {
  if (!_on || !(n > 0)) return n;
  if (onPlayer && regenPausedMs() > 0) return 0;
  const c = (_carry.get(source) ?? 0) + n * REGEN_HELD_SHARE;
  const out = Math.floor(c + 1e-9);
  _carry.set(source, c - out);
  return out;
}
