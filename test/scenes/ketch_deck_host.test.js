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
