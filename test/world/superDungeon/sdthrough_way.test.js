// SD-THROUGH (2026-10-21, the owner: "So the abyss dungeon. When someone finds and enters the portal. I want a portal to
// show up for anyone in the dungeon and anyone entering that automatically leads them there."; bible/11-Multiplayer/
// Super-Dungeons.md section 6 and SD-THROUGH): THE WAY THROUGH. Once the first soul has stepped through a Hollow's Rift
// (the hub's record's `inAt` - its relay half is test/net/superDungeon/sdthrough_relay.test.js), a second Rift stands
// beside everyone in the Hollow and everyone who enters it, and leads to the Shattered Hour through the Rift's own door.
// Here: the law of when it stands (world/superDungeon/sdDungeon.js sdThroughStands) and where (sdThroughPlace), the
// module that stands it (scenes/superDungeon/sdThrough.js), the veil's pivot between the two rings, and the hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sdThroughStands, sdThroughPlace, SD_THROUGH_TEXT, SD_THROUGH_SIZE_M, SD_THROUGH_AHEAD_M, SD_THROUGH_NEAR_RIFT_M, SD_RIFT_MIN_M, SD_RIFT_AIR_M,
  SD_END_TEXT,
} from '../../../src/world/superDungeon/sdDungeon.js';
import { createSdThrough, sdVeilModelOf, SD_THROUGH_KEY, SD_THROUGH_ASK_MS } from '../../../src/scenes/superDungeon/sdThrough.js';
import { SD_RIFT_KEY, sdProbeOf } from '../../../src/scenes/superDungeon/sdEnd.js';
import { riftCentreY } from '../../../src/world/superDungeon/sdRiftModel.js';
import { sdRise, sdFind, sdEnter, sdFell, SD_NO_FALLEN } from '../../../src/net/superDungeon/sdLaw.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-6) => a.length === b.length && a.every((x, i) => close(x, b[i], eps));

/** An axis-aligned hall - x in [x0, x1], z in [z0, z1], its floor at y0, its ceiling `h` above - as the collider answers
 *  it (test/world/superDungeon/sd4b_rift.test.js's own); `pits` floors of another height inside it. */
function hall({ x0 = 0, x1 = 10, z0 = 0, z1 = 10, y0 = 0, h = 8, pits = [] } = {}) {
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  return {
    floor: (at) => {
      if (!inside(at[0], at[2])) return null;
      const p = pits.find((q) => at[0] >= q.x0 && at[0] <= q.x1 && at[2] >= q.z0 && at[2] <= q.z1);
      return p ? p.y : y0;
    },
    ray: (o, dir, max) => {
      let t = Infinity;
      if (dir[0] > 0) t = Math.min(t, (x1 - o[0]) / dir[0]); else if (dir[0] < 0) t = Math.min(t, (x0 - o[0]) / dir[0]);
      if (dir[2] > 0) t = Math.min(t, (z1 - o[2]) / dir[2]); else if (dir[2] < 0) t = Math.min(t, (z0 - o[2]) / dir[2]);
      if (dir[1] > 0) t = Math.min(t, (y0 + h - o[1]) / dir[1]); else if (dir[1] < 0) t = Math.min(t, (o[1] - y0) / -dir[1]);
      return t <= max ? t : null;
    },
  };
}
/** A renderer that keeps only what was asked of it. */
function fakeRenderer() {
  const r = { made: [], freed: [] };
  r.uploadTexture = () => {}; r.uploadEmissionTexture = () => {};
  r.createMesh = (m) => { const g = { m }; r.made.push(g); return g; };
  r.destroyMesh = (g) => r.freed.push(g);
  return r;
}

