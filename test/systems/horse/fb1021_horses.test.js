// HORSE-VIEW (2026-10-21, a player's CPU profile: "Horse Cart pool (peers' horses and carts) 11% (3% with peers' teams
// not loaded) - scenes/horseCartPool.js frame -> poseTeam / pose3dTeam / horseRig.step, writeHorsePalette"): A 3D HORSE
// IS POSED WHERE IT IS SEEN. Inside PERF-TEAMS' 400 m every horse the pool stood, and every peer's horse under its
// rider, had its palette written and sent every frame - behind the eye, parked, a hundred metres off - and only the
// draw asked the view. Now the gait's clock steps every frame and the pose is the view's: the pool's horses in the last
// body pass's view on the peers' bodies' cadence, a horse the view swings onto caught up before it is drawn, a rider's
// horse on the frames its rider's body is posed. The real rig (world/horseRig.js) over the real bake, the real pool
// (scenes/horseCartPool.js) and the real PeerBodies (net/peer/peerBodies.js); GL is a recording stub.
// bible/07-Rendering/Performance-Priority.md HORSE-VIEW.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createHorseRig } from '../../../src/world/horseRig.js';
import { horsePoseScratch, writeHorsePalette } from '../../../src/world/horseModel.js';
import { createHorseCartPool } from '../../../src/scenes/horseCartPool.js';
import { PeerBodies, poseCadenceFor } from '../../../src/net/peer/peerBodies.js';
import { POSE_RIDE } from '../../../src/net/wire.js';
import { HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT } from '../../../src/systems/horse/horseCartLaw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };

/** The GL half's doors, recording: every palette sent (its mesh, a copy of what was sent) and every picture queued, in
 *  the order they came. */
function recordingRenderer() {
  let n = 0;
  const r = { log: [] };
  return Object.assign(r, {
    createSkinnedCharacterMesh: (s, o) => ({ vao: {}, vbo: {}, count: s.length / o.floats, floats: o.floats, skin: r.createSkinPalette(o) }),
    createSkinPalette: (o) => ({ tex: { id: ++n }, ...o }),
    releaseCharacterSkin: (m) => { if (m?.skin) m.skin.tex = null; },
    createCharacterTexture: () => ({ id: ++n }), releaseCharacterTexture: () => {},
    updateSkinPalette: (mesh, pal) => { r.log.push({ up: mesh, pal: Float32Array.from(pal) }); },
    queueCharacterSprite: (it) => { r.log.push({ drawn: it.mesh }); },
    characterSpriteBatchOpen: true, retroImageSpan: null,
    renderCharacterSprite: () => ({}), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {},
    uploadTexture: (a, b, px) => px, evictTexture: () => true, createBillboardBatch: (archive, record) => ({ archive, record, origin: [0, 0, 0] }),
    destroyBillboardBatch() {}, createMesh: () => ({}),
  });
}
const uploadsOf = (r, mesh) => r.log.filter((x) => x.up === mesh).length;
async function rigOn(r) {
  const rig = createHorseRig({
    renderer: r,
    fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json')),
    fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await rig.load();
  assert.ok(rig.ready(), `the rig: ${rig.failure()}`);
  return rig;
}
/** The pose an every-frame horse shows for this gait: the palette written off the clock alone, and its seat. */
function poseOfClock(rig, h) {
  const scratch = horsePoseScratch(rig.bake());
  const pal = writeHorsePalette(rig.bake(), h.gait, new Float32Array(h.pal.length), scratch);
  return { pal, seat: rig.seat({ ...h, scratch }) };
}

const canvas = { clientWidth: 1280, clientHeight: 720 };
const fy = 1 / Math.tan(Math.PI / 6);
const proj = new Float32Array([fy / (1280 / 720), 0, 0, 0, 0, fy, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2002, 0]);
const LOOK_NZ = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);   // the eye at the origin, down -z
const LOOK_PZ = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]);   // turned round: down +z

