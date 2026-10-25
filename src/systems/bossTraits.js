// @ts-check
// BOSS-TRAITS (2026-10-25, the owner: "possibly implementing boss types that might be shielded, have resistances, curb
// power, etc for more artifical difficulty"; asked where, "Raid leaders", "Elite foes" and "Relay bosses";
// bible/05-Combat/Boss-Traits.md): A HARD FOE'S OWN RULES, where the made levels had taken the player's away
// (EVENT-RULES gave regeneration back - systems/courtRules.js). Each trait is one plain rule a player can read off the
// foe's title and its target frame, and answer:
//
//   warded        a ward of WARD_SHARE of its health takes every blow first, and grows back whole WARD_REGROW_S after
//                 the last blow that touched it (WARD_REFILL_S to fill) - keep hitting it
//   flameproof, frostproof, venomproof, stormproof, spellproof
//                 a spell of that element lands RESIST_SHARE of itself - change the spell
//   bladeturning  a blade or an arrow lands WEAPON_RESIST_SHARE - bring a blunt weapon or your fists
//   stoneskin     a blunt weapon or a fist lands WEAPON_RESIST_SHARE - bring a blade
//   curbing       no blow takes more than CURB_SHARE of its health - it curbs a big hit, so the fight is many blows
//   wrathful      WRATH_AFTER_S after its first wound it hits WRATH_X as hard - kill it before then
//   thorned       THORN_SHARE of every weapon blow that lands on it comes back at its striker
//
// WHERE EACH IS ANSWERED. A trait that needs the striker's weapon or spell (the resistances) or hurts the striker (the
// thorns) is answered on the STRIKER's machine - `bossStrike`, before a blow on a puppet goes to its owner - and a trait
// that keeps state (the ward, the curb on what is left, the wrath's clock) on the OWNER's - `bossTake`, where its
// health is. A foe of my own is both. The relay bosses (World-Bosses.md and its kin) keep their health on the relay:
// their stand-ins (world/gate/gateBoss.js bossStandIn) carry the striker's traits only, so the number a blow sends is
// already resisted (`relayBossTraits`); the relay's own caps and wards are theirs, unchanged.
//
// ON THE WIRE (net/wire.js validFoeRecord): `bt`, the traits as a mask over BOSS_TRAITS, and `bw` 1 while wrathful -
// a puppet stands with its owner's traits, so its title, its blows at me and the striker's half agree.
//
// PURE but for the language (systems/textManager.js) - the hosts call in. Not a DFU member: DFU's foes resist by
// their career's flags alone (FormulaHelper.SavingThrow), which stay as they are beside these. Ledger A (BOSS-TRAITS).
import { t } from './textManager.js';
import { weaponSkillUsed } from '../characters/weapons.js';
import { SKILLS } from './skills.js';
import { eliteHash, eliteRng } from './eliteFoes.js';   // the seeded draw every client draws alike (a leaf of this one: it imports nothing of here)

/** Every trait, in the mask's bit order (append only: the mask is on the wire). */
export const BOSS_TRAITS = Object.freeze(['warded', 'flameproof', 'frostproof', 'venomproof', 'stormproof', 'spellproof', 'bladeturning', 'stoneskin', 'curbing', 'wrathful', 'thorned']);
/** The element each resistance answers - the spells' own order (systems/effects.js ELEMENT_EFFECT_FLAG: fire, frost,
 *  poison, shock, magic). */
export const ELEMENT_TRAITS = Object.freeze(['flameproof', 'frostproof', 'venomproof', 'stormproof', 'spellproof']);
/** The ward: this share of its maximum health, grown back WARD_REGROW_S after the last blow on it, whole over WARD_REFILL_S. */
export const WARD_SHARE = 0.3;
export const WARD_REGROW_S = 10;
export const WARD_REFILL_S = 4;
/** What a resisted spell lands, of itself. */
export const RESIST_SHARE = 0.25;
/** What a resisted weapon lands, of itself. */
export const WEAPON_RESIST_SHARE = 0.5;
/** The most of its maximum health one blow takes from a curbing foe. */
export const CURB_SHARE = 0.05;
/** The wrath: this long after its first wound (s), and how much harder it hits then. */
export const WRATH_AFTER_S = 75;
export const WRATH_X = 1.6;
/** The thorns: this share of a weapon blow that lands comes back at its striker. */
export const THORN_SHARE = 0.2;
/** The mask's ceiling (one bit a trait). */
export const BOSS_TRAIT_MASK_MAX = (1 << BOSS_TRAITS.length) - 1;
/** Traits that never stand together: the two weapon resistances (one would answer the other's answer). */
const EXCLUSIVE = Object.freeze([['bladeturning', 'stoneskin']]);

