// SPELL-HAND and MIXED-PAIR on THE MORROWIND ARM (bible/05-Combat/Two-Hands.md "The spell hand", "A blade and a gun";
// combat/twoHands/spellHandArm.js, combat/twoHands/mixedArm.js, wired by combat/fpArm.js). The fixture arm (mwcast1's: the
// longsword arm whose clips carry the spellcast group and IdleSpell), with the thrown weapons' group appended for the
// Pistolet (its `animateAs` MarksmanThrown - PISTOL-STANCE) and the shipped pistol bound on the left hand:
//   - the spell hand keeps the WEAPON's stance - the weapon in its hand, its left arm the Spell idle's; the cast plays the
//     spellcast group with the weapon still in hand, its right arm the weapon's idle; the stance it latched lets go after;
//   - a blade-and-gun pair's left blow plays in the LEFT weapon's group (a shot's "shoot"), and the arm's own after it; its
//     left arm at rest is its own weapon's idle in the mirror;
//   - the pistol stance's one hand (`only`) - a mixed pair's gun, or one gun beside a spell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY, resolveWeaponParts, resolveOffWeaponParts, archiveHas } from '../../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../../src/formats/morrowind/mwFirstPerson.js';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { writeNif } from '../../tools/nifWrite.mjs';
import { CAST_KEYS } from '../fixtures/mw/castClip.mjs';
import { createHeldClips, spellHandLimbs, SPELL_HAND_ARM } from '../../src/combat/twoHands/spellHandArm.js';
import { gunArmOf, blowTypeOf, gunHoldOf } from '../../src/combat/twoHands/mixedArm.js';
import { pistolStanceRequest } from '../../src/combat/gun/pistolStance.js';
import { OWN_MW_MODELS } from '../../src/characters/ownModels/ownWeaponModels.js';
import { PISTOLET_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { assembleFirstPersonArm, poseAssembly } from '../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { retailBodyDeps, shippedArchive, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`../fixtures/mw/${n}`, import.meta.url)));
const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const GUN = Object.freeze({ templateIndex: PISTOLET_TEMPLATE, group: 'Weapons', material: 4 });

/** The thrown weapons' group and its idle - the Pistolet's borrowed stance - appended past CAST_KEYS. */
const THROW_KEYS = Object.freeze([
  [10.6, 'ThrowWeapon: Equip Start'], [10.7, 'ThrowWeapon: Equip Attach'], [10.8, 'ThrowWeapon: Equip Stop'],
  [10.9, 'ThrowWeapon: Unequip Start'], [11.0, 'ThrowWeapon: Unequip Detach'], [11.1, 'ThrowWeapon: Unequip Stop'],
  [11.2, 'ThrowWeapon: Shoot Start'], [11.3, 'ThrowWeapon: Shoot Min Attack'], [11.4, 'ThrowWeapon: Shoot Max Attack'],
  [11.5, 'ThrowWeapon: Shoot Release'], [11.6, 'ThrowWeapon: Shoot Follow Start'], [11.7, 'ThrowWeapon: Shoot Follow Stop'],
  [11.8, 'Idle1t: Start'], [11.9, 'Idle1t: Stop'],
]);
function armClip() {
  const nif = parseNif(f('armfpweapon.kf'));
  const records = nif.records.map((r) => ({ ...r }));
  const tk = records.find((r) => r.type === 'NiTextKeyExtraData');
  tk.keys = [...tk.keys, ...[...CAST_KEYS, ...THROW_KEYS].map(([time, text]) => ({ time, text }))];
  return writeNif(records, nif.roots);
}
const wpdtRec = (id, model, type, speed = 1) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  const dv = new DataView(w.buffer);
  dv.setInt16(8, type, true);
  dv.setFloat32(12, speed, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
const fakeRenderer = () => ({ gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1 });

/** The longsword arm, its clips carrying the spellcast and thrown groups, the shipped pistol in its archive; drawn. */
async function arm() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, new Uint8Array(armClip())],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
    [`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')],
  ]);
  const weap = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand);
  const a = createFpArm();
  a.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
  const res = await a.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  a.setSheathed(false);
  for (let i = 0; i < 400 && a.status().upper !== UPPER_BODY.WeaponEquipped; i++) a.update(0.05);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  return { a, deps };
}
const run = (a, s, each = null) => { for (let t = 0; t < s; t += 0.05) { each?.(); a.update(0.05); } };

test('SPELL-HAND THE ARM\'S LIMBS (spellHandArm.js): the cast lends the RIGHT arm the weapon\'s idle, a readied spell the LEFT arm the Spell idle - each its own side, copied; nothing to compose without its clip; the held clip loops on its own clock (mutants: the arms swapped; an arm mirrored; the clock frozen)', () => {
  const w = { tracks: 'w' }, sp = { tracks: 's' };
  assert.deepEqual(SPELL_HAND_ARM, { spell: 'L', weapon: 'R' });
  assert.deepEqual(spellHandLimbs({ casting: true, ready: true, weaponIdle: w, spellIdle: sp }), { limbs: { R: { clip: w, side: 'R', mirror: false } }, key: 'spellhand:cast' });
  assert.deepEqual(spellHandLimbs({ ready: true, weaponIdle: w, spellIdle: sp }), { limbs: { L: { clip: sp, side: 'L', mirror: false } }, key: 'spellhand:ready' });
  assert.equal(spellHandLimbs({ casting: true, weaponIdle: null }), null);
  assert.equal(spellHandLimbs({ ready: true, spellIdle: null }), null);
  assert.equal(spellHandLimbs({}), null);
  const stepped = [];
  const held = createHeldClips({ pick: (r, g) => (g === 'none' ? null : { state: { time: 1 }, source: { keys: [], trackMap: `${g}-tracks` } }), step: (s, k, dt) => { s.time += dt; stepped.push(dt); }, sampleTrack: 'S' });
  const r = { sources: [] };
  assert.deepEqual(held.clip(r, 'idlespell', 0), { tracks: 'idlespell-tracks', sampleTrack: 'S', time: 1 });
  assert.equal(held.clip(r, 'idlespell', 0.25).time, 1.25, 'advanced on its own clock');
  assert.equal(held.clip(r, 'none', 0.1), null, 'a rig without the group: nothing');
  assert.equal(held.clip({ sources: [] }, 'idlespell', 0).time, 1, 'a new rig its own clock');
});

test('SPELL-HAND THE LIVE ARM: with the spell in the free hand the arm keeps the WEAPON\'s stance - the weapon in hand, its group the weapon\'s, its left arm the Spell idle - and still swings; the cast plays the spellcast group with the weapon in hand, its right arm the weapon\'s idle; the stance the cast latched lets go when it ends; without the spell hand Morrowind\'s own Spell stance (mutants: readySpell\'s spell-hand door; weaponInHand\'s; the cast\'s latch kept; the compositions\' keys)', async () => {
  const { a } = await arm();
  a.setSpellHand(true);
  a.readySpell(true);
  run(a, 0.3);
  let s = a.status();
  assert.equal(s.spellReady, false, 'the weapon\'s stance stands');
  assert.equal(s.weaponInHand, true, 'the weapon in its hand');
  assert.equal(s.weaponGroup, 'weapononehand');
  assert.equal(a.handsState().composed, 'spellhand:ready', 'the left arm the Spell idle\'s');
  assert.ok(a.attack('StrikeDown'), 'the weapon still swings with the spell readied');
  run(a, 2);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(a.castSpell(2), true, 'the cast');
  run(a, 0.1, () => { a.setSpellHand(true); a.readySpell(true); });
  s = a.status();
  assert.equal(s.casting, true);
  assert.equal(s.weaponInHand, true, 'the weapon stays in hand through the cast');
  assert.equal(a.handsState().composed, 'spellhand:cast', 'the right arm the weapon\'s idle');
  // the spell goes at its release (Daggerfall clears the ready) - the cast plays out, and the stance it latched lets go IN
  // THE STEP the cast ends (never a frame of the Spell stance between)
  let ended = null;
  for (let t = 0; t < 3 && !ended; t += 0.05) { a.setSpellHand(true); a.readySpell(false); a.update(0.05); if (!a.status().casting) ended = a.status(); }
  assert.ok(ended, 'the cast ended');
  assert.equal(ended.spellReady, false, 'the cast\'s latch let go as it ended');
  assert.equal(ended.weaponGroup, 'weapononehand');
  // without the spell hand: Morrowind's own Spell stance, the weapon out of the hand
  a.setSpellHand(false);
  a.readySpell(true);
  run(a, 0.3);
  s = a.status();
  assert.equal(s.spellReady, true);
  assert.equal(s.weaponInHand, false, 'MW-CAST1: the casting hands are empty');
  // ...and the spell hand coming up over that stance (the weapon drawn with a spell readied) takes the weapon's back
  a.setSpellHand(true);
  a.readySpell(true);
  s = a.status();
  assert.equal(s.spellReady, false, 'the Spell stance let go for the spell hand');
  assert.equal(s.weaponGroup, 'weapononehand');
  assert.equal(s.weaponInHand, true);
  a.unload();
});

test('MIXED-PAIR THE ARM\'S LAW (mixedArm.js): gunArmOf names the gun\'s arm beside a blade - never two blades, two guns, one weapon or a single hand; a left blow of the other kind plays the left weapon\'s type; the gun stance holds the gun\'s hand alone in a mixed pair, both hands in a gun pair, and one gun with its free hand placed - or left to a spell (mutants: each arm of gunHoldOf; blowTypeOf for the right hand)', () => {
  const blade = { holdAs: null, type: MW_WEAPON_TYPE.LongBladeOneHand }, gun = { holdAs: 'pistol', type: MW_WEAPON_TYPE.MarksmanThrown };
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: gun }), 'L');
  assert.equal(gunArmOf({ dual: true, weapon: gun, offWeapon: blade }), 'R');
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: { ...blade } }), null);
  assert.equal(gunArmOf({ dual: true, weapon: gun, offWeapon: { ...gun } }), null);
  assert.equal(gunArmOf({ dual: false, weapon: blade, offWeapon: gun }), null, 'one hand in use');
  assert.equal(gunArmOf({ dual: true, weapon: blade, offWeapon: null }), null);
  assert.equal(blowTypeOf({ gunArm: 'L', hand: 'L', offType: gun.type }), gun.type);
  assert.equal(blowTypeOf({ gunArm: 'R', hand: 'L', offType: blade.type }), blade.type);
  assert.equal(blowTypeOf({ gunArm: 'L', hand: 'R', offType: gun.type }), null, 'the right hand\'s blow is the arm\'s own');
  assert.equal(blowTypeOf({ gunArm: null, hand: 'L', offType: gun.type }), null, 'a blade pair keeps the mirror of the right\'s');
  assert.deepEqual(gunHoldOf({ weapon: blade, offWeapon: gun, dual: true, offShown: true }), { row: gun, pair: false, only: 'L' });
  assert.deepEqual(gunHoldOf({ weapon: gun, offWeapon: blade, dual: true, offShown: true }), { row: gun, pair: false, only: 'R' });
  assert.deepEqual(gunHoldOf({ weapon: gun, offWeapon: { ...gun }, dual: true, offShown: true }), { row: gun, pair: true, only: null });
  assert.deepEqual(gunHoldOf({ weapon: gun }), { row: gun, pair: false, only: null }, 'one gun: its free hand placed');
  assert.deepEqual(gunHoldOf({ weapon: gun, spellHand: true }), { row: gun, pair: false, only: 'R' }, 'beside a spell: the free hand the spell\'s');
  assert.equal(gunHoldOf({ weapon: blade }), null);
  assert.equal(gunHoldOf({ weapon: blade, offWeapon: gun, dual: true, offShown: false }), null, 'the left gun not shown: no hold');
});

test('MIXED-PAIR THE PISTOL STANCE\'S ONE HAND (`only`): the gun hand alone - the right on Weapon Bone, the left on Weapon Bone Left in the single stance\'s mirror - the other hand left to what holds it; the default keeps the pair\'s two and the single\'s free hand (mutants: `only` unread; the left gun on the right\'s bone)', async () => {
  // retail's bones in the steel plate, a pistol in each hand (pistolstance.test.js's own assembly), posed at rest
  const skeletonBytes = retailSkeleton();
  const files = new Map([[`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const find = (p) => (arc.has(p) ? arc : null), has = archiveHas([arc]);
  const res = resolveWeaponParts({ weapon: GUN, hasAmmo: true, allWeapons: [], find, skeletonBytes, has });
  const off = resolveOffWeaponParts({ weapon: GUN, allWeapons: [], find, skeletonBytes, has, hasBone: () => true });
  const worn = composeWornArmor({ pieces: [102, 103, 104, 105, 106, 107, 108].map((t) => ({ templateIndex: t, material: 0x201 })), armors: [], bodyPool: [] });
  const parts = [...worn.adds.map((x) => ({ slot: x.slot, partName: x.partName, bones: x.bones, bytes: onDisk(`src/assets/mw/meshes/${x.model}`) })), ...res.parts, ...off.parts];
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts, offWeaponBone: true });
  assert.ok(asm.ok, asm.error);
  poseAssembly(asm, {});
  const mats = asm.mats;
  const keys = (req) => Object.keys(req?.hands ?? {}).sort().join('');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, {})), 'LR', 'one gun: the gun hand and the free hand');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { pair: true })), 'LR', 'a pair: both on their guns');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { only: 'R' })), 'R', 'the right gun alone');
  assert.equal(keys(pistolStanceRequest(asm.skeleton, mats, { only: 'L' })), 'L', 'the left gun alone');
  const both = pistolStanceRequest(asm.skeleton, mats, { pair: false }), left = pistolStanceRequest(asm.skeleton, mats, { only: 'L' });
  assert.notDeepEqual(left.hands.L.at, both.hands.L.at, 'the left gun\'s hand is on its gun, not the free hand\'s place');
});