test('SD-THROUGH the law: the Way Through stands once the first soul went through - the record\'s `inAt` - while the Hollow is found and its boss stands, for its own slot alone (mutants: stood before anyone went through; stood after the kill; another slot\'s)', () => {
  const risen = sdRise(null, T0, 3);
  const found = sdFind(risen, T0 + 60_000, 'Mara');
  const entered = sdEnter(found, T0 + 120_000);
  assert.equal(entered.inAt, T0 + 120_000);
  assert.equal(sdThroughStands(null, risen.s, T0), false, 'no record heard');
  assert.equal(sdThroughStands(risen, risen.s, T0), false, 'risen: nobody can have gone through');
  assert.equal(sdThroughStands(found, found.s, T0 + 130_000), false, 'found, nobody through yet');
  assert.equal(sdThroughStands(entered, entered.s, T0 + 130_000), true, 'one went through');
  assert.equal(sdThroughStands(entered, entered.s + 1, T0 + 130_000), false, 'another slot\'s');
  assert.equal(sdThroughStands(sdFell(entered, T0 + 200_000, { top: 'Ann', n: 2 }), entered.s, T0 + 200_001), false, 'the kill: out with the Return');
  assert.equal(sdThroughStands(entered, entered.s, entered.until), false, 'faded unbeaten');
  // its words: its own title, the Rift's own row - it leads where the Rift does
  assert.deepEqual(SD_THROUGH_TEXT, { title: 'The Way Through', to: 'To the Shattered Hour', opens: 'The Rift stands open. The Way Through opens beside you.' });
  assert.equal(SD_THROUGH_TEXT.to, SD_END_TEXT.riftTo);
  assert.equal(SD_THROUGH_SIZE_M, SD_RIFT_MIN_M, 'the Rift\'s least ring - it stands in a corridor');
});

test('SD-THROUGH the place: ahead along my heading, three metres on - its face turned to me; round to the next bearing where a wall stands ahead or its ring would not stand clear; never onto another floor; boxed in, at my feet facing my way (mutants: behind me; through the wall; its face away; onto the pit)', () => {
  const big = hall({ x1: 40, z1: 40, h: 12 });
  const a = sdThroughPlace([20, 0, 20], 0, big);
  assert.ok(closeV(a.at, [20, 0, 20 + SD_THROUGH_AHEAD_M]) && a.size === SD_THROUGH_SIZE_M, JSON.stringify(a));
  assert.ok(closeV(a.face, [0, 0, -1]), 'its face turned to me');
  const b = sdThroughPlace([20, 0, 20], Math.PI / 2, big);
  assert.ok(closeV(b.at, [20 + SD_THROUGH_AHEAD_M, 0, 20]) && closeV(b.face, [-1, 0, 0]), JSON.stringify(b));
  // a wall a metre ahead: never through it - beside me, on my floor, its ring clear of every wall by its air
  const w = sdThroughPlace([20, 0, 39], 0, big);
  assert.ok(w.at[2] < 40 && w.at[0] > 0 && w.at[0] < 40 && w.at[1] === 0, JSON.stringify(w));
  assert.ok(close(Math.hypot(w.at[0] - 20, w.at[2] - 39), SD_THROUGH_AHEAD_M), 'still three metres on');
  const R = SD_THROUGH_SIZE_M / 2 + SD_RIFT_AIR_M, across = [-w.face[2], 0, w.face[0]];
  for (const s of [1, -1]) assert.ok(w.at[2] + s * across[2] * R <= 40 && w.at[0] + s * across[0] * R <= 40, 'its rim inside the hall');
  assert.ok(close(w.face[0] * (20 - w.at[0]) + w.face[2] * (39 - w.at[2]), SD_THROUGH_AHEAD_M), 'its face turned to me');
  // a pit where it would stand: the next bearing, never the other floor
  const p = sdThroughPlace([20, 0, 20], 0, hall({ x1: 40, z1: 40, h: 12, pits: [{ x0: 18, x1: 22, z0: 22, z1: 24, y: -3 }] }));
  assert.ok(p.at[1] === 0 && !(p.at[0] >= 18 && p.at[0] <= 22 && p.at[2] >= 22 && p.at[2] <= 24), JSON.stringify(p));
  // a closet: at my feet, facing my heading
  const c = sdThroughPlace([1, 0, 1], Math.PI / 2, hall({ x1: 2, z1: 2 }));
  assert.ok(closeV(c.at, [1, 0, 1]) && closeV(c.face, [1, 0, 0]), JSON.stringify(c));
  // a corridor too narrow for its air: straight ahead still, the first spot reached (no bearing stands it clearer)
  const k = sdThroughPlace([1.5, 0, 5], 0, hall({ x1: 3, z1: 40 }));
  assert.ok(closeV(k.at, [1.5, 0, 5 + SD_THROUGH_AHEAD_M]), JSON.stringify(k));
  // the same answer every time
  assert.deepEqual(sdThroughPlace([20, 0, 39], 0, big), w);
  // the end's one probe over a collider: its floor from a metre over a point, its ray's clear distance
  const probe = sdProbeOf({ raycast: (o, d, max) => (d[1] < 0 ? 1.25 : max > 5 ? 4 : Infinity) });
  assert.equal(probe.floor([0, 2, 0]), 1.75);
  assert.equal(probe.ray([0, 0, 0], [1, 0, 0], 12), 4);
  assert.equal(probe.ray([0, 0, 0], [1, 0, 0], 3), null);
});