/** The traits as a mask, and back - unknown names dropped, an unknown bit dropped. */
export const bossTraitMask = (traits) => (Array.isArray(traits) ? traits : []).reduce((m, id) => { const i = BOSS_TRAITS.indexOf(id); return i >= 0 ? m | (1 << i) : m; }, 0);
export const bossTraitsOfMask = (mask) => (Number.isInteger(mask) && mask > 0 ? BOSS_TRAITS.filter((_, i) => mask & (1 << i)) : []);
/** A foe's traits (its entity's), never null. */
export const bossTraitsOf = (entity) => (Array.isArray(entity?.bossTraits) ? entity.bossTraits : []);
export const hasBossTrait = (entity, id) => bossTraitsOf(entity).includes(id);

/**
 * `n` distinct traits drawn off `roll` (a [0,1) stream - THE ENGINE-PRNG RULE's Math.random for a foe of my own, a seeded
 * stream where every client must draw alike), never two that exclude each other, from `from` (every trait by default).
 * @param {number} n @param {() => number} [roll] @param {readonly string[]} [from]
 */
export function rollBossTraits(n, roll = Math.random, from = BOSS_TRAITS) {
  const pool = [...from];
  const out = [];
  while (out.length < n && pool.length) {
    const id = pool.splice(Math.min(pool.length - 1, Math.floor(roll() * pool.length)), 1)[0];
    out.push(id);
    for (const pair of EXCLUSIVE) if (pair.includes(id)) for (const o of pair) { const k = pool.indexOf(o); if (k >= 0) pool.splice(k, 1); }
  }
  return out;
}

/**
 * Give a foe its traits: `own` the foe's owner (its ward stood whole), else a puppet (its owner keeps the ward). An
 * entity that already has traits keeps them (idempotent - a frame's tag stands a puppet once).
 * @param {any} entity @param {readonly string[]} traits @param {{ own?: boolean }} [o]
 */
export function giveBossTraits(entity, traits, { own = true } = {}) {
  if (!entity || !Array.isArray(traits) || !traits.length || bossTraitsOf(entity).length) return false;
  entity.bossTraits = BOSS_TRAITS.filter((id) => traits.includes(id));
  entity.bossTitle = BOSS_TRAIT_WORDS[entity.bossTraits[0]]?.() ?? '';   // systems/foeTitle.js (a leaf) reads the word
  if (own && entity.bossTraits.includes('warded')) {
    const max = Math.max(1, Math.round((entity.maxHealth || 1) * WARD_SHARE));
    entity.bossWard = { max, now: max, at: -Infinity };
  }
  return entity.bossTraits.length > 0;
}

/** The ward as it stands at `nowS` (s) - grown back since the last blow that touched it - or null for none. */
export function bossWardNow(entity, nowS) {
  const w = entity?.bossWard;
  if (!w) return null;
  const since = nowS - w.at - WARD_REGROW_S;
  const now = since > 0 ? Math.min(w.max, w.now + (w.max * since) / WARD_REFILL_S) : w.now;
  return { now, max: w.max };
}

/** Is a blow a blunt one - a blunt weapon, or none (a fist, a claw)? An arrow is no blunt blow. */
const bluntBlow = (kind, weapon) => kind === 'melee' && (!weapon || weaponSkillUsed(weapon.templateIndex) === SKILLS.BluntWeapon);
/** Is a blow a blade's (any weapon but a blunt one) or an arrow's? */
const bladeBlow = (kind, weapon) => kind === 'arrow' || (kind === 'melee' && !!weapon && weaponSkillUsed(weapon.templateIndex) !== SKILLS.BluntWeapon);

/**
 * THE STRIKER'S HALF: a blow of `damage` on a foe with traits, as the striker's machine lands it - its resistances
 * (the spell's element, the weapon's kind) - and what its thorns send back. A kill (`whole`) is no blow: untouched.
 * @param {any} entity @param {number} damage
 * @param {{ kind?: string, weapon?: any, element?: number|null, whole?: boolean }} [o]
 * @returns {{ damage: number, thorns: number }}
 */
