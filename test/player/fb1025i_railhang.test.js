// FIELD BUGS 2026-10-25i RAIL-HANG (#bug-reports, "Caravans get caught on shop signs"; Harlander: "Even going on foot
// you can get hung up on shop signs and fences"). The town's split-rail fences (ARCH3D 41206, 41207, 41208 - 358 of
// BLOCKS.BSA's placements) are a post and two rails, each rail a wedge: a flat face on the street side, and behind it
// two faces sloping to a back edge 0.55 m up for the lower rail. Met from behind, the lower sphere of a walker's capsule
// came up under that edge with the rail's upper slope just over its centre, and PH1's one-way floor (player/collider.js
// _resolveSphere: a floor-sloped face just over the lower sphere's centre is a floor the body sank under, and the
// sphere is set ON it) set the body on the rail in the sideways pass - 0.39 m up for a walker, 0.55 for a wagon's
// driver - where it hung, wedged under the upper rail, bobbing. And met from the street at a run, the rail's under slope
// - its plane under the sphere's centre, but its quad's diagonal edge over it in a floor's direction - set a runner 0.3 m
// up on it. PH1's floor now obeys a ceiling as SH1's wall does - the sideways pass hands it the step ladder's (SH1: a step
// is a surface at most stepOffset over the feet), so a floor over it is none the body is set on - and it is a floor the
// body is UNDER, its own plane over the centre. Driven through the real PlayerMotor and Collider, on a fence built to
// 41206's measures and, with ARENA2, on the game's own three.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS, STEP_OFFSET } from '../../src/player/motor.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { trs } from '../../src/world/mat4.js';
import { skipReal, game } from '../lwRealTown.mjs';

const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A fence to 41206's measures on flat ground, its feet on y 0, its rails along z from -0.99 to 2.01: each rail a wedge
 *  - the street face at x 0 from y0 to y1, and two faces back to an edge at x -0.2, 0.15 over y0 - and its post, a
 *  triangular prism from the ground to 1.75 m at z -1.19..-0.84 in front of the street face (x 0.01..0.18). */
function madeFence() {
  const p = [], ix = [];
  const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...a, ...b, ...c, ...d); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  const z0 = -0.99, z1 = 2.01;
  for (const [y0, y1] of [[0.40, 0.65], [1.30, 1.55]]) {
    const ym = y0 + 0.15;
    quad([0, y0, z0], [0, y0, z1], [0, y1, z1], [0, y1, z0]);            // the street face
    quad([-0.2, ym, z0], [-0.2, ym, z1], [0, y0, z1], [0, y0, z0]);      // the under slope
    quad([0, y1, z0], [0, y1, z1], [-0.2, ym, z1], [-0.2, ym, z0]);      // the upper slope
  }
  quad([0.01, 1.75, -1.02], [0.01, 0, -1.02], [0.18, 0, -1.19], [0.18, 1.75, -1.19]);
  quad([0.01, 1.75, -1.02], [0.18, 1.75, -0.84], [0.18, 0, -0.84], [0.01, 0, -1.02]);
  quad([0.18, 0, -1.19], [0.18, 0, -0.84], [0.18, 1.75, -0.84], [0.18, 1.75, -1.19]);
  return { positions: new Float32Array(p), indices: new Uint32Array(ix) };
}
/** Square at the fence along +x from behind it (x -2) or along -x from the street (x 2), at `z`: a walker walking or
 *  running, or a wagon's driver at the gallop. Answers the body where it stands after two seconds. */
function square(col, z, { from = -2, mode = null, run = false } = {}) {
  const m = new PlayerMotor(col);
  m.spawn(from, 0.05, z);
  if (mode) m.transportMode = mode;
  const yaw = from < 0 ? Math.PI / 2 : -Math.PI / 2;
  for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, yaw);
  for (let i = 0; i < 120; i++) m.update(FIXED_DT, { ...IDLE, forward: 1, run: run || !!mode }, yaw);
  return m;
}
const BODIES = [{ who: 'a walker', run: false }, { who: 'a runner', run: true }, { who: 'a wagon\'s driver', mode: TRANSPORT_MODES.Cart }];