test('HORSE-VIEW the rig: `pose: false` steps the gait\'s clock and places the horse, and writes and sends nothing; a horse never posed is posed anyway; `pose` catches it up to the very palette an every-frame horse shows, and sends nothing when it already stands there (mutants: the pose word ignored; the clock stepped only with the pose; the first pose skipped; the catch-up\'s gate)', async () => {
  const r = recordingRenderer();
  const rig = await rigOn(r);
  const every = rig.horse(9), skips = rig.horse(9);
  // a ride through the gaits: standing, a walk, a trot, a gallop and back - the fades between them too
  const speedAt = (f) => (f < 20 ? 0 : f < 50 ? 1 : f < 80 ? 3 : f < 120 ? 9 : 2);
  rig.step(skips, { feet: [0, 0, 0], yaw: 0, speed: 0, dt: 1 / 60, pose: false });
  assert.equal(uploadsOf(r, skips.mesh), 1, 'a horse never posed is posed whatever `pose` says - none stands in the palette it was made with');
  assert.deepEqual([skips.posed, skips.stale], [true, false]);
  rig.step(every, { feet: [0, 0, 0], yaw: 0, speed: 0, dt: 1 / 60 });
  for (let f = 1; f < 140; f++) {
    const at = [f * 0.05, 0, -f * 0.02], yaw = f * 0.01;
    rig.step(every, { feet: at, yaw, speed: speedAt(f), dt: 1 / 60 });
    rig.step(skips, { feet: at, yaw, speed: speedAt(f), dt: 1 / 60, pose: false });
    assert.deepEqual(skips.model, every.model, `frame ${f}: placed every frame all the same`);
  }
  assert.equal(uploadsOf(r, every.mesh), 140, 'the every-frame horse: a palette a frame');
  assert.equal(uploadsOf(r, skips.mesh), 1, 'the skipping one: nothing sent past its first');
  assert.equal(skips.stale, true, 'its pose behind its clock');
  assert.deepEqual(skips.gait, every.gait, 'the clock ran every frame regardless');
  assert.notDeepEqual(skips.pal, every.pal, 'and its palette stood where it was');
  assert.equal(rig.pose(skips), true);
  assert.equal(uploadsOf(r, skips.mesh), 2, 'caught up: one palette sent');
  assert.deepEqual(skips.pal, every.pal, 'bit for bit the every-frame horse\'s pose - the clock\'s, never the last one sent');
  assert.deepEqual(r.log.at(-1).pal, every.pal, 'and that is what went to the GPU');
  assert.deepEqual(rig.seat(skips), rig.seat(every), 'its seat with it');
  assert.equal(rig.pose(skips), false, 'standing where its clock is: nothing to send');
  assert.equal(uploadsOf(r, skips.mesh), 2);
  rig.step(skips, { feet: [0, 0, 0], yaw: 0, speed: 1, dt: 1 / 60 });
  assert.equal(uploadsOf(r, skips.mesh), 3, '`pose` left out: posed, as every caller before HORSE-VIEW stepped it');
});

test('HORSE-VIEW the rig\'s view: `seen` is the draw\'s own test - behind the eye out, ahead in, a horse not placed yet not known to be out; the draw catches up a pose behind its clock only when told `fresh`, and only for a horse it draws (mutants: fresh ignored; fresh posing out of the view)', async () => {
  const r = recordingRenderer();
  const rig = await rigOn(r);
  const h = rig.horse(4);
  assert.equal(rig.seen(h, LOOK_NZ, proj), true, 'not placed: not known to be out of the view');
  rig.step(h, { feet: [0, 0, 8], yaw: 0, speed: 1, dt: 1 / 60 });
  assert.equal(rig.seen(h, LOOK_NZ, proj), false, 'behind the eye');
  assert.equal(rig.seen(h, LOOK_PZ, proj), true, 'turned round to it');
  for (let i = 0; i < 30; i++) rig.step(h, { feet: [0, 0, 8], yaw: 0, speed: 1, dt: 1 / 60, pose: false });
  const sent = uploadsOf(r, h.mesh);
  assert.equal(rig.draw(h, canvas, { proj, view: LOOK_NZ, eye: [0, 0, 0], fresh: true }), false, 'out of the view: no picture');
  assert.equal(uploadsOf(r, h.mesh), sent, 'and no pose for a picture not taken');
  assert.equal(rig.draw(h, canvas, { proj, view: LOOK_PZ, eye: [0, 0, 0] }), true);
  assert.equal(uploadsOf(r, h.mesh), sent, 'drawn without `fresh`: in the pose it stands in (a cadence\'s skipped frame)');
  assert.equal(h.stale, true);
  assert.equal(rig.draw(h, canvas, { proj, view: LOOK_PZ, eye: [0, 0, 0], fresh: true }), true);
  const [sentNow, queued] = r.log.slice(-2);
  assert.deepEqual([sentNow.up, queued.drawn], [h.mesh, h.mesh], '`fresh`: the pose sent, then the picture queued');
  assert.deepEqual(sentNow.pal, poseOfClock(rig, h).pal, 'in the pose of its clock');
  assert.equal(h.stale, false);
});

