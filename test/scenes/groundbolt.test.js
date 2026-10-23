// GROUND-BOLT (FIELD BUGS 2026-10-23b; the owner: "spells cast at the ground outdoors don't collide with it at all and
// sail straight through"). The world and fixed-city hosts handed the cast engine a collider proxy carrying `raycast`
// alone - the MESH ray - and outdoors the ground is not a mesh (player/collider.js surfaceHit's note), so a missile met
// the buildings and never the terrain. The hosts hand `liveCollider` now (its ground with its ray), and the flight
// asks `rayHit` (the mesh ray AND the terrain - combat/techniques.js, AUDIT TECH1). Driven here through a REAL
// Collider whose ground is a heightAt sampler and which holds no mesh at all: what the streamed world's open
// ground is to the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic, liveCollider } from '../../src/scenes/hostMagic.js';
import { Collider } from '../../src/player/collider.js';
import { MISSILE_SPEED } from '../../src/systems/spellcast.js';

const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const spellOf = (rangeType) => ({ name: 'Test Spell', index: 90, element: 0, rangeType, effects: [damageEffect()] });
const mkPlayer = () => ({
  isPlayer: true, level: 1, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
const mkFoe = (x, z) => ({
  dead: false, ai: { feet: [x, 0, z] },
  entity: { level: 1, health: 400, maxHealth: 400, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] },
});

/** The engine over `ground` (a heightAt sampler) through the hosts' own door, liveCollider. */
function rig(ground, foes = []) {
  const player = mkPlayer();
  const world = { foeHurt: new Map(), hurt: 0 };
  const col = new Collider(ground);
  const sinks = { heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord: () => {}, uploadRecordFrame: () => {},
    collider: liveCollider(() => col),
    playerEntity: player,
    playerSinks: { ...sinks, hurt: (n) => { world.hurt += n; player.health -= n; }, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => foes,
    foeSinks: (f) => ({ ...sinks, hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); f.entity.health -= n; } }),
    absorbCtx: () => ({ inside: false, day: true }),
    rolls: () => 0.99,
  });
  return { magic, world, player };
}
const fly = (magic, feet, frames) => { for (let i = 0; i < frames && magic.missileCount() > 0; i++) magic.update(0.05, feet); };
const FLAT = () => 0;

test('GROUND-BOLT: a Fireball cast at the open ground bursts ON it - the blast reaches a foe beside the crater', () => {
  // From the eye at 1.6 m, 0.6 down for 0.8 along: the ground is met 2.67 m out, at z = 2.13 - three frames' flight.
  // The foe stands 3.4 m past it, inside the 4 m blast and nowhere near the line (the missile under it at -2.2 m).
  const foe = mkFoe(0, 5.5);
  const { magic, world } = rig(FLAT, [foe]);
  magic.setReadied(spellOf(4));
  assert.equal(magic.castInput([0, 1.6, 0], [0, -0.6, 0.8]), true, 'the cast left');
  assert.equal(magic.missileCount(), 1);
  fly(magic, [0, 0, -20], 6);
  assert.equal(magic.missileCount(), 0, 'it met the ground within its first frames - not its lifespan');
  assert.ok(world.foeHurt.get(foe) > 0, 'the burst was where it struck the ground, and reached the foe');
});

test('GROUND-BOLT: a bolt flown LEVEL into a rising hillside stops on it - the march meets a rise, not only a fall', () => {
  // collider.surfaceHit meets the ground only on the way DOWN; a level shot into a slope is rayHit's march.
  const hill = (x, z) => (z > 3 ? z - 3 : 0);   // a 45-degree rise from z = 3: met at z = 4.6
  const { magic } = rig(hill);
  magic.setReadied(spellOf(2));
  assert.equal(magic.castInput([0, 1.6, 0], [0, 0, 1]), true);
  const frames = Math.ceil(4.6 / (MISSILE_SPEED * 0.05)) + 1;
  fly(magic, [0, 0, -20], frames);
  assert.equal(magic.missileCount(), 0, `it stopped on the hillside within ${frames} frames`);
});

test('GROUND-BOLT: a bolt with nothing before it still flies - the ground is met where it is, not everywhere', () => {
  const { magic } = rig(FLAT);
  magic.setReadied(spellOf(2));
  assert.equal(magic.castInput([0, 1.6, 0], [0, 0.6, 0.8]), true, 'up and away');
  fly(magic, [0, 0, -20], 6);
  assert.equal(magic.missileCount(), 1, 'still in the air');
});

test('GROUND-BOLT: a FOE\'s Fireball at my feet bursts on the ground beside me - the enemy arm flies the same ray', () => {
  // Thrown from 8 m off, down at the ground 2 m short of me: before, it passed under me and on.
  const caster = mkFoe(0, 8);
  const { magic, world } = rig(FLAT);
  const from = [0, 1.6, 8], to = [0, 0, 2], d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  magic.fireEnemyMissile(from, [(to[0] - from[0]) / d, (to[1] - from[1]) / d, (to[2] - from[2]) / d], spellOf(4), 1, caster);
  fly(magic, [0, 0, 0], 10);
  assert.equal(magic.missileCount(), 0, 'it met the ground');
  assert.ok(world.hurt > 0, 'its blast caught me beside the crater');
});

test('GROUND-BOLT: liveCollider asks the live collider at each call - the ground follows the door the player walks through', () => {
  const outdoor = new Collider((x, z) => 2 + x * 0 + z * 0), indoor = new Collider(() => -Infinity);
  let here = outdoor;
  const c = liveCollider(() => here);
  assert.equal(c.heightAt(1, 1), 2, 'the street\'s ground');
  assert.equal(c.surfaceAt(1, 1), 2, 'a collider with no drawn ground answers its sampler');
  assert.equal(c.surfaceHit([0, 5, 0], [0, -1, 0], 10).dist, 3, 'and the ground under a point');
  here = indoor;
  assert.equal(c.heightAt(1, 1), -Infinity, 'indoors: no ground but the meshes');
  assert.equal(c.raycast([0, 5, 0], [0, -1, 0], 10), Infinity, 'and the ray is the room\'s');
});

test('GROUND-BOLT: both exterior hosts hand the engine liveCollider, never a bare raycast proxy', () => {
  for (const f of ['scenes/world.js', 'scenes/exterior.js']) {
    const s = src(f);
    assert.ok(s.includes("collider: liveCollider(() => ((modes?.mode === 'interior' && modes?.interiorCollider) ? modes?.interiorCollider : collider)),"), `${f}: the engine's collider carries the ground`);
    assert.ok(!s.includes('collider: { raycast: (o, d, m) => ((modes?.mode'), `${f}: the mesh-only proxy is gone`);
  }
});