/** Where along a fence's rails a body meets them clear of its post and its ends: its rails' vertices (between 0.3 and
 *  0.7 m over its foot) run z0..z1, its post's (in front of the street face) p0..p1. */
function railStations(positions, foot) {
  let z0 = Infinity, z1 = -Infinity, p0 = Infinity, p1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1] - foot, z = positions[i + 2];
    if (x > 0.005) { p0 = Math.min(p0, z); p1 = Math.max(p1, z); } else if (y > 0.3 && y < 0.7) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  }
  const out = [];
  for (let z = z0 + 0.4; z <= z1 - 0.4; z += 0.25) if (z < p0 - 0.5 || z > p1 + 0.5) out.push(z);
  return out;
}
/** Every body, square at the rails from behind along their length: on the ground, its capsule against the back edge,
 *  never on it, under it or through it; and from the street, against the street face as it always was. */
function fenceHolds(col, back, front, stations, label) {
  assert.ok(stations.length >= 6, `${label}: stations along its rails (${stations.length})`);
  for (const b of BODIES) {
    for (const z of stations) {
      const m = square(col, z, b);
      assert.ok(Math.abs(m.pos[1]) < 0.01, `${label}, ${b.who} from behind at z ${z.toFixed(2)}: on the ground (feet ${m.pos[1].toFixed(3)} - hung on the rail)`);
      assert.ok(Math.abs(m.pos[0] - (back - CAPSULE_RADIUS)) < 0.03, `${label}, ${b.who} from behind at z ${z.toFixed(2)}: against its back edge (x ${m.pos[0].toFixed(3)})`);
      const s = square(col, z, { ...b, from: 2 });
      assert.ok(Math.abs(s.pos[1]) < 0.01 && Math.abs(s.pos[0] - (front + CAPSULE_RADIUS)) < 0.03, `${label}, ${b.who} from the street at z ${z.toFixed(2)}: against its face (x ${s.pos[0].toFixed(3)}, feet ${s.pos[1].toFixed(3)})`);
    }
  }
}

/** A runner square at the street face every 2 cm along the rails: never set on the under slope (its quad's diagonal edge
 *  holds a band of them, 0.3 m up, where PH1 read it as a floor over the sphere). */
function streetFaceHolds(col, front, stations, label) {
  const lo = Math.min(...stations), hi = Math.max(...stations);
  let n = 0;
  for (let z = lo; z <= hi + 1e-9; z += 0.02, n++) {
    const s = square(col, z, { run: true, from: 2 });
    assert.ok(Math.abs(s.pos[1]) < 0.01 && Math.abs(s.pos[0] - (front + CAPSULE_RADIUS)) < 0.03, `${label}, a runner from the street at z ${z.toFixed(2)}: against its face (x ${s.pos[0].toFixed(3)}, feet ${s.pos[1].toFixed(3)})`);
  }
  assert.ok(n > 50);
}

test('RAIL-HANG a fence built to 41206\'s measures: a walker, a runner and a wagon\'s driver square at its rails from behind stand on the ground against them - they hung on the lower rail\'s back edge, 0.39 m and 0.55 m up - and from the street against its face, where a runner was set on the under slope (mutants: the sideways pass\'s ceiling dropped; PH1\'s floor over the ceiling kept; a plane under the sphere taken for a floor over it)', () => {
  const col = new Collider(() => 0);
  const f = madeFence();
  col.addMesh('fence', f.positions, f.indices, I4);
  fenceHolds(col, -0.2, 0, railStations(f.positions, 0), 'the made fence');
  streetFaceHolds(col, 0, railStations(f.positions, 0), 'the made fence');
});