test('SD-THROUGH the module: asked once a second, it stands beside me the first time the word says one went through and the Rift admits me - its line said once, its key in the ray, its own name on the plaque, its press and its walk-in the Rift\'s own step; out with the Return when the boss falls, for good (mutants: never asked; asked every frame; stood for one the Hour refused; stood twice; never taken out; the Rift\'s key)', () => {
  let clock = 1000, asks = 0, steps = 0;
  const said = [];
  let w = { word: null, returns: true, through: false, count: 'Fades in 3:00:00' };
  const r = fakeRenderer(), draws = [];
  const th = createSdThrough({ renderer: r, now: () => clock, word: () => { asks++; return w; }, onStep: () => { steps++; return true; }, say: (t) => said.push(t), probe: hall({ x1: 40, z1: 40, h: 12 }), riftOf: () => ({ at: [5, 0, 5] }), dynamicDraws: draws });
  const frame = (feet = [20, 0, 20], yaw = 0) => { clock += 16; return th.frame(feet, yaw, null); };
  frame();
  assert.equal(asks, 1, 'the first frame I stand here');
  for (let k = 0; k < 10; k++) frame();
  assert.equal(asks, 1, 'once a second, never every frame');
  assert.equal(th.stands, false, 'nobody through yet');
  w = { ...w, through: true };
  clock += SD_THROUGH_ASK_MS;
  frame();
  assert.equal(asks, 2);
  assert.equal(th.stands, true, 'one went through: beside me');
  assert.ok(closeV(th.rift.at, [20, 0, 20 + SD_THROUGH_AHEAD_M]), JSON.stringify(th.rift));
  assert.equal(th.rift.size, SD_THROUGH_SIZE_M);
  assert.deepEqual(said, [SD_THROUGH_TEXT.opens]);
  assert.ok(draws.length > 0 && draws.length === r.made.length, 'its meshes among the level\'s draws');
  assert.deepEqual(th.targets().map((t) => t.key), [SD_THROUGH_KEY]);
  assert.equal(SD_THROUGH_KEY.startsWith('sdrift:') && SD_THROUGH_KEY !== SD_RIFT_KEY, true, 'the press ladder\'s Rift arm, its own key');
  assert.deepEqual(th.hoverName(SD_THROUGH_KEY), { title: 'The Way Through', subs: ['To the Shattered Hour', 'Fades in 3:00:00'] });
  assert.equal(th.hoverName(SD_RIFT_KEY), null, 'the Rift\'s key is the Rift\'s');
  assert.equal(th.press(SD_RIFT_KEY), false);
  assert.equal(th.press(SD_THROUGH_KEY), true);
  assert.equal(steps, 1, 'pressed: the Rift\'s own step');
  // walked into: the Rift's own latch - outside, then inside
  for (const z of [21, 22, 22.6, 23]) frame([20, 0, z]);
  assert.equal(steps, 2, 'walked in');
  // stood once: the word asked again moves nothing while its boss stands
  clock += SD_THROUGH_ASK_MS;
  frame([0.5, 0, 0.5]);
  assert.ok(closeV(th.rift.at, [20, 0, 20 + SD_THROUGH_AHEAD_M]), 'never moved');
  assert.deepEqual(said, [SD_THROUGH_TEXT.opens], 'said once');
  // the boss falls: out, for good
  w = { ...w, returns: false };
  clock += SD_THROUGH_ASK_MS;
  frame();
  assert.equal(th.stands, false);
  assert.deepEqual(th.targets(), []);
  assert.equal(r.freed.length, r.made.length, 'every mesh freed');
  assert.deepEqual(draws, [], 'and out of the draws');
  w = { ...w, returns: true, through: true };
  clock += SD_THROUGH_ASK_MS;
  const n = asks;
  frame();
  assert.equal(th.stands, false, 'never again this visit');
  assert.equal(asks, n, 'and never asked again');
  // the Hour refused me for good: none opens
  const refused = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => ({ word: SD_NO_FALLEN, returns: true, through: true }), probe: hall({ x1: 40, z1: 40 }) });
  refused.frame([20, 0, 20], 0);
  assert.equal(refused.stands, false, 'one the Hour will not take back');
  // no feet, no ask; no probe, no stand
  let quietAsks = 0;
  const unplaced = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => { quietAsks++; return { word: null, returns: true, through: true }; } });
  unplaced.frame(null, 0);
  assert.equal(quietAsks, 0, 'no feet: nothing asked');
  unplaced.frame([1, 0, 1], 0);
  assert.equal(unplaced.stands, false, 'no collider: nowhere to stand it');
  // gone with the dungeon
  const g = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => ({ word: null, returns: true, through: true }), probe: hall({ x1: 40, z1: 40 }) });
  g.frame([20, 0, 20], 0);
  assert.equal(g.stands, true);
  g.clear();
  assert.equal(g.stands, false);
  clock += SD_THROUGH_ASK_MS;
  g.frame([20, 0, 20], 0);
  assert.equal(g.stands, false, 'cleared: never stood again');
});

