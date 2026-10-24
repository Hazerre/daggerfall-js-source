// AUDIT KETCH L3-15 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 11): THE DECK STANDS WHAT BUILT - a part whose
// mesh would not build is posed and never drawn, so the frame goes on (one part's failed build threw from pose() every
// frame, before the frame's draw). tools/mutants/ketch_model.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKetchDeck } from '../../src/scenes/ketch/ketchDeckHost.js';
import { KT_STAGE } from '../../src/net/ketch/ketchLaw.js';

test('KETCH A PART THAT WOULD NOT BUILD: the deck stands, every frame poses without a throw at every stage, and no draw it hands the renderer is empty (AUDIT KETCH L3-15; mutants: a part that would not build left null)', () => {
  let n = 0;
  const renderer = { createMesh: () => { n++; if (n % 3 === 0) throw new Error('the GPU said no'); return { id: n }; } };
  const warn = console.warn; console.warn = () => {};
  try {
    const deck = createKetchDeck({ renderer }), draws = [];
    assert.equal(deck.stand({ dynamicDraws: draws, collider: null }), true);
    for (const sg of [KT_STAGE.watch, KT_STAGE.engine, KT_STAGE.sailwalk, KT_STAGE.bridge, KT_STAGE.vault]) {
      const V = { n: 1, sg, cl: { cr: [1, 1, 1, 1, 1, 1], br: [1, 1], lo: [], ca: [], bk: 0, nd: 3, sk: [0, 0, 0, 0, 0, 0, 0] }, ws: null };
      for (let t = 0; t < 40; t += 0.37) assert.doesNotThrow(() => deck.pose(V, t, t * 1000, null), `stage ${sg} at ${t}`);
    }
    assert.ok(draws.length > 0 && draws.every((d) => d.gpu), 'only what built is drawn');
  } finally { console.warn = warn; }
});

test('KETCH THE SHIP\'S HOT PATHS BUILD NOTHING A FRAME: the hazards\' and the sections\' poses written into the frame\'s own record; the lamps sorted in place, nearest first, handed on in the deck\'s own list; the frame\'s look the same object, its sky\'s foot written in place (AUDIT KETCH L3-16; mutants: the lamps unsorted)', async () => {
  const { hazardState, sectionPose } = await import('../../src/world/ketch/ketchPose.js');
  const { ketchFrameLook, ketchSkyFoot } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const h = { live: false, warn: false, k: 0 }, s = { solid: true, dy: 0, shake: 0, hidden: false };
  assert.equal(hazardState('arc', 0, 1.2, h), h);
  assert.deepEqual({ ...hazardState('arc', 0, 1.2, h) }, hazardState('arc', 0, 1.2), 'the same answer as a fresh one');
  assert.equal(sectionPose(2, [[2, 1000, 9000]], 2000, 3000, s), s);
  assert.deepEqual({ ...sectionPose(2, [[2, 1000, 9000]], 2000, 3000, s) }, sectionPose(2, [[2, 1000, 9000]], 2000, 3000));
  const foot = [0, 0, 0];
  assert.equal(ketchSkyFoot(600, foot), foot);
  assert.deepEqual(ketchSkyFoot(600, foot), ketchSkyFoot(600));
  const eye = deckToDungeon(0, 1.6, 30);
  assert.equal(ketchFrameLook(eye, 600), ketchFrameLook(eye, 900), 'one look object');
  const deck = createKetchDeck({ renderer: { createMesh: () => ({}) } });
  deck.stand({ dynamicDraws: [], collider: null });
  deck.pose({ n: 1, sg: KT_STAGE.engine, cl: { cr: [1, 1, 1, 1, 1, 1], br: [0, 0], lo: [], ca: [], bk: 2, nd: 3, sk: [0, 0, 0, 0, 0, 0, 0] }, ws: null }, 3, 3000, null);
  const a = deck.lightsNear(eye, 24), b = deck.lightsNear(deckToDungeon(0, -12, 90), 24);
  assert.equal(a, b, 'the deck\'s own list');
  const near = (l, e) => Math.hypot(l.x - e[0], l.y - e[1], l.z - e[2]) - l.range;
  const e2 = deckToDungeon(0, -12, 90);
  for (let i = 1; i < b.length; i++) assert.ok(near(b[i - 1], e2) <= near(b[i], e2) + 1e-9, 'nearest first');
  assert.ok(b.length > 0 && b.length <= 24);
});