export function bossStrike(entity, damage, { kind = 'melee', weapon = null, element = null, whole = false } = {}) {
  const traits = bossTraitsOf(entity);
  if (!traits.length || whole || !(damage > 0)) return { damage, thorns: 0 };
  let d = damage;
  if (kind === 'spell' && Number.isInteger(element) && traits.includes(ELEMENT_TRAITS[/** @type {number} */ (element)])) d *= RESIST_SHARE;
  if (traits.includes('bladeturning') && bladeBlow(kind, weapon)) d *= WEAPON_RESIST_SHARE;
  if (traits.includes('stoneskin') && bluntBlow(kind, weapon)) d *= WEAPON_RESIST_SHARE;
  const landed = d < damage ? Math.max(1, Math.round(d)) : damage;
  const thorns = traits.includes('thorned') && (kind === 'melee' || kind === 'arrow') ? Math.max(1, Math.round(landed * THORN_SHARE)) : 0;
  return { damage: landed, thorns };
}

/**
 * THE OWNER'S HALF: a blow of `damage` (the striker's half already taken) on a foe of mine with traits - the curb, then
 * the ward - at `nowS` (s); the wrath's clock starts at its first wound. Answers what reaches its health, and what the
 * ward took. A kill (`whole`) is no blow.
 * @param {any} entity @param {number} damage @param {{ whole?: boolean, nowS?: number }} [o]
 * @returns {{ damage: number, ward: number, broke: boolean }}
 */
export function bossTake(entity, damage, { whole = false, nowS = 0 } = {}) {
  const traits = bossTraitsOf(entity);
  if (!traits.length || whole || !(damage > 0)) return { damage, ward: 0, broke: false };
  let d = damage;
  if (traits.includes('curbing')) d = Math.min(d, Math.max(1, Math.round((entity.maxHealth || 1) * CURB_SHARE)));
  if (traits.includes('wrathful') && entity.bossWrathFrom == null) entity.bossWrathFrom = nowS;
  let ward = 0, broke = false;
  const w = bossWardNow(entity, nowS);
  if (w && entity.bossWard) {
    ward = Math.min(w.now, d);
    entity.bossWard.now = w.now - ward;
    entity.bossWard.at = nowS;
    broke = w.now > 0 && entity.bossWard.now <= 0;
    d -= ward;
  }
  return { damage: d, ward, broke };
}

/**
 * THE WRATH: a wrathful foe of mine whose first wound is WRATH_AFTER_S behind `nowS` turns - its blows WRATH_X as hard,
 * once. Answers true on the call it turns (the host says so). A puppet turns on its owner's word (`bw`, `markBossWrath`).
 * @param {any} entity @param {number} nowS
 */
export function bossWrathDue(entity, nowS) {
  if (!entity || entity.bossWrath || !hasBossTrait(entity, 'wrathful') || entity.bossWrathFrom == null) return false;
  if (nowS - entity.bossWrathFrom < WRATH_AFTER_S) return false;
  return markBossWrath(entity);
}
/** Turn a foe wrathful (its blows WRATH_X as hard), once. */
export function markBossWrath(entity) {
  if (!entity || entity.bossWrath) return false;
  entity.bossWrath = true;
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * WRATH_X;
  return true;
}

// ── the words ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Each trait's word, as a title wears it ("Warded Elite Orc"). */
export const BOSS_TRAIT_WORDS = Object.freeze({
  warded: () => t('bossTraits.word.warded', 'Warded'),
  flameproof: () => t('bossTraits.word.flameproof', 'Flameproof'),
  frostproof: () => t('bossTraits.word.frostproof', 'Frostproof'),
  venomproof: () => t('bossTraits.word.venomproof', 'Venomproof'),
  stormproof: () => t('bossTraits.word.stormproof', 'Stormproof'),
  spellproof: () => t('bossTraits.word.spellproof', 'Spellproof'),
  bladeturning: () => t('bossTraits.word.bladeturning', 'Blade-turning'),
  stoneskin: () => t('bossTraits.word.stoneskin', 'Stoneskinned'),
  curbing: () => t('bossTraits.word.curbing', 'Curbing'),
  wrathful: () => t('bossTraits.word.wrathful', 'Wrathful'),
  thorned: () => t('bossTraits.word.thorned', 'Thorned'),
});
/** Each trait's rule, as its tip says it. */
export const BOSS_TRAIT_RULES = Object.freeze({
  warded: () => t('bossTraits.rule.warded', 'A ward takes every blow first. It grows back if you stop hitting it.'),
  flameproof: () => t('bossTraits.rule.flameproof', 'Fire spells do a quarter of their damage.'),
  frostproof: () => t('bossTraits.rule.frostproof', 'Frost spells do a quarter of their damage.'),
  venomproof: () => t('bossTraits.rule.venomproof', 'Poison spells do a quarter of their damage.'),
  stormproof: () => t('bossTraits.rule.stormproof', 'Shock spells do a quarter of their damage.'),
  spellproof: () => t('bossTraits.rule.spellproof', 'Magic spells do a quarter of their damage.'),
  bladeturning: () => t('bossTraits.rule.bladeturning', 'Blades and arrows do half damage. Blunt weapons and fists do full.'),
  stoneskin: () => t('bossTraits.rule.stoneskin', 'Blunt weapons and fists do half damage. Blades do full.'),
  curbing: () => t('bossTraits.rule.curbing', 'No single blow takes more than {pct}% of its health.', { pct: Math.round(CURB_SHARE * 100) }),
  wrathful: () => t('bossTraits.rule.wrathful', 'It hits much harder once the fight has gone on for {s} seconds.', { s: WRATH_AFTER_S }),
  thorned: () => t('bossTraits.rule.thorned', 'Some of every weapon blow that lands comes back at you.'),
});
/** The traits' words, in their order. */
export const bossTraitWords = (entity) => bossTraitsOf(entity).map((id) => BOSS_TRAIT_WORDS[id]?.() ?? id);
/** The traits' rules, in their order. */
export const bossTraitRules = (entity) => bossTraitsOf(entity).map((id) => BOSS_TRAIT_RULES[id]?.() ?? '').filter(Boolean);
/** The lines a host says: a ward broken, a foe turned wrathful. */
export const bossWardBrokeLine = (name) => t('bossTraits.say.wardBroke', 'The ward on {name} breaks!', { name });
export const bossWrathLine = (name) => t('bossTraits.say.wrath', '{name} flies into a rage!', { name });