test('SD-THROUGH by the Rift: standing within SD_THROUGH_NEAR_RIFT_M of the Hollow\'s Rift when it is first asked, none opens this visit - one back from the Hour lands beside it - and walking off later stands none either; a floor far below it is not near it (mutants: the Rift never asked; asked across the floor plan alone; stood when I walk off)', () => {
  let clock = 1000;
  const word = () => ({ word: null, returns: true, through: true });
  const probe = hall({ x1: 60, z1: 60, h: 12 });
  const near = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word, probe, riftOf: () => ({ at: [10, 0, 10] }) });
  near.frame([10, 0, 10 + SD_THROUGH_NEAR_RIFT_M - 0.5], 0);
  assert.equal(near.stands, false, 'the Rift is right there');
  clock += SD_THROUGH_ASK_MS;
  near.frame([40, 0, 40], 0);
  assert.equal(near.stands, false, 'decided for the visit');
  const far = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word, probe, riftOf: () => ({ at: [10, 0, 10] }) });
  far.frame([10, 0, 10 + SD_THROUGH_NEAR_RIFT_M + 0.5], 0);
  assert.equal(far.stands, true, 'past its reach');
  const below = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word, probe, riftOf: () => ({ at: [10, 40, 10] }) });
  below.frame([10, 0, 12], 0);
  assert.equal(below.stands, true, 'the Rift a floor far above: not right there');
});

test('SD-THROUGH the veil\'s pivot: the nearer of the Hollow\'s two rings to the eye - the Way Through\'s window or the Rift\'s (else its Return\'s window home); either alone; nothing made a frame (mutants: always the Rift\'s; the farther)', () => {
  const m = (x, y, z) => { const a = new Float32Array(16); a[12] = x; a[13] = y; a[14] = z; return a; };
  const through = { window: { model: m(0, 1, 3) } }, end = { window: { model: m(0, 1, 30) } }, bay = { window: null, bay: { model: m(0, 1, 2) } };
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, end), through.window.model, 'the Way Through, beside me');
  assert.equal(sdVeilModelOf([0, 1.6, 29], through, end), end.window.model, 'at the Rift');
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, bay), bay.bay.model, 'the Return\'s window, nearer');
  assert.equal(sdVeilModelOf([0, 1.6, 0], null, end), end.window.model, 'no Way Through: the Rift\'s, as before');
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, null), through.window.model);
  assert.equal(sdVeilModelOf(null, through, end), through.window.model, 'no eye: the Way Through\'s');
  assert.equal(sdVeilModelOf([0, 0, 0], null, null), null);
  const T = read('src/scenes/superDungeon/sdThrough.js');
  const body = T.slice(T.indexOf('export function sdVeilModelOf('), T.indexOf('/**', T.indexOf('function far2(')));
  assert.ok(body.length > 100);
  assert.doesNotMatch(body, /new |[=(,:]\s*\[|=>|\.\.\./, 'nothing made: no array, no closure, no spread');
});

