// FIELD BUGS 2026-10-21 (a player's CPU profile online: the Come Sail Away pool's frame 11% of the frame, 6% with the
// peers' boats not loaded - scenes/comeSailAway/comeSailAwayPool.js frame -> walkBoat, lateUpdateHolder, syncFlats - and
// rendererModelKey, through partKey, 2.6%, the key made again most frames; bible/07-Rendering/Performance-Priority.md
// BOAT-STAMP and BOAT-FAR).
//
// BOAT-STAMP: EACH TREE ITS OWN SHAPE STAMP (world/prefabNode.js prefabShapeStamp) - a boat built, re-dressed or fitted
// anywhere made every boat's plan, bones, still chains, Animators and colliders again the next frame, because the stamp
// was one count for every tree in the game. BOAT-FAR: A FAR BOAT LIVES BY NAVALHOST'S LAW (scenes/comeSailAway/
// farLife.js) - walked, baked and lit one frame in FAR_LIFE_EVERY past NEAR_LIFE_M on the time she missed, her last
// walk held for the flats and the draw and carried to where she stands; and a peer's boat's Animators by the same law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool, STILL_FRAMES } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { NEAR_LIFE_M, FAR_LIFE_EVERY, farLife, farLifeStep } from '../../../src/scenes/comeSailAway/farLife.js';
import * as navalHost from '../../../src/scenes/naval/navalHost.js';
import { Boat, boatAnimators, setLights } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { collidersOf } from '../../../src/world/prefabColliders.js';
import { freshPool } from '../../navalSea.mjs';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const standInPipeline = () => ({ textureFiles: { get: () => texture() }, cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) });
const settle = () => new Promise((r) => setTimeout(r, 5));

/** A pool over a renderer that records each draw (its mesh and matrix) and each flat it stands. */
async function recordingPool() {
  const log = { drawn: [], flats: [] };
  const renderer = {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }),
    drawMesh: (mesh, matrix) => log.drawn.push({ mesh, matrix }), updateMeshVertices() {},
    createBillboardBatch: (a, rec, size) => { const b = { a, rec, size }; log.flats.push(b); return b; }, destroyBillboardBatch() {}, destroyMesh() {},
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return { pool, log };
}
/** How often each boat's root's children are read while `fn` runs - a walk of her reads them, nothing else the frame
 *  and the draw do (AUDIT PRE-MERGE 0928 R5's own count). */
function childReads(boats, fn) {
  const reads = new Map(boats.map((b) => [b, 0]));
  const kids = new Map(boats.map((b) => [b, b.GameObject.children]));
  for (const b of boats) Object.defineProperty(b.GameObject, 'children', { configurable: true, get() { reads.set(b, reads.get(b) + 1); return kids.get(b); } });
  try { fn(); } finally { for (const b of boats) { delete b.GameObject.children; b.GameObject.children = kids.get(b); } }
  return reads;
}
const bonesOf = (b) => [...b.GameObject.walk()].flatMap((n) => n.getComponents('FixDeformations')).map((f) => f.bakedMesh?.bones).filter(Boolean);
const near = (a, b, eps = 1e-3) => a.length === b.length && [...a].every((v, i) => Math.abs(v - b[i]) < eps);