test('MIXED-PAIR THE LIVE ARM, A BLADE AND THE PISTOLET: the left hand\'s blow plays in ITS weapon\'s group - a shot\'s "shoot" in the thrown group - and the arm\'s own group is the blade\'s again after it; at rest the left arm holds its own weapon\'s idle in the mirror (mutants: the blow in the right\'s group; the group kept after the blow; the left arm the right weapon\'s mirror)', async () => {
  const { a } = await arm();
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true, 'the pistol on the left hand');
  run(a, 0.3);
  assert.equal(a.handsState().composed, 'dual:mixed', 'the left arm its own weapon\'s idle');
  assert.equal(a.attack('StrikeDown', { hand: 'L' }), 'shoot', 'the left hand shoots');
  assert.equal(a.status().weaponGroup, 'throwweapon', 'in the thrown group');
  run(a, 3);
  assert.equal(a.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(a.status().weaponGroup, 'weapononehand', 'the blade\'s group again');
  assert.notEqual(a.attack('StrikeDown', { hand: 'R' }), 'shoot', 'the right hand swings its blade');
  assert.equal(a.status().weaponGroup, 'weapononehand');
  a.unload();
});

test('MIXED-PAIR THE BODY ON RETAIL\'S BONES (third person): a longsword in the right hand and the Pistolet in the left - the gun\'s hold comes on for the LEFT hand alone, on its own pistol, and the right arm is left to its blade (never solved onto a gun); sheathed, the hold goes (mutants: the hold for a gun in the right only; the stance\'s one hand not handed on)', async () => {
  const kf = new Uint8Array(armClip());
  const weap = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand);
  const deps = retailBodyDeps({ records: [weap], files: [[FP_CLIP_PATH, kf], ['meshes/xbase_anim.kf', kf], ['meshes/w/blade.nif', f('weapon.nif')]], before: [shippedArchive(['meshes/pistolet.nif', 'textures/pistolet.dds'])] });
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  renderer.renderCharacterSpriteImage = () => ({});
  const a = createFpArm();
  const cam = { pos: [0, 1.6, 0], yaw: 0, move: { forward: 0, strafe: 0, speed: 0, running: false } };
  a.attach(renderer, () => cam);
  const built = await a.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  assert.equal(built.third?.ok, true, 'the body stands');
  assert.equal(a.setViewMode('third'), true);
  a.setSheathed(false);
  a.setHands({ mode: 'dual', lead: 'R' });
  assert.equal(await a.setOffWeapon(GUN), true, 'the pistol on the left hand');
  for (let i = 0; i < 90; i++) a.update(1 / 30);
  assert.ok(a.rifleState().w > 0.99, `the left gun held (${a.rifleState().w})`);
  const t = a.built().third.arm;
  assert.ok(t.holdFit && t.holdFit.reach.L < 0.05, `the left hand on its pistol (${t.holdFit?.reach?.L})`);
  assert.equal(t.holdFit.reach.R, null, 'the right arm left to its blade');
  a.setSheathed(true);
  for (let i = 0; i < 60; i++) a.update(1 / 30);
  assert.equal(a.rifleState().w, 0, 'sheathed: the hold off');
  a.unload();
});
