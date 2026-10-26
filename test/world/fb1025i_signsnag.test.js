// FIELD BUGS 2026-10-25i SIGN-PASS (#bug-reports, ajaegerson, "Caravans get caught on shop signs": "Sometimes they do
// when travelling through towns its really easy to fix just return and move a bit but kinda annoying it stops you";
// Harlander: "Even going on foot you can get hung up on shop signs and fences"). A shop's sign (ARCH3D 43700-43755, a
// town block's misc model) went into the collider whole, as DFU's combined block MeshCollider takes it, and its board,
// arm and brace hang over the street from 1.65, 2.1 and 2.4 m - inside a rider's 2.6 m capsule (a wagon's driver is
// one) and, the lowest, a walker's 1.8 m. Now a sign's triangles every corner of which stands SIGN_HANG_M over its
// foot hang and are drawn, never solid; its posts stand (world/signSolid.js). Driven through the real PlayerMotor and
// Collider, on a sign built to 43727's measures and, with ARENA2, on the game's own: ARCH3D's 56 signs and the tavern
// sign of TVRNBM04 as the block's own layout stands it (layoutRmbBlock).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSignModel, signStandingIndices, solidIndicesOf, SIGN_HANG_M, SIGN_FIRST_MODEL, SIGN_LAST_MODEL } from '../../src/world/signSolid.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS } from '../../src/player/motor.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { skipReal, game } from '../lwRealTown.mjs';
import { buildYardModel, STABLE_YARD, CARPENTER_YARD, WAGON_YARD, SIGN_BOARD } from '../../src/world/merchantYards/merchantYardModels.js';
import { buildShipyardModel } from '../../src/world/shipyardModel.js';

const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const RUN = { ...IDLE, forward: 1, run: true };
const WALK = { ...IDLE, forward: 1 };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A box's twelve triangles, appended to `p` / `ix`. */
function box(p, ix, x0, y0, z0, x1, y1, z1) {
  const v = p.length / 3;
  p.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  for (const k of [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]) ix.push(v + k);
}
/** A sign to 43727's measures, centred on its own middle as ARCH3D's are (y -1.6..1.6, its foot 1.6 under its origin):
 *  the post at z -1..-0.8 the whole height, the arm out over the street at 2.5-2.7 m, the board under it at 1.65-2.45 m
 *  from z -0.65 to 0.95, 0.1 thick. */
function madeSign() {
  const p = [], ix = [];
  box(p, ix, -0.1, -1.6, -1.0, 0.1, 1.6, -0.8);    // the post
  const post = ix.length;
  box(p, ix, -0.1, 0.9, -0.8, 0.1, 1.1, 1.0);      // the arm
  box(p, ix, -0.05, 0.05, -0.65, 0.05, 0.85, 0.95);   // the board
  return { positions: new Float32Array(p), indices: new Uint32Array(ix), post };
}
/** A run of the real motor from `from` along `yaw` for `seconds`: a wagon's driver (a rider's capsule) at the gallop, a
 *  walker at a walk (a runner's stride carries it through a board's edge that holds a walker). */
function run(col, from, yaw, mode, seconds = 2, each = null) {
  const m = new PlayerMotor(col);
  m.spawn(from[0], 0.05, from[2]);
  if (mode) m.transportMode = mode;
  for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, yaw);
  const s = [...m.pos];
  for (let i = 0; i < seconds * 60; i++) { m.update(FIXED_DT, mode ? RUN : WALK, yaw); each?.(m.pos); }
  return { m, d: Math.hypot(m.pos[0] - s[0], m.pos[2] - s[2]) };
}
/** How far (seen from above) a point stands from the post's footprint, x -0.1..0.1 by z -1..-0.8 in the sign's frame. */
const offPost = (x, z) => Math.hypot(Math.max(-0.1 - x, 0, x - 0.1), Math.max(-1 - z, 0, z + 0.8));
const ground = () => { const c = new Collider(() => 0); return c; };