test('KETCH THE LAB\'S COLLIDER IS THE WHOLE SHIP: the static ship and every part\'s at its place now - the cage, the gates, the hatches, the doors, the ring\'s sections - as the collider holds them (AUDIT KETCH L4-16; mutants: the parts left out)', async () => {
  const { buildKetchShip, buildKetchParts } = await import('../../src/world/ketch/ketchModel.js');
  const deck = createKetchDeck({ renderer: { createMesh: () => ({}) } });
  deck.stand({ dynamicDraws: [], collider: null });
  deck.pose({ n: 1, sg: KT_STAGE.watch, cl: null, ws: null }, 0, 0, null);
  const ship = buildKetchShip(), P = buildKetchParts();
  const parts = [P.cage, P.gateHold, P.gateTop, P.grateWatch, P.grateHold, P.doors, ...P.sections].reduce((n, p) => n + p.hit.length, 0);
  assert.ok(parts > 0);
  assert.equal(deck.colliderTris().length, ship.hit.length + parts);
});

test('KETCH THE NETS ARE CUTOUTS: the rigging net\'s picture uploaded with its holes cut, so the sky shows through; every other picture as it was (AUDIT KETCH L4-2; mutants: the net uploaded plain)', async () => {
  const { ensureKetchArt, KT_CUTOUT_RECS } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_REC, ketchNetArt } = await import('../../src/world/ketch/ketchArt.js');
  const up = [];
  ensureKetchArt({ uploadTexture: (arch, rec, img, o) => up.push([rec, o?.cutout === true]) });
  assert.deepEqual(KT_CUTOUT_RECS, [KT_REC.net, KT_REC.vane], 'the net and the pierced vane (KETCH-LOOK KL2, PIN MOVED)');
  assert.deepEqual(up.filter(([, c]) => c).map(([r]) => r), [KT_REC.vane, KT_REC.net], 'the net and the vane alone, cut');
  assert.ok(up.some(([r, c]) => r === KT_REC.cloud && !c), 'the puffs soft');
  const a = ketchNetArt().albedo, px = a.colors ?? a.data ?? a.pixels ?? a;
  let holes = 0; for (let i = 3; i < px.length; i += 4) if (px[i] === 0) holes++;
  assert.ok(holes > 0, 'it has holes to cut');
});

test('KETCH A STAIR\'S WHOLE FLIGHT IS BELOW DECKS: the waist\'s stair and the hold\'s, every step under the deck, in the lamps\' close air - never the open sky\'s; the open deck and the Sailwalk\'s fall outboard the sky\'s (AUDIT KETCH L4-7; mutants: the flight read by its zone alone)', async () => {
  const { ketchFrameLook } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_HATCH, KT_HOLD_HATCH, deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const eye = (x, feet, z) => deckToDungeon(x, feet + 1.6, z);
  for (const y of [-0.5, -1.5, -2.5, -3.5, -5.5]) assert.equal(ketchFrameLook(eye((KT_HATCH.x0 + KT_HATCH.x1) / 2, y, (KT_HATCH.z0 + KT_HATCH.z1) / 2), 720).below, true, `the waist's stair at ${y}`);
  for (const y of [-6.5, -8.5, -10.5]) assert.equal(ketchFrameLook(eye(0, y, (KT_HOLD_HATCH.z0 + KT_HOLD_HATCH.z1) / 2), 720).below, true, `the hold's stair at ${y}`);
  assert.equal(ketchFrameLook(eye(0, 0, 30), 720).below, false, 'the waist itself');
  assert.equal(ketchFrameLook(eye(24, -6, 120), 720).below, false, 'a fall outboard of the hull');
});