/** A pool on the Morrowind lane - the real rig, the real pool - and a peer's lone horse walking where `at` says. */
async function poolStage() {
  const r = recordingRenderer();
  const rig = await rigOn(r);
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4).fill(200) });
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), decode, horses3d: () => rig, log: { warn() {} } });
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, rebase() {} });
  pool.presentation.horseArt.ensureStationary();
  await settle();
  return { r, rig, pool };
}
/** One host frame: the rig's tick, the pool's frame, the body pass's 3D horses with `view`. */
function hostFrame({ rig, pool }, view, eye = [0, 1.7, 0]) {
  rig.tick();
  pool.frame(1 / 60, eye);
  return pool.draw3d(canvas, { proj, view, eye: [0, 0, 0] });
}
/** The 3D horses' meshes in the order their first palettes were sent - a new horse is posed the frame it is stood, and
 *  the pool stands its peers' horses in the order their words came. */
const meshesInOrder = (r) => [...new Set(r.log.filter((x) => x.up).map((x) => x.up))];

test('HORSE-VIEW the pool: a peer\'s horse out of the last body pass\'s view is not posed nor sent, frame after frame; the frame the view swings onto it, the draw poses it BEFORE it is drawn, in the very pose an always-seen horse shows that frame - no pose from when it was last seen (mutants: the view test dropped; the pool\'s step posing; `fresh` not handed; the veiled pass\'s `fresh`)', async () => {
  const seen = await poolStage(), hidden = await poolStage();
  const word = (pool, f) => pool.applyOwner('peer-0', { h: [-2 + f * 0.04, 0, 6, 1, 0, 1] });   // walking along +x, 6 m behind the -z look
  const K = 90;
  for (let f = 0; f < K; f++) {
    word(seen.pool, f); word(hidden.pool, f);
    assert.equal(hostFrame(seen, LOOK_PZ), 1, `frame ${f}: the always-seen horse drawn`);
    assert.equal(hostFrame(hidden, LOOK_NZ), 0, `frame ${f}: the hidden one behind the eye`);
  }
  const [meshSeen] = meshesInOrder(seen.r), [meshHidden] = meshesInOrder(hidden.r);
  assert.ok(meshSeen && meshHidden, 'each pool stood its 3D horse');
  assert.equal(uploadsOf(seen.r, meshSeen), K, 'within 10 m and in the view: a pose a frame, the cadence\'s near band');
  assert.equal(uploadsOf(hidden.r, meshHidden), 1, 'behind the eye: its first pose and nothing after - K-1 frames unsent');
  // the view swings round onto it
  word(seen.pool, K); word(hidden.pool, K);
  hidden.r.log.length = 0; seen.r.log.length = 0;
  assert.equal(hostFrame(seen, LOOK_PZ), 1);
  assert.equal(hostFrame(hidden, LOOK_PZ), 1, 'in this pass\'s view: drawn');
  assert.deepEqual(hidden.r.log.map((x) => (x.up ? 'pose' : 'draw')), ['pose', 'draw'], 'posed, then drawn - in the draw, as the frame judged it by the last view');
  assert.deepEqual(hidden.r.log[0].pal, seen.r.log.find((x) => x.up).pal, 'bit for bit the always-seen horse\'s pose this frame: the gait\'s clock ran unposed');
  // and on, seen: the cadence's every frame within 10 m, from the frame's own judgement
  hidden.r.log.length = 0;
  word(hidden.pool, K + 1);
  hostFrame(hidden, LOOK_PZ);
  assert.deepEqual(hidden.r.log.map((x) => (x.up ? 'pose' : 'draw')), ['pose', 'draw']);
  // the veiled pass (a concealed owner's horses, AUDIT COATS3D A5) catches up the same way
  hidden.pool.setPeerLook(() => ({ mode: 1, alpha: 0.3, t: 0, phase: 0 }));
  for (let f = 0; f < 10; f++) { word(hidden.pool, K + 2 + f); hostFrame(hidden, LOOK_NZ); hidden.pool.drawVeiled3d(); }
  hidden.r.log.length = 0;
  word(hidden.pool, K + 12);
  hostFrame(hidden, LOOK_PZ);
  assert.equal(hidden.pool.drawVeiled3d(), 1);
  assert.deepEqual(hidden.r.log.map((x) => (x.up ? 'pose' : 'draw')), ['pose', 'draw'], 'veiled: posed, then drawn');
});