test('SIGN-PASS the law: a sign\'s triangles every corner of which stands SIGN_HANG_M over its own foot hang and leave the collider - the board and the arm of a sign built to 43727\'s measures - and its post stands; a model that is no sign keeps its own indices, a sign\'s are made once (mutants: the foot not read; the line at the board; a hanging triangle kept; the range closed at either end)', () => {
  assert.equal(SIGN_HANG_M, 1);
  assert.deepEqual([SIGN_FIRST_MODEL - 1, SIGN_FIRST_MODEL, 43727, SIGN_LAST_MODEL, SIGN_LAST_MODEL + 1].map(isSignModel), [false, true, true, true, false]);
  const s = madeSign();
  const kept = signStandingIndices(s.positions, s.indices);
  const post = [...s.indices.slice(0, s.post)];
  assert.deepEqual([...kept], [...post.slice(0, 18), ...post.slice(24)], 'the post alone, in its own order - its sides and its foot; its cap, 3.2 m up, hangs over every head as the board does');
  // the foot is the model's own lowest corner, wherever its origin is: the same sign lifted 5 m keeps the same post
  const lifted = Float32Array.from(s.positions, (v, i) => (i % 3 === 1 ? v + 5 : v));
  assert.deepEqual([...signStandingIndices(lifted, s.indices)], [...kept]);
  const sign = { positions: s.positions, indices: s.indices };
  assert.equal(solidIndicesOf(43727, sign), solidIndicesOf(43727, sign), 'made once a model');
  assert.deepEqual([...solidIndicesOf(43727, sign)], [...kept]);
  const well = { positions: s.positions, indices: s.indices };
  assert.equal(solidIndicesOf(41105, well), well.indices, 'a bench, a fence, a house: its own indices, untouched');
  assert.equal(solidIndicesOf(SIGN_LAST_MODEL + 1, well), well.indices);
});

test('SIGN-PASS the motor, on a sign built to 43727\'s measures: a wagon\'s driver crossing under the board was stopped at its face and now drives on; a walker under its low edge passes; the post stops both, as a post does (mutants: the board solid again; the law asked of no sign)', () => {
  const s = madeSign();
  const at = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1.6, 0, 1]);   // its foot on the ground
  const whole = ground(), standing = ground();
  whole.addMesh('sign', s.positions, s.indices, at);
  standing.addMesh('sign', s.positions, solidIndicesOf(43727, s), at);
  const open = ground();
  const E = Math.PI / 2;   // along +x, square to the board's faces
  for (const mode of [TRANSPORT_MODES.Cart, null]) {
    const free = run(open, [-4, 0, 0.15], E, mode);
    const before = run(whole, [-4, 0, 0.15], E, mode), after = run(standing, [-4, 0, 0.15], E, mode);
    assert.ok(free.d > 6, 'the street is open without the sign');
    assert.ok(before.m.pos[0] < 0 && before.d < free.d - 2, `${mode ?? 'a walker'}: stopped under the board (x ${before.m.pos[0].toFixed(2)})`);
    assert.ok(Math.abs(after.d - free.d) < 0.05, `${mode ?? 'a walker'}: on under it as through the open street (${after.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    let nearest = Infinity;
    const post = run(standing, [-4, 0, -0.9], E, mode, 2, (q) => { nearest = Math.min(nearest, offPost(q[0], q[2])); });
    assert.ok(nearest > CAPSULE_RADIUS - 0.01 && nearest < CAPSULE_RADIUS + 0.01, `${mode ?? 'a walker'}: met the post and kept off it (${nearest.toFixed(3)})`);
    assert.ok(Math.abs(post.m.pos[2] + 0.9) > 0.3 && Math.abs(post.m.pos[1]) < 0.01, 'turned round it, on the ground');
  }
});

test('SIGN-PASS with ARENA2: ARCH3D\'s 56 signs are three frames of nineteen boards, and the line parts every one alike - the two-post frame keeps its 16 of 34, the post with an arm its 8 of 42, the T on a pole its 16 of 30; every standing triangle comes down to 0.5 m of the foot or lower, every hanging one stands 1.65 m over it or higher', { skip: skipReal }, () => {
  const { modelOf } = game();
  const fams = { frame: [], arm: [], pole: [] };
  let lowestHung = Infinity, highestStanding = -Infinity;
  for (let id = SIGN_FIRST_MODEL; id <= SIGN_LAST_MODEL; id++) {
    const m = modelOf(id);
    if (!m) continue;
    const P = m.positions, I = m.indices;
    let foot = Infinity;
    for (let i = 1; i < P.length; i += 3) foot = Math.min(foot, P[i]);
    const kept = new Set();
    const k = solidIndicesOf(id, m);
    for (let t = 0; t < k.length; t += 3) kept.add(`${k[t]},${k[t + 1]},${k[t + 2]}`);
    for (let t = 0; t < I.length; t += 3) {
      const low = Math.min(P[I[t] * 3 + 1], P[I[t + 1] * 3 + 1], P[I[t + 2] * 3 + 1]) - foot;
      if (kept.has(`${I[t]},${I[t + 1]},${I[t + 2]}`)) highestStanding = Math.max(highestStanding, low); else lowestHung = Math.min(lowestHung, low);
    }
    const fam = id <= 43717 ? fams.frame : id <= 43736 ? fams.arm : fams.pole;
    fam.push(`${k.length / 3}/${I.length / 3}`);
  }
  assert.deepEqual(fams, { frame: Array(18).fill('16/34'), arm: Array(19).fill('8/42'), pole: Array(19).fill('16/30') });
  assert.ok(highestStanding < 0.51 && highestStanding > 0.49, `the T's pole off its flared foot (${highestStanding.toFixed(3)})`);
  assert.ok(lowestHung > 1.64 && lowestHung < 1.66, `the lowest board (${lowestHung.toFixed(3)})`);
});