test('RAIL-HANG what the ceiling leaves alone: a ledge a step high is still stepped onto from the side, one over a step is not, and a body whose lower sphere sank a hand under a floor is still set back on it (PH1)', () => {
  for (const [h, onto] of [[0.45, true], [0.55, false]]) {
    const col = new Collider(() => 0);
    const p = [], ix = [];
    const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...a, ...b, ...c, ...d); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
    quad([0, 0, -3], [0, 0, 3], [0, h, 3], [0, h, -3]);       // its riser
    quad([0, h, -3], [0, h, 3], [30, h, 3], [30, h, -3]);     // its top
    col.addMesh('ledge', new Float32Array(p), new Uint32Array(ix), I4);
    const m = square(col, 0, { run: true });
    assert.equal(Math.abs(m.pos[1] - h) < 0.01, onto, `a ${h} m ledge: ${onto ? 'stepped onto' : 'a wall'} (feet ${m.pos[1].toFixed(3)}, x ${m.pos[0].toFixed(2)})`);
  }
  assert.ok(0.45 < STEP_OFFSET && STEP_OFFSET < 0.55);
  // PH1's own cases: a floor slab whose plane the lower sphere's centre crossed is still its floor - a hand under it
  // (the sideways pass sets it back, its floor under the ceiling), and deeper (the vertical pass does, as it did)
  for (const sunk of [0.4, 0.6]) {
    const col = new Collider(() => -Infinity);
    col.addMesh('dungeon', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
    const feet = [0, -sunk, 0];
    const out = col.move(feet, 0.05, 0, 0, 1.8);
    assert.ok(Math.abs(feet[1]) < 0.01 && out.grounded, `feet ${sunk} m under: set back on its floor (feet ${feet[1].toFixed(3)})`);
  }
});

test('RAIL-HANG with ARENA2: the game\'s own split-rail fences, 41206, 41207 and 41208, each stood on flat ground as a block stands it - every body square at the rails from behind stands on the ground against them, and from the street against their face', { skip: skipReal }, () => {
  const { modelOf } = game();
  for (const id of [41206, 41207, 41208]) {
    const m = modelOf(id);
    const P = m.positions;
    let foot = Infinity, back = Infinity, front = -Infinity;
    for (let i = 0; i < P.length; i += 3) foot = Math.min(foot, P[i + 1]);
    for (let i = 0; i < P.length; i += 3) if (P[i + 1] - foot > 0.3 && P[i + 1] - foot < 0.7) { back = Math.min(back, P[i]); front = Math.max(front, P[i]); }
    assert.ok(Math.abs(back + 0.2) < 0.01 && Math.abs(front) < 0.01, `${id}: its lower rail from x -0.2 to 0`);
    const col = new Collider(() => 0);
    col.addMesh(`m${id}`, P, m.indices, trs(0, -foot, 0, 0, 0, 0));
    fenceHolds(col, back, front, railStations(P, foot), String(id));
    streetFaceHolds(col, front, railStations(P, foot), String(id));
  }
});

test('RAIL-HANG THE LAW WHERE IT IS WRITTEN: a walking step\'s sideways pass and ladder hand PH1\'s floor the stand ceiling, for that floor alone, the vertical pass none; and that floor is set on only under it and only where its own plane stands over the sphere - every other pass\'s floor as it was', () => {
  const col = rd('src/player/collider.js');
  assert.match(col, /    this\._floorCeil = dy === 0 \? standCeil : Infinity;\n    this\._resolveCapsule\(feet, hOut, height, Infinity, true\);/, 'a walking step\'s sideways pass: its walls as they were, its floor under the ceiling');
  assert.match(col, /    this\._floorCeil = Infinity;   \/\/ RAIL-HANG: the vertical pass's floor as it was\n    out\.sides = sides;/, 'and the ladder\'s, the vertical pass\'s as it was');
  assert.match(col, /const setOn = floorAbove && \(this\._floorCeil === Infinity[^\n]*\n {12}\|\| \(!\(\(R \? center\[1\] - dy : t\[1\] \+ \(ly - dy\)\) > this\._floorCeil\) && planeOver\(tri, lx, ly, lz, R\)\)\);\n {10}if \(setOn\) \{/, 'a walking step\'s floor alone: under its ceiling, its plane over the sphere');
  assert.match(col, /this\._floorCeil = Infinity;   \/\/ FIELD BUGS 2026-10-25i RAIL-HANG/, 'none outside the pass');
});
