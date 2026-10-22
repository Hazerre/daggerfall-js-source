// FIELD BUGS 2026-10-21d PASSAGE-HANDS, PASSAGE-IN and PASSAGE-PLATE (Harlander, the Discord's #bug-reports, "Booked
// ocean passage ...": "You can steer the ship as if it was yours", "Fast travel gets stuck on docks and tries to path up
// onto land", "The ship control controls appear on top of the fast travel controls", "Boats go at slow time compression
// for unclear reasons"). The record: bible/01-Overview/bugs/Field-Bugs-2026-10-21d.md.
//
// HANDS: Come Sail Away's real runtime (test/csaScene.mjs) with a booked Large Boat at her helm, her master's hand
// pressing it (systems/seaHelm.js, as world.js tvSeaSail does), and the mod's input seam lifted out of world.js (its
// `has` and `started`) wrapped as the host wraps it (scenes/naval/passageHelm.js passengerHelm). IN: the voyage's law
// (passage.js voyageSails), the sailed leg's mark (systems/travel/seaMark.js) - on the real map's built ground where
// ARENA2 stands (test/portTerrain.mjs) - and the town rings (travelRoute.js routeLegs). PLATE: the naval plate's cover,
// lifted out of world.js.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scene } from '../../csaScene.mjs';
import { portTerrain } from '../../portTerrain.mjs';
import { BOAT_ACTIONS } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { seaHelmStep, createSeaHelm, headingOf, squareOnly } from '../../../src/systems/seaHelm.js';
import { quatRotate } from '../../../src/world/quat.js';
import { HELM_RUDDER_ACTIONS } from '../../../src/systems/inputActions.js';
import { createJourneyHand, passengerHelm, passengerCard, PASSENGER_KEYS } from '../../../src/scenes/naval/passageHelm.js';
import { voyageSails, passageDestinations } from '../../../src/systems/naval/passage.js';
import { seaLegMark, PIXEL_UNITS, PIXEL_TILES } from '../../../src/systems/travel/seaMark.js';
import { routeLegs, planRoute, routeGround, VOYAGE_LANDFALL_PX } from '../../../src/systems/travel/travelRoute.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const WORLD = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
/** One line of world.js, by its start. */
const line = (head) => { const i = WORLD.indexOf(head); assert.ok(i >= 0, `${head} is in world.js`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
/** A function of world.js's, whole. */
const fn = (head) => { const i = WORLD.indexOf(head); assert.ok(i >= 0, head); return WORLD.slice(i, WORLD.indexOf('\n  }\n', i) + 4); };
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

// ── PASSAGE-HANDS ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A voyage of `seconds` due north under her master's hand, the passenger's keys held and pressed as `play` says - the
 *  boat a charter (`booked`) or mine. Answers where she ends and how she went. */
function voyage({ booked = true, seconds = 160, viewUp = true, autorun = false, master = true, play = () => {} } = {}) {
  const s = scene({ heightMapValue: () => 0, settings: { 'Waves.Enable': false } });
  s.deps.handling = () => 'responsive';
  for (const t of s.terrains) t.tileMap.fill(0);   // open water everywhere
  const keys = new Set(), latch = { edge: { downFrame: new Set() } };
  const csaHelmInput = { edges: new Set(), chord: new Set(), held: new Set() };
  const csaJourneyHelm = createJourneyHand();
  const scope = {
    keys, latch, held: (k, a) => k.has(a), pressed: (e, _k, a) => e.downFrame.has(a), csaHelmInput, csaJourneyHelm,
    HELM_RUDDER_ACTIONS, helmTurnKeys: () => true, travelView: { active: viewUp }, CSA_BOAT_ACTIONS: BOAT_ACTIONS,
  };
  const raw = mount(scope, `const __i = { ${line('      has: (action) => held(keys, action) ||')}${line('      started: (action) => !(travelView?.active &&')} horizontal: () => 0, vertical: () => 0, toggleAutorun: ${autorun} };`, '__i');   // the player's own autorun (world.js player.toggleAutorun)
  const boatRef = { boat: null };
  s.deps.input = passengerHelm(raw, () => s.rt.state.CurrentBoat, csaJourneyHelm);
  const boat = s.place(1, 0, [100, 34, 200], [0, 0, 1]);
  if (booked) boat.charter = { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk', captain: 'Ada Lark', fare: 50 };
  boatRef.boat = boat;
  s.helm(boat);
  const mark = [100, 200 + 20000];
  const st = createSeaHelm();
  const track = [];
  let sailsUp = false;
  for (let t = 0; t < seconds; t += 0.25) {
    s.rt.state.windVectorTarget = [1.5, 0, 0]; s.rt.state.windVectorCurrent = [1.5, 0, 0];
    const p = boat.GameObject.position, fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]), v = s.rt.state.velocityCurrent ?? [0, 0, 0], w = s.rt.state.windVectorCurrent;
    const cmd = seaHelmStep(st, { heading: headingOf(fw[0], fw[2]), bearing: headingOf(mark[0] - p[0], mark[1] - p[2]), wind: [w[0], w[2]], hasSails: boat.Sails.length > 0, squareOnly: squareOnly(boat), sailsUp: s.rt.state.sailPosition > 0, canSail: s.rt.CanSail(boat), way: v[2], dt: 0.25, crewed: !!boat.crewed, oarWay: s.rt.oarWayOf(boat), sailWay: s.rt.sailWayOf(boat), free: !!s.rt.helmResponsive() });
    // world.js tvSeaSail: the hand's holds, its row and its own taps
    csaJourneyHelm.held.clear();
    if (master && cmd.turn > 0) csaJourneyHelm.held.add('MoveRight'); else if (master && cmd.turn < 0) csaJourneyHelm.held.add('MoveLeft');
    csaJourneyHelm.row = master && cmd.row;   // `master` false: the voyage halted (a foe near) - his hand off the helm
    if (master && cmd.sails) csaJourneyHelm.press(BOAT_ACTIONS.toggleSail);
    keys.clear(); latch.edge.downFrame.clear();
    play(t, keys, latch.edge.downFrame, csaHelmInput);
    s.rt.endOfFrame(); s.rt.fixedUpdate(); s.rt.update(); s.rt.lateUpdate();
    s.world.time += 0.25;
    // world.js csaUpdate: the frame's taps spent - the panel's and the journey's
    csaHelmInput.edges.clear(); csaHelmInput.chord.clear(); csaJourneyHelm.edges.clear();
    sailsUp ||= s.rt.state.sailPosition > 0;
    track.push({ t, x: p[0], z: p[2], rung: s.rt.state.oarThrottle, light: !!boat.LightOn, sails: s.rt.state.sailPosition });
  }
  return { s, boat, track, sailsUp, at: s.rt.state.CurrentBoat === boat && s.rt.isSailing(), end: [...boat.GameObject.position] };
}

test('PASSAGE-HANDS: the report - a passenger holding D (the strafe key the Overworld leaves them) under a booked ship\'s master - she sails her master\'s course exactly, raises her sails at his word; a boat of mine turns for the same key (mutants: the passenger\'s keys read, the journey\'s taps unread, the wrapper unwired)', () => {
  const alone = voyage();
  assert.equal(alone.sailsUp, true, 'her master raises her sails - his own tap reaches the mod through the seam');
  const hand = voyage({ play: (t, keys) => { if (t >= 40 && t < 70) keys.add('MoveRight'); } });
  assert.deepEqual(hand.end.map((v) => v.toFixed(3)), alone.end.map((v) => v.toFixed(3)), 'the passenger\'s D moved her not at all');
  const rowing = voyage({ autorun: true });
  assert.deepEqual(rowing.end.map((v) => v.toFixed(3)), alone.end.map((v) => v.toFixed(3)), 'nor their autorun - her oars pull at her master\'s word');
  // the voyage halted (a foe near: his hand off her helm) - she lies where she is, the passenger's autorun on or not
  const halted = voyage({ master: false, seconds: 40 }), haltedRow = voyage({ master: false, seconds: 40, autorun: true });
  assert.ok(Math.hypot(haltedRow.end[0] - halted.end[0], haltedRow.end[2] - halted.end[2]) < 0.01, 'the passenger\'s autorun rows her nowhere');
  const mineRow = voyage({ booked: false, master: false, seconds: 40, autorun: true });
  assert.ok(Math.hypot(mineRow.end[0] - halted.end[0], mineRow.end[2] - halted.end[2]) > 5, 'my own autorun pulls my oars');
  const mine = voyage({ booked: false });
  const mineD = voyage({ booked: false, play: (t, keys) => { if (t >= 40 && t < 70) keys.add('MoveRight'); } });
  assert.ok(Math.hypot(mineD.end[0] - mine.end[0], mineD.end[2] - mine.end[2]) > 20, 'a boat of mine answers my rudder still');
});

test('PASSAGE-HANDS: with the Overworld down (First Person Travel, a foe near, between her master\'s tries) the oars, the sails, the lantern and the panel\'s and pad\'s taps are her master\'s; the passenger keeps stepping from her helm (mutants: the passenger\'s presses read, the keys kept unread)', () => {
  const taps = (want) => (t, _keys, down, panel) => {
    for (const [at, a, viaPanel] of want) if (Math.abs(t - at) < 0.01) (viaPanel ? panel.edges : down).add(a);
  };
  const alone = voyage({ viewUp: false, seconds: 100 });
  const pressed = voyage({ viewUp: false, seconds: 100, play: taps([[50, 'MoveBackwards'], [51, 'MoveBackwards'], [52, BOAT_ACTIONS.sailDown], [53, BOAT_ACTIONS.toggleLight], [54, BOAT_ACTIONS.sailDown, true], [55, BOAT_ACTIONS.toggleSail, true]]) });
  assert.deepEqual(pressed.track.map((r) => [r.rung, r.sails, r.light]), alone.track.map((r) => [r.rung, r.sails, r.light]), 'nothing the passenger pressed reached her');
  assert.deepEqual(pressed.end, alone.end);
  assert.equal(pressed.at, true, 'still under way at her helm');
  const off = voyage({ viewUp: false, seconds: 60, play: taps([[40, BOAT_ACTIONS.disembark]]) });
  assert.equal(off.at, false, 'the disembark key steps the passenger from her helm');
  assert.ok(PASSENGER_KEYS.includes(BOAT_ACTIONS.disembark) && PASSENGER_KEYS.includes('Transport'));
  // a boat of mine, the view down: the keys are mine
  const mine = voyage({ booked: false, viewUp: false, seconds: 100, play: taps([[50, 'MoveBackwards'], [51, 'MoveBackwards'], [53, BOAT_ACTIONS.toggleLight]]) });
  assert.ok(mine.track.some((r) => r.light), 'my lantern is mine');
});

test('PASSAGE-HANDS: the helm panel at a booked ship\'s helm is a passenger\'s card - her name and her port, no buttons; a boat of mine keeps her helm (mutants: the card unread, the helm kept for a charter)', () => {
  const drawn = [];
  const scope = {
    csaRuntime: { helmPanelState: () => ({ hull: 1, hasSails: true }), state: { CurrentBoat: null } }, csaOn: () => true, isEnhancedPlus: () => true,
    document: {}, walkMode: true, enhancedHelmMounted: () => false, hideEnhancedHelm: () => {}, csaHelmInput: { held: new Set() },
    csaCall: (f) => f(), csaAboard: { aboard: null }, drawEnhancedHelm: (state) => drawn.push(state), peerName: (x) => x,
    townTalk: { hudCovered: false }, modes: null, gamePaused: () => false, hudRenderEnabled: () => true, touch: null,
    cursorActive: () => true, pointerSurfaces: new Set(), csaKeyLabel: () => '', csaHelmHooks: {}, travelView: { active: false },
    navalOn: () => true, _travelUIHolder: { ui: null }, holdsCargo: () => true, naval: null, passengerCard,
  };
  const draw = mount(scope, fn('  function csaDrawHelmPanel() {'), 'csaDrawHelmPanel');
  scope.csaRuntime.state.CurrentBoat = { hull: 1, charter: { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk' } };
  draw();
  assert.deepEqual([drawn.at(-1).helm, drawn.at(-1).aboard], [null, { hull: 1, passage: { ship: 'The Fair Silk', port: 'Wayrest' } }], 'a passenger\'s card');
  scope.csaRuntime.state.CurrentBoat = { hull: 1 };
  draw();
  assert.equal(drawn.at(-1).helm.hull, 1, 'my own: her helm');
  assert.equal(drawn.at(-1).aboard, null);
  const helm = readFileSync(join(ROOT, 'src/ui/enhanced/enhancedHelm.js'), 'utf8');
  assert.match(helm, /: aboard\.passage \? passengerTitle\(aboard\.passage\) :/, 'its title says where she is bound');
});

// ── PASSAGE-IN ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('PASSAGE-IN: her master\'s resume from her port\'s roadstead runs in - a plan that never sails is walked within VOYAGE_LANDFALL_PX of her port, and refused anywhere farther (AUDIT PASSAGE A1: never set down at the quay left, which is never that near a port booked) (mutants: the roadstead refused, every plan walked)', () => {
  const port = { x: 859, y: 244 };
  const landfall = { kinds: ['landfall', 'open'] };
  assert.equal(voyageSails({ x: 858, y: 246 }, port, landfall), true, 'off Wayrest, two pixels out: the landfall and the walk in');
  assert.equal(voyageSails({ x: 859 - VOYAGE_LANDFALL_PX - 1, y: 244 }, port, landfall), false, 'farther: a voyage sails');
  assert.equal(voyageSails({ x: 800, y: 240 }, port, { kinds: ['sea', 'sea', 'landfall'] }), true);
  assert.equal(voyageSails({ x: 858, y: 246 }, port, null), false, 'no plan, no voyage');
  // a quay left is never within the reach of a port booked
  const ports = [{ key: 'a', name: 'Near', px: 860, py: 245 }, { key: 'b', name: 'Far', px: 900, py: 245 }];
  assert.deepEqual(passageDestinations(ports, { x: 858, y: 246 }).map((d) => d.port.name), ['Far']);
  assert.match(WORLD, /if \(voyage && !voyageSails\(from, summary\.pixel, plan\)\) \{ noWay\?\.\(\); return false; \}/);
});

test('PASSAGE-IN: a pixel reached or left under sail is walked round no town - a ring\'s points stand on the town\'s land; on foot the ring stands (mutants: the rings back on the sea)', () => {
  const pixels = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }];
  const ringAt = (x) => (x === 11 || x === 12 ? [{ x: x * 32768, z: 0 }, { x: x * 32768 + 100, z: 0 }] : null);
  const sea = routeLegs(pixels, ['sea', 'sea', 'landfall'], { ringAt });
  assert.equal(sea.some((l) => l.ring), false, 'no ring on the sea');
  const land = routeLegs(pixels, ['open', 'open', 'open'], { ringAt });
  assert.equal(land.filter((l) => l.ring).length, 4, 'a walk rings both towns');
});

