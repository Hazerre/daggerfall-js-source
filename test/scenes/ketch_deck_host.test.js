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
  assert.deepEqual(KT_CUTOUT_RECS, [KT_REC.net]);
  assert.deepEqual(up.filter(([, c]) => c).map(([r]) => r), [KT_REC.net], 'the net alone, cut');
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