test('KETCH THE LODESTONE TURNS ON ITS OWN: the deck draws the stone behind the helm at its foot, and every frame turns it - at every stage, the Warden standing or felled (AUDIT KETCH L5-7; mutants: the stone never turned)', async () => {
  const { buildKetchParts, KT_LODESTONE } = await import('../../src/world/ketch/ketchModel.js');
  const { deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const want = buildKetchParts().lodestone.model.positions;
  const deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } }), draws = [];
  deck.stand({ dynamicDraws: draws, collider: null });
  const d = draws.find((x) => x.gpu?.m?.positions?.length === want.length && x.gpu.m.positions.every((v, i) => v === want[i]));
  assert.ok(d, 'the lodestone drawn');
  const at = deckToDungeon(KT_LODESTONE.x, KT_LODESTONE.y, KT_LODESTONE.z);
  for (const sg of [KT_STAGE.watch, KT_STAGE.bridge, KT_STAGE.vault]) {
    deck.pose({ n: 1, sg, cl: null, ws: null }, 10, 10_000, null);
    const m0 = [...d.object.matrix];
    deck.pose({ n: 1, sg, cl: null, ws: null }, 12, 12_000, null);
    const m1 = [...d.object.matrix];
    assert.equal(d.hidden, false, `shown at stage ${sg}`);
    assert.deepEqual([m1[12], m1[13], m1[14]].map((v) => Math.round(v * 1e4) / 1e4), at.map((v) => Math.round(v * 1e4) / 1e4), 'at its foot');
    assert.ok(Math.abs(m1[0] - m0[0]) > 0.05 || Math.abs(m1[2] - m0[2]) > 0.05, `turned between the frames at stage ${sg}`);
  }
});

test('KETCH HER NIGHT NO DARKER THAN THE WORLD\'S: on her open deck at midnight the frame\'s ambient is never under DFU\'s exterior night floor, and the day\'s only brighter (the live run at 04:00 UTC found her deck black at 0.1; AUDIT KETCH L5-9: pinned by the live run alone; mutants: her night at 0.1)', async () => {
  const { ketchFrameLook } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { EXTERIOR_NIGHT_AMBIENT } = await import('../../src/world/worldClock.js');
  const { deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const eye = deckToDungeon(0, 1.6, 30);
  for (const minute of [0, 120, 1380]) {
    const L = ketchFrameLook(eye, minute);
    assert.equal(L.below, false);
    for (let k = 0; k < 3; k++) assert.ok(L.ambient[k] >= EXTERIOR_NIGHT_AMBIENT[k], `minute ${minute}, channel ${k}: ${L.ambient[k]}`);
  }
  const night = [...ketchFrameLook(eye, 0).ambient], noon = [...ketchFrameLook(eye, 720).ambient];
  for (let k = 0; k < 3; k++) assert.ok(noon[k] >= night[k], 'the day no darker than the night');
});

test('KETCH-LOOK KL0 ONE BOLT A STRIKE: an arc-coil\'s bolt holds still through its live span and changes only between strikes - never the 16.7 frames a second that broke the flash law (TELEGRAPH_THROB_MAX_HZ 3); the strike count steps exactly at a landing (mutants: the bolt swapped by the clock)', async () => {
  const { buildKetchParts } = await import('../../src/world/ketch/ketchModel.js');
  const { hazardStrike, hazardPhase } = await import('../../src/world/ketch/ketchPose.js');
  const { KT_ARCS } = await import('../../src/net/ketch/ketchDeck.js');
  const { TELEGRAPH_THROB_MAX_HZ } = await import('../../src/render/gate/gateTelegraph.js');
  const arcModels = buildKetchParts().arc.map((a) => a.model.positions);
  const deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } }), draws = [];
  deck.stand({ dynamicDraws: draws, collider: null });
  const isArc = (gpu) => !!gpu && arcModels.some((p) => p.length === gpu.m.positions.length && p.every((v, i) => v === gpu.m.positions[i]));
  for (let j = 0; j < KT_ARCS.z.length; j++) {
    const live0 = hazardPhase('arc', j) + 2 * KT_ARCS.cycle;   // the third strike's landing (the coils' spans never overlap)
    const bolts = new Set();
    for (const strike of [0, 1, 2, 3]) {
      let held = null, changes = 0;
      for (let t = live0 + strike * KT_ARCS.cycle + 0.02; t < live0 + strike * KT_ARCS.cycle + KT_ARCS.sp / 1000 - 0.02; t += 1 / 60) {
        deck.pose({ n: 1, sg: KT_STAGE.engine, cl: null, ws: null }, t, t * 1000, null);
        const shown = draws.filter((d) => !d.hidden && isArc(d.gpu));
        assert.equal(shown.length, 1, 'one coil live');
        const g = shown[0].gpu;
        if (held && g !== held) changes++;
        held = g;
      }
      assert.equal(changes, 0, `arc ${j}, strike ${strike}: its bolt held through the span`);
      bolts.add(held);
      assert.equal(hazardStrike('arc', j, live0 + strike * KT_ARCS.cycle + 0.01), hazardStrike('arc', j, live0 + strike * KT_ARCS.cycle - 0.01) + 1, 'the count steps at the landing');
    }
    assert.ok(bolts.size >= 2, `arc ${j}: the bolt changes between strikes`);
  }
  assert.ok(TELEGRAPH_THROB_MAX_HZ <= 3);
});