test('PASSAGE-IN: a sailed leg is aimed at its pixel\'s middle where the built ground floats her there; where it is that ground\'s land, at the nearest water that does (5 by 5 tiles); a pixel with no water built keeps its middle - and the autopilot\'s mark and arrival are that point (mutants: the mark unread, the middle always, a lone tile taken)', () => {
  const o = { x: 0, z: 0 }, TILE = PIXEL_UNITS / PIXEL_TILES;
  const tileOf = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
  // a pixel whose west three quarters are land, east quarter water - and one lone wet tile near the middle
  const water = (x, z) => { const [i, j] = tileOf(x, z); return (i >= 96 && i < 128 && j >= 0 && j < 128) || (i === 62 && j === 64); };
  const m = seaLegMark(o, water);
  assert.ok(m, 'a mark');
  assert.ok(tileOf(m.x, m.z)[0] >= 98, `in water with room for her hull: tile ${tileOf(m.x, m.z)}`);
  assert.equal(tileOf(m.x, m.z)[0], 98, 'the nearest such to the middle');
  assert.equal(seaLegMark(o, () => true), null, 'the middle floats her: the middle quarter');
  assert.equal(seaLegMark(o, () => false), null, 'nothing built: the middle');
  // Travel Options' sea leg, asked as the host asks it: the autopilot's centre is the mark
  const deps = { settings: readTravelOptionsSettings(), setTimeScale: () => {}, pushWindow: (w) => w.show?.(), worldPos: () => ({ x: 0, z: 0 }), mapPixel: () => ({ x: 0, y: 499 }), yaw: () => 0,
    seaWaterAt: (x, z) => { const oo = mapPixelWorldOrigin(1, 499); return water(x - oo.x, z - oo.z); } };
  const journey = createTravelOptions(deps);
  assert.equal(journey.beginTravelAlongRoute({ legs: [{ x: 1, y: 499, kind: 'sea' }], summary: { pixel: { x: 9, y: 499 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true);
  const c = journey.state.autopilot?.destinationCentre;
  const oo = mapPixelWorldOrigin(1, 499);
  assert.ok(c && tileOf(c.x - oo.x, c.z - oo.z)[0] === 98, `the autopilot aims at the mark: ${JSON.stringify(c)}`);
});

test('PASSAGE-IN on the real map (ARENA2): voyages to Wayrest, Daggerfall and Sentinel from every port town within 120 pixels - every sailed leg is aimed where the built ground floats her (56 voyages, 527 sailed legs: 80 were aimed at that ground\'s land, none now) (mutants: the mark unread, a lone tile taken)', { skip: portTerrain() ? false : 'ARENA2_PATH has no ARENA2' }, (t) => {
  const T = portTerrain();
  const woods = T.woods;
  const ground = routeGround((x, y) => T.maps.getClimateIndex(x, y), (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, null);
  // native units over the built ground (portTerrain: world metres, x east, z north - native is forty to the metre)
  const waterAt = (x, z) => T.isWater(x / 40, z / 40);
  const floatsAt = (x, z) => { const t = PIXEL_UNITS / PIXEL_TILES; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (!waterAt(x + a * t, z + b * t)) return false; return true; };
  let legs = 0, before = 0, after = 0, voyages = 0;
  for (const name of ['Wayrest', 'Daggerfall', 'Sentinel']) {
    const dest = T.towns.find((t) => t.name === name);
    assert.ok(dest, name);
    for (const from of T.towns) {
      if (from === dest || Math.max(Math.abs(from.px - dest.px), Math.abs(from.py - dest.py)) > 120) continue;
      const r = planRoute({ x: from.px, y: from.py }, { x: dest.px, y: dest.py }, { ...ground, sea: { start: 'sea', again: false, goal: 'land', voyage: true } });
      if (!r) continue;
      voyages++;
      for (const leg of routeLegs(r.pixels, r.kinds)) {
        if (leg.kind !== 'sea') continue;
        legs++;
        const o = mapPixelWorldOrigin(leg.x, leg.y);
        const mid = { x: o.x + PIXEL_UNITS / 2, z: o.z + PIXEL_UNITS / 2 };
        if (!floatsAt(mid.x, mid.z)) before++;
        const m = seaLegMark(o, waterAt) ?? mid;
        if (!floatsAt(m.x, m.z) && [...Array(PIXEL_TILES)].some((_, i) => waterAt(o.x + (i + 0.5) * (PIXEL_UNITS / PIXEL_TILES), mid.z))) after++;
      }
    }
  }
  assert.ok(voyages > 30 && legs > 300, `${voyages} voyages, ${legs} sailed legs`);
  assert.ok(before > 20, `before: ${before} legs aimed at the built ground's land`);
  assert.equal(after, 0, `after: ${after} aimed at land where water was built`);
  t.diagnostic(`${voyages} voyages, ${legs} sailed legs: ${before} aimed at the built ground's land before, ${after} after`);
});

// ── PASSAGE-PLATE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('PASSAGE-PLATE: the ship\'s plate stands down under a journey\'s own controls - the Overworld, or First Person Travel\'s bar - as the helm panel does, and stands again when they go (a foe near closes them: enemiesStop) (mutants: the plate over the Overworld, over the bar)', () => {
  const drawn = [];
  const scope = {
    navalOn: () => true, _mode: () => 'exterior', naval: { hudModel: () => ({ plate: {} }) },
    townTalk: { overlayActive: false, hudHidden: false }, gamePaused: () => false,
    controllerLook: () => false, padFamily: () => null, navalPadCodes: () => null, hdGlyphName: () => 'X', navalKeyName: (a) => a,
    enhancedHudScale: () => 1, enhancedHelmBar: () => null, enhancedHudBottom: () => null, enhancedHudQuick: () => null,
    isEnhanced: () => true, hudArt: null, classicCompassBox: () => null, touch: null, spyglass: { up: false },
    drawNavalHud: (m, opts) => drawn.push(opts.covered), travelView: { active: true }, _travelUIHolder: { ui: { isShowing: true } },
  };
  const navalHud = mount(scope, fn('  function navalHud(dt = 0) {'), 'navalHud');
  navalHud(0.25);
  assert.equal(drawn.pop(), true, 'under the Overworld');
  scope._travelUIHolder.ui.isShowing = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), true, 'the Overworld up, its bar not drawn: still under it');
  scope._travelUIHolder.ui.isShowing = true;
  scope.travelView.active = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), true, 'under First Person Travel\'s bar');
  scope._travelUIHolder.ui.isShowing = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), false, 'the journey over or stopped: the plate');
});