test('BOAT-STAMP: a boat built, re-dressed, reshaped or given a component makes her own plan, Animators and colliders again and no other boat\'s - each tree its own shape stamp (mutants: one stamp for every tree; the tree a node left, or the one it joined, unstamped)', async () => {
  const { pool } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const sea = [HULL.SmallShip, HULL.LargeGalley, HULL.Carrack].map((h, i) => { const b = pool.spawnSeaNow(new Boat(h, 0)); b.GameObject.position = [i * 60, 0, -80]; return b; });
  const peer = pool.spawnPeerNow(new Boat(HULL.LargeBoat, 0));
  peer.GameObject.position = [0, 0, 80];
  const all = [...sea, peer];
  const frame = async () => { pool.frame(1 / 60, world); pool.draw(); await settle(); };
  for (let i = 0; i < 30; i++) await frame();
  const kept = () => new Map(all.map((b) => [b, { plan: pool.walkOf(b).plan, animators: boatAnimators(b), bones: bonesOf(b) }]));
  for (const b of all) collidersOf(b.GameObject);   // each tree's colliders indexed
  /** After `fn` and a frame: the boats in `moved` have made theirs again, every other keeps what it had. */
  const only = async (what, moved, fn) => {
    const had = kept();
    fn();
    for (let i = 0; i < 8; i++) await frame();   // past every sail's tick (a holder finds its bones again only when it bakes)
    const reads = childReads(all, () => { for (const b of all) collidersOf(b.GameObject); });
    for (const b of all) {
      const was = had.get(b), now = pool.walkOf(b).plan;
      if (moved.includes(b)) {
        assert.notEqual(now, was.plan, `${what}: her own plan made again`);
        assert.ok(reads.get(b) > 0, `${what}: her colliders indexed again`);
        continue;
      }
      assert.equal(now, was.plan, `${what}: hull ${b.hull}'s plan kept - no model key of hers made again`);
      assert.equal(boatAnimators(b), was.animators, `${what}: hull ${b.hull}'s Animators kept`);
      assert.deepEqual(bonesOf(b).map((x, i) => x === was.bones[i]), was.bones.map(() => true), `${what}: hull ${b.hull}'s bones kept`);
      assert.equal(reads.get(b), 0, `${what}: hull ${b.hull}'s colliders not indexed again`);
    }
  };
  assert.ok(bonesOf(sea[0]).length > 0, 'her sails baked, their bones found');
  let built = null;
  await only('a sea ship built elsewhere', [], () => { built = pool.spawnSeaNow(new Boat(HULL.Rowboat, 0)); built.GameObject.position = [500, 0, 500]; });
  await only('a tree built anywhere', [], () => { new PrefabNode('Elsewhere').setParent(new PrefabNode('OtherTree')); });
  await only('a peer\'s boat re-dressed', [peer], () => pool.setVariant(peer, 2));
  const hung = new PrefabNode('BoatStampProbe');
  await only('a node hung under one', [sea[0]], () => hung.setParent(sea[0].MeshObject));
  await only('the node taken out of her', [sea[0]], () => hung.setParent(null));
  await only('a node of one hung under another', [sea[1], sea[2]], () => hung.setParent(sea[1].MeshObject).setParent(sea[2].MeshObject));
  await only('a component added to one', [sea[1]], () => sea[1].MeshObject.addComponent({ type: 'BoatStampProbe' }));
  pool.remove(built);
});

/** Each frame's walks, timers and draws of the boats while `steps` frames run. */
async function watched(pool, log, boats, steps, world, each = () => {}) {
  const frames = [];
  for (let f = 0; f < steps; f++) {
    each(f);
    const timers = (b) => ({ lantern: b.Lights[0]?.node.getComponent('DungeonLightHandler').timer, holder: holderOf(b)?.timer });
    const before = new Map(boats.map((b) => [b, timers(b)]));
    log.drawn.length = 0;
    const reads = childReads(boats, () => { pool.frame(1 / 60, world); pool.draw(); });
    frames.push({ reads, before, after: new Map(boats.map((b) => [b, timers(b)])), drawn: [...log.drawn] });
    await settle();
  }
  return frames;
}
/** A sail's holder of hers (a FixDeformations on its timer, not an every-frame rope). */
const holderOf = (b) => [...b.GameObject.walk()].flatMap((n) => n.getComponents('FixDeformations')).find((f) => !f.everyFrame && f.skinnedMeshRenderer) ?? null;
/** One step of a timer the frame ran on `dt`: Math.fround's sum, or back to nought where it ran over. */
const stepped = (t0, t1, dt) => t1 === 0 || Math.abs(t1 - t0 - dt) < 1e-5;