test('KETCH-LOOK KL0 NOTHING THAT MOVES CASTS: the mast-lift\'s cage never records a shadow; a bridge section casts whole and still, and not from its warning to its return - so no lamp\'s cube is rebuilt every frame a part rides (mutants: the cage casts; a falling section casts)', async () => {
  const { buildKetchParts } = await import('../../src/world/ketch/ketchModel.js');
  const { KW_SECTION_WARN_MS } = await import('../../src/net/ketch/ketchWarden.js');
  const P = buildKetchParts(), same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } }), draws = [];
  deck.stand({ dynamicDraws: draws, collider: null });
  const cage = draws.find((d) => d.gpu && same(d.gpu.m.positions, P.cage.model.positions));
  assert.ok(cage && cage.noShadow === true, 'the cage casts nothing');
  const s1 = draws.find((d) => d.gpu && same(d.gpu.m.positions, P.sections[1].model.positions));
  const at = 100_000, back = at + 7000;
  const casts = (now) => { deck.pose({ n: 1, sg: KT_STAGE.bridge, cl: null, ws: { ph: 3, rs: [1, 1, 1, 1], sec: [[1, at, back]] } }, now / 1000, now, null); return !s1.noShadow; };
  assert.equal(casts(at - KW_SECTION_WARN_MS - 100), true, 'whole and still before its warning');
  assert.equal(casts(at - KW_SECTION_WARN_MS / 2), false, 'lurching in its warning');
  assert.equal(casts(at + 300), false, 'falling');
  assert.equal(casts(back - 400), false, 'rising back');
  assert.equal(casts(back + 100), true, 'home again');
});

test('KETCH-LOOK KL0 A WARNED SECTION LURCHES UNDER THE FLASH LAW: its shake turns at most 2.5 times a second (the heartbeat ceiling under TELEGRAPH_THROB_MAX_HZ) - it shook at 6.9 Hz (a sine of now / 23 ms) (mutants: the shudder fast)', async () => {
  const { sectionPose, KT_SECTION_LURCH_HZ } = await import('../../src/world/ketch/ketchPose.js');
  assert.ok(KT_SECTION_LURCH_HZ <= 2.5);
  const at = 50_000, warn = 3000;
  let crossings = 0, prev = null;
  for (let now = at - warn; now < at; now += 5) {
    const s = sectionPose(0, [[0, at, at + 7000]], now, warn).shake;
    if (prev != null && Math.sign(s) !== Math.sign(prev) && s !== 0 && prev !== 0) crossings++;
    prev = s;
  }
  assert.ok(crossings / 2 / (warn / 1000) <= 2.5, `${crossings} crossings in ${warn / 1000} s`);
  assert.ok(crossings >= 4, 'and it does lurch');
});