test('PASSAGE wiring by source: the host\'s Come Sail Away seam is the passenger\'s wrapper over the boat at the helm and the journey\'s hand; the journey\'s taps are its own and spent with the panel\'s; the journey is handed the built water (mutants: unwrapped, unwired)', () => {
  assert.match(WORLD, /    input: passengerHelm\(\{   \/\/ PASSAGE-HANDS[^\n]*\n\s+has: \(action\) => held\(keys, action\)/);
  assert.match(WORLD, /\.\.\.csaInput,[^\n]*\n {4}\}, \(\) => csaRuntime\?\.state\?\.CurrentBoat, csaJourneyHelm\),/);
  assert.match(WORLD, / {2}const csaJourneyHelm = createJourneyHand\(\);/);
  assert.match(WORLD, /csaHelmInput\.edges\.clear\(\); csaHelmInput\.chord\.clear\(\); csaJourneyHelm\.edges\.clear\(\);/);
  assert.equal((WORLD.match(/csaJourneyHelm\.press\(CSA_BOAT_ACTIONS\.(toggleSail|disembark)\)/g) ?? []).length, 3, 'the hand\'s sails twice and its landfall');
  assert.match(WORLD, /    seaWaterAt: \(x, z\) => tvSeaWaterAt\(\.\.\.state\.localFromWorld\(x, z\)\),/);
});