// ── the doors' one call each (scenes/exteriorFoes.js, scenes/dungeonContext.js damageFoe) ────────────────────────────
/**
 * THE STRIKER'S DOOR: my blow of `damage` on a foe with traits, resisted, and its thorns handed to `thorns` (the
 * host's own hurt of the player). Answers what goes on (to the puppet's owner, or my own foe's owner's half).
 * @param {any} entity @param {number} damage @param {string} kind @param {any} weapon @param {number|null} element
 * @param {boolean} whole @param {((n: number) => void) | null} thorns
 */
export function bossStrikeAt(entity, damage, kind, weapon, element, whole, thorns) {
  const s = bossStrike(entity, damage, { kind, weapon, element, whole });
  if (s.thorns > 0) thorns?.(s.thorns);
  return s.damage;
}
/**
 * THE OWNER'S DOOR: a blow of `damage` on my foe with traits at `nowS` (s) - curbed and warded - its ward's break and
 * its wrath said (`say`, in its `name`). Answers what reaches its health.
 * @param {any} entity @param {number} damage @param {boolean} whole @param {number} nowS
 * @param {((line: string) => void) | null} say @param {() => string} nameOf its name, read only when a line is said
 */
export function bossTakeAt(entity, damage, whole, nowS, say, nameOf) {
  if (!bossTraitsOf(entity).length) return damage;
  const tk = bossTake(entity, damage, { whole, nowS });
  if (tk.broke) say?.(bossWardBrokeLine(nameOf()));
  if (bossWrathDue(entity, nowS)) say?.(bossWrathLine(nameOf()));
  return tk.damage;
}

// ── who carries them ─────────────────────────────────────────────────────────────────────────────────────────────────
/** An elite's one trait: off `seed`'s stream where every client must draw alike (a dungeon's pick - systems/eliteFoes.js
 *  pickDungeonElites `eliteSeed`), else THE ENGINE-PRNG RULE's Math.random (a foe of my own in the open world). */
export function eliteTraits(entity, seed = null) {
  return giveBossTraits(entity, rollBossTraits(1, Number.isSafeInteger(seed) ? eliteRng(seed) : Math.random));
}
/** The relay bosses' traits - the striker's alone (the relay keeps their health: no ward, no curb, no wrath here). */
export const RELAY_BOSS_TRAITS = Object.freeze(['flameproof', 'frostproof', 'venomproof', 'stormproof', 'spellproof', 'bladeturning', 'stoneskin', 'thorned']);
/** A relay boss's two traits, off a stream seeded by its name and kind - the same on every machine. */
export const relayBossTraits = (name, kind) => rollBossTraits(2, eliteRng(eliteHash('relay-boss', name ?? '', kind ?? '')), RELAY_BOSS_TRAITS);
/** The line a relay boss's traits are said in, once when the fight is met. */
export const bossTraitsMetLine = (name, words) => t('bossTraits.say.met', '{name}: {traits}.', { name, traits: words.join(', ') });
