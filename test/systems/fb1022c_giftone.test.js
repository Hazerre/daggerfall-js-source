// FIELD BUGS 2026-10-22c GIFT-ONE (bible/01-Overview/bugs/Field-Bugs-2026-10-22c.md, report 1): PauloHF on the Discord's
// #bug-reports, "[Glitch] Overpowered spells": "This was a shield with 6002 strength, 1600 duration, and AoE (not mine).
// And yes, both shields work" - the buff's card reading "Absorbs 2829 more damage." over "Absorbs 3001 more damage." in one
// bundle, Mega Shield. A party mate's spell carrying one effect twice landed it twice: the tags that keep a mate's bundle
// apart from mine (AUDIT ALLY-CAST C2, effects.js findInc) are stamped at the bundle's tail, so the cast's second Shield
// found its first one untagged, read it as somebody else's and stood a second pool beside it. The caster's own cast of the
// same spell has always merged into one. Driven over the real producers: the spell maker's record, the caster's frame, the
// wire's projection, the receiver's gift, and the receiver's own apply door (hostMagic applySpellToPlayer, as world.js
// online.onCast calls it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomSpell } from '../../src/systems/spell/spellMaker.js';
import { allyCastFrame, allyCastSpell } from '../../src/systems/allyCast.js';
import { validCastData } from '../../src/net/wire.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { applySpell } from '../../src/systems/effects.js';
import { damageShieldPool } from '../../src/characters/playerEntity.js';

// The Shield the report's 3001 is: a level-30 caster's 1 + 100 a level (Shield's magnitude at its spinners' tops)
const SHIELD = { type: 35, subType: 255, settings: { durationBase: 40, durationMod: 52, durationPerLevel: 1, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 100, magnitudeLevelHigh: 100, magnitudePerLevel: 1 } };
const FORTIFY_STR = { type: 9, subType: 0, settings: { durationBase: 10, durationMod: 1, durationPerLevel: 1, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 20 } };
const mkPlayer = () => ({
  isPlayer: true, level: 30, health: 200, maxHealth: 200, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
function receiver(player) {
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5, startCastAnim: null,
  });
}
/** The caster's spell as the gift that reaches me: the frame the caster sends, the wire's projection, the receiver's gift. */
const giftOf = (spell, level) => {
  const frame = validCastData(allyCastFrame(spell, level, 'peer-0002'));
  assert.ok(frame, 'an honest frame passes the wire');
  return { spell: allyCastSpell(frame.spell), level: frame.level };
};
const shields = (p) => p.activeEffects.filter((a) => a.kind === 'shield' && !a.ended);
const forts = (p) => p.activeEffects.filter((a) => a.kind === 'fortifyAttribute' && a.stat === 'strength' && !a.ended);

test('GIFT-ONE: a mate\'s Mega Shield (Shield twice, level 30) lands ONE pool of 3001 - as the caster\'s own cast of it does - never the report\'s two', () => {
  const mega = buildCustomSpell({ slots: [SHIELD, SHIELD], rangeType: 3, name: 'Mega Shield' });
  const gift = giftOf(mega, 30);
  assert.deepEqual(gift.spell.effects.map((e) => e.type), [35, 35], 'both Shields ride the frame');
  const me = mkPlayer();
  receiver(me).applySpellToPlayer(gift.spell, gift.level, null, { allyCast: true });
  assert.deepEqual(shields(me).map((a) => [a.startingShield, a.shieldRemaining, !!a.bundleAlly, a.bundleName]), [[3001, 3001, true, 'Mega Shield']], 'one pool, the mate\'s, of 3001');
  // the caster's own cast of the same record: one pool too (the law the gift now keeps)
  const caster = mkPlayer();
  receiver(caster).applySpellToPlayer(buildCustomSpell({ slots: [SHIELD, SHIELD], rangeType: 0, name: 'Mega Shield' }), 30, null, {});
  assert.deepEqual(shields(caster).map((a) => a.startingShield), [3001]);
  // and the report's numbers: 3001 a pool, so a blow of 172 leaves 2829 - and the next blow past it gets through
  assert.equal(damageShieldPool(me, 172), 0);
  assert.equal(shields(me)[0].shieldRemaining, 2829);
  assert.equal(damageShieldPool(me, 3000), 171, 'the one pool busts and the excess gets through - no second pool behind it');
  assert.equal(shields(me).length, 0);
});

test('GIFT-ONE: three Shields in a gift are one pool; a Fortify twice is one Fortify; my own bundle still stands beside a mate\'s (AUDIT ALLY-CAST C2)', () => {
  const me = mkPlayer();
  const magic = receiver(me);
  const triple = giftOf(buildCustomSpell({ slots: [SHIELD, SHIELD, SHIELD], rangeType: 1, name: 'Triple' }), 30);
  magic.applySpellToPlayer(triple.spell, triple.level, null, { allyCast: true });
  assert.equal(shields(me).length, 1, 'three in one gift merge as the caster\'s own three do');
  const str = giftOf(buildCustomSpell({ slots: [FORTIFY_STR, FORTIFY_STR], rangeType: 1, name: 'Strength' }), 20);
  magic.applySpellToPlayer(str.spell, str.level, null, { allyCast: true });
  assert.deepEqual(forts(me).map((a) => [a.magnitude, !!a.bundleAlly]), [[11, true]], 'one Fortify Strength of 10 + 1 a 20 levels, never two stacked');
  // C2 unchanged: my own Shield, cast first, is never merged into by a mate's
  const mine = mkPlayer();
  const m2 = receiver(mine);
  m2.applySpellToPlayer(buildCustomSpell({ slots: [{ ...SHIELD, settings: { ...SHIELD.settings, magnitudeLevelBase: 1, magnitudeLevelHigh: 1 } }], rangeType: 0, name: 'Mine' }), 30, null, {});
  const g = giftOf(buildCustomSpell({ slots: [SHIELD, SHIELD], rangeType: 1, name: 'Mega Shield' }), 30);
  m2.applySpellToPlayer(g.spell, g.level, null, { allyCast: true });
  assert.deepEqual(shields(mine).map((a) => [a.startingShield, !!a.bundleAlly]), [[31, false], [3001, true]], 'mine beside the mate\'s, the mate\'s one pool');
});

test('GIFT-ONE: a duel opponent\'s bundle keeps the same law - one effect twice is one entry, and never merged into mine', () => {
  const me = mkPlayer();
  const sinks = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} };
  applySpell(buildCustomSpell({ slots: [SHIELD], rangeType: 0, name: 'Mine' }), 1, me, sinks, () => 0.5, { entity: me, sinks }, {});
  applySpell(buildCustomSpell({ slots: [SHIELD, SHIELD], rangeType: 0, name: 'Theirs' }), 30, me, sinks, () => 0.5, null, { duelCast: true, bypassSavingThrows: true });
  assert.deepEqual(shields(me).map((a) => [a.startingShield, !!a.bundleDuel]), [[101, false], [3001, true]]);
});