test(`BOAT-FAR: past NEAR_LIFE_M a boat is walked, her sails baked and her lanterns decided one frame in FAR_LIFE_EVERY on the time she missed, each boat on her own frame of the stride; a near one every frame; between, her last walk is the flats' and the draw's - never walked again - her still batch drawn at her hull's matrix as it stands and every other part and flat where she stands now, a move between the frame and its draw included (mutants: the far law unread; the bake's or the lanterns' missed time dropped; the held walk walked again; held matrices unshifted; shifted by her root's move, not her hull's; her batch at the held hull; the shift kept past a move)`, async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const nearBoat = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); nearBoat.GameObject.position = [0, 0, -50];
  const far = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); far.GameObject.position = [0, 0, -1000];
  const far2 = pool.spawnSeaNow(new Boat(HULL.LargeGalley, 0)); far2.GameObject.position = [400, 0, -1500];
  setLights(nearBoat, true); setLights(far, true);
  const boats = [nearBoat, far, far2];
  assert.ok(far.Lights.length && holderOf(far), 'she carries lanterns and sails');
  for (let i = 0; i < STILL_FRAMES * 2; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  assert.ok(pool.stillOf(far), 'her still parts merged');
  // she sails on and rolls further as she goes, every frame
  const sail = (f) => {
    const p = far.GameObject.position;
    far.GameObject.position = [p[0] + 0.5, p[1], p[2]];
    const a = 0.01 * f;
    far.MeshObject.localRotation = [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
  };
  const frames = await watched(pool, log, boats, FAR_LIFE_EVERY * 3, world, sail);
  const walked = (b) => frames.map((fr, f) => (fr.reads.get(b) > 0 ? f : -1)).filter((f) => f >= 0);
  assert.equal(walked(nearBoat).length, frames.length, 'near: walked every frame');
  for (const b of [far, far2]) {
    const on = walked(b);
    assert.equal(on.length, 3, `hull ${b.hull} far: one frame in ${FAR_LIFE_EVERY} (${on})`);
    assert.ok(on.every((f, i) => i === 0 || f - on[i - 1] === FAR_LIFE_EVERY), 'on her stride');
  }
  assert.notEqual(walked(far)[0], walked(far2)[0], 'each far boat on her own frame of the stride');
  for (let f = 0; f < frames.length; f++) {
    const { before, after, reads } = frames[f];
    const n0 = before.get(nearBoat), n1 = after.get(nearBoat);
    assert.ok(stepped(n0.lantern, n1.lantern, 1 / 60) && stepped(n0.holder, n1.holder, 1 / 60), `near (${f}): her lanterns and sails on this frame's time`);
    const f0 = before.get(far), f1 = after.get(far);
    if (reads.get(far) > 0) {
      assert.ok(stepped(f0.lantern, f1.lantern, FAR_LIFE_EVERY / 60), `far (${f}): her lanterns on the time she missed (${f0.lantern} -> ${f1.lantern})`);
      assert.ok(stepped(f0.holder, f1.holder, FAR_LIFE_EVERY / 60), `far (${f}): her sails on the time she missed (${f0.holder} -> ${f1.holder})`);
    } else assert.deepEqual(f1, f0, `far (${f}): held - her lanterns and sails as they were`);
  }
  // held: what is drawn of her and her flats stand where she is now
  let last = null;
  for (let i = 0; i < FAR_LIFE_EVERY && !last; i++) {
    const [fr] = await watched(pool, log, [far], 1, world, () => sail(frames.length + i));
    if (!(fr.reads.get(far) > 0)) last = fr;
  }
  assert.ok(last, 'a frame that held her');
  const w = pool.walkOf(far), still = pool.stillOf(far);
  const hers = (d) => Math.hypot(d.matrix[12] - far.GameObject.position[0], d.matrix[14] - far.GameObject.position[2]) < 150;
  const drawnOfHers = last.drawn.filter(hers);
  const batch = drawnOfHers.filter((d) => d.mesh === still.mesh);
  assert.equal(batch.length, 1, 'her batch drawn once');
  assert.ok([...batch[0].matrix].every((v, i) => Object.is(v, far.MeshObject.worldMatrix()[i])), 'at her hull\'s matrix as it stands now, to the bit');
  const fresh = w.nodes.map((n) => n.worldMatrix());
  const parts = drawnOfHers.filter((d) => d.mesh !== still.mesh);
  assert.ok(parts.length > 0, 'parts of hers drawn on their own');
  for (const d of parts) assert.ok(fresh.some((m) => near(d.matrix, m)), 'each where its node stands now');
  const flatsOfHers = pool.batches().filter((b) => Math.hypot(b.origin[0] - far.GameObject.position[0], b.origin[2] - far.GameObject.position[2]) < 150);
  assert.ok(flatsOfHers.length > 0, 'her flats stand');
  const flatNodes = w.plan.flats.map((e) => e.node.worldMatrix());
  for (const b of flatsOfHers) assert.ok(flatNodes.some((m) => near([b.origin[0], b.origin[1] + b.size.h / 2, b.origin[2]], [m[12], m[13], m[14]])), 'each flat where its node stands now');
  // moved between a frame that held her and its draw: the draw stands her where she is at the draw, batch and parts alike
  let between = false;
  for (let i = 0; i < FAR_LIFE_EVERY && !between; i++) {
    const reads = childReads([far], () => pool.frame(1 / 60, world));
    if (reads.get(far) > 0) { pool.draw(); await settle(); continue; }
    between = true;
    sail(frames.length + FAR_LIFE_EVERY + i);
    log.drawn.length = 0;
    pool.draw();
    const now = log.drawn.filter(hers), hull = far.MeshObject.worldMatrix(), nodesNow = pool.walkOf(far).nodes.map((n) => n.worldMatrix());
    assert.ok(now.some((d) => d.mesh === still.mesh && [...d.matrix].every((v, k) => Object.is(v, hull[k]))), 'her batch at her hull as she stands at the draw');
    for (const d of now.filter((x) => x.mesh !== still.mesh)) assert.ok(nodesNow.some((m) => near(d.matrix, m)), 'every other part with it');
    await settle();
  }
  assert.ok(between, 'a frame that held her, and a move before its draw');
  // reshaped while far (a fitting stood, a part hung): walked that frame, her range whatever
  const afterWalk = await watched(pool, log, [far], FAR_LIFE_EVERY, world);
  const at = afterWalk.findIndex((fr) => fr.reads.get(far) > 0);
  assert.ok(at >= 0 && at < FAR_LIFE_EVERY, 'walked on her stride');
  const probe = new PrefabNode('BoatFarProbe');
  const reshaped = await watched(pool, log, [far], 1, world, () => probe.setParent(far.MeshObject));
  assert.ok(reshaped[0].reads.get(far) > 0, 'reshaped: walked the next frame');
  assert.ok(pool.walkOf(far).nodes.includes(probe), 'the new node in her walk');
  // a boat with no frame's walk to hold - new, or re-dressed - is walked whatever her range
  const late = pool.spawnSeaNow(new Boat(HULL.Rowboat, 0)); late.GameObject.position = [-300, 0, 2000];
  const first = await watched(pool, log, [late], 1, world);
  assert.ok(first[0].reads.get(late) > 0, 'a new far boat: walked on her first frame');
  pool.remove(late);
});