test('KETCH-LOOK KL1 THE LOOK ON THE RENDERER: on a ship the frame takes her trilight (its equator the flat ambient), the sun, the moons\' key off the world\'s own moon by night and none by day, the haze - and on the lane her zone\'s grade every frame, on the classic set none; her lamps at the gain of the zone the eye stands in - the open decks\' by the hour, below decks\' and the cabin\'s by their rows (mutants: the grade off the lane; the key from no moon; the lamps\' gain on every lamp)', async () => {
  const { createKetchDeckHost } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_HOURS, KT_TRI } = await import('../../src/world/ketch/ketchAtmos.js');
  const { KT_LAMP } = await import('../../src/world/ketch/ketchModel.js');
  const { MOONLIGHT } = await import('../../src/render/enhancedSky.js');
  const { deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const run = (lane, moon, eyeDeck, minute) => {
    const calls = { grade: [], moon: [], light: null, lights: null };
    const renderer = {
      lightingLane: lane ? {} : null, createMesh: () => ({}),
      setLighting: (a, s, c, tri) => { calls.light = { a: [...a], s, c: [...c], tri: tri && { sky: [...tri.sky], ground: [...tri.ground] } }; },
      setMoonlight: (m) => calls.moon.push(m && { scale: m.scale, dir: [...m.dir], color: [...m.color] }),
      setSceneGrade: (g) => calls.grade.push(g && { ...g }), setFog: () => {}, setFogColor: () => {},
      setPointLights: (d, _, c) => { calls.lights = c; },
    };
    const H = createKetchDeckHost({ renderer, host: {}, wm: { mode: 'dungeon', dungeonCtx: null, dungeonLoc: null, place: () => true }, moon: () => moon });
    H.stand({ dynamicDraws: [], collider: null, addTeardown: () => {} });
    const lit = { data: new Float32Array(0), colors: new Float32Array(0) };
    H.frameLook(deckToDungeon(...eyeDeck), lit, minute);
    return { calls, deck: H.deck() };
  };
  // noon on the waist, the lane: the day's grade, no key, the trilight's equator the flat ambient
  const day = run(true, null, [0, 1.7, 30], 720);
  assert.deepEqual(day.calls.grade, [{ ...KT_HOURS.day.grade }], 'the day\'s grade, once a frame');
  assert.deepEqual(day.calls.moon, [null], 'no moon by day');
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(day.calls.light.a[k] - KT_HOURS.day.ambient[k] * KT_TRI.equator) < 1e-6 && Math.abs(day.calls.light.tri.sky[k] - KT_HOURS.day.ambient[k]) < 1e-6);
  // the classic set: the light, no grade
  const classic = run(false, null, [0, 1.7, 30], 720);
  assert.deepEqual(classic.calls.grade, [], 'nothing graded on the classic set');
  assert.ok(classic.calls.light, 'lit all the same');
  // the hold at noon: below's grade
  assert.deepEqual(run(true, null, [0, -10.3, 120], 720).calls.grade, [{ ...KT_HOURS.below.grade }]);
  // midnight under a full Masser: the moons' key along the moon, its share the moon's
  const moon = { dir: [0.3, 0.9, 0.3], scale: MOONLIGHT.masser, color: [1, 1, 1] };
  const night = run(true, moon, [0, 1.7, 30], 0);
  assert.equal(night.calls.moon.length, 1);
  assert.deepEqual(night.calls.moon[0].dir, moon.dir);
  assert.ok(Math.abs(night.calls.moon[0].scale - 1) < 1e-9 && night.calls.moon[0].color.every((v, k) => Math.abs(v - KT_HOURS.night.key[k]) < 1e-9), 'her key\'s colour at the full share');
  const half = run(true, { ...moon, scale: MOONLIGHT.masser / 2 }, [0, 1.7, 30], 0);
  assert.ok(Math.abs(half.calls.moon[0].scale - 0.5) < 1e-9, 'a half moon half the key');
  assert.deepEqual(run(true, null, [0, 1.7, 30], 0).calls.moon, [null], 'no moon, no key');
  // the lamps: her open decks' at the night's gain while the eye is on them, below decks' and the cabin's as they were
  const lamps = night.deck.lightsNear(null, 64), of = (z) => lamps.filter((l) => l.zone === z);
  assert.equal(of('deck').length, 23);
  for (const l of of('deck')) assert.ok(l.color.every((v, k) => Math.abs(v - KT_LAMP.color[k] * KT_HOURS.night.lamps) < 1e-9));
  for (const l of [...of('below'), ...of('cabin')]) assert.deepEqual(l.color, [...KT_LAMP.below]);
  // the eye below decks: below's lamps at below's gain, the open decks' left at the last
  const H = run(true, null, [0, -10.3, 120], 720).deck;
  H.lampGain(KT_HOURS.night.lamps, 'deck');
  H.lampGain(KT_HOURS.below.lamps, 'below');
  const all = H.lightsNear(null, 64), in3 = (z) => all.filter((l) => l.zone === z);
  for (const l of in3('below')) assert.ok(l.color.every((v, k) => Math.abs(v - KT_LAMP.below[k] * KT_HOURS.below.lamps) < 1e-9), 'below at below\'s gain');
  for (const l of in3('deck')) assert.ok(l.color.every((v, k) => Math.abs(v - KT_LAMP.color[k] * KT_HOURS.night.lamps) < 1e-9), 'the open decks\' as they were');
  H.lampGain(KT_HOURS.cabin.lamps, 'cabin');
  for (const l of in3('cabin')) assert.ok(l.color.every((v, k) => Math.abs(v - KT_LAMP.below[k] * KT_HOURS.cabin.lamps) < 1e-9), 'the cabin\'s its own');
});

