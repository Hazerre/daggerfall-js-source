// AIM-ENDS (2026-10-24, Discord - "Aiming front ship cannons impossible": "the camera should move to the front/back
// accordingly when aiming") - THE AIM CAMERA OVER THE BOW AND THE STERN, alone: scenes/naval/aimCamera.js on a stand-in
// boat, so the walk out past her own canvas is pinned on a sail that stands where the eye was asked to (the galleon's
// and the carrack's stand clear of theirs - test/systems/naval/navaudit_helm.test.js H8 pins the galleon at the helm).
// The law is bible/03-World/Naval-Combat.md AIM-ENDS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAimCamera, clearOfRig, AIM_CAM_AHEAD, AIM_CAM_UP, AIM_CAM_CLEAR, AIM_CAM_OUT } from '../../../src/scenes/naval/aimCamera.js';
import { dropArc, segmentBoxEntry } from '../../../src/systems/naval/navalBallistics.js';
import { HULL, batteryOf } from '../../../src/systems/naval/navalShips.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const ID = [0, 0, 0, 1];
/** An axis-aligned box as the naval boxes are shaped: its middle, its unit axes, its half sizes. */
const box = (c, h) => ({ c, ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h });
const centre = (side) => {
  const m = batteryOf(HULL.SmallShip, side).muzzles;
  return m.reduce((s, p) => [s[0] + p[0] / m.length, s[1] + p[1] / m.length, s[2] + p[2] / m.length], [0, 0, 0]);
};
/** The camera on a galleon at the origin, facing north, with `side` laid and `rig` her canvas. */
function camera({ side = 'bow', rig = [], alongside = [], wrecked = false, on = true } = {}) {
  const boat = { hull: HULL.SmallShip };
  const state = { aiming: true, aim: { side } };
  const cam = createAimCamera({
    setting: (k, d) => (k === 'AimCamera' ? on : d), aiming: () => state.aiming, aim: () => state.aim, boat: () => boat,
    wrecked: () => wrecked, pose: () => ({ position: [0, 0, 0], rotation: ID }), rig: () => rig, alongside: () => alongside,
  });
  const settle = (own = [0, 5, 0]) => { let e = own; for (let i = 0; i < 80; i++) e = cam.eye(own, 0.1); return e; };
  return { cam, state, settle };
}

test('AIM-ENDS the ends: with the bow chasers laid the eye stands AIM_CAM_AHEAD ahead of them along her keel and AIM_CAM_UP over them; with the stern\'s barrels AIM_CAM_AHEAD astern - never at the broadside\'s place out over her side (mutants: the ends at the broadside\'s place, the ahead turned aft)', () => {
  const c = centre('bow');
  const bow = camera().settle();
  for (let i = 0; i < 3; i++) near(bow[i], [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD][i], 1e-6, 'over the bow');
  const s = centre('stern');
  const stern = camera({ side: 'stern' }).settle();
  for (let i = 0; i < 3; i++) near(stern[i], [s[0], s[1] + AIM_CAM_UP, s[2] - AIM_CAM_AHEAD][i], 1e-6, 'over the stern');
  const b = centre('starboard');
  const broad = camera({ side: 'starboard' }).settle();
  near(broad[0], b[0] + AIM_CAM_OUT, 1e-6, 'a broadside still out over her side');
});

test('AIM-ENDS her own canvas: a sail standing where the eye over her bow was asked to stand steps it on along her keel, AIM_CAM_CLEAR clear of it - through one sail and the next it meets on the way - and never sideways or up; a sail elsewhere moves nothing (mutants: the rig unwalked, the walk stopped at the first sail, the clearance dropped)', () => {
  const c = centre('bow');
  const want = [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD];
  const jib = box([0, want[1], want[2] - 0.5], [1, 1, 2]);   // her canvas from 1.5 m behind the eye to 2.5 m ahead of it
  const eye = camera({ rig: [jib] }).settle();
  near(eye[0], want[0], 1e-9, 'not sideways');
  near(eye[1], want[1], 1e-9, 'not up');
  near(eye[2], jib.c[2] + jib.h[2] + AIM_CAM_CLEAR, 1e-2, 'AIM_CAM_CLEAR past the sail\'s fore edge');
  const sprit = box([0, want[1], jib.c[2] + jib.h[2] + 2], [1, 1, 1.5]);   // a second, met only once past the first
  const two = camera({ rig: [sprit, jib] }).settle();
  near(two[2], sprit.c[2] + sprit.h[2] + AIM_CAM_CLEAR, 1e-2, 'and past the next it meets');
  const aloft = box([0, want[1] + 10, want[2]], [1, 1, 2]);
  const clear = camera({ rig: [aloft] }).settle();
  for (let i = 0; i < 3; i++) near(clear[i], want[i], 1e-9, 'a sail aloft moves nothing');
  // the walk itself, astern: out the sail's aft edge
  const aft = clearOfRig([0, 5, -10], [0, 0, -1], [box([0, 5, -9], [1, 1, 3])]);
  near(aft[2], -12 - AIM_CAM_CLEAR, 1e-2, 'astern out its aft edge');
  assert.ok(!segmentBoxEntry(aft, aft, box([0, 5, -9], [1, 1, 3]), AIM_CAM_CLEAR - 1e-6), 'and clear of it');
});

test('AIM-ENDS never: the Broadside camera off, a crippled ship or nothing laid leave the eye its own over the bow and the stern as over a side; a ship ahead stops it AIM_CAM_CLEAR short of her (mutants: the setting unread, the wreck unread)', () => {
  const own = [0, 5, 0];
  assert.equal(camera({ on: false }).settle(own), own, 'switched off');
  assert.equal(camera({ wrecked: true, side: 'stern' }).settle(own), own, 'crippled');
  const idle = camera();
  idle.state.aiming = false;
  assert.equal(idle.settle(own), own, 'nothing laid');
  const c = centre('bow');
  const want = [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD];
  const ahead = box([0, 0, want[2] + 0.5], [6, 20, 0.5]);
  const eye = camera({ alongside: [ahead] }).settle(own);
  const hit = segmentBoxEntry(c, want, ahead, AIM_CAM_CLEAR);
  assert.ok(hit && hit.t > 0 && hit.t < 1);
  for (let i = 0; i < 3; i++) near(eye[i], hit.point[i], 1e-6, 'short of the ship ahead');
});

test('AIM-ENDS the barrel\'s fall: dropArc runs from the stern\'s rail to the barrel\'s mark, its way out even and its height falling with the square of it - no rise (mutants: the fall straight, the way uneven)', () => {
  const pts = dropArc([0, 5, -20], [0, 0, -21.5], 5);
  assert.equal(pts.length, 5);
  assert.deepEqual(pts[0], [0, 5, -20]);
  assert.deepEqual(pts[4], [0, 0, -21.5]);
  near(pts[2][2], -20.75, 1e-12, 'half the way out at the middle point');
  near(pts[2][1], 5 - 5 * 0.25, 1e-12, 'a quarter of the fall at half the way');
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] <= pts[i - 1][1], 'never rising');
});