test('SD-THROUGH the hosts by source: the dungeon host makes the Way Through for a Hollow alone - the Rift\'s step, word and look - frames it beside the Rift with my heading, offers it to the ray, names it, presses it, draws and lights it and frees it; the world host\'s word carries `through` and its pass draws the second ring, its veil on the nearer; the mode machine\'s press arm takes its key (mutants: the Hour stands one; never framed; never freed)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdThrough = _superTier \? createSdThrough\(\{ renderer, audio, word: \(\) => sdEndWord\(\), look: \(\) => \(opts\.superRiftLook \? opts\.superRiftLook\(dfLocation\?\.sdSlot\) : sdEndWord\(\)\?\.look\) \?\? null, clock: sdEndClock, onStep: \(\) => sdRiftStep\(\), say: \(t\) => \{ if \(!opts\.sdSay\?\.\(t\)\) setMidScreenText\(t\); \}, probe: sdProbeOf\(collider\), riftOf: \(\) => sdEnd\.rift, dynamicDraws \}\) : null;/);
  assert.match(D, /sdEnd\.frame\(playerFeet \?\? null, playerFeet \? _sdEye : null\);\n\s*sdThrough\?\.frame\(playerFeet \?\? null, _fpYaw, playerFeet \? _sdEye : null\);/, 'framed beside the Rift, my heading latched this frame');
  assert.match(D, /if \(sdThrough\) targets\.push\(\.\.\.sdThrough\.targets\(\)\);/);
  assert.match(D, /\(key\) => sdEnd\?\.hoverName\(key\) \?\? sdThrough\?\.hoverName\(key\) \?\? null,/);
  assert.match(D, /sdPress\(key\) \{ return !!sdEnd\?\.press\(key\) \|\| !!sdThrough\?\.press\(key\) \|\| !!sdHall\?\.press\(key\); \},/);
  assert.match(D, /sdThroughLook: sdThrough \? \(eye, sky, hour\) => sdThrough\.look\(eye, sky, hour\) : undefined,/);
  assert.match(D, /sdEndWith\(sdEnd\.halos\(\), sdHall\?\.halos\(\) \?\? sdThrough\?\.halos\(\), _sdEndHalos\)/);
  assert.match(D, /sdEndWith\(sdEnd\.lights\(\), sdHall\?\.lights\(\) \?\? sdThrough\?\.lights\(\), _sdEndLights\)/);
  assert.match(D, /sdEnd\?\.clear\(\);[^\n]*\n\s*sdThrough\?\.clear\(\);/);
  const W = read('src/scenes/world.js');
  assert.match(W, /through: sdThroughStands\(rec, s, now\),/);
  assert.match(W, /const through = end\.sdThroughLook\?\.\(eye, sky \? _sdRiftSky : null, minuteNow\(\) \/ 60\) \?\? null;/);
  assert.match(W, /sdVeilAim\(proj, view, sdVeilModelOf\(eye, through, look\)\);/);
  assert.match(W, /if \(through && pass\?\.draw\(proj, view, through, fog, renderer\.lightingLane \? SD_SKY_STEPS\.lane : SD_SKY_STEPS\.classic\)\) drew = true;/);
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /if \(key\.startsWith\('sdrift:'\)/, 'its key rides the Rift\'s arm');
  // the Rift's own law beneath it: one module, a ring of the Rift's (its key and title its own)
  const T = read('src/scenes/superDungeon/sdThrough.js');
  assert.match(T, /createSdEnd\(\{ renderer, audio, now, onRift: onStep, riftKey: SD_THROUGH_KEY, riftTitle: SD_THROUGH_TEXT\.title, riftTo: SD_THROUGH_TEXT\.to,/);
  assert.equal(riftCentreY(SD_THROUGH_SIZE_M) > SD_THROUGH_SIZE_M / 2, true, 'it hovers a hand\'s breadth, as the Rift does');
});