test('KETCH-LOOK KL1 THE SKY ON THE HOUR OFF THE STREET: a made level that draws the world\'s sky takes the street\'s last use again on the clocks now - its sky, its night sky, its weather kept, the minute and both clocks moved - and nothing before the street\'s first; the drawSky door hands its draw the clocks, a term in its own line; her night key\'s moon is the world\'s, read off the clock (her sky stood at the minute she was boarded while her hour turned - twelve game hours a real one online; mutants: the door draws the street\'s minute)', async () => {
  const { readFileSync } = await import('node:fs');
  const { createSkyController } = await import('../../src/scenes/shared.js');
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : (k === 'drawingBufferWidth' || k === 'drawingBufferHeight' ? 64 : () => ({})))) });
  const fetchWas = globalThis.fetch, warn = console.warn;
  globalThis.fetch = () => Promise.reject(new Error('no data here')); console.warn = () => {};
  try {
    const ctl = createSkyController(gl, new URLSearchParams('sky=classic'));
    const seen = [], realUse = ctl.use;
    ctl.use = (...a) => { seen.push(a); };
    ctl.retime(600, 10, 20);
    assert.equal(seen.length, 0, 'nothing before the street\'s first use');
    ctl.use = realUse;
    ctl.use(16, 540, false, { weather: 'rain', classicMinutes: 100, skyMinutes: 200, pos: [1, 2, 3] });
    ctl.use = (...a) => { seen.push(a.map((v) => (v && typeof v === 'object' ? { ...v } : v))); };
    ctl.retime(1080, 500, 600);
    ctl.retime(1081, 501, 601);
    assert.equal(seen.length, 2);
    assert.deepEqual(seen[0], [16, 1080, false, { weather: 'rain', classicMinutes: 500, skyMinutes: 600, pos: [1, 2, 3] }]);
    assert.deepEqual(seen[1].slice(0, 3), [16, 1081, false]);
    assert.equal(seen[1][3].skyMinutes, 601);
    // the draw handed the clocks retimes first; handed none (the street's, its use run) it does not
    const drew = [];
    ctl.renderer.draw = () => drew.push(seen.length);
    ctl.draw(0, 0, 1, 1, [0, 0, 64, 64], 1100, 700, 800);
    assert.deepEqual(seen.at(-1).slice(0, 3), [16, 1100, false]);
    assert.equal(seen.at(-1)[3].skyMinutes, 800);
    assert.deepEqual(drew, [seen.length], 'retimed, then drawn');
    ctl.draw(0, 0, 1, 1, [0, 0, 64, 64]);
    assert.equal(seen.length, drew[0], 'the street\'s draw retimes nothing');
  } finally { globalThis.fetch = fetchWas; console.warn = warn; }
  const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /drawSky: \(yaw, pitch, fov, aspect, vp\) => \{ sky\.draw\(yaw, pitch, fov, aspect, vp, minuteNow\(\), playerTicker\.classicMinutes, skyMinutes\(\)\); renderer\.markForeignPass\(\); \},/, 'the door hands the clocks');
  // her moon: the world's sky's own term on the clock - none by day, Masser's bearing by night, its share the moon's
  const { ketchMoonNow } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { moonlightTerm, skyState } = await import('../../src/render/enhancedSky.js');
  assert.equal(ketchMoonNow(14400 + 720, 'sunny'), null, 'none at noon');
  const day = 4 * 1440;   // a night with Masser up: the term the world's sky draws by
  let night = null;
  for (let d = 0; d < 32 && !night; d++) { const m = (day + d * 1440) + 60; const t = ketchMoonNow(m, 'sunny'); if (t && t.scale > 0.1) night = { m, t }; }
  assert.ok(night, 'a night with a moon up');
  assert.deepEqual(night.t, moonlightTerm(skyState({ minuteOfDay: night.m % 1440, weather: 'sunny', classicMinutes: night.m, skyMinutes: night.m })), 'the sky\'s own term');
  assert.equal(ketchMoonNow(night.m + 0.4, 'sunny'), night.t, 'made once a sky minute');
  const m2 = night.m + 1, clear = moonlightTerm(skyState({ minuteOfDay: m2 % 1440, weather: 'sunny', classicMinutes: m2, skyMinutes: m2 })), cloud = ketchMoonNow(m2, 'overcast');
  assert.ok(cloud && cloud.scale < clear.scale * 0.9, 'the weather\'s clouds dim it');
});