test('BOAT-FAR: a boat of mine past NEAR_LIFE_M is walked again the frame after the origin moves her (a draw between) or her variant changes, whatever her stride (mutant: a draw\'s walk held)', async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const mine = pool.spawnNow(new Boat(HULL.LargeBoat, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  mine.GameObject.position = [0, 0, 1500];   // SetBoatPositionAndDirection's, a mile out
  for (let i = 0; i < 12; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  const until = async () => { for (let i = 0; i < FAR_LIFE_EVERY; i++) { const [fr] = await watched(pool, log, [mine], 1, world); if (fr.reads.get(mine) > 0) return; } assert.fail('never walked'); };
  await until();
  const [next] = await watched(pool, log, [mine], 1, world);
  assert.equal(next.reads.get(mine), 0, 'far: the frame after her walk holds her');
  await until();
  pool.offsetAll([10, 0, 0]);
  pool.draw();   // a draw before her next frame walks her for itself - a walk kept for nobody, never one to hold
  const [moved] = await watched(pool, log, [mine], 1, world);
  assert.ok(moved.reads.get(mine) > 0, 'the origin moved her: walked');
  assert.ok(Math.abs(pool.walkOf(mine).mats[0][12] - mine.GameObject.position[0]) < 1e-3, 'where she stands');
  await until();
  pool.setVariant(mine, 3);
  const [dressed] = await watched(pool, log, [mine], 1, world);
  assert.ok(dressed.reads.get(mine) > 0, 're-dressed: walked');
});

const Q = [0, 0, 0, 1];
const word = (o = {}) => [o.hull ?? 2, 0, o.x ?? 0, 0, o.z ?? 0, ...Q, 0, o.helm ?? 0, 0];

test('BOAT-FAR: a peer\'s boat past NEAR_LIFE_M of the eye - the pool\'s last frame\'s, or the one the frame is handed - steps her Animators one frame in FAR_LIFE_EVERY on the time she missed; a near one every frame; none past the eye with no eye (mutants: the range unread, the missed time dropped, the pool\'s eye unread)', async () => {
  const pool = await freshPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me', log: { warn() {} } });
  peers.applyOwner('ann', { b: [word({ z: 30 })] }, (p) => p, 0);
  peers.applyOwner('bob', { b: [word({ z: 1500 })] }, (p) => p, 0);
  for (let i = 0; i < 8 && pool.peerBoats.length < 2; i++) peers.frame(1 / 60);
  const nb = peers.boatAt('ann', 0), fb = peers.boatAt('bob', 0);
  assert.ok(nb && fb, 'both built');
  assert.equal(pool.lifeEye(), null, 'no frame yet: no eye');
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.deepEqual(pool.lifeEye(), [0, 0, 0], 'the pool\'s eye: its frame\'s player');
  for (let i = 0; i < FAR_LIFE_EVERY; i++) peers.frame(1 / 60);   // the far one on her stride (her first far step banks the frames since she lived near)
  const spy = (b) => { const dts = []; for (const a of boatAnimators(b)) { const up = a.update.bind(a); a.update = (dt) => { dts.push(dt); up(dt); }; } return dts; };
  const nd = spy(nb), fd = spy(fb), per = (b) => boatAnimators(b).length;
  assert.ok(per(nb) > 0 && per(fb) > 0, 'they carry Animators');
  const N = FAR_LIFE_EVERY * 2;
  for (let i = 0; i < N; i++) peers.frame(1 / 60);
  assert.equal(nd.length, N * per(nb), 'near: every frame');
  assert.ok(nd.every((dt) => dt === 1 / 60), 'on its own time');
  assert.equal(fd.length, 2 * per(fb), `far: one frame in ${FAR_LIFE_EVERY}`);
  assert.ok(fd.every((dt) => Math.abs(dt - FAR_LIFE_EVERY / 60) < 1e-9), `on the time she missed (${fd.slice(0, 2)})`);
  fd.length = 0;
  for (let i = 0; i < N; i++) peers.frame(1 / 60, null);
  assert.equal(fd.length, N * per(fb), 'no eye: every boat near, every frame');
});

test('BOAT-FAR: THE LAW, ONE - farLifeStep lives a ship within NEAR_LIFE_M on the ground plane (or with no eye, or nowhere to stand) every frame on its own time, past it one frame in FAR_LIFE_EVERY on her own frame of the stride with the time she missed, kept across her coming near; navalHost\'s constants are its own (mutants: the distance through the sky, the missed time dropped, the stride\'s frame another)', () => {
  assert.equal(navalHost.NEAR_LIFE_M, NEAR_LIFE_M);
  assert.equal(navalHost.FAR_LIFE_EVERY, FAR_LIFE_EVERY);
  assert.deepEqual([NEAR_LIFE_M, FAR_LIFE_EVERY], [600, 4]);
  const eye = [0, 0, 0], dt = 0.02;
  const nearL = farLife(1);
  for (const pos of [[0, 0, 599], [0, 5000, 500], null]) assert.equal(farLifeStep(nearL, dt, pos, eye), dt, `near ${pos}: this frame's time`);
  assert.equal(farLifeStep(farLife(1), dt, [0, 0, 700], eye), null, 'just past it: held');
  assert.equal(farLifeStep(nearL, dt, [0, 0, 5000], null), dt, 'no eye: near');
  const a = farLife(0), b = farLife(1), far = [0, 0, 2000];
  const lived = (l) => Array.from({ length: 8 }, () => farLifeStep(l, dt, far, eye));
  const la = lived(a), lb = lived(b);
  assert.deepEqual(la.map((v) => v !== null), [false, false, false, true, false, false, false, true], 'her stride');
  assert.deepEqual(lb.map((v) => v !== null), [false, false, true, false, false, false, true, false], 'another\'s frame of it');
  assert.ok(Math.abs(la[3] - 4 * dt) < 1e-12 && Math.abs(lb[2] - 3 * dt) < 1e-12, 'the time she missed');
  const c = farLife(0);
  farLifeStep(c, dt, far, eye); farLifeStep(c, dt, far, eye);
  assert.ok(Math.abs(farLifeStep(c, dt, [0, 0, 10], eye) - 3 * dt) < 1e-12, 'come near: the time she missed with it');
  assert.equal(farLifeStep(c, dt, [0, 0, 10], eye), dt, 'and her own after');
});