test('SIGN-PASS with ARENA2, the report\'s case: TVRNBM04\'s tavern sign (43727) as the block\'s layout stands it, in the block\'s collider as the town hosts build it - a wagon driven along the street under its board was stopped at it and now drives on, a walker as well, and both are still kept off its post', { skip: skipReal }, () => {
  const { blocks, modelOf } = game();
  const lay = layoutRmbBlock(blocks.getBlockByName('TVRNBM04.RMB'));
  const si = lay.models.findIndex((m) => m.modelIdNum === 43727);
  assert.ok(si >= 0, 'the tavern\'s sign');
  /** the block's collider: every model at its matrix, a sign's indices by `law` (the host's: solidIndicesOf) */
  const world = (law, skip = -1) => {
    const c = ground();
    lay.models.forEach((pm, i) => {
      const m = modelOf(pm.modelIdNum);
      if (i !== skip && m) c.addMesh(`m${i}`, m.positions, law(pm.modelIdNum, m), pm.matrix);
    });
    return c;
  };
  const hosts = world(solidIndicesOf), dfu = world((id, m) => m.indices), none = world(solidIndicesOf, si);
  const M = lay.models[si].matrix;
  // the sign's own frame: x across its board's faces, z along the board from its post (z -1..-0.8) out over the street
  const p = (x, z) => [M[0] * x + M[8] * z + M[12], 0, M[2] * x + M[10] * z + M[14]];
  const yaw = Math.atan2(M[0], M[2]);
  for (const mode of [TRANSPORT_MODES.Cart, null]) {
    const who = mode ? 'a wagon\'s driver' : 'a walker';
    const free = run(none, p(-4, 0.15), yaw, mode);
    assert.ok(free.d > 6, `${who}: the street open without the sign (${free.d.toFixed(2)})`);
    const before = run(dfu, p(-4, 0.15), yaw, mode), after = run(hosts, p(-4, 0.15), yaw, mode);
    assert.ok(before.d < free.d - 2, `${who}: the whole sign stopped it (${before.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    assert.ok(Math.abs(after.d - free.d) < 0.05, `${who}: on under the board (${after.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    let nearest = Infinity;
    const local = (q) => [(q[0] - M[12]) * M[0] + (q[2] - M[14]) * M[2], (q[0] - M[12]) * M[8] + (q[2] - M[14]) * M[10]];
    const post = run(hosts, p(-4, -0.9), yaw, mode, 2, (q) => { const [x, z] = local(q); nearest = Math.min(nearest, offPost(x, z)); });
    assert.ok(nearest > CAPSULE_RADIUS - 0.01 && nearest < CAPSULE_RADIUS + 0.02, `${who}: met the post and kept off it (${nearest.toFixed(3)})`);
    assert.ok(Math.abs(local(post.m.pos)[1] + 0.9) > 0.3, `${who}: turned round it`);
  }
});

test('SIGN-PASS THE TOWN HOSTS: the world\'s town build and the exterior host put a placed model in the collider by solidIndicesOf, the one law - no interior and no dungeon stands a sign (mutants: either host back to the whole mesh)', () => {
  const pb = rd('src/scenes/pixelBuild.js'), ex = rd('src/scenes/exterior.js');
  assert.match(pb, /late\.add\(gateKey, cpu\.positions, solidIndicesOf\(placed\.modelIdNum, cpu\), local,/);
  assert.match(pb, /import \{ solidIndicesOf \} from '\.\.\/world\/signSolid\.js';/);
  assert.match(ex, /collider\.addMesh\(bucketKey, cpu\.positions, solidIndicesOf\(placed\.modelIdNum, cpu\), matrix\);/);
  assert.match(ex, /import \{ solidIndicesOf \} from '\.\.\/world\/signSolid\.js';/);
});

test('SIGN-PASS THE PORT\'S OWN BOARDS: the Stable\'s, the Wagon Yard\'s, the Joinery\'s and the Shipyard\'s signboards, and the Shipyard\'s crew board under its eaves, hang - drawn, no solid: every model\'s collider is its triangles but a board\'s (its two faces, its four edges, its two rods: 32), and no hung triangle comes lower than 1.75 m (mutants: a board laid solid; the mark left on after it)', () => {
  const models = { stable: buildYardModel('stable'), transport: buildYardModel('transport'), carpenter: buildYardModel('carpenter'), shipyard: buildShipyardModel() };
  const hungOf = {};
  for (const [kind, m] of Object.entries(models)) {
    const solid = new Set();
    for (let t = 0; t < m.solid.length; t += 3) solid.add(m.solid[t]);
    let hung = 0, lowest = Infinity;
    for (let t = 0; t < m.indices.length; t += 3) {
      if (solid.has(m.indices[t])) continue;
      hung++;
      lowest = Math.min(lowest, ...[0, 1, 2].map((k) => m.positions[m.indices[t + k] * 3 + 1]));
    }
    hungOf[kind] = hung;
    assert.ok(lowest >= 1.75 - 1e-6, `${kind}: its lowest hung corner ${lowest.toFixed(3)}`);
    assert.equal(m.solid.length + hung * 3, m.indices.length);
  }
  assert.deepEqual(hungOf, { stable: 32, transport: 32, carpenter: 32, shipyard: 64 });
  assert.ok(STABLE_YARD.gate.beamY - 0.2 - SIGN_BOARD.h < 2.6 && CARPENTER_YARD.gate.beamY - 0.2 - SIGN_BOARD.h < 2.6, 'the gates\' boards hang inside a rider\'s 2.6 m');
});

test('SIGN-PASS THE PORT\'S OWN BOARDS, the motor: a wagon\'s driver riding in under the Stable\'s and the Joinery\'s gate boards, and the Wagon Yard\'s by its opening, was stopped at each and now rides in; a walker as before; the gateposts still stand', () => {
  const ways = [['stable', STABLE_YARD.fence.z1, [-0.4, 0, 0.4]], ['carpenter', CARPENTER_YARD.fence.z1, [-0.4, 0, 0.4]], ['transport', WAGON_YARD.fence.z1, [-5.8, -5.6]]];
  for (const [kind, z1, xs] of ways) {
    const m = buildYardModel(kind);
    const whole = ground(), yard = ground();
    whole.addMesh('y', m.positions, m.indices, I4);
    yard.addMesh('y', m.positions, m.solid, I4);
    for (const x of xs) {
      const before = run(whole, [x, 0, z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5), after = run(yard, [x, 0, z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5);
      assert.ok(before.m.pos[2] > z1 - 0.5, `${kind} at x ${x}: the board stopped it (z ${before.m.pos[2].toFixed(2)})`);
      assert.ok(after.m.pos[2] < z1 - 3, `${kind} at x ${x}: ridden in (z ${after.m.pos[2].toFixed(2)})`);
      assert.ok(run(yard, [x, 0, z1 + 3], Math.PI, null, 2).m.pos[2] < z1 - 3, `${kind} at x ${x}: walked in`);
    }
  }
  const m = buildYardModel('stable'), yard = ground();
  yard.addMesh('y', m.positions, m.solid, I4);
  const post = run(yard, [-STABLE_YARD.gate.half, 0, STABLE_YARD.fence.z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5);
  assert.ok(post.m.pos[2] > STABLE_YARD.fence.z1, `the gatepost stands (z ${post.m.pos[2].toFixed(2)})`);
});

test('SIGN-PASS THE PORT\'S OWN BOARDS by source: both yard hosts stand a model\'s solid triangles (mutants: either host back to the whole model)', () => {
  for (const host of ['src/scenes/merchantYardsHost.js', 'src/scenes/portHost.js']) {
    const h = rd(host);
    assert.match(h, /const solidOf = \(p\) => p\.solid \?\? p\.indices;/, host);
    assert.match(h, /icount = parts\.reduce\(\(n, p\) => n \+ solidOf\(p\)\.length, 0\);/, host);
    assert.match(h, /const ix = solidOf\(p\);\n\s*for \(let j = 0; j < ix\.length; j\+\+\) indices\[i \+ j\] = ix\[j\] \+ v \/ 3;/, host);
  }
});