test('KETCH-LOOK KL2 HER ART THROUGH THE PLAYER\'S PALETTE AT UPLOAD: up first in its fallback colours, then once more through ART_PAL when it is read - never back to the fallback after (the world outside\'s door asks again with none); a renderer that cannot upload asks nothing (mutants: the palette never asked; the fallback over the palette)', async () => {
  const { ensureKetchArt, ketchArtUp } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { ketchArt, KT_REC } = await import('../../src/world/ketch/ketchArt.js');
  const ups = [], renderer = { uploadTexture: (a, rec, img) => ups.push([rec, img.colors.slice(0, 4)]), uploadEmissionTexture: () => {} };
  ensureKetchArt(renderer);
  const n = ketchArt().length;
  assert.equal(ups.length, n, 'every record up');
  const rgb = new Uint8Array(768).fill(7);
  ensureKetchArt(renderer, rgb);
  assert.equal(ups.length, 2 * n, 'up again through the palette');
  assert.deepEqual([...ups.at(-1)[1]].slice(0, 3), [7, 7, 7], 'in its colours');
  ensureKetchArt(renderer);
  ensureKetchArt(renderer, rgb);
  assert.equal(ups.length, 2 * n, 'never back, never twice');
  const asked = [];
  ketchArtUp({ uploadTexture: () => asked.push(1), uploadEmissionTexture: () => {} }, false);
  assert.ok(asked.length > 0, 'the lab\'s own colours up');
  assert.doesNotThrow(() => ketchArtUp({}), 'no upload, no ask');
  assert.ok(ketchArt().some(([rec]) => rec === KT_REC.inner));
});

test('KETCH-LOOK KL2 THE CLASSIC SET CARRIES THE EYE: off the lane her light (the trilight, the sun, the moons\' key) and her lamps take the row\'s classic gains - brighter in the dark rooms and the twilights, a little dimmer at noon, as the lane\'s eye would open and close; on the lane the rows as they are (mutants: the classic set unscaled; its lamps unscaled)', async () => {
  const { ketchFrameLook } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_HOURS } = await import('../../src/world/ketch/ketchAtmos.js');
  const { deckToDungeon } = await import('../../src/net/ketch/ketchDeck.js');
  const moon = { dir: [0, 1, 0], scale: 1 };
  for (const [at, minute, row] of [[[0, 1.7, 30], 720, 'day'], [[0, 1.7, 30], 18.25 * 60, 'dusk'], [[0, -10.3, 120], 720, 'below'], [[0, 1.7, 30], 120, 'night']]) {
    const eye = deckToDungeon(...at);
    const lane = ketchFrameLook(eye, minute, true, moon), A = [...lane.ambient], S = lane.sunScale, K = lane.key.scale, Lp = lane.lamps;
    const cl = ketchFrameLook(eye, minute, false, moon), C = KT_HOURS[row].classic;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(cl.ambient[k] - A[k] * C.light) < 1e-9 && Math.abs(cl.tri.equator[k] - A[k] * 0.8 * C.light) < 1e-9, `${row}: the light`);
    assert.ok(Math.abs(cl.sunScale - S * C.light) < 1e-9 && Math.abs(cl.key.scale - K * C.light) < 1e-9, `${row}: the sun and the key`);
    assert.ok(Math.abs(cl.lamps - Lp * C.lamps) < 1e-9, `${row}: the lamps`);
  }
  assert.ok(KT_HOURS.below.classic.light > 1 && KT_HOURS.dusk.classic.light > 1 && KT_HOURS.day.classic.light < 1 && KT_HOURS.cabin.classic.lamps > 1, 'the dark rooms and the twilights up, the noon down');
});