test('HORSE-VIEW the pool\'s cadence: in the view a horse is posed on the peers\' bodies\' cadence by its horizontal distance from the eye - every frame within 10 m, every second to 25, every third past it - staggered so two at one distance pose on different frames; no eye, every frame (mutants: the cadence dropped; the phase dropped; the distance\'s axis; no eye never posed)', async () => {
  const s = await poolStage();
  const at = { near: [0, 0, -5], mid: [0, 10, -24], far: [-3, 0, -60], far2: [3, 0, -60] };   // `mid` 10 m up: 26 m off as the crow flies, 24 along the ground
  const owners = Object.keys(at);
  const word = () => owners.forEach((o) => s.pool.applyOwner(o, { h: [...at[o], 0, 1, 0] }));
  word();
  hostFrame(s, LOOK_NZ);
  const meshes = new Map(meshesInOrder(s.r).map((m, i) => [owners[i], m]));
  assert.equal(meshes.size, 4, 'a 3D horse each, posed the frame it stood');
  for (let f = 0; f < 2; f++) { word(); hostFrame(s, LOOK_NZ); }
  s.r.log.length = 0;
  const frames = new Map(owners.map((o) => [o, []]));
  for (let f = 0; f < 12; f++) {
    word();
    const before = s.r.log.length;
    assert.equal(hostFrame(s, LOOK_NZ), 4, 'all four in view');
    for (const o of owners) if (s.r.log.slice(before).some((x) => x.up === meshes.get(o))) frames.get(o).push(f);
  }
  assert.deepEqual([poseCadenceFor(25), poseCadenceFor(24 * 24), poseCadenceFor(26 * 26), poseCadenceFor(3600)], [1, 2, 3, 3]);
  assert.equal(frames.get('near').length, 12, '5 m: every frame');
  assert.equal(frames.get('mid').length, 6, '24 m along the ground: every second frame - its height is no distance, as a body\'s is not');
  assert.equal(frames.get('far').length, 4, '60 m: every third');
  assert.equal(frames.get('far2').length, 4);
  assert.notDeepEqual(frames.get('far'), frames.get('far2'), 'two at one distance on different frames (each horse its phase)');
  for (const o of owners) assert.ok(frames.get(o).every((f, i, a) => !i || f - a[i - 1] === 12 / a.length), `${o}: evenly`);
  // no eye: every frame
  s.r.log.length = 0;
  for (let f = 0; f < 3; f++) { word(); s.rig.tick(); s.pool.frame(1 / 60, null); s.pool.draw3d(canvas, { proj, view: LOOK_NZ, eye: [0, 0, 0] }); }
  assert.equal(uploadsOf(s.r, meshes.get('far')), 3, 'no eye to measure from: posed every frame');
});
/** A body rig that records each step (net/peer/peercadence.test.js's): whether it posed, and the saddle it posed to. */
function bodyRigs(rigs) {
  return () => {
    const b = { mode: 'first', steps: [], skinned: false,
      attach(renderer, cam) { b.cam = cam; }, async build(opts) { b.opts = opts; await tick(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, bodyHeight: () => 1.8,
      setViewMode(m) { b.mode = m; return true; }, thirdActive: () => b.mode === 'third' && b.skinned,
      update(dt, o) { const s = b.cam()?.saddle; b.steps.push({ pose: o?.pose !== false, seat: s?.seat ? [...s.seat] : null }); if (o?.pose !== false) b.skinned = true; },
      drawThird: () => b.thirdActive(), unload() {} };
    rigs.push(b);
    return b;
  };
}

test('HORSE-VIEW a riding peer\'s horse is posed with its body: on exactly the frames the body\'s skin is (its cadence; none out of the view), its gait stepped every frame, and the saddle the body is posed to is the seat of the pose just sent; a body caught up in the draw as the view swings onto it catches its horse up first (mutants: the saddle\'s step posing; the body\'s pose without its horse\'s; the seat not taken off the new pose; the draw\'s catch-up without the horse)', async () => {
  const r = recordingRenderer();
  const horses = await rigOn(r);
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: bodyRigs(rigs), buildOpts: (look) => ({ race: look.race }), now: () => 1000, horses: () => horses });
  const rider = (id, z) => ({ id, name: id, told: true, look: { race: id, gender: 'male', faceIndex: 0, items: [] },
    shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0, rd: POSE_RIDE.Horse, rc: 0, hs: 0 } });
  const ahead = rider('ahead', -40), behind = rider('behind', 12);
  const peers = [ahead, behind];
  const toScene = (p) => [p.x, p.y, p.z];
  let f = 0;
  const frame = (view = LOOK_NZ) => {
    f++;
    for (const p of peers) p.shown = { ...p.shown, x: p.shown.x + 0.12 };   // a canter's 7 m/s across the view
    pb.sync(peers, toScene, 1 / 60, [0, 0, 0]);
    pb.draw(canvas, { proj, view, eye: [0, 0, 0] });
  };
  for (let i = 0; i < 40 && !peers.every((p) => pb.has(p.id)); i++) { frame(); await settle(); }
  for (let i = 0; i < 6; i++) frame();
  const body = (id) => pb._bodies.get(id);
  const rigOf = (id) => rigs.find((x) => x.opts?.race === id);
  assert.ok(body('ahead').horse && body('behind').horse, 'both astride their 3D horses');
  for (const id of ['ahead', 'behind']) rigOf(id).steps.length = 0;
  r.log.length = 0;
  const posedFrames = { ahead: [], behind: [] }, horseFrames = { ahead: [], behind: [] };
  for (let i = 0; i < 12; i++) {
    const n0 = r.log.length, s0 = { ahead: rigOf('ahead').steps.length, behind: rigOf('behind').steps.length };
    frame();
    for (const id of ['ahead', 'behind']) {
      const st = rigOf(id).steps.slice(s0[id]);
      if (st.some((x) => x.pose)) posedFrames[id].push(i);
      if (r.log.slice(n0).some((x) => x.up === body(id).horse.mesh)) horseFrames[id].push(i);
      const posed = st.find((x) => x.pose);
      if (posed) assert.deepEqual(posed.seat, poseOfClock(horses, body(id).horse).seat, `frame ${i}: ${id}'s body posed to the seat of the horse's pose this frame`);
    }
  }
  assert.equal(rigOf('ahead').steps.length, 12, 'the body stepped every frame');
  assert.equal(posedFrames.ahead.length, 4, '40 m: the body posed every third frame');
  assert.deepEqual(horseFrames.ahead, posedFrames.ahead, 'and its horse on exactly those frames');
  assert.deepEqual([posedFrames.behind, horseFrames.behind], [[], []], 'behind the eye: neither the body nor its horse');
  assert.equal(body('behind').horse.stale, true, 'its horse\'s pose behind its clock');
  // the view swings onto the one behind: the draw catches the body up (WB9h), and its horse before it
  r.log.length = 0; rigOf('behind').steps.length = 0;
  const h = body('behind').horse;
  frame(LOOK_PZ);
  assert.equal(uploadsOf(r, h.mesh), 1, 'the horse posed in the draw');
  assert.deepEqual(r.log.find((x) => x.up === h.mesh).pal, poseOfClock(horses, h).pal, 'in its clock\'s pose');
  const caught = rigOf('behind').steps.find((x) => x.pose);
  assert.ok(caught, 'the body posed in the draw');
  assert.deepEqual(caught.seat, poseOfClock(horses, h).seat, 'to the seat of the horse\'s new pose');
});
